/* POLADENT - Parte 4: gestión real de roles, permisos y sucursales */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PERMS=[['inicio','Inicio'],['empleados','Empleados'],['asistencia','Asistencia'],['nomina','Nómina'],['gps','GPS y locales'],['reportes','Reportes'],['seguridad','Seguridad'],['configuracion','Configuración'],['empresas','Empresas'],['licencia','Licencia']];
const BUILTIN={administrador:{nombre:'Administrador',descripcion:'Acceso completo',activo:true,permisos:PERMS.map(x=>x[0]),sistema:true},gerente:{nombre:'Gerente',descripcion:'Gestión operativa',activo:true,permisos:['inicio','empleados','asistencia','nomina','gps','reportes'],sistema:true},empleado:{nombre:'Empleado',descripcion:'Acceso básico',activo:true,permisos:['inicio','asistencia'],sistema:true}};
let catalog={}, asignaciones={}, sedes={}, empleados={};
function db(){return window.firebase?.apps?.length?firebase.database():null}
function keyFromName(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}
function status(msg,ok=true){const e=$('#rpStatus');if(!e)return;e.textContent=msg;e.className='rp-status '+(ok?'ok':'bad');e.hidden=false;clearTimeout(status.t);status.t=setTimeout(()=>e.hidden=true,3500)}
function routeHost(){const v=$('#plu-view-empleados-roles .plu-view-body');return v||null}
function mount(){const host=routeHost();if(!host)return;let root=$('#rpRoot');if(!root){root=document.createElement('section');root.id='rpRoot';root.className='rp-root';root.innerHTML=`
<div class="rp-head"><div><h3>🔐 Roles, permisos y sucursales</h3><p>Crea roles, edítalos, elimínalos y administra sus permisos. Las sucursales se gestionan desde el mismo módulo.</p></div></div>
<div id="rpStatus" class="rp-status" hidden></div>
<div class="rp-tabs"><button data-rp-tab="roles" class="active">Roles</button><button data-rp-tab="asignar">Asignar rol</button><button data-rp-tab="sucursales">Sucursales</button><button data-rp-tab="empleados">Empleados por sucursal</button></div>
<section id="rpTabRoles" class="rp-tab active">
 <div class="rp-grid two"><label>Nombre del rol<input id="rpRoleName" placeholder="Ej. Supervisor"></label><label>Descripción<input id="rpRoleDesc" placeholder="Responsabilidades del rol"></label></div>
 <input id="rpRoleKey" type="hidden">
 <label class="rp-switch"><input id="rpRoleActive" type="checkbox" checked><span>Rol activo</span></label>
 <h4>Permisos del rol</h4><div id="rpPerms" class="rp-perms"></div>
 <div class="rp-actions"><button id="rpSaveRole">Guardar rol</button><button id="rpClearRole" class="secondary">Limpiar</button></div>
 <div id="rpRolesList" class="rp-list"></div>
</section>
<section id="rpTabAsignar" class="rp-tab">
 <div class="rp-grid two"><label>Correo del usuario<input id="rpUserEmail" type="email" placeholder="correo@empresa.com"></label><label>Rol<select id="rpUserRole"></select></label></div>
 <div class="rp-actions"><button id="rpSaveAssign">Guardar / actualizar</button><button id="rpClearAssign" class="secondary">Limpiar</button></div>
 <div id="rpAssignList" class="rp-list"></div>
</section>
<section id="rpTabSucursales" class="rp-tab">
 <p>Desde aquí puedes abrir la gestión real de locales para crear, editar, activar, desactivar o eliminar.</p>
 <div class="rp-actions"><button data-rp-route="gps-locales">Agregar o editar locales</button><button data-rp-route="gps-asignar" class="secondary">Asignar locales a empleados</button></div>
 <div id="rpBranchesList" class="rp-list"></div>
</section>
<section id="rpTabEmpleados" class="rp-tab">
 <div id="rpEmployeesByBranch" class="rp-list"></div>
</section>`;host.innerHTML='';host.appendChild(root);bind();render();subscribe();}}
function bind(){
 $$('[data-rp-tab]').forEach(b=>b.onclick=()=>{$$('[data-rp-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('.rp-tab').forEach(x=>x.classList.remove('active'));$('#rpTab'+b.dataset.rpTab.charAt(0).toUpperCase()+b.dataset.rpTab.slice(1))?.classList.add('active')});
 $('#rpSaveRole').onclick=saveRole;$('#rpClearRole').onclick=clearRole;$('#rpSaveAssign').onclick=saveAssign;$('#rpClearAssign').onclick=clearAssign;
 $('#rpRolesList').onclick=e=>{const edit=e.target.closest('[data-rp-edit]'),del=e.target.closest('[data-rp-del]'),dup=e.target.closest('[data-rp-dup]'),tog=e.target.closest('[data-rp-toggle]');if(edit)loadRole(edit.dataset.rpEdit);if(del)deleteRole(del.dataset.rpDel);if(dup)duplicateRole(dup.dataset.rpDup);if(tog)toggleRole(tog.dataset.rpToggle)};
 $('#rpAssignList').onclick=e=>{const edit=e.target.closest('[data-rpa-edit]'),del=e.target.closest('[data-rpa-del]');if(edit)loadAssign(edit.dataset.rpaEdit);if(del)deleteAssign(del.dataset.rpaDel)};
 $$('[data-rp-route]').forEach(b=>b.onclick=()=>document.querySelector(`#plu-nav button[data-route="${b.dataset.rpRoute}"]`)?.click());
}
function allRoles(){return {...BUILTIN,...catalog}}
function renderPerms(selected=[]){const box=$('#rpPerms');if(!box)return;box.innerHTML=PERMS.map(([id,n])=>`<label><input type="checkbox" value="${id}" ${selected.includes(id)?'checked':''}> ${n}</label>`).join('')}
function clearRole(){['#rpRoleName','#rpRoleDesc','#rpRoleKey'].forEach(s=>$(s).value='');$('#rpRoleActive').checked=true;renderPerms([])}
function loadRole(k){const r=allRoles()[k];if(!r)return;$('#rpRoleKey').value=k;$('#rpRoleName').value=r.nombre||k;$('#rpRoleDesc').value=r.descripcion||'';$('#rpRoleActive').checked=r.activo!==false;renderPerms(r.permisos||[]);window.scrollTo({top:0,behavior:'smooth'})}
async function saveRole(){const name=$('#rpRoleName').value.trim(),existing=$('#rpRoleKey').value.trim(),key=existing||keyFromName(name);if(!name||!key)return status('Escribe un nombre válido.',false);if(BUILTIN[key]&&!existing)return status('Ese nombre está reservado.',false);const permisos=$$('#rpPerms input:checked').map(i=>i.value);const data={nombre:name,descripcion:$('#rpRoleDesc').value.trim(),activo:$('#rpRoleActive').checked,permisos,actualizado:Date.now()};try{await db().ref('catalogo_roles_v45/'+key).set(data);await db().ref('permisos_roles_v44/'+key).set({permisos,actualizado:Date.now()});clearRole();status('Rol guardado correctamente.')}catch(e){status('No se pudo guardar: '+e.message,false)}}
async function deleteRole(k){if(BUILTIN[k])return status('Los roles del sistema no se eliminan; puedes desactivarlos creando una copia personalizada.',false);const used=Object.values(asignaciones).some(a=>a?.rol===k);if(used)return status('No puedes eliminar este rol porque está asignado a un usuario.',false);if(!confirm('¿Eliminar este rol y sus permisos?'))return;try{await db().ref('catalogo_roles_v45/'+k).remove();await db().ref('permisos_roles_v44/'+k).remove();status('Rol eliminado.')}catch(e){status('No se pudo eliminar: '+e.message,false)}}
async function duplicateRole(k){const r=allRoles()[k];if(!r)return;let nk=keyFromName((r.nombre||k)+' copia'),n=2;while(allRoles()[nk])nk=keyFromName((r.nombre||k)+' copia '+n++);const data={...r,nombre:(r.nombre||k)+' copia',sistema:false,actualizado:Date.now()};delete data.sistema;try{await db().ref('catalogo_roles_v45/'+nk).set(data);await db().ref('permisos_roles_v44/'+nk).set({permisos:data.permisos||[],actualizado:Date.now()});status('Rol duplicado.')}catch(e){status('No se pudo duplicar: '+e.message,false)}}
async function toggleRole(k){if(BUILTIN[k])return status('Los roles del sistema permanecen activos.',false);try{await db().ref('catalogo_roles_v45/'+k+'/activo').set(catalog[k]?.activo===false);status('Estado actualizado.')}catch(e){status('No se pudo cambiar: '+e.message,false)}}
function clearAssign(){$('#rpUserEmail').value='';$('#rpUserRole').value='empleado'}
function roleKey(email){return String(email).replace(/[.#$\[\]]/g,'_')}
async function saveAssign(){const email=$('#rpUserEmail').value.trim().toLowerCase(),rol=$('#rpUserRole').value;if(!email)return status('Escribe el correo.',false);if(!allRoles()[rol]||allRoles()[rol].activo===false)return status('Selecciona un rol activo.',false);const data={email,rol,actualizado:Date.now()};try{await db().ref('roles_v44/'+roleKey(email)).set(data);clearAssign();status('Rol asignado.')}catch(e){status('No se pudo asignar: '+e.message,false)}}
function loadAssign(k){const a=asignaciones[k];if(!a)return;$('#rpUserEmail').value=a.email||'';$('#rpUserRole').value=a.rol||'empleado'}
async function deleteAssign(k){if(!confirm('¿Eliminar esta asignación de rol?'))return;try{await db().ref('roles_v44/'+k).remove();status('Asignación eliminada.')}catch(e){status('No se pudo eliminar: '+e.message,false)}}
function render(){const roles=allRoles(),active=Object.entries(roles).filter(([,r])=>r.activo!==false);if($('#rpUserRole'))$('#rpUserRole').innerHTML=active.map(([k,r])=>`<option value="${esc(k)}">${esc(r.nombre||k)}</option>`).join('');renderPerms($$('#rpPerms input:checked').map(i=>i.value));const rl=$('#rpRolesList');if(rl)rl.innerHTML=Object.entries(roles).map(([k,r])=>`<div class="rp-item ${r.activo===false?'off':''}"><div><b>${esc(r.nombre||k)}</b><small>${esc(r.descripcion||'Sin descripción')} · ${(r.permisos||[]).length} permisos</small></div><div class="rp-actions"><button data-rp-edit="${esc(k)}">Editar</button><button data-rp-dup="${esc(k)}" class="secondary">Duplicar</button>${r.sistema?'':`<button data-rp-toggle="${esc(k)}" class="secondary">${r.activo===false?'Activar':'Desactivar'}</button><button data-rp-del="${esc(k)}" class="danger">Eliminar</button>`}</div></div>`).join('');const al=$('#rpAssignList');if(al)al.innerHTML=Object.entries(asignaciones).length?Object.entries(asignaciones).map(([k,a])=>`<div class="rp-item"><div><b>${esc(a.email||k)}</b><small>${esc(roles[a.rol]?.nombre||a.rol||'Sin rol')}</small></div><div class="rp-actions"><button data-rpa-edit="${esc(k)}">Editar</button><button data-rpa-del="${esc(k)}" class="danger">Eliminar</button></div></div>`).join(''):'<p>No hay asignaciones.</p>';const bl=$('#rpBranchesList');if(bl)bl.innerHTML=Object.entries(sedes).length?Object.entries(sedes).map(([k,s])=>`<div class="rp-item ${s.activo===false?'off':''}"><div><b>${esc(s.nombre||k)}</b><small>${esc(s.direccion||'Sin dirección')} · ${esc(s.radio||80)} m</small></div><span>${s.activo===false?'Inactiva':'Activa'}</span></div>`).join(''):'<p>No hay sucursales configuradas.</p>';renderEmployeesByBranch()}
function renderEmployeesByBranch(){const box=$('#rpEmployeesByBranch');if(!box)return;const groups={sin:{nombre:'Sin sucursal asignada',items:[]}};Object.entries(sedes).forEach(([id,s])=>groups[id]={nombre:s.nombre||id,items:[]});Object.entries(empleados).forEach(([id,e])=>{const allowed=e.sedesPermitidas||{};const ids=Object.keys(allowed).filter(x=>allowed[x]);if(!ids.length)groups.sin.items.push(e);else ids.forEach(sid=>(groups[sid]||groups.sin).items.push(e))});box.innerHTML=Object.values(groups).map(g=>`<div class="rp-branch-group"><h4>${esc(g.nombre)} <span>${g.items.length}</span></h4>${g.items.length?g.items.map(e=>`<div>${esc(e.nombre||'Sin nombre')}</div>`).join(''):'<small>Sin empleados</small>'}</div>`).join('')}
function subscribe(){if(!db())return setTimeout(subscribe,400);const sub=(path,fn)=>window.PoladentData?.subscribe?window.PoladentData.subscribe(path,fn):db().ref(path).on('value',fn);sub('catalogo_roles_v45',s=>{catalog=s.val()||{};render()});sub('roles_v44',s=>{asignaciones=s.val()||{};render()});sub('configuracion_gps_v51/sedes',s=>{sedes=s.val()||{};render()});sub('empleados',s=>{empleados=s.val()||{};render()})}
window.PoladentRolesSucursales={mount};document.addEventListener('poladent:route',e=>{if(e.detail?.route==='empleados-roles')setTimeout(mount,0)});function boot(){if(routeHost())mount();else setTimeout(boot,350)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1300));else setTimeout(boot,1300);
})();
