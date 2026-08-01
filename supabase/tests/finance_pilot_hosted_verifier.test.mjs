import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildFinancePilot } from "../../scripts/build-finance-pilot.mjs";
import {
  FINANCE_PILOT_HOSTED_ROUTES,
  validateFinancePilotHostedPublicOrigin,
  verifyFinancePilotHosted,
} from "../../scripts/verify-finance-pilot-hosted.mjs";

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
  schemaVersion: 2,
  publicOrigin: "https://production-pilot.example",
  mainEdgeOrigin: "https://production-main.supabase.co",
  financeWebOrigin: "https://production-finance.example",
  telegramMiniAppUrl: "https://t.me/ArchitectureProductionBot?startapp",
});

function fixture(t, value, name) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-hosted-input-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, name);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return file;
}

function builtArtifact(t, config = CONFIG) {
  const configFile = fixture(t, config, "pilot-staging.json");
  const productionBoundaryFile = fixture(t, PRODUCTION_BOUNDARY, "production-boundary.json");
  const parent = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-hosted-artifact-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const artifactDirectory = path.join(parent, "artifact");
  buildFinancePilot({
    configFile,
    productionBoundaryFile,
    outputDirectory: artifactDirectory,
  });
  return { artifactDirectory, configFile, productionBoundaryFile };
}

function contractHeaders(artifactDirectory) {
  const result = {};
  const lines = readFileSync(path.join(artifactDirectory, "_headers"), "utf8").split("\n");
  for (const line of lines) {
    const match = /^  ([A-Za-z][A-Za-z0-9-]*): (.*)$/u.exec(line);
    if (match) result[match[1].toLowerCase()] = match[2];
  }
  return result;
}

function headerBag(values) {
  const normalized = new Map(
    Object.entries(values).map(([name, value]) => [name.toLowerCase(), String(value)]),
  );
  return Object.freeze({
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    },
  });
}

function bodyStream(chunks, { onCancel = () => {}, read = null } = {}) {
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
          if (read) return read();
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

function hostedMock(artifactDirectory, mutate = value => value) {
  const calls = [];
  const securityHeaders = contractHeaders(artifactDirectory);
  const routeByPath = new Map(FINANCE_PILOT_HOSTED_ROUTES.map(route => [route.pathname, route]));
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    const route = routeByPath.get(parsed.pathname);
    assert.ok(route, `unexpected hosted path ${parsed.pathname}`);
    const bytes = readFileSync(path.join(artifactDirectory, route.file));
    calls.push({ url, options, file: route.file });
    const candidate = {
      status: 200,
      redirected: false,
      url,
      headers: {
        ...securityHeaders,
        "content-type": `${route.mime}; charset=utf-8`,
        "content-length": String(bytes.length),
      },
      chunks: [bytes],
    };
    const response = mutate(candidate, route, calls.length - 1);
    return {
      status: response.status,
      redirected: response.redirected,
      url: response.url,
      headers: headerBag(response.headers),
      body: response.body ?? bodyStream(response.chunks),
    };
  };
  return { calls, fetchImpl };
}

test("hosted verifier pins the one reviewed Cloudflare Pages hostname", async t => {
  assert.equal(
    validateFinancePilotHostedPublicOrigin(CONFIG.publicOrigin),
    CONFIG.publicOrigin,
  );
  const files = builtArtifact(t);
  const refusedOrigins = [
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://10.0.0.1",
    "https://169.254.169.254",
    "https://[fd00::1]",
    "https://[fe80::1]",
    "https://architecture-main-pilot.pages.dev:444",
    "https://example.com",
    "https://pages.dev",
    "https://architecture-main-pilot.pages.dev.attacker.example",
    "https://architecture-main-pilot.pages.dev.evil.test",
    "https://user@architecture-main-pilot.pages.dev",
    "https://architecture-main-pilot.pages.dev@127.0.0.1",
  ];
  for (const [index, publicOrigin] of refusedOrigins.entries()) {
    assert.throws(
      () => validateFinancePilotHostedPublicOrigin(publicOrigin),
      /publicOrigin must be the exact reviewed Cloudflare Pages pilot origin/,
    );
    const configFile = fixture(t, { ...CONFIG, publicOrigin }, `unsafe-origin-${index}.json`);
    let calls = 0;
    await assert.rejects(
      verifyFinancePilotHosted({
        ...files,
        configFile,
        fetchImpl: async () => { calls += 1; },
      }),
      /(?:publicOrigin must be the exact reviewed Cloudflare Pages pilot origin|publicOrigin must be one exact HTTPS origin)/,
    );
    assert.equal(calls, 0, `network called for ${publicOrigin}`);
  }
});

test("hosted verifier reads the exact six public paths and validates all seven local files", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory);
  const result = await verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "hosted_read_only");
  assert.equal(result.environment, "staging");
  assert.equal(result.artifact_file_count, 7);
  assert.equal(result.request_count, 6);
  assert.equal(result.redirects_followed, false);
  assert.equal(result.credentials_sent, false);
  assert.equal(result.hosted_write_performed, false);
  assert.deepEqual(
    mock.calls.map(call => new URL(call.url).pathname),
    FINANCE_PILOT_HOSTED_ROUTES.map(route => route.pathname),
  );
  for (const call of mock.calls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.credentials, "omit");
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.referrerPolicy, "no-referrer");
    assert.ok(call.options.signal instanceof AbortSignal);
    assert.deepEqual(Object.keys(call.options.headers).sort(), ["Accept", "Accept-Encoding"]);
    assert.equal(call.options.headers["Accept-Encoding"], "identity");
  }
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(CONFIG.publicOrigin), false);
  assert.equal(serialized.includes(CONFIG.mainEdgeOrigin), false);
  assert.equal(serialized.includes(PRODUCTION_BOUNDARY.mainEdgeOrigin), false);
  assert.equal(serialized.includes(PRODUCTION_BOUNDARY.publicOrigin), false);
  assert.equal(serialized.includes(files.artifactDirectory), false);
  assert.match(result.target_origin_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(result.routes.length, 6);
  assert.equal(result.routes.some(route => route.path === "/_headers"), false);
  assert.equal(result.routes.some(route => route.path === "/index.html"), false);
});

test("hosted verifier refuses redirect responses", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    status: 302,
    redirected: true,
    url: "https://redirected.example/",
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted response redirected for index\.html/,
  );
  assert.equal(mock.calls.length, 1);
});

test("hosted verifier requires exact HTTP 200", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    status: 404,
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted status is not 200 for index\.html/,
  );
  assert.equal(mock.calls.length, 1);
});

test("hosted verifier refuses a cross-origin final URL even if a fetch implementation ignores redirect policy", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    url: "https://cross-origin.example/",
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted response crossed origin for index\.html/,
  );
  assert.equal(mock.calls.length, 1);
});

test("hosted verifier refuses byte drift", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, (response, route) => {
    if (route.file !== "index.html") return response;
    const changed = Buffer.from(response.chunks[0]);
    changed[0] ^= 1;
    return { ...response, chunks: [changed] };
  });
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted bytes differ for index\.html/,
  );
});

test("hosted verifier refuses HTTP security header drift", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => {
    const headers = { ...response.headers };
    headers["content-security-policy"] = "default-src *";
    return { ...response, headers };
  });
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted security header differs for index\.html: content-security-policy/,
  );
});

test("hosted verifier refuses MIME drift", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    headers: { ...response.headers, "content-type": "text/plain; charset=utf-8" },
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted MIME differs for index\.html/,
  );
});

test("hosted verifier refuses a conflicting Content-Length", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    headers: { ...response.headers, "content-length": "1" },
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted Content-Length differs for index\.html/,
  );
});

test("hosted verifier aborts and cancels every unread body rejected before streaming", async t => {
  const cases = [
    {
      name: "redirect",
      mutate: response => ({ ...response, status: 302, redirected: true }),
      error: /hosted response redirected for index\.html/,
    },
    {
      name: "status",
      mutate: response => ({ ...response, status: 503 }),
      error: /hosted status is not 200 for index\.html/,
    },
    {
      name: "security header",
      mutate: response => ({
        ...response,
        headers: { ...response.headers, "content-security-policy": "default-src *" },
      }),
      error: /hosted security header differs for index\.html: content-security-policy/,
    },
  ];

  for (const scenario of cases) {
    const files = builtArtifact(t);
    let cancelCalls = 0;
    const mock = hostedMock(files.artifactDirectory, response => ({
      ...scenario.mutate(response),
      body: bodyStream(response.chunks, { onCancel: () => { cancelCalls += 1; } }),
    }));
    await assert.rejects(
      verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
      scenario.error,
    );
    assert.equal(mock.calls.length, 1, scenario.name);
    assert.equal(mock.calls[0].options.signal.aborted, true, scenario.name);
    assert.equal(cancelCalls, 1, scenario.name);
  }
});

test("hosted verifier cancels and refuses an oversized body", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, response => ({
    ...response,
    headers: Object.fromEntries(
      Object.entries(response.headers).filter(([name]) => name !== "content-length"),
    ),
    chunks: [response.chunks[0], Buffer.from("x")],
  }));
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /hosted body exceeds the exact artifact size for index\.html/,
  );
});

test("hosted verifier refuses a production target before network", async t => {
  const files = builtArtifact(t);
  const productionConfigFile = fixture(t, {
    ...CONFIG,
    publicOrigin: PRODUCTION_BOUNDARY.publicOrigin,
  }, "production-target.json");
  let calls = 0;
  await assert.rejects(
    verifyFinancePilotHosted({
      ...files,
      configFile: productionConfigFile,
      fetchImpl: async () => { calls += 1; },
    }),
    /resolves to production/,
  );
  assert.equal(calls, 0);
});

test("hosted verifier requires a production public origin in the boundary", async t => {
  const files = builtArtifact(t);
  const legacyBoundaryFile = fixture(t, {
    schemaVersion: 1,
    mainEdgeOrigin: PRODUCTION_BOUNDARY.mainEdgeOrigin,
    financeWebOrigin: PRODUCTION_BOUNDARY.financeWebOrigin,
    telegramMiniAppUrl: PRODUCTION_BOUNDARY.telegramMiniAppUrl,
  }, "legacy-production-boundary.json");
  let calls = 0;
  await assert.rejects(
    verifyFinancePilotHosted({
      ...files,
      productionBoundaryFile: legacyBoundaryFile,
      fetchImpl: async () => { calls += 1; },
    }),
    /must include the exact production publicOrigin/,
  );
  assert.equal(calls, 0);
});

test("hosted verifier refuses inert placeholder config before network", async t => {
  const placeholder = {
    ...CONFIG,
    publicOrigin: "https://finance-pilot-bootstrap.invalid",
    telegramMiniAppUrl: "https://t.me/ArchitecturePilotPendingBot?startapp",
  };
  const files = builtArtifact(t, placeholder);
  let calls = 0;
  await assert.rejects(
    verifyFinancePilotHosted({
      ...files,
      fetchImpl: async () => { calls += 1; },
    }),
    /publicOrigin must be the exact reviewed Cloudflare Pages pilot origin/,
  );
  assert.equal(calls, 0);
});

test("hosted verifier detects a hosted placeholder shell before generic byte drift", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, (response, route) => {
    if (route.file !== "index.html") return response;
    const placeholder = Buffer.alloc(response.chunks[0].length, 0x20);
    placeholder.write("<!doctype html><title>АРХИТЕКТУРА — тестовый контур</title>", "utf8");
    return {
      ...response,
      chunks: [placeholder],
    };
  });
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /the placeholder shell is still hosted/,
  );
});

test("hosted verifier detects a hosted placeholder config", async t => {
  const files = builtArtifact(t);
  const mock = hostedMock(files.artifactDirectory, (response, route) => {
    if (route.file !== "finance-pilot-config.js") return response;
    const placeholder = Buffer.alloc(response.chunks[0].length, 0x20);
    placeholder.write("finance-pilot-bootstrap.invalid", "utf8");
    return {
      ...response,
      chunks: [placeholder],
    };
  });
  await assert.rejects(
    verifyFinancePilotHosted({ ...files, fetchImpl: mock.fetchImpl }),
    /the placeholder config is still hosted/,
  );
});

test("hosted verifier aborts a request at the bounded timeout", async t => {
  const files = builtArtifact(t);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Promise(() => {});
  };
  await assert.rejects(
    verifyFinancePilotHosted({
      ...files,
      fetchImpl,
      requestTimeoutMs: 10,
    }),
    /hosted request failed for index\.html/,
  );
  assert.equal(calls, 1);
});

test("hosted verifier cancels a slow unread body within the per-request deadline", async t => {
  const files = builtArtifact(t);
  const securityHeaders = contractHeaders(files.artifactDirectory);
  const indexBytes = readFileSync(path.join(files.artifactDirectory, "index.html"));
  let requestSignal;
  let cancelCalls = 0;
  let slowWorkActive = true;
  const slowWork = setTimeout(() => {}, 5_000);
  t.after(() => clearTimeout(slowWork));
  const slowBody = bodyStream([indexBytes], {
    read: () => new Promise(() => {}),
    onCancel: () => {
      cancelCalls += 1;
      slowWorkActive = false;
      clearTimeout(slowWork);
    },
  });
  const fetchImpl = async (url, options) => {
    requestSignal = options.signal;
    return {
      status: 200,
      redirected: false,
      url,
      headers: headerBag({
        ...securityHeaders,
        "content-type": "text/html; charset=utf-8",
        "content-length": String(indexBytes.length),
      }),
      body: slowBody,
    };
  };

  const started = Date.now();
  await assert.rejects(
    verifyFinancePilotHosted({
      ...files,
      fetchImpl,
      requestTimeoutMs: 20,
    }),
    /hosted request failed for index\.html/,
  );
  assert.ok(Date.now() - started < 1_000);
  assert.equal(requestSignal.aborted, true);
  assert.equal(cancelCalls, 1);
  assert.equal(slowWorkActive, false);
});

test("hosted verifier CLI redacts input and filesystem failures", t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "finance-pilot-hosted-redaction-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const missingConfig = path.join(directory, "missing-sensitive-config-name.json");
  const missingBoundary = path.join(directory, "missing-sensitive-boundary-name.json");
  const result = spawnSync(process.execPath, [
    path.resolve("scripts/verify-finance-pilot-hosted.mjs"),
    "--artifact", path.join(directory, "missing-sensitive-artifact"),
    "--config", missingConfig,
    "--production-boundary", missingBoundary,
  ], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.includes(directory), false);
  assert.equal(result.stderr.includes("sensitive"), false);
  assert.deepEqual(JSON.parse(result.stderr), {
    ok: false,
    mode: "hosted_read_only",
    error: "verification_refused",
    details_withheld: true,
    hosted_write_performed: false,
  });
});
