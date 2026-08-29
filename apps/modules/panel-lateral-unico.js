(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={mounted:false,current:'inicio',busy:false,homeBound:false};
const routeDefs=[
 {group:'Inicio',items:[['inicio','🏠','Resumen principal'],['analisis','📊','Análisis visual']]},
 {group:'Empleados',items:[['empleados-lista','👥','Lista de empleados'],['empleados-agregar','➕','Agregar empleado'],['empleados-fotos','📷','Fotos de empleados'],['empleados-horarios','🕒','Editar horarios'],['empleados-salarios','💵','Salarios y ficha'],['empleados-roles','🔐','Roles, permisos y sucursales']]},
 {group:'Asistencia',items:[['asistencia-marcaciones','🗓️','Resumen de marcaciones'],['asistencia-historial','📋','Historial profesional'],['asistencia-verificacion','📷','Verificación de hoy'],['asistencia-correcciones','✏️','Correcciones y justificaciones'],['asistencia-feriados','🎉','Feriados globales'],['asistencia-libres','👤','Días libres pagados'],['asistencia-pagos','💰','Resumen de pagos y banco de horas'],['asistencia-notificaciones','🔔','Notificaciones']]},
 {group:'GPS y locales',items:[['gps-control','📍','Control GPS multisede'],['gps-locales','🏢','Agregar o editar locales'],['gps-asignar','🧭','Asignar locales a empleados'],['gps-alertas','⚠️','Alertas de intentos GPS']]},
 {group:'Gestión',items:[['nomina','💼','Nómina'],['reportes','📄','Centro de reportes'],['seguridad','🛡️','Seguridad']]},
 {group:'Administración avanzada',advanced:true,items:[['empresas','🏬','Empresas'],['licencia','🔑','Licencias'],['respaldo','💾','Respaldos'],['auditoria','🔎','Auditoría'],['diagnostico','🩺','Diagnóstico'],['configuracion','⚙️','Configuración avanzada']]}
];
const titleMap=Object.fromEntries(routeDefs.flatMap(g=>g.items.map(i=>[i[0],i[2]])));
function cardByTitle(rx){return $$('#adminPanel .card').find(c=>rx.test(($('h4',c)?.textContent||'').trim()));}
function ensureView(id){let v=$('#plu-view-'+id);if(!v){v=document.createElement('section');v.id='plu-view-'+id;v.className='plu-view';v.dataset.route=id;v.innerHTML=`<header class="plu-view-head"><div><small>Panel administrador</small><h2>${titleMap[id]||id}</h2></div></header><div class="plu-view-body"></div>`;$('#plu-content')?.appendChild(v);}return $('.plu-view-body',v)}
function placeholder(host,text){if(!host||host.children.length)return;const p=document.createElement('div');p.className='plu-empty';p.textContent=text;host.appendChild(p)}
function moveNode(node,route){if(!node)return;const host=ensureView(route);if(host){$$('.plu-empty',host).forEach(x=>x.remove());if(!host.contains(node))host.appendChild(node);}node.classList.remove('pc-hidden-legacy','pc-page','pd44-hidden');node.classList.add('plu-module-live');node.hidden=false;node.style.removeProperty('display');}
function buildShell(panel){
 const oldShell=$('.pc-shell',panel);let shell=$('#plu-shell');
 if(!shell){shell=document.createElement('div');shell.id='plu-shell';shell.className='plu-shell';shell.innerHTML=`<aside class="plu-sidebar"><div class="plu-brand"><img src="img/logo-poladent.png" alt="Poladent"><div><b>Poladent</b><small>Panel administrador</small></div></div><button class="plu-mobile-close" type="button" aria-label="Cerrar menú">✕</button><nav id="plu-nav"></nav><div class="plu-side-footer"></div></aside><div class="plu-main"><div class="plu-mobile-bar"><button id="plu-open" type="button">☰ Menú</button><strong id="plu-mobile-title">Inicio</strong></div><div id="plu-content"></div></div><div class="plu-overlay"></div>`;const top=$('.adminTopBar',panel);(top||panel.firstElementChild)?.after(shell);}
 const nav=$('#plu-nav');if(nav&&!nav.children.length){routeDefs.forEach((g,gi)=>{const d=document.createElement('details');d.className='plu-group'+(g.advanced?' plu-group-advanced':'');d.open=gi===0;d.innerHTML=`<summary>${g.group}<span>⌄</span></summary><div class="plu-submenu"></div>`;const sub=$('.plu-submenu',d);g.items.forEach(([id,icon,label])=>{const b=document.createElement('button');b.type='button';b.dataset.route=id;b.innerHTML=`<span>${icon}</span><span>${label}</span>`;sub.appendChild(b)});nav.appendChild(d)});}
 if(oldShell&&oldShell!==shell){
   oldShell.classList.add('plu-legacy-shell');
   oldShell.setAttribute('aria-hidden','true');
   oldShell.style.setProperty('display','none','important');
   oldShell.style.setProperty('visibility','hidden','important');
   const legacySide=oldShell.querySelector('.pc-sidebar');
   if(legacySide) legacySide.remove();
 }
 const logout=$('#logoutBtn');if(logout)$('.plu-side-footer').appendChild(logout);
 bind();
}
function disableLegacyShells(){
 const current=$('#plu-shell');
 $$('#adminPanel .pc-shell').forEach(old=>{
   if(old===current)return;
   old.classList.add('plu-legacy-shell');
   old.setAttribute('aria-hidden','true');
   old.style.setProperty('display','none','important');
   old.style.setProperty('visibility','hidden','important');
   const side=old.querySelector('.pc-sidebar');
   if(side)side.remove();
 });
}
function cleanupLegacyShells(){
 const current=$('#plu-shell');
 $$('#adminPanel .pc-shell').forEach(old=>{
   if(old===current)return;
   // Después de trasladar sus módulos reales al panel único, el cascarón anterior ya no debe existir.
   if(!old.querySelector('.pc-page > *:not(.pc-nav), .pc-content > *:not(.pc-nav)')) old.remove();
   else {
     old.classList.add('plu-legacy-shell');
     old.setAttribute('aria-hidden','true');
     old.style.setProperty('display','none','important');
   }
 });
}
function localDay(ts){const d=ts?new Date(Number(ts)):new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function applyTodayStats(s={}){
 const vals={
   pluStatActive:s.active??0,
   pluStatPresent:s.present??0,
   pluStatComplete:s.complete??0,
   pluStatAlerts:s.alerts??0,
   pluStatWorking:s.working??0,
   pluStatLunch:s.lunch??0,
   pluStatPending:s.pending??0,
   pluStatAbsent:s.absent??0,
   pluStatLate:s.late??0
 };
 Object.entries(vals).forEach(([id,v])=>{const el=$('#'+id);if(el)el.textContent=String(v)});
 const sync=$('#pluHomeSync');
 if(sync)sync.textContent=navigator.onLine?'● Sistema conectado':'● Sin conexión';
 const updated=$('#pluHomeUpdated');
 if(updated){
   const ts=Number(s.updatedAt||Date.now());
   updated.textContent=`Última actualización: ${new Date(ts).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'})}`;
 }
}
function updateHomeStats(){
 const live=window.PoladentTodayStats||window.PoladentControlProfesional?.stats?.();
 if(live){applyTodayStats(live);return;}
 // Respaldo mientras carga el panel operativo.
 const employees=window.PoladentData?.getValue?.('empleados',{})||{};
 const marks=window.PoladentData?.getValue?.('marcaciones',{})||{};
 const gpsAlerts=window.PoladentData?.getValue?.('alertas_gps',{})||{};
 const secAlerts=window.PoladentData?.getValue?.('alertas_seguridad',{})||{};
 const today=localDay(),activeRows=Object.entries(employees).filter(([,e])=>e&&e.archivado!==true&&e.activo!==false);
 let present=0,complete=0;
 activeRows.forEach(([id])=>{
   const day=marks?.[id]?.[today]||{};
   const vals=Object.values(day||{}).filter(v=>v&&typeof v==='object');
   const find=type=>day?.[type]||vals.find(v=>v?.tipo===type);
   const en=find('entrada'),out=find('salida');
   if(en)present++;
   if(en&&out)complete++;
 });
 applyTodayStats({
   active:activeRows.length,present,complete,
   alerts:Object.values(gpsAlerts).filter(a=>a&&a.revisada!==true).length+Object.values(secAlerts).filter(a=>a&&a.revisada!==true).length,
   working:0,lunch:0,pending:0,absent:0,late:0,updatedAt:Date.now()
 });
}
function bindHomeStats(){
 if(state.homeBound)return;
 state.homeBound=true;
 document.addEventListener('poladent:today-stats',e=>applyTodayStats(e.detail||{}),{passive:true});
 window.addEventListener('online',updateHomeStats);
 window.addEventListener('offline',updateHomeStats);
 if(window.PoladentData?.subscribe){
   ['empleados','marcaciones','alertas_gps','alertas_seguridad'].forEach(path=>window.PoladentData.subscribe(path,()=>updateHomeStats()));
 }
 updateHomeStats();
}
function buildHome(){
 const host=ensureView('inicio');
 if(!$('#plu-dashboard',host)){
   const x=document.createElement('div');
   x.id='plu-dashboard';x.className='plu-dashboard';
   x.innerHTML=`
   <div class="plu-welcome">
     <div><small>POLADENT CASA DENTAL</small><h3>Centro de control</h3><p>Estado real de la jornada de hoy y puntos que requieren atención.</p></div>
     <div class="plu-live-status"><div class="plu-status" id="pluHomeSync">● Sistema conectado</div><small id="pluHomeUpdated">Última actualización: —</small><button id="pluHomeRefresh" type="button">↻ Actualizar</button></div>
   </div>
   <div class="plu-kpi-live">
     <button data-go="empleados-lista"><small>Funcionarios activos</small><strong id="pluStatActive">—</strong><span>Ver personal</span></button>
     <button data-go="asistencia-marcaciones"><small>Con entrada hoy</small><strong id="pluStatPresent">—</strong><span>Ver asistencia</span></button>
     <button data-go="asistencia-verificacion"><small>Jornada completada</small><strong id="pluStatComplete">—</strong><span>Verificación de hoy</span></button>
     <button data-go="seguridad"><small>Alertas pendientes</small><strong id="pluStatAlerts">—</strong><span>Revisar seguridad</span></button>
   </div>
   <div class="plu-live-today-grid">
     <button data-go="asistencia-marcaciones"><span>🟢</span><div><small>En jornada ahora</small><strong id="pluStatWorking">—</strong></div></button>
     <button data-go="asistencia-marcaciones"><span>🍽️</span><div><small>En almuerzo</small><strong id="pluStatLunch">—</strong></div></button>
     <button data-go="asistencia-marcaciones"><span>⏱️</span><div><small>Aún no han llegado</small><strong id="pluStatPending">—</strong></div></button>
     <button data-go="asistencia-marcaciones"><span>🚫</span><div><small>Faltas de hoy</small><strong id="pluStatAbsent">—</strong></div></button>
     <button data-action="late-today"><span>🕒</span><div><small>Llegadas tarde</small><strong id="pluStatLate">—</strong></div></button>
   </div>
   <div class="plu-home-grid">
     <button data-go="analisis">📊<b>Análisis</b><small>Rendimiento y funcionario destacado</small></button>
     <button data-go="asistencia-historial">📋<b>Historial</b><small>Consultar por rango</small></button>
     <button data-go="nomina">💼<b>Nómina</b><small>Pagos y períodos</small></button>
     <button data-go="gps-control">📍<b>GPS y locales</b><small>Geocercas y asignaciones</small></button>
   </div>`;
   host.appendChild(x);
   $$('[data-go]',x).forEach(b=>b.onclick=()=>openRoute(b.dataset.go));
   $$('[data-action="late-today"]',x).forEach(b=>b.onclick=()=>{
     document.dispatchEvent(new CustomEvent('poladent:show-late-today'));
   });
   $('#pluHomeRefresh',x).onclick=async()=>{
     const b=$('#pluHomeRefresh',x);if(b){b.disabled=true;b.textContent='Actualizando…'}
     try{
       if(window.PoladentControlProfesional?.refresh)await window.PoladentControlProfesional.refresh();
       else updateHomeStats();
     }finally{
       if(b){b.disabled=false;b.textContent='↻ Actualizar'}
     }
   };
 }
 bindHomeStats();
}function createAction(route,title,description,buttonText,handler){const host=ensureView(route);let box=$('.plu-action-card',host);if(!box){box=document.createElement('div');box.className='plu-action-card';box.innerHTML=`<h3>${title}</h3><p>${description}</p><button type="button">${buttonText}</button>`;host.appendChild(box);$('button',box).onclick=handler;}return box}
function relocate(){if(state.busy)return;state.busy=true;try{
 disableLegacyShells();
 buildHome();
 moveNode(cardByTitle(/Gráfico.*horas|Análisis visual/i),'analisis');
 moveNode(cardByTitle(/Empleados registrados/i),'empleados-lista');
 moveNode(cardByTitle(/^Agregar empleado/i),'empleados-agregar');
 moveNode(cardByTitle(/Fotos de empleados/i),'empleados-fotos');
 moveNode($('#pd44-ficha')||$('#pd5-perfil'),'empleados-salarios');
 moveNode($('#pd44-roles'),'empleados-roles');
 window.PoladentHorario?.mount?.();
 const listCard=cardByTitle(/Resumen de marcaciones/i)||($('#adminList')?.closest('.card'));moveNode(listCard,'asistencia-marcaciones');
 window.PoladentVerificacionFotos?.mount?.();
 moveNode($('#pvf-root'),'asistencia-verificacion');
 window.PoladentHistorialProfesional?.mount?.();moveNode($('#hpRoot'),'asistencia-historial');
 moveNode($('#pd44-justifica'),'asistencia-correcciones');
 moveNode(cardByTitle(/Feriados globales/i),'asistencia-feriados');
 moveNode(cardByTitle(/Días libres pagados/i),'asistencia-libres');
 moveNode($('#resumenPagos'),'asistencia-pagos');
 moveNode(cardByTitle(/Notificaciones/i),'asistencia-notificaciones');
 window.PoladentGPS?.mount?.();
 moveNode($('#gpsGeneralPanel'),'gps-control');
 moveNode($('#gpsLocalesPanel'),'gps-locales');
 moveNode($('#gpsAsignarPanel'),'gps-asignar');
 moveNode($('#gpsAlertsPanel'),'gps-alertas');
 moveNode($('#pc-payroll'),'nomina');moveNode($('#pc-reports'),'reportes');moveNode($('#secAttendancePanel')||$('#pd5-seguridad'),'seguridad');moveNode($('#secSecurityAlerts'),'auditoria');moveNode($('#pd44-respaldo'),'respaldo');moveNode($('#pd44-config'),'configuracion');moveNode($('#pc-companies'),'empresas');moveNode($('#pc-license'),'licencia');moveNode($('#pfDiagnostic'),'diagnostico');
 // Modales quedan disponibles globalmente, pero nunca visibles salvo cuando se abren.
 ['#editModal','#editModalBackdrop','#salarioModal','#salarioModalBackdrop','#feriadoModal','#feriadoModalBackdrop','#libreModal','#libreModalBackdrop'].forEach(s=>{const n=$(s);if(n&&!document.body.contains(n))document.body.appendChild(n)});
 // Oculta cualquier bloque administrativo original que no esté dentro del panel único.
 const panel=$('#adminPanel'),shell=$('#plu-shell');if(panel&&shell){Array.from(panel.children).forEach(ch=>{if(ch!==shell&&!ch.classList.contains('adminTopBar')&&!ch.matches('.modal,.modalBackdrop'))ch.classList.add('plu-orphan')});}
 // Evita menús generados por módulos externos.
 $$('.pc-nav button').forEach(b=>b.disabled=true);
 cleanupLegacyShells();
 placeholder(ensureView('analisis'),'El análisis visual aparecerá aquí cuando cargue el gráfico.');
 placeholder(ensureView('empleados-lista'),'La lista de empleados aparecerá aquí cuando Firebase termine de cargar.');
 placeholder(ensureView('empleados-fotos'),'El módulo de fotografías aparecerá aquí cuando termine de cargar.');
 placeholder(ensureView('asistencia-verificacion'),'Las fotografías de las marcaciones de hoy aparecerán aquí.');
 placeholder(ensureView('gps-locales'),'Las herramientas para agregar o editar locales aparecerán aquí al cargar el módulo GPS.');
 placeholder(ensureView('gps-asignar'),'Las asignaciones de locales aparecerán aquí al cargar el módulo GPS.');
 }finally{state.busy=false}}
function openRoute(id,options={}){if(window.PoladentSecurity&&window.PoladentSecurity.can&&!window.PoladentSecurity.can(({'analisis':'reportes','empleados-roles':'configuracion','respaldo':'configuracion','diagnostico':'configuracion'}[id])||(id.startsWith('empleados-')?'empleados':id.startsWith('asistencia-')?'asistencia':id.startsWith('gps-')?'gps':id))){document.dispatchEvent(new CustomEvent('poladent:access-denied',{detail:{route:id}}));return;}state.current=id;ensureView(id);document.dispatchEvent(new CustomEvent('poladent:route',{detail:{route:id}}));if(id==='asistencia-pagos'){setTimeout(()=>window.renderPagos?.(),50);}if(id==='asistencia-libres'){setTimeout(()=>{window.cargarEmpleadosParaModal?.();window.renderListaLibresEmpleado?.();},30);}if(id==='asistencia-feriados'){setTimeout(()=>window.renderListaFeriadosGlobal?.(),30);}if(id==='asistencia-notificaciones'){setTimeout(()=>window.renderNotificacionesPro?.(),50);}$$('.plu-view').forEach(v=>v.classList.toggle('active',v.dataset.route===id));$$('#plu-nav button').forEach(b=>b.classList.toggle('active',b.dataset.route===id));const btn=$(`#plu-nav button[data-route="${id}"]`);if(btn){const det=btn.closest('details');if(det)det.open=true;}const mt=$('#plu-mobile-title');if(mt)mt.textContent=titleMap[id]||'Panel';document.body.classList.remove('plu-menu-open');if(options.scroll!==false)window.scrollTo({top:0,behavior:'smooth'});}
function bind(){if(document.body.dataset.pluBound==='1')return;document.body.dataset.pluBound='1';$('#plu-nav')?.addEventListener('click',e=>{const b=e.target.closest('button[data-route]');if(b)openRoute(b.dataset.route)});$('#plu-open')?.addEventListener('click',()=>document.body.classList.add('plu-menu-open'));$('.plu-mobile-close')?.addEventListener('click',()=>document.body.classList.remove('plu-menu-open'));$('.plu-overlay')?.addEventListener('click',()=>document.body.classList.remove('plu-menu-open'))}
function mount(){const panel=$('#adminPanel');if(!panel||state.mounted)return;buildShell(panel);disableLegacyShells();relocate();openRoute(state.current,{scroll:false});state.mounted=true;
 // Fase 8: observar solamente NUEVOS BLOQUES directos del panel.
 // Antes se observaba todo el subárbol; cada actualización de Firebase podía disparar
 // relocate() y restaurar el scroll, provocando que la pantalla intentara subir sola.
 let timer;
 const observer=new MutationObserver(mutations=>{
   const relevant=mutations.some(m=>m.type==='childList'&&m.addedNodes&&m.addedNodes.length>0);
   if(!relevant)return;
   clearTimeout(timer);
   timer=setTimeout(()=>{
     const y=window.scrollY;
     relocate();
     openRoute(state.current,{scroll:false});
     updateHomeStats();
     if(Math.abs(window.scrollY-y)>3) window.scrollTo({top:y,left:0,behavior:'auto'});
   },90);
 });
 observer.observe(panel,{childList:true,subtree:false});
 state.observer=observer;
 // Cuando el login termina, hacemos una única sincronización del panel.
 document.addEventListener('poladent:admin-ready',()=>{relocate();openRoute(state.current,{scroll:false});updateHomeStats();},{passive:true});
 // Una sola pasada corta de arranque; no hay ciclos que manipulen el scroll mientras el usuario navega.
 setTimeout(()=>{relocate();openRoute(state.current,{scroll:false});updateHomeStats();},500);
}
function start(){const panel=$('#adminPanel');if(!panel)return setTimeout(start,200);mount()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1200));else setTimeout(start,1200);
})();
