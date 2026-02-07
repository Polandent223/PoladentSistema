// 🔹 ELEMENTOS PRINCIPALES
const home = document.getElementById("home");
const adminLogin = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const employeePanel = document.getElementById("employeePanel");

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
document.getElementById("entradaBtn").onclick = () => mark('entrada');
document.getElementById("almuerzoSalidaBtn").onclick = () => mark('almuerzo_salida');
document.getElementById("almuerzoRegresoBtn").onclick = () => mark('almuerzo_regreso');
document.getElementById("salidaBtn").onclick = () => mark('salida');

// Input PIN empleado
document.getElementById("empPin").addEventListener("input", pinInputHandler);

// 🔹 NAVEGACIÓN
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

function goAdmin() { hideAll(); adminLogin.classList.remove("hidden"); }
function goEmployee() { hideAll(); employeePanel.classList.remove("hidden"); }

// 🔹 LOGIN ADMIN
function loginAdmin() {
  const email = document.getElementById("adminEmail").value;
  const pass = document.getElementById("adminPass").value;

  auth.signInWithEmailAndPassword(email, pass)
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

function logout() { auth.signOut(); backHome(); }

// 🔹 EMPLEADOS
function agregarEmpleado() {
  const nombre = document.getElementById("nombreEmpleado").value.trim();
  const pin = document.getElementById("pinEmpleado").value.trim();
  if (!nombre || !pin) { alert("Completa todos los campos"); return; }

  const id = db.ref("empleados").push().key;
  db.ref("empleados/" + id).set({ nombre, pin, creado: Date.now(), salario: 0, tipoSalario: "diario" });

  document.getElementById("nombreEmpleado").value = "";
  document.getElementById("pinEmpleado").value = "";
}

function cargarEmpleados() {
  const cont = document.getElementById("listaEmpleados");
  db.ref("empleados").on("value", snap => {
    cont.innerHTML = "";
    snap.forEach(emp => {
      const data = emp.val();
      cont.innerHTML+=`<div class="empleado">
  <strong>${data.nombre}</strong><br>
  PIN: ${data.pin}<br>
  Valor hora: $${data.valorHora}<br>
  Salario: ${data.salario} (${data.tipoSalario})
  <div class="empActions">
    <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
    <button onclick="asignarSalario('${emp.key}')">Asignar Salario</button>
    <button onclick="generarOlerite('${emp.key}')">Olerite PDF</button>
  </div>
</div>`;
        <div class="empActions">
          <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
          <button onclick="asignarSalario('${emp.key}')">Asignar Salario</button>
          <button onclick="generarOlerite('${emp.key}')">Olerite PDF</button>
        </div>
      </div>`;
    });
  });
}

function loadEmpleados() { cargarEmpleados(); }

function borrarEmpleado(id) {
  if (confirm("¿Seguro que deseas borrar este empleado?")) {
    db.ref("empleados/" + id).remove();
    db.ref("marcaciones/" + id).remove();
  }
}

function asignarSalario(empID) {
  const salario = prompt("Ingresa el salario:");
  if (!salario) return;
 const valorHora = 
   document.getElementById("valorHoraEmpleado").value) || 0;

db.ref("empleados/"+id).set({
  nombre,
  pin,
  valorHora,
  creado: Date.now(),
  salario: 0,
  tipoSalario: "diario"
});

// 🔹 OLERITE PDF
function generarOlerite(empID) {
  db.ref("empleados/" + empID).once("value", snap => {
    const emp = snap.val();
    if (!emp) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Olerite de Pago", 20, 20);
    doc.setFontSize(14);
    doc.text(`Empleado: ${emp.nombre}`, 20, 40);
    doc.text(`Salario: ${emp.salario} (${emp.tipoSalario})`, 20, 50);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 60);
    doc.save(`Olerite_${emp.nombre}.pdf`);
  });
}

// 🔹 EMPLEADO PIN + BOTONES DINÁMICOS
let empleadoActual = null;
const etapas = ['entrada', 'almuerzo_salida', 'almuerzo_regreso', 'salida'];

function pinInputHandler() {
  const pin = document.getElementById("empPin").value.trim();
  if (!pin) {
    document.getElementById("employeeButtons").classList.add("hidden");
    document.getElementById("empNombreGrande").innerHTML = "";
    return;
  }

  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value", snap => {
    if (!snap.exists()) {
      document.getElementById("employeeButtons").classList.add("hidden");
      document.getElementById("empNombreGrande").innerHTML = "";
      document.getElementById("empMsg").innerHTML = "⚠️ PIN no encontrado";
      return;
    }

    snap.forEach(empSnap => {
      empleadoActual = { id: empSnap.key, nombre: empSnap.val().nombre };
      document.getElementById("empNombreGrande").innerHTML = empleadoActual.nombre;
      document.getElementById("employeeButtons").classList.remove("hidden");
      document.getElementById("empMsg").innerHTML = "";
    });
  });
}

// 🔹 FUNCIONES MARCACIÓN
function mark(tipo) {
  if (!empleadoActual) return;

  const now = new Date();
  const yyyy = now.getFullYear(), mm = now.getMonth() + 1, dd = now.getDate();
  const fecha = `${yyyy}-${mm < 10 ? '0'+mm:mm}-${dd < 10 ? '0'+dd:dd}`;
  const ref = db.ref("marcaciones/" + empleadoActual.id + "/" + fecha);

  ref.once("value", snap => {
    const marc = snap.val() ? snap.val() : {};
    let lastEtapa = null, lastTime = 0;
    Object.values(marc).forEach(m => {
      if (m.timestamp && m.timestamp > lastTime) { lastTime = m.timestamp; lastEtapa = m.tipo; }
    });

    const lastIndex = lastEtapa ? etapas.indexOf(lastEtapa) : -1;
    if (lastIndex === -1 && tipo !== 'entrada') {
      document.getElementById("empMsg").innerHTML = "⚠️ Debes iniciar con Entrada"; return;
    }
    if (lastIndex !== -1 && etapas.indexOf(tipo) !== lastIndex + 1) {
      document.getElementById("empMsg").innerHTML = "⚠️ Debes seguir el orden de marcación"; return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        const hora = now.toLocaleTimeString(), timestamp = now.getTime();
        ref.child(tipo).set({ nombre: empleadoActual.nombre, tipo, fecha, hora, timestamp, lat, lon });
        let frase = "";
        if (tipo === "entrada") frase = "¡Que tengas un buen inicio de jornada!";
        if (tipo === "almuerzo_salida") frase = "Buen provecho 🍽️";
        if (tipo === "almuerzo_regreso") frase = "Bienvenido de vuelta 👋";
        if (tipo === "salida") frase = "¡Buen trabajo!";
        document.getElementById("empMsg").innerHTML = `${empleadoActual.nombre} | ${frase} (${hora})`;
        mostrarNotificacion(`${empleadoActual.nombre} marcó ${tipo} a las ${hora}`);
        setTimeout(backHome, 2000);
        loadMarcaciones();
        updateChart();
      }, () => alert("No se pudo obtener ubicación GPS"));
    } else alert("GPS no disponible");
  });
}

// 🔹 ADMIN – RESUMEN MARCACIONES
let excelRows = [], excelSalarial = [], allMarcaciones = {};

function loadMarcaciones() {
  db.ref("marcaciones").on("value", snap => {
    allMarcaciones = snap.val() || {};
    renderAdminList(document.getElementById("filterDate").value);
    updateChart();
  });
}

function renderAdminList(dateFilter) {
  const cont = document.getElementById("adminList");
  const notif = document.getElementById("notificaciones");
  cont.innerHTML = ""; notif.innerHTML = ""; excelRows = []; excelSalarial = [];

  const periodo = document.getElementById("periodoResumen").value;
  const empIDs = Object.keys(allMarcaciones).sort((a,b)=>{
    const nameA = Object.values(allMarcaciones[a])[0]? Object.values(Object.values(allMarcaciones[a])[0])[0].nombre:'';
    const nameB = Object.values(allMarcaciones[b])[0]? Object.values(Object.values(allMarcaciones[b])[0])[0].nombre:'';
    return nameA.localeCompare(nameB);
  });

  empIDs.forEach(empID => {
    const fechas = allMarcaciones[empID];
    Object.keys(fechas).sort().forEach(fecha => {
      if(dateFilter && !fecha.startsWith(dateFilter.substring(0,7)) && periodo!=="diario") return;
      if(periodo==="diario" && dateFilter && fecha!==dateFilter) return;
      const tipos = fechas[fecha];
      Object.keys(tipos).sort().forEach(tipo => {
        const data = tipos[tipo];
        if(!data.nombre) data.nombre="Sin nombre";
        cont.innerHTML += `<p><b>${data.nombre}</b> | ${data.tipo} | ${fecha} | ${data.hora}</p>`;
        excelRows.push([data.nombre, fecha, data.tipo, data.hora]);
        excelSalarial.push({ nombre:data.nombre, fecha:data.fecha, tipo:data.tipo, timestamp:data.timestamp });
        notif.innerHTML += `<div class="notif">${data.nombre} marcó ${data.tipo} a las ${data.hora}</div>`;
      });
    });
  });
}

// 🔹 EXPORTACIÓN EXCEL
function exportExcelFiltro() {
  const fecha = document.getElementById("filterDate").value;
  const periodo = document.getElementById("periodoResumen").value;
  const rows = [["Nombre","Fecha","Tipo","Hora"]];

  for(const m of excelRows){
    const mFecha = m[1];
    if(periodo==="diario" && mFecha!==fecha) continue;
    if(periodo==="quincenal" && !mFecha.startsWith(fecha.substring(0,7))) continue;
    if(periodo==="mensual" && !mFecha.startsWith(fecha.substring(0,4)+"-"+fecha.substring(5,7))) continue;
    rows.push(m);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Resumen");
  XLSX.writeFile(wb,"Poladent_Marcaciones_Filtro.xlsx");
}

function exportExcelSalarialFiltro() {
  const fecha = document.getElementById("filterDate").value;
  const periodo = document.getElementById("periodoResumen").value;
  const resumen = {};

  for(const m of excelSalarial){
    const mFecha = m.fecha;
    if(periodo==="diario" && mFecha!==fecha) continue;
    if(periodo==="quincenal" && !mFecha.startsWith(fecha.substring(0,7))) continue;
    if(periodo==="mensual" && !mFecha.startsWith(fecha.substring(0,4)+"-"+fecha.substring(5,7))) continue;
    if(!resumen[m.nombre]) resumen[m.nombre] = {dias:{}};
    if(!resumen[m.nombre].dias[mFecha]) resumen[m.nombre].dias[mFecha] = {entrada:null,salida:null};
    if(m.tipo==="entrada") resumen[m.nombre].dias[mFecha].entrada = m.timestamp;
    if(m.tipo==="salida") resumen[m.nombre].dias[mFecha].salida = m.timestamp;
  }

  const wsData = [["Nombre","Fecha","Horas trabajadas","Horas extra","Banco de horas"]];
  for(const emp in resumen){
    let bancoTotal = 0;
    for(const dia in resumen[emp].dias){
      const ent = resumen[emp].dias[dia].entrada;
      const sal = resumen[emp].dias[dia].salida;
      if(!ent || !sal) continue;
      let hrs = (sal-ent)/3600000;
      let extra = Math.max(0, hrs-8);
      let normales = Math.min(8, hrs);
      bancoTotal += extra;
      wsData.push([emp, dia, normales.toFixed(2), extra.toFixed(2), bancoTotal.toFixed(2)]);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Salario");
  XLSX.writeFile(wb,"Poladent_Salario_Filtro.xlsx");
}

// 🔹 CALENDARIO
function setDefaultDate() {
  const today = new Date();
  let month = today.getMonth()+1; if(month<10) month="0"+month;
  let day = today.getDate(); if(day<10) day="0"+day;
  const yyyy = today.getFullYear();
  document.getElementById("filterDate").value = `${yyyy}-${month}-${day}`;
}

document.getElementById("filterDate").addEventListener("change", () => { renderAdminList(document.getElementById("filterDate").value); updateChart(); });
document.getElementById("periodoResumen").addEventListener("change", () => { renderAdminList(document.getElementById("filterDate").value); updateChart(); });

// 🔹 NOTIFICACIONES
function mostrarNotificacion(text){
  const notif=document.getElementById("notificaciones");
  const div=document.createElement("div");
  div.className="notif";
  div.innerText=text;
  notif.prepend(div);
}

// 🔹 GRÁFICO HORAS
function renderChart(startDate='', endDate=''){
  const ctx = document.getElementById("horasChart").getContext("2d");
  let chartData = {labels:[], datasets:[{label:'Horas trabajadas', data:[], backgroundColor:'rgba(0,123,255,0.5)'}]};
  const filtroInicio = startDate ? new Date(startDate) : null;
  const filtroFin = endDate ? new Date(endDate) : null;
  const resumenHoras = {};

  for(const empID in allMarcaciones){
    const fechas = allMarcaciones[empID];
    for(const fecha in fechas){
      const fechaObj = new Date(fecha);
      if(filtroInicio && fechaObj < filtroInicio) continue;
      if(filtroFin && fechaObj > filtroFin) continue;

      const tipos = fechas[fecha];
      let entrada=null, salida=null;
      Object.values(tipos).forEach(m => {
        if(m.tipo==='entrada') entrada=m.timestamp;
        if(m.tipo==='salida') salida=m.timestamp;
      });
      if(!entrada || !salida) continue;
      const nombre = Object.values(tipos)[0].nombre || 'Sin nombre';
      if(!resumenHoras[nombre]) resumenHoras[nombre] = 0;
      resumenHoras[nombre] += (salida-entrada)/3600000;
    }
  }

  chartData.labels = Object.keys(resumenHoras);
  chartData.datasets[0].data = Object.values(resumenHoras);

  if(window.horasChartInstance) window.horasChartInstance.destroy();
  window.horasChartInstance = new Chart(ctx,{
    type:'bar',
    data:chartData,
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

function updateChart(){
  const start = document.getElementById("chartStart").value;
  const end = document.getElementById("chartEnd").value;
  renderChart(start, end);
}

document.getElementById("chartStart").addEventListener("change", updateChart);
document.getElementById("chartEnd").addEventListener("change", updateChart);

// 🔽 MINIMIZAR/EXPANDIR SECCIONES
function toggleSection(id){
  const el = document.getElementById(id);
  const header = el.previousElementSibling;
  if(el.style.display === 'none'){
    el.style.display = 'block';
    header.innerHTML = header.innerHTML.replace('▲','▼');
  } else {
    el.style.display = 'none';
    header.innerHTML = header.innerHTML.replace('▼','▲');
  }
}

/// ================== CALCULO DE PAGOS ADAPTADO ==================
async function calcularPagos() {
  const start = document.getElementById("payStart").value;
  const end = document.getElementById("payEnd").value;
  const resultsDiv = document.getElementById("payResults");
  const filtro = document.getElementById("empleadoFiltro").value;

  if (!start || !end) {
    alert("Selecciona el rango de fechas");
    return;
  }

  resultsDiv.innerHTML = "Calculando...";

  const empleadosSnap = await db.ref("empleados").once("value");
  const empleados = empleadosSnap.val();

  let html = "";

  for (const empId in empleados) {
    if (filtro !== "todos" && filtro !== empId) continue;

    const nombre = empleados[empId].nombre;
    const valorHora = empleados[empId].valorHora || 0;

    const marcacionesSnap = await db.ref("marcaciones/" + empId).once("value");
    const marcaciones = marcacionesSnap.val();
    if (!marcaciones) continue;

    let totalMinutos = 0;

    for (const fecha in marcaciones) {
      if (fecha >= start && fecha <= end) {
        const dia = marcaciones[fecha];

        if (dia.entrada && dia.salida) {
          // Construimos fecha + hora manualmente
          const entrada = new Date(`${fecha}T${dia.entrada}`);
          const salida = new Date(`${fecha}T${dia.salida}`);

          let minutos = (salida - entrada) / 60000;

          if (dia.almuerzo_salida && dia.almuerzo_regreso) {
            const a1 = new Date(`${fecha}T${dia.almuerzo_salida}`);
            const a2 = new Date(`${fecha}T${dia.almuerzo_regreso}`);
            minutos -= (a2 - a1) / 60000;
          }

          totalMinutos += minutos;
        }
      }
    }

    const totalHoras = (totalMinutos / 60).toFixed(2);
    const totalPagar = (totalHoras * valorHora).toFixed(2);

    html += `
      <div class="card">
        <strong>${nombre}</strong><br>
        Horas trabajadas: ${totalHoras} h<br>
        Valor hora: $${valorHora}<br>
        <strong>Total a pagar: $${totalPagar}</strong>
      </div>
    `;
  }

  resultsDiv.innerHTML = html;
      }
async function calcularPagos() {
  const start = document.getElementById("payStart").value;
  const end = document.getElementById("payEnd").value;
  const resultsDiv = document.getElementById("payResults");
  const filtro = document.getElementById("empleadoFiltro").value;

  if (!start || !end) {
    alert("Selecciona un rango de fechas");
    return;
  }

  resultsDiv.innerHTML = "Calculando...";

  const empleadosSnap = await db.ref("empleados").once("value");
  const empleados = empleadosSnap.val();
  let html = "";

  for (const empId in empleados) {
    if (filtro !== "todos" && filtro !== empId) continue;

    const nombre = empleados[empId].nombre;
    const valorHora = empleados[empId].valorHora || 0;

    const marcacionesSnap = await db.ref("marcaciones/" + empId).once("value");
    const marcaciones = marcacionesSnap.val();
    if (!marcaciones) continue;

    let totalMinutos = 0;

    for (const fecha in marcaciones) {
      if (fecha >= start && fecha <= end) {
        const dia = marcaciones[fecha];

        // ⚡ Solo consideramos entrada y salida
        if (dia.entrada?.timestamp && dia.salida?.timestamp) {
          let entrada = dia.entrada.timestamp;
          let salida = dia.salida.timestamp;
          let minutosTrabajados = (salida - entrada) / 60000; // convertir ms a minutos

          // ⚡ Descontar almuerzo si existe
          if (dia.almuerzo_salida?.timestamp && dia.almuerzo_regreso?.timestamp) {
            let almuerzo = (dia.almuerzo_regreso.timestamp - dia.almuerzo_salida.timestamp) / 60000;
            minutosTrabajados -= almuerzo;
          }

          totalMinutos += minutosTrabajados;
        }
      }
    }

    const totalHoras = (totalMinutos / 60).toFixed(2);
    const totalPagar = (totalHoras * valorHora).toFixed(2);

    html += `
      <div class="card">
        <strong>${nombre}</strong><br>
        Horas trabajadas: ${totalHoras} h<br>
        Valor hora: $${valorHora}<br>
        <strong>Total a pagar: $${totalPagar}</strong>
      </div>
    `;
  }

  resultsDiv.innerHTML = html;
}

// 🔹 INICIO
backHome();
setDefaultDate();
loadEmpleados();
loadMarcaciones();
updateChart();
