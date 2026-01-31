function loginAdmin(){
  const email = document.getElementById("adminEmail").value;
  const pass = document.getElementById("adminPass").value;

  auth.signInWithEmailAndPassword(email,pass)
  .then(()=>{
    hideAll();
    document.getElementById("adminPanel").classList.remove("hidden");
    setDefaultDate();
    loadEmpleados();
    loadMarcaciones();
  })
  .catch(()=>alert("Error de acceso"));
}

function logout(){
  auth.signOut();
  backHome();
}

function agregarEmpleado(){
  const nombre=document.getElementById("nombreEmpleado").value.trim();
  const pin=document.getElementById("pinEmpleado").value.trim();

  if(!nombre||!pin){alert("Completa todo");return;}

  const id=db.ref("empleados").push().key;
  db.ref("empleados/"+id).set({
    nombre,pin,creado:Date.now(),salario:0,tipoSalario:"diario"
  });

  document.getElementById("nombreEmpleado").value="";
  document.getElementById("pinEmpleado").value="";
}

function cargarEmpleados(){
  const cont=document.getElementById("listaEmpleados");

  db.ref("empleados").on("value",snap=>{
    cont.innerHTML="";
    snap.forEach(emp=>{
      const d=emp.val();
      cont.innerHTML+=`
        <div class="empleado">
          <b>${d.nombre}</b><br>
          PIN: ${d.pin}
        </div>`;
    });
  });
}
function loadEmpleados(){cargarEmpleados();}
