/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — Learning Design staging adapter
   Изолированный mobile-first экранный урок M01L01.
   Активируется только через admin mode или query:
   ?ba_learning_preview=m01l01
   ========================================================= */
(function(){
  'use strict';

  const RELEASE = 'lds-m01l01-staging-20260731';
  const STORAGE_KEY = 'architecture_business_progress_v2';
  const LESSON_ID = 'M01L01';
  const DATA_URL = 'content/business_architecture/learning/M01L01.json';
  const PREVIEW_PARAM = 'ba_learning_preview';
  const PREVIEW_VALUE = 'm01l01';
  const SCREEN_PARAM = 'ba_learning_screen';
  const SYNC_DELAY_MS = 900;

  const runtime = {
    data: null,
    screenIndex: 0,
    syncTimer: null,
    saveLabel: 'Сохранено на устройстве',
    installed: false,
    originalRenderHome: null,
    originalOpenAppHome: null
  };

  function escapeHtml(value){
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, Number(value) || 0));
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

  function hasTelegramSession(){
    try {
      return Boolean(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
    } catch(e){
      return false;
    }
  }

  function queryValue(name){
    try { return new URL(window.location.href).searchParams.get(name) || ''; }
    catch(e){ return ''; }
  }

  function previewRequested(){
    return String(queryValue(PREVIEW_PARAM)).toLowerCase() === PREVIEW_VALUE;
  }

  function adminMode(){
    try {
      return typeof window.isAdminMode === 'function' && Boolean(window.isAdminMode());
    } catch(e){
      return false;
    }
  }

  function setQueryPreview(active){
    try {
      const url = new URL(window.location.href);
      if (active) url.searchParams.set(PREVIEW_PARAM, PREVIEW_VALUE);
      else {
        url.searchParams.delete(PREVIEW_PARAM);
        url.searchParams.delete(SCREEN_PARAM);
      }
      window.history.replaceState({}, '', url.toString());
    } catch(e) {}
  }

  function blankRoot(){
    return {
      version: 1,
      release: RELEASE,
      selectedRoute: '',
      currentLessonId: LESSON_ID,
      updatedAt: nowIso(),
      lessons: {}
    };
  }

  function readRoot(){
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return blankRoot();
      if (!parsed.lessons || typeof parsed.lessons !== 'object' || Array.isArray(parsed.lessons)) parsed.lessons = {};
      return parsed;
    } catch(e){
      console.warn('BA_LEARNING_PROGRESS_READ_ERROR', e);
      return blankRoot();
    }
  }

  function blankFlow(){
    return {
      schemaVersion: 1,
      release: RELEASE,
      screenIndex: 0,
      answers: {},
      checked: {},
      practice: {},
      startedAt: null,
      completedAt: null,
      updatedAt: null
    };
  }

  function normalizeFlow(value){
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.assign(blankFlow(), source, {
      answers: source.answers && typeof source.answers === 'object' ? source.answers : {},
      checked: source.checked && typeof source.checked === 'object' ? source.checked : {},
      practice: source.practice && typeof source.practice === 'object' ? source.practice : {}
    });
  }

  function readFlow(){
    const root = readRoot();
    const entry = root.lessons[LESSON_ID] && typeof root.lessons[LESSON_ID] === 'object'
      ? root.lessons[LESSON_ID]
      : {};
    return normalizeFlow(entry.learningFlow);
  }

  function ensureLessonEntry(root){
    const existing = root.lessons[LESSON_ID] && typeof root.lessons[LESSON_ID] === 'object'
      ? root.lessons[LESSON_ID]
      : {};
    const entry = Object.assign({
      completedStages: [],
      lastStageId: 'learning_screen_flow',
      completedAt: null,
      systemAnalysis: {screenIndex: 0},
      examplesOpened: [],
      quiz: {draft: {}, order: {}, attempts: [], lastResult: null, reviewQuestionIds: [], reviewMode: ''},
      workspace: {route: '', sectionIndex: 0, sections: {}, final: {}, completedAt: null}
    }, existing);
    entry.completedStages = Array.isArray(entry.completedStages) ? entry.completedStages.slice() : [];
    entry.learningFlow = normalizeFlow(entry.learningFlow);
    root.lessons[LESSON_ID] = entry;
    return entry;
  }

  function updateSaveLabel(text){
    runtime.saveLabel = String(text || 'Сохранено');
    document.querySelectorAll('[data-ba-learning-saved]').forEach(function(node){
      node.textContent = runtime.saveLabel;
    });
  }

  function scheduleRemoteSync(){
    if (runtime.syncTimer) clearTimeout(runtime.syncTimer);
    if (!hasTelegramSession()) {
      updateSaveLabel('Сохранено на устройстве');
      return;
    }
    updateSaveLabel('Синхронизируем…');
    runtime.syncTimer = setTimeout(function(){
      runtime.syncTimer = null;
      const api = window.BusinessArchitecture;
      if (!api || typeof api.syncNow !== 'function') {
        updateSaveLabel('Сохранено на устройстве');
        return;
      }
      Promise.resolve(api.syncNow()).then(function(ok){
        updateSaveLabel(ok === false ? 'Сохранено на устройстве' : 'Сохранено');
      }).catch(function(error){
        console.warn('BA_LEARNING_SYNC_ERROR', error);
        updateSaveLabel('Сохранено на устройстве');
      });
    }, SYNC_DELAY_MS);
  }

  function persistFlow(mutator, options){
    const opts = options || {};
    const root = readRoot();
    const entry = ensureLessonEntry(root);
    const flow = normalizeFlow(entry.learningFlow);
    if (!flow.startedAt) flow.startedAt = nowIso();
    if (typeof mutator === 'function') mutator(flow, entry, root);
    flow.release = RELEASE;
    flow.updatedAt = nowIso();
    entry.learningFlow = flow;
    entry.lastStageId = 'learning_screen_flow';
    if (!entry.completedStages.includes('learning_flow_started')) entry.completedStages.push('learning_flow_started');
    root.release = root.release || RELEASE;
    root.currentLessonId = LESSON_ID;
    root.updatedAt = flow.updatedAt;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
      updateSaveLabel('Сохранено на устройстве');
    } catch(e){
      console.warn('BA_LEARNING_PROGRESS_WRITE_ERROR', e);
      updateSaveLabel('Не удалось сохранить');
    }
    if (opts.sync !== false) scheduleRemoteSync();
    return flow;
  }

  function resetProgress(){
    const root = readRoot();
    const entry = ensureLessonEntry(root);
    entry.learningFlow = blankFlow();
    entry.completedAt = null;
    entry.completedStages = (entry.completedStages || []).filter(function(stageId){
      return stageId !== 'learning_flow_started' && stageId !== 'learning_flow_complete';
    });
    entry.lastStageId = 'learning_screen_flow';
    root.currentLessonId = LESSON_ID;
    root.updatedAt = nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(root)); } catch(e) {}
    runtime.screenIndex = 0;
    updateSaveLabel('Прогресс сброшен');
    scheduleRemoteSync();
    renderScreen(0);
  }

  function requestReset(){
    const message = 'Сбросить ответы и практику этого эталонного урока? Остальной прогресс курса не изменится.';
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showConfirm === 'function') {
        tg.showConfirm(message, function(confirmed){ if (confirmed) resetProgress(); });
        return;
      }
    } catch(e) {}
    if (window.confirm(message)) resetProgress();
  }

  async function loadLesson(){
    if (runtime.data) return runtime.data;
    const divider = DATA_URL.includes('?') ? '&' : '?';
    const response = await fetch(DATA_URL + divider + 'v=' + encodeURIComponent(RELEASE), {cache: 'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить эталонный урок (' + response.status + ').');
    const data = await response.json();
    if (!data || !Array.isArray(data.screens) || data.screens.length === 0) {
      throw new Error('Файл урока не содержит экранов.');
    }
    runtime.data = data;
    return data;
  }

  function renderWithShell(content, options){
    const opts = options || {};
    const wrapped = '<div class="ba-root"><div class="ba-shell ba-learning-shell">' + content + '</div></div>';
    if (typeof window.shell === 'function') window.shell(wrapped, 'home');
    else {
      const app = document.getElementById('app');
      if (app) app.innerHTML = wrapped;
    }
    requestAnimationFrame(function(){
      const target = document.querySelector('.ba-learning-screen');
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({block: 'start', behavior: opts.smooth ? 'smooth' : 'auto'});
      else window.scrollTo(0, 0);
    });
    setTimeout(function(){ updateSaveLabel(runtime.saveLabel); }, 0);
  }

  function segmentIndex(screen){
    const data = runtime.data;
    return Math.max(0, (data.segments || []).indexOf(screen.segment));
  }

  function segmentProgressHtml(screen){
    const data = runtime.data;
    const active = segmentIndex(screen);
    return '<div class="ba-learning-segments" aria-label="Этапы урока">' +
      (data.segments || []).map(function(segment, index){
        const cls = index < active ? 'is-done' : (index === active ? 'is-active' : '');
        return '<span class="' + cls + '" title="' + escapeHtml(segment) + '"></span>';
      }).join('') +
    '</div>';
  }

  function paragraphsHtml(items){
    return (items || []).map(function(item){ return '<p>' + escapeHtml(item) + '</p>'; }).join('');
  }

  function chipsHtml(items){
    if (!Array.isArray(items) || !items.length) return '';
    return '<div class="ba-learning-chips">' + items.map(function(item){
      return '<span>' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function stepsHtml(items){
    if (!Array.isArray(items) || !items.length) return '';
    return '<ol class="ba-learning-steps">' + items.map(function(item){
      return '<li><span></span><b>' + escapeHtml(item) + '</b></li>';
    }).join('') + '</ol>';
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

  function renderCover(screen){
    return '<section class="ba-learning-hero ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p>' +
      '<h1>' + escapeHtml(screen.title) + '</h1>' +
      '<p class="ba-learning-lead">' + escapeHtml(screen.subtitle) + '</p>' +
      '<div class="ba-learning-question"><small>Управленческий вопрос</small><b>' + escapeHtml(screen.management_question) + '</b></div>' +
      '<div class="ba-learning-result"><small>Результат урока</small><b>' + escapeHtml(screen.result) + '</b></div>' +
      (screen.estimated_time ? '<p class="ba-learning-time">' + escapeHtml(screen.estimated_time) + '</p>' : '') +
    '</section>';
  }

  function renderSystemMap(screen){
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-boundary-map" role="img" aria-label="Объект управления внутри внешней среды, входы, выходы и ограничения">' +
        '<span class="is-top">Внешняя среда</span><span class="is-left">Входы</span><span class="is-right">Выходы</span><span class="is-bottom">Ограничения</span>' +
        '<strong>ОБЪЕКТ<br>УПРАВЛЕНИЯ</strong>' +
      '</div>' +
      '<div class="ba-learning-grid ba-learning-grid-2">' + (screen.legend || []).map(function(item){
        return '<article><b>' + escapeHtml(item.label) + '</b><small>' + escapeHtml(item.value) + '</small></article>';
      }).join('') + '</div>' +
      '<div class="ba-note ba-note-teal">' + escapeHtml(screen.takeaway) + '</div>' +
    '</section>';
  }

  function renderChoice(screen){
    const flow = readFlow();
    const answer = flow.answers[screen.id] || '';
    const checked = Boolean(flow.checked[screen.id]);
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<p>' + escapeHtml(screen.question) + '</p>' +
      '<div class="ba-learning-options">' + (screen.options || []).map(function(option){
        const classes = ['ba-learning-option'];
        if (answer === option.id) classes.push('is-selected');
        if (checked && option.id === screen.correct) classes.push('is-correct');
        if (checked && answer === option.id && option.id !== screen.correct) classes.push('is-wrong');
        return '<button type="button" class="' + classes.join(' ') + '" data-ba-learning-answer="' + escapeHtml(option.id) + '" ' + (checked ? 'disabled' : '') + '>' +
          '<span>' + escapeHtml(option.id) + '</span><b>' + escapeHtml(option.text) + '</b></button>';
      }).join('') + '</div>' +
      (checked ? '<div class="ba-note ' + (answer === screen.correct ? 'ba-note-teal' : 'ba-note-danger') + '">' +
        escapeHtml(answer === screen.correct ? screen.correct_feedback : screen.wrong_feedback) + '</div>' : '') +
    '</section>';
  }

  function renderPractice(screen){
    const flow = readFlow();
    const practice = flow.practice || {};
    const filled = (screen.fields || []).filter(function(field){ return String(practice[field.id] || '').trim(); }).length;
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<p>' + escapeHtml(screen.instruction) + '</p>' +
      '<div class="ba-learning-form">' + (screen.fields || []).map(function(field){
        return '<label><span>' + escapeHtml(field.label) + '</span><textarea rows="3" data-ba-learning-field="' + escapeHtml(field.id) + '" placeholder="' + escapeHtml(field.placeholder || '') + '">' + escapeHtml(practice[field.id] || '') + '</textarea></label>';
      }).join('') + '</div>' +
      '<div class="ba-learning-form-status"><span data-ba-learning-saved>' + escapeHtml(runtime.saveLabel) + '</span><b>Заполнено ' + filled + ' из ' + (screen.fields || []).length + '</b></div>' +
      '<div class="ba-note ba-note-teal">Минимум для продолжения: ' + escapeHtml(screen.completion || '4 поля') + '.</div>' +
    '</section>';
  }

  function renderCase(screen){
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-case-row"><b>Было</b><span>' + escapeHtml(screen.before) + '</span></div>' +
      '<div class="ba-learning-case-row"><b>Факты</b><span>' + (screen.evidence || []).map(function(item){ return '• ' + escapeHtml(item); }).join('<br>') + '</span></div>' +
      '<div class="ba-learning-case-row"><b>Решение</b><span>' + escapeHtml(screen.decision) + '</span></div>' +
      '<div class="ba-learning-case-row"><b>Стало</b><span>' + escapeHtml(screen.after) + '</span></div>' +
    '</section>';
  }

  function renderComparison(screen){
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-grid ba-learning-grid-2">' + (screen.cards || []).map(function(card){
        const details = card.signal
          ? '<small>' + escapeHtml(card.signal) + '</small><span class="ba-learning-mode">' + escapeHtml(card.mode) + '</span>'
          : '<ul>' + (card.items || []).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
        return '<article><b>' + escapeHtml(card.title) + '</b>' + details + '</article>';
      }).join('') + '</div>' +
      (screen.decision_rule ? '<div class="ba-note ba-note-teal">' + escapeHtml(screen.decision_rule) + '</div>' : '') +
    '</section>';
  }

  function renderAntiPatterns(screen){
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-grid">' + (screen.patterns || []).map(function(item){
        return '<article><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.consequence) + '</small></article>';
      }).join('') + '</div>' +
    '</section>';
  }

  function renderSummary(screen){
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<ol class="ba-learning-summary">' + (screen.takeaways || []).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol>' +
      '<div class="ba-note ba-note-teal"><b>Создано:</b> ' + escapeHtml(screen.artifact) + '</div>' +
    '</section>';
  }

  function renderPracticeHandoff(screen){
    const assets = runtime.data.assets || {};
    const buttons = [];
    if (assets.practice_template) buttons.push('<a class="ba-btn ba-btn-primary" href="' + escapeHtml(assets.practice_template) + '" download>Скачать пустой шаблон</a>');
    if (assets.practice_example) buttons.push('<a class="ba-btn ba-btn-light" href="' + escapeHtml(assets.practice_example) + '" download>Скачать заполненный пример</a>');
    return '<section class="ba-card ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      paragraphsHtml(screen.body) + stepsHtml(screen.steps) +
      '<div class="ba-actions ba-learning-downloads">' + buttons.join('') + '</div>' +
      '<p class="ba-learning-caption">Сначала посмотрите структуру пустого файла, затем сравните демонстрационный пример. Цифры примера не являются нормативом.</p>' +
    '</section>';
  }

  function renderLessonResult(screen){
    return '<section class="ba-learning-hero ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      '<div class="ba-learning-result"><small>' + escapeHtml(screen.status) + '</small><b>' + escapeHtml(screen.artifact) + '</b></div>' +
      '<p>' + escapeHtml(screen.next_use) + '</p>' +
      '<div class="ba-learning-question"><b>' + escapeHtml(screen.business_note) + '</b></div>' +
    '</section>';
  }

  function renderGeneric(screen){
    const hero = screen.type === 'key_idea';
    return '<section class="' + (hero ? 'ba-learning-hero' : 'ba-card') + ' ba-learning-screen">' +
      '<p class="ba-eyebrow">' + escapeHtml(screen.eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
      paragraphsHtml(screen.body) + genericExtras(screen) +
    '</section>';
  }

  function screenHtml(screen){
    if (screen.type === 'lesson_cover') return renderCover(screen);
    if (screen.type === 'system_map') return renderSystemMap(screen);
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

  function nextButtonState(screen){
    const flow = readFlow();
    if (screen.type === 'micro_check' || screen.type === 'quiz') {
      if (!flow.checked[screen.id]) return {label: 'Проверить ответ', action: 'check'};
    }
    if (screen.type === 'micro_practice') return {label: screen.primary_action || 'Сохранить карту', action: 'practice'};
    if (runtime.screenIndex === runtime.data.screens.length - 1) return {label: 'Вернуться к курсу', action: 'exit'};
    return {label: screen.primary_action || 'Продолжить', action: 'next'};
  }

  function screenCanContinue(screen){
    const flow = readFlow();
    if (screen.type === 'micro_check' || screen.type === 'quiz') {
      if (flow.checked[screen.id]) return {ok: true};
      if (!flow.answers[screen.id]) return {ok: false, message: 'Сначала выберите ответ.'};
      return {ok: true};
    }
    if (screen.type === 'micro_practice') {
      const required = Number(runtime.data.completion && runtime.data.completion.minimum_practice_fields || 4);
      const filled = (screen.fields || []).filter(function(field){ return String(flow.practice[field.id] || '').trim(); }).length;
      if (filled < required) return {ok: false, message: 'Заполните минимум ' + required + ' поля.'};
    }
    return {ok: true};
  }

  function topHtml(screen){
    const percent = Math.round(((runtime.screenIndex + 1) / runtime.data.screens.length) * 100);
    return '<div class="ba-learning-topline">' +
      '<button type="button" class="ba-back" onclick="ArchitectureLearningStaging.exit()">← К курсу</button>' +
      '<span data-ba-learning-saved class="ba-learning-saved">' + escapeHtml(runtime.saveLabel) + '</span>' +
      '<button type="button" class="ba-learning-reset" onclick="ArchitectureLearningStaging.reset()" aria-label="Сбросить прогресс">↺</button>' +
    '</div>' +
    segmentProgressHtml(screen) +
    '<div class="ba-learning-meta"><span>' + escapeHtml(screen.segment) + '</span><b>' + percent + '%</b></div>';
  }

  function bottomHtml(screen){
    const state = nextButtonState(screen);
    const disabledBack = runtime.screenIndex === 0 ? ' disabled' : '';
    return '<div class="ba-learning-bottom">' +
      '<button type="button" class="ba-btn ba-btn-light ba-learning-prev" onclick="ArchitectureLearningStaging.previous()"' + disabledBack + '>←</button>' +
      '<button type="button" class="ba-btn ba-btn-primary ba-learning-next" data-ba-learning-next data-action="' + state.action + '">' + escapeHtml(state.label) + '</button>' +
      '<small>Экран ' + (runtime.screenIndex + 1) + ' из ' + runtime.data.screens.length + '</small>' +
    '</div>';
  }

  function bindScreenEvents(screen){
    document.querySelectorAll('[data-ba-learning-answer]').forEach(function(button){
      button.addEventListener('click', function(){
        const answer = String(button.getAttribute('data-ba-learning-answer') || '');
        persistFlow(function(flow){ flow.answers[screen.id] = answer; }, {sync: false});
        renderScreen(runtime.screenIndex, true);
      });
    });

    document.querySelectorAll('[data-ba-learning-field]').forEach(function(field){
      field.addEventListener('input', function(){
        const id = String(field.getAttribute('data-ba-learning-field') || '');
        persistFlow(function(flow){ flow.practice[id] = field.value; });
        const status = document.querySelector('.ba-learning-form-status b');
        if (status) {
          const flow = readFlow();
          const filled = (screen.fields || []).filter(function(item){ return String(flow.practice[item.id] || '').trim(); }).length;
          status.textContent = 'Заполнено ' + filled + ' из ' + (screen.fields || []).length;
        }
      });
    });

    const next = document.querySelector('[data-ba-learning-next]');
    if (next) next.addEventListener('click', function(){ handleNext(screen); });
  }

  function handleNext(screen){
    const flow = readFlow();
    if ((screen.type === 'micro_check' || screen.type === 'quiz') && !flow.checked[screen.id]) {
      const readiness = screenCanContinue(screen);
      if (!readiness.ok) return safeAlert(readiness.message);
      persistFlow(function(nextFlow){ nextFlow.checked[screen.id] = true; });
      renderScreen(runtime.screenIndex, true);
      return;
    }

    const readiness = screenCanContinue(screen);
    if (!readiness.ok) return safeAlert(readiness.message);

    if (runtime.screenIndex >= runtime.data.screens.length - 1) {
      persistFlow(function(nextFlow, entry){
        nextFlow.completedAt = nextFlow.completedAt || nowIso();
        entry.completedAt = entry.completedAt || nextFlow.completedAt;
        if (!entry.completedStages.includes('learning_flow_complete')) entry.completedStages.push('learning_flow_complete');
      });
      return exitPreview();
    }

    renderScreen(runtime.screenIndex + 1, true);
  }

  function renderError(error){
    console.error('BA_LEARNING_STAGING_ERROR', error);
    renderWithShell(
      '<section class="ba-card ba-learning-screen"><p class="ba-eyebrow">ОШИБКА STAGING</p><h2>Эталонный урок не открылся</h2>' +
      '<p>' + escapeHtml(error && error.message ? error.message : error) + '</p>' +
      '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="ArchitectureLearningStaging.open()">Повторить</button>' +
      '<button class="ba-btn ba-btn-light" onclick="ArchitectureLearningStaging.exit()">К курсу</button></div></section>'
    );
  }

  async function renderScreen(requestedIndex, preservePosition){
    try {
      await loadLesson();
      const saved = readFlow();
      const requestedFromUrl = Number(queryValue(SCREEN_PARAM));
      const fallback = Number.isFinite(requestedFromUrl) && requestedFromUrl >= 1 ? requestedFromUrl - 1 : saved.screenIndex;
      runtime.screenIndex = clamp(requestedIndex === undefined ? fallback : requestedIndex, 0, runtime.data.screens.length - 1);
      const screen = runtime.data.screens[runtime.screenIndex];
      persistFlow(function(flow){ flow.screenIndex = runtime.screenIndex; }, {sync: false});
      const html = topHtml(screen) + screenHtml(screen) + bottomHtml(screen) + '<div class="ba-footer-space"></div>';
      renderWithShell(html, {smooth: Boolean(preservePosition)});
      bindScreenEvents(screen);
    } catch(error){
      renderError(error);
    }
  }

  function previous(){
    if (runtime.screenIndex > 0) renderScreen(runtime.screenIndex - 1, true);
  }

  function openPreview(){
    setQueryPreview(true);
    loadLesson().then(function(){
      const flow = readFlow();
      const requested = Number(queryValue(SCREEN_PARAM));
      renderScreen(Number.isFinite(requested) && requested >= 1 ? requested - 1 : (flow.screenIndex || 0));
    }).catch(renderError);
  }

  function exitPreview(){
    setQueryPreview(false);
    const api = window.BusinessArchitecture;
    if (runtime.originalRenderHome) return runtime.originalRenderHome();
    if (api && typeof api.renderHome === 'function') return api.renderHome();
    if (runtime.originalOpenAppHome) return runtime.originalOpenAppHome();
  }

  function previewCardHtml(){
    const flow = readFlow();
    const completed = Boolean(flow.completedAt);
    const percent = runtime.data && runtime.data.screens.length
      ? Math.round(((Number(flow.screenIndex || 0) + 1) / runtime.data.screens.length) * 100)
      : 0;
    return '<section class="ba-card ba-learning-preview-card" data-ba-learning-preview-card>' +
      '<div><p class="ba-eyebrow">STAGING · НОВЫЙ ФОРМАТ ОБУЧЕНИЯ</p><h2>Модуль 1 · Урок 1: границы системы</h2>' +
      '<p>17 mobile-first экранов: ситуация → модель → пример → практика → проверка → результат.</p></div>' +
      '<div class="ba-learning-preview-meta"><span class="ba-status ' + (completed ? 'is-done' : 'is-active') + '">' + (completed ? 'проверено' : 'тестирование') + '</span><b>' + clamp(percent, 0, 100) + '%</b></div>' +
      '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="ArchitectureLearningStaging.open()">' + (flow.startedAt ? 'Продолжить эталонный урок' : 'Открыть эталонный урок') + '</button></div>' +
    '</section>';
  }

  function injectPreviewCard(){
    if (!(adminMode() || previewRequested())) return;
    if (document.querySelector('[data-ba-learning-preview-card]')) return;
    const root = document.querySelector('.ba-root .ba-shell');
    if (!root) return;
    const hero = root.querySelector('.ba-hero');
    const holder = document.createElement('div');
    holder.innerHTML = previewCardHtml();
    const card = holder.firstElementChild;
    if (hero && hero.parentNode) hero.parentNode.insertBefore(card, hero.nextSibling);
    else root.insertBefore(card, root.firstChild);
  }

  function install(){
    if (runtime.installed) return;
    const api = window.BusinessArchitecture;
    if (!api) {
      setTimeout(install, 120);
      return;
    }
    runtime.installed = true;
    runtime.originalRenderHome = typeof api.renderHome === 'function' ? api.renderHome.bind(api) : null;
    runtime.originalOpenAppHome = typeof api.openAppHome === 'function' ? api.openAppHome.bind(api) : null;

    if (runtime.originalRenderHome) {
      api.renderHome = async function(){
        const result = await runtime.originalRenderHome.apply(null, arguments);
        setTimeout(injectPreviewCard, 0);
        return result;
      };
      window.renderNoBusinessV40 = api.renderHome;
      try { renderNoBusinessV40 = api.renderHome; } catch(e) {}
    }

    window.ArchitectureLearningStaging = {
      version: RELEASE,
      open: openPreview,
      exit: exitPreview,
      previous: previous,
      next: function(){
        if (!runtime.data) return;
        handleNext(runtime.data.screens[runtime.screenIndex]);
      },
      reset: requestReset,
      getProgress: readFlow,
      render: renderScreen
    };

    if (previewRequested()) {
      setTimeout(openPreview, 250);
    } else if (adminMode()) {
      setTimeout(injectPreviewCard, 500);
    }
  }

  install();
})();
