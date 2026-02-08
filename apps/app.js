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
      cont.innerHTML += `<div class="empleado">
        <strong>${data.nombre}</strong><br>
        PIN: ${data.pin}<br>
        Valor hora: $${data.valorHora || 0}<br>
        Salario: ${data.salario} (${data.tipoSalario})
        <div class="empActions">
          <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
          <button onclick="asignarSalario('${emp.key}')">Asignar Salario</button>
          <button onclick="generarOlerite('${emp.key}')">Olerite PDF</button>
        </div>
      </div>`;
    });
  });
}

function loadEmpleados() {
  cargarEmpleados();
  llenarSelectEmpleados();
}

function borrarEmpleado(id) {
  if (confirm("¿Seguro que deseas borrar este empleado?")) {
    db.ref("empleados/" + id).remove();
    db.ref("marcaciones/" + id).remove();
  }
}

function asignarSalario(empID) {
  const salario = prompt("Ingresa el salario:");
  if (!salario) return;
  const valorHora = prompt("Valor hora del empleado ($):", "0");
  db.ref("empleados/" + empID).update({
    salario: parseFloat(salario),
    valorHora: parseFloat(valorHora)
  });
  loadEmpleados();
}

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
    doc.text(`Valor hora: $${emp.valorHora || 0}`, 20, 60);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 70);
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
  const fecha = `${yyyy}-${mm<10?'0'+mm:mm}-${dd<10?'0'+dd:dd}`;
  const ref = db.ref("marcaciones/" + empleadoActual.id + "/" + fecha);

  ref.once("value", snap => {
    const marc = snap.val() || {};
    let lastEtapa = null, lastTime = 0;
    Object.values(marc).forEach(m => { if(m.timestamp && m.timestamp>lastTime){lastTime=m.timestamp;lastEtapa=m.tipo;}});
    const lastIndex = lastEtapa ? etapas.indexOf(lastEtapa) : -1;
    if(lastIndex===-1 && tipo!=='entrada'){ document.getElementById("empMsg").innerHTML="⚠️ Debes iniciar con Entrada"; return;}
    if(lastIndex!==-1 && etapas.indexOf(tipo)!==lastIndex+1){ document.getElementById("empMsg").innerHTML="⚠️ Debes seguir el orden de marcación"; return;}

    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(pos=>{
        const lat=pos.coords.latitude, lon=pos.coords.longitude;
        const hora=now.toLocaleTimeString(), timestamp=now.getTime();
        ref.child(tipo).set({ nombre: empleadoActual.nombre, tipo, fecha, hora, timestamp, lat, lon });
        let frase="";
        if(tipo==="entrada") frase="¡Que tengas un buen inicio de jornada!";
        if(tipo==="almuerzo_salida") frase="Buen provecho 🍽️";
        if(tipo==="almuerzo_regreso") frase="Bienvenido de vuelta 👋";
        if(tipo==="salida") frase="¡Buen trabajo!";
        document.getElementById("empMsg").innerHTML=`${empleadoActual.nombre} | ${frase} (${hora})`;
        mostrarNotificacion(`${empleadoActual.nombre} marcó ${tipo} a las ${hora}`);
        setTimeout(backHome,2000);
        loadMarcaciones();
        updateChart();
      },()=>alert("No se pudo obtener ubicación GPS"));
    } else alert("GPS no disponible");
}

// 🔹 ADMIN – RESUMEN MARCACIONES
let excelRows=[], excelSalarial=[], allMarcaciones={};

function loadMarcaciones() {
  db.ref("marcaciones").on("value", snap=>{
    allMarcaciones = snap.val() || {};
    renderAdminList(document.getElementById("filterDate").value);
    updateChart();
  });
}

function renderAdminList(dateFilter) {
  const cont=document.getElementById("adminList");
  const notif=document.getElementById("notificaciones");
  cont.innerHTML=""; notif.innerHTML=""; excelRows=[]; excelSalarial=[];

  const periodo=document.getElementById("periodoResumen").value;
  const empIDs=Object.keys(allMarcaciones).sort((a,b)=>{
    const nameA=Object.values(allMarcaciones[a])[0]?Object.values(Object.values(allMarcaciones[a])[0])[0].nombre:'';
    const nameB=Object.values(allMarcaciones[b])[0]?Object.values(Object.values(allMarcaciones[b])[0])[0].nombre:'';
    return nameA.localeCompare(nameB);
  });

  empIDs.forEach(empID=>{
    const fechas=allMarcaciones[empID];
    Object.keys(fechas).sort().forEach(fecha=>{
      if(dateFilter && !fecha.startsWith(dateFilter.substring(0,7)) && periodo!=="diario") return;
      if(periodo==="diario" && dateFilter && fecha!==dateFilter) return;
      const tipos=fechas[fecha];
      Object.keys(tipos).sort().forEach(tipo=>{
        const data=tipos[tipo];
        if(!data.nombre) data.nombre="Sin nombre";
        cont.innerHTML+=`<p><b>${data.nombre}</b> | ${data.tipo} | ${fecha} | ${data.hora}</p>`;
        excelRows.push([data.nombre, fecha, data.tipo, data.hora]);
        excelSalarial.push({ nombre:data.nombre, fecha:data.fecha, tipo:data.tipo, timestamp:data.timestamp });
        notif.innerHTML+=`<div class="notif">${data.nombre} marcó ${data.tipo} a las ${data.hora}</div>`;
      });
    });
  });
}

// 🔹 EXPORTACIÓN EXCEL
function exportExcelFiltro(){ /* ... igual que antes ... */ }
function exportExcelSalarialFiltro(){ /* ... igual que antes ... */ }

// 🔹 CALENDARIO
function setDefaultDate(){ /* ... igual que antes ... */ }

document.getElementById("filterDate").addEventListener("change",()=>{renderAdminList(document.getElementById("filterDate").value); updateChart();});
document.getElementById("periodoResumen").addEventListener("change",()=>{renderAdminList(document.getElementById("filterDate").value); updateChart();});

// 🔹 NOTIFICACIONES
function mostrarNotificacion(text){
  const notif=document.getElementById("notificaciones");
  const div=document.createElement("div");
  div.className="notif";
  div.innerText=text;
  notif.prepend(div);
}

// 🔹 GRÁFICO HORAS
function renderChart(startDate='', endDate=''){ /* ... igual que antes ... */ }
function updateChart(){ const start=document.getElementById("chartStart").value; const end=document.getElementById("chartEnd").value; renderChart(start,end);}
document.getElementById("chartStart").addEventListener("change", updateChart);
document.getElementById("chartEnd").addEventListener("change", updateChart);

// 🔽 MINIMIZAR/EXPANDIR SECCIONES
function toggleSection(id){
  const el=document.getElementById(id);
  const header=el.previousElementSibling;
  if(el.style.display==='none'){ el.style.display='block'; header.innerHTML=header.innerHTML.replace('▲','▼'); }
  else { el.style.display='none'; header.innerHTML=header.innerHTML.replace('▼','▲'); }
}

// 🔹 LLENAR SELECT DE EMPLEADOS
function llenarSelectEmpleados(){
  const select=document.getElementById("empleadoFiltro");
  select.innerHTML='<option value="todos">Todos</option>';
  db.ref("empleados").once("value").then(snap=>{
    const empleados=snap.val(); if(!empleados) return;
    for(const empId in empleados){
      const option=document.createElement("option");
      option.value=empId; option.textContent=empleados[empId].nombre;
      select.appendChild(option);
    }
  });
}

// 🔹 CÁLCULO DE PAGOS CON BANCO DE HORAS
async function calcularPagos(){
  const start=document.getElementById("payStart").value;
  const end=document.getElementById("payEnd").value;
  const resultsDiv=document.getElementById("payResults");
  const filtro=document.getElementById("empleadoFiltro").value;
  if(!start || !end){ alert("Selecciona un rango de fechas"); return; }
  resultsDiv.innerHTML="Calculando...";

  const empleadosSnap=await db.ref("empleados").once("value");
  const empleados=empleadosSnap.val();
  let html="";

  for(const empId in empleados){
    if(filtro!=="todos" && filtro!==empId) continue;
    const emp=empleados[empId];
    const nombre=emp.nombre;
    const valorHora=emp.valorHora || 0;

    const marcSnap=await db.ref("marcaciones/"+empId).once("value");
    const marcaciones=marcSnap.val(); if(!marcaciones) continue;

    let totalMinutos=0, bancoMinutos=0;
    for(const fecha in marcaciones){
      if(fecha>=start && fecha<=end){
        const dia=marcaciones[fecha];
        if(dia.entrada?.timestamp && dia.salida?.timestamp){
          let minutosTrabajados=(dia.salida.timestamp-dia.entrada.timestamp)/60000;
          if(dia.almuerzo_salida?.timestamp && dia.almuerzo_regreso?.timestamp){
            minutosTrabajados -= (dia.almuerzo_regreso.timestamp-dia.almuerzo_salida.timestamp)/60000;
          }
          totalMinutos+=minutosTrabajados;
          if((minutosTrabajados/60)>8) bancoMinutos+=((minutosTrabajados/60)-8)*60;
        }
      }
    }

    const totalHoras=(totalMinutos/60).toFixed(2);
    const bancoHoras=(bancoMinutos/60).toFixed(2);
    const totalPagar=(totalHoras*valorHora).toFixed(2);

    html+=`<div class="card" style="margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:6px;">
      <strong>${nombre}</strong><br>
      Horas trabajadas: ${totalHoras} h<br>
      Banco de horas: ${bancoHoras} h<br>
      Valor hora: $${valorHora}<br>
      <strong>Total a pagar: $${totalPagar}</strong>
    </div>`;
  }

  resultsDiv.innerHTML=html;
}

// Botón calcular pagos
document.getElementById("calcularPagosBtn").addEventListener("click", calcularPagos);

// 🔹 INICIO
backHome();
setDefaultDate();
loadEmpleados();
loadMarcaciones();
updateChart();
