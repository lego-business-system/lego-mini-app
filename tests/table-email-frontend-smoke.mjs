import assert from "node:assert/strict";
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
