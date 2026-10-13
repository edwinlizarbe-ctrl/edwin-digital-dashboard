(() => {
  'use strict';
  const root = document.getElementById('app');
  const state = {
    theme: localStorage.getItem('edwin_theme') === 'dark' ? 'dark' : 'light',
    user: null, businesses: [], businessId: null, sites: [],
    page: 'resumen', loading: true, loginError: '', loginBusy: false,
    statusError: '', hotmart: null, hotmartLoading: false, hotmartError: '',
  };
  const escape = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (value, code) => {
    try { return new Intl.NumberFormat('es-PE',{style:'currency',currency:code,maximumFractionDigits:2}).format(value); }
    catch { return `${Number(value || 0).toFixed(2)} ${escape(code)}`; }
  };
  const isAdmin = () => state.user?.role === 'admin';
  const selectedBusiness = () => state.businesses.find(b => b.id === state.businessId);
  const safeUrl = v => { try { const u = new URL(v); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  function theme() { document.documentElement.classList.toggle('dark', state.theme === 'dark'); }
  function icon(id) {
    const symbols = {home:'◫',users:'♙',integrations:'⊞',settings:'⚙',moon:'☾',sun:'☀',power:'⏻',site:'↗',chart:'▥',business:'▣',sales:'◆'};
    return symbols[id] || '•';
  }
  async function api(path, opts={}) {
    const res = await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
    const data = await res.json().catch(()=>({error:'Respuesta inesperada del servidor'}));
    if (!res.ok) { const error = new Error(data.error || 'No se pudo completar la consulta'); error.status=res.status; throw error; }
    return data;
  }
  function logo() { return `<div class="logo"><div class="mark">↗</div><div class="brand">edwin digital<small>Client dashboard</small></div></div>`; }
  function themeButton() { return `<button class="theme-toggle" title="Cambiar modo claro/oscuro" data-action="theme" aria-label="Cambiar tema">${state.theme === 'dark' ? '☀ Modo claro' : '☾ Modo oscuro'}</button>`; }
  function renderLogin() {
    root.innerHTML = `<div class="login-screen">
      <div class="login-art">${logo()}<div class="hero"><h1>Tu negocio,<br>más claro que nunca.</h1><p>Visualiza los resultados de tu página web y tus conexiones en un solo lugar, con acceso privado y seguro.</p><div class="hero-points"><span>◉ Google Analytics 4</span><span>◉ Hotmart</span><span>◉ Shopify próximamente</span></div></div><footer>© Edwin Digital · Tu panel de estadísticas</footer></div>
      <main class="login-form-panel">${themeButton()}<div class="login-card"><span class="eyebrow">ACCESO PRIVADO</span><h2>Bienvenido</h2><p>Ingresa con el correo y la contraseña que te proporcionó Edwin Digital.</p>
      ${state.statusError ? `<div class="error">${escape(state.statusError)}</div>` : ''}
      <form id="login-form"><label class="field">Correo electrónico<input name="email" type="email" autocomplete="username" placeholder="correo@empresa.com" required maxlength="254"></label><label class="field">Contraseña<input name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required></label>
      ${state.loginError ? `<div class="error" role="alert">${escape(state.loginError)}</div>` : ''}
      <button class="button full" type="submit" ${state.loginBusy || state.statusError ? 'disabled' : ''}>${state.loginBusy ? '<span class="spinner"></span> Verificando…':'Ingresar a mi dashboard →'}</button></form><div class="fineprint">Acceso exclusivo para clientes de Edwin Digital.</div></div></main></div>`;
  }
  function navItem(page, iconId, title) { return `<button class="nav-item ${state.page === page ? 'active' : ''}" data-action="nav" data-page="${page}"><b>${icon(iconId)}</b><span>${escape(title)}</span></button>`; }
  function header() { return `<div class="dashboard"><aside class="sidebar">${logo()}<div class="nav-links"><div class="nav-label">MENÚ PRINCIPAL</div>${navItem('resumen','home','Resumen')}${isAdmin()?navItem('clientes','users','Clientes'):''}${navItem('integraciones','integrations','Integraciones')}${navItem('configuracion','settings','Configuración')}</div><div class="sidebar-bottom"><div class="user-id"><div class="avatar">${escape((state.user.email || 'E')[0].toUpperCase())}</div><div class="user-details"><strong>${escape(state.user.email)}</strong><small>${isAdmin()?'Administrador':'Cliente'}</small></div></div><button class="button secondary full" data-action="logout">${icon('power')}<span> Salir</span></button></div></aside><div class="main"><header class="topbar"><div class="crumb">Edwin Digital <span class="muted"> / ${escape(state.page[0].toUpperCase()+state.page.slice(1))}</span></div><div class="top-actions">${themeButton()}<span class="user-pill">${isAdmin()?'◈ Superadministrador':'◈ Acceso cliente'}</span></div></header><main class="content">`;
  }
  const tail = '</main></div></div>';
  function headerTitle(kicker,title,desc,right=''){return `<div class="page-title"><div><div class="eyebrow">${kicker}</div><h1>${escape(title)}</h1><p>${escape(desc)}</p></div>${right}</div>`;}
  function picker() { return `<select class="business-picker" id="business-select" aria-label="Seleccionar negocio">${state.businesses.map(b=>`<option value="${escape(b.id)}" ${state.businessId===b.id?'selected':''}>${escape(b.name)}</option>`).join('')}</select>`; }
  function siteList() {
    if(!state.sites.length) return '<div class="empty">Este negocio todavía no tiene sitios web registrados.</div>';
    return state.sites.map(site=>`<div class="site-row"><div class="site-left"><div class="row-icon">↗</div><div><div class="item-title">${escape(site.name)}</div><div class="item-sub">${escape(site.url)}</div></div></div><div>${safeUrl(site.url)?`<a href="${escape(safeUrl(site.url))}" target="_blank" rel="noopener noreferrer" title="Visitar página web">Visitar ↗</a>`:''}</div></div>`).join('');
  }
  function analyticsList() {
    const ga4 = state.sites.filter(s=>s.ga4_property_id);
    return ga4.length ? ga4.map(s=>`<div class="metric-row"><div><div class="item-title">${escape(s.name)}</div><div class="item-sub">Propiedad GA4 ${escape(s.ga4_property_id)}</div></div><span class="tag">Pendiente API</span></div>`).join('') : `<div class="empty">Sin propiedades de Google Analytics 4 vinculadas a este negocio.</div>`;
  }
  function renderResume() {
    const b=selectedBusiness(); const ga4=state.sites.filter(s=>s.ga4_property_id).length;
    return `${headerTitle('PANEL DE ESTADÍSTICAS',isAdmin()?'Vista general':'Mi dashboard',b?`Información disponible de ${b.name}`:'Selecciona un negocio',state.businesses.length>1?picker():'<span class="tag green">Acceso privado</span>')}
    <section class="stat-grid"><div class="stat"><div class="stat-head"><span class="stat-label">Sitios web</span><span class="stat-icon">↗</span></div><div class="stat-value">${state.sites.length}</div><div class="stat-foot">Registrados en el dashboard</div></div><div class="stat"><div class="stat-head"><span class="stat-label">Propiedades GA4</span><span class="stat-icon">▥</span></div><div class="stat-value">${ga4}</div><div class="stat-foot">Datos pendientes de consulta</div></div><div class="stat"><div class="stat-head"><span class="stat-label">Integraciones</span><span class="stat-icon">⊞</span></div><div class="stat-value">${isAdmin() && b?.slug==='edwin-digital'?'1':'0'}</div><div class="stat-foot">Hotmart piloto${isAdmin() && b?.slug==='edwin-digital'?' · credenciales cargadas':''}</div></div></section>
    <div class="panels"><section class="panel"><h2>Páginas web</h2><p class="panel-intro">Sitios que puedes consultar con tu acceso.</p>${siteList()}</section><section class="panel"><h2>Google Analytics 4</h2><p class="panel-intro">Propiedades registradas en Supabase.</p>${analyticsList()}<div class="note">Las cifras de visitas y conversiones aún no están conectadas a la API de GA4. No se muestran datos inventados.</div></section></div>
    ${isAdmin() && b?.slug==='edwin-digital'?hotmartPanel():''}`;
  }
  function hotmartPanel(){
    let body = state.hotmartError?`<div class="error">${escape(state.hotmartError)}</div>`:'';
    if(state.hotmart){
      const h=state.hotmart;
      body += `<div class="sales-figures"><div class="sales-figure"><strong>${h.approved}</strong><small>Ventas aprobadas</small></div><div class="sales-figure"><strong>${h.refunded}</strong><small>Reembolsos y contracargos</small></div><div class="sales-figure"><strong>${h.transactions_examined}</strong><small>Transacciones examinadas</small></div></div>`;
      const currencies=Object.entries(h.gross_by_currency || {});
      if(currencies.length)body+=`<div class="line"></div><div class="item-title">Ingresos brutos por moneda</div>${currencies.map(([code,val])=>`<div class="metric-row"><span>${escape(code)}</span><strong>${escape(money(val,code))}</strong></div>`).join('')}`;
      if(h.products?.length)body+=`<div class="line"></div><div class="item-title">Productos con ventas</div>${h.products.map(p=>`<div class="metric-row"><span>${escape(p.name)}</span><strong>${p.count}</strong></div>`).join('')}`;
      body+=`<div class="note">${escape(h.note)} ${h.incomplete?'La consulta es parcial: hay más páginas por consultar.':''}</div>`;
    }
    return `<section class="panel"><div class="page-title"><div><h2>Hotmart · Edwin Digital</h2><p class="panel-intro">Lectura directa de ventas de los últimos 30 días. Sin n8n ni administración de pagos.</p></div><button class="button" data-action="hotmart" ${state.hotmartLoading?'disabled':''}>${state.hotmartLoading?'<span class="spinner"></span> Consultando…':'Consultar Hotmart ↗'}</button></div>${body||'<div class="note">Pulsa Consultar Hotmart para probar las credenciales de Cloudflare y mostrar información real. Solo el administrador puede utilizar este acceso piloto.</div>'}</section>`;
  }
  function renderClientes(){
    if(!isAdmin())return renderResume();
    return `${headerTitle('GESTIÓN MULTICLIENTE','Mis clientes','Solo tú puedes visualizar todos los negocios registrados.')}
    <section class="stat-grid"><div class="stat"><div class="stat-head"><span class="stat-label">Negocios registrados</span><span class="stat-icon">▣</span></div><div class="stat-value">${state.businesses.length}</div><div class="stat-foot">Cuentas en Supabase</div></div><div class="stat"><div class="stat-head"><span class="stat-label">Clientes separados</span><span class="stat-icon">♙</span></div><div class="stat-value">RLS</div><div class="stat-foot">Acceso controlado por usuario</div></div><div class="stat"><div class="stat-head"><span class="stat-label">Servicio incluido</span><span class="stat-icon">▥</span></div><div class="stat-value" style="font-size:21px">Dashboard</div><div class="stat-foot">Sin suscripción independiente</div></div></section>
    <section class="panel"><h2>Negocios</h2><p class="panel-intro">Selecciona uno para revisar sus sitios web y estadísticas disponibles.</p>${state.businesses.map(b=>`<div class="business-row"><div class="site-left"><span class="row-icon">▣</span><div><div class="item-title">${escape(b.name)}</div><div class="item-sub">${escape(b.slug)}</div></div></div><button class="button secondary" data-action="open-business" data-id="${escape(b.id)}">Ver negocio →</button></div>`).join('')}</section>`;
  }
  function renderIntegraciones(){
    const isPilot=isAdmin() && selectedBusiness()?.slug==='edwin-digital';
    return `${headerTitle('FUENTES DE INFORMACIÓN','Integraciones','Conexiones de consulta; las ventas siguen gestionándose en las plataformas originales.')}
    <div class="connections"><div class="connection"><div class="big-icon">▥</div><h3>Google Analytics 4</h3><p>Mide el tráfico, usuarios y comportamiento del sitio web.</p><span class="tag">${state.sites.some(s=>s.ga4_property_id)?'Propiedad registrada':'Sin propiedad'}</span><div class="line"></div><div class="note">Falta completar la autenticación de servidor con Google Analytics Data API. Aún no se muestran visitas.</div></div>
    <div class="connection"><div class="big-icon">◆</div><h3>Hotmart</h3><p>Consulta autorizada del historial de ventas; sin gestionar pagos.</p><span class="tag">${isPilot?'Piloto Edwin Digital':'No configurado para este negocio'}</span><div class="line"></div><div class="note">${isPilot?'Consulta de prueba disponible desde Resumen; protegida para el administrador.':'Cada cliente deberá autorizar su propia cuenta. No se comparten las credenciales del piloto.'}</div></div>
    <div class="connection"><div class="big-icon">▣</div><h3>Shopify</h3><p>Pedidos e ingresos de tiendas Shopify mediante permisos de consulta.</p><span class="tag">Próximamente</span></div><div class="connection"><div class="big-icon">↗</div><h3>Pasarelas de pago</h3><p>Integración opcional de consulta cuando el proveedor tenga una API adecuada.</p><span class="tag">Según proveedor</span></div></div>`;
  }
  function renderConfig(){return `${headerTitle('ACCESO Y SEGURIDAD','Configuración','Tu sesión y preferencias de visualización.')}
  <section class="panel"><h2>Mi cuenta</h2><div class="metric-row"><span class="muted">Correo</span><strong>${escape(state.user.email)}</strong></div><div class="metric-row"><span class="muted">Rol</span><span class="tag">${isAdmin()?'Superadministrador':'Cliente'}</span></div><div class="metric-row"><span class="muted">Seguridad</span><strong>Supabase Auth + RLS</strong></div><div class="metric-row"><span class="muted">Apariencia</span>${themeButton()}</div><p class="note">Tu sesión utiliza cookies protegidas HttpOnly. Cada cliente visualiza únicamente los negocios autorizados por Supabase.</p></section>`;}
  function render(){theme();if(state.loading){root.innerHTML='<div class="initial-load">Cargando dashboard…</div>';return;} if(!state.user){renderLogin();return;}
    const pages={resumen:renderResume,clientes:renderClientes,integraciones:renderIntegraciones,configuracion:renderConfig};
    root.innerHTML=header()+(pages[state.page]||renderResume)()+tail;
  }
  async function loadBusiness(id){state.businessId=id;state.sites=[];state.hotmart=null;state.hotmartError='';
    try {const out=await api(`/api/sites?business_id=${encodeURIComponent(id)}`);state.sites=out.sites||[];}catch(e){state.hotmartError=e.message;}
    render();
  }
  async function initialize(){state.loading=true;render();
    try {const status=await api('/api/status');if(!status.configured){state.statusError='Falta configurar en Cloudflare: '+status.missing.join(' y ');state.loading=false;render();return;}
      const info=await api('/api/me');state.user=info.user;
      const data=await api('/api/businesses');state.businesses=data.businesses||[];
      state.loading=false;
      if(state.businesses.length){await loadBusiness(state.businesses[0].id);}
    }catch(e){state.user=null;state.loading=false;if(e.status !== 401)state.statusError=e.message;}
    render();
  }
  document.addEventListener('click',async(e)=>{
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if(action==='theme'){state.theme=state.theme==='dark'?'light':'dark';localStorage.setItem('edwin_theme',state.theme);render();return;}
    if(action==='nav'){state.page=el.dataset.page;render();return;}
    if(action==='open-business'){state.page='resumen';await loadBusiness(el.dataset.id);return;}
    if(action==='logout'){try{await api('/api/auth/logout',{method:'POST',body:'{}'});}catch{}state.user=null;state.businesses=[];state.sites=[];state.hotmart=null;state.page='resumen';render();return;}
    if(action==='hotmart'){state.hotmartLoading=true;state.hotmartError='';render();try{const h=await api('/api/hotmart/summary');state.hotmart=h;}catch(err){state.hotmartError=err.message;}finally{state.hotmartLoading=false;render();}}
  });
  document.addEventListener('change',async(e)=>{if(e.target.id==='business-select')await loadBusiness(e.target.value);});
  document.addEventListener('submit',async(e)=>{
    if(e.target.id!=='login-form')return;e.preventDefault();const form=new FormData(e.target);
    state.loginError='';state.loginBusy=true;render();
    try {await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});await initialize();}
    catch(err){state.loginError=err.message;state.loginBusy=false;render();}
  });
  initialize();
})();
