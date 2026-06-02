
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

const HOMEWORK_SHEET_URLS = {
  "ENT-TR-01": "https://docs.google.com/spreadsheets/d/1wgmWpz1unczwuP5Pzy8j48I9rBVrSKV972brtxxdSSE/edit?gid=2085500086#gid=2085500086",
  "ENT-SV-01": "https://docs.google.com/spreadsheets/d/1GWtLkxXM-gBhPTh5ywfEZubQeI0U5A3sL3lD07vSCt8/edit?gid=1775915904#gid=1775915904",
  "ENT-PR-01": "https://docs.google.com/spreadsheets/d/1x8BPmDvz3AYTqhcOWc_eEHU4OTBBK5Un3DcFNv1Ljkc/edit?gid=595169054#gid=595169054",
  "ENT-BD-01": "https://docs.google.com/spreadsheets/d/1Qe4LN3CgfI0PyHLctWHWgRypV4FxJbKxGgV4sXjgjHY/edit?gid=159267392#gid=159267392",
  "ENT-LG-01": "https://docs.google.com/spreadsheets/d/1zWTruAN4wxppvxp3E0k9oEzNf712-pb9Vuvff9lvNfs/edit?gid=1527408610#gid=1527408610",
  "ENT-HR-01": "https://docs.google.com/spreadsheets/d/1u2P0Aq8K1jC8ArOumqXqZQxm8yLI51Ew0kfwp47dvdY/edit?gid=2075408749#gid=2075408749"
};

const ADMIN_PANEL_PIN = "2405";
const ADMIN_TELEGRAM_IDS = ["1762603232"];
const ADMIN_TELEGRAM_USERNAMES = ["prosvewenie2000"];

const CATALOG_URL = "content/catalog.json";
const APP_CACHE_VERSION = "v13-logo-png-20260602";
const MODULE_SCORE_RULES = { presentation: 10, quiz: 10, books: 10, homeworkVerified: 70, total: 100 };
const CONSULTATION_COST = 25000;
const READY_FIRST_LESSON_CODES = ["ENT-TR-01", "ENT-SV-01"];

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
  if (mode === "admin" && !isAdminUser()) { alert("Режим Босса доступен только владельцу."); return; }
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
  const response = await fetch(CATALOG_URL + "?v=" + APP_CACHE_VERSION);
  if (!response.ok) throw new Error("CATALOG_LOAD_FAILED");
  state.catalog = await response.json();
  return state.catalog;
}
async function loadLesson(code) {
  if (state.lessonCache[code]) return state.lessonCache[code];
  const lesson = state.catalog.lessons.find(l => l.code === code);
  if (!lesson) throw new Error("LESSON_NOT_FOUND: " + code);
  const response = await fetch(lesson.contentUrl + "?v=" + APP_CACHE_VERSION);
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
function setSelectedActivity(key) { state.selectedActivityKey = key; localStorage.setItem("lego_selected_activity", key); renderActivityLessons(key); }
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
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Админ" : "Режим ученика"}</button>`
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
  const r = 38;
  const c = Math.round(2 * Math.PI * r);
  const offset = Math.round(c * (1 - p / 100));
  return `<div class="ring-wrap clean-progress-widget">
    <div class="ring-svg-box">
      <svg class="ring-svg" viewBox="0 0 96 96" aria-label="${p}%">
        <circle class="ring-track" cx="48" cy="48" r="${r}"></circle>
        <circle class="ring-value" cx="48" cy="48" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="ring-center-text"><b>${p}%</b><span>${label||'прогресс'}</span></div>
    </div>
    ${sub?`<p class="ring-sub">${sub}</p>`:''}
  </div>`;
}

function lessonProgressMini(code) {
  const score = lessonScore(code);
  const percent = safePercent(score);
  return `<div class="lesson-progress-mini">
    <div class="lesson-progress-top"><span>Прогресс урока</span><b>${percent}%</b></div>
    <div class="lesson-progress-bar"><div style="width:${percent}%"></div></div>
    <div class="lesson-progress-bottom"><span>Баллы</span><b>${score} / 100</b></div>
  </div>`;
}

function lessonOverviewCard(lesson) {
  const img = lesson.overviewImage || `assets/lesson_overview/${lesson.code}.png`;
  return `<section class="lesson-overview-card">
    <img src="${img}?v=${APP_CACHE_VERSION}" alt="Карта урока" onerror="this.closest('.lesson-overview-card').style.display='none';">
  </section>`;
}

function getActivityProgressInfo(key) {
  const lessons = activityLessons(key);
  const openCount = lessons.filter(canOpenLesson).length;
  const doneCount = lessons.filter(l => lessonScore(l.code) >= 100).length;
  return { lessons, openCount, doneCount };
}


function cleanStudentHtml(html) {
  let out = String(html || "");
  // Служебные блоки нужны для создания изображений, но не для интерфейса ученика.
  out = out.replace(/<div class="slide-meta"[\s\S]*?<\/div>\s*/g, "");
  out = out.replace(/<p><b>Текст на изображении:[\s\S]*?<\/p>\s*/g, "");
  out = out.replace(/<p><b>Визуальная идея:[\s\S]*?<\/p>\s*/g, "");
  return out.trim() || "<p>Текст к этому блоку будет добавлен после редакторской проверки.</p>";
}


function stripTags(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function sentenceCount(text) {
  const m = String(text || "").match(/[.!?…]+/g);
  return m ? m.length : 0;
}
function paragraphCount(html) {
  return (String(html || "").match(/<p[\s>]/g) || []).length;
}
function needsLectureExpansion(html) {
  const plain = stripTags(html);
  return paragraphCount(html) < 4 || sentenceCount(plain) < 12 || plain.split(/\s+/).length < 230;
}
function extractMetaText(html, label) {
  const re = new RegExp(label + ":<\\/b><p>([\\s\\S]*?)<\\/p>", "i");
  const m = String(html || "").match(re);
  return m ? stripTags(m[1]) : "";
}
function renderDisplayText(item, kind) {
  const raw = item && item.descriptionHtml ? item.descriptionHtml : "";
  return cleanStudentHtml(raw);
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
      img.src = legacy + "?v=" + APP_CACHE_VERSION;
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
        ${progressRing(score, 'урок', 'текущий модуль')}
      </div>
    `)}

    ${card('', `<h2>Основные блоки</h2><p>Выберите крупный маршрут.</p>
      <div class="top-track-grid">
        <button class="track-card disabled"><b>Нет своего бизнеса</b><p>В разработке.</p></button>
        <button class="track-card active" onclick="renderLearning()"><b>Я предприниматель</b><p>Диагностика, уроки, ДЗ, проверка и управленческие действия.</p></button>
        <button class="track-card disabled"><b>Я сотрудник</b><p>В разработке.</p></button>
      </div>`)}
  `;
  shell(html, 'home');
}
function activityIntroText(act) {
  if (!act) return "Описание направления будет добавлено.";
  const direct = String(act.description || act.intro || act.moduleDescription || "").trim();
  if (direct) return direct;
  const fallback = {
    trade: "Торговля — это система превращения спроса в деньги. Клиент должен прийти, понять предложение, выбрать товар, совершить покупку, а бизнес должен сохранить маржу, не заморозить деньги в остатках и удержать кассу под контролем. В этом направлении вы последовательно разберёте поток клиентов, конверсию, ассортимент, средний чек, маржу, запасы, расходы, управленческий учёт и свободные деньги. Первый урок помогает увидеть, где сейчас находится главное ограничение вашего торгового бизнеса.",
    services: "Услуги — это система превращения заявки в оплаченный результат через доверие, запись, специалиста, время, качество и повтор. В этом направлении вы разберёте поток заявок, квалификацию клиента, запись, доходимость, загрузку специалистов, средний чек, себестоимость часа, расходы и свободные деньги. Первый урок помогает увидеть, где именно услуга теряет результат: до продажи, во время оказания или после неё.",
    production: "Производство — это система превращения спроса в готовый выпуск через заказ, спецификацию, материалы, мощность, качество, себестоимость, сроки и оплату. В этом направлении вы разберёте поток заказов, загрузку мощностей, материалы, незавершёнку, брак, прямые затраты, маржу, расходы и денежный цикл. Первый урок помогает увидеть, какой узел сейчас сильнее всего сдерживает производственный результат.",
    construction: "Строительство и проекты — это система превращения заявки в объект через квалификацию, замер, смету, договор, материалы, бригаду, этапы, качество, гарантию и деньги. В этом направлении вы разберёте поток заявок, сметы, конверсию в договор, маржу проекта, перерасход, сроки, дебиторку и свободную кассу. Первый урок помогает увидеть, где проектная модель теряет управляемость.",
    logistics: "Логистика — это система превращения заявки в прибыльный рейс через ставку, маршрут, загрузку, топливо, простой, документы, оплату и дебиторку. В этом направлении вы разберёте поток заявок, маржу рейса, загрузку транспорта, простои, расходы, документы, дебиторскую задолженность и свободные деньги. Первый урок помогает увидеть, какой участок рейса или расчёта забирает результат.",
    horeca: "HoReCa — это система превращения гостевого потока в деньги через посадку, меню, заказ, средний чек, кухню, сервис, себестоимость блюд, повтор и кассу. В этом направлении вы разберёте поток гостей, посадку, конверсию, меню, food cost, скорость кухни, сервис, расходы и свободные деньги. Первый урок помогает увидеть, где заведение теряет результат: в потоке, чеке, себестоимости, операционке или кассе."
  };
  return fallback[act.key] || String(act.chain || "Описание направления будет добавлено.").trim();
}

function renderLearning() {
  const html = `
    ${card('blue-card-v2', `<h1>Я предприниматель</h1><p>Сначала выбирается вид деятельности. После выбора откроется маршрут из 10 уроков внутри конкретного направления.</p>${isAdminMode() ? '<p class="small admin-note">Режим Босса: после выбора направления будут доступны все уроки.</p>' : ''}`)}
    <div class="activity-grid-v2">
      ${state.catalog.activities.map(a=>{
        const info = getActivityProgressInfo(a.key);
        const cardText = String(a.chain || activityIntroText(a)).trim();
        return `<button class="activity-card-v2 ${a.key===state.selectedActivityKey?'active':''}" onclick="renderActivityLessons('${a.key}')">
          <span>${a.icon}</span>
          <b>${esc(a.title)}</b>
          <small>${esc(cardText)}</small>
          <em>${info.openCount} из ${info.lessons.length} уроков доступно</em>
        </button>`;
      }).join('')}
    </div>
  `;
  shell(html, 'learning');
}

function renderActivityLessons(key) {
  if (key && getActivity(key)) {
    state.selectedActivityKey = key;
    localStorage.setItem("lego_selected_activity", key);
  }
  const act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
  const info = getActivityProgressInfo(act.key);
  const html = `
    ${card('blue-card-v2', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">Первый урок доступен сразу. Следующий урок открывается после приёмки ДЗ предыдущего урока.</p>`)}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Доступно: <b>${info.openCount} из ${info.lessons.length}</b>. Пройдено: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
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
function firstLessonDescription(activityKey, title) {
  const fallback = {
    trade: "Этот урок помогает разобрать торговлю не по ощущениям, а по фактам. Вы увидите, где именно теряется результат: во входящем потоке, конверсии в покупку, ассортименте, среднем чеке, марже, запасах, расходах, учёте или свободных деньгах. Задача урока — поставить первичный диагноз бизнеса и понять, какой участок требует особого внимания в дальнейшем маршруте.",
    services: "Этот урок помогает разобрать услуги не по общему ощущению загрузки, а по фактам. Вы увидите, где теряется результат: в потоке заявок, квалификации клиента, записи, доходимости, загрузке специалиста, среднем чеке, себестоимости часа, расходах или свободных деньгах. Задача урока — поставить первичный диагноз и понять, какой участок услуги требует особого внимания дальше.",
    production: "Этот урок помогает разобрать производство через факты: заказы, материалы, мощность, выпуск, брак, себестоимость, сроки и деньги. Вы увидите, где теряется результат: до запуска, в процессе выпуска, на складе, в качестве, в прямых затратах, расходах или денежном цикле. Задача урока — поставить первичный диагноз производственной системы.",
    construction: "Этот урок помогает разобрать строительную или проектную модель через факты: заявки, замеры, сметы, договоры, этапы, материалы, бригады, сроки, маржу и оплату. Вы увидите, где теряется результат: до договора, в смете, на объекте, в перерасходе, в сроках или в деньгах. Задача урока — поставить первичный диагноз проекта.",
    logistics: "Этот урок помогает разобрать логистику через факты: заявки, ставки, рейсы, маршруты, загрузку, топливо, простои, документы, оплату и дебиторку. Вы увидите, где теряется результат: в ставке, маршруте, загрузке транспорта, расходах, простоях, документах или денежном цикле. Задача урока — поставить первичный диагноз рейсовой модели.",
    horeca: "Этот урок помогает разобрать HoReCa через факты: поток гостей, посадку, меню, заказ, средний чек, кухню, сервис, food cost, расходы и кассу. Вы увидите, где теряется результат: в потоке, конверсии, меню, себестоимости, скорости, сервисе, расходах или свободных деньгах. Задача урока — поставить первичный диагноз заведения."
  };
  return fallback[activityKey] || `Этот урок помогает разобрать тему «${title || 'урок'}» через факты, показатели, ограничение и действие на ближайший цикл.`;
}

function cleanLessonDescription(lesson) {
  let text = String(lesson && lesson.description ? lesson.description : '').trim();
  const title = String(lesson && lesson.title ? lesson.title : '').trim();
  const activity = String(lesson && lesson.activityTitle ? lesson.activityTitle : '').trim();
  const num = String(lesson && lesson.number ? lesson.number : '').padStart(2,'0');
  const patterns = [
    `${activity}. Урок ${num}. ${title}.`,
    `${activity}. Урок ${Number((lesson && lesson.number) || 0)}. ${title}.`,
    `${activity}, урок ${num}. ${title}.`,
    `Урок ${num}. ${title}.`,
    title
  ];
  patterns.forEach(function(pattern){
    if (!pattern) return;
    text = text.replace(pattern, '').trim();
  });
  text = text
    .replace(/Версия\s+наполнения\s*:\s*v\d+[\w.-]*/ig, '')
    .replace(/\bv\d+(?:\.\d+)?\b/ig, '')
    .replace(/^\.+/, '')
    .trim();
  const looksTechnical = /Методологии\s*:|BMC|TOC|HADI|BSC|Unit Economics|поток клиентов\s*→|цепочк[аи]/i.test(text);
  if (!text || (Number(lesson && lesson.number) === 1 && looksTechnical && text.length < 260)) {
    return firstLessonDescription(lesson && lesson.activityKey, title);
  }
  return text;
}
async function renderLessonHub() {
  const lesson = await loadLesson(state.selectedLessonCode);
  const meta = getLessonMeta(state.selectedLessonCode);
  const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
  const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
  const html = `
    ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}`)}
    ${lessonOverviewCard(lesson)}
    <div class="stage-grid-v2">
      ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
      ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
      ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
      ${stageCard('homework','Домашнее задание','Практическая часть урока',isStageDone(meta.code,'homeworkSubmitted'),'renderHomework()',!isStageDone(meta.code,'books') && !isAdminMode())}
    </div>
    ${card('', `<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button>`)}
    ${adminService}
  `;
  shell(html, 'learning');
}
function stageCard(key,title,note,done,action,locked){ return `<button class="stage-card-v2 ${done?'done':''} ${locked?'locked':''}" onclick="${locked?'alert(\'Этап пока закрыт.\')':action}"><b>${title}</b><p>${note}</p><span>${done?'✓':(locked?'🔒':'→')}</span></button>`; }
async function startSlides(){ const p=getProgress(state.selectedLessonCode); state.slideIndex = Math.max(0, Number(p.last_slide_number || 1)-1); await remoteSave('lesson_started',{lastSlideNumber:state.slideIndex+1}); renderSlide(); }
async function renderSlide(){ const lesson=await loadLesson(state.selectedLessonCode); const slide=lesson.slides[state.slideIndex]; shell(`${topLessonNav('prevSlide()','nextSlide()',state.slideIndex===0,state.slideIndex===lesson.slides.length-1?'К тесту':'Далее')} ${mediaScreen(slide.image,'Слайд',state.slideIndex+1,lesson.slides.length,renderDisplayText(slide,'slide'))}`,'learning'); }
function topLessonNav(prev,next,prevDisabled,nextLabel){ return `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" ${prevDisabled?'disabled':''} onclick="${prev}">Назад</button><button class="btn primary" onclick="${next}">${nextLabel}</button></div>`; }
function mediaScreen(image,label,current,total,html){
  const legacy = legacyTradeImage(label, current);
  const src = legacy || image || "";
  const imageHtml = src
    ? `<img src="${src}?v=${APP_CACHE_VERSION}" data-label="${label}" data-index="${current}" onerror="handleImageError(this)">`
    : `<img src="" data-label="${label}" data-index="${current}" onerror="handleImageError(this)" style="display:none">`;
  return `<div class="media-counter">${label}: ${current}/${total}</div><div class="media-box-v2">${imageHtml}<div class="image-missing-v2" style="display:none"><b>${label} ${current}</b><p>Иллюстрация в подготовке.</p></div></div><section class="slide-text-v2">${cleanStudentHtml(html)}</section>`;
}
async function prevSlide(){ if(state.slideIndex>0){ state.slideIndex--; await remoteSave('slide_viewed',{lastSlideNumber:state.slideIndex+1}); renderSlide(); } }
async function nextSlide(){ const lesson=await loadLesson(state.selectedLessonCode); if(state.slideIndex<lesson.slides.length-1){ state.slideIndex++; await remoteSave('slide_viewed',{lastSlideNumber:state.slideIndex+1}); renderSlide(); } else { await remoteSave('presentation_completed',{lastSlideNumber:lesson.slides.length}); startQuiz(false); } }
async function startQuiz(reset){
  const lesson = await loadLesson(state.selectedLessonCode);
  const p = getProgress(state.selectedLessonCode);
  const total = Array.isArray(lesson.quiz) ? lesson.quiz.length : 0;
  const savedIndex = Number(p.current_question || 0);
  state.questionIndex = reset ? 0 : Math.max(0, Math.min(total ? total - 1 : 0, isNaN(savedIndex) ? 0 : savedIndex));
  state.answers = reset ? {} : (p.quiz_answers && typeof p.quiz_answers === 'object' ? p.quiz_answers : {});
  renderQuestion();
}
function quizOptionLabel(i){
  return String.fromCharCode(65 + Number(i || 0));
}

async function renderQuestion(){
  const lesson = await loadLesson(state.selectedLessonCode);
  if (!lesson.quiz || !lesson.quiz.length) {
    shell(card('result-bad-v2', '<h1>Тест не найден</h1><p>В файле урока нет вопросов теста.</p>'),'learning');
    return;
  }
  state.questionIndex = Math.max(0, Math.min(state.questionIndex, lesson.quiz.length - 1));
  const q = lesson.quiz[state.questionIndex];
  const selected = state.answers[state.questionIndex];
  const isLast = state.questionIndex === lesson.quiz.length - 1;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" ${state.questionIndex===0?'disabled':''} onclick="prevQuestion()">Назад</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`;
  shell(`${nav}<div class="quiz-card-v2"><p class="eyebrow">Вопрос ${state.questionIndex+1}/${lesson.quiz.length}</p><h2>${esc(q.q)}</h2><p class="small">Нажмите на вариант ответа — следующий вопрос откроется автоматически.</p>${q.a.map((a,i)=>`<button class="option-v2 ${Number(selected)===i?'selected':''}" onclick="selectAnswer(${i})">${quizOptionLabel(i)}. ${esc(a)}</button>`).join('')}${isLast?'<p class="small">После выбора ответа тест завершится и покажет разбор.</p>':''}</div>`,'learning');
}
async function selectAnswer(i){
  const lesson = await loadLesson(state.selectedLessonCode);
  state.answers[state.questionIndex] = i;
  await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers});
  if (state.questionIndex < lesson.quiz.length - 1) {
    state.questionIndex++;
    await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers});
    renderQuestion();
  } else {
    await finishQuiz();
  }
}
async function prevQuestion(){
  if(state.questionIndex>0){
    state.questionIndex--;
    await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers});
    renderQuestion();
  }
}
async function nextQuestion(){
  const lesson = await loadLesson(state.selectedLessonCode);
  if(state.answers[state.questionIndex]===undefined){ alert('Выберите вариант ответа.'); return; }
  if(state.questionIndex<lesson.quiz.length-1){
    state.questionIndex++;
    await remoteSave('quiz_progress',{currentQuestion:state.questionIndex,answers:state.answers});
    renderQuestion();
  } else {
    await finishQuiz();
  }
}
function quizReviewHtml(lesson){
  const rows = (lesson.quiz || []).map((q,i)=>{
    const rawUser = state.answers[i];
    const userIndex = rawUser === undefined ? undefined : Number(rawUser);
    const correctIndex = Number(q.correct || 0);
    const ok = userIndex === correctIndex;
    const userText = userIndex === undefined ? 'нет ответа' : `${quizOptionLabel(userIndex)}. ${q.a[userIndex] || ''}`;
    const correctText = `${quizOptionLabel(correctIndex)}. ${q.a[correctIndex] || ''}`;
    return `<div class="review-row ${ok?'ok':'bad'}"><h3>Вопрос ${i+1}. ${ok?'Верно':'Нужно повторить'}</h3><p><b>Ваш ответ:</b> ${esc(userText)}</p>${ok?'':`<p><b>Правильный ответ:</b> ${esc(correctText)}</p>`}<p><b>Почему:</b> ${esc(q.explanation || 'Правильный ответ опирается на причину, показатель и проверяемое действие, а не на быструю реакцию на симптом.')}</p></div>`;
  }).join('');
  return `<div class="quiz-review-v2"><h2>Разбор ответов</h2>${rows}</div>`;
}

async function finishQuiz(){
  const lesson = await loadLesson(state.selectedLessonCode);
  let score = 0;
  (lesson.quiz || []).forEach((q,i)=>{ if(Number(state.answers[i]) === Number(q.correct)) score++; });
  const total = lesson.quiz ? lesson.quiz.length : 0;
  const passScoreRaw = Number(lesson.passScore || 0);
  const passScore = passScoreRaw > 0 ? passScoreRaw : Math.ceil(total * 0.8);
  const passed = score >= passScore;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  await remoteSave('quiz_completed',{score,total,passed,answers:state.answers});
  const msg = passed
    ? 'Тест пройден. Можно переходить к блоку с полезными книгами и затем к домашнему заданию.'
    : 'Результат пока ниже проходного уровня. Лучше ещё раз вернуться к информационной части урока и спокойно разобрать логику: вход → переход → результат → маржа → ресурс → расходы → деньги. После повторения тест будет проще пройти за счёт понимания, а не угадывания.';
  shell(`${card(passed?'result-ok-v2':'result-bad-v2', `<h1>${passed?'Тест пройден':'Тест не пройден'}</h1><p>Результат: <b>${score}/${total}</b>. Проходной уровень: <b>${passScore}/${total}</b>.</p><p>${msg}</p><div class="grid-v2">${passed?actionButton('К саммари','startBooks()','primary'):actionButton('Вернуться к информационной части','startSlides()','primary')}${!passed?actionButton('Пройти тест заново','startQuiz(true)','secondary'):''}${actionButton('К уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}${card('',quizReviewHtml(lesson))}`,'learning');
}
async function startBooks(){ const p=getProgress(state.selectedLessonCode); state.bookIndex=Math.max(0,Number(p.last_book_slide_number||1)-1); await remoteSave('books_started',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); }
async function renderBook(){ const lesson=await loadLesson(state.selectedLessonCode); const scr=lesson.bookScreens[state.bookIndex]; shell(`${topLessonNav('prevBook()','nextBook()',state.bookIndex===0,state.bookIndex===lesson.bookScreens.length-1?'К ДЗ':'Далее')} ${mediaScreen(scr.image,'Саммари',state.bookIndex+1,lesson.bookScreens.length,renderDisplayText(scr,'book'))}`,'learning'); }
async function prevBook(){ if(state.bookIndex>0){ state.bookIndex--; await remoteSave('book_slide_viewed',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); } }
async function nextBook(){ const lesson=await loadLesson(state.selectedLessonCode); if(state.bookIndex<lesson.bookScreens.length-1){ state.bookIndex++; await remoteSave('book_slide_viewed',{lastBookSlideNumber:state.bookIndex+1}); renderBook(); } else { await remoteSave('books_completed',{lastBookSlideNumber:lesson.bookScreens.length}); renderHomework(); } }

function homeworkSheetUrl(code, hw) {
  return HOMEWORK_SHEET_URLS[code] || (hw && hw.sheetUrl) || '#';
}
async function renderHomework(){
  const lesson = await loadLesson(state.selectedLessonCode);
  const code = state.selectedLessonCode;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  if (!isAdminMode() && !isStageDone(code, 'books')) {
    shell(`${card('blue-card-v2', `<h1>Домашнее задание пока закрыто</h1><p>Домашнее задание открывается после информационной части, теста и саммари. Так сохраняется порядок обучения и проверки.</p>`)}${card('', `${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>` )}`,'homework');
    return;
  }
  await remoteSave('homework_started',{});
  const hw = lesson.homework || {};
  const tableButton = hw.buttonLabel || 'Получить шаблон таблицы ДЗ';
  const defaultInstruction = `<h3>Практическая часть урока</h3><p>Заполните прикреплённый шаблон по фактическим данным своего бизнеса. Главная цель — увидеть первичное ограничение, сформулировать действие на 7 дней и выбрать метрику проверки.</p>`;
  const instruction = cleanStudentHtml(hw.instructionHtml || defaultInstruction);
  shell(`${card('blue-card-v2', `<h1>${esc(hw.title || 'Домашнее задание')}</h1><p>Практическая часть урока. Здесь вы переносите материал в реальные цифры своего бизнеса.</p>`)}${card('', `${instruction}<div class="grid-v2">${externalButton(tableButton,homeworkSheetUrl(code, hw),'primary')}${externalButton('Открыть форму сдачи',hw.submitFormUrl||'#','secondary')}${actionButton('Я отправил ДЗ','markHomeworkSubmitted()','primary')}${actionButton('← Вернуться к уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}${isAdminMode()?card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`):''}`,'homework');
}
async function markHomeworkSubmitted(){ if(!confirm('Форма со ссылкой на ДЗ уже отправлена?')) return; await remoteSave('homework_submitted',{submittedAt:nowIso()}); renderHomeworkStatus(); }
function renderHomeworkStatus(){
  const code = state.selectedLessonCode;
  const meta = getLessonMeta(code);
  const activityKey = meta ? meta.activityKey : state.selectedActivityKey;
  shell(`${card('blue-card-v2', `<h1>Статус ДЗ</h1><p>${isStageDone(code,'homeworkVerified')?'ДЗ проверено. Модуль закрыт.':(isStageDone(code,'homeworkSubmitted')?'ДЗ отправлено на проверку.':'ДЗ пока не отправлено.')}</p>`)}${card('', `${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>`)}`,'homework');
}
function renderHomeworkCenter(){
  const visibleLessons = state.catalog.lessons.filter(l=>canOpenLesson(l) || isStageDone(l.code,'homeworkSubmitted')).slice(0,30);
  shell(`${card('blue-card-v2', `<h1>Домашние задания</h1><p>Здесь отображаются ДЗ по открытым урокам. Если этап ДЗ ещё не открыт, сначала нужно пройти презентацию, тест и саммари.</p>`)}${card('', `<div class="lesson-list-v2">${visibleLessons.map(l=>{
    const ready = isAdminMode() || isStageDone(l.code,'books');
    const status = isStageDone(l.code,'homeworkVerified') ? 'проверено' : (isStageDone(l.code,'homeworkSubmitted') ? 'на проверке' : (ready ? 'можно сдавать' : 'закрыто до саммари'));
    return `<button class="lesson-row-v2 ${ready?'':'locked'}" onclick="openLesson('${l.code}').then(()=>${ready?'renderHomework()':'renderLessonHub()'})"><div><b>${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${status}</p></div><span>${ready?'→':'🔒'}</span></button>`;
  }).join('')}</div>`)}`,'homework');
}

function loadGrowthMetrics(){ try { return JSON.parse(localStorage.getItem('lego_growth_metrics')||'[]'); } catch(e){ return []; } }
function saveGrowthMetrics(){ localStorage.setItem('lego_growth_metrics', JSON.stringify(state.growthMetrics||[])); }
function addMetric(){ const name=$('metric-name')?.value.trim(); const before=Number($('metric-before')?.value||0); const after=Number($('metric-after')?.value||0); if(!name){alert('Введите название показателя.'); return;} state.growthMetrics.push({name,before,after,createdAt:nowIso()}); saveGrowthMetrics(); renderDashboard(); }
function removeMetric(i){ state.growthMetrics.splice(i,1); saveGrowthMetrics(); renderDashboard(); }
function renderDashboard(){ const rows=state.growthMetrics||[]; shell(`${card('blue-card-v2', `<h1>Мои показатели роста</h1><p>Фиксация изменений бизнеса: было → стало → изменение. Это отдельный блок, не смешанный с учебным прогрессом.</p>`)}${card('', `<h2>Добавить показатель</h2><div class="metric-form"><input id="metric-name" placeholder="Показатель: выручка, конверсия, заявки"><input id="metric-before" type="number" placeholder="Было"><input id="metric-after" type="number" placeholder="Стало"><button class="btn primary" onclick="addMetric()">Сохранить</button></div>`)}${card('', `<h2>История</h2>${rows.length?rows.map((r,i)=>metricRow(r,i)).join(''):'<p>Пока нет показателей. Добавьте первый показатель вручную.</p>'}`)}`,'dashboard'); }
function metricRow(r,i){ const diff=Number(r.after)-Number(r.before); const pct=r.before?Math.round(diff/Number(r.before)*100):0; return `<div class="metric-row"><div><b>${esc(r.name)}</b><p>${r.before} → ${r.after} · ${diff>=0?'+':''}${diff} ${r.before?`(${pct>=0?'+':''}${pct}%)`:''}</p></div><button onclick="removeMetric(${i})">×</button></div>`; }
function renderProfile(){
  const total = totalProgressPercent();
  const totalScore = (state.catalog.lessons || []).reduce((acc,l)=>acc+lessonScore(l.code),0);
  const activeMeta = getLessonMeta(state.selectedLessonCode) || nextLessonMeta();
  const activeScore = activeMeta ? lessonScore(activeMeta.code) : 0;
  const adminBlock = isAdminUser()
    ? card('', `<h2>Режим работы</h2><p>Этот блок виден только администратору. У обычного участника переключателя режима и админ-панели нет.</p><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Админ</button></div><p class="small">Проверка администратора идёт по Telegram ID / username и роли, которую возвращает проверка доступа.</p>`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${isAdminUser()?'Босс Л.Е.Г.О':'участник'}</p>`)}${card('', `<h2>Баллы и общий прогресс</h2><p>Общие баллы и общий прогресс хранятся здесь, чтобы не дублировать их внутри каждого направления.</p>${progressRing(total,'общий','по всем урокам')}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${totalScore}</b></div><div><span>Текущий урок</span><b>${activeScore} / 100</b></div></div>`)}${adminBlock}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}${isAdminUser()?actionButton('Панель Босса Л.Е.Г.О','renderAdmin()','primary'):''}`)}`,'profile');
}
function renderAdmin(){ if(!isAdminUser()){alert('Нет прав администратора.'); return;} shell(`${card('blue-card-v2', `<h1>Панель Босса Л.Е.Г.О</h1><p>Полный доступ ко всем урокам, предпросмотр контента и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile'); }
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
    if (!isAdminUser()) { state.appMode = 'student'; localStorage.setItem('lego_app_mode','student'); }
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

/* =====================================================
   v11 overrides — dashboard, ready lessons, stage progress, services media fallback
   ===================================================== */

function formatPoints(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}
function consultationCostText() {
  return formatPoints(CONSULTATION_COST) + " баллов";
}
function brandLogoHtml(compact) {
  const logo = compact ? "assets/brand/lego-mark.png" : "assets/brand/lego-logo.png";
  return `<button class="brand-lockup ${compact ? 'compact' : ''}" onclick="renderHome()" aria-label="Л.Е.Г.О — на главную">
    <span class="brand-logo-plate">
      <img src="${logo}?v=${APP_CACHE_VERSION}" alt="Л.Е.Г.О" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="brand-fallback" style="display:none"><b>Л.Е.Г.О.</b><span>система внедрения управленческих изменений</span></span>
    </span>
  </button>`;
}
function shell(content, activeTab) {
  const root = $("app");
  if (!root) return;
  const modeButton = isAdminUser()
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Админ" : "Режим ученика"}</button>`
    : "";
  root.innerHTML = `
    <div class="app-shell-v2">
      <header class="app-header-v2">
        ${brandLogoHtml(false)}
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
    ${item('learning','Уроки','▣','renderLearning()')}
    ${item('homework','ДЗ','✓','renderHomeworkCenter()')}
    ${item('profile','Профиль','○','renderProfile()')}
  </nav>`;
}
function isLessonPrepared(meta) {
  if (!meta) return false;
  if (meta.status === "ready") {
    if (Number(meta.number) === 1) return READY_FIRST_LESSON_CODES.includes(meta.code);
    return true;
  }
  return false;
}
function lessonAvailableStages(meta) {
  if (!meta || !isLessonPrepared(meta)) return [];
  const stages = [];
  if (Number(meta.slidesCount || 0) > 0) stages.push("presentation");
  if (Number(meta.quizCount || 0) > 0) stages.push("quiz");
  if (Number(meta.bookScreensCount || 0) > 0) stages.push("books");
  stages.push("homework");
  return stages;
}
function lessonCompletedStageCount(code, meta) {
  const stages = lessonAvailableStages(meta || getLessonMeta(code));
  let done = 0;
  if (stages.includes("presentation") && isStageDone(code,"presentation")) done++;
  if (stages.includes("quiz") && isStageDone(code,"quiz")) done++;
  if (stages.includes("books") && isStageDone(code,"books")) done++;
  if (stages.includes("homework") && isStageDone(code,"homeworkVerified")) done++;
  return done;
}
function lessonStageProgressInfo(code) {
  const meta = getLessonMeta(code);
  const total = lessonAvailableStages(meta).length || 4;
  const done = lessonCompletedStageCount(code, meta);
  return { done, total, percent: total ? safePercent(done / total * 100) : 0 };
}
function readyCoreLessons() {
  return (state.catalog?.lessons || []).filter(isLessonPrepared);
}
function globalStageProgress() {
  const lessons = readyCoreLessons();
  let done = 0, total = 0;
  lessons.forEach(meta => {
    total += lessonAvailableStages(meta).length;
    done += lessonCompletedStageCount(meta.code, meta);
  });
  return { done, total, percent: total ? safePercent(done / total * 100) : 0 };
}
function totalProgressPercent() { return globalStageProgress().percent; }
function currentActivityProgress() {
  const lessons = activityLessons(state.selectedActivityKey).filter(isLessonPrepared);
  let done = 0, total = 0;
  lessons.forEach(meta => {
    total += lessonAvailableStages(meta).length;
    done += lessonCompletedStageCount(meta.code, meta);
  });
  return total ? safePercent(done / total * 100) : 0;
}
function canOpenLesson(meta) {
  if (!meta) return false;
  if (isAdminMode()) return true;
  if (!isLessonPrepared(meta)) return false;
  if (Number(meta.number) === 1) return true;
  const prev = activityLessons(meta.activityKey).find(l => Number(l.number) === Number(meta.number) - 1);
  return prev ? isStageDone(prev.code, "homeworkVerified") : false;
}
async function openLesson(code) {
  const meta = getLessonMeta(code);
  if (!meta) return;
  if (!canOpenLesson(meta)) {
    const msg = !isLessonPrepared(meta)
      ? "Урок временно закрыт. Материалы находятся на редакторской подготовке."
      : "Урок пока закрыт. Следующий модуль открывается после проверенного ДЗ предыдущего урока.";
    alert(msg);
    return;
  }
  state.selectedLessonCode = code;
  state.selectedActivityKey = meta.activityKey;
  localStorage.setItem("lego_selected_lesson", code);
  localStorage.setItem("lego_selected_activity", meta.activityKey);
  await loadLesson(code);
  renderLessonHub();
}
function getActivityProgressInfo(key) {
  const lessons = activityLessons(key);
  const openCount = lessons.filter(canOpenLesson).length;
  const doneCount = lessons.filter(l => isLessonPrepared(l) && lessonCompletedStageCount(l.code,l) >= lessonAvailableStages(l).length).length;
  const readyCount = lessons.filter(isLessonPrepared).length;
  return { lessons, openCount, doneCount, readyCount };
}
function nextLessonMeta() {
  const ready = readyCoreLessons();
  const open = ready.filter(canOpenLesson);
  const preferred = getLessonMeta(state.selectedLessonCode);
  if (preferred && canOpenLesson(preferred) && lessonCompletedStageCount(preferred.code, preferred) < lessonAvailableStages(preferred).length) return preferred;
  return open.find(l => lessonCompletedStageCount(l.code,l) < lessonAvailableStages(l).length) || open[0] || ready[0] || (state.catalog.lessons || [])[0];
}
function lessonProgressMini(code) {
  const info = lessonStageProgressInfo(code);
  return `<div class="lesson-progress-mini stage-progress-mini">
    <div class="lesson-progress-top"><span>Прогресс урока</span><b>${info.done} / ${info.total}</b></div>
    <div class="lesson-progress-bar"><div style="width:${info.percent}%"></div></div>
    <div class="lesson-progress-bottom"><span>Этапы пройдены</span><b>${info.percent}%</b></div>
  </div>`;
}
function renderMainBlockCard(title, text, status, action, cls) {
  const clickable = Boolean(action);
  return `<button class="track-card ${cls || ''} ${clickable ? '' : 'disabled'}" ${clickable ? `onclick="${action}"` : ''}>
    <b>${esc(title)}</b><p>${esc(text)}</p><em>${esc(status)}</em>
  </button>`;
}
function renderHome() {
  const gp = globalStageProgress();
  const html = `
    ${card('hero-dashboard main-dashboard-card', `
      <div class="hero-layout">
        <div>
          <p class="eyebrow">общая система</p>
          <h1>Ваш прогресс в Л.Е.Г.О.</h1>
          <p>Прогресс считается по пройденным этапам доступных уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${progressRing(gp.percent, 'общий', `${gp.done} из ${gp.total || 0} этапов`)}
      </div>
    `)}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid top-track-grid-five">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled')}
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: саммари, мини-тест, баллы и личная библиотека.','каркас готов','renderBookChallenge()','')}
        ${renderMainBlockCard('Дополнительные материалы','Дополнительные уроки и материалы вне основного маршрута.','каркас готов','renderAdditionalMaterials()','')}
      </div>`)}
  `;
  shell(html, 'home');
}
function entrepreneurCurrentStepCard() {
  const meta = nextLessonMeta();
  if (!meta) return '';
  const act = getActivity(meta.activityKey);
  const info = lessonStageProgressInfo(meta.code);
  return card('blue-card-v2', `<p class="eyebrow">ваш текущий шаг</p><h1>${esc(lessonStageLabel(meta.code))}</h1><p>${esc(act?.title || '')} · урок ${String(meta.number).padStart(2,'0')} · ${esc(meta.title)}</p><div class="step-summary-line"><span>Прогресс урока</span><b>${info.done}/${info.total} · ${info.percent}%</b></div><button class="btn primary" onclick="openLesson('${meta.code}')">Продолжить</button>`);
}
function renderLearning() {
  const html = `
    ${card('blue-card-v2', `<h1>Я предприниматель</h1><p>Сначала выбирается вид деятельности. После выбора откроется маршрут из 10 уроков внутри конкретного направления.</p>${isAdminMode() ? '<p class="small admin-note">Режим Босса: после выбора направления будут доступны все уроки.</p>' : ''}`)}
    ${entrepreneurCurrentStepCard()}
    <div class="activity-grid-v2 activity-grid-only">
      ${state.catalog.activities.map(a=>{
        const info = getActivityProgressInfo(a.key);
        const cardText = String(a.description || a.chain || activityIntroText(a)).trim();
        const readyText = info.readyCount ? `${info.openCount} из ${info.lessons.length} уроков доступно` : 'временно закрыто';
        return `<button class="activity-card-v2 ${a.key===state.selectedActivityKey?'active':''} ${info.readyCount ? '' : 'locked'}" onclick="renderActivityLessons('${a.key}')">
          <span>${a.icon}</span>
          <b>${esc(a.title)}</b>
          <small>${esc(cardText)}</small>
          <em>${readyText}</em>
        </button>`;
      }).join('')}
    </div>
  `;
  shell(html, 'learning');
}
function renderActivityLessons(key) {
  if (key && getActivity(key)) {
    state.selectedActivityKey = key;
    localStorage.setItem("lego_selected_activity", key);
  }
  const act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
  const info = getActivityProgressInfo(act.key);
  const activityPercent = currentActivityProgress();
  const readyNote = info.readyCount ? 'Первый готовый урок доступен сразу. Следующий урок открывается после приёмки ДЗ предыдущего урока.' : 'Материалы направления временно закрыты: уроки откроются после оформления изображений, тестов и проверки логики.';
  const html = `
    ${card('blue-card-v2', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${readyNote}</p><div class="step-summary-line"><span>Прогресс направления</span><b>${activityPercent}%</b></div>`)}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Доступно: <b>${info.openCount} из ${info.lessons.length}</b>. Готово к выдаче: <b>${info.readyCount}</b>. Пройдено: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}
function renderLessonRow(l) {
  const locked = !canOpenLesson(l);
  const prepared = isLessonPrepared(l);
  const info = lessonStageProgressInfo(l.code);
  const subtitle = !prepared
    ? 'в редакторской подготовке'
    : (locked ? 'закрыт' : `${lessonStageLabel(l.code)} · ${info.done}/${info.total} этапов`);
  return `<button class="lesson-row-v2 ${locked?'locked':''}" onclick="openLesson('${l.code}')">
    <div><b>${String(l.number).padStart(2,'0')}. ${esc(l.title)}</b><p>${subtitle}</p></div>
    <span>${locked?'🔒':(info.percent===100?'✓':'→')}</span>
  </button>`;
}
function lessonOverviewCard(lesson) {
  const img = lesson.overviewImage || `assets/lesson_overview/${lesson.code}.png`;
  return `<section class="lesson-overview-card"><img src="${img}?v=${APP_CACHE_VERSION}" alt="Карта урока" onerror="this.closest('.lesson-overview-card').style.display='none';"></section>`;
}
function renderLessonHub() {
  loadLesson(state.selectedLessonCode).then(lesson => {
    const meta = getLessonMeta(state.selectedLessonCode);
    const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
    const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
    const html = `
      ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}`)}
      ${lessonOverviewCard(lesson)}
      <div class="stage-grid-v2">
        ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
        ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
        ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
        ${stageCard('homework','Домашнее задание','Практическая часть урока',isStageDone(meta.code,'homeworkSubmitted'),'renderHomework()',!isStageDone(meta.code,'books') && !isAdminMode())}
      </div>
      ${card('', `<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button>`)}
      ${adminService}
    `;
    shell(html, 'learning');
  }).catch(e => emergencyScreen(e.message || 'LESSON_HUB_ERROR'));
}
function lessonImageFallback(label, current) {
  const n = String(current).padStart(2, "0");
  if (state.selectedLessonCode === "ENT-TR-01") return legacyTradeImage(label, current);
  if (state.selectedLessonCode === "ENT-SV-01") {
    if (label === "Слайд") return `assets/lesson/services/01/slides/slide_${n}.png`;
    if (label === "Саммари") {
      const idx = Number(current);
      if (idx >= 1 && idx <= 5) return `assets/lesson/services/01/books/book1_${String(idx).padStart(2,"0")}.png`;
      if (idx >= 6 && idx <= 10) return `assets/lesson/services/01/books/book2_${String(idx-5).padStart(2,"0")}.png`;
      if (idx >= 11 && idx <= 15) return `assets/lesson/services/01/books/book3_${String(idx-10).padStart(2,"0")}.png`;
      if (idx >= 16 && idx <= 20) return `assets/lesson/services/01/books/book4_${String(idx-15).padStart(2,"0")}.png`;
      if (idx >= 21 && idx <= 25) return `assets/lesson/services/01/books/book5_${String(idx-20).padStart(2,"0")}.png`;
      if (idx === 26) return `assets/lesson/services/01/books/final_summary.png`;
    }
  }
  return null;
}
function handleImageError(img) {
  if (!img) return;
  if (img.dataset && img.dataset.fallbackUsed !== "1") {
    const fallback = lessonImageFallback(img.dataset.label, Number(img.dataset.index));
    if (fallback && img.src.indexOf(fallback) === -1) {
      img.dataset.fallbackUsed = "1";
      img.src = fallback + "?v=" + APP_CACHE_VERSION;
      return;
    }
    const original = img.dataset.originalSrc || "";
    const singular = original.replace('assets/lessons/', 'assets/lesson/');
    if (singular && singular !== original && img.src.indexOf(singular) === -1) {
      img.dataset.fallbackUsed = "1";
      img.src = singular + "?v=" + APP_CACHE_VERSION;
      return;
    }
  }
  img.style.display = "none";
  const fallbackBox = img.nextElementSibling;
  if (fallbackBox) fallbackBox.style.display = "flex";
}
function mediaScreen(image,label,current,total,html){
  const fallback = lessonImageFallback(label, current);
  const src = image || fallback || "";
  const imageHtml = src
    ? `<img src="${src}?v=${APP_CACHE_VERSION}" data-original-src="${esc(src)}" data-label="${label}" data-index="${current}" onerror="handleImageError(this)">`
    : `<img src="" data-label="${label}" data-index="${current}" onerror="handleImageError(this)" style="display:none">`;
  return `<div class="media-counter">${label}: ${current}/${total}</div><div class="media-box-v2">${imageHtml}<div class="image-missing-v2" style="display:none"><b>${label} ${current}</b><p>Иллюстрация в подготовке.</p></div></div><section class="slide-text-v2">${cleanStudentHtml(html)}</section>`;
}
function renderBookChallenge(){
  const data = getChallengeState();
  const started = Boolean(data.startedAt);
  const progress = data.passedBooks || 0;
  const html = `${card('blue-card-v2', `<p class="eyebrow">новый блок</p><h1>100 книг за 100 дней</h1><p>Ежедневный челлендж: одно саммари, один мини-тест, 24 часа на прохождение и 100 баллов за зачтённую книгу.</p>${progressRing(progress,'книг',`${progress} из 100 зачтено`)}`)}
  ${card('', `<h2>${started?'Текущий день челленджа':'Запуск челленджа'}</h2><p>${started?'Каркас челленджа готов. Список 100 книг и мини-тесты будут подключаться отдельным контентным файлом.':'После запуска будет открываться одна книга в день. Если саммари прочитано и мини-тест пройден — книга остаётся в доступе и начисляется 100 баллов.'}</p><div class="list-clean"><div><b>Правило 24 часов</b><p>На книгу даётся сутки с момента открытия.</p></div><div><b>Зачёт</b><p>Саммари + мини-тест = 100 баллов и постоянный доступ к книге.</p></div><div><b>Пропуск</b><p>Если тест не пройден за сутки, книга закрывается и открывается следующая.</p></div></div>${started?actionButton('Вернуться на главную','renderHome()','secondary'):actionButton('Начать челлендж','startBookChallenge()','primary')}`)}`;
  shell(html,'home');
}
function getChallengeState(){ try{return JSON.parse(localStorage.getItem('lego_book_challenge_v1')||'{}')}catch(e){return {}} }
function saveChallengeState(data){ localStorage.setItem('lego_book_challenge_v1', JSON.stringify(data || {})); }
function startBookChallenge(){ saveChallengeState({startedAt:nowIso(), currentDay:1, passedBooks:0, missedBooks:0}); renderBookChallenge(); }
function renderAdditionalMaterials(){
  const html = `${card('blue-card-v2', `<p class="eyebrow">дополнительный блок</p><h1>Дополнительные материалы</h1><p>Здесь будут отдельные уроки, документы, кейсы и разборы, которые не ломают основной маршрут по видам деятельности.</p>`)}
  ${card('', `<h2>Разделы</h2><div class="list-clean"><div><b>Финансы и учёт</b><p>Дополнительные разборы показателей, денег и управленческой отчётности.</p></div><div><b>Команда и управление</b><p>Материалы для руководителей, управляющих и сотрудников.</p></div><div><b>Кейсы и документы</b><p>Практические примеры, шаблоны и дополнительные инструкции.</p></div></div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`;
  shell(html,'home');
}
function renderProfile(){
  const gp = globalStageProgress();
  const totalScore = (state.catalog.lessons || []).reduce((acc,l)=>acc+lessonScore(l.code),0);
  const activeMeta = getLessonMeta(state.selectedLessonCode) || nextLessonMeta();
  const lp = activeMeta ? lessonStageProgressInfo(activeMeta.code) : {done:0,total:0,percent:0};
  const adminBlock = isAdminUser()
    ? card('', `<h2>Режим работы</h2><p>Этот блок виден только администратору. У обычного участника переключателя режима и админ-панели нет.</p><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Админ</button></div><p class="small">Проверка администратора идёт по Telegram ID / username и роли, которую возвращает проверка доступа.</p>`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${isAdminUser()?'Босс Л.Е.Г.О':'участник'}</p>`)}${card('', `<h2>Прогресс и баллы</h2><p>Прогресс считается по этапам доступных уроков. Баллы используются отдельно как мотивационная система.</p>${progressRing(gp.percent,'общий',`${gp.done} из ${gp.total || 0} этапов`)}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${formatPoints(totalScore)}</b></div><div><span>Текущий урок</span><b>${lp.done} / ${lp.total}</b></div><div><span>Консультация</span><b>${consultationCostText()}</b></div><div><span>Готовые уроки</span><b>${readyCoreLessons().length}</b></div></div>`)}${adminBlock}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}${externalButton('Получить консультацию — '+consultationCostText(),CONSULTATION_FORM_URL,'primary')}${isAdminUser()?actionButton('Панель Босса Л.Е.Г.О','renderAdmin()','primary'):''}`)}`,'profile');
}


/* =====================================================
   v12 overrides — levels, titles, challenge card, insights, last place, clean admin UI
   ===================================================== */

const LEGO_LEVELS = [
  { level: 1, min: 0, max: 39, title: "Наблюдатель системы" },
  { level: 2, min: 40, max: 79, title: "Сборщик фактов" },
  { level: 3, min: 80, max: 119, title: "Ученик операционного цикла" },
  { level: 4, min: 120, max: 159, title: "Разборщик процессов" },
  { level: 5, min: 160, max: 199, title: "Практик диагностики" },
  { level: 6, min: 200, max: 239, title: "Исследователь причин" },
  { level: 7, min: 240, max: 279, title: "Настройщик фокуса" },
  { level: 8, min: 280, max: 319, title: "Аналитик ограничений" },
  { level: 9, min: 320, max: 359, title: "Проверяющий гипотез" },
  { level: 10, min: 360, max: 399, title: "Держатель метрик" },
  { level: 11, min: 400, max: 439, title: "Архитектор решений" },
  { level: 12, min: 440, max: 479, title: "Системный практик" },
  { level: 13, min: 480, max: 519, title: "Навигатор роста" },
  { level: 14, min: 520, max: 559, title: "Мастер управленческого вывода" },
  { level: 15, min: 560, max: 599, title: "Проектировщик изменений" },
  { level: 16, min: 600, max: 639, title: "Инженер операционной системы" },
  { level: 17, min: 640, max: 679, title: "Управленческий стратег" },
  { level: 18, min: 680, max: 719, title: "Архитектор бизнес-модели" },
  { level: 19, min: 720, max: 759, title: "Куратор внедрения" },
  { level: 20, min: 760, max: 799, title: "Мастер системного контроля" },
  { level: 21, min: 800, max: 839, title: "Строитель управляемого бизнеса" },
  { level: 22, min: 840, max: 879, title: "Директор операционного мышления" },
  { level: 23, min: 880, max: 919, title: "Эксперт управленческой архитектуры" },
  { level: 24, min: 920, max: 999, title: "Наставник системного роста" },
  { level: 25, min: 1000, max: Infinity, title: "Мастер Л.Е.Г.О" }
];

function adminLabel() { return "Босс Л.Е.Г.О"; }
function studentRoleLabel() { return isAdminUser() ? adminLabel() : "Ученик Л.Е.Г.О"; }
function consultationCostText() { return formatPoints(CONSULTATION_COST) + " баллов"; }
function isLessonFullyCompleted(meta) {
  if (!meta) return false;
  const total = lessonAvailableStages(meta).length;
  if (!total) return false;
  return lessonCompletedStageCount(meta.code, meta) >= total;
}
function completedCoreLessonsCount() {
  return readyCoreLessons().filter(isLessonFullyCompleted).length;
}
function challengeStateKey() { return "lego_book_challenge_v2"; }
function getChallengeState(){
  try {
    const v2 = JSON.parse(localStorage.getItem(challengeStateKey()) || "{}");
    if (v2 && Object.keys(v2).length) return v2;
    const old = JSON.parse(localStorage.getItem('lego_book_challenge_v1') || "{}");
    if (old && Object.keys(old).length) {
      return {
        startedAt: old.startedAt || nowIso(),
        active: Boolean(old.startedAt),
        currentDay: Number(old.currentDay || 1),
        streak: Number(old.passedBooks || 0),
        passedBooks: Number(old.passedBooks || 0),
        missedBooks: Number(old.missedBooks || 0),
        pointsEarned: estimateChallengePoints(Number(old.passedBooks || 0)),
        currentBookTitle: old.currentBookTitle || "книга дня",
        todayStage: old.todayStage || "саммари не открыто"
      };
    }
    return {};
  } catch(e) { return {}; }
}
function saveChallengeState(data){ localStorage.setItem(challengeStateKey(), JSON.stringify(data || {})); }
function estimateChallengePoints(count) {
  let total = 0;
  for (let i = 1; i <= Number(count || 0); i++) total += challengeRewardForDay(i);
  return total;
}
function challengeRewardForDay(dayNumber) {
  const d = Math.max(1, Math.min(100, Number(dayNumber || 1)));
  if (d >= 100) return 250;
  return 50 + (d - 1) * 2;
}
function currentChallengeDay(ch) {
  return Math.max(1, Math.min(100, Number(ch.currentDay || (Number(ch.streak || 0) + 1) || 1)));
}
function currentChallengeReward(ch) {
  return challengeRewardForDay(currentChallengeDay(ch));
}
function challengeUnits(ch) { return Number(ch.passedBooks || 0); }
function challengePoints(ch) {
  const explicit = Number(ch.pointsEarned || 0);
  if (explicit > 0) return explicit;
  return estimateChallengePoints(Number(ch.passedBooks || 0));
}
function completedLearningUnits() {
  const challenge = getChallengeState();
  const extraUnits = Number(localStorage.getItem('lego_extra_units_v1') || 0);
  return completedCoreLessonsCount() + challengeUnits(challenge) + extraUnits;
}
function totalPoints() {
  const lessonPoints = (state.catalog?.lessons || []).reduce((acc,l)=>acc+lessonScore(l.code),0);
  return lessonPoints + challengePoints(getChallengeState());
}
function studentTitleInfo() {
  const units = Math.max(0, Number(completedLearningUnits() || 0));
  let current = LEGO_LEVELS[0];
  for (const row of LEGO_LEVELS) {
    if (units >= row.min && units <= row.max) { current = row; break; }
    if (units >= row.min) current = row;
  }
  const next = LEGO_LEVELS.find(row => row.level === current.level + 1) || null;
  const start = current.min;
  const endExclusive = next ? next.min : 1000;
  const span = Math.max(1, endExclusive - start);
  const inside = current.level >= 25 ? span : Math.max(0, Math.min(span, units - start));
  const percent = current.level >= 25 ? 100 : safePercent(inside / span * 100);
  const left = current.level >= 25 ? 0 : Math.max(0, endExclusive - units);
  return { units, current, next, inside, span, percent, left, secretUnlocked: units >= 1000 };
}
function levelBarHtml(info) {
  const segments = 10;
  const active = Math.max(0, Math.min(segments, Math.round(info.percent / 10)));
  const cells = Array.from({length: segments}, (_,i)=>`<span class="${i < active ? 'active' : ''}"></span>`).join('');
  return `<div class="level-bar-wrap"><div class="level-bar-segments">${cells}</div><div class="level-bar-caption"><span>${info.current.level >= 25 ? 'Финальный уровень открыт' : `${info.inside} / ${info.span} внутри уровня`}</span><b>${info.current.level}/25</b></div></div>`;
}
function titleHelpHtml() {
  const rows = LEGO_LEVELS.map(row => `<div><b>${row.level}. ${esc(row.title)}</b><span>${row.level === 25 ? '1000+ единиц' : `${row.min}–${row.max} единиц`}</span></div>`).join('');
  return `<div id="title-help-panel" class="title-help-panel" style="display:none">
    <div class="title-help-head"><b>Как работает уровень</b><button onclick="toggleTitleHelp(false)">×</button></div>
    <p>Уровень показывает накопленный учебный опыт. Учебные единицы начисляются за полностью закрытые уроки, книги челленджа после мини-теста, дополнительные материалы и специальные задания.</p>
    <p>В челлендже одна книга после пройденного теста даёт +1 учебную единицу. Баллы начисляются отдельно и могут тратиться на возможности внутри системы.</p>
    <p>Финальный титул «Мастер Л.Е.Г.О» открывается после 1000 учебных единиц. На последнем уровне будет доступен суперсекретный бонус.</p>
    <div class="level-help-list">${rows}</div>
  </div>`;
}
function toggleTitleHelp(force) {
  const el = $('title-help-panel');
  if (!el) return;
  const next = force === undefined ? el.style.display === 'none' : Boolean(force);
  el.style.display = next ? 'block' : 'none';
  if (next) el.scrollIntoView({behavior:'smooth', block:'start'});
}
function titleCardHtml() {
  const info = studentTitleInfo();
  return card('title-card-v12', `<div class="title-card-head"><div><p class="eyebrow">уровень ученика</p><h2>${esc(info.current.title)}</h2></div><button class="help-dot" onclick="toggleTitleHelp()" aria-label="Как работают уровни">?</button></div>${titleHelpHtml()}<div class="title-stat-row"><div><span>Уровень</span><b>${info.current.level} / 25</b></div><div><span>Учебные единицы</span><b>${formatPoints(info.units)}</b></div></div>${levelBarHtml(info)}<p class="small title-note">${info.secretUnlocked ? 'Суперсекретный бонус открыт.' : `До следующего уровня: ${formatPoints(info.left)} учебных единиц.`}</p>`);
}
function activeChallengeCardHtml() {
  const ch = getChallengeState();
  if (!ch || !ch.active) return '';
  const day = currentChallengeDay(ch);
  const reward = currentChallengeReward(ch);
  const started = ch.dayStartedAt || ch.startedAt;
  const startedTime = started ? new Date(started).getTime() : Date.now();
  const expires = startedTime + 24 * 60 * 60 * 1000;
  const leftMs = Math.max(0, expires - Date.now());
  const hours = Math.floor(leftMs / 3600000);
  const minutes = Math.floor((leftMs % 3600000) / 60000);
  return card('challenge-active-card', `<p class="eyebrow">ежедневная задача</p><h2>100 книг за 100 дней</h2><div class="challenge-grid"><div><span>День</span><b>${day} / 100</b></div><div><span>Осталось</span><b>${hours} ч ${minutes} мин</b></div><div><span>Серия</span><b>${Number(ch.streak || 0)} подряд</b></div><div><span>Награда сегодня</span><b>${formatPoints(reward)} баллов</b></div></div><p><b>Книга:</b> ${esc(ch.currentBookTitle || 'книга дня')}</p><p><b>Этап:</b> ${esc(ch.todayStage || 'саммари не открыто')}</p><p class="small">Зачёт книги даёт +1 учебную единицу. Если день пропущен, серия и награда следующего дня возвращаются к 50 баллам.</p>`);
}
function brandLogoHtml(compact) {
  const logo = compact ? "assets/brand/lego-mark.png" : "assets/brand/lego-logo.png";
  return `<button class="brand-lockup ${compact ? 'compact' : ''}" onclick="renderHome()" aria-label="Л.Е.Г.О — на главную">
    <span class="brand-logo-plate">
      <img src="${logo}?v=${APP_CACHE_VERSION}" alt="Л.Е.Г.О" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="brand-fallback" style="display:none"><b>Л.Е.Г.О.</b><span>система внедрения управленческих изменений</span></span>
    </span>
  </button>`;
}
function shell(content, activeTab) {
  const root = $("app");
  if (!root) return;
  const modeButton = isAdminUser()
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Босс" : "Режим ученика"}</button>`
    : "";
  root.innerHTML = `
    <div class="app-shell-v2">
      <header class="app-header-v2">
        ${brandLogoHtml(false)}
        ${modeButton}
      </header>
      <main class="content-v2">${content}</main>
      ${bottomNav(activeTab || "home")}
    </div>`;
}
function renderMainBlockCard(title, text, status, action, cls) {
  const clickable = Boolean(action);
  return `<button class="track-card ${cls || ''} ${clickable ? '' : 'disabled'}" ${clickable ? `onclick="${action}"` : 'disabled'}>
    <b>${esc(title)}</b><p>${esc(text)}</p><em>${esc(status)}</em>
  </button>`;
}
function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const titleInfo = studentTitleInfo();
  const html = `
    ${card('hero-dashboard main-dashboard-card', `
      <div class="hero-layout">
        <div>
          <p class="eyebrow">общая система</p>
          <h1>Ваш прогресс в Л.Е.Г.О.</h1>
          <p>Прогресс считается по пройденным этапам готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
          <div class="dashboard-mini-grid"><div><span>Баллы</span><b>${formatPoints(points)}</b></div><div><span>Титул</span><b>${esc(titleInfo.current.title)}</b></div></div>
        </div>
        ${progressRing(gp.percent, 'общий', `${gp.done} из ${gp.total || 0} этапов`)}
      </div>
    `)}
    ${titleCardHtml()}
    ${activeChallengeCardHtml()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid top-track-grid-five">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled')}
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: 1 книга за 24 часа. После мини-теста книга даёт +1 единицу и баллы серии: 50 в первый день, дальше +2 за каждый зачёт подряд.','скоро','','disabled')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled')}
      </div>`)}
  `;
  shell(html, 'home');
}
async function continueLessonFromProgress(code) {
  const meta = getLessonMeta(code);
  if (!meta) return;
  if (!canOpenLesson(meta)) { alert("Урок пока закрыт."); return; }
  state.selectedLessonCode = code;
  state.selectedActivityKey = meta.activityKey;
  localStorage.setItem("lego_selected_lesson", code);
  localStorage.setItem("lego_selected_activity", meta.activityKey);
  await loadLesson(code);
  if (isStageDone(code,"homeworkSubmitted") && !isStageDone(code,"homeworkVerified")) return renderHomeworkStatus();
  if (isStageDone(code,"books")) return renderHomework();
  if (isStageDone(code,"quiz")) return startBooks();
  if (isStageDone(code,"presentation")) return startQuiz(false);
  return startSlides();
}
function entrepreneurCurrentStepCard() {
  const meta = nextLessonMeta();
  if (!meta) return '';
  const act = getActivity(meta.activityKey);
  const info = lessonStageProgressInfo(meta.code);
  const p = getProgress(meta.code);
  const place = p.last_book_slide_number ? `Саммари ${p.last_book_slide_number}` : (p.last_slide_number ? `Слайд ${p.last_slide_number}` : 'Начало урока');
  return card('blue-card-v2 current-step-card', `<p class="eyebrow">ваш текущий шаг</p><h1>${esc(lessonStageLabel(meta.code))}</h1><p>${esc(act?.title || '')} · урок ${String(meta.number).padStart(2,'0')} · ${esc(meta.title)}</p><div class="step-summary-line"><span>Прогресс урока</span><b>${info.done}/${info.total} · ${info.percent}%</b></div><div class="step-summary-line"><span>Последнее место</span><b>${esc(place)}</b></div><button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`);
}
function currentActivityProgress() {
  const lessons = activityLessons(state.selectedActivityKey);
  const plannedTotal = Math.max(lessons.length, 10) * 4;
  let done = 0;
  lessons.forEach(meta => { done += lessonCompletedStageCount(meta.code, meta); });
  return plannedTotal ? safePercent(done / plannedTotal * 100) : 0;
}
function getActivityProgressInfo(key) {
  const lessons = activityLessons(key);
  const openCount = lessons.filter(canOpenLesson).length;
  const readyCount = lessons.filter(isLessonPrepared).length;
  const doneCount = lessons.filter(isLessonFullyCompleted).length;
  const routeTotal = Math.max(lessons.length, 10) * 4;
  const stageDone = lessons.reduce((sum,l)=>sum + lessonCompletedStageCount(l.code,l),0);
  return { lessons, openCount, doneCount, readyCount, routeTotal, stageDone, routePercent: routeTotal ? safePercent(stageDone / routeTotal * 100) : 0 };
}
function renderActivityLessons(key) {
  if (key && getActivity(key)) {
    state.selectedActivityKey = key;
    localStorage.setItem("lego_selected_activity", key);
  }
  const act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
  const info = getActivityProgressInfo(act.key);
  const readyNote = info.readyCount ? 'Первый готовый урок доступен сразу. Следующий урок открывается после приёмки ДЗ предыдущего урока.' : 'Материалы направления временно закрыты: уроки откроются после оформления изображений, тестов и проверки логики.';
  const html = `
    ${card('blue-card-v2', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${readyNote}</p><div class="step-summary-line"><span>Прогресс направления</span><b>${info.stageDone}/${info.routeTotal} этапов · ${info.routePercent}%</b></div>`)}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Маршрут направления считается от 10 уроков: <b>40 этапов</b>. Доступно сейчас: <b>${info.openCount} из ${info.lessons.length}</b>. Готово к выдаче: <b>${info.readyCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}
function lessonSummaryForDoneBlock(meta) {
  const info = lessonStageProgressInfo(meta.code);
  return `${esc(meta.activityTitle || '')} · ${info.done}/${info.total} этапов`;
}
function insightsKey() {
  const ids = possibleIds();
  const suffix = ids[0] || normalizeUsername(state.user?.username || getTelegramUser().username) || 'local';
  return 'lego_lesson_insights_v1_' + suffix;
}
function loadInsights() { try { return JSON.parse(localStorage.getItem(insightsKey()) || '[]'); } catch(e){ return []; } }
function saveInsights(list) { localStorage.setItem(insightsKey(), JSON.stringify(Array.isArray(list) ? list : [])); }
function saveLessonInsight() {
  const input = $('lesson-insight-input');
  const text = String(input?.value || '').trim();
  if (!text) { alert('Запишите вывод одной-двумя фразами.'); return; }
  const meta = getLessonMeta(state.selectedLessonCode);
  const list = loadInsights();
  list.unshift({
    id: Date.now(),
    lessonCode: state.selectedLessonCode,
    lessonTitle: meta?.title || '',
    activityTitle: meta?.activityTitle || '',
    text,
    createdAt: nowIso()
  });
  saveInsights(list.slice(0, 100));
  if (input) input.value = '';
  renderLessonHub();
}
function deleteInsight(id) {
  saveInsights(loadInsights().filter(x => String(x.id) !== String(id)));
  renderProfile();
}
function lessonInsightCard() {
  const list = loadInsights().filter(x => x.lessonCode === state.selectedLessonCode).slice(0,3);
  return card('insight-card', `<h2>Мой вывод по уроку</h2><p>Зафиксируйте одну управленческую мысль, которую нужно перенести в действия или ДЗ.</p><textarea id="lesson-insight-input" rows="3" placeholder="Например: главное ограничение сейчас не в потоке, а в переходе заявки в оплату..."></textarea><button class="btn primary" onclick="saveLessonInsight()">Сохранить вывод</button>${list.length ? `<div class="insight-list-mini">${list.map(x=>`<div><b>${shortDate(x.createdAt)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>` : ''}`);
}
function renderLessonHub() {
  loadLesson(state.selectedLessonCode).then(lesson => {
    const meta = getLessonMeta(state.selectedLessonCode);
    const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
    const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
    const html = `
      ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}<button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`)}
      ${lessonOverviewCard(lesson)}
      <div class="stage-grid-v2">
        ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
        ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
        ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
        ${stageCard('homework','Домашнее задание','Практическая часть урока',isStageDone(meta.code,'homeworkSubmitted'),'renderHomework()',!isStageDone(meta.code,'books') && !isAdminMode())}
      </div>
      ${lessonInsightCard()}
      ${card('', `<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button>`)}
      ${adminService}
    `;
    shell(html, 'learning');
  }).catch(e => emergencyScreen(e.message || 'LESSON_HUB_ERROR'));
}
function preloadImage(src) {
  if (!src) return;
  try { const img = new Image(); img.src = src + (src.includes('?') ? '&' : '?') + 'v=' + APP_CACHE_VERSION; } catch(e) {}
}
function mediaSrcFor(label, index, lesson) {
  if (!lesson) return lessonImageFallback(label, index);
  if (label === 'Слайд') return lesson.slides?.[index-1]?.image || lessonImageFallback(label, index);
  if (label === 'Саммари') return lesson.bookScreens?.[index-1]?.image || lessonImageFallback(label, index);
  return lessonImageFallback(label, index);
}
function preloadAdjacentMedia(label, current, total, lesson) {
  [current + 1, current + 2, current - 1].forEach(i => {
    if (i >= 1 && i <= total) preloadImage(mediaSrcFor(label, i, lesson));
  });
}
async function renderSlide(){
  const lesson=await loadLesson(state.selectedLessonCode);
  const slide=lesson.slides[state.slideIndex];
  shell(`${topLessonNav('prevSlide()','nextSlide()',state.slideIndex===0,state.slideIndex===lesson.slides.length-1?'К тесту':'Далее')} ${mediaScreen(slide.image,'Слайд',state.slideIndex+1,lesson.slides.length,renderDisplayText(slide,'slide'))}`,'learning');
  preloadAdjacentMedia('Слайд', state.slideIndex + 1, lesson.slides.length, lesson);
}
async function renderBook(){
  const lesson=await loadLesson(state.selectedLessonCode);
  const scr=lesson.bookScreens[state.bookIndex];
  shell(`${topLessonNav('prevBook()','nextBook()',state.bookIndex===0,state.bookIndex===lesson.bookScreens.length-1?'К ДЗ':'Далее')} ${mediaScreen(scr.image,'Саммари',state.bookIndex+1,lesson.bookScreens.length,renderDisplayText(scr,'book'))}`,'learning');
  preloadAdjacentMedia('Саммари', state.bookIndex + 1, lesson.bookScreens.length, lesson);
}
function renderBookChallenge(){
  shell(`${card('blue-card-v2 soon-page-card', `<p class="eyebrow">скоро</p><h1>100 книг за 100 дней</h1><p>Раздел скоро откроется. Внутри будет ежедневный челлендж: одна книга за 24 часа, мини-тест, +1 учебная единица и баллы серии.</p>`)}${card('', `<h2>Как будет работать начисление</h2><div class="list-clean"><div><b>Книга зачтена</b><p>Саммари изучено, мини-тест пройден: книга остаётся в доступе, начисляется +1 учебная единица.</p></div><div><b>Баллы серии</b><p>Первый день — 50 баллов. Каждый зачёт подряд увеличивает награду следующего дня на 2 балла. При пропуске серия возвращается к 50.</p></div><div><b>100-й день</b><p>При непрерывном прохождении награда доходит до 250 баллов.</p></div></div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
}
function renderAdditionalMaterials(){
  shell(`${card('blue-card-v2 soon-page-card', `<p class="eyebrow">скоро</p><h1>Дополнительные материалы</h1><p>Раздел скоро откроется. Здесь будут отдельные уроки, разборы, шаблоны и материалы, которые дополняют основной маршрут.</p>`)}${card('', `<button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
}
function doneSummaryHtml() {
  const lessons = readyCoreLessons();
  const presentation = lessons.filter(l => isStageDone(l.code,'presentation')).length;
  const quiz = lessons.filter(l => isStageDone(l.code,'quiz')).length;
  const books = lessons.filter(l => isStageDone(l.code,'books')).length;
  const hw = lessons.filter(l => isStageDone(l.code,'homeworkVerified')).length;
  const insights = loadInsights().length;
  const ch = getChallengeState();
  return card('done-summary-card', `<h2>Что уже сделано</h2><div class="done-grid"><div><span>Презентации</span><b>${presentation}</b></div><div><span>Тесты</span><b>${quiz}</b></div><div><span>Саммари</span><b>${books}</b></div><div><span>Принятые ДЗ</span><b>${hw}</b></div><div><span>Книги челленджа</span><b>${Number(ch.passedBooks || 0)}</b></div><div><span>Мои выводы</span><b>${insights}</b></div></div>`);
}
function insightsProfileHtml() {
  const list = loadInsights().slice(0, 8);
  return card('insight-card', `<h2>Мои выводы</h2><p>Короткие управленческие выводы, которые вы сохранили внутри уроков.</p>${list.length ? `<div class="insight-list">${list.map(x=>`<div><div><b>${esc(x.activityTitle || '')} · ${esc(x.lessonTitle || x.lessonCode)}</b><span>${shortDate(x.createdAt)}</span><p>${esc(x.text)}</p></div><button onclick="deleteInsight('${x.id}')">×</button></div>`).join('')}</div>` : '<p class="small">Пока выводов нет. Откройте урок и сохраните первый вывод после презентации или саммари.</p>'}`);
}
function consultationCardsHtml(points) {
  const missing = Math.max(0, CONSULTATION_COST - Number(points || 0));
  const canRequest = missing <= 0;
  return card('consultation-card', `<h2>Консультации</h2><div class="consult-grid"><div><b>Консультация за баллы</b><p>Стоимость: ${consultationCostText()}.</p><p>${canRequest ? 'Баллов достаточно. Можно отправить заявку на консультацию за баллы.' : `Недостаточно баллов. Нужно ещё: ${formatPoints(missing)}.`}</p>${canRequest ? externalButton('Запросить консультацию за баллы', CONSULTATION_FORM_URL, 'primary') : '<button class="btn secondary" disabled>Недостаточно баллов</button>'}</div><div><b>Индивидуальная консультация</b><p>Можно оставить заявку на разбор бизнеса, управленческого вопроса или конкретной ситуации. Условия консультации согласовываются отдельно.</p>${externalButton('Подать заявку на индивидуальную консультацию', CONSULTATION_FORM_URL, 'secondary')}</div></div><h3>Что можно будет получать за баллы</h3><div class="bonus-list"><span>Приоритетный разбор ДЗ</span><span>Дополнительный шаблон</span><span>Закрытый разбор кейса</span><span>Проверка гипотезы</span></div>`);
}
function renderProfile(){
  const gp = globalStageProgress();
  const points = totalPoints();
  const activeMeta = getLessonMeta(state.selectedLessonCode) || nextLessonMeta();
  const lp = activeMeta ? lessonStageProgressInfo(activeMeta.code) : {done:0,total:0,percent:0};
  const titleInfo = studentTitleInfo();
  const adminBlock = isAdminUser()
    ? card('boss-panel-card', `<h2>Панель Босса Л.Е.Г.О</h2><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Режим Босса</button></div><p class="small">Панель управления, проверка ДЗ и полный предпросмотр уроков доступны только владельцу системы.</p>${actionButton('Открыть панель Босса','renderAdmin()','primary')}`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${studentRoleLabel()}</p>`)}${titleCardHtml()}${card('', `<h2>Прогресс и баллы</h2>${progressRing(gp.percent,'общий',`${gp.done} из ${gp.total || 0} этапов`)}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${formatPoints(points)}</b></div><div><span>Текущий урок</span><b>${lp.done} / ${lp.total}</b></div><div><span>Учебные единицы</span><b>${formatPoints(titleInfo.units)}</b></div><div><span>Готовые уроки</span><b>${readyCoreLessons().length}</b></div></div>`)}${doneSummaryHtml()}${insightsProfileHtml()}${adminBlock}${consultationCardsHtml(points)}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}`)}`,'profile');
}
function renderAdmin(){
  if(!isAdminUser()){ alert('Нет прав Босса Л.Е.Г.О.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель Босса Л.Е.Г.О</h1><p>Полный доступ ко всем урокам, предпросмотр контента и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile');
}
