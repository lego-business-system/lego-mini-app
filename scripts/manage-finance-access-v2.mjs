#!/usr/bin/env node

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";
import {
  buildMainFinanceRuntimeRecoveryAttestRequest,
  buildMainFinanceRuntimeRecoverySnapshot,
  classifyMainFinanceRuntimeRecoveryReconcileSnapshot,
  extractMainFinanceRuntimeRecoveryVerifiedAttestationProof,
  readMainFinanceRuntimeRecoveryV2SnapshotContract,
  validateMainFinanceRuntimeRecoverySnapshotSandwich,
  verifyMainFinanceRuntimeRecoveryAttestResponse,
} from "./main-finance-runtime-recovery-v2-snapshot.mjs";
import {
  validateMainFinanceRuntimeRecoveryV4ReleaseAuthority,
} from "./prepare-main-finance-runtime-recovery-v2.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const MAIN_PROJECT_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_PROJECT_REF = "makgsbjduobcphuqzaoq";
const MAIN_ORIGIN = `https://${MAIN_PROJECT_REF}.supabase.co`;
const EDGE_PATH = "/functions/v1/finance-manage-access-v2";
const EDGE_URL = `${MAIN_ORIGIN}${EDGE_PATH}`;
const PRODUCTION_DENY_REFS = Object.freeze([
  "soxtekhspohkddpdidvp",
  "koibxwgtihwajocxfetb",
]);
const SHA256 = /^[0-9a-f]{64}$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FUNCTION_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]{0,18})$/u;
const SECRET = /^[^\s\u0000-\u001f\u007f]{32,4096}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const MAXIMUM_PRIVATE_FILE_BYTES = 512 * 1024;
const MAXIMUM_RESPONSE_BYTES = 64 * 1024;
const PREPARE_PLAN_TTL_MS = 240_000;
const SNAPSHOT_MAXIMUM_AGE_MS = 300_000;
const ACTOR = /^[a-z][a-z0-9_.:-]{2,127}$/u;
const GIT_OID = /^[0-9a-f]{40}$/u;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,255}$/u;
const ACCESS_TOKEN = /^[A-Za-z0-9._-]{20,4096}$/u;
const PREPARE_PLAN_NAME = /^main-finance-access-v2-([1-9][0-9]{12})-([0-9a-f]{64})-plan\.json$/u;
const RUNTIME_RECOVERY_RECEIPT_NAME = /^([0-9]{6})\.json$/u;
const RECEIPT_DIRECTORY_LEASE_NAME = ".main-finance-access-v2-receipt-directory.lease";
const TARGET_FUNCTION_SLUG = "finance-manage-access-v2";
const SUPABASE_CLI_PIN = Object.freeze({
  realPath: "/Users/Maks/Library/pnpm/store/v11/links/@supabase/cli-darwin-arm64/2.109.1/e5fdd9fb276a62ab37eb6abe0330d50b2a81bb692d391bd8bc054b330e5d8133/node_modules/@supabase/cli-darwin-arm64/bin/supabase",
  sha256: "b7be23f4e211b75c00a3df5fcd1f96f3905983c74ff3189bfc69ad5b0f7132c4",
  version: "2.109.1",
});

function fail(message) {
  throw new Error(`Main Finance access v2 operator refused: ${message}`);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not an object`);
  }
  const actual = Object.keys(value);
  if (
    actual.length !== expected.length ||
    actual.some((key) => !expected.includes(key)) ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) fail(`${label} keys differ`);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function decimalString(value) {
  return typeof value === "string" && DECIMAL.test(value);
}

function constantTimeSha256HexEqual(left, right) {
  if (
    typeof left !== "string" || typeof right !== "string" ||
    !SHA256.test(left) || !SHA256.test(right)
  ) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function attestationProofMessage(sourceDeploymentSha256, snapshot, timestamp) {
  return [
    "main-finance-access-v2-attestation",
    sourceDeploymentSha256,
    snapshot.sql_sha256,
    snapshot.main_source_commit_sha,
    snapshot.main_source_tree_sha,
    snapshot.source_manifest_sha256,
    snapshot.catalog_sha256,
    snapshot.gate_inventory_sha256,
    snapshot.privacy_secret_inventory_sha256,
    snapshot.database_clock,
    snapshot.response_sha256,
    snapshot.descriptor_sha256,
    snapshot.state_sha256,
    String(snapshot.checked_count),
    String(timestamp),
  ].join("\n");
}

function assertCompiledBoundary(input) {
  if (
    input.mainProjectRef !== MAIN_PROJECT_REF ||
    input.financeProjectRef !== FINANCE_PROJECT_REF ||
    PRODUCTION_DENY_REFS.includes(input.mainProjectRef) ||
    PRODUCTION_DENY_REFS.includes(input.financeProjectRef) ||
    !SHA256.test(input.sourceDeploymentSha256)
  ) fail("targets or source deployment hash are outside the compiled staging boundary");
}

function isOutsideRepository(item) {
  const relative = path.relative(REPOSITORY_ROOT, item);
  return relative !== "" &&
    (relative === ".." || relative.startsWith(`..${path.sep}`));
}

function pathsOverlap(left, right) {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  const nested = (relative) => relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." &&
      !relative.startsWith(`..${path.sep}`));
  return nested(leftToRight) || nested(rightToLeft);
}

function assertDisjointPrivateDirectories(directories) {
  for (let left = 0; left < directories.length; left += 1) {
    for (let right = left + 1; right < directories.length; right += 1) {
      if (pathsOverlap(directories[left], directories[right])) {
        fail("receipt, output and Supabase CLI home directories must be disjoint");
      }
    }
  }
}

function readPrivateFile(file, label, maximumBytes = MAXIMUM_PRIVATE_FILE_BYTES) {
  if (typeof file !== "string" || !path.isAbsolute(file) || path.resolve(file) !== file) {
    fail(`${label} path must be absolute and normalized`);
  }
  if (!isOutsideRepository(file)) fail(`${label} must stay outside the repository`);
  let linkStatus;
  try {
    linkStatus = lstatSync(file, { bigint: true });
  } catch {
    fail(`${label} is unavailable`);
  }
  if (!linkStatus.isFile() || linkStatus.isSymbolicLink() || linkStatus.nlink !== 1n) {
    fail(`${label} must be a single-link regular non-symlink file`);
  }
  const real = realpathSync(file);
  if (real !== file || !isOutsideRepository(real)) fail(`${label} real path differs`);
  let descriptor;
  try {
    descriptor = openSync(real, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() || before.nlink !== 1n || before.size < 2n ||
      before.size > BigInt(maximumBytes) || before.dev !== linkStatus.dev ||
      before.ino !== linkStatus.ino
    ) {
      fail(`${label} size differs`);
    }
    if ((before.mode & 0o777n) !== 0o600n) {
      fail(`${label} must have owner-only permissions exactly 0600`);
    }
    if (typeof process.geteuid === "function" && before.uid !== BigInt(process.geteuid())) {
      fail(`${label} owner differs`);
    }
    const source = readFileSync(descriptor, "utf8");
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== before.dev || after.ino !== before.ino || after.nlink !== before.nlink ||
      after.mode !== before.mode || after.uid !== before.uid || after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
      Buffer.byteLength(source, "utf8") !== Number(before.size)
    ) fail(`${label} changed while reading`);
    return source;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parsePrivateJson(file, label) {
  const source = readPrivateFile(file, label);
  if (source.includes("\r") || source.includes("\0") || !source.endsWith("\n")) {
    fail(`${label} bytes differ`);
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    fail(`${label} is not JSON`);
  }
  if (`${canonicalJson(value)}\n` !== source) fail(`${label} is not canonical JSON`);
  return Object.freeze({ value, source, sha256: sha256(source) });
}

function readCurrentRuntimeRecoveryReleaseAuthority(input) {
  const receiptDirectory = assertOwnerPrivateDirectory(
    input.runtimeRecoveryReceiptDirectory,
    "runtime recovery receipt directory",
  );
  const epochRoot = path.dirname(receiptDirectory);
  assertOwnerPrivateDirectory(epochRoot, "runtime recovery epoch root");
  const receiptDirectoryIdentityBefore = ownerPrivateDirectoryIdentity(
    receiptDirectory,
    "runtime recovery receipt directory",
  );
  const epochRootIdentityBefore = ownerPrivateDirectoryIdentity(
    epochRoot,
    "runtime recovery epoch root",
  );
  const stateDirectory = path.join(epochRoot, "main-runtime-recovery-state");
  if (
    path.basename(receiptDirectory) !== "main-runtime-recovery-receipts" ||
    path.basename(input.runtimeRecoverySourceCiReceipt) !== "main-source-ci.json" ||
    path.basename(input.runtimeRecoveryReleaseProvenance) !==
      "main-runtime-recovery-provenance.json" ||
    path.dirname(input.runtimeRecoverySourceCiReceipt) !== epochRoot ||
    path.dirname(input.runtimeRecoveryReleaseProvenance) !== epochRoot ||
    input.runtimeRecoverySourceCiReceipt === input.runtimeRecoveryReleaseProvenance ||
    path.dirname(input.descriptorFile) !== stateDirectory ||
    path.basename(input.descriptorFile) !==
      "main-finance-access-v2-owner-descriptor.json"
  ) fail("runtime recovery authority artifacts must share one exact epoch root");
  assertOwnerPrivateDirectory(stateDirectory, "runtime recovery state directory");
  const names = readdirSync(receiptDirectory).sort();
  if (
    names.length === 0 || names.length > 10_000 ||
    names.some((name) => !RUNTIME_RECOVERY_RECEIPT_NAME.test(name))
  ) fail("runtime recovery receipt directory is not a finalized canonical chain");
  const receipts = [];
  const serializedReceipts = [];
  for (let index = 0; index < names.length; index += 1) {
    const expected = `${String(index + 1).padStart(6, "0")}.json`;
    if (names[index] !== expected) fail("runtime recovery receipt sequence has a gap");
    const parsed = parsePrivateJson(
      path.join(receiptDirectory, names[index]),
      "runtime recovery receipt",
    );
    receipts.push(parsed.value);
    serializedReceipts.push(parsed.source);
  }
  const sourceCi = parsePrivateJson(
    input.runtimeRecoverySourceCiReceipt,
    "runtime recovery source-CI receipt",
  );
  const provenance = parsePrivateJson(
    input.runtimeRecoveryReleaseProvenance,
    "runtime recovery release provenance",
  );
  let authority;
  try {
    authority = validateMainFinanceRuntimeRecoveryV4ReleaseAuthority({
      receipts: Object.freeze(receipts),
      serializedReceipts: Object.freeze(serializedReceipts),
      sourceCiReceipt: sourceCi.value,
      serializedSourceCiReceipt: sourceCi.source,
      provenance: provenance.value,
      serializedProvenance: provenance.source,
    });
  } catch {
    fail("raw schema-4 runtime recovery release authority differs");
  }
  if (
    canonicalJson(readdirSync(receiptDirectory).sort()) !== canonicalJson(names) ||
    canonicalJson(ownerPrivateDirectoryIdentity(
      receiptDirectory,
      "runtime recovery receipt directory",
    )) !== canonicalJson(receiptDirectoryIdentityBefore) ||
    canonicalJson(ownerPrivateDirectoryIdentity(
      epochRoot,
      "runtime recovery epoch root",
    )) !== canonicalJson(epochRootIdentityBefore)
  ) fail("runtime recovery authority directory identity changed while reading");
  return authority;
}

function assertRuntimeRecoveryTargetTransition(authority) {
  const before = authority.beforeTargetFunctionRow;
  const after = authority.afterTargetFunctionRow;
  if (
    before === null || typeof before !== "object" || Array.isArray(before) ||
    after === null || typeof after !== "object" || Array.isArray(after) ||
    canonicalJson(Object.keys(before).sort()) !== canonicalJson(Object.keys(after).sort()) ||
    before.slug !== TARGET_FUNCTION_SLUG || after.slug !== TARGET_FUNCTION_SLUG ||
    before.name !== TARGET_FUNCTION_SLUG || after.name !== TARGET_FUNCTION_SLUG ||
    !FUNCTION_UUID.test(before.id ?? "") || after.id !== before.id ||
    !Number.isSafeInteger(before.created_at) || before.created_at <= 0 ||
    after.created_at !== before.created_at ||
    before.verify_jwt !== false || after.verify_jwt !== false ||
    !["ACTIVE", "active"].includes(before.status) || after.status !== before.status ||
    !Number.isSafeInteger(before.version) || before.version <= 0 ||
    after.version !== before.version + 1 ||
    !Number.isSafeInteger(before.updated_at) || before.updated_at <= 0 ||
    !Number.isSafeInteger(after.updated_at) || after.updated_at <= before.updated_at ||
    typeof before.ezbr_sha256 !== "string" || !SHA256.test(before.ezbr_sha256) ||
    typeof after.ezbr_sha256 !== "string" || !SHA256.test(after.ezbr_sha256) ||
    after.ezbr_sha256 === before.ezbr_sha256
  ) fail("runtime recovery target function transition differs");
  const allowedChanges = new Set([
    "version", "updated_at", "ezbr_sha256", "entrypoint_path", "import_map_path",
  ]);
  for (const key of Object.keys(before)) {
    if (!allowedChanges.has(key) && canonicalJson(before[key]) !== canonicalJson(after[key])) {
      fail("runtime recovery target identity/created/status/verify transition differs");
    }
  }
  const expectedPath = (row, leaf) =>
    `file:///tmp/user_fn_${MAIN_PROJECT_REF}_${row.id}_${row.version}` +
    `/source/supabase/functions/${TARGET_FUNCTION_SLUG}/${leaf}`;
  if (
    before.entrypoint_path !== expectedPath(before, "index.ts") ||
    after.entrypoint_path !== expectedPath(after, "index.ts") ||
    (Object.hasOwn(before, "import_map_path") &&
      (before.import_map_path !== expectedPath(before, "deno.json") ||
        after.import_map_path !== expectedPath(after, "deno.json")))
  ) fail("runtime recovery target function deployment paths differ");
}

function assertCurrentRuntimeRecoveryReleaseAuthority({
  authority,
  sourceCommitSha,
  sourceTreeSha,
  sourceDeploymentSha256,
  releaseManifestSha256,
  productionBoundarySha256,
  targetDescriptorSha256,
  operatorDescriptorFileSha256,
  operatorDescriptorSha256,
  functionInventories,
}) {
  exactKeys(authority, [
    "schemaVersion", "sourceCommitSha", "sourceTreeSha", "releaseManifestSha256",
    "sourceDeploymentSha256", "productionBoundarySha256", "targetDescriptorSha256",
    "operatorDescriptorFileSha256", "operatorDescriptorSha256",
    "hostedSourceClosureSha256", "hostedSourceMetadataSha256",
    "completionReceiptSha256", "functionInventorySha256",
    "beforeTargetFunctionRow", "afterTargetFunctionRow", "targetTransitionDisposition",
  ], "runtime recovery release authority");
  if (
    !Object.isFrozen(authority) ||
    !Object.isFrozen(authority.beforeTargetFunctionRow) ||
    !Object.isFrozen(authority.afterTargetFunctionRow) ||
    authority.schemaVersion !== 4 ||
    authority.targetTransitionDisposition !== "exact-target-replacement-plus-one" ||
    authority.sourceCommitSha !== sourceCommitSha ||
    authority.sourceTreeSha !== sourceTreeSha ||
    authority.sourceDeploymentSha256 !== sourceDeploymentSha256 ||
    authority.releaseManifestSha256 !== releaseManifestSha256 ||
    authority.productionBoundarySha256 !== productionBoundarySha256 ||
    authority.targetDescriptorSha256 !== targetDescriptorSha256 ||
    authority.operatorDescriptorFileSha256 !== operatorDescriptorFileSha256 ||
    authority.operatorDescriptorSha256 !== operatorDescriptorSha256 ||
    !SHA256.test(authority.operatorDescriptorFileSha256 ?? "") ||
    !SHA256.test(authority.operatorDescriptorSha256 ?? "") ||
    !SHA256.test(authority.hostedSourceClosureSha256 ?? "") ||
    !SHA256.test(authority.hostedSourceMetadataSha256 ?? "") ||
    !SHA256.test(authority.completionReceiptSha256 ?? "") ||
    !SHA256.test(authority.functionInventorySha256 ?? "") ||
    !Array.isArray(functionInventories) || functionInventories.length === 0
  ) fail("runtime recovery release authority boundary differs");
  assertRuntimeRecoveryTargetTransition(authority);
  for (const inventory of functionInventories) {
    const target = inventory?.rows?.filter((row) => row.slug === TARGET_FUNCTION_SLUG) ?? [];
    if (
      inventory?.sha256 !== authority.functionInventorySha256 ||
      sha256(canonicalJson(inventory?.rows)) !== authority.functionInventorySha256 ||
      target.length !== 1 ||
      canonicalJson(target[0]) !== canonicalJson(authority.afterTargetFunctionRow)
    ) fail("live function inventory differs from terminal runtime recovery authority");
  }
  return Object.freeze({
    completionReceiptSha256: authority.completionReceiptSha256,
    functionInventorySha256: authority.functionInventorySha256,
    targetVersion: authority.afterTargetFunctionRow.version,
  });
}

function readDescriptor(file, input) {
  const parsed = parsePrivateJson(file, "operator descriptor");
  exactKeys(parsed.value, [
    "schema_version",
    "kind",
    "environment",
    "main_project_ref",
    "finance_project_ref",
    "main_edge_origin",
    "production_deny_project_refs",
    "source_deployment_sha256",
    "production_boundary_sha256",
    "target_descriptor_sha256",
    "operator_secret",
    "descriptor_sha256",
  ], "operator descriptor");
  const { operator_secret: operatorSecret, descriptor_sha256: descriptorSha256, ...core } =
    parsed.value;
  if (
    parsed.value.schema_version !== 2 ||
    parsed.value.kind !== "main-finance-access-v2-owner-private-descriptor" ||
    parsed.value.environment !== "staging" ||
    parsed.value.main_project_ref !== input.mainProjectRef ||
    parsed.value.finance_project_ref !== input.financeProjectRef ||
    parsed.value.main_edge_origin !== MAIN_ORIGIN ||
    canonicalJson(parsed.value.production_deny_project_refs) !==
      canonicalJson(PRODUCTION_DENY_REFS) ||
    parsed.value.source_deployment_sha256 !== input.sourceDeploymentSha256 ||
    typeof parsed.value.production_boundary_sha256 !== "string" ||
    typeof parsed.value.target_descriptor_sha256 !== "string" ||
    !SHA256.test(parsed.value.production_boundary_sha256) ||
    !SHA256.test(parsed.value.target_descriptor_sha256) ||
    !SECRET.test(operatorSecret) ||
    descriptorSha256 !== sha256(canonicalJson({ ...core, operator_secret: operatorSecret }))
  ) fail("operator descriptor contract differs");
  return Object.freeze({
    operatorSecret,
    fileSha256: parsed.sha256,
    descriptorSha256,
    productionBoundarySha256: parsed.value.production_boundary_sha256,
    targetDescriptorSha256: parsed.value.target_descriptor_sha256,
  });
}

function readRequest(file, input) {
  const parsed = parsePrivateJson(file, "Edge request");
  exactKeys(parsed.value, [
    "schema_version",
    "action",
    "main_project_ref",
    "finance_project_ref",
    "production_deny_project_refs",
    "source_deployment_sha256",
    "snapshot",
    "command",
  ], "Edge request");
  if (
    parsed.value.schema_version !== 2 ||
    !["status", "grant", "revoke", "reconcile"].includes(parsed.value.action) ||
    parsed.value.main_project_ref !== input.mainProjectRef ||
    parsed.value.finance_project_ref !== input.financeProjectRef ||
    canonicalJson(parsed.value.production_deny_project_refs) !==
      canonicalJson(PRODUCTION_DENY_REFS) ||
    parsed.value.source_deployment_sha256 !== input.sourceDeploymentSha256 ||
    (["grant", "revoke"].includes(parsed.value.action) &&
      parsed.value.command?.dispatch !== true) ||
    (parsed.value.action === "reconcile" &&
      parsed.value.command?.original_plan?.dispatch !== true)
  ) fail("Edge request boundary differs");
  return Object.freeze({
    action: parsed.value.action,
    value: parsed.value,
    body: parsed.source.slice(0, -1),
    fileSha256: parsed.sha256,
    bodySha256: sha256(parsed.source.slice(0, -1)),
  });
}

async function readBoundedResponse(response) {
  if (response.redirected) fail("Edge response redirected");
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)) {
    fail("Edge response content type differs");
  }
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") {
    fail("Edge response encoding differs");
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/u.test(length) || Number(length) > MAXIMUM_RESPONSE_BYTES)) {
    fail("Edge response is too large");
  }
  if (!response.body) fail("Edge response body is missing");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAXIMUM_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      fail("Edge response is too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let source;
  let value;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(source);
  } catch {
    fail("Edge response is not UTF-8 JSON");
  }
  if (JSON.stringify(value) !== source) fail("Edge response is not exact JSON");
  return Object.freeze({ value, source, sha256: sha256(source) });
}

function validateStatusResponse(value, request, extraKeys = [], eventRequired = false) {
  const expectedKeys = [
    "ok",
    "action",
    "main_user_id",
    "current_version",
    "desired_state",
    "applied_version",
    "applied_state",
    "event",
    ...extraKeys,
  ];
  exactKeys(value, expectedKeys, "Edge status response");
  let command = request.value.command;
  if (request.action === "reconcile") command = command?.original_plan;
  if (
    value.ok !== true ||
    value.action !== request.action ||
    value.main_user_id !== command?.main_user_id ||
    !decimalString(value.current_version) ||
    ![null, "granted", "revoked"].includes(value.desired_state) ||
    !decimalString(value.applied_version) ||
    ![null, "granted", "revoked"].includes(value.applied_state)
  ) fail("Edge status response contract differs");
  if (
    BigInt(value.applied_version) > BigInt(value.current_version) ||
    (value.current_version === "0") !== (value.desired_state === null) ||
    (value.applied_version === "0") !== (value.applied_state === null)
  ) fail("Edge status version invariant differs");
  if (value.event === null) {
    if (eventRequired) fail("Edge success response is missing its event");
    return;
  }
  exactKeys(
    value.event,
    ["event_id", "version", "desired_state", "state"],
    "Edge status event",
  );
  if (
    value.event.event_id !== command?.event_id ||
    typeof value.event.event_id !== "string" ||
    !UUID_V4.test(value.event.event_id) ||
    !decimalString(value.event.version) ||
    value.event.version === "0" ||
    !["granted", "revoked"].includes(value.event.desired_state) ||
    !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(
      value.event.state,
    )
  ) fail("Edge status event contract differs");
  if (BigInt(value.event.version) > BigInt(value.current_version)) {
    fail("Edge status event version exceeds current version");
  }
}

function validateCurrentMutationStatus(value, desiredState, priorVersion) {
  const exactSuccessorVersion = (BigInt(priorVersion) + 1n).toString();
  if (
    value.current_version !== exactSuccessorVersion ||
    value.desired_state !== desiredState ||
    value.event.desired_state !== desiredState ||
    value.event.state !== "applied" ||
    value.event.version !== value.current_version ||
    value.applied_version !== value.current_version ||
    value.applied_state !== desiredState
  ) fail("Edge mutation status is not the exact current event");
}

function validateSuccessfulResponse(response, parsed, request, descriptor, input) {
  if (response.status !== 200) fail("Edge success status differs");
  const value = parsed.value;
  if (request.action === "attest") {
    exactKeys(value, [
      "ok",
      "action",
      "provided_descriptor_replayed",
      "database_clock",
      "checked_count",
      "mismatch_count",
      "state_sha256",
      "attested_at",
      "attestation_proof",
    ], "Edge attest response");
    const snapshot = request.value.snapshot;
    if (
      value.ok !== true ||
      value.action !== "attest" ||
      value.provided_descriptor_replayed !== true ||
      value.database_clock !== snapshot?.database_clock ||
      value.checked_count !== snapshot?.checked_count ||
      !Number.isSafeInteger(value.checked_count) ||
      value.checked_count <= 0 ||
      value.mismatch_count !== 0 ||
      value.state_sha256 !== snapshot?.state_sha256 ||
      typeof value.state_sha256 !== "string" ||
      !SHA256.test(value.state_sha256) ||
      !canonicalTimestamp(value.attested_at) ||
      typeof value.attestation_proof !== "string" ||
      !/^[1-9][0-9]{12}\.[0-9a-f]{64}$/u.test(value.attestation_proof)
    ) fail("Edge attest response contract differs");
    if (!canonicalTimestamp(snapshot.database_clock)) {
      fail("attested snapshot database clock differs");
    }
    const [proofTimestampSource, proofDigest] = value.attestation_proof.split(".");
    const proofTimestamp = Number(proofTimestampSource);
    const attestedAt = Date.parse(value.attested_at);
    if (
      !Number.isSafeInteger(proofTimestamp) ||
      proofTimestamp !== attestedAt ||
      attestedAt < Date.parse(snapshot.database_clock)
    ) fail("Edge attest proof clock differs");
    const expectedProofDigest = createHmac("sha256", descriptor.operatorSecret)
      .update(attestationProofMessage(
        input.sourceDeploymentSha256,
        snapshot,
        proofTimestamp,
      ), "utf8")
      .digest("hex");
    if (!constantTimeSha256HexEqual(proofDigest, expectedProofDigest)) {
      fail("Edge attest proof authentication differs");
    }
    return Object.freeze({ reconcileRequired: false });
  }
  if (request.action === "status") {
    validateStatusResponse(value, request);
    return Object.freeze({ reconcileRequired: false });
  }
  if (["grant", "revoke"].includes(request.action)) {
    validateStatusResponse(value, request, ["replayed", "dispatch_performed"], true);
    if (
      typeof value.replayed !== "boolean" ||
      typeof value.dispatch_performed !== "boolean" ||
      value.replayed !== false ||
      value.dispatch_performed !== request.value.command?.dispatch
    ) fail("Edge mutation response contract differs");
    validateCurrentMutationStatus(
      value,
      request.action === "grant" ? "granted" : "revoked",
      request.value.command.expected_version,
    );
    return Object.freeze({ reconcileRequired: false });
  }
  if (request.action === "reconcile") {
    validateStatusResponse(value, request, [
      "replayed",
      "dispatch_performed",
      "original_plan_sha256",
      "reconcile_sha256",
    ], true);
    if (
      typeof value.replayed !== "boolean" ||
      typeof value.dispatch_performed !== "boolean" ||
      value.replayed !== true ||
      value.dispatch_performed !== false ||
      value.original_plan_sha256 !== request.value.command?.original_plan_sha256 ||
      value.reconcile_sha256 !== request.value.command?.reconcile_sha256 ||
      typeof value.original_plan_sha256 !== "string" ||
      typeof value.reconcile_sha256 !== "string" ||
      !SHA256.test(value.original_plan_sha256) ||
      !SHA256.test(value.reconcile_sha256)
    ) fail("Edge reconcile response contract differs");
    validateCurrentMutationStatus(
      value,
      request.value.command?.original_plan?.action === "grant" ? "granted" : "revoked",
      request.value.command?.original_plan?.expected_version,
    );
    return Object.freeze({ reconcileRequired: false });
  }
  fail("Edge response action differs");
}

function validateErrorResponse(response, parsed, request) {
  const value = parsed.value;
  const baseStatuses = Object.freeze({
    method_not_allowed: 405,
    unauthorized: 401,
    invalid_request: 400,
    temporarily_unavailable: 503,
  });
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(baseStatuses, value.error)
  ) {
    exactKeys(value, ["ok", "error"], "Edge error response");
    if (value.ok !== false || response.status !== baseStatuses[value.error]) {
      fail("Edge error response contract differs");
    }
    return Object.freeze({ reconcileRequired: response.status === 503 });
  }
  if (["attestation_outcome_unknown", "mutation_outcome_unknown"].includes(value?.error)) {
    exactKeys(value, ["ok", "error", "reconcile_required"], "Edge unknown response");
    if (value.ok !== false || value.reconcile_required !== true || response.status !== 503) {
      fail("Edge unknown response contract differs");
    }
    return Object.freeze({ reconcileRequired: true });
  }
  if (value?.error === "attestation_failed") {
    exactKeys(
      value,
      ["ok", "error", "checked_count", "mismatch_count"],
      "Edge attestation rejection",
    );
    if (
      value.ok !== false || response.status !== 409 ||
      value.checked_count !== 0 || value.mismatch_count !== 1
    ) fail("Edge attestation rejection contract differs");
    return Object.freeze({ reconcileRequired: false });
  }
  if (value?.error === "access_not_applied") {
    exactKeys(
      value,
      [
        "ok",
        "error",
        "reconcile_required",
        "manual_recovery_required",
        "dispatch_performed",
      ],
      "Edge access no-go response",
    );
    const expectedDispatch = ["grant", "revoke"].includes(request.action);
    if (
      !["grant", "revoke", "reconcile"].includes(request.action) ||
      value.ok !== false || response.status !== 409 ||
      value.reconcile_required !== false ||
      value.manual_recovery_required !== true ||
      value.dispatch_performed !== expectedDispatch
    ) fail("Edge access no-go response contract differs");
    return Object.freeze({
      reconcileRequired: false,
      manualRecoveryRequired: true,
    });
  }
  if (["reconcile_event_absent", "mutation_requires_reconciliation"].includes(value?.error)) {
    exactKeys(
      value,
      ["ok", "error", "reconcile_required", "dispatch_performed"],
      "Edge reconciliation response",
    );
    if (
      value.ok !== false || response.status !== 409 ||
      value.reconcile_required !== true || value.dispatch_performed !== false
    ) fail("Edge reconciliation response contract differs");
    return Object.freeze({ reconcileRequired: true });
  }
  fail("Edge error response contract differs");
}

function validateEdgeResponse(response, parsed, request, descriptor, input) {
  return response.ok
    ? validateSuccessfulResponse(response, parsed, request, descriptor, input)
    : validateErrorResponse(response, parsed, request);
}

function assertOwnerPrivateDirectory(directory, label) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || path.resolve(directory) !== directory) {
    fail(`${label} must be absolute and normalized`);
  }
  if (!isOutsideRepository(directory)) fail(`${label} must stay outside repository`);
  const status = lstatSync(directory);
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory ||
    (status.mode & 0o777) !== 0o700 ||
    (typeof process.geteuid === "function" && status.uid !== process.geteuid())) {
    fail(`${label} must be an owner-private real directory`);
  }
  return directory;
}

function ownerPrivateDirectoryIdentity(directory, label) {
  assertOwnerPrivateDirectory(directory, label);
  const status = lstatSync(directory, { bigint: true });
  return Object.freeze({
    device: status.dev.toString(),
    inode: status.ino.toString(),
  });
}

function assertPreparePlanReceiptDirectoryBinding(plan, directory) {
  const current = ownerPrivateDirectoryIdentity(directory, "receipt directory");
  if (
    current.device !== plan.receipt_directory_device ||
    current.inode !== plan.receipt_directory_inode
  ) fail("receipt directory identity differs from the prepare plan");
}

function fsyncOwnerPrivateDirectory(directory, label) {
  assertOwnerPrivateDirectory(directory, label);
  let descriptor;
  try {
    descriptor = openSync(
      directory,
      fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) |
        (fsConstants.O_NOFOLLOW ?? 0),
    );
    const status = fstatSync(descriptor);
    if (
      !status.isDirectory() || (status.mode & 0o777) !== 0o700 ||
      (typeof process.geteuid === "function" && status.uid !== process.geteuid())
    ) fail(`${label} changed while synchronizing`);
    fsyncSync(descriptor);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Main Finance access v2 operator refused:")
    ) throw error;
    fail(`${label} could not be durably synchronized`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function assertReceiptDirectoryLease(lease) {
  assertOwnerPrivateDirectory(lease.directory, "receipt directory");
  let linkStatus;
  let openStatus;
  try {
    linkStatus = lstatSync(lease.file, { bigint: true });
    openStatus = fstatSync(lease.descriptor, { bigint: true });
  } catch {
    fail("receipt-directory lease disappeared");
  }
  if (
    !linkStatus.isFile() || linkStatus.isSymbolicLink() || linkStatus.nlink !== 1n ||
    !openStatus.isFile() || openStatus.nlink !== 1n ||
    linkStatus.dev !== lease.device || linkStatus.ino !== lease.inode ||
    openStatus.dev !== lease.device || openStatus.ino !== lease.inode ||
    (linkStatus.mode & 0o777n) !== 0o600n || (openStatus.mode & 0o777n) !== 0o600n ||
    (typeof process.geteuid === "function" &&
      (linkStatus.uid !== BigInt(process.geteuid()) || openStatus.uid !== BigInt(process.geteuid())))
  ) fail("receipt-directory lease changed");
}

function acquireReceiptDirectoryLease(directory) {
  assertOwnerPrivateDirectory(directory, "receipt directory");
  const file = path.join(directory, RECEIPT_DIRECTORY_LEASE_NAME);
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    fsyncSync(descriptor);
    const status = fstatSync(descriptor, { bigint: true });
    const lease = Object.freeze({
      directory,
      file,
      descriptor,
      device: status.dev,
      inode: status.ino,
    });
    assertReceiptDirectoryLease(lease);
    fsyncOwnerPrivateDirectory(directory, "receipt directory");
    return lease;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (
      error instanceof Error &&
      error.message.startsWith("Main Finance access v2 operator refused:")
    ) throw error;
    fail("receipt directory is leased by another prepare/execute; retry only before intent");
  }
}

function releaseReceiptDirectoryLease(lease) {
  try {
    assertReceiptDirectoryLease(lease);
    unlinkSync(lease.file);
    fsyncOwnerPrivateDirectory(lease.directory, "receipt directory");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Main Finance access v2 operator refused:")
    ) throw error;
    fail("receipt-directory lease could not be released safely");
  } finally {
    closeSync(lease.descriptor);
  }
}

async function withReceiptDirectoryLease(directory, operation) {
  const lease = acquireReceiptDirectoryLease(directory);
  try {
    return await operation(lease);
  } finally {
    releaseReceiptDirectoryLease(lease);
  }
}

function assertRequestArtifactsAvailable(directory, requestBodySha256) {
  assertOwnerPrivateDirectory(directory, "receipt directory");
  const names = [
    `main-finance-access-v2-${requestBodySha256}-intent.json`,
    ...["verified", "rejected", "unknown", "no_go"].map((status) =>
      `main-finance-access-v2-${requestBodySha256}-${status}.json`),
  ];
  for (const name of names) {
    try {
      lstatSync(path.join(directory, name));
      fail("prior request artifact forbids repeated execution; reconcile manually");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function reserveRequestIntent(directory, core) {
  assertOwnerPrivateDirectory(directory, "receipt directory");
  const intent = { ...core, intent_sha256: sha256(canonicalJson(core)) };
  const source = `${canonicalJson(intent)}\n`;
  const file = path.join(
    directory,
    `main-finance-access-v2-${core.request_body_sha256}-intent.json`,
  );
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, source, { encoding: "utf8" });
    fsyncSync(descriptor);
    const statusAfterWrite = fstatSync(descriptor);
    if (
      !statusAfterWrite.isFile() || statusAfterWrite.nlink !== 1 ||
      (statusAfterWrite.mode & 0o777) !== 0o600 ||
      statusAfterWrite.size !== Buffer.byteLength(source) ||
      (typeof process.geteuid === "function" && statusAfterWrite.uid !== process.geteuid())
    ) fail("request intent durability contract differs");
    fsyncOwnerPrivateDirectory(directory, "receipt directory");
  } catch {
    // Never remove or overwrite a partial intent: its presence is a durable
    // UNKNOWN/no-retry barrier even when the hosted request was not attempted.
    fail("request intent could not be durably reserved; do not retry automatically");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return Object.freeze({
    file,
    intentSha256: intent.intent_sha256,
    fileSha256: sha256(source),
  });
}

function assertStatusOutputPath(file) {
  if (typeof file !== "string" || !path.isAbsolute(file) || path.resolve(file) !== file) {
    fail("status output path must be absolute and normalized");
  }
  if (!isOutsideRepository(file)) fail("status output must stay outside repository");
  assertOwnerPrivateDirectory(path.dirname(file), "status output directory");
  let exists = false;
  try {
    lstatSync(file);
    exists = true;
  } catch (error) {
    if (error?.code !== "ENOENT") fail("status output path is unavailable");
  }
  if (exists) fail("status output must not already exist");
  return file;
}

function writeStatusArtifact(file, descriptor, status) {
  assertStatusOutputPath(file);
  const artifact = {
    ok: true,
    mode: "status",
    target_environment: "staging",
    production_boundary_sha256: descriptor.productionBoundarySha256,
    target_descriptor_sha256: descriptor.targetDescriptorSha256,
    main_user_id: status.main_user_id,
    current_version: status.current_version,
    desired_state: status.desired_state,
    applied_version: status.applied_version,
    applied_state: status.applied_state,
    event: status.event,
  };
  const source = `${canonicalJson(artifact)}\n`;
  let output;
  try {
    output = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(output, 0o600);
    writeFileSync(output, source, { encoding: "utf8" });
    fsyncSync(output);
    const statusAfterWrite = fstatSync(output);
    if (
      !statusAfterWrite.isFile() || statusAfterWrite.nlink !== 1 ||
      (statusAfterWrite.mode & 0o777) !== 0o600 ||
      statusAfterWrite.size !== Buffer.byteLength(source) ||
      (typeof process.geteuid === "function" && statusAfterWrite.uid !== process.geteuid())
    ) fail("status output privacy contract differs");
    fsyncOwnerPrivateDirectory(path.dirname(file), "status output directory");
  } catch {
    fail("status output must be new and privately writable");
  } finally {
    if (output !== undefined) closeSync(output);
  }
  return Object.freeze({ file, sha256: sha256(source) });
}

function writeReceipt(directory, core) {
  assertOwnerPrivateDirectory(directory, "receipt directory");
  const receipt = { ...core, receipt_sha256: sha256(canonicalJson(core)) };
  const file = path.join(
    directory,
    `main-finance-access-v2-${core.request_body_sha256}-${core.status}.json`,
  );
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    const source = `${canonicalJson(receipt)}\n`;
    writeFileSync(descriptor, source, { encoding: "utf8" });
    fsyncSync(descriptor);
    const statusAfterWrite = fstatSync(descriptor);
    if (
      !statusAfterWrite.isFile() || statusAfterWrite.nlink !== 1 ||
      (statusAfterWrite.mode & 0o777) !== 0o600 ||
      statusAfterWrite.size !== Buffer.byteLength(source) ||
      (typeof process.geteuid === "function" && statusAfterWrite.uid !== process.geteuid())
    ) fail("receipt file privacy contract differs");
    fsyncOwnerPrivateDirectory(directory, "receipt directory");
  } catch {
    fail("receipt file must not already exist and must be writable privately");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return Object.freeze({ file, receipt });
}

function exactNowMilliseconds(nowImpl) {
  const value = nowImpl();
  const milliseconds = value instanceof Date ? value.getTime() : value;
  if (
    !Number.isSafeInteger(milliseconds) ||
    !/^[1-9][0-9]{12}$/u.test(String(milliseconds)) ||
    new Date(milliseconds).getTime() !== milliseconds
  ) fail("operator clock must be an exact millisecond timestamp");
  return milliseconds;
}

function readAccessToken(file) {
  const source = readPrivateFile(file, "Management access token", 4097);
  const value = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (!ACCESS_TOKEN.test(value) || /[\r\n]/u.test(value)) {
    fail("Management access token format differs");
  }
  return value;
}

function createOwnerPrivateDirectory(directory, label) {
  if (
    typeof directory !== "string" || !path.isAbsolute(directory) ||
    path.resolve(directory) !== directory || !isOutsideRepository(directory)
  ) fail(`${label} must be an absolute normalized path outside repository`);
  if (existsSync(directory)) fail(`${label} must be new`);
  assertOwnerPrivateDirectory(path.dirname(directory), `${label} parent`);
  try {
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, 0o700);
  } catch {
    fail(`${label} could not be created privately`);
  }
  assertOwnerPrivateDirectory(directory, label);
  fsyncOwnerPrivateDirectory(path.dirname(directory), `${label} parent`);
  return directory;
}

function writeCanonicalPrivateFile(file, value, label) {
  const source = `${canonicalJson(value)}\n`;
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW ?? 0),
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, source, "utf8");
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (
      !status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o600 ||
      status.size !== Buffer.byteLength(source) ||
      (typeof process.geteuid === "function" && status.uid !== process.geteuid())
    ) fail(`${label} privacy contract differs`);
    fsyncOwnerPrivateDirectory(path.dirname(file), `${label} directory`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Main Finance access v2 operator refused:")) {
      throw error;
    }
    fail(`${label} must be new and privately writable`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return Object.freeze({ file, source, sha256: sha256(source) });
}

function scrubCliEnvironment(_environment, accessToken, supabaseHome) {
  const result = { LANG: "C", LC_ALL: "C" };
  result.SUPABASE_ACCESS_TOKEN = accessToken;
  result.SUPABASE_HOME = supabaseHome;
  result.SUPABASE_NO_KEYRING = "1";
  result.SUPABASE_TELEMETRY_DISABLED = "1";
  result.DO_NOT_TRACK = "1";
  result.NO_COLOR = "1";
  return Object.freeze(result);
}

function defaultRunCli(executable, args, environment) {
  return spawnSync(executable, args, {
    cwd: environment.SUPABASE_HOME,
    env: environment,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000,
  });
}

function successfulProcess(result) {
  return result !== null && typeof result === "object" && result.status === 0 &&
    result.signal === null && !result.error && typeof result.stdout === "string" &&
    typeof result.stderr === "string";
}

function assertPinnedSupabaseCliBytes(executable) {
  if (executable !== SUPABASE_CLI_PIN.realPath) fail("Supabase CLI path differs from frozen pin");
  let status;
  try {
    status = lstatSync(executable);
  } catch {
    fail("pinned Supabase CLI is unavailable");
  }
  if (
    !status.isFile() || status.isSymbolicLink() || status.nlink !== 1 ||
    realpathSync(executable) !== executable || sha256(readFileSync(executable)) !== SUPABASE_CLI_PIN.sha256
  ) fail("pinned Supabase CLI bytes differ");
}

function validatePinnedSupabaseCli(executable, runCli, environment) {
  assertPinnedSupabaseCliBytes(executable);
  const supabaseHome = environment.SUPABASE_HOME;
  const homeBefore = ownerPrivateDirectoryIdentity(supabaseHome, "Supabase CLI home");
  if (readdirSync(supabaseHome).length !== 0) {
    fail("Supabase CLI home contains unreviewed state before version check");
  }
  const version = runCli(executable, ["--version"], environment);
  if (!successfulProcess(version) || version.stdout.trim() !== SUPABASE_CLI_PIN.version) {
    fail("pinned Supabase CLI version differs");
  }
  if (readdirSync(supabaseHome).length !== 0) {
    fail("Supabase CLI wrote unreviewed state during version check");
  }
  const homeAfter = ownerPrivateDirectoryIdentity(supabaseHome, "Supabase CLI home");
  if (canonicalJson(homeAfter) !== canonicalJson(homeBefore)) {
    fail("Supabase CLI home identity changed during version check");
  }
}

function invokeReadOnlyCli({
  executable,
  args,
  environment,
  supabaseHome,
  runCli,
  assertSupabaseCliBytes,
}) {
  const homeBefore = ownerPrivateDirectoryIdentity(supabaseHome, "Supabase CLI home");
  if (readdirSync(supabaseHome).length !== 0) fail("Supabase CLI home contains unreviewed state");
  assertSupabaseCliBytes(executable);
  let result;
  try {
    result = runCli(executable, args, environment);
  } catch {
    fail("read-only Supabase CLI invocation failed; output withheld");
  }
  if (readdirSync(supabaseHome).length !== 0) fail("Supabase CLI wrote unreviewed state");
  const homeAfter = ownerPrivateDirectoryIdentity(supabaseHome, "Supabase CLI home");
  if (canonicalJson(homeAfter) !== canonicalJson(homeBefore)) {
    fail("Supabase CLI home identity changed");
  }
  assertSupabaseCliBytes(executable);
  if (!successfulProcess(result) || Buffer.byteLength(result.stdout, "utf8") > 2 * 1024 * 1024) {
    fail("read-only Supabase CLI invocation failed; output withheld");
  }
  return result.stdout;
}

function parseSecretInventory(source, projectRef) {
  let rows;
  try {
    rows = JSON.parse(source);
  } catch {
    fail(`secret inventory JSON differs for ${projectRef}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) fail(`secret inventory differs for ${projectRef}`);
  const names = new Set();
  const normalized = rows.map((row) => {
    exactKeys(row, ["name", "updated_at", "value"], "secret inventory row");
    if (
      !SECRET_NAME.test(row.name ?? "") || !SHA256.test(row.value ?? "") ||
      !canonicalTimestamp(row.updated_at) || names.has(row.name)
    ) fail("secret inventory row differs");
    names.add(row.name);
    return Object.freeze({ name: row.name, updated_at: row.updated_at, value: row.value });
  });
  normalized.sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze(normalized);
}

function normalizeFunctionInventory(source) {
  let rows;
  try {
    rows = JSON.parse(source);
  } catch {
    fail("function inventory JSON differs");
  }
  if (!Array.isArray(rows)) fail("function inventory differs");
  const slugs = new Set();
  const normalized = rows.map((row) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      fail("function inventory row differs");
    }
    const slug = row.slug;
    if (!Object.hasOwn(row, "slug") || typeof slug !== "string" ||
      !/^[a-z][a-z0-9-]{0,127}$/u.test(slug) || slugs.has(slug)) {
      fail("function inventory slug differs");
    }
    slugs.add(slug);
    if (Object.hasOwn(row, "verify_jwt") && typeof row.verify_jwt !== "boolean") {
      fail("function inventory verify_jwt differs");
    }
    if (Object.hasOwn(row, "status") && typeof row.status !== "string") {
      fail("function inventory status differs");
    }
    if (!Number.isSafeInteger(row.version) || row.version <= 0) {
      fail("function inventory deployment version differs");
    }
    return Object.freeze(JSON.parse(canonicalJson(row)));
  });
  normalized.sort((left, right) => String(left.slug ?? left.name)
    .localeCompare(String(right.slug ?? right.name)));
  const targets = normalized.filter((row) => row.slug === "finance-manage-access-v2");
  if (
    targets.length !== 1 || targets[0].verify_jwt !== false ||
    !["ACTIVE", "active"].includes(targets[0].status)
  ) fail("exact active finance-manage-access-v2 inventory differs");
  return Object.freeze({ rows: Object.freeze(normalized), sha256: sha256(canonicalJson(normalized)) });
}

function fetchFunctionInventory(dependencies) {
  const cli = (args) => invokeReadOnlyCli({ ...dependencies, args });
  return normalizeFunctionInventory(cli([
    "functions", "list", "--project-ref", MAIN_PROJECT_REF,
    "--output", "json", "--log-level", "error",
  ]));
}

function fetchSecretInventories(dependencies) {
  const cli = (args) => invokeReadOnlyCli({ ...dependencies, args });
  const main = parseSecretInventory(cli([
    "secrets", "list", "--project-ref", MAIN_PROJECT_REF,
    "--output", "json", "--log-level", "error",
  ]), MAIN_PROJECT_REF);
  const finance = parseSecretInventory(cli([
    "secrets", "list", "--project-ref", FINANCE_PROJECT_REF,
    "--output", "json", "--log-level", "error",
  ]), FINANCE_PROJECT_REF);
  return Object.freeze({
    main,
    finance,
    mainSha256: sha256(canonicalJson(main)),
    financeSha256: sha256(canonicalJson(finance)),
  });
}

function snapshotBody(snapshot) {
  const { source_deployment_sha256: ignored, ...body } = snapshot;
  return body;
}

function mutationPlanCore(action, command, sourceDeploymentSha256, snapshot) {
  return {
    schema_version: 2,
    action,
    main_project_ref: MAIN_PROJECT_REF,
    finance_project_ref: FINANCE_PROJECT_REF,
    source_deployment_sha256: sourceDeploymentSha256,
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
    dispatch: true,
    attestation_proof: command.attestation_proof,
    approval_expires_at: command.approval_expires_at,
    post_database_clock: command.post_database_clock,
    post_response_sha256: command.post_response_sha256,
    post_snapshot_sha256: command.post_snapshot_sha256,
  };
}

function buildOuterRequest(action, sourceDeploymentSha256, snapshot, command) {
  return Object.freeze({
    schema_version: 2,
    action,
    main_project_ref: MAIN_PROJECT_REF,
    finance_project_ref: FINANCE_PROJECT_REF,
    production_deny_project_refs: PRODUCTION_DENY_REFS,
    source_deployment_sha256: sourceDeploymentSha256,
    snapshot,
    command,
  });
}

async function authenticatedAttest({ d0, descriptor, input, fetchImpl, nowImpl }) {
  const request = buildMainFinanceRuntimeRecoveryAttestRequest(d0);
  const body = canonicalJson(request);
  const timestampNumber = exactNowMilliseconds(nowImpl);
  const timestamp = String(timestampNumber);
  const signature = createHmac("sha256", descriptor.operatorSecret).update([
    "main-finance-access-v2-request", "POST", EDGE_PATH, timestamp, sha256(body),
  ].join("\n"), "utf8").digest("hex");
  let response;
  try {
    response = await fetchImpl(EDGE_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "x-architecture-finance-operator-v2": signature,
        "x-architecture-finance-timestamp-v2": timestamp,
      },
      body,
    });
  } catch {
    fail("Edge attestation outcome is unknown; prepare must not retry automatically");
  }
  if (!response.ok || response.status !== 200) {
    fail("Edge attestation was not verified");
  }
  const parsed = await readBoundedResponse(response);
  const proof = verifyMainFinanceRuntimeRecoveryAttestResponse({
    d0,
    sourceDeploymentSha256: input.sourceDeploymentSha256,
    operatorSecret: descriptor.operatorSecret,
    responseSource: parsed.source,
    now: () => new Date(exactNowMilliseconds(nowImpl)),
  });
  const rawProof = extractMainFinanceRuntimeRecoveryVerifiedAttestationProof({ proof, d0 });
  if (sha256(rawProof) !== proof.proofSha256) fail("verified raw proof binding differs");
  return Object.freeze({ proof, rawProof });
}

function expectedApprovalToken(plan) {
  if (!["grant", "revoke", "reconcile"].includes(plan.action)) return null;
  return [
    `MAIN_FINANCE_ACCESS_V2_APPROVED=${plan.action.toUpperCase()}`,
    MAIN_PROJECT_REF,
    FINANCE_PROJECT_REF,
    plan.source_commit_sha,
    plan.source_tree_sha,
    plan.source_deployment_sha256,
    plan.production_boundary_sha256,
    plan.target_descriptor_sha256,
    plan.runtime_release_completion_receipt_sha256,
    plan.runtime_release_function_inventory_sha256,
    plan.main_user_id,
    plan.event_id,
    plan.expected_version,
    plan.action_authority_sha256,
    plan.request_body_sha256,
    plan.plan_receipt_sha256,
    String(Date.parse(plan.expires_at)),
  ].join(":");
}

function requestPlanBinding(request) {
  const mutatingOrReplayAction = ["grant", "revoke", "reconcile"].includes(request.action);
  return Object.freeze({
    action: request.action,
    request_body_sha256: request.bodySha256,
    request_file_sha256: request.fileSha256,
    action_authority_sha256: request.action === "status"
      ? sha256(canonicalJson(request.value.command))
      : (request.action === "reconcile"
        ? request.value.command?.reconcile_sha256
        : request.value.command?.plan_sha256),
    main_user_id: request.action === "reconcile"
      ? request.value.command?.original_plan?.main_user_id
      : request.value.command?.main_user_id,
    event_id: request.action === "reconcile"
      ? request.value.command?.original_plan?.event_id
      : request.value.command?.event_id,
    expected_version: request.action === "reconcile"
      ? request.value.command?.original_plan?.expected_version
      : (request.value.command?.expected_version ?? "0"),
    changed_by: request.action === "status" ? null :
      (request.action === "reconcile"
        ? request.value.command?.original_plan?.changed_by
        : request.value.command?.changed_by),
    source_commit_sha: request.value.snapshot?.main_source_commit_sha,
    source_tree_sha: request.value.snapshot?.main_source_tree_sha,
    d1_descriptor_sha256: ["grant", "revoke"].includes(request.action)
      ? request.value.command?.post_snapshot?.descriptor_sha256
      : request.value.snapshot?.descriptor_sha256,
    d0_descriptor_sha256: ["grant", "revoke"].includes(request.action)
      ? request.value.snapshot?.descriptor_sha256
      : null,
    proof_sha256: ["grant", "revoke"].includes(request.action)
      ? sha256(request.value.command?.attestation_proof ?? "")
      : null,
    approval_expires_at: request.action === "reconcile"
      ? request.value.command?.reconcile_approval_expires_at
      : (mutatingOrReplayAction ? request.value.command?.approval_expires_at : null),
  });
}

function assertRequestPlanBinding(plan, binding) {
  if (
    plan.action !== binding.action || plan.request_body_sha256 !== binding.request_body_sha256 ||
    plan.request_file_sha256 !== binding.request_file_sha256 ||
    plan.action_authority_sha256 !== binding.action_authority_sha256 ||
    plan.main_user_id !== binding.main_user_id || plan.event_id !== binding.event_id ||
    plan.expected_version !== binding.expected_version || plan.changed_by !== binding.changed_by ||
    plan.source_commit_sha !== binding.source_commit_sha ||
    plan.source_tree_sha !== binding.source_tree_sha ||
    plan.d1_descriptor_sha256 !== binding.d1_descriptor_sha256 ||
    (["grant", "revoke"].includes(binding.action) && (
      plan.d0_descriptor_sha256 !== binding.d0_descriptor_sha256 ||
      plan.proof_sha256 !== binding.proof_sha256
    )) ||
    (["grant", "revoke", "reconcile"].includes(binding.action) &&
      binding.approval_expires_at !== plan.expires_at)
  ) fail("request differs from latest prepare plan");
}

function assertOwnerApprovalToken(plan, ownerApprovalToken) {
  if (["grant", "revoke", "reconcile"].includes(plan.action)) {
    const expectedToken = expectedApprovalToken(plan);
    if (typeof ownerApprovalToken !== "string") {
      fail("exact privileged owner approval token is required");
    }
    const actualBytes = Buffer.from(ownerApprovalToken, "utf8");
    const expectedBytes = Buffer.from(expectedToken, "utf8");
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      fail("privileged owner approval token differs");
    }
    return sha256(ownerApprovalToken);
  }
  if (ownerApprovalToken !== null && ownerApprovalToken !== undefined) {
    fail("owner approval token is invalid for status");
  }
  return null;
}

function assertExecutionTemporalAuthority({
  plan,
  latestPlanReceiptSha256,
  leaseHeld,
  authorizationAtMs,
  intentBoundaryAtMs,
  requestStartedAtMs,
  intentReserved,
}) {
  const preparedAtMs = Date.parse(plan.prepared_at);
  const expiresAtMs = Date.parse(plan.expires_at);
  const mutation = ["grant", "revoke", "reconcile"].includes(plan.action);
  if (
    latestPlanReceiptSha256 !== plan.plan_receipt_sha256 || leaseHeld !== true ||
    mutation !== intentReserved ||
    ![preparedAtMs, expiresAtMs, authorizationAtMs, intentBoundaryAtMs, requestStartedAtMs]
      .every(Number.isSafeInteger) ||
    preparedAtMs > authorizationAtMs || authorizationAtMs > intentBoundaryAtMs ||
    intentBoundaryAtMs > requestStartedAtMs || requestStartedAtMs >= expiresAtMs
  ) fail("latest plan lease/TTL/causal execution authority differs");
  return Object.freeze({
    ready: true,
    action: plan.action,
    intentReserved,
    requestStartedAtMs,
  });
}

function writePreparePlan(receiptDirectory, core, preparedAtMs) {
  assertOwnerPrivateDirectory(receiptDirectory, "receipt directory");
  assertPreparePlanReceiptDirectoryBinding(core, receiptDirectory);
  const plan = Object.freeze({ ...core, plan_receipt_sha256: sha256(canonicalJson(core)) });
  const file = path.join(
    receiptDirectory,
    `main-finance-access-v2-${preparedAtMs}-${plan.plan_receipt_sha256}-plan.json`,
  );
  const written = writeCanonicalPrivateFile(file, plan, "prepare plan receipt");
  assertPreparePlanReceiptDirectoryBinding(plan, receiptDirectory);
  return Object.freeze({ ...written, plan });
}

function publishPreparePlanUnderLease(
  receiptDirectory,
  core,
  preparedAtMs,
  lease,
  expectedLatestPlanSha256 = null,
) {
  assertReceiptDirectoryLease(lease);
  const existing = readdirSync(receiptDirectory)
    .filter((name) => PREPARE_PLAN_NAME.test(name))
    .map((name) => readPreparePlan(path.join(receiptDirectory, name)))
    .sort((left, right) => Date.parse(left.plan.prepared_at) - Date.parse(right.plan.prepared_at));
  if (existing.length >= 10_000) fail("prepare plan receipt cardinality differs");
  const clocks = existing.map((item) => {
    assertPreparePlanReceiptDirectoryBinding(item.plan, receiptDirectory);
    return Date.parse(item.plan.prepared_at);
  });
  if (
    clocks.some((clock, index) => index > 0 && clocks[index - 1] >= clock) ||
    (clocks.length > 0 && clocks.at(-1) >= preparedAtMs) ||
    (expectedLatestPlanSha256 !== null &&
      existing.at(-1)?.plan.plan_receipt_sha256 !== expectedLatestPlanSha256)
  ) fail("new prepare plan clock must be later than every append-only plan");
  const written = writePreparePlan(receiptDirectory, core, preparedAtMs);
  assertLatestPreparePlan(written.file, receiptDirectory);
  assertReceiptDirectoryLease(lease);
  return written;
}

function readPreparePlan(file) {
  const parsed = parsePrivateJson(file, "prepare plan receipt");
  exactKeys(parsed.value, [
    "schema_version", "kind", "environment", "production_denied", "action",
    "prepared_at", "expires_at", "source_commit_sha", "source_tree_sha",
    "source_deployment_sha256", "production_boundary_sha256",
    "target_descriptor_sha256", "runtime_release_completion_receipt_sha256",
    "runtime_release_function_inventory_sha256",
    "receipt_directory_device", "receipt_directory_inode",
    "request_body_sha256", "request_file_sha256",
    "action_authority_sha256", "main_user_id", "event_id", "expected_version",
    "changed_by",
    "d0_descriptor_sha256", "d1_descriptor_sha256", "proof_sha256", "f0_sha256",
    "f1_sha256", "s0_main_sha256", "s0_finance_sha256", "s1_main_sha256",
    "s1_finance_sha256", "outcome", "plan_receipt_sha256",
  ], "prepare plan receipt");
  const { plan_receipt_sha256: planSha256, ...core } = parsed.value;
  if (
    parsed.value.schema_version !== 2 ||
    parsed.value.kind !== "main-finance-access-v2-prepare-plan" ||
    parsed.value.environment !== "staging" || parsed.value.production_denied !== true ||
    !["status", "grant", "revoke", "reconcile"].includes(parsed.value.action) ||
    !canonicalTimestamp(parsed.value.prepared_at) || !canonicalTimestamp(parsed.value.expires_at) ||
    Date.parse(parsed.value.expires_at) <= Date.parse(parsed.value.prepared_at) ||
    Date.parse(parsed.value.expires_at) - Date.parse(parsed.value.prepared_at) > PREPARE_PLAN_TTL_MS ||
    !GIT_OID.test(parsed.value.source_commit_sha ?? "") ||
    !GIT_OID.test(parsed.value.source_tree_sha ?? "") ||
    !UUID_V4.test(parsed.value.main_user_id ?? "") || !UUID_V4.test(parsed.value.event_id ?? "") ||
    !decimalString(parsed.value.expected_version) || parsed.value.outcome !== "ready" ||
    (parsed.value.action === "status"
      ? parsed.value.changed_by !== null
      : !ACTOR.test(parsed.value.changed_by ?? "")) ||
    !decimalString(parsed.value.receipt_directory_device) ||
    !decimalString(parsed.value.receipt_directory_inode) ||
    ![
      "source_deployment_sha256", "production_boundary_sha256",
      "target_descriptor_sha256", "runtime_release_completion_receipt_sha256",
      "runtime_release_function_inventory_sha256",
      "request_body_sha256", "request_file_sha256",
      "action_authority_sha256", "d1_descriptor_sha256", "f0_sha256", "f1_sha256",
      "s0_main_sha256", "s0_finance_sha256", "s1_main_sha256", "s1_finance_sha256",
    ].every((key) => SHA256.test(parsed.value[key] ?? "")) ||
    (parsed.value.action === "reconcile"
      ? (parsed.value.d0_descriptor_sha256 !== null || parsed.value.proof_sha256 !== null)
      : (!SHA256.test(parsed.value.d0_descriptor_sha256 ?? "") ||
        !SHA256.test(parsed.value.proof_sha256 ?? ""))) ||
    !SHA256.test(planSha256 ?? "") || planSha256 !== sha256(canonicalJson(core))
  ) fail("prepare plan receipt contract differs");
  const match = PREPARE_PLAN_NAME.exec(path.basename(file));
  if (!match || match[1] !== String(Date.parse(parsed.value.prepared_at)) || match[2] !== planSha256) {
    fail("prepare plan receipt filename differs");
  }
  return Object.freeze({ ...parsed, file, fileSha256: parsed.sha256, plan: parsed.value });
}

function assertLatestPreparePlan(file, receiptDirectory) {
  assertOwnerPrivateDirectory(receiptDirectory, "receipt directory");
  if (path.dirname(file) !== receiptDirectory || realpathSync(file) !== file) {
    fail("prepare plan receipt must be the selected receipt-directory artifact");
  }
  const plans = readdirSync(receiptDirectory)
    .filter((name) => PREPARE_PLAN_NAME.test(name))
    .map((name) => readPreparePlan(path.join(receiptDirectory, name)));
  if (plans.length === 0 || plans.length > 10_000) fail("prepare plan receipt cardinality differs");
  plans.sort((left, right) => Date.parse(left.plan.prepared_at) - Date.parse(right.plan.prepared_at));
  for (let index = 1; index < plans.length; index += 1) {
    if (Date.parse(plans[index - 1].plan.prepared_at) >= Date.parse(plans[index].plan.prepared_at)) {
      fail("prepare plan clock order differs");
    }
  }
  if (plans.at(-1).file !== file) {
    fail("execute requires the latest prepare plan");
  }
  return plans.at(-1);
}

function sameCanonical(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function snapshotArguments(input, contract, accessToken, inventories, phase, reconcileContext, nowImpl) {
  return {
    phase,
    accessToken,
    preflightSql: contract.preflightSql,
    preflightSqlSha256: contract.preflightSqlSha256,
    expectedCatalogSha256: contract.expectedCatalogSha256,
    releaseManifestSha256: contract.releaseManifestSha256,
    sourceDeploymentSha256: input.sourceDeploymentSha256,
    sourceCommitSha: input.sourceCommitSha,
    sourceTreeSha: input.sourceTreeSha,
    mainSecretInventoryRows: inventories.main,
    financeSecretInventoryRows: inventories.finance,
    reconcileContext,
    now: () => new Date(exactNowMilliseconds(nowImpl)),
  };
}

function validateReadinessSandwich({ f0, f1, s0, s1, d0, d1, proof }) {
  if (
    !sameCanonical(f0.rows, f1.rows) || f0.sha256 !== f1.sha256 ||
    !sameCanonical(s0.main, s1.main) || !sameCanonical(s0.finance, s1.finance) ||
    s0.mainSha256 !== s1.mainSha256 || s0.financeSha256 !== s1.financeSha256 ||
    !validateMainFinanceRuntimeRecoverySnapshotSandwich({ d0, proof, d1 })
  ) fail("F0/S0/D0/proof/S1/D1/F1 readiness sandwich drifted");
}

function calculateApprovalExpiry(now, d0, proof, d1) {
  const expires = Math.min(
    now + PREPARE_PLAN_TTL_MS,
    Date.parse(d0.database_clock) + SNAPSHOT_MAXIMUM_AGE_MS,
    Date.parse(proof.attestedAt) + SNAPSHOT_MAXIMUM_AGE_MS,
    Date.parse(d1.database_clock) + SNAPSHOT_MAXIMUM_AGE_MS,
  );
  if (!Number.isSafeInteger(expires) || expires <= now + 1_000) {
    fail("readiness evidence leaves no owner-review TTL");
  }
  return new Date(expires).toISOString();
}

function evaluateMutationOcc({ action, rows, mainUserId, eventId }) {
  if (
    !["grant", "revoke"].includes(action) || !Array.isArray(rows) || rows.length === 0 ||
    !UUID_V4.test(mainUserId ?? "") || !UUID_V4.test(eventId ?? "")
  ) fail("mutation OCC fixture differs");
  const identities = new Set();
  const events = new Set();
  for (const row of rows) {
    if (
      row === null || typeof row !== "object" || Array.isArray(row) ||
      !UUID_V4.test(row.main_user_id ?? "") || !UUID_V4.test(row.event_id ?? "") ||
      !["granted", "revoked"].includes(row.desired_state) ||
      !decimalString(row.version) || row.version === "0" ||
      identities.has(row.main_user_id) || events.has(row.event_id)
    ) fail("mutation OCC row differs");
    identities.add(row.main_user_id);
    events.add(row.event_id);
  }
  const target = rows.find((row) => row.main_user_id === mainUserId);
  const desiredState = action === "grant" ? "granted" : "revoked";
  if (events.has(eventId)) fail("event UUID already exists in the exact global D1 snapshot");
  if (target === undefined && action !== "grant") {
    fail("revoke target is absent from the exact global D1 snapshot");
  }
  if (target?.desired_state === desiredState) {
    fail("requested access state is already current; no-op mutations are forbidden");
  }
  return Object.freeze({
    desiredState,
    currentEventId: target?.event_id ?? null,
    expectedVersion: target?.version ?? "0",
    firstGrant: target === undefined,
  });
}

function buildMutationRequest(input, d0, proof, rawProof, d1, now) {
  const occ = evaluateMutationOcc({
    action: input.action,
    rows: d1.rows,
    mainUserId: input.mainUserId,
    eventId: input.eventId,
  });
  const expiresAt = calculateApprovalExpiry(now, d0, proof, d1);
  const command = {
    event_id: input.eventId,
    main_user_id: input.mainUserId,
    current_event_id: occ.currentEventId,
    expected_version: occ.expectedVersion,
    changed_by: input.changedBy,
    change_reason: "pending-plan-hash",
    dispatch: true,
    attestation_proof: rawProof,
    plan_sha256: "0".repeat(64),
    approval_expires_at: expiresAt,
    post_database_clock: d1.database_clock,
    post_response_sha256: d1.response_sha256,
    post_snapshot_sha256: d1.state_sha256,
    post_snapshot: snapshotBody(d1),
  };
  const planCore = mutationPlanCore(input.action, command, input.sourceDeploymentSha256, d0);
  const planSha256 = sha256(canonicalJson(planCore));
  command.plan_sha256 = planSha256;
  command.change_reason = `main_finance_runtime_recovery_v2_plan:${planSha256}`;
  return Object.freeze({
    request: buildOuterRequest(
      input.action,
      input.sourceDeploymentSha256,
      snapshotBody(d0),
      Object.freeze(command),
    ),
    actionAuthoritySha256: planSha256,
    expectedVersion: command.expected_version,
    expiresAt,
  });
}

function validateOriginalUnknownReceipt(file, originalRequest, descriptor, input) {
  const parsed = parsePrivateJson(file, "unknown outcome receipt");
  const receiptStatus = lstatSync(file, { bigint: true });
  const value = parsed.value;
  exactKeys(value, [
    "schema_version", "kind", "environment", "production_denied", "action", "status",
    "recorded_at", "source_deployment_sha256", "request_body_sha256",
    "request_file_sha256", "descriptor_file_sha256", "production_boundary_sha256",
    "target_descriptor_sha256", "approval_token_sha256",
    "prepare_plan_receipt_sha256", "prepare_plan_file_sha256",
    "request_intent_sha256", "request_intent_file_sha256", "status_artifact_sha256",
    "response_status", "response_sha256", "reconcile_required",
    "manual_recovery_required", "automatic_retry_performed", "hosted_request_count",
    "production_touched", "receipt_sha256",
  ], "unknown outcome receipt");
  const { receipt_sha256: receiptSha256, ...core } = value;
  if (
    value.schema_version !== 2 ||
    value.kind !== "main-finance-access-v2-operator-receipt" ||
    value.environment !== "staging" || value.production_denied !== true ||
    value.action !== originalRequest.action || value.status !== "unknown" ||
    !canonicalTimestamp(value.recorded_at) ||
    value.source_deployment_sha256 !== input.sourceDeploymentSha256 ||
    value.request_body_sha256 !== originalRequest.bodySha256 ||
    value.request_file_sha256 !== originalRequest.fileSha256 ||
    value.descriptor_file_sha256 !== descriptor.fileSha256 ||
    value.production_boundary_sha256 !== descriptor.productionBoundarySha256 ||
    value.target_descriptor_sha256 !== descriptor.targetDescriptorSha256 ||
    !SHA256.test(value.approval_token_sha256 ?? "") ||
    !SHA256.test(value.prepare_plan_receipt_sha256 ?? "") ||
    !SHA256.test(value.prepare_plan_file_sha256 ?? "") ||
    !SHA256.test(value.request_intent_sha256 ?? "") ||
    !SHA256.test(value.request_intent_file_sha256 ?? "") ||
    value.status_artifact_sha256 !== null ||
    !(value.response_status === null || Number.isSafeInteger(value.response_status)) ||
    !(value.response_sha256 === null || SHA256.test(value.response_sha256)) ||
    value.reconcile_required !== true || value.automatic_retry_performed !== false ||
    value.manual_recovery_required !== false ||
    value.hosted_request_count !== 1 || value.production_touched !== false ||
    (receiptStatus.mode & 0o777n) !== 0o600n ||
    !SHA256.test(receiptSha256 ?? "") || receiptSha256 !== sha256(canonicalJson(core))
  ) fail("unknown outcome receipt is not bound to the original request");
  if (
    path.dirname(file) !== input.receiptDirectory ||
    path.basename(file) !== `main-finance-access-v2-${originalRequest.bodySha256}-unknown.json`
  ) fail("unknown outcome receipt is not the append-only request artifact");
  return Object.freeze({ value, fileSha256: parsed.sha256 });
}

function readOriginalPreparePlanForUnknown(input, unknownReceipt, originalRequest) {
  const expectedPlanSha256 = unknownReceipt.value.prepare_plan_receipt_sha256;
  const matches = readdirSync(input.receiptDirectory).filter((name) => {
    const match = PREPARE_PLAN_NAME.exec(name);
    return match?.[2] === expectedPlanSha256;
  });
  if (matches.length !== 1) fail("unknown receipt's original prepare plan is unavailable");
  const originalPlan = readPreparePlan(path.join(input.receiptDirectory, matches[0]));
  if (
    originalPlan.fileSha256 !== unknownReceipt.value.prepare_plan_file_sha256 ||
    originalPlan.plan.action !== originalRequest.action ||
    originalPlan.plan.request_body_sha256 !== originalRequest.bodySha256 ||
    originalPlan.plan.request_file_sha256 !== originalRequest.fileSha256 ||
    unknownReceipt.value.approval_token_sha256 !==
      sha256(expectedApprovalToken(originalPlan.plan) ?? "")
  ) fail("unknown receipt's original prepare plan binding differs");
  assertPreparePlanReceiptDirectoryBinding(originalPlan.plan, input.receiptDirectory);
  assertLatestPreparePlan(originalPlan.file, input.receiptDirectory);
  return originalPlan.plan;
}

function validateOriginalRequestIntent(
  input,
  unknownReceipt,
  originalRequest,
  originalPlan,
  descriptor,
) {
  const file = path.join(
    input.receiptDirectory,
    `main-finance-access-v2-${originalRequest.bodySha256}-intent.json`,
  );
  const parsed = parsePrivateJson(file, "original request intent");
  const status = lstatSync(file, { bigint: true });
  const value = parsed.value;
  exactKeys(value, [
    "schema_version", "kind", "environment", "production_denied", "action", "status",
    "recorded_at", "source_deployment_sha256", "request_body_sha256",
    "request_file_sha256", "descriptor_file_sha256", "production_boundary_sha256",
    "target_descriptor_sha256", "approval_token_sha256",
    "prepare_plan_receipt_sha256", "prepare_plan_file_sha256", "orphan_status",
    "orphan_reconcile_required", "automatic_retry_forbidden", "hosted_request_count",
    "production_touched", "intent_sha256",
  ], "original request intent");
  const { intent_sha256: intentSha256, ...core } = value;
  const intentAt = Date.parse(value.recorded_at);
  if (
    value.schema_version !== 2 ||
    value.kind !== "main-finance-access-v2-operator-request-intent" ||
    value.environment !== "staging" || value.production_denied !== true ||
    value.action !== originalRequest.action || value.status !== "reserved" ||
    !canonicalTimestamp(value.recorded_at) ||
    intentAt < Date.parse(originalPlan.prepared_at) ||
    intentAt >= Date.parse(originalPlan.expires_at) ||
    Date.parse(unknownReceipt.value.recorded_at) < intentAt ||
    value.source_deployment_sha256 !== input.sourceDeploymentSha256 ||
    value.request_body_sha256 !== originalRequest.bodySha256 ||
    value.request_file_sha256 !== originalRequest.fileSha256 ||
    value.descriptor_file_sha256 !== descriptor.fileSha256 ||
    value.production_boundary_sha256 !== descriptor.productionBoundarySha256 ||
    value.target_descriptor_sha256 !== descriptor.targetDescriptorSha256 ||
    value.approval_token_sha256 !== sha256(expectedApprovalToken(originalPlan) ?? "") ||
    value.approval_token_sha256 !== unknownReceipt.value.approval_token_sha256 ||
    value.prepare_plan_receipt_sha256 !== originalPlan.plan_receipt_sha256 ||
    value.prepare_plan_file_sha256 !== unknownReceipt.value.prepare_plan_file_sha256 ||
    value.orphan_status !== "unknown" || value.orphan_reconcile_required !== true ||
    value.automatic_retry_forbidden !== true || value.hosted_request_count !== 0 ||
    value.production_touched !== false ||
    (status.mode & 0o777n) !== 0o600n ||
    !SHA256.test(intentSha256 ?? "") || intentSha256 !== sha256(canonicalJson(core)) ||
    unknownReceipt.value.request_intent_sha256 !== intentSha256 ||
    unknownReceipt.value.request_intent_file_sha256 !== parsed.sha256
  ) fail("unknown receipt's durable request intent binding differs");
  return Object.freeze({ file, value, fileSha256: parsed.sha256 });
}

function assertUnknownReconcileEvidence(evidence) {
  exactKeys(evidence, [
    "action", "latest_plan_receipt_sha256", "plan", "request", "descriptor",
    "approval_token_sha256", "receipt", "intent",
  ], "unknown reconcile evidence");
  exactKeys(evidence.plan, [
    "receipt_sha256", "file_sha256", "prepared_at_ms", "expires_at_ms",
  ], "unknown reconcile plan evidence");
  exactKeys(evidence.request, ["body_sha256", "file_sha256"], "unknown request evidence");
  exactKeys(evidence.descriptor, [
    "file_sha256", "production_boundary_sha256", "target_descriptor_sha256",
  ], "unknown descriptor evidence");
  exactKeys(evidence.receipt, [
    "action", "status", "recorded_at_ms", "request_body_sha256",
    "request_file_sha256", "descriptor_file_sha256", "production_boundary_sha256",
    "target_descriptor_sha256", "approval_token_sha256", "plan_receipt_sha256",
    "plan_file_sha256", "intent_sha256", "intent_file_sha256",
    "reconcile_required", "automatic_retry_performed", "hosted_request_count",
    "production_touched",
  ], "unknown receipt evidence");
  exactKeys(evidence.intent, [
    "action", "recorded_at_ms", "request_body_sha256", "request_file_sha256",
    "descriptor_file_sha256", "production_boundary_sha256", "target_descriptor_sha256",
    "approval_token_sha256", "plan_receipt_sha256", "plan_file_sha256",
    "intent_sha256", "file_sha256", "automatic_retry_forbidden",
    "hosted_request_count", "production_touched",
  ], "unknown intent evidence");
  const hashes = [
    evidence.latest_plan_receipt_sha256,
    evidence.plan.receipt_sha256,
    evidence.plan.file_sha256,
    evidence.request.body_sha256,
    evidence.request.file_sha256,
    evidence.descriptor.file_sha256,
    evidence.descriptor.production_boundary_sha256,
    evidence.descriptor.target_descriptor_sha256,
    evidence.approval_token_sha256,
    evidence.receipt.intent_sha256,
    evidence.receipt.intent_file_sha256,
    evidence.intent.intent_sha256,
    evidence.intent.file_sha256,
  ];
  if (
    !["grant", "revoke"].includes(evidence.action) || !hashes.every((value) => SHA256.test(value)) ||
    ![evidence.plan.prepared_at_ms, evidence.plan.expires_at_ms,
      evidence.receipt.recorded_at_ms, evidence.intent.recorded_at_ms]
      .every(Number.isSafeInteger) ||
    evidence.plan.prepared_at_ms > evidence.intent.recorded_at_ms ||
    evidence.intent.recorded_at_ms >= evidence.plan.expires_at_ms ||
    evidence.intent.recorded_at_ms > evidence.receipt.recorded_at_ms ||
    evidence.latest_plan_receipt_sha256 !== evidence.plan.receipt_sha256 ||
    evidence.receipt.action !== evidence.action || evidence.intent.action !== evidence.action ||
    evidence.receipt.status !== "unknown" ||
    evidence.receipt.request_body_sha256 !== evidence.request.body_sha256 ||
    evidence.receipt.request_file_sha256 !== evidence.request.file_sha256 ||
    evidence.intent.request_body_sha256 !== evidence.request.body_sha256 ||
    evidence.intent.request_file_sha256 !== evidence.request.file_sha256 ||
    evidence.receipt.descriptor_file_sha256 !== evidence.descriptor.file_sha256 ||
    evidence.intent.descriptor_file_sha256 !== evidence.descriptor.file_sha256 ||
    evidence.receipt.production_boundary_sha256 !==
      evidence.descriptor.production_boundary_sha256 ||
    evidence.intent.production_boundary_sha256 !==
      evidence.descriptor.production_boundary_sha256 ||
    evidence.receipt.target_descriptor_sha256 !== evidence.descriptor.target_descriptor_sha256 ||
    evidence.intent.target_descriptor_sha256 !== evidence.descriptor.target_descriptor_sha256 ||
    evidence.receipt.approval_token_sha256 !== evidence.approval_token_sha256 ||
    evidence.intent.approval_token_sha256 !== evidence.approval_token_sha256 ||
    evidence.receipt.plan_receipt_sha256 !== evidence.plan.receipt_sha256 ||
    evidence.intent.plan_receipt_sha256 !== evidence.plan.receipt_sha256 ||
    evidence.receipt.plan_file_sha256 !== evidence.plan.file_sha256 ||
    evidence.intent.plan_file_sha256 !== evidence.plan.file_sha256 ||
    evidence.receipt.intent_sha256 !== evidence.intent.intent_sha256 ||
    evidence.receipt.intent_file_sha256 !== evidence.intent.file_sha256 ||
    evidence.receipt.reconcile_required !== true ||
    evidence.receipt.automatic_retry_performed !== false ||
    evidence.receipt.hosted_request_count !== 1 || evidence.receipt.production_touched !== false ||
    evidence.intent.automatic_retry_forbidden !== true ||
    evidence.intent.hosted_request_count !== 0 || evidence.intent.production_touched !== false
  ) fail("unknown reconcile evidence binding differs");
  return Object.freeze({
    accepted: true,
    action: evidence.action,
    automaticRetryAllowed: false,
  });
}

function deriveReconcileContext(originalRequest) {
  if (!["grant", "revoke"].includes(originalRequest.action)) {
    fail("reconcile original request must be grant or revoke");
  }
  const command = originalRequest.value.command;
  const snapshot = {
    ...originalRequest.value.snapshot,
    source_deployment_sha256: originalRequest.value.source_deployment_sha256,
  };
  const planCore = mutationPlanCore(
    originalRequest.action,
    command,
    originalRequest.value.source_deployment_sha256,
    snapshot,
  );
  const originalPlanSha256 = sha256(canonicalJson(planCore));
  if (
    command.plan_sha256 !== originalPlanSha256 ||
    command.change_reason !== `main_finance_runtime_recovery_v2_plan:${originalPlanSha256}`
  ) fail("original mutation plan hash differs");
  return Object.freeze({
    context: Object.freeze({
      action: originalRequest.action,
      original_plan_sha256: originalPlanSha256,
      main_user_id: command.main_user_id,
      event_id: command.event_id,
      current_event_id: command.current_event_id,
      expected_version: command.expected_version,
      changed_by: command.changed_by,
      original_rows: command.post_snapshot.rows,
    }),
    originalPlan: Object.freeze(planCore),
  });
}

function evaluateReconcileDisposition(disposition) {
  if (disposition === "applied") {
    return Object.freeze({ outcome: "ready", executionAuthority: true });
  }
  if (disposition === "wait") {
    return Object.freeze({ outcome: "wait", executionAuthority: false });
  }
  if (["absent", "nonterminal"].includes(disposition)) {
    return Object.freeze({ outcome: "no_go", executionAuthority: false });
  }
  fail("reconcile disposition differs");
}

function buildReconcileRequest(input, snapshot, originalPlan, now) {
  const expiresAt = new Date(now + PREPARE_PLAN_TTL_MS).toISOString();
  const originalPlanSha256 = sha256(canonicalJson(originalPlan));
  const reconcileCore = {
    schema_version: 2,
    kind: "main-finance-access-v2-reconcile",
    main_project_ref: MAIN_PROJECT_REF,
    finance_project_ref: FINANCE_PROJECT_REF,
    source_deployment_sha256: input.sourceDeploymentSha256,
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
  const reconcileSha256 = sha256(canonicalJson(reconcileCore));
  return Object.freeze({
    request: buildOuterRequest("reconcile", input.sourceDeploymentSha256, snapshotBody(snapshot), {
      original_plan: originalPlan,
      original_plan_sha256: originalPlanSha256,
      reconcile_approval_expires_at: expiresAt,
      reconcile_sha256: reconcileSha256,
    }),
    actionAuthoritySha256: reconcileSha256,
    expectedVersion: originalPlan.expected_version,
    mainUserId: originalPlan.main_user_id,
    eventId: originalPlan.event_id,
    expiresAt,
  });
}

function preparePlanCore({ input, descriptor, request, requestFileSha256, now, expiresAt,
  actionAuthoritySha256, expectedVersion, mainUserId, eventId, changedBy, evidence }) {
  const receiptDirectoryIdentity = ownerPrivateDirectoryIdentity(
    input.receiptDirectory,
    "receipt directory",
  );
  return {
    schema_version: 2,
    kind: "main-finance-access-v2-prepare-plan",
    environment: "staging",
    production_denied: true,
    action: input.action,
    prepared_at: new Date(now).toISOString(),
    expires_at: expiresAt,
    source_commit_sha: input.sourceCommitSha,
    source_tree_sha: input.sourceTreeSha,
    source_deployment_sha256: input.sourceDeploymentSha256,
    production_boundary_sha256: descriptor.productionBoundarySha256,
    target_descriptor_sha256: descriptor.targetDescriptorSha256,
    runtime_release_completion_receipt_sha256:
      evidence.runtimeReleaseCompletionReceiptSha256,
    runtime_release_function_inventory_sha256:
      evidence.runtimeReleaseFunctionInventorySha256,
    receipt_directory_device: receiptDirectoryIdentity.device,
    receipt_directory_inode: receiptDirectoryIdentity.inode,
    request_body_sha256: sha256(canonicalJson(request)),
    request_file_sha256: requestFileSha256,
    action_authority_sha256: actionAuthoritySha256,
    main_user_id: mainUserId,
    event_id: eventId,
    expected_version: expectedVersion,
    changed_by: changedBy,
    d0_descriptor_sha256: evidence.d0DescriptorSha256,
    d1_descriptor_sha256: evidence.d1DescriptorSha256,
    proof_sha256: evidence.proofSha256,
    f0_sha256: evidence.f0Sha256,
    f1_sha256: evidence.f1Sha256,
    s0_main_sha256: evidence.s0MainSha256,
    s0_finance_sha256: evidence.s0FinanceSha256,
    s1_main_sha256: evidence.s1MainSha256,
    s1_finance_sha256: evidence.s1FinanceSha256,
    outcome: "ready",
  };
}

function writeReconcileObservation(receiptDirectory, originalPlan, core, recordedAtMs) {
  assertPreparePlanReceiptDirectoryBinding(originalPlan, receiptDirectory);
  const observation = Object.freeze({
    ...core,
    observation_sha256: sha256(canonicalJson(core)),
  });
  const file = path.join(
    receiptDirectory,
    `main-finance-access-v2-${recordedAtMs}-${observation.observation_sha256}-reconcile-observation.json`,
  );
  const written = writeCanonicalPrivateFile(file, observation, "reconcile observation");
  assertPreparePlanReceiptDirectoryBinding(originalPlan, receiptDirectory);
  return Object.freeze({ file: written.file, sha256: observation.observation_sha256 });
}

function parseArguments(argv) {
  const input = {
    mode: null,
    action: null,
    mainProjectRef: null,
    financeProjectRef: null,
    sourceDeploymentSha256: null,
    sourceCommitSha: null,
    sourceTreeSha: null,
    descriptorFile: null,
    requestFile: null,
    planReceiptFile: null,
    ownerApprovalToken: null,
    receiptDirectory: null,
    statusOut: null,
    accessTokenFile: null,
    supabaseCli: null,
    supabaseHome: null,
    outputDirectory: null,
    mainUserId: null,
    eventId: null,
    changedBy: null,
    originalRequestFile: null,
    unknownReceiptFile: null,
    runtimeRecoveryReceiptDirectory: null,
    runtimeRecoverySourceCiReceipt: null,
    runtimeRecoveryReleaseProvenance: null,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--plan", "--prepare", "--execute"].includes(argument)) {
      if (input.mode !== null || seen.has(argument)) fail("exactly one mode is required");
      seen.add(argument);
      input.mode = argument.slice(2);
      continue;
    }
    const mapping = {
      "--main-project-ref": "mainProjectRef",
      "--finance-project-ref": "financeProjectRef",
      "--source-deployment-sha256": "sourceDeploymentSha256",
      "--source-commit-sha": "sourceCommitSha",
      "--source-tree-sha": "sourceTreeSha",
      "--action": "action",
      "--descriptor-file": "descriptorFile",
      "--request-file": "requestFile",
      "--plan-receipt-file": "planReceiptFile",
      "--owner-approval-token": "ownerApprovalToken",
      "--receipt-directory": "receiptDirectory",
      "--status-out": "statusOut",
      "--access-token-file": "accessTokenFile",
      "--supabase-cli": "supabaseCli",
      "--supabase-home": "supabaseHome",
      "--output-directory": "outputDirectory",
      "--main-user-id": "mainUserId",
      "--event-id": "eventId",
      "--changed-by": "changedBy",
      "--original-request-file": "originalRequestFile",
      "--unknown-receipt-file": "unknownReceiptFile",
      "--runtime-recovery-receipt-dir": "runtimeRecoveryReceiptDirectory",
      "--runtime-recovery-source-ci-receipt": "runtimeRecoverySourceCiReceipt",
      "--runtime-recovery-release-provenance": "runtimeRecoveryReleaseProvenance",
    };
    const key = mapping[argument];
    if (!key || seen.has(argument)) fail(`unknown or duplicate argument ${argument}`);
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${argument} requires a value`);
    input[key] = value;
    index += 1;
  }
  if (!input.mode || !input.mainProjectRef || !input.financeProjectRef ||
    !input.sourceDeploymentSha256) fail("mode, two exact refs and source hash are required");
  assertCompiledBoundary(input);
  if (input.mode === "plan") {
    if (Object.entries(input).some(([key, value]) => ![
      "mode", "mainProjectRef", "financeProjectRef", "sourceDeploymentSha256",
    ].includes(key) && value !== null)) {
      fail("plan mode accepts no files");
    }
  } else if (input.mode === "prepare") {
    if (
      !["status", "grant", "revoke", "reconcile"].includes(input.action) ||
      !input.descriptorFile || !input.receiptDirectory || !input.sourceCommitSha ||
      !input.sourceTreeSha || !input.accessTokenFile || !input.supabaseCli ||
      !input.supabaseHome || !input.outputDirectory ||
      !input.runtimeRecoveryReceiptDirectory || !input.runtimeRecoverySourceCiReceipt ||
      !input.runtimeRecoveryReleaseProvenance || input.requestFile ||
      input.planReceiptFile || input.ownerApprovalToken || input.statusOut
    ) fail("prepare mode arguments differ");
    if (input.action === "reconcile") {
      if (!input.originalRequestFile || !input.unknownReceiptFile ||
        input.mainUserId || input.eventId || input.changedBy) {
        fail("reconcile prepare requires only original request and unknown receipt");
      }
    } else if (
      !input.mainUserId || !input.eventId || input.originalRequestFile ||
      input.unknownReceiptFile ||
      (["grant", "revoke"].includes(input.action) !== Boolean(input.changedBy))
    ) fail("status/mutation prepare identity arguments differ");
  } else if (
    !input.descriptorFile || !input.requestFile || !input.planReceiptFile ||
    !input.receiptDirectory || !input.accessTokenFile || !input.supabaseCli ||
    !input.supabaseHome || !input.runtimeRecoveryReceiptDirectory ||
    !input.runtimeRecoverySourceCiReceipt || !input.runtimeRecoveryReleaseProvenance ||
    input.action || input.sourceCommitSha || input.sourceTreeSha || input.outputDirectory ||
    input.mainUserId || input.eventId || input.changedBy || input.originalRequestFile ||
    input.unknownReceiptFile
  ) {
    fail("execute mode arguments differ from the exact plan, raw authority and fresh-list set");
  }
  return Object.freeze(input);
}

function isCompiledRuntimeFunctionPath(value) {
  return typeof value === "string" && new RegExp(
    `^file:///tmp/user_fn_${MAIN_PROJECT_REF}_[A-Za-z0-9-]+_[1-9][0-9]*/` +
      `source/supabase/functions/${TARGET_FUNCTION_SLUG}/(?:index\\.ts|deno\\.json)$`,
    "u",
  ).test(value);
}

function assertImmutablePlainFixture(value, label = "simulator fixture", seen = new Set()) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    if (
      typeof value === "string" && !isCompiledRuntimeFunctionPath(value) &&
      (/^(?:\/|[A-Za-z]:[\\/])/u.test(value) || value.includes("://"))
    ) {
      fail(`${label} cannot contain paths or network locations`);
    }
    return;
  }
  if (typeof value !== "object" || isProxy(value) || seen.has(value) || !Object.isFrozen(value)) {
    fail(`${label} must be deeply frozen plain data`);
  }
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
    fail(`${label} must be deeply frozen plain data`);
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    const exactRuntimeFunctionPath = ["entrypoint_path", "import_map_path"].includes(key) &&
      isCompiledRuntimeFunctionPath(descriptor.value);
    if (
      descriptor.get || descriptor.set || !Object.hasOwn(descriptor, "value") ||
      (!exactRuntimeFunctionPath &&
        /(?:^|_)(?:path|url|origin|argv|environment|callback|fetch|runner|impl|network)(?:_|$)/iu
          .test(key))
    ) fail(`${label} contains an effect capability`);
    assertImmutablePlainFixture(descriptor.value, `${label}.${key}`, seen);
  }
}

function assertSimulatorPlan(plan) {
  exactKeys(plan, [
    "action", "prepared_at", "expires_at", "source_commit_sha", "source_tree_sha",
    "source_deployment_sha256", "production_boundary_sha256", "target_descriptor_sha256",
    "runtime_release_completion_receipt_sha256",
    "runtime_release_function_inventory_sha256",
    "request_body_sha256", "request_file_sha256", "action_authority_sha256",
    "main_user_id", "event_id", "expected_version", "changed_by",
    "d0_descriptor_sha256", "d1_descriptor_sha256", "proof_sha256",
    "plan_receipt_sha256",
  ], "simulator plan");
  if (
    !["status", "grant", "revoke", "reconcile"].includes(plan.action) ||
    !canonicalTimestamp(plan.prepared_at) || !canonicalTimestamp(plan.expires_at) ||
    Date.parse(plan.prepared_at) >= Date.parse(plan.expires_at) ||
    !GIT_OID.test(plan.source_commit_sha ?? "") || !GIT_OID.test(plan.source_tree_sha ?? "") ||
    !UUID_V4.test(plan.main_user_id ?? "") || !UUID_V4.test(plan.event_id ?? "") ||
    !decimalString(plan.expected_version) ||
    (plan.action === "status" ? plan.changed_by !== null : !ACTOR.test(plan.changed_by ?? "")) ||
    ![
      "source_deployment_sha256", "production_boundary_sha256", "target_descriptor_sha256",
      "runtime_release_completion_receipt_sha256",
      "runtime_release_function_inventory_sha256",
      "request_body_sha256", "request_file_sha256", "action_authority_sha256",
      "d1_descriptor_sha256", "plan_receipt_sha256",
    ].every((key) => SHA256.test(plan[key] ?? "")) ||
    (plan.action === "reconcile"
      ? (plan.d0_descriptor_sha256 !== null || plan.proof_sha256 !== null)
      : (!SHA256.test(plan.d0_descriptor_sha256 ?? "") || !SHA256.test(plan.proof_sha256 ?? "")))
  ) fail("simulator plan differs");
}

function assertSimulatorBinding(binding) {
  exactKeys(binding, [
    "action", "request_body_sha256", "request_file_sha256", "action_authority_sha256",
    "main_user_id", "event_id", "expected_version", "changed_by", "source_commit_sha",
    "source_tree_sha", "d1_descriptor_sha256", "d0_descriptor_sha256", "proof_sha256",
    "approval_expires_at",
  ], "simulator request binding");
}

export function simulateMainFinanceAccessV2Contract(fixture) {
  assertImmutablePlainFixture(fixture);
  exactKeys(fixture, ["scenario", "input"], "simulator fixture");
  if (fixture.scenario === "owner-token-template") {
    exactKeys(fixture.input, ["plan"], "owner token simulator input");
    assertSimulatorPlan(fixture.input.plan);
    return Object.freeze({ ownerApprovalToken: expectedApprovalToken(fixture.input.plan) });
  }
  if (fixture.scenario === "execution-authority") {
    exactKeys(fixture.input, [
      "plan", "binding", "owner_approval_token", "latest_plan_receipt_sha256",
      "lease_held", "authorization_at_ms", "intent_boundary_at_ms",
      "request_started_at_ms", "intent_reserved",
    ], "execution authority simulator input");
    assertSimulatorPlan(fixture.input.plan);
    assertSimulatorBinding(fixture.input.binding);
    assertRequestPlanBinding(fixture.input.plan, fixture.input.binding);
    const approvalTokenSha256 = assertOwnerApprovalToken(
      fixture.input.plan,
      fixture.input.owner_approval_token,
    );
    const temporal = assertExecutionTemporalAuthority({
      plan: fixture.input.plan,
      latestPlanReceiptSha256: fixture.input.latest_plan_receipt_sha256,
      leaseHeld: fixture.input.lease_held,
      authorizationAtMs: fixture.input.authorization_at_ms,
      intentBoundaryAtMs: fixture.input.intent_boundary_at_ms,
      requestStartedAtMs: fixture.input.request_started_at_ms,
      intentReserved: fixture.input.intent_reserved,
    });
    return Object.freeze({ ...temporal, approvalTokenSha256 });
  }
  if (fixture.scenario === "mutation-occ") {
    exactKeys(fixture.input, [
      "action", "rows", "main_user_id", "event_id",
    ], "mutation OCC simulator input");
    return evaluateMutationOcc({
      action: fixture.input.action,
      rows: fixture.input.rows,
      mainUserId: fixture.input.main_user_id,
      eventId: fixture.input.event_id,
    });
  }
  if (fixture.scenario === "unknown-reconcile") {
    exactKeys(fixture.input, ["evidence"], "unknown reconcile simulator input");
    return assertUnknownReconcileEvidence(fixture.input.evidence);
  }
  if (fixture.scenario === "reconcile-disposition") {
    exactKeys(fixture.input, ["disposition"], "reconcile disposition simulator input");
    return evaluateReconcileDisposition(fixture.input.disposition);
  }
  if (fixture.scenario === "runtime-release-authority") {
    exactKeys(fixture.input, [
      "authority", "source_commit_sha", "source_tree_sha", "source_deployment_sha256",
      "release_manifest_sha256", "production_boundary_sha256",
      "target_descriptor_sha256", "operator_descriptor_file_sha256",
      "operator_descriptor_sha256", "f0_rows", "f1_rows",
    ], "runtime release authority simulator input");
    if (!Array.isArray(fixture.input.f0_rows) || !Array.isArray(fixture.input.f1_rows)) {
      fail("runtime release authority simulator inventories differ");
    }
    return assertCurrentRuntimeRecoveryReleaseAuthority({
      authority: fixture.input.authority,
      sourceCommitSha: fixture.input.source_commit_sha,
      sourceTreeSha: fixture.input.source_tree_sha,
      sourceDeploymentSha256: fixture.input.source_deployment_sha256,
      releaseManifestSha256: fixture.input.release_manifest_sha256,
      productionBoundarySha256: fixture.input.production_boundary_sha256,
      targetDescriptorSha256: fixture.input.target_descriptor_sha256,
      operatorDescriptorFileSha256: fixture.input.operator_descriptor_file_sha256,
      operatorDescriptorSha256: fixture.input.operator_descriptor_sha256,
      functionInventories: [fixture.input.f0_rows, fixture.input.f1_rows].map((rows) =>
        Object.freeze({ rows, sha256: sha256(canonicalJson(rows)) })),
    });
  }
  fail("simulator scenario differs");
}

async function manageFinanceAccessV2() {
  const input = parseArguments(process.argv.slice(2));
  const fetchImpl = globalThis.fetch;
  const nowImpl = () => Date.now();
  const runCli = defaultRunCli;
  if (input.mode === "plan") {
    return Object.freeze({
      ok: true,
      mode: "plan",
      environment: "staging",
      mainProjectRef: MAIN_PROJECT_REF,
      financeProjectRef: FINANCE_PROJECT_REF,
      productionDenied: true,
      hostedReadCount: 0,
      hostedMutationCount: 0,
      descriptorRead: false,
      secretRead: false,
      networkPerformed: false,
      approvalFileAccepted: false,
      supportedActions: Object.freeze(["status", "grant", "revoke", "reconcile"]),
    });
  }

  // Boundary has already failed closed from argv. Validate the exact raw
  // release chain and its same-epoch descriptor path before reading the
  // descriptor's operator secret bytes.
  const runtimeAuthorityAtEntry = readCurrentRuntimeRecoveryReleaseAuthority(input);
  const descriptor = readDescriptor(input.descriptorFile, input);
  if (input.mode === "prepare") {
    if (!GIT_OID.test(input.sourceCommitSha) || !GIT_OID.test(input.sourceTreeSha)) {
      fail("prepare source commit/tree SHA differs");
    }
    const contract = readMainFinanceRuntimeRecoveryV2SnapshotContract();
    if (contract.sourceDeploymentSha256 !== input.sourceDeploymentSha256) {
      fail("frozen snapshot contract source deployment differs");
    }
    const runtimeAuthority0 = runtimeAuthorityAtEntry;
    const bindRuntimeAuthority = (authority, functionInventories) =>
      assertCurrentRuntimeRecoveryReleaseAuthority({
        authority,
        sourceCommitSha: input.sourceCommitSha,
        sourceTreeSha: input.sourceTreeSha,
        sourceDeploymentSha256: input.sourceDeploymentSha256,
        releaseManifestSha256: contract.releaseManifestSha256,
        productionBoundarySha256: descriptor.productionBoundarySha256,
        targetDescriptorSha256: descriptor.targetDescriptorSha256,
        operatorDescriptorFileSha256: descriptor.fileSha256,
        operatorDescriptorSha256: descriptor.descriptorSha256,
        functionInventories,
      });
    assertOwnerPrivateDirectory(input.receiptDirectory, "receipt directory");
    assertDisjointPrivateDirectories([
      input.receiptDirectory,
      input.supabaseHome,
      input.outputDirectory,
      input.runtimeRecoveryReceiptDirectory,
      path.join(
        path.dirname(input.runtimeRecoveryReceiptDirectory),
        "main-runtime-recovery-state",
      ),
    ]);
    let reconcileInput = null;
    if (input.action === "reconcile") {
      const originalRequest = readRequest(input.originalRequestFile, input);
      const unknownReceipt = validateOriginalUnknownReceipt(
        input.unknownReceiptFile,
        originalRequest,
        descriptor,
        input,
      );
      const originalPreparePlan = readOriginalPreparePlanForUnknown(
        input,
        unknownReceipt,
        originalRequest,
      );
      const originalIntent = validateOriginalRequestIntent(
        input,
        unknownReceipt,
        originalRequest,
        originalPreparePlan,
        descriptor,
      );
      assertUnknownReconcileEvidence({
        action: originalRequest.action,
        latest_plan_receipt_sha256: originalPreparePlan.plan_receipt_sha256,
        plan: {
          receipt_sha256: originalPreparePlan.plan_receipt_sha256,
          file_sha256: unknownReceipt.value.prepare_plan_file_sha256,
          prepared_at_ms: Date.parse(originalPreparePlan.prepared_at),
          expires_at_ms: Date.parse(originalPreparePlan.expires_at),
        },
        request: {
          body_sha256: originalRequest.bodySha256,
          file_sha256: originalRequest.fileSha256,
        },
        descriptor: {
          file_sha256: descriptor.fileSha256,
          production_boundary_sha256: descriptor.productionBoundarySha256,
          target_descriptor_sha256: descriptor.targetDescriptorSha256,
        },
        approval_token_sha256: sha256(expectedApprovalToken(originalPreparePlan) ?? ""),
        receipt: {
          action: unknownReceipt.value.action,
          status: unknownReceipt.value.status,
          recorded_at_ms: Date.parse(unknownReceipt.value.recorded_at),
          request_body_sha256: unknownReceipt.value.request_body_sha256,
          request_file_sha256: unknownReceipt.value.request_file_sha256,
          descriptor_file_sha256: unknownReceipt.value.descriptor_file_sha256,
          production_boundary_sha256: unknownReceipt.value.production_boundary_sha256,
          target_descriptor_sha256: unknownReceipt.value.target_descriptor_sha256,
          approval_token_sha256: unknownReceipt.value.approval_token_sha256,
          plan_receipt_sha256: unknownReceipt.value.prepare_plan_receipt_sha256,
          plan_file_sha256: unknownReceipt.value.prepare_plan_file_sha256,
          intent_sha256: unknownReceipt.value.request_intent_sha256,
          intent_file_sha256: unknownReceipt.value.request_intent_file_sha256,
          reconcile_required: unknownReceipt.value.reconcile_required,
          automatic_retry_performed: unknownReceipt.value.automatic_retry_performed,
          hosted_request_count: unknownReceipt.value.hosted_request_count,
          production_touched: unknownReceipt.value.production_touched,
        },
        intent: {
          action: originalIntent.value.action,
          recorded_at_ms: Date.parse(originalIntent.value.recorded_at),
          request_body_sha256: originalIntent.value.request_body_sha256,
          request_file_sha256: originalIntent.value.request_file_sha256,
          descriptor_file_sha256: originalIntent.value.descriptor_file_sha256,
          production_boundary_sha256: originalIntent.value.production_boundary_sha256,
          target_descriptor_sha256: originalIntent.value.target_descriptor_sha256,
          approval_token_sha256: originalIntent.value.approval_token_sha256,
          plan_receipt_sha256: originalIntent.value.prepare_plan_receipt_sha256,
          plan_file_sha256: originalIntent.value.prepare_plan_file_sha256,
          intent_sha256: originalIntent.value.intent_sha256,
          file_sha256: originalIntent.fileSha256,
          automatic_retry_forbidden: originalIntent.value.automatic_retry_forbidden,
          hosted_request_count: originalIntent.value.hosted_request_count,
          production_touched: originalIntent.value.production_touched,
        },
      });
      const derived = deriveReconcileContext(originalRequest);
      if (
        originalRequest.value.snapshot.main_source_commit_sha !== input.sourceCommitSha ||
        originalRequest.value.snapshot.main_source_tree_sha !== input.sourceTreeSha
      ) fail("reconcile source commit/tree differs from the original request");
      reconcileInput = Object.freeze({
        originalRequest,
        unknownReceipt,
        originalPreparePlan,
        derived,
      });
    } else if (
      !UUID_V4.test(input.mainUserId) || !UUID_V4.test(input.eventId) ||
      (["grant", "revoke"].includes(input.action) && !ACTOR.test(input.changedBy))
    ) {
      fail("prepare identity/event/actor contract differs");
    }
    createOwnerPrivateDirectory(input.supabaseHome, "Supabase CLI home");
    createOwnerPrivateDirectory(input.outputDirectory, "request output directory");
    const accessToken = readAccessToken(input.accessTokenFile);
    const cliEnvironment = scrubCliEnvironment(undefined, accessToken, input.supabaseHome);
    validatePinnedSupabaseCli(input.supabaseCli, runCli, cliEnvironment);
    const cliDependencies = {
      executable: input.supabaseCli,
      environment: cliEnvironment,
      supabaseHome: input.supabaseHome,
      runCli,
      assertSupabaseCliBytes: assertPinnedSupabaseCliBytes,
    };
    const f0 = fetchFunctionInventory(cliDependencies);
    const runtimeBinding0 = bindRuntimeAuthority(runtimeAuthority0, [f0]);
    const s0 = fetchSecretInventories(cliDependencies);

    if (input.action === "reconcile") {
      const { unknownReceipt, originalPreparePlan, derived } = reconcileInput;
      const d1 = await buildMainFinanceRuntimeRecoverySnapshot({
        ...snapshotArguments(
          input, contract, accessToken, s0, "reconcile", derived.context, nowImpl,
        ),
        fetchImpl,
      });
      if (
        Date.parse(d1.database_clock) <= Date.parse(derived.originalPlan.post_database_clock) ||
        d1.response_sha256 === derived.originalPlan.post_response_sha256 ||
        d1.catalog_sha256 !== derived.originalPlan.catalog_sha256 ||
        d1.gate_inventory_sha256 !== derived.originalPlan.gate_inventory_sha256 ||
        d1.privacy_secret_inventory_sha256 !==
          derived.originalPlan.privacy_secret_inventory_sha256 ||
        d1.source_manifest_sha256 !== derived.originalPlan.source_manifest_sha256 ||
        runtimeBinding0.completionReceiptSha256 !==
          originalPreparePlan.runtime_release_completion_receipt_sha256 ||
        runtimeBinding0.functionInventorySha256 !==
          originalPreparePlan.runtime_release_function_inventory_sha256 ||
        f0.sha256 !== originalPreparePlan.f0_sha256 ||
        f0.sha256 !== originalPreparePlan.f1_sha256 ||
        s0.mainSha256 !== originalPreparePlan.s0_main_sha256 ||
        s0.mainSha256 !== originalPreparePlan.s1_main_sha256 ||
        s0.financeSha256 !== originalPreparePlan.s0_finance_sha256 ||
        s0.financeSha256 !== originalPreparePlan.s1_finance_sha256
      ) fail("reconcile evidence differs from the unknown request's prepare plan");
      const s1 = fetchSecretInventories(cliDependencies);
      const f1 = fetchFunctionInventory(cliDependencies);
      const runtimeAuthority1 = readCurrentRuntimeRecoveryReleaseAuthority(input);
      const runtimeBinding1 = bindRuntimeAuthority(runtimeAuthority1, [f0, f1]);
      if (
        canonicalJson(runtimeAuthority1) !== canonicalJson(runtimeAuthority0) ||
        runtimeBinding1.completionReceiptSha256 !==
          runtimeBinding0.completionReceiptSha256 ||
        !sameCanonical(f0.rows, f1.rows) || f0.sha256 !== f1.sha256 ||
        !sameCanonical(s0.main, s1.main) || !sameCanonical(s0.finance, s1.finance)
      ) fail("reconcile F0/S0/D1/S1/F1 readiness evidence drifted");
      const disposition = classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
        snapshot: d1,
        reconcileContext: derived.context,
      });
      const reconcileDecision = evaluateReconcileDisposition(disposition);
      const preparedAt = exactNowMilliseconds(nowImpl);
      if (!reconcileDecision.executionAuthority) {
        const outcome = reconcileDecision.outcome;
        const observation = writeReconcileObservation(
          input.receiptDirectory,
          originalPreparePlan,
          {
            schema_version: 2,
            kind: "main-finance-access-v2-reconcile-observation",
            environment: "staging",
            production_denied: true,
            action: "reconcile",
            outcome,
            disposition,
            recorded_at: new Date(preparedAt).toISOString(),
            source_deployment_sha256: input.sourceDeploymentSha256,
            original_request_body_sha256: reconcileInput.originalRequest.bodySha256,
            unknown_receipt_file_sha256: unknownReceipt.fileSha256,
            original_plan_receipt_sha256: originalPreparePlan.plan_receipt_sha256,
            d1_database_clock: d1.database_clock,
            d1_response_sha256: d1.response_sha256,
            d1_descriptor_sha256: d1.descriptor_sha256,
            d1_state_sha256: d1.state_sha256,
            f0_sha256: f0.sha256,
            f1_sha256: f1.sha256,
            s0_main_sha256: s0.mainSha256,
            s0_finance_sha256: s0.financeSha256,
            s1_main_sha256: s1.mainSha256,
            s1_finance_sha256: s1.financeSha256,
            production_touched: false,
          },
          preparedAt,
        );
        return Object.freeze({
          ok: false,
          mode: "prepare",
          action: "reconcile",
          outcome,
          disposition,
          ownerApprovalToken: null,
          requestFile: null,
          planReceiptFile: null,
          observationFile: observation.file,
          observationSha256: observation.sha256,
          productionTouched: false,
        });
      }
      const built = buildReconcileRequest(input, d1, derived.originalPlan, preparedAt);
      const requestSource = `${canonicalJson(built.request)}\n`;
      const requestBodySha256 = sha256(canonicalJson(built.request));
      const requestFile = path.join(
        input.outputDirectory,
        `main-finance-access-v2-${requestBodySha256}-request.json`,
      );
      const requestFileSha256 = sha256(requestSource);
      const planCore = preparePlanCore({
        input, descriptor, request: built.request, requestFileSha256, now: preparedAt,
        expiresAt: built.expiresAt, actionAuthoritySha256: built.actionAuthoritySha256,
        expectedVersion: built.expectedVersion, mainUserId: built.mainUserId,
        eventId: built.eventId, changedBy: derived.originalPlan.changed_by,
        evidence: {
          d0DescriptorSha256: null, d1DescriptorSha256: d1.descriptor_sha256,
          proofSha256: null, f0Sha256: f0.sha256, f1Sha256: f1.sha256,
          s0MainSha256: s0.mainSha256, s0FinanceSha256: s0.financeSha256,
          s1MainSha256: s1.mainSha256, s1FinanceSha256: s1.financeSha256,
          runtimeReleaseCompletionReceiptSha256:
            runtimeBinding1.completionReceiptSha256,
          runtimeReleaseFunctionInventorySha256:
            runtimeBinding1.functionInventorySha256,
        },
      });
      writeCanonicalPrivateFile(requestFile, built.request, "Edge request");
      const plan = await withReceiptDirectoryLease(
        input.receiptDirectory,
        async (lease) => publishPreparePlanUnderLease(
          input.receiptDirectory,
          planCore,
          preparedAt,
          lease,
          originalPreparePlan.plan_receipt_sha256,
        ),
      );
      return Object.freeze({
        ok: true, mode: "prepare", action: "reconcile", outcome: "ready",
        requestFile, requestBodySha256, planReceiptFile: plan.file,
        planReceiptSha256: plan.plan.plan_receipt_sha256,
        ownerApprovalToken: expectedApprovalToken(plan.plan), productionTouched: false,
      });
    }

    const d0 = await buildMainFinanceRuntimeRecoverySnapshot({
      ...snapshotArguments(input, contract, accessToken, s0, "access", null, nowImpl),
      fetchImpl,
    });
    const attested = await authenticatedAttest({
      d0, descriptor, input, fetchImpl, nowImpl,
    });
    const s1 = fetchSecretInventories(cliDependencies);
    const d1 = await buildMainFinanceRuntimeRecoverySnapshot({
      ...snapshotArguments(input, contract, accessToken, s1, "access", null, nowImpl),
      fetchImpl,
    });
    const f1 = fetchFunctionInventory(cliDependencies);
    const runtimeAuthority1 = readCurrentRuntimeRecoveryReleaseAuthority(input);
    const runtimeBinding1 = bindRuntimeAuthority(runtimeAuthority1, [f0, f1]);
    if (
      canonicalJson(runtimeAuthority1) !== canonicalJson(runtimeAuthority0) ||
      runtimeBinding1.completionReceiptSha256 !== runtimeBinding0.completionReceiptSha256
    ) fail("runtime recovery release authority changed during prepare");
    validateReadinessSandwich({ f0, f1, s0, s1, d0, d1, proof: attested.proof });
    const preparedAt = exactNowMilliseconds(nowImpl);
    let built;
    if (input.action === "status") {
      const command = Object.freeze({ main_user_id: input.mainUserId, event_id: input.eventId });
      built = Object.freeze({
        request: buildOuterRequest("status", input.sourceDeploymentSha256, snapshotBody(d1), command),
        actionAuthoritySha256: sha256(canonicalJson(command)), expectedVersion: "0",
        expiresAt: new Date(preparedAt + PREPARE_PLAN_TTL_MS).toISOString(),
      });
    } else {
      built = buildMutationRequest(
        input, d0, attested.proof, attested.rawProof, d1, preparedAt,
      );
    }
    const requestBody = canonicalJson(built.request);
    const requestBodySha256 = sha256(requestBody);
    const requestFileSha256 = sha256(`${requestBody}\n`);
    const requestFile = path.join(
      input.outputDirectory,
      `main-finance-access-v2-${requestBodySha256}-request.json`,
    );
    const planCore = preparePlanCore({
      input, descriptor, request: built.request, requestFileSha256, now: preparedAt,
      expiresAt: built.expiresAt, actionAuthoritySha256: built.actionAuthoritySha256,
      expectedVersion: built.expectedVersion, mainUserId: input.mainUserId,
      eventId: input.eventId, changedBy: input.changedBy,
      evidence: {
        d0DescriptorSha256: d0.descriptor_sha256, d1DescriptorSha256: d1.descriptor_sha256,
        proofSha256: attested.proof.proofSha256, f0Sha256: f0.sha256, f1Sha256: f1.sha256,
        s0MainSha256: s0.mainSha256, s0FinanceSha256: s0.financeSha256,
        s1MainSha256: s1.mainSha256, s1FinanceSha256: s1.financeSha256,
        runtimeReleaseCompletionReceiptSha256:
          runtimeBinding1.completionReceiptSha256,
        runtimeReleaseFunctionInventorySha256:
          runtimeBinding1.functionInventorySha256,
      },
    });
    writeCanonicalPrivateFile(requestFile, built.request, "Edge request");
    const plan = await withReceiptDirectoryLease(
      input.receiptDirectory,
      async (lease) => publishPreparePlanUnderLease(
        input.receiptDirectory,
        planCore,
        preparedAt,
        lease,
      ),
    );
    return Object.freeze({
      ok: true, mode: "prepare", action: input.action, outcome: "ready",
      requestFile, requestBodySha256, planReceiptFile: plan.file,
      planReceiptSha256: plan.plan.plan_receipt_sha256,
      ownerApprovalToken: expectedApprovalToken(plan.plan), productionTouched: false,
    });
  }

  const executeContract = readMainFinanceRuntimeRecoveryV2SnapshotContract();
  if (executeContract.sourceDeploymentSha256 !== input.sourceDeploymentSha256) {
    fail("frozen snapshot contract source deployment differs");
  }
  assertOwnerPrivateDirectory(input.receiptDirectory, "receipt directory");
  assertDisjointPrivateDirectories([
    input.receiptDirectory,
    input.supabaseHome,
    input.runtimeRecoveryReceiptDirectory,
    path.join(
      path.dirname(input.runtimeRecoveryReceiptDirectory),
      "main-runtime-recovery-state",
    ),
  ]);

  return await withReceiptDirectoryLease(input.receiptDirectory, async (lease) => {
  const planReceipt = readPreparePlan(input.planReceiptFile);
  assertPreparePlanReceiptDirectoryBinding(planReceipt.plan, input.receiptDirectory);
  assertLatestPreparePlan(input.planReceiptFile, input.receiptDirectory);
  let now = exactNowMilliseconds(nowImpl);
  const authorizationAt = now;
  const plan = planReceipt.plan;
  if (
    Date.parse(plan.expires_at) <= now || Date.parse(plan.prepared_at) > now ||
    plan.source_deployment_sha256 !== input.sourceDeploymentSha256 ||
    plan.production_boundary_sha256 !== descriptor.productionBoundarySha256 ||
    plan.target_descriptor_sha256 !== descriptor.targetDescriptorSha256
  ) fail("latest prepare plan is expired or boundary-mismatched");
  const request = readRequest(input.requestFile, input);
  if (input.statusOut && request.action !== "status") {
    fail("status output is valid only for an exact status request");
  }
  if (input.statusOut) {
    const runtimeStateDirectory = path.join(
      path.dirname(input.runtimeRecoveryReceiptDirectory),
      "main-runtime-recovery-state",
    );
    if (
      pathsOverlap(input.runtimeRecoveryReceiptDirectory, input.statusOut) ||
      pathsOverlap(runtimeStateDirectory, input.statusOut)
    ) fail("status output must not alter raw runtime recovery authority");
    assertStatusOutputPath(input.statusOut);
  }
  const binding = requestPlanBinding(request);
  const mutatingOrReplayAction = ["grant", "revoke", "reconcile"].includes(request.action);
  assertRequestPlanBinding(plan, binding);
  const approvalTokenSha256 = assertOwnerApprovalToken(plan, input.ownerApprovalToken);

  createOwnerPrivateDirectory(input.supabaseHome, "Supabase CLI home");
  const executeAccessToken = readAccessToken(input.accessTokenFile);
  const executeCliEnvironment = scrubCliEnvironment(
    undefined,
    executeAccessToken,
    input.supabaseHome,
  );
  validatePinnedSupabaseCli(input.supabaseCli, runCli, executeCliEnvironment);
  const executeCliDependencies = {
    executable: input.supabaseCli,
    environment: executeCliEnvironment,
    supabaseHome: input.supabaseHome,
    runCli,
    assertSupabaseCliBytes: assertPinnedSupabaseCliBytes,
  };

  // A prepare-plan summary is never runtime authority. Re-read the exact raw,
  // canonical schema-4 chain around one fresh hosted function inventory and
  // bind the terminal completion back to this exact plan immediately before
  // the durable intent/hosted-request boundary.
  const runtimeAuthority0 = readCurrentRuntimeRecoveryReleaseAuthority(input);
  const executeFunctionInventory = fetchFunctionInventory(executeCliDependencies);
  const runtimeAuthority1 = readCurrentRuntimeRecoveryReleaseAuthority(input);
  const bindExecuteAuthority = (authority) =>
    assertCurrentRuntimeRecoveryReleaseAuthority({
      authority,
      sourceCommitSha: plan.source_commit_sha,
      sourceTreeSha: plan.source_tree_sha,
      sourceDeploymentSha256: input.sourceDeploymentSha256,
      releaseManifestSha256: executeContract.releaseManifestSha256,
      productionBoundarySha256: descriptor.productionBoundarySha256,
      targetDescriptorSha256: descriptor.targetDescriptorSha256,
      operatorDescriptorFileSha256: descriptor.fileSha256,
      operatorDescriptorSha256: descriptor.descriptorSha256,
      functionInventories: [executeFunctionInventory],
    });
  const executeRuntimeBinding0 = bindExecuteAuthority(runtimeAuthority0);
  const executeRuntimeBinding1 = bindExecuteAuthority(runtimeAuthority1);
  if (
    canonicalJson(runtimeAuthority0) !== canonicalJson(runtimeAuthority1) ||
    canonicalJson(runtimeAuthorityAtEntry) !== canonicalJson(runtimeAuthority0) ||
    executeRuntimeBinding0.completionReceiptSha256 !==
      plan.runtime_release_completion_receipt_sha256 ||
    executeRuntimeBinding1.completionReceiptSha256 !==
      plan.runtime_release_completion_receipt_sha256 ||
    executeRuntimeBinding1.functionInventorySha256 !==
      plan.runtime_release_function_inventory_sha256
  ) fail("runtime recovery authority changed or differs from the prepare plan");

  // Recheck the live clock after every private artifact and authorization
  // comparison, immediately before the durable intent/no-retry boundary.
  now = exactNowMilliseconds(nowImpl);
  if (Date.parse(plan.expires_at) <= now || now < Date.parse(plan.prepared_at)) {
    fail("latest prepare plan expired or clock moved before intent reservation");
  }
  assertLatestPreparePlan(input.planReceiptFile, input.receiptDirectory);
  assertPreparePlanReceiptDirectoryBinding(plan, input.receiptDirectory);

  // Every exact request must have an unoccupied append-only receipt slot before
  // network access. Mutating/reconcile actions additionally reserve and fsync an
  // immutable intent. An orphan intent is UNKNOWN and permanently forbids retry.
  assertRequestArtifactsAvailable(input.receiptDirectory, request.bodySha256);
  const requestIntent = mutatingOrReplayAction
    ? reserveRequestIntent(input.receiptDirectory, {
      schema_version: 2,
      kind: "main-finance-access-v2-operator-request-intent",
      environment: "staging",
      production_denied: true,
      action: request.action,
      status: "reserved",
      recorded_at: new Date(now).toISOString(),
      source_deployment_sha256: input.sourceDeploymentSha256,
      request_body_sha256: request.bodySha256,
      request_file_sha256: request.fileSha256,
      descriptor_file_sha256: descriptor.fileSha256,
      production_boundary_sha256: descriptor.productionBoundarySha256,
      target_descriptor_sha256: descriptor.targetDescriptorSha256,
      approval_token_sha256: approvalTokenSha256,
      prepare_plan_receipt_sha256: plan.plan_receipt_sha256,
      prepare_plan_file_sha256: planReceipt.fileSha256,
      orphan_status: "unknown",
      orphan_reconcile_required: true,
      automatic_retry_forbidden: true,
      hosted_request_count: 0,
      production_touched: false,
    })
    : null;
  assertPreparePlanReceiptDirectoryBinding(plan, input.receiptDirectory);
  assertReceiptDirectoryLease(lease);
  const requestStartedAt = exactNowMilliseconds(nowImpl);
  if (
    requestStartedAt < now || requestStartedAt < Date.parse(plan.prepared_at) ||
    Date.parse(plan.expires_at) <= requestStartedAt
  ) fail("latest prepare plan expired or clock moved before hosted request");
  const latestBeforeRequest = assertLatestPreparePlan(
    input.planReceiptFile,
    input.receiptDirectory,
  );
  assertPreparePlanReceiptDirectoryBinding(plan, input.receiptDirectory);
  assertReceiptDirectoryLease(lease);
  assertExecutionTemporalAuthority({
    plan,
    latestPlanReceiptSha256: latestBeforeRequest.plan.plan_receipt_sha256,
    leaseHeld: true,
    authorizationAtMs: authorizationAt,
    intentBoundaryAtMs: now,
    requestStartedAtMs: requestStartedAt,
    intentReserved: requestIntent !== null,
  });
  const writeExecutionReceipt = (core) => {
    assertReceiptDirectoryLease(lease);
    assertPreparePlanReceiptDirectoryBinding(plan, input.receiptDirectory);
    const written = writeReceipt(input.receiptDirectory, core);
    assertPreparePlanReceiptDirectoryBinding(plan, input.receiptDirectory);
    assertReceiptDirectoryLease(lease);
    return written;
  };
  const receiptRecordedAt = () => {
    const completedAt = exactNowMilliseconds(nowImpl);
    if (completedAt < requestStartedAt) fail("operator clock moved before receipt completion");
    return new Date(completedAt).toISOString();
  };

  const timestamp = String(requestStartedAt);
  const bodySha256 = sha256(request.body);
  const signature = createHmac("sha256", descriptor.operatorSecret).update([
    "main-finance-access-v2-request",
    "POST",
    EDGE_PATH,
    timestamp,
    bodySha256,
  ].join("\n"), "utf8").digest("hex");
  let response;
  try {
    response = await fetchImpl(EDGE_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "x-architecture-finance-operator-v2": signature,
        "x-architecture-finance-timestamp-v2": timestamp,
      },
      body: request.body,
    });
  } catch {
    const written = writeExecutionReceipt({
      schema_version: 2,
      kind: "main-finance-access-v2-operator-receipt",
      environment: "staging",
      production_denied: true,
      action: request.action,
      status: "unknown",
      recorded_at: receiptRecordedAt(),
      source_deployment_sha256: input.sourceDeploymentSha256,
      request_body_sha256: request.bodySha256,
      request_file_sha256: request.fileSha256,
      descriptor_file_sha256: descriptor.fileSha256,
      production_boundary_sha256: descriptor.productionBoundarySha256,
      target_descriptor_sha256: descriptor.targetDescriptorSha256,
      approval_token_sha256: approvalTokenSha256,
      prepare_plan_receipt_sha256: plan.plan_receipt_sha256,
      prepare_plan_file_sha256: planReceipt.fileSha256,
      request_intent_sha256: requestIntent?.intentSha256 ?? null,
      request_intent_file_sha256: requestIntent?.fileSha256 ?? null,
      status_artifact_sha256: null,
      response_status: null,
      response_sha256: null,
      reconcile_required: true,
      manual_recovery_required: false,
      automatic_retry_performed: false,
      hosted_request_count: 1,
      production_touched: false,
    });
    fail(`Edge outcome is unknown; reconcile from receipt ${written.receipt.receipt_sha256}`);
  }
  let parsed;
  let edgeContract;
  try {
    parsed = await readBoundedResponse(response);
    edgeContract = validateEdgeResponse(response, parsed, request, descriptor, input);
  } catch (error) {
    const written = writeExecutionReceipt({
      schema_version: 2,
      kind: "main-finance-access-v2-operator-receipt",
      environment: "staging",
      production_denied: true,
      action: request.action,
      status: "unknown",
      recorded_at: receiptRecordedAt(),
      source_deployment_sha256: input.sourceDeploymentSha256,
      request_body_sha256: request.bodySha256,
      request_file_sha256: request.fileSha256,
      descriptor_file_sha256: descriptor.fileSha256,
      production_boundary_sha256: descriptor.productionBoundarySha256,
      target_descriptor_sha256: descriptor.targetDescriptorSha256,
      approval_token_sha256: approvalTokenSha256,
      prepare_plan_receipt_sha256: plan.plan_receipt_sha256,
      prepare_plan_file_sha256: planReceipt.fileSha256,
      request_intent_sha256: requestIntent?.intentSha256 ?? null,
      request_intent_file_sha256: requestIntent?.fileSha256 ?? null,
      status_artifact_sha256: null,
      response_status: response.status,
      response_sha256: parsed?.sha256 ?? null,
      reconcile_required: true,
      manual_recovery_required: false,
      automatic_retry_performed: false,
      hosted_request_count: 1,
      production_touched: false,
    });
    throw new Error(
      `Main Finance access v2 outcome is unknown; reconcile from receipt ${written.receipt.receipt_sha256}`,
      { cause: error },
    );
  }
  const reconcileRequired = edgeContract.reconcileRequired;
  const manualRecoveryRequired = edgeContract.manualRecoveryRequired === true;
  const statusArtifact = input.statusOut && response.ok
    ? writeStatusArtifact(input.statusOut, descriptor, parsed.value)
    : null;
  const written = writeExecutionReceipt({
    schema_version: 2,
    kind: "main-finance-access-v2-operator-receipt",
    environment: "staging",
    production_denied: true,
    action: request.action,
    status: response.ok
      ? "verified"
      : (manualRecoveryRequired ? "no_go" : (reconcileRequired ? "unknown" : "rejected")),
    recorded_at: receiptRecordedAt(),
    source_deployment_sha256: input.sourceDeploymentSha256,
    request_body_sha256: request.bodySha256,
    request_file_sha256: request.fileSha256,
    descriptor_file_sha256: descriptor.fileSha256,
    production_boundary_sha256: descriptor.productionBoundarySha256,
    target_descriptor_sha256: descriptor.targetDescriptorSha256,
    approval_token_sha256: approvalTokenSha256,
    prepare_plan_receipt_sha256: plan.plan_receipt_sha256,
    prepare_plan_file_sha256: planReceipt.fileSha256,
    request_intent_sha256: requestIntent?.intentSha256 ?? null,
    request_intent_file_sha256: requestIntent?.fileSha256 ?? null,
    status_artifact_sha256: statusArtifact?.sha256 ?? null,
    response_status: response.status,
    response_sha256: parsed.sha256,
    reconcile_required: reconcileRequired,
    manual_recovery_required: manualRecoveryRequired,
    automatic_retry_performed: false,
    hosted_request_count: 1,
    production_touched: false,
  });
  if (!response.ok || reconcileRequired || manualRecoveryRequired) {
    throw new Error(
      `Main Finance access v2 request was not verified; inspect receipt ${written.receipt.receipt_sha256}`,
    );
  }
  return Object.freeze({
    ok: response.ok,
    mode: "execute",
    action: request.action,
    status: written.receipt.status,
    responseStatus: response.status,
    reconcileRequired,
    manualRecoveryRequired,
    receiptFile: written.file,
    receiptSha256: written.receipt.receipt_sha256,
    requestIntentFile: requestIntent?.file ?? null,
    requestIntentSha256: requestIntent?.intentSha256 ?? null,
    requestIntentFileSha256: requestIntent?.fileSha256 ?? null,
    statusArtifactFile: statusArtifact?.file ?? null,
    statusArtifactSha256: statusArtifact?.sha256 ?? null,
  });
  });
}

async function main() {
  const result = await manageFinanceAccessV2();
  process.stdout.write(`${canonicalJson(result)}\n`);
}

if (import.meta.main === true) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Main Finance access v2 operator failed"}\n`);
    process.exitCode = 1;
  });
}
