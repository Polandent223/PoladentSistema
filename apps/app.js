// ===============================
// ✅ POLADENT - APP.JS COMPLETO
// TODO EN ESPAÑOL + SALARIO USD
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
  hideAll();
  employeePanel.classList.remove("hidden");
}

// ===============================
// 🔹 LOGIN ADMIN
// ===============================
function loginAdmin() {
  const email = document.getElementById("adminEmail").value;
  const pass = document.getElementById("adminPass").value;

  auth
    .signInWithEmailAndPassword(email, pass)
    .then(() => {
      hideAll();
      adminPanel.classList.remove("hidden");
      setDefaultDate();
      loadEmpleados();
      loadMarcaciones();
      updateChart();
    })
    .catch(() => alert("Error de acceso"));
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

  db.ref("empleados").on("value", (snap) => {
    cont.innerHTML = "";

    snap.forEach((emp) => {
      const data = emp.val() || {};
      const salarioTexto = `${formatUSD(data.salario)} (${data.tipoSalario || "diario"})`;

      cont.innerHTML += `<div class="empleado">
        <strong>${data.nombre || "Sin nombre"}</strong><br>
        PIN: ${data.pin || ""}<br>
        Salario: ${salarioTexto}
        <div class="empActions">
          <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
          <button onclick="asignarSalario('${emp.key}')">Asignar salario</button>
          <button onclick="openEditModal('${emp.key}')">Editar horario</button>
          <button onclick="generarOlerite('${emp.key}')">Recibo PDF</button>
        </div>
      </div>`;
    });
  });
}

function loadEmpleados() {
  cargarEmpleados();
}

function borrarEmpleado(id) {
  if (confirm("¿Seguro que deseas borrar este empleado?")) {
    db.ref("empleados/" + id).remove();
    db.ref("marcaciones/" + id).remove();
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

  // Reset
  document.getElementById("salarioValor").value = "";
  document.getElementById("salarioTipo").value = "diario";
  document.getElementById("salarioEmpNombre").value = "";
  hideSalarioStatus();

  // Cargar empleado
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
  const modal = document.getElementById("salarioModal");
  const back = document.getElementById("salarioModalBackdrop");
  if (modal) modal.classList.add("hidden");
  if (back) back.classList.add("hidden");
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
    const msg =
      e && (e.code || e.message)
        ? `${e.code ? e.code + " - " : ""}${e.message || ""}`
        : String(e);
    showSalarioStatus("❌ " + msg, true);
  }
}

// Botones modal salario
document.getElementById("salarioCancelBtn")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioCloseBtn")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioModalBackdrop")?.addEventListener("click", closeSalarioModal);
document.getElementById("salarioSaveBtn")?.addEventListener("click", saveSalarioModal);

// ✅ reemplazo del prompt
function asignarSalario(empID) {
  openSalarioModal(empID);
}

// ===============================
// 🔹 RECIBO PDF (BÁSICO) - USD
// ===============================
function generarOlerite(empID) {
  db.ref("empleados/" + empID).once("value", (snap) => {
    const emp = snap.val();
    if (!emp) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Recibo de Pago", 20, 20);
    doc.setFontSize(14);
    doc.text(`Empleado: ${emp.nombre}`, 20, 40);
    doc.text(`Salario: ${formatUSD(emp.salario)} (${emp.tipoSalario})`, 20, 50);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 60);
    doc.save(`Recibo_${emp.nombre}.pdf`);
  });
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

      snap.forEach((empSnap) => {
        empleadoActual = { id: empSnap.key, nombre: empSnap.val().nombre };
        document.getElementById("empNombreGrande").innerHTML = empleadoActual.nombre;
        document.getElementById("employeeButtons").classList.remove("hidden");
        document.getElementById("empMsg").innerHTML = "";
      });
    });
}

// ===============================
// 🔹 MARCACIÓN
// ===============================
function mark(tipo) {
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
  db.ref("marcaciones").on("value", (snap) => {
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
        let fechaObj = new Date(fecha);
        let desde = fechaDesde.value ? new Date(fechaDesde.value) : null;
        let hasta = fechaHasta.value ? new Date(fechaHasta.value) : null;

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

function exportExcelSalarialFiltro() {
  const desde = fechaDesde.value;
  const hasta = fechaHasta.value;
  const resumen = {};

  for (const m of excelSalarial) {
    if (!estaEnRango(m.fecha, desde, hasta)) continue;
    if (!resumen[m.nombre]) resumen[m.nombre] = { dias: {} };
    if (!resumen[m.nombre].dias[m.fecha])
      resumen[m.nombre].dias[m.fecha] = { entrada: null, salida: null, almuerzo_salida: null, almuerzo_regreso: null };
    resumen[m.nombre].dias[m.fecha][m.tipo] = m.timestamp;
  }

  const wsData = [["Nombre", "Fecha", "Horas trabajadas", "Horas extra", "Banco de horas", "Pago del día (USD)"]];

  const empleadosKeys = Object.keys(resumen);

  let promesas = empleadosKeys.map((empNombre) => {
    return db
      .ref("empleados")
      .orderByChild("nombre")
      .equalTo(empNombre)
      .once("value")
      .then((snap) => {
        const empData = Object.values(snap.val() || {})[0] || {};
        const salario = empData?.salario || 0;
        const tipoSalario = empData?.tipoSalario || "diario";

        let bancoTotal = 0;
        let totalPagar = 0;

        for (const dia in resumen[empNombre].dias) {
          const d = resumen[empNombre].dias[dia];
          if (!d.entrada || !d.salida) continue;

          let almuerzo = 0;
          if (d.almuerzo_salida && d.almuerzo_regreso) {
            almuerzo = (d.almuerzo_regreso - d.almuerzo_salida) / 3600000;
          }

          let hrs = (d.salida - d.entrada) / 3600000 - almuerzo;
          let extra = Math.max(0, hrs - 8);
          let normales = Math.min(8, hrs);
          bancoTotal += extra;

          let pagoDia = 0;
          if (tipoSalario === "diario") pagoDia = normales * (salario / 8);
          else if (tipoSalario === "quincenal") pagoDia = normales * (salario / 15 / 8);
          else if (tipoSalario === "mensual") pagoDia = normales * (salario / 30 / 8);

          totalPagar += pagoDia;

          wsData.push([empNombre, dia, normales.toFixed(2), extra.toFixed(2), bancoTotal.toFixed(2), pagoDia.toFixed(2)]);
        }

        wsData.push([empNombre, "TOTAL", "", "", bancoTotal.toFixed(2), totalPagar.toFixed(2)]);
      });
  });

  Promise.all(promesas).then(() => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Salario");
    XLSX.writeFile(wb, "Poladent_Salario_Filtro.xlsx");
  });
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

  const filtroInicio = startDate ? new Date(startDate) : null;
  const filtroFin = endDate ? new Date(endDate) : null;
  const resumenHoras = {};

  for (const empID in allMarcaciones) {
    const fechas = allMarcaciones[empID] || {};
    for (const fecha in fechas) {
      const fechaObj = new Date(fecha);
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
// 🔹 RESUMEN DE PAGOS
// ===============================
function estaEnRango(fecha, desde, hasta) {
  const f = new Date(fecha);
  const d = desde ? new Date(desde) : null;
  const h = hasta ? new Date(hasta) : null;
  if (d && f < d) return false;
  if (h && f > h) return false;
  return true;
}

function renderPagos() {
  const cont = document.getElementById("resumenPagos");
  if (!cont) return;

  cont.innerHTML = "<h4>💰 Resumen de pagos y banco de horas</h4>";
  const desde = fechaDesde.value;
  const hasta = fechaHasta.value;

  const resumen = {};

  for (const m of excelSalarial) {
    if (!estaEnRango(m.fecha, desde, hasta)) continue;
    if (!resumen[m.nombre]) resumen[m.nombre] = { dias: {} };
    if (!resumen[m.nombre].dias[m.fecha])
      resumen[m.nombre].dias[m.fecha] = { entrada: null, salida: null, almuerzo_salida: null, almuerzo_regreso: null };
    resumen[m.nombre].dias[m.fecha][m.tipo] = m.timestamp;
  }

  const empleadosKeys = Object.keys(resumen);

  empleadosKeys.forEach((empNombre) => {
    db.ref("empleados")
      .orderByChild("nombre")
      .equalTo(empNombre)
      .once("value")
      .then((snap) => {
        const empData = Object.values(snap.val() || {})[0] || {};
        const salario = empData?.salario || 0;
        const tipoSalario = empData?.tipoSalario || "diario";

        let bancoTotal = 0;
        let totalPagar = 0;

        for (const dia in resumen[empNombre].dias) {
          const d = resumen[empNombre].dias[dia];
          if (!d.entrada || !d.salida) continue;

          let almuerzo = 0;
          if (d.almuerzo_salida && d.almuerzo_regreso) {
            almuerzo = (d.almuerzo_regreso - d.almuerzo_salida) / 3600000;
          }

          let hrs = (d.salida - d.entrada) / 3600000 - almuerzo;
          let extra = Math.max(0, hrs - 8);
          let normales = Math.min(8, hrs);
          bancoTotal += extra;

          let pagoDia = 0;
          if (tipoSalario === "diario") pagoDia = normales * (salario / 8);
          else if (tipoSalario === "quincenal") pagoDia = normales * (salario / 15 / 8);
          else if (tipoSalario === "mensual") pagoDia = normales * (salario / 30 / 8);

          totalPagar += pagoDia;
        }

        let texto = `<p><b>${empData.nombre || empNombre}</b> - Total a pagar: ${formatUSD(totalPagar)} - Banco de horas: ${bancoTotal.toFixed(2)}</p>`;
        if (bancoTotal >= 8) texto += `<p style="color:green;">✅ Puede tomar un día libre</p>`;
        cont.innerHTML += texto;
      });
  });
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

// ===============================
// ✅ MODAL EDITAR HORARIO (ADMIN)
// ===============================
let empleadosCache = {};

async function cargarEmpleadosParaModal() {
  empleadosCache = {};
  const snap = await db.ref("empleados").once("value");
  snap.forEach((emp) => {
    empleadosCache[emp.key] = emp.val();
  });
  fillEmployeeSelect();
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
  const modal = document.getElementById("editModal");
  const back = document.getElementById("editModalBackdrop");
  const box = document.getElementById("editStatus");

  if (modal) modal.classList.add("hidden");
  if (back) back.classList.add("hidden");
  if (box) {
    box.style.display = "none";
    box.innerText = "";
  }
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

    if (!empId || !empleadosCache[empId]) {
      showEditStatus("⚠️ Selecciona un empleado válido.", true);
      return;
    }
    if (!fecha) {
      showEditStatus("⚠️ Selecciona una fecha.", true);
      return;
    }

    const ts = buildTimestampLocal(fecha, hora);
    if (!ts) {
      showEditStatus("⚠️ Hora inválida.", true);
      return;
    }

    const empNombre = empleadosCache[empId].nombre || "Sin nombre";
    const ref = db.ref(`marcaciones/${empId}/${fecha}/${tipo}`);

    const prevSnap = await ref.once("value");
    const prevVal = prevSnap.val();
    const editStamp = Date.now();

    await db.ref(`auditoria_ediciones/${empId}/${fecha}/${tipo}/${editStamp}`).set({
      empleado: empNombre,
      fecha,
      tipo,
      antes: prevVal || null,
      despues: { hora, timestamp: ts },
      editadoEn: editStamp,
      editadoPor: "admin",
    });

    await ref.set({
      nombre: empNombre,
      tipo,
      fecha,
      hora,
      timestamp: ts,
      lat: null,
      lon: null,
      editado: true,
      editadoEn: editStamp,
      editadoPor: "admin",
    });

    showEditStatus(`✅ Guardado: ${empNombre} | ${tipo} | ${fecha} | ${hora}`, false);

    loadMarcaciones();
    updateChart();
    setTimeout(closeEditModal, 700);
  } catch (e) {
    console.error("saveEditHorario error:", e);
    const msg =
      e && (e.code || e.message)
        ? `${e.code ? e.code + " - " : ""}${e.message || ""}`
        : String(e);
    showEditStatus("❌ " + msg, true);
  }
}

// ✅ Alias seguros
window.closeEditModal = window.closeEditModal || closeEditModal;
window.closeEditHorario = window.closeEditHorario || window.closeEditModal;

// ==================================================
// ✅ EXTRA PRO (NO ROMPE TU CÓDIGO)
// Resumen de pagos PRO + Recibo PDF con firma (USD)
// ==================================================

// 🔹 UTILIDAD: tarifa por hora según tipo de salario
function tarifaPorHoraUSD(salario, tipoSalario) {
  const s = Number(salario || 0);
  const t = String(tipoSalario || "diario").toLowerCase();
  if (t === "diario") return s / 8;
  if (t === "quincenal") return s / (15 * 8);
  if (t === "mensual") return s / (30 * 8);
  return s / 8;
}

// 🔹 REEMPLAZA renderPagos por uno PRO (mismo nombre => se usa automático)
function renderPagos() {
  const cont = document.getElementById("resumenPagos");
  if (!cont) return;

  cont.innerHTML = "<h4>💰 Resumen de pagos y banco de horas (USD)</h4>";

  const desde = (fechaDesde && fechaDesde.value) ? fechaDesde.value : "";
  const hasta = (fechaHasta && fechaHasta.value) ? fechaHasta.value : "";

  // ✅ Construimos resumen desde tu excelSalarial (lo llenas en renderAdminList)
  // OJO: aquí también guardamos empID si existe (más seguro para PDF).
  const resumen = {}; // { empNombre: { empID, dias: { fecha: {tipo: timestamp} } } }

  for (const m of excelSalarial) {
    if (!m || !m.fecha) continue;
    if (!estaEnRango(m.fecha, desde, hasta)) continue;

    const nombre = m.nombre || "Sin nombre";
    if (!resumen[nombre]) resumen[nombre] = { empID: m.empID || null, dias: {} };

    if (!resumen[nombre].dias[m.fecha]) {
      resumen[nombre].dias[m.fecha] = {
        entrada: null,
        salida: null,
        almuerzo_salida: null,
        almuerzo_regreso: null,
      };
    }
    resumen[nombre].dias[m.fecha][m.tipo] = m.timestamp || null;
  }

  const empleadosKeys = Object.keys(resumen);
  if (empleadosKeys.length === 0) {
    cont.innerHTML += `<p style="opacity:.8;">No hay datos en el rango seleccionado.</p>`;
    return;
  }

  empleadosKeys.forEach((empNombre) => {
    // ✅ Intentar por ID primero (más seguro). Si no hay ID, buscar por nombre.
    const empID = resumen[empNombre].empID;

    const promEmp = empID
      ? db.ref("empleados/" + empID).once("value")
      : db.ref("empleados").orderByChild("nombre").equalTo(empNombre).once("value");

    promEmp.then((snap) => {
      let empData = {};
      let empIdFinal = empID || null;

      if (empID) {
        empData = snap.val() || {};
      } else {
        const obj = snap.val() || {};
        const keys = Object.keys(obj);
        if (keys.length > 0) {
          empIdFinal = keys[0];
          empData = obj[empIdFinal] || {};
        }
      }

      const nombreMostrar = empData.nombre || empNombre;

      const salario = Number(empData.salario || 0);
      const tipoSalario = empData.tipoSalario || "diario";
      const tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

      let horasTrabTot = 0;   // horas normales (máx 8/día)
      let horasExtraTot = 0;  // >8 (banco)
      let horasNoTrabTot = 0; // faltantes (descuento)
      let totalPagar = 0;
      let totalDescuento = 0;

      const dias = resumen[empNombre].dias;
      const diasOrdenados = Object.keys(dias).sort();
      const detalleDia = [];

      diasOrdenados.forEach((dia) => {
        const d = dias[dia];
        if (!d.entrada || !d.salida) return; // si no hay entrada+salida, no calcula

        let almuerzo = 0;
        if (d.almuerzo_salida && d.almuerzo_regreso) {
          almuerzo = (d.almuerzo_regreso - d.almuerzo_salida) / 3600000;
        }

        let horas = (d.salida - d.entrada) / 3600000 - almuerzo;
        if (!Number.isFinite(horas) || horas < 0) horas = 0;

        const normales = Math.min(8, horas);
        const extra = Math.max(0, horas - 8);
        const noTrab = Math.max(0, 8 - normales);

        const pagoDia = normales * tarifaHora;
        const descuentoDia = noTrab * tarifaHora;

        horasTrabTot += normales;
        horasExtraTot += extra;
        horasNoTrabTot += noTrab;

        totalPagar += pagoDia;
        totalDescuento += descuentoDia;

        detalleDia.push({ dia, normales, noTrab, pagoDia });
      });

      // ✅ UI
      let html = `
        <div style="background:#ffffff; border-radius:10px; padding:10px; margin:10px 0; box-shadow:0 2px 10px rgba(0,0,0,.06);">
          <p style="margin:0 0 6px 0;"><b>${nombreMostrar}</b></p>

          <p style="margin:0; opacity:.85;">
            Periodo: <b>${desde || "—"}</b> a <b>${hasta || "—"}</b>
          </p>

          <p style="margin:6px 0 0 0;">
            Salario: <b>${formatUSD(salario)}</b> (${tipoSalario}) |
            Tarifa/hora: <b>${formatUSD(tarifaHora)}</b>
          </p>

          <p style="margin:6px 0 0 0;">
            Horas trabajadas: <b>${horasTrabTot.toFixed(2)}</b> |
            Horas NO trabajadas (descuento): <b>${horasNoTrabTot.toFixed(2)}</b> |
            Banco de horas (extra): <b>${horasExtraTot.toFixed(2)}</b>
          </p>

          <p style="margin:6px 0 0 0;">
            Descuento total: <b>${formatUSD(totalDescuento)}</b> |
            <span style="font-size:16px;">Total a pagar: <b>${formatUSD(totalPagar)}</b></span>
          </p>

          <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(0,0,0,.08);">
            <p style="margin:0 0 6px 0; font-weight:600;">Detalle por día</p>
      `;

      if (detalleDia.length === 0) {
        html += `<p style="margin:0; opacity:.8;">No hay días completos (entrada y salida) en el rango.</p>`;
      } else {
        detalleDia.forEach((x) => {
          html += `
            <p style="margin:3px 0;">
              📅 ${x.dia} — Horas: <b>${x.normales.toFixed(2)}</b>,
              Descuento: <b>${x.noTrab.toFixed(2)}</b>,
              Pago día: <b>${formatUSD(x.pagoDia)}</b>
            </p>
          `;
        });
      }

      html += `
          </div>

          <div style="margin-top:10px;">
            <button onclick="generarReciboDetalladoPorId('${empIdFinal || ""}', '${(nombreMostrar || "").replace(/'/g, "\\'")}')">
              🧾 Generar recibo PDF (firma)
            </button>
          </div>
        </div>
      `;

      cont.innerHTML += html;
    });
  });
}

// ===============================
// 🧾 PDF DETALLADO CON FIRMA (USD)
// ===============================
async function generarReciboDetalladoPorId(empID, nombreEmpleado) {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Falta jsPDF. Revisa el script de jspdf en el HTML.");
      return;
    }

    // ✅ Si no tenemos ID, buscar por nombre
    if (!empID) {
      const snap = await db.ref("empleados").orderByChild("nombre").equalTo(nombreEmpleado).once("value");
      const obj = snap.val();
      if (!obj) {
        alert("No se encontró el empleado en la base de datos.");
        return;
      }
      empID = Object.keys(obj)[0];
    }

    const empSnap = await db.ref("empleados/" + empID).once("value");
    const emp = empSnap.val();
    if (!emp) {
      alert("Empleado no encontrado.");
      return;
    }

    const desde = (fechaDesde && fechaDesde.value) ? fechaDesde.value : "";
    const hasta = (fechaHasta && fechaHasta.value) ? fechaHasta.value : "";

    const marcSnap = await db.ref("marcaciones/" + empID).once("value");
    const marc = marcSnap.val() || {};

    const salario = Number(emp.salario || 0);
    const tipoSalario = emp.tipoSalario || "diario";
    const tarifaHora = tarifaPorHoraUSD(salario, tipoSalario);

    const dias = Object.keys(marc)
      .sort()
      .filter((f) => {
        if (desde && new Date(f) < new Date(desde)) return false;
        if (hasta && new Date(f) > new Date(hasta)) return false;
        return true;
      });

    let horasTrabTot = 0;
    let horasExtraTot = 0;
    let horasNoTrabTot = 0;
    let totalPagar = 0;
    let totalDescuento = 0;

    const detalle = [];

    dias.forEach((dia) => {
      const tipos = marc[dia] || {};
      const entrada = tipos.entrada?.timestamp || null;
      const salida = tipos.salida?.timestamp || null;

      if (!entrada || !salida) return;

      let almuerzo = 0;
      const aS = tipos.almuerzo_salida?.timestamp || null;
      const aR = tipos.almuerzo_regreso?.timestamp || null;
      if (aS && aR) almuerzo = (aR - aS) / 3600000;

      let horas = (salida - entrada) / 3600000 - almuerzo;
      if (!Number.isFinite(horas) || horas < 0) horas = 0;

      const normales = Math.min(8, horas);
      const extra = Math.max(0, horas - 8);
      const noTrab = Math.max(0, 8 - normales);

      const pagoDia = normales * tarifaHora;
      const descuentoDia = noTrab * tarifaHora;

      horasTrabTot += normales;
      horasExtraTot += extra;
      horasNoTrabTot += noTrab;
      totalPagar += pagoDia;
      totalDescuento += descuentoDia;

      detalle.push({ dia, normales, noTrab, pagoDia });
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

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
    doc.text(`Horas trabajadas: ${horasTrabTot.toFixed(2)}`, 14, y);
    y += 6;
    doc.text(`Horas NO trabajadas (descuento): ${horasNoTrabTot.toFixed(2)}`, 14, y);
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
// 🔹 INICIO
// ===============================
backHome();
setDefaultDate();
periodoResumen.value = "diario";
loadEmpleados();
loadMarcaciones();
updateChart();
