/* =====================================================
   v140 — доступ к пилоту отправки таблиц на email
   Кнопки остаются скрытыми, пока сервер не подтвердит владельца.
   ===================================================== */
(function installTableEmailPilotGateV140(){
  "use strict";

  var TABLE_EMAIL_API_URL_V140 = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/send-table-email";

  function getTelegramInitDataV140(){
    try {
      var webApp = window.Telegram && window.Telegram.WebApp;
      return webApp && webApp.initData ? String(webApp.initData) : "";
    } catch(e) {
      return "";
    }
  }

  async function checkTableEmailPilotAccessV140(){
    var initData = getTelegramInitDataV140();
    if (!initData) return;

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeout = controller ? setTimeout(function(){ controller.abort(); }, 15000) : null;

    try {
      var response = await fetch(TABLE_EMAIL_API_URL_V140, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "profile", initData: initData }),
        signal: controller ? controller.signal : undefined
      });

      var payload = {};
      try { payload = await response.json(); } catch(e) {}

      if (response.ok && payload && payload.ok === true) {
        document.documentElement.classList.add("table-email-pilot-enabled-v140");
      }
    } catch(error) {
      console.warn("TABLE_EMAIL_PILOT_GATE_V140", error);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  window.__TABLE_EMAIL_PILOT_GATE_V140 = {
    check: checkTableEmailPilotAccessV140,
    apiUrl: TABLE_EMAIL_API_URL_V140
  };

  checkTableEmailPilotAccessV140();
})();
