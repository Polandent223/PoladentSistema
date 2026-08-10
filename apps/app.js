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

  window.PoladentData.subscribe("empleados", (snap) => {
    cont.innerHTML = "";

    snap.forEach((emp) => {
      const data = emp.val() || {};
      const salarioTexto = `${formatUSD(data.salario)} (${data.tipoSalario || "diario"})`;

      const archivado = data.archivado === true || data.activo === false;
      cont.innerHTML += `<div class="empleado ${archivado ? 'empleado-archivado' : ''}">
        <strong>${data.nombre || "Sin nombre"}</strong> ${archivado ? '<span style="font-size:12px;opacity:.7">(Archivado)</span>' : ''}<br>
        PIN: ${data.pin || ""}<br>
        Salario: ${salarioTexto}
        <div class="empActions">
          <button onclick="cambiarEstadoEmpleado('${emp.key}', ${archivado ? 'true' : 'false'})">${archivado ? 'Reactivar' : 'Archivar'}</button>
          <button onclick="asignarSalario('${emp.key}')">Asignar salario</button>
          <button onclick="openEditModal('${emp.key}')">Editar horario</button>
          <button onclick="generarReciboDetalladoPorId('${emp.key}', '${(data.nombre || "").replace(/'/g, "\\'")}')">Recibo PDF</button>
        </div>
      </div>`;
    });

    // refrescar selects/listas
    cargarEmpleadosParaModal().then(() => {
      renderListaLibresEmpleado();
    });
  });
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

function renderAdminList(dateFilter) {
  const cont = document.getElementById("adminList");
  const notif = document.getElementById("notificaciones");

  cont.innerHTML = "";
  notif.innerHTML = "";
  excelRows = [];
  excelSalarial = [];

  const periodo = document.getElementById("periodoResumen").value;

  const empIDs = Object.keys(allMarcaciones).sort((a, b) => {
    const nameA = Object.values(allMarcaciones[a])[0]
      ? Object.values(Object.values(allMarcaciones[a])[0])[0].nombre
      : "";
    const nameB = Object.values(allMarcaciones[b])[0]
      ? Object.values(Object.values(allMarcaciones[b])[0])[0].nombre
      : "";
    return nameA.localeCompare(nameB);
  });

  empIDs.forEach((empID) => {
    const fechas = allMarcaciones[empID] || {};

    Object.keys(fechas)
      .sort()
      .forEach((fecha) => {
        let fechaObj = new Date(fecha + "T00:00:00");
        let desde = fechaDesde.value ? new Date(fechaDesde.value + "T00:00:00") : null;
        let hasta = fechaHasta.value ? new Date(fechaHasta.value + "T00:00:00") : null;

        if (desde && fechaObj < desde) return;
        if (hasta && fechaObj > hasta) return;

        if (!desde && !hasta) {
          if (dateFilter && !fecha.startsWith(dateFilter.substring(0, 7)) && periodo !== "diario") return;
          if (periodo === "diario" && dateFilter && fecha !== dateFilter) return;
        }

        const tipos = fechas[fecha] || {};

        Object.keys(tipos)
          .sort()
          .forEach((tipo) => {
            const data = tipos[tipo] || {};
            if (!data.nombre) data.nombre = "Sin nombre";

            cont.innerHTML += `<p><b>${data.nombre}</b> | ${data.tipo} | ${fecha} | ${data.hora}</p>`;
            excelRows.push([data.nombre, fecha, data.tipo, data.hora]);
            excelSalarial.push({
              empID: empID,
              nombre: data.nombre,
              fecha: fecha,
              tipo: data.tipo,
              timestamp: data.timestamp,
            });

            notif.innerHTML += `<div class="notif">${data.nombre} marcó ${data.tipo} a las ${data.hora}</div>`;
          });
      });
  });

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
    db.ref("empleados").once("value"),
    db.ref("dias_libres_empleado").once("value")
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
  const div = document.createElement("div");
  div.className = "notif";
  div.innerText = text;
  notif.prepend(div);
}

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
  const cont = document.getElementById("listaFeriados");
  if (!cont) return;

  window.PoladentData.subscribe("feriados_global", (snap) => {
    const data = snap.val() || {};
    const fechas = Object.keys(data).sort();

    if (!fechas.length) {
      cont.innerHTML = `<p style="opacity:.75;">No hay feriados registrados.</p>`;
      return;
    }

    cont.innerHTML = fechas.map((fecha) => {
      const f = data[fecha] || {};
      const motivo = f.motivo || "Feriado pagado";
      return `
        <div style="background:#fff; padding:8px; margin:6px 0; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,.05);">
          <b>${fecha}</b> — <span style="opacity:.85;">${motivo}</span>
          <button class="danger" style="float:right; min-width:auto; padding:8px 10px;" onclick="eliminarFeriadoGlobal('${fecha}')">✕</button>
          <div style="clear:both;"></div>
        </div>
      `;
    }).join("");
  });
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
  const snap = await db.ref("empleados").once("value");
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

function openLibreModal(empId = null, fecha = null, motivo = "") {
  const modal = document.getElementById("libreModal");
  const back = document.getElementById("libreModalBackdrop");
  if (!modal || !back) return;

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
  const cont = document.getElementById("listaLibresEmpleado");
  if (!cont) return;

  cont.innerHTML = `<p style="opacity:.75;">Cargando...</p>`;

  const snap = await db.ref("dias_libres_empleado").once("value");
  const all = snap.val() || {};

  if (!Object.keys(all).length) {
    cont.innerHTML = `<p style="opacity:.75;">No hay días libres pagados registrados.</p>`;
    return;
  }

  let html = "";
  const empIds = Object.keys(all).sort((a, b) => {
    const na = empleadosCache[a]?.nombre || "";
    const nb = empleadosCache[b]?.nombre || "";
    return na.localeCompare(nb);
  });

  empIds.forEach((empId) => {
    const nombre = empleadosCache[empId]?.nombre || "Sin nombre";
    const dias = all[empId] || {};
    const fechas = Object.keys(dias).sort();
    if (!fechas.length) return;

    html += `<div class="empleado" style="margin-bottom:12px;">
      <b>${nombre}</b>
      <div style="margin-top:8px;">`;

    fechas.forEach((fecha) => {
      const motivo = dias[fecha]?.motivo || "";
      const motivoTxt = motivo ? ` — <span style="opacity:.8;">${motivo}</span>` : "";

      html += `
        <div style="padding:8px; border:1px solid rgba(0,0,0,.08); border-radius:12px; margin:8px 0; background:#fff;">
          <b>${fecha}</b>${motivoTxt}

          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="uiEditarDiaLibre('${empId}','${fecha}')" style="min-width:160px;">✏️ Editar</button>
            <button class="danger" onclick="uiBorrarDiaLibre('${empId}','${fecha}')" style="min-width:160px;">🗑️ Borrar</button>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  cont.innerHTML = html;
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
  const desde=fechaDesde?.value||"", hasta=fechaHasta?.value||"";
  cont.innerHTML="<h4>💰 Resumen de pagos y banco de horas (USD)</h4>";
  if(!desde||!hasta||desde>hasta){cont.innerHTML+='<p style="opacity:.8;">Selecciona un rango Desde/Hasta válido.</p>';return;}
  if(!window.PoladentAttendance){cont.innerHTML+='<p>Motor de asistencia cargando…</p>';return;}
  const [empSnap,libresSnap]=await Promise.all([db.ref("empleados").once("value"),db.ref("dias_libres_empleado").once("value")]);
  const empleadosObj=empSnap.val()||{}, libresObj=libresSnap.val()||{};
  let shown=0;
  for(const [empID,empData] of Object.entries(empleadosObj).sort((a,b)=>String(a[1]?.nombre||"").localeCompare(String(b[1]?.nombre||""),"es"))){
    const marks=allMarcaciones?.[empID]||{}; const hasMarks=Object.keys(marks).some(d=>estaEnRango(d,desde,hasta));
    if(empData?.archivado&&!hasMarks)continue;
    const salario=Number(empData.salario||0), tipoSalario=empData.tipoSalario||"diario";
    const p=window.PoladentAttendance.calculatePeriod({employee:empData,employeeId:empID,from:desde,to:hasta,marks:allMarcaciones||{},holidays:feriadosGlobalCache||{},freeDays:libresObj,paidSunday:true});
    shown++;
    let html=`<div style="background:#fff;border-radius:10px;padding:10px;margin:10px 0;box-shadow:0 2px 10px rgba(0,0,0,.06);"><p style="margin:0 0 6px"><b>${empData.nombre||"Sin nombre"}</b></p><p style="margin:0;opacity:.85">Periodo: <b>${desde}</b> a <b>${hasta}</b></p><p style="margin:6px 0 0">Salario: <b>${formatUSD(salario)}</b> (${tipoSalario}) | Tarifa/hora: <b>${formatUSD(p.rate)}</b></p><p style="margin:6px 0 0">Horas trabajadas: <b>${p.worked.toFixed(2)}</b> | Horas pagadas: <b>${p.regular.toFixed(2)}</b> | Horas NO cumplidas: <b>${p.missing.toFixed(2)}</b> | Banco extra: <b>${p.extra.toFixed(2)}</b></p><p style="margin:6px 0 0">Descuento referencial: <b>${formatUSD(p.discount)}</b> | <span style="font-size:16px">Total base a pagar: <b>${formatUSD(p.pay)}</b></span></p><div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08)"><p style="margin:0 0 6px;font-weight:600">Detalle por día</p>`;
    p.days.forEach(x=>{const tag=x.label?` <span style="opacity:.75">(${x.label})</span>`:"";html+=`<p style="margin:3px 0">📅 ${x.date}${tag} — Trabajadas: <b>${x.worked.toFixed(2)}</b>, Pagadas: <b>${x.regular.toFixed(2)}</b>, No cumplidas: <b>${x.missing.toFixed(2)}</b>, Pago: <b>${formatUSD(x.pay)}</b></p>`});
    html+=`</div><div style="margin-top:10px"><button onclick="generarReciboDetalladoPorId('${empID}', '${String(empData.nombre||"").replace(/'/g,"\\'")}')">🧾 Generar recibo PDF (firma)</button></div></div>`;
    cont.innerHTML+=html;
  }
  if(!shown)cont.innerHTML+='<p style="opacity:.8;">No hay funcionarios para mostrar en este período.</p>';
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

    const desde = (fechaDesde && fechaDesde.value) ? fechaDesde.value : "";
    const hasta = (fechaHasta && fechaHasta.value) ? fechaHasta.value : "";

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
