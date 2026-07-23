/* АРХИТЕКТУРА — полный финансовый модуль v138 */
(function(){
  "use strict";
  const RELEASE="finance-thinking-v138-20260724";
  const FILES=[
    "content/finance_thinking_v138/bundle/part-00.txt",
    "content/finance_thinking_v138/bundle/part-01.txt",
    "content/finance_thinking_v138/bundle/part-02.txt",
    "content/finance_thinking_v138/bundle/part-03.txt",
    "content/finance_thinking_v138/bundle/part-04.txt",
    "content/finance_thinking_v138/bundle/part-05a.txt",
    "content/finance_thinking_v138/bundle/part-05b.txt",
    "content/finance_thinking_v138/bundle/part-06.txt",
    "content/finance_thinking_v138/bundle/part-07.txt",
    "content/finance_thinking_v138/bundle/part-08a.txt",
    "content/finance_thinking_v138/bundle/part-08b.txt",
    "content/finance_thinking_v138/bundle/part-09a.txt",
    "content/finance_thinking_v138/bundle/part-09b.txt",
    "content/finance_thinking_v138/bundle/part-10.txt",
    "content/finance_thinking_v138/bundle/part-11.txt",
    "content/finance_thinking_v138/bundle/part-12a.txt",
    "content/finance_thinking_v138/bundle/part-12b.txt",
    "content/finance_thinking_v138/bundle/part-13.txt"
  ];
  function bytes(value){const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i+=1)out[i]=raw.charCodeAt(i);return out;}
  async function unpack(encoded){if(typeof DecompressionStream!=="function")throw new Error("Обновите Telegram или браузер до актуальной версии.");const stream=new Blob([bytes(encoded)]).stream().pipeThrough(new DecompressionStream("gzip"));return new Response(stream).text();}
  async function start(){
    const parts=await Promise.all(FILES.map(path=>fetch(path+"?v="+encodeURIComponent(RELEASE),{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Не удалось загрузить финансовый модуль: "+path);return response.text();})));
    const payload=JSON.parse(await unpack(parts.join("")));
    if(!document.getElementById("finance-thinking-v138-style")){const style=document.createElement("style");style.id="finance-thinking-v138-style";style.dataset.release=RELEASE;style.textContent=payload.css;document.head.appendChild(style);}
    window.FinanceThinkingDataV138={release:RELEASE,load:async()=>payload.data};
    const url=URL.createObjectURL(new Blob([payload.runtime],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
    return window.FinanceThinkingV138;
  }
  window.FinanceThinkingV138Ready=start().catch(error=>{console.error("FINANCE_V138_BOOT_ERROR",error);throw error;});
})();
