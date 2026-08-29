import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import * as accessOperator from "../../scripts/manage-finance-access-v2.mjs";

const { simulateMainFinanceAccessV2Contract: simulateContract } = accessOperator;
const TEST_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(TEST_FILE), "../..");
const SCRIPT_FILE = path.join(REPOSITORY_ROOT, "scripts/manage-finance-access-v2.mjs");
const SCRIPT_SOURCE = readFileSync(SCRIPT_FILE, "utf8");
const SNAPSHOT_SOURCE = readFileSync(path.join(
  REPOSITORY_ROOT,
  "scripts/main-finance-runtime-recovery-v2-snapshot.mjs",
), "utf8");
const NODE = process.execPath;
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_REF = "makgsbjduobcphuqzaoq";
const PRODUCTION_REF = "soxtekhspohkddpdidvp";
const SOURCE_SHA256 = "ab".repeat(32);
const SOURCE_COMMIT = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const EVENT_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_EVENT_ID = "10000000-0000-4000-8000-000000000002";
const NOW = Date.parse("2026-08-14T05:00:01.000Z");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function simulate(scenario, input) {
  return simulateContract(deepFreeze({ scenario, input }));
}

function basePlan(overrides = {}) {
  return {
    action: "grant",
    prepared_at: new Date(NOW).toISOString(),
    expires_at: new Date(NOW + 240_000).toISOString(),
    source_commit_sha: SOURCE_COMMIT,
    source_tree_sha: SOURCE_TREE,
    source_deployment_sha256: SOURCE_SHA256,
    production_boundary_sha256: "11".repeat(32),
    target_descriptor_sha256: "12".repeat(32),
    runtime_release_completion_receipt_sha256: "1a".repeat(32),
    runtime_release_function_inventory_sha256: "1b".repeat(32),
    request_body_sha256: "13".repeat(32),
    request_file_sha256: "14".repeat(32),
    action_authority_sha256: "15".repeat(32),
    main_user_id: USER_ID,
    event_id: EVENT_ID,
    expected_version: "0",
    changed_by: "owner.test",
    d0_descriptor_sha256: "16".repeat(32),
    d1_descriptor_sha256: "17".repeat(32),
    proof_sha256: "18".repeat(32),
    plan_receipt_sha256: "19".repeat(32),
    ...overrides,
  };
}

function bindingFor(plan, overrides = {}) {
  return {
    action: plan.action,
    request_body_sha256: plan.request_body_sha256,
    request_file_sha256: plan.request_file_sha256,
    action_authority_sha256: plan.action_authority_sha256,
    main_user_id: plan.main_user_id,
    event_id: plan.event_id,
    expected_version: plan.expected_version,
    changed_by: plan.changed_by,
    source_commit_sha: plan.source_commit_sha,
    source_tree_sha: plan.source_tree_sha,
    d1_descriptor_sha256: plan.d1_descriptor_sha256,
    d0_descriptor_sha256: ["grant", "revoke"].includes(plan.action)
      ? plan.d0_descriptor_sha256
      : null,
    proof_sha256: ["grant", "revoke"].includes(plan.action) ? plan.proof_sha256 : null,
    approval_expires_at: ["grant", "revoke", "reconcile"].includes(plan.action)
      ? plan.expires_at
      : null,
    ...overrides,
  };
}

function ownerToken(plan) {
  return simulate("owner-token-template", { plan }).ownerApprovalToken;
}

function authorityInput(plan, overrides = {}) {
  return {
    plan,
    binding: bindingFor(plan),
    owner_approval_token: ownerToken(plan),
    latest_plan_receipt_sha256: plan.plan_receipt_sha256,
    lease_held: true,
    authorization_at_ms: NOW + 100,
    intent_boundary_at_ms: NOW + 200,
    request_started_at_ms: NOW + 300,
    intent_reserved: ["grant", "revoke", "reconcile"].includes(plan.action),
    ...overrides,
  };
}

function stableRow(overrides = {}) {
  return {
    main_user_id: OTHER_USER_ID,
    event_id: OTHER_EVENT_ID,
    desired_state: "granted",
    version: "1",
    ...overrides,
  };
}

function deployedTargetFunction(version, overrides = {}) {
  const id = "30000000-0000-4000-8000-000000000001";
  const root = `file:///tmp/user_fn_${MAIN_REF}_${id}_${version}` +
    "/source/supabase/functions/finance-manage-access-v2";
  return {
    created_at: Date.parse("2026-08-14T04:00:00.000Z"),
    entrypoint_path: `${root}/index.ts`,
    ezbr_sha256: (version === 7 ? "71" : "81").repeat(32),
    id,
    import_map_path: `${root}/deno.json`,
    name: "finance-manage-access-v2",
    slug: "finance-manage-access-v2",
    status: "ACTIVE",
    updated_at: Date.parse(version === 7
      ? "2026-08-14T04:30:00.000Z"
      : "2026-08-14T04:45:00.000Z"),
    verify_jwt: false,
    version,
    ...overrides,
  };
}

function runtimeReleaseFixture() {
  const before = deployedTargetFunction(7);
  const after = deployedTargetFunction(8);
  const rows = [{
    created_at: Date.parse("2026-08-13T04:00:00.000Z"),
    id: "30000000-0000-4000-8000-000000000002",
    name: "another-function",
    slug: "another-function",
    status: "ACTIVE",
    updated_at: Date.parse("2026-08-13T04:30:00.000Z"),
    verify_jwt: false,
    version: 3,
  }, clone(after)];
  const authority = {
    schemaVersion: 4,
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    releaseManifestSha256: "61".repeat(32),
    sourceDeploymentSha256: SOURCE_SHA256,
    productionBoundarySha256: "11".repeat(32),
    targetDescriptorSha256: "12".repeat(32),
    operatorDescriptorFileSha256: "64".repeat(32),
    operatorDescriptorSha256: "65".repeat(32),
    hostedSourceClosureSha256: "66".repeat(32),
    hostedSourceMetadataSha256: "67".repeat(32),
    completionReceiptSha256: "62".repeat(32),
    functionInventorySha256: sha256(JSON.stringify(rows)),
    beforeTargetFunctionRow: before,
    afterTargetFunctionRow: after,
    targetTransitionDisposition: "exact-target-replacement-plus-one",
  };
  return {
    authority,
    source_commit_sha: SOURCE_COMMIT,
    source_tree_sha: SOURCE_TREE,
    source_deployment_sha256: SOURCE_SHA256,
    release_manifest_sha256: authority.releaseManifestSha256,
    production_boundary_sha256: authority.productionBoundarySha256,
    target_descriptor_sha256: authority.targetDescriptorSha256,
    operator_descriptor_file_sha256: authority.operatorDescriptorFileSha256,
    operator_descriptor_sha256: authority.operatorDescriptorSha256,
    f0_rows: rows,
    f1_rows: clone(rows),
  };
}

function unknownEvidence() {
  const planSha = "21".repeat(32);
  const planFileSha = "22".repeat(32);
  const requestBodySha = "23".repeat(32);
  const requestFileSha = "24".repeat(32);
  const descriptorFileSha = "25".repeat(32);
  const boundarySha = "26".repeat(32);
  const targetSha = "27".repeat(32);
  const approvalSha = "28".repeat(32);
  const intentSha = "29".repeat(32);
  const intentFileSha = "2a".repeat(32);
  return {
    action: "grant",
    latest_plan_receipt_sha256: planSha,
    plan: {
      receipt_sha256: planSha,
      file_sha256: planFileSha,
      prepared_at_ms: NOW,
      expires_at_ms: NOW + 240_000,
    },
    request: { body_sha256: requestBodySha, file_sha256: requestFileSha },
    descriptor: {
      file_sha256: descriptorFileSha,
      production_boundary_sha256: boundarySha,
      target_descriptor_sha256: targetSha,
    },
    approval_token_sha256: approvalSha,
    receipt: {
      action: "grant",
      status: "unknown",
      recorded_at_ms: NOW + 400,
      request_body_sha256: requestBodySha,
      request_file_sha256: requestFileSha,
      descriptor_file_sha256: descriptorFileSha,
      production_boundary_sha256: boundarySha,
      target_descriptor_sha256: targetSha,
      approval_token_sha256: approvalSha,
      plan_receipt_sha256: planSha,
      plan_file_sha256: planFileSha,
      intent_sha256: intentSha,
      intent_file_sha256: intentFileSha,
      reconcile_required: true,
      automatic_retry_performed: false,
      hosted_request_count: 1,
      production_touched: false,
    },
    intent: {
      action: "grant",
      recorded_at_ms: NOW + 200,
      request_body_sha256: requestBodySha,
      request_file_sha256: requestFileSha,
      descriptor_file_sha256: descriptorFileSha,
      production_boundary_sha256: boundarySha,
      target_descriptor_sha256: targetSha,
      approval_token_sha256: approvalSha,
      plan_receipt_sha256: planSha,
      plan_file_sha256: planFileSha,
      intent_sha256: intentSha,
      file_sha256: intentFileSha,
      automatic_retry_forbidden: true,
      hosted_request_count: 0,
      production_touched: false,
    },
  };
}

function directCli(args) {
  return spawnSync(NODE, [SCRIPT_FILE, ...args], {
    cwd: REPOSITORY_ROOT,
    env: { LANG: "C", LC_ALL: "C" },
    encoding: "utf8",
    timeout: 10_000,
  });
}

function commonCli(mode, mainRef = MAIN_REF) {
  return [
    `--${mode}`,
    "--main-project-ref", mainRef,
    "--finance-project-ref", FINANCE_REF,
    "--source-deployment-sha256", SOURCE_SHA256,
  ];
}

test("module exports only the effectless simulator and import cannot invoke operational modes", () => {
  assert.deepEqual(Object.keys(accessOperator), ["simulateMainFinanceAccessV2Contract"]);
  assert.equal(accessOperator.manageFinanceAccessV2, undefined);
  assert.equal(accessOperator.main, undefined);
  assert.match(SCRIPT_SOURCE, /async function manageFinanceAccessV2\(\) \{/u);
  assert.match(SCRIPT_SOURCE, /if \(import\.meta\.main === true\) \{/u);
  assert.doesNotMatch(SCRIPT_SOURCE, /export\s+async\s+function/u);
  assert.doesNotMatch(SCRIPT_SOURCE, /pathToFileURL|process\.argv\[1\]/u);
  assert.doesNotMatch(SCRIPT_SOURCE,
    /export\s+(?:const|function|class)\s+(?!simulateMainFinanceAccessV2Contract\b)/u);
});

test("exact bundled Node direct CLI plan is effectless and production/legacy authority fail closed", () => {
  assert.equal(spawnSync(NODE, ["--version"], { encoding: "utf8" }).stdout.trim(), "v24.14.0");
  const planned = directCli(commonCli("plan"));
  assert.equal(planned.status, 0, planned.stderr);
  assert.deepEqual(JSON.parse(planned.stdout), {
    approvalFileAccepted: false,
    descriptorRead: false,
    environment: "staging",
    financeProjectRef: FINANCE_REF,
    hostedMutationCount: 0,
    hostedReadCount: 0,
    mainProjectRef: MAIN_REF,
    mode: "plan",
    networkPerformed: false,
    ok: true,
    productionDenied: true,
    secretRead: false,
    supportedActions: ["status", "grant", "revoke", "reconcile"],
  });
  const production = directCli(commonCli("plan", PRODUCTION_REF));
  assert.equal(production.status, 1);
  assert.equal(production.stdout, "");
  assert.match(production.stderr, /outside the compiled staging boundary/u);
  const legacy = directCli([...commonCli("execute"), "--approval-file", "/private/tmp/no.json"]);
  assert.equal(legacy.status, 1);
  assert.match(legacy.stderr, /unknown or duplicate argument --approval-file/u);
  const callerVersion = directCli([
    ...commonCli("plan"), "--expected-function-version", "8",
  ]);
  assert.equal(callerVersion.status, 1);
  assert.match(callerVersion.stderr, /unknown or duplicate argument --expected-function-version/u);
  const prepareWithoutRawAuthority = directCli([
    ...commonCli("prepare"),
    "--action", "status",
    "--source-commit-sha", SOURCE_COMMIT,
    "--source-tree-sha", SOURCE_TREE,
    "--descriptor-file", "/private/tmp/descriptor.json",
    "--receipt-directory", "/private/tmp/access-receipts",
    "--access-token-file", "/private/tmp/access-token",
    "--supabase-cli", "/private/tmp/supabase",
    "--supabase-home", "/private/tmp/supabase-home",
    "--output-directory", "/private/tmp/access-output",
    "--main-user-id", USER_ID,
    "--event-id", EVENT_ID,
  ]);
  assert.equal(prepareWithoutRawAuthority.status, 1);
  assert.match(prepareWithoutRawAuthority.stderr, /prepare mode arguments differ/u);
  const executeWithoutRawAuthorityOrFreshList = directCli([
    ...commonCli("execute"),
    "--descriptor-file", "/private/tmp/descriptor.json",
    "--request-file", "/private/tmp/request.json",
    "--plan-receipt-file", "/private/tmp/plan.json",
    "--receipt-directory", "/private/tmp/access-receipts",
  ]);
  assert.equal(executeWithoutRawAuthorityOrFreshList.status, 1);
  assert.match(executeWithoutRawAuthorityOrFreshList.stderr,
    /exact plan, raw authority and fresh-list set/u);
});

test("schema-4 terminal runtime authority is executable and relative-version hostiles fail closed", () => {
  const fixture = runtimeReleaseFixture();
  assert.deepEqual(simulate("runtime-release-authority", fixture), {
    completionReceiptSha256: fixture.authority.completionReceiptSha256,
    functionInventorySha256: fixture.authority.functionInventorySha256,
    targetVersion: 8,
  });

  const hostiles = [
    ["schema downgrade", (value) => { value.authority.schemaVersion = 3; }],
    ["summary only", (value) => { delete value.authority.beforeTargetFunctionRow; }],
    ["non-hash completion summary", (value) => {
      value.authority.completionReceiptSha256 = "summary-only";
    }],
    ["source crossbind", (value) => { value.source_commit_sha = "c".repeat(40); }],
    ["descriptor byte substitution", (value) => {
      value.operator_descriptor_file_sha256 = "66".repeat(32);
    }],
    ["descriptor self-hash substitution", (value) => {
      value.operator_descriptor_sha256 = "67".repeat(32);
    }],
    ["hosted closure summary omitted", (value) => {
      delete value.authority.hostedSourceClosureSha256;
    }],
    ["hosted metadata summary malformed", (value) => {
      value.authority.hostedSourceMetadataSha256 = "not-a-sha";
    }],
    ["non-relative target", (value) => { value.authority.afterTargetFunctionRow.version = 9; }],
    ["identity replacement", (value) => {
      value.authority.afterTargetFunctionRow.id =
        "30000000-0000-4000-8000-000000000009";
    }],
    ["unrelated row drift", (value) => { value.f1_rows[0].version = 4; }],
    ["later redeploy", (value) => {
      value.f1_rows[1] = deployedTargetFunction(9, {
        updated_at: Date.parse("2026-08-14T04:55:00.000Z"),
        ezbr_sha256: "91".repeat(32),
      });
    }],
  ];
  for (const [name, mutate] of hostiles) {
    const changed = clone(fixture);
    mutate(changed);
    assert.throws(
      () => simulate("runtime-release-authority", changed),
      /runtime recovery release authority|target function transition|target identity|live function inventory/u,
      name,
    );
  }
});

test("snapshot reader accepts only the schema-4 current manifest while wire proofs stay protocol v2", () => {
  assert.match(SNAPSHOT_SOURCE, /manifest\.schemaVersion !== 4/u);
  assert.match(SNAPSHOT_SOURCE,
    /main-finance-runtime-recovery-v4-target-redeploy-staging-release/u);
  assert.match(SNAPSHOT_SOURCE,
    /schemaVersion: 2,[\s\S]{0,120}main-finance-runtime-recovery-v2-verified-attestation-proof/u);
  assert.doesNotMatch(SNAPSHOT_SOURCE,
    /manifest\.schemaVersion !== (?:2|3)|main-finance-runtime-recovery-v[23]-[^"\n]*staging-release/u);
});

test("a lexical ESM import is silent and exposes no argv/env/test operational capability", () => {
  const source = [
    "let fetchCalls = 0;",
    "globalThis.fetch = async () => { fetchCalls += 1; throw new Error('forbidden'); };",
    `process.argv = [${JSON.stringify(NODE)}, ${JSON.stringify(SCRIPT_FILE)}, ${commonCli("plan")
      .map((value) => JSON.stringify(value)).join(", ")}];`,
    `const value = await import(${JSON.stringify(pathToFileURL(SCRIPT_FILE).href)});`,
    "process.stdout.write(JSON.stringify({ exports: Object.keys(value), fetchCalls }));",
  ].join("\n");
  const imported = spawnSync(NODE, ["--input-type=module", "--eval", source], {
    cwd: REPOSITORY_ROOT,
    env: { LANG: "C", LC_ALL: "C" },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stderr, "");
  assert.deepEqual(JSON.parse(imported.stdout), {
    exports: ["simulateMainFinanceAccessV2Contract"], fetchCalls: 0,
  });
});

test("owner token is exact, plan-bound and never replaceable by a self-authored hash", () => {
  const plan = basePlan();
  const token = ownerToken(plan);
  assert.equal(token, [
    "MAIN_FINANCE_ACCESS_V2_APPROVED=GRANT",
    MAIN_REF,
    FINANCE_REF,
    SOURCE_COMMIT,
    SOURCE_TREE,
    SOURCE_SHA256,
    plan.production_boundary_sha256,
    plan.target_descriptor_sha256,
    plan.runtime_release_completion_receipt_sha256,
    plan.runtime_release_function_inventory_sha256,
    USER_ID,
    EVENT_ID,
    "0",
    plan.action_authority_sha256,
    plan.request_body_sha256,
    plan.plan_receipt_sha256,
    String(NOW + 240_000),
  ].join(":"));
  const accepted = simulate("execution-authority", authorityInput(plan));
  assert.equal(accepted.ready, true);
  assert.equal(accepted.approvalTokenSha256, sha256(token));
  for (const forged of [null, sha256(token), `${token}0`, token.replace("GRANT", "REVOKE")]) {
    assert.throws(() => simulate("execution-authority", authorityInput(plan, {
      owner_approval_token: forged,
    })), /owner approval token/u);
  }
  for (const [field, value] of [
    ["runtime_release_completion_receipt_sha256", "1c".repeat(32)],
    ["runtime_release_function_inventory_sha256", "1d".repeat(32)],
  ]) {
    const changed = basePlan({ [field]: value });
    assert.throws(() => simulate("execution-authority", authorityInput(changed, {
      owner_approval_token: token,
    })), /owner approval token/u, field);
  }
});

test("status requires no owner token while reconcile receives a fresh exact token", () => {
  const statusPlan = basePlan({
    action: "status", changed_by: null, expected_version: "0",
    action_authority_sha256: "31".repeat(32),
  });
  assert.equal(ownerToken(statusPlan), null);
  const accepted = simulate("execution-authority", authorityInput(statusPlan, {
    binding: bindingFor(statusPlan),
    owner_approval_token: null,
    intent_reserved: false,
  }));
  assert.equal(accepted.approvalTokenSha256, null);
  assert.throws(() => simulate("execution-authority", authorityInput(statusPlan, {
    binding: bindingFor(statusPlan),
    owner_approval_token: "not-valid-for-status",
    intent_reserved: false,
  })), /invalid for status/u);

  const reconcilePlan = basePlan({
    action: "reconcile", expected_version: "1",
    d0_descriptor_sha256: null, proof_sha256: null,
    action_authority_sha256: "32".repeat(32),
  });
  assert.match(ownerToken(reconcilePlan), /^MAIN_FINANCE_ACCESS_V2_APPROVED=RECONCILE:/u);
});

test("latest-plan lease, TTL and causal clocks remain mandatory at the post-intent boundary", () => {
  const plan = basePlan();
  const cases = [
    ["superseded", { latest_plan_receipt_sha256: "ff".repeat(32) }],
    ["lease absent", { lease_held: false }],
    ["intent absent", { intent_reserved: false }],
    ["authorization before plan", { authorization_at_ms: NOW - 1 }],
    ["clock rollback", { authorization_at_ms: NOW + 220, intent_boundary_at_ms: NOW + 200 }],
    ["request before intent", { request_started_at_ms: NOW + 199 }],
    ["expired", { request_started_at_ms: NOW + 240_000 }],
  ];
  for (const [name, override] of cases) {
    assert.throws(
      () => simulate("execution-authority", authorityInput(plan, override)),
      /latest plan lease\/TTL\/causal execution authority differs/u,
      name,
    );
  }
});

test("every request, OCC and evidence field remains bound to the selected plan", () => {
  const plan = basePlan();
  const mutations = [
    ["action", "revoke"],
    ["request_body_sha256", "41".repeat(32)],
    ["request_file_sha256", "42".repeat(32)],
    ["action_authority_sha256", "43".repeat(32)],
    ["main_user_id", OTHER_USER_ID],
    ["event_id", OTHER_EVENT_ID],
    ["expected_version", "1"],
    ["changed_by", "other.owner"],
    ["source_commit_sha", "c".repeat(40)],
    ["source_tree_sha", "d".repeat(40)],
    ["d1_descriptor_sha256", "44".repeat(32)],
    ["d0_descriptor_sha256", "45".repeat(32)],
    ["proof_sha256", "46".repeat(32)],
    ["approval_expires_at", new Date(NOW + 200_000).toISOString()],
  ];
  for (const [field, value] of mutations) {
    const binding = bindingFor(plan, { [field]: value });
    assert.throws(() => simulate("execution-authority", authorityInput(plan, { binding })),
      /request differs from latest prepare plan/u, field);
  }
});

test("OCC allows first grant only over a nonempty global snapshot and rejects duplicates/no-ops", () => {
  const firstGrant = simulate("mutation-occ", {
    action: "grant", rows: [stableRow()], main_user_id: USER_ID, event_id: EVENT_ID,
  });
  assert.deepEqual(firstGrant, {
    desiredState: "granted", currentEventId: null, expectedVersion: "0", firstGrant: true,
  });
  const successor = simulate("mutation-occ", {
    action: "grant",
    rows: [stableRow({
      main_user_id: USER_ID, event_id: OTHER_EVENT_ID, desired_state: "revoked", version: "7",
    })],
    main_user_id: USER_ID,
    event_id: EVENT_ID,
  });
  assert.equal(successor.currentEventId, OTHER_EVENT_ID);
  assert.equal(successor.expectedVersion, "7");
  const failures = [
    { action: "grant", rows: [], main_user_id: USER_ID, event_id: EVENT_ID },
    { action: "revoke", rows: [stableRow()], main_user_id: USER_ID, event_id: EVENT_ID },
    { action: "grant", rows: [stableRow({ main_user_id: USER_ID })],
      main_user_id: USER_ID, event_id: EVENT_ID },
    { action: "grant", rows: [stableRow({ event_id: EVENT_ID })],
      main_user_id: USER_ID, event_id: EVENT_ID },
  ];
  for (const input of failures) {
    assert.throws(() => simulate("mutation-occ", input),
      /mutation OCC fixture differs|revoke target is absent|already current|event UUID already exists/u);
  }
});

test("UNKNOWN reconciliation requires the exact latest plan, request, descriptor and durable intent chain", () => {
  const evidence = unknownEvidence();
  assert.deepEqual(simulate("unknown-reconcile", { evidence }), {
    accepted: true, action: "grant", automaticRetryAllowed: false,
  });
  const mutations = [
    ["superseded plan", (value) => { value.latest_plan_receipt_sha256 = "51".repeat(32); }],
    ["receipt request", (value) => { value.receipt.request_body_sha256 = "52".repeat(32); }],
    ["intent request", (value) => { value.intent.request_file_sha256 = "53".repeat(32); }],
    ["receipt descriptor", (value) => { value.receipt.descriptor_file_sha256 = "54".repeat(32); }],
    ["intent descriptor", (value) => { value.intent.descriptor_file_sha256 = "55".repeat(32); }],
    ["approval", (value) => { value.receipt.approval_token_sha256 = "56".repeat(32); }],
    ["plan file", (value) => { value.intent.plan_file_sha256 = "57".repeat(32); }],
    ["intent content", (value) => { value.receipt.intent_sha256 = "58".repeat(32); }],
    ["intent file", (value) => { value.receipt.intent_file_sha256 = "59".repeat(32); }],
    ["pre-plan intent", (value) => { value.intent.recorded_at_ms = NOW - 1; }],
    ["expired intent", (value) => { value.intent.recorded_at_ms = NOW + 240_000; }],
    ["receipt before intent", (value) => { value.receipt.recorded_at_ms = NOW + 100; }],
    ["automatic retry", (value) => { value.receipt.automatic_retry_performed = true; }],
    ["wrong hosted count", (value) => { value.receipt.hosted_request_count = 0; }],
    ["production touched", (value) => { value.intent.production_touched = true; }],
  ];
  for (const [name, mutate] of mutations) {
    const changed = clone(evidence);
    mutate(changed);
    assert.throws(() => simulate("unknown-reconcile", { evidence: changed }),
      /unknown reconcile evidence binding differs/u, name);
  }
});

test("reconcile disposition grants execution authority only to applied", () => {
  assert.deepEqual(simulate("reconcile-disposition", { disposition: "applied" }), {
    outcome: "ready", executionAuthority: true,
  });
  assert.deepEqual(simulate("reconcile-disposition", { disposition: "wait" }), {
    outcome: "wait", executionAuthority: false,
  });
  for (const disposition of ["absent", "nonterminal"]) {
    assert.deepEqual(simulate("reconcile-disposition", { disposition }), {
      outcome: "no_go", executionAuthority: false,
    });
  }
  assert.throws(() => simulate("reconcile-disposition", { disposition: "unknown" }),
    /reconcile disposition differs/u);
});

test("simulator rejects mutable data, callbacks, accessors, filesystem paths and network locations", () => {
  assert.throws(() => simulateContract({
    scenario: "reconcile-disposition", input: { disposition: "applied" },
  }), /deeply frozen plain data/u);
  assert.throws(() => simulateContract(deepFreeze({
    scenario: "reconcile-disposition",
    input: { disposition: "applied", callback: () => true },
  })), /effect capability/u);
  assert.throws(() => simulateContract(deepFreeze({
    scenario: "reconcile-disposition", input: { disposition: "https://example.invalid" },
  })), /paths or network locations/u);
  let invoked = false;
  const accessorInput = {};
  Object.defineProperty(accessorInput, "disposition", {
    enumerable: true,
    get() { invoked = true; return "applied"; },
  });
  Object.freeze(accessorInput);
  assert.throws(() => simulateContract(deepFreeze({
    scenario: "reconcile-disposition", input: accessorInput,
  })), /effect capability/u);
  assert.equal(invoked, false);
  let proxyTrapCalls = 0;
  const proxyInput = new Proxy({ disposition: "applied" }, {
    getPrototypeOf(target) { proxyTrapCalls += 1; return Object.getPrototypeOf(target); },
    ownKeys(target) { proxyTrapCalls += 1; return Reflect.ownKeys(target); },
  });
  const proxyFixture = Object.freeze({
    scenario: "reconcile-disposition",
    input: proxyInput,
  });
  assert.throws(() => simulateContract(proxyFixture), /deeply frozen plain data/u);
  assert.equal(proxyTrapCalls, 0);
});

test("production source retains branded proof, pinned isolated CLI, lease and secret-denial boundaries", () => {
  assert.match(SCRIPT_SOURCE, /extractMainFinanceRuntimeRecoveryVerifiedAttestationProof/u);
  assert.match(SCRIPT_SOURCE, /assertPinnedSupabaseCliBytes/u);
  assert.match(SCRIPT_SOURCE, /SUPABASE_NO_KEYRING/u);
  assert.match(SCRIPT_SOURCE, /SUPABASE_TELEMETRY_DISABLED/u);
  assert.match(SCRIPT_SOURCE, /withReceiptDirectoryLease/u);
  assert.match(SCRIPT_SOURCE, /assertExecutionTemporalAuthority/u);
  assert.match(SCRIPT_SOURCE, /assertUnknownReconcileEvidence/u);
  assert.match(SCRIPT_SOURCE, /validateMainFinanceRuntimeRecoveryV4ReleaseAuthority/u);
  assert.match(SCRIPT_SOURCE, /--runtime-recovery-receipt-dir/u);
  assert.match(SCRIPT_SOURCE, /--runtime-recovery-source-ci-receipt/u);
  assert.match(SCRIPT_SOURCE, /--runtime-recovery-release-provenance/u);
  assert.match(SCRIPT_SOURCE, /runtime_release_completion_receipt_sha256/u);
  assert.doesNotMatch(SCRIPT_SOURCE, /--expected-function-version/u);
  assert.doesNotMatch(SCRIPT_SOURCE, /(?:process|Deno)\.env/u);
  assert.doesNotMatch(SCRIPT_SOURCE, /readApproval|approval_file_sha256/u);
  assert.doesNotMatch(SCRIPT_SOURCE,
    /MAIN_FINANCE_PRIVACY_HMAC_KEY\s*=|SUPABASE_SERVICE_ROLE_KEY\s*=|MAIN_FINANCE_SYNC_TRIGGER_SECRET\s*=/u);
  assert.doesNotMatch(SCRIPT_SOURCE,
    /export[\s\S]{0,160}(?:fetchImpl|runCli|readSnapshotContractImpl|buildSnapshotImpl|authenticatedAttestImpl)/u);
});
