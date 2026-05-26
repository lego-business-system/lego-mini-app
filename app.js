
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }
// ===== Supabase Edge Function для проверки доступа =====
const CHECK_ACCESS_URL = "https://soxtekhspohkddpdidvp.supabase.co/functions/v1/check-access";

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

    window.LEGO_USER = result.user;
    window.LEGO_ACCESS_REASON = result.reason;

    home();
  } catch (error) {
    console.error(error);
    accessDenied("CHECK_ACCESS_ERROR");
  }
}
const state = { slideIndex:0, currentQuestion:0, answers:{}, summaryIndex:0 };
const slides = [
 {title:"Диагностика выручки в торговле", body:["От жалобы «нет продаж» — к точному управленческому диагнозу.","Цель: понять, где бизнес теряет деньги: в потоке, конверсии, чеке, марже, запасах, расходах или учёте."], formula:"Выручка — не финальный результат. Важно понять, что остаётся в деньгах."},
 {title:"Симптом ≠ диагноз", body:["«Нет продаж» — это симптом.","Нельзя лечить рекламой то, что вызвано конверсией, маржой или учётом.","Сначала считаем, потом действуем."], formula:"Мнение → заменить данными. Догадку → заменить диагностикой."},
 {title:"Торговля как система денег", body:["Канал приводит клиента.","Клиент проходит путь покупки.","Покупка формирует чек.","Чек даёт маржу.","Маржа превращается в живые деньги только после расходов и запасов."], formula:"Клиент → Покупка → Чек → Маржа → Касса"},
 {title:"Главная формула", body:["Поток показывает, сколько людей пришло.","Конверсия показывает, сколько купили.","Средний чек показывает, сколько оставил один покупатель."], formula:"Выручка = Поток × Конверсия × Средний чек"},
 {title:"Добавляем прибыльность", body:["Выручка может расти, а денег может не быть.","Причины: низкая маржа, расходы, списания, склад, ошибки закупки."], formula:"Живые деньги = Выручка − Себестоимость − Расходы − Потери − Деньги в товаре"},
 {title:"Диагностическое дерево", body:["Нет потока → проверяем каналы.","Поток есть, покупок мало → конверсия.","Покупки есть, чек низкий → структура покупки.","Выручка есть, прибыли нет → маржа.","Продажи есть, денег нет → запасы, расходы, касса."], formula:"Один провал → один следующий модуль"},
 {title:"Метрики, которые считаем", body:["Поток / посетители / заявки.","Конверсия.","Средний чек.","Валовая маржа.","Операционный результат.","Товарные остатки."], formula:"Главная задача — найти один главный ограничитель."},
 {title:"Формулы", body:["Конверсия = Покупатели / Посетители × 100%.","Средний чек = Выручка / Покупки.","Валовая маржа = Выручка − Себестоимость.","Маржинальность = Валовая маржа / Выручка × 100%."], formula:"Формулы нужны не для отчёта, а для решения."},
 {title:"План на 7 дней", body:["Выбираем один главный провал.","Формулируем гипотезу.","Назначаем одно действие.","Выбираем одну метрику.","Через 7 дней сравниваем факт с ожиданием."], formula:"Гипотеза → действие → данные → вывод"},
 {title:"Что делать дальше", body:["Поток слабый → привлечение клиентов.","Покупок мало → конверсия.","Товар не попадает → ассортимент.","Чек низкий → средний чек.","Маржа слабая → прибыльность.","Деньги в товаре → запасы.","Есть потери → учёт и контроль.","Касса проседает → деньги и расходы."], formula:"Не проходить всё подряд. Идти туда, где найден провал."}
];
const quiz = [
 {q:"Что считается главной ошибкой предпринимателя в модуле?", a:["Считать выручку по дням","Сразу нанимать продавцов","Лечить симптом, не поставив диагноз","Делать план продаж"], correct:2},
 {q:"Фраза «нет продаж» в управленческом смысле означает:", a:["Нужно увеличить скидки","Это симптом, а не точный диагноз","Это всегда проблема рекламы","Это всегда проблема продавца"], correct:1},
 {q:"Какая формула лежит в основе первичной диагностики выручки?", a:["Выручка = аренда + зарплата","Выручка = поток × конверсия × средний чек","Выручка = прибыль × расходы","Выручка = реклама × локация"], correct:1},
 {q:"Если посетителей много, но покупают мало, где вероятная проблема?", a:["В потоке","В конверсии","В амортизации","В названии"], correct:1},
 {q:"Как считается конверсия?", a:["Выручка / посетители","Покупатели / посетители × 100%","Себестоимость / выручка","Средний чек / покупки"], correct:1},
 {q:"Как считается средний чек?", a:["Выручка / количество покупок","Расходы / покупателей","Прибыль / продавцов","Маржа / выручка"], correct:0},
 {q:"Продажи есть, но денег в кассе нет. Что проверяем?", a:["Только поток","Только вывеску","Маржу, расходы, запасы и кассу","Только конверсию"], correct:2},
 {q:"Если данных нет, первое действие:", a:["Повысить цены","Закупить больше товара","Вести минимальный учёт 7 дней","Запустить рекламу"], correct:2},
 {q:"Какой инструмент показывает путь клиента и неудобства?", a:["CJM","Баланс","SWOT","P&L"], correct:0},
 {q:"Какой инструмент проверяет товар, цену, место и продвижение?", a:["5 Why","4P","Kanban","ABC"], correct:1},
 {q:"Если маржа слабая, проверяем:", a:["Только вывеску","Цену, закупку, скидки и ассортимент","Только оформление","Только площадь"], correct:1},
 {q:"Результат модуля:", a:["Мотивация","Презентация без цифр","Диагноз и план на 7 дней","Список книг"], correct:2}
];
const books = [
 {title:"Business Model Generation", author:"А. Остервальдер, И. Пинье", idea:"Бизнес — это система: клиент, ценность, канал, доходы, расходы и процессы.", use:"В ДЗ смотри не только цифры, но и слабый блок бизнес-модели."},
 {title:"Marketing Management", author:"Филип Котлер", idea:"Маркетинг — это не только реклама. Это товар, цена, место и продвижение.", use:"В ДЗ проверь 4P: что продаёшь, кому, где и по какой цене."},
 {title:"Цель", author:"Элияху Голдратт", idea:"Рост начинается с поиска главного ограничения системы.", use:"В ДЗ выбери один главный провал, а не список всего подряд."},
 {title:"Бережливый стартап", author:"Эрик Рис", idea:"Улучшения проверяются короткими циклами: гипотеза → действие → данные → вывод.", use:"План на 7 дней должен быть проверкой одной гипотезы."},
 {title:"Сбалансированная система показателей", author:"Р. Каплан, Д. Нортон", idea:"Бизнесом нельзя управлять только по выручке.", use:"В ДЗ смотри финансы, клиента, процессы и развитие управления."}
];
function shell(content, footer="") { document.getElementById("app").innerHTML = `<div class="app-shell"><div class="topbar"><div class="brand"><div><div class="logo">Л.Е.Г.О</div><div class="tagline">самое главное — не уйти только с теорией, а применить в практике</div></div><div class="badge">MVP</div></div></div><main class="content">${content}</main>${footer}</div>`; }
function home(){ shell(`<div class="card"><h1>Л.Е.Г.О Бизнес-система</h1><p>Первый модуль MVP: диагностика выручки в торговле.</p><div class="lesson-meta"><div class="meta-box"><b>Формат</b><span class="small">презентация внутри приложения</span></div><div class="meta-box"><b>Результат</b><span class="small">диагноз + план на 7 дней</span></div></div></div><div class="card"><h2>Диагностика выручки в торговле</h2><p>Поймёшь, где бизнес теряет деньги: в потоке, конверсии, чеке, марже, запасах, расходах или учёте.</p><button class="btn gold" onclick="startLesson()">Начать модуль</button></div><div class="card locked"><h3>Следующий модуль</h3><p>Откроется автоматически через 7 дней или вручную после проверки ДЗ.</p></div>`); }
function startLesson(){ state.slideIndex=0; renderSlide(); }
function renderSlide(){ const s=slides[state.slideIndex]; const pct=Math.round(((state.slideIndex+1)/slides.length)*100); shell(`<div class="progress"><div style="width:${pct}%"></div></div><div class="slide"><div><div class="slide-head"><div class="slide-logo">Л.Е.Г.О</div><div class="slide-note">система внедрения управленческих изменений</div></div><div class="slide-number">Слайд ${state.slideIndex+1} / ${slides.length}</div><div class="slide-title">${s.title}</div><div class="slide-body"><ul>${s.body.map(x=>`<li>${x}</li>`).join("")}</ul><div class="formula">${s.formula}</div></div></div><div class="slide-foot">Диагностика → действие → проверка результата</div></div>`, `<div class="footer-nav"><button class="btn secondary" onclick="prevSlide()" ${state.slideIndex===0?'disabled':''}>Назад</button><button class="btn gold" onclick="nextSlide()">${state.slideIndex===slides.length-1?'К тесту':'Далее'}</button></div>`); }
function prevSlide(){ if(state.slideIndex>0){state.slideIndex--;renderSlide();} } function nextSlide(){ if(state.slideIndex<slides.length-1){state.slideIndex++;renderSlide();}else quizIntro(); }
function quizIntro(){ shell(`<div class="card"><h1>Тест на понимание</h1><p>12 вопросов. Проходной результат — 70%, минимум 9 правильных ответов.</p><p>Если результат ниже, нужно вернуться к презентации.</p><button class="btn gold" onclick="startQuiz()">Начать тест</button></div>`); }
function startQuiz(){ state.currentQuestion=0; state.answers={}; renderQuestion(); }
function renderQuestion(){ const q=quiz[state.currentQuestion]; shell(`<div class="progress"><div style="width:${Math.round(((state.currentQuestion+1)/quiz.length)*100)}%"></div></div><div class="card"><p class="small">Вопрос ${state.currentQuestion+1} / ${quiz.length}</p><h2>${q.q}</h2>${q.a.map((opt,i)=>`<button class="option ${state.answers[state.currentQuestion]===i?'selected':''}" onclick="selectAnswer(${i})">${String.fromCharCode(65+i)}. ${opt}</button>`).join("")}</div>`, `<div class="footer-nav"><button class="btn secondary" onclick="prevQuestion()" ${state.currentQuestion===0?'disabled':''}>Назад</button><button class="btn gold" onclick="nextQuestion()">${state.currentQuestion===quiz.length-1?'Завершить':'Далее'}</button></div>`); }
function selectAnswer(i){ state.answers[state.currentQuestion]=i; renderQuestion(); } function prevQuestion(){ if(state.currentQuestion>0){state.currentQuestion--;renderQuestion();} } function nextQuestion(){ if(state.answers[state.currentQuestion]===undefined) return alert('Выбери вариант ответа.'); if(state.currentQuestion<quiz.length-1){state.currentQuestion++;renderQuestion();} else quizResult(); }
function quizResult(){ let score=0; quiz.forEach((q,i)=>{ if(state.answers[i]===q.correct) score++; }); const passed=score>=9; shell(`<div class="card ${passed?'result-ok':'result-bad'}"><h1>${passed?'Тест пройден':'Тест не пройден'}</h1><p>Результат: <b>${score} / ${quiz.length}</b></p><p>${passed?'Можно переходить к саммари книг.':'Пока рано переходить к ДЗ. Повтори презентацию и пройди тест ещё раз.'}</p><button class="btn gold" onclick="${passed?'startBooks()':'startLesson()'}">${passed?'К саммари книг':'Повторить презентацию'}</button></div>`); }
function startBooks(){ state.summaryIndex=0; renderBook(); }
function renderBook(){ const b=books[state.summaryIndex]; shell(`<div class="progress"><div style="width:${Math.round(((state.summaryIndex+1)/books.length)*100)}%"></div></div><div class="card"><p class="small">Книга ${state.summaryIndex+1} / ${books.length}</p><h1>${b.title}</h1><p><b>${b.author}</b></p><h3>Главная идея</h3><p>${b.idea}</p><h3>Как применить в ДЗ</h3><p>${b.use}</p></div><div class="card"><h3>Смысл блока</h3><p>Эти идеи могут казаться повторяющимися, но именно такие системы предприниматель должен постоянно держать в голове: клиент, ценность, канал, метрика, ограничение и действие.</p></div>`, `<div class="footer-nav"><button class="btn secondary" onclick="prevBook()" ${state.summaryIndex===0?'disabled':''}>Назад</button><button class="btn gold" onclick="nextBook()">${state.summaryIndex===books.length-1?'К ДЗ':'Далее'}</button></div>`); }
function prevBook(){ if(state.summaryIndex>0){state.summaryIndex--;renderBook();} } function nextBook(){ if(state.summaryIndex<books.length-1){state.summaryIndex++;renderBook();} else homeworkIntro(); }
function homeworkIntro(){ shell(`<div class="card"><h1>Домашнее задание</h1><p>Открой шаблон Google Sheets, заполни данные и сформулируй главный провал бизнеса.</p><p>Если данных нет — не придумывай. Веди минимальный учёт 7 дней.</p><div class="grid"><a class="btn gold" href="#" onclick="alert('Здесь позже будет ссылка на Google Sheets-шаблон.');return false;">Открыть шаблон</a><button class="btn" onclick="submissionForm()">Сдать ДЗ</button></div></div>`); }
function submissionForm(){ shell(`<div class="card"><h1>Сдача ДЗ</h1><p class="small">В MVP это пока форма-заглушка. Дальше подключим базу данных и сохранение ответов.</p><div class="list-line"><b>1. Ссылка на таблицу</b><p>Google Sheets ученика</p></div><div class="list-line"><b>2. Главный провал</b><p>Поток / конверсия / чек / маржа / запасы / расходы / учёт</p></div><div class="list-line"><b>3. Гипотеза на 7 дней</b><p>Что проверяем и какой результат ждём</p></div><div class="list-line"><b>4. Метрика проверки</b><p>По чему поймём, что стало лучше</p></div><button class="btn gold" onclick="finish()">Пока отметить как отправлено</button></div>`); }
function finish(){ shell(`<div class="card"><h1>ДЗ отправлено</h1><p>Статус: на проверке.</p><p>Следующий модуль открывается автоматически через 7 дней или вручную после принятия ДЗ.</p><button class="btn gold" onclick="home()">На главный экран</button></div>`); }
checkAccess();
