import {
  hmacSha256Hex,
  sha256Hex,
} from "./main-finance-protocol.mjs";
import {
  normalizeTelegramId,
  parseEntitlementClaim,
  validateEntitlementEndpoint,
} from "./main-entitlement-protocol.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const NONCE = /^[A-Za-z0-9._~-]{16,200}$/;
const DECIMAL_BIGINT = /^[1-9][0-9]{0,18}$/;
const RFC3339_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const PRODUCT_CODE = "architecture_finance";

export const ENTITLEMENT_V2_PATH =
  "/functions/v1/finance-apply-entitlement-event-v2";

function validPostgresBigint(value) {
  return typeof value === "string" &&
    DECIMAL_BIGINT.test(value) &&
    BigInt(value) <= MAX_POSTGRES_BIGINT;
}

function validEventTimestamp(value) {
  if (typeof value !== "string" || !RFC3339_MILLISECONDS.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function canonicalEventObject({
  eventId,
  eventVersion,
  eventAction,
  subjectDigest,
  predecessorSubjectDigest = null,
  telegramId,
  productCode,
  eventOccurredAt,
}) {
  const isGrant = eventAction === "grant";
  if (
    typeof eventId !== "string" ||
    !UUID_V4.test(eventId) ||
    !validPostgresBigint(eventVersion) ||
    !["grant", "revoke"].includes(eventAction) ||
    typeof subjectDigest !== "string" ||
    !HEX_64.test(subjectDigest) ||
    predecessorSubjectDigest !== null ||
    (isGrant ? normalizeTelegramId(telegramId) !== telegramId : telegramId !== null) ||
    productCode !== PRODUCT_CODE ||
    !validEventTimestamp(eventOccurredAt)
  ) {
    throw new TypeError("Finance entitlement v2 event is malformed");
  }
  return {
    event_id: eventId,
    event_version: eventVersion,
    event_action: eventAction,
    subject_digest: subjectDigest,
    predecessor_subject_digest: null,
    telegram_id: telegramId,
    product_code: productCode,
    active_until: null,
    event_occurred_at: eventOccurredAt,
  };
}

export function buildEntitlementV2EventBody(event) {
  return encoder.encode(JSON.stringify(canonicalEventObject(event)));
}

export function buildEntitlementV2CanonicalRequest({
  method,
  path,
  timestamp,
  nonce,
  eventId,
  bodySha256,
}) {
  if (
    method !== "POST" ||
    path !== ENTITLEMENT_V2_PATH ||
    !/^[1-9][0-9]{9,12}$/.test(timestamp ?? "") ||
    !NONCE.test(nonce ?? "") ||
    !UUID_V4.test(eventId ?? "") ||
    !HEX_64.test(bodySha256 ?? "")
  ) {
    throw new TypeError("Finance entitlement v2 canonical request is malformed");
  }
  return [
    "ARCHITECTURE-FINANCE-ENTITLEMENT-V2",
    method,
    path,
    timestamp,
    nonce,
    eventId,
    bodySha256,
  ].join("\n");
}

export async function buildEntitlementV2Request({
  event,
  path,
  timestamp,
  nonce,
  secret,
}) {
  const body = buildEntitlementV2EventBody(event);
  const bodySha256 = await sha256Hex(body);
  const canonicalRequest = buildEntitlementV2CanonicalRequest({
    method: "POST",
    path,
    timestamp,
    nonce,
    eventId: event.eventId,
    bodySha256,
  });
  const signature = `v2=${await hmacSha256Hex(secret, canonicalRequest)}`;
  return Object.freeze({ body, bodySha256, canonicalRequest, signature });
}

function canonicalSuccess(event, replayed) {
  return JSON.stringify({
    ok: true,
    event_id: event.eventId,
    event_version: event.eventVersion,
    event_action: event.eventAction,
    replayed,
  });
}

function canonicalConflict(event, error, replayed) {
  return JSON.stringify({
    ok: false,
    error,
    event_id: event.eventId,
    event_version: event.eventVersion,
    event_action: event.eventAction,
    replayed,
  });
}

function deadLetter(errorCode) {
  return Object.freeze({ outcome: "dead_letter", errorCode });
}

function retry(errorCode) {
  return Object.freeze({ outcome: "retry", errorCode });
}

export function classifyEntitlementV2Response({
  status,
  contentType,
  contentEncoding = "",
  body,
  event,
}) {
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return deadLetter("protocol_invalid_status");
  }
  if (status === 429) return retry("upstream_rate_limited");
  if (status >= 500) return retry("upstream_unavailable");
  if (status >= 300 && status < 400) return deadLetter("upstream_redirect");
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    return deadLetter("protocol_invalid_encoding");
  }
  if (status >= 400 && status < 500 && ![400, 401, 409].includes(status)) {
    return deadLetter("upstream_client_error");
  }
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType ?? "")) {
    return deadLetter("protocol_invalid_content_type");
  }

  let source;
  try {
    source = decoder.decode(body);
  } catch {
    return deadLetter("protocol_invalid_body");
  }
  if (status === 200) {
    return source === canonicalSuccess(event, false) || source === canonicalSuccess(event, true)
      ? Object.freeze({ outcome: "applied", errorCode: null })
      : deadLetter("protocol_invalid_body");
  }
  if (status === 409) {
    for (const [error, replayed] of [
      ["stale_event", false],
      ["version_conflict", false],
      ["transition_conflict", false],
      ["subject_binding_missing", false],
      ["idempotency_conflict", true],
    ]) {
      if (source === canonicalConflict(event, error, replayed)) {
        return deadLetter(error);
      }
    }
    return deadLetter("protocol_invalid_body");
  }
  if (status === 400) {
    return source === '{"ok":false,"error":"invalid_request"}'
      ? deadLetter("upstream_invalid_request")
      : deadLetter("protocol_invalid_body");
  }
  if (status === 401) {
    return source === '{"ok":false,"error":"unauthorized"}'
      ? deadLetter("upstream_unauthorized")
      : deadLetter("protocol_invalid_body");
  }
  return deadLetter("protocol_invalid_status");
}

export {
  normalizeTelegramId,
  parseEntitlementClaim,
  validateEntitlementEndpoint,
};
