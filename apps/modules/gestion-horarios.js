/* POLADENT - Gestión de horarios por empleado (Parte 2) */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const dias=[['lunes','Lunes'],['martes','Martes'],['miercoles','Miércoles'],['jueves','Jueves'],['viernes','Viernes'],['sabado','Sábado'],['domingo','Domingo']];
let empleados={}, ref=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensureHost(){
 let view=$('#plu-view-empleados-horarios');
 if(!view && $('#plu-content')){
   view=document.createElement('section'); view.id='plu-view-empleados-horarios'; view.className='plu-view'; view.dataset.route='empleados-horarios';
   view.innerHTML='<header class="plu-view-head"><div><small>Panel administrador</small><h2>Editar horarios</h2></div></header><div class="plu-view-body"></div>';
   $('#plu-content').appendChild(view);
 }
 return view?.querySelector('.plu-view-body')||null;
}
function notice(text,ok=true){const n=$('#ghStatus');if(!n)return;n.textContent=text;n.className='notice '+(ok?'ok':'error');n.style.display='block';clearTimeout(notice.t);notice.t=setTimeout(()=>n.style.display='none',5000)}
function mount(){
 const host=ensureHost(); if(!host)return false;
 let panel=$('#ghPanel');
 if(!panel){
   host.innerHTML='';
   panel=document.createElement('section'); panel.id='ghPanel'; panel.className='card pd44-panel gh-panel';
   panel.innerHTML=`<div class="pd44-head"><div><h3>🕒 Horario laboral por empleado</h3><p>Configura entrada, almuerzo, regreso y salida final. No modifica marcaciones anteriores.</p></div></div>
   <div class="pd44-grid two"><div class="pd44-field"><label>Empleado</label><select id="ghEmpleado"><option value="">Cargando empleados…</option></select></div><div class="pd44-field"><label>Nombre</label><input id="ghNombre" disabled></div></div>
   <div class="gh-times"><label>Hora de entrada<input id="ghEntrada" type="time" value="08:00"></label><label>Salida al almuerzo<input id="ghAlmuerzoSalida" type="time" value="12:00"></label><label>Regreso del almuerzo<input id="ghAlmuerzoRegreso" type="time" value="13:00"></label><label>Salida final<input id="ghSalida" type="time" value="17:00"></label></div>
   <h4>Días laborables</h4><div id="ghDias" class="gh-days">${dias.map(([id,n])=>`<label><input type="checkbox" value="${id}" ${id!=='domingo'?'checked':''}> ${n}</label>`).join('')}</div>
   <div class="pd44-actions"><button id="ghGuardar" type="button">💾 Guardar horario</button><button id="ghEliminar" type="button" class="danger">↩ Restablecer horario general</button></div>
   <div id="ghStatus" class="notice" style="display:none"></div><div id="ghResumen" class="gh-summary"></div>`;
   host.appendChild(panel);
   $('#ghEmpleado').addEventListener('change',loadSelected);
   $('#ghGuardar').addEventListener('click',save);
   $('#ghEliminar').addEventListener('click',remove);
 }
 renderEmployees(); return true;
}
function renderEmployees(){
 const s=$('#ghEmpleado'); if(!s)return;
 const keep=s.value; const rows=Object.entries(empleados).sort((a,b)=>String(a[1]?.nombre||'').localeCompare(String(b[1]?.nombre||''),'es'));
 s.innerHTML='<option value="">Selecciona un empleado</option>'+rows.map(([id,e])=>`<option value="${esc(id)}">${esc(e?.nombre||'Sin nombre')}</option>`).join('');
 if(keep&&empleados[keep])s.value=keep;
 if(!rows.length)s.innerHTML='<option value="">No hay empleados registrados</option>';
 loadSelected();
}
function loadSelected(){
 const id=$('#ghEmpleado')?.value,e=empleados[id],h=e?.horario||{};
 if($('#ghNombre'))$('#ghNombre').value=e?.nombre||'';
 if($('#ghEntrada'))$('#ghEntrada').value=h.entrada||e?.horaEntrada||'08:00';
 if($('#ghAlmuerzoSalida'))$('#ghAlmuerzoSalida').value=h.almuerzoSalida||e?.horaAlmuerzoSalida||'12:00';
 if($('#ghAlmuerzoRegreso'))$('#ghAlmuerzoRegreso').value=h.almuerzoRegreso||e?.horaAlmuerzoRegreso||'13:00';
 if($('#ghSalida'))$('#ghSalida').value=h.salida||e?.horaSalida||'17:00';
 const work=h.diasLaborales||e?.diasLaborales||{lunes:true,martes:true,miercoles:true,jueves:true,viernes:true,sabado:true};
 $$('#ghDias input').forEach(c=>c.checked=Array.isArray(work)?work.includes(c.value):!!work[c.value]);
 const r=$('#ghResumen'); if(r)r.innerHTML=e?`<b>Horario actual de ${esc(e.nombre||'empleado')}:</b><br>Entrada ${esc(h.entrada||e.horaEntrada||'08:00')} · Almuerzo ${esc(h.almuerzoSalida||e.horaAlmuerzoSalida||'12:00')}–${esc(h.almuerzoRegreso||e.horaAlmuerzoRegreso||'13:00')} · Salida ${esc(h.salida||e.horaSalida||'17:00')}`:'<p>Selecciona un empleado para editar su horario.</p>';
}
async function save(){
 const id=$('#ghEmpleado')?.value;if(!id||!empleados[id])return notice('Selecciona un empleado.',false);
 const selected={};$$('#ghDias input:checked').forEach(x=>selected[x.value]=true);if(!Object.keys(selected).length)return notice('Selecciona al menos un día laborable.',false);
 const horario={entrada:$('#ghEntrada').value,almuerzoSalida:$('#ghAlmuerzoSalida').value,almuerzoRegreso:$('#ghAlmuerzoRegreso').value,salida:$('#ghSalida').value,diasLaborales:selected,actualizado:Date.now()};
 if(Object.values(horario).slice(0,4).some(v=>!v))return notice('Completa las cuatro horas.',false);
 if(horario.entrada>=horario.almuerzoSalida||horario.almuerzoSalida>=horario.almuerzoRegreso||horario.almuerzoRegreso>=horario.salida)return notice('Revisa el orden de las horas.',false);
 try{await firebase.database().ref('empleados/'+id).update({horario,horaEntrada:horario.entrada,horaAlmuerzoSalida:horario.almuerzoSalida,horaAlmuerzoRegreso:horario.almuerzoRegreso,horaSalida:horario.salida,diasLaborales:selected});notice('Horario guardado correctamente.');}
 catch(e){notice('No se pudo guardar: '+(e.message||e),false)}
}
async function remove(){
 const id=$('#ghEmpleado')?.value;if(!id)return notice('Selecciona un empleado.',false);if(!confirm('¿Restablecer el horario general para este empleado?'))return;
 try{await firebase.database().ref('empleados/'+id).update({horario:null,horaEntrada:null,horaAlmuerzoSalida:null,horaAlmuerzoRegreso:null,horaSalida:null,diasLaborales:null});notice('Horario personalizado eliminado.');}
 catch(e){notice('No se pudo restablecer: '+(e.message||e),false)}
}
function subscribe(){
 if(!(window.firebase&&firebase.apps?.length&&firebase.database))return setTimeout(subscribe,300);
 if(ref)return; ref=firebase.database().ref('empleados');
 ref.on('value',s=>{empleados=s.val()||{};mount();renderEmployees();},e=>notice('No se pudieron cargar empleados: '+(e.message||e),false));
}
function open(id){mount();document.querySelector('#plu-nav button[data-route="empleados-horarios"]')?.click();setTimeout(()=>{if(id&&empleados[id]){$('#ghEmpleado').value=id;loadSelected()}},100)}
function boot(){mount();subscribe();}
window.PoladentHorario={mount,open,renderEmployees}; window.openEditModal=open;
document.addEventListener('poladent:route',e=>{if(e.detail?.route==='empleados-horarios')mount();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));else setTimeout(boot,600);
})();
