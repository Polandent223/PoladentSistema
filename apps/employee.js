let empleadoActual=null;

// 👤 BUSCAR EMPLEADO POR PIN
document.getElementById("empPin").addEventListener("input", ()=>{
  const pin=document.getElementById("empPin").value.trim();
  if(!pin){
    document.getElementById("employeeButtons").classList.add("hidden");
    document.getElementById("empNombreGrande").innerHTML="";
    return;
  }

  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value", snap=>{
    if(!snap.exists()){
      document.getElementById("employeeButtons").classList.add("hidden");
      document.getElementById("empNombreGrande").innerHTML="";
      document.getElementById("empMsg").innerHTML="⚠️ PIN no encontrado";
      return;
    }

    snap.forEach(empSnap=>{
      empleadoActual={id:empSnap.key,nombre:empSnap.val().nombre};
      document.getElementById("empNombreGrande").innerHTML=empleadoActual.nombre;
      document.getElementById("employeeButtons").classList.remove("hidden");
      document.getElementById("empMsg").innerHTML="";
    });
  });
});

// 👷 MARCAR ENTRADA/ALMUERZO/SALIDA
function mark(tipo){
  if(!empleadoActual) return;

  const now=new Date();
  const fecha=now.toISOString().split('T')[0];
  const ref=db.ref("marcaciones/"+empleadoActual.id+"/"+fecha+"/"+tipo);

  ref.set({
    nombre:empleadoActual.nombre,
    tipo,
    fecha,
    hora:now.toLocaleTimeString(),
    timestamp:now.getTime()
  });

  let frase="";
  if(tipo=="entrada") frase="¡Que tengas un buen inicio de jornada!";
  if(tipo=="almuerzo_salida") frase="Buen provecho 🍽️";
  if(tipo=="almuerzo_regreso") frase="Bienvenido de vuelta 👋";
  if(tipo=="salida") frase="¡Buen trabajo!";

  document.getElementById("empMsg").innerHTML=`${empleadoActual.nombre} | ${frase}`;
  setTimeout(backHome,2000);
}

// 🌐 EXPONER AL HTML
window.mark = mark;
