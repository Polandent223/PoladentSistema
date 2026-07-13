(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={mounted:false,current:'inicio',busy:false};
const routeDefs=[
 {group:'Inicio',items:[['inicio','🏠','Resumen principal'],['analisis','📊','Análisis visual']]},
 {group:'Empleados',items:[['empleados-lista','👥','Lista de empleados'],['empleados-agregar','➕','Agregar empleado'],['empleados-fotos','📷','Fotos de empleados'],['empleados-horarios','🕒','Editar horarios'],['empleados-salarios','💵','Salarios y ficha'],['empleados-roles','🔐','Roles, permisos y sucursales']]},
 {group:'Asistencia',items:[['asistencia-marcaciones','🗓️','Resumen de marcaciones'],['asistencia-correcciones','✏️','Correcciones y justificaciones'],['asistencia-feriados','🎉','Feriados globales'],['asistencia-libres','👤','Días libres pagados'],['asistencia-pagos','💰','Resumen de pagos y banco de horas'],['asistencia-notificaciones','🔔','Notificaciones']]},
 {group:'GPS y locales',items:[['gps-control','📍','Control GPS multisede'],['gps-locales','🏢','Agregar o editar locales'],['gps-asignar','🧭','Asignar locales a empleados'],['gps-alertas','⚠️','Alertas de intentos GPS']]},
 {group:'Administración',items:[['nomina','💼','Nómina'],['reportes','📄','Reportes'],['seguridad','🛡️','Seguridad'],['auditoria','🔎','Auditoría'],['respaldo','💾','Respaldo'],['configuracion','⚙️','Configuración'],['empresas','🏬','Empresas'],['licencia','🔑','Licencia'],['diagnostico','🩺','Diagnóstico']]}
];
const titleMap=Object.fromEntries(routeDefs.flatMap(g=>g.items.map(i=>[i[0],i[2]])));
function cardByTitle(rx){return $$('#adminPanel .card').find(c=>rx.test(($('h4',c)?.textContent||'').trim()));}
function ensureView(id){let v=$('#plu-view-'+id);if(!v){v=document.createElement('section');v.id='plu-view-'+id;v.className='plu-view';v.dataset.route=id;v.innerHTML=`<header class="plu-view-head"><div><small>Panel administrador</small><h2>${titleMap[id]||id}</h2></div></header><div class="plu-view-body"></div>`;$('#plu-content')?.appendChild(v);}return $('.plu-view-body',v)}
function placeholder(host,text){if(!host||host.children.length)return;const p=document.createElement('div');p.className='plu-empty';p.textContent=text;host.appendChild(p)}
function moveNode(node,route){if(!node)return;const host=ensureView(route);if(host){$$('.plu-empty',host).forEach(x=>x.remove());if(!host.contains(node))host.appendChild(node);}node.classList.remove('pc-hidden-legacy','pc-page','pd44-hidden');node.classList.add('plu-module-live');node.hidden=false;node.style.removeProperty('display');}
function buildShell(panel){
 const oldShell=$('.pc-shell',panel);let shell=$('#plu-shell');
 if(!shell){shell=document.createElement('div');shell.id='plu-shell';shell.className='plu-shell';shell.innerHTML=`<aside class="plu-sidebar"><div class="plu-brand"><img src="img/logo-poladent.png" alt="Poladent"><div><b>Poladent</b><small>Panel administrador</small></div></div><button class="plu-mobile-close" type="button" aria-label="Cerrar menú">✕</button><nav id="plu-nav"></nav><div class="plu-side-footer"></div></aside><div class="plu-main"><div class="plu-mobile-bar"><button id="plu-open" type="button">☰ Menú</button><strong id="plu-mobile-title">Inicio</strong></div><div id="plu-content"></div></div><div class="plu-overlay"></div>`;const top=$('.adminTopBar',panel);(top||panel.firstElementChild)?.after(shell);}
 const nav=$('#plu-nav');if(nav&&!nav.children.length){routeDefs.forEach((g,gi)=>{const d=document.createElement('details');d.className='plu-group';d.open=gi===0;d.innerHTML=`<summary>${g.group}<span>⌄</span></summary><div class="plu-submenu"></div>`;const sub=$('.plu-submenu',d);g.items.forEach(([id,icon,label])=>{const b=document.createElement('button');b.type='button';b.dataset.route=id;b.innerHTML=`<span>${icon}</span><span>${label}</span>`;sub.appendChild(b)});nav.appendChild(d)});}
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
function buildHome(){const host=ensureView('inicio');if(!$('#plu-dashboard',host)){const x=document.createElement('div');x.id='plu-dashboard';x.className='plu-dashboard';x.innerHTML=`<div class="plu-welcome"><div><small>POLADENT CASA DENTAL</small><h3>Bienvenido al administrador</h3><p>Selecciona una función desde el menú lateral. Solo se mostrará el módulo elegido.</p></div><div class="plu-status">● Sistema activo</div></div><div class="plu-home-grid"><button data-go="empleados-lista">👥<b>Empleados</b><small>Ver personal registrado</small></button><button data-go="asistencia-marcaciones">🕒<b>Asistencia</b><small>Consultar marcaciones</small></button><button data-go="gps-control">📍<b>GPS y locales</b><small>Administrar geocercas</small></button><button data-go="reportes">📄<b>Reportes</b><small>Consultar y exportar</small></button></div>`;host.appendChild(x);$$('[data-go]',x).forEach(b=>b.onclick=()=>openRoute(b.dataset.go));}}
function createAction(route,title,description,buttonText,handler){const host=ensureView(route);let box=$('.plu-action-card',host);if(!box){box=document.createElement('div');box.className='plu-action-card';box.innerHTML=`<h3>${title}</h3><p>${description}</p><button type="button">${buttonText}</button>`;host.appendChild(box);$('button',box).onclick=handler;}return box}
function relocate(){if(state.busy)return;state.busy=true;try{
 disableLegacyShells();
 buildHome();
 moveNode(cardByTitle(/Gráfico.*horas|Análisis visual/i),'analisis');
 moveNode(cardByTitle(/Empleados registrados/i),'empleados-lista');
 moveNode(cardByTitle(/^Agregar empleado/i),'empleados-agregar');
 moveNode(cardByTitle(/Fotos de empleados/i),'empleados-fotos');
 moveNode($('#pd44-ficha')||$('#pd5-perfil'),'empleados-salarios');
 moveNode($('#pd44-roles'),'empleados-roles');
 createAction('empleados-horarios','Editar horarios','Selecciona un empleado y configura su jornada laboral habitual.','🕒 Abrir editor de horarios',()=>window.PoladentHorario?.open());
 const listCard=cardByTitle(/Resumen de marcaciones/i)||($('#adminList')?.closest('.card'));moveNode(listCard,'asistencia-marcaciones');
 moveNode($('#pd44-justifica'),'asistencia-correcciones');
 moveNode(cardByTitle(/Feriados globales/i),'asistencia-feriados');
 moveNode(cardByTitle(/Días libres pagados/i),'asistencia-libres');
 moveNode($('#resumenPagos'),'asistencia-pagos');
 moveNode(cardByTitle(/Notificaciones/i),'asistencia-notificaciones');
 const gps=$('#gps52Panel')||$('#gps51Panel');if(gps){moveNode(gps,'gps-control');
   const sections=$$('section,.gps52-card,.gps-card,article',gps);
   sections.forEach(s=>{const t=s.textContent||'';if(/agregar|editar local|sede oficial|guardar sede/i.test(t))moveNode(s,'gps-locales');else if(/asignar.*empleado|empleado.*sede|sede asignada/i.test(t))moveNode(s,'gps-asignar')});
 }
 moveNode($('#gps53Alerts'),'gps-alertas');
 moveNode($('#pc-payroll'),'nomina');moveNode($('#pc-reports'),'reportes');moveNode($('#secAttendancePanel')||$('#pd5-seguridad'),'seguridad');moveNode($('#secSecurityAlerts'),'auditoria');moveNode($('#pd44-respaldo'),'respaldo');moveNode($('#pd44-config'),'configuracion');moveNode($('#pc-companies'),'empresas');moveNode($('#pc-license'),'licencia');moveNode($('#pfDiagnostic'),'diagnostico');
 // Modales quedan disponibles globalmente, pero nunca visibles salvo cuando se abren.
 ['#editModal','#editModalBackdrop','#salarioModal','#salarioModalBackdrop','#feriadoModal','#feriadoModalBackdrop','#libreModal','#libreModalBackdrop'].forEach(s=>{const n=$(s);if(n&&!document.body.contains(n))document.body.appendChild(n)});
 // Oculta cualquier bloque administrativo original que no esté dentro del panel único.
 const panel=$('#adminPanel'),shell=$('#plu-shell');if(panel&&shell){Array.from(panel.children).forEach(ch=>{if(ch!==shell&&!ch.classList.contains('adminTopBar')&&!ch.matches('.modal,.modalBackdrop'))ch.classList.add('plu-orphan')});}
 // Evita menús generados por módulos externos.
 $$('.pc-nav button').forEach(b=>b.disabled=true);
 placeholder(ensureView('analisis'),'El análisis visual aparecerá aquí cuando cargue el gráfico.');
 placeholder(ensureView('empleados-lista'),'La lista de empleados aparecerá aquí cuando Firebase termine de cargar.');
 placeholder(ensureView('empleados-fotos'),'El módulo de fotografías aparecerá aquí cuando termine de cargar.');
 placeholder(ensureView('gps-locales'),'Las herramientas para agregar o editar locales aparecerán aquí al cargar el módulo GPS.');
 placeholder(ensureView('gps-asignar'),'Las asignaciones de locales aparecerán aquí al cargar el módulo GPS.');
 }finally{state.busy=false}}
function openRoute(id,options={}){state.current=id;$$('.plu-view').forEach(v=>v.classList.toggle('active',v.dataset.route===id));$$('#plu-nav button').forEach(b=>b.classList.toggle('active',b.dataset.route===id));const btn=$(`#plu-nav button[data-route="${id}"]`);if(btn){const det=btn.closest('details');if(det)det.open=true;}const mt=$('#plu-mobile-title');if(mt)mt.textContent=titleMap[id]||'Panel';document.body.classList.remove('plu-menu-open');if(options.scroll!==false)window.scrollTo({top:0,behavior:'smooth'});}
function bind(){if(document.body.dataset.pluBound==='1')return;document.body.dataset.pluBound='1';$('#plu-nav')?.addEventListener('click',e=>{const b=e.target.closest('button[data-route]');if(b)openRoute(b.dataset.route)});$('#plu-open')?.addEventListener('click',()=>document.body.classList.add('plu-menu-open'));$('.plu-mobile-close')?.addEventListener('click',()=>document.body.classList.remove('plu-menu-open'));$('.plu-overlay')?.addEventListener('click',()=>document.body.classList.remove('plu-menu-open'))}
function mount(){const panel=$('#adminPanel');if(!panel)return;buildShell(panel);disableLegacyShells();relocate();openRoute(state.current,{scroll:false});state.mounted=true;let timer;const observer=new MutationObserver(mutations=>{const relevant=mutations.some(m=>{const target=m.target instanceof Element?m.target:m.target?.parentElement;return target&&!target.closest('#plu-shell');});if(!relevant)return;clearTimeout(timer);timer=setTimeout(()=>{const y=window.scrollY;relocate();openRoute(state.current,{scroll:false});requestAnimationFrame(()=>window.scrollTo(0,y));},180)});observer.observe(panel,{childList:true,subtree:true});setInterval(()=>{const y=window.scrollY;relocate();requestAnimationFrame(()=>window.scrollTo(0,y));},2500)}
function start(){const panel=$('#adminPanel');if(!panel)return setTimeout(start,200);mount()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1200));else setTimeout(start,1200);
})();
