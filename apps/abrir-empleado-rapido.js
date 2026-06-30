/* POLADENT - Entrada rápida para empleados
   No toca app.js ni Firebase. Solo cambia el botón Empleado para abrir empleado.html */
(function(){
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function(){
    var btn = document.getElementById('btnEmployee');
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = 'empleado.html';
    }, true);
  });
})();
