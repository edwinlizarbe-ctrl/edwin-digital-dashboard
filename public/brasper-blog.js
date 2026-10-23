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
   '<div class="bp-tool-grid"><section class="card bp-tool-editor"><div class="bp-tool-head"><span class="bp-tool-index">01</span><div><h2>Pega tu blog completo</h2><p>Un solo campo. Conservamos el texto y detectamos automáticamente español o portugués.</p></div></div>'+
   '<form id="bp-blog-form" data-business-id="'+clean(businessId)+'">'+
   '<label>Artículo completo<textarea name="article" class="simple-input bp-article-input" maxlength="60000" required placeholder="Pega aquí TODO el artículo, incluido el título, los subtítulos y las listas."></textarea></label>'+
   '<p class="bp-tool-detail">Solo convertimos el texto al formato editorial de Brásper: azul y morado, con enlaces de Brásper y PIX; nunca enlazamos bancos. No cambiamos el idioma ni reescribimos el contenido.</p>'+
   '<button type="submit" class="button button-primary bp-generate-button">Generar HTML →</button></form></section>'+
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
  const d=new FormData(form),article=String(d.get('article')||'').trim();
  const lines=article.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const first=(lines[0]||'').replace(/^#{1,3}\s*/,'').replace(/^\*\*(.*?)\*\*$/,'$1');
  const title=first.slice(0,200);
  if(title.length<2){show('Pega un artículo que empiece con el título.',true);submit.disabled=false;submit.textContent='Generar HTML →';return;}
  const lower=' '+article.toLowerCase()+' ';
  const pt=/(\b(você|vocês|não|também|saiba|envio|dinheiro|reais|cotação|brasileiro|transferências|artigos)\b|\b(para o|para a|com o|do brasil|no brasil)\b)/i.test(lower);
  const data={business_id:id,title,article,language:pt?'pt':'es',related:[],include_title:true,include_date:false};
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
