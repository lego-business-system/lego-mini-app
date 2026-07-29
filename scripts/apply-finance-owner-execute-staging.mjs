#!/usr/bin/env node

import { createHash } from "node:crypto";
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
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const PROJECT_REF = "bljeoovhydhjhdzwplxh";
const PRODUCTION_REF = "soxtekhspohkddpdidvp";
const ACCESS_TOKEN_FILE = "/Users/Maks/.supabase/access-token";
const MIGRATION_VERSION = "20260729020000";
const MIGRATION_NAME = "finance_security_definer_nested_execute_acl_v1";
const MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  "supabase/migrations/20260729020000_finance_security_definer_nested_execute_acl_v1.sql",
);
const MIGRATION_SHA256 =
  "493b3963053e317e04803b6662bfb2aba9ce1e24292262e2921261a1b4c425a3";
const RECEIPT_DIRECTORY =
  "/private/tmp/architecture-finance-release-control/main-owner-execute-receipts-v1";
const API_ORIGIN = "https://api.supabase.com";
const READ_URL =
  `${API_ORIGIN}/v1/projects/${PROJECT_REF}/database/query/read-only`;
const WRITE_URL =
  `${API_ORIGIN}/v1/projects/${PROJECT_REF}/database/query`;

const FUNCTION_SIGNATURE =
  "public.architecture_upsert_product_entitlement_internal(bytea,text,text,timestamp with time zone,timestamp with time zone)";
const INSPECT_SQL = `WITH target_function AS (
  SELECT procedure.oid
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'architecture_upsert_product_entitlement_internal'
    AND pg_catalog.oidvectortypes(procedure.proargtypes)
      = 'bytea, text, text, timestamp with time zone, timestamp with time zone'
    AND procedure.prosecdef
    AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
)
SELECT
  current_user::text AS database_role,
  (
    SELECT role.rolsuper::text
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'postgres'
  ) AS postgres_superuser,
  (SELECT count(*)::text FROM target_function) AS function_count,
  pg_catalog.has_function_privilege(
    'postgres',
    '${FUNCTION_SIGNATURE}',
    'EXECUTE'
  )::text AS owner_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    '${FUNCTION_SIGNATURE}',
    'EXECUTE'
  )::text AS service_execute,
  pg_catalog.has_function_privilege(
    'anon',
    '${FUNCTION_SIGNATURE}',
    'EXECUTE'
  )::text AS anon_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    '${FUNCTION_SIGNATURE}',
    'EXECUTE'
  )::text AS authenticated_execute,
  (
    SELECT count(*)::text
    FROM target_function
    JOIN pg_catalog.pg_proc AS procedure ON procedure.oid = target_function.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
    WHERE pg_catalog.pg_get_userbyid(acl.grantee) = 'postgres'
      AND pg_catalog.pg_get_userbyid(acl.grantor) = 'postgres'
      AND acl.privilege_type = 'EXECUTE'
      AND NOT acl.is_grantable
  ) AS exact_owner_acl_count,
  (
    SELECT count(*)::text
    FROM target_function
    JOIN pg_catalog.pg_proc AS procedure ON procedure.oid = target_function.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(procedure.proacl) AS acl
    WHERE pg_catalog.pg_get_userbyid(acl.grantee) IS DISTINCT FROM 'postgres'
       OR pg_catalog.pg_get_userbyid(acl.grantor) IS DISTINCT FROM 'postgres'
       OR acl.privilege_type IS DISTINCT FROM 'EXECUTE'
       OR acl.is_grantable
  ) AS unexpected_acl_count,
  (
    SELECT count(*)::text
    FROM supabase_migrations.schema_migrations AS migration
    WHERE migration.version = '${MIGRATION_VERSION}'
      AND migration.name = '${MIGRATION_NAME}'
  ) AS exact_history_count,
  (
    SELECT count(*)::text
    FROM supabase_migrations.schema_migrations AS migration
    WHERE migration.version = '${MIGRATION_VERSION}'
       OR migration.name = '${MIGRATION_NAME}'
  ) AS relevant_history_count`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message) {
  throw new Error(`Main Finance owner EXECUTE staging apply refused: ${message}`);
}

function readPrivateFile(file, label, minimum, maximum) {
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || realpathSync(file) !== file
    || status.size < minimum
    || status.size > maximum
  ) fail(`${label} boundary differs`);
  const value = readFileSync(file, "utf8").trim();
  if (
    value.length < minimum
    || value.length > maximum
    || /[\u0000-\u0020\u007f]/u.test(value)
  ) fail(`${label} format differs`);
  return value;
}

function migrationBody() {
  const status = lstatSync(MIGRATION_PATH);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || realpathSync(MIGRATION_PATH) !== MIGRATION_PATH
  ) fail("migration file boundary differs");
  const source = readFileSync(MIGRATION_PATH, "utf8");
  if (sha256(source) !== MIGRATION_SHA256) fail("migration bytes differ");
  const begin = source.indexOf("\nBEGIN;\n");
  const commit = source.lastIndexOf("\nCOMMIT;\n");
  if (begin < 0 || commit <= begin) fail("migration transaction boundary differs");
  return source.slice(begin + "\nBEGIN;\n".length, commit);
}

function parseCount(row, field) {
  const value = row[field];
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    fail(`${field} differs`);
  }
  return Number(value);
}

function validateInspection(rows, expectedState) {
  if (
    !Array.isArray(rows)
    || rows.length !== 1
    || rows[0] === null
    || typeof rows[0] !== "object"
    || Array.isArray(rows[0])
  ) fail("inspection result differs");
  const row = rows[0];
  if (
    row.database_role !== "supabase_read_only_user"
    || row.postgres_superuser !== "false"
    || parseCount(row, "function_count") !== 1
    || row.service_execute !== "false"
    || row.anon_execute !== "false"
    || row.authenticated_execute !== "false"
    || parseCount(row, "exact_owner_acl_count") !== (row.owner_execute === "true" ? 1 : 0)
    || parseCount(row, "unexpected_acl_count") !== 0
  ) {
    fail(`hosted nested function contract differs: ${JSON.stringify(row)}`);
  }
  const ownerExecute = row.owner_execute === "true";
  if (row.owner_execute !== "true" && row.owner_execute !== "false") {
    fail("owner_execute differs");
  }
  const exactHistory = parseCount(row, "exact_history_count");
  const relevantHistory = parseCount(row, "relevant_history_count");
  if (relevantHistory !== exactHistory || ![0, 1].includes(exactHistory)) {
    fail("migration history conflicts");
  }
  if (expectedState === "before") {
    if (exactHistory === 1 && !ownerExecute) fail("recorded owner EXECUTE is absent");
  } else if (!ownerExecute || exactHistory !== 1) {
    fail("postflight owner EXECUTE state differs");
  }
  return Object.freeze({ ownerExecute, exactHistory });
}

async function query(url, sql, token) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    fail("Management API request failed");
  }
  if (
    response.status !== 201
    || response.redirected
    || response.url !== url
    || !response.headers.get("content-type")?.toLowerCase().startsWith(
      "application/json",
    )
  ) fail("Management API response boundary differs");
  let result;
  try {
    result = await response.json();
  } catch {
    fail("Management API response JSON differs");
  }
  if (!Array.isArray(result)) fail("Management API result differs");
  return result;
}

function writeReceipt(receipt) {
  mkdirSync(RECEIPT_DIRECTORY, { recursive: true, mode: 0o700 });
  const directory = lstatSync(RECEIPT_DIRECTORY);
  if (
    !directory.isDirectory()
    || directory.isSymbolicLink()
    || (directory.mode & 0o777) !== 0o700
    || realpathSync(RECEIPT_DIRECTORY) !== RECEIPT_DIRECTORY
  ) fail("receipt directory boundary differs");
  const core = {
    schemaVersion: 1,
    operation: "apply-main-finance-owner-execute-v1",
    projectRef: PROJECT_REF,
    productionDenied: true,
    migrationVersion: MIGRATION_VERSION,
    migrationName: MIGRATION_NAME,
    migrationSha256: MIGRATION_SHA256,
    ...receipt,
  };
  const full = { ...core, receiptSha256: sha256(JSON.stringify(core)) };
  const file = path.join(
    RECEIPT_DIRECTORY,
    `owner-execute-${full.recordedAt.replaceAll(/[^0-9]/gu, "")}.json`,
  );
  const descriptor = openSync(
    file,
    fsConstants.O_WRONLY
      | fsConstants.O_CREAT
      | fsConstants.O_EXCL
      | (fsConstants.O_NOFOLLOW ?? 0),
    0o600,
  );
  try {
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, `${JSON.stringify(full)}\n`, "utf8");
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.nlink !== 1 || (status.mode & 0o777) !== 0o600) {
      fail("receipt file boundary differs");
    }
  } finally {
    closeSync(descriptor);
  }
  return { file, sha256: full.receiptSha256 };
}

async function main() {
  if (
    process.argv.length !== 3
    || process.argv[2] !== "--apply"
    || PROJECT_REF === PRODUCTION_REF
    || READ_URL.includes(PRODUCTION_REF)
    || WRITE_URL.includes(PRODUCTION_REF)
    || !READ_URL.endsWith("/database/query/read-only")
    || !WRITE_URL.endsWith("/database/query")
  ) fail("exact --apply staging boundary is required");

  const token = readPrivateFile(ACCESS_TOKEN_FILE, "access token", 20, 4096);
  const body = migrationBody();
  const before = validateInspection(
    await query(READ_URL, INSPECT_SQL, token),
    "before",
  );

  const applySql = `BEGIN;
${body}
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
  '${MIGRATION_VERSION}',
  ARRAY[]::text[],
  '${MIGRATION_NAME}'
)
ON CONFLICT (version) DO NOTHING;
COMMIT;
SELECT 'owner_execute_applied'::text AS outcome;`;

  try {
    await query(WRITE_URL, applySql, token);
  } catch {
    // Reconcile once below. Never retry a mutation with an unknown outcome.
  }

  const after = validateInspection(
    await query(READ_URL, INSPECT_SQL, token),
    "after",
  );
  const receipt = writeReceipt({
    recordedAt: new Date().toISOString(),
    preflightOwnerExecute: before.ownerExecute,
    preflightHistoryCount: before.exactHistory,
    postflightOwnerExecute: after.ownerExecute,
    postflightHistoryCount: after.exactHistory,
    hostedReadCount: 2,
    hostedMutationCount: 1,
    productionTouched: false,
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment: "main-staging",
    migration_version: MIGRATION_VERSION,
    owner_execute: after.ownerExecute,
    service_execute: false,
    production_touched: false,
    receipt_file: receipt.file,
    receipt_sha256: receipt.sha256,
  })}\n`);
}

main().catch(error => {
  process.stderr.write(
    `${error instanceof Error
      ? error.message
      : "Main Finance owner EXECUTE staging apply failed"}\n`,
  );
  process.exitCode = 1;
});
