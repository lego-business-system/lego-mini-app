import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  validateDisabledStagingBoundary,
  verifyDisabledStagingEdge,
} from "../../scripts/verify-disabled-staging-edge.mjs";

const FINANCE_REF = "makgsbjduobcphuqzaoq";
const MAIN_REF = "bljeoovhydhjhdzwplxh";
const FINANCE_ORIGIN = `https://${FINANCE_REF}.supabase.co`;
const MAIN_ORIGIN = `https://${MAIN_REF}.supabase.co`;
const FINANCE_WEB_ORIGIN =
  "https://architecture-finance-pilot.pages.dev";
const MAIN_WEB_ORIGIN = "https://architecture-main-pilot.pages.dev";
const EXACT_BODY = Buffer.from(
  '{"ok":false,"error":"temporarily_unavailable"}',
);

const CASES = Object.freeze([
  Object.freeze({
    name: "finance-issue-telegram-code",
    url: `${FINANCE_ORIGIN}/functions/v1/finance-issue-telegram-code`,
    origin: null,
    credential: "none",
  }),
  Object.freeze({
    name: "finance-apply-entitlement-event",
    url: `${FINANCE_ORIGIN}/functions/v1/finance-apply-entitlement-event`,
    origin: null,
    credential: "none",
  }),
  Object.freeze({
    name: "finance-consume-telegram-code",
    url: `${FINANCE_ORIGIN}/functions/v1/finance-consume-telegram-code`,
    origin: FINANCE_WEB_ORIGIN,
    credential: "finance_anon",
  }),
  Object.freeze({
    name: "main-finance-issue-code",
    url: `${MAIN_ORIGIN}/functions/v1/finance-issue-code`,
    origin: MAIN_WEB_ORIGIN,
    credential: "none",
  }),
  Object.freeze({
    name: "main-finance-sync-entitlements",
    url: `${MAIN_ORIGIN}/functions/v1/finance-sync-entitlements`,
    origin: null,
    credential: "none",
  }),
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function fixtureAnonKey(ref = FINANCE_REF, role = "anon") {
  return [
    base64UrlJson({ alg: "HS256", typ: "JWT" }),
    base64UrlJson({ iss: "supabase", ref, role, iat: 1, exp: 4_102_444_800 }),
    "fixture-signature-with-enough-characters-for-the-reviewed-boundary",
  ].join(".");
}

function fixture(t, {
  anonKey = fixtureAnonKey(),
  url = FINANCE_ORIGIN,
  mode = 0o600,
  receiptMutation = value => value,
} = {}) {
  const directory = realpathSync(
    mkdtempSync(path.join(os.tmpdir(), "disabled-edge-smoke-")),
  );
  chmodSync(directory, 0o700);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const publicApiFile = path.join(directory, "finance-public-api.env");
  const raw = Buffer.from([
    `FINANCE_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
    `FINANCE_PUBLIC_SUPABASE_URL=${url}`,
    "",
  ].join("\n"));
  writeFileSync(publicApiFile, raw, { mode });
  chmodSync(publicApiFile, mode);
  const receipt = receiptMutation({
    schemaVersion: 1,
    operation: "finance-staging-public-api-v1",
    environment: "staging",
    projectRef: FINANCE_REF,
    projectUrl: FINANCE_ORIGIN,
    keyKind: "legacy-anon",
    keySha256: sha256(anonKey),
    envFileSha256: sha256(raw),
    state: "success",
  });
  const publicApiReceiptFile = path.join(directory, "receipt.json");
  writeFileSync(publicApiReceiptFile, `${JSON.stringify(receipt)}\n`, {
    mode: 0o600,
  });
  chmodSync(publicApiReceiptFile, 0o600);
  return { anonKey, directory, publicApiFile, publicApiReceiptFile };
}

function headerBag(values) {
  const map = new Map(
    Object.entries(values)
      .map(([name, value]) => [name.toLowerCase(), String(value)]),
  );
  return Object.freeze({
    get(name) {
      return map.get(String(name).toLowerCase()) ?? null;
    },
  });
}

function bodyStream(chunks, onCancel = () => {}) {
  let index = 0;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    index = chunks.length;
    onCancel();
  };
  return Object.freeze({
    cancel,
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          const value = chunks[index];
          index += 1;
          return { done: false, value };
        },
        cancel,
        releaseLock() {},
      };
    },
  });
}

function response(url, {
  status = 503,
  redirected = false,
  responseUrl = url,
  headers = {},
  chunks = [EXACT_BODY],
  body = null,
} = {}) {
  return {
    status,
    redirected,
    url: responseUrl,
    headers: headerBag({
      "content-type": "application/json; charset=utf-8",
      "content-length": String(EXACT_BODY.byteLength),
      ...headers,
    }),
    body: body ?? bodyStream(chunks),
  };
}

function successfulFetch() {
  const calls = [];
  return {
    calls,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return response(url);
    },
  };
}

test("the operator sends exactly five staging probes with the reviewed Origin and auth boundary", async t => {
  const files = fixture(t);
  const mock = successfulFetch();
  const result = await verifyDisabledStagingEdge({
    publicApiFile: files.publicApiFile,
    publicApiReceiptFile: files.publicApiReceiptFile,
    fetchImpl: mock.fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.environment, "staging");
  assert.equal(result.productionTouched, false);
  assert.equal(result.exactDisabledResponseProved, true);
  assert.equal(result.credentialValidated, true);
  assert.equal(result.secretPrinted, false);
  assert.deepEqual(result.cases, CASES.map(item => ({
    name: item.name,
    status: 503,
    disabled: true,
  })));
  assert.equal(mock.calls.length, 5);

  for (const [index, call] of mock.calls.entries()) {
    const spec = CASES[index];
    assert.equal(call.url, spec.url);
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.body, "{}");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.credentials, "omit");
    assert.equal(call.options.referrerPolicy, "no-referrer");
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.signal instanceof AbortSignal, true);
    assert.equal(call.options.headers.get("accept"), "application/json");
    assert.equal(call.options.headers.get("content-type"), "application/json");
    assert.equal(call.options.headers.get("origin"), spec.origin);
    assert.equal(call.options.headers.has("cookie"), false);
    if (spec.credential === "finance_anon") {
      assert.equal(call.options.headers.get("apikey"), files.anonKey);
      assert.equal(
        call.options.headers.get("authorization"),
        `Bearer ${files.anonKey}`,
      );
    } else {
      assert.equal(call.options.headers.has("apikey"), false);
      assert.equal(call.options.headers.has("authorization"), false);
    }
  }

  const printed = JSON.stringify(result);
  assert.equal(printed.includes(files.anonKey), false);
  assert.equal(printed.includes(sha256(files.anonKey)), false);
});

test("the immutable boundary rejects production, arbitrary refs, route drift and Origin drift", () => {
  assert.deepEqual(validateDisabledStagingBoundary(CASES), CASES);
  const mutations = [
    cases => cases.map((item, index) => index === 0
      ? { ...item, url: item.url.replace(FINANCE_REF, "koibxwgtihwajocxfetb") }
      : item),
    cases => cases.map((item, index) => index === 3
      ? { ...item, url: item.url.replace(MAIN_REF, "abcdefghijklmnopqrst") }
      : item),
    cases => cases.map((item, index) => index === 4
      ? { ...item, url: `${item.url}?mode=disabled` }
      : item),
    cases => cases.map((item, index) => index === 2
      ? { ...item, origin: "https://example.test" }
      : item),
    cases => cases.slice(0, 4),
  ];
  for (const mutate of mutations) {
    assert.throws(
      () => validateDisabledStagingBoundary(mutate(CASES)),
      /Disabled staging Edge verification refused/,
    );
  }
});

test("external Finance anon input is exact, owner-private, staging-only and receipt-attested", async t => {
  const fetchMustNotRun = async () => {
    throw new Error("fetch must not run");
  };
  const scenarios = [
    () => fixture(t, { mode: 0o644 }),
    () => fixture(t, { url: "https://koibxwgtihwajocxfetb.supabase.co" }),
    () => fixture(t, { anonKey: fixtureAnonKey("koibxwgtihwajocxfetb") }),
    () => fixture(t, { anonKey: fixtureAnonKey(FINANCE_REF, "service_role") }),
    () => fixture(t, {
      receiptMutation: receipt => ({ ...receipt, envFileSha256: "0".repeat(64) }),
    }),
    () => fixture(t, {
      receiptMutation: receipt => ({ ...receipt, projectRef: MAIN_REF }),
    }),
  ];
  for (const build of scenarios) {
    const files = build();
    await assert.rejects(
      verifyDisabledStagingEdge({
        publicApiFile: files.publicApiFile,
        publicApiReceiptFile: files.publicApiReceiptFile,
        fetchImpl: fetchMustNotRun,
      }),
      /Disabled staging Edge verification refused/,
    );
  }

  const files = fixture(t);
  const link = path.join(files.directory, "linked.env");
  symlinkSync(files.publicApiFile, link);
  await assert.rejects(
    verifyDisabledStagingEdge({
      publicApiFile: link,
      publicApiReceiptFile: files.publicApiReceiptFile,
      fetchImpl: fetchMustNotRun,
    }),
    /Disabled staging Edge verification refused/,
  );
});

test("status, direct URL, exact raw body and JSON Content-Type must all match", async t => {
  const files = fixture(t);
  const scenarios = [
    url => response(url, { status: 200 }),
    url => response(url, { redirected: true }),
    url => response(url, { responseUrl: `${url}/` }),
    url => response(url, {
      chunks: [Buffer.from('{"error":"temporarily_unavailable","ok":false}')],
      headers: {
        "content-length": String(
          Buffer.byteLength('{"error":"temporarily_unavailable","ok":false}'),
        ),
      },
    }),
    url => response(url, {
      chunks: [Buffer.from('{"ok": false, "error": "temporarily_unavailable"}')],
      headers: {
        "content-length": String(
          Buffer.byteLength(
            '{"ok": false, "error": "temporarily_unavailable"}',
          ),
        ),
      },
    }),
    url => response(url, {
      headers: { "content-type": "application/json" },
    }),
  ];
  for (const buildResponse of scenarios) {
    let calls = 0;
    await assert.rejects(
      verifyDisabledStagingEdge({
        publicApiFile: files.publicApiFile,
        publicApiReceiptFile: files.publicApiReceiptFile,
        fetchImpl: async url => {
          calls += 1;
          return buildResponse(url);
        },
      }),
      /Disabled staging Edge verification refused/,
    );
    assert.equal(calls, 1);
  }
});

test("size, compression, cookie, auth challenge and redirect metadata fail closed", async t => {
  const files = fixture(t);
  const scenarios = [
    url => response(url, {
      headers: { "content-length": "129" },
      chunks: [Buffer.alloc(129, 0x61)],
    }),
    url => response(url, {
      headers: { "content-encoding": "gzip" },
    }),
    url => response(url, {
      headers: { "set-cookie": "session=forbidden" },
    }),
    url => response(url, {
      headers: { "www-authenticate": "Bearer" },
    }),
    url => response(url, {
      headers: { location: "https://example.test" },
    }),
    url => response(url, {
      headers: { "content-length": "not-a-number" },
    }),
    url => response(url, {
      chunks: [EXACT_BODY, Buffer.from("x")],
      headers: { "content-length": String(EXACT_BODY.byteLength) },
    }),
  ];
  for (const buildResponse of scenarios) {
    await assert.rejects(
      verifyDisabledStagingEdge({
        publicApiFile: files.publicApiFile,
        publicApiReceiptFile: files.publicApiReceiptFile,
        fetchImpl: async url => buildResponse(url),
      }),
      /Disabled staging Edge verification refused/,
    );
  }
});

test("fetch and body-read timeouts fail closed without proceeding to later endpoints", async t => {
  const files = fixture(t);
  let fetchCalls = 0;
  await assert.rejects(
    verifyDisabledStagingEdge({
      publicApiFile: files.publicApiFile,
      publicApiReceiptFile: files.publicApiReceiptFile,
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Promise(() => {});
      },
      timeoutMilliseconds: 15,
    }),
    /network result is unavailable/,
  );
  assert.equal(fetchCalls, 1);

  let bodyCalls = 0;
  await assert.rejects(
    verifyDisabledStagingEdge({
      publicApiFile: files.publicApiFile,
      publicApiReceiptFile: files.publicApiReceiptFile,
      fetchImpl: async url => {
        bodyCalls += 1;
        return response(url, {
          body: {
            cancel() {},
            getReader() {
              return {
                read() {
                  return new Promise(() => {});
                },
                cancel() {},
                releaseLock() {},
              };
            },
          },
        });
      },
      timeoutMilliseconds: 15,
    }),
    /network result is unavailable/,
  );
  assert.equal(bodyCalls, 1);
});

test("test fixtures themselves contain no real credential and source has no embedded key", () => {
  const source = readFileSync(
    "scripts/verify-disabled-staging-edge.mjs",
    "utf8",
  );
  assert.doesNotMatch(source, /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/u);
  assert.doesNotMatch(source, /service_role.*eyJ/iu);
  assert.match(source, /secretPrinted: false/u);
});
