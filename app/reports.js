let allMarcaciones={};

function loadMarcaciones(){
  db.ref("marcaciones").on("value",snap=>{
    allMarcaciones=snap.val()||{};
    renderAdminList(filterDate.value);
    updateChart();
  });
}

function setDefaultDate(){
  const t=new Date().toISOString().split('T')[0];
  filterDate.value=t;
}

function filterByDate(){
  renderAdminList(filterDate.value);
  updateChart();
}
