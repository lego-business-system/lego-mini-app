/* =====================================================
   v140 — Финансовая модель сервисного бизнеса
   Изолированное дополнение к блоку «Дополнительные материалы».
   Основной app.js, каталог уроков, прогресс, роли, форум и Supabase
   не изменяются.
   ===================================================== */
(function installServiceFinancialModelV140(){
  "use strict";

  var SERVICE_FINANCIAL_MODEL_VERSION_V140 = "v140-service-financial-model-20260727";
  var SERVICE_FINANCIAL_MODEL_CODE_V140 = "ADD-SFM-120-01";
  var SERVICE_FINANCIAL_MODEL_TEMPLATE_URL_V140 = "https://docs.google.com/spreadsheets/d/1bjCFcCUoPlRuuGA_cOR9zbG6_UW-d0Kmmp1TkS9Jipo/edit?gid=778561952#gid=778561952";
  var SERVICE_FINANCIAL_MODEL_EXAMPLE_URL_V140 = "https://docs.google.com/spreadsheets/d/15ZVkcCpxIu1zPLpLYYUqrkB5Ph3_VsvmZKRwxzBMdPc/edit?gid=1575412804#gid=1575412804";

  function serviceFinancialModelAssertAccessV140(){
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

  function serviceFinancialModelCardV140(cls, html){
    if (typeof window.additionalCardV110 === "function") {
      return window.additionalCardV110(cls, html);
    }
    if (typeof window.card === "function") return window.card(cls, html);
    return '<section class="card-v2 ' + (cls || "") + '">' + (html || "") + '</section>';
  }

  function serviceFinancialModelShellV140(html){
    if (typeof window.additionalShellV110 === "function") {
      return window.additionalShellV110(html);
    }
    if (typeof window.shell === "function") return window.shell(html, "home");
    var root = document.getElementById("app");
    if (root) root.innerHTML = html;
  }

  function serviceFinancialModelAwardV140(eventKey, eventType, payload){
    try {
      if (typeof window.additionalAwardV110 === "function") {
        return window.additionalAwardV110(eventKey, eventType, payload || {});
      }
    } catch(e) {
      console.warn("SERVICE_FINANCIAL_MODEL_AWARD_V140", e);
    }
  }

  function serviceFinancialModelOpenUrlV140(url){
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

  function injectServiceFinancialModelEntryV140(){
    try {
      var list = document.querySelector(".additional-list-v110");
      if (!list || list.querySelector(".service-financial-model-row-v140")) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "lesson-row-v2 additional-lesson-row-v106 service-financial-model-row-v140";
      button.innerHTML = '<div><b>Финансовая модель сервисного бизнеса</b><p>120 месяцев · услуги и средняя цена · расходы · финансирование · безубыточность · окупаемость · IRR</p></div><span>→</span>';
      button.addEventListener("click", renderServiceFinancialModelIntroV140);
      list.appendChild(button);
    } catch(e) {
      console.warn("SERVICE_FINANCIAL_MODEL_ENTRY_V140", e);
    }
  }

  function renderServiceFinancialModelIntroV140(){
    if (!serviceFinancialModelAssertAccessV140()) return;

    serviceFinancialModelAwardV140(
      "lesson:" + SERVICE_FINANCIAL_MODEL_CODE_V140,
      "lesson_open",
      { lessonCode: SERVICE_FINANCIAL_MODEL_CODE_V140, module: "additional_materials" }
    );

    serviceFinancialModelShellV140(
      serviceFinancialModelCardV140(
        "blue-card-v2 additional-lesson-hero-v110 service-financial-model-hero-v140",
        '<p class="eyebrow">финансы и инвестиционное планирование</p>' +
        '<h1>Финансовая модель сервисного бизнеса</h1>' +
        '<p>Практический расчёт проекта на 120 месяцев: сколько услуг нужно оказать, какую выручку и прибыль создаёт план, сколько денег потребуется до окупаемости и выдерживает ли модель заявленные расходы, вложения и заём.</p>'
      ) +

      serviceFinancialModelCardV140(
        "additional-lesson-intro-v110 service-financial-model-definition-v140",
        '<h2>Что показывает финансовая модель</h2>' +
        '<p>Модель связывает операционный план с деньгами. Количество оплаченных услуг и средняя цена формируют выручку. Из выручки последовательно вычитаются переменные расходы, постоянные расходы, налог и вложения. После этого рассчитываются денежный остаток, потребность в капитале и срок окупаемости.</p>' +
        '<p>Расчёт строится помесячно на десять лет. Это позволяет увидеть не только результат первого года, но и период разгона, погашение займа, дальнейший рост и момент устойчивой окупаемости проекта.</p>' +
        '<div class="slide-callouts-v87">' +
          '<div class="slide-callout-v87 thought"><span>Основная цепочка</span><p>Услуги → средняя цена → выручка → расходы → EBITDA → налог → CAPEX → деньги → окупаемость.</p></div>' +
          '<div class="slide-callout-v87 error"><span>Типовая ошибка</span><p>Сначала придумать желаемую прибыль, а затем подгонять под неё количество клиентов, загрузку и стоимость услуг.</p></div>' +
          '<div class="slide-callout-v87 conclusion"><span>Управленческий вывод</span><p>Финансовая модель нужна для проверки плана и потребности в деньгах, а не для подтверждения заранее принятого решения.</p></div>' +
        '</div>'
      ) +

      serviceFinancialModelCardV140(
        "additional-lesson-intro-v110 service-financial-model-inputs-v140",
        '<h2>Что нужно заполнить</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Период и запуск</b><p>Первый месяц модели, месяц начала работы и месяц появления постоянных расходов.</p></section></div>' +
          '<div><span>02</span><section><b>Объём услуг</b><p>Оплаченные услуги в первый рабочий месяц, целевой объём, срок выхода на цель и дальнейший годовой рост.</p></section></div>' +
          '<div><span>03</span><section><b>Цена и переменные расходы</b><p>Средняя фактически оплаченная цена одной услуги, её индексация, затраты на одну услугу и процентные переменные расходы.</p></section></div>' +
          '<div><span>04</span><section><b>Постоянные расходы</b><p>Полный ФОТ с начислениями, аренда, маркетинг, другие постоянные расходы и их годовая индексация.</p></section></div>' +
          '<div><span>05</span><section><b>Налог и вложения</b><p>Управленческий режим налога, ставка, первоначальный CAPEX и месяц оплаты вложений.</p></section></div>' +
          '<div><span>06</span><section><b>Финансирование</b><p>Вклад владельца или инвестора, сумма займа, месяц получения, годовая ставка, срок и минимальный денежный резерв.</p></section></div>' +
        '</div>'
      ) +

      serviceFinancialModelCardV140(
        "additional-lesson-intro-v110 service-financial-model-results-v140",
        '<h2>Как читать результат</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Потребность в капитале</b><p>Сколько денег требуется, чтобы пройти самый глубокий кассовый провал проекта и сохранить выбранный резерв.</p></section></div>' +
          '<div><span>02</span><section><b>Дополнительное финансирование</b><p>Какая сумма остаётся непокрытой после запланированного вклада владельца и получения займа.</p></section></div>' +
          '<div><span>03</span><section><b>EBITDA</b><p>Результат основной деятельности до процентов, налога и вложений. Отрицательная EBITDA означает, что операционная модель пока не покрывает свои расходы.</p></section></div>' +
          '<div><span>04</span><section><b>Точка безубыточности</b><p>Минимальное количество услуг в месяц, необходимое для покрытия постоянных и переменных расходов при заданной цене.</p></section></div>' +
          '<div><span>05</span><section><b>Окупаемость</b><p>Первый устойчивый месяц, после которого накопленный проектный поток становится неотрицательным и больше не возвращается в минус.</p></section></div>' +
          '<div><span>06</span><section><b>IRR проекта</b><p>Годовая внутренняя доходность проектного потока до финансирования. Показатель нужно сравнивать с требуемой доходностью инвестора и проверять вместе с потребностью в капитале и сроком окупаемости.</p></section></div>' +
        '</div>'
      ) +

      serviceFinancialModelCardV140(
        "additional-table-card-v110 service-financial-model-workflow-v140",
        '<h2>Порядок работы</h2>' +
        '<div class="break-even-steps-v106 additional-table-steps-v110">' +
          '<div><b>1. Откройте чистый шаблон и создайте личную копию</b><p>В Google Таблицах выберите <b>Файл → Создать копию</b>. Исходный шаблон не редактируйте.</p></div>' +
          '<div><b>2. Прочитайте лист «00_Инструкция»</b><p>На нём указаны порядок работы, определения показателей, правила ввода и границы расчёта.</p></div>' +
          '<div><b>3. Заполните лист «01_Ввод» сверху вниз</b><p>Обязательные значения находятся в жёлтых ячейках. Необязательные проверки мощности находятся в голубых ячейках.</p></div>' +
          '<div><b>4. Проверьте лист «05_Проверки»</b><p>Статус «ОШИБКА» означает, что расчёту нельзя доверять. Статус риска означает, что формулы работают, но экономика или финансирование требуют решения.</p></div>' +
          '<div><b>5. Откройте лист «03_Итоги»</b><p>Сначала проверьте потребность в капитале, дополнительное финансирование, EBITDA, точку безубыточности и окупаемость. Затем изучите годовые итоги и графики.</p></div>' +
          '<div><b>6. При необходимости заполните «04_Расширенный»</b><p>Этот лист проверяет мощность помещений, специалистов и рекламную воронку. Он не создаёт спрос и не меняет выручку автоматически.</p></div>' +
          '<div><b>7. Сравните результат с заполненным примером</b><p>Пример нужен для проверки последовательности заполнения. Его значения нельзя переносить в собственный проект.</p></div>' +
          '<div><b>8. Проверьте плохой сценарий</b><p>Создайте отдельную копию модели и снизьте объём или цену, увеличьте расходы и задержите выход на целевой объём. Решение должно выдерживать не только базовый план.</p></div>' +
        '</div>'
      ) +

      serviceFinancialModelCardV140(
        "additional-lesson-intro-v110 service-financial-model-rules-v140",
        '<h2>Важные правила заполнения</h2>' +
        '<div class="content-preview-list-v40 additional-preview-v110">' +
          '<div><span>01</span><section><b>Не смешивайте услуги и клиентов</b><p>Одна оплаченная услуга — один визит или одна выполненная работа. Один клиент может приобрести несколько услуг.</p></section></div>' +
          '<div><span>02</span><section><b>Используйте фактическую среднюю цену</b><p>Указывайте реально оплачиваемую сумму после скидок, а не цену из прайс-листа.</p></section></div>' +
          '<div><span>03</span><section><b>Указывайте полный ФОТ</b><p>Включайте выплаты сотрудникам и обязательные начисления. Не добавляйте одни и те же расходы повторно в другие строки.</p></section></div>' +
          '<div><span>04</span><section><b>Вводите проценты в правильном формате</b><p>Шесть процентов вводятся как 6%, а не как число 6. Таблица отдельно проверяет ошибочно завышенные ставки.</p></section></div>' +
          '<div><span>05</span><section><b>Не путайте проект и финансирование</b><p>Кредит и вклад владельца увеличивают деньги, но не являются выручкой. Погашение тела кредита уменьшает деньги, но не является операционным расходом.</p></section></div>' +
          '<div><span>06</span><section><b>Не создавайте спрос из мощности</b><p>Количество кабинетов и специалистов показывает, можно ли выполнить план. Оно не доказывает, что клиенты действительно придут.</p></section></div>' +
          '<div><span>07</span><section><b>Не изменяйте расчётные листы</b><p>Не вставляйте строки и столбцы и не заменяйте формулы. Для работы используйте предусмотренные поля ввода.</p></section></div>' +
          '<div><span>08</span><section><b>Не принимайте прогноз за гарантию</b><p>IRR, окупаемость и будущий денежный остаток зависят от исходных предпосылок. Любое инвестиционное решение нужно проверять несколькими сценариями.</p></section></div>' +
        '</div>' +
        '<p class="small">Модель предназначена для управленческого планирования и не заменяет бухгалтерский, налоговый, юридический, оценочный или кредитный расчёт.</p>'
      ) +

      serviceFinancialModelCardV140(
        "additional-table-card-v110 service-financial-model-material-v140",
        '<p class="eyebrow">рабочие материалы</p>' +
        '<h2>Финансовая модель сервисного бизнеса</h2>' +
        '<p>Чистый шаблон и заполненный пример имеют одинаковую структуру: инструкция, ввод данных, помесячный план на 120 месяцев, итоговый дашборд, расширенные проверки мощности и воронки, контроль формул и исходных значений.</p>' +
        '<div class="profile-score-grid additional-mini-stats-v110">' +
          '<div><span>Горизонт</span><b>120 месяцев</b></div>' +
          '<div><span>Структура</span><b>6 листов</b></div>' +
          '<div><span>Шаблон</span><b>чистый</b></div>' +
          '<div><span>Пример</span><b>заполнен</b></div>' +
        '</div>' +
        '<div class="grid-v2">' +
          '<a class="btn primary" href="' + SERVICE_FINANCIAL_MODEL_TEMPLATE_URL_V140 + '" onclick="openServiceFinancialModelTemplateV140(); return false;">Открыть шаблон финансовой модели</a>' +
          '<a class="btn secondary" href="' + SERVICE_FINANCIAL_MODEL_EXAMPLE_URL_V140 + '" onclick="openServiceFinancialModelExampleV140(); return false;">Посмотреть заполненный пример</a>' +
          '<button class="btn secondary" type="button" onclick="renderAdditionalMaterials()">К дополнительным материалам</button>' +
        '</div>'
      )
    );
  }

  function openServiceFinancialModelMaterialV140(materialId, url){
    if (!serviceFinancialModelAssertAccessV140()) return;

    serviceFinancialModelAwardV140(
      "work_material:" + SERVICE_FINANCIAL_MODEL_CODE_V140 + ":" + materialId,
      "work_material_open",
      {
        lessonCode: SERVICE_FINANCIAL_MODEL_CODE_V140,
        materialId: materialId,
        url: url,
        source: "additional_materials"
      }
    );

    serviceFinancialModelOpenUrlV140(url);
  }

  function openServiceFinancialModelTemplateV140(){
    openServiceFinancialModelMaterialV140(
      "service_financial_model_template",
      SERVICE_FINANCIAL_MODEL_TEMPLATE_URL_V140
    );
  }

  function openServiceFinancialModelExampleV140(){
    openServiceFinancialModelMaterialV140(
      "service_financial_model_example",
      SERVICE_FINANCIAL_MODEL_EXAMPLE_URL_V140
    );
  }

  var renderAdditionalMaterialsBeforeV140 = window.renderAdditionalMaterials;
  if (typeof renderAdditionalMaterialsBeforeV140 === "function" && !renderAdditionalMaterialsBeforeV140.__serviceFinancialModelV140) {
    var renderAdditionalMaterialsV140 = function(){
      var result = renderAdditionalMaterialsBeforeV140.apply(this, arguments);
      injectServiceFinancialModelEntryV140();
      setTimeout(injectServiceFinancialModelEntryV140, 0);
      return result;
    };
    renderAdditionalMaterialsV140.__serviceFinancialModelV140 = true;
    window.renderAdditionalMaterials = renderAdditionalMaterialsV140;
    try { renderAdditionalMaterials = renderAdditionalMaterialsV140; } catch(e) {}
  }

  window.renderServiceFinancialModelIntroV140 = renderServiceFinancialModelIntroV140;
  window.openServiceFinancialModelTemplateV140 = openServiceFinancialModelTemplateV140;
  window.openServiceFinancialModelExampleV140 = openServiceFinancialModelExampleV140;
  window.injectServiceFinancialModelEntryV140 = injectServiceFinancialModelEntryV140;

  try {
    var registry = window.__ADDITIONAL_MATERIALS_V110;
    if (registry && Array.isArray(registry.lessons) && registry.lessons.indexOf(SERVICE_FINANCIAL_MODEL_CODE_V140) === -1) {
      registry.lessons.push(SERVICE_FINANCIAL_MODEL_CODE_V140);
    }
  } catch(e) {}

  injectServiceFinancialModelEntryV140();
  setTimeout(injectServiceFinancialModelEntryV140, 0);

  window.__SERVICE_FINANCIAL_MODEL_V140 = {
    version: SERVICE_FINANCIAL_MODEL_VERSION_V140,
    lessonCode: SERVICE_FINANCIAL_MODEL_CODE_V140,
    templateUrl: SERVICE_FINANCIAL_MODEL_TEMPLATE_URL_V140,
    exampleUrl: SERVICE_FINANCIAL_MODEL_EXAMPLE_URL_V140,
    isolatedScript: true
  };
})();
