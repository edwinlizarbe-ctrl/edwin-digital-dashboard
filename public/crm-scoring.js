/* Edwin CRM G03 — rule-based commercial work queue; no AI or conversion prediction. */
(function(root){
 'use strict';
 const weights=Object.freeze({qualified:65,new:55,contacted:40});
 const labels=Object.freeze({qualified:'Calificado',new:'Nuevo',contacted:'Contactado'});
 const explanations=Object.freeze({
  qualified:'Etapa calificada: revisar siguiente paso comercial',
  new:'Sin primer contacto registrado',
  contacted:'Contacto iniciado: continuar seguimiento'
 });
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function score(lead,now=Date.now()){
  const stage=String(lead?.stage||'');
  if(!Object.hasOwn(weights,stage))return {score:0,active:false,reasons:[]};
  let points=weights[stage],reasons=[explanations[stage]];
  const created=Date.parse(String(lead.created_at||''));
  if(Number.isFinite(created)&&created<=now){
   const ageDays=Math.floor((now-created)/86400000);
   if(ageDays>=14){points+=15;reasons.push('Registrado hace 14 días o más');}
   else if(ageDays>=3){points+=8;reasons.push('Registrado hace 3 días o más');}
  }
  if(Boolean(String(lead.email||'').trim()||String(lead.phone||'').trim())){
   points+=10;reasons.push('Dispone de un medio de contacto');
  }
  if(Boolean(String(lead.notes||'').trim())){points+=5;reasons.push('Incluye contexto comercial');}
  return {score:Math.min(95,points),active:true,reasons,stage:labels[stage]};
 }
 function priority(leads,now=Date.now()){
  if(!Array.isArray(leads))return [];
  return leads.map((lead,index)=>({lead,index,rating:score(lead,now)}))
   .filter(item=>item.rating.active)
   .sort((a,b)=>b.rating.score-a.rating.score||a.index-b.index);
 }
 function render(leads,{partial=false,loading=false}={}){
  if(loading)return '';
  const queue=priority(leads);
  if(!queue.length)return '';
  const items=queue.slice(0,5).map(({lead,rating})=>
   '<li class="ed-priority-item"><div><strong>'+esc(String(lead.name||'Contacto').slice(0,120))+
   '</strong><small>'+esc(rating.stage)+' · '+esc(rating.reasons.join(' · '))+
   '</small></div><span class="ed-priority-score" aria-label="Prioridad '+rating.score+' de 95 puntos">'+rating.score+'/95</span></li>').join('');
  return '<section class="card ed-priority" aria-labelledby="ed-priority-title">'+
   '<div class="ed-priority-head"><h2 id="ed-priority-title">Prioridad de seguimiento</h2><span>'+queue.length+' oportunidades abiertas en la lista</span></div>'+
   '<p>Orden sugerido por etapa, antigüedad del registro y disponibilidad de contacto. Cada puntuación explica sus reglas.</p>'+
   '<ol class="ed-priority-list">'+items+'</ol>'+
   '<p class="ed-priority-note">Reglas internas, no inteligencia artificial ni probabilidad de venta. Solo se analizan los registros cargados'+(partial?' (lista parcial)':'')+'. No se envían mensajes automáticamente.</p>'+
   '</section>';
 }
 root.edwinCrmScoring=Object.freeze({score,priority,render});
})(globalThis);
