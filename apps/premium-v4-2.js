/* =========================================================
   POLADENT SISTEMA v4.2 PREMIUM ORGANIZADO
   Organizador visual seguro: conserva IDs y lógica original.
   ========================================================= */
(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function el(tag, cls, html){
    const node = document.createElement(tag);
    if(cls) node.className = cls;
    if(html !== undefined) node.innerHTML = html;
    return node;
  }

  const sections = [
    {id:'dashboard', label:'Resumen', icon:'📊', title:'Panel principal', desc:'Vista limpia de indicadores, gráfico y accesos rápidos.'},
    {id:'empleados', label:'Empleados', icon:'👥', title:'Empleados', desc:'Registro, fotos, salarios y lista del personal.'},
    {id:'asistencia', label:'Asistencia', icon:'⏱️', title:'Asistencia', desc:'Marcaciones, filtros por fecha y edición de horarios.'},
    {id:'pagos', label:'Pagos', icon:'💰', title:'Pagos y días libres', desc:'Resumen salarial, feriados globales y días libres pagados.'},
    {id:'reportes', label:'Reportes', icon:'📤', title:'Reportes', desc:'Notificaciones y exportaciones de marcaciones y salarios.'},
    {id:'config', label:'Configuración', icon:'⚙️', title:'Configuración', desc:'Herramientas internas y módulos del sistema.'}
  ];

  function makeTitle(cfg){
    return el('div','pd42-section-title',`<div><h2>${cfg.icon} ${cfg.title}</h2><p>${cfg.desc}</p></div><span class="pd42-chip">v4.2 Premium</span>`);
  }

  function moveInto(section, node){
    if(node) section.appendChild(node);
  }

  function cardText(card){
    return (card ? card.textContent : '').toLowerCase();
  }

  function organizeAdmin(){
    const panel = $('#adminPanel');
    // La Edición Comercial reemplaza este organizador visual antiguo.
    // Si ya está activa, no debemos envolver el panel ni duplicar menús.
    if(!panel || panel.dataset.commercial === '1' || document.body.classList.contains('pc-commercial') || panel.dataset.pd42Ready === '1') return;
    panel.dataset.pd42Ready = '1';
    panel.classList.add('pd42-layout');

    const original = Array.from(panel.children);

    const sidebar = el('aside','pd42-sidebar');
    sidebar.innerHTML = `
      <div class="pd42-side-brand">
        <img src="img/logo-poladent.png" alt="Poladent">
        <div><strong>POLADENT</strong><small>Control empresarial</small></div>
      </div>
      <div class="pd42-menu"></div>
      <div class="pd42-side-footer">Sistema organizado sin cambiar Firebase ni la base de datos. Tus registros históricos se mantienen.</div>
    `;

    const main = el('main','pd42-main');
    const buckets = {};
    sections.forEach((cfg, idx)=>{
      const sec = el('section',`pd42-section ${idx===0?'active':''}`);
      sec.id = `pd42-${cfg.id}`;
      sec.appendChild(makeTitle(cfg));
      buckets[cfg.id] = sec;
      main.appendChild(sec);
      const btn = el('button',`pd42-nav-btn ${idx===0?'active':''}`,`<span>${cfg.icon}</span><b>${cfg.label}</b>`);
      btn.type='button';
      btn.addEventListener('click',()=>showSection(cfg.id));
      $('.pd42-menu', sidebar).appendChild(btn);
    });

    const quick = el('div','pd42-quick-actions',`
      <button type="button" data-go="empleados">👥 Gestionar empleados</button>
      <button type="button" data-go="asistencia">⏱️ Ver marcaciones</button>
      <button type="button" data-go="pagos">💰 Revisar pagos</button>
      <button type="button" data-go="reportes">📤 Exportar reportes</button>
    `);
    quick.addEventListener('click', (ev)=>{
      const b = ev.target.closest('[data-go]');
      if(b) showSection(b.dataset.go);
    });

    panel.innerHTML = '';
    panel.appendChild(sidebar);
    panel.appendChild(main);

    original.forEach(node=>{
      if(!node || node.nodeType !== 1) return;
      const text = cardText(node);
      const id = node.id || '';
      // Los modales deben vivir directamente en body. Si quedan dentro de una
      // sección oculta, el botón abre el modal pero no se ve hasta cambiar de menú.
      if(node.classList.contains('modal') || node.classList.contains('modalBackdrop')){
        document.body.appendChild(node);
      }else if(node.classList.contains('adminTopBar') || node.classList.contains('dashboardHero') || node.classList.contains('kpiGrid') || node.classList.contains('chartPremium')){
        moveInto(buckets.dashboard,node);
      }else if(id === 'resumenPagos' || text.includes('feriados globales') || text.includes('días libres pagados') || id.includes('feriado') || id.includes('libre')){
        moveInto(buckets.pagos,node);
      }else if(text.includes('agregar empleado') || text.includes('fotos de empleados') || text.includes('empleados registrados') || id.includes('salario')){
        moveInto(buckets.empleados,node);
      }else if(text.includes('resumen de marcaciones') || text.includes('editar horario') || id.includes('editModal')){
        moveInto(buckets.asistencia,node);
      }else if(text.includes('notificaciones') || id === 'notificaciones' || id.includes('export')){
        moveInto(buckets.reportes,node);
      }else if(id === 'logoutBtn'){
        main.appendChild(node);
      }else{
        moveInto(buckets.config,node);
      }
    });

    buckets.dashboard.insertBefore(quick, buckets.dashboard.children[1] || null);
    addToolbars(buckets);
  }

  function addToolbars(buckets){
    buckets.empleados.insertBefore(el('div','pd42-toolbar','<b>Orden recomendado:</b> agrega empleado → sube foto → asigna salario → revisa lista.'), buckets.empleados.children[1] || null);
    buckets.asistencia.insertBefore(el('div','pd42-toolbar','<b>Control diario:</b> filtra por fecha o rango para revisar entradas, almuerzo y salida.'), buckets.asistencia.children[1] || null);
    buckets.pagos.insertBefore(el('div','pd42-toolbar','<b>Nómina:</b> aquí quedan pagos, banco de horas, feriados y permisos pagados.'), buckets.pagos.children[1] || null);
    buckets.reportes.insertBefore(el('div','pd42-toolbar','<b>Exportación:</b> descarga marcaciones y salarios para respaldo o revisión.'), buckets.reportes.children[1] || null);
  }

  function showSection(id){
    $$('.pd42-section').forEach(s=>s.classList.toggle('active', s.id === `pd42-${id}`));
    $$('.pd42-nav-btn').forEach(btn=>btn.classList.remove('active'));
    const index = sections.findIndex(s=>s.id===id);
    const btn = $$('.pd42-nav-btn')[index];
    if(btn) btn.classList.add('active');
    const main = $('.pd42-main');
    if(main) main.scrollTo({top:0, behavior:'smooth'});
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function observeAdminVisibility(){
    const panel = $('#adminPanel');
    if(!panel) return;
    const sync = ()=>{
      const open = !panel.classList.contains('hidden');
      document.body.classList.toggle('pd42-admin-open', open);
      if(open) setTimeout(organizeAdmin, 60);
    };
    sync();
    new MutationObserver(sync).observe(panel,{attributes:true, attributeFilter:['class']});
  }

  ready(()=>{
    observeAdminVisibility();
    setTimeout(observeAdminVisibility, 700);
  });
})();
