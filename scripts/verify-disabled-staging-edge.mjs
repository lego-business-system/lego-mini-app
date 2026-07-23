#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const RESPONSE_FORBIDDEN_HEADERS = Object.freeze([
  "authentication-info",
  "content-encoding",
  "location",
  "proxy-authenticate",
  "proxy-authentication-info",
  "set-cookie",
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
      refuse(`${item.name} response contains forbidden ambient metadata`);
    }
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (
      !/^(?:0|[1-9][0-9]*)$/u.test(contentLength)
      || Number(contentLength) !== EXACT_DISABLED_BODY.byteLength
      || Number(contentLength) > MAX_DISABLED_RESPONSE_BYTES
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
    if (!["--finance-public-api", "--finance-public-api-receipt"].includes(flag)) {
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
  });
}

function printHelp() {
  process.stdout.write([
    "Usage:",
    "  node scripts/verify-disabled-staging-edge.mjs",
    "  node scripts/verify-disabled-staging-edge.mjs \\",
    "    --finance-public-api /absolute/private/0600/input.env \\",
    "    --finance-public-api-receipt /absolute/private/0600/receipt.json",
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
  const result = await verifyDisabledStagingEdge(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
