function hideAll(){
  home.classList.add("hidden");
  adminLogin.classList.add("hidden");
  adminPanel.classList.add("hidden");
  employeePanel.classList.add("hidden");
}

function backHome(){
  hideAll();
  home.classList.remove("hidden");
  document.getElementById("empNombreGrande").innerHTML="";
  document.getElementById("empPin").value="";
  document.getElementById("employeeButtons").classList.add("hidden");
  document.getElementById("empMsg").innerHTML="";
}

function goAdmin(){ hideAll(); adminLogin.classList.remove("hidden"); }
function goEmployee(){ hideAll(); employeePanel.classList.remove("hidden"); }

function toggleSection(id){
  const el = document.getElementById(id);
  const header = el.previousElementSibling;
  if(el.style.display === 'none'){
    el.style.display = 'block';
    header.innerHTML = header.innerHTML.replace('▲','▼');
  } else {
    el.style.display = 'none';
    header.innerHTML = header.innerHTML.replace('▼','▲');
  }
}

backHome();
