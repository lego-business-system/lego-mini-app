/* АРХИТЕКТУРА — пакет уроков services · v137 */
(function(){
  "use strict";
  const activity="services";
  const release="v137-entrepreneur-deep-lessons-20260723";
  const files=["content/entrepreneur_v137/services-0.txt", "content/entrepreneur_v137/services-1.txt", "content/entrepreneur_v137/services-2.txt", "content/entrepreneur_v137/services-3.txt"];
  function bytes(value){const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i+=1)out[i]=raw.charCodeAt(i);return out;}
  let installPromise=null;
  async function install(){
    if(installPromise)return installPromise;
    installPromise=(async function(){
      if(typeof DecompressionStream!=="function")throw new Error("Обновите Telegram или браузер до актуальной версии.");
      const chunks=await Promise.all(files.map(function(path){return fetch(path+"?v="+encodeURIComponent(release),{cache:"no-store"}).then(function(response){if(!response.ok)throw new Error("Не удалось загрузить часть уроков: "+path);return response.text();});}));
      const stream=new Blob([bytes(chunks.join(""))]).stream().pipeThrough(new DecompressionStream("gzip"));
      const code=await new Response(stream).text();
      const url=URL.createObjectURL(new Blob([code],{type:"text/javascript"}));
      try{await import(url);}finally{URL.revokeObjectURL(url);}
      const actual=window.EntrepreneurLessonBundlesV137&&window.EntrepreneurLessonBundlesV137[activity];
      if(!actual||actual===placeholder||typeof actual.load!=="function")throw new Error("Пакет уроков не зарегистрирован: "+activity);
      return actual;
    })();
    return installPromise;
  }
  window.EntrepreneurLessonBundlesV137=window.EntrepreneurLessonBundlesV137||{};
  const placeholder={load:async function(){const actual=await install();return actual.load();}};
  window.EntrepreneurLessonBundlesV137[activity]=placeholder;
})();
