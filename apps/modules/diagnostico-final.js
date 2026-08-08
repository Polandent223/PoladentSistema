/* POLADENT · Diagnóstico de producción Fase 15. Solo lectura. */
(() => {
  'use strict';
  const VERSION='2026.08.08-fase15';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const state={mounted:false,connected:null,lastRun:0};
  const ERROR_KEY='poladent_diagnostico_errores_v1';

  function readErrors(){try{return JSON.parse(localStorage.getItem(ERROR_KEY)||'[]')}catch{return []}}
  function saveError(kind,value){
    try{
      const msg=String(value?.message||value||'Error desconocido').slice(0,500);
      if(/password|contrase/i.test(msg)) return;
      const list=readErrors();
      list.unshift({kind,msg,at:Date.now(),page:location.pathname});
      localStorage.setItem(ERROR_KEY,JSON.stringify(list.slice(0,20)));
    }catch{}
  }
  window.addEventListener('error',e=>saveError('JavaScript',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>saveError('Promesa',e.reason));

  function cleanCommercialLabels(){
    const rx=/\b(?:v(?:ersi[oó]n)?\s*\d+(?:\.\d+)*|fase\s*\d+(?:\.\d+)*|etapa\s*\d+(?:\.\d+)*|enterprise|premium|control\s*pro|gps\s*editable)\b/ig;
    $$('h1,h2,h3,h4,h5,.systemBadge,.miniLabel,.eyebrow,button,a,option').forEach(el=>{
      if(el.children.length)return;
      const before=el.textContent||'',after=before.replace(rx,'').replace(/\s{2,}/g,' ').trim();
      if(after&&after!==before)el.textContent=after;
    });
    document.title='Poladent · Control de asistencia';
  }

  function status(label,ok,detail=''){
    const cls=ok===true?'pf-ok':ok===false?'pf-bad':'pf-warn';
    const text=ok===true?'Correcto':ok===false?'Revisar':'Pendiente';
    return `<div class="pf-health-item"><div><b>${label}</b>${detail?`<div style="font-size:.76rem;opacity:.68;margin-top:3px;line-height:1.35">${detail}</div>`:''}</div><span class="pf-health-status ${cls}">${text}</span></div>`;
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function withTimeout(p,ms=5500){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Tiempo de espera agotado')),ms))])}
  function once(path){return withTimeout(firebase.database().ref(path).once('value'))}

  async function firebaseChecks(){
    if(!(window.firebase&&firebase.apps?.length&&firebase.database))return {ready:false};
    let connected=state.connected;
    try{if(connected===null)connected=(await withTimeout(firebase.database().ref('.info/connected').once('value'),3000)).val()===true}catch{}
    const user=firebase.auth?.().currentUser||null;
    let reads=true,employees=null,gps=null,security=null,readError='';
    try{
      const [e,g,s]=await Promise.all([once('empleados'),once('configuracion_gps_v51'),once('configuracion_seguridad_asistencia')]);
      employees=e.val()||{};gps=g.val()||{};security=s.val()||{};
    }catch(err){reads=false;readError=err?.message||String(err)}
    return {ready:true,connected,user,reads,employees,gps,security,readError};
  }

  function employeeScheduleSummary(employees){
    if(!employees)return {total:0,active:0,missing:0};
    let total=0,active=0,missing=0;
    Object.values(employees).forEach(e=>{
      if(!e)return;total++;
      if(e.archivado===true||e.activo===false)return;
      active++;
      const h=e.horario||e.horarios||null;
      const has=!!(h&&typeof h==='object'&&Object.keys(h).length);
      if(!has)missing++;
    });
    return {total,active,missing};
  }

  async function runDiagnostic(){
    const grid=$('#pfHealthGrid');if(!grid)return;
    state.lastRun=Date.now();
    grid.innerHTML=status('Internet',navigator.onLine,navigator.onLine?'El navegador reporta conexión':'Sin conexión de red');
    const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
    const gpsApi=!!navigator.geolocation;
    const cameraApi=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
    const storage=(()=>{try{localStorage.setItem('__pf_test','1');localStorage.removeItem('__pf_test');return true}catch{return false}})();
    const fb=await firebaseChecks();
    const blocks=[];
    blocks.push(status('Conexión segura',secure,secure?'HTTPS activo':'La cámara y GPS requieren HTTPS'));
    blocks.push(status('Firebase cargado',fb.ready,fb.ready?'SDK inicializado':'No se inicializó Firebase'));
    if(fb.ready){
      blocks.push(status('Firebase en línea',fb.connected===true,fb.connected===true?'Realtime Database conectado':fb.connected===false?'Realtime Database desconectado':'Estado aún no confirmado'));
      blocks.push(status('Sesión administrativa',!!fb.user,fb.user?`Sesión: ${esc(fb.user.email||fb.user.uid||'administrador')}`:'Inicia sesión para ejecutar todas las pruebas'));
      blocks.push(status('Lectura de datos',fb.reads,fb.reads?'Empleados y configuraciones críticas accesibles':`No se pudieron leer rutas críticas: ${esc(fb.readError)}`));
      if(fb.reads){
        const ss=employeeScheduleSummary(fb.employees);
        blocks.push(status('Horarios de funcionarios',ss.missing===0,ss.active?`${ss.active} activos · ${ss.missing} sin horario personalizado`:'No hay funcionarios activos'));
        const sedes=Object.values(fb.gps?.sedes||{}).filter(s=>s&&s.activo!==false);
        const gpsOk=fb.gps?.activo===false||sedes.length>0;
        blocks.push(status('Configuración GPS',gpsOk,fb.gps?.activo===false?'Geocerca desactivada':`${sedes.length} sede(s) activa(s)`));
        const sec=fb.security||{};
        const fotos=['fotoEntrada','fotoAlmuerzoSalida','fotoAlmuerzoRegreso','fotoSalida'].filter(k=>sec[k]===true).length;
        blocks.push(status('Configuración de cámara',true,`${fotos} etapa(s) con foto obligatoria`));
      }
    }
    blocks.push(status('GPS del dispositivo',gpsApi,gpsApi?'API disponible':'El dispositivo/navegador no expone geolocalización'));
    blocks.push(status('Cámara del dispositivo',cameraApi,cameraApi?'API disponible':'No se detecta acceso web a cámara'));
    blocks.push(status('Almacenamiento local',storage,storage?'Disponible':'Bloqueado por navegador'));
    const errs=readErrors();
    blocks.push(status('Errores recientes',errs.length===0,errs.length?`${errs.length} error(es) locales registrados; revisa el detalle abajo`:'Sin errores JavaScript registrados en este dispositivo'));
    grid.insertAdjacentHTML('beforeend',blocks.join(''));
    const stamp=new Date().toLocaleString('es-VE',{dateStyle:'medium',timeStyle:'short'});
    const t=$('#pfDiagTime');if(t)t.textContent=`Última revisión: ${stamp} · Motor ${VERSION}`;
    renderErrorLog();
  }

  function renderErrorLog(){
    const box=$('#pfDiagErrors');if(!box)return;
    const list=readErrors();
    if(!list.length){box.innerHTML='<div style="opacity:.65;font-size:.82rem">No hay errores locales recientes.</div>';return;}
    box.innerHTML=list.slice(0,8).map(e=>`<div style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.08)"><b>${esc(e.kind)}</b> · <span style="opacity:.65">${new Date(e.at).toLocaleString('es-VE')}</span><div style="font-size:.78rem;margin-top:3px;word-break:break-word">${esc(e.msg)}</div></div>`).join('');
  }

  function mountDiagnostic(){
    if(state.mounted||$('#pfDiagnostic'))return;
    const panel=$('#adminPanel');if(!panel)return;
    const anchor=$('.dashboardHero',panel)||panel.firstElementChild;
    const section=document.createElement('section');section.id='pfDiagnostic';section.className='pf-diagnostic';
    section.innerHTML=`<div class="pf-diagnostic-head"><div><h3>🩺 Estado del sistema</h3><p id="pfDiagTime">Comprobando servicios esenciales…</p></div><div class="pf-diagnostic-actions"><button type="button" id="pfRunDiag">Actualizar diagnóstico</button><button type="button" id="pfToggleCompact">Vista compacta</button></div></div><div id="pfHealthGrid" class="pf-health-grid"></div><details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Errores recientes de este dispositivo</summary><div id="pfDiagErrors" style="margin-top:8px"></div><button type="button" id="pfClearErrors" style="margin-top:10px">Limpiar registro local</button></details>`;
    anchor.insertAdjacentElement('afterend',section);
    $('#pfRunDiag')?.addEventListener('click',runDiagnostic);
    $('#pfClearErrors')?.addEventListener('click',()=>{try{localStorage.removeItem(ERROR_KEY)}catch{};renderErrorLog();runDiagnostic()});
    $('#pfToggleCompact')?.addEventListener('click',()=>{document.body.classList.toggle('pf-compact');try{localStorage.setItem('poladent_vista_compacta',document.body.classList.contains('pf-compact')?'1':'0')}catch{}});
    try{if(localStorage.getItem('poladent_vista_compacta')==='1')document.body.classList.add('pf-compact')}catch{}
    state.mounted=true;runDiagnostic();
  }

  function watchFirebaseConnection(){
    const start=()=>{
      if(!(window.firebase&&firebase.apps?.length&&firebase.database))return false;
      try{
        firebase.database().ref('.info/connected').on('value',s=>{state.connected=s.val()===true;if(state.mounted&&Date.now()-state.lastRun>1200)runDiagnostic()});
        firebase.auth?.().onAuthStateChanged?.(()=>{if(state.mounted)setTimeout(runDiagnostic,120)});
        return true;
      }catch{return false}
    };
    if(start())return;
    let n=0;const timer=setInterval(()=>{n++;if(start()||n>50)clearInterval(timer)},200);
  }

  function preventEmptyPanels(){
    $$('.pc-view,.pc-module-group').forEach(el=>{const txt=(el.textContent||'').trim();if(!txt&&!el.querySelector('input,select,button,canvas,img'))el.hidden=true});
  }
  function finalPass(){cleanCommercialLabels();mountDiagnostic();preventEmptyPanels()}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(finalPass,180);setTimeout(finalPass,1000);watchFirebaseConnection()});
  window.addEventListener('online',()=>{if(state.mounted)runDiagnostic()});
  window.addEventListener('offline',()=>{if(state.mounted)runDiagnostic()});
  window.PoladentHealth={version:VERSION,run:runDiagnostic,errors:readErrors};
})();
