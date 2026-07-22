import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

export const FINANCE_ISSUE_PATH = "/functions/v1/finance-issue-code";
export const FINANCE_PILOT_HANDLER_SOURCES = Object.freeze([
  "copyArchitectureFinanceCodeV128()",
  "openArchitectureFinanceWebsiteV128()",
  "issueArchitectureFinanceCodeV128()",
  "closeArchitectureFinanceV128()",
  "renderArchitectureFinanceV128()",
]);

function assertExactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} keys must be exactly: ${wanted.join(", ")}`);
  }
}

export function rejectDuplicateJsonKeys(source, label) {
  let index = 0;
  function whitespace() {
    while (/\s/u.test(source[index] || "")) index += 1;
  }
  function stringToken() {
    const start = index;
    if (source[index] !== '"') throw new Error(`${label} contains invalid JSON`);
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index));
      }
      if (character === "\\") index += 2;
      else index += 1;
    }
    throw new Error(`${label} contains invalid JSON`);
  }
  function value() {
    whitespace();
    if (source[index] === "{") return object();
    if (source[index] === "[") return array();
    if (source[index] === '"') {
      stringToken();
      return;
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(
      source.slice(index),
    );
    if (!match) throw new Error(`${label} contains invalid JSON`);
    index += match[0].length;
  }
  function object() {
    const keys = new Set();
    index += 1;
    whitespace();
    if (source[index] === "}") {
      index += 1;
      return;
    }
    while (index < source.length) {
      whitespace();
      const key = stringToken();
      if (keys.has(key)) throw new Error(`${label} contains duplicate key: ${key}`);
      keys.add(key);
      whitespace();
      if (source[index] !== ":") throw new Error(`${label} contains invalid JSON`);
      index += 1;
      value();
      whitespace();
      if (source[index] === "}") {
        index += 1;
        return;
      }
      if (source[index] !== ",") throw new Error(`${label} contains invalid JSON`);
      index += 1;
    }
    throw new Error(`${label} contains invalid JSON`);
  }
  function array() {
    index += 1;
    whitespace();
    if (source[index] === "]") {
      index += 1;
      return;
    }
    while (index < source.length) {
      value();
      whitespace();
      if (source[index] === "]") {
        index += 1;
        return;
      }
      if (source[index] !== ",") throw new Error(`${label} contains invalid JSON`);
      index += 1;
    }
    throw new Error(`${label} contains invalid JSON`);
  }
  value();
  whitespace();
  if (index !== source.length) throw new Error(`${label} contains invalid JSON`);
}

export function readReviewedExternalJson(file, repositoryRoot, label) {
  if (typeof file !== "string" || !path.isAbsolute(file) || file !== file.trim()) {
    throw new Error(`${label} must be an absolute path`);
  }
  const root = realpathSync(repositoryRoot);
  const requested = path.resolve(file);
  const requestedRelative = path.relative(root, requested);
  if (
    requestedRelative === ""
    || (!requestedRelative.startsWith(`..${path.sep}`) && requestedRelative !== "..")
  ) throw new Error(`${label} must be outside the repository`);
  const status = lstatSync(requested);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  const realFile = realpathSync(requested);
  const realRelative = path.relative(root, realFile);
  if (realRelative === "" || (!realRelative.startsWith(`..${path.sep}`) && realRelative !== "..")) {
    throw new Error(`${label} must be outside the repository`);
  }

  let descriptor;
  try {
    descriptor = openSync(realFile, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.size < 2 || opened.size > 16 * 1024) {
      throw new Error(`${label} must be a regular file of at most 16 KiB`);
    }
    if ((opened.mode & 0o022) !== 0) {
      throw new Error(`${label} must not be group- or world-writable`);
    }
    if (typeof process.geteuid === "function" && opened.uid !== process.geteuid()) {
      throw new Error(`${label} must be owned by the current user`);
    }
    const source = readFileSync(descriptor, "utf8");
    rejectDuplicateJsonKeys(source, label);
    return Object.freeze({
      value: JSON.parse(source),
      source,
      sha256: createHash("sha256").update(source, "utf8").digest("hex"),
    });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function exactHttpsOrigin(value, label) {
  if (typeof value !== "string" || value !== value.trim() || value.includes("*")) {
    throw new Error(`${label} must be one exact HTTPS origin`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be one exact HTTPS origin`);
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.hostname.endsWith(".")
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || parsed.origin !== value
  ) throw new Error(`${label} must be one exact HTTPS origin`);
  return parsed.origin;
}

export function exactTelegramMiniAppUrl(value, label) {
  if (typeof value !== "string" || value !== value.trim()) {
    throw new Error(`${label} must be one exact Telegram Mini App URL`);
  }
  const match = /^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{1,28}[Bb][Oo][Tt])\?startapp$/u.exec(value);
  if (!match) throw new Error(`${label} must be one exact Telegram Mini App URL`);
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:"
    || parsed.hostname !== "t.me"
    || parsed.port
    || parsed.username
    || parsed.password
    || parsed.pathname !== `/${match[1]}`
    || parsed.search !== "?startapp"
    || parsed.hash
    || parsed.href !== value
  ) throw new Error(`${label} must be one exact Telegram Mini App URL`);
  return `https://t.me/${match[1].toLowerCase()}?startapp`;
}

function assertDeployableStagingTelegramBot(value, publicOrigin) {
  // A reserved .invalid origin is an intentionally inert bootstrap artifact
  // used only to discover a Pages hostname. It can retain a placeholder bot,
  // while any artifact capable of matching a real host must name a reviewed
  // bot candidate.
  if (new URL(publicOrigin).hostname.endsWith(".invalid")) return;
  const username = new URL(value).pathname.slice(1, -3).toLowerCase();
  const nonDeployableMarkers = [
    "dummy",
    "example",
    "fake",
    "pending",
    "placeholder",
    "replace",
  ];
  if (nonDeployableMarkers.some(marker => username.includes(marker))) {
    throw new Error("staging telegramMiniAppUrl must name the reviewed real pilot bot");
  }
}

export function validateProductionBoundary(boundary) {
  assertExactKeys(boundary, [
    "schemaVersion",
    "mainEdgeOrigin",
    "financeWebOrigin",
    "telegramMiniAppUrl",
  ], "production boundary");
  if (boundary.schemaVersion !== 1) {
    throw new Error("unsupported production boundary schemaVersion");
  }
  return Object.freeze({
    mainEdgeOrigin: exactHttpsOrigin(boundary.mainEdgeOrigin, "production mainEdgeOrigin"),
    financeWebOrigin: exactHttpsOrigin(boundary.financeWebOrigin, "production financeWebOrigin"),
    telegramMiniAppUrl: exactTelegramMiniAppUrl(
      boundary.telegramMiniAppUrl,
      "production telegramMiniAppUrl",
    ),
  });
}

export function validateFinancePilotStagingConfig(source, productionBoundary) {
  assertExactKeys(source, [
    "schemaVersion",
    "environment",
    "publicOrigin",
    "mainEdgeOrigin",
    "financeWebOrigin",
    "telegramMiniAppUrl",
    "features",
  ], "Finance pilot config");
  assertExactKeys(source.features, ["issueCode"], "Finance pilot features");
  if (source.schemaVersion !== 1) throw new Error("unsupported Finance pilot schemaVersion");
  if (source.environment !== "staging") throw new Error("Finance pilot build is staging-only");
  if (source.features.issueCode !== true) {
    throw new Error("Finance pilot issueCode gate must be exactly true");
  }

  const publicOrigin = exactHttpsOrigin(source.publicOrigin, "publicOrigin");
  const mainEdgeOrigin = exactHttpsOrigin(source.mainEdgeOrigin, "mainEdgeOrigin");
  const financeWebOrigin = exactHttpsOrigin(source.financeWebOrigin, "financeWebOrigin");
  const telegramMiniAppUrl = exactTelegramMiniAppUrl(
    source.telegramMiniAppUrl,
    "telegramMiniAppUrl",
  );
  assertDeployableStagingTelegramBot(telegramMiniAppUrl, publicOrigin);
  const mainHost = new URL(mainEdgeOrigin).hostname;
  if (!mainHost.endsWith(".supabase.co") || new URL(mainEdgeOrigin).port) {
    throw new Error("mainEdgeOrigin must be one exact Supabase project origin");
  }
  if (new Set([publicOrigin, mainEdgeOrigin, financeWebOrigin]).size !== 3) {
    throw new Error("pilot, Main Edge and Finance website origins must be different");
  }

  const boundary = validateProductionBoundary(productionBoundary);
  const candidateValues = [publicOrigin, mainEdgeOrigin, financeWebOrigin, telegramMiniAppUrl];
  const productionValues = new Set(Object.values(boundary));
  for (const value of candidateValues) {
    if (productionValues.has(value)) throw new Error("staging Finance pilot resolves to production");
  }

  return Object.freeze({
    schemaVersion: 1,
    environment: "staging",
    publicOrigin,
    mainEdgeOrigin,
    financeWebOrigin,
    telegramMiniAppUrl,
    features: Object.freeze({ issueCode: true }),
  });
}

export function financePilotConfigScript(config) {
  const json = JSON.stringify(config, null, 2).replaceAll("<", "\\u003c");
  return `(function installFinancePilotConfig(root) {\n  "use strict";\n  if (!root || Object.prototype.hasOwnProperty.call(root, "ARCHITECTURE_FINANCE_PILOT_CONFIG")) return;\n  var config = ${json};\n  Object.freeze(config.features);\n  Object.freeze(config);\n  Object.defineProperty(root, "ARCHITECTURE_FINANCE_PILOT_CONFIG", {\n    value: config,\n    configurable: false,\n    enumerable: false,\n    writable: false\n  });\n})(typeof window === "object" ? window : globalThis);\n`;
}

export function financePilotContentSecurityPolicy(config) {
  const handlerHashes = FINANCE_PILOT_HANDLER_SOURCES.map((source) => (
    `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`
  ));
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self' https://telegram.org/js/telegram-web-app.js",
    `script-src-attr 'unsafe-hashes' ${handlerHashes.join(" ")}`,
    "style-src 'self'",
    "img-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "worker-src 'none'",
    `connect-src ${config.mainEdgeOrigin}`,
    "form-action 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function financePilotCloudflarePagesHeaders(config) {
  const contentSecurityPolicy = financePilotContentSecurityPolicy(config);
  return [
    "/*",
    `  Content-Security-Policy: ${contentSecurityPolicy}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), publickey-credentials-get=(), usb=()",
    "  Cross-Origin-Opener-Policy: same-origin",
    "  Cross-Origin-Resource-Policy: same-origin",
    "",
  ].join("\n");
}

export function assertSafeExternalOutputDirectory(repositoryRoot, outputDirectory) {
  const root = path.resolve(repositoryRoot);
  const output = path.resolve(outputDirectory);
  const realRoot = realpathSync(root);
  let ancestor = output;
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error("output directory has no existing ancestor");
    ancestor = parent;
  }
  if (!statSync(ancestor).isDirectory()) throw new Error("output ancestor must be a directory");
  const projected = path.resolve(realpathSync(ancestor), path.relative(ancestor, output));
  if (projected === realRoot || projected.startsWith(realRoot + path.sep)) {
    throw new Error("output directory must be outside the repository");
  }
  return output;
}
