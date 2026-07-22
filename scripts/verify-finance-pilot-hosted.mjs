#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readReviewedExternalJson,
  validateFinancePilotStagingConfig,
  validateProductionBoundary,
} from "./finance-pilot-safety.mjs";
import { verifyFinancePilotArtifact } from "./verify-finance-pilot-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_HOSTED_FILE_BYTES = 512 * 1024;
const FINANCE_PILOT_HOSTED_HOSTNAME = "architecture-main-pilot.pages.dev";

export const FINANCE_PILOT_HOSTED_ROUTES = Object.freeze([
  Object.freeze({ file: "index.html", pathname: "/", mime: "text/html" }),
  Object.freeze({ file: "architecture-finance.css", pathname: "/architecture-finance.css", mime: "text/css" }),
  Object.freeze({ file: "architecture-finance.js", pathname: "/architecture-finance.js", mime: "application/javascript" }),
  Object.freeze({ file: "finance-pilot-config.js", pathname: "/finance-pilot-config.js", mime: "application/javascript" }),
  Object.freeze({ file: "pilot-shell.css", pathname: "/pilot-shell.css", mime: "text/css" }),
  Object.freeze({ file: "pilot-shell.js", pathname: "/pilot-shell.js", mime: "application/javascript" }),
]);

function fail(message) {
  throw new Error(`Finance pilot hosted verification refused: ${message}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateFinancePilotHostedPublicOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("publicOrigin must be the exact reviewed Cloudflare Pages pilot origin");
  }
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.includes("*")
    || parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.hostname !== FINANCE_PILOT_HOSTED_HOSTNAME
    || parsed.port
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || parsed.origin !== value
  ) {
    fail("publicOrigin must be the exact reviewed Cloudflare Pages pilot origin");
  }
  return parsed.origin;
}

function argumentsFrom(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) fail("--help cannot be combined with other arguments");
    return { help: true };
  }
  const result = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--artifact", "--config", "--production-boundary"].includes(flag)) {
      fail(`unknown argument: ${flag ?? "<missing>"}`);
    }
    if (seen.has(flag)) fail(`duplicate argument: ${flag}`);
    if (typeof value !== "string" || !value || value.startsWith("--")) {
      fail(`missing value for ${flag}`);
    }
    seen.add(flag);
    result[flag.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
  }
  for (const name of ["artifact", "config", "productionBoundary"]) {
    if (!result[name]) {
      fail(`--${name.replace(/[A-Z]/gu, letter => `-${letter.toLowerCase()}`)} is required`);
    }
  }
  return Object.freeze(result);
}

function parseHeaderContract(source) {
  const lines = source.split("\n");
  if (lines.shift() !== "/*" || lines.at(-1) !== "") {
    fail("local _headers contract has an invalid envelope");
  }
  lines.pop();
  const headers = new Map();
  for (const line of lines) {
    const match = /^  ([A-Za-z][A-Za-z0-9-]*): (\S(?:.*\S)?)$/u.exec(line);
    if (!match) fail("local _headers contract contains an invalid line");
    const name = match[1].toLowerCase();
    if (headers.has(name)) fail("local _headers contract contains a duplicate header");
    headers.set(name, match[2]);
  }
  if (headers.size === 0) fail("local _headers contract is empty");
  return headers;
}

function exactResponseMime(headers, expected, file) {
  if (!headers || typeof headers.get !== "function") {
    fail(`hosted response headers are unavailable for ${file}`);
  }
  const contentType = headers.get("content-type");
  if (typeof contentType !== "string" || !contentType.trim()) {
    fail(`hosted MIME is missing for ${file}`);
  }
  const mime = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mime !== expected || contentType.includes(",")) {
    fail(`hosted MIME differs for ${file}`);
  }
  return mime;
}

function assertSecurityHeaders(headers, contract, file) {
  for (const [name, expected] of contract) {
    const actual = headers.get(name);
    if (actual !== expected) fail(`hosted security header differs for ${file}: ${name}`);
  }
}

function numericContentLength(headers, expectedLength, file) {
  const source = headers.get("content-length");
  if (source === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/u.test(source)) {
    fail(`hosted Content-Length is invalid for ${file}`);
  }
  const value = Number(source);
  if (!Number.isSafeInteger(value) || value > MAX_HOSTED_FILE_BYTES) {
    fail(`hosted Content-Length exceeds the limit for ${file}`);
  }
  if (value !== expectedLength) fail(`hosted Content-Length differs for ${file}`);
  return value;
}

function chunkBytes(value, file) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  fail(`hosted body contains an invalid chunk for ${file}`);
}

function cancelUnreadResponseBody(response) {
  const stream = response?.body;
  if (!stream || typeof stream !== "object") return;
  try {
    if (typeof stream.cancel === "function") {
      Promise.resolve(stream.cancel()).catch(() => {});
      return;
    }
    if (typeof stream.getReader !== "function") return;
    const reader = stream.getReader();
    try {
      Promise.resolve(reader.cancel()).catch(() => {});
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  } catch {}
}

async function readBoundedBody(response, expectedBytes, file, withinDeadline) {
  if (expectedBytes.length > MAX_HOSTED_FILE_BYTES) {
    fail(`local artifact exceeds the hosted verifier limit for ${file}`);
  }
  numericContentLength(response.headers, expectedBytes.length, file);
  const maximum = expectedBytes.length;
  const chunks = [];
  let total = 0;

  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    try {
      while (true) {
        const item = await withinDeadline(reader.read());
        if (!item || typeof item.done !== "boolean") {
          fail(`hosted body reader returned an invalid result for ${file}`);
        }
        if (item.done) break;
        const bytes = chunkBytes(item.value, file);
        total += bytes.byteLength;
        if (total > maximum || total > MAX_HOSTED_FILE_BYTES) {
          try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
          fail(`hosted body exceeds the exact artifact size for ${file}`);
        }
        chunks.push(Buffer.from(bytes));
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  } else {
    fail(`hosted streaming body is unavailable for ${file}`);
  }

  const body = Buffer.concat(chunks, total);
  return body;
}

function assertNoHostedPlaceholder(file, bytes) {
  if (file === "index.html") {
    const source = bytes.toString("utf8");
    if (
      source.includes("АРХИТЕКТУРА — тестовый контур")
      || source.includes("Доступ закрыт до завершения безопасной настройки Telegram-пилота.")
    ) fail("the placeholder shell is still hosted");
  }
  if (file === "finance-pilot-config.js") {
    const source = bytes.toString("utf8").toLowerCase();
    if (
      source.includes(".invalid")
      || source.includes("replace_with_real_pilot_bot")
      || source.includes("architecturepilotpendingbot")
      || source.includes("architectureplaceholderbot")
    ) fail("the placeholder config is still hosted");
  }
}

function assertRouteContract(artifactFiles) {
  const expectedPublicFiles = artifactFiles.filter(file => file !== "_headers").sort();
  const actualPublicFiles = [...new Set(FINANCE_PILOT_HOSTED_ROUTES.map(route => route.file))].sort();
  const paths = FINANCE_PILOT_HOSTED_ROUTES.map(route => route.pathname);
  if (
    JSON.stringify(actualPublicFiles) !== JSON.stringify(expectedPublicFiles)
    || FINANCE_PILOT_HOSTED_ROUTES.length !== 6
    || new Set(paths).size !== 6
    || paths[0] !== "/"
  ) {
    fail("hosted route allow-list differs from the exact six public artifact routes");
  }
}

async function fetchExactHostedFile({
  fetchImpl,
  config,
  route,
  expectedBytes,
  securityHeaders,
  requestTimeoutMs,
}) {
  const target = new URL(route.pathname, `${config.publicOrigin}/`);
  if (
    target.origin !== config.publicOrigin
    || target.username
    || target.password
    || target.search
    || target.hash
    || target.pathname !== route.pathname
  ) fail(`hosted request target is unsafe for ${route.file}`);

  const controller = new AbortController();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("hosted request deadline exceeded"));
    }, requestTimeoutMs);
  });
  const withinDeadline = promise => Promise.race([Promise.resolve(promise), deadline]);
  let response;
  let body;
  let succeeded = false;
  let responseBodyConsumed = false;
  try {
    response = await withinDeadline(fetchImpl(target.href, {
      method: "GET",
      headers: Object.freeze({
        Accept: route.mime,
        "Accept-Encoding": "identity",
      }),
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }));
    if (!response || typeof response !== "object") {
      fail(`hosted response is unavailable for ${route.file}`);
    }
    if (
      response.redirected !== false
      || (Number.isInteger(response.status) && response.status >= 300 && response.status <= 399)
    ) fail(`hosted response redirected for ${route.file}`);
    if (response.status !== 200) fail(`hosted status is not 200 for ${route.file}`);
    if (typeof response.url !== "string" || response.url !== target.href) {
      let finalOrigin = "";
      try { finalOrigin = new URL(response.url).origin; } catch {}
      if (finalOrigin && finalOrigin !== config.publicOrigin) {
        fail(`hosted response crossed origin for ${route.file}`);
      }
      fail(`hosted final URL differs for ${route.file}`);
    }
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== config.publicOrigin) fail(`hosted response crossed origin for ${route.file}`);
    const mime = exactResponseMime(response.headers, route.mime, route.file);
    assertSecurityHeaders(response.headers, securityHeaders, route.file);
    body = await readBoundedBody(response, expectedBytes, route.file, withinDeadline);
    responseBodyConsumed = true;
    assertNoHostedPlaceholder(route.file, body);
    if (body.length !== expectedBytes.length || !body.equals(expectedBytes)) {
      fail(`hosted bytes differ for ${route.file}`);
    }
    const result = Object.freeze({
      file: route.file,
      path: route.pathname,
      bytes: body.length,
      mime,
      sha256: sha256(body),
    });
    succeeded = true;
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Finance pilot hosted verification refused:")) {
      throw error;
    }
    fail(`hosted request failed for ${route.file}`);
  } finally {
    clearTimeout(timeout);
    if (!succeeded) {
      controller.abort();
      if (response && !responseBodyConsumed) cancelUnreadResponseBody(response);
    }
  }
}

export async function verifyFinancePilotHosted({
  artifactDirectory,
  configFile,
  productionBoundaryFile,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
}) {
  if (typeof fetchImpl !== "function") fail("fetch implementation is unavailable");
  if (
    !Number.isInteger(requestTimeoutMs)
    || requestTimeoutMs < 1
    || requestTimeoutMs > REQUEST_TIMEOUT_MS
  ) fail(`request timeout must be between 1 and ${REQUEST_TIMEOUT_MS} milliseconds`);
  const reviewedConfig = readReviewedExternalJson(
    configFile,
    REPOSITORY_ROOT,
    "Finance pilot config",
  );
  const reviewedBoundary = readReviewedExternalJson(
    productionBoundaryFile,
    REPOSITORY_ROOT,
    "production boundary",
  );
  validateProductionBoundary(reviewedBoundary.value);
  if (reviewedBoundary.value.schemaVersion !== 2) {
    fail("production boundary must include the exact production publicOrigin");
  }
  const config = validateFinancePilotStagingConfig(reviewedConfig.value, reviewedBoundary.value);
  validateFinancePilotHostedPublicOrigin(config.publicOrigin);

  const artifact = verifyFinancePilotArtifact({
    artifactDirectory,
    config,
    productionBoundary: reviewedBoundary.value,
  });
  assertRouteContract(artifact.files);
  const localFiles = new Map(artifact.files.map(file => [
    file,
    readFileSync(path.join(artifact.artifactDirectory, file)),
  ]));
  const securityHeaders = parseHeaderContract(localFiles.get("_headers").toString("utf8"));
  const artifactSet = artifact.files
    .map(file => `${file}\0${sha256(localFiles.get(file))}\n`)
    .join("");

  const routes = [];
  for (const route of FINANCE_PILOT_HOSTED_ROUTES) {
    routes.push(await fetchExactHostedFile({
      fetchImpl,
      config,
      route,
      expectedBytes: localFiles.get(route.file),
      securityHeaders,
      requestTimeoutMs,
    }));
  }
  const hostedRouteSet = routes
    .map(file => `${file.path}\0${file.file}\0${file.sha256}\n`)
    .join("");
  return Object.freeze({
    ok: true,
    mode: "hosted_read_only",
    environment: "staging",
    target_origin_sha256: sha256(config.publicOrigin),
    config_sha256: reviewedConfig.sha256,
    production_boundary_sha256: reviewedBoundary.sha256,
    artifact_file_count: artifact.files.length,
    artifact_set_sha256: sha256(artifactSet),
    hosted_route_set_sha256: sha256(hostedRouteSet),
    request_count: routes.length,
    redirects_followed: false,
    credentials_sent: false,
    hosted_write_performed: false,
    routes: Object.freeze(routes),
  });
}

async function main() {
  const input = argumentsFrom(process.argv.slice(2));
  if (input.help) {
    process.stdout.write([
      "Read-only hosted verification:",
      "  verify-finance-pilot-hosted.mjs --artifact ABS_PATH --config ABS_PATH --production-boundary ABS_PATH",
      "The verifier performs six credential-free GET requests and validates all seven local artifact files.",
      "",
    ].join("\n"));
    return;
  }
  const result = await verifyFinancePilotHosted({
    artifactDirectory: input.artifact,
    configFile: input.config,
    productionBoundaryFile: input.productionBoundary,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      mode: "hosted_read_only",
      error: "verification_refused",
      details_withheld: true,
      hosted_write_performed: false,
    })}\n`);
    process.exitCode = 1;
  });
}
