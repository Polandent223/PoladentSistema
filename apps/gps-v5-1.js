/* Poladent v5.1 - Control GPS multisede
   Rutas nuevas: configuracion_gps_v51 y empleados/{id}/sedesPermitidas
   No altera empleados ni marcaciones existentes. */
(function(){
  'use strict';
  const DEFAULT={activo:false,radioDefault:80,precisionMaxima:120,sedes:{}};
  let config=JSON.parse(JSON.stringify(DEFAULT)), empleados={};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dbReady=()=>window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database;
  const db=()=>firebase.database();
  function status(t,ok=true){const e=$('#gps51Status');if(e){e.textContent=t;e.className='gps51-status '+(ok?'ok':'bad');}}
  function getPosition(){return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Este dispositivo no dispone de GPS.'));
    navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),e=>reject(new Error(e.code===1?'Permiso de ubicación rechazado. Actívalo en el navegador.':'No se pudo obtener la ubicación. Intenta cerca de una ventana.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });}
  function mount(){
    if($('#gps51Panel'))return;
    const host=$('#adminPanel')||document.body;
    const box=document.createElement('section'); box.id='gps51Panel'; box.className='card gps51-card';
    box.innerHTML=`<h3>📍 Control GPS multisede <span class="gps51-version">v5.1</span></h3>
      <p class="gps51-help">Configura tus dos locales y decide en cuáles puede marcar cada empleado. El sistema no bloqueará marcaciones hasta que actives el control GPS.</p>
      <div class="gps51-grid">
        <label class="gps51-switch"><input id="gps51Activo" type="checkbox"><span>GPS obligatorio</span></label>
        <label>Precisión máxima aceptada (m)<input id="gps51Precision" type="number" min="20" max="500" value="120"></label>
        <label>Radio predeterminado (m)<input id="gps51Radio" type="number" min="20" max="1000" value="80"></label>
      </div>
      <button id="gps51SaveConfig">💾 Guardar configuración general</button>
      <hr><h4>Agregar o editar local</h4>
      <input id="gps51Id" type="hidden">
      <div class="gps51-grid">
        <label>Nombre del local<input id="gps51Nombre" placeholder="Ej. Poladent Centro"></label>
        <label>Dirección<input id="gps51Direccion" placeholder="Dirección de referencia"></label>
        <label>Latitud<input id="gps51Lat" type="number" step="any" placeholder="10.000000"></label>
        <label>Longitud<input id="gps51Lon" type="number" step="any" placeholder="-68.000000"></label>
        <label>Radio permitido (m)<input id="gps51SedeRadio" type="number" min="20" max="1000" value="80"></label>
      </div>
      <div class="gps51-actions"><button id="gps51Current">📡 Usar ubicación actual</button><button id="gps51SaveSede">➕ Guardar local</button><button id="gps51Cancel" class="secondary">Limpiar</button></div>
      <div id="gps51Sedes" class="gps51-list"></div>
      <hr><h4>Asignar locales a empleados</h4>
      <div class="gps51-grid"><label>Empleado<select id="gps51Empleado"></select></label><div id="gps51Checks" class="gps51-checks"></div></div>
      <button id="gps51SaveEmp">💾 Guardar locales permitidos</button>
      <p class="gps51-help">Sin selección, el empleado podrá marcar en cualquier local activo. Puedes escoger uno o ambos.</p>
      <div id="gps51Status" class="gps51-status"></div>`;
    host.appendChild(box); bind(); render(); subscribe();
  }
  function bind(){
    $('#gps51SaveConfig').onclick=saveGeneral;
    $('#gps51Current').onclick=async()=>{try{status('Buscando ubicación actual…');const c=await getPosition();$('#gps51Lat').value=c.latitude.toFixed(7);$('#gps51Lon').value=c.longitude.toFixed(7);status(`Ubicación detectada con precisión aproximada de ${Math.round(c.accuracy)} m.`);}catch(e){status(e.message,false);}};
    $('#gps51SaveSede').onclick=saveSede; $('#gps51Cancel').onclick=clearForm; $('#gps51SaveEmp').onclick=saveEmpleado;
    $('#gps51Empleado').onchange=renderChecks;
  }
  async function saveGeneral(){
    config.activo=$('#gps51Activo').checked; config.precisionMaxima=Math.max(20,+$('#gps51Precision').value||120); config.radioDefault=Math.max(20,+$('#gps51Radio').value||80);
    try{await db().ref('configuracion_gps_v51').update({activo:config.activo,precisionMaxima:config.precisionMaxima,radioDefault:config.radioDefault,actualizado:Date.now()});status(config.activo?'GPS obligatorio activado.':'Configuración guardada; GPS obligatorio desactivado.');}catch(e){status('No se pudo guardar: '+e.message,false);}
  }
  async function saveSede(){
    const nombre=$('#gps51Nombre').value.trim(), direccion=$('#gps51Direccion').value.trim(), lat=Number($('#gps51Lat').value), lon=Number($('#gps51Lon').value), radio=Math.max(20,+$('#gps51SedeRadio').value||config.radioDefault||80);
    if(!nombre||!Number.isFinite(lat)||!Number.isFinite(lon))return status('Completa nombre, latitud y longitud.',false);
    const id=$('#gps51Id').value||db().ref('configuracion_gps_v51/sedes').push().key;
    try{await db().ref('configuracion_gps_v51/sedes/'+id).set({nombre,direccion,lat,lon,radio,activo:true,actualizado:Date.now()});clearForm();status('Local guardado correctamente.');}catch(e){status('No se pudo guardar el local: '+e.message,false);}
  }
  function clearForm(){['#gps51Id','#gps51Nombre','#gps51Direccion','#gps51Lat','#gps51Lon'].forEach(s=>$(s).value='');$('#gps51SedeRadio').value=config.radioDefault||80;}
  function editSede(id){const s=(config.sedes||{})[id];if(!s)return;$('#gps51Id').value=id;$('#gps51Nombre').value=s.nombre||'';$('#gps51Direccion').value=s.direccion||'';$('#gps51Lat').value=s.lat;$('#gps51Lon').value=s.lon;$('#gps51SedeRadio').value=s.radio||80;boxScroll();}
  function boxScroll(){document.getElementById('gps51Panel').scrollIntoView({behavior:'smooth',block:'start'});}
  async function toggleSede(id){const s=config.sedes[id];await db().ref('configuracion_gps_v51/sedes/'+id+'/activo').set(!(s.activo!==false));}
  async function removeSede(id){if(!confirm('¿Eliminar este local autorizado?'))return;await db().ref('configuracion_gps_v51/sedes/'+id).remove();}
  function renderSedes(){const box=$('#gps51Sedes');if(!box)return;const rows=Object.entries(config.sedes||{});box.innerHTML=rows.length?rows.map(([id,s])=>`<div class="gps51-sede ${s.activo===false?'off':''}"><div><b>${esc(s.nombre)}</b><small>${esc(s.direccion||'Sin dirección')} · Radio ${esc(s.radio||80)} m<br>${esc(s.lat)}, ${esc(s.lon)}</small></div><div><button data-edit="${id}">Editar</button><button data-toggle="${id}" class="secondary">${s.activo===false?'Activar':'Desactivar'}</button><button data-del="${id}" class="danger">Eliminar</button></div></div>`).join(''):'<p class="gps51-help">Todavía no hay locales configurados.</p>';
    box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editSede(b.dataset.edit));box.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggleSede(b.dataset.toggle));box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeSede(b.dataset.del));
  }
  function renderEmployees(){const s=$('#gps51Empleado');if(!s)return;const keep=s.value;s.innerHTML='<option value="">Selecciona empleado</option>'+Object.entries(empleados).sort((a,b)=>String(a[1].nombre||'').localeCompare(String(b[1].nombre||''),'es')).map(([id,e])=>`<option value="${id}">${esc(e.nombre||'Sin nombre')}</option>`).join('');if(keep&&empleados[keep])s.value=keep;renderChecks();}
  function renderChecks(){const id=$('#gps51Empleado').value,e=empleados[id]||{},allowed=e.sedesPermitidas||{};const rows=Object.entries(config.sedes||{}).filter(([,s])=>s.activo!==false);$('#gps51Checks').innerHTML=rows.length?rows.map(([sid,s])=>`<label><input type="checkbox" value="${sid}" ${allowed[sid]?'checked':''}> ${esc(s.nombre)}</label>`).join(''):'<span class="gps51-help">Agrega locales primero.</span>';}
  async function saveEmpleado(){const id=$('#gps51Empleado').value;if(!id)return status('Selecciona un empleado.',false);const out={};document.querySelectorAll('#gps51Checks input:checked').forEach(i=>out[i.value]=true);try{await db().ref('empleados/'+id+'/sedesPermitidas').set(Object.keys(out).length?out:null);status('Locales permitidos guardados para '+(empleados[id].nombre||'empleado')+'.');}catch(e){status('No se pudo guardar: '+e.message,false);}}
  function render(){if(!$('#gps51Panel'))return;$('#gps51Activo').checked=!!config.activo;$('#gps51Precision').value=config.precisionMaxima||120;$('#gps51Radio').value=config.radioDefault||80;renderSedes();renderEmployees();}
  function subscribe(){if(!dbReady())return setTimeout(subscribe,300);db().ref('configuracion_gps_v51').on('value',s=>{config={...DEFAULT,...(s.val()||{}),sedes:(s.val()||{}).sedes||{}};render();});db().ref('empleados').on('value',s=>{empleados=s.val()||{};renderEmployees();});}
  function boot(){if(!dbReady())return setTimeout(boot,250);mount();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
