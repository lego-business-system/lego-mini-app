
/* =====================================================
   Л.Е.Г.О. — Бизнес-форум v1.2
   Отдельный модуль. Не изменяет логику уроков, ДЗ и прогресса.
   ===================================================== */

const FORUM_API_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/forum-api-v2";

const FORUM_CATEGORIES = [
  { key: "general", label: "Общее" },
  { key: "trade", label: "Торговля" },
  { key: "services", label: "Услуги" },
  { key: "production", label: "Производство" },
  { key: "construction", label: "Строительство и проекты" },
  { key: "logistics", label: "Логистика" },
  { key: "horeca", label: "HoReCa" },
];

const forumState = {
  bootstrap: null,
  category: "general",
  currentTopicId: null,
  currentTopic: null,
  currentReplies: [],
  pendingTopicRequestId: null,
  pendingReplyRequestId: null,
  timerId: null,
};

class ForumApiError extends Error {
  constructor(result, status) {
    super(result?.message || forumReasonText(result?.reason) || "Операция не выполнена.");
    this.name = "ForumApiError";
    this.result = result || {};
    this.status = status || 0;
  }
}

function forumEsc(value) {
  if (typeof esc === "function") return esc(value);
  return String(value ?? "").replace(/[&<>'"]/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char];
  });
}

function forumTextHtml(value) {
  return forumEsc(value).replace(/\n/g, "<br>");
}

function forumUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function forumReasonText(reason) {
  const messages = {
    NO_INIT_DATA: "Откройте приложение заново из Telegram.",
    INIT_DATA_EXPIRED: "Срок Telegram-проверки истёк. Закройте приложение и откройте его заново из Telegram.",
    INVALID_TELEGRAM_SIGNATURE: "Telegram-проверка не пройдена. Откройте приложение заново.",
    NOT_CHANNEL_MEMBER: "Бизнес-форум доступен только участникам закрытого канала.",
    APP_ACCESS_DENIED: "Доступ к приложению не подтверждён.",
    FORUM_DISABLED: "Бизнес-форум пока выключен для учеников.",
    FORUM_BETA_ONLY: "Бизнес-форум пока доступен только участникам тестовой группы.",
    FORUM_BLOCKED_FULL: "Доступ к Бизнес-форуму ограничен Боссом.",
    FORUM_BLOCKED_WRITE: "Чтение доступно, но публикация временно ограничена Боссом.",
    RULES_NOT_ACCEPTED: "Перед публикацией примите правила Бизнес-форума.",
    TOPIC_COOLDOWN: "Новую тему можно создать после завершения недельного ограничения.",
    REPLY_COOLDOWN: "Следующий ответ в этой теме можно отправить после завершения 15-минутного ограничения.",
    FORBIDDEN_LINK_OR_CONTACT: "Ссылки, адреса сайтов, внешние контакты и вложения запрещены.",
    INVALID_TITLE_LENGTH: "Заголовок должен содержать от 10 до 140 символов.",
    INVALID_TOPIC_BODY_LENGTH: "Описание темы должно содержать от 30 до 5000 символов.",
    INVALID_REPLY_LENGTH: "Ответ должен содержать от 2 до 3000 символов.",
    INVALID_REPORT_COMMENT_LENGTH: "Комментарий к жалобе должен содержать от 2 до 1000 символов.",
    TOPIC_CLOSED: "Тема закрыта для новых ответов.",
    TOPIC_HIDDEN: "Тема скрыта. Сначала восстановите её.",
    TOPIC_NOT_FOUND: "Тема не найдена или скрыта.",
    REPLY_NOT_FOUND: "Ответ не найден или уже скрыт.",
    NOT_TOPIC_AUTHOR: "Закрыть тему может только её автор или Босс.",
    ADMIN_REQUIRED: "Это действие доступно только Боссу.",
    ALREADY_REPORTED: "Вы уже отправляли жалобу на эту публикацию.",
    REQUEST_ID_CONFLICT: "Повторная отправка не выполнена. Обновите страницу и повторите действие.",
    TELEGRAM_ACCESS_CHECK_ERROR: "Не удалось проверить доступ через Telegram. Повторите попытку позже.",
    NETWORK_ERROR: "Нет связи с сервером Бизнес-форума. Проверьте интернет и повторите попытку.",
    SERVER_ERROR: "Сервер форума временно не выполнил запрос. Повторите попытку.",
  };
  return messages[reason] || "Операция не выполнена.";
}

async function forumApi(action, payload) {
  if (!tg || !tg.initData) {
    throw new ForumApiError({ reason: "NO_INIT_DATA" }, 401);
  }

  let response;
  try {
    response = await fetch(FORUM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg.initData,
        action,
        payload: payload || {},
      }),
    });
  } catch (error) {
    throw new ForumApiError({
      reason: "NETWORK_ERROR",
      message: "Нет связи с сервером Бизнес-форума. Проверьте интернет и повторите попытку.",
    }, 0);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    throw new ForumApiError(result, response.status);
  }
  return result;
}

function ensureForumAccess() {
  if (!state || state.access !== true) {
    if (typeof accessDenied === "function") accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    return false;
  }
  return true;
}

function stopForumTimer() {
  if (forumState.timerId) {
    clearInterval(forumState.timerId);
    forumState.timerId = null;
  }
}

function forumShell(content) {
  stopForumTimer();
  shell(`<div class="forum-module">${content}</div>`, "home");
}

function forumLoading(title, text) {
  forumShell(`${card("blue-card-v2 forum-hero", `<p class="eyebrow">Бизнес-форум</p><h1>${forumEsc(title || "Загрузка")}</h1><p>${forumEsc(text || "Получаем данные форума.")}</p>`)}<div class="forum-loading"><span></span><p>Подождите несколько секунд</p></div>`);
}

function forumErrorScreen(error, backAction) {
  const reason = error?.result?.reason || "SERVER_ERROR";
  const message = error?.message || forumReasonText(reason);
  const details = (reason === "FORUM_BLOCKED_FULL" || reason === "FORUM_BLOCKED_WRITE") && error?.result?.details
    ? `<p class="small">Причина: ${forumEsc(error.result.details)}</p>`
    : "";
  const reopen = reason === "INIT_DATA_EXPIRED" || reason === "NO_INIT_DATA"
    ? `<a class="btn primary" href="https://t.me/Lego_bisiness_system_bot?startapp">Открыть заново через Telegram</a>`
    : "";

  forumShell(`${card("result-bad-v2", `<p class="eyebrow">Бизнес-форум</p><h1>Действие не выполнено</h1><p>${forumEsc(message)}</p>${details}<div class="forum-actions">${reopen}<button class="btn secondary" onclick="${backAction || "renderHome()"}">Вернуться</button></div>`)}`);
}

function forumDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function forumTimeLeft(value) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

function forumDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (days > 0) return `${days} д. ${hours} ч. ${minutes} мин.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин. ${String(secs).padStart(2, "0")} сек.`;
}

function startForumCountdown(elementId, targetDate, onDone) {
  stopForumTimer();
  const update = function () {
    const element = document.getElementById(elementId);
    if (!element) {
      stopForumTimer();
      return;
    }
    const left = forumTimeLeft(targetDate);
    element.textContent = left > 0 ? forumDuration(left) : "доступно сейчас";
    if (left <= 0) {
      stopForumTimer();
      if (typeof onDone === "function") onDone();
    }
  };
  update();
  forumState.timerId = setInterval(update, 1000);
}

function forumCategoryLabel(key) {
  return FORUM_CATEGORIES.find((item) => item.key === key)?.label || "Общее";
}

function forumTopicTypeLabel(value) {
  return value === "discussion" ? "Обсуждение" : "Вопрос";
}

function forumStatusLabel(value) {
  if (value === "open") return "Открыта";
  if (value === "closed_by_author") return "Закрыта автором";
  if (value === "closed_by_boss") return "Закрыта Боссом";
  if (value === "hidden") return "Скрыта";
  return "Закрыта";
}

function forumIsBossMode() {
  return typeof isAdminMode === "function" && isAdminMode();
}

function forumCategoryTabs(activeKey) {
  return `<div class="forum-category-tabs">${FORUM_CATEGORIES.map((item) => `
    <button class="forum-category-tab ${activeKey === item.key ? "active" : ""}" onclick="renderForumTopics('${item.key}')">${forumEsc(item.label)}</button>
  `).join("")}</div>`;
}

function forumContainsForbiddenLink(value) {
  const text = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000\u200B-\u200D\u2060\uFEFF]/g, "")
    .toLowerCase();
  const patterns = [
    /https?\s*:\s*\/\s*\//iu,
    /ftp\s*:\s*\/\s*\//iu,
    /tg\s*:\s*\/\s*\//iu,
    /mailto\s*:/iu,
    /www\s*\./iu,
    /(?:t|telegram)\s*\.\s*me/iu,
    /(?:t|telegram)\s+точка\s+me/iu,
    /[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\s*(?:\.|\s+точка\s+)\s*[a-zа-яё]{2,24}/iu,
    /(?:^|[^a-z0-9_])@[a-z0-9_]{5,32}(?:[^a-z0-9_]|$)/iu,
    /[a-zа-яё0-9](?:[a-zа-яё0-9-]{0,62}[a-zа-яё0-9])?\s*(?:\.|\[\s*\.\s*\]|\(\s*\.\s*\)|\s+точка\s+)\s*(?:ru|рф|com|net|org|io|me|biz|site|online|app|pro|info)(?![a-zа-яё0-9-])/iu,
    /\[[^\]]{1,200}\]\s*\([^)]{1,500}\)/u,
    /<\s*a(?:\s|>)/iu,
    /data\s*:\s*image\s*\//iu,
    /base64\s*,/iu,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function forumRejectForbiddenPaste(event) {
  const text = event?.clipboardData?.getData("text") || "";
  if (forumContainsForbiddenLink(text)) {
    event.preventDefault();
    alert("Ссылки, адреса сайтов и внешние контакты в Бизнес-форуме запрещены.");
  }
}

function forumPreventFileDrop(event) {
  event.preventDefault();
  alert("Изображения и файлы в Бизнес-форуме не поддерживаются.");
}

function forumCounter(inputId, outputId, max) {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);
  if (!input || !output) return;
  output.textContent = `${input.value.length} / ${max}`;
  output.classList.toggle("limit", input.value.length > max);
}

async function loadForumBootstrap(force) {
  if (forumState.bootstrap && !force) return forumState.bootstrap;
  const result = await forumApi("bootstrap", {});
  forumState.bootstrap = result;
  return result;
}

async function renderBusinessForum() {
  if (!ensureForumAccess()) return;
  forumLoading("Бизнес-форум", "Проверяем доступ и состояние форума.");
  try {
    const bootstrap = await loadForumBootstrap(true);
    const bossNote = bootstrap.user?.is_boss
      ? `<div class="forum-boss-note"><b>Режим Босса</b><span>Создание тем и ответы доступны без временных ограничений.</span></div>`
      : "";
    const rulesNote = !bootstrap.rules_accepted
      ? `<div class="forum-notice"><b>Перед первой публикацией</b><p>Необходимо ознакомиться с правилами и подтвердить их принятие. Читать темы можно без подтверждения.</p><button class="btn secondary" onclick="renderForumRules()">Открыть правила</button></div>`
      : "";

    forumShell(`
      ${card("blue-card-v2 forum-hero", `<p class="eyebrow">профессиональная среда</p><h1>Бизнес-форум</h1><p>Практические вопросы, обсуждения и опыт участников по видам деятельности.</p>`)}
      ${bossNote}
      ${rulesNote}
      <div class="forum-home-grid">
        <button class="forum-home-card primary" onclick="renderForumTopics('${forumState.category || "general"}')">
          <span class="forum-home-icon">◎</span>
          <b>Актуальные темы</b>
          <p>Выберите вид деятельности и откройте обсуждения участников.</p>
        </button>
        <button class="forum-home-card" onclick="renderForumMyTopics()">
          <span class="forum-home-icon">▤</span>
          <b>Мои темы</b>
          <p>Ваши вопросы, обсуждения, статусы и ответы.</p>
        </button>
        <button class="forum-home-card" onclick="renderForumCreateTopic()">
          <span class="forum-home-icon">＋</span>
          <b>Создать новую тему</b>
          <p>${bootstrap.user?.is_boss ? "Без ограничений для Босса." : "Одна новая тема раз в 7 суток."}</p>
        </button>
      </div>
      ${card("forum-rules-entry", `<div><p class="eyebrow">порядок общения</p><h2>Правила Бизнес-форума</h2><p>Запрещены ссылки, файлы, реклама, политика, религиозные споры, оскорбления и публикация конфиденциальных данных.</p></div><button class="btn secondary" onclick="renderForumRules()">Прочитать правила</button>`)}
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderHome()">← На главную</button></div>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderHome()");
  }
}

function forumTopicCardHtml(topic) {
  const isClosed = topic.status !== "open";
  const badges = [
    topic.is_pinned ? `<span class="forum-badge pinned">Закреплено</span>` : "",
    `<span class="forum-badge type">${forumEsc(forumTopicTypeLabel(topic.topic_type))}</span>`,
    isClosed ? `<span class="forum-badge closed">${forumEsc(forumStatusLabel(topic.status))}</span>` : "",
  ].filter(Boolean).join("");

  return `<button class="forum-topic-card ${isClosed ? "closed" : ""}" onclick="renderForumTopic('${forumEsc(topic.id)}')">
    <div class="forum-topic-badges">${badges}</div>
    <h3>${forumEsc(topic.title)}</h3>
    <div class="forum-topic-meta">
      <span>${forumEsc(topic.author_name || "Участник")}</span>
      <span>Ответов: ${Number(topic.replies_count || 0)}</span>
      <span>Активность: ${forumEsc(forumDate(topic.last_activity_at))}</span>
    </div>
  </button>`;
}

async function renderForumTopics(category) {
  if (!ensureForumAccess()) return;
  forumState.category = FORUM_CATEGORIES.some((item) => item.key === category) ? category : "general";
  forumLoading("Актуальные темы", `Загружаем раздел «${forumCategoryLabel(forumState.category)}».`);

  try {
    await loadForumBootstrap();
    const result = await forumApi("list_topics", {
      category: forumState.category,
      page: 1,
      limit: 50,
    });

    const topicsHtml = result.topics?.length
      ? `<div class="forum-topic-list">${result.topics.map(forumTopicCardHtml).join("")}</div>`
      : `<div class="forum-empty"><b>В этом разделе пока нет тем</b><p>Первую тему можно создать как вопрос или обсуждение.</p><button class="btn primary" onclick="renderForumCreateTopic('${forumState.category}')">Создать тему</button></div>`;

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Актуальные темы</h1><p>Сначала открытые темы. Выше находятся закреплённые и темы с большим количеством ответов. Закрытые обсуждения расположены ниже и доступны для чтения.</p>`)}
      ${forumCategoryTabs(forumState.category)}
      <div class="forum-list-header"><div><b>${forumEsc(forumCategoryLabel(forumState.category))}</b><span>${Number(result.total || 0)} тем</span></div><button class="btn primary small-btn" onclick="renderForumCreateTopic('${forumState.category}')">＋ Новая тема</button></div>
      ${topicsHtml}
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderBusinessForum()">← В Бизнес-форум</button></div>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderBusinessForum()");
  }
}

async function renderForumMyTopics() {
  if (!ensureForumAccess()) return;
  forumLoading("Мои темы", "Загружаем созданные вами вопросы и обсуждения.");

  try {
    const bootstrap = await loadForumBootstrap();
    const result = await forumApi("my_topics", { page: 1, limit: 100 });
    const cooldown = !bootstrap.user?.is_boss && forumTimeLeft(result.next_topic_at) > 0
      ? `<div class="forum-cooldown"><b>Следующую тему можно создать через</b><span id="forum-my-topic-countdown">${forumDuration(forumTimeLeft(result.next_topic_at))}</span><small>${forumEsc(forumDate(result.next_topic_at))}</small></div>`
      : `<button class="btn primary" onclick="renderForumCreateTopic()">Создать новую тему</button>`;

    const topicsHtml = result.topics?.length
      ? `<div class="forum-topic-list">${result.topics.map(forumTopicCardHtml).join("")}</div>`
      : `<div class="forum-empty"><b>Вы ещё не создавали темы</b><p>Сформулируйте конкретный вопрос или откройте деловое обсуждение.</p></div>`;

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Мои темы</h1><p>Здесь сохраняются все созданные вами темы и их текущий статус.</p>`)}
      ${cooldown}
      ${topicsHtml}
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderBusinessForum()">← В Бизнес-форум</button></div>
    `);

    if (!bootstrap.user?.is_boss && forumTimeLeft(result.next_topic_at) > 0) {
      startForumCountdown("forum-my-topic-countdown", result.next_topic_at, renderForumMyTopics);
    }
  } catch (error) {
    forumErrorScreen(error, "renderBusinessForum()");
  }
}

async function renderForumCreateTopic(preselectedCategory) {
  if (!ensureForumAccess()) return;
  forumLoading("Новая тема", "Проверяем возможность создания темы.");

  try {
    const bootstrap = await loadForumBootstrap(true);
    const category = FORUM_CATEGORIES.some((item) => item.key === preselectedCategory)
      ? preselectedCategory
      : forumState.category || "general";
    const cooldownLeft = bootstrap.user?.is_boss ? 0 : forumTimeLeft(bootstrap.next_topic_at);

    if (cooldownLeft > 0) {
      forumShell(`
        ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Новая тема пока недоступна</h1><p>Ученик может создать одну тему раз в 7 суток. Удаление или закрытие предыдущей темы не сбрасывает ограничение.</p>`)}
        <div class="forum-cooldown large"><b>До следующей темы</b><span id="forum-create-topic-countdown">${forumDuration(cooldownLeft)}</span><small>${forumEsc(forumDate(bootstrap.next_topic_at))}</small></div>
        <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderForumMyTopics()">← Мои темы</button><button class="btn secondary" onclick="renderBusinessForum()">В Бизнес-форум</button></div>
      `);
      startForumCountdown("forum-create-topic-countdown", bootstrap.next_topic_at, function () {
        forumState.bootstrap = null;
        renderForumCreateTopic(category);
      });
      return;
    }

    forumState.pendingTopicRequestId = null;
    const rulesBlock = bootstrap.rules_accepted
      ? `<div class="forum-form-ok">Правила Бизнес-форума приняты.</div>`
      : `<label class="forum-rule-check"><input type="checkbox" id="forum-rules-check"><span>Я ознакомился и принимаю <button type="button" onclick="renderForumRules('create')">правила Бизнес-форума</button>.</span></label>`;

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Создать новую тему</h1><p>Одна тема должна содержать один понятный вопрос или одно конкретное направление обсуждения.</p>`)}
      <form class="forum-form" id="forum-topic-form" onsubmit="submitForumTopic(event)" ondrop="forumPreventFileDrop(event)" ondragover="event.preventDefault()">
        <label><span>Вид деятельности</span><select id="forum-topic-category">${FORUM_CATEGORIES.map((item) => `<option value="${item.key}" ${item.key === category ? "selected" : ""}>${forumEsc(item.label)}</option>`).join("")}</select></label>
        <label><span>Формат темы</span><select id="forum-topic-type"><option value="question">Вопрос</option><option value="discussion">Обсуждение</option></select></label>
        <label><span>Заголовок</span><input id="forum-topic-title" maxlength="140" minlength="10" placeholder="Кратко сформулируйте суть темы" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-topic-title','forum-title-counter',140)" required><small id="forum-title-counter">0 / 140</small></label>
        <label><span>Описание ситуации</span><textarea id="forum-topic-body" maxlength="5000" minlength="30" rows="9" placeholder="Опишите факты, контекст, уже предпринятые действия и конкретный вопрос к участникам" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-topic-body','forum-body-counter',5000)" required></textarea><small id="forum-body-counter">0 / 5000</small></label>
        <div class="forum-form-warning"><b>Нельзя добавлять</b><p>Ссылки, адреса сайтов, внешние контакты, изображения, видео, документы и другие файлы.</p></div>
        ${rulesBlock}
        <div id="forum-topic-form-error" class="forum-inline-error" hidden></div>
        <div class="forum-actions"><button class="btn primary" id="forum-topic-submit" type="submit">Опубликовать тему</button><button class="btn secondary" type="button" onclick="renderBusinessForum()">Отмена</button></div>
      </form>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderBusinessForum()");
  }
}

function setForumInlineError(elementId, message) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.hidden = !message;
  element.textContent = message || "";
}

async function submitForumTopic(event) {
  event.preventDefault();
  const submitButton = document.getElementById("forum-topic-submit");
  const title = document.getElementById("forum-topic-title")?.value.trim() || "";
  const body = document.getElementById("forum-topic-body")?.value.trim() || "";
  const category = document.getElementById("forum-topic-category")?.value || "general";
  const topicType = document.getElementById("forum-topic-type")?.value || "question";
  const bootstrap = forumState.bootstrap;

  setForumInlineError("forum-topic-form-error", "");

  if (title.length < 10 || title.length > 140) {
    setForumInlineError("forum-topic-form-error", "Заголовок должен содержать от 10 до 140 символов.");
    return;
  }
  if (body.length < 30 || body.length > 5000) {
    setForumInlineError("forum-topic-form-error", "Описание должно содержать от 30 до 5000 символов.");
    return;
  }
  if (forumContainsForbiddenLink(title) || forumContainsForbiddenLink(body)) {
    setForumInlineError("forum-topic-form-error", "Удалите ссылку, адрес сайта или внешний контакт.");
    return;
  }

  try {
    if (!bootstrap?.rules_accepted) {
      const checkbox = document.getElementById("forum-rules-check");
      if (!checkbox?.checked) {
        setForumInlineError("forum-topic-form-error", "Перед публикацией подтвердите принятие правил.");
        return;
      }
      await forumApi("accept_rules", {});
      forumState.bootstrap.rules_accepted = true;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Публикуем…";
    }

    if (!forumState.pendingTopicRequestId) {
      forumState.pendingTopicRequestId = forumUuid();
    }

    const result = await forumApi("create_topic", {
      requestId: forumState.pendingTopicRequestId,
      category,
      topicType,
      title,
      body,
    });

    forumState.pendingTopicRequestId = null;
    forumState.bootstrap = null;
    await renderForumTopic(result.topic.id);
  } catch (error) {
    const reason = error?.result?.reason;
    const message = error?.message || forumReasonText(reason);
    setForumInlineError("forum-topic-form-error", message);
    if (reason === "TOPIC_COOLDOWN") forumState.bootstrap = null;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Опубликовать тему";
    }
  }
}

async function renderForumTopic(topicId) {
  if (!ensureForumAccess()) return;
  forumState.currentTopicId = topicId;
  forumLoading("Открываем тему", "Загружаем вопрос и ответы участников.");

  try {
    const bootstrap = await loadForumBootstrap();
    const result = await forumApi("get_topic", { topicId, page: 1, limit: 200 });
    forumState.currentTopic = result.topic;
    forumState.currentReplies = result.replies || [];
    forumState.pendingReplyRequestId = null;

    const topic = result.topic;
    const isOpen = topic.status === "open";
    const isBossUi = forumIsBossMode();
    const authorControls = !isBossUi && topic.is_mine && isOpen
      ? `<button class="btn secondary" onclick="forumSetTopicState('close')">Закрыть свою тему</button>`
      : "";
    const bossControls = isBossUi
      ? `<div class="forum-boss-controls"><b>Управление Босса</b><div class="forum-actions">
          ${topic.status === "hidden"
            ? `<button class="btn secondary" onclick="forumSetTopicState('restore')">Восстановить тему</button>`
            : `${isOpen ? `<button class="btn secondary" onclick="forumSetTopicState('close')">Закрыть тему</button>` : `<button class="btn secondary" onclick="forumSetTopicState('reopen')">Переоткрыть тему</button>`}
               <button class="btn secondary" onclick="forumSetTopicState('${topic.is_pinned ? "unpin" : "pin"}')">${topic.is_pinned ? "Снять закрепление" : "Закрепить тему"}</button>
               <button class="btn secondary" onclick="forumSetTopicState('hide')">Скрыть тему</button>`}
        </div></div>`
      : "";

    const repliesHtml = result.replies?.length
      ? `<div class="forum-replies">${result.replies.map((reply) => forumReplyHtml(reply, isBossUi)).join("")}</div>`
      : `<div class="forum-empty compact"><b>Ответов пока нет</b><p>Первый содержательный ответ поднимет тему выше в списке открытых обсуждений.</p></div>`;

    const replyBlock = topic.status === "hidden"
      ? `<div class="forum-closed-panel"><b>Тема скрыта</b><p>Она не отображается ученикам и в общем списке.</p>${isBossUi ? `<button class="btn primary" onclick="forumSetTopicState('restore')">Восстановить тему</button>` : ""}</div>`
      : isOpen
      ? forumReplyFormHtml(result.next_reply_at, bootstrap.user?.is_boss, bootstrap.rules_accepted)
      : `<div class="forum-closed-panel"><b>Тема закрыта</b><p>Все материалы доступны для чтения, но новые ответы не принимаются.</p>${isBossUi ? `<button class="btn primary" onclick="forumSetTopicState('reopen')">Переоткрыть тему</button>` : ""}</div>`;

    forumShell(`
      <article class="forum-topic-full">
        <div class="forum-topic-badges">
          ${topic.is_pinned ? `<span class="forum-badge pinned">Закреплено</span>` : ""}
          <span class="forum-badge type">${forumEsc(forumTopicTypeLabel(topic.topic_type))}</span>
          <span class="forum-badge category">${forumEsc(forumCategoryLabel(topic.category))}</span>
          ${!isOpen ? `<span class="forum-badge closed">${forumEsc(forumStatusLabel(topic.status))}</span>` : ""}
        </div>
        <h1>${forumEsc(topic.title)}</h1>
        <div class="forum-topic-meta"><span>${forumEsc(topic.author_name)}</span><span>${forumEsc(forumDate(topic.created_at))}</span><span>Ответов: ${Number(topic.replies_count || 0)}</span></div>
        <div class="forum-topic-body">${forumTextHtml(topic.body)}</div>
        <div class="forum-topic-controls">${authorControls}<button class="forum-text-button" onclick="renderForumReport('topic','${forumEsc(topic.id)}')">Пожаловаться</button></div>
      </article>
      ${bossControls}
      <section class="forum-replies-section"><div class="forum-section-title"><h2>Ответы участников</h2><span>${Number(result.replies_total || 0)}</span></div>${repliesHtml}</section>
      ${replyBlock}
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderForumTopics('${forumEsc(topic.category)}')">← К списку тем</button><button class="btn secondary" onclick="renderBusinessForum()">В Бизнес-форум</button></div>
    `);

    if (isOpen && !bootstrap.user?.is_boss && forumTimeLeft(result.next_reply_at) > 0) {
      startForumCountdown("forum-reply-countdown", result.next_reply_at, function () {
        renderForumTopic(topic.id);
      });
    }
  } catch (error) {
    forumErrorScreen(error, `renderForumTopics('${forumState.category || "general"}')`);
  }
}

function forumReplyHtml(reply, isBossUi) {
  const hidden = reply.status === "hidden";
  return `<article class="forum-reply ${hidden ? "hidden" : ""}">
    <div class="forum-reply-head"><b>${forumEsc(reply.author_name || "Участник")}</b><span>${forumEsc(forumDate(reply.created_at))}</span></div>
    <div class="forum-reply-body">${hidden ? `<i>Ответ скрыт Боссом.</i>` : forumTextHtml(reply.body)}</div>
    <div class="forum-reply-actions">
      ${!hidden ? `<button class="forum-text-button" onclick="renderForumReport('reply','${forumEsc(reply.id)}')">Пожаловаться</button>` : ""}
      ${isBossUi ? `<button class="forum-text-button boss" onclick="forumSetReplyState('${forumEsc(reply.id)}','${hidden ? "restore" : "hide"}')">${hidden ? "Восстановить" : "Скрыть"}</button>` : ""}
    </div>
  </article>`;
}

function forumReplyFormHtml(nextReplyAt, isBoss, rulesAccepted) {
  const cooldownLeft = isBoss ? 0 : forumTimeLeft(nextReplyAt);
  if (cooldownLeft > 0) {
    return `<div class="forum-cooldown"><b>Следующий ответ в этой теме можно отправить через</b><span id="forum-reply-countdown">${forumDuration(cooldownLeft)}</span><small>${forumEsc(forumDate(nextReplyAt))}</small></div>`;
  }

  return `<form class="forum-form forum-reply-form" onsubmit="submitForumReply(event)" ondrop="forumPreventFileDrop(event)" ondragover="event.preventDefault()">
    <h2>Ваш ответ</h2>
    ${!rulesAccepted ? `<div class="forum-notice compact"><p>Перед первым ответом необходимо принять правила.</p><label class="forum-rule-check"><input type="checkbox" id="forum-reply-rules-check"><span>Я принимаю <button type="button" onclick="renderForumRules('topic')">правила Бизнес-форума</button>.</span></label></div>` : ""}
    <label><textarea id="forum-reply-body" maxlength="3000" minlength="2" rows="6" placeholder="Напишите содержательный ответ по существу темы" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-reply-body','forum-reply-counter',3000)" required></textarea><small id="forum-reply-counter">0 / 3000</small></label>
    <div class="forum-form-warning compact"><p>Ссылки, контакты, изображения и файлы запрещены.</p></div>
    <div id="forum-reply-form-error" class="forum-inline-error" hidden></div>
    <button class="btn primary" id="forum-reply-submit" type="submit">Отправить ответ</button>
  </form>`;
}

async function submitForumReply(event) {
  event.preventDefault();
  const submitButton = document.getElementById("forum-reply-submit");
  const body = document.getElementById("forum-reply-body")?.value.trim() || "";
  setForumInlineError("forum-reply-form-error", "");

  if (body.length < 2 || body.length > 3000) {
    setForumInlineError("forum-reply-form-error", "Ответ должен содержать от 2 до 3000 символов.");
    return;
  }
  if (forumContainsForbiddenLink(body)) {
    setForumInlineError("forum-reply-form-error", "Удалите ссылку, адрес сайта или внешний контакт.");
    return;
  }

  try {
    if (!forumState.bootstrap?.rules_accepted) {
      const checkbox = document.getElementById("forum-reply-rules-check");
      if (!checkbox?.checked) {
        setForumInlineError("forum-reply-form-error", "Перед отправкой подтвердите принятие правил.");
        return;
      }
      await forumApi("accept_rules", {});
      forumState.bootstrap.rules_accepted = true;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Отправляем…";
    }

    if (!forumState.pendingReplyRequestId) {
      forumState.pendingReplyRequestId = forumUuid();
    }

    await forumApi("create_reply", {
      requestId: forumState.pendingReplyRequestId,
      topicId: forumState.currentTopicId,
      body,
    });

    forumState.pendingReplyRequestId = null;
    await renderForumTopic(forumState.currentTopicId);
  } catch (error) {
    setForumInlineError("forum-reply-form-error", error?.message || forumReasonText(error?.result?.reason));
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Отправить ответ";
    }
  }
}

async function forumSetTopicState(mode) {
  const topic = forumState.currentTopic;
  if (!topic) return;
  const confirmation = {
    close: "Закрыть тему для новых ответов? Она останется доступной для чтения.",
    reopen: "Переоткрыть тему для новых ответов?",
    pin: "Закрепить тему в верхней части открытых тем?",
    unpin: "Снять закрепление с темы?",
    hide: "Скрыть тему из общего списка? Босс сможет восстановить её.",
    restore: "Восстановить скрытую тему?",
  }[mode];
  if (confirmation && !confirm(confirmation)) return;

  try {
    await forumApi("set_topic_state", { topicId: topic.id, mode });
    await renderForumTopic(topic.id);
  } catch (error) {
    alert(error?.message || forumReasonText(error?.result?.reason));
  }
}

async function forumSetReplyState(replyId, mode) {
  if (!confirm(mode === "hide" ? "Скрыть этот ответ?" : "Восстановить этот ответ?")) return;
  try {
    await forumApi("set_reply_state", { replyId, mode });
    await renderForumTopic(forumState.currentTopicId);
  } catch (error) {
    alert(error?.message || forumReasonText(error?.result?.reason));
  }
}

function renderForumReport(targetType, targetId) {
  const back = forumState.currentTopicId
    ? `renderForumTopic('${forumEsc(forumState.currentTopicId)}')`
    : "renderBusinessForum()";
  forumShell(`
    ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Пожаловаться</h1><p>Жалоба попадёт в очередь Босса. Сообщение не скрывается автоматически.</p>`)}
    <form class="forum-form" onsubmit="submitForumReport(event,'${forumEsc(targetType)}','${forumEsc(targetId)}')">
      <label><span>Причина</span><select id="forum-report-reason"><option value="spam">Реклама или спам</option><option value="insult">Оскорбление или агрессия</option><option value="politics_religion">Политика или религиозный спор</option><option value="personal_data">Персональные или конфиденциальные данные</option><option value="illegal">Незаконный или опасный материал</option><option value="off_topic">Не по теме форума</option><option value="other">Другое</option></select></label>
      <label><span>Комментарий — необязательно</span><textarea id="forum-report-comment" maxlength="1000" rows="5" placeholder="Кратко поясните нарушение" onpaste="forumRejectForbiddenPaste(event)"></textarea></label>
      <div id="forum-report-error" class="forum-inline-error" hidden></div>
      <div class="forum-actions"><button class="btn primary" type="submit">Отправить жалобу</button><button class="btn secondary" type="button" onclick="${back}">Отмена</button></div>
    </form>
  `);
}

async function submitForumReport(event, targetType, targetId) {
  event.preventDefault();
  const reason = document.getElementById("forum-report-reason")?.value || "other";
  const comment = document.getElementById("forum-report-comment")?.value.trim() || "";
  try {
    await forumApi("report", {
      topicId: targetType === "topic" ? targetId : null,
      replyId: targetType === "reply" ? targetId : null,
      reason,
      comment,
    });
    alert("Жалоба отправлена Боссу.");
    await renderForumTopic(forumState.currentTopicId);
  } catch (error) {
    setForumInlineError("forum-report-error", error?.message || forumReasonText(error?.result?.reason));
  }
}

function forumRulesHtml() {
  return `
    <div class="forum-rules-document">
      <section><h2>1. Назначение форума</h2><p>Бизнес-форум предназначен для практических вопросов управления, развития бизнеса, внедрения инструментов и обмена профессиональным опытом. Одна тема должна содержать один понятный вопрос или одно конкретное направление обсуждения.</p></section>
      <section><h2>2. Деловая направленность</h2><p>Тема должна соответствовать выбранному виду деятельности. Сообщения без конкретного делового содержания, флуд и намеренное уведение обсуждения в сторону не допускаются.</p></section>
      <section><h2>3. Политика, религия и конфликтные общественные темы</h2><p>Запрещены политическая агитация, обсуждение партий и политиков, идеологические и религиозные споры, национальные конфликты, обсуждение военных конфликтов вне прямого делового контекста и иные провоцирующие общественные темы. Законы, налоги и регулирование допускается обсуждать только через их практическое влияние на бизнес, без политических оценок.</p></section>
      <section><h2>4. Уважительное общение</h2><p>Запрещены оскорбления, угрозы, травля, дискриминация, унижение, переход на личности, провокации и агрессивная нецензурная лексика. Допускается критика решения, аргумента или действия, но не самого человека.</p></section>
      <section><h2>5. Реклама и самопродвижение</h2><p>Запрещены реклама услуг и товаров, поиск клиентов, партнёрские и реферальные предложения, массовые приглашения к сотрудничеству, продвижение каналов и сообществ, публикация контактов и повторяющийся спам.</p></section>
      <section><h2>6. Ссылки и вложения</h2><p>Запрещены ссылки, адреса сайтов, Telegram-адреса, электронная почта, внешние контакты, изображения, видео, аудио, документы, архивы и любые способы обхода технического запрета. Необходимую информацию следует описывать своими словами.</p></section>
      <section><h2>7. Персональные и конфиденциальные данные</h2><p>Нельзя публиковать ФИО, телефоны, адреса, платёжные реквизиты, личную переписку, медицинские сведения, договоры с персональными данными, пароли, коды доступа, коммерческую тайну и внутренние документы без законного основания и согласия. Практические случаи необходимо обезличивать.</p></section>
      <section><h2>8. Незаконные и недобросовестные действия</h2><p>Запрещены инструкции и предложения, связанные с мошенничеством, обманом клиентов, подделкой документов, незаконным получением данных, обходом обязательств, сокрытием нарушений и причинением ущерба сотрудникам, партнёрам или конкурентам.</p></section>
      <section><h2>9. Чужие материалы</h2><p>Нельзя полностью копировать платные курсы, закрытые методические материалы, книги, статьи, документы компаний и материалы других сообществ. Допускается краткий пересказ идеи своими словами для обсуждения её практического применения.</p></section>
      <section><h2>10. Достоверность</h2><p>Личное мнение или опыт нельзя выдавать за установленный факт. При отсутствии подтверждения это необходимо прямо обозначить. Запрещены необоснованные гарантии дохода, результата или безопасности предложенного решения.</p></section>
      <section><h2>11. Закрытие и модерация</h2><p>Автор может закрыть свою тему. После закрытия она остаётся доступной для чтения, но новые ответы не принимаются. Босс может закрывать, переоткрывать и закреплять темы, скрывать нарушения, рассматривать жалобы и ограничивать доступ участника к форуму.</p></section>
      <section><h2>12. Ответственность участника</h2><p>Публикуя тему или ответ, участник подтверждает, что ознакомился с правилами и несёт ответственность за содержание своего сообщения.</p></section>
    </div>`;
}

async function renderForumRules(returnTo) {
  if (!ensureForumAccess()) return;
  try {
    const bootstrap = await loadForumBootstrap();
    const acceptButton = bootstrap.rules_accepted
      ? `<div class="forum-form-ok">Текущая версия правил принята.</div>`
      : `<button class="btn primary" onclick="acceptForumRules('${forumEsc(returnTo || "forum")}')">Принять правила</button>`;
    const backAction = returnTo === "create"
      ? "renderForumCreateTopic()"
      : returnTo === "topic" && forumState.currentTopicId
      ? `renderForumTopic('${forumEsc(forumState.currentTopicId)}')`
      : "renderBusinessForum()";

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Правила</h1><p>Правила сохраняют деловой характер обсуждений и защищают участников.</p>`)}
      ${forumRulesHtml()}
      <div class="forum-actions sticky-actions">${acceptButton}<button class="btn secondary" onclick="${backAction}">Вернуться</button></div>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderBusinessForum()");
  }
}

async function acceptForumRules(returnTo) {
  try {
    await forumApi("accept_rules", {});
    if (forumState.bootstrap) forumState.bootstrap.rules_accepted = true;
    if (returnTo === "create") return renderForumCreateTopic();
    if (returnTo === "topic" && forumState.currentTopicId) return renderForumTopic(forumState.currentTopicId);
    return renderBusinessForum();
  } catch (error) {
    alert(error?.message || forumReasonText(error?.result?.reason));
  }
}

Object.assign(window, {
  renderBusinessForum,
  renderForumTopics,
  renderForumMyTopics,
  renderForumCreateTopic,
  submitForumTopic,
  renderForumTopic,
  submitForumReply,
  forumSetTopicState,
  forumSetReplyState,
  renderForumReport,
  submitForumReport,
  renderForumRules,
  acceptForumRules,
  forumRejectForbiddenPaste,
  forumPreventFileDrop,
  forumCounter,
});
