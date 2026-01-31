let empleadoActual=null;
const etapas=['entrada','almuerzo_salida','almuerzo_regreso','salida'];

function mark(tipo){
  if(!empleadoActual) return;

  const now=new Date();
  const fecha=now.toISOString().split('T')[0];
  const ref=db.ref("marcaciones/"+empleadoActual.id+"/"+fecha);

  ref.once("value", snap => {
    const marc = snap.val()||{};
    let lastEtapa=null, lastTime=0;

    Object.values(marc).forEach(m=>{
      if(m.timestamp>lastTime){
        lastTime=m.timestamp;
        lastEtapa=m.tipo;
      }
    });

    const lastIndex=lastEtapa?etapas.indexOf(lastEtapa):-1;
    if(lastIndex===-1 && tipo!=='entrada'){ alert("Debes iniciar con Entrada"); return; }
    if(lastIndex!==-1 && etapas.indexOf(tipo)!==lastIndex+1){ alert("Sigue el orden"); return; }

    navigator.geolocation.getCurrentPosition(pos=>{
      ref.child(tipo).set({
        nombre:empleadoActual.nombre,
        tipo, fecha,
        hora:now.toLocaleTimeString(),
        timestamp:now.getTime(),
        lat:pos.coords.latitude,
        lon:pos.coords.longitude
      });
      empMsg.innerHTML="Marcación registrada ✔️";
      setTimeout(backHome,1500);
      loadMarcaciones();
      updateChart();
    });
  });
}

empPin.addEventListener("input",()=>{
  const pin=empPin.value.trim();
  db.ref("empleados").orderByChild("pin").equalTo(pin).once("value",snap=>{
    if(!snap.exists()) return;
    snap.forEach(e=>{
      empleadoActual={id:e.key,nombre:e.val().nombre};
      empNombreGrande.innerHTML=empleadoActual.nombre;
      employeeButtons.classList.remove("hidden");
    });
  });
});
