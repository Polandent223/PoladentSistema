/* POLADENT - Registro de telefonos por funcionario.
   Seguridad real: se DEBEN revisar Security Rules de Firebase.
   Este panel no sustituye la autorizacion del servidor. */
(function(){
'use strict';
const $=q=>document.querySelector(q);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const db=()=>firebase.database();
let empleados={},solicitudes={},asignados={},montado=false,iniciado=false,working=false;
const getAdmin=()=>{
 const u=window.firebase?.auth?.()?.currentUser;
 if(!u||u.isAnonymous||!u.email)throw new Error('Es necesario iniciar sesion como administrador.');
 if(window.PoladentSecurity?.can&&!window.PoladentSecurity.can('seguridad'))throw new Error('Tu usuario no tiene permisos de seguridad.');
 return u;
};
function aviso(mensaje,error=false){
 const el=$('#pdeAviso');if(!el)return;
 el.textContent=mensaje;el.style.color=error?'#b91c1c':'#047857';
}
function titular(eid){return empleados[eid]?.nombre||solicitudes[eid]&&Object.values(solicitudes[eid])[0]?.empleado||eid;}
function solicitudesPendientes(){
 const out=[];Object.entries(solicitudes||{}).forEach(([eid,group])=>{
   Object.entries(group||{}).forEach(([did,req])=>{
     if(req&&req.estado==='pendiente')out.push({eid,did,...req});
   });
 });
 return out.sort((a,b)=>Number(b.solicitadoEn||0)-Number(a.solicitadoEn||0));
}
function render(){
 if(!montado)return;
 const pending=solicitudesPendientes();
 const pendingBox=$('#pdeSolicitudes');
 const approvedBox=$('#pdeAprobados');
 if(!pendingBox||!approvedBox)return;
 $('#pdePendientesN').textContent=String(pending.length);
 pendingBox.innerHTML=pending.length?pending.slice(0,100).map(r=>{
   const old=asignados[r.eid],already=Object.entries(asignados).find(([other,x])=>other!==r.eid&&x?.activo!==false&&x?.dispositivoId===r.did);
   const note=already?'⚠️ Ese navegador ya esta autorizado a '+titular(already[0]):
        old?.dispositivoId&&old.dispositivoId!==r.did?'Cambio de telefono (anterior: '+String(old.dispositivoId).slice(-8)+')':'Primer registro';
   return '<div class="sec-alert" style="padding:12px;margin-bottom:9px">'+
      '<b>'+esc(titular(r.eid))+'</b>'+
      '<span style="display:block">'+esc(note)+' · Teléfono '+esc(String(r.did).slice(-8))+'</span>'+
      '<small style="display:block">'+esc(new Date(Number(r.solicitadoEn)||Date.now()).toLocaleString('es-VE'))+'</small>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+
      '<button type="button" data-device-action="aprobar" data-eid="'+esc(r.eid)+'" data-did="'+esc(r.did)+'" '+(already?'disabled':'')+'>Autorizar</button>'+
      '<button type="button" data-device-action="rechazar" data-eid="'+esc(r.eid)+'" data-did="'+esc(r.did)+'" class="secondary">Rechazar</button></div></div>';
 }).join(''):'<p>No hay solicitudes pendientes. Los funcionarios pueden registrar su teléfono al marcar mientras el modo de preparación está activo.</p>';
 const approved=Object.entries(asignados||{}).filter(([,x])=>x?.dispositivoId&&x?.activo!==false).sort((a,b)=>titular(a[0]).localeCompare(titular(b[0])));
 approvedBox.innerHTML=approved.length?approved.map(([eid,a])=>
   '<div class="sec-alert" style="padding:10px;margin-bottom:8px"><b>'+esc(titular(eid))+'</b>'+
   '<span style="display:block">Teléfono autorizado · '+esc(String(a.dispositivoId).slice(-8))+'</span>'+
   '<button type="button" class="secondary" style="margin-top:7px" data-device-action="revocar" data-eid="'+esc(eid)+'" data-did="'+esc(a.dispositivoId)+'">Revocar / permitir cambio</button></div>'
 ).join(''):'<p>Todavía no hay dispositivos autorizados.</p>';
}
function pedirClave(accion){
 return new Promise(resolve=>{
  let admin;try{admin=getAdmin();}catch(e){aviso(e.message,true);resolve(false);return;}
  const overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML='<form style="background:white;color:#1b2639;border-radius:14px;padding:20px;width:min(440px,94vw);box-shadow:0 18px 50px #0005">'+
    '<h3>Confirmación administrativa</h3><p>'+esc(accion)+'</p><p>Comprueba la identidad de la persona antes de autorizar su teléfono.</p>'+
    '<label>Contraseña de tu cuenta<input required type="password" autocomplete="current-password" style="width:100%;padding:10px;margin:7px 0"></label>'+
    '<div class="device-modal-msg" style="color:#b91c1c" aria-live="polite"></div>'+
    '<div style="display:flex;gap:10px;margin-top:12px"><button type="submit">Confirmar</button><button type="button" class="secondary">Cancelar</button></div></form>';
  document.body.appendChild(overlay);
  const form=overlay.querySelector('form'),password=form.querySelector('input'),msg=form.querySelector('.device-modal-msg');
  const finish=ok=>{overlay.remove();resolve(ok);};
  form.querySelector('button[type="button"]').onclick=()=>finish(false);
  form.onsubmit=async event=>{
   event.preventDefault();
   const pass=password.value;password.value='';
   const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
   try{
    const credential=firebase.auth.EmailAuthProvider.credential(admin.email,pass);
    await admin.reauthenticateWithCredential(credential);
    finish(true);
   }catch(e){msg.textContent='No se pudo validar tu contraseña de administrador.';btn.disabled=false;}
  };
  password.focus();
 });
}
async function operar(accion,eid,did){
 if(working)return;
 working=true;
 try{
  const admin=getAdmin();
  const nom=titular(eid);
  const description=accion==='aprobar'?'Autorizar el teléfono '+String(did).slice(-8)+' de '+nom+' (confirma que está presente)'
  :accion==='rechazar'?'Rechazar la solicitud de '+nom
  :'Revocar el teléfono de '+nom+'; su próxima marcación requerirá nueva autorización';
  if(!await pedirClave(description))return;
  const u=getAdmin();
  const paths={},time=firebase.database.ServerValue.TIMESTAMP;
  if(accion==='aprobar'||accion==='rechazar'){
    const s=(await db().ref('solicitudes_dispositivo/'+eid+'/'+did).once('value')).val();
    if(!s||s.estado!=='pendiente')throw new Error('Esta solicitud ya no esta pendiente. Actualiza la pantalla.');
    if(accion==='aprobar'&&!s.authUid)throw new Error('Esta solicitud no tiene identificador de sesion verificable. El funcionario debe repetir su solicitud.');
    if(accion==='aprobar'){
      const list=(await db().ref('dispositivos_empleados').once('value')).val()||{};
      const duplicado=Object.entries(list).some(([id,x])=>id!==eid&&x?.activo!==false&&x?.dispositivoId===did);
      if(duplicado)throw new Error('Este teléfono ya está autorizado para otro funcionario. No se puede compartir.');
      paths['dispositivos_empleados/'+eid]={dispositivoId:did,authUid:s.authUid,empleadoId:eid,empleado:nom,activo:true,autorizadoPor:u.email,autorizadoEn:time};
    }
    paths['solicitudes_dispositivo/'+eid+'/'+did+'/estado']=accion==='aprobar'?'aprobada':'rechazada';
    paths['solicitudes_dispositivo/'+eid+'/'+did+'/revisadoEn']=time;
    paths['solicitudes_dispositivo/'+eid+'/'+did+'/revisadoPor']=u.email;
  }else if(accion==='revocar'){
    const current=(await db().ref('dispositivos_empleados/'+eid).once('value')).val()||{};
    if(current.dispositivoId!==did)throw new Error('La autorizacion de este funcionario ya cambio.');
    paths['dispositivos_empleados/'+eid]=null;
    const prior=(await db().ref('solicitudes_dispositivo/'+eid+'/'+did).once('value')).val();
    if(prior)paths['solicitudes_dispositivo/'+eid+'/'+did+'/estado']='revocada';
  }else throw new Error('Accion desconocida');
  const auditRef=db().ref('auditoria_dispositivos').push();
  paths['auditoria_dispositivos/'+auditRef.key]={accion,empleadoId:eid,empleado:nom,dispositivoId:did,administrador:u.email,fecha:time};
  await db().ref().update(paths);
  aviso(accion==='aprobar'?'Teléfono autorizado correctamente.':accion==='revocar'?'Teléfono revocado.':'Solicitud rechazada.');
 }catch(e){aviso(e.message||'No fue posible completar la operacion.',true);}
 finally{working=false;}
}
function montar(){
 if(montado)return true;
 const target=$('#secAttendancePanel');if(!target)return false;
 montado=true;
 const wrap=document.createElement('section');wrap.id='pdeGestion';
 wrap.style.cssText='margin-top:22px;border-top:1px solid #d4dfeb;padding-top:16px';
 wrap.innerHTML='<h3>📱 Registro y autorización de teléfonos</h3>'+
   '<p>Etapa de preparación: las solicitudes llegan aquí sin bloquear marcaciones por registro. Aprueba primero los teléfonos de todos los funcionarios. Después activa arriba «Exigir teléfono autorizado» y guarda la seguridad.</p>'+
   '<p><strong>Pendientes: <span id="pdePendientesN">0</span></strong></p>'+
   '<div id="pdeSolicitudes"></div>'+
   '<h4>Teléfonos autorizados</h4><div id="pdeAprobados"></div>'+
   '<p style="font-size:12px">Advertencia: borrar los datos del navegador obliga a solicitar autorización nuevamente, pero esta protección sigue dependiendo de las reglas de Firebase y de un identificador del navegador que puede manipularse. No equivale a una identidad de hardware.</p>'+
   '<div id="pdeAviso" role="status" aria-live="polite" style="margin-top:8px"></div>';
 target.appendChild(wrap);
 wrap.addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-device-action]');if(!btn)return;
  operar(btn.dataset.deviceAction,btn.dataset.eid,btn.dataset.did);
 });
 render();
 if(!iniciado){
  iniciado=true;
  const start=()=>{
    if(!window.firebase?.apps?.length||!firebase.database)return setTimeout(start,400);
    db().ref('solicitudes_dispositivo').on('value',s=>{solicitudes=s.val()||{};render();});
    db().ref('dispositivos_empleados').on('value',s=>{asignados=s.val()||{};render();});
    db().ref('empleados').on('value',s=>{empleados=s.val()||{};render();});
  };
  start();
 }
 return true;
}
function boot(){if(!montar())setTimeout(boot,600);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();