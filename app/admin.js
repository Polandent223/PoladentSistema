// 🔥 LOGIN ADMIN
function loginAdmin(){
  const email = document.getElementById("adminEmail").value;
  const pass = document.getElementById("adminPass").value;

  auth.signInWithEmailAndPassword(email,pass)
  .then(()=>{
    backHome();
    document.getElementById("adminPanel").classList.remove("hidden");
    setDefaultDate();
    loadEmpleados();
    loadMarcaciones();
  })
  .catch(()=>alert("Error de acceso"));
}

// 🔥 LOGOUT
function logout(){
  auth.signOut();
  backHome();
}

// 👷 AGREGAR EMPLEADO
function agregarEmpleado(){
  const nombre=document.getElementById("nombreEmpleado").value.trim();
  const pin=document.getElementById("pinEmpleado").value.trim();

  if(!nombre||!pin){alert("Completa todos los campos"); return;}

  const id=db.ref("empleados").push().key;
  db.ref("empleados/"+id).set({
    nombre,
    pin,
    creado:Date.now(),
    salario:0,
    tipoSalario:"diario"
  });

  document.getElementById("nombreEmpleado").value="";
  document.getElementById("pinEmpleado").value="";
  loadEmpleados();
}

// 👷 CARGAR EMPLEADOS
function cargarEmpleados(){
  const cont=document.getElementById("listaEmpleados");

  db.ref("empleados").on("value",snap=>{
    cont.innerHTML="";
    snap.forEach(emp=>{
      const d=emp.val();
      cont.innerHTML+=`
        <div class="empleado">
          <b>${d.nombre}</b><br>
          PIN: ${d.pin}<br>
          Salario: ${d.salario} (${d.tipoSalario})
          <div class="empActions">
            <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
            <button onclick="asignarSalario('${emp.key}')">Asignar Salario</button>
            <button onclick="generarOlerite('${emp.key}')">Olerite PDF</button>
          </div>
        </div>`;
    });
  });
}

function loadEmpleados(){cargarEmpleados();}

// 👷 BORRAR EMPLEADO
function borrarEmpleado(id){
  if(confirm("¿Seguro que deseas borrar este empleado?")){
    db.ref("empleados/"+id).remove();
    db.ref("marcaciones/"+id).remove();
    loadEmpleados();
  }
}

// 👷 ASIGNAR SALARIO
function asignarSalario(empID){
  const salario=prompt("Ingresa el salario:");
  if(!salario) return;
  const tipo=prompt("Tipo de salario (diario/quincenal/mensual):","diario");
  db.ref("empleados/"+empID).update({salario:parseFloat(salario),tipoSalario:tipo});
  loadEmpleados();
}

// 👷 GENERAR OLERITE PDF
function generarOlerite(empID){
  db.ref("empleados/"+empID).once("value",snap=>{
    const emp=snap.val();
    if(!emp) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("Olerite de Pago",20,20);
    doc.setFontSize(14);
    doc.text(`Empleado: ${emp.nombre}`,20,40);
    doc.text(`Salario: ${emp.salario} (${emp.tipoSalario})`,20,50);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`,20,60);
    doc.save(`Olerite_${emp.nombre}.pdf`);
  });
}

// 🌐 EXPONER AL HTML
window.loginAdmin = loginAdmin;
window.logout = logout;
window.agregarEmpleado = agregarEmpleado;
window.borrarEmpleado = borrarEmpleado;
window.asignarSalario = asignarSalario;
window.generarOlerite = generarOlerite;
window.loadEmpleados = loadEmpleados;
window.toggleSection = window.toggleSection;
window.exportExcelFiltro = exportExcelFiltro;
window.exportExcelSalarialFiltro = exportExcelSalarialFiltro;
window.filterByDate = filterByDate;
