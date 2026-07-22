import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

import { buildFinancePilot } from "../../scripts/build-finance-pilot.mjs";
import {
  financePilotCloudflarePagesHeaders,
  financePilotConfigScript,
  financePilotContentSecurityPolicy,
  validateFinancePilotStagingConfig,
} from "../../scripts/finance-pilot-safety.mjs";
import { verifyFinancePilotArtifact } from "../../scripts/verify-finance-pilot-artifact.mjs";

const PUBLIC_ORIGIN = "https://pilot-staging.example";
const MAIN_ORIGIN = "https://pilot-main.supabase.co";
const FINANCE_ORIGIN = "https://pilot-finance.example";
const TELEGRAM_URL = "https://t.me/architecturepilotbot?startapp";
const PRODUCTION_BOUNDARY = Object.freeze({
  schemaVersion: 2,
  publicOrigin: "https://production-pilot.example",
  mainEdgeOrigin: "https://production-main.supabase.co",
  financeWebOrigin: "https://production-finance.example",
  telegramMiniAppUrl: "https://t.me/architectureproductionbot?startapp",
});
const CONFIG = Object.freeze({
  schemaVersion: 1,
  environment: "staging",
  publicOrigin: PUBLIC_ORIGIN,
  mainEdgeOrigin: MAIN_ORIGIN,
  financeWebOrigin: FINANCE_ORIGIN,
  telegramMiniAppUrl: TELEGRAM_URL,
  features: Object.freeze({ issueCode: true }),
});

function fixture(t, value, name) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-input-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, name);
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  return file;
}

function builtArtifact(t, config = CONFIG, boundary = PRODUCTION_BOUNDARY) {
  const configFile = fixture(t, config, "pilot-staging.json");
  const boundaryFile = fixture(t, boundary, "production-boundary.json");
  const parent = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-output-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const output = path.join(parent, "artifact");
  const result = buildFinancePilot({
    configFile,
    productionBoundaryFile: boundaryFile,
    outputDirectory: output,
  });
  return { output, result, configFile, boundaryFile };
}

function runShell({ initData = "query_id=pilot", locationOrigin = PUBLIC_ORIGIN } = {}) {
  const listeners = new Map();
  const app = { innerHTML: "" };
  const document = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    getElementById(id) { return id === "app" ? app : null; },
  };
  let rendered = 0;
  const context = {
    URL,
    document,
    location: { origin: locationOrigin },
    Telegram: {
      WebApp: {
        initData,
        ready() {},
        expand() {},
      },
    },
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(financePilotConfigScript(CONFIG), context, { filename: "finance-pilot-config.js" });
  vm.runInNewContext(readFileSync("finance-pilot/pilot-shell.js", "utf8"), context, {
    filename: "pilot-shell.js",
  });
  context.renderArchitectureFinanceV128 = () => { rendered += 1; };
  listeners.get("DOMContentLoaded")();
  return { context, app, rendered };
}

test("staging build contains only the seven connector assets and no production URL", t => {
  const { output, result } = builtArtifact(t);
  assert.equal(result.ok, true);
  assert.deepEqual(readdirSync(output).sort(), [
    "_headers",
    "architecture-finance.css",
    "architecture-finance.js",
    "finance-pilot-config.js",
    "index.html",
    "pilot-shell.css",
    "pilot-shell.js",
  ]);
  const combined = readdirSync(output)
    .map(name => readFileSync(path.join(output, name), "utf8"))
    .join("\n");
  for (const value of Object.values(PRODUCTION_BOUNDARY)) {
    if (typeof value === "string") assert.equal(combined.includes(value), false);
  }
  assert.doesNotMatch(
    combined,
    /(?:^|["'/])app\.js(?:[?"'<\s]|$)|(?:^|["'/])forum\.js|(?:^|["'/])business-architecture/,
  );
  assert.equal(combined.includes(MAIN_ORIGIN), true);
  assert.equal(combined.includes("/functions/v1/finance-issue-code"), true);
  assert.equal(combined.includes(FINANCE_ORIGIN), true);
});

test("artifact CSP pins one Main origin without unsafe inline scripts", t => {
  const { output } = builtArtifact(t);
  const index = readFileSync(path.join(output, "index.html"), "utf8");
  const config = validateFinancePilotStagingConfig(CONFIG, PRODUCTION_BOUNDARY);
  const csp = financePilotContentSecurityPolicy(config);
  assert.match(index, new RegExp(`connect-src ${MAIN_ORIGIN}`));
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /script-src-attr 'unsafe-hashes'/);
  assert.equal((index.match(/<script\b/g) || []).length, 4);
  assert.doesNotMatch(index, /<script\b[^>]*>\s*[^<]/);
});

test("Cloudflare Pages headers enforce the exact HTTP CSP and isolation policies", t => {
  const { output } = builtArtifact(t);
  const config = validateFinancePilotStagingConfig(CONFIG, PRODUCTION_BOUNDARY);
  const csp = financePilotContentSecurityPolicy(config);
  const headers = readFileSync(path.join(output, "_headers"), "utf8");
  assert.equal(headers, financePilotCloudflarePagesHeaders(config));
  assert.match(headers, /^\/\*\n/u);
  assert.match(headers, new RegExp(`^  Content-Security-Policy: ${csp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "mu"));
  assert.match(csp, new RegExp(`(?:^|; )connect-src ${MAIN_ORIGIN}(?:;|$)`));
  assert.doesNotMatch(csp, /connect-src[^;]*(?:\*|https:\s|http:)/u);
  assert.match(csp, /(?:^|; )frame-ancestors 'none'(?:;|$)/u);
  assert.match(headers, /^  X-Content-Type-Options: nosniff$/mu);
  assert.match(headers, /^  Referrer-Policy: no-referrer$/mu);
  assert.match(headers, /^  Permissions-Policy: camera=\(\), display-capture=\(\), geolocation=\(\), microphone=\(\), payment=\(\), publickey-credentials-get=\(\), usb=\(\)$/mu);
  assert.match(headers, /^  Cross-Origin-Opener-Policy: same-origin$/mu);
  assert.match(headers, /^  Cross-Origin-Resource-Policy: same-origin$/mu);
});

test("artifact verifier fails closed when HTTP security headers drift", t => {
  const { output } = builtArtifact(t);
  const headersFile = path.join(output, "_headers");
  const headers = readFileSync(headersFile, "utf8");
  writeFileSync(
    headersFile,
    headers.replace(`connect-src ${MAIN_ORIGIN}`, `connect-src ${MAIN_ORIGIN} https://attacker.example`),
    { mode: 0o644 },
  );
  assert.throws(() => verifyFinancePilotArtifact({
    artifactDirectory: output,
    config: validateFinancePilotStagingConfig(CONFIG, PRODUCTION_BOUNDARY),
    productionBoundary: PRODUCTION_BOUNDARY,
  }), /artifact member drifted: _headers/);
});

test("verifier rejects any full Main asset added to the connector", t => {
  const { output } = builtArtifact(t);
  writeFileSync(path.join(output, "app.js"), "// forbidden\n", { mode: 0o644 });
  assert.throws(() => verifyFinancePilotArtifact({
    artifactDirectory: output,
    config: validateFinancePilotStagingConfig(CONFIG, PRODUCTION_BOUNDARY),
    productionBoundary: PRODUCTION_BOUNDARY,
  }), /file allow-list differs/);
});

test("staging builder rejects production values and unsafe reviewed inputs before output", t => {
  assert.throws(() => validateFinancePilotStagingConfig({
    ...CONFIG,
    publicOrigin: PRODUCTION_BOUNDARY.publicOrigin,
  }, PRODUCTION_BOUNDARY), /resolves to production/);
  assert.throws(() => validateFinancePilotStagingConfig({
    ...CONFIG,
    mainEdgeOrigin: PRODUCTION_BOUNDARY.mainEdgeOrigin,
  }, PRODUCTION_BOUNDARY), /resolves to production/);
  assert.throws(() => validateFinancePilotStagingConfig({
    ...CONFIG,
    environment: "production",
  }, PRODUCTION_BOUNDARY), /staging-only/);

  const configFile = fixture(t, CONFIG, "writable-config.json");
  chmodSync(configFile, 0o666);
  const boundaryFile = fixture(t, PRODUCTION_BOUNDARY, "boundary.json");
  const parent = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-rejected-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  assert.throws(() => buildFinancePilot({
    configFile,
    productionBoundaryFile: boundaryFile,
    outputDirectory: path.join(parent, "artifact"),
  }), /must not be group- or world-writable/);
});

test("deployable staging validator rejects placeholder and pending bot usernames", () => {
  const legacyBoundary = {
    schemaVersion: 1,
    mainEdgeOrigin: PRODUCTION_BOUNDARY.mainEdgeOrigin,
    financeWebOrigin: PRODUCTION_BOUNDARY.financeWebOrigin,
    telegramMiniAppUrl: PRODUCTION_BOUNDARY.telegramMiniAppUrl,
  };
  assert.throws(
    () => validateFinancePilotStagingConfig(CONFIG, legacyBoundary),
    /deployable Finance pilot production boundary must include the exact production publicOrigin/,
  );
  for (const telegramMiniAppUrl of [
    "https://t.me/REPLACE_WITH_REAL_PILOT_BOT?startapp",
    "https://t.me/ArchitecturePilotPendingBot?startapp",
    "https://t.me/ArchitecturePlaceholderBot?startapp",
  ]) {
    assert.throws(
      () => validateFinancePilotStagingConfig({ ...CONFIG, telegramMiniAppUrl }, PRODUCTION_BOUNDARY),
      /must name the reviewed real pilot bot/,
    );
  }

  assert.equal(
    validateFinancePilotStagingConfig({
      ...CONFIG,
      telegramMiniAppUrl: "https://t.me/ArchitectureFinanceTestBot?startapp",
    }, PRODUCTION_BOUNDARY).telegramMiniAppUrl,
    "https://t.me/architecturefinancetestbot?startapp",
  );

  assert.equal(
    validateFinancePilotStagingConfig({
      ...CONFIG,
      publicOrigin: "https://finance-pilot-bootstrap.invalid",
      telegramMiniAppUrl: "https://t.me/ArchitecturePilotPendingBot?startapp",
    }, legacyBoundary).telegramMiniAppUrl,
    "https://t.me/architecturepilotpendingbot?startapp",
  );
});

test("pilot shell opens only for exact staging origin and Telegram initData", () => {
  const valid = runShell();
  assert.equal(valid.rendered, 1);
  assert.equal(valid.context.state.access, true);
  assert.equal(
    valid.context.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG.issueEndpoint,
    `${MAIN_ORIGIN}/functions/v1/finance-issue-code`,
  );
  assert.equal(valid.context.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG.financeWebUrl, `${FINANCE_ORIGIN}/`);

  const outsideTelegram = runShell({ initData: "" });
  assert.equal(outsideTelegram.rendered, 0);
  assert.equal(outsideTelegram.context.state.access, false);
  assert.match(outsideTelegram.app.innerHTML, /Откройте пилот из Telegram/);
  assert.equal(outsideTelegram.context.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG, undefined);

  const wrongOrigin = runShell({ locationOrigin: "https://attacker.example" });
  assert.equal(wrongOrigin.rendered, 0);
  assert.equal(wrongOrigin.context.state.access, false);
  assert.equal(wrongOrigin.context.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG, undefined);
});
