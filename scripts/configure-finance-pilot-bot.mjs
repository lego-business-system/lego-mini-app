#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  readReviewedExternalJson,
  validateFinancePilotStagingConfig,
} from "./finance-pilot-safety.mjs";

const BOT_TOKEN = /^[1-9][0-9]{5,19}:[A-Za-z0-9_-]{30,128}$/u;
const BOT_API_ORIGIN = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 15_000;
const MAXIMUM_RESPONSE_BYTES = 64 * 1024;
const MENU_TEXT = "Открыть финансы";
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exactObject(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
    && actual.every((key) => keys.includes(key));
}

function argumentsFrom(argv) {
  if (argv.length === 1 && argv[0] === "--help") return Object.freeze({ help: true });
  const result = { apply: false, help: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      if (seen.has(argument)) throw new Error(`duplicate argument: ${argument}`);
      seen.add(argument);
      result.apply = true;
      continue;
    }
    if (!["--config", "--production-boundary", "--secrets"].includes(argument)) {
      throw new Error(`unknown argument: ${argument ?? "<missing>"}`);
    }
    if (seen.has(argument)) throw new Error(`duplicate argument: ${argument}`);
    seen.add(argument);
    const value = argv[index + 1];
    if (typeof value !== "string" || !value || value.startsWith("--")) {
      throw new Error(`missing value for ${argument}`);
    }
    result[argument.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  if (!result.config) throw new Error("--config is required");
  if (!result.productionBoundary) throw new Error("--production-boundary is required");
  if (result.apply && !result.secrets) throw new Error("--secrets is required with --apply");
  if (!result.apply && result.secrets) throw new Error("--secrets is accepted only with --apply");
  return Object.freeze(result);
}

function botUsernameFrom(config) {
  return new URL(config.telegramMiniAppUrl).pathname.slice(1).toLowerCase();
}

function reviewedPlan(configFile, productionBoundaryFile) {
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
  const config = validateFinancePilotStagingConfig(
    reviewedConfig.value,
    reviewedBoundary.value,
  );
  return Object.freeze({
    config,
    configSha256: reviewedConfig.sha256,
    productionBoundarySha256: reviewedBoundary.sha256,
    botUsername: botUsernameFrom(config),
  });
}

function readReviewedSecrets(secretsFile) {
  const reviewed = readReviewedExternalJson(
    secretsFile,
    REPOSITORY_ROOT,
    "Telegram pilot bot secrets",
  );
  if ((reviewed.mode & 0o077) !== 0) {
    throw new Error("Telegram pilot bot secrets must have mode 0600 or stricter");
  }
  if (!exactObject(reviewed.value, ["schemaVersion", "environment", "telegramBotToken"])) {
    throw new Error(
      "Telegram pilot bot secrets keys must be exactly: environment, schemaVersion, telegramBotToken",
    );
  }
  if (reviewed.value.schemaVersion !== 1 || reviewed.value.environment !== "staging") {
    throw new Error("Telegram pilot bot secrets must be staging schema v1");
  }
  if (
    typeof reviewed.value.telegramBotToken !== "string"
    || !BOT_TOKEN.test(reviewed.value.telegramBotToken)
  ) {
    throw new Error("Telegram pilot bot token has an invalid shape");
  }
  return reviewed.value.telegramBotToken;
}

async function boundedTelegramResponse(response, method) {
  const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_RESPONSE_BYTES) {
    throw new Error(`Telegram Bot API ${method} returned an oversized response`);
  }
  let source;
  try {
    source = await response.text();
  } catch {
    throw new Error(`Telegram Bot API ${method} returned an unreadable response`);
  }
  if (new TextEncoder().encode(source).byteLength > MAXIMUM_RESPONSE_BYTES) {
    throw new Error(`Telegram Bot API ${method} returned an oversized response`);
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`Telegram Bot API ${method} returned invalid JSON`);
  }
  if (!response.ok || !parsed || parsed.ok !== true || !("result" in parsed)) {
    throw new Error(`Telegram Bot API ${method} rejected the staging request`);
  }
  return parsed.result;
}

async function callTelegram(fetchImpl, token, method, payload = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${BOT_API_ORIGIN}/bot${token}/${method}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
  } catch {
    throw new Error(`Telegram Bot API ${method} request failed`);
  } finally {
    clearTimeout(timeout);
  }
  return boundedTelegramResponse(response, method);
}

export async function configureFinancePilotBot({
  configFile,
  productionBoundaryFile,
  secretsFile,
  apply = false,
  fetchImpl = globalThis.fetch,
}) {
  const plan = reviewedPlan(configFile, productionBoundaryFile);
  const summary = {
    ok: true,
    mode: apply ? "applied" : "dry-run",
    environment: "staging",
    botUsername: plan.botUsername,
    publicOrigin: plan.config.publicOrigin,
    configSha256: plan.configSha256,
    productionBoundarySha256: plan.productionBoundarySha256,
    methods: ["getMe", "getWebhookInfo", "setChatMenuButton", "getChatMenuButton"],
    mainMiniAppBotFatherStepRequired: true,
  };
  if (!apply) return Object.freeze(summary);
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is unavailable");
  const token = readReviewedSecrets(secretsFile);

  const identity = await callTelegram(fetchImpl, token, "getMe");
  if (
    !identity
    || identity.is_bot !== true
    || typeof identity.username !== "string"
    || identity.username.toLowerCase() !== plan.botUsername
  ) {
    throw new Error("Telegram token does not belong to the reviewed staging bot username");
  }

  const webhook = await callTelegram(fetchImpl, token, "getWebhookInfo");
  if (!webhook || webhook.url !== "") {
    throw new Error("staging pilot bot already has a webhook; refusing to replace its behavior");
  }

  const changed = await callTelegram(fetchImpl, token, "setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: MENU_TEXT,
      web_app: { url: plan.config.publicOrigin },
    },
  });
  if (changed !== true) throw new Error("Telegram did not confirm the staging menu button update");

  const menu = await callTelegram(fetchImpl, token, "getChatMenuButton");
  if (
    !menu
    || menu.type !== "web_app"
    || menu.text !== MENU_TEXT
    || !menu.web_app
    || menu.web_app.url !== plan.config.publicOrigin
  ) {
    throw new Error("Telegram staging menu button verification failed");
  }
  return Object.freeze(summary);
}

async function main() {
  const input = argumentsFrom(process.argv.slice(2));
  if (input.help) {
    process.stdout.write([
      "Dry-run:",
      "  configure-finance-pilot-bot.mjs --config ABS_PATH --production-boundary ABS_PATH",
      "Apply to the exact staging bot:",
      "  configure-finance-pilot-bot.mjs --config ABS_PATH --production-boundary ABS_PATH --secrets ABS_PATH --apply",
      "The secret file is external JSON mode 0600; the token is never printed.",
      "",
    ].join("\n"));
    return;
  }
  const result = await configureFinancePilotBot({
    configFile: input.config,
    productionBoundaryFile: input.productionBoundary,
    secretsFile: input.secrets,
    apply: input.apply,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`Telegram pilot bot configuration failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
