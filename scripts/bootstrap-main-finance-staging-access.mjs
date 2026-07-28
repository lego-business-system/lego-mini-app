#!/usr/bin/env node

import {
  createHash,
  randomBytes,
} from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const MANAGEMENT_API_ORIGIN = "https://api.supabase.com";
const READ_ONLY_QUERY_SUFFIX = "/database/query/read-only";
const API_KEYS_SUFFIX = "/api-keys?reveal=true";
const SECRETS_SUFFIX = "/secrets";
const REQUEST_TIMEOUT_MS = 30_000;
const MAXIMUM_RESPONSE_BYTES = 256 * 1_024;
const ACCESS_TOKEN = /^[A-Za-z0-9._-]{20,4096}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const GENERATED_SECRET = /^[A-Za-z0-9_-]{64}$/u;
const CANONICAL_TIMESTAMP =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$/u;
const EXPECTED_DATABASE_ROLE = "supabase_read_only_user";
const EXPECTED_SERVER_VERSION_NUM = "170006";
const DISABLED_SHA256 = sha256("disabled");
const RUNTIME_FILE = "main-finance-staging-runtime.env";
const ATTESTATION_FILE = "main-finance-staging-runtime.attestation.json";
const INSTALL_CONFIRMATION =
  "INSTALL MAIN FINANCE E2E SECRETS TO DATALESS STAGING ONLY";
const INSTALL_OPERATION = "install-main-finance-staging-e2e-secrets";
const RECONCILIATION_OPERATION =
  "reconcile-main-finance-staging-e2e-secret-install";

export const MAIN_FINANCE_BOOTSTRAP_BOUNDARY = Object.freeze({
  mainStagingProjectRef: "bljeoovhydhjhdzwplxh",
  financeStagingProjectRef: "makgsbjduobcphuqzaoq",
  productionDenyProjectRefs: Object.freeze([
    "soxtekhspohkddpdidvp",
    "koibxwgtihwajocxfetb",
  ]),
});

const MAIN_SUBJECT_TABLES = Object.freeze([
  "architecture_product_entitlements",
  "architecture_finance_issue_requests",
  "architecture_finance_issue_replay_guard",
  "architecture_finance_access_desired",
  "architecture_finance_access_outbox",
]);

const FINANCE_SUBJECT_TABLES = Object.freeze([
  "finance_profiles",
  "finance_entitlements",
  "finance_connected_devices",
  "finance_device_codes",
  "finance_device_codes_v2",
  "finance_device_code_issuer_requests",
  "finance_device_code_attempts",
  "finance_device_code_revocation_requests",
  "finance_entitlement_integration_events_v1",
  "finance_entitlement_integration_state_v1",
  "finance_entitlement_subject_events_v2",
  "finance_entitlement_subject_bindings_v2",
  "finance_entitlement_rebind_authorizations_v2",
  "finance_entitlement_apply_authorizations_v2",
]);

const GATES = Object.freeze([
  Object.freeze({
    projectRef: MAIN_FINANCE_BOOTSTRAP_BOUNDARY.financeStagingProjectRef,
    name: "FINANCE_ENTITLEMENT_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_BOOTSTRAP_BOUNDARY.mainStagingProjectRef,
    name: "MAIN_FINANCE_SYNC_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_BOOTSTRAP_BOUNDARY.financeStagingProjectRef,
    name: "FINANCE_TELEGRAM_PROTOCOL_MODE",
  }),
  Object.freeze({
    projectRef: MAIN_FINANCE_BOOTSTRAP_BOUNDARY.mainStagingProjectRef,
    name: "MAIN_FINANCE_PROTOCOL_MODE",
  }),
]);

const ROTATED_SECRET_NAMES = Object.freeze([
  "MAIN_FINANCE_PRIVACY_HMAC_KEY",
  "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
]);

function countSelect(table) {
  return `  (SELECT pg_catalog.count(*)::text FROM public.${table}) AS ${table}_count`;
}

export const MAIN_ROTATION_PREFLIGHT_SQL = `SELECT
  current_user::text AS database_role,
  pg_catalog.current_setting('server_version_num')::text AS server_version_num,
  (SELECT pg_catalog.count(*)::text FROM auth.users) AS auth_users_count,
  (SELECT pg_catalog.count(*)::text FROM public.users) AS pilot_users_count,
${MAIN_SUBJECT_TABLES.map(countSelect).join(",\n")}`;

export const FINANCE_ROTATION_PREFLIGHT_SQL = `SELECT
  current_user::text AS database_role,
  pg_catalog.current_setting('server_version_num')::text AS server_version_num,
  (SELECT pg_catalog.count(*)::text FROM auth.users) AS auth_users_count,
${FINANCE_SUBJECT_TABLES.map(countSelect).join(",\n")},
  (
    SELECT pg_catalog.count(*)::text
    FROM public.finance_entitlement_subject_cutover_v2
  ) AS finance_entitlement_subject_cutover_v2_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM public.finance_entitlement_subject_cutover_v2 AS cutover
    WHERE cutover.product_code IS DISTINCT FROM 'architecture_finance'
       OR cutover.state IS DISTINCT FROM 'preparing'
       OR cutover.ready_at IS NOT NULL
       OR cutover.finalized_by IS NOT NULL
       OR cutover.finalize_reason IS NOT NULL
  ) AS finance_entitlement_subject_cutover_v2_invalid_count`;

export const MAIN_ROTATION_PREFLIGHT_SQL_SHA256 =
  "fade2cb92c6fcf8d19e9e9bdf6851d02652d365b171d571f668e5f8c4dbcf069";
export const FINANCE_ROTATION_PREFLIGHT_SQL_SHA256 =
  "05a1f9d4f79ccd3e6d578a446391f4139bf5696b4846cd5b6774a4b7cae25254";

function fail(message) {
  throw new Error(`Main Finance staging access bootstrap refused: ${message}`);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
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
  ) fail(`${label} keys differ`);
}

function assertPinnedSql() {
  if (
    sha256(MAIN_ROTATION_PREFLIGHT_SQL)
      !== MAIN_ROTATION_PREFLIGHT_SQL_SHA256
    || sha256(FINANCE_ROTATION_PREFLIGHT_SQL)
      !== FINANCE_ROTATION_PREFLIGHT_SQL_SHA256
    || /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE)\b/iu
      .test(MAIN_ROTATION_PREFLIGHT_SQL)
    || /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE|ALTER|DROP|CREATE)\b/iu
      .test(FINANCE_ROTATION_PREFLIGHT_SQL)
  ) fail("pinned read-only preflight SQL bytes differ");
}

function assertBoundary(mainProjectRef, financeProjectRef) {
  for (const projectRef of [mainProjectRef, financeProjectRef]) {
    if (MAIN_FINANCE_BOOTSTRAP_BOUNDARY.productionDenyProjectRefs.includes(
      projectRef,
    )) fail("a target is an exact production project ref");
  }
  if (
    mainProjectRef
      !== MAIN_FINANCE_BOOTSTRAP_BOUNDARY.mainStagingProjectRef
    || financeProjectRef
      !== MAIN_FINANCE_BOOTSTRAP_BOUNDARY.financeStagingProjectRef
  ) fail("targets are not the exact reviewed Main and Finance staging refs");
  if (mainProjectRef === financeProjectRef) {
    fail("Main and Finance staging refs must remain different");
  }
}

function isOutsideRepository(item) {
  const relative = path.relative(REPOSITORY_ROOT, item);
  return (
    relative !== ""
    && (relative.startsWith(`..${path.sep}`) || relative === "..")
  );
}

function assertAbsoluteNormalized(item, label) {
  if (
    typeof item !== "string"
    || !path.isAbsolute(item)
    || path.resolve(item) !== item
  ) fail(`${label} must be absolute and normalized`);
}

function assertPrivateDirectory(directory, label) {
  assertAbsoluteNormalized(directory, label);
  let status;
  try {
    status = lstatSync(directory);
  } catch {
    fail(`${label} is unavailable`);
  }
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || (status.mode & 0o777) !== 0o700
    || realpathSync(directory) !== directory
    || !isOutsideRepository(directory)
  ) fail(`${label} must be a real owner-private mode 0700 directory outside the repository`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    fail(`${label} must be owned by the current user`);
  }
  return directory;
}

function createPrivateOutputDirectory(directory) {
  assertAbsoluteNormalized(directory, "output directory");
  if (!isOutsideRepository(directory)) {
    fail("output directory must stay outside the repository");
  }
  const parent = path.dirname(directory);
  let parentStatus;
  try {
    parentStatus = lstatSync(parent);
  } catch {
    fail("output directory parent is unavailable");
  }
  if (
    !parentStatus.isDirectory()
    || parentStatus.isSymbolicLink()
    || realpathSync(parent) !== parent
  ) fail("output directory parent must be one real directory");
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch {
    fail("output directory must not already exist");
  }
  return assertPrivateDirectory(directory, "output directory");
}

function readPrivateFile(file, label, maximumBytes) {
  assertAbsoluteNormalized(file, `${label} path`);
  assertPrivateDirectory(path.dirname(file), `${label} parent directory`);
  let status;
  try {
    status = lstatSync(file);
  } catch {
    fail(`${label} is unavailable`);
  }
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || status.size < 1
    || status.size > maximumBytes
    || realpathSync(file) !== file
  ) fail(`${label} must be one owner-private mode 0600 file`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    fail(`${label} must be owned by the current user`);
  }
  let descriptor;
  try {
    descriptor = openSync(
      file,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile()
      || opened.nlink !== 1
      || opened.ino !== status.ino
      || opened.dev !== status.dev
      || (opened.mode & 0o777) !== 0o600
    ) fail(`${label} changed while opening`);
    return readFileSync(descriptor, "utf8");
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Main Finance staging access bootstrap refused:")
    ) throw error;
    fail(`${label} could not be read`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readAccessToken(file) {
  const source = readPrivateFile(file, "Management access token", 4_097);
  const token = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (
    !ACCESS_TOKEN.test(token)
    || token.includes("\n")
    || token.includes("\r")
  ) fail("Management access token format differs");
  return token;
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
    if (
      !status.isFile()
      || status.nlink !== 1
      || (status.mode & 0o777) !== 0o600
    ) fail("private file write boundary differs");
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Main Finance staging access bootstrap refused:")
    ) throw error;
    fail("private file could not be written");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function canonicalTimestamp(now) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) fail("operator clock differs");
  return date.toISOString();
}

async function boundedBody(response) {
  if (!response?.body || typeof response.body[Symbol.asyncIterator] !== "function") {
    fail("Management API response body differs");
  }
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > MAXIMUM_RESPONSE_BYTES) {
        try {
          await response.body.cancel();
        } catch {
          // The size refusal remains authoritative.
        }
        fail("Management API response exceeded the byte limit");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Main Finance staging access bootstrap refused:")
    ) throw error;
    fail("Management API response read failed");
  }
  const bytes = Buffer.concat(chunks.map(chunk =>
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (source.includes("\0")) fail("Management API response encoding differs");
    return source;
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Main Finance staging access bootstrap refused:")
    ) throw error;
    fail("Management API response encoding differs");
  }
}

async function managementJson({
  accessToken,
  fetchImpl,
  method,
  url,
  expectedStatus,
  body = null,
  operation,
}) {
  if (!ACCESS_TOKEN.test(accessToken)) {
    fail("Management access token format differs");
  }
  if (typeof fetchImpl !== "function") fail("Management fetch dependency differs");
  if (
    !url.startsWith(`${MANAGEMENT_API_ORIGIN}/v1/projects/`)
    || url.includes("@")
    || url.includes("#")
  ) fail("Management API URL differs");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("request timeout", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(body === null ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === null ? {} : { body }),
    });
  } catch {
    fail(`Management API ${operation} request failed`);
  } finally {
    clearTimeout(timeout);
  }
  const contentType = response?.headers?.get?.("content-type")?.toLowerCase()
    ?? "";
  if (
    response?.status !== expectedStatus
    || response.redirected !== false
    || ![
      "application/json",
      "application/json; charset=utf-8",
    ].includes(contentType)
  ) fail(`Management API ${operation} response boundary differs`);
  let parsed;
  try {
    parsed = JSON.parse(await boundedBody(response));
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Main Finance staging access bootstrap refused:")
    ) throw error;
    fail(`Management API ${operation} response JSON differs`);
  }
  return parsed;
}

async function readOnlyPreflight({
  projectRef,
  sql,
  accessToken,
  fetchImpl,
  operation,
}) {
  assertPinnedSql();
  const expectedSql = projectRef
      === MAIN_FINANCE_BOOTSTRAP_BOUNDARY.mainStagingProjectRef
    ? MAIN_ROTATION_PREFLIGHT_SQL
    : FINANCE_ROTATION_PREFLIGHT_SQL;
  if (sql !== expectedSql) fail("read-only preflight SQL differs");
  return managementJson({
    accessToken,
    fetchImpl,
    method: "POST",
    url: `${MANAGEMENT_API_ORIGIN}/v1/projects/${projectRef}${READ_ONLY_QUERY_SUFFIX}`,
    expectedStatus: 201,
    body: canonicalJson({ query: sql }),
    operation,
  });
}

function decimal(value, label) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    fail(`${label} differs`);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) fail(`${label} exceeds the safe range`);
  return count;
}

function validatePreflightRows(rows, kind) {
  if (
    !Array.isArray(rows)
    || rows.length !== 1
    || rows[0] === null
    || typeof rows[0] !== "object"
    || Array.isArray(rows[0])
  ) fail(`${kind} rotation preflight must return exactly one row`);
  const tables = kind === "Main" ? MAIN_SUBJECT_TABLES : FINANCE_SUBJECT_TABLES;
  const expected = [
    "database_role",
    "server_version_num",
    "auth_users_count",
    ...(kind === "Main" ? ["pilot_users_count"] : []),
    ...tables.map(table => `${table}_count`),
    ...(kind === "Finance"
      ? [
        "finance_entitlement_subject_cutover_v2_count",
        "finance_entitlement_subject_cutover_v2_invalid_count",
      ]
      : []),
  ];
  exactKeys(rows[0], expected, `${kind} rotation preflight`);
  if (
    rows[0].database_role !== EXPECTED_DATABASE_ROLE
    || rows[0].server_version_num !== EXPECTED_SERVER_VERSION_NUM
  ) fail(`${kind} read-only database identity differs`);
  if (decimal(rows[0].auth_users_count, `${kind} Auth user count`) !== 0) {
    fail(`${kind} staging contains Auth users`);
  }
  let pilotUsersCount = null;
  if (kind === "Main") {
    pilotUsersCount = decimal(rows[0].pilot_users_count, "Main pilot user count");
    if (pilotUsersCount > 1) {
      fail("Main staging contains more than the one permitted pilot user");
    }
  }
  for (const table of tables) {
    const tableCount = decimal(
      rows[0][`${table}_count`],
      `${kind} ${table} count`,
    );
    if (tableCount !== 0) {
      fail(
        `${kind} staging already contains subject-bound Finance state in ${table} (${tableCount} rows)`,
      );
    }
  }
  if (
    kind === "Finance"
    && (
      decimal(
        rows[0].finance_entitlement_subject_cutover_v2_count,
        "Finance subject cutover singleton count",
      ) !== 1
      || decimal(
        rows[0].finance_entitlement_subject_cutover_v2_invalid_count,
        "Finance subject cutover invalid count",
      ) !== 0
    )
  ) fail("Finance subject cutover is not the exact untouched preparing singleton");
  return Object.freeze({
    databaseRole: rows[0].database_role,
    serverVersionNum: rows[0].server_version_num,
    authUsersCount: 0,
    pilotUsersCount,
    subjectStateRows: 0,
  });
}

function validateSecretInventory(rows, projectRef) {
  if (!Array.isArray(rows)) fail("secret inventory differs");
  const inventory = new Map();
  for (const row of rows) {
    exactKeys(row, ["name", "updated_at", "value"], "secret inventory row");
    if (
      typeof row.name !== "string"
      || !/^[A-Z][A-Z0-9_]{1,255}$/u.test(row.name)
      || !SHA256.test(row.value)
      || !CANONICAL_TIMESTAMP.test(row.updated_at)
      || !Number.isFinite(Date.parse(row.updated_at))
      || inventory.has(row.name)
    ) fail("secret inventory row differs");
    inventory.set(row.name, Object.freeze({
      value: row.value,
      updatedAt: row.updated_at,
    }));
  }
  for (const gate of GATES.filter(item => item.projectRef === projectRef)) {
    const observed = inventory.get(gate.name);
    if (!observed || observed.value !== DISABLED_SHA256) {
      fail(`gate ${gate.name} is not exact disabled`);
    }
  }
  return inventory;
}

function inventoryCore(inventory) {
  return [...inventory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => Object.freeze({
      name,
      value: value.value,
      updatedAt: value.updatedAt,
    }));
}

async function fetchSecretInventory({
  projectRef,
  accessToken,
  fetchImpl,
  operation,
}) {
  const rows = await managementJson({
    accessToken,
    fetchImpl,
    method: "GET",
    url: `${MANAGEMENT_API_ORIGIN}/v1/projects/${projectRef}${SECRETS_SUFFIX}`,
    expectedStatus: 200,
    operation,
  });
  return validateSecretInventory(rows, projectRef);
}

function decodeBase64UrlJson(value, label) {
  let parsed;
  try {
    const source = Buffer.from(value, "base64url").toString("utf8");
    parsed = JSON.parse(source);
  } catch {
    fail(`${label} differs`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${label} differs`);
  }
  return parsed;
}

export function validateServiceRoleKey(value, projectRef) {
  if (typeof value !== "string" || !JWT.test(value) || value.length > 4096) {
    fail("legacy service_role key format differs");
  }
  const [headerPart, payloadPart] = value.split(".");
  const header = decodeBase64UrlJson(headerPart, "service_role JWT header");
  const payload = decodeBase64UrlJson(payloadPart, "service_role JWT payload");
  if (
    header.typ !== "JWT"
    || !["HS256", "HS384", "HS512"].includes(header.alg)
    || payload.role !== "service_role"
    || payload.ref !== projectRef
  ) fail("legacy service_role JWT claims differ");
  return value;
}

function validateApiKeys(rows, projectRef) {
  if (!Array.isArray(rows)) fail("project API key inventory differs");
  const matches = rows.filter(row =>
    row !== null
    && typeof row === "object"
    && !Array.isArray(row)
    && row.type === "legacy"
    && row.name === "service_role");
  if (matches.length !== 1) {
    fail("exactly one revealed legacy service_role key is required");
  }
  return validateServiceRoleKey(matches[0].api_key, projectRef);
}

async function fetchServiceRoleKey({
  projectRef,
  accessToken,
  fetchImpl,
}) {
  const rows = await managementJson({
    accessToken,
    fetchImpl,
    method: "GET",
    url: `${MANAGEMENT_API_ORIGIN}/v1/projects/${projectRef}${API_KEYS_SUFFIX}`,
    expectedStatus: 200,
    operation: "api-key inventory",
  });
  return validateApiKeys(rows, projectRef);
}

function generatedSecret(randomBytesImpl) {
  const value = randomBytesImpl(48).toString("base64url");
  if (!GENERATED_SECRET.test(value)) fail("generated secret format differs");
  return value;
}

function runtimeBytes({
  mainProjectRef,
  serviceRoleKey,
  privacyKey,
  triggerSecret,
}) {
  return [
    `MAIN_SUPABASE_URL=https://${mainProjectRef}.supabase.co`,
    `MAIN_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `MAIN_FINANCE_PRIVACY_HMAC_KEY=${privacyKey}`,
    `MAIN_FINANCE_SYNC_TRIGGER_SECRET=${triggerSecret}`,
    "",
  ].join("\n");
}

function parseRuntime(source, mainProjectRef) {
  if (typeof source !== "string" || source.includes("\r") || source.includes("\0")) {
    fail("runtime environment bytes differ");
  }
  const lines = source.split("\n");
  if (lines.at(-1) !== "") fail("runtime environment requires one trailing newline");
  lines.pop();
  if (lines.length !== 4) fail("runtime environment must contain exactly four rows");
  const result = {};
  for (const line of lines) {
    const separator = line.indexOf("=");
    if (separator < 1) fail("runtime environment row differs");
    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (Object.hasOwn(result, name)) fail("runtime environment has a duplicate name");
    result[name] = value;
  }
  exactKeys(result, [
    "MAIN_SUPABASE_URL",
    "MAIN_SERVICE_ROLE_KEY",
    "MAIN_FINANCE_PRIVACY_HMAC_KEY",
    "MAIN_FINANCE_SYNC_TRIGGER_SECRET",
  ], "runtime environment");
  if (result.MAIN_SUPABASE_URL !== `https://${mainProjectRef}.supabase.co`) {
    fail("runtime environment points outside exact Main staging");
  }
  validateServiceRoleKey(result.MAIN_SERVICE_ROLE_KEY, mainProjectRef);
  if (
    !GENERATED_SECRET.test(result.MAIN_FINANCE_PRIVACY_HMAC_KEY)
    || !GENERATED_SECRET.test(result.MAIN_FINANCE_SYNC_TRIGGER_SECRET)
    || new Set([
      result.MAIN_SERVICE_ROLE_KEY,
      result.MAIN_FINANCE_PRIVACY_HMAC_KEY,
      result.MAIN_FINANCE_SYNC_TRIGGER_SECRET,
    ]).size !== 3
  ) fail("runtime secret separation differs");
  return Object.freeze(result);
}

function readRuntimeBundle(bundleDirectory, mainProjectRef) {
  assertPrivateDirectory(bundleDirectory, "bundle directory");
  const runtimeFile = path.join(bundleDirectory, RUNTIME_FILE);
  const attestationFile = path.join(bundleDirectory, ATTESTATION_FILE);
  const runtimeSource = readPrivateFile(runtimeFile, "runtime environment", 16_384);
  const attestationSource = readPrivateFile(
    attestationFile,
    "runtime attestation",
    32_768,
  );
  let attestation;
  try {
    attestation = JSON.parse(attestationSource);
  } catch {
    fail("runtime attestation JSON differs");
  }
  exactKeys(attestation, [
    "schemaVersion",
    "operation",
    "environment",
    "mainProjectRef",
    "financeProjectRef",
    "productionDenied",
    "preparedAt",
    "hostedReadCount",
    "hostedMutationCount",
    "mainPreflightSqlSha256",
    "financePreflightSqlSha256",
    "gateInventorySha256",
    "runtimeFile",
    "runtimeSha256",
    "serviceRoleSha256",
    "privacyKeySha256",
    "triggerSecretSha256",
    "attestationSha256",
  ], "runtime attestation");
  const {
    attestationSha256,
    ...attestationCore
  } = attestation;
  if (
    attestation.schemaVersion !== 1
    || attestation.operation !== "prepare-main-finance-staging-access"
    || attestation.environment !== "staging"
    || attestation.mainProjectRef !== mainProjectRef
    || attestation.financeProjectRef
      !== MAIN_FINANCE_BOOTSTRAP_BOUNDARY.financeStagingProjectRef
    || attestation.productionDenied !== true
    || !CANONICAL_TIMESTAMP.test(attestation.preparedAt)
    || attestation.hostedReadCount !== 5
    || attestation.hostedMutationCount !== 0
    || attestation.mainPreflightSqlSha256
      !== MAIN_ROTATION_PREFLIGHT_SQL_SHA256
    || attestation.financePreflightSqlSha256
      !== FINANCE_ROTATION_PREFLIGHT_SQL_SHA256
    || !SHA256.test(attestation.gateInventorySha256)
    || attestation.runtimeFile !== RUNTIME_FILE
    || attestation.runtimeSha256 !== sha256(runtimeSource)
    || attestation.attestationSha256 !== sha256(canonicalJson(attestationCore))
  ) fail("runtime attestation contract differs");
  const runtime = parseRuntime(runtimeSource, mainProjectRef);
  if (
    attestation.serviceRoleSha256 !== sha256(runtime.MAIN_SERVICE_ROLE_KEY)
    || attestation.privacyKeySha256
      !== sha256(runtime.MAIN_FINANCE_PRIVACY_HMAC_KEY)
    || attestation.triggerSecretSha256
      !== sha256(runtime.MAIN_FINANCE_SYNC_TRIGGER_SECRET)
  ) fail("runtime secret hashes do not match attestation");
  return Object.freeze({
    runtime,
    runtimeSource,
    runtimeSha256: attestation.runtimeSha256,
    attestation,
  });
}

function readUnknownInstallReceipt({
  file,
  mainProjectRef,
  financeProjectRef,
  bundle,
}) {
  const source = readPrivateFile(
    file,
    "unknown install receipt",
    32_768,
  );
  let receipt;
  try {
    receipt = JSON.parse(source);
  } catch {
    fail("unknown install receipt JSON differs");
  }
  exactKeys(receipt, [
    "schemaVersion",
    "operation",
    "environment",
    "productionDenied",
    "status",
    "recordedAt",
    "mainProjectRef",
    "financeProjectRef",
    "hostedReadCount",
    "hostedMutationCount",
    "runtimeSha256",
    "secretNames",
    "mutationAccepted",
    "receiptSha256",
  ], "unknown install receipt");
  const {
    receiptSha256,
    ...receiptCore
  } = receipt;
  const expectedReadCount = receipt.mutationAccepted === true ? 6 : 4;
  if (
    receipt.schemaVersion !== 1
    || receipt.operation !== INSTALL_OPERATION
    || receipt.environment !== "staging"
    || receipt.productionDenied !== true
    || receipt.status !== "unknown"
    || !CANONICAL_TIMESTAMP.test(receipt.recordedAt)
    || !Number.isFinite(Date.parse(receipt.recordedAt))
    || receipt.mainProjectRef !== mainProjectRef
    || receipt.financeProjectRef !== financeProjectRef
    || receipt.hostedReadCount !== expectedReadCount
    || receipt.hostedMutationCount !== 1
    || receipt.runtimeSha256 !== bundle.runtimeSha256
    || canonicalJson(receipt.secretNames)
      !== canonicalJson(ROTATED_SECRET_NAMES)
    || ![true, false].includes(receipt.mutationAccepted)
    || !SHA256.test(receiptSha256)
    || receiptSha256 !== sha256(canonicalJson(receiptCore))
  ) fail("unknown install receipt contract differs");
  return Object.freeze(receipt);
}

function assertUnchangedInventory({
  before,
  after,
  permittedChangedNames,
  expectedDigests,
}) {
  const names = new Set([...before.keys(), ...after.keys()]);
  for (const name of names) {
    const previous = before.get(name);
    const current = after.get(name);
    if (permittedChangedNames.includes(name)) {
      if (!current || current.value !== expectedDigests[name]) {
        fail(`installed secret ${name} digest differs`);
      }
      continue;
    }
    if (
      !previous
      || !current
      || previous.value !== current.value
      || previous.updatedAt !== current.updatedAt
    ) fail("an unrelated Main secret changed during installation");
  }
}

function writeInstallReceipt(receiptDirectory, fields) {
  assertPrivateDirectory(receiptDirectory, "receipt directory");
  const core = {
    schemaVersion: 1,
    operation: INSTALL_OPERATION,
    environment: "staging",
    productionDenied: true,
    ...fields,
  };
  const receipt = {
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  };
  const stamp = receipt.recordedAt.replaceAll(/[^0-9]/gu, "");
  const file = path.join(
    receiptDirectory,
    `main-finance-staging-secret-install-${stamp}-${receipt.status}.json`,
  );
  writePrivateFile(file, `${canonicalJson(receipt)}\n`);
  return Object.freeze({ file, receipt });
}

function writeReconciliationReceipt(receiptDirectory, fields) {
  assertPrivateDirectory(receiptDirectory, "receipt directory");
  const core = {
    schemaVersion: 1,
    operation: RECONCILIATION_OPERATION,
    environment: "staging",
    productionDenied: true,
    status: "verified",
    ...fields,
  };
  const receipt = {
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  };
  const file = path.join(
    receiptDirectory,
    `main-finance-staging-secret-reconciliation-${fields.unknownInstallReceiptSha256}-verified.json`,
  );
  writePrivateFile(file, `${canonicalJson(receipt)}\n`);
  return Object.freeze({ file, receipt });
}

function parseArguments(argv) {
  if (argv.includes("--help")) return Object.freeze({ help: true });
  const input = {
    mode: null,
    mainProjectRef: null,
    financeProjectRef: null,
    accessTokenFile: null,
    outputDirectory: null,
    bundleDirectory: null,
    receiptDirectory: null,
    unknownReceiptFile: null,
    confirmation: null,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--plan", "--prepare", "--install", "--reconcile"].includes(argument)) {
      if (seen.has(argument) || input.mode !== null) {
        fail("exactly one operator mode is required");
      }
      seen.add(argument);
      input.mode = argument.slice(2);
      continue;
    }
    if (![
      "--main-project-ref",
      "--finance-project-ref",
      "--access-token-file",
      "--output-directory",
      "--bundle-directory",
      "--receipt-directory",
      "--unknown-receipt-file",
      "--confirmation",
    ].includes(argument)) fail(`unknown argument ${argument}`);
    if (seen.has(argument)) fail(`duplicate ${argument}`);
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${argument} requires a value`);
    if (argument === "--confirmation") input.confirmation = value;
    else if (argument === "--main-project-ref") input.mainProjectRef = value;
    else if (argument === "--finance-project-ref") {
      input.financeProjectRef = value;
    } else if (argument === "--access-token-file") {
      input.accessTokenFile = value;
    } else if (argument === "--output-directory") {
      input.outputDirectory = value;
    } else if (argument === "--bundle-directory") {
      input.bundleDirectory = value;
    } else if (argument === "--receipt-directory") {
      input.receiptDirectory = value;
    } else input.unknownReceiptFile = value;
    index += 1;
  }
  if (input.mode === null) {
    fail("--plan, --prepare, --install or --reconcile is required");
  }
  if (!input.mainProjectRef || !input.financeProjectRef) {
    fail("both exact staging project refs are required");
  }
  assertBoundary(input.mainProjectRef, input.financeProjectRef);
  if (input.mode === "plan") {
    if (
      input.accessTokenFile
      || input.outputDirectory
      || input.bundleDirectory
      || input.receiptDirectory
      || input.unknownReceiptFile
      || input.confirmation
    ) fail("--plan accepts only the two project refs");
  } else if (input.mode === "prepare") {
    if (
      !input.accessTokenFile
      || !input.outputDirectory
      || input.bundleDirectory
      || input.receiptDirectory
      || input.unknownReceiptFile
      || input.confirmation
    ) fail("--prepare requires only access-token-file and output-directory");
  } else if (input.mode === "install") {
    if (
      !input.accessTokenFile
      || !input.bundleDirectory
      || !input.receiptDirectory
      || input.outputDirectory
      || input.unknownReceiptFile
      || input.confirmation !== INSTALL_CONFIRMATION
    ) fail("--install requires bundle, receipt, token and the exact confirmation");
  } else if (
    !input.accessTokenFile
    || !input.bundleDirectory
    || !input.receiptDirectory
    || !input.unknownReceiptFile
    || input.outputDirectory
    || input.confirmation
  ) fail("--reconcile requires token, bundle, receipt directory and unknown receipt file only");
  return Object.freeze(input);
}

async function liveRotationGuards({
  mainProjectRef,
  financeProjectRef,
  accessToken,
  fetchImpl,
}) {
  const [mainRows, financeRows] = await Promise.all([
    readOnlyPreflight({
      projectRef: mainProjectRef,
      sql: MAIN_ROTATION_PREFLIGHT_SQL,
      accessToken,
      fetchImpl,
      operation: "Main rotation preflight",
    }),
    readOnlyPreflight({
      projectRef: financeProjectRef,
      sql: FINANCE_ROTATION_PREFLIGHT_SQL,
      accessToken,
      fetchImpl,
      operation: "Finance rotation preflight",
    }),
  ]);
  const main = validatePreflightRows(mainRows, "Main");
  const finance = validatePreflightRows(financeRows, "Finance");
  const [mainInventory, financeInventory] = await Promise.all([
    fetchSecretInventory({
      projectRef: mainProjectRef,
      accessToken,
      fetchImpl,
      operation: "Main secret inventory",
    }),
    fetchSecretInventory({
      projectRef: financeProjectRef,
      accessToken,
      fetchImpl,
      operation: "Finance secret inventory",
    }),
  ]);
  return Object.freeze({
    main,
    finance,
    mainInventory,
    financeInventory,
    gateInventorySha256: sha256(canonicalJson({
      main: inventoryCore(mainInventory),
      finance: inventoryCore(financeInventory),
    })),
  });
}

export async function runMainFinanceStagingAccessBootstrap(
  input,
  dependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const randomBytesImpl = dependencies.randomBytesImpl ?? randomBytes;
  const now = dependencies.now ?? (() => new Date());
  assertBoundary(input.mainProjectRef, input.financeProjectRef);
  assertPinnedSql();
  if (!["plan", "prepare", "install", "reconcile"].includes(input.mode)) {
    fail("operator mode differs");
  }
  if (input.mode === "plan") {
    return Object.freeze({
      ok: true,
      mode: "plan",
      environment: "staging",
      productionDenied: true,
      hostedReadCount: 0,
      hostedMutationCount: 0,
      prepareHostedReadCount: 5,
      installHostedReadCount: 6,
      installHostedMutationCount: 1,
      reconcileHostedReadCount: 2,
      reconcileHostedMutationCount: 0,
      rotatedSecretNames: ROTATED_SECRET_NAMES,
      installConfirmation: INSTALL_CONFIRMATION,
    });
  }

  const accessToken = readAccessToken(input.accessTokenFile);
  if (input.mode === "reconcile") {
    const bundle = readRuntimeBundle(
      input.bundleDirectory,
      input.mainProjectRef,
    );
    const unknownReceipt = readUnknownInstallReceipt({
      file: input.unknownReceiptFile,
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      bundle,
    });
    const [mainInventory] = await Promise.all([
      fetchSecretInventory({
        projectRef: input.mainProjectRef,
        accessToken,
        fetchImpl,
        operation: "read-only Main unknown-install reconciliation inventory",
      }),
      fetchSecretInventory({
        projectRef: input.financeProjectRef,
        accessToken,
        fetchImpl,
        operation: "read-only Finance unknown-install reconciliation inventory",
      }),
    ]);
    const expectedDigests = Object.freeze({
      MAIN_FINANCE_PRIVACY_HMAC_KEY:
        bundle.attestation.privacyKeySha256,
      MAIN_FINANCE_SYNC_TRIGGER_SECRET:
        bundle.attestation.triggerSecretSha256,
    });
    for (const name of ROTATED_SECRET_NAMES) {
      const observed = mainInventory.get(name);
      if (!observed || observed.value !== expectedDigests[name]) {
        fail(`reconciliation digest for ${name} differs`);
      }
    }
    const targetDigestProofSha256 = sha256(canonicalJson(
      ROTATED_SECRET_NAMES.map(name => ({
        name,
        sha256: expectedDigests[name],
      })),
    ));
    const written = writeReconciliationReceipt(input.receiptDirectory, {
      recordedAt: canonicalTimestamp(now()),
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      hostedReadCount: 2,
      hostedMutationCount: 0,
      priorHostedMutationCount: 1,
      proofScope:
        "current-target-digests-and-four-disabled-gates-only",
      unrelatedSecretsCompared: false,
      runtimeSha256: bundle.runtimeSha256,
      runtimeAttestationSha256: bundle.attestation.attestationSha256,
      unknownInstallReceiptSha256: unknownReceipt.receiptSha256,
      secretNames: ROTATED_SECRET_NAMES,
      targetDigestProofSha256,
    });
    return Object.freeze({
      ok: true,
      mode: "reconcile",
      environment: "staging",
      productionDenied: true,
      hostedReadCount: 2,
      hostedMutationCount: 0,
      status: "verified",
      receiptFile: written.file,
      receiptSha256: written.receipt.receiptSha256,
    });
  }
  if (input.mode === "prepare") {
    const guards = await liveRotationGuards({
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      accessToken,
      fetchImpl,
    });
    const serviceRoleKey = await fetchServiceRoleKey({
      projectRef: input.mainProjectRef,
      accessToken,
      fetchImpl,
    });
    const privacyKey = generatedSecret(randomBytesImpl);
    const triggerSecret = generatedSecret(randomBytesImpl);
    const allKnownDigests = new Set([
      ...[...guards.mainInventory.values()].map(item => item.value),
      ...[...guards.financeInventory.values()].map(item => item.value),
    ]);
    if (
      privacyKey === triggerSecret
      || allKnownDigests.has(sha256(privacyKey))
      || allKnownDigests.has(sha256(triggerSecret))
    ) fail("generated secrets are not fresh and separated");
    const runtimeSource = runtimeBytes({
      mainProjectRef: input.mainProjectRef,
      serviceRoleKey,
      privacyKey,
      triggerSecret,
    });
    const outputDirectory = createPrivateOutputDirectory(
      input.outputDirectory,
    );
    const runtimeFile = path.join(outputDirectory, RUNTIME_FILE);
    writePrivateFile(runtimeFile, runtimeSource);
    const preparedAt = canonicalTimestamp(now());
    const attestationCore = {
      schemaVersion: 1,
      operation: "prepare-main-finance-staging-access",
      environment: "staging",
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      productionDenied: true,
      preparedAt,
      hostedReadCount: 5,
      hostedMutationCount: 0,
      mainPreflightSqlSha256: MAIN_ROTATION_PREFLIGHT_SQL_SHA256,
      financePreflightSqlSha256: FINANCE_ROTATION_PREFLIGHT_SQL_SHA256,
      gateInventorySha256: guards.gateInventorySha256,
      runtimeFile: RUNTIME_FILE,
      runtimeSha256: sha256(runtimeSource),
      serviceRoleSha256: sha256(serviceRoleKey),
      privacyKeySha256: sha256(privacyKey),
      triggerSecretSha256: sha256(triggerSecret),
    };
    const attestation = {
      ...attestationCore,
      attestationSha256: sha256(canonicalJson(attestationCore)),
    };
    writePrivateFile(
      path.join(outputDirectory, ATTESTATION_FILE),
      `${canonicalJson(attestation)}\n`,
    );
    return Object.freeze({
      ok: true,
      mode: "prepare",
      environment: "staging",
      productionDenied: true,
      hostedReadCount: 5,
      hostedMutationCount: 0,
      outputDirectory,
      runtimeFile,
      runtimeSha256: attestation.runtimeSha256,
      attestationSha256: attestation.attestationSha256,
      mainPilotUsersCount: guards.main.pilotUsersCount,
    });
  }

  if (input.confirmation !== INSTALL_CONFIRMATION) {
    fail("installation confirmation differs");
  }
  const bundle = readRuntimeBundle(
    input.bundleDirectory,
    input.mainProjectRef,
  );
  const before = await liveRotationGuards({
    mainProjectRef: input.mainProjectRef,
    financeProjectRef: input.financeProjectRef,
    accessToken,
    fetchImpl,
  });
  const payload = [
    {
      name: ROTATED_SECRET_NAMES[0],
      value: bundle.runtime.MAIN_FINANCE_PRIVACY_HMAC_KEY,
    },
    {
      name: ROTATED_SECRET_NAMES[1],
      value: bundle.runtime.MAIN_FINANCE_SYNC_TRIGGER_SECRET,
    },
  ];
  let mutationAccepted = false;
  try {
    const response = await managementJson({
      accessToken,
      fetchImpl,
      method: "POST",
      url: `${MANAGEMENT_API_ORIGIN}/v1/projects/${input.mainProjectRef}${SECRETS_SUFFIX}`,
      expectedStatus: 201,
      body: canonicalJson(payload),
      operation: "two-secret installation",
    });
    exactKeys(response, [], "two-secret installation response");
    mutationAccepted = true;
  } catch (error) {
    writeInstallReceipt(input.receiptDirectory, {
      status: "unknown",
      recordedAt: canonicalTimestamp(now()),
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      hostedReadCount: 4,
      hostedMutationCount: 1,
      runtimeSha256: bundle.runtimeSha256,
      secretNames: ROTATED_SECRET_NAMES,
      mutationAccepted,
    });
    throw error;
  }
  let afterMain;
  let afterFinance;
  try {
    [afterMain, afterFinance] = await Promise.all([
      fetchSecretInventory({
        projectRef: input.mainProjectRef,
        accessToken,
        fetchImpl,
        operation: "post-install Main secret inventory",
      }),
      fetchSecretInventory({
        projectRef: input.financeProjectRef,
        accessToken,
        fetchImpl,
        operation: "post-install Finance secret inventory",
      }),
    ]);
    assertUnchangedInventory({
      before: before.mainInventory,
      after: afterMain,
      permittedChangedNames: ROTATED_SECRET_NAMES,
      expectedDigests: {
        MAIN_FINANCE_PRIVACY_HMAC_KEY:
          bundle.attestation.privacyKeySha256,
        MAIN_FINANCE_SYNC_TRIGGER_SECRET:
          bundle.attestation.triggerSecretSha256,
      },
    });
    assertUnchangedInventory({
      before: before.financeInventory,
      after: afterFinance,
      permittedChangedNames: [],
      expectedDigests: {},
    });
  } catch (error) {
    writeInstallReceipt(input.receiptDirectory, {
      status: "unknown",
      recordedAt: canonicalTimestamp(now()),
      mainProjectRef: input.mainProjectRef,
      financeProjectRef: input.financeProjectRef,
      hostedReadCount: 6,
      hostedMutationCount: 1,
      runtimeSha256: bundle.runtimeSha256,
      secretNames: ROTATED_SECRET_NAMES,
      mutationAccepted,
    });
    throw error;
  }
  const written = writeInstallReceipt(input.receiptDirectory, {
    status: "verified",
    recordedAt: canonicalTimestamp(now()),
    mainProjectRef: input.mainProjectRef,
    financeProjectRef: input.financeProjectRef,
    hostedReadCount: 6,
    hostedMutationCount: 1,
    runtimeSha256: bundle.runtimeSha256,
    secretNames: ROTATED_SECRET_NAMES,
    mutationAccepted,
    mainInventorySha256: sha256(canonicalJson(inventoryCore(afterMain))),
    financeInventorySha256: sha256(
      canonicalJson(inventoryCore(afterFinance)),
    ),
  });
  return Object.freeze({
    ok: true,
    mode: "install",
    environment: "staging",
    productionDenied: true,
    hostedReadCount: 6,
    hostedMutationCount: 1,
    status: "verified",
    receiptFile: written.file,
    receiptSha256: written.receipt.receiptSha256,
  });
}

function usage() {
  return [
    "Usage:",
    "  bootstrap-main-finance-staging-access.mjs --plan --main-project-ref REF --finance-project-ref REF",
    "  bootstrap-main-finance-staging-access.mjs --prepare --main-project-ref REF --finance-project-ref REF --access-token-file ABS --output-directory ABS",
    `  bootstrap-main-finance-staging-access.mjs --install --main-project-ref REF --finance-project-ref REF --access-token-file ABS --bundle-directory ABS --receipt-directory ABS --confirmation "${INSTALL_CONFIRMATION}"`,
    "  bootstrap-main-finance-staging-access.mjs --reconcile --main-project-ref REF --finance-project-ref REF --access-token-file ABS --bundle-directory ABS --unknown-receipt-file ABS --receipt-directory ABS",
  ].join("\n");
}

async function main() {
  const input = parseArguments(process.argv.slice(2));
  if (input.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const result = await runMainFinanceStagingAccessBootstrap(input);
  process.stdout.write(`${canonicalJson(result)}\n`);
}

const isEntryPoint = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntryPoint) {
  main().catch(error => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Main Finance staging access bootstrap failed"}\n`,
    );
    process.exitCode = 1;
  });
}
