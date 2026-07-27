#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
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
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptFile), "..");

const FINANCE_STAGING_REF = "makgsbjduobcphuqzaoq";
const MAIN_STAGING_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_PRODUCTION_REF = "koibxwgtihwajocxfetb";
const MAIN_PRODUCTION_REF = "soxtekhspohkddpdidvp";

const FINANCE_STAGING_ORIGIN =
  `https://${FINANCE_STAGING_REF}.supabase.co`;
const MAIN_STAGING_ORIGIN = `https://${MAIN_STAGING_REF}.supabase.co`;
const FINANCE_WEB_STAGING_ORIGIN =
  "https://architecture-finance-pilot.pages.dev";
const MAIN_WEB_STAGING_ORIGIN =
  "https://architecture-main-pilot.pages.dev";

const DEFAULT_PUBLIC_API_FILE =
  "/private/tmp/architecture-finance-pilot-secret-inputs/finance-public-api.env";
const DEFAULT_PUBLIC_API_RECEIPT_FILE =
  "/private/tmp/architecture-finance-pilot-secret-inputs/finance-public-api.receipt.json";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DISABLED_RESPONSE_BYTES = 128;
const EXACT_DISABLED_BODY =
  Buffer.from('{"ok":false,"error":"temporarily_unavailable"}', "utf8");
const EXACT_CONTENT_TYPE = "application/json; charset=utf-8";
const PROOF_RECEIPT_KIND = "disabled-staging-edge-proof-v1";
const ALLOWED_CONTENT_ENCODINGS = Object.freeze(
  new Set(["br", "deflate", "gzip"]),
);
const MAX_SET_COOKIE_COUNT = 8;
const MAX_SET_COOKIE_BYTES = 4 * 1_024;
const MAX_SET_COOKIE_TOTAL_BYTES = 16 * 1_024;
const MAX_COOKIE_NAME_BYTES = 128;
const MAX_COOKIE_ATTRIBUTES = 32;
const COOKIE_NAME_TOKEN =
  /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const COOKIE_VALUE_OCTETS =
  /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/u;
const COOKIE_ATTRIBUTE_VALUE_OCTETS = /^[\x20-\x3A\x3C-\x7E]*$/u;
const ALLOWED_STAGING_GATEWAY_COOKIE_NAMES = Object.freeze(
  new Set(["__cf_bm"]),
);
const RESPONSE_FORBIDDEN_HEADERS = Object.freeze([
  "authentication-info",
  "location",
  "proxy-authenticate",
  "proxy-authentication-info",
  "www-authenticate",
]);

const EXPECTED_CASE_SPECS = Object.freeze([
  Object.freeze({
    name: "finance-issue-telegram-code",
    url:
      `${FINANCE_STAGING_ORIGIN}/functions/v1/finance-issue-telegram-code`,
    origin: null,
    credential: "none",
  }),
  Object.freeze({
    name: "finance-apply-entitlement-event",
    url:
      `${FINANCE_STAGING_ORIGIN}/functions/v1/finance-apply-entitlement-event`,
    origin: null,
    credential: "none",
  }),
  Object.freeze({
    name: "finance-consume-telegram-code",
    url:
      `${FINANCE_STAGING_ORIGIN}/functions/v1/finance-consume-telegram-code`,
    origin: FINANCE_WEB_STAGING_ORIGIN,
    credential: "finance_anon",
  }),
  Object.freeze({
    name: "main-finance-issue-code",
    url: `${MAIN_STAGING_ORIGIN}/functions/v1/finance-issue-code`,
    origin: MAIN_WEB_STAGING_ORIGIN,
    credential: "none",
  }),
  Object.freeze({
    name: "main-finance-sync-entitlements",
    url: `${MAIN_STAGING_ORIGIN}/functions/v1/finance-sync-entitlements`,
    origin: null,
    credential: "none",
  }),
]);

function refuse(message) {
  throw new Error(`Disabled staging Edge verification refused: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactKeys(value, expected, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([...expected].sort())
  ) {
    refuse(`${label} inventory differs`);
  }
}

function assertPrivateParent(file) {
  const parent = path.dirname(file);
  const status = lstatSync(parent);
  if (
    !status.isDirectory()
    || status.isSymbolicLink()
    || (status.mode & 0o777) !== 0o700
    || realpathSync(parent) !== parent
  ) {
    refuse("external credential parent boundary differs");
  }
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse("external credential parent owner differs");
  }
}

function readPrivateExternalFile(file, maximumBytes, label) {
  if (
    typeof file !== "string"
    || !path.isAbsolute(file)
    || path.resolve(file) !== file
  ) {
    refuse(`${label} path must be absolute and normalized`);
  }
  assertPrivateParent(file);
  const status = lstatSync(file);
  if (
    !status.isFile()
    || status.isSymbolicLink()
    || status.nlink !== 1
    || (status.mode & 0o777) !== 0o600
    || status.size < 1
    || status.size > maximumBytes
    || realpathSync(file) !== file
  ) {
    refuse(`${label} boundary differs`);
  }
  if (typeof process.getuid === "function" && status.uid !== process.getuid()) {
    refuse(`${label} owner differs`);
  }
  return readFileSync(file);
}

function decodeBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    refuse("Finance public API credential format differs");
  }
}

function validateFinanceAnonKey(value) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 100
    || value.length > 2_048
    || /[\u0000-\u0020\u007f]/u.test(value)
  ) {
    refuse("Finance public API credential format differs");
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((item) => !/^[A-Za-z0-9_-]+$/u.test(item))) {
    refuse("Finance public API credential format differs");
  }
  const payload = decodeBase64UrlJson(parts[1]);
  if (
    payload === null
    || typeof payload !== "object"
    || Array.isArray(payload)
    || payload.role !== "anon"
    || payload.ref !== FINANCE_STAGING_REF
    || payload.iss !== "supabase"
  ) {
    refuse("Finance public API credential is not the reviewed staging anon key");
  }
  return value;
}

function parseReviewedFinancePublicApi(file) {
  const raw = readPrivateExternalFile(
    file,
    4 * 1_024,
    "Finance public API input",
  );
  const values = {};
  const source = raw.toString("utf8");
  if (source.includes("\u0000") || !source.endsWith("\n")) {
    refuse("Finance public API input format differs");
  }
  for (const line of source.slice(0, -1).split("\n")) {
    if (!line || line.includes("\r")) {
      refuse("Finance public API input format differs");
    }
    const separator = line.indexOf("=");
    if (separator < 1) refuse("Finance public API input format differs");
    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (
      !/^[A-Z][A-Z0-9_]+$/u.test(name)
      || Object.hasOwn(values, name)
      || !value
    ) {
      refuse("Finance public API input format differs");
    }
    values[name] = value;
  }
  exactKeys(
    values,
    [
      "FINANCE_PUBLIC_SUPABASE_ANON_KEY",
      "FINANCE_PUBLIC_SUPABASE_URL",
    ],
    "Finance public API input",
  );
  if (values.FINANCE_PUBLIC_SUPABASE_URL !== FINANCE_STAGING_ORIGIN) {
    refuse("Finance public API URL is not the exact reviewed staging target");
  }
  return Object.freeze({
    anonKey: validateFinanceAnonKey(
      values.FINANCE_PUBLIC_SUPABASE_ANON_KEY,
    ),
    raw,
  });
}

function validateReviewedReceipt(file, publicApi) {
  const raw = readPrivateExternalFile(
    file,
    4 * 1_024,
    "Finance public API receipt",
  );
  let receipt;
  try {
    receipt = JSON.parse(raw.toString("utf8"));
  } catch {
    refuse("Finance public API receipt format differs");
  }
  exactKeys(
    receipt,
    [
      "schemaVersion",
      "operation",
      "environment",
      "projectRef",
      "projectUrl",
      "keyKind",
      "keySha256",
      "envFileSha256",
      "state",
    ],
    "Finance public API receipt",
  );
  if (
    receipt.schemaVersion !== 1
    || receipt.operation !== "finance-staging-public-api-v1"
    || receipt.environment !== "staging"
    || receipt.projectRef !== FINANCE_STAGING_REF
    || receipt.projectUrl !== FINANCE_STAGING_ORIGIN
    || receipt.keyKind !== "legacy-anon"
    || receipt.keySha256 !== sha256(publicApi.anonKey)
    || receipt.envFileSha256 !== sha256(publicApi.raw)
    || receipt.state !== "success"
  ) {
    refuse("Finance public API receipt attestation differs");
  }
}

function parsedExactUrl(value, expectedOrigin) {
  let url;
  try {
    url = new URL(value);
  } catch {
    refuse("endpoint URL is malformed");
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || url.search
    || url.hash
    || url.origin !== expectedOrigin
    || url.href !== value
  ) {
    refuse("endpoint URL escaped the exact staging boundary");
  }
  return url;
}

function assertNoProductionTarget(value) {
  const source = JSON.stringify(value);
  if (
    source.includes(FINANCE_PRODUCTION_REF)
    || source.includes(MAIN_PRODUCTION_REF)
    || /(?:^|[^a-z])production(?:[^a-z]|$)/iu.test(source)
  ) {
    refuse("production target is forbidden");
  }
}

export function validateDisabledStagingBoundary(cases) {
  assertNoProductionTarget(cases);
  if (!Array.isArray(cases) || cases.length !== EXPECTED_CASE_SPECS.length) {
    refuse("five-endpoint inventory differs");
  }
  const normalized = cases.map((item, index) => {
    exactKeys(item, ["name", "url", "origin", "credential"], "endpoint");
    const expected = EXPECTED_CASE_SPECS[index];
    if (
      item.name !== expected.name
      || item.url !== expected.url
      || item.origin !== expected.origin
      || item.credential !== expected.credential
    ) {
      refuse("endpoint differs from the reviewed five-endpoint staging boundary");
    }
    const expectedOrigin = item.name.startsWith("finance-")
      ? FINANCE_STAGING_ORIGIN
      : MAIN_STAGING_ORIGIN;
    const url = parsedExactUrl(item.url, expectedOrigin);
    if (
      url.pathname !== `/functions/v1/${item.name.replace(/^main-/u, "")}`
      || (item.origin !== null
        && ![FINANCE_WEB_STAGING_ORIGIN, MAIN_WEB_STAGING_ORIGIN]
          .includes(item.origin))
    ) {
      refuse("endpoint route or Origin differs");
    }
    return Object.freeze({ ...item });
  });
  return Object.freeze(normalized);
}

function headersFor(item, financeAnonKey) {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (item.origin !== null) headers.set("Origin", item.origin);
  if (item.credential === "finance_anon") {
    headers.set("apikey", financeAnonKey);
    headers.set("Authorization", `Bearer ${financeAnonKey}`);
  }
  if (headers.has("cookie")) refuse("Cookie is forbidden");
  if (
    item.credential === "none"
    && (headers.has("authorization") || headers.has("apikey"))
  ) {
    refuse("ambient authorization is forbidden");
  }
  return headers;
}

function cancelUnreadBody(response) {
  try {
    if (response?.body && typeof response.body.cancel === "function") {
      Promise.resolve(response.body.cancel()).catch(() => {});
    }
  } catch {}
}

function malformedSetCookie(item) {
  refuse(`${item.name} response Set-Cookie metadata is malformed`);
}

function parsedSetCookieName(raw, item) {
  if (
    typeof raw !== "string"
    || raw.length < 1
    || Buffer.byteLength(raw, "utf8") > MAX_SET_COOKIE_BYTES
    || !/^[\x20-\x7E]+$/u.test(raw)
  ) {
    malformedSetCookie(item);
  }
  const parts = raw.split(";");
  if (parts.length > MAX_COOKIE_ATTRIBUTES + 1) {
    malformedSetCookie(item);
  }
  const cookiePair = parts[0];
  const separator = cookiePair.indexOf("=");
  if (separator < 1) malformedSetCookie(item);
  const name = cookiePair.slice(0, separator);
  const value = cookiePair.slice(separator + 1);
  if (
    Buffer.byteLength(name, "utf8") > MAX_COOKIE_NAME_BYTES
    || !COOKIE_NAME_TOKEN.test(name)
  ) {
    malformedSetCookie(item);
  }
  const normalizedValue = value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
  if (
    (value.startsWith('"') || value.endsWith('"'))
      && !(value.startsWith('"') && value.endsWith('"'))
    || !COOKIE_VALUE_OCTETS.test(normalizedValue)
  ) {
    malformedSetCookie(item);
  }
  for (const rawAttribute of parts.slice(1)) {
    const attribute = rawAttribute.trim();
    if (!attribute) malformedSetCookie(item);
    const attributeSeparator = attribute.indexOf("=");
    const attributeName = attributeSeparator === -1
      ? attribute
      : attribute.slice(0, attributeSeparator);
    const attributeValue = attributeSeparator === -1
      ? null
      : attribute.slice(attributeSeparator + 1);
    if (
      !COOKIE_NAME_TOKEN.test(attributeName)
      || (
        attributeValue !== null
        && !COOKIE_ATTRIBUTE_VALUE_OCTETS.test(attributeValue)
      )
    ) {
      malformedSetCookie(item);
    }
  }
  return name;
}

function setCookieNames(headers, item) {
  let combined;
  try {
    combined = headers.get("set-cookie");
  } catch {
    malformedSetCookie(item);
  }
  if (combined === null) return Object.freeze([]);
  if (typeof headers.getSetCookie !== "function") {
    malformedSetCookie(item);
  }
  let rawCookies;
  try {
    rawCookies = headers.getSetCookie();
  } catch {
    malformedSetCookie(item);
  }
  if (
    !Array.isArray(rawCookies)
    || rawCookies.length < 1
    || rawCookies.length > MAX_SET_COOKIE_COUNT
  ) {
    malformedSetCookie(item);
  }
  let totalBytes = 0;
  const names = [];
  const seen = new Set();
  for (const raw of rawCookies) {
    if (typeof raw !== "string") malformedSetCookie(item);
    totalBytes += Buffer.byteLength(raw, "utf8");
    if (totalBytes > MAX_SET_COOKIE_TOTAL_BYTES) {
      malformedSetCookie(item);
    }
    const name = parsedSetCookieName(raw, item);
    if (seen.has(name)) malformedSetCookie(item);
    seen.add(name);
    names.push(name);
  }
  return Object.freeze(names);
}

function responseHeaders(response, item) {
  if (!response?.headers || typeof response.headers.get !== "function") {
    cancelUnreadBody(response);
    refuse(`${item.name} response headers are unavailable`);
  }
  if (response.headers.get("content-type") !== EXACT_CONTENT_TYPE) {
    cancelUnreadBody(response);
    refuse(`${item.name} response Content-Type differs`);
  }
  for (const name of RESPONSE_FORBIDDEN_HEADERS) {
    if (response.headers.get(name) !== null) {
      cancelUnreadBody(response);
      refuse(`${item.name} response contains forbidden header ${name}`);
    }
  }
  const cookieNames = setCookieNames(response.headers, item);
  const forbiddenCookieNames = cookieNames.filter(
    name => !ALLOWED_STAGING_GATEWAY_COOKIE_NAMES.has(name),
  );
  if (forbiddenCookieNames.length > 0) {
    cancelUnreadBody(response);
    refuse(
      `${item.name} response contains forbidden Set-Cookie names: ${
        forbiddenCookieNames.join(", ")
      }`,
    );
  }
  const contentEncoding = response.headers.get("content-encoding");
  const normalizedContentEncoding = contentEncoding?.toLowerCase() ?? null;
  if (
    contentEncoding !== null
    && (
      contentEncoding !== contentEncoding.trim()
      || !ALLOWED_CONTENT_ENCODINGS.has(normalizedContentEncoding)
    )
  ) {
    cancelUnreadBody(response);
    refuse(`${item.name} response Content-Encoding differs`);
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const parsedContentLength = Number(contentLength);
    if (
      !/^(?:0|[1-9][0-9]*)$/u.test(contentLength)
      || !Number.isSafeInteger(parsedContentLength)
      || parsedContentLength > MAX_DISABLED_RESPONSE_BYTES
      || (
        normalizedContentEncoding === null
          ? parsedContentLength !== EXACT_DISABLED_BODY.byteLength
          : parsedContentLength < 1
      )
    ) {
      cancelUnreadBody(response);
      refuse(`${item.name} response Content-Length differs`);
    }
  }
}

function deadlineGuard(deadline, controller, itemName) {
  return async (promise) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      controller.abort(new DOMException("request timeout", "TimeoutError"));
      refuse(`${itemName} request timed out`);
    }
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort(new DOMException("request timeout", "TimeoutError"));
            reject(new Error("deadline exceeded"));
          }, remaining);
        }),
      ]);
    } catch {
      refuse(`${itemName} network result is unavailable`);
    } finally {
      clearTimeout(timer);
    }
  };
}

function responseChunk(value, itemName) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  refuse(`${itemName} response body contains an invalid chunk`);
}

async function readExactDisabledBody(response, item, withinDeadline) {
  if (!response.body || typeof response.body.getReader !== "function") {
    refuse(`${item.name} response streaming body is unavailable`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const result = await withinDeadline(reader.read());
      if (!result || typeof result.done !== "boolean") {
        refuse(`${item.name} response body reader result is invalid`);
      }
      if (result.done) break;
      const bytes = responseChunk(result.value, item.name);
      total += bytes.byteLength;
      if (
        total > EXACT_DISABLED_BODY.byteLength
        || total > MAX_DISABLED_RESPONSE_BYTES
      ) {
        try {
          await reader.cancel();
        } catch {}
        refuse(`${item.name} response body exceeds the exact disabled payload`);
      }
      chunks.push(Buffer.from(bytes));
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
  const body = Buffer.concat(chunks, total);
  if (!body.equals(EXACT_DISABLED_BODY)) {
    refuse(`${item.name} response body differs from the exact disabled payload`);
  }
}

async function verifyEndpoint({
  item,
  financeAnonKey,
  fetchImpl,
  timeoutMilliseconds,
}) {
  const headers = headersFor(item, financeAnonKey);
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMilliseconds;
  const withinDeadline = deadlineGuard(deadline, controller, item.name);
  let response;
  try {
    response = await withinDeadline(fetchImpl(item.url, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }));
    if (
      !response
      || response.status !== 503
      || response.redirected !== false
      || response.url !== item.url
    ) {
      cancelUnreadBody(response);
      refuse(`${item.name} did not return an exact direct 503 response`);
    }
    responseHeaders(response, item);
    await readExactDisabledBody(response, item, withinDeadline);
  } finally {
    controller.abort();
  }
  return Object.freeze({
    name: item.name,
    status: 503,
    disabled: true,
  });
}

export async function verifyDisabledStagingEdge({
  publicApiFile = DEFAULT_PUBLIC_API_FILE,
  publicApiReceiptFile = DEFAULT_PUBLIC_API_RECEIPT_FILE,
  fetchImpl = globalThis.fetch,
  timeoutMilliseconds = REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== "function") {
    refuse("fetch implementation is unavailable");
  }
  if (
    !Number.isSafeInteger(timeoutMilliseconds)
    || timeoutMilliseconds < 10
    || timeoutMilliseconds > REQUEST_TIMEOUT_MS
  ) {
    refuse("request timeout is outside the reviewed boundary");
  }
  const publicApi = parseReviewedFinancePublicApi(publicApiFile);
  validateReviewedReceipt(publicApiReceiptFile, publicApi);
  const cases = validateDisabledStagingBoundary(EXPECTED_CASE_SPECS);
  const results = [];
  for (const item of cases) {
    results.push(await verifyEndpoint({
      item,
      financeAnonKey: publicApi.anonKey,
      fetchImpl,
      timeoutMilliseconds,
    }));
  }
  return Object.freeze({
    ok: true,
    environment: "staging",
    productionTouched: false,
    exactDisabledResponseProved: true,
    cases: Object.freeze(results),
    credentialValidated: true,
    secretPrinted: false,
  });
}

export function buildDisabledStagingProofReceipt(
  result,
  {
    now = new Date(),
    verifierSource,
  },
) {
  if (
    result?.ok !== true
    || result.environment !== "staging"
    || result.productionTouched !== false
    || result.exactDisabledResponseProved !== true
    || result.credentialValidated !== true
    || result.secretPrinted !== false
    || !Array.isArray(result.cases)
    || result.cases.length !== EXPECTED_CASE_SPECS.length
  ) {
    refuse("proof receipt input is not an exact successful staging result");
  }
  const createdAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(createdAt.getTime())) {
    refuse("proof receipt time is invalid");
  }
  if (
    !(
      Buffer.isBuffer(verifierSource)
      || verifierSource instanceof Uint8Array
    )
    || verifierSource.byteLength < 1
  ) {
    refuse("proof receipt verifier source is unavailable");
  }
  const cases = result.cases.map((item, index) => {
    const expected = EXPECTED_CASE_SPECS[index];
    if (
      item?.name !== expected.name
      || item.status !== 503
      || item.disabled !== true
    ) {
      refuse("proof receipt case inventory differs");
    }
    return Object.freeze({
      name: expected.name,
      url: expected.url,
      status: 503,
      bodySha256: sha256(EXACT_DISABLED_BODY),
      disabled: true,
    });
  });
  const core = Object.freeze({
    schemaVersion: 1,
    kind: PROOF_RECEIPT_KIND,
    environment: "staging",
    financeProjectRef: FINANCE_STAGING_REF,
    mainProjectRef: MAIN_STAGING_REF,
    financeWebOrigin: FINANCE_WEB_STAGING_ORIGIN,
    mainWebOrigin: MAIN_WEB_STAGING_ORIGIN,
    verifierSourceSha256: sha256(verifierSource),
    exactDisabledBodySha256: sha256(EXACT_DISABLED_BODY),
    cases,
    productionDenied: true,
    credentialValidated: true,
    secretPrinted: false,
    createdAt: createdAt.toISOString(),
  });
  return Object.freeze({
    ...core,
    proofSha256: sha256(
      Buffer.from(`${JSON.stringify(core)}\n`, "utf8"),
    ),
  });
}

export function writeDisabledStagingProofReceipt(
  receiptPath,
  receipt,
) {
  if (
    typeof receiptPath !== "string"
    || !path.isAbsolute(receiptPath)
    || path.resolve(receiptPath) !== receiptPath
  ) {
    refuse("proof receipt path must be absolute and normalized");
  }
  const relativeToRepository = path.relative(repositoryRoot, receiptPath);
  if (
    relativeToRepository === ""
    || (
      relativeToRepository !== ".."
      && !relativeToRepository.startsWith(`..${path.sep}`)
    )
  ) {
    refuse("proof receipt must stay outside the repository");
  }
  const parent = path.dirname(receiptPath);
  const parentStatus = lstatSync(parent);
  if (
    !parentStatus.isDirectory()
    || parentStatus.isSymbolicLink()
    || realpathSync(parent) !== parent
    || (parentStatus.mode & 0o777) !== 0o700
    || (
      typeof process.getuid === "function"
      && parentStatus.uid !== process.getuid()
    )
  ) {
    refuse("proof receipt parent boundary differs");
  }
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const descriptor = openSync(
    receiptPath,
    constants.O_CREAT
      | constants.O_EXCL
      | constants.O_WRONLY
      | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(descriptor, bytes);
    fchmodSync(descriptor, 0o600);
    fsyncSync(descriptor);
    const status = fstatSync(descriptor);
    if (
      !status.isFile()
      || status.nlink !== 1
      || (status.mode & 0o777) !== 0o600
      || status.size !== bytes.byteLength
      || (
        typeof process.getuid === "function"
        && status.uid !== process.getuid()
      )
    ) {
      refuse("proof receipt file boundary differs after write");
    }
  } finally {
    closeSync(descriptor);
  }
  const finalStatus = lstatSync(receiptPath);
  if (
    !finalStatus.isFile()
    || finalStatus.isSymbolicLink()
    || finalStatus.nlink !== 1
    || (finalStatus.mode & 0o777) !== 0o600
    || realpathSync(receiptPath) !== receiptPath
    || !readFileSync(receiptPath).equals(bytes)
  ) {
    refuse("proof receipt path or bytes changed after write");
  }
  return receiptPath;
}

function argumentsFrom(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) refuse("--help cannot be combined");
    return Object.freeze({ help: true });
  }
  const result = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (![
      "--finance-public-api",
      "--finance-public-api-receipt",
      "--proof-receipt",
    ].includes(flag)) {
      refuse(`unknown argument: ${flag ?? "<missing>"}`);
    }
    if (seen.has(flag)) refuse(`duplicate argument: ${flag}`);
    if (typeof value !== "string" || !value || value.startsWith("--")) {
      refuse(`missing value for ${flag}`);
    }
    seen.add(flag);
    result[flag] = value;
  }
  return Object.freeze({
    publicApiFile: result["--finance-public-api"] ?? DEFAULT_PUBLIC_API_FILE,
    publicApiReceiptFile:
      result["--finance-public-api-receipt"]
      ?? DEFAULT_PUBLIC_API_RECEIPT_FILE,
    proofReceiptFile: result["--proof-receipt"] ?? null,
  });
}

function printHelp() {
  process.stdout.write([
    "Usage:",
    "  node scripts/verify-disabled-staging-edge.mjs",
    "  node scripts/verify-disabled-staging-edge.mjs \\",
    "    --finance-public-api /absolute/private/0600/input.env \\",
    "    --finance-public-api-receipt /absolute/private/0600/receipt.json \\",
    "    --proof-receipt /absolute/private/0600/disabled-proof.json",
    "",
    "Runs five credential-safe POST probes against the exact reviewed Finance",
    "and Main staging Supabase refs. It never prints the Finance anon key.",
    "",
  ].join("\n"));
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const verifierSource = readFileSync(scriptFile);
  const verifierSourceSha256 = sha256(verifierSource);
  const result = await verifyDisabledStagingEdge(options);
  if (sha256(readFileSync(scriptFile)) !== verifierSourceSha256) {
    refuse("verifier source changed during the live run");
  }
  let output = result;
  if (options.proofReceiptFile !== null) {
    const receipt = buildDisabledStagingProofReceipt(result, {
      verifierSource,
    });
    writeDisabledStagingProofReceipt(
      options.proofReceiptFile,
      receipt,
    );
    output = Object.freeze({
      ...result,
      proofReceiptPath: options.proofReceiptFile,
      proofSha256: receipt.proofSha256,
    });
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(
      `${
        error instanceof Error
          ? error.message
          : "Disabled staging Edge verification refused: internal failure"
      }\n`,
    );
    process.exitCode = 1;
  });
}
