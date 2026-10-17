/* POLADENT — empleado seguro de etapa de MIGRACIÓN.
   Solo opera mediante Cloud Functions (Firebase Admin SDK); no consulta datos
   privados ni escribe marcaciones desde el navegador.
   Archivo en rama separada; NO sustituir empleado.js hasta probar backend/rules. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const ETIQUETAS={entrada:'Entrada',almuerzo_salida:'Salida a almuerzo',almuerzo_regreso:'Regreso de almuerzo',salida:'Salida final'};
let fetchEmployee=null,sendMark=null,actual=null,busy=false;
const msg=(v,kind='')=>{const box=$('fastMsg');if(box){box.textContent=v;box.className='fast-msg '+kind;}};
const fecha=()=>new Date().toLocaleDateString('es-VE',{timeZone:'America/Caracas',weekday:'long',day:'2-digit',month:'long',year:'numeric'});
const hora=()=>new Date().toLocaleTimeString('es-VE',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit'});
function identifier(){
 const key='poladent_device_id';
 let id=localStorage.getItem(key);
 if(!id||!/^[a-zA-Z0-9_-]{8,128}$/.test(id)){
   id=typeof crypto?.randomUUID==='function'?crypto.randomUUID():'dev-'+Date.now()+'-'+Math.random().toString(36).slice(2);
   localStorage.setItem(key,id);
 }
 return id;
}
function render(){
 const e=actual?.funcionario;
 $('fastEmployee').classList.toggle('hidden',!e);
 $('fastButtons').classList.toggle('hidden',!e||!actual?.etapaPendiente);
 if(e){
   $('fastName').textContent=e.nombre||'Funcionario';
   const photo=$('fastPhoto');
   if(e.foto&&typeof e.foto==='string'){
     const image=document.createElement('img');
     image.id='fastPhoto';image.alt='Foto del funcionario';image.src=e.foto;
     photo.replaceWith(image);
   }else{const p=document.createElement('div');p.id='fastPhoto';p.className='photo-placeholder';p.textContent='👤';photo.replaceWith(p);}
 }
 document.querySelectorAll('#fastButtons button[data-tipo]').forEach(btn=>{
   btn.disabled=busy||btn.dataset.tipo!==actual?.etapaPendiente;
   btn.classList.toggle('etapa-pendiente',btn.dataset.tipo===actual?.etapaPendiente);
 });
 $('fastSearch').disabled=busy||!fetchEmployee;
 $('fastPin').disabled=busy||!fetchEmployee;
}
function errorText(error){
 if(error?.code==='functions/resource-exhausted')return 'Demasiados intentos de PIN. Intenta más tarde.';
 if(error?.code==='functions/permission-denied'||error?.code==='functions/failed-precondition'||error?.code==='functions/already-exists')return error.message||'Acceso rechazado.';
 if(error?.code==='functions/unauthenticated')return 'No se pudo autenticar el dispositivo. Recarga la página.';
 return 'No se pudo completar el registro. Revisa internet, cámara y GPS e inténtalo de nuevo.';
}
async function buscar(){
 if(busy||!fetchEmployee)return;
 const pin=$('fastPin').value.trim();
 if(!pin)return msg('Escribe tu PIN.','error');
 busy=true;render();msg('Comprobando PIN de forma segura…');
 try{
   const response=(await fetchEmployee({pin,dispositivoId:identifier()})).data;
   actual=response;
   $('fastPin').value='';
   if(response.dispositivo?.obligatorio&&!response.dispositivo.autorizado){
     msg('Este teléfono necesita autorización del administrador. Solicitud enviada; no puedes marcar todavía.','error');
     actual=null;
   }else{
     msg(response.etapaPendiente?'Funcionario verificado. Pendiente: '+(ETIQUETAS[response.etapaPendiente]||response.etapaPendiente)+'.':'La jornada de hoy ya está completa.','ok');
   }
 }catch(error){actual=null;msg(errorText(error),'error');}
 finally{busy=false;render();}
}
function tomarFoto(){
 return new Promise(async(resolve,reject)=>{
   if(!navigator.mediaDevices?.getUserMedia)return reject(new Error('La cámara no está disponible.'));
   let stream=null;
   const overlay=document.createElement('div');
   overlay.className='camera-overlay';
   overlay.innerHTML='<div class="camera-dialog"><h3>Fotografía de asistencia</h3>'+
     '<p>Para validar tu identidad toma una fotografía en este momento.</p>'+
     '<div class="camera-frame"><video autoplay muted playsinline style="max-width:100%"></video></div>'+
     '<div class="camera-actions"><button data-photo="capture" class="camera-primary">Tomar foto</button>'+
     '<button data-photo="cancel" class="camera-danger">Cancelar</button></div>'+
     '<p class="camera-status">La cámara se utiliza en vivo, sin acceso a la galería.</p></div>';
   document.body.appendChild(overlay);
   const video=overlay.querySelector('video'),cap=overlay.querySelector('[data-photo=capture]');
   const end=()=>{stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;overlay.remove();};
   overlay.querySelector('[data-photo=cancel]').onclick=()=>{end();reject(new Error('Fotografía cancelada.'));};
   cap.disabled=true;
   try{
     stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:800}},audio:false});
     video.srcObject=stream;await video.play();cap.disabled=false;
     cap.onclick=()=>{
       if(!video.videoWidth)return;
       const cnv=document.createElement('canvas');
       cnv.width=480;cnv.height=Math.round(480*video.videoHeight/video.videoWidth);
       const ctx=cnv.getContext('2d');
       ctx.translate(cnv.width,0);ctx.scale(-1,1);
       ctx.drawImage(video,0,0,cnv.width,cnv.height);
       const jpg=cnv.toDataURL('image/jpeg',0.62);
       end();resolve(jpg);
     };
   }catch(err){end();reject(new Error('No se pudo abrir la cámara. Revisa los permisos.'));}
 });
}
function gps(){
 return new Promise((resolve,reject)=>{
   if(!navigator.geolocation)return reject(new Error('Este dispositivo no dispone de GPS.'));
   navigator.geolocation.getCurrentPosition(pos=>{
     resolve({lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy});
   },()=>reject(new Error('No se pudo validar el GPS. Permite la ubicación y vuelve a intentar.')),
   {enableHighAccuracy:true,timeout:20000,maximumAge:0});
 });
}
async function marcar(tipo){
 if(busy||!actual||tipo!==actual.etapaPendiente)return;
 busy=true;render();
 try{
   msg('Verificando GPS y fotografía…');
   const ubicacion=await gps(),foto=actual.fotoObligatoria?await tomarFoto():null;
   msg('Validando la marcación en Firebase…');
   const result=(await sendMark({token:actual.token,tipo,dispositivoId:identifier(),gps:ubicacion,foto})).data;
   actual=null;
   msg('Marcación registrada: '+ETIQUETAS[tipo]+' a las '+result.hora+(result.sedeNombre?' · '+result.sedeNombre:'')+'. Introduce tu PIN para la siguiente marcación.','ok');
 }catch(err){msg(errorText(err),'error');}
 finally{busy=false;render();}
}
async function init(){
 $('fastDate').textContent=fecha();$('fastClock').textContent=hora();
 setInterval(()=>{$('fastDate').textContent=fecha();$('fastClock').textContent=hora();},30000);
 $('fastSearch').onclick=buscar;
 $('fastPin').addEventListener('keydown',ev=>{if(ev.key==='Enter')buscar();});
 $('fastPin').addEventListener('input',()=>{actual=null;render();});
 document.querySelectorAll('#fastButtons button[data-tipo]').forEach(btn=>btn.onclick=()=>marcar(btn.dataset.tipo));
 try{
   const reCAPTCHA=String(window.POLADENT_RECAPTCHA_ENTERPRISE_SITE_KEY||'').trim();
   if(!reCAPTCHA)throw new Error('Falta registrar POLADENT en Firebase App Check y configurar la clave pública.');
   if(!window.firebase?.apps?.length||!firebase.auth||!firebase.functions||!firebase.appCheck)
     throw new Error('No cargaron los componentes de Firebase.');
   firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(reCAPTCHA),true);
   const auth=firebase.auth();
   if(!auth.currentUser||!auth.currentUser.isAnonymous){
     if(auth.currentUser)await auth.signOut();
     await auth.signInAnonymously();
   }
   const fn=firebase.app().functions('us-central1');
   fetchEmployee=fn.httpsCallable('poladentBuscarFuncionario');
   sendMark=fn.httpsCallable('poladentMarcarAsistencia');
   msg('Sistema seguro listo. Escribe tu PIN y pulsa Buscar.','ok');
 }catch(err){msg(err.message||'No se pudo preparar el sistema seguro.','error');}
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();