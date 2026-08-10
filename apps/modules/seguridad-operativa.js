/* POLADENT FASE 18 - Seguridad operativa de roles/permisos (cliente)
   No reemplaza las Firebase Database Rules del servidor. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const BUILTIN={
 administrador:['inicio','empleados','asistencia','nomina','gps','reportes','seguridad','configuracion','empresas','licencia'],
 gerente:['inicio','empleados','asistencia','nomina','gps','reportes'],
 empleado:['inicio','asistencia']
};
const ROUTE={
 inicio:'inicio',analisis:'reportes',
 'empleados-lista':'empleados','empleados-agregar':'empleados','empleados-fotos':'empleados','empleados-horarios':'empleados','empleados-salarios':'empleados','empleados-roles':'configuracion',
 'asistencia-marcaciones':'asistencia','asistencia-verificacion':'asistencia','asistencia-historial':'asistencia','asistencia-correcciones':'asistencia','asistencia-feriados':'asistencia','asistencia-libres':'asistencia','asistencia-pagos':'asistencia','asistencia-notificaciones':'asistencia',
 nomina:'nomina',reportes:'reportes',
 'gps-control':'gps','gps-locales':'gps','gps-asignar':'gps','gps-alertas':'gps',
 seguridad:'seguridad',auditoria:'seguridad',respaldo:'configuracion',diagnostico:'configuracion',configuracion:'configuracion',
 empresas:'empresas',licencia:'licencia'
};
let role='administrador', permissions=new Set(BUILTIN.administrador), ready=false, email='';
const key=e=>String(e||'').toLowerCase().replace(/[.#$\[\]]/g,'_');
const db=()=>window.firebase?.apps?.length?firebase.database():null;
function notice(msg){
 let n=$('#soAccessNotice');if(!n){n=document.createElement('div');n.id='soAccessNotice';n.style.cssText='position:fixed;z-index:99999;left:50%;top:18px;transform:translateX(-50%);max-width:min(92vw,620px);padding:12px 16px;border-radius:12px;background:#7f1d1d;color:#fff;font-weight:700;box-shadow:0 8px 28px #0004';document.body.appendChild(n)}
 n.textContent=msg;n.hidden=false;clearTimeout(notice.t);notice.t=setTimeout(()=>n.hidden=true,4200);
}
function allowedRoute(route){if(!ready)return true;const p=ROUTE[route]||'configuracion';return permissions.has(p)}
function applyNav(){
 $$('#plu-nav button[data-route]').forEach(b=>{const ok=allowedRoute(b.dataset.route);b.hidden=!ok;b.disabled=!ok;b.setAttribute('aria-hidden',ok?'false':'true')});
 const badge=$('#soRoleBadge');if(badge){badge.textContent=`Rol: ${role}${email?' · '+email:''}`;badge.hidden=false}
}
async function loadAccess(user){
 if(!user||user.isAnonymous){ready=false;return}
 email=(user.email||'').toLowerCase();
 const d=db();if(!d){role='administrador';permissions=new Set(BUILTIN.administrador);ready=true;applyNav();return}
 try{
   // Lee usuario y asignación en paralelo para no demorar el acceso.
   const [userSnap,assignSnap]=await Promise.all([
     d.ref('usuarios_admin/'+key(email)).once('value'),
     d.ref('roles_v44/'+key(email)).once('value')
   ]);
   const userRec=userSnap.val(),a=assignSnap.val();
   if(userRec&&userRec.activo===false){
     role='sin_acceso';permissions=new Set();ready=true;applyNav();
     notice('⛔ Este usuario tiene el acceso desactivado.');
     try{await firebase.auth().signOut()}catch(_){}
     return;
   }
   // Compatibilidad: administradores existentes sin asignación conservan acceso completo.
   role=(a&&a.rol)||(userRec&&userRec.rol)||'administrador';
   let perms=BUILTIN[role]||[];
   const [customSnap,catSnap]=await Promise.all([
     d.ref('permisos_roles_v44/'+role).once('value'),
     d.ref('catalogo_roles_v45/'+role).once('value')
   ]);
   const custom=customSnap.val(),cat=catSnap.val();
   if(custom&&Array.isArray(custom.permisos))perms=custom.permisos;
   if(cat&&cat.activo===false){role='sin_acceso';perms=[]}
   permissions=new Set(perms);ready=true;applyNav();
   document.dispatchEvent(new CustomEvent('poladent:permissions-ready',{detail:{email,role,permissions:[...permissions]}}));
 }catch(e){
   console.error('[Poladent] No se pudieron cargar permisos:',e);
   // Fail-safe para no bloquear al administrador histórico por un fallo de lectura.
   role='administrador';permissions=new Set(BUILTIN.administrador);ready=true;applyNav();
 }
}
document.addEventListener('poladent:route',e=>{
 const route=e.detail?.route;if(!route||allowedRoute(route))return;
 e.preventDefault?.();notice('⛔ Tu rol no tiene permiso para abrir esta sección.');
 setTimeout(()=>document.querySelector('#plu-nav button[data-route="inicio"]:not([hidden])')?.click(),0);
},true);
document.addEventListener('click',e=>{
 const b=e.target.closest?.('#plu-nav button[data-route]');if(!b)return;
 if(!allowedRoute(b.dataset.route)){e.preventDefault();e.stopImmediatePropagation();notice('⛔ Acción bloqueada por permisos del rol.')}
},true);
function mountBadge(){
 if($('#soRoleBadge'))return;
 const top=$('.plu-mobile-head')||$('.adminTopBar')||$('#adminPanel');if(!top)return;
 const x=document.createElement('small');x.id='soRoleBadge';x.hidden=true;x.style.cssText='display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#eef2ff;color:#3730a3;font-weight:700;margin:4px';top.appendChild(x);
}
function syncUi(){mountBadge();if(ready)applyNav()}
function init(){
 mountBadge();
 if(window.firebase?.auth)firebase.auth().onAuthStateChanged(u=>loadAccess(u));
 // Fase 19.3: sin MutationObserver global. El anterior reaccionaba a miles de
 // cambios de tablas al entrar y podía congelar Chrome/Android.
 document.addEventListener('poladent:admin-ready',()=>setTimeout(syncUi,60),{passive:true});
 document.addEventListener('poladent:permissions-ready',()=>setTimeout(syncUi,0),{passive:true});
 document.addEventListener('poladent:route',()=>{if(ready)setTimeout(applyNav,0)},{passive:true});
 // Dos pasadas acotadas cubren el montaje tardío del menú sin ciclos permanentes.
 setTimeout(syncUi,900);setTimeout(syncUi,1800);
}
window.PoladentSecurity={can:p=>!ready||permissions.has(p),role:()=>role,permissions:()=>[...permissions],refresh:()=>loadAccess(firebase.auth().currentUser)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();