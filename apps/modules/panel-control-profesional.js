/* POLADENT - Fase 13: Panel de Control Profesional
   Solo lectura. No modifica marcaciones, empleados, nómina ni historial. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let employees={},marks={},holidays={},freeDays={},justifications={},gpsAlerts={},securityAlerts={},gpsConfig={},generalConfig={},payrollAudit={};
let bound=false,period='hoy';
function isoLocal(d=new Date()){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function today(){return isoLocal(new Date())}
function ts(v){return Number(v?.timestamp??v?.ts??v??0)||0}
function mark(day,type){return window.PoladentAttendance?.mark?.(day,type)||day?.[type]||Object.values(day||{}).find(v=>v?.tipo===type)||null}
function minutesOfTimestamp(v){const n=ts(v);if(!n)return null;const d=new Date(n);return d.getHours()*60+d.getMinutes()}
function timeMinutes(raw,fallback='08:00'){const m=String(raw||fallback).match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
function activeEmployee(e){return !!e&&e.archivado!==true&&e.activo!==false&&String(e.estado||'').toLowerCase()!=='archivado'}
function explicitSchedule(e){return !!(e?.horario&&(e.horario.entrada||e.horario.salida||e.horario.diasLaborales))||!!(e?.horaEntrada||e?.horaSalida||e?.diasLaborales)}
function isHoliday(date){const v=holidays?.[date];return v===true||!!(v&&v.activo!==false)}
function isFree(id,date){const v=freeDays?.[id]?.[date];return !!v&&v.activo!==false}
function justification(id,date){return justifications?.[id]?.[date]||null}
function tolerance(e){return Math.max(0,Number(e?.horario?.tolerancia??e?.tolerancia??generalConfig?.tolerancia??10)||0)}
function schedule(e){return window.PoladentAttendance?.schedule?.(e)||{entrada:e?.horaEntrada||'08:00',salida:e?.horaSalida||'17:00'} }
function scheduled(e,date){return window.PoladentAttendance?.isScheduledWorkday?.(e,date) ?? (new Date(date+'T12:00:00').getDay()!==0)}
function employeePhoto(e){return e?.foto||e?.photo||e?.photoUrl||e?.imagen||''}
function employeeBranch(e){
 const permitted=e?.sedesPermitidas||{};const names=Object.keys(permitted).filter(k=>permitted[k]).map(k=>gpsConfig?.sedes?.[k]?.nombre).filter(Boolean);
 return names.length?names.join(', '):(e?.sede||e?.sucursal||e?.local||'Sin sede asignada');
}
function statusFor(id,e,date=today()){
 const day=marks?.[id]?.[date]||{},en=mark(day,'entrada'),ls=mark(day,'almuerzo_salida'),lr=mark(day,'almuerzo_regreso'),out=mark(day,'salida');
 const hasAny=!!(en||ls||lr||out),holiday=isHoliday(date),free=isFree(id,date),workday=scheduled(e,date),just=justification(id,date),sch=schedule(e),tol=tolerance(e);
 const now=new Date(),isToday=date===today(),nowMin=now.getHours()*60+now.getMinutes(),start=timeMinutes(sch.entrada,'08:00'),end=timeMinutes(sch.salida,'17:00');
 let code='rest',label='Descanso',tone='neutral',attention=false,lateMin=0;
 if(holiday&&!hasAny){code='holiday';label='Feriado';tone='info'}
 else if(free&&!hasAny){code='free';label='Día libre';tone='info'}
 else if(!workday&&!hasAny){code='rest';label='Descanso';tone='neutral'}
 else if(just&&!en&&!hasAny){code='justified';label='Justificada';tone='info'}
 else if(!en&&hasAny){code='incomplete';label='Marcación incompleta';tone='danger';attention=true}
 else if(en&&out){lateMin=Math.max(0,(minutesOfTimestamp(en)??start)-start);code=lateMin>tol?'complete-late':'complete';label=lateMin>tol?`Completó · tarde ${lateMin} min`:'Jornada completada';tone=lateMin>tol?'warn':'ok'}
 else if(en){lateMin=Math.max(0,(minutesOfTimestamp(en)??start)-start);if(isToday&&nowMin>end+60){code='incomplete';label='Salida pendiente';tone='danger';attention=true}else if(lateMin>tol){code='late';label=`En jornada · tarde ${lateMin} min`;tone='warn'}else{code='working';label='En jornada';tone='ok'}}
 else if(workday){if(isToday&&nowMin<=start+tol){code='pending';label='Por entrar';tone='neutral'}else{code='absent';label='Falta / sin entrada';tone='danger';attention=true}}
 else if(hasAny){code='worked-rest';label='Trabajó en descanso';tone='info'}
 return {id,e,date,day,en,ls,lr,out,workday,holiday,free,just,code,label,tone,attention,lateMin,start,end,tol};
}
function nav(route){const b=$(`#plu-nav button[data-route="${route}"]`);if(b)b.click()}
function periodRange(kind){const now=new Date();let from=new Date(now),to=new Date(now);if(kind==='semana'){const day=from.getDay()||7;from.setDate(from.getDate()-day+1)}if(kind==='mes')from=new Date(now.getFullYear(),now.getMonth(),1);return [isoLocal(from),isoLocal(to)]}
function periodStats(kind){
 const [from,to]=periodRange(kind),engine=window.PoladentAttendance;if(!engine)return {from,to,expected:0,present:0,absent:0,late:0,complete:0,justified:0};
 let expected=0,present=0,absent=0,late=0,complete=0,justified=0;
 Object.entries(employees).filter(([,e])=>activeEmployee(e)).forEach(([id,e])=>{
   engine.datesBetween(from,to).forEach(date=>{if(isHoliday(date)||isFree(id,date)||!scheduled(e,date))return;const j=justification(id,date),d=marks?.[id]?.[date]||{},en=mark(d,'entrada'),out=mark(d,'salida');if(j&&!en){justified++;return}expected++;if(en){present++;const sch=schedule(e),lateMin=Math.max(0,(minutesOfTimestamp(en)??timeMinutes(sch.entrada))-timeMinutes(sch.entrada));if(lateMin>tolerance(e))late++;if(out)complete++}else if(date<today()||date===today()&&new Date().getHours()*60+new Date().getMinutes()>timeMinutes(schedule(e).entrada)+tolerance(e))absent++;});
 });
 return {from,to,expected,present,absent,late,complete,justified};
}
function pendingAlertCount(obj){return Object.values(obj||{}).filter(a=>a&&a.revisada!==true).length}
function auditTodayCount(){const t=today();return Object.values(payrollAudit||{}).filter(a=>a&&a.accion==='pago_reabierto'&&isoLocal(new Date(Number(a.fecha||0)))===t).length}
function ensure(){
 const host=$('#plu-dashboard');if(!host)return false;
 let root=$('#pcp13',host);if(root)return true;
 root=document.createElement('section');root.id='pcp13';root.className='pcp13';
 root.innerHTML=`
 <div class="pcp13-section-head"><div><small>SUPERVISIÓN DE HOY</small><h3>Estado del equipo</h3><p>Vista operativa en tiempo real. Este panel no modifica registros.</p></div><button id="pcp13Refresh" type="button">↻ Actualizar</button></div>
 <div id="pcp13Attention" class="pcp13-attention"></div>
 <div class="pcp13-layout"><div class="pcp13-card"><div class="pcp13-card-head"><div><h4>Funcionarios de hoy</h4><p>Foto, sede, horario y estado actual.</p></div><select id="pcp13Filter"><option value="all">Todos</option><option value="attention">Requiere atención</option><option value="working">Presentes</option><option value="absent">Faltas</option><option value="rest">Descanso / libre</option></select></div><div id="pcp13People" class="pcp13-people"></div></div>
 <div class="pcp13-card"><div class="pcp13-card-head"><div><h4>Resumen del período</h4><p>Asistencia acumulada sin alterar la nómina.</p></div><div class="pcp13-tabs"><button data-period="hoy">Hoy</button><button data-period="semana">Semana</button><button data-period="mes">Mes</button></div></div><div id="pcp13Period" class="pcp13-period"></div><div id="pcp13Alerts" class="pcp13-mini-alerts"></div></div></div>`;
 host.appendChild(root);
 $('#pcp13Refresh').onclick=render;
 $('#pcp13Filter').onchange=renderPeople;
 $$('.pcp13-tabs button',root).forEach(b=>b.onclick=()=>{period=b.dataset.period;renderPeriod()});
 return true;
}
function renderAttention(){
 const box=$('#pcp13Attention');if(!box)return;const t=today(),rows=Object.entries(employees).filter(([,e])=>activeEmployee(e)).map(([id,e])=>statusFor(id,e,t));
 const absent=rows.filter(r=>r.code==='absent').length,incomplete=rows.filter(r=>r.code==='incomplete').length,late=rows.filter(r=>r.lateMin>r.tol).length,noSchedule=Object.values(employees).filter(e=>activeEmployee(e)&&!explicitSchedule(e)).length,gps=pendingAlertCount(gpsAlerts),sec=pendingAlertCount(securityAlerts),reopened=auditTodayCount();
 const items=[];
 if(absent)items.push({icon:'🚫',title:`${absent} funcionario${absent===1?'':'s'} sin entrada`,text:'Día laborable y ya pasó la tolerancia.',route:'asistencia-marcaciones'});
 if(incomplete)items.push({icon:'⏳',title:`${incomplete} marcación${incomplete===1?'':'es'} incompleta${incomplete===1?'':'s'}`,text:'Revisa entrada/salida pendiente.',route:'asistencia-correcciones'});
 if(late)items.push({icon:'🕒',title:`${late} llegada${late===1?'':'s'} tarde`,text:'Según horario y tolerancia configurada.',route:'analisis'});
 if(gps)items.push({icon:'📍',title:`${gps} alerta${gps===1?'':'s'} GPS pendiente${gps===1?'':'s'}`,text:'Intentos fuera de geocerca o local.',route:'gps-alertas'});
 if(sec)items.push({icon:'🛡️',title:`${sec} alerta${sec===1?'':'s'} de seguridad`,text:'PIN, dispositivo o fotografía.',route:'seguridad'});
 if(reopened)items.push({icon:'💼',title:`${reopened} nómina${reopened===1?'':'s'} reabierta${reopened===1?'':'s'} hoy`,text:'Existe auditoría de reapertura.',route:'nomina'});
 if(noSchedule)items.push({icon:'⚙️',title:`${noSchedule} funcionario${noSchedule===1?'':'s'} con horario por defecto`,text:'Conviene revisar su horario individual.',route:'empleados-horarios'});
 box.innerHTML=`<div class="pcp13-att-head"><div><small>REQUIERE ATENCIÓN</small><h4>${items.length?`${items.length} punto${items.length===1?'':'s'} para revisar`:'Todo en orden'}</h4></div><span class="${items.length?'warn':'ok'}">${items.length?'Revisar':'✓ Sin pendientes críticos'}</span></div><div class="pcp13-att-grid">${items.length?items.map(i=>`<button data-route="${i.route}"><span>${i.icon}</span><b>${esc(i.title)}</b><small>${esc(i.text)}</small></button>`).join(''):'<div class="pcp13-allgood">No hay faltas vencidas, marcaciones incompletas ni alertas pendientes en este momento.</div>'}</div>`;
 $$('[data-route]',box).forEach(b=>b.onclick=()=>nav(b.dataset.route));
}
function renderPeople(){
 const box=$('#pcp13People');if(!box)return;const filter=$('#pcp13Filter')?.value||'all',t=today();let rows=Object.entries(employees).filter(([,e])=>activeEmployee(e)).map(([id,e])=>statusFor(id,e,t));
 if(filter==='attention')rows=rows.filter(r=>r.attention||r.lateMin>r.tol);if(filter==='working')rows=rows.filter(r=>['working','late','complete','complete-late','worked-rest'].includes(r.code));if(filter==='absent')rows=rows.filter(r=>r.code==='absent');if(filter==='rest')rows=rows.filter(r=>['rest','holiday','free','justified'].includes(r.code));
 const order={danger:0,warn:1,ok:2,info:3,neutral:4};rows.sort((a,b)=>(order[a.tone]??9)-(order[b.tone]??9)||String(a.e.nombre||'').localeCompare(String(b.e.nombre||'')));
 box.innerHTML=rows.length?rows.map(r=>{const p=employeePhoto(r.e),sch=schedule(r.e);return `<article class="pcp13-person"><div class="pcp13-avatar">${p?`<img src="${esc(p)}" alt="Foto de ${esc(r.e.nombre||'funcionario')}">`:'👤'}</div><div class="pcp13-person-main"><div><b>${esc(r.e.nombre||'Sin nombre')}</b><small>${esc(employeeBranch(r.e))}</small></div><span class="pcp13-badge ${r.tone}">${esc(r.label)}</span><div class="pcp13-times"><span>Horario ${esc(sch.entrada||'08:00')}–${esc(sch.salida||'17:00')}</span><span>Entrada ${esc(r.en?.hora||'—')}</span><span>Salida ${esc(r.out?.hora||'—')}</span></div></div></article>`}).join(''):'<div class="pcp13-empty">No hay funcionarios para este filtro.</div>';
}
function renderPeriod(){
 const box=$('#pcp13Period');if(!box)return;$$('.pcp13-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.period===period));const s=periodStats(period),attendance=s.expected?Math.round(s.present/s.expected*100):100,completion=s.present?Math.round(s.complete/s.present*100):100;
 box.innerHTML=`<div class="pcp13-period-range">${esc(s.from)} → ${esc(s.to)}</div><div class="pcp13-period-grid"><div><small>Jornadas esperadas</small><b>${s.expected}</b></div><div><small>Asistencias</small><b>${s.present}</b></div><div><small>Faltas</small><b>${s.absent}</b></div><div><small>Llegadas tarde</small><b>${s.late}</b></div><div><small>Completadas</small><b>${s.complete}</b></div><div><small>Justificadas</small><b>${s.justified}</b></div><div><small>Asistencia</small><b>${attendance}%</b></div><div><small>Jornada completa</small><b>${completion}%</b></div></div>`;
 const al=$('#pcp13Alerts');if(al){const gps=pendingAlertCount(gpsAlerts),sec=pendingAlertCount(securityAlerts);al.innerHTML=`<button data-route="gps-alertas"><span>📍</span><div><b>${gps} GPS pendientes</b><small>Ver intentos fuera de área</small></div></button><button data-route="seguridad"><span>🛡️</span><div><b>${sec} alertas de seguridad</b><small>PIN, cámara y dispositivos</small></div></button>`;$$('[data-route]',al).forEach(b=>b.onclick=()=>nav(b.dataset.route));}
}
function render(){if(!ensure())return;renderAttention();renderPeople();renderPeriod()}
function subscribe(){if(bound||!window.PoladentData)return false;bound=true;const handlers={empleados:s=>employees=s.val()||{},marcaciones:s=>marks=s.val()||{},feriados_global:s=>holidays=s.val()||{},dias_libres_empleado:s=>freeDays=s.val()||{},justificaciones_v44:s=>justifications=s.val()||{},alertas_gps:s=>gpsAlerts=s.val()||{},alertas_seguridad:s=>securityAlerts=s.val()||{},configuracion_gps_v51:s=>gpsConfig={sedes:{},...(s.val()||{})},configuracion_v44:s=>generalConfig={tolerancia:10,...(s.val()||{})},auditoria_nomina:s=>payrollAudit=s.val()||{}};Object.entries(handlers).forEach(([path,setter])=>window.PoladentData.subscribe(path,s=>{setter(s);if(window.PoladentPerformance?.schedule)window.PoladentPerformance.schedule('pcp13-'+path,render);else render()}));return true}
function boot(){if(!window.PoladentAttendance||!window.PoladentData||!$('#adminPanel'))return setTimeout(boot,250);ensure();subscribe();render();document.addEventListener('poladent:admin-ready',()=>setTimeout(render,120),{passive:true});document.addEventListener('poladent:route',e=>{if(e.detail?.route==='inicio')setTimeout(render,30)},{passive:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1500));else setTimeout(boot,1500);
})();
