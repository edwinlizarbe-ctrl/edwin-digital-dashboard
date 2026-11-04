/* Edwin CRM · funnel overview. Uses only aggregated, tenant-scoped API data. */
(function(root){
 'use strict';
 const stageLabels=Object.freeze({new:'Nuevo',contacted:'Contactado',qualified:'Calificado',won:'Ganado',lost:'Perdido'});
 const sourceLabels=Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',organic:'Orgánico',referral:'Referidos',whatsapp:'WhatsApp',other:'Otro'});
 const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
 const format=n=>count(n).toLocaleString('es-PE');
 const percent=n=>typeof n==='number'&&Number.isFinite(n)?Math.min(100,Math.max(0,n)):0;
 const stageRate=(part,total)=>total>0?Math.round(1000*count(part)/total)/10:0;
 // C29-C30: comparison uses only the authenticated, aggregated source summary.
 // This is composition of registered opportunities, not ad conversion attribution.
 function coverage(data){
  const total=count(data?.total);
  const channels=Object.entries(sourceLabels).map(([source,label])=>{
   const amount=Math.min(count(data?.by_source?.[source]?.total),total);
   const percentOfSample=total?Math.round(amount/total*1000)/10:0;
   return {source,label,total:amount,percentOfSample};
  }).filter(entry=>entry.total>0).sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,'es'));
  const warnings=[];
  if(data?.partial)warnings.push('Cobertura parcial: solo se analizaron hasta 1.000 oportunidades recientes. No representa el historial completo.');
  if(total>0&&total<20)warnings.push('Muestra pequeña: menos de 20 oportunidades. Evita conclusiones definitivas sobre los canales.');
  const other=channels.find(c=>c.source==='other');
  if(other)warnings.push(other.total+' oportunidades están en la categoría Otro; conviene revisar su origen declarado.');
  if(total>0)warnings.push('Sin filtro de período: no compares estos porcentajes con gastos o resultados publicitarios de fechas diferentes.');
  return {total,channels,warnings,partial:!!data?.partial};
 }
 function renderCoverage(data){
  const summary=coverage(data);
  if(!summary.total)return '';
  const rows=summary.channels.map(item=>
   '<li class="ed-coverage-row"><div><strong>'+item.label+'</strong>'+
   '<small>'+format(item.total)+' oportunidades · '+item.percentOfSample.toLocaleString('es-PE',{maximumFractionDigits:1})+' % de la muestra</small></div>'+
   '<progress max="100" value="'+item.percentOfSample+'" aria-label="Participación de '+item.label+' en oportunidades registradas"></progress></li>'
  ).join('');
  const warnings=summary.warnings.length?'<ul class="ed-coverage-warnings">'+summary.warnings.map(w=>'<li>'+w+'</li>').join('')+'</ul>':'';
  return '<section class="ed-coverage" aria-labelledby="ed-coverage-title">'+
   '<h3 id="ed-coverage-title">Participación de oportunidades por canal</h3>'+
   '<p>Compara el volumen de registros por origen declarado, sin atribuir conversiones ni ingresos a anuncios.</p>'+
   '<ol class="ed-coverage-list">'+rows+'</ol>'+
   warnings+'</section>';
 }
 let visibleReport=null;
 // This export is built exclusively from aggregated API counters; no lead PII.
 function csv(data){
  if(!data||typeof data!=='object'||!count(data.total))return '';
  const header=['Origen','Total','Nuevo','Contactado','Calificado','Ganado','Perdido','Porcentaje ganado','Muestra parcial'];
  const lines=[header.join(';')];
  for(const [key,label] of Object.entries(sourceLabels)){
   const channel=data.by_source?.[key],total=count(channel?.total);
   if(!total)continue;
   const counts=Object.keys(stageLabels).map(stage=>count(channel.by_stage?.[stage]));
   const share=percent(channel.won_share_percent).toLocaleString('es-PE',{maximumFractionDigits:1});
   lines.push([label,total,...counts,share,data.partial?'Sí':'No'].join(';'));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
 }

 function render(data,{loading=false,error=''}={}){
  if(loading)return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title"><h2 id="ed-funnel-title">Embudo por canal</h2><p role="status">Calculando oportunidades de la empresa…</p></section>';
  if(error)return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title"><h2 id="ed-funnel-title">Embudo por canal</h2><p role="status">El análisis del embudo no está disponible. El registro de contactos sigue funcionando.</p></section>';
  if(!data||typeof data!=='object'){visibleReport=null;return '';}
  visibleReport=data;
  const total=count(data.total),share=percent(data.won_share_percent);
  const stages=Object.entries(stageLabels).map(([key,label])=>'<div class="ed-funnel-stage"><small>'+label+'</small><strong>'+format(data.by_stage?.[key])+'</strong><small>'+stageRate(data.by_stage?.[key],total).toLocaleString('es-PE')+' % del total</small></div>').join('');
  const rows=Object.entries(sourceLabels)
   .filter(([key])=>count(data.by_source?.[key]?.total)>0)
   .map(([key,label])=>{
    const channel=data.by_source[key],won=count(channel.by_stage?.won),channelTotal=count(channel.total),p=percent(channel.won_share_percent);
    const distribution=Object.keys(stageLabels).map(stage=>'<td>'+stageRate(channel.by_stage?.[stage],channelTotal).toLocaleString('es-PE')+' %</td>').join('');
    return '<tr><th scope="row">'+label+'</th><td>'+format(channelTotal)+'</td>'+distribution+'<td><div class="ed-funnel-progress"><progress max="100" value="'+p+'" aria-label="Porcentaje ganado · '+label+'"></progress><span>'+p.toLocaleString('es-PE',{maximumFractionDigits:1})+' %</span></div></td></tr>';
   }).join('');
  const notice=data.partial?'<p class="ed-funnel-warning" role="status">Vista parcial: se resumen solo las 1.000 oportunidades más recientes. No representa el historial completo.</p>':'';
  return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title">'+
   '<div class="ed-funnel-head"><div><h2 id="ed-funnel-title">Embudo por canal</h2><p>Registros de la empresa seleccionada, clasificados por origen declarado.</p></div><div class="ed-funnel-head-stat"><strong>'+format(total)+'</strong><small>Oportunidades analizadas</small></div></div>'+
   '<div class="ed-funnel-stages" aria-label="Distribución de etapas">'+stages+'</div>'+
   renderCoverage(data)+
   (total?'<div class="table-scroll"><table class="ed-funnel-table"><thead><tr><th>Origen</th><th>Total</th>'+Object.values(stageLabels).map(label=>'<th>'+label+' (% del canal)</th>').join('')+'<th>Porcentaje ganado</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="crm-empty">Todavía no hay oportunidades para analizar. Registra tus primeros contactos para iniciar el embudo.</p>')+
   notice+(total?'<div class="ed-funnel-actions"><button class="button button-outline" type="button" data-ed-funnel-export>Descargar CSV agregado</button></div>':'')+'<p class="ed-funnel-disclaimer">Los porcentajes por etapa se calculan sobre las oportunidades del mismo canal, no sobre transiciones históricas. El porcentaje ganado ('+share.toLocaleString('es-PE',{maximumFractionDigits:1})+' % general) compara estados de oportunidades registradas; no mide conversiones atribuibles a anuncios ni ingresos confirmados.</p>'+
   '</section>';
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-ed-funnel-export]');
   if(!button||!visibleReport)return;
   const body=csv(visibleReport);if(!body)return;
   const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');
   link.href=url;link.download='edwin-crm-embudo-por-canal.csv';
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
 }
 root.edwinCrmFunnel=Object.freeze({render,csv,coverage,renderCoverage});
})(globalThis);
