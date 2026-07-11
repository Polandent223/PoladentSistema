/* Poladent v5.2 - GPS multisede administrable
   Mantiene la ruta configuracion_gps_v51 para conservar compatibilidad y datos existentes. */
(function(){
  'use strict';
  const DEFAULT={activo:false,radioDefault:80,precisionMaxima:120,sedes:{}};
  let config=JSON.parse(JSON.stringify(DEFAULT)), empleados={};
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dbReady=()=>window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database;
  const db=()=>firebase.database();
  function status(t,ok=true){const e=$('#gps52Status');if(e){e.textContent=t;e.className='gps52-status '+(ok?'ok':'bad');}}
  function getPosition(){return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('Este dispositivo no dispone de GPS.'));
    navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),e=>reject(new Error(e.code===1?'Permiso de ubicación rechazado. Actívalo en el navegador.':'No se pudo obtener la ubicación. Intenta cerca de una ventana.')),{enableHighAccuracy:true,timeout:25000,maximumAge:0});
  });}
  function distance(a,b,c,d){const R=6371000,r=x=>x*Math.PI/180,dp=r(c-a),dl=r(d-b),q=Math.sin(dp/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function mount(){
    if($('#gps52Panel'))return;
    const host=$('#adminPanel')||document.body;
    const box=document.createElement('section');box.id='gps52Panel';box.className='card gps52-card';
    box.innerHTML=`<h3>📍 Control GPS multisede <span class="gps52-version">v5.2</span></h3>
      <p class="gps52-help">Puedes editar los locales, coordenadas y metros permitidos todas las veces que necesites. Los cambios se aplican inmediatamente.</p>
      <div class="gps52-grid">
        <label class="gps52-switch"><input id="gps52Activo" type="checkbox"><span>GPS obligatorio</span></label>
        <label>Precisión máxima aceptada (m)<input id="gps52Precision" type="number" min="10" max="1000" value="120"></label>
        <label>Radio predeterminado (m)<input id="gps52Radio" type="number" min="5" max="5000" value="80"></label>
      </div>
      <button id="gps52SaveConfig">💾 Guardar configuración general</button>
      <hr><h4>Agregar o editar local</h4>
      <input id="gps52Id" type="hidden">
      <div class="gps52-grid">
        <label>Nombre del local<input id="gps52Nombre" placeholder="Ej. Poladent Centro"></label>
        <label>Dirección<input id="gps52Direccion" placeholder="Dirección de referencia"></label>
        <label>Latitud<input id="gps52Lat" type="number" step="any" placeholder="10.0000000"></label>
        <label>Longitud<input id="gps52Lon" type="number" step="any" placeholder="-68.0000000"></label>
        <label>Distancia permitida (metros)
          <input id="gps52SedeRadio" type="number" min="5" max="5000" value="80">
          <small>Puedes escribir 20, 50, 100, 250 o cualquier valor.</small>
        </label>
        <label class="gps52-switch"><input id="gps52SedeActiva" type="checkbox" checked><span>Local activo</span></label>
      </div>
      <div class="gps52-presets"><span>Metraje rápido:</span><button data-radio="30">30 m</button><button data-radio="50">50 m</button><button data-radio="80">80 m</button><button data-radio="100">100 m</button><button data-radio="150">150 m</button></div>
      <div class="gps52-actions"><button id="gps52Current">📡 Capturar ubicación del local</button><button id="gps52Test" class="secondary">🧭 Probar ubicación actual</button><button id="gps52SaveSede">💾 Guardar local</button><button id="gps52Cancel" class="secondary">Limpiar</button></div>
      <div id="gps52CaptureInfo" class="gps52-capture"></div>
      <div id="gps52Sedes" class="gps52-list"></div>
      <hr><h4>Asignar locales a empleados</h4>
      <div class="gps52-grid"><label>Empleado<select id="gps52Empleado"></select></label><div id="gps52Checks" class="gps52-checks"></div></div>
      <button id="gps52SaveEmp">💾 Guardar locales permitidos</button>
      <p class="gps52-help">Sin selección, el empleado podrá marcar en cualquier local activo. Puedes escoger uno, varios o todos.</p>
      <div id="gps52Status" class="gps52-status"></div>`;
    host.appendChild(box);bind();render();subscribe();
  }
  function bind(){
    $('#gps52SaveConfig').onclick=saveGeneral;
    $('#gps52Current').onclick=captureCurrent;
    $('#gps52Test').onclick=testCurrent;
    $('#gps52SaveSede').onclick=saveSede;
    $('#gps52Cancel').onclick=clearForm;
    $('#gps52SaveEmp').onclick=saveEmpleado;
    $('#gps52Empleado').onchange=renderChecks;
    document.querySelectorAll('[data-radio]').forEach(b=>b.onclick=()=>{$('#gps52SedeRadio').value=b.dataset.radio;status(`Distancia preparada en ${b.dataset.radio} metros. Presiona Guardar local.`);});
  }
  async function captureCurrent(){
    try{status('Buscando la ubicación exacta del local…');const c=await getPosition();$('#gps52Lat').value=c.latitude.toFixed(7);$('#gps52Lon').value=c.longitude.toFixed(7);$('#gps52CaptureInfo').innerHTML=`✅ Coordenadas capturadas<br><b>Precisión aproximada:</b> ${Math.round(c.accuracy)} m`;status('Ubicación capturada. Ahora revisa el metraje y guarda el local.');}catch(e){status(e.message,false);}
  }
  async function testCurrent(){
    const lat=Number($('#gps52Lat').value),lon=Number($('#gps52Lon').value),radio=Math.max(5,+$('#gps52SedeRadio').value||80);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return status('Primero captura o escribe las coordenadas del local.',false);
    try{status('Comprobando tu ubicación…');const c=await getPosition(),d=distance(c.latitude,c.longitude,lat,lon),inside=d<=radio;$('#gps52CaptureInfo').innerHTML=`📍 Estás aproximadamente a <b>${Math.round(d)} m</b> del punto guardado.<br>Radio configurado: <b>${radio} m</b> · Precisión GPS: <b>${Math.round(c.accuracy)} m</b>`;status(inside?'Prueba correcta: este teléfono está dentro del área autorizada.':`Fuera del área: estás a ${Math.round(d)} m y el límite es ${radio} m.`,inside);}catch(e){status(e.message,false);}
  }
  async function saveGeneral(){
    const wasActive=!!config.activo,newActive=$('#gps52Activo').checked;
    if(newActive&&!wasActive&&!Object.values(config.sedes||{}).some(s=>s&&s.activo!==false)){ $('#gps52Activo').checked=false; return status('Agrega y prueba al menos un local antes de activar el GPS obligatorio.',false); }
    config.activo=newActive;config.precisionMaxima=Math.max(10,+$('#gps52Precision').value||120);config.radioDefault=Math.max(5,+$('#gps52Radio').value||80);
    try{await db().ref('configuracion_gps_v51').update({activo:config.activo,precisionMaxima:config.precisionMaxima,radioDefault:config.radioDefault,actualizado:Date.now(),version:'5.2'});status(config.activo?'GPS obligatorio activado.':'Configuración guardada; GPS obligatorio desactivado.');}catch(e){status('No se pudo guardar: '+e.message,false);}
  }
  async function saveSede(){
    const nombre=$('#gps52Nombre').value.trim(),direccion=$('#gps52Direccion').value.trim(),lat=Number($('#gps52Lat').value),lon=Number($('#gps52Lon').value),radio=Math.max(5,+$('#gps52SedeRadio').value||config.radioDefault||80),activo=$('#gps52SedeActiva').checked;
    if(!nombre||!Number.isFinite(lat)||!Number.isFinite(lon))return status('Completa nombre, latitud y longitud.',false);
    const id=$('#gps52Id').value||db().ref('configuracion_gps_v51/sedes').push().key;
    try{await db().ref('configuracion_gps_v51/sedes/'+id).set({nombre,direccion,lat,lon,radio,activo,actualizado:Date.now()});clearForm();status(`Local guardado con un radio de ${radio} metros.`);}catch(e){status('No se pudo guardar el local: '+e.message,false);}
  }
  function clearForm(){['#gps52Id','#gps52Nombre','#gps52Direccion','#gps52Lat','#gps52Lon'].forEach(s=>$(s).value='');$('#gps52SedeRadio').value=config.radioDefault||80;$('#gps52SedeActiva').checked=true;$('#gps52CaptureInfo').innerHTML='';$('#gps52SaveSede').textContent='💾 Guardar local';}
  function editSede(id){const s=(config.sedes||{})[id];if(!s)return;$('#gps52Id').value=id;$('#gps52Nombre').value=s.nombre||'';$('#gps52Direccion').value=s.direccion||'';$('#gps52Lat').value=s.lat;$('#gps52Lon').value=s.lon;$('#gps52SedeRadio').value=s.radio||80;$('#gps52SedeActiva').checked=s.activo!==false;$('#gps52SaveSede').textContent='✅ Actualizar local';$('#gps52CaptureInfo').innerHTML=`Editando <b>${esc(s.nombre)}</b>. Puedes cambiar los metros o volver a capturar la ubicación.`;document.getElementById('gps52Panel').scrollIntoView({behavior:'smooth',block:'start'});}
  async function toggleSede(id){const s=config.sedes[id];await db().ref('configuracion_gps_v51/sedes/'+id+'/activo').set(!(s.activo!==false));}
  async function removeSede(id){if(!confirm('¿Eliminar este local autorizado?'))return;await db().ref('configuracion_gps_v51/sedes/'+id).remove();}
  function renderSedes(){const box=$('#gps52Sedes');if(!box)return;const rows=Object.entries(config.sedes||{});box.innerHTML=rows.length?rows.map(([id,s])=>`<div class="gps52-sede ${s.activo===false?'off':''}"><div><b>${esc(s.nombre)}</b><span class="gps52-badge">${esc(s.radio||80)} m</span><small>${esc(s.direccion||'Sin dirección')}<br>${esc(s.lat)}, ${esc(s.lon)} · ${s.activo===false?'Desactivado':'Activo'}</small></div><div><button data-edit="${id}">✏️ Editar</button><button data-toggle="${id}" class="secondary">${s.activo===false?'Activar':'Desactivar'}</button><button data-del="${id}" class="danger">Eliminar</button></div></div>`).join(''):'<p class="gps52-help">Todavía no hay locales configurados.</p>';
    box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editSede(b.dataset.edit));box.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggleSede(b.dataset.toggle));box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>removeSede(b.dataset.del));
  }
  function renderEmployees(){const s=$('#gps52Empleado');if(!s)return;const keep=s.value;s.innerHTML='<option value="">Selecciona empleado</option>'+Object.entries(empleados).sort((a,b)=>String(a[1].nombre||'').localeCompare(String(b[1].nombre||''),'es')).map(([id,e])=>`<option value="${id}">${esc(e.nombre||'Sin nombre')}</option>`).join('');if(keep&&empleados[keep])s.value=keep;renderChecks();}
  function renderChecks(){const id=$('#gps52Empleado').value,e=empleados[id]||{},allowed=e.sedesPermitidas||{};const rows=Object.entries(config.sedes||{}).filter(([,s])=>s.activo!==false);$('#gps52Checks').innerHTML=rows.length?rows.map(([sid,s])=>`<label><input type="checkbox" value="${sid}" ${allowed[sid]?'checked':''}> ${esc(s.nombre)} <small>(${esc(s.radio||80)} m)</small></label>`).join(''):'<span class="gps52-help">Agrega locales primero.</span>';}
  async function saveEmpleado(){const id=$('#gps52Empleado').value;if(!id)return status('Selecciona un empleado.',false);const out={};document.querySelectorAll('#gps52Checks input:checked').forEach(i=>out[i.value]=true);try{await db().ref('empleados/'+id+'/sedesPermitidas').set(Object.keys(out).length?out:null);status('Locales permitidos guardados para '+(empleados[id].nombre||'empleado')+'.');}catch(e){status('No se pudo guardar: '+e.message,false);}}
  function render(){if(!$('#gps52Panel'))return;$('#gps52Activo').checked=!!config.activo;$('#gps52Precision').value=config.precisionMaxima||120;$('#gps52Radio').value=config.radioDefault||80;renderSedes();renderEmployees();}
  function subscribe(){if(!dbReady())return setTimeout(subscribe,300);db().ref('configuracion_gps_v51').on('value',s=>{const v=s.val()||{};config={...DEFAULT,...v,sedes:v.sedes||{}};render();});db().ref('empleados').on('value',s=>{empleados=s.val()||{};renderEmployees();});}
  function boot(){if(!dbReady())return setTimeout(boot,250);mount();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
