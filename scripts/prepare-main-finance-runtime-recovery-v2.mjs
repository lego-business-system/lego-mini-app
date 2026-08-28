#!/usr/bin/env node

import { createHash, createHmac, randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  copyFileSync,
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
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import {
  buildMainFinanceRuntimeRecoveryAttestRequest,
  buildMainFinanceRuntimeRecoverySnapshot as buildSnapshotFromFrozenModule,
  measureMainFinanceRuntimeRecoveryCatalog,
  validateMainFinanceRuntimeRecoverySnapshotSandwich,
  verifyMainFinanceRuntimeRecoveryAttestResponse,
} from "./main-finance-runtime-recovery-v2-snapshot.mjs";
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const RELEASE_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "supabase/releases/main-finance-runtime-recovery-v2",
);
const MANIFEST_FILE = path.join(RELEASE_DIRECTORY, "staging.manifest.json");
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_REF = "makgsbjduobcphuqzaoq";
const PRODUCTION_REFS = Object.freeze([
  "soxtekhspohkddpdidvp",
  "koibxwgtihwajocxfetb",
]);
const FUNCTION_NAME = "finance-manage-access-v2";
const FIRST_FUNCTION_DEPLOYMENT_VERSION = 1;
const FUNCTION_URL = `https://${MAIN_REF}.supabase.co/functions/v1/${FUNCTION_NAME}`;
const RECEIPT_PATTERN = /^([0-9]{6})\.json$/u;
const RECEIPT_PENDING_PATTERN = /^([0-9]{6})\.json\.pending$/u;
const RECEIPT_INVALID_PENDING_PATTERN =
  /^([0-9]{6})\.json\.pending\.invalid\.([0-9]{6})$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OID = /^[0-9a-f]{40}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,255}$/u;
const ACCESS_TOKEN = /^[A-Za-z0-9._-]{20,4096}$/u;
const GENERATED_SECRET = /^[A-Za-z0-9_-]{64}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$/u;
const OPERATOR_HEADER = "x-architecture-finance-operator-v2";
const OPERATOR_TIMESTAMP_HEADER = "x-architecture-finance-timestamp-v2";
const BUNDLE_ATTESTATION_FILE = "bundle.attestation.json";
const BUNDLE_COMMIT_FILE = "bundle.commit.json";
const RUNTIME_ENV_FILE = "runtime-install.env";
const DEPLOY_WORKDIR = "deploy-workdir";
const SOURCE_ARCHIVE = "source-archive-v2.bin";
const RECEIPT_BINDING_FILE = "receipt-binding.json";
const SEALED_SUPABASE_CLI_DIRECTORY = "sealed-supabase-cli";
const SEALED_SUPABASE_CLI_FILE = "supabase";
const SEALED_LOCAL_STATE_MODE = 0o500;
const SUPABASE_HOME_DIRECTORY = "supabase-home";
const GH_XDG_STATE_DIRECTORY = "gh-xdg-state";
const GH_XDG_CACHE_DIRECTORY = "gh-xdg-cache";
const GH_XDG_DATA_DIRECTORY = "gh-xdg-data";
const ACCESS_V2_DESCRIPTOR_FILE = "main-finance-access-v2-owner-descriptor.json";
const PREINSTALL_INVENTORY_FILE = "preinstall-secret-inventory.json";
const SECRET_MUTATION_ENV_FILE = "runtime-install.env";
const RUNTIME_PROOF_FILE = "runtime-proof.env";
const PROVENANCE_KIND = "main-finance-runtime-recovery-v2-release-provenance";
const READY_STATUS = "READY_FOR_SOURCE_ATTESTATION";
const NOT_READY_STATUS = "NOT_DEPLOY_READY_FROZEN_EVIDENCE_REQUIRED";
const BASE_COMMIT_SHA = "a30dedf20e977d9794a8ac9e54abc48b076c9d45";
const BASE_TREE_SHA = "92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf";
const PREDECESSOR_ADOPTION_PINS = Object.freeze({
  sourceCommitSha: "b87fe6a9212bdb6e43d8304be36c39074379a153",
  sourceTreeSha: "af4bb9b7fec37dd600c086184f101e2c3a094f7e",
  planReceiptSha256: "77a406d917a7232bb79ce7366a6166ae0170234f47ee6390dc48c79fb1a7c030",
  intentReceiptSha256: "f06ad6bb9ace2b88561b615f81771f9ee31b525eee25f6dbd7e13b42ab4305ce",
  unknownReceiptSha256: "10df1795cb53933c45cf856e7cb932d3a4a1d51fa03d476b313228411548d33c",
  terminalReceiptSha256: "5978750d44354891f11daaaded5d17493a891732a05287b8e4b0398b8db0f932",
  bundleAttestationSha256: "e336b417038d1cdd1398eff69473f5aabe6873a6f17dd92563ab5eac822077dc",
  expectedSecretDigestSetSha256: "d8f9f9d9c4cbde2bb4e92dc2c8e9c327755c3146ca05c2f4170e2880c45fa8f2",
  generatedSecretDigestSetSha256: "b3014c4eb96cf14c75017f10d3e071285c671f9d1387dcbf48310ca63dd5d211",
  preinstallFunctionInventorySha256: "769a1fe02c74644f0c185cc2aa660293b1f1b795910e9089824932023d625942",
  observedFunctionInventorySha256: "e1edfa70f070fc3cf7b207891c33518107ab516378673dcc3cb07e63e5a09faf",
  observedFunctionCount: 12,
  preinstallMainInventorySha256: "3082bc57309750154344dc225d4b286840c0af7be08acebe5b217378927a7fd0",
  installedMainInventorySha256: "66a2630aa9c4c17d9e1a894a9a43f201e40913dab20d0f08c161c48ebb0a7c60",
  financeInventorySha256: "89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e",
  runtimeFileSha256: "8920f620995e6749ae56d5d1d8a9b7461eee8c208adcad22ef56db67d0f1a908",
  provenanceFileSha256: "c8f0647c91691c068330aa8b41482ba8ecd08164504dd2172d154334621c88a7",
  provenanceDescriptorSha256: "5c6d31aef675f80187209e398eb18b8691a73315c595f5c498760de6b733719f",
});
const TERMINAL_DIVERGED_PREDECESSOR_PINS = Object.freeze({
  sourceCommitSha: "a30dedf20e977d9794a8ac9e54abc48b076c9d45",
  sourceTreeSha: "92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf",
  planReceiptSha256: "62407763c353d6963561c39dc2d04b572632e400b5cc758958d8b81eaad9b701",
  secretIntentReceiptSha256: "838a88db296495c60bfaea378f8c71fb86468cf8b6aefe099ed6e05071d51c79",
  secretResultReceiptSha256: "522ced178f2839948f30316d2ae73d9e257385ec1699d0b842218fa49451c677",
  functionIntentReceiptSha256: "ddf741ca072b0bbe45bfa5a0098522facdf8e6b10ec407248195ac7b2faf899b",
  functionUnknownReceiptSha256: "5dbfe3ad4cd84533888c3b73a77ada3864395fadc4ecd58d361bed7d5d8ea64c",
  terminalReceiptSha256: "098731b6054f305cb4d211f5658122696400486947dfe31091e5abc937fada0e",
  receiptChainSha256: "f4196cffb0ad9b6c8dc0d619085e2bf1f44790efb479bc429ed91d1e74e15834",
  bundleAttestationSha256: "5f5af08774ad620dc5556fa2083371617db8042fa49055dfebf0844fbe2baddf",
  runtimeFileSha256: "932d3fde5f7b98fce9606aebea1b335d41f85cec72afc47a873bf12f1c6e2217",
  provenanceFileSha256: "34089b8041c72f3abcff3f954067ba7c093f66ba1045a51113ec4d81ccff8063",
  provenanceDescriptorSha256: "7ceb2face8c325056b47fb595b801ee4860d27cc0d84816436c55380042972bf",
  expectedSecretDigestSetSha256: "d7347afdada1acce8e0d44951be7d83fd0da7d984fcb56ae565f0e4deb2a331e",
  generatedSecretDigestSetSha256:
    PREDECESSOR_ADOPTION_PINS.generatedSecretDigestSetSha256,
  preinstallMainInventorySha256: "66a2630aa9c4c17d9e1a894a9a43f201e40913dab20d0f08c161c48ebb0a7c60",
  postSecretMainInventorySha256: "133ab45e43e8b5e0a5fa70be4ed4f978d40b27d955140becb9bc54a32d960ce2",
  terminalMainInventorySha256: "b98949ec772990f98b26471ed4e6ff4356d289709b51fd707419ffdbb1570139",
  financeInventorySha256: PREDECESSOR_ADOPTION_PINS.financeInventorySha256,
  preinstallFunctionInventorySha256:
    PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256,
  postSecretFunctionInventorySha256: "73c0f50b78516b1fc46dc7f155bf0f737b6967a2913561a6ddb4693d20fdf80b",
  terminalFunctionInventorySha256: "ad7075e78470642d731f628e722efb2f498c31760148b362a6e51ce7225b17e1",
  preinstallFunctionCount: 12,
  terminalFunctionCount: 13,
});
const SUCCESSOR_METADATA_ONLY_SECRET_NAMES = Object.freeze([
  "SUPABASE_ANON_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_JWKS",
  "SUPABASE_PUBLISHABLE_KEYS",
  "SUPABASE_SECRET_KEYS",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
]);
const SUCCESSOR_SECRET_MUTATION_NAMES = Object.freeze([
  "MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256",
]);
const EXPECTED_TRACKED_FILE_COUNT = 935;
const EXPECTED_CHANGED_PATHS = Object.freeze([
  ["M", ".github/workflows/verify-finance-integration.yml"],
  ["M", "scripts/prepare-main-finance-runtime-recovery-v2.mjs"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/environment.contract.json"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/postflight.contract.json"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/README.md"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json"],
  ["M", "supabase/tests/finance_integration_ci.test.mjs"],
  ["M", "supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs"],
].map(([status, changedPath]) => Object.freeze({ status, path: changedPath })));
const MEASUREMENT_GIT_STATUS = Object.freeze({
  "??": "A",
  "A ": "A",
  " M": "M",
  "M ": "M"
});
const GITHUB_REPOSITORY = "lego-business-system/lego-mini-app";
const GH_CONFIG_DIRECTORY = "/Users/Maks/.config/gh";
const GH_HOSTS_FILE = "/Users/Maks/.config/gh/hosts.yml";
const GH_CONFIG_FILE = "/Users/Maks/.config/gh/config.yml";
const FROZEN_TOOL_PINS = Object.freeze({
  git: Object.freeze({
    realPath: "/usr/bin/git",
    sha256: "179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818",
    version: "git version 2.50.1 (Apple Git-155)",
  }),
  node: Object.freeze({
    realPath: "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
    sha256: "90e41658177a192c8c23940e58d8252544e5b40cbaef7bd52a3c3c54caf9dd91",
    version: "v24.14.0",
  }),
  supabaseCli: Object.freeze({
    realPath: "/Users/Maks/Library/pnpm/store/v11/links/@supabase/cli-darwin-arm64/2.109.1/e5fdd9fb276a62ab37eb6abe0330d50b2a81bb692d391bd8bc054b330e5d8133/node_modules/@supabase/cli-darwin-arm64/bin/supabase",
    sha256: "b7be23f4e211b75c00a3df5fcd1f96f3905983c74ff3189bfc69ad5b0f7132c4",
    version: "2.109.1",
  }),
  supabaseArchive: Object.freeze({
    realPath: "/private/tmp/supabase_darwin_arm64-v2.109.1.tar.gz",
    sha256: "e36776717a56d704769229649349b3a382f413cb31f1fb2ba4647ef8bcf7339b",
  }),
  gh: Object.freeze({
    realPath: "/Users/Maks/Library/Caches/finance-release-tools-v1/gh_2.97.0_macOS_arm64/bin/gh",
    sha256: "0d17dddf96bcc1dc50f3420a064d593d64016b0be16286a6c26121f2a5cb8316",
    version: "gh version 2.97.0 (2026-07-31)",
  }),
});
const CLI_ENVIRONMENT_ALLOWLIST = Object.freeze(new Set([
  "PATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
]));

const GATES = Object.freeze([
  Object.freeze({
    projectRef: FINANCE_REF,
    name: "FINANCE_ENTITLEMENT_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: FINANCE_REF,
    name: "FINANCE_ENTITLEMENT_V2_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: FINANCE_REF,
    name: "FINANCE_TELEGRAM_PROTOCOL_MODE",
  }),
  Object.freeze({ projectRef: MAIN_REF, name: "MAIN_FINANCE_SYNC_MODE" }),
  Object.freeze({ projectRef: MAIN_REF, name: "MAIN_FINANCE_PROTOCOL_MODE" }),
]);

function refuse(message) {
  throw new Error(`Main Finance runtime recovery v2 refused: ${message}`);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function exactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) refuse(`${label} keys differ`);
}

function sortedChangedPaths(value) {
  if (!Array.isArray(value)) return value;
  return value.map(item => ({ status: item.status, path: item.path }))
    .sort((left, right) =>
      left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19);
}

function assertCompiledBoundary(projectRef) {
  if (PRODUCTION_REFS.includes(projectRef)) {
    refuse("target is an exact production project ref");
  }
  if (projectRef !== MAIN_REF) {
    refuse("target is not the exact reviewed Main staging project ref");
  }
  if (
    MAIN_REF !== "bljeoovhydhjhdzwplxh"
    || FINANCE_REF !== "makgsbjduobcphuqzaoq"
    || canonicalJson(PRODUCTION_REFS)
      !== canonicalJson(["soxtekhspohkddpdidvp", "koibxwgtihwajocxfetb"])
    || [MAIN_REF, FINANCE_REF].some(value => PRODUCTION_REFS.includes(value))
  ) refuse("compiled staging and production boundary differs");
}

function parseArguments(argv) {
  if (argv.includes("--help")) return Object.freeze({ action: "help" });
  const [action, ...rest] = argv;
  if (!["measure", "plan", "apply", "reconcile", "verify"].includes(action)) {
    refuse("first argument must be measure, plan, apply, reconcile or verify");
  }
  const input = {
    action,
    projectRef: null,
    stateDir: null,
    receiptDir: null,
    accessTokenFile: null,
    supabaseCli: null,
    gitCli: null,
    ghCli: null,
    releaseProvenance: null,
    productionBoundary: null,
    targetConfig: null,
    approval: null,
    priorStateDir: null,
    priorReceiptDir: null,
    priorReleaseProvenance: null,
    priorTerminalReceiptSha256: null,
  };
  const map = Object.freeze({
    "--project-ref": "projectRef",
    "--state-dir": "stateDir",
    "--receipt-dir": "receiptDir",
    "--access-token-file": "accessTokenFile",
    "--supabase-cli": "supabaseCli",
    "--git-cli": "gitCli",
    "--gh-cli": "ghCli",
    "--release-provenance": "releaseProvenance",
    "--production-boundary": "productionBoundary",
    "--target-config": "targetConfig",
    "--approval": "approval",
    "--prior-state-dir": "priorStateDir",
    "--prior-receipt-dir": "priorReceiptDir",
    "--prior-release-provenance": "priorReleaseProvenance",
    "--prior-terminal-receipt-sha256": "priorTerminalReceiptSha256",
  });
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!Object.hasOwn(map, argument)) refuse(`unknown argument ${argument}`);
    if (seen.has(argument)) refuse(`duplicate ${argument}`);
    seen.add(argument);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) refuse(`${argument} requires a value`);
    input[map[argument]] = value;
    index += 1;
  }
  if (!input.projectRef) refuse("--project-ref is required");
  assertCompiledBoundary(input.projectRef);
  for (const key of [
    "stateDir",
    "receiptDir",
    "accessTokenFile",
    "supabaseCli",
    "gitCli",
  ]) {
    if (!input[key]) refuse(`--${key.replaceAll(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)} is required`);
  }
  if (action === "measure" && input.releaseProvenance) {
    refuse("--release-provenance is forbidden by measure");
  }
  if (action !== "measure" && !input.releaseProvenance) {
    refuse("--release-provenance is required");
  }
  if (action === "measure" && input.ghCli) {
    refuse("--gh-cli is forbidden by measure");
  }
  if (action !== "measure" && !input.ghCli) {
    refuse("--gh-cli is required");
  }
  if (action !== "measure" && (!input.productionBoundary || !input.targetConfig)) {
    refuse("--production-boundary and --target-config are required");
  }
  if (action === "apply" && !input.approval) refuse("apply requires --approval");
  if (action !== "apply" && input.approval) {
    refuse("--approval is accepted only by apply");
  }
  const priorValues = [
    input.priorStateDir,
    input.priorReceiptDir,
    input.priorReleaseProvenance,
    input.priorTerminalReceiptSha256,
  ];
  if (priorValues.some(value => value !== null)) {
    if (action !== "plan") refuse("predecessor adoption flags are accepted only by plan");
    if (priorValues.some(value => value === null)) {
      refuse("predecessor adoption flags are all-or-none");
    }
    if (!SHA256.test(input.priorTerminalReceiptSha256)) {
      refuse("--prior-terminal-receipt-sha256 differs");
    }
  }
  return Object.freeze(input);
}

function outsideRepository(item) {
  const relative = path.relative(REPOSITORY_ROOT, item);
  return relative !== ""
    && (relative === ".." || relative.startsWith(`..${path.sep}`));
}

function assertAbsolute(item, label) {
  if (
    typeof item !== "string"
    || !path.isAbsolute(item)
    || path.resolve(item) !== item
  ) refuse(`${label} path must be absolute and normalized`);
}

function assertPrivateFileMetadata(file, label) {
  assertAbsolute(file, label);
  let status;
  try {
    status = lstatSync(file);
  } catch {
    refuse(`${label} is unavailable`);
  }
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || realpathSync(file) !== file
    || !outsideRepository(file)
  ) refuse(`${label} must be one owner-private mode 0600 file outside the repository`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} owner differs`);
  }
  return file;
}

function assertCurrentRecoveryRoot(input) {
  if (["help", "measure"].includes(input.action)) return null;
  for (const [item, label] of [
    [input.stateDir, "current state directory"],
    [input.receiptDir, "current receipt directory"],
    [input.releaseProvenance, "current release provenance"],
    [input.productionBoundary, "current production boundary"],
    [input.targetConfig, "current target config"],
  ]) assertAbsolute(item, label);
  assertDisjointOperationDirectories(input.stateDir, input.receiptDir);
  const currentRoot = path.dirname(input.stateDir);
  if (
    path.dirname(input.receiptDir) !== currentRoot
    || path.dirname(input.releaseProvenance) !== currentRoot
    || path.dirname(input.productionBoundary) !== currentRoot
    || path.dirname(input.targetConfig) !== currentRoot
  ) {
    refuse("current state, receipts, provenance and owner boundaries must share one exact root");
  }
  assertPrivateDirectory(currentRoot, "current recovery root");
  assertPrivateDirectory(input.receiptDir, "current receipt directory");
  let stateExists = true;
  try {
    lstatSync(input.stateDir);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
    stateExists = false;
  }
  if (stateExists) {
    assertPrivateDirectory(input.stateDir, "current state directory");
  } else if (input.action !== "plan") {
    refuse("current state directory must exist before this operation lease");
  }
  assertPrivateFileMetadata(input.releaseProvenance, "current release provenance");
  assertPrivateFileMetadata(input.productionBoundary, "current production boundary");
  assertPrivateFileMetadata(input.targetConfig, "current target config");
  return currentRoot;
}

function assertPredecessorPlanPathBoundary(input) {
  if (input.action !== "plan" || input.priorStateDir === null) return;
  for (const [item, label] of [
    [input.stateDir, "new state directory"],
    [input.receiptDir, "new receipt directory"],
    [input.priorStateDir, "predecessor state directory"],
    [input.priorReceiptDir, "predecessor receipt directory"],
    [input.priorReleaseProvenance, "predecessor release provenance"],
    [input.releaseProvenance, "current release provenance"],
  ]) assertAbsolute(item, label);
  const predecessorRoot = path.dirname(input.priorStateDir);
  const currentRoot = assertCurrentRecoveryRoot(input);
  if (
    path.dirname(input.priorReceiptDir) !== predecessorRoot
    || path.dirname(input.priorReleaseProvenance) !== predecessorRoot
  ) refuse("predecessor state, receipts and provenance must share one exact root");
  assertPrivateDirectory(predecessorRoot, "predecessor root");
  const currentRelativeToPredecessor = path.relative(predecessorRoot, currentRoot);
  const predecessorRelativeToCurrent = path.relative(currentRoot, predecessorRoot);
  if (
    currentRelativeToPredecessor === ""
    || (currentRelativeToPredecessor !== ".."
      && !currentRelativeToPredecessor.startsWith(`..${path.sep}`))
    || (predecessorRelativeToCurrent !== ".."
      && !predecessorRelativeToCurrent.startsWith(`..${path.sep}`))
  ) refuse("current and predecessor recovery roots must be distinct and non-nested");
  for (const [item, label] of [
    [input.stateDir, "new state directory"],
    [input.receiptDir, "new receipt directory"],
  ]) {
    const relative = path.relative(predecessorRoot, item);
    if (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`))) {
      refuse(`${label} must remain outside the immutable predecessor root`);
    }
  }
  assertPairwiseDisjointDirectories([
    { directory: input.stateDir, label: "new state directory" },
    { directory: input.receiptDir, label: "new receipt directory" },
    { directory: input.priorStateDir, label: "predecessor state directory" },
    { directory: input.priorReceiptDir, label: "predecessor receipt directory" },
  ]);
}

function assertPrivateDirectory(directory, label) {
  assertAbsolute(directory, label);
  let status;
  try {
    status = lstatSync(directory);
  } catch {
    refuse(`${label} is unavailable`);
  }
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || status.nlink < 1
    || (status.mode & 0o777) !== 0o700
    || realpathSync(directory) !== directory
    || !outsideRepository(directory)
  ) refuse(`${label} must be one owner-private mode 0700 directory outside the repository`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} owner differs`);
  }
  return directory;
}

function assertSealedEmptyDirectory(directory, label) {
  assertAbsolute(directory, label);
  let status;
  try {
    status = lstatSync(directory);
  } catch {
    refuse(`${label} is unavailable`);
  }
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || status.nlink < 1
    || (status.mode & 0o777) !== SEALED_LOCAL_STATE_MODE
    || realpathSync(directory) !== directory
    || !outsideRepository(directory)
    || readdirSync(directory).length !== 0
  ) refuse(`${label} must remain one empty owner-private mode 0500 directory outside the repository`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} owner differs`);
  }
  return directory;
}

function createOrAssertSealedEmptyDirectory(stateDirectory, name, label) {
  assertPrivateDirectory(stateDirectory, "state directory");
  const directory = path.join(stateDirectory, name);
  if (!existsSync(directory)) {
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, SEALED_LOCAL_STATE_MODE);
    fsyncDirectory(directory);
    fsyncDirectory(stateDirectory);
  }
  return assertSealedEmptyDirectory(directory, label);
}

function createPrivateStateDirectory(directory) {
  assertAbsolute(directory, "state directory");
  if (!outsideRepository(directory) || existsSync(directory)) {
    refuse("new state directory must be absent and outside the repository");
  }
  const parent = path.dirname(directory);
  const status = lstatSync(parent);
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(parent) !== parent) {
    refuse("state directory parent is unsafe");
  }
  mkdirSync(directory, { mode: 0o700 });
  chmodSync(directory, 0o700);
  fsyncDirectory(directory);
  fsyncDirectory(parent);
  return assertPrivateDirectory(directory, "state directory");
}

function assertDisjointOperationDirectories(
  stateDirectory,
  receiptDirectory,
) {
  assertAbsolute(stateDirectory, "state directory");
  assertAbsolute(receiptDirectory, "receipt directory");
  const state = path.resolve(stateDirectory);
  const receipts = path.resolve(receiptDirectory);
  if (
    state === receipts
    || state.startsWith(`${receipts}${path.sep}`)
    || receipts.startsWith(`${state}${path.sep}`)
  ) refuse("state and receipt directories must be disjoint and non-nested");
}

function readPrivateFile(file, label, maximumBytes = 256 * 1024) {
  assertAbsolute(file, label);
  assertPrivateDirectory(path.dirname(file), `${label} parent directory`);
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || status.size < 1
    || status.size > maximumBytes
    || realpathSync(file) !== file
  ) refuse(`${label} must be one owner-private mode 0600 file`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} owner differs`);
  }
  let descriptor;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      opened.dev !== status.dev
      || opened.ino !== status.ino
      || opened.size !== status.size
      || (opened.mode & 0o777) !== 0o600
    ) refuse(`${label} changed while opening`);
    return readFileSync(descriptor, "utf8");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readPrivatePendingReceipt(file, maximumBytes = 256 * 1024) {
  assertAbsolute(file, "pending receipt");
  assertPrivateDirectory(path.dirname(file), "pending receipt parent directory");
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || status.size < 0
    || status.size > maximumBytes
    || realpathSync(file) !== file
    || (typeof process.getuid === "function" && status.uid !== process.getuid())
  ) refuse("pending receipt filesystem boundary differs");
  let descriptor;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (
      opened.dev !== status.dev || opened.ino !== status.ino
      || opened.size !== status.size || opened.nlink !== 1
      || (opened.mode & 0o777) !== 0o600
    ) refuse("pending receipt changed while opening");
    return readFileSync(descriptor, "utf8");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writePrivateFile(file, source) {
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
    writeFileSync(descriptor, source, "utf8");
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o600) {
      refuse("private file write boundary differs");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Main Finance runtime recovery v2 refused:")) {
      throw error;
    }
    refuse("private file could not be written");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function fsyncDirectory(directory) {
  let descriptor;
  try {
    descriptor = openSync(
      directory,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
    fsyncSync(descriptor);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Main Finance runtime recovery v2 refused:")) {
      throw error;
    }
    refuse("receipt directory durability boundary differs");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function operationLeaseFile(stateDirectory) {
  assertAbsolute(stateDirectory, "state directory");
  if (!outsideRepository(stateDirectory)) {
    refuse("state directory must remain outside the repository");
  }
  assertPrivateDirectory(
    path.dirname(stateDirectory),
    "operation lease parent directory",
  );
  return `${stateDirectory}.main-finance-runtime-recovery-v2-operation.lock`;
}

function acquireOperationLease(stateDirectory, now, randomBytesImpl) {
  const file = operationLeaseFile(stateDirectory);
  const parent = path.dirname(file);
  const owner = Object.freeze({
    schemaVersion: 1,
    kind: "main-finance-runtime-recovery-v2-operation-lease",
    pid: process.pid,
    startedAt: exactNow(now).toISOString(),
    nonce: randomBytesImpl(32).toString("hex"),
  });
  const source = `${canonicalJson(owner)}\n`;
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
    writeFileSync(descriptor, source, "utf8");
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o600) {
      refuse("operation lease write boundary differs");
    }
    closeSync(descriptor);
    descriptor = undefined;
    fsyncDirectory(parent);
    return Object.freeze({ file, sourceSha256: sha256(source) });
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      refuse("operation_lease_present; preserve it for reviewed manual recovery");
    }
    if (error instanceof Error && error.message.startsWith(
      "Main Finance runtime recovery v2 refused:",
    )) throw error;
    refuse("operation lease could not be acquired");
  }
}

function releaseOperationLease(lease) {
  const source = readPrivateFile(lease.file, "operation lease", 16 * 1024);
  if (sha256(source) !== lease.sourceSha256) {
    refuse("operation lease changed before release");
  }
  unlinkSync(lease.file);
  fsyncDirectory(path.dirname(lease.file));
}

function receiptDirectoryIdentity(directory) {
  assertPrivateDirectory(directory, "receipt directory");
  const status = lstatSync(directory, { bigint: true });
  return Object.freeze({
    path: directory,
    mode: "0700",
    dev: status.dev.toString(),
    ino: status.ino.toString(),
    uid: status.uid.toString(),
  });
}

function receiptBindingIdentity(binding) {
  return Object.freeze({
    path: binding.path,
    mode: binding.mode,
    dev: binding.dev,
    ino: binding.ino,
    uid: binding.uid,
  });
}

function assertFreshReceiptAuthorityUnchanged({
  expectedIdentity,
  expectedChain,
  currentIdentity,
  currentChain,
  phase,
}) {
  if (
    canonicalJson(currentIdentity) !== canonicalJson(expectedIdentity)
    || canonicalJson(currentChain) !== canonicalJson(expectedChain)
  ) refuse(`fresh plan receipt authority changed ${phase}`);
}

function createReceiptBinding(stateDirectory, receiptDirectory) {
  const identity = receiptDirectoryIdentity(receiptDirectory);
  const core = Object.freeze({
    schemaVersion: 2,
    kind: "main-finance-runtime-recovery-v2-receipt-directory-binding",
    ...identity,
  });
  const value = Object.freeze({
    ...core,
    bindingSha256: sha256(canonicalJson(core)),
  });
  writePrivateFile(
    path.join(stateDirectory, RECEIPT_BINDING_FILE),
    `${canonicalJson(value)}\n`,
  );
  fsyncDirectory(stateDirectory);
  return value;
}

function readReceiptBinding(stateDirectory, receiptDirectory) {
  const source = readPrivateFile(
    path.join(stateDirectory, RECEIPT_BINDING_FILE),
    "receipt directory binding",
    16 * 1024,
  );
  const value = readJsonSource(source, "receipt directory binding");
  exactKeys(value, [
    "schemaVersion", "kind", "path", "mode", "dev", "ino", "uid",
    "bindingSha256",
  ], "receipt directory binding");
  const { bindingSha256, ...core } = value;
  if (
    value.schemaVersion !== 2
    || value.kind !== "main-finance-runtime-recovery-v2-receipt-directory-binding"
    || !SHA256.test(bindingSha256 ?? "")
    || bindingSha256 !== sha256(canonicalJson(core))
    || source !== `${canonicalJson(value)}\n`
    || canonicalJson(core) !== canonicalJson({
      schemaVersion: 2,
      kind: "main-finance-runtime-recovery-v2-receipt-directory-binding",
      ...receiptDirectoryIdentity(receiptDirectory),
    })
  ) refuse("state directory is bound to a different receipt chain");
  return Object.freeze(value);
}

function readJsonSource(source, label) {
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    refuse(`${label} JSON differs`);
  }
  return value;
}

function rejectDuplicateJsonKeys(source, label) {
  let index = 0;
  function whitespace() {
    while (/\s/u.test(source[index] || "")) index += 1;
  }
  function stringToken() {
    const start = index;
    if (source[index] !== '"') refuse(`${label} JSON differs`);
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch {
          refuse(`${label} JSON differs`);
        }
      }
      if (character === "\\") index += 2;
      else index += 1;
    }
    refuse(`${label} JSON differs`);
  }
  function value() {
    whitespace();
    if (source[index] === "{") return object();
    if (source[index] === "[") return array();
    if (source[index] === '"') {
      stringToken();
      return;
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u
      .exec(source.slice(index));
    if (!match) refuse(`${label} JSON differs`);
    index += match[0].length;
  }
  function object() {
    const keys = new Set();
    index += 1;
    whitespace();
    if (source[index] === "}") {
      index += 1;
      return;
    }
    while (index < source.length) {
      whitespace();
      const key = stringToken();
      if (keys.has(key)) refuse(`${label} contains a duplicate JSON key`);
      keys.add(key);
      whitespace();
      if (source[index] !== ":") refuse(`${label} JSON differs`);
      index += 1;
      value();
      whitespace();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      if (source[index] !== ",") refuse(`${label} JSON differs`);
      index += 1;
    }
    refuse(`${label} JSON differs`);
  }
  function array() {
    index += 1;
    whitespace();
    if (source[index] === "]") {
      index += 1;
      return;
    }
    while (index < source.length) {
      value();
      whitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      if (source[index] !== ",") refuse(`${label} JSON differs`);
      index += 1;
    }
    refuse(`${label} JSON differs`);
  }
  value();
  whitespace();
  if (index !== source.length) refuse(`${label} JSON differs`);
}

function exactHttpsOrigin(value, label) {
  if (typeof value !== "string" || value !== value.trim() || value.includes("*")) {
    refuse(`${label} must be one exact HTTPS origin`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    refuse(`${label} must be one exact HTTPS origin`);
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.hostname.endsWith(".")
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || parsed.origin !== value
  ) refuse(`${label} must be one exact HTTPS origin`);
  return parsed.origin;
}

function exactTelegramMiniAppUrl(value, label) {
  if (typeof value !== "string" || value !== value.trim()) {
    refuse(`${label} must be one exact Telegram Mini App URL`);
  }
  const match = /^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{1,28}[Bb][Oo][Tt])\?startapp$/u
    .exec(value);
  if (!match) refuse(`${label} must be one exact Telegram Mini App URL`);
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "t.me"
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.pathname !== `/${match[1]}`
    || parsed.search !== "?startapp"
    || parsed.hash
    || parsed.href !== value
  ) refuse(`${label} must be one exact Telegram Mini App URL`);
  return `https://t.me/${match[1].toLowerCase()}?startapp`;
}

function readReviewedExternalJson(file, label) {
  const source = readPrivateFile(file, label, 16 * 1024);
  rejectDuplicateJsonKeys(source, label);
  return Object.freeze({
    parsed: readJsonSource(source, label),
    sha256: sha256(source),
  });
}

function readReviewedProductionBoundary(file) {
  const reviewed = readReviewedExternalJson(file, "production boundary");
  const value = reviewed.parsed;
  if (value?.schemaVersion === 1) {
    exactKeys(value, [
      "schemaVersion", "mainEdgeOrigin", "financeWebOrigin",
      "telegramMiniAppUrl",
    ], "production boundary");
  } else if (value?.schemaVersion === 2) {
    exactKeys(value, [
      "schemaVersion", "publicOrigin", "mainEdgeOrigin", "financeWebOrigin",
      "telegramMiniAppUrl",
    ], "production boundary");
  } else refuse("production boundary schema differs");
  const mainSupabaseOrigin = exactHttpsOrigin(
    value.mainEdgeOrigin,
    "production mainEdgeOrigin",
  );
  const financeWebOrigin = exactHttpsOrigin(
    value.financeWebOrigin,
    "production financeWebOrigin",
  );
  exactTelegramMiniAppUrl(value.telegramMiniAppUrl, "production telegramMiniAppUrl");
  if (value.schemaVersion === 2) {
    const publicOrigin = exactHttpsOrigin(value.publicOrigin, "production publicOrigin");
    if (
      new URL(publicOrigin).hostname.endsWith(".invalid")
      || new Set([publicOrigin, mainSupabaseOrigin, financeWebOrigin]).size !== 3
    ) refuse("production origin boundary differs");
  }
  return Object.freeze({ mainSupabaseOrigin, sha256: reviewed.sha256 });
}

function readReviewedTargetDescriptor(file, boundary) {
  const reviewed = readReviewedExternalJson(file, "target descriptor");
  exactKeys(reviewed.parsed, [
    "schemaVersion", "environment", "mainEdgeOrigin",
    "productionBoundarySha256",
  ], "target descriptor");
  const mainSupabaseOrigin = exactHttpsOrigin(
    reviewed.parsed.mainEdgeOrigin,
    "target descriptor mainEdgeOrigin",
  );
  if (
    reviewed.parsed.schemaVersion !== 1
    || !["staging", "production"].includes(reviewed.parsed.environment)
    || !SHA256.test(reviewed.parsed.productionBoundarySha256 ?? "")
    || reviewed.parsed.productionBoundarySha256 !== boundary.sha256
    || (reviewed.parsed.environment === "production"
      && mainSupabaseOrigin !== boundary.mainSupabaseOrigin)
    || (reviewed.parsed.environment === "staging"
      && mainSupabaseOrigin === boundary.mainSupabaseOrigin)
  ) refuse("target descriptor boundary differs");
  return Object.freeze({
    environment: reviewed.parsed.environment,
    mainSupabaseOrigin,
    productionBoundarySha256: boundary.sha256,
    sha256: reviewed.sha256,
  });
}

function releaseFile(specification, label) {
  if (
    specification === null
    || typeof specification !== "object"
    || Array.isArray(specification)
    || typeof specification.path !== "string"
    || typeof specification.sha256 !== "string"
    || !SHA256.test(specification.sha256)
  ) refuse(`${label} contract differs`);
  const file = path.resolve(REPOSITORY_ROOT, specification.path);
  if (!file.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) {
    refuse(`${label} path escapes the repository`);
  }
  const source = readFileSync(file, "utf8");
  if (sha256(source) !== specification.sha256) refuse(`${label} bytes differ`);
  return Object.freeze({ file, source, value: readJsonSource(source, label) });
}

function readRelease() {
  const source = readFileSync(MANIFEST_FILE, "utf8");
  const manifest = readJsonSource(source, "release manifest");
  exactKeys(manifest, [
    "schemaVersion", "kind", "releaseStatus", "environment", "mainProjectRef",
    "financeProjectRef", "productionDenyProjectRefs", "sourceBranch",
    "supabaseCliVersion", "nodeVersion", "sourceLineage", "sourceCi",
    "toolPins", "edgeFunction", "environmentContract", "preflightSql",
    "expectedDatabaseCatalogSha256", "postflightContract",
    "deploymentClosureSetSha256", "deploymentClosureFiles", "archiveFormat",
    "runtimePins", "plan", "mutations",
  ], "release manifest");
  exactKeys(manifest.sourceCi, [
    "repository", "workflowPath", "workflowBlobSha", "jobName",
    "requiredSuccessfulSteps",
  ], "release manifest source CI");
  if (
    manifest.schemaVersion !== 3
    || manifest.kind
      !== "main-finance-runtime-recovery-v3-secrets-only-staging-release"
    || ![READY_STATUS, NOT_READY_STATUS].includes(manifest.releaseStatus)
    || manifest.environment !== "staging"
    || manifest.mainProjectRef !== MAIN_REF
    || manifest.financeProjectRef !== FINANCE_REF
    || canonicalJson(manifest.productionDenyProjectRefs) !== canonicalJson(PRODUCTION_REFS)
    || manifest.sourceBranch !== "agent/main-finance-staging-runtime-recovery-v2"
    || manifest.supabaseCliVersion !== "2.109.1"
    || manifest.nodeVersion !== "24.14.0"
    || manifest.edgeFunction?.name !== FUNCTION_NAME
    || manifest.edgeFunction.verifyJwt !== false
    || manifest.edgeFunction.alreadyPresentInImportedBaseline !== true
    || manifest.edgeFunction.deployAuthorized !== false
    || manifest.archiveFormat !== "main-finance-source-archive-v2-nul-framed"
    || manifest.plan?.ttlSeconds !== 240
    || manifest.plan.maximumSnapshotAgeSeconds !== 300
    || manifest.plan.futureClockSkewSeconds !== 30
    || manifest.plan.approvalPrefix
      !== "MAIN_FINANCE_RUNTIME_RECOVERY_V2_APPROVED=DEPLOY"
    || manifest.mutations?.forbidPrivacyOverwrite !== true
    || manifest.mutations.predecessorAdoptionRequired !== true
    || manifest.mutations.postSecretFunctionReadRounds !== 2
    || canonicalJson(manifest.mutations.requiredFunctionInventoryKeys)
      !== canonicalJson([
        "id", "name", "slug", "ezbr_sha256", "entrypoint_path", "status",
        "verify_jwt", "version", "created_at", "updated_at",
      ])
    || canonicalJson(manifest.mutations.allowedSecretFunctionVersionTransitions)
      !== canonicalJson(["unchanged", "exact-all-existing-plus-one"])
    || manifest.mutations.causalAttributionClaimed !== false
    || canonicalJson(manifest.mutations.exactSecretSetNames)
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
    || manifest.mutations.proofOnlyGeneratedSecretCount !== 2
    || manifest.mutations.rebuiltStableRuntimeCount !== 11
    || canonicalJson(manifest.mutations.metadataOnlyUpdatedAtAllowlist)
      !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)
    || manifest.mutations.exactHostedMutationCount !== 1
    || manifest.mutations.exactFunctionDeployCount !== 0
    || manifest.mutations.automaticRetryAllowed !== false
    || manifest.mutations.databaseWrites !== false
    || manifest.mutations.productionWrites !== false
  ) refuse("release manifest boundary differs");
  exactKeys(manifest.edgeFunction, [
    "name", "verifyJwt", "alreadyPresentInImportedBaseline", "deployAuthorized",
  ], "release manifest Edge Function boundary");
  exactKeys(manifest.mutations, [
    "secretSetNamesSource", "exactSecretSetNames",
    "proofOnlyGeneratedSecretCount", "rebuiltStableRuntimeCount",
    "metadataOnlyUpdatedAtAllowlist", "predecessorAdoptionRequired",
    "postSecretFunctionReadRounds", "requiredFunctionInventoryKeys",
    "allowedSecretFunctionVersionTransitions", "causalAttributionClaimed",
    "forbidPrivacyOverwrite", "exactHostedMutationCount",
    "exactFunctionDeployCount", "automaticRetryAllowed", "databaseWrites",
    "productionWrites",
  ], "release manifest mutation boundary");
  exactKeys(manifest.sourceLineage, [
    "baseCommitSha", "baseTreeSha", "requiredSoleParentSha",
    "expectedTrackedFileCount", "changedPaths",
  ], "release manifest source lineage");
  const manifestSha256 = sha256(source);
  if (manifest.releaseStatus !== READY_STATUS) {
    return Object.freeze({ manifest, source, manifestSha256, ready: false });
  }
  const requiredSteps = [
    "Check out repository",
    "Use Node.js",
    "Use Deno",
    "Install pinned ripgrep",
    "Enforce reviewed Finance v2 pilot scope",
    "Run Finance pilot verification",
    "Validate disposable PostgreSQL harness",
    "Verify frozen Edge dependency graph",
    "Execute main Finance foundation on disposable PostgreSQL 17",
  ];
  const toolNames = ["git", "node", "supabaseCli", "gh"];
  if (
    manifest.sourceLineage?.baseCommitSha !== BASE_COMMIT_SHA
    || manifest.sourceLineage.baseTreeSha !== BASE_TREE_SHA
    || manifest.sourceLineage.requiredSoleParentSha !== BASE_COMMIT_SHA
    || manifest.sourceLineage.expectedTrackedFileCount !== EXPECTED_TRACKED_FILE_COUNT
    || canonicalJson(manifest.sourceLineage.changedPaths)
      !== canonicalJson(EXPECTED_CHANGED_PATHS)
    || manifest.sourceCi?.repository !== GITHUB_REPOSITORY
    || manifest.sourceCi.workflowPath !== ".github/workflows/verify-finance-integration.yml"
    || !GIT_OID.test(manifest.sourceCi.workflowBlobSha ?? "")
    || manifest.sourceCi.jobName !== "verify"
    || canonicalJson(manifest.sourceCi.requiredSuccessfulSteps) !== canonicalJson(requiredSteps)
    || !SHA256.test(manifest.expectedDatabaseCatalogSha256 ?? "")
    || canonicalJson(manifest.toolPins) !== canonicalJson(FROZEN_TOOL_PINS)
    || manifest.toolPins === null
    || typeof manifest.toolPins !== "object"
    || toolNames.some(name => {
      const pin = manifest.toolPins[name];
      return pin === null || typeof pin !== "object"
        || typeof pin.realPath !== "string" || !path.isAbsolute(pin.realPath)
        || path.resolve(pin.realPath) !== pin.realPath
        || !SHA256.test(pin.sha256 ?? "")
        || typeof pin.version !== "string" || pin.version.length < 1;
    })
    || manifest.toolPins.supabaseArchive === null
    || typeof manifest.toolPins.supabaseArchive !== "object"
    || typeof manifest.toolPins.supabaseArchive.realPath !== "string"
    || !path.isAbsolute(manifest.toolPins.supabaseArchive.realPath)
    || path.resolve(manifest.toolPins.supabaseArchive.realPath)
      !== manifest.toolPins.supabaseArchive.realPath
    || !SHA256.test(manifest.toolPins.supabaseArchive.sha256 ?? "")
  ) refuse("frozen source lineage, CI, catalog or tool contract differs");
  if (process.versions.node !== manifest.nodeVersion) {
    refuse(`Node runtime must be exactly ${manifest.nodeVersion}`);
  }
  const environment = releaseFile(manifest.environmentContract, "environment contract");
  const postflight = releaseFile(manifest.postflightContract, "postflight contract");
  exactKeys(environment.value, [
    "schemaVersion", "kind", "environment", "mainProjectRef",
    "financeProjectRef", "productionDenyProjectRefs", "generatedSecrets",
    "stableRuntimeConfig", "stableRuntimeValues", "requiredInheritedRuntime",
    "forbiddenSecretMutations", "secretMutation", "currentAuthorityRoot",
    "predecessorAdoption", "operatorOutputPolicy",
  ], "environment contract");
  const expectedCurrentAuthorityRoot = Object.freeze({
    requiredActions: ["plan", "apply", "reconcile", "verify"],
    rootMode: "0700",
    rootOwnerRequired: true,
    rootRealDirectoryRequired: true,
    rootSymlinksAllowed: false,
    outsideRepository: true,
    commonParentRequired: true,
    stateDirectoryLifecycle: {
      argument: "--state-dir",
      directChildRequired: true,
      freshPlanMustBeAbsent: true,
      createdMode: "0700",
      createdOwnerRequired: true,
      existingActionsRequireRealDirectory: true,
      symlinksAllowed: false,
    },
    receiptDirectory: {
      argument: "--receipt-dir",
      directChildRequired: true,
      mustExistBeforeLease: true,
      mode: "0700",
      ownerRequired: true,
      realDirectoryRequired: true,
      symlinksAllowed: false,
    },
    directChildFiles: [
      {
        argument: "--release-provenance",
        mode: "0600",
        ownerRequired: true,
        regularFileRequired: true,
        singleLinkRequired: true,
        symlinksAllowed: false,
      },
      {
        argument: "--production-boundary",
        mode: "0600",
        ownerRequired: true,
        regularFileRequired: true,
        singleLinkRequired: true,
        symlinksAllowed: false,
      },
      {
        argument: "--target-config",
        mode: "0600",
        ownerRequired: true,
        regularFileRequired: true,
        singleLinkRequired: true,
        symlinksAllowed: false,
      },
    ],
    predecessorRootDistinctAndNonNestedBothWays: true,
    validatedAfterReadyManifestBeforeLease: true,
  });
  const adoption = environment.value.predecessorAdoption;
  exactKeys(adoption, [
    "requiredForFreshSuccessorPlan", "rootPolicy", "sourceCommitSha",
    "sourceTreeSha", "planReceiptSha256", "secretIntentReceiptSha256",
    "secretResultReceiptSha256", "functionIntentReceiptSha256",
    "functionUnknownReceiptSha256", "terminalReceiptSha256",
    "receiptChainSha256", "bundleAttestationSha256", "runtimeFileSha256",
    "provenanceFileSha256", "provenanceDescriptorSha256",
    "expectedSecretDigestSetSha256", "generatedSecretDigestSetSha256",
    "preinstallMainInventorySha256", "postSecretMainInventorySha256",
    "terminalMainInventorySha256", "stableFinanceInventorySha256",
    "preinstallFunctionInventorySha256", "postSecretFunctionInventorySha256",
    "terminalFunctionInventorySha256", "preinstallFunctionCount",
    "terminalFunctionCount", "adoptGeneratedSecretNames",
    "rebuildStableRuntimeConfig", "randomGenerationAllowed",
    "planOnlyFlagsAllOrNone", "validationBeforePlaintextRead",
    "finalPredecessorSandwichRequired",
  ], "predecessor adoption environment contract");
  exactKeys(environment.value.secretMutation, [
    "mutationNames", "proofOnlyGeneratedSecretNames",
    "rebuiltStableRuntimeCount", "fullProofRuntimeCount",
    "metadataOnlyUpdatedAtAllowlist", "stableInventoryReadRounds",
    "allowedFunctionVersionTransitions", "functionDeployAllowed",
    "causalAttributionClaimed",
  ], "secrets-only mutation environment contract");
  if (
    environment.value.schemaVersion !== 3
    || environment.value.kind
      !== "main-finance-runtime-recovery-v3-secrets-only-environment-contract"
    || environment.value.environment !== "staging"
    || environment.value.mainProjectRef !== MAIN_REF
    || environment.value.financeProjectRef !== FINANCE_REF
    || canonicalJson(environment.value.productionDenyProjectRefs)
      !== canonicalJson(PRODUCTION_REFS)
    || canonicalJson(environment.value.currentAuthorityRoot)
      !== canonicalJson(expectedCurrentAuthorityRoot)
    || adoption?.requiredForFreshSuccessorPlan !== true
    || canonicalJson(adoption.rootPolicy) !== canonicalJson({
      ownerPrivateMode: "0700",
      outsideRepository: true,
      commonParentRequired: true,
      identityBinding: "realpath plus device inode mode and owner",
      storePathInReceipt: false,
    })
    || adoption.sourceCommitSha !== TERMINAL_DIVERGED_PREDECESSOR_PINS.sourceCommitSha
    || adoption.sourceTreeSha !== TERMINAL_DIVERGED_PREDECESSOR_PINS.sourceTreeSha
    || adoption.planReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.planReceiptSha256
    || adoption.secretIntentReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.secretIntentReceiptSha256
    || adoption.secretResultReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.secretResultReceiptSha256
    || adoption.functionIntentReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.functionIntentReceiptSha256
    || adoption.functionUnknownReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.functionUnknownReceiptSha256
    || adoption.terminalReceiptSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalReceiptSha256
    || adoption.receiptChainSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.receiptChainSha256
    || adoption.bundleAttestationSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.bundleAttestationSha256
    || adoption.runtimeFileSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.runtimeFileSha256
    || adoption.provenanceFileSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.provenanceFileSha256
    || adoption.provenanceDescriptorSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.provenanceDescriptorSha256
    || adoption.expectedSecretDigestSetSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.expectedSecretDigestSetSha256
    || adoption.generatedSecretDigestSetSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.generatedSecretDigestSetSha256
    || adoption.preinstallMainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallMainInventorySha256
    || adoption.postSecretMainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.postSecretMainInventorySha256
    || adoption.terminalMainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalMainInventorySha256
    || adoption.stableFinanceInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
    || adoption.preinstallFunctionInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallFunctionInventorySha256
    || adoption.postSecretFunctionInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.postSecretFunctionInventorySha256
    || adoption.terminalFunctionInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionInventorySha256
    || adoption.preinstallFunctionCount
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallFunctionCount
    || adoption.terminalFunctionCount
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionCount
    || canonicalJson(adoption.adoptGeneratedSecretNames)
      !== canonicalJson(environment.value.generatedSecrets.map(item => item.name))
    || adoption.rebuildStableRuntimeConfig !== true
    || adoption.randomGenerationAllowed !== false
    || canonicalJson(adoption.planOnlyFlagsAllOrNone) !== canonicalJson([
      "--prior-state-dir", "--prior-receipt-dir", "--prior-release-provenance",
      "--prior-terminal-receipt-sha256",
    ])
    || adoption.finalPredecessorSandwichRequired !== true
    || canonicalJson(environment.value.secretMutation.mutationNames)
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
    || canonicalJson(environment.value.secretMutation.proofOnlyGeneratedSecretNames)
      !== canonicalJson(environment.value.generatedSecrets.map(item => item.name))
    || environment.value.secretMutation.rebuiltStableRuntimeCount !== 11
    || environment.value.secretMutation.fullProofRuntimeCount !== 13
    || canonicalJson(
      environment.value.secretMutation.metadataOnlyUpdatedAtAllowlist,
    ) !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)
    || environment.value.secretMutation.stableInventoryReadRounds !== 2
    || canonicalJson(
      environment.value.secretMutation.allowedFunctionVersionTransitions,
    ) !== canonicalJson(["unchanged", "exact-all-existing-plus-one"])
    || environment.value.secretMutation.functionDeployAllowed !== false
    || environment.value.secretMutation.causalAttributionClaimed !== false
  ) refuse("predecessor adoption environment contract differs");
  exactKeys(postflight.value, [
    "schemaVersion", "kind", "environment", "endpoint", "method", "action",
    "ambientAuthorizationAllowed", "expectedStatus", "expectedContentType",
    "expectedResponseKeys", "expectedConstants", "minimumCheckedCount",
    "snapshotSandwich", "authority", "requiredBindings", "receiptRedactions",
  ], "secrets-only postflight contract");
  if (
    postflight.value.schemaVersion !== 3
    || postflight.value.kind
      !== "main-finance-runtime-recovery-v3-secrets-only-postflight-contract"
    || postflight.value.environment !== "staging"
    || postflight.value.endpoint
      !== `https://${MAIN_REF}.supabase.co/functions/v1/${FUNCTION_NAME}`
    || postflight.value.method !== "POST"
    || postflight.value.action !== "attest"
    || postflight.value.ambientAuthorizationAllowed !== false
    || postflight.value.expectedStatus !== 200
    || postflight.value.authority?.completionCause
      !== "verified secrets-set result or state_satisfied read-only reconciliation"
    || postflight.value.authority.hostedMutationCount !== 1
    || postflight.value.authority.functionDeployCount !== 0
    || postflight.value.authority.automaticRetryAllowed !== false
    || postflight.value.snapshotSandwich?.functionInventoryPhases
      ?.functionDeployAuthorized !== false
    || canonicalJson(
      postflight.value.snapshotSandwich.functionInventoryPhases.allowedDispositions,
    ) !== canonicalJson(["unchanged", "exact-all-existing-plus-one"])
  ) refuse("secrets-only postflight contract differs");
  if (
    manifest.preflightSql === null
    || typeof manifest.preflightSql !== "object"
    || manifest.preflightSql.path
      !== "supabase/releases/main-finance-runtime-recovery-v2/preflight.sql"
    || typeof manifest.preflightSql.sha256 !== "string"
    || !SHA256.test(manifest.preflightSql.sha256)
  ) refuse("preflight SQL contract differs");
  const preflightFile = path.join(REPOSITORY_ROOT, manifest.preflightSql.path);
  const preflightSql = readFileSync(preflightFile, "utf8");
  if (
    sha256(preflightSql) !== manifest.preflightSql.sha256
    || /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE|GRANT|REVOKE)\b/iu
      .test(preflightSql)
    || /telegram_id|encode\s*\(\s*[^,]*subject_digest|subject_digest\s*::\s*text/iu
      .test(preflightSql)
  ) refuse("pinned read-only preflight SQL bytes differ");
  const expectedPaths = [
    "supabase/config.toml",
    "supabase/functions/_shared/main-edge-runtime.ts",
    "supabase/functions/_shared/main-finance-protocol.mjs",
    "supabase/functions/finance-manage-access-v2/deno.json",
    "supabase/functions/finance-manage-access-v2/deno.lock",
    "supabase/functions/finance-manage-access-v2/index.ts",
  ];
  if (
    !Array.isArray(manifest.deploymentClosureFiles)
    || canonicalJson(manifest.deploymentClosureFiles.map(item => item.path))
      !== canonicalJson(expectedPaths)
    || manifest.deploymentClosureFiles.some(item =>
      item.mode !== "100644"
      || typeof item.sha256 !== "string"
      || !SHA256.test(item.sha256))
  ) refuse("deployment closure allow-list differs");
  const closureCore = manifest.deploymentClosureFiles
    .map(item => `${item.path}\0${item.mode}\0${item.sha256}\n`)
    .join("");
  if (sha256(closureCore) !== manifest.deploymentClosureSetSha256) {
    refuse("deployment closure set fingerprint differs");
  }
  for (const item of manifest.deploymentClosureFiles) {
    const file = path.resolve(REPOSITORY_ROOT, item.path);
    const status = lstatSync(file);
    if (
      !file.startsWith(`${REPOSITORY_ROOT}${path.sep}`)
      || !status.isFile()
      || status.isSymbolicLink()
      || (status.mode & 0o777) !== 0o644
      || realpathSync(file) !== file
      || sha256(readFileSync(file)) !== item.sha256
    ) refuse(`deployment closure bytes differ: ${item.path}`);
  }
  const denoConfig = readJsonSource(
    readFileSync(path.join(REPOSITORY_ROOT, expectedPaths[3]), "utf8"),
    "Deno config",
  );
  const denoLock = readJsonSource(
    readFileSync(path.join(REPOSITORY_ROOT, expectedPaths[4]), "utf8"),
    "Deno lock",
  );
  if (
    denoConfig.lock?.path !== "./deno.lock"
    || denoConfig.lock.frozen !== true
    || denoConfig.imports?.["@supabase/supabase-js"]
      !== manifest.runtimePins.supabaseJsSpecifier
    || denoLock.version !== manifest.runtimePins.denoLockVersion
    || denoLock.specifiers?.[manifest.runtimePins.supabaseJsSpecifier]
      !== manifest.runtimePins.supabaseJsVersion
    || manifest.runtimePins.frozenLock !== true
  ) refuse("frozen Deno runtime graph differs");
  return Object.freeze({
    manifest,
    source,
    manifestSha256,
    ready: true,
    environment: environment.value,
    postflight: postflight.value,
    preflightSql,
    preflightSqlSha256: manifest.preflightSql.sha256,
  });
}

function readMeasurementRelease() {
  const release = readRelease();
  if (release.ready) refuse("catalog measure is accepted only before release readiness");
  const manifest = release.manifest;
  if (
    manifest.sourceLineage?.baseCommitSha !== BASE_COMMIT_SHA
    || manifest.sourceLineage.baseTreeSha !== BASE_TREE_SHA
    || manifest.sourceLineage.requiredSoleParentSha !== BASE_COMMIT_SHA
    || manifest.sourceLineage.expectedTrackedFileCount !== EXPECTED_TRACKED_FILE_COUNT
    || canonicalJson(manifest.sourceLineage.changedPaths)
      !== canonicalJson(EXPECTED_CHANGED_PATHS)
    || canonicalJson(manifest.toolPins) !== canonicalJson(FROZEN_TOOL_PINS)
    || manifest.preflightSql?.path
      !== "supabase/releases/main-finance-runtime-recovery-v2/preflight.sql"
    || !SHA256.test(manifest.preflightSql?.sha256 ?? "")
  ) refuse("catalog measurement release boundary differs");
  const preflightFile = path.resolve(REPOSITORY_ROOT, manifest.preflightSql.path);
  const preflightSql = readFileSync(preflightFile, "utf8");
  if (
    !preflightFile.startsWith(`${REPOSITORY_ROOT}${path.sep}`)
    || sha256(preflightSql) !== manifest.preflightSql.sha256
    || /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE|GRANT|REVOKE)\b/iu
      .test(preflightSql)
    || /telegram_id|encode\s*\(\s*[^,]*subject_digest|subject_digest\s*::\s*text/iu
      .test(preflightSql)
  ) refuse("catalog measurement preflight SQL differs");
  return Object.freeze({
    ...release,
    preflightSql,
    preflightSqlSha256: manifest.preflightSql.sha256,
  });
}

function scrubEnvironment(environment, accessToken = null, supabaseHome = null) {
  const result = {};
  for (const [name, value] of Object.entries(environment)) {
    if (CLI_ENVIRONMENT_ALLOWLIST.has(name) && typeof value === "string") {
      result[name] = value;
    }
  }
  if (accessToken !== null) result.SUPABASE_ACCESS_TOKEN = accessToken;
  if (supabaseHome !== null) {
    assertSealedEmptyDirectory(supabaseHome, "Supabase CLI home");
    result.SUPABASE_HOME = supabaseHome;
    result.SUPABASE_TELEMETRY_DISABLED = "1";
    result.DO_NOT_TRACK = "1";
    result.NO_COLOR = "1";
  }
  return Object.freeze(result);
}

function prepareSupabaseHome(stateDirectory, allowPreservedDriftRecovery = false) {
  assertPrivateDirectory(stateDirectory, "state directory");
  const primary = path.join(stateDirectory, SUPABASE_HOME_DIRECTORY);
  if (!existsSync(primary)) {
    return createOrAssertSealedEmptyDirectory(
      stateDirectory,
      SUPABASE_HOME_DIRECTORY,
      "Supabase CLI home",
    );
  }
  try {
    return assertSealedEmptyDirectory(primary, "Supabase CLI home");
  } catch {
    // Preserve an invalid or written CLI home as incident evidence. Reconciliation
    // may select a fresh sealed directory, but normal planning must stop.
  }
  if (!allowPreservedDriftRecovery) {
    refuse("Supabase CLI home contains preserved unreviewed state");
  }
  for (let index = 1; index <= 999; index += 1) {
    const candidate = path.join(
      stateDirectory,
      `supabase-home-recovery-${String(index).padStart(6, "0")}`,
    );
    if (!existsSync(candidate)) {
      return createOrAssertSealedEmptyDirectory(
        stateDirectory,
        path.basename(candidate),
        "Supabase CLI recovery home",
      );
    }
    try {
      return assertSealedEmptyDirectory(candidate, "Supabase CLI recovery home");
    } catch {
      // Keep scanning without mutating preserved incident state.
    }
  }
  refuse("no empty append-only Supabase CLI recovery home is available");
}

function assertSupabaseHomeUnchanged(directory) {
  assertSealedEmptyDirectory(directory, "Supabase CLI home");
}

function chainAllowsPreservedLocalStateRecovery(chain) {
  return chain.some(receipt => receipt.kind === "reconciliation"
    || receipt.kind === "mutation-intent"
    || (receipt.kind === "mutation-result" && receipt.status === "unknown"));
}

function createOrAssertGhLocalStateGeneration(stateDirectory, names, label) {
  const paths = Object.fromEntries(Object.entries(names).map(([key, name]) => [
    key,
    path.join(stateDirectory, name),
  ]));
  const present = Object.values(paths).map(item => existsSync(item));
  if (present.some(Boolean) && !present.every(Boolean)) {
    refuse(`${label} is partial and must remain preserved`);
  }
  if (!present.some(Boolean)) {
    for (const [key, name] of Object.entries(names)) {
      createOrAssertSealedEmptyDirectory(
        stateDirectory,
        name,
        `${label} ${key}`,
      );
    }
  }
  return Object.freeze({
    state: assertSealedEmptyDirectory(paths.state, `${label} state`),
    cache: assertSealedEmptyDirectory(paths.cache, `${label} cache`),
    data: assertSealedEmptyDirectory(paths.data, `${label} data`),
  });
}

function prepareGhLocalState(stateDirectory, allowPreservedDriftRecovery = false) {
  const primaryNames = Object.freeze({
    state: GH_XDG_STATE_DIRECTORY,
    cache: GH_XDG_CACHE_DIRECTORY,
    data: GH_XDG_DATA_DIRECTORY,
  });
  try {
    return createOrAssertGhLocalStateGeneration(
      stateDirectory,
      primaryNames,
      "GitHub CLI primary XDG boundary",
    );
  } catch {
    // Preserve any invalid or written generation as incident evidence.
  }
  if (!allowPreservedDriftRecovery) {
    refuse("GitHub CLI local state contains preserved unreviewed state");
  }
  for (let index = 1; index <= 999_999; index += 1) {
    const suffix = `-recovery-${String(index).padStart(6, "0")}`;
    const names = Object.freeze({
      state: `${GH_XDG_STATE_DIRECTORY}${suffix}`,
      cache: `${GH_XDG_CACHE_DIRECTORY}${suffix}`,
      data: `${GH_XDG_DATA_DIRECTORY}${suffix}`,
    });
    try {
      return createOrAssertGhLocalStateGeneration(
        stateDirectory,
        names,
        `GitHub CLI recovery XDG boundary ${index}`,
      );
    } catch {
      // Keep scanning without mutating a preserved invalid generation.
    }
  }
  refuse("no empty append-only GitHub CLI recovery XDG boundary is available");
}

function assertGhLocalStateUnchanged(boundary) {
  assertSealedEmptyDirectory(boundary.state, "GitHub CLI XDG state home");
  assertSealedEmptyDirectory(boundary.cache, "GitHub CLI XDG cache home");
  assertSealedEmptyDirectory(boundary.data, "GitHub CLI XDG data home");
}

function assertGhConfigBoundary() {
  const directory = lstatSync(GH_CONFIG_DIRECTORY);
  const hosts = lstatSync(GH_HOSTS_FILE);
  const config = lstatSync(GH_CONFIG_FILE);
  if (
    !directory.isDirectory() || directory.isSymbolicLink()
    || (directory.mode & 0o777) !== 0o751
    || realpathSync(GH_CONFIG_DIRECTORY) !== GH_CONFIG_DIRECTORY
    || canonicalJson(readdirSync(GH_CONFIG_DIRECTORY).sort())
      !== canonicalJson(["config.yml", "hosts.yml"])
    || !hosts.isFile() || hosts.isSymbolicLink() || hosts.nlink !== 1
    || (hosts.mode & 0o777) !== 0o600
    || realpathSync(GH_HOSTS_FILE) !== GH_HOSTS_FILE
    || !config.isFile() || config.isSymbolicLink() || config.nlink !== 1
    || (config.mode & 0o777) !== 0o600
    || realpathSync(GH_CONFIG_FILE) !== GH_CONFIG_FILE
    || (typeof process.getuid === "function"
      && (directory.uid !== process.getuid() || hosts.uid !== process.getuid()
        || config.uid !== process.getuid()))
  ) refuse("GitHub CLI owner-private config boundary differs");
  return GH_CONFIG_DIRECTORY;
}

function defaultRunProcess(executable, args, environment) {
  const workingDirectory = typeof environment?.SUPABASE_HOME === "string"
    ? assertSealedEmptyDirectory(environment.SUPABASE_HOME, "Supabase CLI home")
    : REPOSITORY_ROOT;
  const result = spawnSync(executable, args, {
    cwd: workingDirectory,
    encoding: "utf8",
    env: environment,
    timeout: 45_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  return Object.freeze({
    status: result.status,
    signal: result.signal,
    error: result.error ?? null,
    stdout: result.stdout ?? "",
  });
}

function successful(result) {
  return result !== null
    && typeof result === "object"
    && result.status === 0
    && result.signal == null
    && result.error == null
    && typeof result.stdout === "string";
}

function assertExecutable(file, expected, label, runProcess, environment) {
  assertAbsolute(file, label);
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || (status.mode & 0o111) === 0
    || (status.mode & 0o022) !== 0
    || realpathSync(file) !== file
    || file !== expected.realPath
    || sha256(readFileSync(file)) !== expected.sha256
  ) refuse(`${label} executable pin differs`);
  const result = runProcess(file, ["--version"], environment);
  if (!successful(result) || result.stdout.trim().split("\n", 1)[0] !== expected.version) {
    refuse(`${label} version differs; output withheld`);
  }
  return file;
}

export function validateMainFinanceRuntimeRecoveryV2ProvenanceSource(source) {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > 64 * 1024) {
    refuse("release provenance source differs");
  }
  const value = readJsonSource(source, "release provenance");
  exactKeys(value, [
    "schemaVersion",
    "kind",
    "environment",
    "mainProjectRef",
    "financeProjectRef",
    "productionDenyProjectRefs",
    "sourceBranch",
    "remoteRef",
    "expectedCommitSha",
    "expectedTreeSha",
    "remoteCommitSha",
    "githubRunId",
    "descriptorSha256",
  ], "release provenance");
  const { descriptorSha256, ...core } = value;
  if (
    source !== `${canonicalJson(value)}\n`
    || value.schemaVersion !== 2
    || value.kind !== PROVENANCE_KIND
    || value.environment !== "staging"
    || value.mainProjectRef !== MAIN_REF
    || value.financeProjectRef !== FINANCE_REF
    || canonicalJson(value.productionDenyProjectRefs) !== canonicalJson(PRODUCTION_REFS)
    || value.sourceBranch !== "agent/main-finance-staging-runtime-recovery-v2"
    || value.remoteRef !== "refs/remotes/origin/agent/main-finance-staging-runtime-recovery-v2"
    || !GIT_OID.test(value.expectedCommitSha)
    || !GIT_OID.test(value.expectedTreeSha)
    || value.remoteCommitSha !== value.expectedCommitSha
    || !DECIMAL.test(value.githubRunId)
    || value.githubRunId === "0"
    || !SHA256.test(descriptorSha256)
    || descriptorSha256 !== sha256(canonicalJson(core))
  ) refuse("release provenance contract differs");
  return Object.freeze({
    ...value,
    fileSha256: sha256(source),
  });
}

function readProvenance(file) {
  return validateMainFinanceRuntimeRecoveryV2ProvenanceSource(
    readPrivateFile(file, "release provenance", 64 * 1024),
  );
}

function readReviewedAccessBoundary(input) {
  let boundary;
  let target;
  try {
    boundary = readReviewedProductionBoundary(input.productionBoundary);
    target = readReviewedTargetDescriptor(input.targetConfig, boundary);
  } catch {
    refuse("reviewed production boundary or staging target descriptor differs");
  }
  if (
    target.environment !== "staging"
    || target.mainSupabaseOrigin !== `https://${MAIN_REF}.supabase.co`
    || target.mainSupabaseOrigin === boundary.mainSupabaseOrigin
    || target.productionBoundarySha256 !== boundary.sha256
    || !SHA256.test(boundary.sha256)
    || !SHA256.test(target.sha256)
  ) refuse("reviewed target is not exact Main staging separated from production");
  return Object.freeze({
    productionBoundarySha256: boundary.sha256,
    targetDescriptorSha256: target.sha256,
  });
}

function inspectSource({
  provenance,
  gitCli,
  supabaseCli,
  runGit,
  runCli,
  environment,
  supabaseEnvironment,
  supabaseHome,
  release,
  measurement = false,
}) {
  const gitEnvironment = Object.freeze({
    ...scrubEnvironment(environment),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
  });
  const git = assertExecutable(
    gitCli,
    release.manifest.toolPins.git,
    "Git",
    runGit,
    gitEnvironment,
  );
  const supabase = assertExecutable(
    supabaseCli,
    release.manifest.toolPins.supabaseCli,
    "Supabase CLI",
    runCli,
    supabaseEnvironment,
  );
  assertSupabaseHomeUnchanged(supabaseHome);
  if (release.manifest.toolPins.supabaseCli.version !== release.manifest.supabaseCliVersion) {
    refuse("Supabase CLI release pin differs");
  }
  const node = assertExecutable(
    process.execPath,
    release.manifest.toolPins.node,
    "Node",
    runCli,
    scrubEnvironment(environment),
  );
  const archivePin = release.manifest.toolPins.supabaseArchive;
  const archiveStatus = lstatSync(archivePin.realPath);
  if (
    !archiveStatus.isFile()
    || archiveStatus.isSymbolicLink()
    || (archiveStatus.mode & 0o022) !== 0
    || realpathSync(archivePin.realPath) !== archivePin.realPath
    || sha256(readFileSync(archivePin.realPath)) !== archivePin.sha256
  ) refuse("Supabase CLI archive pin differs");
  const gitArgs = command => [
    "-c", "core.autocrlf=false",
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.ignoreCase=false",
    "-C", REPOSITORY_ROOT,
    ...command,
  ];
  const invoke = command => {
    const result = runGit(git, gitArgs(command), gitEnvironment);
    if (!successful(result)) refuse("Git source inspection failed; output withheld");
    return result.stdout;
  };
  const line = (command, label) => {
    const source = invoke(command);
    if (!/^[^\0\r\n]+(?:\n)?$/u.test(source)) refuse(`${label} output differs`);
    return source.trimEnd();
  };
  if (line(["rev-parse", "--show-toplevel"], "repository root") !== REPOSITORY_ROOT) {
    refuse("Git repository root differs");
  }
  if (line(["symbolic-ref", "--short", "HEAD"], "source branch") !== provenance.sourceBranch) {
    refuse("Git source branch differs");
  }
  const commit = line(["rev-parse", "--verify", "HEAD^{commit}"], "source commit");
  const tree = line(["rev-parse", "--verify", `${commit}^{tree}`], "source tree");
  const remote = measurement
    ? null
    : line(["rev-parse", "--verify", provenance.remoteRef], "remote commit");
  if (
    commit !== provenance.expectedCommitSha
    || tree !== provenance.expectedTreeSha
    || (!measurement && remote !== commit)
  ) refuse("source commit, tree or remote sync differs");
  const rawCommit = invoke(["cat-file", "-p", commit]);
  if (rawCommit.includes("\0") || rawCommit.includes("\r") || !rawCommit.endsWith("\n")) {
    refuse("raw source commit object differs");
  }
  const headerLines = rawCommit.split("\n\n", 1)[0].split("\n");
  const treeHeaders = headerLines.filter(row => row.startsWith("tree "));
  const parentHeaders = headerLines.filter(row => row.startsWith("parent "));
  if (
    treeHeaders.length !== 1
    || treeHeaders[0] !== `tree ${tree}`
    || parentHeaders.length !== 1
    || parentHeaders[0] !== `parent ${BASE_COMMIT_SHA}`
    || release.manifest.sourceLineage.baseCommitSha !== BASE_COMMIT_SHA
    || release.manifest.sourceLineage.baseTreeSha !== BASE_TREE_SHA
    || release.manifest.sourceLineage.requiredSoleParentSha !== BASE_COMMIT_SHA
  ) refuse("source is not the exact direct-child recovery successor");
  const changedOutput = invoke([
    "diff-tree", "--no-commit-id", "--name-status", "-r", "-z",
    BASE_TREE_SHA, tree,
  ]);
  const changedRecords = changedOutput.split("\0");
  if (changedRecords.at(-1) !== "") refuse("source changed-path output differs");
  changedRecords.pop();
  if (changedRecords.length % 2 !== 0) refuse("source changed-path arity differs");
  const changedPaths = [];
  for (let index = 0; index < changedRecords.length; index += 2) {
    const status = changedRecords[index];
    const changedPath = changedRecords[index + 1];
    if (
      !["A", "M"].includes(status)
      || typeof changedPath !== "string"
      || changedPath.length < 1
      || changedPath.includes("\n")
    ) refuse("source changed-path status differs");
    changedPaths.push(Object.freeze({ status, path: changedPath }));
  }
  changedPaths.sort((left, right) =>
    left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
  if (
    canonicalJson(changedPaths)
      !== canonicalJson(sortedChangedPaths(release.manifest.sourceLineage.changedPaths))
  ) refuse("source changed paths escape the exact additive recovery allow-list");
  const changedPathSetSha256 = sha256(changedPaths
    .map(item => `${item.status}\0${item.path}\n`).join(""));
  const trackedOutput = invoke(["ls-tree", "-r", "-z", "--name-only", commit]);
  const tracked = trackedOutput.split("\0");
  if (tracked.at(-1) !== "") refuse("tracked source listing differs");
  tracked.pop();
  if (
    tracked.length !== release.manifest.sourceLineage.expectedTrackedFileCount
    || new Set(tracked).size !== tracked.length
  ) refuse("tracked source file count differs");
  const workflow = release.manifest.sourceCi;
  const workflowOutput = invoke([
    "ls-tree", "-z", "--full-tree", commit, "--", workflow.workflowPath,
  ]);
  const workflowMatch = /^100644 blob ([0-9a-f]{40})\t([^\0]+)\0$/u.exec(workflowOutput);
  if (
    !workflowMatch
    || (!measurement && workflowMatch[1] !== workflow.workflowBlobSha)
    || workflowMatch[2] !== workflow.workflowPath
  ) refuse("source workflow blob differs");
  const index = invoke(["ls-files", "-v", "-z"]);
  const records = index.split("\0");
  if (records.at(-1) !== "") refuse("Git index output differs");
  records.pop();
  if (records.length === 0 || records.some(record => !/^H /u.test(record))) {
    refuse("Git index contains assume-unchanged, skip-worktree or non-canonical entries");
  }
  if (invoke([
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none",
  ]) !== "") refuse("Git worktree is not clean at the reviewed source");
  for (const item of release.manifest.deploymentClosureFiles) {
    const output = invoke(["ls-tree", "-z", "--full-tree", commit, "--", item.path]);
    const match = /^([0-9]{6}) blob ([0-9a-f]{40})\t([^\0]+)\0$/u.exec(output);
    if (!match || match[1] !== item.mode || match[3] !== item.path) {
      refuse(`Git deployment closure entry differs: ${item.path}`);
    }
    const bytes = readFileSync(path.join(REPOSITORY_ROOT, item.path));
    const blob = createHash("sha1")
      .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
      .update(bytes)
      .digest("hex");
    if (blob !== match[2] || sha256(bytes) !== item.sha256) {
      refuse(`Git deployment closure bytes differ: ${item.path}`);
    }
  }
  if (
    line(["rev-parse", "--verify", "HEAD^{commit}"], "final source commit") !== commit
    || line(["rev-parse", "--verify", `${commit}^{tree}`], "final source tree") !== tree
  ) refuse("Git source changed during inspection");
  return Object.freeze({
    commit,
    tree,
    parent: BASE_COMMIT_SHA,
    baseTree: BASE_TREE_SHA,
    changedPaths: Object.freeze(changedPaths),
    changedPathSetSha256,
    trackedFileCount: tracked.length,
    workflowBlobSha: workflowMatch[1],
    git,
    node,
    supabase,
    supabaseArchiveSha256: archivePin.sha256,
  });
}

function inspectMeasurementSource({
  gitCli,
  supabaseCli,
  runGit,
  runCli,
  environment,
  supabaseEnvironment,
  supabaseHome,
  release,
}) {
  const gitEnvironment = Object.freeze({
    ...scrubEnvironment(environment),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
  });
  const git = assertExecutable(
    gitCli,
    release.manifest.toolPins.git,
    "Git",
    runGit,
    gitEnvironment,
  );
  const supabase = assertExecutable(
    supabaseCli,
    release.manifest.toolPins.supabaseCli,
    "Supabase CLI",
    runCli,
    supabaseEnvironment,
  );
  assertSupabaseHomeUnchanged(supabaseHome);
  const node = assertExecutable(
    process.execPath,
    release.manifest.toolPins.node,
    "Node",
    runCli,
    scrubEnvironment(environment),
  );
  const archivePin = release.manifest.toolPins.supabaseArchive;
  const archiveStatus = lstatSync(archivePin.realPath);
  if (
    !archiveStatus.isFile() || archiveStatus.isSymbolicLink()
    || (archiveStatus.mode & 0o022) !== 0
    || realpathSync(archivePin.realPath) !== archivePin.realPath
    || sha256(readFileSync(archivePin.realPath)) !== archivePin.sha256
  ) refuse("Supabase CLI archive pin differs");
  const gitArgs = command => [
    "-c", "core.autocrlf=false",
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.ignoreCase=false",
    "-C", REPOSITORY_ROOT,
    ...command,
  ];
  const invoke = command => {
    const result = runGit(git, gitArgs(command), gitEnvironment);
    if (!successful(result)) refuse("Git measurement inspection failed; output withheld");
    return result.stdout;
  };
  const line = (command, label) => {
    const output = invoke(command);
    if (!/^[^\0\r\n]+(?:\n)?$/u.test(output)) refuse(`${label} output differs`);
    return output.trimEnd();
  };
  if (
    line(["rev-parse", "--show-toplevel"], "measurement repository root")
      !== REPOSITORY_ROOT
    || line(["symbolic-ref", "--short", "HEAD"], "measurement branch")
      !== release.manifest.sourceBranch
  ) refuse("catalog measurement repository or branch differs");
  const commit = line(["rev-parse", "--verify", "HEAD^{commit}"], "measurement commit");
  const tree = line(["rev-parse", "--verify", `${commit}^{tree}`], "measurement tree");
  if (
    commit !== BASE_COMMIT_SHA || tree !== BASE_TREE_SHA
  ) refuse("catalog measurement must run on the exact reviewed base commit");
  const rawCommit = invoke(["cat-file", "-p", commit]);
  const headers = rawCommit.split("\n\n", 1)[0].split("\n");
  const parentHeaders = headers.filter(row => row.startsWith("parent "));
  if (
    !rawCommit.endsWith("\n") || rawCommit.includes("\0") || rawCommit.includes("\r")
    || headers.filter(row => row === `tree ${BASE_TREE_SHA}`).length !== 1
    || parentHeaders.length !== 1 || !/^parent [0-9a-f]{40}$/u.test(parentHeaders[0])
  ) refuse("catalog measurement raw base commit differs");
  const statusOutput = invoke([
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none",
  ]);
  const records = statusOutput.split("\0");
  if (records.at(-1) !== "") refuse("catalog measurement worktree status differs");
  records.pop();
  const allowed = new Map(release.manifest.sourceLineage.changedPaths.map(item => [
    item.path,
    item.status,
  ]));
  const workingPaths = [];
  for (const record of records) {
    const match = /^(.{2}) (.+)$/u.exec(record);
    if (!match || match[2].includes("\n")) refuse("catalog measurement status row differs");
    const expectedStatus = MEASUREMENT_GIT_STATUS[match[1]];
    if (
      expectedStatus === undefined
      || allowed.get(match[2]) !== expectedStatus
    ) refuse("catalog measurement worktree escapes the reviewed successor allow-list");
    const file = path.join(REPOSITORY_ROOT, match[2]);
    const fileStatus = lstatSync(file);
    if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
      refuse("catalog measurement changed path is not a regular file");
    }
    workingPaths.push(Object.freeze({
      status: expectedStatus,
      path: match[2],
      sha256: sha256(readFileSync(file)),
    }));
  }
  workingPaths.sort((left, right) => left.path.localeCompare(right.path));
  if (
    canonicalJson(workingPaths.map(({ status, path: changedPath }) => ({
      status,
      path: changedPath,
    }))) !== canonicalJson(sortedChangedPaths(release.manifest.sourceLineage.changedPaths))
  ) refuse("catalog measurement worktree differs from the exact reviewed successor allow-list");
  const workflowOutput = invoke([
    "ls-tree", "-z", "--full-tree", commit, "--", release.manifest.sourceCi.workflowPath,
  ]);
  const workflowMatch = /^100644 blob ([0-9a-f]{40})\t([^\0]+)\0$/u.exec(workflowOutput);
  if (!workflowMatch) refuse("catalog measurement base workflow blob differs");
  const trackedRecords = invoke(["ls-files", "-z"]).split("\0");
  if (trackedRecords.at(-1) !== "") refuse("catalog measurement tracked listing differs");
  trackedRecords.pop();
  return Object.freeze({
    commit,
    tree,
    parent: parentHeaders[0].slice(7),
    baseTree: BASE_TREE_SHA,
    changedPaths: Object.freeze(workingPaths.map(({ status, path: changedPath }) => ({
      status,
      path: changedPath,
    }))),
    changedPathSetSha256: sha256(workingPaths.map(item =>
      `${item.status}\0${item.path}\0${item.sha256}\n`).join("")),
    trackedFileCount: trackedRecords.length,
    workflowBlobSha: workflowMatch[1],
    git,
    node,
    supabase,
    supabaseArchiveSha256: archivePin.sha256,
  });
}

function manifestPathRelative() {
  return "supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json";
}

function inspectSourceCi({
  provenance,
  source,
  ghCli,
  runGh,
  environment,
  release,
  ghLocalState,
}) {
  const ghConfigDirectory = assertGhConfigBoundary();
  assertGhLocalStateUnchanged(ghLocalState);
  const ghEnvironment = Object.freeze({
    ...scrubEnvironment(environment),
    GH_CONFIG_DIR: ghConfigDirectory,
    GH_HOST: "github.com",
    GH_PROMPT_DISABLED: "1",
    GH_PAGER: "cat",
    GH_TELEMETRY: "0",
    GH_NO_UPDATE_NOTIFIER: "1",
    PAGER: "cat",
    DO_NOT_TRACK: "1",
    NO_COLOR: "1",
    XDG_STATE_HOME: ghLocalState.state,
    XDG_CACHE_HOME: ghLocalState.cache,
    XDG_DATA_HOME: ghLocalState.data,
  });
  const guardedRunGh = (executable, args, commandEnvironment) => {
    assertGhLocalStateUnchanged(ghLocalState);
    try {
      return runGh(executable, args, commandEnvironment);
    } finally {
      assertGhLocalStateUnchanged(ghLocalState);
    }
  };
  const gh = assertExecutable(
    ghCli,
    release.manifest.toolPins.gh,
    "GitHub CLI",
    guardedRunGh,
    ghEnvironment,
  );
  const invokeApi = (endpoint, label) => {
    let result;
    try {
      result = guardedRunGh(gh, [
        "api",
        "--method", "GET",
        "-H", "Accept: application/vnd.github+json",
        "-H", "X-GitHub-Api-Version: 2022-11-28",
        endpoint,
      ], ghEnvironment);
    } catch {
      refuse(`${label} live GitHub query failed; output withheld`);
    }
    if (!successful(result) || Buffer.byteLength(result.stdout, "utf8") > 2 * 1024 * 1024) {
      refuse(`${label} live GitHub query failed; output withheld`);
    }
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      refuse(`${label} live GitHub JSON differs`);
    }
    return Object.freeze({
      value,
      sha256: sha256(canonicalJson(value)),
    });
  };
  const branch = invokeApi(
    `repos/${GITHUB_REPOSITORY}/git/ref/heads/${encodeURIComponent(provenance.sourceBranch)}`,
    "live release branch",
  );
  if (
    branch.value?.ref !== `refs/heads/${provenance.sourceBranch}`
    || branch.value?.object?.type !== "commit"
    || branch.value?.object?.sha !== source.commit
  ) refuse("live release branch no longer points to the reviewed source commit");
  const base = `repos/${GITHUB_REPOSITORY}/actions/runs/${provenance.githubRunId}`;
  const run = invokeApi(base, "source CI run");
  const value = run.value;
  if (
    value === null || typeof value !== "object" || Array.isArray(value)
    || String(value.id) !== provenance.githubRunId
    || value.head_sha !== source.commit
    || value.head_branch !== provenance.sourceBranch
    || value.path !== release.manifest.sourceCi.workflowPath
    || value.event !== "push"
    || value.status !== "completed"
    || value.conclusion !== "success"
    || value.run_attempt !== 1
    || value.repository?.full_name !== GITHUB_REPOSITORY
    || !canonicalTimestamp(value.created_at)
    || !canonicalTimestamp(value.updated_at)
  ) refuse("live source CI run is not the exact successful same-SHA workflow");
  const jobs = invokeApi(`${base}/jobs?filter=latest&per_page=100`, "source CI jobs");
  if (
    jobs.value === null || typeof jobs.value !== "object" || Array.isArray(jobs.value)
    || jobs.value.total_count !== 1 || !Array.isArray(jobs.value.jobs)
    || jobs.value.jobs.length !== 1
  ) refuse("live source CI job cardinality differs");
  const job = jobs.value.jobs[0];
  if (
    job.name !== release.manifest.sourceCi.jobName
    || job.head_sha !== source.commit
    || job.status !== "completed"
    || job.conclusion !== "success"
    || job.run_attempt !== 1
    || !Number.isSafeInteger(job.id)
    || !canonicalTimestamp(job.started_at)
    || !canonicalTimestamp(job.completed_at)
    || !Array.isArray(job.steps)
  ) refuse("live source CI required job differs");
  let previousStepNumber = 0;
  for (const name of release.manifest.sourceCi.requiredSuccessfulSteps) {
    const step = job.steps.find(item => item?.name === name);
    if (
      !step || step.status !== "completed" || step.conclusion !== "success"
      || !Number.isSafeInteger(step.number) || step.number <= previousStepNumber
    ) refuse(`live source CI required step differs: ${name}`);
    previousStepNumber = step.number;
  }
  assertGhLocalStateUnchanged(ghLocalState);
  return Object.freeze({
    provider: "github-actions-live-api",
    repository: GITHUB_REPOSITORY,
    workflowPath: release.manifest.sourceCi.workflowPath,
    workflowBlobSha: source.workflowBlobSha,
    branchApiSha256: branch.sha256,
    runId: provenance.githubRunId,
    runApiSha256: run.sha256,
    jobsApiSha256: jobs.sha256,
    jobId: String(job.id),
    event: "push",
    headSha: source.commit,
    conclusion: "success",
    completedAt: job.completed_at,
  });
}

function readAccessToken(file) {
  const source = readPrivateFile(file, "Management access token", 4097);
  const value = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (!ACCESS_TOKEN.test(value) || /[\r\n]/u.test(value)) {
    refuse("Management access token format differs");
  }
  return value;
}

function parseSecretInventory(result, projectRef) {
  if (!successful(result)) {
    refuse(`read-only secret inventory failed for staging ${projectRef}; output withheld`);
  }
  let rows;
  try {
    rows = JSON.parse(result.stdout);
  } catch {
    refuse(`read-only secret inventory JSON differs for staging ${projectRef}`);
  }
  if (!Array.isArray(rows)) refuse("secret inventory is not an array");
  const inventory = new Map();
  for (const row of rows) {
    exactKeys(row, ["name", "updated_at", "value"], "secret inventory row");
    if (
      typeof row.name !== "string"
      || !SECRET_NAME.test(row.name)
      || typeof row.value !== "string"
      || !SHA256.test(row.value)
      || !canonicalTimestamp(row.updated_at)
      || inventory.has(row.name)
    ) refuse("secret inventory row differs");
    inventory.set(row.name, Object.freeze({
      name: row.name,
      value: row.value,
      updatedAt: row.updated_at,
    }));
  }
  return inventory;
}

function inventoryCore(inventory) {
  return [...inventory.values()]
    .sort((left, right) => left.name.localeCompare(right.name));
}

function semanticSecretInventorySha256(inventory) {
  return sha256(canonicalJson(inventoryCore(inventory).map(row => ({
    name: row.name,
    value: row.value,
  }))));
}

function inventoryWithoutNames(inventory, excludedNames) {
  return new Map([...inventory].filter(([name]) => !excludedNames.includes(name)));
}

function metadataOnlyInventoryDelta(before, after) {
  if (!inventoryHasExactNameSet(before, after)) {
    refuse("metadata-only inventory delta row set differs");
  }
  const rows = [];
  for (const [name, previous] of before) {
    const current = after.get(name);
    if (current.value !== previous.value) {
      refuse("metadata-only inventory delta contains secret value drift");
    }
    if (current.updatedAt !== previous.updatedAt) {
      if (!SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name)) {
        refuse("secret metadata drift is outside the exact successor allow-list");
      }
      rows.push(Object.freeze({
        name,
        beforeUpdatedAt: previous.updatedAt,
        afterUpdatedAt: current.updatedAt,
      }));
    }
  }
  rows.sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze({
    names: Object.freeze(rows.map(row => row.name)),
    rows: Object.freeze(rows),
    sha256: sha256(canonicalJson(rows)),
  });
}

function cliBoundaryState(dependencies, mutation) {
  let homeDrift = false;
  let toolDrift = false;
  try {
    assertSupabaseHomeUnchanged(dependencies.supabaseHome);
  } catch {
    homeDrift = true;
  }
  if (mutation) {
    try {
      toolDrift = canonicalJson(captureSealedSupabaseCliMutationInput(dependencies.supabase))
        !== canonicalJson(dependencies.supabaseMutationInput);
    } catch {
      toolDrift = true;
    }
  }
  return Object.freeze({ homeDrift, toolDrift });
}

function invokeCli(dependencies, args, { mutation = false } = {}) {
  let result;
  const before = cliBoundaryState(dependencies, mutation);
  if (before.homeDrift || before.toolDrift) {
    return Object.freeze({
      status: null,
      signal: null,
      error: null,
      stdout: "",
      outcome: "refused",
      homeDrift: before.homeDrift,
      toolDrift: before.toolDrift,
      cliInvoked: false,
    });
  }
  try {
    result = dependencies.runCli(
      dependencies.supabase,
      args,
      dependencies.cliEnvironment,
    );
  } catch {
    return null;
  }
  const after = cliBoundaryState(dependencies, mutation);
  if (after.homeDrift || after.toolDrift) {
    return Object.freeze({
      status: null,
      signal: null,
      error: null,
      stdout: "",
      outcome: "unknown",
      homeDrift: after.homeDrift,
      toolDrift: after.toolDrift,
      cliInvoked: true,
    });
  }
  return result;
}

function fetchSecretInventories(dependencies, phase = "recovery") {
  if (!["recovery", "access"].includes(phase)) refuse("secret inventory phase differs");
  const inventories = {};
  for (const projectRef of [FINANCE_REF, MAIN_REF]) {
    if (PRODUCTION_REFS.includes(projectRef)) refuse("production reached secret inventory");
    const result = invokeCli(dependencies, [
      "secrets",
      "list",
      "--project-ref",
      projectRef,
      "--output",
      "json",
      "--log-level",
      "error",
    ]);
    inventories[projectRef] = parseSecretInventory(result, projectRef);
  }
  const disabledSha256 = sha256("disabled");
  const enabledSha256 = sha256("enabled");
  const recoveryVectors = Object.freeze([
    Object.freeze({
      FINANCE_ENTITLEMENT_SYNC_MODE: disabledSha256,
      FINANCE_ENTITLEMENT_V2_SYNC_MODE: enabledSha256,
      FINANCE_TELEGRAM_PROTOCOL_MODE: disabledSha256,
      MAIN_FINANCE_SYNC_MODE: disabledSha256,
      MAIN_FINANCE_PROTOCOL_MODE: disabledSha256,
    }),
    Object.freeze({
      FINANCE_ENTITLEMENT_SYNC_MODE: disabledSha256,
      FINANCE_ENTITLEMENT_V2_SYNC_MODE: disabledSha256,
      FINANCE_TELEGRAM_PROTOCOL_MODE: disabledSha256,
      MAIN_FINANCE_SYNC_MODE: disabledSha256,
      MAIN_FINANCE_PROTOCOL_MODE: disabledSha256,
    }),
  ]);
  const accessVector = Object.freeze({
    FINANCE_ENTITLEMENT_SYNC_MODE: disabledSha256,
    FINANCE_ENTITLEMENT_V2_SYNC_MODE: enabledSha256,
    FINANCE_TELEGRAM_PROTOCOL_MODE: enabledSha256,
    MAIN_FINANCE_SYNC_MODE: enabledSha256,
    MAIN_FINANCE_PROTOCOL_MODE: enabledSha256,
  });
  const allowedVectors = phase === "recovery" ? recoveryVectors : [accessVector];
  const gateRows = [];
  for (const gate of GATES) {
    const row = inventories[gate.projectRef].get(gate.name);
    if (!row) refuse(`gate ${gate.name} is absent`);
    gateRows.push(Object.freeze({
      projectRef: gate.projectRef,
      name: gate.name,
      valueSha256: row.value,
      updatedAt: row.updatedAt,
    }));
  }
  if (!allowedVectors.some(vector =>
    GATES.every(gate => inventories[gate.projectRef].get(gate.name).value === vector[gate.name]))) {
    refuse(`gate vector is outside the exact ${phase} phase contract`);
  }
  const privacy = inventories[MAIN_REF].get("MAIN_FINANCE_PRIVACY_HMAC_KEY");
  if (!privacy) refuse("legacy Main privacy secret inventory row is absent");
  return Object.freeze({
    main: inventories[MAIN_REF],
    finance: inventories[FINANCE_REF],
    mainInventorySha256: sha256(canonicalJson(inventoryCore(inventories[MAIN_REF]))),
    financeInventorySha256: sha256(canonicalJson(inventoryCore(inventories[FINANCE_REF]))),
    gateInventorySha256: sha256(canonicalJson({ phase, gates: gateRows })),
    gatePhase: phase,
    privacyInventorySha256: sha256(canonicalJson({
      projectRef: MAIN_REF,
      name: privacy.name,
      valueSha256: privacy.value,
      updatedAt: privacy.updatedAt,
    })),
  });
}

function moduleInventoryRows(inventory) {
  return inventoryCore(inventory).map(row => Object.freeze({
    name: row.name,
    value: row.value,
    updated_at: row.updatedAt,
  }));
}

async function buildCurrentSnapshot(dependencies, release, source, inventories, phase) {
  return buildSnapshotFromFrozenModule({
    phase,
    accessToken: dependencies.accessToken,
    fetchImpl: dependencies.fetchImpl,
    preflightSql: release.preflightSql,
    preflightSqlSha256: release.preflightSqlSha256,
    expectedCatalogSha256: release.manifest.expectedDatabaseCatalogSha256,
    releaseManifestSha256: release.manifestSha256,
    sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
    sourceCommitSha: source.commit,
    sourceTreeSha: source.tree,
    mainSecretInventoryRows: moduleInventoryRows(inventories.main),
    financeSecretInventoryRows: moduleInventoryRows(inventories.finance),
    now: dependencies.now,
  });
}

function normalizeFunctionInventoryRows(rows) {
  if (!Array.isArray(rows)) refuse("function inventory is not an array");
  const normalized = [];
  const slugs = new Set();
  const ids = new Set();
  for (const row of rows) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      refuse("function inventory row differs");
    }
    const slug = row.slug;
    if (
      !Object.hasOwn(row, "slug")
      || typeof slug !== "string"
      || !/^[a-z][a-z0-9-]{0,127}$/u.test(slug)
      || slugs.has(slug)
    ) refuse("function inventory slug differs");
    slugs.add(slug);
    if (
      !Object.hasOwn(row, "id")
      || typeof row.id !== "string"
      || !UUID.test(row.id)
      || ids.has(row.id)
    ) refuse("function inventory id differs");
    ids.add(row.id);
    if (
      !Object.hasOwn(row, "name")
      || typeof row.name !== "string"
      || row.name !== slug
    ) refuse("function inventory name differs");
    if (
      !Object.hasOwn(row, "ezbr_sha256")
      || typeof row.ezbr_sha256 !== "string"
      || !SHA256.test(row.ezbr_sha256)
    ) refuse("function inventory ezbr_sha256 differs");
    if (
      !Object.hasOwn(row, "entrypoint_path")
      || typeof row.entrypoint_path !== "string"
      || !/^file:\/\/\/[^\0\r\n]+\.ts$/u.test(row.entrypoint_path)
    ) refuse("function inventory entrypoint_path differs");
    if (!Object.hasOwn(row, "verify_jwt") || typeof row.verify_jwt !== "boolean") {
      refuse("function inventory verify_jwt differs");
    }
    if (
      !Object.hasOwn(row, "status")
      || typeof row.status !== "string"
      || !["ACTIVE", "active", "INACTIVE", "inactive"].includes(row.status)
    ) {
      refuse("function inventory status differs");
    }
    if (
      !Object.hasOwn(row, "version")
      || !Number.isSafeInteger(row.version)
      || row.version <= 0
    ) {
      refuse("function inventory deployment version differs");
    }
    if (
      !Object.hasOwn(row, "created_at")
      || !Number.isSafeInteger(row.created_at)
      || row.created_at <= 0
      || !Object.hasOwn(row, "updated_at")
      || !Number.isSafeInteger(row.updated_at)
      || row.updated_at < row.created_at
    ) refuse("function inventory timestamps differ");
    normalized.push(JSON.parse(canonicalJson(row)));
  }
  normalized.sort((left, right) =>
    String(left.slug ?? left.name).localeCompare(String(right.slug ?? right.name)));
  const targetRows = normalized.filter(row => (row.slug ?? row.name) === FUNCTION_NAME);
  if (targetRows.length > 1) refuse("target function is duplicated");
  return Object.freeze({
    rows: Object.freeze(normalized),
    sha256: sha256(canonicalJson(normalized)),
    target: targetRows[0] ?? null,
  });
}

function parseFunctionInventory(result) {
  if (!successful(result)) {
    refuse("read-only function inventory failed for Main staging; output withheld");
  }
  let rows;
  try {
    rows = JSON.parse(result.stdout);
  } catch {
    refuse("read-only function inventory JSON differs");
  }
  return normalizeFunctionInventoryRows(rows);
}

function fetchFunctionInventory(dependencies) {
  return parseFunctionInventory(invokeCli(dependencies, [
    "functions",
    "list",
    "--project-ref",
    MAIN_REF,
    "--output",
    "json",
    "--log-level",
    "error",
  ]));
}

async function boundedResponseText(response, maximumBytes, label) {
  if (!response?.body || typeof response.body.getReader !== "function") {
    refuse(`${label} response body differs`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        refuse(`${label} response exceeded the byte limit`);
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Main Finance runtime recovery v2 refused:")) {
      throw error;
    }
    refuse(`${label} response read failed`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    refuse(`${label} response encoding differs`);
  }
}

function edgeRequest(snapshot) {
  return buildMainFinanceRuntimeRecoveryAttestRequest(snapshot);
}

function runtimeRows({ release, source, snapshot, operatorSecret, triggerSecret }) {
  const values = Object.freeze({
    MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2: operatorSecret,
    MAIN_FINANCE_SYNC_TRIGGER_SECRET: triggerSecret,
    MAIN_FINANCE_ACCESS_V2_MODE: "enabled",
    MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256:
      release.manifest.deploymentClosureSetSha256,
    MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA: source.commit,
    MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA: source.tree,
    MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256: release.manifestSha256,
    MAIN_FINANCE_ACCESS_V2_PREFLIGHT_SQL_SHA256: release.preflightSqlSha256,
    MAIN_FINANCE_ACCESS_V2_CATALOG_SHA256: snapshot.catalog_sha256,
    MAIN_FINANCE_ACCESS_V2_PRIVACY_INVENTORY_SHA256:
      snapshot.privacy_secret_inventory_sha256,
    MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL:
      `https://${FINANCE_REF}.supabase.co/functions/v1/finance-apply-entitlement-event-v2`,
    MAIN_FINANCE_ENTITLEMENT_CANONICAL_PATH:
      "/functions/v1/finance-apply-entitlement-event-v2",
    MAIN_FINANCE_PRODUCT_CODE: "architecture_finance",
  });
  const managedNames = [
    ...release.environment.generatedSecrets.map(item => item.name),
    ...release.environment.stableRuntimeConfig,
  ];
  const mutationNames = release.environment.schemaVersion === 3
    ? SUCCESSOR_SECRET_MUTATION_NAMES
    : Object.keys(values);
  if (
    canonicalJson(Object.keys(values)) !== canonicalJson(managedNames)
    || mutationNames.some(name =>
      release.environment.forbiddenSecretMutations.includes(name))
    || Object.hasOwn(values, "MAIN_FINANCE_PRIVACY_HMAC_KEY")
    || !GENERATED_SECRET.test(operatorSecret)
    || !GENERATED_SECRET.test(triggerSecret)
    || operatorSecret === triggerSecret
  ) refuse("runtime installation allow-list differs");
  const sourceText = `${managedNames.map(name => `${name}=${values[name]}`).join("\n")}\n`;
  return Object.freeze({ values, names: Object.freeze(managedNames), source: sourceText });
}

function successorSecretMutationRows(runtime) {
  const values = Object.freeze(Object.fromEntries(
    SUCCESSOR_SECRET_MUTATION_NAMES.map(name => [name, runtime.values[name]]),
  ));
  if (
    canonicalJson(Object.keys(values))
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
  ) refuse("successor secret mutation allow-list differs");
  const source = `${SUCCESSOR_SECRET_MUTATION_NAMES
    .map(name => `${name}=${values[name]}`).join("\n")}\n`;
  return Object.freeze({
    values,
    names: SUCCESSOR_SECRET_MUTATION_NAMES,
    source,
  });
}

function validSuccessorMutationSecretDigestMap(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...SUCCESSOR_SECRET_MUTATION_NAMES].sort())
    && SUCCESSOR_SECRET_MUTATION_NAMES.every(name =>
      SHA256.test(value[name] ?? ""));
}

function writePrivateBytes(file, bytes) {
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
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o600) {
      refuse("private binary write boundary differs");
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readPinnedExecutableBytes(file, pin) {
  const before = lstatSync(file, { bigint: true });
  if (
    file !== pin.realPath
    || !before.isFile()
    || before.isSymbolicLink()
    || before.nlink !== 1n
    || Number(before.mode & 0o111n) === 0
    || Number(before.mode & 0o022n) !== 0
    || realpathSync(file) !== file
  ) refuse("Supabase CLI source filesystem boundary differs");
  let descriptor;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== before.dev || opened.ino !== before.ino
      || opened.size !== before.size || opened.mtimeNs !== before.mtimeNs
      || opened.ctimeNs !== before.ctimeNs
    ) refuse("Supabase CLI source changed while opening");
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== opened.dev || after.ino !== opened.ino
      || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs
      || after.ctimeNs !== opened.ctimeNs || sha256(bytes) !== pin.sha256
    ) refuse("Supabase CLI source bytes differ");
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeSealedExecutable(file, bytes) {
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | (fsConstants.O_NOFOLLOW ?? 0),
      0o500,
    );
    fchmodSync(descriptor, 0o500);
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (
      !status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o500
      || sha256(bytes) !== FROZEN_TOOL_PINS.supabaseCli.sha256
    ) refuse("sealed Supabase CLI write boundary differs");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function captureSealedSupabaseCliMutationInput(file) {
  const directory = path.dirname(file);
  const directoryStatus = lstatSync(directory, { bigint: true });
  if (
    path.basename(file) !== SEALED_SUPABASE_CLI_FILE
    || path.basename(directory) !== SEALED_SUPABASE_CLI_DIRECTORY
    || !directoryStatus.isDirectory()
    || directoryStatus.isSymbolicLink()
    || Number(directoryStatus.mode & 0o777n) !== 0o500
    || realpathSync(directory) !== directory
    || canonicalJson(readdirSync(directory)) !== canonicalJson([SEALED_SUPABASE_CLI_FILE])
    || (typeof process.getuid === "function"
      && directoryStatus.uid !== BigInt(process.getuid()))
  ) refuse("sealed Supabase CLI directory boundary differs");
  return Object.freeze({
    path: file,
    ...exactFsRecord(file, 0o500, FROZEN_TOOL_PINS.supabaseCli.sha256),
  });
}

function prepareSealedSupabaseCli(stateDirectory, sourceFile, allowCreate) {
  const directory = path.join(stateDirectory, SEALED_SUPABASE_CLI_DIRECTORY);
  const file = path.join(directory, SEALED_SUPABASE_CLI_FILE);
  if (!existsSync(directory)) {
    if (!allowCreate) refuse("sealed Supabase CLI is missing from held state");
    mkdirSync(directory, { mode: 0o700 });
    chmodSync(directory, 0o700);
    writeSealedExecutable(
      file,
      readPinnedExecutableBytes(sourceFile, FROZEN_TOOL_PINS.supabaseCli),
    );
    fsyncDirectory(directory);
    chmodSync(directory, 0o500);
    fsyncDirectory(directory);
    fsyncDirectory(stateDirectory);
  }
  return Object.freeze({
    file,
    input: captureSealedSupabaseCliMutationInput(file),
  });
}

function readFrozenClosureBytes(item) {
  const file = path.join(REPOSITORY_ROOT, item.path);
  const before = lstatSync(file, { bigint: true });
  if (
    !before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
    || Number(before.mode & 0o777n) !== 0o644
    || realpathSync(file) !== file
  ) refuse(`source closure filesystem boundary differs: ${item.path}`);
  let descriptor;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== before.dev || opened.ino !== before.ino
      || opened.size !== before.size || opened.mtimeNs !== before.mtimeNs
      || opened.ctimeNs !== before.ctimeNs
    ) refuse(`source closure changed while opening: ${item.path}`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== opened.dev || after.ino !== opened.ino
      || after.size !== opened.size || after.mtimeNs !== opened.mtimeNs
      || after.ctimeNs !== opened.ctimeNs || sha256(bytes) !== item.sha256
    ) refuse(`source closure bytes differ: ${item.path}`);
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function buildArchive(release) {
  const chunks = [Buffer.from("main-finance-source-archive-v2\0", "utf8")];
  for (const item of release.manifest.deploymentClosureFiles) {
    const bytes = readFrozenClosureBytes(item);
    chunks.push(Buffer.from(`${item.path}\0${item.mode}\0${bytes.length}\0`, "utf8"));
    chunks.push(bytes);
    chunks.push(Buffer.from("\0", "utf8"));
  }
  return Buffer.concat(chunks);
}

function fsyncRegularFile(file) {
  let descriptor;
  try {
    descriptor = openSync(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.nlink !== 1) {
      refuse("bundle file durability boundary differs");
    }
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function createDeployWorkdir(stateDirectory, release) {
  const workdir = path.join(stateDirectory, DEPLOY_WORKDIR);
  mkdirSync(workdir, { mode: 0o700 });
  chmodSync(workdir, 0o700);
  const directories = new Set([workdir]);
  for (const item of release.manifest.deploymentClosureFiles) {
    const destination = path.join(workdir, item.path);
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    let parent = path.dirname(destination);
    while (parent.startsWith(`${workdir}${path.sep}`)) {
      directories.add(parent);
      parent = path.dirname(parent);
    }
    for (const directory of directories) chmodSync(directory, 0o700);
    copyFileSync(path.join(REPOSITORY_ROOT, item.path), destination);
    chmodSync(destination, 0o644);
    if (sha256(readFileSync(destination)) !== item.sha256) {
      refuse(`deploy workdir copy differs: ${item.path}`);
    }
    fsyncRegularFile(destination);
  }
  for (const directory of [...directories]
    .sort((left, right) => right.split(path.sep).length - left.split(path.sep).length)) {
    fsyncDirectory(directory);
  }
  return workdir;
}

function exactFsRecord(file, expectedMode, expectedSha256 = null) {
  const status = lstatSync(file, { bigint: true });
  if (
    status.isSymbolicLink()
    || (expectedSha256 === null ? !status.isDirectory() : !status.isFile())
    || (expectedSha256 !== null && status.nlink !== 1n)
    || Number(status.mode & 0o777n) !== expectedMode
    || realpathSync(file) !== file
    || (typeof process.getuid === "function"
      && status.uid !== BigInt(process.getuid()))
  ) refuse("mutation input filesystem boundary differs");
  const digest = expectedSha256 === null ? null : sha256(readFileSync(file));
  if (expectedSha256 !== null && digest !== expectedSha256) {
    refuse("mutation input bytes differ");
  }
  return Object.freeze({
    mode: expectedMode.toString(8).padStart(4, "0"),
    dev: status.dev.toString(),
    ino: status.ino.toString(),
    nlink: status.nlink.toString(),
    size: status.size.toString(),
    mtimeNs: status.mtimeNs.toString(),
    ctimeNs: status.ctimeNs.toString(),
    sha256: digest,
  });
}

function captureRuntimeMutationInput(runtimeFile, expectedSha256) {
  return Object.freeze({
    path: runtimeFile,
    ...exactFsRecord(runtimeFile, 0o600, expectedSha256),
  });
}

function captureDeployMutationInput(workdir, release) {
  const expectedFiles = new Map(release.manifest.deploymentClosureFiles.map(item => [
    item.path,
    item.sha256,
  ]));
  const expectedDirectories = new Set([""]);
  for (const item of release.manifest.deploymentClosureFiles) {
    let parent = path.dirname(item.path);
    while (parent !== ".") {
      expectedDirectories.add(parent);
      parent = path.dirname(parent);
    }
  }
  const records = [];
  const walk = (directory, relative) => {
    if (!expectedDirectories.has(relative)) refuse("deploy workdir contains an extra directory");
    records.push(Object.freeze({
      path: relative === "" ? "." : relative,
      kind: "directory",
      ...exactFsRecord(directory, 0o700),
    }));
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(child, childRelative);
      } else if (entry.isFile() && expectedFiles.has(childRelative)) {
        records.push(Object.freeze({
          path: childRelative,
          kind: "file",
          ...exactFsRecord(child, 0o644, expectedFiles.get(childRelative)),
        }));
      } else {
        refuse("deploy workdir contains an extra or unsafe entry");
      }
    }
  };
  walk(workdir, "");
  const actualFiles = records.filter(record => record.kind === "file").map(record => record.path);
  if (canonicalJson(actualFiles) !== canonicalJson([...expectedFiles.keys()])) {
    refuse("deploy workdir exact file set differs");
  }
  return Object.freeze(records);
}

function mutationInputRecordsMatch(expected, current) {
  return canonicalJson(current) === canonicalJson(expected);
}

function assertMutationInputUnchanged(bundle, release, mutation) {
  if (mutation === "secrets-set") {
    return mutationInputRecordsMatch(bundle.runtimeMutationInput, captureRuntimeMutationInput(
      bundle.secretMutationFile ?? bundle.runtimeFile,
      bundle.attestation.runtimeMutationFileSha256
        ?? bundle.attestation.runtimeFileSha256,
    ));
  }
  if (mutation === "function-deploy") {
    return mutationInputRecordsMatch(
      bundle.deployMutationInput,
      captureDeployMutationInput(bundle.workdir, release),
    );
  }
  refuse("mutation input kind differs");
}

function mutationInputIsUnchanged(bundle, release, mutation) {
  try {
    return assertMutationInputUnchanged(bundle, release, mutation) === true;
  } catch {
    return false;
  }
}

function selectGeneratedRuntimeSecrets({
  release,
  inventories,
  randomBytesImpl,
  generatedSecretValues,
  expectedGeneratedSecretDigestSetSha256,
}) {
  const generatedNames = release.environment.generatedSecrets.map(item => item.name);
  if (canonicalJson(generatedNames) !== canonicalJson([
    "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ])) refuse("generated secret adoption manifest differs");
  if (generatedSecretValues !== null) {
    exactKeys(generatedSecretValues, generatedNames, "adopted generated secret values");
    const adoptedDigestSet = Object.fromEntries(generatedNames.map(name => [
      name,
      sha256(generatedSecretValues[name]),
    ]));
    if (
      sha256(canonicalJson(adoptedDigestSet))
        !== expectedGeneratedSecretDigestSetSha256
    ) refuse("adopted generated secret digest subset differs from predecessor evidence");
  }
  const operatorSecret = generatedSecretValues === null
    ? randomBytesImpl(48).toString("base64url")
    : generatedSecretValues.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2;
  const triggerSecret = generatedSecretValues === null
    ? randomBytesImpl(48).toString("base64url")
    : generatedSecretValues.MAIN_FINANCE_SYNC_TRIGGER_SECRET;
  const knownSecretDigests = new Set([
    ...inventoryCore(inventories.main).map(item => item.value),
    ...inventoryCore(inventories.finance).map(item => item.value),
  ]);
  if (
    !GENERATED_SECRET.test(operatorSecret)
    || !GENERATED_SECRET.test(triggerSecret)
    || operatorSecret === triggerSecret
    || (generatedSecretValues === null
      && (knownSecretDigests.has(sha256(operatorSecret))
        || knownSecretDigests.has(sha256(triggerSecret))))
    || (generatedSecretValues !== null
      && (!knownSecretDigests.has(sha256(operatorSecret))
        || !knownSecretDigests.has(sha256(triggerSecret))))
  ) refuse("generated runtime secrets are not fresh and separated");
  return Object.freeze({ operatorSecret, triggerSecret });
}

function resolveGeneratedRuntimeSecrets({
  release,
  inventories,
  randomBytesImpl,
  generatedSecretValues,
  predecessorAdoption,
}) {
  if (generatedSecretValues !== null && predecessorAdoption === null) {
    refuse("generated secret reuse requires predecessor adoption evidence");
  }
  if (predecessorAdoption !== null) {
    validatePredecessorAdoptionEvidence(predecessorAdoption);
    if (generatedSecretValues === null) {
      refuse("predecessor adoption requires exact generated secret values");
    }
  }
  return selectGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl,
    generatedSecretValues,
    expectedGeneratedSecretDigestSetSha256:
      predecessorAdoption?.generatedSecretDigestSetSha256 ?? null,
  });
}

function createBundle({
  stateDirectory,
  release,
  source,
  supabaseMutationInput,
  snapshot,
  inventories,
  functionInventory,
  accessBoundary,
  randomBytesImpl,
  generatedSecretValues = null,
  predecessorAdoption = null,
  now,
}) {
  if (predecessorAdoption === null) {
    refuse("current successor bundle predecessor adoption is absent");
  }
  assertSuccessorPredecessorBaselineHashes({
    predecessorAdoption,
    mainInventorySha256: inventories.mainInventorySha256,
    financeInventorySha256: inventories.financeInventorySha256,
    functionInventorySha256: functionInventory.sha256,
    functionCount: functionInventory.rows.length,
    label: "successor bundle creation baseline",
  });
  const sealedSupabaseCliFile = `${SEALED_SUPABASE_CLI_DIRECTORY}/${SEALED_SUPABASE_CLI_FILE}`;
  if (
    supabaseMutationInput === null
    || typeof supabaseMutationInput !== "object"
    || path.relative(stateDirectory, supabaseMutationInput.path)
      !== sealedSupabaseCliFile
    || canonicalJson(captureSealedSupabaseCliMutationInput(supabaseMutationInput.path))
      !== canonicalJson(supabaseMutationInput)
  ) refuse("sealed Supabase CLI bundle input differs");
  const { operatorSecret, triggerSecret } = resolveGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl,
    generatedSecretValues,
    predecessorAdoption,
  });
  const runtime = runtimeRows({ release, source, snapshot, operatorSecret, triggerSecret });
  const secretMutation = successorSecretMutationRows(runtime);
  const runtimeFile = path.join(stateDirectory, RUNTIME_PROOF_FILE);
  writePrivateFile(runtimeFile, runtime.source);
  const secretMutationFile = path.join(stateDirectory, SECRET_MUTATION_ENV_FILE);
  writePrivateFile(secretMutationFile, secretMutation.source);
  const preinstallInventory = Object.freeze({
    main: inventoryCore(inventories.main),
    finance: inventoryCore(inventories.finance),
    functions: functionInventory.rows,
  });
  const preinstallInventorySource = `${canonicalJson(preinstallInventory)}\n`;
  const preinstallInventoryFile = path.join(stateDirectory, PREINSTALL_INVENTORY_FILE);
  writePrivateFile(preinstallInventoryFile, preinstallInventorySource);
  const descriptorCore = {
    schema_version: 2,
    kind: "main-finance-access-v2-owner-private-descriptor",
    environment: "staging",
    main_project_ref: MAIN_REF,
    finance_project_ref: FINANCE_REF,
    main_edge_origin: `https://${MAIN_REF}.supabase.co`,
    production_deny_project_refs: PRODUCTION_REFS,
    source_deployment_sha256: release.manifest.deploymentClosureSetSha256,
    production_boundary_sha256: accessBoundary.productionBoundarySha256,
    target_descriptor_sha256: accessBoundary.targetDescriptorSha256,
    operator_secret: operatorSecret,
  };
  const operatorDescriptor = Object.freeze({
    ...descriptorCore,
    descriptor_sha256: sha256(canonicalJson(descriptorCore)),
  });
  const operatorDescriptorSource = `${canonicalJson(operatorDescriptor)}\n`;
  const operatorDescriptorFile = path.join(stateDirectory, ACCESS_V2_DESCRIPTOR_FILE);
  writePrivateFile(operatorDescriptorFile, operatorDescriptorSource);
  const archive = buildArchive(release);
  const archiveFile = path.join(stateDirectory, SOURCE_ARCHIVE);
  writePrivateBytes(archiveFile, archive);
  const runtimeMutationInput = captureRuntimeMutationInput(
    secretMutationFile,
    sha256(secretMutation.source),
  );
  const expectedSecretDigests = Object.fromEntries(runtime.names.map(name => [
    name,
    sha256(runtime.values[name]),
  ]));
  const mutationSecretDigests = Object.fromEntries(secretMutation.names.map(name => [
    name,
    sha256(secretMutation.values[name]),
  ]));
  const recordedAt = now().toISOString();
  const core = {
    schemaVersion: 3,
    kind: "main-finance-runtime-recovery-v3-private-bundle",
    environment: "staging",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    productionDenied: true,
    recordedAt,
    sourceCommitSha: source.commit,
    sourceTreeSha: source.tree,
    releaseManifestSha256: release.manifestSha256,
    preflightSqlSha256: release.preflightSqlSha256,
    sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
    sourceArchiveSha256: sha256(archive),
    sealedSupabaseCliFile,
    supabaseMutationInput,
    runtimeFile: RUNTIME_PROOF_FILE,
    runtimeFileSha256: sha256(runtime.source),
    runtimeMutationFile: SECRET_MUTATION_ENV_FILE,
    runtimeMutationFileSha256: sha256(secretMutation.source),
    runtimeMutationInput,
    preinstallInventoryFile: PREINSTALL_INVENTORY_FILE,
    preinstallInventoryFileSha256: sha256(preinstallInventorySource),
    preinstallMainInventorySha256: inventories.mainInventorySha256,
    preinstallFinanceInventorySha256: inventories.financeInventorySha256,
    preinstallFunctionInventorySha256: functionInventory.sha256,
    operatorDescriptorFile: ACCESS_V2_DESCRIPTOR_FILE,
    operatorDescriptorFileSha256: sha256(operatorDescriptorSource),
    operatorDescriptorSha256: operatorDescriptor.descriptor_sha256,
    productionBoundarySha256: accessBoundary.productionBoundarySha256,
    targetDescriptorSha256: accessBoundary.targetDescriptorSha256,
    secretNames: runtime.names,
    expectedSecretDigests,
    mutationSecretNames: secretMutation.names,
    mutationSecretDigests,
    operatorSecretSha256: sha256(operatorSecret),
    triggerSecretSha256: sha256(triggerSecret),
    catalogSha256: snapshot.catalog_sha256,
    descriptorSha256: snapshot.descriptor_sha256,
    stateSha256: snapshot.state_sha256,
    checkedCount: snapshot.checked_count,
    gateInventorySha256: snapshot.gate_inventory_sha256,
    privacyInventorySha256: snapshot.privacy_secret_inventory_sha256,
    predecessorAdoption,
  };
  const attestation = {
    ...core,
    attestationSha256: sha256(canonicalJson(core)),
  };
  writePrivateFile(
    path.join(stateDirectory, BUNDLE_ATTESTATION_FILE),
    `${canonicalJson(attestation)}\n`,
  );
  fsyncDirectory(stateDirectory);
  const commitCore = {
    schemaVersion: 3,
    kind: "main-finance-runtime-recovery-v3-durable-bundle-commit",
    recordedAt,
    bundleAttestationSha256: attestation.attestationSha256,
    sourceArchiveSha256: attestation.sourceArchiveSha256,
    runtimeFileSha256: attestation.runtimeFileSha256,
    runtimeMutationInputSha256: sha256(canonicalJson(attestation.runtimeMutationInput)),
    supabaseMutationInputSha256: sha256(canonicalJson(attestation.supabaseMutationInput)),
  };
  const bundleCommit = Object.freeze({
    ...commitCore,
    bundleCommitSha256: sha256(canonicalJson(commitCore)),
  });
  writePrivateFile(
    path.join(stateDirectory, BUNDLE_COMMIT_FILE),
    `${canonicalJson(bundleCommit)}\n`,
  );
  fsyncDirectory(stateDirectory);
  return Object.freeze({
    attestation: Object.freeze(attestation),
    runtime: Object.freeze(runtime),
    runtimeFile,
    preinstallInventoryFile,
    preinstallInventories: preinstallInventory,
    operatorDescriptorFile,
    archiveFile,
    secretMutation,
    secretMutationFile,
    supabaseMutationInput,
    runtimeMutationInput,
  });
}

function parseRuntimeSource(source, expectedNames) {
  if (source.includes("\r") || source.includes("\0") || !source.endsWith("\n")) {
    refuse("runtime bundle bytes differ");
  }
  const lines = source.slice(0, -1).split("\n");
  if (lines.length !== expectedNames.length) refuse("runtime bundle row count differs");
  const values = {};
  for (const line of lines) {
    const separator = line.indexOf("=");
    if (separator < 1) refuse("runtime bundle row differs");
    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (Object.hasOwn(values, name)) refuse("runtime bundle contains a duplicate name");
    values[name] = value;
  }
  if (canonicalJson(Object.keys(values)) !== canonicalJson(expectedNames)) {
    refuse("runtime bundle name order differs");
  }
  return Object.freeze(values);
}

function validateRuntimeBundleValues({
  runtimeSource,
  values,
  attestation,
  release,
  source,
  amendedAttestation,
  expectedGeneratedSecretDigestSetSha256,
}) {
  const generatedNames = release.environment.generatedSecrets.map(item => item.name);
  const generatedSecretDigests = Object.fromEntries(generatedNames.map(name => [
    name,
    sha256(values[name]),
  ]));
  const rebuiltRuntime = runtimeRows({
    release,
    source,
    snapshot: {
      catalog_sha256: attestation.catalogSha256,
      privacy_secret_inventory_sha256: attestation.privacyInventorySha256,
    },
    operatorSecret: values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2,
    triggerSecret: values.MAIN_FINANCE_SYNC_TRIGGER_SECRET,
  });
  if (
    sha256(runtimeSource) !== attestation.runtimeFileSha256
    || sha256(values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2)
      !== attestation.operatorSecretSha256
    || sha256(values.MAIN_FINANCE_SYNC_TRIGGER_SECRET)
      !== attestation.triggerSecretSha256
    || Object.entries(attestation.expectedSecretDigests).some(([name, digest]) =>
      !Object.hasOwn(values, name)
      || !SHA256.test(digest)
      || sha256(values[name]) !== digest)
    || Object.hasOwn(values, "MAIN_FINANCE_PRIVACY_HMAC_KEY")
    || canonicalJson(rebuiltRuntime.values) !== canonicalJson(values)
    || rebuiltRuntime.source !== runtimeSource
    || canonicalJson(rebuiltRuntime.names) !== canonicalJson(attestation.secretNames)
    || (amendedAttestation && (
      sha256(canonicalJson(generatedSecretDigests))
        !== attestation.predecessorAdoption.generatedSecretDigestSetSha256
      || sha256(canonicalJson(generatedSecretDigests))
        !== expectedGeneratedSecretDigestSetSha256
    ))
  ) refuse("runtime bundle digest and deterministic value contract differs");
  return Object.freeze({ generatedSecretDigests: Object.freeze(generatedSecretDigests) });
}

function validateBundleRecoveryVariant(attestation, legacyOperationalPredecessor) {
  const amendedAttestation = Object.hasOwn(attestation, "predecessorAdoption");
  if (amendedAttestation === legacyOperationalPredecessor) {
    refuse("bundle attestation recovery variant differs");
  }
  if (amendedAttestation) {
    if (attestation.predecessorAdoption === null) {
      refuse("current successor bundle predecessor adoption is absent");
    }
    validatePredecessorAdoptionEvidence(attestation.predecessorAdoption);
  }
  return amendedAttestation;
}

function readRuntimeBundlePlaintextAfterAuthority({
  attestation,
  amendedAttestation,
  expectedAttestationSha256,
  expectedPredecessorAdoption,
  authorizeRuntimeRead,
  orphanedAdoptionAuthority,
  preinstallInventories,
  runtimeFile,
  readPrivateFileImpl,
}) {
  if (
    (!amendedAttestation && expectedAttestationSha256 === null)
    || (amendedAttestation && (
      expectedPredecessorAdoption === undefined
      || authorizeRuntimeRead === null
      || (expectedAttestationSha256 === null && !orphanedAdoptionAuthority)
    ))
    || (orphanedAdoptionAuthority
      && (!amendedAttestation || expectedAttestationSha256 !== null))
  ) refuse("bundle pre-plaintext authority mode differs");
  if (
    !(expectedAttestationSha256 === null
      || SHA256.test(expectedAttestationSha256 ?? ""))
    || (expectedAttestationSha256 !== null
      && attestation.attestationSha256 !== expectedAttestationSha256)
  ) refuse("bundle attestation pre-plaintext authority differs");
  if (
    expectedPredecessorAdoption !== undefined
    && canonicalJson(attestation.predecessorAdoption)
      !== canonicalJson(expectedPredecessorAdoption)
  ) refuse("bundle predecessor adoption pre-plaintext authority differs");
  if (!(authorizeRuntimeRead === null || typeof authorizeRuntimeRead === "function")) {
    refuse("bundle runtime read authority differs");
  }
  if (amendedAttestation) {
    assertSuccessorPredecessorBaselineBinding(attestation, preinstallInventories);
  }
  if (authorizeRuntimeRead !== null) {
    authorizeRuntimeRead(attestation, preinstallInventories);
  }
  return readPrivateFileImpl(runtimeFile, "runtime bundle", 64 * 1024);
}

function assertBundleStateDirectoryBeforePlaintext(attestation, stateDirectory) {
  if (
    attestation.runtimeMutationInput?.path
      !== path.join(
        stateDirectory,
        attestation.schemaVersion === 3
          ? SECRET_MUTATION_ENV_FILE
          : RUNTIME_ENV_FILE,
      )
    || attestation.supabaseMutationInput?.path
      !== path.join(
        stateDirectory,
        SEALED_SUPABASE_CLI_DIRECTORY,
        SEALED_SUPABASE_CLI_FILE,
      )
  ) refuse("bundle state root changed before runtime read");
}

function readBundle(
  stateDirectory,
  release,
  source,
  {
    legacyOperationalPredecessor = false,
    expectedAttestationSha256 = null,
    expectedPredecessorAdoption = undefined,
    authorizeRuntimeRead = null,
    orphanedAdoptionAuthority = false,
    readPrivateFileImpl = readPrivateFile,
  } = {},
) {
  assertPrivateDirectory(stateDirectory, "state directory");
  const bundleCommitSource = readPrivateFile(
    path.join(stateDirectory, BUNDLE_COMMIT_FILE),
    "durable bundle commit",
    16 * 1024,
  );
  const bundleCommit = readJsonSource(bundleCommitSource, "durable bundle commit");
  const bundleCommitV3 = bundleCommit.schemaVersion === 3;
  exactKeys(bundleCommit, [
    "schemaVersion", "kind", "recordedAt", "bundleAttestationSha256",
    "sourceArchiveSha256", "runtimeFileSha256",
    bundleCommitV3 ? "runtimeMutationInputSha256" : "deployMutationInputSha256",
    "supabaseMutationInputSha256", "bundleCommitSha256",
  ], "durable bundle commit");
  const { bundleCommitSha256, ...bundleCommitCore } = bundleCommit;
  if (
    ![2, 3].includes(bundleCommit.schemaVersion)
    || bundleCommit.kind !== (bundleCommitV3
      ? "main-finance-runtime-recovery-v3-durable-bundle-commit"
      : "main-finance-runtime-recovery-v2-durable-bundle-commit")
    || !canonicalTimestamp(bundleCommit.recordedAt)
    || !SHA256.test(bundleCommit.bundleAttestationSha256 ?? "")
    || !SHA256.test(bundleCommit.sourceArchiveSha256 ?? "")
    || !SHA256.test(bundleCommit.runtimeFileSha256 ?? "")
    || !SHA256.test((bundleCommitV3
      ? bundleCommit.runtimeMutationInputSha256
      : bundleCommit.deployMutationInputSha256) ?? "")
    || !SHA256.test(bundleCommit.supabaseMutationInputSha256 ?? "")
    || !SHA256.test(bundleCommitSha256 ?? "")
    || bundleCommitSha256 !== sha256(canonicalJson(bundleCommitCore))
    || bundleCommitSource !== `${canonicalJson(bundleCommit)}\n`
  ) refuse("durable bundle commit differs");
  const attestationSource = readPrivateFile(
    path.join(stateDirectory, BUNDLE_ATTESTATION_FILE),
    "bundle attestation",
    64 * 1024,
  );
  const attestation = readJsonSource(attestationSource, "bundle attestation");
  const attestationV3 = attestation.schemaVersion === 3;
  const commonAttestationKeys = [
    "schemaVersion", "kind", "environment", "mainProjectRef", "financeProjectRef",
    "productionDenied", "recordedAt", "sourceCommitSha", "sourceTreeSha",
    "releaseManifestSha256", "preflightSqlSha256", "sourceDeploymentSha256",
    "sourceArchiveSha256", "sealedSupabaseCliFile", "supabaseMutationInput",
    "runtimeFile", "runtimeFileSha256", "runtimeMutationInput",
    "preinstallInventoryFile",
    "preinstallInventoryFileSha256", "preinstallMainInventorySha256",
    "preinstallFinanceInventorySha256", "preinstallFunctionInventorySha256",
    "operatorDescriptorFile", "operatorDescriptorFileSha256",
    "operatorDescriptorSha256", "productionBoundarySha256",
    "targetDescriptorSha256", "secretNames",
    "expectedSecretDigests", "operatorSecretSha256", "triggerSecretSha256",
    "catalogSha256", "descriptorSha256", "stateSha256", "checkedCount",
    "gateInventorySha256", "privacyInventorySha256", "attestationSha256",
  ];
  const attestationKeys = attestationV3
    ? [
      ...commonAttestationKeys,
      "runtimeMutationFile", "runtimeMutationFileSha256",
      "mutationSecretNames", "mutationSecretDigests",
    ]
    : [...commonAttestationKeys, "deployMutationInput", "deployWorkdir"];
  const amendedAttestation = validateBundleRecoveryVariant(
    attestation,
    legacyOperationalPredecessor,
  );
  exactKeys(
    attestation,
    amendedAttestation ? [...attestationKeys, "predecessorAdoption"] : attestationKeys,
    "bundle attestation",
  );
  const { attestationSha256, ...core } = attestation;
  if (
    ![2, 3].includes(attestation.schemaVersion)
    || attestation.kind !== (attestationV3
      ? "main-finance-runtime-recovery-v3-private-bundle"
      : "main-finance-runtime-recovery-v2-private-bundle")
    || bundleCommitV3 !== attestationV3
    || attestation.environment !== "staging"
    || attestation.mainProjectRef !== MAIN_REF
    || attestation.financeProjectRef !== FINANCE_REF
    || attestation.productionDenied !== true
    || !canonicalTimestamp(attestation.recordedAt)
    || attestation.sourceCommitSha !== source.commit
    || attestation.sourceTreeSha !== source.tree
    || attestation.releaseManifestSha256 !== release.manifestSha256
    || attestation.preflightSqlSha256 !== release.preflightSqlSha256
    || attestation.sourceDeploymentSha256
      !== release.manifest.deploymentClosureSetSha256
    || !SHA256.test(attestation.sourceArchiveSha256)
    || attestation.sealedSupabaseCliFile
      !== `${SEALED_SUPABASE_CLI_DIRECTORY}/${SEALED_SUPABASE_CLI_FILE}`
    || attestation.supabaseMutationInput === null
    || typeof attestation.supabaseMutationInput !== "object"
  ) refuse("bundle attestation source identity differs");
  if (
    bundleCommit.recordedAt !== attestation.recordedAt
    || bundleCommit.bundleAttestationSha256 !== attestation.attestationSha256
    || bundleCommit.sourceArchiveSha256 !== attestation.sourceArchiveSha256
    || bundleCommit.runtimeFileSha256 !== attestation.runtimeFileSha256
    || (attestationV3
      ? bundleCommit.runtimeMutationInputSha256
        !== sha256(canonicalJson(attestation.runtimeMutationInput))
      : bundleCommit.deployMutationInputSha256
        !== sha256(canonicalJson(attestation.deployMutationInput)))
    || bundleCommit.supabaseMutationInputSha256
      !== sha256(canonicalJson(attestation.supabaseMutationInput))
  ) refuse("durable bundle commit does not bind the private bundle");
  if (
    attestation.runtimeFile !== (attestationV3 ? RUNTIME_PROOF_FILE : RUNTIME_ENV_FILE)
    || attestation.runtimeMutationInput === null
    || typeof attestation.runtimeMutationInput !== "object"
    || (!attestationV3 && !Array.isArray(attestation.deployMutationInput))
    || attestation.preinstallInventoryFile !== PREINSTALL_INVENTORY_FILE
    || !SHA256.test(attestation.preinstallInventoryFileSha256)
    || !SHA256.test(attestation.preinstallMainInventorySha256)
    || !SHA256.test(attestation.preinstallFinanceInventorySha256)
    || !SHA256.test(attestation.preinstallFunctionInventorySha256)
    || attestation.operatorDescriptorFile !== ACCESS_V2_DESCRIPTOR_FILE
    || !SHA256.test(attestation.operatorDescriptorFileSha256)
    || !SHA256.test(attestation.operatorDescriptorSha256)
    || !SHA256.test(attestation.productionBoundarySha256)
    || !SHA256.test(attestation.targetDescriptorSha256)
    || (!attestationV3 && attestation.deployWorkdir !== DEPLOY_WORKDIR)
  ) refuse("bundle attestation private file boundary differs");
  if (attestationV3 && (
    attestation.runtimeMutationFile !== SECRET_MUTATION_ENV_FILE
    || !SHA256.test(attestation.runtimeMutationFileSha256 ?? "")
    || canonicalJson(attestation.mutationSecretNames)
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
    || !validSuccessorMutationSecretDigestMap(
      attestation.mutationSecretDigests,
    )
  )) refuse("successor secret mutation bundle boundary differs");
  if (
    !Array.isArray(attestation.secretNames)
    || canonicalJson(attestation.secretNames) !== canonicalJson([
      ...release.environment.generatedSecrets.map(item => item.name),
      ...release.environment.stableRuntimeConfig,
    ])
    || attestation.secretNames.some(name => !SECRET_NAME.test(name))
    || new Set(attestation.secretNames).size !== attestation.secretNames.length
  ) refuse("bundle attestation managed secret names differ");
  if (
    attestation.expectedSecretDigests === null
    || typeof attestation.expectedSecretDigests !== "object"
    || Array.isArray(attestation.expectedSecretDigests)
    || canonicalJson(Object.keys(attestation.expectedSecretDigests).sort())
      !== canonicalJson([...attestation.secretNames].sort())
  ) refuse("bundle attestation managed secret digest set differs");
  if (
    !SHA256.test(attestation.operatorSecretSha256)
    || !SHA256.test(attestation.triggerSecretSha256)
  ) refuse("bundle attestation generated secret hashes differ");
  if (
    !SHA256.test(attestation.catalogSha256)
    || !SHA256.test(attestation.descriptorSha256)
    || !SHA256.test(attestation.stateSha256)
    || !Number.isSafeInteger(attestation.checkedCount)
    || attestation.checkedCount <= 0
    || !SHA256.test(attestation.gateInventorySha256)
    || !SHA256.test(attestation.privacyInventorySha256)
    || !SHA256.test(attestationSha256)
    || attestationSha256 !== sha256(canonicalJson(core))
  ) refuse("bundle attestation snapshot or self-hash differs");
  const preinstallInventoryFile = path.join(stateDirectory, PREINSTALL_INVENTORY_FILE);
  const preinstallInventorySource = readPrivateFile(
    preinstallInventoryFile,
    "preinstall secret inventory",
    256 * 1024,
  );
  const preinstallInventory = readJsonSource(
    preinstallInventorySource,
    "preinstall secret inventory",
  );
  exactKeys(preinstallInventory, ["main", "finance", "functions"], "preinstall inventory");
  const toInventory = (rows, label) => {
    if (!Array.isArray(rows) || rows.length === 0) refuse(`${label} rows differ`);
    const result = new Map();
    for (const row of rows) {
      exactKeys(row, ["name", "value", "updatedAt"], `${label} row`);
      if (
        !SECRET_NAME.test(row.name ?? "") || !SHA256.test(row.value ?? "")
        || !canonicalTimestamp(row.updatedAt) || result.has(row.name)
      ) refuse(`${label} row differs`);
      result.set(row.name, Object.freeze({ ...row }));
    }
    return result;
  };
  const preinstallMain = toInventory(preinstallInventory.main, "preinstall Main inventory");
  const preinstallFinance = toInventory(
    preinstallInventory.finance,
    "preinstall Finance inventory",
  );
  const storedFunctionInventory = normalizeFunctionInventoryRows(
    preinstallInventory.functions,
  );
  const preinstallFunctions = storedFunctionInventory.rows;
  if (
    preinstallInventorySource !== `${canonicalJson(preinstallInventory)}\n`
    || sha256(preinstallInventorySource) !== attestation.preinstallInventoryFileSha256
    || sha256(canonicalJson(inventoryCore(preinstallMain)))
      !== attestation.preinstallMainInventorySha256
    || sha256(canonicalJson(inventoryCore(preinstallFinance)))
      !== attestation.preinstallFinanceInventorySha256
    || (attestationV3
      ? (
        functionTargetState(storedFunctionInventory) !== "exact"
        || !isTerminalDivergedPredecessorAdoption(attestation.predecessorAdoption)
      )
      : storedFunctionInventory.target !== null)
    || storedFunctionInventory.sha256 !== attestation.preinstallFunctionInventorySha256
  ) refuse("preinstall secret inventory fingerprint differs");
  const preinstallInventories = Object.freeze({
    main: preinstallMain,
    finance: preinstallFinance,
    functions: preinstallFunctions,
  });
  const runtimeFile = path.join(
    stateDirectory,
    attestationV3 ? RUNTIME_PROOF_FILE : RUNTIME_ENV_FILE,
  );
  assertBundleStateDirectoryBeforePlaintext(attestation, stateDirectory);
  const runtimeSource = readRuntimeBundlePlaintextAfterAuthority({
    attestation,
    amendedAttestation,
    expectedAttestationSha256,
    expectedPredecessorAdoption,
    authorizeRuntimeRead,
    orphanedAdoptionAuthority,
    preinstallInventories,
    runtimeFile,
    readPrivateFileImpl,
  });
  const values = parseRuntimeSource(runtimeSource, attestation.secretNames);
  validateRuntimeBundleValues({
    runtimeSource,
    values,
    attestation,
    release,
    source,
    amendedAttestation,
    expectedGeneratedSecretDigestSetSha256:
      PREDECESSOR_ADOPTION_PINS.generatedSecretDigestSetSha256,
  });
  if (attestationV3) {
    const mutationSource = readPrivateFile(
      path.join(stateDirectory, SECRET_MUTATION_ENV_FILE),
      "successor secret mutation bundle",
      16 * 1024,
    );
    const mutationValues = parseRuntimeSource(
      mutationSource,
      attestation.mutationSecretNames,
    );
    if (
      sha256(mutationSource) !== attestation.runtimeMutationFileSha256
      || Object.entries(mutationValues).some(([name, value]) =>
        value !== values[name]
        || sha256(value) !== attestation.mutationSecretDigests[name])
      || attestation.mutationSecretNames.some(name =>
        release.environment.generatedSecrets.some(item => item.name === name))
    ) refuse("successor secret mutation plaintext boundary differs");
  }
  const operatorDescriptorFile = path.join(stateDirectory, ACCESS_V2_DESCRIPTOR_FILE);
  const operatorDescriptorSource = readPrivateFile(
    operatorDescriptorFile,
    "access v2 operator descriptor",
    64 * 1024,
  );
  const operatorDescriptor = readJsonSource(
    operatorDescriptorSource,
    "access v2 operator descriptor",
  );
  exactKeys(operatorDescriptor, [
    "schema_version", "kind", "environment", "main_project_ref",
    "finance_project_ref", "main_edge_origin", "production_deny_project_refs",
    "source_deployment_sha256", "production_boundary_sha256",
    "target_descriptor_sha256", "operator_secret", "descriptor_sha256",
  ], "access v2 operator descriptor");
  const { descriptor_sha256: descriptorSha256, ...descriptorCore } = operatorDescriptor;
  if (
    operatorDescriptor.schema_version !== 2
    || operatorDescriptor.kind !== "main-finance-access-v2-owner-private-descriptor"
    || operatorDescriptor.environment !== "staging"
    || operatorDescriptor.main_project_ref !== MAIN_REF
    || operatorDescriptor.finance_project_ref !== FINANCE_REF
    || operatorDescriptor.main_edge_origin !== `https://${MAIN_REF}.supabase.co`
    || canonicalJson(operatorDescriptor.production_deny_project_refs)
      !== canonicalJson(PRODUCTION_REFS)
    || sha256(operatorDescriptorSource) !== attestation.operatorDescriptorFileSha256
    || descriptorSha256 !== attestation.operatorDescriptorSha256
    || descriptorSha256 !== sha256(canonicalJson(descriptorCore))
    || operatorDescriptor.production_boundary_sha256 !== attestation.productionBoundarySha256
    || operatorDescriptor.target_descriptor_sha256 !== attestation.targetDescriptorSha256
    || operatorDescriptor.operator_secret
      !== values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2
    || operatorDescriptor.source_deployment_sha256
      !== release.manifest.deploymentClosureSetSha256
    || operatorDescriptorSource !== `${canonicalJson(operatorDescriptor)}\n`
  ) refuse("access v2 operator descriptor contract differs");
  const archiveFile = path.join(stateDirectory, SOURCE_ARCHIVE);
  const archiveStatus = lstatSync(archiveFile);
  const archiveBytes = readFileSync(archiveFile);
  const expectedArchive = buildArchive(release);
  if (
    !archiveStatus.isFile()
    || archiveStatus.isSymbolicLink()
    || archiveStatus.nlink !== 1
    || (archiveStatus.mode & 0o777) !== 0o600
    || sha256(archiveBytes) !== attestation.sourceArchiveSha256
    || archiveBytes.length !== expectedArchive.length
    || !archiveBytes.equals(expectedArchive)
  ) refuse("source archive contract differs");
  const workdir = attestationV3 ? null : path.join(stateDirectory, DEPLOY_WORKDIR);
  if (!attestationV3) {
    for (const item of release.manifest.deploymentClosureFiles) {
      const file = path.join(workdir, item.path);
      if (!statSync(file).isFile() || sha256(readFileSync(file)) !== item.sha256) {
        refuse(`deploy workdir closure differs: ${item.path}`);
      }
    }
  }
  const secretMutationFile = attestationV3
    ? path.join(stateDirectory, SECRET_MUTATION_ENV_FILE)
    : runtimeFile;
  const runtimeMutationInput = captureRuntimeMutationInput(
    secretMutationFile,
    attestationV3
      ? attestation.runtimeMutationFileSha256
      : attestation.runtimeFileSha256,
  );
  const deployMutationInput = attestationV3
    ? null
    : captureDeployMutationInput(workdir, release);
  const supabaseFile = path.join(stateDirectory, attestation.sealedSupabaseCliFile);
  const supabaseMutationInput = captureSealedSupabaseCliMutationInput(supabaseFile);
  if (
    canonicalJson(runtimeMutationInput) !== canonicalJson(attestation.runtimeMutationInput)
    || (!attestationV3
      && canonicalJson(deployMutationInput)
        !== canonicalJson(attestation.deployMutationInput))
    || canonicalJson(supabaseMutationInput)
      !== canonicalJson(attestation.supabaseMutationInput)
  ) refuse("sealed mutation input inventory differs");
  return Object.freeze({
    attestation: Object.freeze(attestation),
    runtime: Object.freeze({ values, source: runtimeSource, names: attestation.secretNames }),
    runtimeFile,
    secretMutationFile,
    secretMutation: attestationV3 ? Object.freeze({
      names: Object.freeze(attestation.mutationSecretNames),
      values: Object.freeze(Object.fromEntries(
        attestation.mutationSecretNames.map(name => [name, values[name]]),
      )),
    }) : null,
    preinstallInventoryFile,
    preinstallInventories,
    operatorDescriptorFile,
    archiveFile,
    workdir,
    supabaseFile,
    supabaseMutationInput,
    runtimeMutationInput,
    deployMutationInput,
  });
}

function assertPairwiseDisjointDirectories(items) {
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const a = path.resolve(items[left].directory);
      const b = path.resolve(items[right].directory);
      if (
        a === b
        || a.startsWith(`${b}${path.sep}`)
        || b.startsWith(`${a}${path.sep}`)
      ) refuse(`${items[left].label} and ${items[right].label} must be disjoint and non-nested`);
    }
  }
}

function readPriorBundleEnvelope(stateDirectory, plan, provenance) {
  const commitSource = readPrivateFile(
    path.join(stateDirectory, BUNDLE_COMMIT_FILE),
    "predecessor durable bundle commit",
    16 * 1024,
  );
  const commit = readJsonSource(commitSource, "predecessor durable bundle commit");
  exactKeys(commit, [
    "schemaVersion", "kind", "recordedAt", "bundleAttestationSha256",
    "sourceArchiveSha256", "runtimeFileSha256", "deployMutationInputSha256",
    "supabaseMutationInputSha256", "bundleCommitSha256",
  ], "predecessor durable bundle commit");
  const { bundleCommitSha256, ...commitCore } = commit;
  const attestationSource = readPrivateFile(
    path.join(stateDirectory, BUNDLE_ATTESTATION_FILE),
    "predecessor bundle attestation",
    64 * 1024,
  );
  const attestation = readJsonSource(attestationSource, "predecessor bundle attestation");
  const { attestationSha256, ...attestationCore } = attestation;
  if (
    commit.schemaVersion !== 2
    || commit.kind !== "main-finance-runtime-recovery-v2-durable-bundle-commit"
    || !canonicalTimestamp(commit.recordedAt)
    || commitSource !== `${canonicalJson(commit)}\n`
    || commit.bundleCommitSha256 !== sha256(canonicalJson(commitCore))
    || attestation.schemaVersion !== 2
    || attestation.kind !== "main-finance-runtime-recovery-v2-private-bundle"
    || attestationSource !== `${canonicalJson(attestation)}\n`
    || attestation.attestationSha256 !== sha256(canonicalJson(attestationCore))
    || commit.bundleAttestationSha256 !== attestation.attestationSha256
    || commit.recordedAt !== attestation.recordedAt
    || commit.sourceArchiveSha256 !== attestation.sourceArchiveSha256
    || commit.runtimeFileSha256 !== attestation.runtimeFileSha256
    || commit.deployMutationInputSha256
      !== sha256(canonicalJson(attestation.deployMutationInput))
    || commit.supabaseMutationInputSha256
      !== sha256(canonicalJson(attestation.supabaseMutationInput))
    || plan.bundleAttestationSha256 !== attestation.attestationSha256
    || plan.sourceArchiveSha256 !== attestation.sourceArchiveSha256
    || plan.runtimeMutationInputSha256
      !== sha256(canonicalJson(attestation.runtimeMutationInput))
    || plan.deployMutationInputSha256
      !== sha256(canonicalJson(attestation.deployMutationInput))
    || attestation.runtimeMutationInput?.path
      !== path.join(stateDirectory, RUNTIME_ENV_FILE)
    || attestation.supabaseMutationInput?.path
      !== path.join(
        stateDirectory,
        SEALED_SUPABASE_CLI_DIRECTORY,
        SEALED_SUPABASE_CLI_FILE,
      )
    || plan.releaseManifestSha256 !== attestation.releaseManifestSha256
    || plan.sourceDeploymentSha256 !== attestation.sourceDeploymentSha256
    || plan.sourceCommitSha !== attestation.sourceCommitSha
    || plan.sourceTreeSha !== attestation.sourceTreeSha
    || provenance.expectedCommitSha !== attestation.sourceCommitSha
    || provenance.expectedTreeSha !== attestation.sourceTreeSha
    || provenance.fileSha256 !== plan.sourceProvenanceFileSha256
    || provenance.descriptorSha256 !== plan.sourceProvenanceDescriptorSha256
  ) refuse("predecessor bundle envelope, plan or provenance differs");
  return Object.freeze({ commit, attestation });
}

function assertLegacyPredecessorBundleBeforePlaintext({
  attestation,
  preinstallInventories,
  envelopeAttestation,
  plan,
  intent,
  terminal,
  stateDirectory,
}) {
  const preinstallFunctions = normalizeFunctionInventoryRows(
    preinstallInventories.functions,
  );
  const expectedObservedFunctions = normalizeFunctionInventoryRows(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
      preinstallFunctions.rows,
    ),
  );
  if (
    attestation.attestationSha256 !== envelopeAttestation.attestationSha256
    || plan.operatorDescriptorFileSha256
      !== attestation.operatorDescriptorFileSha256
    || plan.functionInventorySha256 !== preinstallFunctions.sha256
    || plan.functionInventorySha256
      !== attestation.preinstallFunctionInventorySha256
    || plan.mainInventorySha256
      !== sha256(canonicalJson(inventoryCore(preinstallInventories.main)))
    || plan.financeInventorySha256
      !== sha256(canonicalJson(inventoryCore(preinstallInventories.finance)))
    || attestation.runtimeMutationInput?.path
      !== path.join(stateDirectory, RUNTIME_ENV_FILE)
    || attestation.supabaseMutationInput?.path
      !== path.join(
        stateDirectory,
        SEALED_SUPABASE_CLI_DIRECTORY,
        SEALED_SUPABASE_CLI_FILE,
      )
    || plan.runtimeCommandArgsSha256 !== sha256(canonicalJson([
      "secrets", "set", "--project-ref", MAIN_REF,
      "--env-file", path.join(stateDirectory, RUNTIME_ENV_FILE), "--yes",
    ]))
    || plan.deployCommandArgsSha256 !== sha256(canonicalJson([
      "functions", "deploy", FUNCTION_NAME, "--project-ref", MAIN_REF,
      "--no-verify-jwt", "--use-api", "--workdir",
      path.join(stateDirectory, DEPLOY_WORKDIR), "--yes",
    ]))
    || attestation.runtimeFileSha256
      !== PREDECESSOR_ADOPTION_PINS.runtimeFileSha256
    || intent.expectedSecretDigestSetSha256
      !== sha256(canonicalJson(attestation.expectedSecretDigests))
    || terminal.functionInventorySha256 !== expectedObservedFunctions.sha256
  ) refuse("predecessor envelope relation differs before runtime read");
}

function readPredecessorAdoption(input, release) {
  assertPairwiseDisjointDirectories([
    { directory: input.stateDir, label: "new state directory" },
    { directory: input.receiptDir, label: "new receipt directory" },
    { directory: input.priorStateDir, label: "predecessor state directory" },
    { directory: input.priorReceiptDir, label: "predecessor receipt directory" },
  ]);
  const priorStateDirectory = assertPrivateDirectory(
    input.priorStateDir,
    "predecessor state directory",
  );
  const priorReceiptDirectory = assertPrivateDirectory(
    input.priorReceiptDir,
    "predecessor receipt directory",
  );
  assertAbsolute(input.priorReleaseProvenance, "predecessor release provenance");
  const predecessorRoot = path.dirname(priorStateDirectory);
  if (
    path.dirname(priorReceiptDirectory) !== predecessorRoot
    || path.dirname(input.priorReleaseProvenance) !== predecessorRoot
  ) refuse("predecessor state, receipts and provenance must share one exact root");
  assertPrivateDirectory(predecessorRoot, "predecessor root");
  const identityRecord = item => {
    const status = lstatSync(item);
    return Object.freeze({
      realPath: realpathSync(item),
      device: String(status.dev),
      inode: String(status.ino),
      mode: status.mode & 0o777,
      owner: typeof process.getuid === "function" ? status.uid : null,
    });
  };
  const identity = Object.freeze({
    root: identityRecord(predecessorRoot),
    stateDirectory: identityRecord(priorStateDirectory),
    receiptDirectory: identityRecord(priorReceiptDirectory),
    provenanceFile: identityRecord(input.priorReleaseProvenance),
  });
  readReceiptBinding(priorStateDirectory, priorReceiptDirectory);
  const chain = readReceiptChain(priorReceiptDirectory, {
    readOnly: true,
    variant: "pinned-predecessor",
  });
  const [plan, intent, unknown, terminal] = chain;
  if (
    chain.length !== 4
    || plan?.kind !== "release-plan"
    || plan.mutationScope !== "secrets-set+function-deploy"
    || intent?.kind !== "mutation-intent"
    || intent.mutation !== "secrets-set"
    || intent.planReceiptSha256 !== plan.receiptSha256
    || unknown?.kind !== "mutation-result"
    || unknown.mutation !== "secrets-set"
    || unknown.status !== "unknown"
    || unknown.intentReceiptSha256 !== intent.receiptSha256
    || terminal?.kind !== "reconciliation"
    || terminal.mutation !== "secrets-set"
    || terminal.outcome !== "diverged"
    || terminal.unresolvedReceiptSha256 !== unknown.receiptSha256
    || terminal.receiptSha256 !== input.priorTerminalReceiptSha256
    || plan.sourceCommitSha !== PREDECESSOR_ADOPTION_PINS.sourceCommitSha
    || plan.sourceTreeSha !== PREDECESSOR_ADOPTION_PINS.sourceTreeSha
    || plan.receiptSha256 !== PREDECESSOR_ADOPTION_PINS.planReceiptSha256
    || intent.receiptSha256 !== PREDECESSOR_ADOPTION_PINS.intentReceiptSha256
    || unknown.receiptSha256 !== PREDECESSOR_ADOPTION_PINS.unknownReceiptSha256
    || terminal.receiptSha256 !== PREDECESSOR_ADOPTION_PINS.terminalReceiptSha256
    || plan.bundleAttestationSha256
      !== PREDECESSOR_ADOPTION_PINS.bundleAttestationSha256
    || intent.expectedSecretDigestSetSha256
      !== PREDECESSOR_ADOPTION_PINS.expectedSecretDigestSetSha256
    || plan.functionInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.preinstallFunctionInventorySha256
    || terminal.functionInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256
    || plan.mainInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.preinstallMainInventorySha256
    || terminal.mainInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.installedMainInventorySha256
    || plan.financeInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.financeInventorySha256
    || terminal.financeInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.financeInventorySha256
  ) refuse("predecessor receipt chain is not the exact terminal divergence");
  const provenance = readProvenance(input.priorReleaseProvenance);
  if (
    provenance.fileSha256 !== PREDECESSOR_ADOPTION_PINS.provenanceFileSha256
    || provenance.descriptorSha256
      !== PREDECESSOR_ADOPTION_PINS.provenanceDescriptorSha256
  ) refuse("predecessor release provenance is not the exact pinned subject");
  const envelope = readPriorBundleEnvelope(priorStateDirectory, plan, provenance);
  const priorRelease = Object.freeze({
    ...release,
    manifestSha256: plan.releaseManifestSha256,
  });
  const priorSource = Object.freeze({
    commit: provenance.expectedCommitSha,
    tree: provenance.expectedTreeSha,
  });
  const bundle = readBundle(
    priorStateDirectory,
    priorRelease,
    priorSource,
    {
      legacyOperationalPredecessor: true,
      expectedAttestationSha256: plan.bundleAttestationSha256,
      authorizeRuntimeRead: (attestation, preinstallInventories) =>
        assertLegacyPredecessorBundleBeforePlaintext({
          attestation,
          preinstallInventories,
          envelopeAttestation: envelope.attestation,
          plan,
          intent,
          terminal,
          stateDirectory: priorStateDirectory,
        }),
    },
  );
  const expectedObservedFunctionInventory = normalizeFunctionInventoryRows(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
      bundle.preinstallInventories.functions,
    ),
  );
  if (
    bundle.attestation.attestationSha256 !== envelope.attestation.attestationSha256
    || plan.operatorDescriptorFileSha256
      !== bundle.attestation.operatorDescriptorFileSha256
    || plan.functionInventorySha256
      !== bundle.attestation.preinstallFunctionInventorySha256
    || bundle.attestation.runtimeFileSha256
      !== PREDECESSOR_ADOPTION_PINS.runtimeFileSha256
    || expectedObservedFunctionInventory.sha256
      !== terminal.functionInventorySha256
    || expectedObservedFunctionInventory.sha256
      !== PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256
  ) refuse("predecessor private bundle differs from its terminal receipt chain");
  if (
    intent.expectedSecretDigestSetSha256
      !== sha256(canonicalJson(bundle.attestation.expectedSecretDigests))
  ) refuse("predecessor expected secret digest set differs from its private bundle");
  const generatedNames = release.environment.generatedSecrets.map(item => item.name);
  const generatedSecretValues = Object.freeze(Object.fromEntries(
    generatedNames.map(name => [name, bundle.runtime.values[name]]),
  ));
  exactKeys(generatedSecretValues, generatedNames, "predecessor generated secret values");
  const generatedSecretDigests = Object.freeze(Object.fromEntries(
    generatedNames.map(name => [name, sha256(generatedSecretValues[name])]),
  ));
  if (
    sha256(canonicalJson(generatedSecretDigests))
      !== PREDECESSOR_ADOPTION_PINS.generatedSecretDigestSetSha256
  ) refuse("predecessor generated secret digest subset differs");
  const summary = Object.freeze({
    kind: "main-finance-runtime-recovery-v2-predecessor-adoption",
    priorRootIdentitySha256: sha256(canonicalJson(identity)),
    priorSourceCommitSha: provenance.expectedCommitSha,
    priorSourceTreeSha: provenance.expectedTreeSha,
    priorReleaseProvenanceFileSha256: provenance.fileSha256,
    priorReleaseProvenanceDescriptorSha256: provenance.descriptorSha256,
    priorPlanReceiptSha256: plan.receiptSha256,
    priorTerminalReceiptSha256: terminal.receiptSha256,
    priorBundleAttestationSha256: bundle.attestation.attestationSha256,
    priorRuntimeFileSha256: bundle.attestation.runtimeFileSha256,
    generatedSecretNames: Object.freeze(generatedNames),
    generatedSecretDigestSetSha256: sha256(canonicalJson(generatedSecretDigests)),
  });
  return Object.freeze({
    bundle,
    generatedSecretValues,
    generatedSecretDigests,
    summary,
    identity,
    terminalFunctionInventorySha256: terminal.functionInventorySha256,
  });
}

function assertTerminalDivergedPredecessorBundleBeforePlaintext({
  attestation,
  preinstallInventories,
  envelopeAttestation,
  plan,
  secretIntent,
  secretResult,
  functionIntent,
  unknown,
  terminal,
  stateDirectory,
}) {
  const preinstallFunctions = normalizeFunctionInventoryRows(
    preinstallInventories.functions,
  );
  const postSecretFunctions = normalizeFunctionInventoryRows(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
      preinstallFunctions.rows,
    ),
  );
  if (
    attestation.attestationSha256 !== envelopeAttestation.attestationSha256
    || attestation.schemaVersion !== 2
    || attestation.kind !== "main-finance-runtime-recovery-v2-private-bundle"
    || attestation.sourceCommitSha
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.sourceCommitSha
    || attestation.sourceTreeSha
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.sourceTreeSha
    || attestation.runtimeFileSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.runtimeFileSha256
    || attestation.runtimeMutationInput?.path
      !== path.join(stateDirectory, RUNTIME_ENV_FILE)
    || plan.bundleAttestationSha256 !== attestation.attestationSha256
    || plan.operatorDescriptorFileSha256
      !== attestation.operatorDescriptorFileSha256
    || plan.mainInventorySha256
      !== attestation.preinstallMainInventorySha256
    || plan.financeInventorySha256
      !== attestation.preinstallFinanceInventorySha256
    || plan.functionInventorySha256
      !== attestation.preinstallFunctionInventorySha256
    || attestation.preinstallMainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallMainInventorySha256
    || attestation.preinstallFinanceInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
    || attestation.preinstallFunctionInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallFunctionInventorySha256
    || preinstallFunctions.rows.length
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.preinstallFunctionCount
    || postSecretFunctions.sha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.postSecretFunctionInventorySha256
    || secretIntent.expectedSecretDigestSetSha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.expectedSecretDigestSetSha256
    || secretIntent.expectedSecretDigestSetSha256
      !== sha256(canonicalJson(attestation.expectedSecretDigests))
    || secretResult.afterMainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.postSecretMainInventorySha256
    || secretResult.afterFunctionInventorySha256 !== postSecretFunctions.sha256
    || secretResult.functionVersionTransitionDisposition
      !== "exact-all-existing-plus-one"
    || functionIntent.beforeMainInventorySha256
      !== secretResult.afterMainInventorySha256
    || functionIntent.beforeFinanceInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
    || functionIntent.beforeFunctionInventorySha256
      !== secretResult.afterFunctionInventorySha256
    || unknown.intentReceiptSha256 !== functionIntent.receiptSha256
    || terminal.unresolvedReceiptSha256 !== unknown.receiptSha256
    || terminal.outcome !== "diverged"
    || terminal.mainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalMainInventorySha256
    || terminal.financeInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
    || terminal.functionInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionInventorySha256
  ) refuse("terminal-diverged predecessor bundle authority differs before runtime read");
}

function readTerminalDivergedPredecessorAdoption(input, release) {
  assertPairwiseDisjointDirectories([
    { directory: input.stateDir, label: "new state directory" },
    { directory: input.receiptDir, label: "new receipt directory" },
    { directory: input.priorStateDir, label: "predecessor state directory" },
    { directory: input.priorReceiptDir, label: "predecessor receipt directory" },
  ]);
  const priorStateDirectory = assertPrivateDirectory(
    input.priorStateDir,
    "terminal-diverged predecessor state directory",
  );
  const priorReceiptDirectory = assertPrivateDirectory(
    input.priorReceiptDir,
    "terminal-diverged predecessor receipt directory",
  );
  assertAbsolute(input.priorReleaseProvenance, "predecessor release provenance");
  const predecessorRoot = path.dirname(priorStateDirectory);
  if (
    path.dirname(priorReceiptDirectory) !== predecessorRoot
    || path.dirname(input.priorReleaseProvenance) !== predecessorRoot
  ) refuse("terminal-diverged predecessor authority must share one exact root");
  assertPrivateDirectory(predecessorRoot, "terminal-diverged predecessor root");
  const identityRecord = item => {
    const status = lstatSync(item);
    return Object.freeze({
      realPath: realpathSync(item),
      device: String(status.dev),
      inode: String(status.ino),
      mode: status.mode & 0o777,
      owner: typeof process.getuid === "function" ? status.uid : null,
    });
  };
  const identity = Object.freeze({
    root: identityRecord(predecessorRoot),
    stateDirectory: identityRecord(priorStateDirectory),
    receiptDirectory: identityRecord(priorReceiptDirectory),
    provenanceFile: identityRecord(input.priorReleaseProvenance),
  });
  readReceiptBinding(priorStateDirectory, priorReceiptDirectory);
  const chain = readReceiptChain(priorReceiptDirectory, {
    readOnly: true,
    variant: "terminal-diverged-predecessor",
  });
  const [plan, secretIntent, secretResult, functionIntent, unknown, terminal] = chain;
  const pins = TERMINAL_DIVERGED_PREDECESSOR_PINS;
  if (
    chain.length !== 6
    || sha256(canonicalJson(chain)) !== pins.receiptChainSha256
    || plan?.kind !== "release-plan"
    || plan.mutationScope !== "secrets-set+function-deploy"
    || secretIntent?.kind !== "mutation-intent"
    || secretIntent.mutation !== "secrets-set"
    || secretResult?.kind !== "mutation-result"
    || secretResult.mutation !== "secrets-set"
    || secretResult.status !== "verified"
    || functionIntent?.kind !== "mutation-intent"
    || functionIntent.mutation !== "function-deploy"
    || unknown?.kind !== "mutation-result"
    || unknown.mutation !== "function-deploy"
    || unknown.status !== "unknown"
    || terminal?.kind !== "reconciliation"
    || terminal.mutation !== "function-deploy"
    || terminal.outcome !== "diverged"
    || plan.sourceCommitSha !== pins.sourceCommitSha
    || plan.sourceTreeSha !== pins.sourceTreeSha
    || plan.receiptSha256 !== pins.planReceiptSha256
    || secretIntent.receiptSha256 !== pins.secretIntentReceiptSha256
    || secretResult.receiptSha256 !== pins.secretResultReceiptSha256
    || functionIntent.receiptSha256 !== pins.functionIntentReceiptSha256
    || unknown.receiptSha256 !== pins.functionUnknownReceiptSha256
    || terminal.receiptSha256 !== pins.terminalReceiptSha256
    || terminal.receiptSha256 !== input.priorTerminalReceiptSha256
    || plan.bundleAttestationSha256 !== pins.bundleAttestationSha256
  ) refuse("predecessor chain is not the exact a30 terminal divergence");
  const provenance = readProvenance(input.priorReleaseProvenance);
  if (
    provenance.fileSha256 !== pins.provenanceFileSha256
    || provenance.descriptorSha256 !== pins.provenanceDescriptorSha256
    || provenance.expectedCommitSha !== pins.sourceCommitSha
    || provenance.expectedTreeSha !== pins.sourceTreeSha
  ) refuse("terminal-diverged predecessor provenance differs");
  const envelope = readPriorBundleEnvelope(priorStateDirectory, plan, provenance);
  const priorRelease = Object.freeze({
    ...release,
    manifestSha256: plan.releaseManifestSha256,
  });
  const priorSource = Object.freeze({
    commit: provenance.expectedCommitSha,
    tree: provenance.expectedTreeSha,
  });
  const bundle = readBundle(
    priorStateDirectory,
    priorRelease,
    priorSource,
    {
      expectedAttestationSha256: plan.bundleAttestationSha256,
      expectedPredecessorAdoption: plan.predecessorAdoption,
      authorizeRuntimeRead: (attestation, preinstallInventories) =>
        assertTerminalDivergedPredecessorBundleBeforePlaintext({
          attestation,
          preinstallInventories,
          envelopeAttestation: envelope.attestation,
          plan,
          secretIntent,
          secretResult,
          functionIntent,
          unknown,
          terminal,
          stateDirectory: priorStateDirectory,
        }),
    },
  );
  const generatedNames = release.environment.generatedSecrets.map(item => item.name);
  const generatedSecretValues = Object.freeze(Object.fromEntries(
    generatedNames.map(name => [name, bundle.runtime.values[name]]),
  ));
  const generatedSecretDigests = Object.freeze(Object.fromEntries(
    generatedNames.map(name => [name, sha256(generatedSecretValues[name])]),
  ));
  if (
    sha256(canonicalJson(generatedSecretDigests))
      !== pins.generatedSecretDigestSetSha256
  ) refuse("terminal-diverged predecessor generated-secret subset differs");
  const summary = Object.freeze({
    kind: "main-finance-runtime-recovery-v3-terminal-diverged-predecessor-adoption",
    priorRootIdentitySha256: sha256(canonicalJson(identity)),
    priorSourceCommitSha: provenance.expectedCommitSha,
    priorSourceTreeSha: provenance.expectedTreeSha,
    priorReleaseProvenanceFileSha256: provenance.fileSha256,
    priorReleaseProvenanceDescriptorSha256: provenance.descriptorSha256,
    priorPlanReceiptSha256: plan.receiptSha256,
    priorSecretIntentReceiptSha256: secretIntent.receiptSha256,
    priorSecretResultReceiptSha256: secretResult.receiptSha256,
    priorFunctionIntentReceiptSha256: functionIntent.receiptSha256,
    priorFunctionUnknownReceiptSha256: unknown.receiptSha256,
    priorTerminalReceiptSha256: terminal.receiptSha256,
    priorReceiptChainSha256: sha256(canonicalJson(chain)),
    priorBundleAttestationSha256: bundle.attestation.attestationSha256,
    priorRuntimeFileSha256: bundle.attestation.runtimeFileSha256,
    generatedSecretNames: Object.freeze(generatedNames),
    generatedSecretDigestSetSha256: sha256(canonicalJson(generatedSecretDigests)),
    preinstallMainInventorySha256: pins.preinstallMainInventorySha256,
    postSecretMainInventorySha256: pins.postSecretMainInventorySha256,
    terminalMainInventorySha256: pins.terminalMainInventorySha256,
    stableFinanceInventorySha256: pins.financeInventorySha256,
    preinstallFunctionInventorySha256: pins.preinstallFunctionInventorySha256,
    postSecretFunctionInventorySha256: pins.postSecretFunctionInventorySha256,
    terminalFunctionInventorySha256: pins.terminalFunctionInventorySha256,
    terminalFunctionCount: pins.terminalFunctionCount,
    targetFunctionState: "exact-sole-addition",
    metadataOnlySecretNames: SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
    stableReadRounds: 2,
    functionDeployAlreadyObserved: true,
    terminalOutcome: "diverged",
    causalAttribution: false,
  });
  validatePredecessorAdoptionEvidence(summary);
  return Object.freeze({
    bundle,
    generatedSecretValues,
    generatedSecretDigests,
    summary,
    identity,
    chain,
    postSecretFunctionRows: expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
      bundle.preinstallInventories.functions,
    ),
  });
}

function exactSuccessorPredecessorAdoption(predecessor) {
  const observedFunctions = normalizeFunctionInventoryRows(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
      predecessor.bundle.preinstallInventories.functions,
    ),
  );
  if (
    observedFunctions.sha256 !== predecessor.terminalFunctionInventorySha256
    || observedFunctions.sha256
      !== PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256
  ) refuse("predecessor successor-adoption function projection differs");
  return Object.freeze({
    ...predecessor.summary,
    predecessorFunctionInventorySha256:
      predecessor.bundle.attestation.preinstallFunctionInventorySha256,
    observedFunctionInventorySha256: observedFunctions.sha256,
    observedFunctionTransitionDisposition: "exact-all-existing-plus-one",
    observedFunctionCount: observedFunctions.rows.length,
    stableReadRounds: 2,
    installedObserved: true,
    stateSatisfied: true,
    causalAttribution: false,
  });
}

function assertOrphanedSuccessorRecoveryFrames({
  predecessorRows,
  successorRows,
  currentRows,
  bundlePredecessorAdoption,
  expectedPredecessorAdoption,
  predecessorInstalled,
  successorNotInstalled,
}) {
  const predecessorDisposition =
    classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: predecessorRows,
      afterRows: currentRows,
    });
  const successorDisposition =
    classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: successorRows,
      afterRows: currentRows,
    });
  if (
    canonicalJson(bundlePredecessorAdoption)
      !== canonicalJson(expectedPredecessorAdoption)
    || predecessorInstalled !== true
    || successorNotInstalled !== true
    || predecessorDisposition !== "exact-all-existing-plus-one"
    || successorDisposition !== "unchanged"
  ) refuse("orphaned adopted bundle recovery frames differ");
  return Object.freeze({
    predecessorDisposition,
    successorDisposition,
  });
}

function readReceiptChain(
  directory,
  { readOnly = false, variant = "current" } = {},
) {
  if (!["current", "pinned-predecessor", "terminal-diverged-predecessor"]
    .includes(variant)) {
    refuse("receipt chain schema variant differs");
  }
  assertPrivateDirectory(directory, "receipt directory");
  const entries = readdirSync(directory).sort();
  if (entries.some(name =>
    !RECEIPT_PATTERN.test(name)
    && !RECEIPT_PENDING_PATTERN.test(name)
    && !RECEIPT_INVALID_PENDING_PATTERN.test(name))) {
    refuse("receipt directory contains a non-receipt entry");
  }
  const invalidPending = entries.filter(name =>
    RECEIPT_INVALID_PENDING_PATTERN.test(name));
  for (const name of invalidPending) {
    const status = lstatSync(path.join(directory, name));
    if (
      !status.isFile() || status.isSymbolicLink() || status.nlink !== 1
      || (status.mode & 0o777) !== 0o600
      || (typeof process.getuid === "function" && status.uid !== process.getuid())
    ) refuse("quarantined pending receipt evidence differs");
  }
  const finalized = entries.filter(name => RECEIPT_PATTERN.test(name));
  const pending = entries.filter(name => RECEIPT_PENDING_PATTERN.test(name));
  if (readOnly && (pending.length !== 0 || invalidPending.length !== 0)) {
    refuse("read-only receipt chain contains pending evidence");
  }
  if (pending.length > 1) refuse("receipt directory contains multiple pending records");
  if (
    pending.length === 1
    && pending[0] !== `${String(finalized.length + 1).padStart(6, "0")}.json.pending`
  ) refuse("pending receipt sequence differs");
  const files = [...finalized, ...pending];
  const chain = [];
  let previous = null;
  for (let index = 0; index < files.length; index += 1) {
    const expected = `${String(index + 1).padStart(6, "0")}.json`;
    if (
      files[index] !== expected
      && files[index] !== `${expected}.pending`
    ) refuse("receipt sequence has a gap");
    const receiptFile = path.join(directory, files[index]);
    const isPending = files[index].endsWith(".pending");
    const source = isPending
      ? readPrivatePendingReceipt(receiptFile)
      : readPrivateFile(receiptFile, "receipt", 256 * 1024);
    try {
      const receipt = readJsonSource(source, "receipt");
      const { receiptSha256, ...core } = receipt;
      if (
      ![2, 3].includes(receipt.schemaVersion)
        || receipt.sequence !== index + 1
        || receipt.previousReceiptSha256 !== previous
        || receipt.productionDenied !== true
        || !canonicalTimestamp(receipt.recordedAt)
        || !SHA256.test(receiptSha256)
        || receiptSha256 !== sha256(canonicalJson(core))
        || source !== `${canonicalJson(receipt)}\n`
      ) refuse("receipt hash chain differs");
      if (
        index > 0
        && Date.parse(receipt.recordedAt) <= Date.parse(chain[index - 1].recordedAt)
      ) refuse("receipt timeline is not strictly monotonic");
      validateReceiptSemantic(receipt, chain, { variant });
      previous = receiptSha256;
      chain.push(Object.freeze(receipt));
    } catch (error) {
      if (!isPending) throw error;
      let evidenceFile = null;
      for (let suffix = 1; suffix <= 999_999; suffix += 1) {
        const candidate = path.join(
          directory,
          `${files[index]}.invalid.${String(suffix).padStart(6, "0")}`,
        );
        if (!existsSync(candidate)) {
          evidenceFile = candidate;
          break;
        }
      }
      if (evidenceFile === null) refuse("pending receipt evidence namespace is exhausted");
      fsyncRegularFile(receiptFile);
      renameSync(receiptFile, evidenceFile);
      fsyncDirectory(directory);
      return chain;
    }
  }
  if (pending.length === 1) {
    const committed = pending[0].replace(/\.pending$/u, "");
    const committedFile = path.join(directory, committed);
    if (existsSync(committedFile)) refuse("pending receipt commit target already exists");
    renameSync(path.join(directory, pending[0]), committedFile);
    fsyncDirectory(directory);
  }
  return chain;
}

function assertReceiptPayloadEnvelopeFree(fields) {
  for (const key of [
    "schemaVersion", "sequence", "previousReceiptSha256",
    "productionDenied", "receiptSha256",
  ]) {
    if (Object.hasOwn(fields, key)) {
      refuse("receipt payload must not override its authoritative envelope");
    }
  }
}

function receiptSchemaVersion(fields, chain) {
  const adoption = fields.kind === "release-plan"
    ? fields.predecessorAdoption
    : [...chain].reverse().find(item => item.kind === "release-plan")
      ?.predecessorAdoption;
  return isTerminalDivergedPredecessorAdoption(adoption) ? 3 : 2;
}

function appendReceipt(directory, chain, fields) {
  assertReceiptPayloadEnvelopeFree(fields);
  const sequence = chain.length + 1;
  if (!canonicalTimestamp(fields.recordedAt)) refuse("new receipt clock differs");
  const previousClock = chain.length === 0
    ? Number.NEGATIVE_INFINITY
    : Date.parse(chain.at(-1).recordedAt);
  const requestedClock = Date.parse(fields.recordedAt);
  if (
    Number.isFinite(previousClock)
    && requestedClock < previousClock
    && previousClock - requestedClock > 1_000
  ) refuse("new receipt clock rolls back beyond the one-second same-operation bound");
  const normalizedClock = Math.max(requestedClock, previousClock + 1);
  const core = {
    ...fields,
    schemaVersion: receiptSchemaVersion(fields, chain),
    sequence,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
    productionDenied: true,
    recordedAt: new Date(normalizedClock).toISOString(),
  };
  const receipt = { ...core, receiptSha256: sha256(canonicalJson(core)) };
  validateReceiptSemantic(receipt, chain);
  const file = path.join(directory, `${String(sequence).padStart(6, "0")}.json`);
  const pendingFile = `${file}.pending`;
  if (existsSync(file) || existsSync(pendingFile)) {
    refuse("receipt sequence target already exists");
  }
  writePrivateFile(pendingFile, `${canonicalJson(receipt)}\n`);
  if (existsSync(file)) refuse("receipt sequence target changed before commit");
  renameSync(pendingFile, file);
  fsyncDirectory(directory);
  chain.push(Object.freeze(receipt));
  return Object.freeze({ receipt: Object.freeze(receipt), file });
}

function validateReceiptChangedPaths(value) {
  if (!Array.isArray(value) || value.length < 1) {
    refuse("receipt changed-path evidence differs");
  }
  const normalized = value.map(item => {
    exactKeys(item, ["status", "path"], "receipt changed-path row");
    if (
      !["A", "M"].includes(item.status)
      || typeof item.path !== "string"
      || item.path.length < 1
      || path.posix.normalize(item.path) !== item.path
      || path.posix.isAbsolute(item.path)
      || item.path.startsWith("../")
      || item.path.includes("\0")
      || item.path.includes("\n")
    ) refuse("receipt changed-path row differs");
    return { status: item.status, path: item.path };
  }).sort((left, right) =>
    left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
  if (
    new Set(normalized.map(item => item.path)).size !== normalized.length
    || canonicalJson(value) !== canonicalJson(normalized)
  ) refuse("receipt changed-path order or cardinality differs");
}

function validateReceiptSourceEvidence(
  receipt,
  measurement = false,
  expectedBaseCommitSha = BASE_COMMIT_SHA,
  expectedBaseTreeSha = BASE_TREE_SHA,
) {
  validateReceiptChangedPaths(receipt.changedPaths);
  if (
    !GIT_OID.test(receipt.sourceCommitSha ?? "")
    || !GIT_OID.test(receipt.sourceTreeSha ?? "")
    || !GIT_OID.test(receipt.sourceParentSha ?? "")
    || receipt.baseTreeSha !== expectedBaseTreeSha
    || (!measurement && receipt.sourceParentSha !== expectedBaseCommitSha)
    || !SHA256.test(receipt.changedPathSetSha256 ?? "")
    || (!measurement && receipt.changedPathSetSha256 !== sha256(receipt.changedPaths
      .map(item => `${item.status}\0${item.path}\n`).join("")))
    || !Number.isSafeInteger(receipt.trackedFileCount)
    || receipt.trackedFileCount < 1
    || !GIT_OID.test(receipt.workflowBlobSha ?? "")
  ) refuse("receipt source evidence differs");
}

function validateSafeSnapshotEvidence(value, label) {
  exactKeys(value, [
    "databaseClock", "responseSha256", "descriptorSha256", "stateSha256",
    "catalogSha256", "gateInventorySha256", "privacyInventorySha256",
    "checkedCount",
  ], label);
  if (
    !canonicalTimestamp(value.databaseClock)
    || [
      value.responseSha256,
      value.descriptorSha256,
      value.stateSha256,
      value.catalogSha256,
      value.gateInventorySha256,
      value.privacyInventorySha256,
    ].some(digest => !SHA256.test(digest ?? ""))
    || !Number.isSafeInteger(value.checkedCount)
    || value.checkedCount < 1
  ) refuse(`${label} differs`);
}

function resumeScopeForCause(
  cause,
  nextRecordedAt = null,
) {
  if (
    cause?.kind === "mutation-result"
    && cause.mutation === "secrets-set"
    && cause.status === "verified"
  ) return "function-deploy";
  if (
    cause?.kind === "release-plan"
    && canonicalTimestamp(nextRecordedAt)
    && Date.parse(cause.expiresAt) <= Date.parse(nextRecordedAt)
  ) {
    if (["secrets-set+function-deploy", "secrets-set"].includes(cause.mutationScope)) {
      return "secrets-set";
    }
    if (cause.mutationScope === "function-deploy") return "function-deploy";
  }
  if (cause?.kind !== "reconciliation") return null;
  if (cause.mutation === "secrets-set" && cause.outcome === "applied") {
    return "function-deploy";
  }
  if (cause.mutation === "secrets-set" && cause.outcome === "state_satisfied") {
    return "function-deploy";
  }
  if (cause.mutation === "secrets-set" && cause.outcome === "not_applied") {
    return "secrets-set";
  }
  if (cause.mutation === "secrets-set" && cause.outcome === "state_unsatisfied") {
    return "secrets-set";
  }
  if (cause.mutation === "function-deploy" && cause.outcome === "not_applied") {
    return "function-deploy";
  }
  return null;
}

function assertRuntimeReadChainEligibility(action, chain, now = null) {
  const tail = chain.at(-1) ?? null;
  if (action === "fresh-plan") {
    if (!chain.every(receipt => receipt.kind === "catalog-measurement")) {
      refuse("fresh plan chain is not eligible for predecessor runtime read");
    }
    return Object.freeze({ orphanedBundle: true, resumeScope: null });
  }
  if (action === "apply") {
    if (tail?.kind !== "release-plan" || tail.status !== "pending") {
      refuse("apply chain is not eligible for runtime read");
    }
    return Object.freeze({ orphanedBundle: false, resumeScope: null });
  }
  if (action === "resume") {
    const priorPlan = [...chain].reverse()
      .find(receipt => receipt.kind === "release-plan") ?? null;
    const orphanedBundle = priorPlan === null
      && chain.every(receipt => receipt.kind === "catalog-measurement");
    if (orphanedBundle) {
      return Object.freeze({ orphanedBundle: true, resumeScope: "secrets-set+function-deploy" });
    }
    if (!canonicalTimestamp(now)) {
      refuse("resume runtime-read eligibility clock differs");
    }
    const resumeScope = resumeScopeForCause(tail, now);
    if (resumeScope === null) {
      refuse("resume cause is not eligible for runtime read");
    }
    return Object.freeze({ orphanedBundle: false, resumeScope });
  }
  if (action === "reconcile") {
    const unresolved = (
      (tail?.kind === "mutation-intent" && tail.status === "pending")
      || (tail?.kind === "mutation-result" && tail.status === "unknown")
    );
    const completionCause = (
      tail?.kind === "mutation-result"
      && (
        tail.mutation === "function-deploy"
        || (tail.schemaVersion === 3 && tail.mutation === "secrets-set")
      )
      && tail.status === "verified"
    ) || (
      tail?.kind === "reconciliation"
      && (
        (tail.mutation === "function-deploy" && tail.outcome === "applied")
        || (tail.schemaVersion === 3 && tail.mutation === "secrets-set"
          && tail.outcome === "state_satisfied")
      )
    );
    if (!unresolved && !completionCause) {
      refuse("reconcile chain is not eligible for runtime read");
    }
    return Object.freeze({ orphanedBundle: false, resumeScope: null });
  }
  if (action === "verify") {
    if (tail?.kind !== "release-complete" || tail.status !== "verified") {
      refuse("verify chain is not eligible for runtime read");
    }
    return Object.freeze({ orphanedBundle: false, resumeScope: null });
  }
  refuse("runtime-read action differs");
}

function validateFunctionVersionTransitionEvidence(value, label) {
  exactKeys(value, [
    "beforeFunctionInventorySha256", "unchangedFunctionInventorySha256",
    "exactAllExistingPlusOneFunctionInventorySha256", "existingFunctionCount",
    "currentStageFunctionInventorySha256", "currentStageDisposition",
    "currentStageExactAllExistingPlusOneFunctionInventorySha256",
    "allowedDispositions", "allOtherFieldsUnchanged", "stableReadRounds",
  ], label);
  if (
    !SHA256.test(value.beforeFunctionInventorySha256 ?? "")
    || value.unchangedFunctionInventorySha256 !== value.beforeFunctionInventorySha256
    || !SHA256.test(value.exactAllExistingPlusOneFunctionInventorySha256 ?? "")
    || !SHA256.test(value.currentStageFunctionInventorySha256 ?? "")
    || !SHA256.test(
      value.currentStageExactAllExistingPlusOneFunctionInventorySha256 ?? "",
    )
    || !["unchanged", "exact-all-existing-plus-one"]
      .includes(value.currentStageDisposition)
    || !Number.isSafeInteger(value.existingFunctionCount)
    || value.existingFunctionCount < 0
    || canonicalJson(value.allowedDispositions)
      !== canonicalJson(["unchanged", "exact-all-existing-plus-one"])
    || value.currentStageFunctionInventorySha256 !== (
      value.currentStageDisposition === "unchanged"
        ? value.unchangedFunctionInventorySha256
        : value.exactAllExistingPlusOneFunctionInventorySha256
    )
    || value.allOtherFieldsUnchanged !== true
    || value.stableReadRounds !== 2
  ) refuse(`${label} differs`);
}

function validatePredecessorAdoptionEvidence(value) {
  if (value === null) refuse("predecessor adoption evidence is absent");
  if (isTerminalDivergedPredecessorAdoption(value)) {
    exactKeys(value, [
      "kind", "priorRootIdentitySha256", "priorSourceCommitSha",
      "priorSourceTreeSha", "priorReleaseProvenanceFileSha256",
      "priorReleaseProvenanceDescriptorSha256", "priorPlanReceiptSha256",
      "priorSecretIntentReceiptSha256", "priorSecretResultReceiptSha256",
      "priorFunctionIntentReceiptSha256", "priorFunctionUnknownReceiptSha256",
      "priorTerminalReceiptSha256", "priorReceiptChainSha256",
      "priorBundleAttestationSha256", "priorRuntimeFileSha256",
      "generatedSecretNames", "generatedSecretDigestSetSha256",
      "preinstallMainInventorySha256", "postSecretMainInventorySha256",
      "terminalMainInventorySha256", "stableFinanceInventorySha256",
      "preinstallFunctionInventorySha256", "postSecretFunctionInventorySha256",
      "terminalFunctionInventorySha256", "terminalFunctionCount",
      "targetFunctionState", "metadataOnlySecretNames", "stableReadRounds",
      "functionDeployAlreadyObserved", "terminalOutcome", "causalAttribution",
    ], "terminal-diverged predecessor adoption evidence");
    const pins = TERMINAL_DIVERGED_PREDECESSOR_PINS;
    if (
      value.priorSourceCommitSha !== pins.sourceCommitSha
      || value.priorSourceTreeSha !== pins.sourceTreeSha
      || value.priorReleaseProvenanceFileSha256 !== pins.provenanceFileSha256
      || value.priorReleaseProvenanceDescriptorSha256
        !== pins.provenanceDescriptorSha256
      || value.priorPlanReceiptSha256 !== pins.planReceiptSha256
      || value.priorSecretIntentReceiptSha256 !== pins.secretIntentReceiptSha256
      || value.priorSecretResultReceiptSha256 !== pins.secretResultReceiptSha256
      || value.priorFunctionIntentReceiptSha256
        !== pins.functionIntentReceiptSha256
      || value.priorFunctionUnknownReceiptSha256
        !== pins.functionUnknownReceiptSha256
      || value.priorTerminalReceiptSha256 !== pins.terminalReceiptSha256
      || value.priorReceiptChainSha256 !== pins.receiptChainSha256
      || value.priorBundleAttestationSha256 !== pins.bundleAttestationSha256
      || value.priorRuntimeFileSha256 !== pins.runtimeFileSha256
      || value.generatedSecretDigestSetSha256 !== pins.generatedSecretDigestSetSha256
      || value.preinstallMainInventorySha256 !== pins.preinstallMainInventorySha256
      || value.postSecretMainInventorySha256 !== pins.postSecretMainInventorySha256
      || value.terminalMainInventorySha256 !== pins.terminalMainInventorySha256
      || value.stableFinanceInventorySha256 !== pins.financeInventorySha256
      || value.preinstallFunctionInventorySha256
        !== pins.preinstallFunctionInventorySha256
      || value.postSecretFunctionInventorySha256
        !== pins.postSecretFunctionInventorySha256
      || value.terminalFunctionInventorySha256
        !== pins.terminalFunctionInventorySha256
      || value.terminalFunctionCount !== pins.terminalFunctionCount
      || value.targetFunctionState !== "exact-sole-addition"
      || canonicalJson(value.generatedSecretNames) !== canonicalJson([
        "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
        "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
      ])
      || canonicalJson(value.metadataOnlySecretNames)
        !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)
      || value.stableReadRounds !== 2
      || value.functionDeployAlreadyObserved !== true
      || value.terminalOutcome !== "diverged"
      || value.causalAttribution !== false
      || Object.entries(value).some(([key, item]) =>
        key.toLowerCase().includes("sha256") && !SHA256.test(item ?? ""))
    ) refuse("terminal-diverged predecessor adoption evidence differs");
    return;
  }
  exactKeys(value, [
    "kind", "priorRootIdentitySha256", "priorSourceCommitSha",
    "priorSourceTreeSha", "priorReleaseProvenanceFileSha256",
    "priorReleaseProvenanceDescriptorSha256", "priorPlanReceiptSha256",
    "priorTerminalReceiptSha256", "priorBundleAttestationSha256",
    "priorRuntimeFileSha256", "generatedSecretNames",
    "generatedSecretDigestSetSha256", "predecessorFunctionInventorySha256",
    "observedFunctionInventorySha256", "observedFunctionTransitionDisposition",
    "observedFunctionCount", "stableReadRounds", "installedObserved",
    "stateSatisfied", "causalAttribution",
  ], "predecessor adoption evidence");
  if (
    value.kind !== "main-finance-runtime-recovery-v2-predecessor-adoption"
    || !SHA256.test(value.priorRootIdentitySha256 ?? "")
    || value.priorSourceCommitSha !== PREDECESSOR_ADOPTION_PINS.sourceCommitSha
    || value.priorSourceTreeSha !== PREDECESSOR_ADOPTION_PINS.sourceTreeSha
    || value.priorReleaseProvenanceFileSha256
      !== PREDECESSOR_ADOPTION_PINS.provenanceFileSha256
    || value.priorReleaseProvenanceDescriptorSha256
      !== PREDECESSOR_ADOPTION_PINS.provenanceDescriptorSha256
    || value.priorPlanReceiptSha256
      !== PREDECESSOR_ADOPTION_PINS.planReceiptSha256
    || value.priorTerminalReceiptSha256
      !== PREDECESSOR_ADOPTION_PINS.terminalReceiptSha256
    || value.priorBundleAttestationSha256
      !== PREDECESSOR_ADOPTION_PINS.bundleAttestationSha256
    || value.priorRuntimeFileSha256
      !== PREDECESSOR_ADOPTION_PINS.runtimeFileSha256
    || value.generatedSecretDigestSetSha256
      !== PREDECESSOR_ADOPTION_PINS.generatedSecretDigestSetSha256
    || value.predecessorFunctionInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.preinstallFunctionInventorySha256
    || value.observedFunctionInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256
    || [
      value.priorReleaseProvenanceFileSha256,
      value.priorReleaseProvenanceDescriptorSha256,
      value.priorPlanReceiptSha256,
      value.priorTerminalReceiptSha256,
      value.priorBundleAttestationSha256,
      value.priorRuntimeFileSha256,
      value.generatedSecretDigestSetSha256,
      value.predecessorFunctionInventorySha256,
      value.observedFunctionInventorySha256,
    ].some(digest => !SHA256.test(digest ?? ""))
    || canonicalJson(value.generatedSecretNames) !== canonicalJson([
      "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
      "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
    ])
    || value.observedFunctionTransitionDisposition !== "exact-all-existing-plus-one"
    || value.observedFunctionCount !== PREDECESSOR_ADOPTION_PINS.observedFunctionCount
    || value.stableReadRounds !== 2
    || value.installedObserved !== true
    || value.stateSatisfied !== true
    || value.causalAttribution !== false
  ) refuse("predecessor adoption evidence differs");
}

function assertSuccessorPredecessorBaselineHashes({
  predecessorAdoption,
  mainInventorySha256,
  financeInventorySha256,
  functionInventorySha256,
  functionCount,
  label,
}) {
  validatePredecessorAdoptionEvidence(predecessorAdoption);
  if (isTerminalDivergedPredecessorAdoption(predecessorAdoption)) {
    if (
      mainInventorySha256
        !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalMainInventorySha256
      || financeInventorySha256
        !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
      || functionInventorySha256
        !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionInventorySha256
      || functionInventorySha256
        !== predecessorAdoption.terminalFunctionInventorySha256
      || functionCount !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionCount
      || functionCount !== predecessorAdoption.terminalFunctionCount
    ) refuse(`${label} differs from the exact terminal-diverged predecessor subject`);
    return;
  }
  if (
    mainInventorySha256 !== PREDECESSOR_ADOPTION_PINS.installedMainInventorySha256
    || financeInventorySha256 !== PREDECESSOR_ADOPTION_PINS.financeInventorySha256
    || functionInventorySha256
      !== PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256
    || functionInventorySha256
      !== predecessorAdoption.observedFunctionInventorySha256
    || functionCount !== PREDECESSOR_ADOPTION_PINS.observedFunctionCount
    || functionCount !== predecessorAdoption.observedFunctionCount
  ) refuse(`${label} differs from the exact predecessor terminal subject`);
}

function assertSuccessorPredecessorBaselineBinding(
  attestation,
  preinstallInventories,
) {
  if (
    preinstallInventories === null
    || typeof preinstallInventories !== "object"
    || !(preinstallInventories.main instanceof Map)
    || !(preinstallInventories.finance instanceof Map)
    || !Array.isArray(preinstallInventories.functions)
  ) refuse("successor bundle preinstall baseline evidence is absent");
  const functions = normalizeFunctionInventoryRows(preinstallInventories.functions);
  const mainInventorySha256 = sha256(canonicalJson(
    inventoryCore(preinstallInventories.main),
  ));
  const financeInventorySha256 = sha256(canonicalJson(
    inventoryCore(preinstallInventories.finance),
  ));
  if (
    attestation.preinstallMainInventorySha256 !== mainInventorySha256
    || attestation.preinstallFinanceInventorySha256 !== financeInventorySha256
    || attestation.preinstallFunctionInventorySha256 !== functions.sha256
  ) refuse("successor bundle preinstall baseline fingerprint differs");
  assertSuccessorPredecessorBaselineHashes({
    predecessorAdoption: attestation.predecessorAdoption,
    mainInventorySha256,
    financeInventorySha256,
    functionInventorySha256: functions.sha256,
    functionCount: functions.rows.length,
    label: "successor bundle preinstall baseline",
  });
}

function validateReceiptSemantic(
  receipt,
  prior,
  { variant = "current" } = {},
) {
  if (!["current", "pinned-predecessor", "terminal-diverged-predecessor"]
    .includes(variant)) {
    refuse("receipt schema variant differs");
  }
  const common = [
    "schemaVersion", "sequence", "previousReceiptSha256", "productionDenied",
    "kind", "environment", "recordedAt", "receiptSha256",
  ];
  const exact = keys => exactKeys(receipt, [...common, ...keys], `${receipt.kind} receipt`);
  if (prior.some(item => item.kind === "release-complete")) {
    refuse("release-complete must remain the terminal receipt");
  }
  if (receipt.environment !== "staging") refuse("receipt environment differs");
  if (receipt.productionTouched !== false) refuse("receipt production boundary differs");
  if (receipt.kind === "catalog-measurement") {
    exact([
      "status", "sourceCommitSha", "sourceTreeSha", "sourceParentSha", "baseTreeSha",
      "changedPaths", "changedPathSetSha256", "trackedFileCount", "workflowBlobSha",
      "releaseManifestSha256", "preflightSqlSha256", "managementResponseSha256",
      "databaseClock", "catalogSha256", "counts", "hostedReadCount",
      "hostedMutationCount", "productionTouched",
    ]);
    validateReceiptSourceEvidence(receipt, true);
    exactKeys(receipt.counts, [
      "columns", "constraints", "indexes", "triggers", "policies",
      "desired", "entitlements",
    ], "catalog measurement counts");
    if (
      prior.some(item => item.kind !== "catalog-measurement")
      ||
      receipt.status !== "read-only-verified"
      || receipt.sourceCommitSha !== BASE_COMMIT_SHA
      || receipt.sourceTreeSha !== BASE_TREE_SHA
      || !SHA256.test(receipt.releaseManifestSha256 ?? "")
      || !SHA256.test(receipt.preflightSqlSha256 ?? "")
      || !SHA256.test(receipt.managementResponseSha256 ?? "")
      || !canonicalTimestamp(receipt.databaseClock)
      || !SHA256.test(receipt.catalogSha256 ?? "")
      || Object.values(receipt.counts).some(value =>
        !Number.isSafeInteger(value) || value < 0)
      || receipt.hostedReadCount !== 1
      || receipt.hostedMutationCount !== 0
    ) {
      refuse("catalog measurement receipt differs");
    }
    return;
  }
  if (receipt.kind === "release-plan") {
    const releasePlanKeys = [
      "status", "expiresAt", "mainProjectRef", "financeProjectRef", "sourceCommitSha",
      "sourceTreeSha", "sourceParentSha", "baseTreeSha", "changedPaths",
      "changedPathSetSha256", "trackedFileCount", "workflowBlobSha", "sourceCiRunId",
      "sourceCiRunApiSha256", "sourceCiJobsApiSha256", "sourceCiBranchApiSha256",
      "sourceProvenanceFileSha256", "sourceProvenanceDescriptorSha256",
      "releaseManifestSha256", "sourceDeploymentSha256", "bundleAttestationSha256",
      "sourceArchiveSha256", "supabaseArchiveSha256", "operatorDescriptorFileSha256",
      "runtimeMutationInputSha256", "runtimeCommandArgsSha256",
      "productionBoundarySha256", "targetDescriptorSha256", "mainInventorySha256",
      "financeInventorySha256", "functionInventorySha256", "snapshot", "mutationScope",
      "resumeFromReceiptSha256", "hostedMutationCount", "productionTouched",
    ];
    const amended = Object.hasOwn(receipt, "functionVersionTransition")
      || Object.hasOwn(receipt, "predecessorAdoption");
    const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
      receipt.predecessorAdoption,
    );
    if (
      (variant === "current" && !amended)
      || (variant === "pinned-predecessor" && amended)
    ) refuse("release plan schema variant differs");
    exact(amended
      ? [
        ...releasePlanKeys,
        ...(!secretsOnlySuccessor
          ? ["deployMutationInputSha256", "deployCommandArgsSha256"]
          : [
            "semanticMainInventorySha256", "mutationSecretNames",
            "mutationSecretNameSetSha256", "mutationSecretDigestSetSha256",
            "metadataOnlySecretNames", "metadataOnlySecretNameSetSha256",
            "predecessorReceiptChainSha256",
            "functionAllExistingPlusOneSha256", "plannedHostedMutationCount",
            "functionDeployCount",
          ]),
        "functionVersionTransition", "predecessorAdoption",
      ]
      : [...releasePlanKeys, "deployMutationInputSha256", "deployCommandArgsSha256"]);
    if (amended) {
      validateFunctionVersionTransitionEvidence(
        receipt.functionVersionTransition,
        "release plan function version transition",
      );
      validatePredecessorAdoptionEvidence(receipt.predecessorAdoption);
      if (
        receipt.functionVersionTransition.currentStageFunctionInventorySha256
          !== receipt.functionInventorySha256
      ) refuse("release plan function transition baseline differs");
      assertSuccessorPredecessorBaselineHashes({
        predecessorAdoption: receipt.predecessorAdoption,
        mainInventorySha256: secretsOnlySuccessor
          ? receipt.mainInventorySha256
          : PREDECESSOR_ADOPTION_PINS.installedMainInventorySha256,
        financeInventorySha256: secretsOnlySuccessor
          ? receipt.financeInventorySha256
          : PREDECESSOR_ADOPTION_PINS.financeInventorySha256,
        functionInventorySha256:
          receipt.functionVersionTransition.beforeFunctionInventorySha256,
        functionCount: receipt.functionVersionTransition.existingFunctionCount,
        label: "release plan successor baseline",
      });
    }
    validateReceiptSourceEvidence(
      receipt,
      false,
      variant === "terminal-diverged-predecessor"
        ? "adcf7b919d34e512ded6d526ee7321f795f8f887"
        : BASE_COMMIT_SHA,
      variant === "terminal-diverged-predecessor"
        ? "f02055d03d63a1fc2ebdbb17aeed3bcb2aafd22a"
        : BASE_TREE_SHA,
    );
    validateSafeSnapshotEvidence(receipt.snapshot, "release plan snapshot");
    if (secretsOnlySuccessor && (
      receipt.schemaVersion !== 3
      || receipt.mutationScope !== "secrets-set"
      || receipt.resumeFromReceiptSha256 !== null
      || !SHA256.test(receipt.semanticMainInventorySha256 ?? "")
      || canonicalJson(receipt.mutationSecretNames)
        !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
      || receipt.mutationSecretNameSetSha256
        !== sha256(canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES))
      || !SHA256.test(receipt.mutationSecretDigestSetSha256 ?? "")
      || canonicalJson(receipt.metadataOnlySecretNames)
        !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)
      || receipt.metadataOnlySecretNameSetSha256
        !== sha256(canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES))
      || receipt.predecessorReceiptChainSha256
        !== TERMINAL_DIVERGED_PREDECESSOR_PINS.receiptChainSha256
      || receipt.functionAllExistingPlusOneSha256
        !== receipt.functionVersionTransition
          .currentStageExactAllExistingPlusOneFunctionInventorySha256
      || receipt.plannedHostedMutationCount !== 1
      || receipt.functionDeployCount !== 0
    )) refuse("secrets-only successor release plan evidence differs");
    if (
      receipt.status !== "pending" || !canonicalTimestamp(receipt.expiresAt)
      || Date.parse(receipt.expiresAt) <= Date.parse(receipt.recordedAt)
      || Date.parse(receipt.expiresAt) - Date.parse(receipt.recordedAt) > 240_000
      || receipt.mainProjectRef !== MAIN_REF || receipt.financeProjectRef !== FINANCE_REF
      || !DECIMAL.test(receipt.sourceCiRunId ?? "") || receipt.sourceCiRunId === "0"
      || [
        receipt.sourceCiRunApiSha256,
        receipt.sourceCiJobsApiSha256,
        receipt.sourceCiBranchApiSha256,
        receipt.sourceProvenanceFileSha256,
        receipt.sourceProvenanceDescriptorSha256,
        receipt.releaseManifestSha256,
        receipt.sourceDeploymentSha256,
        receipt.bundleAttestationSha256,
        receipt.sourceArchiveSha256,
        receipt.supabaseArchiveSha256,
        receipt.operatorDescriptorFileSha256,
        receipt.runtimeMutationInputSha256,
        receipt.runtimeCommandArgsSha256,
        ...(secretsOnlySuccessor ? [] : [
          receipt.deployMutationInputSha256,
          receipt.deployCommandArgsSha256,
        ]),
        receipt.productionBoundarySha256,
        receipt.targetDescriptorSha256,
        receipt.mainInventorySha256,
        receipt.financeInventorySha256,
        receipt.functionInventorySha256,
      ].some(digest => !SHA256.test(digest ?? ""))
      || (secretsOnlySuccessor
        ? receipt.mutationScope !== "secrets-set"
        : !["secrets-set+function-deploy", "secrets-set", "function-deploy"]
          .includes(receipt.mutationScope))
      || (receipt.mutationScope.includes("secrets-set")
        && amended
        && receipt.functionVersionTransition.currentStageDisposition !== "unchanged")
      || !(receipt.resumeFromReceiptSha256 === null
        || SHA256.test(receipt.resumeFromReceiptSha256))
      || receipt.hostedMutationCount !== 0
    ) refuse("release plan receipt differs");
    const cause = prior.at(-1);
    if (secretsOnlySuccessor) {
      if (
        receipt.resumeFromReceiptSha256 !== null
        || prior.some(item => item.kind !== "catalog-measurement")
      ) refuse("secrets-only initial plan causal binding differs");
    } else if (receipt.mutationScope === "secrets-set+function-deploy") {
      if (
        receipt.resumeFromReceiptSha256 !== null
        || prior.some(item => [
          "release-plan", "mutation-intent", "mutation-result", "reconciliation",
          "release-complete",
        ].includes(item.kind))
      ) refuse("initial release plan causal binding differs");
    } else if (
      cause?.receiptSha256 !== receipt.resumeFromReceiptSha256
      || resumeScopeForCause(cause, receipt.recordedAt) !== receipt.mutationScope
    ) refuse("release resume plan causal binding differs");
    return;
  }
  if (receipt.kind === "mutation-intent") {
    const plan = [...prior].reverse().find(item => item.kind === "release-plan");
    const amendedPlan = plan !== undefined
      && Object.hasOwn(plan, "predecessorAdoption")
      && Object.hasOwn(plan, "functionVersionTransition");
    const secretsOnlyPlan = isTerminalDivergedPredecessorAdoption(
      plan?.predecessorAdoption,
    );
    const base = [
      "mutation", "status", "planReceiptSha256", "automaticRetryPerformed",
      "productionTouched",
    ];
    if (receipt.mutation === "secrets-set") {
      exact([
        ...base, "beforeMainInventorySha256", "beforeFinanceInventorySha256",
        "expectedSecretDigestSetSha256", "secretNames",
        ...(amendedPlan ? [
          "beforeFunctionInventorySha256", "unchangedFunctionInventorySha256",
          "exactAllExistingPlusOneFunctionInventorySha256",
          "requiredStableReadRounds", "predecessorAdoptionSha256",
          ...(secretsOnlyPlan ? [
            "semanticBeforeMainInventorySha256",
            "mutationSecretNameSetSha256", "metadataOnlySecretNameSetSha256",
            "predecessorReceiptChainSha256", "functionAllExistingPlusOneSha256",
            "hostedMutationCount", "functionDeployCount",
          ] : []),
        ] : []),
      ]);
    } else if (receipt.mutation === "function-deploy") {
      exact([...base, "beforeMainInventorySha256", "beforeFinanceInventorySha256",
        "beforeFunctionInventorySha256", "sourceDeploymentSha256"]);
    } else refuse("mutation intent kind differs");
    const latest = prior.at(-1);
    const priorSameMutation = plan && prior.some(item =>
      item.sequence > plan.sequence
      && item.mutation === receipt.mutation
      && ["mutation-intent", "mutation-result", "reconciliation"].includes(item.kind));
    const secretCauseIntent = latest?.kind === "mutation-result"
      ? prior.find(item =>
        item.kind === "mutation-intent"
        && item.receiptSha256 === latest.intentReceiptSha256)
      : null;
    const exactCausalPosition = receipt.mutation === "secrets-set"
      ? latest?.receiptSha256 === plan?.receiptSha256
      : (
        (plan?.mutationScope === "function-deploy"
          && latest?.receiptSha256 === plan.receiptSha256)
        || (plan?.mutationScope === "secrets-set+function-deploy"
          && latest?.kind === "mutation-result"
          && latest.mutation === "secrets-set"
          && latest.status === "verified"
          && latest.reconcileRequired === false
          && secretCauseIntent?.planReceiptSha256 === plan.receiptSha256)
      );
    if (
      receipt.status !== "pending" || !plan
      || plan.receiptSha256 !== receipt.planReceiptSha256
      || receipt.automaticRetryPerformed !== false
      || !plan.mutationScope.split("+").includes(receipt.mutation)
      || priorSameMutation || !exactCausalPosition
      || !SHA256.test(receipt.beforeMainInventorySha256 ?? "")
      || !SHA256.test(receipt.beforeFinanceInventorySha256 ?? "")
    ) refuse("mutation intent causal binding differs");
    if (receipt.mutation === "secrets-set") {
      if (
        !SHA256.test(receipt.expectedSecretDigestSetSha256 ?? "")
        || !Array.isArray(receipt.secretNames) || receipt.secretNames.length < 1
        || receipt.secretNames.some(name => !SECRET_NAME.test(name))
        || new Set(receipt.secretNames).size !== receipt.secretNames.length
        || receipt.secretNames.includes("MAIN_FINANCE_PRIVACY_HMAC_KEY")
      ) refuse("secret mutation intent evidence differs");
      if (amendedPlan && (
        !SHA256.test(receipt.beforeFunctionInventorySha256 ?? "")
        || receipt.unchangedFunctionInventorySha256
          !== receipt.beforeFunctionInventorySha256
        || !SHA256.test(receipt.exactAllExistingPlusOneFunctionInventorySha256 ?? "")
        || receipt.requiredStableReadRounds !== 2
        || !SHA256.test(receipt.predecessorAdoptionSha256 ?? "")
        || receipt.beforeFunctionInventorySha256 !== plan.functionInventorySha256
        || receipt.unchangedFunctionInventorySha256
          !== plan.functionVersionTransition.currentStageFunctionInventorySha256
        || receipt.exactAllExistingPlusOneFunctionInventorySha256
          !== plan.functionVersionTransition
            .currentStageExactAllExistingPlusOneFunctionInventorySha256
        || receipt.requiredStableReadRounds
          !== plan.functionVersionTransition.stableReadRounds
        || receipt.predecessorAdoptionSha256
          !== sha256(canonicalJson(plan.predecessorAdoption))
      )) refuse("amended secret mutation intent transition evidence differs");
      if (secretsOnlyPlan && (
        receipt.schemaVersion !== 3
        || canonicalJson(receipt.secretNames)
          !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
        || receipt.expectedSecretDigestSetSha256
          !== plan.mutationSecretDigestSetSha256
        || !SHA256.test(receipt.semanticBeforeMainInventorySha256 ?? "")
        || receipt.mutationSecretNameSetSha256
          !== plan.mutationSecretNameSetSha256
        || receipt.metadataOnlySecretNameSetSha256
          !== plan.metadataOnlySecretNameSetSha256
        || receipt.predecessorReceiptChainSha256
          !== plan.predecessorReceiptChainSha256
        || receipt.functionAllExistingPlusOneSha256
          !== receipt.exactAllExistingPlusOneFunctionInventorySha256
        || receipt.functionAllExistingPlusOneSha256
          !== plan.functionAllExistingPlusOneSha256
        || receipt.hostedMutationCount !== 0
        || receipt.functionDeployCount !== 0
      )) refuse("secrets-only mutation intent evidence differs");
    } else if (
      !SHA256.test(receipt.beforeFunctionInventorySha256 ?? "")
      || !SHA256.test(receipt.sourceDeploymentSha256 ?? "")
      || receipt.sourceDeploymentSha256 !== plan.sourceDeploymentSha256
    ) refuse("function mutation intent evidence differs");
    if (receipt.mutation === "function-deploy") {
      const expected = plan.mutationScope === "secrets-set+function-deploy"
        ? latest
        : plan;
      const expectedMain = expected.afterMainInventorySha256
        ?? expected.mainInventorySha256;
      const expectedFinance = expected.afterFinanceInventorySha256
        ?? expected.financeInventorySha256;
      const expectedFunction = expected.afterFunctionInventorySha256
        ?? expected.functionInventorySha256;
      if (
        receipt.beforeMainInventorySha256 !== expectedMain
        || receipt.beforeFinanceInventorySha256 !== expectedFinance
        || receipt.beforeFunctionInventorySha256 !== expectedFunction
      ) refuse("function mutation intent stage baseline differs");
    }
    return;
  }
  if (receipt.kind === "mutation-result") {
    const base = [
      "mutation", "status", "intentReceiptSha256", "reconcileRequired",
      "automaticRetryPerformed", "productionTouched",
    ];
    const intent = prior.find(item =>
      item.kind === "mutation-intent" && item.receiptSha256 === receipt.intentReceiptSha256);
    const plan = intent === undefined
      ? undefined
      : prior.find(item =>
        item.kind === "release-plan" && item.receiptSha256 === intent.planReceiptSha256);
    const amendedPlan = plan !== undefined
      && Object.hasOwn(plan, "predecessorAdoption")
      && Object.hasOwn(plan, "functionVersionTransition");
    const secretsOnlyPlan = isTerminalDivergedPredecessorAdoption(
      plan?.predecessorAdoption,
    );
    if (receipt.status === "unknown") exact([...base, "responseStatus"]);
    else if (receipt.mutation === "secrets-set" && receipt.status === "verified") {
      exact([
        ...base, "afterMainInventorySha256", "afterFinanceInventorySha256",
        ...(amendedPlan ? [
          "afterFunctionInventorySha256", "functionVersionTransitionDisposition",
          "functionInventoryStableReadRounds", "predecessorAdoptionSha256",
          "observation", "state", "causalAttribution",
          ...(secretsOnlyPlan ? [
            "semanticAfterMainInventorySha256", "metadataOnlyDeltaNames",
            "metadataOnlyDeltaSha256", "mutationSecretNames",
            "mutationSecretNameSetSha256", "mutationSecretDigestSetSha256",
            "predecessorReceiptChainSha256", "functionAllExistingPlusOneSha256",
            "hostedMutationCount", "functionDeployCount",
          ] : []),
        ] : []),
      ]);
    } else if (receipt.mutation === "function-deploy" && receipt.status === "verified") {
      exact([
        ...base, "functionInventorySha256", "hostedProofSha256",
        "hostedD0ResponseSha256",
      ]);
    } else refuse("mutation result status differs");
    if (secretsOnlyPlan && receipt.schemaVersion !== 3) {
      refuse("secrets-only mutation result schema differs");
    }
    if (
      !intent || intent.mutation !== receipt.mutation
      || intent.sequence !== receipt.sequence - 1
      || receipt.automaticRetryPerformed !== false
      || (receipt.status === "unknown") !== receipt.reconcileRequired
    ) refuse("mutation result causal binding differs");
    if (
      (receipt.status === "unknown"
        && !(receipt.responseStatus === null
          || (Number.isSafeInteger(receipt.responseStatus)
            && receipt.responseStatus >= 100 && receipt.responseStatus <= 599)))
      || (receipt.mutation === "secrets-set" && receipt.status === "verified"
        && (!SHA256.test(receipt.afterMainInventorySha256 ?? "")
          || !SHA256.test(receipt.afterFinanceInventorySha256 ?? "")))
      || (receipt.mutation === "function-deploy" && receipt.status === "verified"
        && (!SHA256.test(receipt.functionInventorySha256 ?? "")
          || !SHA256.test(receipt.hostedProofSha256 ?? "")
          || !SHA256.test(receipt.hostedD0ResponseSha256 ?? "")))
    ) refuse("mutation result evidence differs");
    if (
      receipt.mutation === "secrets-set"
      && receipt.status === "verified"
      && amendedPlan
      && (
        !SHA256.test(receipt.afterFunctionInventorySha256 ?? "")
        || !["unchanged", "exact-all-existing-plus-one"]
          .includes(receipt.functionVersionTransitionDisposition)
        || receipt.afterFunctionInventorySha256 !== (
          receipt.functionVersionTransitionDisposition === "unchanged"
            ? intent.unchangedFunctionInventorySha256
            : intent.exactAllExistingPlusOneFunctionInventorySha256
        )
        || receipt.functionInventoryStableReadRounds
          !== intent.requiredStableReadRounds
        || receipt.predecessorAdoptionSha256 !== intent.predecessorAdoptionSha256
        || receipt.observation !== "installed_observed"
        || receipt.state !== "state_satisfied"
        || receipt.causalAttribution !== false
      )
    ) refuse("amended secret mutation result transition evidence differs");
    if (
      secretsOnlyPlan
      && receipt.mutation === "secrets-set"
      && receipt.status === "verified"
      && (
        receipt.schemaVersion !== 3
        || !["unchanged", "exact-all-existing-plus-one"]
          .includes(receipt.functionVersionTransitionDisposition)
        || receipt.functionAllExistingPlusOneSha256
          !== intent.exactAllExistingPlusOneFunctionInventorySha256
        || !SHA256.test(receipt.semanticAfterMainInventorySha256 ?? "")
        || !Array.isArray(receipt.metadataOnlyDeltaNames)
        || receipt.metadataOnlyDeltaNames.some(name =>
          !SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name))
        || new Set(receipt.metadataOnlyDeltaNames).size
          !== receipt.metadataOnlyDeltaNames.length
        || canonicalJson([...receipt.metadataOnlyDeltaNames].sort())
          !== canonicalJson(receipt.metadataOnlyDeltaNames)
        || !SHA256.test(receipt.metadataOnlyDeltaSha256 ?? "")
        || canonicalJson(receipt.mutationSecretNames)
          !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
        || receipt.mutationSecretNameSetSha256
          !== intent.mutationSecretNameSetSha256
        || receipt.mutationSecretDigestSetSha256
          !== plan.mutationSecretDigestSetSha256
        || receipt.predecessorReceiptChainSha256
          !== plan.predecessorReceiptChainSha256
        || receipt.hostedMutationCount !== 1
        || receipt.functionDeployCount !== 0
      )
    ) refuse("secrets-only mutation result evidence differs");
    return;
  }
  if (receipt.kind === "reconciliation") {
    const unresolved = prior.at(-1);
    const unresolvedIntent = unresolved?.kind === "mutation-intent"
      ? unresolved
      : prior.find(item =>
        item.kind === "mutation-intent"
        && item.receiptSha256 === unresolved?.intentReceiptSha256);
    const unresolvedPlan = unresolvedIntent === undefined
      ? undefined
      : prior.find(item =>
        item.kind === "release-plan"
        && item.receiptSha256 === unresolvedIntent.planReceiptSha256);
    const amendedSecretReconciliation = receipt.mutation === "secrets-set"
      && unresolvedPlan !== undefined
      && Object.hasOwn(unresolvedPlan, "predecessorAdoption")
      && Object.hasOwn(unresolvedPlan, "functionVersionTransition");
    const secretsOnlyReconciliation = amendedSecretReconciliation
      && isTerminalDivergedPredecessorAdoption(
        unresolvedPlan.predecessorAdoption,
      );
    exact([
      "mutation", "outcome", "unresolvedReceiptSha256", "mainInventorySha256",
      "financeInventorySha256", "functionInventorySha256", "hostedProofSha256",
      "hostedD0ResponseSha256",
      "hostedMutationCount", "automaticRetryPerformed", "productionTouched",
      ...(amendedSecretReconciliation ? [
        "observation", "state", "causalAttribution",
        "functionVersionTransitionDisposition", "inventoryReadRounds",
        "stableObservation",
        "predecessorAdoptionSha256",
        ...(secretsOnlyReconciliation ? [
          "semanticMainInventorySha256", "metadataOnlyDeltaNames",
          "metadataOnlyDeltaSha256", "mutationSecretNames",
          "mutationSecretNameSetSha256", "mutationSecretDigestSetSha256",
          "predecessorReceiptChainSha256",
          "functionAllExistingPlusOneSha256", "functionDeployCount",
        ] : []),
      ] : []),
    ]);
    if (
      !unresolved || unresolved.receiptSha256 !== receipt.unresolvedReceiptSha256
      || !["mutation-intent", "mutation-result"].includes(unresolved.kind)
      || unresolved.mutation !== receipt.mutation
      || (unresolved.kind === "mutation-result" && unresolved.status !== "unknown")
      || ![
        "applied", "not_applied", "state_satisfied", "state_unsatisfied", "diverged",
      ].includes(receipt.outcome)
      || receipt.hostedMutationCount !== 0 || receipt.automaticRetryPerformed !== false
      || !SHA256.test(receipt.mainInventorySha256 ?? "")
      || !SHA256.test(receipt.financeInventorySha256 ?? "")
      || !SHA256.test(receipt.functionInventorySha256 ?? "")
      || !(receipt.hostedProofSha256 === null
        || SHA256.test(receipt.hostedProofSha256))
      || !(receipt.hostedD0ResponseSha256 === null
        || SHA256.test(receipt.hostedD0ResponseSha256))
      || (receipt.mutation !== "function-deploy"
        && (receipt.hostedProofSha256 !== null
          || receipt.hostedD0ResponseSha256 !== null))
      || (receipt.mutation === "function-deploy" && receipt.outcome === "applied"
        && (receipt.hostedProofSha256 === null
          || receipt.hostedD0ResponseSha256 === null))
      || (receipt.mutation === "function-deploy" && receipt.outcome !== "applied"
        && (receipt.hostedProofSha256 !== null
          || receipt.hostedD0ResponseSha256 !== null))
    ) refuse("reconciliation causal binding differs");
    if (
      receipt.mutation === "secrets-set"
      && !amendedSecretReconciliation
      && !["applied", "not_applied", "diverged"].includes(receipt.outcome)
    ) refuse("legacy secret reconciliation outcome differs");
    if (amendedSecretReconciliation) {
      const satisfied = receipt.outcome === "state_satisfied";
      const unsatisfied = receipt.outcome === "state_unsatisfied";
      if (
        (!satisfied && !unsatisfied && receipt.outcome !== "diverged")
        || receipt.observation !== (
          satisfied ? "installed_observed" : (unsatisfied ? "baseline_observed" : "diverged")
        )
        || receipt.state !== (
          satisfied ? "state_satisfied" : (unsatisfied ? "state_unsatisfied" : "diverged")
        )
        || receipt.causalAttribution !== false
        || !["unchanged", "exact-all-existing-plus-one", "diverged"]
          .includes(receipt.functionVersionTransitionDisposition)
        || (secretsOnlyReconciliation && receipt.outcome === "diverged"
          && receipt.functionVersionTransitionDisposition !== "diverged")
        || (secretsOnlyReconciliation && satisfied
          && !["unchanged", "exact-all-existing-plus-one"]
            .includes(receipt.functionVersionTransitionDisposition))
        || receipt.inventoryReadRounds !== unresolvedIntent?.requiredStableReadRounds
        || typeof receipt.stableObservation !== "boolean"
        || (receipt.outcome !== "diverged" && receipt.stableObservation !== true)
        || (!receipt.stableObservation
          && receipt.functionVersionTransitionDisposition !== "diverged")
        || (unsatisfied
          && receipt.functionVersionTransitionDisposition !== "unchanged")
        || (receipt.functionVersionTransitionDisposition !== "diverged"
          && receipt.functionInventorySha256 !== (
            receipt.functionVersionTransitionDisposition === "unchanged"
              ? unresolvedIntent?.unchangedFunctionInventorySha256
              : unresolvedIntent?.exactAllExistingPlusOneFunctionInventorySha256
          ))
        || !SHA256.test(receipt.predecessorAdoptionSha256 ?? "")
        || receipt.predecessorAdoptionSha256
          !== unresolvedIntent?.predecessorAdoptionSha256
      ) refuse("amended secret reconciliation observation evidence differs");
    }
    if (secretsOnlyReconciliation && (
      receipt.schemaVersion !== 3
      || !SHA256.test(receipt.semanticMainInventorySha256 ?? "")
      || !(receipt.metadataOnlyDeltaNames === null
        || Array.isArray(receipt.metadataOnlyDeltaNames))
      || (Array.isArray(receipt.metadataOnlyDeltaNames)
        && (
          canonicalJson([...receipt.metadataOnlyDeltaNames].sort())
            !== canonicalJson(receipt.metadataOnlyDeltaNames)
          || new Set(receipt.metadataOnlyDeltaNames).size
            !== receipt.metadataOnlyDeltaNames.length
          || receipt.metadataOnlyDeltaNames.some(name =>
            !SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name))
        ))
      || !(receipt.metadataOnlyDeltaSha256 === null
        || SHA256.test(receipt.metadataOnlyDeltaSha256 ?? ""))
      || (receipt.outcome === "diverged"
        ? !(
          receipt.metadataOnlyDeltaNames === null
          && receipt.metadataOnlyDeltaSha256 === null
        )
        : !(
          Array.isArray(receipt.metadataOnlyDeltaNames)
          && SHA256.test(receipt.metadataOnlyDeltaSha256 ?? "")
        ))
      || canonicalJson(receipt.mutationSecretNames)
        !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
      || receipt.mutationSecretNameSetSha256
        !== unresolvedPlan.mutationSecretNameSetSha256
      || receipt.mutationSecretDigestSetSha256
        !== unresolvedPlan.mutationSecretDigestSetSha256
      || receipt.predecessorReceiptChainSha256
        !== unresolvedPlan.predecessorReceiptChainSha256
      || receipt.functionAllExistingPlusOneSha256
        !== unresolvedIntent?.exactAllExistingPlusOneFunctionInventorySha256
      || receipt.functionAllExistingPlusOneSha256
        !== unresolvedPlan.functionAllExistingPlusOneSha256
      || receipt.functionDeployCount !== 0
    )) refuse("secrets-only reconciliation evidence differs");
    return;
  }
  if (receipt.kind === "release-complete") {
    const cause = prior.at(-1);
    const plan = [...prior].reverse().find(item => item.kind === "release-plan");
    const secretsOnlyPlan = isTerminalDivergedPredecessorAdoption(
      plan?.predecessorAdoption,
    );
    exact([
      "status", "mainProjectRef", "financeProjectRef", "sourceCommitSha",
      "sourceTreeSha", "sourceParentSha", "baseTreeSha", "changedPaths",
      "changedPathSetSha256", "trackedFileCount", "workflowPath", "workflowBlobSha",
      "sourceCiRunId", "sourceCiRunApiSha256", "sourceCiJobsApiSha256",
      "sourceCiBranchApiSha256", "sourceCiConclusion",
      "sourceProvenanceFileSha256", "sourceProvenanceDescriptorSha256",
      "releaseManifestSha256",
      "deploymentClosureSha256", "sourceArchiveSha256", "supabaseArchiveSha256",
      "operatorDescriptorFileSha256", "productionBoundarySha256",
      "targetDescriptorSha256", "functionInventorySha256",
      "causalHostedProofSha256", "d0", "hostedProof", "d1",
      "d0MainInventorySha256", "d0FinanceInventorySha256",
      "d0FunctionInventorySha256",
      "d1MainInventorySha256", "d1FinanceInventorySha256",
      "d1FunctionInventorySha256",
      "automaticRetryPerformed", "productionTouched",
      ...(secretsOnlyPlan ? [
        "completionCauseReceiptSha256", "semanticMainInventorySha256",
        "metadataOnlyDeltaNames", "metadataOnlyDeltaSha256",
        "mutationSecretNames", "mutationSecretNameSetSha256",
        "mutationSecretDigestSetSha256", "predecessorReceiptChainSha256",
        "functionAllExistingPlusOneSha256", "hostedMutationCount",
        "functionDeployCount",
      ] : []),
    ]);
    validateReceiptSourceEvidence(receipt);
    validateSafeSnapshotEvidence(receipt.d0, "release completion D0");
    validateSafeSnapshotEvidence(receipt.d1, "release completion D1");
    exactKeys(receipt.hostedProof, [
      "responseSha256", "proofSha256", "attestedAt", "checkedCount",
      "mismatchCount", "stateSha256",
    ], "release completion hosted proof");
    const stableSnapshot = snapshot => ({
      descriptorSha256: snapshot.descriptorSha256,
      stateSha256: snapshot.stateSha256,
      catalogSha256: snapshot.catalogSha256,
      gateInventorySha256: snapshot.gateInventorySha256,
      privacyInventorySha256: snapshot.privacyInventorySha256,
      checkedCount: snapshot.checkedCount,
    });
    if (
      receipt.status !== "verified" || !cause || receipt.sourceCiConclusion !== "success"
      || !plan
      || !(
        secretsOnlyPlan
          ? (
            (cause.kind === "mutation-result" && cause.mutation === "secrets-set"
              && cause.status === "verified")
            || (cause.kind === "reconciliation" && cause.mutation === "secrets-set"
              && cause.outcome === "state_satisfied")
          )
          : (
            (cause.kind === "mutation-result" && cause.mutation === "function-deploy"
              && cause.status === "verified")
            || (cause.kind === "reconciliation" && cause.mutation === "function-deploy"
              && cause.outcome === "applied")
          )
      )
      || receipt.mainProjectRef !== MAIN_REF || receipt.financeProjectRef !== FINANCE_REF
      || receipt.workflowPath !== ".github/workflows/verify-finance-integration.yml"
      || !DECIMAL.test(receipt.sourceCiRunId ?? "") || receipt.sourceCiRunId === "0"
      || [
        receipt.sourceCiRunApiSha256,
        receipt.sourceCiJobsApiSha256,
        receipt.sourceCiBranchApiSha256,
        receipt.sourceProvenanceFileSha256,
        receipt.sourceProvenanceDescriptorSha256,
        receipt.releaseManifestSha256,
        receipt.deploymentClosureSha256,
        receipt.sourceArchiveSha256,
        receipt.supabaseArchiveSha256,
        receipt.operatorDescriptorFileSha256,
        receipt.productionBoundarySha256,
        receipt.targetDescriptorSha256,
        receipt.functionInventorySha256,
        ...(secretsOnlyPlan ? [] : [receipt.causalHostedProofSha256]),
        receipt.d0MainInventorySha256,
        receipt.d0FinanceInventorySha256,
        receipt.d0FunctionInventorySha256,
        receipt.d1MainInventorySha256,
        receipt.d1FinanceInventorySha256,
        receipt.d1FunctionInventorySha256,
        receipt.hostedProof.responseSha256,
        receipt.hostedProof.proofSha256,
        receipt.hostedProof.stateSha256,
      ].some(digest => !SHA256.test(digest ?? ""))
      || !canonicalTimestamp(receipt.hostedProof.attestedAt)
      || !Number.isSafeInteger(receipt.hostedProof.checkedCount)
      || receipt.hostedProof.checkedCount < 1
      || receipt.hostedProof.mismatchCount !== 0
      || receipt.hostedProof.checkedCount !== receipt.d0.checkedCount
      || receipt.hostedProof.stateSha256 !== receipt.d0.stateSha256
      || canonicalJson(stableSnapshot(receipt.d0))
        !== canonicalJson(stableSnapshot(receipt.d1))
      || receipt.d0.responseSha256 === receipt.d1.responseSha256
      || Date.parse(receipt.d0.databaseClock)
        >= Date.parse(receipt.hostedProof.attestedAt)
      || Date.parse(receipt.hostedProof.attestedAt)
        >= Date.parse(receipt.d1.databaseClock)
      || Date.parse(receipt.recordedAt) <= Date.parse(receipt.d1.databaseClock)
      || receipt.functionInventorySha256 !== receipt.d1FunctionInventorySha256
      || receipt.d0MainInventorySha256 !== receipt.d1MainInventorySha256
      || receipt.d0FinanceInventorySha256 !== receipt.d1FinanceInventorySha256
      || receipt.d0FunctionInventorySha256 !== receipt.d1FunctionInventorySha256
      || (secretsOnlyPlan
        ? (
          receipt.schemaVersion !== 3
          || receipt.causalHostedProofSha256 !== null
          || receipt.completionCauseReceiptSha256 !== cause.receiptSha256
          || (cause.kind === "mutation-result"
            ? cause.afterFunctionInventorySha256
            : cause.functionInventorySha256) !== receipt.functionInventorySha256
          || !SHA256.test(receipt.semanticMainInventorySha256 ?? "")
          || !Array.isArray(receipt.metadataOnlyDeltaNames)
          || canonicalJson([...receipt.metadataOnlyDeltaNames].sort())
            !== canonicalJson(receipt.metadataOnlyDeltaNames)
          || new Set(receipt.metadataOnlyDeltaNames).size
            !== receipt.metadataOnlyDeltaNames.length
          || receipt.metadataOnlyDeltaNames.some(name =>
            !SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name))
          || !SHA256.test(receipt.metadataOnlyDeltaSha256 ?? "")
          || canonicalJson(receipt.mutationSecretNames)
            !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
          || receipt.mutationSecretNameSetSha256
            !== sha256(canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES))
          || receipt.mutationSecretDigestSetSha256
            !== plan.mutationSecretDigestSetSha256
          || receipt.predecessorReceiptChainSha256
            !== plan.predecessorReceiptChainSha256
          || receipt.functionAllExistingPlusOneSha256
            !== plan.functionAllExistingPlusOneSha256
          || receipt.hostedMutationCount !== 1
          || receipt.functionDeployCount !== 0
        )
        : (
          cause.hostedProofSha256 !== receipt.causalHostedProofSha256
          || receipt.hostedProof.proofSha256 === receipt.causalHostedProofSha256
          || cause.hostedD0ResponseSha256 === receipt.d0.responseSha256
          || cause.functionInventorySha256 !== receipt.functionInventorySha256
        ))
      || receipt.sourceCommitSha !== plan.sourceCommitSha
      || receipt.sourceTreeSha !== plan.sourceTreeSha
      || receipt.sourceParentSha !== plan.sourceParentSha
      || receipt.baseTreeSha !== plan.baseTreeSha
      || receipt.changedPathSetSha256 !== plan.changedPathSetSha256
      || canonicalJson(receipt.changedPaths) !== canonicalJson(plan.changedPaths)
      || receipt.trackedFileCount !== plan.trackedFileCount
      || receipt.workflowBlobSha !== plan.workflowBlobSha
      || receipt.sourceCiRunId !== plan.sourceCiRunId
      || receipt.sourceCiRunApiSha256 !== plan.sourceCiRunApiSha256
      || receipt.sourceCiJobsApiSha256 !== plan.sourceCiJobsApiSha256
      || receipt.sourceCiBranchApiSha256 !== plan.sourceCiBranchApiSha256
      || receipt.sourceProvenanceFileSha256 !== plan.sourceProvenanceFileSha256
      || receipt.sourceProvenanceDescriptorSha256
        !== plan.sourceProvenanceDescriptorSha256
      || receipt.releaseManifestSha256 !== plan.releaseManifestSha256
      || receipt.deploymentClosureSha256 !== plan.sourceDeploymentSha256
      || receipt.sourceArchiveSha256 !== plan.sourceArchiveSha256
      || receipt.supabaseArchiveSha256 !== plan.supabaseArchiveSha256
      || receipt.operatorDescriptorFileSha256
        !== plan.operatorDescriptorFileSha256
      || receipt.productionBoundarySha256 !== plan.productionBoundarySha256
      || receipt.targetDescriptorSha256 !== plan.targetDescriptorSha256
      || receipt.d0.catalogSha256 !== plan.snapshot.catalogSha256
      || receipt.d0.descriptorSha256 !== plan.snapshot.descriptorSha256
      || receipt.d0.stateSha256 !== plan.snapshot.stateSha256
      || receipt.d0.gateInventorySha256 !== plan.snapshot.gateInventorySha256
      || receipt.d0.privacyInventorySha256 !== plan.snapshot.privacyInventorySha256
      || receipt.d0.checkedCount !== plan.snapshot.checkedCount
      || receipt.automaticRetryPerformed !== false
      || receipt.productionTouched !== false
    ) refuse("release completion causal binding differs");
    return;
  }
  refuse("unknown receipt kind");
}

function safeSnapshotEvidence(snapshot) {
  return Object.freeze({
    databaseClock: snapshot.database_clock,
    responseSha256: snapshot.response_sha256,
    descriptorSha256: snapshot.descriptor_sha256,
    stateSha256: snapshot.state_sha256,
    catalogSha256: snapshot.catalog_sha256,
    gateInventorySha256: snapshot.gate_inventory_sha256,
    privacyInventorySha256: snapshot.privacy_secret_inventory_sha256,
    checkedCount: snapshot.checked_count,
  });
}

function expectedApproval(plan) {
  return [
    "MAIN_FINANCE_RUNTIME_RECOVERY_V2_APPROVED=DEPLOY",
    MAIN_REF,
    plan.sourceCommitSha,
    plan.sourceTreeSha,
    plan.sourceCiRunId,
    plan.sourceProvenanceFileSha256,
    plan.sourceProvenanceDescriptorSha256,
    plan.receiptSha256,
  ].join(":");
}

function latestPlan(chain) {
  const plan = [...chain].reverse().find(receipt => receipt.kind === "release-plan");
  if (!plan) refuse("a current release plan receipt is required");
  return plan;
}

function assertCurrentReleaseSecretsOnlyPlan(plan) {
  if (
    plan?.schemaVersion !== 3
    || plan.kind !== "release-plan"
    || plan.mutationScope !== "secrets-set"
    || plan.resumeFromReceiptSha256 !== null
    || !isTerminalDivergedPredecessorAdoption(plan.predecessorAdoption)
    || canonicalJson(plan.mutationSecretNames)
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
    || canonicalJson(plan.metadataOnlySecretNames)
      !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)
    || plan.plannedHostedMutationCount !== 1
    || plan.functionDeployCount !== 0
    || Object.hasOwn(plan, "deployMutationInputSha256")
    || Object.hasOwn(plan, "deployCommandArgsSha256")
  ) refuse("current release accepts only the schema-3 secrets-only successor plan");
  return plan;
}

function assertCurrentReleaseSecretsOnlyBundle(attestation, plan) {
  if (
    attestation?.schemaVersion !== 3
    || attestation.kind !== "main-finance-runtime-recovery-v3-private-bundle"
    || !isTerminalDivergedPredecessorAdoption(attestation.predecessorAdoption)
    || canonicalJson(attestation.predecessorAdoption)
      !== canonicalJson(plan.predecessorAdoption)
    || attestation.runtimeFile !== RUNTIME_PROOF_FILE
    || attestation.runtimeMutationFile !== SECRET_MUTATION_ENV_FILE
    || canonicalJson(attestation.mutationSecretNames)
      !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
    || !validSuccessorMutationSecretDigestMap(
      attestation.mutationSecretDigests,
    )
    || Object.hasOwn(attestation, "deployMutationInput")
    || Object.hasOwn(attestation, "deployWorkdir")
  ) refuse("current release accepts only the schema-3 secrets-only private bundle");
  return attestation;
}

function assertCurrentReleasePlanBeforeLease(receiptDirectory) {
  assertPrivateDirectory(receiptDirectory, "current receipt directory");
  const entries = readdirSync(receiptDirectory).sort();
  if (entries.some(name => !RECEIPT_PATTERN.test(name))) {
    refuse("current action receipt directory is not finalized before operation lease");
  }
  for (const name of [...entries].reverse()) {
    const source = readPrivateFile(
      path.join(receiptDirectory, name),
      "pre-lease release plan receipt",
      256 * 1024,
    );
    const receipt = readJsonSource(source, "pre-lease release plan receipt");
    if (receipt.kind !== "release-plan") continue;
    const { receiptSha256, ...core } = receipt;
    if (
      !SHA256.test(receiptSha256 ?? "")
      || receiptSha256 !== sha256(canonicalJson(core))
      || source !== `${canonicalJson(receipt)}\n`
    ) refuse("pre-lease release plan self-hash differs");
    return assertCurrentReleaseSecretsOnlyPlan(receipt);
  }
  refuse("a current release plan receipt is required before operation lease");
}

function postSecretFunctionBaselineFromChain(
  preinstallRows,
  chain,
  plan = latestPlan(chain),
) {
  const stageBaseline = normalizeFunctionInventoryRows(
    scopedFunctionVersionTransitionRows(
      preinstallRows,
      plan.functionVersionTransition.currentStageDisposition,
      plan.predecessorAdoption,
    ),
  );
  if (
    stageBaseline.sha256
      !== plan.functionVersionTransition.currentStageFunctionInventorySha256
  ) refuse("plan function stage baseline differs");
  const evidence = [...chain].reverse().find(receipt =>
    receipt.sequence > plan.sequence
    && receipt.mutation === "secrets-set"
    && (
      (receipt.kind === "mutation-result" && receipt.status === "verified")
      || (receipt.kind === "reconciliation" && receipt.outcome === "state_satisfied")
    ));
  if (evidence === undefined) return stageBaseline;
  const disposition = evidence.functionVersionTransitionDisposition;
  if (!["unchanged", "exact-all-existing-plus-one"].includes(disposition)) {
    refuse("post-secret function transition disposition is absent or differs");
  }
  const baseline = normalizeFunctionInventoryRows(
    scopedFunctionVersionTransitionRows(
      stageBaseline.rows,
      disposition,
      plan.predecessorAdoption,
    ),
  );
  const observedSha256 = evidence.kind === "mutation-result"
    ? evidence.afterFunctionInventorySha256
    : evidence.functionInventorySha256;
  if (baseline.sha256 !== observedSha256) {
    refuse("post-secret function transition hash differs");
  }
  return baseline;
}

function unresolvedReceipt(chain) {
  const latest = chain.at(-1);
  if (!latest) return null;
  if (latest.kind === "mutation-intent") return latest;
  if (latest.kind === "mutation-result" && latest.status === "unknown") return latest;
  if (latest.kind === "reconciliation" && latest.outcome === "diverged") return latest;
  return null;
}

function assertPlanAttestationBinding(
  plan,
  attestation,
  release,
  source,
  provenance,
) {
  if (
    plan.sourceCommitSha !== source.commit
    || plan.sourceTreeSha !== source.tree
    || plan.sourceCommitSha !== provenance.expectedCommitSha
    || plan.sourceTreeSha !== provenance.expectedTreeSha
    || plan.sourceCiRunId !== provenance.githubRunId
    || plan.sourceProvenanceFileSha256 !== provenance.fileSha256
    || plan.sourceProvenanceDescriptorSha256 !== provenance.descriptorSha256
    || plan.releaseManifestSha256 !== release.manifestSha256
    || plan.sourceDeploymentSha256 !== release.manifest.deploymentClosureSetSha256
    || plan.bundleAttestationSha256 !== attestation.attestationSha256
    || canonicalJson(plan.predecessorAdoption)
      !== canonicalJson(attestation.predecessorAdoption)
  ) refuse("plan attestation pre-plaintext authority differs");
}

function assertPlanEnvelopeBeforePlaintext(
  plan,
  attestation,
  release,
  source,
  provenance,
  ci,
  accessBoundary,
  stateDirectory,
) {
  assertPlanAttestationBinding(plan, attestation, release, source, provenance);
  const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
    attestation.predecessorAdoption,
  );
  assertSuccessorPredecessorBaselineHashes({
    predecessorAdoption: attestation.predecessorAdoption,
    mainInventorySha256: attestation.preinstallMainInventorySha256,
    financeInventorySha256: attestation.preinstallFinanceInventorySha256,
    functionInventorySha256: attestation.preinstallFunctionInventorySha256,
    functionCount: plan.functionVersionTransition.existingFunctionCount,
    label: "plan envelope successor baseline",
  });
  if (
    plan.sourceParentSha !== source.parent
    || plan.baseTreeSha !== source.baseTree
    || canonicalJson(plan.changedPaths) !== canonicalJson(source.changedPaths)
    || plan.changedPathSetSha256 !== source.changedPathSetSha256
    || plan.trackedFileCount !== source.trackedFileCount
    || plan.workflowBlobSha !== source.workflowBlobSha
    || plan.supabaseArchiveSha256 !== source.supabaseArchiveSha256
    || !sourceCiMatchesPlan(ci, plan)
    || plan.sourceArchiveSha256 !== attestation.sourceArchiveSha256
    || plan.operatorDescriptorFileSha256
      !== attestation.operatorDescriptorFileSha256
    || plan.runtimeMutationInputSha256
      !== sha256(canonicalJson(attestation.runtimeMutationInput))
    || (!secretsOnlySuccessor
      && plan.deployMutationInputSha256
        !== sha256(canonicalJson(attestation.deployMutationInput)))
    || plan.runtimeCommandArgsSha256 !== sha256(canonicalJson([
      "secrets", "set", "--project-ref", MAIN_REF,
      "--env-file", path.join(
        stateDirectory,
        secretsOnlySuccessor ? SECRET_MUTATION_ENV_FILE : RUNTIME_ENV_FILE,
      ), "--yes",
    ]))
    || (!secretsOnlySuccessor
      && plan.deployCommandArgsSha256 !== sha256(canonicalJson([
      "functions", "deploy", FUNCTION_NAME, "--project-ref", MAIN_REF,
      "--no-verify-jwt", "--use-api", "--workdir",
      path.join(stateDirectory, DEPLOY_WORKDIR), "--yes",
    ])))
    || (secretsOnlySuccessor && (
      plan.schemaVersion !== 3
      || plan.mutationScope !== "secrets-set"
      || plan.mutationSecretNameSetSha256
        !== sha256(canonicalJson(attestation.mutationSecretNames))
      || plan.mutationSecretDigestSetSha256
        !== sha256(canonicalJson(attestation.mutationSecretDigests))
      || plan.functionDeployCount !== 0
      || plan.plannedHostedMutationCount !== 1
    ))
    || plan.productionBoundarySha256 !== attestation.productionBoundarySha256
    || plan.targetDescriptorSha256 !== attestation.targetDescriptorSha256
    || attestation.productionBoundarySha256
      !== accessBoundary.productionBoundarySha256
    || attestation.targetDescriptorSha256
      !== accessBoundary.targetDescriptorSha256
    || plan.snapshot.catalogSha256 !== attestation.catalogSha256
    || plan.snapshot.descriptorSha256 !== attestation.descriptorSha256
    || plan.snapshot.stateSha256 !== attestation.stateSha256
    || plan.snapshot.gateInventorySha256 !== attestation.gateInventorySha256
    || plan.snapshot.privacyInventorySha256 !== attestation.privacyInventorySha256
    || plan.snapshot.checkedCount !== attestation.checkedCount
    || plan.functionVersionTransition.beforeFunctionInventorySha256
      !== attestation.preinstallFunctionInventorySha256
  ) refuse("plan full envelope pre-plaintext authority differs");
}

function assertPlanEnvelopeCurrentBeforePlaintext(
  plan,
  attestation,
  release,
  source,
  provenance,
  ci,
  accessBoundary,
  stateDirectory,
  approval,
  now,
) {
  assertPlanEnvelopeBeforePlaintext(
    plan,
    attestation,
    release,
    source,
    provenance,
    ci,
    accessBoundary,
    stateDirectory,
  );
  if (
    plan.status !== "pending"
    || !canonicalTimestamp(plan.expiresAt)
    || Date.parse(plan.expiresAt) <= now.getTime()
    || Date.parse(plan.expiresAt) - now.getTime() > 240_000
    || approval !== expectedApproval(plan)
  ) refuse("plan approval is absent, stale or bound to different evidence");
}

function assertPlanAttestationCurrent(
  plan,
  attestation,
  release,
  source,
  provenance,
  approval,
  now,
) {
  assertPlanAttestationBinding(
    plan,
    attestation,
    release,
    source,
    provenance,
  );
  if (
    plan.status !== "pending"
    || !canonicalTimestamp(plan.expiresAt)
    || Date.parse(plan.expiresAt) <= now.getTime()
    || Date.parse(plan.expiresAt) - now.getTime() > 240_000
    || approval !== expectedApproval(plan)
  ) refuse("plan approval is absent, stale or bound to different evidence");
}

function assertPlanCurrent(
  plan,
  bundle,
  release,
  source,
  provenance,
  approval,
  now,
) {
  assertPlanAttestationCurrent(
    plan,
    bundle.attestation,
    release,
    source,
    provenance,
    approval,
    now,
  );
}

function sourceCiMatchesPlan(ci, plan) {
  return ci.runId === plan.sourceCiRunId
    && ci.runApiSha256 === plan.sourceCiRunApiSha256
    && ci.jobsApiSha256 === plan.sourceCiJobsApiSha256
    && ci.branchApiSha256 === plan.sourceCiBranchApiSha256
    && ci.workflowBlobSha === plan.workflowBlobSha
    && ci.headSha === plan.sourceCommitSha
    && ci.conclusion === "success";
}

function inventoryMatchesInstall(
  before,
  after,
  expectedDigests,
  permittedNames,
) {
  if (permittedNames.some(name =>
    !after.has(name)
    || !Object.hasOwn(expectedDigests, name)
    || after.get(name).value !== expectedDigests[name])) return false;
  const names = new Set([...before.keys(), ...after.keys()]);
  for (const name of names) {
    const previous = before.get(name);
    const current = after.get(name);
    if (permittedNames.includes(name)) {
      if (!current || current.value !== expectedDigests[name]) return false;
      continue;
    }
    if (
      !previous
      || !current
      || previous.value !== current.value
      || previous.updatedAt !== current.updatedAt
    ) return false;
  }
  return true;
}

function inventoryHasExactNameSet(before, after) {
  return canonicalJson([...before.keys()].sort())
    === canonicalJson([...after.keys()].sort());
}

function inventoryMatchesMetadataOnlyDrift(before, after, allowedNames) {
  if (
    canonicalJson([...allowedNames].sort())
      !== canonicalJson([...SUCCESSOR_METADATA_ONLY_SECRET_NAMES].sort())
    || !inventoryHasExactNameSet(before, after)
  ) return false;
  for (const [name, previous] of before) {
    const current = after.get(name);
    if (
      current === undefined
      || current.value !== previous.value
      || (!allowedNames.includes(name) && current.updatedAt !== previous.updatedAt)
    ) return false;
  }
  return true;
}

function inventoryMatchesSuccessorInstall(
  before,
  after,
  expectedDigests,
  mutationNames,
) {
  if (
    canonicalJson([...mutationNames].sort()) !== canonicalJson([
      "MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA",
      "MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256",
      "MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA",
    ])
    || !inventoryHasExactNameSet(before, after)
  ) return false;
  for (const [name, previous] of before) {
    const current = after.get(name);
    if (current === undefined) return false;
    if (mutationNames.includes(name)) {
      if (current.value !== expectedDigests[name]) return false;
      continue;
    }
    if (current.value !== previous.value) return false;
    if (
      !SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name)
      && current.updatedAt !== previous.updatedAt
    ) return false;
  }
  return true;
}

function inventoryMatchesFullInstallWithMetadataDrift(
  before,
  after,
  expectedDigests,
  managedNames,
) {
  if (!inventoryHasExactNameSet(before, after)) return false;
  for (const [name, previous] of before) {
    const current = after.get(name);
    if (current === undefined) return false;
    if (managedNames.includes(name)) {
      if (current.value !== expectedDigests[name]) return false;
      continue;
    }
    if (current.value !== previous.value) return false;
    if (
      !SUCCESSOR_METADATA_ONLY_SECRET_NAMES.includes(name)
      && current.updatedAt !== previous.updatedAt
    ) return false;
  }
  return true;
}

function inventoryIsUnchanged(before, after) {
  return canonicalJson(inventoryCore(before)) === canonicalJson(inventoryCore(after));
}

function operatorRequestMessage(timestamp, bodySha256) {
  return [
    "main-finance-access-v2-request",
    "POST",
    `/functions/v1/${FUNCTION_NAME}`,
    timestamp,
    bodySha256,
  ].join("\n");
}

function attestationProofMessage(snapshot, timestamp) {
  return [
    "main-finance-access-v2-attestation",
    snapshot.source_deployment_sha256,
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

async function hostedAttest({ snapshot, operatorSecret, fetchImpl, now }) {
  const body = canonicalJson(edgeRequest(snapshot));
  const timestampValue = now().getTime();
  if (
    !Number.isSafeInteger(timestampValue)
    || !/^[1-9][0-9]{12}$/u.test(String(timestampValue))
  ) return null;
  const timestamp = String(timestampValue);
  const signature = createHmac("sha256", operatorSecret)
    .update(operatorRequestMessage(timestamp, sha256(body)))
    .digest("hex");
  let response;
  try {
    response = await fetchImpl(FUNCTION_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        [OPERATOR_HEADER]: signature,
        [OPERATOR_TIMESTAMP_HEADER]: timestamp,
      },
      body,
    });
  } catch {
    return null;
  }
  if (
    response.status !== 200
    || response.redirected
    || !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu
      .test(response.headers.get("content-type") ?? "")
  ) return null;
  let source;
  try {
    source = await boundedResponseText(response, 64 * 1024, "Edge attestation");
    return verifyMainFinanceRuntimeRecoveryAttestResponse({
      d0: snapshot,
      sourceDeploymentSha256: snapshot.source_deployment_sha256,
      operatorSecret,
      responseSource: source,
      now,
    });
  } catch {
    return null;
  }
}

function validateSandwich(d0, proof, d1) {
  return validateMainFinanceRuntimeRecoverySnapshotSandwich({ d0, proof, d1 });
}

async function postflightSandwich(
  dependencies,
  release,
  source,
  bundle,
  postSecretFunctionBaselineRows,
) {
  const functions0 = fetchFunctionInventory(dependencies);
  if (!functionInventoryMatchesSoleAddition(
    functions0,
    postSecretFunctionBaselineRows,
  )) return null;
  const inventories0 = fetchSecretInventories(dependencies);
  const d0 = await buildCurrentSnapshot(
    dependencies,
    release,
    source,
    inventories0,
    "recovery",
  );
  const proof = await hostedAttest({
    snapshot: d0,
    operatorSecret: bundle.runtime.values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2,
    fetchImpl: dependencies.fetchImpl,
    now: dependencies.now,
  });
  if (!proof) return null;
  const inventories1 = fetchSecretInventories(dependencies);
  const d1 = await buildCurrentSnapshot(
    dependencies,
    release,
    source,
    inventories1,
    "recovery",
  );
  const functions1 = fetchFunctionInventory(dependencies);
  const installed = inventories => inventoryMatchesInstall(
    bundle.preinstallInventories.main,
    inventories.main,
    bundle.attestation.expectedSecretDigests,
    bundle.attestation.secretNames,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance);
  if (
    !validateSandwich(d0, proof, d1)
    || !snapshotMatchesBundle(d0, bundle)
    || !snapshotMatchesBundle(d1, bundle)
    || !installed(inventories0)
    || !installed(inventories1)
    || inventories0.mainInventorySha256 !== inventories1.mainInventorySha256
    || inventories0.financeInventorySha256 !== inventories1.financeInventorySha256
    || !functionInventoryMatchesSoleAddition(
      functions1,
      postSecretFunctionBaselineRows,
    )
    || canonicalJson(functions0.rows) !== canonicalJson(functions1.rows)
  ) return null;
  return Object.freeze({
    d0,
    proof,
    d1,
    d0MainInventorySha256: inventories0.mainInventorySha256,
    d0FinanceInventorySha256: inventories0.financeInventorySha256,
    d0FunctionInventorySha256: functions0.sha256,
    d1MainInventorySha256: inventories1.mainInventorySha256,
    d1FinanceInventorySha256: inventories1.financeInventorySha256,
    d1FunctionInventorySha256: functions1.sha256,
    functionInventory: functions1,
  });
}

async function postflightSecretsOnlySuccessorSandwich(
  dependencies,
  release,
  source,
  bundle,
  exactFunctionRows,
) {
  if (!isTerminalDivergedPredecessorAdoption(
    bundle.attestation.predecessorAdoption,
  )) refuse("secrets-only postflight bundle variant differs");
  const expectedFunctions = normalizeFunctionInventoryRows(exactFunctionRows);
  const functions0 = fetchFunctionInventory(dependencies);
  if (!functionInventoryMatchesPostSecretBaseline(
    functions0,
    expectedFunctions.rows,
  )) return null;
  const inventories0 = fetchSecretInventories(dependencies);
  const installed = inventories => inventoryMatchesSuccessorInstall(
    bundle.preinstallInventories.main,
    inventories.main,
    bundle.attestation.mutationSecretDigests,
    bundle.attestation.mutationSecretNames,
  ) && inventoryIsUnchanged(
    bundle.preinstallInventories.finance,
    inventories.finance,
  );
  if (!installed(inventories0)) return null;
  const d0 = await buildCurrentSnapshot(
    dependencies,
    release,
    source,
    inventories0,
    "recovery",
  );
  const proof = await hostedAttest({
    snapshot: d0,
    operatorSecret: bundle.runtime.values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2,
    fetchImpl: dependencies.fetchImpl,
    now: dependencies.now,
  });
  if (!proof) return null;
  const inventories1 = fetchSecretInventories(dependencies);
  const d1 = await buildCurrentSnapshot(
    dependencies,
    release,
    source,
    inventories1,
    "recovery",
  );
  const functions1 = fetchFunctionInventory(dependencies);
  if (
    !validateSandwich(d0, proof, d1)
    || !snapshotMatchesBundle(d0, bundle)
    || !snapshotMatchesBundle(d1, bundle)
    || !installed(inventories1)
    || inventories0.mainInventorySha256 !== inventories1.mainInventorySha256
    || inventories0.financeInventorySha256 !== inventories1.financeInventorySha256
    || !functionInventoryMatchesPostSecretBaseline(
      functions1,
      expectedFunctions.rows,
    )
    || canonicalJson(functions0.rows) !== canonicalJson(functions1.rows)
  ) return null;
  const unrelatedBefore = inventoryWithoutNames(
    bundle.preinstallInventories.main,
    bundle.attestation.mutationSecretNames,
  );
  const unrelatedAfter = inventoryWithoutNames(
    inventories1.main,
    bundle.attestation.mutationSecretNames,
  );
  const metadataDelta = metadataOnlyInventoryDelta(
    unrelatedBefore,
    unrelatedAfter,
  );
  return Object.freeze({
    d0,
    proof,
    d1,
    d0MainInventorySha256: inventories0.mainInventorySha256,
    d0FinanceInventorySha256: inventories0.financeInventorySha256,
    d0FunctionInventorySha256: functions0.sha256,
    d1MainInventorySha256: inventories1.mainInventorySha256,
    d1FinanceInventorySha256: inventories1.financeInventorySha256,
    d1FunctionInventorySha256: functions1.sha256,
    semanticMainInventorySha256: semanticSecretInventorySha256(inventories1.main),
    metadataDelta,
    inventories: inventories1,
    functionInventory: functions1,
  });
}

function exactNow(now) {
  const value = now();
  if (
    !(value instanceof Date)
    || !Number.isFinite(value.getTime())
    || value.toISOString() !== new Date(value.getTime()).toISOString()
  ) refuse("operator clock differs");
  return value;
}

function snapshotMatchesBundle(snapshot, bundle) {
  return snapshot.catalog_sha256 === bundle.attestation.catalogSha256
    && snapshot.descriptor_sha256 === bundle.attestation.descriptorSha256
    && snapshot.state_sha256 === bundle.attestation.stateSha256
    && snapshot.gate_inventory_sha256 === bundle.attestation.gateInventorySha256
    && snapshot.privacy_secret_inventory_sha256 === bundle.attestation.privacyInventorySha256
    && snapshot.checked_count === bundle.attestation.checkedCount;
}

function functionTargetState(inventory) {
  if (!inventory.target) return "absent";
  if (inventory.target.slug !== FUNCTION_NAME) return "wrong-slug";
  if (inventory.target.verify_jwt !== false) return "wrong-verify-jwt";
  if (!["ACTIVE", "active"].includes(inventory.target.status)) return "wrong-status";
  if (inventory.target.version !== FIRST_FUNCTION_DEPLOYMENT_VERSION) {
    return "wrong-version";
  }
  return "exact";
}

function expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
  beforeRows,
) {
  const before = normalizeFunctionInventoryRows(beforeRows);
  if (before.target !== null) refuse("pre-secret target function must be absent");
  if (before.rows.some(row => row.version >= Number.MAX_SAFE_INTEGER)) {
    refuse("pre-secret function version cannot be incremented safely");
  }
  return Object.freeze(before.rows.map(row => Object.freeze({
    ...row,
    version: row.version + 1,
  })));
}

function expectedAllExistingPlusOneFunctionRows(beforeRows) {
  const before = normalizeFunctionInventoryRows(beforeRows);
  if (before.rows.some(row => row.version >= Number.MAX_SAFE_INTEGER)) {
    refuse("function version cannot be incremented safely");
  }
  return Object.freeze(before.rows.map(row => Object.freeze({
    ...row,
    version: row.version + 1,
  })));
}

function classifyAllExistingFunctionVersionTransition({ beforeRows, afterRows }) {
  const before = normalizeFunctionInventoryRows(beforeRows);
  const after = normalizeFunctionInventoryRows(afterRows);
  if (before.rows.length !== after.rows.length) return "diverged";
  if (canonicalJson(after.rows) === canonicalJson(before.rows)) return "unchanged";
  const expected = normalizeFunctionInventoryRows(
    expectedAllExistingPlusOneFunctionRows(before.rows),
  );
  return canonicalJson(after.rows) === canonicalJson(expected.rows)
    ? "exact-all-existing-plus-one"
    : "diverged";
}

function isTerminalDivergedPredecessorAdoption(value) {
  return value?.kind
    === "main-finance-runtime-recovery-v3-terminal-diverged-predecessor-adoption";
}

function classifyScopedFunctionVersionTransition({
  beforeRows,
  afterRows,
  predecessorAdoption,
}) {
  return isTerminalDivergedPredecessorAdoption(predecessorAdoption)
    ? classifyAllExistingFunctionVersionTransition({ beforeRows, afterRows })
    : classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows,
      afterRows,
    });
}

function scopedFunctionVersionTransitionRows(
  beforeRows,
  disposition,
  predecessorAdoption,
) {
  if (!isTerminalDivergedPredecessorAdoption(predecessorAdoption)) {
    return functionVersionTransitionBaselineRows(beforeRows, disposition);
  }
  const before = normalizeFunctionInventoryRows(beforeRows);
  if (disposition === "unchanged") return before.rows;
  if (disposition !== "exact-all-existing-plus-one") {
    refuse("successor function transition disposition differs");
  }
  return expectedAllExistingPlusOneFunctionRows(before.rows);
}

function classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
  beforeRows,
  afterRows,
}) {
  const before = normalizeFunctionInventoryRows(beforeRows);
  const after = normalizeFunctionInventoryRows(afterRows);
  if (before.target !== null || after.target !== null) return "diverged";
  if (before.rows.length !== after.rows.length) return "diverged";
  const expected = normalizeFunctionInventoryRows(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(before.rows),
  );
  if (canonicalJson(after.rows) === canonicalJson(before.rows)) return "unchanged";
  return canonicalJson(after.rows) === canonicalJson(expected.rows)
    ? "exact-all-existing-plus-one"
    : "diverged";
}

function functionVersionTransitionBaselineRows(beforeRows, disposition) {
  const before = normalizeFunctionInventoryRows(beforeRows);
  if (disposition === "unchanged") return before.rows;
  if (disposition !== "exact-all-existing-plus-one") {
    refuse("function transition stage disposition differs");
  }
  return expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(before.rows);
}

function functionInventoryMatchesPostSecretBaseline(inventory, baselineRows) {
  const expected = normalizeFunctionInventoryRows(baselineRows);
  return inventory.sha256 === expected.sha256
    && canonicalJson(inventory.rows) === canonicalJson(expected.rows);
}

export function classifyMainFinanceRuntimeRecoveryV2FunctionState({
  preinstallRows,
  currentRows,
}) {
  const preinstall = normalizeFunctionInventoryRows(preinstallRows);
  const current = normalizeFunctionInventoryRows(currentRows);
  if (preinstall.target !== null) refuse("preinstall target function must be absent");
  const targetState = functionTargetState(current);
  if (targetState === "absent") {
    return canonicalJson(current.rows) === canonicalJson(preinstall.rows)
      ? "absent" : "diverged";
  }
  if (targetState !== "exact") return targetState;
  const unrelated = current.rows.filter(row => row.slug !== FUNCTION_NAME);
  return canonicalJson(unrelated) === canonicalJson(preinstall.rows)
    ? "exact-sole-addition" : "diverged";
}

function assertMainFinanceRuntimeRecoveryV2ExactFunctionState(input) {
  const state = classifyMainFinanceRuntimeRecoveryV2FunctionState(input);
  if (state === "wrong-verify-jwt") refuse("target function verify_jwt differs");
  if (state === "wrong-status") refuse("target function status differs");
  if (state === "wrong-version") refuse("target function deployment version differs");
  if (state !== "exact-sole-addition") {
    refuse("target function inventory is not the exact sole addition");
  }
  return true;
}

function functionInventoryUnchanged(bundle, inventory) {
  return classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows: bundle.preinstallInventories.functions,
    currentRows: inventory.rows,
  }) === "absent"
    && inventory.sha256 === bundle.attestation.preinstallFunctionInventorySha256;
}

function functionInventoryMatchesSoleAddition(
  inventory,
  baselineRows,
) {
  return classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows: baselineRows,
    currentRows: inventory.rows,
  }) === "exact-sole-addition";
}

function classifyMainFinanceRuntimeRecoveryV2ReconciliationOutcome({
  mutation,
  secretState,
  functionState,
  postflightVerified,
  intentInventoryMatches,
}) {
  if (!["secrets-set", "function-deploy"].includes(mutation)) {
    refuse("reconciliation mutation differs");
  }
  if (!["preinstall", "installed", "diverged"].includes(secretState)) {
    refuse("reconciliation secret state differs");
  }
  if (![
    "absent", "exact-sole-addition", "wrong-verify-jwt", "wrong-status",
    "wrong-version", "diverged",
  ].includes(functionState)) refuse("reconciliation function state differs");
  if (
    typeof postflightVerified !== "boolean"
    || typeof intentInventoryMatches !== "boolean"
  ) refuse("reconciliation evidence state differs");
  if (mutation === "secrets-set") {
    if (functionState !== "absent") return "diverged";
    if (secretState === "installed") return "state_satisfied";
    return secretState === "preinstall" ? "state_unsatisfied" : "diverged";
  }
  if (secretState !== "installed") return "diverged";
  if (functionState === "exact-sole-addition") {
    return postflightVerified ? "applied" : "diverged";
  }
  if (functionState === "absent") {
    return intentInventoryMatches ? "not_applied" : "diverged";
  }
  return "diverged";
}

function assertPlainDeclarativeRecord(value, expectedKeys, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length !== 0
  ) refuse("declarative " + label + " record differs");
  const ownKeys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    canonicalJson([...ownKeys].sort())
      !== canonicalJson([...expectedKeys].sort())
    || Object.values(descriptors).some(descriptor =>
      !Object.hasOwn(descriptor, "value")
      || descriptor.enumerable !== true
      || typeof descriptor.value === "function"
      || typeof descriptor.value === "symbol")
  ) refuse("declarative " + label + " record differs");
}

function assertDeclarativeValueTree(value, seen = new Set()) {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isSafeInteger(value))
  ) return;
  if (
    typeof value !== "object"
    || utilTypes.isProxy(value)
    || seen.has(value)
  ) refuse("declarative value tree differs");
  seen.add(value);
  if (Array.isArray(value)) {
    if (
      Object.getPrototypeOf(value) !== Array.prototype
      || value.length > 10_000
    ) {
      refuse("declarative array prototype differs");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expectedKeys = [
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      "length",
    ];
    if (
      Object.getOwnPropertySymbols(value).length !== 0
      || canonicalJson(Reflect.ownKeys(value)) !== canonicalJson(expectedKeys)
      || expectedKeys.slice(0, -1).some(key =>
        !Object.hasOwn(descriptors[key], "value")
        || descriptors[key].enumerable !== true)
    ) refuse("declarative array differs");
    for (let index = 0; index < value.length; index += 1) {
      assertDeclarativeValueTree(descriptors[String(index)].value, seen);
    }
    seen.delete(value);
    return;
  }
  if (
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length !== 0
  ) refuse("declarative record tree differs");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(descriptor =>
    !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true)) {
    refuse("declarative accessors are forbidden");
  }
  for (const descriptor of Object.values(descriptors)) {
    assertDeclarativeValueTree(descriptor.value, seen);
  }
  seen.delete(value);
}

function validateDeclarativeReceiptChain(chain) {
  if (!Array.isArray(chain) || chain.length > 10_000) {
    refuse("declarative receipt chain differs");
  }
  const validated = [];
  let previous = null;
  for (const receipt of chain) {
    assertPlainDeclarativeRecord(
      receipt,
      Object.keys(receipt ?? {}),
      "receipt",
    );
    const { receiptSha256, ...core } = receipt;
    if (
        ![2, 3].includes(receipt.schemaVersion)
      || receipt.sequence !== validated.length + 1
      || receipt.previousReceiptSha256 !== previous
      || receipt.productionDenied !== true
      || !canonicalTimestamp(receipt.recordedAt)
      || !SHA256.test(receiptSha256 ?? "")
      || receiptSha256 !== sha256(canonicalJson(core))
      || (
        validated.length > 0
        && Date.parse(receipt.recordedAt)
          <= Date.parse(validated.at(-1).recordedAt)
      )
    ) refuse("declarative receipt hash chain differs");
    validateReceiptSemantic(receipt, validated);
    validated.push(receipt);
    previous = receiptSha256;
  }
  return validated;
}

function declarativeInventory(rows, label) {
  if (!Array.isArray(rows) || rows.length > 10_000) {
    refuse("declarative " + label + " inventory differs");
  }
  const result = new Map();
  for (const row of rows) {
    assertPlainDeclarativeRecord(
      row,
      ["name", "value", "updatedAt"],
      label + " inventory row",
    );
    if (
      typeof row.name !== "string"
      || !SECRET_NAME.test(row.name)
      || !SHA256.test(row.value ?? "")
      || !canonicalTimestamp(row.updatedAt)
      || result.has(row.name)
    ) refuse("declarative " + label + " inventory differs");
    result.set(row.name, Object.freeze({ ...row }));
  }
  return result;
}

function classifyDeclarativeSecretState(evidence) {
  if (evidence === null) return "not-required";
  const successor = Object.hasOwn(evidence, "metadataOnlyNames");
  assertPlainDeclarativeRecord(evidence, [
    "preinstallMain", "preinstallFinance", "currentMain", "currentFinance",
    "expectedDigests", "secretNames",
    ...(successor ? ["metadataOnlyNames"] : []),
  ], "secret evidence");
  const preinstallMain = declarativeInventory(
    evidence.preinstallMain,
    "preinstall Main",
  );
  const preinstallFinance = declarativeInventory(
    evidence.preinstallFinance,
    "preinstall Finance",
  );
  const currentMain = declarativeInventory(evidence.currentMain, "current Main");
  const currentFinance = declarativeInventory(
    evidence.currentFinance,
    "current Finance",
  );
  assertPlainDeclarativeRecord(
    evidence.expectedDigests,
    Object.keys(evidence.expectedDigests ?? {}),
    "expected secret digests",
  );
  if (
    !Array.isArray(evidence.secretNames)
    || evidence.secretNames.length < 1
    || new Set(evidence.secretNames).size !== evidence.secretNames.length
    || evidence.secretNames.some(name =>
      typeof name !== "string"
      || !SECRET_NAME.test(name)
      || !SHA256.test(evidence.expectedDigests[name] ?? ""))
    || canonicalJson(Object.keys(evidence.expectedDigests).sort())
      !== canonicalJson([...evidence.secretNames].sort())
  ) refuse("declarative expected secret evidence differs");
  if (successor && canonicalJson(evidence.metadataOnlyNames)
    !== canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES)) {
    refuse("declarative successor metadata-only allow-list differs");
  }
  const preinstallMainObserved = successor
    ? inventoryMatchesMetadataOnlyDrift(
      preinstallMain,
      currentMain,
      evidence.metadataOnlyNames,
    )
    : inventoryIsUnchanged(preinstallMain, currentMain);
  if (
    preinstallMainObserved
    && inventoryIsUnchanged(preinstallFinance, currentFinance)
  ) return "preinstall";
  const installed = successor
    ? inventoryMatchesSuccessorInstall(
      preinstallMain,
      currentMain,
      evidence.expectedDigests,
      evidence.secretNames,
    )
    : inventoryMatchesInstall(
      preinstallMain,
      currentMain,
      evidence.expectedDigests,
      evidence.secretNames,
    );
  return installed && inventoryIsUnchanged(preinstallFinance, currentFinance)
    ? "installed" : "diverged";
}

function declarativeFunctionStageBaselineRows(evidence, chain) {
  const plan = declarativeLatestPlan(chain);
  return plan === null
    || !Object.hasOwn(plan, "functionVersionTransition")
    ? evidence.preinstallRows
    : scopedFunctionVersionTransitionRows(
      evidence.preinstallRows,
      plan.functionVersionTransition.currentStageDisposition,
      plan.predecessorAdoption,
    );
}

function classifyDeclarativeFunctionState(evidence, chain) {
  if (evidence === null) return "not-required";
  const successorEvidence = Object.hasOwn(evidence, "successorBaseline");
  assertPlainDeclarativeRecord(
    evidence,
    ["preinstallRows", "currentRows", ...(successorEvidence
      ? ["successorBaseline"] : [])],
    "function evidence",
  );
  const current = normalizeFunctionInventoryRows(evidence.currentRows);
  const plan = declarativeLatestPlan(chain);
  const stageBaselineRows = declarativeFunctionStageBaselineRows(evidence, chain);
  if (
    successorEvidence && evidence.successorBaseline !== true
  ) refuse("declarative successor function marker differs");
  if (
    successorEvidence
    || isTerminalDivergedPredecessorAdoption(plan?.predecessorAdoption)
  ) {
    const transition = classifyAllExistingFunctionVersionTransition({
      beforeRows: stageBaselineRows,
      afterRows: current.rows,
    });
    return ["unchanged", "exact-all-existing-plus-one"].includes(transition)
      ? "absent" : "diverged";
  }
  if (current.target === null) {
    const transition = classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: stageBaselineRows,
      afterRows: current.rows,
    });
    return ["unchanged", "exact-all-existing-plus-one"].includes(transition)
      ? "absent" : "diverged";
  }
  if (plan === null) return "diverged";
  const baseline = postSecretFunctionBaselineFromChain(
    evidence.preinstallRows,
    chain,
    plan,
  ).rows;
  return classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows: baseline,
    currentRows: current.rows,
  });
}

function classifyDeclarativeMutationInput(evidence) {
  if (evidence === null) return "not-required";
  assertPlainDeclarativeRecord(
    evidence,
    ["expectedSha256", "currentSha256"],
    "mutation input evidence",
  );
  if (
    !SHA256.test(evidence.expectedSha256 ?? "")
    || !(evidence.currentSha256 === null
      || SHA256.test(evidence.currentSha256 ?? ""))
  ) refuse("declarative mutation input evidence differs");
  return evidence.currentSha256 === evidence.expectedSha256
    ? "exact" : "diverged";
}

function validateDeclarativeObservationEvidence(evidence) {
  if (evidence === null) return null;
  assertPlainDeclarativeRecord(evidence, [
    "inventoryReadRounds", "stableObservation",
    "firstMainInventorySha256", "firstFinanceInventorySha256",
    "firstFunctionInventorySha256", "secondMainInventorySha256",
    "secondFinanceInventorySha256", "secondFunctionInventorySha256",
  ], "inventory observation evidence");
  const digests = [
    evidence.firstMainInventorySha256,
    evidence.firstFinanceInventorySha256,
    evidence.firstFunctionInventorySha256,
    evidence.secondMainInventorySha256,
    evidence.secondFinanceInventorySha256,
    evidence.secondFunctionInventorySha256,
  ];
  const stable = evidence.firstMainInventorySha256
      === evidence.secondMainInventorySha256
    && evidence.firstFinanceInventorySha256
      === evidence.secondFinanceInventorySha256
    && evidence.firstFunctionInventorySha256
      === evidence.secondFunctionInventorySha256;
  if (
    evidence.inventoryReadRounds !== 2
    || typeof evidence.stableObservation !== "boolean"
    || digests.some(value => !SHA256.test(value ?? ""))
    || evidence.stableObservation !== stable
  ) refuse("declarative inventory observation evidence differs");
  return evidence;
}

function stableDeclarativeSnapshot(snapshot) {
  return Object.freeze({
    descriptorSha256: snapshot.descriptorSha256,
    stateSha256: snapshot.stateSha256,
    catalogSha256: snapshot.catalogSha256,
    gateInventorySha256: snapshot.gateInventorySha256,
    privacyInventorySha256: snapshot.privacyInventorySha256,
    checkedCount: snapshot.checkedCount,
  });
}

function validateDeclarativePostflightEvidence(evidence) {
  if (evidence === null) return null;
  assertPlainDeclarativeRecord(evidence, [
    "d0", "proof", "d1", "d0MainInventorySha256",
    "d0FinanceInventorySha256", "d0FunctionInventorySha256",
    "d1MainInventorySha256", "d1FinanceInventorySha256",
    "d1FunctionInventorySha256",
  ], "postflight evidence");
  validateSafeSnapshotEvidence(evidence.d0, "declarative D0");
  validateSafeSnapshotEvidence(evidence.d1, "declarative D1");
  assertPlainDeclarativeRecord(evidence.proof, [
    "responseSha256", "proofSha256", "attestedAt", "checkedCount",
    "mismatchCount", "stateSha256",
  ], "postflight proof");
  if (
    [
      evidence.proof.responseSha256,
      evidence.proof.proofSha256,
      evidence.proof.stateSha256,
      evidence.d0MainInventorySha256,
      evidence.d0FinanceInventorySha256,
      evidence.d0FunctionInventorySha256,
      evidence.d1MainInventorySha256,
      evidence.d1FinanceInventorySha256,
      evidence.d1FunctionInventorySha256,
    ].some(value => !SHA256.test(value ?? ""))
    || !canonicalTimestamp(evidence.proof.attestedAt)
    || !Number.isSafeInteger(evidence.proof.checkedCount)
    || evidence.proof.checkedCount < 1
    || evidence.proof.mismatchCount !== 0
    || evidence.proof.checkedCount !== evidence.d0.checkedCount
    || evidence.proof.stateSha256 !== evidence.d0.stateSha256
    || canonicalJson(stableDeclarativeSnapshot(evidence.d0))
      !== canonicalJson(stableDeclarativeSnapshot(evidence.d1))
    || evidence.d0.responseSha256 === evidence.d1.responseSha256
    || Date.parse(evidence.d0.databaseClock)
      >= Date.parse(evidence.proof.attestedAt)
    || Date.parse(evidence.proof.attestedAt)
      >= Date.parse(evidence.d1.databaseClock)
    || evidence.d0MainInventorySha256 !== evidence.d1MainInventorySha256
    || evidence.d0FinanceInventorySha256 !== evidence.d1FinanceInventorySha256
    || evidence.d0FunctionInventorySha256 !== evidence.d1FunctionInventorySha256
  ) refuse("declarative postflight sandwich differs");
  return evidence;
}

function assertDeclarativePostflightCurrentBinding(input, evidence) {
  if (evidence === null) refuse("declarative postflight evidence is absent");
  const current = declarativeCurrentInventoryHashes(input);
  if (
    current.main !== evidence.d1MainInventorySha256
    || current.finance !== evidence.d1FinanceInventorySha256
    || current.functions !== evidence.d1FunctionInventorySha256
  ) refuse("declarative postflight current inventory binding differs");
  return current;
}

function assertDeclarativeBundleBaselineBinding(input) {
  if (input.secretEvidence === null || input.functionEvidence === null) {
    refuse("declarative bundle baseline evidence is absent");
  }
  const preinstallMain = declarativeInventory(
    input.secretEvidence.preinstallMain,
    "bundle preinstall Main",
  );
  const preinstallFinance = declarativeInventory(
    input.secretEvidence.preinstallFinance,
    "bundle preinstall Finance",
  );
  const preinstallFunctions = normalizeFunctionInventoryRows(
    input.functionEvidence.preinstallRows,
  );
  if (
    sha256(canonicalJson(inventoryCore(preinstallMain)))
      !== input.bundle.preinstallMainInventorySha256
    || sha256(canonicalJson(inventoryCore(preinstallFinance)))
      !== input.bundle.preinstallFinanceInventorySha256
    || preinstallFunctions.sha256
      !== input.bundle.preinstallFunctionInventorySha256
  ) refuse("declarative bundle baseline binding differs");
  const successor = Object.hasOwn(
    input.bundle,
    "mutationSecretNameSetSha256",
  );
  if (
    input.bundle.preinstallMainInventorySha256 !== (successor
      ? TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalMainInventorySha256
      : PREDECESSOR_ADOPTION_PINS.installedMainInventorySha256)
    || input.bundle.preinstallFinanceInventorySha256 !== (successor
      ? TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
      : PREDECESSOR_ADOPTION_PINS.financeInventorySha256)
    || input.bundle.preinstallFunctionInventorySha256 !== (successor
      ? TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionInventorySha256
      : PREDECESSOR_ADOPTION_PINS.observedFunctionInventorySha256)
    || preinstallFunctions.rows.length !== (successor
      ? TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionCount
      : PREDECESSOR_ADOPTION_PINS.observedFunctionCount)
  ) refuse("declarative successor bundle baseline differs");
  if (successor && functionTargetState(preinstallFunctions) !== "exact") {
    refuse("declarative successor target baseline differs");
  }
}

function authorizeDeclarativeEffectPayload({
  input,
  chain,
  effect,
  nextScope,
  nextMutation,
  reconciliationOutcome,
  postflightEvidence,
}) {
  const chainTailSha256 = chain.at(-1)?.receiptSha256 ?? null;
  if (effect.startsWith("append-")) {
    assertPlainDeclarativeRecord(
      input.effectPayload,
      Object.keys(input.effectPayload ?? {}),
      "receipt effect payload",
    );
    assertReceiptPayloadEnvelopeFree(input.effectPayload);
    if (
      chain.length > 0
      && Date.parse(input.now) <= Date.parse(chain.at(-1).recordedAt)
    ) refuse("declarative receipt candidate clock differs");
    const core = {
      ...input.effectPayload,
      schemaVersion: receiptSchemaVersion(input.effectPayload, chain),
      sequence: chain.length + 1,
      previousReceiptSha256: chainTailSha256,
      productionDenied: true,
    };
    const receipt = {
      ...core,
      receiptSha256: sha256(canonicalJson(core)),
    };
    validateReceiptSemantic(receipt, chain);
    const expectedKind = {
      "append-catalog-measurement": "catalog-measurement",
      "append-release-plan": "release-plan",
      "append-mutation-intent": "mutation-intent",
      "append-unknown-result": "mutation-result",
      "append-verified-mutation-result": "mutation-result",
      "append-reconciliation": "reconciliation",
      "append-release-complete": "release-complete",
    }[effect];
    if (
      receipt.kind !== expectedKind
      || receipt.recordedAt !== input.now
      || (effect === "append-release-plan"
        && receipt.mutationScope !== nextScope)
      || (effect === "append-mutation-intent"
        && receipt.mutation !== nextMutation)
      || (effect === "append-unknown-result"
        && (receipt.status !== "unknown" || receipt.mutation !== nextMutation))
      || (effect === "append-verified-mutation-result"
        && (receipt.status !== "verified" || receipt.mutation !== input.mutation))
      || (effect === "append-reconciliation"
        && receipt.outcome !== reconciliationOutcome)
    ) refuse("declarative receipt effect payload differs");
    if (effect === "append-release-plan") {
      const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
        receipt.predecessorAdoption,
      );
      const current = declarativeCurrentInventoryHashes(input);
      const preinstallFunctions = normalizeFunctionInventoryRows(
        input.functionEvidence.preinstallRows,
      );
      const currentFunctions = normalizeFunctionInventoryRows(
        input.functionEvidence.currentRows,
      );
      const preinstallPlusOneFunctions = normalizeFunctionInventoryRows(
        secretsOnlySuccessor
          ? expectedAllExistingPlusOneFunctionRows(preinstallFunctions.rows)
          : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
            preinstallFunctions.rows,
          ),
      );
      const currentStagePlusOneFunctions = normalizeFunctionInventoryRows(
        secretsOnlySuccessor
          ? expectedAllExistingPlusOneFunctionRows(currentFunctions.rows)
          : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
            currentFunctions.rows,
          ),
      );
      const currentStageDisposition =
        classifyScopedFunctionVersionTransition({
          beforeRows: preinstallFunctions.rows,
          afterRows: currentFunctions.rows,
          predecessorAdoption: receipt.predecessorAdoption,
        });
      if (
        Date.parse(receipt.snapshot.databaseClock) > Date.parse(input.now)
          + input.release.futureClockSkewSeconds * 1_000
      ) refuse("declarative release plan snapshot exceeds future clock skew");
      if (
        receipt.mainProjectRef !== MAIN_REF
        || receipt.financeProjectRef !== FINANCE_REF
        || receipt.sourceCommitSha !== input.source.commit
        || receipt.sourceTreeSha !== input.source.tree
        || receipt.sourceParentSha !== input.source.parent
        || receipt.baseTreeSha !== input.source.baseTree
        || canonicalJson(receipt.changedPaths)
          !== canonicalJson(input.source.changedPaths)
        || receipt.changedPathSetSha256 !== input.source.changedPathSetSha256
        || receipt.trackedFileCount !== input.source.trackedFileCount
        || receipt.workflowBlobSha !== input.source.workflowBlobSha
        || receipt.sourceCiRunId !== input.ci.runId
        || receipt.sourceCiRunApiSha256 !== input.ci.runApiSha256
        || receipt.sourceCiJobsApiSha256 !== input.ci.jobsApiSha256
        || receipt.sourceCiBranchApiSha256 !== input.ci.branchApiSha256
        || receipt.sourceProvenanceFileSha256 !== input.provenance.fileSha256
        || receipt.sourceProvenanceDescriptorSha256
          !== input.provenance.descriptorSha256
        || receipt.releaseManifestSha256 !== input.release.manifestSha256
        || receipt.sourceDeploymentSha256
          !== input.release.sourceDeploymentSha256
        || receipt.bundleAttestationSha256 !== input.bundle.attestationSha256
        || receipt.sourceArchiveSha256 !== input.bundle.sourceArchiveSha256
        || receipt.supabaseArchiveSha256 !== input.source.supabaseArchiveSha256
        || receipt.operatorDescriptorFileSha256
          !== input.bundle.operatorDescriptorFileSha256
        || receipt.runtimeMutationInputSha256
          !== input.bundle.runtimeMutationInputSha256
        || (!secretsOnlySuccessor
          && receipt.deployMutationInputSha256
            !== input.bundle.deployMutationInputSha256)
        || receipt.runtimeCommandArgsSha256
          !== input.bundle.runtimeCommandArgsSha256
        || (!secretsOnlySuccessor
          && receipt.deployCommandArgsSha256
            !== input.bundle.deployCommandArgsSha256)
        || (secretsOnlySuccessor
          && (
            receipt.mutationSecretNameSetSha256
              !== input.bundle.mutationSecretNameSetSha256
            || receipt.mutationSecretDigestSetSha256
              !== input.bundle.mutationSecretDigestSetSha256
          ))
        || receipt.productionBoundarySha256
          !== input.bundle.productionBoundarySha256
        || receipt.targetDescriptorSha256 !== input.bundle.targetDescriptorSha256
        || receipt.mainInventorySha256 !== current.main
        || receipt.financeInventorySha256 !== current.finance
        || receipt.functionInventorySha256 !== current.functions
        || sha256(canonicalJson(receipt.predecessorAdoption))
          !== input.bundle.predecessorAdoptionSha256
        || receipt.functionVersionTransition.currentStageFunctionInventorySha256
          !== current.functions
        || receipt.functionVersionTransition.beforeFunctionInventorySha256
          !== input.bundle.preinstallFunctionInventorySha256
        || receipt.functionVersionTransition.unchangedFunctionInventorySha256
          !== preinstallFunctions.sha256
        || receipt.functionVersionTransition
          .exactAllExistingPlusOneFunctionInventorySha256
          !== preinstallPlusOneFunctions.sha256
        || receipt.functionVersionTransition.currentStageDisposition
          !== currentStageDisposition
        || receipt.functionVersionTransition
          .currentStageExactAllExistingPlusOneFunctionInventorySha256
          !== currentStagePlusOneFunctions.sha256
        || receipt.functionVersionTransition.existingFunctionCount
          !== preinstallFunctions.rows.length
        || receipt.functionVersionTransition.stableReadRounds !== 2
        || (receipt.mutationScope.includes("secrets-set")
          && receipt.functionVersionTransition.currentStageDisposition !== "unchanged")
        || receipt.snapshot.catalogSha256 !== input.bundle.catalogSha256
        || receipt.snapshot.descriptorSha256 !== input.bundle.descriptorSha256
        || receipt.snapshot.stateSha256 !== input.bundle.stateSha256
        || receipt.snapshot.gateInventorySha256
          !== input.bundle.gateInventorySha256
        || receipt.snapshot.privacyInventorySha256
          !== input.bundle.privacyInventorySha256
        || receipt.snapshot.checkedCount !== input.bundle.checkedCount
      ) refuse("declarative release plan payload binding differs");
    }
    if ([
      "append-mutation-intent", "append-verified-mutation-result",
      "append-reconciliation", "append-release-complete",
    ].includes(effect)) {
      const current = declarativeCurrentInventoryHashes(input);
      const effectPlan = declarativeLatestPlan(chain);
      const stageBaselineRows = declarativeFunctionStageBaselineRows(
        input.functionEvidence,
        chain,
      );
      const effectSecretsOnly = isTerminalDivergedPredecessorAdoption(
        effectPlan?.predecessorAdoption,
      );
      const effectCurrentMain = effectSecretsOnly
        ? declarativeInventory(
          input.secretEvidence.currentMain,
          "successor effect current Main",
        )
        : null;
      let effectMetadataDelta = null;
      if (effectSecretsOnly) {
        try {
          effectMetadataDelta = metadataOnlyInventoryDelta(
            inventoryWithoutNames(
              declarativeInventory(
                input.secretEvidence.preinstallMain,
                "successor effect preinstall Main",
              ),
              SUCCESSOR_SECRET_MUTATION_NAMES,
            ),
            inventoryWithoutNames(
              effectCurrentMain,
              SUCCESSOR_SECRET_MUTATION_NAMES,
            ),
          );
        } catch {
          effectMetadataDelta = null;
        }
      }
      if (
        (effect === "append-mutation-intent"
          && (receipt.beforeMainInventorySha256 !== current.main
            || receipt.beforeFinanceInventorySha256 !== current.finance
            || (receipt.mutation === "function-deploy"
              && (receipt.beforeFunctionInventorySha256 !== current.functions
                || receipt.sourceDeploymentSha256
                  !== input.release.sourceDeploymentSha256))
            || (receipt.mutation === "secrets-set"
              && (receipt.expectedSecretDigestSetSha256 !== sha256(canonicalJson(
                input.secretEvidence.expectedDigests,
              ))
                || canonicalJson(receipt.secretNames)
                  !== canonicalJson(input.secretEvidence.secretNames)
                || receipt.beforeFunctionInventorySha256 !== current.functions
                || effectPlan === null
                || receipt.unchangedFunctionInventorySha256
                  !== effectPlan.functionVersionTransition
                    .currentStageFunctionInventorySha256
                || receipt.exactAllExistingPlusOneFunctionInventorySha256
                  !== effectPlan.functionVersionTransition
                    .currentStageExactAllExistingPlusOneFunctionInventorySha256
                || receipt.requiredStableReadRounds
                  !== effectPlan.functionVersionTransition.stableReadRounds
                || receipt.predecessorAdoptionSha256
                  !== input.bundle.predecessorAdoptionSha256
                || (effectSecretsOnly && (
                  receipt.semanticBeforeMainInventorySha256
                    !== semanticSecretInventorySha256(effectCurrentMain)
                  || receipt.mutationSecretNameSetSha256
                    !== input.bundle.mutationSecretNameSetSha256
                  || receipt.metadataOnlySecretNameSetSha256
                    !== sha256(canonicalJson(SUCCESSOR_METADATA_ONLY_SECRET_NAMES))
                  || receipt.predecessorReceiptChainSha256
                    !== effectPlan.predecessorReceiptChainSha256
                  || receipt.functionAllExistingPlusOneSha256
                    !== effectPlan.functionAllExistingPlusOneSha256
                  || receipt.hostedMutationCount !== 0
                  || receipt.functionDeployCount !== 0
                ))))))
        || (effect === "append-verified-mutation-result"
          && receipt.mutation === "secrets-set"
          && (receipt.afterMainInventorySha256 !== current.main
            || receipt.afterFinanceInventorySha256 !== current.finance
            || receipt.afterFunctionInventorySha256 !== current.functions
            || receipt.predecessorAdoptionSha256
              !== input.bundle.predecessorAdoptionSha256
            || receipt.functionVersionTransitionDisposition
              !== classifyScopedFunctionVersionTransition({
                beforeRows: stageBaselineRows,
                afterRows: input.functionEvidence.currentRows,
                predecessorAdoption: effectPlan?.predecessorAdoption,
              })
            || receipt.functionInventoryStableReadRounds !== 2
            || receipt.observation !== "installed_observed"
            || receipt.state !== "state_satisfied"
            || receipt.causalAttribution !== false
            || (effectSecretsOnly && (
              effectMetadataDelta === null
              || receipt.semanticAfterMainInventorySha256
                !== semanticSecretInventorySha256(effectCurrentMain)
              || canonicalJson(receipt.metadataOnlyDeltaNames)
                !== canonicalJson(effectMetadataDelta.names)
              || receipt.metadataOnlyDeltaSha256 !== effectMetadataDelta.sha256
              || canonicalJson(receipt.mutationSecretNames)
                !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
              || receipt.mutationSecretNameSetSha256
                !== input.bundle.mutationSecretNameSetSha256
              || receipt.mutationSecretDigestSetSha256
                !== input.bundle.mutationSecretDigestSetSha256
              || receipt.predecessorReceiptChainSha256
                !== effectPlan.predecessorReceiptChainSha256
              || receipt.functionAllExistingPlusOneSha256
                !== effectPlan.functionAllExistingPlusOneSha256
              || receipt.hostedMutationCount !== 1
              || receipt.functionDeployCount !== 0
            ))))
        || (effect === "append-verified-mutation-result"
          && receipt.mutation === "function-deploy"
          && (postflightEvidence === null
            || receipt.functionInventorySha256 !== current.functions
            || receipt.hostedProofSha256
              !== postflightEvidence.proof.proofSha256
            || receipt.hostedD0ResponseSha256
              !== postflightEvidence.d0.responseSha256))
        || (effect === "append-reconciliation"
          && (receipt.mainInventorySha256 !== current.main
            || receipt.financeInventorySha256 !== current.finance
            || receipt.functionInventorySha256 !== current.functions
            || receipt.hostedProofSha256 !== (
              reconciliationOutcome === "applied"
              && receipt.mutation === "function-deploy"
                ? postflightEvidence?.proof.proofSha256 ?? null
                : null
            )
            || receipt.hostedD0ResponseSha256 !== (
              reconciliationOutcome === "applied"
              && receipt.mutation === "function-deploy"
                ? postflightEvidence?.d0.responseSha256 ?? null
                : null
            )
            || (receipt.mutation === "secrets-set" && (
              receipt.predecessorAdoptionSha256
                !== input.bundle.predecessorAdoptionSha256
              || receipt.causalAttribution !== false
              || input.observationEvidence === null
              || receipt.inventoryReadRounds
                !== input.observationEvidence.inventoryReadRounds
              || receipt.stableObservation
                !== input.observationEvidence.stableObservation
              || (reconciliationOutcome !== "diverged"
                && receipt.stableObservation !== true)
              || (!receipt.stableObservation
                && receipt.functionVersionTransitionDisposition !== "diverged")
              || (reconciliationOutcome === "state_unsatisfied"
                && receipt.functionVersionTransitionDisposition !== "unchanged")
              || receipt.functionVersionTransitionDisposition
                !== (effectSecretsOnly && reconciliationOutcome === "diverged"
                  ? "diverged"
                  : (receipt.stableObservation
                    ? classifyScopedFunctionVersionTransition({
                      beforeRows: stageBaselineRows,
                      afterRows: input.functionEvidence.currentRows,
                      predecessorAdoption: effectPlan?.predecessorAdoption,
                    })
                    : "diverged"))
              || receipt.observation !== (
                reconciliationOutcome === "state_satisfied"
                  ? "installed_observed"
                  : (reconciliationOutcome === "state_unsatisfied"
                    ? "baseline_observed" : "diverged")
              )
              || receipt.state !== reconciliationOutcome
              || (effectSecretsOnly && (
                receipt.semanticMainInventorySha256
                  !== semanticSecretInventorySha256(effectCurrentMain)
                || canonicalJson(receipt.metadataOnlyDeltaNames)
                  !== canonicalJson(reconciliationOutcome === "diverged"
                    ? null : effectMetadataDelta?.names ?? null)
                || receipt.metadataOnlyDeltaSha256
                  !== (reconciliationOutcome === "diverged"
                    ? null : effectMetadataDelta?.sha256 ?? null)
                || canonicalJson(receipt.mutationSecretNames)
                  !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
                || receipt.mutationSecretNameSetSha256
                  !== input.bundle.mutationSecretNameSetSha256
                || receipt.mutationSecretDigestSetSha256
                  !== input.bundle.mutationSecretDigestSetSha256
                || receipt.predecessorReceiptChainSha256
                  !== effectPlan.predecessorReceiptChainSha256
                || receipt.functionAllExistingPlusOneSha256
                  !== effectPlan.functionAllExistingPlusOneSha256
                || receipt.functionDeployCount !== 0
              ))
            ))))
        || (effect === "append-release-complete"
          && (postflightEvidence === null
            || receipt.sourceArchiveSha256 !== input.bundle.sourceArchiveSha256
            || receipt.supabaseArchiveSha256 !== input.source.supabaseArchiveSha256
            || receipt.operatorDescriptorFileSha256
              !== input.bundle.operatorDescriptorFileSha256
            || receipt.functionInventorySha256 !== current.functions
            || receipt.d1MainInventorySha256 !== current.main
            || receipt.d1FinanceInventorySha256 !== current.finance
            || receipt.d1FunctionInventorySha256 !== current.functions
            || canonicalJson(receipt.d0)
              !== canonicalJson(postflightEvidence.d0)
            || canonicalJson(receipt.hostedProof)
              !== canonicalJson(postflightEvidence.proof)
            || canonicalJson(receipt.d1)
              !== canonicalJson(postflightEvidence.d1)
            || (effectSecretsOnly && (
              effectMetadataDelta === null
              || receipt.semanticMainInventorySha256
                !== semanticSecretInventorySha256(effectCurrentMain)
              || canonicalJson(receipt.metadataOnlyDeltaNames)
                !== canonicalJson(effectMetadataDelta.names)
              || receipt.metadataOnlyDeltaSha256 !== effectMetadataDelta.sha256
              || canonicalJson(receipt.mutationSecretNames)
                !== canonicalJson(SUCCESSOR_SECRET_MUTATION_NAMES)
              || receipt.mutationSecretNameSetSha256
                !== input.bundle.mutationSecretNameSetSha256
              || receipt.mutationSecretDigestSetSha256
                !== input.bundle.mutationSecretDigestSetSha256
              || receipt.predecessorReceiptChainSha256
                !== effectPlan.predecessorReceiptChainSha256
              || receipt.functionAllExistingPlusOneSha256
                !== effectPlan.functionAllExistingPlusOneSha256
              || receipt.hostedMutationCount !== 1
              || receipt.functionDeployCount !== 0
            ))))
      ) refuse("declarative receipt raw evidence binding differs");
    }
    return Object.freeze({
      payloadSha256: sha256(canonicalJson(input.effectPayload)),
      authorizedReceiptSha256: receipt.receiptSha256,
      chainTailSha256,
    });
  }
  if (effect.startsWith("invoke-")) {
    if (
      input.release?.schemaVersion === 3
      && (nextMutation !== "secrets-set"
        || input.release.authorizedMutation !== "secrets-set"
        || input.release.functionDeployAuthorized !== false)
    ) refuse("current declarative mutation authority is secrets-set only");
    assertPlainDeclarativeRecord(input.effectPayload, [
      "kind", "mutation", "projectRef", "sourceDeploymentSha256",
      "mutationInputSha256", "argsSha256",
    ], "mutation command payload");
    if (
      input.effectPayload.kind !== "main-finance-runtime-recovery-v2-command"
      || input.effectPayload.mutation !== nextMutation
      || input.effectPayload.projectRef !== MAIN_REF
      || input.effectPayload.sourceDeploymentSha256
        !== input.release.sourceDeploymentSha256
      || input.effectPayload.mutationInputSha256
        !== input.mutationInputEvidence.expectedSha256
      || input.effectPayload.argsSha256 !== (
        nextMutation === "secrets-set"
          ? input.bundle.runtimeCommandArgsSha256
          : input.bundle.deployCommandArgsSha256
      )
    ) refuse("declarative mutation command payload differs");
    return Object.freeze({
      payloadSha256: sha256(canonicalJson(input.effectPayload)),
      authorizedReceiptSha256: null,
      chainTailSha256,
    });
  }
  if (input.effectPayload !== null) {
    refuse("declarative no-effect payload differs");
  }
  return Object.freeze({
    payloadSha256: null,
    authorizedReceiptSha256: null,
    chainTailSha256,
  });
}

function validateDeclarativeSourceAuthority(input, plan = null) {
  const currentRelease = input.release?.schemaVersion === 3;
  const secretsOnlySuccessor = currentRelease && Object.hasOwn(
    input.bundle ?? {},
    "mutationSecretNameSetSha256",
  );
  assertPlainDeclarativeRecord(
    input.release,
    [
      "manifestSha256", "sourceDeploymentSha256", "futureClockSkewSeconds",
      ...(currentRelease
        ? ["schemaVersion", "authorizedMutation", "functionDeployAuthorized"]
        : []),
    ],
    "release binding",
  );
  assertPlainDeclarativeRecord(input.source, [
    "commit", "tree", "parent", "baseTree", "changedPaths",
    "changedPathSetSha256", "trackedFileCount", "workflowBlobSha",
    "supabaseArchiveSha256",
  ], "source binding");
  assertPlainDeclarativeRecord(input.provenance, [
    "expectedCommitSha", "expectedTreeSha", "githubRunId", "fileSha256",
    "descriptorSha256",
  ], "provenance binding");
  assertPlainDeclarativeRecord(input.ci, [
    "runId", "runApiSha256", "jobsApiSha256", "branchApiSha256",
    "workflowBlobSha", "headSha", "conclusion",
  ], "CI binding");
  assertPlainDeclarativeRecord(
    input.bundle,
    [
      "attestationSha256", "catalogSha256", "descriptorSha256", "stateSha256",
      "gateInventorySha256", "privacyInventorySha256", "checkedCount",
      "preinstallMainInventorySha256", "preinstallFinanceInventorySha256",
      "preinstallFunctionInventorySha256", "runtimeMutationInputSha256",
      ...(secretsOnlySuccessor
        ? ["mutationSecretNameSetSha256", "mutationSecretDigestSetSha256"]
        : ["deployMutationInputSha256", "deployCommandArgsSha256"]),
      "productionBoundarySha256",
      "targetDescriptorSha256", "runtimeCommandArgsSha256",
      "sourceArchiveSha256",
      "operatorDescriptorFileSha256", "predecessorAdoptionSha256",
    ],
    "bundle binding",
  );
  validateReceiptChangedPaths(input.source.changedPaths);
  if (
    input.source.changedPathSetSha256 !== sha256(input.source.changedPaths
      .map(item => `${item.status}\0${item.path}\n`).join(""))
    || (currentRelease && (
      input.release.authorizedMutation !== "secrets-set"
      || input.release.functionDeployAuthorized !== false
      || !secretsOnlySuccessor
    ))
    || !SHA256.test(input.release.manifestSha256 ?? "")
    || !SHA256.test(input.release.sourceDeploymentSha256 ?? "")
    || input.release.futureClockSkewSeconds !== 30
    || !GIT_OID.test(input.source.commit ?? "")
    || !GIT_OID.test(input.source.tree ?? "")
    || input.source.parent !== BASE_COMMIT_SHA
    || input.source.baseTree !== BASE_TREE_SHA
    || !SHA256.test(input.source.changedPathSetSha256 ?? "")
    || !Number.isSafeInteger(input.source.trackedFileCount)
    || input.source.trackedFileCount < 1
    || !GIT_OID.test(input.source.workflowBlobSha ?? "")
    || !SHA256.test(input.source.supabaseArchiveSha256 ?? "")
    || input.provenance.expectedCommitSha !== input.source.commit
    || input.provenance.expectedTreeSha !== input.source.tree
    || !DECIMAL.test(input.provenance.githubRunId ?? "")
    || input.provenance.githubRunId === "0"
    || !SHA256.test(input.provenance.fileSha256 ?? "")
    || !SHA256.test(input.provenance.descriptorSha256 ?? "")
    || input.ci.runId !== input.provenance.githubRunId
    || input.ci.headSha !== input.source.commit
    || input.ci.workflowBlobSha !== input.source.workflowBlobSha
    || input.ci.conclusion !== "success"
    || [
      input.ci.runApiSha256,
      input.ci.jobsApiSha256,
      input.ci.branchApiSha256,
      input.bundle.attestationSha256,
      input.bundle.catalogSha256,
      input.bundle.descriptorSha256,
      input.bundle.stateSha256,
      input.bundle.gateInventorySha256,
      input.bundle.privacyInventorySha256,
      input.bundle.preinstallMainInventorySha256,
      input.bundle.preinstallFinanceInventorySha256,
      input.bundle.preinstallFunctionInventorySha256,
      input.bundle.runtimeMutationInputSha256,
      ...(secretsOnlySuccessor ? [
        input.bundle.mutationSecretNameSetSha256,
        input.bundle.mutationSecretDigestSetSha256,
      ] : [input.bundle.deployMutationInputSha256]),
      input.bundle.productionBoundarySha256,
      input.bundle.targetDescriptorSha256,
      input.bundle.runtimeCommandArgsSha256,
      ...(secretsOnlySuccessor ? [] : [input.bundle.deployCommandArgsSha256]),
      input.bundle.sourceArchiveSha256,
      input.bundle.operatorDescriptorFileSha256,
      input.bundle.predecessorAdoptionSha256,
    ].some(value => !SHA256.test(value ?? ""))
    || !Number.isSafeInteger(input.bundle.checkedCount)
    || input.bundle.checkedCount < 1
  ) refuse("declarative source, provenance or CI authority differs");
  if (
    plan !== null
    && Date.parse(plan.snapshot.databaseClock) > Date.parse(plan.recordedAt)
      + input.release.futureClockSkewSeconds * 1_000
  ) refuse("declarative plan snapshot exceeds future clock skew");
  if (
    plan !== null
    && (
      plan.sourceCommitSha !== input.source.commit
      || plan.sourceTreeSha !== input.source.tree
      || plan.sourceParentSha !== input.source.parent
      || plan.baseTreeSha !== input.source.baseTree
      || canonicalJson(plan.changedPaths)
        !== canonicalJson(input.source.changedPaths)
      || plan.changedPathSetSha256 !== input.source.changedPathSetSha256
      || plan.trackedFileCount !== input.source.trackedFileCount
      || plan.workflowBlobSha !== input.source.workflowBlobSha
      || plan.sourceCiRunId !== input.ci.runId
      || plan.sourceCiRunApiSha256 !== input.ci.runApiSha256
      || plan.sourceCiJobsApiSha256 !== input.ci.jobsApiSha256
      || plan.sourceCiBranchApiSha256 !== input.ci.branchApiSha256
      || plan.sourceProvenanceFileSha256 !== input.provenance.fileSha256
      || plan.sourceProvenanceDescriptorSha256
        !== input.provenance.descriptorSha256
      || plan.releaseManifestSha256 !== input.release.manifestSha256
      || plan.sourceDeploymentSha256
        !== input.release.sourceDeploymentSha256
      || plan.bundleAttestationSha256 !== input.bundle.attestationSha256
      || plan.sourceArchiveSha256 !== input.bundle.sourceArchiveSha256
      || plan.supabaseArchiveSha256 !== input.source.supabaseArchiveSha256
      || plan.operatorDescriptorFileSha256
        !== input.bundle.operatorDescriptorFileSha256
      || plan.runtimeMutationInputSha256
        !== input.bundle.runtimeMutationInputSha256
      || (!secretsOnlySuccessor
        && plan.deployMutationInputSha256
          !== input.bundle.deployMutationInputSha256)
      || plan.runtimeCommandArgsSha256 !== input.bundle.runtimeCommandArgsSha256
      || (!secretsOnlySuccessor
        && plan.deployCommandArgsSha256 !== input.bundle.deployCommandArgsSha256)
      || (secretsOnlySuccessor
        && (
          plan.mutationSecretNameSetSha256
            !== input.bundle.mutationSecretNameSetSha256
          || plan.mutationSecretDigestSetSha256
            !== input.bundle.mutationSecretDigestSetSha256
        ))
      || plan.productionBoundarySha256 !== input.bundle.productionBoundarySha256
      || plan.targetDescriptorSha256 !== input.bundle.targetDescriptorSha256
      || plan.snapshot.catalogSha256 !== input.bundle.catalogSha256
      || plan.snapshot.descriptorSha256 !== input.bundle.descriptorSha256
      || plan.snapshot.stateSha256 !== input.bundle.stateSha256
      || plan.snapshot.gateInventorySha256 !== input.bundle.gateInventorySha256
      || plan.snapshot.privacyInventorySha256 !== input.bundle.privacyInventorySha256
      || plan.snapshot.checkedCount !== input.bundle.checkedCount
      || !Object.hasOwn(plan, "functionVersionTransition")
      || !Object.hasOwn(plan, "predecessorAdoption")
      || plan.predecessorAdoption === null
      || sha256(canonicalJson(plan.predecessorAdoption))
        !== input.bundle.predecessorAdoptionSha256
      || plan.functionVersionTransition.beforeFunctionInventorySha256
        !== input.bundle.preinstallFunctionInventorySha256
      || (secretsOnlySuccessor
        ? plan.predecessorAdoption.terminalFunctionInventorySha256
            !== input.bundle.preinstallFunctionInventorySha256
        : plan.predecessorAdoption.observedFunctionInventorySha256
            !== input.bundle.preinstallFunctionInventorySha256)
      || (secretsOnlySuccessor
        ? plan.predecessorAdoption.terminalFunctionCount
            !== plan.functionVersionTransition.existingFunctionCount
        : plan.predecessorAdoption.observedFunctionCount
            !== plan.functionVersionTransition.existingFunctionCount)
      || plan.functionVersionTransition.currentStageFunctionInventorySha256
        !== plan.functionInventorySha256
      || plan.functionVersionTransition.exactAllExistingPlusOneFunctionInventorySha256
        !== normalizeFunctionInventoryRows(
          secretsOnlySuccessor
            ? expectedAllExistingPlusOneFunctionRows(
              input.functionEvidence.preinstallRows,
            )
            : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
              input.functionEvidence.preinstallRows,
            ),
        ).sha256
      || plan.functionVersionTransition
        .currentStageExactAllExistingPlusOneFunctionInventorySha256
        !== normalizeFunctionInventoryRows(
          secretsOnlySuccessor
            ? expectedAllExistingPlusOneFunctionRows(
              scopedFunctionVersionTransitionRows(
                input.functionEvidence.preinstallRows,
                plan.functionVersionTransition.currentStageDisposition,
                plan.predecessorAdoption,
              ),
            )
            : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
              functionVersionTransitionBaselineRows(
                input.functionEvidence.preinstallRows,
                plan.functionVersionTransition.currentStageDisposition,
              ),
            ),
        ).sha256
      || plan.functionVersionTransition.existingFunctionCount
        !== normalizeFunctionInventoryRows(
          input.functionEvidence.preinstallRows,
        ).rows.length
      || (plan.mutationScope.includes("secrets-set")
        && plan.functionVersionTransition.currentStageDisposition !== "unchanged")
      || !sourceCiMatchesPlan(input.ci, plan)
    )
  ) refuse("declarative plan evidence differs");
}

function declarativeLatestPlan(chain) {
  return [...chain].reverse().find(receipt => receipt.kind === "release-plan") ?? null;
}

function declarativeCurrentPlan(input, chain) {
  const plan = declarativeLatestPlan(chain);
  if (plan === null) refuse("declarative current plan is absent");
  validateDeclarativeSourceAuthority(input, plan);
  if (
    plan.status !== "pending"
    || !canonicalTimestamp(input.now)
    || Date.parse(plan.expiresAt) <= Date.parse(input.now)
    || Date.parse(plan.expiresAt) - Date.parse(input.now) > 240_000
    || input.approval !== expectedApproval(plan)
  ) refuse("declarative current plan approval differs");
  return plan;
}

function declarativeIntentForLatest(chain, plan, mutation) {
  const intent = chain.at(-1);
  if (
    intent?.kind !== "mutation-intent"
    || intent.status !== "pending"
    || intent.mutation !== mutation
    || intent.planReceiptSha256 !== plan.receiptSha256
    || intent.automaticRetryPerformed !== false
    || !plan.mutationScope.split("+").includes(mutation)
  ) refuse("declarative latest durable mutation intent differs");
  return intent;
}

function assertDeclarativeIntentBeforeEvidence(input, intent) {
  if (input.secretEvidence === null || input.functionEvidence === null) {
    refuse("declarative mutation intent raw evidence is absent");
  }
  const currentMain = declarativeInventory(
    input.secretEvidence.currentMain,
    "intent current Main",
  );
  const currentFinance = declarativeInventory(
    input.secretEvidence.currentFinance,
    "intent current Finance",
  );
  const currentFunction = normalizeFunctionInventoryRows(
    input.functionEvidence.currentRows,
  );
  if (
    intent.beforeMainInventorySha256
      !== sha256(canonicalJson(inventoryCore(currentMain)))
    || intent.beforeFinanceInventorySha256
      !== sha256(canonicalJson(inventoryCore(currentFinance)))
  ) refuse("declarative mutation intent inventory binding differs");
  if (intent.mutation === "secrets-set") {
    const secretsOnlySuccessor = Object.hasOwn(
      input.bundle,
      "mutationSecretNameSetSha256",
    );
    const currentFunctionSha256 = currentFunction.sha256;
    const plusOne = normalizeFunctionInventoryRows(
      secretsOnlySuccessor
        ? expectedAllExistingPlusOneFunctionRows(currentFunction.rows)
        : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
          currentFunction.rows,
        ),
    );
    if (
      intent.expectedSecretDigestSetSha256
        !== sha256(canonicalJson(input.secretEvidence.expectedDigests))
      || canonicalJson(intent.secretNames)
        !== canonicalJson(input.secretEvidence.secretNames)
      || intent.beforeFunctionInventorySha256 !== currentFunctionSha256
      || intent.unchangedFunctionInventorySha256 !== currentFunctionSha256
      || intent.exactAllExistingPlusOneFunctionInventorySha256 !== plusOne.sha256
      || intent.requiredStableReadRounds !== 2
      || intent.predecessorAdoptionSha256
        !== input.bundle.predecessorAdoptionSha256
    ) refuse("declarative secret intent digest binding differs");
    return;
  }
  if (
    intent.beforeFunctionInventorySha256 !== currentFunction.sha256
    || intent.sourceDeploymentSha256
      !== input.release.sourceDeploymentSha256
  ) refuse("declarative function intent source binding differs");
}

function declarativeCurrentInventoryHashes(input) {
  if (input.secretEvidence === null || input.functionEvidence === null) {
    refuse("declarative current raw inventory evidence is absent");
  }
  const main = declarativeInventory(
    input.secretEvidence.currentMain,
    "current Main binding",
  );
  const finance = declarativeInventory(
    input.secretEvidence.currentFinance,
    "current Finance binding",
  );
  const functions = normalizeFunctionInventoryRows(
    input.functionEvidence.currentRows,
  );
  return Object.freeze({
    main: sha256(canonicalJson(inventoryCore(main))),
    finance: sha256(canonicalJson(inventoryCore(finance))),
    functions: functions.sha256,
  });
}

function assertDeclarativePlanBeforeEvidence(input, chain, plan, mutation) {
  const current = declarativeCurrentInventoryHashes(input);
  let expectedMain = plan.mainInventorySha256;
  let expectedFinance = plan.financeInventorySha256;
  let expectedFunctions = plan.functionInventorySha256;
  if (
    mutation === "function-deploy"
    && plan.mutationScope === "secrets-set+function-deploy"
  ) {
    const installed = chain.at(-1);
    if (
      installed?.kind !== "mutation-result"
      || installed.mutation !== "secrets-set"
      || installed.status !== "verified"
    ) refuse("declarative combined plan secret checkpoint differs");
    expectedMain = installed.afterMainInventorySha256;
    expectedFinance = installed.afterFinanceInventorySha256;
    expectedFunctions = installed.afterFunctionInventorySha256;
  }
  if (
    current.main !== expectedMain
    || current.finance !== expectedFinance
    || current.functions !== expectedFunctions
  ) refuse("declarative owner-approved inventory binding differs");
}

function assertDeclarativeReconciliationIntentBinding(
  input,
  chain,
  plan,
  intent,
) {
  if (intent.mutation === "secrets-set") {
    const planAdoptionSha256 = sha256(canonicalJson(plan.predecessorAdoption));
    const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
      plan.predecessorAdoption,
    );
    const stageBaselineRows = scopedFunctionVersionTransitionRows(
      input.functionEvidence.preinstallRows,
      plan.functionVersionTransition.currentStageDisposition,
      plan.predecessorAdoption,
    );
    const stageBaseline = normalizeFunctionInventoryRows(stageBaselineRows);
    const stagePlusOne = normalizeFunctionInventoryRows(
      secretsOnlySuccessor
        ? expectedAllExistingPlusOneFunctionRows(stageBaseline.rows)
        : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
          stageBaseline.rows,
        ),
    );
    if (
      intent.beforeMainInventorySha256 !== plan.mainInventorySha256
      || intent.beforeFinanceInventorySha256 !== plan.financeInventorySha256
      || intent.expectedSecretDigestSetSha256
        !== sha256(canonicalJson(input.secretEvidence.expectedDigests))
      || canonicalJson(intent.secretNames)
        !== canonicalJson(input.secretEvidence.secretNames)
      || intent.beforeFunctionInventorySha256 !== plan.functionInventorySha256
      || intent.beforeFunctionInventorySha256 !== stageBaseline.sha256
      || intent.unchangedFunctionInventorySha256
        !== plan.functionVersionTransition.currentStageFunctionInventorySha256
      || intent.unchangedFunctionInventorySha256 !== stageBaseline.sha256
      || intent.exactAllExistingPlusOneFunctionInventorySha256
        !== plan.functionVersionTransition
          .currentStageExactAllExistingPlusOneFunctionInventorySha256
      || intent.exactAllExistingPlusOneFunctionInventorySha256
        !== stagePlusOne.sha256
      || intent.requiredStableReadRounds
        !== plan.functionVersionTransition.stableReadRounds
      || intent.requiredStableReadRounds !== 2
      || intent.predecessorAdoptionSha256
        !== input.bundle.predecessorAdoptionSha256
      || intent.predecessorAdoptionSha256 !== planAdoptionSha256
    ) refuse("declarative unresolved secret intent binding differs");
    return;
  }
  let expectedMain = plan.mainInventorySha256;
  let expectedFinance = plan.financeInventorySha256;
  let expectedFunctions = plan.functionInventorySha256;
  if (plan.mutationScope === "secrets-set+function-deploy") {
    const priorSecretResult = [...chain].reverse().find(receipt =>
      receipt.sequence < intent.sequence
      && receipt.kind === "mutation-result"
      && receipt.mutation === "secrets-set"
      && receipt.status === "verified");
    if (priorSecretResult === undefined) {
      refuse("declarative unresolved function cause differs");
    }
    expectedMain = priorSecretResult.afterMainInventorySha256;
    expectedFinance = priorSecretResult.afterFinanceInventorySha256;
    expectedFunctions = priorSecretResult.afterFunctionInventorySha256;
  }
  if (
    intent.beforeMainInventorySha256 !== expectedMain
    || intent.beforeFinanceInventorySha256 !== expectedFinance
    || intent.beforeFunctionInventorySha256 !== expectedFunctions
    || intent.sourceDeploymentSha256
      !== input.release.sourceDeploymentSha256
  ) refuse("declarative unresolved function intent binding differs");
}

function declarativeCanRecordIntent(chain, plan, mutation) {
  const latest = chain.at(-1);
  if (mutation === "secrets-set") {
    return latest?.receiptSha256 === plan.receiptSha256;
  }
  if (mutation !== "function-deploy") return false;
  if (
    plan.mutationScope === "function-deploy"
    && latest?.receiptSha256 === plan.receiptSha256
  ) return true;
  if (plan.mutationScope !== "secrets-set+function-deploy") return false;
  if (
    latest?.kind !== "mutation-result"
    || latest.mutation !== "secrets-set"
    || latest.status !== "verified"
    || latest.reconcileRequired !== false
  ) return false;
  const intent = chain.find(receipt =>
    receipt.kind === "mutation-intent"
    && receipt.receiptSha256 === latest.intentReceiptSha256);
  return intent?.planReceiptSha256 === plan.receiptSha256;
}

function evaluateMainFinanceRuntimeRecoveryV2StateLegacyCore(input) {
  assertDeclarativeValueTree(input);
  assertPlainDeclarativeRecord(input, [
    "action", "checkpoint", "operationBinding", "chain", "release", "source",
    "provenance", "ci", "bundle", "approval",
    "now", "mutation", "mutationOutcome", "secretEvidence", "functionEvidence",
    "mutationInputEvidence", "observationEvidence", "postflightEvidence",
    "effectPayload",
  ], "transition");
  if (
    !["measure", "plan", "apply", "reconcile", "complete", "verify"]
      .includes(input.action)
    || ![
      "request", "before-intent", "before-mutation", "after-mutation",
      "before-completion",
    ].includes(input.checkpoint)
    || !["none", "secrets-set", "function-deploy"].includes(input.mutation)
    || !["none", "success", "unknown"].includes(input.mutationOutcome)
    || !(input.postflightEvidence === null
      || typeof input.postflightEvidence === "object")
    || !canonicalTimestamp(input.now)
    || !(input.approval === null || typeof input.approval === "string")
  ) refuse("declarative transition input differs");
  const secretsOnlySuccessor = input.release?.schemaVersion === 3 && Object.hasOwn(
    input.bundle ?? {},
    "mutationSecretNameSetSha256",
  );
  if (secretsOnlySuccessor && input.mutation === "function-deploy") {
    refuse("secrets-only successor cannot authorize function deploy");
  }
  assertPlainDeclarativeRecord(
    input.operationBinding,
    ["expectedSha256", "currentSha256"],
    "operation binding",
  );
  if (
    !SHA256.test(input.operationBinding.expectedSha256 ?? "")
    || !SHA256.test(input.operationBinding.currentSha256 ?? "")
    || input.operationBinding.currentSha256
      !== input.operationBinding.expectedSha256
  ) refuse("declarative operation boundary differs");
  const chain = validateDeclarativeReceiptChain(input.chain);
  if (
    chain.length > 0
    && Date.parse(input.now) < Date.parse(chain.at(-1).recordedAt)
  ) refuse("declarative clock regressed behind the receipt chain");
  let secretState = classifyDeclarativeSecretState(input.secretEvidence);
  let functionState = classifyDeclarativeFunctionState(input.functionEvidence, chain);
  const observationEvidence = validateDeclarativeObservationEvidence(
    input.observationEvidence,
  );
  if (
    (input.action === "reconcile" && input.mutation === "secrets-set")
      !== (observationEvidence !== null)
  ) refuse("declarative reconciliation observation boundary differs");
  if (observationEvidence !== null) {
    const current = declarativeCurrentInventoryHashes(input);
    if (
      observationEvidence.secondMainInventorySha256 !== current.main
      || observationEvidence.secondFinanceInventorySha256 !== current.finance
      || observationEvidence.secondFunctionInventorySha256 !== current.functions
    ) refuse("declarative reconciliation observation current binding differs");
    if (!observationEvidence.stableObservation) {
      secretState = "diverged";
      functionState = "diverged";
    }
  }
  if (
    input.action === "reconcile"
    && input.mutation === "secrets-set"
    && secretState === "preinstall"
    && classifyScopedFunctionVersionTransition({
      beforeRows: declarativeFunctionStageBaselineRows(
        input.functionEvidence,
        chain,
      ),
      afterRows: input.functionEvidence.currentRows,
      predecessorAdoption: declarativeLatestPlan(chain)?.predecessorAdoption,
    }) !== "unchanged"
  ) functionState = "diverged";
  const mutationInputState = classifyDeclarativeMutationInput(
    input.mutationInputEvidence,
  );
  const postflightEvidence = validateDeclarativePostflightEvidence(
    input.postflightEvidence,
  );
  const decision = (
    name,
    effect,
    nextScope = null,
    nextMutation = null,
    reconciliationOutcome = null,
  ) => {
    const authority = authorizeDeclarativeEffectPayload({
      input,
      chain,
      effect,
      nextScope,
      nextMutation,
      reconciliationOutcome,
      postflightEvidence,
    });
    return Object.freeze({
      kind: "main-finance-runtime-recovery-v2-declarative-transition",
      decision: name,
      effect,
      nextScope,
      nextMutation,
      reconciliationOutcome,
      recordedAt: input.now,
      payloadSha256: authority.payloadSha256,
      authorizedReceiptSha256: authority.authorizedReceiptSha256,
      chainTailSha256: authority.chainTailSha256,
      effectPerformed: false,
      productionTouched: false,
    });
  };
  if (input.action === "measure") {
    if (
      input.checkpoint !== "request"
      || chain.some(receipt => receipt.kind !== "catalog-measurement")
      || input.release !== null
      || input.source !== null
      || input.provenance !== null
      || input.ci !== null
      || input.bundle !== null
      || input.mutation !== "none"
      || input.mutationOutcome !== "none"
      || input.secretEvidence !== null
      || input.functionEvidence !== null
      || input.mutationInputEvidence !== null
      || postflightEvidence !== null
      || input.approval !== null
    ) refuse("declarative measurement authority differs");
    return decision(
      "measure-read-only-verified",
      "append-catalog-measurement",
    );
  }
  if (
    input.action === "apply"
    && input.checkpoint === "after-mutation"
    && input.mutationOutcome === "unknown"
  ) {
    const plan = declarativeLatestPlan(chain);
    if (
      plan === null
      || input.approval !== null
      || input.mutation === "none"
      || !plan.mutationScope.split("+").includes(input.mutation)
      || postflightEvidence !== null
    ) refuse("declarative unknown mutation evidence differs");
    declarativeIntentForLatest(chain, plan, input.mutation);
    return decision(
      "reconcile-required",
      "append-unknown-result",
      plan.mutationScope,
      input.mutation,
    );
  }
  validateDeclarativeSourceAuthority(input);
  assertDeclarativeBundleBaselineBinding(input);
  if (input.action === "plan") {
    if (
      input.checkpoint !== "request"
      || input.mutation !== "none"
      || input.mutationOutcome !== "none"
      || input.mutationInputEvidence !== null
      || postflightEvidence !== null
      || input.approval !== null
      || functionState !== "absent"
      || !["preinstall", "installed"].includes(secretState)
    ) refuse("declarative plan evidence differs");
    const operational = chain.filter(receipt => receipt.kind !== "catalog-measurement");
    const cause = operational.at(-1) ?? null;
    let scope = null;
    if (cause === null && secretState === "preinstall") {
      scope = secretsOnlySuccessor ? "secrets-set" : "secrets-set+function-deploy";
    } else if (cause !== null && !secretsOnlySuccessor) {
      scope = resumeScopeForCause(cause, input.now);
      if (scope === "secrets-set" && secretState !== "preinstall") scope = null;
      if (scope === "function-deploy" && secretState !== "installed") scope = null;
    }
    if (scope === null) refuse("declarative plan causal scope differs");
    return decision("issue-plan", "append-release-plan", scope);
  }
  if (input.action === "apply") {
    const afterMutation = input.checkpoint === "after-mutation";
    const plan = afterMutation
      ? declarativeLatestPlan(chain)
      : declarativeCurrentPlan(input, chain);
    if (plan === null) refuse("declarative apply plan is absent");
    if (afterMutation) {
      validateDeclarativeSourceAuthority(input, plan);
      if (input.approval !== null) {
        refuse("declarative post-mutation approval must not be reused");
      }
    }
    if (
      !plan.mutationScope.split("+").includes(input.mutation)
      || input.mutation === "none"
      || input.mutationInputEvidence === null
      || input.mutationInputEvidence.expectedSha256 !== (
        input.mutation === "secrets-set"
          ? input.bundle.runtimeMutationInputSha256
          : input.bundle.deployMutationInputSha256
      )
    ) refuse("declarative mutation scope differs");
    if (input.checkpoint === "before-intent") {
      assertDeclarativePlanBeforeEvidence(
        input,
        chain,
        plan,
        input.mutation,
      );
      if (
        input.mutationOutcome !== "none"
        || mutationInputState !== "exact"
        || !declarativeCanRecordIntent(chain, plan, input.mutation)
        || (
          input.mutation === "secrets-set"
          && !(secretState === "preinstall" && functionState === "absent")
        )
        || (
          input.mutation === "function-deploy"
          && !(secretState === "installed" && functionState === "absent")
        )
      ) refuse("declarative mutation intent differs");
      return decision(
        "record-mutation-intent",
        "append-mutation-intent",
        plan.mutationScope,
        input.mutation,
      );
    }
    if (!["before-mutation", "after-mutation"].includes(input.checkpoint)) {
      refuse("declarative apply checkpoint differs");
    }
    const intent = declarativeIntentForLatest(chain, plan, input.mutation);
    if (input.checkpoint === "before-mutation") {
      assertDeclarativePlanBeforeEvidence(
        input,
        chain.slice(0, -1),
        plan,
        input.mutation,
      );
      assertDeclarativeIntentBeforeEvidence(input, intent);
      if (
        input.mutationOutcome !== "none"
        || mutationInputState !== "exact"
        || (
          input.mutation === "secrets-set"
          && !(secretState === "preinstall" && functionState === "absent")
        )
        || (
          input.mutation === "function-deploy"
          && !(secretState === "installed" && functionState === "absent")
        )
      ) refuse("declarative CLI invocation authority differs");
      return decision(
        "authorize-cli-invocation",
        input.mutation === "secrets-set"
          ? "invoke-secrets-set" : "invoke-function-deploy",
        plan.mutationScope,
        input.mutation,
      );
    }
    if (
      input.mutationOutcome !== "success"
      || mutationInputState !== "exact"
    ) refuse("declarative mutation result differs");
    if (
      input.mutation === "secrets-set"
      && secretState === "installed"
      && functionState === "absent"
      && postflightEvidence === null
    ) {
      return decision(
        "secrets-verified",
        "append-verified-mutation-result",
        secretsOnlySuccessor
          ? null
          : (plan.mutationScope === "secrets-set+function-deploy"
            ? plan.mutationScope : "function-deploy"),
        secretsOnlySuccessor
          ? null
          : (plan.mutationScope === "secrets-set+function-deploy"
            ? "function-deploy" : null),
      );
    }
    if (
      input.mutation === "function-deploy"
      && secretState === "installed"
      && functionState === "exact-sole-addition"
      && postflightEvidence !== null
    ) {
      assertDeclarativePostflightCurrentBinding(input, postflightEvidence);
      if (Date.parse(input.now) <= Date.parse(postflightEvidence.d1.databaseClock)) {
        refuse("declarative function result clock precedes postflight D1");
      }
      return decision(
        "function-verified",
        "append-verified-mutation-result",
      );
    }
    refuse("declarative verified mutation evidence differs");
  }
  const plan = declarativeLatestPlan(chain);
  if (plan === null) refuse("declarative plan is absent");
  validateDeclarativeSourceAuthority(input, plan);
  if (input.approval !== null) refuse("declarative non-apply approval differs");
  if (input.action === "reconcile") {
    if (
      input.checkpoint !== "after-mutation"
      || input.mutationOutcome !== "none"
      || input.mutationInputEvidence !== null
    ) refuse("declarative reconciliation input differs");
    const unresolved = chain.at(-1);
    const mutation = unresolved?.kind === "mutation-intent"
      ? unresolved.mutation
      : (
        unresolved?.kind === "mutation-result"
        && unresolved.status === "unknown"
          ? unresolved.mutation : null
      );
    if (
      mutation === null
      || input.mutation !== mutation
      || !plan.mutationScope.split("+").includes(mutation)
    ) refuse("declarative reconciliation cause differs");
    const unresolvedIntent = unresolved.kind === "mutation-intent"
      ? unresolved
      : chain.find(receipt =>
        receipt.kind === "mutation-intent"
        && receipt.receiptSha256 === unresolved.intentReceiptSha256);
    if (unresolvedIntent?.planReceiptSha256 !== plan.receiptSha256) {
      refuse("declarative reconciliation intent differs");
    }
    assertDeclarativeReconciliationIntentBinding(
      input,
      chain,
      plan,
      unresolvedIntent,
    );
    let intentInventoryMatches = false;
    if (mutation === "function-deploy" && input.secretEvidence !== null) {
      const currentMain = declarativeInventory(
        input.secretEvidence.currentMain,
        "reconcile current Main",
      );
      const currentFinance = declarativeInventory(
        input.secretEvidence.currentFinance,
        "reconcile current Finance",
      );
      intentInventoryMatches =
        unresolvedIntent.beforeMainInventorySha256
          === sha256(canonicalJson(inventoryCore(currentMain)))
        && unresolvedIntent.beforeFinanceInventorySha256
          === sha256(canonicalJson(inventoryCore(currentFinance)))
        && input.functionEvidence !== null
        && unresolvedIntent.beforeFunctionInventorySha256
          === normalizeFunctionInventoryRows(
            input.functionEvidence.currentRows,
          ).sha256
        && unresolvedIntent.sourceDeploymentSha256
          === input.release.sourceDeploymentSha256;
    }
    if (mutation === "secrets-set") {
      if (postflightEvidence !== null) {
        refuse("declarative secret reconciliation postflight differs");
      }
      if (secretState === "preinstall") {
        if (secretsOnlySuccessor) {
          const preinstallMain = declarativeInventory(
            input.secretEvidence.preinstallMain,
            "reconcile successor preinstall Main",
          );
          const currentMain = declarativeInventory(
            input.secretEvidence.currentMain,
            "reconcile successor current Main",
          );
          const preinstallFinance = declarativeInventory(
            input.secretEvidence.preinstallFinance,
            "reconcile successor preinstall Finance",
          );
          const currentFinance = declarativeInventory(
            input.secretEvidence.currentFinance,
            "reconcile successor current Finance",
          );
          if (
            !inventoryMatchesMetadataOnlyDrift(
              preinstallMain,
              currentMain,
              SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
            )
            || !inventoryIsUnchanged(preinstallFinance, currentFinance)
          ) refuse("declarative successor not-applied inventory binding differs");
        } else {
          const current = declarativeCurrentInventoryHashes(input);
          if (
            current.main !== unresolvedIntent.beforeMainInventorySha256
            || current.finance !== unresolvedIntent.beforeFinanceInventorySha256
          ) refuse("declarative secret not-applied inventory binding differs");
        }
      }
    } else if (postflightEvidence !== null) {
      if (functionState !== "exact-sole-addition") {
        refuse("declarative function reconciliation postflight differs");
      }
      if (Date.parse(input.now) <= Date.parse(postflightEvidence.d1.databaseClock)) {
        refuse("declarative function reconciliation clock precedes postflight D1");
      }
      const current = assertDeclarativePostflightCurrentBinding(
        input,
        postflightEvidence,
      );
      if (
        current.main !== unresolvedIntent.beforeMainInventorySha256
        || current.finance !== unresolvedIntent.beforeFinanceInventorySha256
        || plan.snapshot.catalogSha256 !== postflightEvidence.d0.catalogSha256
        || plan.snapshot.descriptorSha256 !== postflightEvidence.d0.descriptorSha256
        || plan.snapshot.stateSha256 !== postflightEvidence.d0.stateSha256
        || plan.snapshot.gateInventorySha256
          !== postflightEvidence.d0.gateInventorySha256
        || plan.snapshot.privacyInventorySha256
          !== postflightEvidence.d0.privacyInventorySha256
        || plan.snapshot.checkedCount !== postflightEvidence.d0.checkedCount
      ) refuse("declarative function reconciliation sandwich binding differs");
    }
    const outcome = classifyMainFinanceRuntimeRecoveryV2ReconciliationOutcome({
      mutation,
      secretState,
      functionState,
      postflightVerified: postflightEvidence !== null,
      intentInventoryMatches,
    });
    return decision(
      "reconcile-" + outcome.replace("_", "-"),
      "append-reconciliation",
      secretsOnlySuccessor
        ? null
        : (outcome === "state_satisfied" && mutation === "secrets-set"
          ? "function-deploy"
          : (["not_applied", "state_unsatisfied"].includes(outcome)
            ? mutation : null)),
      secretsOnlySuccessor
        ? null
        : (["not_applied", "state_unsatisfied"].includes(outcome)
          ? mutation : null),
      outcome,
    );
  }
  if (input.action === "complete") {
    const cause = chain.at(-1);
    if (
      input.checkpoint !== "before-completion"
      || input.mutation !== "none"
      || input.mutationOutcome !== "none"
      || input.mutationInputEvidence !== null
      || secretState !== "installed"
      || functionState !== (secretsOnlySuccessor
        ? "absent" : "exact-sole-addition")
      || postflightEvidence === null
      || !(
        (
          cause?.kind === "mutation-result"
          && cause.mutation === (secretsOnlySuccessor
            ? "secrets-set" : "function-deploy")
          && cause.status === "verified"
        )
        || (
          cause?.kind === "reconciliation"
          && cause.mutation === (secretsOnlySuccessor
            ? "secrets-set" : "function-deploy")
          && cause.outcome === (secretsOnlySuccessor
            ? "state_satisfied" : "applied")
        )
      )
    ) refuse("declarative completion authority differs");
    const current = assertDeclarativePostflightCurrentBinding(
      input,
      postflightEvidence,
    );
    const causeFunctionInventorySha256 = secretsOnlySuccessor
      ? (cause.kind === "mutation-result"
        ? cause.afterFunctionInventorySha256
        : cause.functionInventorySha256)
      : cause.functionInventorySha256;
    if (
      causeFunctionInventorySha256 !== current.functions
      || (!secretsOnlySuccessor
        && cause.hostedProofSha256 === postflightEvidence.proof.proofSha256)
      || (!secretsOnlySuccessor
        && cause.hostedD0ResponseSha256 === postflightEvidence.d0.responseSha256)
      || plan.snapshot.catalogSha256 !== postflightEvidence.d0.catalogSha256
      || plan.snapshot.descriptorSha256 !== postflightEvidence.d0.descriptorSha256
      || plan.snapshot.stateSha256 !== postflightEvidence.d0.stateSha256
      || plan.snapshot.gateInventorySha256
        !== postflightEvidence.d0.gateInventorySha256
      || plan.snapshot.privacyInventorySha256
        !== postflightEvidence.d0.privacyInventorySha256
      || plan.snapshot.checkedCount !== postflightEvidence.d0.checkedCount
      || Date.parse(input.now) <= Date.parse(postflightEvidence.d1.databaseClock)
    ) refuse("declarative completion sandwich binding differs");
    return decision("release-complete-eligible", "append-release-complete");
  }
  if (
    input.action !== "verify"
    || input.checkpoint !== "request"
    || input.mutation !== "none"
    || input.mutationOutcome !== "none"
    || input.mutationInputEvidence !== null
    || chain.at(-1)?.kind !== "release-complete"
    || secretState !== "installed"
    || functionState !== (secretsOnlySuccessor
      ? "absent" : "exact-sole-addition")
    || postflightEvidence === null
  ) refuse("declarative verification evidence differs");
  const complete = chain.at(-1);
  const current = assertDeclarativePostflightCurrentBinding(
    input,
    postflightEvidence,
  );
  if (
    canonicalJson(stableDeclarativeSnapshot(postflightEvidence.d0))
      !== canonicalJson(stableDeclarativeSnapshot(complete.d1))
    || canonicalJson(stableDeclarativeSnapshot(postflightEvidence.d1))
      !== canonicalJson(stableDeclarativeSnapshot(complete.d1))
    || current.main !== complete.d1MainInventorySha256
    || current.finance !== complete.d1FinanceInventorySha256
    || current.functions !== complete.d1FunctionInventorySha256
    || postflightEvidence.proof.stateSha256 !== complete.d1.stateSha256
    || Date.parse(input.now) <= Date.parse(postflightEvidence.d1.databaseClock)
  ) refuse("declarative fresh verification sandwich differs");
  return decision("verification-evidence-consistent", "none");
}

export function evaluateMainFinanceRuntimeRecoveryV2State(input) {
  assertDeclarativeValueTree(input);
  if (input?.action !== "measure" && (
    input?.release?.schemaVersion !== 3
    || input.release.authorizedMutation !== "secrets-set"
    || input.release.functionDeployAuthorized !== false
    || !Object.hasOwn(input.bundle ?? {}, "mutationSecretNameSetSha256")
    || input.mutation === "function-deploy"
    || input.effectPayload?.mutation === "function-deploy"
    || input.chain?.some(receipt =>
      receipt.mutation === "function-deploy"
      || receipt.mutationScope?.split("+").includes("function-deploy"))
  )) {
    refuse("current declarative authority is schema-3 secrets-set only");
  }
  return evaluateMainFinanceRuntimeRecoveryV2StateLegacyCore(input);
}

function declarativeReadyBindings(context, release, ci, bundle) {
  const currentReceiptBinding = readReceiptBinding(
    context.stateDirectory,
    context.receiptDirectory,
  );
  const successor = isTerminalDivergedPredecessorAdoption(
    bundle.attestation.predecessorAdoption,
  );
  const bundleBinding = {
    attestationSha256: bundle.attestation.attestationSha256,
    catalogSha256: bundle.attestation.catalogSha256,
    descriptorSha256: bundle.attestation.descriptorSha256,
    stateSha256: bundle.attestation.stateSha256,
    gateInventorySha256: bundle.attestation.gateInventorySha256,
    privacyInventorySha256: bundle.attestation.privacyInventorySha256,
    checkedCount: bundle.attestation.checkedCount,
    preinstallMainInventorySha256:
      bundle.attestation.preinstallMainInventorySha256,
    preinstallFinanceInventorySha256:
      bundle.attestation.preinstallFinanceInventorySha256,
    preinstallFunctionInventorySha256:
      bundle.attestation.preinstallFunctionInventorySha256,
    runtimeMutationInputSha256: sha256(canonicalJson(bundle.runtimeMutationInput)),
    productionBoundarySha256: bundle.attestation.productionBoundarySha256,
    targetDescriptorSha256: bundle.attestation.targetDescriptorSha256,
    runtimeCommandArgsSha256: sha256(canonicalJson(secretArguments(bundle))),
    sourceArchiveSha256: bundle.attestation.sourceArchiveSha256,
    operatorDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    predecessorAdoptionSha256:
      sha256(canonicalJson(bundle.attestation.predecessorAdoption)),
    ...(successor ? {
      mutationSecretNameSetSha256: sha256(canonicalJson(
        bundle.attestation.mutationSecretNames,
      )),
      mutationSecretDigestSetSha256: sha256(canonicalJson(
        bundle.attestation.mutationSecretDigests,
      )),
    } : {
      deployMutationInputSha256: sha256(canonicalJson(bundle.deployMutationInput)),
      deployCommandArgsSha256: sha256(canonicalJson(deploymentArguments(bundle))),
    }),
  };
  return Object.freeze({
    operationBinding: Object.freeze({
      expectedSha256: context.receiptBinding.bindingSha256,
      currentSha256: currentReceiptBinding.bindingSha256,
    }),
    release: Object.freeze({
      schemaVersion: 3,
      authorizedMutation: "secrets-set",
      functionDeployAuthorized: false,
      manifestSha256: release.manifestSha256,
      sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
      futureClockSkewSeconds: release.manifest.plan.futureClockSkewSeconds,
    }),
    source: Object.freeze({
      commit: context.source.commit,
      tree: context.source.tree,
      parent: context.source.parent,
      baseTree: context.source.baseTree,
      changedPaths: context.source.changedPaths,
      changedPathSetSha256: context.source.changedPathSetSha256,
      trackedFileCount: context.source.trackedFileCount,
      workflowBlobSha: context.source.workflowBlobSha,
      supabaseArchiveSha256: context.source.supabaseArchiveSha256,
    }),
    provenance: Object.freeze({
      expectedCommitSha: context.provenance.expectedCommitSha,
      expectedTreeSha: context.provenance.expectedTreeSha,
      githubRunId: context.provenance.githubRunId,
      fileSha256: context.provenance.fileSha256,
      descriptorSha256: context.provenance.descriptorSha256,
    }),
    ci: Object.freeze({
      runId: ci.runId,
      runApiSha256: ci.runApiSha256,
      jobsApiSha256: ci.jobsApiSha256,
      branchApiSha256: ci.branchApiSha256,
      workflowBlobSha: ci.workflowBlobSha,
      headSha: ci.headSha,
      conclusion: ci.conclusion,
    }),
    bundle: Object.freeze(bundleBinding),
  });
}

function declarativeSecretEvidence(bundle, inventories) {
  if (bundle === null || inventories === null) return null;
  const successor = isTerminalDivergedPredecessorAdoption(
    bundle.attestation.predecessorAdoption,
  );
  return Object.freeze({
    preinstallMain: Object.freeze(inventoryCore(bundle.preinstallInventories.main)),
    preinstallFinance: Object.freeze(inventoryCore(bundle.preinstallInventories.finance)),
    currentMain: Object.freeze(inventoryCore(inventories.main)),
    currentFinance: Object.freeze(inventoryCore(inventories.finance)),
    expectedDigests: successor
      ? bundle.attestation.mutationSecretDigests
      : bundle.attestation.expectedSecretDigests,
    secretNames: successor
      ? bundle.attestation.mutationSecretNames
      : bundle.attestation.secretNames,
    ...(successor
      ? { metadataOnlyNames: SUCCESSOR_METADATA_ONLY_SECRET_NAMES }
      : {}),
  });
}

function declarativeFunctionEvidence(bundle, inventory) {
  if (bundle === null || inventory === null) return null;
  return Object.freeze({
    preinstallRows: bundle.preinstallInventories.functions,
    currentRows: inventory.rows,
    ...(isTerminalDivergedPredecessorAdoption(
      bundle.attestation.predecessorAdoption,
    ) ? { successorBaseline: true } : {}),
  });
}

function declarativePostflightEvidence(sandwich) {
  if (sandwich === null) return null;
  return Object.freeze({
    d0: safeSnapshotEvidence(sandwich.d0),
    proof: Object.freeze({
      responseSha256: sandwich.proof.responseSha256,
      proofSha256: sandwich.proof.proofSha256,
      attestedAt: sandwich.proof.attestedAt,
      checkedCount: sandwich.proof.checkedCount,
      mismatchCount: sandwich.proof.mismatchCount,
      stateSha256: sandwich.proof.stateSha256,
    }),
    d1: safeSnapshotEvidence(sandwich.d1),
    d0MainInventorySha256: sandwich.d0MainInventorySha256,
    d0FinanceInventorySha256: sandwich.d0FinanceInventorySha256,
    d0FunctionInventorySha256: sandwich.d0FunctionInventorySha256,
    d1MainInventorySha256: sandwich.d1MainInventorySha256,
    d1FinanceInventorySha256: sandwich.d1FinanceInventorySha256,
    d1FunctionInventorySha256: sandwich.d1FunctionInventorySha256,
  });
}

function declarativeMutationInputEvidence(bundle, release, mutation) {
  if (mutation === "none") return null;
  let expected;
  let current = null;
  try {
    if (mutation === "secrets-set") {
      expected = bundle.runtimeMutationInput;
      current = captureRuntimeMutationInput(
        bundle.secretMutationFile ?? bundle.runtimeFile,
        bundle.attestation.runtimeMutationFileSha256
          ?? bundle.attestation.runtimeFileSha256,
      );
    } else if (mutation === "function-deploy") {
      expected = bundle.deployMutationInput;
      current = captureDeployMutationInput(bundle.workdir, release);
    } else {
      refuse("declarative mutation input kind differs");
    }
  } catch {
    if (expected === undefined) {
      expected = mutation === "secrets-set"
        ? bundle.runtimeMutationInput : bundle.deployMutationInput;
    }
  }
  return Object.freeze({
    expectedSha256: sha256(canonicalJson(expected)),
    currentSha256: current === null ? null : sha256(canonicalJson(current)),
  });
}

function evaluateOperationalState({
  action,
  checkpoint,
  context,
  release,
  bundle,
  ci = context.ci,
  chain = context.chain,
  approval = null,
  now,
  mutation = "none",
  mutationOutcome = "none",
  inventories = null,
  functionInventory = null,
  mutationInputEvidence = mutation === "none"
    ? null : declarativeMutationInputEvidence(bundle, release, mutation),
  observationEvidence = null,
  postflight = null,
  effectPayload = null,
  bindings = null,
}) {
  const readyBindings = bindings ?? declarativeReadyBindings(
    context,
    release,
    ci,
    bundle,
  );
  return evaluateMainFinanceRuntimeRecoveryV2State({
    action,
    checkpoint,
    operationBinding: readyBindings.operationBinding,
    chain,
    release: readyBindings.release,
    source: readyBindings.source,
    provenance: readyBindings.provenance,
    ci: readyBindings.ci,
    bundle: readyBindings.bundle,
    approval,
    now: now instanceof Date ? now.toISOString() : now,
    mutation,
    mutationOutcome,
    secretEvidence: declarativeSecretEvidence(bundle, inventories),
    functionEvidence: declarativeFunctionEvidence(bundle, functionInventory),
    mutationInputEvidence,
    observationEvidence,
    postflightEvidence: declarativePostflightEvidence(postflight),
    effectPayload,
  });
}

function requireDeclarativeEffect(authority, expectedEffect) {
  assertPlainDeclarativeRecord(authority, [
    "kind", "decision", "effect", "nextScope", "nextMutation",
    "reconciliationOutcome", "recordedAt", "effectPerformed",
    "payloadSha256", "authorizedReceiptSha256", "chainTailSha256",
    "productionTouched",
  ], "issued authority");
  if (
    authority.kind
      !== "main-finance-runtime-recovery-v2-declarative-transition"
    || authority.effect !== expectedEffect
    || authority.effectPerformed !== false
    || authority.productionTouched !== false
  ) refuse("declarative effect authority differs");
  return authority;
}

function appendAuthorizedReceipt(
  authority,
  expectedEffect,
  receiptDirectory,
  chain,
  fields,
) {
  requireDeclarativeEffect(authority, expectedEffect);
  assertReceiptPayloadEnvelopeFree(fields);
  const freshChain = readReceiptChain(receiptDirectory);
  if (canonicalJson(freshChain) !== canonicalJson(chain)) {
    refuse("receipt chain changed after declarative authority");
  }
  const core = {
    ...fields,
    schemaVersion: receiptSchemaVersion(fields, chain),
    sequence: chain.length + 1,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
    productionDenied: true,
  };
  const previousClock = chain.length === 0
    ? Number.NEGATIVE_INFINITY
    : Date.parse(chain.at(-1).recordedAt);
  if (
    authority.chainTailSha256 !== core.previousReceiptSha256
    || authority.recordedAt !== fields.recordedAt
    || Date.parse(fields.recordedAt) <= previousClock
    || authority.payloadSha256 !== sha256(canonicalJson(fields))
    || authority.authorizedReceiptSha256 !== sha256(canonicalJson(core))
  ) refuse("declarative receipt payload changed after authority");
  return appendReceipt(receiptDirectory, chain, fields);
}

function nextReceiptTimestamp(chain, now, lowerBound = null) {
  const observed = exactNow(now).getTime();
  const previous = chain.length === 0
    ? Number.NEGATIVE_INFINITY
    : Date.parse(chain.at(-1).recordedAt) + 1;
  const bounded = lowerBound === null ? Number.NEGATIVE_INFINITY : lowerBound;
  return new Date(Math.max(observed, previous, bounded)).toISOString();
}

function mutationCommandPayload(bundle, release, mutation) {
  if (!["secrets-set", "function-deploy"].includes(mutation)) {
    refuse("declarative mutation command kind differs");
  }
  return Object.freeze({
    kind: "main-finance-runtime-recovery-v2-command",
    mutation,
    projectRef: MAIN_REF,
    sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
    mutationInputSha256: mutation === "secrets-set"
      ? sha256(canonicalJson(bundle.runtimeMutationInput))
      : sha256(canonicalJson(bundle.deployMutationInput)),
    argsSha256: sha256(canonicalJson(
      mutation === "secrets-set"
        ? secretArguments(bundle) : deploymentArguments(bundle),
    )),
  });
}

function invokeAuthorizedMutation(
  authority,
  mutation,
  dependencies,
  args,
  bundle,
  release,
  chain,
  receiptDirectory,
  stateDirectory,
  expectedReceiptBindingSha256,
  finalGate,
) {
  const expectedEffect = mutation === "secrets-set"
    ? "invoke-secrets-set"
    : (mutation === "function-deploy" ? "invoke-function-deploy" : null);
  if (expectedEffect === null || authority.nextMutation !== mutation) {
    refuse("declarative mutation authority differs");
  }
  requireDeclarativeEffect(authority, expectedEffect);
  const currentReceiptBinding = readReceiptBinding(
    stateDirectory,
    receiptDirectory,
  );
  const freshChain = readReceiptChain(receiptDirectory);
  if (
    currentReceiptBinding.bindingSha256 !== expectedReceiptBindingSha256
    || canonicalJson(freshChain) !== canonicalJson(chain)
    || authority.chainTailSha256 !== freshChain.at(-1)?.receiptSha256
  ) refuse("receipt chain changed before authorized mutation");
  if (assertMutationInputUnchanged(bundle, release, mutation) !== true) {
    refuse("mutation input changed before authorized mutation");
  }
  const expectedArgs = mutation === "secrets-set"
    ? secretArguments(bundle) : deploymentArguments(bundle);
  const command = mutationCommandPayload(bundle, release, mutation);
  if (
    canonicalJson(args) !== canonicalJson(expectedArgs)
    || command.argsSha256 !== sha256(canonicalJson(args))
    || authority.payloadSha256 !== sha256(canonicalJson(command))
    || authority.chainTailSha256 !== chain.at(-1)?.receiptSha256
    || authority.authorizedReceiptSha256 !== null
  ) refuse("declarative mutation command changed after authority");
  exactKeys(finalGate, [
    "context", "plan", "approval", "source", "provenance", "ci",
    "inventories", "functionInventory", "now",
  ], "final mutation gate");
  if (
    finalGate.context.source !== finalGate.source
    || finalGate.context.provenance !== finalGate.provenance
    || finalGate.plan.receiptSha256 !== latestPlan(freshChain).receiptSha256
  ) refuse("final mutation gate causal binding differs");
  const finalBindings = declarativeReadyBindings(
    finalGate.context,
    release,
    finalGate.ci,
    bundle,
  );
  const finalMutationInputEvidence = declarativeMutationInputEvidence(
    bundle,
    release,
    mutation,
  );
  const finalNow = exactNow(finalGate.now);
  assertPlanCurrent(
    finalGate.plan,
    bundle,
    release,
    finalGate.source,
    finalGate.provenance,
    finalGate.approval,
    finalNow,
  );
  const immediateAuthority = evaluateOperationalState({
    action: "apply",
    checkpoint: "before-mutation",
    context: finalGate.context,
    release,
    bundle,
    ci: finalGate.ci,
    chain: freshChain,
    approval: finalGate.approval,
    now: finalNow,
    mutation,
    inventories: finalGate.inventories,
    functionInventory: finalGate.functionInventory,
    mutationInputEvidence: finalMutationInputEvidence,
    effectPayload: command,
    bindings: finalBindings,
  });
  requireDeclarativeEffect(immediateAuthority, expectedEffect);
  if (
    immediateAuthority.payloadSha256 !== authority.payloadSha256
    || immediateAuthority.chainTailSha256 !== authority.chainTailSha256
    || immediateAuthority.authorizedReceiptSha256 !== null
  ) refuse("immediate mutation authority differs");
  return invokeCli(dependencies, args, { mutation: true });
}

function receiptAfterPlan(chain, plan, predicate) {
  return chain.some(receipt => receipt.sequence > plan.sequence && predicate(receipt));
}

function mutationVerified(chain, plan, mutation) {
  return receiptAfterPlan(chain, plan, receipt =>
    (receipt.kind === "mutation-result"
      && receipt.mutation === mutation
      && receipt.status === "verified")
    || (receipt.kind === "reconciliation"
      && receipt.mutation === mutation
      && receipt.outcome === "applied"));
}

function assertFreshCompletionSandwich(cause, sandwich) {
  if (
    sandwich === null
    || cause.hostedProofSha256 === sandwich.proof.proofSha256
    || cause.hostedD0ResponseSha256 === sandwich.d0.response_sha256
  ) refuse("completion requires a fresh D0/proof/D1 distinct from its cause");
  return sandwich;
}

async function collectCompletionAuthority({
  postflightSandwichImpl = postflightSandwich,
  inspectCiImpl = inspectReadyOperationSourceCi,
  completeReceiptFieldsImpl = completeReceiptFields,
  context,
  input,
  common,
  release,
  bundle,
  baselineRows,
  plan,
  cause,
}) {
  let observedSandwich = null;
  try {
    observedSandwich = await postflightSandwichImpl(
      context.dependencies,
      release,
      context.source,
      bundle,
      baselineRows,
    );
  } catch {
    observedSandwich = null;
  }
  const sandwich = assertFreshCompletionSandwich(cause, observedSandwich);
  const ci = inspectCiImpl(context, input, common, release);
  if (!sourceCiMatchesPlan(ci, plan)) {
    refuse("completion source authority changed during final D0/proof/D1");
  }
  const completionFields = completeReceiptFieldsImpl({
    release,
    source: context.source,
    provenance: context.provenance,
    ci,
    bundle,
    functionInventory: sandwich.functionInventory,
    sandwich,
    causalHostedProofSha256: cause.hostedProofSha256,
    now: common.now,
    chain: context.chain,
  });
  return Object.freeze({ sandwich, ci, completionFields });
}

function completeReceiptFields({
  release,
  source,
  provenance,
  ci,
  bundle,
  functionInventory,
  sandwich,
  causalHostedProofSha256,
  now,
  chain,
}) {
  const recordedAt = nextReceiptTimestamp(
    chain,
    now,
    Date.parse(sandwich.d1.database_clock) + 1,
  );
  return Object.freeze({
    kind: "release-complete",
    status: "verified",
    environment: "staging",
    recordedAt,
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: source.commit,
    sourceTreeSha: source.tree,
    sourceParentSha: source.parent,
    baseTreeSha: source.baseTree,
    changedPaths: source.changedPaths,
    changedPathSetSha256: source.changedPathSetSha256,
    trackedFileCount: source.trackedFileCount,
    workflowPath: ci.workflowPath,
    workflowBlobSha: ci.workflowBlobSha,
    sourceCiRunId: ci.runId,
    sourceCiRunApiSha256: ci.runApiSha256,
    sourceCiJobsApiSha256: ci.jobsApiSha256,
    sourceCiBranchApiSha256: ci.branchApiSha256,
    sourceCiConclusion: ci.conclusion,
    sourceProvenanceFileSha256: provenance.fileSha256,
    sourceProvenanceDescriptorSha256: provenance.descriptorSha256,
    releaseManifestSha256: release.manifestSha256,
    deploymentClosureSha256: release.manifest.deploymentClosureSetSha256,
    sourceArchiveSha256: bundle.attestation.sourceArchiveSha256,
    supabaseArchiveSha256: source.supabaseArchiveSha256,
    operatorDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    productionBoundarySha256: bundle.attestation.productionBoundarySha256,
    targetDescriptorSha256: bundle.attestation.targetDescriptorSha256,
    functionInventorySha256: functionInventory.sha256,
    causalHostedProofSha256,
    d0MainInventorySha256: sandwich.d0MainInventorySha256,
    d0FinanceInventorySha256: sandwich.d0FinanceInventorySha256,
    d0FunctionInventorySha256: sandwich.d0FunctionInventorySha256,
    d0: safeSnapshotEvidence(sandwich.d0),
    hostedProof: Object.freeze({
      responseSha256: sandwich.proof.responseSha256,
      proofSha256: sandwich.proof.proofSha256,
      attestedAt: sandwich.proof.attestedAt,
      checkedCount: sandwich.proof.checkedCount,
      mismatchCount: sandwich.proof.mismatchCount,
      stateSha256: sandwich.proof.stateSha256,
    }),
    d1: safeSnapshotEvidence(sandwich.d1),
    d1MainInventorySha256: sandwich.d1MainInventorySha256,
    d1FinanceInventorySha256: sandwich.d1FinanceInventorySha256,
    d1FunctionInventorySha256: sandwich.d1FunctionInventorySha256,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
}

function completeSecretsOnlySuccessorReceiptFields({
  release,
  source,
  provenance,
  ci,
  bundle,
  sandwich,
  cause,
  now,
  chain,
}) {
  if (
    cause?.mutation !== "secrets-set"
    || !(
      (cause.kind === "mutation-result" && cause.status === "verified")
      || (cause.kind === "reconciliation" && cause.outcome === "state_satisfied")
    )
  ) refuse("secrets-only completion cause differs");
  const base = completeReceiptFields({
    release,
    source,
    provenance,
    ci,
    bundle,
    functionInventory: sandwich.functionInventory,
    sandwich,
    causalHostedProofSha256: null,
    now,
    chain,
  });
  return Object.freeze({
    ...base,
    completionCauseReceiptSha256: cause.receiptSha256,
    semanticMainInventorySha256: sandwich.semanticMainInventorySha256,
    metadataOnlyDeltaNames: sandwich.metadataDelta.names,
    metadataOnlyDeltaSha256: sandwich.metadataDelta.sha256,
    mutationSecretNames: bundle.attestation.mutationSecretNames,
    mutationSecretNameSetSha256: sha256(canonicalJson(
      bundle.attestation.mutationSecretNames,
    )),
    mutationSecretDigestSetSha256: sha256(canonicalJson(
      bundle.attestation.mutationSecretDigests,
    )),
    predecessorReceiptChainSha256:
      bundle.attestation.predecessorAdoption.priorReceiptChainSha256,
    functionAllExistingPlusOneSha256: normalizeFunctionInventoryRows(
      expectedAllExistingPlusOneFunctionRows(
        bundle.preinstallInventories.functions,
      ),
    ).sha256,
    hostedMutationCount: 1,
    functionDeployCount: 0,
  });
}

function secretArguments(bundle) {
  return [
    "secrets",
    "set",
    "--project-ref",
    MAIN_REF,
    "--env-file",
    bundle.secretMutationFile ?? bundle.runtimeFile,
    "--yes",
  ];
}

function deploymentArguments(bundle) {
  return [
    "functions",
    "deploy",
    FUNCTION_NAME,
    "--project-ref",
    MAIN_REF,
    "--no-verify-jwt",
    "--use-api",
    "--workdir",
    bundle.workdir,
    "--yes",
  ];
}

function releasePlanReceiptFields({
  context,
  release,
  bundle,
  inventories,
  functionInventory,
  snapshot,
  recordedAt,
  expiresAt,
  mutationScope,
  resumeFromReceiptSha256,
  predecessorAdoption,
}) {
  if (
    canonicalJson(predecessorAdoption)
      !== canonicalJson(bundle.attestation.predecessorAdoption)
  ) refuse("release plan predecessor adoption differs from durable bundle");
  assertSuccessorPredecessorBaselineHashes({
    predecessorAdoption,
    mainInventorySha256: bundle.attestation.preinstallMainInventorySha256,
    financeInventorySha256: bundle.attestation.preinstallFinanceInventorySha256,
    functionInventorySha256: bundle.attestation.preinstallFunctionInventorySha256,
    functionCount: bundle.preinstallInventories.functions.length,
    label: "release plan durable bundle baseline",
  });
  const successor = isTerminalDivergedPredecessorAdoption(predecessorAdoption);
  const plusOneFunctions = normalizeFunctionInventoryRows(
    successor
      ? expectedAllExistingPlusOneFunctionRows(bundle.preinstallInventories.functions)
      : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
        bundle.preinstallInventories.functions,
      ),
  );
  const currentStagePlusOneFunctions = normalizeFunctionInventoryRows(
    successor
      ? expectedAllExistingPlusOneFunctionRows(functionInventory.rows)
      : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
        functionInventory.rows,
      ),
  );
  const currentStageDisposition =
    classifyScopedFunctionVersionTransition({
      beforeRows: bundle.preinstallInventories.functions,
      afterRows: functionInventory.rows,
      predecessorAdoption,
    });
  if (!["unchanged", "exact-all-existing-plus-one"].includes(currentStageDisposition)) {
    refuse("release plan function stage baseline differs");
  }
  if (
    mutationScope.includes("secrets-set")
    && currentStageDisposition !== "unchanged"
  ) refuse("secret-bearing plan requires the unchanged function stage baseline");
  const common = {
    kind: "release-plan",
    status: "pending",
    environment: "staging",
    recordedAt,
    expiresAt,
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: context.source.commit,
    sourceTreeSha: context.source.tree,
    sourceParentSha: context.source.parent,
    baseTreeSha: context.source.baseTree,
    changedPaths: context.source.changedPaths,
    changedPathSetSha256: context.source.changedPathSetSha256,
    trackedFileCount: context.source.trackedFileCount,
    workflowBlobSha: context.source.workflowBlobSha,
    sourceCiRunId: context.ci.runId,
    sourceCiRunApiSha256: context.ci.runApiSha256,
    sourceCiJobsApiSha256: context.ci.jobsApiSha256,
    sourceCiBranchApiSha256: context.ci.branchApiSha256,
    sourceProvenanceFileSha256: context.provenance.fileSha256,
    sourceProvenanceDescriptorSha256: context.provenance.descriptorSha256,
    releaseManifestSha256: release.manifestSha256,
    sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
    bundleAttestationSha256: bundle.attestation.attestationSha256,
    sourceArchiveSha256: bundle.attestation.sourceArchiveSha256,
    supabaseArchiveSha256: context.source.supabaseArchiveSha256,
    operatorDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    runtimeMutationInputSha256: sha256(canonicalJson(bundle.runtimeMutationInput)),
    runtimeCommandArgsSha256: sha256(canonicalJson(secretArguments(bundle))),
    productionBoundarySha256: bundle.attestation.productionBoundarySha256,
    targetDescriptorSha256: bundle.attestation.targetDescriptorSha256,
    mainInventorySha256: inventories.mainInventorySha256,
    financeInventorySha256: inventories.financeInventorySha256,
    functionInventorySha256: functionInventory.sha256,
    functionVersionTransition: Object.freeze({
      beforeFunctionInventorySha256:
        bundle.attestation.preinstallFunctionInventorySha256,
      unchangedFunctionInventorySha256:
        bundle.attestation.preinstallFunctionInventorySha256,
      exactAllExistingPlusOneFunctionInventorySha256: plusOneFunctions.sha256,
      currentStageFunctionInventorySha256: functionInventory.sha256,
      currentStageDisposition,
      currentStageExactAllExistingPlusOneFunctionInventorySha256:
        currentStagePlusOneFunctions.sha256,
      existingFunctionCount: bundle.preinstallInventories.functions.length,
      allowedDispositions: Object.freeze([
        "unchanged",
        "exact-all-existing-plus-one",
      ]),
      allOtherFieldsUnchanged: true,
      stableReadRounds: 2,
    }),
    predecessorAdoption,
    snapshot: safeSnapshotEvidence(snapshot),
    mutationScope,
    resumeFromReceiptSha256,
    hostedMutationCount: 0,
    productionTouched: false,
  };
  if (!successor) {
    return Object.freeze({
      ...common,
      deployMutationInputSha256: sha256(canonicalJson(bundle.deployMutationInput)),
      deployCommandArgsSha256: sha256(canonicalJson(deploymentArguments(bundle))),
    });
  }
  return Object.freeze({
    ...common,
    semanticMainInventorySha256: semanticSecretInventorySha256(inventories.main),
    mutationSecretNames: bundle.attestation.mutationSecretNames,
    mutationSecretNameSetSha256: sha256(canonicalJson(
      bundle.attestation.mutationSecretNames,
    )),
    mutationSecretDigestSetSha256: sha256(canonicalJson(
      bundle.attestation.mutationSecretDigests,
    )),
    metadataOnlySecretNames: SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
    metadataOnlySecretNameSetSha256: sha256(canonicalJson(
      SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
    )),
    predecessorReceiptChainSha256: predecessorAdoption.priorReceiptChainSha256,
    functionAllExistingPlusOneSha256: plusOneFunctions.sha256,
    plannedHostedMutationCount: 1,
    functionDeployCount: 0,
  });
}

async function operateMeasure(input, common) {
  const release = readMeasurementRelease();
  assertDisjointOperationDirectories(input.stateDir, input.receiptDir);
  const receiptDirectory = assertPrivateDirectory(input.receiptDir, "receipt directory");
  const existingState = existsSync(input.stateDir);
  const stateDirectory = existingState
    ? assertPrivateDirectory(input.stateDir, "state directory")
    : createPrivateStateDirectory(input.stateDir);
  const receiptBinding = existingState
    ? readReceiptBinding(stateDirectory, receiptDirectory)
    : createReceiptBinding(stateDirectory, receiptDirectory);
  const chain = readReceiptChain(receiptDirectory);
  if (chain.some(receipt => receipt.kind !== "catalog-measurement")) {
    refuse("catalog measurement requires an empty or measurement-only receipt chain");
  }
  const supabaseHome = prepareSupabaseHome(stateDirectory);
  const supabaseEnvironment = scrubEnvironment(common.environment, null, supabaseHome);
  const inspectCurrentSource = () => inspectMeasurementSource({
    gitCli: input.gitCli,
    supabaseCli: input.supabaseCli,
    runGit: common.runGit,
    runCli: common.runCli,
    environment: common.environment,
    supabaseEnvironment,
    supabaseHome,
    release,
  });
  const source = inspectCurrentSource();
  const accessToken = readAccessToken(input.accessTokenFile);
  const measurement = await measureMainFinanceRuntimeRecoveryCatalog({
    accessToken,
    fetchImpl: common.fetchImpl,
    preflightSql: release.preflightSql,
    preflightSqlSha256: release.preflightSqlSha256,
    now: common.now,
  });
  const sourceAfterMeasurement = inspectCurrentSource();
  if (canonicalJson(sourceAfterMeasurement) !== canonicalJson(source)) {
    refuse("catalog measurement source changed during hosted read");
  }
  const recordedAt = nextReceiptTimestamp(chain, common.now);
  const measurementFields = Object.freeze({
    kind: "catalog-measurement",
    status: "read-only-verified",
    environment: "staging",
    recordedAt,
    sourceCommitSha: source.commit,
    sourceTreeSha: source.tree,
    sourceParentSha: source.parent,
    baseTreeSha: source.baseTree,
    changedPaths: source.changedPaths,
    changedPathSetSha256: source.changedPathSetSha256,
    trackedFileCount: source.trackedFileCount,
    workflowBlobSha: source.workflowBlobSha,
    releaseManifestSha256: release.manifestSha256,
    preflightSqlSha256: measurement.preflightSqlSha256,
    managementResponseSha256: measurement.responseSha256,
    databaseClock: measurement.databaseClock,
    catalogSha256: measurement.catalogSha256,
    counts: measurement.counts,
    hostedReadCount: 1,
    hostedMutationCount: 0,
    productionTouched: false,
  });
  const currentReceiptBinding = readReceiptBinding(
    stateDirectory,
    receiptDirectory,
  );
  const measurementAuthority = evaluateMainFinanceRuntimeRecoveryV2State({
    action: "measure",
    checkpoint: "request",
    operationBinding: Object.freeze({
      expectedSha256: receiptBinding.bindingSha256,
      currentSha256: currentReceiptBinding.bindingSha256,
    }),
    chain,
    release: null,
    source: null,
    provenance: null,
    ci: null,
    bundle: null,
    approval: null,
    now: recordedAt,
    mutation: "none",
    mutationOutcome: "none",
    secretEvidence: null,
    functionEvidence: null,
    mutationInputEvidence: null,
    observationEvidence: null,
    postflightEvidence: null,
    effectPayload: measurementFields,
  });
  const written = appendAuthorizedReceipt(
    measurementAuthority,
    "append-catalog-measurement",
    receiptDirectory,
    chain,
    measurementFields,
  );
  return Object.freeze({
    ok: true,
    mode: "measure",
    deployReady: false,
    catalogSha256: measurement.catalogSha256,
    counts: measurement.counts,
    receiptFile: written.file,
    receiptSha256: written.receipt.receiptSha256,
    hostedMutationCount: 0,
    productionTouched: false,
  });
}

function initializeReadyOperation(input, common, release, createState) {
  assertDisjointOperationDirectories(input.stateDir, input.receiptDir);
  const receiptDirectory = assertPrivateDirectory(input.receiptDir, "receipt directory");
  const stateDirectory = createState
    ? createPrivateStateDirectory(input.stateDir)
    : assertPrivateDirectory(input.stateDir, "state directory");
  const receiptBinding = createState
    ? createReceiptBinding(stateDirectory, receiptDirectory)
    : readReceiptBinding(stateDirectory, receiptDirectory);
  const chain = readReceiptChain(receiptDirectory);
  const allowPreservedDriftRecovery = chainAllowsPreservedLocalStateRecovery(chain);
  const supabaseHome = prepareSupabaseHome(
    stateDirectory,
    allowPreservedDriftRecovery,
  );
  const ghLocalState = prepareGhLocalState(
    stateDirectory,
    allowPreservedDriftRecovery,
  );
  const supabaseEnvironment = scrubEnvironment(common.environment, null, supabaseHome);
  const provenance = readProvenance(input.releaseProvenance);
  const accessBoundary = readReviewedAccessBoundary(input);
  const inspectCurrentSource = () => inspectSource({
    provenance,
    gitCli: input.gitCli,
    supabaseCli: input.supabaseCli,
    runGit: common.runGit,
    runCli: common.runCli,
    environment: common.environment,
    supabaseEnvironment,
    supabaseHome,
    release,
  });
  const source = inspectCurrentSource();
  const ci = inspectSourceCi({
    provenance,
    source,
    ghCli: input.ghCli,
    runGh: common.runGh,
    environment: common.environment,
    release,
    ghLocalState,
  });
  const sourceAfterCi = inspectCurrentSource();
  if (canonicalJson(sourceAfterCi) !== canonicalJson(source)) {
    refuse("Main source changed during live CI attestation");
  }
  const sealedSupabaseCli = prepareSealedSupabaseCli(
    stateDirectory,
    source.supabase,
    createState,
  );
  const accessToken = readAccessToken(input.accessTokenFile);
  const dependencies = Object.freeze({
    runCli: common.runCli,
    supabase: sealedSupabaseCli.file,
    supabaseMutationInput: sealedSupabaseCli.input,
    supabaseHome,
    cliEnvironment: scrubEnvironment(common.environment, accessToken, supabaseHome),
    accessToken,
    fetchImpl: common.fetchImpl,
    now: common.now,
  });
  return Object.freeze({
    stateDirectory,
    receiptDirectory,
    receiptBinding,
    chain,
    provenance,
    accessBoundary,
    source,
    ci,
    ghLocalState,
    dependencies,
  });
}

function inspectReadyOperationSource(context, input, common, release) {
  return inspectSource({
    provenance: context.provenance,
    gitCli: input.gitCli,
    supabaseCli: input.supabaseCli,
    runGit: common.runGit,
    runCli: common.runCli,
    environment: common.environment,
    supabaseEnvironment: scrubEnvironment(
      common.environment,
      null,
      context.dependencies.supabaseHome,
    ),
    supabaseHome: context.dependencies.supabaseHome,
    release,
  });
}

function inspectReadyOperationSourceCi(context, input, common, release) {
  const sourceBeforeCi = inspectReadyOperationSource(
    context,
    input,
    common,
    release,
  );
  if (canonicalJson(sourceBeforeCi) !== canonicalJson(context.source)) {
    refuse("Main source changed before live CI re-attestation");
  }
  const ci = inspectSourceCi({
    provenance: context.provenance,
    source: sourceBeforeCi,
    ghCli: input.ghCli,
    runGh: common.runGh,
    environment: common.environment,
    release,
    ghLocalState: context.ghLocalState,
  });
  const sourceAfterCi = inspectReadyOperationSource(
    context,
    input,
    common,
    release,
  );
  if (
    canonicalJson(sourceAfterCi) !== canonicalJson(sourceBeforeCi)
    || canonicalJson(sourceAfterCi) !== canonicalJson(context.source)
  ) refuse("Main source changed during live CI re-attestation");
  return ci;
}

async function operatePlan(input, common, release) {
  assertAbsolute(input.stateDir, "state directory");
  if (!outsideRepository(input.stateDir)) {
    refuse("state directory must remain outside the repository");
  }
  if (existsSync(input.stateDir)) {
    return operateResumePlan(input, common, release);
  }
  if (input.priorStateDir === null) {
    refuse("fresh successor plan requires the exact predecessor adoption flags");
  }
  const preflightReceiptIdentity = receiptDirectoryIdentity(input.receiptDir);
  const preflightChain = readReceiptChain(input.receiptDir, { readOnly: true });
  assertRuntimeReadChainEligibility("fresh-plan", preflightChain);
  const predecessor = input.priorStateDir === null
    ? null
    : readTerminalDivergedPredecessorAdoption(input, release);
  const postPredecessorReceiptIdentity = receiptDirectoryIdentity(input.receiptDir);
  const postPredecessorChain = readReceiptChain(input.receiptDir, { readOnly: true });
  assertFreshReceiptAuthorityUnchanged({
    expectedIdentity: preflightReceiptIdentity,
    expectedChain: preflightChain,
    currentIdentity: postPredecessorReceiptIdentity,
    currentChain: postPredecessorChain,
    phase: "during predecessor read",
  });
  const context = initializeReadyOperation(input, common, release, true);
  assertFreshReceiptAuthorityUnchanged({
    expectedIdentity: preflightReceiptIdentity,
    expectedChain: preflightChain,
    currentIdentity: receiptBindingIdentity(context.receiptBinding),
    currentChain: context.chain,
    phase: "during initialization",
  });
  if (unresolvedReceipt(context.chain)) {
    refuse("an unresolved earlier mutation blocks a new plan");
  }
  if (context.chain.some(receipt => [
    "release-plan", "mutation-intent", "mutation-result", "reconciliation",
    "release-complete",
  ].includes(receipt.kind))) {
    refuse("a new initial bundle requires a receipt chain with no prior release state");
  }
  const inventories0 = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory0 = fetchFunctionInventory(context.dependencies);
  const inventories = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory = fetchFunctionInventory(context.dependencies);
  if (
    !inventoryIsUnchanged(inventories0.main, inventories.main)
    || !inventoryIsUnchanged(inventories0.finance, inventories.finance)
    || canonicalJson(functionInventory0.rows) !== canonicalJson(functionInventory.rows)
  ) refuse("fresh plan inventories are not stable across two read rounds");
  if (
    inventories.mainInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalMainInventorySha256
    || inventories.financeInventorySha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.financeInventorySha256
    || functionInventory.sha256
      !== TERMINAL_DIVERGED_PREDECESSOR_PINS.terminalFunctionInventorySha256
  ) refuse("fresh plan inventories differ from the exact terminal-diverged baseline");
  let predecessorAdoption = null;
  if (predecessor !== null) {
    const priorBundle = predecessor.bundle;
    const priorInstalled = inventoryMatchesFullInstallWithMetadataDrift(
      priorBundle.preinstallInventories.main,
      inventories.main,
      priorBundle.attestation.expectedSecretDigests,
      priorBundle.attestation.secretNames,
    ) && inventoryIsUnchanged(
      priorBundle.preinstallInventories.finance,
      inventories.finance,
    );
    if (
      !priorInstalled
      || !functionInventoryMatchesSoleAddition(
        functionInventory,
        predecessor.postSecretFunctionRows,
      )
      || functionTargetState(functionInventory) !== "exact"
    ) {
      refuse("predecessor hosted state is not the exact stable terminal-diverged subject");
    }
    predecessorAdoption = predecessor.summary;
  }
  const snapshot = await buildCurrentSnapshot(
    context.dependencies,
    release,
    context.source,
    inventories,
    "recovery",
  );
  const bundle = createBundle({
    stateDirectory: context.stateDirectory,
    release,
    source: context.source,
    supabaseMutationInput: context.dependencies.supabaseMutationInput,
    snapshot,
    inventories,
    functionInventory,
    accessBoundary: context.accessBoundary,
    randomBytesImpl: common.randomBytesImpl,
    generatedSecretValues: predecessor?.generatedSecretValues ?? null,
    predecessorAdoption,
    now: common.now,
  });
  if (predecessor !== null) {
    const predecessorAfterCopy = readTerminalDivergedPredecessorAdoption(
      input,
      release,
    );
    if (
      canonicalJson(predecessorAfterCopy.summary)
        !== canonicalJson(predecessor.summary)
      || canonicalJson(predecessorAfterCopy.identity)
        !== canonicalJson(predecessor.identity)
      || canonicalJson(predecessorAfterCopy.generatedSecretDigests)
        !== canonicalJson(predecessor.generatedSecretDigests)
      || canonicalJson(predecessorAfterCopy.generatedSecretValues)
        !== canonicalJson(predecessor.generatedSecretValues)
    ) refuse("predecessor evidence changed during generated-secret adoption");
  }
  const recordedAt = nextReceiptTimestamp(context.chain, common.now);
  if (
    Date.parse(snapshot.database_clock) > Date.parse(recordedAt)
      + release.manifest.plan.futureClockSkewSeconds * 1_000
  ) refuse("database snapshot clock exceeds the allowed future skew");
  const expiry = Math.min(
    Date.parse(recordedAt) + release.manifest.plan.ttlSeconds * 1_000,
    Date.parse(snapshot.database_clock)
      + release.manifest.plan.maximumSnapshotAgeSeconds * 1_000,
  );
  if (expiry <= Date.parse(recordedAt)) {
    refuse("database snapshot expired before plan creation");
  }
  const planFields = releasePlanReceiptFields({
    context,
    release,
    bundle,
    inventories,
    functionInventory,
    snapshot,
    recordedAt,
    expiresAt: new Date(expiry).toISOString(),
    mutationScope: "secrets-set",
    resumeFromReceiptSha256: null,
    predecessorAdoption,
  });
  const planAuthority = evaluateOperationalState({
    action: "plan",
    checkpoint: "request",
    context,
    release,
    bundle,
    now: recordedAt,
    inventories,
    functionInventory,
    effectPayload: planFields,
  });
  if (planAuthority.nextScope !== "secrets-set") {
    refuse("initial declarative plan scope differs");
  }
  const written = appendAuthorizedReceipt(
    planAuthority,
    "append-release-plan",
    context.receiptDirectory,
    context.chain,
    planFields,
  );
  return Object.freeze({
    ok: true,
    mode: "plan",
    deployReady: true,
    expiresAt: written.receipt.expiresAt,
    planReceiptFile: written.file,
    planReceiptSha256: written.receipt.receiptSha256,
    approval: expectedApproval(written.receipt),
    ownerPrivateDescriptorFile: bundle.operatorDescriptorFile,
    ownerPrivateDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    hostedMutationCount: 0,
    productionTouched: false,
  });
}

async function operateResumePlan(input, common, release) {
  if (release.environment.schemaVersion === 3) {
    refuse("secrets-only successor never issues a resume or retry plan");
  }
  if (input.priorStateDir === null) {
    refuse("adopted successor resume requires its exact predecessor flags");
  }
  const context = initializeReadyOperation(input, common, release, false);
  if (unresolvedReceipt(context.chain)) {
    refuse("resume plan requires completed read-only reconciliation first");
  }
  if (context.chain.some(receipt => receipt.kind === "release-complete")) {
    refuse("completed release cannot receive a resume mutation plan");
  }
  const resumeCause = context.chain.at(-1);
  const priorPlan = [...context.chain].reverse()
    .find(receipt => receipt.kind === "release-plan") ?? null;
  const eligibilityAt = exactNow(common.now).toISOString();
  const resumeEligibility = assertRuntimeReadChainEligibility(
    "resume",
    context.chain,
    eligibilityAt,
  );
  const orphanedBundle = resumeEligibility.orphanedBundle;
  const predecessor = readPredecessorAdoption(input, release);
  const expectedPredecessorAdoption =
    exactSuccessorPredecessorAdoption(predecessor);
  const inventories0 = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory0 = fetchFunctionInventory(context.dependencies);
  const inventories = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory = fetchFunctionInventory(context.dependencies);
  if (
    !inventoryIsUnchanged(inventories0.main, inventories.main)
    || !inventoryIsUnchanged(inventories0.finance, inventories.finance)
    || canonicalJson(functionInventory0.rows) !== canonicalJson(functionInventory.rows)
  ) refuse("resume plan inventories are not stable across two read rounds");
  const bundle = readBundle(
    context.stateDirectory,
    release,
    context.source,
    {
      expectedAttestationSha256:
        priorPlan?.bundleAttestationSha256 ?? null,
      expectedPredecessorAdoption,
      orphanedAdoptionAuthority: orphanedBundle,
      authorizeRuntimeRead: (attestation, successorPreinstall) => {
        if (priorPlan === null) {
          const predecessorInstalledBeforePlaintext = inventoryMatchesInstall(
            predecessor.bundle.preinstallInventories.main,
            inventories.main,
            predecessor.bundle.attestation.expectedSecretDigests,
            predecessor.bundle.attestation.secretNames,
          ) && inventoryIsUnchanged(
            predecessor.bundle.preinstallInventories.finance,
            inventories.finance,
          );
          const successorNotInstalledBeforePlaintext = inventoryIsUnchanged(
            successorPreinstall.main,
            inventories.main,
          ) && inventoryIsUnchanged(
            successorPreinstall.finance,
            inventories.finance,
          );
          assertOrphanedSuccessorRecoveryFrames({
            predecessorRows: predecessor.bundle.preinstallInventories.functions,
            successorRows: successorPreinstall.functions,
            currentRows: functionInventory.rows,
            bundlePredecessorAdoption: attestation.predecessorAdoption,
            expectedPredecessorAdoption,
            predecessorInstalled: predecessorInstalledBeforePlaintext,
            successorNotInstalled: successorNotInstalledBeforePlaintext,
          });
          if (
            functionInventory.sha256
              !== predecessor.terminalFunctionInventorySha256
          ) refuse("orphaned predecessor terminal function hash differs");
          if (
            attestation.productionBoundarySha256
              !== context.accessBoundary.productionBoundarySha256
            || attestation.targetDescriptorSha256
              !== context.accessBoundary.targetDescriptorSha256
          ) refuse("orphaned bundle owner boundary changed before runtime read");
          return;
        }
        assertPlanEnvelopeBeforePlaintext(
          priorPlan,
          attestation,
          release,
          context.source,
          context.provenance,
          context.ci,
          context.accessBoundary,
          context.stateDirectory,
        );
      },
    },
  );
  if (bundle.attestation.predecessorAdoption === null) {
    refuse("adopted successor bundle predecessor evidence is absent");
  }
  for (const [key, value] of Object.entries(predecessor.summary)) {
    if (canonicalJson(bundle.attestation.predecessorAdoption[key]) !== canonicalJson(value)) {
      refuse("adopted successor bundle predecessor binding differs");
    }
  }
  for (const [name, digest] of Object.entries(predecessor.generatedSecretDigests)) {
    if (sha256(bundle.runtime.values[name]) !== digest) {
      refuse("adopted successor generated secret values differ from predecessor");
    }
  }
  if (
    (!orphanedBundle
      && priorPlan.bundleAttestationSha256 !== bundle.attestation.attestationSha256)
    || bundle.attestation.productionBoundarySha256
      !== context.accessBoundary.productionBoundarySha256
    || bundle.attestation.targetDescriptorSha256
      !== context.accessBoundary.targetDescriptorSha256
  ) refuse("held recovery bundle or owner boundary differs");
  const installed = inventoryMatchesInstall(
    bundle.preinstallInventories.main,
    inventories.main,
    bundle.attestation.expectedSecretDigests,
    bundle.attestation.secretNames,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance);
  const notInstalled = inventoryIsUnchanged(
    bundle.preinstallInventories.main,
    inventories.main,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance);
  if (!installed && !notInstalled) refuse("held bundle secret state diverged");
  const functionDisposition = classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
    beforeRows: bundle.preinstallInventories.functions,
    afterRows: functionInventory.rows,
  });
  if (
    (notInstalled && functionDisposition !== "unchanged")
    || (installed && !["unchanged", "exact-all-existing-plus-one"]
      .includes(functionDisposition))
  ) refuse("held bundle function phase baseline diverged");
  const predecessorInstalled = inventoryMatchesInstall(
    predecessor.bundle.preinstallInventories.main,
    inventories.main,
    predecessor.bundle.attestation.expectedSecretDigests,
    predecessor.bundle.attestation.secretNames,
  ) && inventoryIsUnchanged(
    predecessor.bundle.preinstallInventories.finance,
    inventories.finance,
  );
  const predecessorFunctionDisposition =
    classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: predecessor.bundle.preinstallInventories.functions,
      afterRows: functionInventory.rows,
    });
  if (
    notInstalled
    && (!predecessorInstalled
      || functionInventory.sha256 !== predecessor.terminalFunctionInventorySha256
      || predecessorFunctionDisposition !== "exact-all-existing-plus-one")
  ) refuse("adopted successor resume predecessor hosted state differs");
  if (orphanedBundle) {
    assertOrphanedSuccessorRecoveryFrames({
      predecessorRows: predecessor.bundle.preinstallInventories.functions,
      successorRows: bundle.preinstallInventories.functions,
      currentRows: functionInventory.rows,
      bundlePredecessorAdoption: bundle.attestation.predecessorAdoption,
      expectedPredecessorAdoption,
      predecessorInstalled,
      successorNotInstalled: notInstalled,
    });
  }
  const snapshot = await buildCurrentSnapshot(
    context.dependencies,
    release,
    context.source,
    inventories,
    "recovery",
  );
  if (!snapshotMatchesBundle(snapshot, bundle)) {
    refuse("resume snapshot differs from the exact held recovery bundle");
  }
  const recordedAt = nextReceiptTimestamp(context.chain, common.now);
  if (
    Date.parse(snapshot.database_clock) > Date.parse(recordedAt)
      + release.manifest.plan.futureClockSkewSeconds * 1_000
  ) refuse("resume database snapshot clock exceeds the allowed future skew");
  const expiry = Math.min(
    Date.parse(recordedAt) + release.manifest.plan.ttlSeconds * 1_000,
    Date.parse(snapshot.database_clock)
      + release.manifest.plan.maximumSnapshotAgeSeconds * 1_000,
  );
  if (expiry <= Date.parse(recordedAt)) {
    refuse("resume snapshot expired before plan creation");
  }
  const proposedMutationScope = orphanedBundle
    ? "secrets-set+function-deploy"
    : resumeScopeForCause(resumeCause, recordedAt);
  if (![
    "secrets-set", "function-deploy", "secrets-set+function-deploy",
  ].includes(proposedMutationScope)
    || (!orphanedBundle
      && proposedMutationScope !== resumeEligibility.resumeScope)
  ) refuse("resume plan candidate scope differs");
  const planFields = releasePlanReceiptFields({
    context,
    release,
    bundle,
    inventories,
    functionInventory,
    snapshot,
    recordedAt,
    expiresAt: new Date(expiry).toISOString(),
    mutationScope: proposedMutationScope,
    resumeFromReceiptSha256: orphanedBundle ? null : resumeCause.receiptSha256,
    predecessorAdoption: bundle.attestation.predecessorAdoption,
  });
  const predecessorAfterPlan = readPredecessorAdoption(input, release);
  if (
    canonicalJson(predecessorAfterPlan.summary) !== canonicalJson(predecessor.summary)
    || canonicalJson(predecessorAfterPlan.identity) !== canonicalJson(predecessor.identity)
    || canonicalJson(predecessorAfterPlan.generatedSecretDigests)
      !== canonicalJson(predecessor.generatedSecretDigests)
  ) refuse("predecessor evidence changed during adopted successor resume");
  const planAuthority = evaluateOperationalState({
    action: "plan",
    checkpoint: "request",
    context,
    release,
    bundle,
    now: recordedAt,
    inventories,
    functionInventory,
    effectPayload: planFields,
  });
  const mutationScope = planAuthority.nextScope;
  if (![
    "secrets-set", "function-deploy", "secrets-set+function-deploy",
  ].includes(mutationScope)) refuse("resume declarative plan scope differs");
  if (mutationScope !== proposedMutationScope) {
    refuse("resume declarative plan candidate differs");
  }
  const written = appendAuthorizedReceipt(
    planAuthority,
    "append-release-plan",
    context.receiptDirectory,
    context.chain,
    planFields,
  );
  return Object.freeze({
    ok: true,
    mode: "plan",
    planKind: orphanedBundle ? "recovered-initial" : "resume",
    deployReady: true,
    mutationScope,
    heldBundleReused: true,
    expiresAt: written.receipt.expiresAt,
    planReceiptFile: written.file,
    planReceiptSha256: written.receipt.receiptSha256,
    approval: expectedApproval(written.receipt),
    ownerPrivateDescriptorFile: bundle.operatorDescriptorFile,
    ownerPrivateDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    hostedMutationCount: 0,
    productionTouched: false,
  });
}

function unknownResultReceiptFields(
  mutation,
  intentReceiptSha256,
  recordedAt,
  responseStatus = null,
) {
  return Object.freeze({
    kind: "mutation-result",
    mutation,
    status: "unknown",
    environment: "staging",
    recordedAt,
    intentReceiptSha256,
    responseStatus,
    reconcileRequired: true,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
}

function appendUnknownResult(
  authority,
  context,
  mutation,
  intent,
  responseStatus = null,
) {
  return appendAuthorizedReceipt(
    authority,
    "append-unknown-result",
    context.receiptDirectory,
    context.chain,
    unknownResultReceiptFields(
      mutation,
      intent.receipt.receiptSha256,
      authority.recordedAt,
      responseStatus,
    ),
  );
}

function unknownOutcomeAuthority({
  context,
  release,
  bundle,
  mutation,
  inventories,
  functionInventory,
}) {
  const intent = context.chain.at(-1);
  const recordedAt = nextReceiptTimestamp(
    context.chain,
    context.dependencies.now,
  );
  const fields = unknownResultReceiptFields(
    mutation,
    intent?.receiptSha256,
    recordedAt,
  );
  return evaluateOperationalState({
    action: "apply",
    checkpoint: "after-mutation",
    context,
    release,
    bundle,
    approval: null,
    now: recordedAt,
    mutation,
    mutationOutcome: "unknown",
    inventories,
    functionInventory,
    effectPayload: fields,
  });
}

async function operateApply(input, common, release) {
  const context = initializeReadyOperation(input, common, release, false);
  let currentCi = context.ci;
  const complete = [...context.chain].reverse().find(receipt => receipt.kind === "release-complete");
  if (complete) {
    refuse("release is already complete; apply never trusts a prior completion as a new mutation authority");
  }
  const unresolved = unresolvedReceipt(context.chain);
  if (unresolved) {
    refuse("unknown or divergent mutation must be reconciled before apply");
  }
  const plan = latestPlan(context.chain);
  assertCurrentReleaseSecretsOnlyPlan(plan);
  const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
    plan.predecessorAdoption,
  );
  let postSecretFunctionDisposition = null;
  let verifiedSecretResult = null;
  if (context.chain.at(-1)?.receiptSha256 !== plan.receiptSha256) {
    refuse("apply requires a fresh owner-approved plan as the latest receipt");
  }
  assertRuntimeReadChainEligibility("apply", context.chain);
  const now = exactNow(common.now);
  const bundle = readBundle(
    context.stateDirectory,
    release,
    context.source,
    {
      expectedAttestationSha256: plan.bundleAttestationSha256,
      expectedPredecessorAdoption: plan.predecessorAdoption,
      authorizeRuntimeRead: attestation => {
        assertCurrentReleaseSecretsOnlyBundle(attestation, plan);
        return assertPlanEnvelopeCurrentBeforePlaintext(
          plan,
          attestation,
          release,
          context.source,
          context.provenance,
          context.ci,
          context.accessBoundary,
          context.stateDirectory,
          input.approval,
          now,
        );
      },
    },
  );
  let postSecretFunctionBaselineRows = functionVersionTransitionBaselineRows(
    bundle.preinstallInventories.functions,
    plan.functionVersionTransition.currentStageDisposition,
  );
  if (secretsOnlySuccessor) {
    postSecretFunctionBaselineRows = scopedFunctionVersionTransitionRows(
      bundle.preinstallInventories.functions,
      plan.functionVersionTransition.currentStageDisposition,
      plan.predecessorAdoption,
    );
  }
  assertPlanCurrent(
    plan,
    bundle,
    release,
    context.source,
    context.provenance,
    input.approval,
    now,
  );
  if (
    bundle.attestation.productionBoundarySha256
      !== context.accessBoundary.productionBoundarySha256
    || bundle.attestation.targetDescriptorSha256
      !== context.accessBoundary.targetDescriptorSha256
    || plan.productionBoundarySha256 !== bundle.attestation.productionBoundarySha256
    || plan.targetDescriptorSha256 !== bundle.attestation.targetDescriptorSha256
    || plan.sourceParentSha !== context.source.parent
    || plan.changedPathSetSha256 !== context.source.changedPathSetSha256
    || plan.workflowBlobSha !== context.source.workflowBlobSha
    || plan.sourceCiRunId !== context.ci.runId
    || plan.sourceCiRunApiSha256 !== context.ci.runApiSha256
    || plan.sourceCiJobsApiSha256 !== context.ci.jobsApiSha256
    || plan.sourceCiBranchApiSha256 !== context.ci.branchApiSha256
    || plan.sourceProvenanceFileSha256 !== context.provenance.fileSha256
    || plan.sourceProvenanceDescriptorSha256 !== context.provenance.descriptorSha256
    || plan.snapshot.catalogSha256 !== bundle.attestation.catalogSha256
    || plan.snapshot.descriptorSha256 !== bundle.attestation.descriptorSha256
    || plan.snapshot.stateSha256 !== bundle.attestation.stateSha256
    || plan.snapshot.gateInventorySha256 !== bundle.attestation.gateInventorySha256
    || plan.snapshot.privacyInventorySha256 !== bundle.attestation.privacyInventorySha256
    || plan.snapshot.checkedCount !== bundle.attestation.checkedCount
  ) refuse("plan source, owner boundary or descriptor binding differs");

  const freshInventories = fetchSecretInventories(context.dependencies, "recovery");
  const freshFunction = fetchFunctionInventory(context.dependencies);
  const freshPreinstallState = inventoryIsUnchanged(
    bundle.preinstallInventories.main,
    freshInventories.main,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, freshInventories.finance);
  const freshInstalledState = inventoryMatchesInstall(
    bundle.preinstallInventories.main,
    freshInventories.main,
    bundle.attestation.expectedSecretDigests,
    bundle.attestation.secretNames,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, freshInventories.finance);
  const freshSuccessorInstalledState = secretsOnlySuccessor
    && inventoryMatchesSuccessorInstall(
      bundle.preinstallInventories.main,
      freshInventories.main,
      bundle.attestation.mutationSecretDigests,
      bundle.attestation.mutationSecretNames,
    )
    && inventoryIsUnchanged(
      bundle.preinstallInventories.finance,
      freshInventories.finance,
    );
  if (
    (plan.mutationScope === "function-deploy" && !freshInstalledState)
    || (plan.mutationScope !== "function-deploy" && !freshPreinstallState)
    || plan.mainInventorySha256 !== freshInventories.mainInventorySha256
    || plan.financeInventorySha256 !== freshInventories.financeInventorySha256
  ) refuse("current secret inventory differs from the exact scoped plan");
  const freshSnapshot = await buildCurrentSnapshot(
    context.dependencies,
    release,
    context.source,
    freshInventories,
    "recovery",
  );
  if (!snapshotMatchesBundle(freshSnapshot, bundle)) {
    refuse("fresh pre-mutation snapshot differs from the owner-approved bundle");
  }
  if (!functionInventoryMatchesPostSecretBaseline(
    freshFunction,
    postSecretFunctionBaselineRows,
  )) {
    refuse("pre-mutation hosted function inventory differs from the approved bundle");
  }
  if (plan.functionInventorySha256 !== freshFunction.sha256) {
    refuse("plan function inventory binding differs");
  }
  currentCi = inspectReadyOperationSourceCi(context, input, common, release);
  if (
    currentCi.runApiSha256 !== plan.sourceCiRunApiSha256
    || currentCi.jobsApiSha256 !== plan.sourceCiJobsApiSha256
    || currentCi.branchApiSha256 !== plan.sourceCiBranchApiSha256
  ) refuse("live source CI or release branch changed after owner plan");
  assertPlanCurrent(
    plan,
    bundle,
    release,
    context.source,
    context.provenance,
    input.approval,
    exactNow(common.now),
  );

  if (
    plan.mutationScope !== "function-deploy"
    && !mutationVerified(context.chain, plan, "secrets-set")
  ) {
    if (
      secretsOnlySuccessor
        ? functionTargetState(freshFunction) !== "exact"
        : freshFunction.target !== null
    ) refuse("target function baseline differs before secret installation");
    if (!mutationInputIsUnchanged(bundle, release, "secrets-set")) {
      refuse("runtime secret env changed before mutation intent");
    }
    const secretIntentRecordedAt = nextReceiptTimestamp(
      context.chain,
      common.now,
    );
    const secretIntentFields = Object.freeze({
      kind: "mutation-intent",
      mutation: "secrets-set",
      status: "pending",
      environment: "staging",
      recordedAt: secretIntentRecordedAt,
      planReceiptSha256: plan.receiptSha256,
      beforeMainInventorySha256: freshInventories.mainInventorySha256,
      beforeFinanceInventorySha256: freshInventories.financeInventorySha256,
      beforeFunctionInventorySha256: freshFunction.sha256,
      unchangedFunctionInventorySha256: freshFunction.sha256,
      exactAllExistingPlusOneFunctionInventorySha256:
        normalizeFunctionInventoryRows(
          secretsOnlySuccessor
            ? expectedAllExistingPlusOneFunctionRows(freshFunction.rows)
            : expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
              freshFunction.rows,
            ),
        ).sha256,
      requiredStableReadRounds: 2,
      predecessorAdoptionSha256: sha256(canonicalJson(plan.predecessorAdoption)),
      expectedSecretDigestSetSha256: sha256(canonicalJson(
        secretsOnlySuccessor
          ? bundle.attestation.mutationSecretDigests
          : bundle.attestation.expectedSecretDigests,
      )),
      secretNames: secretsOnlySuccessor
        ? bundle.attestation.mutationSecretNames
        : bundle.attestation.secretNames,
      ...(secretsOnlySuccessor ? {
        semanticBeforeMainInventorySha256:
          semanticSecretInventorySha256(freshInventories.main),
        mutationSecretNameSetSha256: sha256(canonicalJson(
          bundle.attestation.mutationSecretNames,
        )),
        metadataOnlySecretNameSetSha256: sha256(canonicalJson(
          SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
        )),
        predecessorReceiptChainSha256:
          plan.predecessorAdoption.priorReceiptChainSha256,
        functionAllExistingPlusOneSha256:
          plan.functionAllExistingPlusOneSha256,
        hostedMutationCount: 0,
        functionDeployCount: 0,
      } : {}),
      automaticRetryPerformed: false,
      productionTouched: false,
    });
    const secretIntentAuthority = evaluateOperationalState({
      action: "apply",
      checkpoint: "before-intent",
      context,
      release,
      bundle,
      ci: currentCi,
      approval: input.approval,
      now: secretIntentRecordedAt,
      mutation: "secrets-set",
      inventories: freshInventories,
      functionInventory: freshFunction,
      effectPayload: secretIntentFields,
    });
    const intent = appendAuthorizedReceipt(
      secretIntentAuthority,
      "append-mutation-intent",
      context.receiptDirectory,
      context.chain,
      secretIntentFields,
    );
    if (!mutationInputIsUnchanged(bundle, release, "secrets-set")) {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: freshInventories, functionInventory: freshFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`runtime secret env changed after intent; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    let immediateSecretInventories;
    let immediateSecretFunction;
    try {
      currentCi = inspectReadyOperationSourceCi(context, input, common, release);
      immediateSecretInventories = fetchSecretInventories(
        context.dependencies,
        "recovery",
      );
      immediateSecretFunction = fetchFunctionInventory(context.dependencies);
    } catch {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: freshInventories, functionInventory: freshFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`secret installation pre-mutation authority is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    if (
      !sourceCiMatchesPlan(currentCi, plan)
      || !inventoryIsUnchanged(freshInventories.main, immediateSecretInventories.main)
      || !inventoryIsUnchanged(freshInventories.finance, immediateSecretInventories.finance)
      || canonicalJson(freshFunction.rows) !== canonicalJson(immediateSecretFunction.rows)
      || !mutationInputIsUnchanged(bundle, release, "secrets-set")
    ) {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: immediateSecretInventories,
        functionInventory: immediateSecretFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`secret installation pre-mutation evidence changed; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    assertPlanCurrent(
      plan,
      bundle,
      release,
      context.source,
      context.provenance,
      input.approval,
      exactNow(common.now),
    );
    const secretCommand = mutationCommandPayload(
      bundle,
      release,
      "secrets-set",
    );
    const secretMutationAuthority = evaluateOperationalState({
      action: "apply",
      checkpoint: "before-mutation",
      context,
      release,
      bundle,
      ci: currentCi,
      approval: input.approval,
      now: exactNow(common.now),
      mutation: "secrets-set",
      inventories: immediateSecretInventories,
      functionInventory: immediateSecretFunction,
      effectPayload: secretCommand,
    });
    const result = invokeAuthorizedMutation(
      secretMutationAuthority,
      "secrets-set",
      context.dependencies,
      secretArguments(bundle),
      bundle,
      release,
      context.chain,
      context.receiptDirectory,
      context.stateDirectory,
      context.receiptBinding.bindingSha256,
      Object.freeze({
        context,
        plan,
        approval: input.approval,
        source: context.source,
        provenance: context.provenance,
        ci: currentCi,
        inventories: immediateSecretInventories,
        functionInventory: immediateSecretFunction,
        now: common.now,
      }),
    );
    if (
      !successful(result)
      || !mutationInputIsUnchanged(bundle, release, "secrets-set")
    ) {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: immediateSecretInventories,
        functionInventory: immediateSecretFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`secret installation outcome is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    let after0;
    let afterFunction0;
    let after;
    let afterFunction;
    try {
      after0 = fetchSecretInventories(context.dependencies, "recovery");
      afterFunction0 = fetchFunctionInventory(context.dependencies);
      after = fetchSecretInventories(context.dependencies, "recovery");
      afterFunction = fetchFunctionInventory(context.dependencies);
      currentCi = inspectReadyOperationSourceCi(context, input, common, release);
    } catch {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: immediateSecretInventories,
        functionInventory: immediateSecretFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`secret installation outcome is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    postSecretFunctionDisposition =
      classifyScopedFunctionVersionTransition({
        beforeRows: freshFunction.rows,
        afterRows: afterFunction.rows,
        predecessorAdoption: plan.predecessorAdoption,
      });
    const successorInstalled = secretsOnlySuccessor
      ? inventoryMatchesSuccessorInstall(
        freshInventories.main,
        after.main,
        bundle.attestation.mutationSecretDigests,
        bundle.attestation.mutationSecretNames,
      )
      : inventoryMatchesInstall(
        freshInventories.main,
        after.main,
        bundle.attestation.expectedSecretDigests,
        bundle.attestation.secretNames,
      );
    if (
      !successorInstalled
      || !inventoryIsUnchanged(freshInventories.finance, after.finance)
      || !inventoryIsUnchanged(after0.main, after.main)
      || !inventoryIsUnchanged(after0.finance, after.finance)
      || canonicalJson(afterFunction0.rows) !== canonicalJson(afterFunction.rows)
      || !["unchanged", "exact-all-existing-plus-one"]
        .includes(postSecretFunctionDisposition)
      || afterFunction.sha256 !== (
        postSecretFunctionDisposition === "unchanged"
          ? intent.receipt.unchangedFunctionInventorySha256
          : intent.receipt.exactAllExistingPlusOneFunctionInventorySha256
      )
      || !sourceCiMatchesPlan(currentCi, plan)
    ) {
      const authority = unknownOutcomeAuthority({
        context, release, bundle, mutation: "secrets-set",
        inventories: after, functionInventory: afterFunction,
      });
      const unknown = appendUnknownResult(authority, context, "secrets-set", intent);
      refuse(`secret installation diverged; reconcile receipt ${unknown.receipt.receiptSha256}`);
    }
    const metadataDelta = secretsOnlySuccessor
      ? metadataOnlyInventoryDelta(
        inventoryWithoutNames(
          freshInventories.main,
          bundle.attestation.mutationSecretNames,
        ),
        inventoryWithoutNames(
          after.main,
          bundle.attestation.mutationSecretNames,
        ),
      )
      : null;
    postSecretFunctionBaselineRows = afterFunction.rows;
    const secretResultRecordedAt = nextReceiptTimestamp(
      context.chain,
      common.now,
    );
    const secretResultFields = Object.freeze({
      kind: "mutation-result",
      mutation: "secrets-set",
      status: "verified",
      environment: "staging",
      recordedAt: secretResultRecordedAt,
      intentReceiptSha256: intent.receipt.receiptSha256,
      afterMainInventorySha256: after.mainInventorySha256,
      afterFinanceInventorySha256: after.financeInventorySha256,
      afterFunctionInventorySha256: afterFunction.sha256,
      functionVersionTransitionDisposition: postSecretFunctionDisposition,
      functionInventoryStableReadRounds: 2,
      predecessorAdoptionSha256: sha256(canonicalJson(plan.predecessorAdoption)),
      observation: "installed_observed",
      state: "state_satisfied",
      causalAttribution: false,
      ...(secretsOnlySuccessor ? {
        semanticAfterMainInventorySha256:
          semanticSecretInventorySha256(after.main),
        metadataOnlyDeltaNames: metadataDelta.names,
        metadataOnlyDeltaSha256: metadataDelta.sha256,
        mutationSecretNames: bundle.attestation.mutationSecretNames,
        mutationSecretNameSetSha256: sha256(canonicalJson(
          bundle.attestation.mutationSecretNames,
        )),
        mutationSecretDigestSetSha256: sha256(canonicalJson(
          bundle.attestation.mutationSecretDigests,
        )),
        predecessorReceiptChainSha256:
          plan.predecessorAdoption.priorReceiptChainSha256,
        functionAllExistingPlusOneSha256:
          intent.receipt.exactAllExistingPlusOneFunctionInventorySha256,
        hostedMutationCount: 1,
        functionDeployCount: 0,
      } : {}),
      reconcileRequired: false,
      automaticRetryPerformed: false,
      productionTouched: false,
    });
    const secretResultAuthority = evaluateOperationalState({
      action: "apply",
      checkpoint: "after-mutation",
      context,
      release,
      bundle,
      ci: currentCi,
      approval: null,
      now: secretResultRecordedAt,
      mutation: "secrets-set",
      mutationOutcome: "success",
      inventories: after,
      functionInventory: afterFunction,
      effectPayload: secretResultFields,
    });
    verifiedSecretResult = appendAuthorizedReceipt(
      secretResultAuthority,
      "append-verified-mutation-result",
      context.receiptDirectory,
      context.chain,
      secretResultFields,
    );
  }

  if (plan.mutationScope === "secrets-set") {
    if (!secretsOnlySuccessor) {
      return Object.freeze({
        ok: true,
        mode: "apply",
        status: "resume-stage-verified",
        mutationScope: "secrets-set",
        nextRequiredAction: "create a fresh resume plan for function-deploy",
        heldBundleReused: true,
        hostedMutationCount: 1,
        productionTouched: false,
      });
    }
    const cause = verifiedSecretResult?.receipt ?? context.chain.at(-1);
    if (
      cause?.kind !== "mutation-result"
      || cause.mutation !== "secrets-set"
      || cause.status !== "verified"
    ) refuse("secrets-only apply completion cause differs");
    let completionSandwich = null;
    try {
      completionSandwich = await postflightSecretsOnlySuccessorSandwich(
        context.dependencies,
        release,
        context.source,
        bundle,
        postSecretFunctionBaselineRows,
      );
      currentCi = inspectReadyOperationSourceCi(context, input, common, release);
    } catch {
      completionSandwich = null;
    }
    if (
      completionSandwich === null
      || !sourceCiMatchesPlan(currentCi, plan)
    ) refuse("secrets-only completion requires fresh D0/proof/D1 and unchanged CI");
    const completionFields = completeSecretsOnlySuccessorReceiptFields({
      release,
      source: context.source,
      provenance: context.provenance,
      ci: currentCi,
      bundle,
      sandwich: completionSandwich,
      cause,
      now: common.now,
      chain: context.chain,
    });
    const completionAuthority = evaluateOperationalState({
      action: "complete",
      checkpoint: "before-completion",
      context,
      release,
      bundle,
      ci: currentCi,
      approval: null,
      now: completionFields.recordedAt,
      inventories: completionSandwich.inventories,
      functionInventory: completionSandwich.functionInventory,
      postflight: completionSandwich,
      effectPayload: completionFields,
    });
    const completed = appendAuthorizedReceipt(
      completionAuthority,
      "append-release-complete",
      context.receiptDirectory,
      context.chain,
      completionFields,
    );
    return Object.freeze({
      ok: true,
      mode: "apply",
      status: "verified",
      mutationScope: "secrets-set",
      releaseReceiptFile: completed.file,
      releaseReceiptSha256: completed.receipt.receiptSha256,
      hostedMutationCount: 1,
      functionDeployCount: 0,
      productionTouched: false,
    });
  }

  assertPlanCurrent(
    plan,
    bundle,
    release,
    context.source,
    context.provenance,
    input.approval,
    exactNow(common.now),
  );
  currentCi = inspectReadyOperationSourceCi(context, input, common, release);
  if (
    currentCi.runApiSha256 !== plan.sourceCiRunApiSha256
    || currentCi.jobsApiSha256 !== plan.sourceCiJobsApiSha256
    || currentCi.branchApiSha256 !== plan.sourceCiBranchApiSha256
  ) refuse("live source CI or release branch changed before deploy");
  const beforeDeployInventories = fetchSecretInventories(context.dependencies, "recovery");
  const beforeDeployFunction = fetchFunctionInventory(context.dependencies);
  if (
    !inventoryMatchesInstall(
      bundle.preinstallInventories.main,
      beforeDeployInventories.main,
      bundle.attestation.expectedSecretDigests,
      bundle.attestation.secretNames,
    )
    || !inventoryIsUnchanged(
      bundle.preinstallInventories.finance,
      beforeDeployInventories.finance,
    )
  ) refuse("exact installed bundle secrets drifted before function deploy");
  if (!functionInventoryMatchesPostSecretBaseline(
    beforeDeployFunction,
    postSecretFunctionBaselineRows,
  )) {
    refuse("hosted function inventory drifted before the approved deploy intent");
  }
  assertPlanCurrent(
    plan,
    bundle,
    release,
    context.source,
    context.provenance,
    input.approval,
    exactNow(common.now),
  );
  if (!mutationInputIsUnchanged(bundle, release, "function-deploy")) {
    refuse("deploy workdir changed before mutation intent");
  }
  const deployIntentRecordedAt = nextReceiptTimestamp(
    context.chain,
    common.now,
  );
  const deployIntentFields = Object.freeze({
    kind: "mutation-intent",
    mutation: "function-deploy",
    status: "pending",
    environment: "staging",
    recordedAt: deployIntentRecordedAt,
    planReceiptSha256: plan.receiptSha256,
    beforeMainInventorySha256: beforeDeployInventories.mainInventorySha256,
    beforeFinanceInventorySha256: beforeDeployInventories.financeInventorySha256,
    beforeFunctionInventorySha256: beforeDeployFunction.sha256,
    sourceDeploymentSha256: release.manifest.deploymentClosureSetSha256,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
  const deployIntentAuthority = evaluateOperationalState({
    action: "apply",
    checkpoint: "before-intent",
    context,
    release,
    bundle,
    ci: currentCi,
    approval: input.approval,
    now: deployIntentRecordedAt,
    mutation: "function-deploy",
    inventories: beforeDeployInventories,
    functionInventory: beforeDeployFunction,
    effectPayload: deployIntentFields,
  });
  const deployIntent = appendAuthorizedReceipt(
    deployIntentAuthority,
    "append-mutation-intent",
    context.receiptDirectory,
    context.chain,
    deployIntentFields,
  );
  if (!mutationInputIsUnchanged(bundle, release, "function-deploy")) {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: beforeDeployInventories,
      functionInventory: beforeDeployFunction,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`deploy workdir changed after intent; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  let immediateDeployInventories;
  let immediateDeployFunction;
  try {
    currentCi = inspectReadyOperationSourceCi(context, input, common, release);
    immediateDeployInventories = fetchSecretInventories(
      context.dependencies,
      "recovery",
    );
    immediateDeployFunction = fetchFunctionInventory(context.dependencies);
  } catch {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: beforeDeployInventories,
      functionInventory: beforeDeployFunction,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy pre-mutation authority is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  if (
    !sourceCiMatchesPlan(currentCi, plan)
    || immediateDeployInventories.mainInventorySha256
      !== beforeDeployInventories.mainInventorySha256
    || immediateDeployInventories.financeInventorySha256
      !== beforeDeployInventories.financeInventorySha256
    || immediateDeployFunction.sha256 !== beforeDeployFunction.sha256
    || !inventoryMatchesInstall(
      bundle.preinstallInventories.main,
      immediateDeployInventories.main,
      bundle.attestation.expectedSecretDigests,
      bundle.attestation.secretNames,
    )
    || !inventoryIsUnchanged(
      bundle.preinstallInventories.finance,
      immediateDeployInventories.finance,
    )
    || !functionInventoryMatchesPostSecretBaseline(
      immediateDeployFunction,
      postSecretFunctionBaselineRows,
    )
    || !mutationInputIsUnchanged(bundle, release, "function-deploy")
  ) {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory: immediateDeployFunction,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy pre-mutation evidence changed; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  assertPlanCurrent(
    plan,
    bundle,
    release,
    context.source,
    context.provenance,
    input.approval,
    exactNow(common.now),
  );
  const deployCommand = mutationCommandPayload(
    bundle,
    release,
    "function-deploy",
  );
  const deployMutationAuthority = evaluateOperationalState({
    action: "apply",
    checkpoint: "before-mutation",
    context,
    release,
    bundle,
    ci: currentCi,
    approval: input.approval,
    now: exactNow(common.now),
    mutation: "function-deploy",
    inventories: immediateDeployInventories,
    functionInventory: immediateDeployFunction,
    effectPayload: deployCommand,
  });
  const deployResult = invokeAuthorizedMutation(
    deployMutationAuthority,
    "function-deploy",
    context.dependencies,
    deploymentArguments(bundle),
    bundle,
    release,
    context.chain,
    context.receiptDirectory,
    context.stateDirectory,
    context.receiptBinding.bindingSha256,
    Object.freeze({
      context,
      plan,
      approval: input.approval,
      source: context.source,
      provenance: context.provenance,
      ci: currentCi,
      inventories: immediateDeployInventories,
      functionInventory: immediateDeployFunction,
      now: common.now,
    }),
  );
  if (
    !successful(deployResult)
    || !mutationInputIsUnchanged(bundle, release, "function-deploy")
  ) {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory: immediateDeployFunction,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy outcome is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  let functionInventory;
  let sandwich;
  try {
    functionInventory = fetchFunctionInventory(context.dependencies);
    sandwich = functionInventoryMatchesSoleAddition(
      functionInventory,
      postSecretFunctionBaselineRows,
    )
      ? await postflightSandwich(
        context.dependencies,
        release,
        context.source,
        bundle,
        postSecretFunctionBaselineRows,
      )
      : null;
  } catch {
    sandwich = null;
  }
  if (!sandwich) {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory: functionInventory ?? immediateDeployFunction,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy could not be postflight-verified; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  functionInventory = sandwich.functionInventory;
  try {
    currentCi = inspectReadyOperationSourceCi(context, input, common, release);
  } catch {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy source authority changed after mutation; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  if (
    currentCi.runApiSha256 !== plan.sourceCiRunApiSha256
    || currentCi.jobsApiSha256 !== plan.sourceCiJobsApiSha256
    || currentCi.branchApiSha256 !== plan.sourceCiBranchApiSha256
    || !mutationInputIsUnchanged(bundle, release, "function-deploy")
  ) {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy closure changed after mutation; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  let finalInventories;
  try {
    finalInventories = fetchSecretInventories(context.dependencies, "recovery");
  } catch {
    const authority = unknownOutcomeAuthority({
      context, release, bundle, mutation: "function-deploy",
      inventories: immediateDeployInventories,
      functionInventory,
    });
    const unknown = appendUnknownResult(authority, context, "function-deploy", deployIntent);
    refuse(`function deploy final inventory is unknown; reconcile receipt ${unknown.receipt.receiptSha256}`);
  }
  const deployResultRecordedAt = nextReceiptTimestamp(
    context.chain,
    common.now,
    Date.parse(sandwich.d1.database_clock) + 1,
  );
  const deployResultFields = Object.freeze({
    kind: "mutation-result",
    mutation: "function-deploy",
    status: "verified",
    environment: "staging",
    recordedAt: deployResultRecordedAt,
    intentReceiptSha256: deployIntent.receipt.receiptSha256,
    functionInventorySha256: functionInventory.sha256,
    hostedProofSha256: sandwich.proof.proofSha256,
    hostedD0ResponseSha256: sandwich.d0.response_sha256,
    reconcileRequired: false,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
  const deployResultAuthority = evaluateOperationalState({
    action: "apply",
    checkpoint: "after-mutation",
    context,
    release,
    bundle,
    ci: currentCi,
    approval: null,
    now: deployResultRecordedAt,
    mutation: "function-deploy",
    mutationOutcome: "success",
    inventories: finalInventories,
    functionInventory,
    postflight: sandwich,
    effectPayload: deployResultFields,
  });
  const deployResultReceipt = appendAuthorizedReceipt(
    deployResultAuthority,
    "append-verified-mutation-result",
    context.receiptDirectory,
    context.chain,
    deployResultFields,
  );
  const completion = await collectCompletionAuthority({
    context,
    input,
    common,
    release,
    bundle,
    baselineRows: postSecretFunctionBaselineRows,
    plan,
    cause: deployResultReceipt.receipt,
  });
  const completionSandwich = completion.sandwich;
  const completionFields = completion.completionFields;
  currentCi = completion.ci;
  functionInventory = completionSandwich.functionInventory;
  const completionAuthority = evaluateOperationalState({
    action: "complete",
    checkpoint: "before-completion",
    context,
    release,
    bundle,
    ci: currentCi,
    approval: null,
    now: completionFields.recordedAt,
    inventories: finalInventories,
    functionInventory,
    postflight: completionSandwich,
    effectPayload: completionFields,
  });
  const completed = appendAuthorizedReceipt(
    completionAuthority,
    "append-release-complete",
    context.receiptDirectory,
    context.chain,
    completionFields,
  );
  return Object.freeze({
    ok: true,
    mode: "apply",
    status: "verified",
    releaseReceiptFile: completed.file,
    releaseReceiptSha256: completed.receipt.receiptSha256,
    ownerPrivateDescriptorFile: bundle.operatorDescriptorFile,
    ownerPrivateDescriptorFileSha256: bundle.attestation.operatorDescriptorFileSha256,
    hostedMutationCount: plan.mutationScope === "function-deploy" ? 1 : 2,
    productionTouched: false,
  });
}

function secretsOnlySuccessorFunctionRowsForCause(bundle, cause) {
  if (
    cause?.mutation !== "secrets-set"
    || !["unchanged", "exact-all-existing-plus-one"]
      .includes(cause.functionVersionTransitionDisposition)
  ) refuse("secrets-only successor completion function cause differs");
  const rows = scopedFunctionVersionTransitionRows(
    bundle.preinstallInventories.functions,
    cause.functionVersionTransitionDisposition,
    bundle.attestation.predecessorAdoption,
  );
  const inventory = normalizeFunctionInventoryRows(rows);
  const observedSha256 = cause.kind === "mutation-result"
    ? cause.afterFunctionInventorySha256
    : cause.functionInventorySha256;
  if (inventory.sha256 !== observedSha256) {
    refuse("secrets-only successor completion function inventory differs");
  }
  return inventory.rows;
}

async function finalizeSecretsOnlySuccessorState({
  context,
  input,
  common,
  release,
  bundle,
  plan,
  cause,
  mode,
}) {
  const functionRows = secretsOnlySuccessorFunctionRowsForCause(bundle, cause);
  const sandwich = await postflightSecretsOnlySuccessorSandwich(
    context.dependencies,
    release,
    context.source,
    bundle,
    functionRows,
  ).catch(() => null);
  if (sandwich === null) {
    refuse("fresh secrets-only successor D0/proof/D1 completion failed");
  }
  const currentCi = inspectReadyOperationSourceCi(
    context,
    input,
    common,
    release,
  );
  if (!sourceCiMatchesPlan(currentCi, plan)) {
    refuse("secrets-only successor completion source CI changed");
  }
  const completionFields = completeSecretsOnlySuccessorReceiptFields({
    release,
    source: context.source,
    provenance: context.provenance,
    ci: currentCi,
    bundle,
    sandwich,
    cause,
    now: common.now,
    chain: context.chain,
  });
  const completionAuthority = evaluateOperationalState({
    action: "complete",
    checkpoint: "before-completion",
    context,
    release,
    bundle,
    ci: currentCi,
    approval: null,
    now: completionFields.recordedAt,
    inventories: sandwich.inventories,
    functionInventory: sandwich.functionInventory,
    postflight: sandwich,
    effectPayload: completionFields,
  });
  const completed = appendAuthorizedReceipt(
    completionAuthority,
    "append-release-complete",
    context.receiptDirectory,
    context.chain,
    completionFields,
  );
  return Object.freeze({
    ok: true,
    mode,
    mutation: "secrets-set",
    outcome: "state_satisfied",
    releaseReceiptFile: completed.file,
    releaseReceiptSha256: completed.receipt.receiptSha256,
    hostedMutationCount: 0,
    cumulativeHostedMutationCount: 1,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
}

async function operateSecretsOnlySuccessorReconcile({
  context,
  input,
  common,
  release,
  bundle,
  plan,
}) {
  if (
    plan.schemaVersion !== 3
    || plan.mutationScope !== "secrets-set"
    || !isTerminalDivergedPredecessorAdoption(plan.predecessorAdoption)
  ) refuse("secrets-only successor reconciliation plan differs");
  const unresolved = unresolvedReceipt(context.chain);
  const terminal = context.chain.at(-1);
  const finalizeCause = !unresolved && (
    (terminal?.kind === "mutation-result"
      && terminal.mutation === "secrets-set"
      && terminal.status === "verified")
    || (terminal?.kind === "reconciliation"
      && terminal.mutation === "secrets-set"
      && terminal.outcome === "state_satisfied")
  ) ? terminal : null;
  if (finalizeCause !== null) {
    return finalizeSecretsOnlySuccessorState({
      context,
      input,
      common,
      release,
      bundle,
      plan,
      cause: finalizeCause,
      mode: "reconcile",
    });
  }
  if (unresolved === null || unresolved.mutation !== "secrets-set") {
    refuse("secrets-only successor has no reconcilable secret intent");
  }
  const inventories0 = fetchSecretInventories(context.dependencies, "recovery");
  const functions0 = fetchFunctionInventory(context.dependencies);
  const inventories1 = fetchSecretInventories(context.dependencies, "recovery");
  const functions1 = fetchFunctionInventory(context.dependencies);
  const stableReadRounds = inventories0.mainInventorySha256
      === inventories1.mainInventorySha256
    && inventories0.financeInventorySha256
      === inventories1.financeInventorySha256
    && functions0.sha256 === functions1.sha256
    && canonicalJson(functions0.rows) === canonicalJson(functions1.rows);
  const installed = inventories => inventoryMatchesSuccessorInstall(
    bundle.preinstallInventories.main,
    inventories.main,
    bundle.attestation.mutationSecretDigests,
    bundle.attestation.mutationSecretNames,
  ) && inventoryIsUnchanged(
    bundle.preinstallInventories.finance,
    inventories.finance,
  );
  const preinstall = inventories => inventoryMatchesMetadataOnlyDrift(
    bundle.preinstallInventories.main,
    inventories.main,
    SUCCESSOR_METADATA_ONLY_SECRET_NAMES,
  ) && inventoryIsUnchanged(
    bundle.preinstallInventories.finance,
    inventories.finance,
  );
  const stageRows = scopedFunctionVersionTransitionRows(
    bundle.preinstallInventories.functions,
    plan.functionVersionTransition.currentStageDisposition,
    plan.predecessorAdoption,
  );
  const functionDisposition = stableReadRounds
    ? classifyAllExistingFunctionVersionTransition({
      beforeRows: stageRows,
      afterRows: functions1.rows,
    })
    : "diverged";
  const installedObserved = stableReadRounds
    && installed(inventories0)
    && installed(inventories1)
    && ["unchanged", "exact-all-existing-plus-one"]
      .includes(functionDisposition);
  const baselineObserved = stableReadRounds
    && preinstall(inventories0)
    && preinstall(inventories1)
    && functionDisposition === "unchanged";
  const outcome = installedObserved
    ? "state_satisfied"
    : (baselineObserved ? "state_unsatisfied" : "diverged");
  let metadataDelta = null;
  try {
    metadataDelta = metadataOnlyInventoryDelta(
      inventoryWithoutNames(
        bundle.preinstallInventories.main,
        bundle.attestation.mutationSecretNames,
      ),
      inventoryWithoutNames(
        inventories1.main,
        bundle.attestation.mutationSecretNames,
      ),
    );
  } catch {
    metadataDelta = null;
  }
  if (outcome !== "diverged" && metadataDelta === null) {
    refuse("secrets-only successor reconciliation metadata evidence differs");
  }
  const recordedAt = nextReceiptTimestamp(context.chain, common.now);
  const reconciliationFields = Object.freeze({
    kind: "reconciliation",
    mutation: "secrets-set",
    outcome,
    environment: "staging",
    recordedAt,
    unresolvedReceiptSha256: unresolved.receiptSha256,
    mainInventorySha256: inventories1.mainInventorySha256,
    financeInventorySha256: inventories1.financeInventorySha256,
    functionInventorySha256: functions1.sha256,
    hostedProofSha256: null,
    hostedD0ResponseSha256: null,
    observation: outcome === "state_satisfied"
      ? "installed_observed"
      : (outcome === "state_unsatisfied" ? "baseline_observed" : "diverged"),
    state: outcome,
    causalAttribution: false,
    functionVersionTransitionDisposition: outcome === "diverged"
      ? "diverged" : functionDisposition,
    inventoryReadRounds: 2,
    stableObservation: stableReadRounds,
    predecessorAdoptionSha256: sha256(canonicalJson(plan.predecessorAdoption)),
    semanticMainInventorySha256: semanticSecretInventorySha256(inventories1.main),
    metadataOnlyDeltaNames: outcome === "diverged"
      ? null : metadataDelta?.names ?? null,
    metadataOnlyDeltaSha256: outcome === "diverged"
      ? null : metadataDelta?.sha256 ?? null,
    mutationSecretNames: bundle.attestation.mutationSecretNames,
    mutationSecretNameSetSha256:
      plan.mutationSecretNameSetSha256,
    mutationSecretDigestSetSha256:
      plan.mutationSecretDigestSetSha256,
    predecessorReceiptChainSha256: plan.predecessorReceiptChainSha256,
    functionAllExistingPlusOneSha256: plan.functionAllExistingPlusOneSha256,
    hostedMutationCount: 0,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
  const observationEvidence = Object.freeze({
    inventoryReadRounds: 2,
    stableObservation: stableReadRounds,
    firstMainInventorySha256: inventories0.mainInventorySha256,
    firstFinanceInventorySha256: inventories0.financeInventorySha256,
    firstFunctionInventorySha256: functions0.sha256,
    secondMainInventorySha256: inventories1.mainInventorySha256,
    secondFinanceInventorySha256: inventories1.financeInventorySha256,
    secondFunctionInventorySha256: functions1.sha256,
  });
  const authority = evaluateOperationalState({
    action: "reconcile",
    checkpoint: "after-mutation",
    context,
    release,
    bundle,
    approval: null,
    now: recordedAt,
    mutation: "secrets-set",
    mutationOutcome: "none",
    inventories: inventories1,
    functionInventory: functions1,
    mutationInputEvidence: null,
    observationEvidence,
    postflight: null,
    effectPayload: reconciliationFields,
  });
  if (authority.reconciliationOutcome !== outcome) {
    refuse("secrets-only successor reconciliation authority differs");
  }
  const reconciled = appendAuthorizedReceipt(
    authority,
    "append-reconciliation",
    context.receiptDirectory,
    context.chain,
    reconciliationFields,
  );
  if (outcome === "state_satisfied") {
    return finalizeSecretsOnlySuccessorState({
      context,
      input,
      common,
      release,
      bundle,
      plan,
      cause: reconciled.receipt,
      mode: "reconcile",
    });
  }
  return Object.freeze({
    ok: false,
    mode: "reconcile",
    mutation: "secrets-set",
    outcome,
    terminal: true,
    reconciliationReceiptFile: reconciled.file,
    reconciliationReceiptSha256: reconciled.receipt.receiptSha256,
    releaseReceiptFile: null,
    releaseReceiptSha256: null,
    finalizationRequired: false,
    hostedMutationCount: 0,
    cumulativeHostedMutationCount: 1,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
}

async function operateReconcile(input, common, release) {
  const context = initializeReadyOperation(input, common, release, false);
  if (context.chain.some(receipt => receipt.kind === "release-complete")) {
    refuse("completed release has no reconciliation work");
  }
  assertRuntimeReadChainEligibility("reconcile", context.chain);
  const plan = latestPlan(context.chain);
  assertCurrentReleaseSecretsOnlyPlan(plan);
  const bundle = readBundle(
    context.stateDirectory,
    release,
    context.source,
    {
      expectedAttestationSha256: plan.bundleAttestationSha256,
      expectedPredecessorAdoption: plan.predecessorAdoption,
      authorizeRuntimeRead: attestation => {
        assertCurrentReleaseSecretsOnlyBundle(attestation, plan);
        return assertPlanEnvelopeBeforePlaintext(
          plan,
          attestation,
          release,
          context.source,
          context.provenance,
          context.ci,
          context.accessBoundary,
          context.stateDirectory,
        );
      },
    },
  );
  const chainPostSecretFunctionBaseline = postSecretFunctionBaselineFromChain(
    bundle.preinstallInventories.functions,
    context.chain,
    plan,
  );
  if (
    plan.bundleAttestationSha256 !== bundle.attestation.attestationSha256
    || plan.sourceCommitSha !== context.source.commit
    || plan.sourceTreeSha !== context.source.tree
    || plan.changedPathSetSha256 !== context.source.changedPathSetSha256
    || plan.workflowBlobSha !== context.source.workflowBlobSha
    || plan.sourceCiRunId !== context.ci.runId
    || plan.sourceCiRunApiSha256 !== context.ci.runApiSha256
    || plan.sourceCiJobsApiSha256 !== context.ci.jobsApiSha256
    || plan.sourceCiBranchApiSha256 !== context.ci.branchApiSha256
    || plan.sourceProvenanceFileSha256 !== context.provenance.fileSha256
    || plan.sourceProvenanceDescriptorSha256 !== context.provenance.descriptorSha256
    || plan.releaseManifestSha256 !== release.manifestSha256
    || plan.sourceDeploymentSha256 !== release.manifest.deploymentClosureSetSha256
    || plan.productionBoundarySha256 !== context.accessBoundary.productionBoundarySha256
    || plan.targetDescriptorSha256 !== context.accessBoundary.targetDescriptorSha256
    || plan.snapshot.catalogSha256 !== bundle.attestation.catalogSha256
    || plan.snapshot.descriptorSha256 !== bundle.attestation.descriptorSha256
    || plan.snapshot.stateSha256 !== bundle.attestation.stateSha256
    || plan.snapshot.gateInventorySha256 !== bundle.attestation.gateInventorySha256
    || plan.snapshot.privacyInventorySha256 !== bundle.attestation.privacyInventorySha256
    || plan.snapshot.checkedCount !== bundle.attestation.checkedCount
    || !sourceCiMatchesPlan(context.ci, plan)
  ) refuse("reconciliation source, CI, plan or owner boundary differs");
  if (isTerminalDivergedPredecessorAdoption(plan.predecessorAdoption)) {
    return operateSecretsOnlySuccessorReconcile({
      context,
      input,
      common,
      release,
      bundle,
      plan,
    });
  }
  const unresolved = unresolvedReceipt(context.chain);
  const terminal = context.chain.at(-1);
  const finalizeCause = !unresolved && (
    (terminal?.kind === "mutation-result"
      && terminal.mutation === "function-deploy"
      && terminal.status === "verified")
    || (terminal?.kind === "reconciliation"
      && terminal.mutation === "function-deploy"
      && terminal.outcome === "applied")
  ) ? terminal : null;
  if (finalizeCause) {
    const inventories = fetchSecretInventories(context.dependencies, "recovery");
    const functionInventory = fetchFunctionInventory(context.dependencies);
    if (
      !inventoryMatchesInstall(
        bundle.preinstallInventories.main,
        inventories.main,
        bundle.attestation.expectedSecretDigests,
        bundle.attestation.secretNames,
      )
      || !inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance)
      || !functionInventoryMatchesSoleAddition(
        functionInventory,
        chainPostSecretFunctionBaseline.rows,
      )
    ) refuse("read-only completion reconciliation found hosted drift");
    const completion = await collectCompletionAuthority({
      context,
      input,
      common,
      release,
      bundle,
      baselineRows: chainPostSecretFunctionBaseline.rows,
      plan,
      cause: finalizeCause,
    });
    const sandwich = completion.sandwich;
    const currentCi = completion.ci;
    const completionFields = completion.completionFields;
    const completionAuthority = evaluateOperationalState({
      action: "complete",
      checkpoint: "before-completion",
      context,
      release,
      bundle,
      ci: currentCi,
      approval: null,
      now: completionFields.recordedAt,
      inventories,
      functionInventory: sandwich.functionInventory,
      postflight: sandwich,
      effectPayload: completionFields,
    });
    const completed = appendAuthorizedReceipt(
      completionAuthority,
      "append-release-complete",
      context.receiptDirectory,
      context.chain,
      completionFields,
    );
    return Object.freeze({
      ok: true,
      mode: "reconcile",
      mutation: "function-deploy",
      outcome: "applied",
      finalizedExistingAppliedState: true,
      reconciliationReceiptFile: null,
      reconciliationReceiptSha256: null,
      releaseReceiptFile: completed.file,
      releaseReceiptSha256: completed.receipt.receiptSha256,
      hostedMutationCount: 0,
      automaticRetryPerformed: false,
      productionTouched: false,
    });
  }
  if (!unresolved) refuse("no unknown or pending mutation requires reconciliation");
  const mutation = unresolved.mutation;
  if (!["secrets-set", "function-deploy"].includes(mutation)) {
    refuse("unresolved mutation kind differs");
  }
  const inventories0 = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory0 = fetchFunctionInventory(context.dependencies);
  let sandwich = null;
  const inventories = fetchSecretInventories(context.dependencies, "recovery");
  let functionInventory = fetchFunctionInventory(context.dependencies);
  const stableReadRounds = inventoryIsUnchanged(inventories0.main, inventories.main)
    && inventoryIsUnchanged(inventories0.finance, inventories.finance)
    && canonicalJson(functionInventory0.rows) === canonicalJson(functionInventory.rows);
  const installed = inventoryMatchesInstall(
    bundle.preinstallInventories.main,
    inventories.main,
    bundle.attestation.expectedSecretDigests,
    bundle.attestation.secretNames,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance);
  const preinstall = inventoryIsUnchanged(
    bundle.preinstallInventories.main,
    inventories.main,
  ) && inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance);
  const secretState = !stableReadRounds
    ? "diverged"
    : (installed
    ? "installed"
    : (preinstall ? "preinstall" : "diverged"));
  const secretStageRows = functionVersionTransitionBaselineRows(
    bundle.preinstallInventories.functions,
    plan.functionVersionTransition.currentStageDisposition,
  );
  const observedSecretFunctionDisposition = stableReadRounds
    ? classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: secretStageRows,
      afterRows: functionInventory.rows,
    })
    : "diverged";
  let functionState = mutation === "secrets-set"
    ? ((secretState === "preinstall"
      ? observedSecretFunctionDisposition === "unchanged"
      : (secretState === "installed"
        && ["unchanged", "exact-all-existing-plus-one"]
          .includes(observedSecretFunctionDisposition)))
      ? "absent" : "diverged")
    : classifyMainFinanceRuntimeRecoveryV2FunctionState({
      preinstallRows: chainPostSecretFunctionBaseline.rows,
      currentRows: functionInventory.rows,
    });
  let intentInventoryMatches = false;
  if (
    mutation === "function-deploy"
    && secretState === "installed"
    && functionState === "exact-sole-addition"
  ) {
    sandwich = await postflightSandwich(
      context.dependencies,
      release,
      context.source,
      bundle,
      chainPostSecretFunctionBaseline.rows,
    ).catch(() => null);
    if (sandwich) functionInventory = sandwich.functionInventory;
  }
  if (
    mutation === "function-deploy"
    && secretState === "installed"
    && functionState === "absent"
  ) {
    const intent = [...context.chain].reverse().find(receipt =>
      receipt.kind === "mutation-intent"
      && receipt.mutation === "function-deploy"
      && receipt.sequence <= unresolved.sequence);
    intentInventoryMatches = Boolean(
      intent
      && intent.beforeMainInventorySha256 === inventories.mainInventorySha256
      && intent.beforeFinanceInventorySha256 === inventories.financeInventorySha256,
    );
  }
  const proposedOutcome = classifyMainFinanceRuntimeRecoveryV2ReconciliationOutcome({
    mutation,
    secretState,
    functionState,
    postflightVerified: sandwich !== null,
    intentInventoryMatches,
  });
  const reconciliationRecordedAt = nextReceiptTimestamp(
    context.chain,
    common.now,
    sandwich === null ? null : Date.parse(sandwich.d1.database_clock) + 1,
  );
  const reconciliationFields = Object.freeze({
    kind: "reconciliation",
    mutation,
    outcome: proposedOutcome,
    environment: "staging",
    recordedAt: reconciliationRecordedAt,
    unresolvedReceiptSha256: unresolved.receiptSha256,
    mainInventorySha256: inventories.mainInventorySha256,
    financeInventorySha256: inventories.financeInventorySha256,
    functionInventorySha256: functionInventory.sha256,
    hostedProofSha256: sandwich?.proof.proofSha256 ?? null,
    hostedD0ResponseSha256: sandwich?.d0.response_sha256 ?? null,
    ...(mutation === "secrets-set" ? {
      observation: proposedOutcome === "state_satisfied"
        ? "installed_observed"
        : (proposedOutcome === "state_unsatisfied" ? "baseline_observed" : "diverged"),
      state: proposedOutcome,
      causalAttribution: false,
      functionVersionTransitionDisposition: [
        "unchanged", "exact-all-existing-plus-one",
      ].includes(observedSecretFunctionDisposition)
        ? observedSecretFunctionDisposition : "diverged",
      inventoryReadRounds: 2,
      stableObservation: stableReadRounds,
      predecessorAdoptionSha256: sha256(canonicalJson(plan.predecessorAdoption)),
    } : {}),
    hostedMutationCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
  const observationEvidence = mutation === "secrets-set"
    ? Object.freeze({
      inventoryReadRounds: 2,
      stableObservation: stableReadRounds,
      firstMainInventorySha256: inventories0.mainInventorySha256,
      firstFinanceInventorySha256: inventories0.financeInventorySha256,
      firstFunctionInventorySha256: functionInventory0.sha256,
      secondMainInventorySha256: inventories.mainInventorySha256,
      secondFinanceInventorySha256: inventories.financeInventorySha256,
      secondFunctionInventorySha256: functionInventory.sha256,
    })
    : null;
  const reconciliationAuthority = evaluateOperationalState({
    action: "reconcile",
    checkpoint: "after-mutation",
    context,
    release,
    bundle,
    approval: null,
    now: reconciliationRecordedAt,
    mutation,
    mutationOutcome: "none",
    inventories,
    functionInventory,
    mutationInputEvidence: null,
    observationEvidence,
    postflight: sandwich,
    effectPayload: reconciliationFields,
  });
  const outcome = reconciliationAuthority.reconciliationOutcome;
  if (![
    "applied", "not_applied", "state_satisfied", "state_unsatisfied", "diverged",
  ].includes(outcome)) {
    refuse("declarative reconciliation outcome differs");
  }
  if (outcome !== proposedOutcome) {
    refuse("declarative reconciliation candidate differs");
  }
  const reconciled = appendAuthorizedReceipt(
    reconciliationAuthority,
    "append-reconciliation",
    context.receiptDirectory,
    context.chain,
    reconciliationFields,
  );
  let completed = null;
  if (mutation === "function-deploy" && outcome === "applied") {
    let completion = null;
    try {
      completion = await collectCompletionAuthority({
        context,
        input,
        common,
        release,
        bundle,
        baselineRows: chainPostSecretFunctionBaseline.rows,
        plan,
        cause: reconciled.receipt,
      });
    } catch {
      completion = null;
    }
    if (completion !== null) {
      const completionSandwich = completion.sandwich;
      const finalCi = completion.ci;
      const completionFields = completion.completionFields;
      const completionAuthority = evaluateOperationalState({
        action: "complete",
        checkpoint: "before-completion",
        context,
        release,
        bundle,
        ci: finalCi,
        approval: null,
        now: completionFields.recordedAt,
        inventories,
        functionInventory: completionSandwich.functionInventory,
        postflight: completionSandwich,
        effectPayload: completionFields,
      });
      completed = appendAuthorizedReceipt(
        completionAuthority,
        "append-release-complete",
        context.receiptDirectory,
        context.chain,
        completionFields,
      );
    }
  }
  return Object.freeze({
    ok: outcome !== "diverged",
    mode: "reconcile",
    mutation,
    outcome,
    reconciliationReceiptFile: reconciled.file,
    reconciliationReceiptSha256: reconciled.receipt.receiptSha256,
    releaseReceiptFile: completed?.file ?? null,
    releaseReceiptSha256: completed?.receipt.receiptSha256 ?? null,
    finalizationRequired: mutation === "function-deploy"
      && outcome === "applied" && completed === null,
    hostedMutationCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  });
}

async function operateVerify(input, common, release) {
  const context = initializeReadyOperation(input, common, release, false);
  const complete = context.chain.at(-1);
  if (complete?.kind !== "release-complete") {
    refuse("authoritative verification requires the terminal release-complete receipt");
  }
  assertRuntimeReadChainEligibility("verify", context.chain);
  const plan = latestPlan(context.chain);
  assertCurrentReleaseSecretsOnlyPlan(plan);
  const bundle = readBundle(
    context.stateDirectory,
    release,
    context.source,
    {
      expectedAttestationSha256: plan.bundleAttestationSha256,
      expectedPredecessorAdoption: plan.predecessorAdoption,
      authorizeRuntimeRead: attestation => {
        assertCurrentReleaseSecretsOnlyBundle(attestation, plan);
        return assertPlanEnvelopeBeforePlaintext(
          plan,
          attestation,
          release,
          context.source,
          context.provenance,
          context.ci,
          context.accessBoundary,
          context.stateDirectory,
        );
      },
    },
  );
  const postSecretFunctionBaseline = postSecretFunctionBaselineFromChain(
    bundle.preinstallInventories.functions,
    context.chain,
    plan,
  );
  const secretsOnlySuccessor = isTerminalDivergedPredecessorAdoption(
    plan.predecessorAdoption,
  );
  if (
    plan.bundleAttestationSha256 !== bundle.attestation.attestationSha256
    || complete.sourceCommitSha !== context.source.commit
    || complete.sourceTreeSha !== context.source.tree
    || complete.sourceParentSha !== context.source.parent
    || complete.changedPathSetSha256 !== context.source.changedPathSetSha256
    || complete.workflowBlobSha !== context.source.workflowBlobSha
    || complete.releaseManifestSha256 !== release.manifestSha256
    || complete.deploymentClosureSha256
      !== release.manifest.deploymentClosureSetSha256
    || complete.sourceArchiveSha256 !== bundle.attestation.sourceArchiveSha256
    || complete.supabaseArchiveSha256 !== context.source.supabaseArchiveSha256
    || complete.operatorDescriptorFileSha256
      !== bundle.attestation.operatorDescriptorFileSha256
    || complete.productionBoundarySha256
      !== context.accessBoundary.productionBoundarySha256
    || complete.targetDescriptorSha256
      !== context.accessBoundary.targetDescriptorSha256
    || plan.sourceProvenanceFileSha256 !== context.provenance.fileSha256
    || plan.sourceProvenanceDescriptorSha256 !== context.provenance.descriptorSha256
    || complete.sourceProvenanceFileSha256 !== context.provenance.fileSha256
    || complete.sourceProvenanceDescriptorSha256 !== context.provenance.descriptorSha256
    || !sourceCiMatchesPlan(context.ci, plan)
    || complete.sourceCiRunApiSha256 !== context.ci.runApiSha256
    || complete.sourceCiJobsApiSha256 !== context.ci.jobsApiSha256
    || complete.sourceCiBranchApiSha256 !== context.ci.branchApiSha256
  ) refuse("terminal completion is not bound to the current frozen source and bundle");
  const inventories = fetchSecretInventories(context.dependencies, "recovery");
  const functionInventory = fetchFunctionInventory(context.dependencies);
  const completionCause = secretsOnlySuccessor
    ? context.chain.find(receipt =>
      receipt.receiptSha256 === complete.completionCauseReceiptSha256) ?? null
    : null;
  const successorFunctionRows = secretsOnlySuccessor
    ? secretsOnlySuccessorFunctionRowsForCause(bundle, completionCause)
    : null;
  let successorMetadataDelta = null;
  if (secretsOnlySuccessor) {
    successorMetadataDelta = metadataOnlyInventoryDelta(
      inventoryWithoutNames(
        bundle.preinstallInventories.main,
        bundle.attestation.mutationSecretNames,
      ),
      inventoryWithoutNames(
        inventories.main,
        bundle.attestation.mutationSecretNames,
      ),
    );
  }
  if (
    !(secretsOnlySuccessor
      ? inventoryMatchesSuccessorInstall(
        bundle.preinstallInventories.main,
        inventories.main,
        bundle.attestation.mutationSecretDigests,
        bundle.attestation.mutationSecretNames,
      )
      : inventoryMatchesInstall(
        bundle.preinstallInventories.main,
        inventories.main,
        bundle.attestation.expectedSecretDigests,
        bundle.attestation.secretNames,
      ))
    || !inventoryIsUnchanged(bundle.preinstallInventories.finance, inventories.finance)
    || !(secretsOnlySuccessor
      ? functionInventoryMatchesPostSecretBaseline(
        functionInventory,
        successorFunctionRows,
      )
      : functionInventoryMatchesSoleAddition(
        functionInventory,
        postSecretFunctionBaseline.rows,
      ))
    || complete.d1MainInventorySha256 !== inventories.mainInventorySha256
    || complete.d1FinanceInventorySha256 !== inventories.financeInventorySha256
    || complete.functionInventorySha256 !== functionInventory.sha256
    || complete.d1FunctionInventorySha256 !== functionInventory.sha256
    || (secretsOnlySuccessor && (
      complete.schemaVersion !== 3
      || semanticSecretInventorySha256(inventories.main)
        !== complete.semanticMainInventorySha256
      || canonicalJson(successorMetadataDelta.names)
        !== canonicalJson(complete.metadataOnlyDeltaNames)
      || successorMetadataDelta.sha256 !== complete.metadataOnlyDeltaSha256
      || canonicalJson(complete.mutationSecretNames)
        !== canonicalJson(bundle.attestation.mutationSecretNames)
      || complete.mutationSecretNameSetSha256
        !== plan.mutationSecretNameSetSha256
      || complete.mutationSecretDigestSetSha256
        !== plan.mutationSecretDigestSetSha256
      || complete.predecessorReceiptChainSha256
        !== plan.predecessorReceiptChainSha256
      || complete.functionAllExistingPlusOneSha256
        !== plan.functionAllExistingPlusOneSha256
      || complete.hostedMutationCount !== 1
      || complete.functionDeployCount !== 0
    ))
  ) refuse("terminal completion hosted inventory has drifted");
  const sandwich = await (secretsOnlySuccessor
    ? postflightSecretsOnlySuccessorSandwich(
      context.dependencies,
      release,
      context.source,
      bundle,
      successorFunctionRows,
    )
    : postflightSandwich(
      context.dependencies,
      release,
      context.source,
      bundle,
      postSecretFunctionBaseline.rows,
    )).catch(() => null);
  if (!sandwich) refuse("fresh authoritative D0/proof/D1 verification failed");
  const finalCi = inspectReadyOperationSourceCi(context, input, common, release);
  if (
    !sourceCiMatchesPlan(finalCi, plan)
    || sandwich.d1MainInventorySha256 !== complete.d1MainInventorySha256
    || sandwich.d1FinanceInventorySha256 !== complete.d1FinanceInventorySha256
    || sandwich.d1FunctionInventorySha256 !== complete.d1FunctionInventorySha256
  ) refuse("authoritative completion evidence changed during verification");
  const verificationAt = nextReceiptTimestamp(
    context.chain,
    common.now,
    Date.parse(sandwich.d1.database_clock) + 1,
  );
  const verificationAuthority = evaluateOperationalState({
    action: "verify",
    checkpoint: "request",
    context,
    release,
    bundle,
    ci: finalCi,
    approval: null,
    now: verificationAt,
    inventories,
    functionInventory: sandwich.functionInventory,
    postflight: sandwich,
  });
  requireDeclarativeEffect(verificationAuthority, "none");
  return Object.freeze({
    ok: true,
    mode: "verify",
    status: "authoritative-live-verified",
    authoritativeReceiptSha256: complete.receiptSha256,
    freshHostedProofSha256: sandwich.proof.proofSha256,
    sourceCommitSha: context.source.commit,
    sourceTreeSha: context.source.tree,
    sourceCiRunId: finalCi.runId,
    hostedMutationCount: 0,
    productionTouched: false,
  });
}

async function operateMainFinanceRuntimeRecoveryV2() {
  if (import.meta.main !== true) {
    refuse("effectful operator is callable only from the direct CLI entrypoint");
  }
  const input = parseArguments(process.argv.slice(2));
  if (input.action === "help") {
    return Object.freeze({
      ok: true,
      mode: "help",
      actions: Object.freeze(["measure", "plan", "apply", "reconcile", "verify"]),
      exactTarget: MAIN_REF,
      productionDenied: true,
    });
  }
  const common = Object.freeze({
    environment: process.env,
    runGit: defaultRunProcess,
    runCli: defaultRunProcess,
    runGh: defaultRunProcess,
    fetchImpl: globalThis.fetch,
    now: () => new Date(),
    randomBytesImpl: randomBytes,
  });
  if (input.action === "measure") {
    const measurementLease = acquireOperationLease(
      input.stateDir,
      common.now,
      common.randomBytesImpl,
    );
    try {
      return await operateMeasure(input, common);
    } finally {
      releaseOperationLease(measurementLease);
    }
  }
  const release = readRelease();
  if (!release.ready) {
    return Object.freeze({
      ok: false,
      mode: input.action,
      deployReady: false,
      releaseStatus: release.manifest.releaseStatus,
      fileReadsAfterManifest: 0,
      secretReads: 0,
      networkPerformed: false,
      hostedMutationCount: 0,
      productionTouched: false,
    });
  }
  assertCurrentRecoveryRoot(input);
  assertPredecessorPlanPathBoundary(input);
  if (input.action !== "plan") {
    assertCurrentReleasePlanBeforeLease(input.receiptDir);
  }
  const operationLease = acquireOperationLease(
    input.stateDir,
    common.now,
    common.randomBytesImpl,
  );
  try {
    if (input.action === "plan") return await operatePlan(input, common, release);
    if (input.action === "apply") return await operateApply(input, common, release);
    if (input.action === "reconcile") {
      return await operateReconcile(input, common, release);
    }
    return await operateVerify(input, common, release);
  } finally {
    releaseOperationLease(operationLease);
  }
}

async function main() {
  const result = await operateMainFinanceRuntimeRecoveryV2();
  process.stdout.write(`${canonicalJson(result)}\n`);
}

if (import.meta.main === true) {
  main().catch(error => {
    process.stderr.write(`${
      error instanceof Error
        ? error.message
        : "Main Finance runtime recovery v2 failed"
    }\n`);
    process.exitCode = 1;
  });
}
