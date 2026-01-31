function loginAdmin(){
  auth.signInWithEmailAndPassword(adminEmail.value,adminPass.value)
  .then(()=>{
    hideAll();
    adminPanel.classList.remove("hidden");
    setDefaultDate();
    loadEmpleados();
    loadMarcaciones();
    updateChart();
  })
  .catch(()=>alert("Error de acceso"));
}

function logout(){ auth.signOut(); backHome(); }

function agregarEmpleado(){
  const nombre=nombreEmpleado.value.trim();
  const pin=pinEmpleado.value.trim();
  if(!nombre||!pin){alert("Completa todos los campos"); return;}
  const id=db.ref("empleados").push().key;
  db.ref("empleados/"+id).set({nombre,pin,creado:Date.now(),salario:0,tipoSalario:"diario"});
  nombreEmpleado.value=""; pinEmpleado.value="";
}

function cargarEmpleados(){
  const cont=listaEmpleados;
  db.ref("empleados").on("value",snap=>{
    cont.innerHTML="";
    snap.forEach(emp=>{
      const data=emp.val();
      cont.innerHTML+=`<div class="empleado">
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
function loadEmpleados(){ cargarEmpleados(); }

function borrarEmpleado(id){
  if(confirm("¿Seguro?")){
    db.ref("empleados/"+id).remove();
    db.ref("marcaciones/"+id).remove();
  }
}

function asignarSalario(empID){
  const salario=prompt("Salario:");
  const tipo=prompt("Tipo (diario/quincenal/mensual):","diario");
  db.ref("empleados/"+empID).update({salario:parseFloat(salario),tipoSalario:tipo});
}

function generarOlerite(empID){
  db.ref("empleados/"+empID).once("value",snap=>{
    const emp=snap.val();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Olerite de Pago",20,20);
    doc.text(`Empleado: ${emp.nombre}`,20,40);
    doc.text(`Salario: ${emp.salario}`,20,50);
    doc.save(`Olerite_${emp.nombre}.pdf`);
  });
}
