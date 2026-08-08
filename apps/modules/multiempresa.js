/* ---- módulo integrado ---- */
(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null, company={};
const REF='configuracion_comercial/empresa';
const REQUIRED=['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId'];
function mount(){
 const main=$('.pc-main'), nav=$('.pc-nav');
 if(!main||!nav||$('#pc-companies')) return;
 const page=document.createElement('section');
 page.id='pc-companies'; page.className='pc-page';
 page.innerHTML=`
 <div class="pc-page-title"><h2>Empresas e instalaciones</h2><p>Prepara una copia independiente del sistema para cada cliente, sin mezclar empleados ni historiales.</p></div>
 <section class="pc-card company-current">
  <div><small>INSTALACIÓN ACTUAL</small><h3 id="coCurrentName">Empresa actual</h3><p>Proyecto Firebase: <b id="coCurrentProject">Detectando…</b></p></div>
  <span class="company-isolated">Base independiente</span>
 </section>
 <div class="company-grid">
  <section class="pc-card">
   <h3>1. Identidad de la empresa</h3>
   <div class="company-fields">
    <label>Nombre comercial<input id="coName" placeholder="Clínica ABC"></label>
    <label>Razón social<input id="coLegal" placeholder="Clínica ABC, C.A."></label>
    <label>RIF / identificación<input id="coTax" placeholder="J-00000000-0"></label>
    <label>Nombre del sistema<input id="coProduct" placeholder="Control de Asistencia"></label>
    <label>Correo de soporte<input id="coEmail" type="email" placeholder="soporte@empresa.com"></label>
    <label>Teléfono<input id="coPhone" placeholder="+58 000 0000000"></label>
    <label>Color institucional<input id="coColor" type="color" value="#1769aa"></label>
    <label>Nombre de sede inicial<input id="coBranch" placeholder="Sede principal"></label>
    <label class="company-wide">URL del logo (opcional)<input id="coLogo" placeholder="img/logo-cliente.png"><small>También puedes reemplazar manualmente las imágenes dentro de la carpeta img.</small></label>
   </div>
   <div class="company-actions"><button id="coSave">💾 Guardar identidad actual</button><button id="coProfile">⬇️ Descargar perfil</button></div>
   <div id="coMsg" class="company-message"></div>
  </section>
  <section class="pc-card">
   <h3>2. Firebase del nuevo cliente</h3>
   <p class="company-help">Crea un proyecto Firebase nuevo para cada empresa y pega aquí su configuración web. El sistema no cambiará la base actual.</p>
   <div class="company-fields firebase-fields">
    <label>apiKey<input id="fbApiKey"></label>
    <label>authDomain<input id="fbAuthDomain" placeholder="cliente.firebaseapp.com"></label>
    <label>databaseURL<input id="fbDatabaseURL" placeholder="https://cliente-default-rtdb.firebaseio.com"></label>
    <label>projectId<input id="fbProjectId" placeholder="cliente-asistencia"></label>
    <label>storageBucket<input id="fbStorageBucket" placeholder="cliente.firebasestorage.app"></label>
    <label>messagingSenderId<input id="fbSender"></label>
    <label class="company-wide">appId<input id="fbAppId"></label>
   </div>
   <div class="company-actions"><button id="coValidate">✓ Validar datos</button><button id="coConfig">⬇️ Descargar config.js</button><button id="coKit">📦 Generar kit del cliente</button></div>
   <div id="fbMsg" class="company-message"></div>
  </section>
 </div>
 <section class="pc-card company-process">
  <h3>Proceso recomendado para vender una copia</h3>
  <ol><li>Duplica el repositorio base para el cliente.</li><li>Crea un proyecto Firebase exclusivo para esa empresa.</li><li>Reemplaza únicamente <code>firebase/config.js</code> por el archivo generado aquí.</li><li>Cambia logo, nombre, licencia y sucursales desde el administrador.</li><li>Prueba acceso, marcación, GPS, cámara y reportes antes de entregar.</li></ol>
  <div class="company-warning"><b>Importante:</b> no uses el Firebase de Poladent para otra empresa. Separar las bases impide que los datos de clientes diferentes se mezclen.</div>
 </section>
 <section class="pc-card company-summary">
  <h3>Qué queda separado por empresa</h3>
  <div><span>👥 Empleados</span><span>🕒 Marcaciones</span><span>📍 Sucursales y GPS</span><span>📷 Evidencias</span><span>💰 Nómina</span><span>📊 Reportes</span><span>🔐 Licencia</span></div>
 </section>`;
 main.appendChild(page);
 const btn=document.createElement('button'); btn.dataset.page='pc-companies'; btn.innerHTML='<span>🏢</span>Empresas'; nav.appendChild(btn);
 btn.onclick=()=>{$$('.pc-nav button').forEach(x=>x.classList.toggle('active',x===btn));$$('.pc-page').forEach(p=>p.classList.toggle('active',p.id==='pc-companies'));window.scrollTo({top:0,behavior:'smooth'});renderCurrent()};
 $('#coSave').onclick=saveCompany; $('#coProfile').onclick=downloadProfile; $('#coValidate').onclick=validateFirebase;
 $('#coConfig').onclick=downloadConfig; $('#coKit').onclick=downloadKit;
 ['coName','coLegal','coTax','coProduct','coEmail','coPhone','coColor','coBranch','coLogo'].forEach(id=>$('#'+id).addEventListener('input',applyPreview));
 connect(); renderCurrent();
}
function connect(){if(!window.firebase?.apps?.length)return setTimeout(connect,250);db=firebase.database();window.PoladentData.subscribe(REF,s=>{company=s.val()||{};fill();applyBranding();renderCurrent()})}
function renderCurrent(){const opts=window.firebase?.apps?.[0]?.options||{};$('#coCurrentProject')&&($('#coCurrentProject').textContent=opts.projectId||'No detectado');$('#coCurrentName')&&($('#coCurrentName').textContent=company.nombre||'Poladent Casa Dental')}
function getCompany(){return{nombre:$('#coName').value.trim(),razonSocial:$('#coLegal').value.trim(),identificacion:$('#coTax').value.trim(),producto:$('#coProduct').value.trim(),correo:$('#coEmail').value.trim(),telefono:$('#coPhone').value.trim(),color:$('#coColor').value,sedInicial:$('#coBranch').value.trim(),logo:$('#coLogo').value.trim(),actualizadaEn:Date.now()}}
function fill(){const x=company;$('#coName').value=x.nombre||'';$('#coLegal').value=x.razonSocial||'';$('#coTax').value=x.identificacion||'';$('#coProduct').value=x.producto||'Sistema de Control de Asistencia';$('#coEmail').value=x.correo||'';$('#coPhone').value=x.telefono||'';$('#coColor').value=x.color||'#1769aa';$('#coBranch').value=x.sedInicial||'';$('#coLogo').value=x.logo||''}
async function saveCompany(){if(!db)return show('coMsg','Firebase todavía no está disponible.',false);const x=getCompany();if(!x.nombre)return show('coMsg','Escribe el nombre de la empresa.',false);x.creadaEn=company.creadaEn||Date.now();await db.ref(REF).set(x);show('coMsg','Identidad comercial guardada sin modificar empleados ni historial.',true)}
function applyPreview(){const x=getCompany();if(x.color)document.documentElement.style.setProperty('--company-accent',x.color)}
function applyBranding(){if(!company.nombre)return;document.title=(company.producto||'Control de Asistencia')+' — '+company.nombre;document.documentElement.style.setProperty('--company-accent',company.color||'#1769aa')}
function getFirebase(){return{apiKey:$('#fbApiKey').value.trim(),authDomain:$('#fbAuthDomain').value.trim(),databaseURL:$('#fbDatabaseURL').value.trim(),projectId:$('#fbProjectId').value.trim(),storageBucket:$('#fbStorageBucket').value.trim(),messagingSenderId:$('#fbSender').value.trim(),appId:$('#fbAppId').value.trim()}}
function firebaseErrors(x){const e=[];REQUIRED.forEach(k=>{if(!x[k])e.push(`Falta ${k}`)});if(x.databaseURL&&!/^https:\/\//i.test(x.databaseURL))e.push('databaseURL debe comenzar con https://');if(x.authDomain&& !x.authDomain.includes('.'))e.push('authDomain no parece válido');return e}
function validateFirebase(){const e=firebaseErrors(getFirebase());show('fbMsg',e.length?e.join(' · '):'Configuración completa. Ya puedes descargar el archivo del nuevo cliente.',!e.length);return !e.length}
function configText(x){return `const firebaseConfig = {\n  apiKey: ${JSON.stringify(x.apiKey)},\n  authDomain: ${JSON.stringify(x.authDomain)},\n  databaseURL: ${JSON.stringify(x.databaseURL)},\n  projectId: ${JSON.stringify(x.projectId)},\n  storageBucket: ${JSON.stringify(x.storageBucket)},\n  messagingSenderId: ${JSON.stringify(x.messagingSenderId)},\n  appId: ${JSON.stringify(x.appId)}\n};\n\nfirebase.initializeApp(firebaseConfig);\nconst auth = firebase.auth(), db = firebase.database();\n`}
function downloadConfig(){const x=getFirebase();if(!validateFirebase())return;downloadBlob('config.js',configText(x),'text/javascript;charset=utf-8');show('fbMsg','config.js descargado. Colócalo dentro de firebase/ en la copia del cliente.',true)}
function downloadProfile(){const x=getCompany();if(!x.nombre)return show('coMsg','Escribe primero el nombre de la empresa.',false);downloadBlob(`perfil_${safe(x.nombre)}.json`,JSON.stringify(x,null,2),'application/json');show('coMsg','Perfil comercial descargado.',true)}
async function downloadKit(){const fb=getFirebase(),co=getCompany();if(!validateFirebase())return;if(!co.nombre)return show('fbMsg','Completa también el nombre de la nueva empresa.',false);if(!window.JSZip)return show('fbMsg','El generador de ZIP todavía no cargó.',false);const zip=new JSZip();zip.file('firebase/config.js',configText(fb));zip.file('configuracion-empresa.json',JSON.stringify(co,null,2));zip.file('LEEME_INSTALACION.txt',`KIT PARA NUEVA EMPRESA\n\nCliente: ${co.nombre}\nProyecto Firebase: ${fb.projectId}\n\n1. Haz una copia completa del sistema base.\n2. Reemplaza firebase/config.js por el archivo incluido en este kit.\n3. Sube el logo del cliente dentro de img y actualiza la identidad desde el administrador.\n4. Configura reglas, Authentication y Realtime Database en el Firebase nuevo.\n5. Prueba marcación, GPS, cámara, reportes y nómina.\n\nNo conectes esta copia al Firebase de Poladent. Cada empresa debe tener su propia base.\n`);const blob=await zip.generateAsync({type:'blob'});downloadBlob(`KIT_${safe(co.nombre)}.zip`,blob,'application/zip');show('fbMsg','Kit generado. Aplícalo sobre una copia del sistema base.',true)}
function downloadBlob(name,data,type){const blob=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function safe(v){return String(v||'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'empresa'}
function show(id,text,ok){const e=$('#'+id);if(!e)return;e.textContent=text;e.className='company-message '+(ok?'ok':'warning')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,850));else setTimeout(mount,850);
})();

