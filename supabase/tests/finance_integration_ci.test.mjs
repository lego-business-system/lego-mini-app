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
  ]);
  assert.match(workflow, /^\s*runs-on:\s*ubuntu-24\.04\s*$/m);
  assert.match(workflow, /^\s*node-version:\s*24\.18\.0\s*$/m);
  assert.match(workflow, /^\s*check-latest:\s*false\s*$/m);
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
  assert.doesNotMatch(
    workflow,
    /apt-get install(?:\s+--[^\n]+)*\s+ripgrep(?:\s|$)(?!\s*=)/,
  );
  assert.doesNotMatch(workflow, /ubuntu-latest|persist-credentials:\s*true/);
});
