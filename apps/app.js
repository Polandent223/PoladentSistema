// ================== ELEMENTOS PRINCIPALES ==================
const home = document.getElementById("home");
const adminLogin = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const employeePanel = document.getElementById("employeePanel");
const fechaDesde = document.getElementById("fechaDesde");
const fechaHasta = document.getElementById("fechaHasta");

// ================== BOTONES ==================
btnAdmin.onclick = () => goAdmin();
btnEmployee.onclick = () => goEmployee();
backHomeBtn1.onclick = () => backHome();
backHomeBtn2.onclick = () => backHome();
loginBtn.onclick = () => loginAdmin();
guardarEmpleadoBtn.onclick = () => agregarEmpleado();
exportMarcBtn.onclick = () => exportExcelFiltro();
exportSalarioBtn.onclick = () => exportExcelSalarialFiltro();
logoutBtn.onclick = () => logout();

entradaBtn.onclick = () => mark('entrada');
almuerzoSalidaBtn.onclick = () => mark('almuerzo_salida');
almuerzoRegresoBtn.onclick = () => mark('almuerzo_regreso');
salidaBtn.onclick = () => mark('salida');

empPin.addEventListener("input", pinInputHandler);

// ================== NAVEGACIÓN ==================
function hideAll(){
  home.classList.add("hidden");
  adminLogin.classList.add("hidden");
  adminPanel.classList.add("hidden");
  employeePanel.classList.add("hidden");
}

function backHome(){
  hideAll();
  home.classList.remove("hidden");
  empNombreGrande.innerHTML="";
  empPin.value="";
  employeeButtons.classList.add("hidden");
  empMsg.innerHTML="";
}

function goAdmin(){ hideAll(); adminLogin.classList.remove("hidden"); }
function goEmployee(){ hideAll(); employeePanel.classList.remove("hidden"); }

// ================== LOGIN ADMIN ==================
function loginAdmin(){
  auth.signInWithEmailAndPassword(adminEmail.value, adminPass.value)
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

// ================== EMPLEADOS ==================
function agregarEmpleado(){
  const nombre = nombreEmpleado.value.trim();
  const pin = pinEmpleado.value.trim();
  if(!nombre || !pin) return alert("Completa los campos");

  const id = db.ref("empleados").push().key;
  db.ref("empleados/"+id).set({
    nombre,pin,creado:Date.now(),
    salario:0,tipoSalario:"diario"
  });

  nombreEmpleado.value="";
  pinEmpleado.value="";
}

function cargarEmpleados(){
  const cont = listaEmpleados;
  db.ref("empleados").on("value",snap=>{
    cont.innerHTML="";
    snap.forEach(emp=>{
      const d=emp.val();
      cont.innerHTML+=`
      <div class="empleado">
        <strong>${d.nombre}</strong><br>
        PIN: ${d.pin}<br>
        Salario: ${d.salario} (${d.tipoSalario})
        <div class="empActions">
          <button onclick="borrarEmpleado('${emp.key}')">Borrar</button>
          <button onclick="asignarSalario('${emp.key}')">Salario</button>
        </div>
      </div>`;
    });
  });
}

function loadEmpleados(){ cargarEmpleados(); }

function borrarEmpleado(id){
  if(confirm("¿Borrar empleado?")){
    db.ref("empleados/"+id).remove();
    db.ref("marcaciones/"+id).remove();
  }
}

function asignarSalario(id){
  const salario = prompt("Salario:");
  const tipo = prompt("Tipo (diario/quincenal/mensual):","diario");
  db.ref("empleados/"+id).update({
    salario:parseFloat(salario),
    tipoSalario:tipo
  });
}

// ================== PIN EMPLEADO ==================
let empleadoActual=null;

function pinInputHandler(){
  const pin=empPin.value.trim();
  if(!pin){
    employeeButtons.classList.add("hidden");
    empNombreGrande.innerHTML="";
    return;
  }

  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value")
  .then(snap=>{
    if(!snap.exists()){
      empMsg.innerText="PIN no encontrado";
      return;
    }
    snap.forEach(e=>{
      empleadoActual={id:e.key,nombre:e.val().nombre};
      empNombreGrande.innerHTML=empleadoActual.nombre;
      employeeButtons.classList.remove("hidden");
      empMsg.innerHTML="";
    });
  });
}

// ================== MARCACIÓN CORREGIDA ==================
function mark(tipo){
  if(!empleadoActual) return;

  const now=new Date();
  const fecha=now.toISOString().split("T")[0];
  const ref=db.ref(`marcaciones/${empleadoActual.id}/${fecha}`);

  empMsg.innerText="Registrando...";

  ref.once("value").then(snap=>{
    const marc=snap.val()||{};

    if(marc.salida) return empMsg.innerText="Jornada finalizada";
    if(!marc.entrada && tipo!=="entrada") return empMsg.innerText="Debes iniciar con Entrada";
    if(marc.entrada && !marc.almuerzo_salida && tipo!=="almuerzo_salida" && tipo!=="entrada") return empMsg.innerText="Marca salida almuerzo";
    if(marc.almuerzo_salida && !marc.almuerzo_regreso && tipo!=="almuerzo_regreso") return empMsg.innerText="Marca regreso almuerzo";
    if(marc.almuerzo_regreso && !marc.salida && tipo!=="salida") return empMsg.innerText="Marca salida final";

    navigator.geolocation.getCurrentPosition(pos=>{
      ref.update({
        [tipo]:{
          nombre:empleadoActual.nombre,
          tipo,
          hora:now.toLocaleTimeString(),
          timestamp:now.getTime(),
          lat:pos.coords.latitude,
          lon:pos.coords.longitude
        }
      }).then(()=>{
        empMsg.innerText="✔ Registrado";
        setTimeout(backHome,2000);
        loadMarcaciones();
        updateChart();
      });
    });
  });
}

// ================== MARCACIONES ADMIN ==================
let allMarcaciones={};

function loadMarcaciones(){
  db.ref("marcaciones").on("value",snap=>{
    allMarcaciones=snap.val()||{};
    renderAdminList();
    updateChart();
  });
}

function renderAdminList(){
  adminList.innerHTML="";
  for(const emp in allMarcaciones){
    for(const fecha in allMarcaciones[emp]){
      const tipos=allMarcaciones[emp][fecha];
      Object.values(tipos).forEach(d=>{
        adminList.innerHTML+=`<p><b>${d.nombre}</b> | ${d.tipo} | ${fecha} | ${d.hora}</p>`;
      });
    }
  }
}

// ================== GRÁFICO ==================
function updateChart(){
  const ctx=horasChart.getContext("2d");
  const resumen={};

  for(const emp in allMarcaciones){
    for(const fecha in allMarcaciones[emp]){
      const t=allMarcaciones[emp][fecha];
      if(t.entrada && t.salida){
        const hrs=(t.salida.timestamp-t.entrada.timestamp)/3600000;
        resumen[t.entrada.nombre]=(resumen[t.entrada.nombre]||0)+hrs;
      }
    }
  }

  if(window.hChart) window.hChart.destroy();
  window.hChart=new Chart(ctx,{
    type:"bar",
    data:{
      labels:Object.keys(resumen),
      datasets:[{data:Object.values(resumen)}]
    }
  });
}

// ================== INICIO ==================
backHome();
loadEmpleados();
loadMarcaciones();
