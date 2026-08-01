#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  exactHttpsOrigin,
  rejectDuplicateJsonKeys,
  validateProductionBoundary,
} from "./finance-pilot-safety.mjs";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TELEGRAM_ID = /^[1-9][0-9]{0,18}$/;
const CHANGED_BY = /^[a-z][a-z0-9_.:-]{2,127}$/;
const SECRET = /^[^\s\x00-\x1f\x7f]{32,4096}$/;
const TERMINAL_STATES = new Set(["applied", "dead_letter"]);
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const MAXIMUM_BOUNDARY_BYTES = 16 * 1024;
const USAGE = Object.freeze([
  "grant|revoke --user-id UUIDv4 --event-id UUIDv4 --changed-by ACTOR --reason TEXT [--target-config ABS_PATH --production-boundary ABS_PATH]",
  "grant|revoke ... --target-config ABS_PATH --production-boundary ABS_PATH --apply [--dispatch] [--allow-production]",
  "status --user-id UUIDv4 [--event-id UUIDv4] --target-config ABS_PATH --production-boundary ABS_PATH",
]);

function exactObject(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => keys.includes(key));
}

function assertOutsideRepository(file, label) {
  const relative = path.relative(REPOSITORY_ROOT, file);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error(`${label} must be outside the repository`);
  }
}

function readReviewedExternalJson(file, flag, label) {
  if (typeof file !== "string" || file !== file.trim() || !path.isAbsolute(file)) {
    throw new Error(`${flag} must be an absolute path`);
  }
  const requested = path.resolve(file);
  assertOutsideRepository(requested, label);

  let linkStatus;
  try {
    linkStatus = lstatSync(requested);
  } catch {
    throw new Error(`${label} is unavailable`);
  }
  if (!linkStatus.isFile() || linkStatus.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }

  let realFile;
  try {
    realFile = realpathSync(requested);
  } catch {
    throw new Error(`${label} is unavailable`);
  }
  assertOutsideRepository(realFile, label);

  let descriptor;
  try {
    descriptor = openSync(realFile, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const status = fstatSync(descriptor);
    if (!status.isFile() || status.size < 2 || status.size > MAXIMUM_BOUNDARY_BYTES) {
      throw new Error(`${label} must be a regular file of at most 16 KiB`);
    }
    if ((status.mode & 0o022) !== 0) {
      throw new Error(`${label} must not be group- or world-writable`);
    }
    if (typeof process.geteuid === "function" && status.uid !== process.geteuid()) {
      throw new Error(`${label} must be owned by the current user`);
    }
    const source = readFileSync(descriptor, "utf8");
    rejectDuplicateJsonKeys(source, label);
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error(`${label} contains invalid JSON`);
    }
    return Object.freeze({
      parsed,
      sha256: createHash("sha256").update(source, "utf8").digest("hex"),
    });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function readReviewedProductionBoundary(file) {
  const reviewed = readReviewedExternalJson(
    file,
    "--production-boundary",
    "production boundary",
  );
  const boundary = validateProductionBoundary(reviewed.parsed);
  return Object.freeze({
    mainSupabaseOrigin: boundary.mainEdgeOrigin,
    sha256: reviewed.sha256,
  });
}

export function readReviewedTargetDescriptor(file, boundary) {
  const reviewed = readReviewedExternalJson(file, "--target-config", "target descriptor");
  if (!exactObject(reviewed.parsed, [
    "schemaVersion",
    "environment",
    "mainEdgeOrigin",
    "productionBoundarySha256",
  ])) {
    throw new Error(
      "target descriptor keys must be exactly: environment, mainEdgeOrigin, productionBoundarySha256, schemaVersion",
    );
  }
  if (reviewed.parsed.schemaVersion !== 1) {
    throw new Error("unsupported target descriptor schemaVersion");
  }
  if (!["staging", "production"].includes(reviewed.parsed.environment)) {
    throw new Error("target descriptor environment must be staging or production");
  }
  if (
    typeof reviewed.parsed.productionBoundarySha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(reviewed.parsed.productionBoundarySha256) ||
    reviewed.parsed.productionBoundarySha256 !== boundary.sha256
  ) {
    throw new Error("target descriptor does not match the reviewed production boundary bytes");
  }
  const mainSupabaseOrigin = exactHttpsOrigin(
    reviewed.parsed.mainEdgeOrigin,
    "target descriptor mainEdgeOrigin",
  );
  if (
    reviewed.parsed.environment === "production" &&
    mainSupabaseOrigin !== boundary.mainSupabaseOrigin
  ) {
    throw new Error("production target must exactly match the production boundary");
  }
  if (
    reviewed.parsed.environment === "staging" &&
    mainSupabaseOrigin === boundary.mainSupabaseOrigin
  ) {
    throw new Error("staging target resolves to production");
  }
  return Object.freeze({
    environment: reviewed.parsed.environment,
    mainSupabaseOrigin,
    productionBoundarySha256: boundary.sha256,
    sha256: reviewed.sha256,
  });
}

export function productionConfirmationPhrase({
  action,
  userId,
  eventId,
  boundarySha256,
  targetDescriptorSha256,
  dispatch,
}) {
  return [
    "APPLY PRODUCTION FINANCE",
    action.toUpperCase(),
    "USER",
    userId,
    "EVENT",
    eventId,
    "BOUNDARY",
    boundarySha256,
    "TARGET",
    targetDescriptorSha256,
    dispatch ? "DISPATCH" : "NO-DISPATCH",
  ].join(" ");
}

async function readProductionConfirmationFromTty() {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error("production confirmation requires an interactive TTY");
  }
  const prompt = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    return await prompt.question("Production owner confirmation phrase: ");
  } finally {
    prompt.close();
  }
}

function requiredSecret(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || !SECRET.test(value)) {
    throw new Error(`${name} must be a non-whitespace secret of at least 32 characters`);
  }
  return value;
}

export function parseFinanceAccessArguments(argv) {
  const [action, ...rest] = argv;
  if (!["grant", "revoke", "status"].includes(action)) {
    throw new Error("first argument must be grant, revoke or status");
  }
  const result = {
    action,
    apply: false,
    dispatch: false,
    allowProduction: false,
  };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (["--apply", "--dispatch", "--allow-production"].includes(argument)) {
      if (seen.has(argument)) throw new Error(`duplicate argument: ${argument}`);
      seen.add(argument);
      if (argument === "--apply") result.apply = true;
      else if (argument === "--dispatch") result.dispatch = true;
      else result.allowProduction = true;
      continue;
    }
    if (![
      "--user-id",
      "--event-id",
      "--changed-by",
      "--reason",
      "--target-config",
      "--production-boundary",
    ].includes(argument)) {
      throw new Error(`unknown argument: ${argument}`);
    }
    if (seen.has(argument)) throw new Error(`duplicate argument: ${argument}`);
    seen.add(argument);
    const value = rest[index + 1];
    if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
      throw new Error(`missing value for ${argument}`);
    }
    const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[key] = value;
    index += 1;
  }
  if (!UUID_V4.test(result.userId ?? "")) throw new Error("--user-id must be a UUID v4");
  if (result.eventId !== undefined && !UUID_V4.test(result.eventId ?? "")) {
    throw new Error("--event-id must be a UUID v4");
  }
  if (Boolean(result.targetConfig) !== Boolean(result.productionBoundary)) {
    throw new Error("--target-config and --production-boundary must be provided together");
  }
  if (action === "status") {
    if (result.apply || result.dispatch || result.allowProduction || result.changedBy || result.reason) {
      throw new Error("status is read-only and rejects mutation arguments");
    }
    if (!result.targetConfig) {
      throw new Error("status requires --target-config and --production-boundary");
    }
  } else {
    if (!UUID_V4.test(result.eventId ?? "")) {
      throw new Error("grant/revoke requires an explicit --event-id UUID v4");
    }
    if (!CHANGED_BY.test(result.changedBy ?? "")) {
      throw new Error("grant/revoke requires an explicit valid --changed-by");
    }
    if (
      typeof result.reason !== "string" ||
      result.reason !== result.reason.trim() ||
      result.reason.length < 1 ||
      result.reason.length > 500 ||
      /[\x00-\x1f\x7f]/.test(result.reason)
    ) {
      throw new Error("--reason must contain 1-500 printable characters without outer whitespace");
    }
    if (result.dispatch && !result.apply) throw new Error("--dispatch requires --apply");
    if (result.allowProduction && !result.apply) {
      throw new Error("--allow-production requires --apply");
    }
    if (result.apply && !result.targetConfig) {
      throw new Error("--apply requires --target-config and --production-boundary");
    }
  }
  return Object.freeze(result);
}

async function readExactJson(response, maximumBytes = 8_192) {
  if (response.redirected) throw new Error("unexpected redirect");
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new Error("unexpected response content type");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > maximumBytes)) {
    throw new Error("response is too large");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new Error("response is too large");
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("response is not valid UTF-8 JSON");
  }
  return value;
}

async function rpc(fetchImpl, origin, serviceKey, name, body) {
  let response;
  try {
    response = await fetchImpl(`${origin}/rest/v1/rpc/${name}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`RPC ${name} is unavailable`);
  }
  const data = await readExactJson(response);
  if (!response.ok) throw new Error(`RPC ${name} was rejected`);
  return data;
}

function parseResolver(value, userId) {
  if (
    !exactObject(value, ["ok", "main_user_id", "telegram_id"]) ||
    value.ok !== true ||
    value.main_user_id !== userId ||
    typeof value.telegram_id !== "string" ||
    !TELEGRAM_ID.test(value.telegram_id)
  ) {
    throw new Error("subject resolver contract failed");
  }
  return value.telegram_id;
}

function parseDesired(value, eventId) {
  if (
    exactObject(value, ["ok", "error"]) &&
    value.ok === false &&
    [
      "idempotency_conflict",
      "invalid_request",
      "main_user_not_found",
      "subject_digest_conflict",
      "version_conflict",
    ].includes(value.error)
  ) {
    throw new Error(`desired-state request rejected: ${value.error}`);
  }
  if (
    !exactObject(value, ["ok", "replayed", "event_id", "version", "state"]) ||
    value.ok !== true ||
    typeof value.replayed !== "boolean" ||
    value.event_id !== eventId ||
    typeof value.version !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value.version) ||
    !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(value.state)
  ) {
    throw new Error("desired-state contract failed");
  }
  return Object.freeze(value);
}

function decimalVersion(value) {
  return typeof value === "string" && /^(?:0|[1-9][0-9]{0,18})$/.test(value);
}

function parseAccessStatus(value, userId, eventId = null) {
  if (
    exactObject(value, ["ok", "error"]) &&
    value.ok === false &&
    ["event_user_conflict", "invalid_request", "main_user_not_found"].includes(value.error)
  ) {
    throw new Error(`access status rejected: ${value.error}`);
  }
  if (
    !exactObject(value, [
      "ok",
      "main_user_id",
      "current_version",
      "desired_state",
      "applied_version",
      "applied_state",
      "event",
    ]) ||
    value.ok !== true ||
    value.main_user_id !== userId ||
    !decimalVersion(value.current_version) ||
    ![null, "granted", "revoked"].includes(value.desired_state) ||
    !decimalVersion(value.applied_version) ||
    ![null, "granted", "revoked"].includes(value.applied_state)
  ) {
    throw new Error("access status contract failed");
  }
  const currentVersion = BigInt(value.current_version);
  const appliedVersion = BigInt(value.applied_version);
  if (
    appliedVersion > currentVersion ||
    (currentVersion === 0n) !== (value.desired_state === null) ||
    (appliedVersion === 0n) !== (value.applied_state === null)
  ) {
    throw new Error("access status version invariant failed");
  }
  if (value.event !== null) {
    if (
      !exactObject(value.event, ["event_id", "version", "desired_state", "state"]) ||
      !UUID_V4.test(value.event.event_id) ||
      (eventId !== null && value.event.event_id !== eventId) ||
      !decimalVersion(value.event.version) ||
      !["granted", "revoked"].includes(value.event.desired_state) ||
      !["pending", "processing", "retry_wait", "applied", "dead_letter"].includes(
        value.event.state,
      )
    ) {
      throw new Error("access event status contract failed");
    }
    if (BigInt(value.event.version) > currentVersion) {
      throw new Error("access event version invariant failed");
    }
  }
  return Object.freeze({
    ...value,
    event: value.event === null ? null : Object.freeze(value.event),
  });
}

async function readAccessStatus(fetchImpl, origin, serviceKey, userId, eventId = null) {
  return parseAccessStatus(await rpc(
    fetchImpl,
    origin,
    serviceKey,
    "architecture_get_finance_access_status_internal",
    { p_main_user_id: userId, p_event_id: eventId },
  ), userId, eventId);
}

async function dispatchWorker(fetchImpl, origin, triggerSecret, eventId) {
  let response;
  try {
    response = await fetchImpl(`${origin}/functions/v1/finance-sync-entitlements`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "x-architecture-sync-trigger": triggerSecret,
      },
      body: JSON.stringify({ event_id: eventId }),
    });
  } catch {
    throw new Error("entitlement worker is unavailable");
  }
  const value = await readExactJson(response, 2_048);
  if (
    !response.ok ||
    !exactObject(value, ["ok", "claimed", "applied", "retried", "dead_lettered"]) ||
    value.ok !== true ||
    ![value.claimed, value.applied, value.retried, value.dead_lettered]
      .every((item) => Number.isInteger(item) && item >= 0 && item <= 10) ||
    value.applied + value.retried + value.dead_lettered !== value.claimed
  ) {
    throw new Error("entitlement worker contract failed");
  }
  return Object.freeze(value);
}

export async function manageFinanceAccess({
  argv,
  environment = process.env,
  fetchImpl = fetch,
  readProductionConfirmationImpl = readProductionConfirmationFromTty,
} = {}) {
  const requestedArguments = argv ?? [];
  if (
    requestedArguments.length === 0 ||
    (requestedArguments.length === 1 && requestedArguments[0] === "--help")
  ) {
    return Object.freeze({ ok: true, mode: "help", usage: USAGE });
  }
  const input = parseFinanceAccessArguments(requestedArguments);
  const boundary = input.productionBoundary
    ? readReviewedProductionBoundary(input.productionBoundary)
    : null;
  const target = input.targetConfig
    ? readReviewedTargetDescriptor(input.targetConfig, boundary)
    : null;
  const targetEnvironment = target?.environment ?? "unclassified";

  if (input.action !== "status" && !input.apply) {
    return Object.freeze({
      ok: true,
      mode: "dry_run",
      action: input.action,
      main_user_id: input.userId,
      event_id: input.eventId,
      changed_by: input.changedBy,
      target_environment: targetEnvironment,
      production_boundary_sha256: boundary?.sha256 ?? null,
      target_descriptor_sha256: target?.sha256 ?? null,
      mutation_performed: false,
      apply_required: true,
    });
  }

  const configuredOrigin = environment.MAIN_SUPABASE_URL ?? "";
  const origin = exactHttpsOrigin(configuredOrigin, "MAIN_SUPABASE_URL");
  if (target === null || configuredOrigin !== target.mainSupabaseOrigin) {
    throw new Error("MAIN_SUPABASE_URL must exactly match target descriptor mainEdgeOrigin");
  }

  if (input.action === "status") {
    const serviceKey = requiredSecret(environment, "MAIN_SERVICE_ROLE_KEY");
    const status = await readAccessStatus(
      fetchImpl,
      origin,
      serviceKey,
      input.userId,
      input.eventId ?? null,
    );
    return Object.freeze({
      ok: true,
      mode: "status",
      target_environment: targetEnvironment,
      production_boundary_sha256: boundary?.sha256 ?? null,
      target_descriptor_sha256: target?.sha256 ?? null,
      ...status,
    });
  }

  if (boundary === null || target === null) {
    throw new Error("--apply requires reviewed target config and production boundary");
  }
  if (targetEnvironment === "production" && !input.allowProduction) {
    throw new Error("production Finance access requires --allow-production after owner approval");
  }
  if (targetEnvironment !== "production" && input.allowProduction) {
    throw new Error("--allow-production is invalid for a non-production origin");
  }

  const serviceKey = requiredSecret(environment, "MAIN_SERVICE_ROLE_KEY");
  const privacyKey = requiredSecret(environment, "MAIN_FINANCE_PRIVACY_HMAC_KEY");
  const triggerSecret = input.dispatch
    ? requiredSecret(environment, "MAIN_FINANCE_SYNC_TRIGGER_SECRET")
    : null;
  if (privacyKey === serviceKey || (triggerSecret && [privacyKey, serviceKey].includes(triggerSecret))) {
    throw new Error("Finance integration secrets must be distinct");
  }

  const preflight = await readAccessStatus(
    fetchImpl,
    origin,
    serviceKey,
    input.userId,
    input.eventId,
  );
  const desiredState = input.action === "grant" ? "granted" : "revoked";
  if (preflight.event !== null && preflight.event.desired_state !== desiredState) {
    throw new Error("event id already belongs to the opposite desired state");
  }

  const resolver = await rpc(
    fetchImpl,
    origin,
    serviceKey,
    "architecture_resolve_finance_subject_internal",
    { p_main_user_id: input.userId },
  );
  const telegramId = parseResolver(resolver, input.userId);
  const subjectDigest = createHmac("sha256", privacyKey)
    .update(`main-telegram-subject-v1\n${telegramId}`, "utf8")
    .digest("hex");
  const desiredPayload = Object.freeze({
    p_event_id: input.eventId,
    p_main_user_id: input.userId,
    p_subject_digest: `\\x${subjectDigest}`,
    p_desired_state: desiredState,
    p_changed_by: input.changedBy,
    p_change_reason: input.reason,
    p_expected_version: preflight.current_version,
  });

  if (targetEnvironment === "production") {
    const expectedConfirmation = productionConfirmationPhrase({
      action: input.action,
      userId: input.userId,
      eventId: input.eventId,
      boundarySha256: boundary.sha256,
      targetDescriptorSha256: target.sha256,
      dispatch: input.dispatch,
    });
    const suppliedConfirmation = await readProductionConfirmationImpl({
      expected: expectedConfirmation,
      action: input.action,
      userId: input.userId,
      eventId: input.eventId,
      boundarySha256: boundary.sha256,
      targetDescriptorSha256: target.sha256,
      dispatch: input.dispatch,
    });
    if (suppliedConfirmation !== expectedConfirmation) {
      throw new Error("production owner confirmation phrase did not match exactly");
    }
  }

  let desiredResponse;
  try {
    desiredResponse = await rpc(
      fetchImpl,
      origin,
      serviceKey,
      "architecture_set_finance_access_desired_internal",
      desiredPayload,
    );
  } catch {
    throw new Error(`Finance access outcome is unknown for event ${input.eventId}; run read-only status`);
  }
  let state = parseDesired(desiredResponse, input.eventId);
  let worker = null;
  if (input.dispatch && !TERMINAL_STATES.has(state.state)) {
    try {
      worker = await dispatchWorker(fetchImpl, origin, triggerSecret, input.eventId);
      const afterDispatch = await readAccessStatus(
        fetchImpl,
        origin,
        serviceKey,
        input.userId,
        input.eventId,
      );
      if (
        afterDispatch.event === null ||
        afterDispatch.event.version !== state.version ||
        afterDispatch.event.desired_state !== desiredState
      ) {
        throw new Error("target event status is unavailable");
      }
      state = Object.freeze({
        ...state,
        version: afterDispatch.event.version,
        state: afterDispatch.event.state,
      });
    } catch {
      throw new Error(
        `Finance access event ${input.eventId} was committed but dispatch status is unknown; run read-only status`,
      );
    }
  }

  return Object.freeze({
    ok: true,
    mode: "applied",
    target_environment: targetEnvironment,
    action: input.action,
    main_user_id: input.userId,
    event_id: input.eventId,
    version: state.version,
    state: state.state,
    replayed: state.replayed,
    worker,
  });
}

async function main() {
  const result = await manageFinanceAccess({ argv: process.argv.slice(2) });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`Finance access command failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
