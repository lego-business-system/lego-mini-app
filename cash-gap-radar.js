/* =====================================================
   v132 — Радар кассового разрыва на 13 недель
   Изолированное дополнение к блоку «Дополнительные материалы».
   Основной app.js, каталог уроков, прогресс, роли, форум и Supabase
   не изменяются.
   ===================================================== */
(function installCashGapRadarV132(){
  "use strict";

  var CASH_GAP_RADAR_VERSION_V132 = "v132-cash-gap-radar-20260723";
  var CASH_GAP_RADAR_CODE_V132 = "ADD-CASH-13-01";
  var CASH_GAP_RADAR_TABLE_URL_V132 = "https://docs.google.com/spreadsheets/d/1bc_VJ-2w5ht6Zzx9TePY10maK_Z6RQoWcO7ZfD8OVio/edit?gid=2115478736#gid=2115478736";

  function cashGapAssertAccessV132(){
    if (typeof window.additionalAssertAccessV110 === "function") {
      return window.additionalAssertAccessV110();
    }
    try {
      if (typeof state !== "undefined" && state && state.access === true) return true;
    } catch(e) {}
    if (typeof window.accessDenied === "function") {
      window.accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    }
    return false;
  }

  function cashGapCardV132(cls, html){
    if (typeof window.additionalCardV110 === "function") {
      return window.additionalCardV110(cls, html);
    }
    if (typeof window.card === "function") return window.card(cls, html);
    return '<section class="card-v2 ' + (cls || "") + '">' + (html || "") + '</section>';
  }

  function cashGapShellV132(html){
    if (typeof window.additionalShellV110 === "function") {
      return window.additionalShellV110(html);
    }
    if (typeof window.shell === "function") return window.shell(html, "home");
    var root = document.getElementById("app");
    if (root) root.innerHTML = html;
  }

  function cashGapAwardV132(eventKey, eventType, payload){
    try {
      if (typeof window.additionalAwardV110 === "function") {
        return window.additionalAwardV110(eventKey, eventType, payload || {});
      }
    } catch(e) {
      console.warn("CASH_GAP_RADAR_AWARD_V132", e);
    }
  }

  function cashGapOpenUrlV132(url){
    var target = String(url || "").trim();
    if (!target) return;
    if (typeof window.additionalOpenUrlV110 === "function") {
      window.additionalOpenUrlV110(target);
      return;
    }
    try {
      if (typeof tg !== "undefined" && tg && typeof tg.openLink === "function") {
        tg.openLink(target);
      } else {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    } catch(e) {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }

  function injectCashGapRadarEntryV132(){
    try {
      var list = document.querySelector(".additional-list-v110");
      if (!list || list.querySelector(".cash-gap-radar-row-v132")) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-row-v2 additional-lesson-row-v106 cash-gap-radar-row-v132";
      button.innerHTML = '<div><b>Радар кассового разрыва на 13 недель</b><p>Платёжный календарь · остаток денег · риск недели · резерв · перенос платежей · ускорение поступлений</p></div><span>→</span>';
      button.addEventListener("click", renderCashGapRadarIntroV132);
      list.appendChild(button);
    } catch(e) {
      console.warn("CASH_GAP_RADAR_ENTRY_V132", e);
    }
  }

  function renderCashGapRadarIntroV132(){
    if (!cashGapAssertAccessV132()) return;

    cashGapAwardV132(
      "lesson:" + CASH_GAP_RADAR_CODE_V132,
      "lesson_open",
      { lessonCode: CASH_GAP_RADAR_CODE_V132, module: "additional_materials" }
    );

    cashGapShellV132(
      cashGapCardV132(
        "blue-card-v2 additional-lesson-hero-v110 cash-gap-radar-hero-v132",
        '<p class="eyebrow">деньги и обязательства</p>' +
        '<h1>Радар кассового разрыва на 13 недель</h1>' +
        '<p>Практический платёжный календарь: когда бизнесу может не хватить денег, на какую сумму, какие платежи создают риск и какое действие нужно подготовить заранее.</p>'
      ) +

      cashGapCardV132(
        "additional-lesson-intro-v110 cash-gap-radar-definition-v132",
        '<h2>Что показывает радар</h2>' +
        '<p>Радар кассового разрыва показывает движение денег по неделям: сколько есть на старте, какие суммы действительно поступят, какие платежи нужно выполнить и какой остаток останется после каждой недели.</p>' +
        '<p>Инструмент нужен не для бухгалтерии, а для управленческого решения: заранее увидеть неделю риска и выбрать, что делать — ускорить поступления, перенести управляемый платёж или подготовить резерв.</p>' +
        '<div class="slide-callouts-v87">' +
          '<div class="slide-callout-v87 thought"><span>Главная формула</span><p>Начальный остаток + поступления − платежи = остаток денег на конец недели.</p></div>' +
          '<div class="slide-callout-v87 error"><span>Типовая ошибка</span><p>Смотреть только на прибыль и не видеть, что деньги от клиентов придут позже обязательных платежей.</p></div>' +
          '<div class="slide-callout-v87 conclusion"><span>Управленческий вывод</span><p>Прибыль не защищает бизнес от кассового разрыва, если сроки поступлений и платежей не совпадают.</p></div>' +
        '</div>'
      ) +

      cashGapCardV132(
        "additional-lesson-intro-v110 cash-gap-radar-content-v132",
        '<h2>Что входит в расчёт</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Текущий остаток денег</b><p>Доступные деньги на счетах и в кассе до начала первой недели. Если бизнес уже использует овердрафт, отрицательный стартовый остаток указывается отдельно.</p></section></div>' +
          '<div><span>02</span><section><b>Поступления по неделям</b><p>Оплаты клиентов, возврат дебиторки, авансы и подтверждённое финансирование. Сумма ставится в неделю фактического получения денег.</p></section></div>' +
          '<div><span>03</span><section><b>Обязательные платежи</b><p>Зарплата, налоги, аренда, кредиты, поставщики, закупки, сервисы и выплаты собственнику. Сумма ставится в неделю списания.</p></section></div>' +
          '<div><span>04</span><section><b>Защитный остаток</b><p>Минимальный уровень денег, ниже которого бизнес не должен опускаться без отдельного решения. Поле можно оставить пустым.</p></section></div>' +
        '</div>'
      ) +

      cashGapCardV132(
        "additional-lesson-intro-v110 cash-gap-radar-metrics-v132",
        '<h2>Какие решения даёт инструмент</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Первая неделя кассового разрыва</b><p>Неделя, в которой остаток становится отрицательным. Если минус есть уже сейчас, инструмент покажет риск на старте.</p></section></div>' +
          '<div><span>02</span><section><b>Максимальная нехватка денег</b><p>Самая глубокая точка дефицита на горизонте 13 недель. Это минимальный размер проблемы, который нужно закрыть.</p></section></div>' +
          '<div><span>03</span><section><b>Необходимый резерв</b><p>Сколько денег нужно добавить на старте, чтобы не уйти в минус или не опуститься ниже защитного остатка.</p></section></div>' +
          '<div><span>04</span><section><b>Проблемные платежи</b><p>Три крупнейших платежа рискованной недели и сумма платежей, которые реально можно перенести.</p></section></div>' +
          '<div><span>05</span><section><b>Обеспеченность деньгами</b><p>Сколько полных недель бизнес выдерживает по текущему прогнозу до первого отрицательного остатка.</p></section></div>' +
          '<div><span>06</span><section><b>Три варианта действия</b><p>Ускорить поступления, перенести управляемые платежи или заранее подготовить финансирование.</p></section></div>' +
        '</div>'
      ) +

      cashGapCardV132(
        "additional-table-card-v110 cash-gap-radar-workflow-v132",
        '<h2>Порядок работы</h2>' +
        '<div class="break-even-steps-v106 additional-table-steps-v110">' +
          '<div><b>1. Откройте таблицу и создайте личную копию</b><p>В Google Таблицах выберите <b>Файл → Создать копию</b>. Исходный шаблон должен оставаться чистым.</p></div>' +
          '<div><b>2. Заполните стартовые данные</b><p>Укажите дату начала первой недели, текущий остаток денег и защитный остаток, если он нужен.</p></div>' +
          '<div><b>3. Внесите поступления и платежи по реальным срокам</b><p>Продажа и поступление денег — не одно и то же. Платёж ставится туда, где он действительно будет списан.</p></div>' +
          '<div><b>4. Отметьте только реально переносимые платежи</b><p>Если переносима только часть суммы, разделите её на отдельную строку. Нельзя переносить платежи без проверки договора и последствий.</p></div>' +
          '<div><b>5. Проверьте решение на копии листа</b><p>После ускорения поступления или переноса платежа пересчитайте все 13 недель, чтобы проблема не появилась позже.</p></div>' +
        '</div>'
      ) +

      cashGapCardV132(
        "additional-lesson-intro-v110 cash-gap-radar-rules-v132",
        '<h2>Важные правила расчёта</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Не ставьте выручку вместо денег</b><p>В календарь вносится не факт продажи, а дата фактического поступления средств.</p></section></div>' +
          '<div><span>02</span><section><b>Не удаляйте платежи</b><p>Если платёж переносится, его нужно поставить в новую реальную неделю, а не просто убрать из прогноза.</p></section></div>' +
          '<div><span>03</span><section><b>Не дублируйте поступления</b><p>Если оплату ускорили, её нужно убрать из первоначальной недели, иначе деньги будут посчитаны дважды.</p></section></div>' +
          '<div><span>04</span><section><b>Проверяйте ближайшие недели по дням</b><p>13-недельный радар считает по неделям. Если риск рядом, первую одну-две недели нужно дополнительно разложить по дням.</p></section></div>' +
        '</div>'
      ) +

      cashGapCardV132(
        "additional-table-card-v110 cash-gap-radar-material-v132",
        '<p class="eyebrow">рабочий материал</p>' +
        '<h2>Платёжный календарь на 13 недель</h2>' +
        '<p>Внутри находятся урок и инструкция, чистый шаблон, заполненный пример, автоматическая диагностика рискованной недели, график остатка денег и блок управленческих действий.</p>' +
        '<div class="profile-score-grid additional-mini-stats-v110">' +
          '<div><span>Горизонт</span><b>13 недель</b></div>' +
          '<div><span>Ввод</span><b>по неделям</b></div>' +
          '<div><span>Пример</span><b>1</b></div>' +
        '</div>' +
        '<div class="grid-v2">' +
          '<button class="btn primary" type="button" onclick="openCashGapRadarTableV132()">Открыть календарь и пример</button>' +
          '<button class="btn secondary" type="button" onclick="renderAdditionalMaterials()">К дополнительным материалам</button>' +
        '</div>'
      )
    );
  }

  function openCashGapRadarTableV132(){
    if (!cashGapAssertAccessV132()) return;

    cashGapAwardV132(
      "work_material:" + CASH_GAP_RADAR_CODE_V132 + ":cash_gap_radar_table",
      "work_material_open",
      {
        lessonCode: CASH_GAP_RADAR_CODE_V132,
        materialId: "cash_gap_radar_table",
        url: CASH_GAP_RADAR_TABLE_URL_V132,
        source: "additional_materials"
      }
    );

    cashGapOpenUrlV132(CASH_GAP_RADAR_TABLE_URL_V132);
  }

  var renderAdditionalMaterialsBeforeV132 = window.renderAdditionalMaterials;
  if (typeof renderAdditionalMaterialsBeforeV132 === "function" && !renderAdditionalMaterialsBeforeV132.__cashGapRadarV132) {
    var renderAdditionalMaterialsV132 = function(){
      var result = renderAdditionalMaterialsBeforeV132.apply(this, arguments);
      injectCashGapRadarEntryV132();
      setTimeout(injectCashGapRadarEntryV132, 0);
      return result;
    };
    renderAdditionalMaterialsV132.__cashGapRadarV132 = true;
    window.renderAdditionalMaterials = renderAdditionalMaterialsV132;
    try { renderAdditionalMaterials = renderAdditionalMaterialsV132; } catch(e) {}
  }

  window.renderCashGapRadarIntroV132 = renderCashGapRadarIntroV132;
  window.openCashGapRadarTableV132 = openCashGapRadarTableV132;
  window.injectCashGapRadarEntryV132 = injectCashGapRadarEntryV132;

  try {
    var registry = window.__ADDITIONAL_MATERIALS_V110;
    if (registry && Array.isArray(registry.lessons) && registry.lessons.indexOf(CASH_GAP_RADAR_CODE_V132) === -1) {
      registry.lessons.push(CASH_GAP_RADAR_CODE_V132);
    }
  } catch(e) {}

  injectCashGapRadarEntryV132();
  setTimeout(injectCashGapRadarEntryV132, 0);

  window.__CASH_GAP_RADAR_V132 = {
    version: CASH_GAP_RADAR_VERSION_V132,
    lessonCode: CASH_GAP_RADAR_CODE_V132,
    tableUrl: CASH_GAP_RADAR_TABLE_URL_V132,
    isolatedScript: true
  };
})();
