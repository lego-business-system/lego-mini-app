/* =====================================================
   Л.Е.Г.О. — Бизнес-форум v2.0
   Отдельный модуль. Не изменяет логику уроков, ДЗ и прогресса.
   ===================================================== */

const FORUM_API_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/forum-api-v3";

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
  replyTo: null,
};

function forumPublicUiAllowed() {
  return window.FORUM_PUBLIC_UI_V38 === true;
}

function forumVisibleForCurrentMode() {
  return forumPublicUiAllowed() || (typeof isAdminMode === "function" && isAdminMode());
}

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
    FORUM_BLOCKED_FULL: "Доступ к Бизнес-форуму ограничен администратором.",
    FORUM_BLOCKED_WRITE: "Чтение доступно, но публикация временно ограничена администратором.",
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
    PARENT_REPLY_NOT_FOUND: "Ответ, на который вы отвечаете, не найден или скрыт.",
    NOT_TOPIC_AUTHOR: "Закрыть тему может только её автор или администратор.",
    ADMIN_REQUIRED: "Это действие доступно только администратору.",
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
  shell(`<div class="forum-module">${content}</div>`, "forum");
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
  if (value === "closed_by_boss") return "Закрыта администратором";
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

function forumRulesAccepted(bootstrap) {
  return Boolean(bootstrap?.rules_accepted || bootstrap?.user?.is_boss);
}

function forumRequireAcceptedRules(bootstrap, returnTo) {
  if (forumRulesAccepted(bootstrap)) return true;
  renderForumRules(returnTo || "forum");
  return false;
}

function forumTopicLimitText(bootstrap) {
  if (forumIsBossMode()) return "Создание тем без недельного лимита.";
  if (!forumRulesAccepted(bootstrap)) return "Сначала откройте и примите правила форума.";
  const left = forumTimeLeft(bootstrap?.next_topic_at);
  if (left > 0) return `Следующая тема будет доступна через ${forumDuration(left)}.`;
  return "Доступно сейчас. После публикации — одна новая тема раз в 7 суток.";
}

function forumRulesEntryHtml(bootstrap) {
  const accepted = forumRulesAccepted(bootstrap);
  return card(`forum-rules-entry ${accepted ? "accepted" : "required"}`, `
    <div>
      <p class="eyebrow">${accepted ? "правила приняты" : "обязательный первый шаг"}</p>
      <h2>Правила Бизнес-форума</h2>
      <p>${accepted
        ? "Правила приняты. Актуальные темы, ваши темы и создание новой темы доступны."
        : "Перед первым входом в обсуждения необходимо прочитать правила до конца и подтвердить их принятие."}</p>
    </div>
    <button class="btn ${accepted ? "secondary" : "primary"}" onclick="renderForumRules()">${accepted ? "Открыть правила" : "Прочитать и принять правила"}</button>
  `);
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
    /(?:^|[^\d])(?:\+\s*\d{1,3}|8)(?:[\s().-]*\d){9,14}(?!\d)/u,
    /(?:телефон|номер|whatsapp|whats\s*app|ватсап|вацап|viber|вайбер)\s*[:\-]?\s*(?:\+?\s*\d)(?:[\s().-]*\d){6,14}/iu,
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
  if (!forumVisibleForCurrentMode()) {
    forumShell(`${card("blue-card-v2 forum-hero", `<p class="eyebrow">Бизнес-форум</p><h1>Раздел пока закрыт</h1><p>Форум проходит доработку и пока доступен только в режиме администратора.</p><button class="btn secondary" onclick="renderHome()">Вернуться на главную</button>`)}`);
    return;
  }
  forumLoading("Бизнес-форум", "Проверяем доступ и состояние форума.");
  try {
    const bootstrap = await loadForumBootstrap(true);
    const accepted = forumRulesAccepted(bootstrap);
    const isBossUi = forumIsBossMode();
    const bossNote = isBossUi
      ? `<div class="forum-boss-note"><b>Режим администрирования</b><span>Административные функции и публикации доступны без временных ограничений.</span></div>`
      : "";
    const locked = accepted ? "" : "locked";
    const disabled = accepted ? "" : "disabled";
    const clickTopics = accepted ? `onclick="renderForumTopics('${forumState.category || "general"}')"` : "";
    const clickMine = accepted ? `onclick="renderForumMyTopics()"` : "";
    const clickCreate = accepted ? `onclick="renderForumCreateTopic()"` : "";

    forumShell(`
      ${card("blue-card-v2 forum-hero", `<p class="eyebrow">профессиональная среда</p><h1>Бизнес-форум</h1><p>Практические вопросы, обсуждения и опыт участников по видам деятельности.</p>`)}
      ${forumRulesEntryHtml(bootstrap)}
      ${bossNote}
      <div class="forum-home-grid ${accepted ? "" : "forum-home-grid-locked"}">
        <button class="forum-home-card primary ${locked}" ${clickTopics} ${disabled}>
          <span class="forum-home-icon">◎</span>
          <b>Актуальные темы</b>
          <p>${accepted ? "Выберите вид деятельности и откройте обсуждения участников." : "Станет доступно после принятия правил."}</p>
        </button>
        <button class="forum-home-card ${locked}" ${clickMine} ${disabled}>
          <span class="forum-home-icon">▤</span>
          <b>Мои темы</b>
          <p>${accepted ? "Созданные вами вопросы, обсуждения и их статусы." : "Станет доступно после принятия правил."}</p>
        </button>
        <button class="forum-home-card ${locked}" ${clickCreate} ${disabled}>
          <span class="forum-home-icon">＋</span>
          <b>Создать новую тему</b>
          <p>${forumEsc(forumTopicLimitText(bootstrap))}</p>
        </button>
      </div>
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderHome()">← На главную</button></div>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderHome()");
  }
}

function forumTopicCardHtml(topic) {
  const isHidden = topic.status === "hidden";
  const isClosed = topic.status !== "open" && !isHidden;
  const badges = [
    topic.is_pinned ? `<span class="forum-badge pinned">Закреплено</span>` : "",
    `<span class="forum-badge type">${forumEsc(forumTopicTypeLabel(topic.topic_type))}</span>`,
    isClosed ? `<span class="forum-badge closed">${forumEsc(forumStatusLabel(topic.status))}</span>` : "",
    isHidden ? `<span class="forum-badge hidden">Скрыта от участников</span>` : "",
  ].filter(Boolean).join("");

  return `<button class="forum-topic-card ${isClosed ? "closed" : ""} ${isHidden ? "hidden" : ""}" onclick="renderForumTopic('${forumEsc(topic.id)}')">
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
    const bootstrap = await loadForumBootstrap();
    if (!forumRequireAcceptedRules(bootstrap, "forum")) return;
    const result = await forumApi("list_topics", {
      category: forumState.category,
      page: 1,
      limit: 50,
      includeHidden: forumIsBossMode(),
    });

    const topicsHtml = result.topics?.length
      ? `<div class="forum-topic-list">${result.topics.map(forumTopicCardHtml).join("")}</div>`
      : `<div class="forum-empty"><b>В этом разделе пока нет тем</b><p>Новые вопросы и обсуждения создаются только через отдельный блок «Создать новую тему».</p></div>`;
    const adminHint = forumIsBossMode()
      ? " Скрытые темы отображаются только администратору и находятся внизу списка."
      : "";

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Актуальные темы</h1><p>Сначала закреплённые и открытые темы с наибольшим количеством ответов. Закрытые обсуждения расположены ниже и доступны для чтения.${adminHint}</p>`)}
      ${forumCategoryTabs(forumState.category)}
      <div class="forum-list-header"><div><b>${forumEsc(forumCategoryLabel(forumState.category))}</b><span>${Number(result.total || 0)} тем</span></div></div>
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
    if (!forumRequireAcceptedRules(bootstrap, "forum")) return;
    const result = await forumApi("my_topics", { page: 1, limit: 100 });
    const left = forumTimeLeft(result.next_topic_at);
    const quota = forumIsBossMode()
      ? `<div class="forum-form-ok">В режиме администратора недельный лимит на создание тем не применяется.</div>`
      : left > 0
      ? `<div class="forum-cooldown"><b>Следующую тему можно создать через</b><span id="forum-my-topic-countdown">${forumDuration(left)}</span><small>${forumEsc(forumDate(result.next_topic_at))}</small></div>`
      : `<div class="forum-form-ok">Новая тема доступна. Для публикации откройте отдельный блок «Создать новую тему».</div>`;

    const topicsHtml = result.topics?.length
      ? `<div class="forum-topic-list">${result.topics.map(forumTopicCardHtml).join("")}</div>`
      : `<div class="forum-empty"><b>Вы ещё не создавали темы</b><p>Когда тема будет опубликована через отдельный блок, она появится здесь.</p></div>`;

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Мои темы</h1><p>Здесь сохраняются созданные вами темы и их текущий статус.</p>`)}
      ${quota}
      ${topicsHtml}
      <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderBusinessForum()">← В Бизнес-форум</button></div>
    `);

    if (!forumIsBossMode() && left > 0) {
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
    if (!forumRequireAcceptedRules(bootstrap, "create")) return;
    const category = FORUM_CATEGORIES.some((item) => item.key === preselectedCategory)
      ? preselectedCategory
      : forumState.category || "general";
    const cooldownLeft = bootstrap.user?.is_boss ? 0 : forumTimeLeft(bootstrap.next_topic_at);

    if (cooldownLeft > 0) {
      forumShell(`
        ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Новая тема пока недоступна</h1><p>Ученик может создать одну тему раз в 7 суток. Закрытие или удаление темы администратором не сбрасывает недельное ограничение автора.</p>`)}
        <div class="forum-cooldown large"><b>До следующей темы</b><span id="forum-create-topic-countdown">${forumDuration(cooldownLeft)}</span><small>${forumEsc(forumDate(bootstrap.next_topic_at))}</small></div>
        <div class="forum-bottom-actions"><button class="btn secondary" onclick="renderBusinessForum()">← В Бизнес-форум</button></div>
      `);
      startForumCountdown("forum-create-topic-countdown", bootstrap.next_topic_at, function () {
        forumState.bootstrap = null;
        renderForumCreateTopic(category);
      });
      return;
    }

    forumState.pendingTopicRequestId = null;
    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Создать новую тему</h1><p>Одна тема должна содержать один понятный вопрос или одно конкретное направление обсуждения.</p>`)}
      ${forumIsBossMode() ? `<div class="forum-boss-note"><b>Административный режим</b><span>Недельный лимит на создание тем не применяется.</span></div>` : ""}
      <form class="forum-form" id="forum-topic-form" onsubmit="submitForumTopic(event)" ondrop="forumPreventFileDrop(event)" ondragover="event.preventDefault()">
        <label><span>Вид деятельности</span><select id="forum-topic-category">${FORUM_CATEGORIES.map((item) => `<option value="${item.key}" ${item.key === category ? "selected" : ""}>${forumEsc(item.label)}</option>`).join("")}</select></label>
        <label><span>Формат темы</span><select id="forum-topic-type"><option value="question">Вопрос</option><option value="discussion">Обсуждение</option></select></label>
        <label><span>Заголовок</span><input id="forum-topic-title" maxlength="140" minlength="10" placeholder="Кратко сформулируйте суть темы" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-topic-title','forum-title-counter',140)" required><small id="forum-title-counter">0 / 140</small></label>
        <label><span>Описание ситуации</span><textarea id="forum-topic-body" maxlength="5000" minlength="30" rows="9" placeholder="Опишите факты, контекст, уже предпринятые действия и конкретный вопрос к участникам" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-topic-body','forum-body-counter',5000)" required></textarea><small id="forum-body-counter">0 / 5000</small></label>
        <div class="forum-form-warning"><b>Нельзя добавлять</b><p>Ссылки, адреса сайтов, внешние контакты, изображения, видео, документы и другие файлы.</p></div>
        <div class="forum-form-ok">Правила Бизнес-форума приняты.</div>
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
  if (forumState.currentTopicId !== topicId) forumState.replyTo = null;
  forumState.currentTopicId = topicId;
  forumLoading("Открываем тему", "Загружаем вопрос и ответы участников.");

  try {
    const bootstrap = await loadForumBootstrap();
    if (!forumRequireAcceptedRules(bootstrap, "forum")) return;
    const result = await forumApi("get_topic", { topicId, page: 1, limit: 200, adminView: forumIsBossMode() });
    forumState.currentTopic = result.topic;
    forumState.currentReplies = result.replies || [];
    forumState.pendingReplyRequestId = null;

    const topic = result.topic;
    const isOpen = topic.status === "open";
    const isBossUi = forumIsBossMode();
    const authorControls = !isBossUi && topic.is_mine && isOpen
      ? `<button class="btn secondary" onclick="forumSetTopicState('close')">Закрыть свою тему</button>`
      : "";
    const deleteButton = `<button class="btn danger" onclick="forumSetTopicState('delete')">Удалить навсегда</button>`;
    const bossControls = isBossUi
      ? `<div class="forum-boss-controls"><b>Управление администратора</b><div class="forum-actions">
          ${topic.status === "hidden"
            ? `<button class="btn secondary" onclick="forumSetTopicState('restore')">Восстановить тему</button>${deleteButton}`
            : `${isOpen ? `<button class="btn secondary" onclick="forumSetTopicState('close')">Закрыть тему</button>` : `<button class="btn secondary" onclick="forumSetTopicState('reopen')">Переоткрыть тему</button>`}
               <button class="btn secondary" onclick="forumSetTopicState('${topic.is_pinned ? "unpin" : "pin"}')">${topic.is_pinned ? "Снять закрепление" : "Закрепить тему"}</button>
               <button class="btn secondary" onclick="forumSetTopicState('hide')">Скрыть тему</button>
               ${deleteButton}`}
        </div></div>`
      : "";

    const repliesHtml = result.replies?.length
      ? `<div class="forum-replies">${result.replies.map((reply) => forumReplyHtml(reply, isBossUi)).join("")}</div>`
      : `<div class="forum-empty compact"><b>Ответов пока нет</b><p>Первый содержательный ответ поднимет тему выше в списке открытых обсуждений.</p></div>`;

    const replyBlock = topic.status === "hidden"
      ? `<div class="forum-closed-panel"><b>Тема скрыта</b><p>Она не отображается участникам, но остаётся доступной администратору.</p>${isBossUi ? `<button class="btn primary" onclick="forumSetTopicState('restore')">Восстановить тему</button>` : ""}</div>`
      : isOpen
      ? forumReplyFormHtml(result.next_reply_at, bootstrap.user?.is_boss)
      : `<div class="forum-closed-panel"><b>Тема закрыта</b><p>Все материалы доступны для чтения, но новые ответы не принимаются.</p>${isBossUi ? `<button class="btn primary" onclick="forumSetTopicState('reopen')">Переоткрыть тему</button>` : ""}</div>`;

    forumShell(`
      <article class="forum-topic-full ${topic.status === "hidden" ? "hidden" : ""}">
        <div class="forum-topic-badges">
          ${topic.is_pinned ? `<span class="forum-badge pinned">Закреплено</span>` : ""}
          <span class="forum-badge type">${forumEsc(forumTopicTypeLabel(topic.topic_type))}</span>
          <span class="forum-badge category">${forumEsc(forumCategoryLabel(topic.category))}</span>
          ${!isOpen ? `<span class="forum-badge ${topic.status === "hidden" ? "hidden" : "closed"}">${forumEsc(forumStatusLabel(topic.status))}</span>` : ""}
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
  const parent = reply.parent_reply_id
    ? `<div class="forum-reply-reference"><b>В ответ: ${forumEsc(reply.parent_author_name || "участник")}</b><p>${forumEsc(reply.parent_excerpt || "Исходный ответ скрыт или недоступен.")}</p></div>`
    : "";
  const canReply = !hidden && forumState.currentTopic?.status === "open";
  return `<article class="forum-reply ${hidden ? "hidden" : ""}" id="forum-reply-${forumEsc(reply.id)}">
    <div class="forum-reply-head"><b>${forumEsc(reply.author_name || "Участник")}</b><span>${forumEsc(forumDate(reply.created_at))}</span></div>
    ${parent}
    <div class="forum-reply-body">${hidden ? `<i>Ответ скрыт администратором.</i>` : forumTextHtml(reply.body)}</div>
    <div class="forum-reply-actions">
      ${canReply ? `<button class="forum-text-button reply" onclick="forumStartReplyTo('${forumEsc(reply.id)}')">Ответить</button>` : ""}
      ${!hidden ? `<button class="forum-text-button" onclick="renderForumReport('reply','${forumEsc(reply.id)}')">Пожаловаться</button>` : ""}
      ${isBossUi ? `<button class="forum-text-button boss" onclick="forumSetReplyState('${forumEsc(reply.id)}','${hidden ? "restore" : "hide"}')">${hidden ? "Восстановить" : "Скрыть"}</button>` : ""}
    </div>
  </article>`;
}

function forumReplyTargetHtml() {
  const target = forumState.replyTo;
  if (!target) return "";
  return `<div class="forum-reply-target-inner"><div><b>Ответ для ${forumEsc(target.author_name || "участника")}</b><p>${forumEsc(target.excerpt || "")}</p></div><button type="button" onclick="forumCancelReplyTo()" aria-label="Отменить ответ на сообщение">×</button></div>`;
}

function forumReplyFormHtml(nextReplyAt, isBoss) {
  const cooldownLeft = isBoss ? 0 : forumTimeLeft(nextReplyAt);
  if (cooldownLeft > 0) {
    return `<div class="forum-cooldown"><b>Следующий ответ в этой теме можно отправить через</b><span id="forum-reply-countdown">${forumDuration(cooldownLeft)}</span><small>${forumEsc(forumDate(nextReplyAt))}</small></div>`;
  }

  return `<form class="forum-form forum-reply-form" onsubmit="submitForumReply(event)" ondrop="forumPreventFileDrop(event)" ondragover="event.preventDefault()">
    <h2>Ваш ответ</h2>
    <div id="forum-reply-target" class="forum-reply-target" ${forumState.replyTo ? "" : "hidden"}>${forumReplyTargetHtml()}</div>
    <label><textarea id="forum-reply-body" maxlength="3000" minlength="2" rows="6" placeholder="Напишите содержательный ответ по существу темы" onpaste="forumRejectForbiddenPaste(event)" oninput="forumCounter('forum-reply-body','forum-reply-counter',3000)" required></textarea><small id="forum-reply-counter">0 / 3000</small></label>
    <div class="forum-form-warning compact"><p>Ссылки, контакты, изображения и файлы запрещены.</p></div>
    <div id="forum-reply-form-error" class="forum-inline-error" hidden></div>
    <button class="btn primary" id="forum-reply-submit" type="submit">Отправить ответ</button>
  </form>`;
}

function forumStartReplyTo(replyId) {
  const reply = (forumState.currentReplies || []).find((item) => String(item.id) === String(replyId));
  if (!reply || reply.status === "hidden") return;
  forumState.replyTo = {
    id: reply.id,
    author_name: reply.author_name || "Участник",
    excerpt: String(reply.body || "").slice(0, 220),
  };
  const target = document.getElementById("forum-reply-target");
  if (target) {
    target.hidden = false;
    target.innerHTML = forumReplyTargetHtml();
  }
  const input = document.getElementById("forum-reply-body");
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const cooldown = document.getElementById("forum-reply-countdown");
  if (cooldown) {
    cooldown.scrollIntoView({ behavior: "smooth", block: "center" });
    alert("Ответ выбран. Написать сообщение можно будет после окончания 15-минутного ограничения.");
  }
}

function forumCancelReplyTo() {
  forumState.replyTo = null;
  const target = document.getElementById("forum-reply-target");
  if (target) {
    target.hidden = true;
    target.innerHTML = "";
  }
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
      parentReplyId: forumState.replyTo?.id || null,
    });

    forumState.pendingReplyRequestId = null;
    forumState.replyTo = null;
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
    hide: "Скрыть тему от участников? Она останется доступной администратору.",
    restore: "Восстановить скрытую тему?",
    delete: "Удалить тему навсегда вместе со всеми ответами и жалобами? Восстановление будет невозможно.",
  }[mode];
  if (confirmation && !confirm(confirmation)) return;
  if (mode === "delete" && !confirm("Подтвердите окончательное удаление темы. Это действие нельзя отменить.")) return;

  try {
    const result = await forumApi("set_topic_state", { topicId: topic.id, mode });
    if (mode === "delete" || result?.deleted) {
      forumState.currentTopic = null;
      forumState.currentTopicId = null;
      forumState.currentReplies = [];
      forumState.replyTo = null;
      alert("Тема удалена навсегда.");
      return renderForumTopics(topic.category || forumState.category || "general");
    }
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
    ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Пожаловаться</h1><p>Жалоба попадёт в очередь администратора. Сообщение не скрывается автоматически.</p>`)}
    <form class="forum-form" onsubmit="submitForumReport(event,'${forumEsc(targetType)}','${forumEsc(targetId)}')">
      <label><span>Причина</span><select id="forum-report-reason"><option value="spam">Реклама или спам</option><option value="insult">Оскорбление или агрессия</option><option value="politics_religion">Политика или религиозный спор</option><option value="personal_data">Персональные или конфиденциальные данные</option><option value="illegal_content">Незаконный или опасный материал</option><option value="off_topic">Не по теме форума</option><option value="other">Другое</option></select></label>
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
    alert("Жалоба отправлена администратору.");
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
      <section><h2>11. Закрытие и модерация</h2><p>Автор может закрыть свою тему. После закрытия она остаётся доступной для чтения, но новые ответы не принимаются. Администратор может закрывать, переоткрывать и закреплять темы, скрывать нарушения, удалять темы без возможности восстановления, рассматривать жалобы и ограничивать доступ участника к форуму.</p></section>
      <section><h2>12. Отображение имени</h2><p>В форуме отображается имя участника и первая буква фамилии, если эти данные указаны в Telegram. Telegram username, ID и номер телефона другим участникам не показываются. Если имя не указано, используется постоянное нейтральное обозначение участника.</p></section>
      <section><h2>13. Ответственность участника</h2><p>Публикуя тему или ответ, участник подтверждает, что ознакомился с правилами и несёт ответственность за содержание своего сообщения.</p></section>
    </div>`;
}

async function renderForumRules(returnTo) {
  if (!ensureForumAccess()) return;
  try {
    const bootstrap = await loadForumBootstrap();
    const accepted = forumRulesAccepted(bootstrap);
    const acceptance = accepted
      ? `<div class="forum-form-ok">Текущая версия правил принята.</div>`
      : `<div class="forum-rules-accept-panel">
          <label class="forum-rule-check"><input type="checkbox" id="forum-rules-final-check" onchange="toggleForumRulesAcceptButton()"><span>Я прочитал правила Бизнес-форума, ознакомлен с ограничениями и принимаю их.</span></label>
          <button class="btn primary" id="forum-rules-accept-button" onclick="acceptForumRules('${forumEsc(returnTo || "forum")}')" disabled>Принять правила и открыть форум</button>
        </div>`;
    const backAction = accepted && returnTo === "create"
      ? "renderForumCreateTopic()"
      : accepted && returnTo === "topic" && forumState.currentTopicId
      ? `renderForumTopic('${forumEsc(forumState.currentTopicId)}')`
      : "renderBusinessForum()";

    forumShell(`
      ${card("blue-card-v2 forum-hero compact", `<p class="eyebrow">Бизнес-форум</p><h1>Правила</h1><p>Прочитайте документ до конца. Остальные разделы форума откроются после подтверждения.</p>`)}
      ${forumRulesHtml()}
      <div class="forum-actions sticky-actions">${acceptance}<button class="btn secondary" onclick="${backAction}">${accepted ? "Вернуться" : "Вернуться без принятия"}</button></div>
    `);
  } catch (error) {
    forumErrorScreen(error, "renderBusinessForum()");
  }
}

function toggleForumRulesAcceptButton() {
  const checkbox = document.getElementById("forum-rules-final-check");
  const button = document.getElementById("forum-rules-accept-button");
  if (button) button.disabled = !checkbox?.checked;
}

async function acceptForumRules(returnTo) {
  const checkbox = document.getElementById("forum-rules-final-check");
  if (checkbox && !checkbox.checked) {
    alert("Поставьте отметку о принятии правил.");
    return;
  }
  try {
    await forumApi("accept_rules", {});
    if (forumState.bootstrap) forumState.bootstrap.rules_accepted = true;
    forumState.bootstrap = null;
    if (returnTo === "create") return renderForumCreateTopic();
    if (returnTo === "topic" && forumState.currentTopicId) return renderForumTopic(forumState.currentTopicId);
    return renderBusinessForum();
  } catch (error) {
    alert(error?.message || forumReasonText(error?.result?.reason));
  }
}

function forumReportReasonLabel(reason) {
  return ({
    spam: "Реклама или спам",
    insult: "Оскорбление или агрессия",
    politics_religion: "Политика или религиозный спор",
    personal_data: "Персональные или конфиденциальные данные",
    illegal_content: "Незаконный или опасный материал",
    off_topic: "Не по теме форума",
    other: "Другое",
  })[reason] || "Другое";
}

function forumAdminReportRowHtml(report) {
  const targetLabel = report.target_type === "reply" ? "Ответ" : "Тема";
  const targetText = report.target_type === "reply"
    ? (report.reply_excerpt || "Ответ недоступен")
    : (report.topic_title || "Тема недоступна");
  const openButton = report.topic_id
    ? `<button class="btn secondary" onclick="renderForumTopic('${forumEsc(report.topic_id)}')">Открыть публикацию</button>`
    : `<button class="btn secondary" disabled>Публикация удалена</button>`;
  return `<article class="forum-admin-report-row">
    <div class="forum-admin-report-head"><div><span>${forumEsc(targetLabel)}</span><b>${forumEsc(forumReportReasonLabel(report.reason))}</b></div><em>${forumEsc(forumDate(report.created_at))}</em></div>
    <p><b>Жалобу отправил:</b> ${forumEsc(report.reporter_name || "Участник")}</p>
    <p><b>Автор публикации:</b> ${forumEsc(report.target_author_name || "Участник")}</p>
    <div class="forum-admin-report-target">${forumEsc(targetText)}</div>
    ${report.comment ? `<p><b>Комментарий:</b> ${forumEsc(report.comment)}</p>` : ""}
    <div class="forum-actions">${openButton}<button class="btn primary" onclick="forumAdminSetReportStatus('${forumEsc(report.id)}','reviewed')">Рассмотрено</button><button class="btn secondary" onclick="forumAdminSetReportStatus('${forumEsc(report.id)}','dismissed')">Отклонить жалобу</button></div>
  </article>`;
}

async function forumAdminLoadReports(status) {
  const box = document.getElementById("forum-admin-reports-list");
  const badge = document.getElementById("forum-admin-reports-count");
  if (!box || !(typeof isAdminUser === "function" && isAdminUser())) return;
  box.innerHTML = `<p class="small">Загружаем жалобы...</p>`;
  try {
    const result = await forumApi("admin_list_reports", { status: status || "new", limit: 50 });
    if (badge) badge.textContent = String(Number(result.new_count || 0));
    box.innerHTML = result.reports?.length
      ? result.reports.map(forumAdminReportRowHtml).join("")
      : `<div class="forum-empty compact"><b>Новых жалоб нет</b><p>Все обращения участников обработаны.</p></div>`;
  } catch (error) {
    box.innerHTML = `<div class="forum-inline-error">${forumEsc(error?.message || "Не удалось загрузить жалобы.")}</div>`;
  }
}

async function forumAdminSetReportStatus(reportId, status) {
  try {
    await forumApi("admin_update_report", { reportId, status });
    await forumAdminLoadReports("new");
  } catch (error) {
    alert(error?.message || "Не удалось обновить жалобу.");
  }
}

function injectForumAdminReportsPanel() {
  if (!(typeof isAdminUser === "function" && isAdminUser())) return;
  const content = document.querySelector(".content-v2");
  if (!content || document.getElementById("forum-admin-reports-card")) return;
  const html = `<section class="card-v2 forum-admin-reports-card" id="forum-admin-reports-card">
    <div class="forum-admin-reports-title"><div><p class="eyebrow">Бизнес-форум</p><h2>Жалобы участников</h2></div><span id="forum-admin-reports-count">0</span></div>
    <p>Здесь сохраняются жалобы на темы и ответы. Публикация не скрывается автоматически: администратор открывает её, принимает решение и затем отмечает жалобу рассмотренной.</p>
    <div id="forum-admin-reports-list"><p class="small">Загружаем жалобы...</p></div>
  </section>`;
  const firstCard = content.querySelector(".card-v2");
  if (firstCard) firstCard.insertAdjacentHTML("afterend", html);
  else content.insertAdjacentHTML("afterbegin", html);
  forumAdminLoadReports("new");
}

(function installForumAdminPanelEnhancement() {
  const original = window.renderAdmin;
  if (typeof original !== "function" || original.__forumReportsEnhanced) return;
  const enhanced = function (...args) {
    const result = original.apply(this, args);
    setTimeout(injectForumAdminReportsPanel, 0);
    return result;
  };
  enhanced.__forumReportsEnhanced = true;
  window.renderAdmin = enhanced;
})();

async function injectForumAdminProfileNotification() {
  // Уведомления модерации убраны из профиля.
  // Жалобы остаются только внутри панели администратора.
  return;
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
  forumStartReplyTo,
  forumCancelReplyTo,
  renderForumReport,
  submitForumReport,
  renderForumRules,
  acceptForumRules,
  toggleForumRulesAcceptButton,
  forumAdminLoadReports,
  forumAdminSetReportStatus,
  forumRejectForbiddenPaste,
  forumPreventFileDrop,
  forumCounter,
});


/* =====================================================
   v41 — форум закрыт для интерфейса ученика
   ===================================================== */
(function installForumStudentGuardV41(){
  var originalRenderBusinessForumV41 = window.renderBusinessForum;
  if (typeof originalRenderBusinessForumV41 !== 'function') return;
  window.renderBusinessForum = function(){
    if (!(typeof isAdminMode === 'function' && isAdminMode())) {
      alert('Раздел «Бизнес-форум» находится в подготовке.');
      if (typeof renderHome === 'function') renderHome();
      return;
    }
    return originalRenderBusinessForumV41.apply(this, arguments);
  };
})();
