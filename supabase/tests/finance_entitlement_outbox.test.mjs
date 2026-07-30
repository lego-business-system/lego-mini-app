import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(
  "supabase/migrations/20260714235900_finance_integration_foundation.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql",
  "utf8",
);
const runner = readFileSync("supabase/tests/postgres-ci/run.sh", "utf8");
const behavior = readFileSync(
  "supabase/tests/postgres-ci/outbox_behavior_smoke.sql",
  "utf8",
);
const postflight = readFileSync(
  "supabase/tests/postgres-ci/outbox_postflight.sql",
  "utf8",
);

test("locked issuer foundation remains byte-identical", () => {
  assert.equal(
    createHash("sha256").update(foundation).digest("hex"),
    "78b9a8619ab3487424602ffaba6fcad02e7557a7112c2639370cb8d28fa2a9e6",
  );
});

test("outbox v1 stores desired state and trusted Main user references only", () => {
  assert.equal(
    createHash("sha256").update(migration).digest("hex"),
    "a51af239a284c732f329cf315bbb1b21ca8c9f5493aba1d603995b515fbadb11",
  );
  assert.match(migration, /^-- DRAFT \/ NOT APPLIED \/ STAGING ONLY$/m);
  assert.match(migration, /CREATE TABLE public\.architecture_finance_access_desired/);
  assert.match(migration, /CREATE TABLE public\.architecture_finance_access_outbox/);
  assert.match(migration, /FOREIGN KEY \(main_user_id\)[\s\S]*?REFERENCES public\.users\(id\)/);
  assert.match(migration, /changed_by text NOT NULL/);
  assert.match(migration, /change_reason text NOT NULL/);
  assert.doesNotMatch(migration, /\btelegram_id\b|raw_init_data|bot_token|email|phone/i);
  assert.doesNotMatch(migration, /^ALTER TABLE (?:ONLY )?public\.users/m);
});

test("service-only commands are atomic, idempotent and ordered", () => {
  assert.equal(
    [...migration.matchAll(/^CREATE FUNCTION public\.architecture_/gm)].length,
    4,
  );
  assert.equal(
    [...migration.matchAll(/coalesce\(auth\.role\(\), ''\) <> 'service_role'/g)].length,
    4,
  );
  assert.match(migration, /CREATE FUNCTION public\.architecture_get_finance_access_status_internal\([\s\S]*?STABLE[\s\S]*?SECURITY DEFINER/);
  assert.match(migration, /p_expected_version bigint/);
  assert.match(migration, /v_desired\.version IS DISTINCT FROM p_expected_version[\s\S]*?version_conflict/);
  assert.match(migration, /p_event_id IS NULL OR candidate\.event_id = p_event_id/);
  assert.match(migration, /idempotency_conflict/);
  assert.match(migration, /claim_token_conflict/);
  assert.match(migration, /claim_token_consumed/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /earlier\.version < candidate\.version/);
  assert.match(migration, /state IN \('pending', 'processing', 'retry_wait', 'applied', 'dead_letter'\)/);
  assert.match(migration, /15 \* power\(2::numeric, v_event\.attempt_count - 1\)::integer/);
  assert.match(migration, /lease_expired_max_attempts/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.architecture_upsert_product_entitlement_internal\([\s\S]*?FROM service_role/);
  assert.doesNotMatch(migration, /https?:\/\/|Deno\.serve|fetch\(/);
});

test("outbox trigger creation temporarily restores only the postgres owner ACL", () => {
  const grant = migration.indexOf(
    "GRANT EXECUTE ON FUNCTION public.architecture_finance_set_updated_at_internal()\nTO postgres;",
  );
  const firstTrigger = migration.indexOf(
    "CREATE TRIGGER trg_architecture_finance_access_desired_updated_at",
  );
  const secondTrigger = migration.indexOf(
    "CREATE TRIGGER trg_architecture_finance_access_outbox_updated_at",
  );
  const revoke = migration.indexOf(
    "REVOKE ALL ON FUNCTION public.architecture_finance_set_updated_at_internal()\nFROM postgres;",
  );
  assert.ok(grant >= 0 && grant < firstTrigger);
  assert.ok(firstTrigger < secondTrigger && secondTrigger < revoke);
  assert.equal(
    migration.match(/GRANT EXECUTE ON FUNCTION public\.architecture_finance_set_updated_at_internal\(\)/g)?.length,
    1,
  );
  assert.equal(
    migration.match(/REVOKE ALL ON FUNCTION public\.architecture_finance_set_updated_at_internal\(\)\nFROM postgres;/g)?.length,
    1,
  );
});

test("disposable PostgreSQL harness executes and rolls back outbox behavior", () => {
  assert.match(runner, /20260715010000_finance_entitlement_outbox_v1\.sql/);
  assert.match(runner, /outbox_behavior_smoke\.sql/);
  assert.match(runner, /outbox_postflight\.sql/);
  assert.match(runner, /rejected outbox retry did not report SQLSTATE 55000/);
  assert.ok(
    runner.indexOf('apply_file "$harness_dir/behavior_smoke.sql"') <
      runner.indexOf('apply_file "$outbox_migration"'),
    "foundation behavior must run before outbox revokes legacy service-role upsert",
  );
  assert.match(behavior, /exact desired-state retry was not idempotent/);
  assert.match(behavior, /stale expected version changed desired state/);
  assert.match(behavior, /read-only desired-state status was not exact/);
  assert.match(behavior, /targeted claim bypassed an earlier user version/);
  assert.match(behavior, /oldest user event was not claimed first/);
  assert.match(behavior, /retry did not enter deterministic backoff/);
  assert.match(behavior, /permanent failure did not enter dead-letter/);
  assert.match(behavior, /^ROLLBACK;$/m);
  assert.match(
    postflight,
    /v_table_acl_count NOT IN \(0, 6\)/,
  );
  assert.match(
    postflight,
    /v_table_acl_count = 6 AND v_table_acl_differs/,
  );
  assert.match(
    postflight,
    /\('architecture_finance_access_desired', 'postgres', 'postgres', 'SELECT', false\)/,
  );
  assert.match(
    postflight,
    /\('architecture_finance_access_outbox', 'postgres', 'postgres', 'UPDATE', false\)/,
  );
  assert.equal(
    [...postflight.matchAll(
      /\('architecture_finance_access_(?:desired|outbox)', 'postgres', 'postgres', '(?:SELECT|INSERT|UPDATE)', false\)/g,
    )].length,
    6,
  );
  assert.match(
    postflight,
    /FULL JOIN actual USING \([\s\S]*?grantor_name,[\s\S]*?is_grantable/,
  );
  assert.match(postflight, /table ACL must be empty or the exact six-entry postgres DML allow-list/);
  assert.match(runner, /partial outbox table ACL unexpectedly passed exact-state postflight/);
  assert.match(postflight, /exact function ACL allow-list differs/);
  assert.match(runner, /service_role unexpectedly bypassed the outbox through legacy upsert/);
});
