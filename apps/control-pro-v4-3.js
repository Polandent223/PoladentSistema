/* =========================================================
   POLADENT SISTEMA v4.3 CONTROL PRO
   Dashboard real + atrasos + ausentes + exportación Control Pro.
   Seguro: solo lee empleados/marcaciones. No modifica datos existentes.
   ========================================================= */
(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const START_KEY = 'poladent_v43_hora_entrada';
  const GRACE_KEY = 'poladent_v43_tolerancia_min';
  const DEFAULT_START = '08:00';
  const DEFAULT_GRACE = '0';
  let empleados = {};
  let marcaciones = {};
  let lastRows = [];

  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }
  function today(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function minFromTime(h){ if(!h) return null; const m=String(h).match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]*60 + +m[2]) : null; }
  function timeFromStamp(ts, fallback){
    if(fallback && /\d{1,2}:\d{2}/.test(String(fallback))) return String(fallback).slice(0,5);
    if(!ts) return '';
    const d = new Date(ts);
    if(Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function hoursBetween(a,b){ if(!a || !b) return 0; const x=new Date(a).getTime(), y=new Date(b).getTime(); return (!Number.isNaN(x)&&!Number.isNaN(y)&&y>x) ? (y-x)/3600000 : 0; }
  function normTipo(t){ return String(t||'').toLowerCase().replace(/\s+/g,'_'); }
  function getFechaActiva(){ return $('#pd43Fecha')?.value || $('#filterDate')?.value || today(); }
  function getStart(){ return localStorage.getItem(START_KEY) || DEFAULT_START; }
  function getGrace(){ return +(localStorage.getItem(GRACE_KEY) || DEFAULT_GRACE) || 0; }

  function employeeName(id){ return empleados[id]?.nombre || 'Sin nombre'; }
  function dayData(empId, fecha){ return ((marcaciones[empId]||{})[fecha]) || {}; }
  function collectDay(fecha){
    const startMin = minFromTime(getStart()) + getGrace();
    const rows = [];
    let presentes=0, ausentes=0, tardes=0, horas=0;
    Object.keys(empleados).sort((a,b)=>employeeName(a).localeCompare(employeeName(b))).forEach(empId=>{
      const tipos = dayData(empId, fecha);
      let entrada=null, salida=null, almuerzoSalida=null, almuerzoRegreso=null;
      Object.keys(tipos||{}).forEach(k=>{
        const data = tipos[k] || {};
        const tipo = normTipo(data.tipo || k);
        if(tipo === 'entrada') entrada = data;
        if(tipo === 'salida') salida = data;
        if(tipo === 'almuerzo_salida') almuerzoSalida = data;
        if(tipo === 'almuerzo_regreso') almuerzoRegreso = data;
      });
      const entradaHora = entrada ? timeFromStamp(entrada.timestamp, entrada.hora) : '';
      const entradaMin = minFromTime(entradaHora);
      const lateMin = entradaMin == null ? 0 : Math.max(0, entradaMin - startMin);
      const estado = !entrada ? 'Ausente' : lateMin > 0 ? 'Tarde' : 'Presente';
      const bruto = hoursBetween(entrada?.timestamp, salida?.timestamp);
      const almuerzo = hoursBetween(almuerzoSalida?.timestamp, almuerzoRegreso?.timestamp);
      const total = Math.max(0, bruto - almuerzo);
      if(entrada) presentes++; else ausentes++;
      if(lateMin > 0) tardes++;
      horas += total;
      rows.push({empId,nombre:employeeName(empId),fecha,estado,entrada:entradaHora||'—',salida:salida?timeFromStamp(salida.timestamp,salida.hora):'—',tardeMin:lateMin,horas:total});
    });
    return {fecha, rows, presentes, ausentes, tardes, horas};
  }

  function ensureUI(){
    const dashboard = $('#pd42-dashboard');
    const asistencia = $('#pd42-asistencia');
    const reportes = $('#pd42-reportes');
    if(!dashboard || dashboard.dataset.pd43Ready) return false;
    dashboard.dataset.pd43Ready = '1';

    const panel = document.createElement('section');
    panel.className = 'pd43-panel';
    panel.innerHTML = `
      <div class="pd43-head">
        <div><h3>🚀 Control Pro v4.3</h3><p>Resumen real del día: presentes, ausentes, atrasos y horas trabajadas.</p></div>
        <span class="pd43-badge">Sin cambiar Firebase</span>
      </div>
      <div class="pd43-tools">
        <label>Fecha <input type="date" id="pd43Fecha"></label>
        <label>Hora entrada <input type="time" id="pd43HoraEntrada"></label>
        <label>Tolerancia <select id="pd43Tolerancia"><option value="0">0 min</option><option value="5">5 min</option><option value="10">10 min</option><option value="15">15 min</option></select></label>
        <button type="button" id="pd43Actualizar">Actualizar</button>
        <button type="button" class="secondary" id="pd43Exportar">Exportar Control Pro</button>
      </div>
      <div class="pd43-grid">
        <div class="pd43-stat"><span>Empleados</span><strong id="pd43TotalEmp">0</strong><small>registrados</small></div>
        <div class="pd43-stat ok"><span>Presentes hoy</span><strong id="pd43Presentes">0</strong><small>con entrada</small></div>
        <div class="pd43-stat absent"><span>Ausentes</span><strong id="pd43Ausentes">0</strong><small>sin entrada</small></div>
        <div class="pd43-stat late"><span>Atrasos</span><strong id="pd43Tardes">0</strong><small>después de la hora</small></div>
        <div class="pd43-stat"><span>Horas</span><strong id="pd43Horas">0.0</strong><small>trabajadas</small></div>
      </div>
      <div class="pd43-note">Consejo: puedes cambiar la hora de entrada y tolerancia. Se guarda solo en este dispositivo.</div>
    `;
    const firstToolbar = dashboard.querySelector('.pd42-quick-actions');
    dashboard.insertBefore(panel, firstToolbar ? firstToolbar.nextSibling : dashboard.children[1] || null);

    const control = document.createElement('section');
    control.className = 'pd43-panel';
    control.innerHTML = `
      <div class="pd43-head"><div><h3>⏱️ Atrasos y ausentes</h3><p>Lista automática por empleado para la fecha seleccionada.</p></div><span class="pd43-badge">v4.3</span></div>
      <div class="pd43-tableWrap"><table class="pd43-table"><thead><tr><th>Empleado</th><th>Estado</th><th>Entrada</th><th>Salida</th><th>Atraso</th><th>Horas</th></tr></thead><tbody id="pd43Table"><tr><td colspan="6" class="pd43-empty">Cargando datos...</td></tr></tbody></table></div>
    `;
    if(asistencia) asistencia.insertBefore(control, asistencia.children[1] || null);

    const report = document.createElement('section');
    report.className = 'pd43-panel';
    report.innerHTML = `
      <div class="pd43-head"><div><h3>📤 Reporte Control Pro</h3><p>Exportación más clara para revisión diaria, quincenal o mensual.</p></div><span class="pd43-badge">Excel</span></div>
      <div class="pd43-split">
        <div class="pd43-list" id="pd43ResumenLista"></div>
        <div><button type="button" class="pd43-btn" id="pd43Exportar2">📥 Descargar reporte del día</button><p class="pd43-note">Incluye estado, entrada, salida, minutos de atraso y horas trabajadas.</p></div>
      </div>
    `;
    if(reportes) reportes.insertBefore(report, reportes.children[1] || null);

    $('#pd43Fecha').value = $('#filterDate')?.value || today();
    $('#pd43HoraEntrada').value = getStart();
    $('#pd43Tolerancia').value = String(getGrace());
    $('#pd43Actualizar').onclick = syncControlsAndRender;
    $('#pd43Exportar').onclick = exportControlPro;
    $('#pd43Exportar2').onclick = exportControlPro;
    $('#pd43HoraEntrada').addEventListener('change', syncControlsAndRender);
    $('#pd43Tolerancia').addEventListener('change', syncControlsAndRender);
    $('#pd43Fecha').addEventListener('change', ()=>{ if($('#filterDate')) $('#filterDate').value=$('#pd43Fecha').value; render(); });
    $('#filterDate')?.addEventListener('change', ()=>{ if($('#pd43Fecha')) $('#pd43Fecha').value=$('#filterDate').value || today(); render(); });
    return true;
  }

  function syncControlsAndRender(){
    const h = $('#pd43HoraEntrada')?.value || DEFAULT_START;
    const g = $('#pd43Tolerancia')?.value || DEFAULT_GRACE;
    localStorage.setItem(START_KEY, h);
    localStorage.setItem(GRACE_KEY, g);
    render();
  }

  function render(){
    if(!ensureUI()) return;
    const data = collectDay(getFechaActiva());
    lastRows = data.rows;
    $('#pd43TotalEmp').textContent = Object.keys(empleados).length;
    $('#pd43Presentes').textContent = data.presentes;
    $('#pd43Ausentes').textContent = data.ausentes;
    $('#pd43Tardes').textContent = data.tardes;
    $('#pd43Horas').textContent = data.horas.toFixed(1);
    const tbody = $('#pd43Table');
    if(tbody){
      tbody.innerHTML = data.rows.length ? data.rows.map(r=>{
        const cls = r.estado === 'Presente' ? 'ok' : r.estado === 'Tarde' ? 'warn' : 'bad';
        return `<tr><td><b>${escapeHtml(r.nombre)}</b></td><td><span class="pd43-pill ${cls}">${r.estado}</span></td><td>${r.entrada}</td><td>${r.salida}</td><td>${r.tardeMin ? r.tardeMin+' min' : '—'}</td><td>${r.horas.toFixed(2)}</td></tr>`;
      }).join('') : '<tr><td colspan="6" class="pd43-empty">No hay empleados registrados.</td></tr>';
    }
    const lista = $('#pd43ResumenLista');
    if(lista){
      const total = Math.max(1, Object.keys(empleados).length);
      const presentPct = Math.round((data.presentes/total)*100);
      lista.innerHTML = `
        <div class="pd43-item"><div><b>Asistencia del día</b><br><small>${data.presentes} de ${Object.keys(empleados).length} empleados</small><div class="pd43-progress"><i style="width:${presentPct}%"></i></div></div><span class="pd43-pill ok">${presentPct}%</span></div>
        <div class="pd43-item"><div><b>Atrasos detectados</b><br><small>Entrada configurada: ${getStart()} + ${getGrace()} min</small></div><span class="pd43-pill warn">${data.tardes}</span></div>
        <div class="pd43-item"><div><b>Ausentes</b><br><small>Sin marcación de entrada en ${data.fecha}</small></div><span class="pd43-pill bad">${data.ausentes}</span></div>
      `;
    }
  }

  function exportControlPro(){
    const fecha = getFechaActiva();
    const rows = [['Empleado','Fecha','Estado','Entrada','Salida','Minutos de atraso','Horas trabajadas']].concat(lastRows.map(r=>[r.nombre, fecha, r.estado, r.entrada, r.salida, r.tardeMin, +r.horas.toFixed(2)]));
    if(window.XLSX){
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{wch:28},{wch:12},{wch:12},{wch:10},{wch:10},{wch:18},{wch:18}];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Control Pro');
      XLSX.writeFile(wb, `Poladent_Control_Pro_${fecha}.xlsx`);
    }else{
      const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `Poladent_Control_Pro_${fecha}.csv`; a.click(); URL.revokeObjectURL(a.href);
    }
  }
  function escapeHtml(s){ return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  function subscribe(){
    if(typeof db === 'undefined') return setTimeout(subscribe, 300);
    try{
      db.ref('empleados').on('value', snap=>{ empleados = snap.val() || {}; render(); });
      db.ref('marcaciones').on('value', snap=>{ marcaciones = snap.val() || {}; render(); });
    }catch(e){ console.warn('Poladent v4.3 no pudo leer Firebase todavía:', e); setTimeout(subscribe, 800); }
  }
  function watchLayout(){
    const panel = $('#adminPanel');
    if(!panel) return;
    const tick = ()=>{ if(!panel.classList.contains('hidden')) { ensureUI(); render(); } };
    new MutationObserver(tick).observe(panel,{attributes:true,attributeFilter:['class']});
    setInterval(tick, 1500);
    tick();
  }

  ready(()=>{ watchLayout(); subscribe(); });
})();
