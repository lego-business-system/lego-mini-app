import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/apply-finance-owner-execute-staging.mjs",
  "utf8",
);

test("owner EXECUTE operator is pinned to Main staging and denies production", () => {
  assert.match(source, /PROJECT_REF = "bljeoovhydhjhdzwplxh"/);
  assert.match(source, /PRODUCTION_REF = "soxtekhspohkddpdidvp"/);
  assert.match(source, /database\/query\/read-only/);
  assert.match(source, /database\/query`/);
  assert.match(source, /process\.argv\[2\] !== "--apply"/);
  assert.match(source, /row\.database_role !== "supabase_read_only_user"/);
  assert.match(
    source,
    /493b3963053e317e04803b6662bfb2aba9ce1e24292262e2921261a1b4c425a3/,
  );
});

test("owner EXECUTE operator reconciles one mutation with two read-only checks", () => {
  assert.match(source, /validateInspection\([\s\S]*?"before"/);
  assert.match(source, /validateInspection\([\s\S]*?"after"/);
  assert.match(source, /hostedReadCount: 2/);
  assert.match(source, /hostedMutationCount: 1/);
  assert.match(source, /ON CONFLICT \(version\) DO NOTHING/);
  assert.match(source, /exact_owner_acl_count/);
  assert.match(
    source,
    /parseCount\(row, "exact_owner_acl_count"\) !== \(row\.owner_execute === "true" \? 1 : 0\)/,
  );
  assert.match(source, /service_execute: false/);
  assert.doesNotMatch(source, /console\.log|response\.text\(/);
});
