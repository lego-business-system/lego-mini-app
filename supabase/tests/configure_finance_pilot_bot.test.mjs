import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { configureFinancePilotBot } from "../../scripts/configure-finance-pilot-bot.mjs";

const CONFIG = Object.freeze({
  schemaVersion: 1,
  environment: "staging",
  publicOrigin: "https://architecture-main-pilot.pages.dev",
  mainEdgeOrigin: "https://pilot-main.supabase.co",
  financeWebOrigin: "https://pilot-finance.example",
  telegramMiniAppUrl: "https://t.me/ArchitecturePilotBot?startapp",
  features: Object.freeze({ issueCode: true }),
});
const PRODUCTION_BOUNDARY = Object.freeze({
  schemaVersion: 1,
  mainEdgeOrigin: "https://production-main.supabase.co",
  financeWebOrigin: "https://production-finance.example",
  telegramMiniAppUrl: "https://t.me/ArchitectureProductionBot?startapp",
});
const TOKEN = `123456789:${"A".repeat(40)}`;

function fixture(t, value, name, mode = 0o600) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-bot-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, name);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
  return file;
}

function inputs(t, config = CONFIG) {
  return {
    configFile: fixture(t, config, "pilot.json"),
    productionBoundaryFile: fixture(t, PRODUCTION_BOUNDARY, "production-boundary.json"),
  };
}

function response(result) {
  const source = JSON.stringify({ ok: true, result });
  return {
    ok: true,
    status: 200,
    headers: { get: () => String(Buffer.byteLength(source)) },
    text: async () => source,
  };
}

function telegramMock(overrides = {}) {
  const calls = [];
  const results = {
    getMe: { is_bot: true, username: "ArchitecturePilotBot" },
    getWebhookInfo: { url: "" },
    setChatMenuButton: true,
    getChatMenuButton: {
      type: "web_app",
      text: "Открыть финансы",
      web_app: { url: CONFIG.publicOrigin },
    },
    ...overrides,
  };
  const fetchImpl = async (url, options) => {
    assert.match(url, /^https:\/\/api\.telegram\.org\/bot[^/]+\/[A-Za-z]+$/u);
    const method = url.slice(url.lastIndexOf("/") + 1);
    calls.push({ method, body: JSON.parse(options.body) });
    return response(results[method]);
  };
  return { calls, fetchImpl };
}

test("Telegram pilot bot dry-run is zero-secret and zero-network", async t => {
  const files = inputs(t);
  let networkCalls = 0;
  const result = await configureFinancePilotBot({
    ...files,
    fetchImpl: async () => {
      networkCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "dry-run");
  assert.equal(result.environment, "staging");
  assert.equal(result.botUsername, "architecturepilotbot");
  assert.equal(result.publicOrigin, CONFIG.publicOrigin);
  assert.equal(result.mainMiniAppBotFatherStepRequired, true);
  assert.deepEqual(result.methods, [
    "getMe",
    "getWebhookInfo",
    "setChatMenuButton",
    "getChatMenuButton",
  ]);
  assert.equal(networkCalls, 0);
});

test("apply verifies exact bot and empty webhook before setting one staging menu button", async t => {
  const files = inputs(t);
  const secretsFile = fixture(t, {
    schemaVersion: 1,
    environment: "staging",
    telegramBotToken: TOKEN,
  }, "telegram-secrets.json");
  const mock = telegramMock();
  const result = await configureFinancePilotBot({
    ...files,
    secretsFile,
    apply: true,
    fetchImpl: mock.fetchImpl,
  });

  assert.equal(result.mode, "applied");
  assert.deepEqual(mock.calls.map(call => call.method), [
    "getMe",
    "getWebhookInfo",
    "setChatMenuButton",
    "getChatMenuButton",
  ]);
  assert.deepEqual(mock.calls[2].body, {
    menu_button: {
      type: "web_app",
      text: "Открыть финансы",
      web_app: { url: CONFIG.publicOrigin },
    },
  });
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test("apply refuses a token for a different bot before any mutation", async t => {
  const files = inputs(t);
  const secretsFile = fixture(t, {
    schemaVersion: 1,
    environment: "staging",
    telegramBotToken: TOKEN,
  }, "telegram-secrets.json");
  const mock = telegramMock({
    getMe: { is_bot: true, username: "DifferentPilotBot" },
  });
  await assert.rejects(
    configureFinancePilotBot({
      ...files,
      secretsFile,
      apply: true,
      fetchImpl: mock.fetchImpl,
    }),
    /does not belong to the reviewed staging bot username/,
  );
  assert.deepEqual(mock.calls.map(call => call.method), ["getMe"]);
});

test("apply preserves a bot that already has a webhook", async t => {
  const files = inputs(t);
  const secretsFile = fixture(t, {
    schemaVersion: 1,
    environment: "staging",
    telegramBotToken: TOKEN,
  }, "telegram-secrets.json");
  const mock = telegramMock({
    getWebhookInfo: { url: "https://existing-handler.example/webhook" },
  });
  await assert.rejects(
    configureFinancePilotBot({
      ...files,
      secretsFile,
      apply: true,
      fetchImpl: mock.fetchImpl,
    }),
    /already has a webhook/,
  );
  assert.deepEqual(mock.calls.map(call => call.method), ["getMe", "getWebhookInfo"]);
});

test("apply rejects readable secret files and production targets before Telegram", async t => {
  const files = inputs(t);
  const secretsFile = fixture(t, {
    schemaVersion: 1,
    environment: "staging",
    telegramBotToken: TOKEN,
  }, "telegram-secrets.json");
  chmodSync(secretsFile, 0o644);
  let calls = 0;
  await assert.rejects(
    configureFinancePilotBot({
      ...files,
      secretsFile,
      apply: true,
      fetchImpl: async () => { calls += 1; },
    }),
    /mode 0600 or stricter/,
  );
  assert.equal(calls, 0);

  const productionFiles = inputs(t, {
    ...CONFIG,
    mainEdgeOrigin: PRODUCTION_BOUNDARY.mainEdgeOrigin,
  });
  await assert.rejects(
    configureFinancePilotBot({
      ...productionFiles,
      secretsFile,
      apply: true,
      fetchImpl: async () => { calls += 1; },
    }),
    /resolves to production/,
  );
  assert.equal(calls, 0);
});
