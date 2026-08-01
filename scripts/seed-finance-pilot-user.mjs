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
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const MANAGEMENT_API_ORIGIN = "https://api.supabase.com";
const READ_ONLY_QUERY_SUFFIX = "/database/query/read-only";
const MUTATING_QUERY_SUFFIX = "/database/query";
const MAXIMUM_RESPONSE_BYTES = 256 * 1_024;
const REQUEST_TIMEOUT_MS = 30_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TELEGRAM_ID = /^[1-9][0-9]{0,18}$/u;
const ACCESS_TOKEN = /^[A-Za-z0-9._-]{20,4096}$/u;
const DECIMAL = /^(?:0|[1-9][0-9]*)$/u;
const MAXIMUM_BIGINT = 9_223_372_036_854_775_807n;

export const PILOT_USER_BOUNDARY = Object.freeze({
  mainStagingProjectRef: "bljeoovhydhjhdzwplxh",
  productionDenyProjectRefs: Object.freeze([
    "soxtekhspohkddpdidvp",
  ]),
});

export const EXPECTED_USERS_SCHEMA = Object.freeze({
  columns: Object.freeze([
    Object.freeze({
      ordinal_position: "1",
      name: "id",
      data_type: "uuid",
      udt_name: "uuid",
      nullable: "NO",
      default: "gen_random_uuid()",
    }),
    Object.freeze({
      ordinal_position: "2",
      name: "telegram_id",
      data_type: "bigint",
      udt_name: "int8",
      nullable: "NO",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "3",
      name: "username",
      data_type: "text",
      udt_name: "text",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "4",
      name: "first_name",
      data_type: "text",
      udt_name: "text",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "5",
      name: "last_name",
      data_type: "text",
      udt_name: "text",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "6",
      name: "photo_url",
      data_type: "text",
      udt_name: "text",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "7",
      name: "role",
      data_type: "text",
      udt_name: "text",
      nullable: "NO",
      default: "'student'::text",
    }),
    Object.freeze({
      ordinal_position: "8",
      name: "access_status",
      data_type: "text",
      udt_name: "text",
      nullable: "NO",
      default: "'unknown'::text",
    }),
    Object.freeze({
      ordinal_position: "9",
      name: "manual_access_until",
      data_type: "timestamp with time zone",
      udt_name: "timestamptz",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "10",
      name: "last_seen_at",
      data_type: "timestamp with time zone",
      udt_name: "timestamptz",
      nullable: "YES",
      default: null,
    }),
    Object.freeze({
      ordinal_position: "11",
      name: "created_at",
      data_type: "timestamp with time zone",
      udt_name: "timestamptz",
      nullable: "NO",
      default: "now()",
    }),
  ]),
  constraints: Object.freeze([
    Object.freeze({
      name: "users_pkey",
      type: "primary_key",
      columns: Object.freeze(["id"]),
    }),
    Object.freeze({
      name: "users_telegram_id_key",
      type: "unique",
      columns: Object.freeze(["telegram_id"]),
    }),
  ]),
});

const INSPECT_USERS_SQL = `SELECT
  (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'ordinal_position', columns.ordinal_position::text,
          'name', columns.column_name,
          'data_type', columns.data_type,
          'udt_name', columns.udt_name,
          'nullable', columns.is_nullable,
          'default', columns.column_default
        )
        ORDER BY columns.ordinal_position
      ),
      '[]'::jsonb
    )
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'users'
  ) AS columns,
  (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', constraints.constraint_name,
          'type', constraints.constraint_type,
          'columns', constraints.constraint_columns
        )
        ORDER BY constraints.constraint_name
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT
        constraint_row.conname AS constraint_name,
        CASE constraint_row.contype
          WHEN 'p' THEN 'primary_key'
          WHEN 'u' THEN 'unique'
          ELSE constraint_row.contype::text
        END AS constraint_type,
        (
          SELECT pg_catalog.jsonb_agg(attribute.attname ORDER BY key_column.ordinality)
          FROM pg_catalog.unnest(constraint_row.conkey)
            WITH ORDINALITY AS key_column(attnum, ordinality)
          JOIN pg_catalog.pg_attribute AS attribute
            ON attribute.attrelid = constraint_row.conrelid
           AND attribute.attnum = key_column.attnum
        ) AS constraint_columns
      FROM pg_catalog.pg_constraint AS constraint_row
      WHERE constraint_row.conrelid = 'public.users'::regclass
    ) AS constraints
  ) AS constraints,
  pg_catalog.count(*) FILTER (
    WHERE users.id = $1::uuid
      AND users.telegram_id = $2::bigint
  )::text AS exact_pair_count,
  pg_catalog.count(*) FILTER (
    WHERE users.id = $1::uuid
      AND users.telegram_id <> $2::bigint
  )::text AS uuid_conflict_count,
  pg_catalog.count(*) FILTER (
    WHERE users.telegram_id = $2::bigint
      AND users.id <> $1::uuid
  )::text AS telegram_conflict_count,
  pg_catalog.count(*)::text AS relevant_count
FROM public.users AS users
WHERE users.id = $1::uuid
   OR users.telegram_id = $2::bigint`;

const INSERT_PILOT_USER_SQL = `INSERT INTO public.users AS users (id, telegram_id)
VALUES ($1::uuid, $2::bigint)
ON CONFLICT DO NOTHING
RETURNING users.id::text AS user_id`;

export const SEED_FINANCE_PILOT_SQL = Object.freeze({
  inspect: INSPECT_USERS_SQL,
  insert: INSERT_PILOT_USER_SQL,
});

export const SEED_FINANCE_PILOT_SQL_SHA256 = Object.freeze({
  inspect: "2abfc2edc36a01d6d30f87f6eedf356fd6597727d257df514d565c017f6f714b",
  insert: "8144d7d8c053dfe64ebc3872a911d835692df27204589a20f1d18cbac459e779",
});

function refuse(message) {
  throw new Error(`Finance pilot user fixture refused: ${message}`);
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

function exactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) refuse(`${label} keys differ`);
}

function assertPinnedSql() {
  if (
    sha256(SEED_FINANCE_PILOT_SQL.inspect)
      !== SEED_FINANCE_PILOT_SQL_SHA256.inspect
    || sha256(SEED_FINANCE_PILOT_SQL.insert)
      !== SEED_FINANCE_PILOT_SQL_SHA256.insert
    || (SEED_FINANCE_PILOT_SQL.insert.match(/\bINSERT\b/gu) ?? []).length !== 1
    || /(?:\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bMERGE\b)/u
      .test(SEED_FINANCE_PILOT_SQL.insert)
  ) refuse("pinned SQL bytes differ");
}

function parseArguments(argv) {
  if (argv.includes("--help")) return Object.freeze({ help: true });
  const input = {
    apply: false,
    projectRef: null,
    userId: null,
    accessTokenFile: null,
    telegramIdFile: null,
    receiptDir: null,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      if (seen.has(argument)) refuse("duplicate --apply");
      seen.add(argument);
      input.apply = true;
      continue;
    }
    if (![
      "--project-ref",
      "--user-id",
      "--access-token-file",
      "--telegram-id-file",
      "--receipt-dir",
    ].includes(argument)) refuse(`unknown argument ${argument}`);
    if (seen.has(argument)) refuse(`duplicate ${argument}`);
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) refuse(`${argument} requires a value`);
    if (argument === "--project-ref") input.projectRef = value;
    else if (argument === "--user-id") input.userId = value;
    else if (argument === "--access-token-file") input.accessTokenFile = value;
    else if (argument === "--telegram-id-file") input.telegramIdFile = value;
    else input.receiptDir = value;
    index += 1;
  }
  if (!input.projectRef) refuse("--project-ref is required");
  if (!input.userId) refuse("--user-id is required");
  if (!input.accessTokenFile) refuse("--access-token-file is required");
  if (!input.telegramIdFile) refuse("--telegram-id-file is required");
  if (!input.receiptDir) refuse("--receipt-dir is required");
  if (!UUID_V4.test(input.userId)) refuse("--user-id must be lower-case UUIDv4");
  return Object.freeze(input);
}

function assertExactBoundary(projectRef) {
  if (PILOT_USER_BOUNDARY.productionDenyProjectRefs.includes(projectRef)) {
    refuse("target is the exact Main production project ref");
  }
  if (projectRef !== PILOT_USER_BOUNDARY.mainStagingProjectRef) {
    refuse("target is not the exact reviewed data-less Main staging project ref");
  }
}

function assertExternalPrivateDirectory(directory, label) {
  if (
    typeof directory !== "string"
    || !path.isAbsolute(directory)
    || path.resolve(directory) !== directory
  ) refuse(`${label} must be absolute and normalized`);
  let status;
  try {
    status = lstatSync(directory);
  } catch {
    refuse(`${label} is unavailable`);
  }
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || (status.mode & 0o777) !== 0o700
    || realpathSync(directory) !== directory
  ) refuse(`${label} must be a real owner-private mode 0700 directory`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} must be owned by the current user`);
  }
  const relative = path.relative(REPOSITORY_ROOT, directory);
  if (
    relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  ) refuse(`${label} must stay outside the repository`);
  return directory;
}

function readPrivateSingleLine(file, label, maximumBytes) {
  if (
    typeof file !== "string"
    || !path.isAbsolute(file)
    || path.resolve(file) !== file
  ) refuse(`${label} path must be absolute and normalized`);
  const parent = assertExternalPrivateDirectory(
    path.dirname(file),
    `${label} parent directory`,
  );
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
    || status.size < 1
    || status.size > maximumBytes
    || realpathSync(file) !== file
    || path.dirname(file) !== parent
  ) refuse(`${label} must be one owner-private mode 0600 file`);
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} must be owned by the current user`);
  }
  let source;
  try {
    const bytes = readFileSync(file);
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    refuse(`${label} could not be read`);
  }
  const value = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (!value || value.includes("\n") || value.includes("\r") || value.includes("\0")) {
    refuse(`${label} must contain exactly one value`);
  }
  return value;
}

function readAccessToken(file) {
  const token = readPrivateSingleLine(file, "Management access token", 4_097);
  if (!ACCESS_TOKEN.test(token)) refuse("Management access token format differs");
  return token;
}

function readTelegramId(file) {
  const telegramId = readPrivateSingleLine(file, "Telegram ID", 32);
  if (
    !TELEGRAM_ID.test(telegramId)
    || BigInt(telegramId) > MAXIMUM_BIGINT
  ) refuse("Telegram ID format differs");
  return telegramId;
}

async function boundedBody(response) {
  if (!response?.body || typeof response.body[Symbol.asyncIterator] !== "function") {
    refuse("Management API response body differs");
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
          // The size refusal below remains authoritative.
        }
        refuse("Management API response exceeded the byte limit");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Finance pilot user fixture refused:")
    ) throw error;
    refuse("Management API response read failed");
  }
  const bytes = Buffer.concat(chunks.map(chunk =>
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    refuse("Management API response encoding differs");
  }
  if (source.includes("\0")) refuse("Management API response encoding differs");
  return source;
}

async function executeQuery({
  projectRef,
  queryId,
  parameters,
  accessToken,
  fetchImpl,
}) {
  assertExactBoundary(projectRef);
  assertPinnedSql();
  if (!["inspect", "insert"].includes(queryId)) {
    refuse("Management query id differs");
  }
  if (
    !Array.isArray(parameters)
    || parameters.length !== 2
    || !UUID_V4.test(parameters[0])
    || !TELEGRAM_ID.test(parameters[1])
  ) refuse("Management query parameters differ");
  if (!ACCESS_TOKEN.test(accessToken)) refuse("Management access token format differs");
  if (typeof fetchImpl !== "function") refuse("Management fetch dependency differs");
  const suffix = queryId === "inspect"
    ? READ_ONLY_QUERY_SUFFIX
    : MUTATING_QUERY_SUFFIX;
  const url = `${MANAGEMENT_API_ORIGIN}/v1/projects/${projectRef}${suffix}`;
  const body = canonicalJson({
    parameters,
    query: SEED_FINANCE_PILOT_SQL[queryId],
  });
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("query timeout", "TimeoutError")),
    REQUEST_TIMEOUT_MS,
  );
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch {
    refuse(`Management API ${queryId} request failed`);
  } finally {
    clearTimeout(timeout);
  }
  const contentType = response?.headers?.get?.("content-type")?.toLowerCase()
    ?? "";
  if (
    response?.status !== 201
    || response.redirected !== false
    || ![
      "application/json",
      "application/json; charset=utf-8",
    ].includes(contentType)
  ) refuse(`Management API ${queryId} response boundary differs`);
  let parsed;
  try {
    parsed = JSON.parse(await boundedBody(response));
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Finance pilot user fixture refused:")
    ) throw error;
    refuse(`Management API ${queryId} response JSON differs`);
  }
  if (!Array.isArray(parsed)) {
    refuse(`Management API ${queryId} result differs`);
  }
  return parsed;
}

function decimalCount(value, label) {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    refuse(`${label} differs`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) refuse(`${label} exceeds the safe range`);
  return parsed;
}

function validateInspection(rows) {
  if (
    !Array.isArray(rows)
    || rows.length !== 1
    || rows[0] === null
    || typeof rows[0] !== "object"
    || Array.isArray(rows[0])
  ) refuse("users inspection must return exactly one row");
  const row = rows[0];
  exactKeys(row, [
    "columns",
    "constraints",
    "exact_pair_count",
    "uuid_conflict_count",
    "telegram_conflict_count",
    "relevant_count",
  ], "users inspection");
  if (
    canonicalJson(row.columns) !== canonicalJson(EXPECTED_USERS_SCHEMA.columns)
    || canonicalJson(row.constraints)
      !== canonicalJson(EXPECTED_USERS_SCHEMA.constraints)
  ) refuse("public.users schema, defaults or constraints differ");
  const exactPairCount = decimalCount(
    row.exact_pair_count,
    "exact pair count",
  );
  const uuidConflictCount = decimalCount(
    row.uuid_conflict_count,
    "UUID conflict count",
  );
  const telegramConflictCount = decimalCount(
    row.telegram_conflict_count,
    "Telegram conflict count",
  );
  const relevantCount = decimalCount(row.relevant_count, "relevant row count");
  if (
    exactPairCount > 1
    || uuidConflictCount > 1
    || telegramConflictCount > 1
    || relevantCount !== (
      exactPairCount + uuidConflictCount + telegramConflictCount
    )
  ) refuse("public.users uniqueness evidence differs");
  if (uuidConflictCount !== 0 || telegramConflictCount !== 0) {
    refuse("user UUID or Telegram ID conflicts with an existing fixture");
  }
  return Object.freeze({
    exactPairCount,
    relevantCount,
  });
}

function validateInsertResult(rows, userId) {
  if (!Array.isArray(rows) || rows.length > 1) {
    refuse("INSERT result cardinality differs");
  }
  if (rows.length === 0) return false;
  exactKeys(rows[0], ["user_id"], "INSERT result");
  if (rows[0].user_id !== userId) refuse("INSERT returned a different user UUID");
  return true;
}

function canonicalTimestamp(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) refuse("receipt clock differs");
  return value.toISOString();
}

function writeReceipt(receiptDirectory, fields) {
  const core = {
    schemaVersion: 1,
    operation: "seed-finance-pilot-user",
    productionDenied: true,
    schemaSha256: sha256(canonicalJson(EXPECTED_USERS_SCHEMA)),
    inspectSqlSha256: SEED_FINANCE_PILOT_SQL_SHA256.inspect,
    insertSqlSha256: SEED_FINANCE_PILOT_SQL_SHA256.insert,
    ...fields,
  };
  const receipt = {
    ...core,
    receiptSha256: sha256(canonicalJson(core)),
  };
  const stamp = receipt.recordedAt.replaceAll(/[^0-9]/gu, "");
  const file = path.join(
    receiptDirectory,
    `seed-finance-pilot-user-${stamp}-${receipt.mode}-${receipt.userId}.json`,
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
    if (
      !status.isFile()
      || status.nlink !== 1
      || (status.mode & 0o777) !== 0o600
    ) refuse("receipt write boundary differs");
  } catch (error) {
    if (
      error instanceof Error
      && error.message.startsWith("Finance pilot user fixture refused:")
    ) throw error;
    refuse("receipt could not be written");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return Object.freeze({
    file,
    receiptSha256: receipt.receiptSha256,
  });
}

export async function seedFinancePilotUser(argv, {
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const input = parseArguments(argv);
  if (input.help) {
    return Object.freeze({
      ok: true,
      usage: [
        "seed-finance-pilot-user.mjs --project-ref bljeoovhydhjhdzwplxh --user-id UUIDv4 --access-token-file ABS_0600 --telegram-id-file ABS_0600 --receipt-dir ABS_0700",
        "seed-finance-pilot-user.mjs ... --apply",
      ],
    });
  }

  // Boundary validation is deliberately first: production and unknown targets
  // are rejected before token or Telegram ID files are inspected.
  assertExactBoundary(input.projectRef);
  assertPinnedSql();
  const receiptDirectory = assertExternalPrivateDirectory(
    input.receiptDir,
    "receipt directory",
  );
  const token = readAccessToken(input.accessTokenFile);
  const telegramId = readTelegramId(input.telegramIdFile);
  if (realpathSync(input.accessTokenFile) === realpathSync(input.telegramIdFile)) {
    refuse("token and Telegram ID must use separate private files");
  }
  const parameters = [input.userId, telegramId];

  const preflightRows = await executeQuery({
    projectRef: input.projectRef,
    queryId: "inspect",
    parameters,
    accessToken: token,
    fetchImpl,
  });
  const preflight = validateInspection(preflightRows);
  const recordedAt = canonicalTimestamp(now());

  if (!input.apply) {
    const outcome = preflight.exactPairCount === 1
      ? "already_present"
      : "would_insert";
    const written = writeReceipt(receiptDirectory, {
      mode: "dry_run",
      projectRef: input.projectRef,
      userId: input.userId,
      outcome,
      hostedReadCount: 1,
      hostedMutationCount: 0,
      fixtureRetained: preflight.exactPairCount === 1,
      recordedAt,
    });
    return Object.freeze({
      ok: true,
      mode: "dry_run",
      project_ref: input.projectRef,
      user_id: input.userId,
      outcome,
      hosted_read_count: 1,
      hosted_mutation_count: 0,
      receipt_file: written.file,
      receipt_sha256: written.receiptSha256,
    });
  }

  let insertRows;
  try {
    insertRows = await executeQuery({
      projectRef: input.projectRef,
      queryId: "insert",
      parameters,
      accessToken: token,
      fetchImpl,
    });
  } catch {
    refuse(
      "hosted INSERT outcome is unknown; run default read-only preflight before any retry",
    );
  }
  const inserted = validateInsertResult(insertRows, input.userId);

  let postflight;
  try {
    postflight = validateInspection(await executeQuery({
      projectRef: input.projectRef,
      queryId: "inspect",
      parameters,
      accessToken: token,
      fetchImpl,
    }));
  } catch {
    refuse(
      "hosted INSERT completed but postflight is unknown; run default read-only preflight",
    );
  }
  if (postflight.exactPairCount !== 1 || postflight.relevantCount !== 1) {
    refuse("postflight did not prove the exact retained pilot fixture");
  }
  if (inserted && preflight.exactPairCount !== 0) {
    refuse("INSERT result conflicts with preflight idempotency evidence");
  }

  const outcome = inserted ? "inserted" : "already_present";
  const written = writeReceipt(receiptDirectory, {
    mode: "applied",
    projectRef: input.projectRef,
    userId: input.userId,
    outcome,
    hostedReadCount: 2,
    hostedMutationCount: 1,
    fixtureRetained: true,
    recordedAt,
  });
  return Object.freeze({
    ok: true,
    mode: "applied",
    project_ref: input.projectRef,
    user_id: input.userId,
    outcome,
    hosted_read_count: 2,
    hosted_mutation_count: 1,
    fixture_retained: true,
    receipt_file: written.file,
    receipt_sha256: written.receiptSha256,
  });
}

async function main() {
  const result = await seedFinancePilotUser(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(error => {
    process.stderr.write(`Finance pilot user fixture failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
