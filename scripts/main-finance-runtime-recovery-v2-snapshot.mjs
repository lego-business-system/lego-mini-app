import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const RELEASE_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "supabase/releases/main-finance-runtime-recovery-v2",
);
const MANIFEST_FILE = path.join(RELEASE_DIRECTORY, "staging.manifest.json");

export const MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF = "bljeoovhydhjhdzwplxh";
export const MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF = "makgsbjduobcphuqzaoq";
export const MAIN_FINANCE_RUNTIME_RECOVERY_V2_PRODUCTION_DENY_REFS = Object.freeze([
  "soxtekhspohkddpdidvp",
  "koibxwgtihwajocxfetb",
]);
export const MAIN_FINANCE_RUNTIME_RECOVERY_V2_PHASES = Object.freeze([
  "recovery",
  "access",
  "reconcile",
]);

const MANAGEMENT_QUERY_URL =
  `https://api.supabase.com/v1/projects/${MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF}/database/query/read-only`;
const READY_STATUS = "READY_FOR_SOURCE_ATTESTATION";
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OID = /^[0-9a-f]{40}$/u;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{1,255}$/u;
const ACCESS_TOKEN = /^[A-Za-z0-9._-]{20,4096}$/u;
const OPERATOR_SECRET = /^[^\s\u0000-\u001f\u007f]{32,4096}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;

const GATES = Object.freeze([
  Object.freeze({
    projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF,
    name: "FINANCE_ENTITLEMENT_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF,
    name: "FINANCE_ENTITLEMENT_V2_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF,
    name: "FINANCE_TELEGRAM_PROTOCOL_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF,
    name: "MAIN_FINANCE_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF,
    name: "MAIN_FINANCE_PROTOCOL_MODE",
  }),
]);

const TABLE_NAMES = Object.freeze([
  "architecture_finance_access_desired",
  "architecture_finance_access_outbox",
  "architecture_finance_issue_replay_guard",
  "architecture_finance_issue_requests",
  "architecture_product_entitlements",
]);

const FUNCTION_CATALOG = Object.freeze([
  Object.freeze(["architecture_begin_finance_issue_internal", "uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone", "jsonb", "v", true, 0, "292fd9c6cc750a291db0008e34b3d0bc"]),
  Object.freeze(["architecture_claim_finance_access_outbox_internal", "uuid, text, integer, uuid", "jsonb", "v", true, 2, "0f34d47992c44eb7328e73d67204126b"]),
  Object.freeze(["architecture_finance_set_updated_at_internal", "", "trigger", "v", false, 0, "ba01fe3d1a916c7a8f497915431bbac5"]),
  Object.freeze(["architecture_finish_finance_access_outbox_internal", "uuid, uuid, text, text", "jsonb", "v", true, 1, "1d1343aa890a46e2057dd181da497ba9"]),
  Object.freeze(["architecture_finish_finance_issue_internal", "uuid, bytea, text, timestamp with time zone", "jsonb", "v", true, 1, "224981384a3ef9c101a77a9d3eb7e638"]),
  Object.freeze(["architecture_get_finance_access_status_internal", "uuid, uuid", "jsonb", "s", true, 1, "2eac4225c64453659ed17233f8005c86"]),
  Object.freeze(["architecture_resolve_finance_subject_internal", "uuid", "jsonb", "s", true, 0, "fb834aa38d61b0cdbe51571ef80e661c"]),
  Object.freeze(["architecture_set_finance_access_desired_internal", "uuid, uuid, bytea, text, text, text, bigint", "jsonb", "v", true, 0, "a676ce7f658a6bc3652b074c1948e8e2"]),
  Object.freeze(["architecture_upsert_product_entitlement_internal", "bytea, text, text, timestamp with time zone, timestamp with time zone", "jsonb", "v", true, 2, "4a4b56b2f6c340a6358dc4c826a29d31"]),
]);

const FUNCTION_EXECUTE_ACL = Object.freeze([
  Object.freeze(["architecture_begin_finance_issue_internal", "uuid, bytea, bytea, text, bytea, bytea, bigint, timestamp with time zone", "service_role"]),
  Object.freeze(["architecture_claim_finance_access_outbox_internal", "uuid, text, integer, uuid", "service_role"]),
  Object.freeze(["architecture_finish_finance_access_outbox_internal", "uuid, uuid, text, text", "service_role"]),
  Object.freeze(["architecture_finish_finance_issue_internal", "uuid, bytea, text, timestamp with time zone", "service_role"]),
  Object.freeze(["architecture_get_finance_access_status_internal", "uuid, uuid", "service_role"]),
  Object.freeze(["architecture_resolve_finance_subject_internal", "uuid", "service_role"]),
  Object.freeze(["architecture_set_finance_access_desired_internal", "uuid, uuid, bytea, text, text, text, bigint", "service_role"]),
  Object.freeze(["architecture_upsert_product_entitlement_internal", "bytea, text, text, timestamp with time zone, timestamp with time zone", "postgres"]),
]);
const BUILT_SNAPSHOTS = new WeakMap();
const VERIFIED_ATTESTATION_PROOFS = new WeakMap();

function refuse(message) {
  throw new Error(`Main Finance runtime recovery v2 snapshot refused: ${message}`);
}

export function mainFinanceRuntimeRecoveryV2Sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function mainFinanceRuntimeRecoveryV2CanonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(mainFinanceRuntimeRecoveryV2CanonicalJson).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${mainFinanceRuntimeRecoveryV2CanonicalJson(value[key])}`).join(",")}}`;
}

function exactKeys(value, expected, label) {
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    mainFinanceRuntimeRecoveryV2CanonicalJson(Object.keys(value).sort()) !==
      mainFinanceRuntimeRecoveryV2CanonicalJson([...expected].sort())
  ) refuse(`${label} keys differ`);
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function readJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    refuse(`${label} JSON differs`);
  }
}

export function readMainFinanceRuntimeRecoveryV2SnapshotContract() {
  const manifestSource = readFileSync(MANIFEST_FILE, "utf8");
  const manifest = readJson(manifestSource, "release manifest");
  if (
    manifest.schemaVersion !== 4 ||
    manifest.kind !== "main-finance-runtime-recovery-v4-target-redeploy-staging-release" ||
    manifest.releaseStatus !== READY_STATUS ||
    manifest.environment !== "staging" ||
    manifest.mainProjectRef !== MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF ||
    manifest.financeProjectRef !== MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF ||
    mainFinanceRuntimeRecoveryV2CanonicalJson(manifest.productionDenyProjectRefs) !==
      mainFinanceRuntimeRecoveryV2CanonicalJson(
        MAIN_FINANCE_RUNTIME_RECOVERY_V2_PRODUCTION_DENY_REFS,
      ) ||
    !SHA256.test(manifest.deploymentClosureSetSha256 ?? "") ||
    !SHA256.test(manifest.expectedDatabaseCatalogSha256 ?? "") ||
    manifest.preflightSql?.path !==
      "supabase/releases/main-finance-runtime-recovery-v2/preflight.sql" ||
    !SHA256.test(manifest.preflightSql?.sha256 ?? "")
  ) refuse("frozen release snapshot contract is unavailable");
  const preflightFile = path.resolve(REPOSITORY_ROOT, manifest.preflightSql.path);
  if (!preflightFile.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) {
    refuse("preflight SQL path escapes repository");
  }
  const preflightSql = readFileSync(preflightFile, "utf8");
  if (
    mainFinanceRuntimeRecoveryV2Sha256(preflightSql) !== manifest.preflightSql.sha256 ||
    /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE|GRANT|REVOKE)\b/iu
      .test(preflightSql) ||
    /telegram_id|encode\s*\(\s*[^,]*subject_digest|subject_digest\s*::\s*text/iu
      .test(preflightSql)
  ) refuse("frozen read-only preflight SQL differs");
  return Object.freeze({
    preflightSql,
    preflightSqlSha256: manifest.preflightSql.sha256,
    expectedCatalogSha256: manifest.expectedDatabaseCatalogSha256,
    releaseManifestSha256: mainFinanceRuntimeRecoveryV2Sha256(manifestSource),
    sourceDeploymentSha256: manifest.deploymentClosureSetSha256,
  });
}

function normalizeInventoryRows(rows, projectRef) {
  if (!Array.isArray(rows) || rows.length === 0) {
    refuse(`secret inventory for ${projectRef} differs`);
  }
  const normalized = [];
  const names = new Set();
  for (const row of rows) {
    exactKeys(row, ["name", "value", "updated_at"], "secret inventory row");
    if (
      typeof row.name !== "string" || !SECRET_NAME.test(row.name) ||
      typeof row.value !== "string" || !SHA256.test(row.value) ||
      !canonicalTimestamp(row.updated_at) || names.has(row.name)
    ) refuse("secret inventory row differs");
    names.add(row.name);
    normalized.push(Object.freeze({
      name: row.name,
      valueSha256: row.value,
      updatedAt: row.updated_at,
    }));
  }
  normalized.sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze(normalized);
}

export function buildMainFinanceRuntimeRecoveryInventoryEvidence({
  phase,
  mainSecretInventoryRows,
  financeSecretInventoryRows,
}) {
  if (!MAIN_FINANCE_RUNTIME_RECOVERY_V2_PHASES.includes(phase)) {
    refuse("secret inventory phase differs");
  }
  const main = normalizeInventoryRows(
    mainSecretInventoryRows,
    MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF,
  );
  const finance = normalizeInventoryRows(
    financeSecretInventoryRows,
    MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF,
  );
  const inventories = new Map([
    [MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF, new Map(main.map((row) => [row.name, row]))],
    [MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF, new Map(finance.map((row) => [row.name, row]))],
  ]);
  const disabled = mainFinanceRuntimeRecoveryV2Sha256("disabled");
  const enabled = mainFinanceRuntimeRecoveryV2Sha256("enabled");
  const recoveryVectors = [
    {
      FINANCE_ENTITLEMENT_SYNC_MODE: disabled,
      FINANCE_ENTITLEMENT_V2_SYNC_MODE: enabled,
      FINANCE_TELEGRAM_PROTOCOL_MODE: disabled,
      MAIN_FINANCE_SYNC_MODE: disabled,
      MAIN_FINANCE_PROTOCOL_MODE: disabled,
    },
    {
      FINANCE_ENTITLEMENT_SYNC_MODE: disabled,
      FINANCE_ENTITLEMENT_V2_SYNC_MODE: disabled,
      FINANCE_TELEGRAM_PROTOCOL_MODE: disabled,
      MAIN_FINANCE_SYNC_MODE: disabled,
      MAIN_FINANCE_PROTOCOL_MODE: disabled,
    },
  ];
  const accessVectors = [{
    FINANCE_ENTITLEMENT_SYNC_MODE: disabled,
    FINANCE_ENTITLEMENT_V2_SYNC_MODE: enabled,
    FINANCE_TELEGRAM_PROTOCOL_MODE: enabled,
    MAIN_FINANCE_SYNC_MODE: enabled,
    MAIN_FINANCE_PROTOCOL_MODE: enabled,
  }];
  const inventoryPhase = phase === "reconcile" ? "access" : phase;
  const allowedVectors = inventoryPhase === "recovery" ? recoveryVectors : accessVectors;
  const gateRows = GATES.map((gate) => {
    const row = inventories.get(gate.projectRef)?.get(gate.name);
    if (!row) refuse(`gate ${gate.name} is absent`);
    return Object.freeze({
      projectRef: gate.projectRef,
      name: gate.name,
      valueSha256: row.valueSha256,
      updatedAt: row.updatedAt,
    });
  });
  if (!allowedVectors.some((vector) => GATES.every((gate) =>
    inventories.get(gate.projectRef)?.get(gate.name)?.valueSha256 === vector[gate.name]))) {
    refuse(`gate vector is outside the exact ${phase} phase contract`);
  }
  const privacy = inventories.get(MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF)
    ?.get("MAIN_FINANCE_PRIVACY_HMAC_KEY");
  if (!privacy) refuse("legacy Main privacy secret inventory row is absent");
  const inventoryCore = (rowsValue) => rowsValue.map((row) => ({
    name: row.name,
    valueSha256: row.valueSha256,
    updatedAt: row.updatedAt,
  }));
  return Object.freeze({
    phase,
    mainInventorySha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(inventoryCore(main)),
    ),
    financeInventorySha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(inventoryCore(finance)),
    ),
    gateInventorySha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson({ phase: inventoryPhase, gates: gateRows }),
    ),
    privacyInventorySha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson({
        projectRef: MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF,
        name: privacy.name,
        valueSha256: privacy.valueSha256,
        updatedAt: privacy.updatedAt,
      }),
    ),
  });
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
    if (error instanceof Error && error.message.startsWith("Main Finance runtime recovery v2 snapshot refused:")) {
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

async function managementQuery({ accessToken, fetchImpl, preflightSql }) {
  if (!ACCESS_TOKEN.test(accessToken) || typeof fetchImpl !== "function") {
    refuse("Management query dependency differs");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetchImpl(MANAGEMENT_QUERY_URL, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: mainFinanceRuntimeRecoveryV2CanonicalJson({ query: preflightSql }),
    });
  } catch {
    refuse("Management read-only query failed; output withheld");
  } finally {
    clearTimeout(timeout);
  }
  if (
    response.status !== 201 || response.redirected ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu
      .test(response.headers.get("content-type") ?? "")
  ) refuse("Management read-only query response boundary differs");
  const source = await boundedResponseText(response, 512 * 1024, "Management query");
  let rows;
  try {
    rows = JSON.parse(source);
  } catch {
    refuse("Management read-only query JSON differs");
  }
  if (!Array.isArray(rows) || rows.length !== 1) {
    refuse("Management read-only query must return exactly one row");
  }
  return Object.freeze({
    rows,
    responseSha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(rows),
    ),
  });
}

function countField(row, name, expected = null) {
  const value = row[name];
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    refuse(`database ${name} differs`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) refuse(`database ${name} exceeds safe range`);
  if (expected !== null && parsed !== expected) refuse(`database ${name} differs`);
  return parsed;
}

function validateMigrationCatalog(value) {
  if (!Array.isArray(value) || value.length !== 6) {
    refuse("database migration catalog count differs");
  }
  const expected = [
    ["20260714235900", "finance_integration_foundation"],
    ["20260715010000", "finance_entitlement_outbox_v1"],
    ["20260715020000", "finance_subject_resolver_v1"],
    ["20260729010000", "finance_security_definer_owner_acl_v1"],
    ["20260729020000", "finance_security_definer_nested_execute_acl_v1"],
  ];
  let remote = 0;
  for (const item of value) {
    exactKeys(item, ["version", "name"], "migration catalog row");
    if (item.name === "remote_schema" && /^[0-9]{14}$/u.test(item.version)) {
      remote += 1;
    } else if (!expected.some(([version, name]) =>
      item.version === version && item.name === name)) {
      refuse("database migration catalog contains an unexpected row");
    }
  }
  if (remote !== 1 || expected.some(([version, name]) =>
    !value.some((item) => item.version === version && item.name === name))) {
    refuse("database migration catalog differs");
  }
}

function validateRelationCatalog(value) {
  if (!Array.isArray(value) || value.length !== TABLE_NAMES.length ||
    mainFinanceRuntimeRecoveryV2CanonicalJson(value.map((item) => item?.name)) !==
      mainFinanceRuntimeRecoveryV2CanonicalJson(TABLE_NAMES)) {
    refuse("database relation catalog differs");
  }
  for (const item of value) {
    exactKeys(item, [
      "name", "kind", "owner", "rls", "force_rls", "column_count",
      "constraint_count", "index_count", "trigger_count", "policy_count",
    ], "relation catalog row");
    if (
      item.kind !== "r" || item.owner !== "postgres" || item.rls !== true ||
      item.force_rls !== false || item.policy_count !== "0" ||
      !["column_count", "constraint_count", "index_count", "trigger_count", "policy_count"]
        .every((name) => typeof item[name] === "string" && DECIMAL.test(item[name]))
    ) refuse("database relation catalog metadata differs");
  }
}

function validateDetailedCatalog(value, expectedCount, keys, label, validateRow) {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    refuse(`database ${label} count differs`);
  }
  let previous = null;
  for (const item of value) {
    exactKeys(item, keys, `${label} row`);
    const ordering = validateRow(item);
    if (typeof ordering !== "string" || (previous !== null && previous >= ordering)) {
      refuse(`database ${label} ordering differs`);
    }
    previous = ordering;
  }
}

function validateColumnCatalog(value) {
  validateDetailedCatalog(value, 57, [
    "relation_name", "column_name", "position", "type", "not_null",
    "default_expression", "identity", "generated",
  ], "column catalog", (item) => {
    if (
      !TABLE_NAMES.includes(item.relation_name) ||
      typeof item.column_name !== "string" || !/^[a-z][a-z0-9_]*$/u.test(item.column_name) ||
      !Number.isSafeInteger(item.position) || item.position < 1 ||
      typeof item.type !== "string" || item.type.length < 1 || item.type.length > 256 ||
      typeof item.not_null !== "boolean" ||
      !(item.default_expression === null ||
        (typeof item.default_expression === "string" && item.default_expression.length <= 2048)) ||
      item.identity !== "" || item.generated !== ""
    ) refuse("database column catalog row differs");
    return `${item.relation_name}\0${String(item.position).padStart(6, "0")}\0${item.column_name}`;
  });
}

function validateConstraintCatalog(value) {
  validateDetailedCatalog(value, 49, [
    "relation_name", "constraint_name", "type", "definition", "deferrable",
    "deferred", "validated",
  ], "constraint catalog", (item) => {
    if (
      !TABLE_NAMES.includes(item.relation_name) ||
      typeof item.constraint_name !== "string" || item.constraint_name.length < 1 ||
      !/^[cfpu]$/u.test(item.type) ||
      typeof item.definition !== "string" || item.definition.length < 1 ||
      item.definition.length > 4096 || typeof item.deferrable !== "boolean" ||
      typeof item.deferred !== "boolean" || item.validated !== true
    ) refuse("database constraint catalog row differs");
    return `${item.relation_name}\0${item.constraint_name}`;
  });
}

function validateIndexCatalog(value) {
  validateDetailedCatalog(value, 20, [
    "relation_name", "index_name", "definition", "unique", "primary", "valid",
    "ready", "live",
  ], "index catalog", (item) => {
    if (
      !TABLE_NAMES.includes(item.relation_name) ||
      typeof item.index_name !== "string" || item.index_name.length < 1 ||
      typeof item.definition !== "string" ||
      !/^CREATE (?:UNIQUE )?INDEX /u.test(item.definition) ||
      item.definition.length > 4096 || typeof item.unique !== "boolean" ||
      typeof item.primary !== "boolean" || item.valid !== true || item.ready !== true ||
      item.live !== true
    ) refuse("database index catalog row differs");
    return `${item.relation_name}\0${item.index_name}`;
  });
}

function validateTriggerCatalog(value) {
  validateDetailedCatalog(value, 4, [
    "relation_name", "trigger_name", "definition", "enabled",
  ], "trigger catalog", (item) => {
    if (
      !TABLE_NAMES.includes(item.relation_name) ||
      typeof item.trigger_name !== "string" || item.trigger_name.length < 1 ||
      typeof item.definition !== "string" ||
      !/^CREATE TRIGGER /u.test(item.definition) || item.definition.length > 4096 ||
      item.enabled !== "O"
    ) refuse("database trigger catalog row differs");
    return `${item.relation_name}\0${item.trigger_name}`;
  });
}

function validateFunctionCatalog(value) {
  if (!Array.isArray(value) || value.length !== FUNCTION_CATALOG.length) {
    refuse("database function catalog count differs");
  }
  for (let index = 0; index < FUNCTION_CATALOG.length; index += 1) {
    const actual = value[index];
    const expected = FUNCTION_CATALOG[index];
    exactKeys(actual, [
      "name", "identity_arguments", "result_type", "volatility",
      "security_definer", "argument_defaults", "body_md5", "function_kind",
      "strict", "parallel_mode", "leakproof", "config", "owner", "language",
    ], "function catalog row");
    if (
      actual.name !== expected[0] || actual.identity_arguments !== expected[1] ||
      actual.result_type !== expected[2] || actual.volatility !== expected[3] ||
      actual.security_definer !== expected[4] || actual.argument_defaults !== expected[5] ||
      actual.body_md5 !== expected[6] || actual.function_kind !== "f" ||
      actual.strict !== false || actual.parallel_mode !== "u" ||
      actual.leakproof !== false ||
      mainFinanceRuntimeRecoveryV2CanonicalJson(actual.config) !==
        mainFinanceRuntimeRecoveryV2CanonicalJson(["search_path=pg_catalog, public"]) ||
      actual.owner !== "postgres" || actual.language !== "plpgsql"
    ) refuse(`database function catalog differs for ${expected[0]}`);
  }
}

function validateTableAcl(value) {
  const expected = [];
  for (const relationName of TABLE_NAMES) {
    for (const privilege of ["INSERT", "SELECT", "UPDATE"]) {
      expected.push({
        relation_name: relationName,
        grantee: "postgres",
        grantor: "postgres",
        privilege,
        grantable: false,
      });
    }
  }
  expected.sort((left, right) =>
    left.relation_name.localeCompare(right.relation_name) ||
    left.privilege.localeCompare(right.privilege));
  if (mainFinanceRuntimeRecoveryV2CanonicalJson(value) !==
    mainFinanceRuntimeRecoveryV2CanonicalJson(expected)) {
    refuse("database exact owner-only table ACL differs");
  }
}

function validateFunctionAcl(value) {
  const expected = FUNCTION_EXECUTE_ACL.map((item) => ({
    name: item[0],
    identity_arguments: item[1],
    grantee: item[2],
    grantor: "postgres",
    privilege: "EXECUTE",
    grantable: false,
  })).sort((left, right) =>
    left.name.localeCompare(right.name) ||
    left.identity_arguments.localeCompare(right.identity_arguments) ||
    left.grantee.localeCompare(right.grantee));
  if (mainFinanceRuntimeRecoveryV2CanonicalJson(value) !==
    mainFinanceRuntimeRecoveryV2CanonicalJson(expected)) {
    refuse("database exact service function ACL differs");
  }
}

function validateSnapshotRows(rows, allowNonterminal = false) {
  if (!Array.isArray(rows) || rows.length === 0) {
    refuse("database snapshot must contain at least one desired row");
  }
  const identities = new Set();
  const events = new Set();
  return Object.freeze(rows.map((row, index) => {
    exactKeys(row, [
      "main_user_id", "event_id", "desired_state", "version", "applied_state",
      "applied_version", "event_state", "changed_by", "change_reason",
    ], "database desired snapshot row");
    if (
      !UUID_V4.test(row.main_user_id) || !UUID_V4.test(row.event_id) ||
      !["granted", "revoked"].includes(row.desired_state) ||
      !DECIMAL.test(row.version) || row.version === "0" ||
      ![null, "granted", "revoked"].includes(row.applied_state) ||
      !DECIMAL.test(row.applied_version) ||
      BigInt(row.applied_version) > BigInt(row.version) ||
      (row.applied_version === "0") !== (row.applied_state === null) ||
      !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(
        row.event_state,
      ) ||
      (!allowNonterminal && (
        row.applied_state !== row.desired_state || row.applied_version !== row.version ||
        row.event_state !== "applied"
      )) || typeof row.changed_by !== "string" ||
      !/^[a-z][a-z0-9_.:-]{2,127}$/u.test(row.changed_by) ||
      typeof row.change_reason !== "string" || row.change_reason !== row.change_reason.trim() ||
      row.change_reason.length < 1 || row.change_reason.length > 500 ||
      /[\u0000-\u001f\u007f]/u.test(row.change_reason) ||
      identities.has(row.main_user_id) || events.has(row.event_id) ||
      (index > 0 && rows[index - 1].main_user_id >= row.main_user_id)
    ) refuse("database desired snapshot row differs");
    identities.add(row.main_user_id);
    events.add(row.event_id);
    return Object.freeze({ ...row });
  }));
}

function validateReconcileContext(value) {
  exactKeys(value, [
    "action", "original_plan_sha256", "main_user_id", "event_id",
    "current_event_id", "expected_version", "changed_by", "original_rows",
  ], "reconcile context");
  const firstGrant = value.action === "grant" && value.expected_version === "0" &&
    value.current_event_id === null;
  if (
    !["grant", "revoke"].includes(value.action) ||
    !SHA256.test(value.original_plan_sha256 ?? "") ||
    !UUID_V4.test(value.main_user_id ?? "") || !UUID_V4.test(value.event_id ?? "") ||
    !(firstGrant || UUID_V4.test(value.current_event_id ?? "")) ||
    !DECIMAL.test(value.expected_version ?? "") ||
    typeof value.changed_by !== "string" ||
    !/^[a-z][a-z0-9_.:-]{2,127}$/u.test(value.changed_by)
  ) refuse("reconcile context differs");
  const originalRows = validateSnapshotRows(value.original_rows);
  const originalTarget = originalRows.find((row) => row.main_user_id === value.main_user_id);
  if (
    (firstGrant && originalTarget !== undefined) ||
    (!firstGrant && (
      originalTarget === undefined || originalTarget.event_id !== value.current_event_id ||
      originalTarget.version !== value.expected_version
    )) || originalRows.some((row) => row.event_id === value.event_id)
  ) refuse("reconcile original target OCC differs");
  return Object.freeze({
    ...value,
    original_rows: originalRows,
    firstGrant,
    desiredState: value.action === "grant" ? "granted" : "revoked",
    changeReason: `main_finance_runtime_recovery_v2_plan:${value.original_plan_sha256}`,
  });
}

function classifyReconcileRows(rows, context) {
  if (mainFinanceRuntimeRecoveryV2CanonicalJson(rows) ===
    mainFinanceRuntimeRecoveryV2CanonicalJson(context.original_rows)) {
    return Object.freeze({ disposition: "absent", target: null });
  }
  const originalByIdentity = new Map(
    context.original_rows.map((row) => [row.main_user_id, row]),
  );
  const target = rows.find((row) => row.main_user_id === context.main_user_id);
  if (target === undefined) {
    refuse("reconcile target row is absent after unrelated drift");
  }
  if (
    target.event_id !== context.event_id ||
    target.version !== (BigInt(context.expected_version) + 1n).toString() ||
    target.desired_state !== context.desiredState || target.changed_by !== context.changed_by ||
    target.change_reason !== context.changeReason
  ) refuse("reconcile target successor differs");
  for (const row of rows) {
    if (row.main_user_id === context.main_user_id) continue;
    const original = originalByIdentity.get(row.main_user_id);
    if (!original || mainFinanceRuntimeRecoveryV2CanonicalJson(row) !==
      mainFinanceRuntimeRecoveryV2CanonicalJson(original)) {
      refuse("reconcile non-target row drifted");
    }
  }
  const expectedCount = context.original_rows.length + (context.firstGrant ? 1 : 0);
  if (rows.length !== expectedCount) refuse("reconcile row cardinality differs");
  if (
    target.event_state === "applied" && target.applied_version === target.version &&
    target.applied_state === target.desired_state
  ) return Object.freeze({ disposition: "applied", target });
  if (target.event_state === "processing") {
    return Object.freeze({ disposition: "wait", target });
  }
  if (["pending", "retry_wait", "dead_letter"].includes(target.event_state)) {
    return Object.freeze({ disposition: "nonterminal", target });
  }
  refuse("reconcile target state differs");
}

function validateDatabasePreflight(result, expectedCatalogSha256, reconcileContext = null) {
  const row = result.rows[0];
  exactKeys(row, [
    "database_clock", "database_role", "server_version_num", "migration_catalog",
    "relation_catalog", "column_catalog", "constraint_catalog", "index_catalog",
    "trigger_catalog", "policy_catalog", "function_catalog", "table_acl",
    "function_acl", "service_role_schema_usage", "column_count", "constraint_count",
    "index_count", "trigger_count", "policy_count", "column_acl_count",
    "desired_count", "current_row_count", "current_invalid_count",
    "entitlement_invalid_count", "entitlement_count", "entitlement_extra_count",
    "version_invalid_count", "nonterminal_outbox_count", "active_issue_count",
    "active_replay_count", "rows",
  ], "database preflight row");
  if (
    !canonicalTimestamp(row.database_clock) ||
    row.database_role !== "supabase_read_only_user" ||
    row.server_version_num !== "170006" || row.service_role_schema_usage !== true
  ) refuse("database identity or clock differs");
  validateMigrationCatalog(row.migration_catalog);
  validateRelationCatalog(row.relation_catalog);
  validateColumnCatalog(row.column_catalog);
  validateConstraintCatalog(row.constraint_catalog);
  validateIndexCatalog(row.index_catalog);
  validateTriggerCatalog(row.trigger_catalog);
  if (!Array.isArray(row.policy_catalog) || row.policy_catalog.length !== 0) {
    refuse("database policy catalog differs");
  }
  validateFunctionCatalog(row.function_catalog);
  validateTableAcl(row.table_acl);
  validateFunctionAcl(row.function_acl);
  countField(row, "column_count", 57);
  countField(row, "constraint_count", 49);
  countField(row, "index_count", 20);
  countField(row, "trigger_count", 4);
  countField(row, "policy_count", 0);
  countField(row, "column_acl_count", 0);
  const desiredCount = countField(row, "desired_count");
  const currentCount = countField(row, "current_row_count");
  const entitlementCount = countField(row, "entitlement_count");
  const rows = validateSnapshotRows(row.rows, reconcileContext !== null);
  if (rows.length !== desiredCount) refuse("database desired row coverage differs");
  let reconcile = null;
  if (reconcileContext === null) {
    if (
      desiredCount <= 0 || currentCount !== desiredCount ||
      entitlementCount !== desiredCount
    ) refuse("database desired/current/entitlement count differs");
    for (const name of [
      "current_invalid_count", "entitlement_invalid_count", "entitlement_extra_count",
      "version_invalid_count", "nonterminal_outbox_count", "active_issue_count",
      "active_replay_count",
    ]) countField(row, name, 0);
  } else {
    reconcile = classifyReconcileRows(rows, reconcileContext);
    if (desiredCount <= 0 || currentCount !== desiredCount) {
      refuse("reconcile database desired/current count differs");
    }
    for (const name of [
      "entitlement_extra_count", "version_invalid_count", "active_issue_count",
      "active_replay_count",
    ]) countField(row, name, 0);
    const terminal = ["absent", "applied"].includes(reconcile.disposition);
    countField(row, "current_invalid_count", terminal ? 0 : 1);
    countField(row, "nonterminal_outbox_count", terminal ? 0 : 1);
    const entitlementInvalid = countField(row, "entitlement_invalid_count");
    if (terminal && entitlementInvalid !== 0) {
      refuse("reconcile terminal entitlement state differs");
    }
    if (terminal && entitlementCount !== desiredCount) {
      refuse("reconcile terminal entitlement count differs");
    }
    if (!terminal && ![0, 1].includes(entitlementInvalid)) {
      refuse("reconcile target entitlement invalid count differs");
    }
    const minimumEntitlements = desiredCount - (reconcileContext.firstGrant ? 1 : 0);
    if (entitlementCount < minimumEntitlements || entitlementCount > desiredCount) {
      refuse("reconcile target entitlement count differs");
    }
  }
  const catalog = Object.freeze({
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
  });
  const catalogSha256 = mainFinanceRuntimeRecoveryV2Sha256(
    mainFinanceRuntimeRecoveryV2CanonicalJson(catalog),
  );
  if (
    expectedCatalogSha256 !== null
    && (!SHA256.test(expectedCatalogSha256) || catalogSha256 !== expectedCatalogSha256)
  ) {
    refuse("database catalog fingerprint differs from the reviewed release pin");
  }
  return Object.freeze({
    databaseClock: row.database_clock,
    responseSha256: result.responseSha256,
    catalogSha256,
    stateSha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(rows),
    ),
    checkedCount: rows.length,
    rows,
    reconcile,
    counts: Object.freeze({
      columns: 57,
      constraints: 49,
      indexes: 20,
      triggers: 4,
      policies: 0,
      desired: desiredCount,
      entitlements: entitlementCount,
    }),
  });
}

export async function measureMainFinanceRuntimeRecoveryCatalog({
  accessToken,
  fetchImpl,
  preflightSql,
  preflightSqlSha256,
  now,
}) {
  if (
    typeof preflightSql !== "string" || preflightSql.length < 1 ||
    mainFinanceRuntimeRecoveryV2Sha256(preflightSql) !== preflightSqlSha256 ||
    typeof now !== "function"
  ) refuse("catalog measurement source contract differs");
  const queried = await managementQuery({ accessToken, fetchImpl, preflightSql });
  const database = validateDatabasePreflight(queried, null);
  const current = now();
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())) {
    refuse("catalog measurement operator clock differs");
  }
  const clock = Date.parse(database.databaseClock);
  if (current.getTime() - clock > 300_000 || clock - current.getTime() > 30_000) {
    refuse("catalog measurement is stale or future-dated");
  }
  return Object.freeze({
    schemaVersion: 2,
    kind: "main-finance-runtime-recovery-v2-catalog-measurement",
    environment: "staging",
    databaseClock: database.databaseClock,
    preflightSqlSha256,
    responseSha256: database.responseSha256,
    catalogSha256: database.catalogSha256,
    counts: database.counts,
  });
}

export async function buildMainFinanceRuntimeRecoverySnapshot({
  phase,
  accessToken,
  fetchImpl,
  preflightSql,
  preflightSqlSha256,
  expectedCatalogSha256,
  releaseManifestSha256,
  sourceDeploymentSha256,
  sourceCommitSha,
  sourceTreeSha,
  mainSecretInventoryRows,
  financeSecretInventoryRows,
  reconcileContext = null,
  now,
}) {
  if (
    typeof preflightSql !== "string" || preflightSql.length < 1 ||
    mainFinanceRuntimeRecoveryV2Sha256(preflightSql) !== preflightSqlSha256 ||
    !SHA256.test(expectedCatalogSha256 ?? "") ||
    !SHA256.test(releaseManifestSha256 ?? "") ||
    !SHA256.test(sourceDeploymentSha256 ?? "") ||
    !GIT_OID.test(sourceCommitSha ?? "") || !GIT_OID.test(sourceTreeSha ?? "") ||
    typeof now !== "function"
  ) refuse("snapshot source contract differs");
  if ((phase === "reconcile") !== (reconcileContext !== null)) {
    refuse("reconcile snapshot context/phase differs");
  }
  const normalizedReconcileContext = reconcileContext === null
    ? null
    : validateReconcileContext(reconcileContext);
  const reconcileContextSha256 = reconcileContext === null ? null :
    mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(reconcileContext),
    );
  const inventories = buildMainFinanceRuntimeRecoveryInventoryEvidence({
    phase,
    mainSecretInventoryRows,
    financeSecretInventoryRows,
  });
  const queried = await managementQuery({ accessToken, fetchImpl, preflightSql });
  const database = validateDatabasePreflight(
    queried,
    expectedCatalogSha256,
    normalizedReconcileContext,
  );
  const current = now();
  if (!(current instanceof Date) || !Number.isFinite(current.getTime())) {
    refuse("operator clock differs");
  }
  const clock = Date.parse(database.databaseClock);
  if (current.getTime() - clock > 300_000 || clock - current.getTime() > 30_000) {
    refuse("database snapshot is stale or future-dated");
  }
  const descriptorCore = {
    main_source_commit_sha: sourceCommitSha,
    main_source_tree_sha: sourceTreeSha,
    source_manifest_sha256: releaseManifestSha256,
    catalog_sha256: database.catalogSha256,
    gate_inventory_sha256: inventories.gateInventorySha256,
    privacy_secret_inventory_sha256: inventories.privacyInventorySha256,
    checked_count: database.checkedCount,
    rows: database.rows,
  };
  const snapshot = Object.freeze({
    schema_version: 2,
    main_source_commit_sha: sourceCommitSha,
    main_source_tree_sha: sourceTreeSha,
    source_manifest_sha256: releaseManifestSha256,
    database_clock: database.databaseClock,
    sql_sha256: preflightSqlSha256,
    response_sha256: database.responseSha256,
    descriptor_sha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(descriptorCore),
    ),
    state_sha256: database.stateSha256,
    catalog_sha256: database.catalogSha256,
    gate_inventory_sha256: inventories.gateInventorySha256,
    privacy_secret_inventory_sha256: inventories.privacyInventorySha256,
    checked_count: database.checkedCount,
    rows: database.rows,
    source_deployment_sha256: sourceDeploymentSha256,
  });
  BUILT_SNAPSHOTS.set(snapshot, Object.freeze({
    phase,
    reconcileDisposition: database.reconcile?.disposition ?? null,
    reconcileContextSha256,
    sha256: mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(snapshot),
    ),
  }));
  return snapshot;
}

export function classifyMainFinanceRuntimeRecoveryReconcileSnapshot({ snapshot, reconcileContext }) {
  const binding = BUILT_SNAPSHOTS.get(snapshot);
  const contextSha256 = mainFinanceRuntimeRecoveryV2Sha256(
    mainFinanceRuntimeRecoveryV2CanonicalJson(reconcileContext),
  );
  if (
    binding?.phase !== "reconcile" || binding.reconcileContextSha256 !== contextSha256 ||
    !["absent", "applied", "nonterminal", "wait"].includes(
      binding.reconcileDisposition,
    ) || binding.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(snapshot),
    )
  ) refuse("reconcile snapshot classification binding differs");
  return binding.reconcileDisposition;
}

export function buildMainFinanceRuntimeRecoveryAttestRequest(snapshot) {
  const { source_deployment_sha256: sourceDeploymentSha256, ...snapshotBody } = snapshot;
  const binding = BUILT_SNAPSHOTS.get(snapshot);
  if (binding?.phase === "reconcile") {
    refuse("reconcile snapshot cannot authorize global attestation");
  }
  if (
    !SHA256.test(sourceDeploymentSha256 ?? "")
    || binding?.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(snapshot),
    )
  ) {
    refuse("snapshot source deployment hash differs");
  }
  return Object.freeze({
    schema_version: 2,
    action: "attest",
    main_project_ref: MAIN_FINANCE_RUNTIME_RECOVERY_V2_MAIN_REF,
    finance_project_ref: MAIN_FINANCE_RUNTIME_RECOVERY_V2_FINANCE_REF,
    production_deny_project_refs: MAIN_FINANCE_RUNTIME_RECOVERY_V2_PRODUCTION_DENY_REFS,
    source_deployment_sha256: sourceDeploymentSha256,
    snapshot: snapshotBody,
    command: null,
  });
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

export function verifyMainFinanceRuntimeRecoveryAttestResponse({
  d0,
  sourceDeploymentSha256,
  operatorSecret,
  responseSource,
  now,
}) {
  const snapshotBinding = BUILT_SNAPSHOTS.get(d0);
  if (snapshotBinding?.phase === "reconcile") {
    refuse("reconcile snapshot cannot produce a global attestation proof");
  }
  if (
    d0?.source_deployment_sha256 !== sourceDeploymentSha256 ||
    snapshotBinding?.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
    ) ||
    !SHA256.test(sourceDeploymentSha256 ?? "") ||
    typeof operatorSecret !== "string" || !OPERATOR_SECRET.test(operatorSecret) ||
    typeof responseSource !== "string" || responseSource.length < 2 ||
    Buffer.byteLength(responseSource, "utf8") > 64 * 1024 ||
    typeof now !== "function"
  ) refuse("Edge attestation verification input differs");
  let value;
  try {
    value = JSON.parse(responseSource);
  } catch {
    refuse("Edge attestation response JSON differs");
  }
  exactKeys(value, [
    "ok", "action", "provided_descriptor_replayed", "database_clock",
    "checked_count", "mismatch_count", "state_sha256", "attested_at",
    "attestation_proof",
  ], "Edge attestation response");
  const proofMatch = /^([1-9][0-9]{12})\.([0-9a-f]{64})$/u.exec(
    value.attestation_proof ?? "",
  );
  const current = now();
  const currentMs = current instanceof Date ? current.getTime() : Number.NaN;
  if (
    value.ok !== true || value.action !== "attest" ||
    value.provided_descriptor_replayed !== true ||
    value.database_clock !== d0.database_clock ||
    value.checked_count !== d0.checked_count || value.mismatch_count !== 0 ||
    value.state_sha256 !== d0.state_sha256 ||
    !canonicalTimestamp(value.attested_at) || !proofMatch ||
    !Number.isFinite(currentMs)
  ) refuse("Edge attestation response contract differs");
  const proofTimestamp = Number(proofMatch[1]);
  if (
    !Number.isSafeInteger(proofTimestamp) ||
    Date.parse(value.attested_at) !== proofTimestamp ||
    Date.parse(d0.database_clock) >= proofTimestamp ||
    currentMs - proofTimestamp > 300_000 || proofTimestamp - currentMs > 30_000
  ) refuse("Edge attestation proof clock differs");
  const expected = createHmac("sha256", operatorSecret).update(
    attestationProofMessage(sourceDeploymentSha256, d0, proofTimestamp),
    "utf8",
  ).digest();
  const actual = Buffer.from(proofMatch[2], "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    refuse("Edge attestation proof authentication differs");
  }
  const proof = Object.freeze({
    schemaVersion: 2,
    kind: "main-finance-runtime-recovery-v2-verified-attestation-proof",
    attestedAt: value.attested_at,
    checkedCount: value.checked_count,
    mismatchCount: 0,
    stateSha256: value.state_sha256,
    responseSha256: mainFinanceRuntimeRecoveryV2Sha256(responseSource),
    proofSha256: mainFinanceRuntimeRecoveryV2Sha256(value.attestation_proof),
  });
  VERIFIED_ATTESTATION_PROOFS.set(
    proof,
    Object.freeze({
      d0Sha256: mainFinanceRuntimeRecoveryV2Sha256(
        mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
      ),
      attestationProof: value.attestation_proof,
    }),
  );
  return proof;
}

export function extractMainFinanceRuntimeRecoveryVerifiedAttestationProof({ proof, d0 }) {
  const binding = VERIFIED_ATTESTATION_PROOFS.get(proof);
  const snapshotBinding = BUILT_SNAPSHOTS.get(d0);
  if (
    snapshotBinding?.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
    )
    ||
    binding?.d0Sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
    )
    || mainFinanceRuntimeRecoveryV2Sha256(binding?.attestationProof ?? "")
      !== proof?.proofSha256
  ) refuse("verified attestation proof extraction binding differs");
  return binding.attestationProof;
}

export function validateMainFinanceRuntimeRecoverySnapshotSandwich({ d0, proof, d1 }) {
  const d0Binding = BUILT_SNAPSHOTS.get(d0);
  const d1Binding = BUILT_SNAPSHOTS.get(d1);
  const proofBinding = VERIFIED_ATTESTATION_PROOFS.get(proof);
  if (
    !proof ||
    d0Binding?.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
    ) ||
    d1Binding?.sha256 !== mainFinanceRuntimeRecoveryV2Sha256(
      mainFinanceRuntimeRecoveryV2CanonicalJson(d1),
    ) ||
    d0Binding.phase !== d1Binding.phase ||
    proofBinding?.d0Sha256 !==
      mainFinanceRuntimeRecoveryV2Sha256(
        mainFinanceRuntimeRecoveryV2CanonicalJson(d0),
      ) ||
    proof.stateSha256 !== d0?.state_sha256 ||
    proof.checkedCount !== d0?.checked_count ||
    proof.mismatchCount !== 0 ||
    mainFinanceRuntimeRecoveryV2Sha256(proofBinding?.attestationProof ?? "")
      !== proof.proofSha256 ||
    !canonicalTimestamp(proof.attestedAt) ||
    !canonicalTimestamp(d0?.database_clock) || !canonicalTimestamp(d1?.database_clock)
  ) return false;
  const stable = (snapshot) => ({
    schema_version: snapshot.schema_version,
    main_source_commit_sha: snapshot.main_source_commit_sha,
    main_source_tree_sha: snapshot.main_source_tree_sha,
    source_manifest_sha256: snapshot.source_manifest_sha256,
    sql_sha256: snapshot.sql_sha256,
    descriptor_sha256: snapshot.descriptor_sha256,
    state_sha256: snapshot.state_sha256,
    catalog_sha256: snapshot.catalog_sha256,
    gate_inventory_sha256: snapshot.gate_inventory_sha256,
    privacy_secret_inventory_sha256: snapshot.privacy_secret_inventory_sha256,
    checked_count: snapshot.checked_count,
    rows: snapshot.rows,
    source_deployment_sha256: snapshot.source_deployment_sha256,
  });
  return mainFinanceRuntimeRecoveryV2CanonicalJson(stable(d0)) ===
      mainFinanceRuntimeRecoveryV2CanonicalJson(stable(d1)) &&
    Date.parse(d0.database_clock) < Date.parse(proof.attestedAt) &&
    Date.parse(proof.attestedAt) < Date.parse(d1.database_clock) &&
    d0.response_sha256 !== d1.response_sha256;
}
