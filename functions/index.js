'use strict';
/* Backend de migracion SEGURA. NO desplegar hasta tener copia completa,
   custom claims del administrador y cliente empleado migrado y probado.
   No contiene llamadas de borrado a historiales. */
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase,ServerValue}=require('firebase-admin/database');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {ETAPAS,fechaCaracas,siguienteEtapa,validarGPS,fotoNecesaria,limpiarFoto,dispositivoValido}=require('./lib/core');
initializeApp();
const db=()=>getDatabase();
const settings={region:'us-central1',enforceAppCheck:true,maxInstances:20,memory:'512MiB',timeoutSeconds:60};
const hash=text=>createHash('sha256').update(text).digest('hex');
const error=(status,message)=>new HttpsError(status,message);
function sesion(request){
 if(!request.auth?.uid)throw error('unauthenticated','Debes iniciar una sesión Firebase.');
 return request.auth.uid;
}
function inputDevice(id){
 if(!dispositivoValido(id))throw error('invalid-argument','Identificador de dispositivo inválido.');
 return id;
}
function safePIN(pin){
 const p=String(pin||'').trim();
 if(!/^\d{1,20}$/.test(p))throw error('invalid-argument','Código inválido.');
 return p;
}
async function limiter(uid){
 // Controles en servidor: no dependen de localStorage y no admiten reset desde el navegador.
 // No es un mecanismo perfecto contra usuarios anónimos que crean cuentas nuevas.
 const ref=db().ref('_seguridad_intentos_pin/'+hash(uid));
 const now=Date.now(),period=5*60*1000;
 const tx=await ref.transaction(old=>{
   const count=old&&Number(old.inicio)>now-period?Number(old.intentos||0):0;
   const inicio=old&&Number(old.inicio)>now-period?old.inicio:now;
   return {inicio,intentos:count+1,ultimo:now};
 },undefined,false);
 if(!tx.committed||tx.snapshot.val().intentos>8)throw error('resource-exhausted','Demasiados intentos. Vuelve a intentarlo más tarde.');
}
async function employeeByPIN(pin){
 const s=await db().ref('empleados').orderByChild('pin').equalTo(pin).limitToFirst(2).once('value');
 let result=null,count=0;
 s.forEach(child=>{
   const e=child.val()||{};
   if(e.archivado!==true&&e.activo!==false){result={id:child.key,...e};count++;}
 });
 if(count!==1)return null; // Impide vinculación ambigua de PIN duplicados.
 return result;
}
function gpsError(e){
 return /GPS_/.test(String(e?.message))?error('failed-precondition','Ubicación o local no autorizados. Verifica GPS y tu sede.'):e;
}
async function guardarSolicitud(e,uid,device,tipo){
 const requestRef=db().ref('solicitudes_dispositivo/'+e.id+'/'+device);
 const existing=(await requestRef.once('value')).val();
 if(existing?.estado==='pendiente'&&existing?.authUid===uid)return;
 await requestRef.set({
   empleadoId:e.id,empleado:e.nombre||'Funcionario',dispositivoId:device,authUid:uid,
   estado:'pendiente',fecha:fechaCaracas(),solicitadoEn:ServerValue.TIMESTAMP,
   tipoMarcacion:tipo||'entrada'
 });
}
async function estadoDispositivo(e,uid,device,cfg){
 const s=(await db().ref('dispositivos_empleados/'+e.id).once('value')).val()||{};
 const autorizado=s.activo!==false&&s.authUid===uid&&s.dispositivoId===device;
 if(!autorizado&&cfg.registroDispositivoPreparacion!==false)await guardarSolicitud(e,uid,device,'entrada');
 return {autorizado,obligatorio:cfg.registroDispositivoObligatorio===true};
}
async function config(){
 const [gps,seg]=await Promise.all([
   db().ref('configuracion_gps_v51').once('value'),
   db().ref('configuracion_seguridad_asistencia').once('value')
 ]);
 return {gps:{activo:true,precisionMaxima:120,sedes:{},...(gps.val()||{})},
   seg:{activo:true,fotoEntrada:true,fotoSalida:true,
      registroDispositivoObligatorio:false,bloquearDispositivoJornada:true,...(seg.val()||{})}};
}
async function ticketValido(uid,token,device){
 if(typeof token!=='string'||!/^[-_a-f0-9]{40,128}$/i.test(token))
   throw error('permission-denied','Sesión de marcación inválida.');
 const saved=(await db().ref('_sesiones_asistencia/'+uid).once('value')).val();
 if(!saved||saved.expiraEn<Date.now()||saved.dispositivoId!==device)
   throw error('permission-denied','La sesión de marcación venció. Introduce nuevamente tu PIN.');
 const incoming=Buffer.from(hash(token),'hex'),expected=Buffer.from(String(saved.tokenHash||''),'hex');
 if(expected.length!==incoming.length||!timingSafeEqual(incoming,expected))
   throw error('permission-denied','Sesión de marcación inválida.');
 return saved;
}
exports.poladentBuscarFuncionario=onCall(settings,async request=>{
 const uid=sesion(request),pin=safePIN(request.data?.pin),device=inputDevice(request.data?.dispositivoId);
 await limiter(uid);
 const employee=await employeeByPIN(pin);
 if(!employee)throw error('permission-denied','Código incorrecto. Comprueba tu PIN.');
 const cfg=await config(),fecha=fechaCaracas();
 const status=await estadoDispositivo(employee,uid,device,cfg.seg);
 const dia=(await db().ref('marcaciones/'+employee.id+'/'+fecha).once('value')).val()||{};
 const token=randomBytes(32).toString('hex');
 await db().ref('_sesiones_asistencia/'+uid).set({
   tokenHash:hash(token),empleadoId:employee.id,dispositivoId:device,
   expiraEn:Date.now()+20*60*1000,creadoEn:ServerValue.TIMESTAMP
 });
 return {
   token,fecha,etapaPendiente:siguienteEtapa(dia),
   funcionario:{id:employee.id,nombre:employee.nombre||'Empleado',
     // Solo identidad mínima tras introducir PIN correcto. No entregar pin/salario/historial.
     foto:typeof employee.foto==='string'&&employee.foto.length<500000?employee.foto:null},
   dispositivo:status,gpsObligatorio:cfg.gps.activo!==false,
   fotoObligatoria:fotoNecesaria(siguienteEtapa(dia),cfg.seg)
 };
});
exports.poladentMarcarAsistencia=onCall(settings,async request=>{
 const uid=sesion(request),data=request.data||{},device=inputDevice(data.dispositivoId);
 const tipo=data.tipo,fecha=fechaCaracas(),now=Date.now();
 if(!ETAPAS.includes(tipo))throw error('invalid-argument','Etapa desconocida.');
 const ticket=await ticketValido(uid,data.token,device);
 const eid=ticket.empleadoId;
 const [empSnapshot,allConfig]=await Promise.all([db().ref('empleados/'+eid).once('value'),config()]);
 const emp=empSnapshot.val()||{};
 if(!empSnapshot.exists()||emp.activo===false||emp.archivado===true)throw error('permission-denied','Funcionario inactivo o no encontrado.');
 const status=await estadoDispositivo({id:eid,nombre:emp.nombre},uid,device,allConfig.seg);
 if(status.obligatorio&&!status.autorizado)throw error('permission-denied','Teléfono no autorizado. Solicita aprobación al administrador.');
 let gps;try{gps=validarGPS(data.gps,allConfig.gps,emp);}catch(e){throw gpsError(e);}
 let foto;
 try{foto=limpiarFoto(data.foto,!!fotoNecesaria(tipo,allConfig.seg));}
 catch(e){throw error('failed-precondition',String(e.message).replaceAll('_',' '));}
 // Registro de dispositivo compartido con transacción atómica.
 const devRef=db().ref('dispositivos_marcacion/'+device);
 const markRef=db().ref('marcaciones/'+eid+'/'+fecha),reserva=randomBytes(12).toString('hex');
 let nuevoBloqueo=false;
 if(allConfig.seg.bloquearDispositivoJornada!==false){
   const rt=await devRef.transaction(current=>{
     if(current?.fecha===fecha){
       if(String(current.empleadoId)!==String(eid))return;
       return current;
     }
     return {empleadoId:eid,empleado:emp.nombre||'Empleado',fecha,
       timestamp:ServerValue.TIMESTAMP,tipoMarcacion:tipo,reserva};
   },undefined,false);
   if(!rt.committed)throw error('permission-denied','Este teléfono ya se utilizó hoy para otro funcionario.');
   nuevoBloqueo=rt.snapshot.val()?.reserva===reserva;
 }
 const fechaFin=new Date(fecha+'T23:59:59-04:00').getTime();
 const hora=new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(now));
 const registro={
   nombre:emp.nombre||'Empleado',tipo,fecha,hora,timestamp:now,
   lat:gps.lat,lon:gps.lon,precisionGps:Math.round(gps.accuracy),
   gpsVerificado:allConfig.gps.activo!==false,dispositivoId:device,
   evidenciaFotografica:!!foto,fotoTemporal:!!foto,
   fotoDisponible:!!foto,fotoExpiraEn:fechaFin
 };
 if(foto&&allConfig.seg.guardarEvidencia!==false)registro.fotoEvidencia=foto;
 if(gps.sede)Object.assign(registro,{
   sedeId:gps.sede.id,sedeNombre:gps.sede.nombre,sedeDireccion:gps.sede.direccion,
   distanciaSede:Math.round(gps.sede.distancia),radioPermitido:gps.sede.radio
 });
 let committed=false;
 try{
   const tx=await markRef.transaction(current=>{
     const dia=current||{};
     if(siguienteEtapa(dia)!==tipo)return;
     return {...dia,[tipo]:registro}; // Ninguna etapa ni historial anterior se pierde.
   },undefined,false);
   if(!tx.committed)throw error('already-exists','Esta etapa ya está marcada o no corresponde al orden de la jornada.');
   committed=true;
   await db().ref('_sesiones_asistencia/'+uid).transaction(current=>{
     if(current?.tokenHash!==hash(data.token))return;
     return {...current,expiraEn:0}; // Sesión de un solo uso por marcación.
   },undefined,false);
   return {ok:true,fecha,tipo,hora,etapaPendiente:siguienteEtapa(tx.snapshot.val()||{}),
     sedeNombre:gps.sede?.nombre||null};
 }finally{
   if(!committed&&nuevoBloqueo){
     // Liberar solo una reserva fallida SIN marcaciones persistidas en esa jornada.
     const marcado=(await markRef.once('value')).val()||{};
     const hayExito=Object.values(marcado).some(v=>v?.dispositivoId===device);
     if(!hayExito){
       await devRef.transaction(current=>current?.reserva===reserva?null:undefined,undefined,false);
     }
   }
 }
});