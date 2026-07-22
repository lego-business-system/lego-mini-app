/* Полный учебный контент модуля «Бизнес как система».
   Загружает только собственные статические фрагменты и перехватывает
   запросы строго внутри content/business_architecture/. */
(function installBusinessArchitectureFullCourseData(){
  'use strict';
  var RELEASE='ba-v6-full-course-20260722';
  var CHUNKS=[
    'content/business_architecture/full-course/chunk-01.txt',
    'content/business_architecture/full-course/chunk-02.txt',
    'content/business_architecture/full-course/chunk-03.txt',
    'content/business_architecture/full-course/chunk-04.txt',
    'content/business_architecture/full-course/chunk-05.txt',
    'content/business_architecture/full-course/chunk-06.txt',
    'content/business_architecture/full-course/chunk-07.txt',
    'content/business_architecture/full-course/chunk-08.txt',
    'content/business_architecture/full-course/chunk-09.txt',
    'content/business_architecture/full-course/chunk-10.txt',
    'content/business_architecture/full-course/chunk-11.txt',
    'content/business_architecture/full-course/chunk-12.txt',
    'content/business_architecture/full-course/chunk-13.txt',
    'content/business_architecture/full-course/chunk-14.txt'
  ];
  var originalFetch=window.fetch.bind(window);
  var state={data:null,error:null,installed:false};

  function bytesFromBase64(value){
    var binary=window.atob(value); var bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i+=1) bytes[i]=binary.charCodeAt(i);
    return bytes;
  }
  async function gunzip(bytes){
    if(typeof DecompressionStream!=='function') throw new Error('Ваш браузер не поддерживает распаковку учебных материалов. Обновите Telegram или браузер.');
    var stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function pathOf(input){
    try {
      var raw=typeof input==='string'?input:(input&&input.url?input.url:String(input||''));
      return new URL(raw,window.location.href).pathname.replace(/\/+$/,'');
    } catch(e){ return ''; }
  }
  function matchData(path){
    if(!state.data) return null;
    if(/\/content\/business_architecture\/catalog\.json$/i.test(path)) return state.data.catalog;
    var lesson=path.match(/\/content\/business_architecture\/lessons\/(BA-\d{2})\.json$/i);
    if(lesson && state.data.lessons[lesson[1].toUpperCase()]) return state.data.lessons[lesson[1].toUpperCase()];
    var caseMatch=path.match(/\/content\/business_architecture\/cases\/(PART-\d{2}-CASE)\.json$/i);
    if(caseMatch && state.data.cases[caseMatch[1].toUpperCase()]) return state.data.cases[caseMatch[1].toUpperCase()];
    return null;
  }
  function installInterceptor(){
    if(state.installed) return; state.installed=true;
    window.fetch=function(input,init){
      var matched=matchData(pathOf(input));
      if(matched!==null) return Promise.resolve(new Response(JSON.stringify(matched),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Architecture-Release':RELEASE}}));
      return originalFetch(input,init);
    };
  }
  async function load(){
    try {
      var parts=await Promise.all(CHUNKS.map(function(url){ return originalFetch(url+'?v='+encodeURIComponent(RELEASE),{cache:'no-store'}).then(function(response){ if(!response.ok) throw new Error('Не удалось загрузить часть учебных материалов ('+response.status+').'); return response.text(); }); }));
      var compressed=bytesFromBase64(parts.join('').trim());
      var raw=await gunzip(compressed);
      state.data=JSON.parse(new TextDecoder('utf-8').decode(raw));
      installInterceptor();
      return state.data;
    } catch(error){ state.error=error; console.error('BA_FULL_COURSE_DATA_ERROR',error); throw error; }
  }
  state.ready=load();
  window.BusinessArchitectureFullCourseData=state;
})();
