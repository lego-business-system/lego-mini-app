/* АРХИТЕКТУРА — загрузчик содержимого PART-02 v136 */
(function(){
  "use strict";
  const base="content/business_architecture/runtime/";
  const files=["part2-0.txt", "part2-1.txt", "part2-2.txt", "part2-3.txt", "part2-4.txt"];
  function bytes(value){const raw=atob(value);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function install(){
    const chunks=await Promise.all(files.map(name=>fetch(base+name+"?v=ba-v6-full-20260723",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Не удалось загрузить содержимое: "+name);return r.text();})));
    const stream=new Blob([bytes(chunks.join(""))]).stream().pipeThrough(new DecompressionStream("gzip"));
    const code=await new Response(stream).text();
    const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
    try{await import(url);}finally{URL.revokeObjectURL(url);}
    return window.BusinessArchitectureContentV136 && window.BusinessArchitectureContentV136["PART-02"];
  }
  window.BusinessArchitectureContentLoaderV136=window.BusinessArchitectureContentLoaderV136||{};
  window.BusinessArchitectureContentLoaderV136["PART-02"]=install();
})();
