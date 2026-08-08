/* Poladent Sistema - Version 9 Enterprise Final */
(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let db=null;
const ROOT='configuracion_comercial/enterprise';
function deviceId(){let id=localStorage.getItem('poladent_device_id');if(!id){const r=window.crypto?.getRandomValues?Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>x.toString(16).padStart(2,'0')).join(''):Math.random().toString(36).slice(2);id='DEV-'+r.toUpperCase();localStorage.setItem('poladent_device_id',id)}return id}
function deviceInfo(){return{id:deviceId(),nombre:localStorage.getItem('poladent_device_name')||'Este dispositivo',navegador:navigator.userAgent.slice(0,180),plataforma:navigator.platform||'Desconocida',ultimaActividad:Date.now()}}
function fmt(ts){if(!ts)return '—';try{return new Date(ts).toLocaleString('es-VE')}catch{return '—'}}
function mount(){
 const main=$('.pc-main'),nav=$('.pc-nav'); if(!main||!nav||$('#pc-enterprise-final'))return;
 const page=document.createElement('section'); page.id='pc-enterprise-final'; page.className='pc-page'; page.innerHTML=`
 <div class="pc-page-title"><h2>Versión 9 · Enterprise Final</h2><p>Seguridad de dispositivos, accesos, notificaciones y estado final de la instalación.</p></div>
 <div class="v9-status-grid">
  <section class="pc-card v9-status"><small>INSTALACIÓN</small><h3 id="v9Install">${esc(deviceId())}</h3><span class="v9-ok">● Operativa</span></section>
  <section class="pc-card v9-status"><small>FIREBASE</small><h3 id="v9Firebase">Conectando…</h3><span id="v9Connection" class="v9-warn">● Verificando</span></section>
  <section class="pc-card v9-status"><small>VERSIÓN</small><h3>9.0 Final</h3><span class="v9-ok">● Comercial</span></section>
 </div>
 <div class="v9-grid">
  <section class="pc-card"><h3>📱 Dispositivos autorizados</h3><p class="v9-help">Registra los teléfonos, tablets o computadoras permitidos para administrar el sistema.</p>
   <div class="v9-inline"><input id="v9DeviceName" placeholder="Nombre de este dispositivo"><button id="v9Authorize">Autorizar este dispositivo</button></div>
   <div id="v9Devices" class="v9-list"></div>
  </section>
  <section class="pc-card"><h3>🔔 Notificaciones internas</h3><div class="v9-inline"><input id="v9NoticeText" placeholder="Mensaje para el equipo"><button id="v9SendNotice">Publicar</button></div><div id="v9Notices" class="v9-list"></div></section>
 </div>
 <section class="pc-card"><div class="v9-heading"><div><h3>🔐 Registro de accesos</h3><p class="v9-help">Últimos accesos y actividad administrativa registrada por la instalación.</p></div><button id="v9ExportAccess">Exportar CSV</button></div><div id="v9Access" class="v9-table-wrap"></div></section>
 <section class="pc-card"><h3>✅ Certificación final</h3><div class="v9-checks"><span>✓ Empleados y horarios</span><span>✓ Marcaciones y correcciones</span><span>✓ GPS y sucursales</span><span>✓ Fotos temporales diarias</span><span>✓ Nómina y reportes</span><span>✓ Respaldos y auditoría</span><span>✓ Empresas y licencias</span><span>✓ Rendimiento móvil</span></div><div class="v9-final-note">La versión 9 conserva los datos actuales y no modifica <code>firebase/config.js</code>.</div></section>`;
 main.appendChild(page);
 const btn=document.createElement('button'); btn.dataset.page='pc-enterprise-final'; btn.innerHTML='<span>⭐</span>Versión 9 Final'; nav.appendChild(btn);
 btn.onclick=()=>{$$('.pc-nav button').forEach(x=>x.classList.toggle('active',x===btn));$$('.pc-page').forEach(p=>p.classList.toggle('active',p.id===page.id));window.scrollTo({top:0,behavior:'smooth'});refreshAll()};
 $('#v9Authorize').onclick=authorizeCurrent; $('#v9SendNotice').onclick=sendNotice; $('#v9ExportAccess').onclick=exportAccess;
 connect(); monitorConnection();
}
function connect(){if(!window.firebase?.apps?.length)return setTimeout(connect,250);db=firebase.database();const project=firebase.app().options.projectId||'Conectado';$('#v9Firebase').textContent=project;
 subscribe(`${ROOT}/dispositivos`,renderDevices);subscribe(`${ROOT}/notificaciones`,renderNotices);subscribe(`${ROOT}/accesos`,renderAccess);recordAccess('inicio_sesion');}
function subscribe(path,fn){if(window.PoladentData?.subscribe)window.PoladentData.subscribe(path,s=>fn(s.val()||{}));else db.ref(path).on('value',s=>fn(s.val()||{}))}
function monitorConnection(){const apply=()=>{const on=navigator.onLine,e=$('#v9Connection');if(e){e.textContent=on?'● En línea':'● Sin conexión';e.className=on?'v9-ok':'v9-danger'}};addEventListener('online',apply);addEventListener('offline',apply);apply()}
async function authorizeCurrent(){if(!db)return;const info=deviceInfo();info.nombre=$('#v9DeviceName').value.trim()||info.nombre;info.autorizado=true;info.autorizadoEn=Date.now();localStorage.setItem('poladent_device_name',info.nombre);await db.ref(`${ROOT}/dispositivos/${info.id}`).update(info);recordAccess('dispositivo_autorizado')}
async function revoke(id){if(!confirm('¿Quitar la autorización de este dispositivo?'))return;await db.ref(`${ROOT}/dispositivos/${id}`).update({autorizado:false,revocadoEn:Date.now()});recordAccess('dispositivo_revocado')}
function renderDevices(data){const box=$('#v9Devices');if(!box)return;const rows=Object.values(data).sort((a,b)=>(b.autorizadoEn||0)-(a.autorizadoEn||0));box.innerHTML=rows.length?rows.map(x=>`<article><div><b>${esc(x.nombre||x.id)}</b><small>${esc(x.id)} · ${esc(x.plataforma||'')}</small><small>Última actividad: ${fmt(x.ultimaActividad||x.autorizadoEn)}</small></div><div><span class="${x.autorizado?'v9-pill-ok':'v9-pill-off'}">${x.autorizado?'Autorizado':'Revocado'}</span>${x.autorizado&&x.id!==deviceId()?`<button class="v9-small" data-revoke="${esc(x.id)}">Revocar</button>`:''}</div></article>`).join(''):'<p class="v9-empty">Todavía no hay dispositivos autorizados.</p>';box.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=()=>revoke(b.dataset.revoke))}
async function sendNotice(){if(!db)return;const input=$('#v9NoticeText'),texto=input.value.trim();if(!texto)return;await db.ref(`${ROOT}/notificaciones`).push({texto,creadaEn:Date.now(),activa:true,autor:firebase.auth().currentUser?.email||'Administrador'});input.value='';recordAccess('notificacion_publicada')}
async function removeNotice(id){await db.ref(`${ROOT}/notificaciones/${id}`).remove()}
function renderNotices(data){const box=$('#v9Notices');if(!box)return;const rows=Object.entries(data).sort((a,b)=>(b[1].creadaEn||0)-(a[1].creadaEn||0)).slice(0,20);box.innerHTML=rows.length?rows.map(([id,x])=>`<article><div><b>${esc(x.texto)}</b><small>${fmt(x.creadaEn)} · ${esc(x.autor||'Administrador')}</small></div><button class="v9-small" data-delnotice="${esc(id)}">Eliminar</button></article>`).join(''):'<p class="v9-empty">No hay notificaciones internas.</p>';box.querySelectorAll('[data-delnotice]').forEach(b=>b.onclick=()=>removeNotice(b.dataset.delnotice))}
async function recordAccess(tipo){if(!db)return;const user=firebase.auth().currentUser;const info=deviceInfo();await db.ref(`${ROOT}/dispositivos/${info.id}`).update({ultimaActividad:Date.now(),navegador:info.navegador,plataforma:info.plataforma});await db.ref(`${ROOT}/accesos`).push({tipo,fecha:Date.now(),usuario:user?.email||user?.uid||'Administrador',dispositivo:info.id,nombreDispositivo:localStorage.getItem('poladent_device_name')||'Este dispositivo'}).catch(()=>{})}
let accessRows=[];
function renderAccess(data){const box=$('#v9Access');if(!box)return;accessRows=Object.values(data).sort((a,b)=>(b.fecha||0)-(a.fecha||0)).slice(0,100);box.innerHTML=accessRows.length?`<table class="v9-table"><thead><tr><th>Fecha</th><th>Actividad</th><th>Usuario</th><th>Dispositivo</th></tr></thead><tbody>${accessRows.map(x=>`<tr><td>${fmt(x.fecha)}</td><td>${esc((x.tipo||'actividad').replaceAll('_',' '))}</td><td>${esc(x.usuario||'—')}</td><td>${esc(x.nombreDispositivo||x.dispositivo||'—')}</td></tr>`).join('')}</tbody></table>`:'<p class="v9-empty">Aún no hay accesos registrados.</p>'}
function exportAccess(){if(!accessRows.length)return alert('No hay registros para exportar.');const q=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=['Fecha,Actividad,Usuario,Dispositivo',...accessRows.map(x=>[fmt(x.fecha),x.tipo,x.usuario,x.nombreDispositivo||x.dispositivo].map(q).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download=`accesos_poladent_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)}
function refreshAll(){if(db)recordAccess('panel_version_9_abierto')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,1200));else setTimeout(mount,1200);
})();
