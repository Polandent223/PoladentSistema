// ===============================
// ✅ POLADENT - APP.JS COMPLETO (FINAL)
// TODO EN ESPAÑOL + SALARIO USD
// ✅ Domingo = libre pagado (8h)
// ✅ Feriado GLOBAL = libre pagado (8h)
// ✅ Día libre por EMPLEADO = libre pagado (8h)
// ✅ Día normal sin marcación = descuento (8h)
// ✅ PDF con nombre de la empresa
// ===============================

// 🔹 ELEMENTOS PRINCIPALES
const home = document.getElementById("home");
const adminLogin = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const employeePanel = document.getElementById("employeePanel");
const fechaDesde = document.getElementById("fechaDesde");
const fechaHasta = document.getElementById("fechaHasta");

// 🔹 BOTONES
document.getElementById("btnAdmin").onclick = () => goAdmin();
document.getElementById("btnEmployee").onclick = () => goEmployee();
document.getElementById("backHomeBtn1").onclick = () => backHome();
document.getElementById("backHomeBtn2").onclick = () => backHome();
document.getElementById("loginBtn").onclick = () => loginAdmin();
document.getElementById("guardarEmpleadoBtn").onclick = () => agregarEmpleado();
document.getElementById("exportMarcBtn").onclick = () => exportExcelFiltro();
document.getElementById("exportSalarioBtn").onclick = () => exportExcelSalarialFiltro();
document.getElementById("logoutBtn").onclick = () => logout();

// Botones empleado
document.getElementById("entradaBtn").onclick = () => mark("entrada");
document.getElementById("almuerzoSalidaBtn").onclick = () => mark("almuerzo_salida");
document.getElementById("almuerzoRegresoBtn").onclick = () => mark("almuerzo_regreso");
document.getElementById("salidaBtn").onclick = () => mark("salida");

// Input PIN empleado
document.getElementById("empPin").addEventListener("input", pinInputHandler);

// ===============================
// 🔹 UTILIDADES
// ===============================
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const HORAS_JORNADA = 8;

function formatUSD(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "USD 0.00";
  return USD.format(num);
}

function hideAll() {
  home.classList.add("hidden");
  adminLogin.classList.add("hidden");
  adminPanel.classList.add("hidden");
  employeePanel.classList.add("hidden");
}

function backHome() {
  hideAll();
  home.classList.remove("hidden");
  document.getElementById("empNombreGrande").innerHTML = "";
  document.getElementById("empPin").value = "";
  document.getElementById("employeeButtons").classList.add("hidden");
  document.getElementById("empMsg").innerHTML = "";
}

function goAdmin() {
  hideAll();
  adminLogin.classList.remove("hidden");
}
function goEmployee() {
  // Fase 5: la marcación de empleados usa únicamente la pantalla segura.
  // Se conserva el panel legado en el HTML solo por compatibilidad visual, pero no se habilita.
  window.location.href = "empleado.html";
}

// ===============================
// 🔹 LOGIN ADMIN
// ===============================
async function loginAdmin() {
  const emailInput = document.getElementById("adminEmail");
  const passInput = document.getElementById("adminPass");
  const loginBtn = document.getElementById("loginBtn");
  const email = emailInput.value.trim().toLowerCase();
  const pass = passInput.value;

  if (!email || !pass) {
    alert("Completa correo y contraseña");
    return;
  }

  // Evita dos intentos simultáneos si se pulsa Entrar más de una vez.
  if (loginBtn?.dataset.loading === "1") return;
  if (loginBtn) {
    loginBtn.dataset.loading = "1";
    loginBtn.disabled = true;
    loginBtn.dataset.originalText = loginBtn.textContent;
    loginBtn.textContent = "Entrando…";
  }

  try {
    // Si el navegador conserva una sesión anónima usada por empleado.html,
    // se cierra antes de iniciar la sesión administrativa.
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try { await auth.signOut(); } catch (_e) {}
    }

    // IMPORTANTE: el error de autenticación se maneja aparte.
    // Un fallo posterior al cargar un módulo NO debe mostrarse como “Error de acceso”.
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (authError) {
      console.warn("[Poladent] Falló el acceso administrativo:", authError?.code || authError);
      alert("No se pudo iniciar sesión. Verifica el correo y la contraseña.");
      return;
    }

    // Carga y valida el rol antes de mostrar el panel.
    try {
      if (window.PoladentSecurity?.refresh) await window.PoladentSecurity.refresh();
    } catch (e) {
      console.error("[Poladent] Error validando permisos:", e);
    }
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      alert("Este usuario no tiene acceso administrativo activo.");
      return;
    }

    hideAll();
    adminPanel.classList.remove("hidden");
    setDefaultDate();

    // La autenticación ya fue correcta. Si un módulo secundario falla,
    // el administrador permanece dentro y el error se registra para diagnóstico.
    try { loadEmpleados(); } catch (e) { console.error("[Poladent] Error cargando empleados:", e); }
    try { loadMarcaciones(); } catch (e) { console.error("[Poladent] Error cargando marcaciones:", e); }
    try { await cargarEmpleadosParaModal(); } catch (e) { console.error("[Poladent] Error preparando empleados del modal:", e); }
    try { loadFeriadosGlobalCache(); } catch (e) { console.error("[Poladent] Error cargando feriados:", e); }
    try { renderListaFeriadosGlobal(); } catch (e) { console.error("[Poladent] Error mostrando feriados:", e); }
    try { renderListaLibresEmpleado(); } catch (e) { console.error("[Poladent] Error mostrando días libres:", e); }
    try { updateChart(); } catch (e) { console.error("[Poladent] Error actualizando gráfico:", e); }

    document.dispatchEvent(new CustomEvent("poladent:admin-ready"));
  } finally {
    if (loginBtn) {
      loginBtn.dataset.loading = "0";
      loginBtn.disabled = false;
      loginBtn.textContent = loginBtn.dataset.originalText || "Entrar";
    }
  }
}

function logout() {
  auth.signOut();
  backHome();
}

// ===============================
// 🔹 EMPLEADOS
// ===============================
function agregarEmpleado() {
  const nombre = document.getElementById("nombreEmpleado").value.trim();
  const pin = document.getElementById("pinEmpleado").value.trim();

  if (!nombre || !pin) {
    alert("Completa todos los campos");
    return;
  }

  const id = db.ref("empleados").push().key;
  db.ref("empleados/" + id).set({
    nombre,
    pin,
    creado: Date.now(),
    salario: 0,
    tipoSalario: "diario",
  });

  document.getElementById("nombreEmpleado").value = "";
  document.getElementById("pinEmpleado").value = "";
}

function cargarEmpleados() {
  const cont = document.getElementById("listaEmpleados");
  if (!cont) return;

  // Fase 19.8: el directorio combina fichas actuales con IDs históricos.
  // NO recrea empleados, NO escribe Firebase y NO modifica historial.
  if (!window.__poladentEmployeeDirectory) {
    window.__poladentEmployeeDirectory = {
      current: {},
      marks: {},
      payroll: {},
      freeDays: {},
      hidden: {},
      subscribed: false
    };
  }
  const state = window.__poladentEmployeeDirectory;

  const escDir = v => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const historicalFromMarks = (id, fechas) => {
    let nombre = "", foto = "", pin = "", lastDate = "";
    Object.entries(fechas || {}).forEach(([fecha, day]) => {
      if (fecha > lastDate) lastDate = fecha;
      Object.values(day || {}).forEach(m => {
        if (!m || typeof m !== "object") return;
        if (!nombre && m.nombre) nombre = m.nombre;
        if (!foto && (m.foto || m.photo)) foto = m.foto || m.photo;
        if (!pin && m.pin) pin = m.pin;
      });
    });
    return {id, nombre, foto, pin, lastDate, source:"marcaciones"};
  };

  const historicalFromPayroll = (id) => {
    let nombre="", lastDate="", salario=null, tipoSalario="";
    Object.entries(state.payroll || {}).forEach(([periodo, porEmpleado]) => {
      const r = porEmpleado?.[id];
      if (!r) return;
      nombre = nombre || r.empleadoNombre || r.nombre || "";
      salario = salario ?? r.salarioBase ?? r.salario ?? null;
      tipoSalario = tipoSalario || r.tipoSalario || "";
      const d = r.hasta || r.desde || String(periodo).slice(11,21) || String(periodo).slice(0,10);
      if (d && d > lastDate) lastDate = d;
    });
    return {id,nombre,lastDate,salario,tipoSalario,source:"nomina"};
  };

  const buildItems = () => {
    const map = new Map();

    // 1) Fichas actuales: siempre tienen prioridad.
    Object.entries(state.current || {}).forEach(([id,e]) => {
      map.set(id,{id,...(e||{}),historico:false,fuentes:["empleados"]});
    });

    // 2) IDs presentes en marcaciones pero sin ficha actual.
    Object.entries(state.marks || {}).forEach(([id,fechas]) => {
      if (map.has(id)) return;
      const h = historicalFromMarks(id,fechas);
      map.set(id,{
        ...h,
        nombre:h.nombre || `Funcionario histórico ${String(id).slice(-6)}`,
        historico:true,
        activo:false,
        archivado:true,
        fuentes:["marcaciones"]
      });
    });

    // 3) IDs presentes en nómina pero sin ficha/mark actual.
    const payrollIds = new Set();
    Object.values(state.payroll || {}).forEach(periodo => {
      Object.keys(periodo || {}).forEach(id => payrollIds.add(id));
    });
    payrollIds.forEach(id => {
      const p = historicalFromPayroll(id);
      if (map.has(id)) {
        const x=map.get(id);
        if (x.historico) {
          x.nombre=x.nombre && !x.nombre.startsWith("Funcionario histórico") ? x.nombre : (p.nombre||x.nombre);
          x.salario=x.salario ?? p.salario;
          x.tipoSalario=x.tipoSalario || p.tipoSalario;
          x.lastDate=[x.lastDate,p.lastDate].filter(Boolean).sort().pop()||"";
          if(!x.fuentes.includes("nomina"))x.fuentes.push("nomina");
        }
        return;
      }
      map.set(id,{
        ...p,
        nombre:p.nombre || `Funcionario histórico ${String(id).slice(-6)}`,
        historico:true,
        activo:false,
        archivado:true,
        fuentes:["nomina"]
      });
    });

    // 4) Días libres puede revelar un ID adicional. Sin nombre, se conserva como histórico.
    Object.keys(state.freeDays || {}).forEach(id => {
      if (map.has(id)) {
        const x=map.get(id);
        if(x.historico && !x.fuentes.includes("dias_libres"))x.fuentes.push("dias_libres");
        return;
      }
      map.set(id,{
        id,
        nombre:`Funcionario histórico ${String(id).slice(-6)}`,
        historico:true,
        activo:false,
        archivado:true,
        fuentes:["dias_libres"]
      });
    });

    const normName=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const currentNames=new Set([...map.values()].filter(x=>!x.historico).map(x=>normName(x.nombre)).filter(Boolean));
    return [...map.values()]
      .filter(x=>state.hidden?.[x.id]!==true)
      // Un ID histórico con el mismo nombre de una ficha actual es un registro legado,
      // no un segundo funcionario. Se conserva en Firebase pero no se duplica en el directorio.
      .filter(x=>!x.historico || !currentNames.has(normName(x.nombre)))
      .sort((a,b)=>
        Number(a.historico)-Number(b.historico) ||
        String(a.nombre||"").localeCompare(String(b.nombre||""),"es")
      );
  };

  const renderDirectory = () => {
    const items = buildItems();
    const prevSearch = document.getElementById("empDirectorySearch")?.value || "";
    const prevFilter = document.getElementById("empDirectoryFilter")?.value || "todos";

    cont.innerHTML = `
      <div class="emp-directory-toolbar">
        <div class="emp-directory-search">
          <span>🔎</span>
          <input id="empDirectorySearch" type="search" placeholder="Buscar por nombre o PIN" value="${escDir(prevSearch)}">
        </div>
        <select id="empDirectoryFilter">
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="archivados">Archivados</option>
          <option value="historicos">Registros históricos</option>
        </select>
        <span id="empDirectoryCount" class="emp-directory-count"></span>
      </div>
      <div id="empDirectoryDiagnostic" class="emp-directory-diagnostic"></div>
      <div id="empDirectoryCards" class="emp-directory-cards"></div>`;

    const filter = document.getElementById("empDirectoryFilter");
    if (filter) filter.value = ["todos","activos","archivados","historicos"].includes(prevFilter) ? prevFilter : "todos";

    const render = () => {
      const q=(document.getElementById("empDirectorySearch")?.value||"").trim().toLowerCase();
      const f=document.getElementById("empDirectoryFilter")?.value||"todos";
      const filtered=items.filter(data=>{
        const archivado=!data.historico&&(data.archivado===true||data.activo===false);
        if(f==="activos" && (data.historico||archivado)) return false;
        if(f==="archivados" && (data.historico||!archivado)) return false;
        if(f==="historicos" && !data.historico) return false;
        if(q && !`${data.nombre||""} ${data.pin||""} ${data.id||""}`.toLowerCase().includes(q)) return false;
        return true;
      });

      const actuales=items.filter(x=>!x.historico).length;
      const activos=items.filter(x=>!x.historico && !(x.archivado===true||x.activo===false)).length;
      const archivados=items.filter(x=>!x.historico && (x.archivado===true||x.activo===false)).length;
      const historicos=items.filter(x=>x.historico).length;

      const count=document.getElementById("empDirectoryCount");
      if(count)count.textContent=filtered.length===items.length
        ? `${items.length} encontrados · ${activos} activos`
        : `${filtered.length} visibles de ${items.length}`;

      const diag=document.getElementById("empDirectoryDiagnostic");
      if(diag)diag.innerHTML=`
        <div><b>${actuales}</b><span>fichas actuales</span></div>
        <div><b>${activos}</b><span>activos</span></div>
        <div><b>${archivados}</b><span>archivados</span></div>
        <div class="${historicos?'warn':''}"><b>${historicos}</b><span>solo en historial</span></div>
        ${historicos?`<p>ℹ️ Estos ${historicos} registros aparecen en marcaciones, nómina o días libres, pero actualmente no tienen una ficha completa en la ruta de empleados. Se muestran en modo solo lectura para no perderlos ni duplicarlos.</p>`:""}`;

      const cards=document.getElementById("empDirectoryCards");
      if(!cards)return;
      cards.innerHTML=filtered.length?filtered.map(data=>{
        const historico=!!data.historico;
        const archivado=!historico&&(data.archivado===true||data.activo===false);
        const salarioTexto=data.salario!==undefined && data.salario!==null
          ? `${formatUSD(data.salario)} · ${data.tipoSalario||"diario"}`
          : "—";
        const sedeTxt=data.sedeNombre||data.sucursal||data.localNombre||"";
        const inicial=String(data.nombre||"?").trim().charAt(0).toUpperCase();
        const foto=data.foto
          ? `<img class="emp-pro-avatar" src="${escDir(data.foto)}" alt="Foto de ${escDir(data.nombre||"empleado")}">`
          : `<div class="emp-pro-avatar emp-pro-placeholder">${escDir(inicial)}</div>`;
        const status=historico
          ? `<span class="emp-status historic">Histórico</span>`
          : `<span class="emp-status ${archivado?"off":"on"}">${archivado?"Archivado":"Activo"}</span>`;
        const extraHistoric=historico
          ? `<span><b>Fuentes</b> ${escDir((data.fuentes||[]).join(", "))}</span>${data.lastDate?`<span><b>Última referencia</b> ${escDir(data.lastDate)}</span>`:""}`
          : "";
        const actions=historico
          ? `<button type="button" onclick="window.PoladentHistorialProfesional?.openEmployee?.('${escDir(data.id)}')">📚 Ver historial</button>
             <button type="button" class="danger" onclick="eliminarRegistroHistoricoPermanente('${escDir(data.id)}','${String(data.nombre||"").replace(/'/g,"\'")}')">🗑️ Eliminar historial</button>`
          : `<button onclick="cambiarEstadoEmpleado('${escDir(data.id)}', ${archivado?"true":"false"})">${archivado?"↩ Reactivar":"📦 Archivar"}</button>
             ${archivado?`<button class="danger" onclick="eliminarFichaEmpleado('${escDir(data.id)}')">🗑️ Eliminar ficha</button><button class="danger" onclick="eliminarEmpleadoCompleto('${escDir(data.id)}','${String(data.nombre||"").replace(/'/g,"\'")}')">⚠️ Eliminar todo</button>`:`<button onclick="asignarSalario('${escDir(data.id)}')">💵 Salario</button>`}
             <button onclick="openEditModal('${escDir(data.id)}')">🕒 Horario</button>
             <button onclick="generarReciboDetalladoPorId('${escDir(data.id)}', '${String(data.nombre||"").replace(/'/g,"\\'")}')">📄 Recibo</button>`;
        return `<article class="empleado emp-pro-card ${archivado?"empleado-archivado":""} ${historico?"empleado-historico":""}" data-emp-id="${escDir(data.id)}">
          <div class="emp-pro-main">
            ${foto}
            <div class="emp-pro-info">
              <div class="emp-pro-title"><strong>${escDir(data.nombre||"Sin nombre")}</strong>${status}</div>
              <div class="emp-pro-meta">
                <span><b>PIN</b> ${historico?"No disponible":escDir(data.pin||"—")}</span>
                <span><b>Salario</b> ${escDir(salarioTexto)}</span>
                ${sedeTxt?`<span><b>Sede</b> ${escDir(sedeTxt)}</span>`:""}
                ${extraHistoric}
              </div>
            </div>
          </div>
          <div class="empActions emp-pro-actions">${actions}</div>
        </article>`;
      }).join(""):`<div class="emp-empty-state">No hay funcionarios que coincidan con este filtro.</div>`;
    };

    document.getElementById("empDirectorySearch")?.addEventListener("input",render);
    document.getElementById("empDirectoryFilter")?.addEventListener("change",render);
    render();

    // Los modales editables solo usan fichas actuales de empleados.
    cargarEmpleadosParaModal().then(()=>renderListaLibresEmpleado());
  };

  if (!state.subscribed) {
    state.subscribed=true;
    const sub=(path,fn)=>window.PoladentData?.subscribe
      ? window.PoladentData.subscribe(path,fn)
      : db.ref(path).on("value",fn);

    sub("empleados",snap=>{state.current=snap.val()||{};renderDirectory();});
    sub("marcaciones",snap=>{state.marks=snap.val()||{};renderDirectory();});
    sub("nomina_recibos",snap=>{state.payroll=snap.val()||{};renderDirectory();});
    sub("dias_libres_empleado",snap=>{state.freeDays=snap.val()||{};renderDirectory();});
    sub("directorio_empleados_ocultos",snap=>{state.hidden=snap.val()||{};renderDirectory();});
  } else {
    renderDirectory();
  }
}
function loadEmpleados() {
  cargarEmpleados();
}

async function cambiarEstadoEmpleado(id, archivadoActual = false) {
  const accion = archivadoActual ? "reactivar" : "archivar";
  const mensaje = archivadoActual
    ? "¿Reactivar este funcionario? Volverá a poder marcar asistencia."
    : "¿Archivar este funcionario? Su historial, marcaciones, días libres, nómina y auditoría se conservarán.";
  if (!confirm(mensaje)) return;
  try {
    const snap = await db.ref("empleados/" + id).once("value");
    const emp = snap.val() || {};
    const ahora = Date.now();
    await db.ref("empleados/" + id).update({
      activo: archivadoActual,
      archivado: !archivadoActual,
      estado: archivadoActual ? "activo" : "archivado",
      estadoActualizadoEn: ahora
    });
    await db.ref("auditoria_ediciones/empleados_estado/" + id + "/" + ahora).set({
      empleadoId: id,
      empleadoNombre: emp.nombre || "Empleado",
      accion,
      estadoAnterior: archivadoActual ? "archivado" : "activo",
      estadoNuevo: archivadoActual ? "activo" : "archivado",
      editadoEn: ahora,
      editadoPor: (firebase.auth?.().currentUser?.email || firebase.auth?.().currentUser?.uid || "Administrador"),
      conservaHistorial: true
    });
  } catch (error) {
    console.error("No se pudo cambiar el estado del funcionario:", error);
    alert("No se pudo cambiar el estado del funcionario. No se eliminó ningún historial.");
  }
}

// Compatibilidad con botones antiguos: nunca elimina historial.
function borrarEmpleado(id) {
  return cambiarEstadoEmpleado(id, false);
}

async function eliminarFichaEmpleado(id) {
  try {
    const snap = await db.ref("empleados/" + id).once("value");
    const emp = snap.val();
    if (!emp) {
      alert("Esta ficha ya no existe en la lista actual. El historial permanece conservado.");
      return;
    }
    const archivado = emp.archivado === true || emp.activo === false;
    if (!archivado) {
      alert("Por seguridad, primero archiva al funcionario. Después podrás eliminar únicamente su ficha actual.");
      return;
    }
    const nombre = emp.nombre || "Funcionario";
    const confirmar = confirm(
      `¿Eliminar la ficha actual de ${nombre}?\n\n` +
      `SE CONSERVARÁN sus marcaciones, nómina, días libres y auditoría. ` +
      `El funcionario podrá seguir apareciendo como registro histórico.`
    );
    if (!confirmar) return;

    const texto = prompt(`Escribe ELIMINAR para confirmar que deseas quitar la ficha de ${nombre}.`);
    if (String(texto || "").trim().toUpperCase() !== "ELIMINAR") {
      alert("Operación cancelada.");
      return;
    }

    const ahora = Date.now();
    const usuario = firebase.auth?.().currentUser?.email || firebase.auth?.().currentUser?.uid || "Administrador";
    const resumen = {
      empleadoId:id,
      empleadoNombre:nombre,
      pin:emp.pin || null,
      estadoAnterior:"archivado",
      accion:"ficha_eliminada_historial_conservado",
      eliminadoEn:ahora,
      eliminadoPor:usuario,
      conservaHistorial:true
    };

    // Auditoría primero; luego se quita SOLO la ficha principal.
    await db.ref("auditoria_ediciones/empleados_eliminados/" + id + "/" + ahora).set(resumen);
    await db.ref("empleados/" + id).remove();
    alert("Ficha eliminada. El historial del funcionario se conservó.");
  } catch (error) {
    console.error("No se pudo eliminar la ficha:", error);
    alert("No se pudo eliminar la ficha. No se borró el historial.");
  }
}


async function ocultarRegistroHistorico(id, nombre) {
  if (!id) return;
  const ok = confirm(
    `¿Quitar "${nombre || "este registro"}" de la Lista de empleados?\n\n` +
    `No se borrarán marcaciones, nómina, auditoría ni historial. Solo dejará de aparecer en este directorio.`
  );
  if (!ok) return;
  try {
    const ahora=Date.now();
    const usuario=firebase.auth?.().currentUser?.email || firebase.auth?.().currentUser?.uid || "Administrador";
    const updates={};
    updates[`directorio_empleados_ocultos/${id}`]=true;
    updates[`auditoria_ediciones/directorio_ocultos/${id}/${ahora}`]={
      empleadoId:id,
      empleadoNombre:nombre||"Histórico",
      accion:"ocultar_registro_historico_del_directorio",
      ocultadoEn:ahora,
      ocultadoPor:usuario,
      conservaHistorial:true
    };
    await db.ref().update(updates);
  } catch (error) {
    console.error("No se pudo ocultar el registro histórico:",error);
    alert("No se pudo quitar de la lista. El historial no fue modificado.");
  }
}


async function eliminarEmpleadoCompleto(id, nombre) {
  if (!id) return;
  const actual = (await db.ref("empleados/" + id).once("value")).val();
  if (actual && !(actual.archivado === true || actual.activo === false)) {
    alert("Por seguridad, primero archiva al funcionario antes de eliminarlo completamente.");
    return;
  }

  const ok = confirm(
    `⚠️ ELIMINACIÓN COMPLETA DE ${nombre || "FUNCIONARIO"}\n\n` +
    `Se eliminarán su ficha, marcaciones, días libres, justificaciones, nóminas cerradas/pendientes y registros históricos asociados.\n\n` +
    `Esta acción NO se puede deshacer desde el sistema.`
  );
  if (!ok) return;

  const code = prompt(`Escribe ELIMINAR TODO para confirmar la eliminación completa de ${nombre || "este funcionario"}.`);
  if (String(code || "").trim().toUpperCase() !== "ELIMINAR TODO") {
    alert("Operación cancelada.");
    return;
  }

  try {
    const now = Date.now();
    const user = firebase.auth?.().currentUser?.email || firebase.auth?.().currentUser?.uid || "Administrador";
    const [
      ajustesSnap, recibosSnap, recibosHistSnap, auditNomSnap,
      gpsSnap, secSnap
    ] = await Promise.all([
      db.ref("nomina_ajustes").once("value"),
      db.ref("nomina_recibos").once("value"),
      db.ref("nomina_recibos_historial").once("value"),
      db.ref("auditoria_nomina").once("value"),
      db.ref("alertas_gps").once("value"),
      db.ref("alertas_seguridad").once("value")
    ]);

    const updates = {};
    updates[`empleados/${id}`] = null;
    updates[`marcaciones/${id}`] = null;
    updates[`dias_libres_empleado/${id}`] = null;
    updates[`justificaciones_v44/${id}`] = null;
    updates[`auditoria_ediciones/${id}`] = null;
    updates[`auditoria_ediciones/empleados_estado/${id}`] = null;
    updates[`auditoria_ediciones/empleados_eliminados/${id}`] = null;
    updates[`directorio_empleados_ocultos/${id}`] = null;

    const removePeriodEmployee=(rootName,raw)=>{
      Object.entries(raw||{}).forEach(([periodo,porEmpleado])=>{
        if(porEmpleado && Object.prototype.hasOwnProperty.call(porEmpleado,id)){
          updates[`${rootName}/${periodo}/${id}`]=null;
        }
      });
    };
    removePeriodEmployee("nomina_ajustes", ajustesSnap.val()||{});
    removePeriodEmployee("nomina_recibos", recibosSnap.val()||{});
    removePeriodEmployee("nomina_recibos_historial", recibosHistSnap.val()||{});

    Object.entries(auditNomSnap.val()||{}).forEach(([k,v])=>{
      if(v?.empleado===id || v?.empleadoId===id) updates[`auditoria_nomina/${k}`]=null;
    });
    Object.entries(gpsSnap.val()||{}).forEach(([k,v])=>{
      if(v?.empleadoId===id) updates[`alertas_gps/${k}`]=null;
    });
    Object.entries(secSnap.val()||{}).forEach(([k,v])=>{
      if(v?.empleadoId===id || v?.empleadoAnteriorId===id) updates[`alertas_seguridad/${k}`]=null;
    });

    // Conservamos únicamente una constancia mínima administrativa de que se hizo una eliminación total.
    updates[`auditoria_eliminaciones/${now}`]={
      empleadoId:id,
      empleadoNombre:nombre||actual?.nombre||"Funcionario",
      accion:"eliminacion_completa_solicitada_por_administrador",
      eliminadoEn:now,
      eliminadoPor:user
    };

    await db.ref().update(updates);
    alert("Funcionario eliminado completamente del sistema y del historial visible.");
  } catch (error) {
    console.error("Error en eliminación completa:", error);
    alert("No se pudo completar la eliminación. Revisa la conexión; no se intentará ocultar el error.");
  }
}


async function eliminarRegistroHistoricoPermanente(id, nombre) {
  if (!id) return;
  try {
    const current=(await db.ref(`empleados/${id}`).once("value")).val();
    if(current){
      alert("Este ID todavía tiene una ficha actual. Archívalo y usa Eliminar todo desde la ficha para evitar borrar al funcionario equivocado.");
      return;
    }

    const ok=confirm(
      `¿Eliminar definitivamente el historial antiguo de "${nombre || "este registro"}"?\n\n` +
      `Se eliminarán únicamente los datos históricos asociados a ESTE ID antiguo. ` +
      `No se tocará otro empleado que tenga el mismo nombre.`
    );
    if(!ok)return;
    const code=prompt("Escribe BORRAR HISTORIAL para confirmar.");
    if(String(code||"").trim().toUpperCase()!=="BORRAR HISTORIAL"){
      alert("Operación cancelada.");
      return;
    }

    const [ajustes,recibos,recibosHist,audNom,gps,sec]=await Promise.all([
      db.ref("nomina_ajustes").once("value"),
      db.ref("nomina_recibos").once("value"),
      db.ref("nomina_recibos_historial").once("value"),
      db.ref("auditoria_nomina").once("value"),
      db.ref("alertas_gps").once("value"),
      db.ref("alertas_seguridad").once("value")
    ]);

    const updates={};
    updates[`marcaciones/${id}`]=null;
    updates[`dias_libres_empleado/${id}`]=null;
    updates[`justificaciones_v44/${id}`]=null;
    updates[`directorio_empleados_ocultos/${id}`]=null;

    const cleanPeriods=(rootName,raw)=>{
      Object.entries(raw||{}).forEach(([periodo,byEmp])=>{
        if(byEmp&&Object.prototype.hasOwnProperty.call(byEmp,id))updates[`${rootName}/${periodo}/${id}`]=null;
      });
    };
    cleanPeriods("nomina_ajustes",ajustes.val()||{});
    cleanPeriods("nomina_recibos",recibos.val()||{});
    cleanPeriods("nomina_recibos_historial",recibosHist.val()||{});

    Object.entries(audNom.val()||{}).forEach(([k,v])=>{
      if(v?.empleado===id||v?.empleadoId===id)updates[`auditoria_nomina/${k}`]=null;
    });
    Object.entries(gps.val()||{}).forEach(([k,v])=>{
      if(v?.empleadoId===id)updates[`alertas_gps/${k}`]=null;
    });
    Object.entries(sec.val()||{}).forEach(([k,v])=>{
      if(v?.empleadoId===id||v?.empleadoAnteriorId===id)updates[`alertas_seguridad/${k}`]=null;
    });

    const now=Date.now();
    updates[`auditoria_eliminaciones/${now}`]={
      empleadoId:id,
      empleadoNombre:nombre||"Histórico",
      accion:"eliminacion_historial_id_antiguo",
      eliminadoEn:now,
      eliminadoPor:firebase.auth?.().currentUser?.email||firebase.auth?.().currentUser?.uid||"Administrador"
    };

    await db.ref().update(updates);
    alert("Historial antiguo eliminado. La ficha activa con otro ID no fue modificada.");
  }catch(error){
    console.error("No se pudo eliminar el historial antiguo:",error);
    alert("No se pudo eliminar ese historial. No se modificó la ficha activa.");
  }
}

// ===============================
// ✅ MODAL ASIGNAR SALARIO (SIN PROMPTS)
// ===============================
let salarioEmpIdActual = null;

function showSalarioStatus(msg, isError = false) {
  const box = document.getElementById("salarioStatus");
  if (!box) return;
  box.style.display = "block";
  box.innerText = msg;
  box.style.borderColor = isError ? "rgba(220,53,69,.35)" : "rgba(13,110,253,.25)";
  box.style.background = isError ? "rgba(220,53,69,.08)" : "rgba(13,110,253,.08)";
}
function hideSalarioStatus() {
  const box = document.getElementById("salarioStatus");
  if (!box) return;
  box.style.display = "none";
  box.innerText = "";
}

async function openSalarioModal(empID) {
  salarioEmpIdActual = empID;

  const modal = document.getElementById("salarioModal");
  const back = document.getElementById("salarioModalBackdrop");
  if (!modal || !back) return;

  document.getElementById("salarioValor").value = "";
  document.getElementById("salarioTipo").value = "diario";
  document.getElementById("salarioEmpNombre").value = "";
  hideSalarioStatus();

  const snap = await db.ref("empleados/" + empID).once("value");
  const emp = snap.val();

  if (!emp) {
    showSalarioStatus("⚠️ Empleado no encontrado.", true);
  } else {
    document.getElementById("salarioEmpNombre").value = emp.nombre || "Sin nombre";
    if (emp.salario != null) document.getElementById("salarioValor").value = emp.salario;
    if (emp.tipoSalario) document.getElementById("salarioTipo").value = emp.tipoSalario;
  }

  modal.classList.remove("hidden");
  back.classList.remove("hidden");
}

function closeSalarioModal() {
  document.getElementById("salarioModal")?.classList.add("hidden");
  document.getElementById("salarioModalBackdrop")?.classList.add("hidden");
  hideSalarioStatus();
  salarioEmpIdActual = null;
}

async function saveSalarioModal() {
  try {
    if (!salarioEmpIdActual) return;

    const salarioRaw = document.getElementById("salarioValor").value;
    const salario = parseFloat(String(salarioRaw).replace(",", "."));
    const tipo = document.getElementById("salarioTipo").value;

    if (Number.isNaN(salario) || salario <= 0) {
      showSalarioStatus("⚠️ Ingresa un salario válido (ej: 200 o 200.50).", true);
      return;
    }

    await db.ref("empleados/" + salarioEmpIdActual).update({
      salario,
      tipoSalario: tipo,
    });

    showSalarioStatus("✅ Guardado correctamente.", false);
    loadEmpleados();
    setTimeout(closeSalarioModal, 350);
  } catch (e) {
    console.error("saveSalarioModal error:", e);
    showSalarioStatus("❌ " + (e.message || e), true);
  }
}

document.getElementById("salarioCancelBtn")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioCloseBtn")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioModalBackdrop")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioSaveBtn")?.addEventListener("click", saveSalarioModal);

function asignarSalario(empID) {
  openSalarioModal(empID);
}

// ===============================
// 🔹 EMPLEADO PIN + BOTONES
// ===============================
let empleadoActual = null;
const etapas = ["entrada", "almuerzo_salida", "almuerzo_regreso", "salida"];

function pinInputHandler() {
  const pin = document.getElementById("empPin").value.trim();

  if (!pin) {
    document.getElementById("employeeButtons").classList.add("hidden");
    document.getElementById("empNombreGrande").innerHTML = "";
    return;
  }

  db.ref("empleados")
    .orderByChild("pin")
    .equalTo(pin)
    .once("value", (snap) => {
      if (!snap.exists()) {
        document.getElementById("employeeButtons").classList.add("hidden");
        document.getElementById("empNombreGrande").innerHTML = "";
        document.getElementById("empMsg").innerHTML = "⚠️ PIN no encontrado";
        return;
      }

      let encontradoActivo = false;
      snap.forEach((empSnap) => {
        const empData = empSnap.val() || {};
        if (encontradoActivo || empData.archivado === true || empData.activo === false) return;
        encontradoActivo = true;
        empleadoActual = { id: empSnap.key, nombre: empData.nombre };
        document.getElementById("empNombreGrande").innerHTML = empleadoActual.nombre;
        document.getElementById("employeeButtons").classList.remove("hidden");
        document.getElementById("empMsg").innerHTML = "";
      });
      if (!encontradoActivo) {
        empleadoActual = null;
        document.getElementById("employeeButtons").classList.add("hidden");
        document.getElementById("empNombreGrande").innerHTML = "";
        document.getElementById("empMsg").innerHTML = "⚠️ Funcionario archivado o inactivo";
      }
    });
}

// ===============================
// 🔹 MARCACIÓN
// ===============================
function mark(tipo) {
  // Fase 5: bloqueo de la marcación heredada. La ruta oficial es empleado.html,
  // donde se validan sesión anónima, GPS multisede, cámara y dispositivo.
  if (window.location.pathname && !/empleado\.html$/i.test(window.location.pathname)) {
    console.warn("Marcación heredada bloqueada. Usa empleado.html");
    return;
  }
  if (!empleadoActual) return;

  const now = new Date();
  const yyyy = now.getFullYear(),
    mm = now.getMonth() + 1,
    dd = now.getDate();
  const fecha = `${yyyy}-${mm < 10 ? "0" + mm : mm}-${dd < 10 ? "0" + dd : dd}`;
  const ref = db.ref("marcaciones/" + empleadoActual.id + "/" + fecha);

  ref.once("value", (snap) => {
    const marc = snap.val() ? snap.val() : {};
    let lastEtapa = null,
      lastTime = 0;

    Object.values(marc).forEach((m) => {
      if (m.timestamp && m.timestamp > lastTime) {
        lastTime = m.timestamp;
        lastEtapa = m.tipo;
      }
    });

    const lastIndex = lastEtapa ? etapas.indexOf(lastEtapa) : -1;
    if (lastIndex === -1 && tipo !== "entrada") {
      document.getElementById("empMsg").innerHTML = "⚠️ Debes iniciar con Entrada";
      return;
    }
    if (lastIndex !== -1 && etapas.indexOf(tipo) !== lastIndex + 1) {
      document.getElementById("empMsg").innerHTML = "⚠️ Debes seguir el orden de marcación";
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude,
            lon = pos.coords.longitude;
          const hora = now.toLocaleTimeString(),
            timestamp = now.getTime();

          ref.child(tipo).set({ nombre: empleadoActual.nombre, tipo, fecha, hora, timestamp, lat, lon });

          let frase = "";
          if (tipo === "entrada") frase = "¡Buen inicio de jornada!";
          if (tipo === "almuerzo_salida") frase = "Buen provecho 🍽️";
          if (tipo === "almuerzo_regreso") frase = "Bienvenido de vuelta 👋";
          if (tipo === "salida") frase = "¡Buen trabajo!";

          document.getElementById("empMsg").innerHTML = `${empleadoActual.nombre} | ${frase} (${hora})`;
          mostrarNotificacion(`${empleadoActual.nombre} marcó ${tipo} a las ${hora}`);

          setTimeout(backHome, 2000);
          loadMarcaciones();
          updateChart();
        },
        () => alert("No se pudo obtener la ubicación GPS")
      );
    } else alert("GPS no disponible");
  });
}

// ===============================
// 🔹 ADMIN – RESUMEN MARCACIONES
// ===============================
let excelRows = [],
  excelSalarial = [],
  allMarcaciones = {};

function loadMarcaciones() {
  window.PoladentData.subscribe("marcaciones", (snap) => {
    allMarcaciones = snap.val() || {};
    renderAdminList(document.getElementById("filterDate").value);
    updateChart();
  });
}

function notificationCard(data, fecha) {
  const labels={entrada:"Entrada",almuerzo_salida:"Salida al almuerzo",almuerzo_regreso:"Regreso del almuerzo",salida:"Salida"};
  const icons={entrada:"🟦",almuerzo_salida:"🍽️",almuerzo_regreso:"↩️",salida:"✅"};
  const tipo=data?.tipo||"";
  const label=labels[tipo]||tipo||"Marcación";
  const icon=icons[tipo]||"🔔";
  return `<article class="notif-pro" data-notif-tipo="${tipo}">
    <div class="notif-pro-icon">${icon}</div>
    <div class="notif-pro-body"><b>${data?.nombre||"Empleado"}</b><span>${label}</span><small>${fecha||data?.fecha||"—"} · ${data?.hora||"Sin hora"}</small></div>
    <span class="notif-pro-badge">${label}</span>
  </article>`;
}

function renderAdminList(dateFilter) {
  const cont = document.getElementById("adminList");
  const notif = document.getElementById("notificaciones");
  if (!cont || !notif) return;

  cont.innerHTML = "";
  notif.innerHTML = "";
  excelRows = [];
  excelSalarial = [];

  const periodo = document.getElementById("periodoResumen")?.value || "diario";
  const desdeVal = fechaDesde?.value || "";
  const hastaVal = fechaHasta?.value || "";
  const labels={entrada:"Entrada",almuerzo_salida:"Salida al almuerzo",almuerzo_regreso:"Regreso del almuerzo",salida:"Salida"};
  const order=["entrada","almuerzo_salida","almuerzo_regreso","salida"];
  const escHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rows=[];

  const inRange=(fecha)=>{
    if(desdeVal && fecha<desdeVal) return false;
    if(hastaVal && fecha>hastaVal) return false;
    if(desdeVal||hastaVal) return true;
    if(periodo==="diario") return !dateFilter || fecha===dateFilter;
    if(dateFilter){
      if(periodo==="mensual") return fecha.startsWith(dateFilter.slice(0,7));
      if(periodo==="quincenal"){
        const day=Number(dateFilter.slice(8,10)), d=Number(fecha.slice(8,10));
        return fecha.startsWith(dateFilter.slice(0,7)) && (day<=15 ? d<=15 : d>=16);
      }
    }
    return true;
  };

  Object.entries(allMarcaciones||{}).forEach(([empID,fechas])=>{
    Object.entries(fechas||{}).forEach(([fecha,dia])=>{
      if(!inRange(fecha)) return;
      const found={};
      Object.entries(dia||{}).forEach(([k,v])=>{
        if(!v||typeof v!=="object") return;
        const tipo=order.includes(k)?k:(order.includes(v.tipo)?v.tipo:null);
        if(tipo && !found[tipo]) found[tipo]=v;
      });
      Object.values(dia||{}).forEach(v=>{
        if(v&&typeof v==="object"&&order.includes(v.tipo)&&!found[v.tipo]) found[v.tipo]=v;
      });
      const first=order.map(x=>found[x]).find(Boolean)||Object.values(dia||{}).find(v=>v&&typeof v==="object")||{};
      const nombre=first.nombre||"Sin nombre";
      if(!Object.keys(found).length) return;
      const calc=window.PoladentAttendance?.calculateDay?.({employee:{},date:fecha,day:dia})||null;
      rows.push({empID,fecha,nombre,dia,found,calc});
      order.forEach(tipo=>{
        const data=found[tipo]; if(!data) return;
        excelRows.push([nombre,fecha,tipo,data.hora||""]);
        excelSalarial.push({empID,nombre,fecha,tipo,timestamp:data.timestamp});
        notif.innerHTML += notificationCard({...data,tipo,nombre}, fecha);
      });
    });
  });

  rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.nombre.localeCompare(b.nombre,"es"));

  const totalJornadas=rows.length;
  const completas=rows.filter(r=>r.found.entrada&&r.found.salida).length;
  const incompletas=totalJornadas-completas;
  const marcaciones=rows.reduce((s,r)=>s+Object.keys(r.found).length,0);

  cont.innerHTML = `
    <div class="marks-pro-summary">
      <div><small>Jornadas mostradas</small><strong>${totalJornadas}</strong></div>
      <div><small>Completas</small><strong>${completas}</strong></div>
      <div><small>Incompletas</small><strong>${incompletas}</strong></div>
      <div><small>Marcaciones</small><strong>${marcaciones}</strong></div>
    </div>
    <div class="marks-pro-list">
      ${rows.length?rows.map(r=>{
        const stage=tipo=>{
          const m=r.found[tipo];
          return `<div class="marks-stage ${m?"done":"missing"}"><small>${labels[tipo]}</small><strong>${m?(m.hora||"Registrada"):"—"}</strong></div>`;
        };
        const hrs=r.calc&&Number.isFinite(Number(r.calc.worked))?Number(r.calc.worked).toFixed(2):"—";
        const status=(r.found.entrada&&r.found.salida)?"Jornada completa":"Marcación incompleta";
        return `<article class="marks-pro-card">
          <div class="marks-pro-head">
            <div><b>${escHtml(r.nombre)}</b><small>${new Date(r.fecha+"T12:00:00").toLocaleDateString("es-VE",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}</small></div>
            <span class="marks-status ${status==="Jornada completa"?"ok":"warn"}">${status}</span>
          </div>
          <div class="marks-stage-grid">${order.map(stage).join("")}</div>
          <div class="marks-pro-foot"><span>Horas registradas: <b>${hrs==="—"?"—":hrs+" h"}</b></span><span>${escHtml(r.fecha)}</span></div>
        </article>`;
      }).join(""):`<div class="marks-empty">No hay marcaciones para el período seleccionado.</div>`}
    </div>`;

  renderPagos();
}
// ===============================
// 🔹 EXPORTACIÓN EXCEL
// ===============================
function exportExcelFiltro() {
  const fecha = document.getElementById("filterDate").value;
  const periodo = document.getElementById("periodoResumen").value;
  const rows = [["Nombre", "Fecha", "Tipo", "Hora"]];

  for (const m of excelRows) {
    const mFecha = m[1];
    if (periodo === "diario" && mFecha !== fecha) continue;
    if (periodo === "quincenal" && !mFecha.startsWith(fecha.substring(0, 7))) continue;
    if (periodo === "mensual" && !mFecha.startsWith(fecha.substring(0, 4) + "-" + fecha.substring(5, 7))) continue;
    rows.push(m);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Resumen");
  XLSX.writeFile(wb, "Poladent_Marcaciones_Filtro.xlsx");
}

async function exportExcelSalarialFiltro() {
  const desde = fechaDesde?.value || "";
  const hasta = fechaHasta?.value || "";
  if (!desde || !hasta || desde > hasta) return alert("Selecciona un rango Desde/Hasta válido.");
  if (!window.PoladentAttendance) return alert("El motor de asistencia todavía no ha cargado.");

  const [empSnap, libresSnap] = await Promise.all([
    readSharedSnapshot("empleados"),
    readSharedSnapshot("dias_libres_empleado")
  ]);
  const empleadosObj = empSnap.val() || {};
  const libresObj = libresSnap.val() || {};
  const wsData = [["Nombre","Fecha","Estado","Horas trabajadas","Horas pagadas","Horas extra","Horas no cumplidas","Pago del día (USD)"]];

  Object.entries(empleadosObj).sort((a,b)=>String(a[1]?.nombre||"").localeCompare(String(b[1]?.nombre||""),"es")).forEach(([id,emp])=>{
    const marks = allMarcaciones?.[id] || {};
    const hasMarks = Object.keys(marks).some(d=>estaEnRango(d,desde,hasta));
    if (emp?.archivado && !hasMarks) return;
    const period = window.PoladentAttendance.calculatePeriod({employee:emp,employeeId:id,from:desde,to:hasta,marks:allMarcaciones||{},holidays:feriadosGlobalCache||{},freeDays:libresObj,paidSunday:true});
    let bank=0,total=0;
    period.days.forEach(d=>{bank+=d.extra;total+=d.pay;wsData.push([emp.nombre||"Sin nombre",d.date,d.label||((d.scheduled)?"Jornada":"No laborable"),d.worked.toFixed(2),d.regular.toFixed(2),d.extra.toFixed(2),d.missing.toFixed(2),d.pay.toFixed(2)])});
    wsData.push([emp.nombre||"Sin nombre","TOTAL","",period.worked.toFixed(2),period.regular.toFixed(2),bank.toFixed(2),period.missing.toFixed(2),total.toFixed(2)]);
  });
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(wsData),"Salario");XLSX.writeFile(wb,`Poladent_Salario_${desde}_${hasta}.xlsx`);
}

// ===============================
// 🔹 CALENDARIO
// ===============================
function setDefaultDate() {
  const today = new Date();
  let month = today.getMonth() + 1;
  if (month < 10) month = "0" + month;
  let day = today.getDate();
  if (day < 10) day = "0" + day;
  const yyyy = today.getFullYear();
  document.getElementById("filterDate").value = `${yyyy}-${month}-${day}`;
}

// ===============================
// 🔹 NOTIFICACIONES
// ===============================
function mostrarNotificacion(text) {
  const notif = document.getElementById("notificaciones");
  if (!notif) return;
  const div = document.createElement("article");
  div.className = "notif-pro";
  div.innerHTML = `<div class="notif-pro-icon">🔔</div><div class="notif-pro-body"><b>Actividad reciente</b><span></span><small>${new Date().toLocaleString("es-VE")}</small></div>`;
  div.querySelector("span").textContent = text;
  notif.prepend(div);
}


async function renderNotificacionesPro() {
  const legacy=document.getElementById("notificaciones");
  const card=legacy?.closest(".card") || document.querySelector("#plu-view-asistencia-notificaciones .plu-view-body");
  if(!card)return;

  if(legacy?.closest(".card")) {
    card.innerHTML=`<div id="notificacionesPro"></div>`;
  } else if(!document.getElementById("notificacionesPro")) {
    card.innerHTML=`<div id="notificacionesPro"></div>`;
  }
  const host=document.getElementById("notificacionesPro");
  if(!host)return;

  const now=new Date();
  const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monthStart=localISO(new Date(now.getFullYear(),now.getMonth(),1));
  const today=localISO(now);

  const previous={
    desde:document.getElementById("notifDesde")?.value||monthStart,
    hasta:document.getElementById("notifHasta")?.value||today,
    emp:document.getElementById("notifEmpleado")?.value||"",
    tipo:document.getElementById("notifTipo")?.value||"todos"
  };

  host.innerHTML=`
    <div class="notif-pro-title">
      <div><h4>🔔 Actividad y notificaciones</h4>
      <p>Consulta marcaciones, intentos GPS y alertas de seguridad sin depender de otra pantalla.</p></div>
    </div>
    <div class="notif-filter-pro">
      <label>Desde<input id="notifDesde" type="date" value="${previous.desde}"></label>
      <label>Hasta<input id="notifHasta" type="date" value="${previous.hasta}"></label>
      <label>Funcionario<select id="notifEmpleado"><option value="">Todos los funcionarios</option></select></label>
      <label>Tipo<select id="notifTipo">
        <option value="todos">Toda la actividad</option>
        <option value="entrada">Entradas</option>
        <option value="almuerzo">Almuerzo</option>
        <option value="salida">Salidas</option>
        <option value="gps">Alertas GPS</option>
        <option value="seguridad">Alertas de seguridad</option>
      </select></label>
      <button id="notifActualizar" type="button">Actualizar</button>
    </div>
    <div class="notif-quick-pro">
      <button type="button" data-notif-range="hoy">Hoy</button>
      <button type="button" data-notif-range="semana">Últimos 7 días</button>
      <button type="button" data-notif-range="mes">Este mes</button>
      <button type="button" id="notifExportar" class="secondary">📗 Exportar actividad</button>
    </div>
    <div id="notifSummaryPro" class="notif-summary-pro"></div>
    <div id="notifListPro" class="notif-list-pro"><div class="free-empty-state">Cargando actividad…</div></div>`;

  try{
    const dbx=firebase.database();
    const [empSnap,marksSnap,gpsSnap,secSnap]=await Promise.all([
      dbx.ref("empleados").once("value"),
      dbx.ref("marcaciones").once("value"),
      dbx.ref("alertas_gps").once("value"),
      dbx.ref("alertas_seguridad").once("value")
    ]);
    const empleados=empSnap.val()||{}, marks=marksSnap.val()||{}, gps=gpsSnap.val()||{}, security=secSnap.val()||{};

    const sel=document.getElementById("notifEmpleado");
    const opts=Object.entries(empleados).filter(([,e])=>e&&e.archivado!==true&&e.activo!==false)
      .sort((a,b)=>String(a[1]?.nombre||"").localeCompare(String(b[1]?.nombre||""),"es"));
    sel.innerHTML='<option value="">Todos los funcionarios</option>'+opts.map(([id,e])=>`<option value="${id}">${String(e.nombre||"Sin nombre").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</option>`).join("");
    if(previous.emp&&empleados[previous.emp])sel.value=previous.emp;
    document.getElementById("notifTipo").value=previous.tipo;

    const events=[];
    const stageLabels={entrada:"Entrada",almuerzo_salida:"Salida al almuerzo",almuerzo_regreso:"Regreso del almuerzo",salida:"Salida"};
    const stageIcons={entrada:"🟦",almuerzo_salida:"🍽️",almuerzo_regreso:"↩️",salida:"✅"};

    Object.entries(marks).forEach(([empId,days])=>{
      Object.entries(days||{}).forEach(([fecha,day])=>{
        const found={};
        Object.entries(day||{}).forEach(([key,val])=>{
          if(!val||typeof val!=="object")return;
          const tipo=["entrada","almuerzo_salida","almuerzo_regreso","salida"].includes(key)?key:val.tipo;
          if(["entrada","almuerzo_salida","almuerzo_regreso","salida"].includes(tipo)&&!found[tipo])found[tipo]=val;
        });
        Object.entries(found).forEach(([tipo,m])=>{
          events.push({
            kind:"marcacion",subtype:tipo,empId,
            nombre:m.nombre||empleados[empId]?.nombre||"Funcionario",
            fecha,
            ts:Number(m.timestamp||0),
            hora:m.hora||"",
            title:stageLabels[tipo]||tipo,
            detail:m.sedeNombre||m.sede||m.sucursal||"",
            icon:stageIcons[tipo]||"🔔"
          });
        });
      });
    });

    Object.entries(gps).forEach(([id,a])=>{
      const ts=Number(a?.timestamp||a?.fechaHora||0);
      const fecha=ts?localISO(new Date(ts)):String(a?.fecha||"").slice(0,10);
      events.push({
        kind:"gps",subtype:"gps",empId:a?.empleadoId||"",
        nombre:a?.empleado||a?.nombreEmpleado||empleados[a?.empleadoId]?.nombre||"Funcionario",
        fecha,ts,
        hora:ts?new Date(ts).toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"}):"",
        title:"Alerta GPS",
        detail:a?.motivo||`${Math.round(Number(a?.distancia||0))} m fuera del área`,
        icon:"📍"
      });
    });

    Object.entries(security).forEach(([id,a])=>{
      const ts=Number(a?.timestamp||a?.fechaHora||a?.creadoEn||0);
      const fecha=ts?localISO(new Date(ts)):String(a?.fecha||"").slice(0,10);
      events.push({
        kind:"seguridad",subtype:"seguridad",empId:a?.empleadoId||"",
        nombre:a?.empleado||a?.nombreEmpleado||empleados[a?.empleadoId]?.nombre||"Funcionario",
        fecha,ts,
        hora:ts?new Date(ts).toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"}):"",
        title:"Alerta de seguridad",
        detail:a?.motivo||a?.tipo||"Evento de seguridad",
        icon:"🛡️"
      });
    });

    const render=()=>{
      const desde=document.getElementById("notifDesde")?.value||"";
      const hasta=document.getElementById("notifHasta")?.value||"";
      const empId=document.getElementById("notifEmpleado")?.value||"";
      const tipo=document.getElementById("notifTipo")?.value||"todos";
      if(!desde||!hasta||desde>hasta){
        document.getElementById("notifListPro").innerHTML='<div class="free-empty-state">Selecciona un rango de fechas válido.</div>';
        return;
      }
      const filtered=events.filter(e=>{
        if(e.fecha&&e.fecha<desde)return false;
        if(e.fecha&&e.fecha>hasta)return false;
        if(empId&&e.empId!==empId)return false;
        if(tipo==="entrada"&&e.subtype!=="entrada")return false;
        if(tipo==="almuerzo"&&!["almuerzo_salida","almuerzo_regreso"].includes(e.subtype))return false;
        if(tipo==="salida"&&e.subtype!=="salida")return false;
        if(tipo==="gps"&&e.kind!=="gps")return false;
        if(tipo==="seguridad"&&e.kind!=="seguridad")return false;
        return true;
      }).sort((a,b)=>(b.ts||0)-(a.ts||0)||String(b.fecha).localeCompare(String(a.fecha)));

      const marksCount=filtered.filter(e=>e.kind==="marcacion").length;
      const gpsCount=filtered.filter(e=>e.kind==="gps").length;
      const secCount=filtered.filter(e=>e.kind==="seguridad").length;
      const people=new Set(filtered.map(e=>e.empId||e.nombre).filter(Boolean)).size;
      document.getElementById("notifSummaryPro").innerHTML=`
        <div><small>Actividad</small><strong>${filtered.length}</strong></div>
        <div><small>Marcaciones</small><strong>${marksCount}</strong></div>
        <div><small>Alertas GPS</small><strong>${gpsCount}</strong></div>
        <div><small>Seguridad</small><strong>${secCount}</strong></div>
        <div><small>Funcionarios</small><strong>${people}</strong></div>`;

      const list=document.getElementById("notifListPro");
      list.innerHTML=filtered.length?filtered.map(e=>`
        <article class="notif-pro notif-pro-full ${e.kind==="gps"||e.kind==="seguridad"?"notif-alert":""}">
          <div class="notif-pro-icon">${e.icon}</div>
          <div class="notif-pro-body"><b>${e.nombre}</b><span>${e.title}${e.detail?` · ${e.detail}`:""}</span><small>${e.fecha||"Sin fecha"}${e.hora?` · ${e.hora}`:""}</small></div>
          <span class="notif-pro-badge">${e.kind==="marcacion"?"Marcación":e.kind==="gps"?"GPS":"Seguridad"}</span>
        </article>`).join(""):`<div class="free-empty-state">No hay actividad para los filtros seleccionados.</div>`;

      window.__notifFilteredRows=filtered;
    };

    ["notifDesde","notifHasta","notifEmpleado","notifTipo"].forEach(id=>document.getElementById(id)?.addEventListener("change",render));
    document.getElementById("notifActualizar").onclick=render;
    document.querySelectorAll("[data-notif-range]").forEach(b=>b.onclick=()=>{
      const type=b.dataset.notifRange;
      const end=new Date(),start=new Date(end);
      if(type==="hoy"){}
      if(type==="semana")start.setDate(end.getDate()-6);
      if(type==="mes")start.setDate(1);
      document.getElementById("notifDesde").value=localISO(start);
      document.getElementById("notifHasta").value=localISO(end);
      render();
    });
    document.getElementById("notifExportar").onclick=()=>{
      const rows=window.__notifFilteredRows||[];
      if(!rows.length)return alert("No hay actividad para exportar.");
      if(!window.XLSX)return alert("El exportador Excel todavía no está disponible.");
      const data=[["Fecha","Hora","Funcionario","Tipo","Detalle"]];
      rows.forEach(e=>data.push([e.fecha||"",e.hora||"",e.nombre||"",e.title||"",e.detail||""]));
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),"Actividad");
      XLSX.writeFile(wb,`Poladent_Actividad_${document.getElementById("notifDesde").value}_${document.getElementById("notifHasta").value}.xlsx`);
    };
    render();
  }catch(error){
    console.error("[Poladent] Notificaciones:",error);
    document.getElementById("notifListPro").innerHTML='<div class="free-empty-state">No se pudo cargar la actividad. Revisa la conexión y vuelve a abrir Notificaciones.</div>';
  }
}
window.renderNotificacionesPro=renderNotificacionesPro;

// ===============================
// 🔹 GRÁFICO HORAS
// ===============================
function renderChart(startDate = "", endDate = "", periodo = "diario", dateFilter = "") {
  const canvas = document.getElementById("horasChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let chartData = {
    labels: [],
    datasets: [{ label: "Horas trabajadas", data: [], backgroundColor: "rgba(0,123,255,0.5)" }],
  };

  const filtroInicio = startDate ? new Date(startDate + "T00:00:00") : null;
  const filtroFin = endDate ? new Date(endDate + "T00:00:00") : null;
  const resumenHoras = {};

  for (const empID in allMarcaciones) {
    const fechas = allMarcaciones[empID] || {};
    for (const fecha in fechas) {
      const fechaObj = new Date(fecha + "T00:00:00");
      if (filtroInicio && fechaObj < filtroInicio) continue;
      if (filtroFin && fechaObj > filtroFin) continue;

      const tipos = fechas[fecha] || {};
      let entrada = null, salida = null;
      Object.values(tipos).forEach((m) => {
        if (m.tipo === "entrada") entrada = m.timestamp;
        if (m.tipo === "salida") salida = m.timestamp;
      });
      if (!entrada || !salida) continue;

      const nombre = Object.values(tipos)[0]?.nombre || "Sin nombre";
      if (!resumenHoras[nombre]) resumenHoras[nombre] = 0;
      resumenHoras[nombre] += (salida - entrada) / 3600000;
    }
  }

  chartData.labels = Object.keys(resumenHoras);
  chartData.datasets[0].data = Object.values(resumenHoras);

  if (window.horasChartInstance) window.horasChartInstance.destroy();
  window.horasChartInstance = new Chart(ctx, {
    type: "bar",
    data: chartData,
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
}

function updateChart() {
  const start = fechaDesde?.value || "";
  const end = fechaHasta?.value || "";
  const periodo = document.getElementById("periodoResumen")?.value || "diario";
  const filtroFecha = document.getElementById("filterDate")?.value || "";
  renderChart(start, end, periodo, filtroFecha);
}

// ===============================
// 🔽 MINIMIZAR / EXPANDIR
// ===============================
function toggleSection(id) {
  const el = document.getElementById(id);
  const header = el?.previousElementSibling;
  if (!el || !header) return;

  if (el.style.display === "none") {
    el.style.display = "block";
    header.innerHTML = header.innerHTML.replace("▲", "▼");
  } else {
    el.style.display = "none";
    header.innerHTML = header.innerHTML.replace("▼", "▲");
  }
}

// ===============================
// 🔹 RANGO FECHAS + DOMINGO
// ===============================
function estaEnRango(fecha, desde, hasta) {
  const f = new Date(fecha + "T00:00:00");
  const d = desde ? new Date(desde + "T00:00:00") : null;
  const h = hasta ? new Date(hasta + "T00:00:00") : null;
  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

function esDomingo(fechaYYYYMMDD) {
  const dt = new Date(fechaYYYYMMDD + "T00:00:00");
  return dt.getDay() === 0;
}

function rangoFechasIncluye(desde, hasta) {
  if (!desde || !hasta) return [];
  const out = [];
  let d = new Date(desde + "T00:00:00");
  const end = new Date(hasta + "T00:00:00");
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ==================================================
// ✅ FERIADOS GLOBALES (cache + modal + lista)
// Guarda: feriados_global/YYYY-MM-DD
// ==================================================
let feriadosGlobalCache = {}; // { "YYYY-MM-DD": { motivo, horas, creadoEn } }

function loadFeriadosGlobalCache() {
  try {
    window.PoladentData.subscribe("feriados_global", (snap) => {
      feriadosGlobalCache = snap.val() || {};
      try { renderPagos(); } catch (e) {}
    });
  } catch (e) {}
}

function getFeriadoGlobal(fechaYYYYMMDD) {
  return feriadosGlobalCache?.[fechaYYYYMMDD] || null;
}

function openFeriadoModal() {
  const modal = document.getElementById("feriadoModal");
  const back = document.getElementById("feriadoModalBackdrop");
  if (!modal || !back) return;

  document.getElementById("feriadoFecha").value = "";
  document.getElementById("feriadoMotivo").value = "";
  modal.classList.remove("hidden");
  back.classList.remove("hidden");
}

function closeFeriadoModal() {
  document.getElementById("feriadoModal")?.classList.add("hidden");
  document.getElementById("feriadoModalBackdrop")?.classList.add("hidden");
}

async function saveFeriadoGlobal() {
  const fecha = document.getElementById("feriadoFecha")?.value || "";
  const motivo = (document.getElementById("feriadoMotivo")?.value || "").trim();

  if (!fecha) return alert("Selecciona una fecha.");

  await db.ref("feriados_global/" + fecha).set({
    motivo: motivo || "Feriado pagado",
    horas: HORAS_JORNADA,
    creadoEn: Date.now(),
    creadoPor: "admin",
  });

  closeFeriadoModal();
  renderListaFeriadosGlobal();
  renderAdminList(document.getElementById("filterDate")?.value || "");
  updateChart();
}

async function eliminarFeriadoGlobal(fecha) {
  if (!confirm("¿Eliminar este feriado global?")) return;
  await db.ref("feriados_global/" + fecha).remove();
  renderListaFeriadosGlobal();
  renderAdminList(document.getElementById("filterDate")?.value || "");
  updateChart();
}

function renderListaFeriadosGlobal() {
  const cont=document.getElementById("listaFeriados");
  if(!cont)return;
  const render=(data)=>{
    const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const rows=Object.entries(data||{}).map(([fecha,f])=>({fecha,...(f||{})})).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const upcoming=rows.filter(x=>x.fecha>=today).length,past=rows.length-upcoming;
    cont.innerHTML=`
      <div class="holiday-summary-pro">
        <div><small>Total registrados</small><strong>${rows.length}</strong></div>
        <div><small>Próximos</small><strong>${upcoming}</strong></div>
        <div><small>Pasados</small><strong>${past}</strong></div>
        <p>Los feriados globales pagan 8 horas a todos los funcionarios aunque no realicen marcación.</p>
      </div>
      <div class="holiday-list-pro">
        ${rows.length?rows.map(x=>{
          const d=new Date(x.fecha+"T12:00:00");
          const nice=d.toLocaleDateString("es-VE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
          const future=x.fecha>=today;
          return `<article class="holiday-card-pro">
            <div class="holiday-date-pro"><b>${String(d.getDate()).padStart(2,"0")}</b><span>${d.toLocaleDateString("es-VE",{month:"short"})}</span></div>
            <div class="holiday-info-pro"><strong>${x.motivo||"Feriado pagado"}</strong><span>${nice}</span><small>✅ 8 horas pagadas · ${future?"Próximo":"Registrado"}</small></div>
            <button class="danger" onclick="eliminarFeriadoGlobal('${x.fecha}')">🗑️ Eliminar</button>
          </article>`;
        }).join(""):`<div class="free-empty-state">No hay feriados globales registrados.</div>`}
      </div>`;
  };
  if(window.PoladentData?.subscribe){
    if(!window.__feriadosProSubscribed){
      window.__feriadosProSubscribed=true;
      window.PoladentData.subscribe("feriados_global",snap=>render(snap.val()||{}));
    }else{
      const cached=window.PoladentData.getValue?.("feriados_global",{});
      render(cached||{});
    }
  }else{
    firebase.database().ref("feriados_global").once("value").then(s=>render(s.val()||{})).catch(e=>{
      console.error("[Poladent] Feriados:",e);
      cont.innerHTML='<div class="free-empty-state">No se pudieron cargar los feriados.</div>';
    });
  }
}
// listeners feriado
document.getElementById("btnFeriadoGlobal")?.addEventListener("click", openFeriadoModal);
document.getElementById("feriadoCloseBtn")?.addEventListener("click", closeFeriadoModal);
document.getElementById("feriadoCancelBtn")?.addEventListener("click", closeFeriadoModal);
document.getElementById("feriadoModalBackdrop")?.addEventListener("click", closeFeriadoModal);
document.getElementById("feriadoSaveBtn")?.addEventListener("click", saveFeriadoGlobal);

// global onclick
window.eliminarFeriadoGlobal = eliminarFeriadoGlobal;

// ==================================================
// ✅ MODAL EDITAR HORARIO (ADMIN)
// ==================================================
let empleadosCache = {};

async function cargarEmpleadosParaModal() {
  empleadosCache = {};
  const snap = await readSharedSnapshot("empleados");
  snap.forEach((emp) => {
    empleadosCache[emp.key] = emp.val();
  });

  fillEmployeeSelect();
  fillLibreEmpSelect(); // ✅ para modal libre
}

function fillEmployeeSelect(selectedId = null) {
  const sel = document.getElementById("editEmpSelect");
  if (!sel) return;

  const current = selectedId || sel.value || "";
  const ids = Object.keys(empleadosCache);

  sel.innerHTML = ids
    .map((id) => {
      const n = empleadosCache[id]?.nombre || "Sin nombre";
      return `<option value="${id}">${n}</option>`;
    })
    .join("");

  if (current && ids.includes(current)) sel.value = current;
}

function fillHourSelect() {
  const sel = document.getElementById("editHora");
  if (!sel) return;

  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      opts.push(`<option value="${hh}:${mm}">${hh}:${mm}</option>`);
    }
  }
  sel.innerHTML = opts.join("");
}

function showEditStatus(msg, isError = false) {
  const box = document.getElementById("editStatus");
  if (!box) return;
  box.style.display = "block";
  box.innerText = msg;
  box.style.borderColor = isError ? "rgba(220,53,69,.35)" : "rgba(13,110,253,.25)";
  box.style.background = isError ? "rgba(220,53,69,.08)" : "rgba(13,110,253,.08)";
}

function hideEditStatus() {
  const box = document.getElementById("editStatus");
  if (!box) return;
  box.style.display = "none";
  box.innerText = "";
}

function parseHoraHHMM(hhmm) {
  const m = String(hhmm).trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
}

function buildTimestampLocal(fechaYYYYMMDD, hhmm) {
  const t = parseHoraHHMM(hhmm);
  if (!t) return null;
  const [y, mo, d] = fechaYYYYMMDD.split("-").map((n) => parseInt(n, 10));
  return new Date(y, mo - 1, d, t.hour, t.minute, 0, 0).getTime();
}

async function openEditModal(preselectEmpId = null) {
  const modal = document.getElementById("editModal");
  const back = document.getElementById("editModalBackdrop");
  if (!modal || !back) return;

  await cargarEmpleadosParaModal();
  fillEmployeeSelect(preselectEmpId);
  fillHourSelect();

  const f = document.getElementById("editFecha");
  if (f) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    if (!f.value) f.value = `${yyyy}-${mm}-${dd}`;
  }

  const h = document.getElementById("editHora");
  if (h && !h.value) h.value = "08:00";

  hideEditStatus();
  modal.classList.remove("hidden");
  back.classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal")?.classList.add("hidden");
  document.getElementById("editModalBackdrop")?.classList.add("hidden");
  hideEditStatus();
}

document.getElementById("editCancelBtn")?.addEventListener("click", closeEditModal);
document.getElementById("editCloseBtn")?.addEventListener("click", closeEditModal);
document.getElementById("editModalBackdrop")?.addEventListener("click", closeEditModal);
document.getElementById("editSaveBtn")?.addEventListener("click", saveEditHorario);

async function saveEditHorario() {
  try {
    const empId = document.getElementById("editEmpSelect").value;
    const fecha = document.getElementById("editFecha").value;
    const tipo = document.getElementById("editTipo").value;
    const hora = document.getElementById("editHora").value;

    if (!empId || !empleadosCache[empId]) return showEditStatus("⚠️ Selecciona un empleado válido.", true);
    if (!fecha) return showEditStatus("⚠️ Selecciona una fecha.", true);

    const ts = buildTimestampLocal(fecha, hora);
    if (!ts) return showEditStatus("⚠️ Hora inválida.", true);

    const empNombre = empleadosCache[empId].nombre || "Sin nombre";
    const ref = db.ref(`marcaciones/${empId}/${fecha}/${tipo}`);

    const prevSnap = await ref.once("value");
    const prevVal = prevSnap.val();
    const editStamp = Date.now();

    const authUser = firebase.auth?.().currentUser || null;
    const editor = authUser?.email || authUser?.uid || "admin";
    // Conserva toda la evidencia previa (GPS, foto, sede, dispositivo, etc.) y solo corrige la hora.
    const nextVal = {
      ...(prevVal || {}),
      nombre: empNombre,
      tipo,
      fecha,
      hora,
      timestamp: ts,
      editado: true,
      editadoEn: editStamp,
      editadoPor: editor,
      motivoEdicion: prevVal ? "Corrección manual de hora" : "Marcación agregada manualmente",
      origenEdicion: "modal_clasico"
    };
    const auditPath = `auditoria_ediciones/${empId}/${fecha}/${tipo}/${editStamp}`;
    const markPath = `marcaciones/${empId}/${fecha}/${tipo}`;
    const rootUpdates = {};
    rootUpdates[auditPath] = {
      empleado: empNombre,
      empleadoId: empId,
      fecha,
      tipo,
      accion: prevVal ? "modificar" : "crear",
      antes: prevVal || null,
      despues: nextVal,
      editadoEn: editStamp,
      editadoPor: editor,
      origen: "modal_clasico"
    };
    rootUpdates[markPath] = nextVal;
    // Escritura atómica: o se guardan marcación y auditoría juntas, o no se guarda ninguna.
    await db.ref().update(rootUpdates);

    showEditStatus(`✅ Guardado: ${empNombre} | ${tipo} | ${fecha} | ${hora}`, false);

    loadMarcaciones();
    updateChart();
    setTimeout(closeEditModal, 650);
  } catch (e) {
    console.error("saveEditHorario error:", e);
    showEditStatus("❌ " + (e.message || e), true);
  }
}

// ==================================================
// ✅ DÍAS LIBRES PAGADOS POR EMPLEADO (MODAL + EDITAR)
// Guarda: dias_libres_empleado/{empId}/{fecha}
// ==================================================
let libreEditMode = { empId: null, fecha: null };

function showLibreStatus(msg, isError = false) {
  const box = document.getElementById("libreStatus");
  if (!box) return;
  box.style.display = "block";
  box.innerText = msg;
  box.style.borderColor = isError ? "rgba(220,53,69,.35)" : "rgba(13,110,253,.25)";
  box.style.background = isError ? "rgba(220,53,69,.08)" : "rgba(13,110,253,.08)";
}

function hideLibreStatus() {
  const box = document.getElementById("libreStatus");
  if (!box) return;
  box.style.display = "none";
  box.innerText = "";
}

function fillLibreEmpSelect(preselectId = null) {
  const sel = document.getElementById("libreEmpSelect");
  if (!sel) return;

  const ids = Object.keys(empleadosCache || {});
  sel.innerHTML = ids
    .map((id) => {
      const n = empleadosCache[id]?.nombre || "Sin nombre";
      return `<option value="${id}">${n}</option>`;
    })
    .join("");

  if (preselectId && ids.includes(preselectId)) sel.value = preselectId;
}

async function openLibreModal(empId = null, fecha = null, motivo = "") {
  const modal = document.getElementById("libreModal");
  const back = document.getElementById("libreModalBackdrop");
  if (!modal || !back) return;

  try {
    await cargarEmpleadosParaModal();
  } catch (error) {
    console.error("[Poladent] No se pudieron cargar funcionarios para día libre:", error);
  }
  fillLibreEmpSelect(empId);

  const f = document.getElementById("libreFecha");
  if (f) {
    if (fecha) f.value = fecha;
    else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      f.value = `${yyyy}-${mm}-${dd}`;
    }
  }

  document.getElementById("libreMotivo").value = motivo || "";
  hideLibreStatus();

  libreEditMode = { empId, fecha };

  modal.classList.remove("hidden");
  back.classList.remove("hidden");
}

function closeLibreModal() {
  document.getElementById("libreModal")?.classList.add("hidden");
  document.getElementById("libreModalBackdrop")?.classList.add("hidden");
  hideLibreStatus();
  libreEditMode = { empId: null, fecha: null };
}

async function saveLibreModal() {
  try {
    const empId = document.getElementById("libreEmpSelect")?.value || "";
    const fecha = document.getElementById("libreFecha")?.value || "";
    const motivo = (document.getElementById("libreMotivo")?.value || "").trim();

    if (!empId) return showLibreStatus("⚠️ Selecciona un empleado.", true);
    if (!fecha) return showLibreStatus("⚠️ Selecciona una fecha.", true);

    if (libreEditMode.empId && libreEditMode.fecha) {
      const changed = libreEditMode.empId !== empId || libreEditMode.fecha !== fecha;
      if (changed) {
        await db.ref(`dias_libres_empleado/${libreEditMode.empId}/${libreEditMode.fecha}`).remove();
      }
    }

    await db.ref(`dias_libres_empleado/${empId}/${fecha}`).set({
      pagado: true,
      horas: HORAS_JORNADA,
      motivo: motivo || null,
      actualizadoEn: Date.now(),
      actualizadoPor: "admin",
    });

    showLibreStatus("✅ Guardado.", false);

    await renderListaLibresEmpleado();
    renderAdminList(document.getElementById("filterDate")?.value || "");
    updateChart();

    setTimeout(closeLibreModal, 450);
  } catch (e) {
    console.error(e);
    showLibreStatus("❌ Error: " + (e.message || e), true);
  }
}

async function renderListaLibresEmpleado() {
  const cont=document.getElementById("listaLibresEmpleado");
  if(!cont)return;
  cont.innerHTML=`<div class="free-empty-state">Cargando funcionarios y días libres…</div>`;
  try{
    const [empSnap,freeSnap]=await Promise.all([
      firebase.database().ref("empleados").once("value"),
      firebase.database().ref("dias_libres_empleado").once("value")
    ]);
    empleadosCache=empSnap.val()||{};
    fillLibreEmpSelect();

    const all=freeSnap.val()||{},rows=[];
    Object.entries(all).forEach(([empId,dias])=>{
      Object.entries(dias||{}).forEach(([fecha,data])=>{
        const emp=empleadosCache[empId]||{};
        rows.push({
          empId,fecha,
          nombre:emp.nombre||data?.empleadoNombre||"Funcionario sin ficha actual",
          motivo:data?.motivo||"",
          horas:Number(data?.horas||HORAS_JORNADA),
          pagado:data?.pagado!==false,
          historico:!empleadosCache[empId]
        });
      });
    });
    rows.sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.nombre.localeCompare(b.nombre,"es"));

    const activeCount=Object.values(empleadosCache).filter(e=>e&&e.archivado!==true&&e.activo!==false).length;
    cont.innerHTML=`
      <div class="free-summary-pro">
        <div><small>Funcionarios disponibles</small><strong>${activeCount}</strong></div>
        <div><small>Días libres registrados</small><strong>${rows.length}</strong></div>
        <div><small>Regla de pago</small><strong>8 h</strong></div>
        <p>Un día libre pagado acredita 8 horas aunque el funcionario no realice marcaciones ese día.</p>
      </div>
      <div class="free-toolbar">
        <div class="emp-directory-search"><span>🔎</span><input id="freeSearch" type="search" placeholder="Buscar funcionario o motivo"></div>
        <input id="freeMonth" type="month" aria-label="Filtrar por mes">
        <span id="freeCount" class="emp-directory-count"></span>
      </div>
      <div id="freeCards" class="free-cards"></div>`;

    const render=()=>{
      const q=(document.getElementById("freeSearch")?.value||"").trim().toLowerCase();
      const month=document.getElementById("freeMonth")?.value||"";
      const filtered=rows.filter(r=>(!q||`${r.nombre} ${r.motivo}`.toLowerCase().includes(q))&&(!month||r.fecha.startsWith(month)));
      const count=document.getElementById("freeCount");
      if(count)count.textContent=`${filtered.length} registro${filtered.length===1?"":"s"}`;
      const box=document.getElementById("freeCards");if(!box)return;
      box.innerHTML=filtered.length?filtered.map(r=>`
        <article class="free-card ${r.historico?"free-historic":""}">
          <div class="free-date"><span>${new Date(r.fecha+"T00:00:00").toLocaleDateString("es-VE",{day:"2-digit",month:"short"})}</span><small>${r.fecha}</small></div>
          <div class="free-info"><b>${r.nombre}</b><span>${r.motivo||"Día libre pagado"}</span><small>✅ ${r.horas} horas pagadas${r.historico?" · ficha histórica":""}</small></div>
          <div class="free-actions"><button onclick="uiEditarDiaLibre('${r.empId}','${r.fecha}')">✏️ Editar</button><button class="danger" onclick="uiBorrarDiaLibre('${r.empId}','${r.fecha}')">🗑️</button></div>
        </article>`).join(""):`<div class="free-empty-state">No hay días libres pagados para este filtro.</div>`;
    };
    document.getElementById("freeSearch")?.addEventListener("input",render);
    document.getElementById("freeMonth")?.addEventListener("change",render);
    render();
  }catch(error){
    console.error("[Poladent] Días libres:",error);
    cont.innerHTML=`<div class="free-empty-state">No se pudieron cargar los días libres. Revisa la conexión y vuelve a abrir esta sección.</div>`;
  }
}
window.uiEditarDiaLibre = async function (empId, fecha) {
  const snap = await db.ref(`dias_libres_empleado/${empId}/${fecha}`).once("value");
  const data = snap.val() || {};
  openLibreModal(empId, fecha, data.motivo || "");
};

window.uiBorrarDiaLibre = async function (empId, fecha) {
  if (!confirm(`¿Borrar día libre pagado ${fecha}?`)) return;
  await db.ref(`dias_libres_empleado/${empId}/${fecha}`).remove();
  await renderListaLibresEmpleado();
  renderAdminList(document.getElementById("filterDate")?.value || "");
  updateChart();
};

// listeners libre
document.getElementById("btnOpenLibreModal")?.addEventListener("click", () => openLibreModal());
document.getElementById("libreCloseBtn")?.addEventListener("click", closeLibreModal);
document.getElementById("libreCancelBtn")?.addEventListener("click", closeLibreModal);
document.getElementById("libreModalBackdrop")?.addEventListener("click", closeLibreModal);
document.getElementById("libreSaveBtn")?.addEventListener("click", saveLibreModal);

// ==================================================
// ✅ EXTRA PRO (CÁLCULO ÚNICO)
// ==================================================
function tarifaPorHoraUSD(salario, tipoSalario) {
  if (window.PoladentAttendance) return window.PoladentAttendance.hourlyRate({ salario, tipoSalario });
  const s = Number(salario || 0);
  const t = String(tipoSalario || "diario").toLowerCase();
  if (t === "quincenal") return s / (15 * HORAS_JORNADA);
  if (t === "mensual") return s / (30 * HORAS_JORNADA);
  return s / HORAS_JORNADA;
}

// ✅ Base: domingo/feriado/desc.
function calcularDiaBase(timestampsDia, fechaYYYYMMDD, tarifaHora) {
  const feriado = getFeriadoGlobal(fechaYYYYMMDD);
  const domingo = esDomingo(fechaYYYYMMDD);

  const entrada = timestampsDia?.entrada || null;
  const salida = timestampsDia?.salida || null;
  const aS = timestampsDia?.almuerzo_salida || null;
  const aR = timestampsDia?.almuerzo_regreso || null;

  // ✅ feriado global pagado si no marcó
  if (feriado && (!entrada || !salida)) {
    return {
      normales: HORAS_JORNADA,
      extra: 0,
      noTrab: 0,
      pagoDia: HORAS_JORNADA * tarifaHora,
      descuentoDia: 0,
      etiqueta: `Feriado pagado${feriado?.motivo ? ": " + feriado.motivo : ""}`,
    };
  }

  // ✅ domingo pagado si no marcó
  if (domingo && (!entrada || !salida)) {
    return {
      normales: HORAS_JORNADA,
      extra: 0,
      noTrab: 0,
      pagoDia: HORAS_JORNADA * tarifaHora,
      descuentoDia: 0,
      etiqueta: "Domingo libre pagado",
    };
  }

  const etiquetaFeriadoTrabajado = feriado ? `Feriado trabajado${feriado?.motivo ? ": " + feriado.motivo : ""}` : "";

  // ✅ día normal (o feriado/domingo con marcación incompleta) = descuento
  if (!entrada || !salida) {
    return {
      normales: 0,
      extra: 0,
      noTrab: HORAS_JORNADA,
      pagoDia: 0,
      descuentoDia: HORAS_JORNADA * tarifaHora,
      etiqueta: "Sin marcación completa (descuento)",
    };
  }

  // ✅ cálculo normal
  let almuerzo = 0;
  if (aS && aR) almuerzo = (aR - aS) / 3600000;

  let horas = (salida - entrada) / 3600000 - almuerzo;
  if (!Number.isFinite(horas) || horas < 0) horas = 0;

  const normales = Math.min(HORAS_JORNADA, horas);
  const extra = Math.max(0, horas - HORAS_JORNADA);
  const noTrab = Math.max(0, HORAS_JORNADA - normales);

  return {
    normales,
    extra,
    noTrab,
    pagoDia: normales * tarifaHora,
    descuentoDia: noTrab * tarifaHora,
    etiqueta: etiquetaFeriadoTrabajado || "",
  };
}

// ✅ Wrapper: aplica libre por empleado si existe
function calcularDia(timestampsDia, fechaYYYYMMDD, tarifaHora, overrideLibre = null, empData = {}) {
  if (window.PoladentAttendance) {
    const r = window.PoladentAttendance.calculateDay({
      employee: empData || {}, date: fechaYYYYMMDD, day: timestampsDia || {},
      holiday: getFeriadoGlobal(fechaYYYYMMDD), freeDay: overrideLibre, paidSunday: true
    });
    return { normales:r.regular, extra:r.extra, noTrab:r.missing, pagoDia:r.pay, descuentoDia:r.discount, etiqueta:r.label, horasTrabajadas:r.worked, programadas:r.planned, laborable:r.scheduled };
  }
  if (overrideLibre && overrideLibre.pagado) return {normales:HORAS_JORNADA,extra:0,noTrab:0,pagoDia:HORAS_JORNADA*tarifaHora,descuentoDia:0,etiqueta:overrideLibre.motivo?`Libre pagado: ${overrideLibre.motivo}`:"Libre pagado"};
  return calcularDiaBase(timestampsDia, fechaYYYYMMDD, tarifaHora);
}

// ==================================================
// ✅ RESUMEN PAGOS (con feriados + domingos + libres empleado)
// ==================================================
async function renderPagos() {
  const cont=document.getElementById("resumenPagos"); if(!cont)return;
  if(!window.PoladentAttendance){
    cont.innerHTML='<h4>💰 Resumen de pagos y banco de horas (USD)</h4><p>Motor de asistencia cargando…</p>';
    return;
  }

  // Esta pantalla tiene filtros propios. Ya no depende de Resumen de marcaciones.
  const now=new Date();
  const isoLocal=d=>window.PoladentAttendance?.isoLocal(d)||`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monthFrom=isoLocal(new Date(now.getFullYear(),now.getMonth(),1));
  const monthTo=isoLocal(new Date(now.getFullYear(),now.getMonth()+1,0));

  let desde=document.getElementById("payBankDesde")?.value||monthFrom;
  let hasta=document.getElementById("payBankHasta")?.value||monthTo;
  let empFiltro=document.getElementById("payBankEmpleado")?.value||"";

  const [empSnap,libresSnap,recibosSnap,marksSnap,holidaysSnap]=await Promise.all([
    firebase.database().ref("empleados").once("value"),
    firebase.database().ref("dias_libres_empleado").once("value"),
    firebase.database().ref("nomina_recibos").once("value"),
    firebase.database().ref("marcaciones").once("value"),
    firebase.database().ref("feriados_global").once("value")
  ]);
  const empleadosObj=empSnap.val()||{}, libresObj=libresSnap.val()||{}, todosRecibos=recibosSnap.val()||{};
  const marcasResumen=marksSnap.val()||{}, feriadosResumen=holidaysSnap.val()||{};

  const options=Object.entries(empleadosObj)
    .sort((a,b)=>String(a[1]?.nombre||"").localeCompare(String(b[1]?.nombre||""),"es"))
    .map(([id,e])=>`<option value="${id}" ${id===empFiltro?"selected":""}>${e.nombre||"Sin nombre"}</option>`).join("");

  cont.innerHTML=`
    <div class="pay-bank-title">
      <div><h4>💰 Resumen de pagos y banco de horas (USD)</h4>
      <p>Compara la asistencia del período con las nóminas realmente cerradas. Esta vista no modifica pagos.</p></div>
    </div>
    <div class="pay-bank-toolbar">
      <label>Desde<input id="payBankDesde" type="date" value="${desde}"></label>
      <label>Hasta<input id="payBankHasta" type="date" value="${hasta}"></label>
      <label>Funcionario<select id="payBankEmpleado"><option value="">Todos</option>${options}</select></label>
      <button id="payBankUpdate" type="button">Actualizar</button>
      <button id="payBankMonth" type="button" class="secondary">Este mes</button>
    </div>
    <div id="payBankContent"></div>`;

  const body=document.getElementById("payBankContent");
  if(!body)return;

  const bind=()=>{
    document.getElementById("payBankUpdate").onclick=()=>renderPagos();
    document.getElementById("payBankEmpleado").onchange=()=>renderPagos();
    document.getElementById("payBankMonth").onclick=()=>{
      document.getElementById("payBankDesde").value=monthFrom;
      document.getElementById("payBankHasta").value=monthTo;
      renderPagos();
    };
    document.getElementById("payBankDesde").onchange=()=>renderPagos();
    document.getElementById("payBankHasta").onchange=()=>renderPagos();
  };
  bind();

  desde=document.getElementById("payBankDesde").value;
  hasta=document.getElementById("payBankHasta").value;
  empFiltro=document.getElementById("payBankEmpleado").value;

  if(!desde||!hasta||desde>hasta){
    body.innerHTML='<div class="pay-bank-empty">Selecciona un rango Desde/Hasta válido.</div>';
    return;
  }

  const periodKey=`${desde}_${hasta}`;
  const recibosRango=[];
  Object.entries(todosRecibos).forEach(([periodo,porEmpleado])=>{
    Object.entries(porEmpleado||{}).forEach(([empID,r])=>{
      const pDesde=r?.desde||periodo.slice(0,10),pHasta=r?.hasta||periodo.slice(11,21);
      if(pDesde&&pHasta&&pDesde<=hasta&&pHasta>=desde){
        recibosRango.push({periodo,empID,desde:pDesde,hasta:pHasta,recibo:r||{}});
      }
    });
  });

  const totalCerradoGeneral=recibosRango.reduce((s,x)=>s+Number(x.recibo?.total||0),0);
  const empleadosCerrados=new Set(recibosRango.map(x=>x.empID)).size;

  body.innerHTML=`
    <div class="pay-bank-explain">
      <div><b>Banco de horas</b><span>Horas extra acumuladas según asistencia del rango.</span></div>
      <div><b>Nómina cerrada</b><span>Importe que realmente marcaste como pagado en Nómina.</span></div>
      <div><b>Horas no cumplidas</b><span>Horas programadas que faltaron por cumplir.</span></div>
    </div>
    <div class="pay-closed-overview">
      <div><small>Pagos cerrados en el rango</small><strong>${recibosRango.length}</strong></div>
      <div><small>Funcionarios con pago cerrado</small><strong>${empleadosCerrados}</strong></div>
      <div><small>Total realmente cerrado</small><strong>${formatUSD(totalCerradoGeneral)}</strong></div>
      <span>Los ajustes de bonificación, descuento y método vienen de Nómina; esta pantalla sirve para revisar y comparar.</span>
    </div>
    <div id="payBankCards"></div>`;

  const cards=document.getElementById("payBankCards");
  let shown=0;
  for(const [empID,empData] of Object.entries(empleadosObj).sort((a,b)=>String(a[1]?.nombre||"").localeCompare(String(b[1]?.nombre||""),"es"))){
    if(empFiltro&&empID!==empFiltro)continue;
    const marks=marcasResumen?.[empID]||{};
    const hasMarks=Object.keys(marks).some(d=>estaEnRango(d,desde,hasta));
    const recibosEmp=recibosRango.filter(x=>x.empID===empID);
    if(empData?.archivado&&!hasMarks&&!recibosEmp.length)continue;

    const p=window.PoladentAttendance.calculatePeriod({
      employee:empData,employeeId:empID,from:desde,to:hasta,
      marks:marcasResumen||{},holidays:feriadosResumen||{},freeDays:libresObj,paidSunday:true
    });

    const exacto=recibosEmp.find(x=>x.periodo===periodKey||((x.desde||"")===desde&&(x.hasta||"")===hasta))||null;
    const recibo=exacto?.recibo||null;
    const totalCerrado=recibo?Number(recibo.total||0):recibosEmp.reduce((s,x)=>s+Number(x.recibo?.total||0),0);
    const estadoPago=recibo
      ?`<span class="pay-summary-status paid">✅ Nómina cerrada</span>`
      :recibosEmp.length
        ?`<span class="pay-summary-status paid">✅ ${recibosEmp.length} pago(s) dentro del rango</span>`
        :`<span class="pay-summary-status pending">⏳ Sin pago cerrado</span>`;

    const metodo=recibo?.metodo||((recibosEmp.length===1&&recibosEmp[0].recibo?.metodo)||"");
    const bonus=recibo?Number(recibo.bonificacion||0):recibosEmp.reduce((s,x)=>s+Number(x.recibo?.bonificacion||0),0);
    const descuento=recibo?Number(recibo.descuento||0):recibosEmp.reduce((s,x)=>s+Number(x.recibo?.descuento||0),0);

    shown++;
    let html=`<article class="pay-bank-pro">
      <div class="pay-bank-head"><div><b>${empData.nombre||"Sin nombre"}</b><small>${desde} → ${hasta}</small></div>${estadoPago}</div>
      <div class="pay-bank-grid">
        <div><small>Horas trabajadas</small><strong>${Number(p.worked||0).toFixed(2)} h</strong></div>
        <div><small>Horas pagadas</small><strong>${Number(p.regular||0).toFixed(2)} h</strong></div>
        <div><small>Horas no cumplidas</small><strong>${Number(p.missing||0).toFixed(2)} h</strong></div>
        <div><small>Banco de horas extra</small><strong>${Number(p.extra||0).toFixed(2)} h</strong></div>
      </div>
      <div class="pay-bank-money">
        <span>Base calculada por asistencia <b>${formatUSD(p.pay)}</b></span>
        <span>Bonificación cerrada <b>${formatUSD(bonus)}</b></span>
        <span>Descuento manual cerrado <b>${formatUSD(descuento)}</b></span>
        <span class="${recibosEmp.length?"pay-bank-closed":""}">Total realmente cerrado en Nómina <b>${recibosEmp.length?formatUSD(totalCerrado):"—"}</b>${metodo?` · ${metodo}`:""}</span>
      </div>
      <details class="pay-bank-detail"><summary>Ver detalle día por día</summary>`;
    (p.days||[]).forEach(x=>{
      const tag=x.label?` <span style="opacity:.75">(${x.label})</span>`:"";
      html+=`<p>📅 ${x.date}${tag} — Trabajadas: <b>${Number(x.worked||0).toFixed(2)}</b>, Pagadas: <b>${Number(x.regular||0).toFixed(2)}</b>, Extra: <b>${Number(x.extra||0).toFixed(2)}</b>, No cumplidas: <b>${Number(x.missing||0).toFixed(2)}</b></p>`;
    });
    html+=`</details></article>`;
    cards.insertAdjacentHTML("beforeend",html);
  }

  if(!shown)cards.innerHTML='<div class="pay-bank-empty">No hay funcionarios, asistencia o pagos cerrados para este período.</div>';
}
// ==================================================
// 🧾 PDF DETALLADO CON FIRMA (USD)
// ✅ incluye POLADENT
// ==================================================
async function generarReciboDetalladoPorId(empID, nombreEmpleado) {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Falta jsPDF. Revisa el script de jspdf en el HTML.");
      return;
    }

    // si no hay ID, buscar por nombre
    if (!empID) {
      const snap = await db.ref("empleados").orderByChild("nombre").equalTo(nombreEmpleado).once("value");
      const obj = snap.val();
      if (!obj) return alert("No se encontró el empleado en la base de datos.");
      empID = Object.keys(obj)[0];
    }

    const empSnap = await db.ref("empleados/" + empID).once("value");
    const emp = empSnap.val();
    if (!emp) return alert("Empleado no encontrado.");

    const desde = document.getElementById("payBankDesde")?.value || ((fechaDesde && fechaDesde.value) ? fechaDesde.value : "");
    const hasta = document.getElementById("payBankHasta")?.value || ((fechaHasta && fechaHasta.value) ? fechaHasta.value : "");

    const marcSnap = await db.ref("marcaciones/" + empID).once("value");
    const marc = marcSnap.val() || {};

    const libresSnap = await db.ref(`dias_libres_empleado/${empID}`).once("value");
    const libresObj = libresSnap.val() || {};

    const salario = Number(emp.salario || 0);
    const tipoSalario = emp.tipoSalario || "diario";
    const tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

    const diasParaCalcular = (desde && hasta) ? rangoFechasIncluye(desde, hasta) : Object.keys(marc).sort();

    let horasTrabTot = 0, horasExtraTot = 0, horasNoTrabTot = 0, totalPagar = 0, totalDescuento = 0;
    const detalle = [];

    diasParaCalcular.forEach((dia) => {
      const tipos = marc[dia] || {};
      const ts = {
        entrada: tipos.entrada?.timestamp || null,
        salida: tipos.salida?.timestamp || null,
        almuerzo_salida: tipos.almuerzo_salida?.timestamp || null,
        almuerzo_regreso: tipos.almuerzo_regreso?.timestamp || null,
      };

      const r = calcularDia(ts, dia, tarifaHora, libresObj[dia] || null, emp);

      horasTrabTot += r.normales;
      horasExtraTot += r.extra;
      horasNoTrabTot += r.noTrab;
      totalPagar += r.pagoDia;
      totalDescuento += r.descuentoDia;

      detalle.push({ dia, ...r });
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 16;

    // ✅ Encabezado empresa
    doc.setFontSize(18);
    doc.text("POLADENT", 14, y);
    y += 7;
    doc.setFontSize(11);
    doc.text("Sistema de control de asistencia", 14, y);
    y += 10;

    doc.setFontSize(16);
    doc.text("RECIBO DE PAGO (USD)", 14, y);
    y += 10;

    doc.setFontSize(11);
    doc.text(`Empleado: ${emp.nombre || nombreEmpleado || "Sin nombre"}`, 14, y);
    y += 6;
    doc.text(`Periodo: ${desde || "—"}  a  ${hasta || "—"}`, 14, y);
    y += 6;
    doc.text(`Tipo de salario: ${tipoSalario}`, 14, y);
    y += 6;
    doc.text(`Salario: ${formatUSD(salario)} | Tarifa/hora: ${formatUSD(tarifaHora)}`, 14, y);
    y += 8;

    doc.setFontSize(12);
    doc.text(`Horas pagadas: ${horasTrabTot.toFixed(2)}`, 14, y);
    y += 6;
    doc.text(`Horas NO pagadas (descuento): ${horasNoTrabTot.toFixed(2)}`, 14, y);
    y += 6;
    doc.text(`Banco de horas (extra): ${horasExtraTot.toFixed(2)}`, 14, y);
    y += 6;

    doc.text(`Descuento total: ${formatUSD(totalDescuento)}`, 14, y);
    y += 6;

    doc.setFontSize(14);
    doc.text(`TOTAL A PAGAR: ${formatUSD(totalPagar)}`, 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("Detalle por día:", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.text("Fecha", 14, y);
    doc.text("Horas", 55, y);
    doc.text("Desc.", 85, y);
    doc.text("Pago día", 115, y);
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    detalle.forEach((d) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(d.dia), 14, y);
      doc.text(d.normales.toFixed(2), 55, y);
      doc.text(d.noTrab.toFixed(2), 85, y);
      doc.text(formatUSD(d.pagoDia), 115, y);
      y += 6;

      if (d.etiqueta) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(9);
        doc.text(`- ${d.etiqueta}`, 16, y);
        doc.setFontSize(10);
        y += 5;
      }
    });

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    y += 12;

    doc.setFontSize(11);
    doc.text("Firma del empleado: ________________________________", 14, y);
    y += 10;
    doc.text("Firma del encargado: _______________________________", 14, y);
    y += 10;
    doc.text("Fecha de firma: ____/____/______", 14, y);

    doc.save(`Recibo_${(emp.nombre || nombreEmpleado || "Empleado").replace(/\s+/g, "_")}.pdf`);
  } catch (e) {
    console.error(e);
    alert("Error al generar el recibo: " + (e.message || e));
  }
}

// ===============================
// 🔹 LISTENERS FILTROS
// ===============================
const filterDate = document.getElementById("filterDate");
const periodoResumen = document.getElementById("periodoResumen");

filterDate?.addEventListener("change", () => {
  renderAdminList(filterDate.value);
  updateChart();
});
periodoResumen?.addEventListener("change", () => {
  renderAdminList(filterDate.value);
  updateChart();
});
fechaDesde?.addEventListener("change", () => {
  renderAdminList(filterDate.value);
  updateChart();
});
fechaHasta?.addEventListener("change", () => {
  renderAdminList(filterDate.value);
  updateChart();
});

// ✅ Alias seguros
window.closeEditModal = window.closeEditModal || closeEditModal;
window.closeEditHorario = window.closeEditHorario || window.closeEditModal;

// ===============================
// 🔹 INICIO
// ===============================
backHome();
setDefaultDate();
periodoResumen.value = "diario";
loadEmpleados();
loadMarcaciones();
loadFeriadosGlobalCache();
renderListaFeriadosGlobal();
cargarEmpleadosParaModal().then(renderListaLibresEmpleado);
updateChart();

// Fase 19.5: refresca el resumen de pagos cuando cambia una nómina cerrada.
document.addEventListener('poladent:nomina-actualizada',()=>{try{renderPagos();}catch(_e){}});


// Fase 19.13: funciones visibles para la navegación única.
window.renderPagos = renderPagos;
window.renderListaLibresEmpleado = renderListaLibresEmpleado;
window.renderListaFeriadosGlobal = renderListaFeriadosGlobal;
window.cargarEmpleadosParaModal = cargarEmpleadosParaModal;
