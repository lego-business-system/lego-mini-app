
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
const APP_CACHE_VERSION = "v86-finance-student-open-manual-callouts-20260629";
const MODULE_SCORE_RULES = { presentation: 10, quiz: 10, books: 10, homeworkVerified: 70, total: 100 };
const CONSULTATION_COST = 25000;
const READY_FIRST_LESSON_CODES = ["ENT-TR-01", "ENT-SV-01", "ENT-PR-01", "ENT-BD-01"];

const state = {
  access: false,
  accessReason: null,
  user: null,
  role: "student",
  appMode: "student", // student | admin; при новом входе администратор сначала видит приложение как ученик
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
  if (mode === "admin" && !isAdminUser()) { alert("Режим администрирования доступен только владельцу."); return; }
  // Вход в приложение всегда начинается с режима ученика.
  // Режим администрирования включается вручную и не сохраняется как стартовый режим.
  state.appMode = mode === "admin" ? "admin" : "student";
  try { localStorage.setItem("lego_app_mode", "student"); } catch(e) {}
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
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Администрирование" : "Режим ученика"}</button>`
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
    ${card('blue-card-v2', `<h1>Я предприниматель</h1><p>Сначала выбирается вид деятельности. После выбора откроется маршрут из 10 уроков внутри конкретного направления.</p>${isAdminMode() ? '<p class="small admin-note">Режим администрирования: после выбора направления будут доступны все уроки.</p>' : ''}`)}
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
    ? card('', `<h2>Режим работы</h2><p>Этот блок виден только администратору. У обычного участника переключателя режима и админ-панели нет.</p><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Администрирование</button></div><p class="small">Проверка администратора идёт по Telegram ID / username и роли, которую возвращает проверка доступа.</p>`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${isAdminUser()?'Администратор':'участник'}</p>`)}${card('', `<h2>Баллы и общий прогресс</h2><p>Общие баллы и общий прогресс хранятся здесь, чтобы не дублировать их внутри каждого направления.</p>${progressRing(total,'общий','по всем урокам')}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${totalScore}</b></div><div><span>Текущий урок</span><b>${activeScore} / 100</b></div></div>`)}${adminBlock}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}${isAdminUser()?actionButton('Панель администратора','renderAdmin()','primary'):''}`)}`,'profile');
}
function renderAdmin(){ if(!isAdminUser()){alert('Нет прав администратора.'); return;} shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Полный доступ ко всем урокам, предпросмотр контента и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile'); }
async function adminReview(action){ const target=$('admin-target-user')?.value.trim(); const comment=$('admin-review-comment')?.value.trim(); if(!target){alert('Укажите ученика.'); return;} if(action==='reject_homework'&&!comment){alert('Для доработки нужен комментарий.'); return;} if(!tg||!tg.initData){alert('Администраторская проверка работает внутри Telegram WebApp.'); return;} const res=await fetch(ADMIN_REVIEW_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData,lessonCode:state.selectedLessonCode,targetUser:target,action,comment,checkedAt:nowIso(),homeworkScore:70})}); const out=await res.json().catch(()=>({})); alert(out.ok?'Готово. Статус обновлён.':('Ошибка: '+(out.reason||out.error||'неизвестно'))); }
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
    // Новый вход всегда начинается в режиме ученика, даже для администратора.
    state.appMode = 'student';
    try { localStorage.setItem('lego_app_mode','student'); } catch(e) {}
    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if(result.progress && result.lesson && result.lesson.code) state.remoteProgressByLesson[result.lesson.code]=result.progress;
    // v65: администратор при новом входе остаётся в режиме ученика; администрирование включается вручную.
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
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Администрирование" : "Режим ученика"}</button>`
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
    ${card('blue-card-v2', `<h1>Я предприниматель</h1><p>Сначала выбирается вид деятельности. После выбора откроется маршрут из 10 уроков внутри конкретного направления.</p>${isAdminMode() ? '<p class="small admin-note">Режим администрирования: после выбора направления будут доступны все уроки.</p>' : ''}`)}
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
    ? card('', `<h2>Режим работы</h2><p>Этот блок виден только администратору. У обычного участника переключателя режима и админ-панели нет.</p><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Администрирование</button></div><p class="small">Проверка администратора идёт по Telegram ID / username и роли, которую возвращает проверка доступа.</p>`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${isAdminUser()?'Администратор':'участник'}</p>`)}${card('', `<h2>Прогресс и баллы</h2><p>Прогресс считается по этапам доступных уроков. Баллы используются отдельно как мотивационная система.</p>${progressRing(gp.percent,'общий',`${gp.done} из ${gp.total || 0} этапов`)}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${formatPoints(totalScore)}</b></div><div><span>Текущий урок</span><b>${lp.done} / ${lp.total}</b></div><div><span>Консультация</span><b>${consultationCostText()}</b></div><div><span>Готовые уроки</span><b>${readyCoreLessons().length}</b></div></div>`)}${adminBlock}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}${externalButton('Получить консультацию — '+consultationCostText(),CONSULTATION_FORM_URL,'primary')}${isAdminUser()?actionButton('Панель администратора','renderAdmin()','primary'):''}`)}`,'profile');
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

function adminLabel() { return "Администратор"; }
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
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Администрирование" : "Режим ученика"}</button>`
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
    ? card('boss-panel-card', `<h2>Панель администратора</h2><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Режим администрирования</button></div><p class="small">Панель управления, проверка ДЗ и полный предпросмотр уроков доступны только владельцу системы.</p>${actionButton('Открыть панель администратора','renderAdmin()','primary')}`)
    : '';
  shell(`${card('blue-card-v2', `<h1>Профиль</h1><p>${esc(state.user?.first_name || 'Пользователь')} · ${studentRoleLabel()}</p>`)}${titleCardHtml()}${card('', `<h2>Прогресс и баллы</h2>${progressRing(gp.percent,'общий',`${gp.done} из ${gp.total || 0} этапов`)}<div class="profile-score-grid"><div><span>Всего баллов</span><b>${formatPoints(points)}</b></div><div><span>Текущий урок</span><b>${lp.done} / ${lp.total}</b></div><div><span>Учебные единицы</span><b>${formatPoints(titleInfo.units)}</b></div><div><span>Готовые уроки</span><b>${readyCoreLessons().length}</b></div></div>`)}${doneSummaryHtml()}${insightsProfileHtml()}${adminBlock}${consultationCardsHtml(points)}${card('', `<h2>Поддержка</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}`)}`,'profile');
}
function renderAdmin(){
  if(!isAdminUser()){ alert('Нет прав администратора.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Полный доступ ко всем урокам, предпросмотр контента и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile');
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
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки Администратор примет ДЗ или вернёт его на доработку.</p></div>`;
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
async function sendInsightToAdmin(entry) {
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
    const result = await sendInsightToAdmin(entry);
    if (!result.ok) {
      console.warn('INSIGHT_SHARE_LOCAL_ONLY', result);
      alert('Вывод сохранён и отмечен для передачи администратору. Для автоматической передачи нужно подключить функцию save-insight в Supabase.');
    }
  }
  if (input) input.value = '';
  renderLessonHub();
}
function lessonInsightCard() {
  const list = loadInsights().filter(x => x.lessonCode === state.selectedLessonCode).slice(0,3);
  return card('insight-card', `<h2>Мой вывод по уроку</h2><p>Сохраняйте здесь главный вывод или короткие заметки по уроку. Это поможет вернуться к мысли перед ДЗ и следующим действием.</p><textarea id="lesson-insight-input" rows="3" placeholder="Например: главное ограничение сейчас не в потоке, а в переходе заявки в оплату..."></textarea><label class="share-insight-check"><input type="checkbox" id="lesson-insight-share"><span>Поделиться этим выводом с администратором</span></label><button class="btn primary" onclick="saveLessonInsight()">Сохранить вывод</button>${list.length ? `<div class="insight-list-mini">${list.map(x=>`<div><b>${shortDate(x.createdAt)}${x.shared ? ' · отправить администратору' : ''}</b><p>${esc(x.text)}</p></div>`).join('')}</div>` : ''}`);
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
  return card('insight-card', `<h2>Мои выводы</h2><p>Короткие управленческие выводы и заметки, которые вы сохранили внутри уроков.</p>${list.length ? `<div class="insight-list">${list.map(x=>`<div><div><b>${esc(x.activityTitle || '')} · ${esc(x.lessonTitle || x.lessonCode)}</b><span>${shortDate(x.createdAt)}${x.shared ? ' · отмечено для администратора' : ''}</span><p>${esc(x.text)}</p></div><button onclick="deleteInsight('${x.id}')">×</button></div>`).join('')}</div>` : '<p class="small">Пока выводов нет. Откройте урок и сохраните первый вывод после презентации или саммари.</p>'}`);
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
    ? card('boss-panel-card', `<h2>Панель администратора</h2><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр как ученик</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Режим администрирования</button></div><p class="small">Панель управления, проверка ДЗ и полный предпросмотр уроков доступны только владельцу системы.</p>${actionButton('Открыть панель администратора','renderAdmin()','primary')}`)
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
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(submittedAt)}. После проверки Администратор примет ДЗ или вернёт его на доработку.</p></div>`;
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
  const status = admin ? 'доступно администратору' : books100StatusForBook(bookMeta, ch);
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
      const html = `${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим администратора</p><h1>100 книг за 100 дней</h1><p>В режиме администратора все загруженные книги открыты для просмотра без таймера, без блокировок и без начисления баллов.</p>`)}
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
    resultNotice = `<p>Это режим администратора. Баллы, серия и учебные единицы не изменяются.</p>`;
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
  if(!isAdminUser()){ alert('Нет прав администратора.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Полный доступ ко всем урокам, предпросмотр контента, книги челленджа и проверка ДЗ.</p>`)}${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}${card('', `<h2>Книги челленджа</h2><p>В режиме администратора все загруженные книги доступны для просмотра без таймера и без начисления баллов.</p><button class="btn primary" onclick="renderBookChallenge()">Открыть книги челленджа</button>`)}${card('', `<h2>Проверка ДЗ</h2><input id="admin-target-user" placeholder="Telegram ID или username ученика"><textarea id="admin-review-comment" placeholder="Комментарий проверяющего"></textarea><button class="btn primary" onclick="adminApproveTargetUser()">Принять ДЗ</button><button class="btn secondary" onclick="adminRejectTargetUser()">Отправить на доработку</button>`)}`,'profile');
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
  if (!isAdminMode()) return alert("Сброс доступен только администратору.");
  if (!confirm("Сбросить своё тестовое состояние челленджа?")) return;
  try { await books100ApiV18("reset", {}); } catch(e){ console.error(e); }
  state.books100ServerState = null; localStorage.removeItem(BOOKS100_STORAGE_KEY); renderBookChallenge();
}
async function forceBooks100Miss(){
  if (!isAdminMode()) return alert("Тест пропуска доступен только администратору.");
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
  const status = admin ? "доступно администратору" : books100StatusForBook(bookMeta, ch);
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
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим администратора</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов.</p>`)}
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
  if (state.books100AdminPreview){ resultNotice = `<p>Это режим администратора. Баллы, серия и учебные единицы не изменяются.</p>`; }
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
      shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим администратора</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов.</p>`)}
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
    resultNotice = `<p>Это режим администратора. Баллы, серия и учебные единицы не изменяются.</p>`;
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
  const status = admin ? "доступно администратору" : books100StatusForBook(bookMeta, ch);
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
    shell(`${card('blue-card-v2 books100-hero', `<p class="eyebrow">режим администратора</p><h1>100 книг за 100 дней</h1><p>Все загруженные книги открыты для просмотра без таймера, блокировок и начисления баллов. Список показывается без тяжёлых обложек, чтобы открываться быстро.</p>`)}
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
  if(!isAdminMode()) return alert("Сброс доступен только администратору.");
  if(!confirm("Сбросить своё тестовое состояние челленджа?")) return;
  try{ await books100ApiV20("reset", {}, { timeoutMs: 10000 }); }catch(e){ console.error(e); }
  state.books100ServerState = null;
  localStorage.removeItem(BOOKS100_STORAGE_KEY);
  renderBookChallenge();
}
async function forceBooks100Miss(){
  if(!isAdminMode()) return alert("Тест пропуска доступен только администратору.");
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
  if (hw.key === "revision") return `<div class="homework-review-notice revision"><b>Домашнее задание на доработке</b><p>Проверьте комментарий администратора, уточните вывод и отправьте форму повторно.</p></div>`;
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
    return `<div class="homework-review-notice"><b>Домашнее задание на проверке</b><p>Работа отправлена ${shortDate(stageCompletedDate(code,'homeworkSubmitted'))}. После проверки Администратор примет ДЗ или вернёт его на доработку.</p></div>`;
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
  if(!isAdminUser()){ alert('Нет прав администратора.'); return; }
  shell(`${card('blue-card-v2', `<h1>Панель администратора</h1><p>Проверка ДЗ теперь привязана к конкретному уроку. Сначала найдите работы ученика или выберите урок вручную.</p>`)}
    ${card('', `<h2>Проверка ДЗ</h2><p class="small">Комментарий сохраняется внутри статуса ДЗ. Telegram-сообщение ученику появится только после отдельного подключения бота уведомлений.</p><input id="admin-target-user" placeholder="Telegram ID или username ученика"><select id="admin-lesson-code" class="admin-select-v25">${adminLessonOptionsV25()}</select><textarea id="admin-review-comment" placeholder="Комментарий проверяющего. Для доработки обязателен."></textarea><div class="grid-v2"><button class="btn secondary" onclick="adminLoadHomeworkQueueV25()">Найти ДЗ ученика</button><button class="btn secondary" onclick="adminLoadHomeworkQueueV25('all')">Показать все ДЗ на проверке</button><button class="btn primary" onclick="adminReviewManualV25('approve_homework')">Принять выбранный урок</button><button class="btn secondary" onclick="adminReviewManualV25('reject_homework')">Вернуть выбранный урок на доработку</button></div><div id="admin-homework-queue" class="admin-homework-queue-v25"></div>`) }
    ${card('', `<h2>100 книг за 100 дней</h2><p>Можно восстановить зачёты из успешных попыток теста, если после обновлений часть статусов стала отображаться неверно.</p><div class="grid-v2"><button class="btn primary" onclick="books100AdminRepairAllV25()">Проверить и восстановить зачёты книг</button><button class="btn secondary" onclick="renderBookChallenge()">Открыть книги челленджа</button></div>`)}
    ${card('', `<h2>Все уроки</h2><div class="lesson-list-v2">${state.catalog.lessons.map(l=>`<button class="lesson-row-v2" onclick="openLesson('${l.code}')"><div><b>${esc(l.code)} · ${esc(l.title)}</b><p>${esc(l.activityTitle)} · ${l.slidesCount} слайдов · ${l.quizCount} вопросов · ${l.bookScreensCount} саммари</p></div><span>→</span></button>`).join('')}</div>`)}`,'profile');
}
async function adminApiV25(payload){
  if(!tg || !tg.initData) throw new Error('Администраторская проверка работает только внутри Telegram WebApp.');
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
  if(!isAdminMode()) return alert('Доступно только в режиме администратора.');
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
    ? `<button class="mode-pill ${isAdminMode() ? "admin" : "student-preview"}" onclick="renderProfile()">${isAdminMode() ? "Администрирование" : "Режим ученика"}</button>`
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

    // Новый вход всегда начинается в режиме ученика, даже для администратора.
    state.appMode = 'student';
    try { localStorage.setItem('lego_app_mode', 'student'); } catch(e) {}

    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if (result.progress && result.lesson && result.lesson.code) {
      state.remoteProgressByLesson[result.lesson.code] = result.progress;
    }
    // v65: администратор при новом входе остаётся в режиме ученика; администрирование включается вручную.

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
  return 'assets/brand/' + name + '?v=v43-library-systems-compact-header-points-20260624';
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
    ${card('blue-card-v2 architecture-section-head', `<p class="eyebrow">маршрут собственника</p><h1>Я предприниматель</h1><p>Выберите вид деятельности. Внутри каждого направления — последовательный путь из уроков, тестов, саммари и практических заданий.</p>${isAdminMode() ? '<p class="small admin-note">Режим администрирования: доступны все подготовленные материалы.</p>' : ''}`)}
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
    state.appMode = 'student';
    localStorage.setItem('lego_app_mode', 'student');
    state.remoteProgressByLesson = result.progress_by_lesson || result.progressByLesson || {};
    if (result.progress && result.lesson && result.lesson.code) state.remoteProgressByLesson[result.lesson.code] = result.progress;
    // v65: администратор при новом входе остаётся в режиме ученика; администрирование включается вручную.
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
    [/Панель администратора Л\.Е\.Г\.О\.?/g, 'Панель администратора'],
    [/администратору Л\.Е\.Г\.О\.?/g, 'администратору'],
    [/администратора Л\.Е\.Г\.О\.?/g, 'администратора'],
    [/Администратор Л\.Е\.Г\.О\.?/g, 'Администратор'],
    [/Ученик Л\.Е\.Г\.О\.?/g, 'Участник'],
    [/Мастер Л\.Е\.Г\.О\.?/g, 'Мастер системного управления'],
    [/Режим администрирования/g, 'Режим администрирования'],
    [/администратору/g, 'администратору'],
    [/администратора/g, 'администратора'],
    [/администратором/g, 'администратором'],
    [/Администратор/g, 'Администратор'],
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
    var adminText = content.querySelector('.boss-panel-card p.small');
    if (adminText) adminText.textContent = 'Панель управления и предпросмотр контента доступны только владельцу системы.';
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

/* =====================================================
   v43 — АРХИТЕКТУРА как Библиотека бизнес-систем:
   широкая шапка, равные баллы, завершение урока при
   открытии рабочего шаблона и компактный профиль.
   ===================================================== */
(function installArchitectureLibrarySystemsV43(){
  window.APP_UI_VERSION_V43 = 'v43-library-systems-compact-header-points-20260624';
  window.MODULE_SCORE_RULES_V43 = { presentation:25, quiz:25, books:25, selfStudy:25, total:100 };

  function architectureV43Enabled(){
    return typeof architectureModeV35 === 'function' && architectureModeV35();
  }

  function libraryPositioningTextV43(value){
    var out = String(value == null ? '' : value);
    var pairs = [
      [/запланированной учебной программы/gi, 'запланированной структуры библиотеки'],
      [/учебной программы/gi, 'библиотеки бизнес-систем'],
      [/учебная программа/gi, 'библиотека бизнес-систем'],
      [/основной учебный маршрут/gi, 'основной маршрут библиотеки'],
      [/учебный маршрут/gi, 'маршрут по бизнес-системам'],
      [/учебные материалы/gi, 'материалы библиотеки'],
      [/обучающие материалы/gi, 'материалы библиотеки'],
      [/учебные единицы/gi, 'единицы освоения'],
      [/учебная единица/gi, 'единица освоения'],
      [/учебную единицу/gi, 'единицу освоения'],
      [/учебной единицы/gi, 'единицы освоения'],
      [/учебных единиц/gi, 'единиц освоения'],
      [/учебными единицами/gi, 'единицами освоения'],
      [/учебным единицам/gi, 'единицам освоения'],
      [/учебным прогрессом/gi, 'прогрессом библиотеки'],
      [/учебного опыта/gi, 'опыта работы с системами'],
      [/учебный опыт/gi, 'опыт работы с системами'],
      [/уровень ученика/gi, 'уровень освоения'],
      [/Ученик операционного цикла/gi, 'Практик операционного цикла'],
      [/прохождение программы/gi, 'освоение библиотеки'],
      [/общей программы/gi, 'общей структуры библиотеки'],
      [/в программе заложено/gi, 'в библиотеке запланировано'],
      [/основной программы/gi, 'основной библиотеки систем'],
      [/порядок обучения/gi, 'последовательность работы'],
      [/основной логики обучения/gi, 'основной логики библиотеки'],
      [/дополняют обучение и практику/gi, 'дополняют библиотеку и практику'],
      [/маршруты обучения/gi, 'маршруты по системам']
    ];
    pairs.forEach(function(pair){ out = out.replace(pair[0], pair[1]); });
    return out;
  }
  window.libraryPositioningTextV43 = libraryPositioningTextV43;

  /* Каждый из четырёх этапов даёт одинаковые 25 баллов. */
  window.lessonScore = function(code){
    var score = 0;
    if (isStageDone(code,'presentation')) score += 25;
    if (isStageDone(code,'quiz')) score += 25;
    if (isStageDone(code,'books')) score += 25;
    if (isStageDone(code,'homeworkVerified')) score += 25;
    return score;
  };
  window.totalPoints = function(){
    var lessonPoints = (state.catalog?.lessons || []).reduce(function(sum, lesson){
      return sum + lessonScore(lesson.code);
    }, 0);
    var challenge = typeof getChallengeState === 'function' ? getChallengeState() : {};
    var challengeValue = typeof challengePoints === 'function' ? challengePoints(challenge) : 0;
    return lessonPoints + Number(challengeValue || 0);
  };

  window.globalInstructionPanelHtml = function(){
    return `<div id="global-instruction-panel" class="global-instruction-panel" style="display:none">
      <div class="instruction-head"><b>Как пользоваться библиотекой</b><button onclick="toggleGlobalInstruction(false)" aria-label="Закрыть инструкцию">×</button></div>
      <div class="instruction-steps">
        <div><b>1. Выберите нужный блок</b><p>В библиотеке собраны архитектуры, системы, разборы, шаблоны и дополнительные материалы для разных задач бизнеса.</p></div>
        <div><b>2. Откройте направление</b><p>В разделе «Я предприниматель» выберите вид бизнеса и любой опубликованный урок. Нумерация показывает рекомендуемую последовательность.</p></div>
        <div><b>3. Разберите систему</b><p>Каждый урок включает презентацию, тест, саммари и рабочий шаблон для применения материала.</p></div>
        <div><b>4. Примените к своему бизнесу</b><p>Заполните шаблон, сформулируйте вывод, выберите конкретное действие и показатель проверки результата.</p></div>
        <div><b>5. Возвращайтесь к материалам</b><p>Используйте сохранённые выводы, шаблоны и системы повторно, когда меняется задача или появляются новые данные.</p></div>
      </div>
    </div>`;
  };

  window.primaryRoutesHtmlV40 = function(){
    return `<div class="top-track-grid architecture-main-tracks-v40">
      ${renderMainBlockCard('Я предприниматель','Архитектуры управления по шести видам бизнеса: системы, схемы, тесты, конспекты и рабочие шаблоны.','доступно','renderLearning()','active main-block-card v40-primary-card')}
      ${renderMainBlockCard('Нет своего бизнеса','Системы подготовки к запуску: выбор модели, проверка идеи, экономика и первые управленческие решения.','скоро','renderNoBusinessV40()','soon main-block-card v40-primary-card')}
      ${renderMainBlockCard('Я сотрудник','Материалы для руководителей, управляющих и ключевых сотрудников: процессы, ответственность и показатели.','скоро','renderEmployeeRouteV40()','soon main-block-card v40-primary-card')}
    </div>`;
  };

  window.secondaryBlocksHtmlV40 = function(){
    var forumReady = Boolean(typeof forumVisibleInNavigationV38 === 'function' && forumVisibleInNavigationV38() && typeof window.renderBusinessForum === 'function');
    var forumStatus = forumReady ? (isAdminMode() ? 'тестирование' : 'доступно') : 'в подготовке';
    var forumClass = forumReady ? 'active' : 'soon';
    return `<div class="secondary-track-grid-v22 architecture-secondary-tracks-v40">
      ${renderMainBlockCard('Бизнес-форум','Вопросы по системам, обсуждение практических ситуаций и обмен опытом участников.',forumStatus,'openForumBlockV40()',forumClass + ' compact-card')}
      ${renderMainBlockCard('100 книг за 100 дней','Ежедневная книга, конспект, мини-тест, единицы освоения и серия баллов.','доступно','renderBookChallenge()','active books100-entry compact-card')}
      ${renderMainBlockCard('Газета','Новости бизнеса и приложения в формате цифровых газетных выпусков.','скоро','renderNewspaperV40()','soon compact-card')}
      ${renderMainBlockCard('Предпринимательские статьи','Практические статьи о ситуациях, цифрах, решениях и последствиях.','скоро','renderEntrepreneurArticlesV40()','soon compact-card')}
      ${renderMainBlockCard('Прямые разборы','Гарвардские и другие бизнес-кейсы с разбором вариантов решения.','скоро','renderDirectReviewsV40()','soon compact-card')}
      ${renderMainBlockCard('Что посмотреть','Фильмы, интервью, лекции и видео с управленческими выводами.','скоро','renderWatchV40()','soon compact-card')}
      ${renderMainBlockCard('Дополнительные материалы','Шаблоны, инструкции, документы и инструменты вне основных направлений.','скоро','renderAdditionalMaterials()','soon compact-card')}
      ${renderMainBlockCard('VIP уровень','Расширенные разборы, инструменты и закрытые возможности.','в разработке','renderVipV40()','soon compact-card')}
    </div>`;
  };

  var renderLearningBeforeV43 = window.renderLearning;
  window.renderLearning = function(){
    if (!architectureV43Enabled()) return renderLearningBeforeV43();
    var html = `
      ${card('blue-card-v2 architecture-section-head', `<p class="eyebrow">библиотека систем собственника</p><h1>Я предприниматель</h1><p>Выберите вид деятельности. Внутри каждого направления собраны архитектуры, схемы, тесты, конспекты и рабочие шаблоны для применения в бизнесе.</p>${isAdminMode() ? '<p class="small admin-note">Администратору доступны все опубликованные материалы.</p>' : ''}`)}
      ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
      <div class="activity-grid-v2 architecture-activity-grid">
        ${(state.catalog?.activities || []).map(function(activity){
          var info = getActivityProgressInfo(activity.key);
          var text = String(activity.description || activity.chain || activityIntroText(activity)).trim();
          var available = isAdminMode() || Number(info.readyCount || 0) > 0;
          var status = available ? `${info.readyCount} из 10 опубликовано` : 'в подготовке';
          return `<button class="activity-card-v2 ${activity.key===state.selectedActivityKey?'active':''} ${available?'':'locked'}" ${available?`onclick="renderActivityLessons('${activity.key}')"`:'disabled'}>
            <span class="activity-line-icon">${typeof architectureActivityIconV35 === 'function' ? architectureActivityIconV35(activity.key) : '•'}</span>
            <b>${esc(activity.title)}</b><small>${esc(text)}</small><em>${esc(status)}</em>
          </button>`;
        }).join('')}
      </div>`;
    shell(html,'learning');
  };

  var renderActivityLessonsBeforeV43 = window.renderActivityLessons;
  window.renderActivityLessons = function(key){
    if (!architectureV43Enabled()) return renderActivityLessonsBeforeV43(key);
    if (key && getActivity(key)) {
      state.selectedActivityKey = key;
      localStorage.setItem('lego_selected_activity', key);
    }
    var activity = getActivity(state.selectedActivityKey) || state.catalog.activities[0];
    var info = getActivityProgressInfo(activity.key);
    var note = info.readyCount ? 'Открывайте любой опубликованный урок. Нумерация показывает рекомендуемый порядок работы с материалами.' : 'В этом направлении пока нет опубликованных материалов.';
    var html = `
      ${card('blue-card-v2 activity-progress-head', `<p class="eyebrow">библиотека систем</p><h1>${esc(activity.title)}</h1><p>${esc(activityIntroText(activity))}</p><p class="small">${esc(note)}</p><div class="step-progress-block"><div class="step-summary-line"><span>Освоение направления</span><b>${info.routePercent}%</b></div>${progressBarHtml(info.routePercent,'on-dark')}</div>`)}
      ${typeof entrepreneurCurrentStepCard === 'function' ? entrepreneurCurrentStepCard() : ''}
      ${card('', `<div class="activity-toolbar"><button class="btn secondary" onclick="renderLearning()">К видам деятельности</button></div><h2>Материалы направления</h2><p>Опубликовано: <b>${info.readyCount} из 10</b>. Завершено: <b>${info.doneCount}</b>.</p><div class="lesson-list-v2">${info.lessons.map(renderLessonRow).join('')}</div>`)}
    `;
    shell(html,'learning');
  };

  function completeSelfStudyOnOpenV43(code){
    var now = nowIso();
    saveLocalProgress(code, {
      status:'completed',
      current_step:'completed',
      lesson_completed:true,
      lesson_completed_at:now,
      homework_submitted:true,
      homework_submitted_at:now,
      homework_self_study_completed:true,
      homework_self_study_completed_at:now,
      self_study_completed:true,
      self_study_completed_at:now,
      completed_at:now,
      homework_revision:false,
      admin_review_comment:''
    });
    return remoteSave('lesson_completed', {
      selfStudy:true,
      completedAt:now,
      source:'template_open_v43'
    });
  }
  window.completeSelfStudyOnOpenV43 = completeSelfStudyOnOpenV43;

  window.openSelfStudyTemplateV43 = function(url){
    var target = String(url || '').trim();
    if (!target || target === '#') {
      alert('Рабочий шаблон для этого материала ещё не подключён.');
      return;
    }
    completeSelfStudyOnOpenV43(state.selectedLessonCode).catch(function(error){
      console.warn('SELF_STUDY_SAVE_V43', error);
    });
    try {
      if (tg && typeof tg.openLink === 'function') tg.openLink(target);
      else window.open(target,'_blank','noopener,noreferrer');
    } catch(error) {
      window.open(target,'_blank','noopener,noreferrer');
    }
    setTimeout(function(){ if (typeof renderHomework === 'function') renderHomework(); }, 400);
  };

  window.markSelfStudyCompletedV39 = async function(){
    await completeSelfStudyOnOpenV43(state.selectedLessonCode);
    renderLessonHub();
  };
  window.markHomeworkSubmitted = window.markSelfStudyCompletedV39;

  window.homeworkReviewNoticeHtml = function(code){
    if (!(typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(code))) return '';
    var date = typeof selfStudyCompletedDateV39 === 'function' ? selfStudyCompletedDateV39(code) : null;
    return `<div class="homework-review-notice accepted self-study-complete-notice"><b>Рабочий шаблон открыт</b><p>Этап применения засчитан${date ? ' ' + shortDate(date) : ''}.</p></div>`;
  };

  window.renderHomework = async function(){
    var lesson = await loadLesson(state.selectedLessonCode);
    var code = state.selectedLessonCode;
    var activityKey = lesson.activityKey || state.selectedActivityKey;
    var completed = typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(code);
    if (!isAdminMode() && !isStageDone(code,'books') && !completed) {
      shell(`${card('blue-card-v2', `<h1>Самостоятельная работа пока закрыта</h1><p>Сначала завершите презентацию, тест и саммари этого урока.</p>`)}${card('', `<div class="grid-v2">${actionButton('К уроку','renderLessonHub()','primary')}<button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К материалам направления</button></div>`)}`,'homework');
      return;
    }
    if (!completed) remoteSave('homework_started',{selfStudy:true});
    var hw = lesson.homework || {};
    var instruction = typeof sanitizeSelfStudyInstructionV41 === 'function'
      ? sanitizeSelfStudyInstructionV41(hw.instructionHtml || `<h3>Работа с системой</h3><p>Откройте рабочий шаблон, внесите данные своего бизнеса, сформулируйте вывод, выберите действие и показатель проверки.</p>`)
      : cleanStudentHtml(hw.instructionHtml || '');
    var tableUrl = homeworkSheetUrl(code, hw);
    var exampleUrl = hw.exampleUrl || hw.exampleSheetUrl || hw.sampleUrl || hw.exampleFileUrl || '';
    var tableJson = JSON.stringify(String(tableUrl || '#'));
    var statusPanel = completed ? `<div class="self-study-completed-panel"><b>Материал завершён</b><p>К рабочему шаблону можно возвращаться и дополнять его в любое время.</p></div>` : '';
    shell(`${card('blue-card-v2 self-study-hero', `<p class="eyebrow">применение системы</p><h1>${esc(typeof selfStudyReplaceTextV39 === 'function' ? selfStudyReplaceTextV39(hw.title || 'Самостоятельная работа') : (hw.title || 'Самостоятельная работа'))}</h1><p>Откройте рабочий шаблон, заполните его по своему бизнесу и зафиксируйте управленческий вывод.</p>`)}
      ${homeworkReviewNoticeHtml(code)}
      ${card('', `${instruction}<div class="grid-v2"><button class="btn primary" onclick='openSelfStudyTemplateV43(${tableJson})'>Открыть рабочий шаблон</button>${exampleUrl ? externalButton('Открыть заполненный пример',exampleUrl,'secondary') : ''}</div>${statusPanel}<div class="grid-v2 self-study-nav"><button class="btn secondary" onclick="renderLessonHub()">← Вернуться к уроку</button><button class="btn secondary" onclick="renderActivityLessons('${activityKey}')">К материалам направления</button></div>`)}
      ${isAdminMode() ? card('', `<details class="admin-details"><summary>Служебное ТЗ таблицы и критерии</summary><h3>ТЗ таблицы</h3><pre class="text-pre">${esc(hw.tableTzText || 'ТЗ таблицы будет добавлено позже.')}</pre><h3>Критерии самопроверки</h3><pre class="text-pre">${esc(hw.gradingText || '')}</pre></details>`) : ''}`,'homework');
  };
  window.renderHomeworkStatus = function(){ return renderHomework(); };

  window.renderHomeworkCenter = function(){
    var lessons = (state.catalog?.lessons || []).filter(isLessonPrepared);
    shell(`${card('blue-card-v2 practice-center-hero', `<p class="eyebrow">рабочие шаблоны</p><h1>Самостоятельные работы</h1><p>Здесь собраны рабочие шаблоны опубликованных уроков для применения систем к своему бизнесу.</p>`)}${card('', `<div class="lesson-list-v2">${lessons.map(function(lesson){
      var completed = typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(lesson.code);
      var ready = isStageDone(lesson.code,'books') || completed || isAdminMode();
      var status = completed ? 'шаблон открыт' : (ready ? 'доступна' : 'после саммари');
      return `<button class="lesson-row-v2 ${ready?'':'locked'}" ${ready?`onclick="openSelfStudyV39('${lesson.code}')"`:`onclick="openLesson('${lesson.code}')"`}><div><b>${esc(lesson.title)}</b><p>${esc(lesson.activityTitle)} · ${esc(status)}</p></div><span>${completed?'✓':(ready?'→':'🔒')}</span></button>`;
    }).join('')}</div>`)}`,'homework');
  };

  window.doneSummaryHtml = function(){
    var lessons = readyCoreLessons();
    var presentation = lessons.filter(function(l){ return isStageDone(l.code,'presentation'); }).length;
    var quiz = lessons.filter(function(l){ return isStageDone(l.code,'quiz'); }).length;
    var books = lessons.filter(function(l){ return isStageDone(l.code,'books'); }).length;
    var practice = lessons.filter(function(l){ return typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(l.code); }).length;
    var insights = typeof loadInsights === 'function' ? loadInsights().length : 0;
    var challenge = typeof getChallengeState === 'function' ? getChallengeState() : {};
    return card('done-summary-card profile-done-compact-v43', `<h2>Что уже сделано</h2><div class="done-grid"><div><span>Презентации</span><b>${presentation}</b></div><div><span>Тесты</span><b>${quiz}</b></div><div><span>Саммари</span><b>${books}</b></div><div><span>Шаблоны</span><b>${practice}</b></div><div><span>Книги</span><b>${Number(challenge.passedBooks || 0)}</b></div><div><span>Выводы</span><b>${insights}</b></div></div>`);
  };

  window.consultationCardsHtml = function(){
    return card('consultation-card individual-consultation-v43', `<h2>Индивидуальная консультация</h2><p>Можно оставить заявку на разбор бизнеса, управленческого вопроса или конкретной ситуации. Формат и условия согласовываются отдельно.</p>${externalButton('Подать заявку на индивидуальную консультацию',CONSULTATION_FORM_URL,'primary')}`);
  };

  window.renderPointsRulesV43 = function(){
    shell(`${card('blue-card-v2 progress-rules-hero-v40', `<p class="eyebrow">баллы библиотеки</p><h1>Как начисляются баллы</h1><p>Баллы отражают завершённые действия внутри опубликованных уроков и отдельно — результаты челленджа книг.</p>`)}
      ${card('', `<h2>Баллы за один урок</h2><div class="score-rule-grid-v40"><div><span>25</span><b>Презентация</b></div><div><span>25</span><b>Тест</b></div><div><span>25</span><b>Саммари</b></div><div><span>25</span><b>Рабочий шаблон</b></div></div><p class="small">Полностью завершённый урок даёт <b>100 баллов</b>. Этап рабочего шаблона засчитывается при его открытии.</p>`)}
      ${card('', `<h2>100 книг за 100 дней</h2><p>Баллы челленджа прибавляются отдельно. Первый зачтённый день даёт 50 баллов, далее награда растёт на 2 балла за каждый день серии.</p><button class="btn secondary" onclick="renderProfile()">Вернуться в профиль</button>`)}`,'profile');
  };
  window.renderPointsRulesV42 = window.renderPointsRulesV43;
  window.renderPointsRulesV41 = window.renderPointsRulesV43;
  window.renderProgressRulesV40 = window.renderPointsRulesV43;

  var renderProfileBeforeV43 = window.renderProfile;
  window.renderProfile = function(){
    if (!architectureV43Enabled()) return renderProfileBeforeV43();
    var progress = globalStageProgress();
    var points = totalPoints();
    var activeMeta = getLessonMeta(state.selectedLessonCode) || nextLessonMeta();
    var materialProgress = activeMeta ? lessonStageProgressInfo(activeMeta.code) : {percent:0};
    var titleInfo = studentTitleInfo();
    var achievement = libraryPositioningTextV43(titleInfo.current.title);
    var adminBlock = isAdminUser()
      ? card('boss-panel-card profile-admin-compact-v43', `<h2>Панель администратора</h2><div class="segmented"><button class="${state.appMode==='student'?'active':''}" onclick="setAppMode('student')">Просмотр приложения</button><button class="${state.appMode==='admin'?'active':''}" onclick="setAppMode('admin')">Администрирование</button></div><button class="btn primary" onclick="renderAdmin()">Открыть панель</button>`)
      : '';
    shell(`${card('blue-card-v2 profile-head-card profile-head-compact-v43', `<p class="eyebrow">профиль участника</p><h1>${esc(state.user?.first_name || 'Пользователь')}</h1><p>АРХИТЕКТУРА · Библиотека бизнес-систем</p>`)}
      ${card('profile-overview-v43', `<div class="profile-overview-title-v43"><div><p class="eyebrow">текущие показатели</p><h2>Прогресс и баллы</h2></div></div><div class="profile-overview-layout-v43">${compactProgressRing(progress.percent)}<div class="profile-metrics-v43"><div class="profile-points-v43"><span>Всего баллов</span><b>${formatPoints(points)}</b><button class="points-help-v43" onclick="renderPointsRulesV43()" aria-label="Как начисляются баллы">?</button></div><div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div><div><span>Текущий материал</span><b>${materialProgress.percent}%</b></div><div class="profile-achievement-v43"><span>Достижение</span><b>${esc(achievement)}</b></div></div></div><p class="profile-progress-caption-v43">Изучено <b>${progress.done} из ${progress.total}</b> информационных этапов библиотеки.</p>`)}
      ${doneSummaryHtml()}
      ${typeof insightsProfileHtml === 'function' ? insightsProfileHtml() : ''}
      ${consultationCardsHtml()}
      ${adminBlock}
      ${card('profile-support-v43', `<h2>Связь</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}`)}`,'profile');
  };

  function openExternalV43(url){
    var target = String(url || '').trim();
    if (!target || target === '#') return;
    closeAppDrawerV40();
    try {
      if (tg && typeof tg.openLink === 'function') tg.openLink(target);
      else window.open(target,'_blank','noopener,noreferrer');
    } catch(error) { window.open(target,'_blank','noopener,noreferrer'); }
  }
  window.openSupportFromDrawerV43 = function(){ openExternalV43(SUPPORT_FORM_URL); };
  window.openIdeaFromDrawerV43 = function(){ openExternalV43(IDEA_FORM_URL); };
  window.refreshAppInformationV43 = function(){
    closeAppDrawerV40();
    try {
      state.catalog = null;
      state.lessonCache = {};
      state.books100Index = null;
      state.books100Cache = {};
      sessionStorage.removeItem('lego_books100_index_v31_days001_020');
      if (window.caches && typeof window.caches.keys === 'function') {
        window.caches.keys().then(function(keys){ keys.forEach(function(key){ window.caches.delete(key); }); }).catch(function(){});
      }
    } catch(error) {}
    var url = new URL(window.location.href);
    url.searchParams.set('refresh', String(Date.now()));
    window.location.replace(url.toString());
  };

  function updateDrawerV43(){
    var drawer = document.querySelector('.app-drawer-v40');
    if (!drawer) return;
    var subtitle = drawer.querySelector('.app-drawer-head-v40 span');
    if (subtitle) subtitle.textContent = 'Библиотека бизнес-систем';
    var close = drawer.querySelector('.app-drawer-head-v40>button');
    if (close) close.classList.add('drawer-close-v43');
    var footer = drawer.querySelector('.app-drawer-footer-v40');
    if (footer) footer.innerHTML = `<button type="button" onclick="openSupportFromDrawerV43()">Задать вопрос</button><button type="button" onclick="openIdeaFromDrawerV43()">Предложить идею</button><button type="button" class="drawer-refresh-v43" onclick="refreshAppInformationV43()">Обновить информацию</button>`;
  }
  window.updateDrawerV43 = updateDrawerV43;

  function setupHeaderV43(){
    if (!architectureV43Enabled()) return;
    var header = document.querySelector('.app-header-v2');
    if (!header) return;
    header.classList.add('app-header-v43');
    header.querySelectorAll('.mode-pill').forEach(function(node){ node.remove(); });
    var menu = header.querySelector('.app-menu-button-v40');
    var brand = header.querySelector('.architecture-brand, .brand-lockup');
    if (menu) header.insertBefore(menu, header.firstChild);
    if (brand) header.appendChild(brand);
  }
  window.setupHeaderV43 = setupHeaderV43;

  var shellBeforeV43 = window.shell;
  window.shell = function(content, activeTab){
    var result = shellBeforeV43(libraryPositioningTextV43(content), activeTab);
    setupHeaderV43();
    setTimeout(function(){
      setupHeaderV43();
      updateDrawerV43();
      if (typeof lockDrawerItemsV41 === 'function') lockDrawerItemsV41();
      if (typeof removeProfileModerationNoticeV40 === 'function') removeProfileModerationNoticeV40();
    },0);
    setTimeout(updateDrawerV43,30);
    return result;
  };

  window.renderHome = (function(renderHomeBeforeV43){
    return function(){
      if (!architectureV43Enabled()) return renderHomeBeforeV43();
      var progress = globalStageProgress();
      var points = totalPoints();
      var titleInfo = studentTitleInfo();
      var achievement = libraryPositioningTextV43(titleInfo.current.title);
      var html = `
        ${card('hero-dashboard main-dashboard-card architecture-dashboard v40-dashboard v41-dashboard v43-dashboard', `
          <div class="architecture-dashboard-head"><div><div class="eyebrow-row"><p class="eyebrow">библиотека бизнес-систем</p><button class="instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button></div><h1>Общий прогресс</h1><p>Изучено <b>${progress.done} из ${progress.total}</b> информационных этапов библиотеки.</p></div>${compactProgressRing(progress.percent)}</div>
          <div class="architecture-metrics"><div><span>Баллы</span><b>${formatPoints(points)}</b></div><div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div><div><span>Достижение</span><b>${esc(achievement)}</b></div></div>
          ${globalInstructionPanelHtml()}
        `)}
        ${card('architecture-blocks-card v40-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">структура библиотеки</p><h2>Выберите блок</h2></div><p>Архитектуры, системы, разборы и материалы собраны в единой структуре.</p></div>${primaryRoutesHtmlV40()}${secondaryBlocksHtmlV40()}`)}
        ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
      `;
      shell(html,'home');
    };
  })(window.renderHome);
})();


/* =====================================================
   v44 — стабильная главная, общий справочник приложения,
   профиль без повторов, страницы чтения и уровни.
   ===================================================== */
(function installArchitectureHomeProfileV44(){
  window.APP_UI_VERSION_V44 = 'v44-stable-home-profile-reading-levels-20260624';
  window.__architectureCurrentViewV44 = 'boot';

  function architectureV44Enabled(){
    return typeof architectureModeV35 === 'function' && architectureModeV35();
  }

  function setArchitectureViewV44(view){
    window.__architectureCurrentViewV44 = String(view || 'other');
  }
  window.setArchitectureViewV44 = setArchitectureViewV44;

  /*
     Таймер челленджа больше не имеет права сам открывать экран
     «100 книг за 100 дней». На главной он только обновляет цифры.
  */
  function stopBooks100TimerV44(){
    if (window.__books100TimerV44) {
      clearInterval(window.__books100TimerV44);
      window.__books100TimerV44 = null;
    }
    try {
      if (typeof stopBooks100LiveTimerV19 === 'function') stopBooks100LiveTimerV19();
    } catch(error) {}
  }
  window.stopBooks100TimerV44 = stopBooks100TimerV44;

  window.startBooks100LiveTimerV19 = function(deadlineMs){
    if (window.__books100TimerV44) clearInterval(window.__books100TimerV44);
    var deadline = Number(deadlineMs || 0);
    if (!deadline) return;
    var syncing = false;

    async function tick(){
      var left = Math.max(0, deadline - Date.now());
      document.querySelectorAll('[data-books100-timer="1"]').forEach(function(node){
        node.textContent = typeof books100TimeLeftText === 'function' ? books100TimeLeftText(left) : '';
      });
      if (left > 0 || syncing) return;
      syncing = true;
      if (window.__books100TimerV44) {
        clearInterval(window.__books100TimerV44);
        window.__books100TimerV44 = null;
      }
      document.querySelectorAll('[data-books100-timer="1"]').forEach(function(node){ node.textContent = 'обновляем'; });
      try {
        if (typeof loadBooks100Index === 'function' && typeof syncBooks100StateV20 === 'function') {
          var index = await loadBooks100Index();
          await syncBooks100StateV20(index, false);
        }
      } catch(error) {
        console.warn('BOOKS100_SILENT_TIMER_SYNC_V44', error);
      }
      if (window.__architectureCurrentViewV44 === 'books100' && typeof window.renderBookChallenge === 'function') {
        window.renderBookChallenge();
      } else {
        document.querySelectorAll('[data-books100-timer="1"]').forEach(function(node){ node.textContent = 'окно завершено'; });
      }
    }

    tick();
    window.__books100TimerV44 = setInterval(tick, 15000);
  };

  /* Не позволяем фоновой синхронизации челленджа вернуть пользователя
     обратно в раздел книг после перехода на главную или в профиль. */
  var renderBookChallengeFromStateBeforeV44 = window.renderBookChallengeFromStateV20;
  if (typeof renderBookChallengeFromStateBeforeV44 === 'function') {
    window.renderBookChallengeFromStateV20 = function(){
      if (window.__architectureCurrentViewV44 !== 'books100') return;
      return renderBookChallengeFromStateBeforeV44.apply(this, arguments);
    };
  }

  function wrapViewV44(name, view){
    var before = window[name];
    if (typeof before !== 'function' || before.__viewWrappedV44) return;
    var wrapped = function(){
      setArchitectureViewV44(view);
      return before.apply(this, arguments);
    };
    wrapped.__viewWrappedV44 = true;
    window[name] = wrapped;
  }

  [
    'renderBookChallenge', 'startBookChallenge', 'openBooks100Book',
    'renderBooks100QuizQuestion', 'finishBooks100Quiz'
  ].forEach(function(name){ wrapViewV44(name, 'books100'); });

  /* Полная инструкция охватывает всё приложение, а не один маршрут. */
  window.globalInstructionPanelHtml = function(){
    return `<div id="global-instruction-panel" class="global-instruction-panel v44-instruction-panel" style="display:none">
      <div class="instruction-head"><b>Как пользоваться приложением</b><button onclick="toggleGlobalInstruction(false)" aria-label="Закрыть инструкцию">×</button></div>
      <div class="instruction-steps">
        <div><b>1. Главная показывает всю структуру</b><p>На главной собраны доступные и будущие блоки. Открытые разделы можно запускать сразу, а блоки в подготовке отмечены и не нажимаются.</p></div>
        <div><b>2. Меню слева открывает разделы</b><p>Нажмите на три линии в верхнем левом углу, чтобы увидеть карту приложения, задать вопрос, предложить идею или обновить информацию.</p></div>
        <div><b>3. Профиль хранит ваш результат</b><p>В профиле находятся общий прогресс, баллы, уровень, достижение, количество изученных страниц, завершённых тестов, саммари книг, шаблонов и сохранённых выводов.</p></div>
        <div><b>4. Опубликованные материалы доступны для работы</b><p>В блоке «Я предприниматель» выберите вид бизнеса и нужный опубликованный материал. Нумерация показывает рекомендуемую последовательность.</p></div>
        <div><b>5. Каждый материал переводится в действие</b><p>Изучите презентацию, пройдите тест, разберите саммари книг и откройте рабочий шаблон, чтобы применить систему к своему бизнесу.</p></div>
        <div><b>6. Челлендж книг работает отдельно</b><p>В разделе «100 книг за 100 дней» открывается книга дня, страницы конспекта и мини-тест. Результаты добавляются в профиль и общую систему баллов.</p></div>
        <div><b>7. Нижняя панель содержит частые действия</b><p>«Главная» возвращает к структуре, «Профиль» открывает личные результаты. «Финансовый помощник» появится после завершения разработки.</p></div>
      </div>
    </div>`;
  };

  /* ---------- Статистика чтения ---------- */
  function readingUserSuffixV44(){
    try {
      var ids = typeof possibleIds === 'function' ? possibleIds() : [];
      if (ids && ids[0]) return String(ids[0]);
      var username = typeof normalizeUsername === 'function'
        ? normalizeUsername((state.user && state.user.username) || (typeof getTelegramUser === 'function' ? getTelegramUser().username : ''))
        : '';
      return username || 'local';
    } catch(error) { return 'local'; }
  }
  function readingTrackerKeyV44(){ return 'architecture_read_pages_v44_' + readingUserSuffixV44(); }
  function readTrackerV44(){
    try {
      var parsed = JSON.parse(localStorage.getItem(readingTrackerKeyV44()) || '{}');
      if (!parsed || typeof parsed !== 'object') parsed = {};
      if (!parsed.challenge || typeof parsed.challenge !== 'object') parsed.challenge = {};
      return parsed;
    } catch(error) { return { challenge:{} }; }
  }
  function saveTrackerV44(data){
    try { localStorage.setItem(readingTrackerKeyV44(), JSON.stringify(data || {challenge:{}})); } catch(error) {}
  }
  function markChallengePageV44(bookId, page, total){
    if (!bookId) return;
    var tracker = readTrackerV44();
    var current = tracker.challenge[bookId] || { viewed:0, total:0 };
    current.viewed = Math.max(Number(current.viewed || 0), Number(page || 0));
    current.total = Math.max(Number(current.total || 0), Number(total || 0));
    tracker.challenge[bookId] = current;
    saveTrackerV44(tracker);
  }
  function challengeTrackedPagesV44(){
    var tracker = readTrackerV44();
    return Object.keys(tracker.challenge || {}).reduce(function(sum, key){
      return sum + Math.max(0, Number(tracker.challenge[key]?.viewed || 0));
    }, 0);
  }

  function lessonPresentationPagesV44(meta){
    var progress = getProgress(meta.code) || {};
    var total = Math.max(0, Number(meta.slidesCount || 0));
    var viewed = Math.max(0, Number(progress.last_slide_number || 0));
    if (isStageDone(meta.code,'presentation') && total) return total;
    return total ? Math.min(total, viewed) : viewed;
  }
  function lessonSummaryPagesV44(meta){
    var progress = getProgress(meta.code) || {};
    var total = Math.max(0, Number(meta.bookScreensCount || 0));
    var viewed = Math.max(0, Number(progress.last_book_slide_number || 0));
    if (isStageDone(meta.code,'books') && total) return total;
    return total ? Math.min(total, viewed) : viewed;
  }
  function lessonBookSummariesV44(meta){
    if (isStageDone(meta.code,'books')) return 5;
    var viewed = Math.max(0, Number((getProgress(meta.code) || {}).last_book_slide_number || 0));
    return Math.max(0, Math.min(5, Math.floor(viewed / 5)));
  }
  function lessonPagesTotalV44(){
    return readyCoreLessons().reduce(function(sum, meta){
      return sum + lessonPresentationPagesV44(meta) + lessonSummaryPagesV44(meta);
    }, 0);
  }

  async function refreshChallengePagesV44(){
    try {
      if (typeof loadBooks100Index !== 'function' || typeof loadBooks100Book !== 'function') return;
      var index = await loadBooks100Index();
      var challenge = typeof getChallengeState === 'function' ? getChallengeState() : {};
      var passedIds = new Set([].concat(challenge.passedBookIds || []));
      var statusMap = challenge.statusByBookId || {};
      Object.keys(statusMap).forEach(function(id){ if (statusMap[id] && statusMap[id].status === 'passed') passedIds.add(id); });
      var tracker = readTrackerV44();
      var books = (index && Array.isArray(index.books)) ? index.books : [];

      for (var i = 0; i < books.length; i++) {
        var meta = books[i];
        if (!passedIds.has(meta.id)) continue;
        var row = tracker.challenge[meta.id] || {viewed:0,total:0};
        var total = Number(meta.screensCount || meta.screenCount || meta.pagesCount || meta.pages || row.total || 0);
        if (!total) {
          try {
            var book = await loadBooks100Book(meta);
            total = Array.isArray(book.screens) ? book.screens.length : 0;
          } catch(error) { total = Number(row.total || 0); }
        }
        if (total) tracker.challenge[meta.id] = { viewed:Math.max(Number(row.viewed || 0), total), total:total };
      }
      saveTrackerV44(tracker);
      var pageNode = document.getElementById('profile-pages-value-v44');
      if (pageNode && window.__architectureCurrentViewV44 === 'profile') {
        pageNode.textContent = formatPoints(lessonPagesTotalV44() + challengeTrackedPagesV44());
      }
    } catch(error) {
      console.warn('PROFILE_CHALLENGE_PAGES_V44', error);
    }
  }
  window.refreshChallengePagesV44 = refreshChallengePagesV44;

  /* Отмечаем открытую страницу челленджа. */
  var renderBooks100ReadingBeforeV44 = window.renderBooks100Reading;
  if (typeof renderBooks100ReadingBeforeV44 === 'function') {
    window.renderBooks100Reading = async function(){
      setArchitectureViewV44('books100');
      var result = await renderBooks100ReadingBeforeV44.apply(this, arguments);
      try {
        var index = await loadBooks100Index();
        var meta = books100ByDay(index, state.books100ActiveBookDay);
        var book = meta ? await loadBooks100Book(meta) : null;
        var total = book && Array.isArray(book.screens) ? book.screens.length : 0;
        markChallengePageV44(meta && meta.id, Number(state.books100ScreenIndex || 0) + 1, total);
      } catch(error) { console.warn('TRACK_BOOK_PAGE_V44', error); }
      return result;
    };
  }

  function readingStatsV44(){
    var lessons = readyCoreLessons();
    var challenge = typeof getChallengeState === 'function' ? getChallengeState() : {};
    var passedChallengeBooks = Math.max(0, Number(challenge.passedBooks || challenge.unitsEarned || 0));
    var presentations = lessons.filter(function(meta){ return isStageDone(meta.code,'presentation'); }).length;
    var lessonTests = lessons.filter(function(meta){ return isStageDone(meta.code,'quiz'); }).length;
    var templates = lessons.filter(function(meta){
      return typeof isSelfStudyCompletedV39 === 'function' && isSelfStudyCompletedV39(meta.code);
    }).length;
    var lessonBooks = lessons.reduce(function(sum, meta){ return sum + lessonBookSummariesV44(meta); }, 0);
    var insights = typeof loadInsights === 'function' ? loadInsights().length : 0;
    return {
      presentations:presentations,
      pages:lessonPagesTotalV44() + challengeTrackedPagesV44(),
      tests:lessonTests + passedChallengeBooks,
      bookSummaries:lessonBooks + passedChallengeBooks,
      templates:templates,
      insights:insights
    };
  }

  window.doneSummaryHtml = function(){
    var stats = readingStatsV44();
    return card('done-summary-card profile-done-compact-v43 profile-done-v44', `<div class="done-heading-v44"><div><p class="eyebrow">накопленный объём</p><h2>Что уже сделано</h2></div><p>Учитываются материалы уроков и челленджа книг.</p></div><div class="done-grid"><div><span>Презентации</span><b>${formatPoints(stats.presentations)}</b></div><div><span>Страницы</span><b id="profile-pages-value-v44">${formatPoints(stats.pages)}</b></div><div><span>Тесты</span><b>${formatPoints(stats.tests)}</b></div><div><span>Саммари книг</span><b>${formatPoints(stats.bookSummaries)}</b></div><div><span>Шаблоны</span><b>${formatPoints(stats.templates)}</b></div><div><span>Выводы</span><b>${formatPoints(stats.insights)}</b></div></div>`);
  };

  /* ---------- Уровни и достижения ---------- */
  var LEVEL_MEANINGS_V44 = [
    'Начинает видеть бизнес как связанную систему.',
    'Фиксирует факты и отделяет их от мнений.',
    'Понимает повторяющийся управленческий цикл.',
    'Разделяет деятельность на понятные процессы.',
    'Применяет первичную диагностику к реальным данным.',
    'Ищет причины отклонений, а не только симптомы.',
    'Выбирает один управленческий фокус на цикл.',
    'Находит главное ограничение системы.',
    'Формулирует и проверяет рабочие гипотезы.',
    'Использует показатели для контроля решений.',
    'Проектирует решения под найденную причину.',
    'Регулярно применяет системы на практике.',
    'Видит последовательный маршрут роста.',
    'Формулирует точные управленческие выводы.',
    'Переводит выводы в конкретные изменения.',
    'Связывает процессы в единую операционную систему.',
    'Выбирает стратегические приоритеты управления.',
    'Собирает целостную архитектуру бизнес-модели.',
    'Контролирует внедрение и корректирует курс.',
    'Создаёт устойчивый контур системного контроля.',
    'Строит управляемый бизнес из связанных элементов.',
    'Управляет операционной логикой на уровне системы.',
    'Проектирует взаимосвязи между ключевыми блоками.',
    'Может передавать системный подход другим.',
    'Системно управляет архитектурой бизнеса.'
  ];

  function levelGuideRowsV44(){
    if (typeof LEGO_LEVELS === 'undefined' || !Array.isArray(LEGO_LEVELS)) return '';
    return LEGO_LEVELS.map(function(row, index){
      var title = typeof libraryPositioningTextV43 === 'function' ? libraryPositioningTextV43(row.title) : row.title;
      var range = row.level === 25 ? '1000+ единиц освоения' : `${row.min}–${row.max} единиц освоения`;
      return `<div class="level-guide-row-v44"><span>${String(row.level).padStart(2,'0')}</span><div><b>${esc(title)}</b><p>${esc(LEVEL_MEANINGS_V44[index] || '')}</p></div><em>${esc(range)}</em></div>`;
    }).join('');
  }
  window.toggleLevelGuideV44 = function(force){
    var panel = document.getElementById('level-guide-panel-v44');
    if (!panel) return;
    var open = force === undefined ? panel.hidden : Boolean(force);
    panel.hidden = !open;
    if (open) panel.scrollIntoView({behavior:'smooth', block:'nearest'});
  };
  function levelDetailsCardV44(info){
    var title = typeof libraryPositioningTextV43 === 'function' ? libraryPositioningTextV43(info.current.title) : info.current.title;
    return card('levels-card-v44', `<div class="levels-head-v44"><div><p class="eyebrow">уровни и достижения</p><h2>${esc(title)}</h2></div><button class="level-help-v44" onclick="toggleLevelGuideV44()" aria-label="Что означают уровни">?</button></div><div class="levels-summary-v44"><div><span>Текущий уровень</span><b>${info.current.level} / 25</b></div><div><span>Единицы освоения</span><b>${formatPoints(info.units)}</b></div></div>${levelBarHtml(info)}<p class="small">${info.current.level >= 25 ? 'Открыт финальный уровень системы.' : `До следующего уровня: ${formatPoints(info.left)} единиц освоения.`}</p><div id="level-guide-panel-v44" class="level-guide-panel-v44" hidden><div class="level-guide-title-v44"><b>Что означает каждый уровень</b><button onclick="toggleLevelGuideV44(false)" aria-label="Закрыть">×</button></div>${levelGuideRowsV44()}</div>`);
  }

  /* ---------- Главная ---------- */
  var renderHomeBeforeV44 = window.renderHome;
  window.renderHome = function(){
    if (!architectureV44Enabled()) return renderHomeBeforeV44();
    setArchitectureViewV44('home');
    var progress = globalStageProgress();
    var points = totalPoints();
    var titleInfo = studentTitleInfo();
    var achievement = typeof libraryPositioningTextV43 === 'function' ? libraryPositioningTextV43(titleInfo.current.title) : titleInfo.current.title;
    var html = `
      ${card('hero-dashboard main-dashboard-card architecture-dashboard v40-dashboard v41-dashboard v43-dashboard v44-dashboard v47-dashboard', `
        <div class="architecture-dashboard-head v44-dashboard-head v47-dashboard-head">
          <div class="v44-dashboard-copy v47-dashboard-copy">
            <div class="v44-dashboard-title-row v47-dashboard-title-row"><h1>Общий прогресс</h1><button class="instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button></div>
            <div class="v47-progress-summary"><span>Изучено</span><b>${progress.done} / ${progress.total}</b><em>информационных этапов</em></div>
          </div>
          ${compactProgressRing(progress.percent)}
        </div>
        <div class="architecture-metrics v47-metrics"><div><span>Баллы</span><b>${formatPoints(points)}</b></div><div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div><div><span>Достижение</span><b>${esc(achievement)}</b></div></div>
        ${globalInstructionPanelHtml()}
      `)}
      ${card('architecture-blocks-card v40-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">структура библиотеки</p><h2>Выберите блок</h2></div><p>Архитектуры, системы, разборы и материалы собраны в единой структуре.</p></div>${primaryRoutesHtmlV40()}${secondaryBlocksHtmlV40()}`)}
      ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
    `;
    shell(html,'home');
  };

  /* ---------- Профиль ---------- */
  var renderProfileBeforeV44 = window.renderProfile;
  window.renderProfile = function(){
    if (!architectureV44Enabled()) return renderProfileBeforeV44();
    setArchitectureViewV44('profile');
    var progress = globalStageProgress();
    var points = totalPoints();
    var titleInfo = studentTitleInfo();
    var achievement = typeof libraryPositioningTextV43 === 'function' ? libraryPositioningTextV43(titleInfo.current.title) : titleInfo.current.title;
    var name = state.user?.first_name || (typeof getTelegramUser === 'function' ? getTelegramUser().first_name : '') || 'Пользователь';
    var adminBlock = isAdminMode()
      ? card('boss-panel-card profile-admin-compact-v43', `<h2>Панель администратора</h2><p>Предпросмотр опубликованных материалов и служебные инструменты.</p><button class="btn primary" onclick="renderAdmin()">Открыть панель</button>`)
      : '';
    shell(`${card('profile-overview-v44', `<div class="profile-identity-v44"><p class="eyebrow">профиль</p><h1>${esc(name)}</h1></div><div class="profile-overview-layout-v44">${compactProgressRing(progress.percent)}<div class="profile-metrics-v44"><div class="profile-points-v44"><span>Всего баллов</span><b>${formatPoints(points)}</b><button class="points-help-v43" onclick="renderPointsRulesV43()" aria-label="Как начисляются баллы">?</button></div><div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div><div class="profile-achievement-v44"><span>Достижение</span><b>${esc(achievement)}</b></div></div></div><p class="profile-progress-caption-v44">Изучено <b>${progress.done} из ${progress.total}</b> информационных этапов библиотеки.</p>`)}
      ${levelDetailsCardV44(titleInfo)}
      ${doneSummaryHtml()}
      ${typeof insightsProfileHtml === 'function' ? insightsProfileHtml() : ''}
      ${consultationCardsHtml()}
      ${adminBlock}
      ${card('profile-support-v43', `<h2>Связь</h2>${externalButton('Задать вопрос',SUPPORT_FORM_URL,'secondary')}${externalButton('Предложить идею',IDEA_FORM_URL,'secondary')}`)}`,'profile');
    setTimeout(refreshChallengePagesV44, 0);
  };

  /* Переходы в другие экраны отменяют право фоновой синхронизации
     челленджа перерисовывать текущий экран. */
  [
    'renderLearning','renderActivityLessons','renderLessonHub','renderHomework',
    'renderHomeworkCenter','renderAdmin','renderAdditionalMaterials'
  ].forEach(function(name){ wrapViewV44(name, name === 'renderProfile' ? 'profile' : 'content'); });

  /* Служебный переход в администрирование остаётся только у владельца
     и находится в боковом меню, а не в профиле ученика. */
  window.switchAdminModeFromDrawerV44 = function(){
    closeAppDrawerV40();
    if (!isAdminUser()) return;
    setAppMode(isAdminMode() ? 'student' : 'admin');
  };
  function updateDrawerV44(){
    var footer = document.querySelector('.app-drawer-footer-v40');
    if (!footer) return;
    var adminButton = isAdminUser()
      ? `<button type="button" class="drawer-admin-v44" onclick="switchAdminModeFromDrawerV44()">${isAdminMode() ? 'Просмотр приложения' : 'Администрирование'}</button>`
      : '';
    footer.innerHTML = `<button type="button" onclick="openSupportFromDrawerV43()">Задать вопрос</button><button type="button" onclick="openIdeaFromDrawerV43()">Предложить идею</button><button type="button" class="drawer-refresh-v43" onclick="refreshAppInformationV43()">Обновить информацию</button>${adminButton}`;
  }
  window.updateDrawerV44 = updateDrawerV44;

  var shellBeforeV44 = window.shell;
  window.shell = function(content, activeTab){
    var result = shellBeforeV44(content, activeTab);
    setTimeout(updateDrawerV44, 60);
    setTimeout(updateDrawerV44, 140);
    return result;
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

/* =====================================================
   v45 — strict owner-only administration visibility
   ===================================================== */
(function installOwnerOnlyAdministrationV45(){
  window.APP_UI_VERSION_V45 = 'v45-compact-progress-owner-admin-20260624';

  function enforceOwnerOnlyAdministrationV45(){
    var owner = typeof isAdminUser === 'function' && isAdminUser();
    document.querySelectorAll('.drawer-admin-v44, .profile-admin-compact-v43, .boss-panel-card').forEach(function(node){
      if (!owner) node.remove();
    });
  }
  window.enforceOwnerOnlyAdministrationV45 = enforceOwnerOnlyAdministrationV45;

  var shellBeforeV45 = window.shell;
  if (typeof shellBeforeV45 === 'function') {
    window.shell = function(content, activeTab){
      var result = shellBeforeV45(content, activeTab);
      setTimeout(enforceOwnerOnlyAdministrationV45, 0);
      setTimeout(enforceOwnerOnlyAdministrationV45, 100);
      return result;
    };
  }
})();

/* v46 — UI package marker: extra-compact overall progress + lesson migration audit. */
window.APP_UI_VERSION_V46 = 'v46-extra-compact-progress-audit-20260624';

/* v47 — compact progress composition + aligned lesson stage cards. */
window.APP_UI_VERSION_V47 = 'v47-compact-progress-stage-alignment-20260625';

/* =====================================================
   v48 — exact compact composition of the overall progress card
   ===================================================== */
(function installExactOverallProgressV48(){
  window.APP_UI_VERSION_V48 = 'v48-exact-overall-progress-composition-20260625';

  var renderHomeBeforeV48 = window.renderHome;
  window.renderHome = function(){
    /* Preserve the existing access gate and the non-Architecture theme. */
    if (typeof hasVerifiedAccessV32 === 'function' && !hasVerifiedAccessV32()) {
      return renderHomeBeforeV48.apply(this, arguments);
    }
    if (!(typeof architectureModeV35 === 'function' && architectureModeV35())) {
      return renderHomeBeforeV48.apply(this, arguments);
    }

    if (typeof setArchitectureViewV44 === 'function') setArchitectureViewV44('home');

    var progress = globalStageProgress();
    var points = totalPoints();
    var titleInfo = studentTitleInfo();
    var achievement = typeof libraryPositioningTextV43 === 'function'
      ? libraryPositioningTextV43(titleInfo.current.title)
      : titleInfo.current.title;

    var html = `
      ${card('hero-dashboard main-dashboard-card architecture-dashboard v40-dashboard v41-dashboard v43-dashboard v44-dashboard v48-dashboard', `
        <div class="v48-dashboard-title"><h1>Общий прогресс</h1></div>
        <div class="v48-dashboard-action-row">
          <button class="instruction-link v48-instruction-link" onclick="toggleGlobalInstruction()">как пользоваться</button>
          ${compactProgressRing(progress.percent)}
        </div>
        <div class="v48-primary-metrics">
          <div><span>Баллы</span><b>${formatPoints(points)}</b></div>
          <div><span>Уровень</span><b>${titleInfo.current.level} / 25</b></div>
        </div>
        <div class="v48-achievement-metric"><span>Достижение</span><b>${esc(achievement)}</b></div>
        ${globalInstructionPanelHtml()}
      `)}
      ${card('architecture-blocks-card v40-blocks-card', `<div class="section-heading-v35"><div><p class="eyebrow">структура библиотеки</p><h2>Выберите блок</h2></div><p>Архитектуры, системы, разборы и материалы собраны в единой структуре.</p></div>${primaryRoutesHtmlV40()}${secondaryBlocksHtmlV40()}`)}
      ${typeof safeActiveChallengeCardHtmlV24 === 'function' ? safeActiveChallengeCardHtmlV24() : ''}
    `;
    shell(html, 'home');
  };
})();


/* =====================================================
   v77 — Финансовый помощник: единая чистая структура без старых слоёв
   ===================================================== */
(function installFinanceCleanV77(){
  window.APP_UI_VERSION_V77 = 'v86-finance-student-open-manual-callouts-20260629';

  const FINANCE_TRAINER_SECTION1_URL_V77 = 'https://docs.google.com/spreadsheets/d/1WsPb_DHt3ksIpCAZIMxgMDuSojIbztbV_5tthhdJ3Eg/edit?gid=972184137#gid=972184137';
  const FINANCE_MODULE_SECTIONS_V77 = [{"id": 1, "title": "Финансовое мышление собственника", "description": "Формирует базовую логику: предприниматель перестаёт смотреть только на кассу и начинает видеть бизнес как систему финансовых потоков, остатков, обязательств и решений.", "lessons": [{"id": 1, "title": "Деньги, прибыль и выручка: почему предприниматель ошибается", "objective": "Разрушить главный финансовый миф: деньги на счёте не равны прибыли, а поступление не всегда является выручкой.", "content": "Деньги, выручка, поступления, расходы, платежи, активы, кредиты, авансы клиентов. Разница между фактом денег и фактом заработка.", "case": "На счёт пришёл 1 000 000 ₽: это может быть выручка, аванс, кредит, возврат дебиторки или вклад собственника. Ученик разбирает влияние каждого варианта на ОПиУ, ДДС и баланс.", "result": "Ученик перестаёт оценивать бизнес только по остатку денег.", "fullContent": ["Урок 1. Деньги, прибыль и выручка: почему предприниматель ошибается", "Общая структура урока", "Количество слайдов: 18.", "Рекомендуемая длительность урока: 60–80 минут.", "Формат урока: теоретическое объяснение, разбор финансовых понятий, сквозной кейс на 1 000 000 ₽, сравнение влияния на ОПиУ, ДДС и баланс.", "Главная задача урока: разрушить базовый финансовый миф предпринимателя: деньги на счёте не равны прибыли, а поступление денег не всегда является выручкой.", "Результат ученика: ученик перестаёт оценивать бизнес только по остатку денег и начинает разделять три разные финансовые реальности: заработал ли бизнес, пришли ли деньги, что изменилось в активах и обязательствах.", "Слайд 1. Главный финансовый миф предпринимателя", "Что показать на слайде", "Показать крупную фразу: «Деньги на счёте ≠ прибыль бизнеса». Рядом можно показать предпринимателя, который смотрит на банковский остаток и делает преждевременный вывод: «У нас всё хорошо». Внизу слайда показать три вопроса: что заработали, какие деньги пришли, что бизнес теперь должен.", "Текст под слайдом", "Большинство предпринимателей начинают финансовый анализ с остатка денег на счёте. Это понятно, потому что деньги видны сразу и кажутся самым честным показателем. Но остаток денег показывает только текущую кассу, а не реальный финансовый результат. Поэтому бизнес может выглядеть здоровым по деньгам и одновременно быть убыточным.", "Главная ошибка возникает тогда, когда предприниматель называет любое поступление выручкой. Деньги могли прийти от клиента за уже оказанную услугу. Деньги могли прийти как аванс за услугу, которую ещё нужно оказать. Деньги могли прийти как кредит, вклад собственника или возврат старого долга.", "Прибыль отвечает на вопрос, заработал ли бизнес. Деньги отвечают на вопрос, сколько средств сейчас доступно. Баланс отвечает на вопрос, что у бизнеса есть и кому он должен. Эти три вопроса нельзя заменять одним банковским остатком.", "В этом уроке мы разложим одну простую ситуацию на несколько финансовых смыслов. На счёт бизнеса пришёл 1 000 000 ₽. На первый взгляд это одна и та же сумма денег. Но для финансового управления это могут быть пять совершенно разных событий.", "Слайд 2. Три финансовые реальности бизнеса", "Что показать на слайде", "Показать три колонки: ОПиУ, ДДС, Баланс. Под ОПиУ написать: «заработали или нет». Под ДДС написать: «деньги пришли или ушли». Под балансом написать: «что есть и что должны».", "Текст под слайдом", "Финансы бизнеса нельзя понять через один отчёт. ОПиУ показывает прибыльность бизнеса. ДДС показывает движение денег. Баланс показывает активы, обязательства и капитал собственника.", "ОПиУ нужен, чтобы понять, создаёт ли бизнес экономический результат. В нём отражаются выручка, расходы, прибыль, маржа и итоговый финансовый результат. Но ОПиУ не обязан совпадать с движением денег. Именно поэтому прибыль может быть положительной, а денег на счёте может не хватать.", "ДДС нужен, чтобы понять, откуда деньги пришли и куда они ушли. Он фиксирует поступления, платежи, инвестиции, кредиты, возвраты и изъятия. ДДС показывает кассовую реальность бизнеса. Но он не доказывает, что бизнес действительно заработал.", "Баланс нужен, чтобы понять, что изменилось внутри бизнеса после операции. В балансе появляются деньги, дебиторка, оборудование, долги, авансы клиентов и капитал собственника. Баланс связывает прибыль и деньги через остатки. Без баланса предприниматель видит только движение, но не видит финансовое положение.", "Слайд 3. Деньги: факт движения, а не факт заработка", "Что показать на слайде", "Показать банковский счёт с входящими и исходящими стрелками. Входящие стрелки подписать: «оплата клиента», «аванс», «кредит», «вклад собственника», «возврат дебиторки». Исходящие стрелки подписать: «аренда», «зарплата», «налоги», «оборудование», «погашение кредита».", "Текст под слайдом", "Деньги показывают, что произошло движение по кассе или счёту. Если деньги пришли, это означает только то, что остаток денежных средств увеличился. Если деньги ушли, это означает только то, что остаток денежных средств уменьшился. Само движение денег ещё не объясняет, заработал бизнес или нет.", "Одна и та же сумма поступления может иметь разный экономический смысл. Оплата за уже оказанную услугу связана с выручкой. Аванс клиента связан с обязательством оказать услугу в будущем. Кредит связан с долгом, а не с доходом.", "Такая же логика работает с платежами. Оплата аренды обычно является расходом периода. Покупка оборудования является не обычным расходом, а приобретением актива. Погашение тела кредита уменьшает деньги, но не является расходом в ОПиУ.", "Поэтому ДДС всегда нужно читать вместе с ОПиУ и балансом. ДДС показывает факт денег, но не показывает полный смысл операции. Предприниматель должен научиться задавать второй вопрос после любого поступления. Этот вопрос звучит так: почему эти деньги пришли и что бизнес теперь обязан сделать.", "Слайд 4. Выручка: факт заработка", "Что показать на слайде", "Показать схему: клиент получил ценность → бизнес признал выручку. Для услуг показать пример: «услуга оказана». Для торговли показать пример: «товар передан». Для проекта показать пример: «этап выполнен».", "Текст под слайдом", "Выручка возникает не просто потому, что деньги пришли. Выручка возникает тогда, когда бизнес передал клиенту ценность. В услугах это момент оказания услуги. В торговле это момент передачи товара покупателю.", "Если клиент оплатил услугу заранее, деньги уже пришли. Но пока услуга не оказана, бизнес ещё не заработал эту сумму. С финансовой точки зрения у бизнеса появляется обязательство перед клиентом. Он получил деньги, но должен выполнить обещание.", "Если услуга оказана, но клиент оплатит позже, выручка уже возникла. Денег ещё нет, но бизнес уже заработал доход. В балансе появляется дебиторская задолженность. Это означает, что клиент должен бизнесу деньги.", "Поэтому выручка и поступление денег могут происходить в разные моменты. Иногда деньги приходят раньше выручки. Иногда выручка возникает раньше денег. Иногда деньги вообще не связаны с выручкой, как в случае кредита или вклада собственника.", "Слайд 5. Прибыль: результат после расходов", "Что показать на слайде", "Показать простую формулу: Прибыль = Выручка − Расходы. Ниже показать, что расходы делятся на прямые, маркетинговые, административные, управленческие, амортизацию, проценты и налоги. Отдельно подписать: «платёж не всегда равен расходу».", "Текст под слайдом", "Прибыль показывает, сколько бизнес заработал после учёта расходов. Для расчёта прибыли недостаточно посмотреть, сколько денег осталось на счёте. Нужно понять, какая выручка была заработана и какие расходы относятся к этому периоду. Поэтому прибыль является результатом сопоставления доходов и расходов.", "Расход не всегда совпадает с платежом. Бизнес мог получить счёт от поставщика и признать расход, но оплатить его позже. Бизнес мог заплатить авансом за несколько месяцев вперёд, но расход должен относиться к будущим периодам. Бизнес мог купить оборудование, и тогда деньги ушли сразу, но расход будет появляться постепенно через амортизацию.", "Прибыль можно исказить, если неправильно классифицировать операции. Если кредит записать как доход, прибыль будет искусственно завышена. Если покупку оборудования списать в расходы одного месяца, прибыль будет искусственно занижена. Если аванс клиента признать выручкой сразу, бизнес покажет доход, который ещё не заработал.", "Поэтому предприниматель должен понимать не только сумму операции, но и её природу. Одна сумма может быть выручкой, долгом, авансом, активом или вкладом собственника. Финансовая грамотность начинается с правильной классификации. Без неё отчёты становятся красивыми, но опасными.", "Слайд 6. Расход и платёж: почему это не одно и то же", "Что показать на слайде", "Показать две колонки: Расход и Платёж. В колонке расход написать: «уменьшает прибыль». В колонке платёж написать: «уменьшает деньги». Между колонками показать примеры: аренда, зарплата, оборудование, погашение кредита.", "Текст под слайдом", "Расход отвечает на вопрос, что уменьшило финансовый результат бизнеса. Платёж отвечает на вопрос, куда ушли деньги. Эти события могут совпадать, но они не обязаны совпадать. Именно из-за этого предприниматели часто путают прибыль и кассу.", "Например, аренда за текущий месяц обычно является и расходом, и платежом, если её оплатили сразу. В этом случае она уменьшает и прибыль, и деньги. Но если аренда начислена, а оплатят её позже, прибыль уже уменьшилась. Деньги при этом пока не ушли.", "Другой пример — покупка оборудования. Деньги уходят сразу в момент оплаты. Но оборудование не является расходом одного месяца, потому что оно будет работать долго. В ОПиУ расход будет отражаться постепенно через амортизацию.", "Погашение тела кредита тоже часто путают с расходом. Деньги действительно уходят со счёта. Но тело кредита не является расходом, потому что бизнес возвращает ранее полученный долг. Расходом являются проценты, потому что это стоимость использования заёмных денег.", "Слайд 7. Актив и расход: покупка не всегда уменьшает прибыль сразу", "Что показать на слайде", "Показать пример: бизнес купил оборудование за 500 000 ₽. В ДДС показать минус 500 000 ₽. В балансе показать плюс оборудование. В ОПиУ показать не всю сумму, а ежемесячную амортизацию.", "Текст под слайдом", "Актив — это то, что остаётся у бизнеса и будет приносить пользу в будущем. Расход — это то, что связано с получением результата текущего периода. Если бизнес покупает расходники, они могут быстро перейти в себестоимость. Если бизнес покупает оборудование, оно обычно становится активом.", "Предприниматель часто воспринимает любую покупку как расход. Это удобно психологически, потому что деньги ушли и кажется, что бизнес потратил сумму полностью. Но финансово важно понять, исчезла ли ценность или она перешла в другую форму. Если деньги превратились в оборудование, то у бизнеса появился актив.", "Покупка оборудования влияет на ДДС сразу. Она уменьшает деньги в момент оплаты. Но на прибыль она влияет постепенно. Это происходит через амортизацию, которая распределяет стоимость актива на период его использования.", "Если списать оборудование в расходы одного месяца, отчёт будет искажён. Месяц покупки покажется хуже, чем он есть. Следующие месяцы покажутся лучше, потому что оборудование используется, но расход уже не отражается. Поэтому активы нужны для честного понимания результата.", "Слайд 8. Кредит: деньги пришли, но бизнес не заработал", "Что показать на слайде", "Показать поступление кредита 1 000 000 ₽ на счёт. В ДДС показать плюс 1 000 000 ₽ в финансовом потоке. В балансе показать плюс деньги и плюс долг. В ОПиУ показать ноль по выручке.", "Текст под слайдом", "Кредит увеличивает деньги на счёте, но не является выручкой. Бизнес не заработал эти деньги у клиента. Он получил ресурс, который должен вернуть. Поэтому кредит отражается как долг, а не как доход.", "Если предприниматель считает кредит выручкой, он создаёт опасную иллюзию. В отчёте кажется, что бизнес вырос и заработал больше. На деле бизнес просто увеличил обязательства. Такое искажение может привести к неправильным решениям по расходам, зарплатам и дивидендам.", "В ДДС кредит действительно будет поступлением. Но это поступление относится не к операционной деятельности, а к финансовой. Оно показывает, что бизнес привлёк деньги извне. Эти деньги могут помочь пройти кассовый разрыв или профинансировать рост.", "В балансе кредит всегда имеет вторую сторону. Деньги увеличиваются, но одновременно увеличивается долг. Позже бизнес будет платить проценты и возвращать тело кредита. Поэтому кредит улучшает кассу сегодня, но создаёт нагрузку на будущий денежный поток.", "Слайд 9. Аванс клиента: деньги пришли, но обязательство осталось", "Что показать на слайде", "Показать пример: клиент купил абонемент на 1 000 000 ₽. В ДДС показать поступление денег. В балансе показать обязательство «авансы клиентов». В ОПиУ показать выручку только по мере оказания услуг.", "Текст под слайдом", "Аванс клиента — одна из самых частых причин финансовой ошибки в услугах. Деньги поступают на счёт, и бизнесу кажется, что он заработал. Но если услуга ещё не оказана, выручка ещё не возникла. Бизнес получил деньги вперёд и теперь обязан выполнить работу.", "Особенно важно понимать это в абонементах, сертификатах, пакетах услуг и подписках. Продажа абонемента улучшает деньги сегодня. Но она создаёт обязательство оказать услуги завтра. Если бизнес потратит эти деньги как свободную прибыль, он может столкнуться с кассовым разрывом позже.", "В ОПиУ аванс должен превращаться в выручку постепенно. Например, клиент оплатил десять процедур. Выручка должна признаваться по мере проведения процедур. Остаток неоказанных процедур остаётся обязательством перед клиентом.", "Для предпринимателя это принципиально. Авансы могут создавать ощущение сильной кассы. Но если не отделять авансы от заработанной выручки, бизнес может переоценить свою прибыльность. Поэтому финансовая система должна отдельно видеть деньги, выручку и обязательства перед клиентами.", "Слайд 10. Дебиторка: бизнес заработал, но денег ещё нет", "Что показать на слайде", "Показать пример: услуга оказана на 1 000 000 ₽, клиент оплатит через 30 дней. В ОПиУ показать выручку 1 000 000 ₽. В ДДС показать ноль поступления сейчас. В балансе показать дебиторскую задолженность 1 000 000 ₽.", "Текст под слайдом", "Дебиторская задолженность возникает, когда бизнес уже заработал выручку, но деньги ещё не получил. Это особенно важно для проектов, B2B-услуг, корпоративных клиентов и продаж с отсрочкой. В ОПиУ выручка уже будет отражена. В ДДС поступления пока не будет.", "Такой бизнес может показывать прибыль и одновременно испытывать нехватку денег. На бумаге он заработал. Но деньги застряли у клиента. Поэтому прибыль не гарантирует платёжеспособность.", "Если дебиторка растёт быстрее выручки, это тревожный сигнал. Бизнес может продавать всё больше, но получать деньги всё позже. В такой ситуации рост может создать кассовый разрыв. Собственник должен следить не только за продажами, но и за сроками оплаты.", "Возврат дебиторки тоже нужно правильно понимать. Когда клиент наконец платит старый долг, деньги приходят на счёт. Но это не новая выручка, если выручка была признана раньше. Это превращение дебиторки в деньги внутри баланса.", "Слайд 11. Сквозной кейс: на счёт пришёл 1 000 000 ₽", "Что показать на слайде", "Показать центр слайда: «+1 000 000 ₽ на счёте». От этой суммы сделать пять веток: выручка, аванс клиента, кредит, возврат дебиторки, вклад собственника. Рядом поставить вопрос: «Что это значит для бизнеса?»", "Текст под слайдом", "Теперь разберём главный кейс урока. На счёт бизнеса поступил 1 000 000 ₽. Банковский остаток увеличился одинаково во всех вариантах. Но управленческий смысл операции будет совершенно разным.", "Первый вариант — это оплата за уже оказанную услугу или проданный товар. Тогда сумма может быть связана с выручкой. Второй вариант — это аванс клиента. Тогда деньги пришли, но бизнес ещё должен выполнить обязательство.", "Третий вариант — это кредит. Тогда деньги пришли, но бизнес не заработал их и должен вернуть. Четвёртый вариант — возврат дебиторки. Тогда деньги пришли сейчас, но выручка могла быть признана раньше.", "Пятый вариант — вклад собственника. Тогда деньги пришли от владельца бизнеса, а не от клиента. Это укрепляет кассу, но не создаёт выручку. Поэтому одинаковый приход денег может означать пять разных финансовых событий.", "Слайд 12. Вариант 1: это настоящая выручка", "Что показать на слайде", "Показать ситуацию: клиент оплатил услугу, которая уже оказана. В ОПиУ показать плюс выручка. В ДДС показать плюс операционные поступления. В балансе показать плюс деньги и влияние на капитал через прибыль.", "Текст под слайдом", "Если 1 000 000 ₽ пришёл за уже оказанную услугу, это может быть настоящей выручкой. Бизнес передал ценность клиенту. Клиент оплатил эту ценность. В этом варианте поступление денег и признание выручки могут совпасть.", "В ОПиУ появится выручка 1 000 000 ₽. Затем из неё нужно вычесть себестоимость, операционные расходы, налоги и другие расходы периода. Только после этого можно говорить о прибыли. Выручка сама по себе ещё не равна заработанным деньгам собственника.", "В ДДС появится операционное поступление. Это хороший тип поступления, потому что деньги пришли от основной деятельности бизнеса. Но даже здесь нельзя останавливаться на факте прихода. Нужно понять, сколько из этой выручки останется после расходов и обязательных платежей.", "В балансе увеличатся деньги. Если операция прибыльная, через ОПиУ увеличится капитал собственника. Если расходы по этой выручке выше самой выручки, бизнес может получить деньги и всё равно показать убыток. Поэтому даже настоящая выручка требует анализа маржи и расходов.", "Слайд 13. Вариант 2: это аванс клиента", "Что показать на слайде", "Показать ситуацию: клиент оплатил абонемент, но услуги ещё не оказаны. В ОПиУ показать ноль выручки сейчас или частичную выручку. В ДДС показать плюс деньги. В балансе показать плюс деньги и плюс обязательство перед клиентом.", "Текст под слайдом", "Если 1 000 000 ₽ пришёл как аванс, бизнес получил деньги раньше заработка. Это часто происходит при продаже абонементов, сертификатов, предоплат и пакетов услуг. Деньги на счёте выросли. Но выручка ещё не должна признаваться полностью.", "В ОПиУ сейчас не должно появиться 1 000 000 ₽ выручки, если услуга ещё не оказана. Выручка будет появляться постепенно. Каждый раз, когда бизнес выполняет часть обязательства, часть аванса превращается в выручку. Это делает отчёт о прибыли честным.", "В ДДС поступление уже есть. Денежный поток выглядит сильнее. Но это не свободные деньги в полном смысле. Бизнес получил их под будущую работу.", "В балансе одновременно появляются деньги и обязательство перед клиентом. Это обязательство показывает, что бизнес должен оказать услуги или вернуть деньги. Если предприниматель потратит весь аванс как прибыль, он может создать будущую проблему. Поэтому авансы нужно отдельно контролировать.", "Слайд 14. Вариант 3: это кредит", "Что показать на слайде", "Показать ситуацию: банк выдал кредит 1 000 000 ₽. В ОПиУ показать ноль выручки. В ДДС показать финансовое поступление. В балансе показать плюс деньги и плюс долг.", "Текст под слайдом", "Если 1 000 000 ₽ пришёл как кредит, бизнес получил финансирование. Это не продажа и не заработок. Клиенту не была передана ценность. Поэтому в ОПиУ не должна появляться выручка.", "В ДДС кредит отражается как поступление денег. Но важно показать его в правильном разделе. Это не операционный денежный поток, а финансовый поток. Он показывает, что бизнес привлёк внешний источник денег.", "В балансе кредит отражается сразу с двух сторон. Деньги увеличиваются на 1 000 000 ₽. Одновременно появляется долг на 1 000 000 ₽. Чистое финансовое положение бизнеса не становится лучше только из-за факта кредита.", "Позже кредит начнёт влиять на бизнес через платежи. Проценты будут расходом и будут уменьшать прибыль. Погашение тела кредита будет уменьшать деньги, но не будет расходом. Поэтому кредит нужно анализировать через долг, проценты и будущий денежный поток.", "Слайд 15. Вариант 4: это возврат дебиторки", "Что показать на слайде", "Показать ситуацию: клиент оплатил старый долг. В ОПиУ показать, что выручка уже была признана раньше. В ДДС показать плюс деньги сейчас. В балансе показать плюс деньги и минус дебиторка.", "Текст под слайдом", "Если 1 000 000 ₽ пришёл как возврат дебиторки, это не новая выручка. Бизнес мог оказать услугу или передать товар раньше. В тот момент выручка уже была признана. Сейчас клиент просто погасил свой долг.", "В ОПиУ текущего периода эта сумма не должна второй раз попадать в выручку. Если записать её как новую выручку, бизнес задвоит доход. Это создаст ложную прибыль. Потом собственник может принять решение на основе завышенного результата.", "В ДДС поступление будет отражено сейчас. Денег действительно стало больше. Это хорошее событие для кассы. Но оно не означает, что бизнес заработал новый доход в текущем периоде.", "В балансе происходит замена одного актива на другой. Дебиторская задолженность уменьшается. Деньги увеличиваются. Общая сумма активов может не измениться, потому что долг клиента просто превратился в деньги.", "Слайд 16. Вариант 5: это вклад собственника", "Что показать на слайде", "Показать ситуацию: собственник внёс 1 000 000 ₽ в бизнес. В ОПиУ показать ноль выручки. В ДДС показать поступление от собственника. В балансе показать плюс деньги и плюс капитал или займ собственника.", "Текст под слайдом", "Если 1 000 000 ₽ внёс собственник, бизнес получил внутреннее финансирование. Это может быть вклад в капитал или займ от собственника. В любом случае это не выручка. Клиенты не оплатили продукт или услугу.", "В ОПиУ эта сумма не должна появляться как доход. Иначе бизнес покажет прибыль, которую не заработал на рынке. Это особенно опасно на старте, когда собственник часто докладывает деньги. Без разделения кажется, что бизнес живёт на выручку, хотя на самом деле он живёт на вложения владельца.", "В ДДС поступление будет видно. Деньги действительно пришли в бизнес. Но по смыслу это финансовая поддержка, а не результат основной деятельности. Для управленческого анализа это нужно показывать отдельно.", "В балансе увеличатся деньги. Второй стороной будет капитал собственника или задолженность перед собственником. Если это вклад, он усиливает капитал. Если это займ, у бизнеса появляется обязательство вернуть деньги владельцу.", "Слайд 17. Матрица влияния: одна сумма, пять разных смыслов", "Что показать на слайде", "Показать таблицу из пяти строк и трёх колонок: ОПиУ, ДДС, Баланс. В строках указать: выручка, аванс, кредит, возврат дебиторки, вклад собственника. Цветом выделить, что ДДС увеличивается во всех пяти вариантах, но ОПиУ меняется не всегда.", "Текст под слайдом", "Теперь видно, почему банковский остаток нельзя использовать как единственный показатель бизнеса. Во всех пяти вариантах деньги на счёте увеличились на 1 000 000 ₽. Но только один вариант может быть полноценной текущей выручкой. Остальные варианты имеют другой финансовый смысл.", "Если это выручка, она влияет на ОПиУ и может привести к прибыли. Если это аванс, она влияет на деньги и обязательства, но не полностью на выручку. Если это кредит, она увеличивает деньги и долг. Если это возврат дебиторки, она превращает старый долг клиента в деньги.", "Если это вклад собственника, бизнес получил поддержку владельца. Такая операция не показывает качество бизнес-модели. Она может быть полезной, но её нельзя путать с заработком. Иначе предприниматель будет считать внешнее финансирование успехом продаж.", "Главная задача финансовой системы — правильно классифицировать каждую операцию. Без классификации все поступления сливаются в одну массу. Тогда предприниматель видит деньги, но не видит прибыль, обязательства и реальное положение бизнеса. Именно поэтому нужны ОПиУ, ДДС и баланс вместе.", "Слайд 18. Правило собственника: сначала смысл, потом сумма", "Что показать на слайде", "Показать финальное правило: «Любая операция сначала получает финансовый смысл, и только потом попадает в отчёт». Ниже показать пять проверочных вопросов: это выручка, аванс, долг, возврат старого долга или вклад собственника. Внизу указать итог: «Остаток денег — это не диагноз бизнеса».", "Текст под слайдом", "Финансовое мышление собственника начинается не с вопроса, сколько денег пришло. Оно начинается с вопроса, почему эти деньги пришли. Одна и та же сумма может усиливать бизнес, создавать обязательство или увеличивать долг. Поэтому сумма без смысла ничего не доказывает.", "После любого поступления нужно задать несколько вопросов. Клиент уже получил ценность или бизнес ещё должен её оказать. Это деньги от операционной деятельности или внешнее финансирование. Эта операция создаёт выручку, обязательство, долг, актив или капитал.", "После любого платежа нужно задавать такие же вопросы. Это расход текущего периода или покупка актива. Это оплата поставщику или погашение долга. Это уменьшает прибыль или только уменьшает деньги.", "Главный итог урока простой. Деньги на счёте не равны прибыли. Поступление денег не всегда является выручкой. Предприниматель должен смотреть на бизнес через ОПиУ, ДДС и баланс одновременно.", "Итоговая логика урока", "Этот урок должен полностью убрать у ученика привычку оценивать бизнес только по кассе. Ученик должен понять, что деньги являются только одним из слоёв финансовой системы. Прибыль показывает, заработал ли бизнес. Баланс показывает, что бизнес имеет и кому он должен.", "Сквозной кейс на 1 000 000 ₽ нужен как главный практический якорь. Он показывает, что одна сумма может иметь разные значения. Если ученик понял этот кейс, он уже не будет автоматически называть поступления выручкой. Это базовая точка входа в финансовый менеджмент.", "После урока остаётся карта пяти ситуаций: 1) деньги пришли как заработанная выручка; 2) деньги пришли как аванс клиента; 3) деньги пришли как кредит; 4) деньги пришли как возврат дебиторки; 5) деньги пришли как вклад собственника. Все пять ситуаций увеличивают деньги, но по-разному влияют на ОПиУ, ОДДС и баланс. Именно это различие является главным результатом урока."], "status": "ready"}, {"id": 2, "title": "Финансовая карта бизнеса", "objective": "Показать бизнес как систему: операции превращаются в выручку, деньги превращаются в денежный поток, остатки формируют баланс, метрики ведут к решениям.", "content": "Операционный контур, денежный контур, балансовый контур, контур метрик и управленческих решений.", "case": "Один и тот же месяц бизнеса разбирается через три экрана: ОПиУ, ДДС и баланс. Ученик видит, что каждый экран отвечает на разные вопросы.", "result": "Ученик понимает, что финансы бизнеса нельзя свести к одной таблице кассы.", "fullContent": ["Урок 2. Финансовая карта бизнеса", "Общая структура урока", "Название урока: Финансовая карта бизнеса.\nЗадача урока: показать бизнес как систему, где операции превращаются в выручку, деньги превращаются в денежный поток, остатки формируют баланс, а метрики ведут к управленческим решениям.\nКоличество слайдов: 22.\nРекомендуемая длительность урока: 80–110 минут.\nФормат урока: теория, схемы, сквозной кейс одного месяца бизнеса, разбор через ОПиУ, ДДС, баланс и метрики.\nТест после урока: не используется.\nРезультат ученика: ученик понимает, что финансы бизнеса нельзя свести к одной таблице кассы, одному банковскому остатку или одному показателю выручки.", "Слайд 1. Зачем предпринимателю финансовая карта бизнеса", "Что показать на слайде", "Показать крупную схему: «Бизнес ≠ касса». Ниже изобразить четыре слоя: операции, деньги, остатки, решения. В центре показать собственника, который должен видеть не одну цифру, а всю систему.", "Текст под слайдом", "Финансовая карта бизнеса нужна для того, чтобы предприниматель видел бизнес целиком. Если смотреть только на деньги, можно не заметить убыточность. Если смотреть только на прибыль, можно не заметить кассовый разрыв. Если смотреть только на выручку, можно не увидеть долгов, авансов и будущих обязательств.", "Бизнес каждый день производит много событий. Клиенты обращаются, записываются, покупают, оплачивают, получают услуги, возвращаются или уходят. Компания закупает материалы, платит сотрудникам, несёт расходы, берёт кредиты, покупает оборудование и платит налоги. Все эти события должны попадать в финансовую систему не случайно, а по понятной логике.", "Финансовая карта показывает, как одно событие отражается в разных частях бизнеса. Оказанная услуга может создать выручку. Оплата клиента может создать денежное поступление. Предоплата клиента может создать обязательство, а не прибыль.", "Главная идея урока состоит в том, что у бизнеса есть несколько финансовых экранов. Каждый экран отвечает на свой вопрос и не заменяет остальные. ОПиУ отвечает за прибыльность, ДДС отвечает за движение денег, баланс отвечает за финансовое положение. Метрики связывают эти отчёты с управленческими решениями.", "Слайд 2. Бизнес как система, а не набор таблиц", "Что показать на слайде", "Показать систему из связанных блоков: операции → отчёты → метрики → решения. Отдельно показать, что таблица кассы — это только один маленький блок внутри системы. Можно визуально выделить, что касса не видит прибыль, обязательства и активы.", "Текст под слайдом", "Предприниматель часто начинает учёт с простой таблицы кассы. В такой таблице обычно есть дата, поступление, расход и остаток. Это полезный старт, потому что бизнес хотя бы начинает видеть движение денег. Но таблица кассы не объясняет, заработал бизнес или просто получил временные деньги.", "Одна таблица кассы не показывает выручку в правильном смысле. Она не отделяет оплату текущей услуги от аванса клиента. Она не показывает, что клиент уже получил услугу, но оплатит позже. Она не показывает расходы, которые были начислены, но ещё не оплачены.", "Бизнес нельзя понять без связи между операциями, деньгами и остатками. Операции показывают, что было сделано. Деньги показывают, что было оплачено. Остатки показывают, что осталось у бизнеса и что бизнес должен.", "Финансовая система отличается от набора таблиц тем, что в ней есть логика связей. Каждая операция должна иметь финансовый смысл. Каждая сумма должна попадать в правильный контур. Каждый отчёт должен отвечать на свой вопрос и не подменять другой отчёт.", "Слайд 3. Четыре контура финансовой карты", "Что показать на слайде", "Показать четыре больших контура: операционный контур, денежный контур, балансовый контур, контур метрик и решений. Между ними показать стрелки. Внизу подписать: «финансы = связи между контурами».", "Текст под слайдом", "Финансовая карта бизнеса состоит из четырёх ключевых контуров. Первый контур — операционный. Он показывает, что бизнес реально делает: продаёт, оказывает услуги, производит, закупает, доставляет, обслуживает клиентов и выполняет проекты.", "Второй контур — денежный. Он показывает, когда и почему деньги входят в бизнес и выходят из него. Денежный контур важен для платёжеспособности, кассовых разрывов и краткосрочной устойчивости. Он не заменяет прибыль, но показывает, может ли бизнес выполнять обязательства деньгами.", "Третий контур — балансовый. Он показывает активы, обязательства и капитал собственника. В этом контуре видны деньги, дебиторка, запасы, основные средства, кредиты, авансы клиентов и долги поставщикам. Баланс показывает не движение, а состояние бизнеса на конкретную дату.", "Четвёртый контур — контур метрик и решений. Он превращает отчёты в управленческие выводы. Метрики показывают, где бизнес сильный, где слабый, где есть риск и где есть потенциал роста. Без этого контура отчёты остаются просто набором цифр.", "Слайд 4. Первый контур: операционная реальность бизнеса", "Что показать на слайде", "Показать схему операционного потока: заявки → продажи → выполнение → результат → повторное действие клиента. Для услуг можно показать цепочку: обращение → запись → визит → услуга → повторный визит. Для торговли можно показать: трафик → покупка → отгрузка → повторная покупка.", "Текст под слайдом", "Операционная реальность показывает, что бизнес делает до того, как цифры попадут в отчёты. В услугах это заявки, записи, визиты, оказанные услуги и повторные визиты. В торговле это трафик, конверсия, продажи, отгрузки, возвраты и товарные остатки. В производстве это закупка сырья, выпуск продукции, незавершённое производство и реализация.", "Финансовые отчёты не возникают из воздуха. Они являются отражением операционных событий. Если бизнес неправильно фиксирует операции, финансовая отчётность будет искажена. Поэтому финансовое управление начинается не с формул, а с правильного описания того, что происходит в бизнесе.", "Операционный контур отвечает на вопрос, как бизнес создаёт ценность. Он показывает, через какие действия появляется выручка. Он показывает, какие ресурсы используются для создания результата. Он показывает, где возникают ограничения: загрузка, мощность, персонал, поставки, склад или время выполнения.", "Если предприниматель не понимает операционный контур, он не сможет правильно читать финансы. Выручка будет казаться просто суммой продаж. Расходы будут казаться просто списком платежей. Метрики будут казаться отдельными цифрами без связи с реальными процессами бизнеса.", "Слайд 5. Как операции превращаются в выручку", "Что показать на слайде", "Показать формулу: выручка = признанная ценность, переданная клиенту. Ниже показать разные варианты признания: услуга оказана, товар передан, этап проекта выполнен, подписка использована. Справа показать, что оплата может быть раньше, позже или одновременно.", "Текст под слайдом", "Выручка появляется тогда, когда бизнес передал клиенту ценность. Для услуги это момент оказания услуги. Для торговли это момент передачи товара покупателю. Для проекта это момент выполнения этапа или согласованной части работ.", "Операция продажи и операция оплаты могут происходить в разные моменты. Клиент может заплатить до получения услуги. Клиент может заплатить сразу после получения услуги. Клиент может заплатить через месяц, если бизнес работает с отсрочкой.", "Поэтому финансовая карта должна отделять факт продажи от факта оплаты. Если услуга оказана, но деньги ещё не пришли, возникает выручка и дебиторская задолженность. Если деньги пришли заранее, но услуга ещё не оказана, возникает денежное поступление и обязательство перед клиентом. Если деньги пришли как кредит, выручка вообще не возникает.", "Формула выручки зависит от вида бизнеса, но логика остаётся общей. В услугах выручка может считаться через количество визитов и средний чек. В торговле она может считаться через количество проданных единиц и цену. В проектном бизнесе она может считаться через выполненные этапы и процент готовности.", "Слайд 6. Как ресурсы превращаются в расходы", "Что показать на слайде", "Показать схему: ресурсы → использование → расход периода. Отдельно показать, что деньги могут уйти раньше, позже или в момент расхода. Примеры: зарплата, аренда, расходники, реклама, оборудование.", "Текст под слайдом", "Расход появляется не просто потому, что деньги ушли. Расход появляется тогда, когда ресурс был использован для получения результата периода. Если мастер оказал услугу, его труд может стать частью себестоимости. Если реклама работала в текущем месяце, она может стать расходом текущего периода.", "Платёж и расход могут совпадать, но это не обязательное правило. Аренду можно оплатить в текущем месяце и признать расходом текущего месяца. Можно оплатить аренду заранее за несколько месяцев, и тогда часть платежа будет относиться к будущим периодам. Можно получить услугу от поставщика сейчас, а оплатить её позже.", "Оборудование показывает особенно важное отличие между платежом и расходом. Деньги уходят сразу при покупке. Но оборудование будет использоваться долго. Поэтому в ОПиУ оно должно попадать постепенно через амортизацию.", "Если бизнес не отделяет платежи от расходов, прибыль становится случайной. Месяц с крупной покупкой оборудования может выглядеть убыточным, хотя операционная модель не ухудшилась. Месяц без платежей может выглядеть прибыльным, хотя расходы уже накоплены. Поэтому финансовая карта должна связывать ресурсы, расходы, платежи и активы.", "Слайд 7. ОПиУ: экран прибыльности бизнеса", "Что показать на слайде", "Показать структуру ОПиУ: выручка → себестоимость → валовая прибыль → операционные расходы → EBITDA → амортизация → EBIT → проценты → налог → чистая прибыль. Рядом подписать главный вопрос: «Бизнес зарабатывает или нет?».", "Текст под слайдом", "ОПиУ показывает, зарабатывает ли бизнес в выбранном периоде. Этот отчёт собирает выручку, расходы и прибыль. Он не показывает движение денег напрямую. Его задача — показать экономический результат бизнеса.", "Базовая логика ОПиУ строится сверху вниз. Сначала показывается выручка. Затем вычитается себестоимость, чтобы получить валовую прибыль. После этого вычитаются операционные расходы, амортизация, проценты и налоги.", "ОПиУ помогает понять качество бизнес-модели. Если валовая маржа слабая, проблема может быть в цене, себестоимости или продуктовой линейке. Если EBITDA слабая, проблема может быть в операционных расходах. Если чистая прибыль слабая при нормальной EBITDA, проблема может быть в долге, амортизации или налоговой нагрузке.", "Главное ограничение ОПиУ состоит в том, что он не показывает кассу. Бизнес может быть прибыльным и одновременно испытывать нехватку денег. Бизнес может получать много денег и одновременно быть убыточным. Поэтому ОПиУ нужно читать вместе с ДДС и балансом.", "Слайд 8. Денежный контур: когда бизнес реально получает и тратит деньги", "Что показать на слайде", "Показать поток денег: деньги на начало → поступления → платежи → деньги на конец. Разделить поступления и платежи на операционные, инвестиционные и финансовые. Внизу показать формулу: деньги конец = деньги начало + чистый денежный поток.", "Текст под слайдом", "Денежный контур показывает движение денег. Он отвечает на вопрос, почему остаток денег увеличился или уменьшился. В этом контуре важна не прибыль, а факт поступления или платежа. Поэтому денежный контур ближе всего к реальной платёжеспособности бизнеса.", "Главная формула денежного контура проста. Деньги на конец периода равны деньгам на начало периода плюс чистое изменение денег. Чистое изменение денег складывается из всех поступлений и всех платежей. Но для анализа важно не только изменение, а структура этого изменения.", "Деньги могут прийти от клиентов, от банка, от собственника или от возврата дебиторки. Деньги могут уйти на расходы, оборудование, погашение кредита, налоги или дивиденды. Визуально все эти события просто меняют остаток счёта. Управленчески они имеют разный смысл.", "Поэтому ДДС делится на операционный, инвестиционный и финансовый поток. Операционный поток показывает деньги от основной деятельности. Инвестиционный поток показывает вложения в активы и развитие. Финансовый поток показывает кредиты, займы, вклады и изъятия собственника.", "Слайд 9. ДДС: экран платёжеспособности", "Что показать на слайде", "Показать структуру ДДС: OCF + CFI + CFF = Net CF. Рядом подписать вопрос: «Хватит ли бизнесу денег?». Внизу показать пример: прибыль есть, но деньги уменьшаются из-за дебиторки, capex и погашения долга.", "Текст под слайдом", "ДДС показывает, способен ли бизнес жить по деньгам. Он объясняет, откуда деньги пришли и куда они ушли. Этот отчёт особенно важен для контроля кассовых разрывов. Он показывает не теоретическую прибыль, а реальное движение средств.", "Операционный денежный поток показывает денежный результат основной деятельности. Если он стабильно отрицательный, бизнесу трудно жить без внешнего финансирования. Даже если ОПиУ показывает прибыль, отрицательный OCF может сигнализировать о проблемах с оплатами, запасами или авансами. Поэтому OCF нужно анализировать отдельно от чистой прибыли.", "Инвестиционный денежный поток показывает вложения в развитие или активы. Покупка оборудования, ремонт, открытие точки или покупка транспорта уменьшают деньги. Эти платежи могут быть правильными, если они создают будущую ценность. Но они могут создавать кассовое давление уже сейчас.", "Финансовый денежный поток показывает отношения бизнеса с капиталом и долгом. Кредит увеличивает деньги сегодня, но создаёт обязательства на будущее. Погашение кредита уменьшает деньги, но не является операционным расходом. Вклад собственника поддерживает бизнес, но не является выручкой.", "Слайд 10. Почему ОПиУ и ДДС показывают разные картины", "Что показать на слайде", "Показать две параллельные линии: экономический результат и движение денег. На первой линии отметить выручку и расходы. На второй линии отметить поступления и платежи. Между ними показать задержки: дебиторка, кредиторка, авансы, capex, долг.", "Текст под слайдом", "ОПиУ и ДДС часто не совпадают, потому что они отвечают на разные вопросы. ОПиУ показывает, заработал ли бизнес. ДДС показывает, пришли ли деньги и куда они ушли. Несовпадение этих отчётов является нормальной частью бизнеса.", "Выручка может быть признана раньше поступления денег. В этом случае бизнес заработал, но деньги ещё не получил. Появляется дебиторская задолженность. Прибыль есть, но касса не увеличилась.", "Деньги могут прийти раньше выручки. Это происходит при авансах, абонементах, сертификатах и предоплатах. В этом случае деньги есть, но бизнес ещё не заработал всю сумму. В балансе появляется обязательство перед клиентом.", "Платёж может быть не расходом периода. Покупка оборудования уменьшает деньги, но не должна полностью уменьшать прибыль текущего месяца. Погашение тела кредита уменьшает деньги, но не является расходом в ОПиУ. Именно поэтому финансовая карта должна показывать не одну линию, а несколько связанных контуров.", "Слайд 11. Балансовый контур: что бизнес имеет и кому должен", "Что показать на слайде", "Показать формулу: Активы = Обязательства + Капитал. Слева показать активы: деньги, дебиторка, запасы, оборудование. Справа показать обязательства и капитал: кредиты, авансы клиентов, кредиторка, налоги, капитал собственника.", "Текст под слайдом", "Балансовый контур показывает состояние бизнеса на конкретную дату. Он отвечает на вопрос, что у бизнеса есть и кому бизнес должен. В отличие от ОПиУ и ДДС, баланс не является отчётом движения за период. Это снимок финансового положения.", "Активы показывают ресурсы бизнеса. Деньги являются активом. Дебиторская задолженность является активом, потому что клиент должен бизнесу деньги. Оборудование является активом, если оно используется для получения будущей выгоды.", "Обязательства показывают, что бизнес должен другим. Кредит является обязательством перед банком или заимодавцем. Аванс клиента является обязательством оказать услугу или поставить товар. Кредиторская задолженность показывает, что бизнес должен поставщикам.", "Капитал показывает остаточную часть, которая принадлежит собственнику после вычета обязательств из активов. Если активы растут за счёт прибыли, капитал усиливается. Если активы растут только за счёт долга, капитал может не улучшаться. Поэтому баланс нужен, чтобы отличать реальное укрепление бизнеса от простого увеличения денег на счёте.", "Слайд 12. Остатки: мост между прибылью и деньгами", "Что показать на слайде", "Показать формулу остатка: остаток на начало + увеличение − уменьшение = остаток на конец. Рядом показать основные остатки: дебиторка, кредиторка, запасы, авансы клиентов, ОС, долг, налоги, ФОТ. В центре написать: «остатки объясняют разницу между ОПиУ и ДДС».", "Текст под слайдом", "Остатки являются главным мостом между прибылью и деньгами. Если бизнес заработал выручку, но деньги не получил, появляется дебиторка. Если бизнес получил деньги заранее, но услугу не оказал, появляются авансы клиентов. Если бизнес купил актив, деньги ушли, но в балансе появился ресурс.", "Каждый остаток должен иметь движение. Остаток на начало увеличивается новыми операциями и уменьшается закрывающими операциями. Например, дебиторка увеличивается, когда выручка признана без оплаты. Дебиторка уменьшается, когда клиент оплачивает долг.", "Такая логика важна для контроля качества данных. Остатки нельзя просто вводить как случайные цифры. Они должны быть объяснены движением бизнеса. Если остаток появился, должна быть причина его появления.", "Без остатков невозможно объяснить, почему прибыль и деньги отличаются. Прибыль может быть высокой, но деньги могут застрять в дебиторке. Деньги могут быть высокими, но часть из них может относиться к авансам клиентов. Поэтому баланс не является сложной бухгалтерской формальностью, а является картой незавершённых финансовых процессов.", "Слайд 13. Рабочий капитал: где деньги застревают внутри бизнеса", "Что показать на слайде", "Показать схему рабочего капитала: дебиторка + запасы + авансы поставщикам − кредиторка − авансы клиентов. Для услуг показать: дебиторка, авансы клиентов, ФОТ к выплате, налоги к уплате. Для торговли показать: запасы, поставщики, дебиторка, скидки и списания.", "Текст под слайдом", "Рабочий капитал показывает, сколько денег связано в текущей деятельности бизнеса. Он помогает понять, почему бизнес может быть прибыльным, но испытывать нехватку денег. Если клиенты платят позже, деньги застревают в дебиторке. Если бизнес закупил много товара, деньги застревают в запасах.", "В торговле рабочий капитал часто связан с товарным остатком. Деньги уже потрачены на закупку. Пока товар не продан, они не вернулись в кассу. Если оборачиваемость слабая, прибыль может существовать на бумаге, но деньги будут заморожены в складе.", "В услугах рабочий капитал часто проявляется через авансы клиентов, долги клиентов, ФОТ к выплате и налоги. Продажа абонементов может улучшить кассу сейчас, но создать обязательства на будущее. Работа с корпоративными клиентами может создать выручку сейчас, но деньги придут позже. Начисленная зарплата может уменьшить прибыль, но деньги уйдут в дату выплаты.", "Рабочий капитал нужно читать как систему сроков. Важно не только сколько бизнес зарабатывает, но и когда он получает деньги. Важно не только сколько бизнес тратит, но и когда он платит. Управление рабочим капиталом часто решает проблему денег быстрее, чем рост продаж.", "Слайд 14. Метрики: язык диагностики бизнеса", "Что показать на слайде", "Показать переход: отчёты → метрики → диагноз → решение. В примерах указать: валовая маржа, EBITDA margin, OCF, current ratio, LTV/CAC, загрузка, оборачиваемость, Debt/EBITDA. Подписать: «метрика без решения не нужна».", "Текст под слайдом", "Метрики нужны не для украшения дашборда. Они нужны для диагностики бизнеса. Отчёт показывает цифру, а метрика помогает понять качество этой цифры. Например, выручка сама по себе не объясняет, выгоден ли рост.", "Финансовые метрики показывают результат и устойчивость. Валовая маржа показывает качество основной модели. EBITDA margin показывает операционную эффективность. OCF показывает способность бизнеса превращать деятельность в деньги.", "Операционные и коммерческие метрики объясняют причины финансового результата. В услугах важны заявки, записи, визиты, загрузка и повторные продажи. В торговле важны трафик, конверсия, средний чек, маржа и оборачиваемость. В производстве важны мощность, выпуск, брак, себестоимость и запасы.", "Метрики должны вести к управленческим решениям. Если валовая маржа падает, нужно смотреть цены, себестоимость и продуктовую линейку. Если OCF отрицательный, нужно смотреть дебиторку, запасы, авансы и платежный календарь. Если LTV/CAC слабый, нужно пересматривать маркетинг, удержание или экономику продукта.", "Слайд 15. Метрики нельзя читать отдельно", "Что показать на слайде", "Показать несколько примеров конфликтующих сигналов: выручка растёт, маржа падает; EBITDA положительная, OCF отрицательный; деньги растут, обязательства растут; ROAS хороший, прибыль слабая. В центре написать: «одна метрика не даёт диагноза».", "Текст под слайдом", "Одна метрика почти никогда не даёт полный диагноз. Выручка может расти, но прибыль может падать. Деньги могут увеличиваться, но обязательства могут расти быстрее. Реклама может показывать хороший ROAS, но не создавать достаточную маржу.", "Метрики нужно читать связками. Выручку нужно читать вместе с валовой маржей и операционными расходами. Прибыль нужно читать вместе с денежным потоком. Деньги нужно читать вместе с балансом и обязательствами.", "Например, EBITDA может быть положительной, но OCF может быть отрицательным. Это означает, что операционная модель может выглядеть прибыльной, но деньги не превращаются в кассу. Причина может быть в дебиторке, запасах, авансах поставщикам или крупных платежах. Без связки отчётов предприниматель может сделать неправильный вывод.", "Другой пример — рост денег на счёте. Деньги могут вырасти из-за реальной выручки. Они могут вырасти из-за кредита. Они могут вырасти из-за продажи абонементов, которые ещё нужно отработать. Поэтому метрика денег должна всегда читаться вместе с ДДС и балансом.", "Слайд 16. Финансовая карта месяца: один месяц, три экрана", "Что показать на слайде", "Показать один месяц бизнеса как кейс. Слева указать исходные события месяца. Справа показать три экрана: ОПиУ, ДДС, Баланс. Внизу подписать: «один месяц — три разных вопроса».", "Текст под слайдом", "Теперь разберём месяц бизнеса через финансовую карту. В течение месяца бизнес оказывает услуги, получает оплаты, начисляет расходы, покупает активы и платит по обязательствам. Все эти события происходят в одном периоде. Но они отражаются в разных отчётах по разным правилам.", "ОПиУ покажет, сколько бизнес заработал и сколько расходов относится к этому месяцу. В нём важны выручка, себестоимость, операционные расходы, амортизация, проценты, налоги и чистая прибыль. Этот экран отвечает на вопрос прибыльности. Он не обязан совпадать с изменением денег.", "ДДС покажет, сколько денег реально пришло и ушло. В нём будут оплаты клиентов, платежи поставщикам, зарплата, налоги, покупка оборудования, кредитные платежи и вклады собственника. Этот экран отвечает на вопрос платёжеспособности. Он показывает, что произошло с деньгами.", "Баланс покажет, что осталось на конец месяца. В нём будут деньги, дебиторка, авансы клиентов, оборудование, долги, налоги к уплате и капитал. Этот экран отвечает на вопрос финансового положения. Он показывает последствия всех событий месяца.", "Слайд 17. Кейс месяца: исходные события", "Что показать на слайде", "Показать таблицу исходных событий месяца. Пример: оказано услуг на 1 200 000 ₽, получено денег от клиентов 1 500 000 ₽, из них 400 000 ₽ авансы, расходы начислены 700 000 ₽, оплачено расходов 600 000 ₽, куплено оборудование 300 000 ₽, погашен кредит 100 000 ₽. Отдельно указать, что часть выручки ещё не оплачена.", "Текст под слайдом", "Представим бизнес услуг за один месяц. Бизнес оказал услуг на 1 200 000 ₽. Денег от клиентов поступило 1 500 000 ₽. Из этих поступлений 400 000 ₽ являются авансами за будущие услуги.", "Расходы месяца начислены на 700 000 ₽. Фактически оплачено поставщикам и сотрудникам 600 000 ₽. Оставшиеся 100 000 ₽ стали задолженностью бизнеса. Это означает, что расход уже есть, но деньги ещё не ушли.", "В этом же месяце бизнес купил оборудование за 300 000 ₽. Деньги ушли сразу. Но оборудование будет использоваться не один месяц. Поэтому в ОПиУ должна попасть не вся покупка, а только амортизация периода.", "Также бизнес погасил тело кредита на 100 000 ₽. Этот платёж уменьшил деньги. Но он не является расходом в ОПиУ. Он уменьшает обязательство по кредиту в балансе.", "Слайд 18. Кейс месяца через ОПиУ", "Что показать на слайде", "Показать ОПиУ по кейсу. Выручка: 1 200 000 ₽. Расходы начисленные: 700 000 ₽. Амортизация: например, 20 000 ₽. EBITDA: 500 000 ₽. EBIT: 480 000 ₽. Отдельно показать, что аванс 400 000 ₽ не входит в выручку.", "Текст под слайдом", "Через ОПиУ этот месяц выглядит как месяц заработка. Бизнес оказал услуг на 1 200 000 ₽. Именно эта сумма является выручкой, потому что услуги уже оказаны. Поступления денег сами по себе не определяют выручку.", "Начисленные расходы составили 700 000 ₽. Эти расходы относятся к текущему месяцу, даже если часть из них ещё не оплачена. Поэтому ОПиУ учитывает 700 000 ₽ расходов, а не только 600 000 ₽ фактических платежей. Это делает прибыль более честной.", "Если не учитывать амортизацию, EBITDA составит 500 000 ₽. Если амортизация оборудования за месяц равна 20 000 ₽, EBIT составит 480 000 ₽. Покупка оборудования на 300 000 ₽ не должна полностью попадать в расходы месяца. Она влияет на ДДС сразу и на ОПиУ постепенно.", "Аванс клиентов на 400 000 ₽ не входит в выручку текущего месяца. Бизнес получил деньги, но ещё не оказал будущие услуги. Поэтому в ОПиУ эта сумма не должна завышать результат. Она будет признана выручкой позже, когда бизнес выполнит обязательство.", "Слайд 19. Кейс месяца через ДДС", "Что показать на слайде", "Показать ДДС по кейсу. Поступления от клиентов: 1 500 000 ₽. Операционные платежи: 600 000 ₽. Покупка оборудования: 300 000 ₽. Погашение кредита: 100 000 ₽. Чистое изменение денег: +500 000 ₽.", "Текст под слайдом", "Через ДДС этот месяц выглядит как месяц роста денег. От клиентов поступило 1 500 000 ₽. Это больше, чем признанная выручка, потому что часть поступлений является авансом. ДДС фиксирует факт денег, поэтому аванс входит в поступления.", "Операционные платежи составили 600 000 ₽. Это меньше начисленных расходов, потому что 100 000 ₽ расходов ещё не оплачены. ДДС показывает только фактические платежи. Поэтому он не совпадает с ОПиУ по расходам.", "Покупка оборудования на 300 000 ₽ попадает в инвестиционный денежный поток. Она уменьшает деньги сейчас. Но она не является обычным расходом периода. Поэтому ОПиУ и ДДС снова показывают разные стороны одной операции.", "Погашение тела кредита на 100 000 ₽ попадает в финансовый денежный поток. Оно уменьшает деньги и уменьшает долг. Но оно не уменьшает прибыль. Поэтому ДДС показывает платёж, которого нет в ОПиУ как расхода.", "Слайд 20. Кейс месяца через баланс", "Что показать на слайде", "Показать баланс на конец месяца после операций. В активах: деньги выросли на 500 000 ₽, оборудование увеличилось на 300 000 ₽ минус амортизация, возможно дебиторка. В обязательствах: авансы клиентов 400 000 ₽, кредиторка 100 000 ₽, долг уменьшился на 100 000 ₽. В капитале: прибыль месяца увеличила капитал.", "Текст под слайдом", "Баланс показывает последствия месяца на конец периода. Деньги выросли на 500 000 ₽, потому что поступления превысили платежи. Оборудование появилось в активах, потому что бизнес купил долгосрочный ресурс. Его стоимость будет постепенно уменьшаться через амортизацию.", "Авансы клиентов на 400 000 ₽ появились в обязательствах. Это не прибыль, а обязанность бизнеса оказать услуги в будущем. Если бизнес уже потратит эти деньги, обязательство всё равно останется. Поэтому баланс защищает собственника от иллюзии свободной кассы.", "Кредиторская задолженность на 100 000 ₽ появилась, потому что часть расходов начислена, но ещё не оплачена. Это означает, что ОПиУ уже учёл расход. ДДС ещё не показал платёж. Баланс связывает эти два отчёта через обязательство.", "Долг по кредиту уменьшился на 100 000 ₽ из-за погашения тела кредита. Деньги ушли, но прибыль не изменилась от этого платежа. Капитал собственника увеличился на прибыль месяца. В итоге баланс показывает не только деньги, но и всё финансовое положение бизнеса после месяца.", "Слайд 21. Как три экрана приводят к разным решениям", "Что показать на слайде", "Показать три блока решений. От ОПиУ: управлять маржей, расходами, ценой. От ДДС: управлять платежами, авансами, резервом, кассовыми рисками. От баланса: управлять долгом, дебиторкой, активами, обязательствами.", "Текст под слайдом", "ОПиУ приводит к решениям по прибыльности. Если валовая маржа слабая, нужно смотреть себестоимость, цену и продуктовую линейку. Если EBITDA слабая, нужно смотреть операционные расходы. Если чистая прибыль слабая, нужно смотреть амортизацию, проценты и налоги.", "ДДС приводит к решениям по деньгам. Если деньги падают, нужно смотреть поступления, платежи, дебиторку, авансы, capex и кредитные платежи. Если впереди кассовый разрыв, нужно переносить платежи, ускорять поступления или искать финансирование. Если операционный поток отрицательный, нужно разбирать модель глубже.", "Баланс приводит к решениям по устойчивости. Если растёт дебиторка, нужно управлять сроками оплаты клиентов. Если растут авансы клиентов, нужно контролировать будущую загрузку и обязательства. Если растёт долг, нужно оценивать кредитную нагрузку и способность бизнеса обслуживать платежи.", "Метрики соединяют эти решения в систему. Они показывают, где проблема является операционной, финансовой или стратегической. Например, нехватка денег может быть следствием слабых продаж, длинной дебиторки, большого capex или высокой долговой нагрузки. Без финансовой карты эти причины легко перепутать.", "Слайд 22. Итоговая финансовая карта бизнеса", "Что показать на слайде", "Показать финальную схему всего урока: операции → ОПиУ → прибыльность, деньги → ДДС → платёжеспособность, остатки → баланс → устойчивость, метрики → диагностика → решения. Внизу крупно написать: «финансы бизнеса нельзя свести к кассе».", "Текст под слайдом", "Финансовая карта бизнеса показывает, что бизнес состоит из нескольких связанных контуров. Операционный контур объясняет, как бизнес создаёт ценность. Денежный контур показывает, как деньги входят и выходят. Балансовый контур показывает, что остаётся у бизнеса и что он должен.", "ОПиУ нужен для анализа прибыльности. ДДС нужен для анализа платёжеспособности. Баланс нужен для анализа устойчивости и финансового положения. Метрики нужны для диагностики и принятия решений.", "Предприниматель ошибается, когда пытается заменить всю систему одной таблицей кассы. Касса показывает только деньги. Она не показывает, заработал ли бизнес, какие обязательства появились и какие активы были созданы. Поэтому касса является важным, но неполным экраном.", "Главный результат урока состоит в том, что ученик начинает видеть бизнес системно. Он понимает, что одна и та же операция может затрагивать несколько отчётов. Он понимает, что каждый отчёт отвечает на свой вопрос. Он готов дальше изучать ОПиУ, ДДС, баланс, метрики и управленческие решения как части единой финансовой архитектуры.", "Итоговая логика урока", "Урок 2 должен закрепить переход от простого взгляда на деньги к системному взгляду на бизнес. Ученик должен понять, что финансы не начинаются с отчётов, а начинаются с реальных операций бизнеса. Операции создают выручку, расходы, деньги, остатки, обязательства и капитал. Эти элементы нельзя смешивать в одну кассовую таблицу.", "Финансовая карта помогает ученику увидеть, зачем нужны три главных отчёта. ОПиУ показывает, зарабатывает ли бизнес. ДДС показывает, хватает ли бизнесу денег. Баланс показывает, что у бизнеса есть и кому он должен.", "Сквозной кейс месяца показывает, что один и тот же период можно увидеть через разные экраны. Через ОПиУ месяц может выглядеть прибыльным. Через ДДС он может выглядеть денежно сильным или слабым. Через баланс он может показать рост обязательств, активов или капитала.", "Главная мысль урока должна остаться у ученика в простой форме. Бизнес нельзя понять по одной цифре. Бизнес нельзя понять по одной таблице кассы. Бизнес нужно видеть как систему операций, денег, остатков, метрик и решений."], "status": "ready"}, {"id": 3, "title": "Управленческий учёт против бухгалтерии", "objective": "Отделить управленческую финансовую систему собственника от бухгалтерского учёта для государства.", "content": "Бухгалтерский учёт, налоговый учёт, управленческий учёт, управленческая отчётность, внутренние правила, логическая честность данных.", "case": "Бухгалтер показывает прибыль по правилам учёта, собственник видит кассовый риск. Ученик разбирает, почему оба взгляда могут быть правильными, но решают разные задачи.", "result": "Ученик понимает, зачем нужна отдельная управленческая финансовая система.", "fullContent": ["Урок 3. Управленческий учёт против бухгалтерии", "Общая структура урока", "Название урока: Управленческий учёт против бухгалтерии.\nЗадача урока: отделить управленческую финансовую систему собственника от бухгалтерского и налогового учёта.\nКоличество слайдов: 22.\nРекомендуемая длительность урока: 80–110 минут.\nФормат урока: теория, сравнительные схемы, кейс, разбор расхождений между бухгалтерской прибылью, управленческой прибылью и денежным риском.\nТест после урока: не используется.\nРезультат ученика: ученик понимает, зачем бизнесу нужна отдельная управленческая финансовая система, даже если бухгалтерия ведётся корректно.", "Слайд 1. Главная ошибка: считать бухгалтерию системой управления", "Что показать на слайде", "Показать две разные панели. На первой панели — бухгалтерская отчётность для государства. На второй панели — управленческая панель собственника с прибылью, деньгами, остатками, метриками и рисками.", "Текст под слайдом", "Многие предприниматели думают, что если у бизнеса есть бухгалтер, значит финансовая система уже существует. Это логичная, но опасная ошибка. Бухгалтерия действительно нужна бизнесу, но её задача не совпадает с задачей собственника. Бухгалтерия может быть корректной и при этом не давать управленческой картины.", "Бухгалтерский учёт чаще всего ориентирован на правила, документы, налоги, обязательную отчётность и юридическую корректность. Он отвечает на вопрос, как правильно отразить операции по установленным правилам. Собственника интересует другой вопрос: что на самом деле происходит с бизнесом. Эти два вопроса связаны, но они не одинаковые.", "Управленческий учёт нужен не для отчётности перед государством. Он нужен для принятия решений внутри бизнеса. Он показывает прибыльность, деньги, остатки, обязательства, эффективность, отклонения и риски. Он должен быть понятен собственнику, руководителю и команде управления.", "Главная мысль урока состоит не в том, что бухгалтерия плохая. Бухгалтерия выполняет свою функцию. Проблема начинается тогда, когда предприниматель пытается использовать бухгалтерию как единственную систему управления. Для управления бизнесом нужна отдельная управленческая финансовая система.", "Слайд 2. Три разных учёта внутри бизнеса", "Что показать на слайде", "Показать три колонки: бухгалтерский учёт, налоговый учёт, управленческий учёт. Под каждой колонкой указать главный вопрос: юридическая корректность, налоговые обязательства, управленческие решения.", "Текст под слайдом", "В бизнесе можно выделить три разных контура учёта. Первый контур — бухгалтерский учёт. Он фиксирует хозяйственные операции по правилам учёта и формирует официальную финансовую картину. Его задача связана с корректностью, документами и регламентами.", "Второй контур — налоговый учёт. Он нужен для расчёта налоговой базы и налоговых обязательств. Он может отличаться от бухгалтерского учёта, потому что налоговые правила могут иметь собственную логику. Для предпринимателя важно понимать, что налоговая прибыль и управленческая прибыль не обязаны совпадать.", "Третий контур — управленческий учёт. Он строится под задачи собственника и руководства. Он отвечает на вопросы о прибыльности, деньгах, окупаемости, марже, кассовых рисках, эффективности команды, маркетинга, продуктов и направлений. Он может использовать данные бухгалтерии, но не ограничивается ими.", "Эти три контура нельзя смешивать в одну таблицу без правил. Если смешать их, предприниматель перестанет понимать, какую цифру он видит. Одна цифра может быть корректной для налогов, но бесполезной для управления. Поэтому сначала нужно определить, какой учёт отвечает на какой вопрос.", "Слайд 3. Бухгалтерский учёт: для чего он нужен", "Что показать на слайде", "Показать схему: документы → проводки → регистры → отчётность. Отдельно подписать: юридическая корректность, подтверждение операций, обязательства, отчётность. Внизу указать: бухгалтерия не обязана быть дашбордом собственника.", "Текст под слайдом", "Бухгалтерский учёт фиксирует хозяйственную жизнь бизнеса в установленной форме. Он работает с документами, первичными основаниями, счетами учёта, регистрами и официальной отчётностью. Его задача — показать операции так, чтобы они были корректно оформлены и подтверждены. Это важный фундамент финансовой дисциплины.", "Бухгалтерия помогает бизнесу соблюдать обязательные требования. Она показывает имущество, обязательства, доходы, расходы, налоги и расчёты с контрагентами. Она помогает не потерять юридическую структуру операций. Она снижает риск хаоса в документах и обязательствах.", "Но бухгалтерия не всегда отвечает на вопросы собственника в нужной форме. Собственнику нужно знать, какое направление прибыльное. Ему нужно видеть, какой филиал создаёт кассовый риск. Ему нужно понимать, какой продукт тянет маржу вниз.", "Поэтому бухгалтерский учёт не должен заменять управленческую систему. Он может быть источником данных. Он может быть базой для сверки. Но управленческие решения требуют другой аналитики, другой группировки и другой скорости получения информации.", "Слайд 4. Налоговый учёт: почему он не равен управлению бизнесом", "Что показать на слайде", "Показать налоговый контур отдельно от управленческого. В налоговом контуре указать: налоговая база, налог к уплате, сроки, режим, декларации. В управленческом контуре указать: прибыльность, cash flow, маржа, риски, решения.", "Текст под слайдом", "Налоговый учёт нужен для расчёта налогов. Он отвечает на вопрос, сколько бизнес должен заплатить по налоговым обязательствам. Для этого используются специальные правила, сроки, режимы и основания. Эти правила могут не совпадать с управленческой логикой собственника.", "Предприниматель часто видит налоговые цифры и пытается по ним оценить здоровье бизнеса. Это опасно, потому что налоговая база не всегда показывает реальную управленческую прибыль. В одном случае налоговая нагрузка может быть низкой, но бизнес может иметь слабую маржу. В другом случае налог может быть высоким, но кассовая проблема может быть связана не с налогами, а с дебиторкой.", "Налоговый учёт не показывает всю экономику продуктов, филиалов, каналов продаж и сотрудников. Он не обязан показывать окупаемость маркетинга. Он не обязан показывать, какой абонемент создаёт будущую нагрузку. Он не обязан показывать, где бизнес теряет деньги операционно.", "Поэтому налоговый учёт нельзя использовать как единственный инструмент управления. Он нужен для контроля налоговых обязательств. Он должен быть связан с управленческой системой через налоговый блок. Но он не должен подменять финансовую диагностику бизнеса.", "Слайд 5. Управленческий учёт: система решений собственника", "Что показать на слайде", "Показать управленческий контур: ввод данных → управленческие отчёты → метрики → диагностика → решения. В центре написать: управленческий учёт отвечает на вопрос «что делать дальше». Рядом показать ОПиУ, ДДС, баланс, план-факт и дашборд.", "Текст под слайдом", "Управленческий учёт — это система, которая помогает собственнику принимать решения. Он показывает бизнес так, как им реально нужно управлять. В нём важны направления, филиалы, продукты, клиенты, каналы продаж, сотрудники, проекты и периоды. Он должен быть ближе к управленческой реальности, чем к формальному шаблону.", "Управленческий учёт отвечает на вопросы, которые бухгалтерия может не раскрывать. Какое направление даёт прибыль. Почему деньги заканчиваются при положительной прибыли. Какой продукт создаёт выручку, но не создаёт маржу. Какой филиал выглядит большим, но потребляет больше денег, чем зарабатывает.", "В управленческой системе важны не только отчёты, но и правила. Нужно заранее определить, что считать выручкой. Нужно определить, какие расходы считать прямыми. Нужно определить, как учитывать авансы, оборудование, долги, зарплаты и налоги.", "Управленческий учёт должен быть логически честным. Он не обязан совпадать с бухгалтерией построчно. Но он не должен выдумывать цифры и искажать реальность. Его задача — дать собственнику управляемую, проверяемую и полезную картину бизнеса.", "Слайд 6. Один факт — разные представления", "Что показать на слайде", "Показать одну операцию в центре: клиент оплатил абонемент на 100 000 ₽. От неё сделать три стрелки: бухгалтерский взгляд, налоговый взгляд, управленческий взгляд. В управленческом взгляде показать деньги, обязательство и будущую выручку.", "Текст под слайдом", "Одна и та же операция может по-разному отображаться в разных системах учёта. Это не означает, что одна система обязательно врёт. Это означает, что каждая система отвечает на свой вопрос. Ошибка возникает тогда, когда предприниматель берёт цифру из одной системы и использует её для другой задачи.", "Например, клиент оплатил абонемент на 100 000 ₽. С точки зрения денег бизнес получил поступление. С точки зрения управленческой выручки бизнес ещё не обязательно заработал всю сумму. С точки зрения баланса у бизнеса может появиться обязательство оказать услуги.", "В управленческой системе важно показать не только факт прихода денег. Нужно показать, какая часть суммы уже заработана, а какая относится к будущим услугам. Нужно показать, как это повлияет на загрузку специалистов. Нужно показать, какой риск возникнет, если бизнес потратит аванс как свободную прибыль.", "Именно поэтому один факт должен иметь несколько финансовых признаков. У операции должна быть дата, сумма, контрагент, экономический смысл, тип движения денег и влияние на отчёты. Тогда система не просто хранит цифры. Она объясняет, что произошло с бизнесом.", "Слайд 7. Почему бухгалтерская прибыль может отличаться от управленческой", "Что показать на слайде", "Показать две строки прибыли: бухгалтерская прибыль и управленческая прибыль. Между ними показать причины расхождений: группировка расходов, разовые операции, авансы, управленческие корректировки, филиалы, внутренние правила. Внизу написать: различие не всегда означает ошибку.", "Текст под слайдом", "Бухгалтерская прибыль и управленческая прибыль могут отличаться. Это нормальная ситуация, если у систем разные задачи и разные правила. Бухгалтерская прибыль строится по правилам бухгалтерского учёта. Управленческая прибыль строится по правилам, которые помогают собственнику понимать бизнес.", "Одно из расхождений возникает из-за группировки расходов. Бухгалтерия может классифицировать расходы по своей логике. Управленка может разделять расходы на производственные, маркетинговые, коммерческие, административные и управленческие. Для собственника это разделение важно, потому что оно показывает, какая часть бизнеса потребляет ресурсы.", "Другое расхождение возникает из-за аналитики направлений. Бухгалтерская система может не разделять прибыль по продуктам, филиалам, проектам или каналам продаж. Управленческая система должна делать такое разделение, если собственнику нужно принимать решения по этим направлениям. Иначе бизнес видит общую прибыль, но не видит источники этой прибыли.", "Также различия могут появляться из-за управленческих корректировок. Собственник может исключать разовые расходы из операционного анализа. Он может отдельно показывать вложения в развитие. Он может пересобирать отчёт так, чтобы видеть повторяемую экономику бизнеса. Главное, чтобы такие корректировки были описаны правилами и не превращались в манипуляцию.", "Слайд 8. Почему бухгалтерия может показывать прибыль, а собственник видеть кассовый риск", "Что показать на слайде", "Показать кейсовую ситуацию: прибыль есть, но денег не хватает. В ОПиУ указать положительную прибыль. В ДДС показать отрицательный денежный поток. В балансе показать рост дебиторки, авансов поставщикам или погашение кредита.", "Текст под слайдом", "Бухгалтерия или отчёт о прибыли может показывать положительный результат. При этом собственник может видеть, что денег на ближайшие платежи не хватает. Это не обязательно противоречие. Прибыль и деньги отвечают на разные вопросы.", "Прибыль может быть положительной, если бизнес признал выручку и начислил расходы корректно. Но деньги могли ещё не поступить от клиентов. В этом случае выручка есть, а денежного поступления нет. В балансе появляется дебиторская задолженность.", "Деньги могут уйти на платежи, которые не являются расходами ОПиУ. Например, бизнес мог погасить тело кредита. Бизнес мог купить оборудование. Бизнес мог заплатить налоги за прошлый период или закрыть старые обязательства.", "Поэтому собственник может быть прав, когда говорит о кассовом риске. Бухгалтерский отчёт может быть прав, когда показывает прибыль по своим правилам. Проблема не в том, что один отчёт обязательно ошибается. Проблема в том, что они отвечают на разные управленческие вопросы.", "Слайд 9. Кейс урока: бухгалтер показывает прибыль, собственник видит риск", "Что показать на слайде", "Показать вводные данные кейса. Выручка месяца 2 000 000 ₽, расходы начислены 1 400 000 ₽, прибыль 600 000 ₽. Денег поступило только 1 200 000 ₽, платежей было 1 700 000 ₽, впереди зарплата и аренда.", "Текст под слайдом", "Представим бизнес услуг за месяц. По отчёту о прибыли бизнес заработал выручку 2 000 000 ₽. Начисленные расходы составили 1 400 000 ₽. Формально управленческая или бухгалтерская прибыль до дополнительных корректировок может составить 600 000 ₽.", "Но по деньгам ситуация выглядит иначе. От клиентов поступило только 1 200 000 ₽. Часть клиентов оплатит позже, поэтому часть выручки превратилась в дебиторку. При этом платежи месяца составили 1 700 000 ₽.", "Собственник смотрит на банк и видит снижение денег. Впереди зарплата, аренда, налоги и платежи поставщикам. Он не понимает, почему в отчёте прибыль есть, а денег не хватает. На этом месте часто возникает конфликт между собственником и бухгалтерией.", "Правильный вывод состоит в том, что нужно разделить экраны. ОПиУ показывает прибыльность месяца. ДДС показывает кассовую нагрузку месяца. Баланс показывает, где застряли деньги и какие обязательства остались.", "Слайд 10. Разбор кейса через бухгалтерский взгляд", "Что показать на слайде", "Показать упрощённый отчёт: выручка 2 000 000 ₽, начисленные расходы 1 400 000 ₽, прибыль 600 000 ₽. Рядом подписать: этот взгляд отвечает на вопрос «какой финансовый результат признан за период». Отдельно указать, что он не показывает сроки оплат.", "Текст под слайдом", "Через бухгалтерский или отчётный взгляд месяц может выглядеть успешным. Выручка признана, потому что услуги были оказаны. Расходы начислены, потому что ресурсы были использованы. Разница между выручкой и расходами показывает положительный результат.", "Такой взгляд может быть корректным в своей логике. Он не обязан показывать, что все клиенты уже заплатили. Он не обязан показывать, что все платежи были комфортны для кассы. Он фиксирует экономический результат периода по своим правилам.", "Для оценки прибыльности этот взгляд полезен. Он показывает, что бизнес потенциально может зарабатывать. Он позволяет увидеть маржу, структуру расходов и операционный результат. Он помогает не путать временную нехватку денег с убыточной бизнес-моделью.", "Но этот взгляд неполон для ежедневного управления. Если собственник будет смотреть только на прибыль, он может не увидеть кассовый разрыв. Он может вовремя не заметить рост дебиторки. Он может принять решение вывести деньги, хотя бизнесу нужно закрывать платежи.", "Слайд 11. Разбор кейса через управленческий денежный взгляд", "Что показать на слайде", "Показать ДДС: поступления 1 200 000 ₽, платежи 1 700 000 ₽, чистое изменение денег минус 500 000 ₽. Рядом показать дебиторку 800 000 ₽ как причину расхождения. Внизу подписать: прибыль есть, но деньги не пришли.", "Текст под слайдом", "Через денежный взгляд месяц выглядит напряжённым. Денег поступило 1 200 000 ₽. Платежей было 1 700 000 ₽. Чистое изменение денег составило минус 500 000 ₽.", "Это не отменяет прибыльность месяца. Но это показывает, что бизнесу не хватило текущих поступлений для покрытия платежей. Если у бизнеса был запас денег, он мог пройти месяц спокойно. Если запаса не было, появилась реальная угроза кассового разрыва.", "Причина может быть в дебиторской задолженности. Бизнес оказал услуг на 2 000 000 ₽, но получил только 1 200 000 ₽. Остальные 800 000 ₽ остались у клиентов. В ОПиУ это уже выручка, а в ДДС денег ещё нет.", "Управленческий денежный взгляд нужен, чтобы не пропустить момент риска. Он показывает, когда платить зарплату, аренду, налоги и поставщикам. Он показывает, какие поступления ожидаются. Он помогает собственнику управлять сроками, а не только прибылью.", "Слайд 12. Разбор кейса через баланс", "Что показать на слайде", "Показать баланс после месяца. В активах: деньги уменьшились, дебиторка выросла. В обязательствах: остались зарплата, налоги или поставщики к оплате. В капитале: прибыль месяца увеличила капитал, но деньги могли снизиться.", "Текст под слайдом", "Баланс объясняет, почему прибыль и деньги разошлись. Если бизнес заработал выручку, но не получил оплату, в балансе появляется дебиторка. Это актив, потому что клиент должен бизнесу деньги. Но этот актив ещё не является деньгами на счёте.", "Если бизнес начислил расходы, но не все оплатил, в балансе появляются обязательства. Это могут быть поставщики, зарплата, налоги или другие долги. В ОПиУ расход уже уменьшил прибыль. В ДДС платёж может произойти позже.", "Баланс также показывает, что прибыль может увеличить капитал собственника. Но увеличение капитала не означает автоматическое увеличение денег. Прибыль могла остаться в дебиторке, запасах или других активах. Поэтому капитал и касса не являются одним и тем же.", "Через баланс собственник видит полную картину месяца. Он видит, что бизнес прибыльный, но деньги застряли в дебиторке. Он видит, какие обязательства нужно закрыть. Он понимает, какие управленческие действия нужны для превращения прибыли в деньги.", "Слайд 13. Почему оба взгляда могут быть правильными", "Что показать на слайде", "Показать две галочки: бухгалтерская прибыль корректна и кассовый риск реален. Между ними поставить знак не «против», а «и». Внизу написать: разные отчёты отвечают на разные вопросы.", "Текст под слайдом", "В кейсе бухгалтер может быть прав. Если выручка признана корректно и расходы начислены корректно, прибыль действительно может быть положительной. Это означает, что бизнес в данном периоде создал экономический результат. Такой вывод важен для оценки бизнес-модели.", "Собственник тоже может быть прав. Если денег не хватает на ближайшие платежи, кассовый риск реален. Бизнес может быть прибыльным, но временно неплатёжеспособным. Для управления деньгами этот вывод критически важен.", "Ошибка начинается, когда стороны спорят о том, какой отчёт главный. На самом деле главный не один отчёт, а правильная связка отчётов. Прибыльность нужно читать через ОПиУ. Платёжеспособность нужно читать через ДДС. Финансовое положение нужно читать через баланс.", "Именно поэтому нужна управленческая система. Она не уничтожает бухгалтерский взгляд. Она дополняет его управленческими разрезами, сроками, метриками и решениями. Тогда собственник перестаёт спорить с цифрами и начинает понимать их назначение.", "Слайд 14. Управленческая отчётность: что она должна показывать", "Что показать на слайде", "Показать набор управленческих отчётов: ОПиУ, ДДС, баланс, план-факт, платёжный календарь, метрики, дашборд. Рядом написать, какой вопрос закрывает каждый отчёт. В центре указать: управленческая отчётность = система решений.", "Текст под слайдом", "Управленческая отчётность должна показывать бизнес с точки зрения решений. Она должна отвечать не только на вопрос, что произошло. Она должна объяснять, почему это произошло. Она должна помогать понять, что делать дальше.", "ОПиУ показывает прибыльность бизнеса. ДДС показывает движение денег и платёжеспособность. Баланс показывает активы, обязательства и капитал. План-факт показывает отклонения от целей.", "Платёжный календарь показывает ближайшие денежные риски. Метрики показывают качество бизнес-модели и эффективность процессов. Дашборд собирает ключевые сигналы в один экран собственника. Но все эти инструменты должны быть связаны между собой.", "Если отчёты существуют отдельно, система не работает. ОПиУ без ДДС не показывает кассовый риск. ДДС без баланса не показывает, где застряли деньги. Метрики без отчётов могут стать красивыми, но пустыми числами.", "Слайд 15. Управленческая учётная политика: внутренние правила бизнеса", "Что показать на слайде", "Показать документ или карточку «Управленческая учётная политика». Внутри карточки указать: признание выручки, классификация расходов, авансы, ОС, долг, ФОТ, налоги, закрытие месяца. Внизу написать: правила нужны до того, как появляются споры о цифрах.", "Текст под слайдом", "Управленческая учётная политика — это внутренние правила, по которым бизнес считает свои управленческие финансы. Это не обязательно юридический документ. Это управленческое соглашение о том, как бизнес будет отражать операции. Без таких правил каждая цифра становится предметом спора.", "В политике нужно определить, когда признаётся выручка. Нужно определить, что является себестоимостью. Нужно определить, какие расходы относятся к маркетингу, коммерции, администрации и управлению. Нужно определить, как учитываются авансы клиентов и предоплаты поставщикам.", "Также нужно определить правила для основных средств, амортизации, долга, процентов, налогов и ФОТ. Например, покупка оборудования не должна случайно попадать в расход одного месяца. Кредит не должен попадать в выручку. Погашение тела кредита не должно считаться операционным расходом.", "Такая политика делает управленческую систему устойчивой. Собственник заранее понимает, по каким правилам построены отчёты. Команда понимает, куда относить операции. Финансовый помощник в приложении сможет работать корректно, если правила заданы заранее.", "Слайд 16. Логическая честность данных", "Что показать на слайде", "Показать три уровня качества данных: источник, классификация, сверка. Рядом показать ошибки: задвоение выручки, кредит как доход, аванс как прибыль, capex как расход, отсутствие сверки денег. Внизу указать: управленка может быть гибкой, но не может быть произвольной.", "Текст под слайдом", "Управленческий учёт может быть гибче бухгалтерского. Но гибкость не означает произвольность. Если цифры можно менять без правил, система перестаёт быть управленческой. Она превращается в набор удобных предположений.", "Логическая честность начинается с источника данных. Нужно понимать, откуда пришла цифра. Это банковская операция, кассовый отчёт, CRM, склад, акт, начисление зарплаты или ручная корректировка. Если источник неизвестен, доверие к цифре снижается.", "Второй уровень честности — правильная классификация. Поступление клиента нужно отличать от кредита. Аванс нужно отличать от выручки. Покупку оборудования нужно отличать от расхода. Возврат дебиторки нужно отличать от новой продажи.", "Третий уровень честности — сверка. Деньги в отчёте должны сходиться с фактическими остатками. Баланс должен сходиться. Остатки должны объясняться движениями. Если сверки нет, отчёты могут выглядеть убедительно, но быть ненадёжными.", "Слайд 17. Почему управленка должна быть быстрее бухгалтерии", "Что показать на слайде", "Показать календарь месяца. В бухгалтерском контуре отчётность появляется позже. В управленческом контуре ежедневные и еженедельные данные появляются быстрее. В центре написать: собственнику нужны решения до того, как проблема стала фактом.", "Текст под слайдом", "Управленческий учёт должен быть быстрее бухгалтерии. Собственнику нужно видеть проблему не через месяц после её возникновения. Ему нужно видеть кассовый риск заранее. Ему нужно понимать падение маржи до того, как месяц окончательно закрыт.", "Бухгалтерские данные часто требуют документов, закрытия периодов и формальной обработки. Это нормально для бухгалтерского контура. Но бизнес управляется каждый день. Решения по платежам, ценам, скидкам, ФОТ и маркетингу нельзя всегда откладывать до финального бухгалтерского закрытия.", "Управленческая система может использовать предварительные данные. Главное — помечать их статус. Данные могут быть предварительными, проверенными или закрытыми. Такой подход позволяет управлять быстро и при этом не терять контроль качества.", "Собственнику нужна система раннего предупреждения. Если кассовый остаток падает ниже резерва, ждать бухгалтерского закрытия нельзя. Если расходы растут быстрее выручки, это нужно видеть в течение месяца. Поэтому управленка должна быть не только точной, но и своевременной.", "Слайд 18. Аналитика: то, чего часто нет в бухгалтерии", "Что показать на слайде", "Показать разрезы управленческой аналитики: филиал, направление, продукт, канал продаж, клиентский сегмент, сотрудник, проект, период. Рядом показать вопрос: где бизнес реально зарабатывает. Внизу указать: без аналитики общая прибыль скрывает правду.", "Текст под слайдом", "Бухгалтерия может показывать общие цифры бизнеса. Но собственнику часто нужны разрезы. Ему нужно знать, какой филиал прибыльный. Ему нужно знать, какой продукт создаёт маржу. Ему нужно знать, какой канал продаж окупается.", "Управленческая аналитика делает бизнес видимым. Она разделяет выручку, расходы, прибыль и деньги по направлениям. Она помогает увидеть, где бизнес растёт качественно, а где только создаёт оборот. Она показывает не только сколько заработали, но и где именно заработали.", "Например, общий бизнес может быть прибыльным. Но один филиал может создавать большую часть прибыли, а другой съедать деньги. Один продукт может привлекать клиентов, но быть низкомаржинальным. Один канал рекламы может давать заявки, но не приводить к оплатам.", "Без аналитики собственник управляет средними цифрами. Средние цифры часто скрывают реальные проблемы. Поэтому управленческая система должна иметь справочники, направления, проекты, статьи и центры ответственности. Это не усложнение ради красоты, а условие нормального управления.", "Слайд 19. Мост между бухгалтерией и управленческим учётом", "Что показать на слайде", "Показать мост: бухгалтерские данные → управленческие корректировки → управленческие отчёты. На мосту указать сверки: деньги, дебиторка, кредиторка, налоги, основные средства, долг. Внизу написать: управленка не должна отрываться от фактов.", "Текст под слайдом", "Управленческий учёт не должен жить отдельно от реальных данных. Если он полностью оторван от бухгалтерии, банка, кассы и документов, он быстро станет ненадёжным. Поэтому между бухгалтерским и управленческим контуром нужен мост. Этот мост позволяет использовать факты и пересобирать их для управления.", "Из бухгалтерии можно брать подтверждённые операции, расчёты, остатки и документы. Из банка можно брать фактические денежные движения. Из CRM можно брать продажи, заявки и клиентов. Из склада или операционной системы можно брать товар, услуги, выпуск и ресурсы.", "Управленческая система затем классифицирует эти данные по своей логике. Она может перегруппировать расходы. Она может распределить доходы по направлениям. Она может показать корректировки, которые нужны собственнику для анализа.", "Но управленка должна сверяться с реальностью. Деньги должны совпадать с фактическими остатками. Долги должны быть объяснены. Дебиторка и кредиторка должны иметь расшифровку. Тогда управленческая система будет не фантазией, а рабочим инструментом.", "Слайд 20. Что нельзя требовать от бухгалтерии", "Что показать на слайде", "Показать список неправильных ожиданий: объяснить маржинальность продукта, оценить окупаемость рекламы, контролировать загрузку, строить бизнес-модель, прогнозировать кассовый разрыв без данных. Рядом показать правильный вывод: для этого нужна управленческая система.", "Текст под слайдом", "От бухгалтерии нельзя требовать того, для чего она не была построена. Бухгалтер может корректно вести документы и отчётность. Но это не значит, что бухгалтер обязан объяснять экономику каждого продукта. Это разные задачи и часто разные компетенции.", "Нельзя ожидать, что бухгалтерия сама покажет окупаемость маркетинга. Для этого нужны данные по каналам, заявкам, продажам, оплатам, марже и повторным покупкам. Бухгалтерия может видеть расходы на рекламу. Но она не всегда видит всю воронку и качество клиентов.", "Нельзя ожидать, что бухгалтерия сама построит операционную модель бизнеса. Для этого нужны данные о загрузке, мощности, часах, визитах, заказах, SKU, проектах или рейсах. Эти данные часто находятся вне бухгалтерии. Они относятся к операционному контуру бизнеса.", "Нельзя ожидать, что бухгалтерия заменит финансовое управление собственника. Бухгалтерия может быть отличной и при этом не отвечать на управленческие вопросы. Поэтому собственнику нужна не борьба с бухгалтерией, а правильное разделение функций. Бухгалтерия ведёт обязательный контур, а управленка строит систему решений.", "Слайд 21. Что должна делать управленческая система собственника", "Что показать на слайде", "Показать управленческую систему как набор функций: ввод данных, классификация, отчёты, сверки, метрики, план-факт, прогноз, решения. В центре поставить собственника. Внизу написать: система должна показывать не только прошлое, но и риски будущего.", "Текст под слайдом", "Управленческая система должна начинаться с правильного ввода данных. Каждая операция должна иметь дату, сумму, статью, направление, тип движения и экономический смысл. Данные должны попадать в систему не хаотично. Они должны быть пригодны для отчётов и анализа.", "Вторая задача системы — классифицировать данные. Нужно отделять выручку от поступлений. Нужно отделять расходы от платежей. Нужно отделять активы от расходов. Нужно отделять кредиты, авансы, дебиторку и вклады собственника.", "Третья задача — формировать отчёты. Собственнику нужны ОПиУ, ДДС, баланс, план-факт, платёжный календарь и дашборд. Эти отчёты должны быть связаны между собой. Если один отчёт показывает прибыль, а другой показывает кассовый риск, система должна объяснять причину расхождения.", "Четвёртая задача — помогать принимать решения. Система должна показывать, где падает маржа. Она должна показывать, где застряли деньги. Она должна показывать, какие обязательства скоро потребуют платежей. Она должна переводить цифры в управленческие действия.", "Слайд 22. Итог: бухгалтерия и управленка не конкурируют", "Что показать на слайде", "Показать две системы рядом. Бухгалтерия — обязательная финансовая дисциплина. Управленка — система управления бизнесом. Между ними поставить связь через данные и сверки, а не конфликт.", "Текст под слайдом", "Главный итог урока состоит в том, что бухгалтерия и управленческий учёт не должны конкурировать. Бухгалтерия нужна бизнесу для обязательного учёта, документов, налогов и корректности. Управленческий учёт нужен собственнику для решений, анализа, планирования и контроля. Эти системы решают разные задачи.", "Если у бизнеса есть только бухгалтерия, собственник может не видеть операционную картину. Он может не видеть прибыльность направлений. Он может не видеть кассовый риск заранее. Он может не понимать, какие решения нужно принимать.", "Если у бизнеса есть только управленческая таблица без связи с фактами, возникает другая опасность. Цифры могут быть красивыми, но непроверенными. Деньги могут не сходиться с банком. Остатки могут не объясняться движениями.", "Правильная система соединяет оба подхода. Бухгалтерия даёт дисциплину и подтверждение фактов. Управленческий учёт превращает факты в картину для решений. Собственник получает не спор между отчётами, а понятную финансовую архитектуру бизнеса.", "Итоговая логика урока", "Урок 3 должен убрать у ученика ложное ожидание, что бухгалтерия автоматически решает задачу финансового управления. Ученик должен понять, что бухгалтерия может быть корректной, но не отвечать на вопросы собственника. Это не делает бухгалтерию бесполезной. Это показывает необходимость отдельного управленческого контура.", "Главная связка урока — бухгалтерский учёт, налоговый учёт и управленческий учёт. Бухгалтерский учёт отвечает за корректное отражение операций. Налоговый учёт отвечает за налоговые обязательства. Управленческий учёт отвечает за решения собственника.", "Кейс с бухгалтерской прибылью и кассовым риском показывает центральную идею. Бизнес может иметь прибыль по отчёту и одновременно испытывать нехватку денег. Оба взгляда могут быть правильными, если они отвечают на разные вопросы. Поэтому спор нужно заменять финансовой картой.", "Уникальное усиление урока — понятие управленческой учётной политики. Ученик должен понять, что управленка не строится на ощущениях. Она строится на внутренних правилах признания выручки, расходов, авансов, активов, долгов и закрытия месяца. Именно эти правила позволяют создать будущую таблицу, финансового помощника и полноценную систему финансового управления в приложении."], "status": "ready"}, {"id": 4, "title": "Экономика бизнес-модели", "objective": "Научить видеть, за счёт чего конкретный бизнес зарабатывает и где у него возникает финансовое ограничение.", "content": "Драйверы выручки, маржи, загрузки, оборачиваемости, мощности, проектных этапов и повторных продаж. Отличия услуг, торговли, производства, проектов, логистики и HoReCa.", "case": "Сравнение салона услуг, магазина и производства при одинаковой выручке. Ученик определяет, почему финансовая логика у них разная.", "result": "Ученик видит бизнес не абстрактно, а через его экономический двигатель.", "fullContent": ["Урок 4. Экономика бизнес-модели", "Общая структура урока", "Название урока: Экономика бизнес-модели.\nЗадача урока: научить ученика видеть, за счёт чего конкретный бизнес зарабатывает и где у него возникает главное финансовое ограничение.\nКоличество слайдов: 28.\nРекомендуемая длительность урока: 120–160 минут.\nФормат урока: теория, отраслевые схемы, формулы драйверов, сравнительный кейс, диагностика экономического двигателя бизнеса.\nТест после урока: не используется.\nПрактическая таблица в рамках урока: не создаётся учеником.\nРезультат ученика: ученик видит бизнес не абстрактно, а через его экономический двигатель: выручку, маржу, мощность, оборачиваемость, повторные продажи, кассовый цикл и главное финансовое ограничение.", "Слайд 1. Почему одинаковая выручка не означает одинаковый бизнес", "Что показать на слайде", "Показать три бизнеса с одинаковой выручкой 3 000 000 ₽: салон услуг, магазин и производство. Визуально показать, что цифра выручки одинаковая, но внутри у каждого бизнеса разные процессы, расходы, остатки и риски. В центре слайда написать: «Одинаковая выручка ≠ одинаковая экономика».", "Текст под слайдом", "Предприниматели часто сравнивают бизнесы по выручке. Если один бизнес делает 3 000 000 ₽ в месяц и другой бизнес делает 3 000 000 ₽ в месяц, кажется, что они находятся на похожем уровне. Но это поверхностное сравнение. Одинаковая выручка может скрывать совершенно разную экономику.", "Салон услуг зарабатывает через время специалистов, загрузку расписания, средний чек, повторные визиты и качество клиентского потока. Магазин зарабатывает через закупку, наценку, оборачиваемость товара, скидки, списания и управление остатками. Производство зарабатывает через выпуск, мощность, себестоимость, загрузку оборудования, брак и управление запасами. Поэтому одна и та же сумма выручки в этих бизнесах означает разные управленческие задачи.", "Если смотреть только на выручку, можно не увидеть главного ограничения. У салона ограничением может быть количество часов специалистов. У магазина ограничением может быть товарный остаток и скорость оборота. У производства ограничением может быть мощность, сырьё, брак или длинный производственный цикл.", "Цель этого урока — научиться видеть бизнес через его экономический двигатель. Экономический двигатель показывает, за счёт чего бизнес создаёт деньги и прибыль. Он также показывает, где бизнес чаще всего ломается. Когда ученик понимает двигатель модели, он перестаёт управлять бизнесом абстрактно.", "Слайд 2. Что такое экономика бизнес-модели", "Что показать на слайде", "Показать схему: спрос → продажа → выполнение → маржа → деньги → повторение → рост. Под схемой указать: экономика бизнес-модели объясняет, как бизнес превращает ресурсы в прибыль и деньги. Справа показать блок «финансовое ограничение».", "Текст под слайдом", "Экономика бизнес-модели — это логика, по которой конкретный бизнес зарабатывает. Она показывает, откуда появляется выручка, где возникает себестоимость, почему появляется маржа и когда бизнес получает деньги. Это не описание продукта и не рекламный оффер. Это финансовая механика бизнеса.", "Любая бизнес-модель имеет свой способ создания ценности. Услуги создают ценность через время, квалификацию и результат работы специалиста. Торговля создаёт ценность через подбор, закупку, наличие, удобство покупки и быструю передачу товара. Производство создаёт ценность через преобразование сырья в продукт с контролируемой себестоимостью.", "Экономика бизнес-модели отвечает на несколько вопросов одновременно. Сколько клиентов или заказов нужно для нужной выручки. Какая маржа остаётся после прямых затрат. Сколько денег застревает в запасах, дебиторке или незавершённых работах. Какое ограничение мешает бизнесу расти дальше.", "Если предприниматель не понимает экономику своей модели, он может принимать неправильные решения. Он может пытаться увеличить рекламу, хотя проблема находится в марже. Он может поднимать выручку, хотя деньги застревают в запасах. Он может расширять производство, хотя узкое место находится в продажах или оплатах клиентов.", "Слайд 3. Экономический двигатель бизнеса", "Что показать на слайде", "Показать двигатель из шести шестерёнок: спрос, конверсия, средний чек, маржа, мощность, денежный цикл. От двигателя идёт стрелка к прибыли и деньгам. Внизу написать: «Чтобы управлять бизнесом, нужно знать, какая шестерёнка главная».", "Текст под слайдом", "Экономический двигатель бизнеса — это набор ключевых механизмов, которые превращают деятельность в финансовый результат. У каждого бизнеса есть спрос, продажа, выполнение, стоимость выполнения, получение денег и повторение цикла. Но значимость этих элементов в разных видах деятельности различается. Именно поэтому нельзя строить один универсальный взгляд на все бизнесы.", "В услугах главная шестерёнка часто связана с загрузкой и повторными визитами. Даже если заявок много, бизнес не заработает больше, если расписание специалистов уже заполнено. Даже если выручка растёт, прибыль может не расти, если ФОТ специалистов или скидки съедают маржу. Поэтому в услугах нужно смотреть не только продажи, но и часы, визиты, загрузку и маржу часа.", "В торговле главная шестерёнка часто связана с товаром и оборотом. Магазин может иметь высокий трафик, но слабую прибыль из-за низкой маржи. Он может иметь хорошую маржу, но плохие деньги из-за зависших остатков. Он может иметь большой склад, но слабую оборачиваемость и высокий риск списаний.", "В производстве двигатель связан с мощностью, себестоимостью и стабильностью выпуска. Производство может иметь заказы, но не иметь возможности произвести нужный объём. Оно может производить много, но терять деньги из-за брака, простоев или высоких накладных расходов. Поэтому у каждого бизнеса нужно искать не просто цифры, а центральный механизм заработка.", "Слайд 4. Четыре вопроса к любой бизнес-модели", "Что показать на слайде", "Показать четыре крупных вопроса: как появляется выручка, где возникает маржа, когда приходят деньги, что ограничивает рост. Под каждым вопросом указать примеры показателей. Внизу написать: «Если ответов нет — финансовая модель бизнеса не понята».", "Текст под слайдом", "Первый вопрос к любой бизнес-модели звучит так: как появляется выручка. Нужно понять, что является единицей продажи. Это визит, чек, заказ, товарная единица, проектный этап, рейс, посадка гостя или подписка. Пока единица выручки не определена, бизнес нельзя нормально считать.", "Второй вопрос звучит так: где возникает маржа. Нужно понять, какие затраты напрямую связаны с выполнением обещания клиенту. В услугах это может быть труд специалиста и расходники. В торговле это закупочная стоимость товара, доставка, скидки и списания. В производстве это сырьё, труд, производственные накладные и брак.", "Третий вопрос звучит так: когда приходят деньги. Бизнес может заработать выручку сейчас, а деньги получить позже. Бизнес может получить деньги сейчас, но выручку заработать позже. Бизнес может иметь прибыль, но испытывать нехватку кассы из-за запасов, дебиторки, авансов поставщикам или крупных платежей.", "Четвёртый вопрос звучит так: что ограничивает рост. У одного бизнеса ограничением является спрос. У другого бизнеса ограничением является мощность. У третьего бизнеса ограничением является оборотный капитал. У четвёртого бизнеса ограничением является команда, качество, время или управляемость.", "Слайд 5. Универсальная формула бизнес-модели", "Что показать на слайде", "Показать базовую формулу: Прибыль = Выручка − Переменные затраты − Постоянные расходы. Ниже показать расширение: Выручка = Объём × Цена × Повторяемость. Отдельно показать: Деньги ≠ Прибыль из-за сроков оплат и остатков.", "Текст под слайдом", "На самом общем уровне бизнес можно описать через простую формулу. Бизнес получает выручку, несёт переменные затраты, оплачивает постоянные расходы и получает прибыль или убыток. Но эта простота обманчива. В разных бизнесах каждая часть формулы устроена по-разному.", "Выручка обычно зависит от объёма, цены и повторяемости. Объём может быть количеством визитов, заказов, чеков, единиц продукции, рейсов, гостей или проектов. Цена может быть средним чеком, тарифом, ставкой, ценой единицы или стоимостью контракта. Повторяемость показывает, возвращается ли клиент и как часто он покупает снова.", "Маржа зависит от того, сколько стоит выполнение обещания клиенту. Если услуга требует дорогого специалиста, маржа ограничена ФОТ. Если товар закупается дорого и часто продаётся со скидкой, маржа ограничена закупкой и промо. Если производство имеет высокий брак, маржа ограничена потерями и неэффективностью.", "Деньги зависят не только от прибыли, но и от сроков. Клиенты могут платить позже. Поставщики могут требовать предоплату. Запасы могут замораживать деньги. Поэтому экономика бизнес-модели должна объяснять не только прибыль, но и денежный цикл.", "Слайд 6. Финансовое ограничение: где бизнес упирается в потолок", "Что показать на слайде", "Показать шесть видов ограничений: спрос, маржа, мощность, оборотный капитал, люди, качество/управляемость. В центре написать: «Рост упирается не в желание собственника, а в ограничение модели». Для каждого ограничения дать маленькую иконку.", "Текст под слайдом", "Финансовое ограничение — это место, которое не даёт бизнесу расти или зарабатывать больше. Ограничение может быть не там, где предприниматель его ожидает. Собственник может думать, что нужно больше рекламы, хотя проблема находится в загрузке команды. Он может думать, что нужно больше продаж, хотя бизнес теряет деньги на каждой продаже.", "Первый тип ограничения — спрос. Бизнесу не хватает клиентов, заявок, трафика или заказов. В этом случае главная задача связана с маркетингом, продажами, оффером и каналами привлечения. Но усиливать спрос можно только тогда, когда модель способна прибыльно обработать этот спрос.", "Второй тип ограничения — мощность. Бизнес может иметь спрос, но не иметь возможности выполнить больше заказов. В услугах это часы специалистов и кабинеты. В производстве это оборудование, смены, сырьё и технологический процесс. В логистике это машины, водители, маршруты и загрузка транспорта.", "Третий тип ограничения — деньги внутри цикла. Бизнес может быть прибыльным, но не иметь денег на рост. Деньги могут застревать в дебиторке, запасах, авансах поставщикам или незавершённых проектах. Тогда проблема решается не только продажами, а управлением оборотным капиталом.", "Слайд 7. Драйверы выручки: из чего собирается верхняя строка", "Что показать на слайде", "Показать формулы выручки по моделям: услуги, торговля, производство, проекты, логистика, HoReCa. Например: услуги = визиты × средний чек, торговля = трафик × конверсия × чек, производство = объём выпуска × цена. Внизу написать: «выручка растёт через драйверы, а не сама по себе».", "Текст под слайдом", "Выручка не появляется как одна цельная цифра. Она собирается из драйверов. Если предприниматель планирует просто «вырасти до 5 000 000 ₽», он планирует итог, но не планирует причину. Драйверный подход заставляет разложить выручку на управляемые элементы.", "В услугах базовая формула может выглядеть так: выручка = количество визитов × средний чек. Более точная формула добавляет доступные часы, загрузку, количество специалистов, повторные визиты и отмены. Если визитов мало, проблема может быть в спросе или конверсии. Если визитов много, но выручка слабая, проблема может быть в среднем чеке или линейке услуг.", "В торговле выручка может раскладываться как трафик × конверсия × средний чек. Для интернет-торговли добавляются сессии, карточки товара, корзины, выкупы и возвраты. Для розницы важны поток покупателей, выкладка, ассортимент, наличие товара и скидки. Один и тот же рост выручки может происходить через большее количество покупателей или через более дорогие покупки.", "В производстве и проектном бизнесе выручка имеет другую природу. Производство зависит от объёма выпуска, цены реализации и способности продать готовую продукцию. Проектный бизнес зависит от портфеля контрактов, этапов выполнения, процента готовности и условий оплаты. Поэтому формула выручки должна соответствовать конкретной модели бизнеса.", "Слайд 8. Драйверы маржи: где бизнес оставляет деньги себе", "Что показать на слайде", "Показать формулу: Валовая прибыль = Выручка − Прямые затраты. Ниже показать, что прямые затраты отличаются по моделям. Для услуг — ФОТ специалистов и расходники, для торговли — закупка и списания, для производства — сырьё и выпуск, для HoReCa — food cost и labor cost.", "Текст под слайдом", "Маржа показывает, сколько остаётся у бизнеса после выполнения основного обещания клиенту. Если клиент заплатил 10 000 ₽, это ещё не значит, что бизнес заработал 10 000 ₽. Нужно понять, сколько стоило оказать услугу, продать товар, произвести продукт или выполнить проект. Только после этого появляется валовая прибыль.", "В услугах маржа часто зависит от ФОТ специалистов, расходников, длительности услуги и цены. Услуга может иметь высокий чек, но низкую маржу, если она требует дорогого специалиста и много времени. Услуга может иметь средний чек, но высокую маржу, если она быстро выполняется и хорошо загружает расписание. Поэтому в услугах важна не только цена, но и выручка на час.", "В торговле маржа зависит от закупочной цены, скидок, логистики, списаний и возвратов. Товар может выглядеть прибыльным по наценке, но терять маржу через промо и остатки. Категория может давать выручку, но не давать валовую прибыль. Поэтому торговлю нельзя анализировать только по обороту.", "В производстве маржа зависит от сырья, норм расхода, производительности, брака и накладных расходов. Если растёт цена сырья, валовая маржа сжимается. Если растёт брак, бизнес теряет деньги до момента продажи. Если оборудование простаивает, себестоимость единицы может становиться выше.", "Слайд 9. Драйверы загрузки и мощности", "Что показать на слайде", "Показать формулу: Загрузка = использованная мощность / доступная мощность. Для услуг показать часы специалистов, для производства оборудование, для логистики транспорт, для HoReCa посадочные места и столы. Внизу написать: «мощность определяет потолок выручки».", "Текст под слайдом", "Мощность показывает, сколько бизнес может физически выполнить. Даже если спрос высокий, бизнес не может бесконечно продавать без ресурса исполнения. У каждой модели есть свой потолок мощности. Этот потолок нужно видеть до того, как бизнес начнёт активно расти.", "В услугах мощность выражается в часах специалистов, кабинетах, рабочих днях и длительности услуги. Если все слоты заняты, дополнительная реклама может только увеличить отказы или ухудшить качество. Если загрузка низкая, проблема может быть в спросе, расписании, конверсии или повторных визитах. Поэтому для услуг загрузка является одной из центральных метрик.", "В производстве мощность выражается в оборудовании, сменах, скорости выпуска, людях и технологических ограничениях. Производство может упереться в один станок, одну операцию, одного специалиста или один этап контроля качества. Если узкое место не найдено, бизнес может нанимать людей или покупать сырьё, но выпуск не вырастет. Поэтому нужно искать ограничение процесса, а не просто увеличивать затраты.", "В HoReCa мощность выражается в посадочных местах, оборачиваемости столов, кухне, скорости обслуживания и пиковых часах. Ресторан может быть пустым днём и перегруженным вечером. Средняя загрузка может скрывать проблему пиков. Поэтому мощность нужно анализировать по времени, а не только за месяц.", "Слайд 10. Драйверы оборачиваемости и денежного цикла", "Что показать на слайде", "Показать цепочку денег: деньги → закупка/ресурс → выполнение/товар → продажа → деньги. Для торговли показать склад, для производства сырьё и незавершёнку, для проектов этапы и оплаты. В центре написать: «прибыль может быть, но деньги застревают в цикле».", "Текст под слайдом", "Оборачиваемость показывает, как быстро деньги возвращаются в бизнес. Это особенно важно для торговли, производства и проектного бизнеса. Бизнес может быть прибыльным на уровне ОПиУ, но испытывать кассовые проблемы из-за длинного цикла. Чем дольше деньги застревают внутри операций, тем больше оборотного капитала нужно бизнесу.", "В торговле деньги часто застревают в товарных остатках. Бизнес закупает товар до продажи. Пока товар лежит на складе или полке, деньги не вернулись. Если оборачиваемость низкая, бизнес может иметь большой ассортимент и слабую кассу.", "В производстве деньги проходят через сырьё, незавершённое производство и готовую продукцию. Сначала бизнес покупает материалы. Затем он тратит ресурсы на производство. Затем готовый продукт нужно продать и получить оплату.", "В проектном бизнесе деньги застревают в этапах и сроках оплат. Бизнес может нести расходы раньше, чем клиент оплачивает следующий этап. Если условия договора слабые, проект может быть прибыльным на бумаге и тяжёлым по деньгам. Поэтому экономика бизнес-модели всегда должна включать денежный цикл.", "Слайд 11. Повторные продажи как скрытый двигатель модели", "Что показать на слайде", "Показать две модели: разовая продажа и повторная продажа. В первой модели каждый раз нужен новый клиент. Во второй модели клиент возвращается и создаёт повторную выручку. Внизу написать: «повторяемость снижает давление на привлечение».", "Текст под слайдом", "Повторные продажи являются одним из ключевых драйверов устойчивости. Если бизнес каждый месяц заново покупает весь клиентский поток, его экономика сильно зависит от маркетинга. Если клиент возвращается, бизнес получает часть выручки без полного повторного затратного привлечения. Поэтому retention и повторяемость часто важнее разового роста заявок.", "В услугах повторные визиты могут быть главным источником стабильной выручки. Если клиент приходит один раз и не возвращается, бизнес постоянно зависит от новых заявок. Если клиент возвращается регулярно, расписание становится предсказуемее. Тогда маркетинг работает не только на первую продажу, но и на создание долгой клиентской ценности.", "В торговле повторные покупки зависят от категории товара, ассортимента, сервиса, наличия и привычки клиента. Продукты ежедневного спроса могут иметь высокую повторяемость. Редкие товары требуют другой логики работы с клиентом. Поэтому экономика магазина зависит не только от среднего чека, но и от частоты покупки.", "В HoReCa повторяемость может быть связана с локацией, качеством, привычкой, сервисом и эмоциональным опытом. В проектном бизнесе повторяемость может проявляться через долгосрочных клиентов и новые контракты. В логистике она может проявляться через постоянные маршруты и регулярных заказчиков. Поэтому повторяемость нужно анализировать в каждой модели отдельно.", "Слайд 12. Бизнес услуг: экономический двигатель", "Что показать на слайде", "Показать формулу услуг: Выручка = доступные часы × загрузка × выручка на час. Дополнительно показать: визиты × средний чек × повторяемость. На схеме показать специалиста, кабинет, расписание, клиента и повторный визит.", "Текст под слайдом", "В бизнесе услуг основной экономический двигатель связан с временем, компетенцией и загрузкой. Услуга обычно не хранится на складе. Если свободный час специалиста не был продан сегодня, его нельзя продать завтра как тот же час. Поэтому незагруженное время является потерянной мощностью.", "Выручку услуг можно разложить через визиты и средний чек. Но более глубокая формула должна учитывать доступные часы, загрузку, длительность услуги и выручку на час. Например, два салона могут иметь одинаковый средний чек. Но салон с более высокой загрузкой и более короткой длительностью услуги может зарабатывать больше на том же количестве специалистов.", "Маржа услуг зависит от ФОТ специалистов, расходников, аренды кабинетов, администраторов, сервиса и маркетинга. Если специалист получает высокий процент, валовая маржа может быть ограничена. Если услуга требует много расходников, себестоимость возрастает. Если услуга занимает много времени, выручка на час может быть слабой даже при хорошем чеке.", "Главное финансовое ограничение услуг часто находится в загрузке и повторяемости. Если загрузка низкая, нужно искать проблему в спросе, оффере, расписании, конверсии или удержании. Если загрузка высокая, но прибыль слабая, нужно смотреть чек, ФОТ, длительность услуги и продуктовую линейку. Поэтому услуги нельзя оценивать только по выручке.", "Слайд 13. Ограничения бизнеса услуг", "Что показать на слайде", "Показать карту ограничений услуг: свободные окна, специалисты, кабинеты, отмены, no-show, средний чек, ФОТ, повторные визиты. В центре написать: «услуги продают время и результат». Отдельно выделить риск: высокая загрузка без прибыли.", "Текст под слайдом", "Первое ограничение услуг — доступная мощность. Она состоит из количества специалистов, рабочих часов, кабинетов и расписания. Если бизнес продаёт больше, чем может выполнить, качество падает. Если бизнес продаёт меньше, чем может выполнить, мощность простаивает.", "Второе ограничение — качество клиентского потока. Заявки сами по себе не гарантируют выручку. Нужно смотреть конверсию в запись, конверсию записи в визит, отмены и повторные визиты. Бизнес может иметь много обращений, но слабую фактическую загрузку.", "Третье ограничение — экономика специалиста. Специалист может создавать выручку, но одновременно забирать большую часть маржи. Если система оплаты не связана с экономикой услуги, рост выручки может не давать роста прибыли. Поэтому нужно смотреть выручку на специалиста, ФОТ на специалиста и маржу после ФОТ.", "Четвёртое ограничение — продуктовая линейка. Одни услуги могут привлекать клиентов, но давать низкую маржу. Другие услуги могут быть прибыльными, но редко покупаться. Третьи услуги могут создавать повторяемость и долгую клиентскую ценность. Собственник должен понимать роль каждой услуги в модели.", "Слайд 14. Торговля: экономический двигатель", "Что показать на слайде", "Показать формулу торговли: Выручка = трафик × конверсия × средний чек. Дополнительно показать: валовая прибыль = выручка − себестоимость проданных товаров. На схеме показать закупку, склад, витрину, продажу и повторную закупку.", "Текст под слайдом", "В торговле экономический двигатель связан с товаром, наценкой и оборачиваемостью. Магазин покупает товар заранее или с отсрочкой, держит его в наличии и продаёт клиенту. Деньги зарабатываются не просто на продаже, а на разнице между ценой продажи и полной стоимостью товара. В эту стоимость входят закупка, доставка, потери, скидки и списания.", "Выручка торговли обычно раскладывается через трафик, конверсию и средний чек. Трафик показывает поток потенциальных покупателей. Конверсия показывает, какая часть потока покупает. Средний чек показывает размер покупки.", "Но выручка в торговле не является главным показателем качества. Важнее понимать валовую прибыль и оборачиваемость. Товар с большой выручкой может иметь слабую маржу. Товар с хорошей маржей может плохо оборачиваться и замораживать деньги.", "Финансовое ограничение торговли часто находится в товарном остатке. Если товара мало, бизнес теряет продажи. Если товара слишком много, деньги замораживаются. Если ассортимент подобран неправильно, бизнес получает склад вместо прибыли. Поэтому торговля требует сильного контроля запасов и категорийной маржи.", "Слайд 15. Ограничения торговли", "Что показать на слайде", "Показать карту ограничений торговли: закупка, наличие, склад, оборачиваемость, скидки, списания, возвраты, маржа по SKU, деньги в товаре. В центре написать: «торговля зарабатывает не оборотом, а маржой на обороте».", "Текст под слайдом", "Первое ограничение торговли — валовая маржа. Если маржа слишком низкая, бизнесу нужно очень много оборота, чтобы покрыть постоянные расходы. Высокая выручка при слабой марже может создавать иллюзию масштаба. Но собственника интересует не оборот сам по себе, а деньги, которые остаются после товара.", "Второе ограничение — оборачиваемость запасов. Товар должен превращаться обратно в деньги с приемлемой скоростью. Если товар продаётся медленно, он замораживает капитал. Если товар устаревает или портится, бизнес теряет деньги через списания и скидки.", "Третье ограничение — ассортимент. Одни товары создают поток клиентов. Другие товары создают маржу. Третьи товары занимают место и деньги, но почти не продаются. Поэтому торговле нужна аналитика по категориям и SKU.", "Четвёртое ограничение — скидки и возвраты. Скидки могут быстро поднять продажи, но уничтожить валовую прибыль. Возвраты могут искажать выручку и маржу. Промо может быть полезным, если оно увеличивает вклад в прибыль, а не просто создаёт оборот.", "Слайд 16. Производство: экономический двигатель", "Что показать на слайде", "Показать формулу производства: Выручка = объём реализованной продукции × цена. Ниже показать: себестоимость = сырьё + труд + производственные накладные + потери. На схеме показать сырьё, производство, незавершёнку, готовую продукцию и продажу.", "Текст под слайдом", "В производстве экономический двигатель связан с преобразованием ресурсов в готовый продукт. Бизнес покупает сырьё, использует труд, оборудование и технологию. Затем он получает готовую продукцию, которую нужно продать. Прибыль возникает только тогда, когда цена реализации превышает полную себестоимость и операционные расходы.", "Производство отличается тем, что между закупкой и продажей есть производственный цикл. Деньги могут сначала уйти в сырьё. Потом они могут находиться в незавершённом производстве. Затем они превращаются в готовую продукцию на складе.", "Выручка производства зависит от объёма реализованной продукции и цены. Но способность заработать зависит от выпуска, брака, норм расхода, загрузки оборудования и производственных накладных. Если оборудование простаивает, себестоимость единицы может расти. Если брак высокий, часть ресурсов превращается в потери.", "Главное ограничение производства часто находится в мощности или себестоимости. Можно иметь спрос, но не иметь возможности произвести нужный объём. Можно иметь оборудование, но терять деньги из-за слабого контроля затрат. Можно производить много, но замораживать деньги в запасах и готовой продукции.", "Слайд 17. Ограничения производства", "Что показать на слайде", "Показать карту ограничений производства: сырьё, мощность, узкое место, смены, брак, WIP, готовая продукция, накладные расходы. В центре написать: «производство управляется через мощность, себестоимость и цикл».", "Текст под слайдом", "Первое ограничение производства — мощность. Она может зависеть от оборудования, людей, сменности, технологии и скорости отдельных операций. Часто всё производство ограничивается одним узким местом. Если его не найти, можно инвестировать в неправильные участки и не получить роста выпуска.", "Второе ограничение — себестоимость. Она складывается из сырья, прямого труда, производственных накладных, брака и потерь. Если себестоимость плохо считается, бизнес не понимает реальную прибыльность продукта. Тогда можно продавать активно и одновременно терять деньги.", "Третье ограничение — качество и брак. Брак уже потребил сырьё, труд, время и мощность. Но он не создаёт полноценной выручки. Поэтому брак является финансовой потерей, а не просто производственной проблемой.", "Четвёртое ограничение — запасы и незавершённое производство. Деньги могут быть вложены в сырьё, полуфабрикаты и готовую продукцию. Пока продукция не продана и не оплачена, деньги не вернулись. Поэтому производство требует контроля оборотного капитала не меньше, чем контроля прибыли.", "Слайд 18. Проектный бизнес и строительство: экономический двигатель", "Что показать на слайде", "Показать формулу проектного бизнеса: Выручка = стоимость контрактов × процент выполнения / этапы признания. Ниже показать: смета, этапы, авансы, субподряд, материалы, WIP, overbilling и underbilling. В центре написать: «проект зарабатывает по этапам, а деньги идут по графику».", "Текст под слайдом", "В проектном бизнесе экономический двигатель связан с контрактами, этапами и управлением бюджетом проекта. Бизнес не продаёт одну одинаковую единицу каждый день. Он выполняет работы по договору, смете, этапам и срокам. Поэтому выручка и деньги могут сильно расходиться.", "Проект может быть прибыльным по смете, но тяжёлым по кассе. Расходы на материалы, подрядчиков и команду могут возникать раньше, чем клиент оплачивает этап. Если авансов мало, бизнес финансирует проект своими деньгами. Если этапы оплаты поставлены неправильно, даже хороший проект может создать кассовый разрыв.", "Маржа проекта зависит от точности сметы и контроля отклонений. Если материалы подорожали, маржа уменьшается. Если сроки растянулись, растут накладные расходы. Если субподрядчик вышел дороже, проектная прибыль снижается.", "Главное ограничение проектного бизнеса — управление портфелем проектов и cash gap. Один проект может выглядеть прибыльным, но потреблять деньги. Несколько проектов могут одновременно создавать нагрузку на команду и кассу. Поэтому проектный бизнес нужно анализировать не только по выручке, но и по этапам, бюджету, выполнению и платежному графику.", "Слайд 19. Ограничения проектного бизнеса", "Что показать на слайде", "Показать карту ограничений: воронка проектов, процент побед, смета, сроки, авансы, этапы, субподряд, перерасход, дебиторка, кассовый разрыв. В центре написать: «проект может быть прибыльным и кассово опасным».", "Текст под слайдом", "Первое ограничение проектного бизнеса — качество входящих проектов. Не каждый большой контракт выгоден. Проект может иметь высокий чек и низкую маржу. Проект может требовать много ресурсов, но давать слабый денежный поток.", "Второе ограничение — смета и контроль исполнения. Если смета сделана неточно, прибыльность проекта может исчезнуть уже в процессе работы. Если фактические расходы не сравниваются с бюджетом, проблема обнаруживается слишком поздно. Поэтому проектный бизнес требует постоянного план-факта по каждому проекту.", "Третье ограничение — график оплат. Если клиент платит после выполнения, бизнес должен заранее финансировать работы. Если аванс маленький, кассовая нагрузка ложится на бизнес. Если этап закрывается долго, деньги застревают в дебиторке.", "Четвёртое ограничение — команда и сроки. Проект может задерживаться из-за людей, подрядчиков, согласований или материалов. Задержка почти всегда имеет финансовое последствие. Она увеличивает накладные расходы, растягивает получение денег и снижает пропускную способность команды.", "Слайд 20. Логистика: экономический двигатель", "Что показать на слайде", "Показать формулу логистики: Выручка = рейсы × ставка за рейс или км × ставка за км. Ниже показать: топливо, водитель, ремонт, амортизация, простои, загрузка транспорта. В центре написать: «логистика зарабатывает на эффективном движении ресурса».", "Текст под слайдом", "В логистике экономический двигатель связан с транспортом, маршрутами, загрузкой и стоимостью выполнения рейса. Выручка может зависеть от количества рейсов, километров, ставки за рейс или ставки за километр. Но прибыль зависит от того, сколько стоит выполнить этот рейс. Поэтому логистику нельзя оценивать только по обороту.", "Основные затраты логистики связаны с топливом, водителями, ремонтом, амортизацией, страховкой, простоем и обслуживанием транспорта. Если ставка за рейс растёт, но топливо и ремонт растут быстрее, маржа может падать. Если машина часто простаивает, постоянные расходы распределяются на меньшее количество рейсов. Если маршрут плохо спланирован, бизнес теряет деньги на пустом пробеге.", "Выручка на машину и маржа рейса являются важными показателями. Машина должна не просто ездить, а зарабатывать с достаточной маржой. Водитель должен быть не просто занят, а выполнять экономически оправданные маршруты. Клиент должен платить не только за движение, но и за полную стоимость сервиса.", "Главное ограничение логистики часто находится в загрузке транспорта, маршрутизации и себестоимости километра. Можно иметь заказы, но терять деньги на неэффективных рейсах. Можно иметь транспорт, но не иметь достаточной загрузки. Можно расти по выручке и одновременно уничтожать прибыль через топливо, ремонт и простой.", "Слайд 21. Ограничения логистики", "Что показать на слайде", "Показать карту ограничений: парк, водители, рейсы, загрузка, пустой пробег, топливо, ремонт, простой, ставка, дебиторка. В центре написать: «главный вопрос логистики — сколько денег приносит единица ресурса».", "Текст под слайдом", "Первое ограничение логистики — загрузка транспорта. Если машина стоит, она всё равно может создавать расходы. Если машина едет полупустой, экономика рейса ухудшается. Если маршрут построен неэффективно, бизнес тратит ресурс без достаточной выручки.", "Второе ограничение — переменная себестоимость. Топливо, платные дороги, обслуживание, износ и ремонт напрямую влияют на маржу рейса. Если эти затраты не считаются на рейс или километр, бизнес может не видеть убыточные маршруты. Тогда выручка создаёт движение, но не создаёт прибыль.", "Третье ограничение — техническая готовность парка. Поломки создают простой, срочные расходы и срыв обязательств перед клиентами. Старый транспорт может выглядеть дешевле по покупке, но дороже по ремонту и простоям. Поэтому в логистике нужно считать не только доход, но и стоимость владения ресурсом.", "Четвёртое ограничение — сроки оплат клиентов. Многие логистические бизнесы работают с отсрочкой. Расходы на топливо и водителей возникают сейчас, а деньги от клиента приходят позже. Поэтому логистика требует контроля дебиторки и платежного календаря.", "Слайд 22. HoReCa: экономический двигатель", "Что показать на слайде", "Показать формулу HoReCa: Выручка = гости × средний чек × повторяемость / оборачиваемость столов. Ниже показать: food cost, labor cost, prime cost, посадка, списания, меню, сезонность. В центре написать: «HoReCa зарабатывает на потоке, чеке, марже и скорости обслуживания».", "Текст под слайдом", "В HoReCa экономический двигатель связан с гостями, средним чеком, посадочными местами, кухней, командой и продуктовой себестоимостью. Ресторан или кафе не просто продаёт блюда. Он управляет временем, посадкой, меню, закупками, списаниями, сменами и клиентским опытом. Поэтому выручка здесь является результатом множества операционных факторов.", "Выручка может зависеть от количества гостей и среднего чека. Но ограничение может находиться в посадке, кухне или скорости обслуживания. Если зал заполнен в пиковое время, рост спроса не всегда превращается в рост выручки. Если кухня не справляется, бизнес теряет качество, скорость и повторные посещения.", "Маржа HoReCa сильно зависит от food cost и labor cost. Food cost показывает долю себестоимости продуктов в выручке. Labor cost показывает нагрузку персонала. Prime cost объединяет ключевую стоимость продукта и труда, поэтому является важным показателем модели.", "Главные ограничения HoReCa связаны с посадкой, меню, списаниями, сменами и сезонностью. Бизнес может иметь высокий чек, но слабую маржу из-за дорогих продуктов. Он может иметь поток гостей, но терять деньги через списания. Он может иметь хорошее меню, но слабую операционную дисциплину.", "Слайд 23. Ограничения HoReCa", "Что показать на слайде", "Показать карту ограничений: посадочные места, оборачиваемость столов, кухня, food cost, labor cost, списания, меню-инжиниринг, сезонность, пиковые часы. В центре написать: «выручка HoReCa ограничена временем, местом и операционной дисциплиной».", "Текст под слайдом", "Первое ограничение HoReCa — посадочная мощность. Количество посадочных мест и оборачиваемость столов определяют физический потолок выручки. В пиковые часы заведение может быть перегружено. В непиковые часы оно может быть недозагружено.", "Второе ограничение — кухня и скорость обслуживания. Если кухня не успевает, гости ждут дольше. Если гости ждут дольше, падает качество опыта и повторяемость. Если кухня работает хаотично, растут ошибки, списания и нагрузка на персонал.", "Третье ограничение — себестоимость меню. Некоторые позиции могут иметь высокую популярность и низкую маржу. Другие позиции могут иметь хорошую маржу, но слабый спрос. Поэтому меню нужно анализировать не только по продажам, но и по вкладу в прибыль.", "Четвёртое ограничение — сезонность и смены. Бизнес может иметь высокую выручку в отдельные дни или сезоны и слабую загрузку в другие периоды. Если ФОТ и аренда остаются постоянными, слабые периоды давят на прибыль. Поэтому HoReCa требует особенно внимательного планирования загрузки, закупок и персонала.", "Слайд 24. Одинаковая выручка: постановка сравнительного кейса", "Что показать на слайде", "Показать три бизнеса с одинаковой месячной выручкой 3 000 000 ₽: салон услуг, магазин и производство. Для каждого бизнеса указать краткую формулу выручки. Внизу написать: «одна выручка — три разные логики управления».", "Текст под слайдом", "Теперь сравним три бизнеса с одинаковой месячной выручкой. Первый бизнес — салон услуг. Второй бизнес — розничный магазин. Третий бизнес — небольшое производство. Каждый из них показывает 3 000 000 ₽ выручки за месяц.", "На первый взгляд эти бизнесы можно считать похожими по размеру. Но внутри они устроены принципиально по-разному. Салон зарабатывает через визиты, средний чек и загрузку специалистов. Магазин зарабатывает через поток покупателей, товарную маржу и оборачиваемость. Производство зарабатывает через выпуск, себестоимость и использование мощности.", "Цель кейса — не определить, какой бизнес лучше. Цель состоит в том, чтобы показать различие экономических двигателей. Один бизнес может иметь высокую маржу, но ограничение по мощности. Другой бизнес может иметь ниже маржу, но быстрее оборот. Третий бизнес может иметь нормальную прибыль, но длинный цикл денег.", "Ученик должен увидеть, что управленческое решение зависит от модели. Нельзя всем трём бизнесам одинаково советовать «увеличьте продажи». В одном случае нужно повышать загрузку. В другом случае нужно чистить ассортимент. В третьем случае нужно снижать себестоимость или устранять узкое место производства.", "Слайд 25. Кейс: салон услуг при выручке 3 000 000 ₽", "Что показать на слайде", "Показать пример салона: 600 визитов × 5 000 ₽ = 3 000 000 ₽. Ниже показать ФОТ специалистов, расходники, аренду, маркетинг, загрузку и повторные визиты. Выделить главный вопрос: «сколько бизнес зарабатывает на часе и визите».", "Текст под слайдом", "Салон услуг получил 3 000 000 ₽ выручки через 600 визитов со средним чеком 5 000 ₽. На уровне выручки модель выглядит простой. Но реальная экономика зависит от того, сколько часов специалистов потребовалось для этих визитов. Если каждый визит занимает много времени, мощность быстро становится ограничением.", "Допустим, прямой ФОТ специалистов и расходники составляют 1 200 000 ₽. Тогда валовая прибыль до остальных расходов составляет 1 800 000 ₽. Но из этой суммы нужно покрыть аренду, администраторов, маркетинг, сервис, управление и прочие расходы. Поэтому высокая выручка не гарантирует сильную чистую прибыль.", "Главная метрика салона — не только количество визитов. Нужно смотреть загрузку, выручку на час, выручку на специалиста, долю ФОТ, повторные визиты и отмены. Если загрузка низкая, бизнес недоиспользует мощность. Если загрузка высокая, но прибыль слабая, проблема находится в цене, ФОТ, длительности услуги или расходах.", "Финансовое ограничение салона может быть в расписании. Оно может быть в слабой повторяемости клиентов. Оно может быть в слишком дешёвой линейке услуг. Оно может быть в оплате специалистов, которая забирает слишком большую долю выручки. Поэтому салон управляется через мощность времени, маржу услуги и повторные продажи.", "Слайд 26. Кейс: магазин при выручке 3 000 000 ₽", "Что показать на слайде", "Показать пример магазина: 1 000 чеков × 3 000 ₽ = 3 000 000 ₽. Ниже показать закупочную стоимость, валовую маржу, товарный остаток, скидки, списания и оборачиваемость. Выделить главный вопрос: «сколько денег остаётся после товара и как быстро товар превращается в деньги».", "Текст под слайдом", "Магазин получил 3 000 000 ₽ выручки через 1 000 чеков со средним чеком 3 000 ₽. На уровне верхней строки он равен салону. Но экономический двигатель магазина другой. Магазин должен закупать товар, держать его в наличии и управлять остатками.", "Допустим, себестоимость проданных товаров составляет 2 100 000 ₽. Тогда валовая прибыль составляет 900 000 ₽. Это заметно ниже валовой прибыли салона в нашем примере. При этом магазин может иметь дополнительные расходы на аренду, продавцов, логистику, списания, упаковку и эквайринг.", "Главный риск магазина находится в марже и товарном остатке. Магазин может показать 3 000 000 ₽ выручки, но иметь слабую прибыль из-за низкой наценки. Он может иметь хорошие продажи, но плохие деньги из-за больших закупок. Он может иметь склад на несколько месяцев и кассовое напряжение.", "Финансовое ограничение магазина может быть в ассортименте. Оно может быть в оборачиваемости товара. Оно может быть в скидках, которые убивают маржу. Оно может быть в неликвидных остатках. Поэтому магазин управляется через категорийную маржу, SKU, оборачиваемость и деньги в товаре.", "Слайд 27. Кейс: производство при выручке 3 000 000 ₽", "Что показать на слайде", "Показать пример производства: 1 500 единиц × 2 000 ₽ = 3 000 000 ₽. Ниже показать сырьё, прямой труд, накладные расходы, брак, мощность, WIP и готовую продукцию. Выделить главный вопрос: «сколько стоит выпуск и где узкое место».", "Текст под слайдом", "Производство получило 3 000 000 ₽ выручки через продажу 1 500 единиц продукции по 2 000 ₽. На уровне выручки оно равно салону и магазину. Но его финансовая логика устроена иначе. Производство сначала превращает сырьё, труд и мощность в готовый продукт, а потом продаёт его.", "Допустим, производственная себестоимость реализованной продукции составляет 1 800 000 ₽. Тогда валовая прибыль составляет 1 200 000 ₽. Но внутри этой себестоимости нужно понимать сырьё, прямой труд, накладные расходы и потери. Если эти элементы не разделены, производство не знает, где именно теряет деньги.", "Главный риск производства находится в мощности и себестоимости. Производство может иметь спрос, но не иметь возможности выпустить больше. Оно может выпускать продукцию, но иметь высокий брак. Оно может иметь нормальную маржу по единице, но слабые деньги из-за запасов сырья, незавершёнки и готовой продукции.", "Финансовое ограничение производства может быть в узком месте процесса. Оно может быть в дорогом сырье. Оно может быть в браке, простоях или низкой загрузке оборудования. Оно может быть в длинном цикле от закупки до оплаты клиентом. Поэтому производство управляется через мощность, себестоимость, выпуск, качество и оборотный капитал.", "Слайд 28. Итог сравнения: почему решения будут разными", "Что показать на слайде", "Показать сравнительную матрицу трёх бизнесов. Строки: выручка, главный драйвер, маржа, ограничение, денежный риск, ключевое решение. Колонки: салон, магазин, производство. Внизу написать: «управлять нужно не выручкой, а экономическим двигателем».", "Текст под слайдом", "Три бизнеса показали одинаковую выручку 3 000 000 ₽. Но это не делает их одинаковыми. У салона главный драйвер связан с визитами, загрузкой и выручкой на час. У магазина главный драйвер связан с трафиком, средним чеком, маржой и оборачиваемостью. У производства главный драйвер связан с выпуском, себестоимостью и мощностью.", "Решения для этих бизнесов должны быть разными. Салону может быть важнее поднять загрузку, изменить линейку услуг, снизить отмены или увеличить повторные визиты. Магазину может быть важнее пересобрать ассортимент, убрать неликвиды, контролировать скидки и увеличить оборачиваемость. Производству может быть важнее найти узкое место, снизить брак, пересчитать себестоимость и улучшить план выпуска.", "Денежные риски тоже разные. У салона риск может быть в авансах клиентов и будущей загрузке. У магазина риск может быть в товарном остатке и закупках. У производства риск может быть в сырье, незавершёнке, готовой продукции и отсрочке оплат. Поэтому один общий финансовый совет для всех трёх моделей будет слишком грубым.", "Главный вывод кейса состоит в том, что выручка показывает масштаб, но не объясняет модель. Чтобы управлять бизнесом, нужно понять, что именно создаёт выручку, маржу и деньги. Нужно найти главное ограничение. После этого финансовые решения становятся точнее.", "Слайд 29. Диагностика экономического двигателя бизнеса", "Что показать на слайде", "Показать диагностическую карту из восьми вопросов. Вопросы: что является единицей продажи, от чего зависит выручка, где прямые затраты, где мощность, где деньги застревают, что создаёт повторяемость, что ограничивает рост, какая главная метрика. В центре написать: «сначала диагностика модели, потом отчёты».", "Текст под слайдом", "Чтобы понять бизнес-модель, нужно задать серию диагностических вопросов. Первый вопрос: что является единицей продажи. Это визит, товар, заказ, проект, рейс, гость, подписка или производственная единица. Если единица продажи не определена, невозможно правильно считать экономику.", "Второй вопрос: от чего зависит выручка. Нужно разложить её на драйверы. Это может быть трафик, конверсия, средний чек, загрузка, объём выпуска, ставка за рейс или этапы проекта. Чем точнее разложение, тем понятнее управление.", "Третий вопрос: где возникает маржа. Нужно понять, какие затраты напрямую связаны с выполнением обещания клиенту. Нужно определить переменные затраты, прямой ФОТ, закупку, сырьё, потери, списания и брак. Без этого бизнес не понимает, сколько реально остаётся после продажи.", "Четвёртый вопрос: где находится ограничение. Оно может быть в спросе, мощности, марже, оборотном капитале, людях, качестве или управляемости. Именно ограничение определяет следующее управленческое действие. Если лечить не то ограничение, бизнес будет тратить деньги без результата.", "Слайд 30. Главная метрика модели и смертельная метрика модели", "Что показать на слайде", "Показать две карточки: главная метрика и смертельная метрика. Для услуг: загрузка и no-show/падение повторов. Для торговли: валовая маржа и мёртвый склад. Для производства: себестоимость и брак/простои. Для проектов: проектная маржа и cash gap.", "Текст под слайдом", "У каждой модели есть главная метрика, которая показывает здоровье двигателя. В услугах это может быть загрузка, выручка на час, повторные визиты или маржа услуги. В торговле это может быть валовая маржа, оборачиваемость или GMROI. В производстве это может быть себестоимость единицы, выпуск, загрузка мощности или уровень брака.", "Но у каждой модели есть и смертельная метрика. Это показатель, который может разрушить бизнес, даже если остальные цифры выглядят хорошо. В услугах это может быть падение повторных визитов или рост отмен. В торговле это может быть мёртвый склад и низкая оборачиваемость. В производстве это может быть высокий брак или простой узкого места.", "Смертельная метрика отличается от обычной метрики тем, что она быстро приводит к финансовой проблеме. Магазин может иметь выручку, но умереть от денег, застрявших в неликвидном товаре. Производство может иметь заказы, но умереть от кассового разрыва в сырье и незавершёнке. Салон может иметь заявки, но не иметь прибыли из-за слабой загрузки и неправильной оплаты специалистов.", "Предприниматель должен знать обе метрики. Главная метрика показывает, на чём держится рост. Смертельная метрика показывает, что нельзя игнорировать. В сильной финансовой системе обе метрики должны быть видны собственнику регулярно.", "Слайд 31. Как экономика модели связана с будущей финансовой системой", "Что показать на слайде", "Показать связку: тип бизнеса → драйверы → данные → отчёты → метрики → финансовый помощник. Отдельно показать, что для каждого вида бизнеса будут свои готовые таблицы и формы. Внизу написать: «сначала модель, потом инструмент».", "Текст под слайдом", "Экономика бизнес-модели нужна не только для понимания. Она определяет, какие данные бизнес должен собирать. Услуги должны собирать визиты, загрузку, часы, отмены, повторные визиты и выручку на специалиста. Торговля должна собирать SKU, остатки, закупку, продажи, маржу, скидки и оборачиваемость.", "Производство должно собирать сырьё, выпуск, брак, незавершённое производство, себестоимость и мощность. Проекты должны собирать сметы, этапы, выполнение, авансы, субподряд, расходы и оплаты. Логистика должна собирать рейсы, километры, топливо, загрузку, простой и маржу рейса. HoReCa должна собирать гостей, чек, food cost, labor cost, списания, посадку и оборачиваемость столов.", "Из этих данных потом формируются отчёты. ОПиУ показывает прибыльность модели. ДДС показывает денежные последствия модели. Баланс показывает, где остались активы и обязательства. Метрики показывают качество модели и ограничения.", "Финансовый помощник в приложении должен учитывать тип бизнеса. Он не должен задавать одинаковые вопросы салону, магазину и производству. Он должен понимать, какой двигатель у выбранной модели. Тогда рекомендации будут не абстрактными, а привязанными к реальной экономике бизнеса.", "Слайд 32. Итог урока: бизнес нужно видеть через его двигатель", "Что показать на слайде", "Показать финальную схему: тип бизнеса → экономический двигатель → главное ограничение → ключевые метрики → управленческое решение. Внизу крупно написать: «выручка показывает размер, двигатель показывает логику заработка».", "Текст под слайдом", "Главный итог урока состоит в том, что бизнес нельзя анализировать только по выручке. Выручка показывает размер бизнеса. Но она не показывает, за счёт чего бизнес зарабатывает. Она не показывает, где возникают ограничения и риски.", "Экономический двигатель показывает финансовую логику конкретной модели. В услугах это время, загрузка, средний чек и повторные визиты. В торговле это маржа, ассортимент, оборачиваемость и товарный остаток. В производстве это мощность, себестоимость, выпуск, качество и цикл денег.", "Финансовое ограничение показывает, куда собственник должен смотреть в первую очередь. Если ограничение находится в спросе, нужно работать с маркетингом и продажами. Если ограничение находится в мощности, нужно работать с ресурсами и процессами. Если ограничение находится в деньгах, нужно работать с оборачиваемостью, дебиторкой, запасами и платежным календарём.", "После этого урока ученик должен перестать мыслить абстрактным бизнесом. Он должен видеть модель через её единицу продажи, драйверы выручки, драйверы маржи, мощность, денежный цикл и ограничение. Это станет основой для следующих уроков по выручке, unit-экономике, себестоимости, точке безубыточности и финансовой диагностике.", "Итоговая логика урока", "Урок 4 должен сформировать у ученика способность видеть бизнес через экономический двигатель. Это означает, что ученик не просто знает, что такое выручка, прибыль и деньги. Он понимает, из каких управляемых драйверов собирается результат. Он также понимает, что разные виды бизнеса нельзя анализировать одинаково.", "Главная образовательная задача урока — разрушить абстрактный взгляд на бизнес. Салон услуг, магазин, производство, проектный бизнес, логистика и HoReCa могут иметь одинаковую выручку, но разную финансовую механику. У них разные ограничения, разные риски, разные метрики и разные управленческие решения. Поэтому финансовый менеджмент должен начинаться с понимания модели.", "Уникальное добавление урока — понятие экономического двигателя и финансового ограничения. Экономический двигатель показывает, за счёт чего бизнес создаёт выручку, маржу и деньги. Финансовое ограничение показывает, что мешает бизнесу расти или зарабатывать больше. Эта связка делает урок практическим и системным.", "После урока ученик должен уметь задать базовые вопросы к любому бизнесу. Что является единицей продажи. От чего зависит выручка. Где возникает маржа. Где находится мощность. Где застревают деньги. Что создаёт повторные продажи. Какая метрика показывает здоровье модели. Какая метрика может разрушить бизнес, если её не контролировать."], "status": "ready"}]}, {"id": 2, "title": "Выручка, продажи и unit-экономика", "description": "Показывает, как возникает выручка, из каких драйверов она состоит и почему продажа сама по себе ещё не гарантирует прибыльность.", "lessons": [{"id": 5, "title": "Выручка: когда бизнес действительно заработал", "objective": "Объяснить момент признания выручки простым предпринимательским языком.", "content": "Оказанная услуга, отгруженный товар, выполненный этап проекта, подписка, абонемент, сертификат, предоплата, рассрочка.", "case": "Клиент оплатил годовой абонемент. Ученик определяет, какая часть является деньгами, какая обязательством, а какая выручкой текущего месяца.", "result": "Ученик не смешивает деньги и заработанную выручку.", "status": "summary"}, {"id": 6, "title": "Unit-экономика", "objective": "Показать экономику одной единицы бизнеса: клиента, визита, заказа, SKU, часа, проекта, рейса или посадки.", "content": "CAC, LTV, средний чек, маржа на единицу, contribution margin, payback CAC, частота покупок, повторные продажи.", "case": "Бизнес привлекает клиента за 1 500 ₽. Ученик считает, окупается ли клиент при одном визите, трёх визитах и годовом цикле.", "result": "Ученик понимает, где бизнес зарабатывает на уровне единицы, а где теряет деньги.", "status": "summary"}, {"id": 7, "title": "Средний чек, конверсия и объём", "objective": "Разложить выручку на управляемые драйверы, а не смотреть на неё как на одно число.", "content": "Поток, лиды, заявки, трафик, конверсия, средний чек, повторяемость, объём продаж, частота покупок.", "case": "Выручка упала на 15%. Ученик определяет, что именно просело: поток, конверсия, чек или повторные продажи.", "result": "Ученик начинает управлять причинами выручки, а не только итоговой суммой.", "status": "summary"}, {"id": 8, "title": "Ценообразование", "objective": "Показать цену как главный финансовый рычаг, а не просто маркетинговое решение.", "content": "Цена от себестоимости, цена от ценности, цена от рынка, цена от загрузки, минимальная цена, ценовые пакеты, абонементы, динамическая цена.", "case": "Бизнес снижает цену на 15% ради спроса. Ученик считает, насколько должен вырасти объём, чтобы прибыль не упала.", "result": "Ученик понимает финансовые последствия изменения цены.", "status": "summary"}, {"id": 9, "title": "Скидки, акции и промо", "objective": "Показать, что скидка бьёт по марже сильнее, чем кажется предпринимателю.", "content": "Скидка, промо, акция, купон, бесплатная услуга, бонус, компенсация скидки объёмом, промо-экономика.", "case": "Акция увеличила продажи на 30%, но прибыль снизилась. Ученик объясняет, почему рост выручки может разрушить маржу.", "result": "Ученик считает акции не по обороту, а по дополнительной прибыли.", "status": "summary"}, {"id": 10, "title": "Продуктовая линейка, ассортимент и портфель услуг", "objective": "Научить видеть продукты и услуги по ролям: привлечение, маржа, повторные продажи, касса, обязательства, нагрузка.", "content": "Продуктовый портфель, SKU, категории, услуги, пакеты, абонементы, маржинальность, оборачиваемость, лид-магниты, флагманские продукты.", "case": "В линейке есть популярная услуга с низкой маржой и редкая услуга с высокой маржой. Ученик решает, что масштабировать и что менять.", "result": "Ученик управляет не только продажами, но и составом продуктовой модели.", "status": "summary"}]}, {"id": 3, "title": "ОПиУ и прибыльность", "description": "Разбирает прибыльность бизнеса: себестоимость, маржу, расходы, EBITDA, чистую прибыль и ошибки, которые искажают финансовый результат.", "lessons": [{"id": 11, "title": "Себестоимость", "objective": "Объяснить, какие затраты напрямую связаны с созданием услуги, продажей товара, выпуском продукта или выполнением проекта.", "content": "Прямые материалы, прямой труд, расходники, закупочная стоимость, доставка, производственные накладные, субподряд, потери и списания.", "case": "Одинаковая выручка в услугах, торговле и производстве даёт разную валовую прибыль. Ученик определяет, какие затраты относятся в себестоимость.", "result": "Ученик понимает основу валовой прибыли и не смешивает прямые и общие расходы.", "status": "summary"}, {"id": 12, "title": "Постоянные, переменные и ступенчатые расходы", "objective": "Показать поведение расходов при изменении объёма бизнеса.", "content": "Переменные, постоянные, полупеременные, ступенчатые, разовые, расходы роста и расходы поддержания.", "case": "Бизнес открывает вторую точку: аренда и администратор появляются скачком. Ученик определяет, почему прибыль временно проседает.", "result": "Ученик понимает, какие расходы растут вместе с объёмом, а какие создают новый уровень обязательств.", "status": "summary"}, {"id": 13, "title": "Валовая прибыль и валовая маржа", "objective": "Научить читать качество основной бизнес-модели через валовую прибыль.", "content": "Валовая прибыль, валовая маржа, прямые расходы, маржа по продуктам, маржа по категориям, маржа по направлениям.", "case": "Выручка выросла, но валовая маржа упала. Ученик ищет причины: скидки, рост себестоимости, слабая линейка или изменение структуры продаж.", "result": "Ученик видит, приносит ли основная деятельность достаточный запас для покрытия остальных расходов.", "status": "summary"}, {"id": 14, "title": "Contribution margin", "objective": "Показать вклад каждой продажи в покрытие постоянных расходов и прибыль.", "content": "Contribution margin, переменные расходы, вклад на покрытие, маржинальный доход, связь с безубыточностью и рекламой.", "case": "Маркетинговая кампания даёт продажи, но с низким contribution margin. Ученик определяет, масштабировать её или остановить.", "result": "Ученик оценивает продажи по их реальному вкладу, а не только по обороту.", "status": "summary"}, {"id": 15, "title": "Операционные расходы", "objective": "Разделить расходы по функциям, чтобы собственник видел, что именно съедает прибыль.", "content": "Маркетинговые, коммерческие, административные, управленческие, производственные и прочие операционные расходы.", "case": "Расходы выросли на 25%. Ученик раскладывает рост по функциям и определяет, где причина ухудшения EBITDA.", "result": "Ученик перестаёт складывать всё в одну категорию и начинает видеть структуру расходов.", "status": "summary"}, {"id": 16, "title": "EBITDA, EBIT и чистая прибыль", "objective": "Объяснить уровни прибыли и управленческий смысл каждого уровня.", "content": "EBITDA, амортизация, EBIT, проценты, налоги, чистая прибыль, операционная сила бизнеса.", "case": "Два бизнеса имеют одинаковую чистую прибыль, но разную EBITDA и долговую нагрузку. Ученик сравнивает качество моделей.", "result": "Ученик понимает, почему один показатель прибыли не может описать весь бизнес.", "status": "summary"}, {"id": 17, "title": "Почему прибыль может быть иллюзией", "objective": "Показать ошибки, из-за которых предприниматель получает красивую, но ложную прибыль.", "content": "Авансы как выручка, кредит как доход, тело долга как расход, capex как расход месяца, отсутствие амортизации, налогов, начислений и закрытия месяца.", "case": "Бизнес показывает прибыль, но баланс и деньги не сходятся. Ученик находит искажения.", "result": "Ученик понимает, что прибыль без правил учёта и контроля может быть опасной иллюзией.", "status": "summary"}]}, {"id": 4, "title": "Безубыточность, масштабирование и операционный рычаг", "description": "Объясняет минимальный объём продаж для выживания, запас прочности и эффект постоянных расходов при росте или падении бизнеса.", "lessons": [{"id": 18, "title": "Точка безубыточности", "objective": "Научить считать минимальный объём, при котором бизнес выходит в ноль.", "content": "Постоянные расходы, contribution margin, минимальная выручка, минимальное количество клиентов, визитов, заказов, рейсов или проектов.", "case": "Салону нужно покрыть 700 000 ₽ постоянных расходов. Ученик считает нужное число визитов при разной марже и среднем чеке.", "result": "Ученик понимает минимальный уровень продаж, ниже которого бизнес убыточен.", "status": "summary"}, {"id": 19, "title": "Запас финансовой прочности", "objective": "Показать, насколько бизнес устойчив к падению выручки.", "content": "Margin of safety, выручка фактическая, выручка безубыточности, запас прочности, устойчивость к снижению спроса.", "case": "Выручка бизнеса 2 млн ₽, точка безубыточности 1,5 млн ₽. Ученик считает допустимое падение и риск модели.", "result": "Ученик видит, насколько бизнес защищён от просадки.", "status": "summary"}, {"id": 20, "title": "Операционный рычаг", "objective": "Показать, как постоянные расходы усиливают рост прибыли и усиливают убытки при падении выручки.", "content": "Операционный рычаг, структура расходов, масштабирование, риск высокой фиксированной базы, чувствительность прибыли к выручке.", "case": "Два бизнеса растут на 20%, но прибыль одного растёт на 60%, а другого на 15%. Ученик объясняет эффект структуры расходов.", "result": "Ученик понимает риск и силу масштабирования.", "status": "summary"}]}, {"id": 5, "title": "ДДС, деньги и ликвидность", "description": "Показывает, почему прибыль не равна деньгам, где возникают кассовые разрывы и как управлять платёжеспособностью.", "lessons": [{"id": 21, "title": "ДДС: как движутся деньги", "objective": "Собрать логику отчёта движения денежных средств.", "content": "Операционный денежный поток, инвестиционный денежный поток, финансовый денежный поток, деньги на начало, деньги на конец, чистое изменение денег.", "case": "За месяц пришли деньги от клиентов, куплено оборудование и погашен кредит. Ученик распределяет движения по OCF, CFI и CFF.", "result": "Ученик понимает, почему деньги двигаются не так, как прибыль.", "status": "summary"}, {"id": 22, "title": "Почему прибыль есть, а денег нет", "objective": "Разобрать ключевой предпринимательский парадокс: бизнес прибыльный, но касса пустая.", "content": "Дебиторка, запасы, авансы поставщикам, capex, погашение долга, налоги прошлых периодов, сезонность, рассрочки.", "case": "Прибыль 300 000 ₽, деньги снизились на 200 000 ₽. Ученик находит причины через рабочий капитал, capex и долг.", "result": "Ученик умеет объяснять расхождение прибыли и денег.", "status": "summary"}, {"id": 23, "title": "Рабочий капитал", "objective": "Показать место, где прибыль превращается или не превращается в деньги.", "content": "Дебиторка, кредиторка, запасы, авансы клиентов, авансы поставщикам, налоги к уплате, ФОТ к выплате.", "case": "Бизнес прибыльный, но деньги застряли в дебиторке и запасах. Ученик определяет, какие остатки давят на cash flow.", "result": "Ученик понимает финансовую роль остатков в обороте.", "status": "summary"}, {"id": 24, "title": "Cash Conversion Cycle", "objective": "Показать, сколько дней деньги застревают в операционном цикле.", "content": "DSO, DIO, DPO, cash conversion cycle, сроки оплаты клиентов, сроки оплаты поставщиков, оборачиваемость запасов.", "case": "Магазин платит поставщику раньше, чем продаёт товар и получает деньги. Ученик считает, сколько дней бизнес финансирует цикл.", "result": "Ученик видит скорость превращения вложений в деньги.", "status": "summary"}, {"id": 25, "title": "Платёжный календарь и кассовый разрыв", "objective": "Научить управлять краткосрочной ликвидностью.", "content": "Поступления, обязательные платежи, переносимые платежи, минимальный остаток, 91-дневный прогноз, дни риска.", "case": "Через 12 дней нужно выплатить зарплату и аренду, а крупная оплата клиента ожидается позже. Ученик строит логику решения кассового разрыва.", "result": "Ученик умеет заранее видеть опасные дни по деньгам.", "status": "summary"}, {"id": 26, "title": "Финансовая безопасность и резервы", "objective": "Показать, зачем бизнесу денежная подушка и резервы под обязательства.", "content": "Резерв ФОТ, аренды, налогов, долга, сезонности, ремонта, падения спроса, минимальный денежный остаток.", "case": "Бизнес работает без резерва и попадает в кассовый разрыв при задержке оплат. Ученик определяет нужный минимальный запас денег.", "result": "Ученик понимает, что свободные деньги и безопасно доступные деньги - не одно и то же.", "status": "summary"}]}, {"id": 6, "title": "Баланс и остатки", "description": "Раскрывает активы, обязательства, капитал, авансы, основные средства и мосты остатков как основу настоящей управленческой картины.", "lessons": [{"id": 27, "title": "Баланс: активы, обязательства и капитал", "objective": "Объяснить баланс предпринимательским языком.", "content": "Активы, обязательства, капитал, балансовое равенство, финансовое положение, снимок бизнеса на дату.", "case": "У бизнеса есть деньги на счёте, но большие долги и авансы клиентов. Ученик определяет, почему бизнес не так силён, как кажется.", "result": "Ученик понимает, что баланс показывает реальную финансовую конструкцию бизнеса.", "status": "summary"}, {"id": 28, "title": "Активы", "objective": "Разобрать, что бизнес контролирует и что может приносить будущую пользу.", "content": "Деньги, дебиторка, запасы, авансы поставщикам, основные средства, НДС к возмещению, прочие активы.", "case": "Купили оборудование и товарный запас. Ученик определяет, почему это не просто расходы месяца.", "result": "Ученик отличает актив от расхода.", "status": "summary"}, {"id": 29, "title": "Обязательства", "objective": "Показать, что бизнес должен клиентам, сотрудникам, поставщикам, государству и кредиторам.", "content": "Кредиторка, авансы клиентов, налоги, ФОТ, кредиты, проценты, НДС к уплате, прочие обязательства.", "case": "Бизнес получил предоплату и отсрочку от поставщика. Ученик определяет, какие обязательства появились.", "result": "Ученик видит будущие выплаты и обязанности, а не только текущую кассу.", "status": "summary"}, {"id": 30, "title": "Капитал собственника", "objective": "Объяснить, что реально остаётся собственнику внутри бизнеса.", "content": "Взносы, изъятия, накопленная прибыль, дивиденды, капитал, стоимость внутри бизнеса.", "case": "Бизнес показывает прибыль, но собственник регулярно забирает деньги. Ученик анализирует влияние изъятий на капитал и устойчивость.", "result": "Ученик понимает разницу между прибылью бизнеса и деньгами, которые можно забрать.", "status": "summary"}, {"id": 31, "title": "Основные средства, capex и амортизация", "objective": "Показать разницу между крупной покупкой, расходом и амортизацией.", "content": "Capex, основные средства, дата ввода, срок полезного использования, амортизация, остаточная стоимость, выбытие.", "case": "Купили оборудование за 500 000 ₽. Ученик показывает влияние на ДДС, ОПиУ и баланс.", "result": "Ученик не списывает инвестиции в расход одного месяца.", "status": "summary"}, {"id": 32, "title": "Авансы клиентов и предоплаты", "objective": "Разобрать обязательства, возникающие при оплате до оказания услуги или поставки товара.", "content": "Абонементы, сертификаты, подписки, предоплаты, неоказанные услуги, признание выручки, обязательства перед клиентом.", "case": "Продали абонементы на 800 000 ₽ и оказали услуг только на 200 000 ₽. Ученик распределяет деньги, выручку и обязательства.", "result": "Ученик понимает, почему авансовые продажи могут улучшить кассу, но не прибыль.", "status": "summary"}, {"id": 33, "title": "Мосты остатков", "objective": "Научить видеть каждый остаток как движение от начала к концу периода.", "content": "Остаток на начало, увеличение, уменьшение, корректировка, остаток на конец. Мосты ДЗ, КЗ, запасов, авансов, ОС, долга, налогов, ФОТ.", "case": "Дебиторка выросла за месяц. Ученик восстанавливает мост: было, начислили, оплатили, осталось.", "result": "Ученик понимает, что баланс должен собираться через логику движения, а не вводиться произвольно.", "status": "summary"}]}, {"id": 7, "title": "Долг, налоги, ФОТ и собственник", "description": "Разбирает крупные блоки, которые часто искажают прибыль и деньги: кредиты, проценты, налоги, команда и личные деньги собственника.", "lessons": [{"id": 34, "title": "Долг, проценты и кредитная нагрузка", "objective": "Показать, как долг влияет на деньги, прибыль, баланс и риск.", "content": "Тело долга, проценты, график платежей, Debt/EBITDA, interest coverage, DSCR, краткосрочный и долгосрочный долг.", "case": "Бизнес берёт кредит на развитие. Ученик разделяет получение денег, проценты, погашение тела и остаток долга.", "result": "Ученик не путает долг с доходом, а погашение тела долга с расходом.", "status": "summary"}, {"id": 35, "title": "Налоги в управленческой системе", "objective": "Объяснить налоги как управленческий блок: начисления, оплаты и обязательства.", "content": "Начисленные налоги, уплаченные налоги, налоги к уплате, НДС, налог на прибыль, зарплатные налоги, налоговый резерв.", "case": "Налог начислен в одном месяце, а уплачен в другом. Ученик показывает влияние на ОПиУ, ДДС и баланс.", "result": "Ученик понимает, что налоги нельзя вести только по факту оплаты.", "status": "summary"}, {"id": 36, "title": "ФОТ и экономика команды", "objective": "Показать фонд оплаты труда как одну из ключевых финансовых систем бизнеса.", "content": "Оклад, переменная часть, премии, взносы, производственный ФОТ, коммерческий ФОТ, административный ФОТ, управленческий ФОТ, ФОТ/выручка.", "case": "Выручка растёт, но ФОТ растёт быстрее. Ученик анализирует влияние команды на маржу и EBITDA.", "result": "Ученик понимает, как команда влияет на себестоимость, расходы и масштабируемость.", "status": "summary"}, {"id": 37, "title": "Деньги бизнеса и деньги собственника", "objective": "Разделить личные финансы собственника и финансы компании.", "content": "Зарплата собственника, дивиденды, изъятия, вклад собственника, займ собственника, свободный денежный поток, безопасное изъятие.", "case": "Собственник забирает деньги из кассы каждый месяц. Ученик определяет, как это отражается в ДДС, балансе и устойчивости.", "result": "Ученик понимает, сколько можно забирать без разрушения бизнеса.", "status": "summary"}]}, {"id": 8, "title": "Планирование, прогнозирование и инвестиции", "description": "Учит смотреть вперёд: план-факт, драйверное бюджетирование, сценарии, стресс-тесты, инвестиции и источники финансирования роста.", "lessons": [{"id": 38, "title": "План-факт", "objective": "Научить сравнивать ожидания и реальность по прибыли, деньгам, остаткам и метрикам.", "content": "План выручки, расходов, прибыли, денег, баланса, отклонения, причины отклонений, потоковые и остаточные показатели.", "case": "План по выручке выполнен, а прибыль нет. Ученик раскладывает отклонение на цену, объём, маржу и расходы.", "result": "Ученик умеет не просто видеть отклонение, а искать его причину.", "status": "summary"}, {"id": 39, "title": "Бюджетирование по драйверам", "objective": "Показать, что планировать нужно причины цифр, а не только итоговые суммы.", "content": "Драйверы выручки, конверсии, среднего чека, загрузки, объёма, мощности, ставок, рейсов, гостей, этапов проекта.", "case": "Услуги планируют выручку через заявки, конверсию, визиты и чек. Ученик строит логику плана без абстрактной суммы сверху.", "result": "Ученик понимает, как строится реалистичный бюджет бизнеса.", "status": "summary"}, {"id": 40, "title": "Сценарии и стресс-тесты", "objective": "Научить проверять устойчивость бизнеса при изменении внешних и внутренних условий.", "content": "Базовый, оптимистичный, пессимистичный, кризисный сценарии. Падение спроса, рост расходов, задержка оплат, снижение маржи, рост долга.", "case": "Выручка падает на 20%, ФОТ не снижается, оплата клиентов задерживается. Ученик оценивает, когда наступит кассовый риск.", "result": "Ученик умеет смотреть не только на план, но и на опасные варианты будущего.", "status": "summary"}, {"id": 41, "title": "Инвестиционные решения", "objective": "Показать, как считать решения о развитии бизнеса.", "content": "Открытие точки, покупка оборудования, найм, ремонт, запуск направления, payback, ROI, NPV на понятном уровне, IRR на понятном уровне, cash impact.", "case": "Бизнес хочет купить оборудование. Ученик оценивает окупаемость, влияние на кассу, риски и сценарии.", "result": "Ученик принимает инвестиционные решения не по желанию, а через финансовую логику.", "status": "summary"}, {"id": 42, "title": "Финансирование роста", "objective": "Разобрать источники денег для развития и цену каждого источника.", "content": "Реинвестирование прибыли, кредит, займ собственника, инвестор, лизинг, отсрочка поставщика, предоплата клиента, факторинг.", "case": "Есть три варианта финансирования новой точки: кредит, инвестор или собственная прибыль. Ученик сравнивает цену, риск и контроль.", "result": "Ученик понимает, что деньги для роста всегда имеют стоимость и последствия.", "status": "summary"}]}, {"id": 9, "title": "Метрики, диагностика и дашборд", "description": "Даёт систему показателей, диагностику бизнеса и логику экрана собственника, чтобы цифры превращались в решения.", "lessons": [{"id": 43, "title": "Универсальные финансовые метрики", "objective": "Собрать базовый набор показателей, которые нужны почти любому бизнесу.", "content": "Выручка, валовая прибыль, валовая маржа, EBITDA, EBITDA margin, чистая прибыль, OCF, Net CF, current ratio, quick ratio, NWC, Debt/EBITDA, DSCR, ROA, ROE, ROI.", "case": "Ученик получает набор показателей по бизнесу и определяет, какие из них говорят о прибыли, какие о деньгах, какие об устойчивости.", "result": "Ученик умеет читать финансовое здоровье бизнеса через набор метрик.", "status": "summary"}, {"id": 44, "title": "Маркетинговые и клиентские метрики", "objective": "Показать связь маркетинга, клиентов и финансового результата.", "content": "CAC, LTV, LTV/CAC, ROMI, ROAS, conversion, retention, churn, повторные покупки, частота покупок, средний чек, когортный анализ на простом уровне.", "case": "ROAS высокий, но прибыль слабая. Ученик определяет, почему маркетинговая метрика может обманывать без маржи и LTV.", "result": "Ученик оценивает маркетинг через деньги, а не только через заявки.", "status": "summary"}, {"id": 45, "title": "Операционные метрики", "objective": "Показать связь процессов с финансовым результатом.", "content": "Загрузка, производительность, выручка на сотрудника, выручка на час, оборачиваемость, срок выполнения заказа, брак, простои, мощность, утилизация ресурсов.", "case": "В салоне высокая загрузка, но прибыль слабая. Ученик проверяет чек, ФОТ, маржу, повторные продажи и потери времени.", "result": "Ученик понимает, что операционные показатели должны объяснять финансовый результат.", "status": "summary"}, {"id": 46, "title": "Метрики, которые обманывают", "objective": "Научить не принимать решения по красивым, но неполным показателям.", "content": "Рост выручки при падении маржи, хороший ROAS при плохой прибыли, EBITDA при отрицательном cash flow, хороший current ratio при мёртвых запасах, завышенный LTV, неполный CAC.", "case": "Бизнес показывает рост всех верхних метрик, но денег становится меньше. Ученик выявляет, какие показатели создают ложное ощущение успеха.", "result": "Ученик читает метрики критически и в связке друг с другом.", "status": "summary"}, {"id": 47, "title": "Финансовая диагностика бизнеса", "objective": "Дать карту поиска проблем по цифрам.", "content": "Проблемы с деньгами, прибылью, маржей, ростом, устойчивостью, долгом, управляемостью и качеством данных.", "case": "У бизнеса просела чистая прибыль. Ученик по диагностической карте проверяет выручку, маржу, расходы, ФОТ, налоги, долг и разовые факторы.", "result": "Ученик умеет превращать отчёты в расследование причин.", "status": "summary"}, {"id": 48, "title": "Дашборд собственника", "objective": "Показать, какой экран нужен собственнику для регулярного контроля бизнеса.", "content": "Главные показатели, красные зоны, период, план-факт, прибыль, деньги, баланс, риск, метрики, качество данных.", "case": "Ученик видит перегруженный дашборд из 80 метрик и собирает версию из 12–15 ключевых показателей.", "result": "Ученик понимает, что дашборд нужен для решений, а не для красоты.", "status": "summary"}]}, {"id": 10, "title": "Отраслевые финансы", "description": "Показывает, что финансы услуг, торговли, производства, проектов, логистики и HoReCa устроены по-разному.", "lessons": [{"id": 49, "title": "Финансы бизнеса услуг", "objective": "Разобрать финансовую механику услуг.", "content": "Заявки, записи, визиты, загрузка, специалисты, ФОТ, абонементы, повторные визиты, выручка на час, маржа услуги.", "case": "Салон услуг растёт по выручке, но не по прибыли. Ученик ищет проблему в загрузке, чеке, ФОТ, линейке и повторных визитах.", "result": "Ученик понимает, как считать и анализировать сервисный бизнес.", "status": "summary"}, {"id": 50, "title": "Финансы торговли", "objective": "Разобрать финансовую механику розничной и оптовой торговли.", "content": "Товарный остаток, закупка, наценка, маржа, оборачиваемость, скидки, списания, категории, SKU, GMROI.", "case": "Магазин имеет высокую выручку, но деньги заморожены в товаре. Ученик анализирует оборачиваемость и маржу.", "result": "Ученик понимает, что торговля живёт через маржу и оборот запасов.", "status": "summary"}, {"id": 51, "title": "Финансы производства", "objective": "Разобрать финансовую механику производственного бизнеса.", "content": "Сырьё, незавершённое производство, готовая продукция, мощность, себестоимость выпуска, брак, производственные накладные, план производства.", "case": "Производство увеличило выпуск, но деньги ухудшились. Ученик анализирует запасы, WIP, оплату поставщикам и сроки реализации.", "result": "Ученик понимает, как производство связывает мощность, себестоимость, запасы и деньги.", "status": "summary"}, {"id": 52, "title": "Финансы строительства и проектного бизнеса", "objective": "Разобрать проектную финансовую модель.", "content": "Этапы, смета, процент выполнения, авансы, WIP, субподряд, overbilling, underbilling, проектный cash gap.", "case": "Проект прибыльный по смете, но требует финансирования до оплаты заказчика. Ученик анализирует проектный cash gap.", "result": "Ученик понимает, почему проектный бизнес может быть прибыльным и одновременно кассово тяжёлым.", "status": "summary"}, {"id": 53, "title": "Финансы логистики", "objective": "Разобрать финансовую механику логистики и перевозок.", "content": "Рейсы, километры, топливо, водители, ремонт, маржа рейса, загрузка транспорта, cost per km, выручка на машину.", "case": "Перевозчик увеличил число рейсов, но прибыль не выросла. Ученик анализирует топливо, пустые пробеги, ремонт и ставки.", "result": "Ученик понимает логистику через рейс, километр, загрузку и маржу маршрута.", "status": "summary"}, {"id": 54, "title": "Финансы HoReCa", "objective": "Разобрать финансовую механику ресторанов, кафе и гостиничных элементов.", "content": "Food cost, labor cost, prime cost, посадка, средний чек, оборачиваемость столов, списания, меню-инжиниринг, сезонность.", "case": "Кафе имеет полную посадку, но низкую прибыль. Ученик ищет проблему в food cost, labor cost, списаниях и меню.", "result": "Ученик понимает HoReCa через маржу меню, труд, загрузку и списания.", "status": "summary"}]}, {"id": 11, "title": "Финансовая система и управление", "description": "Собирает всю финансовую архитектуру в регулярную систему управления: политика учёта, статьи, закрытие месяца, роли, контроль и стадии бизнеса.", "lessons": [{"id": 55, "title": "Управленческая учётная политика", "objective": "Показать, что финансовая система требует заранее установленных правил.", "content": "Как признавать выручку, что считать себестоимостью, как относить расходы, как учитывать авансы, ОС, долги, ФОТ и закрытие месяца.", "case": "Два менеджера по-разному классифицируют один и тот же расход. Ученик определяет, почему нужна управленческая политика.", "result": "Ученик понимает, что без правил данные становятся несравнимыми.", "status": "summary"}, {"id": 56, "title": "Структура статей и справочников", "objective": "Научить строить понятные справочники доходов, расходов, ДДС, активов, обязательств и аналитик.", "content": "Статьи доходов, расходов, ДДС, активов, обязательств, центры ответственности, направления, проекты, филиалы.", "case": "В бизнесе 300 статей расходов и половина операций попадает в прочее. Ученик пересобирает справочник до управляемой структуры.", "result": "Ученик понимает, как избежать хаоса в финансовой классификации.", "status": "summary"}, {"id": 57, "title": "Закрытие месяца", "objective": "Показать закрытие месяца как регулярный управленческий ритуал.", "content": "Сверка денег, выручки, расходов, ФОТ, налогов, остатков, авансов, долга, ОС и баланса.", "case": "Месяц не закрыт, но собственник уже смотрит прибыль. Ученик определяет, почему выводам нельзя доверять.", "result": "Ученик понимает, что отчёты имеют смысл только после закрытия периода.", "status": "summary"}, {"id": 58, "title": "Финансовый календарь собственника", "objective": "Определить, что предприниматель должен смотреть ежедневно, еженедельно, ежемесячно, ежеквартально и ежегодно.", "content": "Ежедневный cash control, еженедельный план-факт, ежемесячное закрытие, квартальные решения, годовой бюджет.", "case": "Собственник смотрит ОПиУ каждый день, но не видит кассовый разрыв. Ученик распределяет контроль по правильным периодам.", "result": "Ученик получает ритм финансового управления.", "status": "summary"}, {"id": 59, "title": "Внутренний контроль и качество данных", "objective": "Показать, как защищать финансовую систему от ошибок, двойного учёта и недостоверных данных.", "content": "Сверка кассы, банка, расходов, остатков, прав доступа, двойной учёт, QA, ошибки ввода, ответственность за данные.", "case": "В кассе не сходится остаток, а расходы задвоены. Ученик определяет, какие проверки должны были это поймать.", "result": "Ученик понимает, что плохие данные опаснее отсутствия отчёта.", "status": "summary"}, {"id": 60, "title": "Финансовые роли в бизнесе", "objective": "Разобрать, кто за что отвечает в финансовой системе компании.", "content": "Собственник, руководитель, администратор, бухгалтер, финансовый менеджер, операционный директор, маркетолог, руководитель продаж.", "case": "Все считают, что за деньги отвечает бухгалтер. Ученик распределяет ответственность между ролями.", "result": "Ученик понимает, какие финансовые функции можно делегировать, а какие собственник должен контролировать лично.", "status": "summary"}, {"id": 61, "title": "Финансовое управление по стадиям бизнеса", "objective": "Показать, что финансовые приоритеты меняются в зависимости от стадии компании.", "content": "Старт, первые продажи, стабилизация, рост, масштабирование, несколько точек, кризис, подготовка к продаже.", "case": "Бизнес масштабируется второй точкой и теряет cash flow. Ученик определяет, какие метрики и риски становятся главными на этой стадии.", "result": "Ученик видит, что один и тот же показатель по-разному читается на разных этапах бизнеса.", "status": "summary"}, {"id": 62, "title": "Итоговая финансовая архитектура бизнеса", "objective": "Собрать весь модуль в единую систему финансового управления.", "content": "Выручка, расходы, прибыль, деньги, баланс, остатки, метрики, план, прогноз, контроль, решения, отраслевые особенности.", "case": "Итоговый кейс: у бизнеса есть данные по продажам, деньгам, расходам, остаткам и плану. Ученик собирает управленческую картину и формулирует решения.", "result": "Ученик понимает бизнес как финансовую архитектуру, а не набор разрозненных цифр.", "extra": ["7. Рекомендуемая логика открытия модуля в приложении", "Слой 1. База собственника: уроки 1–22. Ученик понимает деньги, выручку, прибыль, ОПиУ, ДДС, рабочий капитал и базовую логику бизнеса.", "Слой 2. Управленческая глубина: уроки 23–42. Ученик понимает ликвидность, баланс, остатки, долг, ФОТ, планирование, сценарии и инвестиционные решения.", "Слой 3. Метрики и диагностика: уроки 43–48. Ученик учится читать показатели, видеть ложные метрики и превращать отчёты в диагностику.", "Слой 4. Отраслевые финансы: уроки 49–54. Ученик выбирает свой тип бизнеса и изучает его финансовую механику.", "Слой 5. Финансовая система: уроки 55–62. Ученик понимает, как выстроить регулярный управленческий контур: правила, статьи, закрытие месяца, роли, контроль и стадии развития бизнеса.", "8. Следующий этап работы", "Выбрать один урок из списка.", "Создать полную внутреннюю структуру урока: цель, ключевые тезисы, структура презентации, теория, кейс, типовые ошибки, тест, домашнее задание и визуальные образы.", "После согласования шаблона одного урока использовать его как стандарт для разработки остальных уроков модуля.", "Отдельно создать готовые финансовые инструменты под виды бизнеса: услуги, торговля, производство, проекты, логистика и HoReCa. Ученик не создаёт таблицы с нуля, а применяет готовую систему."], "status": "summary"}]}];
  const FINANCE_SECTION1_TEST_V77 = [{"q": "На счёт бизнеса поступил 1 000 000 ₽. Собственник говорит: «Значит, мы заработали миллион». Какой первый вопрос должен задать финансово грамотный собственник?", "options": ["Сколько налогов нужно заплатить с этой суммы?", "Почему эти деньги пришли и какой у них финансовый смысл?", "Можно ли сразу вывести эти деньги себе?", "На какую рекламу направить поступление?"], "correct": 1, "explanation": "Сначала нужно определить смысл операции: это может быть выручка, аванс, кредит, возврат дебиторки или вклад собственника."}, {"q": "Клиент оплатил 300 000 ₽ за пакет услуг, но услуги ещё не оказаны. Как это должно отражаться управленчески?", "options": ["В ОПиУ сразу появляется выручка 300 000 ₽", "В ДДС появляется поступление, а в балансе обязательство перед клиентом", "В ОПиУ появляется прибыль 300 000 ₽", "В балансе уменьшается обязательство перед клиентом"], "correct": 1, "critical": true, "explanation": "Аванс улучшает деньги, но пока услуга не оказана, у бизнеса есть обязательство перед клиентом."}, {"q": "Бизнес оказал услугу на 120 000 ₽, но клиент оплатит через 20 дней. Что произошло?", "options": ["Выручка возникла, но денег ещё нет; появилась дебиторская задолженность", "Выручка не возникла, потому что денег ещё нет", "Появился аванс клиента", "Появился финансовый денежный поток"], "correct": 0, "explanation": "Услуга оказана — выручка есть. Денег ещё нет — появляется дебиторка."}, {"q": "Бизнес получил кредит 2 000 000 ₽ и записал его как доход месяца. Что здесь искажено?", "options": ["ДДС, потому что кредит не должен попадать в движение денег", "ОПиУ, потому что кредит не является выручкой", "Баланс, потому что кредит не создаёт обязательств", "Ничего, деньги пришли — значит, доход есть"], "correct": 1, "critical": true, "explanation": "Кредит увеличивает деньги и долг, но не создаёт выручку."}, {"q": "Клиент оплатил старую задолженность 150 000 ₽ за услугу, оказанную в прошлом месяце. Как правильно трактовать поступление?", "options": ["Это новая выручка текущего месяца", "Это возврат дебиторки и денежное поступление", "Это аванс клиента", "Это вклад собственника"], "correct": 1, "critical": true, "explanation": "Если выручка была признана раньше, текущее поступление — это возврат дебиторки, а не новая выручка."}, {"q": "Собственник внёс в бизнес 500 000 ₽, чтобы закрыть кассовый разрыв. Какой вывод верный?", "options": ["Бизнес заработал 500 000 ₽", "Выручка выросла на 500 000 ₽", "Деньги выросли, но это не результат основной деятельности", "Прибыль выросла на 500 000 ₽"], "correct": 2, "explanation": "Вклад собственника поддерживает кассу, но не показывает заработок бизнеса."}, {"q": "Компания купила оборудование за 600 000 ₽ и сразу списала всю сумму в расходы месяца. Что будет искажено?", "options": ["Текущий месяц станет искусственно хуже, будущие месяцы — искусственно лучше", "Текущий месяц станет искусственно лучше", "Баланс не изменится", "ДДС не изменится"], "correct": 0, "critical": true, "explanation": "Оборудование — актив. Деньги ушли сразу, но расход должен признаваться постепенно через амортизацию."}, {"q": "Бизнес погасил 200 000 ₽ тела кредита. Как это влияет на отчёты?", "options": ["Это расход в ОПиУ", "Это финансовый платёж в ДДС и уменьшение долга в балансе", "Это уменьшение выручки", "Это операционный расход"], "correct": 1, "critical": true, "explanation": "Возврат тела кредита уменьшает деньги и долг, но не является расходом периода."}, {"case": "Кейс: за месяц бизнес услуг оказал услуг на 1 200 000 ₽; получил от клиентов 1 500 000 ₽; из поступлений 400 000 ₽ — авансы за будущие услуги; начислил расходы месяца 700 000 ₽; оплатил расходов 600 000 ₽; купил оборудование 300 000 ₽; погасил тело кредита 100 000 ₽.", "q": "Какая сумма является выручкой месяца в ОПиУ?", "options": ["1 500 000 ₽", "1 200 000 ₽", "1 100 000 ₽", "900 000 ₽"], "correct": 1, "explanation": "Выручка месяца — это оказанные услуги, а не все поступления денег."}, {"case": "Тот же кейс месяца.", "q": "Почему поступления 1 500 000 ₽ не равны выручке месяца?", "options": ["Потому что часть поступлений — это авансы за будущие услуги", "Потому что ОПиУ всегда показывает только деньги", "Потому что выручка считается по остатку на счёте", "Потому что все поступления нужно делить пополам"], "correct": 0, "explanation": "Деньги могут прийти раньше выручки. Авансы остаются обязательством до оказания услуг."}, {"case": "Тот же кейс месяца.", "q": "Что произойдёт с авансами клиентов 400 000 ₽?", "options": ["Они полностью станут прибылью", "Они попадут в баланс как обязательство", "Они исчезнут из отчётов", "Они станут дебиторской задолженностью"], "correct": 1, "critical": true, "explanation": "Аванс клиента — это обязанность оказать услугу или вернуть деньги."}, {"case": "Тот же кейс месяца.", "q": "Какая сумма расходов должна попасть в ОПиУ по текущему месяцу?", "options": ["Только оплаченные 600 000 ₽", "Начисленные 700 000 ₽", "600 000 ₽ + оборудование 300 000 ₽", "Все денежные платежи месяца"], "correct": 1, "explanation": "ОПиУ работает по расходам периода, а не только по фактически оплаченным суммам."}, {"case": "Тот же кейс месяца.", "q": "Почему оплаченные расходы 600 000 ₽ и начисленные расходы 700 000 ₽ отличаются?", "options": ["Потому что 100 000 ₽ расходов уже относятся к месяцу, но ещё не оплачены", "Потому что 100 000 ₽ — это выручка", "Потому что 100 000 ₽ — это аванс клиента", "Потому что ОПиУ не учитывает расходы"], "correct": 0, "explanation": "Расход и платёж могут происходить в разные моменты."}, {"case": "Тот же кейс месяца.", "q": "Куда попадёт покупка оборудования 300 000 ₽?", "options": ["Полностью в расходы ОПиУ месяца", "В инвестиционный денежный поток и актив баланса", "В выручку", "В авансы клиентов"], "correct": 1, "critical": true, "explanation": "Оборудование — актив; денежный платёж отражается в ДДС, а не как расход всего месяца."}, {"case": "Тот же кейс месяца.", "q": "Почему погашение тела кредита 100 000 ₽ не уменьшает прибыль месяца?", "options": ["Потому что это возврат ранее полученного долга, а не расход периода", "Потому что кредит всегда является выручкой", "Потому что кредит не отражается в балансе", "Потому что ДДС не учитывает кредиты"], "correct": 0, "critical": true, "explanation": "Тело кредита — это возврат обязательства, а не операционный расход."}, {"case": "Тот же кейс месяца.", "q": "Какой общий вывод по кейсу правильный?", "options": ["Бизнес нужно оценивать только по поступлениям 1 500 000 ₽", "Бизнес нужно оценивать только по прибыли", "Один месяц нужно читать через ОПиУ, ДДС и баланс вместе", "Если денег стало больше, рисков нет"], "correct": 2, "explanation": "ОПиУ, ДДС и баланс отвечают на разные вопросы и должны читаться вместе."}, {"case": "Кейс: бухгалтер показывает выручку 2 000 000 ₽, начисленные расходы 1 400 000 ₽ и прибыль 600 000 ₽. Собственник видит, что денег от клиентов пришло 1 200 000 ₽, платежей было 1 700 000 ₽, на счёте осталось 150 000 ₽, а через 5 дней нужна зарплата 400 000 ₽ и через 7 дней аренда 180 000 ₽.", "q": "Почему бухгалтерская прибыль 600 000 ₽ может быть корректной?", "options": ["Потому что прибыль считается только по деньгам", "Потому что выручка и расходы могли быть признаны по периоду", "Потому что все клиенты уже оплатили", "Потому что кассовый остаток не важен"], "correct": 1, "explanation": "Отчёт о прибыли может корректно признать выручку и расходы периода, даже если деньги пришли не полностью."}, {"case": "Тот же кейс.", "q": "Почему собственник всё равно прав, когда говорит о риске?", "options": ["Потому что на ближайшие платежи денег не хватает", "Потому что прибыль всегда означает убыток", "Потому что бухгалтерия всегда ошибается", "Потому что выручка не нужна"], "correct": 0, "explanation": "Кассовый риск реален, если денег на ближайшие обязательные платежи недостаточно."}, {"case": "Тот же кейс.", "q": "Что объясняет расхождение между прибылью и деньгами?", "options": ["Часть выручки признана, но деньги от клиентов ещё не поступили", "Выручки вообще не было", "Все расходы нужно удалить из ОПиУ", "Денежный поток не связан с платежами"], "correct": 0, "explanation": "Дебиторка объясняет ситуацию: бизнес заработал, но ещё не получил часть денег."}, {"case": "Тот же кейс.", "q": "Какой отчёт нужен, чтобы понять ближайшую угрозу зарплаты и аренды?", "options": ["Только ОПиУ", "ДДС и платёжный календарь", "Только отчёт по рекламе", "Только отчёт по продажам"], "correct": 1, "explanation": "ОПиУ показывает прибыльность, но ближайшие платежи контролируются через ДДС и платёжный календарь."}, {"case": "Тот же кейс.", "q": "Какой вывод по конфликту «бухгалтерия против собственника» правильный?", "options": ["Бухгалтерия не нужна", "Управленческий учёт не нужен", "Бухгалтерия и управленка отвечают на разные задачи", "Достаточно смотреть банковский остаток"], "correct": 2, "explanation": "Бухгалтерия нужна для своих задач, но управленческий учёт нужен для решений собственника."}, {"case": "Тот же кейс.", "q": "Собственник видит: прибыль есть, но денег на ближайшие платежи не хватает. Что нужно сделать первым?", "options": ["Смотреть только ОПиУ, потому что прибыль уже показана", "Разделить ситуацию на ОПиУ, ДДС и баланс: проверить дебиторку, ближайшие платежи и обязательства", "Считать, что бухгалтерия ошиблась", "Вывести прибыль, пока месяц положительный"], "correct": 1, "explanation": "Нужно не спорить с одним отчётом, а связать прибыльность, денежный поток и остатки."}, {"q": "Два бизнеса имеют выручку 3 000 000 ₽. Один — салон услуг, второй — магазин. Почему их нельзя сравнивать только по выручке?", "options": ["Потому что у них разные налоги", "Потому что у них разные драйверы выручки, маржи, остатков и ограничений", "Потому что магазин всегда лучше салона", "Потому что услуги не имеют расходов"], "correct": 1, "explanation": "Одинаковая выручка может скрывать разные ограничения, маржу, остатки и денежный цикл."}, {"q": "Салон услуг имеет загрузку специалистов 92%, но прибыль слабая. Где вероятнее проблема?", "options": ["В товарных остатках", "В цене, ФОТ специалистов, длительности услуг или структуре линейки", "В сырье и незавершённом производстве", "В себестоимости товара"], "correct": 1, "explanation": "При высокой загрузке в услугах нужно смотреть выручку на час, ФОТ, длительность услуги и линейку."}, {"q": "Магазин показывает рост выручки, но денег становится меньше. Что нужно проверить первым?", "options": ["Количество сотрудников", "Товарный остаток, оборачиваемость, скидки и валовую маржу", "Загрузку кабинетов", "Зарплату бухгалтера"], "correct": 1, "explanation": "В торговле деньги часто застревают в запасах, а выручка может расти при слабой марже."}, {"q": "Производство имеет заказы и прибыль по ОПиУ, но касса напряжена. Где могут застревать деньги?", "options": ["Только в рекламе", "В сырье, незавершёнке, готовой продукции и дебиторке", "Только в налогах", "Только в зарплате директора"], "correct": 1, "explanation": "В производстве деньги проходят через сырьё, WIP, готовую продукцию и дебиторку."}, {"q": "Проектный бизнес показывает хорошую маржу по смете, но постоянно испытывает кассовые разрывы. Главная причина может быть в том, что:", "options": ["Клиент оплачивает позже, чем бизнес несёт расходы по проекту", "Проектный бизнес не имеет расходов", "Выручка всегда равна кассе", "Баланс в проектном бизнесе не нужен"], "correct": 0, "explanation": "Проект может быть прибыльным по этапам, но денежно тяжёлым, если график оплат отстаёт от расходов."}, {"q": "В логистике выросло количество рейсов, но прибыль не выросла. Что нужно проверить?", "options": ["Только выручку", "Маржу рейса, топливо, простой, пустой пробег и cost per km", "Только количество клиентов", "Только сумму налогов"], "correct": 1, "explanation": "Логистику нельзя оценивать только числом рейсов; важны себестоимость маршрута, загрузка и простой."}, {"q": "В HoReCa полная посадка, но прибыль слабая. Самая вероятная зона проверки:", "options": ["Food cost, labor cost, списания, меню и скорость обслуживания", "Только количество гостей", "Только остаток денег на счёте", "Только количество подписчиков"], "correct": 0, "explanation": "Полная посадка не гарантирует прибыль, если себестоимость еды, труд и списания съедают маржу."}, {"q": "Какой главный итог урока про экономику бизнес-модели?", "options": ["Все бизнесы считаются одинаково", "Выручка показывает размер, но не объясняет экономику бизнеса", "Касса всегда показывает прибыль", "Чем больше продаж, тем всегда больше прибыль"], "correct": 1, "explanation": "Выручка — только верхняя строка. Экономику объясняют драйверы, маржа, мощность, денежный цикл и ограничение модели."}];
  const FINANCE_SECTION1_PASS_SCORE_V77 = Math.ceil(FINANCE_SECTION1_TEST_V77.length * 0.8);

  function fEsc(value){
    if (typeof esc === 'function') return esc(value);
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function fCard(cls, html){ return typeof card === 'function' ? card(cls, html) : `<section class="card-v2 ${cls||''}">${html}</section>`; }
  function fShell(html, tab){ if (typeof shell === 'function') shell(html, tab || 'finance'); }
  function fAdminMode(){ return typeof isAdminMode === 'function' && isAdminMode(); }
  function fAdminUser(){ return typeof isAdminUser === 'function' && isAdminUser(); }
  function fRequireAdmin(){
    return true;
  }
  function fSuffix(){
    try {
      const ids = typeof possibleIds === 'function' ? possibleIds() : [];
      const names = typeof possibleUsernames === 'function' ? possibleUsernames() : [];
      return ids[0] || names[0] || 'local';
    } catch(e) { return 'local'; }
  }
  function fProgressKey(){ return 'architecture_finance_module_progress_v77_' + fSuffix(); }
  function fLoadProgress(){ try { return JSON.parse(localStorage.getItem(fProgressKey()) || '{}'); } catch(e) { return {}; } }
  function fSaveProgress(patch){
    const next = Object.assign({}, fLoadProgress(), patch || {}, { updatedAt: new Date().toISOString() });
    localStorage.setItem(fProgressKey(), JSON.stringify(next));
    return next;
  }
  function fSection1Passed(){
    const p = fLoadProgress();
    return Boolean(p.section1TestPassed) || Number(p.section1TestScore || 0) >= FINANCE_SECTION1_PASS_SCORE_V77;
  }
  function fSectionOpen(id){
    id = Number(id);
    if (id === 1) return true;
    if (id === 2) return fSection1Passed();
    return false;
  }
  function fSection(id){ return FINANCE_MODULE_SECTIONS_V77.find(s => Number(s.id) === Number(id)); }
  function fLesson(sectionId, lessonId){
    const sec = fSection(sectionId);
    return sec ? (sec.lessons || []).find(l => Number(l.id) === Number(lessonId)) : null;
  }
  function fAllLessonRows(section){ return (section && Array.isArray(section.lessons)) ? section.lessons : []; }

  function normalizeFinanceText(value){
    let out = String(value || '').trim();
    if (!out) return '';
    out = out.replace(/\s+/g, ' ');
    out = out.replace(/ОПУ/g, 'ОПиУ');
    out = out.replace(/[ОO0]{2,}\s*ДДС/g, 'ОДДС');
    out = out.replace(/О\s+ДДС/g, 'ОДДС');
    out = out.replace(/(^|[^А-Яа-яA-Za-z0-9Оо])ДДС(?=$|[^А-Яа-яA-Za-z0-9])/g, '$1ОДДС');
    out = out.replace(/Результат ученика\s*:/gi, 'Основной вывод:');
    out = out.replace(/Ученик/g, 'Предприниматель');
    out = out.replace(/ученик/g, 'предприниматель');
    out = out.replace(/ученика/g, 'предпринимателя');
    out = out.replace(/ученику/g, 'предпринимателю');
    out = out.replace(/учеником/g, 'предпринимателем');
    out = out.replace(/предпринимательа/gi, 'предпринимателя');
    out = out.replace(/предпринимательу/gi, 'предпринимателю');
    out = out.replace(/у предприниматель(\s|$)/gi, 'у предпринимателя$1');
    out = out.replace(/почему предпринимателя ошибается/gi, 'почему предприниматель ошибается');
    out = out.replace(/сквозной кейс на\s*1\s*000\s*000\s*₽/gi, 'сквозной кейс');
    out = out.replace(/\s+([,.!?;:])/g, '$1').trim();
    return out;
  }
  function skipIntroLine(raw){
    return /^Урок\s+\d+\./i.test(raw)
      || /^Общая структура урока$/i.test(raw)
      || /^Рекомендуемая длительность урока\s*:/i.test(raw)
      || /^Тест после урока\s*:/i.test(raw)
      || /^Практическая таблица/i.test(raw);
  }
  function parseLessonScreens(lesson){
    const content = Array.isArray(lesson && lesson.fullContent) ? lesson.fullContent : [];
    const intro = [];
    const slides = [];
    const finalLines = [];
    let mode = 'intro';
    let current = null;
    let skipVisual = false;
    let textStarted = false;
    content.forEach(item => {
      const raw = String(item || '').trim();
      if (!raw) return;
      if (/^Слайд\s+\d+\./i.test(raw)) {
        mode = 'slide'; skipVisual = false; textStarted = false;
        current = { title: normalizeFinanceText(raw.replace(/^Слайд\s+\d+\.\s*/i, '')), text: [] };
        slides.push(current); return;
      }
      if (/^Итоговая логика урока$/i.test(raw)) { mode = 'final'; current = null; skipVisual = false; textStarted = false; return; }
      if (mode === 'intro') {
        if (skipIntroLine(raw)) return;
        const clean = normalizeFinanceText(raw);
        if (clean) intro.push(clean);
        return;
      }
      if (mode === 'slide') {
        if (/^Что показать на слайде$/i.test(raw)) { skipVisual = true; textStarted = false; return; }
        if (/^Текст под слайдом$/i.test(raw)) { skipVisual = false; textStarted = true; return; }
        if (skipVisual && !textStarted) return;
        if (current) current.text.push(normalizeFinanceText(raw));
        return;
      }
      if (mode === 'final') {
        if (skipIntroLine(raw)) return;
        const clean = normalizeFinanceText(raw);
        if (clean) finalLines.push(clean);
      }
    });
    return { intro, slides, finalLines };
  }
  function introValue(intro, key, fallback){
    const row = (intro || []).find(line => line.toLowerCase().startsWith(key.toLowerCase() + ':'));
    return row ? normalizeFinanceText(row.slice(row.indexOf(':') + 1)) : fallback;
  }
  function titleScreenHtml(lesson, parsed, total){
    const count = introValue(parsed.intro, 'Количество слайдов', String((parsed.slides || []).length || '—')).replace(/\.$/, '');
    const format = introValue(parsed.intro, 'Формат урока', normalizeFinanceText(lesson.content || 'Теоретическое объяснение, кейс и управленческий вывод.'));
    const task = introValue(parsed.intro, 'Главная задача урока', normalizeFinanceText(lesson.objective || 'Сформировать управленческое понимание темы.'));
    const result = introValue(parsed.intro, 'Основной вывод', normalizeFinanceText(lesson.result || 'Формируется практический финансовый вывод по теме.'));
    return `${fCard('blue-card-v2 finance-clean-cover', `<p class="eyebrow">структура урока</p><h1>${fEsc(lesson.title)}</h1><p>Титульный лист перед основной последовательностью слайдов.</p>`)}${fCard('finance-cover-card-v77', `<h2>Структура урока</h2><div class="finance-cover-grid-v77"><div><span>Количество слайдов</span><p>${fEsc(count)}</p></div><div><span>Формат</span><p>${fEsc(format)}</p></div><div><span>Главная задача</span><p>${fEsc(task)}</p></div><div><span>Основной вывод</span><p>${fEsc(result)}</p></div></div><p class="small">Экран 1 из ${total}</p>`)}`;
  }
  function slideMainThought(slide){ return (slide.text && slide.text[0]) ? slide.text[0] : slide.title; }
  function financeShortTextV84(text, maxLen){
    const value = normalizeFinanceText(String(text || '')).replace(/\s+/g, ' ').trim();
    if (!value) return '';
    const limit = Number(maxLen || 190);
    return value.length > limit ? value.slice(0, limit - 1).replace(/[\s,.;:—-]+$/,'') + '…' : value;
  }
  function financeSlideSentencesV84(slide){
    const raw = ((slide && slide.text) || []).join(' ');
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .match(/[^.!?]+[.!?]?/g) || []
      .map(s => normalizeFinanceText(s).trim())
      .filter(Boolean);
  }
  function financeFindSentenceV84(slide, patterns){
    const sentences = financeSlideSentencesV84(slide);
    const pats = (patterns || []).map(p => new RegExp(p, 'i'));
    for (const s of sentences) {
      if (pats.some(p => p.test(s))) return financeShortTextV84(s, 190);
    }
    return '';
  }
  function financeLastMeaningSentenceV84(slide){
    const sentences = financeSlideSentencesV84(slide);
    const priority = [/^Поэтому\b/i, /^Главн/i, /^Итог/i, /^В итоге/i, /^Именно поэтому/i, /^Это означает/i, /нужно/i, /долж/i, /важн/i];
    for (let i = sentences.length - 1; i >= 0; i--) {
      const s = sentences[i];
      if (priority.some(p => p.test(s))) return financeShortTextV84(s, 220);
    }
    return financeShortTextV84(sentences[sentences.length - 1] || (slide && slide.title) || '', 220);
  }

  const FINANCE_SLIDE_CALLOUTS_V85 = {
  "1-1-1": {
    "error": "Считать остаток денег на счёте доказательством прибыли и общего здоровья бизнеса.",
    "conclusion": "Любое поступление сначала нужно разобрать по смыслу: что заработано, какие деньги пришли и какие обязательства появились."
  },
  "1-1-2": {
    "error": "Пытаться заменить ОПиУ, ДДС и баланс одним банковским остатком.",
    "conclusion": "ОПиУ, ДДС и баланс отвечают на разные вопросы: прибыльность, движение денег и финансовое положение."
  },
  "1-1-3": {
    "error": "Считать движение денег фактом заработка и не задавать вопрос, почему деньги пришли или ушли.",
    "conclusion": "После каждого движения денег нужно определить его природу и влияние на ОПиУ, ДДС и баланс."
  },
  "1-1-4": {
    "error": "Признавать выручку по факту оплаты, а не по факту передачи ценности клиенту.",
    "conclusion": "Выручка возникает при оказании услуги, передаче товара или выполнении этапа, а оплата может быть раньше или позже."
  },
  "1-1-5": {
    "error": "Считать прибыль остатком денег на счёте и не разделять доходы, расходы и платежи периода.",
    "conclusion": "Прибыль считается через заработанную выручку и расходы периода; платёж не всегда равен расходу."
  },
  "1-1-6": {
    "error": "Путать расход и платёж: всё, что ушло со счёта, считать уменьшением прибыли.",
    "conclusion": "Расход уменьшает финансовый результат, платёж уменьшает деньги; эти события нужно отражать раздельно."
  },
  "1-1-7": {
    "error": "Списывать покупку оборудования как обычный расход одного месяца.",
    "conclusion": "Оборудование отражается как актив в балансе, платёж в ДДС и расход через амортизацию в ОПиУ."
  },
  "1-1-8": {
    "error": "Записывать кредит как доход только потому, что деньги пришли на счёт.",
    "conclusion": "Кредит увеличивает деньги и долг, но не создаёт выручку; его нужно читать через обязательства и будущие платежи."
  },
  "1-1-9": {
    "error": "Считать аванс клиента свободной прибылью и тратить его как заработанные деньги.",
    "conclusion": "Аванс даёт поступление денег, но создаёт обязательство; выручка признаётся по мере выполнения обещания клиенту."
  },
  "1-1-10": {
    "error": "Считать дебиторку деньгами и не видеть риск задержки оплаты клиентом.",
    "conclusion": "Дебиторка показывает заработанную выручку без поступления денег; нужно управлять сроками оплат."
  },
  "1-1-11": {
    "error": "Делать вывод по сумме 1 000 000 ₽ без понимания источника поступления.",
    "conclusion": "Одна сумма может быть выручкой, авансом, кредитом, возвратом дебиторки или вкладом собственника."
  },
  "1-1-12": {
    "error": "Считать настоящую выручку итоговой прибылью и не анализировать маржу и расходы.",
    "conclusion": "Даже если поступление связано с выручкой, нужно проверить себестоимость, расходы, налоги и влияние на капитал."
  },
  "1-1-13": {
    "error": "Признать весь аванс клиента как выручку текущего месяца.",
    "conclusion": "Аванс отражается в ДДС и обязательствах, а в ОПиУ попадает только заработанная часть."
  },
  "1-1-14": {
    "error": "Считать кредит улучшением результата бизнеса, а не ростом обязательств.",
    "conclusion": "Кредит не улучшает экономический результат сам по себе: деньги выросли, но долг тоже вырос."
  },
  "1-1-15": {
    "error": "Записать возврат старой дебиторки как новую выручку и задвоить доход.",
    "conclusion": "Возврат дебиторки превращает долг клиента в деньги, но не создаёт новую выручку текущего периода."
  },
  "1-1-16": {
    "error": "Считать вклад собственника продажами или операционной выручкой бизнеса.",
    "conclusion": "Вклад собственника — это финансирование: он усиливает кассу, но не доказывает качество бизнес-модели."
  },
  "1-1-17": {
    "error": "Сравнивать пять поступлений только по ДДС, потому что деньги выросли одинаково.",
    "conclusion": "Одна и та же сумма по-разному влияет на ОПиУ и баланс; смысл операции важнее самой суммы."
  },
  "1-1-18": {
    "error": "Начинать анализ с суммы операции, а не с её финансового смысла.",
    "conclusion": "Правило собственника: сначала определить смысл операции, затем отнести её в ОПиУ, ДДС и баланс."
  },
  "1-2-1": {
    "error": "Управлять бизнесом по кассе и не видеть прибыль, обязательства, активы и будущие риски.",
    "conclusion": "Финансовая карта нужна, чтобы видеть операции, деньги, остатки и решения как единую систему."
  },
  "1-2-2": {
    "error": "Вести набор разрозненных таблиц без связи между операциями, отчётами и решениями.",
    "conclusion": "Финансовая система работает только тогда, когда каждая операция получает смысл и попадает в правильный контур."
  },
  "1-2-3": {
    "error": "Читать операционный, денежный, балансовый и метрический контуры как независимые блоки.",
    "conclusion": "Четыре контура должны быть связаны: операции создают отчёты, отчёты дают метрики, метрики ведут к решениям."
  },
  "1-2-4": {
    "error": "Начинать финансовый учёт с формул, не разобрав реальные действия бизнеса.",
    "conclusion": "Финансовые отчёты отражают операционные события; если операции описаны плохо, отчётность будет искажена."
  },
  "1-2-5": {
    "error": "Смешивать факт продажи и факт оплаты клиента.",
    "conclusion": "Выручка возникает при передаче ценности, а оплата может быть раньше, позже или одновременно с ней."
  },
  "1-2-6": {
    "error": "Считать любой платёж расходом текущего периода.",
    "conclusion": "Расход появляется при использовании ресурса для результата периода; платёж может быть раньше, позже или относиться к активу."
  },
  "1-2-7": {
    "error": "Ожидать, что ОПиУ покажет наличие денег на счёте.",
    "conclusion": "ОПиУ отвечает на вопрос прибыльности, но кассу и платёжеспособность нужно проверять через ДДС."
  },
  "1-2-8": {
    "error": "Смотреть только на изменение остатка денег без структуры поступлений и платежей.",
    "conclusion": "Денежный контур нужно делить на операционный, инвестиционный и финансовый потоки."
  },
  "1-2-9": {
    "error": "Считать положительную прибыль гарантией платёжеспособности.",
    "conclusion": "ДДС показывает, хватает ли бизнесу денег; отдельно нужно анализировать OCF, инвестиции, долг и платежи."
  },
  "1-2-10": {
    "error": "Требовать совпадения ОПиУ и ДДС и считать расхождение ошибкой.",
    "conclusion": "ОПиУ и ДДС отвечают на разные вопросы; расхождение объясняют дебиторка, авансы, кредиторка, capex и долг."
  },
  "1-2-11": {
    "error": "Относиться к балансу как к бухгалтерской формальности без управленческого смысла.",
    "conclusion": "Баланс показывает, что есть у бизнеса, кому он должен и как операции изменили финансовое положение."
  },
  "1-2-12": {
    "error": "Вводить остатки как случайные цифры без движения от начала к концу периода.",
    "conclusion": "Остатки объясняют связь прибыли и денег: дебиторку, авансы, запасы, долг, налоги, ФОТ и активы."
  },
  "1-2-13": {
    "error": "Видеть прибыль, но не видеть деньги, застрявшие в дебиторке, запасах и сроках оплат.",
    "conclusion": "Рабочий капитал нужно читать как систему сроков: когда деньги приходят, уходят и где остаются связанными."
  },
  "1-2-14": {
    "error": "Собирать метрики ради красивого дашборда, а не ради управленческого решения.",
    "conclusion": "Метрика полезна только тогда, когда она помогает поставить диагноз и выбрать действие собственника."
  },
  "1-2-15": {
    "error": "Делать диагноз по одной метрике: выручке, ROAS, деньгам или EBITDA отдельно.",
    "conclusion": "Метрики нужно читать связками: выручка с маржей, прибыль с ДДС, деньги с балансом и обязательствами."
  },
  "1-2-16": {
    "error": "Пытаться понять месяц бизнеса через один отчёт или одну кассовую таблицу.",
    "conclusion": "Один месяц нужно разложить на три экрана: ОПиУ показывает прибыльность, ДДС — деньги, баланс — последствия."
  },
  "1-2-17": {
    "error": "Считать исходные события уже готовыми отчётами без классификации операций.",
    "conclusion": "Сначала события месяца нужно классифицировать, а потом разнести их по ОПиУ, ДДС и балансу."
  },
  "1-2-18": {
    "error": "Включить аванс клиента в выручку и учитывать только оплаченные расходы в ОПиУ.",
    "conclusion": "ОПиУ строится по заработанной выручке и начисленным расходам периода, а не по фактическим поступлениям."
  },
  "1-2-19": {
    "error": "Считать ДДС отчётом о прибыли и не разделять операционные, инвестиционные и финансовые платежи.",
    "conclusion": "ДДС показывает реальные деньги: поступления, платежи, оборудование, кредитные платежи и чистое изменение кассы."
  },
  "1-2-20": {
    "error": "Считать баланс повторением кассы, а не картой последствий месяца.",
    "conclusion": "Баланс показывает деньги, активы, авансы клиентов, кредиторку, долг и капитал после всех операций периода."
  },
  "1-2-21": {
    "error": "Принимать одинаковые решения по ОПиУ, ДДС и балансу.",
    "conclusion": "ОПиУ ведёт к решениям по марже и расходам, ДДС — по платежам, баланс — по долгам, активам и обязательствам."
  },
  "1-2-22": {
    "error": "Сводить финансовую карту бизнеса обратно к одной кассовой таблице.",
    "conclusion": "Итог урока: финансы нельзя свести к кассе; нужна связка операций, ОПиУ, ДДС, баланса, метрик и решений."
  },
  "1-3-1": {
    "error": "Считать, что наличие бухгалтера уже означает наличие финансовой системы управления.",
    "conclusion": "Бухгалтерия нужна бизнесу, но для управления требуется отдельная управленческая система с деньгами, остатками, метриками и рисками."
  },
  "1-3-2": {
    "error": "Смешивать бухгалтерский, налоговый и управленческий учёт в одну цифру без правил.",
    "conclusion": "Каждый контур отвечает на свой вопрос: корректность, налоги или управленческие решения."
  },
  "1-3-3": {
    "error": "Требовать от бухгалтерского учёта дашборд собственника и аналитику по направлениям.",
    "conclusion": "Бухгалтерия даёт документы, проводки и отчётность; управленческие решения требуют другой аналитики и скорости."
  },
  "1-3-4": {
    "error": "Оценивать здоровье бизнеса по налоговой базе или сумме налога к уплате.",
    "conclusion": "Налоговый учёт нужен для обязательств перед государством, но не заменяет диагностику маржи, денег и рисков."
  },
  "1-3-5": {
    "error": "Называть управленкой любую таблицу без правил, сверок и связи с решениями.",
    "conclusion": "Управленческий учёт должен связывать ввод данных, отчёты, метрики, диагностику и действия собственника."
  },
  "1-3-6": {
    "error": "Использовать одну цифру из одной системы учёта для всех управленческих задач.",
    "conclusion": "Одна операция должна иметь несколько признаков: деньги, обязательство, будущая выручка, влияние на отчёты."
  },
  "1-3-7": {
    "error": "Считать расхождение бухгалтерской и управленческой прибыли автоматической ошибкой.",
    "conclusion": "Разные прибыли могут быть корректны, если различаются правила группировки, аналитики и управленческих корректировок."
  },
  "1-3-8": {
    "error": "Думать, что положительная прибыль отменяет кассовый риск.",
    "conclusion": "Прибыль и деньги отвечают на разные вопросы; кассовый риск нужно читать через ДДС и баланс."
  },
  "1-3-9": {
    "error": "Спорить с бухгалтерией вместо разделения прибыли, денег и остатков по разным экранам.",
    "conclusion": "В кейсе нужно отделить ОПиУ, ДДС и баланс: прибыль есть, но деньги могли уйти или застрять в дебиторке."
  },
  "1-3-10": {
    "error": "Использовать бухгалтерский взгляд как полный ответ для ежедневного управления.",
    "conclusion": "Бухгалтерский отчёт показывает результат периода, но не показывает сроки оплат, кассовый разрыв и будущие платежи."
  },
  "1-3-11": {
    "error": "Игнорировать денежный взгляд, если отчёт о прибыли выглядит положительным.",
    "conclusion": "ДДС показывает напряжение месяца: поступления, платежи, чистое изменение денег и дебиторку как причину расхождения."
  },
  "1-3-12": {
    "error": "Думать, что прибыль всегда превращается в деньги на счёте.",
    "conclusion": "Баланс объясняет, где осталась прибыль: в дебиторке, обязательствах, активах или капитале, а не только в кассе."
  },
  "1-3-13": {
    "error": "Выбирать один отчёт как “правильный” и объявлять остальные ошибочными.",
    "conclusion": "Оба взгляда могут быть верными: ОПиУ показывает прибыльность, ДДС — платёжеспособность, баланс — положение."
  },
  "1-3-14": {
    "error": "Держать управленческие отчёты отдельно, без общей системы решений.",
    "conclusion": "ОПиУ, ДДС, баланс, план-факт, платёжный календарь, метрики и дашборд должны работать связно."
  },
  "1-3-15": {
    "error": "Считать управленческие финансы без заранее описанных правил классификации.",
    "conclusion": "Управленческая учётная политика фиксирует, как считать выручку, расходы, авансы, ОС, долг, ФОТ, налоги и закрытие месяца."
  },
  "1-3-16": {
    "error": "Менять управленческие цифры произвольно и не сверять их с источниками.",
    "conclusion": "Логическая честность держится на источнике данных, правильной классификации и обязательной сверке денег, баланса и остатков."
  },
  "1-3-17": {
    "error": "Ждать бухгалтерского закрытия, прежде чем увидеть кассовый риск, падение маржи или перерасход.",
    "conclusion": "Управленка должна быть быстрее: предварительные и проверенные данные нужны для решений в течение месяца."
  },
  "1-3-18": {
    "error": "Управлять бизнесом по средним общим цифрам без разрезов по филиалам, продуктам и каналам.",
    "conclusion": "Управленческая аналитика должна показывать, где именно бизнес зарабатывает, теряет деньги или создаёт риск."
  },
  "1-3-19": {
    "error": "Строить управленческую систему, оторванную от банка, документов, кассы и бухгалтерских фактов.",
    "conclusion": "Между бухгалтерией и управленкой нужен мост: факты, корректировки, отчёты и регулярные сверки."
  },
  "1-3-20": {
    "error": "Требовать от бухгалтерии маржинальность продуктов, окупаемость рекламы, загрузку и прогноз кассовых разрывов без нужных данных.",
    "conclusion": "Бухгалтерия ведёт обязательный контур, а управленческая система собирает данные для экономики продуктов, каналов, загрузки и решений."
  },
  "1-3-21": {
    "error": "Собирать данные без классификации, отчётов, сверок, метрик, прогноза и управленческих действий.",
    "conclusion": "Система собственника должна показывать не только прошлое, но и риски будущего: деньги, маржу, обязательства и решения."
  },
  "1-3-22": {
    "error": "Противопоставлять бухгалтерию и управленку как конкурирующие системы.",
    "conclusion": "Правильная финансовая архитектура соединяет бухгалтерскую дисциплину фактов и управленческую систему решений."
  },
  "1-4-1": {
    "error": "Сравнивать салон, магазин и производство только по одинаковой выручке 3 000 000 ₽.",
    "conclusion": "Одинаковая выручка скрывает разные процессы, маржу, мощность, остатки и риски модели."
  },
  "1-4-2": {
    "error": "Описывать бизнес-модель как продукт или оффер, а не как финансовую механику.",
    "conclusion": "Экономика модели показывает, откуда берётся выручка, где возникает себестоимость, маржа, деньги и ограничение."
  },
  "1-4-3": {
    "error": "Искать универсальный взгляд на все бизнесы и не выделять главную “шестерёнку” модели.",
    "conclusion": "Экономический двигатель показывает, какой механизм превращает деятельность в прибыль и деньги в конкретном виде бизнеса."
  },
  "1-4-4": {
    "error": "Строить финансовую модель без ответа на вопросы о выручке, марже, деньгах и ограничении роста.",
    "conclusion": "Любую модель нужно начинать с четырёх вопросов: как появляется выручка, где маржа, когда деньги, что ограничивает рост."
  },
  "1-4-5": {
    "error": "Применять общую формулу прибыли без разложения выручки, затрат и денежного цикла конкретной модели.",
    "conclusion": "Формула работает только после расшифровки объёма, цены, повторяемости, прямых затрат, сроков оплат и остатков."
  },
  "1-4-6": {
    "error": "Усиливать продажи или рекламу, не найдя реальный потолок модели.",
    "conclusion": "Рост упирается в ограничение: спрос, маржу, мощность, оборотный капитал, людей, качество или управляемость."
  },
  "1-4-7": {
    "error": "Планировать “выручку 5 000 000 ₽” без понимания, какими драйверами она будет создана.",
    "conclusion": "Выручку нужно раскладывать на управляемые элементы: визиты, трафик, конверсию, чек, выпуск, рейсы или этапы."
  },
  "1-4-8": {
    "error": "Считать выручку заработком бизнеса без прямых затрат на выполнение обещания клиенту.",
    "conclusion": "Маржа показывает, сколько остаётся после ФОТ, закупки, сырья, списаний, брака и других прямых затрат."
  },
  "1-4-9": {
    "error": "Продавать больше, чем бизнес физически способен выполнить без потери качества и маржи.",
    "conclusion": "Мощность задаёт потолок выручки: часы, кабинеты, оборудование, транспорт, посадочные места и пиковая загрузка."
  },
  "1-4-10": {
    "error": "Игнорировать скорость возврата денег и смотреть только на прибыль по ОПиУ.",
    "conclusion": "Экономика модели должна включать денежный цикл: склад, сырьё, НЗП, этапы, дебиторку и сроки оплат."
  },
  "1-4-11": {
    "error": "Каждый месяц покупать новый поток клиентов и не считать повторные продажи как отдельный двигатель модели.",
    "conclusion": "Повторяемость снижает давление на привлечение и делает выручку устойчивее в услугах, торговле, HoReCa, проектах и логистике."
  },
  "1-4-12": {
    "error": "Оценивать бизнес услуг только по выручке и количеству визитов.",
    "conclusion": "Услуги нужно считать через доступные часы, загрузку, выручку на час, средний чек и повторяемость."
  },
  "1-4-13": {
    "error": "Считать высокую загрузку услуг гарантией прибыли.",
    "conclusion": "В услугах нужно проверять свободные окна, отмены, no-show, ФОТ, выручку на специалиста и повторные визиты."
  },
  "1-4-14": {
    "error": "Оценивать магазин по обороту и не видеть товарную маржу и оборачиваемость.",
    "conclusion": "Торговля управляется через трафик, конверсию, чек, валовую прибыль, закупку, склад и скорость оборота товара."
  },
  "1-4-15": {
    "error": "Держать широкий склад и скидки ради оборота, не считая маржу по SKU и деньги в товаре.",
    "conclusion": "Торговля зарабатывает маржой на обороте: важны закупка, наличие, списания, возвраты, SKU и оборачиваемость."
  },
  "1-4-16": {
    "error": "Оценивать производство по выручке или выпуску без понимания полной себестоимости.",
    "conclusion": "Производство нужно читать через сырьё, труд, накладные, потери, мощность, НЗП и продажу готовой продукции."
  },
  "1-4-17": {
    "error": "Не искать узкое место производства и не считать финансовые последствия брака, НЗП и запасов.",
    "conclusion": "Производство управляется мощностью, себестоимостью, качеством, узкими местами и оборотным капиталом."
  },
  "1-4-18": {
    "error": "Считать проект прибыльным по общей смете без этапов, авансов, субподряда и графика оплат.",
    "conclusion": "Проект зарабатывает по этапам, а деньги идут по графику; нужно считать смету, выполнение, WIP и cash gap."
  },
  "1-4-19": {
    "error": "Брать крупные проекты без оценки сметы, перерасхода, авансов, дебиторки и кассового разрыва.",
    "conclusion": "Проектный бизнес требует план-факта по каждому проекту и контроля графика оплат, команды, сроков и расходов."
  },
  "1-4-20": {
    "error": "Оценивать логистику количеством рейсов или оборотом, не считая себестоимость движения ресурса.",
    "conclusion": "Логистика управляется через маржу рейса, ставку, топливо, ремонт, амортизацию, простой, загрузку и пустой пробег."
  },
  "1-4-21": {
    "error": "Не считать, сколько денег приносит единица транспорта с учётом загрузки, топлива, ремонта и дебиторки.",
    "conclusion": "Главный вопрос логистики — доходность ресурса: рейс, машина, километр, простой, себестоимость и сроки оплат."
  },
  "1-4-22": {
    "error": "Оценивать HoReCa только по количеству гостей и среднему чеку.",
    "conclusion": "HoReCa зарабатывает на потоке, чеке, марже, посадке, скорости обслуживания, food cost, labor cost и повторяемости."
  },
  "1-4-23": {
    "error": "Считать полную посадку доказательством прибыльности заведения.",
    "conclusion": "Выручка HoReCa ограничена местом, временем, кухней, меню, списаниями, сезонностью и операционной дисциплиной."
  },
  "1-4-24": {
    "error": "Давать одинаковые управленческие советы салону, магазину и производству при одинаковой выручке.",
    "conclusion": "Одна выручка означает разные двигатели: услуги — загрузка, магазин — товар и маржа, производство — выпуск и себестоимость."
  },
  "1-4-25": {
    "error": "Считать 600 визитов главным успехом салона без анализа часов, ФОТ и повторов.",
    "conclusion": "Салон управляется через выручку на час и визит, загрузку, ФОТ, линейку услуг, отмены и повторные продажи."
  },
  "1-4-26": {
    "error": "Считать 1 000 чеков и 3 000 000 ₽ выручки достаточным диагнозом магазина.",
    "conclusion": "Магазин нужно оценивать через себестоимость товара, валовую прибыль, остатки, скидки, списания и оборачиваемость."
  },
  "1-4-27": {
    "error": "Считать 1 500 единиц выпуска главным показателем производства без себестоимости и узкого места.",
    "conclusion": "Производство нужно анализировать через стоимость выпуска, брак, мощность, НЗП, готовую продукцию и цикл денег."
  },
  "1-4-28": {
    "error": "После сравнения трёх бизнесов всё равно делать один общий вывод: “надо увеличить продажи”.",
    "conclusion": "Решение должно зависеть от двигателя: салону — загрузка и ФОТ, магазину — ассортимент и оборот, производству — себестоимость и узкое место."
  },
  "1-4-29": {
    "error": "Строить отчёты до диагностики единицы продажи, драйверов, маржи, мощности и денежного цикла.",
    "conclusion": "Сначала диагностируется экономический двигатель, затем строятся отчёты, метрики и финансовый помощник."
  },
  "1-4-30": {
    "error": "Следить только за главной метрикой роста и игнорировать смертельную метрику риска.",
    "conclusion": "Сильная система показывает обе метрики: что двигает рост и что может быстро разрушить деньги и прибыль."
  },
  "1-4-31": {
    "error": "Задавать одинаковые вопросы всем видам бизнеса в будущем финансовом помощнике.",
    "conclusion": "Тип бизнеса определяет данные, формы, таблицы, отчёты и рекомендации финансового помощника."
  },
  "1-4-32": {
    "error": "Продолжать смотреть на бизнес абстрактно через выручку, а не через двигатель модели.",
    "conclusion": "Выручка показывает размер, а экономический двигатель показывает логику заработка, ограничение и управленческое решение."
  }
};
  function financeManualCalloutV85(sectionId, lessonId, slideNo, field){
    const key = `${Number(sectionId || 1)}-${Number(lessonId || 1)}-${Number(slideNo || 1)}`;
    const item = FINANCE_SLIDE_CALLOUTS_V85[key];
    return item && item[field] ? item[field] : '';
  }
  function slideError(slide, sectionId, lessonId, slideNo){
    const manual = financeManualCalloutV85(sectionId, lessonId, slideNo, 'error');
    if (manual) return manual;
    const source = `${(slide && slide.title) || ''} ${((slide && slide.text) || []).join(' ')}`.toLowerCase();
    const title = normalizeFinanceText((slide && slide.title) || '');

    if (source.includes('одинаковая выручка')) return 'Сравнивать бизнесы только по выручке и не видеть разные процессы, маржу, остатки, мощность и риски.';
    if (source.includes('экономический двигатель')) return 'Описывать бизнес общими словами и не выделять механизм, который превращает деятельность в прибыль и деньги.';
    if (source.includes('смертельная метрик')) return 'Следить за красивой главной метрикой и игнорировать показатель, который может быстро разрушить модель.';
    if (source.includes('главная метрик')) return 'Выбирать метрики по привычке, а не по реальному двигателю и ограничению конкретной модели.';
    if (source.includes('диагностик')) return 'Строить отчёты до понимания единицы продажи, драйверов, маржи, мощности и денежного цикла.';
    if (source.includes('horeca') || source.includes('food cost') || source.includes('labor cost')) return 'Оценивать HoReCa только по потоку гостей и чеку, не проверяя food cost, labor cost, списания, посадку и пиковые часы.';
    if (source.includes('логист')) return 'Оценивать логистику по обороту или количеству рейсов, не считая маржу рейса, пустой пробег, простой, топливо и дебиторку.';
    if (source.includes('проект')) return 'Считать проект прибыльным только по смете и не проверять этапы, авансы, перерасход, дебиторку и cash gap.';
    if (source.includes('производств')) return 'Смотреть только на выпуск или выручку производства, не считая себестоимость, брак, узкое место, НЗП и цикл денег.';
    if (source.includes('торговл') || source.includes('sku') || source.includes('товар')) return 'Оценивать торговлю по обороту, не проверяя валовую маржу, SKU, скидки, списания, остатки и оборачиваемость.';
    if (source.includes('услуг') || source.includes('специалист') || source.includes('визит')) return 'Оценивать услуги только по выручке, не проверяя часы, загрузку, выручку на час, ФОТ, отмены и повторы.';
    if (source.includes('повторн')) return 'Покупать новый поток клиентов каждый месяц и не считать повторяемость как отдельный двигатель устойчивости.';
    if (source.includes('огранич')) return 'Усиливать рост без поиска реального ограничения: спроса, маржи, мощности, оборотного капитала, людей или качества.';
    if (source.includes('мощност') || source.includes('загрузк')) return 'Гнать продажи выше физической мощности и не считать, сколько бизнес реально может выполнить без потери качества и маржи.';
    if (source.includes('марж')) return 'Радоваться высокой выручке и не считать, сколько остаётся после прямых затрат и выполнения обещания клиенту.';
    if (source.includes('рабочий капитал') || source.includes('остатк')) return 'Смотреть на прибыль и не видеть, что деньги застряли в дебиторке, запасах, авансах или обязательствах.';
    if (source.includes('баланс')) return 'Считать баланс бухгалтерской формальностью и не использовать его для объяснения активов, обязательств и капитала.';
    if (source.includes('ддс') || source.includes('денежн') || source.includes('кассов')) return 'Считать прибыль достаточной для управления деньгами и не проверять поступления, платежи, резервы и кассовые риски.';
    if (source.includes('опиу') || source.includes('прибыл')) return 'Путать прибыльность периода с наличием денег на счёте и не сверять ОПиУ с ДДС и балансом.';
    if (source.includes('бухгалтер')) return 'Требовать от бухгалтерии управленческую диагностику, для которой нужны другие разрезы, скорость и правила.';
    if (source.includes('налог')) return 'Оценивать здоровье бизнеса по налоговой базе или налогу к уплате, подменяя управленческий диагноз налоговой логикой.';
    if (source.includes('управленческ')) return 'Называть любую таблицу управленческой системой без правил ввода, классификации, отчётов, сверок и решений.';
    if (source.includes('аванс')) return 'Считать полученный аванс свободной выручкой или прибылью и не видеть обязательство перед клиентом.';
    if (source.includes('кредит')) return 'Называть кредит доходом и принимать рост денег на счёте за заработок бизнеса.';
    if (source.includes('дебитор')) return 'Считать признанную выручку деньгами, хотя клиент ещё не оплатил и деньги находятся в дебиторке.';
    if (source.includes('оборуд') || source.includes('актив')) return 'Списывать долгосрочный актив как обычный расход одного месяца и искажать прибыль периода.';
    if (source.includes('выруч')) return 'Путать факт продажи, факт передачи ценности и факт оплаты клиентом.';

    const fromText = financeFindSentenceV84(slide, ['ошиб', 'опас', 'нельзя', 'не должен', 'не является', 'не означает', 'не показывает', 'не рав', 'не совпад', 'искаж', 'иллюзи']);
    if (fromText) return fromText;
    return `Делать вывод по теме «${financeShortTextV84(title, 80)}» без проверки связей, ограничений и последствий для решений.`;
  }
  function slideConclusion(slide, sectionId, lessonId, slideNo){
    const manual = financeManualCalloutV85(sectionId, lessonId, slideNo, 'conclusion');
    if (manual) return manual;
    const source = `${(slide && slide.title) || ''} ${((slide && slide.text) || []).join(' ')}`.toLowerCase();

    if (source.includes('одинаковая выручка')) return 'Выручка показывает масштаб, но не объясняет экономику: нужно сравнивать драйверы, маржу, ограничения, остатки и риски модели.';
    if (source.includes('экономический двигатель')) return 'Экономический двигатель показывает, за счёт чего конкретная модель создаёт прибыль, деньги и управленческие ограничения.';
    if (source.includes('смертельная метрик')) return 'В системе нужно регулярно видеть не только главную метрику роста, но и смертельную метрику риска.';
    if (source.includes('главная метрик')) return 'Главная метрика выбирается из логики модели, а смертельная — из того, что быстрее всего разрушает деньги и прибыль.';
    if (source.includes('диагностик')) return 'Сначала диагностируется модель: единица продажи, драйверы, маржа, мощность, денежный цикл и ограничение; затем строятся отчёты.';
    if (source.includes('horeca') || source.includes('food cost') || source.includes('labor cost')) return 'HoReCa управляется через поток гостей, средний чек, посадку, скорость обслуживания, food cost, labor cost, списания и сезонность.';
    if (source.includes('логист')) return 'Логистика управляется через загрузку ресурса, себестоимость рейса или километра, пустой пробег, техническую готовность и сроки оплат.';
    if (source.includes('проект')) return 'Проектный бизнес нужно читать по смете, этапам, авансам, план-факту, cash gap и загрузке команды.';
    if (source.includes('производств')) return 'Производство управляется через мощность, себестоимость, выпуск, брак, узкое место, НЗП и оборотный капитал.';
    if (source.includes('торговл') || source.includes('sku') || source.includes('товар')) return 'Торговля управляется через валовую маржу, ассортимент, SKU, скидки, списания, остатки и скорость оборота товара.';
    if (source.includes('услуг') || source.includes('специалист') || source.includes('визит')) return 'Услуги управляются через часы специалистов, загрузку, выручку на час, ФОТ, средний чек, отмены и повторные визиты.';
    if (source.includes('повторн')) return 'Повторяемость снижает зависимость от постоянного привлечения и делает выручку более устойчивой.';
    if (source.includes('огранич')) return 'Правильное решение начинается с поиска ограничения модели, а не с общего требования “увеличить продажи”.';
    if (source.includes('мощност') || source.includes('загрузк')) return 'Мощность задаёт потолок выручки: нужно управлять доступным ресурсом, загрузкой, узкими местами и качеством выполнения.';
    if (source.includes('марж')) return 'Маржа показывает, сколько бизнес оставляет себе после прямых затрат и выполнения обещания клиенту.';
    if (source.includes('рабочий капитал') || source.includes('остатк')) return 'Остатки и рабочий капитал объясняют, где прибыль расходится с деньгами и почему касса может быть слабой.';
    if (source.includes('баланс')) return 'Баланс показывает состояние бизнеса: активы, обязательства, капитал и последствия операций на дату.';
    if (source.includes('ддс') || source.includes('денежн') || source.includes('кассов')) return 'ДДС нужен для управления платёжеспособностью: поступлениями, платежами, резервом, дебиторкой и кассовыми рисками.';
    if (source.includes('опиу') || source.includes('прибыл')) return 'ОПиУ показывает экономический результат периода, но его нужно читать вместе с ДДС и балансом.';
    if (source.includes('бухгалтер')) return 'Бухгалтерия даёт дисциплину и факты, управленка превращает факты в систему решений собственника.';
    if (source.includes('налог')) return 'Налоговый контур нужен для обязательств перед государством, а управленческий — для диагностики бизнеса и решений.';
    if (source.includes('управленческ')) return 'Управленческая система должна связывать ввод данных, классификацию, отчёты, сверки, метрики, план-факт, прогноз и решения.';
    if (source.includes('аванс')) return 'Авансы нужно отдельно видеть в деньгах и обязательствах, а выручку признавать по мере выполнения обещания клиенту.';
    if (source.includes('кредит')) return 'Кредит читается через финансовый поток, долг, проценты и будущую платёжную нагрузку.';
    if (source.includes('дебитор')) return 'Дебиторка объясняет ситуацию, когда бизнес заработал, но деньги ещё не пришли.';
    if (source.includes('оборуд') || source.includes('актив')) return 'Крупная покупка разделяется на платёж в ДДС, актив в балансе и амортизацию в ОПиУ.';
    if (source.includes('выруч')) return 'Выручку нужно связывать с передачей ценности клиенту, а не только с фактом поступления денег.';

    return financeLastMeaningSentenceV84(slide);
  }
  function financeSlideImagePathV83(sectionId, lessonId, slideNo){
    const s = String(Number(sectionId || 1)).padStart(2, '0');
    const l = String(Number(lessonId || 1)).padStart(2, '0');
    const n = String(Number(slideNo || 1)).padStart(2, '0');
    return `assets/finance/section_${s}/lesson_${l}/s${s}_l${l}_slide_${n}.png`;
  }
  function financeSlideImageHtmlV83(sectionId, lessonId, slideNo, title){
    const path = financeSlideImagePathV83(sectionId, lessonId, slideNo);
    const alt = `Раздел ${sectionId}, урок ${lessonId}, слайд ${slideNo}: ${title || ''}`;
    return `<div class="finance-slide-image-v83" data-path="${fEsc(path)}"><img src="${fEsc(path)}?v=${APP_CACHE_VERSION}" alt="${fEsc(alt)}" loading="lazy" onerror="this.closest('.finance-slide-image-v83').classList.add('is-missing'); this.remove();"><div class="finance-slide-image-fallback-v83"><b>Изображение не найдено</b><p>${fEsc(path)}</p></div></div>`;
  }
  function slideHtml(slide, number, totalSlides, index, totalScreens, sectionId, lessonId){
    const paragraphs = (slide.text || []).map(p => `<p>${fEsc(p)}</p>`).join('') || '<p>Текст слайда будет добавлен после редакторской проверки.</p>';
    const img = financeSlideImageHtmlV83(sectionId, lessonId, number, slide.title);
    return fCard('finance-slide-card-v77 finance-slide-card-v83', `<p class="eyebrow">слайд ${number} из ${totalSlides}</p><h1>${fEsc(slide.title)}</h1>${img}<div class="finance-main-thought-v77 finance-main-thought-v83"><span>Главная мысль</span><p>${fEsc(slideMainThought(slide))}</p></div><div class="finance-slide-body-v77 finance-slide-body-v83"><h2>Объяснение</h2>${paragraphs}</div><div class="finance-callouts-v77 finance-callouts-v83"><div><span>Типовая ошибка</span><p>${fEsc(slideError(slide, sectionId, lessonId, number))}</p></div><div><span>Управленческий вывод</span><p>${fEsc(slideConclusion(slide, sectionId, lessonId, number))}</p></div></div><p class="small finance-screen-counter-v83">Экран ${index + 1} из ${totalScreens}</p>`);
  }
  function finalHtml(lesson, parsed, index, total){
    const lines = parsed.finalLines && parsed.finalLines.length ? parsed.finalLines : [normalizeFinanceText(lesson.result || 'Итоговая логика урока закрепляет главный управленческий вывод.')];
    return `${fCard('blue-card-v2 finance-final-card-v77', `<p class="eyebrow">итоговая логика</p><h1>Итоговая логика урока</h1><p>Финальный смысловой вывод по теме.</p>`)}${fCard('', `<div class="finance-slide-body-v77">${lines.map(x => `<p>${fEsc(x)}</p>`).join('')}</div><p class="small">Экран ${index + 1} из ${total}</p>`)}`;
  }
  function lessonNav(sectionId, lessonId, index, total){
    const prevDisabled = index <= 0 ? 'disabled' : '';
    const isLast = index >= total - 1;
    const prev = `renderFinanceLessonV77(${sectionId}, ${lessonId}, ${Math.max(0, index - 1)})`;
    const next = isLast ? `renderFinanceSectionV77(${sectionId})` : `renderFinanceLessonV77(${sectionId}, ${lessonId}, ${index + 1})`;
    return `<div class="nav-panel-v2 nav-panel-v2-three finance-lesson-nav-v77"><button class="btn secondary" onclick="renderFinanceSectionV77(${sectionId})">К разделу</button><button class="btn secondary" ${prevDisabled} onclick="${prev}">Назад</button><button class="btn primary" onclick="${next}">${isLast ? 'К урокам' : 'Далее'}</button></div>`;
  }

  function sectionCard(sec){
    const id = Number(sec.id);
    const open = fSectionOpen(id);
    const count = (sec.lessons || []).length + (id === 1 ? 2 : 0);
    const status = open ? (id === 1 ? 'доступно' : 'открыто') : 'закрыто';
    return `<button class="lesson-row-v2 finance-section-row-v77 ${open ? '' : 'locked'}" onclick="${open ? `renderFinanceSectionV77(${id})` : `financeLockedSectionNoticeV77(${id})`}"><div><b>${String(id).padStart(2,'0')}. ${fEsc(sec.title)}</b><p>${fEsc(sec.description || '')}</p><p class="small">${count} блоков · ${status}</p></div><span>${open ? '→' : '🔒'}</span></button>`;
  }
  function renderFinancialAssistantV77(){
    fShell(`${fCard('blue-card-v2 finance-hero-v77', `<p class="eyebrow">финансовый помощник</p><h1>Финансовый помощник</h1><p>Рабочая зона финансового контура приложения.</p>`)}${fCard('', `<h2>Выберите блок</h2><div class="finance-hub-grid-v49"><button class="finance-hub-card-v49 active" type="button" onclick="renderFinanceModuleHomeV77()"><b>Финансовый модуль</b><p>11 разделов финансовой архитектуры бизнеса.</p><em>открыть</em></button><button class="finance-hub-card-v49 is-locked-finance" type="button" disabled aria-disabled="true" title="Раздел пока закрыт"><b>Моя аналитика</b><p>Будущий контур личных показателей и управленческих выводов.</p><em>закрыто</em></button><button class="finance-hub-card-v49 is-locked-finance" type="button" disabled aria-disabled="true" title="Скоро"><b>Готовые шаблоны</b><p>Библиотека таблиц и финансовых инструментов появится позже.</p><em>скоро</em></button></div><button class="btn secondary" onclick="renderHome()">← На главную</button>`)}`, 'finance');
  }
  function renderFinanceModuleHomeV77(){
    if (!fRequireAdmin()) return;
    fShell(`${fCard('blue-card-v2 finance-hero-v77', `<p class="eyebrow">финансовый модуль</p><h1>Финансовый модуль</h1><p>Выберите раздел.</p>`)}${fCard('', `<div class="finance-toolbar-v49"><button class="btn secondary" onclick="renderFinancialAssistantV77()">← К финансовому помощнику</button></div><h2>11 разделов</h2><div class="lesson-list-v2 finance-section-list-v77">${FINANCE_MODULE_SECTIONS_V77.map(sectionCard).join('')}</div>`)}`, 'finance');
  }
  function financeLockedSectionNoticeV77(id){ alert(id === 2 ? 'Раздел 2 откроется после итоговой диагностики раздела 1 минимум на 80%.' : 'Этот раздел откроется после прохождения диагностики предыдущего раздела.'); }
  function lessonRow(sec, les){
    let slideCount = 0;
    try {
      const parsed = parseFinanceLessonFullContent(les || {});
      slideCount = (parsed && parsed.slides && parsed.slides.length) ? parsed.slides.length : 0;
    } catch(e) { slideCount = 0; }
    const note = slideCount ? `${slideCount} слайдов` : '';
    return `<button class="lesson-row-v2 finance-lesson-row-v77" onclick="renderFinanceLessonV77(${Number(sec.id)}, ${Number(les.id)}, 0)"><div><b>${String(les.id).padStart(2,'0')}. ${fEsc(les.title)}</b>${note ? `<p>${fEsc(note)}</p>` : ''}</div><span>→</span></button>`;
  }
  function renderFinanceSectionV77(id){
    if (!fRequireAdmin()) return;
    id = Number(id || 1);
    if (!fSectionOpen(id)) return financeLockedSectionNoticeV77(id);
    const sec = fSection(id) || FINANCE_MODULE_SECTIONS_V77[0];
    const rows = fAllLessonRows(sec).map(les => lessonRow(sec, les)).join('');
    const extras = id === 1 ? `<button class="lesson-row-v2 finance-test-row-v77" onclick="startFinanceSection1TestV77(true)"><div><b>Итоговая диагностика раздела 1</b><p>${FINANCE_SECTION1_TEST_V77.length} вопросов · проходной уровень 80%</p></div><span>→</span></button><button class="lesson-row-v2 finance-trainer-row-v77" onclick="renderFinanceTrainerSection1V77()"><div><b>Финтренажёр раздела 1</b><p>Таблица для закрепления материала первого раздела.</p></div><span>→</span></button>` : '';
    fShell(`${fCard('blue-card-v2 finance-section-hero-v77', `<p class="eyebrow">раздел ${id}</p><h1>${fEsc(sec.title)}</h1><p>${fEsc(sec.description || '')}</p>`)}${fCard('', `<div class="finance-toolbar-v49"><button class="btn secondary" onclick="renderFinanceModuleHomeV77()">← К разделам</button></div><h2>Уроки и закрепление</h2><div class="lesson-list-v2 finance-lesson-list-v77">${rows}${extras}</div>`)}`, 'finance');
  }
  function renderFinanceLessonV77(sectionId, lessonId, screenIndex){
    if (!fRequireAdmin()) return;
    const lesson = fLesson(sectionId, lessonId);
    if (!lesson) return renderFinanceSectionV77(sectionId || 1);
    const parsed = parseLessonScreens(lesson);
    const hasFull = Array.isArray(lesson.fullContent) && lesson.fullContent.length;
    if (!hasFull) {
      fShell(`${fCard('blue-card-v2 finance-section-hero-v77', `<p class="eyebrow">раздел ${sectionId} · урок ${lessonId}</p><h1>${fEsc(lesson.title)}</h1><p>${fEsc(normalizeFinanceText(lesson.objective || ''))}</p>`)}${fCard('', `<div class="finance-toolbar-v49"><button class="btn secondary" onclick="renderFinanceSectionV77(${sectionId})">← К разделу</button></div><div class="finance-summary-grid-v49"><div><span>Задача</span><p>${fEsc(normalizeFinanceText(lesson.objective || 'Будет раскрыто позже.'))}</p></div><div><span>Содержание</span><p>${fEsc(normalizeFinanceText(lesson.content || 'Будет раскрыто позже.'))}</p></div><div><span>Кейс</span><p>${fEsc(normalizeFinanceText(lesson.case || 'Будет раскрыто позже.'))}</p></div><div><span>Основной вывод</span><p>${fEsc(normalizeFinanceText(lesson.result || 'Будет раскрыто позже.'))}</p></div></div>`)}`, 'finance');
      return;
    }
    const screens = [{type:'title'}].concat((parsed.slides || []).map((slide, i) => ({type:'slide', slide, i})), [{type:'final'}]);
    const total = screens.length;
    const index = Math.max(0, Math.min(Number(screenIndex || 0), total - 1));
    const current = screens[index];
    let body = '';
    if (current.type === 'title') body = titleScreenHtml(lesson, parsed, total);
    if (current.type === 'slide') body = slideHtml(current.slide, current.i + 1, parsed.slides.length, index, total, sectionId, lessonId);
    if (current.type === 'final') body = finalHtml(lesson, parsed, index, total);
    fShell(`${lessonNav(sectionId, lessonId, index, total)}${body}`, 'finance');
  }
  function renderFinanceTrainerSection1V77(){
    if (!fRequireAdmin()) return;
    const url = FINANCE_TRAINER_SECTION1_URL_V77;
    fShell(`${fCard('blue-card-v2 finance-trainer-hero-v77', `<p class="eyebrow">раздел 1 · практика</p><h1>Финтренажёр раздела 1</h1><p>Таблица для закрепления материала первого раздела.</p>`)}${fCard('', `<div class="finance-toolbar-v49"><button class="btn secondary" onclick="renderFinanceSectionV77(1)">← К разделу 1</button></div><h2>Как пройти</h2><div class="list-clean"><div><b>1. Открыть таблицу</b><p>Нажмите кнопку ниже и перейдите в Google Таблицы.</p></div><div><b>2. Сохранить себе рабочую версию</b><p>В Google Таблицах создайте копию через меню <b>Файл → Создать копию</b>.</p></div><div><b>3. Пройти задания</b><p>Следуйте инструкции внутри таблицы и выполняйте тренажёр по материалу первого раздела.</p></div></div><a class="btn primary" href="${url}" target="_blank" rel="noopener">Открыть финтренажёр</a><button class="btn secondary" onclick="renderFinanceSectionV77(1)">← Вернуться к урокам раздела</button>`)}`, 'finance');
  }
  function startFinanceSection1TestV77(reset){ if (!fRequireAdmin()) return; state.financeV77Index = 0; state.financeV77Answers = reset ? {} : (state.financeV77Answers || {}); renderFinanceTestQuestionV77(); }
  function renderFinanceTestQuestionV77(){
    if (!fRequireAdmin()) return;
    const index = Math.max(0, Math.min(Number(state.financeV77Index || 0), FINANCE_SECTION1_TEST_V77.length - 1));
    state.financeV77Index = index;
    const q = FINANCE_SECTION1_TEST_V77[index];
    const selected = state.financeV77Answers ? state.financeV77Answers[index] : undefined;
    const options = (q.options || []).map((option, i) => `<button class="option-v2 ${Number(selected) === i ? 'selected' : ''}" onclick="selectFinanceTestAnswerV77(${i})">${String.fromCharCode(65+i)}. ${fEsc(option)}</button>`).join('');
    const caseHtml = q.case ? `<div class="finance-question-case-v77">${fEsc(q.case)}</div>` : '';
    fShell(`${fCard('quiz-card-v2 finance-quiz-card-v77', `<div class="finance-toolbar-v49"><button class="btn secondary" onclick="renderFinanceSectionV77(1)">← К разделу 1</button></div><p class="eyebrow">итоговая диагностика · вопрос ${index + 1}/${FINANCE_SECTION1_TEST_V77.length}</p>${caseHtml}<h1>${fEsc(q.q)}</h1><p class="small">Выберите один вариант ответа.</p>${options}`)}`, 'finance');
  }
  function selectFinanceTestAnswerV77(i){
    state.financeV77Answers = state.financeV77Answers || {};
    state.financeV77Answers[state.financeV77Index || 0] = Number(i);
    if (Number(state.financeV77Index || 0) < FINANCE_SECTION1_TEST_V77.length - 1) { state.financeV77Index = Number(state.financeV77Index || 0) + 1; renderFinanceTestQuestionV77(); }
    else finishFinanceSection1TestV77();
  }
  function finishFinanceSection1TestV77(){
    const answers = state.financeV77Answers || {};
    let score = 0, critical = 0;
    FINANCE_SECTION1_TEST_V77.forEach((q, i) => { const ok = Number(answers[i]) === Number(q.correct); if (ok) score++; else if (q.critical) critical++; });
    const passed = score >= FINANCE_SECTION1_PASS_SCORE_V77;
    fSaveProgress({ section1TestScore: score, section1TestTotal: FINANCE_SECTION1_TEST_V77.length, section1TestPassed: passed, section1CriticalErrors: critical });
    fShell(`${fCard(passed ? 'result-ok-v2' : 'result-bad-v2', `<h1>${passed ? 'Диагностика пройдена' : 'Диагностика не пройдена'}</h1><p>Результат: <b>${score}/${FINANCE_SECTION1_TEST_V77.length}</b>. Проходной уровень: <b>${FINANCE_SECTION1_PASS_SCORE_V77}/${FINANCE_SECTION1_TEST_V77.length}</b>.</p><p>Критических ошибок: <b>${critical}</b>.</p><p>${passed ? 'Раздел 2 открыт внутри финансового модуля.' : 'Результат ниже 80%. Повторите уроки и пройдите диагностику заново.'}</p><div class="grid-v2"><button class="btn primary" onclick="${passed ? 'renderFinanceModuleHomeV77()' : 'startFinanceSection1TestV77(true)'}">${passed ? 'К финансовому модулю' : 'Пройти заново'}</button><button class="btn secondary" onclick="renderFinanceSectionV77(1)">К разделу 1</button></div>`)}`, 'finance');
  }
  function renderFinanceAnalyticsV77(){ alert('Моя аналитика пока закрыта. Раздел нельзя открыть на текущем этапе.'); renderFinancialAssistantV77(); }
  function renderFinanceTemplatesV77(){ alert('Готовые шаблоны скоро появятся. Раздел пока нельзя открыть.'); renderFinancialAssistantV77(); }

  function financeHomeCardV77(){
    return renderMainBlockCard('Финансовый помощник','Финансовый модуль, аналитика и готовые шаблоны.', 'доступно', 'renderFinancialAssistantV77()', 'active compact-card finance-home-card-v77');
  }
  const secondaryBeforeFinanceV77 = window.secondaryBlocksHtmlV40;
  window.secondaryBlocksHtmlV40 = function(){
    const base = typeof secondaryBeforeFinanceV77 === 'function' ? secondaryBeforeFinanceV77() : '<div class="secondary-track-grid-v22 architecture-secondary-tracks-v40"></div>';
    if (base.indexOf('finance-home-card-v77') !== -1 || base.indexOf('Финансовый помощник') !== -1) return base;
    return base.replace(/(<div[^>]*architecture-secondary-tracks-v40[^>]*>)/, '$1' + financeHomeCardV77());
  };
  window.myBusinessCardHtml = function(){
    return fCard('my-business-card', `<p class="eyebrow">мой бизнес</p><h2>Финансовый помощник</h2><p>Финансовый модуль, аналитика и готовые шаблоны.</p><button class="btn primary" onclick="renderFinancialAssistantV77()">Открыть финансовый помощник</button>`);
  };

  // v81: inline onclick ищет функции в window, поэтому прямые V77-имена должны быть глобальными.
  window.renderFinancialAssistantV77 = renderFinancialAssistantV77;
  window.renderFinanceModuleHomeV77 = renderFinanceModuleHomeV77;
  window.renderFinanceSectionV77 = renderFinanceSectionV77;
  window.renderFinanceLessonV77 = renderFinanceLessonV77;
  window.renderFinanceTrainerSection1V77 = renderFinanceTrainerSection1V77;
  window.startFinanceSection1TestV77 = startFinanceSection1TestV77;
  window.renderFinanceTestQuestionV77 = renderFinanceTestQuestionV77;
  window.selectFinanceTestAnswerV77 = selectFinanceTestAnswerV77;
  window.finishFinanceSection1TestV77 = finishFinanceSection1TestV77;
  window.renderFinanceAnalyticsV77 = renderFinanceAnalyticsV77;
  window.renderFinanceTemplatesV77 = renderFinanceTemplatesV77;
  window.financeLockedSectionNoticeV77 = financeLockedSectionNoticeV77;

  window.renderFinancialAssistant = window.renderMyBusiness = renderFinancialAssistantV77;
  window.renderFinanceModuleHome = renderFinanceModuleHomeV77;
  window.renderFinanceSection = renderFinanceSectionV77;
  window.renderFinanceLesson = renderFinanceLessonV77;
  window.renderFinanceTrainerSection1 = renderFinanceTrainerSection1V77;
  window.startFinanceSection1Test = startFinanceSection1TestV77;
  window.renderFinanceTestQuestion = renderFinanceTestQuestionV77;
  window.selectFinanceTestAnswer = selectFinanceTestAnswerV77;
  window.finishFinanceSection1Test = finishFinanceSection1TestV77;
  window.renderFinanceAnalytics = renderFinanceAnalyticsV77;
  window.renderFinanceTemplates = renderFinanceTemplatesV77;
  window.financeLockedSectionNotice = financeLockedSectionNoticeV77;
})();



/* =====================================================
   v81 — финальный фикс навигации финансового помощника
   Исправляет ReferenceError renderFinancialAssistantV77 и доступ из нижнего/бокового меню.
   ===================================================== */
(function installFinanceV81NavigationFix(){
  window.APP_UI_VERSION_V81 = 'v86-finance-student-open-manual-callouts-20260629';

  function hasAccessV81(){
    return !(typeof hasVerifiedAccessV32 === 'function') || hasVerifiedAccessV32();
  }
  function adminModeV81(){
    return typeof isAdminMode === 'function' && isAdminMode();
  }
  function escV81(value){
    if (typeof esc === 'function') return esc(value);
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]); });
  }
  function financeIconV81(){
    return `<span class="arch-nav-icon"><svg class="arch-nav-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/><path d="m4 7 5-3 5 5 6-6"/></svg></span>`;
  }

  window.openFinanceAssistantV81 = function(){
    if (!hasAccessV81()) {
      if (typeof accessDenied === 'function') accessDenied('OPEN_FROM_TELEGRAM_REQUIRED');
      return;
    }
    if (typeof window.renderFinancialAssistantV77 === 'function') return window.renderFinancialAssistantV77();
    if (typeof window.renderFinancialAssistant === 'function') return window.renderFinancialAssistant();
    alert('Финансовый помощник не загрузился. Обновите приложение.');
  };

  window.bottomNav = function(active){
    if (!hasAccessV81()) return '';
    const homeIcon = typeof architectureNavIconV35 === 'function' ? `<span class="arch-nav-icon">${architectureNavIconV35('home')}</span>` : '<span>⌂</span>';
    const profileIcon = typeof architectureNavIconV35 === 'function' ? `<span class="arch-nav-icon">${architectureNavIconV35('profile')}</span>` : '<span>○</span>';
    const financeIcon = financeIconV81();
    function navItem(key,label,fn,icon){
      return `<button class="bottom-item ${active===key?'active':''}" onclick="safeNavigateV32('${fn}')">${icon}<b>${escV81(label)}</b></button>`;
    }
    const financeButton = `<button class="bottom-item ${active==='finance'?'active':''}" onclick="openFinanceAssistantV81()">${financeIcon}<b>Финансовый помощник</b></button>`;
    return `<nav class="bottom-nav-v2 bottom-nav-v2-three v41-bottom-nav finance-bottom-nav-v81 finance-bottom-nav-v83" aria-label="Основное меню">
      ${navItem('home','Главная','renderHome',homeIcon)}
      ${financeButton}
      ${navItem('profile','Профиль','renderProfile',profileIcon)}
    </nav>`;
  };

  function mainCardV81(title, text, status, action, cls){
    if (typeof renderMainBlockCard === 'function') return renderMainBlockCard(title, text, status, action, cls);
    const clickable = Boolean(action);
    return `<button class="track-card ${cls || ''} ${clickable ? '' : 'disabled'}" ${clickable ? `onclick="${action}"` : 'disabled'}><b>${escV81(title)}</b><p>${escV81(text)}</p><em>${escV81(status)}</em></button>`;
  }
  function financeHomeCardV81(){
    return mainCardV81('Финансовый помощник','Финансовый модуль, аналитика и готовые шаблоны.', 'доступно', 'openFinanceAssistantV81()', 'active main-block-card v40-primary-card finance-home-card-v81');
  }
  window.primaryRoutesHtmlV40 = function(){
    return `<div class="top-track-grid architecture-main-tracks-v40 architecture-main-tracks-finance-v81">
      ${mainCardV81('Я предприниматель','Архитектуры управления по шести видам бизнеса: системы, схемы, тесты, конспекты и рабочие шаблоны.','доступно','renderLearning()','active main-block-card v40-primary-card')}
      ${mainCardV81('Нет своего бизнеса','Системы подготовки к запуску: выбор модели, проверка идеи, экономика и первые управленческие решения.','скоро','renderNoBusinessV40()','soon main-block-card v40-primary-card')}
      ${mainCardV81('Я сотрудник','Материалы для руководителей, управляющих и ключевых сотрудников: процессы, ответственность и показатели.','скоро','renderEmployeeRouteV40()','soon main-block-card v40-primary-card')}
      ${financeHomeCardV81()}
    </div>`;
  };
  window.secondaryBlocksHtmlV40 = function(){
    const forumReady = Boolean(typeof forumVisibleInNavigationV38 === 'function' && forumVisibleInNavigationV38() && typeof window.renderBusinessForum === 'function');
    const forumStatus = forumReady ? (adminModeV81() ? 'тестирование' : 'доступно') : 'в подготовке';
    const forumClass = forumReady ? 'active' : 'soon';
    return `<div class="secondary-track-grid-v22 architecture-secondary-tracks-v40">
      ${mainCardV81('Бизнес-форум','Вопросы по системам, обсуждение практических ситуаций и обмен опытом участников.',forumStatus,'openForumBlockV40()',forumClass + ' compact-card')}
      ${mainCardV81('100 книг за 100 дней','Ежедневная книга, конспект, мини-тест, единицы освоения и серия баллов.','доступно','renderBookChallenge()','active books100-entry compact-card')}
      ${mainCardV81('Газета','Новости бизнеса и приложения в формате цифровых газетных выпусков.','скоро','renderNewspaperV40()','soon compact-card')}
      ${mainCardV81('Предпринимательские статьи','Практические статьи о ситуациях, цифрах, решениях и последствиях.','скоро','renderEntrepreneurArticlesV40()','soon compact-card')}
      ${mainCardV81('Прямые разборы','Гарвардские и другие бизнес-кейсы с разбором вариантов решения.','скоро','renderDirectReviewsV40()','soon compact-card')}
      ${mainCardV81('Что посмотреть','Фильмы, интервью, лекции и видео с управленческими выводами.','скоро','renderWatchV40()','soon compact-card')}
      ${mainCardV81('Дополнительные материалы','Шаблоны, инструкции, документы и инструменты вне основных направлений.','скоро','renderAdditionalMaterials()','soon compact-card')}
      ${mainCardV81('VIP уровень','Расширенные разборы, инструменты и закрытые возможности.','в разработке','renderVipV40()','soon compact-card')}
    </div>`;
  };

  function ensureFinanceDrawerItemV81(){
    const list = document.querySelector('.app-drawer-list-v40');
    if (!list) return;
    Array.from(list.querySelectorAll(':scope > button')).forEach(function(button){
      const title = button.querySelector('b');
      if (title && title.textContent.trim() === 'Финансовый помощник') button.remove();
    });
    const btn = document.createElement('button');
    btn.className = 'drawer-finance-v81';
    btn.setAttribute('onclick', 'closeAppDrawerV40(); openFinanceAssistantV81()');
    btn.innerHTML = `<span class="app-drawer-number-v40">00</span><span class="app-drawer-copy-v40"><b>Финансовый помощник</b><small>доступно</small></span><span class="app-drawer-arrow-v40">›</span>`;
    list.appendChild(btn);
    Array.from(list.querySelectorAll(':scope > button')).forEach(function(button, index){
      const num = button.querySelector('.app-drawer-number-v40');
      if (num) num.textContent = String(index + 1).padStart(2, '0');
    });
  }
  window.ensureFinanceDrawerItemV81 = ensureFinanceDrawerItemV81;

  const installDrawerBeforeV81 = window.installAppDrawerV40;
  if (typeof installDrawerBeforeV81 === 'function') {
    window.installAppDrawerV40 = function(){
      const result = installDrawerBeforeV81.apply(this, arguments);
      setTimeout(ensureFinanceDrawerItemV81, 0);
      setTimeout(ensureFinanceDrawerItemV81, 100);
      return result;
    };
  }
  const openDrawerBeforeV81 = window.openAppDrawerV40;
  if (typeof openDrawerBeforeV81 === 'function') {
    window.openAppDrawerV40 = function(){
      const result = openDrawerBeforeV81.apply(this, arguments);
      setTimeout(ensureFinanceDrawerItemV81, 0);
      setTimeout(ensureFinanceDrawerItemV81, 100);
      return result;
    };
  }
  const shellBeforeFinanceV81 = window.shell;
  if (typeof shellBeforeFinanceV81 === 'function') {
    window.shell = function(content, activeTab){
      const result = shellBeforeFinanceV81.apply(this, arguments);
      setTimeout(ensureFinanceDrawerItemV81, 80);
      return result;
    };
  }
  window.myBusinessCardHtml = function(){
    return card('my-business-card', `<p class="eyebrow">мой бизнес</p><h2>Финансовый помощник</h2><p>Финансовый модуль, аналитика и готовые шаблоны.</p><button class="btn primary" onclick="openFinanceAssistantV81()">Открыть финансовый помощник</button>`);
  };
})();

/* =====================================================
   v82 — final drawer binding for financial assistant
   ===================================================== */
(function installFinanceDrawerV82(){
  window.APP_UI_VERSION_V82 = 'v86-finance-student-open-manual-callouts-20260629';
  function isAdminModeV82(){ return typeof isAdminMode === 'function' && isAdminMode(); }
  function openFinanceV82(){
    if (typeof window.renderFinancialAssistantV77 === 'function') return window.renderFinancialAssistantV77();
    if (typeof window.renderFinancialAssistant === 'function') return window.renderFinancialAssistant();
    alert('Финансовый помощник не загружен. Проверьте замену app.js и index.html.');
  }
  window.openFinanceV82 = openFinanceV82;
  window.openFinanceFromDrawerV82 = function(){
    if (typeof closeAppDrawerV40 === 'function') closeAppDrawerV40();
    return openFinanceV82();
  };
  function injectFinanceDrawerV82(){
    var list = document.querySelector('.app-drawer-list-v40');
    if (!list) return;
    Array.prototype.slice.call(list.querySelectorAll(':scope > button')).forEach(function(btn){
      var title = btn.querySelector('b');
      if (title && title.textContent.trim() === 'Финансовый помощник') btn.remove();
    });
    var btn = document.createElement('button');
    btn.className = 'drawer-finance-v82';
    btn.setAttribute('onclick', 'openFinanceFromDrawerV82()');
    btn.innerHTML = '<span class="app-drawer-number-v40">00</span>'
      + '<span class="app-drawer-copy-v40"><b>Финансовый помощник</b><small>доступно</small></span>'
      + '<span class="app-drawer-arrow-v40">›</span>';
    list.appendChild(btn);
    Array.prototype.slice.call(list.querySelectorAll(':scope > button')).forEach(function(item, i){
      var num = item.querySelector('.app-drawer-number-v40');
      if (num) num.textContent = String(i + 1).padStart(2,'0');
    });
  }
  window.injectFinanceDrawerV82 = injectFinanceDrawerV82;
  var installBeforeV82 = window.installAppDrawerV40;
  if (typeof installBeforeV82 === 'function') {
    window.installAppDrawerV40 = function(){
      var res = installBeforeV82.apply(this, arguments);
      setTimeout(injectFinanceDrawerV82, 0);
      setTimeout(injectFinanceDrawerV82, 120);
      return res;
    };
  }
  var openBeforeV82 = window.openAppDrawerV40;
  if (typeof openBeforeV82 === 'function') {
    window.openAppDrawerV40 = function(){
      var res = openBeforeV82.apply(this, arguments);
      injectFinanceDrawerV82();
      setTimeout(injectFinanceDrawerV82, 120);
      return res;
    };
  }
  var shellBeforeV82 = window.shell;
  if (typeof shellBeforeV82 === 'function') {
    window.shell = shell = function(content, activeTab){
      var res = shellBeforeV82.apply(this, arguments);
      setTimeout(injectFinanceDrawerV82, 120);
      return res;
    };
  }
})();
