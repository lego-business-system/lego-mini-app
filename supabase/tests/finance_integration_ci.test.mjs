import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  ".github/workflows/verify-finance-integration.yml",
  "utf8",
);
const localVerifier = readFileSync("supabase/tests/verify_local.sh", "utf8");
const runtimeRecoveryReleaseTest = readFileSync(
  "supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs",
  "utf8",
);
const runtimeRecoveryOperator = readFileSync(
  "scripts/prepare-main-finance-runtime-recovery-v2.mjs",
  "utf8",
);
const runtimeRecoveryManifest = JSON.parse(readFileSync(
  "supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json",
  "utf8",
));

test("Finance integration CI is immutable and runs the complete verifier", () => {
  const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm)]
    .map((match) => match[1]);
  const stepNames = [...workflow.matchAll(/^\s{6}- name:\s*(.+)$/gm)]
    .map((match) => match[1]);

  assert.deepEqual(uses, [
    "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
    "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38",
    "denoland/setup-deno@22d081ff2d3a40755e97629de92e3bcbfa7cf2ed",
  ]);
  assert.deepEqual(stepNames, [
    "Check out repository",
    "Use Node.js",
    "Use Deno",
    "Install pinned ripgrep",
    "Enforce reviewed Finance v2 pilot scope",
    "Run Finance pilot verification",
    "Validate disposable PostgreSQL harness",
    "Verify frozen Edge dependency graph",
    "Execute main Finance foundation on disposable PostgreSQL 17",
  ]);
  assert.match(workflow, /^\s*runs-on:\s*ubuntu-24\.04\s*$/m);
  assert.match(workflow, /^\s*fetch-depth:\s*2\s*$/m);
  assert.match(workflow, /^\s*persist-credentials:\s*false\s*$/m);
  assert.match(workflow, /^\s*node-version:\s*24\.14\.0\s*$/m);
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
  for (const path of [
    "scripts/main-finance-runtime-recovery-v2-snapshot.mjs",
    "scripts/manage-finance-access-v2.mjs",
    "scripts/prepare-main-finance-runtime-recovery-v2.mjs",
    "supabase/functions/finance-manage-access-v2/deno.json",
    "supabase/functions/finance-manage-access-v2/deno.lock",
    "supabase/functions/finance-manage-access-v2/index.ts",
    "supabase/releases/main-finance-runtime-recovery-v2/README.md",
    "supabase/releases/main-finance-runtime-recovery-v2/environment.contract.json",
    "supabase/releases/main-finance-runtime-recovery-v2/postflight.contract.json",
    "supabase/releases/main-finance-runtime-recovery-v2/preflight.sql",
    "supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json",
    "supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs",
    "supabase/tests/main_finance_runtime_secret_recovery_v2.test.mjs",
    "supabase/tests/manage_finance_access_v2.test.mjs",
  ]) {
    assert.ok(workflow.includes(`test -f ${path}`), `${path} must be in scope`);
  }
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
  assert.match(
    workflow,
    /deno check --config supabase\/functions\/finance-manage-access-v2\/deno\.json --frozen supabase\/functions\/finance-manage-access-v2\/index\.ts/,
  );
  assert.match(
    workflow,
    /cd supabase\/functions\/finance-manage-access-v2 && deno audit --frozen/,
  );
  assert.match(
    workflow,
    /GITHUB_EVENT_NAME\}" == "push" && "\$\{GITHUB_REF\}" == "refs\/heads\/agent\/main-finance-staging-runtime-recovery-v2"/,
  );
  assert.match(
    workflow,
    /base_commit="a30dedf20e977d9794a8ac9e54abc48b076c9d45"/,
  );
  assert.match(
    workflow,
    /base_tree="92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf"/,
  );
  assert.match(
    workflow,
    /test "\$\(GIT_NO_REPLACE_OBJECTS=1 git cat-file -t "\$\{base_commit\}"\)" = "commit"/,
  );
  assert.match(
    workflow,
    /test "\$\{base_tree_header\}" = "tree \$\{base_tree\}"/,
  );
  assert.match(
    workflow,
    /commit_object="\$\(GIT_NO_REPLACE_OBJECTS=1 git cat-file -p "\$\{GITHUB_SHA\}"\)"/,
  );
  assert.match(
    workflow,
    /test "\$\{GITHUB_SHA\}" = "\$\(GIT_NO_REPLACE_OBJECTS=1 git rev-parse HEAD\)"/,
  );
  assert.match(workflow, /test "\$\{header_separator_seen\}" = "1"/);
  assert.match(workflow, /test "\$\{#commit_headers\[@\]\}" = "4"/);
  assert.match(
    workflow,
    /\[\[ "\$\{commit_headers\[0\]\}" =~ \^tree\\ \(\[0-9a-f\]\{40\}\)\$ \]\]/,
  );
  assert.match(workflow, /test "\$\{commit_headers\[1\]\}" = "parent \$\{base_commit\}"/);
  assert.match(workflow, /commit_headers\[2\].*\^author\\ \.\+\$/);
  assert.match(workflow, /commit_headers\[3\].*\^committer\\ \.\+\$/);
  assert.match(
    workflow,
    /GIT_NO_REPLACE_OBJECTS=1 git diff-tree --no-renames --no-commit-id --name-status -r "\$\{base_tree\}" "\$\{head_tree\}" \| LC_ALL=C sort/,
  );
  const expectedChanges = [...workflow.matchAll(
    /^\s+'([AM])\\t([^']+)'(?:\s*\\)?(?:\s*\|\s*LC_ALL=C sort\)\")?\s*$/gm,
  )].map((match) => `${match[1]}\t${match[2]}`);
  assert.deepEqual(expectedChanges, [
    "M\t.github/workflows/verify-finance-integration.yml",
    "M\tscripts/prepare-main-finance-runtime-recovery-v2.mjs",
    "M\tsupabase/releases/main-finance-runtime-recovery-v2/README.md",
    "M\tsupabase/releases/main-finance-runtime-recovery-v2/environment.contract.json",
    "M\tsupabase/releases/main-finance-runtime-recovery-v2/postflight.contract.json",
    "M\tsupabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json",
    "M\tsupabase/tests/finance_integration_ci.test.mjs",
    "M\tsupabase/tests/main_finance_runtime_recovery_release_v2.test.mjs",
  ]);
  assert.doesNotMatch(
    workflow,
    /apt-get install(?:\s+--[^\n]+)*\s+ripgrep(?:\s|$)(?!\s*=)/,
  );
  assert.doesNotMatch(
    workflow,
    /ubuntu-latest|persist-credentials:\s*true|node-version:\s*24\.18\.0|pull_request_target|git rev-list --parents|git diff --name-status/,
  );
});

test("local verifier uses exact Node and closes all runtime recovery sources", () => {
  assert.match(
    localVerifier,
    /bundled_node="\/Applications\/ChatGPT\.app\/Contents\/Resources\/cua_node\/bin\/node"/,
  );
  assert.ok(
    localVerifier.indexOf('if [[ -x "$bundled_node" ]]') <
      localVerifier.indexOf("elif command -v node"),
    "the immutable bundled Node must be preferred locally",
  );
  assert.match(localVerifier, /"\$node_bin" --version\)" != "v24\.14\.0"/);
  assert.match(localVerifier, /"\$node_bin" --test supabase\/tests\/\*\.test\.mjs/);
  assert.match(
    localVerifier,
    /"\$node_bin" --test --test-reporter=tap "\$release_test"/u,
  );
  assert.match(localVerifier, /grep -Fxc -- "# skipped 0"/u);
  assert.match(localVerifier, /grep -Fxc -- "# fail 0"/u);
  for (const source of [
    "scripts/main-finance-runtime-recovery-v2-snapshot.mjs",
    "scripts/manage-finance-access-v2.mjs",
    "scripts/prepare-main-finance-runtime-recovery-v2.mjs",
    "supabase/functions/finance-manage-access-v2/index.ts",
  ]) {
    assert.ok(localVerifier.includes(source), `${source} must receive a syntax check`);
  }
  assert.doesNotMatch(
    localVerifier,
    /\.cache\/codex-runtimes|Node\.js 20 or newer/,
  );
});

test("runtime recovery raw authority matrices are portable and effect authority is private", async () => {
  assert.doesNotMatch(
    runtimeRecoveryReleaseTest,
    /HOST_READY|if\s*\(\s*!HOST_READY\s*\)|\bskip\s*:|\b(?:test|it|describe)\.skip\s*\(|\bt\.skip\s*\(|await\s+t\.test\s*\(|evaluateMainFinanceRuntimeRecoveryV2PureTransition/u,
  );
  const lifecycleContracts = new Map([
    [
      "raw reducer measurement authority accepts canonical evidence and rejects operation or chain drift",
      ["measure-read-only-verified", "/operation boundary/u", "/measurement authority/u"],
    ],
    [
      "raw reducer plan through verify matrix binds exact receipts commands and fresh evidence",
      [
        "schemaVersion: 999", "snapshot exceeds future clock skew",
        "authorize-cli-invocation", "function result clock precedes postflight D1",
        "sameProofCompletionPayload", "fresh-completion-d0-response",
        "fresh-completion-proof", "verification-evidence-consistent",
      ],
    ],
    [
      "raw reducer plan determinism and latest-intent command gate",
      ["assert.deepEqual(", "latest durable mutation intent", "record-mutation-intent"],
    ],
    [
      "raw reducer operation binding and function inventory schema matrix",
      [
        "operationCurrentSha256", '["verify_jwt", "status", "version"]',
        '"wrong-verify-jwt"', '"wrong-status"', '"wrong-version"',
      ],
    ],
    [
      "raw reducer expiry approval forged intent and terminal receipt rejection matrix",
      [
        "invokeAfterFinalClockSample", "cliCalls", "approvalFor(expired)",
        "forged-before-main", "d1FunctionInventorySha256",
      ],
    ],
    [
      "raw reducer applied reconciliation narrows secret scope and requires function evidence time",
      [
        'status: "unknown"', '"reconcile-applied"',
        "function reconciliation clock precedes postflight D1",
        'scope: "function-deploy"',
      ],
    ],
    [
      "raw reducer not-applied secret and deploy reconciliation requires fresh scoped plans",
      [
        '"not_applied"', 'scope: "secrets-set"',
        'scope: "function-deploy"', '"reconcile-not-applied"',
      ],
    ],
    [
      "raw reducer mutation-input digest drift blocks secret and deploy command authority",
      ["runtime-drift", "deploy-workdir-drift", "/CLI invocation authority/u"],
    ],
    [
      "raw reducer inventory rewrite and postflight sandwich drift reject completion and verify",
      ["updatedAt:", "collapsedSandwich", "postflight current inventory binding"],
    ],
  ]);
  const lifecycleNames = [...lifecycleContracts.keys()];
  for (const name of lifecycleNames) {
    assert.equal(
      localVerifier.split(`"${name}"`).length - 1,
      1,
      name + " must be asserted exactly once in the executable local CI verifier",
    );
  }
  const unconditionalNames = [...runtimeRecoveryReleaseTest.matchAll(
    /^test\("([^"]+)", \(\) => \{/gmu,
  )].map(match => match[1]);
  for (const name of lifecycleNames) {
    assert.equal(
      unconditionalNames.filter(candidate => candidate === name).length,
      1,
      name + " must be registered exactly once as a top-level portable test",
    );
    const start = runtimeRecoveryReleaseTest.indexOf(
      'test("' + name + '", () => {',
    );
    assert.ok(start >= 0, name + " must remain unconditional");
    const nextTest = runtimeRecoveryReleaseTest.indexOf("\ntest(\"", start + 1);
    const nextDarwin = runtimeRecoveryReleaseTest.indexOf(
      "\nif (process.platform === \"darwin\")",
      start + 1,
    );
    const candidates = [nextTest, nextDarwin]
      .filter(index => index >= 0)
      .sort((left, right) => left - right);
    const body = runtimeRecoveryReleaseTest.slice(
      start,
      candidates[0] ?? runtimeRecoveryReleaseTest.length,
    );
    assert.match(
      body,
      /\btransition\(/u,
      name + " must execute the production reducer",
    );
    for (const token of lifecycleContracts.get(name)) {
      assert.ok(
        body.includes(token),
        `${name} must retain distinctive raw evidence or expected authority: ${token}`,
      );
    }
  }
  assert.equal(
    lifecycleNames.filter(name => unconditionalNames.includes(name)).length,
    9,
    "Linux must register all nine portable raw authority matrices",
  );
  assert.equal(
    (runtimeRecoveryReleaseTest.match(
      /if \(process\.platform === "darwin"\) \{\s*test\("reviewed Darwin frozen host pins smoke", \(\) => \{/gu,
    ) ?? []).length,
    1,
    "Darwin may add only the separate frozen-host smoke",
  );
  assert.doesNotMatch(
    runtimeRecoveryReleaseTest,
    /reviewed Darwin pinned-host operator lifecycle|function\s+createHarness\s*\(|await\s+\w+\.operate\s*\(/u,
  );
  assert.doesNotMatch(
    runtimeRecoveryReleaseTest,
    /hostedAuthority|mutationPerformed|effectPerformed:\s*true|productionTouched:\s*true/u,
  );

  const runtimeRecoveryNamespace = await import(
    "../../scripts/prepare-main-finance-runtime-recovery-v2.mjs"
  );
  const expectedExports = [
    "sha256",
    "canonicalJson",
    "validateMainFinanceRuntimeRecoveryV2ProvenanceSource",
    "classifyMainFinanceRuntimeRecoveryV2FunctionState",
    "evaluateMainFinanceRuntimeRecoveryV2State",
  ].sort();
  assert.deepEqual(Object.keys(runtimeRecoveryNamespace).sort(), expectedExports);
  assert.deepEqual(
    [...runtimeRecoveryOperator.matchAll(
      /^export function ([A-Za-z][A-Za-z0-9]*)\(/gmu,
    )].map(match => match[1]).sort(),
    expectedExports,
  );
  assert.doesNotMatch(runtimeRecoveryOperator, /^export\s+async\s+/gmu);
  assert.doesNotMatch(
    runtimeRecoveryOperator,
    /^export\s+(?:const|function)\s+(?:operateMainFinanceRuntimeRecoveryV2|main|run[A-Za-z0-9]*|cli[A-Za-z0-9]*)/gmu,
  );
  assert.match(
    runtimeRecoveryOperator,
    /async function operateMainFinanceRuntimeRecoveryV2\(\) \{\s*if \(import\.meta\.main !== true\)/u,
  );
  assert.match(
    runtimeRecoveryOperator,
    /if \(import\.meta\.main === true\) \{\s*main\(\)\.catch/u,
  );
  assert.doesNotMatch(runtimeRecoveryOperator, /readManifestSource/u);
  assert.doesNotMatch(
    runtimeRecoveryOperator,
    /from\s+["']\.\/manage-finance-access\.mjs["']/u,
  );
  for (const token of [
    "hostile argv cannot turn a transitive recovery import into an effectful legacy CLI",
    "process.argv[1] =",
    "fetchCalls !== 0",
    "Object.keys(namespace).sort()",
    'assert.equal(result.stdout, "")',
    'assert.equal(result.stderr, "")',
  ]) assert.ok(runtimeRecoveryReleaseTest.includes(token), `hostile import regression lacks ${token}`);

  const pureAuthorityStart = runtimeRecoveryOperator.indexOf(
    "function assertPlainDeclarativeRecord(value, expectedKeys, label) {",
  );
  const pureAuthorityEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction declarativeReadyBindings(",
    pureAuthorityStart,
  );
  assert.ok(
    pureAuthorityStart >= 0 && pureAuthorityEnd > pureAuthorityStart,
    "the complete pure authority implementation must remain source-delimited",
  );
  const pureAuthority = runtimeRecoveryOperator.slice(
    pureAuthorityStart,
    pureAuthorityEnd,
  );
  assert.doesNotMatch(
    pureAuthority,
    /\b(?:fetch|spawn|readFileSync|writeFileSync|renameSync|fsyncSync|runGit|runCli|runGh|invokeCli|process|environment|argv|callback)\b/u,
  );
  assert.match(pureAuthority, /effectPerformed:\s*false/u);
  assert.match(pureAuthority, /productionTouched:\s*false/u);
  assert.match(
    pureAuthority,
    /assertDeclarativeValueTree\(input\)[\s\S]*authorizeDeclarativeEffectPayload\(\{/u,
  );

  const operationalCalls = [...runtimeRecoveryOperator.matchAll(
    /\bevaluateOperationalState\(\{([\s\S]*?)^\s*\}\);/gmu,
  )].filter(match => !runtimeRecoveryOperator.slice(
    Math.max(0, match.index - "function ".length),
    match.index,
  ).endsWith("function ")).map(match => match[1]);
  assert.equal(operationalCalls.length, 18);
  assert.deepEqual(
    operationalCalls.map(body => body.match(/action:\s*"([^"]+)"/u)?.[1])
      .reduce((counts, action) => ({
        ...counts,
        [action]: (counts[action] ?? 0) + 1,
      }), {}),
    { apply: 8, plan: 2, complete: 5, reconcile: 2, verify: 1 },
  );
  for (const body of operationalCalls) {
    if (/action:\s*"verify"/u.test(body)) {
      assert.doesNotMatch(body, /effectPayload:/u);
    } else {
      assert.match(body, /effectPayload:/u);
    }
  }
  assert.equal(
    (runtimeRecoveryOperator.match(
      /\bevaluateMainFinanceRuntimeRecoveryV2State\(\{/gu,
    ) ?? []).length,
    2,
    "only measure and the private operational wrapper may enter the reducer",
  );

  const appendAuthorityStart = runtimeRecoveryOperator.indexOf(
    "function appendAuthorizedReceipt(",
  );
  const appendAuthorityEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction nextReceiptTimestamp(",
    appendAuthorityStart,
  );
  const appendAuthority = runtimeRecoveryOperator.slice(
    appendAuthorityStart,
    appendAuthorityEnd,
  );
  assert.match(appendAuthority, /authority\.chainTailSha256 !== core\.previousReceiptSha256/u);
  assert.match(appendAuthority, /const freshChain = readReceiptChain\(receiptDirectory\)/u);
  assert.match(appendAuthority, /canonicalJson\(freshChain\) !== canonicalJson\(chain\)/u);
  assert.match(appendAuthority, /authority\.payloadSha256 !== sha256\(canonicalJson\(fields\)\)/u);
  assert.match(appendAuthority, /authority\.authorizedReceiptSha256 !== sha256\(canonicalJson\(core\)\)/u);

  const invokeAuthorityStart = runtimeRecoveryOperator.indexOf(
    "function invokeAuthorizedMutation(",
  );
  const invokeAuthorityEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction receiptAfterPlan(",
    invokeAuthorityStart,
  );
  const invokeAuthority = runtimeRecoveryOperator.slice(
    invokeAuthorityStart,
    invokeAuthorityEnd,
  );
  assert.equal((invokeAuthority.match(/\{ mutation: true \}/gu) ?? []).length, 1);
  assert.equal((runtimeRecoveryOperator.match(/\{ mutation: true \}/gu) ?? []).length, 1);
  assert.match(invokeAuthority, /canonicalJson\(args\) !== canonicalJson\(expectedArgs\)/u);
  assert.match(invokeAuthority, /authority\.payloadSha256 !== sha256\(canonicalJson\(command\)\)/u);
  assert.match(invokeAuthority, /authority\.chainTailSha256 !== chain\.at\(-1\)\?\.receiptSha256/u);
  assert.match(invokeAuthority, /readReceiptBinding\([\s\S]*stateDirectory,[\s\S]*receiptDirectory/u);
  assert.match(invokeAuthority, /const freshChain = readReceiptChain\(receiptDirectory\)/u);
  assert.match(invokeAuthority, /assertMutationInputUnchanged\(bundle, release, mutation\)/u);
  assert.match(invokeAuthority, /command\.argsSha256 !== sha256\(canonicalJson\(args\)\)/u);
  const finalInput = invokeAuthority.indexOf("const finalMutationInputEvidence =");
  const finalClock = invokeAuthority.indexOf("const finalNow = exactNow(finalGate.now);");
  const finalPlan = invokeAuthority.indexOf("assertPlanCurrent(", finalClock);
  const finalReducer = invokeAuthority.indexOf(
    "const immediateAuthority = evaluateOperationalState({",
    finalPlan,
  );
  const soleInvoke = invokeAuthority.indexOf(
    "return invokeCli(dependencies, args, { mutation: true });",
    finalReducer,
  );
  assert.ok(
    finalInput >= 0
      && finalClock > finalInput
      && finalPlan > finalClock
      && finalReducer > finalPlan
      && soleInvoke > finalReducer,
    "fresh input capture, final clock, plan/reducer recheck must immediately precede CLI",
  );
  assert.match(invokeAuthority, /chain:\s*freshChain/u);
  assert.match(invokeAuthority, /bindings:\s*finalBindings/u);
  const invokeCalls = [...runtimeRecoveryOperator.matchAll(
    /\binvokeAuthorizedMutation\(([\s\S]*?)^\s*\);/gmu,
  )].filter(match => !runtimeRecoveryOperator.slice(
    Math.max(0, match.index - "function ".length),
    match.index,
  ).endsWith("function ")).map(match => match[1]);
  assert.equal(invokeCalls.length, 2);
  for (const call of invokeCalls) {
    assert.match(
      call,
      /bundle,[\s\S]*release,[\s\S]*context\.chain,[\s\S]*context\.receiptDirectory,[\s\S]*context\.stateDirectory,[\s\S]*context\.receiptBinding\.bindingSha256,[\s\S]*plan,[\s\S]*approval:\s*input\.approval,[\s\S]*provenance:\s*context\.provenance,[\s\S]*now:\s*common\.now/u,
    );
  }
  const applyStart = runtimeRecoveryOperator.indexOf(
    "async function operateApply(",
  );
  const applyEnd = runtimeRecoveryOperator.indexOf(
    "\nasync function operateReconcile(",
    applyStart,
  );
  const applySource = runtimeRecoveryOperator.slice(applyStart, applyEnd);
  const deployResultReceipt = applySource.indexOf(
    "const deployResultReceipt = appendAuthorizedReceipt(",
  );
  const applyCompletion = applySource.indexOf(
    "const completion = await collectCompletionAuthority(",
    deployResultReceipt,
  );
  assert.ok(
    deployResultReceipt >= 0
      && applyCompletion > deployResultReceipt,
    "direct apply completion must use shared post-result authority",
  );
  assert.equal(
    (applySource.match(/await collectCompletionAuthority\(/gu) ?? []).length,
    1,
  );
  const reconcileStart = runtimeRecoveryOperator.indexOf(
    "async function operateReconcile(",
  );
  const reconcileEnd = runtimeRecoveryOperator.indexOf(
    "\nasync function operateVerify(",
    reconcileStart,
  );
  const reconcileSource = runtimeRecoveryOperator.slice(reconcileStart, reconcileEnd);
  const appliedReceipt = reconcileSource.indexOf(
    "const reconciled = appendAuthorizedReceipt(",
  );
  const secondReconcileCompletion = reconcileSource.indexOf(
    "completion = await collectCompletionAuthority(",
    appliedReceipt,
  );
  assert.ok(
    appliedReceipt >= 0
      && secondReconcileCompletion > appliedReceipt,
    "applied reconciliation completion must use shared post-receipt authority",
  );
  assert.equal(
    (reconcileSource.match(/await collectCompletionAuthority\(/gu) ?? []).length,
    2,
  );
  const completionHelperStart = runtimeRecoveryOperator.indexOf(
    "async function collectCompletionAuthority(",
  );
  const completionHelperEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction completeReceiptFields(",
    completionHelperStart,
  );
  const completionHelper = runtimeRecoveryOperator.slice(
    completionHelperStart,
    completionHelperEnd,
  );
  const helperPostflight = completionHelper.indexOf(
    "observedSandwich = await postflightSandwichImpl(",
  );
  const helperFresh = completionHelper.indexOf(
    "const sandwich = assertFreshCompletionSandwich(",
    helperPostflight,
  );
  const helperCi = completionHelper.indexOf(
    "const ci = inspectCiImpl(",
    helperFresh,
  );
  const helperFields = completionHelper.indexOf(
    "const completionFields = completeReceiptFieldsImpl({",
    helperCi,
  );
  assert.ok(
    completionHelperStart >= 0
      && completionHelperEnd > completionHelperStart
      && helperPostflight >= 0
      && helperFresh > helperPostflight
      && helperCi > helperFresh
      && helperFields > helperCi,
    "shared completion authority must order postflight, freshness, CI and fields",
  );
  assert.match(
    runtimeRecoveryOperator,
    /receipt\.hostedProof\.proofSha256 === receipt\.causalHostedProofSha256/u,
  );
  assert.match(
    runtimeRecoveryOperator,
    /cause\.hostedD0ResponseSha256 === receipt\.d0\.responseSha256/u,
  );
  for (const prefix of ["secret", "deploy"]) {
    const intentAuthority = applySource.indexOf(
      `const ${prefix}IntentAuthority = evaluateOperationalState({`,
    );
    const durableIntent = applySource.indexOf(
      `const ${prefix === "secret" ? "intent" : "deployIntent"} = appendAuthorizedReceipt(`,
      intentAuthority,
    );
    const mutationAuthority = applySource.indexOf(
      `const ${prefix}MutationAuthority = evaluateOperationalState({`,
      durableIntent,
    );
    const invoke = applySource.indexOf(
      "invokeAuthorizedMutation(",
      mutationAuthority,
    );
    assert.ok(
      intentAuthority >= 0
        && durableIntent > intentAuthority
        && mutationAuthority > durableIntent
        && invoke > mutationAuthority,
      `${prefix} mutation must follow reducer intent, durable append and fresh reducer invoke authority`,
    );
  }
  const operatorStart = runtimeRecoveryOperator.indexOf(
    "async function operateMainFinanceRuntimeRecoveryV2() {",
  );
  const operatorEnd = runtimeRecoveryOperator.indexOf(
    "\nasync function main() {",
    operatorStart,
  );
  const privateOperator = runtimeRecoveryOperator.slice(operatorStart, operatorEnd);
  assert.equal((privateOperator.match(/acquireOperationLease\(/gu) ?? []).length, 2);
  assert.equal((privateOperator.match(/releaseOperationLease\(/gu) ?? []).length, 2);
  assert.match(privateOperator, /return await operateMeasure\(/u);
  assert.match(privateOperator, /return await operatePlan\(/u);
  assert.match(privateOperator, /return await operateApply\(/u);
  assert.match(privateOperator, /return await operateReconcile\(/u);
  assert.match(privateOperator, /return await operateVerify\(/u);
  const leaseStart = runtimeRecoveryOperator.indexOf(
    "function acquireOperationLease(",
  );
  const leaseEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction releaseOperationLease(",
    leaseStart,
  );
  const leaseSource = runtimeRecoveryOperator.slice(leaseStart, leaseEnd);
  assert.match(leaseSource, /fsConstants\.O_EXCL/u);
  assert.match(leaseSource, /operation_lease_present/u);
  assert.match(leaseSource, /preserve it for reviewed manual recovery/u);
  assert.doesNotMatch(leaseSource, /operationLeaseOwnerIsActive|renameSync|\.stale\./u);
  const leaseTestName =
    "two direct CLI contenders preserve and refuse an existing dead-owner operation lease";
  const leaseTestStart = runtimeRecoveryReleaseTest.indexOf(
    `test("${leaseTestName}", t => {`,
  );
  const leaseTestEnd = runtimeRecoveryReleaseTest.indexOf(
    "\nif (process.platform === \"darwin\")",
    leaseTestStart,
  );
  assert.ok(leaseTestStart >= 0 && leaseTestEnd > leaseTestStart);
  const leaseTest = runtimeRecoveryReleaseTest.slice(leaseTestStart, leaseTestEnd);
  for (const token of [
    'for (const contender of ["first", "second"])',
    "spawnSync(process.execPath, args",
    "/operation_lease_present/u",
    'readFileSync(leaseFile, "utf8"), leaseSource',
    "readdirSync(parent)",
    "existsSync(stateDirectory), false",
    "existsSync(receiptDirectory), true",
  ]) assert.ok(leaseTest.includes(token), `lease contender regression lacks ${token}`);

  assert.equal(
    Object.hasOwn(
      runtimeRecoveryManifest.sourceLineage,
      "expectedReleaseCommitSha",
    ),
    false,
  );
  assert.equal(
    Object.hasOwn(
      runtimeRecoveryManifest.sourceLineage,
      "expectedReleaseTreeSha",
    ),
    false,
  );
  assert.deepEqual(
    Object.keys(runtimeRecoveryManifest.sourceLineage).sort(),
    [
      "baseCommitSha",
      "baseTreeSha",
      "changedPaths",
      "expectedTrackedFileCount",
      "requiredSoleParentSha",
    ],
  );
  assert.equal(
    runtimeRecoveryManifest.sourceCi.workflowBlobSha,
    "220ee4c940cfd03e178dbee1fb6f25dc5de0845e",
  );
  assert.equal(
    runtimeRecoveryManifest.sourceLineage.baseCommitSha,
    "a30dedf20e977d9794a8ac9e54abc48b076c9d45",
  );
  assert.equal(
    runtimeRecoveryManifest.sourceLineage.baseTreeSha,
    "92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf",
  );
  assert.equal(
    runtimeRecoveryManifest.sourceLineage.requiredSoleParentSha,
    "a30dedf20e977d9794a8ac9e54abc48b076c9d45",
  );
  assert.match(
    runtimeRecoveryOperator,
    /sourceProvenanceFileSha256[\s\S]*sourceProvenanceDescriptorSha256/u,
  );
  const approvalStart = runtimeRecoveryOperator.indexOf(
    "function expectedApproval(plan) {",
  );
  const approvalEnd = runtimeRecoveryOperator.indexOf(
    "\nfunction latestPlan(",
    approvalStart,
  );
  const approval = runtimeRecoveryOperator.slice(approvalStart, approvalEnd);
  assert.match(approval, /MAIN_FINANCE_RUNTIME_RECOVERY_V2_APPROVED=DEPLOY/u);
  assert.match(approval, /\.join\(":"\)/u);
  assert.deepEqual(
    [...approval.matchAll(/plan\.([A-Za-z][A-Za-z0-9]*)/gu)]
      .map(match => match[1]),
    [
      "sourceCommitSha",
      "sourceTreeSha",
      "sourceCiRunId",
      "sourceProvenanceFileSha256",
      "sourceProvenanceDescriptorSha256",
      "receiptSha256",
    ],
  );
  assert.match(
    runtimeRecoveryReleaseTest,
    /external owner-private provenance is canonical and binds raw bytes separately from its descriptor/u,
  );
});
