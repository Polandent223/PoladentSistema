/* Poladent Sistema - Análisis visual profesional de asistencia (Fase 4)
   Solo lectura: empleados, marcaciones, feriados, días libres y justificaciones.
   No escribe, modifica ni elimina historial de Firebase. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const DAY=86400000;
  let empleados={},marcaciones={},feriados={},diasLibres={},justificaciones={},configuracion={tolerancia:10},chart=null;

  function iso(d){const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
  function startOfWeek(date=new Date()){const d=new Date(date),day=d.getDay()||7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day+1);return d}
  function setRange(kind){const now=new Date();let from=new Date(now),to=new Date(now);if(kind==='semana'){from=startOfWeek(now);to=new Date(from.getTime()+6*DAY)}if(kind==='mes'){from=new Date(now.getFullYear(),now.getMonth(),1);to=new Date(now.getFullYear(),now.getMonth()+1,0)}if(kind==='dia'){from=to=now}$('#aaDesde').value=iso(from);$('#aaHasta').value=iso(to);render()}
  function timeMinutes(raw,fallback='08:00'){const m=String(raw||fallback).match(/^(\d{1,2}):(\d{2})/);return m?(+m[1]*60 + +m[2]):0}
  function minutes(ts){const d=new Date(Number(ts)||0);return d.getHours()*60+d.getMinutes()}
  function isHoliday(date){const v=feriados?.[date];return v===true||(v&&v.activo!==false)}
  function isFreeDay(id,date){const v=diasLibres?.[id]?.[date];return !!v&&v.activo!==false}
  function justification(id,date){return justificaciones?.[id]?.[date]||null}
  function isArchived(emp){return emp?.archivado===true||emp?.activo===false||String(emp?.estado||'').toLowerCase()==='archivado'}
  function archiveDate(emp){if(!isArchived(emp)||!emp?.estadoActualizadoEn)return '';return iso(new Date(Number(emp.estadoActualizadoEn)))}
  function afterArchive(emp,date){const a=archiveDate(emp);return !!a&&date>a}
  function avatar(emp){const photo=emp.foto||emp.photo||emp.photoUrl||emp.imagen||'';return photo?`<img src="${esc(photo)}" alt="Foto de ${esc(emp.nombre||'empleado')}">`:'<span>👤</span>'}
  function pct(n){return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}

  function statsFor(id,from,to){
    const emp=empleados[id]||{},engine=window.PoladentAttendance;
    const empty={id,emp,days:0,present:0,complete:0,onTime:0,late:0,hours:0,expected:0,attendance:0,punctuality:0,hoursPct:0,completion:0,score:0,justified:0,absent:0,detail:[],relevant:false};
    if(!engine)return empty;
    const allDates=engine.datesBetween(from,to),sch=engine.schedule(emp),start=timeMinutes(sch.entrada,'08:00'),tolerance=Math.max(0,Number(emp?.horario?.tolerancia??emp?.tolerancia??configuracion?.tolerancia??10)||0);
    let present=0,complete=0,onTime=0,late=0,hours=0,expected=0,obligationDays=0,justified=0,absent=0,responsibilityGood=0,responsibilityTotal=0;
    const detail=[];
    allDates.forEach(date=>{
      const day=(marcaciones[id]||{})[date]||{},entry=engine.mark(day,'entrada'),exit=engine.mark(day,'salida'),h=engine.workHours(day);hours+=h;
      const holiday=isHoliday(date),free=isFreeDay(id,date),just=justification(id,date),scheduled=engine.isScheduledWorkday(emp,date),archivedPast=afterArchive(emp,date);
      const hasMark=!!(entry||exit||engine.mark(day,'almuerzo_salida')||engine.mark(day,'almuerzo_regreso'));
      let obligation=scheduled&&!holiday&&!free&&!archivedPast,status='Día no laborable',lateMin=null,justifiedDay=false;
      if(archivedPast){status='Funcionario archivado';obligation=false}
      else if(holiday)status='Feriado';
      else if(free)status='Día libre';
      else if(obligation){
        const paidJustHours=Number(just?.horasPagadas||0),justType=String(just?.tipo||'');
        justifiedDay=!!just&&!entry;
        if(justifiedDay){
          justified++;
          status=`Justificada${justType?': '+justType:''}`;
          // Una ausencia formalmente justificada no penaliza asistencia. Si hay horas pagadas,
          // reduce también la expectativa horaria del día para el indicador de cumplimiento.
          const planned=engine.plannedHours(emp);
          expected+=Math.max(0,planned-Math.min(planned,paidJustHours));
          responsibilityGood++;responsibilityTotal++;
        }else{
          obligationDays++;expected+=engine.plannedHours(emp);responsibilityTotal++;
          if(entry){
            present++;lateMin=Math.max(0,minutes(entry.timestamp)-start);
            if(lateMin<=tolerance){onTime++;status='A tiempo';responsibilityGood++}else{late++;status=`Atraso ${lateMin} min`;if(lateMin<=tolerance+10)responsibilityGood+=0.5}
          }else{absent++;status='Ausente'}
          if(entry&&exit)complete++;
        }
      }else if(hasMark)status='Día no laborable trabajado';
      detail.push({date,entry:entry?.hora||'—',exit:exit?.hora||'—',hours:h,late:lateMin,status,obligation,justified:justifiedDay,note:just?.nota||''});
    });
    const consideredDays=obligationDays;
    const attendance=consideredDays?present/consideredDays*100:(justified?100:0);
    const punctuality=present?onTime/present*100:(consideredDays?0:100);
    const completion=present?complete/present*100:(consideredDays?0:100);
    const hoursPct=expected?Math.min(100,hours/expected*100):100;
    const responsibility=responsibilityTotal?pct(responsibilityGood/responsibilityTotal*100):100;
    // Ponderación transparente: asistencia 30, puntualidad 25, jornada completa 20,
    // horas 15 y responsabilidad 10. Las ausencias justificadas quedan registradas sin castigo.
    const score=Math.round(attendance*.30+punctuality*.25+completion*.20+hoursPct*.15+responsibility*.10);
    const relevant=consideredDays>0||justified>0||detail.some(d=>d.entry!=='—'||d.exit!=='—');
    return {id,emp,days:consideredDays,present,complete,onTime,late,hours,expected,attendance,punctuality,hoursPct,completion,responsibility,score,justified,absent,detail,relevant};
  }

  function inject(){
    const host=$('.chartPremium');if(!host||$('#aaPanel'))return;
    const panel=document.createElement('div');panel.id='aaPanel';panel.className='aa-panel';
    panel.innerHTML=`
      <div class="aa-filters">
        <div><label>Desde</label><input id="aaDesde" type="date"></div>
        <div><label>Hasta</label><input id="aaHasta" type="date"></div>
        <div><label>Funcionario</label><select id="aaEmpleado"><option value="">Todos</option></select></div>
        <div class="aa-quick"><button type="button" data-aa="dia">Día</button><button type="button" data-aa="semana">Semana</button><button type="button" data-aa="mes">Mes</button><button type="button" id="aaPrint">🖨️ Imprimir</button></div>
      </div>
      <div class="aa-method"><b>Cómo se calcula:</b> Asistencia 30% · Puntualidad 25% · Jornada completa 20% · Horas cumplidas 15% · Responsabilidad 10%. Las ausencias justificadas se muestran, pero no castigan la asistencia.</div>
      <div id="aaWinner"></div><div id="aaRanking" class="aa-ranking"></div><div id="aaCards" class="aa-cards"></div><div id="aaDetail" class="aa-detail"></div>`;
    const canvas=$('#horasChart',host);host.insertBefore(panel,canvas);
    $('#aaDesde').value=iso(startOfWeek());$('#aaHasta').value=iso(new Date(startOfWeek().getTime()+6*DAY));
    $('#aaDesde').addEventListener('change',render);$('#aaHasta').addEventListener('change',render);$('#aaEmpleado').addEventListener('change',render);
    panel.querySelectorAll('[data-aa]').forEach(b=>b.addEventListener('click',()=>setRange(b.dataset.aa)));
    $('#aaPrint').addEventListener('click',()=>window.print());
  }
  function populateEmployees(){const select=$('#aaEmpleado');if(!select)return;const current=select.value;select.innerHTML='<option value="">Todos</option>'+Object.entries(empleados).sort((a,b)=>String(a[1].nombre||'').localeCompare(String(b[1].nombre||''))).map(([id,e])=>`<option value="${esc(id)}">${esc(e.nombre||'Sin nombre')}${isArchived(e)?' · Archivado':''}</option>`).join('');select.value=current}
  function medal(i){return i===0?'🥇':i===1?'🥈':i===2?'🥉':String(i+1)}
  function render(){
    if(!$('#aaPanel'))return;const from=$('#aaDesde').value,to=$('#aaHasta').value,selected=$('#aaEmpleado').value;
    if(!from||!to||from>to){$('#aaCards').innerHTML='<p>Selecciona un rango de fechas válido.</p>';return}
    let rows=Object.keys(empleados).map(id=>statsFor(id,from,to));
    if(selected)rows=rows.filter(x=>x.id===selected);else rows=rows.filter(x=>x.relevant);
    rows.sort((a,b)=>b.score-a.score||b.attendance-a.attendance||b.punctuality-a.punctuality||b.hours-a.hours);
    const winner=!selected?rows[0]:rows[0];
    $('#aaWinner').innerHTML=winner?`<section class="aa-winner"><div class="aa-avatar">${avatar(winner.emp)}</div><div><small>🏆 Funcionario destacado del período</small><h3>${esc(winner.emp.nombre||'Sin nombre')}</h3><p>${winner.score}% · ${winner.present}/${winner.days} días asistidos · ${winner.onTime} puntuales · ${winner.justified} justificadas</p></div><strong>${winner.score}%</strong></section>`:'<div class="aa-empty">No hay jornadas aplicables en este período.</div>';
    $('#aaRanking').innerHTML=rows.length?`<h4>Clasificación del período</h4>${rows.slice(0,10).map((r,i)=>`<div><b>${medal(i)}</b><span>${esc(r.emp.nombre||'Sin nombre')}${isArchived(r.emp)?' <small>(archivado)</small>':''}</span><em>${r.score}%</em></div>`).join('')}`:'<p>No hay información aplicable al período seleccionado.</p>';
    $('#aaCards').innerHTML=rows.map(r=>`<article class="aa-card" data-id="${esc(r.id)}"><div class="aa-avatar">${avatar(r.emp)}</div><div class="aa-name"><b>${esc(r.emp.nombre||'Sin nombre')}</b><small>${r.present}/${r.days} jornadas · ${r.justified} justificadas · ${r.absent} ausencias</small></div><div class="aa-metrics"><span><b>${r.attendance.toFixed(0)}%</b>Asistencia</span><span><b>${r.punctuality.toFixed(0)}%</b>Puntualidad</span><span><b>${r.completion.toFixed(0)}%</b>Jornada completa</span><span><b>${r.hoursPct.toFixed(0)}%</b>Horas</span><span><b>${r.responsibility.toFixed(0)}%</b>Responsabilidad</span><span><b>${r.score}%</b>Total</span></div><button type="button">Ver historial</button></article>`).join('');
    $('#aaCards').querySelectorAll('.aa-card button').forEach(btn=>btn.addEventListener('click',()=>showDetail(rows.find(r=>r.id===btn.closest('.aa-card').dataset.id))));drawChart(rows);
  }
  function showDetail(r){if(!r)return;$('#aaDetail').innerHTML=`<div class="aa-detail-head"><div><h4>Historial de ${esc(r.emp.nombre||'empleado')}</h4><small>Puntaje ${r.score}% · Asistencia ${r.attendance.toFixed(0)}% · Puntualidad ${r.punctuality.toFixed(0)}%</small></div><button id="aaCloseDetail" type="button">Cerrar</button></div><div class="aa-table-wrap"><table><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Estado</th><th>Nota</th></tr></thead><tbody>${r.detail.map(d=>`<tr><td>${d.date}</td><td>${d.entry}</td><td>${d.exit}</td><td>${d.hours.toFixed(2)}</td><td>${esc(d.status||'—')}</td><td>${esc(d.note||'—')}</td></tr>`).join('')}</tbody></table></div>`;$('#aaCloseDetail').onclick=()=>$('#aaDetail').innerHTML='';$('#aaDetail').scrollIntoView({behavior:'smooth',block:'nearest'})}
  function drawChart(rows){const canvas=$('#horasChart');if(!canvas||!window.Chart)return;if(window.horasChartInstance){try{window.horasChartInstance.destroy()}catch{}window.horasChartInstance=null}if(chart){try{chart.destroy()}catch{}}chart=new Chart(canvas.getContext('2d'),{type:'bar',data:{labels:rows.map(r=>r.emp.nombre||'Sin nombre'),datasets:[{label:'Cumplimiento %',data:rows.map(r=>r.score)}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}})}

  function enhanceSalary(){const box=$('#resumenPagos');if(!box||$('#aaSalaryTools'))return;const tools=document.createElement('div');tools.id='aaSalaryTools';tools.className='aa-salary-tools';tools.innerHTML=`<div><b>Historial salarial por período</b><small>Usa “Desde” y “Hasta” para consultar cualquier rango.</small></div><div><button type="button" id="aaSalaryWeek">Esta semana</button><button type="button" id="aaSalaryMonth">Este mes</button><button type="button" id="aaPrintSalary">🖨️ Imprimir historial seleccionado</button></div>`;box.parentNode.insertBefore(tools,box);$('#aaSalaryWeek').onclick=()=>{const f=startOfWeek();fechaDesde.value=iso(f);fechaHasta.value=iso(new Date(f.getTime()+6*DAY));fechaDesde.dispatchEvent(new Event('change'))};$('#aaSalaryMonth').onclick=()=>{const n=new Date();fechaDesde.value=iso(new Date(n.getFullYear(),n.getMonth(),1));fechaHasta.value=iso(new Date(n.getFullYear(),n.getMonth()+1,0));fechaDesde.dispatchEvent(new Event('change'))};$('#aaPrintSalary').onclick=printSalary}
  function printSalary(){const from=$('#fechaDesde')?.value||'',to=$('#fechaHasta')?.value||'';if(!from||!to)return alert('Selecciona la fecha desde y hasta antes de imprimir.');const content=$('#resumenPagos')?.innerHTML||'<p>Sin información.</p>';const w=window.open('','_blank','width=1000,height=760');if(!w)return alert('El navegador bloqueó la ventana de impresión.');w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Historial salarial ${from} a ${to}</title><style>body{font-family:Arial,sans-serif;color:#17202a;padding:28px}header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1687c8;padding-bottom:14px;margin-bottom:18px}header img{width:72px;height:72px;object-fit:contain}h1{font-size:22px;margin:0}header p{margin:5px 0 0;color:#566573}button{display:none!important}.print-note{margin:14px 0;padding:10px;background:#eef7fc;border-radius:8px}@media print{body{padding:0}.print-note{background:#fff;border:1px solid #ddd}}</style></head><body><header><img src="img/logo-poladent.png"><div><h1>Historial de salarios y asistencia</h1><p>Período seleccionado: ${esc(from)} al ${esc(to)}</p></div></header><div class="print-note">Documento generado desde Poladent Sistema.</div>${content}<script>setTimeout(()=>window.print(),400)<\/script></body></html>`);w.document.close()}
  function boot(){inject();enhanceSalary();const handlers={empleados:s=>{empleados=s.val()||{};populateEmployees();render()},marcaciones:s=>{marcaciones=s.val()||{};render()},feriados_global:s=>{feriados=s.val()||{};render()},dias_libres_empleado:s=>{diasLibres=s.val()||{};render()},justificaciones_v44:s=>{justificaciones=s.val()||{};render()},configuracion_v44:s=>{configuracion={tolerancia:10,...(s.val()||{})};render()}};if(window.PoladentData){Object.entries(handlers).forEach(([p,h])=>window.PoladentData.subscribe(p,h))}else if(window.firebase){const db=firebase.database();Object.entries(handlers).forEach(([p,h])=>db.ref(p).on('value',h))}}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
