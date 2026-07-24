/* АРХИТЕКТУРА — финансовое мышление v138: разделы 2–11 */
(function installFinanceThinkingV138Loader(){
  "use strict";
  const RELEASE = "finance-thinking-v138-20260724";
  const PARTS = [
    "content/finance_thinking_v138/bundle/part-00.txt",
    "content/finance_thinking_v138/bundle/part-01.txt",
    "content/finance_thinking_v138/bundle/part-02.txt",
    "content/finance_thinking_v138/bundle/part-03.txt",
    "content/finance_thinking_v138/bundle/part-04.txt",
    "content/finance_thinking_v138/bundle/part-05.txt",
    "content/finance_thinking_v138/bundle/part-06.txt",
    "content/finance_thinking_v138/bundle/part-07.txt",
    "content/finance_thinking_v138/bundle/part-08.txt",
    "content/finance_thinking_v138/bundle/part-09.txt",
    "content/finance_thinking_v138/bundle/part-10.txt",
    "content/finance_thinking_v138/bundle/part-11.txt",
    "content/finance_thinking_v138/bundle/part-12.txt",
    "content/finance_thinking_v138/bundle/part-13.txt",
    "content/finance_thinking_v138/bundle/part-14.txt",
    "content/finance_thinking_v138/bundle/part-15.txt",
    "content/finance_thinking_v138/bundle/part-16.txt",
    "content/finance_thinking_v138/bundle/part-17.txt",
    "content/finance_thinking_v138/bundle/part-18.txt",
    "content/finance_thinking_v138/bundle/part-19.txt",
    "content/finance_thinking_v138/bundle/part-20.txt",
    "content/finance_thinking_v138/bundle/part-21.txt",
    "content/finance_thinking_v138/bundle/part-22.txt",
    "content/finance_thinking_v138/bundle/part-23.txt"
  ];
  function toBytes(value){
    const raw = atob(String(value || "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  async function unpackGzipBase64(value){
    if (typeof DecompressionStream !== "function") throw new Error("Обновите Telegram или браузер до актуальной версии.");
    const stream = new Blob([toBytes(value)]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }
  async function loadPart(path){
    const response = await fetch(`${path}?v=${encodeURIComponent(RELEASE)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
    return response.text();
  }
  async function start(){
    const encoded = (await Promise.all(PARTS.map(loadPart))).join("");
    const payload = JSON.parse(await unpackGzipBase64(encoded));
    if (!payload || !payload.runtime || !payload.css || !payload.data) throw new Error("Финансовый модуль загружен не полностью.");
    if (!document.getElementById("finance-thinking-v138-style")) {
      const style = document.createElement("style");
      style.id = "finance-thinking-v138-style";
      style.dataset.release = RELEASE;
      style.textContent = payload.css;
      document.head.appendChild(style);
    }
    window.FinanceThinkingDataV138 = { release: RELEASE, load: async function(){ return payload.data; } };
    const url = URL.createObjectURL(new Blob([payload.runtime], { type: "text/javascript" }));
    try { await import(url); } finally { URL.revokeObjectURL(url); }
    if (!window.FinanceThinkingV138) throw new Error("Финансовый модуль не зарегистрирован.");
    return window.FinanceThinkingV138;
  }
  window.FinanceThinkingV138Ready = start().catch(function(error){
    console.error("FINANCE_V138_BOOT_ERROR", error);
    return null;
  });
})();
