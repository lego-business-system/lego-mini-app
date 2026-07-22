const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const HEX_64 = /^[0-9a-f]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^[A-Za-z0-9._~-]{16,200}$/;
const TELEGRAM_BOT_TOKEN = /^[1-9][0-9]{4,15}:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_ID = /^[1-9][0-9]{0,18}$/;
const PRODUCT_CODE = /^[a-z][a-z0-9_]{2,60}$/;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

function bytes(value) {
  return typeof value === "string" ? encoder.encode(value) : value;
}

function toHex(value) {
  return Array.from(value, (part) => part.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  if (!HEX_64.test(value)) return null;
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    result[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return result;
}

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

function assertSecret(secret, label) {
  if (typeof secret !== "string" || encoder.encode(secret).byteLength < 32) {
    throw new TypeError(`${label} must contain at least 32 UTF-8 bytes`);
  }
}

async function hmacBytes(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    bytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, bytes(message)),
  );
}

export function constantTimeHexEqual(left, right) {
  const leftBytes = fromHex(left);
  const rightBytes = fromHex(right);
  if (!leftBytes || !rightBytes || leftBytes.length !== rightBytes.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function sha256Hex(value) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))));
}

export async function hmacSha256Hex(secret, message) {
  assertSecret(secret, "HMAC secret");
  return toHex(await hmacBytes(encoder.encode(secret), message));
}

export async function derivePrivateDigest(secret, domain, value) {
  assertSecret(secret, "privacy key");
  if (
    typeof domain !== "string" ||
    !/^[a-z0-9-]{3,80}$/.test(domain) ||
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 12_000 ||
    /[\0\r\n]/.test(domain)
  ) {
    throw new TypeError("private digest context is malformed");
  }
  return hmacSha256Hex(secret, `${domain}\n${value}`);
}

export function validateIssueRequestBody(value) {
  assertExactKeys(value, ["init_data", "request_id"]);
  if (
    typeof value.init_data !== "string" ||
    value.init_data.length === 0 ||
    value.init_data.length > 8_192 ||
    /[\x00-\x1f\x7f]/.test(value.init_data) ||
    typeof value.request_id !== "string" ||
    !UUID_V4.test(value.request_id)
  ) {
    throw new TypeError("issue request is malformed");
  }
  return Object.freeze({
    initData: value.init_data,
    requestId: value.request_id,
  });
}

export function canonicalIssueRequestBody(value) {
  const validated = validateIssueRequestBody(value);
  return encoder.encode(JSON.stringify({
    init_data: validated.initData,
    request_id: validated.requestId,
  }));
}

export function parseCanonicalIssueRequestBytes(value) {
  let parsed;
  let source;
  try {
    source = decoder.decode(value);
    parsed = JSON.parse(source);
  } catch {
    throw new TypeError("request body is not valid UTF-8 JSON");
  }
  const validated = validateIssueRequestBody(parsed);
  const canonical = JSON.stringify({
    init_data: validated.initData,
    request_id: validated.requestId,
  });
  if (source !== canonical) {
    throw new TypeError("request body is not canonical JSON");
  }
  return validated;
}

function parseTelegramParams(initData) {
  if (
    typeof initData !== "string" ||
    initData.length === 0 ||
    initData.length > 8_192 ||
    /[\x00-\x1f\x7f]/.test(initData)
  ) {
    throw new TypeError("Telegram initData is malformed");
  }
  for (const component of initData.split("&")) {
    const separator = component.indexOf("=");
    if (
      separator <= 0 ||
      /%(?![0-9A-Fa-f]{2})/.test(component) ||
      component.slice(0, separator).includes("%")
    ) {
      throw new TypeError("Telegram initData encoding is malformed");
    }
  }
  const params = new URLSearchParams(initData);
  const entries = [];
  const names = new Set();
  for (const [name, value] of params.entries()) {
    if (
      entries.length >= 64 ||
      !/^[A-Za-z0-9_]{1,64}$/.test(name) ||
      value.length > 4_096 ||
      /[\x00-\x1f\x7f]/.test(value) ||
      names.has(name)
    ) {
      throw new TypeError("Telegram initData fields are malformed");
    }
    names.add(name);
    entries.push([name, value]);
  }
  if (entries.length === 0 || !names.has("hash")) {
    throw new TypeError("Telegram initData fields are incomplete");
  }
  return entries;
}

export async function validateTelegramInitData({
  initData,
  botToken,
  nowMilliseconds,
  maxAgeSeconds,
  maxFutureSkewSeconds,
}) {
  if (!TELEGRAM_BOT_TOKEN.test(botToken ?? "")) {
    throw new TypeError("Telegram bot token is malformed");
  }
  if (
    !Number.isSafeInteger(nowMilliseconds) ||
    nowMilliseconds <= 0 ||
    !Number.isInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    !Number.isInteger(maxFutureSkewSeconds) ||
    maxFutureSkewSeconds < 0
  ) {
    throw new TypeError("Telegram freshness policy is malformed");
  }

  const entries = parseTelegramParams(initData);
  const suppliedHash = entries.find(([name]) => name === "hash")?.[1] ?? "";
  if (!HEX_64.test(suppliedHash)) {
    throw new TypeError("Telegram initData hash is malformed");
  }
  const dataCheckString = entries
    .filter(([name]) => name !== "hash")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");

  // Official Telegram Mini Apps validation:
  // secret = HMAC_SHA256(key="WebAppData", message=bot_token), then
  // hash = HMAC_SHA256(key=secret, message=data_check_string).
  const telegramSecret = await hmacBytes(
    encoder.encode("WebAppData"),
    encoder.encode(botToken),
  );
  const expectedHash = toHex(await hmacBytes(telegramSecret, dataCheckString));
  if (!constantTimeHexEqual(expectedHash, suppliedHash)) {
    throw new TypeError("Telegram initData signature is invalid");
  }

  const authDateRaw = entries.find(([name]) => name === "auth_date")?.[1] ?? "";
  if (!/^[1-9][0-9]{9,12}$/.test(authDateRaw)) {
    throw new TypeError("Telegram auth_date is malformed");
  }
  const authDate = Number(authDateRaw);
  const nowSeconds = Math.floor(nowMilliseconds / 1_000);
  if (
    !Number.isSafeInteger(authDate) ||
    authDate < nowSeconds - maxAgeSeconds ||
    authDate > nowSeconds + maxFutureSkewSeconds
  ) {
    throw new TypeError("Telegram initData is outside the freshness window");
  }

  const userRaw = entries.find(([name]) => name === "user")?.[1] ?? "";
  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new TypeError("Telegram user is malformed");
  }
  assertPlainObject(user);
  if (
    typeof user.id !== "number" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  ) {
    throw new TypeError("Telegram user id is malformed");
  }
  const telegramId = String(user.id);
  if (!TELEGRAM_ID.test(telegramId) || BigInt(telegramId) > MAX_POSTGRES_BIGINT) {
    throw new TypeError("Telegram user id is outside the supported range");
  }
  // The verified Telegram hash is stable across query-field reordering and
  // equivalent percent-encoding. Callers may HMAC it for replay storage; raw
  // initData bytes are deliberately not a replay identity.
  return Object.freeze({ telegramId, authDate, initDataHash: suppliedHash });
}

export function parseAllowedOrigins(value) {
  if (typeof value !== "string") throw new TypeError("origin allowlist is missing");
  const origins = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (origins.length === 0 || origins.length > 20 || origins.includes("*")) {
    throw new TypeError("origin allowlist is malformed");
  }
  const result = new Set();
  for (const origin of origins) {
    const url = new URL(origin);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.origin !== origin ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal))
    ) {
      throw new TypeError("origin allowlist is malformed");
    }
    result.add(origin);
  }
  return result;
}

export async function deriveFinanceNonce(secret, requestId) {
  if (!UUID_V4.test(requestId ?? "")) throw new TypeError("request id is malformed");
  return hmacSha256Hex(secret, `main-finance-network-nonce-v1\n${requestId}`);
}

export function buildFinanceIssuerBody(telegramId, productCode) {
  if (
    typeof telegramId !== "string" ||
    !TELEGRAM_ID.test(telegramId) ||
    BigInt(telegramId) > MAX_POSTGRES_BIGINT ||
    typeof productCode !== "string" ||
    !PRODUCT_CODE.test(productCode)
  ) {
    throw new TypeError("Finance issuer identity is malformed");
  }
  return encoder.encode(JSON.stringify({
    telegram_id: telegramId,
    product_code: productCode,
  }));
}

export function validateFinanceEndpoint(value, canonicalPath) {
  if (
    typeof canonicalPath !== "string" ||
    !canonicalPath.startsWith("/") ||
    /[\0\r\n?#]/.test(canonicalPath)
  ) {
    throw new TypeError("Finance canonical path is malformed");
  }
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== canonicalPath ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("Finance issuer URL is malformed");
  }
  return url.toString();
}

export function buildFinanceCanonicalRequest({
  method,
  path,
  timestamp,
  nonce,
  requestId,
  bodySha256,
}) {
  if (
    method !== "POST" ||
    typeof path !== "string" ||
    !path.startsWith("/") ||
    /[\0\r\n?#]/.test(path) ||
    !/^[1-9][0-9]{9,12}$/.test(timestamp ?? "") ||
    !NONCE.test(nonce ?? "") ||
    !UUID_V4.test(requestId ?? "") ||
    !HEX_64.test(bodySha256 ?? "")
  ) {
    throw new TypeError("Finance canonical request is malformed");
  }
  return [method, path, timestamp, nonce, requestId, bodySha256].join("\n");
}

export async function signFinanceCanonicalRequest(secret, canonicalRequest) {
  return `v1=${await hmacSha256Hex(secret, canonicalRequest)}`;
}

export function validateFinanceSuccess(value, requestId, nowMilliseconds) {
  assertExactKeys(value, ["ok", "code", "expires_at", "replayed", "request_id"]);
  if (
    value.ok !== true ||
    typeof value.code !== "string" ||
    !/^[0-9]{4} [0-9]{4}$/.test(value.code) ||
    typeof value.expires_at !== "string" ||
    typeof value.replayed !== "boolean" ||
    value.request_id !== requestId ||
    !UUID_V4.test(value.request_id) ||
    !Number.isSafeInteger(nowMilliseconds)
  ) {
    throw new TypeError("Finance success response is malformed");
  }
  const expiresAt = Date.parse(value.expires_at);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= nowMilliseconds - 5_000 ||
    expiresAt > nowMilliseconds + 1_800_000
  ) {
    throw new TypeError("Finance expiry is malformed");
  }
  return Object.freeze({
    code: value.code,
    expiresAt: new Date(expiresAt).toISOString(),
    replayed: value.replayed,
    requestId: value.request_id,
  });
}

export function isUuidV4(value) {
  return typeof value === "string" && UUID_V4.test(value);
}
