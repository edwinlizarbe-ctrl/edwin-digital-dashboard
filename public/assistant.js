/* eDigital · Floating contextual assistant, scoped to the customer's currently selected business. */
(function(){
 'use strict';
 const initial={role:'assistant',content:'¡Hola! Soy tu asistente eDigital. Puedo ayudarte a comprender las visitas, revisar las campañas conectadas y encontrar las integraciones. ¿Qué necesitas saber?'};
 const state={open:false,busy:false,aiReady:false,aiChecked:false,companyId:'',messages:[initial]};
 const escapeHTML=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const number=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(Number(value)):'—';
 const decimal=value=>Number.isFinite(Number(value))?new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(Number(value)):'—';
 const ctx=()=>typeof window.edigitalAssistantContext==='function'?window.edigitalAssistantContext():null;
 const host=document.createElement('div');
 host.id='edigital-assistant-host';
 host.hidden=true;
 document.body.appendChild(host);
 function liveContext(){
   const c=ctx();
   if(c&&c.businessId!==state.companyId){
     state.companyId=c.businessId;
     state.messages=[initial];state.open=false;state.busy=false;
   }
   return c;
 }
 function render(){
   const c=liveContext();
   if(!c||!c.loggedIn||c.admin){host.hidden=true;host.innerHTML='';return;}
   host.hidden=false;
   const mode=state.aiReady?'IA conectada':'Guía contextual';
   const chat=state.messages.slice(-14).map(x=>'<div class="eda-message '+(x.role==='user'?'eda-message-user':'eda-message-bot')+'"><div class="eda-message-text">'+escapeHTML(x.content)+'</div></div>').join('');
   const suggestions=state.messages.length<=1?'<div class="eda-suggestions"><button type="button" data-assistant-prompt="¿Cómo van las visitas de mi web?">Visitas de mi web</button><button type="button" data-assistant-prompt="¿Cómo van mis campañas de Meta Ads?">Campañas Meta Ads</button><button type="button" data-assistant-prompt="¿Cómo conecto las integraciones?">Conectar plataformas</button></div>':'';
   host.innerHTML='<button type="button" class="eda-launcher" data-assistant-action="toggle" aria-label="'+(state.open?'Cerrar asistente':'Abrir asistente')+'" aria-expanded="'+state.open+'" aria-controls="eda-dialog">'+(state.open?'<span aria-hidden="true">×</span>':'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4m-2-4h4M8 13h.01M16 13h.01M9 17h6M2 12v4m20-4v4"/></svg>')+'</button>'+
   (state.open?'<section class="eda-dialog" id="eda-dialog" role="dialog" aria-label="Asistente eDigital">'+
    '<div class="eda-head"><div class="eda-bot-icon" aria-hidden="true">✦</div><div class="eda-heading"><strong>Asistente eDigital</strong><small>'+mode+' · '+escapeHTML(c.company||'Mi empresa')+'</small></div><button type="button" class="eda-close" data-assistant-action="close" aria-label="Cerrar asistente">×</button></div>'+
    '<div class="eda-messages" id="eda-messages" aria-live="polite">'+chat+(state.busy?'<p class="eda-wait">Preparando respuesta…</p>':'')+suggestions+'</div>'+
    '<form id="eda-form" class="eda-form"><label class="eda-screenreader" for="eda-question">Pregunta al asistente</label><input id="eda-question" name="question" type="text" maxlength="450" autocomplete="off" placeholder="Pregúntame sobre tu negocio…" '+(state.busy?'disabled':'required')+'/><button type="submit" '+(state.busy?'disabled':'')+' aria-label="Enviar pregunta">➤</button></form>'+
    '<p class="eda-disclaimer">'+(state.aiReady?'La IA interpreta las cifras disponibles, pero sus recomendaciones requieren revisión.':'Guía del panel: utiliza las cifras cargadas, sin generar análisis con IA.')+'</p></section>':'');
   if(state.open){const box=host.querySelector('#eda-messages');if(box)box.scrollTop=box.scrollHeight;}
 }
 function localAnswer(question,c){
   const q=question.toLowerCase();
   const ga=c.ga,prev=c.gaPrevious,meta=Array.isArray(c.meta)?c.meta:[];
   const prior=(k)=>{
     if(!prev||prev[k]===undefined||ga?.[k]===undefined||Number(prev[k])<=0)return '';
     const d=(Number(ga[k])-Number(prev[k]))/Number(prev[k])*100;
     return ' Respecto al período anterior, '+(d>=0?'subió':'bajó')+' '+decimal(Math.abs(d))+'%.';
   };
   if(/meta|facebook|instagram|anunci|campañ|publicidad|ctr|cpc|inversi/.test(q)){
     if(!c.metaConnected)return 'Meta Ads todavía no está conectado para esta empresa. En el menú abre Integraciones → Publicidad → Meta Ads y pulsa «Conectar con Facebook». Si ya autorizaste el acceso, selecciona las cuentas publicitarias.';
     if(!meta.length)return 'Meta Ads está autorizado, pero todavía no hay cuentas con datos cargados. Ve a Integraciones → Meta Ads → Administrar cuentas y selecciona una cuenta. Después abre Campañas Ads.';
     const summary=meta.slice(0,3).map(a=>a.name+': '+(a.spend==null?'sin gasto disponible':decimal(a.spend)+' '+(a.currency||''))+' de inversión, '+number(a.clicks)+' clics y CTR '+(a.ctr==null?'—':decimal(a.ctr)+'%')).join('. ');
     return 'Durante el período seleccionado, estas son las cifras de Meta Ads mostradas en tu panel: '+summary+'. Para comparar campañas individuales entra en Campañas Ads. El gasto y las visitas de GA4 son métricas diferentes; no implican ventas.';
   }
   if(/integra|conect|configur|vincula|google ads|tiktok|linkedin|hotmart|shopify/.test(q)){
     return 'Abre «Integraciones» en el menú lateral. Las fuentes se organizan en Analítica y contenidos, Ventas y e-commerce, y Publicidad. Cada tarjeta indica si está conectada o pendiente. Las plataformas marcadas «Próximamente» todavía no permiten una conexión real.';
   }
   if(/visita|usuario|sesion|tr[aá]fico|web|p[aá]gina|analytics|baj|subi|resultado/.test(q)){
     if(!ga)return 'Todavía no tengo métricas de Google Analytics cargadas para este sitio. Selecciona el sitio adecuado y verifica la conexión de GA4 desde Integraciones. No sería correcto inventar cifras.';
     return 'En '+(c.periodLabel||'el período seleccionado')+', tu sitio registró '+number(ga.totalUsers)+' usuarios, '+number(ga.sessions)+' sesiones y '+number(ga.screenPageViews)+' vistas de páginas.'+prior('sessions')+' Si quieres encontrar qué canal generó esas sesiones, abre «Adquisición».';
   }
   if(/cliente|contact|venta|conversi|whatsapp|objetivo|evento/.test(q)){
     if(!ga)return 'Para analizar contactos y resultados primero necesitamos datos de GA4 o una integración de ventas autorizada. Las visitas por sí solas no son ventas.';
     return 'GA4 muestra '+number(ga.keyEvents)+' eventos clave en '+(c.periodLabel||'el período elegido')+'. Solo representan contactos o ventas si tu negocio configuró correctamente esos eventos. Compruébalo en «Eventos y metas».';
   }
   if(/contenido|seo|posicion|b[uú]squeda/.test(q))return 'Revisa «Contenido web» para identificar páginas vistas y páginas de entrada. Para términos de búsqueda y posicionamiento SEO será necesario conectar Search Console cuando esté disponible.';
   return 'Puedo ayudarte con tres temas: visitas de la web, campañas de Meta Ads e integraciones. Pregúntame, por ejemplo, «¿Cómo van mis visitas?» y usaré solo los datos que estén disponibles en tu panel.';
 }
 async function checkAI(){
   if(state.aiChecked)return;
   state.aiChecked=true;
   try{const r=await fetch('/api/assistant/status',{credentials:'same-origin'});if(r.ok){const data=await r.json();state.aiReady=!!data.configured;}}
   catch{}
   if(state.open)render();
 }
 async function send(question){
   const c=liveContext();if(!c||!c.loggedIn||c.admin||state.busy)return;
   const q=String(question||'').trim().slice(0,450);if(!q)return;
   const previous=state.messages.filter(x=>x!==initial).slice(-6).map(x=>({role:x.role,content:x.content}));
   state.messages.push({role:'user',content:q});state.busy=true;render();
   let answer='';
   if(state.aiReady&&c.businessId){
     try{
       const res=await fetch('/api/assistant/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
         question:q,business_id:c.businessId,site_id:c.siteId||'',context:{
           period:c.period,ga:c.ga,gaPrevious:c.gaPrevious,meta:c.meta
         },history:previous
       })});
       const data=await res.json().catch(()=>({}));
       if(res.ok&&data.reply)answer=String(data.reply);
       else if(res.status===503){state.aiReady=false;}
     }catch{}
   }
   if(!answer)answer=localAnswer(q,c);
   // If a customer switches companies during an async request, discard the previous response.
   if(liveContext()?.businessId!==c.businessId)return;
   state.messages.push({role:'assistant',content:answer.slice(0,2500)});
   state.messages=state.messages.slice(-14);
   state.busy=false;render();
 }
 host.addEventListener('click',e=>{
   const btn=e.target.closest('[data-assistant-action],[data-assistant-prompt]');if(!btn)return;
   if(btn.dataset.assistantPrompt){send(btn.dataset.assistantPrompt);return;}
   if(btn.dataset.assistantAction==='toggle'||btn.dataset.assistantAction==='close'){
     state.open=btn.dataset.assistantAction==='toggle'?!state.open:false;render();
     if(state.open){checkAI();host.querySelector('#eda-question')?.focus();}
   }
 });
 host.addEventListener('submit',e=>{
   if(e.target.id!=='eda-form')return;
   e.preventDefault();
   const field=e.target.querySelector('[name=question]');send(field?.value||'');
 });
 document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&state.open){state.open=false;render();}
 });
 window.addEventListener('edigital:render',render);
 render();
})();