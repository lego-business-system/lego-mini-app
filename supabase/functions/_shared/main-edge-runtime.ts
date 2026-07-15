import { createClient } from "@supabase/supabase-js";
import { parseAllowedOrigins } from "./main-finance-protocol.mjs";

const utf8 = new TextEncoder();

const SAFE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

export class RequestRejected extends Error {}
export class ConfigurationRejected extends Error {}
export class DependencyUnavailable extends Error {}

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigurationRejected("required runtime configuration is missing");
  }
  return value;
}

export function boundedIntegerEnv(
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") return defaultValue;
  if (!/^[0-9]+$/.test(raw)) {
    throw new ConfigurationRejected("runtime configuration is malformed");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationRejected("runtime configuration is out of bounds");
  }
  return value;
}

export function requireSecret(name: string, minimumBytes = 32): string {
  const value = env(name);
  if (utf8.encode(value).byteLength < minimumBytes) {
    throw new ConfigurationRejected("runtime secret is too short");
  }
  return value;
}

function parseDefaultKeyDictionary(name: string): string | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof parsed.default === "string" &&
      parsed.default.length > 0
    ) {
      return parsed.default;
    }
  } catch {
    throw new ConfigurationRejected("Supabase key configuration is malformed");
  }
  throw new ConfigurationRejected("Supabase key configuration is malformed");
}

function serviceKey(): string {
  return (
    Deno.env.get("MAIN_SUPABASE_SECRET_KEY") ||
    parseDefaultKeyDictionary("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    (() => {
      throw new ConfigurationRejected("Supabase server credential is missing");
    })()
  );
}

function supabaseUrl(): string {
  const raw = env("SUPABASE_URL");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.origin !== raw.replace(/\/$/, "") ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  ) {
    throw new ConfigurationRejected("Supabase URL is malformed");
  }
  return url.origin;
}

function timeoutFetch(timeoutMilliseconds: number): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    if (upstreamSignal?.aborted) abortFromUpstream();
    else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
    const timeout = setTimeout(
      () => controller.abort(new DOMException("request timeout", "TimeoutError")),
      timeoutMilliseconds,
    );
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    }
  };
}

export function serviceClient(timeoutMilliseconds: number) {
  return createClient(supabaseUrl(), serviceKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { fetch: timeoutFetch(timeoutMilliseconds) },
  });
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function allowedOrigin(request: Request): string {
  const origin = request.headers.get("origin") ?? "";
  const allowed = parseAllowedOrigins(env("MAIN_FINANCE_ALLOWED_ORIGINS"));
  if (!allowed.has(origin)) throw new RequestRejected("origin is not allowed");
  if (request.headers.has("cookie") || request.headers.has("authorization")) {
    throw new RequestRejected("ambient credentials are not accepted");
  }
  return origin;
}

export function preflightResponse(request: Request, origin: string): Response {
  const requestedMethod = request.headers.get("access-control-request-method") ?? "";
  const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (
    requestedMethod !== "POST" ||
    requestedHeaders.some((value) => value !== "content-type")
  ) {
    throw new RequestRejected("CORS preflight is malformed");
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function jsonResponse(
  status: number,
  payload: Record<string, unknown>,
  origin: string | null,
  additionalHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...SAFE_HEADERS,
      ...(origin ? corsHeaders(origin) : {}),
      ...additionalHeaders,
    },
  });
}

function waitForRead<T>(promise: Promise<T>, timeoutMilliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new RequestRejected("body read timed out")),
      timeoutMilliseconds,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function readStreamBytes(
  message: Request | Response,
  maximumBytes: number,
  timeoutMilliseconds: number,
): Promise<Uint8Array> {
  const contentLength = message.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > maximumBytes)
  ) {
    throw new RequestRejected("body is too large");
  }
  if (!message.body) throw new RequestRejected("body is missing");
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const deadline = Date.now() + timeoutMilliseconds;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new RequestRejected("body read timed out");
      const { value, done } = await waitForRead(reader.read(), remaining);
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) throw new RequestRejected("body is too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  if (total === 0) throw new RequestRejected("body is missing");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readJsonRequestBytes(
  request: Request,
  maximumBytes: number,
  timeoutMilliseconds: number,
): Promise<Uint8Array> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    throw new RequestRejected("content type is not supported");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") {
    throw new RequestRejected("content encoding is not supported");
  }
  return readStreamBytes(request, maximumBytes, timeoutMilliseconds);
}

export async function fetchBounded(
  url: string,
  init: RequestInit,
  timeoutMilliseconds: number,
  maximumResponseBytes: number,
): Promise<{ response: Response; body: Uint8Array }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("upstream timeout", "TimeoutError")),
    timeoutMilliseconds,
  );
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    const body = await readStreamBytes(
      response,
      maximumResponseBytes,
      timeoutMilliseconds,
    );
    return { response, body };
  } catch {
    throw new DependencyUnavailable("upstream request failed");
  } finally {
    clearTimeout(timeout);
  }
}
