/* POLADENT v5.3 - Asignación obligatoria y alertas GPS */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dbReady=()=>window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database;
  const db=()=>firebase.database();
  let empleados={}, sedes={};

  function mount(){
    if($('#gps53Alerts')) return;
    const gps=$('#gps52Panel');
    if(gps){
      const note=document.createElement('div');
      note.className='gps53-note';
      note.innerHTML='<b>Asignación obligatoria:</b> si guardas un empleado sin marcar ningún local, quedará bloqueado hasta que le asignes una tienda oficial.';
      const help=gps.querySelector('#gps52SaveEmp + .gps52-help');
      if(help){ help.textContent='Debes seleccionar al menos un local. Sin selección, el empleado no podrá marcar.'; help.after(note); }
    }
    const host=$('#pd42-reportes')||$('#adminPanel')||document.body;
    const box=document.createElement('section');
    box.id='gps53Alerts'; box.className='card gps53-card';
    box.innerHTML=`<div class="gps53-head"><div><h3>🚨 Alertas de intentos GPS</h3><p>Intentos de marcación fuera del área, sin tienda asignada o con ubicación no válida.</p></div><button id="gps53Clear" class="danger">Limpiar alertas</button></div><div id="gps53List"><p class="gps52-help">Cargando alertas…</p></div>`;
    host.appendChild(box);
    $('#gps53Clear').onclick=async()=>{if(confirm('¿Borrar todas las alertas GPS registradas?')) await db().ref('alertas_gps').remove();};
  }

  function patchSave(){
    const btn=$('#gps52SaveEmp');
    if(!btn || btn.dataset.v53==='1') return;
    btn.dataset.v53='1';
    btn.onclick=async()=>{
      const id=$('#gps52Empleado')?.value;
      const status=(t,ok=true)=>{const e=$('#gps52Status');if(e){e.textContent=t;e.className='gps52-status '+(ok?'ok':'bad');}};
      if(!id) return status('Selecciona un empleado.',false);
      const out={}; document.querySelectorAll('#gps52Checks input:checked').forEach(i=>out[i.value]=true);
      try{
        await db().ref('empleados/'+id).update({
          sedesPermitidas:Object.keys(out).length?out:null,
          asignacionSedesActiva:true,
          asignacionSedesActualizada:Date.now()
        });
        status(Object.keys(out).length
          ?`Locales oficiales guardados para ${empleados[id]?.nombre||'el empleado'}.`
          :`${empleados[id]?.nombre||'El empleado'} quedó sin tienda asignada y no podrá marcar.`,
          Object.keys(out).length>0);
      }catch(e){status('No se pudo guardar: '+e.message,false);}
    };
  }

  function renderAlerts(data){
    const box=$('#gps53List'); if(!box)return;
    const rows=Object.entries(data||{}).sort((a,b)=>(b[1]?.timestamp||0)-(a[1]?.timestamp||0)).slice(0,100);
    box.innerHTML=rows.length?rows.map(([id,a])=>{
      const date=a.timestamp?new Date(a.timestamp).toLocaleString('es-VE'):'Sin fecha';
      const dist=Number.isFinite(Number(a.distancia))?` · ${Math.round(a.distancia)} m`:'';
      return `<div class="gps53-alert"><div><b>${esc(a.empleado||'Empleado desconocido')}</b><span>${esc(a.motivo||'Intento bloqueado')}</span><small>${esc(date)}${esc(dist)}${a.sedeCercana?' · '+esc(a.sedeCercana):''}</small></div><button data-del-alert="${id}" title="Eliminar">✕</button></div>`;
    }).join(''):'<p class="gps52-help">No hay intentos GPS bloqueados.</p>';
    box.querySelectorAll('[data-del-alert]').forEach(b=>b.onclick=()=>db().ref('alertas_gps/'+b.dataset.delAlert).remove());
  }

  function subscribe(){
    db().ref('empleados').on('value',s=>{empleados=s.val()||{};setTimeout(patchSave,50);});
    db().ref('configuracion_gps_v51/sedes').on('value',s=>{sedes=s.val()||{};});
    db().ref('alertas_gps').on('value',s=>renderAlerts(s.val()||{}));
  }
  function boot(){if(!dbReady())return setTimeout(boot,250);mount();patchSave();subscribe();new MutationObserver(()=>{mount();patchSave();}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
