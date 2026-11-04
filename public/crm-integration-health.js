/* Edwin CRM C39/C40/C48 — tenant-scoped integration checks and demo readiness.
 * Read-only presentation of existing authorized state. No credentials, PII or network calls.
 */
(function(root){
 'use strict';
 const businessPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const check=(name,status,note,page)=>({name,status,note,page});
 function assess(ctx={}){
  const businessId=String(ctx.businessId||'');
  if(!businessPattern.test(businessId))return {valid:false,checks:[],warnings:[],verified:0,enabled:0,siteReady:false,gaReady:false};
  const sites=Array.isArray(ctx.sites)?ctx.sites.filter(s=>s&&(!s.business_id||s.business_id===businessId)):[];
  const siteReady=sites.some(s=>s.id&&s.id===ctx.siteId);
  const gaEnabled=!!ctx.gaEnabled,metaEnabled=!!ctx.metaEnabled,waEnabled=!!ctx.waEnabled;
  const gaLinked=gaEnabled&&!!(ctx.ga4Connection?.connected&&ctx.ga4Connection?.selected_property_id);
  const metaLinked=metaEnabled&&!!ctx.meta?.connected;
  const waLinked=waEnabled&&!!ctx.wa?.connected;
  const checks=[
   check('Sitio web',siteReady?'Verificado':'Por configurar',siteReady?'Hay un sitio seleccionado para esta empresa.':'Registra o selecciona un sitio en Mi empresa.','company'),
   check('Google Analytics 4',!gaEnabled?'No incluida':gaLinked?'Conectada':ctx.ga4Connection?.connected?'Sin propiedad seleccionada':'Sin autorización',
    !gaEnabled?'El acceso a GA4 no está incluido para esta empresa.':gaLinked?'Se confirmó autorización y propiedad seleccionada.':ctx.ga4Connection?.connected?'Abre Integraciones y elige una propiedad de Analytics.':'Autoriza GA4 y selecciona una propiedad en Integraciones.','integrations'),
   check('Meta Ads',!metaEnabled?'No incluida':metaLinked?'Conectada':ctx.meta?.configured?'Pendiente de autorización':'No configurada',
    !metaEnabled?'Meta Ads no está habilitado en este plan.':metaLinked?'Se confirmó que la cuenta autorizó la conexión.':'Revisa los permisos y disponibilidad en Integraciones.','integrations'),
   check('WhatsApp Business',!waEnabled?'No incluida':waLinked?'Conectada':ctx.wa?.configured?'Pendiente de autorización':'No configurada',
    !waEnabled?'WhatsApp Business no está habilitado para esta empresa.':waLinked?'El número empresarial figura vinculado.':'La vinculación requiere autorización de la empresa y confirmación del proveedor.','integrations')
  ];
  const warnings=[];
  if(gaEnabled){
   if(ctx.gaLoading)warnings.push('GA4: consulta en curso; aún no se puede confirmar disponibilidad de datos recientes.');
   else if(ctx.gaError||ctx.ga4Error)warnings.push('GA4: error al consultar o validar la integración. No se puede confirmar la actualidad de sus datos.');
   else if(!gaLinked)warnings.push('GA4: sin autorización y propiedad verificadas no se puede confirmar información reciente.');
   else if(!ctx.gaReportAvailable)warnings.push('GA4: propiedad vinculada, pero no se pudo confirmar información disponible para el período seleccionado.');
   else warnings.push('GA4: hay un informe disponible para el período consultado. Esto no confirma datos en tiempo real.');
  }
  if(metaEnabled&&metaLinked){
   if(ctx.metaLoading)warnings.push('Meta Ads: la consulta está en curso; aún no se confirma disponibilidad de datos.');
   else if(ctx.metaError)warnings.push('Meta Ads: ocurrió un error de consulta. No se puede confirmar disponibilidad reciente.');
   else if(!ctx.metaReportAvailable)warnings.push('Meta Ads: cuenta autorizada, pero no se pudo confirmar un informe reciente.');
   else warnings.push('Meta Ads: informes disponibles, pero la fecha de actualización no está verificada.');
  }
  if(waLinked)warnings.push('WhatsApp Business: el número está vinculado; este diagnóstico no verifica si hay mensajes recientes.');
  const enabled=checks.filter(c=>c.status!=='No incluida');
  return {valid:true,checks,warnings,verified:enabled.filter(c=>['Verificado','Conectada'].includes(c.status)).length,
   enabled:enabled.length,siteReady,gaReady:gaLinked};
 }
 function render(ctx){
  const result=assess(ctx);
  if(!result.valid)return '';
  const rows=result.checks.map(c=>
   '<li class="ed-health-row"><div><strong>'+esc(c.name)+'</strong><p>'+esc(c.note)+'</p></div>'+
   '<div class="ed-health-action"><span class="ed-health-status">'+esc(c.status)+'</span>'+
   '<button class="button button-outline" type="button" data-act="nav" data-page="'+esc(c.page)+'">Revisar</button></div></li>'
  ).join('');
  return '<section class="card ed-health" aria-labelledby="ed-health-title">'+
   '<div class="ed-health-head"><div><h2 id="ed-health-title">Diagnóstico de integraciones</h2>'+
   '<p>Comprueba la preparación de las fuentes de esta empresa sin solicitar credenciales adicionales.</p></div>'+
   '<strong>'+result.verified+' de '+result.enabled+' condiciones verificadas</strong></div>'+
   '<ol class="ed-health-list">'+rows+'</ol>'+
   '<h3>Disponibilidad y actualización de datos</h3>'+
   (result.warnings.length?'<ul class="ed-health-warnings" role="status">'+result.warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':
    '<p>Sin fuentes autorizadas para comprobar actualidad de datos; no se presume que existan informes recientes.</p>')+
   '<p class="ed-health-footnote">Una conexión autorizada no garantiza métricas actuales, anuncios activos ni ventas. No se activan campañas ni se envían mensajes.</p></section>';
 }
 function demo(ctx={}){
  const businessId=String(ctx.businessId||'');
  if(!businessPattern.test(businessId))return null;
  const owned=Array.isArray(ctx.leads)?ctx.leads.filter(l=>l?.business_id===businessId):[];
  const checking=!!ctx.leadsLoading,failed=!!ctx.leadsError;
  const leadKnown=!checking&&!failed&&owned.length>0;
  const reportKnown=!checking&&!failed&&!!ctx.funnelData&&Number.isSafeInteger(ctx.funnelData.total)&&ctx.funnelData.total>=0;
  return {
   steps:[
    check('Empresa disponible',!!ctx.businessExists?'Listo':'Pendiente','Presenta solo el negocio autorizado.','company'),
    check('Oportunidad registrada',checking?'Comprobando':failed?'No disponible':leadKnown?'Listo':'Pendiente',
     checking?'Consultando el registro comercial…':failed?'No se pudo confirmar el registro comercial.':'Puedes mostrar una oportunidad real autorizada o explicar el formulario vacío.','leads'),
    check('Embudo comercial consultable',checking?'Comprobando':failed?'No disponible':reportKnown?'Listo':'Pendiente',
     reportKnown?'El informe agregado fue recuperado del CRM.':'No se confirmó el informe agregado. No inventes resultados para una demostración.','reports')
   ],
   partial:!!ctx.leadsPartial,
   ready:!!ctx.businessExists&&leadKnown&&reportKnown&&!ctx.leadsPartial
  };
 }
 function renderDemo(ctx){
  const d=demo(ctx);if(!d)return '';
  const items=d.steps.map(s=>
   '<li><strong>'+esc(s.name)+'</strong><span>'+esc(s.status)+'</span><small>'+esc(s.note)+'</small></li>').join('');
  return '<section class="card ed-demo-check" aria-labelledby="ed-demo-check-title">'+
   '<h2 id="ed-demo-check-title">Preparar una demostración comercial</h2>'+
   '<p>'+ (d.ready?'Las condiciones básicas para presentar el CRM están verificadas.':'Revisa estos pasos antes de presentar el CRM a un prospecto.')+'</p>'+
   '<ol>'+items+'</ol>'+
   (d.partial?'<p class="ed-demo-warning">La muestra de oportunidades es parcial. No afirmes que estas cifras representan el negocio completo.</p>':'')+
   '<div class="ed-demo-actions"><button class="button button-outline" type="button" data-act="nav" data-page="leads">Ver Oportunidades</button>'+
   '<button class="button button-primary" type="button" data-act="nav" data-page="reports">Abrir reportes</button></div>'+
   '<p class="ed-health-footnote">No crea datos ficticios ni comparte información de clientes. Solicita autorización antes de mostrar contactos reales a terceros.</p></section>';
 }
 root.edwinIntegrationHealth=Object.freeze({assess,render,demo,renderDemo});
})(globalThis);
