'use strict';
// Motor puro del futuro backend: no lee, modifica ni borra datos de Firebase.
const ETAPAS=['entrada','almuerzo_salida','almuerzo_regreso','salida'];
const TZ='America/Caracas';
function fechaCaracas(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=k=>parts.find(p=>p.type===k).value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
function siguienteEtapa(marcaciones){
  const presentes=new Set();
  Object.entries(marcaciones||{}).forEach(([k,v])=>{
    if(ETAPAS.includes(k)&&v)presentes.add(k);
    if(v&&typeof v==='object'&&ETAPAS.includes(v.tipo))presentes.add(v.tipo);
  });
  return ETAPAS.find(x=>!presentes.has(x))||null;
}
function distanciaMetros(lat1,lon1,lat2,lon2){
  const rad=x=>x*Math.PI/180,R=6371000,dlat=rad(lat2-lat1),dlon=rad(lon2-lon1);
  const a=Math.sin(dlat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function coord(value,min,max){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
function validarGPS(raw,config,empleado){
  const lat=coord(raw?.lat,-90,90),lon=coord(raw?.lon,-180,180),accuracy=coord(raw?.accuracy,0,10000);
  if(lat===null||lon===null||accuracy===null)throw new Error('GPS_INVALIDO');
  if(config?.activo===false)return {lat,lon,accuracy,sede:null,distancia:null};
  if(accuracy>Number(config?.precisionMaxima||120))throw new Error('GPS_PRECISION');
  const sedes=Object.entries(config?.sedes||{}).filter(([id,s])=>s&&s.activo!==false&&empleado?.sedesPermitidas?.[id]&&coord(s.lat,-90,90)!==null&&coord(s.lon,-180,180)!==null);
  if(!sedes.length)throw new Error('GPS_SIN_SEDE');
  const medidas=sedes.map(([id,s])=>({id,nombre:s.nombre||'Sede',direccion:s.direccion||'',radio:Number(s.radio||config?.radioDefault||80),distancia:distanciaMetros(lat,lon,Number(s.lat),Number(s.lon))})).sort((a,b)=>a.distancia-b.distancia);
  const sede=medidas[0];
  if(sede.distancia>Math.max(5,sede.radio))throw new Error('GPS_FUERA_AREA');
  return {lat,lon,accuracy,sede,distancia:sede.distancia};
}
function fotoNecesaria(tipo,cfg){
  if(cfg?.activo===false)return false;
  return {entrada:cfg?.fotoEntrada!==false,almuerzo_salida:!!cfg?.fotoAlmuerzoSalida,almuerzo_regreso:!!cfg?.fotoAlmuerzoRegreso,salida:cfg?.fotoSalida!==false}[tipo]||false;
}
function limpiarFoto(foto,obligatoria){
  if(!foto){if(obligatoria)throw new Error('FOTO_OBLIGATORIA');return null;}
  if(typeof foto!=='string'||foto.length>850000||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(foto))throw new Error('FOTO_INVALIDA');
  return foto;
}
function dispositivoValido(id){return typeof id==='string'&&id.length<=128&&/^[A-Za-z0-9_-]{8,128}$/.test(id);}
module.exports={ETAPAS,TZ,fechaCaracas,siguienteEtapa,validarGPS,fotoNecesaria,limpiarFoto,dispositivoValido,distanciaMetros};