import {
  hmacSha256Hex,
  sha256Hex,
  validateFinanceEndpoint,
} from "./main-finance-protocol.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const NONCE = /^[A-Za-z0-9._~-]{16,200}$/;
const DECIMAL_BIGINT = /^[1-9][0-9]{0,18}$/;
const TELEGRAM_ID = /^[1-9][0-9]{0,18}$/;
const RFC3339_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const PRODUCT_CODE = "architecture_finance";

function assertPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError("JSON value must be a plain object");
  }
}

function assertExactKeys(value, required) {
  assertPlainObject(value);
  const keys = Object.keys(value);
  if (
    keys.length !== required.length ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    keys.some((key) => !required.includes(key))
  ) {
    throw new TypeError("JSON object has an invalid schema");
  }
}

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
  telegramId,
  productCode,
  eventOccurredAt,
}) {
  if (
    typeof eventId !== "string" ||
    !UUID_V4.test(eventId) ||
    !validPostgresBigint(eventVersion) ||
    !["grant", "revoke"].includes(eventAction) ||
    typeof telegramId !== "string" ||
    !TELEGRAM_ID.test(telegramId) ||
    BigInt(telegramId) > MAX_POSTGRES_BIGINT ||
    productCode !== PRODUCT_CODE ||
    !validEventTimestamp(eventOccurredAt)
  ) {
    throw new TypeError("Finance entitlement event is malformed");
  }
  return {
    event_id: eventId,
    event_version: eventVersion,
    event_action: eventAction,
    telegram_id: telegramId,
    product_code: productCode,
    active_until: null,
    event_occurred_at: eventOccurredAt,
  };
}

export function buildEntitlementEventBody(event) {
  return encoder.encode(JSON.stringify(canonicalEventObject(event)));
}

export async function buildEntitlementRequest({
  event,
  path,
  timestamp,
  nonce,
  secret,
}) {
  const body = buildEntitlementEventBody(event);
  const bodySha256 = await sha256Hex(body);
  const canonicalRequest = buildEntitlementCanonicalRequest({
    method: "POST",
    path,
    timestamp,
    nonce,
    eventId: event.eventId,
    bodySha256,
  });
  const signature = await signEntitlementCanonicalRequest(secret, canonicalRequest);
  return Object.freeze({ body, bodySha256, canonicalRequest, signature });
}

export function buildEntitlementCanonicalRequest({
  method,
  path,
  timestamp,
  nonce,
  eventId,
  bodySha256,
}) {
  if (
    method !== "POST" ||
    typeof path !== "string" ||
    !path.startsWith("/") ||
    /[\0\r\n?#]/.test(path) ||
    !/^[1-9][0-9]{9,12}$/.test(timestamp ?? "") ||
    !NONCE.test(nonce ?? "") ||
    !UUID_V4.test(eventId ?? "") ||
    !HEX_64.test(bodySha256 ?? "")
  ) {
    throw new TypeError("Finance entitlement canonical request is malformed");
  }
  return [method, path, timestamp, nonce, eventId, bodySha256].join("\n");
}

export async function signEntitlementCanonicalRequest(secret, canonicalRequest) {
  return `v1=${await hmacSha256Hex(secret, canonicalRequest)}`;
}

export function validateEntitlementEndpoint(value, canonicalPath) {
  return validateFinanceEndpoint(value, canonicalPath);
}

export function parseEntitlementClaim(value) {
  assertExactKeys(value, ["ok", "replayed", "event"]);
  if (value.ok !== true || typeof value.replayed !== "boolean") {
    throw new TypeError("Finance entitlement claim is malformed");
  }
  if (value.event === null) return null;
  assertExactKeys(value.event, [
    "event_id",
    "main_user_id",
    "subject_digest",
    "product_code",
    "desired_state",
    "event_version",
    "event_occurred_at",
    "attempt_count",
    "lease_expires_at",
  ]);
  const event = value.event;
  if (
    !UUID_V4.test(event.event_id ?? "") ||
    !UUID_V4.test(event.main_user_id ?? "") ||
    !HEX_64.test(event.subject_digest ?? "") ||
    event.product_code !== PRODUCT_CODE ||
    !["granted", "revoked"].includes(event.desired_state) ||
    !validPostgresBigint(event.event_version) ||
    !validEventTimestamp(event.event_occurred_at) ||
    !Number.isInteger(event.attempt_count) ||
    event.attempt_count < 1 ||
    event.attempt_count > 8 ||
    typeof event.lease_expires_at !== "string" ||
    !Number.isFinite(Date.parse(event.lease_expires_at))
  ) {
    throw new TypeError("Finance entitlement claim event is malformed");
  }
  return Object.freeze({
    eventId: event.event_id,
    mainUserId: event.main_user_id,
    subjectDigest: event.subject_digest,
    productCode: event.product_code,
    desiredState: event.desired_state,
    eventVersion: event.event_version,
    eventOccurredAt: event.event_occurred_at,
    attemptCount: event.attempt_count,
    leaseExpiresAt: event.lease_expires_at,
  });
}

export function normalizeTelegramId(value) {
  const telegramId = typeof value === "string" ? value : "";
  if (
    !TELEGRAM_ID.test(telegramId) ||
    BigInt(telegramId) > MAX_POSTGRES_BIGINT
  ) {
    throw new TypeError("Main Telegram identity is malformed");
  }
  return telegramId;
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

export function classifyEntitlementResponse({
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
    if (source === canonicalSuccess(event, false) || source === canonicalSuccess(event, true)) {
      return Object.freeze({ outcome: "applied", errorCode: null });
    }
    return deadLetter("protocol_invalid_body");
  }
  if (status === 409) {
    for (const [error, replayed] of [
      ["stale_event", false],
      ["version_conflict", false],
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
