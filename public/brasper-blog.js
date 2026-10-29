(function(){
 'use strict';
 let result='',lastBusiness='',device='desktop';
 const $=id=>document.getElementById(id);
 const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const show=(msg,error=false)=>{
  const node=$('bp-generator-status');if(node){node.textContent=msg;node.dataset.error=error?'true':'false';}
 };
 // Deterministic, local helpers. No network, no AI, nothing is rewritten.
 const detectLanguage=text=>/(\b(você|vocês|não|também|saiba|envio|dinheiro|reais|cotação|brasileiro|transferências|artigos)\b|\b(para o|para a|com o|do brasil|no brasil)\b)/i.test(' '+String(text||'').toLowerCase()+' ')?'pt':'es';
 const parseRelated=text=>String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 function editorialStats(article,language='auto',relatedText=''){
  const text=String(article||'').replace(/\r\n?/g,'\n');
  const plain=text.replace(/\[([^\]\n]+)\]\([^)\s]*\)/g,'$1').replace(/[#*_]/g,' ');
  const words=(plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)||[]).length;
  const lines=text.split('\n').map(x=>x.trim());
  const first=lines.find(Boolean)||'';
  const subtitles=lines.filter(x=>/^#{2,3}\s+\S/.test(x)).length;
  const related=parseRelated(relatedText).filter(x=>x.indexOf('|')>=2).length;
  const inlineLinks=(text.match(/\[[^\]\n]+\]\(https:\/\/[^)\s]+\)/g)||[]).length;
  const explicit=['es','pt'].includes(language);
  return {words,subtitles,related,inlineLinks,hasTitle:first.replace(/^#{1,3}\s*/,'').replace(/\*/g,'').trim().length>=2,
   language:explicit?language:(words?detectLanguage(text):''),languageSource:explicit?'selected':'detected'};
 }
 const LANG_NAMES={es:'Español',pt:'Português'};
 function statsMarkup(st){
  const item=(label,value)=>'<div class="bp-stat"><dt>'+label+'</dt><dd>'+value+'</dd></div>';
  const ok=(pass,label)=>'<li data-ok="'+(pass?'true':'false')+'"><span aria-hidden="true">'+(pass?'✓':'○')+'</span> '+label+'</li>';
  const lang=st.language?LANG_NAMES[st.language]+(st.languageSource==='selected'?' (elegido)':' (detectado)'):'—';
  return '<dl class="bp-stats">'+item('Palabras',st.words)+item('Subtítulos',st.subtitles)+item('Enlaces relacionados',st.related)+item('Idioma',lang)+'</dl>'+
   '<ul class="bp-checklist" aria-label="Lista de verificación informativa">'+
   ok(st.hasTitle,'Empieza con un título')+ok(st.subtitles>0,'Incluye al menos un subtítulo (## o ###)')+
   ok(st.related>0,st.related>0?'Enlaces relacionados propios':'Sin enlaces propios: se usarán artículos reales de Brásper')+
   ok(st.words>=300,'300 palabras o más (referencia editorial, no es una nota SEO)')+'</ul>'+
   '<p class="bp-tool-detail">Cálculo local sobre tu texto. No es una puntuación de Google ni de SEO.</p>';
 }
 function refreshStats(){
  const form=$('bp-blog-form'),box=$('bp-stats');if(!form||!box)return;
  const d=new FormData(form);
  box.innerHTML=statsMarkup(editorialStats(d.get('article'),String(d.get('language')||'auto'),d.get('related')));
 }
 function applyDevice(next){
  device=next==='mobile'?'mobile':'desktop';
  const chrome=$('bp-preview-chrome');if(chrome)chrome.dataset.device=device;
  document.querySelectorAll('[data-bp-device]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.bpDevice===device?'true':'false'));
 }
 // Only a coarse server state is rendered; "Invitar a Ana" exists solely when no profile exists.
 function accessMarkup(state){
  const head='<div><b>Acceso editorial de Ana</b>';
  if(state==='active')return head+'<p>Acceso editorial activo · únicamente Blog de Brásper.</p></div><span class="bp-access-badge" data-state="active">Activo</span>';
  if(state==='invite')return head+'<p>Aún no existe la cuenta. Invitación segura a marketing.brasper@gmail.com · únicamente Blog de Brásper.</p></div><button type="button" class="button button-outline" id="bp-invite-ana">Invitar a Ana</button><span id="bp-invite-feedback" role="status" aria-live="polite"></span>';
  if(state==='review')return head+'<p>La cuenta existe, pero su rol o membresías no son los esperados. Revisa los permisos en Supabase; no se invita ni se modifica nada automáticamente.</p></div><span class="bp-access-badge" data-state="review">Revisar permisos</span>';
  if(state==='loading')return head+'<p>Verificando el acceso editorial…</p></div>';
  return head+'<p>No se pudo verificar el acceso editorial. Por seguridad no se ofrece ninguna acción.</p></div><span class="bp-access-badge" data-state="error">Sin verificar</span>';
 }
 async function loadAccess(){
  const box=$('bp-editor-access');if(!box)return;
  const mine=lastBusiness;let state='error';
  try{
   const r=await fetch('/api/admin/blog-editor/status',{credentials:'same-origin',headers:{Accept:'application/json'}});
   const data=await r.json();
   if(r.ok&&data?.ok&&['active','invite','review'].includes(data.state))state=data.state;
  }catch{}
  const node=$('bp-editor-access');
  if(node&&mine===lastBusiness)node.innerHTML=accessMarkup(state);
 }
 window.edwinBrasperBlog={
  stats:editorialStats,detectLanguage,accessMarkup,loadAccess,
  page:(businessId,isAdmin=false)=>{
   result='';lastBusiness=businessId||'';device='desktop';
   if(isAdmin)setTimeout(loadAccess,0);
   return '<div class="bp-tool"><div class="bp-tool-hero"><div><span class="bp-tool-eyebrow">BRÁSPER · ESTUDIO EDITORIAL</span><h1>Estudio editorial Brásper</h1><p>Convierte textos de Brásper en HTML listo para revisar, copiar y pegar. Sin reescribir tus palabras ni utilizar inteligencia artificial.</p></div><span class="bp-tool-label">GENERADOR HTML</span></div>'+
   (isAdmin?'<div class="bp-invite-admin" id="bp-editor-access" aria-live="polite">'+accessMarkup('loading')+'</div>':'')+
   '<div class="bp-tool-grid"><section class="card bp-tool-editor"><div class="bp-tool-head"><span class="bp-tool-index">01</span><div><h2>Pega tu blog completo</h2><p>Un solo campo. Conservamos el texto y detectamos automáticamente español o portugués.</p></div></div>'+
   '<form id="bp-blog-form" data-business-id="'+clean(businessId)+'">'+
   '<label>Artículo completo<textarea name="article" class="simple-input bp-article-input" maxlength="60000" required placeholder="Pega aquí TODO el artículo, incluido el título, los subtítulos y las listas."></textarea></label>'+
   '<label>Idioma de publicación<select name="language" class="simple-input"><option value="auto">Detectar automáticamente</option><option value="es">Español (Perú)</option><option value="pt">Português (Brasil)</option></select></label>'+
   '<label>Artículos relacionados (opcional, hasta 7)<textarea name="related" class="simple-input" rows="4" maxlength="4500" placeholder="Título del artículo | https://brasper.com/es/blog/ejemplo"></textarea></label>'+
   '<p class="bp-tool-detail">Si no agregas enlaces relacionados, se mostrarán artículos reales de Brasper. Cada línea personalizada lleva un título y su URL separados por |.</p>'+
   '<p class="bp-tool-detail">Solo convertimos el texto al formato editorial de Brásper: azul y morado, con enlaces de Brásper y PIX; nunca enlazamos bancos. No cambiamos el idioma ni reescribimos el contenido.</p>'+
   '<button type="submit" class="button button-primary bp-generate-button">Generar HTML →</button></form>'+
   '<h3 class="bp-summary-title">Resumen editorial</h3><div id="bp-stats" aria-live="polite">'+statsMarkup(editorialStats('','auto',''))+'</div></section>'+
   '<section class="card bp-tool-preview"><div class="bp-tool-head"><span class="bp-tool-index">02</span><div><h2>Revisa el resultado</h2><p>El diseño azul y morado oficial de Brásper.</p></div></div>'+
   '<div class="bp-device-toggle" role="group" aria-label="Tamaño de la vista previa"><button type="button" class="button button-outline" data-bp-device="desktop" aria-pressed="true">Escritorio</button><button type="button" class="button button-outline" data-bp-device="mobile" aria-pressed="false">Móvil</button></div>'+
   '<div class="bp-preview-chrome" id="bp-preview-chrome" data-device="desktop"><div class="bp-preview-top"><span>VISTA PREVIA DEL ARTÍCULO</span><span>BRÁSPER / BLOG</span></div><div class="bp-preview-stage"><iframe id="bp-blog-preview" title="Vista previa segura del artículo" sandbox="" loading="lazy"></iframe></div></div>'+
   '<div id="bp-generator-status" class="bp-tool-status" role="status" aria-live="polite">Completa el artículo para previsualizar tu HTML.</div>'+
   '<label for="bp-html-output" class="bp-output-title">Código HTML generado</label><textarea class="simple-input bp-output" id="bp-html-output" readonly placeholder="Tu código aparecerá aquí para copiarlo o descargarlo."></textarea>'+
   '<div class="bp-tool-actions"><button type="button" class="button button-primary" data-bp-action="copy" disabled>Copiar HTML</button><button type="button" class="button button-outline" data-bp-action="download" disabled>Descargar .txt</button></div>'+
   '<p class="bp-tool-detail">Si el editor de tu página elimina etiquetas &lt;style&gt;, habrá que instalar los estilos en la plantilla del blog. Revisa la vista final antes de publicar.</p></section></div></div>';
  }
 };
 if(typeof document==='undefined')return;
 document.addEventListener('input',e=>{if(e.target.closest?.('#bp-blog-form'))refreshStats()});
 document.addEventListener('change',e=>{if(e.target.closest?.('#bp-blog-form'))refreshStats()});
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='bp-blog-form')return;
  e.preventDefault();const form=e.target,id=form.dataset.businessId;
  if(!id)return show('Selecciona la empresa Brásper.',true);
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Generando HTML…';
  const fail=msg=>{show(msg,true);submit.disabled=false;submit.textContent='Generar HTML →';};
  const d=new FormData(form),article=String(d.get('article')||'').trim();
  const lines=article.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const first=(lines[0]||'').replace(/^#{1,3}\s*/,'').replace(/^\*\*(.*?)\*\*$/,'$1');
  const title=first.slice(0,200);
  if(title.length<2)return fail('Pega un artículo que empiece con el título.');
  const requestedLanguage=String(d.get('language')||'auto');
  const relatedText=String(d.get('related')||'').trim();
  const related=[];
  if(relatedText){
   const rows=parseRelated(relatedText);
   if(rows.length>7)return fail('Agrega un máximo de siete artículos relacionados.');
   for(const row of rows){
    const separator=row.indexOf('|');
    if(separator<2)return fail('Cada enlace relacionado debe tener el formato: Título | URL.');
    related.push({title:row.slice(0,separator).trim(),url:row.slice(separator+1).trim()});
   }
  }
  const data={business_id:id,title,article,language:['es','pt'].includes(requestedLanguage)?requestedLanguage:detectLanguage(article),related,include_title:true,include_date:false};
  result='';
  const output=$('bp-html-output');if(output)output.value='';
  document.querySelectorAll('[data-bp-action]').forEach(x=>x.disabled=true);
  try{
   const response=await fetch('/api/brasper/blog/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const answer=await response.json();if(!response.ok||!answer?.ok||!answer.html)throw Error(answer?.error||'No se pudo generar HTML.');
   if(lastBusiness!==id||!$('bp-html-output'))return;
   result=answer.html;$('bp-html-output').value=result;
   const preview=$('bp-blog-preview');if(preview)preview.srcdoc='<!doctype html><html lang="'+data.language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#fff;">'+result+'</body></html>';
   document.querySelectorAll('[data-bp-action]').forEach(x=>x.disabled=false);
   show('HTML generado correctamente. Revisa el resultado y copia o descarga el código.');
  }catch(err){show(err.message||'No se pudo generar el código.',true)}
  finally{if(submit.isConnected){submit.disabled=false;submit.textContent='Generar HTML →';}}
 });
 document.addEventListener('click',async e=>{
  const dev=e.target.closest('[data-bp-device]');
  if(dev){applyDevice(dev.dataset.bpDevice);return;}
  const invite=e.target.closest('#bp-invite-ana');
  if(invite){
   invite.disabled=true;const feedback=$('bp-invite-feedback');
   try{
    const response=await fetch('/api/admin/invite-blog-editor',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'No se completó la invitación.');
    if(feedback)feedback.textContent='Invitación solicitada. Comprueba la entrega en el correo de Ana.';
   }catch(err){if(feedback)feedback.textContent=err.message||'No se pudo invitar.'}
   finally{invite.disabled=false}
   return;
  }
  const act=e.target.closest('[data-bp-action]')?.dataset.bpAction;if(!act||!result)return;
  if(act==='copy'){
   try{await navigator.clipboard.writeText($('bp-html-output')?.value||result);show('HTML copiado. Puedes pegarlo en el editor de Brásper.')}
   catch{const n=$('bp-html-output');if(n){n.focus();n.select()}show('No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.',true)}
  }else if(act==='download'){
   const file=new Blob([result],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(file),link=document.createElement('a');
   link.href=url;link.download='brasper_articulo_html.txt';document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   show('Archivo TXT preparado para descargar.');
  }
 });
})();
