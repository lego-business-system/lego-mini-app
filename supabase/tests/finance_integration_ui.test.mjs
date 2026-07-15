import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync("architecture-finance.js", "utf8");
const REQUEST_ID = "018f1f3a-7b6a-4a7d-87e0-4fe2d24739c3";
const ENDPOINT = "https://staging-main.supabase.co/functions/v1/finance-issue-code";
const WEBSITE = "https://finance.example.test/";
const INIT_DATA = "query_id=test&user=%7B%22id%22%3A123456789%7D&auth_date=1784040000&hash=" + "a".repeat(64);

function response(status, body, contentType = "application/json") {
  const text = JSON.stringify(body);
  return {
    status,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === "content-type") return contentType;
        if (String(name).toLowerCase() === "content-length") return String(new TextEncoder().encode(text).byteLength);
        return null;
      },
    },
    text: async () => text,
  };
}

function harness(fetchImplementation, {
  lexicalTelegram = false,
  clipboardAvailable = true,
  clipboardWrite = null,
  execCommand = null,
  telegramLinkAvailable = true,
  telegramOpenLink = null,
  browserOpen = null,
} = {}) {
  let now = 1_784_040_000_000;
  let markerVisible = false;
  let rendered = "";
  let visibilityHandler = null;
  let timerSequence = 0;
  const timers = new Map();
  const app = { innerHTML: "" };
  const clipboard = [];
  const clipboardAttempts = [];
  const openedUrls = [];
  const navigationAttempts = [];
  const events = [];
  const createdElements = [];
  const bodyChildren = [];

  class FakeDate extends Date {
    constructor(value) {
      super(value === undefined ? now : value);
    }
    static now() { return now; }
    static parse(value) { return Date.parse(value); }
  }

  const body = {
    appendChild(node) {
      if (!bodyChildren.includes(node)) bodyChildren.push(node);
      node.parentNode = body;
      return node;
    },
    removeChild(node) {
      const index = bodyChildren.indexOf(node);
      if (index >= 0) bodyChildren.splice(index, 1);
      node.parentNode = null;
      return node;
    },
  };

  const document = {
    hidden: false,
    body,
    addEventListener(name, handler) {
      if (name === "visibilitychange") visibilityHandler = handler;
    },
    getElementById(id) { return id === "app" ? app : null; },
    querySelector(selector) {
      if (selector === "[data-architecture-finance-v128]") return markerVisible ? {} : null;
      if (selector === "[data-finance-code-timer-v128]") return null;
      return null;
    },
    createElement(tagName) {
      const node = {
        tagName: String(tagName).toUpperCase(),
        parentNode: null,
        style: {},
        setAttribute() {},
        select() {},
        remove() {
          if (this.parentNode) this.parentNode.removeChild(this);
        },
        value: "",
      };
      createdElements.push(node);
      return node;
    },
    execCommand(command) {
      events.push(`execCommand:${command}`);
      return execCommand ? execCommand(command) : true;
    },
  };

  class MutationObserver {
    constructor(handler) { this.handler = handler; }
    observe() {}
  }

  function fakeSetTimeout(callback, delay) {
    const id = ++timerSequence;
    timers.set(id, { callback, at: now + Number(delay || 0) });
    return id;
  }

  function fakeClearTimeout(id) {
    timers.delete(id);
  }

  function advance(milliseconds) {
    now += milliseconds;
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= now)
      .sort((left, right) => left[1].at - right[1].at);
    for (const [id, timer] of due) {
      if (!timers.delete(id)) continue;
      timer.callback();
    }
  }

  const navigator = clipboardAvailable
    ? {
      clipboard: {
        async writeText(value) {
          const exactValue = String(value);
          clipboardAttempts.push(exactValue);
          events.push(`clipboard-attempt:${exactValue}`);
          try {
            if (clipboardWrite) await clipboardWrite(exactValue);
            clipboard.push(exactValue);
            events.push(`clipboard-success:${exactValue}`);
          } catch (error) {
            events.push(`clipboard-failure:${exactValue}`);
            throw error;
          }
        },
      },
    }
    : {};

  const context = {
    AbortController,
    Date: FakeDate,
    MutationObserver,
    TextDecoder,
    TextEncoder,
    URL,
    clearTimeout: fakeClearTimeout,
    console,
    crypto: { randomUUID: () => REQUEST_ID },
    document,
    fetch: fetchImplementation,
    navigator,
    open(url, target, features) {
      const exactUrl = String(url);
      navigationAttempts.push(exactUrl);
      events.push(`window-open-attempt:${exactUrl}`);
      try {
        const opened = browserOpen
          ? browserOpen(exactUrl, target, features)
          : { opener: {} };
        if (opened) {
          openedUrls.push(exactUrl);
          events.push(`window-open-success:${exactUrl}`);
        } else {
          events.push(`window-open-failure:${exactUrl}`);
        }
        return opened;
      } catch (error) {
        events.push(`window-open-failure:${exactUrl}`);
        throw error;
      }
    },
    setInterval: () => ({ unref() {} }),
    setTimeout: fakeSetTimeout,
    ARCHITECTURE_FINANCE_INTEGRATION_CONFIG: Object.freeze({
      enabled: true,
      issueEndpoint: ENDPOINT,
      financeWebUrl: WEBSITE,
    }),
    accessDenied(reason) { throw new Error(`unexpected access denial: ${reason}`); },
    card(classes, html) { return `<section class="${classes}">${html}</section>`; },
    hasVerifiedAccessV32() { return true; },
    renderHome() {
      events.push("render-home");
      markerVisible = false;
      rendered = "home";
    },
    renderMainBlockCard(title, text, status, action, classes) {
      return `<button class="${classes}" data-status="${status}" onclick="${action}"><b>${title}</b><p>${text}</p></button>`;
    },
    secondaryBlocksHtmlV40() { return '<div class="blocks"><span>existing</span></div>'; },
    shell(html) {
      rendered = String(html);
      app.innerHTML = rendered;
      markerVisible = rendered.includes("data-architecture-finance-v128");
    },
  };
  if (!lexicalTelegram) {
    context.state = { access: true };
    context.tg = {
      initData: INIT_DATA,
    };
    if (telegramLinkAvailable) {
      context.tg.openLink = function (url) {
        const exactUrl = String(url);
        navigationAttempts.push(exactUrl);
        events.push(`telegram-open-attempt:${exactUrl}`);
        try {
          if (telegramOpenLink) telegramOpenLink(exactUrl);
          openedUrls.push(exactUrl);
          events.push(`telegram-open-success:${exactUrl}`);
        } catch (error) {
          events.push(`telegram-open-failure:${exactUrl}`);
          throw error;
        }
      };
    }
  }
  context.window = context;
  context.globalThis = context;
  const sandbox = vm.createContext(context);
  if (lexicalTelegram) {
    vm.runInContext(
      `const state = { access: true }; const tg = { initData: ${JSON.stringify(INIT_DATA)}, openLink() {} };`,
      sandbox,
      { filename: "app-globals.js" },
    );
  }
  vm.runInContext(source, sandbox, { filename: "architecture-finance.js" });

  return {
    context,
    clipboard,
    clipboardAttempts,
    openedUrls,
    navigationAttempts,
    events,
    createdElements,
    bodyChildren,
    rendered: () => rendered,
    advance,
    hide() {
      document.hidden = true;
      visibilityHandler?.();
    },
  };
}

test("home card remains a separate operational product entry", () => {
  const runtime = harness(async () => { throw new Error("unused"); });
  const html = runtime.context.secondaryBlocksHtmlV40();
  assert.match(html, /existing/);
  assert.match(html, /АРХИТЕКТУРА: ФИНАНСЫ/);
  assert.match(html, /renderArchitectureFinanceV128\(\)/);
  assert.doesNotMatch(html, /Финансовый помощник.*АРХИТЕКТУРА: ФИНАНСЫ/);
});

test("separate classic script reads app.js top-level const Telegram binding", () => {
  const runtime = harness(async () => { throw new Error("unused"); }, { lexicalTelegram: true });
  assert.equal(runtime.context.tg, undefined, "top-level const must not be a window property in this test");
  runtime.context.renderArchitectureFinanceV128();
  assert.match(runtime.rendered(), /АРХИТЕКТУРА: ФИНАНСЫ/);
  assert.doesNotMatch(runtime.rendered(), /unexpected access denial/);
});

test("browser sends exact canonical bytes without identity, cookies or Authorization", async () => {
  const calls = [];
  const runtime = harness(async (url, options) => {
    calls.push({ url, options });
    return response(200, {
      ok: true,
      code: "4829 1376",
      expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
      replayed: false,
      request_id: REQUEST_ID,
    });
  });

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(
    calls[0].options.body,
    JSON.stringify({ init_data: INIT_DATA, request_id: REQUEST_ID }),
  );
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)), ["init_data", "request_id"]);
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.referrerPolicy, "no-referrer");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers.Cookie, undefined);
  assert.match(runtime.rendered(), /4829 1376/);
  assert.match(runtime.rendered(), /Код создан/);

  await runtime.context.copyArchitectureFinanceCodeV128();
  assert.deepEqual(runtime.clipboard, ["4829 1376"]);
});

test("open website copies the exact displayed code before exact navigation and then clears it", async () => {
  let runtime;
  runtime = harness(
    async () => response(200, {
      ok: true,
      code: "4829 1376",
      expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
      replayed: false,
      request_id: REQUEST_ID,
    }),
    {
      telegramOpenLink(url) {
        assert.equal(url, WEBSITE);
        assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/, "code must still exist when navigation starts");
      },
    },
  );

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/);

  assert.equal(await runtime.context.openArchitectureFinanceWebsiteV128(), true);
  assert.deepEqual(runtime.clipboard, ["4829 1376"]);
  assert.deepEqual(runtime.openedUrls, [WEBSITE]);
  assert.equal(runtime.rendered(), "home");
  assert.ok(
    runtime.events.indexOf("clipboard-success:4829 1376") <
      runtime.events.indexOf(`telegram-open-attempt:${WEBSITE}`),
    "copy must finish before navigation",
  );
  assert.ok(
    runtime.events.indexOf(`telegram-open-success:${WEBSITE}`) <
      runtime.events.indexOf("render-home"),
    "successful navigation must precede sensitive-screen teardown",
  );

  runtime.context.renderArchitectureFinanceV128();
  assert.doesNotMatch(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/);
  assert.match(runtime.rendered(), /Откройте приложение заново/);
});

test("clipboard failure keeps the displayed code and prevents URL navigation or clear", async () => {
  const runtime = harness(
    async () => response(200, {
      ok: true,
      code: "4829 1376",
      expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
      replayed: false,
      request_id: REQUEST_ID,
    }),
    { clipboardWrite: async () => { throw new Error("clipboard denied"); } },
  );

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();

  assert.equal(await runtime.context.openArchitectureFinanceWebsiteV128(), false);
  assert.deepEqual(runtime.clipboard, []);
  assert.deepEqual(runtime.openedUrls, []);
  assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/);
  assert.match(runtime.rendered(), /Сайт пока не открыт/);
  assert.match(runtime.rendered(), /Нажмите «Скопировать код»/);
});

test("fallback textarea is blank and detached when execCommand returns false or throws", async t => {
  const cases = [
    ["false", () => false],
    ["throw", () => { throw new Error("legacy clipboard rejected"); }],
  ];

  for (const [label, execCommand] of cases) {
    await t.test(label, async () => {
      const runtime = harness(
        async () => response(200, {
          ok: true,
          code: "4829 1376",
          expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
          replayed: false,
          request_id: REQUEST_ID,
        }),
        { clipboardAvailable: false, execCommand },
      );

      runtime.context.renderArchitectureFinanceV128();
      await runtime.context.issueArchitectureFinanceCodeV128();
      assert.equal(await runtime.context.openArchitectureFinanceWebsiteV128(), false);

      assert.deepEqual(runtime.navigationAttempts, []);
      assert.equal(runtime.bodyChildren.length, 0, "temporary textarea must leave document.body");
      const textareas = runtime.createdElements.filter(node => node.tagName === "TEXTAREA");
      assert.equal(textareas.length, 1);
      assert.equal(textareas[0].value, "", "detached textarea must not retain the code");
      assert.equal(textareas[0].parentNode, null);
      assert.ok(runtime.createdElements.every(node => node.value !== "4829 1376"));
      assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/, "displayed code must survive copy failure");
      assert.doesNotMatch(runtime.events.join("\n"), /render-home/);
    });
  }
});

test("navigation failures preserve the copied displayed code and never clear the screen", async t => {
  const cases = [
    [
      "Telegram openLink throws",
      { telegramOpenLink: () => { throw new Error("Telegram navigation rejected"); } },
      "telegram-open-attempt",
    ],
    [
      "window.open returns null",
      { telegramLinkAvailable: false, browserOpen: () => null },
      "window-open-attempt",
    ],
    [
      "window.open throws",
      { telegramLinkAvailable: false, browserOpen: () => { throw new Error("popup rejected"); } },
      "window-open-attempt",
    ],
  ];

  for (const [label, options, attemptEvent] of cases) {
    await t.test(label, async () => {
      const runtime = harness(async () => response(200, {
        ok: true,
        code: "4829 1376",
        expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
        replayed: false,
        request_id: REQUEST_ID,
      }), options);

      runtime.context.renderArchitectureFinanceV128();
      await runtime.context.issueArchitectureFinanceCodeV128();
      assert.equal(await runtime.context.openArchitectureFinanceWebsiteV128(), false);

      assert.deepEqual(runtime.clipboard, ["4829 1376"]);
      assert.deepEqual(runtime.navigationAttempts, [WEBSITE]);
      assert.deepEqual(runtime.openedUrls, []);
      assert.match(runtime.events.join("\n"), new RegExp(`${attemptEvent}:${WEBSITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.doesNotMatch(runtime.events.join("\n"), /render-home/);
      assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/);
      assert.match(runtime.rendered(), /Код скопирован, но сайт не открылся/);
      assert.equal(runtime.bodyChildren.length, 0);
    });
  }
});

test("double concurrent open click performs one copy, one navigation and one clear", async () => {
  let releaseClipboard;
  let clipboardStarted;
  const started = new Promise(resolve => { clipboardStarted = resolve; });
  let runtime;
  runtime = harness(
    async () => response(200, {
      ok: true,
      code: "4829 1376",
      expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
      replayed: false,
      request_id: REQUEST_ID,
    }),
    {
      clipboardWrite: () => new Promise(resolve => {
        releaseClipboard = resolve;
        clipboardStarted();
      }),
      telegramOpenLink() {
        assert.match(runtime.rendered(), /<strong[^>]*>4829 1376<\/strong>/);
      },
    },
  );

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  const firstClick = runtime.context.openArchitectureFinanceWebsiteV128();
  await started;
  const secondClick = runtime.context.openArchitectureFinanceWebsiteV128();
  assert.equal(await secondClick, false);
  assert.deepEqual(runtime.clipboardAttempts, ["4829 1376"]);
  assert.deepEqual(runtime.navigationAttempts, []);

  releaseClipboard();
  assert.equal(await firstClick, true);
  assert.deepEqual(runtime.clipboard, ["4829 1376"]);
  assert.deepEqual(runtime.navigationAttempts, [WEBSITE]);
  assert.deepEqual(runtime.openedUrls, [WEBSITE]);
  assert.equal(runtime.events.filter(event => event === "render-home").length, 1);
  assert.equal(runtime.rendered(), "home");
  assert.equal(runtime.bodyChildren.length, 0);
});

test("transient retry reuses identical request bytes and respects DB retry pause", async () => {
  const calls = [];
  const runtime = harness(async (url, options) => {
    calls.push({ url, body: options.body });
    if (calls.length === 1) throw new TypeError("network unavailable");
    return response(200, {
      ok: true,
      code: "4829 1376",
      expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
      replayed: true,
      request_id: REQUEST_ID,
    });
  });

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  assert.equal(calls.length, 1, "client must not retry inside the one-second DB guard");

  runtime.advance(1_101);
  await runtime.context.issueArchitectureFinanceCodeV128();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body);
  assert.match(runtime.rendered(), /4829 1376/);
});

test("client waits beyond the reviewed server deadline and accepts a 30-minute TTL contract", async () => {
  let releaseFetch;
  let browserSignal;
  const runtime = harness(async (url, options) => {
    browserSignal = options.signal;
    return new Promise(resolve => { releaseFetch = resolve; });
  });

  runtime.context.renderArchitectureFinanceV128();
  const pending = runtime.context.issueArchitectureFinanceCodeV128();
  runtime.advance(24_500);
  assert.equal(browserSignal.aborted, false, "browser must still wait after the Edge 24-second default deadline");
  releaseFetch(response(200, {
    ok: true,
    code: "4829 1376",
    expires_at: new Date(1_784_040_000_000 + 30 * 60_000).toISOString(),
    replayed: false,
    request_id: REQUEST_ID,
  }));
  await pending;

  assert.match(runtime.rendered(), /4829 1376/);
});

test("invalid success schema fails closed and navigation clears the code", async () => {
  const runtime = harness(async () => response(200, {
    ok: true,
    code: "48291376",
    expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
    replayed: false,
    request_id: REQUEST_ID,
  }));

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  assert.doesNotMatch(runtime.rendered(), /<strong[^>]*>48291376<\/strong>/);
  assert.match(runtime.rendered(), /Повторите тот же запрос/);

  runtime.advance(1_101);
  runtime.hide();
  runtime.context.renderArchitectureFinanceV128();
  assert.doesNotMatch(runtime.rendered(), /Одноразовый код/);
});

test("rate limit blocks a new UUID for the same Telegram launch", async () => {
  let calls = 0;
  const runtime = harness(async () => {
    calls += 1;
    return response(429, { ok: false, error: "request_rejected" });
  });

  runtime.context.renderArchitectureFinanceV128();
  await runtime.context.issueArchitectureFinanceCodeV128();
  runtime.advance(2_000);
  await runtime.context.issueArchitectureFinanceCodeV128();
  assert.equal(calls, 1);
  assert.match(runtime.rendered(), /Откройте приложение заново/);
});

test("leaving during streamed response cannot restore a code off-screen", async () => {
  let releaseBody;
  let bodyReadStarted;
  const started = new Promise(resolve => { bodyReadStarted = resolve; });
  const successBody = JSON.stringify({
    ok: true,
    code: "4829 1376",
    expires_at: new Date(1_784_040_000_000 + 300_000).toISOString(),
    replayed: false,
    request_id: REQUEST_ID,
  });
  const runtime = harness(async () => ({
    status: 200,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === "content-type") return "application/json";
        return null;
      },
    },
    text() {
      bodyReadStarted();
      return new Promise(resolve => { releaseBody = resolve; });
    },
  }));

  runtime.context.renderArchitectureFinanceV128();
  const pending = runtime.context.issueArchitectureFinanceCodeV128();
  await started;
  runtime.hide();
  releaseBody(successBody);
  await pending;

  assert.equal(runtime.rendered(), "home");
  runtime.context.renderArchitectureFinanceV128();
  assert.doesNotMatch(runtime.rendered(), /4829 1376/);
  assert.match(runtime.rendered(), /Откройте приложение заново/);
});
