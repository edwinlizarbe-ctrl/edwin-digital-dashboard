(function(){
 'use strict';
 let result='',lastBusiness='';
 const $=id=>document.getElementById(id);
 const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const show=(msg,error=false)=>{
  const node=$('bp-generator-status');if(node){node.textContent=msg;node.dataset.error=error?'true':'false';}
 };
 window.edwinBrasperBlog={
  page:(businessId,isAdmin=false)=>{
   result='';lastBusiness=businessId||'';
   return '<div class="bp-tool"><div class="bp-tool-hero"><div><span class="bp-tool-eyebrow">BRÁSPER · ESTUDIO EDITORIAL</span><h1>Tu artículo, con un formato impecable.</h1><p>Convierte textos de Brásper en HTML listo para revisar, copiar y pegar. Sin reescribir tus palabras ni utilizar inteligencia artificial de pago.</p></div><span class="bp-tool-label">GENERADOR HTML</span></div>'+
   (isAdmin?'<div class="bp-invite-admin"><div><b>Acceso editorial de Ana</b><p>Invitación segura a marketing.brasper@gmail.com · únicamente Blog de Brásper.</p></div><button type="button" class="button button-outline" id="bp-invite-ana">Invitar a Ana</button><span id="bp-invite-feedback" role="status" aria-live="polite"></span></div>':'')+
   '<div class="bp-tool-grid"><section class="card bp-tool-editor"><div class="bp-tool-head"><span class="bp-tool-index">01</span><div><h2>Prepara el contenido</h2><p>Solo tú decides el texto, los enlaces y el idioma.</p></div></div>'+
   '<form id="bp-blog-form" data-business-id="'+clean(businessId)+'"><div class="bp-form-dual"><label>Idioma<select name="language" class="simple-input"><option value="es">Español · Perú</option><option value="pt">Português · Brasil</option></select></label><label>Fecha editorial (opcional)<input class="simple-input" type="month" name="date"></label></div>'+
   '<label>Título del artículo<input name="title" class="simple-input" maxlength="200" required placeholder="Escribe el título tal como irá en la web"></label>'+
   '<label>Texto del artículo<textarea name="article" class="simple-input bp-article-input" maxlength="60000" required placeholder="Pega aquí tu artículo.&#10;&#10;## Subtítulo&#10;&#10;Párrafo de tu blog.&#10;&#10;- Primera recomendación&#10;- Segunda recomendación"></textarea></label>'+
   '<div class="bp-format-help"><b>Guía rápida:</b> escribe <code>##</code> antes de un subtítulo y <code>-</code> antes de cada viñeta. Se reconocen enlaces Markdown [texto](URL), negritas **texto** y listas. El título repetido en el artículo se omite para evitar duplicaciones.</div>'+
   '<label>Artículos relacionados <span class="bp-form-hint">(máximo 7)</span><textarea name="related" class="simple-input bp-links-input" placeholder="Título del artículo | https://brasper.com/enlace-real&#10;Otro artículo | https://brasper.com/otro-enlace"></textarea></label>'+
   '<div class="bp-tool-checks"><label><input type="checkbox" name="include_title"> Incluir título dentro del HTML</label><label><input type="checkbox" name="include_date"> Incluir fecha dentro del HTML</label></div>'+
   '<p class="bp-tool-detail">Por defecto no duplicamos el título ni la fecha, porque la plantilla del blog puede mostrarlos por separado. El contenido no se publica automáticamente.</p>'+
   '<button type="submit" class="button button-primary bp-generate-button">Generar mi HTML →</button></form></section>'+
   '<section class="card bp-tool-preview"><div class="bp-tool-head"><span class="bp-tool-index">02</span><div><h2>Revisa el resultado</h2><p>El diseño azul y morado oficial de Brásper.</p></div></div>'+
   '<div class="bp-preview-chrome"><div class="bp-preview-top"><span>VISTA PREVIA DEL ARTÍCULO</span><span>BRÁSPER / BLOG</span></div><iframe id="bp-blog-preview" title="Vista previa segura del artículo" sandbox="" loading="lazy"></iframe></div>'+
   '<div id="bp-generator-status" class="bp-tool-status" role="status" aria-live="polite">Completa el artículo para previsualizar tu HTML.</div>'+
   '<label for="bp-html-output" class="bp-output-title">Código HTML generado</label><textarea class="simple-input bp-output" id="bp-html-output" readonly placeholder="Tu código aparecerá aquí para copiarlo o descargarlo."></textarea>'+
   '<div class="bp-tool-actions"><button type="button" class="button button-primary" data-bp-action="copy" disabled>Copiar HTML</button><button type="button" class="button button-outline" data-bp-action="download" disabled>Descargar .txt</button></div>'+
   '<p class="bp-tool-detail">Si el editor de tu página elimina etiquetas &lt;style&gt;, habrá que instalar los estilos en la plantilla del blog. Revisa la vista final antes de publicar.</p></section></div></div>';
  }
 };
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='bp-blog-form')return;
  e.preventDefault();const form=e.target,id=form.dataset.businessId;
  if(!id)return show('Selecciona la empresa Brásper.',true);
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Generando HTML…';
  const d=new FormData(form),lines=String(d.get('related')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length>7){show('Solo se permiten siete artículos relacionados.',true);submit.disabled=false;submit.textContent='Generar mi HTML →';return;}
  const related=lines.map(line=>{const i=line.lastIndexOf('|');return i<0?{title:line,url:''}:{title:line.slice(0,i).trim(),url:line.slice(i+1).trim()}});
  const data={business_id:id,title:String(d.get('title')||''),article:String(d.get('article')||''),date:String(d.get('date')||''),language:String(d.get('language')||''),related,include_title:d.has('include_title'),include_date:d.has('include_date')};
  result='';
  const output=$('bp-html-output');if(output)output.value='';
  document.querySelectorAll('[data-bp-action]').forEach(x=>x.disabled=true);
  try{
   const response=await fetch('/api/brasper/blog/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const answer=await response.json();if(!response.ok||!answer?.ok||!answer.html)throw Error(answer?.error||'No se pudo generar HTML.');
   if(lastBusiness!==id||!$('bp-html-output'))return;
   result=answer.html;$('bp-html-output').value=result;
   const preview=$('bp-blog-preview');if(preview)preview.srcdoc='<!doctype html><html lang="'+data.language+'"><head><meta charset="utf-8"></head><body style="margin:0;padding:20px;background:#fff;">'+result+'</body></html>';
   document.querySelectorAll('[data-bp-action]').forEach(x=>x.disabled=false);
   show('HTML generado correctamente. Revisa el resultado y copia o descarga el código.');
  }catch(err){show(err.message||'No se pudo generar el código.',true)}
  finally{if(submit.isConnected){submit.disabled=false;submit.textContent='Generar mi HTML →';}}
 });
 document.addEventListener('click',async e=>{
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
   try{await navigator.clipboard.writeText(result);show('HTML copiado. Puedes pegarlo en el editor de Brásper.')}
   catch{const n=$('bp-html-output');if(n){n.focus();n.select()}show('No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.',true)}
  }else if(act==='download'){
   const file=new Blob([result],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(file),link=document.createElement('a');
   link.href=url;link.download='brasper_articulo_html.txt';document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   show('Archivo TXT preparado para descargar.');
  }
 });
})();
