import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const harness = new URL("supabase/tests/postgres-ci/", root);
const migrationUrl = new URL(
  "supabase/migrations/20260714235900_finance_integration_foundation.sql",
  root,
);
const outboxMigrationUrl = new URL(
  "supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql",
  root,
);
const resolverMigrationUrl = new URL(
  "supabase/migrations/20260715020000_finance_subject_resolver_v1.sql",
  root,
);
const workflow = readFileSync(
  new URL(".github/workflows/verify-finance-integration.yml", root),
  "utf8",
);
const migration = readFileSync(migrationUrl, "utf8");
const outboxMigration = readFileSync(outboxMigrationUrl, "utf8");
const resolverMigration = readFileSync(resolverMigrationUrl, "utf8");
const runScript = readFileSync(new URL("run.sh", harness), "utf8");
const bootstrap = readFileSync(new URL("bootstrap.sql", harness), "utf8");
const behaviorSmoke = readFileSync(new URL("behavior_smoke.sql", harness), "utf8");
const outboxBehaviorSmoke = readFileSync(
  new URL("outbox_behavior_smoke.sql", harness),
  "utf8",
);
const postflight = readFileSync(new URL("postflight.sql", harness), "utf8");
const outboxPostflight = readFileSync(new URL("outbox_postflight.sql", harness), "utf8");
const resolverBehaviorSmoke = readFileSync(
  new URL("resolver_behavior_smoke.sql", harness),
  "utf8",
);
const resolverPostflight = readFileSync(
  new URL("resolver_postflight.sql", harness),
  "utf8",
);
const fingerprint = readFileSync(new URL("catalog_fingerprint.sql", harness), "utf8");
const runPath = fileURLToPath(new URL("run.sh", harness));

const expectedHarnessFiles = [
  "README.md",
  "behavior_smoke.sql",
  "bootstrap.sql",
  "catalog_fingerprint.sql",
  "outbox_behavior_smoke.sql",
  "outbox_postflight.sql",
  "postflight.sql",
  "resolver_behavior_smoke.sql",
  "resolver_postflight.sql",
  "run.sh",
  "static_guard.test.mjs",
];

const validRunnerEnvironment = Object.freeze({
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  CI: "true",
  MAIN_FINANCE_CI_ALLOW_EPHEMERAL: "1",
  PGHOST: "127.0.0.1",
  PGPORT: "54321",
  PGDATABASE: "main_finance_ci",
  PGUSER: "postgres",
  PGPASSWORD: "main-finance-ci-ephemeral-only",
  PGSSLMODE: "disable",
  PGCONNECT_TIMEOUT: "5",
});

function runRejectedEnvironment(overrides) {
  return spawnSync(runPath, [], {
    encoding: "utf8",
    env: { ...validRunnerEnvironment, ...overrides },
    timeout: 5_000,
  });
}

test("workflow uses an immutable disposable PostgreSQL 17 service", () => {
  assert.match(
    workflow,
    /^\s*image:\s*postgres:17\.10-bookworm@sha256:17b6c778de50f4bb9a878c36e736110fbcd9b7020377d6fdfdf20f7c0347e40a\s*$/m,
  );
  assert.match(workflow, /^\s*timeout-minutes:\s*15\s*$/m);
  assert.match(workflow, /^\s*POSTGRES_DB:\s*main_finance_ci\s*$/m);
  assert.match(workflow, /^\s*PGHOST:\s*127\.0\.0\.1\s*$/m);
  assert.match(workflow, /^\s*PGDATABASE:\s*main_finance_ci\s*$/m);
  assert.match(
    workflow,
    /^\s*MAIN_FINANCE_CI_ALLOW_EPHEMERAL:\s*"1"\s*$/m,
  );
  assert.match(
    workflow,
    /node --test supabase\/tests\/postgres-ci\/static_guard\.test\.mjs/,
  );
  assert.match(workflow, /\.\/supabase\/tests\/postgres-ci\/run\.sh/);
  assert.doesNotMatch(
    workflow,
    /\$\{\{\s*secrets\.|SUPABASE_[A-Z]|service[_-]?role[_-]?key|https?:\/\//i,
  );
});

test("reviewed migration is exact and avoids PostgreSQL reserved aliases", () => {
  const digest = createHash("sha256").update(migration).digest("hex");
  assert.equal(
    digest,
    "78b9a8619ab3487424602ffaba6fcad02e7557a7112c2639370cb8d28fa2a9e6",
  );
  assert.doesNotMatch(migration, /\bAS\s+(?:collation|constraint)\b/i);
  assert.match(migration, /ERRCODE = '55000'/);
  assert.match(migration, /DETAIL = \([\s\S]*?pg_get_constraintdef/);
  assert.match(
    migration,
    /actual\.connoinherit IS DISTINCT FROM \(expected\.constraint_type <> 'c'\)/,
  );
  assert.match(
    migration,
    /integration tables already exist; this one-shot migration will not accept drift or reruns\./,
  );
  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /^COMMIT;$/m);
  assert.equal(
    [...migration.matchAll(/^CREATE FUNCTION public\.architecture_/gm)].length,
    4,
  );
  assert.doesNotMatch(
    migration,
    /^CREATE OR REPLACE FUNCTION public\.architecture_/m,
  );
  assert.match(migration, /ARRAY\[0,3\]::smallint\[\]/);
  assert.match(migration, /index_row\.indoption\[key_number - 1\]::smallint/);
  assert.match(migration, /attempt_count = attempt_count \+ 1,[\s\S]*?updated_at = clock_timestamp\(\)/);
  assert.match(migration, /NEW\.updated_at := clock_timestamp\(\);/);
  assert.match(
    migration,
    /has_schema_privilege\('service_role', 'public', 'USAGE'\)/,
  );
  assert.doesNotMatch(migration, /\$catalog_diagnostics\$|main_finance_index_catalog/);
});

test("entitlement outbox is a separate pinned additive migration", () => {
  assert.equal(
    createHash("sha256").update(outboxMigration).digest("hex"),
    "e9164c9d960c7411221c6102c927c180535cb2f509b7b65e3f6af57c675414c4",
  );
  assert.match(outboxMigration, /^-- DRAFT \/ NOT APPLIED \/ STAGING ONLY$/m);
  assert.match(outboxMigration, /^BEGIN;$/m);
  assert.match(outboxMigration, /^COMMIT;$/m);
  assert.equal(
    [...outboxMigration.matchAll(/^CREATE TABLE public\.architecture_/gm)].length,
    2,
  );
  assert.equal(
    [...outboxMigration.matchAll(/^CREATE FUNCTION public\.architecture_/gm)].length,
    3,
  );
  assert.equal(
    [...outboxMigration.matchAll(/^ALTER TABLE public\.architecture_.* ENABLE ROW LEVEL SECURITY;$/gm)].length,
    2,
  );
  assert.match(outboxMigration, /architecture_finance_access_desired/);
  assert.match(outboxMigration, /architecture_finance_access_outbox/);
  assert.match(outboxMigration, /state IN \('pending', 'processing', 'retry_wait', 'applied', 'dead_letter'\)/);
  assert.match(outboxMigration, /FOR UPDATE SKIP LOCKED/);
  assert.match(outboxMigration, /earlier\.version < candidate\.version/);
  assert.match(outboxMigration, /p_outcome NOT IN \('applied', 'retry', 'dead_letter'\)/);
  assert.match(outboxMigration, /15 \* power\(2::numeric, v_event\.attempt_count - 1\)::integer/);
  assert.match(outboxMigration, /idempotency_conflict/);
  assert.match(outboxMigration, /claim_token_consumed/);
  assert.match(outboxMigration, /lease_expired_max_attempts/);
  assert.match(outboxMigration, /main_user_id uuid NOT NULL/);
  assert.doesNotMatch(outboxMigration, /\btelegram_id\b|raw_init_data|bot_token|email|phone/i);
  assert.doesNotMatch(outboxMigration, /^ALTER TABLE (?:ONLY )?public\.users/m);
  assert.doesNotMatch(outboxMigration, /^CREATE OR REPLACE FUNCTION public\.architecture_/m);
});

test("subject resolver is service-only and preserves bigint identity as text", () => {
  assert.equal(
    createHash("sha256").update(resolverMigration).digest("hex"),
    "a4cc385026f750f90b213acb46d453b0835f64661907d2314fe02cb6689ffa84",
  );
  assert.match(resolverMigration, /^-- DRAFT \/ NOT APPLIED \/ STAGING ONLY$/m);
  assert.match(resolverMigration, /^BEGIN;$/m);
  assert.match(resolverMigration, /^COMMIT;$/m);
  assert.equal(
    [...resolverMigration.matchAll(/^CREATE FUNCTION public\.architecture_/gm)].length,
    1,
  );
  assert.match(
    resolverMigration,
    /SELECT user_row\.telegram_id::text[\s\S]*?FROM public\.users/,
  );
  assert.match(
    resolverMigration,
    /coalesce\(auth\.role\(\), ''\) <> 'service_role'/,
  );
  assert.match(
    resolverMigration,
    /REVOKE ALL ON FUNCTION public\.architecture_resolve_finance_subject_internal\(uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
  );
  assert.match(
    resolverMigration,
    /GRANT EXECUTE ON FUNCTION public\.architecture_resolve_finance_subject_internal\(uuid\)[\s\S]*?TO service_role/,
  );
  assert.doesNotMatch(
    resolverMigration,
    /(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.users/,
  );
  assert.match(resolverBehaviorSmoke, /9000000000000000001/);
  assert.match(resolverBehaviorSmoke, /resolver did not preserve exact bigint text/);
  assert.match(resolverPostflight, /exact function ACL differs/);
});

test("harness inputs are regular files and runner fails closed", () => {
  for (const name of expectedHarnessFiles) {
    const status = lstatSync(new URL(name, harness));
    assert.ok(status.isFile(), `${name} must be a regular file`);
    assert.ok(!status.isSymbolicLink(), `${name} must not be a symlink`);
  }
  const migrationStatus = lstatSync(migrationUrl);
  assert.ok(migrationStatus.isFile());
  assert.ok(!migrationStatus.isSymbolicLink());
  const outboxMigrationStatus = lstatSync(outboxMigrationUrl);
  assert.ok(outboxMigrationStatus.isFile());
  assert.ok(!outboxMigrationStatus.isSymbolicLink());
  const resolverMigrationStatus = lstatSync(resolverMigrationUrl);
  assert.ok(resolverMigrationStatus.isFile());
  assert.ok(!resolverMigrationStatus.isSymbolicLink());

  assert.match(runScript, /^set -Eeuo pipefail$/m);
  assert.match(runScript, /CI:-.*== "true"/);
  assert.match(runScript, /MAIN_FINANCE_CI_ALLOW_EPHEMERAL:-.*== "1"/);
  assert.match(
    runScript,
    /PGHOST must be exactly 127\.0\.0\.1; remote databases are forbidden/,
  );
  assert.match(runScript, /PGDATABASE must be main_finance_ci/);
  assert.match(runScript, /database is not a pristine disposable PostgreSQL service/);
  assert.match(runScript, /version_number >= 170000 && version_number < 180000/);
  assert.match(runScript, /--host="\$PGHOST"/);
  assert.match(runScript, /--set=ON_ERROR_STOP=1/);
  assert.match(runScript, /--set=VERBOSITY=verbose/);
  assert.match(runScript, /one-shot migration unexpectedly accepted a second application/);
  assert.match(runScript, /rejected foundation retry did not report SQLSTATE 55000/);
  assert.match(runScript, /catalog changed during the rejected migration retry/);
  assert.match(runScript, /data changed during the rejected migration retry/);
  assert.match(runScript, /outbox one-shot migration unexpectedly accepted a second application/);
  assert.match(runScript, /rejected outbox retry did not report SQLSTATE 55000/);
  assert.doesNotMatch(
    runScript,
    /supabase\s+(?:db|functions|migration)|https?:\/\/|curl|wget|\bnpx\b|\bnpm\b/i,
  );
});

test("runner rejects alternate routes and credentials before psql", () => {
  for (const pgHost of ["localhost", "::1", "db.example.test", "/tmp"]) {
    const result = runRejectedEnvironment({ PGHOST: pgHost });
    assert.notEqual(result.status, 0, `PGHOST=${pgHost} must fail`);
    assert.match(result.stderr, /PGHOST must be exactly 127\.0\.0\.1/);
  }

  for (const pgPort of ["", "0", "65536", "-1", "abc"]) {
    const result = runRejectedEnvironment({ PGPORT: pgPort });
    assert.notEqual(result.status, 0, `PGPORT=${pgPort} must fail`);
    assert.match(result.stderr, /PGPORT must be an integer from 1 through 65535/);
  }

  for (const [name, value, message] of [
    ["PGPASSWORD", "different", /fixed ephemeral CI credential/],
    ["PGSSLMODE", "prefer", /PGSSLMODE must be disable/],
    ["PGCONNECT_TIMEOUT", "30", /PGCONNECT_TIMEOUT must be exactly 5/],
    ["PGHOSTADDR", "127.0.0.1", /PGHOSTADDR must be unset/],
    ["PGSERVICE", "unexpected", /PGSERVICE must be unset/],
  ]) {
    const result = runRejectedEnvironment({ [name]: value });
    assert.notEqual(result.status, 0, `${name} override must fail`);
    assert.match(result.stderr, message);
  }
});

test("bootstrap is minimal and actively exercises unknown ACL cleanup", () => {
  assert.match(bootstrap, /^CREATE ROLE anon$/m);
  assert.match(bootstrap, /^CREATE ROLE authenticated$/m);
  assert.match(bootstrap, /^CREATE ROLE service_role$/m);
  assert.match(bootstrap, /^CREATE ROLE main_finance_ci_unknown$/m);
  assert.match(bootstrap, /service_role[\s\S]*?BYPASSRLS;/);
  assert.match(bootstrap, /^CREATE FUNCTION auth\.role\(\)$/m);
  assert.match(bootstrap, /^CREATE TABLE public\.users \($/m);
  assert.match(bootstrap, /ALTER DEFAULT PRIVILEGES[\s\S]*?main_finance_ci_unknown/);
  assert.doesNotMatch(bootstrap, /auth\.users|CREATE EXTENSION|pgcrypto/i);
});

test("behavior smoke covers entitlement, idempotence, revocation and rollback", () => {
  assert.match(behaviorSmoke, /^BEGIN;$/m);
  assert.match(behaviorSmoke, /^SET LOCAL ROLE service_role;$/m);
  assert.match(behaviorSmoke, /missing entitlement must fail closed/);
  assert.match(behaviorSmoke, /fresh entitled request was not accepted/);
  assert.match(behaviorSmoke, /exact retry did not recover the accepted request/);
  assert.match(behaviorSmoke, /sub-second exact retry was not rate-limited/);
  assert.match(behaviorSmoke, /changed payload reused the request id/);
  assert.match(behaviorSmoke, /verified launch replay was not rejected across request ids/);
  assert.match(behaviorSmoke, /revocation between begin and finish did not reject success/);
  assert.match(behaviorSmoke, /fourth rolling-window request was not rate-limited/);
  assert.match(behaviorSmoke, /blocked entitlement did not stop a new request/);
  assert.match(behaviorSmoke, /^ROLLBACK;$/m);
  assert.match(runScript, /authenticated unexpectedly executed the service-only entitlement RPC/);
  assert.match(runScript, /service_role unexpectedly received direct integration-table access/);
});

test("outbox behavior covers ordered delivery, audit, retry and dead letter", () => {
  assert.match(outboxBehaviorSmoke, /^BEGIN;$/m);
  assert.match(outboxBehaviorSmoke, /unknown Main user was accepted/);
  assert.match(outboxBehaviorSmoke, /exact desired-state retry was not idempotent/);
  assert.match(outboxBehaviorSmoke, /changed payload reused an existing event id/);
  assert.match(outboxBehaviorSmoke, /oldest user event was not claimed first/);
  assert.match(outboxBehaviorSmoke, /next user version was not released after v1 applied/);
  assert.match(outboxBehaviorSmoke, /retry did not enter deterministic backoff/);
  assert.match(outboxBehaviorSmoke, /exact retry finish was not idempotent/);
  assert.match(outboxBehaviorSmoke, /permanent failure did not enter dead-letter/);
  assert.match(outboxBehaviorSmoke, /exact dead-letter finish was not idempotent/);
  assert.match(outboxBehaviorSmoke, /^ROLLBACK;$/m);
  assert.match(runScript, /authenticated unexpectedly executed the service-only outbox RPC/);
  assert.match(runScript, /authenticated unexpectedly executed the service-only subject resolver/);
  assert.match(runScript, /service_role unexpectedly received direct outbox-table access/);
});

test("external postflight and fingerprint cover semantic catalog state", () => {
  assert.match(postflight, /v_table_count <> 3/);
  assert.match(postflight, /v_column_count <> 24/);
  assert.match(postflight, /v_constraint_count <> 19/);
  assert.match(postflight, /v_index_count <> 10/);
  assert.match(postflight, /reviewed function bodies differ/);
  assert.match(postflight, /pg_catalog\.oidvectortypes\(procedure\.proargtypes\)/);
  assert.doesNotMatch(postflight, /pg_get_function_identity_arguments/);
  assert.match(
    postflight,
    /has_schema_privilege\('service_role', 'public', 'USAGE'\)/,
  );
  assert.match(postflight, /direct table or column ACL remains/);
  assert.match(postflight, /exact function ACL allow-list differs/);
  assert.match(postflight, /architecture_upsert_product_entitlement_internal/);
  assert.doesNotMatch(postflight, /proname LIKE/);
  assert.match(postflight, /SELECT count\(\*\) FROM public\.users/);
  assert.match(outboxPostflight, /v_table_count <> 2/);
  assert.match(outboxPostflight, /v_column_count <> 33/);
  assert.match(outboxPostflight, /v_constraint_count <> 30/);
  assert.match(outboxPostflight, /v_index_count <> 10/);
  assert.match(outboxPostflight, /forbidden identity or secret column exists/);
  assert.match(outboxPostflight, /exact function ACL allow-list differs/);
  assert.match(fingerprint, /architecture_finance_access_desired/);
  assert.match(fingerprint, /architecture_finance_access_outbox/);
  assert.match(fingerprint, /architecture_claim_finance_access_outbox_internal/);
  assert.match(fingerprint, /architecture_resolve_finance_subject_internal/);

  for (const kind of [
    "relation",
    "column",
    "constraint",
    "index",
    "function",
    "trigger",
    "internal_trigger",
    "policy",
  ]) {
    assert.match(fingerprint, new RegExp(`'${kind}'`));
  }
  assert.match(fingerprint, /body_md5=%s\|definition_md5=%s/);
  assert.match(fingerprint, /constraint=%I\.%I\.%I/);
  assert.match(fingerprint, /WHEN attribute\.attcollation = 0 THEN ''/);
  assert.doesNotMatch(fingerprint, /trigger_row\.tgconstraint\s*[,)]/);
  const internalTriggerSection = fingerprint.slice(
    fingerprint.indexOf("-- Internal FK trigger names"),
  );
  assert.ok(internalTriggerSection.length > 0);
  assert.doesNotMatch(internalTriggerSection, /trigger_row\.tgname/);
});
