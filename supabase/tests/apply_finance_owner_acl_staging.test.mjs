import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/apply-finance-owner-acl-staging.mjs",
  "utf8",
);

test("owner ACL operator is pinned to Main staging and denies production", () => {
  assert.match(source, /PROJECT_REF = "bljeoovhydhjhdzwplxh"/);
  assert.match(source, /PRODUCTION_REF = "soxtekhspohkddpdidvp"/);
  assert.match(source, /database\/query\/read-only/);
  assert.match(source, /database\/query`/);
  assert.match(source, /process\.argv\[2\] !== "--apply"/);
  assert.match(source, /row\.database_role !== "supabase_read_only_user"/);
  assert.match(
    source,
    /a02fb206c54c6f186fe246c430410c9b97a9126c3e959293455122eac3aa0905/,
  );
});

test("owner ACL operator reconciles one mutation with two read-only checks", () => {
  assert.match(source, /validateInspection\([\s\S]*?"before"/);
  assert.match(source, /validateInspection\([\s\S]*?"after"/);
  assert.match(source, /hostedReadCount: 2/);
  assert.match(source, /hostedMutationCount: 1/);
  assert.match(source, /ON CONFLICT \(version\) DO NOTHING/);
  assert.match(source, /service_direct_table_count: 0/);
  assert.doesNotMatch(source, /console\.log|response\.text\(/);
});
