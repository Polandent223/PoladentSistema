let empleadoActual=null;

document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("empPin").addEventListener("input",buscarEmpleado);
});

function buscarEmpleado(){
  const pin=document.getElementById("empPin").value.trim();

  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value",snap=>{
    if(!snap.exists()) return;

    snap.forEach(e=>{
      empleadoActual={id:e.key,nombre:e.val().nombre};
      document.getElementById("empNombreGrande").innerHTML=empleadoActual.nombre;
      document.getElementById("employeeButtons").classList.remove("hidden");
    });
  });
}

function mark(tipo){
  if(!empleadoActual) return;

  const now=new Date();
  const fecha=now.toISOString().split('T')[0];

  db.ref("marcaciones/"+empleadoActual.id+"/"+fecha+"/"+tipo).set({
    nombre:empleadoActual.nombre,
    tipo,
    fecha,
    hora:now.toLocaleTimeString(),
    timestamp:now.getTime()
  });

  document.getElementById("empMsg").innerHTML="Marcado ✔️";
  setTimeout(backHome,1500);
}
