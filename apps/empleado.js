/* Empleado rápido: GPS multisede, cámara en vivo y control de dispositivo */
(function(){
  'use strict';
  const etapas=['entrada','almuerzo_salida','almuerzo_regreso','salida'];
  let empleadoActual=null,marcando=false,configReady=false,etapaPendiente=null,empleadosCache={},pinCache=new Map(),gpsConfig={activo:false,precisionMaxima:120,sedes:{}},segConfig={activo:true,fotoEntrada:true,fotoAlmuerzoSalida:false,fotoAlmuerzoRegreso:false,fotoSalida:true,alertarDispositivoCompartido:true,ventanaDispositivoMinutos:10,guardarEvidencia:true,maxIntentosPin:5,bloqueoPinMinutos:5};
  const $=id=>document.getElementById(id), db=()=>firebase.database();
  const ready=fn=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();
  const todayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function msg(text,type=''){const el=$('fastMsg');if(el){el.className='fast-msg '+type;el.textContent=text;}}
  function tiposRegistrados(marc){
    const found=new Set();
    Object.entries(marc||{}).forEach(([k,v])=>{
      if(etapas.includes(k)&&v)found.add(k);
      if(v&&typeof v==='object'&&etapas.includes(v.tipo))found.add(v.tipo);
    });
    return found;
  }
  function siguienteEtapa(marc){const found=tiposRegistrados(marc);return etapas.find(x=>!found.has(x))||null;}
  function aplicarBotonPendiente(){
    document.querySelectorAll('#fastButtons button[data-tipo]').forEach(b=>{
      b.disabled=marcando||!etapaPendiente||b.dataset.tipo!==etapaPendiente;
      b.classList.toggle('etapa-pendiente',!!etapaPendiente&&b.dataset.tipo===etapaPendiente);
    });
  }
  function setBusy(v){marcando=v;aplicarBotonPendiente();}
  async function cargarEtapaPendiente(){
    if(!empleadoActual){etapaPendiente=null;aplicarBotonPendiente();return null;}
    const fecha=todayKey(new Date());
    const snap=await db().ref('marcaciones/'+empleadoActual.id+'/'+fecha).once('value');
    etapaPendiente=siguienteEtapa(snap.val()||{});
    aplicarBotonPendiente();
    return etapaPendiente;
  }
  function ensureConnectionBanner(){let b=$('fastConnection');if(b)return b;b=document.createElement('div');b.id='fastConnection';b.className='fast-connection hidden';const main=document.querySelector('.fast-shell,.employee-shell,main,body');(main||document.body).prepend(b);return b;}
  function setConnectionState(online,text=''){const b=ensureConnectionBanner();b.classList.toggle('hidden',online);b.textContent=text||(online?'':'Sin conexión. No podrás marcar hasta recuperar internet.');if(!online&&$('fastSearch'))$('fastSearch').disabled=true;else if(online&&configReady&&$('fastSearch'))$('fastSearch').disabled=false;}
  function updateClock(){const n=new Date();$('fastClock').textContent=n.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});$('fastDate').textContent=n.toLocaleDateString('es-VE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});}
  function waitFirebase(cb){let tries=0;const t=setInterval(()=>{tries++;if(window.firebase&&firebase.apps&&firebase.apps.length&&firebase.database&&firebase.auth){clearInterval(t);cb();}if(tries>80){clearInterval(t);msg('No se pudo cargar Firebase. Revisa internet, la publicación y firebase/config.js.','error');}},200);}
  function authErrorMessage(error){
    const code=String(error&&error.code||'');
    if(code.includes('operation-not-allowed'))return 'El acceso anónimo está desactivado en Firebase Authentication.';
    if(code.includes('unauthorized-domain'))return `El dominio ${location.hostname} no está autorizado en Firebase.`;
    if(code.includes('network-request-failed'))return 'No se pudo conectar con Firebase. Revisa internet e intenta nuevamente.';
    if(code.includes('too-many-requests'))return 'Firebase bloqueó temporalmente los intentos. Espera unos minutos.';
    return `No se pudo iniciar la sesión del empleado${code?` (${code})`:''}.`;
  }
  async function ensureEmployeeSession(){
    const auth=firebase.auth();
    if(auth.currentUser)return auth.currentUser;
    // Firebase suele restaurar la sesión persistida casi de inmediato.
    const existing=await new Promise(resolve=>{
      let finished=false;
      const timer=setTimeout(()=>{if(!finished){finished=true;resolve(auth.currentUser||null);}},450);
      const off=auth.onAuthStateChanged(user=>{if(!finished&&user){finished=true;clearTimeout(timer);off();resolve(user);}});
    });
    if(existing)return existing;
    const credential=await auth.signInAnonymously();
    return credential.user;
  }
  function rebuildPinCache(raw){
    empleadosCache=raw||{};pinCache=new Map();
    Object.entries(empleadosCache).forEach(([id,e])=>{
      if(!e||e.archivado===true||e.activo===false)return;
      const pin=String(e.pin??'').trim();
      if(pin&&!pinCache.has(pin))pinCache.set(pin,{id,...e});
    });
  }
  async function buscarEmpleado(pin){
    const key=String(pin||'').trim();
    const cached=pinCache.get(key);
    if(cached)return {...cached};
    const s=await db().ref('empleados').orderByChild('pin').equalTo(key).once('value');
    if(!s.exists())return null;
    let out=null;s.forEach(x=>{const e=x.val()||{};if(!out&&e.archivado!==true&&e.activo!==false)out={id:x.key,...e};});
    if(out)pinCache.set(key,out);
    return out;
  }
  function renderEmpleado(e){const box=$('fastEmployee'),photo=$('fastPhoto');if(!e){etapaPendiente=null;box.classList.add('hidden');$('fastButtons').classList.add('hidden');$('fastName').textContent='Empleado';photo.outerHTML='<div id="fastPhoto" class="photo-placeholder">👤</div>';aplicarBotonPendiente();return;}$('fastName').textContent=e.nombre||'Empleado';photo.outerHTML=e.foto?`<img id="fastPhoto" src="${e.foto}" alt="Foto de empleado">`:'<div id="fastPhoto" class="photo-placeholder">👤</div>';box.classList.remove('hidden');$('fastButtons').classList.remove('hidden');aplicarBotonPendiente();}
  let buscandoPin=false,lastInvalid='',invalidAttempts=Number(localStorage.getItem('poladent_invalid_pin_attempts')||0),lockUntil=Number(localStorage.getItem('poladent_pin_lock_until')||0);
  function lockRemaining(){return Math.max(0,lockUntil-Date.now());}
  function clearPinLock(){invalidAttempts=0;lockUntil=0;localStorage.removeItem('poladent_invalid_pin_attempts');localStorage.removeItem('poladent_pin_lock_until');}
  function registerInvalidAttempt(){invalidAttempts+=1;localStorage.setItem('poladent_invalid_pin_attempts',String(invalidAttempts));const max=Math.max(2,Number(segConfig.maxIntentosPin)||5);if(invalidAttempts>=max){const mins=Math.max(1,Number(segConfig.bloqueoPinMinutos)||5);lockUntil=Date.now()+mins*60000;localStorage.setItem('poladent_pin_lock_until',String(lockUntil));return mins;}return 0;}
  function setPinSearching(active){
    buscandoPin=active;
    const input=$('fastPin'),button=$('fastSearch');
    if(input)input.disabled=active;
    if(button){button.disabled=active;button.textContent=active?'Buscando…':'Buscar';}
  }
  function onPinTyping(){
    if(empleadoActual){empleadoActual=null;renderEmpleado(null);}
    const pin=$('fastPin').value.trim();
    if(!pin)msg('Escribe tu PIN y pulsa Buscar.');
  }
  async function submitPinSearch(){
    if(buscandoPin)return;
    if(!configReady){msg('Estamos cargando la configuración de asistencia. Revisa tu conexión y espera unos segundos.','error');return;}
    const remaining=lockRemaining();
    if(remaining>0){
      $('fastPin').value='';empleadoActual=null;renderEmpleado(null);
      msg(`Demasiados intentos inválidos. Espera ${Math.ceil(remaining/60000)} minuto(s) para intentar nuevamente.`,'error');
      return;
    }
    if(lockUntil&&remaining<=0)clearPinLock();
    const pin=$('fastPin').value.trim();
    if(!pin){empleadoActual=null;renderEmpleado(null);msg('Escribe tu PIN y pulsa Buscar.','error');$('fastPin').focus();return;}
    setPinSearching(true);
    msg('Buscando empleado…');
    try{
      const e=await buscarEmpleado(pin);
      if(!e){
        empleadoActual=null;renderEmpleado(null);
        const mins=registerInvalidAttempt();
        msg(mins?`Demasiados intentos inválidos. El acceso quedó bloqueado por ${mins} minuto(s).`:'Código errado. Verifica el PIN e intenta nuevamente.','error');
        if(pin!==lastInvalid){
          lastInvalid=pin;
          registrarAlerta({codigo:mins?'PIN_BLOQUEADO':'PIN_INVALIDO',motivo:mins?`Dispositivo bloqueado por ${mins} minuto(s) después de varios PIN inválidos.`:'Intento de marcación con PIN no reconocido',empleado:'No identificado',intentosInvalidos:invalidAttempts});
        }
        $('fastPin').select();
        return;
      }
      lastInvalid='';clearPinLock();empleadoActual=e;renderEmpleado(e);
      const pendiente=await cargarEtapaPendiente();
      const etiquetas={entrada:'Entrada',almuerzo_salida:'Salida almuerzo',almuerzo_regreso:'Regreso almuerzo',salida:'Salida'};
      if(pendiente)msg(`${e.nombre||'Empleado'} encontrado. Marcación pendiente: ${etiquetas[pendiente]}.`,'ok');
      else msg(`${e.nombre||'Empleado'}: la jornada de hoy ya está completa.`,'ok');
    }catch(error){
      console.error('Error buscando empleado:',error);
      msg(error&&error.code==='PERMISSION_DENIED'?'Firebase no permitió consultar empleados.':'Error buscando empleado. Revisa la conexión.','error');
    }finally{setPinSearching(false);}
  }
  function getGps(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error('GPS no disponible en este dispositivo.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy,obtenido:Date.now()}),e=>reject(new Error(e.code===1?'Activa el permiso de ubicación para poder marcar.':'No se pudo obtener una ubicación precisa. Intenta nuevamente.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});});}
  function distance(a,b,c,d){const R=6371000,r=x=>x*Math.PI/180,dp=r(c-a),dl=r(d-b),q=Math.sin(dp/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
  function validarSede(gps){if(!gpsConfig.activo)return {ok:true,sede:null,distancia:null};const max=Number(gpsConfig.precisionMaxima)||120;if(Number(gps.accuracy)>max)return {ok:false,error:`La precisión del GPS es de ${Math.round(gps.accuracy)} m. Necesitamos ${max} m o menos. Sal al exterior o acércate a una ventana.`};let sedes=Object.entries(gpsConfig.sedes||{}).filter(([,s])=>s&&s.activo!==false&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon)));if(!sedes.length)return {ok:false,error:'El administrador todavía no ha configurado locales autorizados.'};const permitidas=empleadoActual.sedesPermitidas||{};if(!Object.keys(permitidas).length)return {ok:false,codigo:'SIN_SEDE',error:'Todavía no estás agregado a ninguna tienda oficial. Comunícate con el administrador.'};sedes=sedes.filter(([id])=>permitidas[id]);if(!sedes.length)return {ok:false,codigo:'SEDE_INACTIVA',error:'La tienda que tienes asignada no está activa. Comunícate con el administrador.'};const medidas=sedes.map(([id,s])=>({id,s,distancia:distance(gps.lat,gps.lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.distancia-b.distancia);const best=medidas[0],radio=Number(best.s.radio)||Number(gpsConfig.radioDefault)||80;if(best.distancia>radio)return {ok:false,codigo:'FUERA_AREA',sedeCercana:best.s.nombre,distancia:best.distancia,radio,error:`Estás fuera del área autorizada. Local más cercano: ${best.s.nombre} a ${Math.round(best.distancia)} m; límite ${radio} m.`};return {ok:true,sede:{id:best.id,nombre:best.s.nombre,direccion:best.s.direccion||'',radio},distancia:best.distancia};}
  function deviceId(){let id=localStorage.getItem('poladent_device_id');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem('poladent_device_id',id);}return id;}
  function requiresPhoto(tipo){if(segConfig.activo===false)return false;const key={entrada:'fotoEntrada',almuerzo_salida:'fotoAlmuerzoSalida',almuerzo_regreso:'fotoAlmuerzoRegreso',salida:'fotoSalida'}[tipo];return key?!!segConfig[key]:false;}
  function ensureCameraUi(){if($('cameraOverlay'))return;document.body.insertAdjacentHTML('beforeend',`<div id="cameraOverlay" class="camera-overlay hidden"><div class="camera-dialog"><h3>Verificación de identidad</h3><p>Mira de frente a la cámara para registrar la marcación.</p><div class="camera-frame"><video id="cameraVideo" autoplay playsinline muted></video><img id="cameraPreview" class="hidden" alt="Foto capturada"></div><div class="camera-actions"><button id="cameraCapture" class="camera-primary">Tomar fotografía</button><button id="cameraRetry" class="camera-secondary hidden">Repetir</button><button id="cameraConfirm" class="camera-primary hidden">Usar fotografía</button><button id="cameraCancel" class="camera-danger">Cancelar</button></div><div id="cameraStatus" class="camera-status">La fotografía debe tomarse ahora; no se permite seleccionar desde la galería.</div><p class="privacy-note">La imagen podrá verla el administrador durante esta jornada y se eliminará automáticamente después.</p></div></div>`);}
  function capturePhoto(){return new Promise(async(resolve,reject)=>{ensureCameraUi();const overlay=$('cameraOverlay'),video=$('cameraVideo'),preview=$('cameraPreview'),capture=$('cameraCapture'),retry=$('cameraRetry'),confirm=$('cameraConfirm'),cancel=$('cameraCancel'),status=$('cameraStatus');let stream=null,data=null,closed=false;const close=()=>{if(closed)return;closed=true;stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;overlay.classList.add('hidden');capture.disabled=false;};try{if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Este navegador no permite usar la cámara.'),{name:'NotSupportedError'});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:720},height:{ideal:960}},audio:false});video.srcObject=stream;overlay.classList.remove('hidden');video.classList.remove('hidden');preview.classList.add('hidden');capture.classList.remove('hidden');retry.classList.add('hidden');confirm.classList.add('hidden');capture.disabled=true;status.textContent='Iniciando cámara…';const readyVideo=()=>{capture.disabled=false;status.textContent='Ubica tu rostro dentro de la cámara y pulsa “Tomar fotografía”.';};if(video.readyState>=2&&video.videoWidth)readyVideo();else video.onloadedmetadata=()=>{video.play().catch(()=>{});readyVideo();};capture.onclick=()=>{if(!video.videoWidth||!video.videoHeight){status.textContent='La cámara todavía está iniciando. Espera un momento e intenta nuevamente.';return;}const canvas=document.createElement('canvas'),max=480,ratio=video.videoHeight/video.videoWidth||4/3;canvas.width=max;canvas.height=Math.round(max*ratio);const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',0.62);preview.src=data;video.classList.add('hidden');preview.classList.remove('hidden');capture.classList.add('hidden');retry.classList.remove('hidden');confirm.classList.remove('hidden');status.textContent='Revisa la fotografía antes de continuar.';};retry.onclick=()=>{data=null;video.classList.remove('hidden');preview.classList.add('hidden');capture.classList.remove('hidden');retry.classList.add('hidden');confirm.classList.add('hidden');capture.disabled=false;};confirm.onclick=()=>{if(!data)return;close();resolve(data);};cancel.onclick=()=>{close();reject(new Error('La marcación fue cancelada porque la fotografía es obligatoria.'));};}catch(e){close();registrarAlerta({codigo:'FOTO_ERROR',motivo:'No se pudo abrir la cámara: '+(e.message||e),empleado:empleadoActual?.nombre||'Empleado',empleadoId:empleadoActual?.id});const name=e?.name||'';if(name==='NotAllowedError'||name==='PermissionDeniedError')reject(new Error('La cámara está bloqueada. Autorízala en los permisos del sitio y vuelve a intentar.'));else if(name==='NotFoundError'||name==='DevicesNotFoundError')reject(new Error('No se detectó una cámara disponible en este dispositivo.'));else if(name==='NotReadableError'||name==='TrackStartError')reject(new Error('La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentar.'));else reject(new Error('No se pudo abrir la cámara. Revisa el permiso y vuelve a intentar.'));}});}
  async function registrarAlerta(data){try{await db().ref('alertas_seguridad').push().set({timestamp:Date.now(),fecha:todayKey(),dispositivoId:deviceId(),navegador:navigator.userAgent||'',...data});}catch(_e){}}
  async function registrarIntentoGps(valid,gps,tipo){try{await db().ref('alertas_gps').push().set({empleadoId:empleadoActual?.id||null,empleado:empleadoActual?.nombre||'Empleado desconocido',tipo:tipo||null,codigo:valid?.codigo||'GPS_BLOQUEADO',motivo:valid?.error||'Intento GPS bloqueado',sedeCercana:valid?.sedeCercana||null,distancia:Number.isFinite(Number(valid?.distancia))?Math.round(Number(valid.distancia)):null,radioPermitido:Number.isFinite(Number(valid?.radio))?Number(valid.radio):null,lat:gps?.lat??null,lon:gps?.lon??null,precisionGps:gps?.accuracy?Math.round(gps.accuracy):null,timestamp:Date.now(),fecha:todayKey(new Date()),dispositivo:navigator.userAgent||'',dispositivoId:deviceId()});}catch(_e){}}
  async function checkSharedDevice(tipo){if(segConfig.alertarDispositivoCompartido===false)return;const id=deviceId(),ref=db().ref('dispositivos_marcacion/'+id),s=await ref.once('value'),last=s.val()||{},windowMs=(Number(segConfig.ventanaDispositivoMinutos)||10)*60000;if(last.empleadoId&&last.empleadoId!==empleadoActual.id&&Date.now()-Number(last.timestamp||0)<=windowMs){await registrarAlerta({codigo:'DISPOSITIVO_COMPARTIDO',motivo:`El mismo dispositivo fue utilizado por ${last.empleado||'otro empleado'} y ${empleadoActual.nombre||'este empleado'} con pocos minutos de diferencia.`,empleado:empleadoActual.nombre||'Empleado',empleadoId:empleadoActual.id,empleadoAnterior:last.empleado||'',empleadoAnteriorId:last.empleadoId||'',tipoMarcacion:tipo});}}
  async function updateDevice(tipo){await db().ref('dispositivos_marcacion/'+deviceId()).set({empleadoId:empleadoActual.id,empleado:empleadoActual.nombre||'Empleado',timestamp:Date.now(),tipoMarcacion:tipo});}
  async function mark(tipo){if(marcando)return;if(!configReady)return msg('La configuración de asistencia todavía no terminó de cargar. Intenta nuevamente en unos segundos.','error');if(!empleadoActual)return msg('Primero ingresa un PIN válido.','error');setBusy(true);msg(gpsConfig.activo?'Verificando ubicación GPS…':'Preparando marcación…');try{const liveEmp=(await db().ref('empleados/'+empleadoActual.id).once('value')).val()||{};if(liveEmp.archivado===true||liveEmp.activo===false)throw new Error('Este funcionario está archivado o inactivo. Comunícate con el administrador.');empleadoActual={...empleadoActual,...liveEmp,id:empleadoActual.id};const now=new Date(),fecha=todayKey(now),ref=db().ref('marcaciones/'+empleadoActual.id+'/'+fecha),snap=await ref.once('value'),marc=snap.val()||{};const expectedBefore=siguienteEtapa(marc);etapaPendiente=expectedBefore;aplicarBotonPendiente();if(!expectedBefore)throw new Error('La jornada de hoy ya está completa.');if(tipo!==expectedBefore){const etiquetas={entrada:'Entrada',almuerzo_salida:'Salida almuerzo',almuerzo_regreso:'Regreso almuerzo',salida:'Salida'};throw new Error(`La marcación pendiente es ${etiquetas[expectedBefore]}.`);}const gps=await getGps(),valid=validarSede(gps);if(!valid.ok){await registrarIntentoGps(valid,gps,tipo);throw new Error(valid.error);}let foto=null;if(requiresPhoto(tipo)){msg('La fotografía es obligatoria para esta marcación.');foto=await capturePhoto();}await checkSharedDevice(tipo);const hora=now.toLocaleTimeString('es-VE'),timestamp=now.getTime();const finDia=new Date(now);finDia.setHours(23,59,59,999);const data={nombre:empleadoActual.nombre||'Empleado',tipo,fecha,hora,timestamp,lat:gps.lat,lon:gps.lon,precisionGps:Math.round(gps.accuracy),gpsVerificado:!!gpsConfig.activo,dispositivoId:deviceId(),evidenciaFotografica:!!foto,fotoTemporal:!!foto,fotoDisponible:!!foto,fotoExpiraEn:finDia.getTime()};if(foto&&segConfig.guardarEvidencia!==false)data.fotoEvidencia=foto;if(valid.sede)Object.assign(data,{sedeId:valid.sede.id,sedeNombre:valid.sede.nombre,sedeDireccion:valid.sede.direccion,distanciaSede:Math.round(valid.distancia),radioPermitido:valid.sede.radio});// Protección atómica por etapa: evita duplicar la misma marcación sin depender
// del caché inicial del nodo padre (que puede llegar como null en Firebase).
const latestSnap=await ref.once('value'),latest=latestSnap.val()||{},latestExpected=siguienteEtapa(latest);
if(latestExpected!==tipo){etapaPendiente=latestExpected;aplicarBotonPendiente();throw new Error(latestExpected?'La jornada se actualizó. Usa el botón habilitado.':'La jornada de hoy ya está completa.');}
const stageRef=ref.child(tipo);
const tx=await stageRef.transaction(current=>current?undefined:data,undefined,false);
if(!tx.committed){await cargarEtapaPendiente();throw new Error('Esta marcación ya fue registrada. Revisa el botón habilitado.');}
etapaPendiente=etapas[etapas.indexOf(tipo)+1]||null;aplicarBotonPendiente();await updateDevice(tipo);document.dispatchEvent(new CustomEvent('poladent:marcaciones-actualizadas',{detail:{empleadoId:empleadoActual.id,fecha,tipo}}));const frases={entrada:['¡Excelente comienzo! Hoy es una nueva oportunidad para dar lo mejor de ti.','¡Buen inicio de jornada! Tu esfuerzo hace la diferencia.','Comienza con energía: cada pequeño avance cuenta.'],almuerzo_salida:['¡Buen provecho! Tómate este momento para recargar energías.','Disfruta tu almuerzo; un buen descanso también forma parte de un gran trabajo.','Pausa merecida. Regresa con nuevas energías.'],almuerzo_regreso:['¡Bienvenido de vuelta! Continuemos construyendo un gran día.','Regresaste con energía. Lo mejor de la jornada todavía puede suceder.','¡Vamos por una excelente segunda parte del día!'],salida:['¡Excelente trabajo hoy! Gracias por tu compromiso.','Jornada completada. Siéntete orgulloso de lo que lograste hoy.','¡Buen trabajo! Tu dedicación impulsa a todo el equipo.']};const lista=frases[tipo]||['¡Marcación registrada correctamente!'];const frase=lista[Math.floor(Math.random()*lista.length)],lugar=valid.sede?` · ${valid.sede.nombre} (${Math.round(valid.distancia)} m)`:'';msg(`${empleadoActual.nombre}: ${frase} (${hora})${lugar}`,'ok');$('fastPin').value='';setTimeout(()=>{empleadoActual=null;renderEmpleado(null);setBusy(false);},6500);}catch(e){msg(e.message||'No se pudo guardar la marcación.','error');setBusy(false);}}
  function ensurePreflightUi(){if($('fastPreflight'))return;const msgBox=$('fastMsg');if(!msgBox)return;const box=document.createElement('div');box.id='fastPreflight';box.className='fast-preflight';box.innerHTML='<div><b>Permisos del dispositivo</b><small id="fastPreflightText">Comprobando ubicación y cámara…</small></div><button id="fastPreflightBtn" type="button">Autorizar / probar cámara</button>';msgBox.before(box);$('fastPreflightBtn').onclick=authorizeCamera;}
  async function permissionState(name){try{if(!navigator.permissions)return 'desconocido';const r=await navigator.permissions.query({name});return r.state||'desconocido';}catch(_e){return 'desconocido';}}
  async function authorizeCamera(){ensurePreflightUi();const text=$('fastPreflightText'),btn=$('fastPreflightBtn');btn.disabled=true;const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);if(!secure){text.textContent='La cámara requiere HTTPS. Abre la dirección segura del sistema.';document.getElementById('fastPreflight').classList.add('warning');btn.disabled=false;return;}if(!navigator.mediaDevices?.getUserMedia){text.textContent='Este navegador no ofrece acceso a la cámara. Prueba Chrome actualizado.';document.getElementById('fastPreflight').classList.add('warning');btn.disabled=false;return;}text.textContent='Solicitando permiso de cámara…';let stream=null;try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});stream.getTracks().forEach(track=>track.stop());text.textContent='Cámara autorizada correctamente ✅';document.getElementById('fastPreflight').classList.remove('warning');}catch(error){const name=error?.name||'';if(name==='NotAllowedError'||name==='PermissionDeniedError'){text.textContent='Cámara bloqueada. En Chrome abre ⋮ > Configuración > Configuración de sitios > Cámara, permite este sitio y vuelve a probar.';}else if(name==='NotFoundError'||name==='DevicesNotFoundError'){text.textContent='No se detectó una cámara disponible en este dispositivo.';}else if(name==='NotReadableError'||name==='TrackStartError'){text.textContent='La cámara está ocupada por otra aplicación. Ciérrala y vuelve a probar.';}else{text.textContent='No se pudo abrir la cámara: '+(error?.message||name||'error desconocido');}document.getElementById('fastPreflight').classList.add('warning');}finally{stream?.getTracks?.().forEach(track=>track.stop());btn.disabled=false;}}
  async function runPreflight(){ensurePreflightUi();const text=$('fastPreflightText'),btn=$('fastPreflightBtn');btn.disabled=true;text.textContent='Comprobando permisos…';const gps=await permissionState('geolocation');let cam=await permissionState('camera');if(cam==='desconocido'&&!navigator.mediaDevices?.getUserMedia)cam='no disponible';const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);const ok=secure&&gps!=='denied'&&cam!=='denied'&&cam!=='no disponible';text.textContent=ok?`Listo · ubicación: ${gps} · cámara: ${cam}`:`Revisión necesaria · ${!secure?'abre el sistema con HTTPS · ':''}ubicación: ${gps} · cámara: ${cam}`;document.getElementById('fastPreflight').classList.toggle('warning',!ok);btn.disabled=false;}
  function subscribe(){const sub=(path,fn)=>window.PoladentData?.subscribe?window.PoladentData.subscribe(path,fn):db().ref(path).on('value',fn);let gpsLoaded=false,segLoaded=false;const done=()=>{const wasReady=configReady;configReady=gpsLoaded&&segLoaded;if(configReady){if($('fastSearch'))$('fastSearch').disabled=false;if(!wasReady&&!empleadoActual)msg('Sistema listo. Escribe tu PIN completo y pulsa Buscar.','ok');}};sub('configuracion_gps_v51',s=>{gpsConfig={activo:false,precisionMaxima:120,sedes:{},...(s.val()||{})};gpsLoaded=true;done();});sub('configuracion_seguridad_asistencia',s=>{segConfig={activo:true,fotoEntrada:true,fotoAlmuerzoSalida:false,fotoAlmuerzoRegreso:false,fotoSalida:true,alertarDispositivoCompartido:true,ventanaDispositivoMinutos:10,guardarEvidencia:true,maxIntentosPin:5,bloqueoPinMinutos:5,...(s.val()||{})};segLoaded=true;done();});
    // Precarga liviana de empleados: después de esto la búsqueda por PIN normalmente no hace otra consulta de red.
    sub('empleados',s=>rebuildPinCache(s.val()||{}));
    setTimeout(()=>{if(!gpsLoaded||!segLoaded){console.warn('[Poladent] Configuración de asistencia tardó en cargar; se mantienen bloqueadas las marcaciones hasta recibir Firebase.');msg('No se pudo cargar todavía la configuración de asistencia. Revisa internet y vuelve a intentar.','error');const box=$('fastPreflight');if(box)box.classList.add('warning');}},8000);}
  ready(()=>{
    updateClock();ensurePreflightUi();runPreflight();setInterval(updateClock,1000);ensureCameraUi();ensureConnectionBanner();window.addEventListener('offline',()=>setConnectionState(false));window.addEventListener('online',()=>{if(configReady)setConnectionState(true);});
    waitFirebase(async()=>{
      try{
        msg('Conectando de forma segura…');
        await ensureEmployeeSession();
        if($('fastSearch'))$('fastSearch').disabled=true;
        try{db().ref('.info/connected').on('value',snap=>setConnectionState(snap.val()===true,snap.val()===true?'':'Firebase está desconectado. Revisa internet; las marcaciones están temporalmente bloqueadas.'));}catch(_e){}
        subscribe();
        $('fastPin').addEventListener('input',onPinTyping);
        $('fastPin').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submitPinSearch();}});
        $('fastSearch').addEventListener('click',submitPinSearch);
        document.querySelectorAll('#fastButtons button').forEach(b=>b.addEventListener('click',()=>mark(b.dataset.tipo)));
        msg('Conectado. Esperando configuración de asistencia…','ok');
      }catch(error){
        console.error('No se pudo autenticar la pantalla de empleado:',error);
        msg(authErrorMessage(error),'error');
        const input=$('fastPin');
        if(input)input.disabled=true;
      }
    });
  });
})();
