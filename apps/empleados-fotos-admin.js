/* =========================================================
   POLADENT - Fotos de empleados desde Administrador
   Módulo seguro: NO reemplaza app.js ni Firebase config.
   Guarda fotos comprimidas en Firebase Realtime Database.
   Ruta usada: empleados/{id}/foto
   ========================================================= */
(function(){
  'use strict';

  const FOTO_MAX_SIZE = 420;
  const FOTO_QUALITY = 0.72;
  let empleadosCache = {};
  let observerStarted = false;

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function hasFirebase(){
    return window.firebase && firebase.apps && firebase.apps.length && firebase.database;
  }

  function safeText(el){ return (el && el.textContent ? el.textContent : '').trim(); }

  function normalize(str){
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  }

  function injectBaseStyles(){
    if(document.getElementById('poladentFotosStyles')) return;
    const style = document.createElement('style');
    style.id = 'poladentFotosStyles';
    style.textContent = `
      .pd-foto-box{display:flex;align-items:center;gap:12px;margin:10px 0;padding:12px;border:1px solid rgba(13,110,253,.14);background:linear-gradient(135deg,rgba(255,255,255,.9),rgba(235,247,255,.85));border-radius:18px;box-shadow:0 8px 22px rgba(16,42,67,.06)}
      .pd-foto-avatar{width:62px;height:62px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 6px 18px rgba(16,42,67,.18);background:#eaf4ff;flex:0 0 auto}
      .pd-foto-empty{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#eaf4ff,#f8fcff);border:2px dashed rgba(13,110,253,.28);color:#0a58ca;font-size:26px;box-shadow:0 6px 18px rgba(16,42,67,.08);flex:0 0 auto}
      .pd-foto-meta{flex:1;min-width:0}.pd-foto-meta b{display:block;color:#102a43;font-size:14px}.pd-foto-meta span{display:block;color:#5f7387;font-size:12px;margin-top:2px}
      .pd-foto-actions{display:flex;gap:8px;flex-wrap:wrap}.pd-foto-actions button{min-width:120px!important;width:auto!important;margin:0!important;padding:9px 12px!important;border-radius:12px!important;font-size:12px!important}
      .pd-foto-btn-del{background:linear-gradient(135deg,#ef4444,#b91c1c)!important;box-shadow:0 8px 18px rgba(185,28,28,.18)!important}
      #pdEmpleadoFotoBox{display:none;text-align:center;margin:8px auto 14px auto}.pd-emp-foto{width:112px;height:112px;border-radius:50%;object-fit:cover;border:5px solid #fff;box-shadow:0 12px 32px rgba(16,42,67,.18);background:#eaf4ff}.pd-emp-nofoto{width:112px;height:112px;border-radius:50%;display:inline-grid;place-items:center;background:linear-gradient(135deg,#eaf4ff,#fff);border:2px dashed rgba(13,110,253,.30);font-size:40px;color:#0d6efd;box-shadow:0 12px 32px rgba(16,42,67,.10)}
      @media(max-width:768px){.pd-foto-box{align-items:flex-start}.pd-foto-actions{width:100%}.pd-foto-actions button{flex:1;min-width:0!important}.pd-foto-avatar,.pd-foto-empty{width:56px;height:56px}.pd-emp-foto,.pd-emp-nofoto{width:96px;height:96px}}
    `;
    document.head.appendChild(style);
  }

  function waitFirebase(cb){
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if(hasFirebase()){
        clearInterval(timer);
        cb();
      } else if(tries > 80){
        clearInterval(timer);
        console.warn('Poladent fotos: Firebase no está disponible.');
      }
    }, 250);
  }

  function listenEmpleados(){
    firebase.database().ref('empleados').on('value', snap => {
      empleadosCache = snap.val() || {};
      setTimeout(augmentListaEmpleados, 150);
      updateEmployeePhotoFromPin();
    });
  }

  function findEmpleadoByPinOrName(pin, name){
    const pinN = String(pin || '').trim();
    const nameN = normalize(name);
    for(const [id, emp] of Object.entries(empleadosCache)){
      if(pinN && String(emp.pin || '').trim() === pinN) return {id, ...emp};
    }
    for(const [id, emp] of Object.entries(empleadosCache)){
      if(nameN && normalize(emp.nombre || emp.name || '') === nameN) return {id, ...emp};
    }
    return null;
  }

  function parseEmpleadoCard(card){
    const txt = safeText(card);
    let pin = '';
    const pinMatch = txt.match(/PIN\s*[:#-]?\s*([0-9A-Za-z]+)/i);
    if(pinMatch) pin = pinMatch[1];
    let name = '';
    const lines = txt.split('\n').map(s=>s.trim()).filter(Boolean);
    if(lines.length) name = lines[0].replace(/^(👤|Empleado|Nombre)\s*:?\s*/i,'').trim();
    return {pin, name};
  }

  function resizeImage(file){
    return new Promise((resolve, reject) => {
      if(!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Selecciona una imagen válida.'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let {width, height} = img;
          const scale = Math.min(1, FOTO_MAX_SIZE / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0,0,width,height);
          ctx.drawImage(img,0,0,width,height);
          resolve(canvas.toDataURL('image/jpeg', FOTO_QUALITY));
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('No se pudo abrir el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  async function seleccionarFoto(empId){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = async () => {
      try{
        const file = input.files && input.files[0];
        if(!file) return;
        const dataUrl = await resizeImage(file);
        await firebase.database().ref('empleados/' + empId).update({ foto: dataUrl, fotoActualizada: Date.now() });
        alert('Foto guardada correctamente.');
      }catch(err){
        alert(err.message || 'No se pudo guardar la foto.');
      }finally{
        input.remove();
      }
    };
    input.click();
  }

  async function eliminarFoto(empId){
    if(!confirm('¿Eliminar la foto de este empleado?')) return;
    await firebase.database().ref('empleados/' + empId + '/foto').remove();
  }

  function augmentListaEmpleados(){
    const cont = document.getElementById('listaEmpleados');
    if(!cont) return;
    const cards = cont.querySelectorAll('.empleado, div, p');
    cards.forEach(card => {
      if(card.dataset && card.dataset.fotosReady === '1') return;
      if(!safeText(card).match(/PIN/i)) return;
      if(card.closest && card.closest('.pd-foto-box')) return;
      const parsed = parseEmpleadoCard(card);
      const emp = findEmpleadoByPinOrName(parsed.pin, parsed.name);
      if(!emp || !emp.id) return;
      if(card.dataset) card.dataset.fotosReady = '1';

      const box = document.createElement('div');
      box.className = 'pd-foto-box';
      const avatarHtml = emp.foto
        ? `<img class="pd-foto-avatar" src="${emp.foto}" alt="Foto de ${emp.nombre || 'empleado'}">`
        : `<div class="pd-foto-empty">👤</div>`;
      box.innerHTML = `
        ${avatarHtml}
        <div class="pd-foto-meta"><b>Foto del empleado</b><span>${emp.foto ? 'Foto cargada en el sistema' : 'Sin foto asignada'}</span></div>
        <div class="pd-foto-actions">
          <button type="button" class="pd-foto-upload">📷 Subir foto</button>
          <button type="button" class="pd-foto-btn-del">🗑️ Quitar</button>
        </div>`;
      box.querySelector('.pd-foto-upload').addEventListener('click', () => seleccionarFoto(emp.id));
      box.querySelector('.pd-foto-btn-del').addEventListener('click', () => eliminarFoto(emp.id));
      card.appendChild(box);
    });
  }

  function startObserver(){
    if(observerStarted) return;
    observerStarted = true;
    const cont = document.getElementById('listaEmpleados');
    if(!cont) return;
    const obs = new MutationObserver(() => setTimeout(augmentListaEmpleados, 100));
    obs.observe(cont, {childList:true, subtree:true});
  }

  function ensureEmployeePhotoBox(){
    let box = document.getElementById('pdEmpleadoFotoBox');
    if(box) return box;
    const target = document.getElementById('empNombreGrande') || document.getElementById('empPin');
    if(!target || !target.parentNode) return null;
    box = document.createElement('div');
    box.id = 'pdEmpleadoFotoBox';
    target.parentNode.insertBefore(box, target);
    return box;
  }

  function updateEmployeePhotoFromPin(){
    const pinInput = document.getElementById('empPin');
    const box = ensureEmployeePhotoBox();
    if(!pinInput || !box) return;
    const pin = String(pinInput.value || '').trim();
    if(!pin){ box.style.display='none'; box.innerHTML=''; return; }
    const emp = findEmpleadoByPinOrName(pin, '');
    if(!emp){ box.style.display='none'; box.innerHTML=''; return; }
    box.style.display = 'block';
    box.innerHTML = emp.foto
      ? `<img class="pd-emp-foto" src="${emp.foto}" alt="Foto de ${emp.nombre || 'empleado'}">`
      : `<div class="pd-emp-nofoto">👤</div>`;
  }

  function bindEmpleadoPin(){
    const pinInput = document.getElementById('empPin');
    if(!pinInput || pinInput.dataset.fotosBind === '1') return;
    pinInput.dataset.fotosBind = '1';
    pinInput.addEventListener('input', updateEmployeePhotoFromPin);
    pinInput.addEventListener('change', updateEmployeePhotoFromPin);
    pinInput.addEventListener('keyup', updateEmployeePhotoFromPin);
  }

  ready(() => {
    injectBaseStyles();
    waitFirebase(() => {
      listenEmpleados();
      setInterval(() => { augmentListaEmpleados(); startObserver(); bindEmpleadoPin(); }, 1000);
    });
  });
})();
