/* POLADENT FASE 19 - Usuarios con acceso individual */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleKey=email=>String(email||'').trim().toLowerCase().replace(/[.#$\[\]]/g,'_');
let users={}, roles={};
function db(){return window.firebase?.apps?.length?firebase.database():null}
function auth(){return window.firebase?.apps?.length?firebase.auth():null}
function status(msg,ok=true){const n=$('#uaStatus');if(!n)return;n.textContent=msg;n.className='ua-status '+(ok?'ok':'bad');n.hidden=false;clearTimeout(status.t);status.t=setTimeout(()=>n.hidden=true,6000)}
async function reauth(password){
 const u=auth()?.currentUser;
 if(!u||u.isAnonymous||!u.email)throw new Error('No hay una sesión administrativa válida.');
 const cred=firebase.auth.EmailAuthProvider.credential(u.email,password);
 await u.reauthenticateWithCredential(cred);
 return u;
}
function allRoles(){
 const built={administrador:{nombre:'Administrador',activo:true},gerente:{nombre:'Gerente',activo:true},empleado:{nombre:'Empleado',activo:true}};
 return {...built,...roles};
}
function mount(){
 const host=$('#rpRoot'); if(!host||$('#uaRoot'))return;
 const sec=document.createElement('section');sec.id='uaRoot';sec.className='ua-root';
 sec.innerHTML=`
 <div class="ua-head"><div><h3>👤 Usuarios con acceso individual</h3><p>Cada persona entra con su propio correo y contraseña. El rol determina qué puede ver.</p></div></div>
 <div id="uaStatus" class="ua-status" hidden></div>
 <div class="ua-grid">
   <label>Nombre<input id="uaName" placeholder="Ej. María Pérez"></label>
   <label>Correo<input id="uaEmail" type="email" autocomplete="off" placeholder="usuario@empresa.com"></label>
   <label>Rol<select id="uaRole"></select></label>
   <label>Tu clave de administrador<input id="uaAdminPass" type="password" autocomplete="current-password" placeholder="Confirma tu clave"></label>
 </div>
 <div class="ua-actions">
   <button id="uaCreate">Crear acceso y enviar enlace de contraseña</button>
   <button id="uaClear" class="secondary">Limpiar</button>
 </div>
 <p class="ua-note">La contraseña personal no se muestra ni se guarda en Poladent. Firebase gestiona la contraseña.</p>
 <div id="uaList" class="ua-list"></div>`;
 host.insertBefore(sec,host.children[1]||null);
 bind();render();subscribe();
}
function render(){
 const rs=allRoles();
 const sel=$('#uaRole');
 if(sel){const cur=sel.value;sel.innerHTML=Object.entries(rs).filter(([,r])=>r.activo!==false).map(([k,r])=>`<option value="${esc(k)}">${esc(r.nombre||k)}</option>`).join('');if(cur&&rs[cur])sel.value=cur}
 const list=$('#uaList');if(!list)return;
 const entries=Object.entries(users);
 list.innerHTML=entries.length?entries.sort((a,b)=>String(a[1]?.nombre||a[1]?.email||'').localeCompare(String(b[1]?.nombre||b[1]?.email||''))).map(([k,u])=>`
 <div class="ua-item ${u.activo===false?'off':''}">
   <div><b>${esc(u.nombre||u.email||k)}</b><small>${esc(u.email||'')} · ${esc(rs[u.rol]?.nombre||u.rol||'Sin rol')} · ${u.activo===false?'Acceso desactivado':'Activo'}</small></div>
   <div class="ua-item-actions">
     <button data-ua-reset="${esc(k)}" class="secondary">Enviar cambio de contraseña</button>
     <button data-ua-toggle="${esc(k)}" class="${u.activo===false?'':'danger'}">${u.activo===false?'Activar':'Desactivar'}</button>
   </div>
 </div>`).join(''):'<p>No hay usuarios adicionales registrados todavía.</p>';
}
function bind(){
 $('#uaCreate').onclick=createAccess;
 $('#uaClear').onclick=()=>{['#uaName','#uaEmail','#uaAdminPass'].forEach(s=>$(s).value='');$('#uaRole').value='empleado'};
 $('#uaList').onclick=e=>{
   const r=e.target.closest('[data-ua-reset]'),t=e.target.closest('[data-ua-toggle]');
   if(r)sendReset(r.dataset.uaReset);
   if(t)toggleAccess(t.dataset.uaToggle);
 };
}
function randomPassword(){
 const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
 let s='Tmp!';const arr=new Uint32Array(20);crypto.getRandomValues(arr);for(const n of arr)s+=a[n%a.length];return s;
}
function secondaryAuth(){
 let app;
 try{app=firebase.app('poladentUserProvisioning')}catch(_){app=firebase.initializeApp(firebase.app().options,'poladentUserProvisioning')}
 return app.auth();
}
async function createAccess(){
 const name=$('#uaName').value.trim(),email=$('#uaEmail').value.trim().toLowerCase(),rol=$('#uaRole').value,password=$('#uaAdminPass').value;
 if(!name||!email||!rol)return status('Completa nombre, correo y rol.',false);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return status('El correo no parece válido.',false);
 if(!password)return status('Escribe tu clave de administrador para autorizar esta acción.',false);
 if(!window.PoladentSecurity?.can?.('configuracion'))return status('Tu rol no puede crear usuarios.',false);
 const btn=$('#uaCreate');btn.disabled=true;btn.textContent='Creando acceso…';
 try{
   const admin=await reauth(password);
   const sa=secondaryAuth();let uid=null,created=false;
   try{
     const cred=await sa.createUserWithEmailAndPassword(email,randomPassword());uid=cred.user?.uid||null;created=true;
     try{await sa.signOut()}catch(_){}
   }catch(e){
     if(e?.code!=='auth/email-already-in-use')throw e;
     try{await sa.signOut()}catch(_){}
   }
   const k=roleKey(email),now=Date.now(),updates={};
   updates[`roles_v44/${k}`]={email,rol,actualizado:now};
   updates[`usuarios_admin/${k}`]={email,nombre:name,rol,activo:true,uid:uid||users[k]?.uid||null,creado:users[k]?.creado||now,actualizado:now,creadoPor:admin.email||admin.uid};
   updates[`auditoria_usuarios/${now}`]={accion:created?'crear_acceso':'actualizar_acceso',email,nombre:name,rol,administrador:admin.email||admin.uid,fecha:now};
   await db().ref().update(updates);
   await sa.sendPasswordResetEmail(email);
   $('#uaAdminPass').value='';
   status(created?'✅ Usuario creado. Firebase envió un correo para que establezca su propia contraseña.':'✅ El correo ya existía. Se actualizó el rol y se envió un enlace para cambiar su contraseña.');
 }catch(e){
   const msg=e?.code==='auth/wrong-password'||e?.code==='auth/invalid-credential'?'Tu clave de administrador es incorrecta.':
     e?.code==='auth/operation-not-allowed'?'Firebase Email/Password no está habilitado en Authentication.':
     e?.code==='auth/too-many-requests'?'Firebase bloqueó temporalmente demasiados intentos. Intenta más tarde.':
     (e?.message||'No se pudo crear el acceso.');
   status('❌ '+msg,false);
 }finally{btn.disabled=false;btn.textContent='Crear acceso y enviar enlace de contraseña'}
}
async function sendReset(k){
 const u=users[k];if(!u?.email)return;
 try{await firebase.auth().sendPasswordResetEmail(u.email);status(`✅ Enlace enviado a ${u.email}.`)}
 catch(e){status('❌ No se pudo enviar el enlace: '+(e.message||e.code),false)}
}

function askAdminPassword(title){
 return new Promise(resolve=>{
   const old=$('#uaAuthModal');if(old)old.remove();
   const wrap=document.createElement('div');wrap.id='uaAuthModal';wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:#0007;display:grid;place-items:center;padding:18px';
   wrap.innerHTML=`<div style="width:min(92vw,420px);background:#fff;border-radius:16px;padding:18px;box-shadow:0 18px 60px #0005"><h3>${esc(title)}</h3><p>Confirma TU contraseña de administrador.</p><input id="uaAuthPass" type="password" autocomplete="current-password" style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:10px"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button id="uaAuthCancel" class="secondary">Cancelar</button><button id="uaAuthOk">Autorizar</button></div></div>`;
   document.body.appendChild(wrap);const inp=$('#uaAuthPass');inp.focus();
   const done=v=>{wrap.remove();resolve(v)};
   $('#uaAuthCancel').onclick=()=>done(null);$('#uaAuthOk').onclick=()=>done(inp.value||null);
   inp.onkeydown=e=>{if(e.key==='Enter')done(inp.value||null);if(e.key==='Escape')done(null)};
 });
}

async function toggleAccess(k){
 const u=users[k];if(!u)return;
 const next=u.activo===false;
 const password=await askAdminPassword(`${next?'Activar':'Desactivar'} acceso de ${u.email}`);
 if(!password)return;
 try{
   const admin=await reauth(password);const now=Date.now();
   const updates={};
   updates[`usuarios_admin/${k}/activo`]=next;
   updates[`usuarios_admin/${k}/actualizado`]=now;
   updates[`auditoria_usuarios/${now}`]={accion:next?'activar_acceso':'desactivar_acceso',email:u.email,rol:u.rol||'',administrador:admin.email||admin.uid,fecha:now};
   await db().ref().update(updates);
   status(next?'✅ Acceso activado.':'✅ Acceso desactivado. La cuenta y el historial no fueron borrados.');
 }catch(e){status('❌ No autorizado: '+(e?.code==='auth/invalid-credential'?'clave incorrecta.':e.message),false)}
}
function subscribe(){
 if(!db())return setTimeout(subscribe,400);
 const sub=(path,fn)=>window.PoladentData?.subscribe?window.PoladentData.subscribe(path,fn):db().ref(path).on('value',fn);
 sub('usuarios_admin',s=>{users=s.val()||{};render()});
 sub('catalogo_roles_v45',s=>{roles=s.val()||{};render()});
}
document.addEventListener('poladent:route',e=>{if(e.detail?.route==='empleados-roles')setTimeout(mount,40)});
function bindForgot(){
 const b=$('#forgotAdminPass');if(!b||b.dataset.bound)return;b.dataset.bound='1';
 b.onclick=async()=>{const email=$('#adminEmail')?.value?.trim()?.toLowerCase();if(!email)return alert('Escribe primero tu correo.');try{await firebase.auth().sendPasswordResetEmail(email);alert('Te enviamos un correo para cambiar tu contraseña. Revisa también Spam/Correo no deseado.')}catch(e){alert('No se pudo enviar el correo de recuperación. Verifica el correo o intenta nuevamente.')}}
}
function boot(){bindForgot();if($('#rpRoot'))mount();else setTimeout(boot,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1700));else setTimeout(boot,1700);
})();