/* Recuperación visible de inicio. No toca Firebase. */
(function(){
  'use strict';
  function showHomeIfBlank(){
    const home=document.getElementById('home');
    const login=document.getElementById('adminLogin');
    const admin=document.getElementById('adminPanel');
    const employee=document.getElementById('employeePanel');
    if(!home) return;
    const visible=[home,login,admin,employee].some(el=>el && !el.classList.contains('hidden') && getComputedStyle(el).display!=='none');
    if(!visible) home.classList.remove('hidden');
  }
  window.addEventListener('error',e=>{
    console.error('[Poladent inicio]',e.error||e.message);
    showHomeIfBlank();
  });
  window.addEventListener('unhandledrejection',e=>{
    console.error('[Poladent promesa]',e.reason);
    showHomeIfBlank();
  });
  document.addEventListener('DOMContentLoaded',()=>{
    showHomeIfBlank();
    setTimeout(showHomeIfBlank,1800);
  });
})();
