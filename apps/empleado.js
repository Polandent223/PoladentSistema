/* POLADENT - Empleado rápido
   Página liviana para celular. No carga reportes, gráficos ni panel administrador. */
(function(){
  'use strict';
  const etapas = ['entrada','almuerzo_salida','almuerzo_regreso','salida'];
  let empleadoActual = null;
  let marcando = false;

  function $(id){ return document.getElementById(id); }
  function db(){ return firebase.database(); }
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function todayKey(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function msg(text,type=''){ const el=$('fastMsg'); if(!el) return; el.className='fast-msg '+type; el.textContent=text; }
  function setBusy(state){ marcando=state; document.querySelectorAll('#fastButtons button').forEach(b=>b.disabled=state); }

  function updateClock(){
    const now = new Date();
    $('fastClock').textContent = now.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});
    $('fastDate').textContent = now.toLocaleDateString('es-VE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  }

  function waitFirebase(cb){
    let tries=0;
    const t=setInterval(()=>{
      tries++;
      if(window.firebase && firebase.apps && firebase.apps.length && firebase.database){ clearInterval(t); cb(); }
      if(tries>80){ clearInterval(t); msg('No se pudo conectar con Firebase. Revisa internet o config.js.','error'); }
    },200);
  }

  async function buscarEmpleado(pin){
    const snap = await db().ref('empleados').orderByChild('pin').equalTo(pin).once('value');
    if(!snap.exists()) return null;
    let out=null;
    snap.forEach(s=>{ if(!out) out={ id:s.key, ...(s.val()||{}) }; });
    return out;
  }

  function renderEmpleado(emp){
    const box=$('fastEmployee'), photo=$('fastPhoto');
    if(!emp){ box.classList.add('hidden'); $('fastButtons').classList.add('hidden'); $('fastName').textContent='Empleado'; photo.innerHTML='👤'; return; }
    $('fastName').textContent = emp.nombre || 'Empleado';
    if(emp.foto){ photo.outerHTML = `<img id="fastPhoto" src="${emp.foto}" alt="Foto de ${emp.nombre||'empleado'}">`; }
    else { photo.outerHTML = `<div id="fastPhoto" class="photo-placeholder">👤</div>`; }
    box.classList.remove('hidden');
    $('fastButtons').classList.remove('hidden');
  }

  let pinTimer=null;
  function onPinInput(){
    clearTimeout(pinTimer);
    const pin=$('fastPin').value.trim();
    if(!pin){ empleadoActual=null; renderEmpleado(null); msg('Ingrese su PIN para comenzar.'); return; }
    pinTimer=setTimeout(async()=>{
      try{
        const emp=await buscarEmpleado(pin);
        if(!emp){ empleadoActual=null; renderEmpleado(null); msg('PIN no encontrado. Verifica e intenta de nuevo.','error'); return; }
        empleadoActual=emp;
        renderEmpleado(emp);
        msg('Empleado encontrado. Seleccione la marcación.','ok');
      }catch(e){ msg('Error buscando empleado. Revisa la conexión.','error'); }
    },350);
  }

  function getGps(){
    return new Promise((resolve,reject)=>{
      if(!navigator.geolocation) return reject(new Error('GPS no disponible en este teléfono.'));
      navigator.geolocation.getCurrentPosition(
        pos=>resolve({lat:pos.coords.latitude, lon:pos.coords.longitude}),
        ()=>reject(new Error('No se pudo obtener la ubicación GPS. Activa la ubicación.')),
        {enableHighAccuracy:false, timeout:12000, maximumAge:60000}
      );
    });
  }

  async function mark(tipo){
    if(marcando) return;
    if(!empleadoActual){ msg('Primero ingresa un PIN válido.','error'); return; }
    setBusy(true);
    msg('Guardando marcación, espere...');
    try{
      const now=new Date();
      const fecha=todayKey(now);
      const ref=db().ref('marcaciones/'+empleadoActual.id+'/'+fecha);
      const snap=await ref.once('value');
      const marc=snap.val()||{};
      let lastEtapa=null,lastTime=0;
      Object.values(marc).forEach(m=>{ if(m && m.timestamp && m.timestamp>lastTime){ lastTime=m.timestamp; lastEtapa=m.tipo; }});
      const lastIndex=lastEtapa ? etapas.indexOf(lastEtapa) : -1;
      if(lastIndex===-1 && tipo!=='entrada'){ msg('Debes iniciar con Entrada.','error'); setBusy(false); return; }
      if(lastIndex!==-1 && etapas.indexOf(tipo)!==lastIndex+1){ msg('Debes seguir el orden de marcación.','error'); setBusy(false); return; }
      const gps=await getGps();
      const hora=now.toLocaleTimeString('es-VE');
      const timestamp=now.getTime();
      await ref.child(tipo).set({ nombre:empleadoActual.nombre||'Empleado', tipo, fecha, hora, timestamp, lat:gps.lat, lon:gps.lon });
      const frases={entrada:'¡Buen inicio de jornada!',almuerzo_salida:'Buen provecho',almuerzo_regreso:'Bienvenido de vuelta',salida:'¡Buen trabajo!'};
      msg(`${empleadoActual.nombre} | ${frases[tipo]} (${hora})`,'ok');
      $('fastPin').value='';
      setTimeout(()=>{ empleadoActual=null; renderEmpleado(null); msg('Marcación guardada. Listo para el próximo empleado.','ok'); setBusy(false); },1800);
    }catch(e){ msg(e.message || 'No se pudo guardar la marcación.','error'); setBusy(false); }
  }

  ready(()=>{
    updateClock(); setInterval(updateClock,1000);
    waitFirebase(()=>{
      $('fastPin').addEventListener('input', onPinInput);
      document.querySelectorAll('#fastButtons button').forEach(btn=>btn.addEventListener('click',()=>mark(btn.dataset.tipo)));
      msg('Ingrese su PIN para comenzar.');
    });
  });
})();
