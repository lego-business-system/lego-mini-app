from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: ожидалось одно совпадение, найдено {count}")
    return text.replace(old, new, 1)


frontend_path = ROOT / "table-email.js"
frontend = frontend_path.read_text(encoding="utf-8")

frontend_replacements = [
    (
        "   v140 — Отправка Google-таблиц на email (пилот)",
        "   v143 — Отправка Google-таблиц на email",
        "заголовок модуля",
    ),
    (
        "(function installTableEmailPilotV140(){",
        "(function installTableEmailPublicV143(){",
        "имя установщика",
    ),
    (
        'var TABLE_EMAIL_VERSION_V140 = "v140-table-email-pilot-20260726";',
        'var TABLE_EMAIL_VERSION_V140 = "v143-table-email-release-20260727";',
        "версия модуля",
    ),
    (
        '      EMAIL_REQUIRED: "Сначала укажите адрес электронной почты.",',
        '      EMAIL_REQUIRED: "Укажите адрес электронной почты.",',
        "сообщение EMAIL_REQUIRED",
    ),
    (
        '      INVALID_TABLE_URL: "Эту ссылку нельзя отправить. Доступны только Google Таблицы.",',
        '      INVALID_TABLE_URL: "Для этого материала отправка на почту недоступна.",',
        "сообщение INVALID_TABLE_URL",
    ),
    (
        '      RATE_LIMIT_MINUTE: "Письмо уже отправлялось недавно. Повторите через минуту.",',
        '      RATE_LIMIT_MINUTE: "Письмо уже отправлено. Новую отправку можно выполнить через минуту.",',
        "сообщение RATE_LIMIT_MINUTE",
    ),
    (
        '      RATE_LIMIT_DAY: "Достигнут дневной лимит отправок. Повторите завтра.",',
        '      RATE_LIMIT_DAY: "Сегодня уже отправлено максимальное количество материалов. Повторите завтра.",',
        "сообщение RATE_LIMIT_DAY",
    ),
    (
        '      DATABASE_NOT_READY: "Сервис ещё не подключён к базе данных.",',
        '      DATABASE_NOT_READY: "Не удалось подготовить отправку. Повторите попытку позже.",',
        "сообщение DATABASE_NOT_READY",
    ),
    (
        '      EMAIL_SERVICE_NOT_CONFIGURED: "Почтовый сервис ещё не настроен.",',
        '      EMAIL_SERVICE_NOT_CONFIGURED: "Отправка временно недоступна. Повторите попытку позже.",',
        "сообщение EMAIL_SERVICE_NOT_CONFIGURED",
    ),
    (
        "      '<p>Укажите почту, которую удобно открыть на компьютере или ноутбуке.</p>' +",
        "      '<p>Укажите email, который удобно открыть на компьютере или ноутбуке.</p>' +",
        "описание формы",
    ),
    (
        "        '<label for=\"table-email-input-v140\">Email</label>' +",
        "        '<label for=\"table-email-input-v140\">Электронная почта</label>' +",
        "подпись поля",
    ),
    (
        "      '<p class=\"small\">В пилотной версии адрес сохраняется без отдельного подтверждения. Его можно изменить после любой отправки.</p>'",
        "      '<p class=\"small\">Email сохранится для следующих отправок. Изменить его можно после любой отправки.</p>'",
        "пояснение о сохранении email",
    ),
]

for old, new, label in frontend_replacements:
    frontend = replace_once(frontend, old, new, label)

for forbidden in (
    "В пилотной версии",
    "Сервис ещё не подключён к базе данных.",
    "Почтовый сервис ещё не настроен.",
    "Доступны только Google Таблицы.",
):
    if forbidden in frontend:
        raise RuntimeError(f"В пользовательском интерфейсе остался служебный текст: {forbidden}")

frontend_path.write_text(frontend, encoding="utf-8")

index_path = ROOT / "index.html"
index = index_path.read_text(encoding="utf-8")
index = replace_once(
    index,
    'table-email.js?v=v140-table-email-pilot-20260726',
    'table-email.js?v=v143-table-email-release-20260727',
    "версия table-email.js в index.html",
)
index_path.write_text(index, encoding="utf-8")

workflow_path = ROOT / ".github/workflows/validate-table-email-pilot.yml"
workflow = workflow_path.read_text(encoding="utf-8")
workflow = replace_once(
    workflow,
    '      - "table-email.css"\n',
    '      - "table-email.css"\n      - "tests/table-email-frontend-smoke.mjs"\n',
    "путь smoke-теста",
)
workflow = replace_once(
    workflow,
    '      - name: Validate Edge Function TypeScript syntax\n',
    '      - name: Run frontend behavior smoke tests\n        run: node tests/table-email-frontend-smoke.mjs\n\n      - name: Validate Edge Function TypeScript syntax\n',
    "шаг smoke-теста",
)
workflow = replace_once(
    workflow,
    "              'table-email.js?v=v140-table-email-pilot-20260726',",
    "              'table-email.js?v=v143-table-email-release-20260727',",
    "ожидаемая версия JS",
)
workflow = replace_once(
    workflow,
    "          assert 'SUPABASE_SECRET_KEYS' not in frontend\n",
    "          assert 'SUPABASE_SECRET_KEYS' not in frontend\n"
    "          assert 'Email сохранится для следующих отправок.' in frontend\n"
    "          assert 'В пилотной версии' not in frontend\n"
    "          assert 'Сервис ещё не подключён к базе данных.' not in frontend\n"
    "          assert 'Почтовый сервис ещё не настроен.' not in frontend\n"
    "          assert 'Доступны только Google Таблицы.' not in frontend\n",
    "проверки пользовательских текстов",
)
workflow = replace_once(
    workflow,
    "              'RATE_LIMIT_DAY',\n",
    "              'RATE_LIMIT_DAY',\n"
    "              'url.protocol !== \"https:\"',\n"
    "              'url.hostname !== \"docs.google.com\"',\n"
    "              'receivedHash',\n"
    "              'auth_date',\n"
    "              'app_table_email_profiles',\n"
    "              'app_table_email_sends',\n"
    "              'status: \"pending\"',\n"
    "              'status: \"sent\"',\n"
    "              'provider_message_id',\n"
    "              'sent_at',\n",
    "расширенные серверные проверки",
)
workflow_path.write_text(workflow, encoding="utf-8")

tests_dir = ROOT / "tests"
tests_dir.mkdir(exist_ok=True)

test_source = r'''import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "table-email.js"), "utf8");

class MockClassList {
  constructor() {
    this.values = new Set();
  }
  contains(value) {
    return this.values.has(value);
  }
  add(value) {
    this.values.add(value);
  }
  remove(value) {
    this.values.delete(value);
  }
}

class MockNode {
  constructor(tagName, options = {}) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.textContent = options.textContent || "";
    this.attributes = { ...(options.attributes || {}) };
    this.dataset = {};
    this.classList = new MockClassList();
    this.parentElement = options.parentElement || null;
    this.parentNode = null;
    this.listeners = {};
    this.insertedAfter = [];
    this.disabled = false;
    this.className = "";
    this.type = "";
  }
  get href() {
    return this.attributes.href || "";
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  querySelector() {
    return null;
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  insertAdjacentElement(position, element) {
    assert.equal(position, "afterend");
    this.insertedAfter.push(element);
  }
}

let scanNodes = [];
const bodyChildren = [];
const documentMock = {
  baseURI: "https://app.example/",
  documentElement: { classList: new MockClassList() },
  body: {
    appendChild(node) {
      node.parentNode = this;
      bodyChildren.push(node);
    },
    removeChild(node) {
      const index = bodyChildren.indexOf(node);
      if (index >= 0) bodyChildren.splice(index, 1);
    },
  },
  getElementById(id) {
    return id === "app" ? {} : null;
  },
  querySelectorAll() {
    return scanNodes;
  },
  createElement(tagName) {
    return new MockNode(tagName);
  },
  addEventListener() {},
  removeEventListener() {},
};

const context = {
  window: {
    Telegram: { WebApp: { initData: "signed-init-data" } },
  },
  document: documentMock,
  URL,
  console,
  AbortController,
  MutationObserver: undefined,
  setTimeout(handler) {
    handler();
    return 1;
  },
  clearTimeout() {},
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "table-email.js" });

const api = context.window.__TABLE_EMAIL_V140;
assert.ok(api, "table-email.js должен зарегистрировать публичный API");
assert.equal(api.version, "v143-table-email-release-20260727");

const sheetUrl = "https://docs.google.com/spreadsheets/d/1abcdefghijklmnopqrstuv/edit?gid=1#gid=1";
const directTable = new MockNode("a", {
  textContent: "Открыть рабочий шаблон",
  attributes: { href: sheetUrl },
});
assert.deepEqual(
  JSON.parse(JSON.stringify(api.detectMaterial(directTable))),
  { url: sheetUrl, title: "рабочий шаблон", kind: "table" },
);

const directExample = new MockNode("a", {
  textContent: "Посмотреть заполненный пример",
  attributes: { href: sheetUrl },
});
assert.equal(api.detectMaterial(directExample).kind, "example");

const directInstruction = new MockNode("a", {
  textContent: "Открыть инструкцию",
  attributes: { href: sheetUrl },
});
assert.equal(api.detectMaterial(directInstruction).kind, "instruction");

const maliciousHost = new MockNode("a", {
  textContent: "Поддельная таблица",
  attributes: {
    href: "https://docs.google.com.evil.example/spreadsheets/d/1abcdefghijklmnopqrstuv/edit",
  },
});
assert.equal(api.detectMaterial(maliciousHost), null);

const ordinaryLink = new MockNode("a", {
  textContent: "Обычный сайт",
  attributes: { href: "https://example.com/" },
});
assert.equal(api.detectMaterial(ordinaryLink), null);

const selfStudy = new MockNode("button", {
  textContent: "Открыть рабочий шаблон",
  attributes: {
    onclick: `openSelfStudyTemplateV999("${sheetUrl}")`,
  },
});
assert.equal(api.detectMaterial(selfStudy).url, sheetUrl);

const knownCases = [
  ["openBreakEvenTableV110()", "Точка безубыточности", "table"],
  ["openBusinessEquationTableV107()", "Единое уравнение бизнеса", "table"],
  ["openCreditFilterTableV128()", "Кредитный фильтр", "table"],
  ["openCreditFilterExampleV128()", "Заполненный пример кредитного фильтра", "example"],
  ["openUnitEconomicsTableV131()", "Калькулятор юнит-экономики", "table"],
  ["openCashGapRadarTableV132()", "Радар кассового разрыва на 13 недель", "table"],
  ["openManagementPnlTableV139()", "Управленческий ОПиУ на 12 месяцев", "table"],
  ["openManagementPnlInstructionV139()", "Инструкция к управленческому ОПиУ", "instruction"],
  ["openManagementPnlExampleV139()", "Заполненный пример управленческого ОПиУ", "example"],
];

for (const [onclick, title, kind] of knownCases) {
  const node = new MockNode("button", {
    textContent: "Открыть материал",
    attributes: { onclick },
  });
  const material = api.detectMaterial(node);
  assert.ok(material, `Не распознан обработчик ${onclick}`);
  assert.equal(material.title, title);
  assert.equal(material.kind, kind);
  assert.ok(material.url.startsWith("https://docs.google.com/spreadsheets/d/"));
}

scanNodes = [directTable, ordinaryLink];
api.scan();
assert.equal(directTable.insertedAfter.length, 1);
assert.equal(directTable.insertedAfter[0].textContent, "Отправить на почту");
assert.equal(typeof directTable.insertedAfter[0].listeners.click, "function");
assert.equal(ordinaryLink.insertedAfter.length, 0);

api.scan();
assert.equal(directTable.insertedAfter.length, 1, "Кнопка не должна дублироваться");

assert.ok(source.includes("Email сохранится для следующих отправок."));
assert.ok(!source.includes("В пилотной версии"));
assert.ok(!source.includes("Сервис ещё не подключён к базе данных."));
assert.ok(!source.includes("Почтовый сервис ещё не настроен."));
assert.ok(!source.includes("Доступны только Google Таблицы."));

console.log("Table email frontend behavior smoke tests passed");
'''

(ROOT / "tests/table-email-frontend-smoke.mjs").write_text(test_source, encoding="utf-8")

# Внутренняя документация также должна отражать рабочий, а не пилотный статус.
docs_path = ROOT / "docs/table-email-pilot-setup.md"
docs = docs_path.read_text(encoding="utf-8")
docs = docs.replace(
    "# Пилот: отправка учебных Google-таблиц на email",
    "# Отправка учебных Google-таблиц на email",
    1,
)
docs = docs.replace(
    "## Известное ограничение пилота",
    "## Текущее ограничение",
    1,
)
docs = docs.replace(
    "Email сохраняется без отдельного письма-подтверждения. Это осознанное упрощение первой версии. Защита пилота строится на проверке Telegram-пользователя, ограничении частоты отправок и запрете произвольных ссылок вне Google Таблиц.",
    "Email сохраняется без отдельного письма-подтверждения. Защита функции строится на проверке Telegram-пользователя, ограничении частоты отправок и запрете произвольных ссылок вне Google Таблиц.",
    1,
)
docs = docs.replace(
    '<script src="table-email.js?v=v140-table-email-pilot-20260726"></script>',
    '<script src="table-email.js?v=v143-table-email-release-20260727"></script>',
    1,
)
docs_path.write_text(docs, encoding="utf-8")

print("Table email release cleanup applied")
