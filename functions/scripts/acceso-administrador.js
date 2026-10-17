'use strict';
/* Ejecución MANUAL por operador de Firebase con credenciales de servicio.
   Nunca requiere editar, resetear o borrar marcaciones, nóminas ni auditorías.
   Antes de conceder rol: comprobar personalmente UID, correo y titular. */
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase,ServerValue}=require('firebase-admin/database');
const [accion,uid,email,confirmacion]=process.argv.slice(2);
if(!['conceder','revocar'].includes(accion)||!uid||!email||confirmacion!=='CONFIRMO'){
 console.error('Uso: node scripts/acceso-administrador.js conceder|revocar UID correo@dominio CONFIRMO');
 process.exit(2);
}
if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid)||!/^\S+@\S+\.\S+$/.test(email))throw Error('Datos de identidad inválidos.');
const PROJECT='poladent-5fa13',DB='https://poladent-5fa13-default-rtdb.firebaseio.com';
initializeApp({credential:applicationDefault(),projectId:PROJECT,databaseURL:DB});
(async()=>{
 const user=await getAuth().getUser(uid);
 if(user.email?.toLowerCase()!==email.toLowerCase())
   throw Error('El correo introducido no corresponde al UID en Firebase Authentication.');
 if(accion==='conceder'&&user.disabled)throw Error('La cuenta está desactivada.');
 const root=getDatabase().ref(),ref=root.child('autorizaciones_admin/'+uid);
 const claims={...(user.customClaims||{})};
 if(accion==='conceder')claims.poladent_admin=true;
 else delete claims.poladent_admin;
 if(accion==='revocar'){
   // Bloqueo inmediato en reglas; el claim almacenado en el token puede tardar en renovarse.
   await ref.update({activo:false,revocadoEn:ServerValue.TIMESTAMP});
   await getAuth().setCustomUserClaims(uid,claims);
 }else{
   await getAuth().setCustomUserClaims(uid,claims);
   await ref.update({activo:true,email:user.email,uid,concedidoEn:ServerValue.TIMESTAMP});
 }
 const stamp=root.child('auditoria_seguridad_config').push();
 await stamp.set({accion:'admin_'+accion,uid,email:user.email,fecha:ServerValue.TIMESTAMP,origen:'operacion_manual_verificada'});
 console.log('Acceso administrativo actualizado. Confirma en Firebase Console, sin divulgar credenciales.');
})().catch(err=>{console.error('No se completó la acción:',err.message);process.exitCode=1;});
