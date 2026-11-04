/* G10: editable commercial drafts (ES/PT), client-side only. No external sends or storage. */
(function(root){
 'use strict';
 const templates=Object.freeze({
  es:Object.freeze([
   Object.freeze({id:'first',title:'Primer contacto',body:'Hola, gracias por tu interés. ¿En qué podemos ayudarte?'}),
   Object.freeze({id:'followup',title:'Seguimiento',body:'Hola, queríamos saber si necesitas más información. Quedamos atentos a tus consultas.'}),
   Object.freeze({id:'close',title:'Cierre cordial',body:'Gracias por conversar con nosotros. Si necesitas algo más, estamos disponibles.'})
  ]),
  pt:Object.freeze([
   Object.freeze({id:'first',title:'Primeiro contato',body:'Olá, agradecemos seu interesse. Como podemos ajudar?'}),
   Object.freeze({id:'followup',title:'Acompanhamento',body:'Olá, gostaríamos de saber se precisa de mais informações. Estamos à disposição.'}),
   Object.freeze({id:'close',title:'Encerramento',body:'Agradecemos a conversa. Se precisar de algo mais, estamos à disposição.'})
  ])
 });
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function list(locale){return (templates[locale]||[]).map(item=>({...item}));}
 function draft(locale,id,edits){
  const item=(templates[locale]||[]).find(t=>t.id===id);
  if(!item)return null;
  if(edits===undefined)return item.body;
  if(typeof edits!=='string'||edits.length>4000)return null;
  return edits;
 }
 let locale='es',template='first',edited=null;
 function render(){
  const options=list(locale).map(item=>'<option value="'+item.id+'" '+(item.id===template?'selected':'')+'>'+escape(item.title)+'</option>').join('');
  const content=edited===null?draft(locale,template):edited;
  return '<section class="card ed-response-library" aria-labelledby="ed-response-title">'+
   '<h2 id="ed-response-title">Biblioteca de mensajes comerciales</h2>'+
   '<p>Prepara una respuesta en español o portugués, ajústala y cópiala. El CRM no envía mensajes automáticamente.</p>'+
   '<div class="ed-response-fields"><label for="ed-response-locale">Idioma<select id="ed-response-locale" class="simple-input">'+
   '<option value="es" '+(locale==='es'?'selected':'')+'>Español</option>'+
   '<option value="pt" '+(locale==='pt'?'selected':'')+'>Português (Brasil)</option></select></label>'+
   '<label for="ed-response-template">Tipo de mensaje<select id="ed-response-template" class="simple-input">'+options+'</select></label></div>'+
   '<label for="ed-response-text">Texto editable</label>'+
   '<textarea id="ed-response-text" class="simple-input" maxlength="4000" rows="4">'+escape(content)+'</textarea>'+
   '<div class="ed-response-actions"><p id="ed-response-status" role="status" aria-live="polite">Personaliza el texto antes de usarlo. Revisa el consentimiento del destinatario.</p>'+
   '<button type="button" class="button button-outline" data-ed-response-copy>Copiar mensaje</button></div></section>';
 }
 if(typeof document!=='undefined'){
  document.addEventListener('change',event=>{
   const target=event.target;
   if(target?.id==='ed-response-locale'){
    locale=target.value==='pt'?'pt':'es';template='first';edited=null;
    const old=document.querySelector('.ed-response-library');
    if(old)old.outerHTML=render();
   }else if(target?.id==='ed-response-template'){
    template=list(locale).some(t=>t.id===target.value)?target.value:'first';
    edited=null;
    const input=document.querySelector('#ed-response-text');
    if(input)input.value=draft(locale,template);
   }
  });
  document.addEventListener('input',event=>{
   if(event.target?.id==='ed-response-text')edited=String(event.target.value).slice(0,4000);
  });
  document.addEventListener('click',async event=>{
   const button=event.target.closest?.('[data-ed-response-copy]');
   if(!button)return;
   const text=document.querySelector('#ed-response-text')?.value||'';
   const status=document.querySelector('#ed-response-status');
   if(!text.trim()){if(status)status.textContent='Escribe un mensaje antes de copiarlo.';return;}
   try{
    if(!root.navigator?.clipboard?.writeText)throw new Error('clipboard unavailable');
    await root.navigator.clipboard.writeText(text);
    if(status)status.textContent='Mensaje copiado. Revisa el destinatario antes de enviarlo por tu cuenta.';
   }catch{if(status)status.textContent='No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.';}
  });
 }
 root.edwinResponseLibrary=Object.freeze({list,draft,render});
})(globalThis);
