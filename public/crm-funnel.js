/* Edwin CRM · funnel overview. Uses only aggregated, tenant-scoped API data. */
(function(root){
 'use strict';
 const stageLabels=Object.freeze({new:'Nuevo',contacted:'Contactado',qualified:'Calificado',won:'Ganado',lost:'Perdido'});
 const sourceLabels=Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',organic:'Orgánico',referral:'Referidos',whatsapp:'WhatsApp',other:'Otro'});
 const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
 const format=n=>count(n).toLocaleString('es-PE');
 const percent=n=>typeof n==='number'&&Number.isFinite(n)?Math.min(100,Math.max(0,n)):0;
 function render(data,{loading=false,error=''}={}){
  if(loading)return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title"><h2 id="ed-funnel-title">Embudo por canal</h2><p role="status">Calculando oportunidades de la empresa…</p></section>';
  if(error)return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title"><h2 id="ed-funnel-title">Embudo por canal</h2><p role="status">El análisis del embudo no está disponible. El registro de contactos sigue funcionando.</p></section>';
  if(!data||typeof data!=='object')return '';
  const total=count(data.total),share=percent(data.won_share_percent);
  const stages=Object.entries(stageLabels).map(([key,label])=>'<div class="ed-funnel-stage"><small>'+label+'</small><strong>'+format(data.by_stage?.[key])+'</strong></div>').join('');
  const rows=Object.entries(sourceLabels)
   .filter(([key])=>count(data.by_source?.[key]?.total)>0)
   .map(([key,label])=>{
    const channel=data.by_source[key],won=count(channel.by_stage?.won),channelTotal=count(channel.total),p=percent(channel.won_share_percent);
    return '<tr><th scope="row">'+label+'</th><td>'+format(channelTotal)+'</td><td>'+format(won)+'</td><td><div class="ed-funnel-progress"><progress max="100" value="'+p+'" aria-label="Porcentaje ganado · '+label+'"></progress><span>'+p.toLocaleString('es-PE',{maximumFractionDigits:1})+' %</span></div></td></tr>';
   }).join('');
  const notice=data.partial?'<p class="ed-funnel-warning" role="status">Vista parcial: se resumen solo las 1.000 oportunidades más recientes. No representa el historial completo.</p>':'';
  return '<section class="card ed-funnel" aria-labelledby="ed-funnel-title">'+
   '<div class="ed-funnel-head"><div><h2 id="ed-funnel-title">Embudo por canal</h2><p>Registros de la empresa seleccionada, clasificados por origen declarado.</p></div><div class="ed-funnel-head-stat"><strong>'+format(total)+'</strong><small>Oportunidades analizadas</small></div></div>'+
   '<div class="ed-funnel-stages" aria-label="Distribución de etapas">'+stages+'</div>'+
   (total?'<div class="table-scroll"><table class="ed-funnel-table"><thead><tr><th>Origen</th><th>Total</th><th>Ganadas</th><th>Porcentaje ganado</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="crm-empty">Todavía no hay oportunidades para analizar. Registra tus primeros contactos para iniciar el embudo.</p>')+
   notice+'<p class="ed-funnel-disclaimer">El porcentaje ganado ('+share.toLocaleString('es-PE',{maximumFractionDigits:1})+' % general) compara estados de oportunidades registradas; no mide conversiones atribuibles a anuncios ni ingresos confirmados.</p>'+
   '</section>';
 }
 root.edwinCrmFunnel=Object.freeze({render});
})(globalThis);
