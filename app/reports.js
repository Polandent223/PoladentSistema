// 🔹 VARIABLES GLOBALES DE REPORTES
let allMarcaciones = {};
let excelRows = [];
let excelSalarial = [];

// 📌 CARGAR TODAS LAS MARCACIONES
function loadMarcaciones(){
  db.ref("marcaciones").on("value", snap => {
    allMarcaciones = snap.val() || {};
    renderAdminList(document.getElementById("filterDate").value);
    updateChart();
  });
}

// 📝 RENDERIZAR LISTA ADMIN
function renderAdminList(dateFilter){
  const cont=document.getElementById("adminList");
  const notif=document.getElementById("notificaciones");
  cont.innerHTML=""; notif.innerHTML="";
  excelRows=[]; excelSalarial=[];

  if(!allMarcaciones) return;

  const periodo=document.getElementById("periodoResumen").value;
  const empIDs = Object.keys(allMarcaciones).sort((a,b)=>{
    const nameA=Object.values(allMarcaciones[a])[0]? Object.values(Object.values(allMarcaciones[a])[0])[0].nombre:'';
    const nameB=Object.values(allMarcaciones[b])[0]? Object.values(Object.values(allMarcaciones[b])[0])[0].nombre:'';
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
        excelRows.push([data.nombre,fecha,data.tipo,data.hora]);
        excelSalarial.push({nombre:data.nombre,fecha:data.fecha,tipo:data.tipo,timestamp:data.timestamp});
        notif.innerHTML+=`<div class="notif">${data.nombre} marcó ${data.tipo} a las ${data.hora}</div>`;
      });
    });
  });
}

// 📊 EXPORTAR EXCEL – RESUMEN DE MARCACIONES
function exportExcelFiltro(){
  const fecha=document.getElementById("filterDate").value;
  const periodo=document.getElementById("periodoResumen").value;
  const rows=[["Nombre","Fecha","Tipo","Hora"]];

  for(const m of excelRows){
    const mFecha=m[1];
    if(periodo==="diario" && mFecha!==fecha) continue;
    if(periodo==="quincenal" && !mFecha.startsWith(fecha.substring(0,7))) continue;
    if(periodo==="mensual" && !mFecha.startsWith(fecha.substring(0,4)+"-"+fecha.substring(5,7))) continue;
    rows.push(m);
  }

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"Resumen");
  XLSX.writeFile(wb,"Poladent_Marcaciones_Filtro.xlsx");
}

// 📊 EXPORTAR EXCEL – SALARIO
function exportExcelSalarialFiltro(){
  const fecha=document.getElementById("filterDate").value;
  const periodo=document.getElementById("periodoResumen").value;
  const resumen={};

  for(const m of excelSalarial){
    const mFecha=m.fecha;
    if(periodo==="diario" && mFecha!==fecha) continue;
    if(periodo==="quincenal" && !mFecha.startsWith(fecha.substring(0,7))) continue;
    if(periodo==="mensual" && !mFecha.startsWith(fecha.substring(0,4)+"-"+fecha.substring(5,7))) continue;
    if(!resumen[m.nombre]) resumen[m.nombre]={dias:{}};
    if(!resumen[m.nombre].dias[mFecha]) resumen[m.nombre].dias[mFecha]={entrada:null,salida:null};
    if(m.tipo==="entrada") resumen[m.nombre].dias[mFecha].entrada=m.timestamp;
    if(m.tipo==="salida") resumen[m.nombre].dias[mFecha].salida=m.timestamp;
  }

  const wsData=[["Nombre","Fecha","Horas trabajadas","Horas extra","Banco de horas"]];
  for(const emp in resumen){
    let bancoTotal=0;
    for(const dia in resumen[emp].dias){
      const ent=resumen[emp].dias[dia].entrada;
      const sal=resumen[emp].dias[dia].salida;
      if(!ent||!sal) continue;
      let hrs=(sal-ent)/3600000;
      let extra=Math.max(0,hrs-8);
      let normales=Math.min(8,hrs);
      bancoTotal+=extra;
      wsData.push([emp,dia,normales.toFixed(2),extra.toFixed(2),bancoTotal.toFixed(2)]);
    }
  }

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(wsData),"Salario");
  XLSX.writeFile(wb,"Poladent_Salario_Filtro.xlsx");
}

// 📅 FILTRAR POR FECHA
function setDefaultDate(){
  const today=new Date();
  let month=today.getMonth()+1; if(month<10) month="0"+month;
  let day=today.getDate(); if(day<10) day="0"+day;
  const yyyy=today.getFullYear();
  document.getElementById("filterDate").value=`${yyyy}-${month}-${day}`;
}

function filterByDate(){
  renderAdminList(document.getElementById("filterDate").value);
  updateChart();
}

// 🔔 NOTIFICACIONES
function mostrarNotificacion(text){
  const notif=document.getElementById("notificaciones");
  const div=document.createElement("div");
  div.className="notif";
  div.innerText=text;
  notif.prepend(div);
}

// 📊 GRÁFICO HORAS
function renderChart(startDate='', endDate=''){
  const ctx=document.getElementById("horasChart").getContext("2d");
  const filtroInicio=startDate ? new Date(startDate) : null;
  const filtroFin=endDate ? new Date(endDate) : null;

  const resumenHoras={};
  for(const empID in allMarcaciones){
    const fechas=allMarcaciones[empID];
    for(const fecha in fechas){
      const fechaObj=new Date(fecha);
      if(filtroInicio && fechaObj<filtroInicio) continue;
      if(filtroFin && fechaObj>filtroFin) continue;
      const tipos=fechas[fecha];
      let entrada=null, salida=null;
      Object.values(tipos).forEach(m=>{
        if(m.tipo==='entrada') entrada=m.timestamp;
        if(m.tipo==='salida') salida=m.timestamp;
      });
      if(!entrada || !salida) continue;
      const nombre=Object.values(tipos)[0].nombre || 'Sin nombre';
      if(!resumenHoras[nombre]) resumenHoras[nombre]=0;
      resumenHoras[nombre]+=(salida-entrada)/3600000;
    }
  }

  const chartData={
    labels:Object.keys(resumenHoras),
    datasets:[{
      label:'Horas trabajadas',
      data:Object.values(resumenHoras),
      backgroundColor:'rgba(0,123,255,0.5)'
    }]
  };

  if(window.horasChartInstance) window.horasChartInstance.destroy();
  window.horasChartInstance=new Chart(ctx,{
    type:'bar',
    data:chartData,
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

// 🔽 ACTUALIZAR GRÁFICO
function updateChart(){
  const start=document.getElementById("chartStart").value;
  const end=document.getElementById("chartEnd").value;
  renderChart(start,end);
}

// 🌐 EXPONER AL HTML
window.loadMarcaciones = loadMarcaciones;
window.renderAdminList = renderAdminList;
window.exportExcelFiltro = exportExcelFiltro;
window.exportExcelSalarialFiltro = exportExcelSalarialFiltro;
window.setDefaultDate = setDefaultDate;
window.filterByDate = filterByDate;
window.mostrarNotificacion = mostrarNotificacion;
window.renderChart = renderChart;
window.updateChart = updateChart;
