/* ---- módulo integrado ---- */
(function(){
'use strict';
if(window.__POLADENT_STAGE3__) return;
window.__POLADENT_STAGE3__=true;
const $=(s,r=document)=>r.querySelector(s);
function addStatus(){
  if($('#pcSystemStatus')) return;
  const bar=document.createElement('div');
  bar.id='pcSystemStatus';
  bar.className='pc-system-status';
  bar.innerHTML='<span class="pc-dot"></span><span id="pcSystemStatusText">Comprobando conexión…</span><button type="button" id="pcReloadView">Actualizar vista</button>';
  document.body.appendChild(bar);
  $('#pcReloadView').onclick=()=>location.reload();
}
function setStatus(){
  const bar=$('#pcSystemStatus'),txt=$('#pcSystemStatusText'); if(!bar||!txt)return;
  const online=navigator.onLine;
  bar.classList.toggle('offline',!online);
  txt.textContent=online?'Sistema conectado':'Sin conexión a internet';
}
function installLoadingGuard(){
  // La portada debe quedar interactiva desde el primer instante.
  // El overlay de preparación no debe bloquear los botones principales.
  if($('#home') && !$('#home').classList.contains('hidden')) return;
  if($('#pcBootOverlay'))return;
  const ov=document.createElement('div');ov.id='pcBootOverlay';ov.className='pc-boot-overlay';
  ov.innerHTML='<div class="pc-boot-card"><img src="img/logo-poladent.png" alt="Poladent"><div class="pc-spinner"></div><b>Preparando el sistema…</b><small>Cargando empleados, asistencia y configuración.</small></div>';
  document.body.appendChild(ov);
  const close=()=>{ov.classList.add('done');setTimeout(()=>ov.remove(),320)};
  if(document.readyState==='complete')setTimeout(close,300);else window.addEventListener('load',()=>setTimeout(close,300),{once:true});
  setTimeout(close,4500);
}
function installErrorGuard(){
  let last='';
  window.addEventListener('error',e=>{
    const msg=(e.message||'Error inesperado').trim();
    if(!msg||msg===last||/ResizeObserver loop/i.test(msg))return;last=msg;
    console.error('[Poladent]',e.error||e.message);
  });
  window.addEventListener('unhandledrejection',e=>console.error('[Poladent] Promesa rechazada:',e.reason));
}

function installAdminAuthGuard(){
  if(!window.firebase?.auth) return;
  firebase.auth().onAuthStateChanged(user=>{
    const panel=$('#adminPanel');
    if(!panel) return;
    // Una sesión anónima sirve para empleado.html, nunca para el administrador.
    if(!panel.classList.contains('hidden') && (!user || user.isAnonymous)){
      panel.classList.add('hidden');
      $('#adminLogin')?.classList.remove('hidden');
      console.warn('[Poladent] Panel administrador protegido: sesión no administrativa.');
    }
  });
}
function boot(){installLoadingGuard();addStatus();setStatus();installErrorGuard();installAdminAuthGuard();window.addEventListener('online',setStatus);window.addEventListener('offline',setStatus);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

