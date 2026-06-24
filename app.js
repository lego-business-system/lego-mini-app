
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
const APP_CACHE_VERSION = "v34-business-forum-rules-replies-moderation-20260622";
const MODULE_SCORE_RULES = { presentation: 10, quiz: 10, books: 10, homeworkVerified: 70, total: 100 };
const CONSULTATION_COST = 25000;
const READY_FIRST_LESSON_CODES = ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"];

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
// v18 boot moved to end of file

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


/* =====================================================
   v15 overrides — achievement, compact dashboard, lesson notes sharing, dates, My Business
   ===================================================== */

const SAVE_INSIGHT_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/save-insight";

function progressBarHtml(percent, cls) {
  const p = safePercent(percent);
  return `<div class="progress-line ${cls || ''}"><div style="width:${p}%"></div></div>`;
}

function stageCompletedDate(code, stage) {
  const p = getProgress(code);
  if (stage === 'presentation') return p.presentation_completed_at || p.presentation_started_at || null;
  if (stage === 'quiz') return p.quiz_completed_at || p.quiz_started_at || null;
  if (stage === 'books') return p.books_completed_at || p.books_started_at || null;
  if (stage === 'homeworkSubmitted') return p.homework_submitted_at || p.homework_started_at || null;
  if (stage === 'homeworkVerified') return p.homework_verified_at || p.homework_checked_at || p.completed_at || null;
  return null;
}
function stageStatusText(code, stage) {
  if (stage === 'homeworkVerified') return isStageDone(code,'homeworkVerified') ? 'принято' : (isStageDone(code,'homeworkSubmitted') ? 'на проверке' : 'ожидает ДЗ');
  if (stage === 'homeworkSubmitted') return isStageDone(code,'homeworkSubmitted') ? 'отправлено' : 'не отправлено';
  return isStageDone(code, stage) ? 'пройдено' : 'не пройдено';
}
function lessonTimelineHtml(code) {
  const rows = [
    ['presentation','Презентация'],
    ['quiz','Тест'],
    ['books','Саммари'],
    ['homeworkSubmitted','ДЗ отправлено'],
    ['homeworkVerified','ДЗ принято']
  ];
  return card('lesson-timeline-card', `<h2>История прохождения</h2><div class="timeline-grid">${rows.map(([stage,label])=>{
    const status = stageStatusText(code, stage);
    const date = stageCompletedDate(code, stage);
    const done = status === 'пройдено' || status === 'отправлено' || status === 'принято';
    const review = status === 'на проверке';
    return `<div class="timeline-row ${done?'done':''} ${review?'review':''}"><span>${esc(label)}</span><b>${esc(status)}</b><em>${date ? shortDate(date) : '—'}</em></div>`;
  }).join('')}</div>`);
}
function homeworkReviewNoticeHtml(code) {
  if (isStageDone(code,'homeworkSubmitted') && !isStageDone(code,'homeworkVerified')) {
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки Босс Л.Е.Г.О примет ДЗ или вернёт его на доработку.</p></div>`;
  }
  if (isStageDone(code,'homeworkVerified')) {
    return `<div class="homework-review-notice accepted"><b>Домашнее задание принято</b><p>Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.</p></div>`;
  }
  return '';
}

function lessonProgressMini(code) {
  const info = lessonStageProgressInfo(code);
  return `<div class="lesson-progress-mini stage-progress-mini">
    <div class="lesson-progress-top"><span>Прогресс урока</span><b>${info.percent}%</b></div>
    <div class="lesson-progress-bar"><div style="width:${info.percent}%"></div></div>
  </div>`;
}

function titleHelpHtml() {
  const rows = LEGO_LEVELS.map(row => `<div><b>${row.level}. ${esc(row.title)}</b><span>${row.level === 25 ? '1000+ учебных единиц' : `${row.min}–${row.max} учебных единиц`}</span></div>`).join('');
  return `<div id="title-help-panel" class="title-help-panel" style="display:none">
    <div class="title-help-head"><b>Как работает уровень</b><button onclick="toggleTitleHelp(false)" aria-label="Закрыть">×</button></div>
    <p>Уровень показывает накопленный учебный опыт. Учебные единицы начисляются за полностью закрытые уроки, книги челленджа после мини-теста, дополнительные материалы и специальные задания.</p>
    <p>В челлендже одна книга после пройденного теста даёт +1 учебную единицу. Баллы начисляются отдельно и могут тратиться на возможности внутри системы.</p>
    <p>Достижение «Мастер Л.Е.Г.О» открывается после 1000 учебных единиц. На последнем уровне будет доступен суперсекретный бонус.</p>
    <div class="level-help-list">${rows}</div>
  </div>`;
}
function titleCardHtml() {
  const info = studentTitleInfo();
  return card('title-card-v12', `<div class="title-card-head"><div><p class="eyebrow">уровень ученика</p><h2>${esc(info.current.title)}</h2></div><button class="help-dot" onclick="toggleTitleHelp()" aria-label="Как работают уровни">?</button></div>${titleHelpHtml()}<div class="title-stat-row"><div><span>Уровень</span><b>${info.current.level} / 25</b></div><div><span>Учебные единицы</span><b>${formatPoints(info.units)}</b></div></div>${levelBarHtml(info)}<p class="small title-note">${info.secretUnlocked ? 'Суперсекретный бонус открыт.' : `До следующего уровня: ${formatPoints(info.left)} учебных единиц.`}</p>`);
}
function achievementInlineHtml() {
  const info = studentTitleInfo();
  return `<div class="achievement-inline"><div class="achievement-head"><div><span>Достижение</span><b>${esc(info.current.title)}</b></div><button class="help-dot" onclick="toggleTitleHelp()" aria-label="Как работают уровни">?</button></div>${titleHelpHtml()}${levelBarHtml(info)}</div>`;
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
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card', `
      <div class="merged-dashboard-top">
        <div>
          <p class="eyebrow">общая система</p>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по пройденным этапам готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${progressRing(gp.percent, 'общий', `${gp.done} из ${gp.total || 0}`)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
    `)}
    ${activeChallengeCardHtml()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid top-track-grid-six">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled')}
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','скоро','','disabled')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled')}
        ${renderMainBlockCard('VIP уровень','Расширенный уровень участия, закрытые форматы, персональные разборы и дополнительные возможности.','в разработке','','disabled')}
      </div>`)}
  `;
  shell(html, 'home');
}

function entrepreneurCurrentStepCard() {
  const meta = nextLessonMeta();
  if (!meta) return '';
  const act = getActivity(meta.activityKey);
  const info = lessonStageProgressInfo(meta.code);
  const p = getProgress(meta.code);
  const place = p.last_book_slide_number ? `Саммари ${p.last_book_slide_number}` : (p.last_slide_number ? `Слайд ${p.last_slide_number}` : 'Начало урока');
  return card('blue-card-v2 current-step-card', `<p class="eyebrow">ваш текущий шаг</p><h1>${esc(lessonStageLabel(meta.code))}</h1><p>${esc(act?.title || '')} · урок ${String(meta.number).padStart(2,'0')} · ${esc(meta.title)}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс урока</span><b>${info.percent}%</b></div>${progressBarHtml(info.percent,'on-dark')}</div><div class="step-summary-line"><span>Последнее место</span><b>${esc(place)}</b></div><button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`);
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
    ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${readyNote}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс направления</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Доступно сейчас: <b>${info.openCount} из ${info.lessons.length}</b>. Готово к выдаче: <b>${info.readyCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}

function saveSharedInsightDraft(entry) {
  const key = insightsKey() + '_shared';
  let list = [];
  try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { list = []; }
  list.unshift(entry);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
}
async function sendInsightToBoss(entry) {
  if (!entry.shared) return { ok: true, skipped: true };
  if (!tg || !tg.initData) return { ok: false, localOnly: true, reason: 'TELEGRAM_ONLY' };
  try {
    const res = await fetch(SAVE_INSIGHT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, lessonCode: entry.lessonCode, text: entry.text, shared: true, createdAt: entry.createdAt })
    });
    const out = await res.json().catch(()=>({}));
    return out && out.ok ? out : { ok: false, reason: out.reason || out.error || 'SAVE_INSIGHT_FAILED' };
  } catch(e) {
    return { ok: false, reason: 'SAVE_INSIGHT_UNAVAILABLE' };
  }
}
async function saveLessonInsight() {
  const input = $('lesson-insight-input');
  const checkbox = $('lesson-insight-share');
  const text = String(input?.value || '').trim();
  if (!text) { alert('Запишите вывод или заметку одной-двумя фразами.'); return; }
  const meta = getLessonMeta(state.selectedLessonCode);
  const entry = {
    id: Date.now(),
    lessonCode: state.selectedLessonCode,
    lessonTitle: meta?.title || '',
    activityTitle: meta?.activityTitle || '',
    text,
    shared: Boolean(checkbox && checkbox.checked),
    createdAt: nowIso()
  };
  const list = loadInsights();
  list.unshift(entry);
  saveInsights(list.slice(0, 100));
  if (entry.shared) {
    saveSharedInsightDraft(entry);
    const result = await sendInsightToBoss(entry);
    if (!result.ok) {
      console.warn('INSIGHT_SHARE_LOCAL_ONLY', result);
      alert('Вывод сохранён и отмечен для передачи Боссу Л.Е.Г.О. Для автоматической передачи нужно подключить функцию save-insight в Supabase.');
    }
  }
  if (input) input.value = '';
  renderLessonHub();
}
function lessonInsightCard() {
  const list = loadInsights().filter(x => x.lessonCode === state.selectedLessonCode).slice(0,3);
  return card('insight-card', `<h2>Мой вывод по уроку</h2><p>Сохраняйте здесь главный вывод или короткие заметки по уроку. Это поможет вернуться к мысли перед ДЗ и следующим действием.</p><textarea id="lesson-insight-input" rows="3" placeholder="Например: главное ограничение сейчас не в потоке, а в переходе заявки в оплату..."></textarea><label class="share-insight-check"><input type="checkbox" id="lesson-insight-share"><span>Поделиться этим выводом с Боссом Л.Е.Г.О</span></label><button class="btn primary" onclick="saveLessonInsight()">Сохранить вывод</button>${list.length ? `<div class="insight-list-mini">${list.map(x=>`<div><b>${shortDate(x.createdAt)}${x.shared ? ' · отправить Боссу' : ''}</b><p>${esc(x.text)}</p></div>`).join('')}</div>` : ''}`);
}

function renderLessonHub() {
  loadLesson(state.selectedLessonCode).then(lesson => {
    const meta = getLessonMeta(state.selectedLessonCode);
    const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
    const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
    const html = `
      ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}${homeworkReviewNoticeHtml(meta.code)}<button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`)}
      ${lessonOverviewCard(lesson)}
      <div class="stage-grid-v2">
        ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
        ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
        ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
        ${stageCard('homework','Домашнее задание','Практическая часть урока',isStageDone(meta.code,'homeworkSubmitted'),'renderHomework()',!isStageDone(meta.code,'books') && !isAdminMode())}
      </div>
      ${lessonTimelineHtml(meta.code)}
      ${lessonInsightCard()}
      ${card('', `<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button>`)}
      ${adminService}
    `;
    shell(html, 'learning');
  }).catch(e => emergencyScreen(e.message || 'LESSON_HUB_ERROR'));
}

function renderHomeworkStatus(){
  const code = state.selectedLessonCode;
  const meta = getLessonMeta(code);
  const activityKey = meta ? meta.activityKey : state.selectedActivityKey;
  const statusText = isStageDone(code,'homeworkVerified') ? 'Домашнее задание принято' : (isStageDone(code,'homeworkSubmitted') ? 'Домашнее задание на проверке' : 'Домашнее задание пока не отправлено');
  const detail = isStageDone(code,'homeworkVerified')
    ? `Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.`
    : (isStageDone(code,'homeworkSubmitted') ? `Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки откроется следующий шаг или появится доработка.` : 'Откройте домашнее задание, заполните шаблон и отправьте форму на проверку.');
  shell(`${card('blue-card-v2', `<h1>${esc(statusText)}</h1><p>${esc(detail)}</p>`)}${lessonTimelineHtml(code)}${card('', `${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>`)}`,'homework');
}

function consultationCardsHtml(points) {
  const missing = Math.max(0, CONSULTATION_COST - Number(points || 0));
  const canRequest = missing <= 0;
  return card('consultation-card', `<h2>Консультации</h2><div class="consult-grid"><div><b>Консультация за баллы</b><p>Стоимость: ${consultationCostText()}.</p><p>${canRequest ? 'Баллов достаточно. Можно отправить заявку на консультацию за баллы.' : `Недостаточно баллов. Нужно ещё: ${formatPoints(missing)}.`}</p>${canRequest ? externalButton('Запросить консультацию за баллы', CONSULTATION_FORM_URL, 'primary') : '<button class="btn secondary" disabled>Недостаточно баллов</button>'}</div><div><b>Индивидуальная консультация</b><p>Можно оставить заявку на разбор бизнеса, управленческого вопроса или конкретной ситуации. Условия консультации согласовываются отдельно.</p>${externalButton('Подать заявку на индивидуальную консультацию', CONSULTATION_FORM_URL, 'secondary')}</div></div><h3>Что можно будет получать за баллы</h3><p class="small">В разработке.</p>`);
}
function insightsProfileHtml() {
  const list = loadInsights().slice(0, 8);
  return card('insight-card', `<h2>Мои выводы</h2><p>Короткие управленческие выводы и заметки, которые вы сохранили внутри уроков.</p>${list.length ? `<div class="insight-list">${list.map(x=>`<div><div><b>${esc(x.activityTitle || '')} · ${esc(x.lessonTitle || x.lessonCode)}</b><span>${shortDate(x.createdAt)}${x.shared ? ' · отмечено для Босса Л.Е.Г.О' : ''}</span><p>${esc(x.text)}</p></div><button onclick="deleteInsight('${x.id}')">×</button></div>`).join('')}</div>` : '<p class="small">Пока выводов нет. Откройте урок и сохраните первый вывод после презентации или саммари.</p>'}`);
}

function businessEntriesKey(){
  const ids = possibleIds();
  const suffix = ids[0] || normalizeUsername(state.user?.username || getTelegramUser().username) || 'local';
  return 'lego_my_business_entries_v1_' + suffix;
}
function loadBusinessEntries(){ try { return JSON.parse(localStorage.getItem(businessEntriesKey()) || '[]'); } catch(e){ return []; } }
function saveBusinessEntries(list){ localStorage.setItem(businessEntriesKey(), JSON.stringify(Array.isArray(list) ? list.slice(0, 400) : [])); }
function addBusinessEntry(){
  const date = $('biz-date')?.value || new Date().toISOString().slice(0,10);
  const revenue = Number($('biz-revenue')?.value || 0);
  const expenses = Number($('biz-expenses')?.value || 0);
  const cash = Number($('biz-cash')?.value || 0);
  const leads = Number($('biz-leads')?.value || 0);
  const sales = Number($('biz-sales')?.value || 0);
  const note = String($('biz-note')?.value || '').trim();
  const list = loadBusinessEntries();
  list.unshift({ id: Date.now(), date, revenue, expenses, cash, leads, sales, note, createdAt: nowIso() });
  saveBusinessEntries(list);
  renderMyBusiness();
}
function deleteBusinessEntry(id){ saveBusinessEntries(loadBusinessEntries().filter(x => String(x.id) !== String(id))); renderMyBusiness(); }
function businessSummary(days){
  const cutoff = Date.now() - days * 86400000;
  const rows = loadBusinessEntries().filter(x => new Date(x.date).getTime() >= cutoff);
  const sum = (k) => rows.reduce((a,x)=>a+Number(x[k]||0),0);
  const revenue = sum('revenue');
  const expenses = sum('expenses');
  const leads = sum('leads');
  const sales = sum('sales');
  const profit = revenue - expenses;
  const conversion = leads ? safePercent(sales / leads * 100) : 0;
  const avgCheck = sales ? Math.round(revenue / sales) : 0;
  const cash = rows.length ? Number(rows[0].cash || 0) : 0;
  return { rows, revenue, expenses, profit, leads, sales, conversion, avgCheck, cash };
}
function businessDiagnosticText(s){
  if (!s.rows.length) return 'Добавьте первые ежедневные факты. После 3–7 дней появится первичный управленческий вывод.';
  if (s.revenue <= 0) return 'Пока нет выручки за выбранный период. Первый фокус — входящие обращения, предложение и переход к оплате.';
  if (s.expenses / Math.max(1,s.revenue) > 0.85) return 'Расходы забирают большую часть выручки. Проверьте прямые затраты, постоянные расходы и маржу результата.';
  if (s.leads > 0 && s.conversion < 15) return 'Входящие есть, но переход в покупку слабый. Фокус — конверсия, доверие, скорость ответа и понятность предложения.';
  if (s.cash < 0) return 'Денежный остаток отрицательный. Фокус — обязательства, ближайшие платежи и свободные деньги.';
  return 'Картина управляемая: продолжайте вести ежедневные факты и сравнивайте выручку, расходы, конверсию и свободные деньги.';
}
function renderMyBusiness(){
  if(!isAdminMode()){
    alert('Финансовый помощник скоро откроется.');
    renderProfile();
    return;
  }
  const s7 = businessSummary(7);
  const s30 = businessSummary(30);
  const rows = loadBusinessEntries().slice(0,14);
  shell(`${card('blue-card-v2 my-business-hero', `<p class="eyebrow">мой бизнес</p><h1>Финансовый помощник</h1>`)}${card('', `<h2>Добавить день</h2><div class="business-form"><input id="biz-date" type="date" value="${new Date().toISOString().slice(0,10)}"><input id="biz-revenue" type="number" placeholder="Выручка за день"><input id="biz-expenses" type="number" placeholder="Расходы за день"><input id="biz-cash" type="number" placeholder="Деньги на конец дня"><input id="biz-leads" type="number" placeholder="Входящие / заявки"><input id="biz-sales" type="number" placeholder="Продажи / оплаты"><textarea id="biz-note" placeholder="Короткий комментарий: что повлияло на день"></textarea><button class="btn primary" onclick="addBusinessEntry()">Сохранить день</button></div>`)}${card('business-analytics-card', `<h2>Аналитика за 7 дней</h2><div class="business-kpi-grid"><div><span>Выручка</span><b>${formatPoints(s7.revenue)}</b></div><div><span>Расходы</span><b>${formatPoints(s7.expenses)}</b></div><div><span>Разница</span><b>${formatPoints(s7.profit)}</b></div><div><span>Конверсия</span><b>${s7.conversion}%</b></div><div><span>Средний чек</span><b>${formatPoints(s7.avgCheck)}</b></div><div><span>Деньги</span><b>${formatPoints(s7.cash)}</b></div></div><div class="business-diagnosis"><b>Предварительный вывод</b><p>${esc(businessDiagnosticText(s7))}</p></div>`)}${card('', `<h2>Сравнение 30 дней</h2><p>Выручка: <b>${formatPoints(s30.revenue)}</b> · Расходы: <b>${formatPoints(s30.expenses)}</b> · Разница: <b>${formatPoints(s30.profit)}</b> · Конверсия: <b>${s30.conversion}%</b></p>`)}${card('', `<h2>Последние записи</h2>${rows.length ? `<div class="business-entry-list">${rows.map(x=>`<div><div><b>${shortDate(x.date)}</b><p>Выручка ${formatPoints(x.revenue)} · расходы ${formatPoints(x.expenses)} · продажи ${formatPoints(x.sales)}${x.note ? ` · ${esc(x.note)}` : ''}</p></div><button onclick="deleteBusinessEntry('${x.id}')">×</button></div>`).join('')}</div>` : '<p class="small">Пока нет записей.</p>'}<button class="btn secondary" onclick="renderProfile()">Вернуться в профиль</button>`)}`,'profile');
}
function myBusinessCardHtml(){
  if(isAdminMode()){
    return card('my-business-card', `<p class="eyebrow">мой бизнес</p><h2>Финансовый помощник</h2><button class="btn primary" onclick="renderMyBusiness()">Открыть финансовый помощник</button>`);
  }
  return card('my-business-card my-business-card-locked', `<p class="eyebrow">мой бизнес</p><div class="my-business-card-head"><h2>Финансовый помощник</h2><span>скоро</span></div>`);
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
  shell(`${card('blue-card-v2 profile-head-card', `<h1>Профиль</h1><p class="profile-name-line">${esc(state.user?.first_name || 'Пользователь')} · ${studentRoleLabel()}</p>`)}${titleCardHtml()}${card('', `<h2>Прогресс и баллы</h2>${progressRing(gp.percent,'общий',`${gp.done} из ${gp.total || 0}`)}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${formatPoints(points)}</b></div><div><span>Текущий урок</span><b>${lp.percent}%</b></div><div><span>Учебные единицы</span><b>${formatPoints(titleInfo.units)}</b></div><div><span>Готовые уроки</span><b>${readyCoreLessons().length}</b></div></div>`)}${doneSummaryHtml()}${insightsProfileHtml()}${adminBlock}${consultationCardsHtml(points)}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}`)}${myBusinessCardHtml()}`,'profile');
}


/* =====================================================
   v16 overrides — dashboard ring, VIP text, homework dates
   ===================================================== */

function compactProgressRing(percent) {
  const p = safePercent(percent);
  const r = 34;
  const c = Math.round(2 * Math.PI * r);
  const offset = Math.round(c * (1 - p / 100));
  return `<div class="compact-ring-wrap" aria-label="Ваш прогресс ${p}%">
    <svg class="compact-ring-svg" viewBox="0 0 96 96">
      <circle class="compact-ring-track" cx="48" cy="48" r="${r}"></circle>
      <circle class="compact-ring-value" cx="48" cy="48" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
    </svg>
    <div class="compact-ring-center"><b>${p}%</b></div>
  </div>`;
}

function pickLatestDateValue() {
  const values = Array.prototype.slice.call(arguments).filter(Boolean);
  if (!values.length) return null;
  let best = null;
  let bestTime = -Infinity;
  values.forEach(function(value){
    const d = new Date(value);
    const t = d.getTime();
    if (!isNaN(t) && t > bestTime) { bestTime = t; best = value; }
  });
  return best || values[0];
}

function stageCompletedDate(code, stage) {
  const p = getProgress(code);
  if (stage === 'presentation') {
    return isStageDone(code,'presentation') ? pickLatestDateValue(p.presentation_completed_at, p.presentation_started_at) : null;
  }
  if (stage === 'quiz') {
    return isStageDone(code,'quiz') ? pickLatestDateValue(p.quiz_completed_at, p.quiz_started_at) : null;
  }
  if (stage === 'books') {
    return isStageDone(code,'books') ? pickLatestDateValue(p.books_completed_at, p.books_started_at) : null;
  }
  if (stage === 'homeworkSubmitted') {
    return isStageDone(code,'homeworkSubmitted') ? pickLatestDateValue(p.homework_submitted_at, p.homework_started_at) : null;
  }
  if (stage === 'homeworkVerified') {
    if (!isStageDone(code,'homeworkVerified')) return null;
    return pickLatestDateValue(p.homework_verified_at, p.homework_checked_at, p.homework_completed_at, p.completed_at);
  }
  return null;
}

function stageStatusText(code, stage) {
  if (stage === 'homeworkVerified') return isStageDone(code,'homeworkVerified') ? 'принято' : 'ожидает проверки';
  if (stage === 'homeworkSubmitted') return isStageDone(code,'homeworkSubmitted') ? 'отправлено' : 'не отправлено';
  return isStageDone(code, stage) ? 'пройдено' : 'не пройдено';
}

function lessonTimelineHtml(code) {
  const rows = [
    ['presentation','Презентация'],
    ['quiz','Тест'],
    ['books','Саммари'],
    ['homeworkSubmitted','ДЗ отправлено'],
    ['homeworkVerified','ДЗ принято']
  ];
  return card('lesson-timeline-card', `<h2>История прохождения</h2><div class="timeline-grid">${rows.map(([stage,label])=>{
    const status = stageStatusText(code, stage);
    const date = stageCompletedDate(code, stage);
    const done = status === 'пройдено' || status === 'отправлено' || status === 'принято';
    const review = status === 'ожидает проверки';
    return `<div class="timeline-row ${done?'done':''} ${review?'review':''}"><span>${esc(label)}</span><b>${esc(status)}</b><em>${date ? shortDate(date) : '—'}</em></div>`;
  }).join('')}</div>`);
}

function homeworkReviewNoticeHtml(code) {
  const submittedAt = stageCompletedDate(code,'homeworkSubmitted');
  const verifiedAt = stageCompletedDate(code,'homeworkVerified');
  if (isStageDone(code,'homeworkSubmitted') && !isStageDone(code,'homeworkVerified')) {
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(submittedAt)}. После проверки Босс Л.Е.Г.О примет ДЗ или вернёт его на доработку.</p></div>`;
  }
  if (isStageDone(code,'homeworkVerified')) {
    return `<div class="homework-review-notice accepted"><b>Домашнее задание принято</b><p>Проверка завершена ${shortDate(verifiedAt)}. Урок засчитан.</p></div>`;
  }
  return '';
}

function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card v16-dashboard-card', `
      <div class="v16-dashboard-head">
        <div class="v16-dashboard-copy">
          <p class="eyebrow">общая система</p>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по пройденным этапам готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact v16-mini-grid">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
    `)}
    ${activeChallengeCardHtml()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid top-track-grid-six">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled')}
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','скоро','','disabled')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled')}
        ${renderMainBlockCard('VIP уровень','Более подробные разборы, инструменты и активность.','в разработке','','disabled')}
      </div>`)}
  `;
  shell(html, 'home');
}


/* =====================================================
   v17 — 100 книг за 100 дней: запуск челленджа, админ-просмотр, книга дня, мини-тест
   ===================================================== */

const BOOKS100_INDEX_URL = "content/challenges/books100/index.json";
const BOOKS100_CACHE_VERSION = "v31-books100-16-20-deep-rewrite-20260609";
const BOOKS100_STORAGE_KEY = "lego_books100_challenge_v17";

state.books100Index = null;
state.books100Cache = {};
state.books100ScreenIndex = 0;
state.books100QuestionIndex = 0;
state.books100Answers = {};
state.books100ActiveBookDay = 1;
state.books100AdminPreview = false;

function books100NowMs(){ return Date.now(); }
function books100DayMs(){ return 24 * 60 * 60 * 1000; }
function books100Iso(ms){ return new Date(ms || books100NowMs()).toISOString(); }
function books100RemainingMs(ch){
  if (!ch || !ch.active || !ch.dayStartedAt) return 0;
  return Math.max(0, new Date(ch.dayStartedAt).getTime() + books100DayMs() - books100NowMs());
}
function books100TimeLeftText(ms){
  const total = Math.max(0, Number(ms || 0));
  const hours = Math.floor(total / (60 * 60 * 1000));
  const minutes = Math.floor((total % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours} ч ${minutes} мин`;
}
function books100RewardForCurrent(ch){
  const day = Math.max(1, Number(ch?.currentDay || 1));
  const streakBefore = Math.max(0, Number(ch?.streak || 0));
  if (day >= 100 && streakBefore >= 99) return 250;
  return Math.min(250, 50 + streakBefore * 2);
}
function books100DefaultState(){
  return {
    active: false,
    startedAt: null,
    currentDay: 1,
    currentIndex: 0,
    dayStartedAt: null,
    streak: 0,
    passedBooks: 0,
    missedBooks: 0,
    pointsEarned: 0,
    unitsEarned: 0,
    passedBookIds: [],
    missedBookIds: [],
    currentBookTitle: "",
    todayStage: "саммари не открыто",
    updatedAt: books100Iso()
  };
}
function getBooks100RawState(){
  try { return Object.assign(books100DefaultState(), JSON.parse(localStorage.getItem(BOOKS100_STORAGE_KEY) || "{}")); }
  catch(e){ return books100DefaultState(); }
}
function saveBooks100State(data){
  const next = Object.assign(books100DefaultState(), data || {}, { updatedAt: books100Iso() });
  localStorage.setItem(BOOKS100_STORAGE_KEY, JSON.stringify(next));
  return next;
}
function getChallengeState(){
  // Профиль и главная используют эту функцию для баллов и учебных единиц.
  return getBooks100RawState();
}
function saveChallengeState(data){ return saveBooks100State(data); }
function challengeUnits(ch){ return Number((ch || getBooks100RawState()).unitsEarned || (ch || {}).passedBooks || 0); }
function challengePoints(ch){ return Number((ch || getBooks100RawState()).pointsEarned || 0); }
function currentChallengeDay(ch){ return Math.max(1, Math.min(100, Number((ch || getBooks100RawState()).currentDay || 1))); }
function currentChallengeReward(ch){ return books100RewardForCurrent(ch || getBooks100RawState()); }

async function loadBooks100Index(){
  if (state.books100Index) return state.books100Index;
  const response = await fetch(BOOKS100_INDEX_URL + "?v=" + BOOKS100_CACHE_VERSION);
  if (!response.ok) throw new Error("BOOKS100_INDEX_LOAD_FAILED");
  state.books100Index = await response.json();
  return state.books100Index;
}
async function loadBooks100Book(bookMeta){
  const key = bookMeta.id || String(bookMeta.day || "");
  if (state.books100Cache[key]) return state.books100Cache[key];
  const response = await fetch(bookMeta.contentUrl + "?v=" + BOOKS100_CACHE_VERSION);
  if (!response.ok) throw new Error("BOOKS100_BOOK_LOAD_FAILED: " + key);
  const data = await response.json();
  state.books100Cache[key] = data;
  return data;
}
function books100ByDay(index, day){
  return (index?.books || []).find(b => Number(b.day) === Number(day));
}
function books100ByIndex(index, idx){
  return (index?.books || [])[Number(idx || 0)] || null;
}
function normalizeBooks100State(ch, index){
  let next = Object.assign(books100DefaultState(), ch || {});
  if (!next.active) return next;
  let changed = false;
  const books = index?.books || [];
  if (!books.length) return next;
  if (Number(next.currentIndex || 0) >= books.length) return next;
  while (next.active && Number(next.currentIndex || 0) < books.length) {
    const currentBook = books100ByIndex(index, next.currentIndex);
    const currentId = currentBook?.id;
    const alreadyPassed = currentId && (next.passedBookIds || []).includes(currentId);
    const expired = next.dayStartedAt && (books100NowMs() - new Date(next.dayStartedAt).getTime() >= books100DayMs());
    if (!expired || alreadyPassed) break;
    if (currentId && !(next.missedBookIds || []).includes(currentId)) {
      next.missedBookIds = (next.missedBookIds || []).concat(currentId);
      next.missedBooks = Number(next.missedBooks || 0) + 1;
    }
    next.streak = 0;
    next.currentIndex = Number(next.currentIndex || 0) + 1;
    next.currentDay = Number(next.currentDay || 1) + 1;
    next.dayStartedAt = books100Iso();
    next.todayStage = "саммари не открыто";
    changed = true;
  }
  const current = books100ByIndex(index, next.currentIndex);
  next.currentBookTitle = current ? current.title : "следующая книга готовится";
  if (changed) saveBooks100State(next);
  return next;
}
async function getBooks100StateNormalized(){
  const index = await loadBooks100Index();
  const ch = normalizeBooks100State(getBooks100RawState(), index);
  saveBooks100State(ch);
  return ch;
}
function startBookChallenge(){ startBooks100Challenge(); }
async function startBooks100Challenge(){
  const index = await loadBooks100Index();
  const firstBook = books100ByIndex(index, 0);
  const next = saveBooks100State({
    active: true,
    startedAt: books100Iso(),
    currentDay: 1,
    currentIndex: 0,
    dayStartedAt: books100Iso(),
    streak: 0,
    passedBooks: 0,
    missedBooks: 0,
    pointsEarned: 0,
    unitsEarned: 0,
    passedBookIds: [],
    missedBookIds: [],
    currentBookTitle: firstBook ? firstBook.title : "книга дня",
    todayStage: "саммари не открыто"
  });
  renderBookChallenge();
  return next;
}
function resetBooks100Challenge(){
  if (!confirm('Сбросить тестовое состояние челленджа на этом устройстве?')) return;
  localStorage.removeItem(BOOKS100_STORAGE_KEY);
  state.books100ScreenIndex = 0;
  state.books100QuestionIndex = 0;
  state.books100Answers = {};
  renderBookChallenge();
}
async function forceBooks100Miss(){
  const index = await loadBooks100Index();
  const ch = getBooks100RawState();
  if (!ch.active) { alert('Челлендж ещё не запущен.'); return; }
  ch.dayStartedAt = books100Iso(books100NowMs() - books100DayMs() - 1000);
  saveBooks100State(ch);
  await renderBookChallenge();
}
function canOpenBooks100BookForStudent(bookMeta, ch){
  if (!bookMeta) return false;
  const id = bookMeta.id;
  const current = Number(bookMeta.day) === Number(ch.currentDay) || Number(bookMeta.day) === Number(ch.currentIndex) + 1;
  return (ch.passedBookIds || []).includes(id) || current;
}
function books100StatusForBook(bookMeta, ch){
  if (!bookMeta) return 'закрыто';
  if ((ch.passedBookIds || []).includes(bookMeta.id)) return 'зачтено';
  if ((ch.missedBookIds || []).includes(bookMeta.id)) return 'пропущено';
  const currentBook = Number(bookMeta.day) === Number(ch.currentIndex || 0) + 1;
  if (ch.active && currentBook) return 'книга дня';
  return 'закрыто';
}
function books100Card(bookMeta, ch, admin){
  const status = admin ? 'доступно Боссу' : books100StatusForBook(bookMeta, ch);
  const locked = !admin && !canOpenBooks100BookForStudent(bookMeta, ch);
  const img = bookMeta.coverImage || `assets/challenges/books100/${String(bookMeta.day).padStart(3,'0')}/screen_01.png`;
  return `<button class="books100-book-card ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `onclick="openBooks100Book(${Number(bookMeta.day)}, ${admin ? 'true' : 'false'})"`}>
    <div class="books100-cover"><img src="${img}?v=${BOOKS100_CACHE_VERSION}" alt="${esc(bookMeta.title)}" onerror="this.style.display='none';"></div>
    <div><b>${String(bookMeta.day).padStart(3,'0')}. ${esc(bookMeta.title)}</b><p>${esc(bookMeta.author || '')}</p><em>${esc(status)}</em></div>
  </button>`;
}
function activeChallengeCardHtml(){
  const raw = getBooks100RawState();
  if (!raw.active) return '';
  const ms = books100RemainingMs(raw);
  const reward = books100RewardForCurrent(raw);
  return card('challenge-active-card', `<p class="eyebrow">ежедневная задача</p><h2>100 книг за 100 дней</h2><div class="challenge-grid"><div><span>День</span><b>${Number(raw.currentDay || 1)} / 100</b></div><div><span>Осталось</span><b>${books100TimeLeftText(ms)}</b></div><div><span>Серия</span><b>${Number(raw.streak || 0)} подряд</b></div><div><span>Награда</span><b>${formatPoints(reward)} баллов</b></div></div><p><b>Книга:</b> ${esc(raw.currentBookTitle || 'книга дня')}</p><p><b>Этап:</b> ${esc(raw.todayStage || 'саммари не открыто')}</p><button class="btn primary" onclick="renderBookChallenge()">Продолжить челлендж</button>`);
}
async function renderBookChallenge(){
  try {
    const index = await loadBooks100Index();
    const ch = await getBooks100StateNormalized();
    if (isAdminMode()) {
      const html = `${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим Босса</p><h1>100 книг за 100 дней</h1><p>В режиме Босса все загруженные книги открыты для просмотра без таймера, без блокировок и без начисления баллов.</p>`)}
      ${card('', `<h2>Загруженные книги</h2><p class="small">Сейчас подключено: ${index.books.length}. По мере добавления book_006.json и далее список расширится автоматически.</p><div class="books100-list">${index.books.map(b=>books100Card(b, ch, true)).join('')}</div><div class="grid-v2"><button class="btn secondary" onclick="resetBooks100Challenge()">Сбросить тестовое состояние</button><button class="btn secondary" onclick="forceBooks100Miss()">Сымитировать пропуск суток</button></div>`)}
      ${card('', `<button class="btn secondary" onclick="renderHome()">На главную</button>`)} `;
      shell(html,'home');
      return;
    }
    if (!ch.active) {
      const html = `${card('blue-card-v2 books100-hero', `<p class="eyebrow">ежедневный челлендж</p><h1>100 книг за 100 дней</h1><p>Каждый день открывается одна книга на 24 часа. Если саммари изучено и мини-тест пройден, книга остаётся в личной библиотеке, начисляется +1 учебная единица и баллы серии.</p>`)}
      ${card('', `<h2>Правила зачёта</h2><div class="list-clean"><div><b>Одна книга в день</b><p>На книгу даётся 24 часа с момента открытия дня.</p></div><div><b>Награда растёт по серии</b><p>Первый зачёт — 50 баллов. Каждый день подряд добавляет +2 к награде следующей книги. При пропуске серия возвращается к 50.</p></div><div><b>Учебная единица</b><p>Каждая зачтённая книга после мини-теста даёт +1 учебную единицу.</p></div></div><button class="btn primary" onclick="startBooks100Challenge()">Начать челлендж</button><button class="btn secondary" onclick="renderHome()">На главную</button>`)} `;
      shell(html,'home');
      return;
    }
    const currentBook = books100ByIndex(index, ch.currentIndex);
    const ms = books100RemainingMs(ch);
    const reward = books100RewardForCurrent(ch);
    const currentBlock = currentBook
      ? `<div class="books100-current"><div><p class="eyebrow">книга дня</p><h2>${esc(currentBook.title)}</h2><p>${esc(currentBook.author || '')}</p></div><button class="btn primary" onclick="openBooks100Book(${Number(currentBook.day)}, false)">Открыть книгу дня</button></div>`
      : `<div class="books100-current"><h2>Следующие книги готовятся</h2><p>Первые ${index.books.length} книг подключены. Добавьте следующие JSON-файлы в content/challenges/books100/, чтобы продолжить маршрут.</p></div>`;
    const html = `${card('blue-card-v2 books100-hero', `<p class="eyebrow">100 книг за 100 дней</p><h1>День ${Number(ch.currentDay || 1)} / 100</h1><p>До конца окна: <b>${books100TimeLeftText(ms)}</b>. Награда за зачёт сегодня: <b>${formatPoints(reward)} баллов</b> и <b>+1 учебная единица</b>.</p>${progressBarHtml(Math.min(100, Number(ch.passedBooks || 0)), 'on-dark')}`)}
    ${card('books100-status-card', `<div class="challenge-grid"><div><span>Серия</span><b>${Number(ch.streak || 0)}</b></div><div><span>Зачтено</span><b>${Number(ch.passedBooks || 0)}</b></div><div><span>Пропущено</span><b>${Number(ch.missedBooks || 0)}</b></div><div><span>Баллы</span><b>${formatPoints(Number(ch.pointsEarned || 0))}</b></div></div>${currentBlock}`)}
    ${card('', `<h2>Личная библиотека</h2><p class="small">Зачтённые книги остаются доступными. Пропущенные книги закрываются.</p><div class="books100-list">${index.books.map(b=>books100Card(b, ch, false)).join('')}</div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`;
    shell(html,'home');
  } catch(e) {
    shell(`${card('result-bad-v2', `<h1>Книги не загрузились</h1><p>Проверьте, что файлы лежат в <b>content/challenges/books100/</b> и называются index.json, book_001.json, book_002.json и так далее.</p><p class="small">${esc(e.message || e)}</p><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }
}
async function openBooks100Book(day, adminPreview){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, day);
  if (!bookMeta) { alert('Книга не найдена.'); return; }
  const ch = await getBooks100StateNormalized();
  if (!adminPreview && !canOpenBooks100BookForStudent(bookMeta, ch)) { alert('Эта книга сейчас закрыта.'); return; }
  state.books100ActiveBookDay = Number(day);
  state.books100ScreenIndex = 0;
  state.books100AdminPreview = Boolean(adminPreview);
  if (!adminPreview) saveBooks100State(Object.assign(ch, { todayStage: 'саммари открыто' }));
  renderBooks100Reading();
}
function books100ScreenTextHtml(book, screen){
  const assignment = book.practicalAssignment || {};
  const screenText = screen ? `<h3>${esc(screen.title || '')}</h3><p>${esc(screen.text || '')}</p>` : '';
  const summary = state.books100ScreenIndex >= (book.screens || []).length - 1
    ? `<div class="books100-full-summary"><h3>Развёрнутое саммари</h3>${book.fullSummaryHtml || ''}<h3>Практика дня</h3><p><b>${esc(assignment.title || 'Практическое задание')}</b></p><p>${esc(assignment.result || '')}</p></div>`
    : '';
  return `<section class="slide-text-v2 books100-text">${screenText}${summary}</section>`;
}
async function renderBooks100Reading(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const screens = book.screens || [];
  const i = Math.max(0, Math.min(state.books100ScreenIndex, screens.length - 1));
  state.books100ScreenIndex = i;
  const screen = screens[i];
  const total = screens.length || 1;
  const image = screen?.image || `assets/challenges/books100/${String(book.day).padStart(3,'0')}/screen_${String(i+1).padStart(2,'0')}.png`;
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderBookChallenge()">К челленджу</button><button class="btn secondary" ${i===0?'disabled':''} onclick="prevBooks100Screen()">Назад</button><button class="btn primary" onclick="nextBooks100Screen()">${i===total-1?'К мини-тесту':'Далее'}</button></div>`;
  shell(`${nav}<div class="media-counter">Книга ${String(book.day).padStart(3,'0')}: экран ${i+1}/${total}</div><div class="media-box-v2"><img src="${image}?v=${BOOKS100_CACHE_VERSION}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="image-missing-v2" style="display:none"><b>Экран ${i+1}</b><p>Иллюстрация в подготовке.</p></div></div>${books100ScreenTextHtml(book, screen)}`,'home');
}
function prevBooks100Screen(){ if (state.books100ScreenIndex > 0) { state.books100ScreenIndex--; renderBooks100Reading(); } }
function nextBooks100Screen(){
  loadBooks100Index().then(index=>{
    const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
    return loadBooks100Book(bookMeta);
  }).then(book=>{
    const total = (book.screens || []).length;
    if (state.books100ScreenIndex < total - 1) { state.books100ScreenIndex++; renderBooks100Reading(); }
    else startBooks100Quiz();
  });
}
async function startBooks100Quiz(){
  state.books100QuestionIndex = 0;
  state.books100Answers = {};
  const ch = getBooks100RawState();
  if (!state.books100AdminPreview) saveBooks100State(Object.assign(ch, { todayStage: 'мини-тест открыт' }));
  renderBooks100QuizQuestion();
}
async function renderBooks100QuizQuestion(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const quiz = book.quiz || [];
  if (!quiz.length) { alert('В этой книге нет мини-теста.'); return; }
  const i = Math.max(0, Math.min(state.books100QuestionIndex, quiz.length-1));
  state.books100QuestionIndex = i;
  const q = quiz[i];
  const selected = state.books100Answers[i];
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderBookChallenge()">К челленджу</button><button class="btn secondary" ${i===0?'disabled':''} onclick="prevBooks100Question()">Назад</button><button class="btn secondary" onclick="renderBooks100Reading()">К саммари</button></div>`;
  shell(`${nav}<div class="quiz-card-v2 books100-quiz-card"><p class="eyebrow">Мини-тест · вопрос ${i+1}/${quiz.length}</p><h2>${esc(q.q)}</h2><p class="small">Нажмите на вариант ответа — следующий вопрос откроется автоматически.</p>${(q.a||[]).map((a,idx)=>`<button class="option-v2 ${Number(selected)===idx?'selected':''}" onclick="selectBooks100Answer(${idx})">${quizOptionLabel(idx)}. ${esc(a)}</button>`).join('')}</div>`,'home');
}
function prevBooks100Question(){ if (state.books100QuestionIndex > 0) { state.books100QuestionIndex--; renderBooks100QuizQuestion(); } }
function selectBooks100Answer(i){
  state.books100Answers[state.books100QuestionIndex] = i;
  loadBooks100Index().then(index=>loadBooks100Book(books100ByDay(index, state.books100ActiveBookDay))).then(book=>{
    if (state.books100QuestionIndex < (book.quiz || []).length - 1) { state.books100QuestionIndex++; renderBooks100QuizQuestion(); }
    else finishBooks100Quiz();
  });
}
function books100QuizReviewHtml(book){
  return `<div class="quiz-review-v2"><h2>Разбор мини-теста</h2>${(book.quiz || []).map((q,i)=>{
    const userIndex = Number(state.books100Answers[i]);
    const correctIndex = Number(q.correct || 0);
    const ok = userIndex === correctIndex;
    return `<div class="review-row ${ok?'ok':'bad'}"><h3>Вопрос ${i+1}. ${ok?'Верно':'Нужно повторить'}</h3><p><b>Ваш ответ:</b> ${Number.isFinite(userIndex) ? esc(`${quizOptionLabel(userIndex)}. ${q.a[userIndex] || ''}`) : 'нет ответа'}</p>${ok?'':`<p><b>Правильный ответ:</b> ${esc(`${quizOptionLabel(correctIndex)}. ${q.a[correctIndex] || ''}`)}</p>`}<p><b>Почему:</b> ${esc(q.explanation || 'Ответ проверяет применение идеи книги к управленческой ситуации.')}</p></div>`;
  }).join('')}</div>`;
}
async function finishBooks100Quiz(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const quiz = book.quiz || [];
  let score = 0;
  quiz.forEach((q,i)=>{ if (Number(state.books100Answers[i]) === Number(q.correct || 0)) score++; });
  const passScore = Number(book.passScore || Math.ceil(quiz.length * 0.8));
  const passed = score >= passScore;
  let resultNotice = '';
  if (passed && !state.books100AdminPreview) {
    const ch = await getBooks100StateNormalized();
    if (!(ch.passedBookIds || []).includes(bookMeta.id)) {
      const reward = books100RewardForCurrent(ch);
      const nextIndex = Number(ch.currentIndex || 0) + 1;
      const nextBook = books100ByIndex(index, nextIndex);
      saveBooks100State(Object.assign(ch, {
        passedBookIds: (ch.passedBookIds || []).concat(bookMeta.id),
        passedBooks: Number(ch.passedBooks || 0) + 1,
        streak: Number(ch.streak || 0) + 1,
        pointsEarned: Number(ch.pointsEarned || 0) + reward,
        unitsEarned: Number(ch.unitsEarned || 0) + 1,
        currentIndex: nextIndex,
        currentDay: Number(ch.currentDay || 1) + 1,
        dayStartedAt: books100Iso(),
        currentBookTitle: nextBook ? nextBook.title : 'следующая книга готовится',
        todayStage: nextBook ? 'саммари не открыто' : 'первые книги пройдены'
      }));
      resultNotice = `<p>Начислено: <b>${formatPoints(reward)} баллов</b> и <b>+1 учебная единица</b>. Книга остаётся в личной библиотеке.</p>`;
    } else {
      resultNotice = `<p>Книга уже была зачтена ранее. Повторный проход не начисляет баллы повторно.</p>`;
    }
  }
  if (state.books100AdminPreview) {
    resultNotice = `<p>Это режим Босса Л.Е.Г.О. Баллы, серия и учебные единицы не изменяются.</p>`;
  }
  const msg = passed
    ? `<h1>Книга зачтена</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p>${resultNotice}`
    : `<h1>Мини-тест не пройден</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p><p>Лучше спокойно вернуться к саммари и пройти тест повторно до окончания 24 часов.</p>`;
  shell(`${card(passed?'result-ok-v2':'result-bad-v2', `${msg}<div class="grid-v2">${passed?'<button class="btn primary" onclick="renderBookChallenge()">К челленджу</button>':'<button class="btn primary" onclick="renderBooks100Reading()">Вернуться к саммари</button><button class="btn secondary" onclick="startBooks100Quiz()">Пройти тест заново</button>'}<button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}${card('', books100QuizReviewHtml(book))}`,'home');
}

function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card v16-dashboard-card', `
      <div class="v16-dashboard-head">
        <div class="v16-dashboard-copy">
          <p class="eyebrow">общая система</p>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по пройденным этапам готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact v16-mini-grid">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
    `)}
    ${activeChallengeCardHtml()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid top-track-grid-six">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled')}
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','доступно','renderBookChallenge()','active books100-entry')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled')}
        ${renderMainBlockCard('VIP уровень','Более подробные разборы, инструменты и активность.','в разработке','','disabled')}
      </div>`)}
  `;
  shell(html, 'home');
}

function renderAdmin(){
  if(!isAdminUser()){ alert('Нет прав Босса Л.Е.Г.О.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель Босса Л.Е.Г.О</h1><p>Полный доступ ко всем урокам, предпросмотр контента, книги челленджа и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Книги челленджа</h2><p>В режиме Босса все загруженные книги доступны для просмотра без таймера и без начисления баллов.</p><button class="btn primary" onclick="renderBookChallenge()">Открыть книги челленджа</button>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile');
}


/* =====================================================
   v18 — Books100 Supabase timer and reading overrides
   ===================================================== */
const BOOKS100_PROGRESS_URL_V18 = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/books100-progress";
const BOOKS100_CACHE_VERSION_V18 = "v31-books100-16-20-deep-rewrite-20260609";
state.books100ServerState = null;

function books100BookPayloadV18(book){
  if (!book) return null;
  return { bookId: book.id, bookDay: Number(book.day||0), bookTitle: book.title||"", bookAuthor: book.author||"" };
}
function books100BooksPayloadV18(index){ return ((index && index.books) || []).map(books100BookPayloadV18).filter(Boolean); }
function books100DefaultMergedV18(){ try { return Object.assign(books100DefaultState(), JSON.parse(localStorage.getItem(BOOKS100_STORAGE_KEY)||"{}")); } catch(e){ return books100DefaultState(); } }
function books100ApplyServerStateV18(data){
  if (!data) return books100DefaultMergedV18();
  const p = data.progress || data.state || data;
  const statuses = data.statuses || [];
  const statusByBookId = {};
  statuses.forEach(s => { if (s && s.book_id) statusByBookId[s.book_id] = s; });
  const next = Object.assign(books100DefaultState(), {
    started: Boolean(p.started || p.started_at || p.startedAt),
    startedAt: p.started_at || p.startedAt || null,
    currentIndex: Number(p.current_index ?? p.currentIndex ?? 0),
    currentDay: Number(p.current_day ?? p.currentDay ?? 1),
    dayStartedAt: p.day_started_at || p.dayStartedAt || null,
    currentBookId: p.current_book_id || p.currentBookId || null,
    currentBookTitle: p.current_book_title || p.currentBookTitle || null,
    todayStage: p.today_stage || p.todayStage || "саммари не открыто",
    streak: Number(p.streak || 0),
    pointsEarned: Number(p.points_earned ?? p.pointsEarned ?? 0),
    unitsEarned: Number(p.units_earned ?? p.unitsEarned ?? 0),
    passedBooks: Number(p.passed_books ?? p.passedBooks ?? 0),
    missedBooks: Number(p.missed_books ?? p.missedBooks ?? 0),
    statusByBookId,
    passedBookIds: statuses.filter(s=>s.status==="passed").map(s=>s.book_id),
    missedBookIds: statuses.filter(s=>s.status==="missed").map(s=>s.book_id),
    updatedAt: p.updated_at || p.updatedAt || books100Iso()
  });
  state.books100ServerState = next;
  localStorage.setItem(BOOKS100_STORAGE_KEY, JSON.stringify(next));
  return next;
}
function getBooks100RawState(){ return state.books100ServerState || books100DefaultMergedV18(); }
function getChallengeState(){ return getBooks100RawState(); }
function saveBooks100State(data){ state.books100ServerState = Object.assign(books100DefaultState(), data||{}, {updatedAt:books100Iso()}); localStorage.setItem(BOOKS100_STORAGE_KEY, JSON.stringify(state.books100ServerState)); return state.books100ServerState; }
function challengeUnits(ch){ return Number((ch || getBooks100RawState()).unitsEarned || 0); }
function challengePoints(ch){ return Number((ch || getBooks100RawState()).pointsEarned || 0); }
function currentChallengeReward(ch){ return books100RewardForCurrent(ch || getBooks100RawState()); }

async function books100ApiV18(action, payload){
  if (!tg || !tg.initData) throw new Error("BOOKS100_TELEGRAM_REQUIRED");
  const response = await fetch(BOOKS100_PROGRESS_URL_V18, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ initData: tg.initData, action, payload: payload || {} })
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok || data.ok === false) throw new Error(data.reason || data.error || "BOOKS100_PROGRESS_ERROR");
  if (data.progress || data.state) books100ApplyServerStateV18(data);
  return data;
}
async function getBooks100StateNormalized(){
  const index = await loadBooks100Index();
  try { return books100ApplyServerStateV18(await books100ApiV18("get_state", { books: books100BooksPayloadV18(index) })); }
  catch(e){ console.error("BOOKS100_SYNC_ERROR", e); return getBooks100RawState(); }
}
async function startBookChallenge(){
  const index = await loadBooks100Index();
  const first = books100ByIndex(index, 0);
  try { books100ApplyServerStateV18(await books100ApiV18("start", { currentBook: books100BookPayloadV18(first), books: books100BooksPayloadV18(index) })); }
  catch(e){ console.error(e); alert("Не удалось запустить челлендж. Проверьте Supabase Edge Function books100-progress."); }
  renderBookChallenge();
}
async function resetBooks100Challenge(){
  if (!isAdminMode()) return alert("Сброс доступен только Боссу Л.Е.Г.О.");
  if (!confirm("Сбросить своё тестовое состояние челленджа?")) return;
  try { await books100ApiV18("reset", {}); } catch(e){ console.error(e); }
  state.books100ServerState = null; localStorage.removeItem(BOOKS100_STORAGE_KEY); renderBookChallenge();
}
async function forceBooks100Miss(){
  if (!isAdminMode()) return alert("Тест пропуска доступен только Боссу Л.Е.Г.О.");
  const index = await loadBooks100Index();
  try { await books100ApiV18("force_miss", { books: books100BooksPayloadV18(index) }); } catch(e){ console.error(e); alert("Не удалось сымитировать пропуск."); }
  renderBookChallenge();
}
function books100StatusForBook(bookMeta, ch){
  const row = ((ch && ch.statusByBookId) || {})[bookMeta.id];
  if (row && row.status === "passed") return "зачтено";
  if (row && row.status === "missed") return "пропущено";
  if (bookMeta.id === (ch && ch.currentBookId)) return "открыто сегодня";
  return "закрыто";
}
function books100Card(bookMeta, ch, admin){
  const status = admin ? "доступно Боссу" : books100StatusForBook(bookMeta, ch);
  const open = admin || status === "зачтено" || status === "открыто сегодня";
  const img = bookMeta.coverImage || `assets/challenges/books100/${String(bookMeta.day).padStart(3,"0")}/screen_01.png`;
  return `<button class="books100-book-card ${open?'':'locked'} ${status==='зачтено'?'passed':''} ${status==='пропущено'?'missed':''}" ${open?`onclick="openBooks100Book(${Number(bookMeta.day)}, ${admin?'true':'false'})"`:'disabled'}>
    <div class="books100-cover"><img src="${img}?v=${BOOKS100_CACHE_VERSION_V18}" alt="${esc(bookMeta.title)}" onerror="this.style.display='none';"></div>
    <div><b>${esc(bookMeta.title)}</b><p>${esc(bookMeta.author||'')}</p><span>${esc(status)}</span></div>
  </button>`;
}
function books100CurrentStateCardV18(ch, currentBook, ms){
  const row = currentBook ? ((ch.statusByBookId || {})[currentBook.id]) : null;
  const passed = row && row.status === "passed";
  const note = passed
    ? `Книга зачтена. Следующая книга откроется после окончания таймера: <b>${books100TimeLeftText(ms)}</b>.`
    : `На прохождение текущей книги осталось: <b>${books100TimeLeftText(ms)}</b>.`;
  const btn = currentBook ? (passed
    ? `<button class="btn secondary" onclick="openBooks100Book(${Number(currentBook.day)}, false)">Открыть зачтённую книгу</button>`
    : `<button class="btn primary" onclick="openBooks100Book(${Number(currentBook.day)}, false)">Открыть книгу дня</button>`) : "";
  return `<div class="books100-current"><div><p class="eyebrow">книга дня</p><h2>${esc(currentBook ? currentBook.title : 'Следующие книги готовятся')}</h2><p>${esc(currentBook ? (currentBook.author||'') : 'Добавьте следующие книги в content/challenges/books100/.')}</p><p class="small">${note}</p></div>${btn}</div>`;
}
async function renderBookChallenge(){
  try{
    const index = await loadBooks100Index();
    if (isAdminMode()){
      const ch = await getBooks100StateNormalized();
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим Босса</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов.</p>`)}
        ${card('', `<h2>Загруженные книги</h2><p class="small">Подключено: ${index.books.length}. Здесь проверяется текст, картинки и мини-тесты.</p><div class="books100-list">${index.books.map(b=>books100Card(b,ch,true)).join('')}</div><div class="grid-v2"><button class="btn secondary" onclick="resetBooks100Challenge()">Сбросить своё тестовое состояние</button><button class="btn secondary" onclick="forceBooks100Miss()">Сымитировать пропуск суток</button></div>`)}
        ${card('', `<button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
      return;
    }
    const ch = await getBooks100StateNormalized();
    if (!ch.started){
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">ежедневный челлендж</p><h1>100 книг за 100 дней</h1><p>При первом запуске открывается первая книга и начинается окно на 24 часа. Зачёт книги даёт +1 учебную единицу и баллы серии. Следующая книга открывается только после окончания текущего таймера.</p>`)}
        ${card('', `<h2>Правила</h2><div class="list-clean"><div><b>1 книга — 24 часа</b><p>Если мини-тест пройден, книга сохраняется в личной библиотеке.</p></div><div><b>Баллы серии</b><p>Первый зачёт — 50 баллов. Каждый следующий зачёт подряд добавляет +2 балла к награде дня.</p></div><div><b>Пропуск</b><p>Если книга не пройдена за 24 часа, она закрывается, серия сбрасывается, следующая награда снова равна 50 баллам.</p></div></div><button class="btn primary" onclick="startBookChallenge()">Начать челлендж</button><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
      return;
    }
    const currentBook = books100ByIndex(index, Number(ch.currentIndex||0));
    const ms = books100RemainingMs(ch);
    const reward = books100RewardForCurrent(ch);
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">100 книг за 100 дней</p><h1>День ${Number(ch.currentDay||1)} / 100</h1><p>Награда за зачёт текущей книги: <b>${formatPoints(reward)} баллов</b> и <b>+1 учебная единица</b>. Новая книга не открывается сразу после теста — она ждёт окончания 24-часового окна.</p>${progressBarHtml(Math.min(100, Number(ch.passedBooks||0)), 'on-dark')}`)}
      ${card('books100-status-card', `<div class="challenge-grid"><div><span>Осталось</span><b>${books100TimeLeftText(ms)}</b></div><div><span>Серия</span><b>${Number(ch.streak||0)}</b></div><div><span>Зачтено</span><b>${Number(ch.passedBooks||0)}</b></div><div><span>Баллы</span><b>${formatPoints(Number(ch.pointsEarned||0))}</b></div></div>${books100CurrentStateCardV18(ch,currentBook,ms)}`)}
      ${card('', `<h2>Личная библиотека</h2><p class="small">Зачтённые книги остаются доступными. Пропущенные книги закрываются.</p><div class="books100-list">${index.books.map(b=>books100Card(b,ch,false)).join('')}</div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }catch(e){
    console.error(e);
    shell(`${card('result-bad-v2', `<h1>Книги не загрузились</h1><p>Проверьте файлы в <b>content/challenges/books100/</b> и функцию <b>books100-progress</b> в Supabase.</p><p class="small">${esc(e.message||e)}</p><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }
}
async function openBooks100Book(day, adminPreview){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, day);
  if (!bookMeta) return alert("Книга не найдена.");
  if (!adminPreview){
    const ch = await getBooks100StateNormalized();
    const status = books100StatusForBook(bookMeta, ch);
    if (status !== "открыто сегодня" && status !== "зачтено"){
      alert(status === "пропущено" ? "Эта книга была пропущена и закрыта." : "Эта книга пока закрыта. Следующая книга откроется после окончания текущего таймера.");
      return;
    }
    try { await books100ApiV18("open_book", { book: books100BookPayloadV18(bookMeta), books: books100BooksPayloadV18(index) }); } catch(e){ console.error(e); }
  }
  state.books100ActiveBookDay = Number(day); state.books100ScreenIndex = 0; state.books100QuestionIndex = 0; state.books100Answers = {}; state.books100AdminPreview = Boolean(adminPreview);
  renderBooks100Reading();
}
function books100ScreenTextHtml(book, screen){
  const body = screen?.textHtml || (screen?.text ? `<p>${esc(screen.text)}</p>` : "<p>Текст слайда будет добавлен после редакторской проверки.</p>");
  const assignment = book.practicalAssignment || {};
  const summary = state.books100ScreenIndex >= (book.screens||[]).length-1 ? `<div class="books100-full-summary"><h3>Практика дня</h3><p><b>${esc(assignment.title||'Практическое задание')}</b></p><p>${esc(assignment.result||'')}</p></div>` : "";
  return `<section class="slide-text-v2 books100-text"><p class="eyebrow">Книга: ${esc(book.title)}</p><h3>Слайд ${Number(screen?.number || state.books100ScreenIndex+1)}. ${esc(screen?.title||'')}</h3>${body}${summary}</section>`;
}
async function renderBooks100Reading(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const screens = book.screens || [];
  const i = Math.max(0, Math.min(state.books100ScreenIndex, screens.length-1));
  state.books100ScreenIndex = i;
  const screen = screens[i] || {};
  const total = screens.length || 1;
  const image = screen.image || `assets/challenges/books100/${String(book.day).padStart(3,'0')}/screen_${String(i+1).padStart(2,'0')}.png`;
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderBookChallenge()">К челленджу</button><button class="btn secondary" ${i===0?'disabled':''} onclick="prevBooks100Screen()">Назад</button><button class="btn primary" onclick="nextBooks100Screen()">${i===total-1?'К мини-тесту':'Далее'}</button></div>`;
  shell(`${nav}<div class="media-counter">Книга: ${esc(book.title)} · слайд ${i+1}/${total}</div><div class="media-box-v2"><img src="${image}?v=${BOOKS100_CACHE_VERSION_V18}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="image-missing-v2" style="display:none"><b>Слайд ${i+1}</b><p>Иллюстрация в подготовке.</p></div></div>${books100ScreenTextHtml(book,screen)}`,'home');
}
async function startBooks100Quiz(){
  state.books100QuestionIndex = 0; state.books100Answers = {};
  if (!state.books100AdminPreview){ const index = await loadBooks100Index(); const bookMeta = books100ByDay(index, state.books100ActiveBookDay); try{ await books100ApiV18("quiz_started", { book: books100BookPayloadV18(bookMeta), books: books100BooksPayloadV18(index) }); }catch(e){console.error(e);} }
  renderBooks100QuizQuestion();
}
async function renderBooks100QuizQuestion(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index, state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const quiz = book.quiz || [];
  if (!quiz.length) return alert("В этой книге нет мини-теста.");
  const i = Math.max(0, Math.min(state.books100QuestionIndex, quiz.length-1));
  state.books100QuestionIndex = i;
  const q = quiz[i]; const selected = state.books100Answers[i];
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderBookChallenge()">К челленджу</button><button class="btn secondary" ${i===0?'disabled':''} onclick="prevBooks100Question()">Назад</button><button class="btn secondary" onclick="renderBooks100Reading()">К саммари</button></div>`;
  shell(`${nav}<div class="quiz-card-v2 books100-quiz-card"><p class="eyebrow">Мини-тест · вопрос ${i+1}/${quiz.length}</p><h2>${esc(q.q)}</h2><p class="small">Выберите управленчески точный вариант. Ответы близкие по смыслу: тест проверяет применение книги.</p>${(q.a||[]).map((a,idx)=>`<button class="option-v2 ${Number(selected)===idx?'selected':''}" onclick="selectBooks100Answer(${idx})">${quizOptionLabel(idx)}. ${esc(a)}</button>`).join('')}</div>`,'home');
}
function selectBooks100Answer(i){
  state.books100Answers[state.books100QuestionIndex]=i;
  loadBooks100Index().then(index=>loadBooks100Book(books100ByDay(index,state.books100ActiveBookDay))).then(book=>{
    if (state.books100QuestionIndex < (book.quiz||[]).length-1){ state.books100QuestionIndex++; renderBooks100QuizQuestion(); } else finishBooks100Quiz();
  });
}
async function finishBooks100Quiz(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index,state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const quiz = book.quiz || [];
  let score=0; quiz.forEach((q,i)=>{ if(Number(state.books100Answers[i])===Number(q.correct||0)) score++; });
  const passScore = Number(book.passScore || Math.ceil(quiz.length*.8));
  const passed = score >= passScore;
  let resultNotice = "";
  if (state.books100AdminPreview){ resultNotice = `<p>Это режим Босса Л.Е.Г.О. Баллы, серия и учебные единицы не изменяются.</p>`; }
  else {
    try{
      const data = await books100ApiV18("quiz_completed", { book: books100BookPayloadV18(bookMeta), books: books100BooksPayloadV18(index), score, total: quiz.length, passed, answers: state.books100Answers });
      const ch = books100ApplyServerStateV18(data);
      if (passed){ const row = (ch.statusByBookId||{})[bookMeta.id] || {}; const pts = row.points_awarded || data.pointsAwarded || 0; resultNotice = `<p>Начислено: <b>${formatPoints(pts)} баллов</b> и <b>+1 учебная единица</b>. Книга остаётся в личной библиотеке. Следующая книга откроется после окончания 24-часового окна.</p>`; }
    }catch(e){ console.error(e); resultNotice = `<p class="small">Не удалось сохранить результат в Supabase: ${esc(e.message||e)}.</p>`; }
  }
  const msg = passed ? `<h1>Книга зачтена</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p>${resultNotice}` : `<h1>Мини-тест не пройден</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p><p>Лучше спокойно вернуться к саммари, перечитать ключевые слайды и пройти тест повторно до окончания 24 часов.</p>${resultNotice}`;
  shell(`${card(passed?'result-ok-v2':'result-bad-v2', `${msg}<div class="grid-v2">${passed?'<button class="btn primary" onclick="renderBookChallenge()">К челленджу</button>':'<button class="btn primary" onclick="renderBooks100Reading()">Вернуться к саммари</button><button class="btn secondary" onclick="startBooks100Quiz()">Пройти тест заново</button>'}<button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}${card('',books100QuizReviewHtml(book))}`,'home');
}
function activeChallengeCardHtml(){
  const ch = getBooks100RawState();
  if (!ch || !ch.started) return "";
  const ms = books100RemainingMs(ch); const reward = books100RewardForCurrent(ch);
  return card('challenge-active-card', `<p class="eyebrow">ежедневная задача</p><h2>100 книг за 100 дней</h2><div class="challenge-grid"><div><span>День</span><b>${Number(ch.currentDay||1)} / 100</b></div><div><span>Осталось</span><b>${books100TimeLeftText(ms)}</b></div><div><span>Серия</span><b>${Number(ch.streak||0)} подряд</b></div><div><span>Награда</span><b>${formatPoints(reward)} баллов</b></div></div><p><b>Книга:</b> ${esc(ch.currentBookTitle||'книга дня')}</p><p><b>Этап:</b> ${esc(ch.todayStage||'саммари не открыто')}</p><button class="btn primary" onclick="renderBookChallenge()">Продолжить челлендж</button>`);
}



/* =====================================================
   v19 — Books100 cache reset, live timer, fixed server state mapping
   ===================================================== */

function books100IsStartedV19(ch) {
  return Boolean(ch && (ch.started || ch.active || ch.startedAt || ch.started_at));
}

function books100RemainingMs(ch) {
  if (!books100IsStartedV19(ch) || !ch.dayStartedAt) return 0;
  const startedAt = new Date(ch.dayStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, startedAt + books100DayMs() - books100NowMs());
}

function books100ApplyServerStateV18(data){
  if (!data) return books100DefaultMergedV18();
  const p = data.progress || data.state || data;
  const statuses = data.statuses || [];
  const statusByBookId = {};
  statuses.forEach(s => { if (s && s.book_id) statusByBookId[s.book_id] = s; });
  const started = Boolean(p.started || p.started_at || p.startedAt);
  const next = Object.assign(books100DefaultState(), {
    active: started,
    started: started,
    startedAt: p.started_at || p.startedAt || null,
    currentIndex: Number(p.current_index ?? p.currentIndex ?? 0),
    currentDay: Number(p.current_day ?? p.currentDay ?? 1),
    dayStartedAt: p.day_started_at || p.dayStartedAt || null,
    currentBookId: p.current_book_id || p.currentBookId || null,
    currentBookTitle: p.current_book_title || p.currentBookTitle || null,
    todayStage: p.today_stage || p.todayStage || "саммари не открыто",
    streak: Number(p.streak || 0),
    pointsEarned: Number(p.points_earned ?? p.pointsEarned ?? 0),
    unitsEarned: Number(p.units_earned ?? p.unitsEarned ?? 0),
    passedBooks: Number(p.passed_books ?? p.passedBooks ?? 0),
    missedBooks: Number(p.missed_books ?? p.missedBooks ?? 0),
    statusByBookId,
    passedBookIds: statuses.filter(s=>s.status==="passed").map(s=>s.book_id),
    missedBookIds: statuses.filter(s=>s.status==="missed").map(s=>s.book_id),
    updatedAt: p.updated_at || p.updatedAt || books100Iso()
  });
  state.books100ServerState = next;
  localStorage.setItem(BOOKS100_STORAGE_KEY, JSON.stringify(next));
  return next;
}

async function loadBooks100Index(){
  const response = await fetch(BOOKS100_INDEX_URL + "?v=" + BOOKS100_CACHE_VERSION_V18, { cache: "no-store" });
  if (!response.ok) throw new Error("BOOKS100_INDEX_LOAD_FAILED");
  state.books100Index = await response.json();
  return state.books100Index;
}

async function loadBooks100Book(bookMeta){
  if (!bookMeta) throw new Error("BOOKS100_BOOK_META_MISSING");
  const key = bookMeta.id || String(bookMeta.day || "");
  const response = await fetch(bookMeta.contentUrl + "?v=" + BOOKS100_CACHE_VERSION_V18, { cache: "no-store" });
  if (!response.ok) throw new Error("BOOKS100_BOOK_LOAD_FAILED: " + key);
  const data = await response.json();
  state.books100Cache[key] = data;
  return data;
}

let books100TimerIntervalV19 = null;
function stopBooks100LiveTimerV19(){
  if (books100TimerIntervalV19) clearInterval(books100TimerIntervalV19);
  books100TimerIntervalV19 = null;
}
function startBooks100LiveTimerV19(deadlineMs){
  stopBooks100LiveTimerV19();
  const deadline = Number(deadlineMs || 0);
  if (!deadline) return;
  const tick = async function(){
    const left = Math.max(0, deadline - Date.now());
    document.querySelectorAll('[data-books100-timer="1"]').forEach(el => {
      el.textContent = books100TimeLeftText(left);
    });
    if (left <= 0) {
      stopBooks100LiveTimerV19();
      try { await renderBookChallenge(); } catch(e) { console.error(e); }
    }
  };
  tick();
  books100TimerIntervalV19 = setInterval(tick, 15000);
}
function books100TimerHtmlV19(ch, ms){
  const deadline = ch && ch.dayStartedAt ? (new Date(ch.dayStartedAt).getTime() + books100DayMs()) : 0;
  return `<b data-books100-timer="1" data-deadline="${Number(deadline||0)}">${books100TimeLeftText(ms)}</b>`;
}

function activeChallengeCardHtml(){
  const ch = getBooks100RawState();
  if (!books100IsStartedV19(ch)) return "";
  const ms = books100RemainingMs(ch);
  const reward = books100RewardForCurrent(ch);
  const html = card('challenge-active-card', `<p class="eyebrow">ежедневная задача</p><h2>100 книг за 100 дней</h2><div class="challenge-grid"><div><span>День</span><b>${Number(ch.currentDay||1)} / 100</b></div><div><span>Осталось</span>${books100TimerHtmlV19(ch, ms)}</div><div><span>Серия</span><b>${Number(ch.streak||0)} подряд</b></div><div><span>Награда</span><b>${formatPoints(books100RewardForCurrent(ch))} баллов</b></div></div><p><b>Книга:</b> ${esc(ch.currentBookTitle||'книга дня')}</p><p><b>Этап:</b> ${esc(ch.todayStage||'саммари не открыто')}</p><button class="btn primary" onclick="renderBookChallenge()">Продолжить челлендж</button>`);
  setTimeout(()=>startBooks100LiveTimerV19(new Date(ch.dayStartedAt).getTime() + books100DayMs()), 0);
  return html;
}

function books100ScreenTextHtml(book, screen){
  const body = screen?.textHtml || (screen?.text ? `<p>${esc(screen.text)}</p>` : "<p>Текст слайда будет добавлен после редакторской проверки.</p>");
  const assignment = book.practicalAssignment || {};
  const summary = state.books100ScreenIndex >= (book.screens||[]).length-1
    ? `<div class="books100-full-summary"><h3>Практика дня</h3><p><b>${esc(assignment.title||'Практическое задание')}</b></p><p>${esc(assignment.result||'')}</p></div>`
    : "";
  return `<section class="slide-text-v2 books100-text"><p class="eyebrow">Книга: ${esc(book.title)}</p><h3>Слайд ${Number(screen?.number || state.books100ScreenIndex+1)}. ${esc(screen?.title||'')}</h3>${body}${summary}</section>`;
}

async function renderBookChallenge(){
  try{
    const index = await loadBooks100Index();
    if (isAdminMode()){
      const ch = await getBooks100StateNormalized();
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим Босса</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов.</p>`)}
        ${card('', `<h2>Загруженные книги</h2><p class="small">Подключено: ${index.books.length}. Здесь проверяется текст, картинки и мини-тесты.</p><div class="books100-list">${index.books.map(b=>books100Card(b,ch,true)).join('')}</div><div class="grid-v2"><button class="btn secondary" onclick="resetBooks100Challenge()">Сбросить своё тестовое состояние</button><button class="btn secondary" onclick="forceBooks100Miss()">Сымитировать пропуск суток</button></div>`)}
        ${card('', `<button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
      return;
    }
    const ch = await getBooks100StateNormalized();
    if (!books100IsStartedV19(ch)){
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">ежедневный челлендж</p><h1>100 книг за 100 дней</h1><p>При первом запуске открывается первая книга и начинается окно на 24 часа. Зачёт книги даёт +1 учебную единицу и баллы серии. Следующая книга открывается только после окончания текущего таймера.</p>`)}
        ${card('', `<h2>Правила</h2><div class="list-clean"><div><b>1 книга — 24 часа</b><p>Если мини-тест пройден, книга сохраняется в личной библиотеке.</p></div><div><b>Баллы серии</b><p>Первый зачёт — 50 баллов. Каждый следующий зачёт подряд добавляет +2 балла к награде дня.</p></div><div><b>Пропуск</b><p>Если книга не пройдена за 24 часа, она закрывается, серия сбрасывается, следующая награда снова равна 50 баллам.</p></div></div><button class="btn primary" onclick="startBookChallenge()">Начать челлендж</button><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
      return;
    }
    const currentBook = books100ByIndex(index, Number(ch.currentIndex||0));
    const ms = books100RemainingMs(ch);
    const reward = books100RewardForCurrent(ch);
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">100 книг за 100 дней</p><h1>День ${Number(ch.currentDay||1)} / 100</h1><p>Награда за зачёт текущей книги: <b>${formatPoints(reward)} баллов</b> и <b>+1 учебная единица</b>. Новая книга не открывается сразу после теста — она ждёт окончания 24-часового окна.</p>${progressBarHtml(Math.min(100, Number(ch.passedBooks||0)), 'on-dark')}`)}
      ${card('books100-status-card', `<div class="challenge-grid"><div><span>Осталось</span>${books100TimerHtmlV19(ch, ms)}</div><div><span>Серия</span><b>${Number(ch.streak||0)}</b></div><div><span>Зачтено</span><b>${Number(ch.passedBooks||0)}</b></div><div><span>Баллы</span><b>${formatPoints(Number(ch.pointsEarned||0))}</b></div></div>${books100CurrentStateCardV18(ch,currentBook,ms)}`)}
      ${card('', `<h2>Личная библиотека</h2><p class="small">Зачтённые книги остаются доступными. Пропущенные книги закрываются.</p><div class="books100-list">${index.books.map(b=>books100Card(b,ch,false)).join('')}</div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
    setTimeout(()=>startBooks100LiveTimerV19(new Date(ch.dayStartedAt).getTime() + books100DayMs()), 0);
  }catch(e){
    console.error(e);
    shell(`${card('result-bad-v2', `<h1>Книги не загрузились</h1><p>Проверьте файлы в <b>content/challenges/books100/</b> и функцию <b>books100-progress</b> в Supabase.</p><p class="small">${esc(e.message||e)}</p><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }
}

async function finishBooks100Quiz(){
  const index = await loadBooks100Index();
  const bookMeta = books100ByDay(index,state.books100ActiveBookDay);
  const book = await loadBooks100Book(bookMeta);
  const quiz = book.quiz || [];
  let score=0; quiz.forEach((q,i)=>{ if(Number(state.books100Answers[i])===Number(q.correct||0)) score++; });
  const passScore = Number(book.passScore || Math.ceil(quiz.length*.8));
  const passed = score >= passScore;
  let resultNotice = "";
  if (state.books100AdminPreview){
    resultNotice = `<p>Это режим Босса Л.Е.Г.О. Баллы, серия и учебные единицы не изменяются.</p>`;
  } else {
    try{
      const data = await books100ApiV18("quiz_completed", { book: books100BookPayloadV18(bookMeta), books: books100BooksPayloadV18(index), score, total: quiz.length, passed, answers: state.books100Answers });
      const ch = books100ApplyServerStateV18(data);
      if (passed){
        const row = (ch.statusByBookId||{})[bookMeta.id] || {};
        const pts = row.points_awarded || data.pointsAwarded || 0;
        resultNotice = `<p>Начислено: <b>${formatPoints(pts)} баллов</b> и <b>+1 учебная единица</b>. Книга остаётся в личной библиотеке. Следующая книга откроется после окончания 24-часового окна.</p>`;
      }
    }catch(e){
      console.error(e);
      resultNotice = `<p class="small">Не удалось сохранить результат в Supabase: ${esc(e.message||e)}.</p>`;
    }
  }
  const msg = passed
    ? `<h1>Книга зачтена</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p>${resultNotice}`
    : `<h1>Мини-тест не пройден</h1><p>Результат: <b>${score}/${quiz.length}</b>. Проходной уровень: <b>${passScore}/${quiz.length}</b>.</p><p>Лучше спокойно вернуться к саммари, перечитать ключевые слайды и пройти тест повторно до окончания 24 часов.</p>${resultNotice}`;
  shell(`${card(passed?'result-ok-v2':'result-bad-v2', `${msg}<div class="grid-v2">${passed?'<button class="btn primary" onclick="renderBookChallenge()">К челленджу</button>':'<button class="btn primary" onclick="renderBooks100Reading()">Вернуться к саммари</button><button class="btn secondary" onclick="startBooks100Quiz()">Пройти тест заново</button>'}<button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}${card('',books100QuizReviewHtml(book))}`,'home');
}



/* =====================================================
   v20 — Books100 FAST mode: быстрый экран, кэш индекса, фоновая синхронизация, без обложек в списке
   ===================================================== */
const BOOKS100_CACHE_VERSION_V20 = "v31-books100-16-20-deep-rewrite-20260609";
const BOOKS100_INDEX_CACHE_KEY_V20 = "lego_books100_index_v31_days001_020";
const BOOKS100_INDEX_CACHE_TTL_V20 = 6 * 60 * 60 * 1000;

state.books100IndexPromiseV20 = null;
state.books100SyncPromiseV20 = null;
state.books100LastSyncAtV20 = 0;

function books100ReadIndexCacheV20(){
  try{
    const raw = sessionStorage.getItem(BOOKS100_INDEX_CACHE_KEY_V20) || localStorage.getItem(BOOKS100_INDEX_CACHE_KEY_V20);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(!parsed || !parsed.data || !Array.isArray(parsed.data.books)) return null;
    if(Date.now() - Number(parsed.savedAt || 0) > BOOKS100_INDEX_CACHE_TTL_V20) return null;
    return parsed.data;
  }catch(e){ return null; }
}
function books100WriteIndexCacheV20(data){
  try{
    const payload = JSON.stringify({ savedAt: Date.now(), data });
    sessionStorage.setItem(BOOKS100_INDEX_CACHE_KEY_V20, payload);
    localStorage.setItem(BOOKS100_INDEX_CACHE_KEY_V20, payload);
  }catch(e){}
}
async function books100RefreshIndexV20(){
  if(state.books100IndexPromiseV20) return state.books100IndexPromiseV20;
  state.books100IndexPromiseV20 = fetch(BOOKS100_INDEX_URL + "?v=" + BOOKS100_CACHE_VERSION_V20, { cache: "default" })
    .then(response => {
      if(!response.ok) throw new Error("BOOKS100_INDEX_LOAD_FAILED");
      return response.json();
    })
    .then(data => {
      state.books100Index = data;
      books100WriteIndexCacheV20(data);
      return data;
    })
    .finally(() => { state.books100IndexPromiseV20 = null; });
  return state.books100IndexPromiseV20;
}
async function loadBooks100Index(){
  if(state.books100Index && Array.isArray(state.books100Index.books)) return state.books100Index;
  const cached = books100ReadIndexCacheV20();
  if(cached){
    state.books100Index = cached;
    books100RefreshIndexV20().catch(e => console.warn("BOOKS100_INDEX_BACKGROUND_REFRESH_FAILED", e));
    return cached;
  }
  return await books100RefreshIndexV20();
}
async function loadBooks100Book(bookMeta){
  bookMeta = normalizeBooks100BookMetaV28(bookMeta);
  if(!bookMeta) throw new Error("BOOKS100_BOOK_META_MISSING");
  const key = bookMeta.id || books100LegacyIdFromDayV28(bookMeta.day);
  if(state.books100Cache && state.books100Cache[key]) return state.books100Cache[key];
  const urls = Array.from(new Set([bookMeta.contentUrl, ...(bookMeta.fallbackContentUrls || [])].filter(Boolean)));
  let lastError = null;
  for(const url of urls){
    try{
      const response = await fetch(url + "?v=" + BOOKS100_CACHE_VERSION_V20, { cache: "no-store" });
      if(!response.ok){ lastError = new Error(`HTTP_${response.status}: ${url}`); continue; }
      const data = await response.json();
      data.id = data.id || key;
      state.books100Cache[key] = data;
      return data;
    }catch(e){ lastError = e; }
  }
  throw new Error("BOOKS100_BOOK_LOAD_FAILED: " + key + " | " + (lastError?.message || "no available contentUrl"));
}

function books100LegacyIdFromDayV28(day){
  return `book100-${String(Number(day || 1)).padStart(2,"0")}`;
}
function books100Day3V28(day){
  return String(Number(day || 1)).padStart(3,"0");
}
function normalizeBooks100BookMetaV28(bookMeta){
  if(!bookMeta) return null;
  const idNumber = String(bookMeta.id || "").match(/(\d+)/)?.[1];
  const day = Number(bookMeta.day || idNumber || 1);
  const day2 = String(day).padStart(2,"0");
  const day3 = String(day).padStart(3,"0");
  return Object.assign({}, bookMeta, {
    day,
    id: bookMeta.id || `book100-${day2}`,
    contentUrl: bookMeta.contentUrl || `content/challenges/books100/book100-${day2}.json`,
    fallbackContentUrls: Array.from(new Set([...(bookMeta.fallbackContentUrls || []), `content/challenges/books100/${day3}.json`, `content/challenges/books100/book_${day3}.json`])),
    coverImage: bookMeta.coverImage || `assets/challenges/books100/${day3}/screen_01.png`
  });
}

function books100ApiV20(action, payload, options){
  if(!tg || !tg.initData) return Promise.reject(new Error("BOOKS100_TELEGRAM_REQUIRED"));
  const timeoutMs = Number((options && options.timeoutMs) || 9000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(BOOKS100_PROGRESS_URL_V18, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: tg.initData, action, payload: payload || {} }),
    signal: controller.signal
  }).then(async response => {
    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));
    if(!response.ok || data.ok === false) throw new Error(data.reason || data.error || "BOOKS100_PROGRESS_ERROR");
    if(data.progress || data.state) books100ApplyServerStateV18(data);
    return data;
  }).catch(error => {
    clearTimeout(timeout);
    if(error && error.name === "AbortError") throw new Error("BOOKS100_PROGRESS_TIMEOUT");
    throw error;
  });
}
async function books100ApiV18(action, payload){
  return await books100ApiV20(action, payload, { timeoutMs: 9000 });
}
async function syncBooks100StateV20(index, rerender){
  if(!index || !Array.isArray(index.books)) return getBooks100RawState();
  if(isAdminMode()) return getBooks100RawState();
  if(state.books100SyncPromiseV20) return state.books100SyncPromiseV20;
  state.books100SyncPromiseV20 = books100ApiV20("get_state", { books: books100BooksPayloadV18(index) }, { timeoutMs: 9000 })
    .then(data => {
      const ch = books100ApplyServerStateV18(data);
      state.books100LastSyncAtV20 = Date.now();
      if(rerender) renderBookChallengeFromStateV20(index, ch, false, null);
      return ch;
    })
    .catch(error => {
      console.warn("BOOKS100_SYNC_BACKGROUND_ERROR", error);
      const line = document.querySelector('[data-books100-sync-line="1"]');
      if(line) line.textContent = "Синхронизация не ответила быстро. Показано последнее сохранённое состояние.";
      return getBooks100RawState();
    })
    .finally(() => { state.books100SyncPromiseV20 = null; });
  return state.books100SyncPromiseV20;
}
async function getBooks100StateNormalized(){
  const index = await loadBooks100Index();
  if(isAdminMode()) return getBooks100RawState();
  return await syncBooks100StateV20(index, false);
}
function books100CurrentBookV20(index, ch){
  const books = (index && index.books) || [];
  if(ch && ch.currentBookId){
    const byId = books.find(b => b.id === ch.currentBookId);
    if(byId) return byId;
  }
  return books100ByIndex(index, Number(ch && ch.currentIndex || 0));
}
function books100StatusForBook(bookMeta, ch){
  if(!bookMeta) return "закрыто";
  const row = ((ch && ch.statusByBookId) || {})[bookMeta.id];
  if(row && row.status === "passed") return "зачтено";
  if(row && row.status === "missed") return "пропущено";
  if(bookMeta.id === (ch && ch.currentBookId)) return "открыто сегодня";
  return "закрыто";
}
function books100Card(bookMeta, ch, admin){
  const status = admin ? "доступно Боссу" : books100StatusForBook(bookMeta, ch);
  const open = admin || status === "зачтено" || status === "открыто сегодня";
  const day = String(bookMeta.day || "").padStart(3,"0");
  return `<button class="books100-book-card books100-book-card-fast ${open?'':'locked'} ${status==='зачтено'?'passed':''} ${status==='пропущено'?'missed':''}" ${open?`onclick="openBooks100Book(${Number(bookMeta.day)}, ${admin?'true':'false'})"`:'disabled'}>
    <div class="books100-cover books100-cover-fast"><span>${day}</span></div>
    <div><b>${esc(bookMeta.title)}</b><p>${esc(bookMeta.author||'')}</p><span>${esc(status)}</span></div>
  </button>`;
}
function books100VisibleStudentBooksV20(index, ch){
  const books = (index && index.books) || [];
  const visible = books.filter(b => {
    const status = books100StatusForBook(b, ch);
    return status === "зачтено" || status === "пропущено" || status === "открыто сегодня";
  });
  return visible.length ? visible : books.slice(0,1);
}
function renderBookChallengeFromStateV20(index, ch, syncing, errorText){
  if(isAdminMode()){
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим Босса</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов. Список показывается без тяжёлых обложек, чтобы открываться быстро.</p>`)}
      ${card('', `<h2>Загруженные книги</h2><p class="small">Подключено: ${(index.books||[]).length}. Здесь проверяется текст, картинки и мини-тесты. Обложки не грузятся в списке — изображения открываются внутри книги.</p><div class="books100-list">${(index.books||[]).map(b=>books100Card(b,ch,true)).join('')}</div><div class="grid-v2"><button class="btn secondary" onclick="resetBooks100Challenge()">Сбросить своё тестовое состояние</button><button class="btn secondary" onclick="forceBooks100Miss()">Сымитировать пропуск суток</button></div>`)}
      ${card('', `<button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
    return;
  }
  if(!books100IsStartedV19(ch)){
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">ежедневный челлендж</p><h1>100 книг за 100 дней</h1><p>При первом запуске открывается первая книга и начинается окно на 24 часа. Зачёт книги даёт +1 учебную единицу и баллы серии. Следующая книга открывается только после окончания текущего таймера.</p>`)}
      ${card('', `<h2>Правила</h2><div class="list-clean"><div><b>1 книга — 24 часа</b><p>Если мини-тест пройден, книга сохраняется в личной библиотеке.</p></div><div><b>Баллы серии</b><p>Первый зачёт — 50 баллов. Каждый следующий зачёт подряд добавляет +2 балла к награде дня.</p></div><div><b>Пропуск</b><p>Если книга не пройдена за 24 часа, она закрывается, серия сбрасывается, следующая награда снова равна 50 баллам.</p></div></div><p class="small" data-books100-sync-line="1">${syncing ? 'Синхронизируем состояние с Supabase...' : (errorText || '')}</p><button class="btn primary" onclick="startBookChallenge()">Начать челлендж</button><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
    return;
  }
  const currentBook = books100CurrentBookV20(index, ch);
  const ms = books100RemainingMs(ch);
  const reward = books100RewardForCurrent(ch);
  const visibleBooks = books100VisibleStudentBooksV20(index, ch);
  shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">100 книг за 100 дней</p><h1>День ${Number(ch.currentDay||1)} / 100</h1><p>Награда за зачёт текущей книги: <b>${formatPoints(reward)} баллов</b> и <b>+1 учебная единица</b>. Новая книга не открывается сразу после теста — она ждёт окончания 24-часового окна.</p><p class="small" data-books100-sync-line="1">${syncing ? 'Синхронизируем состояние с Supabase...' : 'Состояние синхронизировано.'}</p>${progressBarHtml(Math.min(100, Number(ch.passedBooks||0)), 'on-dark')}`)}
    ${card('books100-status-card', `<div class="challenge-grid"><div><span>Осталось</span>${books100TimerHtmlV19(ch, ms)}</div><div><span>Серия</span><b>${Number(ch.streak||0)}</b></div><div><span>Зачтено</span><b>${Number(ch.passedBooks||0)}</b></div><div><span>Баллы</span><b>${formatPoints(Number(ch.pointsEarned||0))}</b></div></div>${books100CurrentStateCardV18(ch,currentBook,ms)}`)}
    ${card('', `<h2>Личная библиотека</h2><p class="small">Показаны текущая книга, зачтённые книги и пропущенные книги.</p><div class="books100-list">${visibleBooks.map(b=>books100Card(b,ch,false)).join('')}</div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  setTimeout(()=>startBooks100LiveTimerV19(new Date(ch.dayStartedAt).getTime() + books100DayMs()), 0);
}
async function renderBookChallenge(){
  stopBooks100LiveTimerV19();
  try{
    const cached = state.books100Index || books100ReadIndexCacheV20();
    if(cached){
      state.books100Index = cached;
      const localState = getBooks100RawState();
      renderBookChallengeFromStateV20(cached, localState, !isAdminMode(), null);
      if(!isAdminMode()) syncBooks100StateV20(cached, true);
      books100RefreshIndexV20().catch(e=>console.warn('BOOKS100_INDEX_REFRESH_FAIL', e));
      return;
    }
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">100 книг за 100 дней</p><h1>Открываем челлендж</h1><p>Загружаем список книг. Обычно это занимает несколько секунд.</p>`)}${card('', `<p class="small">Если экран висит дольше 10 секунд, проверьте файл <b>content/challenges/books100/index.json</b>.</p><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
    const index = await loadBooks100Index();
    const localState = getBooks100RawState();
    renderBookChallengeFromStateV20(index, localState, !isAdminMode(), null);
    if(!isAdminMode()) syncBooks100StateV20(index, true);
  }catch(e){
    console.error(e);
    shell(`${card('result-bad-v2', `<h1>Книги не загрузились</h1><p>Проверьте файл <b>content/challenges/books100/index.json</b>. Картинки на скорость первого открытия больше не влияют, потому что обложки в списке не грузятся.</p><p class="small">${esc(e.message||e)}</p><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }
}
async function startBookChallenge(){
  try{
    const index = await loadBooks100Index();
    const first = books100ByIndex(index, 0);
    shell(`${card('blue-card-v2 books100-hero', `<h1>Запускаем челлендж</h1><p>Создаём 24-часовое окно первой книги.</p>`)}`,'home');
    const data = await books100ApiV20("start", { currentBook: books100BookPayloadV18(first), books: books100BooksPayloadV18(index) }, { timeoutMs: 10000 });
    const ch = books100ApplyServerStateV18(data);
    renderBookChallengeFromStateV20(index, ch, false, null);
  }catch(e){
    console.error(e);
    shell(`${card('result-bad-v2', `<h1>Челлендж не запустился</h1><p>Supabase не ответил быстро или вернул ошибку.</p><p class="small">${esc(e.message||e)}</p><button class="btn secondary" onclick="renderBookChallenge()">Повторить</button><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  }
}
async function resetBooks100Challenge(){
  if(!isAdminMode()) return alert("Сброс доступен только Боссу Л.Е.Г.О.");
  if(!confirm("Сбросить своё тестовое состояние челленджа?")) return;
  try{ await books100ApiV20("reset", {}, { timeoutMs: 10000 }); }catch(e){ console.error(e); }
  state.books100ServerState = null;
  localStorage.removeItem(BOOKS100_STORAGE_KEY);
  renderBookChallenge();
}
async function forceBooks100Miss(){
  if(!isAdminMode()) return alert("Тест пропуска доступен только Боссу Л.Е.Г.О.");
  try{
    const index = await loadBooks100Index();
    await books100ApiV20("force_miss", { books: books100BooksPayloadV18(index) }, { timeoutMs: 10000 });
  }catch(e){ console.error(e); alert("Не удалось сымитировать пропуск: " + (e.message||e)); }
  renderBookChallenge();
}
async function openBooks100Book(day, adminPreview){
  try{
    const index = await loadBooks100Index();
    const bookMeta = books100ByDay(index, day);
    if(!bookMeta) return alert("Книга не найдена.");
    if(!adminPreview){
      shell(`${card('blue-card-v2 books100-hero', `<h1>Открываем книгу</h1><p>Проверяем доступ к книге дня.</p>`)}`,'home');
      const data = await books100ApiV20("open_book", { book: books100BookPayloadV18(bookMeta), books: books100BooksPayloadV18(index) }, { timeoutMs: 10000 });
      const ch = books100ApplyServerStateV18(data);
      const status = books100StatusForBook(bookMeta, ch);
      if(status !== "открыто сегодня" && status !== "зачтено"){
        alert(status === "пропущено" ? "Эта книга была пропущена и закрыта." : "Эта книга пока закрыта. Следующая книга откроется после окончания текущего таймера.");
        renderBookChallengeFromStateV20(index, ch, false, null);
        return;
      }
    }
    state.books100ActiveBookDay = Number(day);
    state.books100ScreenIndex = 0;
    state.books100QuestionIndex = 0;
    state.books100Answers = {};
    state.books100AdminPreview = Boolean(adminPreview);
    renderBooks100Reading();
  }catch(e){
    console.error(e);
    shell(`${card('result-bad-v2', `<h1>Книга не открылась</h1><p>Не удалось проверить доступ или загрузить книгу.</p><p class="small">${esc(e.message||e)}</p><button class="btn secondary" onclick="renderBookChallenge()">К челленджу</button>`)}`,'home');
  }
}

/* v32: boot is moved to the final access-gate block */

/* =====================================================
   v22 — production access, homepage blocks, instruction panel
   ===================================================== */
function isLessonPrepared(meta) {
  if (!meta) return false;
  const readyFirstLessons = ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"];
  if (readyFirstLessons.includes(meta.code)) return true;
  if (Number(meta.number) === 1) return false;
  return meta.status === "ready";
}

function toggleGlobalInstruction(force) {
  const el = $("global-instruction-panel");
  if (!el) return;
  const next = force === undefined ? el.style.display === "none" || !el.style.display : Boolean(force);
  el.style.display = next ? "block" : "none";
  if (next) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function globalInstructionPanelHtml() {
  return `<div id="global-instruction-panel" class="global-instruction-panel" style="display:none">
    <div class="instruction-head"><b>Как пользоваться системой</b><button onclick="toggleGlobalInstruction(false)" aria-label="Закрыть инструкцию">×</button></div>
    <div class="instruction-steps">
      <div><b>1. Выберите блок</b><p>Основной маршрут сейчас находится в разделе «Я предприниматель». Там выбирается вид деятельности и открывается последовательный путь уроков.</p></div>
      <div><b>2. Проходите урок по порядку</b><p>Внутри урока сохраняется маршрут: презентация → тест → саммари книг → домашнее задание → проверка. Следующий этап открывается после предыдущего, чтобы не терялась логика обучения.</p></div>
      <div><b>3. Работайте с фактами бизнеса</b><p>В домашнем задании важно заполнять реальные или честно оценочные данные. Цель — не красивая таблица, а первичный диагноз: где теряется результат и что проверить ближайшие 7 дней.</p></div>
      <div><b>4. Следите за прогрессом</b><p>Общий прогресс считается по готовым урокам и их этапам: презентация, тест, саммари и принятое домашнее задание. Баллы и достижения показывают накопленную активность внутри системы.</p></div>
      <div><b>5. Используйте дополнительные блоки отдельно</b><p>Челлендж книг, бизнес-факты, материалы и медиа будут усиливать обучение, но основной порядок остаётся прежним: сначала урок, затем практика и проверка.</p></div>
    </div>
  </div>`;
}

function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card v16-dashboard-card', `
      <div class="v16-dashboard-head">
        <div class="v16-dashboard-copy">
          <div class="eyebrow-row"><p class="eyebrow">общая система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">инструкция</button></div>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по пройденным этапам готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact v16-mini-grid">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
      ${globalInstructionPanelHtml()}
    `)}
    ${activeChallengeCardHtml()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid main-track-grid-v22">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled main-block-card')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active main-block-card')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled main-block-card')}
      </div>
      <div class="secondary-track-grid-v22">
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','доступно','renderBookChallenge()','active books100-entry compact-card')}
        ${renderMainBlockCard('Бизнес-факты','Короткие практические статьи о реальных бизнес-ситуациях: ошибки, решения, цифры и выводы, которые можно применить в своей системе.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('VIP уровень','Более подробные разборы, инструменты и активность.','в разработке','','disabled compact-card')}
        ${renderMainBlockCard('Бизнес-медиа','Подборки фильмов, сериалов, интервью и полезных видео о бизнесе с управленческими выводами для практики.','скоро','','disabled compact-card compact-card-wide')}
      </div>`)}
  `;
  shell(html, 'home');
}

/* =====================================================
   v24 — stabilization layer: progress, lessons, quiz, homework
   ===================================================== */
var LEGO_V24_CACHE_VERSION = "v31-books100-16-20-deep-rewrite-20260609";
var LEGO_READY_FIRST_LESSON_CODES_V24 = ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"];
var LEGO_CORE_STAGE_CODES_V24 = ["presentation", "quiz", "books", "homework"];

function contentVersionV24() {
  return LEGO_V24_CACHE_VERSION;
}
function fetchJsonV24(url) {
  return fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + contentVersionV24(), { cache: "no-cache" }).then(function(response){
    if (!response.ok) throw new Error("LOAD_FAILED: " + url);
    return response.json();
  });
}
async function loadCatalog() {
  if (state.catalog && state.catalog.__version === contentVersionV24()) return state.catalog;
  const data = await fetchJsonV24(CATALOG_URL);
  data.__version = contentVersionV24();
  state.catalog = data;
  return state.catalog;
}
async function loadLesson(code) {
  const cached = state.lessonCache[code];
  if (cached && cached.__version === contentVersionV24()) return cached;
  if (!state.catalog) await loadCatalog();
  const lesson = (state.catalog.lessons || []).find(function(l){ return l.code === code; });
  if (!lesson) throw new Error("LESSON_NOT_FOUND: " + code);
  const data = await fetchJsonV24(lesson.contentUrl);
  data.__version = contentVersionV24();
  state.lessonCache[code] = data;
  return data;
}
function mediaUrlV24(url) {
  if (!url) return "";
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + contentVersionV24();
}
function brandLogoHtml(compact) {
  const logo = compact ? "assets/brand/lego-mark.png" : "assets/brand/lego-logo.png";
  return `<button class="brand-lockup ${compact ? 'compact' : ''}" onclick="renderHome()" aria-label="Л.Е.Г.О — на главную">
    <span class="brand-logo-plate">
      <img src="${mediaUrlV24(logo)}" alt="Л.Е.Г.О" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="brand-fallback" style="display:none"><b>Л.Е.Г.О.</b><span>система внедрения управленческих изменений</span></span>
    </span>
  </button>`;
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
      img.src = mediaUrlV24(legacy);
      return;
    }
  }
  img.style.display = "none";
  const fallback = img.nextElementSibling;
  if (fallback) fallback.style.display = "flex";
}
function mediaScreen(image,label,current,total,html){
  const legacy = legacyTradeImage(label, current);
  const src = legacy || image || "";
  const imageHtml = src
    ? `<img src="${mediaUrlV24(src)}" data-label="${esc(label)}" data-index="${Number(current)}" onerror="handleImageError(this)">`
    : `<img src="" data-label="${esc(label)}" data-index="${Number(current)}" style="display:none" onerror="handleImageError(this)">`;
  return `<div class="media-counter">${esc(label)}: ${Number(current)}/${Number(total)}</div><div class="media-box-v2">${imageHtml}<div class="image-missing-v2" style="display:none"><b>${esc(label)} ${Number(current)}</b><p>Иллюстрация в подготовке.</p></div></div><section class="slide-text-v2">${cleanStudentHtml(html)}</section>`;
}
function lessonOverviewCard(lesson) {
  const img = lesson.overviewImage || `assets/lesson_overview/${lesson.code}.png`;
  return `<section class="lesson-overview-card"><img src="${mediaUrlV24(img)}" alt="Карта урока" onerror="this.closest('.lesson-overview-card').style.display='none';"></section>`;
}

function homeworkStateV24(code) {
  const p = getProgress(code);
  const status = String(p.status || "").toLowerCase();
  const verified = Boolean(p.homework_verified || p.homework_checked || p.homework_verified_at || status === "completed");
  if (verified) return { key: "accepted", label: "Домашнее задание принято" };
  if (status === "homework_revision" || status === "revision" || status === "rejected" || status === "needs_revision") return { key: "revision", label: "ДЗ на доработке" };
  if (p.homework_submitted || p.homework_submitted_at || status === "homework_submitted") return { key: "review", label: "ДЗ на проверке" };
  if (isStageDone(code, "books")) return { key: "available", label: "Сдать ДЗ" };
  return { key: "locked", label: "ДЗ закрыто" };
}
function isStageDone(code, stage) {
  const p = getProgress(code);
  const status = String(p.status || "").toLowerCase();
  if(stage === "presentation") return Boolean(p.presentation_completed || p.presentation_completed_at);
  if(stage === "quiz") return Boolean(p.quiz_completed || p.quiz_completed_at);
  if(stage === "books") return Boolean(p.books_completed || p.books_completed_at);
  if(stage === "homeworkSubmitted") return homeworkStateV24(code).key !== "locked" && homeworkStateV24(code).key !== "available";
  if(stage === "homeworkVerified") return Boolean(p.homework_verified || p.homework_checked || p.homework_verified_at || status === "completed");
  return false;
}
function lessonStageLabel(code) {
  const hw = homeworkStateV24(code);
  if (hw.key === "accepted") return "Модуль закрыт";
  if (hw.key === "revision") return "Доработать ДЗ";
  if (hw.key === "review") return "ДЗ на проверке";
  if (isStageDone(code,"books")) return "Сдать ДЗ";
  if (isStageDone(code,"quiz")) return "Изучить саммари";
  if (isStageDone(code,"presentation")) return "Пройти тест";
  return "Начать презентацию";
}
function lessonStageAction(code) {
  const hw = homeworkStateV24(code);
  if (hw.key === "review" || hw.key === "accepted") return "renderHomeworkStatus()";
  if (hw.key === "revision" || isStageDone(code,"books")) return "renderHomework()";
  if (isStageDone(code,"quiz")) return "startBooks()";
  if (isStageDone(code,"presentation")) return "startQuiz(false)";
  return "startSlides()";
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
function isLessonPrepared(meta) {
  if (!meta) return false;
  if (LEGO_READY_FIRST_LESSON_CODES_V24.includes(meta.code)) return true;
  if (Number(meta.number) === 1) return false;
  return meta.status === "ready";
}
function canOpenLesson(meta) {
  if (!meta) return false;
  if (isAdminMode()) return true;
  if (!isLessonPrepared(meta)) return false;
  if (Number(meta.number) === 1) return true;
  const prev = activityLessons(meta.activityKey).find(function(l){ return Number(l.number) === Number(meta.number) - 1; });
  return prev ? isStageDone(prev.code, "homeworkVerified") : false;
}
function readyCoreLessons() { return (state.catalog?.lessons || []).filter(isLessonPrepared); }
function globalStageProgress() {
  const lessons = readyCoreLessons();
  let done = 0, total = 0;
  lessons.forEach(function(meta){ total += lessonAvailableStages(meta).length; done += lessonCompletedStageCount(meta.code, meta); });
  return { done, total, percent: total ? safePercent(done / total * 100) : 0 };
}
function currentActivityProgress() {
  const info = activityRouteProgressV24(state.selectedActivityKey);
  return info.routePercent;
}
function activityRouteProgressV24(key) {
  const lessons = activityLessons(key);
  const routeTotal = Math.max(10, lessons.length || 10) * 4;
  let stageDone = 0;
  lessons.forEach(function(meta){ stageDone += lessonCompletedStageCount(meta.code, meta); });
  const readyCount = lessons.filter(isLessonPrepared).length;
  const openCount = lessons.filter(canOpenLesson).length;
  const doneCount = lessons.filter(function(l){ return lessonCompletedStageCount(l.code,l) >= lessonAvailableStages(l).length && lessonAvailableStages(l).length > 0; }).length;
  return { lessons, openCount, readyCount, doneCount, routeTotal, stageDone, routePercent: routeTotal ? safePercent(stageDone / routeTotal * 100) : 0 };
}
function getActivityProgressInfo(key) { return activityRouteProgressV24(key); }
function totalProgressPercent() { return globalStageProgress().percent; }
function lessonProgressMini(code) {
  const info = lessonStageProgressInfo(code);
  return `<div class="lesson-progress-mini stage-progress-mini">
    <div class="lesson-progress-top"><span>Прогресс урока</span><b>${info.percent}%</b></div>
    <div class="lesson-progress-bar"><div style="width:${info.percent}%"></div></div>
  </div>`;
}
function stageCompletedDate(code, stage) {
  const p = getProgress(code);
  if (stage === "presentation") return p.presentation_completed_at || null;
  if (stage === "quiz") return p.quiz_completed_at || null;
  if (stage === "books") return p.books_completed_at || null;
  if (stage === "homeworkSubmitted") return p.homework_submitted_at || null;
  if (stage === "homeworkRevision") return p.homework_checked_at || p.homework_revision_at || p.updated_at || null;
  if (stage === "homeworkVerified") {
    if (!isStageDone(code, "homeworkVerified")) return null;
    return p.homework_verified_at || p.homework_checked_at || p.completed_at || null;
  }
  return null;
}
function lessonTimelineHtml(code) {
  const hw = homeworkStateV24(code);
  const rows = [
    ["presentation", "Презентация", isStageDone(code,"presentation") ? "пройдена" : "—"],
    ["quiz", "Тест", isStageDone(code,"quiz") ? "пройден" : "—"],
    ["books", "Саммари", isStageDone(code,"books") ? "изучено" : "—"],
    ["homeworkSubmitted", "ДЗ отправлено", (hw.key === "review" || hw.key === "revision" || hw.key === "accepted") ? (hw.key === "revision" ? "на доработке" : "отправлено") : "—"],
    ["homeworkVerified", "ДЗ принято", hw.key === "accepted" ? "принято" : (hw.key === "review" ? "ожидает проверки" : "—")]
  ];
  return card('timeline-card', `<h2>История прохождения</h2><div class="timeline-list-v24">${rows.map(function(r){
    const date = stageCompletedDate(code, r[0]);
    const cls = r[2] !== "—" && r[2] !== "ожидает проверки" ? "done" : (r[2] === "ожидает проверки" ? "review" : "");
    return `<div class="timeline-row-v24 ${cls}"><span>${esc(r[1])}</span><b>${esc(r[2])}</b><em>${date ? shortDate(date) : ''}</em></div>`;
  }).join('')}</div>`);
}
function homeworkReviewNoticeHtml(code) {
  const hw = homeworkStateV24(code);
  if (hw.key === "review") return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки появится статус: принято или нужна доработка.</p></div>`;
  if (hw.key === "revision") return `<div class="homework-review-notice revision"><b>Домашнее задание на доработке</b><p>Проверьте комментарий Босса Л.Е.Г.О, уточните вывод и отправьте форму повторно.</p></div>`;
  if (hw.key === "accepted") return `<div class="homework-review-notice accepted"><b>Домашнее задание принято</b><p>Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.</p></div>`;
  return '';
}
function cleanLessonDescription(lesson) {
  const title = String(lesson && lesson.title ? lesson.title : '').trim();
  const key = String(lesson && lesson.activityKey ? lesson.activityKey : '').trim();
  const defaults = {
    trade: "Урок помогает разобрать торговлю через факты: входящий поток, покупки, ассортимент, средний чек, маржу, запасы, расходы и деньги. Задача — не угадать причину проблемы, а увидеть главный участок, где торговая система теряет результат, и выбрать одно проверяемое действие на 7 дней.",
    services: "Урок помогает разобрать услуги через факты: заявки, записи, доходимость, оплаты, средний чек, загрузку специалистов, расходники, расходы и деньги. Задача — понять, где услуга теряет результат: до записи, в оплате, в ресурсе, в повторе или в кассе.",
    production: "Урок помогает разобрать производство через факты: заказы, спецификацию, материалы, мощность, выпуск, брак, себестоимость, сроки и деньги. Задача — увидеть, где производственная система теряет результат, и зафиксировать одно действие для проверки ближайших 7 дней.",
    construction: "Урок помогает разобрать проектную модель через факты: заявки, сметы, договоры, этапы, материалы, бригады, сроки, перерасход, маржу и оплату. Задача — увидеть, где объект или проект теряет управляемость и деньги.",
    logistics: "Урок помогает разобрать логистику через факты: заявки, ставки, рейсы, маршруты, загрузку, топливо, простои, документы, оплату и дебиторку. Задача — понять, какой участок рейса или расчёта забирает результат.",
    horeca: "Урок помогает разобрать HoReCa через факты: поток гостей, посадку, меню, средний чек, кухню, сервис, food cost, списания, расходы и кассу. Задача — увидеть, где заведение теряет результат: в потоке, чеке, себестоимости, операционке или деньгах."
  };
  let text = String(lesson && lesson.description ? lesson.description : '').trim();
  const technical = /Методологии|BMC|TOC|HADI|BSC|Unit Economics|Версия|v\d+|поток клиентов\s*→|цепочк[аи]/i.test(text);
  if (!text || technical) return defaults[key] || `Урок «${title}» помогает собрать факты, увидеть ограничение и выбрать проверяемое действие на ближайший цикл.`;
  return text;
}
function stageCard(key,title,note,done,action,locked, extraCls){
  return `<button class="stage-card-v2 ${done?'done':''} ${locked?'locked':''} ${extraCls||''}" onclick="${locked?'alert(\'Этап пока закрыт.\')':action}"><b>${esc(title)}</b><p>${esc(note)}</p><span>${done?'✓':(locked?'🔒':'→')}</span></button>`;
}
function homeworkStageCardV24(code) {
  const hw = homeworkStateV24(code);
  if (hw.key === "accepted") return stageCard('homework','Домашнее задание','Принято. Урок засчитан.',true,'renderHomeworkStatus()',false,'accepted');
  if (hw.key === "review") return stageCard('homework','Домашнее задание','На проверке.',false,'renderHomeworkStatus()',false,'review');
  if (hw.key === "revision") return stageCard('homework','Домашнее задание','Нужна доработка.',false,'renderHomework()',false,'revision');
  return stageCard('homework','Домашнее задание','Практическая часть урока',false,'renderHomework()',!isStageDone(code,'books') && !isAdminMode());
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
    ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${readyNote}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс направления</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Доступно сейчас: <b>${info.openCount} из ${info.lessons.length}</b>. Готово к выдаче: <b>${info.readyCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}
function renderLessonRow(l) {
  const locked = !canOpenLesson(l);
  const info = lessonStageProgressInfo(l.code);
  const status = locked ? (isLessonPrepared(l) ? 'закрыт до предыдущего ДЗ' : 'в подготовке') : lessonStageLabel(l.code);
  return `<button class="lesson-row-v2 ${locked?'locked':''}" onclick="openLesson('${l.code}')">
    <div><b>${String(l.number).padStart(2,'0')}. ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${esc(status)}</p><div class="lesson-row-progress">${progressBarHtml(info.percent,'')}</div></div>
    <span>${locked?'🔒':(info.percent===100?'✓':'→')}</span>
  </button>`;
}
function renderLessonHub() {
  loadLesson(state.selectedLessonCode).then(function(lesson){
    const meta = getLessonMeta(state.selectedLessonCode);
    const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
    const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
    const html = `
      ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}${homeworkReviewNoticeHtml(meta.code)}<button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`)}
      ${lessonOverviewCard(lesson)}
      <div class="stage-grid-v2">
        ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
        ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
        ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
        ${homeworkStageCardV24(meta.code)}
      </div>
      ${lessonTimelineHtml(meta.code)}
      ${lessonInsightCard()}
      ${card('', `<div class="grid-v2"><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button><button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}
      ${adminService}
    `;
    shell(html, 'learning');
  }).catch(function(e){ emergencyScreen(e.message || 'LESSON_HUB_ERROR'); });
}
async function startQuiz(reset){
  const lesson = await loadLesson(state.selectedLessonCode);
  const p = getProgress(state.selectedLessonCode);
  const total = Array.isArray(lesson.quiz) ? lesson.quiz.length : 0;
  const savedIndex = Number(p.current_question || 0);
  const completed = Boolean(p.quiz_completed || p.quiz_completed_at);
  state.questionIndex = (reset || completed) ? 0 : Math.max(0, Math.min(total ? total - 1 : 0, isNaN(savedIndex) ? 0 : savedIndex));
  state.answers = (reset || completed) ? {} : (p.quiz_answers && typeof p.quiz_answers === 'object' ? p.quiz_answers : {});
  state.quizOptionOrders = {};
  renderQuestion();
}
function quizOrderKeyV24(idx){ return state.selectedLessonCode + ':' + String(idx); }
function shuffledQuizOrderV24(questionIndex, length){
  state.quizOptionOrders = state.quizOptionOrders || {};
  const key = quizOrderKeyV24(questionIndex);
  if (state.quizOptionOrders[key]) return state.quizOptionOrders[key];
  const arr = Array.from({length:Number(length||0)}, function(_,i){ return i; });
  for (let i=arr.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); const t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  state.quizOptionOrders[key] = arr;
  return arr;
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
  const order = shuffledQuizOrderV24(state.questionIndex, (q.a || []).length);
  const isLast = state.questionIndex === lesson.quiz.length - 1;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  const nav = `<div class="nav-panel-v2 nav-panel-v2-three"><button class="btn secondary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" ${state.questionIndex===0?'disabled':''} onclick="prevQuestion()">Назад</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`;
  const options = order.map(function(originalIndex, displayIndex){
    const a = q.a[originalIndex];
    return `<button class="option-v2 ${Number(selected)===Number(originalIndex)?'selected':''}" onclick="selectAnswer(${Number(originalIndex)})">${quizOptionLabel(displayIndex)}. ${esc(a)}</button>`;
  }).join('');
  shell(`${nav}<div class="quiz-card-v2"><p class="eyebrow">Вопрос ${state.questionIndex+1}/${lesson.quiz.length}</p><h2>${esc(q.q)}</h2><p class="small">Нажмите на вариант ответа — следующий вопрос откроется автоматически. Порядок вариантов может отличаться при повторном прохождении.</p>${options}${isLast?'<p class="small">После выбора ответа тест завершится и покажет разбор.</p>':''}</div>`,'learning');
}
function quizReviewHtml(lesson){
  const rows = (lesson.quiz || []).map(function(q,i){
    const rawUser = state.answers[i];
    const userIndex = rawUser === undefined ? undefined : Number(rawUser);
    const correctIndex = Number(q.correct || 0);
    const ok = userIndex === correctIndex;
    const userText = userIndex === undefined ? 'нет ответа' : (q.a[userIndex] || '');
    const correctText = q.a[correctIndex] || '';
    return `<div class="review-row ${ok?'ok':'bad'}"><h3>Вопрос ${i+1}. ${ok?'Верно':'Нужно повторить'}</h3><p><b>Ваш ответ:</b> ${esc(userText)}</p>${ok?'':`<p><b>Правильный ответ:</b> ${esc(correctText)}</p>`}<p><b>Почему:</b> ${esc(q.explanation || 'Правильный ответ опирается на причину, показатель и проверяемое действие, а не на быструю реакцию на симптом.')}</p></div>`;
  }).join('');
  return `<div class="quiz-review-v2"><h2>Разбор ответов</h2>${rows}</div>`;
}
async function renderHomework(){
  const lesson = await loadLesson(state.selectedLessonCode);
  const code = state.selectedLessonCode;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  const hw = lesson.homework || {};
  const hwState = homeworkStateV24(code);
  if (!isAdminMode() && !isStageDone(code, 'books') && hwState.key === 'locked') {
    shell(`${card('blue-card-v2', `<h1>Домашнее задание пока закрыто</h1><p>Домашнее задание открывается после информационной части, теста и саммари. Так сохраняется порядок обучения и проверки.</p>`)}${card('', `<div class="grid-v2">${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button><button class="btn secondary" onclick="renderHome()">На главную</button></div>` )}`,'homework');
    return;
  }
  await remoteSave('homework_started',{});
  const tableButton = hw.buttonLabel || 'Получить шаблон таблицы ДЗ';
  const defaultInstruction = `<h3>Практическая часть урока</h3><p>Откройте прикреплённый шаблон, сделайте копию и заполните фактические или честно оценочные данные своего бизнеса. Главная цель — увидеть первичное ограничение, сформулировать действие на 7 дней и выбрать метрику проверки.</p><p>Не нужно делать идеальную систему учёта. Достаточно тех данных, которые помогают понять, где теряется результат, деньги, время или управляемость.</p>`;
  const instruction = cleanStudentHtml(hw.instructionHtml || defaultInstruction);
  const revision = hwState.key === 'revision' ? homeworkReviewNoticeHtml(code) : '';
  shell(`${card('blue-card-v2', `<h1>${esc(hw.title || 'Домашнее задание')}</h1><p>Практическая часть урока. Здесь материал переносится в реальные цифры и управленческий вывод.</p>${revision}`)}${card('', `${instruction}<div class="grid-v2">${externalButton(tableButton,homeworkSheetUrl(code, hw),'primary')}${externalButton('Открыть форму сдачи',hw.submitFormUrl||'#','secondary')}${actionButton(hwState.key === 'revision' ? 'Я отправил исправленное ДЗ' : 'Я отправил ДЗ','markHomeworkSubmitted()','primary')}${actionButton('← Вернуться к уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button><button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}${isAdminMode()?card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`):''}`,'homework');
}
function renderHomeworkStatus(){
  const code = state.selectedLessonCode;
  const meta = getLessonMeta(code);
  const activityKey = meta ? meta.activityKey : state.selectedActivityKey;
  const hw = homeworkStateV24(code);
  const detail = hw.key === 'accepted'
    ? `Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.`
    : hw.key === 'review'
      ? `Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки появится статус: принято или нужна доработка.`
      : hw.key === 'revision'
        ? 'Работа возвращена на доработку. Откройте домашнее задание, уточните вывод и отправьте форму повторно.'
        : 'Откройте домашнее задание, заполните шаблон и отправьте форму на проверку.';
  shell(`${card('blue-card-v2', `<h1>${esc(hw.label)}</h1><p>${esc(detail)}</p>`)}${lessonTimelineHtml(code)}${card('', `<div class="grid-v2">${actionButton(hw.key === 'revision' ? 'Открыть ДЗ на доработку' : 'К уроку', hw.key === 'revision' ? 'renderHomework()' : 'renderLessonHub()', 'primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button><button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}`,'homework');
}
function renderHomeworkCenter(){
  const visibleLessons = (state.catalog.lessons || []).filter(function(l){ return canOpenLesson(l) || isStageDone(l.code,'homeworkSubmitted') || isStageDone(l.code,'books'); }).slice(0,60);
  shell(`${card('blue-card-v2', `<h1>Домашние задания</h1><p>Здесь отображаются ДЗ по открытым урокам. Если ДЗ ещё закрыто, сначала пройдите презентацию, тест и саммари.</p>`)}${card('', `<div class="lesson-list-v2">${visibleLessons.map(function(l){
    const hw = homeworkStateV24(l.code);
    const ready = isAdminMode() || isStageDone(l.code,'books') || hw.key !== 'locked';
    const status = hw.key === 'accepted' ? 'принято' : hw.key === 'review' ? 'на проверке' : hw.key === 'revision' ? 'на доработке' : ready ? 'можно сдавать' : 'закрыто до саммари';
    return `<button class="lesson-row-v2 ${ready?'':'locked'}" onclick="openLesson('${l.code}').then(()=>${ready?'renderHomework()':'renderLessonHub()'})"><div><b>${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${status}</p></div><span>${ready?'→':'🔒'}</span></button>`;
  }).join('')}</div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'homework');
}

/* =====================================================
   v24 — stabilization overrides: progress, lessons, quiz, homework
   ===================================================== */

function appStableVersionV24(){ return "v31-books100-16-20-deep-rewrite-20260609"; }

function safeFetchUrlV24(url){
  const sep = String(url || "").includes("?") ? "&" : "?";
  return String(url || "") + sep + "v=" + appStableVersionV24();
}

async function loadCatalog() {
  if (state.catalog) return state.catalog;
  const response = await fetch(safeFetchUrlV24(CATALOG_URL), { cache: "no-cache" });
  if (!response.ok) throw new Error("CATALOG_LOAD_FAILED");
  state.catalog = await response.json();
  return state.catalog;
}

async function loadLesson(code) {
  if (state.lessonCache[code]) return state.lessonCache[code];
  if (!state.catalog) await loadCatalog();
  const lessonMeta = (state.catalog.lessons || []).find(l => l.code === code);
  if (!lessonMeta) throw new Error("LESSON_NOT_FOUND: " + code);
  const response = await fetch(safeFetchUrlV24(lessonMeta.contentUrl), { cache: "no-cache" });
  if (!response.ok) throw new Error("LESSON_CONTENT_LOAD_FAILED: " + code);
  const data = await response.json();
  state.lessonCache[code] = data;
  return data;
}

function readyFirstLessonCodesV24(){ return ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"]; }
function isLessonPrepared(meta) {
  if (!meta) return false;
  if (readyFirstLessonCodesV24().includes(meta.code)) return true;
  if (Number(meta.number) === 1) return false;
  return String(meta.status || "").toLowerCase() === "ready";
}

function progressRawV24(code){ return getProgress(code) || {}; }
function homeworkStateV24(code){
  const p = progressRawV24(code);
  const status = String(p.status || p.homework_status || "").toLowerCase();
  const verified = Boolean(p.homework_verified || p.homework_checked || p.homework_verified_at || p.homework_completed || p.homework_completed_at || status === "completed");
  const revision = !verified && Boolean(status === "homework_revision" || status === "revision" || status === "rejected" || p.homework_revision || p.homework_revision_at || p.revision_required);
  const submitted = Boolean(p.homework_submitted || p.homework_submitted_at || revision || verified || status === "homework_submitted");
  if (verified) return "verified";
  if (revision) return "revision";
  if (submitted) return "review";
  return "none";
}

function isStageDone(code, stage) {
  const p = progressRawV24(code);
  if(stage === "presentation") return Boolean(p.presentation_completed || p.presentation_completed_at);
  if(stage === "quiz") return Boolean(p.quiz_completed || p.quiz_completed_at);
  if(stage === "books") return Boolean(p.books_completed || p.books_completed_at);
  if(stage === "homeworkSubmitted") return homeworkStateV24(code) !== "none";
  if(stage === "homeworkRevision") return homeworkStateV24(code) === "revision";
  if(stage === "homeworkVerified") return homeworkStateV24(code) === "verified";
  return false;
}

function lessonStageLabel(code) {
  const hw = homeworkStateV24(code);
  if (hw === "verified") return "Модуль закрыт";
  if (hw === "revision") return "Доработать ДЗ";
  if (hw === "review") return "ДЗ на проверке";
  if (isStageDone(code,"books")) return "Сдать ДЗ";
  if (isStageDone(code,"quiz")) return "Изучить саммари";
  if (isStageDone(code,"presentation")) return "Пройти тест";
  return "Начать презентацию";
}

function lessonStageAction(code) {
  const hw = homeworkStateV24(code);
  if (hw === "review") return "renderHomeworkStatus()";
  if (hw === "revision") return "renderHomework()";
  if (isStageDone(code,"books")) return "renderHomework()";
  if (isStageDone(code,"quiz")) return "startBooks()";
  if (isStageDone(code,"presentation")) return "startQuiz(false)";
  return "startSlides()";
}

function localPatchForEvent(event, payload) {
  const now = nowIso();
  if(event === "lesson_started") return { status:"in_progress", current_step:"presentation", presentation_started_at: now, last_slide_number: payload.lastSlideNumber || 1 };
  if(event === "slide_viewed") return { status:"in_progress", current_step:"presentation", last_slide_number: payload.lastSlideNumber || 1 };
  if(event === "presentation_completed") return { status:"in_progress", current_step:"quiz", presentation_completed:true, presentation_completed_at: now, last_slide_number: payload.lastSlideNumber || 0 };
  if(event === "quiz_started") return { status:"in_progress", current_step:"quiz", quiz_started_at: now, current_question: payload.currentQuestion || 0 };
  if(event === "quiz_progress") return { status:"in_progress", current_step:"quiz", current_question: state.questionIndex, quiz_answers: state.answers };
  if(event === "quiz_completed") return { status:"in_progress", current_step: payload.passed ? "books" : "quiz", quiz_completed: Boolean(payload.passed), quiz_completed_at: payload.passed ? now : undefined, quiz_score: payload.score, quiz_total: payload.total, quiz_answers: payload.answers, current_question: 0 };
  if(event === "books_started") return { status:"in_progress", current_step:"books", books_started_at: now, last_book_slide_number: payload.lastBookSlideNumber || 1 };
  if(event === "book_slide_viewed") return { status:"in_progress", current_step:"books", last_book_slide_number: payload.lastBookSlideNumber || 1 };
  if(event === "books_completed") return { status:"in_progress", current_step:"homework", books_completed:true, books_completed_at: now, last_book_slide_number: payload.lastBookSlideNumber || 0 };
  if(event === "homework_started") return { status:"in_progress", current_step:"homework", homework_started_at: now };
  if(event === "homework_submitted") return { status:"homework_submitted", current_step:"review", homework_submitted:true, homework_submitted_at: now, homework_revision:false };
  if(event === "homework_revision") return { status:"homework_revision", current_step:"homework", homework_submitted:true, homework_revision:true, homework_revision_at: now };
  if(event === "homework_verified") return { status:"completed", current_step:"completed", homework_verified:true, homework_checked:true, homework_completed:true, homework_verified_at: now, homework_checked_at: now, homework_completed_at: now, completed_at: now };
  return { updated_at: now };
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
function isLessonFullyCompleted(meta){ return Boolean(meta && lessonCompletedStageCount(meta.code, meta) >= lessonAvailableStages(meta).length && lessonAvailableStages(meta).length > 0); }
function readyCoreLessons() { return (state.catalog?.lessons || []).filter(isLessonPrepared); }
function globalStageProgress() {
  const lessons = readyCoreLessons();
  let done = 0, total = 0;
  lessons.forEach(meta => { total += lessonAvailableStages(meta).length; done += lessonCompletedStageCount(meta.code, meta); });
  return { done, total, percent: total ? safePercent(done / total * 100) : 0 };
}
function totalProgressPercent() { return globalStageProgress().percent; }
function currentActivityProgress() {
  const lessons = activityLessons(state.selectedActivityKey);
  const routeTotal = Math.max(10, lessons.length || 0) * 4;
  const done = lessons.reduce((sum,l)=>sum + lessonCompletedStageCount(l.code,l),0);
  return routeTotal ? safePercent(done / routeTotal * 100) : 0;
}
function getActivityProgressInfo(key) {
  const lessons = activityLessons(key);
  const openCount = lessons.filter(canOpenLesson).length;
  const readyCount = lessons.filter(isLessonPrepared).length;
  const doneCount = lessons.filter(isLessonFullyCompleted).length;
  const routeTotal = Math.max(10, lessons.length || 0) * 4;
  const stageDone = lessons.reduce((sum,l)=>sum + lessonCompletedStageCount(l.code,l),0);
  return { lessons, openCount, doneCount, readyCount, routeTotal, stageDone, routePercent: routeTotal ? safePercent(stageDone / routeTotal * 100) : 0 };
}
function canOpenLesson(meta) {
  if (!meta) return false;
  if (isAdminMode()) return true;
  if (!isLessonPrepared(meta)) return false;
  if (Number(meta.number) === 1) return true;
  const prev = activityLessons(meta.activityKey).find(l => Number(l.number) === Number(meta.number) - 1);
  return prev ? isStageDone(prev.code, "homeworkVerified") : false;
}

function stageStatusText(code, stage) {
  const hw = homeworkStateV24(code);
  if (stage === 'homeworkVerified') {
    if (hw === 'verified') return 'принято';
    if (hw === 'revision') return 'на доработке';
    if (hw === 'review') return 'ожидает проверки';
    return 'не принято';
  }
  if (stage === 'homeworkSubmitted') {
    if (hw === 'verified') return 'отправлено';
    if (hw === 'revision') return 'требует доработки';
    if (hw === 'review') return 'отправлено';
    return 'не отправлено';
  }
  return isStageDone(code, stage) ? 'пройдено' : 'не пройдено';
}

function stageCompletedDate(code, stage) {
  const p = getProgress(code);
  if (stage === 'presentation') return isStageDone(code,'presentation') ? pickLatestDateValue(p.presentation_completed_at, p.presentation_started_at) : null;
  if (stage === 'quiz') return isStageDone(code,'quiz') ? pickLatestDateValue(p.quiz_completed_at, p.quiz_started_at) : null;
  if (stage === 'books') return isStageDone(code,'books') ? pickLatestDateValue(p.books_completed_at, p.books_started_at) : null;
  if (stage === 'homeworkSubmitted') return homeworkStateV24(code) !== 'none' ? pickLatestDateValue(p.homework_submitted_at, p.homework_started_at) : null;
  if (stage === 'homeworkVerified') return isStageDone(code,'homeworkVerified') ? pickLatestDateValue(p.homework_verified_at, p.homework_checked_at, p.homework_completed_at, p.completed_at) : null;
  if (stage === 'homeworkRevision') return homeworkStateV24(code) === 'revision' ? pickLatestDateValue(p.homework_revision_at, p.homework_checked_at, p.updated_at) : null;
  return null;
}

function lessonTimelineHtml(code) {
  const hw = homeworkStateV24(code);
  const rows = [
    ['presentation','Презентация'],
    ['quiz','Тест'],
    ['books','Саммари'],
    ['homeworkSubmitted','ДЗ отправлено'],
    ['homeworkVerified','ДЗ принято']
  ];
  return card('lesson-timeline-card', `<h2>История прохождения</h2><div class="timeline-grid">${rows.map(([stage,label])=>{
    const status = stageStatusText(code, stage);
    const date = stageCompletedDate(code, stage);
    const done = status === 'пройдено' || status === 'отправлено' || status === 'принято';
    const review = status === 'ожидает проверки';
    const revision = status === 'на доработке' || status === 'требует доработки';
    return `<div class="timeline-row ${done?'done':''} ${review?'review':''} ${revision?'revision':''}"><span>${esc(label)}</span><b>${esc(status)}</b><em>${date ? shortDate(date) : (stage==='homeworkVerified' && hw==='review' ? 'ожидает' : '—')}</em></div>`;
  }).join('')}</div>`);
}

function homeworkReviewNoticeHtml(code) {
  const hw = homeworkStateV24(code);
  if (hw === 'review') {
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки Босс Л.Е.Г.О примет ДЗ или вернёт его на доработку.</p></div>`;
  }
  if (hw === 'revision') {
    const p = getProgress(code);
    const comment = p.admin_review_comment || p.review_comment || p.homework_revision_comment || '';
    return `<div class="homework-review-notice revision"><b>Домашнее задание требует доработки</b><p>${comment ? esc(comment) : 'Уточните вывод, показатель или действие на 7 дней и отправьте работу повторно.'}</p></div>`;
  }
  if (hw === 'verified') {
    return `<div class="homework-review-notice accepted"><b>Домашнее задание принято</b><p>Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.</p></div>`;
  }
  return '';
}

function lessonProgressMini(code) {
  const info = lessonStageProgressInfo(code);
  return `<div class="lesson-progress-mini"><div class="lesson-progress-top"><span>Прогресс урока</span><b>${info.percent}%</b></div><div class="lesson-progress-bar"><div style="width:${info.percent}%"></div></div></div>`;
}

function renderLessonRow(l) {
  const locked = !canOpenLesson(l);
  const prepared = isLessonPrepared(l);
  const progress = lessonStageProgressInfo(l.code);
  const subtitle = !prepared ? 'в подготовке' : (locked ? 'закрыт до предыдущего ДЗ' : lessonStageLabel(l.code));
  return `<button class="lesson-row-v2 ${locked?'locked':''}" onclick="openLesson('${l.code}')"><div><b>${String(l.number).padStart(2,'0')}. ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${subtitle} · ${progress.percent}%</p><div class="lesson-row-progress">${progressBarHtml(progress.percent,'')}</div></div><span>${locked?'🔒':(isLessonFullyCompleted(l)?'✓':'→')}</span></button>`;
}

function renderActivityLessons(key) {
  if (key && getActivity(key)) {
    state.selectedActivityKey = key;
    localStorage.setItem("lego_selected_activity", key);
  }
  const act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
  const info = getActivityProgressInfo(act.key);
  const readyNote = info.readyCount ? 'Первый готовый урок доступен сразу. Следующий урок открывается после приёмки ДЗ предыдущего урока.' : 'Материалы направления временно закрыты и появятся после редакторской проверки.';
  const html = `
    ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${readyNote}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс направления</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
    ${entrepreneurCurrentStepCard()}
    ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Доступно сейчас: <b>${info.openCount}</b>. Готово к выдаче: <b>${info.readyCount}</b>. Пройдено: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
  `;
  shell(html, 'learning');
}

function safeActiveChallengeCardHtmlV24(){
  try { return activeChallengeCardHtml ? activeChallengeCardHtml() : ''; } catch(e) { console.warn('ACTIVE_CHALLENGE_CARD_SKIPPED', e); return ''; }
}
function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card v16-dashboard-card', `
      <div class="v16-dashboard-head">
        <div class="v16-dashboard-copy">
          <div class="eyebrow-row"><p class="eyebrow">общая система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">инструкция</button></div>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по готовым урокам и их этапам: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact v16-mini-grid">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
      ${globalInstructionPanelHtml()}
    `)}
    ${safeActiveChallengeCardHtmlV24()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid main-track-grid-v22">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled main-block-card')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active main-block-card')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled main-block-card')}
      </div>
      <div class="secondary-track-grid-v22">
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','доступно','renderBookChallenge()','active books100-entry compact-card')}
        ${renderMainBlockCard('Бизнес-факты','Короткие практические статьи о реальных бизнес-ситуациях: ошибки, решения, цифры и выводы, которые можно применить в своей системе.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('VIP уровень','Более подробные разборы, инструменты и активность.','в разработке','','disabled compact-card')}
        ${renderMainBlockCard('Бизнес-медиа','Подборки фильмов, сериалов, интервью и полезных видео о бизнесе с управленческими выводами для практики.','скоро','','disabled compact-card compact-card-wide')}
      </div>`)}
  `;
  shell(html, 'home');
}

async function renderLessonHub() {
  try {
    const lesson = await loadLesson(state.selectedLessonCode);
    const meta = getLessonMeta(state.selectedLessonCode);
    const activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
    const adminService = isAdminMode() && lesson.passportText ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>` : "";
    const html = `
      ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}${homeworkReviewNoticeHtml(meta.code)}<button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`)}
      ${lessonOverviewCard(lesson)}
      <div class="stage-grid-v2">
        ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
        ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
        ${stageCard('books','Саммари','Информация о полезных книгах',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
        ${stageCard('homework','Домашнее задание','Практическая часть урока',homeworkStateV24(meta.code)==='verified','renderHomework()',!(isStageDone(meta.code,'books') || homeworkStateV24(meta.code)==='revision') && !isAdminMode())}
      </div>
      ${lessonTimelineHtml(meta.code)}
      ${lessonInsightCard()}
      ${card('', `<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button>`)}
      ${adminService}
    `;
    shell(html, 'learning');
  } catch(e) { emergencyScreen(e.message || 'LESSON_HUB_ERROR'); }
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
  const hw = homeworkStateV24(code);
  if (hw === "review") return renderHomeworkStatus();
  if (hw === "revision") return renderHomework();
  if (isStageDone(code,"books")) return renderHomework();
  if (isStageDone(code,"quiz")) return startBooks();
  if (isStageDone(code,"presentation")) return startQuiz(false);
  return startSlides();
}

async function startQuiz(reset){
  const lesson = await loadLesson(state.selectedLessonCode);
  const p = getProgress(state.selectedLessonCode);
  const total = Array.isArray(lesson.quiz) ? lesson.quiz.length : 0;
  const alreadyFinishedFailed = p.quiz_score !== undefined && !isStageDone(state.selectedLessonCode,'quiz');
  const shouldReset = Boolean(reset || alreadyFinishedFailed);
  const savedIndex = Number(p.current_question || 0);
  state.questionIndex = shouldReset ? 0 : Math.max(0, Math.min(total ? total - 1 : 0, isNaN(savedIndex) ? 0 : savedIndex));
  state.answers = shouldReset ? {} : (p.quiz_answers && typeof p.quiz_answers === 'object' ? p.quiz_answers : {});
  await remoteSave('quiz_started',{currentQuestion:state.questionIndex});
  renderQuestion();
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
  if (!passed) { state.questionIndex = 0; }
  const msg = passed
    ? 'Тест пройден. Можно переходить к блоку с полезными книгами и затем к домашнему заданию.'
    : 'Результат пока ниже проходного уровня. Лучше ещё раз спокойно повторить информационную часть и вернуться к тесту. Вопросы проверяют не память, а управленческую логику: симптом → показатель → ограничение → действие.';
  shell(`${card(passed?'result-ok-v2':'result-bad-v2', `<h1>${passed?'Тест пройден':'Тест не пройден'}</h1><p>Результат: <b>${score}/${total}</b>. Проходной уровень: <b>${passScore}/${total}</b>.</p><p>${msg}</p><div class="grid-v2">${passed?actionButton('К саммари','startBooks()','primary'):actionButton('Вернуться к информационной части','startSlides()','primary')}${!passed?actionButton('Пройти тест заново','startQuiz(true)','secondary'):''}${actionButton('К уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}${card('',quizReviewHtml(lesson))}`,'learning');
}

async function renderHomework(){
  const lesson = await loadLesson(state.selectedLessonCode);
  const code = state.selectedLessonCode;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  const hwState = homeworkStateV24(code);
  if (!isAdminMode() && !(isStageDone(code, 'books') || hwState === 'revision' || hwState === 'review' || hwState === 'verified')) {
    shell(`${card('blue-card-v2', `<h1>Домашнее задание пока закрыто</h1><p>Домашнее задание открывается после информационной части, теста и саммари. Так сохраняется порядок обучения и проверки.</p>`)}${card('', `${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>` )}`,'homework');
    return;
  }
  await remoteSave('homework_started',{});
  const hw = lesson.homework || {};
  const tableButton = hw.buttonLabel || 'Получить шаблон таблицы ДЗ';
  const defaultInstruction = `<h3>Практическая часть урока</h3><p>Заполните прикреплённый шаблон по фактическим данным своего бизнеса. Главная цель — увидеть первичное ограничение, сформулировать действие на 7 дней и выбрать метрику проверки.</p>`;
  const instruction = cleanStudentHtml(hw.instructionHtml || defaultInstruction);
  const revisionNotice = hwState === 'revision' ? homeworkReviewNoticeHtml(code) : '';
  shell(`${card('blue-card-v2', `<h1>${esc(hw.title || 'Домашнее задание')}</h1><p>Практическая часть урока. Здесь материал переносится в реальные цифры и управленческий вывод.</p>`)}${revisionNotice}${card('', `${instruction}<div class="grid-v2">${externalButton(tableButton,homeworkSheetUrl(code, hw),'primary')}${externalButton('Открыть форму сдачи',hw.submitFormUrl||'#','secondary')}${actionButton(hwState==='revision'?'Я отправил доработанное ДЗ':'Я отправил ДЗ','markHomeworkSubmitted()','primary')}${actionButton('← Вернуться к уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}${isAdminMode()?card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`):''}`,'homework');
}

async function markHomeworkSubmitted(){
  if(!confirm('Форма со ссылкой на ДЗ уже отправлена?')) return;
  await remoteSave('homework_submitted',{submittedAt:nowIso()});
  renderHomeworkStatus();
}
function renderHomeworkStatus(){
  const code = state.selectedLessonCode;
  const meta = getLessonMeta(code);
  const activityKey = meta ? meta.activityKey : state.selectedActivityKey;
  const hw = homeworkStateV24(code);
  const statusText = hw === 'verified' ? 'Домашнее задание принято' : (hw === 'revision' ? 'Домашнее задание требует доработки' : (hw === 'review' ? 'Домашнее задание на проверке' : 'Домашнее задание пока не отправлено'));
  const p = getProgress(code);
  const detail = hw === 'verified'
    ? `Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.`
    : (hw === 'revision' ? (p.admin_review_comment || p.review_comment || 'Уточните вывод, показатель или действие на 7 дней и отправьте работу повторно.') : (hw === 'review' ? `Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки откроется следующий шаг или появится доработка.` : 'Откройте домашнее задание, заполните шаблон и отправьте форму на проверку.'));
  shell(`${card('blue-card-v2', `<h1>${esc(statusText)}</h1><p>${esc(detail)}</p>`)}${lessonTimelineHtml(code)}${card('', `${hw === 'revision' ? actionButton('Открыть ДЗ для доработки','renderHomework()','primary') : actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>`)}`,'homework');
}
function renderHomeworkCenter(){
  const visibleLessons = (state.catalog.lessons || []).filter(l=>canOpenLesson(l) || isStageDone(l.code,'homeworkSubmitted')).slice(0,60);
  shell(`${card('blue-card-v2', `<h1>Домашние задания</h1><p>Здесь отображаются задания по открытым урокам. Если ДЗ ещё закрыто, сначала нужно пройти презентацию, тест и саммари.</p>`)}${card('', `<div class="lesson-list-v2">${visibleLessons.map(l=>{
    const hw = homeworkStateV24(l.code);
    const ready = isAdminMode() || isStageDone(l.code,'books') || hw !== 'none';
    const status = hw === 'verified' ? 'принято' : (hw === 'revision' ? 'на доработке' : (hw === 'review' ? 'на проверке' : (ready ? 'можно сдавать' : 'закрыто до саммари')));
    return `<button class="lesson-row-v2 ${ready?'':'locked'}" onclick="openLesson('${l.code}').then(()=>${ready?'renderHomework()':'renderLessonHub()'})"><div><b>${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${status}</p></div><span>${ready?'→':'🔒'}</span></button>`;
  }).join('')}</div>`)}`,'homework');
}

function accessDenied(reason){
  const clean = String(reason || 'ACCESS_DENIED');
  const friendly = clean === 'OPEN_FROM_TELEGRAM_REQUIRED'
    ? 'Откройте приложение из Telegram, чтобы система смогла проверить доступ.'
    : (clean === 'NOT_CHANNEL_MEMBER' ? 'Доступ открыт только участникам закрытого Telegram-канала.' : 'Не удалось подтвердить доступ. Проверьте подписку или напишите в поддержку.');
  shell(card('result-bad-v2', `<h1>Доступ закрыт</h1><p>${esc(friendly)}</p><div class="grid-v2">${externalButton('Написать в поддержку',SUPPORT_FORM_URL,'primary')}</div><p class="small">Код проверки: ${esc(clean)}</p>`),'home');
}

/* =====================================================
   v25 — homework review queue + clear student comments + books100 recovery tools
   ===================================================== */
const APP_STABILIZATION_VERSION_V25 = "v25-homework-books-fix-20260604";

function homeworkStateV24(code){
  const p = getProgress(code) || {};
  const status = String(p.status || p.homework_status || "").toLowerCase();
  const verified = Boolean(p.homework_verified || p.homework_checked && status === "completed" || p.homework_verified_at || p.homework_completed || p.homework_completed_at || status === "completed");
  const revision = !verified && Boolean(status === "homework_revision" || status === "revision" || status === "rejected" || status === "needs_revision" || p.homework_revision || p.homework_revision_at || p.revision_required);
  const review = !verified && !revision && Boolean(p.homework_submitted || p.homework_submitted_at || status === "homework_submitted");
  if (verified) return "verified";
  if (revision) return "revision";
  if (review) return "review";
  return "none";
}
function homeworkCommentV25(code){
  const p = getProgress(code) || {};
  return String(p.admin_review_comment || p.review_comment || p.homework_revision_comment || "").trim();
}
function homeworkStateLabelV25(code){
  const hw = homeworkStateV24(code);
  if (hw === "verified") return "ДЗ принято";
  if (hw === "revision") return "ДЗ на доработке";
  if (hw === "review") return "ДЗ на проверке";
  if (isStageDone(code,"books")) return "можно сдавать";
  return "закрыто";
}
function homeworkReviewNoticeHtml(code) {
  const hw = homeworkStateV24(code);
  if (hw === 'review') {
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки появится статус: принято или на доработке.</p></div>`;
  }
  if (hw === 'revision') {
    const comment = homeworkCommentV25(code);
    return `<div class="homework-review-notice revision"><b>Домашнее задание требует доработки</b><p>${comment ? esc(comment) : 'Уточните вывод, показатель или действие на 7 дней и отправьте работу повторно.'}</p></div>`;
  }
  if (hw === 'verified') {
    const comment = homeworkCommentV25(code);
    return `<div class="homework-review-notice accepted"><b>Домашнее задание принято</b><p>Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.${comment ? '<br><br><b>Комментарий:</b> ' + esc(comment) : ''}</p></div>`;
  }
  return '';
}
function stageStatusText(code, stage) {
  const hw = homeworkStateV24(code);
  if(stage === "presentation") return isStageDone(code,"presentation") ? "пройдена" : "—";
  if(stage === "quiz") return isStageDone(code,"quiz") ? "пройден" : "—";
  if(stage === "books") return isStageDone(code,"books") ? "изучено" : "—";
  if(stage === "homeworkSubmitted") {
    if(hw === "revision") return "на доработке";
    if(hw === "review" || hw === "verified") return "отправлено";
    return "—";
  }
  if(stage === "homeworkVerified") {
    if(hw === "verified") return "принято";
    if(hw === "review") return "ожидает проверки";
    if(hw === "revision") return "требует доработки";
    return "—";
  }
  return "—";
}
function lessonTimelineHtml(code) {
  const hw = homeworkStateV24(code);
  const rows = [
    ["presentation", "Презентация"],
    ["quiz", "Тест"],
    ["books", "Саммари"],
    ["homeworkSubmitted", "ДЗ отправлено"],
    ["homeworkVerified", "ДЗ принято"]
  ];
  return card('lesson-timeline-card', `<h2>История прохождения</h2><div class="timeline-grid">${rows.map(([stage,label])=>{
    const status = stageStatusText(code, stage);
    const date = stageCompletedDate(code, stage);
    const done = status === 'пройдена' || status === 'пройден' || status === 'изучено' || status === 'отправлено' || status === 'принято';
    const review = status === 'ожидает проверки';
    const revision = status === 'на доработке' || status === 'требует доработки';
    return `<div class="timeline-row ${done?'done':''} ${review?'review':''} ${revision?'revision':''}"><span>${esc(label)}</span><b>${esc(status)}</b><em>${date ? shortDate(date) : (stage==='homeworkVerified' && hw==='review' ? 'ожидает' : '—')}</em></div>`;
  }).join('')}</div>`);
}
async function renderHomework(){
  const lesson = await loadLesson(state.selectedLessonCode);
  const code = state.selectedLessonCode;
  const activityKey = lesson.activityKey || state.selectedActivityKey;
  const hwState = homeworkStateV24(code);
  if (!isAdminMode() && !(isStageDone(code, 'books') || hwState === 'revision' || hwState === 'review' || hwState === 'verified')) {
    shell(`${card('blue-card-v2', `<h1>Домашнее задание пока закрыто</h1><p>Домашнее задание открывается после информационной части, теста и саммари.</p>`)}${card('', `${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>` )}`,'homework');
    return;
  }
  if (hwState === 'none' && isStageDone(code, 'books')) await remoteSave('homework_started',{});
  const hw = lesson.homework || {};
  const tableButton = hw.buttonLabel || 'Получить шаблон таблицы ДЗ';
  const defaultInstruction = `<h3>Практическая часть урока</h3><p>Заполните прикреплённый шаблон по фактическим данным своего бизнеса. Главная цель — увидеть первичное ограничение, сформулировать действие на 7 дней и выбрать метрику проверки.</p>`;
  const instruction = cleanStudentHtml(hw.instructionHtml || defaultInstruction);
  const notice = homeworkReviewNoticeHtml(code);
  const actionLabel = hwState === 'revision' ? 'Я отправил доработанное ДЗ' : 'Я отправил ДЗ';
  const submitButton = hwState === 'verified'
    ? ''
    : actionButton(actionLabel,'markHomeworkSubmitted()','primary');
  shell(`${card('blue-card-v2', `<h1>${esc(hw.title || 'Домашнее задание')}</h1><p>Практическая часть урока. Здесь материал переносится в реальные цифры и управленческий вывод.</p>`)}${notice}${card('', `${instruction}<div class="grid-v2">${externalButton(tableButton,homeworkSheetUrl(code, hw),'primary')}${externalButton('Открыть форму сдачи',hw.submitFormUrl||'#','secondary')}${submitButton}${actionButton('← Вернуться к уроку','renderLessonHub()','secondary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}${isAdminMode()?card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`):''}`,'homework');
}
function renderHomeworkStatus(){
  const code = state.selectedLessonCode;
  const meta = getLessonMeta(code);
  const activityKey = meta ? meta.activityKey : state.selectedActivityKey;
  const hw = homeworkStateV24(code);
  const comment = homeworkCommentV25(code);
  const statusText = hw === 'verified' ? 'Домашнее задание принято' : (hw === 'revision' ? 'Домашнее задание требует доработки' : (hw === 'review' ? 'Домашнее задание на проверке' : 'Домашнее задание пока не отправлено'));
  const detail = hw === 'verified'
    ? `Проверка завершена ${shortDate(stageCompletedDate(code,'homeworkVerified'))}. Урок засчитан.${comment ? '\n\nКомментарий: ' + comment : ''}`
    : (hw === 'revision' ? (comment || 'Уточните вывод, показатель или действие на 7 дней и отправьте работу повторно.') : (hw === 'review' ? `Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки откроется следующий шаг или появится комментарий на доработку.` : 'Откройте домашнее задание, заполните шаблон и отправьте форму на проверку.'));
  shell(`${card('blue-card-v2', `<h1>${esc(statusText)}</h1><p>${esc(detail).replace(/\n/g,'<br>')}</p>`)}${lessonTimelineHtml(code)}${card('', `${hw === 'revision' ? actionButton('Открыть ДЗ для доработки','renderHomework()','primary') : actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button>`)}`,'homework');
}
function renderHomeworkCenter(){
  const visibleLessons = (state.catalog.lessons || []).filter(l=>canOpenLesson(l) || isStageDone(l.code,'homeworkSubmitted') || homeworkStateV24(l.code) !== 'none').slice(0,60);
  shell(`${card('blue-card-v2', `<h1>Домашние задания</h1><p>Здесь отображаются задания по открытым урокам и статусы проверки.</p>`)}${card('', `<div class="lesson-list-v2">${visibleLessons.map(l=>{
    const hw = homeworkStateV24(l.code);
    const ready = isAdminMode() || isStageDone(l.code,'books') || hw !== 'none';
    const status = homeworkStateLabelV25(l.code);
    const comment = hw === 'revision' ? homeworkCommentV25(l.code) : '';
    return `<button class="lesson-row-v2 ${ready?'':'locked'}" onclick="openLesson('${l.code}').then(()=>${ready?'renderHomework()':'renderLessonHub()'})"><div><b>${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${esc(status)}${comment ? ' · комментарий есть' : ''}</p></div><span>${ready?'→':'🔒'}</span></button>`;
  }).join('')}</div>`)}`,'homework');
}
function studentHomeworkAlertCardV25(){
  if (isAdminMode() || !state.catalog) return '';
  const lessons = state.catalog.lessons || [];
  const revision = lessons.find(l => homeworkStateV24(l.code) === 'revision');
  const review = lessons.find(l => homeworkStateV24(l.code) === 'review');
  const meta = revision || review;
  if (!meta) return '';
  const stateKey = homeworkStateV24(meta.code);
  const comment = homeworkCommentV25(meta.code);
  const title = stateKey === 'revision' ? 'ДЗ вернулось на доработку' : 'ДЗ находится на проверке';
  const text = stateKey === 'revision'
    ? (comment || 'Откройте домашнее задание, уточните вывод и отправьте работу повторно.')
    : 'Работа отправлена. После проверки появится статус и комментарий.';
  return card(stateKey === 'revision' ? 'homework-alert-card revision' : 'homework-alert-card', `<h2>${esc(title)}</h2><p><b>${esc(meta.activityTitle)} · ${esc(meta.title)}</b></p><p>${esc(text)}</p><button class="btn primary" onclick="openLesson('${meta.code}').then(()=>renderHomeworkStatus())">Открыть статус ДЗ</button>`);
}
function renderHome() {
  const gp = globalStageProgress();
  const points = totalPoints();
  const html = `
    ${card('hero-dashboard main-dashboard-card merged-dashboard-card v16-dashboard-card', `
      <div class="v16-dashboard-head">
        <div class="v16-dashboard-copy">
          <div class="eyebrow-row"><p class="eyebrow">общая система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">инструкция</button></div>
          <h1>Ваш прогресс</h1>
          <p>Прогресс считается по готовым урокам и их этапам: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="dashboard-mini-grid dashboard-mini-grid-compact v16-mini-grid">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Достижение</span><b>${esc(studentTitleInfo().current.title)}</b></div>
      </div>
      ${achievementInlineHtml()}
      ${globalInstructionPanelHtml()}
    `)}
    ${studentHomeworkAlertCardV25()}
    ${safeActiveChallengeCardHtmlV24()}
    ${card('', `<h2>Выбрать блок</h2><p>Выберите направление работы внутри платформы.</p>
      <div class="top-track-grid main-track-grid-v22">
        ${renderMainBlockCard('Нет своего бизнеса','Базовый маршрут для подготовки к предпринимательскому мышлению и запуску.','скоро','','disabled main-block-card')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active main-block-card')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled main-block-card')}
      </div>
      <div class="secondary-track-grid-v22">
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневный челлендж: одна книга, 24 часа, мини-тест, +1 учебная единица и баллы серии.','доступно','renderBookChallenge()','active books100-entry compact-card')}
        ${renderMainBlockCard('Бизнес-факты','Короткие практические статьи о реальных бизнес-ситуациях: ошибки, решения, цифры и выводы, которые можно применить в своей системе.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('Дополнительные материалы','Отдельные уроки, разборы и материалы, которые дополняют основной маршрут.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('VIP уровень','Более подробные разборы, инструменты и активность.','в разработке','','disabled compact-card')}
        ${renderMainBlockCard('Бизнес-медиа','Подборки фильмов, сериалов, интервью и полезных видео о бизнесе с управленческими выводами для практики.','скоро','','disabled compact-card compact-card-wide')}
        ${isAdminMode() ? renderMainBlockCard('Бизнес-форум','Практические вопросы, обсуждения и обмен опытом участников по видам деятельности.','тестирование','renderBusinessForum()','active compact-card compact-card-wide') : ''}
      </div>`)}
  `;
  shell(html, 'home');
}
function adminLessonOptionsV25(){
  return (state.catalog?.lessons || []).map(l => `<option value="${esc(l.code)}" ${l.code===state.selectedLessonCode?'selected':''}>${esc(l.code)} · ${esc(l.activityTitle)} · ${esc(l.title)}</option>`).join('');
}
function renderAdmin(){
  if(!isAdminUser()){ alert('Нет прав Босса Л.Е.Г.О.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель Босса Л.Е.Г.О</h1><p>Проверка ДЗ теперь привязана к конкретному уроку. Сначала найдите работы ученика или выберите урок вручную.</p>`)}
    ${card('', `<h2>Проверка ДЗ</h2><p class="small">Комментарий сохраняется внутри статуса ДЗ. Telegram-сообщение ученику появится только после отдельного подключения бота уведомлений.</p><input id="admin-target-user" placeholder="Telegram ID или username ученика"><select id="admin-lesson-code" class="admin-select-v25">${adminLessonOptionsV25()}</select><textarea id="admin-review-comment" placeholder="Комментарий проверяющего. Для доработки обязателен."></textarea><div class="grid-v2"><button class="btn secondary" onclick="adminLoadHomeworkQueueV25()">Найти ДЗ ученика</button><button class="btn secondary" onclick="adminLoadHomeworkQueueV25('all')">Показать все ДЗ на проверке</button><button class="btn primary" onclick="adminReviewManualV25('approve_homework')">Принять выбранный урок</button><button class="btn secondary" onclick="adminReviewManualV25('reject_homework')">Вернуть выбранный урок на доработку</button></div><div id="admin-homework-queue" class="admin-homework-queue-v25"></div>`) }
    ${card('', `<h2>100 книг за 100 дней</h2><p>Можно восстановить зачёты из успешных попыток теста, если после обновлений часть статусов стала отображаться неверно.</p><div class="grid-v2"><button class="btn primary" onclick="books100AdminRepairAllV25()">Проверить и восстановить зачёты книг</button><button class="btn secondary" onclick="renderBookChallenge()">Открыть книги челленджа</button></div>`)}
    ${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}`,'profile');
}
async function adminApiV25(payload){
  if(!tg || !tg.initData) throw new Error('Админ-проверка работает только внутри Telegram WebApp.');
  const res = await fetch(ADMIN_REVIEW_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({ initData: tg.initData }, payload || {})) });
  const out = await res.json().catch(()=>({}));
  if(!res.ok || !out.ok) throw new Error(out.reason || out.details || out.error || 'ADMIN_REVIEW_FAILED');
  return out;
}
async function adminLoadHomeworkQueueV25(mode){
  const box = $('admin-homework-queue');
  if(box) box.innerHTML = '<p class="small">Загружаем список ДЗ...</p>';
  try{
    const target = mode === 'all' ? '' : ($('admin-target-user')?.value || '').trim();
    const out = await adminApiV25({ action:'list_homework', targetUser: target });
    if(!box) return;
    const rows = out.rows || [];
    if(!rows.length){ box.innerHTML = '<div class="empty-admin-v25"><b>ДЗ не найдено</b><p>Проверьте Telegram ID / username или попросите ученика открыть приложение хотя бы один раз.</p></div>'; return; }
    box.innerHTML = `<h3>Найденные домашние задания</h3>${rows.map(adminHomeworkRowHtmlV25).join('')}`;
  }catch(e){ if(box) box.innerHTML = `<div class="empty-admin-v25 error"><b>Ошибка загрузки</b><p>${esc(e.message||e)}</p></div>`; }
}
function adminHomeworkRowHtmlV25(row){
  const lesson = row.lesson || {}; const target = row.target || {};
  const name = target.first_name || target.username || target.telegram_id || 'ученик';
  const code = lesson.code || '';
  const title = lesson.title || 'урок';
  const comment = row.admin_review_comment || '';
  return `<div class="admin-homework-row-v25"><div><b>${esc(name)} · ${esc(code)}</b><p>${esc(title)} · ${esc(row.status_label || row.status || 'статус не указан')}</p><p class="small">Отправлено: ${row.homework_submitted_at ? shortDate(row.homework_submitted_at) : '—'}${comment ? ' · комментарий: ' + esc(comment) : ''}</p></div><div class="grid-v2"><button class="btn primary" onclick="adminReviewProgressV25('approve_homework','${esc(row.progress_id)}','${esc(code)}')">Принять это ДЗ</button><button class="btn secondary" onclick="adminReviewProgressV25('reject_homework','${esc(row.progress_id)}','${esc(code)}')">Вернуть это ДЗ</button></div></div>`;
}
async function adminReviewProgressV25(action, progressId, lessonCode){
  const comment = $('admin-review-comment')?.value.trim() || '';
  if(action === 'reject_homework' && !comment){ alert('Для доработки нужен комментарий.'); return; }
  if(!confirm(action === 'approve_homework' ? `Принять ДЗ ${lessonCode}?` : `Вернуть ДЗ ${lessonCode} на доработку?`)) return;
  try{
    const out = await adminApiV25({ action, progressId, comment, homeworkScore:70 });
    alert((action === 'approve_homework' ? 'ДЗ принято. ' : 'ДЗ отправлено на доработку. ') + 'Комментарий будет виден ученику внутри статуса ДЗ после синхронизации приложения.');
    adminLoadHomeworkQueueV25($('admin-target-user')?.value.trim() ? undefined : 'all');
  }catch(e){ alert('Ошибка: ' + (e.message||e)); }
}
async function adminReviewManualV25(action){
  const target = $('admin-target-user')?.value.trim();
  const lessonCode = $('admin-lesson-code')?.value || state.selectedLessonCode;
  const comment = $('admin-review-comment')?.value.trim() || '';
  if(!target){ alert('Укажите Telegram ID или username ученика.'); return; }
  if(!lessonCode){ alert('Выберите урок.'); return; }
  if(action === 'reject_homework' && !comment){ alert('Для доработки нужен комментарий.'); return; }
  if(!confirm(action === 'approve_homework' ? `Принять ДЗ ученика по уроку ${lessonCode}?` : `Вернуть ДЗ ученика по уроку ${lessonCode} на доработку?`)) return;
  try{
    await adminApiV25({ action, targetUser:target, lessonCode, comment, homeworkScore:70 });
    alert((action === 'approve_homework' ? 'ДЗ принято. ' : 'ДЗ отправлено на доработку. ') + 'Проверьте список ДЗ ученика.');
    adminLoadHomeworkQueueV25();
  }catch(e){ alert('Ошибка: ' + (e.message||e)); }
}
async function books100AdminRepairAllV25(){
  if(!isAdminMode()) return alert('Доступно только в режиме Босса Л.Е.Г.О.');
  if(!confirm('Проверить все зачёты книг и восстановить статусы из успешных попыток теста?')) return;
  try{
    const index = await loadBooks100Index();
    const out = await books100ApiV20('admin_repair_all', { books: books100BooksPayloadV18(index) }, { timeoutMs: 30000 });
    alert(`Проверено пользователей: ${out.usersChecked || 0}. Исправлено: ${out.repairedUsers || 0}.`);
  }catch(e){ alert('Ошибка восстановления книг: ' + (e.message||e)); }
}

/* =====================================================
   v26 — construction BD-01 ready, singular lesson assets, final overrides
   ===================================================== */
function contentVersionV24() {
  return "v31-books100-16-20-deep-rewrite-20260609";
}
function appStableVersionV24(){
  return "v31-books100-16-20-deep-rewrite-20260609";
}
function readyFirstLessonCodesV24(){
  return ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"];
}
function isLessonPrepared(meta) {
  if (!meta) return false;
  if (readyFirstLessonCodesV24().includes(meta.code)) return true;
  if (Number(meta.number) === 1) return false;
  return String(meta.status || "").toLowerCase() === "ready";
}
function normalizeLessonAssetPath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;
  return raw.replace(/^assets\/lessons\//, "assets/lesson/");
}
function mediaUrlV24(url) {
  const normalized = normalizeLessonAssetPath(url);
  if (!normalized) return "";
  return normalized + (normalized.indexOf("?") >= 0 ? "&" : "?") + "v=" + contentVersionV24();
}
function lessonImageFallback(label, current) {
  const n = String(current).padStart(2, "0");
  const idx = Number(current);

  if (state.selectedLessonCode === "ENT-TR-01") return legacyTradeImage(label, current);

  if (state.selectedLessonCode === "ENT-SV-01") {
    if (label === "Слайд") return `assets/lesson/services/01/slides/slide_${n}.png`;
    if (label === "Саммари") {
      if (idx >= 1 && idx <= 5) return `assets/lesson/services/01/books/book1_${String(idx).padStart(2,"0")}.png`;
      if (idx >= 6 && idx <= 10) return `assets/lesson/services/01/books/book2_${String(idx-5).padStart(2,"0")}.png`;
      if (idx >= 11 && idx <= 15) return `assets/lesson/services/01/books/book3_${String(idx-10).padStart(2,"0")}.png`;
      if (idx >= 16 && idx <= 20) return `assets/lesson/services/01/books/book4_${String(idx-15).padStart(2,"0")}.png`;
      if (idx >= 21 && idx <= 25) return `assets/lesson/services/01/books/book5_${String(idx-20).padStart(2,"0")}.png`;
      if (idx === 26) return `assets/lesson/services/01/books/final_summary.png`;
    }
  }

  if (state.selectedLessonCode === "ENT-BD-01") {
    if (label === "Слайд") return `assets/lesson/construction/01/slides/slide_${n}.png`;
    if (label === "Саммари") {
      if (idx >= 1 && idx <= 5) return `assets/lesson/construction/01/books/book1_${String(idx).padStart(2,"0")}.png`;
      if (idx >= 6 && idx <= 10) return `assets/lesson/construction/01/books/book2_${String(idx-5).padStart(2,"0")}.png`;
      if (idx >= 11 && idx <= 15) return `assets/lesson/construction/01/books/book3_${String(idx-10).padStart(2,"0")}.png`;
      if (idx >= 16 && idx <= 20) return `assets/lesson/construction/01/books/book4_${String(idx-15).padStart(2,"0")}.png`;
      if (idx >= 21 && idx <= 25) return `assets/lesson/construction/01/books/book5_${String(idx-20).padStart(2,"0")}.png`;
      if (idx === 26) return `assets/lesson/construction/01/books/final_summary.png`;
    }
  }

  return null;
}
function handleImageError(img) {
  if (!img) return;
  if (img.dataset && img.dataset.fallbackUsed !== "1") {
    const fallback = normalizeLessonAssetPath(lessonImageFallback(img.dataset.label, Number(img.dataset.index)) || "");
    if (fallback && img.src.indexOf(fallback) === -1) {
      img.dataset.fallbackUsed = "1";
      img.src = mediaUrlV24(fallback);
      return;
    }
    const original = normalizeLessonAssetPath(img.dataset.originalSrc || "");
    if (original && img.src.indexOf(original) === -1) {
      img.dataset.fallbackUsed = "1";
      img.src = mediaUrlV24(original);
      return;
    }
  }
  img.style.display = "none";
  const fallbackBox = img.nextElementSibling;
  if (fallbackBox) fallbackBox.style.display = "flex";
}
function mediaScreen(image,label,current,total,html){
  const fallback = lessonImageFallback(label, current);
  const src = normalizeLessonAssetPath(image || fallback || "");
  const imageHtml = src
    ? `<img src="${mediaUrlV24(src)}" data-original-src="${esc(src)}" data-label="${esc(label)}" data-index="${Number(current)}" onerror="handleImageError(this)">`
    : `<img src="" data-label="${esc(label)}" data-index="${Number(current)}" style="display:none" onerror="handleImageError(this)">`;
  return `<div class="media-counter">${esc(label)}: ${Number(current)}/${Number(total)}</div><div class="media-box-v2">${imageHtml}<div class="image-missing-v2" style="display:none"><b>${esc(label)} ${Number(current)}</b><p>Иллюстрация в подготовке.</p></div></div><section class="slide-text-v2">${cleanStudentHtml(html)}</section>`;
}
function preloadImage(src) {
  const normalized = normalizeLessonAssetPath(src);
  if (!normalized) return;
  try { const img = new Image(); img.src = mediaUrlV24(normalized); } catch(e) {}
}
function mediaSrcFor(label, index, lesson) {
  if (!lesson) return normalizeLessonAssetPath(lessonImageFallback(label, index));
  if (label === "Слайд") return normalizeLessonAssetPath(lesson.slides?.[index-1]?.image || lessonImageFallback(label, index));
  if (label === "Саммари") return normalizeLessonAssetPath(lesson.bookScreens?.[index-1]?.image || lessonImageFallback(label, index));
  return normalizeLessonAssetPath(lessonImageFallback(label, index));
}



/* =====================================================
   v32 — hard access gate fix
   Причина: при открытии через обычную GitHub-ссылку экран "Доступ закрыт"
   показывался, но нижняя навигация позволяла перейти в уроки/ДЗ/профиль.
   Исправление: до успешной проверки Telegram initData и доступа каналов
   приложение не показывает нижнее меню и блокирует все внутренние экраны.
   ===================================================== */

function hasVerifiedAccessV32() {
  return Boolean(state && state.access === true);
}

function accessDeniedTitleV32(reason) {
  if (reason === "OPEN_FROM_TELEGRAM_REQUIRED") return "Откройте приложение из Telegram";
  if (reason === "ACCESS_DENIED") return "Доступ закрыт";
  if (reason === "CHECK_ACCESS_ERROR") return "Проверка доступа не выполнена";
  return "Доступ закрыт";
}

function accessDeniedTextV32(reason) {
  if (reason === "OPEN_FROM_TELEGRAM_REQUIRED") {
    return "Система не получила Telegram-данные для проверки. Откройте Л.Е.Г.О через кнопку в Telegram-боте или через закреплённое сообщение в закрытом канале.";
  }
  return "Приложение доступно только участникам закрытого Telegram-канала. Если подписка активна, откройте приложение заново из Telegram.";
}

function accessDenied(reason) {
  try {
    state.access = false;
    state.accessReason = reason || "ACCESS_DENIED";
  } catch(e) {}

  const root = $("app");
  if (!root) return;

  const telegramLink = "https://t.me/Lego_bisiness_system_bot?startapp";
  root.innerHTML = `
    <div class="app-shell-v2 access-locked-shell">
      <header class="app-header-v2">
        ${typeof brandLogoHtml === "function" ? brandLogoHtml(false) : `<div><div class="brand-logo">Л.Е.Г.О.</div><div class="brand-subtitle">система внедрения управленческих изменений</div></div>`}
      </header>
      <main class="content-v2">
        <section class="card-v2 result-bad-v2">
          <h1>${esc(accessDeniedTitleV32(reason))}</h1>
          <p>${esc(accessDeniedTextV32(reason))}</p>
          <p class="small">Причина: <b>${esc(reason || "ACCESS_DENIED")}</b></p>
          <a class="btn primary" href="${telegramLink}">Открыть через Telegram</a>
        </section>
      </main>
    </div>`;
}

function shell(content, activeTab) {
  const root = $("app");
  if (!root) return;

  const allowNav = hasVerifiedAccessV32();
  const modeButton = allowNav && isAdminUser()
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Босс" : "Режим ученика"}</button>`
    : "";

  root.innerHTML = `
    <div class="app-shell-v2 ${allowNav ? "" : "access-pending-shell"}">
      <header class="app-header-v2">
        ${typeof brandLogoHtml === "function" ? brandLogoHtml(false) : `<div><div class="brand-logo">Л.Е.Г.О.</div><div class="brand-subtitle">система внедрения управленческих изменений</div></div>`}
        ${modeButton}
      </header>
      <main class="content-v2">${content}</main>
      ${allowNav ? bottomNav(activeTab || "home") : ""}
    </div>`;
}

function bottomNav(active) {
  if (!hasVerifiedAccessV32()) return "";
  const item = (key,label,icon,fn)=>`<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn.replace("()","")}')"><span>${icon}</span><b>${label}</b></button>`;
  return `<nav class="bottom-nav-v2 bottom-nav-v2-four">
    ${item('home','Главная','⌂','renderHome()')}
    ${item('learning','Уроки','▣','renderLearning()')}
    ${item('homework','ДЗ','✓','renderHomeworkCenter()')}
    ${item('profile','Профиль','○','renderProfile()')}
  </nav>`;
}

function safeNavigateV32(fnName) {
  if (!hasVerifiedAccessV32()) {
    accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    return;
  }
  const fn = window[fnName];
  if (typeof fn === "function") return fn();
}

async function checkAccess() {
  try {
    state.access = false;
    state.accessReason = null;
  } catch(e) {}

  shell(card('blue-card-v2', '<h1>Проверяем доступ</h1><p>Проверяем запуск из Telegram и доступ к закрытому каналу.</p>'), 'home');

  if (!tg || !tg.initData) {
    accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    return;
  }

  try {
    const response = await fetch(CHECK_ACCESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.access) {
      accessDenied(result.reason || "ACCESS_DENIED");
      return;
    }

    state.access = true;
    state.accessReason = result.reason || "ACCESS_GRANTED";
    state.user = result.user || null;
    state.role = result.user?.role || 'student';

    if (!isAdminUser()) {
      state.appMode = 'student';
      localStorage.setItem('lego_app_mode', 'student');
    }

    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if (result.progress && result.lesson && result.lesson.code) {
      state.remoteProgressByLesson[result.lesson.code] = result.progress;
    }

    if (isAdminUser() && !localStorage.getItem('lego_app_mode')) {
      state.appMode = 'admin';
    }

    await loadCatalog();
    renderHome();

  } catch(e) {
    console.error(e);
    accessDenied("CHECK_ACCESS_ERROR");
  }
}

/* =====================================================
   v38 — безопасный флаг публикации Бизнес-форума
   false: форум виден только в режиме администратора;
   true: форум можно показывать ученикам (после финального теста и включения Supabase).
   ===================================================== */
window.FORUM_PUBLIC_UI_V38 = false;
function forumVisibleInNavigationV38(){
  return Boolean(window.FORUM_PUBLIC_UI_V38 === true || (typeof isAdminMode === 'function' && isAdminMode()));
}

/* =====================================================
   v36 — АРХИТЕКТУРА admin preview theme
   Включение одним из двух способов:
   1) ?ui=architecture в URL приложения;
   2) запуск Mini App из Telegram с startapp=architecture.
   Вся Supabase-логика, Telegram-доступ, прогресс и localStorage-ключи
   остаются без изменений. Меняется только видимая оболочка.
   ===================================================== */

var ARCHITECTURE_UI_V35 = (function(){
  try {
    var query = new URLSearchParams(window.location.search || '');
    var hashText = String(window.location.hash || '').replace(/^#/, '');
    var hash = new URLSearchParams(hashText);
    var tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : {};
    var startParam = tg && tg.initDataUnsafe ? String(tg.initDataUnsafe.start_param || '') : '';

    var forcedLegacy = [query.get('ui'), hash.get('ui')].some(function(value){
      return String(value || '').toLowerCase() === 'legacy';
    });
    if (forcedLegacy) return false;

    var previewValues = [
      query.get('ui'),
      query.get('startapp'),
      query.get('tgWebAppStartParam'),
      hash.get('ui'),
      hash.get('startapp'),
      hash.get('tgWebAppStartParam'),
      startParam
    ].map(function(value){ return String(value || '').toLowerCase(); });

    var byPreviewParam = previewValues.includes('architecture');
    var byAdminId = ['1762603232'].includes(String(tgUser.id || ''));
    var byAdminUsername = ['prosvewenie2000'].includes(String(tgUser.username || '').replace('@','').toLowerCase());

    // Надёжный предпросмотр: у владельца новая оболочка включается автоматически,
    // даже если Telegram не передал startapp-параметр. Обычные ученики продолжают
    // видеть прежнюю версию до общего запуска.
    return byPreviewParam || byAdminId || byAdminUsername;
  }
  catch(e) { return false; }
})();

function architectureModeV35(){ return Boolean(ARCHITECTURE_UI_V35); }

if (architectureModeV35()) {
  document.documentElement.classList.add('theme-architecture');
  document.documentElement.setAttribute('data-ui-version','architecture-v36');
  document.title = 'АРХИТЕКТУРА — Библиотека бизнес-систем';
  try {
    var themeMetaV35 = document.querySelector('meta[name="theme-color"]');
    if (!themeMetaV35) {
      themeMetaV35 = document.createElement('meta');
      themeMetaV35.name = 'theme-color';
      document.head.appendChild(themeMetaV35);
    }
    themeMetaV35.content = '#F7F4ED';
  } catch(e) {}
}

function architectureAssetV35(name){
  return 'assets/brand/' + name + '?v=v38-forum-safe-20260624';
}

function architectureBrandLogoHtmlV35(compact){
  var logo = compact ? architectureAssetV35('architecture-mark.svg') : architectureAssetV35('architecture-logo.svg');
  return `<button class="brand-lockup architecture-brand ${compact ? 'compact' : ''}" onclick="renderHome()" aria-label="АРХИТЕКТУРА — на главную">
    <span class="brand-logo-plate">
      <img src="${logo}" alt="АРХИТЕКТУРА — Библиотека бизнес-систем" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <span class="brand-fallback" style="display:none"><b>АРХИТЕКТУРА</b><span>Библиотека бизнес-систем</span></span>
    </span>
  </button>`;
}

var legacyBrandLogoHtmlV35 = window.brandLogoHtml;
window.brandLogoHtml = function(compact){
  if (!architectureModeV35()) return legacyBrandLogoHtmlV35(compact);
  return architectureBrandLogoHtmlV35(Boolean(compact));
};

function architectureNavIconV35(key){
  var paths = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
    learning: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h7"/>',
    homework: '<path d="M7 3h10v3h3v15H4V6h3z"/><path d="m8 14 2.5 2.5L16 11"/>',
    forum: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.4-6 8-6s7.2 1.8 8 6"/>'
  };
  return `<svg class="arch-nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[key] || paths.home}</svg>`;
}

var legacyBottomNavV35 = window.bottomNav;
window.bottomNav = function(active){
  if (!architectureModeV35()) return legacyBottomNavV35(active);
  if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) return '';
  function item(key,label,fn){
    return `<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn}')"><span class="arch-nav-icon">${architectureNavIconV35(key)}</span><b>${label}</b></button>`;
  }
  var showForum = forumVisibleInNavigationV38();
  return `<nav class="bottom-nav-v2 ${showForum ? 'bottom-nav-v2-five' : 'bottom-nav-v2-four'}" aria-label="Основное меню">
    ${item('home','Главная','renderHome')}
    ${item('learning','Обучение','renderLearning')}
    ${item('homework','ДЗ','renderHomeworkCenter')}
    ${showForum ? item('forum','Форум','renderBusinessForum') : ''}
    ${item('profile','Профиль','renderProfile')}
  </nav>`;
};

function architectureBlockIconV35(title){
  var t = String(title || '').toLowerCase();
  var body = '<path d="M5 19h14M7 16l3-4 3 2 4-7"/><circle cx="17" cy="7" r="2"/>';
  if (t.includes('нет своего')) body = '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2M12 2v2M22 12h-2M4 12H2"/>';
  else if (t.includes('сотрудник')) body = '<circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s5 2 5.5 6M13 15c3.8-.5 6.2 1.2 7 5"/>';
  else if (t.includes('100 книг')) body = '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h7"/>';
  else if (t.includes('форум')) body = '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>';
  else if (t.includes('дополнитель')) body = '<path d="M3 7h7l2 2h9v11H3z"/><path d="M8 13h8M12 9v8"/>';
  else if (t.includes('бизнес-факты')) body = '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h6"/>';
  else if (t.includes('vip')) body = '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
  else if (t.includes('медиа')) body = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

var legacyRenderMainBlockCardV35 = window.renderMainBlockCard;
window.renderMainBlockCard = function(title,text,status,action,cls){
  if (!architectureModeV35()) return legacyRenderMainBlockCardV35(title,text,status,action,cls);
  var clickable = Boolean(action);
  return `<button class="track-card architecture-track-card ${cls || ''} ${clickable ? '' : 'disabled'}" ${clickable ? `onclick="${action}"` : 'disabled'}>
    <span class="track-card-icon">${architectureBlockIconV35(title)}</span>
    <span class="track-card-copy"><b>${esc(title)}</b><p>${esc(text)}</p></span>
    <em>${esc(status)}</em><span class="track-card-arrow">${clickable ? '›' : '·'}</span>
  </button>`;
};

function architectureActivityIconV35(key){
  var map = { trade:'₽', services:'✓', production:'⚙', construction:'▥', logistics:'→', horeca:'◫' };
  return map[key] || '•';
}

var legacyRenderLearningV35 = window.renderLearning;
window.renderLearning = function(){
  if (!architectureModeV35()) return legacyRenderLearningV35();
  var html = `
    ${card('blue-card-v2 architecture-section-head', `<p class="eyebrow">маршрут собственника</p><h1>Я предприниматель</h1><p>Выберите вид деятельности. Внутри каждого направления — последовательный путь из уроков, тестов, саммари и практических заданий.</p>${isAdminMode() ? '<p class="small admin-note">Режим администратора: доступны все подготовленные материалы.</p>' : ''}`)}
    ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
    <div class="activity-grid-v2 architecture-activity-grid">
      ${(state.catalog?.activities || []).map(function(a){
        var info = getActivityProgressInfo(a.key);
        var cardText = String(a.description || a.chain || activityIntroText(a)).trim();
        var available = isAdminMode() || Number(info.readyCount || 0) > 0;
        var readyText = available ? `${info.openCount} из ${info.lessons.length} уроков доступно` : 'в подготовке';
        return `<button class="activity-card-v2 ${a.key===state.selectedActivityKey?'active':''} ${available?'':'locked'}" ${available?`onclick="renderActivityLessons('${a.key}')"`:'disabled'}>
          <span class="activity-line-icon">${architectureActivityIconV35(a.key)}</span>
          <b>${esc(a.title)}</b>
          <small>${esc(cardText)}</small>
          <em>${esc(readyText)}</em>
        </button>`;
      }).join('')}
    </div>`;
  shell(html, 'learning');
};

var legacyStageCardV35 = window.stageCard;
window.stageCard = function(key,title,note,done,action,locked,extraCls){
  if (!architectureModeV35()) return legacyStageCardV35.apply(this, arguments);
  var order = { presentation:'01', quiz:'02', books:'03', homework:'04' };
  return `<button class="stage-card-v2 stage-${esc(key)} ${done?'done':''} ${locked?'locked':''} ${extraCls||''}" onclick="${locked?'alert(\'Этап пока закрыт.\')':action}">
    <span class="stage-number">${order[key] || '•'}</span>
    <span class="stage-copy"><b>${esc(title)}</b><p>${esc(note)}</p></span>
    <span class="stage-state">${done?'✓':(locked?'🔒':'›')}</span>
  </button>`;
};

var legacyRenderHomeV35 = window.renderHome;
window.renderHome = function(){
  if (!architectureModeV35()) return legacyRenderHomeV35();
  var gp = globalStageProgress();
  var points = totalPoints();
  var titleInfo = studentTitleInfo();
  var html = `
    ${card('hero-dashboard main-dashboard-card architecture-dashboard', `
      <div class="architecture-dashboard-head">
        <div>
          <div class="eyebrow-row"><p class="eyebrow">ваша система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button></div>
          <h1>Общий прогресс</h1>
          <p>Учитываются только завершённые этапы готовых уроков: презентация, тест, саммари и принятое домашнее задание.</p>
        </div>
        ${compactProgressRing(gp.percent)}
      </div>
      <div class="architecture-metrics">
        <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
        <div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div>
        <div><span>Достижение</span><b>${esc(titleInfo.current.title)}</b></div>
      </div>
      ${globalInstructionPanelHtml()}
    `)}
    ${typeof studentHomeworkAlertCardV25 === 'function' ? studentHomeworkAlertCardV25() : ''}
    ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
    ${card('architecture-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">основные маршруты</p><h2>Выберите блок</h2></div><p>Открывайте только тот раздел, с которым работаете сейчас.</p></div>
      <div class="top-track-grid main-track-grid-v22 architecture-main-tracks">
        ${renderMainBlockCard('Нет своего бизнеса','Подготовка к запуску и базовое предпринимательское мышление.','скоро','','disabled main-block-card')}
        ${renderMainBlockCard('Я предприниматель','Диагностика, уроки, ДЗ, проверка и управленческие действия.','доступно','renderLearning()','active main-block-card')}
        ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','','disabled main-block-card')}
      </div>
      <div class="secondary-track-grid-v22 architecture-secondary-tracks">
        ${renderMainBlockCard('100 книг за 100 дней','Ежедневная книга, мини-тест, учебные единицы и серия баллов.','доступно','renderBookChallenge()','active books100-entry compact-card')}
        ${forumVisibleInNavigationV38() ? renderMainBlockCard('Бизнес-форум','Практические вопросы и обмен опытом по видам деятельности.','тестирование','renderBusinessForum()','active compact-card') : ''}
        ${renderMainBlockCard('Бизнес-факты','Короткие практические статьи о реальных бизнес-ситуациях.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('Дополнительные материалы','Разборы, шаблоны и материалы вне основного маршрута.','скоро','','disabled compact-card')}
        ${renderMainBlockCard('VIP уровень','Расширенные разборы и дополнительные возможности.','в разработке','','disabled compact-card')}
        ${renderMainBlockCard('Бизнес-медиа','Фильмы, интервью и видео с управленческими выводами.','скоро','','disabled compact-card')}
      </div>`)}
  `;
  shell(html, 'home');
};

var legacyAdminLabelV35 = window.adminLabel;
window.adminLabel = function(){ return architectureModeV35() ? 'Администратор' : legacyAdminLabelV35(); };
var legacyStudentRoleLabelV35 = window.studentRoleLabel;
window.studentRoleLabel = function(){ return architectureModeV35() ? (isAdminUser() ? 'Администратор' : 'Участник') : legacyStudentRoleLabelV35(); };
try {
  if (architectureModeV35() && typeof LEGO_LEVELS !== 'undefined' && LEGO_LEVELS.length) {
    LEGO_LEVELS[LEGO_LEVELS.length - 1].title = 'Мастер системного управления';
  }
} catch(e) {}

var legacyAccessDeniedTitleV35 = window.accessDeniedTitleV32;
window.accessDeniedTitleV32 = function(reason){
  if (!architectureModeV35()) return legacyAccessDeniedTitleV35(reason);
  if (reason === 'OPEN_FROM_TELEGRAM_REQUIRED') return 'Откройте приложение из Telegram';
  if (reason === 'CHECK_ACCESS_ERROR') return 'Проверка доступа не выполнена';
  return 'Доступ не подтверждён';
};
var legacyAccessDeniedTextV35 = window.accessDeniedTextV32;
window.accessDeniedTextV32 = function(reason){
  if (!architectureModeV35()) return legacyAccessDeniedTextV35(reason);
  if (reason === 'OPEN_FROM_TELEGRAM_REQUIRED') return 'Система не получила Telegram-данные. Откройте «АРХИТЕКТУРУ» через кнопку Mini App в Telegram.';
  return 'Приложение доступно участникам закрытого Telegram-канала. При активной подписке закройте Mini App и откройте его заново.';
};

function architectureLoadingScreenV35(){
  var root = $('app');
  if (!root) return;
  root.innerHTML = `<div class="architecture-loading-screen">
    <div class="architecture-loading-brand"><img src="${architectureAssetV35('architecture-mark.svg')}" alt=""><h1>АРХИТЕКТУРА</h1><p>Библиотека бизнес-систем</p></div>
    <div class="architecture-loading-status"><span class="architecture-spinner"></span><b>Проверяем доступ</b><p>Подключаем ваш прогресс и материалы.</p></div>
  </div>`;
};

var legacyCheckAccessV35 = window.checkAccess;
window.checkAccess = async function(){
  if (!architectureModeV35()) return legacyCheckAccessV35();
  try { state.access = false; state.accessReason = null; } catch(e) {}
  architectureLoadingScreenV35();
  if (!tg || !tg.initData) { accessDenied('OPEN_FROM_TELEGRAM_REQUIRED'); return; }
  try {
    var response = await fetch(CHECK_ACCESS_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({initData:tg.initData}) });
    var result = await response.json().catch(function(){ return {}; });
    if (!response.ok || !result.access) { accessDenied(result.reason || 'ACCESS_DENIED'); return; }
    state.access = true;
    state.accessReason = result.reason || 'ACCESS_GRANTED';
    state.user = result.user || null;
    state.role = result.user?.role || 'student';
    if (!isAdminUser()) { state.appMode='student'; localStorage.setItem('lego_app_mode','student'); }
    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if (result.progress && result.lesson && result.lesson.code) state.remoteProgressByLesson[result.lesson.code] = result.progress;
    if (isAdminUser() && !localStorage.getItem('lego_app_mode')) state.appMode='admin';
    await loadCatalog();
    renderHome();
  } catch(e) {
    console.error(e);
    accessDenied('CHECK_ACCESS_ERROR');
  }
};

function architectureReplaceTextV35(value){
  var out = String(value || '');
  var pairs = [
    [/Панель Босса Л\.Е\.Г\.О\.?/g, 'Панель администратора'],
    [/Боссу Л\.Е\.Г\.О\.?/g, 'администратору'],
    [/Босса Л\.Е\.Г\.О\.?/g, 'администратора'],
    [/Босс Л\.Е\.Г\.О\.?/g, 'Администратор'],
    [/Ученик Л\.Е\.Г\.О\.?/g, 'Участник'],
    [/Мастер Л\.Е\.Г\.О\.?/g, 'Мастер системного управления'],
    [/Режим Босса/g, 'Режим администратора'],
    [/Боссу/g, 'администратору'],
    [/Босса/g, 'администратора'],
    [/Боссом/g, 'администратором'],
    [/Босс/g, 'Администратор'],
    [/Л\.Е\.Г\.О\./g, 'АРХИТЕКТУРА'],
    [/Л\.Е\.Г\.О/g, 'АРХИТЕКТУРА'],
    [/система внедрения управленческих изменений/gi, 'Библиотека бизнес-систем']
  ];
  pairs.forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
  return out;
}

function applyArchitectureTextV35(root){
  if (!architectureModeV35() || !root) return;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    var next = architectureReplaceTextV35(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  root.querySelectorAll('[alt],[aria-label],[title],[placeholder]').forEach(function(el){
    ['alt','aria-label','title','placeholder'].forEach(function(attr){
      if (!el.hasAttribute(attr)) return;
      var current = el.getAttribute(attr);
      var next = architectureReplaceTextV35(current);
      if (next !== current) el.setAttribute(attr,next);
    });
  });
}

function installArchitectureObserverV35(){
  if (!architectureModeV35() || !document.body || window.__architectureObserverV35) return;
  window.__architectureObserverV35 = new MutationObserver(function(records){
    records.forEach(function(record){
      record.addedNodes.forEach(function(node){ if (node.nodeType === 1) applyArchitectureTextV35(node); });
    });
  });
  window.__architectureObserverV35.observe(document.body,{childList:true,subtree:true});
  applyArchitectureTextV35(document.body);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installArchitectureObserverV35);
else installArchitectureObserverV35();



/* =====================================================
   v39 — открытые опубликованные уроки + самостоятельная практика

   Безопасная модель совместимости:
   1. Все подготовленные уроки доступны сразу.
   2. Четвёртый этап называется «Самостоятельная работа».
   3. Проверка администратором больше не требуется.
   4. Для сохранения на сервере используется уже существующее событие
      homework_submitted. Старые статусы submitted/revision/verified
      считаются выполненной самостоятельной работой.
   5. Таблицы Supabase и старые данные не удаляются.
   ===================================================== */
(function installOpenLessonsSelfStudyV39(){
  window.OPEN_ALL_READY_LESSONS_V39 = true;
  window.SELF_STUDY_MODE_V39 = true;

  function selfStudyReplaceTextV39(value){
    var out = String(value == null ? '' : value);
    var pairs = [
      [/ДЗ, проверка и управленческие действия/g, 'самостоятельная практика и управленческие действия'],
      [/принятое домашнее задание/g, 'выполненная самостоятельная работа'],
      [/принятое Домашнее задание/g, 'выполненная самостоятельная работа'],
      [/Домашние задания/g, 'Самостоятельные работы'],
      [/домашние задания/g, 'самостоятельные работы'],
      [/Домашнее задание/g, 'Самостоятельная работа'],
      [/домашнее задание/g, 'самостоятельная работа'],
      [/Домашнего задания/g, 'Самостоятельной работы'],
      [/домашнего задания/g, 'самостоятельной работы'],
      [/Проверка ДЗ/g, 'Самостоятельная практика'],
      [/проверка ДЗ/g, 'самостоятельная практика'],
      [/ДЗ на проверке/g, 'Самостоятельная работа выполнена'],
      [/ДЗ принято/g, 'Самостоятельная работа выполнена'],
      [/ДЗ отправлено/g, 'Самостоятельная работа выполнена'],
      [/Сдать ДЗ/g, 'Выполнить работу'],
      [/сдать ДЗ/g, 'выполнить работу'],
      [/К ДЗ/g, 'К практике'],
      [/к ДЗ/g, 'к практике'],
      [/перед ДЗ/g, 'перед практикой'],
      [/форму сдачи/gi, 'форму самостоятельной работы']
    ];
    pairs.forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    return out;
  }
  window.selfStudyReplaceTextV39 = selfStudyReplaceTextV39;

  var shellBeforeSelfStudyV39 = window.shell;
  window.shell = function(content, activeTab){
    return shellBeforeSelfStudyV39(selfStudyReplaceTextV39(content), activeTab);
  };

  function selfStudyCompletedV39(code){
    var p = (typeof getProgress === 'function' ? getProgress(code) : {}) || {};
    var status = String(p.status || p.homework_status || '').toLowerCase();
    var completedStatuses = [
      'completed', 'homework_submitted', 'homework_revision', 'revision',
      'rejected', 'needs_revision', 'verified', 'accepted'
    ];
    return Boolean(
      p.self_study_completed ||
      p.self_study_completed_at ||
      p.homework_self_study_completed ||
      p.homework_self_study_completed_at ||
      p.lesson_completed ||
      p.lesson_completed_at ||
      p.homework_submitted ||
      p.homework_submitted_at ||
      p.homework_verified ||
      p.homework_verified_at ||
      p.homework_checked ||
      p.homework_checked_at ||
      p.homework_revision ||
      p.homework_revision_at ||
      p.completed_at ||
      completedStatuses.includes(status)
    );
  }
  window.isSelfStudyCompletedV39 = selfStudyCompletedV39;

  var localPatchBeforeSelfStudyV39 = window.localPatchForEvent;
  window.localPatchForEvent = function(event, payload){
    var now = nowIso();
    if (event === 'homework_submitted' || event === 'lesson_completed') {
      return {
        status: event === 'lesson_completed' ? 'completed' : 'homework_submitted',
        current_step: 'completed',
        homework_submitted: true,
        homework_submitted_at: now,
        homework_self_study_completed: true,
        homework_self_study_completed_at: now,
        self_study_completed: true,
        self_study_completed_at: now,
        completed_at: now,
        homework_revision: false,
        admin_review_comment: ''
      };
    }
    return localPatchBeforeSelfStudyV39(event, payload || {});
  };

  window.homeworkStateV24 = function(code){
    return selfStudyCompletedV39(code) ? 'verified' : 'none';
  };

  window.isStageDone = function(code, stage){
    var p = (typeof getProgress === 'function' ? getProgress(code) : {}) || {};
    if (stage === 'presentation') return Boolean(p.presentation_completed || p.presentation_completed_at);
    if (stage === 'quiz') return Boolean(p.quiz_completed || p.quiz_completed_at);
    if (stage === 'books') return Boolean(p.books_completed || p.books_completed_at);
    if (stage === 'homeworkSubmitted' || stage === 'homeworkVerified') return selfStudyCompletedV39(code);
    if (stage === 'homeworkRevision') return false;
    return false;
  };

  window.lessonStageLabel = function(code){
    if (selfStudyCompletedV39(code)) return 'Урок завершён';
    if (isStageDone(code, 'books')) return 'Выполнить самостоятельную работу';
    if (isStageDone(code, 'quiz')) return 'Изучить саммари';
    if (isStageDone(code, 'presentation')) return 'Пройти тест';
    return 'Начать презентацию';
  };

  window.lessonStageAction = function(code){
    if (selfStudyCompletedV39(code)) return 'renderHomeworkStatus()';
    if (isStageDone(code, 'books')) return 'renderHomework()';
    if (isStageDone(code, 'quiz')) return 'startBooks()';
    if (isStageDone(code, 'presentation')) return 'startQuiz(false)';
    return 'startSlides()';
  };

  window.canOpenLesson = function(meta){
    if (!meta) return false;
    if (typeof isAdminMode === 'function' && isAdminMode()) return true;
    return typeof isLessonPrepared === 'function' ? Boolean(isLessonPrepared(meta)) : String(meta.status || '').toLowerCase() === 'ready';
  };

  window.openLesson = async function(code){
    var meta = getLessonMeta(code);
    if (!meta) return;
    if (!canOpenLesson(meta)) {
      alert('Урок пока не опубликован. Он откроется автоматически после подготовки материалов.');
      return;
    }
    state.selectedLessonCode = code;
    state.selectedActivityKey = meta.activityKey;
    localStorage.setItem('lego_selected_lesson', code);
    localStorage.setItem('lego_selected_activity', meta.activityKey);
    await loadLesson(code);
    return renderLessonHub();
  };

  window.getActivityProgressInfo = function(key){
    var lessons = activityLessons(key);
    var readyLessons = lessons.filter(isLessonPrepared);
    var openCount = readyLessons.length;
    var readyCount = readyLessons.length;
    var doneCount = readyLessons.filter(isLessonFullyCompleted).length;
    var routeTotal = readyLessons.reduce(function(sum, lesson){ return sum + lessonAvailableStages(lesson).length; }, 0);
    var stageDone = readyLessons.reduce(function(sum, lesson){ return sum + lessonCompletedStageCount(lesson.code, lesson); }, 0);
    return {
      lessons: lessons,
      readyLessons: readyLessons,
      openCount: openCount,
      doneCount: doneCount,
      readyCount: readyCount,
      routeTotal: routeTotal,
      stageDone: stageDone,
      routePercent: routeTotal ? safePercent(stageDone / routeTotal * 100) : 0
    };
  };

  window.currentActivityProgress = function(){
    return getActivityProgressInfo(state.selectedActivityKey).routePercent;
  };

  window.studentHomeworkAlertCardV25 = function(){ return ''; };

  function selfStudyCompletedDateV39(code){
    var p = getProgress(code) || {};
    var values = [
      p.self_study_completed_at,
      p.homework_self_study_completed_at,
      p.homework_submitted_at,
      p.homework_verified_at,
      p.homework_checked_at,
      p.homework_revision_at,
      p.completed_at,
      p.updated_at
    ].filter(Boolean);
    if (!values.length) return null;
    values.sort(function(a,b){ return new Date(b).getTime() - new Date(a).getTime(); });
    return values[0];
  }
  window.selfStudyCompletedDateV39 = selfStudyCompletedDateV39;

  var stageCompletedDateBeforeSelfStudyV39 = window.stageCompletedDate;
  window.stageCompletedDate = function(code, stage){
    if (stage === 'homeworkSubmitted' || stage === 'homeworkVerified' || stage === 'selfStudy') {
      return selfStudyCompletedV39(code) ? selfStudyCompletedDateV39(code) : null;
    }
    return stageCompletedDateBeforeSelfStudyV39(code, stage);
  };

  window.stageStatusText = function(code, stage){
    if (stage === 'presentation') return isStageDone(code, 'presentation') ? 'пройдена' : '—';
    if (stage === 'quiz') return isStageDone(code, 'quiz') ? 'пройден' : '—';
    if (stage === 'books') return isStageDone(code, 'books') ? 'изучено' : '—';
    if (stage === 'selfStudy' || stage === 'homeworkSubmitted' || stage === 'homeworkVerified') {
      return selfStudyCompletedV39(code) ? 'выполнена' : '—';
    }
    return '—';
  };

  window.homeworkReviewNoticeHtml = function(code){
    if (!selfStudyCompletedV39(code)) return '';
    var date = selfStudyCompletedDateV39(code);
    return `<div class="homework-review-notice accepted self-study-complete-notice"><b>Самостоятельная работа выполнена</b><p>Отмечено ${date ? shortDate(date) : 'сейчас'}. Проверка администратором не требуется.</p></div>`;
  };

  window.lessonTimelineHtml = function(code){
    var rows = [
      ['presentation', 'Презентация'],
      ['quiz', 'Тест'],
      ['books', 'Саммари'],
      ['selfStudy', 'Самостоятельная работа']
    ];
    return card('lesson-timeline-card', `<h2>История прохождения</h2><div class="timeline-grid">${rows.map(function(row){
      var stage = row[0];
      var status = stageStatusText(code, stage);
      var date = stageCompletedDate(code, stage);
      var done = status !== '—';
      return `<div class="timeline-row ${done ? 'done' : ''}"><span>${esc(row[1])}</span><b>${esc(status)}</b><em>${date ? shortDate(date) : '—'}</em></div>`;
    }).join('')}</div>`);
  };

  function selfStudyForumButtonV39(){
    var forumVisible = typeof forumVisibleInNavigationV38 === 'function' && forumVisibleInNavigationV38();
    if (!forumVisible || typeof window.renderBusinessForum !== 'function') return '';
    return `<button class="btn secondary" onclick="renderBusinessForum()">Обсудить вопрос в форуме</button>`;
  }
  window.selfStudyForumButtonV39 = selfStudyForumButtonV39;

  window.globalInstructionPanelHtml = function(){
    return `<div id="global-instruction-panel" class="global-instruction-panel" style="display:none">
      <div class="instruction-head"><b>Как пользоваться системой</b><button onclick="toggleGlobalInstruction(false)" aria-label="Закрыть инструкцию">×</button></div>
      <div class="instruction-steps">
        <div><b>1. Выберите направление</b><p>В разделе «Я предприниматель» откройте подходящий вид деятельности. Все опубликованные уроки этого направления доступны сразу.</p></div>
        <div><b>2. Сохраняйте рекомендуемый порядок</b><p>Внутри каждого урока маршрут остаётся последовательным: презентация → тест → саммари → самостоятельная работа.</p></div>
        <div><b>3. Работайте в своём темпе</b><p>Открывайте любые опубликованные уроки. Система ничего не блокирует раз в неделю и не требует принятия предыдущей работы.</p></div>
        <div><b>4. Выполняйте практику самостоятельно</b><p>Заполните шаблон, сформулируйте вывод, выберите действие и показатель проверки. Отправлять работу администратору не нужно.</p></div>
        <div><b>5. Задавайте вопросы в форуме</b><p>После открытия Бизнес-форума вопросы по урокам и практике можно будет обсуждать с участниками. Форум не влияет на завершение урока.</p></div>
      </div>
    </div>`;
  };

  window.renderActivityLessons = function(key){
    if (key && getActivity(key)) {
      state.selectedActivityKey = key;
      localStorage.setItem('lego_selected_activity', key);
    }
    var act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
    var info = getActivityProgressInfo(act.key);
    var readyNote = info.readyCount
      ? 'Все опубликованные уроки доступны сразу. Рекомендуемый порядок сохранён, но недельных блокировок и зависимости от проверки работы больше нет.'
      : 'Материалы направления пока находятся в подготовке.';
    var html = `
      ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${esc(readyNote)}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс опубликованных уроков</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
      ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
      ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Опубликовано: <b>${info.readyCount}</b>. Доступно сейчас: <b>${info.openCount}</b>. Пройдено: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
    `;
    shell(html, 'learning');
  };

  window.renderLessonRow = function(lesson){
    var prepared = isLessonPrepared(lesson);
    var progress = lessonStageProgressInfo(lesson.code);
    var status = prepared ? lessonStageLabel(lesson.code) : 'в подготовке';
    return `<button class="lesson-row-v2 ${prepared ? '' : 'locked'}" ${prepared ? `onclick="openLesson('${lesson.code}')"` : 'disabled'}>
      <div><b>${String(lesson.number).padStart(2,'0')}. ${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${esc(status)} · ${progress.percent}%</p><div class="lesson-row-progress">${progressBarHtml(progress.percent,'')}</div></div>
      <span>${prepared ? (isLessonFullyCompleted(lesson) ? '✓' : '→') : '🔒'}</span>
    </button>`;
  };

  window.continueLessonFromProgress = async function(code){
    var meta = getLessonMeta(code);
    if (!meta) return;
    if (!canOpenLesson(meta)) { alert('Урок пока не опубликован.'); return; }
    state.selectedLessonCode = code;
    state.selectedActivityKey = meta.activityKey;
    localStorage.setItem('lego_selected_lesson', code);
    localStorage.setItem('lego_selected_activity', meta.activityKey);
    await loadLesson(code);
    if (selfStudyCompletedV39(code)) return renderHomeworkStatus();
    if (isStageDone(code, 'books')) return renderHomework();
    if (isStageDone(code, 'quiz')) return startBooks();
    if (isStageDone(code, 'presentation')) return startQuiz(false);
    return startSlides();
  };

  window.renderLessonHub = async function(){
    try {
      var lesson = await loadLesson(state.selectedLessonCode);
      var meta = getLessonMeta(state.selectedLessonCode);
      var activityKey = meta ? meta.activityKey : (lesson.activityKey || state.selectedActivityKey);
      var adminService = isAdminMode() && lesson.passportText
        ? `<details class="admin-details"><summary>Служебное описание урока</summary><pre class="text-pre">${esc(lesson.passportText || '')}</pre></details>`
        : '';
      var practiceDone = selfStudyCompletedV39(meta.code);
      var practiceLocked = !isStageDone(meta.code, 'books') && !practiceDone && !isAdminMode();
      var html = `
        ${card('blue-card-v2 lesson-head-card', `<p class="eyebrow">${esc(lesson.activityTitle)} · урок ${String(lesson.number).padStart(2,'0')}</p><h1>${esc(lesson.title)}</h1><div class="lesson-meta-chips"><span>${esc(lesson.activityTitle)}</span><span>Урок ${String(lesson.number).padStart(2,'0')}</span></div><p>${esc(cleanLessonDescription(lesson))}</p>${lessonProgressMini(meta.code)}${homeworkReviewNoticeHtml(meta.code)}<button class="btn primary" onclick="continueLessonFromProgress('${meta.code}')">Продолжить с последнего места</button>`)}
        ${lessonOverviewCard(lesson)}
        <div class="stage-grid-v2">
          ${stageCard('presentation','Презентация','Информационная часть урока',isStageDone(meta.code,'presentation'),'startSlides()')}
          ${stageCard('quiz','Тест','Проверка понимания материала',isStageDone(meta.code,'quiz'),'startQuiz(false)',!isStageDone(meta.code,'presentation') && !isAdminMode())}
          ${stageCard('books','Саммари','Инструменты и идеи из книг',isStageDone(meta.code,'books'),'startBooks()',!isStageDone(meta.code,'quiz') && !isAdminMode())}
          ${stageCard('homework','Самостоятельная работа','Примените урок к своему бизнесу',practiceDone,'renderHomework()',practiceLocked,practiceDone?'accepted':'')}
        </div>
        ${lessonTimelineHtml(meta.code)}
        ${typeof lessonInsightCard === 'function' ? lessonInsightCard() : ''}
        ${card('', `<div class="grid-v2"><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">← К выбору уроков</button><button class="btn secondary" onclick="renderHome()">На главную</button></div>`)}
        ${adminService}
      `;
      shell(html, 'learning');
    } catch(error) {
      emergencyScreen(error.message || 'LESSON_HUB_ERROR');
    }
  };

  window.toggleSelfStudyReadyV39 = function(){
    var checks = Array.from(document.querySelectorAll('[data-self-study-check="1"]'));
    var button = document.getElementById('self-study-complete-button');
    if (!button) return;
    button.disabled = checks.length < 3 || !checks.every(function(input){ return input.checked; });
  };

  window.markSelfStudyCompletedV39 = async function(){
    var checks = Array.from(document.querySelectorAll('[data-self-study-check="1"]'));
    if (checks.length >= 3 && !checks.every(function(input){ return input.checked; })) {
      alert('Сначала подтвердите три пункта самопроверки.');
      return;
    }
    var code = state.selectedLessonCode;
    var now = nowIso();
    await remoteSave('homework_submitted', {
      selfStudy: true,
      completedAt: now,
      source: 'self_study_v39'
    });
    saveLocalProgress(code, {
      status: 'homework_submitted',
      current_step: 'completed',
      homework_submitted: true,
      homework_submitted_at: now,
      homework_self_study_completed: true,
      homework_self_study_completed_at: now,
      self_study_completed: true,
      self_study_completed_at: now,
      completed_at: now,
      homework_revision: false,
      admin_review_comment: ''
    });
    renderHomeworkStatus();
  };
  window.markHomeworkSubmitted = window.markSelfStudyCompletedV39;

  function sanitizeSelfStudyInstructionV39(html){
    var out = selfStudyReplaceTextV39(cleanStudentHtml(html || ''));
    out = out
      .replace(/отправьте\s+(?:форму|ссылку)[^.]*провер[^.]*\.?/gi, 'Сохраните полученный результат у себя.')
      .replace(/откройте\s+форму\s+самостоятельной\s+работы/gi, 'зафиксируйте итог самостоятельной работы')
      .replace(/после\s+проверки[^.]*\.?/gi, '')
      .replace(/проверяющ(?:ий|его|ему|им)[^.]*\.?/gi, '');
    return out;
  }

  function sanitizeSelfStudyInstructionV41(html){
    var out = cleanStudentHtml(html || '');
    if (typeof selfStudyReplaceTextV39 === 'function') out = selfStudyReplaceTextV39(out);
    return String(out)
      .replace(/отправ(?:ьте|ить|ляется|лена|лено)[^.<]*(?:форму|ссылку|работу)[^.<]*(?:провер[^.<]*)?[.]?/gi, '')
      .replace(/сдат(?:ь|ься|е)[^.<]*(?:работу|ДЗ)[^.<]*[.]?/gi, '')
      .replace(/(?:администратор|проверяющ(?:ий|его|ему|им))[^.<]*[.]?/gi, '')
      .replace(/(?:принятие|приёмка)\s+(?:работы|ДЗ)[^.<]*[.]?/gi, '')
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  window.sanitizeSelfStudyInstructionV41 = sanitizeSelfStudyInstructionV41;

  window.renderHomework = async function(){
    var lesson = await loadLesson(state.selectedLessonCode);
    var code = state.selectedLessonCode;
    var activityKey = lesson.activityKey || state.selectedActivityKey;
    var completed = selfStudyCompletedV39(code);
    if (!isAdminMode() && !isStageDone(code, 'books') && !completed) {
      shell(`${card('blue-card-v2', `<h1>Самостоятельная работа пока закрыта</h1><p>Сначала завершите презентацию, тест и саммари внутри этого урока.</p>`)}${card('', `<div class="grid-v2">${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}`,'homework');
      return;
    }
    if (!completed) await remoteSave('homework_started', { selfStudy: true });
    var hw = lesson.homework || {};
    var tableLabel = selfStudyReplaceTextV39(hw.buttonLabel || 'Открыть рабочий шаблон');
    var instruction = sanitizeSelfStudyInstructionV39(hw.instructionHtml || `<h3>Практическая часть урока</h3><p>Заполните рабочий шаблон по фактическим данным своего бизнеса. Определите главное ограничение, действие на ближайший цикл и показатель проверки.</p>`);
    var exampleUrl = hw.exampleUrl || hw.exampleSheetUrl || hw.sampleUrl || hw.exampleFileUrl || '';
    var completePanel = completed
      ? `<div class="self-study-completed-panel"><b>Работа отмечена выполненной</b><p>Вы можете вернуться к шаблону, уточнить вывод или обсудить вопрос в форуме.</p></div>`
      : `<div class="self-study-checklist"><h3>Самопроверка перед завершением</h3>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я заполнил рабочий шаблон по своему бизнесу.</span></label>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я сформулировал главный вывод по ситуации.</span></label>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я выбрал конкретное действие и показатель проверки.</span></label>
          <button class="btn primary" id="self-study-complete-button" onclick="markSelfStudyCompletedV39()" disabled>Отметить работу выполненной</button>
        </div>`;
    shell(`${card('blue-card-v2 self-study-hero', `<p class="eyebrow">практика</p><h1>${esc(selfStudyReplaceTextV39(hw.title || 'Самостоятельная работа'))}</h1><p>Работа выполняется самостоятельно. Отправлять ссылку и ждать проверки администратора не нужно.</p>`)}
      ${homeworkReviewNoticeHtml(code)}
      ${card('', `${instruction}<div class="grid-v2">${externalButton(tableLabel,homeworkSheetUrl(code, hw),'primary')}${exampleUrl ? externalButton('Открыть заполненный пример', exampleUrl, 'secondary') : ''}${selfStudyForumButtonV39()}</div>${completePanel}<div class="grid-v2 self-study-nav"><button class="btn secondary" onclick="renderLessonHub()">← Вернуться к уроку</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}
      ${isAdminMode() ? card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии самопроверки</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`) : ''}`,'homework');
  };

  window.renderHomeworkStatus = function(){
    var code = state.selectedLessonCode;
    var meta = getLessonMeta(code);
    var activityKey = meta ? meta.activityKey : state.selectedActivityKey;
    if (!selfStudyCompletedV39(code)) return renderHomework();
    var date = selfStudyCompletedDateV39(code);
    shell(`${card('blue-card-v2 self-study-status-card', `<p class="eyebrow">урок завершён</p><h1>Самостоятельная работа выполнена</h1><p>Отмечено ${date ? shortDate(date) : 'сейчас'}. Проверка администратором не требуется.</p>`)}${lessonTimelineHtml(code)}${card('', `<div class="grid-v2"><button class="btn primary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" onclick="renderHomework()">Открыть работу</button>${selfStudyForumButtonV39()}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}`,'homework');
  };

  window.openSelfStudyV39 = async function(code){
    var meta = getLessonMeta(code);
    if (!meta || !canOpenLesson(meta)) return;
    state.selectedLessonCode = code;
    state.selectedActivityKey = meta.activityKey;
    localStorage.setItem('lego_selected_lesson', code);
    localStorage.setItem('lego_selected_activity', meta.activityKey);
    await loadLesson(code);
    if (isStageDone(code, 'books') || selfStudyCompletedV39(code) || isAdminMode()) return renderHomework();
    return renderLessonHub();
  };

  window.renderHomeworkCenter = function(){
    var lessons = (state.catalog?.lessons || []).filter(isLessonPrepared);
    shell(`${card('blue-card-v2 practice-center-hero', `<p class="eyebrow">практика</p><h1>Самостоятельные работы</h1><p>Работы не отправляются на проверку. Завершите саммари, примените материал к своему бизнесу и отметьте результат самостоятельно.</p>`)}${card('', `<div class="lesson-list-v2">${lessons.map(function(lesson){
      var completed = selfStudyCompletedV39(lesson.code);
      var ready = isStageDone(lesson.code, 'books') || completed || isAdminMode();
      var status = completed ? 'выполнена' : (ready ? 'доступна' : 'сначала пройдите саммари');
      return `<button class="lesson-row-v2 ${ready ? '' : 'locked'}" onclick="openSelfStudyV39('${lesson.code}')"><div><b>${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${esc(status)}</p></div><span>${completed ? '✓' : (ready ? '→' : '○')}</span></button>`;
    }).join('')}</div>`)}`,'homework');
  };

  window.doneSummaryHtml = function(){
    var lessons = readyCoreLessons();
    var presentation = lessons.filter(function(l){ return isStageDone(l.code,'presentation'); }).length;
    var quiz = lessons.filter(function(l){ return isStageDone(l.code,'quiz'); }).length;
    var books = lessons.filter(function(l){ return isStageDone(l.code,'books'); }).length;
    var practice = lessons.filter(function(l){ return selfStudyCompletedV39(l.code); }).length;
    var insights = typeof loadInsights === 'function' ? loadInsights().length : 0;
    var ch = typeof getChallengeState === 'function' ? getChallengeState() : {};
    return card('done-summary-card', `<h2>Что уже сделано</h2><div class="done-grid"><div><span>Презентации</span><b>${presentation}</b></div><div><span>Тесты</span><b>${quiz}</b></div><div><span>Саммари</span><b>${books}</b></div><div><span>Самостоятельные работы</span><b>${practice}</b></div><div><span>Книги челленджа</span><b>${Number(ch.passedBooks || 0)}</b></div><div><span>Мои выводы</span><b>${insights}</b></div></div>`);
  };

  var renderProfileBeforeSelfStudyV39 = window.renderProfile;
  window.renderProfile = function(){
    var result = renderProfileBeforeSelfStudyV39();
    setTimeout(function(){
      var root = document.getElementById('app');
      if (!root) return;
      Array.from(root.querySelectorAll('p,span,b,h1,h2,h3,button')).forEach(function(el){
        if (el.children.length) return;
        var next = selfStudyReplaceTextV39(el.textContent);
        if (next !== el.textContent) el.textContent = next;
      });
    }, 0);
    return result;
  };

  window.renderAdmin = function(){
    if (!isAdminUser()) { alert('Нет прав администратора.'); return; }
    var forumBlock = typeof window.renderBusinessForum === 'function'
      ? card('', `<h2>Бизнес-форум</h2><p>Форум используется для вопросов и обсуждений. Пока он закрыт для учеников, администратор может продолжать тестирование.</p><button class="btn primary" onclick="renderBusinessForum()">Открыть форум</button>`)
      : '';
    shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Все опубликованные уроки доступны ученикам сразу. Самостоятельные работы больше не требуют проверки.</p>`)}
      ${card('', `<h2>100 книг за 100 дней</h2><p>Можно проверить книги, мини-тесты и восстановление зачётов.</p><div class="grid-v2"><button class="btn primary" onclick="books100AdminRepairAllV25()">Проверить и восстановить зачёты книг</button><button class="btn secondary" onclick="renderBookChallenge()">Открыть книги челленджа</button></div>`)}
      ${forumBlock}
      ${card('', `<h2>Все уроки</h2><p>Значок «в подготовке» получают только неопубликованные материалы. Все остальные уроки доступны ученикам без недельного ожидания.</p><div class="lesson-list-v2">${(state.catalog?.lessons || []).map(function(lesson){
        var ready = isLessonPrepared(lesson);
        return `<button class="lesson-row-v2 ${ready ? '' : 'locked'}" ${ready ? `onclick="openLesson('${lesson.code}')"` : 'disabled'}><div><b>${esc(lesson.code)} · ${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${ready ? 'опубликован' : 'в подготовке'} · ${lesson.slidesCount} слайдов · ${lesson.quizCount} вопросов · ${lesson.bookScreensCount} саммари</p></div><span>${ready ? '→' : '🔒'}</span></button>`;
      }).join('')}</div>`)}`,'profile');
  };

  window.bottomNav = function(active){
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) return '';
    var architecture = typeof architectureModeV35 === 'function' && architectureModeV35();
    var showForum = typeof forumVisibleInNavigationV38 === 'function' && forumVisibleInNavigationV38();
    function item(key, label, fn, fallbackIcon){
      var icon = architecture && typeof architectureNavIconV35 === 'function'
        ? `<span class="arch-nav-icon">${architectureNavIconV35(key)}</span>`
        : `<span>${fallbackIcon}</span>`;
      return `<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn}')">${icon}<b>${label}</b></button>`;
    }
    return `<nav class="bottom-nav-v2 ${showForum ? 'bottom-nav-v2-five' : 'bottom-nav-v2-four'}" aria-label="Основное меню">
      ${item('home','Главная','renderHome','⌂')}
      ${item('learning','Уроки','renderLearning','▣')}
      ${item('homework','Практика','renderHomeworkCenter','✓')}
      ${showForum ? item('forum','Форум','renderBusinessForum','◎') : ''}
      ${item('profile','Профиль','renderProfile','○')}
    </nav>`;
  };
})();


/* =====================================================
   v40 — иерархия разделов, боковое меню и прозрачные правила прогресса

   Изменяется только интерфейс. Данные Supabase, прогресс, книги,
   самостоятельные работы и доступ к урокам не пересобираются.
   ===================================================== */
(function installArchitectureHierarchyV40(){
  window.APP_UI_VERSION_V40 = 'v40-hierarchy-drawer-content-20260624';

  function architectureV40Enabled(){
    return typeof architectureModeV35 === 'function' && architectureModeV35();
  }

  function studentVisibleTextV40(value){
    var out = String(value == null ? '' : value);
    var pairs = [
      [/в домашнем задании/gi, 'в самостоятельной работе'],
      [/для домашнего задания/gi, 'для самостоятельной работы'],
      [/к домашнему заданию/gi, 'к самостоятельной работе'],
      [/по домашнему заданию/gi, 'по самостоятельной работе'],
      [/проверенное ДЗ/gi, 'выполненная самостоятельная работа'],
      [/форма сдачи ДЗ/gi, 'форма самостоятельной работы'],
      [/таблица ДЗ/gi, 'рабочая таблица'],
      [/итог ДЗ/gi, 'итог самостоятельной работы'],
      [/ДЗ показывает/gi, 'самостоятельная работа показывает'],
      [/таблица и ДЗ/gi, 'таблица и самостоятельная работа']
    ];
    pairs.forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    return out;
  }
  window.studentVisibleTextV40 = studentVisibleTextV40;

  var shellBeforeHierarchyV40 = window.shell;
  window.shell = function(content, activeTab){
    var result = shellBeforeHierarchyV40(studentVisibleTextV40(content), activeTab);
    setTimeout(function(){
      installAppDrawerV40();
      removeProfileModerationNoticeV40();
    }, 0);
    return result;
  };

  function forumReadyForCurrentModeV40(){
    return Boolean(
      typeof forumVisibleInNavigationV38 === 'function' &&
      forumVisibleInNavigationV38() &&
      typeof window.renderBusinessForum === 'function'
    );
  }
  window.forumReadyForCurrentModeV40 = forumReadyForCurrentModeV40;

  function renderPlaceholderSectionsV40(items){
    return `<div class="content-preview-list-v40">${items.map(function(item){
      return `<div><span>${esc(item.icon || '•')}</span><section><b>${esc(item.title)}</b><p>${esc(item.text)}</p></section></div>`;
    }).join('')}</div>`;
  }

  window.renderContentPlaceholderV40 = function(title, eyebrow, description, items){
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) {
      accessDenied('OPEN_FROM_TELEGRAM_REQUIRED');
      return;
    }
    var blocks = Array.isArray(items) ? items : [];
    shell(`${card('blue-card-v2 content-placeholder-hero-v40', `<p class="eyebrow">${esc(eyebrow || 'новый раздел')}</p><h1>${esc(title)}</h1><p>${esc(description || 'Раздел создан. Наполнение будет добавляться отдельными публикациями.')}</p>`)}
      ${card('content-placeholder-card-v40', `<h2>Как будет устроен раздел</h2>${renderPlaceholderSectionsV40(blocks)}<div class="content-placeholder-note-v40"><b>Статус</b><p>Структура раздела подключена к приложению. Публикации и обложки добавляются отдельно, без изменения основной логики обучения.</p></div><button class="btn secondary" onclick="renderHome()">На главную</button>`)}`,'home');
  };

  window.renderNoBusinessV40 = function(){
    renderContentPlaceholderV40('Нет своего бизнеса','основной маршрут','Базовый путь для человека, который хочет разобраться в предпринимательском мышлении до запуска бизнеса.',[
      {icon:'01',title:'Выбор направления',text:'Определить интересующую модель бизнеса и критерии первого запуска.'},
      {icon:'02',title:'Экономика идеи',text:'Проверить спрос, цену, расходы, маржу и минимальный объём продаж.'},
      {icon:'03',title:'План первого цикла',text:'Собрать проверяемое действие, срок и показатель результата.'}
    ]);
  };
  window.renderEmployeeRouteV40 = function(){
    renderContentPlaceholderV40('Я сотрудник','основной маршрут','Маршрут для руководителей, управляющих и ключевых сотрудников, которые отвечают за отдельный участок бизнес-системы.',[
      {icon:'01',title:'Роль и зона ответственности',text:'Понять свой процесс, результат и показатели управления.'},
      {icon:'02',title:'Факты и отклонения',text:'Фиксировать результат без догадок и искать причину отклонения.'},
      {icon:'03',title:'Управленческое действие',text:'Назначать конкретное изменение, срок и проверку эффекта.'}
    ]);
  };
  window.renderNewspaperV40 = function(){
    renderContentPlaceholderV40('Газета','цифровая газета','Новости бизнеса, изменения внутри приложения и важные события будут выходить отдельными выпусками в газетной подаче.',[
      {icon:'№',title:'Главная тема выпуска',text:'Одна крупная новость с разбором причин, последствий и практического значения.'},
      {icon:'↗',title:'Деловая хроника',text:'Короткие новости рынка, управления, финансов, продаж и технологий.'},
      {icon:'✎',title:'Колонка редакции',text:'Практический вывод: что предпринимателю проверить или изменить после выпуска.'}
    ]);
  };
  window.renderEntrepreneurArticlesV40 = function(){
    renderContentPlaceholderV40('Предпринимательские статьи','практические статьи','Статьи будут разбирать реальные управленческие ситуации, ошибки, цифры, решения и последствия для бизнеса.',[
      {icon:'01',title:'Проблема',text:'Какая управленческая ситуация возникла и почему она важна.'},
      {icon:'02',title:'Разбор',text:'Факты, причинно-следственные связи и варианты решения.'},
      {icon:'03',title:'Применение',text:'Один вопрос к своему бизнесу и одно действие после статьи.'}
    ]);
  };
  window.renderDirectReviewsV40 = function(){
    renderContentPlaceholderV40('Прямые разборы','разборы кейсов','Здесь будут разбираться гарвардские кейсы, российские и международные бизнес-ситуации, управленческие решения и альтернативные сценарии.',[
      {icon:'A',title:'Исходные данные',text:'Контекст компании, ограничения, цифры и позиция участников.'},
      {icon:'B',title:'Точка решения',text:'Что должен решить руководитель и какие варианты реально доступны.'},
      {icon:'C',title:'Разбор последствий',text:'Риски каждого решения, критерии выбора и практический перенос в свой бизнес.'}
    ]);
  };
  window.renderWatchV40 = function(){
    renderContentPlaceholderV40('Что посмотреть','бизнес-медиа','Подборки фильмов, сериалов, интервью, лекций и документальных проектов с пояснением, что именно смотреть предпринимателю.',[
      {icon:'▶',title:'Фильмы и сериалы',text:'Сюжеты о лидерстве, переговорах, рисках, власти, деньгах и системах.'},
      {icon:'●',title:'Интервью',text:'Разговоры с предпринимателями и руководителями без лишней мотивационной подачи.'},
      {icon:'✓',title:'Вопросы после просмотра',text:'Короткий список выводов и вопросов для применения в своём бизнесе.'}
    ]);
  };
  window.renderVipV40 = function(){
    renderContentPlaceholderV40('VIP уровень','расширенный уровень','Закрытые форматы, персональные разборы, дополнительные инструменты и приоритетные активности будут подключены отдельным этапом.',[
      {icon:'01',title:'Персональные разборы',text:'Углублённая работа с конкретной ситуацией бизнеса.'},
      {icon:'02',title:'Закрытые материалы',text:'Дополнительные методики, шаблоны и кейсы.'},
      {icon:'03',title:'Приоритет участия',text:'Отдельные форматы обратной связи и взаимодействия.'}
    ]);
  };
  window.renderForumUnavailableV40 = function(){
    renderContentPlaceholderV40('Бизнес-форум','раздел в подготовке','Форум пока закрыт для учеников. После завершения тестирования здесь появятся вопросы по урокам, обсуждения практики и обмен опытом.',[
      {icon:'01',title:'Вопросы по урокам',text:'Обсуждение конкретных затруднений без обязательной проверки самостоятельной работы.'},
      {icon:'02',title:'Разбор ситуаций',text:'Участники смогут описывать факты, действия и результаты.'},
      {icon:'03',title:'Профессиональные ответы',text:'Ответы по существу темы с сохранением правил и модерации.'}
    ]);
  };
  window.openForumBlockV40 = function(){
    if (forumReadyForCurrentModeV40()) return renderBusinessForum();
    return renderForumUnavailableV40();
  };

  window.renderProgressRulesV40 = function(){
    var gp = typeof globalStageProgress === 'function' ? globalStageProgress() : {done:0,total:0,percent:0};
    shell(`${card('blue-card-v2 progress-rules-hero-v40', `<p class="eyebrow">правила системы</p><h1>Как считаются прогресс и баллы</h1><p>Прогресс и баллы — разные показатели. Прогресс показывает прохождение этапов, баллы используются как мотивационная система.</p>`)}
      ${card('', `<h2>Прогресс</h2><p>В расчёт входят только опубликованные уроки. В каждом опубликованном уроке четыре этапа равного веса:</p><div class="score-rule-grid-v40 equal"><div><span>25%</span><b>Презентация</b></div><div><span>25%</span><b>Тест</b></div><div><span>25%</span><b>Саммари</b></div><div><span>25%</span><b>Самостоятельная работа</b></div></div><p class="small">Сейчас выполнено: <b>${gp.done} из ${gp.total}</b> этапов — <b>${gp.percent}%</b>.</p>`)}
      ${card('', `<h2>Баллы за один урок</h2><div class="score-rule-grid-v40"><div><span>10</span><b>Презентация</b></div><div><span>10</span><b>Тест</b></div><div><span>10</span><b>Саммари</b></div><div><span>70</span><b>Самостоятельная работа</b></div></div><p class="small">Полностью завершённый урок даёт 100 баллов. Старую пропорцию мы пока сохраняем, чтобы не пересчитать уже накопленные баллы и уровни.</p>`)}
      ${card('', `<h2>Отдельно: 100 книг за 100 дней</h2><p>Баллы челленджа прибавляются к баллам уроков. Первый зачтённый день даёт 50 баллов, далее награда растёт на 2 балла за каждый день серии.</p><button class="btn secondary" onclick="renderProfile()">Вернуться в профиль</button>`)}`,'profile');
  };

  function primaryRoutesHtmlV40(){
    return `<div class="top-track-grid architecture-main-tracks-v40">
      ${renderMainBlockCard('Я предприниматель','Системный маршрут по видам бизнеса: уроки, тесты, саммари и самостоятельная практика.','доступно','renderLearning()','active main-block-card v40-primary-card')}
      ${renderMainBlockCard('Нет своего бизнеса','Подготовка к запуску и базовое предпринимательское мышление.','скоро','renderNoBusinessV40()','soon main-block-card v40-primary-card')}
      ${renderMainBlockCard('Я сотрудник','Маршрут для руководителей, управляющих и ключевых сотрудников.','скоро','renderEmployeeRouteV40()','soon main-block-card v40-primary-card')}
    </div>`;
  }
  window.primaryRoutesHtmlV40 = primaryRoutesHtmlV40;

  function secondaryBlocksHtmlV40(){
    var forumStatus = forumReadyForCurrentModeV40() ? (isAdminMode() ? 'тестирование' : 'доступно') : 'в подготовке';
    var forumClass = forumReadyForCurrentModeV40() ? 'active' : 'soon';
    return `<div class="secondary-track-grid-v22 architecture-secondary-tracks-v40">
      ${renderMainBlockCard('Бизнес-форум','Вопросы по урокам, обсуждения практики и обмен опытом участников.',forumStatus,'openForumBlockV40()',forumClass + ' compact-card')}
      ${renderMainBlockCard('100 книг за 100 дней','Ежедневная книга, мини-тест, учебные единицы и серия баллов.','доступно','renderBookChallenge()','active books100-entry compact-card')}
      ${renderMainBlockCard('Газета','Новости бизнеса и приложения в формате цифровых газетных выпусков.','скоро','renderNewspaperV40()','soon compact-card')}
      ${renderMainBlockCard('Предпринимательские статьи','Практические статьи о ситуациях, цифрах, решениях и последствиях.','скоро','renderEntrepreneurArticlesV40()','soon compact-card')}
      ${renderMainBlockCard('Прямые разборы','Гарвардские и другие бизнес-кейсы с разбором вариантов решения.','скоро','renderDirectReviewsV40()','soon compact-card')}
      ${renderMainBlockCard('Что посмотреть','Фильмы, интервью, лекции и видео с управленческими выводами.','скоро','renderWatchV40()','soon compact-card')}
      ${renderMainBlockCard('Дополнительные материалы','Шаблоны, инструкции и материалы вне основного маршрута.','скоро','renderAdditionalMaterials()','soon compact-card')}
      ${renderMainBlockCard('VIP уровень','Расширенные разборы, инструменты и закрытые возможности.','в разработке','renderVipV40()','soon compact-card')}
    </div>`;
  }
  window.secondaryBlocksHtmlV40 = secondaryBlocksHtmlV40;

  var renderHomeBeforeHierarchyV40 = window.renderHome;
  window.renderHome = function(){
    if (!architectureV40Enabled()) return renderHomeBeforeHierarchyV40();
    var gp = globalStageProgress();
    var points = totalPoints();
    var titleInfo = studentTitleInfo();
    var html = `
      ${card('hero-dashboard main-dashboard-card architecture-dashboard v40-dashboard', `
        <div class="architecture-dashboard-head">
          <div>
            <div class="eyebrow-row"><p class="eyebrow">ваша система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button></div>
            <h1>Общий прогресс</h1>
            <p>Завершено <b>${gp.done} из ${gp.total}</b> этапов опубликованных уроков. Каждый этап даёт одинаковую долю прогресса.</p>
          </div>
          ${compactProgressRing(gp.percent)}
        </div>
        <div class="architecture-metrics">
          <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
          <div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div>
          <div><span>Достижение</span><b>${esc(titleInfo.current.title)}</b></div>
        </div>
        ${globalInstructionPanelHtml()}
      `)}
      ${card('architecture-blocks-card v40-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">структура приложения</p><h2>Выберите блок</h2></div><p>Первые три раздела — основные маршруты. Остальные дополняют обучение и практику.</p></div>${primaryRoutesHtmlV40()}${secondaryBlocksHtmlV40()}`)}
      ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
    `;
    shell(html,'home');
  };

  window.renderRoutesHubV40 = function(){
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) {
      accessDenied('OPEN_FROM_TELEGRAM_REQUIRED');
      return;
    }
    shell(`${card('blue-card-v2 routes-hub-hero-v40', `<p class="eyebrow">маршруты обучения</p><h1>Выберите свою роль</h1><p>Нижняя вкладка «Маршруты» ведёт не в один набор уроков, а в три основные траектории приложения.</p>`)}
      ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
      ${card('routes-hub-card-v40', `${primaryRoutesHtmlV40()}`)}`,'learning');
  };

  var bottomNavBeforeHierarchyV40 = window.bottomNav;
  window.bottomNav = function(active){
    if (!architectureV40Enabled()) return bottomNavBeforeHierarchyV40(active);
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) return '';
    function item(key,label,fn){
      var iconKey = key === 'learning' ? 'learning' : key;
      var icon = typeof architectureNavIconV35 === 'function'
        ? `<span class="arch-nav-icon">${architectureNavIconV35(iconKey)}</span>`
        : '<span>•</span>';
      return `<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn}')">${icon}<b>${label}</b></button>`;
    }
    return `<nav class="bottom-nav-v2 bottom-nav-v2-four v40-bottom-nav" aria-label="Основное меню">
      ${item('home','Главная','renderHome')}
      ${item('learning','Маршруты','renderRoutesHubV40')}
      ${item('homework','Практика','renderHomeworkCenter')}
      ${item('profile','Профиль','renderProfile')}
    </nav>`;
  };

  var blockIconBeforeV40 = window.architectureBlockIconV35;
  window.architectureBlockIconV35 = function(title){
    var text = String(title || '').toLowerCase();
    var body = '';
    if (text.includes('газета')) body = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h5M7 11h10M7 14h10M7 17h7M15 7h3v3h-3z"/>';
    else if (text.includes('предпринимательские статьи')) body = '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h6"/>';
    else if (text.includes('прямые разборы')) body = '<path d="M4 5h10v10H4zM14 9h6v10H10v-4"/><path d="m7 12 2-3 2 2 2-4"/>';
    else if (text.includes('что посмотреть')) body = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>';
    if (!body) return blockIconBeforeV40(title);
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  };

  function drawerItemsV40(){
    var forumStatus = forumReadyForCurrentModeV40() ? 'доступно' : 'в подготовке';
    return [
      {title:'Я предприниматель',status:'доступно',action:'renderLearning()'},
      {title:'Нет своего бизнеса',status:'скоро',action:'renderNoBusinessV40()'},
      {title:'Я сотрудник',status:'скоро',action:'renderEmployeeRouteV40()'},
      {title:'Бизнес-форум',status:forumStatus,action:'openForumBlockV40()'},
      {title:'100 книг за 100 дней',status:'доступно',action:'renderBookChallenge()'},
      {title:'Газета',status:'скоро',action:'renderNewspaperV40()'},
      {title:'Предпринимательские статьи',status:'скоро',action:'renderEntrepreneurArticlesV40()'},
      {title:'Прямые разборы',status:'скоро',action:'renderDirectReviewsV40()'},
      {title:'Что посмотреть',status:'скоро',action:'renderWatchV40()'},
      {title:'Дополнительные материалы',status:'скоро',action:'renderAdditionalMaterials()'},
      {title:'VIP уровень',status:'в разработке',action:'renderVipV40()'}
    ];
  }

  function appDrawerHtmlV40(){
    return `<div class="app-drawer-overlay-v40" id="app-drawer-overlay-v40" onclick="closeAppDrawerV40()" aria-hidden="true">
      <aside class="app-drawer-v40" role="dialog" aria-modal="true" aria-label="Все разделы приложения" onclick="event.stopPropagation()">
        <div class="app-drawer-head-v40"><div><p>АРХИТЕКТУРА</p><span>Все разделы</span></div><button onclick="closeAppDrawerV40()" aria-label="Закрыть меню">×</button></div>
        <div class="app-drawer-list-v40">${drawerItemsV40().map(function(item,index){
          return `<button onclick="closeAppDrawerV40(); ${item.action}"><span class="app-drawer-number-v40">${String(index+1).padStart(2,'0')}</span><span class="app-drawer-copy-v40"><b>${esc(item.title)}</b><small>${esc(item.status)}</small></span><span class="app-drawer-arrow-v40">›</span></button>`;
        }).join('')}</div>
        <div class="app-drawer-footer-v40"><button onclick="closeAppDrawerV40(); renderProgressRulesV40()">Как считаются прогресс и баллы</button></div>
      </aside>
    </div>`;
  }

  window.installAppDrawerV40 = function(){
    if (!architectureV40Enabled()) return;
    var shellRoot = document.querySelector('.app-shell-v2');
    var header = document.querySelector('.app-header-v2');
    if (!shellRoot || !header) return;
    if (!header.querySelector('.app-menu-button-v40')) {
      var menuButton = document.createElement('button');
      menuButton.className = 'app-menu-button-v40';
      menuButton.setAttribute('aria-label','Открыть все разделы');
      menuButton.innerHTML = '<span></span><span></span><span></span>';
      menuButton.onclick = window.openAppDrawerV40;
      var mode = header.querySelector('.mode-pill');
      if (mode) header.insertBefore(menuButton, mode);
      else header.appendChild(menuButton);
    }
    if (!document.getElementById('app-drawer-overlay-v40')) {
      shellRoot.insertAdjacentHTML('beforeend', appDrawerHtmlV40());
    }
  };
  window.openAppDrawerV40 = function(){
    var overlay = document.getElementById('app-drawer-overlay-v40');
    if (!overlay) { installAppDrawerV40(); overlay = document.getElementById('app-drawer-overlay-v40'); }
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('app-drawer-open-v40');
  };
  window.closeAppDrawerV40 = function(){
    var overlay = document.getElementById('app-drawer-overlay-v40');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('app-drawer-open-v40');
  };

  function removeProfileModerationNoticeV40(){
    var notice = document.getElementById('forum-admin-profile-notification');
    if (notice) notice.remove();
  }
  window.removeProfileModerationNoticeV40 = removeProfileModerationNoticeV40;

  function injectProgressRulesCardV40(){
    removeProfileModerationNoticeV40();
    var content = document.querySelector('.content-v2');
    if (!content || document.getElementById('progress-rules-card-v40')) return;
    var supportCard = Array.from(content.querySelectorAll('.card-v2')).find(function(card){
      return card.querySelector('h2') && card.querySelector('h2').textContent.trim() === 'Поддержка';
    });
    var html = `<section class="card-v2 progress-rules-card-v40" id="progress-rules-card-v40"><p class="eyebrow">прозрачные правила</p><h2>Прогресс и баллы</h2><p>Прогресс считается по четырём этапам опубликованных уроков. Баллы начисляются отдельно: 10 + 10 + 10 + 70.</p><button class="btn secondary" onclick="renderProgressRulesV40()">Посмотреть расчёт</button></section>`;
    if (supportCard) supportCard.insertAdjacentHTML('beforebegin', html);
    else content.insertAdjacentHTML('beforeend', html);
  }

  var renderProfileBeforeHierarchyV40 = window.renderProfile;
  window.renderProfile = function(){
    var result = renderProfileBeforeHierarchyV40();
    setTimeout(injectProgressRulesCardV40,0);
    return result;
  };

  if (!window.__drawerEscapeV40) {
    window.__drawerEscapeV40 = true;
    document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeAppDrawerV40(); });
  }
})();



/* =====================================================
   v41 — понятные тексты, меню слева, три нижних пункта,
   запланированный общий прогресс и закрытые будущие разделы
   ===================================================== */
(function installArchitectureClarityV41(){
  window.APP_UI_VERSION_V41 = 'v41-clarity-left-menu-planned-progress-20260624';
  window.PLANNED_ENTREPRENEUR_LESSONS_V41 = 60;
  window.PLANNED_NO_BUSINESS_LESSONS_V41 = 10;
  window.PLANNED_EMPLOYEE_LESSONS_V41 = 10;
  window.PLANNED_LESSONS_TOTAL_V41 = 80;
  window.PLANNED_STAGES_TOTAL_V41 = 320;

  function architectureV41Enabled(){
    return typeof architectureModeV35 === 'function' && architectureModeV35();
  }

  function cleanLegacyExplanationsV41(value){
    var out = String(value == null ? '' : value);
    var pairs = [
      [/Проверка администратором не требуется\.?/gi, ''],
      [/Отправлять ссылку и ждать проверки администратора не нужно\.?/gi, 'Заполните рабочий шаблон, сформулируйте вывод и выберите действие с показателем проверки.'],
      [/Система ничего не блокирует раз в неделю и не требует принятия предыдущей работы\.?/gi, 'Открывайте любой опубликованный урок и проходите его в удобном темпе.'],
      [/Рекомендуемый порядок сохранён, но недельных блокировок и зависимости от проверки работы больше нет\.?/gi, 'Нумерация уроков показывает рекомендуемый порядок прохождения.'],
      [/Самостоятельные работы больше не требуют проверки\.?/gi, 'Самостоятельные работы помогают применить материал к своему бизнесу.'],
      [/Все остальные уроки доступны ученикам без недельного ожидания\.?/gi, 'Опубликованные уроки доступны ученикам.'],
      [/Форум не влияет на завершение урока\.?/gi, ''],
      [/Работы не отправляются на проверку\.?/gi, ''],
      [/Старую пропорцию мы пока сохраняем, чтобы не пересчитать уже накопленные баллы и уровни\.?/gi, ''],
      [/После проверки (?:администратором|работы|самостоятельной работы|ДЗ)[^.]*\.?/gi, ''],
      [/ждать проверки (?:администратора|работы|ДЗ)[^.]*\.?/gi, '']
    ];
    pairs.forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    return out.replace(/\s{2,}/g,' ').replace(/\s+([.,;:])/g,'$1').trim();
  }
  window.cleanLegacyExplanationsV41 = cleanLegacyExplanationsV41;

  /* Общий прогресс считается от всей запланированной программы:
     60 уроков предпринимателя + 10 базовых + 10 для сотрудников. */
  window.globalStageProgress = function(){
    var lessons = (state.catalog && Array.isArray(state.catalog.lessons)) ? state.catalog.lessons : [];
    var done = lessons.reduce(function(sum, lesson){
      return sum + (typeof lessonCompletedStageCount === 'function' ? lessonCompletedStageCount(lesson.code, lesson) : 0);
    }, 0);
    var total = window.PLANNED_STAGES_TOTAL_V41;
    return {
      done: Math.max(0, Math.min(total, done)),
      total: total,
      percent: total ? safePercent(done / total * 100) : 0,
      plannedLessons: window.PLANNED_LESSONS_TOTAL_V41
    };
  };
  window.totalProgressPercent = function(){ return globalStageProgress().percent; };

  /* Внутри каждого вида бизнеса прогресс считается от плана в 10 уроков. */
  window.getActivityProgressInfo = function(key){
    var lessons = activityLessons(key);
    var readyLessons = lessons.filter(isLessonPrepared);
    var routeTotal = 10 * 4;
    var stageDone = lessons.reduce(function(sum, lesson){
      return sum + lessonCompletedStageCount(lesson.code, lesson);
    }, 0);
    return {
      lessons: lessons,
      readyLessons: readyLessons,
      openCount: readyLessons.length,
      readyCount: readyLessons.length,
      doneCount: readyLessons.filter(isLessonFullyCompleted).length,
      routeTotal: routeTotal,
      stageDone: stageDone,
      routePercent: routeTotal ? safePercent(stageDone / routeTotal * 100) : 0
    };
  };
  window.currentActivityProgress = function(){
    return getActivityProgressInfo(state.selectedActivityKey).routePercent;
  };

  window.globalInstructionPanelHtml = function(){
    return `<div id="global-instruction-panel" class="global-instruction-panel" style="display:none">
      <div class="instruction-head"><b>Как пользоваться системой</b><button onclick="toggleGlobalInstruction(false)" aria-label="Закрыть инструкцию">×</button></div>
      <div class="instruction-steps">
        <div><b>1. Выберите нужный блок</b><p>Основной учебный маршрут находится в разделе «Я предприниматель». Дополнительные разделы открываются по мере публикации материалов.</p></div>
        <div><b>2. Откройте направление и урок</b><p>Выберите вид бизнеса и откройте любой опубликованный урок. Нумерация показывает рекомендуемую последовательность.</p></div>
        <div><b>3. Пройдите четыре этапа</b><p>В каждом уроке последовательно изучаются презентация, тест, саммари и самостоятельная работа.</p></div>
        <div><b>4. Перенесите материал в свой бизнес</b><p>Заполните рабочий шаблон, сформулируйте вывод, выберите конкретное действие и показатель проверки результата.</p></div>
        <div><b>5. Фиксируйте результат</b><p>Отмечайте завершённые этапы и возвращайтесь к сохранённым выводам, чтобы видеть движение по общей программе.</p></div>
      </div>
    </div>`;
  };

  window.homeworkReviewNoticeHtml = function(code){
    if (!(typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(code))) return '';
    var date = typeof selfStudyCompletedDateV39 === 'function' ? selfStudyCompletedDateV39(code) : null;
    return `<div class="homework-review-notice accepted self-study-complete-notice"><b>Самостоятельная работа выполнена</b><p>Отмечено ${date ? shortDate(date) : 'сейчас'}. Результат сохранён в прогрессе урока.</p></div>`;
  };

  window.renderActivityLessons = function(key){
    if (key && getActivity(key)) {
      state.selectedActivityKey = key;
      localStorage.setItem('lego_selected_activity', key);
    }
    var act = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
    var info = getActivityProgressInfo(act.key);
    var readyNote = info.readyCount
      ? 'Открывайте любой опубликованный урок. Нумерация показывает рекомендуемый порядок прохождения.'
      : 'В этом направлении пока нет опубликованных уроков.';
    var html = `
      ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">Я предприниматель</p><h1>${esc(act.title)}</h1><p>${esc(activityIntroText(act))}</p><p class="small">${esc(readyNote)}</p><div class="step-progress-block"><div class="step-summary-line"><span>Прогресс направления</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
      ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
      ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Уроки направления</h2><p>Опубликовано: <b>${info.readyCount} из 10</b>. Завершено уроков: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
    `;
    shell(html, 'learning');
  };

  window.renderHomework = async function(){
    var lesson = await loadLesson(state.selectedLessonCode);
    var code = state.selectedLessonCode;
    var activityKey = lesson.activityKey || state.selectedActivityKey;
    var completed = typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(code);
    if (!isAdminMode() && !isStageDone(code, 'books') && !completed) {
      shell(`${card('blue-card-v2', `<h1>Самостоятельная работа пока закрыта</h1><p>Сначала завершите презентацию, тест и саммари внутри этого урока.</p>`)}${card('', `<div class="grid-v2">${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}`,'homework');
      return;
    }
    if (!completed) await remoteSave('homework_started', { selfStudy: true });
    var hw = lesson.homework || {};
    var tableLabel = typeof selfStudyReplaceTextV39 === 'function' ? selfStudyReplaceTextV39(hw.buttonLabel || 'Открыть рабочий шаблон') : (hw.buttonLabel || 'Открыть рабочий шаблон');
    var instruction = sanitizeSelfStudyInstructionV41(hw.instructionHtml || `<h3>Практическая часть урока</h3><p>Заполните рабочий шаблон, сформулируйте вывод, выберите действие и показатель проверки.</p>`);
    var exampleUrl = hw.exampleUrl || hw.exampleSheetUrl || hw.sampleUrl || hw.exampleFileUrl || '';
    var completePanel = completed
      ? `<div class="self-study-completed-panel"><b>Работа отмечена выполненной</b><p>Вы можете вернуться к шаблону и уточнить свой вывод.</p></div>`
      : `<div class="self-study-checklist"><h3>Самопроверка перед завершением</h3>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я заполнил рабочий шаблон по своему бизнесу.</span></label>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я сформулировал главный вывод по ситуации.</span></label>
          <label><input type="checkbox" data-self-study-check="1" onchange="toggleSelfStudyReadyV39()"><span>Я выбрал конкретное действие и показатель проверки.</span></label>
          <button class="btn primary" id="self-study-complete-button" onclick="markSelfStudyCompletedV39()" disabled>Отметить работу выполненной</button>
        </div>`;
    shell(`${card('blue-card-v2 self-study-hero', `<p class="eyebrow">практика</p><h1>${esc(typeof selfStudyReplaceTextV39 === 'function' ? selfStudyReplaceTextV39(hw.title || 'Самостоятельная работа') : (hw.title || 'Самостоятельная работа'))}</h1><p>Заполните рабочий шаблон, сформулируйте вывод и выберите действие с показателем проверки.</p>`)}
      ${homeworkReviewNoticeHtml(code)}
      ${card('', `${instruction}<div class="grid-v2">${externalButton(tableLabel,homeworkSheetUrl(code, hw),'primary')}${exampleUrl ? externalButton('Открыть заполненный пример', exampleUrl, 'secondary') : ''}</div>${completePanel}<div class="grid-v2 self-study-nav"><button class="btn secondary" onclick="renderLessonHub()">← Вернуться к уроку</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}
      ${isAdminMode() ? card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии самопроверки</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`) : ''}`,'homework');
  };

  window.renderHomeworkStatus = function(){
    var code = state.selectedLessonCode;
    var meta = getLessonMeta(code);
    var activityKey = meta ? meta.activityKey : state.selectedActivityKey;
    if (!(typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(code))) return renderHomework();
    var date = typeof selfStudyCompletedDateV39 === 'function' ? selfStudyCompletedDateV39(code) : null;
    shell(`${card('blue-card-v2 self-study-status-card', `<p class="eyebrow">урок завершён</p><h1>Самостоятельная работа выполнена</h1><p>Отмечено ${date ? shortDate(date) : 'сейчас'}. Результат сохранён.</p>`)}${lessonTimelineHtml(code)}${card('', `<div class="grid-v2"><button class="btn primary" onclick="renderLessonHub()">К уроку</button><button class="btn secondary" onclick="renderHomework()">Открыть работу</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К выбору уроков</button></div>`)}`,'homework');
  };

  window.renderHomeworkCenter = function(){
    var lessons = (state.catalog && Array.isArray(state.catalog.lessons) ? state.catalog.lessons : []).filter(isLessonPrepared);
    shell(`${card('blue-card-v2 practice-center-hero', `<p class="eyebrow">практика</p><h1>Самостоятельные работы</h1><p>Применяйте материалы уроков к своему бизнесу и фиксируйте выполненные работы.</p>`)}${card('', `<div class="lesson-list-v2">${lessons.map(function(lesson){
      var completed = typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(lesson.code);
      var ready = isStageDone(lesson.code,'books') || completed || isAdminMode();
      var status = completed ? 'выполнена' : (ready ? 'можно выполнить' : 'откроется после саммари');
      return `<button class="lesson-row-v2 ${ready ? '' : 'locked'}" ${ready ? `onclick="openSelfStudyV39('${lesson.code}')"` : `onclick="openLesson('${lesson.code}')"`}><div><b>${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${status}</p></div><span>${completed ? '✓' : (ready ? '→' : '🔒')}</span></button>`;
    }).join('')}</div>`)}`,'homework');
  };

  window.renderProgressRulesV40 = function(){
    var gp = globalStageProgress();
    shell(`${card('blue-card-v2 progress-rules-hero-v40', `<p class="eyebrow">показатели системы</p><h1>Как считаются прогресс и баллы</h1><p>Общий прогресс показывает прохождение запланированной учебной программы. Баллы отражают выполненные действия внутри уроков и челленджа книг.</p>`)}
      ${card('', `<h2>Общий прогресс</h2><div class="planned-progress-breakdown-v41"><div><b>60 уроков</b><span>Я предприниматель</span></div><div><b>10 уроков</b><span>Нет своего бизнеса</span></div><div><b>10 уроков</b><span>Я сотрудник</span></div></div><p>Всего в программе заложено <b>80 уроков</b>. Каждый урок состоит из четырёх этапов, поэтому полный план равен <b>320 этапам</b>.</p><div class="score-rule-grid-v40 equal"><div><span>25%</span><b>Презентация</b></div><div><span>25%</span><b>Тест</b></div><div><span>25%</span><b>Саммари</b></div><div><span>25%</span><b>Самостоятельная работа</b></div></div><p class="small">Сейчас выполнено: <b>${gp.done} из ${gp.total}</b> этапов — <b>${gp.percent}%</b>.</p>`)}
      ${card('', `<h2>Баллы за один урок</h2><div class="score-rule-grid-v40"><div><span>10</span><b>Презентация</b></div><div><span>10</span><b>Тест</b></div><div><span>10</span><b>Саммари</b></div><div><span>70</span><b>Самостоятельная работа</b></div></div><p class="small">Полностью завершённый урок даёт 100 баллов.</p>`)}
      ${card('', `<h2>100 книг за 100 дней</h2><p>Челлендж имеет собственный прогресс. Его баллы прибавляются к общему количеству баллов, но книги не входят в процент прохождения основной программы из 80 уроков.</p><p class="small">Первый зачтённый день даёт 50 баллов. Далее награда растёт на 2 балла за каждый день серии.</p><button class="btn secondary" onclick="renderProfile()">Вернуться в профиль</button>`)}`,'profile');
  };
  window.renderPointsRulesV41 = window.renderProgressRulesV40;

  var renderMainBlockBeforeV41 = window.renderMainBlockCard;
  var studentLockedBlocksV41 = [
    'Нет своего бизнеса', 'Я сотрудник', 'Бизнес-форум', 'Газета',
    'Предпринимательские статьи', 'Прямые разборы', 'Что посмотреть',
    'Дополнительные материалы', 'VIP уровень'
  ];
  window.studentLockedBlocksV41 = studentLockedBlocksV41;
  function isStudentLockedBlockV41(title){
    return !isAdminMode() && studentLockedBlocksV41.includes(String(title || '').trim());
  }
  window.isStudentLockedBlockV41 = isStudentLockedBlockV41;

  window.renderMainBlockCard = function(title,text,status,action,cls){
    if (architectureV41Enabled() && isStudentLockedBlockV41(title)) {
      return renderMainBlockBeforeV41(title,text,'в подготовке','',(cls || '') + ' student-block-locked-v41');
    }
    return renderMainBlockBeforeV41(title,text,status,action,cls);
  };

  function financeIconV41(){
    return `<svg class="arch-nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/><path d="m4 7 5-3 5 5 6-6"/></svg>`;
  }

  var bottomNavBeforeV41 = window.bottomNav;
  window.bottomNav = function(active){
    if (!architectureV41Enabled()) return bottomNavBeforeV41(active);
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) return '';
    function activeItem(key,label,fn,icon){
      return `<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn}')">${icon}<b>${label}</b></button>`;
    }
    var homeIcon = `<span class="arch-nav-icon">${architectureNavIconV35('home')}</span>`;
    var profileIcon = `<span class="arch-nav-icon">${architectureNavIconV35('profile')}</span>`;
    var financeIcon = `<span class="arch-nav-icon">${financeIconV41()}</span>`;
    return `<nav class="bottom-nav-v2 v41-bottom-nav" aria-label="Основное меню">
      ${activeItem('home','Главная','renderHome',homeIcon)}
      <button class="bottom-item is-disabled-v41" type="button" disabled aria-disabled="true" title="Раздел в подготовке">${financeIcon}<b>Финансовый помощник</b><small>скоро</small></button>
      ${activeItem('profile','Профиль','renderProfile',profileIcon)}
    </nav>`;
  };

  function setupHeaderV41(){
    if (!architectureV41Enabled()) return;
    var header = document.querySelector('.app-header-v2');
    if (!header) return;
    header.querySelectorAll('.mode-pill').forEach(function(node){ node.remove(); });
    var menu = header.querySelector('.app-menu-button-v40');
    var brand = header.querySelector('.architecture-brand, .brand-lockup');
    if (menu) header.insertBefore(menu, header.firstChild);
    if (brand) header.appendChild(brand);
  }
  window.setupHeaderV41 = setupHeaderV41;

  function lockDrawerItemsV41(){
    var drawer = document.querySelector('.app-drawer-list-v40');
    if (!drawer) return;
    drawer.querySelectorAll(':scope > button').forEach(function(button){
      var title = button.querySelector('b') ? button.querySelector('b').textContent.trim() : '';
      var locked = isStudentLockedBlockV41(title);
      button.classList.toggle('student-locked-v41', locked);
      if (locked) {
        button.disabled = true;
        button.removeAttribute('onclick');
        button.onclick = null;
        var status = button.querySelector('small');
        if (status) status.textContent = 'в подготовке';
        var arrow = button.querySelector('.app-drawer-arrow-v40');
        if (arrow) arrow.textContent = '•';
      }
    });
  }
  window.lockDrawerItemsV41 = lockDrawerItemsV41;

  function cleanupProfileV41(){
    var content = document.querySelector('.content-v2');
    if (!content) return;
    var progressCard = document.getElementById('progress-rules-card-v40');
    if (progressCard) progressCard.remove();
    content.querySelectorAll('.my-business-card').forEach(function(cardNode){ cardNode.remove(); });
    var bossText = content.querySelector('.boss-panel-card p.small');
    if (bossText) bossText.textContent = 'Панель управления и предпросмотр контента доступны только владельцу системы.';
    var scoreGrid = content.querySelector('.profile-score-grid');
    if (scoreGrid) {
      Array.from(scoreGrid.children).forEach(function(metric){
        var label = metric.querySelector('span');
        if (!label || label.textContent.trim() !== 'Всего баллов') return;
        metric.classList.add('points-metric-v41');
        if (!metric.querySelector('.points-help-v41')) {
          var help = document.createElement('button');
          help.type = 'button';
          help.className = 'points-help-v41';
          help.setAttribute('aria-label','Как начисляются баллы');
          help.textContent = '?';
          help.onclick = function(){ renderPointsRulesV41(); };
          metric.appendChild(help);
        }
      });
    }
  }
  window.cleanupProfileV41 = cleanupProfileV41;

  var shellBeforeV41 = window.shell;
  window.shell = function(content, activeTab){
    var result = shellBeforeV41(cleanLegacyExplanationsV41(content), activeTab);
    setupHeaderV41();
    setTimeout(function(){
      setupHeaderV41();
      lockDrawerItemsV41();
      removeProfileModerationNoticeV40();
    },0);
    return result;
  };

  var renderProfileBeforeV41 = window.renderProfile;
  window.renderProfile = function(){
    var result = renderProfileBeforeV41();
    setTimeout(function(){
      cleanupProfileV41();
      setupHeaderV41();
      lockDrawerItemsV41();
    },0);
    return result;
  };

  if (typeof window.studentRoleLabel === 'function') {
    window.studentRoleLabel = function(){ return isAdminMode() ? 'Администратор' : 'участник'; };
  }

  window.renderRoutesHubV40 = function(){ return renderLearning(); };

  /* Даже прямой вызов будущего раздела не открывает его ученику. */
  [
    ['renderNoBusinessV40','Нет своего бизнеса'],
    ['renderEmployeeRouteV40','Я сотрудник'],
    ['openForumBlockV40','Бизнес-форум'],
    ['renderNewspaperV40','Газета'],
    ['renderEntrepreneurArticlesV40','Предпринимательские статьи'],
    ['renderDirectReviewsV40','Прямые разборы'],
    ['renderWatchV40','Что посмотреть'],
    ['renderAdditionalMaterials','Дополнительные материалы'],
    ['renderVipV40','VIP уровень']
  ].forEach(function(row){
    var name = row[0];
    var title = row[1];
    var original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function(){
      if (!isAdminMode()) {
        alert('Раздел «' + title + '» находится в подготовке.');
        return renderHome();
      }
      return original.apply(this, arguments);
    };
  });

  window.renderHome = (function(renderHomeBeforeV41){
    return function(){
      if (!architectureV41Enabled()) return renderHomeBeforeV41();
      var gp = globalStageProgress();
      var points = totalPoints();
      var titleInfo = studentTitleInfo();
      var html = `
        ${card('hero-dashboard main-dashboard-card architecture-dashboard v40-dashboard v41-dashboard', `
          <div class="architecture-dashboard-head">
            <div>
              <div class="eyebrow-row"><p class="eyebrow">ваша система</p><button class="instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button></div>
              <h1>Общий прогресс</h1>
              <p>Завершено <b>${gp.done} из ${gp.total}</b> этапов общей программы.</p>
            </div>
            ${compactProgressRing(gp.percent)}
          </div>
          <div class="architecture-metrics">
            <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
            <div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div>
            <div><span>Достижение</span><b>${esc(titleInfo.current.title)}</b></div>
          </div>
          ${globalInstructionPanelHtml()}
        `)}
        ${card('architecture-blocks-card v40-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">структура приложения</p><h2>Выберите блок</h2></div><p>Основные и дополнительные разделы собраны в единой структуре.</p></div>${primaryRoutesHtmlV40()}${secondaryBlocksHtmlV40()}`)}
        ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
      `;
      shell(html,'home');
    };
  })(window.renderHome);

  window.renderAdmin = function(){
    if (!isAdminUser()) { alert('Нет прав администратора.'); return; }
    var forumBlock = typeof window.renderBusinessForum === 'function'
      ? card('', `<h2>Бизнес-форум</h2><p>Администраторский доступ используется для настройки и тестирования форума.</p><button class="btn primary" onclick="renderBusinessForum()">Открыть форум</button>`)
      : '';
    shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Здесь собраны предпросмотр опубликованных уроков, книги челленджа и тестовые разделы.</p>`)}
      ${card('', `<h2>100 книг за 100 дней</h2><div class="grid-v2"><button class="btn primary" onclick="books100AdminRepairAllV25()">Проверить зачёты книг</button><button class="btn secondary" onclick="renderBookChallenge()">Открыть книги челленджа</button></div>`)}
      ${forumBlock}
      ${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${(state.catalog?.lessons || []).map(function(lesson){
        var ready = isLessonPrepared(lesson);
        return `<button class="lesson-row-v2 ${ready ? '' : 'locked'}" ${ready ? `onclick="openLesson('${lesson.code}')"` : 'disabled'}><div><b>${esc(lesson.code)} · ${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${ready ? 'опубликован' : 'в подготовке'} · ${lesson.slidesCount} слайдов · ${lesson.quizCount} вопросов · ${lesson.bookScreensCount} саммари</p></div><span>${ready ? '→' : '🔒'}</span></button>`;
      }).join('')}</div>`)}`,'profile');
  };
})();

(function protectScreensV32(){
  const protectedNames = [
    "renderHome",
    "renderLearning",
    "renderHomeworkCenter",
    "renderProfile",
    "renderAdmin",
    "renderLessonHub",
    "renderActivityLessons",
    "renderAdditionalMaterials",
    "openLesson",
    "renderLesson",
    "renderLessonStage",
    "renderLessonStageScreen",
    "nextSlide",
    "prevSlide",
    "nextBookScreen",
    "prevBookScreen",
    "submitQuiz",
    "renderBookChallenge",
    "startBookChallenge",
    "openBooks100Book",
    "renderBooks100Reading",
    "renderBooks100Quiz",
    "selectBooks100Answer",
    "finishBooks100Quiz"
  ];

  protectedNames.forEach(function(name) {
    const original = window[name];
    if (typeof original !== "function" || original.__accessGateV32) return;

    const guarded = function(...args) {
      if (!hasVerifiedAccessV32()) {
        accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
        return;
      }
      return original.apply(this, args);
    };

    guarded.__accessGateV32 = true;
    window[name] = guarded;
  });
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
