/* Edwin CRM: 10 deterministic sales-data hygiene checks. No PII, API calls or writes. */
(function(root){
 'use strict';
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const text=v=>String(v??'').trim();
 const missing=v=>!text(v);
 const recent=(lead,now,days)=>{
  const updated=Date.parse(text(lead.updated_at||lead.created_at));
  return Number.isFinite(updated)&&updated<=now&&now-updated>=days*86400000;
 };
 const phoneDigits=v=>text(v).replace(/\D/g,'');
 const emailValid=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v));
 const audits=Object.freeze([
  {id:'C01',label:'Nuevos sin contacto reciente',hint:'Revisa oportunidades nuevas sin cambios desde hace 3 días.',check:(l,now)=>l.stage==='new'&&recent(l,now,3)},
  {id:'C02',label:'Contactados sin avance',hint:'Revisa contactos sin cambios desde hace 7 días.',check:(l,now)=>l.stage==='contacted'&&recent(l,now,7)},
  {id:'C03',label:'Calificados en espera',hint:'Prioriza oportunidades calificadas sin cambios desde hace 7 días.',check:(l,now)=>l.stage==='qualified'&&recent(l,now,7)},
  {id:'C04',label:'Sin medio de contacto',hint:'Completa un correo o teléfono para poder dar seguimiento.',check:l=>missing(l.email)&&missing(l.phone)},
  {id:'C05',label:'Correo por revisar',hint:'Comprueba el formato de los correos registrados.',check:l=>!missing(l.email)&&!emailValid(l.email)},
  {id:'C06',label:'Teléfono por revisar',hint:'Revisa teléfonos con menos de 9 o más de 15 dígitos.',check:l=>!missing(l.phone)&&(phoneDigits(l.phone).length<9||phoneDigits(l.phone).length>15)},
  {id:'C07',label:'Pauta sin campaña declarada',hint:'Identifica las campañas de oportunidades de anuncios.',check:l=>['google_ads','meta_ads'].includes(l.source)&&missing(l.campaign)},
  {id:'C08',label:'Origen por precisar',hint:'Completa la fuente de los registros clasificados como Otro.',check:l=>l.source==='other'},
  {id:'C09',label:'Cierre sin importe registrado',hint:'Si corresponde a una venta monetaria, comprueba el importe.',check:l=>l.stage==='won'&&(l.amount===null||l.amount===undefined||l.amount==='')},
  {id:'C10',label:'Calificados sin contexto',hint:'Añade notas internas útiles antes de la siguiente gestión.',check:l=>l.stage==='qualified'&&missing(l.notes)}
 ]);
 function analyze(leads,businessId,{now=Date.now(),partial=false}={}){
  if(!uuid.test(String(businessId||''))||!Array.isArray(leads))return {total:0,partial:!!partial,checks:audits.map(a=>({id:a.id,label:a.label,hint:a.hint,count:0}))};
  // Caller provides an authorized list; enforce business isolation again before aggregation.
  const own=leads.filter(l=>l&&l.business_id===businessId);
  const current=Number.isFinite(now)?now:Date.now();
  return {total:own.length,partial:!!partial,checks:audits.map(a=>({
   id:a.id,label:a.label,hint:a.hint,count:own.filter(l=>a.check(l,current)).length
  }))};
 }
 function render(report,{loading=false}={}){
  if(loading||!report||!Array.isArray(report.checks))return '';
  const n=report.checks.reduce((sum,r)=>sum+(r.count>0?1:0),0);
  const view=item=>'<li class="ed-quality-item"><div><strong>'+item.label+'</strong><p>'+item.hint+'</p></div><span class="ed-quality-count" aria-label="'+item.count+' oportunidades">'+item.count+'</span></li>';
  const sorted=[...report.checks].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
  return '<section class="card ed-quality" aria-labelledby="ed-quality-title">'+
   '<div class="ed-quality-heading"><div><h2 id="ed-quality-title">Diagnóstico comercial · 10 controles</h2>'+
   '<p>Señales basadas en registros de la empresa seleccionada, sin predicción de ventas.</p></div>'+
   '<strong>'+n+' de 10 con hallazgos</strong></div>'+
   (report.total?'<ul class="ed-quality-list">'+sorted.slice(0,4).map(view).join('')+'</ul>'+
    '<details class="ed-quality-more"><summary>Consultar los 10 controles</summary><ul class="ed-quality-list">'+report.checks.map(view).join('')+'</ul></details>':
    '<p class="ed-quality-empty">Todavía no hay contactos para evaluar en esta empresa.</p>')+
   (report.partial?'<p class="ed-quality-warning">Muestra parcial: solo se revisan los contactos cargados, no todo el historial.</p>':'')+
   '<p class="ed-quality-footnote">Los indicadores son advertencias para revisión humana. No modifican contactos, no envían mensajes ni representan conversiones confirmadas.</p>'+
   '</section>';
 }
 root.edwinCrmQuality=Object.freeze({analyze,render,ids:audits.map(x=>x.id)});
})(globalThis);
