/* =====================================================
   v140 — Отправка Google-таблиц на email (пилот)
   Изолированный модуль: не изменяет app.js, прогресс, роли и уроки.
   ===================================================== */
(function installTableEmailPilotV140(){
  "use strict";

  var TABLE_EMAIL_VERSION_V140 = "v140-table-email-pilot-20260726";
  var TABLE_EMAIL_API_URL_V140 = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/send-table-email";
  var TABLE_EMAIL_SELECTOR_V140 = "#app a[href], #app button[onclick]";
  var TABLE_EMAIL_PROFILE_V140 = {
    loaded: false,
    hasEmail: false,
    maskedEmail: ""
  };
  var TABLE_EMAIL_SCAN_QUEUED_V140 = false;
  var TABLE_EMAIL_ACTIVE_MODAL_V140 = null;

  var TABLE_EMAIL_FALLBACKS_V140 = {
    breakEven: "https://docs.google.com/spreadsheets/d/1z3rPU1YJhmfaGKZcXnKh4cEepwdmOP19/edit?gid=1853890209#gid=1853890209",
    businessEquation: "https://docs.google.com/spreadsheets/d/14NophgCw5e8DhOFR3RzhQgqGg6yYZ1KZ/edit?gid=1795302417#gid=1795302417",
    creditFilter: "https://docs.google.com/spreadsheets/d/147crKpP0dPVokcFRKUUBlKuw75MI0s7w2vkj17Mp1GM/edit?gid=318365903#gid=318365903",
    creditFilterExample: "https://docs.google.com/spreadsheets/d/1NRnmZXsivF1sTV6txwnqFZD6_X8Xpyg5fYxwjoduHT8/edit?gid=528600782#gid=528600782",
    unitEconomics: "https://docs.google.com/spreadsheets/d/1RqBn7hoDoFPVeL0cIJLkgy6i1i-4iPnzG0Lnpr26-Hw/edit?gid=751234597#gid=751234597",
    cashGapRadar: "https://docs.google.com/spreadsheets/d/1bc_VJ-2w5ht6Zzx9TePY10maK_Z6RQoWcO7ZfD8OVio/edit?gid=2115478736#gid=2115478736",
    managementPnl: "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=1270260255#gid=1270260255",
    managementPnlInstruction: "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=385874795#gid=385874795",
    managementPnlExample: "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=836036698#gid=836036698"
  };

  function tableEmailEscV140(value){
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function(char){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char];
    });
  }

  function tableEmailNormalizeTextV140(value){
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .replace(/^Открыть\s+/i, "")
      .trim()
      .slice(0, 120);
  }

  function tableEmailIsGoogleSheetV140(value){
    try {
      var url = new URL(String(value || ""), document.baseURI);
      return url.protocol === "https:" &&
        url.hostname === "docs.google.com" &&
        /^\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}(?:\/|$)/.test(url.pathname);
    } catch(e) {
      return false;
    }
  }

  function tableEmailCurrentLessonTitleV140(){
    try {
      if (typeof state !== "undefined" && state && state.selectedLessonCode && typeof getLessonMeta === "function") {
        var meta = getLessonMeta(state.selectedLessonCode);
        if (meta && meta.title) return tableEmailNormalizeTextV140(meta.title);
      }
    } catch(e) {}
    return "";
  }

  function tableEmailNearestHeadingV140(node){
    var current = node;
    for (var i = 0; current && i < 5; i += 1) {
      if (current.querySelector) {
        var heading = current.querySelector("h1, h2, h3");
        if (heading && heading !== node) {
          var value = tableEmailNormalizeTextV140(heading.textContent || "");
          if (value) return value;
        }
      }
      current = current.parentElement;
    }
    return "";
  }

  function tableEmailTitleForNodeV140(node, fallback){
    var buttonText = tableEmailNormalizeTextV140(node && node.textContent || "");
    var lessonTitle = tableEmailCurrentLessonTitleV140();
    var heading = tableEmailNearestHeadingV140(node);
    var title = tableEmailNormalizeTextV140(fallback || buttonText || heading || lessonTitle || "Практическая таблица");

    if (/^(рабочий шаблон|основная таблица дз|таблица|пример заполнения)$/i.test(title) && lessonTitle) {
      title += " — " + lessonTitle;
    }
    return title || "Практическая таблица";
  }

  function tableEmailRegistryValueV140(registryName, key, fallback){
    try {
      var registry = window[registryName];
      if (registry && registry[key] && tableEmailIsGoogleSheetV140(registry[key])) return registry[key];
    } catch(e) {}
    return fallback;
  }

  function tableEmailMaterialFromKnownButtonV140(node, onclick){
    var matchers = [
      {
        re: /openBreakEvenTableV(?:110|106)\s*\(/,
        title: "Точка безубыточности",
        url: TABLE_EMAIL_FALLBACKS_V140.breakEven,
        kind: "table"
      },
      {
        re: /openBusinessEquationTableV(?:110|107)\s*\(/,
        title: "Единое уравнение бизнеса",
        url: TABLE_EMAIL_FALLBACKS_V140.businessEquation,
        kind: "table"
      },
      {
        re: /openCreditFilterTableV128\s*\(/,
        title: "Кредитный фильтр",
        url: tableEmailRegistryValueV140("__CREDIT_FILTER_V128", "tableUrl", TABLE_EMAIL_FALLBACKS_V140.creditFilter),
        kind: "table"
      },
      {
        re: /openCreditFilterExampleV128\s*\(/,
        title: "Заполненный пример кредитного фильтра",
        url: tableEmailRegistryValueV140("__CREDIT_FILTER_V128", "exampleUrl", TABLE_EMAIL_FALLBACKS_V140.creditFilterExample),
        kind: "example"
      },
      {
        re: /openUnitEconomicsTableV131\s*\(/,
        title: "Калькулятор юнит-экономики",
        url: tableEmailRegistryValueV140("__UNIT_ECONOMICS_V131", "tableUrl", TABLE_EMAIL_FALLBACKS_V140.unitEconomics),
        kind: "table"
      },
      {
        re: /openCashGapRadarTableV132\s*\(/,
        title: "Радар кассового разрыва на 13 недель",
        url: tableEmailRegistryValueV140("__CASH_GAP_RADAR_V132", "tableUrl", TABLE_EMAIL_FALLBACKS_V140.cashGapRadar),
        kind: "table"
      },
      {
        re: /openManagementPnlTableV139\s*\(/,
        title: "Управленческий ОПиУ на 12 месяцев",
        url: tableEmailRegistryValueV140("__MANAGEMENT_PNL_V139", "tableUrl", TABLE_EMAIL_FALLBACKS_V140.managementPnl),
        kind: "table"
      },
      {
        re: /openManagementPnlInstructionV139\s*\(/,
        title: "Инструкция к управленческому ОПиУ",
        url: tableEmailRegistryValueV140("__MANAGEMENT_PNL_V139", "instructionUrl", TABLE_EMAIL_FALLBACKS_V140.managementPnlInstruction),
        kind: "instruction"
      },
      {
        re: /openManagementPnlExampleV139\s*\(/,
        title: "Заполненный пример управленческого ОПиУ",
        url: tableEmailRegistryValueV140("__MANAGEMENT_PNL_V139", "exampleUrl", TABLE_EMAIL_FALLBACKS_V140.managementPnlExample),
        kind: "example"
      }
    ];

    for (var i = 0; i < matchers.length; i += 1) {
      if (matchers[i].re.test(onclick)) {
        return {
          url: matchers[i].url,
          title: tableEmailTitleForNodeV140(node, matchers[i].title),
          kind: matchers[i].kind
        };
      }
    }
    return null;
  }

  function tableEmailDetectMaterialV140(node){
    if (!node || node.classList && node.classList.contains("table-email-btn-v140")) return null;

    var href = "";
    if (node.tagName === "A") href = node.getAttribute("href") || node.href || "";
    if (tableEmailIsGoogleSheetV140(href)) {
      var anchorKind = /пример/i.test(node.textContent || "") ? "example" : (/инструкц/i.test(node.textContent || "") ? "instruction" : "table");
      return {
        url: new URL(href, document.baseURI).href,
        title: tableEmailTitleForNodeV140(node),
        kind: anchorKind
      };
    }

    var onclick = String(node.getAttribute && node.getAttribute("onclick") || "");
    if (!onclick) return null;

    var literalMatch = onclick.match(/https:\/\/docs\.google\.com\/spreadsheets\/[^'"\s)]+/i);
    if (literalMatch && tableEmailIsGoogleSheetV140(literalMatch[0])) {
      return {
        url: literalMatch[0],
        title: tableEmailTitleForNodeV140(node),
        kind: /пример/i.test(node.textContent || "") ? "example" : "table"
      };
    }

    var selfStudyMatch = onclick.match(/openSelfStudyTemplateV\d+\s*\(\s*['"]([^'"]+)['"]/i);
    if (selfStudyMatch && tableEmailIsGoogleSheetV140(selfStudyMatch[1])) {
      return {
        url: selfStudyMatch[1],
        title: tableEmailTitleForNodeV140(node),
        kind: "table"
      };
    }

    return tableEmailMaterialFromKnownButtonV140(node, onclick);
  }

  function tableEmailButtonLabelV140(material){
    if (material && material.kind === "example") return "Отправить пример на почту";
    if (material && material.kind === "instruction") return "Отправить инструкцию на почту";
    return "Отправить на почту";
  }

  function tableEmailDecorateNodeV140(node){
    if (!node || node.dataset.tableEmailBoundV140 === "1") return;
    var material = tableEmailDetectMaterialV140(node);
    if (!material || !tableEmailIsGoogleSheetV140(material.url)) return;

    node.dataset.tableEmailBoundV140 = "1";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn secondary table-email-btn-v140";
    button.textContent = tableEmailButtonLabelV140(material);
    button.setAttribute("aria-label", tableEmailButtonLabelV140(material) + ": " + material.title);
    button.addEventListener("click", function(event){
      event.preventDefault();
      event.stopPropagation();
      tableEmailStartFlowV140(material, button);
    });

    node.insertAdjacentElement("afterend", button);
  }

  function tableEmailScanV140(){
    TABLE_EMAIL_SCAN_QUEUED_V140 = false;
    var nodes = document.querySelectorAll(TABLE_EMAIL_SELECTOR_V140);
    for (var i = 0; i < nodes.length; i += 1) tableEmailDecorateNodeV140(nodes[i]);
  }

  function tableEmailQueueScanV140(){
    if (TABLE_EMAIL_SCAN_QUEUED_V140) return;
    TABLE_EMAIL_SCAN_QUEUED_V140 = true;
    setTimeout(tableEmailScanV140, 0);
  }

  function tableEmailTelegramInitDataV140(){
    try {
      var webApp = window.Telegram && window.Telegram.WebApp;
      return webApp && webApp.initData ? String(webApp.initData) : "";
    } catch(e) {
      return "";
    }
  }

  function tableEmailApiErrorV140(code, fallback){
    var messages = {
      OPEN_FROM_TELEGRAM_REQUIRED: "Откройте приложение через Telegram и повторите попытку.",
      TELEGRAM_DATA_INVALID: "Сессия Telegram устарела. Закройте приложение, откройте его заново и повторите попытку.",
      TELEGRAM_DATA_EXPIRED: "Сессия Telegram устарела. Закройте приложение, откройте его заново и повторите попытку.",
      INVALID_EMAIL: "Проверьте адрес электронной почты.",
      EMAIL_REQUIRED: "Сначала укажите адрес электронной почты.",
      INVALID_TABLE_URL: "Эту ссылку нельзя отправить. Доступны только Google Таблицы.",
      RATE_LIMIT_MINUTE: "Письмо уже отправлялось недавно. Повторите через минуту.",
      RATE_LIMIT_DAY: "Достигнут дневной лимит отправок. Повторите завтра.",
      DATABASE_NOT_READY: "Сервис ещё не подключён к базе данных.",
      EMAIL_SERVICE_NOT_CONFIGURED: "Почтовый сервис ещё не настроен.",
      EMAIL_SEND_FAILED: "Почтовый сервис временно не отправил письмо. Повторите попытку позже.",
      NETWORK_ERROR: "Не удалось связаться с сервером. Проверьте интернет и повторите попытку."
    };
    return messages[code] || fallback || "Не удалось отправить письмо.";
  }

  async function tableEmailApiV140(action, payload){
    var initData = tableEmailTelegramInitDataV140();
    if (!initData) {
      var openError = new Error(tableEmailApiErrorV140("OPEN_FROM_TELEGRAM_REQUIRED"));
      openError.code = "OPEN_FROM_TELEGRAM_REQUIRED";
      throw openError;
    }

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeout = controller ? setTimeout(function(){ controller.abort(); }, 20000) : null;

    try {
      var response = await fetch(TABLE_EMAIL_API_URL_V140, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ action: action, initData: initData }, payload || {})),
        signal: controller ? controller.signal : undefined
      });
      var data = {};
      try { data = await response.json(); } catch(e) {}
      if (!response.ok || !data.ok) {
        var code = data && data.error ? String(data.error) : "EMAIL_SEND_FAILED";
        var requestError = new Error(tableEmailApiErrorV140(code, data && data.message));
        requestError.code = code;
        requestError.status = response.status;
        throw requestError;
      }
      return data;
    } catch(error) {
      if (error && error.code) throw error;
      var networkError = new Error(tableEmailApiErrorV140("NETWORK_ERROR"));
      networkError.code = "NETWORK_ERROR";
      throw networkError;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function tableEmailCloseModalV140(){
    if (TABLE_EMAIL_ACTIVE_MODAL_V140 && TABLE_EMAIL_ACTIVE_MODAL_V140.parentNode) {
      TABLE_EMAIL_ACTIVE_MODAL_V140.parentNode.removeChild(TABLE_EMAIL_ACTIVE_MODAL_V140);
    }
    TABLE_EMAIL_ACTIVE_MODAL_V140 = null;
    document.removeEventListener("keydown", tableEmailEscapeHandlerV140);
  }

  function tableEmailEscapeHandlerV140(event){
    if (event && event.key === "Escape") tableEmailCloseModalV140();
  }

  function tableEmailOpenModalV140(html){
    tableEmailCloseModalV140();
    var overlay = document.createElement("div");
    overlay.className = "table-email-overlay-v140";
    overlay.innerHTML = '<div class="table-email-modal-v140" role="dialog" aria-modal="true">' + html + '</div>';
    overlay.addEventListener("click", function(event){ if (event.target === overlay) tableEmailCloseModalV140(); });
    document.body.appendChild(overlay);
    TABLE_EMAIL_ACTIVE_MODAL_V140 = overlay;
    document.addEventListener("keydown", tableEmailEscapeHandlerV140);
    return overlay;
  }

  function tableEmailShowErrorV140(error, material){
    var message = error && error.message ? error.message : tableEmailApiErrorV140(error && error.code);
    var overlay = tableEmailOpenModalV140(
      '<button class="table-email-modal-close-v140" type="button" aria-label="Закрыть">×</button>' +
      '<p class="eyebrow">отправка на почту</p>' +
      '<h2>Письмо не отправлено</h2>' +
      '<p>' + tableEmailEscV140(message) + '</p>' +
      '<div class="table-email-modal-actions-v140">' +
        '<button class="btn primary table-email-retry-v140" type="button">Повторить</button>' +
        '<button class="btn secondary table-email-cancel-v140" type="button">Закрыть</button>' +
      '</div>'
    );
    overlay.querySelector(".table-email-modal-close-v140").addEventListener("click", tableEmailCloseModalV140);
    overlay.querySelector(".table-email-cancel-v140").addEventListener("click", tableEmailCloseModalV140);
    overlay.querySelector(".table-email-retry-v140").addEventListener("click", function(){
      tableEmailCloseModalV140();
      if (material) tableEmailStartFlowV140(material, null);
    });
  }

  function tableEmailShowSuccessV140(material, maskedEmail){
    var overlay = tableEmailOpenModalV140(
      '<button class="table-email-modal-close-v140" type="button" aria-label="Закрыть">×</button>' +
      '<p class="eyebrow">готово</p>' +
      '<h2>Таблица отправлена</h2>' +
      '<p><b>' + tableEmailEscV140(material.title) + '</b></p>' +
      '<p>Письмо отправлено на <b>' + tableEmailEscV140(maskedEmail || "сохранённый email") + '</b>. Откройте его на компьютере и нажмите «Открыть таблицу».</p>' +
      '<div class="table-email-modal-actions-v140">' +
        '<button class="btn primary table-email-done-v140" type="button">Готово</button>' +
        '<button class="btn secondary table-email-change-v140" type="button">Изменить email</button>' +
      '</div>'
    );
    overlay.querySelector(".table-email-modal-close-v140").addEventListener("click", tableEmailCloseModalV140);
    overlay.querySelector(".table-email-done-v140").addEventListener("click", tableEmailCloseModalV140);
    overlay.querySelector(".table-email-change-v140").addEventListener("click", function(){
      tableEmailShowEmailFormV140(material, "");
    });

    try {
      var webApp = window.Telegram && window.Telegram.WebApp;
      if (webApp && webApp.HapticFeedback && typeof webApp.HapticFeedback.notificationOccurred === "function") {
        webApp.HapticFeedback.notificationOccurred("success");
      }
    } catch(e) {}
  }

  function tableEmailShowEmailFormV140(material, presetEmail){
    var overlay = tableEmailOpenModalV140(
      '<button class="table-email-modal-close-v140" type="button" aria-label="Закрыть">×</button>' +
      '<p class="eyebrow">работа на компьютере</p>' +
      '<h2>Куда отправить таблицу?</h2>' +
      '<p>Укажите почту, которую удобно открыть на компьютере или ноутбуке.</p>' +
      '<form class="table-email-form-v140" novalidate>' +
        '<label for="table-email-input-v140">Email</label>' +
        '<input id="table-email-input-v140" name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="' + tableEmailEscV140(presetEmail || "") + '" required maxlength="254">' +
        '<p class="table-email-field-error-v140" aria-live="polite"></p>' +
        '<div class="table-email-modal-actions-v140">' +
          '<button class="btn primary table-email-submit-v140" type="submit">Отправить таблицу</button>' +
          '<button class="btn secondary table-email-cancel-v140" type="button">Отмена</button>' +
        '</div>' +
      '</form>' +
      '<p class="small">В пилотной версии адрес сохраняется без отдельного подтверждения. Его можно изменить после любой отправки.</p>'
    );

    var form = overlay.querySelector(".table-email-form-v140");
    var input = overlay.querySelector("#table-email-input-v140");
    var errorNode = overlay.querySelector(".table-email-field-error-v140");
    var submit = overlay.querySelector(".table-email-submit-v140");

    overlay.querySelector(".table-email-modal-close-v140").addEventListener("click", tableEmailCloseModalV140);
    overlay.querySelector(".table-email-cancel-v140").addEventListener("click", tableEmailCloseModalV140);

    form.addEventListener("submit", async function(event){
      event.preventDefault();
      var email = String(input.value || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        errorNode.textContent = "Проверьте адрес электронной почты.";
        input.focus();
        return;
      }
      errorNode.textContent = "";
      tableEmailSetLoadingV140(submit, true, "Отправляем…");
      try {
        var result = await tableEmailSendV140(material, email);
        tableEmailCloseModalV140();
        tableEmailShowSuccessV140(material, result.maskedEmail);
      } catch(error) {
        tableEmailSetLoadingV140(submit, false);
        errorNode.textContent = error && error.message ? error.message : "Не удалось отправить письмо.";
      }
    });

    setTimeout(function(){ try { input.focus(); } catch(e) {} }, 50);
  }

  function tableEmailSetLoadingV140(button, loading, loadingText){
    if (!button) return;
    if (loading) {
      if (!button.dataset.tableEmailOriginalTextV140) button.dataset.tableEmailOriginalTextV140 = button.textContent || "Отправить на почту";
      button.disabled = true;
      button.classList.add("is-loading-v140");
      button.textContent = loadingText || "Отправляем…";
    } else {
      button.disabled = false;
      button.classList.remove("is-loading-v140");
      if (button.dataset.tableEmailOriginalTextV140) button.textContent = button.dataset.tableEmailOriginalTextV140;
    }
  }

  async function tableEmailLoadProfileV140(){
    if (TABLE_EMAIL_PROFILE_V140.loaded) return TABLE_EMAIL_PROFILE_V140;
    var result = await tableEmailApiV140("profile", {});
    TABLE_EMAIL_PROFILE_V140.loaded = true;
    TABLE_EMAIL_PROFILE_V140.hasEmail = Boolean(result.hasEmail);
    TABLE_EMAIL_PROFILE_V140.maskedEmail = String(result.maskedEmail || "");
    return TABLE_EMAIL_PROFILE_V140;
  }

  async function tableEmailSendV140(material, email){
    var result = await tableEmailApiV140("send", {
      email: email || undefined,
      materialUrl: material.url,
      materialTitle: material.title,
      materialKind: material.kind || "table"
    });
    TABLE_EMAIL_PROFILE_V140.loaded = true;
    TABLE_EMAIL_PROFILE_V140.hasEmail = true;
    TABLE_EMAIL_PROFILE_V140.maskedEmail = String(result.maskedEmail || "");
    return result;
  }

  async function tableEmailStartFlowV140(material, button){
    if (!material || !tableEmailIsGoogleSheetV140(material.url)) return;
    tableEmailSetLoadingV140(button, true, "Проверяем почту…");
    try {
      var profile = await tableEmailLoadProfileV140();
      if (!profile.hasEmail) {
        tableEmailSetLoadingV140(button, false);
        tableEmailShowEmailFormV140(material, "");
        return;
      }
      tableEmailSetLoadingV140(button, true, "Отправляем…");
      var result = await tableEmailSendV140(material, "");
      tableEmailSetLoadingV140(button, false);
      tableEmailShowSuccessV140(material, result.maskedEmail || profile.maskedEmail);
    } catch(error) {
      tableEmailSetLoadingV140(button, false);
      tableEmailShowErrorV140(error, material);
    }
  }

  function tableEmailInstallObserverV140(){
    var root = document.getElementById("app");
    if (!root || typeof MutationObserver === "undefined") return;
    var observer = new MutationObserver(tableEmailQueueScanV140);
    observer.observe(root, { childList: true, subtree: true });
    window.__TABLE_EMAIL_OBSERVER_V140 = observer;
  }

  window.__TABLE_EMAIL_V140 = {
    version: TABLE_EMAIL_VERSION_V140,
    apiUrl: TABLE_EMAIL_API_URL_V140,
    detectMaterial: tableEmailDetectMaterialV140,
    scan: tableEmailScanV140,
    startFlow: tableEmailStartFlowV140,
    profile: TABLE_EMAIL_PROFILE_V140,
    isolatedScript: true
  };

  tableEmailInstallObserverV140();
  tableEmailQueueScanV140();
})();
