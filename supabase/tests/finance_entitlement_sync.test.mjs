import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildEntitlementCanonicalRequest,
  buildEntitlementEventBody,
  buildEntitlementRequest,
  classifyEntitlementResponse,
  normalizeTelegramId,
  parseEntitlementClaim,
  signEntitlementCanonicalRequest,
  validateEntitlementEndpoint,
} from "../functions/_shared/main-entitlement-protocol.mjs";

const fixtureSource = readFileSync(
  "supabase/contracts/finance-entitlement-sync-v1.json",
  "utf8",
);
const fixture = JSON.parse(fixtureSource);
const worker = readFileSync(
  "supabase/functions/finance-sync-entitlements/index.ts",
  "utf8",
);
const protocol = readFileSync(
  "supabase/functions/_shared/main-entitlement-protocol.mjs",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260715010000_finance_entitlement_outbox_v1.sql",
  "utf8",
);
const resolverMigration = readFileSync(
  "supabase/migrations/20260715020000_finance_subject_resolver_v1.sql",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const envExample = readFileSync("supabase/functions/.env.example", "utf8");
const denoConfig = readFileSync(
  "supabase/functions/finance-sync-entitlements/deno.json",
  "utf8",
);
const denoLockSource = readFileSync(
  "supabase/functions/finance-sync-entitlements/deno.lock",
  "utf8",
);

const body = JSON.parse(fixture.body);
const event = Object.freeze({
  eventId: body.event_id,
  eventVersion: body.event_version,
  eventAction: body.event_action,
  telegramId: body.telegram_id,
  productCode: body.product_code,
  eventOccurredAt: body.event_occurred_at,
});
const responseEvent = Object.freeze({
  eventId: body.event_id,
  eventVersion: body.event_version,
  eventAction: body.event_action,
});
const encoder = new TextEncoder();

test("Main keeps the exact reviewed cross-repository entitlement fixture", () => {
  assert.equal(
    createHash("sha256").update(fixtureSource).digest("hex"),
    "9121493943b47fc862a81c5a538cb3e336b34507431e0a5bd3a7814fea1139bd",
  );
  assert.equal(fixture.protocol, "finance-entitlement-sync-v1");
  assert.equal(fixture.public_test_vector_only, true);
  assert.match(fixture.warning, /^PUBLIC TEST VECTOR\./);
  assert.equal(typeof body.event_version, "string");
  assert.equal(body.telegram_id, "9000000000000000001");
  assert.equal(Number.isSafeInteger(Number(body.telegram_id)), false);
  assert.equal(body.active_until, null);
});

test("Main entitlement worker accepts the hosted route before evaluating its disabled gate", () => {
  const routeCheck = worker.indexOf(
    '!matchesSupabaseFunctionRoute(request.url, "finance-sync-entitlements")',
  );
  const gate = worker.indexOf('Deno.env.get("MAIN_FINANCE_SYNC_MODE") !== "enabled"');
  assert.equal(routeCheck >= 0, true);
  assert.equal(gate > routeCheck, true);
});

test("producer bytes, SHA-256, canonical string and HMAC match independently", async () => {
  const producedBody = buildEntitlementEventBody(event);
  assert.equal(new TextDecoder().decode(producedBody), fixture.body);
  assert.equal(
    createHash("sha256").update(producedBody).digest("hex"),
    fixture.body_sha256,
  );
  const canonical = buildEntitlementCanonicalRequest({
    method: fixture.method,
    path: fixture.path,
    timestamp: fixture.timestamp,
    nonce: fixture.nonce,
    eventId: fixture.event_id_header,
    bodySha256: fixture.body_sha256,
  });
  assert.equal(canonical, fixture.canonical_request);
  assert.equal(
    await signEntitlementCanonicalRequest(fixture.public_test_secret, canonical),
    fixture.signature,
  );
  assert.equal(
    fixture.signature,
    `v1=${createHmac("sha256", fixture.public_test_secret)
      .update(fixture.canonical_request)
      .digest("hex")}`,
  );

  const complete = await buildEntitlementRequest({
    event,
    path: fixture.path,
    timestamp: fixture.timestamp,
    nonce: fixture.nonce,
    secret: fixture.public_test_secret,
  });
  assert.equal(new TextDecoder().decode(complete.body), fixture.body);
  assert.equal(complete.bodySha256, fixture.body_sha256);
  assert.equal(complete.canonicalRequest, fixture.canonical_request);
  assert.equal(complete.signature, fixture.signature);
});

test("event version and high-range Telegram identity remain exact decimal strings", () => {
  assert.equal(normalizeTelegramId(body.telegram_id), body.telegram_id);
  assert.throws(() => normalizeTelegramId(Number(body.telegram_id)));
  assert.throws(() => buildEntitlementEventBody({ ...event, eventVersion: 7 }));
  assert.throws(() => buildEntitlementEventBody({
    ...event,
    eventVersion: "9223372036854775808",
  }));
  assert.throws(() => buildEntitlementEventBody({
    ...event,
    eventOccurredAt: "2026-07-15T00:00:00Z",
  }));
});

test("claim contract exposes stable pseudonymous event data and no JS number version", () => {
  const claim = {
    ok: true,
    replayed: false,
    event: {
      event_id: event.eventId,
      main_user_id: "00000000-0000-4000-8000-000000000001",
      subject_digest: "11".repeat(32),
      product_code: event.productCode,
      desired_state: "granted",
      event_version: event.eventVersion,
      event_occurred_at: event.eventOccurredAt,
      attempt_count: 1,
      lease_expires_at: "2026-07-15T00:01:00.000Z",
    },
  };
  assert.deepEqual(parseEntitlementClaim(claim), {
    eventId: event.eventId,
    mainUserId: "00000000-0000-4000-8000-000000000001",
    subjectDigest: "11".repeat(32),
    productCode: event.productCode,
    desiredState: "granted",
    eventVersion: "7",
    eventOccurredAt: event.eventOccurredAt,
    attemptCount: 1,
    leaseExpiresAt: "2026-07-15T00:01:00.000Z",
  });
  assert.equal(parseEntitlementClaim({ ok: true, replayed: false, event: null }), null);
  assert.throws(() => parseEntitlementClaim({
    ...claim,
    event: { ...claim.event, event_version: 7 },
  }));
  assert.throws(() => parseEntitlementClaim({
    ...claim,
    event: { ...claim.event, telegram_id: body.telegram_id },
  }));
});

test("Finance response classifier applies only exact canonical success", () => {
  for (const [source, expected] of [
    [fixture.success_response, { outcome: "applied", errorCode: null }],
    [fixture.replay_response, { outcome: "applied", errorCode: null }],
    [fixture.stale_response, { outcome: "dead_letter", errorCode: "stale_event" }],
    [fixture.idempotency_conflict_response, {
      outcome: "dead_letter",
      errorCode: "idempotency_conflict",
    }],
  ]) {
    const status = source === fixture.success_response || source === fixture.replay_response
      ? 200
      : 409;
    assert.deepEqual(classifyEntitlementResponse({
      status,
      contentType: "application/json",
      body: encoder.encode(source),
      event: responseEvent,
    }), expected);
  }

  const versionConflict = JSON.stringify({
    ok: false,
    error: "version_conflict",
    event_id: event.eventId,
    event_version: event.eventVersion,
    event_action: event.eventAction,
    replayed: false,
  });
  assert.deepEqual(classifyEntitlementResponse({
    status: 409,
    contentType: "application/json; charset=utf-8",
    body: encoder.encode(versionConflict),
    event: responseEvent,
  }), { outcome: "dead_letter", errorCode: "version_conflict" });

  for (const invalidSuccess of [
    ` ${fixture.success_response}`,
    `${fixture.success_response}\n`,
    fixture.success_response.replace('"event_version":"7"', '"event_version":7'),
    fixture.success_response.replace('"replayed":false', '"replayed":false,"extra":true'),
  ]) {
    assert.deepEqual(classifyEntitlementResponse({
      status: 200,
      contentType: "application/json",
      body: encoder.encode(invalidSuccess),
      event: responseEvent,
    }), { outcome: "dead_letter", errorCode: "protocol_invalid_body" });
  }
});

test("permanent protocol and 4xx failures dead-letter; timeout classes retry", () => {
  const cases = [
    [400, "application/json", '{"ok":false,"error":"invalid_request"}', "dead_letter", "upstream_invalid_request"],
    [401, "application/json", '{"ok":false,"error":"unauthorized"}', "dead_letter", "upstream_unauthorized"],
    [403, "application/json", "{}", "dead_letter", "upstream_client_error"],
    [302, "text/plain", "", "dead_letter", "upstream_redirect"],
    [429, "text/plain", "", "retry", "upstream_rate_limited"],
    [503, "application/json", '{"ok":false,"error":"temporarily_unavailable"}', "retry", "upstream_unavailable"],
    [200, "text/plain", fixture.success_response, "dead_letter", "protocol_invalid_content_type"],
  ];
  for (const [status, contentType, source, outcome, errorCode] of cases) {
    assert.deepEqual(classifyEntitlementResponse({
      status,
      contentType,
      body: encoder.encode(source),
      event: responseEvent,
    }), { outcome, errorCode });
  }
  assert.deepEqual(classifyEntitlementResponse({
    status: 200,
    contentType: "application/json",
    contentEncoding: "gzip",
    body: encoder.encode(fixture.success_response),
    event: responseEvent,
  }), { outcome: "dead_letter", errorCode: "protocol_invalid_encoding" });
});

test("worker is private, fail-closed, bounded and verifies pseudonymous identity before send", () => {
  assert.match(config, /\[functions\.finance-sync-entitlements\]\s*\nverify_jwt = false/);
  assert.match(envExample, /^MAIN_FINANCE_SYNC_MODE=disabled$/m);
  assert.match(worker, /Deno\.env\.get\("MAIN_FINANCE_SYNC_MODE"\) !== "enabled"/);
  assert.match(worker, /MAIN_FINANCE_ENTITLEMENT_HMAC_SECRET/);
  assert.match(worker, /MAIN_FINANCE_SYNC_TRIGGER_SECRET/);
  assert.match(worker, /integration secrets must be separated/);
  assert.match(worker, /request\.headers\.has\("origin"\)/);
  assert.match(worker, /request\.headers\.has\("authorization"\)/);
  assert.match(worker, /request\.headers\.has\("cookie"\)/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin|corsHeaders|allowedOrigin/);
  assert.match(
    worker,
    /\.rpc\("architecture_resolve_finance_subject_internal", \{[\s\S]*?p_main_user_id: mainUserId/,
  );
  assert.doesNotMatch(worker, /\.from\("users"\)/);
  assert.match(resolverMigration, /SELECT user_row\.telegram_id::text/);
  assert.match(resolverMigration, /'telegram_id', v_telegram_id/);
  assert.match(worker, /"main-telegram-subject-v1"/);
  assert.ok(
    worker.indexOf("constantTimeHexEqual(derivedSubject") <
      worker.indexOf("upstream = await fetchUpstream"),
  );
  assert.match(worker, /redirect: "manual"/);
  assert.match(worker, /MAIN_FINANCE_SYNC_TOTAL_TIMEOUT_MS[\s\S]*?24_000[\s\S]*?25_000/);
  assert.match(worker, /MAIN_FINANCE_SYNC_BATCH_SIZE[\s\S]*?3,[\s\S]*?1,[\s\S]*?10/);
  assert.match(worker, /x-architecture-event-id/);
  assert.match(worker, /p_event_id: targetEventId/);
  assert.match(worker, /source === "\{\}"/);
  assert.match(worker, /maximumEvents = targetEventId === null \? config\.batchSize : 1/);
  assert.match(worker, /subject_digest_mismatch/);
  assert.doesNotMatch(worker, /Number\(event\.eventVersion\)|Number\(event\.event_version\)/);
  for (const source of [worker, protocol]) {
    assert.doesNotMatch(source, /console\.(?:log|info|warn|error|debug)/);
    assert.doesNotMatch(source, /error\.(?:message|details|hint|stack)/);
  }
});

test("desired-state SQL blocks first and only current applied grant opens the gate", () => {
  assert.match(migration, /subject_digest bytea NOT NULL/g);
  assert.match(migration, /octet_length\(p_subject_digest\) IS DISTINCT FROM 32/);
  assert.match(migration, /architecture_upsert_product_entitlement_internal\([\s\S]*?p_subject_digest,[\s\S]*?'architecture_finance',[\s\S]*?'blocked'/);
  assert.match(migration, /WHEN v_event\.desired_state = 'granted'[\s\S]*?v_desired\.version = v_event\.version[\s\S]*?THEN 'manual'[\s\S]*?ELSE 'blocked'/);
  assert.match(migration, /'subject_digest', encode\(v_event\.subject_digest, 'hex'\)/);
  assert.match(migration, /'event_version', v_event\.version::text/);
  assert.match(migration, /'event_occurred_at', to_char\([\s\S]*?'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'/);
  assert.doesNotMatch(migration, /\btelegram_id\b/);
});

test("worker dependency graph is separate, frozen and byte-identical to reviewed issuer graph", () => {
  assert.deepEqual(JSON.parse(denoConfig).lock, { path: "./deno.lock", frozen: true });
  assert.match(denoConfig, /npm:@supabase\/supabase-js@2\.106\.2/);
  assert.equal(
    createHash("sha256").update(denoLockSource).digest("hex"),
    "5e322322c36ec504c98691cbea052a618d969d627ffcc21f89a5a440d61077eb",
  );
  assert.equal(
    validateEntitlementEndpoint(
      "https://finance.example/functions/v1/finance-apply-entitlement-event",
      "/functions/v1/finance-apply-entitlement-event",
    ),
    "https://finance.example/functions/v1/finance-apply-entitlement-event",
  );
});
