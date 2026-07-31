/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — M01 Learning Design staging module
   Изолированный mobile-first маршрут из шести уроков.
   Активируется только через admin mode или query:
   ?ba_learning_preview=m01
   ========================================================= */
(function(){
  'use strict';

  const RELEASE = 'lds-m01-module-staging-20260731-v2';
  const STORAGE_KEY = 'architecture_business_progress_v2';
  const MANIFEST_URL = 'content/business_architecture/learning/M01.manifest.json';
  const LESSON_BASE_URL = 'content/business_architecture/learning/';
  const PREVIEW_PARAM = 'ba_learning_preview';
  const PREVIEW_VALUE = 'm01';
  const LESSON_PARAM = 'ba_learning_lesson';
  const SCREEN_PARAM = 'ba_learning_screen';
  const UNLOCK_PARAM = 'ba_learning_unlock';
  const SYNC_DELAY_MS = 900;

  const runtime = {
    manifest: null,
    lessons: {},
    lessonId: '',
    screenIndex: 0,
    saveLabel: 'Сохранено на устройстве',
    syncTimer: null,
    installed: false,
    originalRenderHome: null,
    originalOpenAppHome: null
  };

  function escapeHtml(value){
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function nowIso(){ return new Date().toISOString(); }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,Number(value)||0)); }

  function queryValue(name){
    try { return new URL(window.location.href).searchParams.get(name) || ''; }
    catch(e){ return ''; }
  }

  function previewRequested(){ return String(queryValue(PREVIEW_PARAM)).toLowerCase() === PREVIEW_VALUE; }
  function reviewUnlock(){ return adminMode() || String(queryValue(UNLOCK_PARAM)).toLowerCase() === 'all'; }
  function adminMode(){
    try { return typeof window.isAdminMode === 'function' && Boolean(window.isAdminMode()); }
    catch(e){ return false; }
  }

  function setPreviewQuery(active,lessonId,screenIndex){
    try {
      const url = new URL(window.location.href);
      if (active) {
        url.searchParams.set(PREVIEW_PARAM,PREVIEW_VALUE);
        if (lessonId) url.searchParams.set(LESSON_PARAM,lessonId);
        else url.searchParams.delete(LESSON_PARAM);
        if (Number.isFinite(Number(screenIndex))) url.searchParams.set(SCREEN_PARAM,String(Number(screenIndex)+1));
        else url.searchParams.delete(SCREEN_PARAM);
      } else {
        url.searchParams.delete(PREVIEW_PARAM);
        url.searchParams.delete(LESSON_PARAM);
        url.searchParams.delete(SCREEN_PARAM);
        url.searchParams.delete(UNLOCK_PARAM);
      }
      window.history.replaceState({},'',url.toString());
    } catch(e) {}
  }

  function safeAlert(message){
    const text = String(message || '');
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showAlert === 'function') return tg.showAlert(text);
    } catch(e) {}
    window.alert(text);
  }

  function hasTelegramSession(){
    try { return Boolean(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData); }
    catch(e){ return false; }
  }

  function blankRoot(){
    return {version:1,release:RELEASE,selectedRoute:'',currentLessonId:'',updatedAt:nowIso(),lessons:{}};
  }

  function readRoot(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return blankRoot();
      if (!parsed.lessons || typeof parsed.lessons !== 'object' || Array.isArray(parsed.lessons)) parsed.lessons = {};
      return parsed;
    } catch(e){
      console.warn('BA_M01_PROGRESS_READ_ERROR',e);
      return blankRoot();
    }
  }

  function blankFlow(){
    return {schemaVersion:1,release:RELEASE,screenIndex:0,answers:{},checked:{},practice:{},startedAt:null,completedAt:null,updatedAt:null};
  }

  function normalizeFlow(value){
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.assign(blankFlow(),source,{
      answers:source.answers && typeof source.answers === 'object' ? source.answers : {},
      checked:source.checked && typeof source.checked === 'object' ? source.checked : {},
      practice:source.practice && typeof source.practice === 'object' ? source.practice : {}
    });
  }

  function ensureLessonEntry(root,lessonId){
    const existing = root.lessons[lessonId] && typeof root.lessons[lessonId] === 'object' ? root.lessons[lessonId] : {};
    const entry = Object.assign({
      completedStages:[],lastStageId:'learning_screen_flow',completedAt:null,
      systemAnalysis:{screenIndex:0},examplesOpened:[],
      quiz:{draft:{},order:{},attempts:[],lastResult:null,reviewQuestionIds:[],reviewMode:''},
      workspace:{route:'',sectionIndex:0,sections:{},final:{},completedAt:null}
    },existing);
    entry.completedStages = Array.isArray(entry.completedStages) ? entry.completedStages.slice() : [];
    entry.learningFlow = normalizeFlow(entry.learningFlow);
    root.lessons[lessonId] = entry;
    return entry;
  }

  function readFlow(lessonId){
    const root = readRoot();
    const entry = root.lessons[lessonId] && typeof root.lessons[lessonId] === 'object' ? root.lessons[lessonId] : {};
    return normalizeFlow(entry.learningFlow);
  }

  function persistFlow(lessonId,mutator,options){
    const opts = options || {};
    const root = readRoot();
    const entry = ensureLessonEntry(root,lessonId);
    const flow = normalizeFlow(entry.learningFlow);
    if (!flow.startedAt) flow.startedAt = nowIso();
    if (typeof mutator === 'function') mutator(flow,entry,root);
    flow.release = RELEASE;
    flow.updatedAt = nowIso();
    entry.learningFlow = flow;
    entry.lastStageId = 'learning_screen_flow';
    if (!entry.completedStages.includes('learning_flow_started')) entry.completedStages.push('learning_flow_started');
    root.currentLessonId = lessonId;
    root.updatedAt = flow.updatedAt;
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify(root));
      updateSaveLabel('Сохранено на устройстве');
    } catch(e){
      console.warn('BA_M01_PROGRESS_WRITE_ERROR',e);
      updateSaveLabel('Не удалось сохранить');
    }
    if (opts.sync !== false) scheduleRemoteSync();
    return flow;
  }

  function updateSaveLabel(text){
    runtime.saveLabel = String(text || 'Сохранено');
    document.querySelectorAll('[data-ba-m01-saved]').forEach(function(node){ node.textContent = runtime.saveLabel; });
  }

  function scheduleRemoteSync(){
    if (runtime.syncTimer) clearTimeout(runtime.syncTimer);
    if (!hasTelegramSession()) return updateSaveLabel('Сохранено на устройстве');
    updateSaveLabel('Синхронизируем…');
    runtime.syncTimer = setTimeout(function(){
      runtime.syncTimer = null;
      const api = window.BusinessArchitecture;
      if (!api || typeof api.syncNow !== 'function') return updateSaveLabel('Сохранено на устройстве');
      Promise.resolve(api.syncNow()).then(function(ok){ updateSaveLabel(ok === false ? 'Сохранено на устройстве' : 'Сохранено'); })
        .catch(function(error){ console.warn('BA_M01_SYNC_ERROR',error); updateSaveLabel('Сохранено на устройстве'); });
    },SYNC_DELAY_MS);
  }

  async function fetchJson(url){
    const divider = String(url).includes('?') ? '&' : '?';
    const response = await fetch(url + divider + 'v=' + encodeURIComponent(RELEASE),{cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить файл (' + response.status + ').');
    return response.json();
  }

  async function ensureManifest(){
    if (!runtime.manifest) runtime.manifest = await fetchJson(MANIFEST_URL);
    return runtime.manifest;
  }

  async function ensureLesson(lessonId){
    if (!runtime.lessons[lessonId]) runtime.lessons[lessonId] = await fetchJson(LESSON_BASE_URL + encodeURIComponent(lessonId) + '.json');
    return runtime.lessons[lessonId];
  }

  function lessonMeta(lessonId){
    return runtime.manifest && Array.isArray(runtime.manifest.lessons)
      ? runtime.manifest.lessons.find(function(item){ return item.lesson_id === lessonId; }) || null
      : null;
  }

  function lessonIndex(lessonId){
    return runtime.manifest && Array.isArray(runtime.manifest.lessons)
      ? runtime.manifest.lessons.findIndex(function(item){ return item.lesson_id === lessonId; })
      : -1;
  }

  function lessonCompleted(lessonId){ return Boolean(readFlow(lessonId).completedAt); }
  function lessonHasProgress(lessonId){
    const flow = readFlow(lessonId);
    return Boolean(flow.startedAt || flow.completedAt || Number(flow.screenIndex) > 0 || Object.keys(flow.practice || {}).length || Object.keys(flow.answers || {}).length);
  }

  function lessonUnlocked(lessonId){
    if (reviewUnlock()) return true;
    const index = lessonIndex(lessonId);
    if (index <= 0) return index === 0;
    if (lessonHasProgress(lessonId)) return true;
    return lessonCompleted(runtime.manifest.lessons[index-1].lesson_id);
  }

  function moduleProgress(){
    const lessons = runtime.manifest && Array.isArray(runtime.manifest.lessons) ? runtime.manifest.lessons : [];
    let completed = 0, screensDone = 0, totalScreens = 0;
    lessons.forEach(function(meta){
      const flow = readFlow(meta.lesson_id);
      if (flow.completedAt) completed += 1;
      const count = Number(meta.screen_count || 17);
      totalScreens += count;
      if (flow.startedAt) screensDone += flow.completedAt ? count : clamp(Number(flow.screenIndex || 0) + 1,0,count);
    });
    return {completed:completed,total:lessons.length,screensDone:screensDone,totalScreens:totalScreens,percent:totalScreens?Math.round(screensDone/totalScreens*100):0};
  }

  function renderWithShell(content,options){
    const opts = options || {};
    const wrapped = '<div class="ba-root"><div class="ba-shell ba-learning-shell ba-m01-shell">' + content + '</div></div>';
    if (typeof window.shell === 'function') window.shell(wrapped,'home');
    else {
      const app = document.getElementById('app');
      if (app) app.innerHTML = wrapped;
    }
    requestAnimationFrame(function(){
      const target = document.querySelector('.ba-learning-screen,.ba-m01-module-hero');
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({block:'start',behavior:opts.smooth?'smooth':'auto'});
      else window.scrollTo(0,0);
    });
    setTimeout(function(){ updateSaveLabel(runtime.saveLabel); },0);
  }

  function paragraphsHtml(items){ return (items || []).map(function(item){ return '<p>' + escapeHtml(item) + '</p>'; }).join(''); }
  function chipsHtml(items){
    if (!Array.isArray(items) || !items.length) return '';
    return '<div class="ba-learning-chips">' + items.map(function(item){ return '<span>' + escapeHtml(item) + '</span>'; }).join('') + '</div>';
  }
  function stepsHtml(items){
    if (!Array.isArray(items) || !items.length) return '';
    return '<ol class="ba-learning-steps">' + items.map(function(item){ return '<li><span></span><b>' + escapeHtml(item) + '</b></li>'; }).join('') + '</ol>';
  }

  function moduleHeader(){
    return '<div class="ba-learning-topline"><button class="ba-back" onclick="ArchitectureM01Staging.exit()">← К курсу</button>' +
      '<span data-ba-m01-saved class="ba-learning-saved">' + escapeHtml(runtime.saveLabel) + '</span>' +
      '<button class="ba-learning-reset" onclick="ArchitectureM01Staging.resetModule()" aria-label="Сбросить прогресс M01">↺</button></div>';
  }

  function firstNextLesson(){
    const lessons = runtime.manifest.lessons || [];
    return lessons.find(function(item){ return lessonUnlocked(item.lesson_id) && !lessonCompleted(item.lesson_id); }) || lessons[0] || null;
  }

  async function renderModule(){
    try {
      await ensureManifest();
      setPreviewQuery(true,'',null);
      runtime.lessonId = '';
      const progress = moduleProgress();
      const next = firstNextLesson();
      const allDone = progress.total > 0 && progress.completed === progress.total;
      const route = (runtime.manifest.progression || []).map(function(item,index){
        const meta = runtime.manifest.lessons[index];
        const state = meta && lessonCompleted(meta.lesson_id) ? 'is-done' : (meta && lessonUnlocked(meta.lesson_id) ? 'is-active' : 'is-locked');
        return '<li class="' + state + '"><span>' + (index+1) + '</span><b>' + escapeHtml(item) + '</b></li>';
      }).join('');
      const lessonCards = (runtime.manifest.lessons || []).map(function(meta,index){
        const unlocked = lessonUnlocked(meta.lesson_id);
        const flow = readFlow(meta.lesson_id);
        const done = Boolean(flow.completedAt);
        const pct = done ? 100 : (flow.startedAt ? Math.round((Number(flow.screenIndex || 0)+1)/Number(meta.screen_count||17)*100) : 0);
        const state = done ? 'is-done' : (unlocked ? 'is-active' : 'is-locked');
        const label = done ? 'Завершён' : (flow.startedAt ? 'Продолжить' : (unlocked ? 'Начать' : 'Закрыт'));
        const action = unlocked ? 'onclick="ArchitectureM01Staging.openLesson(\'' + escapeHtml(meta.lesson_id) + '\')"' : 'disabled';
        return '<button class="ba-m01-lesson-card ' + state + '" ' + action + '>' +
          '<span class="ba-m01-lesson-number">' + (index+1) + '</span><span class="ba-m01-lesson-copy"><small>УРОК ' + (index+1) + ' ИЗ ' + runtime.manifest.lessons.length + '</small><b>' + escapeHtml(meta.title) + '</b><em>' + escapeHtml(meta.result || '') + '</em></span>' +
          '<span class="ba-m01-lesson-state"><strong>' + pct + '%</strong><small>' + label + '</small></span></button>';
      }).join('');
      const mainAction = allDone
        ? '<button class="ba-btn ba-btn-primary" onclick="ArchitectureM01Staging.openCapstone()">Открыть итоговую сборку</button>'
        : (next ? '<button class="ba-btn ba-btn-primary" onclick="ArchitectureM01Staging.openLesson(\'' + escapeHtml(next.lesson_id) + '\')">' + (lessonHasProgress(next.lesson_id)?'Продолжить обучение':'Начать модуль') + '</button>' : '');
      const html = moduleHeader() +
        '<section class="ba-learning-hero ba-m01-module-hero"><p class="ba-eyebrow">МОДУЛЬ 1 · НОВЫЙ УЧЕБНЫЙ МАРШРУТ</p><h1>' + escapeHtml(runtime.manifest.title) + '</h1>' +
        '<p class="ba-learning-lead">' + escapeHtml(runtime.manifest.subtitle || 'Соберите целостную карту одного управленческого решения: от границ и потоков до критических ворот и версий.') + '</p>' +
        '<div class="ba-m01-metrics"><div><b>6</b><span>уроков</span></div><div><b>102</b><span>экрана</span></div><div><b>1</b><span>объект</span></div><div><b>' + progress.percent + '%</b><span>прогресс</span></div></div>' +
        '<div class="ba-actions">' + mainAction + '</div></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">КАК СОБИРАЕТСЯ СИСТЕМА</p><h2>Один результат проходит через шесть шагов</h2><ol class="ba-m01-route">' + route + '</ol></section>' +
        '<section class="ba-card"><p class="ba-eyebrow">УРОКИ МОДУЛЯ</p><div class="ba-m01-lesson-list">' + lessonCards + '</div></section>' +
        '<section class="ba-card ba-m01-capstone-card ' + (allDone?'is-ready':'') + '"><div><p class="ba-eyebrow">ИТОГОВАЯ РАБОТА</p><h2>' + escapeHtml(runtime.manifest.capstone || 'Паспорт метасистемы бизнеса') + '</h2><p>Шесть артефактов собираются по одному реальному решению. Красный gate может дать STOP — это допустимый качественный результат.</p></div>' +
        '<button class="ba-btn ' + (allDone?'ba-btn-primary':'ba-btn-light') + '" onclick="ArchitectureM01Staging.openCapstone()" ' + (allDone||reviewUnlock()?'':'disabled') + '>' + (allDone?'Собрать итог':'Откроется после 6 уроков') + '</button></section><div class="ba-footer-space"></div>';
      renderWithShell(html);
    } catch(error){ renderError(error); }
  }

  function segmentProgressHtml(screen,data){
    const active = Math.max(0,(data.segments || []).indexOf(screen.segment));
    return '<div class="ba-learning-segments" aria-label="Этапы урока">' + (data.segments || []).map(function(segment,index){
      const cls = index < active ? 'is-done' : (index === active ? 'is-active' : '');
      return '<span class="' + cls + '" title="' + escapeHtml(segment) + '"></span>';
    }).join('') + '</div>';
  }

  function renderCover(screen){
    return '<section class="ba-learning-hero ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h1>' + escapeHtml(screen.title) + '</h1>' +
      '<p class="ba-learning-lead">' + escapeHtml(screen.subtitle) + '</p><div class="ba-learning-question"><small>Управленческий вопрос</small><b>' + escapeHtml(screen.management_question) + '</b></div>' +
      '<div class="ba-learning-result"><small>Результат урока</small><b>' + escapeHtml(screen.result) + '</b></div>' + (screen.estimated_time?'<p class="ba-learning-time">'+escapeHtml(screen.estimated_time)+'</p>':'') + '</section>';
  }

  function genericExtras(screen){
    let html = '';
    if (screen.example) html += '<div class="ba-learning-example"><b>Пример</b><p>' + escapeHtml(screen.example) + '</p></div>';
    if (screen.deep) html += '<details class="ba-learning-details"><summary>Глубже</summary><p>' + escapeHtml(screen.deep) + '</p></details>';
    if (screen.warning) html += '<div class="ba-note ba-note-danger"><b>Важно:</b> ' + escapeHtml(screen.warning) + '</div>';
    if (screen.callout) html += '<div class="ba-note ba-note-teal">' + escapeHtml(screen.callout) + '</div>';
    if (screen.prompt) html += '<div class="ba-note"><b>' + escapeHtml(screen.prompt) + '</b>' + chipsHtml(screen.chips) + '</div>';
    if (screen.steps) html += stepsHtml(screen.steps);
    return html;
  }

  function renderSystemMap(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-boundary-map" role="img" aria-label="Объект управления во внешней среде"><span class="is-top">Внешняя среда</span><span class="is-left">Входы</span><span class="is-right">Выходы</span><span class="is-bottom">Ограничения</span><strong>ОБЪЕКТ<br>УПРАВЛЕНИЯ</strong></div>' +
      '<div class="ba-learning-grid ba-learning-grid-2">' + (screen.legend || []).map(function(item){ return '<article><b>' + escapeHtml(item.label) + '</b><small>' + escapeHtml(item.value) + '</small></article>'; }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderFlowMap(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) +
      '<div class="ba-m01-flow-map">' + (screen.flows || []).map(function(flow,index){ return '<article><span>' + (index+1) + '</span><div><b>' + escapeHtml(flow.title) + '</b><p>' + escapeHtml(flow.question) + '</p></div></article>'; }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderManagementCycle(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) +
      '<div class="ba-m01-cycle">' + (screen.nodes || []).map(function(node,index){ return '<div><span>' + (index+1) + '</span><b>' + escapeHtml(node) + '</b></div>'; }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderCausalLoop(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) +
      '<div class="ba-m01-loop-grid">' + (screen.loops || []).map(function(loop){ return '<article class="is-' + escapeHtml(loop.type) + '"><span>↻</span><b>' + escapeHtml(loop.title) + '</b><p>' + escapeHtml(loop.example) + '</p></article>'; }).join('') + '</div>' +
      '<div class="ba-m01-stocks"><b>Что накапливается</b>' + chipsHtml(screen.stocks) + '</div><div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderGateBoard(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) +
      '<div class="ba-m01-maturity">' + (screen.maturity || []).map(function(item){ return '<div><span>' + escapeHtml(item.level) + '</span><b>' + escapeHtml(item.label) + '</b></div>'; }).join('') + '</div>' +
      '<div class="ba-m01-gates">' + (screen.statuses || []).map(function(item){ return '<article class="is-' + escapeHtml(item.id) + '"><b>' + escapeHtml(item.label) + '</b><p>' + escapeHtml(item.meaning) + '</p></article>'; }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderVersionLifecycle(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) +
      '<div class="ba-m01-version-line">' + (screen.stages || []).map(function(stage,index){ return '<div><span>' + (index+1) + '</span><b>' + escapeHtml(stage) + '</b></div>'; }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div></section>';
  }

  function renderChoice(screen){
    const flow = readFlow(runtime.lessonId), answer = flow.answers[screen.id] || '', checked = Boolean(flow.checked[screen.id]);
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><p>' + escapeHtml(screen.question) + '</p>' +
      '<div class="ba-learning-options">' + (screen.options || []).map(function(option){
        const cls = answer === option.id ? ' is-selected' : '';
        const resultCls = checked ? (option.id === screen.correct ? ' is-correct' : (answer === option.id ? ' is-wrong' : '')) : '';
        return '<button class="ba-learning-option' + cls + resultCls + '" data-ba-m01-answer="' + escapeHtml(option.id) + '" ' + (checked?'disabled':'') + '><span>' + escapeHtml(option.id) + '</span><b>' + escapeHtml(option.text) + '</b></button>';
      }).join('') + '</div>' + (checked?'<div class="ba-note ' + (answer===screen.correct?'ba-note-teal':'ba-note-danger') + '">' + escapeHtml(answer===screen.correct?screen.correct_feedback:screen.wrong_feedback) + '</div>':'') + '</section>';
  }

  function renderPractice(screen){
    const flow = readFlow(runtime.lessonId), fields = screen.fields || [], filled = fields.filter(function(field){ return String(flow.practice[field.id] || '').trim(); }).length;
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><p>' + escapeHtml(screen.instruction) + '</p>' +
      '<div class="ba-learning-form">' + fields.map(function(field){ return '<label><span>' + escapeHtml(field.label) + '</span><textarea data-ba-m01-field="' + escapeHtml(field.id) + '" placeholder="' + escapeHtml(field.placeholder) + '">' + escapeHtml(flow.practice[field.id] || '') + '</textarea></label>'; }).join('') + '</div>' +
      '<div class="ba-learning-form-status"><span>' + escapeHtml(screen.completion || '') + '</span><b>Заполнено ' + filled + ' из ' + fields.length + '</b></div></section>';
  }

  function renderCase(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-case-row"><b>Было</b><span>' + escapeHtml(screen.before) + '</span></div><div class="ba-learning-case-row"><b>Факты</b><span>' + (screen.evidence || []).map(function(item){ return '• ' + escapeHtml(item); }).join('<br>') + '</span></div>' +
      '<div class="ba-learning-case-row"><b>Решение</b><span>' + escapeHtml(screen.decision) + '</span></div><div class="ba-learning-case-row"><b>Стало</b><span>' + escapeHtml(screen.after) + '</span></div></section>';
  }

  function renderComparison(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><div class="ba-learning-grid ba-learning-grid-2">' +
      (screen.cards || []).map(function(card){
        const detail = card.signal ? '<small>' + escapeHtml(card.signal) + '</small><span class="ba-learning-mode">' + escapeHtml(card.mode) + '</span>' : '<ul>' + (card.items || []).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
        return '<article><b>' + escapeHtml(card.title) + '</b>' + detail + '</article>';
      }).join('') + '</div>' + (screen.decision_rule?'<div class="ba-note ba-note-teal">'+escapeHtml(screen.decision_rule)+'</div>':'') + '</section>';
  }

  function renderAntiPatterns(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><div class="ba-learning-grid">' +
      (screen.patterns || []).map(function(item){ return '<article><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.consequence) + '</small></article>'; }).join('') + '</div></section>';
  }

  function renderSummary(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><ol class="ba-learning-summary">' +
      (screen.takeaways || []).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol><div class="ba-note ba-note-teal"><b>Создано:</b> ' + escapeHtml(screen.artifact) + '</div></section>';
  }

  function practiceButtons(){
    const assets = runtime.manifest && runtime.manifest.practice_assets ? runtime.manifest.practice_assets : {};
    const buttons = [];
    if (assets.template && assets.template.url) buttons.push('<a class="ba-btn ba-btn-primary" href="' + escapeHtml(assets.template.url) + '" target="_blank" rel="noopener">Открыть пустой шаблон</a>');
    if (assets.example && assets.example.url) buttons.push('<a class="ba-btn ba-btn-light" href="' + escapeHtml(assets.example.url) + '" target="_blank" rel="noopener">Посмотреть пример</a>');
    if (!buttons.length) buttons.push('<button class="ba-btn ba-btn-light" disabled>Файлы подключаются к staging</button>');
    return buttons.join('');
  }

  function renderPracticeHandoff(screen){
    return '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) + stepsHtml(screen.steps) +
      '<div class="ba-actions ba-learning-downloads">' + practiceButtons() + '</div><p class="ba-learning-caption">Сначала изучите пустую структуру, затем сравните демонстрационный пример. Цифры примера не являются нормативом.</p></section>';
  }

  function renderLessonResult(screen){
    return '<section class="ba-learning-hero ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2><div class="ba-learning-result"><small>' + escapeHtml(screen.status) + '</small><b>' + escapeHtml(screen.artifact) + '</b></div><p>' + escapeHtml(screen.next_use) + '</p><div class="ba-learning-question"><b>' + escapeHtml(screen.business_note) + '</b></div></section>';
  }

  function renderGeneric(screen){
    const hero = screen.type === 'key_idea';
    return '<section class="' + (hero?'ba-learning-hero':'ba-card') + ' ba-learning-screen"><p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' + paragraphsHtml(screen.body) + genericExtras(screen) + '</section>';
  }

  function screenHtml(screen){
    if (screen.type === 'lesson_cover') return renderCover(screen);
    if (screen.type === 'system_map') return renderSystemMap(screen);
    if (screen.type === 'flow_map') return renderFlowMap(screen);
    if (screen.type === 'management_cycle') return renderManagementCycle(screen);
    if (screen.type === 'causal_loop') return renderCausalLoop(screen);
    if (screen.type === 'gate_board') return renderGateBoard(screen);
    if (screen.type === 'version_lifecycle') return renderVersionLifecycle(screen);
    if (screen.type === 'micro_check' || screen.type === 'quiz') return renderChoice(screen);
    if (screen.type === 'micro_practice') return renderPractice(screen);
    if (screen.type === 'case_story') return renderCase(screen);
    if (screen.type === 'comparison') return renderComparison(screen);
    if (screen.type === 'anti_patterns') return renderAntiPatterns(screen);
    if (screen.type === 'summary') return renderSummary(screen);
    if (screen.type === 'practice_handoff') return renderPracticeHandoff(screen);
    if (screen.type === 'lesson_result') return renderLessonResult(screen);
    return renderGeneric(screen);
  }

  function screenCanContinue(screen,data){
    const flow = readFlow(runtime.lessonId);
    if (screen.type === 'micro_check' || screen.type === 'quiz') {
      if (flow.checked[screen.id]) return {ok:true};
      if (!flow.answers[screen.id]) return {ok:false,message:'Сначала выберите ответ.'};
    }
    if (screen.type === 'micro_practice') {
      const required = Number(data.completion && data.completion.minimum_practice_fields || 4);
      const filled = (screen.fields || []).filter(function(field){ return String(flow.practice[field.id] || '').trim(); }).length;
      if (filled < required) return {ok:false,message:'Заполните минимум ' + required + ' поля.'};
    }
    return {ok:true};
  }

  function lessonTop(screen,data){
    const percent = Math.round((runtime.screenIndex+1)/data.screens.length*100);
    return '<div class="ba-learning-topline"><button class="ba-back" onclick="ArchitectureM01Staging.openModule()">← К модулю</button><span data-ba-m01-saved class="ba-learning-saved">' + escapeHtml(runtime.saveLabel) + '</span><button class="ba-learning-reset" onclick="ArchitectureM01Staging.resetLesson()" aria-label="Сбросить урок">↺</button></div>' +
      segmentProgressHtml(screen,data) + '<div class="ba-learning-meta"><span>' + escapeHtml(screen.segment) + '</span><b>' + percent + '%</b></div>';
  }

  function lessonBottom(screen,data){
    const flow = readFlow(runtime.lessonId);
    let label = screen.primary_action || 'Продолжить';
    if ((screen.type === 'micro_check' || screen.type === 'quiz') && !flow.checked[screen.id]) label = 'Проверить ответ';
    if (runtime.screenIndex === data.screens.length-1) label = lessonIndex(runtime.lessonId) === runtime.manifest.lessons.length-1 ? 'Завершить модуль' : 'Перейти к следующему уроку';
    return '<div class="ba-learning-bottom"><button class="ba-btn ba-btn-light ba-learning-prev" onclick="ArchitectureM01Staging.previous()" ' + (runtime.screenIndex===0?'disabled':'') + '>←</button><button class="ba-btn ba-btn-primary ba-learning-next" data-ba-m01-next>' + escapeHtml(label) + '</button><small>Экран ' + (runtime.screenIndex+1) + ' из ' + data.screens.length + '</small></div>';
  }

  function bindScreenEvents(screen,data){
    document.querySelectorAll('[data-ba-m01-answer]').forEach(function(button){
      button.addEventListener('click',function(){
        if (readFlow(runtime.lessonId).checked[screen.id]) return;
        const answer = String(button.getAttribute('data-ba-m01-answer') || '');
        persistFlow(runtime.lessonId,function(flow){ flow.answers[screen.id] = answer; },{sync:false});
        renderLessonScreen(runtime.screenIndex,true);
      });
    });
    document.querySelectorAll('[data-ba-m01-field]').forEach(function(field){
      field.addEventListener('input',function(){
        const id = String(field.getAttribute('data-ba-m01-field') || '');
        persistFlow(runtime.lessonId,function(flow){ flow.practice[id] = field.value; });
        const status = document.querySelector('.ba-learning-form-status b');
        if (status) {
          const current = readFlow(runtime.lessonId);
          const filled = (screen.fields || []).filter(function(item){ return String(current.practice[item.id] || '').trim(); }).length;
          status.textContent = 'Заполнено ' + filled + ' из ' + (screen.fields || []).length;
        }
      });
    });
    const next = document.querySelector('[data-ba-m01-next]');
    if (next) next.addEventListener('click',function(){ handleNext(screen,data); });
  }

  function handleNext(screen,data){
    const flow = readFlow(runtime.lessonId);
    if ((screen.type === 'micro_check' || screen.type === 'quiz') && !flow.checked[screen.id]) {
      const ready = screenCanContinue(screen,data);
      if (!ready.ok) return safeAlert(ready.message);
      persistFlow(runtime.lessonId,function(nextFlow){ nextFlow.checked[screen.id] = true; });
      return renderLessonScreen(runtime.screenIndex,true);
    }
    const ready = screenCanContinue(screen,data);
    if (!ready.ok) return safeAlert(ready.message);
    if (runtime.screenIndex >= data.screens.length-1) {
      persistFlow(runtime.lessonId,function(nextFlow,entry){
        nextFlow.completedAt = nextFlow.completedAt || nowIso();
        entry.completedAt = entry.completedAt || nextFlow.completedAt;
        if (!entry.completedStages.includes('learning_flow_complete')) entry.completedStages.push('learning_flow_complete');
      });
      const index = lessonIndex(runtime.lessonId);
      if (index >= 0 && index < runtime.manifest.lessons.length-1) return openLesson(runtime.manifest.lessons[index+1].lesson_id);
      return renderModule();
    }
    renderLessonScreen(runtime.screenIndex+1,true);
  }

  async function renderLessonScreen(requestedIndex,smooth){
    try {
      const data = await ensureLesson(runtime.lessonId);
      const flow = readFlow(runtime.lessonId);
      const requestedFromUrl = Number(queryValue(SCREEN_PARAM));
      const fallback = Number.isFinite(requestedFromUrl) && requestedFromUrl >= 1 ? requestedFromUrl-1 : flow.screenIndex;
      runtime.screenIndex = clamp(requestedIndex === undefined ? fallback : requestedIndex,0,data.screens.length-1);
      const screen = data.screens[runtime.screenIndex];
      persistFlow(runtime.lessonId,function(nextFlow){ nextFlow.screenIndex = runtime.screenIndex; },{sync:false});
      setPreviewQuery(true,runtime.lessonId,runtime.screenIndex);
      renderWithShell(lessonTop(screen,data) + screenHtml(screen) + lessonBottom(screen,data) + '<div class="ba-footer-space"></div>',{smooth:Boolean(smooth)});
      bindScreenEvents(screen,data);
    } catch(error){ renderError(error); }
  }

  async function openLesson(lessonId){
    try {
      await ensureManifest();
      const meta = lessonMeta(lessonId);
      if (!meta) throw new Error('Урок не найден: ' + lessonId);
      if (!lessonUnlocked(lessonId)) { safeAlert('Сначала завершите предыдущий урок.'); return renderModule(); }
      runtime.lessonId = lessonId;
      const flow = readFlow(lessonId);
      await ensureLesson(lessonId);
      renderLessonScreen(Number(flow.screenIndex || 0));
    } catch(error){ renderError(error); }
  }

  function previous(){ if (runtime.screenIndex > 0) renderLessonScreen(runtime.screenIndex-1,true); }

  function resetLesson(){
    if (!runtime.lessonId) return;
    const message = 'Сбросить ответы и практику этого урока? Остальные уроки не изменятся.';
    const act = function(){
      const root = readRoot(), entry = ensureLessonEntry(root,runtime.lessonId);
      entry.learningFlow = blankFlow(); entry.completedAt = null;
      entry.completedStages = entry.completedStages.filter(function(id){ return id !== 'learning_flow_started' && id !== 'learning_flow_complete'; });
      root.updatedAt = nowIso();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(root));
      runtime.screenIndex = 0; scheduleRemoteSync(); renderLessonScreen(0);
    };
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showConfirm === 'function') return tg.showConfirm(message,function(ok){ if(ok) act(); });
    } catch(e) {}
    if (window.confirm(message)) act();
  }

  function resetModule(){
    const message = 'Сбросить прогресс всех шести staging-уроков M01? Остальной курс не изменится.';
    const act = function(){
      const root = readRoot();
      (runtime.manifest.lessons || []).forEach(function(meta){
        if (root.lessons[meta.lesson_id]) {
          const entry = ensureLessonEntry(root,meta.lesson_id);
          entry.learningFlow = blankFlow(); entry.completedAt = null;
          entry.completedStages = entry.completedStages.filter(function(id){ return id !== 'learning_flow_started' && id !== 'learning_flow_complete'; });
        }
      });
      root.updatedAt = nowIso(); localStorage.setItem(STORAGE_KEY,JSON.stringify(root)); scheduleRemoteSync(); renderModule();
    };
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showConfirm === 'function') return tg.showConfirm(message,function(ok){ if(ok) act(); });
    } catch(e) {}
    if (window.confirm(message)) act();
  }

  function openCapstone(){
    const progress = moduleProgress();
    if (!reviewUnlock() && progress.completed < progress.total) return safeAlert('Сначала завершите все шесть уроков.');
    const artefacts = (runtime.manifest.lessons || []).map(function(meta,index){
      const data = runtime.lessons[meta.lesson_id];
      const last = data && data.screens ? data.screens.find(function(s){ return s.type === 'lesson_result'; }) : null;
      const label = last && last.artifact ? last.artifact : (meta.result || meta.title);
      return '<li><span>' + (index+1) + '</span><div><b>' + escapeHtml(meta.title) + '</b><small>' + escapeHtml(label) + '</small></div></li>';
    }).join('');
    const html = moduleHeader() + '<section class="ba-learning-hero ba-learning-screen"><p class="ba-eyebrow">ИТОГОВАЯ РАБОТА M01</p><h1>' + escapeHtml(runtime.manifest.capstone) + '</h1><p class="ba-learning-lead">Соедините шесть результатов по одному управленческому решению. Проверяется целостность и качество решения, а не обязательный зелёный цвет.</p></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">ШЕСТЬ ЧАСТЕЙ ПАКЕТА</p><ol class="ba-m01-capstone-list">' + artefacts + '</ol></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">ПРАВИЛО ЗАЧЁТА</p><h2>Правильный итог может быть STOP</h2><p>Артефакты относятся к одному объекту, минимум три вывода подтверждены выборкой, наблюдением или сверкой, назначен один владелец и принято одно реальное решение. Красный gate обязан изменить разрешённый шаг.</p><div class="ba-actions">' + practiceButtons() + '</div></section>' +
      '<div class="ba-actions"><button class="ba-btn ba-btn-light" onclick="ArchitectureM01Staging.openModule()">← К модулю</button></div><div class="ba-footer-space"></div>';
    setPreviewQuery(true,'',null); renderWithShell(html);
  }

  function renderError(error){
    console.error('BA_M01_STAGING_ERROR',error);
    renderWithShell('<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">ОШИБКА STAGING</p><h2>Учебный маршрут не открылся</h2><p>' + escapeHtml(error && error.message ? error.message : error) + '</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="ArchitectureM01Staging.openModule()">Повторить</button><button class="ba-btn ba-btn-light" onclick="ArchitectureM01Staging.exit()">К курсу</button></div></section>');
  }

  function exitPreview(){
    setPreviewQuery(false,'',null);
    runtime.lessonId = '';
    if (runtime.originalRenderHome) {
      const result = runtime.originalRenderHome();
      setTimeout(injectModuleCard,0);
      return result;
    }
    const api = window.BusinessArchitecture;
    if (api && typeof api.renderHome === 'function') return api.renderHome();
    if (runtime.originalOpenAppHome) return runtime.originalOpenAppHome();
  }

  function previewCardHtml(){
    const progress = runtime.manifest ? moduleProgress() : {completed:0,total:6,percent:0};
    return '<section class="ba-card ba-m01-preview-card" data-ba-m01-preview-card><div><p class="ba-eyebrow">STAGING · LEARNING DESIGN SYSTEM</p><h2>M01 · Бизнес как метасистема</h2><p>Шесть связанных уроков, 102 mobile-first экрана и один итоговый управленческий пакет.</p></div><div class="ba-m01-preview-progress"><b>' + progress.percent + '%</b><small>' + progress.completed + ' из ' + progress.total + ' уроков</small></div><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="ArchitectureM01Staging.openModule()">' + (progress.percent?'Продолжить M01':'Открыть M01') + '</button></div></section>';
  }

  function injectModuleCard(){
    if (!(adminMode() || previewRequested())) return;
    document.querySelectorAll('[data-ba-learning-preview-card]').forEach(function(node){ node.remove(); });
    if (document.querySelector('[data-ba-m01-preview-card]')) return;
    const root = document.querySelector('.ba-root .ba-shell');
    if (!root) return;
    const holder = document.createElement('div'); holder.innerHTML = previewCardHtml();
    const hero = root.querySelector('.ba-hero');
    if (hero && hero.parentNode) hero.parentNode.insertBefore(holder.firstElementChild,hero.nextSibling);
    else root.insertBefore(holder.firstElementChild,root.firstChild);
  }

  async function openFromQuery(){
    await ensureManifest();
    const lessonId = queryValue(LESSON_PARAM);
    if (lessonId) return openLesson(lessonId);
    return renderModule();
  }

  function install(){
    if (runtime.installed) return;
    const api = window.BusinessArchitecture;
    if (!api) return setTimeout(install,120);
    runtime.installed = true;
    runtime.originalRenderHome = typeof api.renderHome === 'function' ? api.renderHome.bind(api) : null;
    runtime.originalOpenAppHome = typeof api.openAppHome === 'function' ? api.openAppHome.bind(api) : null;
    if (runtime.originalRenderHome) {
      api.renderHome = async function(){
        const result = await runtime.originalRenderHome.apply(null,arguments);
        setTimeout(injectModuleCard,0);
        return result;
      };
      window.renderNoBusinessV40 = api.renderHome;
      try { renderNoBusinessV40 = api.renderHome; } catch(e) {}
    }
    window.ArchitectureM01Staging = {
      version:RELEASE,
      openModule:renderModule,
      openLesson:openLesson,
      openCapstone:openCapstone,
      previous:previous,
      resetLesson:resetLesson,
      resetModule:resetModule,
      getProgress:function(){ return runtime.manifest ? moduleProgress() : null; },
      exit:exitPreview
    };
    ensureManifest().then(function(){
      if (previewRequested()) setTimeout(openFromQuery,180);
      else if (adminMode()) setTimeout(injectModuleCard,500);
    }).catch(function(error){ console.warn('BA_M01_MANIFEST_ERROR',error); });
  }

  install();
})();
