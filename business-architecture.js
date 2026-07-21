/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — изолированный модуль BA v1
   Первый безопасный релиз: активен только урок BA-01.
   Модуль не изменяет существующие уроки, форум, профиль,
   Supabase и общий прогресс приложения.
   ========================================================= */
(function(){
  'use strict';

  const RELEASE = 'ba-v1-20260721';
  const STORAGE_KEY = 'architecture_business_progress_v1';
  const CATALOG_URL = 'content/business_architecture/catalog.json';
  const LESSON_BASE_URL = 'content/business_architecture/lessons/';

  const runtime = {
    catalog: null,
    lessons: {},
    loading: false,
    currentLessonId: 'BA-01',
    currentStageId: null,
    screenIndex: 0,
    quizIndex: 0,
    workspaceSectionIndex: 0,
    integrationInstalled: false,
    mutationObserver: null
  };

  function escapeHtml(value){
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function safeAlert(message){
    const text = String(message || '');
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showAlert === 'function') {
        tg.showAlert(text);
        return;
      }
    } catch(e) {}
    window.alert(text);
  }

  function scrollTop(){
    try { window.scrollTo({top:0, behavior:'smooth'}); }
    catch(e){ window.scrollTo(0,0); }
  }

  function defaultProgress(){
    return {
      version: 1,
      release: RELEASE,
      selectedRoute: '',
      currentLessonId: 'BA-01',
      updatedAt: nowIso(),
      lessons: {}
    };
  }

  function defaultLessonProgress(){
    return {
      completedStages: [],
      lastStageId: 'system_analysis',
      completedAt: null,
      systemAnalysis: { screenIndex: 0 },
      examplesOpened: [],
      quiz: {
        draft: {},
        order: {},
        attempts: [],
        lastResult: null
      },
      workspace: {
        route: '',
        sectionIndex: 0,
        sections: {},
        final: {},
        completedAt: null
      }
    };
  }

  function loadProgress(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultProgress();
      parsed.lessons = parsed.lessons && typeof parsed.lessons === 'object' ? parsed.lessons : {};
      return Object.assign(defaultProgress(), parsed);
    } catch(e){
      console.warn('BA_PROGRESS_LOAD_ERROR', e);
      return defaultProgress();
    }
  }

  function saveProgress(progress){
    const next = progress || loadProgress();
    next.release = RELEASE;
    next.updatedAt = nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch(e){ console.warn('BA_PROGRESS_SAVE_ERROR', e); }
    return next;
  }

  function getLessonProgress(lessonId){
    const progress = loadProgress();
    if (!progress.lessons[lessonId]) {
      progress.lessons[lessonId] = defaultLessonProgress();
      saveProgress(progress);
    } else {
      progress.lessons[lessonId] = Object.assign(defaultLessonProgress(), progress.lessons[lessonId]);
      progress.lessons[lessonId].quiz = Object.assign(defaultLessonProgress().quiz, progress.lessons[lessonId].quiz || {});
      progress.lessons[lessonId].workspace = Object.assign(defaultLessonProgress().workspace, progress.lessons[lessonId].workspace || {});
    }
    return { progress, lesson: progress.lessons[lessonId] };
  }

  function updateLessonProgress(lessonId, mutator){
    const bundle = getLessonProgress(lessonId);
    mutator(bundle.lesson, bundle.progress);
    bundle.progress.currentLessonId = lessonId;
    saveProgress(bundle.progress);
    return bundle.lesson;
  }

  function stageDone(lessonId, stageId){
    const bundle = getLessonProgress(lessonId);
    return Array.isArray(bundle.lesson.completedStages) && bundle.lesson.completedStages.includes(stageId);
  }

  function markStageDone(lessonId, stageId){
    updateLessonProgress(lessonId, function(lp){
      if (!lp.completedStages.includes(stageId)) lp.completedStages.push(stageId);
      lp.lastStageId = stageId;
      const lesson = runtime.lessons[lessonId];
      if (lesson && lesson.stages && lp.completedStages.length >= lesson.stages.length) {
        lp.completedAt = lp.completedAt || nowIso();
      }
    });
  }

  function courseProgressInfo(){
    const progress = loadProgress();
    let completedStages = 0;
    let completedLessons = 0;
    Object.keys(progress.lessons || {}).forEach(function(id){
      const lp = progress.lessons[id] || {};
      completedStages += Array.isArray(lp.completedStages) ? lp.completedStages.length : 0;
      if (lp.completedAt) completedLessons += 1;
    });
    return {
      completedStages,
      completedLessons,
      totalStages: runtime.catalog ? runtime.catalog.module.total_stages : 80,
      totalLessons: runtime.catalog ? runtime.catalog.module.total_lessons : 20,
      percent: runtime.catalog ? Math.round((completedStages / runtime.catalog.module.total_stages) * 100) : 0
    };
  }

  async function fetchJson(url){
    const divider = String(url).includes('?') ? '&' : '?';
    const response = await fetch(url + divider + 'v=' + encodeURIComponent(RELEASE), {cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить файл: ' + url + ' (' + response.status + ')');
    return response.json();
  }

  async function ensureCatalog(){
    if (runtime.catalog) return runtime.catalog;
    runtime.catalog = await fetchJson(CATALOG_URL);
    return runtime.catalog;
  }

  async function ensureLesson(lessonId){
    if (runtime.lessons[lessonId]) return runtime.lessons[lessonId];
    runtime.lessons[lessonId] = await fetchJson(LESSON_BASE_URL + encodeURIComponent(lessonId) + '.json');
    return runtime.lessons[lessonId];
  }

  function renderWithAppShell(content, activeTab){
    const wrapped = '<div class="ba-root"><div class="ba-shell">' + content + '</div></div>';
    if (typeof window.shell === 'function') {
      window.shell(wrapped, activeTab || 'home');
    } else {
      const app = document.getElementById('app');
      if (app) app.innerHTML = wrapped;
    }
    scrollTop();
    setTimeout(patchVisibleEntryCards, 0);
  }

  function loadingView(title){
    renderWithAppShell(
      '<div class="ba-card ba-empty"><p class="ba-eyebrow">АРХИТЕКТУРА БИЗНЕСА</p><h2>' + escapeHtml(title || 'Загрузка') + '</h2><p>Подготавливаем структуру и сохранённый прогресс.</p></div>',
      'home'
    );
  }

  function errorView(error){
    console.error('BA_MODULE_ERROR', error);
    renderWithAppShell(
      '<div class="ba-card"><p class="ba-eyebrow">ОШИБКА ЗАГРУЗКИ</p><h2>Модуль временно не открылся</h2>' +
      '<p>' + escapeHtml(error && error.message ? error.message : error) + '</p>' +
      '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.renderHome()">Повторить</button>' +
      '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openAppHome()">На главную</button></div></div>',
      'home'
    );
  }

  function statusLabel(status){
    if (status === 'available') return 'доступно';
    if (status === 'done') return 'завершено';
    return 'в подготовке';
  }

  function renderPart(part, index){
    const progress = loadProgress();
    const completedInPart = part.lessons.filter(function(lesson){
      const lp = progress.lessons && progress.lessons[lesson.id];
      return Boolean(lp && lp.completedAt);
    }).length;
    const openClass = index === 0 ? ' is-open' : '';
    const lessons = part.lessons.map(function(lesson){
      const lp = progress.lessons && progress.lessons[lesson.id];
      const done = Boolean(lp && lp.completedAt);
      const available = lesson.status === 'available';
      const status = done ? 'done' : (available ? 'available' : 'preparing');
      const onclick = available ? ' onclick="BusinessArchitecture.openLesson(\'' + escapeHtml(lesson.id) + '\')"' : ' disabled';
      return '<button class="ba-lesson-row ' + (available ? '' : 'is-locked') + ' ' + (done ? 'is-done' : '') + '"' + onclick + '>' +
        '<span class="ba-lesson-index">' + String(lesson.number).padStart(2,'0') + '</span>' +
        '<span><b>' + escapeHtml(lesson.title) + '</b><small>Глава ' + escapeHtml(lesson.chapter) + ' · 4 этапа</small></span>' +
        '<span class="ba-status ' + (status === 'available' ? 'is-active' : status === 'done' ? 'is-done' : '') + '">' + statusLabel(status) + '</span>' +
      '</button>';
    }).join('');

    return '<section class="ba-part' + openClass + '" data-ba-part="' + escapeHtml(part.id) + '">' +
      '<button class="ba-part-head" onclick="BusinessArchitecture.togglePart(\'' + escapeHtml(part.id) + '\')">' +
        '<span class="ba-part-head-row"><span class="ba-number-chip">' + escapeHtml(part.number) + '</span>' +
        '<span><b>' + escapeHtml(part.title) + '</b><small>' + escapeHtml(part.description) + '<br>' + completedInPart + ' из ' + part.lessons.length + ' уроков завершено</small></span>' +
        '<span class="ba-part-arrow">›</span></span>' +
      '</button>' +
      '<div class="ba-part-body"><div class="ba-lesson-list">' + lessons + '</div>' +
        '<div class="ba-note ba-note-teal" style="margin-top:11px"><b>Результат части:</b> ' + escapeHtml(part.result) + '</div>' +
        '<div class="ba-lesson-row is-locked" style="margin-top:9px"><span class="ba-lesson-index">К</span><span><b>' + escapeHtml(part.integration_case.title) + '</b><small>Связывает решения всех уроков части</small></span><span class="ba-status">в подготовке</span></div>' +
      '</div>' +
    '</section>';
  }

  async function renderHome(){
    try {
      loadingView('Открываем модуль');
      const catalog = await ensureCatalog();
      const info = courseProgressInfo();
      const progress = loadProgress();
      const ba01 = progress.lessons && progress.lessons['BA-01'];
      const ba01Stages = ba01 && Array.isArray(ba01.completedStages) ? ba01.completedStages.length : 0;
      const continueLabel = ba01Stages ? 'Продолжить BA-01' : 'Начать маршрут';

      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openAppHome()">← Главная приложения</button><span class="ba-status is-active">отдельный модуль</span></div>' +
        '<section class="ba-hero">' +
          '<p class="ba-eyebrow">БИЗНЕС КАК СИСТЕМА</p>' +
          '<h1>' + escapeHtml(catalog.module.title) + '</h1>' +
          '<p>' + escapeHtml(catalog.module.subtitle) + '</p>' +
          '<div class="ba-metric-grid">' +
            '<div class="ba-metric"><span>Части</span><b>' + catalog.module.total_parts + '</b></div>' +
            '<div class="ba-metric"><span>Уроки</span><b>' + catalog.module.total_lessons + '</b></div>' +
            '<div class="ba-metric"><span>Этапы</span><b>' + catalog.module.total_stages + '</b></div>' +
            '<div class="ba-metric"><span>Примеры</span><b>' + catalog.module.practical_examples + '</b></div>' +
          '</div>' +
          '<div class="ba-actions">' +
            '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">' + continueLabel + '</button>' +
            '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Практические примеры</button>' +
            '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Моя архитектура</button>' +
            '<button class="ba-btn ba-btn-light" disabled>Книга — готовится</button>' +
          '</div>' +
        '</section>' +

        '<section class="ba-card ba-progress-card">' +
          '<div><p class="ba-eyebrow">ПРОГРЕСС МОДУЛЯ</p><h2>' + info.completedStages + ' из ' + info.totalStages + ' этапов</h2>' +
          '<p>Прогресс хранится отдельно и не изменяет проценты, баллы и завершённые уроки других разделов приложения.</p>' +
          '<div class="ba-progress-bar"><i style="width:' + clamp(info.percent,0,100) + '%"></i></div></div>' +
          '<div class="ba-progress-number">' + info.percent + '%</div>' +
        '</section>' +

        '<section class="ba-card"><p class="ba-eyebrow">ПЕРВЫЙ БЕЗОПАСНЫЙ РЕЛИЗ</p><h2>Сейчас открыт BA-01</h2>' +
          '<p>Остальные 19 уроков показаны в структуре, но остаются в подготовке. Это позволяет проверить новый модуль, не вмешиваясь в остальные части приложения.</p>' +
          '<div class="ba-actions"><button class="ba-btn ba-btn-secondary" onclick="BusinessArchitecture.openLesson(\'BA-01\')">Открыть финансовую реальность и безубыточность</button></div>' +
        '</section>' +

        '<section class="ba-card"><p class="ba-eyebrow">ЛЕСТНИЦА ИЗУЧЕНИЯ</p><h2>4 части · 20 глав книги · 20 уроков</h2>' +
          '<p>Одна глава книги становится одним полноценным уроком. Подразделы главы раскрываются внутри системного разбора, а профессиональные формы становятся практическими примерами.</p>' +
          '<div class="ba-part-list">' + catalog.parts.map(renderPart).join('') + '</div>' +
        '</section>' +

        '<section class="ba-card"><p class="ba-eyebrow">ДВА РЕЖИМА РАБОТЫ</p><h2>Маршрут и справочник</h2>' +
          '<div class="ba-example-list">' +
            '<div class="ba-example-card"><h3>Проходить маршрут</h3><p>Последовательно изучать материал, разбирать примеры, решать сложные кейсы и собирать собственную архитектуру.</p></div>' +
            '<div class="ba-example-card"><h3>Использовать как справочник</h3><p>Открывать библиотеку из 99 специализированных материалов без ожидания открытия будущих уроков.</p></div>' +
          '</div>' +
        '</section><div class="ba-footer-space"></div>';

      renderWithAppShell(html, 'home');
    } catch(error){
      errorView(error);
    }
  }

  function togglePart(partId){
    const node = document.querySelector('[data-ba-part="' + CSS.escape(partId) + '"]');
    if (node) node.classList.toggle('is-open');
  }

  function openAppHome(){
    if (typeof window.renderHome === 'function') return window.renderHome();
    window.location.reload();
  }

  async function continueRoute(){
    try {
      await ensureLesson('BA-01');
      const lp = getLessonProgress('BA-01').lesson;
      const lesson = runtime.lessons['BA-01'];
      const firstIncomplete = lesson.stages.find(function(stage){ return !lp.completedStages.includes(stage.id); });
      if (!firstIncomplete) return renderMyArchitecture();
      return openStage('BA-01', firstIncomplete.id);
    } catch(error){ errorView(error); }
  }

  function lessonStageState(lessonId, stageIndex, stages){
    const lp = getLessonProgress(lessonId).lesson;
    const stage = stages[stageIndex];
    const done = lp.completedStages.includes(stage.id);
    const unlocked = stageIndex === 0 || lp.completedStages.includes(stages[stageIndex - 1].id);
    return {done, unlocked};
  }

  async function openLesson(lessonId){
    try {
      const catalog = await ensureCatalog();
      let meta = null;
      catalog.parts.some(function(part){
        meta = part.lessons.find(function(item){ return item.id === lessonId; }) || null;
        return Boolean(meta);
      });
      if (!meta || meta.status !== 'available') {
        safeAlert('Этот урок находится в подготовке. В первом релизе доступен только BA-01.');
        return;
      }
      loadingView('Открываем урок ' + lessonId);
      const data = await ensureLesson(lessonId);
      runtime.currentLessonId = lessonId;
      const lp = getLessonProgress(lessonId).lesson;
      const completed = lp.completedStages.length;
      const percent = Math.round((completed / data.stages.length) * 100);

      const stageCards = data.stages.map(function(stage, index){
        const state = lessonStageState(lessonId, index, data.stages);
        const cls = state.done ? 'is-done' : (!state.unlocked ? 'is-locked' : '');
        const click = state.unlocked ? ' onclick="BusinessArchitecture.openStage(\'' + lessonId + '\',\'' + stage.id + '\')"' : ' disabled';
        const small = state.done ? 'Завершено' : (state.unlocked ? stage.description : 'Откроется после предыдущего этапа');
        return '<button class="ba-stage-card ' + cls + '"' + click + '><span class="ba-stage-no">ЭТАП ' + (index + 1) + '</span><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(small) + '</small></button>';
      }).join('');

      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К модулю</button><span class="ba-status ' + (lp.completedAt ? 'is-done' : 'is-active') + '">' + (lp.completedAt ? 'урок завершён' : 'урок 1 из 20') + '</span></div>' +
        '<section class="ba-hero">' +
          '<p class="ba-eyebrow">ЧАСТЬ ' + escapeHtml(data.part.number) + ' · ГЛАВА ' + escapeHtml(data.lesson.chapter_number) + '</p>' +
          '<h2>' + escapeHtml(data.lesson.title) + '</h2>' +
          '<p>' + escapeHtml(data.lesson.subtitle) + '</p>' +
          '<div class="ba-metric-grid">' +
            '<div class="ba-metric"><span>Системных экранов</span><b>' + data.stages[0].screen_count + '</b></div>' +
            '<div class="ba-metric"><span>Примеров</span><b>' + data.stages[1].examples.length + '</b></div>' +
            '<div class="ba-metric"><span>Кейсов теста</span><b>' + data.stages[2].question_count + '</b></div>' +
            '<div class="ba-metric"><span>Практических разделов</span><b>' + data.stages[3].sections.length + '</b></div>' +
          '</div>' +
          '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueLesson(\'' + lessonId + '\')">' + (completed ? 'Продолжить урок' : 'Начать системный разбор') + '</button><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Моя архитектура</button></div>' +
        '</section>' +

        '<section class="ba-card ba-progress-card"><div><p class="ba-eyebrow">ПРОГРЕСС УРОКА</p><h2>' + completed + ' из ' + data.stages.length + ' этапов</h2><p>' + escapeHtml(data.lesson.completion_result) + '</p><div class="ba-progress-bar"><i style="width:' + percent + '%"></i></div></div><div class="ba-progress-number">' + percent + '%</div></section>' +

        '<section class="ba-card"><p class="ba-eyebrow">ЦЕЛЬ УРОКА</p><h2>Не просто рассчитать одну формулу</h2><p>' + escapeHtml(data.lesson.purpose) + '</p></section>' +

        '<section class="ba-card"><p class="ba-eyebrow">4 ЭТАПА</p><h2>Изучить → увидеть → взвесить → собрать</h2><div class="ba-stage-grid">' + stageCards + '</div></section>' +

        '<section class="ba-card"><p class="ba-eyebrow">РЕЗУЛЬТАТЫ ОБУЧЕНИЯ</p><h2>После BA-01 пользователь способен</h2><ol class="ba-list">' + data.lesson.learning_outcomes.map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol></section>' +
        '<div class="ba-footer-space"></div>';

      renderWithAppShell(html, 'home');
    } catch(error){ errorView(error); }
  }

  async function continueLesson(lessonId){
    const data = await ensureLesson(lessonId);
    const lp = getLessonProgress(lessonId).lesson;
    const next = data.stages.find(function(stage){ return !lp.completedStages.includes(stage.id); });
    if (!next) return renderMyArchitecture();
    return openStage(lessonId, next.id);
  }

  async function openStage(lessonId, stageId){
    try {
      const data = await ensureLesson(lessonId);
      const index = data.stages.findIndex(function(stage){ return stage.id === stageId; });
      if (index < 0) throw new Error('Этап не найден: ' + stageId);
      const access = lessonStageState(lessonId, index, data.stages);
      if (!access.unlocked) {
        safeAlert('Сначала завершите предыдущий этап.');
        return openLesson(lessonId);
      }
      runtime.currentLessonId = lessonId;
      runtime.currentStageId = stageId;
      updateLessonProgress(lessonId, function(lp){ lp.lastStageId = stageId; });
      if (stageId === 'system_analysis') return renderSystemAnalysis(lessonId);
      if (stageId === 'business_examples') return renderBusinessExamples(lessonId);
      if (stageId === 'decision_lab') return renderQuiz(lessonId);
      if (stageId === 'architecture_assembly') return renderWorkspace(lessonId);
    } catch(error){ errorView(error); }
  }

  function screenExtraHtml(screen){
    let html = '';
    if (Array.isArray(screen.formula_blocks) && screen.formula_blocks.length) {
      html += '<div class="ba-formulas">' + screen.formula_blocks.map(function(item){ return '<div class="ba-formula"><span>' + escapeHtml(item.label) + '</span><b>' + escapeHtml(item.formula) + '</b></div>'; }).join('') + '</div>';
    }
    if (screen.table && Array.isArray(screen.table.headers)) {
      html += '<div class="ba-table-wrap"><table class="ba-table"><thead><tr>' + screen.table.headers.map(function(item){ return '<th>' + escapeHtml(item) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        (screen.table.rows || []).map(function(row){ return '<tr>' + row.map(function(cell){ return '<td>' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>';
    }
    if (Array.isArray(screen.steps) && screen.steps.length) {
      html += '<h3 style="margin-top:16px">Последовательность</h3><ol class="ba-list">' + screen.steps.map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol>';
    }
    if (screen.case) html += '<div class="ba-note ba-note-teal" style="margin-top:14px"><b>Пример:</b> ' + escapeHtml(screen.case) + '</div>';
    if (screen.management_question) html += '<div class="ba-note" style="margin-top:14px"><b>Управленческий вопрос:</b> ' + escapeHtml(screen.management_question) + '</div>';
    if (screen.red_flag) html += '<div class="ba-note ba-note-danger" style="margin-top:14px"><b>Красный сигнал:</b> ' + escapeHtml(screen.red_flag) + '</div>';
    if (Array.isArray(screen.decision_logic) && screen.decision_logic.length) html += '<h3 style="margin-top:16px">Логика решения</h3><ul class="ba-list">' + screen.decision_logic.map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
    if (screen.completion_rule) html += '<div class="ba-note ba-note-teal" style="margin-top:14px"><b>Правило завершения:</b> ' + escapeHtml(screen.completion_rule) + '</div>';
    return html;
  }

  async function renderSystemAnalysis(lessonId, requestedIndex){
    const data = await ensureLesson(lessonId);
    const stage = data.stages.find(function(item){ return item.id === 'system_analysis'; });
    const lp = getLessonProgress(lessonId).lesson;
    const savedIndex = lp.systemAnalysis && Number.isFinite(Number(lp.systemAnalysis.screenIndex)) ? Number(lp.systemAnalysis.screenIndex) : 0;
    runtime.screenIndex = clamp(requestedIndex === undefined ? savedIndex : requestedIndex, 0, stage.screens.length - 1);
    const screen = stage.screens[runtime.screenIndex];
    updateLessonProgress(lessonId, function(item){ item.systemAnalysis.screenIndex = runtime.screenIndex; });

    const prevDisabled = runtime.screenIndex === 0 ? ' disabled' : '';
    const last = runtime.screenIndex === stage.screens.length - 1;
    const nextLabel = last ? (stageDone(lessonId,'system_analysis') ? 'Этап завершён' : 'Завершить системный разбор') : 'Следующий экран →';
    const nextAction = last ? 'BusinessArchitecture.completeSystemAnalysis(\'' + lessonId + '\')' : 'BusinessArchitecture.moveSystemScreen(1)';

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">этап 1 из 4</span></div>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveSystemScreen(-1)"' + prevDisabled + '>← Назад</button><div class="ba-screen-counter">' + (runtime.screenIndex + 1) + ' из ' + stage.screens.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + nextAction + '">' + nextLabel + '</button></div>' +
      '<article class="ba-reading-card"><p class="ba-eyebrow">СИСТЕМНЫЙ РАЗБОР · ' + escapeHtml(screen.type || '') + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
        (screen.content || []).map(function(p){ return '<p>' + escapeHtml(p) + '</p>'; }).join('') + screenExtraHtml(screen) + '</article>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveSystemScreen(-1)"' + prevDisabled + '>← Назад</button><div class="ba-screen-counter">Материал сохраняет позицию автоматически</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + nextAction + '">' + nextLabel + '</button></div>' +
      '<div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }

  function moveSystemScreen(delta){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    if (!lesson) return;
    const stage = lesson.stages.find(function(item){ return item.id === 'system_analysis'; });
    const next = clamp(runtime.screenIndex + Number(delta || 0), 0, stage.screens.length - 1);
    renderSystemAnalysis(lessonId, next);
  }

  function completeSystemAnalysis(lessonId){
    markStageDone(lessonId, 'system_analysis');
    safeAlert('Системный разбор завершён. Открыт этап с практическими примерами.');
    openLesson(lessonId);
  }

  async function renderBusinessExamples(lessonId){
    const data = await ensureLesson(lessonId);
    const stage = data.stages.find(function(item){ return item.id === 'business_examples'; });
    const lp = getLessonProgress(lessonId).lesson;
    const opened = Array.isArray(lp.examplesOpened) ? lp.examplesOpened : [];
    const allOpened = stage.examples.every(function(item){ return opened.includes(item.id); });

    const cards = stage.examples.map(function(item){
      const isOpened = opened.includes(item.id);
      return '<article class="ba-example-card ' + (isOpened ? 'is-opened' : '') + '">' +
        '<div class="ba-example-code">' + escapeHtml(item.id) + (isOpened ? ' · ОТКРЫТ' : '') + '</div><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.purpose) + '</p>' +
        '<div class="ba-example-meta"><div><b>Входные данные</b>' + escapeHtml(item.key_inputs.join(', ')) + '</div><div><b>Результат</b>' + escapeHtml(item.outputs.join(', ')) + '</div><div><b>Владелец и ритм</b>' + escapeHtml(item.owner + ' · ' + item.cadence) + '</div><div><b>Решение</b>' + escapeHtml(item.decision) + '</div></div>' +
        '<div class="ba-actions"><button class="ba-btn ba-btn-secondary ba-btn-small" onclick="BusinessArchitecture.openExample(\'' + lessonId + '\',\'' + item.id + '\')">Открыть полный пример</button></div>' +
      '</article>';
    }).join('');

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">этап 2 из 4</span></div>' +
      '<section class="ba-hero"><p class="ba-eyebrow">КАК ЭТО ВЫГЛЯДИТ В БИЗНЕСЕ</p><h2>Четыре разные финансовые модели</h2><p>Этап не повторяет теорию. Он показывает состав данных, расчёты, владельца, ритм использования и решение для каждого рабочего материала.</p><div class="ba-metric-grid"><div class="ba-metric"><span>Открыто</span><b>' + opened.filter(function(id){ return stage.examples.some(function(e){ return e.id === id; }); }).length + '/4</b></div><div class="ba-metric"><span>Всего в библиотеке</span><b>99</b></div><div class="ba-metric"><span>Формат</span><b>HTML</b></div><div class="ba-metric"><span>Статус</span><b>' + (allOpened ? 'готово' : 'изучение') + '</b></div></div></section>' +
      '<section class="ba-card"><div class="ba-example-list">' + cards + '</div><div class="ba-actions"><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Открыть всю библиотеку 99 примеров</button>' +
        '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeExamples(\'' + lessonId + '\')" ' + (allOpened ? '' : 'disabled') + '>Завершить этап</button></div>' +
        (!allOpened ? '<div class="ba-note" style="margin-top:12px">Для завершения откройте все четыре примера BA-01. Возвращение в приложение не стирает отметки.</div>' : '') +
      '</section><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }

  function examplesPageUrl(anchor){
    const page = runtime.catalog && runtime.catalog.examples ? runtime.catalog.examples.page : 'templates/business-architecture-practical-examples-v2.html';
    const current = String(window.location && window.location.href ? window.location.href : '');
    const base = /^(https?:|file:)/i.test(current) ? current : 'https://lego-business-system.github.io/lego-mini-app/';
    const url = new URL(page, base);
    if (anchor) url.hash = anchor;
    return url.href;
  }

  function openExternal(url){
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.openLink === 'function' && /^https?:/i.test(url)) {
        tg.openLink(url);
        return;
      }
    } catch(e) {}
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openExample(lessonId, exampleId){
    updateLessonProgress(lessonId, function(lp){
      if (!lp.examplesOpened.includes(exampleId)) lp.examplesOpened.push(exampleId);
    });
    openExternal(examplesPageUrl(exampleId));
    setTimeout(function(){
      if (runtime.currentStageId === 'business_examples') renderBusinessExamples(lessonId);
    }, 120);
  }

  async function openExamplesLibrary(){
    try { await ensureCatalog(); }
    catch(e) {}
    openExternal(examplesPageUrl('top'));
  }

  function completeExamples(lessonId){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson && lesson.stages.find(function(item){ return item.id === 'business_examples'; });
    const lp = getLessonProgress(lessonId).lesson;
    const allOpened = stage && stage.examples.every(function(item){ return lp.examplesOpened.includes(item.id); });
    if (!allOpened) {
      safeAlert('Сначала откройте все четыре практических примера.');
      return;
    }
    markStageDone(lessonId, 'business_examples');
    safeAlert('Практические примеры изучены. Открыта лаборатория решений.');
    openLesson(lessonId);
  }

  function ensureQuizDraft(lessonId, questions){
    updateLessonProgress(lessonId, function(lp){
      questions.forEach(function(q){
        if (q.type === 'ordering' && !Array.isArray(lp.quiz.order[q.id])) {
          lp.quiz.order[q.id] = q.items.map(function(_, index){ return index; });
        }
      });
    });
  }

  function answerSingle(questionId, value){
    updateLessonProgress(runtime.currentLessonId, function(lp){ lp.quiz.draft[questionId] = Number(value); });
    renderQuiz(runtime.currentLessonId, runtime.quizIndex);
  }

  function answerMultiple(questionId, value, checked){
    updateLessonProgress(runtime.currentLessonId, function(lp){
      const current = Array.isArray(lp.quiz.draft[questionId]) ? lp.quiz.draft[questionId].slice() : [];
      const numeric = Number(value);
      const pos = current.indexOf(numeric);
      if (checked && pos < 0) current.push(numeric);
      if (!checked && pos >= 0) current.splice(pos, 1);
      lp.quiz.draft[questionId] = current.sort(function(a,b){ return a-b; });
    });
  }

  function answerNumeric(questionId, value){
    updateLessonProgress(runtime.currentLessonId, function(lp){ lp.quiz.draft[questionId] = String(value); });
  }

  function moveOrder(questionId, itemPosition, delta){
    updateLessonProgress(runtime.currentLessonId, function(lp){
      const order = Array.isArray(lp.quiz.order[questionId]) ? lp.quiz.order[questionId].slice() : [];
      const from = Number(itemPosition);
      const to = clamp(from + Number(delta), 0, order.length - 1);
      if (from === to) return;
      const moved = order.splice(from,1)[0];
      order.splice(to,0,moved);
      lp.quiz.order[questionId] = order;
      lp.quiz.draft[questionId] = order;
    });
    renderQuiz(runtime.currentLessonId, runtime.quizIndex);
  }

  function questionAnswered(q, lp){
    const answer = q.type === 'ordering' ? lp.quiz.order[q.id] : lp.quiz.draft[q.id];
    if (q.type === 'multiple') return Array.isArray(answer) && answer.length > 0;
    if (q.type === 'ordering') return Array.isArray(answer) && answer.length === q.items.length;
    if (q.type === 'numeric') return String(answer === undefined ? '' : answer).trim() !== '';
    return answer !== undefined && answer !== null && answer !== '';
  }

  function questionInputHtml(q, lp){
    const answer = q.type === 'ordering' ? lp.quiz.order[q.id] : lp.quiz.draft[q.id];
    if (q.type === 'single') {
      return '<div class="ba-option-list">' + q.options.map(function(option, index){
        return '<label class="ba-option"><input type="radio" name="' + escapeHtml(q.id) + '" ' + (Number(answer) === index ? 'checked' : '') + ' onchange="BusinessArchitecture.answerSingle(\'' + q.id + '\',' + index + ')"><span>' + escapeHtml(option) + '</span></label>';
      }).join('') + '</div>';
    }
    if (q.type === 'multiple') {
      const selected = Array.isArray(answer) ? answer : [];
      return '<div class="ba-option-list">' + q.options.map(function(option, index){
        return '<label class="ba-option"><input type="checkbox" ' + (selected.includes(index) ? 'checked' : '') + ' onchange="BusinessArchitecture.answerMultiple(\'' + q.id + '\',' + index + ',this.checked)"><span>' + escapeHtml(option) + '</span></label>';
      }).join('') + '</div>';
    }
    if (q.type === 'numeric') {
      return '<div style="margin-top:14px"><label class="ba-field-block"><label>Числовой ответ</label><input class="ba-number-input" inputmode="decimal" value="' + escapeHtml(answer || '') + '" oninput="BusinessArchitecture.answerNumeric(\'' + q.id + '\',this.value)"></label></div>';
    }
    if (q.type === 'ordering') {
      const order = Array.isArray(answer) ? answer : q.items.map(function(_,i){ return i; });
      return '<div class="ba-order-list">' + order.map(function(originalIndex, position){
        return '<div class="ba-order-row"><span class="ba-order-index">' + (position + 1) + '</span><span>' + escapeHtml(q.items[originalIndex]) + '</span><span class="ba-order-actions"><button onclick="BusinessArchitecture.moveOrder(\'' + q.id + '\',' + position + ',-1)" ' + (position === 0 ? 'disabled' : '') + '>↑</button><button onclick="BusinessArchitecture.moveOrder(\'' + q.id + '\',' + position + ',1)" ' + (position === order.length - 1 ? 'disabled' : '') + '>↓</button></span></div>';
      }).join('') + '</div>';
    }
    return '';
  }

  async function renderQuiz(lessonId, requestedIndex){
    const data = await ensureLesson(lessonId);
    const stage = data.stages.find(function(item){ return item.id === 'decision_lab'; });
    ensureQuizDraft(lessonId, stage.questions);
    const lp = getLessonProgress(lessonId).lesson;
    if (lp.quiz.lastResult) return renderQuizResult(lessonId);
    runtime.quizIndex = clamp(requestedIndex === undefined ? runtime.quizIndex : requestedIndex, 0, stage.questions.length - 1);
    const q = stage.questions[runtime.quizIndex];
    const answeredCount = stage.questions.filter(function(item){ return questionAnswered(item, lp); }).length;
    const last = runtime.quizIndex === stage.questions.length - 1;

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-warning">этап 3 из 4</span></div>' +
      '<section class="ba-hero"><p class="ba-eyebrow">ЛАБОРАТОРИЯ РЕШЕНИЙ</p><h2>Не на память, а на управленческое мышление</h2><p>Материал урока и практические примеры можно держать открытыми. Неправильные варианты намеренно правдоподобны.</p><div class="ba-metric-grid"><div class="ba-metric"><span>Заданий</span><b>' + stage.question_count + '</b></div><div class="ba-metric"><span>Отвечено</span><b>' + answeredCount + '</b></div><div class="ba-metric"><span>Проходной</span><b>' + stage.pass_score + '%</b></div><div class="ba-metric"><span>Критические</span><b>обяз.</b></div></div></section>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Вопрос ' + (runtime.quizIndex + 1) + ' из ' + stage.questions.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить решение' : 'Следующий →') + '</button></div>' +
      '<article class="ba-question-card"><div class="ba-question-top"><span class="ba-question-skill">' + escapeHtml(q.skill) + '</span>' + (q.critical ? '<span class="ba-critical">КРИТИЧЕСКИЙ</span>' : '') + '</div>' +
        (q.case ? '<div class="ba-case">' + escapeHtml(q.case) + '</div>' : '') +
        '<h2>' + escapeHtml(q.question) + '</h2>' + questionInputHtml(q, lp) + '</article>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Ответы сохраняются локально</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить решение' : 'Следующий →') + '</button></div><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }

  function moveQuiz(delta){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    runtime.quizIndex = clamp(runtime.quizIndex + Number(delta || 0), 0, stage.questions.length - 1);
    renderQuiz(lessonId, runtime.quizIndex);
  }

  function arraysEqual(a,b){
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i=0;i<a.length;i++) if (Number(a[i]) !== Number(b[i])) return false;
    return true;
  }

  function evaluateQuestion(q, lp){
    const answer = q.type === 'ordering' ? lp.quiz.order[q.id] : lp.quiz.draft[q.id];
    if (q.type === 'single') return Number(answer) === Number(q.correct[0]);
    if (q.type === 'multiple') return arraysEqual((answer || []).slice().sort(function(a,b){return a-b;}), (q.correct || []).slice().sort(function(a,b){return a-b;}));
    if (q.type === 'numeric') return Math.abs(Number(String(answer).replace(',','.')) - Number(q.answer)) <= Number(q.tolerance || 0);
    if (q.type === 'ordering') return arraysEqual(answer, q.correct_order);
    return false;
  }

  function submitQuiz(lessonId){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    const lp = getLessonProgress(lessonId).lesson;
    const missing = stage.questions.filter(function(q){ return !questionAnswered(q, lp); });
    if (missing.length) {
      safeAlert('Не отвечено вопросов: ' + missing.length + '. Заполните все задания перед проверкой.');
      runtime.quizIndex = stage.questions.findIndex(function(q){ return missing[0].id === q.id; });
      return renderQuiz(lessonId, runtime.quizIndex);
    }

    const results = stage.questions.map(function(q){ return {id:q.id, correct:evaluateQuestion(q,lp), critical:Boolean(q.critical)}; });
    const correctCount = results.filter(function(r){ return r.correct; }).length;
    const score = Math.round((correctCount / results.length) * 100);
    const criticalPassed = results.filter(function(r){ return r.critical; }).every(function(r){ return r.correct; });
    const passed = score >= stage.pass_score && criticalPassed;
    const attempt = {at:nowIso(), score, correctCount, total:results.length, criticalPassed, passed, results};

    updateLessonProgress(lessonId, function(item){
      item.quiz.attempts.push(attempt);
      item.quiz.lastResult = attempt;
      if (passed && !item.completedStages.includes('decision_lab')) item.completedStages.push('decision_lab');
    });
    renderQuizResult(lessonId);
  }

  function answerDisplay(q, lp){
    const answer = q.type === 'ordering' ? lp.quiz.order[q.id] : lp.quiz.draft[q.id];
    if (q.type === 'single') return q.options[Number(answer)] || '—';
    if (q.type === 'multiple') return (answer || []).map(function(i){ return q.options[i]; }).join('; ') || '—';
    if (q.type === 'numeric') return String(answer || '—');
    if (q.type === 'ordering') return (answer || []).map(function(i,position){ return (position+1) + '. ' + q.items[i]; }).join(' ');
    return '—';
  }

  function renderQuizResult(lessonId){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    const lp = getLessonProgress(lessonId).lesson;
    const result = lp.quiz.lastResult;
    if (!result) return renderQuiz(lessonId,0);

    const reviews = stage.questions.map(function(q){
      const r = result.results.find(function(item){ return item.id === q.id; });
      return '<details class="ba-review-item ' + (r && r.correct ? 'is-correct' : 'is-wrong') + '"><summary>' + (r && r.correct ? 'Верно' : 'Нужно пересмотреть') + ' · ' + escapeHtml(q.id) + ' · ' + escapeHtml(q.skill) + '</summary><div class="ba-review-body"><b>Вопрос:</b> ' + escapeHtml(q.question) + '<br><br><b>Ваш ответ:</b> ' + escapeHtml(answerDisplay(q,lp)) + '<br><br><b>Разбор:</b> ' + escapeHtml(q.explanation || '') + '</div></details>';
    }).join('');

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status ' + (result.passed ? 'is-done' : 'is-warning') + '">' + (result.passed ? 'этап пройден' : 'нужна повторная попытка') + '</span></div>' +
      '<section class="ba-card"><p class="ba-eyebrow">РЕЗУЛЬТАТ ЛАБОРАТОРИИ</p><h2>' + (result.passed ? 'Управленческая логика подтверждена' : 'Результат пока не проходит ворота') + '</h2><div class="ba-result-summary" style="margin-top:14px"><div class="ba-result-box"><span>Результат</span><b>' + result.score + '%</b></div><div class="ba-result-box"><span>Верно</span><b>' + result.correctCount + '/' + result.total + '</b></div><div class="ba-result-box"><span>Критические</span><b>' + (result.criticalPassed ? 'пройдены' : 'ошибка') + '</b></div></div>' +
        '<div class="ba-note ' + (result.passed ? 'ba-note-teal' : 'ba-note-danger') + '" style="margin-top:13px">' + (result.passed ? 'Открыта практическая сборка архитектуры.' : 'Для прохождения нужно не менее ' + stage.pass_score + '% и правильное решение всех критических вопросов.') + '</div>' +
        '<div class="ba-actions">' + (result.passed ? '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.openStage(\'' + lessonId + '\',\'architecture_assembly\')">Перейти к сборке</button>' : '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.restartQuiz(\'' + lessonId + '\')">Новая попытка</button>') + '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">К уроку</button></div>' +
      '</section>' +
      '<section class="ba-card"><p class="ba-eyebrow">ПОДРОБНЫЙ РАЗБОР</p><h2>Почему варианты выглядят правдоподобно</h2><p>Раскройте задания. Объяснение показывает не только правильный ответ, но и ошибку порядка, данных, мощности, денег или риска.</p>' + reviews + '</section><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }

  function restartQuiz(lessonId){
    updateLessonProgress(lessonId, function(lp){ lp.quiz.draft = {}; lp.quiz.order = {}; lp.quiz.lastResult = null; });
    runtime.quizIndex = 0;
    renderQuiz(lessonId,0);
  }

  function routeInfo(routeId){
    const map = {
      real_business: {title:'Мой действующий бизнес', rule:'Использовать закрытый фактический период и указывать источник каждого числа.'},
      designed_business: {title:'Проектируемый бизнес', rule:'Отделять подтверждённые факты рынка от допущений модели и задавать диапазоны.'},
      training_case: {title:'Учебный кейс «Ритм»', rule:'Использовать данные кейса и явно обосновывать недостающие допущения.'}
    };
    return map[routeId] || null;
  }

  function chooseWorkspaceRoute(lessonId, routeId){
    updateLessonProgress(lessonId, function(lp, progress){ lp.workspace.route = routeId; progress.selectedRoute = routeId; });
    renderWorkspace(lessonId,0);
  }

  function workspaceSectionData(lp, sectionId){
    if (!lp.workspace.sections[sectionId]) lp.workspace.sections[sectionId] = {fields:{}, evidence:''};
    if (!lp.workspace.sections[sectionId].fields) lp.workspace.sections[sectionId].fields = {};
    return lp.workspace.sections[sectionId];
  }

  function updateWorkspaceField(lessonId, sectionId, fieldIndex, value){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const section = stage.sections.find(function(item){ return item.id === sectionId; });
    const field = section.required_fields[Number(fieldIndex)];
    updateLessonProgress(lessonId, function(lp){ workspaceSectionData(lp, sectionId).fields[field] = String(value); });
    const saved = document.querySelector('[data-ba-saved]');
    if (saved) saved.textContent = 'Сохранено';
  }

  function updateWorkspaceEvidence(lessonId, sectionId, value){
    updateLessonProgress(lessonId, function(lp){ workspaceSectionData(lp, sectionId).evidence = String(value); });
    const saved = document.querySelector('[data-ba-saved]');
    if (saved) saved.textContent = 'Сохранено';
  }

  function updateWorkspaceFinal(lessonId, key, value){
    updateLessonProgress(lessonId, function(lp){ lp.workspace.final[key] = String(value); });
    const saved = document.querySelector('[data-ba-saved]');
    if (saved) saved.textContent = 'Сохранено';
  }

  function sectionCompleteness(lp, section){
    const data = workspaceSectionData(lp, section.id);
    const filled = section.required_fields.filter(function(field){ return String(data.fields[field] || '').trim(); }).length + (String(data.evidence || '').trim() ? 1 : 0);
    const total = section.required_fields.length + 1;
    return {filled, total, percent:Math.round((filled/total)*100)};
  }

  function workspaceCompleteness(lp, stage){
    let filled = 0;
    let total = 0;
    stage.sections.forEach(function(section){
      const info = sectionCompleteness(lp, section);
      filled += info.filled;
      total += info.total;
    });
    const finalKeys = ['fact_or_assumption','conclusion','decision_now','decision_later','metric','review_date','material_note'];
    finalKeys.forEach(function(key){ total += 1; if (String(lp.workspace.final[key] || '').trim()) filled += 1; });
    return {filled, total, percent:Math.round((filled/total)*100), complete:filled === total};
  }

  async function renderWorkspace(lessonId, requestedIndex){
    const lesson = await ensureLesson(lessonId);
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const lp = getLessonProgress(lessonId).lesson;
    runtime.workspaceSectionIndex = clamp(requestedIndex === undefined ? Number(lp.workspace.sectionIndex || 0) : requestedIndex, 0, stage.sections.length);
    updateLessonProgress(lessonId, function(item){ item.workspace.sectionIndex = runtime.workspaceSectionIndex; });

    if (!lp.workspace.route) {
      const routes = stage.routes.map(function(route){
        return '<button class="ba-route-card" onclick="BusinessArchitecture.chooseWorkspaceRoute(\'' + lessonId + '\',\'' + route.id + '\')"><b>' + escapeHtml(route.title) + '</b><p>' + escapeHtml(route.rule) + '</p></button>';
      }).join('');
      const html = '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">этап 4 из 4</span></div>' +
        '<section class="ba-hero"><p class="ba-eyebrow">СБОРКА АРХИТЕКТУРЫ</p><h2>Выберите контекст применения</h2><p>Требования к глубине одинаковы. Меняется только источник данных: факт, проектные допущения или учебный кейс.</p></section>' +
        '<section class="ba-card"><div class="ba-route-list">' + routes + '</div></section><div class="ba-footer-space"></div>';
      return renderWithAppShell(html,'home');
    }

    if (runtime.workspaceSectionIndex >= stage.sections.length) return renderWorkspaceFinal(lessonId);

    const section = stage.sections[runtime.workspaceSectionIndex];
    const data = workspaceSectionData(lp, section.id);
    const complete = sectionCompleteness(lp, section);
    const overall = workspaceCompleteness(lp, stage);
    const route = routeInfo(lp.workspace.route);

    const fields = section.required_fields.map(function(field, index){
      return '<div class="ba-field-block"><label>' + escapeHtml(field) + '</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceField(\'' + lessonId + '\',\'' + section.id + '\',' + index + ',this.value)">' + escapeHtml(data.fields[field] || '') + '</textarea></div>';
    }).join('');

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">этап 4 из 4</span></div>' +
      '<section class="ba-card"><div class="ba-workspace-head"><div><p class="ba-eyebrow">МОЯ АРХИТЕКТУРА · ' + escapeHtml(route.title) + '</p><h2>' + escapeHtml(section.title) + '</h2><p>' + escapeHtml(route.rule) + '</p></div><b class="ba-progress-number">' + complete.percent + '%</b></div><div class="ba-progress-bar"><i style="width:' + complete.percent + '%"></i></div></section>' +
      '<section class="ba-card"><div class="ba-workspace-fields">' + fields + '<div class="ba-field-block"><label>Доказательство завершения</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceEvidence(\'' + lessonId + '\',\'' + section.id + '\',this.value)">' + escapeHtml(data.evidence || '') + '</textarea><span class="ba-field-hint">Критерий: ' + escapeHtml(section.completion_evidence) + '</span></div></div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Сохраняется локально</span><b>' + overall.filled + '/' + overall.total + '</b></div></section>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveWorkspace(-1)" ' + (runtime.workspaceSectionIndex === 0 ? 'disabled' : '') + '>← Предыдущий раздел</button><div class="ba-screen-counter">Раздел ' + (runtime.workspaceSectionIndex + 1) + ' из ' + stage.sections.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="BusinessArchitecture.moveWorkspace(1)">' + (runtime.workspaceSectionIndex === stage.sections.length - 1 ? 'К итоговому решению →' : 'Следующий раздел →') + '</button></div><div class="ba-footer-space"></div>';
    renderWithAppShell(html,'home');
  }

  function moveWorkspace(delta){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    runtime.workspaceSectionIndex = clamp(runtime.workspaceSectionIndex + Number(delta || 0), 0, stage.sections.length);
    renderWorkspace(lessonId, runtime.workspaceSectionIndex);
  }

  function renderWorkspaceFinal(lessonId){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const lp = getLessonProgress(lessonId).lesson;
    const info = workspaceCompleteness(lp, stage);
    const final = lp.workspace.final || {};
    const fields = [
      ['fact_or_assumption','Подтверждённый факт или явное допущение'],
      ['conclusion','Главный финансовый вывод'],
      ['decision_now','Решение, которое принимается сейчас'],
      ['decision_later','Решение, которое откладывается'],
      ['metric','Контрольная метрика'],
      ['review_date','Дата повторной проверки'],
      ['material_note','Рабочий материал: название, ссылка или описание файла']
    ];
    const form = fields.map(function(row){ return '<div class="ba-field-block"><label>' + escapeHtml(row[1]) + '</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceFinal(\'' + lessonId + '\',\'' + row[0] + '\',this.value)">' + escapeHtml(final[row[0]] || '') + '</textarea></div>'; }).join('');

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderWorkspace(\'' + lessonId + '\',' + (stage.sections.length - 1) + ')">← К разделам</button><span class="ba-status ' + (info.complete ? 'is-done' : 'is-warning') + '">' + info.percent + '% заполнено</span></div>' +
      '<section class="ba-hero"><p class="ba-eyebrow">ИТОГ BA-01</p><h2>Финансово-стратегический паспорт</h2><p>Практика завершается не загрузкой файла, а зафиксированным фактом, выводом, решением, метрикой и датой повторной проверки.</p><div class="ba-metric-grid"><div class="ba-metric"><span>Заполнено</span><b>' + info.filled + '/' + info.total + '</b></div><div class="ba-metric"><span>Разделов</span><b>' + stage.sections.length + '</b></div><div class="ba-metric"><span>Режим</span><b>' + escapeHtml(routeInfo(lp.workspace.route).title) + '</b></div><div class="ba-metric"><span>Готовность</span><b>' + info.percent + '%</b></div></div></section>' +
      '<section class="ba-card"><div class="ba-workspace-fields">' + form + '</div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Сохраняется локально</span><b>' + info.percent + '%</b></div><div class="ba-actions"><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.exportWorkspace(\'' + lessonId + '\')">Скачать результат JSON</button><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeWorkspace(\'' + lessonId + '\')" ' + (info.complete ? '' : 'disabled') + '>Завершить BA-01</button></div>' +
      (!info.complete ? '<div class="ba-note" style="margin-top:13px">Для завершения заполните все поля девяти разделов, доказательства и итоговое решение.</div>' : '') + '</section><div class="ba-footer-space"></div>';
    renderWithAppShell(html,'home');
  }

  function completeWorkspace(lessonId){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const bundle = getLessonProgress(lessonId);
    const info = workspaceCompleteness(bundle.lesson, stage);
    if (!info.complete) {
      safeAlert('Практическая работа заполнена не полностью.');
      return;
    }
    updateLessonProgress(lessonId, function(lp){
      lp.workspace.completedAt = lp.workspace.completedAt || nowIso();
      if (!lp.completedStages.includes('architecture_assembly')) lp.completedStages.push('architecture_assembly');
      lp.completedAt = lp.completedAt || nowIso();
    });
    safeAlert('BA-01 завершён. Финансово-стратегический паспорт сохранён в разделе «Моя архитектура».');
    renderMyArchitecture();
  }

  function exportWorkspace(lessonId){
    const bundle = getLessonProgress(lessonId);
    const payload = {
      exportedAt: nowIso(),
      release: RELEASE,
      lessonId,
      selectedRoute: bundle.lesson.workspace.route,
      workspace: bundle.lesson.workspace,
      completedStages: bundle.lesson.completedStages
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lessonId + '-my-business-architecture.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },500);
  }

  async function renderMyArchitecture(){
    try {
      await ensureCatalog();
      const lesson = await ensureLesson('BA-01');
      const lp = getLessonProgress('BA-01').lesson;
      const stage4 = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
      const info = workspaceCompleteness(lp, stage4);
      const route = lp.workspace.route ? routeInfo(lp.workspace.route) : null;
      const sections = stage4.sections.map(function(section, index){
        const c = sectionCompleteness(lp, section);
        return '<button class="ba-lesson-row ' + (c.percent === 100 ? 'is-done' : '') + '" onclick="BusinessArchitecture.renderWorkspace(\'BA-01\',' + index + ')"><span class="ba-lesson-index">' + (index+1) + '</span><span><b>' + escapeHtml(section.title) + '</b><small>' + c.filled + ' из ' + c.total + ' полей</small></span><span class="ba-status ' + (c.percent === 100 ? 'is-done' : '') + '">' + c.percent + '%</span></button>';
      }).join('');

      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К модулю</button><span class="ba-status ' + (lp.completedAt ? 'is-done' : 'is-active') + '">' + (lp.completedAt ? 'BA-01 завершён' : 'в работе') + '</span></div>' +
        '<section class="ba-hero"><p class="ba-eyebrow">МОЯ АРХИТЕКТУРА</p><h2>Финансово-стратегический паспорт</h2><p>Здесь накапливается не отметка о просмотре, а рабочая версия вашей бизнес-системы.</p><div class="ba-metric-grid"><div class="ba-metric"><span>Этапы BA-01</span><b>' + lp.completedStages.length + '/4</b></div><div class="ba-metric"><span>Практика</span><b>' + info.percent + '%</b></div><div class="ba-metric"><span>Режим</span><b>' + escapeHtml(route ? route.title : 'не выбран') + '</b></div><div class="ba-metric"><span>Статус</span><b>' + (lp.completedAt ? 'готово' : 'сборка') + '</b></div></div><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.renderWorkspace(\'BA-01\')">Продолжить сборку</button><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.exportWorkspace(\'BA-01\')">Скачать JSON</button></div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">9 РАЗДЕЛОВ</p><h2>Степень готовности</h2><div class="ba-lesson-list">' + sections + '</div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">СЛЕДУЮЩИЙ УРОВЕНЬ</p><h2>Остальные элементы будут добавляться по урокам</h2><p>Стратегия, поток ценности, процессы, люди, данные, риски, капитал, рост и контрольная карта появятся после подготовки соответствующих уроков BA-02 — BA-20.</p></section><div class="ba-footer-space"></div>';
      renderWithAppShell(html,'home');
    } catch(error){ errorView(error); }
  }

  function patchPrimaryRoutes(){
    const original = window.primaryRoutesHtmlV40;
    if (typeof original !== 'function' || original.__businessArchitectureV1) return;
    const wrapped = function(){
      const raw = original.apply(this, arguments);
      try {
        const template = document.createElement('template');
        template.innerHTML = String(raw || '');
        template.content.querySelectorAll('button').forEach(patchEntryButton);
        return template.innerHTML;
      } catch(e){
        return String(raw || '')
          .replace(/Нет своего бизнеса/g,'Бизнес как система')
          .replace(/Системы подготовки к запуску:[^<]*/g,'Универсальный маршрут по книге «Архитектура бизнеса»: 4 части, 20 уроков и итоговая карта бизнес-системы.')
          .replace(/Подготовка к запуску и базовое предпринимательское мышление\./g,'Универсальный маршрут по книге «Архитектура бизнеса»: 4 части, 20 уроков и итоговая карта бизнес-системы.');
      }
    };
    wrapped.__businessArchitectureV1 = true;
    window.primaryRoutesHtmlV40 = wrapped;
    try { primaryRoutesHtmlV40 = wrapped; } catch(e) {}
  }

  function patchEntryButton(button){
    if (!button || typeof button.querySelector !== 'function') return;
    const titleNode = button.querySelector('b');
    const title = titleNode ? String(titleNode.textContent || '').trim() : '';
    if (title !== 'Нет своего бизнеса' && title !== 'Бизнес как система') return;

    const desiredDescription = 'Универсальный маршрут по книге «Архитектура бизнеса»: 4 части, 20 уроков, практические модели и итоговая карта бизнес-системы.';
    const desiredOnclick = "if(typeof closeAppDrawerV40==='function'){closeAppDrawerV40();} BusinessArchitecture.renderHome()";
    const description = button.querySelector('p');
    const status = button.querySelector('em, small');
    const arrow = button.querySelector('.app-drawer-arrow-v40');
    const alreadyCorrect =
      title === 'Бизнес как система' &&
      (!description || String(description.textContent || '') === desiredDescription) &&
      (!status || String(status.textContent || '').trim() === 'доступно') &&
      !button.disabled &&
      !button.hasAttribute('disabled') &&
      !button.classList.contains('soon') &&
      !button.classList.contains('disabled') &&
      !button.classList.contains('student-locked-v41') &&
      !button.classList.contains('student-block-locked-v41') &&
      button.classList.contains('active') &&
      button.classList.contains('ba-entry-card') &&
      String(button.getAttribute('onclick') || '') === desiredOnclick &&
      (!arrow || String(arrow.textContent || '') === '›');
    if (alreadyCorrect) return;

    if (titleNode && title !== 'Бизнес как система') titleNode.textContent = 'Бизнес как система';
    if (description && String(description.textContent || '') !== desiredDescription) description.textContent = desiredDescription;
    if (status && String(status.textContent || '').trim() !== 'доступно') status.textContent = 'доступно';
    if (button.disabled) button.disabled = false;
    if (button.hasAttribute('disabled')) button.removeAttribute('disabled');
    if (button.getAttribute('aria-disabled') !== 'false') button.setAttribute('aria-disabled','false');
    button.classList.remove('soon','disabled','student-locked-v41','student-block-locked-v41');
    if (!button.classList.contains('active')) button.classList.add('active');
    if (!button.classList.contains('ba-entry-card')) button.classList.add('ba-entry-card');
    if (String(button.getAttribute('onclick') || '') !== desiredOnclick) button.setAttribute('onclick', desiredOnclick);
    if (arrow && String(arrow.textContent || '') !== '›') arrow.textContent = '›';
  }

  function patchVisibleEntryCards(){
    try { document.querySelectorAll('button').forEach(patchEntryButton); }
    catch(e) {}
  }

  function patchDrawerItems(){
    const original = window.drawerItemsV40;
    if (typeof original !== 'function' || original.__businessArchitectureV1) return;
    const wrapped = function(){
      const items = original.apply(this, arguments) || [];
      return items.map(function(item){
        if (item && String(item.title || '').trim() === 'Нет своего бизнеса') {
          return Object.assign({}, item, {title:'Бизнес как система', status:'доступно', action:'BusinessArchitecture.renderHome()'});
        }
        return item;
      });
    };
    wrapped.__businessArchitectureV1 = true;
    window.drawerItemsV40 = wrapped;
    try { drawerItemsV40 = wrapped; } catch(e) {}
  }

  function removeOldStudentLock(){
    try {
      const locks = window.studentLockedBlocksV41;
      if (!Array.isArray(locks)) return;
      for (let i = locks.length - 1; i >= 0; i--) {
        if (String(locks[i] || '').trim() === 'Нет своего бизнеса') locks.splice(i,1);
      }
    } catch(e) {}
  }

  function patchLocking(){
    const original = window.lockDrawerItemsV41;
    if (typeof original === 'function' && !original.__businessArchitectureV1) {
      const wrapped = function(){
        const result = original.apply(this, arguments);
        patchVisibleEntryCards();
        setTimeout(patchVisibleEntryCards,0);
        return result;
      };
      wrapped.__businessArchitectureV1 = true;
      window.lockDrawerItemsV41 = wrapped;
    }
  }

  function patchShell(){
    const original = window.shell;
    if (typeof original !== 'function' || original.__businessArchitectureV1) return;
    const wrapped = function(content, activeTab){
      const result = original.apply(this, arguments);
      patchVisibleEntryCards();
      setTimeout(patchVisibleEntryCards,0);
      setTimeout(patchVisibleEntryCards,80);
      setTimeout(patchVisibleEntryCards,220);
      return result;
    };
    wrapped.__businessArchitectureV1 = true;
    window.shell = wrapped;
    try { shell = wrapped; } catch(e) {}
  }

  function installMutationObserver(){
    if (runtime.mutationObserver || typeof MutationObserver !== 'function') return;
    runtime.mutationObserver = new MutationObserver(function(mutations){
      let relevant = false;
      mutations.forEach(function(m){ if (m.type === 'childList' || m.type === 'attributes') relevant = true; });
      if (relevant) patchVisibleEntryCards();
    });
    runtime.mutationObserver.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled','class','onclick']});
  }

  function installIntegration(){
    if (runtime.integrationInstalled) return;
    runtime.integrationInstalled = true;
    removeOldStudentLock();
    patchPrimaryRoutes();
    patchDrawerItems();
    patchLocking();
    patchShell();
    window.renderNoBusinessV40 = renderHome;
    try { renderNoBusinessV40 = renderHome; } catch(e) {}
    installMutationObserver();
    patchVisibleEntryCards();
    setTimeout(patchVisibleEntryCards,0);
    setTimeout(patchVisibleEntryCards,250);
  }

  const api = {
    version: RELEASE,
    renderHome,
    openAppHome,
    togglePart,
    continueRoute,
    openLesson,
    continueLesson,
    openStage,
    renderSystemAnalysis,
    moveSystemScreen,
    completeSystemAnalysis,
    renderBusinessExamples,
    openExample,
    openExamplesLibrary,
    completeExamples,
    renderQuiz,
    moveQuiz,
    answerSingle,
    answerMultiple,
    answerNumeric,
    moveOrder,
    submitQuiz,
    restartQuiz,
    chooseWorkspaceRoute,
    renderWorkspace,
    moveWorkspace,
    updateWorkspaceField,
    updateWorkspaceEvidence,
    updateWorkspaceFinal,
    completeWorkspace,
    exportWorkspace,
    renderMyArchitecture,
    installIntegration,
    getProgress: loadProgress
  };

  window.BusinessArchitecture = api;
  installIntegration();
})();
