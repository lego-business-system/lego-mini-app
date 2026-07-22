/* =====================================================
   v131 — Юнит-экономика продукта или услуги
   Изолированное дополнение к блоку «Дополнительные материалы».
   Основной app.js, каталог уроков, прогресс, роли, форум и Supabase
   не изменяются.
   ===================================================== */
(function installUnitEconomicsV131(){
  "use strict";

  var UNIT_ECONOMICS_VERSION_V131 = "v131-unit-economics-20260722";
  var UNIT_ECONOMICS_CODE_V131 = "ADD-UE-01";
  var UNIT_ECONOMICS_TABLE_URL_V131 = "https://docs.google.com/spreadsheets/d/1RqBn7hoDoFPVeL0cIJLkgy6i1i-4iPnzG0Lnpr26-Hw/edit?gid=751234597#gid=751234597";

  function unitEconomicsAssertAccessV131(){
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

  function unitEconomicsCardV131(cls, html){
    if (typeof window.additionalCardV110 === "function") {
      return window.additionalCardV110(cls, html);
    }
    if (typeof window.card === "function") return window.card(cls, html);
    return '<section class="card-v2 ' + (cls || "") + '">' + (html || "") + '</section>';
  }

  function unitEconomicsShellV131(html){
    if (typeof window.additionalShellV110 === "function") {
      return window.additionalShellV110(html);
    }
    if (typeof window.shell === "function") return window.shell(html, "home");
    var root = document.getElementById("app");
    if (root) root.innerHTML = html;
  }

  function unitEconomicsAwardV131(eventKey, eventType, payload){
    try {
      if (typeof window.additionalAwardV110 === "function") {
        return window.additionalAwardV110(eventKey, eventType, payload || {});
      }
    } catch(e) {
      console.warn("UNIT_ECONOMICS_AWARD_V131", e);
    }
  }

  function unitEconomicsOpenUrlV131(url){
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

  function injectUnitEconomicsEntryV131(){
    try {
      var list = document.querySelector(".additional-list-v110");
      if (!list || list.querySelector(".unit-economics-row-v131")) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-row-v2 additional-lesson-row-v106 unit-economics-row-v131";
      button.innerHTML = '<div><b>Юнит-экономика продукта или услуги</b><p>Расчёт одной позиции и группы · цена · маржинальность · безопасная скидка · необходимый объём</p></div><span>→</span>';
      button.addEventListener("click", renderUnitEconomicsIntroV131);
      list.appendChild(button);
    } catch(e) {
      console.warn("UNIT_ECONOMICS_ENTRY_V131", e);
    }
  }

  function renderUnitEconomicsIntroV131(){
    if (!unitEconomicsAssertAccessV131()) return;

    unitEconomicsAwardV131(
      "lesson:" + UNIT_ECONOMICS_CODE_V131,
      "lesson_open",
      { lessonCode: UNIT_ECONOMICS_CODE_V131, module: "additional_materials" }
    );

    unitEconomicsShellV131(
      unitEconomicsCardV131(
        "blue-card-v2 additional-lesson-hero-v110 unit-economics-hero-v131",
        '<p class="eyebrow">финансы и ценообразование</p>' +
        '<h1>Юнит-экономика продукта или услуги</h1>' +
        '<p>Практический расчёт одной продажи здесь и сейчас: сколько денег остаётся после переменных затрат, какая цена и скидка допустимы, какой объём нужен для безубыточности и желаемой прибыли.</p>'
      ) +

      unitEconomicsCardV131(
        "additional-lesson-intro-v110 unit-economics-definition-v131",
        '<h2>Что такое юнит-экономика</h2>' +
        '<p>Юнит — это одна понятная единица, на которой бизнес зарабатывает: товар, услуга, заказ, комплект, час работы, посещение, изделие, рейс или другая измеримая единица.</p>' +
        '<p>Юнит-экономика показывает, сколько одна продажа создаёт денег после расходов, которые возникают именно из-за этой продажи. Она помогает отделить реальный финансовый вклад от простого роста выручки.</p>' +
        '<div class="slide-callouts-v87">' +
          '<div class="slide-callout-v87 thought"><span>Главная формула</span><p>Цена после скидки − переменные затраты = маржинальная прибыль с одной продажи.</p></div>' +
          '<div class="slide-callout-v87 error"><span>Типовая ошибка</span><p>Считать весь чек прибылью или включать один расход одновременно в переменные и постоянные затраты.</p></div>' +
          '<div class="slide-callout-v87 conclusion"><span>Управленческий вывод</span><p>Масштабировать можно только ту продажу, которая создаёт положительный вклад и выдерживает постоянные расходы бизнеса.</p></div>' +
        '</div>'
      ) +

      unitEconomicsCardV131(
        "additional-lesson-intro-v110 unit-economics-content-v131",
        '<h2>Что входит в расчёт</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Единица, цена и объём</b><p>Выберите один товар, услугу, заказ или пакет. Укажите базовую цену, плановую скидку и текущий либо ожидаемый объём продаж.</p></section></div>' +
          '<div><span>02</span><section><b>Переменные затраты</b><p>Закупка, сырьё, расходники, сдельная оплата, упаковка, доставка, эквайринг, комиссии, налог с выручки, возвраты и переделки.</p></section></div>' +
          '<div><span>03</span><section><b>Постоянные расходы и цель</b><p>Постоянные расходы не включаются в себестоимость единицы повторно. Они используются для расчёта точки безубыточности и объёма для желаемой прибыли.</p></section></div>' +
          '<div><span>04</span><section><b>Стоимость привлечения — необязательно</b><p>Если CAC неизвестен, поле можно оставить пустым. Калькулятор всё равно покажет предельную и безопасную стоимость привлечения при текущей экономике.</p></section></div>' +
        '</div>'
      ) +

      unitEconomicsCardV131(
        "additional-lesson-intro-v110 unit-economics-metrics-v131",
        '<h2>Какие решения даёт калькулятор</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Маржинальная прибыль и маржинальность</b><p>Сколько рублей и какая доля цены остаются после переменных затрат на покрытие постоянных расходов и прибыль.</p></section></div>' +
          '<div><span>02</span><section><b>Рабочая минимальная цена</b><p>Какая цена сохраняет заданную маржинальность или минимальный вклад с одной продажи.</p></section></div>' +
          '<div><span>03</span><section><b>Техническая и безопасная скидка</b><p>Где проходит аварийная граница и какую скидку можно дать без разрушения выбранной экономики.</p></section></div>' +
          '<div><span>04</span><section><b>Последствия скидки</b><p>Сколько прибыли теряется с единицы и насколько должен вырасти объём, чтобы компенсировать снижение цены.</p></section></div>' +
          '<div><span>05</span><section><b>Безубыточность и целевая прибыль</b><p>Сколько единиц и выручки необходимо для покрытия постоянных расходов и получения заданной прибыли.</p></section></div>' +
          '<div><span>06</span><section><b>Экономика продуктовой группы</b><p>Сравнение до 12 позиций по выручке, маржинальной прибыли, скидке и вкладу в общий результат.</p></section></div>' +
        '</div>'
      ) +

      unitEconomicsCardV131(
        "additional-table-card-v110 unit-economics-workflow-v131",
        '<h2>Порядок работы</h2>' +
        '<div class="break-even-steps-v106 additional-table-steps-v110">' +
          '<div><b>1. Откройте таблицу и создайте личную копию</b><p>В Google Таблицах выберите <b>Файл → Создать копию</b>. Исходный шаблон должен оставаться чистым.</p></div>' +
          '<div><b>2. Начните с одного продукта или услуги</b><p>Заполните белые поля на листе «Один продукт». Не меняйте серые и зелёные расчётные ячейки.</p></div>' +
          '<div><b>3. Проверьте цену, скидку и необходимый объём</b><p>Смотрите не только на прибыль с единицы, но и на возможность физически выполнить рассчитанный объём.</p></div>' +
          '<div><b>4. Затем соберите продуктовую группу</b><p>Перенесите рассчитанные данные по позициям и сравните, какие товары или услуги создают результат, а какие только увеличивают оборот.</p></div>' +
          '<div><b>5. Зафиксируйте одно решение</b><p>Изменить цену, ограничить скидку, снизить переменные затраты, увеличить объём, изменить комплектацию или убрать слабую позицию.</p></div>' +
        '</div>'
      ) +

      unitEconomicsCardV131(
        "additional-lesson-intro-v110 unit-economics-rules-v131",
        '<h2>Важные правила расчёта</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Не дублируйте расходы</b><p>Один и тот же расход нельзя одновременно включать в затраты на единицу и в постоянные расходы.</p></section></div>' +
          '<div><span>02</span><section><b>Технический максимум не является рекомендацией</b><p>Технически максимальная скидка оставляет нулевой вклад. Для реального решения ориентируйтесь на безопасную скидку.</p></section></div>' +
          '<div><span>03</span><section><b>Проверяйте мощность</b><p>Скидка не подтверждена, если для её компенсации нужно продать больше, чем бизнес способен выполнить.</p></section></div>' +
          '<div><span>04</span><section><b>Помните границу инструмента</b><p>Калькулятор не заменяет ОПиУ, ОДДС и баланс. Он отвечает на узкий вопрос об экономике одной продажи и выбранной группы.</p></section></div>' +
        '</div>'
      ) +

      unitEconomicsCardV131(
        "additional-table-card-v110 unit-economics-material-v131",
        '<p class="eyebrow">рабочий материал</p>' +
        '<h2>Калькулятор юнит-экономики</h2>' +
        '<p>Внутри находятся урок и инструкция, чистый расчёт одного продукта или услуги, заполненный пример, калькулятор группы до 12 позиций и пример продуктовой группы.</p>' +
        '<div class="profile-score-grid additional-mini-stats-v110">' +
          '<div><span>Расчёт</span><b>1 продукт</b></div>' +
          '<div><span>Сравнение</span><b>до 12 позиций</b></div>' +
          '<div><span>Примеры</span><b>2</b></div>' +
        '</div>' +
        '<div class="grid-v2">' +
          '<button class="btn primary" type="button" onclick="openUnitEconomicsTableV131()">Открыть калькулятор и примеры</button>' +
          '<button class="btn secondary" type="button" onclick="renderAdditionalMaterials()">К дополнительным материалам</button>' +
        '</div>'
      )
    );
  }

  function openUnitEconomicsTableV131(){
    if (!unitEconomicsAssertAccessV131()) return;

    unitEconomicsAwardV131(
      "work_material:" + UNIT_ECONOMICS_CODE_V131 + ":unit_economics_table",
      "work_material_open",
      {
        lessonCode: UNIT_ECONOMICS_CODE_V131,
        materialId: "unit_economics_table",
        url: UNIT_ECONOMICS_TABLE_URL_V131,
        source: "additional_materials"
      }
    );

    unitEconomicsOpenUrlV131(UNIT_ECONOMICS_TABLE_URL_V131);
  }

  var renderAdditionalMaterialsBeforeV131 = window.renderAdditionalMaterials;
  if (typeof renderAdditionalMaterialsBeforeV131 === "function" && !renderAdditionalMaterialsBeforeV131.__unitEconomicsV131) {
    var renderAdditionalMaterialsV131 = function(){
      var result = renderAdditionalMaterialsBeforeV131.apply(this, arguments);
      injectUnitEconomicsEntryV131();
      setTimeout(injectUnitEconomicsEntryV131, 0);
      return result;
    };
    renderAdditionalMaterialsV131.__unitEconomicsV131 = true;
    window.renderAdditionalMaterials = renderAdditionalMaterialsV131;
    try { renderAdditionalMaterials = renderAdditionalMaterialsV131; } catch(e) {}
  }

  window.renderUnitEconomicsIntroV131 = renderUnitEconomicsIntroV131;
  window.openUnitEconomicsTableV131 = openUnitEconomicsTableV131;
  window.injectUnitEconomicsEntryV131 = injectUnitEconomicsEntryV131;

  try {
    var registry = window.__ADDITIONAL_MATERIALS_V110;
    if (registry && Array.isArray(registry.lessons) && registry.lessons.indexOf(UNIT_ECONOMICS_CODE_V131) === -1) {
      registry.lessons.push(UNIT_ECONOMICS_CODE_V131);
    }
  } catch(e) {}

  injectUnitEconomicsEntryV131();
  setTimeout(injectUnitEconomicsEntryV131, 0);

  window.__UNIT_ECONOMICS_V131 = {
    version: UNIT_ECONOMICS_VERSION_V131,
    lessonCode: UNIT_ECONOMICS_CODE_V131,
    tableUrl: UNIT_ECONOMICS_TABLE_URL_V131,
    isolatedScript: true
  };
})();
