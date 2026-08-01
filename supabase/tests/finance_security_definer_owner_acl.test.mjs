import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729010000_finance_security_definer_owner_acl_v1.sql",
  "utf8",
);
const postflight = readFileSync(
  "supabase/tests/postgres-ci/owner_acl_postflight.sql",
  "utf8",
);
const runner = readFileSync("supabase/tests/postgres-ci/run.sh", "utf8");

test("hosted owner ACL correction grants only required DML to postgres", () => {
  assert.match(migration, /^BEGIN;$/m);
  assert.match(migration, /^COMMIT;$/m);
  assert.match(
    migration,
    /GRANT SELECT, INSERT, UPDATE[\s\S]*?ON TABLE[\s\S]*?architecture_product_entitlements[\s\S]*?architecture_finance_access_outbox[\s\S]*?TO postgres;/,
  );
  assert.doesNotMatch(
    migration,
    /GRANT[\s\S]*?ON TABLE[\s\S]*?TO (?:PUBLIC|anon|authenticated|service_role)/,
  );
  assert.match(migration, /service_role received direct table access/);
  assert.match(migration, /SECURITY DEFINER contract differs/);
  assert.doesNotMatch(
    migration,
    /^\s*(?:DELETE FROM|TRUNCATE TABLE|DROP TABLE|ALTER TABLE)\b/im,
  );
});

test("owner ACL postflight preserves the RPC-only service boundary", () => {
  assert.match(postflight, /owner DML allow-list differs/);
  assert.match(postflight, /service_role has direct table access/);
  assert.match(postflight, /column ACL exists/);
  assert.match(postflight, /unexpected table ACL exists/);
  assert.match(postflight, /acl\.privilege_type NOT IN \('SELECT', 'INSERT', 'UPDATE'\)/);
});

test("PostgreSQL 17 harness applies and rechecks the owner ACL correction", () => {
  assert.match(
    runner,
    /20260729010000_finance_security_definer_owner_acl_v1\.sql/,
  );
  assert.match(runner, /owner_acl_postflight\.sql/);
  assert.match(runner, /owner ACL correction changed stable catalog state/);
});
