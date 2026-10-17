/* Bandeja WhatsApp: no almacena claves ni mensajes en el navegador. */
(()=>{
 'use strict';
 let currentBusiness='',selected='',conversations=[],busy=false,sending=false,lastError='',messages=[],hasMore=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=s=>{if(!s)return '';const d=new Date(s);return Number.isNaN(+d)?'':d.toLocaleString('es-PE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});};
 const request=async(path,init)=>{const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...init});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'No fue posible consultar WhatsApp.');return data;};
 const base=()=>'/api/zernio/inbox?business_id='+encodeURIComponent(currentBusiness);
 const msgURL=()=>'/api/zernio/messages?business_id='+encodeURIComponent(currentBusiness)+'&conversation_id='+encodeURIComponent(selected);
 const conversationLabel=c=>c.participantName||c.whatsappUsername||c.participantId||'Contacto sin nombre';
 function panel(){
  const active=conversations.find(c=>c.id===selected);
  const list=conversations.map(c=>'<button type="button" class="wa-thread '+(c.id===selected?'active':'')+'" data-thread="'+escape(c.id)+'"><span class="wa-avatar">'+escape(conversationLabel(c).slice(0,1).toUpperCase())+'</span><span class="wa-thread-body"><strong>'+escape(conversationLabel(c))+'</strong><small>'+escape(c.lastMessage||'Sin vista previa')+'</small></span><span class="wa-thread-meta">'+escape(date(c.updatedTime))+(c.unreadCount?'<b>'+Math.min(99,c.unreadCount)+'</b>':'')+'</span></button>').join('');
  const chat=active?'<div class="wa-chat-head"><span class="wa-avatar">'+escape(conversationLabel(active).slice(0,1).toUpperCase())+'</span><div><b>'+escape(conversationLabel(active))+'</b><small>'+escape(active.participantId||'WhatsApp Business')+'</small></div></div><div class="wa-messages" id="wa-messages" aria-live="polite">'+(messages.length?messages.map(m=>{const outgoing=m.direction==='outgoing'||m.isFromMe||m.fromMe;const value=m.message||m.text||m.content?.text||m.attachmentType&&'📎 Archivo adjunto'||'Mensaje multimedia';return '<div class="wa-bubble '+(outgoing?'out':'in')+'"><div>'+escape(value)+'</div><small>'+escape(date(m.createdAt||m.timestamp||m.createdTime))+'</small></div>';}).join(''):'<p class="wa-empty">No hay mensajes disponibles para esta conversación.</p>')+'</div><form id="wa-send-form" class="wa-composer"><textarea id="wa-compose" rows="2" maxlength="4096" placeholder="Escribe un mensaje…" aria-label="Mensaje" required '+(sending?'disabled':'')+'></textarea><button class="button button-primary" type="submit" '+(sending?'disabled':'')+'>'+(sending?'Enviando…':'Enviar ➤')+'</button></form><p class="wa-policy">Puedes responder con texto libre durante las 24 horas posteriores al último mensaje del cliente. Después se requiere una plantilla aprobada.</p>':'<div class="wa-chat-placeholder">Selecciona una conversación para leer y responder.</div>';
  return '<section class="wa-shell"><aside class="wa-sidebar"><div class="wa-side-title"><div><h2>Conversaciones</h2><small>WhatsApp Business · '+conversations.length+' chats</small></div><button type="button" class="button button-outline" id="wa-refresh" title="Consultar conversaciones nuevas de WhatsApp">Actualizar</button></div><label class="wa-search"><span>⌕</span><input id="wa-search" type="search" placeholder="Buscar contacto…" aria-label="Buscar conversación"></label><div id="wa-list">'+(list||'<p class="wa-empty">No hay conversaciones. Conecta primero tu WhatsApp desde Integraciones.</p>')+'</div>'+(hasMore?'<p class="wa-hint">Mostrando las 100 conversaciones más recientes.</p>':'')+'</aside><section class="wa-chat">'+chat+'</section></section>';
 }
 const root=()=>document.getElementById('wa-inbox-root');
 const redraw=()=>{const el=root();if(!el)return;el.innerHTML=(lastError?'<p class="wa-error" role="alert">'+escape(lastError)+'</p>':'')+(busy?'<p class="wa-loading">Cargando conversaciones…</p>':'')+panel();};
 async function load(businessId){
  if(!businessId)return;
  if(currentBusiness!==businessId){currentBusiness=businessId;selected='';conversations=[];messages=[];}
  busy=true;lastError='';redraw();
  try{const r=await request(base());if(currentBusiness!==businessId)return;conversations=r.conversations||[];hasMore=r.hasMore; if(selected&&!conversations.some(c=>c.id===selected)){selected='';messages=[];} }
  catch(e){lastError=e.message;conversations=[];selected='';messages=[];}
  finally{if(currentBusiness===businessId){busy=false;redraw();}}
 }
 async function openConversation(id){
  if(!conversations.some(c=>c.id===id))return;
  selected=id;messages=[];lastError='';redraw();
  const businessId=currentBusiness;
  try{const r=await request(msgURL());if(selected!==id||currentBusiness!==businessId)return;messages=(r.messages||[]).slice().reverse();redraw();const el=document.getElementById('wa-messages');if(el)el.scrollTop=el.scrollHeight;}
  catch(e){if(selected===id){lastError=e.message;redraw();}}
 }
 document.addEventListener('click',e=>{
  if(e.target.closest('#wa-help-open')){document.getElementById('wa-help-dialog')?.showModal();return;}
  if(e.target.closest('#wa-help-close')){document.getElementById('wa-help-dialog')?.close();return;}
  if(e.target.id==='wa-help-dialog'){e.target.close();return;}

  if(e.target.closest('#wa-refresh')){if(currentBusiness)load(currentBusiness);return;}
  const item=e.target.closest('[data-thread]');if(item&&root()?.contains(item))openConversation(item.dataset.thread);
 });
 document.addEventListener('input',e=>{
  if(e.target.id!=='wa-search')return;
  const q=e.target.value.trim().toLowerCase();root()?.querySelectorAll('.wa-thread').forEach(item=>{item.hidden=!item.textContent.toLowerCase().includes(q);});
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='wa-send-form')return;e.preventDefault();
  if(sending||!currentBusiness||!selected)return;
  const value=document.getElementById('wa-compose')?.value.trim();if(!value)return;
  sending=true;lastError='';const businessId=currentBusiness,thread=selected;redraw();
  try{
   await request('/api/zernio/messages',{method:'POST',body:JSON.stringify({business_id:businessId,conversation_id:thread,message:value,idempotency_key:crypto.randomUUID()})});
   if(currentBusiness===businessId&&selected===thread)await openConversation(thread);
  }catch(err){lastError=err.message;if(currentBusiness===businessId&&selected===thread){redraw();const input=document.getElementById('wa-compose');if(input)input.value=value;}}
  finally{sending=false;redraw();}
 });
 window.edwinWhatsAppInbox={page:businessId=>{if(currentBusiness!==businessId){currentBusiness=businessId;selected='';messages=[];conversations=[];lastError='';}return '<div class="wa-page"><div class="page-title"><div><div class="eyebrow">MENSAJERÍA</div><div class="wa-title-row"><h1>WhatsApp</h1><button type="button" class="wa-help-trigger" id="wa-help-open" title="¿Cómo conectar y utilizar WhatsApp?" aria-label="Abrir guía de WhatsApp" aria-haspopup="dialog">?</button></div><p>Atiende las conversaciones de tu empresa desde Edwin CRM.</p></div></div><dialog id="wa-help-dialog" class="wa-help-dialog" aria-labelledby="wa-help-title"><div class="wa-help-heading"><h2 id="wa-help-title">¿Cómo usar WhatsApp en Edwin CRM?</h2><button type="button" id="wa-help-close" class="wa-help-close" aria-label="Cerrar ayuda">×</button></div><ol><li>Entra a <strong>Integraciones → Mensajería → WhatsApp</strong>.</li><li>Selecciona <strong>Conectar WhatsApp</strong> y completa la autorización de tu empresa.</li><li>Cuando la conexión esté activa, vuelve a esta bandeja y pulsa <strong>Actualizar</strong>.</li><li>Abre una conversación para leer y responder mensajes. Fuera de la ventana de atención de 24 horas se necesitan plantillas aprobadas.</li></ol><p>Si tu número aún está asociado a otro proveedor, primero confirma con él el proceso de migración para conservarlo. No elimines el número antes de completar ese proceso.</p></dialog><div id="wa-inbox-root">'+panel()+'</div></div>';},load,reset:()=>{currentBusiness='';selected='';messages=[];conversations=[];}};
})();
