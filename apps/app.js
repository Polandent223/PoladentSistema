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
  const tipo = prompt("Tipo de salario (diario/quincenal/mensual):", "diario");
  db.ref("empleados/" + empID).update({ salario: parseFloat(salario), tipoSalario: tipo });
  loadEmpleados();
}

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
  const botones = document.getElementById("employeeButtons");
  const nombreGrande = document.getElementById("empNombreGrande");
  const msg = document.getElementById("empMsg");

  if (!pin) {
    botones.classList.add("hidden");
    nombreGrande.innerHTML = "";
    msg.innerHTML = "";
    empleadoActual = null;
    return;
  }

  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value", snap => {
    if (!snap.exists()) {
      botones.classList.add("hidden");
      nombreGrande.innerHTML = "";
      msg.innerHTML = "⚠️ PIN no encontrado";
      empleadoActual = null;
      return;
    }

    snap.forEach(empSnap => {
      empleadoActual = { id: empSnap.key, nombre: empSnap.val().nombre };
      nombreGrande.innerHTML = empleadoActual.nombre;
      botones.classList.remove("hidden");
      msg.innerHTML = "";
    });
  });
}

// 🔹 FUNCIONES MARCACIÓN
function mark(tipo) {
  if (!empleadoActual) return;

  const now = new Date();
  const yyyy = now.getFullYear(), mm = now.getMonth() + 1, dd = now.getDate();
  const fecha = `${yyyy}-${mm < 10 ? '0'+mm:mm}-${dd < 10 ? '0'+dd:dd}`;
  const ref = db.ref(`marcaciones/${empleadoActual.id}/${fecha}`);

  ref.once("value", snap => {
    const marc = snap.val() || {};
    const lastIndex = Object.values(marc).reduce((max, m) => {
      const idx = etapas.indexOf(m.tipo);
      return idx > max ? idx : max;
    }, -1);

    if ((lastIndex === -1 && tipo !== 'entrada') ||
        (lastIndex !== -1 && etapas.indexOf(tipo) !== lastIndex + 1)) {
      document.getElementById("empMsg").innerHTML = "⚠️ Debes seguir el orden de marcación";
      return;
    }

    const hora = now.toLocaleTimeString();
    const timestamp = now.getTime();

    ref.push().set({
      nombre: empleadoActual.nombre,
      tipo,
      fecha,
      hora,
      timestamp
    });

    let mensaje = "";
    if (tipo === "entrada") mensaje = `👋 Buenos días ${empleadoActual.nombre}, ¡Que tengas una excelente jornada!`;
    if (tipo === "almuerzo_salida") mensaje = `🍽️ Buen provecho ${empleadoActual.nombre}`;
    if (tipo === "almuerzo_regreso") mensaje = `💪 Bienvenido de nuevo ${empleadoActual.nombre}, ¡Seguimos con todo!`;
    if (tipo === "salida") mensaje = `🏁 Buen trabajo ${empleadoActual.nombre}, nos vemos mañana`;

    document.getElementById("empMsg").innerHTML = mensaje;
    mostrarNotificacion(`${empleadoActual.nombre} marcó ${tipo} a las ${hora}`);

    // Oculta botones y limpia PIN después de 2s
    setTimeout(backHome, 2000);

    loadMarcaciones();
    updateChart();
  });
}

// 🔹 NOTIFICACIONES
function mostrarNotificacion(text){
  const notif=document.getElementById("notificaciones");
  const div=document.createElement("div");
  div.className="notif";
  div.innerText=text;
  notif.prepend(div);
}

// 🔹 INICIO
backHome();
setDefaultDate();
loadEmpleados();
loadMarcaciones();
updateChart();
