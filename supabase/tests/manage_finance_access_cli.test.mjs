import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  manageFinanceAccess,
  parseFinanceAccessArguments,
  productionConfirmationPhrase,
  readReviewedProductionBoundary,
  readReviewedTargetDescriptor,
} from "../../scripts/manage-finance-access.mjs";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_ID = "00000000-0000-4000-8000-000000000002";
const TELEGRAM_ID = "9000000000000000001";
const SERVICE_KEY = "service-key-fixture-never-use-00000000000000000001";
const PRIVACY_KEY = "privacy-key-fixture-never-use-00000000000000000001";
const TRIGGER_KEY = "trigger-key-fixture-never-use-00000000000000000001";
const STAGING_ORIGIN = "https://staging-main.example";
const PRODUCTION_ORIGIN = "https://production-main.example";
const PRODUCTION_BOUNDARY = Object.freeze({
  schemaVersion: 1,
  mainEdgeOrigin: PRODUCTION_ORIGIN,
  financeWebOrigin: "https://production-finance.example",
  telegramMiniAppUrl: "https://t.me/architectureproductionbot?startapp",
});

const environment = Object.freeze({
  MAIN_SUPABASE_URL: STAGING_ORIGIN,
  MAIN_SERVICE_ROLE_KEY: SERVICE_KEY,
  MAIN_FINANCE_PRIVACY_HMAC_KEY: PRIVACY_KEY,
  MAIN_FINANCE_SYNC_TRIGGER_SECRET: TRIGGER_KEY,
  // A stale or spoofed legacy variable must never classify the target.
  MAIN_PRODUCTION_SUPABASE_URL: STAGING_ORIGIN,
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function args(action = "grant", extra = []) {
  return [
    action,
    "--user-id", USER_ID,
    "--event-id", EVENT_ID,
    "--changed-by", "operator:test",
    "--reason", "isolated staging pilot",
    ...extra,
  ];
}

function statusValue({
  currentVersion = "0",
  desiredState = null,
  appliedVersion = "0",
  appliedState = null,
  event = null,
} = {}) {
  return {
    ok: true,
    main_user_id: USER_ID,
    current_version: currentVersion,
    desired_state: desiredState,
    applied_version: appliedVersion,
    applied_state: appliedState,
    event,
  };
}

function boundaryFixture(t, source = PRODUCTION_BOUNDARY, { mode = 0o600 } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-access-boundary-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "main-production-boundary.json");
  const contents = typeof source === "string" ? source : `${JSON.stringify(source, null, 2)}\n`;
  writeFileSync(file, contents, { mode });
  return { file, contents, directory };
}

function targetFixture(t, boundary, {
  environment: targetEnvironment = "staging",
  mainEdgeOrigin = STAGING_ORIGIN,
  source = null,
  mode = 0o600,
} = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-access-target-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "main-target.json");
  const descriptor = source ?? {
    schemaVersion: 1,
    environment: targetEnvironment,
    mainEdgeOrigin,
    productionBoundarySha256: createHash("sha256").update(boundary.contents).digest("hex"),
  };
  const contents = typeof descriptor === "string"
    ? descriptor
    : `${JSON.stringify(descriptor, null, 2)}\n`;
  writeFileSync(file, contents, { mode });
  return { file, contents, directory };
}

test("operator arguments require explicit audit identity and isolate read-only modes", () => {
  assert.deepEqual(parseFinanceAccessArguments(args()), {
    action: "grant",
    apply: false,
    dispatch: false,
    allowProduction: false,
    userId: USER_ID,
    eventId: EVENT_ID,
    changedBy: "operator:test",
    reason: "isolated staging pilot",
  });
  assert.deepEqual(parseFinanceAccessArguments([
    "status", "--user-id", USER_ID, "--event-id", EVENT_ID,
    "--target-config", "/tmp/main-target.json",
    "--production-boundary", "/tmp/main-production-boundary.json",
  ]), {
    action: "status",
    apply: false,
    dispatch: false,
    allowProduction: false,
    userId: USER_ID,
    eventId: EVENT_ID,
    targetConfig: "/tmp/main-target.json",
    productionBoundary: "/tmp/main-production-boundary.json",
  });
  assert.throws(() => parseFinanceAccessArguments([
    ...args(), "--telegram-id", TELEGRAM_ID,
  ]), /unknown argument/);
  assert.throws(() => parseFinanceAccessArguments([
    ...args(), "--reason", "duplicate",
  ]), /duplicate argument/);
  assert.throws(() => parseFinanceAccessArguments(args("enable")), /grant, revoke or status/);
  assert.throws(() => parseFinanceAccessArguments([
    "grant", "--user-id", USER_ID, "--changed-by", "operator:test", "--reason", "missing event",
  ]), /explicit --event-id/);
  assert.throws(() => parseFinanceAccessArguments([
    "grant", "--user-id", USER_ID, "--event-id", EVENT_ID, "--reason", "missing actor",
  ]), /explicit valid --changed-by/);
  assert.throws(() => parseFinanceAccessArguments([...args(), "--dispatch"]), /requires --apply/);
  assert.throws(() => parseFinanceAccessArguments([...args(), "--allow-production"]), /requires --apply/);
  assert.throws(() => parseFinanceAccessArguments([...args(), "--apply"]), /requires --target-config/);
  assert.throws(() => parseFinanceAccessArguments([
    "status", "--user-id", USER_ID, "--reason", "must fail",
  ]), /status is read-only/);
  assert.throws(() => parseFinanceAccessArguments([
    "status", "--user-id", USER_ID,
  ]), /status requires --target-config/);
  assert.throws(() => parseFinanceAccessArguments([
    "grant", "--user-id", USER_ID, "--event-id", EVENT_ID,
    "--changed-by", "operator:test", "--reason", " bad",
  ]), /1-500 printable/);
});

test("default grant is a zero-network zero-secret dry run", async () => {
  let environmentReads = 0;
  let fetches = 0;
  const dryEnvironment = new Proxy({}, {
    get(_target, name) {
      environmentReads += 1;
      throw new Error(`${String(name)} must not be read during dry run`);
    },
  });
  const result = await manageFinanceAccess({
    argv: args(),
    environment: dryEnvironment,
    fetchImpl: async () => {
      fetches += 1;
      throw new Error("dry run must not use network");
    },
  });
  assert.deepEqual(result, {
    ok: true,
    mode: "dry_run",
    action: "grant",
    main_user_id: USER_ID,
    event_id: EVENT_ID,
    changed_by: "operator:test",
    target_environment: "unclassified",
    production_boundary_sha256: null,
    target_descriptor_sha256: null,
    mutation_performed: false,
    apply_required: true,
  });
  assert.equal(environmentReads, 0);
  assert.equal(fetches, 0);
});

test("empty invocation and --help are local and safe", async () => {
  for (const argv of [[], ["--help"]]) {
    const result = await manageFinanceAccess({
      argv,
      environment: new Proxy({}, {
        get() {
          throw new Error("help must not read environment");
        },
      }),
      fetchImpl: async () => {
        throw new Error("help must not use network");
      },
    });
    assert.equal(result.mode, "help");
    assert.equal(result.usage.length, 3);
  }
});

test("reviewed boundary is exact, external, owned and non-writable", (t) => {
  const valid = boundaryFixture(t);
  assert.deepEqual(readReviewedProductionBoundary(valid.file), {
    mainSupabaseOrigin: PRODUCTION_ORIGIN,
    sha256: createHash("sha256").update(valid.contents).digest("hex"),
  });
  assert.throws(() => readReviewedProductionBoundary("relative.json"), /absolute path/);
  assert.throws(() => readReviewedProductionBoundary(
    path.resolve("config/public-config.production.example.json"),
  ), /outside the repository/);

  const duplicate = boundaryFixture(t,
    '{"schemaVersion":1,"mainEdgeOrigin":"https://one.example","mainEdgeOrigin":"https://two.example","financeWebOrigin":"https://finance.example","telegramMiniAppUrl":"https://t.me/architectureproductionbot?startapp"}\n',
  );
  assert.throws(() => readReviewedProductionBoundary(duplicate.file), /duplicate key/);

  const extra = boundaryFixture(t, { ...PRODUCTION_BOUNDARY, extra: true });
  assert.throws(() => readReviewedProductionBoundary(extra.file), /keys must be exactly/);

  const writable = boundaryFixture(t);
  chmodSync(writable.file, 0o666);
  assert.throws(() => readReviewedProductionBoundary(writable.file), /group- or world-writable/);

  const target = boundaryFixture(t);
  const link = path.join(target.directory, "linked-boundary.json");
  symlinkSync(target.file, link);
  assert.throws(() => readReviewedProductionBoundary(link), /non-symlink/);
});

test("target descriptor is exact, external and cryptographically bound to production boundary", (t) => {
  const boundaryFile = boundaryFixture(t);
  const boundary = readReviewedProductionBoundary(boundaryFile.file);
  const valid = targetFixture(t, boundaryFile);
  const reviewed = readReviewedTargetDescriptor(valid.file, boundary);
  assert.equal(reviewed.environment, "staging");
  assert.equal(reviewed.mainSupabaseOrigin, STAGING_ORIGIN);
  assert.equal(reviewed.productionBoundarySha256, boundary.sha256);

  const duplicate = targetFixture(t, boundaryFile, {
    source: `{"schemaVersion":1,"environment":"staging","mainEdgeOrigin":"${STAGING_ORIGIN}","mainEdgeOrigin":"https://attacker.example","productionBoundarySha256":"${boundary.sha256}"}\n`,
  });
  assert.throws(() => readReviewedTargetDescriptor(duplicate.file, boundary), /duplicate key/);

  assert.throws(() => readReviewedTargetDescriptor(
    path.resolve("config/public-config.staging.example.json"),
    boundary,
  ), /outside the repository/);

  const extra = targetFixture(t, boundaryFile, {
    source: {
      schemaVersion: 1,
      environment: "staging",
      mainEdgeOrigin: STAGING_ORIGIN,
      productionBoundarySha256: boundary.sha256,
      extra: true,
    },
  });
  assert.throws(() => readReviewedTargetDescriptor(extra.file, boundary), /keys must be exactly/);

  const staleBoundary = targetFixture(t, boundaryFile, {
    source: {
      schemaVersion: 1,
      environment: "staging",
      mainEdgeOrigin: STAGING_ORIGIN,
      productionBoundarySha256: "0".repeat(64),
    },
  });
  assert.throws(() => readReviewedTargetDescriptor(staleBoundary.file, boundary), /does not match/);

  const trailingDot = targetFixture(t, boundaryFile, {
    source: {
      schemaVersion: 1,
      environment: "staging",
      mainEdgeOrigin: "https://staging-main.example.",
      productionBoundarySha256: boundary.sha256,
    },
  });
  assert.throws(() => readReviewedTargetDescriptor(trailingDot.file, boundary), /exact HTTPS origin/);

  const productionMismatch = targetFixture(t, boundaryFile, {
    environment: "production",
    mainEdgeOrigin: STAGING_ORIGIN,
  });
  assert.throws(
    () => readReviewedTargetDescriptor(productionMismatch.file, boundary),
    /production target must exactly match/,
  );

  const unclassified = targetFixture(t, boundaryFile, {
    source: {
      schemaVersion: 1,
      environment: "qa",
      mainEdgeOrigin: "https://qa-main.example",
      productionBoundarySha256: boundary.sha256,
    },
  });
  assert.throws(
    () => readReviewedTargetDescriptor(unclassified.file, boundary),
    /environment must be staging or production/,
  );

  const writable = targetFixture(t, boundaryFile);
  chmodSync(writable.file, 0o666);
  assert.throws(() => readReviewedTargetDescriptor(writable.file, boundary), /group- or world-writable/);

  const target = targetFixture(t, boundaryFile);
  const link = path.join(target.directory, "linked-target.json");
  symlinkSync(target.file, link);
  assert.throws(() => readReviewedTargetDescriptor(link, boundary), /non-symlink/);
});

test("status and apply reject attacker, trailing-dot and mismatched origins before secrets or fetch", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const attempts = [
    { label: "attacker", origin: "https://attacker.example" },
    { label: "trailing-dot", origin: "https://staging-main.example." },
    { label: "canonical mismatch", origin: "https://STAGING-MAIN.example" },
  ];

  for (const { label, origin } of attempts) {
    for (const action of ["status", "apply"]) {
      let secretReads = 0;
      let fetches = 0;
      const hostileEnvironment = { MAIN_SUPABASE_URL: origin };
      for (const name of [
        "MAIN_SERVICE_ROLE_KEY",
        "MAIN_FINANCE_PRIVACY_HMAC_KEY",
        "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
      ]) {
        Object.defineProperty(hostileEnvironment, name, {
          get() {
            secretReads += 1;
            throw new Error(`${name} must not be read for ${label} ${action}`);
          },
        });
      }
      const argv = action === "status"
        ? [
          "status", "--user-id", USER_ID, "--event-id", EVENT_ID,
          "--target-config", target.file,
          "--production-boundary", boundary.file,
        ]
        : args("grant", [
          "--target-config", target.file,
          "--production-boundary", boundary.file,
          "--apply",
        ]);

      await assert.rejects(manageFinanceAccess({
        argv,
        environment: hostileEnvironment,
        fetchImpl: async () => {
          fetches += 1;
          throw new Error(`network must not be reached for ${label} ${action}`);
        },
      }), /MAIN_SUPABASE_URL/);
      assert.equal(secretReads, 0, `${label} ${action} must read zero secrets`);
      assert.equal(fetches, 0, `${label} ${action} must make zero requests`);
    }
  }
});

test("status uses only the read-only exact status RPC", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse(statusValue({
      currentVersion: "3",
      desiredState: "granted",
      appliedVersion: "2",
      appliedState: "revoked",
      event: {
        event_id: EVENT_ID,
        version: "3",
        desired_state: "granted",
        state: "pending",
      },
    }));
  };
  const result = await manageFinanceAccess({
    argv: [
      "status", "--user-id", USER_ID, "--event-id", EVENT_ID,
      "--target-config", target.file,
      "--production-boundary", boundary.file,
    ],
    environment: {
      MAIN_SUPABASE_URL: STAGING_ORIGIN,
      MAIN_SERVICE_ROLE_KEY: SERVICE_KEY,
    },
    fetchImpl,
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `${STAGING_ORIGIN}/rest/v1/rpc/architecture_get_finance_access_status_internal`,
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    p_main_user_id: USER_ID,
    p_event_id: EVENT_ID,
  });
  assert.equal(result.mode, "status");
  assert.equal(result.event.event_id, EVENT_ID);
  assert.equal(result.event.state, "pending");
});

test("staging apply preflights version and writes only the keyed digest through outbox", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const calls = [];
  const responses = [
    statusValue(),
    { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID },
    { ok: true, replayed: false, event_id: EVENT_ID, version: "1", state: "pending" },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse(responses[calls.length - 1]);
  };
  const result = await manageFinanceAccess({
    argv: args("grant", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
    ]),
    environment,
    fetchImpl,
  });
  assert.equal(result.mode, "applied");
  assert.equal(result.target_environment, "staging");
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /architecture_get_finance_access_status_internal$/);
  assert.match(calls[1].url, /architecture_resolve_finance_subject_internal$/);
  assert.match(calls[2].url, /architecture_set_finance_access_desired_internal$/);
  const desired = JSON.parse(calls[2].options.body);
  const expectedDigest = createHmac("sha256", PRIVACY_KEY)
    .update(`main-telegram-subject-v1\n${TELEGRAM_ID}`)
    .digest("hex");
  assert.deepEqual(desired, {
    p_event_id: EVENT_ID,
    p_main_user_id: USER_ID,
    p_subject_digest: `\\x${expectedDigest}`,
    p_desired_state: "granted",
    p_changed_by: "operator:test",
    p_change_reason: "isolated staging pilot",
    p_expected_version: "0",
  });
  assert.doesNotMatch(calls[2].url, /architecture_upsert_product_entitlement_internal/);
  const publicResult = JSON.stringify(result);
  assert.doesNotMatch(publicResult, new RegExp(TELEGRAM_ID));
  assert.doesNotMatch(publicResult, new RegExp(expectedDigest));
  assert.doesNotMatch(publicResult, /service-key|privacy-key/);
});

test("dispatch targets one event and reads status without replaying the setter", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const calls = [];
  const responses = [
    statusValue({ currentVersion: "6", desiredState: "granted" }),
    { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID },
    { ok: true, replayed: false, event_id: EVENT_ID, version: "7", state: "pending" },
    { ok: true, claimed: 1, applied: 1, retried: 0, dead_lettered: 0 },
    statusValue({
      currentVersion: "7",
      desiredState: "revoked",
      appliedVersion: "7",
      appliedState: "revoked",
      event: {
        event_id: EVENT_ID,
        version: "7",
        desired_state: "revoked",
        state: "applied",
      },
    }),
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse(responses[calls.length - 1]);
  };
  const result = await manageFinanceAccess({
    argv: args("revoke", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
      "--dispatch",
    ]),
    environment,
    fetchImpl,
  });
  assert.equal(result.state, "applied");
  assert.equal(calls.length, 5);
  assert.match(calls[2].url, /architecture_set_finance_access_desired_internal$/);
  assert.equal(calls[3].url, `${STAGING_ORIGIN}/functions/v1/finance-sync-entitlements`);
  assert.equal(calls[3].options.body, JSON.stringify({ event_id: EVENT_ID }));
  assert.equal(calls[3].options.headers["x-architecture-sync-trigger"], TRIGGER_KEY);
  assert.equal(Object.hasOwn(calls[3].options.headers, "Authorization"), false);
  assert.match(calls[4].url, /architecture_get_finance_access_status_internal$/);
  assert.equal(
    calls.filter(({ url }) => url.endsWith("architecture_set_finance_access_desired_internal")).length,
    1,
  );
});

test("zero-claim targeted dispatch remains pending and is never reported as delivered", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const responses = [
    statusValue({ currentVersion: "1", desiredState: "granted" }),
    { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID },
    { ok: true, replayed: false, event_id: EVENT_ID, version: "2", state: "pending" },
    { ok: true, claimed: 0, applied: 0, retried: 0, dead_lettered: 0 },
    statusValue({
      currentVersion: "2",
      desiredState: "revoked",
      event: {
        event_id: EVENT_ID,
        version: "2",
        desired_state: "revoked",
        state: "pending",
      },
    }),
  ];
  let call = 0;
  const result = await manageFinanceAccess({
    argv: args("revoke", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
      "--dispatch",
    ]),
    environment,
    fetchImpl: async () => jsonResponse(responses[call++]),
  });
  assert.equal(call, 5);
  assert.equal(result.state, "pending");
  assert.deepEqual(result.worker, {
    ok: true,
    claimed: 0,
    applied: 0,
    retried: 0,
    dead_lettered: 0,
  });
});

test("production apply requires boundary match, explicit flag and action-bound confirmation", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary, {
    environment: "production",
    mainEdgeOrigin: PRODUCTION_ORIGIN,
  });
  const productionEnvironment = {
    ...environment,
    MAIN_SUPABASE_URL: PRODUCTION_ORIGIN,
  };
  let calls = 0;
  await assert.rejects(manageFinanceAccess({
    argv: args("grant", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
    ]),
    environment: productionEnvironment,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must fail before network");
    },
  }), /requires --allow-production/);
  assert.equal(calls, 0);

  const responses = [
    statusValue(),
    { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID },
    { ok: true, replayed: false, event_id: EVENT_ID, version: "1", state: "pending" },
  ];
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(responses[requests.length - 1]);
  };
  await assert.rejects(manageFinanceAccess({
    argv: args("grant", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
      "--allow-production",
    ]),
    environment: productionEnvironment,
    fetchImpl,
    readProductionConfirmationImpl: async () => "wrong phrase",
  }), /did not match exactly/);
  assert.equal(requests.length, 2);

  requests.length = 0;
  let confirmation;
  const result = await manageFinanceAccess({
    argv: args("grant", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
      "--allow-production",
    ]),
    environment: productionEnvironment,
    fetchImpl,
    readProductionConfirmationImpl: async (request) => {
      confirmation = request;
      return request.expected;
    },
  });
  const boundarySha256 = createHash("sha256").update(boundary.contents).digest("hex");
  const targetDescriptorSha256 = createHash("sha256").update(target.contents).digest("hex");
  assert.equal(confirmation.expected, productionConfirmationPhrase({
    action: "grant",
    userId: USER_ID,
    eventId: EVENT_ID,
    boundarySha256,
    targetDescriptorSha256,
    dispatch: false,
  }));
  assert.match(
    confirmation.expected,
    new RegExp(`${EVENT_ID}.*${boundarySha256}.*${targetDescriptorSha256}.*NO-DISPATCH$`),
  );
  assert.equal(result.target_environment, "production");
  assert.equal(requests.length, 3);
});

test("version conflict and response drift fail closed without worker", async (t) => {
  const boundary = boundaryFixture(t);
  const target = targetFixture(t, boundary);
  const responses = [
    statusValue({ currentVersion: "4", desiredState: "granted" }),
    { ok: true, main_user_id: USER_ID, telegram_id: TELEGRAM_ID },
    { ok: false, error: "version_conflict" },
  ];
  let call = 0;
  await assert.rejects(manageFinanceAccess({
    argv: args("revoke", [
      "--target-config", target.file,
      "--production-boundary", boundary.file,
      "--apply",
    ]),
    environment,
    fetchImpl: async () => jsonResponse(responses[call++]),
  }), /version_conflict/);
  assert.equal(call, 3);

  await assert.rejects(manageFinanceAccess({
    argv: [
      "status", "--user-id", USER_ID, "--event-id", EVENT_ID,
      "--target-config", target.file,
      "--production-boundary", boundary.file,
    ],
    environment,
    fetchImpl: async () => jsonResponse({ ...statusValue(), extra: true }),
  }), /status contract failed/);
});

test("operator paths never call the legacy direct-upsert source of truth", () => {
  const cli = readFileSync("scripts/manage-finance-access.mjs", "utf8");
  const worker = readFileSync("supabase/functions/finance-sync-entitlements/index.ts", "utf8");
  const runbook = readFileSync("supabase/INTEGRATION_RUNBOOK.md", "utf8");
  assert.doesNotMatch(cli, /architecture_upsert_product_entitlement_internal/);
  assert.doesNotMatch(worker, /architecture_upsert_product_entitlement_internal/);
  assert.match(runbook, /Прямой вызов `architecture_upsert_product_entitlement_internal` запрещён/);
});
