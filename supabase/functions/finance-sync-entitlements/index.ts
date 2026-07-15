import {
  buildEntitlementRequest,
  classifyEntitlementResponse,
  normalizeTelegramId,
  parseEntitlementClaim,
  validateEntitlementEndpoint,
} from "../_shared/main-entitlement-protocol.mjs";
import {
  constantTimeHexEqual,
  derivePrivateDigest,
  sha256Hex,
} from "../_shared/main-finance-protocol.mjs";
import {
  boundedIntegerEnv,
  ConfigurationRejected,
  env,
  jsonResponse,
  readJsonRequestBytes,
  RequestRejected,
  requireSecret,
  serviceClient,
} from "../_shared/main-edge-runtime.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const INCOMING_PATH = "/functions/v1/finance-sync-entitlements";
const UPSTREAM_PATH = "/functions/v1/finance-apply-entitlement-event";
const PRODUCT_CODE = "architecture_finance";
const WORKER_REF = "worker:finance_entitlement_sync_v1";
const TRIGGER_HEADER = "x-architecture-sync-trigger";
const TRIGGER_SECRET = /^[A-Za-z0-9._~-]{32,200}$/;
const MAX_FINISH_ERROR_CODE_LENGTH = 64;

class WorkerUnavailable extends Error {}
class UpstreamUnavailable extends Error {}
class UpstreamProtocolFailure extends Error {
  readonly code: string;

  constructor(code: string) {
    super("upstream protocol failed");
    this.code = code;
  }
}

type WorkerConfig = Readonly<{
  totalDeadline: number;
  databaseTimeout: number;
  upstreamTimeout: number;
  upstreamMaximumResponseBytes: number;
  batchSize: number;
  leaseSeconds: number;
  upstreamUrl: string;
  hmacSecret: string;
  privacyKey: string;
}>;

type ClaimedEvent = Readonly<{
  eventId: string;
  mainUserId: string;
  subjectDigest: string;
  productCode: string;
  desiredState: "granted" | "revoked";
  eventVersion: string;
  eventOccurredAt: string;
  attemptCount: number;
  leaseExpiresAt: string;
}>;

type FinishOutcome = "applied" | "retry" | "dead_letter";

function unavailable(): Response {
  return jsonResponse(503, { ok: false, error: "temporarily_unavailable" }, null);
}

function rejected(status: number, error: string): Response {
  return jsonResponse(status, { ok: false, error }, null);
}

function timeoutWithinDeadline(deadline: number, configuredTimeout: number): number {
  const remaining = Math.floor(deadline - Date.now());
  if (remaining < 250) throw new WorkerUnavailable("worker deadline exhausted");
  return Math.min(configuredTimeout, remaining);
}

async function triggerMatches(supplied: string, expected: string): Promise<boolean> {
  if (!TRIGGER_SECRET.test(supplied) || !TRIGGER_SECRET.test(expected)) return false;
  const [suppliedDigest, expectedDigest] = await Promise.all([
    sha256Hex(supplied),
    sha256Hex(expected),
  ]);
  return constantTimeHexEqual(suppliedDigest, expectedDigest);
}

function readWorkerConfig(): WorkerConfig {
  const totalTimeout = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_TOTAL_TIMEOUT_MS",
    24_000,
    5_000,
    25_000,
  );
  const totalDeadline = Date.now() + totalTimeout;
  const databaseTimeout = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_DB_TIMEOUT_MS",
    5_000,
    500,
    15_000,
  );
  const upstreamTimeout = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_UPSTREAM_TIMEOUT_MS",
    6_000,
    500,
    15_000,
  );
  const upstreamMaximumResponseBytes = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_MAX_RESPONSE_BYTES",
    2_048,
    64,
    8_192,
  );
  const batchSize = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_BATCH_SIZE",
    3,
    1,
    10,
  );
  const leaseSeconds = boundedIntegerEnv(
    "MAIN_FINANCE_SYNC_LEASE_SECONDS",
    60,
    30,
    300,
  );
  if (leaseSeconds * 1_000 < totalTimeout + 5_000) {
    throw new ConfigurationRejected("worker lease is shorter than its deadline");
  }
  if (env("MAIN_FINANCE_SYNC_PATH") !== INCOMING_PATH) {
    throw new ConfigurationRejected("worker path is not the reviewed path");
  }
  const canonicalPath = env("MAIN_FINANCE_ENTITLEMENT_CANONICAL_PATH");
  if (canonicalPath !== UPSTREAM_PATH) {
    throw new ConfigurationRejected("upstream path is not the reviewed path");
  }
  let upstreamUrl;
  try {
    upstreamUrl = validateEntitlementEndpoint(
      env("MAIN_FINANCE_ENTITLEMENT_UPSTREAM_URL"),
      canonicalPath,
    );
  } catch {
    throw new ConfigurationRejected("upstream endpoint is malformed");
  }
  if (env("MAIN_FINANCE_PRODUCT_CODE") !== PRODUCT_CODE) {
    throw new ConfigurationRejected("worker product is not the reviewed product");
  }

  const triggerSecret = requireSecret("MAIN_FINANCE_SYNC_TRIGGER_SECRET");
  const hmacSecret = requireSecret("MAIN_FINANCE_ENTITLEMENT_HMAC_SECRET");
  const privacyKey = requireSecret("MAIN_FINANCE_PRIVACY_HMAC_KEY");
  if (!TRIGGER_SECRET.test(triggerSecret)) {
    throw new ConfigurationRejected("worker trigger secret is malformed");
  }
  const otherSecrets = [
    Deno.env.get("MAIN_FINANCE_ISSUER_HMAC_SECRET"),
    Deno.env.get("MAIN_FINANCE_NONCE_DERIVATION_KEY"),
    Deno.env.get("TELEGRAM_BOT_TOKEN"),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const separatedSecrets = [triggerSecret, hmacSecret, privacyKey, ...otherSecrets];
  if (new Set(separatedSecrets).size !== separatedSecrets.length) {
    throw new ConfigurationRejected("integration secrets must be separated");
  }

  return Object.freeze({
    totalDeadline,
    databaseTimeout,
    upstreamTimeout,
    upstreamMaximumResponseBytes,
    batchSize,
    leaseSeconds,
    upstreamUrl,
    hmacSecret,
    privacyKey,
  });
}

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => keys.includes(key));
}

async function claimEvent(config: WorkerConfig, claimToken: string): Promise<ClaimedEvent | null> {
  const { data, error } = await serviceClient(
    timeoutWithinDeadline(config.totalDeadline, config.databaseTimeout),
  ).rpc("architecture_claim_finance_access_outbox_internal", {
    p_claim_token: claimToken,
    p_worker_ref: WORKER_REF,
    p_lease_seconds: config.leaseSeconds,
  });
  if (error) throw new WorkerUnavailable("outbox claim failed");
  try {
    return parseEntitlementClaim(data) as ClaimedEvent | null;
  } catch {
    throw new WorkerUnavailable("outbox claim contract failed");
  }
}

async function finishEvent(
  config: WorkerConfig,
  event: ClaimedEvent,
  claimToken: string,
  outcome: FinishOutcome,
  errorCode: string | null,
): Promise<void> {
  if (
    (outcome === "applied" && errorCode !== null) ||
    (outcome !== "applied" && (
      typeof errorCode !== "string" ||
      !/^[a-z0-9_]+$/.test(errorCode) ||
      errorCode.length > MAX_FINISH_ERROR_CODE_LENGTH
    ))
  ) {
    throw new WorkerUnavailable("finish outcome is malformed");
  }
  const { data, error } = await serviceClient(
    timeoutWithinDeadline(config.totalDeadline, config.databaseTimeout),
  ).rpc("architecture_finish_finance_access_outbox_internal", {
    p_event_id: event.eventId,
    p_claim_token: claimToken,
    p_outcome: outcome,
    p_error_code: errorCode,
  });
  if (error) throw new WorkerUnavailable("outbox finish failed");
  const expectedState = outcome === "retry" ? "retry_wait" : outcome;
  const keys = outcome === "retry"
    ? ["ok", "replayed", "state", "version", "next_attempt_at"]
    : ["ok", "replayed", "state", "version"];
  if (
    !exactObject(data, keys) ||
    data.ok !== true ||
    typeof data.replayed !== "boolean" ||
    data.state !== expectedState ||
    data.version !== event.eventVersion ||
    (outcome === "retry" && (
      typeof data.next_attempt_at !== "string" ||
      !Number.isFinite(Date.parse(data.next_attempt_at))
    ))
  ) {
    throw new WorkerUnavailable("outbox finish contract failed");
  }
}

async function resolveTelegramId(
  config: WorkerConfig,
  mainUserId: string,
): Promise<{ kind: "ok"; telegramId: string } | { kind: "retry" } | { kind: "dead" }> {
  const { data, error } = await serviceClient(
    timeoutWithinDeadline(config.totalDeadline, config.databaseTimeout),
  ).rpc("architecture_resolve_finance_subject_internal", {
    p_main_user_id: mainUserId,
  });
  if (error) return { kind: "retry" };

  if (
    exactObject(data, ["ok", "main_user_id", "telegram_id"]) &&
    data.ok === true &&
    data.main_user_id === mainUserId
  ) {
    try {
      return { kind: "ok", telegramId: normalizeTelegramId(data.telegram_id) };
    } catch {
      return { kind: "dead" };
    }
  }

  if (
    exactObject(data, ["ok", "error"]) &&
    data.ok === false &&
    ["main_user_not_found", "main_user_identity_invalid"].includes(
      data.error as string,
    )
  ) {
    return { kind: "dead" };
  }

  return { kind: "retry" };
}

async function readResponseBody(
  response: Response,
  maximumBytes: number,
  deadline: number,
): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > maximumBytes)
  ) {
    throw new UpstreamProtocolFailure("protocol_response_too_large");
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining < 1) throw new UpstreamUnavailable("upstream body timeout");
      const result = await new Promise<ReadableStreamReadResult<Uint8Array>>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new UpstreamUnavailable("upstream body timeout")),
            remaining,
          );
          reader.read().then(
            (value) => {
              clearTimeout(timeout);
              resolve(value);
            },
            (error) => {
              clearTimeout(timeout);
              reject(error);
            },
          );
        },
      );
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maximumBytes) {
        throw new UpstreamProtocolFailure("protocol_response_too_large");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function fetchUpstream(
  config: WorkerConfig,
  body: Uint8Array,
  headers: Record<string, string>,
): Promise<{ response: Response; body: Uint8Array }> {
  const timeoutMilliseconds = timeoutWithinDeadline(
    config.totalDeadline,
    config.upstreamTimeout,
  );
  const deadline = Date.now() + timeoutMilliseconds;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("upstream timeout", "TimeoutError")),
    timeoutMilliseconds,
  );
  try {
    const response = await fetch(config.upstreamUrl, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers,
      body: new Uint8Array(body).buffer,
    });
    return {
      response,
      body: await readResponseBody(
        response,
        config.upstreamMaximumResponseBytes,
        deadline,
      ),
    };
  } catch (error) {
    if (error instanceof UpstreamProtocolFailure) throw error;
    throw new UpstreamUnavailable("upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
}

async function processEvent(
  config: WorkerConfig,
  event: ClaimedEvent,
  claimToken: string,
): Promise<FinishOutcome> {
  const identity = await resolveTelegramId(config, event.mainUserId);
  if (identity.kind === "retry") {
    await finishEvent(config, event, claimToken, "retry", "main_user_lookup_unavailable");
    return "retry";
  }
  if (identity.kind === "dead") {
    await finishEvent(config, event, claimToken, "dead_letter", "main_user_identity_invalid");
    return "dead_letter";
  }

  const derivedSubject = await derivePrivateDigest(
    config.privacyKey,
    "main-telegram-subject-v1",
    identity.telegramId,
  );
  if (!constantTimeHexEqual(derivedSubject, event.subjectDigest)) {
    await finishEvent(config, event, claimToken, "dead_letter", "subject_digest_mismatch");
    return "dead_letter";
  }

  const eventAction = event.desiredState === "granted" ? "grant" : "revoke";
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const nonce = crypto.randomUUID();
  const request = await buildEntitlementRequest({
    event: {
      eventId: event.eventId,
      eventVersion: event.eventVersion,
      eventAction,
      telegramId: identity.telegramId,
      productCode: event.productCode,
      eventOccurredAt: event.eventOccurredAt,
    },
    path: UPSTREAM_PATH,
    timestamp,
    nonce,
    secret: config.hmacSecret,
  });

  let upstream;
  try {
    upstream = await fetchUpstream(config, request.body, {
      Accept: "application/json",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "x-architecture-timestamp": timestamp,
      "x-architecture-nonce": nonce,
      "x-architecture-event-id": event.eventId,
      "x-architecture-signature": request.signature,
    });
  } catch (error) {
    if (error instanceof UpstreamProtocolFailure) {
      await finishEvent(config, event, claimToken, "dead_letter", error.code);
      return "dead_letter";
    }
    await finishEvent(config, event, claimToken, "retry", "upstream_unavailable");
    return "retry";
  }

  const classification = classifyEntitlementResponse({
    status: upstream.response.status,
    contentType: upstream.response.headers.get("content-type") ?? "",
    contentEncoding: upstream.response.headers.get("content-encoding") ?? "",
    body: upstream.body,
    event: {
      eventId: event.eventId,
      eventVersion: event.eventVersion,
      eventAction,
    },
  });
  await finishEvent(
    config,
    event,
    claimToken,
    classification.outcome,
    classification.errorCode,
  );
  return classification.outcome;
}

export async function handleFinanceSyncRequest(request: Request): Promise<Response> {
  try {
    const incomingUrl = new URL(request.url);
    if (incomingUrl.pathname !== INCOMING_PATH || incomingUrl.search !== "") {
      throw new RequestRejected("request path is malformed");
    }
    if (request.method !== "POST") {
      return rejected(405, "method_not_allowed");
    }
    if (
      request.headers.has("origin") ||
      request.headers.has("cookie") ||
      request.headers.has("authorization") ||
      request.headers.has("access-control-request-method") ||
      request.headers.has("access-control-request-headers")
    ) {
      throw new RequestRejected("ambient request context is not accepted");
    }
    if (Deno.env.get("MAIN_FINANCE_SYNC_MODE") !== "enabled") return unavailable();

    const config = readWorkerConfig();
    const suppliedTrigger = request.headers.get(TRIGGER_HEADER) ?? "";
    const expectedTrigger = requireSecret("MAIN_FINANCE_SYNC_TRIGGER_SECRET");
    if (!(await triggerMatches(suppliedTrigger, expectedTrigger))) {
      return rejected(401, "unauthorized");
    }
    const body = await readJsonRequestBytes(
      request,
      2,
      timeoutWithinDeadline(
        config.totalDeadline,
        boundedIntegerEnv("MAIN_FINANCE_SYNC_BODY_TIMEOUT_MS", 2_000, 250, 5_000),
      ),
    );
    if (decoder.decode(body) !== "{}") throw new RequestRejected("request body is not canonical");

    const counts = {
      claimed: 0,
      applied: 0,
      retried: 0,
      dead_lettered: 0,
    };
    for (let index = 0; index < config.batchSize; index += 1) {
      timeoutWithinDeadline(config.totalDeadline, 250);
      const claimToken = crypto.randomUUID();
      const event = await claimEvent(config, claimToken);
      if (event === null) break;
      counts.claimed += 1;
      const outcome = await processEvent(config, event, claimToken);
      if (outcome === "applied") counts.applied += 1;
      else if (outcome === "retry") counts.retried += 1;
      else counts.dead_lettered += 1;
    }
    return jsonResponse(200, { ok: true, ...counts }, null);
  } catch (error) {
    if (error instanceof RequestRejected) return rejected(400, "invalid_request");
    return unavailable();
  }
}

Deno.serve(handleFinanceSyncRequest);
