import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FINANCE_ROTATION_PREFLIGHT_SQL,
  FINANCE_ROTATION_PREFLIGHT_SQL_SHA256,
  MAIN_FINANCE_BOOTSTRAP_BOUNDARY,
  MAIN_ROTATION_PREFLIGHT_SQL,
  MAIN_ROTATION_PREFLIGHT_SQL_SHA256,
  canonicalJson,
  runMainFinanceStagingAccessBootstrap,
  sha256,
  validateServiceRoleKey,
} from "../../scripts/bootstrap-main-finance-staging-access.mjs";

const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_REF = "makgsbjduobcphuqzaoq";
const MAIN_PRODUCTION_REF = "soxtekhspohkddpdidvp";
const FINANCE_PRODUCTION_REF = "koibxwgtihwajocxfetb";
const API_ORIGIN = "https://api.supabase.com";
const ACCESS_TOKEN = `sbp_${"a".repeat(40)}`;
const DISABLED_SHA256 = createHash("sha256").update("disabled").digest("hex");
const INSTALL_CONFIRMATION =
  "INSTALL MAIN FINANCE E2E SECRETS TO DATALESS STAGING ONLY";

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function serviceRoleKey(projectRef = MAIN_REF) {
  return [
    base64UrlJson({ alg: "HS256", typ: "JWT" }),
    base64UrlJson({
      iss: "supabase",
      ref: projectRef,
      role: "service_role",
      iat: 1,
      exp: 4_102_444_800,
    }),
    "signature",
  ].join(".");
}

function privateDirectory(t, suffix) {
  const directory = realpathSync(
    mkdtempSync(path.join(os.tmpdir(), `${suffix}-`)),
  );
  chmodSync(directory, 0o700);
  t.after(() => {
    // Node's test tmp lifecycle owns cleanup in CI; no destructive operator
    // paths are introduced into production code.
  });
  return directory;
}

function privateTokenFile(t) {
  const directory = privateDirectory(t, "main-finance-bootstrap-token");
  const file = path.join(directory, "access-token");
  writeFileSync(file, `${ACCESS_TOKEN}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

function mainPreflightRow({ pilotUsers = "0", subjectRows = "0" } = {}) {
  return {
    database_role: "supabase_read_only_user",
    server_version_num: "170006",
    auth_users_count: "0",
    pilot_users_count: pilotUsers,
    architecture_product_entitlements_count: subjectRows,
    architecture_finance_issue_requests_count: "0",
    architecture_finance_issue_replay_guard_count: "0",
    architecture_finance_access_desired_count: "0",
    architecture_finance_access_outbox_count: "0",
  };
}

function financePreflightRow({ subjectRows = "0" } = {}) {
  return {
    database_role: "supabase_read_only_user",
    server_version_num: "170006",
    auth_users_count: "0",
    finance_profiles_count: subjectRows,
    finance_entitlements_count: "0",
    finance_connected_devices_count: "0",
    finance_device_codes_count: "0",
    finance_device_codes_v2_count: "0",
    finance_device_code_issuer_requests_count: "0",
    finance_device_code_attempts_count: "0",
    finance_device_code_revocation_requests_count: "0",
    finance_entitlement_integration_events_v1_count: "0",
    finance_entitlement_integration_state_v1_count: "0",
    finance_entitlement_subject_events_v2_count: "0",
    finance_entitlement_subject_bindings_v2_count: "0",
    finance_entitlement_rebind_authorizations_v2_count: "0",
    finance_entitlement_apply_authorizations_v2_count: "0",
    finance_entitlement_subject_cutover_v2_count: "1",
    finance_entitlement_subject_cutover_v2_invalid_count: "0",
  };
}

function row(name, value = DISABLED_SHA256, updatedAt = "2026-07-29T01:00:00Z") {
  return { name, updated_at: updatedAt, value };
}

function initialInventories() {
  return {
    [MAIN_REF]: [
      row("MAIN_FINANCE_SYNC_MODE"),
      row("MAIN_FINANCE_PROTOCOL_MODE"),
      row("MAIN_FINANCE_PRIVACY_HMAC_KEY", sha256("old-privacy")),
      row("MAIN_FINANCE_SYNC_TRIGGER_SECRET", sha256("old-trigger")),
      row("UNRELATED_MAIN_SECRET", sha256("unrelated-main")),
    ],
    [FINANCE_REF]: [
      row("FINANCE_ENTITLEMENT_SYNC_MODE"),
      row("FINANCE_TELEGRAM_PROTOCOL_MODE"),
      row("UNRELATED_FINANCE_SECRET", sha256("unrelated-finance")),
    ],
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function managementMock({
  mainRow = mainPreflightRow(),
  financeRow = financePreflightRow(),
  revealedServiceRole = serviceRoleKey(),
  installResponse = {},
} = {}) {
  const calls = [];
  const inventories = initialInventories();
  const fetchImpl = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: init.body ?? null,
      headers: { ...init.headers },
      redirect: init.redirect,
    });
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(url.includes(MAIN_PRODUCTION_REF), false);
    assert.equal(url.includes(FINANCE_PRODUCTION_REF), false);
    if (
      init.method === "POST"
      && url === `${API_ORIGIN}/v1/projects/${MAIN_REF}/database/query/read-only`
    ) {
      assert.equal(
        init.body,
        canonicalJson({ query: MAIN_ROTATION_PREFLIGHT_SQL }),
      );
      return jsonResponse([mainRow], 201);
    }
    if (
      init.method === "POST"
      && url === `${API_ORIGIN}/v1/projects/${FINANCE_REF}/database/query/read-only`
    ) {
      assert.equal(
        init.body,
        canonicalJson({ query: FINANCE_ROTATION_PREFLIGHT_SQL }),
      );
      return jsonResponse([financeRow], 201);
    }
    for (const projectRef of [MAIN_REF, FINANCE_REF]) {
      if (
        init.method === "GET"
        && url === `${API_ORIGIN}/v1/projects/${projectRef}/secrets`
      ) return jsonResponse(inventories[projectRef]);
    }
    if (
      init.method === "GET"
      && url === `${API_ORIGIN}/v1/projects/${MAIN_REF}/api-keys?reveal=true`
    ) {
      return jsonResponse([
        {
          api_key: "safe-public-key",
          id: "anon",
          type: "legacy",
          name: "anon",
        },
        {
          api_key: revealedServiceRole,
          id: "service-role",
          type: "legacy",
          name: "service_role",
        },
      ]);
    }
    if (
      init.method === "POST"
      && url === `${API_ORIGIN}/v1/projects/${MAIN_REF}/secrets`
    ) {
      const payload = JSON.parse(init.body);
      assert.deepEqual(
        payload.map(item => item.name),
        [
          "MAIN_FINANCE_PRIVACY_HMAC_KEY",
          "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
        ],
      );
      assert.equal(payload.length, 2);
      assert.match(payload[0].value, /^[A-Za-z0-9_-]{64}$/);
      assert.match(payload[1].value, /^[A-Za-z0-9_-]{64}$/);
      assert.notEqual(payload[0].value, payload[1].value);
      for (const item of payload) {
        const target = inventories[MAIN_REF].find(entry =>
          entry.name === item.name);
        target.value = sha256(item.value);
        target.updated_at = "2026-07-29T01:05:00Z";
      }
      return jsonResponse(installResponse, 201);
    }
    throw new Error(`unexpected request ${init.method} ${url}`);
  };
  return { calls, fetchImpl, inventories };
}

function prepareInput(t, outputDirectory) {
  return {
    mode: "prepare",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: privateTokenFile(t),
    outputDirectory,
  };
}

function deterministicRandomBytes() {
  let call = 0;
  return size => {
    call += 1;
    return Buffer.alloc(size, call === 1 ? 0x11 : 0x22);
  };
}

test("boundary and SQL are exact, read-only and production-denied", async () => {
  assert.deepEqual(
    MAIN_FINANCE_BOOTSTRAP_BOUNDARY.productionDenyProjectRefs,
    [MAIN_PRODUCTION_REF, FINANCE_PRODUCTION_REF],
  );
  assert.equal(sha256(MAIN_ROTATION_PREFLIGHT_SQL), MAIN_ROTATION_PREFLIGHT_SQL_SHA256);
  assert.equal(
    sha256(FINANCE_ROTATION_PREFLIGHT_SQL),
    FINANCE_ROTATION_PREFLIGHT_SQL_SHA256,
  );
  for (const sql of [
    MAIN_ROTATION_PREFLIGHT_SQL,
    FINANCE_ROTATION_PREFLIGHT_SQL,
  ]) {
    assert.doesNotMatch(
      sql,
      /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE)\b/iu,
    );
  }
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "prepare",
      mainProjectRef: MAIN_PRODUCTION_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: "/does/not/exist",
      outputDirectory: "/does/not/exist",
    }, {
      fetchImpl: () => {
        throw new Error("network must not run");
      },
    }),
    /exact production project ref/,
  );
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "reconcile",
      mainProjectRef: MAIN_PRODUCTION_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: "/does/not/exist",
      bundleDirectory: "/does/not/exist",
      receiptDirectory: "/does/not/exist",
      unknownReceiptFile: "/does/not/exist",
    }, {
      fetchImpl: () => {
        throw new Error("network must not run");
      },
    }),
    /exact production project ref/,
  );
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "reconcilee",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: "/does/not/exist",
      bundleDirectory: "/does/not/exist",
      receiptDirectory: "/does/not/exist",
      unknownReceiptFile: "/does/not/exist",
    }, {
      fetchImpl: () => {
        throw new Error("network must not run");
      },
    }),
    /operator mode differs/,
  );
});

test("prepare performs five reads, reveals exact service_role and writes one private external bundle", async t => {
  const parent = privateDirectory(t, "main-finance-bootstrap-output-parent");
  const outputDirectory = path.join(parent, "bundle");
  const mock = managementMock();
  const result = await runMainFinanceStagingAccessBootstrap(
    prepareInput(t, outputDirectory),
    {
      fetchImpl: mock.fetchImpl,
      randomBytesImpl: deterministicRandomBytes(),
      now: () => new Date("2026-07-29T01:10:00.000Z"),
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, "prepare");
  assert.equal(result.hostedReadCount, 5);
  assert.equal(result.hostedMutationCount, 0);
  assert.equal(mock.calls.length, 5);
  assert.equal(mock.calls.every(call => call.method !== "DELETE"), true);
  assert.equal(
    mock.calls.filter(call =>
      call.method === "POST" && call.url.endsWith("/secrets")).length,
    0,
  );
  assert.equal(statSync(outputDirectory).mode & 0o777, 0o700);
  const runtimeFile = path.join(
    outputDirectory,
    "main-finance-staging-runtime.env",
  );
  const attestationFile = path.join(
    outputDirectory,
    "main-finance-staging-runtime.attestation.json",
  );
  assert.equal(statSync(runtimeFile).mode & 0o777, 0o600);
  assert.equal(statSync(attestationFile).mode & 0o777, 0o600);
  const runtime = readFileSync(runtimeFile, "utf8");
  assert.match(runtime, /^MAIN_SUPABASE_URL=https:\/\/bljeoovhydhjhdzwplxh\.supabase\.co$/m);
  assert.match(runtime, /^MAIN_SERVICE_ROLE_KEY=[^\n]+$/m);
  assert.match(runtime, /^MAIN_FINANCE_PRIVACY_HMAC_KEY=[A-Za-z0-9_-]{64}$/m);
  assert.match(runtime, /^MAIN_FINANCE_SYNC_TRIGGER_SECRET=[A-Za-z0-9_-]{64}$/m);
  assert.equal(runtime.split("\n").filter(Boolean).length, 4);
  const attestation = JSON.parse(readFileSync(attestationFile, "utf8"));
  assert.equal(attestation.productionDenied, true);
  assert.equal(attestation.hostedMutationCount, 0);
  assert.equal(attestation.runtimeSha256, sha256(runtime));
  assert.doesNotMatch(JSON.stringify(attestation), /signature|MAIN_SERVICE_ROLE_KEY/);
});

test("prepare refuses Main or Finance subject state and non-disabled gates before key reveal", async t => {
  for (const fixture of [
    { mainRow: mainPreflightRow({ subjectRows: "1" }) },
    { financeRow: financePreflightRow({ subjectRows: "1" }) },
  ]) {
    const parent = privateDirectory(t, "main-finance-bootstrap-refusal");
    const mock = managementMock(fixture);
    await assert.rejects(
      runMainFinanceStagingAccessBootstrap(
        prepareInput(t, path.join(parent, "bundle")),
        {
          fetchImpl: mock.fetchImpl,
          randomBytesImpl: deterministicRandomBytes(),
        },
      ),
      /subject-bound Finance state/,
    );
    assert.equal(
      mock.calls.some(call => call.url.includes("api-keys")),
      false,
    );
  }

  const parent = privateDirectory(t, "main-finance-bootstrap-gate-refusal");
  const mock = managementMock();
  mock.inventories[MAIN_REF].find(row =>
    row.name === "MAIN_FINANCE_SYNC_MODE").value = sha256("enabled");
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap(
      prepareInput(t, path.join(parent, "bundle")),
      {
        fetchImpl: mock.fetchImpl,
        randomBytesImpl: deterministicRandomBytes(),
      },
    ),
    /not exact disabled/,
  );
  assert.equal(mock.calls.some(call => call.url.includes("api-keys")), false);
});

test("revealed key must be the legacy service_role JWT for exact Main staging", () => {
  assert.equal(validateServiceRoleKey(serviceRoleKey(), MAIN_REF), serviceRoleKey());
  assert.throws(
    () => validateServiceRoleKey(serviceRoleKey(MAIN_PRODUCTION_REF), MAIN_REF),
    /claims differ/,
  );
  assert.throws(
    () => validateServiceRoleKey("sb_secret_not_a_legacy_jwt", MAIN_REF),
    /format differs/,
  );
});

test("install repeats guards, mutates exactly two Main secrets once, verifies all unrelated inventory and writes receipt", async t => {
  const parent = privateDirectory(t, "main-finance-bootstrap-install-parent");
  const bundleDirectory = path.join(parent, "bundle");
  const prepareMock = managementMock();
  const tokenFile = privateTokenFile(t);
  await runMainFinanceStagingAccessBootstrap({
    mode: "prepare",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    outputDirectory: bundleDirectory,
  }, {
    fetchImpl: prepareMock.fetchImpl,
    randomBytesImpl: deterministicRandomBytes(),
    now: () => new Date("2026-07-29T01:10:00.000Z"),
  });

  const receiptDirectory = privateDirectory(t, "main-finance-bootstrap-receipts");
  const installMock = managementMock();
  const result = await runMainFinanceStagingAccessBootstrap({
    mode: "install",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    bundleDirectory,
    receiptDirectory,
    confirmation: INSTALL_CONFIRMATION,
  }, {
    fetchImpl: installMock.fetchImpl,
    now: () => new Date("2026-07-29T01:20:00.000Z"),
  });
  assert.equal(result.status, "verified");
  assert.equal(result.hostedReadCount, 6);
  assert.equal(result.hostedMutationCount, 1);
  const mutations = installMock.calls.filter(call =>
    call.method === "POST" && call.url.endsWith("/secrets"));
  assert.equal(mutations.length, 1);
  assert.equal(
    mutations[0].url,
    `${API_ORIGIN}/v1/projects/${MAIN_REF}/secrets`,
  );
  assert.equal(
    installMock.calls.some(call =>
      call.url.includes(MAIN_PRODUCTION_REF)
      || call.url.includes(FINANCE_PRODUCTION_REF)),
    false,
  );
  const receipt = JSON.parse(readFileSync(result.receiptFile, "utf8"));
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.productionDenied, true);
  assert.equal(receipt.hostedMutationCount, 1);
  assert.deepEqual(receipt.secretNames, [
    "MAIN_FINANCE_PRIVACY_HMAC_KEY",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ]);
  assert.doesNotMatch(
    JSON.stringify(receipt),
    /MAIN_SERVICE_ROLE_KEY|sbp_|signature/,
  );
});

test("reconcile resolves an unexpected POST response using exactly two inventory reads and never repeats the mutation", async t => {
  const parent = privateDirectory(t, "main-finance-bootstrap-reconcile-parent");
  const bundleDirectory = path.join(parent, "bundle");
  const tokenFile = privateTokenFile(t);
  await runMainFinanceStagingAccessBootstrap({
    mode: "prepare",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    outputDirectory: bundleDirectory,
  }, {
    fetchImpl: managementMock().fetchImpl,
    randomBytesImpl: deterministicRandomBytes(),
    now: () => new Date("2026-07-29T01:10:00.000Z"),
  });

  const receiptDirectory = privateDirectory(
    t,
    "main-finance-bootstrap-reconcile-receipts",
  );
  const unknownOutcomeMock = managementMock({ installResponse: [] });
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "install",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: tokenFile,
      bundleDirectory,
      receiptDirectory,
      confirmation: INSTALL_CONFIRMATION,
    }, {
      fetchImpl: unknownOutcomeMock.fetchImpl,
      now: () => new Date("2026-07-29T01:20:00.000Z"),
    }),
    /two-secret installation response keys differ/,
  );
  const unknownReceiptFile = path.join(
    receiptDirectory,
    readdirSync(receiptDirectory).find(file => file.endsWith("-unknown.json")),
  );
  const unknownReceipt = JSON.parse(readFileSync(unknownReceiptFile, "utf8"));
  assert.equal(unknownReceipt.status, "unknown");
  assert.equal(unknownReceipt.mutationAccepted, false);
  assert.equal(unknownReceipt.hostedMutationCount, 1);

  const callsBeforeReconcile = unknownOutcomeMock.calls.length;
  const result = await runMainFinanceStagingAccessBootstrap({
    mode: "reconcile",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    bundleDirectory,
    receiptDirectory,
    unknownReceiptFile,
  }, {
    fetchImpl: unknownOutcomeMock.fetchImpl,
    now: () => new Date("2026-07-29T01:25:00.000Z"),
  });

  assert.equal(result.mode, "reconcile");
  assert.equal(result.status, "verified");
  assert.equal(result.hostedReadCount, 2);
  assert.equal(result.hostedMutationCount, 0);
  const reconcileCalls = unknownOutcomeMock.calls.slice(callsBeforeReconcile);
  assert.deepEqual(
    reconcileCalls.map(call => ({
      method: call.method,
      url: call.url,
      body: call.body,
    })).sort((left, right) => left.url.localeCompare(right.url)),
    [
      {
        method: "GET",
        url: `${API_ORIGIN}/v1/projects/${MAIN_REF}/secrets`,
        body: null,
      },
      {
        method: "GET",
        url: `${API_ORIGIN}/v1/projects/${FINANCE_REF}/secrets`,
        body: null,
      },
    ],
  );
  const receipt = JSON.parse(readFileSync(result.receiptFile, "utf8"));
  assert.equal(
    receipt.operation,
    "reconcile-main-finance-staging-e2e-secret-install",
  );
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.productionDenied, true);
  assert.equal(receipt.hostedReadCount, 2);
  assert.equal(receipt.hostedMutationCount, 0);
  assert.equal(receipt.priorHostedMutationCount, 1);
  assert.equal(
    receipt.proofScope,
    "current-target-digests-and-four-disabled-gates-only",
  );
  assert.equal(receipt.unrelatedSecretsCompared, false);
  assert.equal(
    receipt.unknownInstallReceiptSha256,
    unknownReceipt.receiptSha256,
  );
  const runtime = readFileSync(
    path.join(bundleDirectory, "main-finance-staging-runtime.env"),
    "utf8",
  );
  for (const line of runtime.trim().split("\n")) {
    assert.equal(JSON.stringify(receipt).includes(line.slice(line.indexOf("=") + 1)), false);
  }
});

test("reconcile fails closed on a target digest mismatch and writes no verified receipt", async t => {
  const parent = privateDirectory(t, "main-finance-bootstrap-reconcile-mismatch");
  const bundleDirectory = path.join(parent, "bundle");
  const tokenFile = privateTokenFile(t);
  await runMainFinanceStagingAccessBootstrap({
    mode: "prepare",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    outputDirectory: bundleDirectory,
  }, {
    fetchImpl: managementMock().fetchImpl,
    randomBytesImpl: deterministicRandomBytes(),
    now: () => new Date("2026-07-29T01:10:00.000Z"),
  });
  const receiptDirectory = privateDirectory(
    t,
    "main-finance-bootstrap-reconcile-mismatch-receipts",
  );
  const mock = managementMock({ installResponse: [] });
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "install",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: tokenFile,
      bundleDirectory,
      receiptDirectory,
      confirmation: INSTALL_CONFIRMATION,
    }, {
      fetchImpl: mock.fetchImpl,
      now: () => new Date("2026-07-29T01:20:00.000Z"),
    }),
    /two-secret installation response keys differ/,
  );
  const unknownReceiptFile = path.join(
    receiptDirectory,
    readdirSync(receiptDirectory).find(file => file.endsWith("-unknown.json")),
  );
  mock.inventories[MAIN_REF].find(item =>
    item.name === "MAIN_FINANCE_PRIVACY_HMAC_KEY").value =
      sha256("different-secret");
  const callsBeforeReconcile = mock.calls.length;
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "reconcile",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: tokenFile,
      bundleDirectory,
      receiptDirectory,
      unknownReceiptFile,
    }, {
      fetchImpl: mock.fetchImpl,
      now: () => new Date("2026-07-29T01:25:00.000Z"),
    }),
    /reconciliation digest for MAIN_FINANCE_PRIVACY_HMAC_KEY differs/,
  );
  const reconcileCalls = mock.calls.slice(callsBeforeReconcile);
  assert.equal(reconcileCalls.length, 2);
  assert.equal(reconcileCalls.every(call => call.method === "GET"), true);
  assert.deepEqual(
    new Set(reconcileCalls.map(call => call.url)),
    new Set([
      `${API_ORIGIN}/v1/projects/${MAIN_REF}/secrets`,
      `${API_ORIGIN}/v1/projects/${FINANCE_REF}/secrets`,
    ]),
  );
  assert.equal(
    readdirSync(receiptDirectory).some(file =>
      file.includes("-reconciliation-")),
    false,
  );
});

test("reconcile requires all four gates to remain disabled", async t => {
  const parent = privateDirectory(t, "main-finance-bootstrap-reconcile-gate");
  const bundleDirectory = path.join(parent, "bundle");
  const tokenFile = privateTokenFile(t);
  await runMainFinanceStagingAccessBootstrap({
    mode: "prepare",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    accessTokenFile: tokenFile,
    outputDirectory: bundleDirectory,
  }, {
    fetchImpl: managementMock().fetchImpl,
    randomBytesImpl: deterministicRandomBytes(),
    now: () => new Date("2026-07-29T01:10:00.000Z"),
  });
  const receiptDirectory = privateDirectory(
    t,
    "main-finance-bootstrap-reconcile-gate-receipts",
  );
  const mock = managementMock({ installResponse: [] });
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "install",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: tokenFile,
      bundleDirectory,
      receiptDirectory,
      confirmation: INSTALL_CONFIRMATION,
    }, {
      fetchImpl: mock.fetchImpl,
      now: () => new Date("2026-07-29T01:20:00.000Z"),
    }),
    /two-secret installation response keys differ/,
  );
  const unknownReceiptFile = path.join(
    receiptDirectory,
    readdirSync(receiptDirectory).find(file => file.endsWith("-unknown.json")),
  );
  mock.inventories[FINANCE_REF].find(item =>
    item.name === "FINANCE_ENTITLEMENT_SYNC_MODE").value = sha256("enabled");
  await assert.rejects(
    runMainFinanceStagingAccessBootstrap({
      mode: "reconcile",
      mainProjectRef: MAIN_REF,
      financeProjectRef: FINANCE_REF,
      accessTokenFile: tokenFile,
      bundleDirectory,
      receiptDirectory,
      unknownReceiptFile,
    }, {
      fetchImpl: mock.fetchImpl,
      now: () => new Date("2026-07-29T01:25:00.000Z"),
    }),
    /gate FINANCE_ENTITLEMENT_SYNC_MODE is not exact disabled/,
  );
  assert.equal(
    readdirSync(receiptDirectory).some(file =>
      file.includes("-reconciliation-")),
    false,
  );
});

test("plan is inert and reports the exact future mutation boundary", async () => {
  let fetchCalls = 0;
  const result = await runMainFinanceStagingAccessBootstrap({
    mode: "plan",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
  }, {
    fetchImpl: () => {
      fetchCalls += 1;
      throw new Error("plan must not fetch");
    },
  });
  assert.equal(fetchCalls, 0);
  assert.equal(result.hostedReadCount, 0);
  assert.equal(result.hostedMutationCount, 0);
  assert.equal(result.installHostedMutationCount, 1);
  assert.equal(result.reconcileHostedReadCount, 2);
  assert.equal(result.reconcileHostedMutationCount, 0);
  assert.deepEqual(result.rotatedSecretNames, [
    "MAIN_FINANCE_PRIVACY_HMAC_KEY",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ]);
});
