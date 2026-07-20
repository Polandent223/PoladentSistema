/* ---- módulo integrado ---- */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null, license={};
const REF='configuracion_comercial/licencia';
function today(){return new Date().toISOString().slice(0,10)}
function installId(){let id=localStorage.getItem('poladent_install_id');if(!id){id='INS-'+cryptoRandom(4)+'-'+cryptoRandom(4)+'-'+Date.now().toString(36).toUpperCase();localStorage.setItem('poladent_install_id',id)}return id}
function cryptoRandom(n){const a=new Uint8Array(n);if(window.crypto?.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<n;i++)a[i]=Math.random()*256;return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}
function statusOf(x){if(x.estado==='suspendida')return['Suspendida','danger'];if(x.estado==='inactiva')return['Inactiva','muted'];if(x.vence&&new Date(x.vence+'T23:59:59')<new Date())return['Vencida','danger'];if(!x.cliente||!x.numero)return['Sin configurar','warning'];return['Activa','ok']}
async function digest(text){if(window.crypto?.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(b)).slice(0,8).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h>>>0).toString(16).toUpperCase().padStart(16,'0')}
async function expectedCode(x){const raw=[x.numero||'',x.cliente||'',x.instalacion||installId(),x.activada||''].join('|').trim().toUpperCase();const d=await digest(raw);return `${d.slice(0,4)}-${d.slice(4,8)}-${d.slice(8,12)}-${d.slice(12,16)}`}
function mount(){const main=$('.pc-main'),config=$('#pc-settings');if(!main||!config||$('#pc-license'))return;
 const page=document.createElement('section');page.id='pc-license';page.className='pc-page';page.innerHTML=`
 <div class="pc-page-title"><h2>Licencia comercial</h2><p>Personaliza y registra esta instalación para cada empresa cliente.</p></div>
 <div class="license-grid">
  <section class="pc-card license-form">
   <h3>Datos de la licencia</h3>
   <div class="license-fields">
    <label>Empresa o cliente<input id="licClient" placeholder="Nombre legal o comercial"></label>
    <label>Número de licencia<input id="licNumber" placeholder="PLD-2026-001"></label>
    <label>Identificación fiscal<input id="licTax" placeholder="RIF, NIT o documento"></label>
    <label>Fecha de activación<input id="licStart" type="date"></label>
    <label>Fecha de vencimiento<input id="licEnd" type="date"><small>Déjalo vacío para licencia permanente.</small></label>
    <label>Estado<select id="licState"><option value="activa">Activa</option><option value="inactiva">Inactiva</option><option value="suspendida">Suspendida</option></select></label>
    <label>Correo de soporte<input id="licSupport" type="email" placeholder="soporte@empresa.com"></label>
    <label>Teléfono de soporte<input id="licPhone" placeholder="+58 000 0000000"></label>
    <label class="license-wide">Nombre visible del sistema<input id="licProduct" placeholder="Sistema de Control de Asistencia"></label>
    <label class="license-wide">Código de activación<input id="licCode" placeholder="XXXX-XXXX-XXXX-XXXX"><small>Se valida contra esta instalación.</small></label>
   </div>
   <div class="license-actions"><button id="licGenerate">🔑 Generar código</button><button id="licSave">💾 Guardar licencia</button><button id="licCertificate">📄 Certificado PDF</button></div>
   <div id="licMsg" class="license-message"></div>
  </section>
  <aside class="pc-card license-preview" id="licPreview"></aside>
 </div>
 <section class="pc-card license-info"><h3>Información de instalación</h3><div class="license-install"><span><small>ID de instalación</small><b id="licInstall"></b></span><span><small>Base de datos</small><b>Firebase conectada</b></span><span><small>Modo</small><b>Licencia comercial individual</b></span></div><p>Esta etapa no elimina ni modifica empleados, marcaciones, fotos, horarios, sucursales o historial.</p></section>`;
 main.appendChild(page);
 const nav=$('.pc-nav');const btn=document.createElement('button');btn.dataset.page='pc-license';btn.innerHTML='<span>🔐</span>Licencia';nav.appendChild(btn);
 btn.onclick=()=>{$$('.pc-nav button').forEach(x=>x.classList.toggle('active',x===btn));$$('.pc-page').forEach(p=>p.classList.toggle('active',p.id==='pc-license'));window.scrollTo({top:0,behavior:'smooth'});render()};
 $('#licInstall').textContent=installId();$('#licGenerate').onclick=generate;$('#licSave').onclick=save;$('#licCertificate').onclick=certificate;
 ['licClient','licNumber','licTax','licStart','licEnd','licState','licSupport','licPhone','licProduct','licCode'].forEach(id=>$('#'+id).addEventListener('input',previewFromForm));
 connect();
}
function connect(){if(!window.firebase?.apps?.length)return setTimeout(connect,250);db=firebase.database();window.PoladentData.subscribe(REF,s=>{license=s.val()||{};fill();render();applyBranding()})}
function getForm(){return{cliente:$('#licClient').value.trim(),numero:$('#licNumber').value.trim(),identificacion:$('#licTax').value.trim(),activada:$('#licStart').value,vence:$('#licEnd').value,estado:$('#licState').value,soporte:$('#licSupport').value.trim(),telefono:$('#licPhone').value.trim(),producto:$('#licProduct').value.trim(),codigo:$('#licCode').value.trim().toUpperCase(),instalacion:installId()}}
function fill(){const x=license;$('#licClient').value=x.cliente||'';$('#licNumber').value=x.numero||'';$('#licTax').value=x.identificacion||'';$('#licStart').value=x.activada||today();$('#licEnd').value=x.vence||'';$('#licState').value=x.estado||'activa';$('#licSupport').value=x.soporte||'';$('#licPhone').value=x.telefono||'';$('#licProduct').value=x.producto||'Sistema de Control de Asistencia';$('#licCode').value=x.codigo||''}
async function generate(){const x=getForm();if(!x.cliente||!x.numero)return msg('Primero escribe la empresa y el número de licencia.',false);$('#licCode').value=await expectedCode(x);previewFromForm();msg('Código generado para esta instalación.',true)}
async function save(){if(!db)return msg('Firebase todavía no está disponible.',false);const x=getForm();if(!x.cliente||!x.numero)return msg('Completa la empresa y el número de licencia.',false);const expected=await expectedCode(x);x.codigoValido=x.codigo===expected;x.actualizadaEn=Date.now();x.creadaEn=license.creadaEn||Date.now();await db.ref(REF).set(x);msg(x.codigoValido?'Licencia guardada y validada.':'Licencia guardada. El código no coincide con esta instalación.',x.codigoValido)}
function msg(text,ok){const e=$('#licMsg');e.textContent=text;e.className='license-message '+(ok?'ok':'warning')}
function previewFromForm(){render(getForm())}
async function render(source){if(!$('#licPreview'))return;const x=source||license||{},st=statusOf(x),valid=x.codigoValido===true;$('#licPreview').innerHTML=`<div class="license-badge ${st[1]}">${esc(st[0])}</div><img src="img/logo-poladent.png" alt="Logo"><small>LICENCIADO PARA</small><h3>${esc(x.cliente||'Empresa sin configurar')}</h3><p>${esc(x.producto||'Sistema de Control de Asistencia')}</p><dl><div><dt>Licencia</dt><dd>${esc(x.numero||'—')}</dd></div><div><dt>Activación</dt><dd>${esc(x.activada||'—')}</dd></div><div><dt>Vencimiento</dt><dd>${esc(x.vence||'Permanente')}</dd></div><div><dt>Instalación</dt><dd>${esc(x.instalacion||installId())}</dd></div></dl><div class="license-validation ${valid?'valid':'pending'}">${valid?'✓ Código validado':'Código pendiente de validación'}</div>${x.soporte||x.telefono?`<footer>Soporte: ${esc(x.soporte||'')} ${esc(x.telefono||'')}</footer>`:''}`}
function applyBranding(){if(!license.cliente)return;document.title=(license.producto||'Sistema de Control de Asistencia')+' — '+license.cliente;const footerId='commercialLicenseFooter';let f=document.getElementById(footerId);if(!f){f=document.createElement('div');f.id=footerId;f.className='commercial-license-footer';document.body.appendChild(f)}const st=statusOf(license);f.innerHTML=`Licenciado para <b>${esc(license.cliente)}</b> · ${esc(license.numero||'Sin número')} · <span class="${st[1]}">${esc(st[0])}</span>`}
function certificate(){const x=getForm(),st=statusOf(x);if(!x.cliente||!x.numero)return msg('Completa y guarda la licencia antes de generar el certificado.',false);if(!window.jspdf?.jsPDF)return msg('El generador PDF todavía no cargó.',false);const {jsPDF}=window.jspdf,doc=new jsPDF('landscape');doc.setLineWidth(1.2);doc.rect(10,10,277,190);doc.setFontSize(24);doc.text('CERTIFICADO DE LICENCIA COMERCIAL',148.5,36,{align:'center'});doc.setFontSize(13);doc.text('Se certifica que la siguiente instalación está registrada para:',148.5,54,{align:'center'});doc.setFontSize(25);doc.text(x.cliente.toUpperCase(),148.5,76,{align:'center'});doc.setFontSize(12);let y=96;[['Producto',x.producto||'Sistema de Control de Asistencia'],['Número de licencia',x.numero],['Identificación fiscal',x.identificacion||'—'],['Fecha de activación',x.activada||'—'],['Vencimiento',x.vence||'Permanente'],['Estado',st[0]],['ID de instalación',x.instalacion]].forEach(([a,b])=>{doc.text(`${a}: ${b}`,45,y);y+=12});doc.setFontSize(9);doc.text('Este certificado identifica la instalación comercial. La protección técnica del código fuente requiere controles adicionales del proveedor.',148.5,182,{align:'center'});doc.save(`Licencia_${x.numero.replace(/[^a-z0-9_-]/gi,'_')}.pdf`)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,650));else setTimeout(mount,650);
})();

