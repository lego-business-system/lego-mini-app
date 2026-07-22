/* АРХИТЕКТУРА — загрузчик полного модуля v136 */
(function(){
  "use strict";
  const base="content/business_architecture/runtime/";
  const files=["engine-0.txt", "engine-1.txt"];
  function bytes(value){const raw=atob(value);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function start(){
    const chunks=await Promise.all(files.map(name=>fetch(base+name+"?v=ba-v6-full-20260723",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Не удалось загрузить модуль: "+name);return r.text();})));
    const stream=new Blob([bytes(chunks.join(""))]).stream().pipeThrough(new DecompressionStream("gzip"));
    const code=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
    return window.BusinessArchitecture;
  }
  window.BusinessArchitectureReady=start().catch(error=>{console.error("BA_FULL_BOOT_ERROR",error);throw error;});
})();
