/* =========================================================
   POLADENT - Fotos de empleados
   Archivo adicional seguro: NO modifica Firebase config ni la lógica base.
   Guarda una foto comprimida en: empleados/{id}/foto
   ========================================================= */
(function(){
  "use strict";

  const FOTO_MAX_W = 420;
  const FOTO_MAX_H = 420;
  const FOTO_QUALITY = 0.78;

  function $(id){ return document.getElementById(id); }
  function safe(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function placeholder(nombre){
    const ini = (nombre || 'P').trim().charAt(0).toUpperCase() || 'P';
    return `<div class="empAvatarPlaceholder">${safe(ini)}</div>`;
  }
  function fotoHtml(data, sizeClass=''){
    if (data && data.foto) return `<img class="empFotoAvatar ${sizeClass}" src="${data.foto}" alt="Foto de ${safe(data.nombre || 'empleado')}" />`;
    return placeholder(data?.nombre || 'P');
  }

  function comprimirImagen(file){
    return new Promise((resolve, reject)=>{
      if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Selecciona una imagen válida.'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const ratio = Math.min(FOTO_MAX_W / w, FOTO_MAX_H / h, 1);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', FOTO_QUALITY));
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('No se pudo cargar el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  window.subirFotoEmpleado = async function(empId, input){
    try{
      const file = input.files && input.files[0];
      if (!file) return;
      const dataUrl = await comprimirImagen(file);
      await db.ref('empleados/' + empId).update({ foto: dataUrl, fotoActualizada: Date.now() });
      alert('✅ Foto guardada correctamente.');
      if (typeof loadEmpleados === 'function') loadEmpleados();
    }catch(e){
      alert('❌ ' + (e.message || e));
    }finally{
      input.value = '';
    }
  };

  window.eliminarFotoEmpleado = async function(empId){
    if (!confirm('¿Eliminar la foto de este empleado?')) return;
    await db.ref('empleados/' + empId).update({ foto: null, fotoActualizada: Date.now() });
    if (typeof loadEmpleados === 'function') loadEmpleados();
  };

  function renderEmpleadosConFotos(){
    const cont = $('listaEmpleados');
    if (!cont || !window.db) return;
    db.ref('empleados').on('value', (snap)=>{
      cont.innerHTML = '';
      snap.forEach((emp)=>{
        const data = emp.val() || {};
        const salarioTxt = (typeof formatUSD === 'function')
          ? `${formatUSD(data.salario)} (${data.tipoSalario || 'diario'})`
          : `${data.salario || 0} (${data.tipoSalario || 'diario'})`;
        cont.innerHTML += `
          <div class="empleado empleadoFotoCard">
            <div class="empFotoHead">
              <div class="empFotoBox">${fotoHtml(data)}</div>
              <div class="empFotoInfo">
                <b>${safe(data.nombre || 'Sin nombre')}</b>
                <span>PIN: ${safe(data.pin || '')}</span>
                <span>Salario: ${safe(salarioTxt)}</span>
              </div>
            </div>

            <div class="empActions empActionsFoto">
              <label class="btnFotoUpload">
                📷 Foto
                <input type="file" accept="image/*" capture="environment" onchange="subirFotoEmpleado('${emp.key}', this)">
              </label>
              <button type="button" onclick="eliminarFotoEmpleado('${emp.key}')" class="btnFotoRemove">Quitar foto</button>
              <button type="button" onclick="borrarEmpleado('${emp.key}')" class="danger">Borrar</button>
              <button type="button" onclick="asignarSalario('${emp.key}')">Asignar salario</button>
              <button type="button" onclick="openEditModal('${emp.key}')">Editar horario</button>
              <button type="button" onclick="generarReciboDetalladoPorId('${emp.key}', '${safe(data.nombre || 'Empleado')}')">Recibo PDF</button>
            </div>
          </div>`;
      });
      try { cargarEmpleadosParaModal().then(()=>{ renderListaLibresEmpleado(); }); } catch(e) {}
    });
  }

  function asegurarFotoEmpleadoPanel(){
    const panel = $('employeePanel');
    const nombre = $('empNombreGrande');
    if (!panel || !nombre || $('empFotoMarcacion')) return;
    const wrap = document.createElement('div');
    wrap.id = 'empFotoMarcacion';
    wrap.className = 'empFotoMarcacion hidden';
    wrap.innerHTML = `<div id="empFotoMarcacionImg" class="empFotoMarcacionImg"></div>`;
    nombre.parentNode.insertBefore(wrap, nombre);
  }

  function buscarEmpleadoPorPinYFoto(){
    const pinEl = $('empPin');
    const fotoWrap = $('empFotoMarcacion');
    const fotoImg = $('empFotoMarcacionImg');
    if (!pinEl || !fotoWrap || !fotoImg || !window.db) return;
    const pin = pinEl.value.trim();
    if (!pin){
      fotoWrap.classList.add('hidden');
      fotoImg.innerHTML = '';
      return;
    }
    db.ref('empleados').orderByChild('pin').equalTo(pin).once('value', (snap)=>{
      if (!snap.exists()){
        fotoWrap.classList.add('hidden');
        fotoImg.innerHTML = '';
        return;
      }
      snap.forEach((empSnap)=>{
        const data = empSnap.val() || {};
        fotoImg.innerHTML = data.foto
          ? `<img src="${data.foto}" alt="Foto de ${safe(data.nombre || 'empleado')}">`
          : placeholder(data.nombre || 'P');
        fotoWrap.classList.remove('hidden');
      });
    });
  }

  function activarFotos(){
    asegurarFotoEmpleadoPanel();

    // Sobrescribe solo el render visual de empleados; las funciones originales quedan intactas.
    window.cargarEmpleados = renderEmpleadosConFotos;
    window.loadEmpleados = renderEmpleadosConFotos;
    renderEmpleadosConFotos();

    const pinEl = $('empPin');
    if (pinEl && !pinEl.dataset.fotosEmpleado){
      pinEl.addEventListener('input', buscarEmpleadoPorPinYFoto);
      pinEl.dataset.fotosEmpleado = '1';
    }

    // Limpieza al volver al inicio sin tocar la lógica original.
    const oldBackHome = window.backHome;
    if (typeof oldBackHome === 'function' && !window.backHome.__fotoWrap){
      window.backHome = function(){
        oldBackHome();
        const fotoWrap = $('empFotoMarcacion');
        const fotoImg = $('empFotoMarcacionImg');
        if (fotoWrap) fotoWrap.classList.add('hidden');
        if (fotoImg) fotoImg.innerHTML = '';
      };
      window.backHome.__fotoWrap = true;
    }
  }

  window.addEventListener('load', ()=> setTimeout(activarFotos, 500));
})();
