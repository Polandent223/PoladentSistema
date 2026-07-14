/* POLADENT SISTEMA - Módulos comerciales consolidados. */
/* Mantiene las rutas de Firebase existentes; no elimina historial. */

/* ---- módulo integrado ---- */
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
    window.PoladentData.subscribe('empleados', snap => {
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

/* POLADENT V4 - Botón Empleado abre vista rápida liviana */
(function(){
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function(){
    var btn = document.getElementById('btnEmployee');
    if(!btn || btn.dataset.v4Fast === '1') return;
    btn.dataset.v4Fast = '1';
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = 'empleado.html';
    }, true);
  });
})();

/* =========================================================
   POLADENT V4.1 - Panel directo para fotos desde administrador
   No reemplaza app.js. Usa la ruta empleados/{id}/foto.
   ========================================================= */
(function(){
  'use strict';
  const MAX_SIZE = 520;
  const QUALITY = 0.74;
  let empleados = {};

  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }
  function hasFirebase(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.database; }
  function $(id){ return document.getElementById(id); }
  function status(text, type){ const el=$('pdFotoStatus'); if(!el) return; el.style.display='block'; el.textContent=text; el.style.borderColor = type==='ok' ? 'rgba(34,197,94,.35)' : type==='error' ? 'rgba(239,68,68,.35)' : 'rgba(13,110,253,.18)'; el.style.background = type==='ok' ? 'rgba(34,197,94,.10)' : type==='error' ? 'rgba(239,68,68,.10)' : 'rgba(13,110,253,.08)'; }
  function selectedId(){ return $('pdFotoEmpSelect') ? $('pdFotoEmpSelect').value : ''; }

  function injectStyles(){
    if(document.getElementById('pdFotoAdminStyles')) return;
    const st=document.createElement('style');
    st.id='pdFotoAdminStyles';
    st.textContent=`
      .pd-photo-admin-card{position:relative;overflow:hidden;border:1px solid rgba(13,110,253,.16)!important;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(232,246,255,.88))!important}
      .pd-photo-admin-card:before{content:"";position:absolute;right:-70px;top:-70px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(13,110,253,.16),transparent 70%);pointer-events:none}
      .pd-photo-admin-preview{display:flex;align-items:center;gap:14px;margin:12px 0;padding:14px;border-radius:18px;background:rgba(255,255,255,.78);border:1px solid rgba(16,42,67,.10);box-shadow:0 10px 25px rgba(16,42,67,.07);font-weight:700;color:#102a43}
      .pd-photo-admin-preview img{width:86px;height:86px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 10px 25px rgba(16,42,67,.18);background:#eef6ff}
      .pd-photo-admin-empty{width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#eaf4ff,#fff);border:2px dashed rgba(13,110,253,.35);font-size:34px;color:#0d6efd;flex:0 0 auto}
      @media(max-width:768px){.pd-photo-admin-preview{align-items:flex-start}.pd-photo-admin-preview img,.pd-photo-admin-empty{width:72px;height:72px}.pd-photo-admin-card button{width:100%!important}}
    `;
    document.head.appendChild(st);
  }

  function waitFirebase(cb){
    let tries=0;
    const t=setInterval(()=>{
      tries++;
      if(hasFirebase()){ clearInterval(t); cb(); }
      if(tries>80){ clearInterval(t); status('No se pudo conectar con Firebase. Revisa internet o config.js.','error'); }
    },250);
  }

  function renderSelect(){
    const sel=$('pdFotoEmpSelect'); if(!sel) return;
    const old=sel.value;
    const rows=Object.entries(empleados).sort((a,b)=>String((a[1]||{}).nombre||'').localeCompare(String((b[1]||{}).nombre||''),'es'));
    sel.innerHTML='<option value="">Seleccionar empleado...</option>' + rows.map(([id,e])=>`<option value="${id}">${escapeHtml(e.nombre || 'Empleado sin nombre')} ${e.pin ? '· PIN '+escapeHtml(e.pin) : ''}</option>`).join('');
    if(old && empleados[old]) sel.value=old;
    renderPreview();
  }

  function escapeHtml(v){ return String(v||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function renderPreview(){
    const box=$('pdFotoAdminPreview'); if(!box) return;
    const id=selectedId();
    const emp=id ? empleados[id] : null;
    if(!emp){ box.innerHTML='<div class="pd-photo-admin-empty">👤</div><div>Selecciona un empleado para ver o cargar su foto.</div>'; return; }
    const foto = emp.foto || emp.photo || '';
    box.innerHTML = (foto ? `<img src="${foto}" alt="Foto de ${escapeHtml(emp.nombre||'empleado')}">` : '<div class="pd-photo-admin-empty">👤</div>') +
      `<div><div style="font-size:16px;">${escapeHtml(emp.nombre||'Empleado')}</div><div style="font-size:12px;opacity:.68;margin-top:4px;">${foto ? 'Foto cargada correctamente' : 'Sin foto asignada'}${emp.pin ? ' · PIN '+escapeHtml(emp.pin) : ''}</div></div>`;
  }

  function resize(file){
    return new Promise((resolve,reject)=>{
      if(!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Selecciona una imagen válida.'));
      const reader=new FileReader();
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          let w=img.width,h=img.height;
          const scale=Math.min(1, MAX_SIZE/Math.max(w,h));
          w=Math.round(w*scale); h=Math.round(h*scale);
          const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
          const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.onerror=()=>reject(new Error('No se pudo leer la imagen.'));
        img.src=reader.result;
      };
      reader.onerror=()=>reject(new Error('No se pudo abrir la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  function bind(){
    const sel=$('pdFotoEmpSelect'), upload=$('pdFotoUploadBtn'), remove=$('pdFotoRemoveBtn'), file=$('pdFotoFileInput');
    if(!sel || !upload || !remove || !file) return;
    sel.addEventListener('change', renderPreview);
    upload.addEventListener('click', ()=>{
      if(!selectedId()){ status('Primero selecciona un empleado.','error'); return; }
      file.value=''; file.click();
    });
    file.addEventListener('change', async()=>{
      const id=selectedId(); if(!id) return;
      const f=file.files && file.files[0]; if(!f) return;
      try{
        status('Comprimiendo y guardando foto...');
        const dataUrl=await resize(f);
        await firebase.database().ref('empleados/'+id).update({foto:dataUrl, fotoActualizada:Date.now()});
        status('Foto guardada correctamente.','ok');
      }catch(e){ status(e.message || 'No se pudo guardar la foto.','error'); }
    });
    remove.addEventListener('click', async()=>{
      const id=selectedId(); if(!id){ status('Primero selecciona un empleado.','error'); return; }
      if(!confirm('¿Quitar la foto de este empleado?')) return;
      try{ await firebase.database().ref('empleados/'+id+'/foto').remove(); status('Foto eliminada.','ok'); }
      catch(e){ status('No se pudo eliminar la foto.','error'); }
    });
  }

  ready(()=>{
    if(!$('pdFotoEmpSelect')) return;
    injectStyles(); bind();
    waitFirebase(()=>{
      window.PoladentData.subscribe('empleados', snap=>{ empleados=snap.val()||{}; renderSelect(); });
    });
  });
})();


/* =========================================================
   POLADENT V5 - Panel directo para subir fotos desde administrador
   Usa los mismos datos: empleados/{id}/foto
   ========================================================= */
(function(){
  'use strict';
  const MAX_SIZE = 520;
  const QUALITY = 0.76;
  let cache = {};
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function dbReady(){ return window.firebase && firebase.apps && firebase.apps.length && firebase.database; }
  function $(id){ return document.getElementById(id); }
  function status(msg, ok=true){ const el=$('pdFotoStatus'); if(!el) return; el.style.display='block'; el.textContent=msg; el.style.background=ok?'#eef8ff':'#fff0f0'; }
  function resize(file){
    return new Promise((resolve,reject)=>{
      if(!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Selecciona una imagen válida.'));
      const r=new FileReader();
      r.onload=()=>{ const img=new Image(); img.onload=()=>{
        let w=img.width,h=img.height; const s=Math.min(1, MAX_SIZE/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s);
        const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(img,0,0,w,h); resolve(c.toDataURL('image/jpeg',QUALITY));
      }; img.onerror=()=>reject(new Error('No se pudo leer la imagen.')); img.src=r.result; };
      r.onerror=()=>reject(new Error('No se pudo abrir la imagen.')); r.readAsDataURL(file);
    });
  }
  function renderSelect(){
    const sel=$('pdFotoEmpSelect'); if(!sel) return;
    const current=sel.value;
    const opts=['<option value="">Selecciona un empleado...</option>'];
    Object.entries(cache).sort((a,b)=>String(a[1].nombre||'').localeCompare(String(b[1].nombre||''))).forEach(([id,e])=>{
      opts.push(`<option value="${id}">${e.nombre || e.name || 'Empleado'}${e.foto?' · foto cargada':''}</option>`);
    });
    sel.innerHTML=opts.join(''); if(current && cache[current]) sel.value=current;
    renderPreview();
  }
  function renderPreview(){
    const sel=$('pdFotoEmpSelect'), box=$('pdFotoAdminPreview'); if(!sel||!box) return;
    const emp=cache[sel.value];
    if(!emp){ box.innerHTML='<div class="pd-photo-admin-empty">👤</div><div>Selecciona un empleado para ver o cargar su foto.</div>'; return; }
    box.innerHTML=(emp.foto?`<img src="${emp.foto}" alt="Foto de ${emp.nombre||'empleado'}">`:'<div class="pd-photo-admin-empty">👤</div>')+
      `<div><b>${emp.nombre||emp.name||'Empleado'}</b><br><span>${emp.foto?'Foto cargada en el sistema':'Sin foto asignada'}</span></div>`;
  }
  function init(){
    let tries=0; const t=setInterval(()=>{ tries++; if(dbReady()){ clearInterval(t); start(); } if(tries>80) clearInterval(t); },250);
  }
  function start(){
    window.PoladentData.subscribe('empleados',snap=>{ cache=snap.val()||{}; renderSelect(); });
    const sel=$('pdFotoEmpSelect'), upload=$('pdFotoUploadBtn'), remove=$('pdFotoRemoveBtn'), input=$('pdFotoFileInput');
    if(sel) sel.addEventListener('change', renderPreview);
    if(upload && input) upload.addEventListener('click',()=>{ if(!sel || !sel.value) return status('Primero selecciona un empleado.',false); input.click(); });
    if(input) input.addEventListener('change',async()=>{
      try{ const id=sel.value; const f=input.files && input.files[0]; if(!id) return status('Selecciona un empleado.',false); if(!f) return;
        status('Procesando foto...'); const data=await resize(f); await firebase.database().ref('empleados/'+id).update({foto:data,fotoActualizada:Date.now()}); status('Foto guardada correctamente.'); input.value=''; }
      catch(e){ status(e.message||'No se pudo guardar la foto.',false); }
    });
    if(remove) remove.addEventListener('click',async()=>{ const id=sel && sel.value; if(!id) return status('Selecciona un empleado.',false); if(!confirm('¿Quitar la foto de este empleado?')) return; await firebase.database().ref('empleados/'+id+'/foto').remove(); status('Foto eliminada.'); });
  }
  ready(init);
})();

