import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  operateStagingGates,
  STAGING_GATE_BOUNDARY,
} from "../../scripts/staging-gates.mjs";
import {
  PRESERVATION_MANIFEST,
  STAGING_REVOKE_SQL,
} from "../../scripts/staging-revoke-live-proof.mjs";

const FINANCE_REF = "makgsbjduobcphuqzaoq";
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_PRODUCTION_REF = "koibxwgtihwajocxfetb";
const MAIN_PRODUCTION_REF = "soxtekhspohkddpdidvp";
const NOW = new Date("2026-07-28T04:00:00.000Z");
const REVOKE_EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const SUBJECT_DIGEST = "a".repeat(64);
const PROFILE_ID = "123e4567-e89b-42d3-a456-426614174001";
const ENABLED_SHA256 = sha256("enabled");
const DISABLED_SHA256 = sha256("disabled");
const GATE_SPECS = Object.freeze([
  Object.freeze({
    projectRef: FINANCE_REF,
    secretName: "FINANCE_ENTITLEMENT_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_REF,
    secretName: "MAIN_FINANCE_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: FINANCE_REF,
    secretName: "FINANCE_TELEGRAM_PROTOCOL_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_REF,
    secretName: "MAIN_FINANCE_PROTOCOL_MODE",
  }),
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function temporaryPrivateDirectory(t, prefix = "staging-gates-") {
  const directory = realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)));
  chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function operatorArgs(action, receiptDir, extras = []) {
  return [
    action,
    "--receipt-dir",
    receiptDir,
    "--supabase-cli",
    realpathSync(process.execPath),
    ...(["attest", "capture-revoke-baseline"].includes(action)
      ? []
      : ["--apply"]),
    ...extras,
  ];
}

function fakeSupabase({
  initial = "dddd",
  failMutation = false,
  applyThenFailFirstPostList = false,
  driftUnrelatedAfterMutation = false,
  listRowTransform = row => row,
  listOutputTransform = rows => rows,
} = {}) {
  const states = new Map();
  const updatedAt = new Map();
  for (const [index, gate] of GATE_SPECS.entries()) {
    states.set(gate.secretName, initial[index] === "e" ? "enabled" : "disabled");
    updatedAt.set(
      gate.secretName,
      `2026-07-28T03:00:0${index}.000000Z`,
    );
  }
  const calls = [];
  let mutationCalls = 0;
  let failNextList = false;
  const runCli = (_cli, args, environment) => {
    calls.push({ args: [...args], environment: { ...environment } });
    if (args[0] === "--version") {
      return { status: 0, signal: null, error: null, stdout: "2.109.1\n" };
    }
    if (args[0] === "secrets" && args[1] === "list") {
      if (failNextList) {
        failNextList = false;
        return { status: 76, signal: null, error: null, stdout: "" };
      }
      const projectRef = args[args.indexOf("--project-ref") + 1];
      const rows = GATE_SPECS.filter(gate => gate.projectRef === projectRef)
        .map(gate => listRowTransform({
          name: gate.secretName,
          updated_at: updatedAt.get(gate.secretName),
          value: states.get(gate.secretName) === "enabled"
            ? ENABLED_SHA256
            : DISABLED_SHA256,
        }));
      return {
        status: 0,
        signal: null,
        error: null,
        stdout: JSON.stringify(listOutputTransform(rows)),
      };
    }
    if (args[0] === "secrets" && args[1] === "set") {
      mutationCalls += 1;
      assert.equal(
        args.filter(value => value === "--project-ref").length,
        1,
      );
      assert.equal(args.includes(FINANCE_PRODUCTION_REF), false);
      assert.equal(args.includes(MAIN_PRODUCTION_REF), false);
      if (failMutation) {
        return { status: 75, signal: null, error: null, stdout: "" };
      }
      const [secretName, desiredState] = args[2].split("=");
      assert.equal(states.has(secretName), true);
      states.set(secretName, desiredState);
      updatedAt.set(
        secretName,
        `2026-07-28T03:10:${String(mutationCalls).padStart(2, "0")}.123456Z`,
      );
      if (driftUnrelatedAfterMutation) {
        const unrelated = GATE_SPECS.find(
          gate => gate.secretName !== secretName,
        ).secretName;
        updatedAt.set(
          unrelated,
          "2026-07-28T03:11:00.654321Z",
        );
      }
      if (applyThenFailFirstPostList) failNextList = true;
      return { status: 0, signal: null, error: null, stdout: "" };
    }
    throw new Error(`unexpected fake CLI command: ${args.join(" ")}`);
  };
  return {
    calls,
    states,
    runCli,
    get mutationCalls() {
      return mutationCalls;
    },
  };
}

function readReceipts(directory) {
  return readdirSync(directory)
    .filter(name => /^[0-9]{6}\.json$/u.test(name))
    .sort()
    .map(name => JSON.parse(readFileSync(path.join(directory, name), "utf8")));
}

function preservationSnapshot() {
  return PRESERVATION_MANIFEST.preservedTables.map(table => ({
    table,
    rowCount: "0",
    contentSha256: sha256(table),
  }));
}

function catalogFields(databaseClock) {
  return {
    database_role: "supabase_read_only_user",
    database_clock: databaseClock,
    catalog_table_count: "133",
    catalog_sha256:
      "1d661c60bd419d9a82e7013e82e48c7a859296bf5abd3f5dbe9dff0aa59fe576",
    manifest_table_count: "127",
    manifest_sha256: PRESERVATION_MANIFEST.manifestSha256,
    preservation_snapshot: preservationSnapshot(),
  };
}

function mainProofRow(databaseClock) {
  return {
    database_role: "supabase_read_only_user",
    database_clock: databaseClock,
    event_count: "1",
    outbox_event_id: REVOKE_EVENT_ID,
    subject_digest: SUBJECT_DIGEST,
    outbox_version: "2",
    outbox_desired_state: "revoked",
    outbox_state: "applied",
    outbox_created_at: "2026-07-28T03:45:00.000Z",
    outbox_updated_at: "2026-07-28T03:51:00.000Z",
    outbox_applied_at: "2026-07-28T03:51:00.000Z",
    desired_count: "1",
    desired_last_event_id: REVOKE_EVENT_ID,
    desired_version: "2",
    desired_state: "revoked",
    desired_applied_version: "2",
    desired_applied_state: "revoked",
    desired_applied_at: "2026-07-28T03:51:00.000Z",
    desired_updated_at: "2026-07-28T03:51:00.000Z",
    entitlement_count: "1",
    entitlement_status: "blocked",
    entitlement_active_from: null,
    entitlement_active_until: null,
    entitlement_updated_at: "2026-07-28T03:51:00.000Z",
    global_counts: {
      pending: "0",
      retry_wait: "0",
      processing: "0",
      dead_letter: "0",
      non_applied: "0",
      unknown: "0",
      desired_not_converged: "0",
      managed_gate_mismatch: "0",
    },
  };
}

function financeProofRow() {
  return {
    ...catalogFields("2026-07-28T03:56:00.000Z"),
    event_count: "1",
    event_id: REVOKE_EVENT_ID,
    subject_digest: SUBJECT_DIGEST,
    product_code: "architecture_finance",
    event_version: "2",
    event_action: "revoke",
    requested_active_until: null,
    event_occurred_at: "2026-07-28T03:45:00.000Z",
    profile_id: PROFILE_ID,
    outcome: "applied",
    error_code: null,
    resulting_status: "blocked",
    processed_at: "2026-07-28T03:50:00.000Z",
    binding_count: "1",
    binding_profile_id: PROFILE_ID,
    binding_last_event_version: "2",
    binding_last_event_id: REVOKE_EVENT_ID,
    binding_last_action: "revoke",
    binding_current_status: "blocked",
    binding_active_until: null,
    binding_last_event_occurred_at: "2026-07-28T03:45:00.000Z",
    binding_updated_at: "2026-07-28T03:50:00.000Z",
    entitlement_count: "1",
    entitlement_status: "blocked",
    entitlement_active_from: "2026-07-28T03:10:00.000Z",
    entitlement_active_until: "2026-07-28T03:45:00.000Z",
    entitlement_updated_at: "2026-07-28T03:50:00.000Z",
    target_auth_user_count: "1",
    active_counts: {
      active_entitlements: "0",
      active_v2_codes: "0",
      active_legacy_codes: "0",
      active_devices: "0",
      pending_issuer_requests: "0",
      apply_authorizations: "0",
      rebind_authorizations: "0",
      auth_sessions: "0",
      refresh_tokens: "0",
      mfa_amr_claims: "0",
      one_time_tokens: "0",
      mfa_challenges: "0",
      flow_states: "0",
      saml_relay_states: "0",
    },
  };
}

function fakeManagementApi({
  baselineTransform = row => row,
  mainATransform = row => row,
  financeTransform = row => row,
  mainBTransform = row => row,
  status = 201,
  contentType = "application/json",
} = {}) {
  const calls = [];
  let mainCount = 0;
  const fetchImpl = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, options, request });
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(
      options.headers.Authorization,
      "Bearer fixture-access-token-1234567890",
    );
    let row;
    if (request.query === STAGING_REVOKE_SQL.financeBaseline) {
      assert.equal(url, `https://api.supabase.com/v1/projects/${FINANCE_REF}/database/query/read-only`);
      assert.deepEqual(request.parameters, []);
      row = baselineTransform(
        catalogFields("2026-07-28T03:40:00.000Z"),
      );
    } else if (request.query === STAGING_REVOKE_SQL.mainFinal) {
      assert.equal(url, `https://api.supabase.com/v1/projects/${MAIN_REF}/database/query/read-only`);
      assert.deepEqual(request.parameters, [REVOKE_EVENT_ID]);
      mainCount += 1;
      row = mainCount === 1
        ? mainATransform(mainProofRow("2026-07-28T03:55:00.000Z"))
        : mainBTransform(mainProofRow("2026-07-28T03:57:00.000Z"));
    } else if (request.query === STAGING_REVOKE_SQL.financeFinal) {
      assert.equal(url, `https://api.supabase.com/v1/projects/${FINANCE_REF}/database/query/read-only`);
      assert.deepEqual(request.parameters, [REVOKE_EVENT_ID]);
      row = financeTransform(financeProofRow());
    } else {
      throw new Error("unexpected Management API SQL");
    }
    return new Response(JSON.stringify([row]), {
      status,
      headers: { "content-type": contentType },
    });
  };
  return { calls, fetchImpl };
}

function liveEnvironment() {
  return {
    PATH: "/usr/bin:/bin",
    HOME: "/private/tmp/fixture-supabase-home",
    TMPDIR: "/private/tmp/fixture-tmp",
    NO_COLOR: "1",
    SUPABASE_ACCESS_TOKEN: "fixture-access-token-1234567890",
  };
}

async function prepareMainSyncRollbackBarrier(t, api) {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  for (let index = 0; index < 4; index += 1) {
    await operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    });
  }
  await operateStagingGates(
    operatorArgs("capture-revoke-baseline", receiptDir, [
      "--revoke-event-id",
      REVOKE_EVENT_ID,
    ]),
    {
      runCli: fake.runCli,
      fetchImpl: api.fetchImpl,
      now: () => NOW,
      environment: liveEnvironment(),
    },
  );
  await operateStagingGates(operatorArgs("rollback", receiptDir), {
    runCli: fake.runCli,
    now: () => NOW,
  });
  return { fake, receiptDir };
}

test("read-only attest performs exact two staging lists and writes a canonical private receipt", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  const result = await operateStagingGates(
    operatorArgs("attest", receiptDir),
    {
      runCli: fake.runCli,
      now: () => NOW,
      environment: {
        PATH: "/usr/bin:/bin",
        HOME: "/private/tmp/fixture-supabase-home",
        TMPDIR: "/private/tmp/fixture-tmp",
        LANG: "en_US.UTF-8",
        NO_COLOR: "1",
        SUPABASE_ACCESS_TOKEN: "fixture-token",
        SUPABASE_PROJECT_REF: MAIN_PRODUCTION_REF,
        SUPABASE_URL: `https://${MAIN_PRODUCTION_REF}.supabase.co`,
        PGHOST: "production.invalid",
        DATABASE_URL: "postgresql://production.invalid/database",
        AWS_SECRET_ACCESS_KEY: "must-not-reach-cli",
        TELEGRAM_BOT_TOKEN: "must-not-reach-cli",
        CLOUDFLARE_API_TOKEN: "must-not-reach-cli",
        RANDOM_OPERATOR_SECRET: "must-not-reach-cli",
      },
    },
  );

  assert.equal(result.mode, "attested");
  assert.equal(result.productionTouched, false);
  assert.equal(fake.mutationCalls, 0);
  assert.deepEqual(fake.calls.map(call => call.args.slice(0, 2)), [
    ["--version"],
    ["secrets", "list"],
    ["secrets", "list"],
  ]);
  for (const call of fake.calls) {
    assert.deepEqual(call.environment, {
      PATH: "/usr/bin:/bin",
      HOME: "/private/tmp/fixture-supabase-home",
      TMPDIR: "/private/tmp/fixture-tmp",
      LANG: "en_US.UTF-8",
      NO_COLOR: "1",
      SUPABASE_ACCESS_TOKEN: "fixture-token",
    });
  }
  for (const listCall of fake.calls.filter(
    call => call.args[0] === "secrets" && call.args[1] === "list",
  )) {
    assert.equal(listCall.args.includes("--output-format"), false);
    assert.deepEqual(listCall.args.slice(-2), ["--output", "json"]);
  }
  const [receipt] = readReceipts(receiptDir);
  assert.equal(receipt.hostedMutationCount, 0);
  assert.equal(receipt.productionDenied, true);
  assert.deepEqual(Object.keys(receipt.attestation.gateUpdatedAt).sort(), [
    "financeEntitlementSync",
    "financeTelegramProtocol",
    "mainFinanceProtocol",
    "mainFinanceSync",
  ]);
  assert.equal(
    receipt.attestation.gateSetSha256,
    sha256(canonicalJson({
      gateStates: receipt.attestation.gateStates,
      gateUpdatedAt: receipt.attestation.gateUpdatedAt,
    })),
  );
  assert.equal(
    readFileSync(path.join(receiptDir, "000001.json"), "utf8"),
    `${canonicalJson(receipt)}\n`,
  );
  assert.equal(
    (await import("node:fs")).lstatSync(path.join(receiptDir, "000001.json")).mode & 0o777,
    0o600,
  );
});

test("secrets list parser accepts only the real CLI 2.109.1 name/updated_at/value JSON array", async t => {
  const scenarios = [
    fakeSupabase({
      listRowTransform: row => ({
        name: row.name,
        digest: row.value,
        updated_at: row.updated_at,
      }),
    }),
    fakeSupabase({
      listRowTransform: ({ name, value }) => ({ name, value }),
    }),
    fakeSupabase({
      listRowTransform: row => ({ ...row, created_at: row.updated_at }),
    }),
    fakeSupabase({
      listOutputTransform: rows => ({ secrets: rows }),
    }),
    fakeSupabase({
      listRowTransform: row => ({
        ...row,
        value: "not-a-sha256",
      }),
    }),
    fakeSupabase({
      listRowTransform: row => ({
        ...row,
        updated_at: "2026-07-28 04:00:00+00",
      }),
    }),
    fakeSupabase({
      listRowTransform: row => ({
        ...row,
        updated_at: "2026-02-30T04:00:00.000000Z",
      }),
    }),
  ];
  for (const [index, fake] of scenarios.entries()) {
    const receiptDir = temporaryPrivateDirectory(
      t,
      `staging-gates-list-contract-${index}-`,
    );
    await assert.rejects(
      operateStagingGates(operatorArgs("attest", receiptDir), {
        runCli: fake.runCli,
        now: () => NOW,
      }),
      /secrets list|digest differs|updated_at/,
    );
    assert.equal(fake.mutationCalls, 0);
  }
});

test("post-attestation detects timestamp drift on every unrelated gate", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase({ driftUnrelatedAfterMutation: true });
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    }),
    error => error.code === "STAGING_GATE_OUTCOME_UNKNOWN",
  );
  assert.equal(fake.mutationCalls, 1);
  const receipts = readReceipts(receiptDir);
  assert.equal(receipts.at(-1).status, "unknown");
  assert.notEqual(receipts.at(-1).postAttestation, null);
});

test("advance mutates exactly one gate per invocation in the four-gate reviewed order", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  const expected = [
    [FINANCE_REF, "FINANCE_ENTITLEMENT_SYNC_MODE=enabled"],
    [MAIN_REF, "MAIN_FINANCE_SYNC_MODE=enabled"],
    [FINANCE_REF, "FINANCE_TELEGRAM_PROTOCOL_MODE=enabled"],
    [MAIN_REF, "MAIN_FINANCE_PROTOCOL_MODE=enabled"],
  ];
  for (let index = 0; index < expected.length; index += 1) {
    const before = fake.mutationCalls;
    const result = await operateStagingGates(
      operatorArgs("advance", receiptDir),
      { runCli: fake.runCli, now: () => NOW },
    );
    assert.equal(result.mutationCount, 1);
    assert.equal(fake.mutationCalls - before, 1);
  }

  const mutationCalls = fake.calls
    .map(call => call.args)
    .filter(args => args[0] === "secrets" && args[1] === "set");
  assert.deepEqual(
    mutationCalls.map(args => [
      args[args.indexOf("--project-ref") + 1],
      args[2],
    ]),
    expected,
  );
  assert.equal(readReceipts(receiptDir).length, 8);
  const receipts = readReceipts(receiptDir);
  for (let index = 1; index < receipts.length; index += 1) {
    assert.equal(
      receipts[index].previousReceiptSha256,
      receipts[index - 1].receiptSha256,
    );
  }
});

test("unknown mutation outcome blocks retry until an explicit read-only reconciliation", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const failing = fakeSupabase({ failMutation: true });
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: failing.runCli,
      now: () => NOW,
    }),
    error => {
      assert.equal(error.code, "STAGING_GATE_OUTCOME_UNKNOWN");
      assert.match(error.message, /do not retry/i);
      return true;
    },
  );
  assert.equal(failing.mutationCalls, 1);
  const callsBeforeBlockedRetry = failing.calls.length;
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: failing.runCli,
      now: () => NOW,
    }),
    /requires read-only attest reconciliation/,
  );
  assert.equal(failing.calls.length, callsBeforeBlockedRetry);

  const reconciler = fakeSupabase();
  const reconciled = await operateStagingGates(
    operatorArgs("attest", receiptDir),
    { runCli: reconciler.runCli, now: () => NOW },
  );
  assert.equal(reconciled.mode, "reconciled");
  assert.equal(reconciled.outcome, "not_applied");
  assert.equal(reconciler.mutationCalls, 0);

  const resumed = await operateStagingGates(
    operatorArgs("advance", receiptDir),
    { runCli: reconciler.runCli, now: () => NOW },
  );
  assert.equal(resumed.mutationCount, 1);
  assert.equal(reconciler.mutationCalls, 1);
});

test("post-attestation loss is unknown even when the mutation applied, then reconciles as applied", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase({ applyThenFailFirstPostList: true });
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    }),
    error => error.code === "STAGING_GATE_OUTCOME_UNKNOWN",
  );
  assert.equal(fake.mutationCalls, 1);
  const reconciled = await operateStagingGates(
    operatorArgs("attest", receiptDir),
    { runCli: fake.runCli, now: () => NOW },
  );
  assert.equal(reconciled.outcome, "applied");
  assert.equal(fake.mutationCalls, 1);
});

test("rollback captures a live baseline and enforces the in-process Main A, Finance, Main B proof", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  const api = fakeManagementApi();
  for (let index = 0; index < 4; index += 1) {
    await operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    });
  }

  const baseline = await operateStagingGates(
    operatorArgs("capture-revoke-baseline", receiptDir, [
      "--revoke-event-id",
      REVOKE_EVENT_ID,
    ]),
    {
      runCli: fake.runCli,
      fetchImpl: api.fetchImpl,
      now: () => NOW,
      environment: liveEnvironment(),
    },
  );
  assert.equal(baseline.mode, "revoke-baseline-captured");
  assert.equal(baseline.hostedReadCount, 1);
  assert.equal(api.calls.length, 1);

  const first = await operateStagingGates(
    operatorArgs("rollback", receiptDir),
    { runCli: fake.runCli, now: () => NOW },
  );
  assert.equal(first.mutatedGate, "mainFinanceProtocol");
  const beforeBarrier = fake.mutationCalls;
  await assert.rejects(
    operateStagingGates(operatorArgs("rollback", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    }),
    /requires --revoke-event-id UUIDv4/,
  );
  assert.equal(fake.mutationCalls, beforeBarrier);

  const second = await operateStagingGates(
    operatorArgs("rollback", receiptDir, [
      "--revoke-event-id",
      REVOKE_EVENT_ID,
    ]),
    {
      runCli: fake.runCli,
      fetchImpl: api.fetchImpl,
      now: () => NOW,
      environment: liveEnvironment(),
    },
  );
  assert.equal(second.mutatedGate, "mainFinanceSync");
  assert.equal(api.calls.length, 4);
  const third = await operateStagingGates(
    operatorArgs("rollback", receiptDir),
    { runCli: fake.runCli, now: () => NOW },
  );
  assert.equal(third.mutatedGate, "financeTelegramProtocol");
  const fourth = await operateStagingGates(
    operatorArgs("rollback", receiptDir),
    { runCli: fake.runCli, now: () => NOW },
  );
  assert.equal(fourth.mutatedGate, "financeEntitlementSync");
  assert.deepEqual([...fake.states.values()], [
    "disabled",
    "disabled",
    "disabled",
    "disabled",
  ]);
  const receipts = readReceipts(receiptDir);
  const baselineReceipt = receipts.find(
    receipt => receipt.kind === "revoke-baseline",
  );
  const proofReceipt = receipts.find(
    receipt => receipt.kind === "revoke-proof",
  );
  const barrierIntent = receipts.find(receipt =>
    receipt.kind === "mutation-intent"
    && receipt.mutation.gateKey === "mainFinanceSync"
    && receipt.mutation.desiredState === "disabled");
  assert.equal(baselineReceipt.schemaVersion, 2);
  assert.equal(baselineReceipt.hostedReadCount, 1);
  assert.equal(
    baselineReceipt.liveBaseline.query.result.preservation_snapshot.length,
    127,
  );
  assert.equal(proofReceipt.hostedReadCount, 3);
  assert.equal(
    proofReceipt.baselineReceiptSha256,
    baselineReceipt.receiptSha256,
  );
  assert.equal(
    barrierIntent.revokeProofReceiptSha256,
    proofReceipt.receiptSha256,
  );
});

test("caller-supplied revoke proof files are no longer accepted", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase({ initial: "eeed" });
  await assert.rejects(
    operateStagingGates(
      operatorArgs("rollback", receiptDir, [
        "--revoke-proof",
        "/private/tmp/forged.json",
      ]),
      { runCli: fake.runCli, now: () => NOW },
    ),
    /unknown argument --revoke-proof/,
  );
  assert.equal(fake.calls.length, 0);
});

test("live revoke barrier fails closed on queue, Auth, retention and sandwich drift", async t => {
  const scenarios = [
    {
      name: "Main queue residue",
      api: fakeManagementApi({
        mainATransform: row => ({
          ...row,
          global_counts: { ...row.global_counts, pending: "1" },
        }),
      }),
      expected: /Main revoke state differs/,
    },
    {
      name: "Auth session residue",
      api: fakeManagementApi({
        financeTransform: row => ({
          ...row,
          active_counts: { ...row.active_counts, auth_sessions: "1" },
        }),
      }),
      expected: /Finance revoke state differs/,
    },
    {
      name: "Auth proof scope is empty",
      api: fakeManagementApi({
        financeTransform: row => ({
          ...row,
          target_auth_user_count: "0",
        }),
      }),
      expected: /Finance revoke state differs/,
    },
    {
      name: "preserved table drift",
      api: fakeManagementApi({
        financeTransform: row => ({
          ...row,
          preservation_snapshot: row.preservation_snapshot.map(
            (entry, index) => index === 0
              ? { ...entry, rowCount: "1" }
              : entry,
          ),
        }),
      }),
      expected: /cross-project revoke proof differs/,
    },
    {
      name: "Main sandwich drift",
      api: fakeManagementApi({
        mainBTransform: row => ({
          ...row,
          outbox_version: "3",
          desired_version: "3",
          desired_applied_version: "3",
        }),
      }),
      expected: /cross-project revoke proof differs/,
    },
  ];
  for (const scenario of scenarios) {
    const { fake, receiptDir } = await prepareMainSyncRollbackBarrier(
      t,
      scenario.api,
    );
    const before = fake.mutationCalls;
    await assert.rejects(
      operateStagingGates(
        operatorArgs("rollback", receiptDir, [
          "--revoke-event-id",
          REVOKE_EVENT_ID,
        ]),
        {
          runCli: fake.runCli,
          fetchImpl: scenario.api.fetchImpl,
          now: () => NOW,
          environment: liveEnvironment(),
        },
      ),
      scenario.expected,
      scenario.name,
    );
    assert.equal(fake.mutationCalls, before, scenario.name);
    assert.equal(
      readReceipts(receiptDir).some(receipt =>
        receipt.kind === "revoke-proof"),
      false,
      scenario.name,
    );
  }
});

test("baseline capture rejects non-201 Management API responses before writing a receipt", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase({ initial: "eeee" });
  const api = fakeManagementApi({ status: 200 });
  await assert.rejects(
    operateStagingGates(
      operatorArgs("capture-revoke-baseline", receiptDir, [
        "--revoke-event-id",
        REVOKE_EVENT_ID,
      ]),
      {
        runCli: fake.runCli,
        fetchImpl: api.fetchImpl,
        now: () => NOW,
        environment: liveEnvironment(),
      },
    ),
    /response boundary differs/,
  );
  assert.equal(fake.mutationCalls, 0);
  assert.equal(readReceipts(receiptDir).length, 0);
});

test("diverged reconciliation remains blocking until a later exact reconciliation", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const failing = fakeSupabase({ failMutation: true });
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: failing.runCli,
      now: () => NOW,
    }),
    error => error.code === "STAGING_GATE_OUTCOME_UNKNOWN",
  );

  const diverged = fakeSupabase({ initial: "eedd" });
  const firstReconciliation = await operateStagingGates(
    operatorArgs("attest", receiptDir),
    { runCli: diverged.runCli, now: () => NOW },
  );
  assert.equal(firstReconciliation.outcome, "diverged");
  const callsBeforeBlockedMutation = diverged.calls.length;
  await assert.rejects(
    operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: diverged.runCli,
      now: () => NOW,
    }),
    /requires read-only attest reconciliation/,
  );
  assert.equal(diverged.calls.length, callsBeforeBlockedMutation);

  const exact = fakeSupabase();
  const secondReconciliation = await operateStagingGates(
    operatorArgs("attest", receiptDir),
    { runCli: exact.runCli, now: () => NOW },
  );
  assert.equal(secondReconciliation.outcome, "not_applied");
  const resumed = await operateStagingGates(
    operatorArgs("advance", receiptDir),
    { runCli: exact.runCli, now: () => NOW },
  );
  assert.equal(resumed.mutationCount, 1);
});

test("a tampered receipt chain refuses every CLI call before hosted state is read", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  await operateStagingGates(operatorArgs("attest", receiptDir), {
    runCli: fake.runCli,
    now: () => NOW,
  });
  const file = path.join(receiptDir, "000001.json");
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  receipt.productionDenied = false;
  writeFileSync(file, `${canonicalJson(receipt)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);

  const fresh = fakeSupabase();
  await assert.rejects(
    operateStagingGates(operatorArgs("attest", receiptDir), {
      runCli: fresh.runCli,
      now: () => NOW,
    }),
    /self-hash differs/,
  );
  assert.equal(fresh.calls.length, 0);
});

test("compiled boundary contains only exact staging refs and the two production refs are denied", () => {
  assert.deepEqual(STAGING_GATE_BOUNDARY, {
    financeStagingRef: FINANCE_REF,
    mainStagingRef: MAIN_REF,
    productionDenyRefs: [FINANCE_PRODUCTION_REF, MAIN_PRODUCTION_REF],
  });
});
