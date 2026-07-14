/* ---- módulo integrado ---- */
/* =========================================================
   POLADENT SISTEMA v4.4 CONFIGURACIÓN Y PERMISOS PRO
   Agrega configuración editable, roles, ficha empleado,
   justificaciones y respaldo JSON. Seguro: no borra datos.
   ========================================================= */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const LS='poladent_v44_config';
  const DEFAULT={empresa:'Poladent Casa Dental',horaEntrada:'08:00',horaSalida:'17:00',tolerancia:'10',color:'#0ea5e9',modo:'normal',rol:'administrador'};
  let empleados={}, marcaciones={}, justificaciones={}, roles={}, permisosRoles={}, config={...DEFAULT};
  function ready(fn){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',fn):fn();}
  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function show(id,msg){const el=$(id); if(!el)return; el.textContent=msg; el.style.display='block'; setTimeout(()=>{el.style.display='none'},3500);}
  function localLoad(){try{config={...DEFAULT,...JSON.parse(localStorage.getItem(LS)||'{}')};}catch{config={...DEFAULT};}}
  function localSave(){localStorage.setItem(LS,JSON.stringify(config)); localStorage.setItem('poladent_v43_hora_entrada',config.horaEntrada); localStorage.setItem('poladent_v43_tolerancia_min',config.tolerancia);}
  function applyConfig(){document.documentElement.style.setProperty('--pd44-primary',config.color||DEFAULT.color); document.body.classList.toggle('pd44-compact',config.modo==='compacto'); const h=$('.appHeader h1'); if(h&&config.empresa) h.textContent=config.empresa.toUpperCase();}
  function dbReady(){return typeof db!=='undefined'&&db&&db.ref;}
  async function saveConfigFirebase(){localSave();applyConfig(); if(dbReady()) await db.ref('configuracion_v44').update({...config,actualizado:Date.now()}); show('#pd44Status','✅ Configuración guardada.');}
  function buildUI(){
    const panel=$('#adminPanel'); if(!panel||$('#pd44-main')) return;
    const top=panel.querySelector('.adminTopBar')||panel.firstElementChild;
    const wrap=document.createElement('div'); wrap.id='pd44-main'; wrap.innerHTML=`
      <section class="pd44-panel">
        <div class="pd44-head"><div><h3>⚙️ Configuración y Permisos Pro v4.4</h3><p>Cambia horario, tolerancia, estilo, roles y respaldos desde el administrador.</p></div><span class="pd44-badge">v4.4 Seguro</span></div>
        <div class="pd44-miniDash">
          <div class="pd44-miniCard"><span>Empresa</span><strong id="pd44EmpresaMini">Poladent</strong><small>Nombre visible</small></div>
          <div class="pd44-miniCard"><span>Entrada</span><strong id="pd44EntradaMini">08:00</strong><small>hora oficial</small></div>
          <div class="pd44-miniCard"><span>Tolerancia</span><strong id="pd44TolMini">10</strong><small>minutos</small></div>
          <div class="pd44-miniCard"><span>Rol actual</span><strong id="pd44RolMini">Admin</strong><small>vista de permisos</small></div>
        </div>
        <div class="pd44-actions"><button type="button" data-pd44-tab="config">⚙️ Configuración</button><button type="button" class="secondary" data-pd44-tab="roles">🔐 Roles</button><button type="button" class="secondary" data-pd44-tab="ficha">👤 Ficha empleado</button><button type="button" class="secondary" data-pd44-tab="justifica">📝 Justificaciones</button><button type="button" class="secondary" data-pd44-tab="respaldo">💾 Respaldo</button></div>
        <div id="pd44Status" class="pd44-status"></div>
      </section>
      <section id="pd44-config" class="pd44-panel pd44-tab">
        <div class="pd44-head"><div><h3>⚙️ Panel de configuración</h3><p>Estos cambios no borran datos. Se guardan como configuración nueva.</p></div></div>
        <div class="pd44-grid">
          <div class="pd44-field"><label>Nombre empresa</label><input id="pd44Empresa" placeholder="Poladent Casa Dental"></div>
          <div class="pd44-field"><label>Hora entrada</label><input id="pd44HoraEntrada" type="time"></div>
          <div class="pd44-field"><label>Hora salida</label><input id="pd44HoraSalida" type="time"></div>
          <div class="pd44-field"><label>Tolerancia atraso</label><select id="pd44Tolerancia"><option value="0">0 min</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option><option value="20">20 min</option></select></div>
          <div class="pd44-field"><label>Color principal</label><input id="pd44Color" type="color"></div>
          <div class="pd44-field"><label>Vista</label><select id="pd44Modo"><option value="normal">Normal</option><option value="compacto">Compacta para celular</option></select></div>
          <div class="pd44-field"><label>Logo</label><input id="pd44Logo" type="file" accept="image/*"><small>Vista previa local. Para logo definitivo se cambia en carpeta img.</small></div>
          <div class="pd44-field"><label>Acción</label><button type="button" class="pd44-btn" id="pd44SaveConfig">Guardar configuración</button></div>
        </div>
      </section>
      <section id="pd44-roles" class="pd44-panel pd44-tab pd44-hidden">
        <div class="pd44-head"><div><h3>🔐 Roles y permisos</h3><p>Organiza qué tipo de usuario es cada correo. No elimina el acceso existente.</p></div></div>
        <div class="pd44-grid two"><div class="pd44-field"><label>Correo del usuario</label><input id="pd44RoleEmail" placeholder="correo@ejemplo.com"></div><div class="pd44-field"><label>Rol</label><select id="pd44RoleSelect"><option value="administrador">Administrador</option><option value="gerente">Gerente</option><option value="empleado">Empleado</option></select></div></div>
        <div class="pd44-actions"><button type="button" id="pd44SaveRole">Guardar / actualizar rol</button><button type="button" class="secondary" id="pd44ClearRoleForm">Limpiar formulario</button></div>
        <div class="pd44-permission-box"><h4>Permisos del rol seleccionado</h4><p class="pd44-note">Marca las áreas que podrá utilizar este rol.</p><div id="pd44PermissionChecks" class="pd44-permission-grid"></div><div class="pd44-actions"><button type="button" id="pd44SavePermissions">Guardar permisos</button><button type="button" class="danger" id="pd44ResetPermissions">Restablecer permisos</button></div></div>
        <div class="pd44-branch-links"><h4>Sucursales del personal</h4><p class="pd44-note">La edición y eliminación de locales se realiza en GPS y locales.</p><div class="pd44-actions"><button type="button" data-pd44-route="gps-locales">Editar / eliminar locales</button><button type="button" class="secondary" data-pd44-route="gps-asignar">Asignar o quitar locales</button></div></div>
        <div id="pd44RolesList" class="pd44-list" style="margin-top:12px"></div>
      </section>
      <section id="pd44-ficha" class="pd44-panel pd44-tab pd44-hidden">
        <div class="pd44-head"><div><h3>👤 Historial por empleado</h3><p>Ficha rápida con foto, PIN, salario, marcaciones, atrasos y justificaciones.</p></div></div>
        <div class="pd44-grid two"><div class="pd44-field"><label>Empleado</label><select id="pd44EmpSelect"></select></div><div class="pd44-field"><label>Fecha</label><input id="pd44FichaFecha" type="date"></div></div>
        <div id="pd44FichaBox" style="margin-top:12px"></div>
      </section>
      <section id="pd44-justifica" class="pd44-panel pd44-tab pd44-hidden">
        <div class="pd44-head"><div><h3>📝 Justificaciones</h3><p>Marca permiso, reposo, falta justificada, día libre pagado u observación.</p></div></div>
        <div class="pd44-grid"><div class="pd44-field"><label>Empleado</label><select id="pd44JustEmp"></select></div><div class="pd44-field"><label>Fecha</label><input id="pd44JustFecha" type="date"></div><div class="pd44-field"><label>Tipo</label><select id="pd44JustTipo"><option>Permiso</option><option>Reposo</option><option>Falta justificada</option><option>Día libre pagado</option><option>Observación</option></select></div><div class="pd44-field"><label>Horas pagadas</label><select id="pd44JustHoras"><option value="0">0 horas</option><option value="4">4 horas</option><option value="8">8 horas</option></select></div></div>
        <div class="pd44-field" style="margin-top:12px"><label>Nota</label><textarea id="pd44JustNota" placeholder="Motivo o comentario..."></textarea></div><div class="pd44-actions"><button type="button" id="pd44SaveJust">Guardar justificación</button></div><div id="pd44JustList" class="pd44-list" style="margin-top:12px"></div>
      </section>
      <section id="pd44-respaldo" class="pd44-panel pd44-tab pd44-hidden">
        <div class="pd44-head"><div><h3>💾 Respaldo automático manual</h3><p>Descarga un JSON con empleados, marcaciones, feriados, días libres, configuración, roles y justificaciones.</p></div><span class="pd44-badge">Backup</span></div>
        <div class="pd44-actions"><button type="button" id="pd44Backup">Descargar respaldo JSON</button><button type="button" class="secondary" id="pd44BackupLite">Respaldo solo empleados</button></div><p class="pd44-note">Guarda este archivo en Drive o en tu teléfono. No reemplaza Firebase; es una copia de seguridad para emergencias.</p>
      </section>`;
    panel.insertBefore(wrap, top ? top.nextSibling : panel.firstChild);
    bindUI(); fillForms(); renderAll();
  }
  function bindUI(){
    $$('[data-pd44-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.pd44Tab));
    $('#pd44SaveConfig').onclick=()=>{config={...config,empresa:$('#pd44Empresa').value.trim()||DEFAULT.empresa,horaEntrada:$('#pd44HoraEntrada').value||DEFAULT.horaEntrada,horaSalida:$('#pd44HoraSalida').value||DEFAULT.horaSalida,tolerancia:$('#pd44Tolerancia').value||DEFAULT.tolerancia,color:$('#pd44Color').value||DEFAULT.color,modo:$('#pd44Modo').value||'normal'};saveConfigFirebase(); renderAll();};
    $('#pd44Logo').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$$('img[src*="logo-poladent"]').forEach(img=>img.src=r.result);show('#pd44Status','✅ Logo aplicado como vista previa en este navegador.');};r.readAsDataURL(f);};
    $('#pd44SaveRole').onclick=saveRole; $('#pd44ClearRoleForm').onclick=clearRoleForm; $('#pd44RoleSelect').onchange=renderPermissionChecks; $('#pd44SavePermissions').onclick=savePermissions; $('#pd44ResetPermissions').onclick=resetPermissions; $('#pd44RolesList').onclick=handleRoleListClick; $$('[data-pd44-route]').forEach(b=>b.onclick=()=>document.querySelector(`#plu-nav button[data-route="${b.dataset.pd44Route}"]`)?.click()); $('#pd44EmpSelect').onchange=renderFicha; $('#pd44FichaFecha').onchange=renderFicha; $('#pd44SaveJust').onclick=saveJust; $('#pd44JustEmp').onchange=renderJustList; $('#pd44JustFecha').onchange=renderJustList; $('#pd44Backup').onclick=()=>backup(false); $('#pd44BackupLite').onclick=()=>backup(true);
  }
  function showTab(name){$$('.pd44-tab').forEach(t=>t.classList.add('pd44-hidden')); $('#pd44-'+name)?.classList.remove('pd44-hidden'); $$('[data-pd44-tab]').forEach(b=>b.classList.toggle('secondary',b.dataset.pd44Tab!==name));}
  function fillForms(){localLoad(); applyConfig(); $('#pd44Empresa').value=config.empresa; $('#pd44HoraEntrada').value=config.horaEntrada; $('#pd44HoraSalida').value=config.horaSalida; $('#pd44Tolerancia').value=config.tolerancia; $('#pd44Color').value=config.color; $('#pd44Modo').value=config.modo; $('#pd44FichaFecha').value=today(); $('#pd44JustFecha').value=today();}
  function renderMini(){ $('#pd44EmpresaMini').textContent=(config.empresa||'Poladent').split(' ')[0]; $('#pd44EntradaMini').textContent=config.horaEntrada; $('#pd44TolMini').textContent=config.tolerancia; $('#pd44RolMini').textContent=config.rol==='administrador'?'Admin':config.rol; }
  function renderSelects(){const opts=Object.entries(empleados).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||'')).map(([id,e])=>`<option value="${esc(id)}">${esc(e.nombre||'Sin nombre')}</option>`).join(''); ['#pd44EmpSelect','#pd44JustEmp'].forEach(id=>{const el=$(id); if(el){const val=el.value; el.innerHTML=opts||'<option value="">Sin empleados</option>'; if(val) el.value=val;}});}
  const PERMISSION_OPTIONS=[['inicio','Inicio'],['empleados','Empleados'],['asistencia','Asistencia'],['nomina','Nómina'],['gps','GPS y locales'],['reportes','Reportes'],['seguridad','Seguridad'],['configuracion','Configuración'],['empresas','Empresas'],['licencia','Licencia']];
  const DEFAULT_PERMISSIONS={administrador:PERMISSION_OPTIONS.map(x=>x[0]),gerente:['inicio','empleados','asistencia','nomina','gps','reportes'],empleado:['inicio','asistencia']};
  function roleKey(email){return String(email||'').trim().toLowerCase().replace(/[.#$\[\]]/g,'_');}
  async function saveRole(){const email=$('#pd44RoleEmail').value.trim().toLowerCase(); const rol=$('#pd44RoleSelect').value; if(!email)return show('#pd44Status','⚠️ Escribe el correo.'); const key=roleKey(email),data={email,rol,actualizado:Date.now()}; roles[key]=data; if(dbReady()) await db.ref('roles_v44/'+key).set(data); renderRoles(); show('#pd44Status','✅ Rol guardado o actualizado.');}
  function clearRoleForm(){ $('#pd44RoleEmail').value=''; $('#pd44RoleSelect').value='empleado'; renderPermissionChecks(); }
  function handleRoleListClick(e){const edit=e.target.closest('[data-role-edit]'),del=e.target.closest('[data-role-del]'); if(edit){const r=roles[edit.dataset.roleEdit]||{};$('#pd44RoleEmail').value=r.email||edit.dataset.roleEdit;$('#pd44RoleSelect').value=r.rol||'empleado';renderPermissionChecks();$('#pd44RoleEmail').focus();} if(del)deleteRole(del.dataset.roleDel);}
  async function deleteRole(key){const r=roles[key]||{};if(!confirm(`¿Eliminar el rol de ${r.email||key}?`))return;delete roles[key];if(dbReady())await db.ref('roles_v44/'+key).remove();renderRoles();show('#pd44Status','✅ Rol eliminado.');}
  function renderRoles(){const box=$('#pd44RolesList'); if(!box)return; const items=Object.entries(roles); box.innerHTML=items.length?items.map(([key,r])=>`<div class="pd44-item"><div><b>${esc(r.email||key)}</b><br><small>${esc(r.rol||'empleado')}</small></div><div class="pd44-item-actions"><span class="pd44-pill">${esc(r.rol||'empleado')}</span><button type="button" class="secondary" data-role-edit="${esc(key)}">Editar</button><button type="button" class="danger" data-role-del="${esc(key)}">Eliminar</button></div></div>`).join(''):'<div class="pd44-item"><small>No hay roles configurados todavía.</small></div>';}
  function selectedPermissions(){return Array.from(document.querySelectorAll('#pd44PermissionChecks input:checked')).map(x=>x.value);}
  function renderPermissionChecks(){const box=$('#pd44PermissionChecks');if(!box)return;const rol=$('#pd44RoleSelect')?.value||'empleado',saved=permisosRoles[rol]?.permisos||permisosRoles[rol]||DEFAULT_PERMISSIONS[rol]||[];box.innerHTML=PERMISSION_OPTIONS.map(([id,label])=>`<label><input type="checkbox" value="${id}" ${saved.includes(id)?'checked':''}> ${label}</label>`).join('');}
  async function savePermissions(){const rol=$('#pd44RoleSelect').value,permisos=selectedPermissions(),data={permisos,actualizado:Date.now()};permisosRoles[rol]=data;if(dbReady())await db.ref('permisos_roles_v44/'+rol).set(data);show('#pd44Status','✅ Permisos guardados para '+rol+'.');}
  async function resetPermissions(){const rol=$('#pd44RoleSelect').value;if(!confirm('¿Restablecer los permisos de '+rol+'?'))return;delete permisosRoles[rol];if(dbReady())await db.ref('permisos_roles_v44/'+rol).remove();renderPermissionChecks();show('#pd44Status','✅ Permisos restablecidos.');}
  function day(empId,fecha){return ((marcaciones[empId]||{})[fecha])||{};} function time(v){if(!v)return '—'; if(v.hora)return String(v.hora).slice(0,5); if(v.timestamp){const d=new Date(v.timestamp); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;} return '—';}
  function lateMin(h){const m=String(h).match(/(\d{1,2}):(\d{2})/);if(!m)return 0;const a=+m[1]*60+ +m[2];const [hh,mm]=(config.horaEntrada||'08:00').split(':').map(Number);return Math.max(0,a-(hh*60+mm+Number(config.tolerancia||0)));}
  function renderFicha(){const empId=$('#pd44EmpSelect')?.value; const fecha=$('#pd44FichaFecha')?.value||today(); const box=$('#pd44FichaBox'); if(!box)return; const e=empleados[empId]; if(!e){box.innerHTML='<div class="pd44-item">Selecciona un empleado.</div>';return;} const d=day(empId,fecha); const entrada=d.entrada; const salida=d.salida; const h=time(entrada); const tarde=lateMin(h); const just=((justificaciones[empId]||{})[fecha]); const foto=e.foto||e.photoUrl||e.imagen||''; box.innerHTML=`<div class="pd44-employeeProfile"><div class="pd44-avatar">${foto?`<img src="${esc(foto)}">`:'👤'}</div><div><h3 style="margin:0">${esc(e.nombre||'Sin nombre')}</h3><small>PIN: ${esc(e.pin||'')} · Salario: ${esc(e.salario||0)} · Tipo: ${esc(e.tipoSalario||'diario')}</small><br><small>Fecha: ${esc(fecha)}</small></div><div><span class="pd44-pill ${tarde?'warn':'ok'}">${entrada?tarde?('Tarde '+tarde+' min'):'Presente':'Sin entrada'}</span></div></div><div class="pd44-tableWrap" style="margin-top:12px"><table class="pd44-table"><thead><tr><th>Entrada</th><th>Almuerzo salida</th><th>Almuerzo regreso</th><th>Salida</th><th>Justificación</th></tr></thead><tbody><tr><td>${time(d.entrada)}</td><td>${time(d.almuerzo_salida)}</td><td>${time(d.almuerzo_regreso)}</td><td>${time(d.salida)}</td><td>${just?esc(just.tipo)+' · '+esc(just.horasPagadas)+'h':'—'}</td></tr></tbody></table></div>`;}
  async function saveJust(){const empId=$('#pd44JustEmp').value, fecha=$('#pd44JustFecha').value||today(); if(!empId)return show('#pd44Status','⚠️ Selecciona empleado.'); const data={tipo:$('#pd44JustTipo').value,horasPagadas:+$('#pd44JustHoras').value||0,nota:$('#pd44JustNota').value.trim(),fecha,empleadoNombre:empleados[empId]?.nombre||'',creado:Date.now()}; justificaciones[empId]=justificaciones[empId]||{}; justificaciones[empId][fecha]=data; if(dbReady()) await db.ref(`justificaciones_v44/${empId}/${fecha}`).set(data); $('#pd44JustNota').value=''; renderJustList(); renderFicha(); show('#pd44Status','✅ Justificación guardada.');}
  function renderJustList(){const empId=$('#pd44JustEmp')?.value; const box=$('#pd44JustList'); if(!box)return; const data=empId?(justificaciones[empId]||{}):{}; const items=Object.entries(data).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30); box.innerHTML=items.length?items.map(([fecha,j])=>`<div class="pd44-item"><div><b>${esc(fecha)} · ${esc(j.tipo)}</b><br><small>${esc(j.nota||'Sin nota')} · ${esc(j.horasPagadas||0)} horas pagadas</small></div><span class="pd44-pill ok">Guardado</span></div>`).join(''):'<div class="pd44-item"><small>Sin justificaciones para este empleado.</small></div>';}
  function renderAll(){if(!$('#pd44-main'))return; renderMini(); renderSelects(); renderRoles(); renderPermissionChecks(); renderFicha(); renderJustList();}
  async function backup(lite){if(!dbReady()){show('#pd44Status','⚠️ Firebase todavía no está listo.');return;} const paths=lite?['empleados']:['empleados','marcaciones','feriados_global','dias_libres_empleado','configuracion_v44','roles_v44','justificaciones_v44']; const out={fechaRespaldo:new Date().toISOString(),version:'Poladent v4.4',tipo:lite?'empleados':'completo'}; for(const p of paths){try{out[p]=(await db.ref(p).once('value')).val()||{};}catch(e){out[p]={error:'No se pudo leer'};}} const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Poladent_respaldo_${out.tipo}_${today()}.json`; a.click(); URL.revokeObjectURL(a.href); show('#pd44Status','✅ Respaldo descargado.');}
  function subscribe(){if(!dbReady())return setTimeout(subscribe,300); try{window.PoladentData.subscribe('configuracion_v44',s=>{if(s.exists()){config={...DEFAULT,...config,...s.val()}; localSave(); fillForms(); renderAll();}}); window.PoladentData.subscribe('empleados',s=>{empleados=s.val()||{}; renderAll();}); window.PoladentData.subscribe('marcaciones',s=>{marcaciones=s.val()||{}; renderAll();}); window.PoladentData.subscribe('justificaciones_v44',s=>{justificaciones=s.val()||{}; renderAll();}); window.PoladentData.subscribe('roles_v44',s=>{roles=s.val()||{}; renderAll();}); window.PoladentData.subscribe('permisos_roles_v44',s=>{permisosRoles=s.val()||{}; renderPermissionChecks();});}catch(e){setTimeout(subscribe,800);}}
  function watch(){const panel=$('#adminPanel'); if(!panel)return; const tick=()=>{if(!panel.classList.contains('hidden')){buildUI();renderAll();}}; new MutationObserver(tick).observe(panel,{attributes:true,attributeFilter:['class']}); setInterval(tick,1800); tick();}
  ready(()=>{localLoad();applyConfig();watch();subscribe();});
})();

/* ---- módulo integrado ---- */
