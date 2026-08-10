(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const TYPES=[
  ['entrada','Entrada'],
  ['almuerzo_salida','Salida al almuerzo'],
  ['almuerzo_regreso','Regreso del almuerzo'],
  ['salida','Salida final']
];
let empleados={};
let mounted=false;
let subscribed=false;
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function localDate(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function tsFor(date,time){if(!date||!time)return null;const d=new Date(`${date}T${time}:00`);return Number.isFinite(d.getTime())?d.getTime():null;}
function timeFrom(item){if(!item)return '';if(item.hora&&/^\d{1,2}:\d{2}/.test(item.hora)){const [h,m]=item.hora.split(':');return `${String(h).padStart(2,'0')}:${m}`;}if(item.timestamp){const d=new Date(Number(item.timestamp));return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}return '';}
function notice(text,ok=true){const n=$('#cmNotice');if(!n)return;n.textContent=text;n.className='cm-notice '+(ok?'ok':'error');n.hidden=false;}
function clearNotice(){const n=$('#cmNotice');if(n)n.hidden=true;}
function panel(){
 let p=$('#correccionMarcacionesPanel');
 if(p)return p;
 p=document.createElement('section');p.id='correccionMarcacionesPanel';p.className='cm-panel';
 p.innerHTML=`
 <div class="cm-head"><div><h3>✏️ Corrección manual de marcaciones</h3><p>Corrige una entrada olvidada o cualquier marcación de una fecha anterior. El horario laboral habitual no cambia.</p></div><span class="cm-audit">Con auditoría</span></div>
 <div class="cm-filters">
   <label>Empleado<select id="cmEmpleado"><option value="">Selecciona un empleado</option></select></label>
   <label>Fecha<input id="cmFecha" type="date"></label>
   <div class="cm-date-actions"><button type="button" id="cmAyer">Ayer</button><button type="button" id="cmHoy">Hoy</button><button type="button" id="cmCargar">Cargar día</button></div>
 </div>
 <div id="cmEmployeeInfo" class="cm-employee-info">Selecciona empleado y fecha para consultar sus marcaciones.</div>
 <div class="cm-times">
   ${TYPES.map(([id,label])=>`<label><span>${label}</span><input id="cm_${id}" type="time"><small id="cmStatus_${id}">Sin cargar</small></label>`).join('')}
 </div>
 <div class="cm-help"><b>Cómo usarlo:</b> coloca la hora correcta. Si quieres eliminar una marcación equivocada, deja ese campo vacío y guarda.</div>
 <label class="cm-reason">Motivo de la corrección<textarea id="cmMotivo" rows="2" placeholder="Ejemplo: El empleado olvidó marcar la entrada"></textarea></label>
 <div class="cm-actions"><button type="button" id="cmGuardar">💾 Guardar correcciones</button><button type="button" id="cmLimpiar" class="secondary">Limpiar</button></div>
 <div id="cmNotice" class="cm-notice" hidden></div>
 <div id="cmCurrent" class="cm-current"></div><div id="cmAudit" class="cm-audit-list"></div>`;
 const style=document.createElement('style');style.textContent=`
 .cm-panel{background:#fff;border:1px solid rgba(20,54,100,.12);border-radius:18px;padding:20px;margin-bottom:18px;box-shadow:0 10px 28px rgba(15,43,78,.07)}
 .cm-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start}.cm-head h3{margin:0 0 5px;color:#133f78}.cm-head p{margin:0;color:#64748b}.cm-audit{background:#e8f3ff;color:#155ca2;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:700}
 .cm-filters{display:grid;grid-template-columns:minmax(220px,1fr) minmax(160px,.6fr) auto;gap:12px;align-items:end;margin-top:18px}.cm-filters label,.cm-times label,.cm-reason{display:flex;flex-direction:column;gap:6px;font-weight:700;color:#334155}.cm-filters select,.cm-filters input,.cm-times input,.cm-reason textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px;background:#fff;font:inherit}.cm-date-actions,.cm-actions{display:flex;gap:8px;flex-wrap:wrap}.cm-date-actions button,.cm-actions button{border:0;border-radius:10px;padding:11px 14px;background:#1769aa;color:#fff;font-weight:700;cursor:pointer}.cm-date-actions button:not(:last-child),.cm-actions .secondary{background:#e8eef5;color:#274766}.cm-employee-info{margin:14px 0;padding:12px;border-radius:10px;background:#f6f9fc;color:#48627b}.cm-times{display:grid;grid-template-columns:repeat(4,minmax(145px,1fr));gap:12px}.cm-times small{font-weight:500;color:#64748b}.cm-help{margin:14px 0;padding:11px 13px;border-left:4px solid #f0ad32;background:#fff8e7;border-radius:8px;color:#6f5521}.cm-reason textarea{resize:vertical}.cm-actions{margin-top:14px}.cm-notice{margin-top:14px;padding:12px;border-radius:10px;font-weight:700}.cm-notice.ok{background:#e9f8ef;color:#17683a}.cm-notice.error{background:#fff0f0;color:#a42929}.cm-current{margin-top:14px}.cm-current table{width:100%;border-collapse:collapse}.cm-current th,.cm-current td{text-align:left;padding:9px;border-bottom:1px solid #e5e7eb}.cm-audit-list{margin-top:16px}.cm-audit-list h4{margin:0 0 8px;color:#133f78}.cm-audit-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb}.cm-audit-row span,.cm-audit-empty{color:#64748b;font-size:13px}
 @media(max-width:850px){.cm-filters{grid-template-columns:1fr}.cm-times{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.cm-times{grid-template-columns:1fr}.cm-head{flex-direction:column}}
 `;document.head.appendChild(style);
 return p;
}
function fillEmployees(){const s=$('#cmEmpleado');if(!s)return;const current=s.value;s.innerHTML='<option value="">Selecciona un empleado</option>'+Object.entries(empleados).sort((a,b)=>String(a[1]?.nombre||'').localeCompare(String(b[1]?.nombre||''),'es')).map(([id,e])=>`<option value="${esc(id)}">${esc(e?.nombre||id)}</option>`).join('');if(empleados[current])s.value=current;}
function resetFields(){TYPES.forEach(([id])=>{$(`#cm_${id}`).value='';$(`#cmStatus_${id}`).textContent='Sin marcación';});$('#cmCurrent').innerHTML='';clearNotice();}
async function loadDay(){clearNotice();const empId=$('#cmEmpleado').value,date=$('#cmFecha').value;if(!empId||!date)return notice('Selecciona un empleado y una fecha.',false);try{const snap=await firebase.database().ref(`marcaciones/${empId}/${date}`).once('value'),day=snap.val()||{},emp=empleados[empId]||{};$('#cmEmployeeInfo').innerHTML=`<b>${esc(emp.nombre||'Empleado')}</b> · ${esc(date)}`;TYPES.forEach(([id])=>{const value=timeFrom(day[id]);$(`#cm_${id}`).value=value;$(`#cmStatus_${id}`).textContent=value?(day[id]?.editado?'Editada anteriormente':'Marcación registrada'):'Sin marcación';});$('#cmCurrent').innerHTML=`<table><thead><tr><th>Marcación</th><th>Hora actual</th><th>Estado</th></tr></thead><tbody>${TYPES.map(([id,label])=>`<tr><td>${label}</td><td>${timeFrom(day[id])||'—'}</td><td>${day[id]?(day[id].editado?'Corregida':'Original'):'No registrada'}</td></tr>`).join('')}</tbody></table>`;notice('Día cargado. Puedes modificar las horas y guardar.');loadAudit();}catch(e){console.error(e);notice('No se pudo cargar el día: '+(e.message||e),false);}}
async function save(){clearNotice();const empId=$('#cmEmpleado').value,date=$('#cmFecha').value,motivo=$('#cmMotivo').value.trim(),emp=empleados[empId];if(!empId||!emp||!date)return notice('Selecciona un empleado y una fecha.',false);if(!motivo)return notice('Escribe el motivo de la corrección.',false);
 try{
  const base=firebase.database().ref(`marcaciones/${empId}/${date}`),before=(await base.once('value')).val()||{},desired={},changed={};
  for(const [type] of TYPES){const time=$(`#cm_${type}`).value.trim(),old=before[type]||null;if(time){const timestamp=tsFor(date,time);if(!timestamp)throw new Error(`Hora inválida en ${type}.`);desired[type]={...(old||{}),nombre:emp.nombre||'Empleado',tipo:type,fecha:date,hora:time,timestamp};}else desired[type]=null;
   const oldTime=timeFrom(old),newTime=timeFrom(desired[type]);if(oldTime!==newTime)changed[type]={antes:old||null,despues:desired[type]||null};
  }
  if(!Object.keys(changed).length)return notice('No hay cambios para guardar.',false);
  const ordered=TYPES.map(([t])=>desired[t]?.timestamp||null).filter(Boolean);for(let i=1;i<ordered.length;i++){if(ordered[i]<=ordered[i-1])return notice('Revisa el orden de las horas: entrada, almuerzo, regreso y salida.',false);}
  const stamp=Date.now(),authUser=firebase.auth?.().currentUser||null,editor=authUser?.email||authUser?.uid||'admin',updates={};
  for(const [type,delta] of Object.entries(changed)){
    if(delta.despues){updates[`marcaciones/${empId}/${date}/${type}`]={...delta.despues,editado:true,editadoEn:stamp,editadoPor:editor,motivoEdicion:motivo,origenEdicion:'correccion_marcaciones'};}
    else updates[`marcaciones/${empId}/${date}/${type}`]=null;
  }
  updates[`auditoria_ediciones/${empId}/${date}/correccion_${stamp}`]={empleado:emp.nombre||'Empleado',empleadoId:empId,fecha:date,motivo,cambios:changed,accion:Object.values(changed).some(x=>x.despues===null)?'corregir_o_anular':'corregir',editadoEn:stamp,editadoPor:editor,origen:'correccion_marcaciones'};
  // Operación atómica: las correcciones y su auditoría se guardan juntas.
  await firebase.database().ref().update(updates);
  notice('Marcaciones corregidas correctamente. El valor anterior quedó guardado en Auditoría.');document.dispatchEvent(new CustomEvent('poladent:marcaciones-actualizadas'));setTimeout(loadDay,180);loadAudit();
 }catch(e){console.error(e);notice('No se pudo guardar: '+(e.message||e),false);}}
async function loadAudit(){const host=$('#cmAudit');if(!host)return;const empId=$('#cmEmpleado')?.value,date=$('#cmFecha')?.value;if(!empId||!date){host.innerHTML='';return;}try{const snap=await firebase.database().ref(`auditoria_ediciones/${empId}/${date}`).once('value'),raw=snap.val()||{},rows=[];const walk=(obj,path=[])=>{Object.entries(obj||{}).forEach(([k,v])=>{if(v&&typeof v==='object'&&(v.editadoEn||v.accion||v.motivo)){rows.push({...v,_path:[...path,k].join('/')});}else if(v&&typeof v==='object')walk(v,[...path,k]);});};walk(raw);rows.sort((a,b)=>(b.editadoEn||0)-(a.editadoEn||0));host.innerHTML=rows.length?`<h4>Historial de correcciones del día</h4>${rows.map(r=>`<div class="cm-audit-row"><b>${esc(r.motivo||r.accion||'Corrección')}</b><span>${r.editadoEn?new Date(r.editadoEn).toLocaleString('es-VE'):'—'} · ${esc(r.editadoPor||'admin')}</span></div>`).join('')}`:'<div class="cm-audit-empty">No hay correcciones registradas para este día.</div>';}catch(e){host.innerHTML='<div class="cm-audit-empty">No se pudo cargar la auditoría.</div>';}}

function bind(){if(mounted)return;mounted=true;$('#cmFecha').value=localDate();$('#cmCargar').onclick=loadDay;$('#cmGuardar').onclick=save;$('#cmLimpiar').onclick=()=>{resetFields();$('#cmMotivo').value='';};$('#cmHoy').onclick=()=>{$('#cmFecha').value=localDate();loadDay();};$('#cmAyer').onclick=()=>{const d=new Date();d.setDate(d.getDate()-1);$('#cmFecha').value=localDate(d);loadDay();};$('#cmEmpleado').onchange=()=>{if($('#cmFecha').value)loadDay();};$('#cmFecha').onchange=()=>{if($('#cmEmpleado').value)loadDay();};}
function mount(){
 const host=document.querySelector('#plu-view-asistencia-correcciones .plu-view-body');
 if(!host)return false;
 const p=panel();
 if(!host.contains(p))host.prepend(p);
 bind();
 if(!subscribed){
   subscribed=true;
   if(window.PoladentData?.subscribe){
     window.PoladentData.subscribe('empleados',s=>{empleados=s.val()||{};fillEmployees();});
   }else if(window.firebase?.apps?.length){
     firebase.database().ref('empleados').on('value',s=>{empleados=s.val()||{};fillEmployees();});
   }
 }
 return true;
}
function start(attempt=0){
 if(!window.firebase?.apps?.length||!document.querySelector('#adminPanel')||!document.querySelector('#plu-shell')){
   if(attempt<40)setTimeout(()=>start(attempt+1),250);
   return;
 }
 if(!mount()&&attempt<40)setTimeout(()=>start(attempt+1),250);
}
async function openCorrection(empId,date){const nav=document.querySelector('#plu-nav button[data-route="asistencia-correcciones"]');if(nav)nav.click();mount();setTimeout(()=>{if(empId&&empleados[empId])$('#cmEmpleado').value=empId;if(date)$('#cmFecha').value=date;if(empId&&date)loadDay();},80);}
window.PoladentCorreccionMarcaciones={mount,loadDay,open:openCorrection};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1600));else setTimeout(start,1600);
document.addEventListener('poladent:route',e=>{if(e.detail?.route==='asistencia-correcciones')setTimeout(mount,50);});
})();
