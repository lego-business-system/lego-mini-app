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
const MIGRATION_VERSION = "20260729010000";
const MIGRATION_NAME = "finance_security_definer_owner_acl_v1";
const MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  "supabase/migrations/20260729010000_finance_security_definer_owner_acl_v1.sql",
);
const MIGRATION_SHA256 =
  "a02fb206c54c6f186fe246c430410c9b97a9126c3e959293455122eac3aa0905";
const RECEIPT_DIRECTORY =
  "/private/tmp/architecture-finance-release-control/main-owner-acl-receipts-v1";
const API_ORIGIN = "https://api.supabase.com";
const READ_URL =
  `${API_ORIGIN}/v1/projects/${PROJECT_REF}/database/query/read-only`;
const WRITE_URL =
  `${API_ORIGIN}/v1/projects/${PROJECT_REF}/database/query`;

const INSPECT_SQL = `WITH protected_tables AS (
  SELECT relation.oid, relation.relname
  FROM pg_catalog.pg_class AS relation
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname IN (
      'architecture_product_entitlements',
      'architecture_finance_issue_requests',
      'architecture_finance_issue_replay_guard',
      'architecture_finance_access_desired',
      'architecture_finance_access_outbox'
    )
    AND relation.relkind = 'r'
    AND relation.relowner = (
      SELECT role.oid FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = 'postgres'
    )
    AND relation.relrowsecurity
    AND NOT relation.relforcerowsecurity
)
SELECT
  current_user::text AS database_role,
  (
    SELECT role.rolsuper::text
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'postgres'
  ) AS postgres_superuser,
  (SELECT count(*)::text FROM protected_tables) AS protected_table_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    WHERE pg_catalog.has_table_privilege('postgres', table_row.oid, 'SELECT')
  ) AS owner_select_table_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    WHERE pg_catalog.has_table_privilege('postgres', table_row.oid, 'INSERT')
      AND pg_catalog.has_table_privilege('postgres', table_row.oid, 'UPDATE')
  ) AS owner_write_table_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    WHERE pg_catalog.has_table_privilege('postgres', table_row.oid, 'DELETE')
       OR pg_catalog.has_table_privilege('postgres', table_row.oid, 'TRUNCATE')
       OR pg_catalog.has_table_privilege('postgres', table_row.oid, 'REFERENCES')
       OR pg_catalog.has_table_privilege('postgres', table_row.oid, 'TRIGGER')
  ) AS owner_forbidden_table_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    WHERE pg_catalog.has_table_privilege('service_role', table_row.oid, 'SELECT')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'INSERT')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'UPDATE')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'DELETE')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'TRUNCATE')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'REFERENCES')
       OR pg_catalog.has_table_privilege('service_role', table_row.oid, 'TRIGGER')
  ) AS service_direct_table_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    JOIN pg_catalog.pg_class AS relation ON relation.oid = table_row.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    WHERE pg_catalog.pg_get_userbyid(acl.grantee) = 'postgres'
      AND pg_catalog.pg_get_userbyid(acl.grantor) = 'postgres'
      AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE')
      AND NOT acl.is_grantable
  ) AS exact_owner_table_acl_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    JOIN pg_catalog.pg_class AS relation ON relation.oid = table_row.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS acl
    WHERE pg_catalog.pg_get_userbyid(acl.grantee) IS DISTINCT FROM 'postgres'
       OR pg_catalog.pg_get_userbyid(acl.grantor) IS DISTINCT FROM 'postgres'
       OR acl.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE')
       OR acl.is_grantable
  ) AS unexpected_table_acl_count,
  (
    SELECT count(*)::text
    FROM protected_tables AS table_row
    JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = table_row.oid
    CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) AS acl
    WHERE attribute.attnum > 0
      AND NOT attribute.attisdropped
  ) AS column_acl_count,
  (
    SELECT count(*)::text
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'architecture_upsert_product_entitlement_internal',
        'architecture_begin_finance_issue_internal',
        'architecture_finish_finance_issue_internal',
        'architecture_set_finance_access_desired_internal',
        'architecture_get_finance_access_status_internal',
        'architecture_claim_finance_access_outbox_internal',
        'architecture_finish_finance_access_outbox_internal',
        'architecture_resolve_finance_subject_internal'
      )
      AND procedure.prosecdef
      AND pg_catalog.pg_get_userbyid(procedure.proowner) = 'postgres'
  ) AS security_definer_count,
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
  throw new Error(`Main Finance owner ACL staging apply refused: ${message}`);
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
    || parseCount(row, "protected_table_count") !== 5
    || parseCount(row, "owner_select_table_count") !== 5
    || parseCount(row, "owner_forbidden_table_count") !== 0
    || parseCount(row, "service_direct_table_count") !== 0
    || parseCount(row, "unexpected_table_acl_count") !== 0
    || parseCount(row, "column_acl_count") !== 0
    || parseCount(row, "security_definer_count") !== 8
  ) {
    fail(`hosted protected-object contract differs: ${JSON.stringify(row)}`);
  }
  const ownerWrite = parseCount(row, "owner_write_table_count");
  const exactOwnerAcl = parseCount(row, "exact_owner_table_acl_count");
  const exactHistory = parseCount(row, "exact_history_count");
  const relevantHistory = parseCount(row, "relevant_history_count");
  if (
    ![0, 15].includes(exactOwnerAcl)
    || ownerWrite !== exactOwnerAcl / 3
  ) fail("owner table ACL count differs");
  if (relevantHistory !== exactHistory || ![0, 1].includes(exactHistory)) {
    fail("migration history conflicts");
  }
  if (expectedState === "before") {
    if (
      (exactHistory === 0 && ![0, 5].includes(ownerWrite))
      || (exactHistory === 1 && ownerWrite !== 5)
    ) fail("preflight owner ACL state differs");
  } else if (ownerWrite !== 5 || exactHistory !== 1) {
    fail("postflight owner ACL state differs");
  }
  return Object.freeze({ ownerWrite, exactOwnerAcl, exactHistory });
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
    operation: "apply-main-finance-owner-acl-v1",
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
    `owner-acl-${full.recordedAt.replaceAll(/[^0-9]/gu, "")}.json`,
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
SELECT 'owner_acl_applied'::text AS outcome;`;

  try {
    await query(WRITE_URL, applySql, token);
  } catch {
    // Outcome is reconciled below. A network boundary failure must never cause
    // an uninspected retry of the same mutation.
  }

  const after = validateInspection(
    await query(READ_URL, INSPECT_SQL, token),
    "after",
  );
  const recordedAt = new Date().toISOString();
  const receipt = writeReceipt({
    recordedAt,
    preflightOwnerWriteTableCount: before.ownerWrite,
    preflightExactOwnerTableAclCount: before.exactOwnerAcl,
    preflightHistoryCount: before.exactHistory,
    postflightOwnerWriteTableCount: after.ownerWrite,
    postflightExactOwnerTableAclCount: after.exactOwnerAcl,
    postflightHistoryCount: after.exactHistory,
    hostedReadCount: 2,
    hostedMutationCount: 1,
    productionTouched: false,
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    environment: "main-staging",
    migration_version: MIGRATION_VERSION,
    owner_write_table_count: after.ownerWrite,
    exact_owner_table_acl_count: after.exactOwnerAcl,
    service_direct_table_count: 0,
    production_touched: false,
    receipt_file: receipt.file,
    receipt_sha256: receipt.sha256,
  })}\n`);
}

main().catch(error => {
  process.stderr.write(
    `${error instanceof Error
      ? error.message
      : "Main Finance owner ACL staging apply failed"}\n`,
  );
  process.exitCode = 1;
});
