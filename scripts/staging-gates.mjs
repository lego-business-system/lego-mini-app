#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  captureLiveRevokeBaseline,
  validateLiveRevokeBaseline,
  validateLiveRevokeProof,
  verifyLiveRevoke,
} from "./staging-revoke-live-proof.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");

export const STAGING_GATE_BOUNDARY = Object.freeze({
  financeStagingRef: "makgsbjduobcphuqzaoq",
  mainStagingRef: "bljeoovhydhjhdzwplxh",
  productionDenyRefs: Object.freeze([
    "koibxwgtihwajocxfetb",
    "soxtekhspohkddpdidvp",
  ]),
});

const FINANCE_COMMIT_SHA =
  "2c2f68356a4021a59904382ea6af4b0892c17d84";
const MAIN_COMMIT_SHA =
  "92ca53aea17a0e5a4e72f4252a59433a26ab5a8b";
const CLI_VERSION = "2.109.1";
const ENABLED = "enabled";
const DISABLED = "disabled";
const ENABLED_SHA256 = sha256(ENABLED);
const DISABLED_SHA256 = sha256(DISABLED);
const RECEIPT_PATTERN = /^([0-9]{6})\.json$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CLI_ENVIRONMENT_ALLOWLIST = Object.freeze(new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
  "SUPABASE_ACCESS_TOKEN",
]));

const GATES = Object.freeze([
  Object.freeze({
    key: "financeEntitlementSync",
    projectRef: STAGING_GATE_BOUNDARY.financeStagingRef,
    secretName: "FINANCE_ENTITLEMENT_SYNC_MODE",
  }),
  Object.freeze({
    key: "mainFinanceSync",
    projectRef: STAGING_GATE_BOUNDARY.mainStagingRef,
    secretName: "MAIN_FINANCE_SYNC_MODE",
  }),
  Object.freeze({
    key: "financeTelegramProtocol",
    projectRef: STAGING_GATE_BOUNDARY.financeStagingRef,
    secretName: "FINANCE_TELEGRAM_PROTOCOL_MODE",
  }),
  Object.freeze({
    key: "mainFinanceProtocol",
    projectRef: STAGING_GATE_BOUNDARY.mainStagingRef,
    secretName: "MAIN_FINANCE_PROTOCOL_MODE",
  }),
]);

const STATES = Object.freeze({
  allDisabled: "disabled,disabled,disabled,disabled",
  financeSyncOnly: "enabled,disabled,disabled,disabled",
  syncEnabled: "enabled,enabled,disabled,disabled",
  financeProtocolOnly: "enabled,enabled,enabled,disabled",
  fullyEnabled: "enabled,enabled,enabled,enabled",
  rollbackSyncOff: "enabled,disabled,enabled,disabled",
});

const ADVANCE_TRANSITIONS = Object.freeze({
  [STATES.allDisabled]: Object.freeze({
    gateKey: "financeEntitlementSync",
    desiredState: ENABLED,
  }),
  [STATES.financeSyncOnly]: Object.freeze({
    gateKey: "mainFinanceSync",
    desiredState: ENABLED,
  }),
  [STATES.syncEnabled]: Object.freeze({
    gateKey: "financeTelegramProtocol",
    desiredState: ENABLED,
  }),
  [STATES.financeProtocolOnly]: Object.freeze({
    gateKey: "mainFinanceProtocol",
    desiredState: ENABLED,
  }),
});

function refuse(message) {
  throw new Error(`Staging gate operator refused: ${message}`);
}

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

function isCanonicalUtcTimestamp(value) {
  if (
    typeof value !== "string"
    || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$/u
      .test(value)
  ) return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds)
    && new Date(milliseconds).toISOString().slice(0, 19)
      === value.slice(0, 19)
  );
}

function attestationHash(gateStates, gateUpdatedAt) {
  return sha256(canonicalJson({ gateStates, gateUpdatedAt }));
}

function exactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([...expected].sort())
  ) refuse(`${label} keys differ`);
}

function stateKey(gateStates) {
  return GATES.map(gate => gateStates[gate.key]).join(",");
}

function gateByKey(key) {
  const gate = GATES.find(item => item.key === key);
  if (!gate) refuse("internal gate inventory differs");
  return gate;
}

function assertExactStagingBoundary() {
  if (
    STAGING_GATE_BOUNDARY.financeStagingRef !== "makgsbjduobcphuqzaoq"
    || STAGING_GATE_BOUNDARY.mainStagingRef !== "bljeoovhydhjhdzwplxh"
    || JSON.stringify(STAGING_GATE_BOUNDARY.productionDenyRefs)
      !== JSON.stringify(["koibxwgtihwajocxfetb", "soxtekhspohkddpdidvp"])
    || STAGING_GATE_BOUNDARY.productionDenyRefs.includes(
      STAGING_GATE_BOUNDARY.financeStagingRef,
    )
    || STAGING_GATE_BOUNDARY.productionDenyRefs.includes(
      STAGING_GATE_BOUNDARY.mainStagingRef,
    )
  ) refuse("compiled staging/production boundary differs");
}

function parseArguments(argv) {
  if (argv.includes("--help")) return Object.freeze({ action: "help" });
  const [action, ...rest] = argv;
  if (![
    "attest",
    "capture-revoke-baseline",
    "advance",
    "rollback",
  ].includes(action)) {
    refuse(
      "first argument must be attest, capture-revoke-baseline, advance or rollback",
    );
  }
  const input = {
    action,
    apply: false,
    receiptDir: null,
    supabaseCli: null,
    revokeEventId: null,
  };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--apply") {
      if (seen.has(argument)) refuse("duplicate --apply");
      seen.add(argument);
      input.apply = true;
      continue;
    }
    if (![
      "--receipt-dir",
      "--supabase-cli",
      "--revoke-event-id",
    ].includes(argument)) {
      refuse(`unknown argument ${argument}`);
    }
    if (seen.has(argument)) refuse(`duplicate ${argument}`);
    seen.add(argument);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) refuse(`${argument} requires a value`);
    if (argument === "--receipt-dir") input.receiptDir = value;
    else if (argument === "--supabase-cli") input.supabaseCli = value;
    else input.revokeEventId = value;
    index += 1;
  }
  if (!input.receiptDir) refuse("--receipt-dir is required");
  if (!input.supabaseCli) refuse("--supabase-cli is required");
  if (
    input.revokeEventId !== null
    && !UUID_V4.test(input.revokeEventId)
  ) refuse("--revoke-event-id must be UUIDv4");
  if (action === "attest" && (input.apply || input.revokeEventId)) {
    refuse("attest is read-only and rejects --apply and --revoke-event-id");
  }
  if (action === "capture-revoke-baseline") {
    if (input.apply) {
      refuse("capture-revoke-baseline is read-only and rejects --apply");
    }
    if (!input.revokeEventId) {
      refuse("capture-revoke-baseline requires --revoke-event-id UUIDv4");
    }
  }
  if (
    !["attest", "capture-revoke-baseline"].includes(action)
    && !input.apply
  ) {
    refuse(`${action} requires explicit --apply`);
  }
  if (action === "advance" && input.revokeEventId) {
    refuse("advance rejects --revoke-event-id");
  }
  return Object.freeze(input);
}

function assertExecutable(file) {
  if (
    typeof file !== "string"
    || !path.isAbsolute(file)
    || path.resolve(file) !== file
  ) refuse("Supabase CLI path must be absolute and normalized");
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || (status.mode & 0o111) === 0
  ) refuse("Supabase CLI must be an executable regular non-symlink file");
  return realpathSync(file);
}

function assertExternalPrivateDirectory(directory) {
  if (
    typeof directory !== "string"
    || !path.isAbsolute(directory)
    || path.resolve(directory) !== directory
  ) refuse("receipt directory must be absolute and normalized");
  const status = lstatSync(directory);
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || (status.mode & 0o777) !== 0o700
    || realpathSync(directory) !== directory
  ) refuse("receipt directory must be a real mode 0700 directory");
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse("receipt directory must be owned by the current user");
  }
  const relative = path.relative(REPOSITORY_ROOT, directory);
  if (
    relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  ) refuse("receipt directory must stay outside the repository");
  return directory;
}

function receiptExpectedKeys(kind, schemaVersion) {
  const common = [
    "schemaVersion",
    "kind",
    "sequence",
    "previousReceiptSha256",
    "operation",
    "status",
    "recordedAt",
    "productionDenied",
    "hostedMutationCount",
    "receiptSha256",
  ];
  if (kind === "attestation") return [...common, "attestation"];
  if (kind === "revoke-baseline" && schemaVersion === 2) {
    return [
      ...common,
      "eventId",
      "financeCommitSha",
      "mainCommitSha",
      "gateAttestation",
      "hostedReadCount",
      "liveBaseline",
    ];
  }
  if (kind === "revoke-proof" && schemaVersion === 2) {
    return [
      ...common,
      "eventId",
      "financeCommitSha",
      "mainCommitSha",
      "baselineReceiptSha256",
      "gateAttestation",
      "hostedReadCount",
      "liveProof",
    ];
  }
  if (kind === "mutation-intent") {
    return [
      ...common,
      "preAttestation",
      "mutation",
      schemaVersion === 1
        ? "revokeProofSha256"
        : "revokeProofReceiptSha256",
    ];
  }
  if (kind === "mutation-result") {
    return [
      ...common,
      "intentReceiptSha256",
      "preAttestationSha256",
      "mutation",
      "postAttestation",
    ];
  }
  if (kind === "reconciliation") {
    return [
      ...common,
      "reconcilesReceiptSha256",
      "attestation",
      "outcome",
    ];
  }
  refuse("receipt kind differs");
}

function validateReceiptAttestation(attestation, label) {
  exactKeys(
    attestation,
    ["gateStates", "gateUpdatedAt", "stateKey", "gateSetSha256"],
    label,
  );
  exactKeys(
    attestation.gateStates,
    GATES.map(gate => gate.key),
    `${label} gateStates`,
  );
  exactKeys(
    attestation.gateUpdatedAt,
    GATES.map(gate => gate.key),
    `${label} gateUpdatedAt`,
  );
  if (
    GATES.some(gate =>
      ![ENABLED, DISABLED].includes(attestation.gateStates[gate.key]))
    || GATES.some(gate =>
      !isCanonicalUtcTimestamp(attestation.gateUpdatedAt[gate.key]))
    || attestation.stateKey !== stateKey(attestation.gateStates)
    || !Object.values(STATES).includes(attestation.stateKey)
    || typeof attestation.gateSetSha256 !== "string"
    || !SHA256.test(attestation.gateSetSha256)
    || attestation.gateSetSha256
      !== attestationHash(
        attestation.gateStates,
        attestation.gateUpdatedAt,
      )
  ) refuse(`${label} contract differs`);
}

function validateReceiptMutation(mutation, label) {
  exactKeys(mutation, [
    "gateKey",
    "projectRef",
    "secretName",
    "desiredState",
    "desiredStateSha256",
  ], label);
  const gate = gateByKey(mutation.gateKey);
  if (
    mutation.projectRef !== gate.projectRef
    || mutation.secretName !== gate.secretName
    || ![ENABLED, DISABLED].includes(mutation.desiredState)
    || mutation.desiredStateSha256 !== sha256(mutation.desiredState)
    || STAGING_GATE_BOUNDARY.productionDenyRefs.includes(mutation.projectRef)
  ) refuse(`${label} contract differs`);
}

function validateReceiptSemantics(receipt, receipts) {
  if (
    receipt.productionDenied !== true
    || typeof receipt.recordedAt !== "string"
    || !Number.isFinite(Date.parse(receipt.recordedAt))
    || new Date(Date.parse(receipt.recordedAt)).toISOString()
      !== receipt.recordedAt
  ) refuse("receipt safety metadata differs");
  const previous = receipts.at(-1) ?? null;
  if (receipt.kind === "attestation") {
    if (
      receipt.operation !== "attest"
      || receipt.status !== "observed"
      || receipt.hostedMutationCount !== 0
    ) refuse("attestation receipt semantics differ");
    validateReceiptAttestation(receipt.attestation, "receipt attestation");
    return;
  }
  if (receipt.kind === "revoke-baseline") {
    if (
      receipt.schemaVersion !== 2
      || receipt.operation !== "capture-revoke-baseline"
      || receipt.status !== "observed"
      || receipt.hostedMutationCount !== 0
      || receipt.hostedReadCount !== 1
      || typeof receipt.eventId !== "string"
      || !UUID_V4.test(receipt.eventId)
      || receipt.financeCommitSha !== FINANCE_COMMIT_SHA
      || receipt.mainCommitSha !== MAIN_COMMIT_SHA
    ) refuse("revoke baseline receipt semantics differ");
    validateReceiptAttestation(
      receipt.gateAttestation,
      "revoke baseline gate attestation",
    );
    if (receipt.gateAttestation.stateKey !== STATES.fullyEnabled) {
      refuse("revoke baseline requires all four staging gates enabled");
    }
    validateLiveRevokeBaseline(receipt.liveBaseline, receipt.eventId);
    if (
      receipts.some(item =>
        item.kind === "revoke-baseline"
        && item.eventId === receipt.eventId)
    ) refuse("revoke baseline event is duplicated");
    return;
  }
  if (receipt.kind === "revoke-proof") {
    if (
      receipt.schemaVersion !== 2
      || receipt.operation !== "verify-revoke"
      || receipt.status !== "verified"
      || receipt.hostedMutationCount !== 0
      || receipt.hostedReadCount !== 3
      || typeof receipt.eventId !== "string"
      || !UUID_V4.test(receipt.eventId)
      || receipt.financeCommitSha !== FINANCE_COMMIT_SHA
      || receipt.mainCommitSha !== MAIN_COMMIT_SHA
      || typeof receipt.baselineReceiptSha256 !== "string"
      || !SHA256.test(receipt.baselineReceiptSha256)
    ) refuse("revoke proof receipt semantics differ");
    validateReceiptAttestation(
      receipt.gateAttestation,
      "revoke proof gate attestation",
    );
    if (receipt.gateAttestation.stateKey !== STATES.financeProtocolOnly) {
      refuse("revoke proof requires the Main protocol gate disabled");
    }
    const baselineReceipt = receipts.find(item =>
      item.receiptSha256 === receipt.baselineReceiptSha256);
    if (
      !baselineReceipt
      || baselineReceipt.kind !== "revoke-baseline"
      || baselineReceipt.eventId !== receipt.eventId
    ) refuse("revoke proof baseline receipt differs");
    validateLiveRevokeProof(receipt.liveProof, {
      baseline: baselineReceipt.liveBaseline,
      eventId: receipt.eventId,
      now: null,
    });
    return;
  }
  if (receipt.kind === "mutation-intent") {
    const proofReference = receipt.schemaVersion === 1
      ? receipt.revokeProofSha256
      : receipt.revokeProofReceiptSha256;
    if (
      !["advance", "rollback"].includes(receipt.operation)
      || receipt.status !== "pending"
      || receipt.hostedMutationCount !== 0
      || (
        proofReference !== null
        && (
          typeof proofReference !== "string"
          || !SHA256.test(proofReference)
        )
      )
    ) refuse("mutation intent receipt semantics differ");
    validateReceiptAttestation(
      receipt.preAttestation,
      "receipt preAttestation",
    );
    validateReceiptMutation(receipt.mutation, "receipt mutation");
    if (
      canonicalJson(receipt.mutation)
      !== canonicalJson(
        intendedMutation(receipt.operation, receipt.preAttestation),
      )
    ) refuse("mutation intent transition differs");
    if (receipt.schemaVersion === 2) {
      const requiresProof = mutationNeedsRevokeProof(receipt.mutation);
      if (
        requiresProof
        && (
          !previous
          || previous.kind !== "revoke-proof"
          || previous.receiptSha256 !== proofReference
          || previous.gateAttestation.gateSetSha256
            !== receipt.preAttestation.gateSetSha256
        )
      ) refuse("Main sync rollback proof binding differs");
      if (!requiresProof && proofReference !== null) {
        refuse("unexpected revoke proof receipt reference");
      }
    }
    return;
  }
  if (receipt.kind === "mutation-result") {
    if (
      !["advance", "rollback"].includes(receipt.operation)
      || !["success", "unknown"].includes(receipt.status)
      || receipt.hostedMutationCount !== 1
      || !previous
      || previous.kind !== "mutation-intent"
      || receipt.intentReceiptSha256 !== previous.receiptSha256
      || receipt.preAttestationSha256
        !== previous.preAttestation.gateSetSha256
      || canonicalJson(receipt.mutation)
        !== canonicalJson(previous.mutation)
      || (
        receipt.status === "success"
        && receipt.postAttestation === null
      )
    ) refuse("mutation result receipt semantics differ");
    validateReceiptMutation(receipt.mutation, "receipt mutation");
    if (receipt.postAttestation !== null) {
      validateReceiptAttestation(
        receipt.postAttestation,
        "receipt postAttestation",
      );
    }
    if (
      receipt.status === "success"
      && !postAttestationMatchesMutation(
        previous.preAttestation,
        receipt.postAttestation,
        receipt.mutation,
      )
    ) refuse("successful mutation result transition differs");
    return;
  }
  if (
    receipt.operation !== "attest"
    || receipt.status !== "reconciled"
    || receipt.hostedMutationCount !== 0
    || !previous
    || !(
      previous.kind === "mutation-intent"
      || (
        previous.kind === "mutation-result"
        && previous.status === "unknown"
      )
      || (
        previous.kind === "reconciliation"
        && previous.outcome === "diverged"
      )
    )
    || receipt.reconcilesReceiptSha256 !== previous.receiptSha256
    || !["applied", "not_applied", "diverged"].includes(receipt.outcome)
  ) refuse("reconciliation receipt semantics differ");
  validateReceiptAttestation(
    receipt.attestation,
    "receipt reconciliation attestation",
  );
}

function readReceiptChain(receiptDirectory) {
  const files = readdirSync(receiptDirectory)
    .filter(name => RECEIPT_PATTERN.test(name))
    .sort();
  let previousReceiptSha256 = null;
  const receipts = [];
  for (let index = 0; index < files.length; index += 1) {
    const expectedName = `${String(index + 1).padStart(6, "0")}.json`;
    if (files[index] !== expectedName) refuse("receipt sequence has a gap");
    const file = path.join(receiptDirectory, files[index]);
    const status = lstatSync(file);
    if (
      !status.isFile()
      || status.isSymbolicLink()
      || status.nlink !== 1
      || (status.mode & 0o777) !== 0o600
      || realpathSync(file) !== file
    ) refuse("receipt file boundary differs");
    if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
      refuse("receipt file owner differs");
    }
    const source = readFileSync(file, "utf8");
    let receipt;
    try {
      receipt = JSON.parse(source);
    } catch {
      refuse("receipt JSON differs");
    }
    exactKeys(
      receipt,
      receiptExpectedKeys(receipt.kind, receipt.schemaVersion),
      "receipt",
    );
    if (
      ![1, 2].includes(receipt.schemaVersion)
      || (
        ["revoke-baseline", "revoke-proof"].includes(receipt.kind)
        && receipt.schemaVersion !== 2
      )
      || receipt.sequence !== index + 1
      || receipt.previousReceiptSha256 !== previousReceiptSha256
      || typeof receipt.receiptSha256 !== "string"
      || !SHA256.test(receipt.receiptSha256)
      || source !== `${canonicalJson(receipt)}\n`
    ) refuse("receipt canonical chain differs");
    const { receiptSha256, ...core } = receipt;
    if (sha256(canonicalJson(core)) !== receiptSha256) {
      refuse("receipt self-hash differs");
    }
    validateReceiptSemantics(receipt, receipts);
    previousReceiptSha256 = receipt.receiptSha256;
    receipts.push(Object.freeze(receipt));
  }
  return receipts;
}

function appendReceipt(receiptDirectory, chain, fields) {
  const sequence = chain.length + 1;
  const core = {
    schemaVersion: 2,
    ...fields,
    sequence,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
  };
  const receipt = {
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  };
  const file = path.join(
    receiptDirectory,
    `${String(sequence).padStart(6, "0")}.json`,
  );
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, `${canonicalJson(receipt)}\n`, "utf8");
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (!status.isFile() || (status.mode & 0o777) !== 0o600) {
      refuse("receipt write boundary differs");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  chain.push(Object.freeze(receipt));
  return Object.freeze({ receipt, file });
}

function scrubEnvironment(environment) {
  const scrubbed = {};
  for (const [name, value] of Object.entries(environment)) {
    if (
      CLI_ENVIRONMENT_ALLOWLIST.has(name)
      && typeof value === "string"
    ) scrubbed[name] = value;
  }
  return scrubbed;
}

function defaultRunCli(cli, args, environment) {
  const result = spawnSync(cli, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: environment,
    maxBuffer: 2 * 1_024 * 1_024,
    timeout: 30_000,
    windowsHide: true,
  });
  return {
    status: result.status,
    signal: result.signal,
    error: result.error ?? null,
    stdout: result.stdout ?? "",
  };
}

function successfulCliResult(result) {
  return (
    result !== null
    && typeof result === "object"
    && result.status === 0
    && result.signal == null
    && result.error == null
    && typeof result.stdout === "string"
  );
}

function invokeCli(dependencies, args) {
  return dependencies.runCli(
    dependencies.cli,
    args,
    dependencies.environment,
  );
}

function assertCliVersion(dependencies) {
  let result;
  try {
    result = invokeCli(dependencies, ["--version"]);
  } catch {
    refuse("Supabase CLI version check failed; output withheld");
  }
  if (!successfulCliResult(result) || result.stdout.trim() !== CLI_VERSION) {
    refuse(`Supabase CLI must be exactly ${CLI_VERSION}; output withheld`);
  }
}

function parseSecretList(result, projectRef) {
  if (!successfulCliResult(result)) {
    refuse(`read-only secrets list failed for staging ${projectRef}; output withheld`);
  }
  let rows;
  try {
    rows = JSON.parse(result.stdout);
  } catch {
    refuse(`read-only secrets list JSON differs for staging ${projectRef}`);
  }
  if (!Array.isArray(rows)) {
    refuse(`read-only secrets list inventory differs for staging ${projectRef}`);
  }
  const expectedGates = GATES.filter(gate => gate.projectRef === projectRef);
  const gateStates = {};
  const gateUpdatedAt = {};
  for (const gate of expectedGates) {
    const matches = rows.filter(row =>
      row !== null
      && typeof row === "object"
      && !Array.isArray(row)
      && row.name === gate.secretName);
    if (matches.length !== 1) {
      refuse(`gate ${gate.secretName} is missing or duplicated`);
    }
    exactKeys(
      matches[0],
      ["name", "updated_at", "value"],
      `gate ${gate.secretName} secrets list row`,
    );
    const digest = matches[0].value;
    if (typeof digest !== "string" || !SHA256.test(digest)) {
      refuse(`gate ${gate.secretName} digest differs`);
    }
    if (digest === ENABLED_SHA256) gateStates[gate.key] = ENABLED;
    else if (digest === DISABLED_SHA256) gateStates[gate.key] = DISABLED;
    else refuse(`gate ${gate.secretName} is neither exact enabled nor disabled`);
    if (!isCanonicalUtcTimestamp(matches[0].updated_at)) {
      refuse(`gate ${gate.secretName} updated_at is not canonical UTC`);
    }
    gateUpdatedAt[gate.key] = matches[0].updated_at;
  }
  return { gateStates, gateUpdatedAt };
}

function attestGates(dependencies) {
  const gateStates = {};
  const gateUpdatedAt = {};
  for (const projectRef of [
    STAGING_GATE_BOUNDARY.financeStagingRef,
    STAGING_GATE_BOUNDARY.mainStagingRef,
  ]) {
    if (STAGING_GATE_BOUNDARY.productionDenyRefs.includes(projectRef)) {
      refuse("production project ref reached read-only attestation");
    }
    let result;
    try {
      result = invokeCli(dependencies, [
        "secrets",
        "list",
        "--project-ref",
        projectRef,
        "--output",
        "json",
      ]);
    } catch {
      refuse(`read-only secrets list failed for staging ${projectRef}; output withheld`);
    }
    const projectGates = parseSecretList(result, projectRef);
    Object.assign(gateStates, projectGates.gateStates);
    Object.assign(gateUpdatedAt, projectGates.gateUpdatedAt);
  }
  exactKeys(gateStates, GATES.map(gate => gate.key), "gate state");
  exactKeys(
    gateUpdatedAt,
    GATES.map(gate => gate.key),
    "gate updatedAt",
  );
  const key = stateKey(gateStates);
  if (!Object.values(STATES).includes(key)) {
    refuse("four-gate state is outside the reviewed ordered state machine");
  }
  return Object.freeze({
    gateStates: Object.freeze({ ...gateStates }),
    gateUpdatedAt: Object.freeze({ ...gateUpdatedAt }),
    stateKey: key,
    gateSetSha256: attestationHash(gateStates, gateUpdatedAt),
  });
}

function mutationForRollback(preAttestation) {
  switch (preAttestation.stateKey) {
    case STATES.fullyEnabled:
      return { gateKey: "mainFinanceProtocol", desiredState: DISABLED };
    case STATES.financeProtocolOnly:
    case STATES.syncEnabled:
      return { gateKey: "mainFinanceSync", desiredState: DISABLED };
    case STATES.rollbackSyncOff:
      return { gateKey: "financeTelegramProtocol", desiredState: DISABLED };
    case STATES.financeSyncOnly:
      return { gateKey: "financeEntitlementSync", desiredState: DISABLED };
    default:
      return null;
  }
}

function mutationNeedsRevokeProof(mutation) {
  return (
    mutation.gateKey === "mainFinanceSync"
    && mutation.desiredState === DISABLED
  );
}

function revokeBaselineForEvent(chain, eventId) {
  const matches = chain.filter(receipt =>
    receipt.kind === "revoke-baseline"
    && receipt.eventId === eventId);
  if (matches.length !== 1) {
    refuse("exactly one captured live revoke baseline is required");
  }
  return matches[0];
}

function intendedMutation(action, preAttestation) {
  const transition = action === "advance"
    ? ADVANCE_TRANSITIONS[preAttestation.stateKey] ?? null
    : mutationForRollback(preAttestation);
  if (!transition) {
    if (
      action === "advance"
      && preAttestation.stateKey === STATES.fullyEnabled
    ) refuse("all four gates are already enabled");
    if (
      action === "rollback"
      && preAttestation.stateKey === STATES.allDisabled
    ) refuse("all four gates are already disabled");
    refuse(`${action} is not valid from the observed gate state`);
  }
  const gate = gateByKey(transition.gateKey);
  if (STAGING_GATE_BOUNDARY.productionDenyRefs.includes(gate.projectRef)) {
    refuse("mutation target resolves to production");
  }
  return Object.freeze({
    gateKey: gate.key,
    projectRef: gate.projectRef,
    secretName: gate.secretName,
    desiredState: transition.desiredState,
    desiredStateSha256: sha256(transition.desiredState),
  });
}

function postAttestationMatchesMutation(preAttestation, postAttestation, mutation) {
  for (const gate of GATES) {
    if (gate.key === mutation.gateKey) {
      if (
        postAttestation.gateStates[gate.key] !== mutation.desiredState
        || postAttestation.gateUpdatedAt[gate.key]
          === preAttestation.gateUpdatedAt[gate.key]
        || Date.parse(postAttestation.gateUpdatedAt[gate.key])
          < Date.parse(preAttestation.gateUpdatedAt[gate.key])
      ) return false;
      continue;
    }
    if (
      postAttestation.gateStates[gate.key]
        !== preAttestation.gateStates[gate.key]
      || postAttestation.gateUpdatedAt[gate.key]
        !== preAttestation.gateUpdatedAt[gate.key]
    ) return false;
  }
  return true;
}

function blockingReceipt(chain) {
  const latest = chain.at(-1);
  if (!latest) return null;
  if (
    latest.kind === "mutation-intent"
    || (latest.kind === "mutation-result" && latest.status === "unknown")
    || (latest.kind === "reconciliation" && latest.outcome === "diverged")
  ) return latest;
  return null;
}

function precedingBlocker(chain, blocker) {
  if (blocker.kind !== "reconciliation") return blocker;
  const preceding = chain.find(
    receipt => receipt.receiptSha256 === blocker.reconcilesReceiptSha256,
  );
  if (!preceding) refuse("reconciliation blocker origin is absent");
  return precedingBlocker(chain, preceding);
}

function mutationFromBlocker(chain, blocker) {
  const origin = precedingBlocker(chain, blocker);
  if (origin.mutation) return origin.mutation;
  const intent = chain.find(
    receipt => receipt.receiptSha256 === origin.intentReceiptSha256,
  );
  if (!intent?.mutation) refuse("unknown outcome intent is absent");
  return intent.mutation;
}

function preAttestationFromBlocker(chain, blocker) {
  const origin = precedingBlocker(chain, blocker);
  if (origin.preAttestation) return origin.preAttestation;
  const intent = chain.find(
    receipt => receipt.receiptSha256 === origin.intentReceiptSha256,
  );
  if (!intent?.preAttestation) refuse("unknown outcome pre-attestation is absent");
  return intent.preAttestation;
}

function reconciliationOutcome(chain, blocker, observed) {
  const mutation = mutationFromBlocker(chain, blocker);
  const pre = preAttestationFromBlocker(chain, blocker);
  if (postAttestationMatchesMutation(pre, observed, mutation)) return "applied";
  if (observed.gateSetSha256 === pre.gateSetSha256) return "not_applied";
  return "diverged";
}

function unknownOutcomeError(receipt) {
  const error = new Error(
    "Staging gate mutation outcome is unknown; do not retry. Run attest to reconcile.",
  );
  error.code = "STAGING_GATE_OUTCOME_UNKNOWN";
  error.receiptSha256 = receipt.receiptSha256;
  return error;
}

function mutationResultCore({
  action,
  now,
  intent,
  mutation,
  status,
  postAttestation,
}) {
  return {
    kind: "mutation-result",
    operation: action,
    status,
    recordedAt: now.toISOString(),
    productionDenied: true,
    hostedMutationCount: 1,
    intentReceiptSha256: intent.receiptSha256,
    preAttestationSha256: intent.preAttestation.gateSetSha256,
    mutation,
    postAttestation,
  };
}

export async function operateStagingGates(argv, {
  environment = process.env,
  now = () => new Date(),
  runCli = defaultRunCli,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertExactStagingBoundary();
  const input = parseArguments(argv);
  if (input.action === "help") {
    return Object.freeze({
      ok: true,
      mode: "help",
      usage: [
        "staging-gates.mjs attest --receipt-dir ABS_0700 --supabase-cli ABS",
        "staging-gates.mjs capture-revoke-baseline --receipt-dir ABS_0700 --supabase-cli ABS --revoke-event-id UUIDv4",
        "staging-gates.mjs advance --receipt-dir ABS_0700 --supabase-cli ABS --apply",
        "staging-gates.mjs rollback --receipt-dir ABS_0700 --supabase-cli ABS --apply [--revoke-event-id UUIDv4]",
      ],
    });
  }
  const currentTime = now();
  if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) {
    refuse("operator clock differs");
  }
  const receiptDirectory = assertExternalPrivateDirectory(input.receiptDir);
  const chain = readReceiptChain(receiptDirectory);
  const blocker = blockingReceipt(chain);
  if (blocker && input.action !== "attest") {
    refuse("an unknown or pending mutation requires read-only attest reconciliation");
  }
  const dependencies = {
    cli: assertExecutable(input.supabaseCli),
    runCli,
    environment: scrubEnvironment(environment),
  };
  assertCliVersion(dependencies);

  const preAttestation = attestGates(dependencies);
  if (input.action === "attest") {
    const fields = blocker
      ? {
        kind: "reconciliation",
        operation: "attest",
        status: "reconciled",
        recordedAt: currentTime.toISOString(),
        productionDenied: true,
        hostedMutationCount: 0,
        reconcilesReceiptSha256: blocker.receiptSha256,
        attestation: preAttestation,
        outcome: reconciliationOutcome(chain, blocker, preAttestation),
      }
      : {
        kind: "attestation",
        operation: "attest",
        status: "observed",
        recordedAt: currentTime.toISOString(),
        productionDenied: true,
        hostedMutationCount: 0,
        attestation: preAttestation,
      };
    const written = appendReceipt(receiptDirectory, chain, fields);
    return Object.freeze({
      ok: true,
      mode: blocker ? "reconciled" : "attested",
      state: preAttestation.stateKey,
      outcome: fields.outcome ?? null,
      receiptFile: written.file,
      receiptSha256: written.receipt.receiptSha256,
      productionTouched: false,
    });
  }

  if (input.action === "capture-revoke-baseline") {
    if (preAttestation.stateKey !== STATES.fullyEnabled) {
      refuse("capture-revoke-baseline requires all four staging gates enabled");
    }
    if (chain.some(receipt =>
      receipt.kind === "revoke-baseline"
      && receipt.eventId === input.revokeEventId)) {
      refuse("revoke baseline event is already captured");
    }
    const liveBaseline = await captureLiveRevokeBaseline({
      eventId: input.revokeEventId,
      accessToken: dependencies.environment.SUPABASE_ACCESS_TOKEN,
      fetchImpl,
    });
    const written = appendReceipt(receiptDirectory, chain, {
      kind: "revoke-baseline",
      operation: "capture-revoke-baseline",
      status: "observed",
      recordedAt: currentTime.toISOString(),
      productionDenied: true,
      hostedMutationCount: 0,
      hostedReadCount: 1,
      eventId: input.revokeEventId,
      financeCommitSha: FINANCE_COMMIT_SHA,
      mainCommitSha: MAIN_COMMIT_SHA,
      gateAttestation: preAttestation,
      liveBaseline,
    });
    return Object.freeze({
      ok: true,
      mode: "revoke-baseline-captured",
      state: preAttestation.stateKey,
      eventId: input.revokeEventId,
      receiptFile: written.file,
      receiptSha256: written.receipt.receiptSha256,
      hostedReadCount: 1,
      productionTouched: false,
    });
  }

  const mutation = intendedMutation(input.action, preAttestation);
  let revokeProofReceiptSha256 = null;
  if (input.action === "rollback" && mutationNeedsRevokeProof(mutation)) {
    if (!input.revokeEventId) {
      refuse("disabling Main sync requires --revoke-event-id UUIDv4");
    }
    const baselineReceipt = revokeBaselineForEvent(
      chain,
      input.revokeEventId,
    );
    const liveProof = await verifyLiveRevoke({
      eventId: input.revokeEventId,
      baseline: baselineReceipt.liveBaseline,
      accessToken: dependencies.environment.SUPABASE_ACCESS_TOKEN,
      fetchImpl,
      now: currentTime,
    });
    const proofWritten = appendReceipt(receiptDirectory, chain, {
      kind: "revoke-proof",
      operation: "verify-revoke",
      status: "verified",
      recordedAt: currentTime.toISOString(),
      productionDenied: true,
      hostedMutationCount: 0,
      hostedReadCount: 3,
      eventId: input.revokeEventId,
      financeCommitSha: FINANCE_COMMIT_SHA,
      mainCommitSha: MAIN_COMMIT_SHA,
      baselineReceiptSha256: baselineReceipt.receiptSha256,
      gateAttestation: preAttestation,
      liveProof,
    });
    revokeProofReceiptSha256 = proofWritten.receipt.receiptSha256;
  } else if (input.revokeEventId) {
    refuse(
      "--revoke-event-id is accepted only for baseline capture or the Main sync rollback barrier",
    );
  }

  const intentWritten = appendReceipt(receiptDirectory, chain, {
    kind: "mutation-intent",
    operation: input.action,
    status: "pending",
    recordedAt: currentTime.toISOString(),
    productionDenied: true,
    hostedMutationCount: 0,
    preAttestation,
    mutation,
    revokeProofReceiptSha256,
  });

  let mutationResult;
  try {
    mutationResult = invokeCli(dependencies, [
      "secrets",
      "set",
      `${mutation.secretName}=${mutation.desiredState}`,
      "--project-ref",
      mutation.projectRef,
      "--yes",
    ]);
  } catch {
    mutationResult = null;
  }
  if (!successfulCliResult(mutationResult)) {
    const written = appendReceipt(
      receiptDirectory,
      chain,
      mutationResultCore({
        action: input.action,
        now: currentTime,
        intent: intentWritten.receipt,
        mutation,
        status: "unknown",
        postAttestation: null,
      }),
    );
    throw unknownOutcomeError(written.receipt);
  }

  let postAttestation;
  try {
    postAttestation = attestGates(dependencies);
  } catch {
    const written = appendReceipt(
      receiptDirectory,
      chain,
      mutationResultCore({
        action: input.action,
        now: currentTime,
        intent: intentWritten.receipt,
        mutation,
        status: "unknown",
        postAttestation: null,
      }),
    );
    throw unknownOutcomeError(written.receipt);
  }
  if (!postAttestationMatchesMutation(
    preAttestation,
    postAttestation,
    mutation,
  )) {
    const written = appendReceipt(
      receiptDirectory,
      chain,
      mutationResultCore({
        action: input.action,
        now: currentTime,
        intent: intentWritten.receipt,
        mutation,
        status: "unknown",
        postAttestation,
      }),
    );
    throw unknownOutcomeError(written.receipt);
  }
  const written = appendReceipt(
    receiptDirectory,
    chain,
    mutationResultCore({
      action: input.action,
      now: currentTime,
      intent: intentWritten.receipt,
      mutation,
      status: "success",
      postAttestation,
    }),
  );
  return Object.freeze({
    ok: true,
    mode: input.action,
    mutationCount: 1,
    mutatedGate: mutation.gateKey,
    state: postAttestation.stateKey,
    receiptFile: written.file,
    receiptSha256: written.receipt.receiptSha256,
    productionTouched: false,
  });
}

async function main() {
  try {
    const result = await operateStagingGates(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Staging gate operator failed"}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
