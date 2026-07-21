/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — отдельный учебный контур
   Интерфейс и данные этого раздела изолированы от других
   уроков, форума, профиля и общего прогресса приложения.
   ========================================================= */
(function(){
  'use strict';

  const RELEASE = 'ba-v2-20260721';
  const STORAGE_KEY = 'architecture_business_progress_v2';
  const CATALOG_URL = 'content/business_architecture/catalog.json';
  const LESSON_BASE_URL = 'content/business_architecture/lessons/';
  const EXAMPLES_URL = 'content/business_architecture/examples.json';

  const runtime = {
    catalog: null,
    examples: null,
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


  async function ensureExamples(){
    if (runtime.examples) return runtime.examples;
    runtime.examples = await fetchJson(EXAMPLES_URL);
    return runtime.examples;
  }

  function lessonNumber(lessonId){
    const match = String(lessonId || '').match(/(\d+)$/);
    return match ? Number(match[1]) : 1;
  }

  function hasWorkspaceContent(lp){
    if (!lp || !lp.workspace) return false;
    if (lp.workspace.route) return true;
    if (lp.workspace.final && Object.keys(lp.workspace.final).some(function(key){ return String(lp.workspace.final[key] || '').trim(); })) return true;
    return Object.keys(lp.workspace.sections || {}).some(function(id){
      const section = lp.workspace.sections[id] || {};
      if (String(section.evidence || '').trim()) return true;
      return Object.keys(section.fields || {}).some(function(key){ return String(section.fields[key] || '').trim(); });
    });
  }

  function workspaceUnlocked(lessonId){
    const lp = getLessonProgress(lessonId).lesson;
    return stageDone(lessonId, 'decision_lab') || hasWorkspaceContent(lp) || stageDone(lessonId, 'architecture_assembly');
  }

  function renderWithAppShell(content, activeTab, options){
    const opts = options || {};
    const savedY = window.scrollY || 0;
    const wrapped = '<div class="ba-root"><div class="ba-shell">' + content + '</div></div>';
    if (typeof window.shell === 'function') {
      window.shell(wrapped, activeTab || 'home');
    } else {
      const app = document.getElementById('app');
      if (app) app.innerHTML = wrapped;
    }
    if (opts.preserveScroll) {
      requestAnimationFrame(function(){ window.scrollTo(0, savedY); });
    } else if (opts.target) {
      setTimeout(function(){
        const node = document.querySelector(opts.target);
        if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({block:'start', behavior:opts.smooth ? 'smooth' : 'auto'});
      }, 0);
    } else {
      scrollTop();
    }
    setTimeout(patchVisibleEntryCards, 0);
  }
  function loadingView(title){
    renderWithAppShell(
      '<div class="ba-card ba-empty"><p class="ba-eyebrow">АРХИТЕКТУРА БИЗНЕСА</p><h2>' + escapeHtml(title || 'Загрузка') + '</h2><p>Открываем материалы и сохранённое место.</p></div>',
      'home'
    );
  }

  function errorView(error){
    console.error('BA_MODULE_ERROR', error);
    renderWithAppShell(
      '<div class="ba-card"><p class="ba-eyebrow">ОШИБКА ЗАГРУЗКИ</p><h2>Раздел временно не открылся</h2>' +
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
    const visibleLessons = part.lessons.filter(function(lesson){
      const lp = progress.lessons && progress.lessons[lesson.id];
      return lesson.status === 'available' || Boolean(lp && (lp.completedAt || (lp.completedStages || []).length));
    });
    if (!visibleLessons.length) return '';
    const lessons = visibleLessons.map(function(lesson){
      const lp = progress.lessons && progress.lessons[lesson.id];
      const done = Boolean(lp && lp.completedAt);
      return '<button class="ba-lesson-row ' + (done ? 'is-done' : '') + '" onclick="BusinessArchitecture.openLesson(\'' + escapeHtml(lesson.id) + '\')">' +
        '<span class="ba-lesson-index">' + String(lesson.number).padStart(2,'0') + '</span>' +
        '<span><b>' + escapeHtml(lesson.title) + '</b><small>Урок ' + escapeHtml(lesson.number) + ' · четыре раздела</small></span>' +
        '<span class="ba-row-arrow">›</span>' +
      '</button>';
    }).join('');
    return '<section class="ba-part is-open" data-ba-part="' + escapeHtml(part.id) + '">' +
      '<div class="ba-part-head ba-part-head-static"><span class="ba-part-head-row"><span class="ba-number-chip">' + escapeHtml(part.number) + '</span>' +
        '<span><b>' + escapeHtml(part.title) + '</b><small>' + escapeHtml(part.description) + '</small></span></span></div>' +
      '<div class="ba-part-body"><div class="ba-lesson-list">' + lessons + '</div></div>' +
    '</section>';
  }
  async function renderHome(){
    try {
      loadingView('Открываем курс');
      const catalog = await ensureCatalog();
      const progress = loadProgress();
      const lp = getLessonProgress('BA-01').lesson;
      const completed = Array.isArray(lp.completedStages) ? lp.completedStages.length : 0;
      const currentStage = ['system_analysis','business_examples','decision_lab','architecture_assembly'].find(function(id){ return !lp.completedStages.includes(id); }) || 'architecture_assembly';
      const stageLabels = {
        system_analysis:'Финансовая система',
        business_examples:'Практические материалы',
        decision_lab:'Управленческие задачи',
        architecture_assembly:'Мой финансовый контур'
      };
      const materialsButton = workspaceUnlocked('BA-01')
        ? '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Мои материалы</button>'
        : '';
      const visibleParts = catalog.parts.map(renderPart).filter(Boolean).join('');
      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openAppHome()">← Главная</button></div>' +
        '<section class="ba-hero ba-hero-compact">' +
          '<p class="ba-eyebrow">БИЗНЕС КАК СИСТЕМА</p>' +
          '<h1>' + escapeHtml(catalog.module.title) + '</h1>' +
          '<p>Пошаговый курс о том, как связать деньги, стратегию, процессы, людей, риски и рост в единую управляемую систему.</p>' +
          '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">' + (completed ? 'Продолжить обучение' : 'Начать обучение') + '</button>' +
          '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Практические материалы</button>' + materialsButton + '</div>' +
        '</section>' +
        (completed ? '<section class="ba-card ba-course-progress"><div><p class="ba-eyebrow">ВАШ ПРОГРЕСС</p><h2>' + escapeHtml(stageLabels[currentStage]) + '</h2><p>Пройдено ' + completed + ' из 4 разделов первого урока.</p><div class="ba-progress-bar"><i style="width:' + Math.round((completed/4)*100) + '%"></i></div></div></section>' : '') +
        '<section class="ba-card"><p class="ba-eyebrow">НАЧАЛО КУРСА</p><h2>Финансовая и стратегическая основа</h2><p>Начните с финансовой реальности бизнеса: прибыли, денег, обязательств, безубыточности и доступной мощности.</p><div class="ba-part-list">' + visibleParts + '</div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">КАК ПРОХОДИТ ОБУЧЕНИЕ</p><div class="ba-step-strip">' +
          '<div><b>1</b><span>Разобрать систему</span></div><div><b>2</b><span>Посмотреть рабочие материалы</span></div><div><b>3</b><span>Принять решения по кейсам</span></div><div><b>4</b><span>Собрать свой финансовый контур</span></div>' +
        '</div></section><div class="ba-footer-space"></div>';
      renderWithAppShell(html, 'home');
    } catch(error){ errorView(error); }
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
        safeAlert('Этот урок появится позднее.');
        return;
      }
      loadingView('Открываем урок');
      const data = await ensureLesson(lessonId);
      runtime.currentLessonId = lessonId;
      const lp = getLessonProgress(lessonId).lesson;
      const completed = lp.completedStages.length;
      const percent = Math.round((completed / data.stages.length) * 100);
      const stageCards = data.stages.map(function(stage, index){
        const state = lessonStageState(lessonId, index, data.stages);
        const cls = state.done ? 'is-done' : (!state.unlocked ? 'is-locked' : '');
        const click = state.unlocked ? ' onclick="BusinessArchitecture.openStage(\'' + lessonId + '\',\'' + stage.id + '\')"' : ' disabled';
        const small = state.done ? 'Завершено' : (state.unlocked ? stage.description : 'Откроется после предыдущего раздела');
        return '<button class="ba-stage-card ' + cls + '"' + click + '><span class="ba-stage-no">РАЗДЕЛ ' + (index + 1) + '</span><b>' + escapeHtml(stage.title) + '</b><small>' + escapeHtml(small) + '</small></button>';
      }).join('');
      const materialsButton = workspaceUnlocked(lessonId)
        ? '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Мои материалы</button>'
        : '';
      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button><span class="ba-status ' + (lp.completedAt ? 'is-done' : 'is-active') + '">' + (lp.completedAt ? 'Урок завершён' : 'Урок ' + lessonNumber(lessonId)) + '</span></div>' +
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ЧАСТЬ ' + escapeHtml(data.part.number) + ' · ГЛАВА ' + escapeHtml(data.lesson.chapter_number) + '</p><h2>' + escapeHtml(data.lesson.title) + '</h2><p>' + escapeHtml(data.lesson.subtitle) + '</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueLesson(\'' + lessonId + '\')">' + (completed ? 'Продолжить' : 'Начать урок') + '</button>' + materialsButton + '</div></section>' +
        '<section class="ba-card ba-progress-card"><div><p class="ba-eyebrow">ПРОГРЕСС УРОКА</p><h2>' + completed + ' из ' + data.stages.length + ' разделов</h2><div class="ba-progress-bar"><i style="width:' + percent + '%"></i></div></div><div class="ba-progress-number">' + percent + '%</div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">ЧТО ДАСТ ЭТОТ УРОК</p><p>' + escapeHtml(data.lesson.purpose) + '</p></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">СОДЕРЖАНИЕ</p><div class="ba-stage-grid">' + stageCards + '</div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">ПОСЛЕ УРОКА ВЫ СМОЖЕТЕ</p><ol class="ba-list">' + data.lesson.learning_outcomes.map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol></section><div class="ba-footer-space"></div>';
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
    const nextLabel = last ? (stageDone(lessonId,'system_analysis') ? 'Раздел завершён' : 'Завершить раздел') : 'Следующий экран →';
    const nextAction = last ? 'BusinessArchitecture.completeSystemAnalysis(\'' + lessonId + '\')' : 'BusinessArchitecture.moveSystemScreen(1)';

    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">Раздел 1 из 4</span></div>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveSystemScreen(-1)"' + prevDisabled + '>← Назад</button><div class="ba-screen-counter">' + (runtime.screenIndex + 1) + ' из ' + stage.screens.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + nextAction + '">' + nextLabel + '</button></div>' +
      '<article class="ba-reading-card"><p class="ba-eyebrow">ФИНАНСОВАЯ СИСТЕМА</p><h2>' + escapeHtml(screen.title) + '</h2>' +
        (screen.content || []).map(function(p){ return '<p>' + escapeHtml(p) + '</p>'; }).join('') + screenExtraHtml(screen) + '</article>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveSystemScreen(-1)"' + prevDisabled + '>← Назад</button><div class="ba-screen-counter">Позиция сохраняется автоматически</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + nextAction + '">' + nextLabel + '</button></div>' +
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
    safeAlert('Первый раздел завершён. Теперь можно перейти к практическим материалам.');
    openLesson(lessonId);
  }

  async function renderBusinessExamples(lessonId){
    const data = await ensureLesson(lessonId);
    const stage = data.stages.find(function(item){ return item.id === 'business_examples'; });
    const lp = getLessonProgress(lessonId).lesson;
    const opened = Array.isArray(lp.examplesOpened) ? lp.examplesOpened : [];
    const allOpened = stage.examples.every(function(item){ return opened.includes(item.id); });
    const cards = stage.examples.map(function(item){
      const viewed = opened.includes(item.id);
      return '<article class="ba-example-card ' + (viewed ? 'is-opened' : '') + '">' +
        '<div class="ba-example-title-row"><h3>' + escapeHtml(item.title) + '</h3>' + (viewed ? '<span class="ba-viewed">Просмотрено</span>' : '') + '</div>' +
        '<p>' + escapeHtml(item.purpose) + '</p>' +
        '<div class="ba-actions"><button class="ba-btn ba-btn-secondary ba-btn-small" onclick="BusinessArchitecture.openExample(\'' + lessonId + '\',\'' + item.id + '\')">Посмотреть пример</button></div>' +
      '</article>';
    }).join('');
    const viewedCount = stage.examples.filter(function(item){ return opened.includes(item.id); }).length;
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">Раздел 2 из 4</span></div>' +
      '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ПРАКТИЧЕСКИЕ МАТЕРИАЛЫ</p><h2>Как финансовая система выглядит в работе</h2><p>Посмотрите четыре документа, на которых строятся решения о прибыли, деньгах, безубыточности и росте.</p></section>' +
      '<section class="ba-card"><div class="ba-section-progress"><span>Просмотрено ' + viewedCount + ' из ' + stage.examples.length + '</span><div class="ba-progress-bar"><i style="width:' + Math.round((viewedCount/stage.examples.length)*100) + '%"></i></div></div><div class="ba-example-list">' + cards + '</div>' +
        '<div class="ba-actions"><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Библиотека практических материалов</button><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeExamples(\'' + lessonId + '\')" ' + (allOpened ? '' : 'disabled') + '>Продолжить</button></div>' +
        (!allOpened ? '<div class="ba-note" style="margin-top:12px">Чтобы перейти дальше, посмотрите все четыре материала.</div>' : '') +
      '</section><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }

  function exampleById(examples, exampleId){
    return (examples.items || []).find(function(item){ return item.id === exampleId; }) || null;
  }

  function exampleTableHtml(example){
    const head = (example.table.headers || []).map(function(cell){ return '<th>' + escapeHtml(cell) + '</th>'; }).join('');
    const rows = (example.table.rows || []).map(function(row){ return '<tr>' + row.map(function(cell){ return '<td>' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>'; }).join('');
    return '<div class="ba-example-table-wrap"><table class="ba-example-table"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  async function renderExample(lessonId, exampleId, fromLibrary){
    try {
      const examples = await ensureExamples();
      const example = exampleById(examples, exampleId);
      if (!example) throw new Error('Практический материал не найден.');
      if (lessonId) updateLessonProgress(lessonId, function(lp){ if (!lp.examplesOpened.includes(exampleId)) lp.examplesOpened.push(exampleId); });
      const kpis = (example.kpis || []).map(function(item){ return '<div class="ba-example-kpi"><span>' + escapeHtml(item.label) + '</span><b>' + escapeHtml(item.value) + '</b></div>'; }).join('');
      const checks = (example.checks || []).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('');
      const back = fromLibrary ? 'BusinessArchitecture.openExamplesLibrary()' : 'BusinessArchitecture.renderBusinessExamples(\'' + (lessonId || 'BA-01') + '\')';
      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="' + back + '">← Назад</button></div>' +
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">' + escapeHtml(example.category) + '</p><h2>' + escapeHtml(example.title) + '</h2><p>' + escapeHtml(example.purpose) + '</p></section>' +
        '<section class="ba-card"><div class="ba-example-kpi-grid">' + kpis + '</div>' + exampleTableHtml(example) + '</section>' +
        '<section class="ba-two-column"><div class="ba-card"><p class="ba-eyebrow">КАК ИСПОЛЬЗУЕТСЯ</p><p>' + escapeHtml(example.proof) + '</p><div class="ba-example-facts"><div><span>Ответственный</span><b>' + escapeHtml(example.owner) + '</b></div><div><span>Периодичность</span><b>' + escapeHtml(example.cadence) + '</b></div></div></div><div class="ba-card"><p class="ba-eyebrow">КАКОЕ РЕШЕНИЕ ПОМОГАЕТ ПРИНЯТЬ</p><p>' + escapeHtml(example.decision) + '</p></div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">ПРИЗНАКИ РАБОЧЕЙ МОДЕЛИ</p><ul class="ba-list">' + checks + '</ul><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="' + back + '">Вернуться</button></div></section><div class="ba-footer-space"></div>';
      renderWithAppShell(html, 'home');
    } catch(error){ errorView(error); }
  }

  async function openExample(lessonId, exampleId){
    return renderExample(lessonId, exampleId, false);
  }

  async function openExamplesLibrary(){
    try {
      const examples = await ensureExamples();
      const categories = ['Все'].concat(examples.categories || []);
      const options = categories.map(function(cat){ return '<option value="' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</option>'; }).join('');
      const cards = (examples.items || []).map(function(item){
        const search = (item.title + ' ' + item.category + ' ' + item.purpose).toLowerCase();
        return '<article class="ba-library-card" data-category="' + escapeHtml(item.category) + '" data-search="' + escapeHtml(search) + '"><p class="ba-eyebrow">' + escapeHtml(item.category) + '</p><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.purpose) + '</p><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.renderExample(null,\'' + item.id + '\',true)">Открыть</button></article>';
      }).join('');
      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button></div>' +
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ПРАКТИЧЕСКИЕ МАТЕРИАЛЫ</p><h2>Библиотека управленческих документов</h2><p>Финансовые модели, карты процессов, реестры, дашборды и другие материалы в заполненном рабочем виде.</p></section>' +
        '<section class="ba-card"><div class="ba-library-controls"><input id="ba-library-search" type="search" placeholder="Найти материал" oninput="BusinessArchitecture.filterExampleLibrary()"><select id="ba-library-category" onchange="BusinessArchitecture.filterExampleLibrary()">' + options + '</select></div><div class="ba-library-list">' + cards + '</div><div id="ba-library-empty" class="ba-note" style="display:none">По вашему запросу ничего не найдено.</div></section><div class="ba-footer-space"></div>';
      renderWithAppShell(html, 'home');
    } catch(error){ errorView(error); }
  }

  function filterExampleLibrary(){
    const input = document.getElementById('ba-library-search');
    const select = document.getElementById('ba-library-category');
    const query = String(input && input.value || '').trim().toLowerCase();
    const category = String(select && select.value || 'Все');
    let visible = 0;
    document.querySelectorAll('.ba-library-card').forEach(function(card){
      const okQuery = !query || String(card.dataset.search || '').includes(query);
      const okCategory = category === 'Все' || card.dataset.category === category;
      const show = okQuery && okCategory;
      card.style.display = show ? '' : 'none';
      if (show) visible += 1;
    });
    const empty = document.getElementById('ba-library-empty');
    if (empty) empty.style.display = visible ? 'none' : '';
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
    safeAlert('Практические материалы просмотрены. Теперь можно перейти к задачам.');
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
    refreshQuizAnsweredCount();
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
    refreshQuizAnsweredCount();
  }

  function answerNumeric(questionId, value){
    updateLessonProgress(runtime.currentLessonId, function(lp){ lp.quiz.draft[questionId] = String(value); });
    refreshQuizAnsweredCount();
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
    renderQuiz(runtime.currentLessonId, runtime.quizIndex, true);
  }

  function confirmOrder(questionId){
    updateLessonProgress(runtime.currentLessonId, function(lp){
      const current = Array.isArray(lp.quiz.order[questionId]) ? lp.quiz.order[questionId].slice() : [];
      lp.quiz.draft[questionId] = current;
    });
    refreshQuizAnsweredCount();
    const button = document.querySelector('[data-ba-confirm-order="' + CSS.escape(questionId) + '"]');
    if (button) { button.textContent = 'Порядок сохранён'; button.disabled = true; }
  }

  function refreshQuizAnsweredCount(){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    if (!lesson) return;
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    const lp = getLessonProgress(lessonId).lesson;
    const count = stage.questions.filter(function(item){ return questionAnswered(item, lp); }).length;
    document.querySelectorAll('[data-ba-answered]').forEach(function(node){ node.textContent = count; });
  }

  function questionAnswered(q, lp){
    const answer = q.type === 'ordering' ? lp.quiz.order[q.id] : lp.quiz.draft[q.id];
    if (q.type === 'multiple') return Array.isArray(answer) && answer.length > 0;
    if (q.type === 'ordering') {
      const confirmed = lp.quiz.draft[q.id];
      return Array.isArray(confirmed) && confirmed.length === q.items.length;
    }
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
      const confirmed = Array.isArray(lp.quiz.draft[q.id]);
      return '<div class="ba-order-list">' + order.map(function(originalIndex, position){
        return '<div class="ba-order-row"><span class="ba-order-index">' + (position + 1) + '</span><span>' + escapeHtml(q.items[originalIndex]) + '</span><span class="ba-order-actions"><button onclick="BusinessArchitecture.moveOrder(\'' + q.id + '\',' + position + ',-1)" ' + (position === 0 ? 'disabled' : '') + '>↑</button><button onclick="BusinessArchitecture.moveOrder(\'' + q.id + '\',' + position + ',1)" ' + (position === order.length - 1 ? 'disabled' : '') + '>↓</button></span></div>';
      }).join('') + '</div><div class="ba-actions"><button data-ba-confirm-order="' + escapeHtml(q.id) + '" class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.confirmOrder(\'' + q.id + '\')" ' + (confirmed ? 'disabled' : '') + '>' + (confirmed ? 'Порядок сохранён' : 'Подтвердить порядок') + '</button></div>';
    }
    return '';
  }

  async function renderQuiz(lessonId, requestedIndex, focusQuestion){
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
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-warning">Раздел 3 из 4</span></div>' +
      '<section class="ba-card ba-quiz-intro"><p class="ba-eyebrow">УПРАВЛЕНЧЕСКИЕ ЗАДАЧИ</p><h2>Разбор финансовых решений</h2><p>В каждом задании нужно сопоставить факты, ограничения и последствия. К материалам урока можно возвращаться в любой момент.</p><div class="ba-quiz-line"><span>Отвечено <b data-ba-answered>' + answeredCount + '</b> из ' + stage.questions.length + '</span><span>Для прохождения — ' + stage.pass_score + '% и без ошибок в ключевых вопросах</span></div></section>' +
      '<div class="ba-screen-nav ba-quiz-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Вопрос ' + (runtime.quizIndex + 1) + ' из ' + stage.questions.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить ответы' : 'Следующий →') + '</button></div>' +
      '<article class="ba-question-card"><div class="ba-question-top"><span class="ba-question-skill">' + escapeHtml(q.skill) + '</span>' + (q.critical ? '<span class="ba-critical">КЛЮЧЕВОЙ ВОПРОС</span>' : '') + '</div>' +
        (q.case ? '<div class="ba-case">' + escapeHtml(q.case) + '</div>' : '') + '<h2>' + escapeHtml(q.question) + '</h2>' + questionInputHtml(q, lp) + '</article>' +
      '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Ответы сохраняются автоматически</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить ответы' : 'Следующий →') + '</button></div><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home', focusQuestion ? {target:'.ba-question-card'} : {});
  }
  function moveQuiz(delta){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    runtime.quizIndex = clamp(runtime.quizIndex + Number(delta || 0), 0, stage.questions.length - 1);
    renderQuiz(lessonId, runtime.quizIndex, true);
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
      safeAlert('Осталось без ответа: ' + missing.length + '. Заполните все задания перед проверкой.');
      runtime.quizIndex = stage.questions.findIndex(function(q){ return missing[0].id === q.id; });
      return renderQuiz(lessonId, runtime.quizIndex, true);
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
    const reviews = stage.questions.map(function(q, index){
      const r = result.results.find(function(item){ return item.id === q.id; });
      return '<details class="ba-review-item ' + (r && r.correct ? 'is-correct' : 'is-wrong') + '"><summary>' + (r && r.correct ? 'Ответ обоснован' : 'Нужно пересмотреть') + ' · Вопрос ' + (index + 1) + ' · ' + escapeHtml(q.skill) + '</summary><div class="ba-review-body"><b>Задание:</b> ' + escapeHtml(q.question) + '<br><br><b>Ваш ответ:</b> ' + escapeHtml(answerDisplay(q,lp)) + '<br><br><b>Разбор:</b> ' + escapeHtml(q.explanation || '') + '</div></details>';
    }).join('');
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status ' + (result.passed ? 'is-done' : 'is-warning') + '">' + (result.passed ? 'Тест пройден' : 'Нужна новая попытка') + '</span></div>' +
      '<section class="ba-card"><p class="ba-eyebrow">РЕЗУЛЬТАТ</p><h2>' + (result.passed ? 'Вы готовы перейти к практической работе' : 'Часть решений нужно пересмотреть') + '</h2><div class="ba-result-summary" style="margin-top:14px"><div class="ba-result-box"><span>Итог</span><b>' + result.score + '%</b></div><div class="ba-result-box"><span>Правильных ответов</span><b>' + result.correctCount + '/' + result.total + '</b></div><div class="ba-result-box"><span>Ключевые вопросы</span><b>' + (result.criticalPassed ? 'без ошибок' : 'есть ошибки') + '</b></div></div>' +
        '<div class="ba-note ' + (result.passed ? 'ba-note-teal' : 'ba-note-danger') + '" style="margin-top:13px">' + (result.passed ? 'Теперь можно собрать финансовый контур своего или учебного бизнеса.' : 'Для прохождения нужно набрать не менее ' + stage.pass_score + '% и без ошибок решить ключевые вопросы.') + '</div>' +
        '<div class="ba-actions">' + (result.passed ? '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.openStage(\'' + lessonId + '\',\'architecture_assembly\')">Перейти к практике</button>' : '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.restartQuiz(\'' + lessonId + '\')">Пройти ещё раз</button>') + '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">К уроку</button></div></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">РАЗБОР ОТВЕТОВ</p><h2>Логика каждого решения</h2><p>Откройте задания, чтобы увидеть, какие данные и последствия нужно было учесть.</p>' + reviews + '</section><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  }
  function restartQuiz(lessonId){
    updateLessonProgress(lessonId, function(lp){ lp.quiz.draft = {}; lp.quiz.order = {}; lp.quiz.lastResult = null; });
    runtime.quizIndex = 0;
    renderQuiz(lessonId,0,false);
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
    if (!workspaceUnlocked(lessonId)) { safeAlert('Мои материалы откроются после прохождения управленческих задач.'); return openLesson(lessonId); }
    const lesson = await ensureLesson(lessonId);
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const lp = getLessonProgress(lessonId).lesson;
    runtime.workspaceSectionIndex = clamp(requestedIndex === undefined ? Number(lp.workspace.sectionIndex || 0) : requestedIndex, 0, stage.sections.length);
    updateLessonProgress(lessonId, function(item){ item.workspace.sectionIndex = runtime.workspaceSectionIndex; });

    if (!lp.workspace.route) {
      const routes = stage.routes.map(function(route){
        return '<button class="ba-route-card" onclick="BusinessArchitecture.chooseWorkspaceRoute(\'' + lessonId + '\',\'' + route.id + '\')"><b>' + escapeHtml(route.title) + '</b><p>' + escapeHtml(route.rule) + '</p></button>';
      }).join('');
      const html = '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">Раздел 4 из 4</span></div>' +
        '<section class="ba-hero"><p class="ba-eyebrow">МОЙ ФИНАНСОВЫЙ КОНТУР</p><h2>К какой ситуации применяем материал?</h2><p>Выберите действующий бизнес, проектируемую модель или учебный кейс. Требования к обоснованию решений остаются одинаковыми.</p></section>' +
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
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← К уроку</button><span class="ba-status is-active">Раздел 4 из 4</span></div>' +
      '<section class="ba-card"><div class="ba-workspace-head"><div><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ · ' + escapeHtml(route.title) + '</p><h2>' + escapeHtml(section.title) + '</h2><p>' + escapeHtml(route.rule) + '</p></div><b class="ba-progress-number">' + complete.percent + '%</b></div><div class="ba-progress-bar"><i style="width:' + complete.percent + '%"></i></div></section>' +
      '<section class="ba-card"><div class="ba-workspace-fields">' + fields + '<div class="ba-field-block"><label>Доказательство завершения</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceEvidence(\'' + lessonId + '\',\'' + section.id + '\',this.value)">' + escapeHtml(data.evidence || '') + '</textarea><span class="ba-field-hint">Критерий: ' + escapeHtml(section.completion_evidence) + '</span></div></div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Черновик сохраняется автоматически</span><b>Заполнено ' + complete.filled + ' из ' + complete.total + '</b></div></section>' +
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
      ['material_note','Какой рабочий материал подтверждает решение']
    ];
    const form = fields.map(function(row){ return '<div class="ba-field-block"><label>' + escapeHtml(row[1]) + '</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceFinal(\'' + lessonId + '\',\'' + row[0] + '\',this.value)">' + escapeHtml(final[row[0]] || '') + '</textarea></div>'; }).join('');
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderWorkspace(\'' + lessonId + '\',' + (stage.sections.length - 1) + ')">← К разделам</button><span class="ba-status ' + (info.complete ? 'is-done' : 'is-warning') + '">' + (info.complete ? 'Готово к завершению' : 'Заполните оставшиеся поля') + '</span></div>' +
      '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ИТОГОВОЕ РЕШЕНИЕ</p><h2>Финансовый контур бизнеса</h2><p>Зафиксируйте вывод, решение, контрольную метрику и дату повторной проверки.</p></section>' +
      '<section class="ba-card"><div class="ba-workspace-fields">' + form + '</div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Черновик сохраняется автоматически</span><b>' + info.percent + '%</b></div><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeWorkspace(\'' + lessonId + '\')" ' + (info.complete ? '' : 'disabled') + '>Завершить работу</button></div>' +
      (!info.complete ? '<div class="ba-note" style="margin-top:13px">Для завершения заполните все разделы и итоговое решение.</div>' : '') + '</section><div class="ba-footer-space"></div>';
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
    safeAlert('Работа завершена. Финансовый контур сохранён в разделе «Мои материалы».');
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
      if (!workspaceUnlocked('BA-01')) {
        const html = '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button></div>' +
          '<section class="ba-card ba-empty"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>Здесь появится ваш финансовый контур</h2><p>Сначала пройдите финансовую систему, посмотрите практические материалы и решите управленческие задачи. После этого откроется рабочая форма.</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">Продолжить урок</button></div></section>';
        return renderWithAppShell(html,'home');
      }
      const stage4 = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
      const info = workspaceCompleteness(lp, stage4);
      const route = lp.workspace.route ? routeInfo(lp.workspace.route) : null;
      const sections = stage4.sections.map(function(section, index){
        const c = sectionCompleteness(lp, section);
        const label = c.percent === 100 ? 'готово' : (c.filled ? 'в работе' : 'не начато');
        return '<button class="ba-lesson-row ' + (c.percent === 100 ? 'is-done' : '') + '" onclick="BusinessArchitecture.renderWorkspace(\'BA-01\',' + index + ')"><span class="ba-lesson-index">' + (index+1) + '</span><span><b>' + escapeHtml(section.title.replace(/^\d+\.\s*/,'')) + '</b><small>' + escapeHtml(section.completion_evidence) + '</small></span><span class="ba-status ' + (c.percent === 100 ? 'is-done' : '') + '">' + label + '</span></button>';
      }).join('');
      const html =
        '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button><span class="ba-status ' + (lp.completedAt ? 'is-done' : 'is-active') + '">' + (lp.completedAt ? 'Работа завершена' : 'Черновик') + '</span></div>' +
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>Финансовый контур бизнеса</h2><p>Здесь собираются ваши расчёты, правила учёта и решения по итогам первого урока.</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.renderWorkspace(\'BA-01\')">Продолжить заполнение</button></div></section>' +
        '<section class="ba-card"><div class="ba-material-summary"><div><span>Готовность</span><b>' + info.percent + '%</b></div><div><span>Контекст</span><b>' + escapeHtml(route ? route.title : 'не выбран') + '</b></div></div><div class="ba-progress-bar"><i style="width:' + info.percent + '%"></i></div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">РАЗДЕЛЫ</p><div class="ba-lesson-list">' + sections + '</div></section><div class="ba-footer-space"></div>';
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
          .replace(/Системы подготовки к запуску:[^<]*/g,'Пошаговая система управления бизнесом: деньги, стратегия, процессы, люди, риски и рост.')
          .replace(/Подготовка к запуску и базовое предпринимательское мышление\./g,'Пошаговая система управления бизнесом: деньги, стратегия, процессы, люди, риски и рост.');
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

    const desiredDescription = 'Пошаговая система управления бизнесом: деньги, стратегия, процессы, люди, риски и рост.';
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
    renderExample,
    openExamplesLibrary,
    filterExampleLibrary,
    completeExamples,
    renderQuiz,
    moveQuiz,
    answerSingle,
    answerMultiple,
    answerNumeric,
    moveOrder,
    confirmOrder,
    submitQuiz,
    restartQuiz,
    chooseWorkspaceRoute,
    renderWorkspace,
    moveWorkspace,
    updateWorkspaceField,
    updateWorkspaceEvidence,
    updateWorkspaceFinal,
    completeWorkspace,
    renderMyArchitecture,
    installIntegration,
    getProgress: loadProgress
  };

  window.BusinessArchitecture = api;
  installIntegration();
})();
