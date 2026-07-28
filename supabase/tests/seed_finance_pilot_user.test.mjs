import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  SEED_FINANCE_PILOT_SQL,
  SEED_FINANCE_PILOT_SQL_SHA256,
  seedFinancePilotUser,
} from "../../scripts/seed-finance-pilot-user.mjs";

const STAGING_REF = "bljeoovhydhjhdzwplxh";
const PRODUCTION_REF = "soxtekhspohkddpdidvp";
const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TELEGRAM_ID = "987654321";
const ACCESS_TOKEN = "sbp_fixture_management_access_token_0123456789";
const RECORDED_AT = "2026-07-29T00:00:00.000Z";
const INSPECT_SHA256 =
  "bfc22cb081b00618dc9a2437cfa1ab1abd9776243b2bee500bca6b263ecb2b57";
const INSERT_SHA256 =
  "8144d7d8c053dfe64ebc3872a911d835692df27204589a20f1d18cbac459e779";

const EXACT_COLUMNS = [
  {
    ordinal_position: "1",
    name: "id",
    data_type: "uuid",
    udt_name: "uuid",
    nullable: "NO",
    default: "gen_random_uuid()",
  },
  {
    ordinal_position: "2",
    name: "telegram_id",
    data_type: "bigint",
    udt_name: "int8",
    nullable: "NO",
    default: null,
  },
  {
    ordinal_position: "3",
    name: "username",
    data_type: "text",
    udt_name: "text",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "4",
    name: "first_name",
    data_type: "text",
    udt_name: "text",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "5",
    name: "last_name",
    data_type: "text",
    udt_name: "text",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "6",
    name: "photo_url",
    data_type: "text",
    udt_name: "text",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "7",
    name: "role",
    data_type: "text",
    udt_name: "text",
    nullable: "NO",
    default: "'student'::text",
  },
  {
    ordinal_position: "8",
    name: "access_status",
    data_type: "text",
    udt_name: "text",
    nullable: "NO",
    default: "'unknown'::text",
  },
  {
    ordinal_position: "9",
    name: "manual_access_until",
    data_type: "timestamp with time zone",
    udt_name: "timestamptz",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "10",
    name: "last_seen_at",
    data_type: "timestamp with time zone",
    udt_name: "timestamptz",
    nullable: "YES",
    default: null,
  },
  {
    ordinal_position: "11",
    name: "created_at",
    data_type: "timestamp with time zone",
    udt_name: "timestamptz",
    nullable: "NO",
    default: "now()",
  },
];

const EXACT_CONSTRAINTS = [
  {
    name: "users_pkey",
    type: "primary_key",
    columns: ["id"],
  },
  {
    name: "users_telegram_id_key",
    type: "unique",
    columns: ["telegram_id"],
  },
];

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function temporaryDirectory(t, prefix) {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return realpathSync(directory);
}

function privateFile(directory, name, value) {
  const file = path.join(directory, name);
  writeFileSync(file, value, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

function operatorFiles(t) {
  const inputDirectory = temporaryDirectory(t, "pilot-user-input-");
  const receiptDirectory = temporaryDirectory(t, "pilot-user-receipts-");
  return {
    accessTokenFile: privateFile(
      inputDirectory,
      "management-access-token",
      `${ACCESS_TOKEN}\n`,
    ),
    telegramIdFile: privateFile(
      inputDirectory,
      "owner-telegram-id",
      `${TELEGRAM_ID}\n`,
    ),
    receiptDirectory,
  };
}

function argv(files, extra = []) {
  return [
    "--project-ref", STAGING_REF,
    "--user-id", USER_ID,
    "--access-token-file", files.accessTokenFile,
    "--telegram-id-file", files.telegramIdFile,
    "--receipt-dir", files.receiptDirectory,
    ...extra,
  ];
}

function inspection({
  exactPairCount = "0",
  uuidConflictCount = "0",
  telegramConflictCount = "0",
  relevantCount = "0",
  columns = EXACT_COLUMNS,
  constraints = EXACT_CONSTRAINTS,
} = {}) {
  return [{
    columns,
    constraints,
    exact_pair_count: exactPairCount,
    uuid_conflict_count: uuidConflictCount,
    telegram_conflict_count: telegramConflictCount,
    relevant_count: relevantCount,
  }];
}

function response(rows, status = 201) {
  return new Response(JSON.stringify(rows), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function managementMock(queue) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      if (queue.length === 0) throw new Error("unexpected Management API call");
      const next = queue.shift();
      return typeof next === "function" ? next(url, options) : next;
    },
  };
}

function readReceipt(result) {
  const source = readFileSync(result.receipt_file, "utf8");
  const parsed = JSON.parse(source);
  return { source, parsed };
}

function assertNoPrivateValue(value) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  assert.doesNotMatch(source, new RegExp(TELEGRAM_ID, "u"));
  assert.doesNotMatch(source, new RegExp(ACCESS_TOKEN, "u"));
}

test("SQL bytes are independently pinned and mutation contains exactly one INSERT", () => {
  assert.equal(sha256(SEED_FINANCE_PILOT_SQL.inspect), INSPECT_SHA256);
  assert.equal(sha256(SEED_FINANCE_PILOT_SQL.insert), INSERT_SHA256);
  assert.deepEqual(SEED_FINANCE_PILOT_SQL_SHA256, {
    inspect: INSPECT_SHA256,
    insert: INSERT_SHA256,
  });
  assert.equal(
    (SEED_FINANCE_PILOT_SQL.insert.match(/\bINSERT\b/gu) ?? []).length,
    1,
  );
  assert.match(
    SEED_FINANCE_PILOT_SQL.insert,
    /^INSERT INTO public\.users AS users \(id, telegram_id\)/u,
  );
  assert.match(SEED_FINANCE_PILOT_SQL.insert, /ON CONFLICT DO NOTHING/u);
  assert.doesNotMatch(
    SEED_FINANCE_PILOT_SQL.insert,
    /(?:\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bMERGE\b)/u,
  );
  assert.match(SEED_FINANCE_PILOT_SQL.inspect, /information_schema\.columns/u);
  assert.match(SEED_FINANCE_PILOT_SQL.inspect, /pg_catalog\.pg_constraint/u);
});

test("production and unknown targets are denied before private files or fetch are touched", async () => {
  let calls = 0;
  const missing = "/private/tmp/fixture-file-must-not-be-read";
  const base = [
    "--user-id", USER_ID,
    "--access-token-file", missing,
    "--telegram-id-file", missing,
    "--receipt-dir", missing,
  ];
  await assert.rejects(
    seedFinancePilotUser(
      ["--project-ref", PRODUCTION_REF, ...base],
      { fetchImpl: async () => { calls += 1; } },
    ),
    /exact Main production project ref/,
  );
  await assert.rejects(
    seedFinancePilotUser(
      ["--project-ref", "abcdefghijklmnopqrst", ...base],
      { fetchImpl: async () => { calls += 1; } },
    ),
    /not the exact reviewed data-less Main staging project ref/,
  );
  assert.equal(calls, 0);
});

test("default mode performs one read-only preflight and writes a private clean receipt", async t => {
  const files = operatorFiles(t);
  const mock = managementMock([response(inspection())]);
  const result = await seedFinancePilotUser(argv(files), {
    fetchImpl: mock.fetchImpl,
    now: () => new Date(RECORDED_AT),
  });

  assert.equal(result.mode, "dry_run");
  assert.equal(result.outcome, "would_insert");
  assert.equal(result.user_id, USER_ID);
  assert.equal(result.hosted_read_count, 1);
  assert.equal(result.hosted_mutation_count, 0);
  assert.equal(mock.calls.length, 1);
  assert.equal(
    mock.calls[0].url,
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query/read-only`,
  );
  assert.equal(mock.calls[0].options.method, "POST");
  assert.equal(mock.calls[0].options.redirect, "error");
  assert.equal(
    mock.calls[0].options.headers.Authorization,
    `Bearer ${ACCESS_TOKEN}`,
  );
  assert.equal(mock.calls[0].body.query, SEED_FINANCE_PILOT_SQL.inspect);
  assert.deepEqual(mock.calls[0].body.parameters, [USER_ID, TELEGRAM_ID]);

  assert.equal(existsSync(result.receipt_file), true);
  assert.equal(lstatSync(result.receipt_file).mode & 0o777, 0o600);
  const receipt = readReceipt(result);
  assert.equal(receipt.parsed.userId, USER_ID);
  assert.equal(receipt.parsed.outcome, "would_insert");
  assert.equal(receipt.parsed.hostedMutationCount, 0);
  const { receiptSha256, ...core } = receipt.parsed;
  assert.equal(receiptSha256, sha256(canonicalJson(core)));
  assert.equal(result.receipt_sha256, receiptSha256);
  assertNoPrivateValue(result);
  assertNoPrivateValue(receipt.source);
});

test("dry-run reports an exact existing fixture without mutation or deletion", async t => {
  const files = operatorFiles(t);
  const mock = managementMock([response(inspection({
    exactPairCount: "1",
    relevantCount: "1",
  }))]);
  const result = await seedFinancePilotUser(argv(files), {
    fetchImpl: mock.fetchImpl,
    now: () => new Date(RECORDED_AT),
  });
  assert.equal(result.outcome, "already_present");
  assert.equal(mock.calls.length, 1);
  assert.equal(existsSync(result.receipt_file), true);
  assert.equal(readReceipt(result).parsed.fixtureRetained, true);
});

test("apply executes one exact INSERT and proves the retained row by read-only postflight", async t => {
  const files = operatorFiles(t);
  const mock = managementMock([
    response(inspection()),
    response([{ user_id: USER_ID }]),
    response(inspection({
      exactPairCount: "1",
      relevantCount: "1",
    })),
  ]);
  const result = await seedFinancePilotUser(argv(files, ["--apply"]), {
    fetchImpl: mock.fetchImpl,
    now: () => new Date(RECORDED_AT),
  });

  assert.equal(result.mode, "applied");
  assert.equal(result.outcome, "inserted");
  assert.equal(result.hosted_read_count, 2);
  assert.equal(result.hosted_mutation_count, 1);
  assert.equal(result.fixture_retained, true);
  assert.deepEqual(mock.calls.map(call => call.url), [
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query/read-only`,
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query/read-only`,
  ]);
  assert.equal(
    mock.calls.filter(call => call.body.query === SEED_FINANCE_PILOT_SQL.insert)
      .length,
    1,
  );
  assert.equal(
    mock.calls.filter(call => call.url.endsWith("/database/query")).length,
    1,
  );
  const receipt = readReceipt(result);
  assert.equal(receipt.parsed.outcome, "inserted");
  assert.equal(receipt.parsed.hostedMutationCount, 1);
  assert.equal(receipt.parsed.fixtureRetained, true);
  assertNoPrivateValue(result);
  assertNoPrivateValue(receipt.source);
});

test("apply remains idempotent while still issuing exactly one INSERT statement", async t => {
  const files = operatorFiles(t);
  const exact = inspection({
    exactPairCount: "1",
    relevantCount: "1",
  });
  const mock = managementMock([
    response(exact),
    response([]),
    response(exact),
  ]);
  const result = await seedFinancePilotUser(argv(files, ["--apply"]), {
    fetchImpl: mock.fetchImpl,
    now: () => new Date(RECORDED_AT),
  });
  assert.equal(result.outcome, "already_present");
  assert.equal(result.hosted_mutation_count, 1);
  assert.equal(
    mock.calls.filter(call => call.body.query === SEED_FINANCE_PILOT_SQL.insert)
      .length,
    1,
  );
});

test("UUID and Telegram conflicts fail closed before INSERT", async t => {
  for (const conflicting of [
    inspection({ uuidConflictCount: "1", relevantCount: "1" }),
    inspection({ telegramConflictCount: "1", relevantCount: "1" }),
  ]) {
    const files = operatorFiles(t);
    const mock = managementMock([response(conflicting)]);
    await assert.rejects(
      seedFinancePilotUser(argv(files, ["--apply"]), {
        fetchImpl: mock.fetchImpl,
      }),
      /UUID or Telegram ID conflicts/,
    );
    assert.equal(mock.calls.length, 1);
    assert.equal(
      mock.calls.some(call => call.url.endsWith("/database/query")),
      false,
    );
  }
});

test("schema, defaults and constraints must match the live reviewed shape exactly", async t => {
  const mismatches = [
    inspection({
      columns: EXACT_COLUMNS.map(column => column.name === "role"
        ? { ...column, default: "'owner'::text" }
        : column),
    }),
    inspection({
      constraints: [
        ...EXACT_CONSTRAINTS,
        { name: "unexpected_check", type: "c", columns: ["role"] },
      ],
    }),
  ];
  for (const rows of mismatches) {
    const files = operatorFiles(t);
    const mock = managementMock([response(rows)]);
    await assert.rejects(
      seedFinancePilotUser(argv(files, ["--apply"]), {
        fetchImpl: mock.fetchImpl,
      }),
      /schema, defaults or constraints differ/,
    );
    assert.equal(mock.calls.length, 1);
  }
});

test("postflight must prove the exact row after the single INSERT", async t => {
  const files = operatorFiles(t);
  const mock = managementMock([
    response(inspection()),
    response([{ user_id: USER_ID }]),
    response(inspection()),
  ]);
  await assert.rejects(
    seedFinancePilotUser(argv(files, ["--apply"]), {
      fetchImpl: mock.fetchImpl,
    }),
    /postflight did not prove the exact retained pilot fixture/,
  );
  assert.equal(
    mock.calls.filter(call => call.url.endsWith("/database/query")).length,
    1,
  );
});

test("private file and directory boundaries are enforced before fetch", async t => {
  const files = operatorFiles(t);
  chmodSync(files.telegramIdFile, 0o644);
  let calls = 0;
  await assert.rejects(
    seedFinancePilotUser(argv(files), {
      fetchImpl: async () => { calls += 1; },
    }),
    /Telegram ID must be one owner-private mode 0600 file/,
  );
  assert.equal(calls, 0);

  chmodSync(files.telegramIdFile, 0o600);
  chmodSync(files.receiptDirectory, 0o755);
  await assert.rejects(
    seedFinancePilotUser(argv(files), {
      fetchImpl: async () => { calls += 1; },
    }),
    /receipt directory must be a real owner-private mode 0700 directory/,
  );
  assert.equal(calls, 0);
});

test("Management failures with secret-shaped response bodies are withheld", async t => {
  const files = operatorFiles(t);
  const mock = managementMock([
    response({
      error: `${ACCESS_TOKEN}:${TELEGRAM_ID}`,
    }, 500),
  ]);
  await assert.rejects(
    seedFinancePilotUser(argv(files), {
      fetchImpl: mock.fetchImpl,
    }),
    error => {
      assert.match(error.message, /response boundary differs/);
      assertNoPrivateValue(error.message);
      return true;
    },
  );
});
