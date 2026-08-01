import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/verify-finance-integration.yml",
  "utf8",
);

test("Finance integration CI is immutable and runs the complete verifier", () => {
  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(uses, [
    "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
    "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
    "denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed",
  ]);
  assert.match(workflow, /^\s*runs-on:\s*ubuntu-24\.04\s*$/m);
  assert.match(workflow, /^\s*node-version:\s*24\.18\.0\s*$/m);
  assert.match(workflow, /^\s*check-latest:\s*false\s*$/m);
  assert.match(workflow, /^\s*deno-version:\s*2\.9\.2\s*$/m);
  assert.match(workflow, /^\s*permissions:\s*\n\s*contents:\s*read\s*$/m);
  assert.match(
    workflow,
    /sudo apt-get install --yes --no-install-recommends ripgrep=14\.1\.0-1/,
  );
  assert.match(
    workflow,
    /test "\$\(rg --version \| head -n 1\)" = "ripgrep 14\.1\.0"/,
  );
  assert.match(workflow, /run:\s*\.\/supabase\/tests\/verify_local\.sh/);
  assert.match(workflow, /Enforce reviewed Finance v2 pilot scope/);
  assert.match(
    workflow,
    /test -f supabase\/functions\/_shared\/main-entitlement-protocol-v2\.mjs/,
  );
  assert.match(
    workflow,
    /test -f supabase\/functions\/finance-sync-entitlements\/index\.ts/,
  );
  assert.match(workflow, /test ! -e supabase\/migrations\/20260715030000_finance_subject_rotation_v2\.sql/);
  assert.match(workflow, /test ! -e supabase\/functions\/finance-sync-entitlements-v2/);
  assert.match(workflow, /test ! -e scripts\/manage-finance-subject-rotation-v2\.mjs/);
  assert.doesNotMatch(
    workflow,
    /test ! -e supabase\/functions\/_shared\/main-entitlement-protocol-v2\.mjs/,
  );
  assert.match(workflow, /test -f scripts\/build-finance-pilot\.mjs/);
  assert.match(
    workflow,
    /deno check --config supabase\/functions\/finance-issue-code\/deno\.json --frozen/,
  );
  assert.match(
    workflow,
    /cd supabase\/functions\/finance-issue-code && deno audit --frozen/,
  );
  assert.match(
    workflow,
    /deno check --config supabase\/functions\/finance-sync-entitlements\/deno\.json --frozen/,
  );
  assert.match(
    workflow,
    /cd supabase\/functions\/finance-sync-entitlements && deno audit --frozen/,
  );
  assert.doesNotMatch(
    workflow,
    /apt-get install(?:\s+--[^\n]+)*\s+ripgrep(?:\s|$)(?!\s*=)/,
  );
  assert.doesNotMatch(workflow, /ubuntu-latest|persist-credentials:\s*true/);
});
