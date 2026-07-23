/* =====================================================
   АРХИТЕКТУРА — углублённые уроки «Я предприниматель»
   v137-entrepreneur-deep-lessons-20260723
   Изолированная надстройка: не изменяет app.js, форум, профиль,
   Supabase, первые уроки и эталонный ENT-TR-02.
   ===================================================== */
(function installEntrepreneurCurriculumV137(){
  "use strict";
  const RELEASE="v137-entrepreneur-deep-lessons-20260723";
  const TARGETS={"ENT-TR-03":{"activityKey":"trade","title":"Конверсия в покупку: где посетитель теряет решение","description":"Превратить общую конверсию магазина в диагностическую систему по этапам, сегментам, сменам, категориям и причинам отказа. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":3},"ENT-TR-04":{"activityKey":"trade","title":"Ассортимент как портфель ролей, спроса и денег","description":"Управлять ассортиментом не количеством sku, а ролями позиций, доступностью, маржой, оборачиваемостью, связями в корзине и риском замороженных денег. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":4},"ENT-TR-05":{"activityKey":"trade","title":"Средний чек: архитектура корзины без разрушения доверия","description":"Разложить средний чек на цену, количество единиц, товарный микс, комплектность, сегмент и скидку; находить рост, который увеличивает вклад и полезность покупки. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":5},"ENT-TR-06":{"activityKey":"trade","title":"Маржа и вклад: где оборот перестаёт быть результатом","description":"Отделить наценку от маржинальности, валовую прибыль от вклада, среднюю маржу от микса и понять предельную экономику скидок, каналов и категорий. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":6},"ENT-TR-07":{"activityKey":"trade","title":"Запасы и оборотный капитал: наличие без замороженной кассы","description":"Связать уровень сервиса, спрос, вариативность поставки, минимальный и максимальный запас, дефицит, неликвид и денежный цикл. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":7},"ENT-TR-08":{"activityKey":"trade","title":"Расходы торговой модели: цена сервиса, канала и сложности","description":"Разделить постоянные, переменные, ступенчатые, обязательные и дискреционные расходы; распределять только там, где это улучшает решение. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":8},"ENT-TR-09":{"activityKey":"trade","title":"Управленческий учёт торговли: одна версия прибыли, запасов и денег","description":"Построить минимальный контур начислений, оплат, товарного движения, закрытия периода, опиу, оддс, баланса и план-факта. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":9},"ENT-TR-10":{"activityKey":"trade","title":"Деньги и касса: торговый календарь ликвидности","description":"Связать продажи, закупки, запасы, отсрочки, налоги, фот, аренду и долг в 13-недельный платежный календарь и правила приоритета. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":10},"ENT-SV-02":{"activityKey":"services","title":"Поток заявок: спрос, который можно обслужить и монетизировать","description":"Отделить интерес от целевого спроса, органику от платного прироста, первичный спрос от повторов и проверить, выдерживает ли сервис новый поток по людям, времени и качеству. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":2},"ENT-SV-03":{"activityKey":"services","title":"Конверсия в запись и оплату: доверие, квалификация и обязательство клиента","description":"Разложить конверсию на ответ, квалификацию, предложение, запись, предоплату, доходимость и оплату; управлять причинами отказа без давления и скидочной зависимости. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":3},"ENT-SV-04":{"activityKey":"services","title":"Линейка услуг: путь клиента, продуктовые роли и операционная сложность","description":"Собрать линейку по задачам клиента, входным продуктам, основным программам, продолжению и поддержке; убрать дубли, непонятные названия и дорогие исключения. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":4},"ENT-SV-05":{"activityKey":"services","title":"Средний чек в услугах: ценность решения, пакет и границы допродажи","description":"Разложить чек на базовую услугу, длительность, уровень специалиста, дополнения, пакет, программу и скидку; отличить полезную комплектацию от давления. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":5},"ENT-SV-06":{"activityKey":"services","title":"Маржинальность услуг: экономика времени, специалиста и формата","description":"Считать полную переменную экономику услуги, разделять оплату труда по поведению, учитывать расходники, эквайринг, переделки, время кабинета и различия специалистов. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":6},"ENT-SV-07":{"activityKey":"services","title":"Загрузка ресурсов: расписание, мощность и экономика пустого окна","description":"Различать предоставленные, продаваемые и фактически занятые часы; управлять пиками, буферами, no-show, длительностью, сменами и сочетанием специалист–кабинет–оборудование. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":7},"ENT-SV-08":{"activityKey":"services","title":"Повторные продажи: удержание через результат, цикл и следующую задачу","description":"Отделить естественный цикл от навязанной частоты, измерять когорты, причины ухода, завершение программы, реактивацию и качество долгосрочного результата. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":8},"ENT-SV-09":{"activityKey":"services","title":"Расходы сервисной модели: люди, помещения, качество и сложность","description":"Классифицировать фот, аренду, материалы, маркетинг, администрирование, качество, обучение и ступени мощности; не распределять расходы так, чтобы искажать продуктовые решения. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":9},"ENT-SV-10":{"activityKey":"services","title":"Деньги и касса в услугах: авансы, обязательства и 13 недель","description":"Связать запись, фактическое оказание, авансы, пакеты, возвраты, фот, аренду, налоги и capex в платежный календарь. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":10},"ENT-PR-02":{"activityKey":"production","title":"Поток заказов и спрос: портфель, который производство способно выполнить","description":"Отделить интерес от технически и экономически приемлемого заказа, связать спрос с портфелем, сроком, мощностью, материалами и оборотным капиталом. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":2},"ENT-PR-03":{"activityKey":"production","title":"Заявка, заказ и спецификация: управление изменениями до запуска","description":"Построить путь от запроса к требованиям, калькуляции, спецификации, маршруту, сроку и договору; управлять версиями и платными изменениями. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":3},"ENT-PR-04":{"activityKey":"production","title":"Материалы и снабжение: комплектность, надёжность и цена дефицита","description":"Связать bom, критичность, спрос, lead time, качество поставщика, moq, страховой запас, замены и оборотный капитал. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":4},"ENT-PR-05":{"activityKey":"production","title":"Производственный цикл и мощность: поток через ограничение","description":"Различать время обработки и ожидания, находить ограничение, управлять wip, переналадкой, размером партии, буфером и эффективной мощностью. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":5},"ENT-PR-06":{"activityKey":"production","title":"Себестоимость и маржа заказа: от нормы к фактическому вкладу","description":"Развести стандартную, фактическую и управленческую себестоимость; анализировать отклонения материала, труда, брака, переналадки и микса. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":6},"ENT-PR-07":{"activityKey":"production","title":"Качество и брак: стоимость вариации и встроенное качество","description":"Разделить внутренний брак, переделку, внешний дефект, отклонение процесса и системную причину; строить контроль у источника. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":7},"ENT-PR-08":{"activityKey":"production","title":"Расходы и накладные: стоимость мощности, сложности и простоя","description":"Разделить ресурсные, поддерживающие, ступенчатые и дискреционные расходы; использовать драйверы только для управленческих решений. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":8},"ENT-PR-09":{"activityKey":"production","title":"Управленческий учёт производства: заказ, WIP, запасы и результат","description":"Построить регистры заказов, материалов, труда, wip, выпуска, брака, отгрузки и признания выручки; закрывать период с контрольными сверками. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":9},"ENT-PR-10":{"activityKey":"production","title":"Деньги, авансы и оборотный цикл производства","description":"Связать предоплату, закупки, wip, фот, выпуск, отгрузку, дебиторку, поставщиков и инвестиции в 13-недельный календарь. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":10},"ENT-BD-02":{"activityKey":"construction","title":"Поток заявок и объектов: спрос, который превращается в исполнимый портфель","description":"Отделить общий интерес от целевых объектов, связать источник, тип проекта, бюджет, срок, географию, вероятность договора, доступность сметчика и бригад. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":2},"ENT-BD-03":{"activityKey":"construction","title":"Замер, смета и договор: конверсия без скрытых обязательств","description":"Построить путь от брифа и замера к scope, допущениям, смете, графику, рискам, исключениям и договору; отделить продажу от бесплатного проектирования. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":3},"ENT-BD-04":{"activityKey":"construction","title":"Смета, материалы и закупки: бюджет объекта, изменения и комплектность","description":"Связать базовую смету, рабочий бюджет, спецификацию, график закупок, поставщиков, резервы, изменения, остатки и прогноз стоимости завершения. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":4},"ENT-BD-05":{"activityKey":"construction","title":"Управление сроками и этапами: критический путь, готовность и обещание","description":"Различать мастер-график и исполнимый недельный план, управлять зависимостями, готовностью, критическим путём, буферами, ограничениями и изменениями. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":5},"ENT-BD-06":{"activityKey":"construction","title":"Маржинальность объекта: прогноз результата до завершения","description":"Связать цену договора, базовую смету, факт, обязательства, остаток работ, накладные объекта, изменения, риски и денежный график. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":6},"ENT-BD-07":{"activityKey":"construction","title":"Бригады, ресурсы и качество: производительность без переделок","description":"Управлять компетенциями, нормами, фронтом работ, обеспеченностью, сменным заданием, качеством у источника, приёмкой и производительностью. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":7},"ENT-BD-08":{"activityKey":"construction","title":"Расходы, переделки и гарантия: стоимость плохого качества проекта","description":"Разделить нормальные объектовые расходы, перерасход, переделку, гарантию, компенсацию, простой и репутационный эффект; создать capa и резерв. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":8},"ENT-BD-09":{"activityKey":"construction","title":"Управленческий учёт проектов: объект, этап, WIP и признание результата","description":"Построить паспорт объекта, baseline, выручку по правилам признания, затраты, обязательства, wip, авансы, дебиторку, кредиторку, eac и портфельный отчёт. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":9},"ENT-BD-10":{"activityKey":"construction","title":"Деньги, авансы и кассовые разрывы проектного бизнеса","description":"Связать график работ, этапные оплаты, закупки, фот бригад, подрядчиков, налоги, гарантийные резервы и дебиторку в 13-недельный календарь. Итог — факт, ограничение, расчёт, решение и дата проверки.","number":10}};
  const BUNDLE_FILES={
    trade:"entrepreneur-lessons-trade-v137.js",
    services:"entrepreneur-lessons-services-v137.js",
    production:"entrepreneur-lessons-production-v137.js",
    construction:"entrepreneur-lessons-construction-v137.js"
  };
  const loadPromises={};

  function isTarget(code){ return Object.prototype.hasOwnProperty.call(TARGETS,String(code||"")); }
  function patchCatalog(){
    try{
      if(typeof state==="undefined"||!state||!state.catalog||!Array.isArray(state.catalog.lessons)) return false;
      state.catalog.lessons.forEach(function(meta){
        const target=TARGETS[meta.code]; if(!target)return;
        meta.status="ready"; meta.title=target.title; meta.description=target.description;
        meta.slidesCount=34; meta.quizCount=18; meta.bookScreensCount=25; meta.homeworkSheetUrl="#";
      });
      state.catalog.version=RELEASE;
      return true;
    }catch(error){ console.warn("ENT_V137_CATALOG_PATCH",error); return false; }
  }

  function loadScript(src){
    return new Promise(function(resolve,reject){
      const existing=document.querySelector('script[data-ent-v137="'+src+'"]');
      if(existing){ if(existing.dataset.loaded==="1")return resolve(); existing.addEventListener("load",resolve,{once:true}); existing.addEventListener("error",reject,{once:true}); return; }
      const script=document.createElement("script"); script.src=src+"?v="+encodeURIComponent(RELEASE); script.async=true; script.dataset.entV137=src;
      script.onload=function(){script.dataset.loaded="1";resolve();}; script.onerror=function(){reject(new Error("Не удалось загрузить пакет уроков: "+src));};
      document.head.appendChild(script);
    });
  }
  async function loadBundle(activityKey){
    if(loadPromises[activityKey])return loadPromises[activityKey];
    loadPromises[activityKey]=(async function(){
      window.EntrepreneurLessonBundlesV137=window.EntrepreneurLessonBundlesV137||{};
      if(!window.EntrepreneurLessonBundlesV137[activityKey]) await loadScript(BUNDLE_FILES[activityKey]);
      const holder=window.EntrepreneurLessonBundlesV137[activityKey];
      if(!holder||typeof holder.load!=="function")throw new Error("Пакет направления не зарегистрирован: "+activityKey);
      return holder.load();
    })().catch(function(error){delete loadPromises[activityKey];throw error;});
    return loadPromises[activityKey];
  }

  const originalLoadLesson=typeof window.loadLesson==="function"?window.loadLesson:null;
  async function loadLessonV137(code){
    const lessonCode=String(code||"");
    if(!isTarget(lessonCode)){ if(!originalLoadLesson)throw new Error("LOAD_LESSON_NOT_AVAILABLE"); return originalLoadLesson.apply(this,arguments); }
    patchCatalog();
    try{ if(typeof state!=="undefined"&&state.lessonCache&&state.lessonCache[lessonCode])return state.lessonCache[lessonCode]; }catch(e){}
    const meta=TARGETS[lessonCode],bundle=await loadBundle(meta.activityKey),lesson=bundle[lessonCode];
    if(!lesson)throw new Error("Урок не найден в пакете: "+lessonCode);
    try{ state.lessonCache=state.lessonCache||{}; state.lessonCache[lessonCode]=lesson; }catch(e){}
    return lesson;
  }
  if(originalLoadLesson){ window.loadLesson=loadLessonV137; try{ loadLesson=loadLessonV137; }catch(e){} }

  const originalLoadCatalog=typeof window.loadCatalog==="function"?window.loadCatalog:null;
  if(originalLoadCatalog){
    const wrapped=async function(){const result=await originalLoadCatalog.apply(this,arguments);patchCatalog();return result;};
    window.loadCatalog=wrapped; try{loadCatalog=wrapped;}catch(e){}
  }

  const originalPrepared=typeof window.isLessonPrepared==="function"?window.isLessonPrepared:null;
  function isLessonPreparedV137(meta){ if(meta&&isTarget(meta.code))return true; return originalPrepared?originalPrepared.apply(this,arguments):false; }
  window.isLessonPrepared=isLessonPreparedV137; try{isLessonPrepared=isLessonPreparedV137;}catch(e){}

  const originalCanOpen=typeof window.canOpenLesson==="function"?window.canOpenLesson:null;
  function canOpenLessonV137(meta){ if(meta&&isTarget(meta.code))return true; return originalCanOpen?originalCanOpen.apply(this,arguments):false; }
  window.canOpenLesson=canOpenLessonV137; try{canOpenLesson=canOpenLessonV137;}catch(e){}

  const originalMediaUrl=typeof window.mediaUrlV24==="function"?window.mediaUrlV24:null;
  function mediaUrlV137(url){ const raw=String(url||"").trim(); if(raw.startsWith("data:")||raw.startsWith("blob:"))return raw; return originalMediaUrl?originalMediaUrl.apply(this,arguments):raw; }
  window.mediaUrlV24=mediaUrlV137; try{mediaUrlV24=mediaUrlV137;}catch(e){}

  function patchActivityNote(){
    try{
      const key=(typeof state!=="undefined"&&state.selectedActivityKey)||"";
      if(!["trade","services","production","construction"].includes(key))return;
      document.querySelectorAll(".activity-progress-head .small").forEach(function(node){
        if(/урок|материал|ДЗ|готов/i.test(node.textContent||"")) node.textContent="Все подготовленные уроки доступны сразу. Внутри урока этапы проходят последовательно; таблицы ДЗ будут подключены отдельным релизом.";
      });
    }catch(e){}
  }
  const originalRenderActivity=typeof window.renderActivityLessons==="function"?window.renderActivityLessons:null;
  if(originalRenderActivity){
    const wrapped=function(){patchCatalog();const result=originalRenderActivity.apply(this,arguments);setTimeout(patchActivityNote,0);setTimeout(patchActivityNote,80);return result;};
    window.renderActivityLessons=wrapped; try{renderActivityLessons=wrapped;}catch(e){}
  }

  function install(){
    patchCatalog(); patchActivityNote();
    let tries=0; const timer=setInterval(function(){ tries+=1; const done=patchCatalog(); patchActivityNote(); if(done||tries>80)clearInterval(timer); },100);
  }
  window.EntrepreneurCurriculumV137={release:RELEASE,targets:Object.keys(TARGETS),patchCatalog,loadLesson:loadLessonV137,loadBundle};
  install();
})();
