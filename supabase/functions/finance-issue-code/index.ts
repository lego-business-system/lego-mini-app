import {
  buildFinanceCanonicalRequest,
  buildFinanceIssuerBody,
  deriveFinanceNonce,
  derivePrivateDigest,
  parseCanonicalIssueRequestBytes,
  sha256Hex,
  signFinanceCanonicalRequest,
  validateFinanceEndpoint,
  validateFinanceSuccess,
  validateTelegramInitData,
} from "../_shared/main-finance-protocol.mjs";
import {
  allowedOrigin,
  boundedIntegerEnv,
  ConfigurationRejected,
  DependencyUnavailable,
  env,
  fetchBounded,
  jsonResponse,
  preflightResponse,
  readJsonRequestBytes,
  RequestRejected,
  requireSecret,
  serviceClient,
} from "../_shared/main-edge-runtime.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const EXPECTED_PRODUCT = "architecture_finance";
const DATABASE_MAX_REPLAY_WINDOW_SECONDS = 15 * 60;
const REPLAY_EXPIRY_SAFETY_SECONDS = 60;
const MAX_TELEGRAM_INIT_DATA_AGE_SECONDS = 780;
const MAX_TELEGRAM_FUTURE_SKEW_SECONDS = 60;
const FINANCE_HEADERS = Object.freeze({
  timestamp: "x-architecture-timestamp",
  nonce: "x-architecture-nonce",
  requestId: "x-architecture-request-id",
  signature: "x-architecture-signature",
});

function rejected(origin: string | null, status = 400): Response {
  return jsonResponse(status, { ok: false, error: "request_rejected" }, origin);
}

function unavailable(origin: string | null): Response {
  return jsonResponse(503, { ok: false, error: "temporarily_unavailable" }, origin);
}

function timeoutWithinDeadline(deadline: number, configuredTimeout: number): number {
  const remaining = Math.floor(deadline - Date.now());
  if (remaining < 250) {
    throw new DependencyUnavailable("request deadline exhausted");
  }
  return Math.min(configuredTimeout, remaining);
}

function bytea(hex: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new TypeError("digest is malformed");
  return `\\x${hex}`;
}

function parseBeginResult(value: unknown): {
  ok: boolean;
  error: string | null;
  state: string | null;
  replayed: boolean;
  financeTimestamp: string | null;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("database begin result is malformed");
  }
  const row = value as Record<string, unknown>;
  if (row.ok === false && typeof row.error === "string") {
    return { ok: false, error: row.error, state: null, replayed: false, financeTimestamp: null };
  }
  if (
    row.ok !== true ||
    typeof row.replayed !== "boolean" ||
    !["pending", "upstream_error", "succeeded", "rejected"].includes(String(row.state)) ||
    typeof row.finance_timestamp !== "string" ||
    !/^[1-9][0-9]{9,12}$/.test(row.finance_timestamp)
  ) {
    throw new TypeError("database begin result is malformed");
  }
  return {
    ok: true,
    error: null,
    state: String(row.state),
    replayed: row.replayed,
    financeTimestamp: row.finance_timestamp,
  };
}

async function finishRequest(
  databaseTimeout: number,
  requestId: string,
  requestFingerprint: string,
  outcome: "succeeded" | "rejected" | "upstream_error",
  responseExpiresAt: string | null,
): Promise<boolean> {
  const { data, error } = await serviceClient(databaseTimeout).rpc(
    "architecture_finish_finance_issue_internal",
    {
      p_request_id: requestId,
      p_request_fingerprint: bytea(requestFingerprint),
      p_outcome: outcome,
      p_response_expires_at: responseExpiresAt,
    },
  );
  return !error && data !== null && typeof data === "object" &&
    (data as Record<string, unknown>).ok === true;
}

Deno.serve(async (request) => {
  let origin: string | null = null;
  try {
    origin = allowedOrigin(request);
    if (request.method === "OPTIONS") return preflightResponse(request, origin);
    if (request.method !== "POST") {
      return jsonResponse(
        405,
        { ok: false, error: "method_not_allowed" },
        origin,
        { Allow: "POST, OPTIONS" },
      );
    }

    const incomingPath = env("MAIN_FINANCE_ISSUER_PATH");
    const incomingUrl = new URL(request.url);
    if (
      incomingPath !== "/functions/v1/finance-issue-code" ||
      incomingUrl.pathname !== incomingPath ||
      incomingUrl.search !== ""
    ) {
      throw new RequestRejected("request path is malformed");
    }
    if (env("MAIN_FINANCE_PROTOCOL_MODE") !== "enabled") {
      return unavailable(origin);
    }

    const totalDeadline = Date.now() + boundedIntegerEnv(
      "MAIN_FINANCE_TOTAL_TIMEOUT_MS",
      24_000,
      15_000,
      25_000,
    );

    const body = await readJsonRequestBytes(
      request,
      boundedIntegerEnv("MAIN_FINANCE_MAX_BODY_BYTES", 12_288, 1_024, 32_768),
      timeoutWithinDeadline(
        totalDeadline,
        boundedIntegerEnv("MAIN_FINANCE_BODY_TIMEOUT_MS", 3_000, 250, 15_000),
      ),
    );
    const issueRequest = parseCanonicalIssueRequestBytes(body);
    const telegramMaxAge = boundedIntegerEnv(
      "MAIN_TELEGRAM_INIT_DATA_MAX_AGE_SECONDS",
      300,
      30,
      MAX_TELEGRAM_INIT_DATA_AGE_SECONDS,
    );
    const telegramFutureSkew = boundedIntegerEnv(
      "MAIN_TELEGRAM_INIT_DATA_MAX_FUTURE_SKEW_SECONDS",
      15,
      0,
      MAX_TELEGRAM_FUTURE_SKEW_SECONDS,
    );
    const replayWindowSeconds = telegramMaxAge + telegramFutureSkew +
      REPLAY_EXPIRY_SAFETY_SECONDS;
    if (replayWindowSeconds > DATABASE_MAX_REPLAY_WINDOW_SECONDS) {
      throw new ConfigurationRejected("Telegram replay window exceeds database contract");
    }
    const now = Date.now();
    const botToken = requireSecret("TELEGRAM_BOT_TOKEN");
    if (!/^[1-9][0-9]{4,15}:[A-Za-z0-9_-]{30,}$/.test(botToken)) {
      throw new ConfigurationRejected("Telegram bot token is malformed");
    }
    const telegram = await validateTelegramInitData({
      initData: issueRequest.initData,
      botToken,
      nowMilliseconds: now,
      maxAgeSeconds: telegramMaxAge,
      maxFutureSkewSeconds: telegramFutureSkew,
    });

    const productCode = env("MAIN_FINANCE_PRODUCT_CODE");
    if (productCode !== EXPECTED_PRODUCT) {
      throw new ConfigurationRejected("Finance product is not the reviewed product");
    }
    const privacyKey = requireSecret("MAIN_FINANCE_PRIVACY_HMAC_KEY");
    const nonceKey = requireSecret("MAIN_FINANCE_NONCE_DERIVATION_KEY");
    const issuerSecret = requireSecret("MAIN_FINANCE_ISSUER_HMAC_SECRET");
    if (new Set([botToken, privacyKey, nonceKey, issuerSecret]).size !== 4) {
      throw new ConfigurationRejected("integration secrets must be separated");
    }

    const subjectDigest = await derivePrivateDigest(
      privacyKey,
      "main-telegram-subject-v1",
      telegram.telegramId,
    );
    const initDataDigest = await derivePrivateDigest(
      privacyKey,
      "main-telegram-init-data-hash-v1",
      telegram.initDataHash,
    );
    const networkNonce = await deriveFinanceNonce(nonceKey, issueRequest.requestId);
    const networkNonceDigest = await derivePrivateDigest(
      privacyKey,
      "main-finance-network-nonce-v1",
      networkNonce,
    );
    const requestFingerprint = await derivePrivateDigest(
      privacyKey,
      "main-finance-issue-request-v1",
      [
        issueRequest.requestId,
        subjectDigest,
        initDataDigest,
        networkNonceDigest,
        productCode,
      ].join(":"),
    );
    const financeTimestamp = String(Math.floor(now / 1_000));
    const replayExpiresAt = new Date(
      now + replayWindowSeconds * 1_000,
    ).toISOString();
    const databaseTimeout = boundedIntegerEnv(
      "MAIN_FINANCE_DB_TIMEOUT_MS",
      5_000,
      500,
      20_000,
    );
    const finish = (
      outcome: "succeeded" | "rejected" | "upstream_error",
      responseExpiresAt: string | null,
    ): Promise<boolean> => {
      try {
        return finishRequest(
          timeoutWithinDeadline(totalDeadline, databaseTimeout),
          issueRequest.requestId,
          requestFingerprint,
          outcome,
          responseExpiresAt,
        );
      } catch {
        return Promise.resolve(false);
      }
    };
    const { data: beginData, error: beginError } = await serviceClient(
      timeoutWithinDeadline(totalDeadline, databaseTimeout),
    ).rpc(
      "architecture_begin_finance_issue_internal",
      {
        p_request_id: issueRequest.requestId,
        p_subject_digest: bytea(subjectDigest),
        p_init_data_digest: bytea(initDataDigest),
        p_product_code: productCode,
        p_network_nonce_digest: bytea(networkNonceDigest),
        p_request_fingerprint: bytea(requestFingerprint),
        p_finance_timestamp: financeTimestamp,
        p_replay_expires_at: replayExpiresAt,
      },
    );
    if (beginError) return unavailable(origin);
    let begin;
    try {
      begin = parseBeginResult(beginData);
    } catch {
      return unavailable(origin);
    }
    if (!begin.ok) {
      if (begin.error === "access_denied") return rejected(origin, 403);
      if (begin.error === "rate_limited") return rejected(origin, 429);
      return rejected(origin, 409);
    }
    if (begin.state === "rejected") return rejected(origin, 409);

    const upstreamMaxAge = boundedIntegerEnv(
      "MAIN_FINANCE_UPSTREAM_MAX_AGE_SECONDS",
      60,
      5,
      300,
    );
    const currentSeconds = Math.floor(Date.now() / 1_000);
    const storedTimestamp = Number(begin.financeTimestamp);
    if (
      !Number.isSafeInteger(storedTimestamp) ||
      storedTimestamp < currentSeconds - upstreamMaxAge ||
      storedTimestamp > currentSeconds + 10
    ) {
      return rejected(origin, 409);
    }

    const canonicalPath = env("MAIN_FINANCE_UPSTREAM_CANONICAL_PATH");
    let issuerUrl;
    try {
      issuerUrl = validateFinanceEndpoint(
        env("MAIN_FINANCE_UPSTREAM_ISSUER_URL"),
        canonicalPath,
      );
    } catch {
      throw new ConfigurationRejected("Finance issuer endpoint is malformed");
    }
    const financeBody = buildFinanceIssuerBody(telegram.telegramId, productCode);
    const bodyHash = await sha256Hex(financeBody);
    const canonicalRequest = buildFinanceCanonicalRequest({
      method: "POST",
      path: canonicalPath,
      timestamp: begin.financeTimestamp,
      nonce: networkNonce,
      requestId: issueRequest.requestId,
      bodySha256: bodyHash,
    });
    const signature = await signFinanceCanonicalRequest(
      issuerSecret,
      canonicalRequest,
    );

    let upstream;
    try {
      upstream = await fetchBounded(
        issuerUrl,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
            [FINANCE_HEADERS.timestamp]: begin.financeTimestamp,
            [FINANCE_HEADERS.nonce]: networkNonce,
            [FINANCE_HEADERS.requestId]: issueRequest.requestId,
            [FINANCE_HEADERS.signature]: signature,
          },
          body: financeBody,
        },
        timeoutWithinDeadline(
          totalDeadline,
          boundedIntegerEnv("MAIN_FINANCE_UPSTREAM_TIMEOUT_MS", 8_000, 500, 20_000),
        ),
        boundedIntegerEnv("MAIN_FINANCE_UPSTREAM_MAX_RESPONSE_BYTES", 2_048, 256, 8_192),
      );
    } catch (error) {
      if (error instanceof DependencyUnavailable) {
        await finish("upstream_error", null).catch(() => false);
        return unavailable(origin);
      }
      throw error;
    }

    if (upstream.response.status !== 200) {
      const permanent = [400, 401, 403, 409, 429].includes(upstream.response.status);
      const finished = await finish(
        permanent ? "rejected" : "upstream_error",
        null,
      ).catch(() => false);
      if (!finished) return unavailable(origin);
      return permanent
        ? rejected(origin, upstream.response.status === 429 ? 429 : 409)
        : unavailable(origin);
    }
    const responseType = upstream.response.headers.get("content-type") ?? "";
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(responseType)) {
      await finish("upstream_error", null).catch(() => false);
      return unavailable(origin);
    }

    let financeResult;
    try {
      financeResult = validateFinanceSuccess(
        JSON.parse(decoder.decode(upstream.body)),
        issueRequest.requestId,
        Date.now(),
      );
    } catch {
      await finish("upstream_error", null).catch(() => false);
      return unavailable(origin);
    }
    if (!(await finish("succeeded", financeResult.expiresAt))) {
      return unavailable(origin);
    }

    return jsonResponse(200, {
      ok: true,
      code: financeResult.code,
      expires_at: financeResult.expiresAt,
      replayed: begin.replayed || financeResult.replayed,
      request_id: financeResult.requestId,
    }, origin);
  } catch (error) {
    if (error instanceof RequestRejected || error instanceof TypeError) {
      return rejected(origin, 400);
    }
    return unavailable(origin);
  }
});
