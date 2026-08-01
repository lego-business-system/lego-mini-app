(function installFinancePilotShell(root) {
  "use strict";

  if (!root || root.__ARCHITECTURE_FINANCE_PILOT_SHELL__) return;
  root.__ARCHITECTURE_FINANCE_PILOT_SHELL__ = true;

  var ISSUE_PATH = "/functions/v1/finance-issue-code";
  var ready = false;
  var telegram = null;
  var pilotConfig = null;

  function exactObject(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    var actual = Object.keys(value);
    return actual.length === keys.length
      && keys.every(function (key) { return Object.prototype.hasOwnProperty.call(value, key); })
      && actual.every(function (key) { return keys.includes(key); });
  }

  function exactOrigin(value) {
    if (typeof value !== "string" || value !== value.trim() || value.includes("*")) return "";
    try {
      var parsed = new URL(value);
      if (
        parsed.protocol !== "https:"
        || parsed.username
        || parsed.password
        || parsed.hostname.endsWith(".")
        || parsed.pathname !== "/"
        || parsed.search
        || parsed.hash
        || parsed.origin !== value
      ) return "";
      return parsed.origin;
    } catch (error) {
      return "";
    }
  }

  function validateConfig() {
    var source = root.ARCHITECTURE_FINANCE_PILOT_CONFIG;
    if (!exactObject(source, [
      "schemaVersion",
      "environment",
      "publicOrigin",
      "mainEdgeOrigin",
      "financeWebOrigin",
      "telegramMiniAppUrl",
      "features"
    ])) return null;
    if (!exactObject(source.features, ["issueCode"])) return null;
    if (source.schemaVersion !== 1 || source.environment !== "staging" || source.features.issueCode !== true) {
      return null;
    }
    var publicOrigin = exactOrigin(source.publicOrigin);
    var mainEdgeOrigin = exactOrigin(source.mainEdgeOrigin);
    var financeWebOrigin = exactOrigin(source.financeWebOrigin);
    if (!publicOrigin || !mainEdgeOrigin || !financeWebOrigin) return null;
    if (new Set([publicOrigin, mainEdgeOrigin, financeWebOrigin]).size !== 3) return null;
    if (!new URL(mainEdgeOrigin).hostname.endsWith(".supabase.co")) return null;
    if (!root.location || root.location.origin !== publicOrigin) return null;
    if (!/^https:\/\/t\.me\/[a-z][a-z0-9_]{1,28}bot\?startapp$/u.test(source.telegramMiniAppUrl)) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(root, "ARCHITECTURE_FINANCE_INTEGRATION_CONFIG")) {
      return null;
    }
    return Object.freeze({
      issueEndpoint: mainEdgeOrigin + ISSUE_PATH,
      financeWebUrl: financeWebOrigin + "/"
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character];
    });
  }

  function shell(html) {
    var app = document.getElementById("app");
    if (app) app.innerHTML = '<div class="pilot-stack">' + String(html || "") + "</div>";
  }

  function card(classes, html) {
    return '<section class="card-v2 ' + escapeHtml(classes || "") + '">' + String(html || "") + "</section>";
  }

  function deniedHtml() {
    return '<div class="pilot-denied"><section class="card-v2"><p class="eyebrow">доступ закрыт</p>'
      + "<h1>Откройте пилот из Telegram</h1>"
      + "<p>Эта страница выдаёт код только внутри утверждённого тестового Telegram Mini App.</p>"
      + "</section></div>";
  }

  function hasVerifiedAccess() {
    return Boolean(
      ready
      && telegram
      && typeof telegram.initData === "string"
      && telegram.initData.length > 0
      && telegram.initData.length <= 8192
    );
  }

  function accessDenied() {
    ready = false;
    if (root.state) root.state.access = false;
    var app = document.getElementById("app");
    if (app) app.innerHTML = deniedHtml();
  }

  function renderHome() {
    if (!hasVerifiedAccess()) {
      accessDenied();
      return;
    }
    shell(card("", '<p class="eyebrow">пилотный контур</p><h1>АРХИТЕКТУРА: ФИНАНСЫ</h1>'
      + "<p>Одноразовый код создаётся только после серверной проверки Telegram и назначенного доступа.</p>"
      + '<button class="btn primary" type="button" data-finance-pilot-open>Получить код</button>'));
  }

  function bootstrap() {
    pilotConfig = validateConfig();
    telegram = root.Telegram && root.Telegram.WebApp ? root.Telegram.WebApp : null;
    root.tg = telegram;
    root.state = { access: false };
    root.esc = escapeHtml;
    root.card = card;
    root.shell = shell;
    root.accessDenied = accessDenied;
    root.renderHome = renderHome;
    root.hasVerifiedAccessV32 = hasVerifiedAccess;
    root.secondaryBlocksHtmlV40 = function () { return '<div class="pilot-stack"></div>'; };
    root.renderMainBlockCard = function (title, text) {
      return card("", "<h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(text) + "</p>");
    };

    if (!pilotConfig || !telegram || typeof telegram.initData !== "string" || !telegram.initData) {
      accessDenied();
      return;
    }
    Object.defineProperty(root, "ARCHITECTURE_FINANCE_INTEGRATION_CONFIG", {
      value: Object.freeze({
        enabled: true,
        issueEndpoint: pilotConfig.issueEndpoint,
        financeWebUrl: pilotConfig.financeWebUrl
      }),
      configurable: false,
      enumerable: false,
      writable: false
    });
    ready = true;
    root.state.access = true;
    try { telegram.ready(); } catch (error) {}
    try { telegram.expand(); } catch (error) {}
    if (typeof root.renderArchitectureFinanceV128 === "function") {
      root.renderArchitectureFinanceV128();
    } else {
      accessDenied();
    }
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest("[data-finance-pilot-open]")
      : null;
    if (target && typeof root.renderArchitectureFinanceV128 === "function" && hasVerifiedAccess()) {
      root.renderArchitectureFinanceV128();
    }
  });
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
})(typeof window === "object" ? window : globalThis);
