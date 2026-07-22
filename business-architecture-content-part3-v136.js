/* АРХИТЕКТУРА — загрузчик содержимого PART-03 v136 */
(function(){
  "use strict";
  const partId="PART-03";
  const base="content/business_architecture/runtime/";
  const files=["part3-0.txt","part3-1.txt","part3-2.txt","part3-3.txt"];
  function bytes(value){const raw=atob(value);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function install(){
    const chunks=await Promise.all(files.map(name=>fetch(base+name+"?v=ba-v6-full-20260723",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Не удалось загрузить содержимое: "+name);return r.text();})));
    const stream=new Blob([bytes(chunks.join(""))]).stream().pipeThrough(new DecompressionStream("gzip"));
    const code=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
    const current=window.BusinessArchitectureContentV136&&window.BusinessArchitectureContentV136[partId];
    if(!current||current===placeholder||typeof current.load!=="function")throw new Error("Содержимое части не подключено: "+partId);
    return current.load();
  }
  window.BusinessArchitectureContentV136=window.BusinessArchitectureContentV136||{};
  let promise=null;
  const placeholder={load:function(){if(!promise)promise=install();return promise;}};
  window.BusinessArchitectureContentV136[partId]=placeholder;
})();
