/* Poladent Sistema - Análisis de asistencia y rango salarial
   Solo lectura de empleados/marcaciones. No cambia ni elimina datos de Firebase. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const DAY = 86400000;
  let empleados = {};
  let marcaciones = {};
  let chart = null;

  function iso(d){ return d.toISOString().slice(0,10); }
  function today(){ return iso(new Date()); }
  function startOfWeek(date=new Date()){
    const d = new Date(date); const day = d.getDay() || 7;
    d.setHours(0,0,0,0); d.setDate(d.getDate()-day+1); return d;
  }
  function setRange(kind){
    const now = new Date(); let from = new Date(now), to = new Date(now);
    if(kind==='semana'){ from=startOfWeek(now); to=new Date(from.getTime()+6*DAY); }
    if(kind==='mes'){ from=new Date(now.getFullYear(),now.getMonth(),1); to=new Date(now.getFullYear(),now.getMonth()+1,0); }
    if(kind==='dia'){ from=to=now; }
    $('#aaDesde').value=iso(from); $('#aaHasta').value=iso(to); render();
  }
  function datesBetween(from,to){
    if(!from||!to) return [];
    const out=[]; let d=new Date(from+'T00:00:00'), end=new Date(to+'T00:00:00');
    while(d<=end){ out.push(iso(d)); d=new Date(d.getTime()+DAY); }
    return out;
  }
  function mark(day,type){ return day?.[type] || Object.values(day||{}).find(x=>x?.tipo===type) || null; }
  function minutes(ts){ const d=new Date(Number(ts)||0); return d.getHours()*60+d.getMinutes(); }
  function scheduleMinutes(emp,key,fallback){
    const raw=emp?.horario?.[key] || emp?.[key==='entrada'?'horaEntrada':'horaSalida'] || fallback;
    const m=String(raw||fallback).match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]*60 + +m[2]) : 0;
  }
  function workHours(day){
    const e=mark(day,'entrada')?.timestamp, s=mark(day,'salida')?.timestamp;
    if(!e||!s||s<e) return 0;
    let lunch=0; const ls=mark(day,'almuerzo_salida')?.timestamp, lr=mark(day,'almuerzo_regreso')?.timestamp;
    if(ls&&lr&&lr>=ls) lunch=(lr-ls)/3600000;
    return Math.max(0,(s-e)/3600000-lunch);
  }
  function isWorkday(date){ const d=new Date(date+'T00:00:00'); return d.getDay()!==0; }
  function statsFor(id,from,to){
    const emp=empleados[id]||{}; const days=datesBetween(from,to).filter(isWorkday);
    let present=0, complete=0, onTime=0, late=0, hours=0, expected=0;
    const detail=[];
    const start=scheduleMinutes(emp,'entrada','08:00');
    const end=scheduleMinutes(emp,'salida','17:00');
    const expectedDaily=Math.max(1,Math.min(12,(end-start)/60-1));
    days.forEach(date=>{
      const day=(marcaciones[id]||{})[date]||{};
      const entry=mark(day,'entrada'), exit=mark(day,'salida');
      const h=workHours(day); hours+=h; expected+=expectedDaily;
      if(entry){ present++; const diff=Math.max(0,minutes(entry.timestamp)-start); if(diff<=10) onTime++; else late++; }
      if(entry&&exit) complete++;
      detail.push({date,entry:entry?.hora||'—',exit:exit?.hora||'—',hours:h,late:entry?Math.max(0,minutes(entry.timestamp)-start):null});
    });
    const attendance=days.length ? present/days.length*100 : 0;
    const punctuality=present ? onTime/present*100 : 0;
    const hoursPct=expected ? Math.min(100,hours/expected*100) : 0;
    const score=Math.round(attendance*.40+punctuality*.40+hoursPct*.20);
    return {id,emp,days:days.length,present,complete,onTime,late,hours,expected,attendance,punctuality,hoursPct,score,detail};
  }
  function avatar(emp){
    const photo=emp.foto||emp.photo||emp.photoUrl||emp.imagen||'';
    return photo ? `<img src="${esc(photo)}" alt="Foto de ${esc(emp.nombre||'empleado')}">` : '<span>👤</span>';
  }
  function inject(){
    const host=$('.chartPremium'); if(!host || $('#aaPanel')) return;
    const panel=document.createElement('div'); panel.id='aaPanel'; panel.className='aa-panel';
    panel.innerHTML=`
      <div class="aa-filters">
        <div><label>Desde</label><input id="aaDesde" type="date"></div>
        <div><label>Hasta</label><input id="aaHasta" type="date"></div>
        <div><label>Funcionario</label><select id="aaEmpleado"><option value="">Todos</option></select></div>
        <div class="aa-quick"><button type="button" data-aa="dia">Día</button><button type="button" data-aa="semana">Semana</button><button type="button" data-aa="mes">Mes</button></div>
      </div>
      <div id="aaWinner"></div>
      <div id="aaRanking" class="aa-ranking"></div>
      <div id="aaCards" class="aa-cards"></div>
      <div id="aaDetail" class="aa-detail"></div>`;
    const canvas=$('#horasChart',host); host.insertBefore(panel,canvas);
    $('#aaDesde').value=iso(startOfWeek()); $('#aaHasta').value=iso(new Date(startOfWeek().getTime()+6*DAY));
    $('#aaDesde').addEventListener('change',render); $('#aaHasta').addEventListener('change',render); $('#aaEmpleado').addEventListener('change',render);
    panel.querySelectorAll('[data-aa]').forEach(b=>b.addEventListener('click',()=>setRange(b.dataset.aa)));
  }
  function populateEmployees(){
    const select=$('#aaEmpleado'); if(!select) return;
    const current=select.value;
    select.innerHTML='<option value="">Todos</option>'+Object.entries(empleados).sort((a,b)=>String(a[1].nombre||'').localeCompare(String(b[1].nombre||''))).map(([id,e])=>`<option value="${esc(id)}">${esc(e.nombre||'Sin nombre')}</option>`).join('');
    select.value=current;
  }
  function render(){
    if(!$('#aaPanel')) return;
    const from=$('#aaDesde').value, to=$('#aaHasta').value, selected=$('#aaEmpleado').value;
    if(!from||!to||from>to){ $('#aaCards').innerHTML='<p>Selecciona un rango de fechas válido.</p>'; return; }
    let rows=Object.keys(empleados).map(id=>statsFor(id,from,to));
    if(selected) rows=rows.filter(x=>x.id===selected);
    rows.sort((a,b)=>b.score-a.score || b.punctuality-a.punctuality || b.hours-a.hours);
    const winner=rows[0];
    $('#aaWinner').innerHTML=winner?`<section class="aa-winner"><div class="aa-avatar">${avatar(winner.emp)}</div><div><small>🏆 Funcionario destacado del período</small><h3>${esc(winner.emp.nombre||'Sin nombre')}</h3><p>${winner.score}% de cumplimiento · ${winner.onTime} llegadas puntuales · ${winner.hours.toFixed(1)} horas</p></div><strong>${winner.score}%</strong></section>`:'';
    $('#aaRanking').innerHTML=rows.length?`<h4>Clasificación del período</h4>${rows.slice(0,10).map((r,i)=>`<div><b>${i+1}</b><span>${esc(r.emp.nombre||'Sin nombre')}</span><em>${r.score}%</em></div>`).join('')}`:'<p>No hay empleados registrados.</p>';
    $('#aaCards').innerHTML=rows.map(r=>`<article class="aa-card" data-id="${esc(r.id)}"><div class="aa-avatar">${avatar(r.emp)}</div><div class="aa-name"><b>${esc(r.emp.nombre||'Sin nombre')}</b><small>${r.present}/${r.days} días con entrada</small></div><div class="aa-metrics"><span><b>${r.punctuality.toFixed(0)}%</b>Puntualidad</span><span><b>${r.hours.toFixed(1)}h</b>Trabajadas</span><span><b>${r.late}</b>Atrasos</span><span><b>${r.score}%</b>Cumplimiento</span></div><button type="button">Ver historial</button></article>`).join('');
    $('#aaCards').querySelectorAll('.aa-card button').forEach(btn=>btn.addEventListener('click',()=>showDetail(rows.find(r=>r.id===btn.closest('.aa-card').dataset.id))));
    drawChart(rows);
  }
  function showDetail(r){
    if(!r) return;
    $('#aaDetail').innerHTML=`<div class="aa-detail-head"><h4>Historial de ${esc(r.emp.nombre||'empleado')}</h4><button id="aaCloseDetail" type="button">Cerrar</button></div><div class="aa-table-wrap"><table><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th></tr></thead><tbody>${r.detail.map(d=>`<tr><td>${d.date}</td><td>${d.entry}</td><td>${d.exit}</td><td>${d.hours.toFixed(2)}</td><td>${d.late===null?'Sin entrada':d.late<=10?'A tiempo':`Atraso ${d.late} min`}</td></tr>`).join('')}</tbody></table></div>`;
    $('#aaCloseDetail').onclick=()=>$('#aaDetail').innerHTML='';
    $('#aaDetail').scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function drawChart(rows){
    const canvas=$('#horasChart'); if(!canvas||!window.Chart) return;
    if(window.horasChartInstance){ try{window.horasChartInstance.destroy();}catch{} window.horasChartInstance=null; }
    if(chart){try{chart.destroy();}catch{}}
    chart=new Chart(canvas.getContext('2d'),{type:'bar',data:{labels:rows.map(r=>r.emp.nombre||'Sin nombre'),datasets:[{label:'Cumplimiento %',data:rows.map(r=>r.score)}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
  }

  function enhanceSalary(){
    const box=$('#resumenPagos'); if(!box || $('#aaSalaryTools')) return;
    const tools=document.createElement('div'); tools.id='aaSalaryTools'; tools.className='aa-salary-tools';
    tools.innerHTML=`<div><b>Historial salarial por período</b><small>Usa “Desde” y “Hasta” en Resumen de marcaciones para consultar el día, semana, mes o cualquier rango.</small></div><div><button type="button" id="aaSalaryWeek">Esta semana</button><button type="button" id="aaSalaryMonth">Este mes</button><button type="button" id="aaPrintSalary">🖨️ Imprimir historial seleccionado</button></div>`;
    box.parentNode.insertBefore(tools,box);
    $('#aaSalaryWeek').onclick=()=>{ const f=startOfWeek(); fechaDesde.value=iso(f); fechaHasta.value=iso(new Date(f.getTime()+6*DAY)); fechaDesde.dispatchEvent(new Event('change')); };
    $('#aaSalaryMonth').onclick=()=>{ const n=new Date(); fechaDesde.value=iso(new Date(n.getFullYear(),n.getMonth(),1)); fechaHasta.value=iso(new Date(n.getFullYear(),n.getMonth()+1,0)); fechaDesde.dispatchEvent(new Event('change')); };
    $('#aaPrintSalary').onclick=printSalary;
  }
  function printSalary(){
    const from=$('#fechaDesde')?.value||'', to=$('#fechaHasta')?.value||'';
    if(!from||!to) return alert('Selecciona la fecha desde y hasta antes de imprimir.');
    const content=$('#resumenPagos')?.innerHTML||'<p>Sin información.</p>';
    const w=window.open('','_blank','width=1000,height=760');
    if(!w) return alert('El navegador bloqueó la ventana de impresión.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Historial salarial ${from} a ${to}</title><style>body{font-family:Arial,sans-serif;color:#17202a;padding:28px}header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1687c8;padding-bottom:14px;margin-bottom:18px}header img{width:72px;height:72px;object-fit:contain}h1{font-size:22px;margin:0}header p{margin:5px 0 0;color:#566573}button{display:none!important}.print-note{margin:14px 0;padding:10px;background:#eef7fc;border-radius:8px}@media print{body{padding:0}.print-note{background:#fff;border:1px solid #ddd}}</style></head><body><header><img src="img/logo-poladent.png"><div><h1>Historial de salarios y asistencia</h1><p>Período seleccionado: ${esc(from)} al ${esc(to)}</p></div></header><div class="print-note">Documento generado desde Poladent Sistema.</div>${content}<script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
  }
  function boot(){
    inject(); enhanceSalary();
    if(window.PoladentData){
      window.PoladentData.subscribe('empleados',snap=>{empleados=snap.val()||{}; populateEmployees(); render();});
      window.PoladentData.subscribe('marcaciones',snap=>{marcaciones=snap.val()||{}; render();});
    } else if(window.firebase){
      firebase.database().ref('empleados').on('value',snap=>{empleados=snap.val()||{};populateEmployees();render();});
      firebase.database().ref('marcaciones').on('value',snap=>{marcaciones=snap.val()||{};render();});
    }
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
