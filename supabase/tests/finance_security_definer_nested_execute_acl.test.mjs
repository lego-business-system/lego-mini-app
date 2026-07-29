import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729020000_finance_security_definer_nested_execute_acl_v1.sql",
  "utf8",
);
const postflight = readFileSync(
  "supabase/tests/postgres-ci/owner_execute_postflight.sql",
  "utf8",
);
const runner = readFileSync("supabase/tests/postgres-ci/run.sh", "utf8");

test("nested EXECUTE correction grants only the function owner", () => {
  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /^COMMIT;$/m);
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION[\s\S]*?architecture_upsert_product_entitlement_internal[\s\S]*?TO postgres;/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION[\s\S]*?TO (?:PUBLIC|anon|authenticated|service_role)/,
  );
  assert.match(migration, /external execution path exists/);
  assert.match(migration, /unexpected function ACL exists/);
  assert.doesNotMatch(
    migration,
    /^\s*(?:DELETE FROM|TRUNCATE TABLE|DROP TABLE|ALTER TABLE)\b/im,
  );
});

test("nested EXECUTE postflight preserves the service-only outer RPC boundary", () => {
  assert.match(postflight, /owner cannot execute nested entitlement primitive/);
  assert.match(postflight, /external role can execute nested entitlement primitive/);
  assert.match(postflight, /exact owner ACL count differs/);
  assert.match(postflight, /unexpected nested entitlement primitive ACL exists/);
  assert.match(postflight, /v_acl_count IS DISTINCT FROM 1/);
  assert.match(postflight, /acl\.privilege_type IS DISTINCT FROM 'EXECUTE'/);
});

test("PostgreSQL 17 harness applies and rechecks nested EXECUTE correction", () => {
  assert.match(
    runner,
    /20260729020000_finance_security_definer_nested_execute_acl_v1\.sql/,
  );
  assert.match(runner, /owner_execute_postflight\.sql/);
  assert.match(runner, /owner EXECUTE correction changed stable catalog state/);
});
