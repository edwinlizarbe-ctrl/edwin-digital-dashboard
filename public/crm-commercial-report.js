/* Edwin CRM C41-C45 — read-only commercial reporting. Never processes contact PII.
 * Numbers reflect recorded opportunities, not GA4/Ads attributed conversions.
 */
(function(root){
 'use strict';
 const MS=86400000;
 const validBusiness=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const stages=Object.freeze({new:'Nuevo',contacted:'Contactado',qualified:'Calificado',won:'Ganado',lost:'Perdido'});
 const sources=Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',organic:'Orgánico',referral:'Referidos',whatsapp:'WhatsApp',other:'Otro'});
 const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pad=date=>new Date(date).toISOString().slice(0,10);
 const empty=()=>({
  total:0,stages:Object.fromEntries(Object.keys(stages).map(k=>[k,0])),
  sources:Object.fromEntries(Object.keys(sources).map(k=>[k,0])),
  grid:Object.fromEntries(Object.keys(sources).map(source=>[source,Object.fromEntries(Object.keys(stages).map(stage=>[stage,0]))]))
 });
 function summarize(leads,businessId,{days=30,now=new Date(),partial=false}={}){
  if(!validBusiness.test(String(businessId||'')))throw new TypeError('Empresa inválida.');
  if(![7,30,90].includes(days))throw new TypeError('Período inválido.');
  const timestamp=new Date(now).getTime();
  if(!Number.isFinite(timestamp))throw new TypeError('Fecha de referencia inválida.');
  const today=new Date(timestamp);
  const dayEnd=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+1);
  const currentStart=dayEnd-days*MS,previousStart=currentStart-days*MS;
  const current=empty(),previous=empty();
  let loaded=0,undated=0,outside=0,unrecognizedStage=0;
  for(const lead of Array.isArray(leads)?leads:[]){
   if(!lead||lead.business_id!==businessId)continue;
   loaded++;
   const raw=String(lead.created_at||''),created=Date.parse(raw);
   if(!Number.isFinite(created)){undated++;continue;}
   const dest=created>=currentStart&&created<dayEnd?current:created>=previousStart&&created<currentStart?previous:null;
   if(!dest){outside++;continue;}
   const source=Object.hasOwn(sources,lead.source)?lead.source:'other';
   const stage=Object.hasOwn(stages,lead.stage)?lead.stage:null;
   dest.total++;dest.sources[source]++;
   if(stage){dest.stages[stage]++;dest.grid[source][stage]++;}
   else unrecognizedStage++;
  }
  const from=pad(currentStart),to=pad(dayEnd-MS),previousFrom=pad(previousStart),previousTo=pad(currentStart-MS);
  const comparable=!partial&&!undated&&!unrecognizedStage&&previous.total>0;
  const change=comparable?Math.round((current.total-previous.total)*1000/previous.total)/10:null;
  return {current,previous,days,from,to,previousFrom,previousTo,loaded,undated,outside,unrecognizedStage,partial:!!partial,comparable,change};
 }
 function csvCell(value){
  const raw=String(value??'');
  const neutral=/^\s*[=+\-@]/.test(raw)?"'"+raw:raw;
  return '"'+neutral.replace(/"/g,'""')+'"';
 }
 function csv(report){
  if(!report||!report.current||!Number.isSafeInteger(report.current.total))return '';
  const rows=[['Tipo','Origen','Etapa','Oportunidades','Inicio UTC','Fin UTC','Muestra parcial']];
  const add=(type,source,stage,total)=>rows.push([type,source,stage,count(total),report.from,report.to,report.partial?'Sí':'No']);
  add('Total','Todos','Todos',report.current.total);
  for(const [key,label] of Object.entries(stages))add('Etapa','Todos',label,report.current.stages[key]);
  for(const [key,label] of Object.entries(sources)){
   add('Canal',label,'Todas',report.current.sources[key]);
   for(const [stage,stageName] of Object.entries(stages)){
    const n=count(report.current.grid[key]?.[stage]);
    if(n)add('Canal y etapa',label,stageName,n);
   }
  }
  return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';
 }
 let scope='',days=30,visible=null;
 function render({leads,businessId,userId,loading=false,error='',partial=false}={}){
  const key=String(userId||'')+'|'+String(businessId||'');
  if(scope!==key){scope=key;days=30;visible=null;}
  if(!validBusiness.test(String(businessId||''))||!userId)return '';
  if(loading){visible=null;return '<section class="card ed-sales-report"><h2>Reporte comercial</h2><p role="status">Consultando oportunidades de esta empresa…</p></section>';}
  if(error){visible=null;return '<section class="card ed-sales-report"><h2>Reporte comercial</h2><p role="status">No se pudieron comprobar las oportunidades. No se generará un informe incompleto.</p></section>';}
  const report=summarize(leads,businessId,{days,partial});visible=report;
  const formatted=n=>count(n).toLocaleString('es-PE');
  const select=[7,30,90].map(n=>'<option value="'+n+'" '+(days===n?'selected':'')+'>'+n+' días</option>').join('');
  const rows=Object.entries(sources).filter(([key])=>report.current.sources[key]>0).map(([key,label])=>
   '<tr><th scope="row">'+label+'</th><td>'+formatted(report.current.sources[key])+'</td>'+
   '<td>'+formatted(report.current.grid[key].new)+'</td><td>'+formatted(report.current.grid[key].contacted)+'</td>'+
   '<td>'+formatted(report.current.grid[key].qualified)+'</td><td>'+formatted(report.current.grid[key].won)+'</td>'+
   '<td>'+formatted(report.current.grid[key].lost)+'</td></tr>'
  ).join('');
  const caveats=[];
  if(partial)caveats.push('Datos parciales: la lista de oportunidades está limitada a los registros cargados; no representa el histórico completo.');
  if(report.undated)caveats.push(formatted(report.undated)+' registros no tienen fecha válida y no entran en el período.');
  if(report.unrecognizedStage)caveats.push(formatted(report.unrecognizedStage)+' registros tienen etapa no reconocida; no se asignan a ninguna etapa artificialmente.');
  caveats.push('Las etapas reflejan el estado actual de oportunidades creadas en estas fechas; no demuestran que se hayan ganado durante el período.');
  caveats.push('Orígenes declarados manualmente. No son conversiones atribuidas ni ingresos confirmados por Google o Meta.');
  const comparison=report.comparable?
   'Período anterior: '+formatted(report.previous.total)+' oportunidades ('+report.previousFrom+' a '+report.previousTo+' UTC). Variación del volumen registrado: '+(report.change>0?'+':'')+report.change.toLocaleString('es-PE',{maximumFractionDigits:1})+' %.':
   'Comparación porcentual no disponible: '+(partial?'muestra parcial':report.undated?'fechas incompletas':report.unrecognizedStage?'etapas no reconocidas':'sin oportunidades en el período anterior')+'.';
  return '<section class="card ed-sales-report" aria-labelledby="ed-sales-report-title">'+
   '<div class="ed-sales-report-head"><div><h2 id="ed-sales-report-title">Informe comercial por origen y etapa</h2>'+
   '<p>Fuente: oportunidades registradas en Edwin CRM para la empresa seleccionada. Fechas de creación en UTC.</p></div>'+
   '<label>Período<select class="simple-input" id="ed-sales-report-period" aria-label="Período del reporte">'+select+'</select></label></div>'+
   '<div class="ed-sales-report-summary"><strong>'+formatted(report.current.total)+' oportunidades</strong>'+
   '<span>'+report.from+' al '+report.to+' UTC · '+formatted(report.loaded)+' registros cargados</span></div>'+
   (report.current.total?'<div class="table-scroll"><table class="ed-sales-report-table"><thead><tr><th>Origen declarado</th><th>Total</th><th>Nuevo</th><th>Contactado</th><th>Calificado</th><th>Ganado</th><th>Perdido</th></tr></thead><tbody>'+rows+'</tbody></table></div>':
    '<p class="ed-sales-report-empty">No hay oportunidades creadas en este período dentro de los registros cargados.</p>')+
   '<p class="ed-sales-report-comparison">'+comparison+'</p>'+
   '<ul class="ed-sales-report-notes">'+caveats.map(x=>'<li>'+x+'</li>').join('')+'</ul>'+
   '<button type="button" class="button button-outline" data-ed-sales-report-export '+(report.current.total?'':'disabled')+'>Exportar CSV agregado</button>'+
   '<p id="ed-sales-report-status" role="status" aria-live="polite">El CSV contiene solo cifras agregadas, fechas y nombres fijos de categorías; nunca contactos.</p>'+
   '</section>';
 }
 if(typeof document!=='undefined'){
  document.addEventListener('change',e=>{
   if(e.target?.id!=='ed-sales-report-period')return;
   const v=Number(e.target.value);
   if(![7,30,90].includes(v))return;
   days=v;root.dispatchEvent(new Event('edwin:report-period'));
  });
  document.addEventListener('click',e=>{
   const button=e.target.closest?.('[data-ed-sales-report-export]');
   if(!button||!visible||!visible.current.total)return;
   const body=csv(visible);if(!body)return;
   const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));
   const anchor=document.createElement('a');
   anchor.href=url;anchor.download='edwin-crm-reporte-comercial.csv';
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
 }
 root.edwinCommercialReport=Object.freeze({summarize,csv,csvCell,render});
})(globalThis);
