'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fechaCaracas,siguienteEtapa,validarGPS,fotoNecesaria,limpiarFoto,dispositivoValido}=require('../lib/core');

test('usa fecha de Venezuela, no la zona del navegador',()=>{
 const d=new Date('2026-10-18T02:30:00Z');
 assert.equal(fechaCaracas(d),'2026-10-17');
});
test('respeta entrada, almuerzo, regreso y salida existentes',()=>{
 let dia={};assert.equal(siguienteEtapa(dia),'entrada');
 dia={entrada:{tipo:'entrada'}};assert.equal(siguienteEtapa(dia),'almuerzo_salida');
 dia.almuerzo_salida={tipo:'almuerzo_salida'};assert.equal(siguienteEtapa(dia),'almuerzo_regreso');
 dia.almuerzo_regreso={tipo:'almuerzo_regreso'};assert.equal(siguienteEtapa(dia),'salida');
 dia.salida={tipo:'salida'};assert.equal(siguienteEtapa(dia),null);
});
test('conserva marcaciones históricas con clave legacy',()=>{
 assert.equal(siguienteEtapa({abc:{tipo:'entrada'}}),'almuerzo_salida');
});
test('deniega ubicación inválida y fuera de geocerca',()=>{
 const cfg={activo:true,precisionMaxima:120,sedes:{principal:{nombre:'Principal',lat:10,lon:-67,radio:100,activo:true}}};
 const e={sedesPermitidas:{principal:true}};
 assert.equal(validarGPS({lat:10,lon:-67,accuracy:12},cfg,e).sede.id,'principal');
 assert.throws(()=>validarGPS({lat:11,lon:-67,accuracy:12},cfg,e),/GPS_FUERA_AREA/);
 assert.throws(()=>validarGPS({lat:10,lon:-67,accuracy:300},cfg,e),/GPS_PRECISION/);
 assert.throws(()=>validarGPS({lat:10,lon:-67,accuracy:12},cfg,{sedesPermitidas:{}}),/GPS_SIN_SEDE/);
});
test('entrada y salida exigen foto según configuración',()=>{
 assert.equal(fotoNecesaria('entrada',{}),true);
 assert.equal(fotoNecesaria('salida',{}),true);
 assert.equal(fotoNecesaria('almuerzo_salida',{}),false);
 assert.throws(()=>limpiarFoto(null,true),/FOTO_OBLIGATORIA/);
 assert.equal(limpiarFoto('data:image/jpeg;base64,AA==',true),'data:image/jpeg;base64,AA==');
 assert.throws(()=>limpiarFoto('data:image/png;base64,AA==',true),/FOTO_INVALIDA/);
});
test('identificador de dispositivo válido',()=>{
 assert.equal(dispositivoValido('a9a8-93LZA2'),true);
 assert.equal(dispositivoValido('../malicioso'),false);
 assert.equal(dispositivoValido('x'),false);
});
