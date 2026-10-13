/* eDigital · Floating contextual assistant, scoped to the customer's currently selected business. */
(function(){
 'use strict';
 const initial={role:'assistant',content:'¡Hola! Soy tu asistente E Digital.IA. Pregúntame por el rendimiento de tu web, campañas o conexiones. Solo usaré los datos disponibles de tu negocio.'};
 const state={open:false,busy:false,aiReady:false,aiChecked:false,companyId:'',messages:[initial],periodCache:new Map()};
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
     state.messages=[initial];state.open=false;state.busy=false;state.periodCache.clear();
   }
   return c;
 }
 function render(){
   const c=liveContext();
   if(!c||!c.loggedIn||c.admin){host.hidden=true;host.innerHTML='';return;}
   host.hidden=false;
   const mode=state.aiReady?'IA conectada':'Ayuda inteligente';
   const chat=state.messages.slice(-14).map(x=>'<div class="eda-message '+(x.role==='user'?'eda-message-user':'eda-message-bot')+'"><div class="eda-message-text">'+escapeHTML(x.content)+'</div></div>').join('');
   const suggestions=state.messages.length<=1?'<div class="eda-suggestions"><button type="button" data-assistant-prompt="¿Cómo van mis visitas hoy?">Visitas de hoy</button><button type="button" data-assistant-prompt="¿Cómo van mis visitas los últimos 3 días?">Últimos 3 días</button><button type="button" data-assistant-prompt="¿Cómo conecto las integraciones?">Integraciones</button></div>':'';
   host.innerHTML='<button type="button" class="eda-launcher" data-assistant-action="toggle" aria-label="'+(state.open?'Cerrar asistente':'Abrir asistente')+'" aria-expanded="'+state.open+'" aria-controls="eda-dialog">'+(state.open?'<span aria-hidden="true">×</span>':'<svg class=\"eda-robot-art\" viewBox=\"0 0 64 64\" aria-hidden=\"true\"><rect x=\"13\" y=\"13\" width=\"38\" height=\"42\" rx=\"15\" fill=\"#F7FAFF\" stroke=\"#97CEF7\" stroke-width=\"2\"/><rect x=\"17\" y=\"22\" width=\"30\" height=\"24\" rx=\"10\" fill=\"#0B204B\"/><circle cx=\"25\" cy=\"33\" r=\"3.5\" fill=\"#33D6FF\"/><circle cx=\"39\" cy=\"33\" r=\"3.5\" fill=\"#33D6FF\"/><path d=\"M29 41h6\" stroke=\"#68E9FF\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><rect x=\"8\" y=\"28\" width=\"5\" height=\"17\" rx=\"3\" fill=\"#198DE8\"/><rect x=\"51\" y=\"28\" width=\"5\" height=\"17\" rx=\"3\" fill=\"#198DE8\"/><path d=\"M32 13V7\" stroke=\"#198DE8\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"6\" r=\"3\" fill=\"#33D6FF\"/></svg>')+'</button>'+
   (state.open?'<section class="eda-dialog" id="eda-dialog" role="dialog" aria-label="Asistente Edwin CRM">'+
    '<div class="eda-head"><div class="eda-bot-icon" aria-hidden="true">✦</div><div class="eda-heading"><strong>Asistente Edwin CRM</strong><small>'+mode+' · '+escapeHTML(c.company||'Mi empresa')+'</small></div><button type="button" class="eda-close" data-assistant-action="close" aria-label="Cerrar asistente">×</button></div>'+
    '<nav class="eda-shortcuts" aria-label="Accesos rápidos"><button type="button" data-assistant-nav="analytics">Analítica</button><button type="button" data-assistant-nav="campaigns">Campañas</button><button type="button" data-assistant-nav="integrations">Integraciones</button></nav>'+
    '<div class="eda-messages" id="eda-messages" aria-live="polite">'+chat+(state.busy?'<p class="eda-wait">Preparando respuesta…</p>':'')+suggestions+'</div>'+
    '<form id="eda-form" class="eda-form"><label class="eda-screenreader" for="eda-question">Pregunta al asistente</label><input id="eda-question" name="question" type="text" maxlength="450" autocomplete="off" placeholder="Pregúntame sobre tu negocio…" '+(state.busy?'disabled':'required')+'/><button type="submit" '+(state.busy?'disabled':'')+' aria-label="Enviar pregunta">➤</button><button type="button" data-assistant-action="voice" class="eda-mic" aria-label="Dictar pregunta con el micrófono" title="Dictar por voz">🎙</button></form>'+
    '<p class="eda-disclaimer">'+(state.aiReady?'Análisis de IA basado en tu información disponible. Confirma decisiones importantes.':'Respuestas con datos reales de tu panel. IA generativa aún no activada.')+'</p></section>':'');
   if(state.open){const box=host.querySelector('#eda-messages');if(box)box.scrollTop=box.scrollHeight;}
 }
 function requestedFrame(question,c){
   const q=question.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const has=/\b(hoy|ayer|ultim|semana|este mes|mes pasado)\b/.test(q);
   if(/\bhoy\b/.test(q))return {period:'today',label:'hoy'};
   if(/\bayer\b/.test(q))return {period:'yesterday',label:'ayer'};
   if(/\b(3|tres)\s*dias\b/.test(q))return {period:'3',label:'los últimos 3 días'};
   if(/\b(7|siete)\s*dias\b/.test(q)||/\bultima semana\b/.test(q))return {period:'7',label:'los últimos 7 días'};
   if(/\b(30|treinta)\s*dias\b/.test(q)||/\beste mes\b/.test(q))return {period:'30',label:'los últimos 30 días'};
   if(/\b(90|noventa)\s*dias\b/.test(q))return {period:'90',label:'los últimos 90 días'};
   return {period:c.period||'30',label:c.periodLabel||'el período seleccionado',requested:has};
 }
 async function contextualFrame(question,c){
   const frame=requestedFrame(question,c);
   if(frame.period===c.period)return {...c};
   const result={...c,period:frame.period,periodLabel:frame.label,ga:null,gaPrevious:null,meta:[],topChannels:[],topPages:[],topEvents:[],missingPeriodData:false};
   // This endpoint checks site ownership with the user's Supabase JWT.
   if(!c.siteId||!c.businessId){result.missingPeriodData=true;return result;}
   const key=c.businessId+':'+c.siteId+':'+frame.period;
   const cached=state.periodCache.get(key);
   if(cached&&cached.expires>Date.now())return {...result,...cached.value};
   try{
     const url='/api/ga4/report?business_id='+encodeURIComponent(c.businessId)+'&site_id='+encodeURIComponent(c.siteId)+'&period='+encodeURIComponent(frame.period);
     const r=await fetch(url,{credentials:'same-origin'});
     if(!r.ok)throw new Error('El informe no está disponible.');
     const info=await r.json();
     if(!info.configured||!info.metrics||info.metrics.sessions===undefined)throw new Error('No se pudieron consultar las cifras.');
     const value={ga:info.metrics,gaPrevious:info.previous_metrics||null,topChannels:(info.reports?.channels||[]).slice(0,5).map(x=>({name:x.sessionDefaultChannelGroup,sessions:x.sessions})),topPages:(info.reports?.pages||[]).slice(0,5).map(x=>({name:x.pagePath,views:x.screenPageViews})),topEvents:(info.reports?.events||[]).slice(0,5).map(x=>({name:x.eventName,count:x.eventCount})),missingPeriodData:false};
     state.periodCache.set(key,{expires:Date.now()+120000,value});
     return {...result,...value};
   }catch{
     return {...result,missingPeriodData:true};
   }
 }
 function localAnswer(question,c){
   const q=question.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   const ga=c.ga,prev=c.gaPrevious,meta=Array.isArray(c.meta)?c.meta:[];
   const label=c.periodLabel||'el período seleccionado';
   const periodDiff=c.period!==ctx()?.period;
   const prior=(k)=>{
     if(!prev||prev[k]===undefined||ga?.[k]===undefined||Number(prev[k])<=0)return '';
     const d=(Number(ga[k])-Number(prev[k]))/Number(prev[k])*100;
     return ' Frente al período anterior, '+(d>=0?'aumentó':'disminuyó')+' un '+decimal(Math.abs(d))+'%.';
   };
   if(/integra|conect|configur|vincula|google ads|tiktok|linkedin|hotmart|shopify/.test(q)&&!/visita|resultado|negocio/.test(q)){
     return 'En el menú abre Integraciones. Allí encontrarás Analítica y contenidos, Ventas y e-commerce y Publicidad. Meta Ads se puede conectar cuando el administrador habilite su integración. Los servicios marcados como «Próximamente» aún no admiten conexiones.';
   }
   if(/meta|facebook|instagram|anunci|campan|publicidad|ctr|cpc|inversi/.test(q)&&!/visita|negocio|general|resumen/.test(q)){
     if(periodDiff)return 'Para Meta Ads, el período «'+label+'» no está sincronizado con este resumen. Cambia el filtro de fechas del panel y vuelve a consultar las campañas. No voy a mostrar como actuales las cifras de otro período.';
     if(!c.metaConnected)return 'Meta Ads aún no está conectado. En Integraciones → Publicidad → Meta Ads encontrarás el estado de activación y podrás autorizar tu cuenta cuando esté habilitado.';
     if(!meta.length)return 'Tu cuenta de Meta está autorizada, pero todavía no hay datos de cuentas publicitarias cargados. En Integraciones selecciona una cuenta y ve a Campañas Ads.';
     return 'En '+label+', Meta Ads muestra: '+meta.slice(0,3).map(a=>a.name+': '+(a.spend==null?'sin inversión informada':decimal(a.spend)+' '+(a.currency||''))+' de inversión, '+number(a.clicks)+' clics y CTR '+(a.ctr==null?'—':decimal(a.ctr)+'%')).join('; ')+'. Estas cifras no equivalen necesariamente a ventas.';
   }
   if(/pagina\s+mas\s+vist|mas\s+vistas|contenido\s+mas\s+vist/.test(q)){
     if(!ga)return 'Necesito que Analytics esté conectado y consulte el período solicitado antes de identificar páginas más vistas.';
     const pages=(c.topPages||[]).slice(0,3);
     if(!pages.length)return 'No hay páginas con visualizaciones disponibles en '+label+'.';
     return 'Las páginas más vistas en '+label+' son: '+pages.map(p=>(p.name||'/')+' ('+number(p.views)+' vistas)').join('; ')+'. Puedes ver el detalle en Contenido web.';
   }
   if(/de\s+donde|origen|canal|fuente|procedencia/.test(q)){
     if(!ga)return 'No tengo información de canales para '+label+'. Comprueba la propiedad de GA4.';
     const channels=(c.topChannels||[]).slice(0,3);
     if(!channels.length)return 'GA4 no devolvió canales para '+label+'.';
     return 'Tus principales canales en '+label+' son: '+channels.map(x=>(x.name||'No identificado')+' ('+number(x.sessions)+' sesiones)').join('; ')+'. Ve a Adquisición para más detalles.';
   }
   if(/visita|usuario|sesion|trafico|web|pagina|analytics|baj|subi|resultado|negocio|rendimiento|hoy|dias|semana/.test(q)){
     if(!ga)return c.missingPeriodData
       ?'Intenté consultar Google Analytics para '+label+', pero no pude obtener las métricas de ese período. Puedes revisar la conexión del sitio o intentarlo nuevamente.'
       :'No hay datos de Google Analytics disponibles para el sitio actual. Comprueba la propiedad y los permisos desde Integraciones; no voy a inventar cifras.';
     const totals='En '+label+', tu sitio registró '+number(ga.totalUsers)+' usuarios, '+number(ga.sessions)+' sesiones y '+number(ga.screenPageViews)+' vistas de página.';
     const conversions=ga.keyEvents===undefined?'':' Se registraron '+number(ga.keyEvents)+' eventos clave (no necesariamente ventas).';
     const adInfo=!periodDiff&&c.metaConnected&&meta.length?' Meta Ads tiene '+meta.length+' cuenta(s) con datos conectados; consulta Campañas Ads para verlas por separado.':'';
     const note=c.period==='today'?' Los resultados de hoy pueden estar incompletos hasta que GA4 procese todos los eventos.':'';
     return totals+prior('sessions')+conversions+adInfo+note+' Para ver de dónde llegaron las visitas, abre Adquisición.';
   }
   if(/cliente|contact|venta|conversi|whatsapp|objetivo|evento/.test(q)){
     if(!ga)return 'Para medir contactos o ventas necesitas eventos clave en GA4 o una integración de ventas autorizada. Las visitas no son equivalentes a clientes.';
     return 'GA4 tiene '+number(ga.keyEvents)+' eventos clave en '+label+'. Solo representan contactos o ventas si los configuraste así. Ve a Eventos y metas para revisar cuáles se midieron.';
   }
   if(/contenido|seo|posicion|busqueda/.test(q))return 'En Contenido web puedes revisar las páginas con más vistas y las páginas por las que ingresan los visitantes. Search Console estará disponible cuando termine su integración.';
   return 'Puedo consultar el rendimiento de tu web para hoy, ayer, 3, 7 o 30 días; explicar tus eventos y guiarte por las integraciones. Prueba: «¿Cómo va mi negocio los últimos 3 días?»';
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
   const frame=await contextualFrame(q,c);
   if(state.aiReady&&c.businessId&&!frame.missingPeriodData){
     try{
       const res=await fetch('/api/assistant/chat',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({
         question:q,business_id:c.businessId,site_id:c.siteId||'',context:{
           period:frame.period,ga:frame.ga,gaPrevious:frame.gaPrevious,meta:frame.meta
         },history:previous
       })});
       const data=await res.json().catch(()=>({}));
       if(res.ok&&data.reply)answer=String(data.reply);
       else if(res.status===503){state.aiReady=false;}
     }catch{}
   }
   if(!answer)answer=localAnswer(q,frame);
   // If a customer switches companies during an async request, discard the previous response.
   if(liveContext()?.businessId!==c.businessId)return;
   state.messages.push({role:'assistant',content:answer.slice(0,2500)});
   state.messages=state.messages.slice(-14);
   state.busy=false;render();
 }
 host.addEventListener('click',e=>{
   const btn=e.target.closest('[data-assistant-action],[data-assistant-prompt],[data-assistant-nav]');if(!btn)return;
   if(btn.dataset.assistantPrompt){send(btn.dataset.assistantPrompt);return;}
   if(btn.dataset.assistantNav){
     const page=btn.dataset.assistantNav;
     const link=document.querySelector('[data-act="nav"][data-page="'+page+'"]');
     if(link){link.click();state.open=false;render();}
     return;
   }
   if(btn.dataset.assistantAction==='voice'){
     const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
     if(!Recognition){const field=host.querySelector('#eda-question');if(field)field.placeholder='El dictado de voz no está disponible en este navegador';return;}
     try{const recognition=new Recognition();recognition.lang='es-PE';recognition.interimResults=false;recognition.onresult=event=>{const field=host.querySelector('#eda-question');if(field){field.value=event.results[0][0].transcript;field.focus();}};recognition.start();}catch(err){const field=host.querySelector('#eda-question');if(field)field.placeholder='No se pudo iniciar el micrófono';}
     return;
   }
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