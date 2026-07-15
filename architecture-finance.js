/* =====================================================
   v128 — separate operational product entry point
   Telegram initData and one-time codes live in memory only.
   ===================================================== */
(function installArchitectureFinanceV128(root) {
  "use strict";

  if (!root || root.__ARCHITECTURE_FINANCE_V128_INSTALLED__) return;
  root.__ARCHITECTURE_FINANCE_V128_INSTALLED__ = true;

  var VERSION = "v128-architecture-finance-telegram-code-20260714";
  var EXPECTED_PATH = "/functions/v1/finance-issue-code";
  var UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var DISPLAY_CODE = /^\d{4} \d{4}$/;
  var ATTEMPT_MAX_AGE_MS = 55 * 1000;
  var RESPONSE_MAX_BYTES = 8 * 1024;
  // Main Edge has a hard total deadline of at most 25 seconds. The browser
  // waits longer so it never starts an exact retry while the first request is
  // still validly running on the server.
  var REQUEST_TIMEOUT_MS = 30 * 1000;

  var pendingAttempt = null;
  var issuedCode = null;
  var requestSerial = 0;
  var activeController = null;
  var busy = false;
  var notice = null;
  var screenHtml = "";
  var blockedInitData = null;
  var openingWebsite = false;

  function telegramApp() {
    try {
      if (typeof tg !== "undefined" && tg) return tg;
    } catch (error) {}
    return root.tg || null;
  }

  function applicationState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch (error) {}
    return root.state || null;
  }

  function escapeHtml(value) {
    if (typeof root.esc === "function") return root.esc(value);
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character];
    });
  }

  function cardHtml(classes, html) {
    if (typeof root.card === "function") return root.card(classes, html);
    return '<section class="card-v2 ' + escapeHtml(classes || "") + '">' + html + "</section>";
  }

  function integrationConfig() {
    var source = root.ARCHITECTURE_FINANCE_INTEGRATION_CONFIG || {};
    var issueEndpoint = "";
    var financeWebUrl = "";

    try {
      var endpoint = new URL(String(source.issueEndpoint || ""));
      var endpointHost = endpoint.hostname.toLowerCase().replace(/\.$/, "");
      if (
        endpoint.protocol === "https:"
        && !endpoint.username
        && !endpoint.password
        && endpointHost.endsWith(".supabase.co")
        && endpoint.pathname === EXPECTED_PATH
        && !endpoint.search
        && !endpoint.hash
      ) {
        issueEndpoint = endpoint.toString();
      }
    } catch (error) {}

    try {
      var website = new URL(String(source.financeWebUrl || ""));
      if (
        website.protocol === "https:"
        && !website.username
        && !website.password
        && !website.search
        && !website.hash
      ) {
        financeWebUrl = website.toString();
      }
    } catch (error) {}

    return Object.freeze({
      enabled: source.enabled === true,
      issueEndpoint: issueEndpoint,
      financeWebUrl: financeWebUrl,
      ready: source.enabled === true && Boolean(issueEndpoint) && Boolean(financeWebUrl)
    });
  }

  function verifiedTelegramAccess() {
    var access = false;
    try {
      access = typeof root.hasVerifiedAccessV32 === "function"
        ? root.hasVerifiedAccessV32()
        : Boolean(applicationState() && applicationState().access === true);
    } catch (error) {
      access = false;
    }
    var telegram = telegramApp();
    return Boolean(access && telegram && typeof telegram.initData === "string" && telegram.initData);
  }

  function financeMarkerVisible() {
    try {
      return Boolean(document.querySelector("[data-architecture-finance-v128]"));
    } catch (error) {
      return false;
    }
  }

  function cancelActiveRequest() {
    requestSerial += 1;
    if (activeController) {
      try { activeController.abort(); } catch (error) {}
    }
    activeController = null;
    busy = false;
  }

  function clearSensitiveState(blockCurrentLaunch) {
    var telegram = telegramApp();
    if (
      blockCurrentLaunch === true
      && telegram
      && typeof telegram.initData === "string"
      && telegram.initData
    ) {
      blockedInitData = telegram.initData;
    }
    cancelActiveRequest();
    pendingAttempt = null;
    issuedCode = null;
    notice = null;
  }

  function denyAccess() {
    clearSensitiveState(true);
    if (typeof root.accessDenied === "function") {
      root.accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    }
  }

  function validRequestId(value) {
    return typeof value === "string" && UUID_V4.test(value);
  }

  function freshIssuedCode(now) {
    return Boolean(
      issuedCode
      && DISPLAY_CODE.test(issuedCode.code)
      && Number.isFinite(issuedCode.expiresAtMs)
      && issuedCode.expiresAtMs > now
    );
  }

  function formatRemaining(milliseconds) {
    var totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function exactSuccess(value, expectedRequestId, now) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    var expectedKeys = ["code", "expires_at", "ok", "replayed", "request_id"];
    var keys = Object.keys(value).sort();
    if (keys.length !== expectedKeys.length || keys.some(function (key, index) { return key !== expectedKeys[index]; })) {
      return null;
    }
    var expiresAtMs = Date.parse(value.expires_at);
    if (
      value.ok !== true
      || !DISPLAY_CODE.test(value.code)
      || typeof value.replayed !== "boolean"
      || value.request_id !== expectedRequestId
      || !validRequestId(value.request_id)
      || !Number.isFinite(expiresAtMs)
      || expiresAtMs <= now + 1000
      || expiresAtMs > now + 30 * 60 * 1000
    ) {
      return null;
    }
    return Object.freeze({
      code: value.code,
      expiresAt: value.expires_at,
      expiresAtMs: expiresAtMs,
      replayed: value.replayed,
      requestId: value.request_id
    });
  }

  async function readBoundedJson(response) {
    var contentType = String(response.headers && response.headers.get
      ? response.headers.get("content-type") || ""
      : "");
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
      throw new TypeError("response content type rejected");
    }

    var declaredLength = Number(response.headers && response.headers.get
      ? response.headers.get("content-length") || 0
      : 0);
    if (Number.isFinite(declaredLength) && declaredLength > RESPONSE_MAX_BYTES) {
      throw new TypeError("response too large");
    }

    if (response.body && typeof response.body.getReader === "function") {
      var reader = response.body.getReader();
      var chunks = [];
      var total = 0;
      try {
        while (true) {
          var part = await reader.read();
          if (part.done) break;
          total += part.value.byteLength;
          if (total > RESPONSE_MAX_BYTES) throw new TypeError("response too large");
          chunks.push(part.value);
        }
      } finally {
        try { reader.releaseLock(); } catch (error) {}
      }
      var bytes = new Uint8Array(total);
      var offset = 0;
      chunks.forEach(function (chunk) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      });
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }

    var text = await response.text();
    if (new TextEncoder().encode(text).byteLength > RESPONSE_MAX_BYTES) {
      throw new TypeError("response too large");
    }
    return JSON.parse(text);
  }

  function noticeHtml() {
    if (!notice) return "";
    var type = ["success", "warning", "error"].includes(notice.type) ? notice.type : "warning";
    return '<div class="architecture-finance-notice-v128 ' + type + '" role="status" aria-live="polite">'
      + escapeHtml(notice.text)
      + "</div>";
  }

  function codeHtml(now, config) {
    if (!freshIssuedCode(now)) return "";
    var remaining = issuedCode.expiresAtMs - now;
    return '<div class="architecture-finance-code-panel-v128">'
      + '<span>Одноразовый код</span>'
      + '<strong aria-label="Одноразовый код ' + escapeHtml(issuedCode.code) + '">' + escapeHtml(issuedCode.code) + "</strong>"
      + '<p>Действует ещё <b data-finance-code-timer-v128>' + formatRemaining(remaining) + "</b>. Введите его на финансовом сайте.</p>"
      + '<div class="architecture-finance-actions-v128">'
      + '<button class="btn primary" onclick="copyArchitectureFinanceCodeV128()">Скопировать код</button>'
      + (config.financeWebUrl
        ? '<button class="btn secondary" onclick="openArchitectureFinanceWebsiteV128()">Открыть сайт</button>'
        : "")
      + "</div></div>";
  }

  function issueButtonHtml(config, now) {
    if (freshIssuedCode(now)) return "";
    if (!config.ready) {
      return '<button class="btn primary" type="button" disabled>Подключение ещё не включено</button>';
    }
    var telegram = telegramApp();
    if (telegram && telegram.initData === blockedInitData) {
      return '<button class="btn primary" type="button" disabled>Откройте приложение заново</button>';
    }
    return '<button class="btn primary" type="button" onclick="issueArchitectureFinanceCodeV128()" '
      + (busy ? "disabled" : "") + ">"
      + (busy ? "Создаём защищённый код…" : (pendingAttempt ? "Повторить тот же запрос" : "Получить одноразовый код"))
      + "</button>";
  }

  function renderArchitectureFinance() {
    if (!verifiedTelegramAccess()) {
      denyAccess();
      return;
    }

    var config = integrationConfig();
    var now = Date.now();
    if (issuedCode && !freshIssuedCode(now)) {
      issuedCode = null;
      pendingAttempt = null;
      var expiredTelegram = telegramApp();
      if (expiredTelegram && expiredTelegram.initData) blockedInitData = expiredTelegram.initData;
      notice = {
        type: "warning",
        text: "Срок кода закончился. Закройте и заново откройте приложение в Telegram, чтобы получить новый код."
      };
    }

    var readiness = config.ready
      ? "Связь с финансовым сайтом настроена. Код создаётся только после повторной проверки Telegram и права доступа."
      : "Интерфейс подготовлен, но тестовая среда и адрес финансового сайта ещё не включены. До завершения проверки код не выдаётся.";

    var html = '<div data-architecture-finance-v128 data-version="' + VERSION + '">'
      + cardHtml("blue-card-v2 architecture-finance-hero-v128", '<p class="eyebrow">отдельный продукт экосистемы</p><h1>АРХИТЕКТУРА: ФИНАНСЫ</h1><p>Операционный финансовый учёт бизнеса через закрытие дня, отчёты и контроль денег.</p>')
      + cardHtml("architecture-finance-flow-v128", '<h2>Как войти</h2><ol><li>Получите здесь короткоживущий одноразовый код.</li><li>Откройте финансовый сайт — код не добавляется в ссылку.</li><li>Введите восемь цифр и подключите этот браузер.</li></ol><p class="small">' + escapeHtml(readiness) + "</p>")
      + cardHtml("architecture-finance-action-card-v128", noticeHtml() + codeHtml(now, config) + issueButtonHtml(config, now))
      + cardHtml("", '<button class="btn secondary" onclick="closeArchitectureFinanceV128()">На главную</button>')
      + "</div>";

    screenHtml = html;
    if (typeof root.shell === "function") {
      root.shell(html, "home");
    } else {
      var app = document.getElementById("app");
      if (app) app.innerHTML = html;
    }
  }

  function newAttempt(initData) {
    if (!root.crypto || typeof root.crypto.randomUUID !== "function") return null;
    var requestId = String(root.crypto.randomUUID()).toLowerCase();
    if (!validRequestId(requestId)) return null;
    return {
      initData: initData,
      requestId: requestId,
      createdAt: Date.now(),
      calls: 0,
      lastCallAt: 0
    };
  }

  async function issueArchitectureFinanceCode() {
    if (!verifiedTelegramAccess()) {
      denyAccess();
      return;
    }
    if (busy) return;

    var config = integrationConfig();
    if (!config.ready) {
      notice = { type: "warning", text: "Подключение станет доступно после проверки тестовой среды и утверждения адреса сайта." };
      renderArchitectureFinance();
      return;
    }

    var telegram = telegramApp();
    var initData = String(telegram && telegram.initData || "");
    if (initData === blockedInitData) {
      notice = { type: "warning", text: "Для новой выдачи закройте и заново откройте приложение в Telegram." };
      renderArchitectureFinance();
      return;
    }
    if (!initData || initData.length > 8192 || /[\x00-\x1f\x7f]/.test(initData)) {
      pendingAttempt = null;
      notice = { type: "error", text: "Telegram-сессия устарела. Закройте и заново откройте приложение." };
      renderArchitectureFinance();
      return;
    }

    var now = Date.now();
    if (freshIssuedCode(now)) {
      renderArchitectureFinance();
      return;
    }
    var sameAttempt = Boolean(pendingAttempt && pendingAttempt.initData === initData);
    if (
      sameAttempt
      && (now - pendingAttempt.createdAt >= ATTEMPT_MAX_AGE_MS || pendingAttempt.calls >= 4)
    ) {
      blockedInitData = initData;
      pendingAttempt = null;
      notice = { type: "warning", text: "Безопасное окно повтора закончилось. Откройте приложение заново в Telegram." };
      renderArchitectureFinance();
      return;
    }
    var canRetry = Boolean(
      pendingAttempt
      && pendingAttempt.initData === initData
      && now - pendingAttempt.createdAt < ATTEMPT_MAX_AGE_MS
      && pendingAttempt.calls < 4
    );
    if (!canRetry) pendingAttempt = newAttempt(initData);
    if (!pendingAttempt) {
      notice = { type: "error", text: "Браузер не поддерживает безопасное создание кода. Обновите Telegram и повторите." };
      renderArchitectureFinance();
      return;
    }

    if (pendingAttempt.lastCallAt && now - pendingAttempt.lastCallAt < 1100) {
      notice = { type: "warning", text: "Подождите одну секунду и повторите тот же запрос." };
      renderArchitectureFinance();
      return;
    }

    pendingAttempt.calls += 1;
    pendingAttempt.lastCallAt = now;
    var attempt = pendingAttempt;
    var requestBody = JSON.stringify({
      init_data: attempt.initData,
      request_id: attempt.requestId
    });
    if (new TextEncoder().encode(requestBody).byteLength > 12288) {
      pendingAttempt = null;
      notice = { type: "error", text: "Telegram-сессия не принята. Закройте и заново откройте приложение." };
      renderArchitectureFinance();
      return;
    }

    cancelActiveRequest();
    var operation = requestSerial;
    busy = true;
    notice = null;
    activeController = new AbortController();
    var controller = activeController;
    renderArchitectureFinance();

    var timeoutId = root.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
      var response = await root.fetch(config.issueEndpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: requestBody,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });
      if (operation !== requestSerial || !financeMarkerVisible()) return;

      if (response.status === 200) {
        var responseBody = await readBoundedJson(response);
        if (operation !== requestSerial || !financeMarkerVisible()) return;
        var parsed = exactSuccess(responseBody, attempt.requestId, Date.now());
        if (!parsed) throw new TypeError("response schema rejected");
        issuedCode = parsed;
        pendingAttempt = null;
        notice = { type: "success", text: "Код создан. Он одноразовый и хранится только на этом экране." };
      } else if (response.status === 403) {
        pendingAttempt = null;
        blockedInitData = initData;
        notice = { type: "error", text: "Доступ к финансовому продукту пока не назначен или уже отозван." };
      } else if (response.status === 400 || response.status === 409) {
        pendingAttempt = null;
        blockedInitData = initData;
        notice = { type: "error", text: "Telegram-сессия больше не подходит для новой выдачи. Закройте и заново откройте приложение." };
      } else if (response.status === 429) {
        pendingAttempt = null;
        blockedInitData = initData;
        notice = { type: "warning", text: "Защита временно ограничила выдачу. Подождите несколько минут и откройте приложение заново." };
      } else {
        notice = { type: "warning", text: "Сервис временно недоступен. Повторите тот же запрос в течение минуты." };
      }
    } catch (error) {
      if (operation !== requestSerial || !financeMarkerVisible()) return;
      notice = { type: "warning", text: "Не удалось связаться с сервисом. Повторите тот же запрос в течение минуты." };
    } finally {
      root.clearTimeout(timeoutId);
      if (operation === requestSerial) {
        activeController = null;
        busy = false;
        if (financeMarkerVisible()) renderArchitectureFinance();
      }
    }
  }

  async function copyIssuedCode(code, operation) {
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === "function") {
        await root.navigator.clipboard.writeText(code);
      } else {
        var input = document.createElement("textarea");
        try {
          input.value = code;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();
          if (!document.execCommand("copy")) throw new Error("copy rejected");
        } finally {
          // Never leave the one-time code in a temporary node outside #app,
          // including when execCommand returns false or throws.
          try { input.value = ""; } catch (error) {}
          try { input.remove(); } catch (error) {}
          try {
            if (input.parentNode) input.parentNode.removeChild(input);
          } catch (cleanupError) {}
        }
      }
      if (
        operation !== requestSerial
        || !financeMarkerVisible()
        || !issuedCode
        || issuedCode.code !== code
      ) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  async function copyArchitectureFinanceCode() {
    if (!verifiedTelegramAccess() || !freshIssuedCode(Date.now())) {
      clearSensitiveState(true);
      renderArchitectureFinance();
      return false;
    }
    var code = issuedCode.code;
    var operation = requestSerial;
    if (await copyIssuedCode(code, operation)) {
      notice = { type: "success", text: "Код скопирован. Теперь откройте финансовый сайт и введите восемь цифр." };
      renderArchitectureFinance();
      return true;
    }
    if (operation === requestSerial && financeMarkerVisible() && issuedCode && issuedCode.code === code) {
      notice = { type: "warning", text: "Не удалось скопировать автоматически. Введите показанные восемь цифр вручную." };
      renderArchitectureFinance();
    }
    return false;
  }

  async function openArchitectureFinanceWebsite() {
    if (openingWebsite) return false;
    openingWebsite = true;
    try {
      var config = integrationConfig();
      if (!verifiedTelegramAccess() || !freshIssuedCode(Date.now())) {
        clearSensitiveState(true);
        renderArchitectureFinance();
        return false;
      }
      if (!config.financeWebUrl) {
        notice = { type: "warning", text: "Адрес финансового сайта ещё не настроен. Код сохранён на этом экране." };
        renderArchitectureFinance();
        return false;
      }

      var code = issuedCode.code;
      var operation = requestSerial;
      if (!(await copyIssuedCode(code, operation))) {
        if (operation === requestSerial && financeMarkerVisible() && issuedCode && issuedCode.code === code) {
          notice = {
            type: "warning",
            text: "Сайт пока не открыт: не удалось скопировать код. Нажмите «Скопировать код» и разрешите копирование, затем повторите."
          };
          renderArchitectureFinance();
        }
        return false;
      }

      var currentConfig = integrationConfig();
      if (
        operation !== requestSerial
        || !financeMarkerVisible()
        || !issuedCode
        || issuedCode.code !== code
        || currentConfig.financeWebUrl !== config.financeWebUrl
      ) return false;

      var telegram = telegramApp();
      var openedSuccessfully = false;
      try {
        if (telegram && typeof telegram.openLink === "function") {
          telegram.openLink(config.financeWebUrl);
          openedSuccessfully = true;
        } else if (typeof root.open === "function") {
          var opened = root.open(config.financeWebUrl, "_blank", "noopener,noreferrer");
          if (opened) {
            opened.opener = null;
            openedSuccessfully = true;
          }
        }
      } catch (error) {
        openedSuccessfully = false;
      }
      if (!openedSuccessfully) {
        if (operation === requestSerial && financeMarkerVisible() && issuedCode && issuedCode.code === code) {
          notice = { type: "warning", text: "Код скопирован, но сайт не открылся. Нажмите «Открыть сайт» ещё раз." };
          renderArchitectureFinance();
        }
        return false;
      }

      clearSensitiveState(true);
      screenHtml = "";
      if (typeof root.renderHome === "function") root.renderHome();
      return true;
    } finally {
      openingWebsite = false;
    }
  }

  function closeArchitectureFinance() {
    clearSensitiveState(Boolean(issuedCode || pendingAttempt || busy));
    screenHtml = "";
    if (typeof root.renderHome === "function") root.renderHome();
  }

  function installHomeCard() {
    var previous = root.secondaryBlocksHtmlV40;
    if (typeof previous !== "function" || previous.__architectureFinanceV128) return;

    var wrapped = function () {
      var html = String(previous.apply(this, arguments) || "");
      var config = integrationConfig();
      var status = config.ready ? "доступно" : "подключение";
      var className = "active compact-card architecture-finance-entry-v128";
      var card = typeof root.renderMainBlockCard === "function"
        ? root.renderMainBlockCard(
          "АРХИТЕКТУРА: ФИНАНСЫ",
          "Операционный финансовый учёт: закрытие дня, отчёты и контроль денег.",
          status,
          "renderArchitectureFinanceV128()",
          className
        )
        : '<button class="main-block-card ' + className + '" onclick="renderArchitectureFinanceV128()"><b>АРХИТЕКТУРА: ФИНАНСЫ</b><p>Операционный финансовый учёт бизнеса.</p></button>';
      var closing = html.lastIndexOf("</div>");
      return closing >= 0 ? html.slice(0, closing) + card + html.slice(closing) : html + card;
    };
    wrapped.__architectureFinanceV128 = true;
    root.secondaryBlocksHtmlV40 = wrapped;
  }

  root.renderArchitectureFinanceV128 = renderArchitectureFinance;
  root.issueArchitectureFinanceCodeV128 = issueArchitectureFinanceCode;
  root.copyArchitectureFinanceCodeV128 = copyArchitectureFinanceCode;
  root.openArchitectureFinanceWebsiteV128 = openArchitectureFinanceWebsite;
  root.closeArchitectureFinanceV128 = closeArchitectureFinance;
  root.ARCHITECTURE_FINANCE_UI_VERSION = VERSION;
  installHomeCard();

  if (typeof document === "object" && document) {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        var hadSensitiveState = Boolean(issuedCode || pendingAttempt || busy);
        clearSensitiveState(hadSensitiveState);
        if (hadSensitiveState && financeMarkerVisible()) {
          screenHtml = "";
          if (typeof root.renderHome === "function") root.renderHome();
          else {
            var rootNode = document.getElementById("app");
            if (rootNode) rootNode.innerHTML = "";
          }
        }
      }
    });

    var app = document.getElementById("app");
    if (app && typeof root.MutationObserver === "function") {
      new root.MutationObserver(function () {
        if ((issuedCode || pendingAttempt || busy) && !financeMarkerVisible()) {
          clearSensitiveState(true);
          screenHtml = "";
        }
      }).observe(app, { childList: true, subtree: true });
    }
  }

  if (typeof root.setInterval === "function") {
    var timer = root.setInterval(function () {
      if (!issuedCode || !financeMarkerVisible()) return;
      var now = Date.now();
      if (!freshIssuedCode(now)) {
        var expiredTelegram = telegramApp();
        if (expiredTelegram && expiredTelegram.initData) blockedInitData = expiredTelegram.initData;
        issuedCode = null;
        pendingAttempt = null;
        notice = { type: "warning", text: "Срок кода закончился. Откройте приложение заново в Telegram." };
        renderArchitectureFinance();
        return;
      }
      try {
        var node = document.querySelector("[data-finance-code-timer-v128]");
        if (node) node.textContent = formatRemaining(issuedCode.expiresAtMs - now);
      } catch (error) {}
    }, 1000);
    if (timer && typeof timer.unref === "function") timer.unref();
  }
})(typeof window === "object" ? window : globalThis);
