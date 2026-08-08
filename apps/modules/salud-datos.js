/* POLADENT · Fase 16 · Salud de datos (solo lectura). */
(() => {
  'use strict';
  const VERSION='2026.08.08-fase16';
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const ORDER=['entrada','almuerzo_salida','almuerzo_regreso','salida'];
  const DAY_NAMES=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  let lastReport=null;

  function active(e){return !!e&&e.archivado!==true&&e.activo!==false&&String(e.estado||'').toLowerCase()!=='archivado'}
  function normName(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
  function validTime(v){return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''))}
  function schedule(e={}){const h=e.horario||{};return {entrada:h.entrada||e.horaEntrada||'',almuerzoSalida:h.almuerzoSalida||e.horaAlmuerzoSalida||'',almuerzoRegreso:h.almuerzoRegreso||e.horaAlmuerzoRegreso||'',salida:h.salida||e.horaSalida||'',diasLaborales:h.diasLaborales??e.diasLaborales??null}}
  function workdaysInfo(cfg){
    if(Array.isArray(cfg)){
      const normalized=cfg.map(x=>String(x).toLowerCase());
      return {configured:true,count:normalized.filter(x=>DAY_NAMES.includes(x)||/^\d$/.test(x)).length,raw:cfg};
    }
    if(cfg&&typeof cfg==='object')return {configured:true,count:DAY_NAMES.filter(k=>cfg[k]===true).length,raw:cfg};
    return {configured:false,count:6,raw:null};
  }
  function markTs(m){if(!m)return null;const n=Number(m.timestamp);if(Number.isFinite(n)&&n>0)return n;const h=String(m.hora||'').match(/(\d{1,2}):(\d{2})/);if(!h)return null;return Number(h[1])*60+Number(h[2])}
  function issue(severity,code,title,detail,meta={}){return {severity,code,title,detail,...meta}}

  function inspectEmployees(employees){
    const issues=[],byPin=new Map(),byName=new Map();
    Object.entries(employees||{}).forEach(([id,e])=>{
      if(!e)return;
      const name=String(e.nombre||'').trim(),pin=String(e.pin||'').trim();
      if(!name)issues.push(issue('alta','EMPLEADO_SIN_NOMBRE','Funcionario sin nombre',`Registro ${id} no tiene nombre.`,{employeeId:id}));
      if(!pin&&active(e))issues.push(issue('alta','PIN_FALTANTE','Funcionario activo sin PIN',`${name||id} no tiene PIN configurado.`,{employeeId:id}));
      if(pin){if(!byPin.has(pin))byPin.set(pin,[]);byPin.get(pin).push({id,e})}
      const nn=normName(name);if(nn){if(!byName.has(nn))byName.set(nn,[]);byName.get(nn).push({id,e})}
      if(active(e)){
        const s=schedule(e),times=[s.entrada,s.almuerzoSalida,s.almuerzoRegreso,s.salida],hasCustom=times.some(Boolean)||s.diasLaborales!=null;
        if(!hasCustom)issues.push(issue('media','HORARIO_GENERAL','Usa horario general',`${name||id} no tiene horario personalizado; usa los valores generales.`,{employeeId:id}));
        if(times.some(Boolean)&&!times.every(validTime))issues.push(issue('alta','HORARIO_INCOMPLETO','Horario incompleto o inválido',`${name||id}: ${times.map(x=>x||'—').join(' / ')}`,{employeeId:id}));
        if(times.every(validTime)&&!(s.entrada<s.almuerzoSalida&&s.almuerzoSalida<s.almuerzoRegreso&&s.almuerzoRegreso<s.salida))issues.push(issue('alta','HORARIO_ORDEN','Horas fuera de orden',`${name||id}: Entrada ${s.entrada}, almuerzo ${s.almuerzoSalida}–${s.almuerzoRegreso}, salida ${s.salida}.`,{employeeId:id}));
        const wi=workdaysInfo(s.diasLaborales);
        if(wi.configured&&wi.count===0)issues.push(issue('alta','SIN_DIAS_LABORABLES','Sin días laborables',`${name||id} tiene todos los días desmarcados; el sistema tratará la semana completa como descanso.`,{employeeId:id}));
      }
    });
    byPin.forEach((arr,pin)=>{const act=arr.filter(x=>active(x.e));if(arr.length>1)issues.push(issue(act.length>1?'alta':'media','PIN_DUPLICADO','PIN repetido',`PIN ${esc(pin)} aparece en ${arr.map(x=>x.e?.nombre||x.id).join(', ')}.${act.length>1?' Hay más de un funcionario activo con el mismo PIN.':''}`))});
    byName.forEach(arr=>{if(arr.length>1)issues.push(issue('media','NOMBRE_DUPLICADO','Posible funcionario duplicado',`Nombre similar/repetido: ${arr.map(x=>`${x.e?.nombre||x.id}${active(x.e)?'':' (archivado)'}`).join(', ')}.`))});
    return issues;
  }

  function inspectMarks(employees,marks){
    const issues=[];let records=0,incompletePast=0,orphans=0;
    const tk=today();
    Object.entries(marks||{}).forEach(([empId,days])=>{
      const emp=employees?.[empId];
      if(!emp){orphans++;issues.push(issue('alta','MARCACIONES_HUERFANAS','Marcaciones sin funcionario',`Existen marcaciones para el ID ${empId}, pero ese funcionario no existe en empleados/.`,{employeeId:empId}));}
      Object.entries(days||{}).forEach(([date,day])=>{
        if(!day||typeof day!=='object')return;records++;
        const present=ORDER.filter(t=>day[t]);
        if(!present.length)return;
        const label=emp?.nombre||empId;
        // Secuencia: no puede existir una etapa si falta una anterior.
        let gap=false;
        for(let i=0;i<present.length;i++){const idx=ORDER.indexOf(present[i]);for(let j=0;j<idx;j++)if(!day[ORDER[j]])gap=true;}
        if(gap)issues.push(issue('alta','SECUENCIA_INVALIDA','Marcación fuera de secuencia',`${label} · ${date}: existen etapas posteriores sin una etapa anterior.`,{employeeId:empId,date}));
        // Tipo almacenado debe coincidir con la clave.
        ORDER.forEach(type=>{const m=day[type];if(m&&m.tipo&&m.tipo!==type)issues.push(issue('media','TIPO_INCONSISTENTE','Tipo de marcación inconsistente',`${label} · ${date}: la clave ${type} contiene tipo “${m.tipo}”.`,{employeeId:empId,date}))});
        // Orden cronológico si hay timestamps/horas comparables.
        const seq=ORDER.filter(t=>day[t]).map(t=>({t,v:markTs(day[t])})).filter(x=>x.v!=null);
        for(let i=1;i<seq.length;i++)if(seq[i].v<seq[i-1].v){issues.push(issue('alta','HORAS_DESORDENADAS','Horas de marcación fuera de orden',`${label} · ${date}: ${seq[i].t} ocurre antes que ${seq[i-1].t}.`,{employeeId:empId,date}));break;}
        if(date<tk&&present.length<4){incompletePast++;issues.push(issue('media','JORNADA_INCOMPLETA_ANTIGUA','Jornada histórica incompleta',`${label} · ${date}: ${present.length}/4 marcaciones registradas.`,{employeeId:empId,date}));}
      });
    });
    return {issues,records,incompletePast,orphans};
  }

  async function readData(){
    if(!(window.firebase&&firebase.apps?.length&&firebase.database))throw new Error('Firebase no está disponible.');
    const [e,m]=await Promise.all([firebase.database().ref('empleados').once('value'),firebase.database().ref('marcaciones').once('value')]);
    return {employees:e.val()||{},marks:m.val()||{}};
  }

  function severityRank(s){return s==='alta'?0:s==='media'?1:2}
  function badge(s){return `<span class="sd-badge sd-${s}">${s==='alta'?'Atención alta':s==='media'?'Revisar':'Información'}</span>`}
  function renderReport(report){
    const root=$('#sdRoot');if(!root)return;
    const issues=report.issues.slice().sort((a,b)=>severityRank(a.severity)-severityRank(b.severity)||a.title.localeCompare(b.title,'es'));
    const counts={alta:issues.filter(x=>x.severity==='alta').length,media:issues.filter(x=>x.severity==='media').length,baja:issues.filter(x=>x.severity==='baja').length};
    $('#sdSummary').innerHTML=`<div><small>Funcionarios</small><b>${report.employeeCount}</b></div><div><small>Jornadas con datos</small><b>${report.records}</b></div><div><small>Atención alta</small><b>${counts.alta}</b></div><div><small>Revisar</small><b>${counts.media}</b></div>`;
    $('#sdStamp').textContent=`Última revisión: ${new Date(report.at).toLocaleString('es-VE')} · ${VERSION}`;
    $('#sdIssues').innerHTML=issues.length?issues.map(x=>`<article class="sd-issue"><div>${badge(x.severity)} <b>${esc(x.title)}</b></div><p>${esc(x.detail)}</p><small>${esc(x.code)}${x.date?' · '+esc(x.date):''}</small></article>`).join(''):'<div class="sd-clean">✅ No se detectaron inconsistencias en las comprobaciones automáticas.</div>';
  }

  async function run(){
    const btn=$('#sdRun'),box=$('#sdIssues');if(btn)btn.disabled=true;if(box)box.innerHTML='<div class="sd-clean">Revisando datos en modo solo lectura…</div>';
    try{
      const {employees,marks}=await readData();
      const empIssues=inspectEmployees(employees),markReport=inspectMarks(employees,marks);
      lastReport={at:Date.now(),employeeCount:Object.keys(employees).length,records:markReport.records,issues:[...empIssues,...markReport.issues]};
      renderReport(lastReport);
    }catch(err){if(box)box.innerHTML=`<div class="sd-error">No se pudo completar la revisión: ${esc(err?.message||err)}</div>`;}
    finally{if(btn)btn.disabled=false;}
  }

  function mount(){
    if($('#sdRoot'))return;
    const diag=$('#pfDiagnostic');if(!diag)return;
    const section=document.createElement('section');section.id='sdRoot';section.className='sd-root';
    section.innerHTML=`<div class="sd-head"><div><h3>🧹 Salud de datos</h3><p id="sdStamp">Revisión preventiva · no modifica ni borra información</p></div><button type="button" id="sdRun">Revisar ahora</button></div><div id="sdSummary" class="sd-summary"><div><small>Estado</small><b>Sin revisar</b></div></div><details open><summary>Hallazgos que requieren revisión</summary><div id="sdIssues" class="sd-issues"><div class="sd-clean">Pulsa “Revisar ahora”.</div></div></details><p class="sd-note">Esta herramienta es de solo lectura. Nunca corrige, fusiona ni elimina registros automáticamente.</p>`;
    diag.insertAdjacentElement('afterend',section);
    $('#sdRun')?.addEventListener('click',run);
    const style=document.createElement('style');style.textContent=`
      .sd-root{margin:16px 0;padding:18px;border:1px solid rgba(0,0,0,.1);border-radius:18px;background:rgba(255,255,255,.92)}
      .sd-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.sd-head h3{margin:0 0 4px}.sd-head p{margin:0;opacity:.65;font-size:.82rem}.sd-head button{padding:10px 14px;border-radius:12px;border:0;font-weight:700;cursor:pointer}
      .sd-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.sd-summary>div{padding:12px;border-radius:14px;background:rgba(0,0,0,.045)}.sd-summary small{display:block;opacity:.65}.sd-summary b{font-size:1.25rem}
      .sd-root summary{cursor:pointer;font-weight:750;margin:10px 0}.sd-issues{display:grid;gap:9px}.sd-issue{padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:13px}.sd-issue p{margin:7px 0;font-size:.84rem;line-height:1.4}.sd-issue small{opacity:.55}.sd-badge{font-size:.7rem;padding:3px 7px;border-radius:999px;margin-right:6px}.sd-alta{background:#fee2e2;color:#991b1b}.sd-media{background:#fef3c7;color:#92400e}.sd-baja{background:#e0f2fe;color:#075985}.sd-clean{padding:14px;border-radius:12px;background:rgba(34,197,94,.08)}.sd-error{padding:14px;border-radius:12px;background:rgba(239,68,68,.09)}.sd-note{font-size:.78rem;opacity:.62;margin:12px 0 0}
      @media(max-width:720px){.sd-head{align-items:flex-start;flex-direction:column}.sd-head button{width:100%}.sd-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;document.head.appendChild(style);
  }

  function waitMount(){
    let n=0;const t=setInterval(()=>{n++;mount();if($('#sdRoot')||n>60)clearInterval(t)},250);
  }
  document.addEventListener('DOMContentLoaded',waitMount);
  window.PoladentSaludDatos={version:VERSION,run,getLastReport:()=>lastReport};
})();
