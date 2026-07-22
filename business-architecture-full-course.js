/* =========================================================
   АРХИТЕКТУРА БИЗНЕСА — полный маршрут
   Изолированное расширение существующего модуля.
   app.js, форум, профиль, отраслевые уроки и старый прогресс
   не изменяются.
   ========================================================= */
(function installBusinessArchitectureFullCourse(){
  'use strict';

  var RELEASE = 'ba-v6-full-course-20260722';
  var CATALOG_URL = 'content/business_architecture/catalog.json';
  var STORAGE_KEY = 'architecture_business_progress_v2';
  var installed = false;
  var catalogCache = null;
  var syncStarted = false;
  var original = {};

  function ba(){ return window.BusinessArchitecture || null; }
  function esc(value){
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,Number(value)||0)); }
  function isPlainObject(value){ return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function safeAlert(message){
    try {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && typeof tg.showAlert === 'function') return tg.showAlert(String(message||''));
    } catch(e) {}
    window.alert(String(message||''));
  }
  function loadProgress(){
    try {
      var api = ba();
      if (api && typeof api.getProgress === 'function') return api.getProgress() || {lessons:{}};
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      parsed.lessons = isPlainObject(parsed.lessons) ? parsed.lessons : {};
      return parsed;
    } catch(e){ return {lessons:{}}; }
  }
  function adminPreview(){
    try { if (typeof window.isAdminMode === 'function' && window.isAdminMode()) return true; } catch(e) {}
    try { if (typeof window.isAdminUser === 'function' && window.isAdminUser()) return true; } catch(e) {}
    try {
      if (typeof state !== 'undefined' && state && (state.adminMode === true || state.isAdmin === true)) return true;
    } catch(e) {}
    return false;
  }
  async function waitForFullData(){
    var source=window.BusinessArchitectureFullCourseData;
    if (source && source.ready) await source.ready;
  }
  async function loadCatalog(force){
    await waitForFullData();
    if (catalogCache && !force) return catalogCache;
    var divider = CATALOG_URL.indexOf('?') >= 0 ? '&' : '?';
    var response = await fetch(CATALOG_URL + divider + 'v=' + encodeURIComponent(RELEASE), {cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось загрузить структуру курса (' + response.status + ').');
    catalogCache = await response.json();
    return catalogCache;
  }
  function entries(catalog){
    var result=[];
    (catalog.parts||[]).forEach(function(part){
      (part.lessons||[]).forEach(function(item){
        if (item.status === 'available') result.push(Object.assign({},item,{item_type:'lesson',part_id:part.id,part_number:part.number,part_title:part.title}));
      });
      if (part.integration_case && part.integration_case.status === 'available') {
        result.push(Object.assign({},part.integration_case,{item_type:'case',part_id:part.id,part_number:part.number,part_title:part.title,chapter:'Итог'}));
      }
    });
    return result;
  }
  function progressFor(progress,id){ return progress && progress.lessons && progress.lessons[id] ? progress.lessons[id] : null; }
  function done(progress,id){ var p=progressFor(progress,id); return Boolean(p && p.completedAt); }
  function hasWorkspace(p){
    if (!p || !p.workspace) return false;
    if (p.workspace.route || p.workspace.completedAt) return true;
    if (p.workspace.final && Object.keys(p.workspace.final).some(function(k){ return String(p.workspace.final[k]||'').trim(); })) return true;
    return Object.keys(p.workspace.sections||{}).some(function(k){
      var s=p.workspace.sections[k]||{};
      if (String(s.evidence||'').trim()) return true;
      return Object.keys(s.fields||{}).some(function(f){ return String(s.fields[f]||'').trim(); });
    });
  }
  function hasProgress(progress,id){
    var p=progressFor(progress,id);
    return Boolean(p && (p.completedAt || (p.completedStages||[]).length || hasWorkspace(p) || (p.quiz && (p.quiz.attempts||[]).length)));
  }
  function unlocked(all,progress,id){
    if (adminPreview()) return true;
    var index=all.findIndex(function(x){ return x.id===id; });
    if (index<0) return false;
    if (index===0 || hasProgress(progress,id)) return true;
    return done(progress,all[index-1].id);
  }
  function workspaceUnlocked(progress,id){
    if (adminPreview()) return true;
    var p=progressFor(progress,id);
    return Boolean(p && (((p.completedStages||[]).indexOf('decision_lab')>=0) || hasWorkspace(p) || ((p.completedStages||[]).indexOf('architecture_assembly')>=0)));
  }
  function stageCount(progress,id){ var p=progressFor(progress,id); return p && Array.isArray(p.completedStages) ? p.completedStages.length : 0; }
  function entryLabel(entry){ return entry.item_type==='case' ? 'Комплексный разбор' : 'Урок ' + Number(entry.number||1); }
  function renderShell(content,options){
    var opts=options||{};
    var wrapped='<div class="ba-root"><div class="ba-shell">'+content+'</div></div>';
    if (typeof window.shell === 'function') window.shell(wrapped,'home');
    else { var app=document.getElementById('app'); if(app) app.innerHTML=wrapped; }
    if (opts.top !== false) {
      try { window.scrollTo({top:0,behavior:'smooth'}); } catch(e){ window.scrollTo(0,0); }
    }
    setTimeout(function(){
      document.querySelectorAll('[data-ba-full-saved]').forEach(function(node){ node.textContent='Сохранено'; });
    },0);
  }
  function loading(title){
    renderShell('<section class="ba-card ba-empty"><p class="ba-eyebrow">БИЗНЕС КАК СИСТЕМА</p><h2>'+esc(title||'Открываем материалы')+'</h2><p>Загружаем курс и сохранённое место.</p></section>');
  }
  function errorView(error){
    console.error('BA_FULL_COURSE_ERROR',error);
    renderShell('<section class="ba-card"><p class="ba-eyebrow">РАЗДЕЛ ВРЕМЕННО НЕ ОТКРЫЛСЯ</p><h2>Не удалось загрузить материалы</h2><p>'+esc(error && error.message ? error.message : error)+'</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.renderHome()">Повторить</button><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openAppHome()">На главную</button></div></section>');
  }
  function syncOnce(){
    if (syncStarted) return Promise.resolve();
    syncStarted=true;
    var api=ba();
    if (!api || typeof api.syncNow!=='function') return Promise.resolve();
    return Promise.resolve(api.syncNow()).catch(function(error){ console.warn('BA_FULL_SYNC',error); });
  }
  function partProgress(part,all,progress){
    var list=all.filter(function(e){ return e.part_id===part.id; });
    var completed=list.filter(function(e){ return done(progress,e.id); }).length;
    var stages=list.reduce(function(total,e){ return total+stageCount(progress,e.id); },0);
    var totalStages=list.reduce(function(total,e){ return total+Number(e.stages||4); },0);
    return {list:list,completed:completed,total:list.length,stages:stages,totalStages:totalStages,percent:totalStages?Math.round(stages/totalStages*100):0};
  }
  function renderEntryRow(entry,all,progress){
    var isDone=done(progress,entry.id);
    var isOpen=unlocked(all,progress,entry.id);
    var started=hasProgress(progress,entry.id);
    var isCase=entry.item_type==='case';
    var status=isDone?'готово':(isOpen?(started?'продолжить':'открыто'):'после предыдущего');
    var cls=isDone?'is-done':(!isOpen?'is-locked':'');
    var click=isOpen?' onclick="BusinessArchitecture.openLesson(\''+esc(entry.id)+'\')"':' disabled aria-disabled="true"';
    return '<button class="ba-lesson-row '+cls+(isCase?' ba-case-row':'')+'"'+click+'>'+
      '<span class="ba-lesson-index '+(isCase?'ba-case-index':'')+'">'+(isCase?'ИТОГ':String(entry.number).padStart(2,'0'))+'</span>'+
      '<span><b>'+esc(entry.title)+'</b><small>'+(isCase?'Связывает результаты всех уроков части':'Глава '+esc(entry.chapter)+' · четыре последовательных раздела')+'</small></span>'+
      '<span class="ba-status '+(isDone?'is-done':isOpen?'is-active':'')+'">'+status+'</span></button>';
  }
  function renderPart(part,all,progress){
    var info=partProgress(part,all,progress);
    var rows=info.list.map(function(entry){ return renderEntryRow(entry,all,progress); }).join('');
    var allDone=info.completed===info.total && info.total>0;
    return '<section class="ba-part is-open ba-fc-part" data-ba-fc-part="'+esc(part.id)+'">'+
      '<button class="ba-part-head" onclick="BusinessArchitectureFullCourse.togglePart(\''+esc(part.id)+'\')"><span class="ba-part-head-row"><span class="ba-number-chip">'+esc(part.number)+'</span><span><b>'+esc(part.title)+'</b><small>'+esc(part.description)+'</small></span><span class="ba-part-arrow">›</span></span></button>'+
      '<div class="ba-part-body"><div class="ba-fc-part-progress"><div><span>'+info.completed+' из '+info.total+' завершено</span><b>'+info.percent+'%</b></div><div class="ba-progress-bar"><i style="width:'+clamp(info.percent,0,100)+'%"></i></div></div><div class="ba-lesson-list">'+rows+'</div><div class="ba-note ba-note-teal ba-part-result"><b>Результат части:</b> '+esc(part.result)+'</div>'+(allDone?'<div class="ba-fc-done-note">Часть завершена</div>':'')+'</div></section>';
  }
  async function renderHome(){
    try {
      loading('Открываем курс');
      await syncOnce();
      var catalog=await loadCatalog(false);
      var all=entries(catalog);
      var progress=loadProgress();
      var current=all.find(function(e){ return !done(progress,e.id) && unlocked(all,progress,e.id); }) || null;
      var totalStages=all.reduce(function(t,e){ return t+Number(e.stages||4); },0);
      var completedStages=all.reduce(function(t,e){ return t+stageCount(progress,e.id); },0);
      var percent=totalStages?Math.round(completedStages/totalStages*100):0;
      var started=completedStages>0 || all.some(function(e){ return hasProgress(progress,e.id); });
      var anyMaterials=all.some(function(e){ return workspaceUnlocked(progress,e.id); });
      var html='<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.openAppHome()">← Главная</button></div>'+
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">БИЗНЕС КАК СИСТЕМА</p><h1>'+esc(catalog.module.title)+'</h1><p>Полный маршрут по финансовой реальности, стратегии, людям, данным, рискам, продукту, росту, диагностике и внедрению.</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">'+(started?'Продолжить обучение':'Начать обучение')+'</button><button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.openExamplesLibrary()">Практические материалы</button>'+(anyMaterials?'<button class="ba-btn ba-btn-light" onclick="BusinessArchitecture.renderMyArchitecture()">Мои материалы</button>':'')+'</div></section>';
      if (started) html+='<section class="ba-card ba-progress-card"><div><p class="ba-eyebrow">ПРОГРЕСС</p><h2>'+(current?esc(current.title):'Маршрут завершён')+'</h2><p>'+(current?'Продолжайте с первого незавершённого раздела.':'Все уроки и комплексные разборы завершены.')+'</p><div class="ba-progress-bar"><i style="width:'+clamp(percent,0,100)+'%"></i></div></div><div class="ba-progress-number">'+percent+'%</div></section>';
      html+='<section class="ba-card"><p class="ba-eyebrow">МАРШРУТ</p><h2>Четыре взаимосвязанные части</h2><p>Каждая часть заканчивается комплексным разбором и новым рабочим материалом бизнеса.</p><div class="ba-part-list">'+(catalog.parts||[]).map(function(part){ return renderPart(part,all,progress); }).join('')+'</div></section><div class="ba-footer-space"></div>';
      renderShell(html);
    } catch(error){ errorView(error); }
  }
  function togglePart(partId){ var node=document.querySelector('[data-ba-fc-part="'+CSS.escape(partId)+'"]'); if(node) node.classList.toggle('is-open'); }
  async function continueRoute(){
    try {
      var catalog=await loadCatalog(false); var all=entries(catalog); var progress=loadProgress();
      var entry=all.find(function(e){ return !done(progress,e.id) && unlocked(all,progress,e.id); });
      if (!entry) return renderMyArchitecture();
      return ba().openLesson(entry.id);
    } catch(error){ errorView(error); }
  }
  function materialCompleteness(p){
    if (!p || !p.workspace) return 0;
    var filled=0,total=0;
    Object.keys(p.workspace.sections||{}).forEach(function(id){
      var s=p.workspace.sections[id]||{};
      Object.keys(s.fields||{}).forEach(function(k){ total+=1; if(String(s.fields[k]||'').trim()) filled+=1; });
      total+=1; if(String(s.evidence||'').trim()) filled+=1;
    });
    Object.keys(p.workspace.final||{}).forEach(function(k){ total+=1; if(String(p.workspace.final[k]||'').trim()) filled+=1; });
    if (p.workspace.completedAt) return 100;
    return total?Math.round(filled/total*100):0;
  }
  function materialCard(entry,progress){
    var p=progressFor(progress,entry.id)||{};
    var pct=materialCompleteness(p);
    var isDone=Boolean(p.completedAt);
    var title=entry.item_type==='case' ? entry.result || entry.title : entry.title;
    var status=isDone?'готово':pct?'в работе':'доступно';
    return '<button class="ba-material-card '+(isDone?'is-done':'')+'" onclick="BusinessArchitecture.renderWorkspace(\''+esc(entry.id)+'\')"><span class="ba-material-card-top"><span><small>'+esc(entryLabel(entry))+'</small><b>'+esc(title)+'</b></span><span class="ba-status '+(isDone?'is-done':'is-active')+'">'+status+'</span></span><span class="ba-material-card-progress"><i style="width:'+pct+'%"></i></span><span class="ba-material-card-meta">'+pct+'% · черновик сохраняется автоматически</span></button>';
  }
  async function renderMyArchitecture(){
    try {
      loading('Открываем ваши материалы');
      await syncOnce();
      var catalog=await loadCatalog(false); var all=entries(catalog); var progress=loadProgress();
      var groups=[];
      (catalog.parts||[]).forEach(function(part){
        var list=all.filter(function(e){ return e.part_id===part.id && (workspaceUnlocked(progress,e.id) || hasProgress(progress,e.id)); });
        if (list.length) groups.push({part:part,list:list});
      });
      if (!groups.length) {
        return renderShell('<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button></div><section class="ba-card ba-empty"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>Рабочие карты появятся после управленческих задач</h2><p>Начните первый урок. После теста откроется практическая сборка материала.</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">Продолжить обучение</button></div></section>');
      }
      var allComplete=all.length>0 && all.every(function(e){ return done(progress,e.id); });
      var html='<div class="ba-topline"><button class="ba-back" onclick="BusinessArchitecture.renderHome()">← К курсу</button><span class="ba-status '+(allComplete?'is-done':'is-active')+'">'+(allComplete?'Маршрут завершён':'Черновики сохраняются')+'</span></div>'+
        '<section class="ba-hero ba-hero-compact"><p class="ba-eyebrow">МОИ МАТЕРИАЛЫ</p><h2>'+(allComplete?'Паспорт архитектуры бизнеса':'Рабочие карты бизнеса')+'</h2><p>'+(allComplete?'Все системы связаны в итоговый паспорт и дорожную карту.':'Здесь накапливаются результаты уроков и комплексных разборов.')+'</p><div class="ba-actions"><button class="ba-btn ba-btn-primary" onclick="BusinessArchitecture.continueRoute()">Продолжить обучение</button></div></section>';
      groups.forEach(function(group){
        html+='<section class="ba-card ba-fc-material-part"><p class="ba-eyebrow">ЧАСТЬ '+esc(group.part.number)+'</p><h2>'+esc(group.part.title)+'</h2><p>'+esc(group.part.result)+'</p><div class="ba-material-grid">'+group.list.map(function(e){ return materialCard(e,progress); }).join('')+'</div></section>';
      });
      html+='<div class="ba-footer-space"></div>';
      renderShell(html);
    } catch(error){ errorView(error); }
  }
  function patchCaseHeading(entryId){
    loadCatalog(false).then(function(catalog){
      var entry=entries(catalog).find(function(e){ return e.id===entryId; });
      if (!entry || entry.item_type!=='case') return;
      document.querySelectorAll('.ba-root .ba-hero .ba-eyebrow').forEach(function(node){
        if (/КОМПЛЕКСНЫЙ РАЗБОР|ГЛАВА\s*ИТОГ|ЧАСТЬ\s*I/i.test(node.textContent||'')) node.textContent='ЧАСТЬ '+entry.part_number+' · КОМПЛЕКСНЫЙ РАЗБОР';
      });
    }).catch(function(){});
  }
  function install(){
    if (installed || !ba()) return false;
    installed=true;
    original.renderHome=ba().renderHome;
    original.continueRoute=ba().continueRoute;
    original.renderMyArchitecture=ba().renderMyArchitecture;
    original.openLesson=ba().openLesson;
    original.completeWorkspace=ba().completeWorkspace;
    original.continueLesson=ba().continueLesson;

    ba().renderHome=renderHome;
    ba().continueRoute=continueRoute;
    ba().renderMyArchitecture=renderMyArchitecture;
    ba().openLesson=async function(entryId){
      await waitForFullData();
      var result=await original.openLesson(entryId);
      setTimeout(function(){ patchCaseHeading(entryId); },0);
      setTimeout(function(){ patchCaseHeading(entryId); },120);
      return result;
    };
    ba().completeWorkspace=function(entryId){
      var result=original.completeWorkspace(entryId);
      if (entryId==='PART-04-CASE') setTimeout(renderMyArchitecture,180);
      else setTimeout(function(){
        loadCatalog(false).then(function(catalog){
          var all=entries(catalog); var idx=all.findIndex(function(e){return e.id===entryId;});
          if (idx>=0 && idx<all.length-1) patchCaseHeading(all[idx+1].id);
        });
      },180);
      return result;
    };
    ba().continueLesson=async function(entryId){
      if (entryId==='PART-04-CASE' && done(loadProgress(),entryId)) return renderMyArchitecture();
      var result=await original.continueLesson(entryId);
      if (entryId==='PART-04-CASE') setTimeout(renderMyArchitecture,120);
      return result;
    };
    window.renderNoBusinessV40=renderHome;
    try { renderNoBusinessV40=renderHome; } catch(e) {}
    return true;
  }

  window.BusinessArchitectureFullCourse={version:RELEASE,install:install,renderHome:renderHome,renderMyArchitecture:renderMyArchitecture,continueRoute:continueRoute,togglePart:togglePart,loadCatalog:function(){return loadCatalog(true);}};
  if (!install()) {
    var attempts=0;
    var timer=setInterval(function(){ attempts+=1; if(install()||attempts>40) clearInterval(timer); },100);
  }
})();
