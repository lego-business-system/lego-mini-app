import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

const supabaseStubUrl = `data:text/javascript,${encodeURIComponent(
  'export function createClient() { throw new Error("uninjected service client"); }',
)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@supabase/supabase-js") {
      return { url: supabaseStubUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

globalThis.Deno = Object.freeze({
  env: Object.freeze({ get: () => undefined }),
  serve: () => undefined,
});

const { handleFinanceManageAccessV2Request } = await import(
  "../functions/finance-manage-access-v2/index.ts?node-adversarial-tests"
);

const EDGE_SOURCE = readFileSync(
  "supabase/functions/finance-manage-access-v2/index.ts",
  "utf8",
);
const ACCESS_OPERATOR_SOURCE = readFileSync(
  "scripts/manage-finance-access-v2.mjs",
  "utf8",
);

const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_REF = "makgsbjduobcphuqzaoq";
const MAIN_PRODUCTION_REF = "soxtekhspohkddpdidvp";
const FINANCE_PRODUCTION_REF = "koibxwgtihwajocxfetb";
const MAIN_ORIGIN = `https://${MAIN_REF}.supabase.co`;
const EDGE_URL = `${MAIN_ORIGIN}/functions/v1/finance-manage-access-v2`;
const OPERATOR_HEADER = "x-architecture-finance-operator-v2";
const OPERATOR_TIMESTAMP_HEADER = "x-architecture-finance-timestamp-v2";
const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const CURRENT_EVENT_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_EVENT_ID = "10000000-0000-4000-8000-000000000002";
const NEW_EVENT_ID = "20000000-0000-4000-8000-000000000001";
const TELEGRAM_ID = "9000000000000000001";
const NOW = Date.parse("2026-08-14T04:00:00.000Z");
const SOURCE_DEPLOYMENT_SHA256 = "11".repeat(32);
const MAIN_SOURCE_COMMIT_SHA = "a".repeat(40);
const MAIN_SOURCE_TREE_SHA = "b".repeat(40);
const SOURCE_MANIFEST_SHA256 = "22".repeat(32);
const PREFLIGHT_SQL_SHA256 = "33".repeat(32);
const CATALOG_SHA256 = "44".repeat(32);
const GATE_INVENTORY_SHA256 = "55".repeat(32);
const PRIVACY_INVENTORY_SHA256 = "66".repeat(32);
const RESPONSE_SHA256 = "77".repeat(32);
const STATE_SHA256 = "88".repeat(32);
const OPERATOR_SECRET = "operator-secret-v2-fixture-000000000000000000000001";
const PRIVACY_KEY = "legacy-privacy-key-fixture-000000000000000000001";
const TRIGGER_SECRET = "worker-trigger-fixture-000000000000000000000001";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

const BASE_ROW = Object.freeze({
  main_user_id: USER_ID,
  event_id: CURRENT_EVENT_ID,
  desired_state: "granted",
  version: "7",
  applied_state: "granted",
  applied_version: "7",
  event_state: "applied",
  changed_by: "operator:fixture",
  change_reason: "reviewed predecessor event",
});

function snapshotFixture({ rows = [BASE_ROW], overrides = {} } = {}) {
  const descriptorCore = {
    main_source_commit_sha: MAIN_SOURCE_COMMIT_SHA,
    main_source_tree_sha: MAIN_SOURCE_TREE_SHA,
    source_manifest_sha256: SOURCE_MANIFEST_SHA256,
    catalog_sha256: CATALOG_SHA256,
    gate_inventory_sha256: GATE_INVENTORY_SHA256,
    privacy_secret_inventory_sha256: PRIVACY_INVENTORY_SHA256,
    checked_count: rows.length,
    rows,
  };
  return {
    schema_version: 2,
    main_source_commit_sha: MAIN_SOURCE_COMMIT_SHA,
    main_source_tree_sha: MAIN_SOURCE_TREE_SHA,
    source_manifest_sha256: SOURCE_MANIFEST_SHA256,
    database_clock: new Date(NOW - 1_000).toISOString(),
    sql_sha256: PREFLIGHT_SQL_SHA256,
    response_sha256: RESPONSE_SHA256,
    descriptor_sha256: sha256(canonicalJson(descriptorCore)),
    state_sha256: STATE_SHA256,
    catalog_sha256: CATALOG_SHA256,
    gate_inventory_sha256: GATE_INVENTORY_SHA256,
    privacy_secret_inventory_sha256: PRIVACY_INVENTORY_SHA256,
    checked_count: rows.length,
    rows,
    ...overrides,
  };
}

function rehashDescriptor(snapshot) {
  return {
    ...snapshot,
    descriptor_sha256: sha256(canonicalJson({
      main_source_commit_sha: snapshot.main_source_commit_sha,
      main_source_tree_sha: snapshot.main_source_tree_sha,
      source_manifest_sha256: snapshot.source_manifest_sha256,
      catalog_sha256: snapshot.catalog_sha256,
      gate_inventory_sha256: snapshot.gate_inventory_sha256,
      privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
      checked_count: snapshot.checked_count,
      rows: snapshot.rows,
    })),
  };
}

function bodyFixture({ action = "attest", snapshot = snapshotFixture(), command = null } = {}) {
  return {
    schema_version: 2,
    action,
    main_project_ref: MAIN_REF,
    finance_project_ref: FINANCE_REF,
    production_deny_project_refs: [MAIN_PRODUCTION_REF, FINANCE_PRODUCTION_REF],
    source_deployment_sha256: SOURCE_DEPLOYMENT_SHA256,
    snapshot,
    command,
  };
}

function operatorRequestMessage(timestamp, bodySha256) {
  return [
    "main-finance-access-v2-request",
    "POST",
    "/functions/v1/finance-manage-access-v2",
    timestamp,
    bodySha256,
  ].join("\n");
}

function requestFor(body, {
  url = EDGE_URL,
  method = "POST",
  headers = {},
  timestamp = String(NOW),
  signingBody = body,
  rawBody = method === "POST" ? canonicalJson(body) : undefined,
} = {}) {
  const signature = createHmac("sha256", OPERATOR_SECRET)
    .update(operatorRequestMessage(timestamp, sha256(canonicalJson(signingBody))))
    .digest("hex");
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      [OPERATOR_HEADER]: signature,
      [OPERATOR_TIMESTAMP_HEADER]: timestamp,
      ...headers,
    },
    body: rawBody,
  });
}

function environment(overrides = {}) {
  return {
    SUPABASE_URL: MAIN_ORIGIN,
    MAIN_FINANCE_ACCESS_V2_MODE: "enabled",
    MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256: SOURCE_DEPLOYMENT_SHA256,
    MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2: OPERATOR_SECRET,
    MAIN_FINANCE_PRIVACY_HMAC_KEY: PRIVACY_KEY,
    MAIN_FINANCE_SYNC_TRIGGER_SECRET: TRIGGER_SECRET,
    MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA: MAIN_SOURCE_COMMIT_SHA,
    MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA: MAIN_SOURCE_TREE_SHA,
    MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256: SOURCE_MANIFEST_SHA256,
    MAIN_FINANCE_ACCESS_V2_PREFLIGHT_SQL_SHA256: PREFLIGHT_SQL_SHA256,
    MAIN_FINANCE_ACCESS_V2_CATALOG_SHA256: CATALOG_SHA256,
    MAIN_FINANCE_ACCESS_V2_GATE_INVENTORY_SHA256: GATE_INVENTORY_SHA256,
    MAIN_FINANCE_ACCESS_V2_PRIVACY_INVENTORY_SHA256: PRIVACY_INVENTORY_SHA256,
    MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
      `https://${FINANCE_REF}.supabase.co/functions/v1/finance-apply-entitlement-event-v2`,
    MAIN_FINANCE_ENTITLEMENT_CANONICAL_PATH:
      "/functions/v1/finance-apply-entitlement-event-v2",
    MAIN_FINANCE_PRODUCT_CODE: "architecture_finance",
    MAIN_FINANCE_SYNC_MODE: "enabled",
    ...overrides,
  };
}

function dependencies({
  values = environment(),
  rpc,
  dispatch,
  reads = [],
  now = () => NOW,
} = {}) {
  return {
    env(name) {
      reads.push(name);
      return values[name];
    },
    rpc,
    dispatch,
    now,
  };
}

function statusFixture({
  userId = USER_ID,
  eventId = CURRENT_EVENT_ID,
  version = "7",
  desiredState = "granted",
  state = "applied",
  event = undefined,
} = {}) {
  return {
    ok: true,
    main_user_id: userId,
    current_version: version,
    desired_state: desiredState,
    applied_version: version,
    applied_state: desiredState,
    event: event === undefined ? {
      event_id: eventId,
      version,
      desired_state: desiredState,
      state,
    } : event,
  };
}

function replayFixture(row = BASE_ROW) {
  return {
    ok: true,
    replayed: true,
    event_id: row.event_id,
    version: row.version,
    state: row.event_state,
  };
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

function attestRpc({
  status = statusFixture(),
  replay = replayFixture(),
  telegramId = TELEGRAM_ID,
  calls = [],
} = {}) {
  return async (name, body) => {
    calls.push({ name, body });
    if (name === "architecture_get_finance_access_status_internal") return status;
    if (name === "architecture_resolve_finance_subject_internal") {
      return { ok: true, main_user_id: USER_ID, telegram_id: telegramId };
    }
    if (name === "architecture_set_finance_access_desired_internal") return replay;
    throw new Error(`unexpected RPC ${name}`);
  };
}

async function successfulAttestation({
  snapshot = snapshotFixture(),
  rpc,
  calls = [],
  url = EDGE_URL,
} = {}) {
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ snapshot }), { url }),
    dependencies({ rpc: rpc ?? attestRpc({ calls }) }),
  );
  assert.equal(response.status, 200);
  const value = await responseJson(response);
  assert.equal(value.ok, true);
  assert.equal(value.provided_descriptor_replayed, true);
  assert.equal(value.checked_count, snapshot.checked_count);
  assert.equal(value.mismatch_count, 0);
  assert.match(value.attestation_proof, /^[1-9][0-9]{12}\.[0-9a-f]{64}$/u);
  return { value, calls };
}

function planCommand({
  action,
  snapshot,
  attestationProof,
  eventId = NEW_EVENT_ID,
  userId = USER_ID,
  currentEventId = CURRENT_EVENT_ID,
  expectedVersion = "7",
  actor = "operator:fixture",
  dispatch = true,
  postSnapshot = snapshotFixture({
    rows: snapshot.rows,
    overrides: {
      database_clock: new Date(NOW + 100).toISOString(),
      response_sha256: "99".repeat(32),
      state_sha256: snapshot.state_sha256,
      gate_inventory_sha256: snapshot.gate_inventory_sha256,
      privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    },
  }),
  postSnapshotSha256 = postSnapshot.state_sha256,
  approvalExpiresAt = new Date(NOW + 10 * 60 * 1_000).toISOString(),
  postDatabaseClock = postSnapshot.database_clock,
  postResponseSha256 = postSnapshot.response_sha256,
} = {}) {
  const core = {
    schema_version: 2,
    action,
    main_project_ref: MAIN_REF,
    finance_project_ref: FINANCE_REF,
    source_deployment_sha256: SOURCE_DEPLOYMENT_SHA256,
    pre_database_clock: snapshot.database_clock,
    pre_response_sha256: snapshot.response_sha256,
    descriptor_sha256: snapshot.descriptor_sha256,
    catalog_sha256: snapshot.catalog_sha256,
    gate_inventory_sha256: snapshot.gate_inventory_sha256,
    privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    main_source_commit_sha: snapshot.main_source_commit_sha,
    main_source_tree_sha: snapshot.main_source_tree_sha,
    source_manifest_sha256: snapshot.source_manifest_sha256,
    state_sha256: snapshot.state_sha256,
    checked_count: snapshot.checked_count,
    event_id: eventId,
    main_user_id: userId,
    current_event_id: currentEventId,
    expected_version: expectedVersion,
    changed_by: actor,
    dispatch,
    attestation_proof: attestationProof,
    approval_expires_at: approvalExpiresAt,
    post_database_clock: postDatabaseClock,
    post_response_sha256: postResponseSha256,
    post_snapshot_sha256: postSnapshotSha256,
  };
  const planSha256 = sha256(canonicalJson(core));
  return {
    event_id: eventId,
    main_user_id: userId,
    current_event_id: currentEventId,
    expected_version: expectedVersion,
    changed_by: actor,
    change_reason: `main_finance_runtime_recovery_v2_plan:${planSha256}`,
    dispatch,
    attestation_proof: attestationProof,
    plan_sha256: planSha256,
    approval_expires_at: approvalExpiresAt,
    post_database_clock: postDatabaseClock,
    post_response_sha256: postResponseSha256,
    post_snapshot_sha256: postSnapshotSha256,
    post_snapshot: postSnapshot,
  };
}

function originalPlanFixture(action, snapshot, command) {
  return {
    schema_version: 2,
    action,
    main_project_ref: MAIN_REF,
    finance_project_ref: FINANCE_REF,
    source_deployment_sha256: SOURCE_DEPLOYMENT_SHA256,
    pre_database_clock: snapshot.database_clock,
    pre_response_sha256: snapshot.response_sha256,
    descriptor_sha256: snapshot.descriptor_sha256,
    catalog_sha256: snapshot.catalog_sha256,
    gate_inventory_sha256: snapshot.gate_inventory_sha256,
    privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    main_source_commit_sha: snapshot.main_source_commit_sha,
    main_source_tree_sha: snapshot.main_source_tree_sha,
    source_manifest_sha256: snapshot.source_manifest_sha256,
    state_sha256: snapshot.state_sha256,
    checked_count: snapshot.checked_count,
    event_id: command.event_id,
    main_user_id: command.main_user_id,
    current_event_id: command.current_event_id,
    expected_version: command.expected_version,
    changed_by: command.changed_by,
    dispatch: command.dispatch,
    attestation_proof: command.attestation_proof,
    approval_expires_at: command.approval_expires_at,
    post_database_clock: command.post_database_clock,
    post_response_sha256: command.post_response_sha256,
    post_snapshot_sha256: command.post_snapshot_sha256,
  };
}

function reconcileCommandFixture(originalPlan, snapshot, {
  expiresAt = new Date(NOW + 10 * 60 * 1_000).toISOString(),
} = {}) {
  const originalPlanSha256 = sha256(canonicalJson(originalPlan));
  const core = {
    schema_version: 2,
    kind: "main-finance-access-v2-reconcile",
    main_project_ref: MAIN_REF,
    finance_project_ref: FINANCE_REF,
    source_deployment_sha256: SOURCE_DEPLOYMENT_SHA256,
    original_plan_sha256: originalPlanSha256,
    d1_database_clock: snapshot.database_clock,
    d1_response_sha256: snapshot.response_sha256,
    d1_descriptor_sha256: snapshot.descriptor_sha256,
    d1_state_sha256: snapshot.state_sha256,
    d1_catalog_sha256: snapshot.catalog_sha256,
    d1_gate_inventory_sha256: snapshot.gate_inventory_sha256,
    d1_privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    reconcile_approval_expires_at: expiresAt,
  };
  return {
    original_plan: originalPlan,
    original_plan_sha256: originalPlanSha256,
    reconcile_approval_expires_at: expiresAt,
    reconcile_sha256: sha256(canonicalJson(core)),
  };
}

test("compiled staging boundary rejects production refs and hosts before secrets or RPC", async () => {
  for (const body of [
    { ...bodyFixture(), main_project_ref: MAIN_PRODUCTION_REF },
    { ...bodyFixture(), finance_project_ref: FINANCE_PRODUCTION_REF },
  ]) {
    const reads = [];
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(body),
      dependencies({
        reads,
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run");
        },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(reads.some((name) => /SECRET|HMAC|PRIVACY|TRIGGER/u.test(name)), false);
    assert.equal(rpcCalls, 0);
  }

  const reads = [];
  let rpcCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture()),
    dependencies({
      values: environment({ SUPABASE_URL: `https://${MAIN_PRODUCTION_REF}.supabase.co` }),
      reads,
      rpc: async () => {
        rpcCalls += 1;
        throw new Error("RPC must not run");
      },
    }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(reads, ["SUPABASE_URL"]);
  assert.equal(rpcCalls, 0);
});

test("private route rejects browser, query and fragment context without RPC", async () => {
  const cases = [
    { url: `${EDGE_URL}?action=attest` },
    { url: `${EDGE_URL}#attacker` },
    { headers: { Origin: "https://attacker.example" } },
    { headers: { Cookie: "session=ambient" } },
    { headers: { Authorization: "Bearer ambient" } },
    { headers: { "Access-Control-Request-Method": "POST" } },
    { headers: { "Access-Control-Request-Headers": OPERATOR_HEADER } },
  ];
  for (const options of cases) {
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture(), options),
      dependencies({
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run");
        },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(rpcCalls, 0);
  }
});

test("private route accepts only the public and Supabase runtime canonical paths", async () => {
  for (const url of [
    EDGE_URL,
    `${MAIN_ORIGIN}/finance-manage-access-v2`,
  ]) {
    const calls = [];
    const { value } = await successfulAttestation({ url, calls });
    assert.equal(value.ok, true);
    assert.ok(calls.length > 0);
  }

  for (const url of [
    `${MAIN_ORIGIN}/finance-manage-access-v2/`,
    `${MAIN_ORIGIN}/finance-manage-access-v2/extra`,
    `${MAIN_ORIGIN}/functions/v1/wrong`,
    `${MAIN_ORIGIN}/functions/v1/finance-manage-access-v2%2fextra`,
    `${MAIN_ORIGIN}/`,
  ]) {
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture(), { url, method: "GET" }),
      dependencies({
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run");
        },
      }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "invalid_request" });
    assert.equal(rpcCalls, 0);
  }
});

test("operator authentication is constant-time shaped and never reads privacy on failure", async () => {
  const reads = [];
  let rpcCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture(), { headers: { [OPERATOR_HEADER]: "x".repeat(48) } }),
    dependencies({
      reads,
      rpc: async () => {
        rpcCalls += 1;
        throw new Error("RPC must not run");
      },
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(rpcCalls, 0);
  assert.equal(reads.includes("MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2"), true);
  assert.equal(reads.includes("MAIN_FINANCE_PRIVACY_HMAC_KEY"), false);
  assert.match(
    EDGE_SOURCE,
    /hmacSha256Hex\([\s\S]*operatorRequestMessage\([\s\S]*constantTimeHexEqual/,
  );
  assert.doesNotMatch(EDGE_SOURCE, /console\.(?:log|info|warn|error)/u);
});

test("operator HMAC binds the canonical body and an exact fresh millisecond timestamp", async () => {
  const original = bodyFixture();
  const tampered = bodyFixture({
    snapshot: snapshotFixture({
      overrides: { database_clock: new Date(NOW - 2_000).toISOString() },
    }),
  });
  const valid = requestFor(original);
  assert.match(valid.headers.get(OPERATOR_HEADER), /^[0-9a-f]{64}$/u);
  assert.notEqual(valid.headers.get(OPERATOR_HEADER), OPERATOR_SECRET);
  assert.equal(valid.headers.get(OPERATOR_TIMESTAMP_HEADER), String(NOW));

  for (const request of [
    requestFor(original, { timestamp: String(NOW - 60_001) }),
    requestFor(tampered, { signingBody: original }),
  ]) {
    const reads = [];
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      request,
      dependencies({
        reads,
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run");
        },
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(rpcCalls, 0);
    assert.equal(reads.includes("MAIN_FINANCE_PRIVACY_HMAC_KEY"), false);
  }
});

test("zero, incomplete, duplicate and forged descriptors fail before any RPC", async () => {
  const otherRow = {
    ...BASE_ROW,
    main_user_id: OTHER_USER_ID,
    event_id: OTHER_EVENT_ID,
  };
  const cases = [
    snapshotFixture({ rows: [], overrides: { checked_count: 0 } }),
    snapshotFixture({ overrides: { checked_count: 2 } }),
    snapshotFixture({ rows: [BASE_ROW, BASE_ROW] }),
    snapshotFixture({ rows: [otherRow, BASE_ROW] }),
    snapshotFixture({ overrides: { descriptor_sha256: "00".repeat(32) } }),
    snapshotFixture({ overrides: { database_clock: new Date(NOW - 6 * 60 * 1_000).toISOString() } }),
  ];
  for (const snapshot of cases) {
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ snapshot })),
      dependencies({
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run");
        },
      }),
    );
    assert.equal(response.status, 409);
    assert.equal(rpcCalls, 0);
  }
});

test("nonterminal descriptor rows are reconcile-only and normal attestation writes nothing", async () => {
  const snapshots = [
    snapshotFixture({
      rows: [{ ...BASE_ROW, event_state: "pending" }],
    }),
    snapshotFixture({
      rows: [{ ...BASE_ROW, applied_version: "6" }],
    }),
  ];
  for (const snapshot of snapshots) {
    let rpcCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ snapshot })),
      dependencies({
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("normal attestation must reject before RPC");
        },
      }),
    );
    assert.equal(response.status, 409);
    assert.equal(rpcCalls, 0);
  }
});

test("database and approval timestamps must be canonical UTC milliseconds", async () => {
  const noncanonicalSnapshot = snapshotFixture({
    overrides: { database_clock: "2026-08-14T04:00:00Z" },
  });
  const snapshotResponse = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ snapshot: noncanonicalSnapshot })),
    dependencies({ rpc: async () => { throw new Error("RPC must not run"); } }),
  );
  assert.equal(snapshotResponse.status, 409);

  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  for (const timestamps of [
    { approvalExpiresAt: "2026-08-14T04:10:00Z" },
    { postDatabaseClock: "2026-08-14T03:59:59.5Z" },
    { approvalExpiresAt: "2026-08-14 04:10:00.000Z" },
  ]) {
    const command = planCommand({
      action: "revoke",
      snapshot,
      attestationProof: attested.attestation_proof,
      ...timestamps,
    });
    const calls = [];
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({ rpc: attestRpc({ calls }) }),
    );
    assert.equal(response.status, 409);
    assert.equal(calls.some((call) => call.body?.p_event_id === NEW_EVENT_ID), false);
  }
});

test("null or mismatched current event prevents every resolver, setter and dispatch", async () => {
  for (const event of [
    null,
    {
      event_id: OTHER_EVENT_ID,
      version: "7",
      desired_state: "granted",
      state: "applied",
    },
  ]) {
    const calls = [];
    let dispatchCalls = 0;
    const rpc = async (name, body) => {
      calls.push({ name, body });
      if (name === "architecture_get_finance_access_status_internal") {
        return statusFixture({ event });
      }
      throw new Error("no RPC after rejected status");
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture()),
      dependencies({
        rpc,
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("dispatch must not run");
        },
      }),
    );
    assert.equal(response.status, 409);
    assert.deepEqual(calls.map((call) => call.name), [
      "architecture_get_finance_access_status_internal",
    ]);
    assert.equal(dispatchCalls, 0);
  }
});

test("exact legacy subject replay is non-mutating and returns only aggregate proof", async () => {
  const calls = [];
  const { value } = await successfulAttestation({ calls });
  assert.deepEqual(calls.map((call) => call.name), [
    "architecture_get_finance_access_status_internal",
    "architecture_get_finance_access_status_internal",
    "architecture_resolve_finance_subject_internal",
    "architecture_set_finance_access_desired_internal",
    "architecture_get_finance_access_status_internal",
  ]);
  const setter = calls.find((call) =>
    call.name === "architecture_set_finance_access_desired_internal");
  const expectedDigest = createHmac("sha256", PRIVACY_KEY)
    .update(`main-telegram-subject-v1\n${TELEGRAM_ID}`)
    .digest("hex");
  assert.deepEqual(setter.body, {
    p_event_id: CURRENT_EVENT_ID,
    p_main_user_id: USER_ID,
    p_subject_digest: `\\x${expectedDigest}`,
    p_desired_state: "granted",
    p_changed_by: BASE_ROW.changed_by,
    p_change_reason: BASE_ROW.change_reason,
    p_expected_version: "6",
  });
  assert.equal(value.checked_count, 1);
  assert.equal(value.mismatch_count, 0);
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    TELEGRAM_ID,
    expectedDigest,
    OPERATOR_SECRET,
    PRIVACY_KEY,
    TRIGGER_SECRET,
    "telegram_id",
    "subject_digest",
  ]) assert.equal(serialized.includes(forbidden), false);
});

test("wrong privacy derivation, actor or reason produces conflict and no new event write", async () => {
  for (const variant of ["privacy", "actor", "reason"]) {
    const calls = [];
    const row = {
      ...BASE_ROW,
      ...(variant === "actor" ? { changed_by: "operator:wrong" } : {}),
      ...(variant === "reason" ? { change_reason: "wrong historical bytes" } : {}),
    };
    const snapshot = snapshotFixture({ rows: [row] });
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ snapshot })),
      dependencies({
        values: environment(variant === "privacy"
          ? { MAIN_FINANCE_PRIVACY_HMAC_KEY: `${PRIVACY_KEY}-wrong` }
          : {}),
        rpc: attestRpc({
          calls,
          replay: { ok: false, error: "idempotency_conflict" },
        }),
      }),
    );
    assert.equal(response.status, 409);
    assert.equal(
      calls.filter((call) =>
        call.name === "architecture_set_finance_access_desired_internal").length,
      1,
    );
    assert.equal(calls.some((call) => call.body?.p_event_id === NEW_EVENT_ID), false);
  }
});

test("normal mutation route rejects stale same-event plans and changed payloads", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const exact = planCommand({
    action: "grant",
    snapshot,
    attestationProof: attested.attestation_proof,
    eventId: CURRENT_EVENT_ID,
    actor: BASE_ROW.changed_by,
  });
  // Same-event replay is only valid when its original reason was the exact
  // immutable plan reason. Build a descriptor from those bytes.
  const replayRow = { ...BASE_ROW, change_reason: exact.change_reason };
  const replaySnapshot = snapshotFixture({ rows: [replayRow] });
  const replayAttestation = await successfulAttestation({ snapshot: replaySnapshot });
  const replayCommand = planCommand({
    action: "grant",
    snapshot: replaySnapshot,
    attestationProof: replayAttestation.value.attestation_proof,
    eventId: CURRENT_EVENT_ID,
    actor: BASE_ROW.changed_by,
  });
  const calls = [];
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "grant",
      snapshot: replaySnapshot,
      command: replayCommand,
    })),
    dependencies({ rpc: attestRpc({ calls, replay: replayFixture(replayRow) }) }),
  );
  // A committed event is reconciled through the dedicated original-plan route,
  // never by silently regenerating a different D1 mutation plan.
  assert.equal(response.status, 409);
  assert.equal(calls.every((call) => call.body?.p_event_id !== NEW_EVENT_ID), true);

  const changed = { ...replayCommand, change_reason: "changed payload" };
  const changedResponse = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "grant",
      snapshot: replaySnapshot,
      command: changed,
    })),
    dependencies({ rpc: attestRpc() }),
  );
  assert.equal(changedResponse.status, 409);
});

test("dedicated reconciliation replays one exact present event and never dispatches", async () => {
  const d0 = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot: d0 });
  const originalCommand = planCommand({
    action: "revoke",
    snapshot: d0,
    attestationProof: attested.attestation_proof,
    dispatch: true,
  });
  const originalPlan = originalPlanFixture("revoke", d0, originalCommand);
  assert.equal(sha256(canonicalJson(originalPlan)), originalCommand.plan_sha256);
  const recoveryRow = {
    ...BASE_ROW,
    event_id: NEW_EVENT_ID,
    desired_state: "revoked",
    version: "8",
    applied_state: "revoked",
    applied_version: "8",
    event_state: "applied",
    changed_by: originalCommand.changed_by,
    change_reason: `main_finance_runtime_recovery_v2_plan:${originalCommand.plan_sha256}`,
  };
  const recoverySnapshot = snapshotFixture({
    rows: [recoveryRow],
    overrides: {
      database_clock: new Date(NOW + 200).toISOString(),
      response_sha256: "ba".repeat(32),
      state_sha256: "bc".repeat(32),
    },
  });
  const command = reconcileCommandFixture(originalPlan, recoverySnapshot);
  const current = {
    ok: true,
    main_user_id: USER_ID,
    current_version: "8",
    desired_state: "revoked",
    applied_version: "8",
    applied_state: "revoked",
    event: {
      event_id: NEW_EVENT_ID,
      version: "8",
      desired_state: "revoked",
      state: "applied",
    },
  };
  const calls = [];
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "reconcile",
      snapshot: recoverySnapshot,
      command,
    })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        if (name === "architecture_get_finance_access_status_internal") return current;
        if (name === "architecture_resolve_finance_subject_internal") {
          return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
        }
        if (name === "architecture_set_finance_access_desired_internal") {
          assert.equal(body.p_event_id, NEW_EVENT_ID);
          assert.equal(body.p_expected_version, "7");
          return {
            ok: true,
            replayed: true,
            event_id: NEW_EVENT_ID,
            version: "8",
            state: "applied",
          };
        }
        throw new Error(`unexpected ${name}`);
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("reconcile must never dispatch");
      },
    }),
  );
  assert.equal(response.status, 200);
  const value = await responseJson(response);
  assert.equal(value.action, "reconcile");
  assert.equal(value.replayed, true);
  assert.equal(value.dispatch_performed, false);
  assert.equal(dispatchCalls, 0);
  assert.equal(
    calls.filter((call) =>
      call.name === "architecture_set_finance_access_desired_internal").length,
    1,
  );
  assert.equal(JSON.stringify(value).includes(TELEGRAM_ID), false);
});

test("reconciliation of a present non-applied event is an exact manual-recovery no-go", async () => {
  const d0 = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot: d0 });
  const originalCommand = planCommand({
    action: "revoke",
    snapshot: d0,
    attestationProof: attested.attestation_proof,
  });
  const originalPlan = originalPlanFixture("revoke", d0, originalCommand);
  const pendingRow = {
    ...BASE_ROW,
    event_id: NEW_EVENT_ID,
    desired_state: "revoked",
    version: "8",
    applied_state: "granted",
    applied_version: "7",
    event_state: "pending",
    changed_by: originalCommand.changed_by,
    change_reason: `main_finance_runtime_recovery_v2_plan:${originalCommand.plan_sha256}`,
  };
  const recoverySnapshot = snapshotFixture({
    rows: [pendingRow],
    overrides: {
      database_clock: new Date(NOW + 200).toISOString(),
      response_sha256: "bd".repeat(32),
      state_sha256: "be".repeat(32),
    },
  });
  const current = {
    ok: true,
    main_user_id: USER_ID,
    current_version: "8",
    desired_state: "revoked",
    applied_version: "7",
    applied_state: "granted",
    event: {
      event_id: NEW_EVENT_ID,
      version: "8",
      desired_state: "revoked",
      state: "pending",
    },
  };
  const calls = [];
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "reconcile",
      snapshot: recoverySnapshot,
      command: reconcileCommandFixture(originalPlan, recoverySnapshot),
    })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        if (name === "architecture_get_finance_access_status_internal") return current;
        if (name === "architecture_resolve_finance_subject_internal") {
          return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
        }
        if (name === "architecture_set_finance_access_desired_internal") {
          return {
            ok: true,
            replayed: true,
            event_id: NEW_EVENT_ID,
            version: "8",
            state: "pending",
          };
        }
        throw new Error(`unexpected ${name}`);
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("reconcile must never dispatch");
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await responseJson(response), {
    ok: false,
    error: "access_not_applied",
    reconcile_required: false,
    manual_recovery_required: true,
    dispatch_performed: false,
  });
  assert.equal(
    calls.filter((call) =>
      call.name === "architecture_set_finance_access_desired_internal").length,
    1,
  );
  assert.equal(dispatchCalls, 0);
});

test("reconcile approval is rechecked immediately before its exact replay setter", async () => {
  const d0 = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot: d0 });
  const originalCommand = planCommand({
    action: "revoke",
    snapshot: d0,
    attestationProof: attested.attestation_proof,
  });
  const originalPlan = originalPlanFixture("revoke", d0, originalCommand);
  const pendingRow = {
    ...BASE_ROW,
    event_id: NEW_EVENT_ID,
    desired_state: "revoked",
    version: "8",
    applied_state: "granted",
    applied_version: "7",
    event_state: "pending",
    changed_by: originalCommand.changed_by,
    change_reason: `main_finance_runtime_recovery_v2_plan:${originalCommand.plan_sha256}`,
  };
  const recoverySnapshot = snapshotFixture({
    rows: [pendingRow],
    overrides: {
      database_clock: new Date(NOW + 200).toISOString(),
      response_sha256: "bf".repeat(32),
      state_sha256: "c0".repeat(32),
    },
  });
  const expiresAt = new Date(NOW + 30_000).toISOString();
  const current = {
    ok: true,
    main_user_id: USER_ID,
    current_version: "8",
    desired_state: "revoked",
    applied_version: "7",
    applied_state: "granted",
    event: {
      event_id: NEW_EVENT_ID,
      version: "8",
      desired_state: "revoked",
      state: "pending",
    },
  };
  const calls = [];
  let clockReads = 0;
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "reconcile",
      snapshot: recoverySnapshot,
      command: reconcileCommandFixture(originalPlan, recoverySnapshot, { expiresAt }),
    })),
    dependencies({
      now: () => {
        clockReads += 1;
        return clockReads < 3 ? NOW : NOW + 30_000;
      },
      rpc: async (name, body) => {
        calls.push({ name, body });
        if (name === "architecture_get_finance_access_status_internal") return current;
        if (name === "architecture_resolve_finance_subject_internal") {
          return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
        }
        if (name === "architecture_set_finance_access_desired_internal") {
          throw new Error("reconcile setter must not run after live expiry");
        }
        throw new Error(`unexpected ${name}`);
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("reconcile must never dispatch");
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.equal((await responseJson(response)).error, "attestation_failed");
  assert.equal(clockReads, 3);
  assert.equal(
    calls.some((call) => call.name === "architecture_set_finance_access_desired_internal"),
    false,
  );
  assert.equal(dispatchCalls, 0);
});

test("reconciliation with absent event is status-only and cannot retry the setter", async () => {
  const d0 = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot: d0 });
  const originalCommand = planCommand({
    action: "revoke",
    snapshot: d0,
    attestationProof: attested.attestation_proof,
  });
  const originalPlan = originalPlanFixture("revoke", d0, originalCommand);
  const command = reconcileCommandFixture(originalPlan, d0);
  const calls = [];
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ action: "reconcile", snapshot: d0, command })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        return statusFixture({ event: null });
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("dispatch must not run");
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await responseJson(response), {
    ok: false,
    error: "reconcile_event_absent",
    reconcile_required: true,
    dispatch_performed: false,
  });
  assert.deepEqual(calls.map((call) => call.name), [
    "architecture_get_finance_access_status_internal",
  ]);
  assert.equal(dispatchCalls, 0);
});

test("reconciliation rejects changed plan, D1, expiry and non-replay outcomes", async () => {
  const d0 = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot: d0 });
  const originalCommand = planCommand({
    action: "revoke",
    snapshot: d0,
    attestationProof: attested.attestation_proof,
  });
  const originalPlan = originalPlanFixture("revoke", d0, originalCommand);
  const exactReason = `main_finance_runtime_recovery_v2_plan:${originalCommand.plan_sha256}`;
  const recoveryRow = {
    ...BASE_ROW,
    event_id: NEW_EVENT_ID,
    desired_state: "revoked",
    version: "8",
    applied_state: "granted",
    applied_version: "7",
    event_state: "pending",
    changed_by: originalCommand.changed_by,
    change_reason: exactReason,
  };
  const exactSnapshot = snapshotFixture({
    rows: [recoveryRow],
    overrides: {
      database_clock: new Date(NOW + 200).toISOString(),
      response_sha256: "ca".repeat(32),
      state_sha256: "cb".repeat(32),
    },
  });
  const current = {
    ok: true,
    main_user_id: USER_ID,
    current_version: "8",
    desired_state: "revoked",
    applied_version: "7",
    applied_state: "granted",
    event: {
      event_id: NEW_EVENT_ID,
      version: "8",
      desired_state: "revoked",
      state: "pending",
    },
  };

  const changedReasonSnapshot = snapshotFixture({
    rows: [{ ...recoveryRow, change_reason: "changed D1 reason" }],
    overrides: {
      database_clock: new Date(NOW + 200).toISOString(),
      response_sha256: "cc".repeat(32),
      state_sha256: "cd".repeat(32),
    },
  });
  const selfConsistentWrongAction = { ...originalPlan, action: "grant" };
  const selfConsistentWrongUser = { ...originalPlan, main_user_id: OTHER_USER_ID };
  const selfConsistentWrongActor = { ...originalPlan, changed_by: "operator:changed" };
  const cases = [
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(selfConsistentWrongAction, exactSnapshot),
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(selfConsistentWrongUser, exactSnapshot),
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(selfConsistentWrongActor, exactSnapshot),
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: {
        ...reconcileCommandFixture(originalPlan, exactSnapshot),
        original_plan_sha256: "00".repeat(32),
      },
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: {
        ...reconcileCommandFixture(originalPlan, exactSnapshot),
        reconcile_sha256: "ff".repeat(32),
      },
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(originalPlan, exactSnapshot, {
        expiresAt: new Date(NOW - 1).toISOString(),
      }),
      setter: "none",
    },
    {
      snapshot: changedReasonSnapshot,
      command: reconcileCommandFixture(originalPlan, changedReasonSnapshot),
      setter: "none",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(originalPlan, exactSnapshot),
      setter: "not_replay",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(originalPlan, exactSnapshot),
      setter: "unknown",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(originalPlan, exactSnapshot),
      setter: "status_unknown",
    },
    {
      snapshot: exactSnapshot,
      command: reconcileCommandFixture(originalPlan, exactSnapshot),
      setter: "post_status_unknown",
    },
  ];

  for (const fixture of cases) {
    const calls = [];
    let dispatchCalls = 0;
    let statusReads = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({
        action: "reconcile",
        snapshot: fixture.snapshot,
        command: fixture.command,
      })),
      dependencies({
        rpc: async (name, body) => {
          calls.push({ name, body });
          if (name === "architecture_get_finance_access_status_internal") {
            statusReads += 1;
            if (fixture.setter === "status_unknown") throw new Error("unknown status");
            if (fixture.setter === "post_status_unknown" && statusReads === 3) {
              throw new Error("unknown post-replay status");
            }
            return current;
          }
          if (name === "architecture_resolve_finance_subject_internal") {
            return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
          }
          if (name === "architecture_set_finance_access_desired_internal") {
            if (fixture.setter === "unknown") throw new Error("unknown replay");
            if (fixture.setter === "post_status_unknown") {
              return {
                ok: true,
                replayed: true,
                event_id: NEW_EVENT_ID,
                version: "8",
                state: "pending",
              };
            }
            if (fixture.setter === "not_replay") {
              return {
                ok: true,
                replayed: false,
                event_id: NEW_EVENT_ID,
                version: "8",
                state: "pending",
              };
            }
            throw new Error("setter must not run");
          }
          throw new Error(`unexpected ${name}`);
        },
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("reconcile must not dispatch");
        },
      }),
    );
    assert.notEqual(response.status, 200);
    assert.equal(dispatchCalls, 0);
    const setters = calls.filter((call) =>
      call.name === "architecture_set_finance_access_desired_internal");
    assert.equal(setters.length <= 1, true);
    if (fixture.setter === "none" || fixture.setter === "status_unknown") {
      assert.equal(setters.length, 0);
    }
  }
});

test("every mutation-plan field and the exact reason are hash-bound", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
  });
  const tamperedCommands = [
    { ...command, event_id: "20000000-0000-4000-8000-000000000002" },
    { ...command, main_user_id: OTHER_USER_ID },
    { ...command, current_event_id: OTHER_EVENT_ID },
    { ...command, expected_version: "8" },
    { ...command, changed_by: "operator:attacker" },
    { ...command, change_reason: "not the exact plan hash" },
    { ...command, dispatch: false },
    { ...command, attestation_proof: command.attestation_proof.replace(/.$/u, "0") },
    { ...command, plan_sha256: "00".repeat(32) },
    { ...command, approval_expires_at: new Date(NOW + 11 * 60 * 1_000).toISOString() },
    { ...command, post_database_clock: new Date(NOW - 250).toISOString() },
    { ...command, post_response_sha256: "aa".repeat(32) },
    { ...command, post_snapshot_sha256: "bb".repeat(32) },
  ];
  for (const tampered of tamperedCommands) {
    const calls = [];
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command: tampered })),
      dependencies({ rpc: attestRpc({ calls }) }),
    );
    assert.equal(response.status, tampered.dispatch === false ? 400 : 409);
    assert.equal(
      calls.some((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id !== CURRENT_EVENT_ID),
      false,
    );
  }
});

test("grant, revoke and reconciled original plans require dispatch true before writes", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  for (const action of ["grant", "revoke"]) {
    let rpcCalls = 0;
    let dispatchCalls = 0;
    const command = planCommand({
      action,
      snapshot,
      attestationProof: attested.attestation_proof,
      dispatch: false,
    });
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action, snapshot, command })),
      dependencies({
        rpc: async () => {
          rpcCalls += 1;
          throw new Error("RPC must not run for dispatch false");
        },
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("dispatch must not run for dispatch false");
        },
      }),
    );
    assert.equal(response.status, 400);
    assert.equal(rpcCalls, 0);
    assert.equal(dispatchCalls, 0);
  }

  const originalCommand = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
    dispatch: false,
  });
  const originalPlan = originalPlanFixture("revoke", snapshot, originalCommand);
  let reconcileRpcCalls = 0;
  let reconcileDispatchCalls = 0;
  const reconcileResponse = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "reconcile",
      snapshot,
      command: reconcileCommandFixture(originalPlan, snapshot),
    })),
    dependencies({
      rpc: async () => {
        reconcileRpcCalls += 1;
        throw new Error("reconcile RPC must not run for original dispatch false");
      },
      dispatch: async () => {
        reconcileDispatchCalls += 1;
        throw new Error("reconcile dispatch must not run");
      },
    }),
  );
  assert.equal(reconcileResponse.status, 409);
  assert.equal(reconcileRpcCalls, 0);
  assert.equal(reconcileDispatchCalls, 0);
});

test("D1 must be a newer generated snapshot with exact D0 rows, catalog and state", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const changedRow = { ...BASE_ROW, change_reason: "drift after D0" };
  const driftedSnapshots = [
    snapshotFixture({
      rows: [changedRow],
      overrides: {
        database_clock: new Date(NOW + 100).toISOString(),
        response_sha256: "90".repeat(32),
      },
    }),
    snapshotFixture({
      overrides: {
        database_clock: new Date(NOW + 100).toISOString(),
        response_sha256: "91".repeat(32),
        catalog_sha256: "aa".repeat(32),
      },
    }),
    snapshotFixture({
      overrides: {
        database_clock: new Date(NOW + 100).toISOString(),
        response_sha256: "92".repeat(32),
        state_sha256: "bb".repeat(32),
      },
    }),
    snapshotFixture({
      overrides: {
        database_clock: new Date(NOW + 100).toISOString(),
        response_sha256: "93".repeat(32),
        gate_inventory_sha256: "cc".repeat(32),
      },
    }),
    snapshotFixture({
      overrides: {
        database_clock: new Date(NOW + 100).toISOString(),
        response_sha256: "94".repeat(32),
        privacy_secret_inventory_sha256: "dd".repeat(32),
      },
    }),
  ].map(rehashDescriptor);
  for (const postSnapshot of driftedSnapshots) {
    const command = planCommand({
      action: "revoke",
      snapshot,
      postSnapshot,
      attestationProof: attested.attestation_proof,
    });
    const calls = [];
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({ rpc: attestRpc({ calls }) }),
    );
    assert.equal(response.status, 409);
    assert.equal(
      calls.some((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id === NEW_EVENT_ID),
      false,
    );
  }
});

test("valid new event repeats the target attestation immediately before its sole setter", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
  });
  const calls = [];
  let currentStatusReads = 0;
  let candidateStatusReads = 0;
  const rpc = async (name, body) => {
    calls.push({ name, body });
    if (name === "architecture_get_finance_access_status_internal") {
      if (body.p_event_id === CURRENT_EVENT_ID) {
        currentStatusReads += 1;
        return statusFixture();
      }
      candidateStatusReads += 1;
      if (candidateStatusReads === 1) return statusFixture({ event: null });
      return statusFixture({
        eventId: NEW_EVENT_ID,
        version: "8",
        desiredState: "revoked",
        state: "applied",
      });
    }
    if (name === "architecture_resolve_finance_subject_internal") {
      return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
    }
    if (name === "architecture_set_finance_access_desired_internal") {
      if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
      assert.equal(body.p_expected_version, "7");
      return {
        ok: true,
        replayed: false,
        event_id: NEW_EVENT_ID,
        version: "8",
        state: "pending",
      };
    }
    throw new Error(`unexpected RPC ${name}`);
  };
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ action: "revoke", snapshot, command })),
    dependencies({
      rpc,
      dispatch: async () => {
        dispatchCalls += 1;
        return { ok: true, claimed: 1, applied: 1, retried: 0, dead_lettered: 0 };
      },
    }),
  );
  assert.equal(response.status, 200);
  const value = await responseJson(response);
  assert.equal(value.replayed, false);
  assert.equal(value.event.event_id, NEW_EVENT_ID);
  assert.equal(currentStatusReads, 5);
  assert.equal(candidateStatusReads, 2);
  const setterIndexes = calls.flatMap((call, index) =>
    call.name === "architecture_set_finance_access_desired_internal" ? [index] : []);
  const newSetterIndex = setterIndexes.find((index) =>
    calls[index].body.p_event_id === NEW_EVENT_ID);
  assert.equal(Number.isInteger(newSetterIndex), true);
  assert.deepEqual(
    calls.slice(newSetterIndex - 5, newSetterIndex).map((call) => call.name),
    [
      "architecture_resolve_finance_subject_internal",
      "architecture_set_finance_access_desired_internal",
      "architecture_get_finance_access_status_internal",
      "architecture_get_finance_access_status_internal",
      "architecture_resolve_finance_subject_internal",
    ],
  );
  assert.equal(dispatchCalls, 1);
  assert.equal(
    calls.filter((call) =>
      call.name === "architecture_set_finance_access_desired_internal" &&
      call.body.p_event_id === NEW_EVENT_ID).length,
    1,
  );
});

test("existing-target resolver drift after final status blocks the new setter", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
  });
  const calls = [];
  let resolverReads = 0;
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ action: "revoke", snapshot, command })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        if (name === "architecture_get_finance_access_status_internal") {
          return body.p_event_id === NEW_EVENT_ID
            ? statusFixture({ event: null })
            : statusFixture();
        }
        if (name === "architecture_resolve_finance_subject_internal") {
          resolverReads += 1;
          return {
            ok: true,
            main_user_id: USER_ID,
            telegram_id: resolverReads < 3 ? TELEGRAM_ID : "9000000000000000099",
          };
        }
        if (name === "architecture_set_finance_access_desired_internal") {
          if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
          throw new Error("new setter must not run after resolver drift");
        }
        throw new Error(`unexpected ${name}`);
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("dispatch must not run after resolver drift");
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.equal((await responseJson(response)).error, "attestation_failed");
  assert.equal(resolverReads, 3);
  assert.equal(
    calls.some((call) =>
      call.name === "architecture_set_finance_access_desired_internal" &&
      call.body.p_event_id === NEW_EVENT_ID),
    false,
  );
  assert.equal(dispatchCalls, 0);
});

test("nonempty global attestation permits exactly one first grant at expected version zero", async () => {
  const existingRow = {
    ...BASE_ROW,
    main_user_id: OTHER_USER_ID,
    event_id: OTHER_EVENT_ID,
  };
  const snapshot = snapshotFixture({ rows: [existingRow] });
  const existingStatus = statusFixture({
    userId: OTHER_USER_ID,
    eventId: OTHER_EVENT_ID,
  });
  const attestationRpc = async (name) => {
    if (name === "architecture_get_finance_access_status_internal") return existingStatus;
    if (name === "architecture_resolve_finance_subject_internal") {
      return { ok: true, main_user_id: OTHER_USER_ID, telegram_id: "9000000000000000002" };
    }
    if (name === "architecture_set_finance_access_desired_internal") {
      return replayFixture(existingRow);
    }
    throw new Error(`unexpected ${name}`);
  };
  const { value: attested } = await successfulAttestation({
    snapshot,
    rpc: attestationRpc,
  });
  const command = planCommand({
    action: "grant",
    snapshot,
    attestationProof: attested.attestation_proof,
    currentEventId: null,
    expectedVersion: "0",
  });
  const calls = [];
  let targetReads = 0;
  const rpc = async (name, body) => {
    calls.push({ name, body });
    if (name === "architecture_get_finance_access_status_internal") {
      if (body.p_main_user_id === OTHER_USER_ID) return existingStatus;
      targetReads += 1;
      if (targetReads <= 2) {
        return statusFixture({
          userId: USER_ID,
          version: "0",
          desiredState: null,
          event: null,
        });
      }
      return statusFixture({
        userId: USER_ID,
        eventId: NEW_EVENT_ID,
        version: "1",
        desiredState: "granted",
        state: "applied",
      });
    }
    if (name === "architecture_resolve_finance_subject_internal") {
      return {
        ok: true,
        main_user_id: body.p_main_user_id,
        telegram_id: body.p_main_user_id === USER_ID
          ? TELEGRAM_ID
          : "9000000000000000002",
      };
    }
    if (name === "architecture_set_finance_access_desired_internal") {
      if (body.p_main_user_id === OTHER_USER_ID) return replayFixture(existingRow);
      assert.equal(body.p_event_id, NEW_EVENT_ID);
      assert.equal(body.p_expected_version, "0");
      return {
        ok: true,
        replayed: false,
        event_id: NEW_EVENT_ID,
        version: "1",
        state: "pending",
      };
    }
    throw new Error(`unexpected ${name}`);
  };
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ action: "grant", snapshot, command })),
    dependencies({
      rpc,
      dispatch: async () => {
        dispatchCalls += 1;
        return { ok: true, claimed: 1, applied: 1, retried: 0, dead_lettered: 0 };
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).event.event_id, NEW_EVENT_ID);
  assert.equal(
    calls.filter((call) => call.name === "architecture_set_finance_access_desired_internal" &&
      call.body.p_main_user_id === USER_ID).length,
    1,
  );
  assert.equal(targetReads, 3);
  assert.deepEqual(
    calls.filter((call) => call.body?.p_main_user_id === USER_ID)
      .map((call) => call.name),
    [
      "architecture_get_finance_access_status_internal",
      "architecture_resolve_finance_subject_internal",
      "architecture_get_finance_access_status_internal",
      "architecture_resolve_finance_subject_internal",
      "architecture_set_finance_access_desired_internal",
      "architecture_get_finance_access_status_internal",
    ],
  );
  assert.equal(dispatchCalls, 1);
});

test("first-grant resolver drift after final zero-state status blocks its setter", async () => {
  const existingRow = {
    ...BASE_ROW,
    main_user_id: OTHER_USER_ID,
    event_id: OTHER_EVENT_ID,
  };
  const snapshot = snapshotFixture({ rows: [existingRow] });
  const existingStatus = statusFixture({
    userId: OTHER_USER_ID,
    eventId: OTHER_EVENT_ID,
  });
  const { value: attested } = await successfulAttestation({
    snapshot,
    rpc: async (name) => {
      if (name === "architecture_get_finance_access_status_internal") return existingStatus;
      if (name === "architecture_resolve_finance_subject_internal") {
        return {
          ok: true,
          main_user_id: OTHER_USER_ID,
          telegram_id: "9000000000000000002",
        };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        return replayFixture(existingRow);
      }
      throw new Error(`unexpected ${name}`);
    },
  });
  const command = planCommand({
    action: "grant",
    snapshot,
    attestationProof: attested.attestation_proof,
    currentEventId: null,
    expectedVersion: "0",
  });
  const calls = [];
  let targetResolverReads = 0;
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({ action: "grant", snapshot, command })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        if (name === "architecture_get_finance_access_status_internal") {
          if (body.p_main_user_id === OTHER_USER_ID) return existingStatus;
          return statusFixture({
            userId: USER_ID,
            version: "0",
            desiredState: null,
            event: null,
          });
        }
        if (name === "architecture_resolve_finance_subject_internal") {
          if (body.p_main_user_id === OTHER_USER_ID) {
            return {
              ok: true,
              main_user_id: OTHER_USER_ID,
              telegram_id: "9000000000000000002",
            };
          }
          targetResolverReads += 1;
          return {
            ok: true,
            main_user_id: USER_ID,
            telegram_id: targetResolverReads === 1
              ? TELEGRAM_ID
              : "9000000000000000099",
          };
        }
        if (name === "architecture_set_finance_access_desired_internal") {
          if (body.p_main_user_id === OTHER_USER_ID) return replayFixture(existingRow);
          throw new Error("first-grant setter must not run after resolver drift");
        }
        throw new Error(`unexpected ${name}`);
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("dispatch must not run after resolver drift");
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.equal((await responseJson(response)).error, "attestation_failed");
  assert.equal(targetResolverReads, 2);
  assert.equal(
    calls.some((call) =>
      call.name === "architecture_set_finance_access_desired_internal" &&
      call.body.p_main_user_id === USER_ID),
    false,
  );
  assert.equal(dispatchCalls, 0);
});

test("first grant rejects omitted existing state, occupied event and resolver failure without a setter", async () => {
  const existingRow = {
    ...BASE_ROW,
    main_user_id: OTHER_USER_ID,
    event_id: OTHER_EVENT_ID,
  };
  const snapshot = snapshotFixture({ rows: [existingRow] });
  const existingStatus = statusFixture({
    userId: OTHER_USER_ID,
    eventId: OTHER_EVENT_ID,
  });
  const attestationRpc = async (name) => {
    if (name === "architecture_get_finance_access_status_internal") return existingStatus;
    if (name === "architecture_resolve_finance_subject_internal") {
      return { ok: true, main_user_id: OTHER_USER_ID, telegram_id: "9000000000000000002" };
    }
    if (name === "architecture_set_finance_access_desired_internal") {
      return replayFixture(existingRow);
    }
    throw new Error(`unexpected ${name}`);
  };
  const { value: attested } = await successfulAttestation({
    snapshot,
    rpc: attestationRpc,
  });
  const command = planCommand({
    action: "grant",
    snapshot,
    attestationProof: attested.attestation_proof,
    currentEventId: null,
    expectedVersion: "0",
  });
  const cases = [
    {
      label: "omitted existing target",
      targetStatus: statusFixture({
        userId: USER_ID,
        version: "1",
        desiredState: "granted",
        event: null,
      }),
      expectedStatus: 409,
      resolverFailure: false,
    },
    {
      label: "occupied candidate event",
      targetStatus: statusFixture({
        userId: USER_ID,
        eventId: NEW_EVENT_ID,
        version: "1",
        desiredState: "granted",
        state: "pending",
      }),
      expectedStatus: 409,
      resolverFailure: false,
    },
    {
      label: "resolver unavailable",
      targetStatus: statusFixture({
        userId: USER_ID,
        version: "0",
        desiredState: null,
        event: null,
      }),
      expectedStatus: 503,
      resolverFailure: true,
    },
  ];

  for (const fixture of cases) {
    const calls = [];
    const rpc = async (name, body) => {
      calls.push({ name, body });
      if (name === "architecture_get_finance_access_status_internal") {
        return body.p_main_user_id === OTHER_USER_ID
          ? existingStatus
          : fixture.targetStatus;
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        if (body.p_main_user_id === USER_ID && fixture.resolverFailure) {
          throw new Error("resolver unavailable");
        }
        return {
          ok: true,
          main_user_id: body.p_main_user_id,
          telegram_id: body.p_main_user_id === USER_ID
            ? TELEGRAM_ID
            : "9000000000000000002",
        };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        if (body.p_main_user_id === OTHER_USER_ID) return replayFixture(existingRow);
        throw new Error("first-grant setter must not run");
      }
      throw new Error(`unexpected ${name}`);
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "grant", snapshot, command })),
      dependencies({ rpc }),
    );
    assert.equal(response.status, fixture.expectedStatus, fixture.label);
    assert.equal(
      calls.some((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_main_user_id === USER_ID),
      false,
      fixture.label,
    );
  }
});

test("OCC drift and occupied candidate event block the only new setter", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
  });
  for (const candidate of [
    statusFixture({ event: null, version: "8", desiredState: "granted" }),
    statusFixture({ eventId: NEW_EVENT_ID, version: "8", desiredState: "revoked", state: "pending" }),
  ]) {
    const calls = [];
    let statusCalls = 0;
    const rpc = async (name, body) => {
      calls.push({ name, body });
      if (name === "architecture_get_finance_access_status_internal") {
        statusCalls += 1;
        if (body.p_event_id === NEW_EVENT_ID) return candidate;
        return statusFixture();
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        assert.equal(body.p_event_id, CURRENT_EVENT_ID);
        return replayFixture();
      }
      throw new Error(`unexpected ${name}`);
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({ rpc }),
    );
    assert.equal(response.status, 409);
    assert.equal(calls.some((call) => call.body?.p_event_id === NEW_EVENT_ID &&
      call.name === "architecture_set_finance_access_desired_internal"), false);
    assert.equal(statusCalls > 0, true);
  }
});

test("unknown new setter and dispatch outcomes allow only one explicit status read", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });

  for (const unknownAt of ["setter", "dispatch"]) {
    const command = planCommand({
      action: "revoke",
      snapshot,
      attestationProof: attested.attestation_proof,
      dispatch: true,
    });
    const calls = [];
    let dispatchCalls = 0;
    let candidateReads = 0;
    const rpc = async (name, body) => {
      calls.push({ name, body });
      if (name === "architecture_get_finance_access_status_internal") {
        if (body.p_event_id === NEW_EVENT_ID) {
          candidateReads += 1;
          if (candidateReads === 1) {
            return statusFixture({ event: null });
          }
          return statusFixture({
            eventId: NEW_EVENT_ID,
            version: "8",
            desiredState: "revoked",
            state: "pending",
          });
        }
        return statusFixture();
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
        if (unknownAt === "setter") throw new Error("unknown setter outcome");
        return {
          ok: true,
          replayed: false,
          event_id: NEW_EVENT_ID,
          version: "8",
          state: "pending",
        };
      }
      throw new Error(`unexpected ${name}`);
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({
        rpc,
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("unknown dispatch outcome");
        },
      }),
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await responseJson(response), {
      ok: false,
      error: "mutation_outcome_unknown",
      reconcile_required: true,
    });
    assert.equal(
      calls.filter((call) => call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id === NEW_EVENT_ID).length,
      1,
    );
    assert.equal(dispatchCalls, unknownAt === "dispatch" ? 1 : 0);

    const before = calls.length;
    const reconcile = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({
        action: "status",
        snapshot: null,
        command: { main_user_id: USER_ID, event_id: NEW_EVENT_ID },
      })),
      dependencies({ rpc }),
    );
    assert.equal(reconcile.status, 200);
    assert.deepEqual(
      calls.slice(before).map((call) => call.name),
      ["architecture_get_finance_access_status_internal"],
    );
    assert.equal(dispatchCalls, unknownAt === "dispatch" ? 1 : 0);
  }
});

test("malformed or non-successor post-setter results are UNKNOWN with one probe and no dispatch", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
  });
  const setterResults = [
    { ok: true },
    {
      ok: true,
      replayed: false,
      event_id: NEW_EVENT_ID,
      version: "9",
      state: "pending",
    },
  ];

  for (const setterResult of setterResults) {
    const calls = [];
    let candidateReads = 0;
    let dispatchCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({
        rpc: async (name, body) => {
          calls.push({ name, body });
          if (name === "architecture_get_finance_access_status_internal") {
            if (body.p_event_id === CURRENT_EVENT_ID) return statusFixture();
            candidateReads += 1;
            if (candidateReads === 1) return statusFixture({ event: null });
            return statusFixture({
              eventId: NEW_EVENT_ID,
              version: "8",
              desiredState: "revoked",
              state: "pending",
            });
          }
          if (name === "architecture_resolve_finance_subject_internal") {
            return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
          }
          if (name === "architecture_set_finance_access_desired_internal") {
            if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
            return setterResult;
          }
          throw new Error(`unexpected ${name}`);
        },
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("dispatch must not run after uncertain setter result");
        },
      }),
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await responseJson(response), {
      ok: false,
      error: "mutation_outcome_unknown",
      reconcile_required: true,
    });
    assert.equal(candidateReads, 2);
    assert.equal(
      calls.filter((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id === NEW_EVENT_ID).length,
      1,
    );
    assert.equal(dispatchCalls, 0);
  }
});

test("live request and approval freshness are rechecked immediately before new DML", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const cases = [
    {
      label: "request timestamp expired during D1 replay",
      finalNow: NOW + 60_001,
      approvalExpiresAt: new Date(NOW + 10 * 60 * 1_000).toISOString(),
    },
    {
      label: "owner approval expired during D1 replay",
      finalNow: NOW + 30_000,
      approvalExpiresAt: new Date(NOW + 30_000).toISOString(),
    },
  ];
  for (const fixture of cases) {
    const command = planCommand({
      action: "revoke",
      snapshot,
      attestationProof: attested.attestation_proof,
      approvalExpiresAt: fixture.approvalExpiresAt,
    });
    const calls = [];
    let clockReads = 0;
    let dispatchCalls = 0;
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({
        now: () => {
          clockReads += 1;
          return clockReads < 4 ? NOW : fixture.finalNow;
        },
        rpc: async (name, body) => {
          calls.push({ name, body });
          if (name === "architecture_get_finance_access_status_internal") {
            return body.p_event_id === NEW_EVENT_ID
              ? statusFixture({ event: null })
              : statusFixture();
          }
          if (name === "architecture_resolve_finance_subject_internal") {
            return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
          }
          if (name === "architecture_set_finance_access_desired_internal") {
            if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
            throw new Error("new setter must not run after live expiry");
          }
          throw new Error(`unexpected ${name}`);
        },
        dispatch: async () => {
          dispatchCalls += 1;
          throw new Error("dispatch must not run after live expiry");
        },
      }),
    );
    assert.equal(response.status, 409, fixture.label);
    assert.equal((await responseJson(response)).error, "attestation_failed", fixture.label);
    assert.equal(clockReads, 4, fixture.label);
    assert.equal(
      calls.some((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id === NEW_EVENT_ID),
      false,
      fixture.label,
    );
    assert.equal(dispatchCalls, 0, fixture.label);
  }
});

test("event-null reconciliation is status-only and reports absence without retry", async () => {
  const calls = [];
  let dispatchCalls = 0;
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture({
      action: "status",
      snapshot: null,
      command: { main_user_id: USER_ID, event_id: NEW_EVENT_ID },
    })),
    dependencies({
      rpc: async (name, body) => {
        calls.push({ name, body });
        return statusFixture({ event: null });
      },
      dispatch: async () => {
        dispatchCalls += 1;
        throw new Error("dispatch must not run");
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).event, null);
  assert.deepEqual(calls.map((call) => call.name), [
    "architecture_get_finance_access_status_internal",
  ]);
  assert.equal(dispatchCalls, 0);
});

test("Finance worker target, canonical path, product and enabled mode are pre-setter gates", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
    dispatch: true,
  });
  const driftCases = [
    {
      MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
        `https://${MAIN_PRODUCTION_REF}.supabase.co/functions/v1/finance-apply-entitlement-event-v2`,
    },
    {
      MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
        `https://${FINANCE_PRODUCTION_REF}.supabase.co/functions/v1/finance-apply-entitlement-event-v2`,
    },
    {
      MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
        "https://attacker.example/functions/v1/finance-apply-entitlement-event-v2",
    },
    {
      MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
        `https://${FINANCE_REF}.supabase.co/functions/v1/wrong`,
    },
    {
      MAIN_FINANCE_ENTITLEMENT_CANONICAL_PATH: "/functions/v1/wrong",
    },
    { MAIN_FINANCE_PRODUCT_CODE: "other_product" },
    { MAIN_FINANCE_SYNC_MODE: "disabled" },
  ];

  for (const drift of driftCases) {
    const calls = [];
    let candidateReads = 0;
    let dispatchCalls = 0;
    const rpc = async (name, body) => {
      calls.push({ name, body });
      if (name === "architecture_get_finance_access_status_internal") {
        if (body.p_event_id === CURRENT_EVENT_ID) return statusFixture();
        candidateReads += 1;
        if (candidateReads === 1) return statusFixture({ event: null });
        return statusFixture({
          eventId: NEW_EVENT_ID,
          version: "8",
          desiredState: "revoked",
          state: "applied",
        });
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
        return {
          ok: true,
          replayed: false,
          event_id: NEW_EVENT_ID,
          version: "8",
          state: "pending",
        };
      }
      throw new Error(`unexpected ${name}`);
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({
        values: environment(drift),
        rpc,
        dispatch: async () => {
          dispatchCalls += 1;
          return {
            ok: true,
            claimed: 1,
            applied: 1,
            retried: 0,
            dead_lettered: 0,
          };
        },
      }),
    );
    assert.notEqual(response.status, 200);
    assert.equal(
      calls.some((call) =>
        call.name === "architecture_set_finance_access_desired_internal" &&
        call.body.p_event_id === NEW_EVENT_ID),
      false,
    );
    assert.equal(dispatchCalls, 0);
  }
});

test("targeted dispatch verifies only applied and no-goes every known non-applied outcome", async () => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
    dispatch: true,
  });
  const cases = [
    {
      dispatchResult: { ok: true, claimed: 0, applied: 0, retried: 0, dead_lettered: 0 },
      finalState: "pending",
      success: false,
    },
    {
      dispatchResult: { ok: true, claimed: 1, applied: 0, retried: 1, dead_lettered: 0 },
      finalState: "retry_wait",
      success: false,
    },
    {
      dispatchResult: { ok: true, claimed: 1, applied: 0, retried: 1, dead_lettered: 0 },
      finalState: "processing",
      success: false,
    },
    {
      dispatchResult: { ok: true, claimed: 1, applied: 0, retried: 0, dead_lettered: 1 },
      finalState: "dead_letter",
      success: false,
    },
    {
      dispatchResult: { ok: true, claimed: 1, applied: 1, retried: 0, dead_lettered: 0 },
      finalState: "applied",
      success: true,
    },
  ];
  for (const fixture of cases) {
    let candidateReads = 0;
    let dispatchCalls = 0;
    const rpc = async (name, body) => {
      if (name === "architecture_get_finance_access_status_internal") {
        if (body.p_event_id === CURRENT_EVENT_ID) return statusFixture();
        candidateReads += 1;
        if (candidateReads === 1) return statusFixture({ event: null });
        return statusFixture({
          eventId: NEW_EVENT_ID,
          version: "8",
          desiredState: "revoked",
          state: fixture.finalState,
        });
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        if (body.p_event_id === CURRENT_EVENT_ID) return replayFixture();
        return {
          ok: true,
          replayed: false,
          event_id: NEW_EVENT_ID,
          version: "8",
          state: "pending",
        };
      }
      throw new Error(`unexpected ${name}`);
    };
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({
        rpc,
        dispatch: async () => {
          dispatchCalls += 1;
          return fixture.dispatchResult;
        },
      }),
    );
    const value = await responseJson(response);
    assert.equal(dispatchCalls, 1);
    if (fixture.success) {
      assert.equal(response.status, 200);
      assert.equal(value.dispatch_performed, true);
      assert.equal(value.event.state, fixture.finalState);
    } else {
      assert.equal(response.status, 409);
      assert.deepEqual(value, {
        ok: false,
        error: "access_not_applied",
        reconcile_required: false,
        manual_recovery_required: true,
        dispatch_performed: true,
      });
    }
  }
});

test("default dispatch rejects oversized and malformed UTF-8 JSON before success", async (t) => {
  const snapshot = snapshotFixture();
  const { value: attested } = await successfulAttestation({ snapshot });
  const command = planCommand({
    action: "revoke",
    snapshot,
    attestationProof: attested.attestation_proof,
    dispatch: true,
  });
  for (const body of [
    `${JSON.stringify({
      ok: true,
      claimed: 1,
      applied: 1,
      retried: 0,
      dead_lettered: 0,
    })}${" ".repeat(4_096)}`,
    new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]),
  ]) {
    let candidateReads = 0;
    const rpc = async (name, rpcBody) => {
      if (name === "architecture_get_finance_access_status_internal") {
        if (rpcBody.p_event_id === CURRENT_EVENT_ID) return statusFixture();
        candidateReads += 1;
        if (candidateReads === 1) return statusFixture({ event: null });
        return statusFixture({
          eventId: NEW_EVENT_ID,
          version: "8",
          desiredState: "revoked",
          state: "applied",
        });
      }
      if (name === "architecture_resolve_finance_subject_internal") {
        return { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID };
      }
      if (name === "architecture_set_finance_access_desired_internal") {
        if (rpcBody.p_event_id === CURRENT_EVENT_ID) return replayFixture();
        return {
          ok: true,
          replayed: false,
          event_id: NEW_EVENT_ID,
          version: "8",
          state: "pending",
        };
      }
      throw new Error(`unexpected ${name}`);
    };
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }));
    const response = await handleFinanceManageAccessV2Request(
      requestFor(bodyFixture({ action: "revoke", snapshot, command })),
      dependencies({ rpc }),
    );
    assert.equal(response.status, 503);
    assert.equal((await responseJson(response)).reconcile_required, true);
    assert.equal(fetchMock.mock.callCount(), 1);
    fetchMock.mock.restore();
  }
});

test("gate inventory is dynamic evidence, never a static env pin or secret rewrite", () => {
  assert.doesNotMatch(
    EDGE_SOURCE,
    /envValue\([^)]*MAIN_FINANCE_ACCESS_V2_GATE_INVENTORY_SHA256/u,
  );
  assert.match(
    EDGE_SOURCE,
    /snapshot\.gate_inventory_sha256|value\.gate_inventory_sha256/u,
  );
});

test("access operator uses only the pinned CLI 2.109.1 raw-array JSON renderer", () => {
  assert.equal(
    (ACCESS_OPERATOR_SOURCE.match(
      /"--output",\s*"json",\s*"--log-level",\s*"error"/gu,
    ) ?? []).length,
    3,
  );
  assert.doesNotMatch(ACCESS_OPERATOR_SOURCE, /--output-format/u);
  assert.equal(
    (ACCESS_OPERATOR_SOURCE.match(/"secrets",\s*"list"/gu) ?? []).length,
    2,
  );
  assert.equal(
    (ACCESS_OPERATOR_SOURCE.match(/"functions",\s*"list"/gu) ?? []).length,
    1,
  );
});

test("failure text, responses and source do not leak identity or runtime secrets", async () => {
  const leaked = [OPERATOR_SECRET, PRIVACY_KEY, TRIGGER_SECRET, TELEGRAM_ID, "ab".repeat(32)];
  const response = await handleFinanceManageAccessV2Request(
    requestFor(bodyFixture()),
    dependencies({
      rpc: async () => {
        throw new Error(leaked.join(" "));
      },
    }),
  );
  const source = await response.text();
  for (const value of leaked) assert.equal(source.includes(value), false);
  assert.doesNotMatch(source, /telegram_id|subject_digest|secret|hmac/iu);
  assert.doesNotMatch(EDGE_SOURCE, /console\.(?:log|info|warn|error)/u);
  assert.match(
    EDGE_SOURCE,
    /derivePrivateDigest\([\s\S]*"main-telegram-subject-v1"/u,
  );
  assert.doesNotMatch(EDGE_SOURCE, /main-telegram-subject-v2/u);
});
