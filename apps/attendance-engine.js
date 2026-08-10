/* POLADENT - Motor único de asistencia y salario (Fase 2)
   Solo calcula en memoria. No escribe ni elimina datos de Firebase. */
(function(){
'use strict';
const DAY_NAMES=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const PAID_REST_HOURS=8;
function isoLocal(value){const d=value instanceof Date?new Date(value):new Date(value||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function datesBetween(from,to){const out=[];if(!from||!to||from>to)return out;let d=new Date(from+'T12:00:00'),e=new Date(to+'T12:00:00');while(d<=e){out.push(isoLocal(d));d.setDate(d.getDate()+1)}return out}
function mark(day,type){return day?.[type]||Object.values(day||{}).find(v=>v&&v.tipo===type)||null}
function timestamp(v){return Number(v?.timestamp??v?.ts??v??0)||0}
function timeMinutes(raw,fallback){const m=String(raw||fallback||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0}
function schedule(emp={}){const h=emp.horario||{};return {entrada:h.entrada||emp.horaEntrada||'08:00',almuerzoSalida:h.almuerzoSalida||emp.horaAlmuerzoSalida||'12:00',almuerzoRegreso:h.almuerzoRegreso||emp.horaAlmuerzoRegreso||'13:00',salida:h.salida||emp.horaSalida||'17:00',diasLaborales:h.diasLaborales||emp.diasLaborales||null}}
function plannedHours(emp={}){const s=schedule(emp),a=timeMinutes(s.entrada,'08:00'),b=timeMinutes(s.salida,'17:00'),ls=timeMinutes(s.almuerzoSalida,'12:00'),lr=timeMinutes(s.almuerzoRegreso,'13:00');let lunch=(ls&&lr&&lr>ls)?(lr-ls)/60:0;let h=(b-a)/60-lunch;if(!Number.isFinite(h)||h<=0||h>16)h=8;return h}
function isHoliday(v){return v===true||!!(v&&v.activo!==false)}
function isPaidFree(v){return !!v&&v.activo!==false&&v.pagado!==false}
function isScheduledWorkday(emp,date){const d=new Date(date+'T12:00:00'),name=DAY_NAMES[d.getDay()],cfg=schedule(emp).diasLaborales;if(Array.isArray(cfg))return cfg.includes(name);if(cfg&&typeof cfg==='object')return !!cfg[name];return d.getDay()!==0}
function workHours(day){const en=timestamp(mark(day,'entrada')),sa=timestamp(mark(day,'salida'));if(!en||!sa||sa<=en)return 0;const ls=timestamp(mark(day,'almuerzo_salida')),lr=timestamp(mark(day,'almuerzo_regreso'));let lunch=(ls&&lr&&lr>ls)?(lr-ls)/36e5:0;const h=(sa-en)/36e5-lunch;return Number.isFinite(h)&&h>0?h:0}
function hourlyRate(emp={}){const s=Number(emp.salario||0),t=String(emp.tipoSalario||'diario').toLowerCase();if(t==='mensual')return s/(30*8);if(t==='quincenal')return s/(15*8);return s/8}
function calculateDay({employee={},date,day={},holiday=null,freeDay=null,paidSunday=true}={}){
 const planned=plannedHours(employee),rate=hourlyRate(employee),scheduled=isScheduledWorkday(employee,date),sunday=new Date(date+'T12:00:00').getDay()===0,holidayPaid=isHoliday(holiday),freePaid=isPaidFree(freeDay);
 const entry=timestamp(mark(day,'entrada')),exit=timestamp(mark(day,'salida')),complete=!!(entry&&exit&&exit>entry),worked=workHours(day);
 const paidRest=freePaid||holidayPaid||!scheduled;
 let regular=0,extra=0,missing=0,label='';
 if(paidRest&&!complete){
   regular=PAID_REST_HOURS;
   if(freePaid) label=freeDay?.motivo?`Libre pagado 8 h: ${freeDay.motivo}`:'Libre pagado 8 h';
   else if(holidayPaid) label=holiday?.motivo?`Feriado pagado 8 h: ${holiday.motivo}`:'Feriado pagado 8 h';
   else label=sunday&&paidSunday?'Domingo de descanso pagado 8 h':'Día de descanso pagado 8 h';
 }
 else if(!complete){missing=planned;label='Sin marcación completa (descuento)'}
 else {regular=Math.min(planned,worked);extra=Math.max(0,worked-planned);missing=scheduled?Math.max(0,planned-regular):0;if(holidayPaid)label=holiday?.motivo?`Feriado trabajado: ${holiday.motivo}`:'Feriado trabajado';else if(freePaid)label=freeDay?.motivo?`Libre trabajado: ${freeDay.motivo}`:'Libre trabajado';else if(!scheduled)label='Día no laborable trabajado'}
 return {date,planned,scheduled,complete,worked,regular,extra,missing,rate,pay:regular*rate,discount:missing*rate,label,entry,exit};
}
function calculatePeriod({employee={},employeeId='',from,to,marks={},holidays={},freeDays={},paidSunday=true}={}){const days=datesBetween(from,to).map(date=>calculateDay({employee,date,day:marks?.[employeeId]?.[date]||marks?.[date]||{},holiday:holidays?.[date]||null,freeDay:freeDays?.[employeeId]?.[date]||freeDays?.[date]||null,paidSunday}));return days.reduce((r,d)=>{r.worked+=d.worked;r.regular+=d.regular;r.extra+=d.extra;r.missing+=d.missing;r.pay+=d.pay;r.discount+=d.discount;r.expected+=d.scheduled?d.planned:0;r.scheduledDays+=d.scheduled?1:0;r.completeDays+=d.complete?1:0;return r},{days,worked:0,regular:0,extra:0,missing:0,pay:0,discount:0,expected:0,scheduledDays:0,completeDays:0,rate:hourlyRate(employee)})}
window.PoladentAttendance={isoLocal,datesBetween,mark,timestamp,schedule,plannedHours,isHoliday,isPaidFree,isScheduledWorkday,workHours,hourlyRate,calculateDay,calculatePeriod};
})();
