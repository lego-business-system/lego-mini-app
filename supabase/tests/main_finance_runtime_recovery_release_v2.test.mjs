import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";

import * as recoveryModule from "../../scripts/prepare-main-finance-runtime-recovery-v2.mjs";
import {
  buildMainFinanceRuntimeRecoveryAttestRequest,
  buildMainFinanceRuntimeRecoverySnapshot,
  classifyMainFinanceRuntimeRecoveryReconcileSnapshot,
  extractMainFinanceRuntimeRecoveryVerifiedAttestationProof,
  measureMainFinanceRuntimeRecoveryCatalog,
  validateMainFinanceRuntimeRecoverySnapshotSandwich,
  verifyMainFinanceRuntimeRecoveryAttestResponse,
} from "../../scripts/main-finance-runtime-recovery-v2-snapshot.mjs";

const {
  canonicalJson,
  classifyMainFinanceRuntimeRecoveryV2FunctionState,
  sha256,
  validateMainFinanceRuntimeRecoveryV2ProvenanceSource,
  validateMainFinanceRuntimeRecoveryV4ReleaseAuthority,
} = recoveryModule;

const ROOT = realpathSync(path.resolve(import.meta.dirname, "../.."));
const RELEASE = path.join(ROOT, "supabase/releases/main-finance-runtime-recovery-v2");
const OPERATOR_FILE = path.join(
  ROOT,
  "scripts/prepare-main-finance-runtime-recovery-v2.mjs",
);
const MANIFEST_FILE = path.join(RELEASE, "staging.manifest.json");
const WORKFLOW_FILE = path.join(ROOT, ".github/workflows/verify-finance-integration.yml");
const PREFLIGHT_FILE = path.join(RELEASE, "preflight.sql");
const POSTFLIGHT_FILE = path.join(RELEASE, "postflight.contract.json");
const ENVIRONMENT_FILE = path.join(RELEASE, "environment.contract.json");
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_REF = "makgsbjduobcphuqzaoq";
const PRODUCTION_REFS = ["soxtekhspohkddpdidvp", "koibxwgtihwajocxfetb"];
const SOURCE_COMMIT = "c".repeat(40);
const SOURCE_TREE = "d".repeat(40);
const WORKFLOW_BLOB = "9b28cfde71d0ee6f21cc85d70a46042e3662a6a2";
const BRANCH = "agent/main-finance-staging-runtime-recovery-v2";
const RUN_ID = "321";
const POSTGRES_IMAGE =
  "postgres:17.10-bookworm@sha256:17b6c778de50f4bb9a878c36e736110fbcd9b7020377d6fdfdf20f7c0347e40a";
const NODE = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node";
const SUPABASE = "/Users/Maks/Library/pnpm/store/v11/links/@supabase/cli-darwin-arm64/2.109.1/e5fdd9fb276a62ab37eb6abe0330d50b2a81bb692d391bd8bc054b330e5d8133/node_modules/@supabase/cli-darwin-arm64/bin/supabase";
const GH = "/Users/Maks/Library/Caches/finance-release-tools-v1/gh_2.97.0_macOS_arm64/bin/gh";
const ARCHIVE = "/private/tmp/supabase_darwin_arm64-v2.109.1.tar.gz";
const SUCCESSOR_MUTATION_NAMES = Object.freeze([
  "MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256",
]);
const SCHEMA3_MUTATION_NAMES = Object.freeze([
  "MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA",
  "MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256",
]);
const SUCCESSOR_METADATA_ONLY_NAMES = Object.freeze([
  "SUPABASE_ANON_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_JWKS",
  "SUPABASE_PUBLISHABLE_KEYS",
  "SUPABASE_SECRET_KEYS",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
]);
const EXPECTED_CHANGED_PATHS = [
  ["M", ".github/workflows/verify-finance-integration.yml"],
  ["M", "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"],
  ["M", "scripts/manage-finance-access-v2.mjs"],
  ["M", "scripts/prepare-main-finance-runtime-recovery-v2.mjs"],
  ["M", "supabase/functions/finance-manage-access-v2/index.ts"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/environment.contract.json"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/postflight.contract.json"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/README.md"],
  ["M", "supabase/releases/main-finance-runtime-recovery-v2/staging.manifest.json"],
  ["M", "supabase/tests/finance_integration_ci.test.mjs"],
  ["M", "supabase/tests/main_finance_runtime_recovery_release_v2.test.mjs"],
  ["M", "supabase/tests/main_finance_runtime_secret_recovery_v2.test.mjs"],
  ["M", "supabase/tests/manage_finance_access_v2.test.mjs"],
].map(([status, changedPath]) => ({ status, path: changedPath }));
const BASE_MS = Date.parse("2026-08-14T05:00:00.000Z");
const OPERATOR_SECRET = Buffer.alloc(48, 1).toString("base64url");
const DISABLED = sha256("disabled");
const ENABLED = sha256("enabled");

const TABLES = [
  "architecture_finance_access_desired",
  "architecture_finance_access_outbox",
  "architecture_finance_issue_replay_guard",
  "architecture_finance_issue_requests",
  "architecture_product_entitlements",
];

const FUNCTION_CATALOG = [
  ["architecture_begin_finance_issue_internal", "uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone", "jsonb", "v", true, 0, "292fd9c6cc750a291db0008e34b3d0bc"],
  ["architecture_claim_finance_access_outbox_internal", "uuid, text, integer, uuid", "jsonb", "v", true, 2, "0f34d47992c44eb7328e73d67204126b"],
  ["architecture_finance_set_updated_at_internal", "", "trigger", "v", false, 0, "ba01fe3d1a916c7a8f497915431bbac5"],
  ["architecture_finish_finance_access_outbox_internal", "uuid, uuid, text, text", "jsonb", "v", true, 1, "1d1343aa890a46e2057dd181da497ba9"],
  ["architecture_finish_finance_issue_internal", "uuid, bytea, text, timestamp with time zone", "jsonb", "v", true, 1, "224981384a3ef9c101a77a9d3eb7e638"],
  ["architecture_get_finance_access_status_internal", "uuid, uuid", "jsonb", "s", true, 1, "2eac4225c64453659ed17233f8005c86"],
  ["architecture_resolve_finance_subject_internal", "uuid", "jsonb", "s", true, 0, "fb834aa38d61b0cdbe51571ef80e661c"],
  ["architecture_set_finance_access_desired_internal", "uuid, uuid, bytea, text, text, text, bigint", "jsonb", "v", true, 0, "a676ce7f658a6bc3652b074c1948e8e2"],
  ["architecture_upsert_product_entitlement_internal", "bytea, text, text, timestamp with time zone, timestamp with time zone", "jsonb", "v", true, 2, "4a4b56b2f6c340a6358dc4c826a29d31"],
];

const FUNCTION_ACL = [
  ["architecture_begin_finance_issue_internal", "uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone", "service_role"],
  ["architecture_claim_finance_access_outbox_internal", "uuid, text, integer, uuid", "service_role"],
  ["architecture_finish_finance_access_outbox_internal", "uuid, uuid, text, text", "service_role"],
  ["architecture_finish_finance_issue_internal", "uuid, bytea, text, timestamp with time zone", "service_role"],
  ["architecture_get_finance_access_status_internal", "uuid, uuid", "service_role"],
  ["architecture_resolve_finance_subject_internal", "uuid", "service_role"],
  ["architecture_set_finance_access_desired_internal", "uuid, uuid, bytea, text, text, text, bigint", "service_role"],
  ["architecture_upsert_product_entitlement_internal", "bytea, text, text, timestamp with time zone, timestamp with time zone", "postgres"],
];

function catalogFixture(databaseClock = new Date(BASE_MS).toISOString()) {
  const columnCounts = [12, 12, 11, 11, 11];
  const constraintCounts = [10, 10, 10, 10, 9];
  const columns = TABLES.flatMap((relation, tableIndex) =>
    Array.from({ length: columnCounts[tableIndex] }, (_, index) => ({
      relation_name: relation,
      column_name: `column_${String(index + 1).padStart(2, "0")}`,
      position: index + 1,
      type: "text",
      not_null: false,
      default_expression: null,
      identity: "",
      generated: "",
    })));
  const constraints = TABLES.flatMap((relation, tableIndex) =>
    Array.from({ length: constraintCounts[tableIndex] }, (_, index) => ({
      relation_name: relation,
      constraint_name: `${relation}_constraint_${String(index + 1).padStart(2, "0")}`,
      type: "c",
      definition: "CHECK (true)",
      deferrable: false,
      deferred: false,
      validated: true,
    })));
  const indexes = TABLES.flatMap(relation =>
    Array.from({ length: 4 }, (_, index) => {
      const name = `${relation}_index_${String(index + 1).padStart(2, "0")}`;
      return {
        relation_name: relation,
        index_name: name,
        definition: `CREATE INDEX ${name} ON public.${relation} USING btree (id)`,
        unique: false,
        primary: false,
        valid: true,
        ready: true,
        live: true,
      };
    }));
  const triggers = TABLES.slice(0, 4).map(relation => ({
    relation_name: relation,
    trigger_name: `${relation}_updated_at_trigger`,
    definition: `CREATE TRIGGER ${relation}_updated_at_trigger BEFORE UPDATE ON public.${relation} FOR EACH ROW EXECUTE FUNCTION public.architecture_finance_set_updated_at_internal()`,
    enabled: "O",
  }));
  const tableAcl = TABLES.flatMap(relation_name =>
    ["INSERT", "SELECT", "UPDATE"].map(privilege => ({
      relation_name,
      grantee: "postgres",
      grantor: "postgres",
      privilege,
      grantable: false,
    })));
  const functionCatalog = FUNCTION_CATALOG.map(item => ({
    name: item[0],
    identity_arguments: item[1],
    result_type: item[2],
    volatility: item[3],
    security_definer: item[4],
    argument_defaults: item[5],
    body_md5: item[6],
    function_kind: "f",
    strict: false,
    parallel_mode: "u",
    leakproof: false,
    config: ["search_path=pg_catalog, public"],
    owner: "postgres",
    language: "plpgsql",
  }));
  const functionAcl = FUNCTION_ACL.map(item => ({
    name: item[0],
    identity_arguments: item[1],
    grantee: item[2],
    grantor: "postgres",
    privilege: "EXECUTE",
    grantable: false,
  })).sort((left, right) =>
    left.name.localeCompare(right.name)
    || left.identity_arguments.localeCompare(right.identity_arguments)
    || left.grantee.localeCompare(right.grantee));
  return {
    database_clock: databaseClock,
    database_role: "supabase_read_only_user",
    server_version_num: "170006",
    migration_catalog: [
      { version: "20260714235900", name: "finance_integration_foundation" },
      { version: "20260715010000", name: "finance_entitlement_outbox_v1" },
      { version: "20260715020000", name: "finance_subject_resolver_v1" },
      { version: "20260729010000", name: "finance_security_definer_owner_acl_v1" },
      { version: "20260729020000", name: "finance_security_definer_nested_execute_acl_v1" },
      { version: "20260730000000", name: "remote_schema" },
    ],
    relation_catalog: TABLES.map((name, index) => ({
      name,
      kind: "r",
      owner: "postgres",
      rls: true,
      force_rls: false,
      column_count: String(columnCounts[index]),
      constraint_count: String(constraintCounts[index]),
      index_count: "4",
      trigger_count: index < 4 ? "1" : "0",
      policy_count: "0",
    })),
    column_catalog: columns,
    constraint_catalog: constraints,
    index_catalog: indexes,
    trigger_catalog: triggers,
    policy_catalog: [],
    function_catalog: functionCatalog,
    table_acl: tableAcl,
    function_acl: functionAcl,
    service_role_schema_usage: true,
    column_count: "57",
    constraint_count: "49",
    index_count: "20",
    trigger_count: "4",
    policy_count: "0",
    column_acl_count: "0",
    desired_count: "1",
    current_row_count: "1",
    current_invalid_count: "0",
    entitlement_invalid_count: "0",
    entitlement_count: "1",
    entitlement_extra_count: "0",
    version_invalid_count: "0",
    nonterminal_outbox_count: "0",
    active_issue_count: "0",
    active_replay_count: "0",
    rows: [{
      main_user_id: "00000000-0000-4000-8000-000000000001",
      event_id: "10000000-0000-4000-8000-000000000001",
      desired_state: "granted",
      version: "1",
      applied_state: "granted",
      applied_version: "1",
      event_state: "applied",
      changed_by: "operator:test",
      change_reason: "reviewed release fixture",
    }],
  };
}

function catalogCore(row) {
  return {
    migration_catalog: row.migration_catalog,
    relation_catalog: row.relation_catalog,
    column_catalog: row.column_catalog,
    constraint_catalog: row.constraint_catalog,
    index_catalog: row.index_catalog,
    trigger_catalog: row.trigger_catalog,
    policy_catalog: row.policy_catalog,
    function_catalog: row.function_catalog,
    table_acl: row.table_acl,
    function_acl: row.function_acl,
    service_role_schema_usage: row.service_role_schema_usage,
    column_count: row.column_count,
    constraint_count: row.constraint_count,
    index_count: row.index_count,
    trigger_count: row.trigger_count,
    policy_count: row.policy_count,
    column_acl_count: row.column_acl_count,
  };
}

const CATALOG_TEMPLATE = catalogFixture();
const CATALOG_SHA = sha256(canonicalJson(catalogCore(CATALOG_TEMPLATE)));
const PREFLIGHT = readFileSync(PREFLIGHT_FILE, "utf8");

function managementResponse(row) {
  return new Response(JSON.stringify([row]), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function inventoryRows(phase = "recovery") {
  const updated_at = "2026-08-14T04:59:00.000Z";
  const main = [
    { name: "MAIN_FINANCE_PRIVACY_HMAC_KEY", value: "31".repeat(32), updated_at },
    { name: "MAIN_FINANCE_SYNC_MODE", value: phase === "access" ? ENABLED : DISABLED, updated_at },
    { name: "MAIN_FINANCE_PROTOCOL_MODE", value: phase === "access" ? ENABLED : DISABLED, updated_at },
    { name: "MAIN_UNRELATED_SECRET", value: "32".repeat(32), updated_at },
  ];
  const finance = [
    { name: "FINANCE_ENTITLEMENT_SYNC_MODE", value: DISABLED, updated_at },
    { name: "FINANCE_ENTITLEMENT_V2_SYNC_MODE", value: ENABLED, updated_at },
    { name: "FINANCE_TELEGRAM_PROTOCOL_MODE", value: phase === "access" ? ENABLED : DISABLED, updated_at },
    { name: "FINANCE_UNRELATED_SECRET", value: "33".repeat(32), updated_at },
  ];
  return { main, finance };
}

async function importInternalInventoryFetchers(t) {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-secret-inventory-test-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const operatorSource = readFileSync(OPERATOR_FILE, "utf8");
  const markers = [
    "function fetchSecretInventories(dependencies, phase = \"recovery\") {",
    "function fetchFunctionInventory(dependencies) {",
  ];
  let instrumentedSource = operatorSource;
  for (const marker of markers) {
    assert.equal(instrumentedSource.split(marker).length, 2);
    instrumentedSource = instrumentedSource.replace(marker, `export ${marker}`);
  }
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    instrumentedSource,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  return import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
}

async function importInternalReadOnlyGitHubApi(t) {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-read-only-github-api-test-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const operatorSource = readFileSync(OPERATOR_FILE, "utf8");
  const marker = "function invokeReadOnlyGitHubApi({";
  assert.equal(operatorSource.split(marker).length, 2);
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    operatorSource.replace(marker, `export ${marker}`),
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  return import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
}

async function importInternalReceiptClock(t) {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-receipt-clock-test-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const operatorSource = readFileSync(OPERATOR_FILE, "utf8");
  const marker = "function nextReceiptTimestamp(chain, now, lowerBound = null) {";
  assert.equal(operatorSource.split(marker).length, 2);
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    operatorSource.replace(marker, `export ${marker}`),
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  return import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
}

async function importInternalGeneratedRuntimeSecrets(t) {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-generated-secret-adoption-test-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const operatorSource = fixturePinOperatorSource(
    readFileSync(OPERATOR_FILE, "utf8"),
  );
  const markers = [
    "function runtimeRows({ release, source, snapshot, operatorSecret, triggerSecret }) {",
    "function selectGeneratedRuntimeSecrets({",
    "function resolveGeneratedRuntimeSecrets({",
    "function validateRuntimeBundleValues({",
    "function validateBundleRecoveryVariant(attestation, legacyOperationalPredecessor) {",
    "function readRuntimeBundlePlaintextAfterAuthority({",
    "function assertPlanEnvelopeCurrentBeforePlaintext(",
    "function assertLegacyPredecessorBundleBeforePlaintext({",
    "function assertRuntimeReadChainEligibility(action, chain, now = null) {",
    "function assertOrphanedSuccessorRecoveryFrames({",
    "function receiptDirectoryIdentity(directory) {",
    "function assertFreshReceiptAuthorityUnchanged({",
    "function assertSuccessorPredecessorBaselineBinding(",
    "function validSuccessorMutationSecretDigestMap(",
    "function assertCurrentReleaseSecretsOnlyBundle(attestation, plan) {",
    "async function collectCompletionAuthority({",
  ];
  let instrumentedSource = operatorSource;
  for (const marker of markers) {
    assert.equal(instrumentedSource.split(marker).length, 2);
    instrumentedSource = instrumentedSource.replace(marker, `export ${marker}`);
  }
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    instrumentedSource,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  return import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
}

async function importInternalReceiptSemantic(t) {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-receipt-semantic-test-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const operatorSource = fixturePinOperatorSource(
    readFileSync(OPERATOR_FILE, "utf8"),
  );
  const markers = [
    "function validateReceiptSemantic(\n  receipt,\n  prior,\n  { variant = \"current\" } = {},\n) {",
    "function readReceiptChain(\n  directory,\n  { readOnly = false, variant = \"current\" } = {},\n) {",
  ];
  let instrumentedSource = operatorSource;
  for (const marker of markers) {
    assert.equal(instrumentedSource.split(marker).length, 2);
    instrumentedSource = instrumentedSource.replace(marker, `export ${marker}`);
  }
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    instrumentedSource,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  return import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
}

function readyManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  manifest.releaseStatus = "READY_FOR_SOURCE_ATTESTATION";
  manifest.expectedDatabaseCatalogSha256 = CATALOG_SHA;
  return manifest;
}

function provenanceSource(
  sourceCommit = SOURCE_COMMIT,
  sourceTree = SOURCE_TREE,
  githubRunId = RUN_ID,
) {
  const core = {
    schemaVersion: 2,
    kind: "main-finance-runtime-recovery-v2-release-provenance",
    environment: "staging",
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    productionDenyProjectRefs: PRODUCTION_REFS,
    sourceBranch: BRANCH,
    remoteRef: `refs/remotes/origin/${BRANCH}`,
    expectedCommitSha: sourceCommit,
    expectedTreeSha: sourceTree,
    remoteCommitSha: sourceCommit,
    githubRunId,
  };
  return `${canonicalJson({
    ...core,
    descriptorSha256: sha256(canonicalJson(core)),
  })}\n`;
}

function gitBlobSha(file) {
  const bytes = readFileSync(file);
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function functionInventoryRow({
  id,
  slug,
  verify_jwt,
  version,
  status = "ACTIVE",
  ...extra
}) {
  return Object.freeze({
    created_at: 1_784_699_954_480,
    entrypoint_path: `file:///tmp/${slug}/index.ts`,
    ezbr_sha256: sha256(`ezbr:${slug}:${version}`),
    id,
    name: slug,
    slug,
    status,
    updated_at: 1_784_699_956_510,
    verify_jwt,
    version,
    ...extra,
  });
}

const PURE_UNRELATED_FUNCTION = functionInventoryRow({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "unrelated-function",
  verify_jwt: true,
  version: 3,
});
const PURE_EXACT_FUNCTION = functionInventoryRow({
  id: "22222222-2222-4222-8222-222222222222",
  slug: "finance-manage-access-v2",
  verify_jwt: false,
  version: 1,
});

const BASE_COMMIT = "adcf7b919d34e512ded6d526ee7321f795f8f887";
const BASE_TREE = "f02055d03d63a1fc2ebdbb17aeed3bcb2aafd22a";
const rawHash = label => sha256(`fixture:${label}`);
const at = offset => new Date(BASE_MS + offset).toISOString();
const CHANGED_PATHS = Object.freeze([{ status: "A", path: "fixture.txt" }]);
const CHANGED_PATH_SET = sha256("A\0fixture.txt\n");
const OPERATION_BINDING = rawHash("operation-binding");
const RELEASE_MANIFEST_SHA = rawHash("release-manifest");
const SOURCE_DEPLOYMENT_SHA = rawHash("source-deployment");
const PROVENANCE_FILE_SHA = rawHash("provenance-file");
const PROVENANCE_DESCRIPTOR_SHA = rawHash("provenance-descriptor");
const BUNDLE_ATTESTATION_SHA = rawHash("bundle-attestation");
const RUNTIME_INPUT_SHA = rawHash("runtime-input");
const DEPLOY_INPUT_SHA = rawHash("deploy-input");
const RUNTIME_ARGS_SHA = rawHash("runtime-args");
const DEPLOY_ARGS_SHA = rawHash("deploy-args");
const SOURCE_ARCHIVE_SHA = rawHash("source-archive");
const SUPABASE_ARCHIVE_SHA = rawHash("supabase-archive");
const OPERATOR_DESCRIPTOR_FILE_SHA = rawHash("operator-descriptor-file");
const MANAGED_SECRET_DIGEST = rawHash("managed-secret");
const SECRET_NAMES = Object.freeze(["MANAGED_SECRET"]);
const EXPECTED_DIGESTS = Object.freeze({ MANAGED_SECRET: MANAGED_SECRET_DIGEST });
const PRE_MAIN = Object.freeze([Object.freeze({
  name: "UNRELATED_MAIN",
  value: rawHash("unrelated-main"),
  updatedAt: at(-2_000),
})]);
const PRE_FINANCE = Object.freeze([Object.freeze({
  name: "UNRELATED_FINANCE",
  value: rawHash("unrelated-finance"),
  updatedAt: at(-2_000),
})]);
const INSTALLED_MAIN = Object.freeze([
  ...PRE_MAIN,
  Object.freeze({
    name: "MANAGED_SECRET",
    value: MANAGED_SECRET_DIGEST,
    updatedAt: at(2_500),
  }),
]);
const INSTALLED_FINANCE = PRE_FINANCE;
const PREDECESSOR_FUNCTIONS = Object.freeze([
  Object.freeze({ ...PURE_UNRELATED_FUNCTION, version: 2 }),
]);
const PRE_FUNCTIONS = Object.freeze([PURE_UNRELATED_FUNCTION]);
const POST_SECRET_FUNCTIONS = Object.freeze([
  Object.freeze({ ...PURE_UNRELATED_FUNCTION, version: 4 }),
]);
const INSTALLED_FUNCTIONS = Object.freeze([
  ...POST_SECRET_FUNCTIONS,
  PURE_EXACT_FUNCTION,
]);

function inventorySha(rows) {
  return sha256(canonicalJson([...rows].sort((left, right) =>
    left.name.localeCompare(right.name))));
}

function functionSha(rows) {
  return sha256(canonicalJson([...rows].sort((left, right) =>
    left.slug.localeCompare(right.slug))));
}

const PLAN_SNAPSHOT = Object.freeze({
  databaseClock: at(500),
  responseSha256: rawHash("plan-response"),
  descriptorSha256: rawHash("descriptor"),
  stateSha256: rawHash("state"),
  catalogSha256: rawHash("catalog"),
  gateInventorySha256: rawHash("gate-inventory"),
  privacyInventorySha256: rawHash("privacy-inventory"),
  checkedCount: 7,
});

const SOURCE_BINDING = Object.freeze({
  commit: SOURCE_COMMIT,
  tree: SOURCE_TREE,
  parent: BASE_COMMIT,
  baseTree: BASE_TREE,
  changedPaths: CHANGED_PATHS,
  changedPathSetSha256: CHANGED_PATH_SET,
  trackedFileCount: 935,
  workflowBlobSha: WORKFLOW_BLOB,
  supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
});
const PROVENANCE_BINDING = Object.freeze({
  expectedCommitSha: SOURCE_COMMIT,
  expectedTreeSha: SOURCE_TREE,
  githubRunId: RUN_ID,
  fileSha256: PROVENANCE_FILE_SHA,
  descriptorSha256: PROVENANCE_DESCRIPTOR_SHA,
});
const CI_BINDING = Object.freeze({
  runId: RUN_ID,
  runApiSha256: rawHash("ci-run"),
  jobsApiSha256: rawHash("ci-jobs"),
  branchApiSha256: rawHash("ci-branch"),
  workflowBlobSha: WORKFLOW_BLOB,
  headSha: SOURCE_COMMIT,
  conclusion: "success",
});
const RELEASE_BINDING = Object.freeze({
  manifestSha256: RELEASE_MANIFEST_SHA,
  sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
  futureClockSkewSeconds: 30,
});
const PREDECESSOR_ADOPTION = Object.freeze({
  kind: "main-finance-runtime-recovery-v2-predecessor-adoption",
  priorRootIdentitySha256: rawHash("prior-root-identity"),
  priorSourceCommitSha: "b87fe6a9212bdb6e43d8304be36c39074379a153",
  priorSourceTreeSha: "af4bb9b7fec37dd600c086184f101e2c3a094f7e",
  priorReleaseProvenanceFileSha256:
    "c8f0647c91691c068330aa8b41482ba8ecd08164504dd2172d154334621c88a7",
  priorReleaseProvenanceDescriptorSha256:
    "5c6d31aef675f80187209e398eb18b8691a73315c595f5c498760de6b733719f",
  priorPlanReceiptSha256:
    "77a406d917a7232bb79ce7366a6166ae0170234f47ee6390dc48c79fb1a7c030",
  priorTerminalReceiptSha256:
    "5978750d44354891f11daaaded5d17493a891732a05287b8e4b0398b8db0f932",
  priorBundleAttestationSha256:
    "e336b417038d1cdd1398eff69473f5aabe6873a6f17dd92563ab5eac822077dc",
  priorRuntimeFileSha256:
    "8920f620995e6749ae56d5d1d8a9b7461eee8c208adcad22ef56db67d0f1a908",
  generatedSecretNames: Object.freeze([
    "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ]),
  generatedSecretDigestSetSha256:
    "b3014c4eb96cf14c75017f10d3e071285c671f9d1387dcbf48310ca63dd5d211",
  predecessorFunctionInventorySha256: functionSha(PREDECESSOR_FUNCTIONS),
  observedFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
  observedFunctionTransitionDisposition: "exact-all-existing-plus-one",
  observedFunctionCount: PRE_FUNCTIONS.length,
  stableReadRounds: 2,
  installedObserved: true,
  stateSatisfied: true,
  causalAttribution: false,
});

function fixturePinOperatorSource(source) {
  const replacements = [
    [
      'const BASE_COMMIT_SHA = "a30dedf20e977d9794a8ac9e54abc48b076c9d45";',
      `const BASE_COMMIT_SHA = "${BASE_COMMIT}";`,
    ],
    [
      'const BASE_TREE_SHA = "92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf";',
      `const BASE_TREE_SHA = "${BASE_TREE}";`,
    ],
    [
      'preinstallFunctionInventorySha256: "769a1fe02c74644f0c185cc2aa660293b1f1b795910e9089824932023d625942"',
      `preinstallFunctionInventorySha256: "${functionSha(PREDECESSOR_FUNCTIONS)}"`,
    ],
    [
      'observedFunctionInventorySha256: "e1edfa70f070fc3cf7b207891c33518107ab516378673dcc3cb07e63e5a09faf"',
      `observedFunctionInventorySha256: "${functionSha(PRE_FUNCTIONS)}"`,
    ],
    ["observedFunctionCount: 12", `observedFunctionCount: ${PRE_FUNCTIONS.length}`],
    [
      'preinstallMainInventorySha256: "3082bc57309750154344dc225d4b286840c0af7be08acebe5b217378927a7fd0"',
      `preinstallMainInventorySha256: "${inventorySha(PRE_MAIN)}"`,
    ],
    [
      'installedMainInventorySha256: "66a2630aa9c4c17d9e1a894a9a43f201e40913dab20d0f08c161c48ebb0a7c60"',
      `installedMainInventorySha256: "${inventorySha(PRE_MAIN)}"`,
    ],
    [
      'financeInventorySha256: "89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e"',
      `financeInventorySha256: "${inventorySha(PRE_FINANCE)}"`,
    ],
  ];
  let result = source;
  for (const [needle, replacement] of replacements) {
    assert.equal(result.split(needle).length, 2, needle);
    result = result.replace(needle, replacement);
  }
  return result;
}

async function importFixturePinnedRecoveryModule() {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-declarative-fixture-pins-",
  ));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  let operatorSource = fixturePinOperatorSource(readFileSync(OPERATOR_FILE, "utf8"));
  for (const marker of [
    "function captureRuntimeMutationInput(",
    "function declarativeMutationInputEvidence(",
    "function metadataOnlyInventoryDelta(",
    "function classifyAllExistingFunctionVersionTransition({",
    "function expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(",
    "function classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({",
    "function evaluateMainFinanceRuntimeRecoveryV2StateLegacyCore(",
  ]) {
    assert.equal(operatorSource.split(marker).length, 2);
    operatorSource = operatorSource.replace(marker, `export ${marker}`);
  }
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    operatorSource,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  const module = await import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
  return { module, parent };
}

const fixtureRecovery = await importFixturePinnedRecoveryModule();
after(() => rmSync(fixtureRecovery.parent, { recursive: true, force: true }));
const {
  captureRuntimeMutationInput,
  classifyAllExistingFunctionVersionTransition,
  classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition,
  declarativeMutationInputEvidence,
  evaluateMainFinanceRuntimeRecoveryV2StateLegacyCore:
    evaluateMainFinanceRuntimeRecoveryV2State,
  expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows,
  metadataOnlyInventoryDelta,
} = fixtureRecovery.module;
const BUNDLE_BINDING = Object.freeze({
  attestationSha256: BUNDLE_ATTESTATION_SHA,
  catalogSha256: PLAN_SNAPSHOT.catalogSha256,
  descriptorSha256: PLAN_SNAPSHOT.descriptorSha256,
  stateSha256: PLAN_SNAPSHOT.stateSha256,
  gateInventorySha256: PLAN_SNAPSHOT.gateInventorySha256,
  privacyInventorySha256: PLAN_SNAPSHOT.privacyInventorySha256,
  checkedCount: PLAN_SNAPSHOT.checkedCount,
  preinstallMainInventorySha256: inventorySha(PRE_MAIN),
  preinstallFinanceInventorySha256: inventorySha(PRE_FINANCE),
  preinstallFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
  runtimeMutationInputSha256: RUNTIME_INPUT_SHA,
  deployMutationInputSha256: DEPLOY_INPUT_SHA,
  productionBoundarySha256: rawHash("production-boundary"),
  targetDescriptorSha256: rawHash("target-descriptor"),
  runtimeCommandArgsSha256: RUNTIME_ARGS_SHA,
  deployCommandArgsSha256: DEPLOY_ARGS_SHA,
  sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
  operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
  predecessorAdoptionSha256: sha256(canonicalJson(PREDECESSOR_ADOPTION)),
});

function approvalFor(plan) {
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

function appendFixture(chain, fields) {
  const core = {
    schemaVersion: 2,
    sequence: chain.length + 1,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
    productionDenied: true,
    ...fields,
  };
  const receipt = Object.freeze({
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  });
  chain.push(receipt);
  return receipt;
}

function planFields({
  scope = "secrets-set+function-deploy",
  recordedAt = at(1_000),
  expiresAt = at(201_000),
  resumeFromReceiptSha256 = null,
  main = PRE_MAIN,
  finance = PRE_FINANCE,
  functions = scope === "function-deploy" ? POST_SECRET_FUNCTIONS : PRE_FUNCTIONS,
  snapshot = PLAN_SNAPSHOT,
} = {}) {
  return {
    kind: "release-plan",
    status: "pending",
    environment: "staging",
    recordedAt,
    expiresAt,
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    sourceParentSha: BASE_COMMIT,
    baseTreeSha: BASE_TREE,
    changedPaths: CHANGED_PATHS,
    changedPathSetSha256: CHANGED_PATH_SET,
    trackedFileCount: 935,
    workflowBlobSha: WORKFLOW_BLOB,
    sourceCiRunId: RUN_ID,
    sourceCiRunApiSha256: CI_BINDING.runApiSha256,
    sourceCiJobsApiSha256: CI_BINDING.jobsApiSha256,
    sourceCiBranchApiSha256: CI_BINDING.branchApiSha256,
    sourceProvenanceFileSha256: PROVENANCE_FILE_SHA,
    sourceProvenanceDescriptorSha256: PROVENANCE_DESCRIPTOR_SHA,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
    bundleAttestationSha256: BUNDLE_ATTESTATION_SHA,
    sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
    supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
    operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
    runtimeMutationInputSha256: RUNTIME_INPUT_SHA,
    deployMutationInputSha256: DEPLOY_INPUT_SHA,
    runtimeCommandArgsSha256: RUNTIME_ARGS_SHA,
    deployCommandArgsSha256: DEPLOY_ARGS_SHA,
    productionBoundarySha256: rawHash("production-boundary"),
    targetDescriptorSha256: rawHash("target-descriptor"),
    mainInventorySha256: inventorySha(main),
    financeInventorySha256: inventorySha(finance),
    functionInventorySha256: functionSha(functions),
    functionVersionTransition: {
      beforeFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
      unchangedFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
      exactAllExistingPlusOneFunctionInventorySha256:
        functionSha(POST_SECRET_FUNCTIONS),
      currentStageFunctionInventorySha256: functionSha(functions),
      currentStageDisposition:
        classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
          beforeRows: PRE_FUNCTIONS,
          afterRows: functions,
        }),
      currentStageExactAllExistingPlusOneFunctionInventorySha256:
        functionSha(expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(functions)),
      existingFunctionCount: PRE_FUNCTIONS.length,
      allowedDispositions: ["unchanged", "exact-all-existing-plus-one"],
      allOtherFieldsUnchanged: true,
      stableReadRounds: 2,
    },
    predecessorAdoption: PREDECESSOR_ADOPTION,
    snapshot,
    mutationScope: scope,
    resumeFromReceiptSha256,
    hostedMutationCount: 0,
    productionTouched: false,
  };
}

function appendPlan(chain, options = {}) {
  return appendFixture(chain, planFields(options));
}

function intentFields(plan, mutation, {
  recordedAt,
  main,
  finance,
  functions = mutation === "function-deploy" ? POST_SECRET_FUNCTIONS : PRE_FUNCTIONS,
} = {}) {
  const common = {
    kind: "mutation-intent",
    mutation,
    status: "pending",
    environment: "staging",
    recordedAt,
    planReceiptSha256: plan.receiptSha256,
    beforeMainInventorySha256: inventorySha(main),
    beforeFinanceInventorySha256: inventorySha(finance),
    automaticRetryPerformed: false,
    productionTouched: false,
  };
  return mutation === "secrets-set" ? {
    ...common,
    beforeFunctionInventorySha256: functionSha(functions),
    unchangedFunctionInventorySha256: functionSha(functions),
    exactAllExistingPlusOneFunctionInventorySha256: functionSha(
      expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(functions),
    ),
    requiredStableReadRounds: 2,
    predecessorAdoptionSha256: sha256(canonicalJson(PREDECESSOR_ADOPTION)),
    expectedSecretDigestSetSha256: sha256(canonicalJson(EXPECTED_DIGESTS)),
    secretNames: SECRET_NAMES,
  } : {
    ...common,
    beforeFunctionInventorySha256: functionSha(functions),
    sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
  };
}

function appendIntent(chain, plan, mutation, options = {}) {
  return appendFixture(chain, intentFields(plan, mutation, options));
}

function mutationResultFields(intent, {
  status = "verified",
  recordedAt,
  main = INSTALLED_MAIN,
  finance = INSTALLED_FINANCE,
  functions = intent.mutation === "secrets-set"
    ? POST_SECRET_FUNCTIONS : INSTALLED_FUNCTIONS,
  proofSha256 = rawHash("hosted-proof"),
  d0ResponseSha256 = rawHash("d0-response"),
} = {}) {
  if (status === "unknown") {
    return {
      kind: "mutation-result",
      mutation: intent.mutation,
      status: "unknown",
      environment: "staging",
      recordedAt,
      intentReceiptSha256: intent.receiptSha256,
      responseStatus: null,
      reconcileRequired: true,
      automaticRetryPerformed: false,
      productionTouched: false,
    };
  }
  const evidence = intent.mutation === "secrets-set" ? {
    afterMainInventorySha256: inventorySha(main),
    afterFinanceInventorySha256: inventorySha(finance),
    afterFunctionInventorySha256: functionSha(functions),
    functionVersionTransitionDisposition:
      classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
        beforeRows: PRE_FUNCTIONS,
        afterRows: functions,
      }),
    functionInventoryStableReadRounds: 2,
    predecessorAdoptionSha256: sha256(canonicalJson(PREDECESSOR_ADOPTION)),
    observation: "installed_observed",
    state: "state_satisfied",
    causalAttribution: false,
  } : {
    functionInventorySha256: functionSha(functions),
    hostedProofSha256: proofSha256,
    hostedD0ResponseSha256: d0ResponseSha256,
  };
  return {
    kind: "mutation-result",
    mutation: intent.mutation,
    status: "verified",
    environment: "staging",
    recordedAt,
    intentReceiptSha256: intent.receiptSha256,
    ...evidence,
    reconcileRequired: false,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function appendMutationResult(chain, intent, options = {}) {
  return appendFixture(chain, mutationResultFields(intent, options));
}

function reconciliationFields(unresolved, outcome, {
  recordedAt,
  main,
  finance,
  functions,
  proofSha256 = null,
  d0ResponseSha256 = null,
} = {}) {
  return {
    kind: "reconciliation",
    mutation: unresolved.mutation,
    outcome,
    environment: "staging",
    recordedAt,
    unresolvedReceiptSha256: unresolved.receiptSha256,
    mainInventorySha256: inventorySha(main),
    financeInventorySha256: inventorySha(finance),
    functionInventorySha256: functionSha(functions),
    hostedProofSha256: proofSha256,
    hostedD0ResponseSha256: d0ResponseSha256,
    ...(unresolved.mutation === "secrets-set" ? {
      observation: outcome === "state_satisfied"
        ? "installed_observed"
        : (outcome === "state_unsatisfied" ? "baseline_observed" : "diverged"),
      state: outcome,
      causalAttribution: false,
      functionVersionTransitionDisposition:
        classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
          beforeRows: PRE_FUNCTIONS,
          afterRows: functions,
        }),
      inventoryReadRounds: 2,
      stableObservation: true,
      predecessorAdoptionSha256: sha256(canonicalJson(PREDECESSOR_ADOPTION)),
    } : {}),
    hostedMutationCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function appendReconciliation(chain, unresolved, outcome, options = {}) {
  return appendFixture(
    chain,
    reconciliationFields(unresolved, outcome, options),
  );
}

function postflightFixture({
  main = INSTALLED_MAIN,
  finance = INSTALLED_FINANCE,
  functions = INSTALLED_FUNCTIONS,
  d0Clock = at(8_000),
  proofClock = at(9_000),
  d1Clock = at(10_000),
  proofSha256 = rawHash("hosted-proof"),
  d0ResponseLabel = "d0-response",
  d1ResponseLabel = "d1-response",
} = {}) {
  const snapshot = (databaseClock, response) => Object.freeze({
    ...PLAN_SNAPSHOT,
    databaseClock,
    responseSha256: rawHash(response),
  });
  return Object.freeze({
    d0: snapshot(d0Clock, d0ResponseLabel),
    proof: Object.freeze({
      responseSha256: rawHash("proof-response"),
      proofSha256,
      attestedAt: proofClock,
      checkedCount: PLAN_SNAPSHOT.checkedCount,
      mismatchCount: 0,
      stateSha256: PLAN_SNAPSHOT.stateSha256,
    }),
    d1: snapshot(d1Clock, d1ResponseLabel),
    d0MainInventorySha256: inventorySha(main),
    d0FinanceInventorySha256: inventorySha(finance),
    d0FunctionInventorySha256: functionSha(functions),
    d1MainInventorySha256: inventorySha(main),
    d1FinanceInventorySha256: inventorySha(finance),
    d1FunctionInventorySha256: functionSha(functions),
  });
}

function completionFields(plan, cause, postflight, recordedAt = at(12_000)) {
  return {
    kind: "release-complete",
    status: "verified",
    environment: "staging",
    recordedAt,
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    sourceParentSha: BASE_COMMIT,
    baseTreeSha: BASE_TREE,
    changedPaths: CHANGED_PATHS,
    changedPathSetSha256: CHANGED_PATH_SET,
    trackedFileCount: 935,
    workflowPath: ".github/workflows/verify-finance-integration.yml",
    workflowBlobSha: WORKFLOW_BLOB,
    sourceCiRunId: RUN_ID,
    sourceCiRunApiSha256: CI_BINDING.runApiSha256,
    sourceCiJobsApiSha256: CI_BINDING.jobsApiSha256,
    sourceCiBranchApiSha256: CI_BINDING.branchApiSha256,
    sourceCiConclusion: "success",
    sourceProvenanceFileSha256: PROVENANCE_FILE_SHA,
    sourceProvenanceDescriptorSha256: PROVENANCE_DESCRIPTOR_SHA,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    deploymentClosureSha256: SOURCE_DEPLOYMENT_SHA,
    sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
    supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
    operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
    productionBoundarySha256: plan.productionBoundarySha256,
    targetDescriptorSha256: plan.targetDescriptorSha256,
    functionInventorySha256: postflight.d1FunctionInventorySha256,
    causalHostedProofSha256: cause.hostedProofSha256,
    d0: postflight.d0,
    hostedProof: postflight.proof,
    d1: postflight.d1,
    d0MainInventorySha256: postflight.d0MainInventorySha256,
    d0FinanceInventorySha256: postflight.d0FinanceInventorySha256,
    d0FunctionInventorySha256: postflight.d0FunctionInventorySha256,
    d1MainInventorySha256: postflight.d1MainInventorySha256,
    d1FinanceInventorySha256: postflight.d1FinanceInventorySha256,
    d1FunctionInventorySha256: postflight.d1FunctionInventorySha256,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function commandPayload(mutation) {
  return {
    kind: "main-finance-runtime-recovery-v2-command",
    mutation,
    projectRef: MAIN_REF,
    sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
    mutationInputSha256: mutation === "secrets-set"
      ? RUNTIME_INPUT_SHA : DEPLOY_INPUT_SHA,
    argsSha256: mutation === "secrets-set"
      ? RUNTIME_ARGS_SHA : DEPLOY_ARGS_SHA,
  };
}

function measurementFields(recordedAt = at(1_000)) {
  return {
    kind: "catalog-measurement",
    status: "read-only-verified",
    environment: "staging",
    recordedAt,
    sourceCommitSha: BASE_COMMIT,
    sourceTreeSha: BASE_TREE,
    sourceParentSha: BASE_COMMIT,
    baseTreeSha: BASE_TREE,
    changedPaths: CHANGED_PATHS,
    changedPathSetSha256: rawHash("measurement-changed-paths"),
    trackedFileCount: 935,
    workflowBlobSha: WORKFLOW_BLOB,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    preflightSqlSha256: rawHash("preflight"),
    managementResponseSha256: rawHash("management-response"),
    databaseClock: at(900),
    catalogSha256: rawHash("measurement-catalog"),
    counts: {
      columns: 57,
      constraints: 49,
      indexes: 20,
      triggers: 4,
      policies: 0,
      desired: 1,
      entitlements: 1,
    },
    hostedReadCount: 1,
    hostedMutationCount: 0,
    productionTouched: false,
  };
}

function completedChainFixture() {
  const chain = [];
  const plan = appendPlan(chain);
  const secretIntent = appendIntent(chain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(chain, secretIntent, { recordedAt: at(3_000) });
  const deployIntent = appendIntent(chain, plan, "function-deploy", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  const postflight = postflightFixture();
  const deployResult = appendMutationResult(chain, deployIntent, {
    recordedAt: at(11_000),
    proofSha256: postflight.proof.proofSha256,
    d0ResponseSha256: postflight.d0.responseSha256,
  });
  const completionPostflight = postflightFixture({
    proofSha256: rawHash("completed-chain-fresh-proof"),
    d0ResponseLabel: "completed-chain-fresh-d0-response",
    d1ResponseLabel: "completed-chain-fresh-d1-response",
  });
  const complete = appendFixture(
    chain,
    completionFields(plan, deployResult, completionPostflight),
  );
  return { chain, plan, postflight: completionPostflight, complete };
}

function transition(chain, {
  action = "plan",
  checkpoint = "request",
  now = at(1_100),
  mutation = "none",
  mutationOutcome = "none",
  main = PRE_MAIN,
  finance = PRE_FINANCE,
  functions = null,
  approval,
  inputCurrentSha256,
  observationEvidence: suppliedObservationEvidence,
  postflightEvidence = null,
  effectPayload = null,
  operationCurrentSha256 = OPERATION_BINDING,
  source = SOURCE_BINDING,
  provenance = PROVENANCE_BINDING,
  ci = CI_BINDING,
  release = RELEASE_BINDING,
  bundle = BUNDLE_BINDING,
  expectedDigests = EXPECTED_DIGESTS,
  secretNames = SECRET_NAMES,
  evaluator = evaluateMainFinanceRuntimeRecoveryV2State,
} = {}) {
  if (action === "measure") {
    return evaluator({
      action,
      checkpoint,
      operationBinding: {
        expectedSha256: OPERATION_BINDING,
        currentSha256: operationCurrentSha256,
      },
      chain,
      release: null,
      source: null,
      provenance: null,
      ci: null,
      bundle: null,
      approval: null,
      now,
      mutation: "none",
      mutationOutcome: "none",
      secretEvidence: null,
      functionEvidence: null,
      mutationInputEvidence: null,
      observationEvidence: null,
      postflightEvidence: null,
      effectPayload,
    });
  }
  const expectedInput = mutation === "secrets-set"
    ? RUNTIME_INPUT_SHA
    : (mutation === "function-deploy" ? DEPLOY_INPUT_SHA : null);
  const plan = [...chain].reverse().find(receipt => receipt.kind === "release-plan");
  const effectiveFunctions = functions ?? (
    inventorySha(main) === inventorySha(INSTALLED_MAIN)
      ? POST_SECRET_FUNCTIONS : PRE_FUNCTIONS
  );
  const effectiveApproval = approval === undefined
    && action === "apply"
    && checkpoint !== "after-mutation"
    ? approvalFor(plan)
    : (approval ?? null);
  const observationEvidence = suppliedObservationEvidence !== undefined
    ? suppliedObservationEvidence
    : (action === "reconcile" && mutation === "secrets-set"
      ? {
        inventoryReadRounds: 2,
        stableObservation: true,
        firstMainInventorySha256: inventorySha(main),
        firstFinanceInventorySha256: inventorySha(finance),
        firstFunctionInventorySha256: functionSha(effectiveFunctions),
        secondMainInventorySha256: inventorySha(main),
        secondFinanceInventorySha256: inventorySha(finance),
        secondFunctionInventorySha256: functionSha(effectiveFunctions),
      }
      : null);
  return evaluator({
    action,
    checkpoint,
    operationBinding: {
      expectedSha256: OPERATION_BINDING,
      currentSha256: operationCurrentSha256,
    },
    chain,
    release,
    source,
    provenance,
    ci,
    bundle,
    approval: effectiveApproval,
    now,
    mutation,
    mutationOutcome,
    secretEvidence: {
      preinstallMain: PRE_MAIN,
      preinstallFinance: PRE_FINANCE,
      currentMain: main,
      currentFinance: finance,
      expectedDigests,
      secretNames,
    },
    functionEvidence: {
      preinstallRows: PRE_FUNCTIONS,
      currentRows: effectiveFunctions,
    },
    mutationInputEvidence: action !== "apply" || mutation === "none" ? null : {
      expectedSha256: expectedInput,
      currentSha256: inputCurrentSha256 === undefined
        ? expectedInput : inputCurrentSha256,
    },
    observationEvidence,
    postflightEvidence,
    effectPayload,
  });
}

function assertTransition(
  result,
  decision,
  effect,
  nextScope = null,
  nextMutation = null,
  reconciliationOutcome = null,
) {
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(Object.keys(result).sort(), [
    "authorizedReceiptSha256", "chainTailSha256", "decision", "effect",
    "effectPerformed", "kind", "nextMutation", "nextScope", "payloadSha256",
    "productionTouched", "reconciliationOutcome", "recordedAt",
  ].sort());
  assert.equal(result.kind, "main-finance-runtime-recovery-v2-declarative-transition");
  assert.equal(result.decision, decision);
  assert.equal(result.effect, effect);
  assert.equal(result.nextScope, nextScope);
  assert.equal(result.nextMutation, nextMutation);
  assert.equal(result.reconciliationOutcome, reconciliationOutcome);
  assert.equal(result.effectPerformed, false);
  assert.equal(result.productionTouched, false);
}

const TERMINAL_MAIN_INVENTORY_SHA =
  "b98949ec772990f98b26471ed4e6ff4356d289709b51fd707419ffdbb1570139";
const TERMINAL_FINANCE_INVENTORY_SHA =
  "89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e";
const TERMINAL_FUNCTION_INVENTORY_SHA =
  "ad7075e78470642d731f628e722efb2f498c31760148b362a6e51ce7225b17e1";
const TERMINAL_RECEIPT_CHAIN_SHA =
  "f4196cffb0ad9b6c8dc0d619085e2bf1f44790efb479bc429ed91d1e74e15834";
const SUCCESSOR_SOURCE_PARENT =
  "a30dedf20e977d9794a8ac9e54abc48b076c9d45";
const SUCCESSOR_BASE_TREE =
  "92d7aa5df37a09049d4fdaeaa523d2cc02e85cbf";
const SUCCESSOR_CHANGED_PATH_SET = sha256(EXPECTED_CHANGED_PATHS
  .map(item => `${item.status}\0${item.path}\n`).join(""));
const SUCCESSOR_MUTATION_DIGESTS = Object.freeze(Object.fromEntries(
  SCHEMA3_MUTATION_NAMES.map(name => [name, rawHash(`successor:${name}`)]),
));
const SUCCESSOR_BASELINE_MAIN = Object.freeze([
  ...SCHEMA3_MUTATION_NAMES.map(name => Object.freeze({
    name,
    value: rawHash(`terminal:${name}`),
    updatedAt: at(-5_000),
  })),
  ...SUCCESSOR_METADATA_ONLY_NAMES.map(name => Object.freeze({
    name,
    value: rawHash(`terminal:${name}`),
    updatedAt: at(-5_000),
  })),
  Object.freeze({
    name: "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
    value: rawHash("terminal:operator-secret"),
    updatedAt: at(-5_000),
  }),
  Object.freeze({
    name: "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
    value: rawHash("terminal:trigger-secret"),
    updatedAt: at(-5_000),
  }),
  Object.freeze({
    name: "MAIN_UNRELATED_SECRET",
    value: rawHash("terminal:unrelated-main"),
    updatedAt: at(-5_000),
  }),
]);
const SUCCESSOR_BASELINE_FINANCE = Object.freeze([
  Object.freeze({
    name: "FINANCE_ENTITLEMENT_SYNC_MODE",
    value: rawHash("terminal:finance-mode"),
    updatedAt: at(-5_000),
  }),
  Object.freeze({
    name: "FINANCE_UNRELATED_SECRET",
    value: rawHash("terminal:unrelated-finance"),
    updatedAt: at(-5_000),
  }),
]);
const SUCCESSOR_INSTALLED_MAIN = Object.freeze(SUCCESSOR_BASELINE_MAIN.map(row =>
  Object.freeze({
    ...row,
    ...(SCHEMA3_MUTATION_NAMES.includes(row.name)
      ? { value: SUCCESSOR_MUTATION_DIGESTS[row.name], updatedAt: at(2_500) }
      : {}),
    ...(SUCCESSOR_METADATA_ONLY_NAMES.includes(row.name)
      ? { updatedAt: at(2_600) }
      : {}),
  })));
const SUCCESSOR_DIVERGED_MAIN = Object.freeze(SUCCESSOR_INSTALLED_MAIN.map(row =>
  Object.freeze({
    ...row,
    ...(row.name === SCHEMA3_MUTATION_NAMES[0]
      ? { value: rawHash("successor-diverged-secret-digest") }
      : {}),
  })));
const SUCCESSOR_BASELINE_FUNCTIONS = Object.freeze([
  PURE_EXACT_FUNCTION,
  ...Array.from({ length: 12 }, (_, index) => functionInventoryRow({
    id: `${String(index + 10).padStart(8, "0")}-3333-4333-8333-${String(index + 10).padStart(12, "0")}`,
    slug: `terminal-baseline-${String(index + 1).padStart(2, "0")}`,
    verify_jwt: index % 2 === 0,
    version: index + 2,
    future_cli_field: `stable-${index + 1}`,
  })),
]);
const SUCCESSOR_PLUS_ONE_FUNCTIONS = Object.freeze(
  SUCCESSOR_BASELINE_FUNCTIONS.map(row => Object.freeze({
    ...row,
    version: row.version + 1,
  })),
);

function successorInventoryCanonical(rows) {
  return canonicalJson([...rows].sort((left, right) =>
    left.name.localeCompare(right.name)));
}

function successorFunctionCanonical(rows) {
  return canonicalJson([...rows].sort((left, right) =>
    left.slug.localeCompare(right.slug)));
}

function successorInventorySha(rows) {
  const source = successorInventoryCanonical(rows);
  if (source === successorInventoryCanonical(SUCCESSOR_BASELINE_MAIN)) {
    return TERMINAL_MAIN_INVENTORY_SHA;
  }
  if (source === successorInventoryCanonical(SUCCESSOR_BASELINE_FINANCE)) {
    return TERMINAL_FINANCE_INVENTORY_SHA;
  }
  return sha256(source);
}

function successorFunctionSha(rows) {
  const source = successorFunctionCanonical(rows);
  return source === successorFunctionCanonical(SUCCESSOR_BASELINE_FUNCTIONS)
    ? TERMINAL_FUNCTION_INVENTORY_SHA
    : sha256(source);
}

function semanticInventorySha(rows) {
  return sha256(canonicalJson([...rows]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(row => ({ name: row.name, value: row.value }))));
}

function successorMetadataDelta(before, after) {
  const current = new Map(after.map(row => [row.name, row]));
  const rows = before
    .filter(row => !SCHEMA3_MUTATION_NAMES.includes(row.name))
    .filter(row => current.get(row.name)?.updatedAt !== row.updatedAt)
    .map(row => ({
      name: row.name,
      beforeUpdatedAt: row.updatedAt,
      afterUpdatedAt: current.get(row.name).updatedAt,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze({
    names: Object.freeze(rows.map(row => row.name)),
    sha256: sha256(canonicalJson(rows)),
  });
}

const SUCCESSOR_METADATA_DELTA = successorMetadataDelta(
  SUCCESSOR_BASELINE_MAIN,
  SUCCESSOR_INSTALLED_MAIN,
);
const SUCCESSOR_ADOPTION = Object.freeze({
  kind: "main-finance-runtime-recovery-v3-terminal-diverged-predecessor-adoption",
  priorRootIdentitySha256: rawHash("terminal-diverged-root-identity"),
  priorSourceCommitSha: SUCCESSOR_SOURCE_PARENT,
  priorSourceTreeSha: SUCCESSOR_BASE_TREE,
  priorReleaseProvenanceFileSha256:
    "34089b8041c72f3abcff3f954067ba7c093f66ba1045a51113ec4d81ccff8063",
  priorReleaseProvenanceDescriptorSha256:
    "7ceb2face8c325056b47fb595b801ee4860d27cc0d84816436c55380042972bf",
  priorPlanReceiptSha256:
    "62407763c353d6963561c39dc2d04b572632e400b5cc758958d8b81eaad9b701",
  priorSecretIntentReceiptSha256:
    "838a88db296495c60bfaea378f8c71fb86468cf8b6aefe099ed6e05071d51c79",
  priorSecretResultReceiptSha256:
    "522ced178f2839948f30316d2ae73d9e257385ec1699d0b842218fa49451c677",
  priorFunctionIntentReceiptSha256:
    "ddf741ca072b0bbe45bfa5a0098522facdf8e6b10ec407248195ac7b2faf899b",
  priorFunctionUnknownReceiptSha256:
    "5dbfe3ad4cd84533888c3b73a77ada3864395fadc4ecd58d361bed7d5d8ea64c",
  priorTerminalReceiptSha256:
    "098731b6054f305cb4d211f5658122696400486947dfe31091e5abc937fada0e",
  priorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
  priorBundleAttestationSha256:
    "5f5af08774ad620dc5556fa2083371617db8042fa49055dfebf0844fbe2baddf",
  priorRuntimeFileSha256:
    "932d3fde5f7b98fce9606aebea1b335d41f85cec72afc47a873bf12f1c6e2217",
  generatedSecretNames: Object.freeze([
    "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ]),
  generatedSecretDigestSetSha256:
    "b3014c4eb96cf14c75017f10d3e071285c671f9d1387dcbf48310ca63dd5d211",
  preinstallMainInventorySha256:
    "66a2630aa9c4c17d9e1a894a9a43f201e40913dab20d0f08c161c48ebb0a7c60",
  postSecretMainInventorySha256:
    "133ab45e43e8b5e0a5fa70be4ed4f978d40b27d955140becb9bc54a32d960ce2",
  terminalMainInventorySha256: TERMINAL_MAIN_INVENTORY_SHA,
  stableFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
  preinstallFunctionInventorySha256:
    "e1edfa70f070fc3cf7b207891c33518107ab516378673dcc3cb07e63e5a09faf",
  postSecretFunctionInventorySha256:
    "73c0f50b78516b1fc46dc7f155bf0f737b6967a2913561a6ddb4693d20fdf80b",
  terminalFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
  terminalFunctionCount: 13,
  targetFunctionState: "exact-sole-addition",
  metadataOnlySecretNames: SUCCESSOR_METADATA_ONLY_NAMES,
  stableReadRounds: 2,
  functionDeployAlreadyObserved: true,
  terminalOutcome: "diverged",
  causalAttribution: false,
});
const SUCCESSOR_SOURCE_BINDING = Object.freeze({
  commit: SOURCE_COMMIT,
  tree: SOURCE_TREE,
  parent: SUCCESSOR_SOURCE_PARENT,
  baseTree: SUCCESSOR_BASE_TREE,
  changedPaths: EXPECTED_CHANGED_PATHS,
  changedPathSetSha256: SUCCESSOR_CHANGED_PATH_SET,
  trackedFileCount: 935,
  workflowBlobSha: WORKFLOW_BLOB,
  supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
});
const SUCCESSOR_RELEASE_BINDING = Object.freeze({
  schemaVersion: 3,
  authorizedMutation: "secrets-set",
  functionDeployAuthorized: false,
  manifestSha256: RELEASE_MANIFEST_SHA,
  sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
  futureClockSkewSeconds: 30,
});
const SUCCESSOR_BUNDLE_BINDING = Object.freeze({
  attestationSha256: BUNDLE_ATTESTATION_SHA,
  catalogSha256: PLAN_SNAPSHOT.catalogSha256,
  descriptorSha256: PLAN_SNAPSHOT.descriptorSha256,
  stateSha256: PLAN_SNAPSHOT.stateSha256,
  gateInventorySha256: PLAN_SNAPSHOT.gateInventorySha256,
  privacyInventorySha256: PLAN_SNAPSHOT.privacyInventorySha256,
  checkedCount: PLAN_SNAPSHOT.checkedCount,
  preinstallMainInventorySha256: TERMINAL_MAIN_INVENTORY_SHA,
  preinstallFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
  preinstallFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
  runtimeMutationInputSha256: RUNTIME_INPUT_SHA,
  mutationSecretNameSetSha256: sha256(canonicalJson(SCHEMA3_MUTATION_NAMES)),
  mutationSecretDigestSetSha256: sha256(canonicalJson(
    SUCCESSOR_MUTATION_DIGESTS,
  )),
  productionBoundarySha256: rawHash("successor-production-boundary"),
  targetDescriptorSha256: rawHash("successor-target-descriptor"),
  runtimeCommandArgsSha256: RUNTIME_ARGS_SHA,
  sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
  operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
  predecessorAdoptionSha256: sha256(canonicalJson(SUCCESSOR_ADOPTION)),
});

async function importSuccessorReducerFixtureModule() {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v3-reducer-fixture-",
  ));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { mode: 0o700 });
  const hashOverrides = [
    [successorInventoryCanonical(SUCCESSOR_BASELINE_MAIN),
      TERMINAL_MAIN_INVENTORY_SHA],
    [successorInventoryCanonical(SUCCESSOR_BASELINE_FINANCE),
      TERMINAL_FINANCE_INVENTORY_SHA],
    [successorFunctionCanonical(SUCCESSOR_BASELINE_FUNCTIONS),
      TERMINAL_FUNCTION_INVENTORY_SHA],
  ];
  const shaMarker = `export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}`;
  const operatorSource = readFileSync(OPERATOR_FILE, "utf8");
  assert.equal(operatorSource.split(shaMarker).length, 2);
  const instrumentedSource = operatorSource.replace(shaMarker, `const TEST_SHA256_OVERRIDES = new Map(${JSON.stringify(hashOverrides)});

export function sha256(value) {
  return TEST_SHA256_OVERRIDES.get(value)
    ?? createHash("sha256").update(value).digest("hex");
}`);
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    instrumentedSource,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  const module = await import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
  return { module, parent };
}

const successorReducerFixture = await importSuccessorReducerFixtureModule();
after(() => rmSync(successorReducerFixture.parent, {
  recursive: true,
  force: true,
}));

function appendSuccessorFixture(chain, fields, authority = null) {
  const core = {
    ...fields,
    schemaVersion: 3,
    sequence: chain.length + 1,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
    productionDenied: true,
  };
  const receipt = Object.freeze({
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  });
  if (authority !== null) {
    assert.equal(authority.authorizedReceiptSha256, receipt.receiptSha256);
    assert.equal(authority.payloadSha256, sha256(canonicalJson(fields)));
  }
  chain.push(receipt);
  return receipt;
}

function successorPlanFields(recordedAt = at(1_000)) {
  const plusOneSha256 = successorFunctionSha(SUCCESSOR_PLUS_ONE_FUNCTIONS);
  return {
    kind: "release-plan",
    status: "pending",
    environment: "staging",
    recordedAt,
    expiresAt: at(201_000),
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    sourceParentSha: SUCCESSOR_SOURCE_PARENT,
    baseTreeSha: SUCCESSOR_BASE_TREE,
    changedPaths: EXPECTED_CHANGED_PATHS,
    changedPathSetSha256: SUCCESSOR_CHANGED_PATH_SET,
    trackedFileCount: 935,
    workflowBlobSha: WORKFLOW_BLOB,
    sourceCiRunId: RUN_ID,
    sourceCiRunApiSha256: CI_BINDING.runApiSha256,
    sourceCiJobsApiSha256: CI_BINDING.jobsApiSha256,
    sourceCiBranchApiSha256: CI_BINDING.branchApiSha256,
    sourceProvenanceFileSha256: PROVENANCE_FILE_SHA,
    sourceProvenanceDescriptorSha256: PROVENANCE_DESCRIPTOR_SHA,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
    bundleAttestationSha256: BUNDLE_ATTESTATION_SHA,
    sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
    supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
    operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
    runtimeMutationInputSha256: RUNTIME_INPUT_SHA,
    runtimeCommandArgsSha256: RUNTIME_ARGS_SHA,
    productionBoundarySha256:
      SUCCESSOR_BUNDLE_BINDING.productionBoundarySha256,
    targetDescriptorSha256: SUCCESSOR_BUNDLE_BINDING.targetDescriptorSha256,
    mainInventorySha256: TERMINAL_MAIN_INVENTORY_SHA,
    financeInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    functionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
    functionVersionTransition: {
      beforeFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
      unchangedFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
      exactAllExistingPlusOneFunctionInventorySha256: plusOneSha256,
      currentStageFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
      currentStageDisposition: "unchanged",
      currentStageExactAllExistingPlusOneFunctionInventorySha256: plusOneSha256,
      existingFunctionCount: 13,
      allowedDispositions: ["unchanged", "exact-all-existing-plus-one"],
      allOtherFieldsUnchanged: true,
      stableReadRounds: 2,
    },
    predecessorAdoption: SUCCESSOR_ADOPTION,
    snapshot: PLAN_SNAPSHOT,
    mutationScope: "secrets-set",
    resumeFromReceiptSha256: null,
    hostedMutationCount: 0,
    productionTouched: false,
    semanticMainInventorySha256:
      semanticInventorySha(SUCCESSOR_BASELINE_MAIN),
    mutationSecretNames: SCHEMA3_MUTATION_NAMES,
    mutationSecretNameSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretNameSetSha256,
    mutationSecretDigestSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretDigestSetSha256,
    metadataOnlySecretNames: SUCCESSOR_METADATA_ONLY_NAMES,
    metadataOnlySecretNameSetSha256:
      sha256(canonicalJson(SUCCESSOR_METADATA_ONLY_NAMES)),
    predecessorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
    functionAllExistingPlusOneSha256: plusOneSha256,
    plannedHostedMutationCount: 1,
    functionDeployCount: 0,
  };
}

function successorIntentFields(plan, recordedAt = at(2_000)) {
  return {
    kind: "mutation-intent",
    mutation: "secrets-set",
    status: "pending",
    environment: "staging",
    recordedAt,
    planReceiptSha256: plan.receiptSha256,
    beforeMainInventorySha256: TERMINAL_MAIN_INVENTORY_SHA,
    beforeFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    beforeFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
    unchangedFunctionInventorySha256: TERMINAL_FUNCTION_INVENTORY_SHA,
    exactAllExistingPlusOneFunctionInventorySha256:
      plan.functionAllExistingPlusOneSha256,
    requiredStableReadRounds: 2,
    predecessorAdoptionSha256:
      SUCCESSOR_BUNDLE_BINDING.predecessorAdoptionSha256,
    expectedSecretDigestSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretDigestSetSha256,
    secretNames: SCHEMA3_MUTATION_NAMES,
    semanticBeforeMainInventorySha256:
      semanticInventorySha(SUCCESSOR_BASELINE_MAIN),
    mutationSecretNameSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretNameSetSha256,
    metadataOnlySecretNameSetSha256:
      sha256(canonicalJson(SUCCESSOR_METADATA_ONLY_NAMES)),
    predecessorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
    functionAllExistingPlusOneSha256:
      plan.functionAllExistingPlusOneSha256,
    hostedMutationCount: 0,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function successorCommandPayload() {
  return {
    kind: "main-finance-runtime-recovery-v2-command",
    mutation: "secrets-set",
    projectRef: MAIN_REF,
    sourceDeploymentSha256: SOURCE_DEPLOYMENT_SHA,
    mutationInputSha256: RUNTIME_INPUT_SHA,
    argsSha256: RUNTIME_ARGS_SHA,
  };
}

function successorVerifiedResultFields(
  intent,
  functions,
  disposition,
  recordedAt = at(3_000),
) {
  return {
    kind: "mutation-result",
    mutation: "secrets-set",
    status: "verified",
    environment: "staging",
    recordedAt,
    intentReceiptSha256: intent.receiptSha256,
    afterMainInventorySha256: successorInventorySha(SUCCESSOR_INSTALLED_MAIN),
    afterFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    afterFunctionInventorySha256: successorFunctionSha(functions),
    functionVersionTransitionDisposition: disposition,
    functionInventoryStableReadRounds: 2,
    predecessorAdoptionSha256:
      SUCCESSOR_BUNDLE_BINDING.predecessorAdoptionSha256,
    observation: "installed_observed",
    state: "state_satisfied",
    causalAttribution: false,
    semanticAfterMainInventorySha256:
      semanticInventorySha(SUCCESSOR_INSTALLED_MAIN),
    metadataOnlyDeltaNames: SUCCESSOR_METADATA_DELTA.names,
    metadataOnlyDeltaSha256: SUCCESSOR_METADATA_DELTA.sha256,
    mutationSecretNames: SCHEMA3_MUTATION_NAMES,
    mutationSecretNameSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretNameSetSha256,
    mutationSecretDigestSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretDigestSetSha256,
    predecessorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
    functionAllExistingPlusOneSha256:
      successorFunctionSha(SUCCESSOR_PLUS_ONE_FUNCTIONS),
    hostedMutationCount: 1,
    functionDeployCount: 0,
    reconcileRequired: false,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function successorUnknownResultFields(intent, recordedAt = at(3_000)) {
  return {
    kind: "mutation-result",
    mutation: "secrets-set",
    status: "unknown",
    environment: "staging",
    recordedAt,
    intentReceiptSha256: intent.receiptSha256,
    responseStatus: null,
    reconcileRequired: true,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function successorReconciliationFields(
  unresolved,
  outcome,
  main,
  functions,
  functionDisposition,
  recordedAt = at(4_000),
) {
  const delta = outcome === "diverged"
    ? null
    : successorMetadataDelta(SUCCESSOR_BASELINE_MAIN, main);
  return {
    kind: "reconciliation",
    mutation: "secrets-set",
    outcome,
    environment: "staging",
    recordedAt,
    unresolvedReceiptSha256: unresolved.receiptSha256,
    mainInventorySha256: successorInventorySha(main),
    financeInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    functionInventorySha256: successorFunctionSha(functions),
    hostedProofSha256: null,
    hostedD0ResponseSha256: null,
    observation: outcome === "state_satisfied"
      ? "installed_observed"
      : (outcome === "state_unsatisfied" ? "baseline_observed" : "diverged"),
    state: outcome,
    causalAttribution: false,
    functionVersionTransitionDisposition: functionDisposition,
    inventoryReadRounds: 2,
    stableObservation: true,
    predecessorAdoptionSha256:
      SUCCESSOR_BUNDLE_BINDING.predecessorAdoptionSha256,
    semanticMainInventorySha256: semanticInventorySha(main),
    metadataOnlyDeltaNames: delta?.names ?? null,
    metadataOnlyDeltaSha256: delta?.sha256 ?? null,
    mutationSecretNames: SCHEMA3_MUTATION_NAMES,
    mutationSecretNameSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretNameSetSha256,
    mutationSecretDigestSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretDigestSetSha256,
    predecessorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
    functionAllExistingPlusOneSha256:
      successorFunctionSha(SUCCESSOR_PLUS_ONE_FUNCTIONS),
    hostedMutationCount: 0,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function successorPostflightFixture({
  functions,
  d0Clock = at(5_000),
  proofClock = at(6_000),
  d1Clock = at(7_000),
  label = "successor-completion",
} = {}) {
  const base = postflightFixture({
    main: SUCCESSOR_INSTALLED_MAIN,
    finance: SUCCESSOR_BASELINE_FINANCE,
    functions,
    d0Clock,
    proofClock,
    d1Clock,
    proofSha256: rawHash(`${label}:proof`),
    d0ResponseLabel: `${label}:d0`,
    d1ResponseLabel: `${label}:d1`,
  });
  return Object.freeze({
    ...base,
    d0MainInventorySha256: successorInventorySha(SUCCESSOR_INSTALLED_MAIN),
    d0FinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    d0FunctionInventorySha256: successorFunctionSha(functions),
    d1MainInventorySha256: successorInventorySha(SUCCESSOR_INSTALLED_MAIN),
    d1FinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
    d1FunctionInventorySha256: successorFunctionSha(functions),
  });
}

function successorCompletionFields(
  plan,
  cause,
  postflight,
  recordedAt = at(8_000),
) {
  return {
    kind: "release-complete",
    status: "verified",
    environment: "staging",
    recordedAt,
    mainProjectRef: MAIN_REF,
    financeProjectRef: FINANCE_REF,
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    sourceParentSha: SUCCESSOR_SOURCE_PARENT,
    baseTreeSha: SUCCESSOR_BASE_TREE,
    changedPaths: EXPECTED_CHANGED_PATHS,
    changedPathSetSha256: SUCCESSOR_CHANGED_PATH_SET,
    trackedFileCount: 935,
    workflowPath: ".github/workflows/verify-finance-integration.yml",
    workflowBlobSha: WORKFLOW_BLOB,
    sourceCiRunId: RUN_ID,
    sourceCiRunApiSha256: CI_BINDING.runApiSha256,
    sourceCiJobsApiSha256: CI_BINDING.jobsApiSha256,
    sourceCiBranchApiSha256: CI_BINDING.branchApiSha256,
    sourceCiConclusion: "success",
    sourceProvenanceFileSha256: PROVENANCE_FILE_SHA,
    sourceProvenanceDescriptorSha256: PROVENANCE_DESCRIPTOR_SHA,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    deploymentClosureSha256: SOURCE_DEPLOYMENT_SHA,
    sourceArchiveSha256: SOURCE_ARCHIVE_SHA,
    supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
    operatorDescriptorFileSha256: OPERATOR_DESCRIPTOR_FILE_SHA,
    productionBoundarySha256: plan.productionBoundarySha256,
    targetDescriptorSha256: plan.targetDescriptorSha256,
    functionInventorySha256: postflight.d1FunctionInventorySha256,
    causalHostedProofSha256: null,
    d0: postflight.d0,
    hostedProof: postflight.proof,
    d1: postflight.d1,
    d0MainInventorySha256: postflight.d0MainInventorySha256,
    d0FinanceInventorySha256: postflight.d0FinanceInventorySha256,
    d0FunctionInventorySha256: postflight.d0FunctionInventorySha256,
    d1MainInventorySha256: postflight.d1MainInventorySha256,
    d1FinanceInventorySha256: postflight.d1FinanceInventorySha256,
    d1FunctionInventorySha256: postflight.d1FunctionInventorySha256,
    completionCauseReceiptSha256: cause.receiptSha256,
    semanticMainInventorySha256:
      semanticInventorySha(SUCCESSOR_INSTALLED_MAIN),
    metadataOnlyDeltaNames: SUCCESSOR_METADATA_DELTA.names,
    metadataOnlyDeltaSha256: SUCCESSOR_METADATA_DELTA.sha256,
    mutationSecretNames: SCHEMA3_MUTATION_NAMES,
    mutationSecretNameSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretNameSetSha256,
    mutationSecretDigestSetSha256:
      SUCCESSOR_BUNDLE_BINDING.mutationSecretDigestSetSha256,
    predecessorReceiptChainSha256: TERMINAL_RECEIPT_CHAIN_SHA,
    functionAllExistingPlusOneSha256:
      successorFunctionSha(SUCCESSOR_PLUS_ONE_FUNCTIONS),
    hostedMutationCount: 1,
    functionDeployCount: 0,
    automaticRetryPerformed: false,
    productionTouched: false,
  };
}

function successorTransition(chain, {
  action = "plan",
  checkpoint = "request",
  now = at(1_000),
  mutation = "none",
  mutationOutcome = "none",
  main = SUCCESSOR_BASELINE_MAIN,
  functions = SUCCESSOR_BASELINE_FUNCTIONS,
  approval,
  observationEvidence,
  postflightEvidence = null,
  effectPayload = null,
} = {}) {
  const plan = [...chain].reverse().find(receipt => receipt.kind === "release-plan");
  const effectiveApproval = approval === undefined
    && action === "apply"
    && checkpoint !== "after-mutation"
    ? approvalFor(plan)
    : (approval ?? null);
  const effectiveObservation = observationEvidence !== undefined
    ? observationEvidence
    : (action === "reconcile" ? {
      inventoryReadRounds: 2,
      stableObservation: true,
      firstMainInventorySha256: successorInventorySha(main),
      firstFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
      firstFunctionInventorySha256: successorFunctionSha(functions),
      secondMainInventorySha256: successorInventorySha(main),
      secondFinanceInventorySha256: TERMINAL_FINANCE_INVENTORY_SHA,
      secondFunctionInventorySha256: successorFunctionSha(functions),
    } : null);
  return successorReducerFixture.module
    .evaluateMainFinanceRuntimeRecoveryV2State({
      action,
      checkpoint,
      operationBinding: {
        expectedSha256: OPERATION_BINDING,
        currentSha256: OPERATION_BINDING,
      },
      chain,
      release: SUCCESSOR_RELEASE_BINDING,
      source: SUCCESSOR_SOURCE_BINDING,
      provenance: PROVENANCE_BINDING,
      ci: CI_BINDING,
      bundle: SUCCESSOR_BUNDLE_BINDING,
      approval: effectiveApproval,
      now,
      mutation,
      mutationOutcome,
      secretEvidence: {
        preinstallMain: SUCCESSOR_BASELINE_MAIN,
        preinstallFinance: SUCCESSOR_BASELINE_FINANCE,
        currentMain: main,
        currentFinance: SUCCESSOR_BASELINE_FINANCE,
        expectedDigests: SUCCESSOR_MUTATION_DIGESTS,
        secretNames: SCHEMA3_MUTATION_NAMES,
        metadataOnlyNames: SUCCESSOR_METADATA_ONLY_NAMES,
      },
      functionEvidence: {
        preinstallRows: SUCCESSOR_BASELINE_FUNCTIONS,
        currentRows: functions,
        successorBaseline: true,
      },
      mutationInputEvidence: action === "apply" && mutation === "secrets-set"
        ? {
          expectedSha256: RUNTIME_INPUT_SHA,
          currentSha256: RUNTIME_INPUT_SHA,
        }
        : null,
      observationEvidence: effectiveObservation,
      postflightEvidence,
      effectPayload,
    });
}

test("schema-3 reducer completes and verifies both exact allowed Function outcomes", () => {
  assert.equal(successorInventorySha(SUCCESSOR_BASELINE_MAIN),
    TERMINAL_MAIN_INVENTORY_SHA);
  assert.equal(successorInventorySha(SUCCESSOR_BASELINE_FINANCE),
    TERMINAL_FINANCE_INVENTORY_SHA);
  assert.equal(successorFunctionSha(SUCCESSOR_BASELINE_FUNCTIONS),
    TERMINAL_FUNCTION_INVENTORY_SHA);
  assert.deepEqual(SUCCESSOR_SOURCE_BINDING.changedPaths, EXPECTED_CHANGED_PATHS);
  assert.equal(SUCCESSOR_SOURCE_BINDING.changedPaths.length, 13);
  const downgradedPlanPayload = successorPlanFields();
  const downgradedPlanCore = {
    ...downgradedPlanPayload,
    schemaVersion: 2,
    sequence: 1,
    previousReceiptSha256: null,
    productionDenied: true,
  };
  const downgradedPlan = {
    ...downgradedPlanCore,
    receiptSha256: sha256(canonicalJson(downgradedPlanCore)),
  };
  assert.throws(() => successorTransition([downgradedPlan], {
    action: "apply",
    checkpoint: "before-intent",
    now: at(2_000),
    mutation: "secrets-set",
    effectPayload: null,
  }), /secrets-only successor release plan evidence differs/u);
  assert.throws(() => successorTransition([], {
    action: "plan",
    checkpoint: "request",
    now: downgradedPlanPayload.recordedAt,
    effectPayload: { ...downgradedPlanPayload, unexpectedAuthority: true },
  }), /release-plan receipt keys differ/u);

  for (const [label, functions, disposition] of [
    ["unchanged", SUCCESSOR_BASELINE_FUNCTIONS, "unchanged"],
    ["all-existing-plus-one", SUCCESSOR_PLUS_ONE_FUNCTIONS,
      "exact-all-existing-plus-one"],
  ]) {
    const chain = [];
    const effects = [];
    const planPayload = successorPlanFields();
    const planAuthority = successorTransition(chain, {
      action: "plan",
      checkpoint: "request",
      now: planPayload.recordedAt,
      effectPayload: planPayload,
    });
    effects.push(planAuthority.effect);
    assertTransition(planAuthority, "issue-plan", "append-release-plan",
      "secrets-set");
    const plan = appendSuccessorFixture(chain, planPayload, planAuthority);
    assert.equal(plan.mainInventorySha256, TERMINAL_MAIN_INVENTORY_SHA);
    assert.equal(plan.financeInventorySha256, TERMINAL_FINANCE_INVENTORY_SHA);
    assert.equal(plan.functionInventorySha256, TERMINAL_FUNCTION_INVENTORY_SHA);
    assert.equal(plan.plannedHostedMutationCount, 1);
    assert.equal(plan.functionDeployCount, 0);
    assert.equal(Object.hasOwn(plan, "deployMutationInputSha256"), false);
    assert.equal(Object.hasOwn(plan, "deployCommandArgsSha256"), false);

    const intentPayload = successorIntentFields(plan);
    const intentAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "before-intent",
      now: intentPayload.recordedAt,
      mutation: "secrets-set",
      effectPayload: intentPayload,
    });
    effects.push(intentAuthority.effect);
    assertTransition(intentAuthority, "record-mutation-intent",
      "append-mutation-intent", "secrets-set", "secrets-set");
    const intent = appendSuccessorFixture(chain, intentPayload, intentAuthority);
    assert.deepEqual(intent.secretNames, SCHEMA3_MUTATION_NAMES);
    assert.equal(intent.secretNames.length, 3);
    assert.equal(intent.hostedMutationCount, 0);
    assert.equal(intent.functionDeployCount, 0);

    const invokeAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "before-mutation",
      now: at(2_500),
      mutation: "secrets-set",
      effectPayload: successorCommandPayload(),
    });
    effects.push(invokeAuthority.effect);
    assertTransition(invokeAuthority, "authorize-cli-invocation",
      "invoke-secrets-set", "secrets-set", "secrets-set");

    const resultPayload = successorVerifiedResultFields(
      intent,
      functions,
      disposition,
    );
    if (label === "unchanged") {
      assert.throws(() => successorTransition(chain, {
        action: "apply",
        checkpoint: "after-mutation",
        now: resultPayload.recordedAt,
        mutation: "secrets-set",
        mutationOutcome: "success",
        main: SUCCESSOR_INSTALLED_MAIN,
        functions,
        effectPayload: { ...resultPayload, unexpectedAuthority: true },
      }), /mutation-result receipt keys differ/u);
    }
    const resultAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "after-mutation",
      now: resultPayload.recordedAt,
      mutation: "secrets-set",
      mutationOutcome: "success",
      main: SUCCESSOR_INSTALLED_MAIN,
      functions,
      effectPayload: resultPayload,
    });
    effects.push(resultAuthority.effect);
    assertTransition(resultAuthority, "secrets-verified",
      "append-verified-mutation-result");
    const result = appendSuccessorFixture(
      chain,
      resultPayload,
      resultAuthority,
    );
    assert.equal(result.functionVersionTransitionDisposition, disposition);
    assert.equal(result.hostedMutationCount, 1);
    assert.equal(result.functionDeployCount, 0);
    assert.equal(result.causalAttribution, false);
    assert.deepEqual(result.metadataOnlyDeltaNames,
      SUCCESSOR_METADATA_ONLY_NAMES);

    const completionPostflight = successorPostflightFixture({
      functions,
      label: `verified-${label}`,
    });
    const completionPayload = successorCompletionFields(
      plan,
      result,
      completionPostflight,
    );
    const completionAuthority = successorTransition(chain, {
      action: "complete",
      checkpoint: "before-completion",
      now: completionPayload.recordedAt,
      main: SUCCESSOR_INSTALLED_MAIN,
      functions,
      postflightEvidence: completionPostflight,
      effectPayload: completionPayload,
    });
    effects.push(completionAuthority.effect);
    assertTransition(completionAuthority, "release-complete-eligible",
      "append-release-complete");
    const complete = appendSuccessorFixture(
      chain,
      completionPayload,
      completionAuthority,
    );
    assert.equal(complete.completionCauseReceiptSha256, result.receiptSha256);
    assert.equal(complete.causalHostedProofSha256, null);
    assert.equal(complete.hostedMutationCount, 1);
    assert.equal(complete.functionDeployCount, 0);
    if (label === "unchanged") {
      const { receiptSha256: ignored, ...downgradedCompleteCore } = complete;
      const downgradedComplete = {
        ...downgradedCompleteCore,
        schemaVersion: 2,
      };
      downgradedComplete.receiptSha256 = sha256(canonicalJson(
        downgradedComplete,
      ));
      assert.throws(() => successorTransition([
        ...chain.slice(0, -1),
        downgradedComplete,
      ], {
        action: "verify",
        checkpoint: "request",
        now: at(12_000),
        main: SUCCESSOR_INSTALLED_MAIN,
        functions,
        postflightEvidence: successorPostflightFixture({
          functions,
          d0Clock: at(9_000),
          proofClock: at(10_000),
          d1Clock: at(11_000),
          label: "downgraded-complete",
        }),
        effectPayload: null,
      }), /release completion causal binding differs/u);
    }

    const verificationPostflight = successorPostflightFixture({
      functions,
      d0Clock: at(9_000),
      proofClock: at(10_000),
      d1Clock: at(11_000),
      label: `verify-${label}`,
    });
    const verifyAuthority = successorTransition(chain, {
      action: "verify",
      checkpoint: "request",
      now: at(12_000),
      main: SUCCESSOR_INSTALLED_MAIN,
      functions,
      postflightEvidence: verificationPostflight,
      effectPayload: null,
    });
    effects.push(verifyAuthority.effect);
    assertTransition(verifyAuthority, "verification-evidence-consistent", "none");
    assert.equal(chain.length, 4);
    assert.equal(chain.at(-1).kind, "release-complete");
    assert.equal(effects.includes("invoke-function-deploy"), false);
    assert.deepEqual(effects.filter(effect => effect.startsWith("invoke-")), [
      "invoke-secrets-set",
    ]);
  }
});

test("schema-3 reducer reconciles unknown once and makes unsatisfied or diverged states terminal", () => {
  const buildUnknownChain = () => {
    const chain = [];
    const effects = [];
    const planPayload = successorPlanFields();
    const planAuthority = successorTransition(chain, {
      action: "plan",
      checkpoint: "request",
      now: planPayload.recordedAt,
      effectPayload: planPayload,
    });
    effects.push(planAuthority.effect);
    const plan = appendSuccessorFixture(chain, planPayload, planAuthority);
    const intentPayload = successorIntentFields(plan);
    const intentAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "before-intent",
      now: intentPayload.recordedAt,
      mutation: "secrets-set",
      effectPayload: intentPayload,
    });
    effects.push(intentAuthority.effect);
    const intent = appendSuccessorFixture(chain, intentPayload, intentAuthority);
    const invokeAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "before-mutation",
      now: at(2_500),
      mutation: "secrets-set",
      effectPayload: successorCommandPayload(),
    });
    effects.push(invokeAuthority.effect);
    assertTransition(invokeAuthority, "authorize-cli-invocation",
      "invoke-secrets-set", "secrets-set", "secrets-set");
    const unknownPayload = successorUnknownResultFields(intent);
    const unknownAuthority = successorTransition(chain, {
      action: "apply",
      checkpoint: "after-mutation",
      now: unknownPayload.recordedAt,
      mutation: "secrets-set",
      mutationOutcome: "unknown",
      effectPayload: unknownPayload,
    });
    effects.push(unknownAuthority.effect);
    assertTransition(unknownAuthority, "reconcile-required",
      "append-unknown-result", "secrets-set", "secrets-set");
    const unknown = appendSuccessorFixture(
      chain,
      unknownPayload,
      unknownAuthority,
    );
    assert.equal(unknown.schemaVersion, 3);
    assert.equal(unknown.reconcileRequired, true);
    return { chain, effects, plan, unknown };
  };

  const satisfied = buildUnknownChain();
  const { receiptSha256: ignoredUnknown, ...downgradedUnknownCore } =
    satisfied.unknown;
  const downgradedUnknown = {
    ...downgradedUnknownCore,
    schemaVersion: 2,
  };
  downgradedUnknown.receiptSha256 = sha256(canonicalJson(downgradedUnknown));
  assert.throws(() => successorTransition([
    ...satisfied.chain.slice(0, -1),
    downgradedUnknown,
  ], {
    action: "reconcile",
    checkpoint: "after-mutation",
    now: at(4_000),
    mutation: "secrets-set",
    main: SUCCESSOR_INSTALLED_MAIN,
    functions: SUCCESSOR_BASELINE_FUNCTIONS,
    effectPayload: null,
  }), /secrets-only mutation result schema differs/u);
  const satisfiedPayload = successorReconciliationFields(
    satisfied.unknown,
    "state_satisfied",
    SUCCESSOR_INSTALLED_MAIN,
    SUCCESSOR_PLUS_ONE_FUNCTIONS,
    "exact-all-existing-plus-one",
  );
  const satisfiedAuthority = successorTransition(satisfied.chain, {
    action: "reconcile",
    checkpoint: "after-mutation",
    now: satisfiedPayload.recordedAt,
    mutation: "secrets-set",
    main: SUCCESSOR_INSTALLED_MAIN,
    functions: SUCCESSOR_PLUS_ONE_FUNCTIONS,
    effectPayload: satisfiedPayload,
  });
  satisfied.effects.push(satisfiedAuthority.effect);
  assertTransition(satisfiedAuthority, "reconcile-state-satisfied",
    "append-reconciliation", null, null, "state_satisfied");
  const reconciliation = appendSuccessorFixture(
    satisfied.chain,
    satisfiedPayload,
    satisfiedAuthority,
  );
  assert.equal(reconciliation.hostedMutationCount, 0);
  assert.equal(reconciliation.functionDeployCount, 0);
  assert.equal(reconciliation.causalAttribution, false);
  const completionPostflight = successorPostflightFixture({
    functions: SUCCESSOR_PLUS_ONE_FUNCTIONS,
    label: "reconciled-completion",
  });
  const completionPayload = successorCompletionFields(
    satisfied.plan,
    reconciliation,
    completionPostflight,
  );
  const completionAuthority = successorTransition(satisfied.chain, {
    action: "complete",
    checkpoint: "before-completion",
    now: completionPayload.recordedAt,
    main: SUCCESSOR_INSTALLED_MAIN,
    functions: SUCCESSOR_PLUS_ONE_FUNCTIONS,
    postflightEvidence: completionPostflight,
    effectPayload: completionPayload,
  });
  satisfied.effects.push(completionAuthority.effect);
  assertTransition(completionAuthority, "release-complete-eligible",
    "append-release-complete");
  const complete = appendSuccessorFixture(
    satisfied.chain,
    completionPayload,
    completionAuthority,
  );
  assert.equal(complete.completionCauseReceiptSha256,
    reconciliation.receiptSha256);
  assert.equal(complete.hostedMutationCount, 1);
  assert.equal(complete.functionDeployCount, 0);
  assert.equal(satisfied.effects.includes("invoke-function-deploy"), false);
  assert.deepEqual(satisfied.effects.filter(effect => effect.startsWith("invoke-")), [
    "invoke-secrets-set",
  ]);

  const terminalCases = [
    {
      outcome: "state_unsatisfied",
      main: SUCCESSOR_BASELINE_MAIN,
      functions: SUCCESSOR_BASELINE_FUNCTIONS,
      disposition: "unchanged",
    },
    {
      outcome: "diverged",
      main: SUCCESSOR_INSTALLED_MAIN,
      functions: SUCCESSOR_PLUS_ONE_FUNCTIONS.map((row, index) =>
        index === 0 ? SUCCESSOR_BASELINE_FUNCTIONS[index] : row),
      disposition: "diverged",
    },
    {
      outcome: "diverged",
      main: SUCCESSOR_DIVERGED_MAIN,
      functions: SUCCESSOR_BASELINE_FUNCTIONS,
      disposition: "diverged",
    },
  ];
  for (const terminalCase of terminalCases) {
    const state = buildUnknownChain();
    const payload = successorReconciliationFields(
      state.unknown,
      terminalCase.outcome,
      terminalCase.main,
      terminalCase.functions,
      terminalCase.disposition,
    );
    const authority = successorTransition(state.chain, {
      action: "reconcile",
      checkpoint: "after-mutation",
      now: payload.recordedAt,
      mutation: "secrets-set",
      main: terminalCase.main,
      functions: terminalCase.functions,
      effectPayload: payload,
    });
    state.effects.push(authority.effect);
    assertTransition(
      authority,
      `reconcile-${terminalCase.outcome.replace("_", "-")}`,
      "append-reconciliation",
      null,
      null,
      terminalCase.outcome,
    );
    const terminal = appendSuccessorFixture(state.chain, payload, authority);
    assert.equal(terminal.outcome, terminalCase.outcome);
    assert.equal(terminal.hostedMutationCount, 0);
    assert.equal(terminal.functionDeployCount, 0);
    assert.equal(terminal.automaticRetryPerformed, false);
    assert.equal(state.effects.includes("invoke-function-deploy"), false);
    assert.deepEqual(state.effects.filter(effect => effect.startsWith("invoke-")), [
      "invoke-secrets-set",
    ]);
    assert.throws(() => successorTransition(state.chain, {
      action: "plan",
      checkpoint: "request",
      now: at(5_000),
      main: terminalCase.main,
      functions: terminalCase.functions,
      effectPayload: null,
    }), /refused/u);
    assert.throws(() => successorTransition(state.chain, {
      action: "apply",
      checkpoint: "before-mutation",
      now: at(5_000),
      mutation: "function-deploy",
      main: terminalCase.main,
      functions: terminalCase.functions,
      effectPayload: {
        ...successorCommandPayload(),
        mutation: "function-deploy",
      },
    }), /schema-3 secrets-set only/u);
  }

  const hostile = buildUnknownChain();
  const hostilePayload = successorReconciliationFields(
    hostile.unknown,
    "diverged",
    SUCCESSOR_DIVERGED_MAIN,
    SUCCESSOR_BASELINE_FUNCTIONS,
    "unchanged",
  );
  assert.equal(hostilePayload.stableObservation, true);
  assert.throws(() => successorTransition(hostile.chain, {
    action: "reconcile",
    checkpoint: "after-mutation",
    now: hostilePayload.recordedAt,
    mutation: "secrets-set",
    main: SUCCESSOR_DIVERGED_MAIN,
    functions: SUCCESSOR_BASELINE_FUNCTIONS,
    effectPayload: hostilePayload,
  }), /amended secret reconciliation observation evidence differs/u);
});

const V4_INITIAL_MAIN_SHA =
  "3cb8a92d36e5ef9ced75e21200339d9538d54ecce4de50703cf99ddb0cadfa37";
const V4_INITIAL_SEMANTIC_MAIN_SHA =
  "6ca2371545e0ec957e05ae64adf6cadf1dfda3f4618833b755bd783371d8352d";
const V4_FINANCE_SHA =
  "89e6947c4e347081737ec51c198fabfea43a39e9d30a6a851e23ad7435a77c9e";
const V4_INITIAL_FUNCTION_SHA =
  "0efefe20bb441b2f5ce1eafd9fe401e47f4cea793c9e6fa834cc6fbc87afd936";
const V4_HOSTED_SOURCE_CLOSURE_SHA =
  "b3b4177ac01f44a2bb27e8ed81f98fcf00dcddbc0e6a3e4f897eab5d903c11c9";
const V4_SOURCE_PARENT = "42c647aaeb3a6cededb49f073ac001678dcb3582";
const V4_BASE_TREE = "dd05940dbc3f06e8577a6406c6e64e470049c818";
const V4_TARGET_ID = "22222222-2222-4222-8222-222222222222";
const V4_OPERATOR_SECRET = Buffer.alloc(48, 4).toString("base64url");
const V4_TRIGGER_SECRET = Buffer.alloc(48, 5).toString("base64url");
const V4_MANIFEST_SOURCE = readFileSync(MANIFEST_FILE, "utf8");
const V4_MANIFEST = Object.freeze(JSON.parse(V4_MANIFEST_SOURCE));
const V4_MANIFEST_SHA = sha256(V4_MANIFEST_SOURCE);
const V4_SOURCE_DEPLOYMENT_SHA = V4_MANIFEST.deploymentClosureSetSha256;
const V4_SEALED_SUPABASE_FIXTURE_BYTES = Buffer.from(
  "main-finance-schema4-test-sealed-supabase-cli\n",
  "utf8",
);
const V4_RELEASE_FIXTURE = Object.freeze({
  manifest: V4_MANIFEST,
  manifestSha256: V4_MANIFEST_SHA,
});

const V4_MAIN_BEFORE_ROWS = Object.freeze([
  ...SUCCESSOR_MUTATION_NAMES.map(name => Object.freeze({
    name,
    value: rawHash(`v4-before:${name}`),
    updatedAt: at(-20_000),
  })),
  ...SUCCESSOR_METADATA_ONLY_NAMES.map(name => Object.freeze({
    name,
    value: rawHash(`v4-stable:${name}`),
    updatedAt: at(-20_000),
  })),
  Object.freeze({
    name: "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
    value: rawHash("v4-generated:operator"),
    updatedAt: at(-20_000),
  }),
  Object.freeze({
    name: "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
    value: rawHash("v4-generated:trigger"),
    updatedAt: at(-20_000),
  }),
].sort((left, right) => left.name.localeCompare(right.name)));

const V4_MUTATION_DIGESTS = Object.freeze({
  MAIN_FINANCE_ACCESS_V2_SOURCE_DEPLOYMENT_SHA256:
    sha256(V4_SOURCE_DEPLOYMENT_SHA),
  MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA: sha256(SOURCE_COMMIT),
  MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA: sha256(SOURCE_TREE),
  MAIN_FINANCE_ACCESS_V2_SOURCE_MANIFEST_SHA256: sha256(V4_MANIFEST_SHA),
});

const V4_MAIN_AFTER_ROWS = Object.freeze(V4_MAIN_BEFORE_ROWS.map(row => Object.freeze({
  ...row,
  ...(SUCCESSOR_MUTATION_NAMES.includes(row.name) ? {
    value: V4_MUTATION_DIGESTS[row.name],
    updatedAt: at(30_000),
  } : {}),
  ...(SUCCESSOR_METADATA_ONLY_NAMES.includes(row.name) ? {
    updatedAt: at(30_100),
  } : {}),
})));

const V4_FINANCE_ROWS = Object.freeze([Object.freeze({
  name: "FINANCE_ENTITLEMENT_SYNC_MODE",
  value: rawHash("v4-finance-stable"),
  updatedAt: at(-20_000),
})]);

const V4_TARGET_BEFORE = functionInventoryRow({
  id: V4_TARGET_ID,
  slug: "finance-manage-access-v2",
  verify_jwt: false,
  version: 2,
  import_map_path: "file:///tmp/predecessor/deno.json",
});
const V4_FUNCTIONS_BEFORE = Object.freeze([
  V4_TARGET_BEFORE,
  ...Array.from({ length: 12 }, (_, index) => functionInventoryRow({
    id: `${String(index + 30).padStart(8, "0")}-4444-4444-8444-${String(index + 30).padStart(12, "0")}`,
    slug: `schema4-stable-${String(index + 1).padStart(2, "0")}`,
    verify_jwt: index % 2 === 0,
    version: index + 2,
  })),
].sort((left, right) => left.slug.localeCompare(right.slug)));
const V4_TARGET_AFTER = Object.freeze({
  ...V4_TARGET_BEFORE,
  version: V4_TARGET_BEFORE.version + 1,
  updated_at: V4_TARGET_BEFORE.updated_at + 1_000,
  ezbr_sha256: rawHash("v4-target-after-ezbr"),
  entrypoint_path:
    `file:///tmp/user_fn_${MAIN_REF}_${V4_TARGET_ID}_3/source/supabase/functions/finance-manage-access-v2/index.ts`,
  import_map_path:
    `file:///tmp/user_fn_${MAIN_REF}_${V4_TARGET_ID}_3/source/supabase/functions/finance-manage-access-v2/deno.json`,
});
const V4_FUNCTIONS_AFTER = Object.freeze(V4_FUNCTIONS_BEFORE.map(row =>
  row.id === V4_TARGET_ID ? V4_TARGET_AFTER : row));

function v4SecretCanonical(rows) {
  return canonicalJson([...rows].sort((left, right) =>
    left.name.localeCompare(right.name)));
}

function v4SemanticCanonical(rows) {
  return canonicalJson([...rows]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(row => ({ name: row.name, value: row.value })));
}

function v4FunctionCanonical(rows) {
  return canonicalJson([...rows].sort((left, right) =>
    left.slug.localeCompare(right.slug)));
}

async function importSchema4AuthorityFixtureModule() {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v4-authority-fixture-",
  ));
  const scriptsDirectory = path.join(parent, "scripts");
  mkdirSync(scriptsDirectory, { recursive: true, mode: 0o700 });
  const generatedSecretDigests = Object.freeze({
    MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2: rawHash("v4-generated:operator"),
    MAIN_FINANCE_SYNC_TRIGGER_SECRET: rawHash("v4-generated:trigger"),
  });
  const overrides = [
    [v4SecretCanonical(V4_MAIN_BEFORE_ROWS), V4_INITIAL_MAIN_SHA],
    [v4SemanticCanonical(V4_MAIN_BEFORE_ROWS), V4_INITIAL_SEMANTIC_MAIN_SHA],
    [v4SecretCanonical(V4_FINANCE_ROWS), V4_FINANCE_SHA],
    [v4FunctionCanonical(V4_FUNCTIONS_BEFORE), V4_INITIAL_FUNCTION_SHA],
    [V4_OPERATOR_SECRET, generatedSecretDigests.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2],
    [V4_TRIGGER_SECRET, generatedSecretDigests.MAIN_FINANCE_SYNC_TRIGGER_SECRET],
    [
      canonicalJson(generatedSecretDigests),
      JSON.parse(readFileSync(ENVIRONMENT_FILE, "utf8"))
        .predecessorAdoption.generatedSecretDigestSetSha256,
    ],
  ];
  const byteOverrides = [[
    V4_SEALED_SUPABASE_FIXTURE_BYTES.toString("base64"),
    V4_MANIFEST.toolPins.supabaseCli.sha256,
  ]];
  const shaMarker = `export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}`;
  let source = readFileSync(OPERATOR_FILE, "utf8");
  assert.equal(source.split(shaMarker).length, 2);
  source = source.replace(shaMarker, `const TEST_SCHEMA4_SHA256_OVERRIDES = new Map(${JSON.stringify(overrides)});
const TEST_SCHEMA4_SHA256_BYTE_OVERRIDES = new Map(${JSON.stringify(byteOverrides)});

export function sha256(value) {
  return (Buffer.isBuffer(value)
    ? TEST_SCHEMA4_SHA256_BYTE_OVERRIDES.get(value.toString("base64"))
    : TEST_SCHEMA4_SHA256_OVERRIDES.get(value))
    ?? createHash("sha256").update(value).digest("hex");
}`);
  for (const marker of [
    "function captureSealedSupabaseCliMutationInput(file) {",
    "function createBundle({",
    "function readBundle(",
    "function schema4PlanReceiptFields({",
    "function validateSchema4ReceiptSemantic(",
    "function classifySchema4SecretState({",
    "function classifyExactTargetReplacement({",
    "function validatePartialSecretPredecessorSourceCiReceipt(",
    "function schema4MutationIntentFields(",
    "function schema4UnknownResultFields(",
    "function schema4NotInvokedResultFields(",
    "function schema4InvocationUnprovenFields(",
    "function schema4SecretResultFields(",
    "function schema4DeployResultFields(",
    "function schema4CompletionFields({",
    "function schema4SecretReconciliationFields({",
    "function schema4DeployReconciliationFields({",
    "async function readSchema4HostedSourceClosure(",
    "async function attestSchema4HostedSourceClosure(",
    "function expectedApproval(",
    "async function operateSchema4Apply(",
    "async function operateSchema4ResumePlan(",
    "async function operateSchema4Reconcile(",
    "async function operateSchema4Verify(",
  ]) {
    assert.equal(source.split(marker).length, 2, marker);
    source = source.replace(marker, `export ${marker}`);
  }
  const harness = "globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__";
  const inject = (marker, statement) => {
    assert.equal(source.split(marker).length, 2, marker);
    source = source.replace(marker, `${marker}\n  ${statement}`);
  };
  inject(
    "function initializeReadyOperation(input, common, release, createState) {",
    `if (${harness}) return ${harness}.initialize(input, common, release, createState);`,
  );
  inject(
    "function initializeSchema4LocalReceiptContext(input) {",
    `if (${harness}) return ${harness}.initializeLocal(input);`,
  );
  inject(
    "function readSchema4Bundle(context, release, plan) {",
    `if (${harness}) return ${harness}.readBundle(context, release, plan);`,
  );
  inject(
    "function readStableSchema4HostedState(context) {",
    `if (${harness}) return ${harness}.readStable(context);`,
  );
  inject(
    "function mutationInputIsUnchanged(bundle, release, mutation) {",
    `if (${harness}) return ${harness}.mutationInputIsUnchanged(bundle, release, mutation);`,
  );
  inject(
    "function appendSchema4Receipt(context, expectedChain, fields) {",
    `if (${harness}) return ${harness}.append(context, expectedChain, fields);`,
  );
  inject(
    "function assertSchema4CurrentAuthorityFresh(context, input, common, release, plan) {",
    `if (${harness}) return ${harness}.assertCurrent(context, input, common, release, plan);`,
  );
  inject(
    "function assertSchema4LocalAuthorityFresh(\n  context,\n  input,\n  common,\n  release,\n  plan,\n  bundle,\n) {",
    `if (${harness}) return ${harness}.assertLocal(context, input, common, release, plan, bundle);`,
  );
  inject(
    "function readReceiptBinding(stateDirectory, receiptDirectory) {",
    `if (${harness}) return ${harness}.readReceiptBinding(stateDirectory, receiptDirectory);`,
  );
  inject(
    "function readReceiptChain(\n  directory,\n  { readOnly = false, variant = \"current\" } = {},\n) {",
    `if (${harness}) return ${harness}.readReceiptChain(directory, { readOnly, variant });`,
  );
  inject(
    "function invokeCli(dependencies, args, { mutation = false } = {}) {",
    `if (${harness}) return ${harness}.invokeCli(dependencies, args, mutation);`,
  );
  inject(
    "async function postflightSchema4TargetReplacement(\n  context,\n  release,\n  bundle,\n  beforeFunctionRows,\n) {",
    `if (${harness}) return ${harness}.postflightTarget(context, release, bundle, beforeFunctionRows);`,
  );
  inject(
    "function readPartialSecretPredecessorAdoption(input, release, liveObservation) {",
    `if (${harness}) return ${harness}.readPredecessor(input, release, liveObservation);`,
  );
  inject(
    "async function buildCurrentSnapshot(dependencies, release, source, inventories, phase) {",
    `if (${harness}) return ${harness}.buildSnapshot(dependencies, release, source, inventories, phase);`,
  );
  inject(
    "function readSchema4RawReleaseAuthority(context, input) {",
    `if (${harness}) return ${harness}.readRawAuthority(context, input);`,
  );
  inject(
    "export async function attestSchema4HostedSourceClosure(context, release, targetRow) {",
    `if (${harness}) return ${harness}.attestSource(context, release, targetRow);`,
  );
  inject(
    "async function postflightSecretsOnlySuccessorSandwich(\n  dependencies,\n  release,\n  source,\n  bundle,\n  exactFunctionRows,\n) {",
    `if (${harness}) return ${harness}.postflightVerify(dependencies, release, source, bundle, exactFunctionRows);`,
  );
  writeFileSync(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
    source,
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(scriptsDirectory, "main-finance-runtime-recovery-v2-snapshot.mjs"),
    readFileSync(
      path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    ),
    { mode: 0o600 },
  );
  for (const relative of V4_MANIFEST.deploymentClosureFiles.map(item => item.path)) {
    const destination = path.join(parent, relative);
    mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    copyFileSync(path.join(ROOT, relative), destination);
    chmodSync(destination, 0o644);
  }
  const module = await import(pathToFileURL(
    path.join(scriptsDirectory, path.basename(OPERATOR_FILE)),
  ).href);
  return { module, parent };
}

const schema4AuthorityFixture = await importSchema4AuthorityFixtureModule();
process.once("exit", () => rmSync(schema4AuthorityFixture.parent, {
  recursive: true,
  force: true,
}));

function v4AdoptionFixture() {
  const predecessor = JSON.parse(readFileSync(ENVIRONMENT_FILE, "utf8"))
    .predecessorAdoption;
  return Object.freeze({
    kind: "main-finance-runtime-recovery-v4-partial-secret-predecessor-adoption",
    priorRootIdentitySha256: rawHash("v4-prior-root-identity"),
    priorSourceCommitSha: predecessor.sourceCommitSha,
    priorSourceTreeSha: predecessor.sourceTreeSha,
    priorSourceDeploymentSha256: predecessor.sourceDeploymentSha256,
    priorReleaseManifestSha256: predecessor.releaseManifestSha256,
    priorSourceCiReceiptSha256: predecessor.sourceCiReceiptSha256,
    priorSourceCiReceiptFileSha256: predecessor.sourceCiReceiptFileSha256,
    priorSourceCiRunId: String(predecessor.sourceCiRunId),
    priorSourceCiJobId: String(predecessor.sourceCiJobId),
    priorReleaseProvenanceFileSha256: predecessor.provenanceFileSha256,
    priorReleaseProvenanceDescriptorSha256: predecessor.provenanceDescriptorSha256,
    priorPlanReceiptSha256: predecessor.planReceiptSha256,
    priorPlanReceiptFileSha256: predecessor.planReceiptFileSha256,
    priorSecretIntentReceiptSha256: predecessor.secretIntentReceiptSha256,
    priorSecretIntentReceiptFileSha256: predecessor.secretIntentReceiptFileSha256,
    priorEffectReceiptSha256: predecessor.effectReceiptSha256,
    priorEffectReceiptFileSha256: predecessor.effectReceiptFileSha256,
    priorReceiptChainSha256: predecessor.receiptChainSha256,
    priorBundleAttestationSha256: predecessor.bundleAttestationSha256,
    priorBundleAttestationFileSha256: predecessor.bundleAttestationFileSha256,
    priorBundleCommitSha256: predecessor.bundleCommitSha256,
    priorBundleCommitFileSha256: predecessor.bundleCommitFileSha256,
    priorRuntimeFileSha256: predecessor.runtimeFileSha256,
    priorSourceArchiveSha256: predecessor.sourceArchiveSha256,
    priorMutationSecretNameSetSha256: predecessor.mutationSecretNameSetSha256,
    priorMutationSecretDigestSetSha256: predecessor.mutationSecretDigestSetSha256,
    generatedSecretNames: predecessor.adoptGeneratedSecretNames,
    generatedSecretDigestSetSha256: predecessor.generatedSecretDigestSetSha256,
    preinstallMainInventorySha256: predecessor.preinstallMainInventorySha256,
    installedMainInventorySha256: predecessor.installedMainInventorySha256,
    installedSemanticMainInventorySha256:
      predecessor.installedSemanticMainInventorySha256,
    stableFinanceInventorySha256: predecessor.stableFinanceInventorySha256,
    preinstallFunctionInventorySha256:
      predecessor.preinstallFunctionInventorySha256,
    installedFunctionInventorySha256: predecessor.installedFunctionInventorySha256,
    installedFunctionCount: predecessor.functionCount,
    functionVersionTransitionDisposition: "exact-all-existing-plus-one",
    metadataOnlySecretNames: SUCCESSOR_METADATA_ONLY_NAMES,
    stableReadRounds: 2,
    secretState: "state_satisfied",
    hostedMutationCount: 1,
    functionDeployCount: 0,
    releaseCompleteObserved: false,
    causalAttribution: false,
  });
}

function v4InventoryMap(rows) {
  return new Map(rows.map(row => [row.name, Object.freeze({ ...row })]));
}

function v4FunctionFrame(module, rows, pinnedSha = null) {
  const normalized = Object.freeze([...rows]
    .map(row => Object.freeze(JSON.parse(canonicalJson(row))))
    .sort((left, right) => left.slug.localeCompare(right.slug)));
  return Object.freeze({
    rows: normalized,
    sha256: pinnedSha ?? module.sha256(canonicalJson(normalized)),
    target: normalized.find(row => row.slug === "finance-manage-access-v2") ?? null,
  });
}

function v4SourceCiFixture(module) {
  const core = {
    schemaVersion: 1,
    kind: "main-finance-source-ci-receipt-v1",
    repository: "lego-business-system/lego-mini-app",
    workflowPath: ".github/workflows/verify-finance-integration.yml",
    workflowBlob: WORKFLOW_BLOB,
    branch: BRANCH,
    event: "push",
    runId: Number(RUN_ID),
    runAttempt: 1,
    runUrl: `https://github.com/lego-business-system/lego-mini-app/actions/runs/${RUN_ID}`,
    status: "completed",
    conclusion: "success",
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    remoteCommit: SOURCE_COMMIT,
    remoteSynced: true,
    checkoutDetached: true,
    checkoutFull: true,
    sparseCheckout: false,
    skipWorktreeCount: 0,
    trackedFileCount: 935,
    verifyJobId: 987654321,
    verifyJobConclusion: "success",
    postgresImage: POSTGRES_IMAGE,
    postgresMajor: 17,
    postgresStepName: "Execute main Finance foundation on disposable PostgreSQL 17",
    postgresStepNumber: 9,
    postgresStepConclusion: "success",
    gitVersion: "git version 2.50.1 (Apple Git-155)",
    gitSha256: "179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818",
    ghVersion: "gh version 2.97.0 (2026-07-31)",
    ghSha256: "0d17dddf96bcc1dc50f3420a064d593d64016b0be16286a6c26121f2a5cb8316",
    hostedMutationsPerformed: false,
    productionTouched: false,
    verifiedAt: at(-30_000),
  };
  const receipt = Object.freeze({
    ...core,
    receiptSha256: module.sha256(canonicalJson(core)),
  });
  const source = `${canonicalJson(receipt)}\n`;
  return Object.freeze({
    receipt,
    source,
    fileSha256: module.sha256(source),
  });
}

function partialSecretPredecessorSourceCiFixture(module) {
  const unorderedCore = {
    branch: BRANCH,
    checkoutDetached: true,
    checkoutFull: true,
    conclusion: "success",
    event: "push",
    ghSha256: "0d17dddf96bcc1dc50f3420a064d593d64016b0be16286a6c26121f2a5cb8316",
    ghVersion: "gh version 2.97.0 (2026-07-31)",
    gitSha256: "179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818",
    gitVersion: "git version 2.50.1 (Apple Git-155)",
    hostedMutationsPerformed: false,
    kind: "main-finance-source-ci-receipt-v1",
    postgresImage: POSTGRES_IMAGE,
    postgresMajor: 17,
    postgresStepConclusion: "success",
    postgresStepName: "Execute main Finance foundation on disposable PostgreSQL 17",
    postgresStepNumber: 11,
    productionTouched: false,
    remoteCommit: "42c647aaeb3a6cededb49f073ac001678dcb3582",
    remoteSynced: true,
    repository: "lego-business-system/lego-mini-app",
    runAttempt: 1,
    runId: 33212271479,
    runUrl:
      "https://github.com/lego-business-system/lego-mini-app/actions/runs/33212271479",
    schemaVersion: 1,
    skipWorktreeCount: 0,
    sourceCommit: "42c647aaeb3a6cededb49f073ac001678dcb3582",
    sourceTree: "dd05940dbc3f06e8577a6406c6e64e470049c818",
    sparseCheckout: false,
    status: "completed",
    trackedFileCount: 935,
    verifiedAt: "2026-08-28T21:48:12.301Z",
    verifyJobConclusion: "success",
    verifyJobId: 98988013415,
    workflowBlob: "220ee4c940cfd03e178dbee1fb6f25dc5de0845e",
    workflowPath: ".github/workflows/verify-finance-integration.yml",
  };
  const core = Object.freeze(Object.fromEntries(
    Object.keys(unorderedCore).sort().map(key => [key, unorderedCore[key]]),
  ));
  const receiptSha256 = module.sha256(`${JSON.stringify(core, null, 2)}\n`);
  const unorderedValue = { ...core, receiptSha256 };
  const value = Object.freeze(Object.fromEntries(
    Object.keys(unorderedValue).sort().map(key => [key, unorderedValue[key]]),
  ));
  const source = `${JSON.stringify(value, null, 2)}\n`;
  assert.equal(
    receiptSha256,
    "908e67fdb896c0d266735204c528af2736d326ba894ef9d84dc564db09ec99c5",
  );
  assert.equal(
    module.sha256(source),
    "17fe6a4e3dd6f90a0b2a39add14ba8ddf1c899f52ad0c0faf2c65af25dcbdc6f",
  );
  return Object.freeze({ core, value, source });
}

function v4RuntimeSnapshot(clock, suffix, vector) {
  return Object.freeze({
    database_clock: clock,
    response_sha256: rawHash(`v4-snapshot-response:${suffix}`),
    descriptor_sha256: vector.descriptorSha256,
    state_sha256: vector.stateSha256,
    catalog_sha256: vector.catalogSha256,
    gate_inventory_sha256: vector.gateInventorySha256,
    privacy_secret_inventory_sha256: vector.privacyInventorySha256,
    checked_count: vector.checkedCount,
  });
}

function v4SandwichFixture({
  module,
  d0Clock,
  proofClock,
  d1Clock,
  suffix,
  vector,
  mainRows,
  financeRows,
  beforeFunctionRows,
  functionRows,
}) {
  const main = v4InventoryMap(mainRows);
  const finance = v4InventoryMap(financeRows);
  const functionInventory = v4FunctionFrame(module, functionRows);
  const mainSha = module.sha256(v4SecretCanonical(mainRows));
  const financeSha = module.sha256(v4SecretCanonical(financeRows));
  return Object.freeze({
    d0: v4RuntimeSnapshot(d0Clock, `${suffix}:d0`, vector),
    proof: Object.freeze({
      responseSha256: rawHash(`v4-proof-response:${suffix}`),
      proofSha256: rawHash(`v4-proof:${suffix}`),
      attestedAt: proofClock,
      checkedCount: vector.checkedCount,
      mismatchCount: 0,
      stateSha256: vector.stateSha256,
    }),
    d1: v4RuntimeSnapshot(d1Clock, `${suffix}:d1`, vector),
    d0MainInventorySha256: mainSha,
    d0FinanceInventorySha256: financeSha,
    d0FunctionInventorySha256: functionInventory.sha256,
    d1MainInventorySha256: mainSha,
    d1FinanceInventorySha256: financeSha,
    d1FunctionInventorySha256: functionInventory.sha256,
    inventories: Object.freeze({
      main,
      finance,
      mainInventorySha256: mainSha,
      financeInventorySha256: financeSha,
    }),
    functionInventory,
    transition: module.classifyExactTargetReplacement({
      beforeRows: beforeFunctionRows,
      afterRows: functionRows,
    }),
    hostedSourceClosureSha256: V4_HOSTED_SOURCE_CLOSURE_SHA,
    hostedSourceMetadataSha256: rawHash("v4-hosted-source-metadata"),
    hostedSourceClosureReadRounds: 2,
  });
}

function appendV4Fixture(module, chain, fields) {
  const core = {
    ...fields,
    schemaVersion: 4,
    sequence: chain.length + 1,
    previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
    productionDenied: true,
  };
  const receipt = Object.freeze({
    ...core,
    receiptSha256: module.sha256(canonicalJson(core)),
  });
  chain.push(receipt);
  return receipt;
}

function buildSchema4AuthorityFixture({
  secretUnknown = false,
  deployUnknown = false,
  secretFunctionPlusOne = false,
} = {}) {
  const module = schema4AuthorityFixture.module;
  const sourceCi = v4SourceCiFixture(module);
  const serializedProvenance = provenanceSource(SOURCE_COMMIT, SOURCE_TREE, RUN_ID);
  const provenance = Object.freeze(JSON.parse(serializedProvenance));
  const changedPaths = Object.freeze(EXPECTED_CHANGED_PATHS.map(row =>
    Object.freeze({ ...row })));
  const context = Object.freeze({
    source: Object.freeze({
      commit: SOURCE_COMMIT,
      tree: SOURCE_TREE,
      parent: V4_SOURCE_PARENT,
      baseTree: V4_BASE_TREE,
      changedPaths,
      changedPathSetSha256: module.sha256(changedPaths
        .map(item => `${item.status}\0${item.path}\n`).join("")),
      trackedFileCount: 935,
      workflowBlobSha: WORKFLOW_BLOB,
      supabaseArchiveSha256: SUPABASE_ARCHIVE_SHA,
    }),
    ci: Object.freeze({
      runId: RUN_ID,
      runApiSha256: rawHash("v4-ci-run"),
      jobsApiSha256: rawHash("v4-ci-jobs"),
      branchApiSha256: rawHash("v4-ci-branch"),
    }),
    sourceCiReceipt: Object.freeze({
      ...sourceCi.receipt,
      fileSha256: sourceCi.fileSha256,
    }),
    provenance: Object.freeze({
      ...provenance,
      fileSha256: module.sha256(serializedProvenance),
    }),
  });
  const release = Object.freeze({
    manifest: V4_MANIFEST,
    manifestSha256: V4_MANIFEST_SHA,
  });
  const adoption = v4AdoptionFixture();
  const beforeMain = v4InventoryMap(V4_MAIN_BEFORE_ROWS);
  const afterMain = v4InventoryMap(V4_MAIN_AFTER_ROWS);
  const finance = v4InventoryMap(V4_FINANCE_ROWS);
  const beforeFunctions = v4FunctionFrame(
    module,
    V4_FUNCTIONS_BEFORE,
    V4_INITIAL_FUNCTION_SHA,
  );
  const secretFunctionRows = Object.freeze(V4_FUNCTIONS_BEFORE.map(row =>
    Object.freeze({
      ...row,
      version: row.version + (secretFunctionPlusOne ? 1 : 0),
    })));
  const targetBeforeDeploy = secretFunctionRows.find(row =>
    row.slug === "finance-manage-access-v2");
  const targetAfterDeploy = Object.freeze({
    ...targetBeforeDeploy,
    version: targetBeforeDeploy.version + 1,
    updated_at: targetBeforeDeploy.updated_at + 1_000,
    ezbr_sha256: rawHash(
      `v4-target-after-ezbr:${targetBeforeDeploy.version + 1}`,
    ),
    entrypoint_path:
      `file:///tmp/user_fn_${MAIN_REF}_${V4_TARGET_ID}_${targetBeforeDeploy.version + 1}/source/supabase/functions/finance-manage-access-v2/index.ts`,
    import_map_path:
      `file:///tmp/user_fn_${MAIN_REF}_${V4_TARGET_ID}_${targetBeforeDeploy.version + 1}/source/supabase/functions/finance-manage-access-v2/deno.json`,
  });
  const deployFunctionRows = Object.freeze(secretFunctionRows.map(row =>
    row.id === V4_TARGET_ID ? targetAfterDeploy : row));
  const secretFunctions = v4FunctionFrame(module, secretFunctionRows);
  const afterFunctions = v4FunctionFrame(module, deployFunctionRows);
  const bundle = Object.freeze({
    attestation: Object.freeze({
      attestationSha256: rawHash("v4-bundle-attestation"),
      sourceArchiveSha256: rawHash("v4-source-archive"),
      operatorDescriptorFileSha256: rawHash("v4-operator-descriptor-file"),
      operatorDescriptorSha256: rawHash("v4-operator-descriptor"),
      productionBoundarySha256: rawHash("v4-production-boundary"),
      targetDescriptorSha256: rawHash("v4-target-descriptor"),
      mutationSecretNames: SUCCESSOR_MUTATION_NAMES,
      mutationSecretDigests: V4_MUTATION_DIGESTS,
      predecessorAdoption: adoption,
    }),
    preinstallInventories: Object.freeze({
      main: beforeMain,
      finance,
      functions: V4_FUNCTIONS_BEFORE,
    }),
    runtimeMutationInput: Object.freeze([
      Object.freeze({ path: "/private/tmp/v4-runtime.env", sha256: rawHash("v4-runtime-input") }),
    ]),
    deployMutationInput: Object.freeze([
      Object.freeze({
        path: "supabase/functions/finance-manage-access-v2/index.ts",
        sha256: targetAfterDeploy.ezbr_sha256,
      }),
    ]),
    secretMutationFile: "/private/tmp/v4-runtime.env",
    runtimeFile: "/private/tmp/v4-proof.env",
    workdir: "/private/tmp/v4-deploy-workdir",
  });
  const beforeObserved = Object.freeze({
    inventories: Object.freeze({
      main: beforeMain,
      finance,
      mainInventorySha256: V4_INITIAL_MAIN_SHA,
      financeInventorySha256: V4_FINANCE_SHA,
    }),
    functions: beforeFunctions,
  });
  const afterObserved = Object.freeze({
    inventories: Object.freeze({
      main: afterMain,
      finance,
      mainInventorySha256: module.sha256(v4SecretCanonical(V4_MAIN_AFTER_ROWS)),
      financeInventorySha256: V4_FINANCE_SHA,
    }),
    functions: secretFunctions,
  });
  const afterDeployObserved = Object.freeze({
    inventories: afterObserved.inventories,
    functions: afterFunctions,
  });
  const chain = [];
  let cursor = 10_000;
  const take = () => {
    const value = at(cursor);
    cursor += 10_000;
    return value;
  };
  const vector1 = Object.freeze({
    descriptorSha256: rawHash("v4-plan1-descriptor"),
    stateSha256: rawHash("v4-plan1-state"),
    catalogSha256: rawHash("v4-plan1-catalog"),
    gateInventorySha256: rawHash("v4-plan1-gate"),
    privacyInventorySha256: rawHash("v4-plan1-privacy"),
    checkedCount: 75,
  });
  const plan1RecordedAt = take();
  const plan1 = appendV4Fixture(module, chain, module.schema4PlanReceiptFields({
    context,
    release,
    bundle,
    inventories: beforeObserved.inventories,
    functionInventory: beforeFunctions,
    snapshot: v4RuntimeSnapshot(at(9_000), "plan1", vector1),
    predecessorAdoption: adoption,
    mutationScope: "secrets-set",
    resumeFromReceiptSha256: null,
    recordedAt: plan1RecordedAt,
    expiresAt: new Date(Date.parse(plan1RecordedAt) + 200_000).toISOString(),
  }));
  const intent1 = appendV4Fixture(
    module,
    chain,
    module.schema4MutationIntentFields(plan1, beforeObserved, take()),
  );
  let secretCause;
  if (secretUnknown) {
    const unknown = appendV4Fixture(
      module,
      chain,
      module.schema4UnknownResultFields(intent1, take()),
    );
    const state = module.classifySchema4SecretState({
      bundle,
      beforeFunctionRows: intent1.beforeFunctionInventoryRows,
      observed: afterObserved,
    });
    secretCause = appendV4Fixture(
      module,
      chain,
      module.schema4SecretReconciliationFields({
        unresolved: unknown,
        intent: intent1,
        observed: afterObserved,
        state,
        stable: true,
        recordedAt: take(),
      }),
    );
  } else {
    const state = module.classifySchema4SecretState({
      bundle,
      beforeFunctionRows: intent1.beforeFunctionInventoryRows,
      observed: afterObserved,
    });
    secretCause = appendV4Fixture(
      module,
      chain,
      module.schema4SecretResultFields({
        intent: intent1,
        bundle,
        observed: afterObserved,
        state,
        recordedAt: take(),
      }),
    );
  }
  const vector2 = Object.freeze({
    descriptorSha256: rawHash("v4-plan2-descriptor"),
    stateSha256: rawHash("v4-plan2-state"),
    catalogSha256: rawHash("v4-plan2-catalog"),
    gateInventorySha256: rawHash("v4-plan2-gate"),
    privacyInventorySha256: rawHash("v4-plan2-privacy"),
    checkedCount: 75,
  });
  const plan2RecordedAt = take();
  const plan2 = appendV4Fixture(module, chain, module.schema4PlanReceiptFields({
    context,
    release,
    bundle,
    inventories: afterObserved.inventories,
    functionInventory: secretFunctions,
    snapshot: v4RuntimeSnapshot(
      new Date(Date.parse(plan2RecordedAt) - 1_000).toISOString(),
      "plan2",
      vector2,
    ),
    predecessorAdoption: adoption,
    mutationScope: "function-deploy",
    resumeFromReceiptSha256: secretCause.receiptSha256,
    recordedAt: plan2RecordedAt,
    expiresAt: new Date(Date.parse(plan2RecordedAt) + 200_000).toISOString(),
  }));
  const intent2 = appendV4Fixture(
    module,
    chain,
    module.schema4MutationIntentFields(plan2, afterObserved, take()),
  );
  const buildDeploySandwich = () => v4SandwichFixture({
      module,
      d0Clock: take(),
      proofClock: take(),
      d1Clock: take(),
      suffix: "deploy",
      vector: vector2,
      mainRows: V4_MAIN_AFTER_ROWS,
      financeRows: V4_FINANCE_ROWS,
      beforeFunctionRows: secretFunctionRows,
      functionRows: deployFunctionRows,
    });
  let deployCause;
  if (deployUnknown) {
    const unknown = appendV4Fixture(
      module,
      chain,
      module.schema4UnknownResultFields(intent2, take()),
    );
    const deploySandwich = buildDeploySandwich();
    deployCause = appendV4Fixture(
      module,
      chain,
      module.schema4DeployReconciliationFields({
        unresolved: unknown,
        intent: intent2,
        observed: Object.freeze({
          inventories: deploySandwich.inventories,
          functions: deploySandwich.functionInventory,
        }),
        outcome: "applied",
        divergenceReason: null,
        sandwich: deploySandwich,
        recordedAt: take(),
      }),
    );
  } else {
    const deploySandwich = buildDeploySandwich();
    deployCause = appendV4Fixture(
      module,
      chain,
      module.schema4DeployResultFields({
        intent: intent2,
        sandwich: deploySandwich,
        recordedAt: take(),
      }),
    );
  }
  const completionVector = Object.freeze({
    descriptorSha256: deployCause.d1.descriptorSha256,
    stateSha256: deployCause.d1.stateSha256,
    catalogSha256: deployCause.d1.catalogSha256,
    gateInventorySha256: deployCause.d1.gateInventorySha256,
    privacyInventorySha256: deployCause.d1.privacyInventorySha256,
    checkedCount: deployCause.d1.checkedCount,
  });
  const completionSandwich = v4SandwichFixture({
    module,
    d0Clock: take(),
    proofClock: take(),
    d1Clock: take(),
    suffix: "completion",
    vector: completionVector,
    mainRows: V4_MAIN_AFTER_ROWS,
    financeRows: V4_FINANCE_ROWS,
    beforeFunctionRows: secretFunctionRows,
    functionRows: deployFunctionRows,
  });
  const terminal = appendV4Fixture(
    module,
    chain,
    module.schema4CompletionFields({
      context,
      release,
      bundle,
      chain,
      cause: deployCause,
      sandwich: completionSandwich,
      now: () => new Date(take()),
    }),
  );
  const serializedReceipts = Object.freeze(chain.map(receipt =>
    `${canonicalJson(receipt)}\n`));
  return Object.freeze({
    module,
    chain: Object.freeze(chain),
    serializedReceipts,
    sourceCi,
    provenance,
    serializedProvenance,
    plan1,
    intent1,
    secretCause,
    plan2,
    intent2,
    deployCause,
    terminal,
    bundle,
    context,
    release,
    beforeObserved,
    afterObserved,
    afterDeployObserved,
    vector2,
  });
}

function validateSchema4Fixture(fixture) {
  return fixture.module.validateMainFinanceRuntimeRecoveryV4ReleaseAuthority({
    receipts: fixture.chain,
    serializedReceipts: fixture.serializedReceipts,
    sourceCiReceipt: fixture.sourceCi.receipt,
    serializedSourceCiReceipt: fixture.sourceCi.source,
    provenance: fixture.provenance,
    serializedProvenance: fixture.serializedProvenance,
  });
}

function rehashSchema4Fixture(fixture, mutate) {
  const chain = fixture.chain.map(receipt => structuredClone(receipt));
  mutate(chain);
  const rebuilt = [];
  for (const item of chain) {
    const receipt = { ...item };
    delete receipt.receiptSha256;
    receipt.schemaVersion = 4;
    receipt.sequence = rebuilt.length + 1;
    receipt.previousReceiptSha256 = rebuilt.at(-1)?.receiptSha256 ?? null;
    receipt.productionDenied = true;
    if (receipt.kind === "release-plan" && receipt.mutationScope === "function-deploy") {
      receipt.resumeFromReceiptSha256 = rebuilt.at(-1)?.receiptSha256 ?? null;
    }
    if (receipt.kind === "mutation-intent") {
      const plan = [...rebuilt].reverse().find(candidate =>
        candidate.kind === "release-plan"
        && candidate.mutationScope === receipt.mutation);
      if (plan) receipt.planReceiptSha256 = plan.receiptSha256;
    }
    if (receipt.kind === "mutation-result") {
      const intent = [...rebuilt].reverse().find(candidate =>
        candidate.kind === "mutation-intent"
        && candidate.mutation === receipt.mutation);
      if (intent) receipt.intentReceiptSha256 = intent.receiptSha256;
    }
    if (receipt.kind === "reconciliation") {
      const unresolved = [...rebuilt].reverse().find(candidate =>
        candidate.kind === "mutation-result"
        && candidate.mutation === receipt.mutation
        && candidate.status === "unknown");
      if (unresolved) receipt.unresolvedReceiptSha256 = unresolved.receiptSha256;
    }
    if (receipt.kind === "release-complete") {
      const plans = rebuilt.filter(candidate => candidate.kind === "release-plan");
      receipt.completionCauseReceiptSha256 = rebuilt.at(-1)?.receiptSha256 ?? null;
      receipt.initialPlanReceiptSha256 = plans[0]?.receiptSha256 ?? null;
      receipt.deployPlanReceiptSha256 = plans[1]?.receiptSha256 ?? null;
    }
    const core = receipt;
    const rebuiltReceipt = Object.freeze({
      ...core,
      receiptSha256: fixture.module.sha256(canonicalJson(core)),
    });
    rebuilt.push(rebuiltReceipt);
  }
  return Object.freeze({
    ...fixture,
    chain: Object.freeze(rebuilt),
    serializedReceipts: Object.freeze(rebuilt.map(receipt =>
      `${canonicalJson(receipt)}\n`)),
    terminal: rebuilt.at(-1),
  });
}

function schema4FixtureWithSourceCiMutation(fixture, mutate) {
  const core = structuredClone(fixture.sourceCi.receipt);
  delete core.receiptSha256;
  mutate(core);
  const receipt = Object.freeze({
    ...core,
    receiptSha256: fixture.module.sha256(canonicalJson(core)),
  });
  const source = `${canonicalJson(receipt)}\n`;
  return Object.freeze({
    ...fixture,
    sourceCi: Object.freeze({
      receipt,
      source,
      fileSha256: fixture.module.sha256(source),
    }),
  });
}

function schema4FixtureWithProvenanceMutation(fixture, mutate) {
  const core = structuredClone(fixture.provenance);
  delete core.descriptorSha256;
  mutate(core);
  const provenance = Object.freeze({
    ...core,
    descriptorSha256: fixture.module.sha256(canonicalJson(core)),
  });
  return Object.freeze({
    ...fixture,
    provenance,
    serializedProvenance: `${canonicalJson(provenance)}\n`,
  });
}

test("fresh schema-4 bundle normalizes inventories without changing durable bytes", t => {
  const module = schema4AuthorityFixture.module;
  const fixture = buildSchema4AuthorityFixture();
  const stateDirectory = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v4-fresh-bundle-",
  ));
  chmodSync(stateDirectory, 0o700);
  const sealedDirectory = path.join(stateDirectory, "sealed-supabase-cli");
  t.after(() => {
    if (existsSync(sealedDirectory)) chmodSync(sealedDirectory, 0o700);
    rmSync(stateDirectory, { recursive: true, force: true });
  });

  const sealedFile = path.join(sealedDirectory, "supabase");
  mkdirSync(sealedDirectory, { mode: 0o700 });
  writeFileSync(sealedFile, V4_SEALED_SUPABASE_FIXTURE_BYTES, { mode: 0o500 });
  chmodSync(sealedFile, 0o500);
  chmodSync(sealedDirectory, 0o500);
  assert.notEqual(
    sha256(V4_SEALED_SUPABASE_FIXTURE_BYTES),
    V4_MANIFEST.toolPins.supabaseCli.sha256,
  );
  assert.equal(
    module.sha256(V4_SEALED_SUPABASE_FIXTURE_BYTES),
    V4_MANIFEST.toolPins.supabaseCli.sha256,
  );
  assert.notEqual(
    module.sha256(Buffer.concat([
      V4_SEALED_SUPABASE_FIXTURE_BYTES,
      Buffer.from("tampered", "utf8"),
    ])),
    V4_MANIFEST.toolPins.supabaseCli.sha256,
  );
  const supabaseMutationInput =
    module.captureSealedSupabaseCliMutationInput(sealedFile);

  const release = Object.freeze({
    manifest: V4_MANIFEST,
    manifestSha256: V4_MANIFEST_SHA,
    preflightSqlSha256: V4_MANIFEST.preflightSql.sha256,
    environment: Object.freeze(JSON.parse(readFileSync(ENVIRONMENT_FILE, "utf8"))),
  });
  const main = v4InventoryMap(V4_MAIN_BEFORE_ROWS);
  const finance = v4InventoryMap(V4_FINANCE_ROWS);
  const inventories = Object.freeze({
    main,
    finance,
    mainInventorySha256: V4_INITIAL_MAIN_SHA,
    financeInventorySha256: V4_FINANCE_SHA,
  });
  const functionInventory = v4FunctionFrame(
    module,
    V4_FUNCTIONS_BEFORE,
    V4_INITIAL_FUNCTION_SHA,
  );
  const predecessorAdoption = v4AdoptionFixture();
  const snapshot = v4RuntimeSnapshot(at(1_000), "fresh-bundle", Object.freeze({
    descriptorSha256: rawHash("v4-fresh-bundle-descriptor"),
    stateSha256: rawHash("v4-fresh-bundle-state"),
    catalogSha256: rawHash("v4-fresh-bundle-catalog"),
    gateInventorySha256: rawHash("v4-fresh-bundle-gates"),
    privacyInventorySha256: rawHash("v4-fresh-bundle-privacy"),
    checkedCount: 75,
  }));
  const bundle = module.createBundle({
    stateDirectory,
    release,
    source: fixture.context.source,
    supabaseMutationInput,
    snapshot,
    inventories,
    functionInventory,
    accessBoundary: Object.freeze({
      productionBoundarySha256: rawHash("v4-fresh-bundle-production-boundary"),
      targetDescriptorSha256: rawHash("v4-fresh-bundle-target-descriptor"),
    }),
    randomBytesImpl: () => {
      throw new Error("fresh schema-4 bundle must adopt predecessor secret values");
    },
    generatedSecretValues: Object.freeze({
      MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2: V4_OPERATOR_SECRET,
      MAIN_FINANCE_SYNC_TRIGGER_SECRET: V4_TRIGGER_SECRET,
    }),
    predecessorAdoption,
    now: () => new Date(at(2_000)),
  });

  assert.equal(bundle.preinstallInventories.main instanceof Map, true);
  assert.equal(bundle.preinstallInventories.finance instanceof Map, true);
  assert.equal(Array.isArray(bundle.preinstallInventories.functions), true);
  const expectedPreinstallSource = `${canonicalJson({
    main: V4_MAIN_BEFORE_ROWS,
    finance: V4_FINANCE_ROWS,
    functions: functionInventory.rows,
  })}\n`;
  const preinstallSourceBeforeRead = readFileSync(
    bundle.preinstallInventoryFile,
    "utf8",
  );
  const attestationSourceBeforeRead = readFileSync(
    path.join(stateDirectory, "bundle.attestation.json"),
    "utf8",
  );
  assert.equal(preinstallSourceBeforeRead, expectedPreinstallSource);
  assert.equal(
    module.sha256(preinstallSourceBeforeRead),
    bundle.attestation.preinstallInventoryFileSha256,
  );

  const plan = module.schema4PlanReceiptFields({
    context: fixture.context,
    release,
    bundle,
    inventories,
    functionInventory,
    snapshot,
    predecessorAdoption,
    mutationScope: "secrets-set",
    resumeFromReceiptSha256: null,
    recordedAt: at(3_000),
    expiresAt: at(203_000),
  });
  const expectedSemanticRows = V4_MAIN_BEFORE_ROWS.map(row => Object.freeze({
    ...row,
    value: SUCCESSOR_MUTATION_NAMES.includes(row.name)
      ? bundle.attestation.mutationSecretDigests[row.name]
      : row.value,
  }));
  assert.equal(
    plan.expectedPostSecretSemanticMainInventorySha256,
    module.sha256(v4SemanticCanonical(expectedSemanticRows)),
  );
  assert.deepEqual(plan.predecessorMainInventoryRows, V4_MAIN_BEFORE_ROWS);

  const reloaded = module.readBundle(
    stateDirectory,
    release,
    fixture.context.source,
    {
      expectedAttestationSha256: bundle.attestation.attestationSha256,
      expectedPredecessorAdoption: predecessorAdoption,
      authorizeRuntimeRead: () => undefined,
    },
  );
  assert.equal(reloaded.preinstallInventories.main instanceof Map, true);
  assert.equal(reloaded.preinstallInventories.finance instanceof Map, true);
  assert.equal(Array.isArray(reloaded.preinstallInventories.functions), true);
  assert.deepEqual(
    [...reloaded.preinstallInventories.main],
    [...bundle.preinstallInventories.main],
  );
  assert.deepEqual(
    [...reloaded.preinstallInventories.finance],
    [...bundle.preinstallInventories.finance],
  );
  assert.deepEqual(
    reloaded.preinstallInventories.functions,
    bundle.preinstallInventories.functions,
  );
  const reloadedPlan = module.schema4PlanReceiptFields({
    context: fixture.context,
    release,
    bundle: reloaded,
    inventories,
    functionInventory,
    snapshot,
    predecessorAdoption,
    mutationScope: "secrets-set",
    resumeFromReceiptSha256: null,
    recordedAt: at(3_000),
    expiresAt: at(203_000),
  });
  assert.equal(
    reloadedPlan.expectedPostSecretSemanticMainInventorySha256,
    plan.expectedPostSecretSemanticMainInventorySha256,
  );
  assert.equal(
    readFileSync(bundle.preinstallInventoryFile, "utf8"),
    preinstallSourceBeforeRead,
  );
  assert.equal(
    readFileSync(
      path.join(stateDirectory, "bundle.attestation.json"),
      "utf8",
    ),
    attestationSourceBeforeRead,
  );
});

test("partial predecessor source-CI accepts only the pinned legacy pretty receipt", () => {
  const module = schema4AuthorityFixture.module;
  const legacy = partialSecretPredecessorSourceCiFixture(module);
  const validated = module.validatePartialSecretPredecessorSourceCiReceipt(
    legacy.value,
    legacy.source,
  );
  assert.equal(validated.receiptSha256, legacy.value.receiptSha256);
  assert.equal(validated.fileSha256, module.sha256(legacy.source));
  assert.equal(validated.runId, 33212271479);
  assert.equal(validated.verifyJobId, 98988013415);
  assert.equal(
    validated.workflowBlob,
    "220ee4c940cfd03e178dbee1fb6f25dc5de0845e",
  );
  assert.equal(
    validated.sourceCommit,
    "42c647aaeb3a6cededb49f073ac001678dcb3582",
  );
  assert.equal(
    validated.sourceTree,
    "dd05940dbc3f06e8577a6406c6e64e470049c818",
  );

  const current = v4SourceCiFixture(module);
  const currentPrettySource = `${JSON.stringify(current.receipt, null, 2)}\n`;
  assert.throws(
    () => module.validatePartialSecretPredecessorSourceCiReceipt(
      current.receipt,
      currentPrettySource,
    ),
    /partial predecessor source-CI authority differs/u,
  );

  const compactReceipt = Object.freeze({
    ...legacy.core,
    receiptSha256: module.sha256(canonicalJson(legacy.core)),
  });
  const compactSource = `${canonicalJson(compactReceipt)}\n`;
  assert.throws(
    () => module.validatePartialSecretPredecessorSourceCiReceipt(
      compactReceipt,
      compactSource,
    ),
    /partial predecessor source-CI authority differs/u,
  );

  const mutatedCoreUnordered = {
    ...legacy.core,
    verifiedAt: "2026-08-28T21:48:12.302Z",
  };
  const mutatedCore = Object.freeze(Object.fromEntries(
    Object.keys(mutatedCoreUnordered).sort()
      .map(key => [key, mutatedCoreUnordered[key]]),
  ));
  const mutatedUnordered = {
    ...mutatedCore,
    receiptSha256: module.sha256(`${JSON.stringify(mutatedCore, null, 2)}\n`),
  };
  const mutated = Object.freeze(Object.fromEntries(
    Object.keys(mutatedUnordered).sort().map(key => [key, mutatedUnordered[key]]),
  ));
  const mutatedSource = `${JSON.stringify(mutated, null, 2)}\n`;
  assert.notEqual(module.sha256(mutatedSource), module.sha256(legacy.source));
  assert.throws(
    () => module.validatePartialSecretPredecessorSourceCiReceipt(
      mutated,
      mutatedSource,
    ),
    /partial predecessor source-CI authority differs/u,
  );
});

test("schema-4 raw release authority validates genuine 7, 8 and 9 receipt topologies", () => {
  const normal = buildSchema4AuthorityFixture();
  assert.equal(normal.chain.length, 7);
  const normalAuthority = validateSchema4Fixture(normal);
  assert.equal(normalAuthority.schemaVersion, 4);
  assert.equal(normalAuthority.completionReceiptSha256, normal.terminal.receiptSha256);
  assert.equal(normalAuthority.hostedSourceClosureSha256, V4_HOSTED_SOURCE_CLOSURE_SHA);
  assert.equal(normalAuthority.functionInventorySha256, normal.terminal.functionInventorySha256);

  const secretPlusOne = buildSchema4AuthorityFixture({
    secretFunctionPlusOne: true,
  });
  assert.equal(
    secretPlusOne.secretCause.functionVersionTransitionDisposition,
    "exact-all-existing-plus-one",
  );
  assert.equal(
    validateSchema4Fixture(secretPlusOne).completionReceiptSha256,
    secretPlusOne.terminal.receiptSha256,
  );

  for (const options of [
    { secretUnknown: true },
    { deployUnknown: true },
  ]) {
    const fixture = buildSchema4AuthorityFixture(options);
    assert.equal(fixture.chain.length, 8);
    assert.equal(
      validateSchema4Fixture(fixture).completionReceiptSha256,
      fixture.terminal.receiptSha256,
    );
  }

  const bothUnknown = buildSchema4AuthorityFixture({
    secretUnknown: true,
    deployUnknown: true,
  });
  assert.equal(bothUnknown.chain.length, 9);
  assert.equal(
    validateSchema4Fixture(bothUnknown).completionReceiptSha256,
    bothUnknown.terminal.receiptSha256,
  );
});

test("schema-4 raw authority rejects coherent source, transition, closure and chronology drift", () => {
  const normal = buildSchema4AuthorityFixture();
  const reject = (fixture, pattern) => assert.throws(
    () => validateSchema4Fixture(fixture),
    pattern,
  );

  assert.match(
    readFileSync(WORKFLOW_FILE, "utf8"),
    new RegExp(`image: ${POSTGRES_IMAGE.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u"),
  );
  reject(schema4FixtureWithSourceCiMutation(normal, sourceCi => {
    sourceCi.postgresImage =
      "postgres:17.10-bookworm@sha256:27b6c778de50f4bb9a878c36e736110fbcd9b7020377d6fdfdf20f7c0347e40a";
  }), /schema-4 source-CI authority differs/u);

  reject(schema4FixtureWithSourceCiMutation(normal, sourceCi => {
    sourceCi.verifiedAt = at(-29_000);
  }), /source-CI or provenance binding differs/u);
  reject(schema4FixtureWithProvenanceMutation(normal, provenance => {
    provenance.remoteRef = "refs/remotes/origin/hostile";
  }), /release provenance contract differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    for (const receipt of chain) {
      if (receipt.kind === "release-plan") {
        receipt.mutationSecretDigests.MAIN_FINANCE_ACCESS_V2_SOURCE_TREE_SHA =
          rawHash("hostile-v4-tree-digest");
        receipt.mutationSecretDigestSetSha256 = normal.module.sha256(
          canonicalJson(receipt.mutationSecretDigests),
        );
      }
      if (receipt.kind === "mutation-intent" && receipt.mutation === "secrets-set") {
        receipt.expectedSecretDigestSetSha256 = chain[0].mutationSecretDigestSetSha256;
      }
      if (receipt.kind === "mutation-result" && receipt.mutation === "secrets-set") {
        receipt.mutationSecretDigestSetSha256 = chain[0].mutationSecretDigestSetSha256;
      }
    }
  }), /schema-4 release plan evidence differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const plan2 = chain.find(receipt =>
      receipt.kind === "release-plan" && receipt.mutationScope === "function-deploy");
    plan2.sourceArchiveSha256 = rawHash("hostile-v4-plan2-source-archive");
  }), /schema-4 resume plan sourceArchiveSha256 binding differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const secretResult = chain.find(receipt =>
      receipt.kind === "mutation-result" && receipt.mutation === "secrets-set");
    const row = secretResult.afterFunctionInventoryRows.find(candidate =>
      candidate.slug !== "finance-manage-access-v2");
    row.future_cli_field = "hostile-secret-stage-drift";
    secretResult.afterFunctionInventorySha256 = normal.module.sha256(
      v4FunctionCanonical(secretResult.afterFunctionInventoryRows),
    );
    secretResult.functionVersionTransitionDisposition = "diverged";
  }), /schema-4 verified secret result differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const deploy = chain.find(receipt =>
      receipt.kind === "mutation-result" && receipt.mutation === "function-deploy");
    const target = deploy.afterFunctionInventoryRows.find(row =>
      row.slug === "finance-manage-access-v2");
    target.version += 1;
    target.entrypoint_path = target.entrypoint_path.replace("_3/", "_4/");
    target.import_map_path = target.import_map_path.replace("_3/", "_4/");
    deploy.afterTargetFunctionRow = structuredClone(target);
    deploy.functionInventorySha256 = normal.module.sha256(
      v4FunctionCanonical(deploy.afterFunctionInventoryRows),
    );
    deploy.d0FunctionInventorySha256 = deploy.functionInventorySha256;
    deploy.d1FunctionInventorySha256 = deploy.functionInventorySha256;
  }), /schema-4 verified deploy result differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const deploy = chain.find(receipt =>
      receipt.kind === "mutation-result" && receipt.mutation === "function-deploy");
    const unrelated = deploy.afterFunctionInventoryRows.find(row =>
      row.slug !== "finance-manage-access-v2");
    unrelated.status = "INACTIVE";
    deploy.functionInventorySha256 = normal.module.sha256(
      v4FunctionCanonical(deploy.afterFunctionInventoryRows),
    );
    deploy.d0FunctionInventorySha256 = deploy.functionInventorySha256;
    deploy.d1FunctionInventorySha256 = deploy.functionInventorySha256;
  }), /schema-4 verified deploy result differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const deploy = chain.find(receipt =>
      receipt.kind === "mutation-result" && receipt.mutation === "function-deploy");
    const terminal = chain.at(-1);
    terminal.d0 = structuredClone(deploy.d0);
    terminal.hostedProof = structuredClone(deploy.hostedProof);
    terminal.d1 = structuredClone(deploy.d1);
  }), /schema-4 release completion/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const plan1 = chain[0];
    const intent1 = chain[1];
    plan1.expiresAt = intent1.recordedAt;
  }), /schema-4 mutation intent evidence differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    const plan2 = chain.find(receipt =>
      receipt.kind === "release-plan" && receipt.mutationScope === "function-deploy");
    const deploy = chain.find(receipt =>
      receipt.kind === "mutation-result" && receipt.mutation === "function-deploy");
    deploy.d0.stateSha256 = rawHash("hostile-v4-snapshot-state");
    deploy.hostedProof.stateSha256 = deploy.d0.stateSha256;
    deploy.d1.stateSha256 = deploy.d0.stateSha256;
    assert.notEqual(deploy.d0.stateSha256, plan2.snapshot.stateSha256);
  }), /schema-4 verified deploy result differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    for (const receipt of chain) {
      if (receipt.kind === "release-plan") {
        receipt.expectedHostedSourceClosureSha256 = rawHash("hostile-v4-closure");
      }
      if (receipt.kind === "mutation-intent") {
        receipt.expectedHostedSourceClosureSha256 = rawHash("hostile-v4-closure");
      }
      if (
        (receipt.kind === "mutation-result" && receipt.mutation === "function-deploy")
        || receipt.kind === "release-complete"
      ) receipt.hostedSourceClosureSha256 = rawHash("hostile-v4-closure");
    }
  }), /schema-4 release plan evidence differs/u);

  reject(rehashSchema4Fixture(normal, chain => {
    chain.at(-1).hostedSourceMetadataSha256 = "not-a-sha";
  }), /schema-4 release completion/u);

  for (const options of [
    { secretUnknown: true },
    { deployUnknown: true },
  ]) {
    const unknownFixture = buildSchema4AuthorityFixture(options);
    reject(rehashSchema4Fixture(unknownFixture, chain => {
      const unknown = chain.find(receipt =>
        receipt.kind === "mutation-result" && receipt.status === "unknown");
      unknown.invocationAttempted = false;
    }), /schema-4 unknown result differs/u);
    reject(rehashSchema4Fixture(unknownFixture, chain => {
      const unknown = chain.find(receipt =>
        receipt.kind === "mutation-result" && receipt.status === "unknown");
      unknown.automaticRetryPerformed = true;
    }), /schema-4 mutation result cause differs/u);
  }

  const noncanonical = Object.freeze({
    ...normal,
    serializedReceipts: Object.freeze([
      ` ${normal.serializedReceipts[0]}`,
      ...normal.serializedReceipts.slice(1),
    ]),
  });
  reject(noncanonical, /serialized receipt bytes differ/u);

  const extra = rehashSchema4Fixture(normal, chain => {
    chain.push(
      structuredClone(chain.at(-1)),
      structuredClone(chain.at(-1)),
      structuredClone(chain.at(-1)),
    );
  });
  reject(extra, /receipt cardinality differs/u);
});

test("schema-4 pending intent terminates only as not-invoked or invocation-unproven", () => {
  const normal = buildSchema4AuthorityFixture();
  for (const fields of [
    normal.module.schema4NotInvokedResultFields(normal.intent1, at(30_000)),
    normal.module.schema4InvocationUnprovenFields(normal.intent1, at(30_000)),
  ]) {
    const terminal = rehashSchema4Fixture(normal, chain => {
      chain[2] = structuredClone(fields);
    });
    assert.throws(
      () => validateSchema4Fixture(terminal),
      /schema-4 resume deploy plan binding differs/u,
    );
  }

  const pendingIntent = Object.freeze({
    ...normal,
    chain: Object.freeze(normal.chain.slice(0, 2)),
    serializedReceipts: Object.freeze(normal.serializedReceipts.slice(0, 2)),
  });
  assert.throws(
    () => validateSchema4Fixture(pendingIntent),
    /receipt cardinality differs/u,
  );

  const pendingReconcile = buildSchema4AuthorityFixture({ secretUnknown: true });
  const withoutUnknown = rehashSchema4Fixture(pendingReconcile, chain => {
    chain.splice(2, 1);
    chain[2].unresolvedReceiptSha256 = chain[1].receiptSha256;
  });
  assert.throws(
    () => validateSchema4Fixture(withoutUnknown),
    /schema-4 reconciliation envelope differs/u,
  );
});

const V4_HOSTED_MULTIPART_FILES = Object.freeze([
  "functions/_shared/main-edge-runtime.ts",
  "functions/_shared/main-finance-protocol.mjs",
  "functions/finance-manage-access-v2/deno.json",
  "functions/finance-manage-access-v2/index.ts",
].map(name => Object.freeze({
  name,
  bytes: readFileSync(path.join(ROOT, "supabase", name)),
})));

function v4HostedMetadata(overrides = {}) {
  return {
    compressed_size: 1_013_392,
    deno2_entrypoint_path: "functions/finance-manage-access-v2/index.ts",
    deployment_id: `${MAIN_REF}_${V4_TARGET_ID}_${V4_TARGET_AFTER.version}`,
    module_count: 4,
    original_size: 7_652_908,
    ...overrides,
  };
}

async function v4HostedMultipartResponse({
  files = V4_HOSTED_MULTIPART_FILES,
  metadata = v4HostedMetadata(),
  metadataSources = null,
  status = 200,
  contentType = null,
  contentLength = null,
  fileType = "application/x-schema4-transport-observation",
} = {}) {
  const form = new FormData();
  for (const file of files) {
    form.append("file", new File([file.bytes], file.name, { type: fileType }), file.name);
  }
  for (const source of metadataSources ?? [JSON.stringify(metadata)]) {
    form.append("metadata", source);
  }
  const encoded = new Response(form);
  const body = await encoded.arrayBuffer();
  const headers = new Headers({
    "content-type": contentType ?? encoded.headers.get("content-type"),
  });
  if (contentLength !== null) headers.set("content-length", String(contentLength));
  return new Response(body, { status, headers });
}

function v4HostedSourceContext(responses) {
  const queue = [...responses];
  return Object.freeze({
    dependencies: Object.freeze({
      accessToken: "owner-token-is-not-inspected",
      fetchImpl: async () => {
        assert.ok(queue.length > 0, "hosted source response queue exhausted");
        return queue.shift();
      },
    }),
  });
}

test("schema-4 hosted multipart parser binds exact source and tolerates transport-only MIME and sizes", async () => {
  const module = schema4AuthorityFixture.module;
  const release = V4_RELEASE_FIXTURE;
  const response = await v4HostedMultipartResponse({
    fileType: "application/vnd.untrusted-transport-label",
    metadata: v4HostedMetadata({
      compressed_size: 900_001,
      original_size: 8_000_001,
    }),
  });
  assert.equal(response.headers.get("content-length"), null);
  const observed = await module.readSchema4HostedSourceClosure(
    v4HostedSourceContext([response]),
    release,
    V4_TARGET_AFTER,
  );
  assert.equal(observed.hostedSourceClosureSha256, V4_HOSTED_SOURCE_CLOSURE_SHA);
  assert.equal(observed.hostedSourceMetadataSha256, module.sha256(canonicalJson(
    v4HostedMetadata({ compressed_size: 900_001, original_size: 8_000_001 }),
  )));

  const attested = await module.attestSchema4HostedSourceClosure(
    v4HostedSourceContext([
      await v4HostedMultipartResponse(),
      await v4HostedMultipartResponse(),
    ]),
    release,
    V4_TARGET_AFTER,
  );
  assert.equal(attested.hostedSourceClosureSha256, V4_HOSTED_SOURCE_CLOSURE_SHA);
  assert.equal(attested.hostedSourceClosureReadRounds, 2);
});

test("schema-4 hosted multipart parser rejects envelope, part, metadata and stability drift", async () => {
  const module = schema4AuthorityFixture.module;
  const release = V4_RELEASE_FIXTURE;
  const reject = async (response, pattern) => assert.rejects(
    module.readSchema4HostedSourceClosure(
      v4HostedSourceContext([response]),
      release,
      V4_TARGET_AFTER,
    ),
    pattern,
  );

  await reject(await v4HostedMultipartResponse({ status: 500 }), /response envelope/u);
  await reject(await v4HostedMultipartResponse({
    contentType: "multipart/form-data",
  }), /response envelope/u);
  await reject(await v4HostedMultipartResponse({
    contentType: "application/json",
  }), /response envelope/u);
  await reject(await v4HostedMultipartResponse({
    contentLength: 4 * 1024 * 1024 + 1,
  }), /response envelope/u);

  await reject(await v4HostedMultipartResponse({
    files: V4_HOSTED_MULTIPART_FILES.slice(1),
  }), /closure or deployment metadata differs/u);
  await reject(await v4HostedMultipartResponse({
    files: [...V4_HOSTED_MULTIPART_FILES, {
      name: "functions/extra.ts",
      bytes: Buffer.from("extra", "utf8"),
    }],
  }), /closure or deployment metadata differs/u);
  await reject(await v4HostedMultipartResponse({
    files: [...V4_HOSTED_MULTIPART_FILES, V4_HOSTED_MULTIPART_FILES[0]],
  }), /closure or deployment metadata differs/u);
  await reject(await v4HostedMultipartResponse({
    files: V4_HOSTED_MULTIPART_FILES.map((file, index) => index === 0
      ? { ...file, name: "functions/_shared/wrong.ts" } : file),
  }), /closure or deployment metadata differs/u);
  await reject(await v4HostedMultipartResponse({
    files: V4_HOSTED_MULTIPART_FILES.map((file, index) => index === 0
      ? { ...file, bytes: Buffer.concat([file.bytes, Buffer.from("drift")]) } : file),
  }), /closure or deployment metadata differs/u);
  await reject(await v4HostedMultipartResponse({
    metadataSources: [JSON.stringify(v4HostedMetadata()), JSON.stringify(v4HostedMetadata())],
  }), /multipart part differs/u);

  for (const metadata of [
    (() => {
      const value = v4HostedMetadata();
      delete value.module_count;
      return value;
    })(),
    { ...v4HostedMetadata(), extra: true },
    v4HostedMetadata({ deployment_id: `${MAIN_REF}_${V4_TARGET_ID}_99` }),
    v4HostedMetadata({ deno2_entrypoint_path: "functions/wrong/index.ts" }),
    v4HostedMetadata({ module_count: 5 }),
    v4HostedMetadata({ compressed_size: 0 }),
    v4HostedMetadata({ original_size: 64 * 1024 * 1024 + 1 }),
  ]) await reject(
    await v4HostedMultipartResponse({ metadata }),
    /metadata|closure/u,
  );
  await reject(await v4HostedMultipartResponse({
    metadataSources: [
      `{"compressed_size":1,"compressed_size":2,"deno2_entrypoint_path":"functions/finance-manage-access-v2/index.ts","deployment_id":"${MAIN_REF}_${V4_TARGET_ID}_${V4_TARGET_AFTER.version}","module_count":4,"original_size":10}`,
    ],
  }), /metadata JSON differs/u);

  const oversizedBody = new Response(Buffer.alloc(4 * 1024 * 1024 + 1), {
    status: 200,
    headers: { "content-type": "multipart/form-data; boundary=schema4" },
  });
  await reject(oversizedBody, /exceeded the byte limit/u);
  await reject(await v4HostedMultipartResponse({
    files: V4_HOSTED_MULTIPART_FILES.map((file, index) => index === 0
      ? { ...file, bytes: Buffer.alloc(1024 * 1024 + 1) } : file),
  }), /multipart part differs/u);

  await assert.rejects(
    module.attestSchema4HostedSourceClosure(
      v4HostedSourceContext([
        await v4HostedMultipartResponse(),
        await v4HostedMultipartResponse({
          metadata: v4HostedMetadata({ compressed_size: 1_013_393 }),
        }),
      ]),
      release,
      V4_TARGET_AFTER,
    ),
    /not stable across two rounds/u,
  );
});

const schema4EffectFixture = buildSchema4AuthorityFixture();

function createSchema4EffectHarness({
  invokeStatuses = [0, 0],
  expireDuringFinalLocalFence = false,
  forbidFullInitialize = false,
} = {}) {
  const fixture = schema4EffectFixture;
  const module = fixture.module;
  const chain = [fixture.plan1];
  let hostedState = fixture.beforeObserved;
  let clock = Date.parse(at(40_000));
  let invokeIndex = 0;
  let hostedPostflightIndex = 0;
  let hostedSourceIndex = 0;
  let ciFlipAfterHostedSourceIndex = null;
  let hostedFlipAfterPostflightIndex = null;
  const events = [];
  const tick = (step = 1_000) => {
    clock += step;
    return new Date(clock).toISOString();
  };
  const context = {
    stateDirectory: "/private/tmp/schema4-effect-state",
    receiptDirectory: "/private/tmp/schema4-effect-receipts",
    receiptBinding: Object.freeze({ bindingSha256: rawHash("schema4-binding") }),
    chain,
    provenance: fixture.context.provenance,
    sourceCiReceipt: fixture.context.sourceCiReceipt,
    accessBoundary: Object.freeze({
      productionBoundarySha256:
        fixture.bundle.attestation.productionBoundarySha256,
      targetDescriptorSha256: fixture.bundle.attestation.targetDescriptorSha256,
    }),
    source: fixture.context.source,
    ci: fixture.context.ci,
    ghLocalState: Object.freeze({}),
    dependencies: Object.freeze({}),
  };
  const append = (_context, expectedChain, fields) => {
    assert.equal(expectedChain, chain);
    const core = {
      ...fields,
      schemaVersion: 4,
      sequence: chain.length + 1,
      previousReceiptSha256: chain.at(-1)?.receiptSha256 ?? null,
      productionDenied: true,
    };
    const receipt = Object.freeze({
      ...core,
      receiptSha256: module.sha256(canonicalJson(core)),
    });
    module.validateSchema4ReceiptSemantic(receipt, chain);
    chain.push(receipt);
    events.push(`append:${receipt.kind}:${receipt.mutation ?? receipt.status}`);
    return Object.freeze({
      receipt,
      file: `/private/tmp/schema4-effect-receipts/${String(receipt.sequence)
        .padStart(6, "0")}.json`,
    });
  };
  const snapshotVector = value => Object.freeze({
    descriptorSha256: value.descriptorSha256,
    stateSha256: value.stateSha256,
    catalogSha256: value.catalogSha256,
    gateInventorySha256: value.gateInventorySha256,
    privacyInventorySha256: value.privacyInventorySha256,
    checkedCount: value.checkedCount,
  });
  const deploySandwich = beforeFunctionRows => {
    const plan = [...chain].reverse().find(receipt =>
      receipt.kind === "release-plan" && receipt.mutationScope === "function-deploy");
    const d0Clock = tick(2_000);
    const proofClock = tick(2_000);
    const d1Clock = tick(2_000);
    return v4SandwichFixture({
      module,
      d0Clock,
      proofClock,
      d1Clock,
      suffix: `effect-deploy:${invokeIndex}`,
      vector: snapshotVector(plan.snapshot),
      mainRows: V4_MAIN_AFTER_ROWS,
      financeRows: V4_FINANCE_ROWS,
      beforeFunctionRows,
      functionRows: fixture.afterDeployObserved.functions.rows,
    });
  };
  const harness = {
    initialize: () => {
      events.push("full-initialize");
      if (forbidFullInitialize) throw new Error("full initialize is forbidden");
      return context;
    },
    initializeLocal: () => {
      events.push("local-receipt-initialize");
      return context;
    },
    readBundle: () => fixture.bundle,
    readStable: () => {
      events.push("hosted-read");
      return Object.freeze({
        first: hostedState,
        second: hostedState,
        stable: true,
      });
    },
    mutationInputIsUnchanged: () => true,
    append,
    assertCurrent: () => {
      events.push("current-authority");
      if (
        ciFlipAfterHostedSourceIndex !== null
        && hostedSourceIndex > ciFlipAfterHostedSourceIndex
      ) {
        ciFlipAfterHostedSourceIndex = null;
        return Object.freeze({
          ...context.ci,
          runApiSha256: rawHash("schema4-hostile-second-ci-bookend"),
        });
      }
      return context.ci;
    },
    assertLocal: (_context, _input, _common, _release, plan) => {
      events.push("local-authority");
      if (expireDuringFinalLocalFence && invokeIndex === 0) {
        clock = Date.parse(plan.expiresAt);
      }
      return true;
    },
    readReceiptBinding: () => context.receiptBinding,
    readReceiptChain: () => chain,
    invokeCli: (_dependencies, args) => {
      events.push(`invoke:${args[0]}:${args[1]}`);
      const status = invokeStatuses[invokeIndex] ?? 0;
      invokeIndex += 1;
      if (status === 0) {
        hostedState = args[0] === "secrets"
          ? fixture.afterObserved : fixture.afterDeployObserved;
      }
      return Object.freeze({
        status,
        signal: null,
        error: null,
        stdout: status === 0 ? "ok\n" : "",
        cliInvoked: true,
      });
    },
    postflightTarget: (_context, _release, _bundle, beforeFunctionRows) => {
      events.push("target-postflight");
      return deploySandwich(beforeFunctionRows);
    },
    complete: ({ context: completionContext, release, bundle, cause }) => {
      events.push("completion-postflight");
      const vector = snapshotVector(cause.d1);
      const sandwich = v4SandwichFixture({
        module,
        d0Clock: tick(2_000),
        proofClock: tick(2_000),
        d1Clock: tick(2_000),
        suffix: `effect-completion:${invokeIndex}`,
        vector,
        mainRows: V4_MAIN_AFTER_ROWS,
        financeRows: V4_FINANCE_ROWS,
        beforeFunctionRows: cause.beforeFunctionInventoryRows,
        functionRows: cause.afterFunctionInventoryRows,
      });
      const fields = module.schema4CompletionFields({
        context: completionContext,
        release,
        bundle,
        chain,
        cause,
        sandwich,
        now: () => new Date(clock + 1_000),
      });
      clock = Math.max(clock, Date.parse(fields.recordedAt));
      return append(completionContext, chain, fields);
    },
    readPredecessor: () => Object.freeze({
      summary: fixture.plan1.predecessorAdoption,
    }),
    buildSnapshot: () => v4RuntimeSnapshot(
      new Date(clock - 1_000).toISOString(),
      "effect-plan2",
      fixture.vector2,
    ),
    readRawAuthority: () => module.validateMainFinanceRuntimeRecoveryV4ReleaseAuthority({
      receipts: chain,
      serializedReceipts: chain.map(receipt => `${canonicalJson(receipt)}\n`),
      sourceCiReceipt: fixture.sourceCi.receipt,
      serializedSourceCiReceipt: fixture.sourceCi.source,
      provenance: fixture.provenance,
      serializedProvenance: fixture.serializedProvenance,
    }),
    attestSource: () => {
      hostedSourceIndex += 1;
      events.push("hosted-source");
      return Object.freeze({
        hostedSourceClosureSha256: chain.at(-1).hostedSourceClosureSha256,
        hostedSourceMetadataSha256: chain.at(-1).hostedSourceMetadataSha256,
        hostedSourceClosureReadRounds: 2,
      });
    },
    postflightVerify: () => {
      const complete = chain.at(-1);
      hostedPostflightIndex += 1;
      const sandwich = v4SandwichFixture({
        module,
        d0Clock: tick(2_000),
        proofClock: tick(2_000),
        d1Clock: tick(2_000),
        suffix: `effect-hosted-bookend:${hostedPostflightIndex}`,
        vector: snapshotVector(complete.d1),
        mainRows: V4_MAIN_AFTER_ROWS,
        financeRows: V4_FINANCE_ROWS,
        beforeFunctionRows: complete.beforeFunctionInventoryRows,
        functionRows: complete.afterFunctionInventoryRows,
      });
      events.push("verify-postflight");
      if (
        hostedFlipAfterPostflightIndex !== null
        && hostedPostflightIndex >= hostedFlipAfterPostflightIndex + 2
      ) {
        hostedFlipAfterPostflightIndex = null;
        return Object.freeze({
          ...sandwich,
          d1MainInventorySha256: rawHash("schema4-hostile-second-hosted-bookend"),
        });
      }
      return sandwich;
    },
  };
  const common = Object.freeze({
    now: () => new Date(tick()),
  });
  const input = {
    approval: module.expectedApproval(fixture.plan1),
    priorStateDir: "/private/tmp/schema4-prior-state",
    stateDir: context.stateDirectory,
    receiptDir: context.receiptDirectory,
  };
  return Object.freeze({
    fixture,
    module,
    context,
    harness,
    common,
    input,
    events,
    setApproval(value) {
      input.approval = value;
    },
    setHostedState(value) {
      hostedState = value;
    },
    armCiBookendFlip() {
      ciFlipAfterHostedSourceIndex = hostedSourceIndex;
    },
    armHostedBookendFlip() {
      hostedFlipAfterPostflightIndex = hostedPostflightIndex;
    },
  });
}

test("schema-4 effectful lifecycle reaches two approved mutations, completion and fresh verify", async () => {
  const execution = createSchema4EffectHarness();
  globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
  try {
    const secret = await execution.module.operateSchema4Apply(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    assert.deepEqual({
      ok: secret.ok,
      mutation: secret.mutation,
      outcome: secret.outcome,
      hostedMutationCount: secret.hostedMutationCount,
      functionDeployCount: secret.functionDeployCount,
    }, {
      ok: true,
      mutation: "secrets-set",
      outcome: "state_satisfied",
      hostedMutationCount: 1,
      functionDeployCount: 0,
    });
    const plan2 = await execution.module.operateSchema4ResumePlan(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    execution.setApproval(plan2.approval);
    const deploy = await execution.module.operateSchema4Apply(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    assert.deepEqual({
      ok: deploy.ok,
      mutation: deploy.mutation,
      outcome: deploy.outcome,
      hostedMutationCount: deploy.hostedMutationCount,
      functionDeployCount: deploy.functionDeployCount,
    }, {
      ok: true,
      mutation: "function-deploy",
      outcome: "applied",
      hostedMutationCount: 2,
      functionDeployCount: 1,
    });
    assert.equal(execution.context.chain.length, 7);
    assert.equal(execution.events.filter(event => event.startsWith("invoke:")).length, 2);
    assert.equal(execution.context.chain.at(-1).kind, "release-complete");
    assert.equal(
      execution.module.validateMainFinanceRuntimeRecoveryV4ReleaseAuthority({
        receipts: execution.context.chain,
        serializedReceipts: execution.context.chain.map(receipt =>
          `${canonicalJson(receipt)}\n`),
        sourceCiReceipt: execution.fixture.sourceCi.receipt,
        serializedSourceCiReceipt: execution.fixture.sourceCi.source,
        provenance: execution.fixture.provenance,
        serializedProvenance: execution.fixture.serializedProvenance,
      }).completionReceiptSha256,
      execution.context.chain.at(-1).receiptSha256,
    );
    const verified = await execution.module.operateSchema4Verify(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    assert.equal(verified.status, "authoritative-live-verified");
    assert.equal(verified.hostedMutationCount, 2);
    assert.equal(verified.functionDeployCount, 1);
    const lastInvoke = execution.events.findLastIndex(event =>
      event.startsWith("invoke:"));
    const lastLocalBeforeInvoke = execution.events.lastIndexOf(
      "local-authority",
      lastInvoke,
    );
    const lastHostedBeforeInvoke = execution.events.lastIndexOf(
      "hosted-read",
      lastInvoke,
    );
    assert.ok(lastLocalBeforeInvoke >= 0 && lastLocalBeforeInvoke < lastInvoke);
    assert.ok(lastHostedBeforeInvoke >= 0 && lastHostedBeforeInvoke < lastInvoke);
    assert.equal(execution.events.filter(event => event === "hosted-source").length, 4);
    assert.equal(execution.events.filter(event => event === "verify-postflight").length, 4);
    assert.equal(execution.context.chain.some(receipt =>
      receipt.automaticRetryPerformed === true), false);
  } finally {
    delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
  }
});

async function advanceSchema4EffectHarnessToDeployPlan(execution) {
  const secret = await execution.module.operateSchema4Apply(
    execution.input,
    execution.common,
    execution.fixture.release,
  );
  assert.equal(secret.outcome, "state_satisfied");
  const plan2 = await execution.module.operateSchema4ResumePlan(
    execution.input,
    execution.common,
    execution.fixture.release,
  );
  execution.setApproval(plan2.approval);
}

test("schema-4 completion and verify require alternating source and hosted bookends", async () => {
  for (const arm of ["armCiBookendFlip", "armHostedBookendFlip"]) {
    const execution = createSchema4EffectHarness();
    globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
    try {
      await advanceSchema4EffectHarnessToDeployPlan(execution);
      execution[arm]();
      const deploy = await execution.module.operateSchema4Apply(
        execution.input,
        execution.common,
        execution.fixture.release,
      );
      assert.equal(deploy.outcome, "applied");
      assert.equal(deploy.ok, false);
      assert.equal(deploy.finalizationRequired, true);
      assert.equal(execution.context.chain.at(-1).kind, "mutation-result");
      assert.equal(execution.context.chain.at(-1).status, "verified");
    } finally {
      delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
    }
  }

  for (const [arm, pattern] of [
    ["armCiBookendFlip", /source authority changed across the hosted bookend/u],
    ["armHostedBookendFlip", /hosted evidence changed across the source authority bookend/u],
  ]) {
    const execution = createSchema4EffectHarness();
    globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
    try {
      await advanceSchema4EffectHarnessToDeployPlan(execution);
      const deploy = await execution.module.operateSchema4Apply(
        execution.input,
        execution.common,
        execution.fixture.release,
      );
      assert.equal(deploy.ok, true);
      execution[arm]();
      await assert.rejects(
        execution.module.operateSchema4Verify(
          execution.input,
          execution.common,
          execution.fixture.release,
        ),
        pattern,
      );
      assert.equal(execution.context.chain.at(-1).kind, "release-complete");
    } finally {
      delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
    }
  }
});

test("schema-4 effectful unknown outcomes reconcile once without retry across 8 and 9 receipts", async () => {
  for (const statuses of [
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const execution = createSchema4EffectHarness({ invokeStatuses: statuses });
    globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
    try {
      let secret = await execution.module.operateSchema4Apply(
        execution.input,
        execution.common,
        execution.fixture.release,
      );
      if (statuses[0] !== 0) {
        assert.equal(secret.outcome, "unknown");
        execution.setHostedState(execution.fixture.afterObserved);
        const beforeReconcileEvents = execution.events.length;
        secret = await execution.module.operateSchema4Reconcile(
          execution.input,
          execution.common,
          execution.fixture.release,
        );
        assert.equal(secret.outcome, "state_satisfied");
        const reconcileEvents = execution.events.slice(beforeReconcileEvents);
        for (const required of [
          "local-receipt-initialize", "full-initialize", "current-authority",
          "hosted-read", "local-authority",
        ]) assert.ok(reconcileEvents.includes(required), required);
        assert.equal(reconcileEvents.some(event => event.startsWith("invoke:")), false);
      }
      const plan2 = await execution.module.operateSchema4ResumePlan(
        execution.input,
        execution.common,
        execution.fixture.release,
      );
      execution.setApproval(plan2.approval);
      let deploy = await execution.module.operateSchema4Apply(
        execution.input,
        execution.common,
        execution.fixture.release,
      );
      if (statuses[1] !== 0) {
        assert.equal(deploy.outcome, "unknown");
        execution.setHostedState(execution.fixture.afterDeployObserved);
        const beforeReconcileEvents = execution.events.length;
        deploy = await execution.module.operateSchema4Reconcile(
          execution.input,
          execution.common,
          execution.fixture.release,
        );
        assert.equal(deploy.outcome, "applied");
        assert.equal(deploy.releaseReceiptSha256, execution.context.chain.at(-1).receiptSha256);
        const reconcileEvents = execution.events.slice(beforeReconcileEvents);
        for (const required of [
          "local-receipt-initialize", "full-initialize", "current-authority",
          "hosted-read", "local-authority",
        ]) assert.ok(reconcileEvents.includes(required), required);
        assert.equal(reconcileEvents.some(event => event.startsWith("invoke:")), false);
      }
      assert.equal(execution.context.chain.at(-1).kind, "release-complete");
      assert.equal(execution.context.chain.length, 7 + statuses.filter(status => status !== 0).length);
      assert.equal(execution.events.filter(event => event.startsWith("invoke:")).length, 2);
      assert.equal(execution.context.chain.filter(receipt =>
        receipt.kind === "reconciliation").length, statuses.filter(status => status !== 0).length);
      assert.equal(execution.context.chain.some(receipt =>
        receipt.automaticRetryPerformed === true), false);
      assert.equal(
        execution.module.validateMainFinanceRuntimeRecoveryV4ReleaseAuthority({
          receipts: execution.context.chain,
          serializedReceipts: execution.context.chain.map(receipt =>
            `${canonicalJson(receipt)}\n`),
          sourceCiReceipt: execution.fixture.sourceCi.receipt,
          serializedSourceCiReceipt: execution.fixture.sourceCi.source,
          provenance: execution.fixture.provenance,
          serializedProvenance: execution.fixture.serializedProvenance,
        }).completionReceiptSha256,
        execution.context.chain.at(-1).receiptSha256,
      );
    } finally {
      delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
    }
  }
});

test("schema-4 final approval expiry terminalizes before the CLI boundary", async () => {
  const execution = createSchema4EffectHarness({
    expireDuringFinalLocalFence: true,
  });
  globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
  try {
    const result = await execution.module.operateSchema4Apply(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    assert.equal(result.ok, false);
    assert.equal(result.outcome, "not_invoked");
    assert.equal(execution.events.some(event => event.startsWith("invoke:")), false);
    assert.equal(execution.context.chain.at(-1).status, "not_invoked");
    assert.equal(execution.context.chain.at(-1).invocationAttempted, false);
    assert.equal(execution.context.chain.at(-1).automaticRetryPerformed, false);
  } finally {
    delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
  }
});

test("schema-4 pending intent terminalizes locally without token, GitHub or hosted reads", async () => {
  const execution = createSchema4EffectHarness({ forbidFullInitialize: true });
  execution.harness.append(
    execution.context,
    execution.context.chain,
    execution.module.schema4MutationIntentFields(
      execution.fixture.plan1,
      execution.fixture.beforeObserved,
      at(50_000),
    ),
  );
  globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__ = execution.harness;
  try {
    const result = await execution.module.operateSchema4Reconcile(
      execution.input,
      execution.common,
      execution.fixture.release,
    );
    assert.equal(result.ok, false);
    assert.equal(result.outcome, "invocation_unproven");
    assert.equal(execution.context.chain.at(-1).status, "invocation_unproven");
    assert.equal(execution.context.chain.at(-1).invocationAttempted, "unproven");
    assert.equal(execution.events.filter(event =>
      event === "local-receipt-initialize").length, 1);
    for (const forbidden of [
      "full-initialize",
      "current-authority",
      "hosted-read",
      "hosted-source",
      "verify-postflight",
    ]) assert.equal(execution.events.includes(forbidden), false, forbidden);
    assert.equal(execution.events.some(event => event.startsWith("invoke:")), false);
  } finally {
    delete globalThis.__MAIN_FINANCE_SCHEMA4_TEST_HARNESS__;
  }
});

test("schema-4 returned NO-GO is a nonzero direct CLI result", t => {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "schema4-nogo-exit-fixture-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const scripts = path.join(parent, "scripts");
  mkdirSync(scripts, { recursive: true, mode: 0o700 });
  const marker = "const result = await operateMainFinanceRuntimeRecoveryV2();";
  const source = readFileSync(OPERATOR_FILE, "utf8");
  assert.equal(source.split(marker).length, 2);
  writeFileSync(
    path.join(scripts, path.basename(OPERATOR_FILE)),
    source.replace(marker, "const result = Object.freeze({ ok: false, mode: \"schema4-nogo\" });"),
    { mode: 0o600 },
  );
  copyFileSync(
    path.join(ROOT, "scripts/main-finance-runtime-recovery-v2-snapshot.mjs"),
    path.join(scripts, "main-finance-runtime-recovery-v2-snapshot.mjs"),
  );
  const result = spawnSync(process.execPath, [
    path.join(scripts, path.basename(OPERATOR_FILE)),
  ], {
    cwd: parent,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", NO_COLOR: "1" },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    mode: "schema4-nogo",
    ok: false,
  });
});

test("checked-in READY manifest pins every release byte and measured catalog", () => {
  const checked = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  assert.equal(checked.schemaVersion, 4);
  assert.equal(
    checked.kind,
    "main-finance-runtime-recovery-v4-target-redeploy-staging-release",
  );
  assert.equal(
    checked.releaseStatus,
    "READY_FOR_SOURCE_ATTESTATION",
  );
  assert.deepEqual(Object.keys(checked.sourceLineage).sort(), [
    "baseCommitSha",
    "baseTreeSha",
    "changedPaths",
    "expectedTrackedFileCount",
    "requiredSoleParentSha",
  ]);
  assert.equal(
    Object.hasOwn(checked.sourceLineage, "expectedReleaseCommitSha"),
    false,
  );
  assert.equal(
    Object.hasOwn(checked.sourceLineage, "expectedReleaseTreeSha"),
    false,
  );
  assert.equal(checked.sourceCi.workflowBlobSha, WORKFLOW_BLOB);
  assert.equal(gitBlobSha(WORKFLOW_FILE), checked.sourceCi.workflowBlobSha);
  assert.equal(checked.sourceLineage.expectedTrackedFileCount, 935);
  assert.deepEqual(checked.sourceLineage.changedPaths, EXPECTED_CHANGED_PATHS);
  assert.equal(
    checked.expectedDatabaseCatalogSha256,
    "a971eb0b475390073157d21ab2030896af9e97b052f290d41cf6678c24ecee50",
  );
  assert.doesNotMatch(
    readFileSync(MANIFEST_FILE, "utf8"),
    /INSERT_AFTER_READ_ONLY_CATALOG_REVIEW/u,
  );
  for (const specification of [
    checked.environmentContract,
    checked.preflightSql,
    checked.postflightContract,
  ]) {
    assert.equal(
      sha256(readFileSync(path.join(ROOT, specification.path))),
      specification.sha256,
      `${specification.path} bytes must match the checked-in manifest`,
    );
  }
  const environment = JSON.parse(readFileSync(ENVIRONMENT_FILE, "utf8"));
  const postflight = JSON.parse(readFileSync(POSTFLIGHT_FILE, "utf8"));
  assert.equal(environment.schemaVersion, 4);
  assert.equal(
    environment.kind,
    "main-finance-runtime-recovery-v4-target-redeploy-environment-contract",
  );
  assert.deepEqual(environment.secretMutation.mutationNames, SUCCESSOR_MUTATION_NAMES);
  assert.deepEqual(
    environment.secretMutation.proofOnlyGeneratedSecretNames,
    [
      "MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2",
      "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
    ],
  );
  assert.equal(environment.secretMutation.fullProofRuntimeCount, 13);
  assert.equal(environment.secretMutation.rebuiltStableRuntimeCount, 11);
  assert.deepEqual(
    environment.secretMutation.metadataOnlyUpdatedAtAllowlist,
    SUCCESSOR_METADATA_ONLY_NAMES,
  );
  assert.deepEqual(environment.secretMutation.allowedFunctionVersionTransitions, [
    "unchanged",
    "exact-all-existing-plus-one",
    "exact-target-replacement-plus-one",
  ]);
  assert.equal(environment.secretMutation.functionDeployAllowed, true);
  assert.equal(
    environment.secretMutation.functionDeployTarget,
    "finance-manage-access-v2",
  );
  assert.equal(
    environment.secretMutation.functionDeployTransition,
    "exact-target-replacement-plus-one",
  );
  assert.equal(environment.secretMutation.causalAttributionClaimed, false);
  assert.deepEqual(checked.mutations.exactSecretSetNames, SUCCESSOR_MUTATION_NAMES);
  assert.deepEqual(
    checked.mutations.metadataOnlyUpdatedAtAllowlist,
    SUCCESSOR_METADATA_ONLY_NAMES,
  );
  assert.equal(checked.mutations.exactHostedMutationCount, 2);
  assert.equal(checked.mutations.exactFunctionDeployCount, 1);
  assert.equal(checked.edgeFunction.deployAuthorized, true);
  assert.equal(Object.hasOwn(checked.edgeFunction, "deployArgs"), false);
  assert.equal(postflight.schemaVersion, 4);
  assert.equal(
    postflight.kind,
    "main-finance-runtime-recovery-v4-target-redeploy-postflight-contract",
  );
  assert.deepEqual(
    postflight.snapshotSandwich.functionInventoryPhases.allowedDispositions,
    ["exact-target-replacement-plus-one"],
  );
  assert.equal(
    postflight.snapshotSandwich.functionInventoryPhases.functionDeployAuthorized,
    true,
  );
  assert.equal(postflight.authority.hostedMutationCount, 2);
  assert.equal(postflight.authority.functionDeployCount, 1);
  assert.equal(postflight.authority.automaticRetryAllowed, false);
  assert.deepEqual(environment.currentAuthorityRoot, {
    requiredActions: ["plan", "apply", "reconcile", "verify"],
    rootMode: "0700",
    rootOwnerRequired: true,
    rootRealDirectoryRequired: true,
    rootSymlinksAllowed: false,
    outsideRepository: true,
    commonParentRequired: true,
    stateDirectoryLifecycle: {
      argument: "--state-dir", directChildRequired: true,
      freshPlanMustBeAbsent: true, createdMode: "0700",
      createdOwnerRequired: true, existingActionsRequireRealDirectory: true,
      symlinksAllowed: false,
    },
    receiptDirectory: {
      argument: "--receipt-dir", directChildRequired: true,
      mustExistBeforeLease: true, mode: "0700", ownerRequired: true,
      realDirectoryRequired: true, symlinksAllowed: false,
    },
    directChildFiles: [
      {
        argument: "--release-provenance", mode: "0600", ownerRequired: true,
        regularFileRequired: true, singleLinkRequired: true,
        symlinksAllowed: false,
      },
      {
        argument: "--source-ci-receipt", mode: "0600", ownerRequired: true,
        regularFileRequired: true, singleLinkRequired: true,
        symlinksAllowed: false,
      },
      {
        argument: "--production-boundary", mode: "0600", ownerRequired: true,
        regularFileRequired: true, singleLinkRequired: true,
        symlinksAllowed: false,
      },
      {
        argument: "--target-config", mode: "0600", ownerRequired: true,
        regularFileRequired: true, singleLinkRequired: true,
        symlinksAllowed: false,
      },
    ],
    predecessorRootDistinctAndNonNestedBothWays: true,
    validatedAfterReadyManifestBeforeLease: true,
  });
  const expectedClosurePaths = [
    "supabase/config.toml",
    "supabase/functions/_shared/main-edge-runtime.ts",
    "supabase/functions/_shared/main-finance-protocol.mjs",
    "supabase/functions/finance-manage-access-v2/deno.json",
    "supabase/functions/finance-manage-access-v2/deno.lock",
    "supabase/functions/finance-manage-access-v2/index.ts",
  ];
  assert.deepEqual(
    checked.deploymentClosureFiles.map(item => item.path),
    expectedClosurePaths,
  );
  for (const item of checked.deploymentClosureFiles) {
    assert.equal(item.mode, "100644");
    assert.equal(
      sha256(readFileSync(path.join(ROOT, item.path))),
      item.sha256,
      `${item.path} bytes must match the checked-in closure`,
    );
  }
  assert.equal(
    sha256(checked.deploymentClosureFiles
      .map(item => `${item.path}\0${item.mode}\0${item.sha256}\n`).join("")),
    checked.deploymentClosureSetSha256,
  );

});

test("raw reducer measurement authority accepts canonical evidence and rejects operation or chain drift", () => {
  const fields = measurementFields();
  assertTransition(transition([], {
    action: "measure", now: fields.recordedAt, effectPayload: fields,
  }), "measure-read-only-verified", "append-catalog-measurement");
  assert.throws(() => transition([], {
    action: "measure",
    now: fields.recordedAt,
    effectPayload: fields,
    operationCurrentSha256: rawHash("other-operation"),
  }), /operation boundary/u);
  const chain = [];
  appendPlan(chain);
  assert.throws(() => transition(chain, {
    action: "measure", now: at(2_000), effectPayload: measurementFields(at(2_000)),
  }), /measurement authority/u);
});

test("persisted plan secret digest order remains valid without issuing mutation authority", () => {
  const secretNames = Object.freeze([
    "Z_MANAGED_SECRET",
    "A_MANAGED_SECRET",
  ]);
  const expectedDigests = Object.freeze({
    Z_MANAGED_SECRET: rawHash("z-managed-secret"),
    A_MANAGED_SECRET: rawHash("a-managed-secret"),
  });
  const planPayload = planFields();
  assertTransition(transition([], {
    action: "plan",
    now: planPayload.recordedAt,
    expectedDigests,
    secretNames,
    effectPayload: planPayload,
  }), "issue-plan", "append-release-plan", "secrets-set+function-deploy");

  const chain = [];
  const plan = appendFixture(chain, planPayload);
  const persisted = JSON.parse(canonicalJson({ expectedDigests, secretNames }));
  assert.deepEqual(Object.keys(persisted.expectedDigests), [
    "A_MANAGED_SECRET",
    "Z_MANAGED_SECRET",
  ]);
  assert.deepEqual(persisted.secretNames, secretNames);

  const intentPayload = {
    ...intentFields(plan, "secrets-set", {
      recordedAt: at(2_000),
      main: PRE_MAIN,
      finance: PRE_FINANCE,
    }),
    expectedSecretDigestSetSha256: sha256(canonicalJson(
      persisted.expectedDigests,
    )),
    secretNames: persisted.secretNames,
  };
  const authority = transition(chain, {
    action: "apply",
    checkpoint: "before-intent",
    now: at(2_000),
    mutation: "secrets-set",
    expectedDigests: persisted.expectedDigests,
    secretNames: persisted.secretNames,
    effectPayload: intentPayload,
  });
  assertTransition(
    authority,
    "record-mutation-intent",
    "append-mutation-intent",
    "secrets-set+function-deploy",
    "secrets-set",
  );
  assert.equal(authority.effectPerformed, false);
  assert.equal(chain.length, 1);

  assert.throws(() => transition(chain, {
    action: "apply",
    checkpoint: "before-intent",
    now: at(2_000),
    mutation: "secrets-set",
    expectedDigests: {
      ...persisted.expectedDigests,
      EXTRA_MANAGED_SECRET: rawHash("extra-managed-secret"),
    },
    secretNames: persisted.secretNames,
    effectPayload: intentPayload,
  }), /expected secret evidence differs/u);
});

test("persisted schema-3 mutation digest map is order-independent and exact", async t => {
  const {
    assertCurrentReleaseSecretsOnlyBundle,
    validSuccessorMutationSecretDigestMap,
  } = await importInternalGeneratedRuntimeSecrets(t);
  const digestMap = Object.fromEntries(SCHEMA3_MUTATION_NAMES.map(name => [
    name,
    rawHash(`successor-mutation:${name}`),
  ]));
  const attestation = {
    schemaVersion: 3,
    kind: "main-finance-runtime-recovery-v3-private-bundle",
    predecessorAdoption: SUCCESSOR_ADOPTION,
    runtimeFile: "runtime-proof.env",
    runtimeMutationFile: "runtime-install.env",
    mutationSecretNames: SCHEMA3_MUTATION_NAMES,
    mutationSecretDigests: digestMap,
  };
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v3-persisted-digest-map-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const attestationFile = path.join(parent, "bundle.attestation.json");
  writeFileSync(attestationFile, `${canonicalJson(attestation)}\n`, { mode: 0o600 });
  const persisted = JSON.parse(readFileSync(attestationFile, "utf8"));
  assert.deepEqual(
    Object.keys(persisted.mutationSecretDigests),
    [...SCHEMA3_MUTATION_NAMES].sort(),
  );
  assert.equal(validSuccessorMutationSecretDigestMap(
    persisted.mutationSecretDigests,
    SCHEMA3_MUTATION_NAMES,
  ), true);
  assert.equal(
    assertCurrentReleaseSecretsOnlyBundle(persisted, {
      predecessorAdoption: SUCCESSOR_ADOPTION,
    }),
    persisted,
  );

  const hostileMaps = [
    null,
    [],
    Object.fromEntries(Object.entries(persisted.mutationSecretDigests).slice(1)),
    { ...persisted.mutationSecretDigests, EXTRA_SECRET: rawHash("extra") },
    {
      ...Object.fromEntries(Object.entries(persisted.mutationSecretDigests).slice(1)),
      WRONG_SECRET: rawHash("wrong"),
    },
    { ...persisted.mutationSecretDigests, [SCHEMA3_MUTATION_NAMES[0]]: "not-a-sha" },
  ];
  for (const mutationSecretDigests of hostileMaps) {
    assert.equal(validSuccessorMutationSecretDigestMap(
      mutationSecretDigests,
      SCHEMA3_MUTATION_NAMES,
    ), false);
    assert.throws(() => assertCurrentReleaseSecretsOnlyBundle({
      ...persisted,
      mutationSecretDigests,
    }, { predecessorAdoption: SUCCESSOR_ADOPTION }), /schema-3 secrets-only private bundle/u);
  }
  for (const forbidden of ["deployMutationInput", "deployWorkdir"]) {
    assert.throws(() => assertCurrentReleaseSecretsOnlyBundle({
      ...persisted,
      [forbidden]: forbidden === "deployMutationInput" ? [] : "/private/tmp/deploy",
    }, { predecessorAdoption: SUCCESSOR_ADOPTION }), /schema-3 secrets-only private bundle/u);
  }
  assert.equal(
    (readFileSync(OPERATOR_FILE, "utf8")
      .match(/!validSuccessorMutationSecretDigestMap\(/gu) ?? []).length,
    4,
  );
});

test("raw reducer plan through verify matrix binds exact receipts commands and fresh evidence", () => {
  const chain = [];
  const planPayload = planFields();
  assert.throws(() => transition(chain, {
    now: planPayload.recordedAt,
    effectPayload: { ...planPayload, schemaVersion: 999 },
  }), /authoritative envelope/u);
  assert.throws(() => transition(chain, {
    now: planPayload.recordedAt,
    effectPayload: {
      ...planPayload,
      productionBoundarySha256: rawHash("substituted-production-boundary"),
    },
  }), /release plan payload binding/u);
  assert.throws(() => transition(chain, {
    now: planPayload.recordedAt,
    effectPayload: {
      ...planPayload,
      snapshot: {
        ...planPayload.snapshot,
        databaseClock: at(31_001),
      },
    },
  }), /snapshot exceeds future clock skew/u);
  assert.throws(() => transition(chain, {
    now: planPayload.recordedAt,
    effectPayload: {
      ...planPayload,
      functionVersionTransition: {
        ...planPayload.functionVersionTransition,
        currentStageExactAllExistingPlusOneFunctionInventorySha256:
          rawHash("forged-current-stage-plus-one"),
      },
    },
  }), /release plan payload binding/u);
  const unsafeSecretBearingPlusOne = planFields({
    functions: POST_SECRET_FUNCTIONS,
  });
  assert.throws(() => transition(chain, {
    now: unsafeSecretBearingPlusOne.recordedAt,
    functions: POST_SECRET_FUNCTIONS,
    effectPayload: unsafeSecretBearingPlusOne,
  }), /unchanged function stage baseline|release plan receipt/u);
  const planAuthority = transition(chain, {
    now: planPayload.recordedAt, effectPayload: planPayload,
  });
  assertTransition(
    planAuthority,
    "issue-plan",
    "append-release-plan",
    "secrets-set+function-deploy",
  );
  const planCore = {
    schemaVersion: 2,
    sequence: 1,
    previousReceiptSha256: null,
    productionDenied: true,
    ...planPayload,
  };
  assert.equal(planAuthority.payloadSha256, sha256(canonicalJson(planPayload)));
  assert.equal(
    planAuthority.authorizedReceiptSha256,
    sha256(canonicalJson(planCore)),
  );
  assert.equal(planAuthority.chainTailSha256, null);
  const plan = appendFixture(chain, planPayload);
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-intent", now: plan.recordedAt,
    mutation: "secrets-set",
    effectPayload: intentFields(plan, "secrets-set", {
      recordedAt: plan.recordedAt, main: PRE_MAIN, finance: PRE_FINANCE,
    }),
  }), /candidate clock/u);

  const secretIntentPayload = intentFields(plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  for (const tamperedIntent of [
    {
      ...secretIntentPayload,
      exactAllExistingPlusOneFunctionInventorySha256:
        rawHash("forged-intent-plus-one"),
    },
    {
      ...secretIntentPayload,
      requiredStableReadRounds: 3,
    },
    {
      ...secretIntentPayload,
      predecessorAdoptionSha256: rawHash("forged-intent-adoption"),
    },
  ]) {
    assert.throws(() => transition(chain, {
      action: "apply", checkpoint: "before-intent", now: at(2_000),
      mutation: "secrets-set", effectPayload: tamperedIntent,
    }), /transition evidence differs|raw evidence binding differs/u);
  }
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "before-intent", now: at(2_000),
    mutation: "secrets-set", effectPayload: secretIntentPayload,
  }), "record-mutation-intent", "append-mutation-intent",
  "secrets-set+function-deploy", "secrets-set");
  const secretIntent = appendFixture(chain, secretIntentPayload);
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_100),
    mutation: "secrets-set",
    effectPayload: {
      ...commandPayload("secrets-set"),
      mutationInputSha256: rawHash("substituted-runtime-input"),
    },
  }), /mutation command payload differs/u);
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_100),
    mutation: "secrets-set",
    effectPayload: {
      ...commandPayload("secrets-set"),
      argsSha256: rawHash("substituted-runtime-args"),
    },
  }), /mutation command payload differs/u);
  const secretInvokeAuthority = transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_100),
    mutation: "secrets-set", effectPayload: commandPayload("secrets-set"),
  });
  assertTransition(secretInvokeAuthority, "authorize-cli-invocation", "invoke-secrets-set",
    "secrets-set+function-deploy", "secrets-set");
  assert.equal(
    secretInvokeAuthority.payloadSha256,
    sha256(canonicalJson(commandPayload("secrets-set"))),
  );
  assert.equal(secretInvokeAuthority.authorizedReceiptSha256, null);
  assert.equal(secretInvokeAuthority.chainTailSha256, secretIntent.receiptSha256);
  const secretResultPayload = mutationResultFields(secretIntent, {
    recordedAt: at(3_000),
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "after-mutation", now: at(3_000),
    mutation: "secrets-set", mutationOutcome: "success",
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    effectPayload: secretResultPayload,
  }), "secrets-verified", "append-verified-mutation-result",
  "secrets-set+function-deploy", "function-deploy");
  appendFixture(chain, secretResultPayload);

  const deployIntentPayload = intentFields(plan, "function-deploy", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "before-intent", now: at(4_000),
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, effectPayload: deployIntentPayload,
  }), "record-mutation-intent", "append-mutation-intent",
  "secrets-set+function-deploy", "function-deploy");
  const deployIntent = appendFixture(chain, deployIntentPayload);
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(4_100),
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE,
    effectPayload: commandPayload("function-deploy"),
  }), "authorize-cli-invocation", "invoke-function-deploy",
  "secrets-set+function-deploy", "function-deploy");

  const postflight = postflightFixture();
  const prematureDeployResultPayload = mutationResultFields(deployIntent, {
    recordedAt: postflight.d1.databaseClock,
    proofSha256: postflight.proof.proofSha256,
    d0ResponseSha256: postflight.d0.responseSha256,
  });
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "after-mutation",
    now: postflight.d1.databaseClock,
    mutation: "function-deploy", mutationOutcome: "success",
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: postflight,
    effectPayload: prematureDeployResultPayload,
  }), /function result clock precedes postflight D1/u);
  const deployResultPayload = mutationResultFields(deployIntent, {
    recordedAt: at(11_000), proofSha256: postflight.proof.proofSha256,
    d0ResponseSha256: postflight.d0.responseSha256,
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "after-mutation", now: at(11_000),
    mutation: "function-deploy", mutationOutcome: "success",
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: postflight,
    effectPayload: deployResultPayload,
  }), "function-verified", "append-verified-mutation-result");
  const deployResult = appendFixture(chain, deployResultPayload);
  const sameProofCompletionPayload = completionFields(plan, deployResult, postflight);
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: postflight,
    effectPayload: sameProofCompletionPayload,
  }), /completion|causal/u);
  const sameD0CompletionPostflight = postflightFixture({
    proofSha256: rawHash("fresh-proof-with-reused-d0"),
  });
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS,
    postflightEvidence: sameD0CompletionPostflight,
    effectPayload: completionFields(plan, deployResult, sameD0CompletionPostflight),
  }), /completion|causal/u);
  const completionPostflight = postflightFixture({
    proofSha256: rawHash("fresh-completion-proof"),
    d0ResponseLabel: "fresh-completion-d0-response",
    d1ResponseLabel: "fresh-completion-d1-response",
  });
  assert.notEqual(
    completionPostflight.proof.proofSha256,
    deployResult.hostedProofSha256,
  );
  const completePayload = completionFields(
    plan,
    deployResult,
    completionPostflight,
  );
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: completionPostflight,
    effectPayload: {
      ...completePayload,
      operatorDescriptorFileSha256: rawHash("substituted-operator-descriptor"),
    },
  }), /release completion causal binding|raw evidence binding/u);
  assertTransition(transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: completionPostflight,
    effectPayload: completePayload,
  }), "release-complete-eligible", "append-release-complete");
  appendFixture(chain, completePayload);
  const verificationPostflight = postflightFixture({
    proofSha256: rawHash("fresh-verification-proof"),
    d0ResponseLabel: "fresh-verification-d0-response",
    d1ResponseLabel: "fresh-verification-d1-response",
  });
  assertTransition(transition(chain, {
    action: "verify", now: at(13_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: INSTALLED_FUNCTIONS,
    postflightEvidence: verificationPostflight,
  }), "verification-evidence-consistent", "none");
});

test("raw reducer plan determinism and latest-intent command gate", () => {
  const chain = [];
  const payload = planFields();
  const first = transition(chain, { now: payload.recordedAt, effectPayload: payload });
  assertTransition(first, "issue-plan", "append-release-plan", "secrets-set+function-deploy");
  assert.deepEqual(
    transition(chain, { now: payload.recordedAt, effectPayload: payload }),
    first,
  );
  const plan = appendFixture(chain, payload);
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_000),
    mutation: "secrets-set", effectPayload: commandPayload("secrets-set"),
  }), /latest durable mutation intent/u);
  const intentPayload = intentFields(plan, "secrets-set", {
    recordedAt: at(2_100), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "before-intent", now: at(2_100),
    mutation: "secrets-set", effectPayload: intentPayload,
  }), "record-mutation-intent", "append-mutation-intent",
  "secrets-set+function-deploy", "secrets-set");
});

test("raw reducer operation binding and function inventory schema matrix", () => {
  const payload = planFields();
  assert.throws(() => transition([], {
    now: payload.recordedAt,
    effectPayload: payload,
    operationCurrentSha256: rawHash("overlap"),
  }), /operation boundary/u);
  const preinstallRows = [PURE_UNRELATED_FUNCTION];
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows, currentRows: preinstallRows,
  }), "absent");
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows, currentRows: [PURE_UNRELATED_FUNCTION, PURE_EXACT_FUNCTION],
  }), "exact-sole-addition");
  for (const missing of [
    "id", "name", "slug", "ezbr_sha256", "entrypoint_path", "status",
    "verify_jwt", "version", "created_at", "updated_at",
  ]) {
    const incomplete = { ...PURE_UNRELATED_FUNCTION };
    delete incomplete[missing];
    assert.throws(() => classifyMainFinanceRuntimeRecoveryV2FunctionState({
      preinstallRows: [incomplete], currentRows: [incomplete],
    }), /function inventory/u);
    const incompleteTarget = { ...PURE_EXACT_FUNCTION };
    delete incompleteTarget[missing];
    assert.throws(() => classifyMainFinanceRuntimeRecoveryV2FunctionState({
      preinstallRows,
      currentRows: [PURE_UNRELATED_FUNCTION, incompleteTarget],
    }), /function inventory/u);
  }
  const targetFieldDrifts = [
    ["verify_jwt", true, "wrong-verify-jwt"],
    ["status", "INACTIVE", "wrong-status"],
    ["version", 2, "wrong-version"],
  ];
  assert.deepEqual(
    targetFieldDrifts.map(([field]) => field),
    ["verify_jwt", "status", "version"],
  );
  for (const [field, value, expected] of targetFieldDrifts) {
    assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows,
    currentRows: [PURE_UNRELATED_FUNCTION, { ...PURE_EXACT_FUNCTION, [field]: value }],
    }), expected);
  }
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionState({
    preinstallRows,
    currentRows: [{ ...PURE_UNRELATED_FUNCTION, version: 4 }, PURE_EXACT_FUNCTION],
  }), "diverged");

  assert.deepEqual(
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(PRE_FUNCTIONS),
    POST_SECRET_FUNCTIONS,
  );
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
    beforeRows: PRE_FUNCTIONS,
    afterRows: PRE_FUNCTIONS,
  }), "unchanged");
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
    beforeRows: PRE_FUNCTIONS,
    afterRows: POST_SECRET_FUNCTIONS,
  }), "exact-all-existing-plus-one");
  const withExtras = functionInventoryRow({
    id: "55555555-5555-4555-8555-555555555555",
    slug: "extra-fields-function",
    verify_jwt: false,
    version: 12,
    import_map: true,
    import_map_path: "file:///tmp/extra-fields-function/deno.json",
    future_cli_field: "preserve-me",
  });
  const [withExtrasPlusOne] =
    expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows([withExtras]);
  assert.deepEqual(withExtrasPlusOne, {
    ...withExtras,
    version: 13,
  });
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
    beforeRows: [withExtras],
    afterRows: [{ ...withExtrasPlusOne, future_cli_field: "changed" }],
  }), "diverged");

  const secondFunction = functionInventoryRow({
    id: "33333333-3333-4333-8333-333333333333",
    slug: "second-unrelated-function",
    verify_jwt: false,
    version: 8,
  });
  const twoBefore = Object.freeze([PURE_UNRELATED_FUNCTION, secondFunction]);
  const rejectedTransitions = [
    [{ ...PURE_UNRELATED_FUNCTION, version: 5 }],
    [{ ...PURE_UNRELATED_FUNCTION, version: 2 }],
    [{ ...PURE_UNRELATED_FUNCTION, verify_jwt: false, version: 4 }],
    [],
    [PURE_UNRELATED_FUNCTION, secondFunction, functionInventoryRow({
      id: "44444444-4444-4444-8444-444444444444",
      slug: "third-unrelated-function", verify_jwt: true, version: 1,
    })],
    [PURE_EXACT_FUNCTION],
  ];
  for (const afterRows of rejectedTransitions) {
    assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
      beforeRows: PRE_FUNCTIONS,
      afterRows,
    }), "diverged");
  }
  assert.equal(classifyMainFinanceRuntimeRecoveryV2FunctionVersionTransition({
    beforeRows: twoBefore,
    afterRows: [
      { ...PURE_UNRELATED_FUNCTION, version: 4 },
      secondFunction,
    ],
  }), "diverged");
  assert.throws(
    () => expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows([{
      ...PURE_UNRELATED_FUNCTION,
      version: Number.MAX_SAFE_INTEGER,
    }]),
    /cannot be incremented safely/u,
  );
});

test("secrets-only successor rejects value drift and accepts only exact 13-row function transitions", () => {
  const beforeSecrets = new Map([
    ["SUPABASE_URL", Object.freeze({
      name: "SUPABASE_URL",
      value: rawHash("stable-supabase-url"),
      updatedAt: at(1_000),
    })],
    ["UNRELATED_SECRET", Object.freeze({
      name: "UNRELATED_SECRET",
      value: rawHash("stable-unrelated-secret"),
      updatedAt: at(1_000),
    })],
  ]);
  const metadataOnly = new Map([...beforeSecrets].map(([name, row]) => [
    name,
    Object.freeze({
      ...row,
      updatedAt: name === "SUPABASE_URL" ? at(2_000) : row.updatedAt,
    }),
  ]));
  assert.deepEqual(metadataOnlyInventoryDelta(beforeSecrets, metadataOnly).names, [
    "SUPABASE_URL",
  ]);
  const valueDrift = new Map(metadataOnly);
  valueDrift.set("SUPABASE_URL", Object.freeze({
    ...valueDrift.get("SUPABASE_URL"),
    value: rawHash("hostile-value-drift"),
  }));
  assert.throws(
    () => metadataOnlyInventoryDelta(beforeSecrets, valueDrift),
    /secret value drift/u,
  );
  const unrelatedMetadataDrift = new Map(beforeSecrets);
  unrelatedMetadataDrift.set("UNRELATED_SECRET", Object.freeze({
    ...unrelatedMetadataDrift.get("UNRELATED_SECRET"),
    updatedAt: at(2_000),
  }));
  assert.throws(
    () => metadataOnlyInventoryDelta(beforeSecrets, unrelatedMetadataDrift),
    /outside the exact successor allow-list/u,
  );

  const baseline = Object.freeze([
    PURE_EXACT_FUNCTION,
    ...Array.from({ length: 12 }, (_, index) => functionInventoryRow({
      id: `${(index + 3).toString(16).padStart(8, "0")}-3333-4333-8333-${(index + 3).toString(16).padStart(12, "0")}`,
      slug: `successor-baseline-${String(index + 1).padStart(2, "0")}`,
      verify_jwt: index % 2 === 0,
      version: index + 2,
      future_cli_field: `stable-${index + 1}`,
    })),
  ]);
  assert.equal(baseline.length, 13);
  const plusOne = Object.freeze(baseline.map(row => Object.freeze({
    ...row,
    version: row.version + 1,
  })));
  assert.equal(classifyAllExistingFunctionVersionTransition({
    beforeRows: baseline,
    afterRows: baseline,
  }), "unchanged");
  assert.equal(classifyAllExistingFunctionVersionTransition({
    beforeRows: baseline,
    afterRows: plusOne,
  }), "exact-all-existing-plus-one");
  for (const afterRows of [
    plusOne.map((row, index) => index === 0 ? { ...row, version: row.version + 1 } : row),
    plusOne.map((row, index) => index === 0 ? baseline[index] : row),
    plusOne.slice(1),
    [...plusOne, functionInventoryRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      slug: "successor-extra-row",
      verify_jwt: true,
      version: 1,
    })],
    plusOne.map((row, index) => index === 0
      ? { ...row, future_cli_field: "hostile-field-drift" }
      : row),
  ]) {
    assert.equal(classifyAllExistingFunctionVersionTransition({
      beforeRows: baseline,
      afterRows,
    }), "diverged");
  }
});

test("secrets-only mutation evidence binds the exact mutation file and detects its drift", t => {
  const directory = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v3-mutation-input-",
  ));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const mutationFile = path.join(directory, "runtime-install.env");
  const proofFile = path.join(directory, "runtime-proof.env");
  const mutationSource = SCHEMA3_MUTATION_NAMES
    .map(name => `${name}=${rawHash(name)}`)
    .join("\n") + "\n";
  writeFileSync(mutationFile, mutationSource, { mode: 0o600 });
  writeFileSync(proofFile, `${mutationSource}PROOF_ONLY=value\n`, { mode: 0o600 });
  chmodSync(mutationFile, 0o600);
  chmodSync(proofFile, 0o600);
  const runtimeMutationInput = captureRuntimeMutationInput(
    mutationFile,
    sha256(mutationSource),
  );
  const bundle = Object.freeze({
    runtimeMutationInput,
    secretMutationFile: mutationFile,
    runtimeFile: proofFile,
    attestation: Object.freeze({
      runtimeMutationFileSha256: sha256(mutationSource),
      runtimeFileSha256: sha256(readFileSync(proofFile)),
    }),
  });
  const exact = declarativeMutationInputEvidence(bundle, null, "secrets-set");
  assert.equal(exact.currentSha256, exact.expectedSha256);

  writeFileSync(proofFile, `${mutationSource}PROOF_ONLY=changed\n`, { mode: 0o600 });
  chmodSync(proofFile, 0o600);
  const proofOnlyDrift = declarativeMutationInputEvidence(bundle, null, "secrets-set");
  assert.equal(proofOnlyDrift.currentSha256, proofOnlyDrift.expectedSha256);

  writeFileSync(
    mutationFile,
    mutationSource.replace(rawHash(SCHEMA3_MUTATION_NAMES[0]), rawHash("drift")),
    { mode: 0o600 },
  );
  chmodSync(mutationFile, 0o600);
  const mutationDrift = declarativeMutationInputEvidence(bundle, null, "secrets-set");
  assert.equal(mutationDrift.currentSha256, null);
  assert.notEqual(mutationDrift.currentSha256, mutationDrift.expectedSha256);
});

test("schema v2 preserves exact legacy receipts and requires amended recovery variants", async t => {
  const { readReceiptChain, validateReceiptSemantic } =
    await importInternalReceiptSemantic(t);
  const omit = (value, keys) => Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
  const transitionKeys = [
    "beforeFunctionInventorySha256",
    "unchangedFunctionInventorySha256",
    "exactAllExistingPlusOneFunctionInventorySha256",
    "requiredStableReadRounds",
    "predecessorAdoptionSha256",
  ];
  const resultKeys = [
    "afterFunctionInventorySha256",
    "functionVersionTransitionDisposition",
    "functionInventoryStableReadRounds",
    "predecessorAdoptionSha256",
    "observation",
    "state",
    "causalAttribution",
  ];
  const reconciliationKeys = [
    "observation",
    "state",
    "causalAttribution",
    "functionVersionTransitionDisposition",
    "inventoryReadRounds",
    "stableObservation",
    "predecessorAdoptionSha256",
  ];

  const legacy = [];
  const legacyPlan = appendFixture(
    legacy,
    omit(planFields(), ["functionVersionTransition", "predecessorAdoption"]),
  );
  assert.throws(
    () => validateReceiptSemantic(legacyPlan, []),
    /release plan schema variant differs/u,
  );
  validateReceiptSemantic(legacyPlan, [], { variant: "pinned-predecessor" });
  const legacyIntent = appendFixture(legacy, omit(intentFields(
    legacyPlan,
    "secrets-set",
    { recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE },
  ), transitionKeys));
  validateReceiptSemantic(legacyIntent, legacy.slice(0, -1), {
    variant: "pinned-predecessor",
  });
  const legacyUnknown = appendFixture(legacy, mutationResultFields(legacyIntent, {
    status: "unknown",
    recordedAt: at(3_000),
  }));
  validateReceiptSemantic(legacyUnknown, legacy.slice(0, -1), {
    variant: "pinned-predecessor",
  });
  const legacyReconciliation = appendFixture(legacy, omit(reconciliationFields(
    legacyUnknown,
    "diverged",
    {
      recordedAt: at(4_000),
      main: INSTALLED_MAIN,
      finance: INSTALLED_FINANCE,
      functions: POST_SECRET_FUNCTIONS,
    },
  ), reconciliationKeys));
  validateReceiptSemantic(legacyReconciliation, legacy.slice(0, -1), {
    variant: "pinned-predecessor",
  });
  const legacyStateSatisfied = appendFixture(legacy.slice(0, -1), omit(
    reconciliationFields(legacyUnknown, "state_satisfied", {
      recordedAt: at(4_000), main: INSTALLED_MAIN,
      finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
    }),
    reconciliationKeys,
  ));
  assert.throws(
    () => validateReceiptSemantic(
      legacyStateSatisfied,
      legacy.slice(0, -1),
      { variant: "pinned-predecessor" },
    ),
    /legacy secret reconciliation outcome differs/u,
  );

  const current = [];
  const plan = appendPlan(current);
  validateReceiptSemantic(plan, []);
  assert.throws(
    () => validateReceiptSemantic(plan, [], { variant: "pinned-predecessor" }),
    /release plan schema variant differs/u,
  );
  const strippedIntent = appendFixture([...current], omit(intentFields(
    plan,
    "secrets-set",
    { recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE },
  ), transitionKeys));
  assert.throws(
    () => validateReceiptSemantic(strippedIntent, current),
    /mutation-intent receipt keys differ/u,
  );
  const intent = appendIntent(current, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  validateReceiptSemantic(intent, current.slice(0, -1));
  const strippedResult = appendFixture([...current], omit(mutationResultFields(intent, {
    recordedAt: at(3_000),
  }), resultKeys));
  assert.throws(
    () => validateReceiptSemantic(strippedResult, current),
    /mutation-result receipt keys differ/u,
  );
  const falseCausality = appendFixture([...current], {
    ...mutationResultFields(intent, { recordedAt: at(3_000) }),
    causalAttribution: true,
  });
  assert.throws(
    () => validateReceiptSemantic(falseCausality, current),
    /transition evidence differs/u,
  );

  const unknown = appendMutationResult(current, intent, {
    status: "unknown",
    recordedAt: at(3_000),
  });
  validateReceiptSemantic(unknown, current.slice(0, -1));
  const strippedReconciliation = appendFixture(
    [...current],
    omit(reconciliationFields(unknown, "diverged", {
      recordedAt: at(4_000), main: INSTALLED_MAIN,
      finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
    }), reconciliationKeys),
  );
  assert.throws(
    () => validateReceiptSemantic(strippedReconciliation, current),
    /reconciliation receipt keys differ/u,
  );
  const honestDrift = appendFixture([...current], {
    ...reconciliationFields(unknown, "diverged", {
      recordedAt: at(4_000), main: INSTALLED_MAIN,
      finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
    }),
    functionVersionTransitionDisposition: "diverged",
    stableObservation: false,
  });
  validateReceiptSemantic(honestDrift, current);

  for (const malformedAdoption of [
    omit(PREDECESSOR_ADOPTION, ["priorRuntimeFileSha256"]),
    { ...PREDECESSOR_ADOPTION, unexpected: rawHash("unexpected") },
  ]) {
    const malformedPlan = appendFixture([], {
      ...planFields(),
      predecessorAdoption: malformedAdoption,
    });
    assert.throws(
      () => validateReceiptSemantic(malformedPlan, []),
      /predecessor adoption evidence keys differ/u,
    );
  }
  for (const [field, value] of [
    ["priorSourceCommitSha", "9".repeat(40)],
    ["priorSourceTreeSha", "8".repeat(40)],
    ["priorReleaseProvenanceFileSha256", rawHash("wrong-prior-provenance")],
    ["priorReleaseProvenanceDescriptorSha256", rawHash("wrong-prior-descriptor")],
    ["priorPlanReceiptSha256", rawHash("wrong-prior-plan")],
    ["priorTerminalReceiptSha256", rawHash("wrong-prior-terminal")],
    ["priorBundleAttestationSha256", rawHash("wrong-prior-bundle")],
    ["priorRuntimeFileSha256", rawHash("wrong-prior-runtime")],
    ["generatedSecretDigestSetSha256", rawHash("wrong-generated-subset")],
    ["predecessorFunctionInventorySha256", rawHash("wrong-prior-functions")],
    ["observedFunctionInventorySha256", rawHash("wrong-observed-functions")],
    ["observedFunctionCount", 11],
  ]) {
    const pinnedSubjectDrift = appendFixture([], {
      ...planFields(),
      predecessorAdoption: { ...PREDECESSOR_ADOPTION, [field]: value },
    });
    assert.throws(
      () => validateReceiptSemantic(pinnedSubjectDrift, []),
      /predecessor adoption evidence differs/u,
      field,
    );
  }
  const dynamicRootIdentity = appendFixture([], {
    ...planFields(),
    predecessorAdoption: {
      ...PREDECESSOR_ADOPTION,
      priorRootIdentitySha256: rawHash("different-valid-root-identity"),
    },
  });
  validateReceiptSemantic(dynamicRootIdentity, []);

  const persistedUnsafeStageChain = [];
  const persistedUnsafeStage = appendFixture(persistedUnsafeStageChain, {
    ...planFields(),
    functionInventorySha256: functionSha(POST_SECRET_FUNCTIONS),
    functionVersionTransition: {
      ...planFields().functionVersionTransition,
      currentStageFunctionInventorySha256: functionSha(POST_SECRET_FUNCTIONS),
      currentStageDisposition: "exact-all-existing-plus-one",
      currentStageExactAllExistingPlusOneFunctionInventorySha256: functionSha(
        expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
          POST_SECRET_FUNCTIONS,
        ),
      ),
    },
  });
  assert.throws(() => transition(persistedUnsafeStageChain, {
    action: "apply", checkpoint: "before-intent", now: at(2_000),
    mutation: "secrets-set", functions: POST_SECRET_FUNCTIONS,
    approval: approvalFor(persistedUnsafeStage),
    effectPayload: intentFields(persistedUnsafeStage, "secrets-set", {
      recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
      functions: POST_SECRET_FUNCTIONS,
    }),
  }), /release plan receipt differs/u);

  const persistedFalseCountChain = [];
  const falseCountFields = planFields();
  const persistedFalseCount = appendFixture(persistedFalseCountChain, {
    ...falseCountFields,
    functionVersionTransition: {
      ...falseCountFields.functionVersionTransition,
      existingFunctionCount:
        falseCountFields.functionVersionTransition.existingFunctionCount + 1,
    },
  });
  assert.throws(() => transition(persistedFalseCountChain, {
    action: "apply", checkpoint: "before-intent", now: at(2_000),
    mutation: "secrets-set", approval: approvalFor(persistedFalseCount),
    effectPayload: intentFields(persistedFalseCount, "secrets-set", {
      recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
    }),
  }), /release plan successor baseline differs|declarative plan evidence differs/u);

  const tamperedChain = [];
  const tamperedPlan = appendFixture(tamperedChain, {
    ...planFields(),
    predecessorAdoption: {
      ...PREDECESSOR_ADOPTION,
      priorRootIdentitySha256: rawHash("tampered-prior-root-identity"),
    },
  });
  assert.equal(tamperedPlan.kind, "release-plan");
  assert.throws(() => transition(tamperedChain, {
    action: "apply",
    checkpoint: "before-intent",
    now: at(2_000),
    mutation: "secrets-set",
    approval: approvalFor(tamperedPlan),
    effectPayload: intentFields(tamperedPlan, "secrets-set", {
      recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
    }),
  }), /declarative plan evidence differs/u);

  const pendingDirectory = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-read-only-predecessor-receipts-",
  ));
  t.after(() => rmSync(pendingDirectory, { recursive: true, force: true }));
  const pendingFile = path.join(pendingDirectory, "000001.json.pending");
  writeFileSync(pendingFile, "not-a-valid-receipt\n", { mode: 0o600 });
  const beforePendingEntries = readdirSync(pendingDirectory);
  assert.throws(
    () => readReceiptChain(pendingDirectory, { readOnly: true }),
    /read-only receipt chain contains pending evidence/u,
  );
  assert.deepEqual(readdirSync(pendingDirectory), beforePendingEntries);
  assert.equal(readFileSync(pendingFile, "utf8"), "not-a-valid-receipt\n");
});

test("raw reducer expiry approval forged intent and terminal receipt rejection matrix", () => {
  const advancingClockChain = [];
  const advancingClockPlan = appendPlan(advancingClockChain, {
    expiresAt: at(2_000),
  });
  appendIntent(advancingClockChain, advancingClockPlan, "secrets-set", {
    recordedAt: at(1_500), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  assertTransition(transition(advancingClockChain, {
    action: "apply", checkpoint: "before-mutation", now: at(1_999),
    mutation: "secrets-set", effectPayload: commandPayload("secrets-set"),
  }), "authorize-cli-invocation", "invoke-secrets-set",
  "secrets-set+function-deploy", "secrets-set");
  let cliCalls = 0;
  const invokeAfterFinalClockSample = now => {
    transition(advancingClockChain, {
      action: "apply", checkpoint: "before-mutation", now,
      mutation: "secrets-set", effectPayload: commandPayload("secrets-set"),
    });
    cliCalls += 1;
  };
  assert.throws(
    () => invokeAfterFinalClockSample(at(2_000)),
    /current plan approval differs/u,
  );
  assert.equal(cliCalls, 0);

  const expiredChain = [];
  const expired = appendPlan(expiredChain, { expiresAt: at(2_000) });
  assert.throws(() => transition(expiredChain, {
    action: "apply", checkpoint: "before-intent", now: at(3_000),
    mutation: "secrets-set", approval: approvalFor(expired),
    effectPayload: intentFields(expired, "secrets-set", {
      recordedAt: at(3_000), main: PRE_MAIN, finance: PRE_FINANCE,
    }),
  }), /current plan approval differs/u);
  const resumePayload = planFields({
    scope: "secrets-set", recordedAt: at(3_000), expiresAt: at(203_000),
    resumeFromReceiptSha256: expired.receiptSha256,
  });
  assertTransition(transition(expiredChain, {
    now: at(3_000), effectPayload: resumePayload,
  }), "issue-plan", "append-release-plan", "secrets-set");

  const chain = [];
  const plan = appendPlan(chain);
  const validIntent = intentFields(plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendFixture(chain, {
    ...validIntent,
    beforeMainInventorySha256: rawHash("forged-before-main"),
  });
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_100),
    mutation: "secrets-set", effectPayload: commandPayload("secrets-set"),
  }), /inventory binding/u);
  const stale = [];
  const stalePlan = appendPlan(stale);
  assert.throws(() => transition(stale, {
    action: "apply", checkpoint: "before-intent", now: at(2_000),
    mutation: "secrets-set", approval: approvalFor(stalePlan) + ":stale",
    effectPayload: intentFields(stalePlan, "secrets-set", {
      recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
    }),
  }), /approval differs/u);
  const completed = completedChainFixture();
  const forged = [...completed.chain];
  const terminal = forged.pop();
  appendFixture(forged, {
    ...terminal,
    sequence: undefined,
    previousReceiptSha256: undefined,
    schemaVersion: undefined,
    productionDenied: undefined,
    receiptSha256: undefined,
    d1FunctionInventorySha256: rawHash("forged-function"),
  });
  assert.throws(() => transition(forged, {
    action: "verify", now: at(13_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: INSTALLED_FUNCTIONS,
    postflightEvidence: completed.postflight,
  }), /value tree|receipt|completion/u);
});

test("raw reducer applied reconciliation narrows secret scope and requires function evidence time", () => {
  const chain = [];
  const plan = appendPlan(chain);
  const intent = appendIntent(chain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  const unknownPayload = mutationResultFields(intent, {
    status: "unknown", recordedAt: at(3_000),
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "after-mutation", now: at(3_000),
    mutation: "secrets-set", mutationOutcome: "unknown",
    effectPayload: unknownPayload,
  }), "reconcile-required", "append-unknown-result",
  "secrets-set+function-deploy", "secrets-set");
  const unknown = appendFixture(chain, unknownPayload);
  const reconciliationPayload = reconciliationFields(unknown, "state_satisfied", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  assertTransition(transition(chain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, effectPayload: reconciliationPayload,
  }), "reconcile-state-satisfied", "append-reconciliation",
  "function-deploy", null, "state_satisfied");
  const reconciled = appendFixture(chain, reconciliationPayload);
  const resumePayload = planFields({
    scope: "function-deploy", recordedAt: at(5_000), expiresAt: at(205_000),
    resumeFromReceiptSha256: reconciled.receiptSha256,
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
  });
  assertTransition(transition(chain, {
    now: at(5_000), main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    effectPayload: resumePayload,
  }), "issue-plan", "append-release-plan", "function-deploy");

  const functionChain = [];
  const functionPlan = appendPlan(functionChain);
  const functionSecretIntent = appendIntent(
    functionChain,
    functionPlan,
    "secrets-set",
    { recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE },
  );
  appendMutationResult(functionChain, functionSecretIntent, {
    recordedAt: at(3_000),
  });
  const functionIntent = appendIntent(
    functionChain,
    functionPlan,
    "function-deploy",
    {
      recordedAt: at(4_000), main: INSTALLED_MAIN,
      finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
    },
  );
  const functionUnknown = appendMutationResult(functionChain, functionIntent, {
    status: "unknown", recordedAt: at(5_000),
  });
  const functionPostflight = postflightFixture();
  const prematureReconciliation = reconciliationFields(functionUnknown, "applied", {
    recordedAt: functionPostflight.d1.databaseClock,
    main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS,
    proofSha256: functionPostflight.proof.proofSha256,
    d0ResponseSha256: functionPostflight.d0.responseSha256,
  });
  assert.throws(() => transition(functionChain, {
    action: "reconcile", checkpoint: "after-mutation",
    now: functionPostflight.d1.databaseClock,
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: INSTALLED_FUNCTIONS,
    postflightEvidence: functionPostflight,
    effectPayload: prematureReconciliation,
  }), /function reconciliation clock precedes postflight D1/u);
  const timelyReconciliation = {
    ...prematureReconciliation,
    recordedAt: at(11_000),
  };
  assertTransition(transition(functionChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(11_000),
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: INSTALLED_FUNCTIONS,
    postflightEvidence: functionPostflight,
    effectPayload: timelyReconciliation,
  }), "reconcile-applied", "append-reconciliation",
  null, null, "applied");
});

test("raw reducer not-applied secret and deploy reconciliation requires fresh scoped plans", () => {
  const secretChain = [];
  const secretPlan = appendPlan(secretChain);
  const secretIntent = appendIntent(secretChain, secretPlan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  const secretUnknown = appendMutationResult(secretChain, secretIntent, {
    status: "unknown", recordedAt: at(3_000),
  });
  const unsafePlusOneUnsatisfied = reconciliationFields(
    secretUnknown,
    "state_unsatisfied",
    {
      recordedAt: at(4_000), main: PRE_MAIN,
      finance: PRE_FINANCE, functions: POST_SECRET_FUNCTIONS,
    },
  );
  assert.throws(() => transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", functions: POST_SECRET_FUNCTIONS,
    effectPayload: unsafePlusOneUnsatisfied,
  }), /amended secret reconciliation observation evidence differs/u);
  const unsafePlusOneDiverged = reconciliationFields(
    secretUnknown,
    "diverged",
    {
      recordedAt: at(4_000), main: PRE_MAIN,
      finance: PRE_FINANCE, functions: POST_SECRET_FUNCTIONS,
    },
  );
  assertTransition(transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", functions: POST_SECRET_FUNCTIONS,
    effectPayload: unsafePlusOneDiverged,
  }), "reconcile-diverged", "append-reconciliation", null, null, "diverged");
  const secretReconcile = reconciliationFields(secretUnknown, "state_unsatisfied", {
    recordedAt: at(4_000), main: PRE_MAIN,
    finance: PRE_FINANCE, functions: PRE_FUNCTIONS,
  });
  assertTransition(transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", effectPayload: secretReconcile,
  }), "reconcile-state-unsatisfied", "append-reconciliation",
  "secrets-set", "secrets-set", "state_unsatisfied");
  const unstableObservation = {
    inventoryReadRounds: 2,
    stableObservation: false,
    firstMainInventorySha256: rawHash("unstable-first-main-inventory"),
    firstFinanceInventorySha256: inventorySha(PRE_FINANCE),
    firstFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
    secondMainInventorySha256: inventorySha(PRE_MAIN),
    secondFinanceInventorySha256: inventorySha(PRE_FINANCE),
    secondFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
  };
  const unstableReconcile = {
    ...reconciliationFields(secretUnknown, "diverged", {
      recordedAt: at(4_000), main: PRE_MAIN,
      finance: PRE_FINANCE, functions: PRE_FUNCTIONS,
    }),
    functionVersionTransitionDisposition: "diverged",
    stableObservation: false,
  };
  assertTransition(transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", observationEvidence: unstableObservation,
    effectPayload: unstableReconcile,
  }), "reconcile-diverged", "append-reconciliation", null, null, "diverged");
  assert.throws(() => transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set", observationEvidence: unstableObservation,
    effectPayload: { ...unstableReconcile, stableObservation: true },
  }), /raw evidence binding differs/u);
  assert.throws(() => transition(secretChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(4_000),
    mutation: "secrets-set",
    observationEvidence: { ...unstableObservation, stableObservation: true },
    effectPayload: unstableReconcile,
  }), /inventory observation evidence differs/u);
  const secretCause = appendFixture(secretChain, secretReconcile);
  const secretResume = planFields({
    scope: "secrets-set", recordedAt: at(5_000), expiresAt: at(205_000),
    resumeFromReceiptSha256: secretCause.receiptSha256,
  });
  assertTransition(transition(secretChain, {
    now: at(5_000), effectPayload: secretResume,
  }), "issue-plan", "append-release-plan", "secrets-set");

  const deployChain = [];
  const plan = appendPlan(deployChain);
  const secretI = appendIntent(deployChain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(deployChain, secretI, { recordedAt: at(3_000) });
  const deployIntent = appendIntent(deployChain, plan, "function-deploy", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  const deployUnknown = appendMutationResult(deployChain, deployIntent, {
    status: "unknown", recordedAt: at(5_000),
  });
  const deployReconcile = reconciliationFields(deployUnknown, "not_applied", {
    recordedAt: at(6_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  assertTransition(transition(deployChain, {
    action: "reconcile", checkpoint: "after-mutation", now: at(6_000),
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, effectPayload: deployReconcile,
  }), "reconcile-not-applied", "append-reconciliation",
  "function-deploy", "function-deploy", "not_applied");
  const deployCause = appendFixture(deployChain, deployReconcile);
  const deployResume = planFields({
    scope: "function-deploy", recordedAt: at(7_000), expiresAt: at(207_000),
    resumeFromReceiptSha256: deployCause.receiptSha256,
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
  });
  assertTransition(transition(deployChain, {
    now: at(7_000), main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    effectPayload: deployResume,
  }), "issue-plan", "append-release-plan", "function-deploy");
});

test("raw reducer mutation-input digest drift blocks secret and deploy command authority", () => {
  const chain = [];
  const plan = appendPlan(chain);
  const intentPayload = intentFields(plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-intent", now: at(2_000),
    mutation: "secrets-set", inputCurrentSha256: rawHash("runtime-drift"),
    effectPayload: intentPayload,
  }), /mutation intent differs/u);
  const intent = appendIntent(chain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(2_100),
    mutation: "secrets-set", inputCurrentSha256: rawHash("runtime-drift"),
    effectPayload: commandPayload("secrets-set"),
  }), /CLI invocation authority/u);
  const unknownPayload = mutationResultFields(intent, {
    status: "unknown", recordedAt: at(2_200),
  });
  assertTransition(transition(chain, {
    action: "apply", checkpoint: "after-mutation", now: at(2_200),
    mutation: "secrets-set", mutationOutcome: "unknown",
    inputCurrentSha256: rawHash("runtime-drift"), effectPayload: unknownPayload,
  }), "reconcile-required", "append-unknown-result",
  "secrets-set+function-deploy", "secrets-set");

  const deployChain = [];
  const deployPlan = appendPlan(deployChain);
  const secretIntent = appendIntent(deployChain, deployPlan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(deployChain, secretIntent, { recordedAt: at(3_000) });
  appendIntent(deployChain, deployPlan, "function-deploy", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  assert.throws(() => transition(deployChain, {
    action: "apply", checkpoint: "before-mutation", now: at(4_100),
    mutation: "function-deploy", main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, inputCurrentSha256: rawHash("deploy-workdir-drift"),
    effectPayload: commandPayload("function-deploy"),
  }), /CLI invocation authority/u);
});

test("exported current declarative evaluator cannot authorize a legacy function deploy", () => {
  const chain = [];
  const plan = appendPlan(chain);
  const secretIntent = appendIntent(chain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(chain, secretIntent, { recordedAt: at(3_000) });
  appendIntent(chain, plan, "function-deploy", {
    recordedAt: at(4_000),
    main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE,
    functions: POST_SECRET_FUNCTIONS,
  });
  const hostile = {
    action: "apply",
    checkpoint: "before-mutation",
    now: at(4_100),
    mutation: "function-deploy",
    main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE,
    functions: POST_SECRET_FUNCTIONS,
    effectPayload: commandPayload("function-deploy"),
  };
  assertTransition(
    transition(chain, hostile),
    "authorize-cli-invocation",
    "invoke-function-deploy",
    "secrets-set+function-deploy",
    "function-deploy",
  );
  assert.throws(
    () => transition(chain, {
      ...hostile,
      evaluator: recoveryModule.evaluateMainFinanceRuntimeRecoveryV2State,
    }),
    /schema-3 secrets-set only/u,
  );
});

test("raw reducer inventory rewrite and postflight sandwich drift reject completion and verify", () => {
  const rewritten = Object.freeze(INSTALLED_MAIN.map(row => Object.freeze({
    ...row,
    updatedAt: row.name === "MANAGED_SECRET" ? at(9_500) : row.updatedAt,
  })));
  const chain = [];
  const plan = appendPlan(chain);
  const secretIntent = appendIntent(chain, plan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(chain, secretIntent, { recordedAt: at(3_000) });
  const deployIntent = appendIntent(chain, plan, "function-deploy", {
    recordedAt: at(4_000), main: INSTALLED_MAIN,
    finance: INSTALLED_FINANCE, functions: POST_SECRET_FUNCTIONS,
  });
  assert.throws(() => transition(chain, {
    action: "apply", checkpoint: "before-mutation", now: at(4_100),
    mutation: "function-deploy", main: rewritten, finance: INSTALLED_FINANCE,
    effectPayload: commandPayload("function-deploy"),
  }), /inventory binding/u);
  const postflight = postflightFixture();
  const result = appendMutationResult(chain, deployIntent, {
    recordedAt: at(11_000), proofSha256: postflight.proof.proofSha256,
  });
  const collapsedSandwich = {
    ...postflight,
    d1: {
      ...postflight.d1,
      responseSha256: postflight.d0.responseSha256,
    },
  };
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS,
    postflightEvidence: collapsedSandwich,
    effectPayload: completionFields(plan, result, collapsedSandwich),
  }), /postflight sandwich/u);
  const completionPostflight = postflightFixture({
    proofSha256: rawHash("rewrite-test-fresh-proof"),
    d0ResponseLabel: "rewrite-test-fresh-d0-response",
    d1ResponseLabel: "rewrite-test-fresh-d1-response",
  });
  const completePayload = completionFields(plan, result, completionPostflight);
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: INSTALLED_MAIN, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: completionPostflight,
    ci: { ...CI_BINDING, runApiSha256: rawHash("completion-ci-drift") },
    effectPayload: completePayload,
  }), /declarative plan evidence differs|source, provenance or CI authority differs/u);
  assert.throws(() => transition(chain, {
    action: "complete", checkpoint: "before-completion", now: at(12_000),
    main: rewritten, finance: INSTALLED_FINANCE,
    functions: INSTALLED_FUNCTIONS, postflightEvidence: completionPostflight,
    effectPayload: completePayload,
  }), /postflight current inventory binding/u);
  const completed = completedChainFixture();
  assert.throws(() => transition(completed.chain, {
    action: "verify", now: at(13_000), main: rewritten,
    finance: INSTALLED_FINANCE, functions: INSTALLED_FUNCTIONS,
    postflightEvidence: completed.postflight,
  }), /postflight current inventory binding/u);
  const operatorSource = readFileSync(OPERATOR_FILE, "utf8");
  const applyBody = operatorSource.slice(
    operatorSource.indexOf("async function operateApply("),
    operatorSource.indexOf("async function operateReconcile("),
  );
  const applyDeployResult = applyBody.indexOf("const deployResultReceipt");
  const applyCompletion = applyBody.indexOf("collectCompletionAuthority({");
  const applyCompletionReceipt = applyBody.indexOf(
    '"append-release-complete"',
    applyCompletion,
  );
  assert.ok(
    applyDeployResult < applyCompletion
      && applyCompletion < applyCompletionReceipt,
  );
  const reconcileBody = operatorSource.slice(
    operatorSource.indexOf("async function operateReconcile("),
    operatorSource.indexOf("async function operateVerify("),
  );
  assert.equal(
    (reconcileBody.match(/collectCompletionAuthority\(\{/gu) ?? []).length,
    2,
  );
  const reconcileAppend = reconcileBody.indexOf('"append-reconciliation"');
  const reconcilePostAppendCompletion = reconcileBody.lastIndexOf(
    "collectCompletionAuthority({",
  );
  assert.ok(reconcileAppend < reconcilePostAppendCompletion);
});

test("external owner-private provenance is canonical and binds raw bytes separately from its descriptor", () => {
  const source = provenanceSource();
  const value = validateMainFinanceRuntimeRecoveryV2ProvenanceSource(source);
  assert.equal(value.expectedCommitSha, SOURCE_COMMIT);
  assert.equal(value.expectedTreeSha, SOURCE_TREE);
  assert.equal(value.remoteCommitSha, SOURCE_COMMIT);
  assert.equal(value.githubRunId, RUN_ID);
  assert.equal(value.fileSha256, sha256(source));
  const { descriptorSha256, fileSha256, ...core } = value;
  assert.equal(descriptorSha256, sha256(canonicalJson(core)));
  assert.equal(fileSha256, sha256(source));
  assert.equal(Object.isFrozen(value), true);

  assert.throws(
    () => validateMainFinanceRuntimeRecoveryV2ProvenanceSource(source.trimEnd()),
    /release provenance contract differs/u,
  );
  assert.throws(
    () => validateMainFinanceRuntimeRecoveryV2ProvenanceSource(source.replace(
      SOURCE_COMMIT,
      "e".repeat(40),
    )),
    /release provenance contract differs/u,
  );
  const parsed = JSON.parse(source);
  parsed.unreviewed = true;
  assert.throws(
    () => validateMainFinanceRuntimeRecoveryV2ProvenanceSource(
      canonicalJson(parsed) + "\n",
    ),
    /release provenance keys differ/u,
  );
});

test("snapshot API measures exact catalogs, binds phase inventories and verifies strict D0/proof/D1", async () => {
  let queryMs = BASE_MS;
  const fetchImpl = async () => managementResponse(
    catalogFixture(new Date(queryMs += 10).toISOString()),
  );
  const now = () => new Date(queryMs += 10);
  const measured = await measureMainFinanceRuntimeRecoveryCatalog({
    accessToken: "management-token-fixture-00000001",
    fetchImpl,
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    now,
  });
  assert.equal(measured.catalogSha256, CATALOG_SHA);
  assert.deepEqual(measured.counts, {
    columns: 57,
    constraints: 49,
    indexes: 20,
    triggers: 4,
    policies: 0,
    desired: 1,
    entitlements: 1,
  });
  const recovery = inventoryRows("recovery");
  const d0 = await buildMainFinanceRuntimeRecoverySnapshot({
    phase: "recovery",
    accessToken: "management-token-fixture-00000001",
    fetchImpl,
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    expectedCatalogSha256: CATALOG_SHA,
    releaseManifestSha256: "41".repeat(32),
    sourceDeploymentSha256: "42".repeat(32),
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    mainSecretInventoryRows: recovery.main,
    financeSecretInventoryRows: recovery.finance,
    now,
  });
  assert.equal(buildMainFinanceRuntimeRecoveryAttestRequest(d0).action, "attest");
  const proofTimestamp = Date.parse(d0.database_clock) + 10;
  const proofMessage = [
    "main-finance-access-v2-attestation", d0.source_deployment_sha256,
    d0.sql_sha256, d0.main_source_commit_sha, d0.main_source_tree_sha,
    d0.source_manifest_sha256, d0.catalog_sha256, d0.gate_inventory_sha256,
    d0.privacy_secret_inventory_sha256, d0.database_clock, d0.response_sha256,
    d0.descriptor_sha256, d0.state_sha256, String(d0.checked_count),
    String(proofTimestamp),
  ].join("\n");
  const proofDigest = createHmac("sha256", OPERATOR_SECRET)
    .update(proofMessage).digest("hex");
  const proof = verifyMainFinanceRuntimeRecoveryAttestResponse({
    d0,
    sourceDeploymentSha256: d0.source_deployment_sha256,
    operatorSecret: OPERATOR_SECRET,
    responseSource: JSON.stringify({
      ok: true,
      action: "attest",
      provided_descriptor_replayed: true,
      database_clock: d0.database_clock,
      checked_count: d0.checked_count,
      mismatch_count: 0,
      state_sha256: d0.state_sha256,
      attested_at: new Date(proofTimestamp).toISOString(),
      attestation_proof: `${proofTimestamp}.${proofDigest}`,
    }),
    now: () => new Date(proofTimestamp + 10),
  });
  const extractedProof = extractMainFinanceRuntimeRecoveryVerifiedAttestationProof({
    proof,
    d0,
  });
  assert.equal(extractedProof, `${proofTimestamp}.${proofDigest}`);
  assert.equal(sha256(extractedProof), proof.proofSha256);
  assert.equal(Object.hasOwn(proof, "attestationProof"), false);
  const d1 = await buildMainFinanceRuntimeRecoverySnapshot({
    phase: "recovery",
    accessToken: "management-token-fixture-00000001",
    fetchImpl,
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    expectedCatalogSha256: CATALOG_SHA,
    releaseManifestSha256: "41".repeat(32),
    sourceDeploymentSha256: "42".repeat(32),
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    mainSecretInventoryRows: recovery.main,
    financeSecretInventoryRows: recovery.finance,
    now,
  });
  assert.equal(validateMainFinanceRuntimeRecoverySnapshotSandwich({ d0, proof, d1 }), true);
  const substitutedD0 = { ...d0, response_sha256: "44".repeat(32) };
  const substitutedD1 = {
    ...substitutedD0,
    database_clock: d1.database_clock,
    response_sha256: "45".repeat(32),
  };
  assert.equal(validateMainFinanceRuntimeRecoverySnapshotSandwich({
    d0: substitutedD0,
    proof,
    d1: substitutedD1,
  }), false);
  assert.throws(() => extractMainFinanceRuntimeRecoveryVerifiedAttestationProof({
    proof,
    d0: substitutedD0,
  }), /extraction binding/u);
  const sameMillisecondD1 = await buildMainFinanceRuntimeRecoverySnapshot({
    phase: "recovery",
    accessToken: "management-token-fixture-00000001",
    fetchImpl: async () => managementResponse(catalogFixture(proof.attestedAt)),
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    expectedCatalogSha256: CATALOG_SHA,
    releaseManifestSha256: "41".repeat(32),
    sourceDeploymentSha256: "42".repeat(32),
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    mainSecretInventoryRows: recovery.main,
    financeSecretInventoryRows: recovery.finance,
    now: () => new Date(proofTimestamp + 10),
  });
  assert.equal(validateMainFinanceRuntimeRecoverySnapshotSandwich({
    d0,
    proof,
    d1: sameMillisecondD1,
  }), false);

  const access = inventoryRows("access");
  const accessSnapshot = await buildMainFinanceRuntimeRecoverySnapshot({
    phase: "access",
    accessToken: "management-token-fixture-00000001",
    fetchImpl,
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    expectedCatalogSha256: CATALOG_SHA,
    releaseManifestSha256: "41".repeat(32),
    sourceDeploymentSha256: "42".repeat(32),
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    mainSecretInventoryRows: access.main,
    financeSecretInventoryRows: access.finance,
    now,
  });
  assert.equal(accessSnapshot.checked_count, 1);
  const wrongAccess = structuredClone(access);
  wrongAccess.main.find((row) => row.name === "MAIN_FINANCE_SYNC_MODE").value = DISABLED;
  let wrongAccessQueries = 0;
  await assert.rejects(buildMainFinanceRuntimeRecoverySnapshot({
    phase: "access",
    accessToken: "management-token-fixture-00000001",
    fetchImpl: async () => {
      wrongAccessQueries += 1;
      return managementResponse(catalogFixture());
    },
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    expectedCatalogSha256: CATALOG_SHA,
    releaseManifestSha256: "41".repeat(32),
    sourceDeploymentSha256: "42".repeat(32),
    sourceCommitSha: SOURCE_COMMIT,
    sourceTreeSha: SOURCE_TREE,
    mainSecretInventoryRows: wrongAccess.main,
    financeSecretInventoryRows: wrongAccess.finance,
    now,
  }), /outside the exact access phase contract/u);
  assert.equal(wrongAccessQueries, 0);

  const extra = structuredClone(CATALOG_TEMPLATE);
  extra.database_clock = new Date(queryMs += 10).toISOString();
  extra.entitlement_extra_count = "1";
  await assert.rejects(measureMainFinanceRuntimeRecoveryCatalog({
    accessToken: "management-token-fixture-00000001",
    fetchImpl: async () => managementResponse(extra),
    preflightSql: PREFLIGHT,
    preflightSqlSha256: sha256(PREFLIGHT),
    now,
  }), /entitlement_extra_count/u);
});

test("reconcile snapshot is target-bound and classifies only absent/applied/nonterminal/wait", async () => {
  const targetUser = "00000000-0000-4000-8000-000000000002";
  const targetEvent = "10000000-0000-4000-8000-000000000002";
  const planSha256 = "61".repeat(32);
  const originalRows = structuredClone(CATALOG_TEMPLATE.rows);
  const reconcileContext = {
    action: "grant",
    original_plan_sha256: planSha256,
    main_user_id: targetUser,
    event_id: targetEvent,
    current_event_id: null,
    expected_version: "0",
    changed_by: "operator:test",
    original_rows: originalRows,
  };
  const target = {
    main_user_id: targetUser,
    event_id: targetEvent,
    desired_state: "granted",
    version: "1",
    applied_state: "granted",
    applied_version: "1",
    event_state: "applied",
    changed_by: "operator:test",
    change_reason: `main_finance_runtime_recovery_v2_plan:${planSha256}`,
  };
  const access = inventoryRows("access");
  let clock = BASE_MS + 20_000;
  const build = async (row, context = reconcileContext, phase = "reconcile") =>
    buildMainFinanceRuntimeRecoverySnapshot({
      phase,
      accessToken: "management-token-fixture-00000001",
      fetchImpl: async () => managementResponse(row),
      preflightSql: PREFLIGHT,
      preflightSqlSha256: sha256(PREFLIGHT),
      expectedCatalogSha256: CATALOG_SHA,
      releaseManifestSha256: "41".repeat(32),
      sourceDeploymentSha256: "42".repeat(32),
      sourceCommitSha: SOURCE_COMMIT,
      sourceTreeSha: SOURCE_TREE,
      mainSecretInventoryRows: access.main,
      financeSecretInventoryRows: access.finance,
      reconcileContext: context,
      now: () => new Date(clock + 1_000),
    });
  const rowFor = (rows, disposition) => {
    const row = catalogFixture(new Date(clock += 10).toISOString());
    row.rows = rows;
    row.desired_count = String(rows.length);
    row.current_row_count = String(rows.length);
    if (["nonterminal", "wait"].includes(disposition)) {
      row.current_invalid_count = "1";
      row.entitlement_invalid_count = "1";
      row.entitlement_count = "1";
      row.nonterminal_outbox_count = "1";
    } else {
      row.entitlement_count = String(rows.length);
    }
    return row;
  };

  const absent = await build(rowFor(originalRows, "absent"));
  assert.equal(classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: absent, reconcileContext,
  }), "absent");

  const applied = await build(rowFor([...originalRows, target], "applied"));
  assert.equal(classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: applied, reconcileContext,
  }), "applied");
  assert.throws(() => buildMainFinanceRuntimeRecoveryAttestRequest(applied),
    /cannot authorize global attestation/u);

  const pendingTarget = {
    ...target, applied_state: null, applied_version: "0", event_state: "pending",
  };
  const nonterminal = await build(rowFor([...originalRows, pendingTarget], "nonterminal"));
  assert.equal(classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: nonterminal, reconcileContext,
  }), "nonterminal");

  const processingTarget = { ...pendingTarget, event_state: "processing" };
  const waiting = await build(rowFor([...originalRows, processingTarget], "wait"));
  assert.equal(classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: waiting, reconcileContext,
  }), "wait");

  const driftedOther = [{ ...originalRows[0], change_reason: "unreviewed drift" }, target];
  await assert.rejects(build(rowFor(driftedOther, "applied")), /non-target row drifted/u);
  await assert.rejects(build(rowFor([
    ...originalRows, { ...target, event_id: "10000000-0000-4000-8000-000000000003" },
  ], "applied")), /target successor differs/u);
  await assert.rejects(build(rowFor([
    { ...originalRows[0], applied_state: null, applied_version: "0", event_state: "pending" },
    pendingTarget,
  ], "nonterminal")), /non-target row drifted/u);
  await assert.rejects(build(rowFor([], "absent")), /at least one desired row/u);
  await assert.rejects(build(rowFor(originalRows, "absent"), null), /context\/phase differs/u);
  await assert.rejects(build(rowFor(originalRows, "absent"), reconcileContext, "access"),
    /context\/phase differs/u);
  assert.throws(() => classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: { ...applied }, reconcileContext,
  }), /classification binding differs/u);
  assert.throws(() => classifyMainFinanceRuntimeRecoveryReconcileSnapshot({
    snapshot: applied, reconcileContext: { ...reconcileContext, changed_by: "operator:other" },
  }), /classification binding differs/u);
});

test("imported recovery module exposes only production-used pure authority", () => {
  assert.deepEqual(Object.keys(recoveryModule).sort(), [
    "canonicalJson",
    "classifyMainFinanceRuntimeRecoveryV2FunctionState",
    "evaluateMainFinanceRuntimeRecoveryV2State",
    "sha256",
    "validateMainFinanceRuntimeRecoveryV2ProvenanceSource",
    "validateMainFinanceRuntimeRecoveryV4ReleaseAuthority",
  ]);
  const source = readFileSync(
    path.join(ROOT, "scripts/prepare-main-finance-runtime-recovery-v2.mjs"),
    "utf8",
  );
  assert.match(source, /async function operateMainFinanceRuntimeRecoveryV2\(\) \{/u);
  assert.doesNotMatch(source, /export\s+async\s+function/u);
  assert.doesNotMatch(
    source,
    /export\s+(?:async\s+)?function\s+(?:operateMainFinanceRuntimeRecoveryV2|main|run\w*|cli\w*)/u,
  );
  assert.doesNotMatch(source, /readManifestSource/u);
  assert.match(source, /if \(import\.meta\.main === true\) \{\s*main\(\)\.catch/u);
  assert.match(source, /import\.meta\.main !== true/u);
  assert.equal((source.match(/\{ mutation: true \}/gu) ?? []).length, 2);
  assert.equal((source.match(/invokeAuthorizedMutation\(/gu) ?? []).length, 3);
  assert.equal((source.match(/"authorize-cli-invocation"/gu) ?? []).length, 1);
  assert.equal((source.match(/"record-mutation-intent"/gu) ?? []).length, 1);
});

test("hostile argv cannot turn a transitive recovery import into an effectful legacy CLI", () => {
  const legacyFile = path.join(ROOT, "scripts/manage-finance-access.mjs");
  const operatorUrl = pathToFileURL(OPERATOR_FILE).href;
  const expectedExports = Object.keys(recoveryModule).sort();
  const program = [
    `process.argv[1] = ${JSON.stringify(legacyFile)};`,
    "let fetchCalls = 0;",
    "globalThis.fetch = () => { fetchCalls += 1; throw new Error('fetch forbidden'); };",
    `const namespace = await import(${JSON.stringify(`${operatorUrl}?hostile-argv-import=1`)});`,
    `const expected = ${JSON.stringify(expectedExports)};`,
    "const actual = Object.keys(namespace).sort();",
    "if (fetchCalls !== 0 || JSON.stringify(actual) !== JSON.stringify(expected)) process.exitCode = 73;",
  ].join("\n");
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    program,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", NO_COLOR: "1" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("inventory fetchers use the pinned CLI 2.109.1 raw-array JSON renderer", async t => {
  const {
    fetchFunctionInventory,
    fetchSecretInventories,
  } = await importInternalInventoryFetchers(t);
  const homeParent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-secret-home-test-",
  ));
  t.after(() => rmSync(homeParent, { recursive: true, force: true }));
  const supabaseHome = path.join(homeParent, "supabase-home");
  mkdirSync(supabaseHome, { mode: 0o700 });
  chmodSync(supabaseHome, 0o500);
  const inventories = inventoryRows("recovery");
  const functions = [PURE_EXACT_FUNCTION];
  const calls = [];
  const dependencies = {
    supabase: "/private/tmp/inert-supabase-cli",
    supabaseHome,
    cliEnvironment: Object.freeze({}),
    runCli: (_cli, args, environment) => {
      calls.push({ args: [...args], environment });
      const projectRef = args[args.indexOf("--project-ref") + 1];
      const rows = args[0] === "functions"
        ? functions
        : projectRef === MAIN_REF ? inventories.main : inventories.finance;
      return Object.freeze({
        status: 0,
        signal: null,
        error: null,
        stdout: `${JSON.stringify(rows)}\n`,
      });
    },
  };
  const secretInventory = fetchSecretInventories(dependencies);
  const functionInventory = fetchFunctionInventory(dependencies);
  assert.equal(secretInventory.main.size, inventories.main.length);
  assert.equal(secretInventory.finance.size, inventories.finance.length);
  assert.equal(functionInventory.rows.length, functions.length);
  assert.deepEqual(calls.map(call => call.args), [
    [
      "secrets", "list", "--project-ref", FINANCE_REF,
      "--output", "json", "--log-level", "error",
    ],
    [
      "secrets", "list", "--project-ref", MAIN_REF,
      "--output", "json", "--log-level", "error",
    ],
    [
      "functions", "list", "--project-ref", MAIN_REF,
      "--output", "json", "--log-level", "error",
    ],
  ]);
  for (const call of calls) {
    assert.equal(call.args.includes("--output-format"), false);
    assert.equal(call.args.filter(argument => argument === "--output").length, 1);
  }
});

test("initial and resume plans preserve callable clock and bundle inventories", async t => {
  const { nextReceiptTimestamp } = await importInternalReceiptClock(t);
  let clockCalls = 0;
  const timestamp = nextReceiptTimestamp([], () => {
    clockCalls += 1;
    return new Date(BASE_MS);
  });
  assert.equal(timestamp, new Date(BASE_MS).toISOString());
  assert.equal(clockCalls, 1);

  const source = readFileSync(OPERATOR_FILE, "utf8");
  const initialStart = source.indexOf("async function operatePlan(");
  const resumeStart = source.indexOf("async function operateResumePlan(");
  const resumeEnd = source.indexOf("\nfunction unknownResultReceiptFields(", resumeStart);
  assert.notEqual(initialStart, -1);
  assert.notEqual(resumeStart, -1);
  assert.notEqual(resumeEnd, -1);
  for (const body of [
    source.slice(initialStart, resumeStart),
    source.slice(resumeStart, resumeEnd),
  ]) {
    assert.match(
      body,
      /nextReceiptTimestamp\(context\.chain, common\.now\)/u,
    );
    assert.doesNotMatch(body, /const now = exactNow\(common\.now\)/u);
  }
  const initialBody = source.slice(initialStart, resumeStart);
  const resumeBody = source.slice(resumeStart, resumeEnd);
  assert.ok(
    initialBody.indexOf("assertRuntimeReadChainEligibility(\"fresh-plan\"")
      < initialBody.indexOf("readTerminalDivergedPredecessorAdoption(input, release)"),
  );
  assert.ok(
    initialBody.indexOf("postPredecessorReceiptIdentity")
      > initialBody.indexOf("readTerminalDivergedPredecessorAdoption(input, release)"),
  );
  assert.ok(
    initialBody.indexOf("postPredecessorReceiptIdentity")
      < initialBody.indexOf("initializeReadyOperation(input, common, release, true)"),
  );
  assert.match(
    initialBody,
    /currentIdentity: receiptBindingIdentity\(context\.receiptBinding\)/u,
  );
  assert.ok(
    initialBody.indexOf(
      "currentIdentity: receiptBindingIdentity(context.receiptBinding)",
    ) < initialBody.indexOf("fetchSecretInventories(context.dependencies"),
  );
  assert.ok(
    resumeBody.indexOf("assertRuntimeReadChainEligibility(")
      < resumeBody.indexOf("readPredecessorAdoption(input, release)"),
  );
  assert.ok(
    resumeBody.indexOf("const eligibilityAt = exactNow(common.now).toISOString()")
      < resumeBody.indexOf("readPredecessorAdoption(input, release)"),
  );
  assert.ok(
    resumeBody.indexOf("const recordedAt = nextReceiptTimestamp(context.chain, common.now)")
      > resumeBody.indexOf("readBundle("),
  );
  assert.match(
    resumeBody,
    /proposedMutationScope !== resumeEligibility\.resumeScope/u,
  );

  const createBundleStart = source.indexOf("function createBundle({");
  const createBundleEnd = source.indexOf("\nfunction parseRuntimeSource(", createBundleStart);
  assert.notEqual(createBundleStart, -1);
  assert.notEqual(createBundleEnd, -1);
  assert.match(
    source.slice(createBundleStart, createBundleEnd),
    /preinstallInventories,\n/u,
  );
  assert.doesNotMatch(
    source.slice(createBundleStart, createBundleEnd),
    /preinstallInventories: preinstallInventory,/u,
  );

  const {
    assertFreshReceiptAuthorityUnchanged,
    receiptDirectoryIdentity,
  } = await importInternalGeneratedRuntimeSecrets(t);
  const authorityRoot = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-receipt-identity-",
  ));
  t.after(() => rmSync(authorityRoot, { recursive: true, force: true }));
  const originalReceiptDirectory = path.join(authorityRoot, "receipts-original");
  const clonedReceiptDirectory = path.join(authorityRoot, "receipts-clone");
  mkdirSync(originalReceiptDirectory, { mode: 0o700 });
  mkdirSync(clonedReceiptDirectory, { mode: 0o700 });
  const originalIdentity = receiptDirectoryIdentity(originalReceiptDirectory);
  const clonedIdentity = receiptDirectoryIdentity(clonedReceiptDirectory);
  assert.notEqual(originalIdentity.ino, clonedIdentity.ino);
  let runtimeReads = 0;
  let hostedReads = 0;
  assert.throws(() => {
    assertFreshReceiptAuthorityUnchanged({
      expectedIdentity: originalIdentity,
      expectedChain: [],
      currentIdentity: clonedIdentity,
      currentChain: [],
      phase: "during initialization",
    });
    runtimeReads += 1;
    hostedReads += 1;
  }, /fresh plan receipt authority changed during initialization/u);
  assert.equal(runtimeReads, 0);
  assert.equal(hostedReads, 0);
});

test("adopted generated secrets are exact, predecessor-bound and never regenerated", async t => {
  const {
    resolveGeneratedRuntimeSecrets,
    readRuntimeBundlePlaintextAfterAuthority,
    runtimeRows,
    selectGeneratedRuntimeSecrets,
    assertPlanEnvelopeCurrentBeforePlaintext,
    assertLegacyPredecessorBundleBeforePlaintext,
    assertRuntimeReadChainEligibility,
    assertOrphanedSuccessorRecoveryFrames,
    collectCompletionAuthority,
    validateBundleRecoveryVariant,
    validateRuntimeBundleValues,
  } =
    await importInternalGeneratedRuntimeSecrets(t);
  const generatedSecretValues = Object.freeze({
    MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2:
      Buffer.alloc(48, 1).toString("base64url"),
    MAIN_FINANCE_SYNC_TRIGGER_SECRET:
      Buffer.alloc(48, 2).toString("base64url"),
  });
  const generatedSecretDigests = Object.fromEntries(
    Object.entries(generatedSecretValues).map(([name, value]) => [name, sha256(value)]),
  );
  const predecessorAdoption = Object.freeze({
    ...PREDECESSOR_ADOPTION,
    generatedSecretDigestSetSha256: sha256(canonicalJson(generatedSecretDigests)),
  });
  assert.equal(validateBundleRecoveryVariant({
    predecessorAdoption: PREDECESSOR_ADOPTION,
  }, false), true);
  assert.equal(validateBundleRecoveryVariant({}, true), false);
  assert.throws(
    () => validateBundleRecoveryVariant({}, false),
    /recovery variant differs/u,
  );
  const planChain = [];
  const authorityPlanBase = appendPlan(planChain);
  const authorityStateDirectory = "/private/tmp/authority-state";
  const authorityRuntimeMutationInput = Object.freeze({
    path: path.join(authorityStateDirectory, "runtime-install.env"),
    sha256: rawHash("authority-runtime-input"),
  });
  const authorityDeployMutationInput = Object.freeze([{
    path: "supabase/config.toml", sha256: rawHash("authority-deploy-input"),
  }]);
  const authorityPlan = Object.freeze({
    ...authorityPlanBase,
    runtimeMutationInputSha256:
      sha256(canonicalJson(authorityRuntimeMutationInput)),
    deployMutationInputSha256:
      sha256(canonicalJson(authorityDeployMutationInput)),
    runtimeCommandArgsSha256: sha256(canonicalJson([
      "secrets", "set", "--project-ref", MAIN_REF,
      "--env-file", path.join(authorityStateDirectory, "runtime-install.env"),
      "--yes",
    ])),
    deployCommandArgsSha256: sha256(canonicalJson([
      "functions", "deploy", "finance-manage-access-v2", "--project-ref",
      MAIN_REF, "--no-verify-jwt", "--use-api", "--workdir",
      path.join(authorityStateDirectory, "deploy-workdir"), "--yes",
    ])),
  });
  const authorityAttestation = Object.freeze({
    attestationSha256: authorityPlan.bundleAttestationSha256,
    predecessorAdoption: authorityPlan.predecessorAdoption,
    sourceArchiveSha256: authorityPlan.sourceArchiveSha256,
    operatorDescriptorFileSha256: authorityPlan.operatorDescriptorFileSha256,
    runtimeMutationInput: authorityRuntimeMutationInput,
    deployMutationInput: authorityDeployMutationInput,
    supabaseMutationInput: Object.freeze({
      path: path.join(authorityStateDirectory, "sealed-supabase-cli", "supabase"),
    }),
    productionBoundarySha256: authorityPlan.productionBoundarySha256,
    targetDescriptorSha256: authorityPlan.targetDescriptorSha256,
    catalogSha256: authorityPlan.snapshot.catalogSha256,
    descriptorSha256: authorityPlan.snapshot.descriptorSha256,
    stateSha256: authorityPlan.snapshot.stateSha256,
    gateInventorySha256: authorityPlan.snapshot.gateInventorySha256,
    privacyInventorySha256: authorityPlan.snapshot.privacyInventorySha256,
    checkedCount: authorityPlan.snapshot.checkedCount,
    preinstallMainInventorySha256: inventorySha(PRE_MAIN),
    preinstallFinanceInventorySha256: inventorySha(PRE_FINANCE),
    preinstallFunctionInventorySha256:
      authorityPlan.functionVersionTransition.beforeFunctionInventorySha256,
  });
  const authorityRelease = Object.freeze({
    manifestSha256: RELEASE_BINDING.manifestSha256,
    manifest: Object.freeze({
      deploymentClosureSetSha256: RELEASE_BINDING.sourceDeploymentSha256,
    }),
  });
  let runtimeReads = 0;
  const readRuntime = () => {
    runtimeReads += 1;
    return "runtime-plaintext";
  };
  const authorityAccessBoundary = Object.freeze({
    productionBoundarySha256: authorityPlan.productionBoundarySha256,
    targetDescriptorSha256: authorityPlan.targetDescriptorSha256,
  });
  const authorizePlanRuntime = ({
    approval = approvalFor(authorityPlan),
    now = new Date(at(2_000)),
    source = SOURCE_BINDING,
    ci = CI_BINDING,
    accessBoundary = authorityAccessBoundary,
    stateDirectory = authorityStateDirectory,
  } = {}) => attestation => assertPlanEnvelopeCurrentBeforePlaintext(
    authorityPlan,
    attestation,
    authorityRelease,
    source,
    PROVENANCE_BINDING,
    ci,
    accessBoundary,
    stateDirectory,
    approval,
    now,
  );
  const runtimeAuthorityInput = Object.freeze({
    attestation: authorityAttestation,
    amendedAttestation: true,
    expectedAttestationSha256: authorityPlan.bundleAttestationSha256,
    expectedPredecessorAdoption: authorityPlan.predecessorAdoption,
    authorizeRuntimeRead: authorizePlanRuntime(),
    orphanedAdoptionAuthority: false,
    preinstallInventories: Object.freeze({
      main: new Map(PRE_MAIN.map(row => [row.name, row])),
      finance: new Map(PRE_FINANCE.map(row => [row.name, row])),
      functions: PRE_FUNCTIONS,
    }),
    runtimeFile: "/private/tmp/inert-runtime",
    readPrivateFileImpl: readRuntime,
  });
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    expectedAttestationSha256: rawHash("wrong-plan-attestation"),
  }), /attestation pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  for (const hostileBaseline of [
    {
      main: [{ ...PRE_MAIN[0], value: rawHash("coherent-main-baseline-swap") }],
      finance: PRE_FINANCE,
      functions: PRE_FUNCTIONS,
    },
    {
      main: PRE_MAIN,
      finance: [{
        ...PRE_FINANCE[0], value: rawHash("coherent-finance-baseline-swap"),
      }],
      functions: PRE_FUNCTIONS,
    },
    {
      main: PRE_MAIN,
      finance: PRE_FINANCE,
      functions: POST_SECRET_FUNCTIONS,
    },
  ]) {
    const hostilePreinstallInventories = Object.freeze({
      main: new Map(hostileBaseline.main.map(row => [row.name, row])),
      finance: new Map(hostileBaseline.finance.map(row => [row.name, row])),
      functions: hostileBaseline.functions,
    });
    const hostileAttestation = Object.freeze({
      ...authorityAttestation,
      attestationSha256: rawHash(
        `coherent-baseline-${hostileBaseline.functions[0].version}-${
          hostileBaseline.main[0].value
        }-${hostileBaseline.finance[0].value}`,
      ),
      preinstallMainInventorySha256: inventorySha(hostileBaseline.main),
      preinstallFinanceInventorySha256: inventorySha(hostileBaseline.finance),
      preinstallFunctionInventorySha256: functionSha(hostileBaseline.functions),
    });
    assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
      ...runtimeAuthorityInput,
      attestation: hostileAttestation,
      expectedAttestationSha256: hostileAttestation.attestationSha256,
      authorizeRuntimeRead: () => {},
      preinstallInventories: hostilePreinstallInventories,
    }), /exact predecessor terminal subject/u);
    assert.equal(runtimeReads, 0);
  }
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    expectedPredecessorAdoption: {
      ...authorityPlan.predecessorAdoption,
      priorRootIdentitySha256: rawHash("wrong-dynamic-root"),
    },
  }), /adoption pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({ approval: "wrong-approval" }),
  }), /approval is absent, stale/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({ now: new Date(at(300_000)) }),
  }), /approval is absent, stale/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({
      source: { ...SOURCE_BINDING, commit: "9".repeat(40) },
    }),
  }), /attestation pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({
      ci: { ...CI_BINDING, runApiSha256: rawHash("drifted-current-ci") },
    }),
  }), /full envelope pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({
      stateDirectory: "/private/tmp/relocated-authority-state",
    }),
  }), /full envelope pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...runtimeAuthorityInput,
    authorizeRuntimeRead: authorizePlanRuntime({
      accessBoundary: {
        ...authorityAccessBoundary,
        targetDescriptorSha256: rawHash("drifted-current-target"),
      },
    }),
  }), /full envelope pre-plaintext authority differs/u);
  assert.equal(runtimeReads, 0);
  assert.equal(
    readRuntimeBundlePlaintextAfterAuthority(runtimeAuthorityInput),
    "runtime-plaintext",
  );
  assert.equal(runtimeReads, 1);
  const unknownChain = [];
  const unknownPlan = appendPlan(unknownChain);
  const unknownIntent = appendIntent(unknownChain, unknownPlan, "secrets-set", {
    recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE,
  });
  appendMutationResult(unknownChain, unknownIntent, {
    status: "unknown", recordedAt: at(3_000),
  });
  const verifiedSecretChain = [];
  const verifiedSecretPlan = appendPlan(verifiedSecretChain);
  const verifiedSecretIntent = appendIntent(
    verifiedSecretChain,
    verifiedSecretPlan,
    "secrets-set",
    { recordedAt: at(2_000), main: PRE_MAIN, finance: PRE_FINANCE },
  );
  appendMutationResult(verifiedSecretChain, verifiedSecretIntent, {
    recordedAt: at(3_000),
  });
  const pendingPlanChain = [];
  appendPlan(pendingPlanChain);
  const completedFixture = completedChainFixture();
  for (const hostileEligibility of [
    { action: "fresh-plan", chain: pendingPlanChain, now: null },
    { action: "apply", chain: [], now: null },
    { action: "resume", chain: pendingPlanChain, now: at(2_000) },
    { action: "reconcile", chain: pendingPlanChain, now: null },
    { action: "reconcile", chain: verifiedSecretChain, now: null },
    { action: "verify", chain: pendingPlanChain, now: null },
  ]) {
    runtimeReads = 0;
    assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
      ...runtimeAuthorityInput,
      authorizeRuntimeRead: () => assertRuntimeReadChainEligibility(
        hostileEligibility.action,
        hostileEligibility.chain,
        hostileEligibility.now,
      ),
    }), /chain is not eligible|cause is not eligible/u);
    assert.equal(runtimeReads, 0);
  }
  for (const allowedEligibility of [
    { action: "fresh-plan", chain: [], now: null },
    { action: "apply", chain: pendingPlanChain, now: null },
    { action: "resume", chain: [], now: at(2_000) },
    { action: "resume", chain: pendingPlanChain, now: at(300_000) },
    { action: "reconcile", chain: unknownChain, now: null },
    { action: "verify", chain: completedFixture.chain, now: null },
  ]) {
    runtimeReads = 0;
    assert.equal(readRuntimeBundlePlaintextAfterAuthority({
      ...runtimeAuthorityInput,
      authorizeRuntimeRead: () => assertRuntimeReadChainEligibility(
        allowedEligibility.action,
        allowedEligibility.chain,
        allowedEligibility.now,
      ),
    }), "runtime-plaintext");
    assert.equal(runtimeReads, 1);
  }
  const legacyStateDirectory = "/private/tmp/legacy-predecessor-state";
  const legacyRuntimeArgumentsSha256 = sha256(canonicalJson([
    "secrets", "set", "--project-ref", MAIN_REF, "--env-file",
    path.join(legacyStateDirectory, "runtime-install.env"), "--yes",
  ]));
  const legacyDeployArgumentsSha256 = sha256(canonicalJson([
    "functions", "deploy", "finance-manage-access-v2", "--project-ref",
    MAIN_REF, "--no-verify-jwt", "--use-api", "--workdir",
    path.join(legacyStateDirectory, "deploy-workdir"), "--yes",
  ]));
  const legacyExpectedDigests = Object.freeze({
    MANAGED_SECRET: MANAGED_SECRET_DIGEST,
  });
  const legacyAttestation = Object.freeze({
    attestationSha256: rawHash("legacy-envelope-attestation"),
    operatorDescriptorFileSha256: rawHash("legacy-operator-descriptor"),
    preinstallFunctionInventorySha256: functionSha(PREDECESSOR_FUNCTIONS),
    runtimeFileSha256:
      "8920f620995e6749ae56d5d1d8a9b7461eee8c208adcad22ef56db67d0f1a908",
    expectedSecretDigests: legacyExpectedDigests,
    runtimeMutationInput: Object.freeze({
      path: path.join(legacyStateDirectory, "runtime-install.env"),
    }),
    supabaseMutationInput: Object.freeze({
      path: path.join(legacyStateDirectory, "sealed-supabase-cli", "supabase"),
    }),
  });
  const legacyPlan = Object.freeze({
    operatorDescriptorFileSha256: legacyAttestation.operatorDescriptorFileSha256,
    mainInventorySha256: inventorySha(PRE_MAIN),
    financeInventorySha256: inventorySha(PRE_FINANCE),
    functionInventorySha256: functionSha(PREDECESSOR_FUNCTIONS),
    runtimeCommandArgsSha256: legacyRuntimeArgumentsSha256,
    deployCommandArgsSha256: legacyDeployArgumentsSha256,
  });
  const legacyIntent = Object.freeze({
    expectedSecretDigestSetSha256: sha256(canonicalJson(legacyExpectedDigests)),
  });
  const legacyTerminal = Object.freeze({
    functionInventorySha256: functionSha(PRE_FUNCTIONS),
  });
  const legacyPreinstallInventories = Object.freeze({
    main: new Map(PRE_MAIN.map(row => [row.name, row])),
    finance: new Map(PRE_FINANCE.map(row => [row.name, row])),
    functions: PREDECESSOR_FUNCTIONS,
  });
  const authorizeLegacyRuntime = ({
    terminal = legacyTerminal,
    intent = legacyIntent,
    stateDirectory = legacyStateDirectory,
  } = {}) => (attestation, preinstallInventories) =>
    assertLegacyPredecessorBundleBeforePlaintext({
      attestation,
      preinstallInventories,
      envelopeAttestation: legacyAttestation,
      plan: legacyPlan,
      intent,
      terminal,
      stateDirectory,
    });
  const legacyRuntimeAuthorityInput = Object.freeze({
    attestation: legacyAttestation,
    amendedAttestation: false,
    expectedAttestationSha256: legacyAttestation.attestationSha256,
    expectedPredecessorAdoption: undefined,
    authorizeRuntimeRead: authorizeLegacyRuntime(),
    orphanedAdoptionAuthority: false,
    preinstallInventories: legacyPreinstallInventories,
    runtimeFile: "/private/tmp/inert-legacy-runtime",
    readPrivateFileImpl: readRuntime,
  });
  runtimeReads = 0;
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...legacyRuntimeAuthorityInput,
    authorizeRuntimeRead: authorizeLegacyRuntime({
      terminal: { functionInventorySha256: rawHash("forged-terminal-relation") },
    }),
  }), /predecessor envelope relation differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...legacyRuntimeAuthorityInput,
    authorizeRuntimeRead: authorizeLegacyRuntime({
      intent: { expectedSecretDigestSetSha256: rawHash("forged-digest-set") },
    }),
  }), /predecessor envelope relation differs/u);
  assert.equal(runtimeReads, 0);
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...legacyRuntimeAuthorityInput,
    authorizeRuntimeRead: authorizeLegacyRuntime({
      stateDirectory: "/private/tmp/relocated-legacy-state",
    }),
  }), /predecessor envelope relation differs/u);
  assert.equal(runtimeReads, 0);
  assert.equal(
    readRuntimeBundlePlaintextAfterAuthority(legacyRuntimeAuthorityInput),
    "runtime-plaintext",
  );
  assert.equal(runtimeReads, 1);
  const orphanFrameInput = Object.freeze({
    predecessorRows: PREDECESSOR_FUNCTIONS,
    successorRows: PRE_FUNCTIONS,
    currentRows: PRE_FUNCTIONS,
    bundlePredecessorAdoption: PREDECESSOR_ADOPTION,
    expectedPredecessorAdoption: PREDECESSOR_ADOPTION,
    predecessorInstalled: true,
    successorNotInstalled: true,
  });
  assert.deepEqual(
    assertOrphanedSuccessorRecoveryFrames(orphanFrameInput),
    {
      predecessorDisposition: "exact-all-existing-plus-one",
      successorDisposition: "unchanged",
    },
  );
  for (const hostileOrphan of [
    { ...orphanFrameInput, successorNotInstalled: false },
    { ...orphanFrameInput, predecessorInstalled: false },
    {
      ...orphanFrameInput,
      currentRows:
        expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
          PRE_FUNCTIONS,
        ),
    },
    {
      ...orphanFrameInput,
      bundlePredecessorAdoption: {
        ...PREDECESSOR_ADOPTION,
        priorRootIdentitySha256: rawHash("wrong-orphan-root"),
      },
    },
  ]) {
    assert.throws(
      () => assertOrphanedSuccessorRecoveryFrames(hostileOrphan),
      /orphaned adopted bundle recovery frames differ/u,
    );
  }
  const orphanAuthorityInput = Object.freeze({
    attestation: Object.freeze({
      attestationSha256: rawHash("orphan-attestation"),
      predecessorAdoption: PREDECESSOR_ADOPTION,
      preinstallMainInventorySha256: inventorySha(PRE_MAIN),
      preinstallFinanceInventorySha256: inventorySha(PRE_FINANCE),
      preinstallFunctionInventorySha256: functionSha(PRE_FUNCTIONS),
    }),
    amendedAttestation: true,
    expectedAttestationSha256: null,
    expectedPredecessorAdoption: PREDECESSOR_ADOPTION,
    orphanedAdoptionAuthority: true,
    preinstallInventories: Object.freeze({
      main: new Map(PRE_MAIN.map(row => [row.name, row])),
      finance: new Map(PRE_FINANCE.map(row => [row.name, row])),
      functions: PRE_FUNCTIONS,
    }),
    runtimeFile: "/private/tmp/inert-orphan-runtime",
    readPrivateFileImpl: readRuntime,
  });
  runtimeReads = 0;
  for (const hostileFrame of [
    { currentRows: PRE_FUNCTIONS, predecessorInstalled: false,
      successorNotInstalled: true },
    { currentRows: PRE_FUNCTIONS, predecessorInstalled: true,
      successorNotInstalled: false },
    {
      currentRows: expectedMainFinanceRuntimeRecoveryV2PostSecretFunctionRows(
        PRE_FUNCTIONS,
      ),
      predecessorInstalled: true,
      successorNotInstalled: true,
    },
  ]) {
    assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
      ...orphanAuthorityInput,
      authorizeRuntimeRead: (attestation, preinstallInventories) =>
        assertOrphanedSuccessorRecoveryFrames({
          predecessorRows: PREDECESSOR_FUNCTIONS,
          successorRows: preinstallInventories.functions,
          currentRows: hostileFrame.currentRows,
          bundlePredecessorAdoption: attestation.predecessorAdoption,
          expectedPredecessorAdoption: PREDECESSOR_ADOPTION,
          predecessorInstalled: hostileFrame.predecessorInstalled,
          successorNotInstalled: hostileFrame.successorNotInstalled,
        }),
    }), /orphaned adopted bundle recovery frames differ/u);
    assert.equal(runtimeReads, 0);
  }
  assert.equal(readRuntimeBundlePlaintextAfterAuthority({
    ...orphanAuthorityInput,
    authorizeRuntimeRead: (attestation, preinstallInventories) =>
      assertOrphanedSuccessorRecoveryFrames({
        predecessorRows: PREDECESSOR_FUNCTIONS,
        successorRows: preinstallInventories.functions,
        currentRows: PRE_FUNCTIONS,
        bundlePredecessorAdoption: attestation.predecessorAdoption,
        expectedPredecessorAdoption: PREDECESSOR_ADOPTION,
        predecessorInstalled: true,
        successorNotInstalled: true,
      }),
  }), "runtime-plaintext");
  assert.equal(runtimeReads, 1);
  runtimeReads = 0;
  const orphanSwappedFunctions = POST_SECRET_FUNCTIONS;
  const orphanSwappedAttestation = Object.freeze({
    ...orphanAuthorityInput.attestation,
    attestationSha256: rawHash("coherent-orphan-baseline-swap"),
    preinstallFunctionInventorySha256: functionSha(orphanSwappedFunctions),
  });
  assert.throws(() => readRuntimeBundlePlaintextAfterAuthority({
    ...orphanAuthorityInput,
    attestation: orphanSwappedAttestation,
    preinstallInventories: Object.freeze({
      ...orphanAuthorityInput.preinstallInventories,
      functions: orphanSwappedFunctions,
    }),
    authorizeRuntimeRead: () => {},
  }), /exact predecessor terminal subject/u);
  assert.equal(runtimeReads, 0);

  const completionDependencies = Object.freeze({ name: "dependencies" });
  const completionRelease = Object.freeze({ name: "release" });
  const completionSource = Object.freeze({ name: "source" });
  const completionBundle = Object.freeze({ name: "bundle" });
  const completionBaselineRows = Object.freeze([{ name: "baseline" }]);
  const completionInput = Object.freeze({ name: "input" });
  const completionCommon = Object.freeze({ now: () => new Date(BASE_MS) });
  const completionCause = Object.freeze({
    hostedProofSha256: rawHash("completion-cause-proof"),
    hostedD0ResponseSha256: rawHash("completion-cause-d0"),
  });
  const completionSandwich = Object.freeze({
    proof: Object.freeze({ proofSha256: rawHash("completion-fresh-proof") }),
    d0: Object.freeze({ response_sha256: rawHash("completion-fresh-d0") }),
    functionInventory: Object.freeze({ sha256: rawHash("completion-function") }),
  });
  const completionPlan = Object.freeze({
    sourceCiRunId: "77",
    sourceCiRunApiSha256: rawHash("completion-ci-run"),
    sourceCiJobsApiSha256: rawHash("completion-ci-jobs"),
    sourceCiBranchApiSha256: rawHash("completion-ci-branch"),
    workflowBlobSha: "a".repeat(40),
    sourceCommitSha: "b".repeat(40),
  });
  const refreshedCompletionCi = Object.freeze({
    runId: completionPlan.sourceCiRunId,
    runApiSha256: completionPlan.sourceCiRunApiSha256,
    jobsApiSha256: completionPlan.sourceCiJobsApiSha256,
    branchApiSha256: completionPlan.sourceCiBranchApiSha256,
    workflowBlobSha: completionPlan.workflowBlobSha,
    headSha: completionPlan.sourceCommitSha,
    conclusion: "success",
  });
  const completionContext = Object.freeze({
    dependencies: completionDependencies,
    source: completionSource,
    provenance: Object.freeze({ name: "provenance" }),
    chain: Object.freeze([]),
  });
  const completionOrder = [];
  const collectedCompletion = await collectCompletionAuthority({
    postflightSandwichImpl: async (...args) => {
      completionOrder.push("sandwich");
      assert.deepEqual(args, [
        completionDependencies,
        completionRelease,
        completionSource,
        completionBundle,
        completionBaselineRows,
      ]);
      return completionSandwich;
    },
    inspectCiImpl: (...args) => {
      completionOrder.push("ci");
      assert.deepEqual(args, [
        completionContext,
        completionInput,
        completionCommon,
        completionRelease,
      ]);
      return refreshedCompletionCi;
    },
    completeReceiptFieldsImpl: fields => {
      completionOrder.push("complete");
      assert.equal(fields.ci, refreshedCompletionCi);
      assert.equal(fields.sandwich, completionSandwich);
      assert.equal(fields.functionInventory, completionSandwich.functionInventory);
      assert.equal(fields.causalHostedProofSha256, completionCause.hostedProofSha256);
      return Object.freeze({ ci: fields.ci, sandwich: fields.sandwich });
    },
    context: completionContext,
    input: completionInput,
    common: completionCommon,
    release: completionRelease,
    bundle: completionBundle,
    baselineRows: completionBaselineRows,
    plan: completionPlan,
    cause: completionCause,
  });
  assert.deepEqual(completionOrder, ["sandwich", "ci", "complete"]);
  assert.equal(collectedCompletion.ci, refreshedCompletionCi);
  assert.equal(collectedCompletion.sandwich, completionSandwich);
  assert.equal(collectedCompletion.completionFields.ci, refreshedCompletionCi);
  assert.throws(
    () => validateBundleRecoveryVariant({ predecessorAdoption: null }, false),
    /predecessor adoption is absent/u,
  );
  assert.throws(
    () => validateBundleRecoveryVariant({
      predecessorAdoption: PREDECESSOR_ADOPTION,
    }, true),
    /recovery variant differs/u,
  );
  const inventories = Object.freeze({
    main: new Map(Object.entries(generatedSecretDigests).map(([name, value]) => [
      name,
      Object.freeze({ name, value, updatedAt: at(-1_000) }),
    ])),
    finance: new Map(),
  });
  const release = Object.freeze({
    environment: Object.freeze({
      generatedSecrets: PREDECESSOR_ADOPTION.generatedSecretNames.map(name => ({ name })),
    }),
  });
  let randomCalls = 0;
  const adopted = selectGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl: () => {
      randomCalls += 1;
      throw new Error("random generation forbidden for adoption");
    },
    generatedSecretValues,
    expectedGeneratedSecretDigestSetSha256:
      predecessorAdoption.generatedSecretDigestSetSha256,
  });
  assert.deepEqual(adopted, {
    operatorSecret: generatedSecretValues.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2,
    triggerSecret: generatedSecretValues.MAIN_FINANCE_SYNC_TRIGGER_SECRET,
  });
  assert.equal(randomCalls, 0);

  assert.throws(() => selectGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl: () => Buffer.alloc(48, 3),
    generatedSecretValues,
    expectedGeneratedSecretDigestSetSha256:
      rawHash("wrong-generated-secret-subset"),
  }), /digest subset differs/u);
  assert.throws(() => resolveGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl: () => Buffer.alloc(48, 3),
    generatedSecretValues,
    predecessorAdoption: null,
  }), /requires predecessor adoption evidence/u);
  const missingValue = { ...generatedSecretValues };
  delete missingValue.MAIN_FINANCE_SYNC_TRIGGER_SECRET;
  assert.throws(() => selectGeneratedRuntimeSecrets({
    release,
    inventories,
    randomBytesImpl: () => Buffer.alloc(48, 3),
    generatedSecretValues: missingValue,
    expectedGeneratedSecretDigestSetSha256:
      predecessorAdoption.generatedSecretDigestSetSha256,
  }), /adopted generated secret values keys differ/u);

  const environmentContract = JSON.parse(readFileSync(ENVIRONMENT_FILE, "utf8"));
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf8"));
  const runtimeRelease = Object.freeze({
    environment: environmentContract,
    manifest,
    manifestSha256: rawHash("runtime-release-manifest"),
    preflightSqlSha256: rawHash("runtime-preflight-sql"),
  });
  const runtimeSourceIdentity = Object.freeze({
    commit: "6".repeat(40),
    tree: "7".repeat(40),
  });
  const runtimeSnapshot = Object.freeze({
    catalog_sha256: rawHash("runtime-catalog"),
    privacy_secret_inventory_sha256: rawHash("runtime-privacy-inventory"),
  });
  const runtime = runtimeRows({
    release: runtimeRelease,
    source: runtimeSourceIdentity,
    snapshot: runtimeSnapshot,
    operatorSecret: generatedSecretValues.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2,
    triggerSecret: generatedSecretValues.MAIN_FINANCE_SYNC_TRIGGER_SECRET,
  });
  const runtimeSourceFor = values =>
    `${runtime.names.map(name => `${name}=${values[name]}`).join("\n")}\n`;
  const digestSetFor = values => Object.fromEntries(runtime.names.map(name => [
    name,
    sha256(values[name]),
  ]));
  const generatedDigestSetFor = values => Object.fromEntries(
    PREDECESSOR_ADOPTION.generatedSecretNames.map(name => [name, sha256(values[name])]),
  );
  const attestationFor = values => {
    const runtimeSource = runtimeSourceFor(values);
    const generatedDigestSetSha256 = sha256(canonicalJson(
      generatedDigestSetFor(values),
    ));
    return Object.freeze({
      catalogSha256: runtimeSnapshot.catalog_sha256,
      privacyInventorySha256: runtimeSnapshot.privacy_secret_inventory_sha256,
      runtimeFileSha256: sha256(runtimeSource),
      operatorSecretSha256:
        sha256(values.MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2),
      triggerSecretSha256:
        sha256(values.MAIN_FINANCE_SYNC_TRIGGER_SECRET),
      expectedSecretDigests: digestSetFor(values),
      secretNames: runtime.names,
      predecessorAdoption: {
        ...PREDECESSOR_ADOPTION,
        generatedSecretDigestSetSha256: generatedDigestSetSha256,
      },
    });
  };
  const expectedGeneratedDigestSetSha256 = sha256(canonicalJson(
    generatedDigestSetFor(runtime.values),
  ));
  const runtimeAttestation = attestationFor(runtime.values);
  assert.deepEqual(validateRuntimeBundleValues({
    runtimeSource: runtime.source,
    values: runtime.values,
    attestation: runtimeAttestation,
    release: runtimeRelease,
    source: runtimeSourceIdentity,
    amendedAttestation: true,
    expectedGeneratedSecretDigestSetSha256: expectedGeneratedDigestSetSha256,
  }).generatedSecretDigests, generatedDigestSetFor(runtime.values));

  const generatedSwapValues = {
    ...runtime.values,
    MAIN_FINANCE_ACCESS_OPERATOR_SECRET_V2:
      Buffer.alloc(48, 3).toString("base64url"),
  };
  assert.throws(() => validateRuntimeBundleValues({
    runtimeSource: runtimeSourceFor(generatedSwapValues),
    values: generatedSwapValues,
    attestation: attestationFor(generatedSwapValues),
    release: runtimeRelease,
    source: runtimeSourceIdentity,
    amendedAttestation: true,
    expectedGeneratedSecretDigestSetSha256: expectedGeneratedDigestSetSha256,
  }), /deterministic value contract differs/u);

  const stableSwapValues = {
    ...runtime.values,
    MAIN_FINANCE_ACCESS_V2_SOURCE_COMMIT_SHA: "8".repeat(40),
  };
  assert.throws(() => validateRuntimeBundleValues({
    runtimeSource: runtimeSourceFor(stableSwapValues),
    values: stableSwapValues,
    attestation: attestationFor(stableSwapValues),
    release: runtimeRelease,
    source: runtimeSourceIdentity,
    amendedAttestation: true,
    expectedGeneratedSecretDigestSetSha256: expectedGeneratedDigestSetSha256,
  }), /deterministic value contract differs/u);
});

test("direct CLI denies production before files and keeps help local", () => {
  const args = projectRef => [
    OPERATOR_FILE,
    "plan",
    "--project-ref", projectRef,
    "--state-dir", "/private/tmp/main-finance-v2-inert-state",
    "--receipt-dir", "/private/tmp/main-finance-v2-inert-receipts",
    "--access-token-file", "/private/tmp/main-finance-v2-inert-token",
    "--supabase-cli", "/private/tmp/main-finance-v2-inert-supabase",
    "--git-cli", "/private/tmp/main-finance-v2-inert-git",
    "--gh-cli", "/private/tmp/main-finance-v2-inert-gh",
    "--release-provenance", "/private/tmp/main-finance-v2-inert-provenance",
    "--production-boundary", "/private/tmp/main-finance-v2-inert-production",
    "--target-config", "/private/tmp/main-finance-v2-inert-target",
  ];
  const environment = { LANG: "C", LC_ALL: "C", NO_COLOR: "1" };
  const production = spawnSync(process.execPath, args(PRODUCTION_REFS[0]), {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
  });
  assert.equal(production.status, 1);
  assert.equal(production.stdout, "");
  assert.match(production.stderr, /exact production project ref/u);

  const help = spawnSync(process.execPath, [OPERATOR_FILE, "--help"], {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
  });
  assert.equal(help.status, 0, help.stderr);
  assert.deepEqual(JSON.parse(help.stdout), {
    actions: ["measure", "plan", "apply", "reconcile", "verify"],
    exactTarget: MAIN_REF,
    mode: "help",
    ok: true,
    productionDenied: true,
  });
});

test("direct CLI maps public predecessor effect pins through readRelease", t => {
  const root = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v4-effect-pin-read-release-",
  ));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  chmodSync(root, 0o700);
  const receiptDirectory = path.join(root, "receipts");
  mkdirSync(receiptDirectory, { mode: 0o700 });
  const result = spawnSync(process.execPath, [
    OPERATOR_FILE,
    "apply",
    "--project-ref", MAIN_REF,
    "--state-dir", path.join(root, "missing-state"),
    "--receipt-dir", receiptDirectory,
    "--access-token-file", path.join(root, "token"),
    "--supabase-cli", path.join(root, "supabase"),
    "--git-cli", path.join(root, "git"),
    "--gh-cli", path.join(root, "gh"),
    "--release-provenance", path.join(root, "provenance"),
    "--source-ci-receipt", path.join(root, "source-ci"),
    "--production-boundary", path.join(root, "production"),
    "--target-config", path.join(root, "target"),
    "--approval", "inert",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", NO_COLOR: "1" },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.doesNotMatch(
    result.stderr,
    /predecessor adoption environment contract differs/u,
  );
  assert.match(result.stderr, /state directory must exist before.*lease/u);
});

test("direct current CLI rejects a persisted legacy plan before runtime, lease or mutation", t => {
  const root = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v3-legacy-current-chain-",
  ));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  chmodSync(root, 0o700);
  const stateDirectory = path.join(root, "state");
  const receiptDirectory = path.join(root, "receipts");
  mkdirSync(stateDirectory, { mode: 0o700 });
  mkdirSync(receiptDirectory, { mode: 0o700 });
  const runtimeFile = path.join(stateDirectory, "runtime-proof.env");
  const runtimeSentinel = "MUST_NOT_BE_READ=value\n";
  writeFileSync(runtimeFile, runtimeSentinel, { mode: 0o600 });

  const legacyCore = {
    schemaVersion: 2,
    sequence: 1,
    previousReceiptSha256: null,
    productionDenied: true,
    kind: "release-plan",
    environment: "staging",
    recordedAt: at(1_000),
    mutationScope: "secrets-set+function-deploy",
  };
  const legacyReceipt = {
    ...legacyCore,
    receiptSha256: sha256(canonicalJson(legacyCore)),
  };
  const receiptFile = path.join(receiptDirectory, "000001.json");
  writeFileSync(receiptFile, `${canonicalJson(legacyReceipt)}\n`, { mode: 0o600 });

  const marker = path.join(root, "tool-invoked");
  const fakeTool = path.join(root, "fake-tool");
  writeFileSync(
    fakeTool,
    `#!/bin/sh\n/usr/bin/touch '${marker}'\nexit 99\n`,
    { mode: 0o700 },
  );
  chmodSync(fakeTool, 0o700);
  const privateFiles = {};
  for (const name of ["token", "provenance", "sourceCi", "production", "target"]) {
    const file = path.join(root, name);
    writeFileSync(file, `${name}\n`, { mode: 0o600 });
    privateFiles[name] = file;
  }
  const stateEntries = readdirSync(stateDirectory);
  const receiptSource = readFileSync(receiptFile, "utf8");
  const leaseFile = `${stateDirectory}.main-finance-runtime-recovery-v2-operation.lock`;
  const result = spawnSync(process.execPath, [
    OPERATOR_FILE,
    "apply",
    "--project-ref", MAIN_REF,
    "--state-dir", stateDirectory,
    "--receipt-dir", receiptDirectory,
    "--access-token-file", privateFiles.token,
    "--supabase-cli", fakeTool,
    "--git-cli", fakeTool,
    "--gh-cli", fakeTool,
    "--release-provenance", privateFiles.provenance,
    "--source-ci-receipt", privateFiles.sourceCi,
    "--production-boundary", privateFiles.production,
    "--target-config", privateFiles.target,
    "--approval", "hostile-legacy-approval",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C", NO_COLOR: "1" },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /current release rejects legacy operational plan authority/u,
  );
  assert.equal(existsSync(leaseFile), false);
  assert.equal(existsSync(marker), false);
  assert.deepEqual(readdirSync(stateDirectory), stateEntries);
  assert.equal(readFileSync(runtimeFile, "utf8"), runtimeSentinel);
  assert.deepEqual(readdirSync(receiptDirectory), ["000001.json"]);
  assert.equal(readFileSync(receiptFile, "utf8"), receiptSource);
});

test("predecessor adoption CLI flags are plan-only, all-or-none and mandatory for fresh state", t => {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-predecessor-cli-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  for (const name of ["provenance", "source-ci", "production", "target"]) {
    writeFileSync(path.join(parent, name), `${name}\n`, { mode: 0o600 });
  }
  const common = action => [
    OPERATOR_FILE,
    action,
    "--project-ref", MAIN_REF,
    "--state-dir", path.join(parent, `${action}-state`),
    "--receipt-dir", path.join(parent, `${action}-receipts`),
    "--access-token-file", path.join(parent, "token"),
    "--supabase-cli", path.join(parent, "supabase"),
    "--git-cli", path.join(parent, "git"),
    "--gh-cli", path.join(parent, "gh"),
    "--release-provenance", path.join(parent, "provenance"),
    "--source-ci-receipt", path.join(parent, "source-ci"),
    "--production-boundary", path.join(parent, "production"),
    "--target-config", path.join(parent, "target"),
  ];
  const withOptions = (args, replacements) => {
    const updated = [...args];
    for (const [flag, value] of Object.entries(replacements)) {
      const index = updated.indexOf(flag);
      assert.notEqual(index, -1, flag);
      updated[index + 1] = value;
    }
    return updated;
  };
  const prior = [
    "--prior-state-dir", path.join(parent, "prior-state"),
    "--prior-receipt-dir", path.join(parent, "prior-receipts"),
    "--prior-release-provenance", path.join(parent, "prior-provenance"),
    "--prior-source-ci-receipt", path.join(parent, "prior-source-ci"),
    "--prior-effect-receipt-sha256", "a".repeat(64),
  ];
  const environment = { LANG: "C", LC_ALL: "C", NO_COLOR: "1" };
  mkdirSync(path.join(parent, "plan-receipts"), { mode: 0o700 });

  const partial = spawnSync(process.execPath, [
    ...common("plan"),
    "--prior-state-dir", path.join(parent, "prior-state"),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(partial.status, 1);
  assert.equal(partial.stdout, "");
  assert.match(partial.stderr, /predecessor adoption flags are all-or-none/u);

  const wrongAction = spawnSync(process.execPath, [
    ...common("apply"),
    "--approval", "inert",
    ...prior,
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(wrongAction.status, 1);
  assert.equal(wrongAction.stdout, "");
  assert.match(wrongAction.stderr, /accepted only by plan/u);

  const immutableBoundary = spawnSync(process.execPath, [
    ...common("plan"),
    ...prior,
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(immutableBoundary.status, 1);
  assert.equal(immutableBoundary.stdout, "");
  assert.match(
    immutableBoundary.stderr,
    /current and predecessor recovery roots must be distinct and non-nested/u,
  );
  assert.equal(existsSync(
    `${path.join(parent, "plan-state")}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const invalidReceipt = path.join(parent, "invalid-receipts");
  mkdirSync(invalidReceipt, { mode: 0o755 });
  const invalidReceiptBoundary = spawnSync(process.execPath, withOptions(
    common("plan"),
    { "--receipt-dir": invalidReceipt },
  ), { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(invalidReceiptBoundary.status, 1);
  assert.match(invalidReceiptBoundary.stderr, /current receipt directory.*0700/u);
  assert.equal(existsSync(
    `${path.join(parent, "plan-state")}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  mkdirSync(path.join(parent, "apply-receipts"), { mode: 0o700 });
  const missingApplyState = spawnSync(process.execPath, [
    ...common("apply"), "--approval", "inert",
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(missingApplyState.status, 1);
  assert.match(missingApplyState.stderr, /state directory must exist before.*lease/u);
  assert.equal(existsSync(
    `${path.join(parent, "apply-state")}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const equalOperationDirectory = path.join(parent, "equal-operation-directory");
  mkdirSync(equalOperationDirectory, { mode: 0o700 });
  const equalOperationBoundary = spawnSync(process.execPath, [
    ...withOptions(common("apply"), {
      "--state-dir": equalOperationDirectory,
      "--receipt-dir": equalOperationDirectory,
    }),
    "--approval", "inert",
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(equalOperationBoundary.status, 1);
  assert.match(equalOperationBoundary.stderr, /disjoint and non-nested/u);
  assert.equal(existsSync(
    `${equalOperationDirectory}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const oldRoot = path.join(parent, "old-root");
  const oldState = path.join(oldRoot, "state");
  const oldReceipts = path.join(oldRoot, "receipts");
  const newRoot = path.join(parent, "new-root");
  mkdirSync(oldRoot, { mode: 0o755 });
  mkdirSync(oldState, { mode: 0o700 });
  mkdirSync(oldReceipts, { mode: 0o700 });
  mkdirSync(newRoot, { mode: 0o700 });
  mkdirSync(path.join(newRoot, "receipts"), { mode: 0o700 });
  for (const name of ["provenance", "source-ci", "production", "target"]) {
    writeFileSync(path.join(newRoot, name), `${name}\n`, { mode: 0o600 });
  }
  const nonPrivateRoot = spawnSync(process.execPath, [
    OPERATOR_FILE,
    "plan",
    "--project-ref", MAIN_REF,
    "--state-dir", path.join(newRoot, "state"),
    "--receipt-dir", path.join(newRoot, "receipts"),
    "--access-token-file", path.join(parent, "token"),
    "--supabase-cli", path.join(parent, "supabase"),
    "--git-cli", path.join(parent, "git"),
    "--gh-cli", path.join(parent, "gh"),
    "--release-provenance", path.join(newRoot, "provenance"),
    "--source-ci-receipt", path.join(newRoot, "source-ci"),
    "--production-boundary", path.join(newRoot, "production"),
    "--target-config", path.join(newRoot, "target"),
    "--prior-state-dir", oldState,
    "--prior-receipt-dir", oldReceipts,
    "--prior-release-provenance", path.join(oldRoot, "provenance"),
    "--prior-source-ci-receipt", path.join(oldRoot, "source-ci"),
    "--prior-effect-receipt-sha256", "a".repeat(64),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(nonPrivateRoot.status, 1);
  assert.equal(nonPrivateRoot.stdout, "");
  assert.match(
    nonPrivateRoot.stderr,
    /predecessor root must be one owner-private mode 0700 directory/u,
  );

  const privateOldRoot = path.join(parent, "private-old-root");
  const nestedCurrentRoot = path.join(privateOldRoot, "new-root");
  mkdirSync(privateOldRoot, { mode: 0o700 });
  mkdirSync(path.join(privateOldRoot, "state"), { mode: 0o700 });
  mkdirSync(path.join(privateOldRoot, "receipts"), { mode: 0o700 });
  mkdirSync(nestedCurrentRoot, { mode: 0o700 });
  for (const file of [
    path.join(privateOldRoot, "provenance"),
    path.join(privateOldRoot, "source-ci"),
    path.join(nestedCurrentRoot, "provenance"),
    path.join(nestedCurrentRoot, "source-ci"),
    path.join(nestedCurrentRoot, "production"),
    path.join(nestedCurrentRoot, "target"),
  ]) writeFileSync(file, "fixture\n", { mode: 0o600 });
  const nestedState = path.join(nestedCurrentRoot, "state");
  const nestedReceipt = path.join(nestedCurrentRoot, "receipts");
  mkdirSync(nestedReceipt, { mode: 0o700 });
  const nestedBoundary = spawnSync(process.execPath, [
    OPERATOR_FILE,
    "plan",
    "--project-ref", MAIN_REF,
    "--state-dir", nestedState,
    "--receipt-dir", nestedReceipt,
    "--access-token-file", path.join(parent, "token"),
    "--supabase-cli", path.join(parent, "supabase"),
    "--git-cli", path.join(parent, "git"),
    "--gh-cli", path.join(parent, "gh"),
    "--release-provenance", path.join(nestedCurrentRoot, "provenance"),
    "--source-ci-receipt", path.join(nestedCurrentRoot, "source-ci"),
    "--production-boundary", path.join(nestedCurrentRoot, "production"),
    "--target-config", path.join(nestedCurrentRoot, "target"),
    "--prior-state-dir", path.join(privateOldRoot, "state"),
    "--prior-receipt-dir", path.join(privateOldRoot, "receipts"),
    "--prior-release-provenance", path.join(privateOldRoot, "provenance"),
    "--prior-source-ci-receipt", path.join(privateOldRoot, "source-ci"),
    "--prior-effect-receipt-sha256", "a".repeat(64),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(nestedBoundary.status, 1);
  assert.equal(nestedBoundary.stdout, "");
  assert.match(
    nestedBoundary.stderr,
    /current and predecessor recovery roots must be distinct and non-nested/u,
  );
  assert.equal(existsSync(
    `${nestedState}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);
  assert.equal(existsSync(nestedState), false);
  assert.equal(existsSync(nestedReceipt), true);

  const splitRoot = path.join(parent, "split-current-root");
  const splitReceiptRoot = path.join(parent, "split-receipt-root");
  mkdirSync(splitRoot, { mode: 0o700 });
  mkdirSync(splitReceiptRoot, { mode: 0o700 });
  for (const name of ["provenance", "source-ci", "production", "target"]) {
    writeFileSync(path.join(splitRoot, name), "fixture\n", { mode: 0o600 });
  }
  const splitState = path.join(splitRoot, "state");
  const splitBoundary = spawnSync(process.execPath, [
    ...withOptions(common("plan"), {
      "--state-dir": splitState,
      "--receipt-dir": path.join(splitReceiptRoot, "receipts"),
      "--release-provenance": path.join(splitRoot, "provenance"),
      "--source-ci-receipt": path.join(splitRoot, "source-ci"),
      "--production-boundary": path.join(splitRoot, "production"),
      "--target-config": path.join(splitRoot, "target"),
    }),
    ...prior,
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(splitBoundary.status, 1);
  assert.match(splitBoundary.stderr, /must share one exact root/u);
  assert.equal(existsSync(
    `${splitState}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  for (const [flag, foreignFile] of [
    ["--release-provenance", path.join(privateOldRoot, "provenance")],
    ["--source-ci-receipt", path.join(privateOldRoot, "source-ci")],
    ["--production-boundary", path.join(privateOldRoot, "provenance")],
    ["--target-config", path.join(privateOldRoot, "provenance")],
  ]) {
    const result = spawnSync(process.execPath, [
      ...withOptions(common("plan"), { [flag]: foreignFile }),
      ...prior,
    ], { cwd: ROOT, encoding: "utf8", env: environment });
    assert.equal(result.status, 1, flag);
    assert.match(result.stderr, /must share one exact root/u, flag);
  }

  const realCurrentRoot = path.join(parent, "real-current-root");
  const linkedCurrentRoot = path.join(parent, "linked-current-root");
  mkdirSync(realCurrentRoot, { mode: 0o700 });
  for (const name of ["provenance", "source-ci", "production", "target"]) {
    writeFileSync(path.join(realCurrentRoot, name), "fixture\n", { mode: 0o600 });
  }
  symlinkSync(realCurrentRoot, linkedCurrentRoot);
  const linkedState = path.join(linkedCurrentRoot, "state");
  const linkedCurrent = spawnSync(process.execPath, [
    ...withOptions(common("plan"), {
      "--state-dir": linkedState,
      "--receipt-dir": path.join(linkedCurrentRoot, "receipts"),
      "--release-provenance": path.join(linkedCurrentRoot, "provenance"),
      "--source-ci-receipt": path.join(linkedCurrentRoot, "source-ci"),
      "--production-boundary": path.join(linkedCurrentRoot, "production"),
      "--target-config": path.join(linkedCurrentRoot, "target"),
    }),
    ...prior,
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(linkedCurrent.status, 1);
  assert.match(linkedCurrent.stderr, /current recovery root must be one owner-private/u);
  assert.equal(existsSync(
    `${linkedState}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const realPriorRoot = path.join(parent, "real-prior-root");
  const linkedPriorRoot = path.join(parent, "linked-prior-root");
  mkdirSync(realPriorRoot, { mode: 0o700 });
  mkdirSync(path.join(realPriorRoot, "state"), { mode: 0o700 });
  mkdirSync(path.join(realPriorRoot, "receipts"), { mode: 0o700 });
  writeFileSync(path.join(realPriorRoot, "provenance"), "fixture\n", {
    mode: 0o600,
  });
  writeFileSync(path.join(realPriorRoot, "source-ci"), "fixture\n", {
    mode: 0o600,
  });
  symlinkSync(realPriorRoot, linkedPriorRoot);
  const priorSymlinkState = path.join(splitRoot, "prior-symlink-state");
  mkdirSync(path.join(splitRoot, "prior-symlink-receipts"), { mode: 0o700 });
  const linkedPredecessor = spawnSync(process.execPath, [
    ...withOptions(common("plan"), {
      "--state-dir": priorSymlinkState,
      "--receipt-dir": path.join(splitRoot, "prior-symlink-receipts"),
      "--release-provenance": path.join(splitRoot, "provenance"),
      "--source-ci-receipt": path.join(splitRoot, "source-ci"),
      "--production-boundary": path.join(splitRoot, "production"),
      "--target-config": path.join(splitRoot, "target"),
    }),
    "--prior-state-dir", path.join(linkedPriorRoot, "state"),
    "--prior-receipt-dir", path.join(linkedPriorRoot, "receipts"),
    "--prior-release-provenance", path.join(linkedPriorRoot, "provenance"),
    "--prior-source-ci-receipt", path.join(linkedPriorRoot, "source-ci"),
    "--prior-effect-receipt-sha256", "a".repeat(64),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(linkedPredecessor.status, 1);
  assert.match(
    linkedPredecessor.stderr,
    /predecessor root must be one owner-private/u,
  );
  assert.equal(existsSync(
    `${priorSymlinkState}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const applyState = path.join(splitRoot, "apply-state");
  const applyForeignProvenance = spawnSync(process.execPath, [
    ...withOptions(common("apply"), {
      "--state-dir": applyState,
      "--receipt-dir": path.join(splitRoot, "apply-receipts"),
      "--release-provenance": path.join(privateOldRoot, "provenance"),
      "--source-ci-receipt": path.join(splitRoot, "source-ci"),
      "--production-boundary": path.join(splitRoot, "production"),
      "--target-config": path.join(splitRoot, "target"),
    }),
    "--approval", "inert",
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(applyForeignProvenance.status, 1);
  assert.match(applyForeignProvenance.stderr, /must share one exact root/u);
  assert.equal(existsSync(
    `${applyState}.main-finance-runtime-recovery-v2-operation.lock`,
  ), false);

  const freshWithoutPrior = spawnSync(process.execPath, common("plan"), {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
  });
  assert.equal(freshWithoutPrior.status, 1);
  assert.equal(freshWithoutPrior.stdout, "");
  assert.match(
    freshWithoutPrior.stderr,
    /schema-4 initial plan requires all five predecessor authority flags/u,
  );
  assert.equal(existsSync(path.join(parent, "plan-state")), false);
  assert.equal(existsSync(path.join(parent, "plan-receipts")), true);
});

test("two direct CLI contenders preserve and refuse an existing dead-owner operation lease", t => {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-lease-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const stateDirectory = path.join(parent, "state");
  const receiptDirectory = path.join(parent, "receipts");
  mkdirSync(receiptDirectory, { mode: 0o700 });
  for (const name of ["provenance", "source-ci", "production", "target"]) {
    writeFileSync(path.join(parent, name), `${name}\n`, { mode: 0o600 });
  }
  const leaseFile = `${stateDirectory}.main-finance-runtime-recovery-v2-operation.lock`;
  const leaseSource = `${canonicalJson({
    schemaVersion: 1,
    kind: "main-finance-runtime-recovery-v2-operation-lease",
    pid: 2_147_483_647,
    startedAt: at(0),
    nonce: "f".repeat(64),
  })}\n`;
  writeFileSync(leaseFile, leaseSource, { mode: 0o600 });
  const args = [
    OPERATOR_FILE,
    "plan",
    "--project-ref", MAIN_REF,
    "--state-dir", stateDirectory,
    "--receipt-dir", receiptDirectory,
    "--access-token-file", path.join(parent, "token"),
    "--supabase-cli", path.join(parent, "supabase"),
    "--git-cli", path.join(parent, "git"),
    "--gh-cli", path.join(parent, "gh"),
    "--release-provenance", path.join(parent, "provenance"),
    "--source-ci-receipt", path.join(parent, "source-ci"),
    "--production-boundary", path.join(parent, "production"),
    "--target-config", path.join(parent, "target"),
  ];
  const environment = { LANG: "C", LC_ALL: "C", NO_COLOR: "1" };
  for (const contender of ["first", "second"]) {
    const result = spawnSync(process.execPath, args, {
      cwd: ROOT,
      encoding: "utf8",
      env: environment,
    });
    assert.equal(result.status, 1, contender);
    assert.equal(result.stdout, "", contender);
    assert.match(result.stderr, /operation_lease_present/u, contender);
    assert.equal(readFileSync(leaseFile, "utf8"), leaseSource, contender);
    assert.deepEqual(readdirSync(parent).sort(), [
      path.basename(leaseFile), "production", "provenance", "receipts", "source-ci",
      "target",
    ].sort(), contender);
    assert.equal(existsSync(stateDirectory), false, contender);
    assert.equal(existsSync(receiptDirectory), true, contender);
  }
});

test("measure forbids post-commit provenance while operational modes require it", t => {
  const parent = mkdtempSync(path.join(
    realpathSync(tmpdir()),
    "main-finance-v2-provenance-boundary-",
  ));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const common = action => [
    OPERATOR_FILE,
    action,
    "--project-ref", MAIN_REF,
    "--state-dir", path.join(parent, `${action}-state`),
    "--receipt-dir", path.join(parent, `${action}-receipts`),
    "--access-token-file", path.join(parent, "token"),
    "--supabase-cli", path.join(parent, "supabase"),
    "--git-cli", path.join(parent, "git"),
  ];
  const environment = { LANG: "C", LC_ALL: "C", NO_COLOR: "1" };
  const networkTripwire = path.join(parent, "network-performed");
  const preload = path.join(parent, "network-tripwire.mjs");
  writeFileSync(preload, [
    "import { writeFileSync } from 'node:fs';",
    `globalThis.fetch = () => { writeFileSync(${JSON.stringify(networkTripwire)}, 'called'); throw new Error('network forbidden'); };`,
  ].join("\n"), { mode: 0o600 });
  const measure = spawnSync(process.execPath, [
    "--import", preload,
    ...common("measure"),
    "--release-provenance", path.join(parent, "provenance"),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(measure.status, 1);
  assert.equal(measure.stdout, "");
  assert.match(measure.stderr, /--release-provenance is forbidden by measure/u);
  assert.equal(existsSync(path.join(parent, "measure-state")), false);
  assert.equal(existsSync(path.join(parent, "measure-receipts")), false);
  assert.equal(existsSync(networkTripwire), false);

  const measureGh = spawnSync(process.execPath, [
    "--import", preload,
    ...common("measure"),
    "--gh-cli", path.join(parent, "gh"),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(measureGh.status, 1);
  assert.equal(measureGh.stdout, "");
  assert.match(measureGh.stderr, /--gh-cli is forbidden by measure/u);
  assert.equal(existsSync(path.join(parent, "measure-state")), false);
  assert.equal(existsSync(path.join(parent, "measure-receipts")), false);
  assert.equal(existsSync(networkTripwire), false);

  const planWithoutGh = spawnSync(process.execPath, [
    ...common("plan"),
    "--release-provenance", path.join(parent, "provenance"),
    "--source-ci-receipt", path.join(parent, "source-ci"),
    "--production-boundary", path.join(parent, "production"),
    "--target-config", path.join(parent, "target"),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(planWithoutGh.status, 1);
  assert.equal(planWithoutGh.stdout, "");
  assert.match(planWithoutGh.stderr, /--gh-cli is required/u);

  const plan = spawnSync(process.execPath, [
    ...common("plan"),
    "--gh-cli", path.join(parent, "gh"),
    "--source-ci-receipt", path.join(parent, "source-ci"),
    "--production-boundary", path.join(parent, "production"),
    "--target-config", path.join(parent, "target"),
  ], { cwd: ROOT, encoding: "utf8", env: environment });
  assert.equal(plan.status, 1);
  assert.equal(plan.stdout, "");
  assert.match(plan.stderr, /--release-provenance is required/u);
  assert.deepEqual(readdirSync(parent), [path.basename(preload)]);
});

test("measurement source binds manifest branch and the complete dirty successor", () => {
  const source = readFileSync(OPERATOR_FILE, "utf8");
  const statusMatch = /const MEASUREMENT_GIT_STATUS = Object\.freeze\((\{[\s\S]*?\})\);/u.exec(source);
  assert.notEqual(statusMatch, null);
  assert.deepEqual(JSON.parse(statusMatch[1]), {
    "??": "A",
    "A ": "A",
    " M": "M",
    "M ": "M",
  });
  const releaseStart = source.indexOf("function readMeasurementRelease() {");
  const start = source.indexOf("function inspectMeasurementSource({");
  const end = source.indexOf("\nfunction manifestPathRelative()", start);
  assert.notEqual(releaseStart, -1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const measurementRelease = source.slice(releaseStart, source.indexOf(
    "\nfunction scrubEnvironment(",
    releaseStart,
  ));
  const measurementInspector = source.slice(start, end);
  assert.match(measurementRelease, /EXPECTED_TRACKED_FILE_COUNT/u);
  assert.match(measurementRelease, /canonicalJson\(EXPECTED_CHANGED_PATHS\)/u);
  assert.match(measurementInspector, /release\.manifest\.sourceBranch/u);
  assert.doesNotMatch(measurementInspector, /provenance/u);
  assert.doesNotMatch(measurementInspector, /ghCli|runGh|GitHub CLI/u);
  assert.match(measurementInspector, /commit !== BASE_COMMIT_SHA \|\| tree !== BASE_TREE_SHA/u);
  assert.match(
    measurementInspector,
    /canonicalJson\(workingPaths\.map[\s\S]*sortedChangedPaths\(release\.manifest\.sourceLineage\.changedPaths\)/u,
  );

  const operateStart = source.indexOf("async function operateMeasure(input, common) {");
  const operateEnd = source.indexOf("\nfunction initializeReadyOperation(", operateStart);
  assert.notEqual(operateStart, -1);
  assert.notEqual(operateEnd, -1);
  const measureOperator = source.slice(operateStart, operateEnd);
  assert.equal((measureOperator.match(/inspectCurrentSource\(\)/gu) ?? []).length, 2);
  const firstInspection = measureOperator.indexOf("const source = inspectCurrentSource();");
  const hostedRead = measureOperator.indexOf(
    "await measureMainFinanceRuntimeRecoveryCatalog({",
  );
  const secondInspection = measureOperator.indexOf(
    "const sourceAfterMeasurement = inspectCurrentSource();",
  );
  const receiptFields = measureOperator.indexOf("const measurementFields = Object.freeze({");
  assert.equal(
    firstInspection < hostedRead
      && hostedRead < secondInspection
      && secondInspection < receiptFields,
    true,
  );
  assert.match(
    measureOperator,
    /canonicalJson\(sourceAfterMeasurement\) !== canonicalJson\(source\)/u,
  );
});

test("read-only GitHub GET retries only bounded invoked transport failures", async t => {
  const { invokeReadOnlyGitHubApi } = await importInternalReadOnlyGitHubApi(t);
  const createBoundary = () => {
    const parent = mkdtempSync(path.join(
      realpathSync(tmpdir()),
      "main-finance-v2-read-only-github-xdg-",
    ));
    const boundary = Object.fromEntries(["state", "cache", "data"].map(name => {
      const directory = path.join(parent, name);
      mkdirSync(directory, { mode: 0o700 });
      chmodSync(directory, 0o500);
      return [name, directory];
    }));
    t.after(() => {
      for (const directory of Object.values(boundary)) {
        if (existsSync(directory)) chmodSync(directory, 0o700);
      }
      rmSync(parent, { recursive: true, force: true });
    });
    return Object.freeze(boundary);
  };
  const ghLocalState = createBoundary();
  const ghEnvironment = Object.freeze({
    GH_HOST: "github.com",
    GH_PROMPT_DISABLED: "1",
    XDG_STATE_HOME: ghLocalState.state,
    XDG_CACHE_HOME: ghLocalState.cache,
    XDG_DATA_HOME: ghLocalState.data,
  });
  const base = Object.freeze({
    gh: "/private/tmp/inert-gh",
    endpoint: "repos/example/project/actions/runs/321",
    label: "source CI run",
    ghEnvironment,
    ghLocalState,
  });
  const invokedFailure = () => Object.freeze({
    status: 1,
    signal: null,
    error: null,
    stdout: "withheld",
    cliInvoked: true,
  });
  const invokedSuccess = stdout => Object.freeze({
    status: 0,
    signal: null,
    error: null,
    stdout,
    cliInvoked: true,
  });

  const calls = [];
  const expectedValue = Object.freeze({ id: 321, status: "completed" });
  const result = invokeReadOnlyGitHubApi({
    ...base,
    runGh: (executable, args, environment) => {
      calls.push({ executable, args, environment });
      if (calls.length === 1) return invokedFailure();
      if (calls.length === 2) throw new Error("transient TLS runner exception");
      return invokedSuccess(`${JSON.stringify(expectedValue)}\n`);
    },
  });
  assert.deepEqual(result.value, expectedValue);
  assert.equal(result.sha256, sha256(canonicalJson(expectedValue)));
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].args, [
    "api",
    "--method", "GET",
    "-H", "Accept: application/vnd.github+json",
    "-H", "X-GitHub-Api-Version: 2022-11-28",
    base.endpoint,
  ]);
  assert.equal(Object.isFrozen(calls[0].args), true);
  assert.equal(calls.every(call => call.executable === base.gh), true);
  assert.equal(calls.every(call => call.args === calls[0].args), true);
  assert.equal(calls.every(call => call.environment === ghEnvironment), true);

  let exhaustedCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      exhaustedCalls += 1;
      return invokedFailure();
    },
  }), /source CI run live GitHub query failed; output withheld/u);
  assert.equal(exhaustedCalls, 3);

  let exhaustedExceptionCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      exhaustedExceptionCalls += 1;
      throw new Error("persistent TLS runner exception");
    },
  }), /source CI run live GitHub query failed; output withheld/u);
  assert.equal(exhaustedExceptionCalls, 3);

  let preSpawnCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      preSpawnCalls += 1;
      return Object.freeze({
        status: null,
        signal: null,
        error: null,
        stdout: "",
        cliInvoked: false,
        outcome: "pre_spawn_refused",
      });
    },
  }), /source CI run live GitHub query failed; output withheld/u);
  assert.equal(preSpawnCalls, 1);

  const authorityError = new Error(
    "Main Finance runtime recovery v2 refused: injected local authority differs",
  );
  let authorityCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      authorityCalls += 1;
      throw authorityError;
    },
  }), error => error === authorityError);
  assert.equal(authorityCalls, 1);

  let oversizedCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      oversizedCalls += 1;
      return invokedSuccess("x".repeat(2 * 1024 * 1024 + 1));
    },
  }), /source CI run live GitHub query failed; output withheld/u);
  assert.equal(oversizedCalls, 1);

  let malformedCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      malformedCalls += 1;
      return invokedSuccess("{not-json");
    },
  }), /source CI run live GitHub JSON differs/u);
  assert.equal(malformedCalls, 1);

  let directSuccessCalls = 0;
  const directSuccess = invokeReadOnlyGitHubApi({
    ...base,
    runGh: () => {
      directSuccessCalls += 1;
      return invokedSuccess('{"direct":true}\n');
    },
  });
  assert.deepEqual(directSuccess.value, { direct: true });
  assert.equal(directSuccessCalls, 1);
  for (const directory of Object.values(ghLocalState)) {
    assert.equal(lstatSync(directory).mode & 0o777, 0o500);
    assert.deepEqual(readdirSync(directory), []);
  }

  const driftedLocalState = createBoundary();
  let driftCalls = 0;
  assert.throws(() => invokeReadOnlyGitHubApi({
    ...base,
    ghLocalState: driftedLocalState,
    runGh: () => {
      driftCalls += 1;
      chmodSync(driftedLocalState.state, 0o700);
      writeFileSync(path.join(driftedLocalState.state, "unexpected"), "drift", {
        mode: 0o600,
      });
      chmodSync(driftedLocalState.state, 0o500);
      return invokedFailure();
    },
  }), /GitHub CLI XDG state home must remain one empty owner-private/u);
  assert.equal(driftCalls, 1);
});

if (process.platform === "darwin") {
  test("reviewed Darwin frozen host pins smoke", () => {
    assert.equal(process.arch, "arm64");
    assert.equal(process.execPath, NODE);
    const localStateRoot = mkdtempSync(path.join(
      realpathSync(tmpdir()),
      "main-finance-v2-cli-state-",
    ));
    try {
    const sealedDirectories = Object.fromEntries([
      "supabase-home",
      "gh-xdg-state",
      "gh-xdg-cache",
      "gh-xdg-data",
    ].map(name => {
      const directory = path.join(localStateRoot, name);
      mkdirSync(directory, { mode: 0o700 });
      chmodSync(directory, 0o500);
      return [name, directory];
    }));
    const pins = [
      ["/usr/bin/git", "179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818", "git version 2.50.1 (Apple Git-155)"],
      [NODE, "90e41658177a192c8c23940e58d8252544e5b40cbaef7bd52a3c3c54caf9dd91", "v24.14.0"],
      [SUPABASE, "b7be23f4e211b75c00a3df5fcd1f96f3905983c74ff3189bfc69ad5b0f7132c4", "2.109.1"],
      [GH, "0d17dddf96bcc1dc50f3420a064d593d64016b0be16286a6c26121f2a5cb8316", "gh version 2.97.0 (2026-07-31)"],
    ];
    for (const [file, digest, version] of pins) {
      assert.equal(existsSync(file), true, file);
      const status = lstatSync(file);
      assert.equal(status.isFile(), true, file);
      assert.equal(status.isSymbolicLink(), false, file);
      assert.equal((status.mode & 0o111) !== 0, true, file);
      assert.equal(status.mode & 0o022, 0, file);
      assert.equal(realpathSync(file), file);
      assert.equal(sha256(readFileSync(file)), digest);
      const environment = {
        PATH: "/usr/bin:/bin",
        LANG: "C",
        LC_ALL: "C",
        NO_COLOR: "1",
      };
      if (file === SUPABASE) {
        Object.assign(environment, {
          SUPABASE_HOME: sealedDirectories["supabase-home"],
          SUPABASE_TELEMETRY_DISABLED: "1",
          DO_NOT_TRACK: "1",
        });
      }
      if (file === GH) {
        Object.assign(environment, {
          GH_CONFIG_DIR: "/Users/Maks/.config/gh",
          GH_HOST: "github.com",
          GH_PROMPT_DISABLED: "1",
          GH_PAGER: "cat",
          GH_TELEMETRY: "0",
          GH_NO_UPDATE_NOTIFIER: "1",
          DO_NOT_TRACK: "1",
          XDG_STATE_HOME: sealedDirectories["gh-xdg-state"],
          XDG_CACHE_HOME: sealedDirectories["gh-xdg-cache"],
          XDG_DATA_HOME: sealedDirectories["gh-xdg-data"],
        });
      }
      const result = spawnSync(file, ["--version"], {
        cwd: file === SUPABASE ? sealedDirectories["supabase-home"] : ROOT,
        encoding: "utf8",
        env: environment,
      });
      assert.equal(result.error, undefined, file);
      assert.equal(result.signal, null, file);
      assert.equal(result.status, 0, file);
      assert.equal(result.stdout.trim().split("\n", 1)[0], version, file);
    }
    for (const directory of Object.values(sealedDirectories)) {
      assert.equal(lstatSync(directory).mode & 0o777, 0o500, directory);
      assert.deepEqual(readdirSync(directory), [], directory);
    }

    assert.equal(existsSync(ARCHIVE), true);
    const archiveStatus = lstatSync(ARCHIVE);
    assert.equal(archiveStatus.isFile(), true);
    assert.equal(archiveStatus.isSymbolicLink(), false);
    assert.equal(archiveStatus.mode & 0o022, 0);
    assert.equal(realpathSync(ARCHIVE), ARCHIVE);
    assert.equal(
      sha256(readFileSync(ARCHIVE)),
      "e36776717a56d704769229649349b3a382f413cb31f1fb2ba4647ef8bcf7339b",
    );
    } finally {
      rmSync(localStateRoot, { recursive: true, force: true });
    }
  });
}

test("release sources keep privacy/production exclusions and deny successor function deploy authority", () => {
  const source = readFileSync(
    path.join(ROOT, "scripts/prepare-main-finance-runtime-recovery-v2.mjs"),
    "utf8",
  );
  assert.match(source, /"--no-verify-jwt",\s*"--use-api"/u);
  assert.equal(
    (source.match(/"--output",\s*"json",\s*"--log-level",\s*"error"/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(source, /--output-format/u);
  assert.match(source, /release-complete must remain the terminal receipt/u);
  assert.match(source, /apply requires a fresh owner-approved plan as the latest receipt/u);
  assert.match(source, /SUPABASE_TELEMETRY_DISABLED/u);
  assert.match(source, /GH_CONFIG_DIR/u);
  assert.match(source, /const SEALED_LOCAL_STATE_MODE = 0o500;/u);
  assert.match(
    source,
    /const MAX_READ_ONLY_GITHUB_API_ATTEMPTS = 3;/u,
  );
  assert.match(source, /GH_TELEMETRY: "0"/u);
  assert.match(source, /GH_NO_UPDATE_NOTIFIER: "1"/u);
  assert.match(source, /XDG_STATE_HOME: ghLocalState\.state/u);
  assert.match(source, /XDG_CACHE_HOME: ghLocalState\.cache/u);
  assert.match(source, /XDG_DATA_HOME: ghLocalState\.data/u);
  assert.match(
    source,
    /finally \{\s*assertGhLocalStateUnchanged\(ghLocalState\);\s*\}/u,
  );
  assert.match(source, /GitHub CLI local state contains preserved unreviewed state/u);
  assert.match(source, /const suffix = `-recovery-\$\{String\(index\)\.padStart/u);
  assert.match(source, /state: `\$\{GH_XDG_STATE_DIRECTORY\}\$\{suffix\}`/u);
  assert.match(source, /cache: `\$\{GH_XDG_CACHE_DIRECTORY\}\$\{suffix\}`/u);
  assert.match(source, /data: `\$\{GH_XDG_DATA_DIRECTORY\}\$\{suffix\}`/u);
  const githubApiStart = source.indexOf("function invokeReadOnlyGitHubApi({");
  const ciStart = source.indexOf("function inspectSourceCi({");
  assert.notEqual(githubApiStart, -1);
  const ciEnd = source.indexOf("\nfunction readAccessToken(", ciStart);
  assert.notEqual(ciStart, -1);
  assert.notEqual(ciEnd, -1);
  const githubApi = source.slice(githubApiStart, ciStart);
  const ciInspector = source.slice(ciStart, ciEnd);
  assert.match(
    githubApi,
    /for \(let attempt = 1; attempt <= MAX_READ_ONLY_GITHUB_API_ATTEMPTS; attempt \+= 1\)/u,
  );
  assert.equal((githubApi.match(/\brunGh\(/gu) ?? []).length, 1);
  assert.equal(
    (githubApi.match(/assertGhLocalStateUnchanged\(ghLocalState\)/gu) ?? []).length,
    2,
  );
  assert.match(githubApi, /error\.message\.startsWith\(REFUSAL_PREFIX\)/u);
  assert.match(githubApi, /result\?\.cliInvoked !== true/u);
  assert.match(
    githubApi,
    /Buffer\.byteLength\(result\.stdout, "utf8"\) > 2 \* 1024 \* 1024/u,
  );
  assert.match(githubApi, /value = JSON\.parse\(result\.stdout\)/u);
  assert.doesNotMatch(
    githubApi,
    /append|writeFile|fetch|runCli|invokeCli|mutation/iu,
  );
  assert.equal((ciInspector.match(/invokeReadOnlyGitHubApi\(/gu) ?? []).length, 1);
  const branchQuery = ciInspector.indexOf("const branch = invokeApi(");
  const branchSemantic = ciInspector.indexOf(
    "live release branch no longer points to the reviewed source commit",
  );
  const runQuery = ciInspector.indexOf("const run = invokeApi(");
  const runSemantic = ciInspector.indexOf(
    "live source CI run is not the exact successful same-SHA workflow",
  );
  const jobsQuery = ciInspector.indexOf("const jobs = invokeApi(");
  const jobsSemantic = ciInspector.indexOf(
    "live source CI job cardinality differs",
  );
  assert.equal(
    branchQuery < branchSemantic
      && branchSemantic < runQuery
      && runQuery < runSemantic
      && runSemantic < jobsQuery
      && jobsQuery < jobsSemantic,
    true,
  );
  assert.match(source, /Supabase CLI home contains preserved unreviewed state/u);
  assert.match(
    source,
    /cwd: workingDirectory/u,
  );
  const initializeStart = source.indexOf("function initializeReadyOperation(");
  const initializeEnd = source.indexOf("\nasync function operatePlan(", initializeStart);
  assert.notEqual(initializeStart, -1);
  assert.notEqual(initializeEnd, -1);
  const initialize = source.slice(initializeStart, initializeEnd);
  const sourceBeforeCi = initialize.indexOf("const source = inspectCurrentSource();");
  const liveCi = initialize.indexOf("const ci = inspectSourceCi({");
  const sourceAfterCi = initialize.indexOf("const sourceAfterCi = inspectCurrentSource();");
  assert.equal(sourceBeforeCi < liveCi && liveCi < sourceAfterCi, true);
  assert.match(initialize, /Main source changed during live CI attestation/u);
  const operations = source.slice(initializeEnd);
  assert.equal(
    (operations.match(/inspectReadyOperationSourceCi\(context, input, common, release\)/gu)
      ?? []).length,
    8,
  );
  assert.equal(
    (operations.match(/collectCompletionAuthority\(\{/gu) ?? []).length,
    3,
  );
  const completionHelperStart = source.indexOf(
    "async function collectCompletionAuthority({",
  );
  const completionHelperEnd = source.indexOf(
    "\nfunction completeReceiptFields({",
    completionHelperStart,
  );
  assert.notEqual(completionHelperStart, -1);
  assert.notEqual(completionHelperEnd, -1);
  assert.match(
    source.slice(completionHelperStart, completionHelperEnd),
    /inspectCiImpl\(context, input, common, release\)/u,
  );
  assert.match(initialize, /ghLocalState: context\.ghLocalState/u);
  assert.match(initialize, /Main source changed before live CI re-attestation/u);
  assert.match(initialize, /Main source changed during live CI re-attestation/u);
  assert.doesNotMatch(source, /CLI_ENVIRONMENT_ALLOWLIST[\s\S]{0,300}"HOME"/u);
  assert.equal(statSync(PREFLIGHT_FILE).isFile(), true);
  assert.equal(sha256(PREFLIGHT), "55090f0ee9194936a049fca1a7a5999d563f3651d763e204782f0b1381e341ea");
  assert.equal([...PREFLIGHT.matchAll(/\bcoalesce\s*\(/giu)].length, 11);
  assert.doesNotMatch(PREFLIGHT, /\bpg_catalog\.coalesce\s*\(/iu);
});
