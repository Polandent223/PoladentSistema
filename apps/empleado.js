/* POLADENT v5.1 - Empleado rápido con control GPS multisede */
(function(){
  'use strict';
  const etapas=['entrada','almuerzo_salida','almuerzo_regreso','salida'];
  let empleadoActual=null,marcando=false,gpsConfig={activo:false,precisionMaxima:120,sedes:{}};
  const $=id=>document.getElementById(id), db=()=>firebase.database();
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
  const todayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function msg(text,type=''){const el=$('fastMsg');if(el){el.className='fast-msg '+type;el.textContent=text;}}
  function setBusy(v){marcando=v;document.querySelectorAll('#fastButtons button').forEach(b=>b.disabled=v);}
  function updateClock(){const n=new Date();$('fastClock').textContent=n.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});$('fastDate').textContent=n.toLocaleDateString('es-VE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});}
  function waitFirebase(cb){let tries=0;const t=setInterval(()=>{tries++;if(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database){clearInterval(t);cb();}if(tries>80){clearInterval(t);msg('No se pudo conectar con Firebase. Revisa internet o config.js.','error');}},200);}
  async function buscarEmpleado(pin){const s=await db().ref('empleados').orderByChild('pin').equalTo(pin).once('value');if(!s.exists())return null;let out=null;s.forEach(x=>{if(!out)out={id:x.key,...(x.val()||{})};});return out;}
  function renderEmpleado(e){const box=$('fastEmployee'),photo=$('fastPhoto');if(!e){box.classList.add('hidden');$('fastButtons').classList.add('hidden');$('fastName').textContent='Empleado';photo.outerHTML='<div id="fastPhoto" class="photo-placeholder">👤</div>';return;}$('fastName').textContent=e.nombre||'Empleado';photo.outerHTML=e.foto?`<img id="fastPhoto" src="${e.foto}" alt="Foto de empleado">`:'<div id="fastPhoto" class="photo-placeholder">👤</div>';box.classList.remove('hidden');$('fastButtons').classList.remove('hidden');}
  let pinTimer=null;function onPinInput(){clearTimeout(pinTimer);const pin=$('fastPin').value.trim();if(!pin){empleadoActual=null;renderEmpleado(null);msg('Ingrese su PIN para comenzar.');return;}pinTimer=setTimeout(async()=>{try{const e=await buscarEmpleado(pin);if(!e){empleadoActual=null;renderEmpleado(null);return msg('PIN no encontrado. Verifica e intenta de nuevo.','error');}empleadoActual=e;renderEmpleado(e);msg(gpsConfig.activo?'Empleado encontrado. La ubicación se verificará al marcar.':'Empleado encontrado. Seleccione la marcación.','ok');}catch(e){msg('Error buscando empleado. Revisa la conexión.','error');}},350);}
  function getGps(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS no disponible en este dispositivo.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,obtenido:Date.now()}),e=>reject(new Error(e.code===1?'Activa el permiso de ubicación para poder marcar.':'No se pudo obtener una ubicación precisa. Intenta nuevamente.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});});}
  function distance(a,b,c,d){const R=6371000,r=x=>x*Math.PI/180,dp=r(c-a),dl=r(d-b),q=Math.sin(dp/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function validarSede(gps){
    if(!gpsConfig.activo)return {ok:true,sede:null,distancia:null};
    const max=Number(gpsConfig.precisionMaxima)||120;if(Number(gps.accuracy)>max)return {ok:false,error:`La precisión del GPS es de ${Math.round(gps.accuracy)} m. Necesitamos ${max} m o menos. Sal al exterior o acércate a una ventana.`};
    let sedes=Object.entries(gpsConfig.sedes||{}).filter(([,s])=>s&&s.activo!==false&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon)));
    if(!sedes.length)return {ok:false,error:'El administrador todavía no ha configurado locales autorizados.'};
    const permitidas=empleadoActual.sedesPermitidas||{};if(Object.keys(permitidas).length)sedes=sedes.filter(([id])=>permitidas[id]);
    if(!sedes.length)return {ok:false,error:'No tienes un local autorizado asignado. Comunícate con el administrador.'};
    const medidas=sedes.map(([id,s])=>({id,s,distancia:distance(gps.lat,gps.lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.distancia-b.distancia);const best=medidas[0],radio=Number(best.s.radio)||Number(gpsConfig.radioDefault)||80;
    if(best.distancia>radio)return {ok:false,error:`Estás fuera del área autorizada. Local más cercano: ${best.s.nombre} a ${Math.round(best.distancia)} m; límite ${radio} m.`};
    return {ok:true,sede:{id:best.id,nombre:best.s.nombre,direccion:best.s.direccion||'',radio},distancia:best.distancia};
  }
  async function mark(tipo){if(marcando)return;if(!empleadoActual)return msg('Primero ingresa un PIN válido.','error');setBusy(true);msg(gpsConfig.activo?'Verificando ubicación GPS…':'Guardando marcación, espere…');try{
    const now=new Date(),fecha=todayKey(now),ref=db().ref('marcaciones/'+empleadoActual.id+'/'+fecha),snap=await ref.once('value'),marc=snap.val()||{};let lastEtapa=null,lastTime=0;Object.values(marc).forEach(m=>{if(m&&m.timestamp&&m.timestamp>lastTime){lastTime=m.timestamp;lastEtapa=m.tipo;}});const lastIndex=lastEtapa?etapas.indexOf(lastEtapa):-1;if(lastIndex===-1&&tipo!=='entrada')throw new Error('Debes iniciar con Entrada.');if(lastIndex!==-1&&etapas.indexOf(tipo)!==lastIndex+1)throw new Error('Debes seguir el orden de marcación.');
    const gps=await getGps(),valid=validarSede(gps);if(!valid.ok)throw new Error(valid.error);const hora=now.toLocaleTimeString('es-VE'),timestamp=now.getTime();const data={nombre:empleadoActual.nombre||'Empleado',tipo,fecha,hora,timestamp,lat:gps.lat,lon:gps.lon,precisionGps:Math.round(gps.accuracy),gpsVerificado:!!gpsConfig.activo};if(valid.sede){Object.assign(data,{sedeId:valid.sede.id,sedeNombre:valid.sede.nombre,sedeDireccion:valid.sede.direccion,distanciaSede:Math.round(valid.distancia),radioPermitido:valid.sede.radio});}
    await ref.child(tipo).set(data);const frases={entrada:'¡Buen inicio de jornada!',almuerzo_salida:'Buen provecho',almuerzo_regreso:'Bienvenido de vuelta',salida:'¡Buen trabajo!'},lugar=valid.sede?` · ${valid.sede.nombre} (${Math.round(valid.distancia)} m)`:'';msg(`${empleadoActual.nombre} | ${frases[tipo]} (${hora})${lugar}`,'ok');$('fastPin').value='';setTimeout(()=>{empleadoActual=null;renderEmpleado(null);msg('Marcación guardada. Listo para el próximo empleado.','ok');setBusy(false);},2200);
  }catch(e){msg(e.message||'No se pudo guardar la marcación.','error');setBusy(false);}}
  function subscribeGps(){db().ref('configuracion_gps_v51').on('value',s=>{gpsConfig={activo:false,precisionMaxima:120,sedes:{},...(s.val()||{})};});}
  ready(()=>{updateClock();setInterval(updateClock,1000);waitFirebase(()=>{subscribeGps();$('fastPin').addEventListener('input',onPinInput);document.querySelectorAll('#fastButtons button').forEach(b=>b.addEventListener('click',()=>mark(b.dataset.tipo)));msg('Ingrese su PIN para comenzar.');});});
})();
