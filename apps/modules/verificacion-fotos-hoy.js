(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const state={mounted:false,listener:null,lastCleanup:''};
const tipos={entrada:'Entrada',almuerzo_salida:'Salida al almuerzo',almuerzo_regreso:'Regreso del almuerzo',salida:'Salida final'};
function db(){return window.firebase?.database?.();}
function dateKey(d=new Date()){return d.toLocaleDateString('en-CA');}
function escapeText(v){return String(v??'');}
function ensureRoot(){
 let root=$('#pvf-root');
 if(root)return root;
 root=document.createElement('section');root.id='pvf-root';root.className='pvf-root';
 root.innerHTML=`<div class="pvf-head"><div><h3>📷 Verificación de hoy</h3><p>Fotografías temporales de las marcaciones realizadas durante la jornada actual.</p></div><div class="pvf-actions"><button id="pvf-refresh" type="button">Actualizar</button><button id="pvf-clean" type="button" class="secondary">Limpiar fotos vencidas</button></div></div><div id="pvf-status" class="pvf-status">Preparando verificación…</div><div id="pvf-grid" class="pvf-grid"></div><div class="pvf-note">Las fotografías del día anterior se eliminan al abrir el sistema después de medianoche. La asistencia, hora, GPS y auditoría permanecen intactos.</div>`;
 const panel=$('#adminPanel');(panel||document.body).appendChild(root);
 $('#pvf-refresh',root).onclick=subscribe;
 $('#pvf-clean',root).onclick=()=>cleanupExpired(true);
 ensureModal();
 return root;
}
function ensureModal(){if($('#pvf-modal'))return;const modal=document.createElement('div');modal.id='pvf-modal';modal.className='pvf-modal hidden';modal.innerHTML=`<div class="pvf-modal-card"><button id="pvf-close" type="button" aria-label="Cerrar">✕</button><img id="pvf-large" alt="Fotografía de verificación"><div id="pvf-caption"></div></div>`;document.body.appendChild(modal);$('#pvf-close').onclick=()=>modal.classList.add('hidden');modal.onclick=e=>{if(e.target===modal)modal.classList.add('hidden')};}
function status(text,bad=false){const el=$('#pvf-status');if(!el)return;el.textContent=text;el.classList.toggle('bad',bad);}
function endOfYesterday(){const d=new Date();d.setHours(0,0,0,0);return d.getTime()-1;}
async function cleanupExpired(force=false){
 const database=db();if(!database)return status('Firebase no está disponible.',true);
 const today=dateKey();const storageKey='poladent_fotos_limpieza_'+today;
 if(!force&&localStorage.getItem(storageKey)==='ok')return;
 try{
  status('Revisando fotografías vencidas…');
  const snap=await database.ref('marcaciones').once('value');const all=snap.val()||{};const updates={};let count=0;const limit=endOfYesterday();
  Object.entries(all).forEach(([empId,days])=>Object.entries(days||{}).forEach(([fecha,marks])=>Object.entries(marks||{}).forEach(([tipo,m])=>{
   if(!m||!m.fotoEvidencia)return;
   const expired=(Number(m.fotoExpiraEn)||0)<=limit || fecha<today;
   if(!expired)return;
   const base=`marcaciones/${empId}/${fecha}/${tipo}`;
   updates[`${base}/fotoEvidencia`]=null;updates[`${base}/fotoDisponible`]=false;updates[`${base}/fotoEliminadaAutomaticamenteEn`]=Date.now();count++;
  })));
  if(count)await database.ref().update(updates);
  localStorage.setItem(storageKey,'ok');state.lastCleanup=today;
  status(count?`${count} fotografía(s) vencida(s) eliminada(s). Los registros de asistencia se conservaron.`:'No hay fotografías vencidas.');
 }catch(e){status('No se pudieron limpiar las fotografías vencidas: '+(e.message||e),true);}
}
function openPhoto(item){const modal=$('#pvf-modal'),img=$('#pvf-large'),cap=$('#pvf-caption');img.src=item.photo;cap.textContent=`${item.name} · ${tipos[item.type]||item.type} · ${item.time}${item.branch?' · '+item.branch:''}`;modal.classList.remove('hidden');}
function render(value){
 const grid=$('#pvf-grid');if(!grid)return;grid.innerHTML='';const today=dateKey();const items=[];
 Object.entries(value||{}).forEach(([empId,days])=>{const marks=days?.[today]||{};Object.entries(marks).forEach(([type,m])=>{if(m?.fotoEvidencia&&m.fotoDisponible!==false)items.push({empId,type,name:m.nombre||'Empleado',time:m.hora||'',ts:Number(m.timestamp)||0,branch:m.sedeNombre||'',gps:m.gpsVerificado,photo:m.fotoEvidencia});});});
 items.sort((a,b)=>b.ts-a.ts);
 if(!items.length){grid.innerHTML='<div class="pvf-empty">Todavía no hay fotografías disponibles en las marcaciones de hoy.</div>';status('0 fotografías disponibles hoy.');return;}
 items.forEach(item=>{const card=document.createElement('article');card.className='pvf-card';const img=document.createElement('img');img.src=item.photo;img.alt='Fotografía de '+escapeText(item.name);img.loading='lazy';img.onclick=()=>openPhoto(item);const info=document.createElement('div');const h=document.createElement('h4');h.textContent=item.name;const p=document.createElement('p');p.textContent=`${tipos[item.type]||item.type} · ${item.time}`;const small=document.createElement('small');small.textContent=`${item.branch||'Sin sucursal'} · GPS ${item.gps?'verificado':'sin verificar'}`;const btn=document.createElement('button');btn.type='button';btn.textContent='Ver fotografía';btn.onclick=()=>openPhoto(item);info.append(h,p,small,btn);card.append(img,info);grid.appendChild(card);});
 status(`${items.length} fotografía(s) disponible(s) hoy.`);
}
function subscribe(){
 const database=db();if(!database)return status('Firebase no está disponible.',true);const ref=database.ref('marcaciones');if(state.listener)ref.off('value',state.listener);status('Cargando fotografías de hoy…');state.listener=s=>render(s.val()||{});ref.on('value',state.listener,e=>status('No se pudieron cargar las fotografías: '+(e.message||e),true));
}
async function mount(){ensureRoot();if(state.mounted)return;state.mounted=true;await cleanupExpired(false);subscribe();}
window.PoladentVerificacionFotos={mount,cleanupExpired,refresh:subscribe};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,1450));else setTimeout(mount,1450);
})();
