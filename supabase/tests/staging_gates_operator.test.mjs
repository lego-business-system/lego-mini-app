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
  validateStagingRevokeProof,
} from "../../scripts/staging-gates.mjs";

const FINANCE_REF = "makgsbjduobcphuqzaoq";
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_PRODUCTION_REF = "koibxwgtihwajocxfetb";
const MAIN_PRODUCTION_REF = "soxtekhspohkddpdidvp";
const NOW = new Date("2026-07-28T04:00:00.000Z");
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
    ...(action === "attest" ? [] : ["--apply"]),
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

function revokeProof(t, overrides = {}) {
  const directory = temporaryPrivateDirectory(t, "staging-revoke-proof-");
  const core = {
    schemaVersion: 1,
    kind: "staging-revoke-proof-v1",
    environment: "staging",
    financeProjectRef: FINANCE_REF,
    mainProjectRef: MAIN_REF,
    financeCommitSha: "36981a9030a571cbf5269705f8875af9c866be3e",
    mainCommitSha: "c07dba9b10764b05719e89b1239b2873cca0a586",
    subjectTelegramIdHash: "a".repeat(64),
    entitlementEventId: "123e4567-e89b-42d3-a456-426614174000",
    mainOutboxState: "applied",
    financeEventState: "applied",
    desiredState: "revoked",
    appliedState: "revoked",
    queueCounts: {
      pending: 0,
      retry_wait: 0,
      processing: 0,
      dead_letter: 0,
    },
    activeCounts: {
      activeCodes: 0,
      activeDevices: 0,
      activeSessions: 0,
    },
    financialDataRetained: true,
    observedAt: NOW.toISOString(),
    ...overrides,
  };
  const proof = {
    ...core,
    proofSha256: sha256(canonicalJson(core)),
  };
  const file = path.join(directory, "revoke-proof.json");
  writeFileSync(file, `${canonicalJson(proof)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
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

test("rollback is resumable and enforces the fresh revoke proof before Main sync is disabled", async t => {
  const receiptDir = temporaryPrivateDirectory(t);
  const fake = fakeSupabase();
  for (let index = 0; index < 4; index += 1) {
    await operateStagingGates(operatorArgs("advance", receiptDir), {
      runCli: fake.runCli,
      now: () => NOW,
    });
  }

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
    /requires a fresh canonical revoke proof/,
  );
  assert.equal(fake.mutationCalls, beforeBarrier);

  const proof = revokeProof(t);
  const second = await operateStagingGates(
    operatorArgs("rollback", receiptDir, ["--revoke-proof", proof]),
    { runCli: fake.runCli, now: () => NOW },
  );
  assert.equal(second.mutatedGate, "mainFinanceSync");
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
});

test("revoke proof rejects raw identifiers, stale observations, queue residue and wrong commits", t => {
  const scenarios = [
    { telegramId: "123456789" },
    { observedAt: "2026-07-28T03:44:59.000Z" },
    { queueCounts: { pending: 0, retry_wait: 0, processing: 0, dead_letter: 1 } },
    { mainCommitSha: "0".repeat(40) },
    { financialDataRetained: false },
  ];
  for (const overrides of scenarios) {
    const file = revokeProof(t, overrides);
    assert.throws(
      () => validateStagingRevokeProof(file, { now: NOW }),
      /revoke proof/,
    );
  }
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
