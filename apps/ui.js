function hideAll(){
  document.getElementById("home").classList.add("hidden");
  document.getElementById("adminLogin").classList.add("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("employeePanel").classList.add("hidden");
}

function backHome(){
  hideAll();
  document.getElementById("home").classList.remove("hidden");
  document.getElementById("empNombreGrande").innerHTML="";
  document.getElementById("empPin").value="";
  document.getElementById("employeeButtons").classList.add("hidden");
  document.getElementById("empMsg").innerHTML="";
}

function goAdmin(){
  hideAll();
  document.getElementById("adminLogin").classList.remove("hidden");
}

function goEmployee(){
  hideAll();
  document.getElementById("employeePanel").classList.remove("hidden");
}

function toggleSection(id){
  const el = document.getElementById(id);
  if(el.style.display === 'none'){
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

window.onload = backHome;
