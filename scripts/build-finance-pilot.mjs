#!/usr/bin/env node

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
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
import { verifyFinancePilotArtifact } from "./verify-finance-pilot-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");

function argumentsFrom(argv) {
  const result = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--config", "--production-boundary", "--out"].includes(flag)) {
      throw new Error(`unknown argument: ${flag ?? "<missing>"}`);
    }
    if (seen.has(flag)) throw new Error(`duplicate argument: ${flag}`);
    if (typeof value !== "string" || !value || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    seen.add(flag);
    result[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  for (const name of ["config", "productionBoundary", "out"]) {
    if (!result[name]) throw new Error(`--${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)} is required`);
  }
  return Object.freeze(result);
}

function indexSource(config) {
  const template = readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "index.template.html"), "utf8");
  if ((template.match(/__FINANCE_PILOT_CSP__/g) || []).length !== 1) {
    throw new Error("Finance pilot template must contain one CSP placeholder");
  }
  const csp = financePilotContentSecurityPolicy(config)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  return template.replace("__FINANCE_PILOT_CSP__", csp);
}

export function buildFinancePilot({ configFile, productionBoundaryFile, outputDirectory }) {
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
  const config = validateFinancePilotStagingConfig(reviewedConfig.value, reviewedBoundary.value);
  const output = assertSafeExternalOutputDirectory(REPOSITORY_ROOT, outputDirectory);

  try {
    const status = lstatSync(output);
    if (!status.isDirectory() || status.isSymbolicLink() || readdirSync(output).length !== 0) {
      throw new Error("output directory must be absent or an empty real directory");
    }
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
    mkdirSync(output, { recursive: true, mode: 0o755 });
  }

  const files = new Map([
    ["_headers", financePilotCloudflarePagesHeaders(config)],
    ["architecture-finance.css", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "architecture-finance.css"), "utf8")],
    ["architecture-finance.js", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "architecture-finance.js"), "utf8")],
    ["finance-pilot-config.js", financePilotConfigScript(config)],
    ["index.html", indexSource(config)],
    ["pilot-shell.css", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "pilot-shell.css"), "utf8")],
    ["pilot-shell.js", readFileSync(path.join(REPOSITORY_ROOT, "finance-pilot", "pilot-shell.js"), "utf8")],
  ]);
  for (const [name, source] of files) {
    writeFileSync(path.join(output, name), source, { encoding: "utf8", flag: "wx", mode: 0o644 });
  }
  return verifyFinancePilotArtifact({
    artifactDirectory: output,
    config,
    productionBoundary: reviewedBoundary.value,
  });
}

async function main() {
  const input = argumentsFrom(process.argv.slice(2));
  const result = buildFinancePilot({
    configFile: input.config,
    productionBoundaryFile: input.productionBoundary,
    outputDirectory: input.out,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`Finance pilot build failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
