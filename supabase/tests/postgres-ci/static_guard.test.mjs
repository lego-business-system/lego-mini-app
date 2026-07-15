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
const workflow = readFileSync(
  new URL(".github/workflows/verify-finance-integration.yml", root),
  "utf8",
);
const migration = readFileSync(migrationUrl, "utf8");
const runScript = readFileSync(new URL("run.sh", harness), "utf8");
const bootstrap = readFileSync(new URL("bootstrap.sql", harness), "utf8");
const behaviorSmoke = readFileSync(new URL("behavior_smoke.sql", harness), "utf8");
const postflight = readFileSync(new URL("postflight.sql", harness), "utf8");
const fingerprint = readFileSync(new URL("catalog_fingerprint.sql", harness), "utf8");
const runPath = fileURLToPath(new URL("run.sh", harness));

const expectedHarnessFiles = [
  "README.md",
  "behavior_smoke.sql",
  "bootstrap.sql",
  "catalog_fingerprint.sql",
  "postflight.sql",
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
    "18eac5039e013947a086cc61329dc6f3bc1e4fc6cc0fd28a7459595e9dbb0c77",
  );
  assert.doesNotMatch(migration, /\bAS\s+(?:collation|constraint)\b/i);
  assert.match(migration, /ERRCODE = '55000'/);
  assert.match(
    migration,
    /integration tables already exist; this one-shot migration will not accept drift or reruns\./,
  );
  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /^COMMIT;$/m);
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
  assert.match(runScript, /rejected retry did not report SQLSTATE 55000/);
  assert.match(runScript, /catalog changed during the rejected migration retry/);
  assert.match(runScript, /data changed during the rejected migration retry/);
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
  assert.match(behaviorSmoke, /changed payload reused the request id/);
  assert.match(behaviorSmoke, /blocked entitlement did not stop a new request/);
  assert.match(behaviorSmoke, /^ROLLBACK;$/m);
  assert.match(runScript, /authenticated unexpectedly executed the service-only entitlement RPC/);
  assert.match(runScript, /service_role unexpectedly received direct integration-table access/);
});

test("external postflight and fingerprint cover semantic catalog state", () => {
  assert.match(postflight, /v_table_count <> 3/);
  assert.match(postflight, /v_column_count <> 24/);
  assert.match(postflight, /v_constraint_count <> 19/);
  assert.match(postflight, /v_index_count <> 10/);
  assert.match(postflight, /reviewed function bodies differ/);
  assert.match(postflight, /direct table or column ACL remains/);
  assert.match(postflight, /unknown default function grant survived ACL hardening/);
  assert.match(postflight, /SELECT count\(\*\) FROM public\.users/);

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
  assert.doesNotMatch(fingerprint, /trigger_row\.tgconstraint\s*[,)]/);
  const internalTriggerSection = fingerprint.slice(
    fingerprint.indexOf("-- Internal FK trigger names"),
  );
  assert.ok(internalTriggerSection.length > 0);
  assert.doesNotMatch(internalTriggerSection, /trigger_row\.tgname/);
});
