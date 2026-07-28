/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — отдельный учебный контур
   Интерфейс и данные этого раздела изолированы от других
   уроков, форума, профиля и общего прогресса приложения.
   ========================================================= */
(function(){
  'use strict';

  const RELEASE = 'ba-v5-part1-20260722';
  const STORAGE_KEY = 'architecture_business_progress_v2';
  const CATALOG_URL = 'content/business_architecture/catalog.json';
  const LESSON_BASE_URL = 'content/business_architecture/lessons/';
  const CASE_BASE_URL = 'content/business_architecture/cases/';
  const EXAMPLES_URL = 'content/business_architecture/examples.json';
  const SYNC_ENDPOINT = 'https://soxtekhspohkddpdidvp.supabase.co/functions/v1/business-architecture-progress';
  const SYNC_DEBOUNCE_MS = 850;
  const SYNC_RETRY_DELAYS = [2000, 5000, 15000, 60000];

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
    mutationObserver: null,
    sync: {
      initialized: false,
      initializing: null,
      enabled: false,
      initData: '',
      serverVersion: 0,
      serverUpdatedAt: null,
      saving: false,
      pending: false,
      timer: null,
      retryTimer: null,
      retryIndex: 0,
      lastError: null,
      indicatorText: 'Сохранено'
    }
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
        lastResult: null,
        reviewQuestionIds: [],
        reviewMode: ''
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

  function saveProgress(progress, options){
    const opts = options || {};
    const next = progress || loadProgress();
    next.release = RELEASE;
    next.updatedAt = opts.keepUpdatedAt && next.updatedAt ? next.updatedAt : nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch(e){ console.warn('BA_PROGRESS_SAVE_ERROR', e); }
    if (opts.sync !== false) {
      setSaveIndicator(telegramInitData() ? 'Сохраняем…' : 'Сохранено на устройстве');
      scheduleRemoteSave();
    }
    return next;
  }


  function isPlainObject(value){
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneJson(value){
    try { return JSON.parse(JSON.stringify(value)); }
    catch(e){ return value; }
  }

  function telegramInitData(){
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      return String(tg && tg.initData ? tg.initData : '').trim();
    } catch(e){
      return '';
    }
  }

  function hasStoredLocalProgress(){
    try { return Boolean(localStorage.getItem(STORAGE_KEY)); }
    catch(e){ return false; }
  }

  function setSaveIndicator(text){
    runtime.sync.indicatorText = String(text || 'Сохранено');
    try {
      document.querySelectorAll('[data-ba-saved]').forEach(function(node){
        node.textContent = runtime.sync.indicatorText;
      });
    } catch(e) {}
  }

  function refreshSaveIndicator(){
    setSaveIndicator(runtime.sync.indicatorText || (runtime.sync.enabled ? 'Сохранено' : 'Сохранено на устройстве'));
  }

  function timestampValue(value){
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function laterIso(left, right){
    const leftTime = timestampValue(left);
    const rightTime = timestampValue(right);
    if (!leftTime && !rightTime) return '';
    return leftTime >= rightTime ? String(left || '') : String(right || '');
  }

  function uniqueValues(values){
    const result = [];
    (values || []).forEach(function(value){
      if (!result.some(function(existing){ return JSON.stringify(existing) === JSON.stringify(value); })) result.push(cloneJson(value));
    });
    return result;
  }

  function mergeObjectFields(localObject, remoteObject, preferLocal){
    const local = isPlainObject(localObject) ? localObject : {};
    const remote = isPlainObject(remoteObject) ? remoteObject : {};
    const preferred = preferLocal ? local : remote;
    const fallback = preferLocal ? remote : local;
    const result = {};
    Array.from(new Set(Object.keys(fallback).concat(Object.keys(preferred)))).forEach(function(key){
      if (Object.prototype.hasOwnProperty.call(preferred, key)) result[key] = cloneJson(preferred[key]);
      else result[key] = cloneJson(fallback[key]);
    });
    return result;
  }

  function mergeWorkspaceSections(localSections, remoteSections, preferLocal){
    const local = isPlainObject(localSections) ? localSections : {};
    const remote = isPlainObject(remoteSections) ? remoteSections : {};
    const result = {};
    Array.from(new Set(Object.keys(local).concat(Object.keys(remote)))).forEach(function(sectionId){
      const localSection = isPlainObject(local[sectionId]) ? local[sectionId] : {};
      const remoteSection = isPlainObject(remote[sectionId]) ? remote[sectionId] : {};
      const preferred = preferLocal ? localSection : remoteSection;
      const fallback = preferLocal ? remoteSection : localSection;
      result[sectionId] = Object.assign({}, cloneJson(fallback), cloneJson(preferred), {
        fields: mergeObjectFields(localSection.fields, remoteSection.fields, preferLocal),
        evidence: Object.prototype.hasOwnProperty.call(preferred, 'evidence') ? String(preferred.evidence || '') : String(fallback.evidence || '')
      });
    });
    return result;
  }

  function normalizeLessonState(value){
    const source = isPlainObject(value) ? cloneJson(value) : {};
    const base = defaultLessonProgress();
    const result = Object.assign(base, source);
    result.completedStages = Array.isArray(source.completedStages) ? source.completedStages.slice() : [];
    result.systemAnalysis = Object.assign({}, base.systemAnalysis, isPlainObject(source.systemAnalysis) ? source.systemAnalysis : {});
    result.examplesOpened = Array.isArray(source.examplesOpened) ? source.examplesOpened.slice() : [];
    result.quiz = Object.assign({}, base.quiz, isPlainObject(source.quiz) ? source.quiz : {});
    result.quiz.draft = isPlainObject(result.quiz.draft) ? result.quiz.draft : {};
    result.quiz.order = isPlainObject(result.quiz.order) ? result.quiz.order : {};
    result.quiz.attempts = Array.isArray(result.quiz.attempts) ? result.quiz.attempts : [];
    result.quiz.reviewQuestionIds = Array.isArray(result.quiz.reviewQuestionIds) ? result.quiz.reviewQuestionIds.slice() : [];
    result.quiz.reviewMode = String(result.quiz.reviewMode || '');
    result.workspace = Object.assign({}, base.workspace, isPlainObject(source.workspace) ? source.workspace : {});
    result.workspace.sections = isPlainObject(result.workspace.sections) ? result.workspace.sections : {};
    result.workspace.final = isPlainObject(result.workspace.final) ? result.workspace.final : {};
    return result;
  }

  function mergeLessonStates(localValue, remoteValue, preferLocal){
    const hasLocal = isPlainObject(localValue);
    const hasRemote = isPlainObject(remoteValue);
    if (hasLocal && !hasRemote) return normalizeLessonState(localValue);
    if (hasRemote && !hasLocal) return normalizeLessonState(remoteValue);
    const local = normalizeLessonState(localValue);
    const remote = normalizeLessonState(remoteValue);
    const preferred = preferLocal ? local : remote;
    const fallback = preferLocal ? remote : local;
    const attempts = uniqueValues((local.quiz.attempts || []).concat(remote.quiz.attempts || []))
      .sort(function(a,b){ return timestampValue(a && a.at) - timestampValue(b && b.at); });
    return Object.assign({}, cloneJson(fallback), cloneJson(preferred), {
      completedStages: uniqueValues((local.completedStages || []).concat(remote.completedStages || [])),
      completedAt: laterIso(local.completedAt, remote.completedAt) || null,
      lastStageId: String(preferred.lastStageId || fallback.lastStageId || 'system_analysis'),
      systemAnalysis: {
        screenIndex: Math.max(Number(local.systemAnalysis.screenIndex || 0), Number(remote.systemAnalysis.screenIndex || 0))
      },
      examplesOpened: uniqueValues((local.examplesOpened || []).concat(remote.examplesOpened || [])),
      quiz: Object.assign({}, cloneJson(fallback.quiz), cloneJson(preferred.quiz), {
        draft: cloneJson(preferred.quiz.draft || {}),
        order: cloneJson(preferred.quiz.order || {}),
        attempts: attempts,
        lastResult: cloneJson(preferred.quiz.lastResult || null),
        reviewQuestionIds: Array.isArray(preferred.quiz.reviewQuestionIds) ? preferred.quiz.reviewQuestionIds.slice() : [],
        reviewMode: String(preferred.quiz.reviewMode || '')
      }),
      workspace: Object.assign({}, cloneJson(fallback.workspace), cloneJson(preferred.workspace), {
        route: String(preferred.workspace.route || fallback.workspace.route || ''),
        sectionIndex: Math.max(Number(local.workspace.sectionIndex || 0), Number(remote.workspace.sectionIndex || 0)),
        sections: mergeWorkspaceSections(local.workspace.sections, remote.workspace.sections, preferLocal),
        final: mergeObjectFields(local.workspace.final, remote.workspace.final, preferLocal),
        completedAt: laterIso(local.workspace.completedAt, remote.workspace.completedAt) || null
      })
    });
  }

  function normalizeProgressState(value){
    const source = isPlainObject(value) ? cloneJson(value) : {};
    return {
      version: Number(source.version || 1),
      release: String(source.release || RELEASE),
      selectedRoute: String(source.selectedRoute || ''),
      currentLessonId: String(source.currentLessonId || 'BA-01'),
      updatedAt: String(source.updatedAt || ''),
      lessons: isPlainObject(source.lessons) ? source.lessons : {}
    };
  }

  function mergeProgressStates(localValue, remoteValue){
    const local = normalizeProgressState(localValue);
    const remote = normalizeProgressState(remoteValue);
    const preferLocal = timestampValue(local.updatedAt) >= timestampValue(remote.updatedAt);
    const preferred = preferLocal ? local : remote;
    const fallback = preferLocal ? remote : local;
    const result = Object.assign({}, cloneJson(fallback), cloneJson(preferred));
    result.version = Math.max(Number(local.version || 1), Number(remote.version || 1));
    result.release = RELEASE;
    result.selectedRoute = String(preferred.selectedRoute || fallback.selectedRoute || '');
    result.currentLessonId = String(preferred.currentLessonId || fallback.currentLessonId || 'BA-01');
    result.updatedAt = laterIso(local.updatedAt, remote.updatedAt) || nowIso();
    result.lessons = {};
    Array.from(new Set(Object.keys(local.lessons).concat(Object.keys(remote.lessons)))).forEach(function(lessonId){
      result.lessons[lessonId] = mergeLessonStates(local.lessons[lessonId], remote.lessons[lessonId], preferLocal);
    });
    return result;
  }

  function stableStringify(value){
    function normalize(input){
      if (Array.isArray(input)) return input.map(normalize);
      if (isPlainObject(input)) {
        const output = {};
        Object.keys(input).sort().forEach(function(key){ output[key] = normalize(input[key]); });
        return output;
      }
      return input;
    }
    try { return JSON.stringify(normalize(value)); }
    catch(e){ return ''; }
  }

  function hasMeaningfulProgress(value){
    const progress = normalizeProgressState(value);
    if (progress.selectedRoute) return true;
    return Object.keys(progress.lessons).some(function(lessonId){
      const lesson = normalizeLessonState(progress.lessons[lessonId]);
      return lesson.completedStages.length > 0 || lesson.examplesOpened.length > 0 || lesson.quiz.attempts.length > 0 || Object.keys(lesson.quiz.draft).length > 0 || hasWorkspaceContent(lesson) || Boolean(lesson.completedAt);
    });
  }

  async function syncRequest(payload){
    const initData = runtime.sync.initData || telegramInitData();
    if (!initData) throw new Error('TELEGRAM_INIT_DATA_REQUIRED');
    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(Object.assign({}, payload, {initData:initData})),
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch(e) {}
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || ('SYNC_HTTP_' + response.status));
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  function applyServerMeta(result){
    runtime.sync.serverVersion = Number(result && result.version || 0);
    runtime.sync.serverUpdatedAt = result && result.serverUpdatedAt ? String(result.serverUpdatedAt) : null;
    runtime.sync.retryIndex = 0;
    runtime.sync.lastError = null;
  }

  async function saveSnapshotToServer(state, baseVersion, conflictDepth){
    try {
      const result = await syncRequest({
        action: 'save',
        state: state,
        baseVersion: Number(baseVersion || 0),
        clientUpdatedAt: state && state.updatedAt ? state.updatedAt : nowIso()
      });
      applyServerMeta(result);
      return result;
    } catch(error){
      const current = error && error.payload && error.payload.current;
      if (error && error.status === 409 && current && conflictDepth < 2) {
        runtime.sync.serverVersion = Number(current.version || 0);
        runtime.sync.serverUpdatedAt = current.serverUpdatedAt || null;
        const merged = mergeProgressStates(loadProgress(), current.state || {});
        saveProgress(merged, {sync:false, keepUpdatedAt:true});
        return saveSnapshotToServer(merged, runtime.sync.serverVersion, conflictDepth + 1);
      }
      throw error;
    }
  }

  function scheduleRetry(){
    if (!runtime.sync.initData || runtime.sync.retryTimer) return;
    const index = Math.min(runtime.sync.retryIndex, SYNC_RETRY_DELAYS.length - 1);
    const delay = SYNC_RETRY_DELAYS[index];
    runtime.sync.retryIndex += 1;
    runtime.sync.retryTimer = setTimeout(function(){
      runtime.sync.retryTimer = null;
      ensureRemoteSync(true).then(function(){
        if (runtime.sync.pending) performRemoteSave();
      });
    }, delay);
  }

  async function ensureRemoteSync(force){
    if (runtime.sync.initialized && !force) return runtime.sync.enabled;
    if (runtime.sync.initializing) return runtime.sync.initializing;
    runtime.sync.initializing = (async function(){
      runtime.sync.initData = telegramInitData();
      if (!runtime.sync.initData) {
        runtime.sync.enabled = false;
        runtime.sync.initialized = true;
        setSaveIndicator('Сохранено на устройстве');
        return false;
      }
      runtime.sync.enabled = true;
      try {
        const remote = await syncRequest({action:'load'});
        applyServerMeta(remote);
        const localExists = hasStoredLocalProgress();
        const localState = loadProgress();
        const remoteState = isPlainObject(remote.state) ? remote.state : {};
        const merged = Number(remote.version || 0) > 0
          ? (localExists ? mergeProgressStates(localState, remoteState) : cloneJson(remoteState))
          : localState;
        if (Number(remote.version || 0) > 0) saveProgress(merged, {sync:false, keepUpdatedAt:true});
        if (Number(remote.version || 0) === 0 && hasMeaningfulProgress(localState)) {
          await saveSnapshotToServer(localState, 0, 0);
        } else if (Number(remote.version || 0) > 0 && localExists && stableStringify(merged) !== stableStringify(remoteState)) {
          await saveSnapshotToServer(merged, runtime.sync.serverVersion, 0);
        }
        runtime.sync.initialized = true;
        runtime.sync.pending = false;
        setSaveIndicator('Сохранено');
        return true;
      } catch(error){
        runtime.sync.initialized = true;
        runtime.sync.lastError = error;
        console.warn('BA_REMOTE_SYNC_INIT_ERROR', error);
        setSaveIndicator('Сохранено на устройстве');
        if (!(error && error.status === 401)) scheduleRetry();
        return false;
      }
    })().finally(function(){ runtime.sync.initializing = null; });
    return runtime.sync.initializing;
  }

  function scheduleRemoteSave(delay){
    runtime.sync.pending = true;
    if (!telegramInitData()) {
      runtime.sync.enabled = false;
      setSaveIndicator('Сохранено на устройстве');
      return;
    }
    if (runtime.sync.timer) clearTimeout(runtime.sync.timer);
    runtime.sync.timer = setTimeout(function(){
      runtime.sync.timer = null;
      performRemoteSave();
    }, delay === undefined ? SYNC_DEBOUNCE_MS : Math.max(0, Number(delay) || 0));
  }

  async function performRemoteSave(){
    if (runtime.sync.saving) {
      runtime.sync.pending = true;
      return false;
    }
    const connected = await ensureRemoteSync(false);
    if (!connected) return false;
    if (!runtime.sync.pending) return true;
    runtime.sync.saving = true;
    runtime.sync.pending = false;
    setSaveIndicator('Сохраняем…');
    const snapshot = loadProgress();
    const snapshotSignature = stableStringify(snapshot);
    try {
      await saveSnapshotToServer(snapshot, runtime.sync.serverVersion, 0);
      if (stableStringify(loadProgress()) !== snapshotSignature) runtime.sync.pending = true;
      if (!runtime.sync.pending) setSaveIndicator('Сохранено');
      return true;
    } catch(error){
      runtime.sync.lastError = error;
      runtime.sync.pending = true;
      console.warn('BA_REMOTE_SYNC_SAVE_ERROR', error);
      setSaveIndicator('Сохранено на устройстве');
      if (!(error && error.status === 401)) scheduleRetry();
      return false;
    } finally {
      runtime.sync.saving = false;
      if (runtime.sync.pending && !runtime.sync.retryTimer) scheduleRemoteSave(500);
    }
  }

  async function syncNow(){
    runtime.sync.pending = true;
    const connected = await ensureRemoteSync(true);
    if (!connected) return false;
    return performRemoteSave();
  }

  function installSyncListeners(){
    window.addEventListener('online', function(){
      if (telegramInitData()) syncNow();
    });
    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden' && runtime.sync.pending) scheduleRemoteSave(0);
    });
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
  const entries = catalogEntries();
  let completedStages = 0;
  let completedItems = 0;
  entries.forEach(function(entry){
    const lp = itemProgress(entry.id) || {};
    completedStages += Array.isArray(lp.completedStages) ? lp.completedStages.length : 0;
    if (lp.completedAt) completedItems += 1;
  });
  const totalStages = entries.reduce(function(total, entry){
    return total + Number(entry.stages || 4);
  }, 0);
  return {
    completedStages,
    completedItems,
    totalStages,
    totalItems: entries.length,
    percent: totalStages ? Math.round((completedStages / totalStages) * 100) : 0
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
  const baseUrl = String(lessonId || '').startsWith('PART-') ? CASE_BASE_URL : LESSON_BASE_URL;
  runtime.lessons[lessonId] = await fetchJson(baseUrl + encodeURIComponent(lessonId) + '.json');
  return runtime.lessons[lessonId];
}

  async function ensureExamples(){
    if (runtime.examples) return runtime.examples;
    runtime.examples = await fetchJson(EXAMPLES_URL);
    return runtime.examples;
  }

function lessonNumber(lessonId){
  const meta = findCatalogEntry(lessonId);
  if (meta && Number.isFinite(Number(meta.number))) return Number(meta.number);
  const match = String(lessonId || '').match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function isAdminPreview(){
  try {
    return typeof window.isAdminMode === 'function' && Boolean(window.isAdminMode());
  } catch(e){
    return false;
  }
}

function firstAvailablePart(){
  const catalog = runtime.catalog;
  if (!catalog || !Array.isArray(catalog.parts)) return null;
  return catalog.parts.find(function(part){
    return Array.isArray(part.lessons) && part.lessons.some(function(item){ return item.status === 'available'; });
  }) || catalog.parts[0] || null;
}

function catalogEntries(){
  const part = firstAvailablePart();
  if (!part) return [];
  const lessons = (part.lessons || []).filter(function(item){ return item.status === 'available'; }).map(function(item){
    return Object.assign({}, item, {item_type:'lesson', part_id:part.id, part_number:part.number});
  });
  const caseMeta = part.integration_case && part.integration_case.status === 'available'
    ? [Object.assign({}, part.integration_case, {
        item_type:'case',
        part_id:part.id,
        part_number:part.number,
        chapter:'Итог'
      })]
    : [];
  return lessons.concat(caseMeta);
}

function findCatalogEntry(entryId){
  const entries = catalogEntries();
  return entries.find(function(item){ return item.id === entryId; }) || null;
}

function itemProgress(entryId){
  const progress = loadProgress();
  return progress.lessons && progress.lessons[entryId] ? progress.lessons[entryId] : null;
}

function itemCompleted(entryId){
  const lp = itemProgress(entryId);
  return Boolean(lp && lp.completedAt);
}

function itemHasProgress(entryId){
  const lp = itemProgress(entryId);
  if (!lp) return false;
  return Boolean(
    lp.completedAt ||
    (Array.isArray(lp.completedStages) && lp.completedStages.length) ||
    hasWorkspaceContent(lp) ||
    (lp.quiz && Array.isArray(lp.quiz.attempts) && lp.quiz.attempts.length)
  );
}

function entryIndex(entryId){
  return catalogEntries().findIndex(function(item){ return item.id === entryId; });
}

function entryUnlocked(entryId){
  if (isAdminPreview()) return true;
  const entries = catalogEntries();
  const index = entries.findIndex(function(item){ return item.id === entryId; });
  if (index < 0) return false;
  if (entries[index].status !== 'available') return false;
  if (index === 0 || itemHasProgress(entryId)) return true;
  return itemCompleted(entries[index - 1].id);
}

function nextCatalogEntry(entryId){
  const entries = catalogEntries();
  const index = entries.findIndex(function(item){ return item.id === entryId; });
  return index >= 0 && index < entries.length - 1 ? entries[index + 1] : null;
}

function firstIncompleteEntry(){
  const entries = catalogEntries();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!itemCompleted(entry.id) && entryUnlocked(entry.id)) return entry;
  }
  return null;
}

function entryLabel(meta){
  if (!meta) return '';
  if (meta.item_type === 'case') return 'Комплексный разбор';
  return 'Урок ' + Number(meta.number || 1);
}

function entrySourceLabel(data){
  if (data && data.item_type === 'integrated_case') return 'ЧАСТЬ I · КОМПЛЕКСНЫЙ РАЗБОР';
  const partNumber = data && data.part ? data.part.number : 1;
  const chapter = data && data.lesson ? data.lesson.chapter_number : '';
  return 'ЧАСТЬ ' + partNumber + ' · ГЛАВА ' + chapter;
}

function availableWorkspaceIds(){
  return catalogEntries().filter(function(entry){
    return workspaceUnlocked(entry.id);
  }).map(function(entry){ return entry.id; });
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
  if (isAdminPreview()) return true;
  const lp = itemProgress(lessonId);
  if (!lp) return false;
  return (Array.isArray(lp.completedStages) && lp.completedStages.includes('decision_lab')) ||
    hasWorkspaceContent(lp) ||
    (Array.isArray(lp.completedStages) && lp.completedStages.includes('architecture_assembly'));
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
    setTimeout(refreshSaveIndicator, 0);
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
  const entries = catalogEntries();
  if (!entries.length || !part || part.id !== entries[0].part_id) return '';
  const completedCount = entries.filter(function(entry){ return itemCompleted(entry.id); }).length;
  const rows = entries.map(function(entry){
    const done = itemCompleted(entry.id);
    const unlocked = entryUnlocked(entry.id);
    const isCase = entry.item_type === 'case';
    const cls = done ? 'is-done' : (!unlocked ? 'is-locked' : '');
    const click = unlocked
      ? ' onclick="BusinessArchitecture.openLesson(\'' + escapeHtml(entry.id) + '\')"'
      : ' disabled aria-disabled="true"';
    const indexLabel = isCase ? 'ИТОГ' : String(entry.number).padStart(2,'0');
    const small = isCase
      ? 'Связывает финансовую систему, стратегию, поток и управление'
      : 'Глава ' + escapeHtml(entry.chapter) + ' · четыре раздела';
    const status = done ? 'готово' : (unlocked ? 'открыто' : 'после предыдущего');
    return '<button class="ba-lesson-row ' + cls + '"' + click + '>' +
      '<span class="ba-lesson-index ' + (isCase ? 'ba-case-index' : '') + '">' + indexLabel + '</span>' +
      '<span><b>' + escapeHtml(entry.title) + '</b><small>' + small + '</small></span>' +
      '<span class="ba-status ' + (done ? 'is-done' : unlocked ? 'is-active' : '') + '">' + status + '</span>' +
    '</button>';
  }).join('');
  return '<section class="ba-part is-open" data-ba-part="' + escapeHtml(part.id) + '">' +
    '<div class="ba-part-head ba-part-head-static"><span class="ba-part-head-row"><span class="ba-number-chip">' + escapeHtml(part.number) + '</span>' +
      '<span><b>' + escapeHtml(part.title) + '</b><small>' + escapeHtml(part.description) + '</small></span>' +
      '<span class="ba-part-progress">' + completedCount + '/' + entries.length + '</span></span></div>' +
    '<div class="ba-part-body"><div class="ba-lesson-list">' + rows + '</div>' +
      '<div class="ba-note ba-note-teal ba-part-result"><b>Результат части:</b> ' + escapeHtml(part.result) + '</div>' +
    '</div></section>';
}

async function renderHome(){
  try {
    loadingView('Открываем курс');
    await ensureRemoteSync(false);
    const catalog = await ensureCatalog();
    const part = firstAvailablePart();
    const info = courseProgressInfo();
    const currentEntry = firstIncompleteEntry();
    const hasStarted = info.completedStages > 0 || catalogEntries().some(function(entry){ return itemHasProgress(entry.id); });
    const materialsButton = availableWorkspaceIds().length
      ? '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Мои материалы</button>'
      : '';
    const continueLabel = hasStarted ? 'Продолжить обучение' : 'Начать обучение';
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openAppHome()">← Главная</button></div>' +
      '<section class="ba-hero ba-hero-compact">' +
        '<p class="ba-eyebrow">БИЗНЕС КАК СИСТЕМА</p>' +
        '<h1>' + escapeHtml(catalog.module.title) + '</h1>' +
        '<p>Пошаговая система управления бизнесом: деньги, стратегия, поток ценности и архитектура решений.</p>' +
        '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">' + continueLabel + '</button>' +
        '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Практические материалы</button>' + materialsButton + '</div>' +
      '</section>' +
      (hasStarted && currentEntry
        ? '<section class="ba-card ba-course-progress"><div><p class="ba-eyebrow">ПРОДОЛЖИТЬ</p><h2>' + escapeHtml(currentEntry.title) + '</h2><p>Первая часть курса: выполнено ' + info.completedItems + ' из ' + info.totalItems + ' шагов.</p><div class="ba-progress-bar"><i style="width:' + clamp(info.percent,0,100) + '%"></i></div></div></section>'
        : '') +
      '<section class="ba-card"><p class="ba-eyebrow">ПЕРВАЯ ЧАСТЬ</p><h2>' + escapeHtml(part ? part.title : 'Финансовая и стратегическая основа') + '</h2>' +
        '<p>Сначала выстраиваются финансовая реальность, стратегический выбор, сквозной поток и система управления. После четырёх уроков открывается комплексный разбор.</p>' +
        '<div class="ba-part-list">' + (part ? renderPart(part,0) : '') + '</div>' +
      '</section><div class="ba-footer-space"></div>';
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
    await ensureCatalog();
    const entry = firstIncompleteEntry();
    if (!entry) return renderMyArchitecture();
    await ensureLesson(entry.id);
    const lp = getLessonProgress(entry.id).lesson;
    const data = runtime.lessons[entry.id];
    const firstIncomplete = data.stages.find(function(stage){ return !lp.completedStages.includes(stage.id); });
    if (!firstIncomplete) return openLesson(entry.id);
    return openStage(entry.id, firstIncomplete.id);
  } catch(error){ errorView(error); }
}

function lessonStageState(lessonId, stageIndex, stages){
  const lp = getLessonProgress(lessonId).lesson;
  const stage = stages[stageIndex];
  const done = lp.completedStages.includes(stage.id);
  const unlocked = isAdminPreview() || stageIndex === 0 || lp.completedStages.includes(stages[stageIndex - 1].id);
  return {done, unlocked};
}

async function openLesson(lessonId){
  try {
    await ensureRemoteSync(false);
    await ensureCatalog();
    const meta = findCatalogEntry(lessonId);
    if (!meta || meta.status !== 'available') {
      safeAlert('Этот материал пока недоступен.');
      return;
    }
    if (!entryUnlocked(lessonId)) {
      const entries = catalogEntries();
      const index = entries.findIndex(function(item){ return item.id === lessonId; });
      const previous = index > 0 ? entries[index - 1] : null;
      safeAlert(previous ? 'Сначала завершите: «' + previous.title + '».' : 'Сначала завершите предыдущий шаг.');
      return renderHome();
    }
    loadingView(meta.item_type === 'case' ? 'Открываем комплексный разбор' : 'Открываем урок');
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
    const materialsButton = availableWorkspaceIds().length
      ? '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Мои материалы</button>'
      : '';
    const isCase = meta.item_type === 'case' || data.item_type === 'integrated_case';
    const topLabel = lp.completedAt ? 'Завершено' : entryLabel(meta);
    const introTitle = isCase ? 'Что нужно сделать' : 'Что даст этот урок';
    const outcomesTitle = isCase ? 'В результате вы сможете' : 'После урока вы сможете';
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button><span class="ba-status ' + (lp.completedAt ? 'is-done' : 'is-active') + '">' + escapeHtml(topLabel) + '</span></div>' +
      '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">' + escapeHtml(entrySourceLabel(data)) + '</p><h2>' + escapeHtml(data.lesson.title) + '</h2><p>' + escapeHtml(data.lesson.subtitle) + '</p>' +
        '<div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueLesson(\'' + lessonId + '\')">' + (completed ? 'Продолжить' : (isCase ? 'Начать разбор' : 'Начать урок')) + '</button>' + materialsButton + '</div></section>' +
      '<section class="ba-card ba-progress-card"><div><p class="ba-eyebrow">ПРОГРЕСС</p><h2>' + completed + ' из ' + data.stages.length + ' разделов</h2><div class="ba-progress-bar"><i style="width:' + percent + '%"></i></div></div><div class="ba-progress-number">' + percent + '%</div></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">' + introTitle.toUpperCase() + '</p><p>' + escapeHtml(data.lesson.purpose) + '</p></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">СОДЕРЖАНИЕ</p><div class="ba-stage-grid">' + stageCards + '</div></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">' + outcomesTitle.toUpperCase() + '</p><ol class="ba-list">' + data.lesson.learning_outcomes.map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ol></section><div class="ba-footer-space"></div>';
    renderWithAppShell(html, 'home');
  } catch(error){ errorView(error); }
}

async function openNextEntry(entryId){
  const next = nextCatalogEntry(entryId);
  if (next && entryUnlocked(next.id)) return openLesson(next.id);
  return renderMyArchitecture();
}

async function continueLesson(lessonId){
  const data = await ensureLesson(lessonId);
  const lp = getLessonProgress(lessonId).lesson;
  const nextStage = data.stages.find(function(stage){ return !lp.completedStages.includes(stage.id); });
  if (nextStage) return openStage(lessonId, nextStage.id);
  return openNextEntry(lessonId);
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
  const eyebrow = stage.eyebrow || data.lesson.title;

  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status is-active">Раздел 1 из 4</span></div>' +
    '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveSystemScreen(-1)"' + prevDisabled + '>← Назад</button><div class="ba-screen-counter">' + (runtime.screenIndex + 1) + ' из ' + stage.screens.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + nextAction + '">' + nextLabel + '</button></div>' +
    '<article class="ba-reading-card"><p class="ba-eyebrow">' + escapeHtml(eyebrow) + '</p><h2>' + escapeHtml(screen.title) + '</h2>' +
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
  safeAlert('Раздел завершён. Теперь откройте практические материалы.');
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
  const headline = stage.headline || 'Практические материалы урока';
  const intro = stage.intro || stage.description || 'Разберите рабочие материалы и решения, для которых они используются.';
  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status is-active">Раздел 2 из 4</span></div>' +
    '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ПРАКТИЧЕСКИЕ МАТЕРИАЛЫ</p><h2>' + escapeHtml(headline) + '</h2><p>' + escapeHtml(intro) + '</p></section>' +
    '<section class="ba-card"><div class="ba-section-progress"><span>Просмотрено ' + viewedCount + ' из ' + stage.examples.length + '</span><div class="ba-progress-bar"><i style="width:' + Math.round((viewedCount/stage.examples.length)*100) + '%"></i></div></div><div class="ba-example-list">' + cards + '</div>' +
      '<div class="ba-actions"><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Библиотека практических материалов</button><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeExamples(\'' + lessonId + '\')" ' + (allOpened ? '' : 'disabled') + '>Продолжить</button></div>' +
      (!allOpened ? '<div class="ba-note" style="margin-top:12px">Чтобы перейти дальше, посмотрите все материалы этого раздела.</div>' : '') +
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
    safeAlert('Сначала посмотрите все практические материалы этого раздела.');
    return;
  }
  markStageDone(lessonId, 'business_examples');
  safeAlert('Практические материалы изучены. Открыты управленческие задачи.');
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

  function quizReviewQuestionIds(lp, stage){
    const raw = lp && lp.quiz && Array.isArray(lp.quiz.reviewQuestionIds) ? lp.quiz.reviewQuestionIds : [];
    const allowed = new Set((stage.questions || []).map(function(q){ return q.id; }));
    return raw.filter(function(id, index){ return allowed.has(id) && raw.indexOf(id) === index; });
  }

  function activeQuizQuestions(stage, lp){
    const reviewIds = quizReviewQuestionIds(lp, stage);
    if (!reviewIds.length) return stage.questions;
    const byId = {};
    stage.questions.forEach(function(q){ byId[q.id] = q; });
    const selected = reviewIds.map(function(id){ return byId[id]; }).filter(Boolean);
    return selected.length ? selected : stage.questions;
  }

async function renderQuiz(lessonId, requestedIndex, focusQuestion){
  const data = await ensureLesson(lessonId);
  const stage = data.stages.find(function(item){ return item.id === 'decision_lab'; });
  ensureQuizDraft(lessonId, stage.questions);
  const lp = getLessonProgress(lessonId).lesson;
  if (lp.quiz.lastResult) return renderQuizResult(lessonId);

  const reviewIds = quizReviewQuestionIds(lp, stage);
  const reviewMode = reviewIds.length ? String(lp.quiz.reviewMode || 'all') : '';
  const questions = activeQuizQuestions(stage, lp);
  runtime.quizIndex = clamp(requestedIndex === undefined ? runtime.quizIndex : requestedIndex, 0, questions.length - 1);
  const q = questions[runtime.quizIndex];
  const answeredCount = stage.questions.filter(function(item){ return questionAnswered(item, lp); }).length;
  const last = runtime.quizIndex === questions.length - 1;

  const introHtml = reviewIds.length
    ? '<section class="ba-card ba-quiz-intro"><p class="ba-eyebrow">ПЕРЕСМОТР РЕШЕНИЙ</p><h2>' + (reviewMode === 'critical' ? 'Ключевые решения' : 'Решения, которые требуют уточнения') + '</h2><p>Остальные ответы сохранены. Измените только решения, которые повлияли на итог, и отправьте их на повторную проверку.</p><div class="ba-quiz-line"><span>На пересмотре <b>' + questions.length + '</b></span><span>После последнего вопроса результат будет пересчитан</span></div></section>'
    : '<section class="ba-card ba-quiz-intro"><p class="ba-eyebrow">УПРАВЛЕНЧЕСКИЕ ЗАДАЧИ</p><h2>' + escapeHtml(data.lesson.title) + '</h2><p>В каждом задании нужно сопоставить факты, ограничения, последовательность и последствия. К материалам можно возвращаться в любой момент.</p><div class="ba-quiz-line"><span>Отвечено <b data-ba-answered>' + answeredCount + '</b> из ' + stage.questions.length + '</span><span>Для прохождения — ' + stage.pass_score + '% и без ошибок в ключевых вопросах</span></div></section>';

  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status is-warning">Раздел 3 из 4</span></div>' +
    introHtml +
    '<div class="ba-screen-nav ba-quiz-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Вопрос ' + (runtime.quizIndex + 1) + ' из ' + questions.length + '</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить ответы' : 'Следующий →') + '</button></div>' +
    '<article class="ba-question-card"><div class="ba-question-top"><span class="ba-question-skill">' + escapeHtml(q.skill) + '</span>' + (q.critical ? '<span class="ba-critical">КЛЮЧЕВОЙ ВОПРОС</span>' : '') + '</div>' +
      (q.case ? '<div class="ba-case">' + escapeHtml(q.case) + '</div>' : '') + '<h2>' + escapeHtml(q.question) + '</h2>' + questionInputHtml(q, lp) + '</article>' +
    '<div class="ba-screen-nav"><button class="ba-btn ba-btn-light ba-btn-small" onclick="BusinessArchitecture.moveQuiz(-1)" ' + (runtime.quizIndex === 0 ? 'disabled' : '') + '>← Назад</button><div class="ba-screen-counter">Изменения сохраняются автоматически</div><button class="ba-btn ba-btn-primary ba-btn-small" onclick="' + (last ? 'BusinessArchitecture.submitQuiz(\'' + lessonId + '\')' : 'BusinessArchitecture.moveQuiz(1)') + '">' + (last ? 'Проверить ответы' : 'Следующий →') + '</button></div><div class="ba-footer-space"></div>';
  renderWithAppShell(html, 'home', focusQuestion ? {target:'.ba-question-card'} : {});
}

  function moveQuiz(delta){
    const lessonId = runtime.currentLessonId || 'BA-01';
    const lesson = runtime.lessons[lessonId];
    const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    const lp = getLessonProgress(lessonId).lesson;
    const questions = activeQuizQuestions(stage, lp);
    runtime.quizIndex = clamp(runtime.quizIndex + Number(delta || 0), 0, questions.length - 1);
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
      item.quiz.reviewQuestionIds = [];
      item.quiz.reviewMode = '';
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

  function pluralRu(number, one, few, many){
    const value = Math.abs(Number(number) || 0) % 100;
    const last = value % 10;
    if (value > 10 && value < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  function reviewQuizMistakes(lessonId, mode){
    const lesson = runtime.lessons[lessonId];
    const stage = lesson && lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
    const lp = getLessonProgress(lessonId).lesson;
    const result = lp.quiz.lastResult;
    if (!stage || !result || !Array.isArray(result.results)) return renderQuiz(lessonId, 0, true);

    const ids = result.results
      .filter(function(item){ return !item.correct && (mode !== 'critical' || item.critical); })
      .map(function(item){ return item.id; });

    if (!ids.length) {
      safeAlert('Все выбранные решения уже исправлены.');
      return renderQuizResult(lessonId);
    }

    updateLessonProgress(lessonId, function(item){
      item.quiz.lastResult = null;
      item.quiz.reviewQuestionIds = ids;
      item.quiz.reviewMode = mode === 'critical' ? 'critical' : 'all';
    });
    runtime.quizIndex = 0;
    renderQuiz(lessonId, 0, true);
  }

function renderQuizResult(lessonId){
  const lesson = runtime.lessons[lessonId];
  const stage = lesson.stages.find(function(item){ return item.id === 'decision_lab'; });
  const practiceStage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
  const artifactTitle = practiceStage && practiceStage.artifact_title
    ? practiceStage.artifact_title
    : (practiceStage && practiceStage.completion_gate ? practiceStage.completion_gate.final_artifact : 'Практическая работа');
  const lp = getLessonProgress(lessonId).lesson;
  const result = lp.quiz.lastResult;
  if (!result) return renderQuiz(lessonId,0);

  const wrongResults = (result.results || []).filter(function(item){ return !item.correct; });
  const wrongCritical = wrongResults.filter(function(item){ return item.critical; });
  const scorePassed = Number(result.score) >= Number(stage.pass_score);
  const keyOnly = scorePassed && !result.criticalPassed;

  const orderedQuestions = stage.questions.slice().sort(function(left, right){
    const leftResult = result.results.find(function(item){ return item.id === left.id; });
    const rightResult = result.results.find(function(item){ return item.id === right.id; });
    return Number(Boolean(leftResult && leftResult.correct)) - Number(Boolean(rightResult && rightResult.correct));
  });

  const reviews = orderedQuestions.map(function(q){
    const originalIndex = stage.questions.findIndex(function(item){ return item.id === q.id; });
    const r = result.results.find(function(item){ return item.id === q.id; });
    return '<details class="ba-review-item ' + (r && r.correct ? 'is-correct' : 'is-wrong') + '"><summary>' + (r && r.correct ? 'Ответ обоснован' : 'Нужно пересмотреть') + ' · Вопрос ' + (originalIndex + 1) + ' · ' + escapeHtml(q.skill) + '</summary><div class="ba-review-body"><b>Задание:</b> ' + escapeHtml(q.question) + '<br><br><b>Ваш ответ:</b> ' + escapeHtml(answerDisplay(q,lp)) + '<br><br><b>Разбор:</b> ' + escapeHtml(q.explanation || '') + '</div></details>';
  }).join('');

  let statusText = 'Нужно пересмотреть решения';
  let heading = 'Часть решений требует пересмотра';
  let noteClass = 'ba-note-danger';
  let noteText = 'Правильно решено ' + result.correctCount + ' из ' + result.total + ' заданий. Для перехода к практике нужно пересмотреть ' + wrongResults.length + ' ' + pluralRu(wrongResults.length, 'решение', 'решения', 'решений') + '.';
  let primaryAction = '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.reviewQuizMistakes(\'' + lessonId + '\',\'all\')">Пересмотреть неверные решения</button>';

  if (result.passed) {
    statusText = 'Тест пройден';
    heading = 'Можно переходить к практической работе';
    noteClass = 'ba-note-teal';
    noteText = 'Все условия выполнены. Следующий шаг — собрать материал «' + escapeHtml(artifactTitle) + '».';
    primaryAction = '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.openStage(\'' + lessonId + '\',\'architecture_assembly\')">Перейти к практике</button>';
  } else if (keyOnly) {
    statusText = 'Нужно уточнить ключевые решения';
    heading = 'Проходной уровень достигнут';
    noteText = 'Общий результат — ' + result.score + '%. Проходной уровень достигнут, но ' + wrongCritical.length + ' ' + pluralRu(wrongCritical.length, 'ключевое решение требует', 'ключевых решения требуют', 'ключевых решений требуют') + ' пересмотра.';
    primaryAction = '<button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.reviewQuizMistakes(\'' + lessonId + '\',\'critical\')">Исправить ключевые решения</button>';
  } else if (wrongCritical.length) {
    noteText += ' Среди них ' + wrongCritical.length + ' ' + pluralRu(wrongCritical.length, 'ключевой вопрос', 'ключевых вопроса', 'ключевых вопросов') + '.';
  }

  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status ' + (result.passed ? 'is-done' : 'is-warning') + '">' + statusText + '</span></div>' +
    '<section class="ba-card"><p class="ba-eyebrow">РЕЗУЛЬТАТ</p><h2>' + heading + '</h2><div class="ba-result-summary" style="margin-top:14px"><div class="ba-result-box"><span>Итог</span><b>' + result.score + '%</b></div><div class="ba-result-box"><span>Правильных ответов</span><b>' + result.correctCount + '/' + result.total + '</b></div><div class="ba-result-box"><span>Ключевые вопросы</span><b>' + (result.criticalPassed ? 'без ошибок' : wrongCritical.length + ' ' + pluralRu(wrongCritical.length, 'ошибка', 'ошибки', 'ошибок')) + '</b></div></div>' +
      '<div class="ba-note ' + noteClass + '" style="margin-top:13px">' + noteText + '</div>' +
      '<div class="ba-actions">' + primaryAction + (!result.passed ? '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.restartQuiz(\'' + lessonId + '\')">Начать тест заново</button>' : '') + '<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">Назад</button></div></section>' +
    '<section class="ba-card"><p class="ba-eyebrow">РАЗБОР ОТВЕТОВ</p><h2>Логика каждого решения</h2><p>Сначала показаны решения, которые требуют пересмотра. Раскройте задание, чтобы увидеть недостающие данные и последствия.</p>' + reviews + '</section><div class="ba-footer-space"></div>';
  renderWithAppShell(html, 'home');
}

  function restartQuiz(lessonId){
    updateLessonProgress(lessonId, function(lp){
      lp.quiz.draft = {};
      lp.quiz.order = {};
      lp.quiz.lastResult = null;
      lp.quiz.reviewQuestionIds = [];
      lp.quiz.reviewMode = '';
    });
    runtime.quizIndex = 0;
    renderQuiz(lessonId,0,false);
  }

function routeInfo(routeId, lessonId){
  const lesson = runtime.lessons[lessonId || runtime.currentLessonId];
  if (lesson && Array.isArray(lesson.stages)) {
    const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
    const route = stage && Array.isArray(stage.routes)
      ? stage.routes.find(function(item){ return item.id === routeId; })
      : null;
    if (route) return {title:route.title, rule:route.rule};
  }
  const map = {
    real_business: {title:'Мой действующий бизнес', rule:'Использовать фактический период и указывать источник каждого числа.'},
    designed_business: {title:'Проектируемый бизнес', rule:'Отделять подтверждённые факты от допущений модели и задавать диапазоны.'},
    training_case: {title:'Учебный кейс', rule:'Использовать данные кейса и явно обосновывать недостающие допущения.'}
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
    setSaveIndicator(telegramInitData() ? 'Сохраняем…' : 'Сохранено на устройстве');
  }

  function updateWorkspaceEvidence(lessonId, sectionId, value){
    updateLessonProgress(lessonId, function(lp){ workspaceSectionData(lp, sectionId).evidence = String(value); });
    setSaveIndicator(telegramInitData() ? 'Сохраняем…' : 'Сохранено на устройстве');
  }

  function updateWorkspaceFinal(lessonId, key, value){
    updateLessonProgress(lessonId, function(lp){ lp.workspace.final[key] = String(value); });
    setSaveIndicator(telegramInitData() ? 'Сохраняем…' : 'Сохранено на устройстве');
  }

  function sectionCompleteness(lp, section){
    const data = workspaceSectionData(lp, section.id);
    const filled = section.required_fields.filter(function(field){ return String(data.fields[field] || '').trim(); }).length + (String(data.evidence || '').trim() ? 1 : 0);
    const total = section.required_fields.length + 1;
    return {filled, total, percent:Math.round((filled/total)*100)};
  }

function finalFieldDefinitions(stage){
  if (stage && Array.isArray(stage.final_fields) && stage.final_fields.length) return stage.final_fields;
  return [
    {key:'fact_or_assumption', label:'Подтверждённый факт или явное допущение'},
    {key:'conclusion', label:'Главный вывод'},
    {key:'decision_now', label:'Решение, которое принимается сейчас'},
    {key:'decision_later', label:'Решение, которое откладывается'},
    {key:'metric', label:'Контрольная метрика'},
    {key:'review_date', label:'Дата повторной проверки'},
    {key:'material_note', label:'Рабочий материал: ссылка или описание'}
  ];
}

function workspaceCompleteness(lp, stage){
  let filled = 0;
  let total = 0;
  stage.sections.forEach(function(section){
    const info = sectionCompleteness(lp, section);
    filled += info.filled;
    total += info.total;
  });
  finalFieldDefinitions(stage).forEach(function(field){
    total += 1;
    if (String(lp.workspace.final[field.key] || '').trim()) filled += 1;
  });
  return {filled, total, percent:total ? Math.round((filled/total)*100) : 0, complete:filled === total};
}

async function renderWorkspace(lessonId, requestedIndex){
  if (!workspaceUnlocked(lessonId)) {
    safeAlert('Мои материалы откроются после прохождения управленческих задач.');
    return openLesson(lessonId);
  }
  const lesson = await ensureLesson(lessonId);
  const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
  const lp = getLessonProgress(lessonId).lesson;
  runtime.workspaceSectionIndex = clamp(requestedIndex === undefined ? Number(lp.workspace.sectionIndex || 0) : requestedIndex, 0, stage.sections.length);
  updateLessonProgress(lessonId, function(item){ item.workspace.sectionIndex = runtime.workspaceSectionIndex; });

  if (!lp.workspace.route && Array.isArray(stage.routes) && stage.routes.length === 1) {
    updateLessonProgress(lessonId, function(item, progress){
      item.workspace.route = stage.routes[0].id;
      progress.selectedRoute = stage.routes[0].id;
    });
    return renderWorkspace(lessonId, requestedIndex);
  }

  if (!lp.workspace.route) {
    const routes = stage.routes.map(function(route){
      return '<button class="ba-route-card" onclick="BusinessArchitecture.chooseWorkspaceRoute(\'' + lessonId + '\',\'' + route.id + '\')"><b>' + escapeHtml(route.title) + '</b><p>' + escapeHtml(route.rule) + '</p></button>';
    }).join('');
    const html = '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status is-active">Раздел 4 из 4</span></div>' +
      '<section class="ba-hero"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>' + escapeHtml(stage.artifact_title || stage.completion_gate.final_artifact) + '</h2><p>' + escapeHtml(stage.artifact_description || stage.description) + '</p><p>Выберите контекст, к которому будете применять материал.</p></section>' +
      '<section class="ba-card"><div class="ba-route-list">' + routes + '</div></section><div class="ba-footer-space"></div>';
    return renderWithAppShell(html,'home');
  }

  if (runtime.workspaceSectionIndex >= stage.sections.length) return renderWorkspaceFinal(lessonId);

  const section = stage.sections[runtime.workspaceSectionIndex];
  const data = workspaceSectionData(lp, section.id);
  const complete = sectionCompleteness(lp, section);
  const route = routeInfo(lp.workspace.route, lessonId) || {title:'Выбранный контекст', rule:''};

  const fields = section.required_fields.map(function(field, index){
    return '<div class="ba-field-block"><label>' + escapeHtml(field) + '</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceField(\'' + lessonId + '\',\'' + section.id + '\',' + index + ',this.value)">' + escapeHtml(data.fields[field] || '') + '</textarea></div>';
  }).join('');

  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openLesson(\'' + lessonId + '\')">← Назад</button><span class="ba-status is-active">Раздел 4 из 4</span></div>' +
    '<section class="ba-card"><div class="ba-workspace-head"><div><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ · ' + escapeHtml(route.title) + '</p><h2>' + escapeHtml(section.title) + '</h2><p>' + escapeHtml(route.rule) + '</p></div><b class="ba-progress-number">' + complete.percent + '%</b></div><div class="ba-progress-bar"><i style="width:' + complete.percent + '%"></i></div></section>' +
    '<section class="ba-card"><div class="ba-workspace-fields">' + fields + '<div class="ba-field-block"><label>Доказательство завершения</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceEvidence(\'' + lessonId + '\',\'' + section.id + '\',this.value)">' + escapeHtml(data.evidence || '') + '</textarea><span class="ba-field-hint">Критерий: ' + escapeHtml(section.completion_evidence) + '</span></div></div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Сохранено</span><b>Заполнено ' + complete.filled + ' из ' + complete.total + '</b></div></section>' +
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
  const definitions = finalFieldDefinitions(stage);
  const form = definitions.map(function(field){
    return '<div class="ba-field-block"><label>' + escapeHtml(field.label) + '</label><textarea class="ba-textarea" oninput="BusinessArchitecture.updateWorkspaceFinal(\'' + lessonId + '\',\'' + field.key + '\',this.value)">' + escapeHtml(final[field.key] || '') + '</textarea></div>';
  }).join('');
  const title = stage.artifact_title || (stage.completion_gate && stage.completion_gate.final_artifact) || 'Итоговый материал';
  const description = stage.artifact_description || 'Зафиксируйте вывод, решение, метрики и дату повторной проверки.';
  const html =
    '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderWorkspace(\'' + lessonId + '\',' + (stage.sections.length - 1) + ')">← К разделам</button><span class="ba-status ' + (info.complete ? 'is-done' : 'is-warning') + '">' + (info.complete ? 'Готово к завершению' : 'Заполните оставшиеся поля') + '</span></div>' +
    '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">ИТОГОВОЕ РЕШЕНИЕ</p><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(description) + '</p></section>' +
    '<section class="ba-card"><div class="ba-workspace-fields">' + form + '</div><div class="ba-completeness"><span data-ba-saved class="ba-saved">Сохранено</span><b>' + info.percent + '%</b></div><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.completeWorkspace(\'' + lessonId + '\')" ' + (info.complete ? '' : 'disabled') + '>Завершить работу</button></div>' +
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
  const title = stage.artifact_title || (stage.completion_gate && stage.completion_gate.final_artifact) || 'Рабочий материал';
  const next = nextCatalogEntry(lessonId);
  if (next && entryUnlocked(next.id)) {
    safeAlert('Материал «' + title + '» сохранён. Открыт следующий шаг: «' + next.title + '».');
    return openLesson(next.id);
  }
  safeAlert('Материал «' + title + '» сохранён в разделе «Мои материалы».');
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
    await ensureRemoteSync(false);
    await ensureCatalog();
    const entries = catalogEntries();
    const visibleEntries = entries.filter(function(entry){
      return workspaceUnlocked(entry.id) || itemHasProgress(entry.id);
    });

    if (!visibleEntries.length) {
      const html = '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button></div>' +
        '<section class="ba-card ba-empty"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>Здесь будут собираться рабочие карты бизнеса</h2><p>Сначала завершите управленческие задачи первого урока. После этого откроется практическая форма, а следующие материалы будут добавляться по мере прохождения первой части.</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">Продолжить обучение</button></div></section>';
      return renderWithAppShell(html,'home');
    }

    const materials = [];
    for (const entry of visibleEntries) {
      const lesson = await ensureLesson(entry.id);
      const stage = lesson.stages.find(function(item){ return item.id === 'architecture_assembly'; });
      const lp = getLessonProgress(entry.id).lesson;
      const info = workspaceCompleteness(lp, stage);
      const route = lp.workspace.route ? routeInfo(lp.workspace.route, entry.id) : null;
      materials.push({entry, lesson, stage, lp, info, route});
    }

    const completedCount = materials.filter(function(item){ return item.lp.completedAt; }).length;
    const cards = materials.map(function(item){
      const status = item.lp.completedAt ? 'готово' : (item.info.filled ? 'в работе' : 'доступно');
      const cls = item.lp.completedAt ? 'is-done' : '';
      const title = item.stage.artifact_title || item.stage.completion_gate.final_artifact;
      const description = item.stage.artifact_description || item.lesson.lesson.completion_result;
      return '<button class="ba-material-card ' + cls + '" onclick="BusinessArchitecture.renderWorkspace(\'' + item.entry.id + '\')">' +
        '<span class="ba-material-card-top"><span><small>' + escapeHtml(entryLabel(item.entry)) + '</small><b>' + escapeHtml(title) + '</b></span><span class="ba-status ' + (item.lp.completedAt ? 'is-done' : 'is-active') + '">' + status + '</span></span>' +
        '<span class="ba-material-card-text">' + escapeHtml(description) + '</span>' +
        '<span class="ba-material-card-progress"><i style="width:' + item.info.percent + '%"></i></span>' +
        '<span class="ba-material-card-meta">' + item.info.percent + '% · ' + escapeHtml(item.route ? item.route.title : 'контекст не выбран') + '</span>' +
      '</button>';
    }).join('');

    const finalDone = itemCompleted('PART-01-CASE');
    const html =
      '<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button><span class="ba-status ' + (finalDone ? 'is-done' : 'is-active') + '">' + (finalDone ? 'Первая часть завершена' : 'Черновики сохраняются') + '</span></div>' +
      '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>' + (finalDone ? 'Финансово-стратегическая карта бизнеса' : 'Рабочие карты первой части') + '</h2><p>' + (finalDone ? 'Финансовая система, стратегия, поток ценности и архитектура управления связаны в единый результат.' : 'Здесь накапливаются материалы, которые вы создаёте после каждого урока.') + '</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">Продолжить обучение</button></div></section>' +
      '<section class="ba-card"><div class="ba-material-summary"><div><span>Доступно материалов</span><b>' + materials.length + '</b></div><div><span>Завершено</span><b>' + completedCount + '</b></div></div></section>' +
      '<section class="ba-card"><p class="ba-eyebrow">ПЕРВАЯ ЧАСТЬ</p><div class="ba-material-grid">' + cards + '</div></section><div class="ba-footer-space"></div>';
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
    installSyncListeners();
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
    reviewQuizMistakes,
    restartQuiz,
    chooseWorkspaceRoute,
    renderWorkspace,
    moveWorkspace,
    updateWorkspaceField,
    updateWorkspaceEvidence,
    updateWorkspaceFinal,
    completeWorkspace,
    renderMyArchitecture,
    syncNow,
    getSyncStatus: function(){
      return {
        initialized: runtime.sync.initialized,
        enabled: runtime.sync.enabled,
        version: runtime.sync.serverVersion,
        saving: runtime.sync.saving,
        pending: runtime.sync.pending,
        lastError: runtime.sync.lastError ? String(runtime.sync.lastError.message || runtime.sync.lastError) : null
      };
    },
    installIntegration,
    getProgress: loadProgress
  };

  window.BusinessArchitecture = api;
  installIntegration();
})();
