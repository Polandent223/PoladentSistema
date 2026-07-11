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
  reports:mkPage('pc-reports','Reportes','Selecciona exactamente qué deseas consultar y exportar.'),
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
 buildAlerts(pages.alerts); buildReports(pages.reports); buildSettings(pages.settings);
 $$('.pc-nav button',side).forEach(b=>b.onclick=()=>{$$('.pc-nav button',side).forEach(x=>x.classList.toggle('active',x===b));$$('.pc-page',main).forEach(p=>p.classList.toggle('active',p.id===b.dataset.page));window.scrollTo({top:0,behavior:'smooth'});});
 const logout=$('#logoutBtn');if(logout)move(logout,side);
 subscribe();
 new MutationObserver(()=>relocatePlugins(pages)).observe(panel,{childList:true,subtree:true});
}
function relocatePlugins(p){
 move($('#gps52Panel')||$('#gps51Panel'),p.gps); move($('#gps53Alerts'),p.alerts);
 ['#pd44-config','#pd44-roles','#pd44-respaldo','#pd5-seguridad'].forEach(s=>{const e=$(s);if(e&&!e.closest('.pc-accordion'))move(e,p.settings)});
 ['#pd44-ficha','#pd44-justifica','#pd5-perfil'].forEach(s=>move($(s),p.employees));
 ['#pd43Table','#pd43ResumenLista','#pd5-calendario'].forEach(s=>move($(s),p.attendance));
 ['#pd5-reportes'].forEach(s=>{const e=$(s);if(e)e.classList.add('pc-hidden-legacy')});
 if($('#gps53Alerts'))$('#gps53Alerts').classList.add('pc-hidden-legacy');
}
function buildSettings(page){
 const wrap=document.createElement('div');wrap.id='pcSettingsWrap';page.appendChild(wrap);
 const defs=[['Datos de la empresa','🏢',['#pd44-config']],['Horarios y asistencia','🕒',[]],['Empleados y permisos','👥',['#pd44-roles']],['Seguridad','🔐',['#pd5-seguridad']],['Respaldo y mantenimiento','💾',['#pd44-respaldo']]];
 defs.forEach(([t,i,sels])=>{const a=accordion(t,i);wrap.appendChild(a);sels.forEach(s=>move($(s),$('.pc-accordion-body',a)));if(t==='Horarios y asistencia')$('.pc-accordion-body',a).innerHTML='<p>Los horarios individuales se editan desde <b>Empleados</b>. Los feriados y días libres se administran desde <b>Asistencia</b>.</p>';});
}
function buildAlerts(page){
 const box=document.createElement('div');box.className='pc-card';box.innerHTML=`<div class="pc-alert-toolbar"><label>Desde<input id="pcAlertFrom" type="date"></label><label>Hasta<input id="pcAlertTo" type="date"></label><label>Funcionario<select id="pcAlertEmp"><option value="">Todos</option></select></label><button id="pcAlertToggle">Ocultar historial ▲</button></div><div id="pcAlertSummary" class="pc-summary"></div><div id="pcAlertHistory"></div>`;page.appendChild(box);
 ['pcAlertFrom','pcAlertTo','pcAlertEmp'].forEach(id=>$('#'+id).addEventListener('change',renderAlerts));$('#pcAlertToggle').onclick=()=>{const h=$('#pcAlertHistory'),closed=h.hidden;h.hidden=!closed;$('#pcAlertToggle').textContent=closed?'Ocultar historial ▲':'Mostrar historial ▼';};
}
function buildReports(page){
 const box=document.createElement('div');box.className='pc-card';box.innerHTML=`<div class="pc-filters"><label>Tipo de reporte<select id="pcRepType"><option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option><option value="rango">Rango personalizado</option></select></label><label>Desde<input id="pcRepFrom" type="date"></label><label>Hasta<input id="pcRepTo" type="date"></label><label>Funcionario<select id="pcRepEmp"><option value="">Todos</option></select></label><label>Sucursal<select id="pcRepSede"><option value="">Todas</option></select></label><label>Incluir<select id="pcRepInclude"><option value="todo">Información completa</option><option value="marcaciones">Solo marcaciones</option><option value="gps">Alertas GPS</option></select></label></div><div class="pc-actions"><button id="pcRepPreview">Vista previa</button><button id="pcRepExcel">Exportar Excel</button><button id="pcRepPrint">Imprimir / PDF</button></div><div id="pcRepSummary" class="pc-summary"></div><div id="pcRepPreviewBox"><p>Selecciona los filtros y pulsa <b>Vista previa</b>.</p></div>`;page.appendChild(box);
 $('#pcRepType').onchange=syncReportDates;$('#pcRepPreview').onclick=renderReport;$('#pcRepExcel').onclick=exportReport;$('#pcRepPrint').onclick=()=>{renderReport();setTimeout(()=>window.print(),100)};syncReportDates();
}
function today(){return new Date().toISOString().slice(0,10)}
function syncReportDates(){const type=$('#pcRepType')?.value,d=new Date(),to=today();let from=to;if(type==='semanal'){d.setDate(d.getDate()-6);from=d.toISOString().slice(0,10)}else if(type==='quincenal'){from=to.slice(0,8)+(Number(to.slice(8))<=15?'01':'16')}else if(type==='mensual'){from=to.slice(0,8)+'01'}$('#pcRepFrom').value=from;$('#pcRepTo').value=to;}
function dateIn(fecha,from,to){return (!from||fecha>=from)&&(!to||fecha<=to)}
function getRows(){const from=$('#pcRepFrom').value,to=$('#pcRepTo').value,eid=$('#pcRepEmp').value,sede=$('#pcRepSede').value,inc=$('#pcRepInclude').value;const rows=[];
 if(inc!=='gps')Object.entries(emp).forEach(([id,e])=>{if(eid&&id!==eid)return;const mm=marks[id]||{};Object.entries(mm).forEach(([fecha,m])=>{if(!dateIn(fecha,from,to))return;const branch=m.sede||m.sucursal||m.local||'';if(sede&&branch!==sede)return;rows.push({Fecha:fecha,Empleado:e.nombre||'',Sucursal:branch||'—',Entrada:m.entrada?.hora||m.entrada||'—','Salida almuerzo':m.almuerzo_salida?.hora||m.almuerzo_salida||'—','Regreso almuerzo':m.almuerzo_regreso?.hora||m.almuerzo_regreso||'—',Salida:m.salida?.hora||m.salida||'—',Estado:'Marcación'});});});
 if(inc==='gps')Object.values(alerts).forEach(a=>{const fecha=new Date(a.timestamp||0).toISOString().slice(0,10);if(!dateIn(fecha,from,to))return;if(eid&&a.empleadoId!==eid&&a.idEmpleado!==eid)return;if(sede&&a.sedeCercana!==sede)return;rows.push({Fecha:fecha,Empleado:a.empleado||'Desconocido',Sucursal:a.sedeCercana||'—',Entrada:'—','Salida almuerzo':'—','Regreso almuerzo':'—',Salida:'—',Estado:a.motivo||'Intento GPS bloqueado'});});return rows.sort((a,b)=>a.Fecha.localeCompare(b.Fecha)||a.Empleado.localeCompare(b.Empleado));}
function renderReport(){const rows=getRows(),box=$('#pcRepPreviewBox');const employees=new Set(rows.map(r=>r.Empleado)),gps=rows.filter(r=>/GPS|área|tienda|ubicación/i.test(r.Estado)).length;$('#pcRepSummary').innerHTML=`<div><small>Registros</small><b>${rows.length}</b></div><div><small>Funcionarios</small><b>${employees.size}</b></div><div><small>Desde</small><b>${$('#pcRepFrom').value||'—'}</b></div><div><small>Hasta</small><b>${$('#pcRepTo').value||'—'}</b></div><div><small>Alertas GPS</small><b>${gps}</b></div>`;if(!rows.length){box.innerHTML='<p>No hay registros con los filtros seleccionados.</p>';return rows;}const cols=Object.keys(rows[0]);box.innerHTML=`<div class="pc-table-wrap"><table class="pc-table"><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;return rows;}
function exportReport(){const rows=renderReport();if(!rows.length)return alert('No hay datos para exportar.');if(!window.XLSX)return alert('La librería de Excel todavía no cargó.');const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Reporte');XLSX.writeFile(wb,`Reporte_Asistencia_${$('#pcRepFrom').value}_${$('#pcRepTo').value}.xlsx`);}
function renderAlerts(){const from=$('#pcAlertFrom')?.value||'',to=$('#pcAlertTo')?.value||'',name=$('#pcAlertEmp')?.value||'';let rows=Object.values(alerts).filter(a=>{const f=new Date(a.timestamp||0).toISOString().slice(0,10);return dateIn(f,from,to)&&(!name||a.empleado===name)}).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));const byEmp={};rows.forEach(a=>byEmp[a.empleado||'Desconocido']=(byEmp[a.empleado||'Desconocido']||0)+1);$('#pcAlertSummary').innerHTML=`<div><small>Total</small><b>${rows.length}</b></div><div><small>Funcionarios</small><b>${Object.keys(byEmp).length}</b></div><div><small>Fuera del área</small><b>${rows.filter(a=>/fuera|distancia/i.test(a.motivo||'')).length}</b></div><div><small>Sin sucursal</small><b>${rows.filter(a=>/sin tienda|sin sucursal|asignad/i.test(a.motivo||'')).length}</b></div><div><small>Último intento</small><b>${rows[0]?new Date(rows[0].timestamp).toLocaleDateString('es-VE'):'—'}</b></div>`;$('#pcAlertHistory').innerHTML=rows.length?rows.map(a=>`<div class="pc-alert-item"><b>${esc(a.empleado||'Empleado desconocido')}</b><span>${esc(a.motivo||'Intento bloqueado')}</span><small>${esc(fmtDate(a.timestamp))}${a.distancia!=null?' · '+Math.round(a.distancia)+' m':''}${a.sedeCercana?' · '+esc(a.sedeCercana):''}</small></div>`).join(''):'<p>No hay alertas con esos filtros.</p>';}
function populate(){const opts=Object.entries(emp).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));['#pcRepEmp'].forEach(s=>{const el=$(s);if(el)el.innerHTML='<option value="">Todos</option>'+opts.map(([id,e])=>`<option value="${id}">${esc(e.nombre||'Sin nombre')}</option>`).join('')});const names=[...new Set(opts.map(([,e])=>e.nombre).filter(Boolean))];const ae=$('#pcAlertEmp');if(ae)ae.innerHTML='<option value="">Todos</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');const ss=$('#pcRepSede');if(ss)ss.innerHTML='<option value="">Todas</option>'+Object.values(sedes).map(s=>`<option>${esc(s.nombre||'Sucursal')}</option>`).join('');}
function renderHome(){const t=today(),total=Object.keys(emp).length,present=Object.keys(emp).filter(id=>marks[id]&&marks[id][t]).length;$('#pcKTotal').textContent=total;$('#pcKPresent').textContent=present;$('#pcKAbsent').textContent=Math.max(0,total-present);const aToday=Object.values(alerts).filter(a=>new Date(a.timestamp||0).toISOString().slice(0,10)===t);$('#pcKAlert').textContent=aToday.length;$('#pcKSedes').textContent=Object.values(sedes).filter(s=>s.activa!==false).length;
 const mr=[];Object.entries(emp).forEach(([id,e])=>Object.entries(marks[id]||{}).forEach(([fecha,m])=>Object.entries(m||{}).forEach(([tipo,v])=>{const ts=v?.timestamp||v?.ts||0;mr.push({nombre:e.nombre,fecha,tipo,hora:v?.hora||v,ts})})));mr.sort((a,b)=>(b.ts||0)-(a.ts||0));$('#pcRecentMarks').innerHTML=mr.slice(0,5).map(r=>`<div class="pc-row"><div><b>${esc(r.nombre)}</b><small>${esc(r.tipo.replace('_',' '))}</small></div><small>${esc(r.fecha)} · ${esc(r.hora||'—')}</small></div>`).join('')||'<p>Sin marcaciones recientes.</p>';$('#pcRecentAlerts').innerHTML=Object.values(alerts).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,5).map(a=>`<div class="pc-row"><div><b>${esc(a.empleado||'Desconocido')}</b><small>${esc(a.motivo||'Bloqueado')}</small></div><small>${new Date(a.timestamp||0).toLocaleDateString('es-VE')}</small></div>`).join('')||'<p>Sin alertas recientes.</p>';}
function subscribe(){if(!readyDb())return setTimeout(subscribe,250);const d=firebase.database();d.ref('empleados').on('value',s=>{emp=s.val()||{};populate();renderHome()});d.ref('marcaciones').on('value',s=>{marks=s.val()||{};renderHome()});d.ref('alertas_gps').on('value',s=>{alerts=s.val()||{};renderAlerts();renderHome()});d.ref('configuracion_gps_v51/sedes').on('value',s=>{sedes=s.val()||{};populate();renderHome()});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,700));else setTimeout(mount,700);
})();
