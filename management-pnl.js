/* =====================================================
   v139 — Управленческий ОПиУ на 12 месяцев
   Изолированное дополнение к блоку «Дополнительные материалы».
   Основной app.js, каталог уроков, прогресс, роли, форум и Supabase
   не изменяются.
   ===================================================== */
(function installManagementPnlV139(){
  "use strict";

  var MANAGEMENT_PNL_VERSION_V139 = "v139-management-pnl-20260725";
  var MANAGEMENT_PNL_CODE_V139 = "ADD-PNL-12-01";
  var MANAGEMENT_PNL_TABLE_URL_V139 = "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=1270260255#gid=1270260255";
  var MANAGEMENT_PNL_INSTRUCTION_URL_V139 = "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=385874795#gid=385874795";
  var MANAGEMENT_PNL_EXAMPLE_URL_V139 = "https://docs.google.com/spreadsheets/d/1LqpkZM9gOdXwzvEMIzTprcsH9uHlCqBd65KRmhAH9qI/edit?gid=836036698#gid=836036698";

  function managementPnlAssertAccessV139(){
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

  function managementPnlCardV139(cls, html){
    if (typeof window.additionalCardV110 === "function") {
      return window.additionalCardV110(cls, html);
    }
    if (typeof window.card === "function") return window.card(cls, html);
    return '<section class="card-v2 ' + (cls || "") + '">' + (html || "") + '</section>';
  }

  function managementPnlShellV139(html){
    if (typeof window.additionalShellV110 === "function") {
      return window.additionalShellV110(html);
    }
    if (typeof window.shell === "function") return window.shell(html, "home");
    var root = document.getElementById("app");
    if (root) root.innerHTML = html;
  }

  function managementPnlAwardV139(eventKey, eventType, payload){
    try {
      if (typeof window.additionalAwardV110 === "function") {
        return window.additionalAwardV110(eventKey, eventType, payload || {});
      }
    } catch(e) {
      console.warn("MANAGEMENT_PNL_AWARD_V139", e);
    }
  }

  function managementPnlOpenUrlV139(url){
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

  function injectManagementPnlEntryV139(){
    try {
      var list = document.querySelector(".additional-list-v110");
      if (!list || list.querySelector(".management-pnl-row-v139")) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-row-v2 additional-lesson-row-v106 management-pnl-row-v139";
      button.innerHTML = '<div><b>Управленческий ОПиУ на 12 месяцев</b><p>12 месяцев факта · уровни прибыли · переменные и постоянные расходы · безубыточность · дашборд</p></div><span>→</span>';
      button.addEventListener("click", renderManagementPnlIntroV139);
      list.appendChild(button);
    } catch(e) {
      console.warn("MANAGEMENT_PNL_ENTRY_V139", e);
    }
  }

  function renderManagementPnlIntroV139(){
    if (!managementPnlAssertAccessV139()) return;

    managementPnlAwardV139(
      "lesson:" + MANAGEMENT_PNL_CODE_V139,
      "lesson_open",
      { lessonCode: MANAGEMENT_PNL_CODE_V139, module: "additional_materials" }
    );

    managementPnlShellV139(
      managementPnlCardV139(
        "blue-card-v2 additional-lesson-hero-v110 management-pnl-hero-v139",
        '<p class="eyebrow">финансы и управленческий учёт</p>' +
        '<h1>Управленческий ОПиУ на 12 месяцев</h1>' +
        '<p>Практический отчёт о прибылях и убытках: как выручка превращается в валовую прибыль, EBITDA, операционную и чистую прибыль и какие расходы меняют результат бизнеса.</p>'
      ) +

      managementPnlCardV139(
        "additional-lesson-intro-v110 management-pnl-definition-v139",
        '<h2>Что показывает ОПиУ</h2>' +
        '<p>ОПиУ собирает доходы и расходы того периода, к которому они относятся. Он показывает, на каком уровне формируется или снижается прибыль и какие статьи требуют управленческого решения.</p>' +
        '<p>ОПиУ не равен движению денег. Оплата клиента может прийти раньше или позже продажи, а платёж поставщику — раньше или позже признания расхода. Для контроля денег нужен отдельный ОДДС и платёжный календарь.</p>' +
        '<div class="slide-callouts-v87">' +
          '<div class="slide-callout-v87 thought"><span>Главный принцип</span><p>Доходы и расходы относятся к месяцу возникновения, а не к дате поступления или списания денег.</p></div>' +
          '<div class="slide-callout-v87 error"><span>Типовая ошибка</span><p>Включать в расходы ОПиУ погашение тела кредита, покупку оборудования или выплаты собственнику.</p></div>' +
          '<div class="slide-callout-v87 conclusion"><span>Управленческий вывод</span><p>ОПиУ объясняет прибыль, а ОДДС — изменение денег. Для решения собственнику нужны оба отчёта.</p></div>' +
        '</div>'
      ) +

      managementPnlCardV139(
        "additional-lesson-intro-v110 management-pnl-content-v139",
        '<h2>Что входит в отчёт</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Выручка, скидки и возвраты</b><p>Сначала отражается валовая выручка, затем скидки, возвраты и бонусы. Так формируется нетто-выручка, с которой сравниваются расходы и прибыль.</p></section></div>' +
          '<div><span>02</span><section><b>Себестоимость продаж</b><p>Материалы, производство, доставка и другие прямые расходы только по проданным товарам, оказанным услугам или выполненным заказам. Непроданные запасы не относятся в расход периода.</p></section></div>' +
          '<div><span>03</span><section><b>Операционные расходы</b><p>Маркетинг, продажи и клиентский сервис, административные и управленческие расходы. Для применимых статей указывается переменная доля.</p></section></div>' +
          '<div><span>04</span><section><b>Амортизация, проценты и налог</b><p>EBITDA считается до амортизации, операционная прибыль — после неё. Проценты и налог отражаются ниже операционной прибыли, чтобы отдельно видеть стоимость финансирования и налоговую нагрузку.</p></section></div>' +
        '</div>'
      ) +

      managementPnlCardV139(
        "additional-lesson-intro-v110 management-pnl-metrics-v139",
        '<h2>Какие решения даёт инструмент</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Валовая прибыль и валовая рентабельность</b><p>Достаточно ли торговой наценки или маржи услуги для покрытия операционных расходов.</p></section></div>' +
          '<div><span>02</span><section><b>Маржинальный доход</b><p>Сколько остаётся после переменной части расходов на покрытие постоянных затрат и создание прибыли.</p></section></div>' +
          '<div><span>03</span><section><b>EBITDA и операционная прибыль</b><p>Как работает основная модель бизнеса до амортизации и после неё, без смешения с процентами и налогом.</p></section></div>' +
          '<div><span>04</span><section><b>Чистая прибыль</b><p>Какой результат остаётся после операционных расходов, амортизации, процентов, прочих статей и налога.</p></section></div>' +
          '<div><span>05</span><section><b>Точка безубыточности и запас прочности</b><p>Какая выручка нужна для покрытия расходов и насколько фактический результат удалён от убыточной зоны.</p></section></div>' +
          '<div><span>06</span><section><b>Дашборд отклонений</b><p>Какие показатели вышли за установленные границы и какое действие нужно проверить в первую очередь.</p></section></div>' +
        '</div>'
      ) +

      managementPnlCardV139(
        "additional-table-card-v110 management-pnl-workflow-v139",
        '<h2>Порядок работы</h2>' +
        '<div class="break-even-steps-v106 additional-table-steps-v110">' +
          '<div><b>1. Откройте таблицу и создайте личную копию</b><p>В Google Таблицах выберите <b>Файл → Создать копию</b>. Исходный шаблон должен оставаться чистым.</p></div>' +
          '<div><b>2. Заполните лист «02_Настройки»</b><p>Укажите компанию, год, валюту, налоговый режим, контрольные границы и последний закрытый месяц.</p></div>' +
          '<div><b>3. Внесите данные за закрытые месяцы</b><p>На листе «03_Ввод_12_месяцев» заполняйте синие суммы и жёлтую колонку переменной доли. Будущие месяцы оставляйте пустыми.</p></div>' +
          '<div><b>4. Подтвердите месяцы без выручки</b><p>Если в закрытом месяце выручки не было, введите 0 в одну из строк выручки. Иначе система посчитает месяц незаполненным.</p></div>' +
          '<div><b>5. Проверьте статус и ОПиУ</b><p>Сначала добейтесь статуса «Данные готовы к расчёту», затем проверьте прибыль по месяцам и контрольную сверку операционной прибыли.</p></div>' +
          '<div><b>6. Примите одно решение по дашборду</b><p>Выберите главное отклонение: выручка, валовая рентабельность, постоянные операционные расходы, безубыточность, запас прочности или покрытие процентов — и назначьте действие с датой проверки.</p></div>' +
        '</div>'
      ) +

      managementPnlCardV139(
        "additional-lesson-intro-v110 management-pnl-rules-v139",
        '<h2>Важные правила заполнения</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Работайте только с закрытыми месяцами</b><p>Нельзя смешивать подтверждённый факт и неполный текущий месяц: это искажает средние значения и рентабельность.</p></section></div>' +
          '<div><span>02</span><section><b>Отражайте начисление, а не оплату</b><p>Расход относится к месяцу, в котором бизнес получил ресурс или услугу, даже если деньги были перечислены в другую дату.</p></section></div>' +
          '<div><span>03</span><section><b>Вводите суммы положительными</b><p>Скидки, возвраты и расходы указываются положительными значениями. Таблица сама вычитает их в нужных строках.</p></section></div>' +
          '<div><span>04</span><section><b>Не смешивайте прибыль и деньги</b><p>Погашение тела кредита, CAPEX и выплаты собственнику не являются обычными операционными расходами.</p></section></div>' +
          '<div><span>05</span><section><b>Проверяйте начисленный налог</b><p>Налог вводится по расчёту выбранного режима. Его нельзя автоматически считать от бухгалтерской прибыли одной универсальной ставкой.</p></section></div>' +
          '<div><span>06</span><section><b>Не принимайте ориентиры за нормативы</b><p>Контрольные границы устанавливает собственник с учётом модели бизнеса. Они нужны для сигналов, а не для формального сравнения с отраслью.</p></section></div>' +
          '<div><span>07</span><section><b>Не меняйте расчётные ячейки</b><p>Заполняйте только предусмотренные поля ввода. Формулы, итоги и служебные строки защищены намеренно.</p></section></div>' +
        '</div>' +
        '<p class="small">Инструмент предназначен для управленческого анализа и не заменяет бухгалтерскую, налоговую отчётность, ОДДС и баланс.</p>'
      ) +

      managementPnlCardV139(
        "additional-table-card-v110 management-pnl-material-v139",
        '<p class="eyebrow">рабочий материал</p>' +
        '<h2>Архитектура ОПиУ</h2>' +
        '<p>Внутри находятся урок и инструкция, настройки, ввод данных за 12 месяцев, управленческий ОПиУ, дашборд и полностью заполненный пример.</p>' +
        '<div class="profile-score-grid additional-mini-stats-v110">' +
          '<div><span>Горизонт</span><b>12 месяцев</b></div>' +
          '<div><span>Ввод</span><b>по месяцам</b></div>' +
          '<div><span>Структура</span><b>9 листов</b></div>' +
          '<div><span>Пример</span><b>заполнен</b></div>' +
        '</div>' +
        '<div class="grid-v2">' +
          '<button class="btn primary" type="button" onclick="openManagementPnlTableV139()">Открыть ОПиУ</button>' +
          '<button class="btn secondary" type="button" onclick="openManagementPnlInstructionV139()">Открыть инструкцию</button>' +
          '<button class="btn secondary" type="button" onclick="openManagementPnlExampleV139()">Посмотреть заполненный пример</button>' +
          '<button class="btn secondary" type="button" onclick="renderAdditionalMaterials()">К дополнительным материалам</button>' +
        '</div>'
      )
    );
  }

  function openManagementPnlMaterialV139(materialId, url){
    if (!managementPnlAssertAccessV139()) return;

    managementPnlAwardV139(
      "work_material:" + MANAGEMENT_PNL_CODE_V139 + ":" + materialId,
      "work_material_open",
      {
        lessonCode: MANAGEMENT_PNL_CODE_V139,
        materialId: materialId,
        url: url,
        source: "additional_materials"
      }
    );

    managementPnlOpenUrlV139(url);
  }

  function openManagementPnlTableV139(){
    openManagementPnlMaterialV139("management_pnl_table", MANAGEMENT_PNL_TABLE_URL_V139);
  }

  function openManagementPnlInstructionV139(){
    openManagementPnlMaterialV139("management_pnl_instruction", MANAGEMENT_PNL_INSTRUCTION_URL_V139);
  }

  function openManagementPnlExampleV139(){
    openManagementPnlMaterialV139("management_pnl_example", MANAGEMENT_PNL_EXAMPLE_URL_V139);
  }

  var renderAdditionalMaterialsBeforeV139 = window.renderAdditionalMaterials;
  if (typeof renderAdditionalMaterialsBeforeV139 === "function" && !renderAdditionalMaterialsBeforeV139.__managementPnlV139) {
    var renderAdditionalMaterialsV139 = function(){
      var result = renderAdditionalMaterialsBeforeV139.apply(this, arguments);
      injectManagementPnlEntryV139();
      setTimeout(injectManagementPnlEntryV139, 0);
      return result;
    };
    renderAdditionalMaterialsV139.__managementPnlV139 = true;
    window.renderAdditionalMaterials = renderAdditionalMaterialsV139;
    try { renderAdditionalMaterials = renderAdditionalMaterialsV139; } catch(e) {}
  }

  window.renderManagementPnlIntroV139 = renderManagementPnlIntroV139;
  window.openManagementPnlTableV139 = openManagementPnlTableV139;
  window.openManagementPnlInstructionV139 = openManagementPnlInstructionV139;
  window.openManagementPnlExampleV139 = openManagementPnlExampleV139;
  window.injectManagementPnlEntryV139 = injectManagementPnlEntryV139;

  try {
    var registry = window.__ADDITIONAL_MATERIALS_V110;
    if (registry && Array.isArray(registry.lessons) && registry.lessons.indexOf(MANAGEMENT_PNL_CODE_V139) === -1) {
      registry.lessons.push(MANAGEMENT_PNL_CODE_V139);
    }
  } catch(e) {}

  injectManagementPnlEntryV139();
  setTimeout(injectManagementPnlEntryV139, 0);

  window.__MANAGEMENT_PNL_V139 = {
    version: MANAGEMENT_PNL_VERSION_V139,
    lessonCode: MANAGEMENT_PNL_CODE_V139,
    tableUrl: MANAGEMENT_PNL_TABLE_URL_V139,
    instructionUrl: MANAGEMENT_PNL_INSTRUCTION_URL_V139,
    exampleUrl: MANAGEMENT_PNL_EXAMPLE_URL_V139,
    isolatedScript: true
  };
})();
