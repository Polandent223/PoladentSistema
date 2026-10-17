'use strict';
/* Requiere ONLY emulador, jamás se conecta al Firebase productivo.
   Arranque: firebase emulators:exec --only database --config firebase.staging.json
    "cd functions && npm run test:rules" --project demo-poladent-security */
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const rules=fs.readFileSync(path.resolve(__dirname,'../../security/realtime-database.after-migration.rules.json'),'utf8');
test('matriz de permisos Realtime Database después del corte (solo emulador)',async()=>{
 const env=await initializeTestEnvironment({
   projectId:'demo-poladent-security',
   database:{host:'127.0.0.1',port:9000,rules}
 });
 try{
   await env.withSecurityRulesDisabled(async ctx=>{
     await ctx.database().ref('autorizaciones_admin/admin_ok').set({activo:true});
     await ctx.database().ref('autorizaciones_admin/admin_revocado').set({activo:false});
     await ctx.database().ref('empleados/uno').set({nombre:'PRUEBA FICTICIA',pin:'1234'});
     await ctx.database().ref('marcaciones/uno/2026-01-01/entrada').set({timestamp:123456});
   });
   const guest=env.unauthenticatedContext().database();
   const anon=env.authenticatedContext('anon_1',{firebase:{sign_in_provider:'anonymous'}}).database();
   const user=env.authenticatedContext('usuario_sin_claim').database();
   const admin=env.authenticatedContext('admin_ok',{poladent_admin:true}).database();
   const suspended=env.authenticatedContext('admin_revocado',{poladent_admin:true}).database();

   await assertFails(guest.ref('empleados').once('value'));
   await assertFails(anon.ref('empleados').once('value'));
   await assertFails(anon.ref('nomina_recibos').once('value'));
   await assertFails(anon.ref('marcaciones/uno/2026-01-01/entrada').set({timestamp:0}));
   await assertFails(anon.ref('auditoria_ediciones').remove());
   await assertFails(anon.ref('dispositivos_empleados/uno').set({dispositivoId:'falso'}));
   await assertFails(user.ref('empleados').once('value'));
   await assertFails(suspended.ref('empleados').once('value'));
   await assertSucceeds(admin.ref('empleados').once('value'));
   await assertSucceeds(admin.ref('marcaciones/uno/2026-01-01/entrada').once('value'));
   await assertSucceeds(admin.ref('empleados/uno').update({nombre:'PRUEBA LEGÍTIMA'}));
   await assertFails(admin.ref('autorizaciones_admin/admin_ok').remove());
   await assertFails(admin.ref('_sesiones_asistencia/anon_1').set({tokenHash:'falso'}));
 }finally{await env.cleanup();}
});