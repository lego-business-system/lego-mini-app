
/* =====================================================
   Л.Е.Г.О mini app v2 — 6 направлений, 60 уроков
   ===================================================== */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

// ===== Supabase Edge Functions =====
const CHECK_ACCESS_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/check-access";
const SAVE_PROGRESS_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/save-progress";
const ADMIN_REVIEW_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/admin-review-homework";

const SUPPORT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeobmGwtLOcsLxxNB50wMBaO_8-jMIwxHuee-3G9QHcK-ceMg/viewform?usp=publish-editor";
const IDEA_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSe5A8MVuzqBcr8SGsuVK1K83BzboQZjfXf1g1MqwAjrX52VzA/viewform?usp=publish-editor";
const CONSULTATION_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeRSsxQa4eLWMPHYTREx82RSGdft6Mo4ZOZiL2MyvbrOdjcqw/viewform?usp=publish-editor";

const ADMIN_PANEL_PIN = "2405";
const ADMIN_TELEGRAM_IDS = ["1762603232"];
const ADMIN_TELEGRAM_USERNAMES = ["prosvewenie2000"];

const CATALOG_URL = "content/catalog.json";
const MODULE_SCORE_RULES = { presentation: 10, quiz: 10, books: 10, homeworkVerified: 70, total: 100 };

const state = {
  access: false,
  accessReason: null,
  user: null,
  role: "student",
  appMode: localStorage.getItem("lego_app_mode") || "student", // student | admin
  screen: "loading",
  catalog: null,
  lessonCache: {},
  remoteProgressByLesson: {},
  selectedActivityKey: localStorage.getItem("lego_selected_activity") || "trade",
  selectedLessonCode: localStorage.getItem("lego_selected_lesson") || "ENT-TR-01",
  stage: "lesson",
  slideIndex: 0,
  bookIndex: 0,
  questionIndex: 0,
  answers: {},
  growthMetrics: loadGrowthMetrics()
};

function $(id) { return document.getElementById(id); }
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]; }); }
function nowIso() { return new Date().toISOString(); }
function safePercent(value) { const n = Number(value || 0); return Math.max(0, Math.min(100, Math.round(n))); }
function actionButton(label, action, cls) { return `<button class="btn ${cls || "secondary"}" onclick="${action}">${label}</button>`; }
function externalButton(label, url, cls) { return `<a class="btn ${cls || "secondary"}" href="${url}" target="_blank" onclick="if('${url}'==='#'){alert('Ссылка будет добавлена позже.'); return false;}">${label}</a>`; }
function shortDate(value) { if(!value) return "—"; const d = new Date(value); if(isNaN(d.getTime())) return String(value); return d.toLocaleDateString("ru-RU"); }

function getTelegramUser() {
  return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : {};
}
function normalizeId(v) { return v === undefined || v === null ? "" : String(v).trim(); }
function normalizeUsername(v) { return v === undefined || v === null ? "" : String(v).replace("@", "").trim().toLowerCase(); }
function possibleIds() {
  const tgUser = getTelegramUser();
  const appUser = state.user || {};
  return [tgUser.id, appUser.telegram_id, appUser.id].map(normalizeId).filter(Boolean);
}
function possibleUsernames() {
  const tgUser = getTelegramUser();
  const appUser = state.user || {};
  return [tgUser.username, appUser.username, appUser.telegram_username].map(normalizeUsername).filter(Boolean);
}
function isAdminUser() {
  if (state.role === "admin") return true;
  return possibleIds().some(id => ADMIN_TELEGRAM_IDS.map(normalizeId).includes(id)) ||
         possibleUsernames().some(u => ADMIN_TELEGRAM_USERNAMES.map(normalizeUsername).includes(u));
}
function isAdminMode() { return isAdminUser() && state.appMode === "admin"; }
function setAppMode(mode) {
  if (mode === "admin" && !isAdminUser()) { alert("Режим администратора доступен только владельцу."); return; }
  state.appMode = mode;
  localStorage.setItem("lego_app_mode", mode);
  renderHome();
}

function progressKey(code) { return "lego_progress_v2_" + code; }
function loadLocalProgress(code) { try { return JSON.parse(localStorage.getItem(progressKey(code)) || "{}"); } catch(e){ return {}; } }
function saveLocalProgress(code, patch) {
  const current = loadLocalProgress(code);
  const next = Object.assign({}, current, patch || {}, { updated_at: nowIso() });
  localStorage.setItem(progressKey(code), JSON.stringify(next));
  return next;
}
function getProgress(code) {
  return Object.assign({}, state.remoteProgressByLesson[code] || {}, loadLocalProgress(code) || {});
}
function isStageDone(code, stage) {
  const p = getProgress(code);
  if(stage === "presentation") return Boolean(p.presentation_completed || p.presentation_completed_at);
  if(stage === "quiz") return Boolean(p.quiz_completed || p.quiz_completed_at);
  if(stage === "books") return Boolean(p.books_completed || p.books_completed_at);
  if(stage === "homeworkSubmitted") return Boolean(p.homework_submitted || p.homework_submitted_at || p.status === "homework_submitted" || p.status === "completed");
  if(stage === "homeworkVerified") return Boolean(p.homework_verified || p.homework_checked || p.homework_verified_at || p.status === "completed");
  return false;
}
function lessonScore(code) {
  let score = 0;
  if (isStageDone(code,"presentation")) score += 10;
  if (isStageDone(code,"quiz")) score += 10;
  if (isStageDone(code,"books")) score += 10;
  if (isStageDone(code,"homeworkVerified")) score += 70;
  return score;
}
function lessonStageLabel(code) {
  if (isStageDone(code,"homeworkVerified")) return "Модуль закрыт";
  if (isStageDone(code,"homeworkSubmitted")) return "ДЗ на проверке";
  if (isStageDone(code,"books")) return "Сдать ДЗ";
  if (isStageDone(code,"quiz")) return "Изучить саммари";
  if (isStageDone(code,"presentation")) return "Пройти тест";
  return "Начать презентацию";
}
function lessonStageAction(code) {
  if (isStageDone(code,"homeworkSubmitted") && !isStageDone(code,"homeworkVerified")) return "renderHomeworkStatus()";
  if (isStageDone(code,"books")) return "renderHomework()";
  if (isStageDone(code,"quiz")) return "startBooks()";
  if (isStageDone(code,"presentation")) return "startQuiz(false)";
  return "startSlides()";
}

async function remoteSave(event, payload) {
  const code = state.selectedLessonCode;
  saveLocalProgress(code, localPatchForEvent(event, payload || {}));
  if (!tg || !tg.initData) return { ok: true, local: true };
  try {
    const response = await fetch(SAVE_PROGRESS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData, lessonCode: code, event, payload: payload || {} })
    });
    const result = await response.json().catch(() => ({}));
    if (result && result.progress) state.remoteProgressByLesson[code] = result.progress;
    return result;
  } catch (error) {
    console.error("REMOTE_SAVE_ERROR", error);
    return { ok: true, local: true, error: "REMOTE_SAVE_FAILED" };
  }
}
function localPatchForEvent(event, payload) {
  const now = nowIso();
  if(event === "lesson_started") return { status:"in_progress", current_step:"presentation", presentation_started_at: now, last_slide_number: payload.lastSlideNumber || 1 };
  if(event === "slide_viewed") return { status:"in_progress", current_step:"presentation", last_slide_number: payload.lastSlideNumber || 1 };
  if(event === "presentation_completed") return { status:"in_progress", current_step:"quiz", presentation_completed:true, presentation_completed_at: now, last_slide_number: payload.lastSlideNumber || 0 };
  if(event === "quiz_progress") return { status:"in_progress", current_step:"quiz", current_question: state.questionIndex, quiz_answers: state.answers };
  if(event === "quiz_completed") return { status:"in_progress", current_step: payload.passed ? "books" : "quiz", quiz_completed: Boolean(payload.passed), quiz_completed_at: payload.passed ? now : undefined, quiz_score: payload.score, quiz_total: payload.total, quiz_answers: payload.answers };
  if(event === "books_started") return { status:"in_progress", current_step:"books", books_started_at: now, last_book_slide_number: payload.lastBookSlideNumber || 1 };
  if(event === "book_slide_viewed") return { status:"in_progress", current_step:"books", last_book_slide_number: payload.lastBookSlideNumber || 1 };
  if(event === "books_completed") return { status:"in_progress", current_step:"homework", books_completed:true, books_completed_at: now, last_book_slide_number: payload.lastBookSlideNumber || 0 };
  if(event === "homework_started") return { status:"in_progress", current_step:"homework", homework_started_at: now };
  if(event === "homework_submitted") return { status:"homework_submitted", current_step:"review", homework_submitted:true, homework_submitted_at: now };
  if(event === "homework_verified") return { status:"completed", current_step:"completed", homework_verified:true, homework_checked:true, homework_verified_at: now, completed_at: now };
  return { updated_at: now };
}

async function loadCatalog() {
  if (state.catalog) return state.catalog;
  const response = await fetch(CATALOG_URL + "?v=2");
  if (!response.ok) throw new Error("CATALOG_LOAD_FAILED");
  state.catalog = await response.json();
  return state.catalog;
}
async function loadLesson(code) {
  if (state.lessonCache[code]) return state.lessonCache[code];
  const lesson = state.catalog.lessons.find(l => l.code === code);
  if (!lesson) throw new Error("LESSON_NOT_FOUND: " + code);
  const response = await fetch(lesson.contentUrl + "?v=2");
  if (!response.ok) throw new Error("LESSON_CONTENT_LOAD_FAILED: " + code);
  const data = await response.json();
  state.lessonCache[code] = data;
  return data;
}
function getLessonMeta(code) { return state.catalog.lessons.find(l => l.code === code); }
function getActivity(key) { return state.catalog.activities.find(a => a.key === key); }
function activityLessons(key) { return state.catalog.lessons.filter(l => l.activityKey === key).sort((a,b)=>a.number-b.number); }
function canOpenLesson(meta) {
  if (!meta) return false;
  if (isAdminMode()) return true;
  if (meta.number === 1) return true;
  const prev = activityLessons(meta.activityKey).find(l => l.number === meta.number - 1);
  return prev ? isStageDone(prev.code, "homeworkVerified") : false;
}
function setSelectedActivity(key) { state.selectedActivityKey = key; localStorage.setItem("lego_selected_activity", key); renderLearning(); }
async function openLesson(code) {
  const meta = getLessonMeta(code);
  if (!meta) return;
  if (!canOpenLesson(meta)) { alert("Урок пока закрыт. Следующий модуль открывается после проверенного ДЗ предыдущего урока."); return; }
  state.selectedLessonCode = code;
  state.selectedActivityKey = meta.activityKey;
  localStorage.setItem("lego_selected_lesson", code);
  localStorage.setItem("lego_selected_activity", meta.activityKey);
  await loadLesson(code);
  renderLessonHub();
}

function shell(content, activeTab) {
  const root = $("app");
  if (!root) return;
  const modeButton = isAdminUser()
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Админ" : "Тест ученика"}</button>`
    : "";
  root.innerHTML = `
    <div class="app-shell-v2">
      <header class="app-header-v2">
        <div>
          <div class="brand-logo">Л.Е.Г.О.</div>
          <div class="brand-subtitle">система внедрения управленческих изменений</div>
        </div>
        ${modeButton}
      </header>
      <main class="content-v2">${content}</main>
      ${bottomNav(activeTab || "home")}
    </div>`;
}
function bottomNav(active) {
  const item = (key,label,icon,fn)=>`<button class="bottom-item ${active===key?'active':''}" onclick="${fn}"><span>${icon}</span><b>${label}</b></button>`;
  return `<nav class="bottom-nav-v2 bottom-nav-v2-four">
    ${item('home','Главная','⌂','renderHome()')}
    ${item('learning','Обучение','▣','renderLearning()')}
    ${item('homework','ДЗ','✓','renderHomeworkCenter()')}
    ${item('profile','Профиль','○','renderProfile()')}
  </nav>`;
}
function card(cls, html) { return `<section class="card-v2 ${cls||''}">${html}</section>`; }
function progressRing(percent, label, sub) {
  const p = safePercent(percent);
  return `<div class="ring-wrap"><div class="ring" style="--p:${p}%"><div class="ring-inner"><b>${p}%</b><span>${label||'прогресс'}</span></div></div>${sub?`<p class="ring-sub">${sub}</p>`:''}</div>`;
}

function cleanStudentHtml(html) {
  let out = String(html || "");
  // Служебные блоки нужны для создания изображений, но не для интерфейса ученика.
  out = out.replace(/<div class="slide-meta"[\s\S]*?<\/div>\s*/g, "");
  out = out.replace(/<p><b>Текст на изображении:[\s\S]*?<\/p>\s*/g, "");
  out = out.replace(/<p><b>Визуальная идея:[\s\S]*?<\/p>\s*/g, "");
  return out.trim() || "<p>Текст к этому блоку будет добавлен после редакторской проверки.</p>";
}

function legacyTradeImage(label, current) {
  const n = String(current).padStart(2, "0");
  if (state.selectedLessonCode !== "ENT-TR-01") return null;
  if (label === "Слайд") return `assets/lesson/slide_${n}.png`;
  if (label === "Саммари") {
    if (current >= 1 && current <= 5) return `assets/books/book1/book1_${String(current).padStart(2,"0")}.png`;
    if (current >= 6 && current <= 10) return `assets/books/book2/book2_${String(current-5).padStart(2,"0")}.png`;
    if (current >= 11 && current <= 15) return `assets/books/book3/book3_${String(current-10).padStart(2,"0")}.png`;
    if (current >= 16 && current <= 20) return `assets/books/book4/book4_${String(current-15).padStart(2,"0")}.png`;
    if (current >= 21 && current <= 25) return `assets/books/book5/book5_${String(current-20).padStart(2,"0")}.png`;
    if (current === 26) return "assets/books/final_summary.png";
  }
  return null;
}

function handleImageError(img) {
  if (!img) return;
  if (img.dataset && img.dataset.fallbackUsed !== "1") {
    const legacy = legacyTradeImage(img.dataset.label, Number(img.dataset.index));
    if (legacy && img.src.indexOf(legacy) === -1) {
      img.dataset.fallbackUsed = "1";
      img.src = legacy + "?v=7";
      return;
    }
  }
  img.style.display = "none";
  const fallback = img.nextElementSibling;
  if (fallback) fallback.style.display = "flex";
}

function kpi(title,value,note,cls){ return `<div class="kpi-card ${cls||''}"><span>${title}</span><b>${value}</b><p>${note||''}</p></div>`; }
function nextLessonMeta() {
  const all = state.catalog.lessons;
  const open = all.filter(canOpenLesson);
  const inProgress = open.find(l => lessonScore(l.code) < 100) || open[0] || all[0];
  return getLessonMeta(state.selectedLessonCode) || inProgress;
}
function totalProgressPercent() {
  const lessons = state.catalog.lessons || [];
  if (!lessons.length) return 0;
  const sum = lessons.reduce((acc,l)=>acc+lessonScore(l.code),0);
  return Math.round(sum / (lessons.length * 100) * 100);
}
function currentActivityProgress() {
  const lessons = activityLessons(state.selectedActivityKey);
  if (!lessons.length) return 0;
  const sum = lessons.reduce((acc,l)=>acc+lessonScore(l.code),0);
  return Math.round(sum / (lessons.length * 100) * 100);
}

function renderHome() {
  const meta = nextLessonMeta();
  const act = getActivity(meta.activityKey);
  state.selectedLessonCode = meta.code;
  state.selectedActivityKey = meta.activityKey;
  const score = lessonScore(meta.code);
  const nextLabel = lessonStageLabel(meta.code);
  const html = `
    ${card('hero-dashboard', `
      <div class="hero-layout">
        <div>
          <p class="eyebrow">текущий шаг</p>
          <h1>${esc(nextLabel)}</h1>
          <p>${esc(act.title)} · урок ${String(meta.number).padStart(2,'0')} · ${esc(meta.title)}</p>
          <button class="btn primary" onclick="openLesson('${meta.code}')">Продолжить</button>
        </div>
        ${progressRing(score, 'урок', 'Баллы текущего урока')}
      </div>
    `)}

    ${card('', `<h2>Основные блоки</h2><p>Выберите маршрут. Активный блок сейчас — предпринимательская система.</p>
      <div class="top-track-grid">
        <button class="track-card disabled"><b>Нет своего бизнеса</b><p>Запуск, выбор ниши, проверка идеи. Раздел будет подключён позже.</p></button>
        <button class="track-card active" onclick="renderLearning()"><b>Я предприниматель</b><p>Диагностика, уроки, ДЗ, проверка и управленческие действия.</p></button>
        <button class="track-card disabled"><b>Я сотрудник</b><p>Маршрут для руководителей, директоров и управленцев внутри компании.</p></button>
      </div>`)}

    ${card('', `<h2>Направления предпринимателя</h2><p>Первые уроки доступны во всех направлениях. Следующий урок в каждом направлении открывается после приёмки ДЗ по предыдущему уроку.</p>
      <div class="activity-mini-grid">
        ${state.catalog.activities.map(a=>`<button class="activity-mini" onclick="setSelectedActivity('${a.key}')"><span>${a.icon}</span><b>${esc(a.title)}</b></button>`).join('')}
      </div>`)}
  `;
  shell(html, 'home');
}
function renderLearning() {
  const act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
  const adminNote = isAdminMode() ? `<p class="small admin-note">Режим администратора: все уроки открыты для проверки и предпросмотра.</p>` : "";
  const html = `
    ${card('blue-card-v2', `<h1>Обучение</h1><p>Выбор направления и урока. Первый урок в каждом направлении доступен сразу. Дальше уроки открываются после приёмки ДЗ.</p>${adminNote}`)}
    <div class="activity-grid-v2">
      ${state.catalog.activities.map(a=>`<button class="activity-card-v2 ${a.key===state.selectedActivityKey?'active':''}" onclick="setSelectedActivity('${a.key}')"><span>${a.icon}</span><b>${esc(a.title)}</b><small>${esc(a.chain)}</small></button>`).join('')}
    </div>
    ${card('', `<h2>${esc(act.title)}</h2><p>${esc(act.chain)}</p><div class="lesson-list-v2">${activityLessons(act.key).map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}
function renderLessonRow(l) {
  const score=lessonScore(l.code); const locked=!canOpenLesson(l);
  return `<button class="lesson-row-v2 ${locked?'locked':''}" onclick="openLesson('${l.code}')">
    <div><b>${String(l.number).padStart(2,'0')}. ${esc(l.title)}</b><p>${locked?'закрыт':lessonStageLabel(l.code)} · ${score}/100</p></div>
    <span>${locked?'🔒':(score===100?'✓':'→')}</span>
  </button>`;
}
async function renderLessonHub() {
  const lesson = await loadLesson(state.selectedLessonCode);
  const meta = getLessonMeta(state.selectedLessonCode);
  const score=lessonScore(meta.code);
  const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
  const html = `
    ${card('blue-card-v2', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><p>${esc(lesson.description)}</p>${progressRing(score,'урок')}`)}
    ${card('', `<h2>Что внутри урока</h2><div class="lesson-inside-grid"><div><b>Презентация</b><p>Основная логика урока и практические разборы.</p></div><div><b>Тест</b><p>Проверка понимания на ситуационных вопросах.</p></div><div><b>Саммари</b><p>5 книг, которые усиливают тему урока.</p></div><div><b>ДЗ</b><p>Таблица, вывод, действие и проверка.</p></div></div>`)}
    <div class="stage-grid-v2">
      ${stageCard('presentation','Презентация','основные слайды и текст',isStageDone(meta.code,'presentation'),'startSlides()')}
      ${stageCard('quiz','Тест','25 ситуационных вопросов',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
      ${stageCard('books','Саммари','5 книг × 5 экранов + финал',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
      ${stageCard('homework','ДЗ','таблица, вывод и проверка',isStageDone(meta.code,'homeworkSubmitted'),'renderHomework()',!isStageDone(meta.code,'books') && !isAdminMode())}
    </div>
    ${adminService}
  `;
  shell(html, 'learning');
}
function stageCard(key,title,note,done,action,locked){ return `<button class="stage-card-v2 ${done?'done':''} ${locked?'locked':''}" onclick="${locked?'alert(\'Этап пока закрыт.\')':action}"><b>${title}</b><p>${note}</p><span>${done?'✓':(locked?'🔒':'→')}</span></button>`; }
async function startSlides(){ const p=getProgress(state.selectedLessonCode); state.slideIndex = Math.max(0, Number(p.last_slide_number || 1)-1); await remoteSave('lesson_started',{lastSlideNumber:state.slideIndex+1}); renderSlide(); }
async function renderSlide(){ const lesson=await loadLesson(state.selectedLessonCode); const slide=lesson.slides[state.slideIndex]; shell(`${topLessonNav('prevSlide()','nextSlide()',state.slideIndex===0,state.slideIndex===lesson.slides.length-1?'К тесту':'Далее')} ${mediaScreen(slide.image,'Слайд',state.slideIndex+1,lesson.slides.length,slide.descriptionHtml)}`,'learning'); }
function topLessonNav(prev,next,prevDisabled,nextLabel){ return `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" ${prevDisabled?'disabled':''} onclick="${prev}">Назад</button><button class="btn primary" onclick="${next}">${nextLabel}</button></div>`; }
function mediaScreen(image,label,current,total,html){
  const legacy = legacyTradeImage(label, current);
  const src = legacy || image || "";
  return `<div class="media-counter">${label}: ${current}/${total}</div><div class="media-box-v2"><img src="${src}?v=7" data-label="${label}" data-index="${current}" onerror="handleImageError(this)"><div class="image-missing-v2" style="display:none"><b>${label} ${current}</b><p>Иллюстрация в подготовке.</p></div></div><section class="slide-text-v2">${cleanStudentHtml(html)}</section>`;
}
async function prevSlide(){ if(state.slideIndex>0){ state.slideIndex--; await remoteSave('slide_viewed',{lastSlideNumber:state.slideIndex+1}); renderSlide(); } }
async function nextSlide(){ const lesson=await loadLesson(state.selectedLessonCode); if(state.slideIndex<lesson.slides.length-1){ state.slideIndex++; await remoteSave('slide_viewed',{lastSlideNumber:state.slideIndex+1}); renderSlide(); } else { await remoteSave('presentation_completed',{lastSlideNumber:lesson.slides.length}); startQuiz(false); } }
async function startQuiz(reset){ const lesson=await loadLesson(state.selectedLessonCode); const p=getProgress(state.selectedLessonCode); state.questionIndex = reset ? 0 : Number(p.current_question || 0); state.answers = reset ? {} : (p.quiz_answers || {}); renderQuestion(); }
async function renderQuestion(){ const lesson=await loadLesson(state.selectedLessonCode); const q=lesson.quiz[state.questionIndex]; const selected=state.answers[state.questionIndex]; shell(`${topLessonNav('prevQuestion()','nextQuestion()',state.questionIndex===0,state.questionIndex===lesson.quiz.length-1?'Завершить':'Далее')}<div class="quiz-card-v2"><p class="eyebrow">Вопрос ${state.questionIndex+1}/${lesson.quiz.length}</p><h2>${esc(q.q)}</h2>${q.a.map((a,i)=>`<button class="option-v2 ${selected===i?'selected':''}" onclick="selectAnswer(${i})">${String.fromCharCode(65+i)}. ${esc(a)}</button>`).join('')}</div>`,'learning'); }
async function selectAnswer(i){ state.answers[state.questionIndex]=i; await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers}); renderQuestion(); }
async function prevQuestion(){ if(state.questionIndex>0){state.questionIndex--; await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers}); renderQuestion();} }
async function nextQuestion(){ const lesson=await loadLesson(state.selectedLessonCode); if(state.answers[state.questionIndex]===undefined){ alert('Выберите вариант ответа.'); return; } if(state.questionIndex<lesson.quiz.length-1){ state.questionIndex++; await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers}); renderQuestion(); } else { finishQuiz(); } }
async function finishQuiz(){ const lesson=await loadLesson(state.selectedLessonCode); let score=0; lesson.quiz.forEach((q,i)=>{ if(state.answers[i]===q.correct) score++; }); const passed=score>=(lesson.passScore||19); await remoteSave('quiz_completed',{score,total:lesson.quiz.length,passed,answers:state.answers}); shell(card(passed?'result-ok-v2':'result-bad-v2', `<h1>${passed?'Тест пройден':'Тест не пройден'}</h1><p>Результат: <b>${score}/${lesson.quiz.length}</b>.</p><p>${passed?'Открыт блок саммари книг.':'Стоит вернуться к презентации и повторить логику урока.'}</p>${passed?actionButton('К саммари','startBooks()','primary'):actionButton('Вернуться к презентации','startSlides()','primary')}${actionButton('К уроку','renderLessonHub()','secondary')}`),'learning'); }
async function startBooks(){ const p=getProgress(state.selectedLessonCode); state.bookIndex=Math.max(0,Number(p.last_book_slide_number||1)-1); await remoteSave('books_started',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); }
async function renderBook(){ const lesson=await loadLesson(state.selectedLessonCode); const scr=lesson.bookScreens[state.bookIndex]; shell(`${topLessonNav('prevBook()','nextBook()',state.bookIndex===0,state.bookIndex===lesson.bookScreens.length-1?'К ДЗ':'Далее')} ${mediaScreen(scr.image,'Саммари',state.bookIndex+1,lesson.bookScreens.length,scr.descriptionHtml)}`,'learning'); }
async function prevBook(){ if(state.bookIndex>0){ state.bookIndex--; await remoteSave('book_slide_viewed',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); } }
async function nextBook(){ const lesson=await loadLesson(state.selectedLessonCode); if(state.bookIndex<lesson.bookScreens.length-1){ state.bookIndex++; await remoteSave('book_slide_viewed',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); } else { await remoteSave('books_completed',{lastBookSlideNumber:lesson.bookScreens.length}); renderHomework(); } }
async function renderHomework(){
  const lesson=await loadLesson(state.selectedLessonCode);
  await remoteSave('homework_started',{});
  const hw=lesson.homework||{};
  shell(`${card('blue-card-v2', `<h1>${esc(hw.title || 'Домашнее задание')}</h1><p>ДЗ закрепляет урок через управленческий вывод, действие на 7 дней и метрику проверки.</p>`)}${card('', `<h2>Порядок сдачи</h2><div class="list-clean"><div><b>1. Открыть таблицу</b><p>Сделать копию файла и заполнить данные по своему бизнесу.</p></div><div><b>2. Получить вывод</b><p>Сформулировать главный диагноз, следующий фокус и действие на 7 дней.</p></div><div><b>3. Отправить ссылку</b><p>Открыть доступ к таблице и отправить ссылку через форму сдачи ДЗ.</p></div><div><b>4. Дождаться проверки</b><p>Следующий урок откроется после приёмки ДЗ администратором.</p></div></div><div class="grid-v2">${externalButton('Открыть таблицу ДЗ',hw.sheetUrl||'#','primary')}${externalButton('Открыть форму сдачи',hw.submitFormUrl||'#','secondary')}${actionButton('Я отправил ДЗ','markHomeworkSubmitted()','primary')}</div>`)}${isAdminMode()?card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`):''}`,'homework');
}
async function markHomeworkSubmitted(){ if(!confirm('Форма со ссылкой на ДЗ уже отправлена?')) return; await remoteSave('homework_submitted',{submittedAt:nowIso()}); renderHomeworkStatus(); }
function renderHomeworkStatus(){ const code=state.selectedLessonCode; shell(`${card('blue-card-v2', `<h1>Статус ДЗ</h1><p>${isStageDone(code,'homeworkVerified')?'ДЗ проверено. Модуль закрыт.':(isStageDone(code,'homeworkSubmitted')?'ДЗ отправлено на проверку.':'ДЗ пока не отправлено.')}</p>`)}${actionButton('К уроку','renderLessonHub()','primary')}`,'homework'); }
function renderHomeworkCenter(){ const lessons = state.catalog.lessons.filter(l=>isStageDone(l.code,'homeworkSubmitted') || canOpenLesson(l)).slice(0,20); shell(`${card('blue-card-v2', `<h1>Домашние задания</h1><p>Здесь собраны текущие ДЗ и статусы проверки.</p>`)}${card('', `<div class="lesson-list-v2">${lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}').then(()=>renderHomework())"><div><b>${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${isStageDone(l.code,'homeworkVerified')?'проверено':(isStageDone(l.code,'homeworkSubmitted')?'на проверке':'можно открыть')}</p></div><span>→</span></button>`).join('')}</div>`)}`,'homework'); }

function loadGrowthMetrics(){ try { return JSON.parse(localStorage.getItem('lego_growth_metrics')||'[]'); } catch(e){ return []; } }
function saveGrowthMetrics(){ localStorage.setItem('lego_growth_metrics', JSON.stringify(state.growthMetrics||[])); }
function addMetric(){ const name=$('metric-name')?.value.trim(); const before=Number($('metric-before')?.value||0); const after=Number($('metric-after')?.value||0); if(!name){alert('Введите название показателя.'); return;} state.growthMetrics.push({name,before,after,createdAt:nowIso()}); saveGrowthMetrics(); renderDashboard(); }
function removeMetric(i){ state.growthMetrics.splice(i,1); saveGrowthMetrics(); renderDashboard(); }
function renderDashboard(){ const rows=state.growthMetrics||[]; shell(`${card('blue-card-v2', `<h1>Мои показатели роста</h1><p>Фиксация изменений бизнеса: было → стало → изменение. Это отдельный блок, не смешанный с учебным прогрессом.</p>`)}${card('', `<h2>Добавить показатель</h2><div class="metric-form"><input id="metric-name" placeholder="Показатель: выручка, конверсия, заявки"><input id="metric-before" type="number" placeholder="Было"><input id="metric-after" type="number" placeholder="Стало"><button class="btn primary" onclick="addMetric()">Сохранить</button></div>`)}${card('', `<h2>История</h2>${rows.length?rows.map((r,i)=>metricRow(r,i)).join(''):'<p>Пока нет показателей. Добавьте первый показатель вручную.</p>'}`)}`,'dashboard'); }
function metricRow(r,i){ const diff=Number(r.after)-Number(r.before); const pct=r.before?Math.round(diff/Number(r.before)*100):0; return `<div class="metric-row"><div><b>${esc(r.name)}</b><p>${r.before} → ${r.after} · ${diff>=0?'+':''}${diff} ${r.before?`(${pct>=0?'+':''}${pct}%)`:''}</p></div><button onclick="removeMetric(${i})">×</button></div>`; }
function renderProfile(){
  const total = totalProgressPercent();
  const adminBlock = isAdminUser()
    ? `${card('', `<h2>Режим работы</h2><p>Переключатель виден только администратору. У обычного ученика этот блок не отображается.</p><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Тест как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Админ</button></div>`)}`
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${isAdminUser()?'администратор':'участник'}</p>`)}${card('', `<h2>Общий прогресс</h2><p>Общий прогресс хранится здесь, чтобы не дублировать его внутри каждого направления.</p>${progressRing(total,'общий','по всем урокам')}`)}${adminBlock}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}${isAdminUser()?actionButton('Админ-панель','renderAdmin()','primary'):''}`)}`,'profile');
}
function renderAdmin(){ if(!isAdminUser()){alert('Нет прав администратора.'); return;} shell(`${card('blue-card-v2', `<h1>Админ-панель</h1><p>Полный доступ ко всем урокам, предпросмотр контента и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile'); }
async function adminReview(action){ const target=$('admin-target-user')?.value.trim(); const comment=$('admin-review-comment')?.value.trim(); if(!target){alert('Укажите ученика.'); return;} if(action==='reject_homework'&&!comment){alert('Для доработки нужен комментарий.'); return;} if(!tg||!tg.initData){alert('Админ-проверка работает внутри Telegram WebApp.'); return;} const res=await fetch(ADMIN_REVIEW_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData,lessonCode:state.selectedLessonCode,targetUser:target,action,comment,checkedAt:nowIso(),homeworkScore:70})}); const out=await res.json().catch(()=>({})); alert(out.ok?'Готово. Статус обновлён.':('Ошибка: '+(out.reason||out.error||'неизвестно'))); }
function adminApproveTargetUser(){ adminReview('approve_homework'); }
function adminRejectTargetUser(){ adminReview('reject_homework'); }

function emergencyScreen(message){ const root=$('app'); if(root) root.innerHTML=`<div class="emergency"><h1>Ошибка запуска</h1><p>${esc(message)}</p></div>`; }
function accessDenied(reason){ shell(card('result-bad-v2', `<h1>Доступ закрыт</h1><p>Приложение доступно только участникам закрытого Telegram-канала.</p><p>Причина: <b>${esc(reason)}</b></p>`),'home'); }
async function checkAccess(){
  shell(card('blue-card-v2', '<h1>Проверяем доступ</h1><p>Загружается каталог уроков и проверяется Telegram-доступ.</p>'),'home');
  await loadCatalog();
  if(!tg || !tg.initData){ accessDenied('OPEN_FROM_TELEGRAM_REQUIRED'); return; }
  try{
    const response=await fetch(CHECK_ACCESS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok || !result.access){ accessDenied(result.reason||'ACCESS_DENIED'); return; }
    state.access=true; state.accessReason=result.reason; state.user=result.user || null; state.role=result.user?.role || 'student';
    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if(result.progress && result.lesson && result.lesson.code) state.remoteProgressByLesson[result.lesson.code]=result.progress;
    if(isAdminUser() && !localStorage.getItem('lego_app_mode')) state.appMode='admin';
    renderHome();
  } catch(e){ console.error(e); accessDenied('CHECK_ACCESS_ERROR'); }
}
async function boot(){ try{ await checkAccess(); }catch(e){ console.error(e); emergencyScreen(e.message||'BOOT_ERROR'); } }
window.addEventListener('error', e=>{ console.error(e.error||e.message); emergencyScreen(e.message||'GLOBAL_ERROR'); });
window.addEventListener('unhandledrejection', e=>{ console.error(e.reason); emergencyScreen(e.reason?.message||'UNHANDLED_REJECTION'); });
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
