import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildEntitlementV2CanonicalRequest,
  buildEntitlementV2EventBody,
  buildEntitlementV2Request,
  classifyEntitlementV2Response,
  ENTITLEMENT_V2_PATH,
} from "../functions/_shared/main-entitlement-protocol-v2.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const event = Object.freeze({
  eventId: "01901234-5678-4abc-8def-0123456789ab",
  eventVersion: "7",
  eventAction: "grant",
  subjectDigest: "11".repeat(32),
  predecessorSubjectDigest: null,
  telegramId: "9000000000000000001",
  productCode: "architecture_finance",
  eventOccurredAt: "2026-07-15T00:00:00.000Z",
});
const secret = "public-test-secret-entitlement-v2-0123456789abcdef";
const timestamp = "1784073600";
const nonce = "public-test-nonce-entitlement-v2";

test("v2 producer emits the exact canonical subject-bound body and signature", async () => {
  const body = buildEntitlementV2EventBody(event);
  const expectedBody = JSON.stringify({
    event_id: event.eventId,
    event_version: event.eventVersion,
    event_action: event.eventAction,
    subject_digest: event.subjectDigest,
    predecessor_subject_digest: null,
    telegram_id: event.telegramId,
    product_code: event.productCode,
    active_until: null,
    event_occurred_at: event.eventOccurredAt,
  });
  assert.equal(decoder.decode(body), expectedBody);
  const bodySha256 = createHash("sha256").update(body).digest("hex");
  const canonical = buildEntitlementV2CanonicalRequest({
    method: "POST",
    path: ENTITLEMENT_V2_PATH,
    timestamp,
    nonce,
    eventId: event.eventId,
    bodySha256,
  });
  assert.equal(canonical, [
    "ARCHITECTURE-FINANCE-ENTITLEMENT-V2",
    "POST",
    ENTITLEMENT_V2_PATH,
    timestamp,
    nonce,
    event.eventId,
    bodySha256,
  ].join("\n"));
  const request = await buildEntitlementV2Request({
    event,
    path: ENTITLEMENT_V2_PATH,
    timestamp,
    nonce,
    secret,
  });
  assert.equal(decoder.decode(request.body), expectedBody);
  assert.equal(request.bodySha256, bodySha256);
  assert.equal(request.canonicalRequest, canonical);
  assert.equal(
    request.signature,
    `v2=${createHmac("sha256", secret).update(canonical).digest("hex")}`,
  );
});

test("v2 revoke carries the stable subject but no raw Telegram identity", () => {
  const revoke = {
    ...event,
    eventAction: "revoke",
    telegramId: null,
  };
  const parsed = JSON.parse(decoder.decode(buildEntitlementV2EventBody(revoke)));
  assert.equal(parsed.subject_digest, event.subjectDigest);
  assert.equal(parsed.telegram_id, null);
  assert.throws(() => buildEntitlementV2EventBody({
    ...revoke,
    telegramId: event.telegramId,
  }));
  assert.throws(() => buildEntitlementV2EventBody({
    ...event,
    telegramId: null,
  }));
});

test("v2 response classifier accepts only exact canonical outcomes", () => {
  const responseEvent = {
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    eventAction: event.eventAction,
  };
  const success = JSON.stringify({
    ok: true,
    event_id: event.eventId,
    event_version: event.eventVersion,
    event_action: event.eventAction,
    replayed: false,
  });
  assert.deepEqual(classifyEntitlementV2Response({
    status: 200,
    contentType: "application/json",
    body: encoder.encode(success),
    event: responseEvent,
  }), { outcome: "applied", errorCode: null });
  for (const error of [
    "stale_event",
    "version_conflict",
    "transition_conflict",
    "subject_binding_missing",
  ]) {
    const body = JSON.stringify({
      ok: false,
      error,
      event_id: event.eventId,
      event_version: event.eventVersion,
      event_action: event.eventAction,
      replayed: false,
    });
    assert.deepEqual(classifyEntitlementV2Response({
      status: 409,
      contentType: "application/json",
      body: encoder.encode(body),
      event: responseEvent,
    }), { outcome: "dead_letter", errorCode: error });
  }
  assert.deepEqual(classifyEntitlementV2Response({
    status: 200,
    contentType: "application/json",
    body: encoder.encode(`${success}\n`),
    event: responseEvent,
  }), { outcome: "dead_letter", errorCode: "protocol_invalid_body" });
});

test("hosted worker is pinned to v2 while preserving fail-closed identity checks", () => {
  const worker = readFileSync(
    "supabase/functions/finance-sync-entitlements/index.ts",
    "utf8",
  );
  const protocol = readFileSync(
    "supabase/functions/_shared/main-entitlement-protocol-v2.mjs",
    "utf8",
  );
  assert.match(worker, /ENTITLEMENT_V2_PATH/);
  assert.match(worker, /MAIN_FINANCE_ENTITLEMENT_V2_HMAC_SECRET/);
  assert.match(worker, /subjectDigest: event\.subjectDigest/);
  assert.match(worker, /eventAction === "grant" \? identity\.telegramId : null/);
  assert.match(worker, /constantTimeHexEqual\(derivedSubject/);
  assert.doesNotMatch(worker, /const UPSTREAM_PATH = "\/functions\/v1\/finance-apply-entitlement-event"/);
  for (const source of [worker, protocol]) {
    assert.doesNotMatch(source, /console\.(?:log|info|warn|error|debug)/);
  }
});
