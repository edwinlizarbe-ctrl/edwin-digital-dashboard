/* Edwin CRM G11 — local UTM campaign links. Does not contact external services. */
(function(root){
 'use strict';
 const fields=['url','source','medium','campaign','content','term'];
 const sourcePresets=Object.freeze({google:'Google',meta:'Meta',newsletter:'Newsletter',linkedin:'LinkedIn',referral:'Referidos'});
 function presetSource(key){if(!Object.hasOwn(sourcePresets,key))throw Error('Origen predefinido no válido.');return key;}
 const mediumPresets=Object.freeze({cpc:'CPC',paid_social:'Anuncios en redes',email:'Correo electrónico',organic_social:'Redes orgánicas',referral:'Referidos'});
 function presetMedium(key){if(!Object.hasOwn(mediumPresets,key))throw Error('Medio predefinido no válido.');return key;}
 function missingRequired(data){
  return [['url','URL HTTPS'],['source','origen'],['medium','medio'],['campaign','campaña']]
   .filter(([key])=>!String(data?.[key]??'').trim()).map(([,label])=>label);
 }
 function normalizeCampaignName(value){
  if(typeof value!=='string'||value.length>200||/[\u0000-\u001f\u007f]/.test(value))
   throw Error('Escribe un nombre de campaña válido (máximo 200 caracteres).');
  const label=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
   .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,100).replace(/_+$/,'');
  if(!label)throw Error('Escribe un nombre de campaña con letras o números.');
  return label;
 }
 function preview(link){
  if(!link)return null;
  const url=new URL(link);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('Solo vistas previas HTTPS seguras.');
  const labels=['source','medium','campaign','content','term']
   .filter(key=>url.searchParams.has('utm_'+key));
  return {destination:url.hostname,route:url.pathname,labels,fragment:!!url.hash};
 }
 const draft=Object.fromEntries(fields.map(key=>[key,'']));
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function build(data){
  const raw=String(data?.url??'').trim();
  if(!raw||raw.length>1800||/[\u0000-\u001f\u007f]/.test(raw))throw Error('Ingresa una URL válida de hasta 1800 caracteres.');
  let url;
  try{url=new URL(raw);}catch{throw Error('Ingresa una URL absoluta que empiece con https://');}
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)
   throw Error('Utiliza una dirección HTTPS sin usuario ni contraseña en la URL.');
  const required=['source','medium','campaign'];
  for(const key of fields.slice(1)){
   const value=String(data?.[key]??'').trim();
   if(value.length>100||/[\u0000-\u001f\u007f]/.test(value))
    throw Error('Los parámetros UTM deben tener máximo 100 caracteres y no contener saltos de línea.');
   if(required.includes(key)&&!value)throw Error('Completa origen, medio y campaña antes de generar el enlace.');
   if(value)url.searchParams.set('utm_'+key,value);
   else url.searchParams.delete('utm_'+key);
  }
  const result=url.toString();
  if(result.length>2048)throw Error('El enlace generado supera los 2048 caracteres.');
  return result;
 }
 function render(){
  let link='';
  try{link=build(draft);}catch{}
  const field=(name,label,placeholder,required=false)=>
   '<label>'+label+'<input class="simple-input" name="'+name+'" value="'+esc(draft[name])+
   '" maxlength="'+(name==='url'?1800:100)+'" placeholder="'+placeholder+'" '+(required?'required':'')+'></label>';
  return '<section class="card ed-utm-builder" aria-labelledby="ed-utm-title"><div class="ed-utm-heading"><h2 id="ed-utm-title">Constructor de enlaces UTM</h2><p>Prepara enlaces para medir campañas. Se generan en este navegador; no se publica ni se envía nada.</p></div>'+
   '<form id="ed-utm-builder" novalidate>'+
   '<div class="ed-utm-grid">'+
   field('url','URL de destino HTTPS','https://tuempresa.com/landing',true)+
   field('source','Origen (utm_source)','google, meta, newsletter',true)+
    '<div class="ed-utm-presets" role="group" aria-label="Orígenes sugeridos">'+Object.entries(sourcePresets).map(([key,label])=>'<button type="button" class="button button-outline" data-ed-utm-source="'+key+'">'+label+'</button>').join('')+'</div>'+
   field('medium','Medio (utm_medium)','cpc, paid_social, email',true)+
   '<div class="ed-utm-presets" role="group" aria-label="Medios sugeridos">'+Object.entries(mediumPresets).map(([key,label])=>'<button type="button" class="button button-outline" data-ed-utm-medium="'+key+'">'+label+'</button>').join('')+'</div>'+
   field('campaign','Campaña (utm_campaign)','cyber_wow_noviembre',true)+
   '<div class="ed-utm-campaign-tools"><button type="button" class="button button-outline" data-ed-utm-normalize>Normalizar nombre de campaña</button><small>Convierte nombres como «Cyber WOW Noviembre» en cyber_wow_noviembre.</small></div>'+
   field('content','Contenido (opcional)','video_a, banner_b')+
   field('term','Término (opcional)','busqueda_producto')+
   '</div><p id="ed-utm-required" class="ed-utm-required" role="status" aria-live="polite">'+(missingRequired(draft).length?'Por completar: '+esc(missingRequired(draft).join(', '))+'.':'Parámetros obligatorios completos.')+'</p><label for="ed-utm-result">Enlace generado</label>'+
   '<textarea id="ed-utm-result" class="simple-input" rows="2" readonly aria-describedby="ed-utm-status">'+esc(link)+'</textarea>'+
   '<p id="ed-utm-preview" class="ed-utm-preview" role="status">'+(link?'Destino: '+esc(preview(link).destination)+' · '+esc(preview(link).route)+' · '+preview(link).labels.length+' etiquetas UTM':'La vista previa del destino y las etiquetas aparecerá al completar el enlace.')+'</p>'+
   '<div class="ed-utm-footer"><p id="ed-utm-status" role="status" aria-live="polite">'+(link?'Enlace listo para copiar.':'Completa los campos obligatorios para generar el enlace.')+'</p>'+
   '<button class="button button-primary" type="button" data-ed-utm-copy '+(link?'':'disabled')+'>Copiar enlace</button></div>'+
   '</form><p class="ed-utm-note">Conserva otros parámetros y fragmentos de la URL. Etiquetar enlaces no garantiza medición hasta que el sitio y GA4 estén configurados.</p></section>';
 }
 function update(form){
  for(const key of fields)draft[key]=String(form.elements.namedItem(key)?.value||'');
  const output=form.querySelector('#ed-utm-result'),status=form.querySelector('#ed-utm-status'),button=form.querySelector('[data-ed-utm-copy]');
  const required=form.querySelector('#ed-utm-required'),previewLabel=form.querySelector('#ed-utm-preview');
  if(required){const missing=missingRequired(draft);required.textContent=missing.length?'Por completar: '+missing.join(', ')+'.':'Parámetros obligatorios completos.';}
  try{
   const link=build(draft);
   output.value=link;button.disabled=false;status.textContent='Enlace listo para copiar.';
   if(previewLabel){const p=preview(link);previewLabel.textContent='Destino: '+p.destination+' · '+p.route+' · '+p.labels.length+' etiquetas UTM'+(p.fragment?' · conserva fragmento':'')+'.';}
  }catch(error){output.value='';button.disabled=true;status.textContent=error.message;
   if(previewLabel)previewLabel.textContent='Completa un enlace HTTPS válido para ver la vista previa.';}
 }
 if(typeof document!=='undefined'){
  document.addEventListener('input',event=>{
   const form=event.target.closest?.('#ed-utm-builder');
   if(form)update(form);
  });
  document.addEventListener('submit',event=>{
   if(event.target?.id==='ed-utm-builder'){event.preventDefault();update(event.target);}
  });
  document.addEventListener('click',async event=>{
   const presetButton=event.target.closest?.('[data-ed-utm-source]');
   if(presetButton){
    const form=presetButton.closest('#ed-utm-builder');
    const source=form?.elements.namedItem('source');
    if(!source)return;
    try{source.value=presetSource(presetButton.dataset.edUtmSource);update(form);}catch{}
    return;
   }
   const mediumButton=event.target.closest?.('[data-ed-utm-medium]');
   if(mediumButton){
    const form=mediumButton.closest('#ed-utm-builder');
    const medium=form?.elements.namedItem('medium');
    if(!medium)return;
    try{medium.value=presetMedium(mediumButton.dataset.edUtmMedium);update(form);}catch{}
    return;
   }
   const normalizeButton=event.target.closest?.('[data-ed-utm-normalize]');
   if(normalizeButton){
    const form=normalizeButton.closest('#ed-utm-builder');
    const campaign=form?.elements.namedItem('campaign'),status=form?.querySelector('#ed-utm-status');
    if(!campaign)return;
    try{campaign.value=normalizeCampaignName(campaign.value);update(form);}catch(error){if(status)status.textContent=error.message;}
    return;
   }
   const button=event.target.closest?.('[data-ed-utm-copy]');
   if(!button)return;
   const form=button.closest('#ed-utm-builder'),output=form?.querySelector('#ed-utm-result'),status=form?.querySelector('#ed-utm-status');
   if(!output?.value)return;
   try{
    if(!root.navigator?.clipboard?.writeText)throw Error('clipboard unavailable');
    await root.navigator.clipboard.writeText(output.value);
    status.textContent='Enlace copiado. Puedes usarlo en tu campaña.';
   }catch{status.textContent='No se pudo copiar automáticamente. Selecciona el enlace para copiarlo manualmente.';}
  });
 }
 root.edwinUtmBuilder=Object.freeze({build,render,presetSource,sourcePresets,presetMedium,mediumPresets,missingRequired,normalizeCampaignName,preview});
})(globalThis);
