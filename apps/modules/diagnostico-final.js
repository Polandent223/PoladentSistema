/* ---- módulo integrado ---- */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const state = { mounted:false };

  function cleanCommercialLabels(){
    const rx = /\b(?:v(?:ersi[oó]n)?\s*\d+(?:\.\d+)*|fase\s*\d+(?:\.\d+)*|etapa\s*\d+(?:\.\d+)*|enterprise|premium|control\s*pro|gps\s*editable)\b/ig;
    $$('h1,h2,h3,h4,h5,.systemBadge,.miniLabel,.eyebrow,button,a,option').forEach(el=>{
      if(el.children.length) return;
      const before = el.textContent || '';
      const after = before.replace(rx,'').replace(/\s{2,}/g,' ').trim();
      if(after && after !== before) el.textContent = after;
    });
    document.title = 'Poladent · Control de asistencia';
  }

  function status(label, ok, detail=''){
    const cls = ok === true ? 'pf-ok' : ok === false ? 'pf-bad' : 'pf-warn';
    const text = ok === true ? 'Correcto' : ok === false ? 'Revisar' : 'Pendiente';
    return `<div class="pf-health-item"><div><b>${label}</b>${detail?`<div style="font-size:.76rem;opacity:.66;margin-top:3px">${detail}</div>`:''}</div><span class="pf-health-status ${cls}">${text}</span></div>`;
  }

  async function runDiagnostic(){
    const grid = $('#pfHealthGrid'); if(!grid) return;
    grid.innerHTML = status('Internet', navigator.onLine, navigator.onLine?'Con conexión':'Sin conexión');
    const secure = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
    const firebaseReady = !!(window.firebase && firebase.apps && firebase.apps.length && typeof firebase.database === 'function');
    const gpsAvailable = !!navigator.geolocation;
    const cameraAvailable = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const storageAvailable = (()=>{try{localStorage.setItem('__pf_test','1');localStorage.removeItem('__pf_test');return true}catch{return false}})();
    const items = [
      status('Firebase', firebaseReady, firebaseReady?'Aplicación inicializada':'No se detectó conexión'),
      status('Conexión segura', secure, secure?'HTTPS activo':'Abre desde GitHub Pages'),
      status('GPS', gpsAvailable, gpsAvailable?'Disponible en este equipo':'No disponible'),
      status('Cámara', cameraAvailable, cameraAvailable?'Disponible en este equipo':'No disponible'),
      status('Almacenamiento local', storageAvailable, storageAvailable?'Disponible':'Bloqueado por navegador')
    ];
    grid.insertAdjacentHTML('beforeend', items.join(''));
    const stamp = new Date().toLocaleString('es-VE',{dateStyle:'medium',timeStyle:'short'});
    $('#pfDiagTime').textContent = `Última revisión: ${stamp}`;
  }

  function mountDiagnostic(){
    if(state.mounted || $('#pfDiagnostic')) return;
    const panel = $('#adminPanel'); if(!panel) return;
    const anchor = $('.dashboardHero', panel) || panel.firstElementChild;
    const section = document.createElement('section');
    section.id='pfDiagnostic'; section.className='pf-diagnostic';
    section.innerHTML = `<div class="pf-diagnostic-head"><div><h3>🩺 Diagnóstico del sistema</h3><p id="pfDiagTime">Comprueba los servicios esenciales de esta instalación.</p></div><div class="pf-diagnostic-actions"><button type="button" id="pfRunDiag">Actualizar diagnóstico</button><button type="button" id="pfToggleCompact">Vista compacta</button></div></div><div id="pfHealthGrid" class="pf-health-grid"></div>`;
    anchor.insertAdjacentElement('afterend', section);
    $('#pfRunDiag').addEventListener('click',runDiagnostic);
    $('#pfToggleCompact').addEventListener('click',()=>{
      document.body.classList.toggle('pf-compact');
      try{localStorage.setItem('poladent_vista_compacta',document.body.classList.contains('pf-compact')?'1':'0')}catch{}
    });
    try{if(localStorage.getItem('poladent_vista_compacta')==='1')document.body.classList.add('pf-compact')}catch{}
    state.mounted=true; runDiagnostic();
  }

  function preventEmptyPanels(){
    $$('.pc-view,.pc-module-group').forEach(el=>{
      const visibleText=(el.textContent||'').trim();
      if(!visibleText && !el.querySelector('input,select,button,canvas,img')) el.hidden=true;
    });
  }

  function finalPass(){ cleanCommercialLabels(); mountDiagnostic(); preventEmptyPanels(); }
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(finalPass,150);setTimeout(finalPass,1200)});
  window.addEventListener('online',runDiagnostic);
  window.addEventListener('offline',runDiagnostic);
})();
