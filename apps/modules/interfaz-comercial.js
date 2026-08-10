/* ---- módulo integrado ---- */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=t=>t?new Date(Number(t)).toLocaleString('es-VE'):'—';
let emp={}, marks={}, alerts={}, sedes={};
function readyDb(){return window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database}
function titleBlock(t,p){return `<div class="pc-page-title"><h2>${t}</h2><p>${p}</p></div>`}
function mkPage(id,t,p){const e=document.createElement('section');e.id=id;e.className='pc-page';e.innerHTML=titleBlock(t,p);return e}
function cleanVersionText(){
  $$('body *').forEach(el=>{if(el.children.length===0&&/(v\s?\d|versi[oó]n\s?\d|fase\s?\d|enterprise|control pro|gps editable)/i.test(el.textContent||'')){el.textContent=(el.textContent||'').replace(/\b(v\s?\d+(?:\.\d+)?|versi[oó]n\s?\d+(?:\.\d+)?|fase\s?\d+(?:\.\d+)?|enterprise|control pro|gps editable)\b/ig,'').replace(/\s{2,}/g,' ').trim();}});
  document.title='Poladent · Control de asistencia';
}
function move(el,host){if(el&&host&&!host.contains(el))host.appendChild(el)}
function accordion(title,icon){const d=document.createElement('details');d.className='pc-accordion';d.innerHTML=`<summary>${icon} ${title}</summary><div class="pc-accordion-body"></div>`;return d}
function mount(){
 const panel=$('#adminPanel'); if(!panel||panel.dataset.commercial==='1')return;
 panel.dataset.commercial='1';panel.classList.add('pc-ready');document.body.classList.add('pc-commercial');cleanVersionText();
 const top=$('.adminTopBar',panel); const shell=document.createElement('div');shell.className='pc-shell';
 const side=document.createElement('aside');side.className='pc-sidebar';side.innerHTML=`<div class="pc-brand"><img src="img/logo-poladent.png"><div><b>Poladent</b><small>Control de asistencia</small></div></div><nav class="pc-nav">
 <button data-page="pc-home" class="active"><span>🏠</span>Inicio</button><button data-page="pc-employees"><span>👥</span>Empleados</button><button data-page="pc-attendance"><span>🕒</span>Asistencia</button><button data-page="pc-gps"><span>📍</span>Sucursales y GPS</button><button data-page="pc-alerts"><span>⚠️</span>Alertas</button><button data-page="pc-reports"><span>📊</span>Reportes</button><button data-page="pc-settings"><span>⚙️</span>Configuración</button></nav>`;
 const main=document.createElement('main');main.className='pc-main';
 const pages={
  home:mkPage('pc-home','Panel principal','Resumen de lo más importante de hoy.'),
  employees:mkPage('pc-employees','Empleados','Registro, fotos, horarios, salarios y permisos.'),
  attendance:mkPage('pc-attendance','Asistencia','Marcaciones, días libres, feriados y control operativo.'),
  gps:mkPage('pc-gps','Sucursales y GPS','Ubicaciones oficiales, radios permitidos y asignaciones.'),
  alerts:mkPage('pc-alerts','Alertas','Intentos bloqueados y eventos que requieren revisión.'),
  reports:mkPage('pc-reports','Centro de reportes','Consulta asistencia, horas y GPS por período, funcionario o sucursal y expórtalo a Excel, PDF o impresión.'),
  settings:mkPage('pc-settings','Configuración','Opciones generales del sistema, agrupadas y ordenadas.')
 };
 Object.values(pages).forEach(p=>main.appendChild(p));pages.home.classList.add('active');shell.append(side,main); if(top)top.after(shell);else panel.prepend(shell);
 // Inicio
 pages.home.insertAdjacentHTML('beforeend',`<div class="pc-kpis"><div class="pc-kpi"><small>Empleados</small><strong id="pcKTotal">0</strong><em>registrados</em></div><div class="pc-kpi"><small>Presentes</small><strong id="pcKPresent">0</strong><em>con marcación hoy</em></div><div class="pc-kpi"><small>Ausentes</small><strong id="pcKAbsent">0</strong><em>sin marcación hoy</em></div><div class="pc-kpi"><small>Alertas GPS</small><strong id="pcKAlert">0</strong><em>hoy</em></div><div class="pc-kpi"><small>Sucursales</small><strong id="pcKSedes">0</strong><em>activas</em></div></div><div class="pc-grid"><div class="pc-card pc-span-6"><h3>Últimas marcaciones</h3><div id="pcRecentMarks" class="pc-list"></div></div><div class="pc-card pc-span-6"><h3>Últimas alertas</h3><div id="pcRecentAlerts" class="pc-list"></div></div></div>`);
 // Mover módulos existentes
 const cards=$(':scope > .card',panel); cards.forEach(c=>{const h=$('h4',c)?.textContent||''; if(/Agregar empleado|Fotos de empleados|Empleados registrados/i.test(h))move(c,pages.employees); else if(/Feriados|Días libres|Resumen de marcaciones|Notificaciones/i.test(h))move(c,pages.attendance); else if(/Gráfico/i.test(h))move(c,pages.home);});
 move($('#resumenPagos'),pages.attendance);
 // módulos externos, se recolocan también después
 relocatePlugins(pages);
 buildAlerts(pages.alerts); buildReports(pages.reports); buildSettings(pages.settings); organizeStage2(pages);
 $$('.pc-nav button',side).forEach(b=>b.onclick=()=>{$$('.pc-nav button',side).forEach(x=>x.classList.toggle('active',x===b));$$('.pc-page',main).forEach(p=>p.classList.toggle('active',p.id===b.dataset.page));window.scrollTo({top:0,behavior:'smooth'});});
 const logout=$('#logoutBtn');if(logout)move(logout,side);
 subscribe();
 let pcRefreshTimer=0;
 const pcRefresh=()=>{
   clearTimeout(pcRefreshTimer);
   pcRefreshTimer=setTimeout(()=>{
     const run=()=>{relocatePlugins(pages);organizeStage2(pages);cleanupLegacy(panel,pages);};
     if('requestIdleCallback' in window) requestIdleCallback(run,{timeout:250}); else run();
   },90);
 };
 const relocationSelectors=['#gps52Panel','#gps51Panel','#gps53Alerts','#pd44-config','#pd44-respaldo','#pd5-seguridad','#secAttendancePanel','#secSecurityAlerts','#pd44-ficha','#pd5-perfil','#pd44-roles','#pd44-justifica','#pd43Table','#pd43ResumenLista','#pd5-calendario','.card'];
 const needsRelocation=node=>{if(!(node instanceof Element))return false;return relocationSelectors.some(sel=>node.matches?.(sel)||node.querySelector?.(sel));};
 const observerHandler=(mutations)=>{if(mutations.some(m=>[...m.addedNodes].some(needsRelocation)))pcRefresh();};
 new MutationObserver((window.PoladentPerformance?.debounce(observerHandler,120))||observerHandler).observe(panel,{childList:true,subtree:true});
}
function relocatePlugins(p){
 move($('#gps52Panel')||$('#gps51Panel'),p.gps); move($('#gps53Alerts'),p.alerts);
 ['#pd44-config','#pd44-respaldo','#pd5-seguridad','#secAttendancePanel','#secSecurityAlerts'].forEach(s=>{const e=$(s);if(e&&!e.closest('.pc-accordion'))move(e,p.settings)});
 ['#pd44-ficha','#pd5-perfil','#pd44-roles'].forEach(s=>move($(s),p.employees));
 ['#pd44-justifica'].forEach(s=>move($(s),p.attendance));
 ['#pd43Table','#pd43ResumenLista','#pd5-calendario'].forEach(s=>move($(s),p.attendance));
 ['#pd5-reportes'].forEach(s=>{const e=$(s);if(e)e.classList.add('pc-hidden-legacy')});
 if($('#gps53Alerts'))$('#gps53Alerts').classList.add('pc-hidden-legacy');
}

function stage2Group(id,title,subtitle){
 let g=$('#'+id);if(g)return g;
 g=document.createElement('section');g.id=id;g.className='pc-module-group';
 g.innerHTML=`<div class="pc-module-head"><div><h3>${title}</h3><p>${subtitle}</p></div><button type="button" class="pc-collapse-btn" aria-expanded="true">Ocultar ▲</button></div><div class="pc-module-body"></div>`;
 $('.pc-collapse-btn',g).onclick=e=>{const body=$('.pc-module-body',g),open=!body.hidden;body.hidden=open;e.currentTarget.textContent=open?'Mostrar ▼':'Ocultar ▲';e.currentTarget.setAttribute('aria-expanded',String(!open));};
 return g;
}
function moveByHeading(page,regex,host){
 $$('.card',page).forEach(c=>{const h=$('h4',c)?.textContent||'';if(regex.test(h)&&!host.contains(c))move(c,host)});
}
function organizeStage2(p){
 if(!p?.employees||!p?.attendance||!p?.settings)return;
 // Empleados: una sola área, con orden lógico y accesos rápidos.
 let quick=$('#pcEmpQuick');if(!quick){quick=document.createElement('div');quick.id='pcEmpQuick';quick.className='pc-quick-actions';quick.innerHTML=`<button type="button" data-target="pcEmpRegister">➕ Nuevo empleado</button><button type="button" data-target="pcEmpDirectory">👥 Lista de empleados</button><button type="button" id="pcOpenSchedule">🕒 Editar horario</button><button type="button" data-target="pcEmpProfiles">📋 Ficha e historial</button><button type="button" data-target="pcEmpAccess">🔐 Roles y permisos</button>`;p.employees.insertBefore(quick,p.employees.children[1]||null);$$('[data-target]',quick).forEach(b=>b.onclick=()=>$('#'+b.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'}));$('#pcOpenSchedule',quick).onclick=()=>{const btn=[...$$('button')].find(x=>/editar horario/i.test(x.textContent||''));if(btn)btn.click();else{$('#editModalBackdrop')?.classList.remove('hidden');$('#editModal')?.classList.remove('hidden')}};}
 const empGroups=[
  ['pcEmpRegister','Registro y fotografía','Crea empleados y administra su imagen.'],
  ['pcEmpDirectory','Directorio de empleados','Consulta, edita y administra el personal registrado.'],
  ['pcEmpProfiles','Ficha, salario e historial','Revisa información individual, salario y actividad.'],
  ['pcEmpAccess','Roles, permisos y sucursales','Controla qué puede hacer cada usuario y dónde puede marcar.']
 ];
 empGroups.forEach(([id,t,sub])=>{let g=stage2Group(id,t,sub);if(!g.parentNode)p.employees.appendChild(g)});
 moveByHeading(p.employees,/Agregar empleado|Fotos de empleados/i,$('#pcEmpRegister .pc-module-body'));
 moveByHeading(p.employees,/Empleados registrados/i,$('#pcEmpDirectory .pc-module-body'));
 ['#pd44-ficha','#pd5-perfil'].forEach(s=>move($(s),$('#pcEmpProfiles .pc-module-body')));
 move($('#pd44-roles'),$('#pcEmpAccess .pc-module-body'));
 // Asistencia: primero operación diaria, después calendario/permisos y finalmente pagos.
 let aq=$('#pcAttQuick');if(!aq){aq=document.createElement('div');aq.id='pcAttQuick';aq.className='pc-quick-actions';aq.innerHTML=`<button type="button" data-target="pcAttToday">📅 Control del día</button><button type="button" data-target="pcAttCalendar">🗓️ Calendario</button><button type="button" data-target="pcAttPermissions">📝 Permisos y feriados</button><button type="button" data-target="pcAttPayroll">💰 Pagos y resumen</button>`;p.attendance.insertBefore(aq,p.attendance.children[1]||null);$$('[data-target]',aq).forEach(b=>b.onclick=()=>$('#'+b.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'}));}
 const attGroups=[
  ['pcAttToday','Control diario de asistencia','Presentes, ausentes, tardanzas y marcaciones.'],
  ['pcAttCalendar','Calendario e historial','Consulta la asistencia por fecha y por funcionario.'],
  ['pcAttPermissions','Permisos, días libres y feriados','Registra novedades justificadas sin alterar el historial.'],
  ['pcAttPayroll','Pagos y horas trabajadas','Revisa los resúmenes salariales y de horas.']
 ];
 attGroups.forEach(([id,t,sub])=>{let g=stage2Group(id,t,sub);if(!g.parentNode)p.attendance.appendChild(g)});
 ['#pd43Table','#pd43ResumenLista'].forEach(s=>move($(s),$('#pcAttToday .pc-module-body')));
 move($('#pd5-calendario'),$('#pcAttCalendar .pc-module-body'));
 move($('#pd44-justifica'),$('#pcAttPermissions .pc-module-body'));
 moveByHeading(p.attendance,/Feriados|Días libres|Notificaciones/i,$('#pcAttPermissions .pc-module-body'));
 move($('#resumenPagos'),$('#pcAttPayroll .pc-module-body'));
 moveByHeading(p.attendance,/Resumen de marcaciones/i,$('#pcAttPayroll .pc-module-body'));
 // Configuración: mantiene solamente ajustes globales. Los módulos aparecen plegados.
 const wrap=$('#pcSettingsWrap');if(wrap){$$('.pc-accordion',wrap).forEach((d,i)=>{if(i>0)d.removeAttribute('open')});}
 // Limpia accesos técnicos visibles sin borrar sus controles.
 $$('.pc-module-group h2,.pc-module-group h3,.pc-module-group h4').forEach(h=>{h.textContent=(h.textContent||'').replace(/\b(v\s?\d+(?:\.\d+)?|enterprise|control pro)\b/ig,'').replace(/\s{2,}/g,' ').trim()});
}
function buildSettings(page){
 const wrap=document.createElement('div');wrap.id='pcSettingsWrap';page.appendChild(wrap);
 const defs=[['Datos de la empresa y apariencia','🏢',['#pd44-config']],['Horarios generales','🕒',[]],['Seguridad de marcación','🔐',['#pd5-seguridad','#secAttendancePanel','#secSecurityAlerts']],['Respaldo y mantenimiento','💾',['#pd44-respaldo']]];
 defs.forEach(([t,i,sels])=>{const a=accordion(t,i);wrap.appendChild(a);sels.forEach(s=>move($(s),$('.pc-accordion-body',a)));if(t==='Horarios generales')$('.pc-accordion-body',a).innerHTML='<p>Los horarios individuales se editan desde <b>Empleados</b>. Los feriados y días libres se administran desde <b>Asistencia</b>.</p>';});
}
function buildAlerts(page){
 const box=document.createElement('div');box.className='pc-card';box.innerHTML=`<div class="pc-alert-toolbar"><label>Desde<input id="pcAlertFrom" type="date"></label><label>Hasta<input id="pcAlertTo" type="date"></label><label>Funcionario<select id="pcAlertEmp"><option value="">Todos</option></select></label><button id="pcAlertToggle">Ocultar historial ▲</button></div><div id="pcAlertSummary" class="pc-summary"></div><div id="pcAlertHistory"></div>`;page.appendChild(box);
 ['pcAlertFrom','pcAlertTo','pcAlertEmp'].forEach(id=>$('#'+id).addEventListener('change',renderAlerts));$('#pcAlertToggle').onclick=()=>{const h=$('#pcAlertHistory'),closed=h.hidden;h.hidden=!closed;$('#pcAlertToggle').textContent=closed?'Ocultar historial ▲':'Mostrar historial ▼';};
}
function buildReports(page){
 const box=document.createElement('div');box.className='pc-card pc-report-center';box.innerHTML=`
 <div class="pc-report-head"><div><span class="pc-report-kicker">Centro de reportes</span><h3>Reportes de asistencia, horas y GPS</h3><p>Úsalo para consultar un período específico, filtrar por funcionario o sucursal y generar un documento para imprimir, PDF o Excel.</p></div><div class="pc-report-badge">📊</div></div>
 <div class="pc-filters pc-report-filters">
  <label>Período<select id="pcRepType"><option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="rango">Rango personalizado</option></select></label>
  <label>Desde<input id="pcRepFrom" type="date"></label><label>Hasta<input id="pcRepTo" type="date"></label>
  <label>Funcionario<select id="pcRepEmp"><option value="">Todos los funcionarios</option></select></label>
  <label>Sucursal<select id="pcRepSede"><option value="">Todas las sucursales</option></select></label>
  <label>Contenido<select id="pcRepInclude"><option value="asistencia">Asistencia y horas</option><option value="completo">Asistencia + alertas GPS</option><option value="gps">Solo alertas GPS</option></select></label>
 </div>
 <div class="pc-report-options"><label><input id="pcRepAbsences" type="checkbox" checked> Incluir ausencias</label><label><input id="pcRepLate" type="checkbox" checked> Identificar atrasos</label><label><input id="pcRepDetails" type="checkbox" checked> Mostrar las cuatro marcaciones</label></div>
 <div class="pc-actions pc-report-actions"><button id="pcRepPreview">👁️ Vista previa</button><button id="pcRepExcel">📗 Exportar Excel</button><button id="pcRepPdf">📄 Descargar PDF</button><button id="pcRepPrint" class="pc-secondary">🖨️ Imprimir</button></div>
 <div id="pcRepPeriodLabel" class="pc-report-period"></div><div id="pcRepSummary" class="pc-summary"></div><div id="pcRepPreviewBox" class="pc-report-preview"><p>Selecciona los filtros y pulsa <b>Vista previa</b>.</p></div>`;page.appendChild(box);
 $('#pcRepType').onchange=syncReportDates;['pcRepFrom','pcRepTo','pcRepEmp','pcRepSede','pcRepInclude','pcRepAbsences','pcRepLate','pcRepDetails'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{if($('#pcRepPreviewBox').dataset.rendered==='1')renderReport()}));
 $('#pcRepPreview').onclick=renderReport;$('#pcRepExcel').onclick=exportReport;$('#pcRepPdf').onclick=exportReportPdf;$('#pcRepPrint').onclick=()=>{renderReport();document.body.classList.add('pc-print-report');setTimeout(()=>{window.print();document.body.classList.remove('pc-print-report')},120)};syncReportDates();
}
function localISO(d){const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)}
function today(){return localISO(new Date())}
function syncReportDates(){const type=$('#pcRepType')?.value,d=new Date(),to=today();let from=to;
 if(type==='semanal'){d.setDate(d.getDate()-6);from=localISO(d)}
 else if(type==='quincenal'){from=to.slice(0,8)+(Number(to.slice(8))<=15?'01':'16')}
 else if(type==='mensual'){from=to.slice(0,8)+'01'}
 $('#pcRepFrom').value=from;$('#pcRepTo').value=to;const custom=type==='rango';$('#pcRepFrom').disabled=!custom&&type==='diario';$('#pcRepTo').disabled=!custom&&type==='diario';
}
function dateIn(fecha,from,to){return (!from||fecha>=from)&&(!to||fecha<=to)}
function parseTime(v){if(v==null)return null;if(typeof v==='object'){if(Number.isFinite(Number(v.timestamp)))return Number(v.timestamp);v=v.hora||v.time||''}const m=String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);if(!m)return null;return (+m[1])*60+(+m[2])+(+(m[3]||0))/60}
function timeLabel(v){if(v==null)return '—';if(typeof v==='object')return v.hora||v.time||'—';return String(v||'—')}
function markOf(day,type){const v=day?.[type];return v&&typeof v==='object'?v:(v?{hora:v}:null)}
function branchOf(day){for(const type of ['entrada','almuerzo_salida','almuerzo_regreso','salida']){const v=markOf(day,type);const b=v?.sede||v?.sucursal||v?.local||v?.nombreSede;if(b)return b}return day?.sede||day?.sucursal||day?.local||''}
function durationHours(day){const en=markOf(day,'entrada'),out=markOf(day,'salida');let a=parseTime(en),b=parseTime(out);if(a==null||b==null)return null;if(a>1000000000&&b>1000000000){let mins=(b-a)/60000;const as=parseTime(markOf(day,'almuerzo_salida')),ar=parseTime(markOf(day,'almuerzo_regreso'));if(as&&ar&&ar>as)mins-=(ar-as)/60000;return Math.max(0,mins/60)}let mins=b-a;if(mins<0)mins+=1440;const as=parseTime(markOf(day,'almuerzo_salida')),ar=parseTime(markOf(day,'almuerzo_regreso'));if(as!=null&&ar!=null){let lunch=ar-as;if(lunch<0)lunch+=1440;mins-=lunch}return Math.max(0,mins/60)}
function scheduledStart(e,fecha){const candidates=[e?.horario?.entrada,e?.horaEntrada,e?.horarioEntrada,e?.entradaHorario,e?.turnoEntrada];for(const c of candidates)if(c)return String(c);return '08:00'}
function isLate(day,e,fecha){const en=markOf(day,'entrada');if(!en)return false;const actual=parseTime(en),planned=parseTime(scheduledStart(e,fecha));const tol=Number(e?.tolerancia||e?.minutosTolerancia||0);if(actual==null||planned==null||actual>1000000000)return false;return actual>planned+tol}
function eachDate(from,to){const arr=[];if(!from||!to)return arr;let d=new Date(from+'T12:00:00'),end=new Date(to+'T12:00:00');while(d<=end){arr.push(localISO(d));d.setDate(d.getDate()+1)}return arr}
function isWorkday(e,fecha){const d=new Date(fecha+'T12:00:00').getDay();if(Array.isArray(e?.diasLaborales))return e.diasLaborales.map(Number).includes(d);return d!==0}
function getRows(){const from=$('#pcRepFrom').value,to=$('#pcRepTo').value,eid=$('#pcRepEmp').value,sede=$('#pcRepSede').value,inc=$('#pcRepInclude').value,withAbs=$('#pcRepAbsences').checked,withLate=$('#pcRepLate').checked;const rows=[];const dates=eachDate(from,to);
 if(inc!=='gps')Object.entries(emp).forEach(([id,e])=>{if(eid&&id!==eid)return;const mm=marks[id]||{};dates.forEach(fecha=>{const day=mm[fecha]||null;const branch=day?branchOf(day):(e.sucursalNombre||e.sedeNombre||'');if(sede&&branch!==sede)return;if(!day){if(withAbs&&isWorkday(e,fecha))rows.push({kind:'attendance',Fecha:fecha,Empleado:e.nombre||'Sin nombre',Sucursal:branch||'—',Entrada:'—','Salida almuerzo':'—','Regreso almuerzo':'—',Salida:'—','Horas trabajadas':'0.00',Atraso:'—',Estado:'Ausente'});return}
  const hrs=durationHours(day),late=withLate&&isLate(day,e,fecha);rows.push({kind:'attendance',Fecha:fecha,Empleado:e.nombre||'Sin nombre',Sucursal:branch||'—',Entrada:timeLabel(markOf(day,'entrada')),'Salida almuerzo':timeLabel(markOf(day,'almuerzo_salida')),'Regreso almuerzo':timeLabel(markOf(day,'almuerzo_regreso')),Salida:timeLabel(markOf(day,'salida')),'Horas trabajadas':hrs==null?'—':hrs.toFixed(2),Atraso:late?'Sí':'No',Estado:markOf(day,'entrada')?'Presente':'Incompleto'});
 });});
 if(inc==='gps'||inc==='completo')Object.values(alerts).forEach(a=>{const ts=Number(a.timestamp||a.fechaHora||0),fecha=ts?localISO(new Date(ts)):String(a.fecha||'').slice(0,10);if(!dateIn(fecha,from,to))return;const aid=a.empleadoId||a.idEmpleado||'',aname=a.empleado||a.nombreEmpleado||'Desconocido',branch=a.sedeCercana||a.sucursal||a.sede||'';if(eid&&aid!==eid&&(emp[eid]?.nombre||'')!==aname)return;if(sede&&branch!==sede)return;rows.push({kind:'alert',Fecha:fecha,Empleado:aname,Sucursal:branch||'—',Entrada:'—','Salida almuerzo':'—','Regreso almuerzo':'—',Salida:'—','Horas trabajadas':'—',Atraso:'—',Estado:a.motivo||a.tipo||'Intento GPS bloqueado'});});
 return rows.sort((a,b)=>a.Fecha.localeCompare(b.Fecha)||a.Empleado.localeCompare(b.Empleado)||a.kind.localeCompare(b.kind));}
function reportTitle(){const f=$('#pcRepFrom').value,t=$('#pcRepTo').value;return `Reporte de asistencia · ${f||'—'} al ${t||'—'}`}
function publicRows(rows){const details=$('#pcRepDetails').checked;return rows.map(r=>{const out={Fecha:r.Fecha,Empleado:r.Empleado,Sucursal:r.Sucursal,Estado:r.Estado};if(details){out.Entrada=r.Entrada;out['Salida almuerzo']=r['Salida almuerzo'];out['Regreso almuerzo']=r['Regreso almuerzo'];out.Salida=r.Salida}out['Horas trabajadas']=r['Horas trabajadas'];out.Atraso=r.Atraso;return out})}
function reportStats(rows){const att=rows.filter(r=>r.kind==='attendance'),present=att.filter(r=>r.Estado==='Presente').length,absent=att.filter(r=>r.Estado==='Ausente').length,late=att.filter(r=>r.Atraso==='Sí').length,gps=rows.filter(r=>r.kind==='alert').length,hours=att.reduce((n,r)=>n+(Number(r['Horas trabajadas'])||0),0);return{records:rows.length,people:new Set(rows.map(r=>r.Empleado)).size,present,absent,late,gps,hours}}
function renderReport(){const rows=getRows(),view=publicRows(rows),box=$('#pcRepPreviewBox'),st=reportStats(rows);$('#pcRepPeriodLabel').textContent=reportTitle();$('#pcRepSummary').innerHTML=`<div><small>Registros</small><b>${st.records}</b></div><div><small>Funcionarios</small><b>${st.people}</b></div><div><small>Presentes</small><b>${st.present}</b></div><div><small>Ausencias</small><b>${st.absent}</b></div><div><small>Atrasos</small><b>${st.late}</b></div><div><small>Horas</small><b>${st.hours.toFixed(1)}</b></div><div><small>Alertas GPS</small><b>${st.gps}</b></div>`;box.dataset.rendered='1';if(!view.length){box.innerHTML='<div class="pc-empty-report">📭<b>No hay información con los filtros seleccionados.</b><span>Prueba otro período, funcionario o sucursal.</span></div>';return rows;}const cols=Object.keys(view[0]);box.innerHTML=`<div class="pc-report-doc"><div class="pc-report-doc-head"><img src="img/logo-poladent.png" alt="Poladent"><div><b>POLADENT CASA DENTAL</b><span>${esc(reportTitle())}</span></div></div><div class="pc-table-wrap"><table class="pc-table pc-report-table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${view.map((r,i)=>`<tr class="${rows[i]?.kind==='alert'?'pc-row-alert':r.Estado==='Ausente'?'pc-row-absent':r.Atraso==='Sí'?'pc-row-late':''}">${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="pc-report-foot">Generado el ${new Date().toLocaleString('es-VE')} · Poladent Sistema</div></div>`;return rows;}
function exportReport(){const rows=renderReport();if(!rows.length)return alert('No hay datos para exportar.');if(!window.XLSX)return alert('La librería de Excel todavía no cargó.');const view=publicRows(rows),st=reportStats(rows),wb=XLSX.utils.book_new();const summary=[['POLADENT CASA DENTAL'],[reportTitle()],[],['Resumen','Valor'],['Registros',st.records],['Funcionarios',st.people],['Presentes',st.present],['Ausencias',st.absent],['Atrasos',st.late],['Horas trabajadas',Number(st.hours.toFixed(2))],['Alertas GPS',st.gps],[],Object.keys(view[0]),...view.map(r=>Object.values(r))];const ws=XLSX.utils.aoa_to_sheet(summary);ws['!cols']=Object.keys(view[0]).map(k=>({wch:Math.max(12,Math.min(28,k.length+5))}));XLSX.utils.book_append_sheet(wb,ws,'Asistencia');XLSX.writeFile(wb,`Reporte_Asistencia_${$('#pcRepFrom').value}_${$('#pcRepTo').value}.xlsx`);}
function exportReportPdf(){const rows=renderReport();if(!rows.length)return alert('No hay datos para generar el PDF.');if(!window.jspdf?.jsPDF)return alert('La librería PDF todavía no cargó.');const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),view=publicRows(rows),cols=Object.keys(view[0]),st=reportStats(rows);let y=14;doc.setFontSize(15);doc.text('POLADENT CASA DENTAL',14,y);doc.setFontSize(10);doc.text(reportTitle(),14,y+6);doc.text(`Presentes: ${st.present}  Ausencias: ${st.absent}  Atrasos: ${st.late}  Horas: ${st.hours.toFixed(1)}  Alertas GPS: ${st.gps}`,14,y+12);y+=19;const widths=cols.map(c=>c==='Empleado'?38:c==='Estado'?43:c==='Fecha'?23:26),pageW=277;const total=widths.reduce((a,b)=>a+b,0),scale=Math.min(1,pageW/total),w=widths.map(x=>x*scale);const rowH=7;function header(){doc.setFillColor(235,240,247);doc.rect(10,y,w.reduce((a,b)=>a+b,0),rowH,'F');doc.setFontSize(7);let x=10;cols.forEach((c,i)=>{doc.text(String(c).slice(0,22),x+1,y+4.6);x+=w[i]});y+=rowH}header();doc.setFontSize(6.5);view.forEach(r=>{if(y>194){doc.addPage();y=12;header()}let x=10;cols.forEach((c,i)=>{const text=String(r[c]??'—').replace(/\s+/g,' ').slice(0,34);doc.rect(x,y,w[i],rowH);doc.text(text,x+1,y+4.5,{maxWidth:w[i]-2});x+=w[i]});y+=rowH});doc.setFontSize(7);doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`,10,205);doc.save(`Reporte_Asistencia_${$('#pcRepFrom').value}_${$('#pcRepTo').value}.pdf`);}
function renderAlerts(){const from=$('#pcAlertFrom')?.value||'',to=$('#pcAlertTo')?.value||'',name=$('#pcAlertEmp')?.value||'';let rows=Object.values(alerts).filter(a=>{const f=new Date(a.timestamp||0).toISOString().slice(0,10);return dateIn(f,from,to)&&(!name||a.empleado===name)}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));const byEmp={};rows.forEach(a=>byEmp[a.empleado||'Desconocido']=(byEmp[a.empleado||'Desconocido']||0)+1);$('#pcAlertSummary').innerHTML=`<div><small>Total</small><b>${rows.length}</b></div><div><small>Funcionarios</small><b>${Object.keys(byEmp).length}</b></div><div><small>Fuera del área</small><b>${rows.filter(a=>/fuera|distancia/i.test(a.motivo||'')).length}</b></div><div><small>Sin sucursal</small><b>${rows.filter(a=>/sin tienda|sin sucursal|asignad/i.test(a.motivo||'')).length}</b></div><div><small>Último intento</small><b>${rows[0]?new Date(rows[0].timestamp).toLocaleDateString('es-VE'):'—'}</b></div>`;$('#pcAlertHistory').innerHTML=rows.length?rows.map(a=>`<div class="pc-alert-item"><b>${esc(a.empleado||'Empleado desconocido')}</b><span>${esc(a.motivo||'Intento bloqueado')}</span><small>${esc(fmtDate(a.timestamp))}${a.distancia!=null?' · '+Math.round(a.distancia)+' m':''}${a.sedeCercana?' · '+esc(a.sedeCercana):''}</small></div>`).join(''):'<p>No hay alertas con esos filtros.</p>';}
function populate(){const opts=Object.entries(emp).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));['#pcRepEmp'].forEach(s=>{const el=$(s);if(el)el.innerHTML='<option value="">Todos</option>'+opts.map(([id,e])=>`<option value="${id}">${esc(e.nombre||'Sin nombre')}</option>`).join('')});const names=[...new Set(opts.map(([,e])=>e.nombre).filter(Boolean))];const ae=$('#pcAlertEmp');if(ae)ae.innerHTML='<option value="">Todos</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');const ss=$('#pcRepSede');if(ss)ss.innerHTML='<option value="">Todas</option>'+Object.values(sedes).map(s=>`<option>${esc(s.nombre||'Sucursal')}</option>`).join('');}
function renderHome(){const t=today(),total=Object.keys(emp).length,present=Object.keys(emp).filter(id=>marks[id]&&marks[id][t]).length;$('#pcKTotal').textContent=total;$('#pcKPresent').textContent=present;$('#pcKAbsent').textContent=Math.max(0,total-present);const aToday=Object.values(alerts).filter(a=>new Date(a.timestamp||0).toISOString().slice(0,10)===t);$('#pcKAlert').textContent=aToday.length;$('#pcKSedes').textContent=Object.values(sedes).filter(s=>s.activa!==false).length;
 const mr=[];Object.entries(emp).forEach(([id,e])=>Object.entries(marks[id]||{}).forEach(([fecha,m])=>Object.entries(m||{}).forEach(([tipo,v])=>{const ts=v?.timestamp||v?.ts||0;mr.push({nombre:e.nombre,fecha,tipo,hora:v?.hora||v,ts})})));mr.sort((a,b)=>(b.ts||0)-(a.ts||0));$('#pcRecentMarks').innerHTML=mr.slice(0,5).map(r=>`<div class="pc-row"><div><b>${esc(r.nombre)}</b><small>${esc(r.tipo.replace('_',' '))}</small></div><small>${esc(r.fecha)} · ${esc(r.hora||'—')}</small></div>`).join('')||'<p>Sin marcaciones recientes.</p>';$('#pcRecentAlerts').innerHTML=Object.values(alerts).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,5).map(a=>`<div class="pc-row"><div><b>${esc(a.empleado||'Desconocido')}</b><small>${esc(a.motivo||'Bloqueado')}</small></div><small>${new Date(a.timestamp||0).toLocaleDateString('es-VE')}</small></div>`).join('')||'<p>Sin alertas recientes.</p>';}

function cleanupLegacy(panel,pages){
  // Mantiene las funciones, pero evita mostrar contenedores y paneles duplicados.
  const hideSelectors=[
    '.dashboardHero','.kpiGrid','.adminTopActions',
    '#pd42-dashboard','#pd42-empleados','#pd42-asistencia','#pd42-reportes',
    '#pd44-main','#pd5Enterprise','#pd5-home'
  ];
  hideSelectors.forEach(sel=>{
    $$(sel,panel).forEach(el=>{
      if(!el.closest('.pc-page')) el.classList.add('pc-legacy-shell-hidden');
    });
  });
  // Quita encabezados técnicos/antiguos sin eliminar sus módulos.
  $$('h2,h3,h4,p,span',panel).forEach(el=>{
    if(el.children.length) return;
    const txt=(el.textContent||'').trim();
    if(/^(control pro|enterprise|versi[oó]n|fase|gps editable)/i.test(txt)) el.classList.add('pc-legacy-label-hidden');
  });
  // El contenido suelto del panel queda oculto; solo se muestran barra superior y la interfaz comercial.
  Array.from(panel.children).forEach(ch=>{
    if(ch.classList.contains('adminTopBar')||ch.classList.contains('pc-shell')||ch.classList.contains('modal')||ch.classList.contains('modalBackdrop')) return;
    if(ch.id==='logoutBtn') return;
    ch.classList.add('pc-legacy-direct-hidden');
  });
}

function subscribe(){if(!readyDb())return setTimeout(subscribe,250);const d=firebase.database();window.PoladentData.subscribe('empleados',s=>{emp=s.val()||{};window.PoladentPerformance?.schedule('pc-empleados',()=>{populate();renderHome()})});window.PoladentData.subscribe('marcaciones',s=>{marks=s.val()||{};window.PoladentPerformance?.schedule('pc-marcaciones',renderHome)});window.PoladentData.subscribe('alertas_gps',s=>{alerts=s.val()||{};window.PoladentPerformance?.schedule('pc-alertas',()=>{renderAlerts();renderHome()})});window.PoladentData.subscribe('configuracion_gps_v51/sedes',s=>{sedes=s.val()||{};window.PoladentPerformance?.schedule('pc-sedes',()=>{populate();renderHome()})});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,50));else setTimeout(mount,50);
})();

/* ---- módulo integrado ---- */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg={activo:true,fotoEntrada:true,fotoAlmuerzoSalida:false,fotoAlmuerzoRegreso:false,fotoSalida:true,alertarDispositivoCompartido:true,ventanaDispositivoMinutos:10,guardarEvidencia:true,maxIntentosPin:5,bloqueoPinMinutos:5};let alertas={};
function dbReady(){return window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database}
function mount(){if($('#secAttendancePanel'))return;if(!$('#pc-settings')||!$('#pc-alerts'))return setTimeout(mount,400);
 const settings=$('#pcSettingsWrap')||$('#pc-settings');const details=document.createElement('details');details.className='pc-accordion';details.open=false;details.innerHTML=`<summary>🔐 Seguridad de marcación</summary><div class="pc-accordion-body"><div id="secAttendancePanel" class="sec-admin-card"><h3>Verificación de identidad y prevención de fraude</h3><p>Configura fotografías en vivo, alertas de dispositivo compartido y protección contra intentos repetidos de PIN.</p><div class="sec-grid"><label class="sec-option"><span>Activar control fotográfico</span><input id="secActivo" type="checkbox"></label><label class="sec-option"><span>Foto al entrar</span><input id="secEntrada" type="checkbox"></label><label class="sec-option"><span>Foto al salir a almorzar</span><input id="secAlmSalida" type="checkbox"></label><label class="sec-option"><span>Foto al regresar del almuerzo</span><input id="secAlmRegreso" type="checkbox"></label><label class="sec-option"><span>Foto en salida final</span><input id="secSalida" type="checkbox"></label><label class="sec-option"><span>Alertar dispositivo compartido</span><input id="secDeviceAlert" type="checkbox"></label><div class="sec-field"><label>Ventana de dispositivo compartido (minutos)</label><input id="secDeviceMinutes" type="number" min="1" max="240"></div><label class="sec-option"><span>Guardar evidencia fotográfica</span><input id="secGuardarFoto" type="checkbox"></label><div class="sec-field"><label>Intentos de PIN antes de bloquear</label><input id="secMaxPin" type="number" min="2" max="20"></div><div class="sec-field"><label>Duración del bloqueo (minutos)</label><input id="secLockMinutes" type="number" min="1" max="120"></div></div><div class="sec-actions"><button id="secSave">Guardar seguridad</button></div><div id="secSaveMsg" class="sec-save-msg"></div><p class="privacy-note">Las fotografías y datos de ubicación se usan únicamente para validar asistencia y deben ser consultados solo por personal autorizado.</p></div></div>`;settings.appendChild(details);
 const alertsPage=$('#pc-alerts');const card=document.createElement('div');card.id='secSecurityAlerts';card.className='sec-admin-card';card.innerHTML=`<div class="sec-title-row"><div><h3>Auditoría de seguridad</h3><p>PIN inválido, bloqueo por intentos, dispositivo compartido y fallas de fotografía.</p></div><button id="secAlertToggle" type="button">Mostrar historial ▼</button></div><div id="secAuditSummary" class="sec-summary"></div><div class="sec-grid"><div class="sec-field"><label>Desde</label><input id="secAlertFrom" type="date"></div><div class="sec-field"><label>Hasta</label><input id="secAlertTo" type="date"></div><div class="sec-field"><label>Funcionario</label><select id="secAlertEmployee"><option value="">Todos</option></select></div><div class="sec-field"><label>Tipo</label><select id="secAlertType"><option value="">Todos</option><option value="PIN_INVALIDO">PIN inválido</option><option value="PIN_BLOQUEADO">Bloqueo de PIN</option><option value="DISPOSITIVO_COMPARTIDO">Dispositivo compartido</option><option value="FOTO_ERROR">Error de fotografía</option></select></div></div><div id="secAlertList" class="sec-alert-list" hidden></div>`;alertsPage.appendChild(card);
 ['secAlertFrom','secAlertTo','secAlertEmployee','secAlertType'].forEach(id=>$('#'+id).addEventListener('change',renderAlerts));$('#secAlertToggle').onclick=()=>{const l=$('#secAlertList');l.hidden=!l.hidden;$('#secAlertToggle').textContent=l.hidden?'Mostrar historial ▼':'Ocultar historial ▲'};$('#secSave').onclick=save;fill();subscribe();
}
function fill(){if(!$('#secActivo'))return;$('#secActivo').checked=cfg.activo!==false;$('#secEntrada').checked=cfg.fotoEntrada!==false;$('#secAlmSalida').checked=!!cfg.fotoAlmuerzoSalida;$('#secAlmRegreso').checked=!!cfg.fotoAlmuerzoRegreso;$('#secSalida').checked=cfg.fotoSalida!==false;$('#secDeviceAlert').checked=cfg.alertarDispositivoCompartido!==false;$('#secDeviceMinutes').value=Number(cfg.ventanaDispositivoMinutos)||10;$('#secGuardarFoto').checked=cfg.guardarEvidencia!==false;$('#secMaxPin').value=Number(cfg.maxIntentosPin)||5;$('#secLockMinutes').value=Number(cfg.bloqueoPinMinutos)||5;}
async function save(){const next={activo:$('#secActivo').checked,fotoEntrada:$('#secEntrada').checked,fotoAlmuerzoSalida:$('#secAlmSalida').checked,fotoAlmuerzoRegreso:$('#secAlmRegreso').checked,fotoSalida:$('#secSalida').checked,alertarDispositivoCompartido:$('#secDeviceAlert').checked,ventanaDispositivoMinutos:Math.max(1,Number($('#secDeviceMinutes').value)||10),guardarEvidencia:$('#secGuardarFoto').checked,maxIntentosPin:Math.max(2,Number($('#secMaxPin').value)||5),bloqueoPinMinutos:Math.max(1,Number($('#secLockMinutes').value)||5),actualizadoEn:Date.now()};try{await firebase.database().ref('configuracion_seguridad_asistencia').update(next);$('#secSaveMsg').textContent='Configuración guardada correctamente.';}catch(e){$('#secSaveMsg').textContent='No se pudo guardar: '+(e.message||e)}}
function iso(ts){const d=new Date(Number(ts)||0);return d.toISOString().slice(0,10)}
function renderAlerts(){if(!$('#secAlertList'))return;const from=$('#secAlertFrom').value,to=$('#secAlertTo').value,type=$('#secAlertType').value,employee=$('#secAlertEmployee').value;const rows=Object.values(alertas).filter(a=>(!from||iso(a.timestamp)>=from)&&(!to||iso(a.timestamp)<=to)&&(!type||a.codigo===type)&&(!employee||(a.empleado||'')===employee)).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));const counts={pin:0,lock:0,device:0,photo:0};rows.forEach(a=>{if(a.codigo==='PIN_INVALIDO')counts.pin++;if(a.codigo==='PIN_BLOQUEADO')counts.lock++;if(a.codigo==='DISPOSITIVO_COMPARTIDO')counts.device++;if(a.codigo==='FOTO_ERROR')counts.photo++;});$('#secAuditSummary').innerHTML=`<div><small>Total</small><b>${rows.length}</b></div><div><small>PIN inválido</small><b>${counts.pin}</b></div><div><small>Bloqueos</small><b>${counts.lock}</b></div><div><small>Dispositivo compartido</small><b>${counts.device}</b></div><div><small>Errores de foto</small><b>${counts.photo}</b></div>`;$('#secAlertList').innerHTML=rows.length?rows.map(a=>`<div class="sec-alert">${a.fotoEvidencia?`<img class="sec-evidence-thumb" src="${a.fotoEvidencia}" alt="Evidencia">`:''}<b>${esc(a.empleado||'Empleado no identificado')}</b><span>${esc(a.motivo||a.codigo||'Alerta')}</span><small>${new Date(a.timestamp||0).toLocaleString('es-VE')}${a.tipoMarcacion?' · '+esc(a.tipoMarcacion.replaceAll('_',' ')):''}${a.dispositivoId?' · dispositivo '+esc(String(a.dispositivoId).slice(-8)):''}</small></div>`).join(''):'<p>No hay alertas de seguridad con estos filtros.</p>';}
function fillEmployees(){const select=$('#secAlertEmployee');if(!select)return;const names=[...new Set(Object.values(alertas).map(a=>a.empleado).filter(Boolean))].sort((a,b)=>a.localeCompare(b));const current=select.value;select.innerHTML='<option value="">Todos</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');select.value=current;}
function subscribe(){if(!dbReady())return setTimeout(subscribe,300);const db=firebase.database();window.PoladentData.subscribe('configuracion_seguridad_asistencia',s=>{cfg={...cfg,...(s.val()||{})};fill()});window.PoladentData.subscribe('alertas_seguridad',s=>{alertas=s.val()||{};fillEmployees();renderAlerts()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,900));else setTimeout(mount,900);
})();

