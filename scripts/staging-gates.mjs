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
const REVOKE_PROOF_MAXIMUM_AGE_MS = 15 * 60 * 1_000;
const REVOKE_PROOF_MAXIMUM_FUTURE_SKEW_MS = 60 * 1_000;
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
  if (!["attest", "advance", "rollback"].includes(action)) {
    refuse("first argument must be attest, advance or rollback");
  }
  const input = {
    action,
    apply: false,
    receiptDir: null,
    supabaseCli: null,
    revokeProof: null,
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
    if (!["--receipt-dir", "--supabase-cli", "--revoke-proof"].includes(argument)) {
      refuse(`unknown argument ${argument}`);
    }
    if (seen.has(argument)) refuse(`duplicate ${argument}`);
    seen.add(argument);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) refuse(`${argument} requires a value`);
    if (argument === "--receipt-dir") input.receiptDir = value;
    else if (argument === "--supabase-cli") input.supabaseCli = value;
    else input.revokeProof = value;
    index += 1;
  }
  if (!input.receiptDir) refuse("--receipt-dir is required");
  if (!input.supabaseCli) refuse("--supabase-cli is required");
  if (action === "attest" && (input.apply || input.revokeProof)) {
    refuse("attest is read-only and rejects --apply and --revoke-proof");
  }
  if (action !== "attest" && !input.apply) {
    refuse(`${action} requires explicit --apply`);
  }
  if (action === "advance" && input.revokeProof) {
    refuse("advance rejects --revoke-proof");
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

function readPrivateExternalJson(file, label, maximumBytes = 16 * 1_024) {
  if (
    typeof file !== "string"
    || !path.isAbsolute(file)
    || path.resolve(file) !== file
  ) refuse(`${label} path must be absolute and normalized`);
  const parent = assertExternalPrivateDirectory(path.dirname(file));
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || status.size < 2
    || status.size > maximumBytes
    || realpathSync(file) !== file
    || path.dirname(file) !== parent
  ) refuse(`${label} must be one owner-private mode 0600 file`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} must be owned by the current user`);
  }
  const source = readFileSync(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    refuse(`${label} contains invalid JSON`);
  }
  return Object.freeze({ parsed, source });
}

function receiptExpectedKeys(kind) {
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
  if (kind === "mutation-intent") {
    return [
      ...common,
      "preAttestation",
      "mutation",
      "revokeProofSha256",
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
  if (receipt.kind === "mutation-intent") {
    if (
      !["advance", "rollback"].includes(receipt.operation)
      || receipt.status !== "pending"
      || receipt.hostedMutationCount !== 0
      || (
        receipt.revokeProofSha256 !== null
        && (
          typeof receipt.revokeProofSha256 !== "string"
          || !SHA256.test(receipt.revokeProofSha256)
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
    exactKeys(receipt, receiptExpectedKeys(receipt.kind), "receipt");
    if (
      receipt.schemaVersion !== 1
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
    schemaVersion: 1,
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

function attestationSnapshots(chain) {
  const snapshots = [];
  for (const receipt of chain) {
    if (receipt.attestation) snapshots.push(receipt.attestation);
    if (receipt.preAttestation) snapshots.push(receipt.preAttestation);
    if (receipt.postAttestation) snapshots.push(receipt.postAttestation);
  }
  return snapshots;
}

function revokeProofRequired(chain, mutation) {
  if (mutation.gateKey !== "mainFinanceSync" || mutation.desiredState !== DISABLED) {
    return false;
  }
  const snapshots = attestationSnapshots(chain);
  const trustedDisabledBaseline = snapshots.some(
    snapshot => snapshot.stateKey === STATES.allDisabled,
  );
  const mainProtocolWasObservedEnabled = snapshots.some(
    snapshot => snapshot.gateStates?.mainFinanceProtocol === ENABLED,
  );
  return mainProtocolWasObservedEnabled || !trustedDisabledBaseline;
}

function validateRevokeProofValue(proof, now) {
  exactKeys(proof, [
    "schemaVersion",
    "kind",
    "environment",
    "financeProjectRef",
    "mainProjectRef",
    "financeCommitSha",
    "mainCommitSha",
    "subjectTelegramIdHash",
    "entitlementEventId",
    "mainOutboxState",
    "financeEventState",
    "desiredState",
    "appliedState",
    "queueCounts",
    "activeCounts",
    "financialDataRetained",
    "observedAt",
    "proofSha256",
  ], "revoke proof");
  exactKeys(
    proof.queueCounts,
    ["pending", "retry_wait", "processing", "dead_letter"],
    "revoke proof queueCounts",
  );
  exactKeys(
    proof.activeCounts,
    ["activeCodes", "activeDevices", "activeSessions"],
    "revoke proof activeCounts",
  );
  const observedAtMs = Date.parse(proof.observedAt);
  if (
    proof.schemaVersion !== 1
    || proof.kind !== "staging-revoke-proof-v1"
    || proof.environment !== "staging"
    || proof.financeProjectRef !== STAGING_GATE_BOUNDARY.financeStagingRef
    || proof.mainProjectRef !== STAGING_GATE_BOUNDARY.mainStagingRef
    || proof.financeCommitSha !== FINANCE_COMMIT_SHA
    || proof.mainCommitSha !== MAIN_COMMIT_SHA
    || typeof proof.subjectTelegramIdHash !== "string"
    || !SHA256.test(proof.subjectTelegramIdHash)
    || !UUID_V4.test(proof.entitlementEventId)
    || proof.mainOutboxState !== "applied"
    || proof.financeEventState !== "applied"
    || proof.desiredState !== "revoked"
    || proof.appliedState !== "revoked"
    || Object.values(proof.queueCounts).some(value => value !== 0)
    || Object.values(proof.activeCounts).some(value => value !== 0)
    || proof.financialDataRetained !== true
    || typeof proof.observedAt !== "string"
    || !Number.isFinite(observedAtMs)
    || new Date(observedAtMs).toISOString() !== proof.observedAt
    || now.getTime() - observedAtMs > REVOKE_PROOF_MAXIMUM_AGE_MS
    || observedAtMs - now.getTime() > REVOKE_PROOF_MAXIMUM_FUTURE_SKEW_MS
    || typeof proof.proofSha256 !== "string"
    || !SHA256.test(proof.proofSha256)
  ) refuse("revoke proof contract differs");
  const { proofSha256, ...core } = proof;
  if (sha256(canonicalJson(core)) !== proofSha256) {
    refuse("revoke proof self-hash differs");
  }
  return proof.proofSha256;
}

export function validateStagingRevokeProof(file, {
  now = new Date(),
} = {}) {
  const reviewed = readPrivateExternalJson(file, "revoke proof");
  if (reviewed.source !== `${canonicalJson(reviewed.parsed)}\n`) {
    refuse("revoke proof is not canonical JSON");
  }
  return validateRevokeProofValue(reviewed.parsed, now);
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
  ) return latest;
  return null;
}

function mutationFromBlocker(chain, blocker) {
  if (blocker.mutation) return blocker.mutation;
  const intent = chain.find(
    receipt => receipt.receiptSha256 === blocker.intentReceiptSha256,
  );
  if (!intent?.mutation) refuse("unknown outcome intent is absent");
  return intent.mutation;
}

function preAttestationFromBlocker(chain, blocker) {
  if (blocker.preAttestation) return blocker.preAttestation;
  const intent = chain.find(
    receipt => receipt.receiptSha256 === blocker.intentReceiptSha256,
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
} = {}) {
  assertExactStagingBoundary();
  const input = parseArguments(argv);
  if (input.action === "help") {
    return Object.freeze({
      ok: true,
      mode: "help",
      usage: [
        "staging-gates.mjs attest --receipt-dir ABS_0700 --supabase-cli ABS",
        "staging-gates.mjs advance --receipt-dir ABS_0700 --supabase-cli ABS --apply",
        "staging-gates.mjs rollback --receipt-dir ABS_0700 --supabase-cli ABS --apply [--revoke-proof ABS_0600]",
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

  const mutation = intendedMutation(input.action, preAttestation);
  let revokeProofSha256 = null;
  if (input.action === "rollback" && revokeProofRequired(chain, mutation)) {
    if (!input.revokeProof) {
      refuse("disabling Main sync requires a fresh canonical revoke proof");
    }
    revokeProofSha256 = validateStagingRevokeProof(input.revokeProof, {
      now: currentTime,
    });
  } else if (input.revokeProof) {
    refuse("--revoke-proof is accepted only at the Main sync rollback barrier");
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
    revokeProofSha256,
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
