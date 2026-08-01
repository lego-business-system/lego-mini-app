#!/usr/bin/env node

import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertSafeExternalOutputDirectory,
  financePilotCloudflarePagesHeaders,
  financePilotConfigScript,
  financePilotContentSecurityPolicy,
  readReviewedExternalJson,
  validateFinancePilotStagingConfig,
  validateProductionBoundary,
} from "./finance-pilot-safety.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const EXPECTED_FILES = Object.freeze([
  "_headers",
  "architecture-finance.css",
  "architecture-finance.js",
  "finance-pilot-config.js",
  "index.html",
  "pilot-shell.css",
  "pilot-shell.js",
]);

function argumentsFrom(argv) {
  const result = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--artifact", "--config", "--production-boundary"].includes(flag)) {
      throw new Error(`unknown argument: ${flag ?? "<missing>"}`);
    }
    if (seen.has(flag)) throw new Error(`duplicate argument: ${flag}`);
    if (typeof value !== "string" || !value || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    seen.add(flag);
    result[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  for (const name of ["artifact", "config", "productionBoundary"]) {
    if (!result[name]) throw new Error(`--${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)} is required`);
  }
  return Object.freeze(result);
}

function expectedIndex(config) {
  const template = readFileSync(
    path.join(REPOSITORY_ROOT, "finance-pilot", "index.template.html"),
    "utf8",
  );
  if ((template.match(/__FINANCE_PILOT_CSP__/g) || []).length !== 1) {
    throw new Error("Finance pilot template must contain one CSP placeholder");
  }
  const csp = financePilotContentSecurityPolicy(config)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  return template.replace("__FINANCE_PILOT_CSP__", csp);
}

function assertRegularArtifactFile(directory, name) {
  const file = path.join(directory, name);
  const status = lstatSync(file);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`artifact member must be a regular non-symlink file: ${name}`);
  }
  return file;
}

export function verifyFinancePilotArtifact({
  artifactDirectory,
  config,
  productionBoundary,
}) {
  const artifact = assertSafeExternalOutputDirectory(REPOSITORY_ROOT, artifactDirectory);
  const artifactStatus = lstatSync(artifact);
  if (!artifactStatus.isDirectory() || artifactStatus.isSymbolicLink()) {
    throw new Error("artifact must be a real non-symlink directory");
  }
  const realArtifact = realpathSync(artifact);
  const names = readdirSync(realArtifact).sort();
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_FILES)) {
    throw new Error(`artifact file allow-list differs: ${names.join(", ")}`);
  }

  const expectedSources = new Map([
    ["_headers", financePilotCloudflarePagesHeaders(config)],
    ["architecture-finance.css", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "architecture-finance.css"), "utf8")],
    ["architecture-finance.js", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "architecture-finance.js"), "utf8")],
    ["finance-pilot-config.js", financePilotConfigScript(config)],
    ["index.html", expectedIndex(config)],
    ["pilot-shell.css", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "pilot-shell.css"), "utf8")],
    ["pilot-shell.js", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "pilot-shell.js"), "utf8")],
  ]);
  const sources = [];
  const actualSources = new Map();
  for (const name of EXPECTED_FILES) {
    const actual = readFileSync(assertRegularArtifactFile(realArtifact, name), "utf8");
    if (actual !== expectedSources.get(name)) throw new Error(`artifact member drifted: ${name}`);
    actualSources.set(name, actual);
    sources.push(actual);
  }
  const combined = sources.join("\n");
  if (/(?:^|["'/])app\.js(?:[?"'<\s]|$)|(?:^|["'/])forum(?:\.js|\.css)(?:[?"'<\s]|$)|(?:^|["'/])business-architecture(?:\.js|\.css)(?:[?"'<\s]|$)/u.test(combined)) {
    throw new Error("full Main application asset leaked into Finance pilot artifact");
  }
  if (/MAIN_SERVICE_ROLE_KEY|service[_-]?role[_-]?key|HMAC_SECRET|BOT_TOKEN|SUPABASE_ACCESS_TOKEN/iu.test(combined)) {
    throw new Error("server secret name leaked into Finance pilot artifact");
  }
  const boundary = validateProductionBoundary(productionBoundary);
  for (const productionValue of Object.values(boundary)) {
    if (combined.includes(productionValue)) {
      throw new Error("production URL leaked into Finance pilot artifact");
    }
  }
  const index = expectedSources.get("index.html");
  const contentSecurityPolicy = financePilotContentSecurityPolicy(config);
  const directives = new Map(contentSecurityPolicy.split("; ").map((directive) => {
    const separator = directive.indexOf(" ");
    return separator === -1
      ? [directive, ""]
      : [directive.slice(0, separator), directive.slice(separator + 1)];
  }));
  if (directives.get("connect-src") !== config.mainEdgeOrigin) {
    throw new Error("artifact CSP does not pin the exact Main staging origin");
  }
  if (directives.get("frame-ancestors") !== "https://web.telegram.org") {
    throw new Error("artifact CSP must allow only the exact Telegram Web frame ancestor");
  }
  const expectedHttpHeaders = [
    ["Content-Security-Policy", contentSecurityPolicy],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "no-referrer"],
    ["Permissions-Policy", "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), publickey-credentials-get=(), usb=()"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Cross-Origin-Resource-Policy", "same-origin"],
  ];
  const headerLines = actualSources.get("_headers").split("\n");
  if (headerLines.at(-1) === "") headerLines.pop();
  const expectedHeaderLines = [
    "/*",
    ...expectedHttpHeaders.map(([name, value]) => `  ${name}: ${value}`),
  ];
  if (JSON.stringify(headerLines) !== JSON.stringify(expectedHeaderLines)) {
    throw new Error("artifact HTTP security headers differ from the exact allow-list");
  }
  if ((index.match(/<script\b/gu) || []).length !== 4 || /<script\b[^>]*>\s*[^<]/u.test(index)) {
    throw new Error("artifact scripts must be the exact external/local allow-list without inline code");
  }
  return Object.freeze({
    ok: true,
    environment: "staging",
    artifactDirectory: realArtifact,
    files: EXPECTED_FILES,
  });
}

export function verifyFinancePilotArtifactFromFiles({ artifact, config, productionBoundary }) {
  const reviewedConfig = readReviewedExternalJson(config, REPOSITORY_ROOT, "Finance pilot config");
  const reviewedBoundary = readReviewedExternalJson(
    productionBoundary,
    REPOSITORY_ROOT,
    "production boundary",
  );
  validateProductionBoundary(reviewedBoundary.value);
  const validatedConfig = validateFinancePilotStagingConfig(
    reviewedConfig.value,
    reviewedBoundary.value,
  );
  return verifyFinancePilotArtifact({
    artifactDirectory: artifact,
    config: validatedConfig,
    productionBoundary: reviewedBoundary.value,
  });
}

async function main() {
  const input = argumentsFrom(process.argv.slice(2));
  const result = verifyFinancePilotArtifactFromFiles(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`Finance pilot artifact verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
