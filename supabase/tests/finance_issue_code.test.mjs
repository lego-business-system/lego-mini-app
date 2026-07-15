import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFinanceCanonicalRequest,
  buildFinanceIssuerBody,
  canonicalIssueRequestBody,
  constantTimeHexEqual,
  deriveFinanceNonce,
  derivePrivateDigest,
  hmacSha256Hex,
  parseAllowedOrigins,
  parseCanonicalIssueRequestBytes,
  sha256Hex,
  signFinanceCanonicalRequest,
  validateFinanceEndpoint,
  validateFinanceSuccess,
  validateIssueRequestBody,
  validateTelegramInitData,
} from "../functions/_shared/main-finance-protocol.mjs";

const BOT_TOKEN = "123456789:abcdefghijklmnopqrstuvwxyzABCDE_123456";
const PRIVACY_KEY = "privacy-key-0123456789abcdef-0123456789abcdef";
const NONCE_KEY = "nonce-key-0123456789abcdef-0123456789abcdef";
const ISSUER_KEY = "issuer-key-0123456789abcdef-0123456789abcdef";
const REQUEST_ID = "018f1f3a-7b6a-4a7d-87e0-4fe2d24739c3";
const NOW_SECONDS = 1_784_040_000;
const encoder = new TextEncoder();

function signedInitData({
  authDate = NOW_SECONDS,
  user = { id: 123456789, first_name: "Test" },
  extra = [],
} = {}) {
  const fields = [
    ["query_id", "AAHdF6IQAAAAAN0XohDhrOrc"],
    ["user", JSON.stringify(user)],
    ["auth_date", String(authDate)],
    ...extra,
  ];
  const dataCheckString = [...fields]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
  const telegramSecret = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", telegramSecret)
    .update(dataCheckString)
    .digest("hex");
  return new URLSearchParams([...fields, ["hash", hash]]).toString();
}

const edge = readFileSync("supabase/functions/finance-issue-code/index.ts", "utf8");
const runtime = readFileSync("supabase/functions/_shared/main-edge-runtime.ts", "utf8");
const protocol = readFileSync(
  "supabase/functions/_shared/main-finance-protocol.mjs",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260714235900_finance_integration_foundation.sql",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const denoConfig = readFileSync(
  "supabase/functions/finance-issue-code/deno.json",
  "utf8",
);
const denoLockPath = "supabase/functions/finance-issue-code/deno.lock";
const denoLockSource = readFileSync(denoLockPath, "utf8");
const denoLock = JSON.parse(denoLockSource);
const envExample = readFileSync("supabase/functions/.env.example", "utf8");
const edgeReadme = readFileSync("supabase/functions/README.md", "utf8");
const app = readFileSync("app.js", "utf8");
const html = readFileSync("index.html", "utf8");
const financeUi = readFileSync("architecture-finance.js", "utf8");
const financeUiConfig = readFileSync("architecture-finance-config.js", "utf8");

test("official Telegram HMAC validation returns string identity and verified replay key", async () => {
  const initData = signedInitData();
  const initDataHash = new URLSearchParams(initData).get("hash");
  const result = await validateTelegramInitData({
    initData,
    botToken: BOT_TOKEN,
    nowMilliseconds: NOW_SECONDS * 1_000,
    maxAgeSeconds: 300,
    maxFutureSkewSeconds: 15,
  });
  assert.deepEqual(result, {
    telegramId: "123456789",
    authDate: NOW_SECONDS,
    initDataHash,
  });
  assert.equal(typeof result.telegramId, "string");

  const fields = new URLSearchParams(initData);
  const suppliedHash = fields.get("hash");
  fields.delete("hash");
  const independentCheck = [...fields.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
  const independentSecret = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  assert.equal(
    suppliedHash,
    createHmac("sha256", independentSecret).update(independentCheck).digest("hex"),
  );

  const signedWithTelegramSignature = signedInitData({
    extra: [["signature", "bWluaS1hcHAtc2lnbmF0dXJl"]],
  });
  assert.deepEqual(await validateTelegramInitData({
    initData: signedWithTelegramSignature,
    botToken: BOT_TOKEN,
    nowMilliseconds: NOW_SECONDS * 1_000,
    maxAgeSeconds: 300,
    maxFutureSkewSeconds: 15,
  }), {
    telegramId: "123456789",
    authDate: NOW_SECONDS,
    initDataHash: new URLSearchParams(signedWithTelegramSignature).get("hash"),
  });
});

test("Telegram replay identity survives field order and equivalent percent encoding", async () => {
  const original = signedInitData();
  const reordered = new URLSearchParams(
    [...new URLSearchParams(original).entries()].reverse(),
  ).toString();
  const equivalentEncoding = original.replace("%7B", "%7b");
  assert.notEqual(reordered, original);
  assert.notEqual(equivalentEncoding, original);

  const verified = await Promise.all(
    [original, reordered, equivalentEncoding].map((initData) =>
      validateTelegramInitData({
        initData,
        botToken: BOT_TOKEN,
        nowMilliseconds: NOW_SECONDS * 1_000,
        maxAgeSeconds: 300,
        maxFutureSkewSeconds: 15,
      })
    ),
  );
  assert.equal(new Set(verified.map((item) => item.initDataHash)).size, 1);
  const replayDigests = await Promise.all(verified.map((item) =>
    derivePrivateDigest(
      PRIVACY_KEY,
      "main-telegram-init-data-hash-v1",
      item.initDataHash,
    )
  ));
  assert.equal(new Set(replayDigests).size, 1);
});

test("Telegram tampering, staleness, future dates and replay-shaped fields fail closed", async () => {
  const valid = signedInitData();
  const tampered = new URLSearchParams(valid);
  tampered.set("user", JSON.stringify({ id: 987654321, first_name: "Test" }));

  for (const initData of [
    tampered.toString(),
    signedInitData({ authDate: NOW_SECONDS - 301 }),
    signedInitData({ authDate: NOW_SECONDS + 16 }),
    signedInitData({ extra: [["start_param", "line\nbreak"]] }),
    `${valid}&auth_date=${NOW_SECONDS}`,
    `${valid}&bad=%ZZ`,
  ]) {
    await assert.rejects(() => validateTelegramInitData({
      initData,
      botToken: BOT_TOKEN,
      nowMilliseconds: NOW_SECONDS * 1_000,
      maxAgeSeconds: 300,
      maxFutureSkewSeconds: 15,
    }));
  }

  await assert.rejects(() => validateTelegramInitData({
    initData: signedInitData({ user: { id: "123456789" } }),
    botToken: BOT_TOKEN,
    nowMilliseconds: NOW_SECONDS * 1_000,
    maxAgeSeconds: 300,
    maxFutureSkewSeconds: 15,
  }));
});

test("browser JSON is canonical, exact and cannot inject identity or product", () => {
  const initData = signedInitData();
  const canonical = canonicalIssueRequestBody({
    init_data: initData,
    request_id: REQUEST_ID,
  });
  assert.deepEqual(parseCanonicalIssueRequestBytes(canonical), {
    initData,
    requestId: REQUEST_ID,
  });
  assert.deepEqual(
    validateIssueRequestBody({ init_data: initData, request_id: REQUEST_ID }),
    { initData, requestId: REQUEST_ID },
  );

  for (const source of [
    `{"request_id":"${REQUEST_ID}","init_data":${JSON.stringify(initData)}}`,
    `{ "init_data":${JSON.stringify(initData)},"request_id":"${REQUEST_ID}"}`,
    `{"init_data":${JSON.stringify(initData)},"request_id":"${REQUEST_ID}","telegram_id":"123456789"}`,
    `{"init_data":${JSON.stringify(initData)},"request_id":"${REQUEST_ID}","product_code":"architecture_finance"}`,
    `{"init_data":${JSON.stringify(initData)},"request_id":"${REQUEST_ID}","request_id":"${REQUEST_ID}"}`,
  ]) {
    assert.throws(() => parseCanonicalIssueRequestBytes(encoder.encode(source)));
  }
});

test("private digests and deterministic nonce match independent Node HMAC", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const expectedDigest = createHmac("sha256", PRIVACY_KEY)
    .update("main-telegram-subject-v1\n123456789")
    .digest("hex");
  assert.equal(
    await derivePrivateDigest(PRIVACY_KEY, "main-telegram-subject-v1", "123456789"),
    expectedDigest,
  );
  const expectedNonce = createHmac("sha256", NONCE_KEY)
    .update(`main-finance-network-nonce-v1\n${REQUEST_ID}`)
    .digest("hex");
  assert.equal(await deriveFinanceNonce(NONCE_KEY, REQUEST_ID), expectedNonce);
  assert.equal(await deriveFinanceNonce(NONCE_KEY, REQUEST_ID), expectedNonce);
  assert.equal(constantTimeHexEqual(expectedDigest, expectedDigest), true);
  assert.equal(constantTimeHexEqual(expectedDigest, `${expectedDigest.slice(0, -1)}0`), false);
});

test("Finance bytes, canonical request and v1 signature exactly match its contract", async () => {
  const body = buildFinanceIssuerBody("123456789", "architecture_finance");
  assert.equal(
    new TextDecoder().decode(body),
    '{"telegram_id":"123456789","product_code":"architecture_finance"}',
  );
  const bodyHash = await sha256Hex(body);
  const nonce = await deriveFinanceNonce(NONCE_KEY, REQUEST_ID);
  const canonical = buildFinanceCanonicalRequest({
    method: "POST",
    path: "/functions/v1/finance-issue-telegram-code",
    timestamp: String(NOW_SECONDS),
    nonce,
    requestId: REQUEST_ID,
    bodySha256: bodyHash,
  });
  assert.equal(canonical, [
    "POST",
    "/functions/v1/finance-issue-telegram-code",
    String(NOW_SECONDS),
    nonce,
    REQUEST_ID,
    bodyHash,
  ].join("\n"));
  const independent = createHmac("sha256", ISSUER_KEY)
    .update(canonical)
    .digest("hex");
  assert.equal(
    await signFinanceCanonicalRequest(ISSUER_KEY, canonical),
    `v1=${independent}`,
  );
  assert.equal(await hmacSha256Hex(ISSUER_KEY, canonical), independent);
});

test("origins, Finance URL and Finance response are exact", () => {
  assert.deepEqual(
    [...parseAllowedOrigins("https://main.example, http://localhost:4173")],
    ["https://main.example", "http://localhost:4173"],
  );
  for (const invalid of [
    "*",
    "https://main.example/",
    "https://main.example/path",
    "http://main.example",
  ]) {
    assert.throws(() => parseAllowedOrigins(invalid));
  }
  assert.equal(
    validateFinanceEndpoint(
      "https://finance.example/functions/v1/finance-issue-telegram-code",
      "/functions/v1/finance-issue-telegram-code",
    ),
    "https://finance.example/functions/v1/finance-issue-telegram-code",
  );
  for (const invalid of [
    "http://finance.example/functions/v1/finance-issue-telegram-code",
    "https://finance.example/functions/v1/finance-issue-telegram-code?x=1",
    "https://user@finance.example/functions/v1/finance-issue-telegram-code",
  ]) {
    assert.throws(() => validateFinanceEndpoint(
      invalid,
      "/functions/v1/finance-issue-telegram-code",
    ));
  }

  assert.deepEqual(validateFinanceSuccess({
    ok: true,
    code: "4829 1376",
    expires_at: new Date(NOW_SECONDS * 1_000 + 300_000).toISOString(),
    replayed: false,
    request_id: REQUEST_ID,
  }, REQUEST_ID, NOW_SECONDS * 1_000), {
    code: "4829 1376",
    expiresAt: new Date(NOW_SECONDS * 1_000 + 300_000).toISOString(),
    replayed: false,
    requestId: REQUEST_ID,
  });
  assert.throws(() => validateFinanceSuccess({
    ok: true,
    code: "48291376",
    expires_at: new Date(NOW_SECONDS * 1_000 + 300_000).toISOString(),
    replayed: false,
    request_id: REQUEST_ID,
  }, REQUEST_ID, NOW_SECONDS * 1_000));
});

test("Edge trust boundaries validate Telegram and entitlement before Finance", () => {
  assert.match(config, /\[functions\.finance-issue-code\]\s*\nverify_jwt = false/);
  assert.match(edge, /await validateTelegramInitData/);
  assert.match(edge, /architecture_begin_finance_issue_internal/);
  assert.match(edge, /architecture_finish_finance_issue_internal/);
  assert.match(edge, /buildFinanceCanonicalRequest/);
  assert.match(edge, /signFinanceCanonicalRequest/);
  assert.match(edge, /env\("MAIN_FINANCE_PROTOCOL_MODE"\) !== "enabled"/);
  assert.match(envExample, /^MAIN_FINANCE_PROTOCOL_MODE=disabled$/m);
  assert.match(edge, /MAIN_FINANCE_TOTAL_TIMEOUT_MS[\s\S]*?24_000[\s\S]*?25_000/);
  assert.ok((edge.match(/timeoutWithinDeadline\(/g) || []).length >= 5);
  assert.match(edge, /const finished = await finish\([\s\S]*?if \(!finished\) return unavailable\(origin\)/);
  assert.match(runtime, /redirect: "error"/);
  assert.match(runtime, /request\.headers\.has\("cookie"\)/);
  assert.match(runtime, /request\.headers\.has\("authorization"\)/);
  assert.match(runtime, /"Access-Control-Allow-Origin": origin/);
  assert.doesNotMatch(runtime, /"Access-Control-Allow-Origin":\s*"\*"/);
  assert.ok(
    edge.indexOf("await validateTelegramInitData") <
      edge.indexOf("architecture_begin_finance_issue_internal"),
  );
  assert.ok(
    edge.indexOf("architecture_begin_finance_issue_internal") <
      edge.indexOf("await fetchBounded"),
  );
  assert.doesNotMatch(edge, /initDataUnsafe/);
  assert.doesNotMatch(edge, /body\.(?:telegram_id|product_code|user_id)/);
  assert.match(edge, /EXPECTED_PRODUCT = "architecture_finance"/);
  assert.match(edge, /DATABASE_MAX_REPLAY_WINDOW_SECONDS = 15 \* 60/);
  assert.match(edge, /MAX_TELEGRAM_INIT_DATA_AGE_SECONDS = 780/);
  assert.match(edge, /MAX_TELEGRAM_FUTURE_SKEW_SECONDS = 60/);
  assert.match(
    edge,
    /replayWindowSeconds = telegramMaxAge \+ telegramFutureSkew \+[\s\S]*?REPLAY_EXPIRY_SAFETY_SECONDS[\s\S]*?replayWindowSeconds > DATABASE_MAX_REPLAY_WINDOW_SECONDS/,
  );
  assert.match(envExample, /780 \+ 60 \+ 60/);
  assert.match(edgeReadme, /максимумами 780 и 60 секунд[\s\S]*?не больше 15 минут/);
  assert.match(edge, /"main-telegram-init-data-hash-v1"[\s\S]*?telegram\.initDataHash/);
  assert.doesNotMatch(edge, /"main-telegram-init-data-v1"/);
});

test("migration is service-only, pseudonymous and leaves existing access untouched", () => {
  assert.match(migration, /^-- DRAFT \/ NOT APPLIED \/ STAGING ONLY$/m);
  assert.equal((migration.match(/^BEGIN;$/gm) || []).length, 1);
  assert.equal((migration.match(/^COMMIT;$/gm) || []).length, 1);
  for (const table of [
    "architecture_product_entitlements",
    "architecture_finance_issue_requests",
    "architecture_finance_issue_replay_guard",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE public\\.${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.doesNotMatch(migration, /CREATE (?:TABLE|INDEX) IF NOT EXISTS/);
  assert.match(migration, /v_table_count <> 0/);
  assert.match(migration, /v_function_count <> 0/);
  assert.match(migration, /octet_length\(subject_digest\) = 32/);
  assert.match(migration, /octet_length\(init_data_digest\) = 32/);
  assert.match(migration, /architecture_finance_issue_replay_guard_pkey/);
  assert.match(migration, /architecture_finance_issue_replay_guard_nonce_unique/);
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(migration, /to_regprocedure\('auth\.role\(\)'\)/);
  assert.match(migration, /status IN \('active', 'trial', 'manual'\)/);
  assert.match(migration, /product_code = 'architecture_finance'/);
  assert.match(migration, /p_status IS NULL[\s\S]*?p_status NOT IN/);
  assert.match(migration, /attempt_count BETWEEN 1 AND 5/);
  assert.match(
    migration,
    /hashtextextended\(encode\(p_subject_digest, 'hex'\), 7401003\)[\s\S]*?v_request\.attempt_count >= 5[\s\S]*?interval '1 second'[\s\S]*?attempt_count = attempt_count \+ 1,[\s\S]*?updated_at = clock_timestamp\(\)/,
  );
  assert.match(
    migration,
    /recent_request\.subject_digest = p_subject_digest[\s\S]*?interval '10 minutes'[\s\S]*?v_recent_subject_requests >= 3/,
  );
  assert.match(
    migration,
    /CREATE FUNCTION public\.architecture_finish_finance_issue_internal[\s\S]*?IF p_outcome = 'succeeded' THEN[\s\S]*?FROM public\.architecture_product_entitlements[\s\S]*?FOR UPDATE;[\s\S]*?'access_denied'/,
  );
  assert.match(migration, /DO \$acl_hardening\$[\s\S]*?pg_catalog\.aclexplode\(relation\.relacl\)/);
  assert.match(migration, /pg_catalog\.aclexplode\(attribute\.attacl\)/);
  assert.match(migration, /pg_catalog\.aclexplode\(procedure\.proacl\)/);
  assert.match(migration, /table or column ACL allow-list is not empty/);
  assert.match(migration, /exact function ACL allow-list differs/);
  assert.match(
    migration,
    /REVOKE ALL[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/,
  );
  assert.doesNotMatch(migration, /\btelegram_id\b/);
  assert.doesNotMatch(migration, /ALTER TABLE (?:ONLY )?public\.users/);
  assert.doesNotMatch(migration, /CREATE(?: OR REPLACE)? FUNCTION public\.check[-_]access/i);
});

test("dependencies are exact, examples contain no secrets and frontend is fail-closed", () => {
  assert.match(denoConfig, /npm:@supabase\/supabase-js@2\.106\.2/);
  assert.doesNotMatch(denoConfig, /@latest|@\^|@~/);
  assert.deepEqual(JSON.parse(denoConfig).lock, {
    path: "./deno.lock",
    frozen: true,
  });
  const lockStatus = lstatSync(denoLockPath);
  assert.equal(lockStatus.isFile(), true);
  assert.equal(lockStatus.isSymbolicLink(), false);
  assert.equal(denoLock.version, "5");
  assert.equal(
    denoLock.specifiers["npm:@supabase/supabase-js@2.106.2"],
    "2.106.2",
  );
  assert.equal(Object.keys(denoLock.npm).length, 9);
  for (const [packageName, metadata] of Object.entries(denoLock.npm)) {
    assert.match(packageName, /@\d/);
    assert.match(metadata.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  }
  assert.equal(
    createHash("sha256").update(denoLockSource).digest("hex"),
    "5e322322c36ec504c98691cbea052a618d969d627ffcc21f89a5a440d61077eb",
  );
  for (const source of [edge, runtime, protocol]) {
    assert.doesNotMatch(source, /console\.(?:log|info|warn|error|debug)/);
    assert.doesNotMatch(source, /error\.(?:message|details|hint|stack)/);
  }
  for (const secretName of [
    "TELEGRAM_BOT_TOKEN",
    "MAIN_FINANCE_PRIVACY_HMAC_KEY",
    "MAIN_FINANCE_NONCE_DERIVATION_KEY",
    "MAIN_FINANCE_ISSUER_HMAC_SECRET",
  ]) {
    assert.match(envExample, new RegExp(`^${secretName}=$`, "m"));
  }
  assert.match(edgeReadme, /рабочей ветке/);
  assert.match(edgeReadme, /[Ии]нтерфейс.*feature gate/s);
  assert.doesNotMatch(app, /finance-issue-code/);
  assert.match(html, /architecture-finance-config\.js[\s\S]*architecture-finance\.js/);
  assert.match(financeUiConfig, /enabled:\s*false/);
  assert.match(financeUiConfig, /financeWebUrl:\s*""/);
  assert.match(
    financeUiConfig,
    /https:\/\/soxtekhspohkddpdidvp\.supabase\.co\/functions\/v1\/finance-issue-code/,
  );
  assert.doesNotMatch(financeUi, /(?:localStorage|sessionStorage)/);
  assert.doesNotMatch(financeUi, /(?:telegram_id|product_code|user_id)/);
  assert.match(financeUi, /credentials:\s*"omit"/);
  assert.match(financeUi, /redirect:\s*"error"/);
  assert.match(financeUi, /REQUEST_TIMEOUT_MS = 30 \* 1000/);
});
