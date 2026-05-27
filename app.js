const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// ===== Supabase Edge Functions =====
const CHECK_ACCESS_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/check-access";
const SAVE_PROGRESS_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/save-progress";
const CURRENT_LESSON_CODE = "ENT-TR-01";

// ===== Картинки урока =====
const lessonSlides = [
  "assets/lesson/slide_01.png",
  "assets/lesson/slide_02.png",
  "assets/lesson/slide_03.png",
  "assets/lesson/slide_04.png",
  "assets/lesson/slide_05.png",
  "assets/lesson/slide_06.png",
  "assets/lesson/slide_07.png",
  "assets/lesson/slide_08.png",
  "assets/lesson/slide_09.png",
  "assets/lesson/slide_10.png",
  "assets/lesson/slide_11.png",
  "assets/lesson/slide_12.png",
  "assets/lesson/slide_13.png",
  "assets/lesson/slide_14.png",
  "assets/lesson/slide_15.png",
  "assets/lesson/slide_16.png"
];

// ===== Картинки саммари книг =====
const bookSlides = [
  "assets/books/book1/book1_01.png",
  "assets/books/book1/book1_02.png",
  "assets/books/book1/book1_03.png",
  "assets/books/book1/book1_04.png",
  "assets/books/book1/book1_05.png",

  "assets/books/book2/book2_01.png",
  "assets/books/book2/book2_02.png",
  "assets/books/book2/book2_03.png",
  "assets/books/book2/book2_04.png",
  "assets/books/book2/book2_05.png",

  "assets/books/book3/book3_01.png",
  "assets/books/book3/book3_02.png",
  "assets/books/book3/book3_03.png",
  "assets/books/book3/book3_04.png",
  "assets/books/book3/book3_05.png",

  "assets/books/book4/book4_01.png",
  "assets/books/book4/book4_02.png",
  "assets/books/book4/book4_03.png",
  "assets/books/book4/book4_04.png",
  "assets/books/book4/book4_05.png",

  "assets/books/book5/book5_01.png",
  "assets/books/book5/book5_02.png",
  "assets/books/book5/book5_03.png",
  "assets/books/book5/book5_04.png",
  "assets/books/book5/book5_05.png",

  "assets/books/final_summary.png"
];

const state = {
  screen: "loading",
  access: false,
  accessReason: null,
  user: null,
  lesson: null,
  progress: null,
  lastQuizAttempt: null,
  slideIndex: 0,
  bookSlideIndex: 0,
  currentQuestion: 0,
  answers: {},
  completed: {
    presentation: false,
    quiz: false,
    books: false,
    homework: false
  }
};

const quiz = [
  {
    q: "Что считается главной ошибкой предпринимателя в модуле?",
    a: ["Считать выручку по дням", "Сразу нанимать продавцов", "Лечить симптом, не поставив диагноз", "Делать план продаж"],
    correct: 2
  },
  {
    q: "Фраза «нет продаж» в управленческом смысле означает:",
    a: ["Нужно увеличить скидки", "Это симптом, а не точный диагноз", "Это всегда проблема рекламы", "Это всегда проблема продавца"],
    correct: 1
  },
  {
    q: "Какая формула лежит в основе первичной диагностики выручки?",
    a: ["Выручка = аренда + зарплата", "Выручка = поток × конверсия × средний чек", "Выручка = прибыль × расходы", "Выручка = реклама × локация"],
    correct: 1
  },
  {
    q: "Если посетителей много, но покупают мало, где вероятная проблема?",
    a: ["В потоке", "В конверсии", "В амортизации", "В названии"],
    correct: 1
  },
  {
    q: "Как считается конверсия?",
    a: ["Выручка / посетители", "Покупатели / посетители × 100%", "Себестоимость / выручка", "Средний чек / покупки"],
    correct: 1
  },
  {
    q: "Как считается средний чек?",
    a: ["Выручка / количество покупок", "Расходы / покупателей", "Прибыль / продавцов", "Маржа / выручка"],
    correct: 0
  },
  {
    q: "Продажи есть, но денег в кассе нет. Что проверяем?",
    a: ["Только поток", "Только вывеску", "Маржу, расходы, запасы и кассу", "Только конверсию"],
    correct: 2
  },
  {
    q: "Если данных нет, первое действие:",
    a: ["Повысить цены", "Закупить больше товара", "Вести минимальный учёт 7 дней", "Запустить рекламу"],
    correct: 2
  },
  {
    q: "Какой инструмент показывает путь клиента и неудобства?",
    a: ["CJM", "Баланс", "SWOT", "P&L"],
    correct: 0
  },
  {
    q: "Какой инструмент проверяет товар, цену, место и продвижение?",
    a: ["5 Why", "4P", "Kanban", "ABC"],
    correct: 1
  },
  {
    q: "Если маржа слабая, проверяем:",
    a: ["Только вывеску", "Цену, закупку, скидки и ассортимент", "Только оформление", "Только площадь"],
    correct: 1
  },
  {
    q: "Результат модуля:",
    a: ["Мотивация", "Презентация без цифр", "Диагноз и план на 7 дней", "Список книг"],
    correct: 2
  }
];

function shell(content, footer = "") {
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <div class="topbar">
        <div class="brand">
          <div>
            <div class="logo">Л.Е.Г.О</div>
            <div class="tagline">самое главное — не уйти только с теорией, а применить в практике</div>
          </div>
          <div class="badge">BETA</div>
        </div>
      </div>
      <main class="content">${content}</main>
      ${footer}
    </div>
  `;
}

function imageScreen(imageUrl, current, total, typeLabel) {
  return `
    <div class="progress"><div style="width:${Math.round((current / total) * 100)}%"></div></div>
    <div class="card" style="padding:0; overflow:hidden;">
      <img 
        src="${imageUrl}" 
        alt="${typeLabel} ${current}" 
        style="width:100%; display:block; border-radius:22px;"
      />
    </div>
    <p class="small" style="text-align:center;">${typeLabel}: ${current} / ${total}</p>
  `;
}

function loadingScreen() {
  shell(`
    <div class="card">
      <h1>Проверяем доступ</h1>
      <p>Система проверяет Telegram-профиль и доступ к закрытому каналу.</p>
      <p class="small">Если проверка длится долго, открой приложение именно из Telegram-бота, а не по ссылке в браузере.</p>
    </div>
  `);
}

function accessDenied(reason = "NO_ACCESS") {
  shell(`
    <div class="card result-bad">
      <h1>Доступ закрыт</h1>
      <p>Приложение доступно только участникам закрытого Telegram-канала.</p>
      <p>Причина проверки: <b>${reason}</b></p>
      <p class="small">Если у тебя есть активная подписка, открой приложение из Telegram и проверь, что ты находишься в закрытом канале.</p>
    </div>
  `);
}

function getProgressLabel() {
  const p = state.progress;

  if (!p) return "Модуль ещё не начат.";
  if (p.status === "homework_submitted") return "Домашнее задание отправлено на проверку.";
  if (p.status === "completed") return "Модуль завершён.";

  if (p.current_step === "presentation") return "Ты остановился на презентации.";
  if (p.current_step === "quiz") return "Следующий шаг — тест.";
  if (p.current_step === "books") return "Следующий шаг — саммари книг.";
  if (p.current_step === "homework") return "Следующий шаг — домашнее задание.";
  if (p.current_step === "review") return "Домашнее задание ожидает проверки.";

  return "Модуль в процессе.";
}

function getMainButtonText() {
  const p = state.progress;

  if (!p) return "Начать модуль";
  if (p.status === "homework_submitted") return "Посмотреть статус ДЗ";
  if (p.status === "completed") return "Посмотреть модуль";
  if (p.current_step) return "Продолжить";

  return "Начать модуль";
}

async function checkAccess() {
  loadingScreen();

  if (!tg || !tg.initData) {
    accessDenied("OPEN_FROM_TELEGRAM_REQUIRED");
    return;
  }

  try {
    const response = await fetch(CHECK_ACCESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        initData: tg.initData
      })
    });

    const result = await response.json();

    if (!response.ok || !result.access) {
      console.error("Access denied:", result);
      accessDenied(result.reason || "ACCESS_DENIED");
      return;
    }

    state.access = true;
    state.accessReason = result.reason;
    state.user = result.user;
    state.lesson = result.lesson || null;
    state.progress = result.progress || null;
    state.lastQuizAttempt = result.last_quiz_attempt || null;

    if (state.progress) {
      state.completed.presentation = Boolean(state.progress.presentation_completed);
      state.completed.quiz = Boolean(state.progress.quiz_completed);
      state.completed.books = Boolean(state.progress.books_completed);
      state.completed.homework = Boolean(state.progress.homework_submitted);
    }

    home();
  } catch (error) {
    console.error(error);
    accessDenied("CHECK_ACCESS_ERROR");
  }
}

async function saveProgress(event, payload = {}) {
  if (!tg || !tg.initData) return;

  try {
    const response = await fetch(SAVE_PROGRESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        initData: tg.initData,
        lessonCode: CURRENT_LESSON_CODE,
        event,
        payload
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Progress save failed:", result);
      return result;
    }

    if (result.progress) {
      state.progress = result.progress;
      state.completed.presentation = Boolean(result.progress.presentation_completed);
      state.completed.quiz = Boolean(result.progress.quiz_completed);
      state.completed.books = Boolean(result.progress.books_completed);
      state.completed.homework = Boolean(result.progress.homework_submitted);
    }

    return result;
  } catch (error) {
    console.error("Progress save error:", error);
  }
}

function home() {
  const name = state.user?.first_name ? `, ${state.user.first_name}` : "";
  const progressLabel = getProgressLabel();
  const buttonText = getMainButtonText();

  shell(`
    <div class="card">
      <h1>Л.Е.Г.О Бизнес-система</h1>
      <p>Доступ подтверждён${name}.</p>
      <p class="small">Статус доступа: ${state.accessReason || "active"}</p>
      <div class="lesson-meta">
        <div class="meta-box"><b>Формат</b><span class="small">презентация внутри приложения</span></div>
        <div class="meta-box"><b>Результат</b><span class="small">диагноз + план на 7 дней</span></div>
      </div>
    </div>

    <div class="card">
      <h2>Диагностика выручки в торговле</h2>
      <p>Поймёшь, где бизнес теряет деньги: в потоке, конверсии, чеке, марже, запасах, расходах или учёте.</p>
      <p class="small">${progressLabel}</p>
      ${state.lastQuizAttempt ? `<p class="small">Последний тест: ${state.lastQuizAttempt.score}/${state.lastQuizAttempt.total}</p>` : ""}
      <button class="btn gold" onclick="continueLesson()">${buttonText}</button>
    </div>

    <div class="card locked">
      <h3>Следующий модуль</h3>
      <p>Откроется автоматически через 7 дней или вручную после проверки ДЗ.</p>
    </div>
  `);
}

async function continueLesson() {
  const p = state.progress;

  if (!p) {
    await startLesson();
    return;
  }

  if (p.status === "homework_submitted" || p.current_step === "review") {
    homeworkSubmittedScreen();
    return;
  }

  if (p.status === "completed") {
    state.slideIndex = 0;
    renderLessonSlide();
    return;
  }

  if (p.current_step === "presentation") {
    const savedSlide = Number(p.last_slide_number || 1);
    state.slideIndex = Math.min(Math.max(savedSlide - 1, 0), lessonSlides.length - 1);
    renderLessonSlide();
    return;
  }

  if (p.current_step === "quiz") {
    quizIntro();
    return;
  }

  if (p.current_step === "books") {
    startBooks();
    return;
  }

  if (p.current_step === "homework") {
    homeworkIntro();
    return;
  }

  await startLesson();
}

async function startLesson() {
  state.screen = "slides";
  state.slideIndex = 0;
  await saveProgress("lesson_started");
  renderLessonSlide();
}

function renderLessonSlide() {
  const current = state.slideIndex + 1;
  const total = lessonSlides.length;

  shell(
    imageScreen(lessonSlides[state.slideIndex], current, total, "Слайд"),
    `
      <div class="footer-nav">
        <button class="btn secondary" onclick="prevLessonSlide()" ${state.slideIndex === 0 ? "disabled" : ""}>Назад</button>
        <button class="btn gold" onclick="nextLessonSlide()">${state.slideIndex === lessonSlides.length - 1 ? "К тесту" : "Далее"}</button>
      </div>
    `
  );
}

function prevLessonSlide() {
  if (state.slideIndex > 0) {
    state.slideIndex--;
    renderLessonSlide();
  }
}

async function nextLessonSlide() {
  if (state.slideIndex < lessonSlides.length - 1) {
    state.slideIndex++;

    await saveProgress("slide_viewed", {
      lastSlideNumber: state.slideIndex + 1
    });

    renderLessonSlide();
  } else {
    state.completed.presentation = true;
    state.screen = "quizIntro";

    await saveProgress("presentation_completed", {
      lastSlideNumber: lessonSlides.length
    });

    quizIntro();
  }
}

function quizIntro() {
  shell(`
    <div class="card">
      <h1>Тест на понимание</h1>
      <p>12 вопросов. Проходной результат — 70%, то есть минимум 9 правильных ответов.</p>
      <p>Если результат ниже, нужно вернуться к презентации и повторить ключевые слайды.</p>
      <button class="btn gold" onclick="startQuiz()">Начать тест</button>
      <button class="btn secondary" onclick="home()" style="margin-top:10px;">На главный экран</button>
    </div>
  `);
}

function startQuiz() {
  state.currentQuestion = 0;
  state.answers = {};
  renderQuestion();
}

function renderQuestion() {
  const q = quiz[state.currentQuestion];

  shell(`
    <div class="progress"><div style="width:${Math.round(((state.currentQuestion + 1) / quiz.length) * 100)}%"></div></div>
    <div class="card">
      <p class="small">Вопрос ${state.currentQuestion + 1} / ${quiz.length}</p>
      <h2>${q.q}</h2>
      ${q.a.map((opt, i) => `
        <button class="option ${state.answers[state.currentQuestion] === i ? "selected" : ""}" onclick="selectAnswer(${i})">
          ${String.fromCharCode(65 + i)}. ${opt}
        </button>
      `).join("")}
    </div>
  `, `
    <div class="footer-nav">
      <button class="btn secondary" onclick="prevQuestion()" ${state.currentQuestion === 0 ? "disabled" : ""}>Назад</button>
      <button class="btn gold" onclick="nextQuestion()">${state.currentQuestion === quiz.length - 1 ? "Завершить" : "Далее"}</button>
    </div>
  `);
}

function selectAnswer(i) {
  state.answers[state.currentQuestion] = i;
  renderQuestion();
}

function prevQuestion() {
  if (state.currentQuestion > 0) {
    state.currentQuestion--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (state.answers[state.currentQuestion] === undefined) {
    alert("Выбери вариант ответа.");
    return;
  }

  if (state.currentQuestion < quiz.length - 1) {
    state.currentQuestion++;
    renderQuestion();
  } else {
    quizResult();
  }
}

async function quizResult() {
  let score = 0;

  quiz.forEach((q, i) => {
    if (state.answers[i] === q.correct) score++;
  });

  const passed = score >= 9;
  state.completed.quiz = passed;

  await saveProgress("quiz_completed", {
    score,
    total: quiz.length,
    passed,
    answers: state.answers
  });

  if (passed) {
    shell(`
      <div class="card result-ok">
        <h1>Тест пройден</h1>
        <p>Результат: <b>${score} / ${quiz.length}</b></p>
        <p>Базовая логика диагностики усвоена. Теперь можно переходить к саммари книг.</p>

        <button class="btn gold" onclick="startBooks()">К саммари книг</button>
        <button class="btn secondary" onclick="home()" style="margin-top:10px;">На главный экран</button>
      </div>
    `);

    return;
  }

  shell(`
    <div class="card result-bad">
      <h1>Тест не пройден</h1>
      <p>Результат: <b>${score} / ${quiz.length}</b></p>

      <p>Пока рано переходить к саммари книг и домашнему заданию.</p>
      <p>Вернись к презентации и повтори ключевые блоки.</p>

      <div class="list-line"><b>1. Симптом и диагноз</b><p>Почему “нет продаж” — это не точная причина.</p></div>
      <div class="list-line"><b>2. Формула выручки</b><p>Поток × конверсия × средний чек.</p></div>
      <div class="list-line"><b>3. Конверсия и средний чек</b><p>Где бизнес теряет результат внутри продаж.</p></div>
      <div class="list-line"><b>4. Маржа и деньги</b><p>Почему выручка не равна живым деньгам.</p></div>
      <div class="list-line"><b>5. Главное ограничение</b><p>Почему нельзя улучшать всё подряд.</p></div>

      <button class="btn gold" onclick="startLesson()">Вернуться к презентации</button>
      <button class="btn secondary" onclick="quizIntro()" style="margin-top:10px;">Повторить тест</button>
      <button class="btn secondary" onclick="home()" style="margin-top:10px;">На главный экран</button>
    </div>
  `);
}

function startBooks() {
  state.bookSlideIndex = 0;
  renderBookSlide();
}

function renderBookSlide() {
  const current = state.bookSlideIndex + 1;
  const total = bookSlides.length;

  shell(
    imageScreen(bookSlides[state.bookSlideIndex], current, total, "Саммари"),
    `
      <div class="footer-nav">
        <button class="btn secondary" onclick="prevBookSlide()" ${state.bookSlideIndex === 0 ? "disabled" : ""}>Назад</button>
        <button class="btn gold" onclick="nextBookSlide()">${state.bookSlideIndex === bookSlides.length - 1 ? "К ДЗ" : "Далее"}</button>
      </div>
    `
  );
}

function prevBookSlide() {
  if (state.bookSlideIndex > 0) {
    state.bookSlideIndex--;
    renderBookSlide();
  }
}

async function nextBookSlide() {
  if (state.bookSlideIndex < bookSlides.length - 1) {
    state.bookSlideIndex++;
    renderBookSlide();
  } else {
    state.completed.books = true;

    await saveProgress("books_completed");

    homeworkIntro();
  }
}

function homeworkIntro() {
  saveProgress("homework_started");

  shell(`
    <div class="card">
      <h1>Домашнее задание</h1>
      <p>Открой шаблон Google Sheets, заполни данные и сформулируй главный провал бизнеса.</p>
      <p>Если данных нет — не придумывай. Веди минимальный учёт 7 дней.</p>
      <div class="grid">
        <a class="btn gold" href="#" onclick="alert('Здесь позже будет ссылка на Google Sheets-шаблон.');return false;">Открыть шаблон</a>
        <button class="btn" onclick="submissionForm()">Сдать ДЗ</button>
        <button class="btn secondary" onclick="home()">На главный экран</button>
      </div>
    </div>
  `);
}

function submissionForm() {
  shell(`
    <div class="card">
      <h1>Сдача ДЗ</h1>
      <p class="small">Следующим шагом подключим сохранение формы ДЗ в Supabase.</p>
      <div class="list-line"><b>1. Ссылка на таблицу</b><p>Google Sheets ученика</p></div>
      <div class="list-line"><b>2. Главный провал</b><p>Поток / конверсия / чек / маржа / запасы / расходы / учёт</p></div>
      <div class="list-line"><b>3. Гипотеза на 7 дней</b><p>Что проверяем и какой результат ждём</p></div>
      <div class="list-line"><b>4. Метрика проверки</b><p>По чему поймём, что стало лучше</p></div>
      <button class="btn gold" onclick="finish()">Пока отметить как отправлено</button>
      <button class="btn secondary" onclick="home()" style="margin-top:10px;">На главный экран</button>
    </div>
  `);
}

function finish() {
  saveProgress("homework_submitted");
  homeworkSubmittedScreen();
}

function homeworkSubmittedScreen() {
  shell(`
    <div class="card">
      <h1>ДЗ отправлено</h1>
      <p>Статус: на проверке.</p>
      <p>Следующий модуль открывается автоматически через 7 дней или вручную после принятия ДЗ.</p>
      <button class="btn gold" onclick="home()">На главный экран</button>
    </div>
  `);
}

// Старт приложения
checkAccess();
