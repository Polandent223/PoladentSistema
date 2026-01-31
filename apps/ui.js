document.addEventListener("DOMContentLoaded", () => {

  function hideAll(){
    document.getElementById("home").classList.add("hidden");
    document.getElementById("adminLogin").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    document.getElementById("employeePanel").classList.add("hidden");
  }

  window.backHome = function(){
    hideAll();
    document.getElementById("home").classList.remove("hidden");
    document.getElementById("empNombreGrande").innerHTML="";
    document.getElementById("empPin").value="";
    document.getElementById("employeeButtons").classList.add("hidden");
    document.getElementById("empMsg").innerHTML="";
  }

  window.goAdmin = function(){
    hideAll();
    document.getElementById("adminLogin").classList.remove("hidden");
  }

  window.goEmployee = function(){
    hideAll();
    document.getElementById("employeePanel").classList.remove("hidden");
  }

  window.toggleSection = function(id){
    const el = document.getElementById(id);
    el.style.display = (el.style.display === "none") ? "block" : "none";
  }

  // 👇 ESTA ES LA CLAVE QUE FALTABA
  backHome();
});
