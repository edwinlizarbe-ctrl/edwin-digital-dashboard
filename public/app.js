/* E Digital — nombre provisional del CRM | los datos mostrados proceden de APIs autorizadas. */
(() => {
  'use strict';
  const root = document.getElementById('app');
  const state = {
    user: null, businesses: [], sites: [], businessId: '', siteId: '',
    page: 'overview', analyticMetric: 'totalUsers', period: '7', theme: localStorage.getItem('ed-theme-v3') || 'light',
    loading: true, gaLoading: false, hmLoading: false, ga: null, hm: null,
    gaError: '', hmError: '', startupError: '', loginError: '', loginBusy: false,
    mobileOpen: false, campaignsMenuOpen: true, sidebarCollapsed: localStorage.getItem('ed-sidebar-collapsed') === '1', adminQuery: '', search: '', requestId: 0, tableSort: '', tableDesc: true,
    passwordBusy: false, passwordError: '', loginNotice: '',
    meta: null, metaReport: null, metaLoading: false, metaError: '',
    metaCampaigns: null, adsLoading: false, adsError: '', adsPlatform: 'meta', adsLevel: 'campaign', adsBestOnly: false, adsPeriod: '30', adsCustomStart:'', adsCustomEnd:'', adsAccount:'', adsStatus:'', adsObjective:'', adsSearch:'', adsFilterError:'', campaignConnectionOpen: false, campaignAccountSaving: false, campaignAccountNotice: '', metaPopup:null, campaignWizardStage:'accounts', campaignWizardSelectedIds:null,
    companyBusy: false, companyError: '', companyNotice: '', siteBusy: false, siteError: '', siteNotice: '', editSiteId: '',
    emailBusy: false, emailError: '', emailNotice: '',
    accent: (localStorage.getItem('ed-accent-v7')||'blue')==='purple'?'blue':(localStorage.getItem('ed-accent-v7')||'blue'), sidebarTone: localStorage.getItem('ed-sidebar-v7')||'auto',
    adminHealth: null, adminHealthError: '', adminSetupNotice: '',
    adminFeatureBusiness:'', adminEntitlements:null, adminFeatureLoading:false, adminFeatureBusy:false, adminFeatureError:'', adminFeatureNotice:'', clientEntitlements:null, adminPlans:{}, adminPlansLoaded:false,
    adminAccounts: [], accountsLoaded: false, accountsLoading: false, accountsConfigured: null, accountsError: '', accountNotice: '', emailHistoryUserId:'', emailHistoryData:[], emailHistoryError:'', emailHistoryLoading:false, temporaryAccess: null,
    adminSiteStats: {}, adminStatsLoading: false, adminStatsError: '', metaPanelOpen: false, companyLogoDraft: null,
  };
  const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = v => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(number(v));
  const fmt1 = v => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(number(v));
  const pc = v => `${fmt1(number(v) * 100)}%`;
  const money = (v, code) => { try { return new Intl.NumberFormat('es-PE', { style:'currency', currency:code, maximumFractionDigits:2 }).format(number(v)); } catch { return `${fmt1(v)} ${clean(code)}`; } };
  const duration = s => `${Math.floor(number(s) / 60)}m ${Math.round(number(s) % 60)}s`;
  const business = () => state.businesses.find(b => b.id === state.businessId);
  const companyPrefs = () => state.user?.business_preferences?.[state.businessId] || {};
  const logoStoreKey = () => 'ed-company-logo-v7:'+state.user?.id+':'+state.businessId;
  const getCompanyLogo = () => {try{return localStorage.getItem(logoStoreKey())||'';}catch{return '';}};
  const displayBusiness = () => !isAdmin() && companyPrefs().display_name || business()?.name || 'Mi empresa';
  const companyImage = (size=34) => {
    const logo=getCompanyLogo();
    return logo.startsWith('data:image/')?`<img class="company-logo-image" src="${clean(logo)}" alt="Logotipo de la empresa" width="${size}" height="${size}" />`:icon('building',Math.round(size*.59));
  };
  const periodLabel = () => ({ today:'Hoy', yesterday:'Ayer', '7':'Últimos 7 días', '30':'Últimos 30 días', '90':'Últimos 90 días', '365':'Últimos 12 meses' })[state.period] || 'Últimos 30 días';
  const site = () => state.sites.find(s => s.id === state.siteId);
  const isAdmin = () => state.user?.role === 'admin';
  // Read-only metrics from the currently selected client. No passwords, keys or other tenants.
  window.edigitalAssistantContext = () => {
    const company = state.businesses.find(b => b.id === state.businessId);
    const currentSite = state.sites.find(x => x.id === state.siteId);
    const ga = state.ga?.configured && state.ga?.reports ? state.ga.metrics || null : null;
    const prev = state.ga?.previous_metrics || null;
    const meta = (state.metaReport?.account_reports || []).slice(0, 5).map(x => ({
      name:x.name, currency:x.currency,
      spend:x.metrics?.spend ?? null, clicks:x.metrics?.clicks ?? null,
      impressions:x.metrics?.impressions ?? null, ctr:x.metrics?.ctr ?? null,
      cpc:x.metrics?.cpc ?? null
    }));
    return {
      loggedIn:!!state.user, admin:state.user?.role === 'admin',
      company:company?.name || '', businessId:state.businessId,
      site:currentSite?.name || '', siteId:state.siteId,
      period:state.period, periodLabel:periodLabel(), ga, gaPrevious:prev,
      metaConnected:!!state.meta?.connected, meta,
      topChannels: (state.ga?.reports?.channels||[]).slice(0,5).map(x=>({name:String(x.sessionDefaultChannelGroup||'No identificado'),sessions:Number(x.sessions)||0})),
      topPages: (state.ga?.reports?.pages||[]).slice(0,5).map(x=>({name:String(x.pagePath||'/'),views:Number(x.screenPageViews)||0})),
      topEvents: (state.ga?.reports?.events||[]).slice(0,5).map(x=>({name:String(x.eventName||'Sin nombre'),count:Number(x.eventCount)||0}))
    };
  };

  const gaReady = () => !!(state.ga?.configured && state.ga?.reports);
  const rows = name => state.ga?.reports?.[name] || [];
  const m = () => gaReady() ? state.ga.metrics || {} : {};
  const prev = () => state.ga?.previous_metrics || null;
  // Never attribute global Hotmart pilot credentials to the test customer's business.
  const selectedBusinessIsHotmart = () => false;
  const pages = {
    overview: ['Resumen general', 'layout-dashboard'],
    analytics: ['Analítica web', 'activity'],
    acquisition: ['Adquisición', 'mouse-pointer'],
    campaigns: ['Campañas Ads', 'megaphone'],
    utm: ['Fuentes UTM de GA4', 'mouse-pointer'],
    adminHome: ['Panel administrador', 'layout-dashboard'],
    adminIntegrations: ['Integraciones', 'plug'],
    adminOperations: ['Supervisión', 'activity'],
    audience: ['Audiencia', 'users'],
    content: ['Contenido web', 'file-text'],
    events: ['Eventos y metas', 'target'],
    hotmart: ['Ventas Hotmart', 'shopping-bag'],
    reports: ['Reportes', 'file-bar-chart'],
    clients: ['Mis clientes', 'building'],
    accounts: ['Accesos de clientes', 'users'],
    clientDetail: ['Ficha del cliente', 'building'],
    integrations: ['Integraciones', 'plug'],
    settings: ['Configuración', 'settings'],
    company: ['Mi empresa', 'building'],
  };
  const paths = {
    'layout-dashboard':'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
    activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    'mouse-pointer':'<path d="M5 3l14 9-7 1-3 7z"/><path d="m12 13 4 7"/>',
    megaphone:'<rect x="3" y="10" width="3" height="10" rx="1"/><rect x="10" y="6" width="3" height="14" rx="1"/><rect x="17" y="3" width="3" height="17" rx="1"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    power:'<path d="M12 2v10"/><path d="M6.2 5.7a9 9 0 1 0 11.6 0"/>',
    'panel-left-close':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m8-12-3 3 3 3"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
    camera:'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1-3h6l1 3"/>',
    'file-text':'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    'shopping-bag':'<path d="M4 8h16l-1 13H5zM9 9V6a3 3 0 0 1 6 0v3"/>',
    'file-bar-chart':'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 17v-2m4 2v-5m4 5v-7"/>',
    building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2m3 0h2M9 11h2m3 0h2M9 15h2m3 0h2M10 21v-3h4v3"/>',
    plug:'<path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0V8zm6 10v4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    chevron:'<path d="m9 6 6 6-6 6"/>',
    chevronDown:'<path d="m6 9 6 6 6-6"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>',
    moon:'<path d="M20 14A8 8 0 0 1 10 4 8 8 0 1 0 20 14Z"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-4v4h4M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    logout:'<path d="M9 4H5v16h4m4-12 4 4-4 4m-9-4h9"/>',
    power:'<path d="M12 2v10"/><path d="M6.2 5.8a9 9 0 1 0 11.6 0"/>',
    'panel-left-close':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m8-12-3 3 3 3"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4v.1"/>',
    close:'<path d="M5 5 19 19M19 5 5 19"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrowUp:'<path d="M5 17 17 5M8 5h9v9"/>',
    arrowDown:'<path d="m5 7 12 12m-9 0h9v-9"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    eye:'<path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0z"/><circle cx="12" cy="12" r="3"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    filter:'<path d="M4 5h16l-6 7v7l-4 2v-9z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.3"/>',
    external:'<path d="M13 4h7v7m0-7-9 9M20 14v6H4V4h6"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    spark:'<path d="m12 3 1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5Z"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  };
  const icon = (name, size=19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.activity}</svg>`;
  const brand = large => `<div class="brand ${large ? 'brand-large' : ''}" aria-label="Edwin CRM"><span class="crm-brand-mark" aria-hidden="true">${icon('layout-dashboard',20)}</span><div class="brand-word">Edwin <span>CRM</span></div></div>`;

  async function api(path, options={}) {
    // Ensure a stalled authentication service does not leave the splash screen forever.
    const startup = ['/api/status','/api/me','/api/businesses'].includes(path.split('?')[0]);
    const controller = startup ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 18000) : null;
    let res;
    try {
      res = await fetch(path, { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, ...options, ...(controller ? { signal:controller.signal } : {}) });
    } catch (error) {
      if(controller?.signal.aborted) throw new Error('La conexión tardó demasiado. Comprueba tu internet e intenta ingresar nuevamente.');
      throw error;
    } finally {
      if(timer !== null) clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const error = new Error(data.error || `Error de servidor: ${res.status}`); error.status = res.status; throw error; }
    return data;
  }
  function setTheme() { document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.accent = state.accent;
    document.documentElement.dataset.sidebarTone = state.sidebarTone;
  }
  const tag = (label, type='neutral') => `<span class="tag tag-${type}"><span class="tag-dot"></span>${clean(label)}</span>`;
  const alertBlock = (text, type='warning') => `<div class="alert-block ${type}">${icon(type==='warning'?'alert':'info',18)}<div>${clean(text)}</div></div>`;
  const empty = (text, title='Aún no hay datos') => `<div class="empty-data"><span class="empty-icon">${icon('activity',25)}</span><strong>${clean(title)}</strong><span>${clean(text)}</span></div>`;
  function dataPlaceholder() {
    if(!featureEnabled('ga4'))return empty('Esta empresa no tiene habilitado Google Analytics en su panel.','Integración no incluida');
    if (state.gaLoading) return `<div class="ga-loading-state" role="status" aria-live="polite"><div class="ga-loading-heading"><span class="ga-loading-pulse">${icon('activity',23)}</span><span><strong>Preparando tu análisis…</strong><small>Consultando las visitas y eventos reales de Google Analytics.</small></span></div><div class="ga-loading-bars"><i></i><i></i><i></i></div></div>`;
    if (!state.businesses.length) return empty('Tu cuenta no tiene negocios autorizados. El administrador debe asignarte uno.', 'Falta vincular un negocio');
    if (!state.sites.length) return empty('No hay sitios asignados al negocio seleccionado.', 'Falta registrar el sitio');
    if (!state.siteId) return empty('Selecciona un sitio que tenga un ID de propiedad GA4.', 'Falta vincular Analytics');
    return empty(state.gaError || 'Esta propiedad todavía no tiene una conexión disponible.', 'Conexión pendiente');
  }
  const card = (title,subtitle,body,actions='') => `<section class="card"><div class="card-heading"><div><h3>${clean(title)}</h3>${subtitle?`<p>${clean(subtitle)}</p>`:''}</div>${actions}</div>${body}</section>`;
  const tip = content => `<span class="info-tip" title="${clean(content)}">${icon('info',15)}</span>`;
  function trendFor(key, asPct=false) {
    if (!gaReady() || !prev() || !Number.isFinite(Number(prev()[key])) || !Number.isFinite(Number(m()[key]))) return '';
    const cur = asPct ? number(m()[key])*100 : number(m()[key]);
    const old = asPct ? number(prev()[key])*100 : number(prev()[key]);
    if (old === 0) return `<span class="delta-muted">Sin base anterior</span>`;
    const delta = (cur-old)/Math.abs(old)*100;
    const cls = delta >= 0 ? 'up' : 'down';
    return `<span class="delta ${cls}">${icon(delta>=0?'arrowUp':'arrowDown',13)}${fmt1(Math.abs(delta))}%</span><span class="delta-note">vs. período anterior</span>`;
  }
  function miniSpark(key, color) {
    const list = rows('trend').slice(-20);
    if (!gaReady() || list.length<2) return `<div class="mini-graphic muted-mini"></div>`;
    const max = Math.max(1, ...list.map(r=>number(r[key])));
    const coords = list.map((r,i)=>`${(i/(list.length-1)*126).toFixed(1)},${(38-number(r[key])/max*34).toFixed(1)}`).join(' ');
    return `<svg class="mini-graphic" viewBox="0 0 128 44" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function kpi(label,value,iconName,color,trendKey,sparkKey,note) {
    return `<article class="kpi"><div class="kpi-header"><div class="kpi-icon ${color}">${icon(iconName,20)}</div><span class="kpi-dots">···</span></div><div class="kpi-name">${clean(label)}${note?tip(note):''}</div><div class="kpi-value">${value}</div><div class="kpi-bottom"><div class="kpi-change">${trendFor(trendKey)}</div>${miniSpark(sparkKey,color==='purple'?'#2563EB':color==='cyan'?'#00b8e6':color==='coral'?'#f56b7f':'#40bb9d')}</div></article>`;
  }
  function mainKpis(interactive=false) {
    if(state.gaLoading)return '<div class="kpi-grid" role="status" aria-label="Cargando estadísticas">'+[1,2,3,4].map(()=>'<div class="ga-skeleton-kpi"><span class="ga-skeleton-shine"></span><span class="ga-skeleton-value"></span><span class="ga-skeleton-note"></span></div>').join('')+'</div>';
    const ok=gaReady(), v=m();
    const selectable=(html,key)=>interactive?html.replace('<article class="kpi">',`<button type="button" class="kpi analytic-primary-pick ${(state.page==='overview'?state.overviewMetric:state.analyticMetric)===key?'selected':''}" data-act="analytic-select" data-metric="${key}" aria-pressed="${(state.page==='overview'?state.overviewMetric:state.analyticMetric)===key}">`).replace('</article>','</button>'):html;
    return `<div class="kpi-grid">${selectable(kpi('Usuarios totales',ok?fmt(v.totalUsers):'—','users','purple','totalUsers','totalUsers'),'totalUsers')}${selectable(kpi('Sesiones',ok?fmt(v.sessions):'—','activity','cyan','sessions','sessions'),'sessions')}${selectable(kpi('Vistas de páginas',ok?fmt(v.screenPageViews):'—','eye','coral','screenPageViews','screenPageViews'),'screenPageViews')}${selectable(kpi('Eventos clave',ok?fmt(v.keyEvents):'—','target','mint','keyEvents','keyEvents','Eventos que tu propiedad GA4 haya marcado como clave.'),'keyEvents')}</div>`;
  }
  const dateLabel = val => { const v=String(val || ''); return /^\d{8}$/.test(v) ? `${v.slice(6,8)}/${v.slice(4,6)}` : /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8)}/${v.slice(5,7)}` : v; };
  function chart(data,k1,label1,k2='',label2='',height=288) {
    if (!data?.length) return empty('No se han registrado datos durante este período.');
    const list=data.slice(-365), W=880, H=height, L=48,R=16,T=14,B=40, innerW=W-L-R,innerH=H-T-B;
    const max = Math.max(1,...list.flatMap(r=>[number(r[k1]),...(k2?[number(r[k2])]:[])]))*1.12;
    const x=i=>L+i*innerW/Math.max(1,list.length-1), y=v=>T+innerH*(1-number(v)/max);
    const coords=k=>list.map((r,i)=>`${x(i).toFixed(2)},${y(r[k]).toFixed(2)}`).join(' ');
    const area=list.length===1?'':`${x(0)},${H-B} ${coords(k1)} ${x(list.length-1)},${H-B}`;
    const stripes=[0,1,2,3,4].map(i=>{
      const v=max*(4-i)/4, yy=T+i*innerH/4;
      return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="plot-grid"/><text x="${L-9}" y="${yy+4}" text-anchor="end" class="plot-tick">${fmt(v)}</text>`;
    }).join('');
    const tickIdx=[0,1,2,3,4,5].map(i=>Math.round((list.length-1)*i/5)).filter((n,i,a)=>a.indexOf(n)===i);
    const xticks=tickIdx.map(i=>`<text x="${x(i)}" y="${H-11}" text-anchor="middle" class="plot-tick">${clean(dateLabel(list[i]?.date))}</text>`).join('');
    const spots=list.length<=80 ? list.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r[k1])}" r="5" class="chart-spot" tabindex="0" role="img" aria-label="Dato diario"><title>${clean(dateLabel(r.date))} · ${clean(label1)}: ${fmt(r[k1])}</title></circle>${k2?`<circle cx="${x(i)}" cy="${y(r[k2])}" r="5" class="chart-spot" tabindex="0" role="img" aria-label="Dato diario"><title>${clean(dateLabel(r.date))} · ${clean(label2)}: ${fmt(r[k2])}</title></circle>`:''}`).join(''):'';
    const gradId=`grad-${clean(k1)}-${height}`;
    return `<div class="chart-legend"><span><i class="legend-chip purple"></i>${clean(label1)}</span>${k2?`<span><i class="legend-chip cyan"></i>${clean(label2)}</span>`:''}</div><div class="chart-holder"><svg viewBox="0 0 ${W} ${H}" class="plot" role="img" aria-label="Evolución real de ${clean(label1)}"><defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2563EB" stop-opacity=".23"/><stop offset="1" stop-color="#2563EB" stop-opacity="0"/></linearGradient></defs>${stripes}<polygon points="${area}" fill="url(#${gradId})"/>${list.length>1?`<polyline points="${coords(k1)}" class="plot-line-a"/>`:''}${k2&&list.length>1?`<polyline points="${coords(k2)}" class="plot-line-b"/>`: ''}${spots}${xticks}</svg></div>`;
  }
  function filterList(data) { const q=state.search.trim().toLowerCase(); return q?data.filter(x=>Object.values(x).some(v=>String(v).toLowerCase().includes(q))):data; }

  const friendlyChannel = value => {
    const raw=String(value||'').trim(), key=raw.toLowerCase();
    const labels={
      'direct':'Acceso directo','organic search':'Búsquedas gratuitas',
      'paid search':'Anuncios en buscadores','paid social':'Anuncios en redes sociales',
      'organic social':'Redes sociales (sin anuncios)','referral':'Enlaces desde otras páginas',
      'email':'Correos electrónicos','display':'Anuncios gráficos',
      'cross-network':'Publicidad en varias redes','organic video':'Videos sin anuncios',
      'paid video':'Publicidad en video','organic shopping':'Compras sin anuncios',
      'paid shopping':'Anuncios de compras','paid other':'Otros anuncios de pago',
      'other':'Otros canales','(other)':'Otros canales','unassigned':'Canal sin identificar',
      '(not set)':'Sin identificar'
    };
    return labels[key]||raw||'Sin identificar';
  };
  const friendlyTrafficSource = rawValue => {
    const raw=String(rawValue||'').trim(),parts=raw.split(/\s*\/\s*/);
    const src=(parts[0]||'').toLowerCase(),med=(parts[1]||'').toLowerCase();
    if(['(data not available)','(not set)','(not provided)',''].includes(src))return 'Origen sin identificar';
    if(src==='(direct)'&&(med==='(none)'||!med))return 'Acceso directo al sitio';
    const names={ig:'Instagram',instagram:'Instagram',fb:'Facebook',facebook:'Facebook',
      'm.facebook.com':'Facebook (celular)','l.facebook.com':'Facebook','facebook.com':'Facebook',
      'eventsmanager.facebook.com':'Administrador de eventos de Meta',google:'Google',
      bing:'Bing',tiktok:'TikTok',youtube:'YouTube',email:'Correo electrónico'};
    const media={paid:'publicidad pagada',cpc:'publicidad pagada',ppc:'publicidad pagada',
      'paid-social':'publicidad pagada',paidsocial:'publicidad pagada',
      organic:'visitas orgánicas',referral:'enlace desde otra web',
      email:'correo electrónico',social:'redes sociales',none:'origen sin definir',
      '(none)':'origen sin definir',display:'publicidad gráfica'};
    const label=names[src]||(src==='an'?'Origen «an» (sin identificar)':parts[0]||'Origen desconocido');
    return label+(media[med]||med?' · '+(media[med]||med):'');
  };
  const countries = ['Alemania','Argentina','Australia','Austria','Bélgica','Bolivia','Brasil','Canadá','Chile','China',
    'Colombia','Corea del Sur','Costa Rica','Cuba','Dinamarca','Ecuador','Egipto','El Salvador','Emiratos Árabes Unidos',
    'España','Estados Unidos','Filipinas','Finlandia','Francia','Guatemala','Honduras','India','Indonesia','Irlanda',
    'Israel','Italia','Japón','México','Nicaragua','Noruega','Nueva Zelanda','Países Bajos','Panamá','Paraguay','Perú',
    'Polonia','Portugal','Puerto Rico','Reino Unido','República Dominicana','Singapur','Sudáfrica','Suecia','Suiza',
    'Tailandia','Turquía','Ucrania','Uruguay','Venezuela','Vietnam'];
  function countrySelect(value){
    const current=String(value||'Perú').trim()||'Perú',arr=countries.includes(current)?countries:[...countries,current];
    return '<select class="simple-input country-select" name="country" required aria-label="País de mi empresa">'+arr.map(v=>'<option value="'+clean(v)+'"'+(v===current?' selected':'')+'>'+clean(v)+'</option>').join('')+'</select>';
  }

  function barList(data,labelKey,valueKey,maxRows=7,formatter=fmt) {
    const list=filterList(data||[]).slice(0,maxRows);
    if (!list.length) return empty(state.search?'No hay resultados para tu búsqueda.':'Sin información para este período.');
    const top=Math.max(1,...list.map(r=>number(r[valueKey])));
    return `<div class="bar-list">${list.map((r,i)=>`<div class="bar-item"><div class="bar-row"><span title="${clean(r.rawSource||r[labelKey])}"><b class="bar-index">${String(i+1).padStart(2,'0')}</b>${clean(r[labelKey]||'(sin identificar)')}</span><strong>${clean(formatter(r[valueKey]))}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,number(r[valueKey])/top*100)).toFixed(2)}%"></div></div></div>`).join('')}</div>`;
  }
  function popularPagesOverview(){
    const pages=rows('pages')||[];
    if(!pages.length)return empty('Sin información de páginas para este período.');
    const total=Number(m().screenPageViews),sum=pages.reduce((n,p)=>n+Math.max(0,number(p.screenPageViews)),0),base=total>0?total:sum;
    return '<div class="bar-list">'+pages.slice(0,6).map((p,i)=>{
      const raw=String(p.pagePath||'/'),path=raw.split('?')[0],name=path==='/'?'Página de inicio':(path.split('/').filter(Boolean).pop()||'Página de inicio').replace(/[-_]+/g,' ').replace(/\.[a-z0-9]+$/i,'');
      const views=Math.max(0,number(p.screenPageViews)),share=base?views/base*100:0;
      return '<div class="bar-item"><div class="bar-row"><button type="button" class="text-action" data-act="page-detail" data-path="'+clean(raw)+'" title="Ver estadísticas de '+clean(raw)+'"><b class="bar-index">'+String(i+1).padStart(2,'0')+'</b>'+clean(name)+'</button><strong>'+fmt(views)+' · '+share.toFixed(1)+'%</strong></div><div class="bar-track"><div class="bar-fill" style="width:'+Math.min(100,share).toFixed(2)+'%"></div></div></div>';
    }).join('')+'</div><button type="button" class="text-action" data-act="nav" data-page="content">Consultar estadísticas de las páginas →</button>';
  }
  function cleanRows(data){return filterList(data||[]);}
  function dataTable(list,cols,max=25) {
    let results=cleanRows(list);
    if (!results.length) return empty(state.search?'No encontramos coincidencias.':'No hay filas para mostrar.');
    if (state.tableSort) {
      const col=cols.find(c=>c.key===state.tableSort);
      if(col) results=[...results].sort((a,b)=>{
        const va=a[col.key],vb=b[col.key],diff=typeof va==='number'&&typeof vb==='number'?va-vb:String(va||'').localeCompare(String(vb||''),'es');
        return state.tableDesc?-diff:diff;
      });
    }
    const cut=results.slice(0,max);
    return `<div class="table-scroller"><table class="data-table"><thead><tr>${cols.map(c=>`<th><button type="button" class="sort-button" data-act="sort" data-key="${clean(c.key)}">${clean(c.label)} ${state.tableSort===c.key?(state.tableDesc?'↓':'↑'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${cut.map(row=>`<tr>${cols.map((c,i)=>`<td ${i?'class="numeric"':''}>${clean(c.display?c.display(row[c.key],row):row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-footer">${fmt(cut.length)} de ${fmt(results.length)} registros visibles · Exporta CSV para guardar los datos disponibles</div>`;
  }
  function donut(data,labelKey,valueKey) {
    const list=(data||[]).filter(r=>number(r[valueKey])>0).slice(0,5);
    if(!list.length)return empty('No hay fuentes registradas para este período.');
    const total=list.reduce((a,r)=>a+number(r[valueKey]),0),palette=['#2563EB','#00c8e9','#fd708a','#3bc5a9','#f6bd66'];
    let soFar=0;
    const parts=list.map((r,i)=>{const percent=number(r[valueKey])/total*100,start=soFar;soFar+=percent;return `${palette[i]} ${start.toFixed(3)}% ${soFar.toFixed(3)}%`;});
    return `<div class="donut-layout"><div class="donut-chart" style="background:conic-gradient(${parts.join(',')})"><div class="donut-center"><span>Sesiones</span><strong>${fmt(total)}</strong><small>Top 5 canales</small></div></div><div class="donut-legend">${list.map((r,i)=>`<div><span class="donut-name" title="${clean(({ 'Anuncios en redes sociales':'Visitas desde anuncios en redes sociales.', 'Acceso directo':'Visitas sin una fuente de referencia identificada.', 'Otros canales':'Sesiones agrupadas por Google Analytics en otros canales.', 'Sin identificar':'Google Analytics no pudo clasificar estas visitas.', 'Canal sin identificar':'Google Analytics no pudo asignar estas visitas a un canal.', 'Búsquedas gratuitas':'Visitas desde resultados no pagados de buscadores.', 'Enlaces desde otras páginas':'Visitas por enlaces en otros sitios web.', 'Redes sociales (sin anuncios)':'Visitas desde publicaciones sin publicidad pagada.' })[r[labelKey]]||'Canal de origen de las sesiones registrado por Google Analytics.')}"><i style="background:${palette[i]}"></i>${clean(r[labelKey]||'Sin identificar')}</span><b>${fmt1(number(r[valueKey])/total*100)}%</b></div>`).join('')}</div></div>`;
  }
  function flags() {
    const warnings=state.ga?.warnings||[];
    const items=[];
    if(!gaReady())items.push(state.gaError || 'Los datos GA4 no están disponibles para este sitio.');
    if(warnings.length)items.push(`${warnings.length} secciones de GA4 no devolvieron información. Revisa los permisos y las métricas de la propiedad.`);
    return items.map(x=>alertBlock(x)).join('');
  }
  function readableTime() { return state.ga?.updated_at?new Date(state.ga.updated_at).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'Pendiente de conexión'; }
  function statusStrip() {return `<div class="status-strip"><div class="status-left">${state.gaLoading?'<span class="ga-status-spinner" aria-hidden="true"></span>':''}${tag(gaReady()?'Google Analytics conectado':state.gaLoading?'Cargando Analytics…':'GA4 pendiente',gaReady()?'success':'neutral')}<span class="strip-divider"></span><span>${icon('clock',15)} Última consulta: ${clean(readableTime())}</span></div><span class="strip-right">${clean(site()?.name||business()?.name||'Elige un negocio')}</span></div>${state.period==='today'?`<div class="period-disclaimer">${icon('info',15)} Estás viendo el día de hoy (según la zona horaria de GA4). Estas cifras pueden estar incompletas porque Analytics no es un informe en tiempo real.</div>`:''}`;}
  function insights() {
    if(!gaReady())return dataPlaceholder();
    const user=m(), previous=prev(), ch=rows('channels'), pagesArr=rows('pages'), top=ch[0], page=pagesArr[0];
    const lines=[];
    const trend=(key,label,advice)=>{
      const now=Number(user[key]),before=Number(previous?.[key]);
      if(!previous||previous[key]==null||user[key]==null||!Number.isFinite(now)||!Number.isFinite(before)||before<=0)return;
      const diff=(now-before)/before*100;
      if(Math.abs(diff)<10)return;
      lines.push({symbol:diff<0?'activity':'chart-bar',title:label+' '+(diff<0?'bajó':'subió')+' '+Math.abs(diff).toFixed(1)+'%',desc:advice});
    };
    trend('sessions','Las sesiones','Revisa Adquisición para comparar los canales de este período con el anterior.');
    trend('totalUsers','Los usuarios','Consulta qué canales y páginas concentraron las visitas.');
    trend('keyEvents','Los eventos clave','Comprueba en Eventos y metas qué acciones fueron registradas; no necesariamente representan ventas.');
    if(Number(user.keyEvents)===0)lines.push({symbol:'target',title:'Sin eventos clave registrados',desc:'GA4 indica cero eventos clave en el período. Revisa su configuración antes de interpretar el dato como ausencia de contactos o ventas.'});
    if(top)lines.push({symbol:'mouse-pointer',title:'Canal principal',desc:friendlyChannel(top.sessionDefaultChannelGroup)+' registró '+fmt(top.sessions)+' sesiones. Consulta Adquisición para analizar su evolución.'});
    if(page)lines.push({symbol:'file-text',title:'Página más vista',desc:(page.pagePath||'/')+' acumuló '+fmt(page.screenPageViews)+' visualizaciones. Revisa su contenido y resultados asociados.'});
    if(!lines.length)lines.push({symbol:'activity',title:'Sin señales destacadas',desc:'No hay datos comparables suficientes para señalar cambios relevantes. Revisa otras fechas o comprueba tu conexión GA4.'});
    return '<div class="insight-list">'+lines.slice(0,4).map(x=>'<div class="insight-item"><div class="insight-icon">'+icon(x.symbol==='chart-bar'?'activity':x.symbol,18)+'</div><div><strong>'+clean(x.title)+'</strong><p>'+clean(x.desc)+'</p></div></div>').join('')+'</div><p class="fine-print">Observaciones basadas en GA4 para '+clean(periodLabel())+'. Los cambios requieren una base anterior válida; no se infieren causas ni ventas.</p>';
  }

  function connectionOverview(){
    const sources=[
      ['Google Analytics 4',gaReady()?'Conectado':'Pendiente','analytics',gaReady()?'Informes web disponibles':'Sin propiedad GA4 autorizada'],
      ['Meta Ads',state.meta?.connected?'Conectado':state.meta?.configured?'Listo para conectar':'Pendiente','campaigns',state.meta?.connected?'Campañas disponibles según las cuentas autorizadas':'Completa la conexión en Integraciones'],
      ['Google Ads','Próximamente','campaigns','API pendiente'],
      ['TikTok Ads','Próximamente','campaigns','API pendiente'],
      ['LinkedIn Ads','Próximamente','campaigns','API pendiente']
    ];
    return `<div class="connection-overview">${sources.map(([name,status,page,detail])=>`<div class="connection-row"><div><b>${clean(name)}</b><small>${clean(detail)}</small></div>${tag(status,status==='Conectado'?'success':'neutral')}</div>`).join('')}<div class="connection-actions"><button class="button button-outline" data-act="nav" data-page="integrations">${icon('plug',16)} Gestionar integraciones</button><button class="button button-soft" data-act="nav" data-page="campaigns">${icon('megaphone',16)} Campañas Ads</button></div></div>`;
  }

  function connectedAdsOverview(){
 const reports=state.metaReport?.account_reports||[];
 if(!state.meta?.connected||reports.length===0)return '';
 const cards=reports.map(report=>{
  const m=report.metrics,cur=report.currency||'';
  const metrics=m?`<div class="ads-source-metrics">
  <div><span>Inversión</span><b>${m.spend==null?'—':clean(money(m.spend,cur))}</b></div>
  <div><span>Clics</span><b>${metaMetric(m.clicks)}</b></div>
  <div><span>Impresiones</span><b>${metaMetric(m.impressions)}</b></div>
  <div><span>CTR</span><b>${m.ctr==null?'—':metaMetric(m.ctr,2)+'%'}</b></div>
  <div><span>CPC</span><b>${m.cpc==null?'—':clean(money(m.cpc,cur))}</b></div></div>`:'<p class="fine-print">No hay resultados de esta cuenta en el período.</p>';
  return `<div class="ads-source-kpi"><div class="ads-source-title"><strong>${clean(report.name||'Cuenta Meta Ads')}</strong><small>${clean(cur)}</small></div>${metrics}</div>`;
 }).join('');
 return `<div class="content-grid"><div class="col-12">${card('Campañas conectadas · Meta Ads','Datos de tus cuentas publicitarias, separados por moneda · '+periodLabel(),cards+'<div class="connection-actions"><button class="button button-outline" data-act="nav" data-page="campaigns">Ver campañas</button></div>')}</div></div>`;
}
    function businessPulse(){
    if(!gaReady())return '<section class="business-pulse" aria-label="Resumen inteligente"><div><span class="pulse-kicker">TU NEGOCIO EN UN VISTAZO</span><h2>¿Cómo va tu negocio?</h2><p>Conecta Google Analytics 4 para visualizar cambios comprobables en tus visitas.</p></div></section>';
    const current=m(),previous=prev(),metrics=[['Usuarios','totalUsers'],['Sesiones','sessions'],['Vistas de páginas','screenPageViews'],['Eventos clave','keyEvents']];
    const findings=metrics.map(([label,key])=>{
      const now=Number(current[key]),before=Number(previous?.[key]);
      if(!Number.isFinite(now)||!previous||previous[key]==null||!Number.isFinite(before)||before<=0)return null;
      const change=(now-before)/before*100;
      return {label,change,description:label+' '+(change>0?'aumentaron':change<0?'disminuyeron':'se mantuvieron')+' '+(change===0?'sin variación':Math.abs(change).toFixed(1)+'%')+' respecto al período anterior.'};
    }).filter(Boolean);
    const highlight=findings.slice().sort((a,b)=>Math.abs(b.change)-Math.abs(a.change))[0];
    const message=highlight?highlight.description:'Tienes estadísticas disponibles. Aún no hay un período anterior comparable para calcular variaciones fiables.';
    return '<section class="business-pulse" aria-label="Resumen inteligente del negocio"><div><span class="pulse-kicker">TU NEGOCIO EN UN VISTAZO · '+clean(periodLabel())+'</span><h2>¿Cómo va tu negocio?</h2><p>'+clean(message)+'</p><small>Comparación descriptiva de GA4; las variaciones no explican por sí solas sus causas.</small></div><button class="button button-outline" type="button" data-act="nav" data-page="analytics">Explorar métricas '+icon('chevron',15)+'</button></section>';
  }
  function overviewMetricPicker(){
    const options=[['totalUsers','Usuarios','users'],['sessions','Sesiones','sessions'],['screenPageViews','Páginas','pages'],['keyEvents','Eventos clave','events']];
    return '<div class="overview-metric-picker" role="group" aria-label="Seleccionar indicador del gráfico">'+options.map(([key,label,kind])=>'<button type="button" class="overview-metric-button metric-'+kind+(state.overviewMetric===key?' selected':'')+'" data-act="analytic-select" data-metric="'+key+'" aria-pressed="'+(state.overviewMetric===key)+'">'+label+'</button>').join('')+'</div>';
  }
  function overview() {
    const ok=gaReady();
    return `${heading('Vista general','Todo tu negocio, en una sola vista','Visualiza el rendimiento del sitio y las conversiones registradas, con datos reales.')}${statusStrip()}${mainKpis(true)}${businessPulse()}<div class="content-grid"><div class="col-8">${card('¿Cómo evolucionan las visitas a tu web?',`Selecciona un indicador · ${periodLabel()} · ${{totalUsers:'Personas que visitaron tu web',sessions:'Visitas realizadas a tu web',screenPageViews:'Páginas visualizadas',keyEvents:'Acciones importantes configuradas en GA4'}[state.overviewMetric]||'Personas que visitaron tu web'}`,overviewMetricPicker()+( ok?chart(rows('trend'),(['totalUsers','sessions','screenPageViews','keyEvents'].includes(state.overviewMetric)?state.overviewMetric:'totalUsers'),({totalUsers:'Usuarios totales',sessions:'Sesiones',screenPageViews:'Vistas de páginas',keyEvents:'Eventos clave'})[state.overviewMetric]||'Usuarios totales'):dataPlaceholder() ))}</div><div class="col-4">${card('¿Cómo llegan las personas a tu web?','Visitas desde Google, redes sociales, enlaces y otras fuentes',ok?donut(rows('channels').map(r=>({...r,channelLabel:friendlyChannel(r.sessionDefaultChannelGroup)})),'channelLabel','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Páginas más visitadas','Descubre qué páginas reciben más visitas',ok?popularPagesOverview():dataPlaceholder())}</div><div class="col-5">${card('Centro de oportunidades','Señales reales para revisar en tu negocio',insights())}</div></div>${selectedBusinessIsHotmart()?hotmartRibbon():''}<div class="spacer-lg"></div>${card('Mis integraciones','Las fuentes conectadas alimentan sus reportes en tu empresa',connectionOverview())}${connectedAdsOverview()}${flags()}`;
  }
  function heading(kicker,title,subtitle){const downloadable=['overview','analytics','acquisition','utm','audience','content','events','reports'].includes(state.page);return `<div class="page-title"><div><div class="eyebrow">${clean(kicker)}</div><h1>${clean(title)}</h1><p>${clean(subtitle)}</p></div>${downloadable?`<button class="button button-outline title-export" data-act="csv">${icon('download',17)} Exportar CSV</button>`:''}</div>`;}
  function detailKpis() {
    const v=m(),ok=gaReady(), series=rows('trend_detail');
    const specs=[
      ['Usuarios activos','activeUsers',fmt,false],['Usuarios nuevos','newUsers',fmt,false],
      ['Sesiones con interacción','engagedSessions',fmt,false],['Tasa de interacción','engagementRate',pc,true],
      ['Rebote','bounceRate',pc,true],['Eventos totales','eventCount',fmt,false],
      ['Tiempo medio de sesión','averageSessionDuration',duration,false],
      ['Tasa de sesión con evento clave','sessionKeyEventRate',pc,true]
    ];
    return `<div class="small-kpis analytic-visual-kpis">${specs.map(([label,key,format,isRate])=>{
      const usable=ok&&series.length>1&&series.filter(r=>r[key]!==null&&r[key]!==undefined&&r[key]!==''&&Number.isFinite(Number(r[key]))).length>1;
      const points=usable?series.filter(r=>r[key]!==null&&r[key]!==undefined&&r[key]!==''&&Number.isFinite(Number(r[key]))).slice(-30):[];
      const max=Math.max(1,...points.map(r=>Number(r[key])));
      const line=points.map((r,i)=>`${(i/(points.length-1)*128).toFixed(1)},${(34-30*Number(r[key])/max).toFixed(1)}`).join(' ');
      const visual=points.length>1?`<svg class="analytic-mini-chart" viewBox="0 0 128 40" role="img" aria-label="Evolución diaria de ${clean(label)}"><polyline points="${line}" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`:isRate&&ok&&Number.isFinite(Number(v[key]))?`<div class="analytic-rate-track" role="img" aria-label="${clean(label)}: ${format(v[key])}"><span style="width:${Math.min(100,Math.max(0,Number(v[key])*100))}%"></span></div>`:'<span class="analytic-chart-unavailable">Sin evolución diaria disponible</span>';
      return `<button type="button" class="small-kpi analytic-metric-pick ${state.overviewMetric===key?'selected':''}" data-act="analytic-select" data-metric="${key}" aria-pressed="${state.overviewMetric===key}"><span>${clean(label)}</span><strong>${ok&&v[key]!=null?format(v[key]):'—'}</strong>${visual}${trendFor(key,isRate)}</button>`;
    }).join('')}</div>`;
  }
  function analytics(){
    const metrics={
      totalUsers:['Usuarios totales','totalUsers','trend'],sessions:['Sesiones','sessions','trend'],screenPageViews:['Vistas de páginas','screenPageViews','trend'],keyEvents:['Eventos clave','keyEvents','trend'],
      activeUsers:['Usuarios activos','activeUsers'],newUsers:['Usuarios nuevos','newUsers'],
      engagedSessions:['Sesiones con interacción','engagedSessions'],engagementRate:['Tasa de interacción','engagementRate'],
      bounceRate:['Porcentaje de rebote','bounceRate'],eventCount:['Eventos totales','eventCount'],
      averageSessionDuration:['Tiempo medio de sesión','averageSessionDuration'],
      sessionKeyEventRate:['Sesiones con eventos clave (%)','sessionKeyEventRate']
    };
    const chosen=metrics[state.analyticMetric]||metrics.totalUsers;
    const records=rows(chosen[2]||'trend_detail').filter(r=>r[chosen[1]]!==null&&r[chosen[1]]!==undefined&&r[chosen[1]]!==''&&Number.isFinite(Number(r[chosen[1]])));
    const graph=gaReady()&&records.length>1?chart(records,chosen[1],chosen[0],'','',310):empty('GA4 aún no entrega suficientes datos diarios para esta métrica.','Sin evolución diaria');
    return `${heading('Analítica web','Así está rindiendo tu web','Selecciona una tarjeta para ver su evolución en el gráfico grande.')}${statusStrip()}${mainKpis(true)}${detailKpis()}<div class="content-grid"><div class="col-12">${card('Evolución de '+chosen[0],'Gráfico diario de la métrica seleccionada · datos de Google Analytics 4',graph)}</div><div class="col-12">${card('Tráfico y visualizaciones','Vistas y sesiones registradas',gaReady()?chart(rows('trend'),'screenPageViews','Vistas de página','sessions','Sesiones',290):dataPlaceholder())}</div><div class="col-6">${card('Sesiones por dispositivo','Celular, computadora y tablet',gaReady()?donut(rows('devices'),'deviceCategory','sessions'):dataPlaceholder())}</div><div class="col-6">${card('Navegadores de tus usuarios','Navegadores desde los que visitan tu sitio',gaReady()?barList(rows('browsers'),'browser','totalUsers'):dataPlaceholder())}</div></div>${flags()}`;
  }
  function acquisition(){return `${heading('Adquisición','Descubre cómo llegan a tu sitio','Mira si las personas llegan desde búsquedas, anuncios, redes sociales, enlaces o directamente.')}${statusStrip()}<div class="content-grid"><div class="col-5">${card('¿Por dónde llegan las visitas?','Distribución de sesiones según su origen',gaReady()?donut(rows('channels').map(r=>({...r,channelLabel:friendlyChannel(r.sessionDefaultChannelGroup)})),'channelLabel','sessions'):dataPlaceholder())}</div><div class="col-7">${card('¿Desde qué sitios llegan?','Sitios y plataformas que envían visitas, según GA4',gaReady()?barList(rows('sources').map(r=>({...r,sourceLabel:friendlyTrafficSource(r.sessionSourceMedium),rawSource:r.sessionSourceMedium})),'sourceLabel','sessions',10)+'<p class="traffic-glossary">Publicidad pagada = anuncios. Acceso directo = no se identificó otro origen. Enlace desde otra web = visitas procedentes de otra página. Pasa el cursor sobre una fuente para ver su código original de GA4.</p>':dataPlaceholder())}</div><div class="col-12">${card('Comparación de orígenes','Personas, visitas y acciones importantes por origen',gaReady()?dataTable(rows('channels'),[{key:'sessionDefaultChannelGroup',label:'Canal',display:friendlyChannel},{key:'sessions',label:'Sesiones',display:fmt},{key:'totalUsers',label:'Usuarios',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  
  function campaignMetaSetup(){
    if(!featureEnabled('meta_ads'))return '<div class="ads-connected-compact"><span class="ads-connected-dot pending"></span><div><strong>Meta Ads no incluido</strong><small>Esta conexión no está habilitada para '+clean(displayBusiness())+'.</small></div></div>';
    const m=state.meta||{},ready=!!m.configured,connected=!!m.connected;
    const saved=m.selected_accounts||[m.selected_account].filter(Boolean),accounts=m.accounts||[];
    const isOpen=state.campaignConnectionOpen;
    if(!isOpen){
      return '<div class="ads-connected-compact"><span class="ads-connected-dot '+(connected?'':'pending')+'" aria-hidden="true"></span><div><strong>'+(connected?'Meta Ads conectado':'Conecta Meta Ads desde aquí')+'</strong><small>'+(connected?saved.length+' cuenta(s) autorizadas para '+clean(displayBusiness()):'Conecta Facebook y selecciona tus cuentas sin salir del dashboard')+'</small></div><div class="ads-connection-actions"><button type="button" class="button '+(connected?'button-outline':'button-primary')+'" data-act="campaign-connect-toggle">'+(connected?'Administrar cuentas':'Conectar Meta Ads')+'</button>'+(connected?'<button type="button" class="button button-outline ads-disconnect-button" data-act="meta-disconnect" aria-label="Desconectar Meta Ads de este navegador">Desconectar</button>':'')+'</div></div>';
    }
    const stage=state.campaignWizardStage==='confirm'&&connected?'confirm':connected?'accounts':'authorize';
    const chosen=state.campaignWizardSelectedIds||saved;
    const providerItems=[
      {name:'Meta Ads',logo:'Meta Ads',active:true,sub:'Facebook e Instagram'},
      {name:'Google Ads',logo:'Google Ads',sub:'Próximamente'},
      {name:'TikTok Ads',logo:'TikTok Ads',sub:'Próximamente'},
      {name:'LinkedIn Ads',logo:'LinkedIn Ads',sub:'Próximamente'},
      {name:'Google Analytics 4',logo:'Google Analytics 4',sub:'Desde Integraciones'}
    ];
    const catalogue='<aside class="connector-sidebar"><div class="connector-sidebar-title">Conexiones</div>'+
      '<label class="connector-provider-search"><span>'+icon('search',17)+'</span><input id="campaign-provider-search" type="search" placeholder="Buscar plataformas" aria-label="Buscar plataforma"/></label>'+
      '<div class="connector-provider-group">PUBLICIDAD</div>'+
      providerItems.slice(0,4).map(p=>'<div class="connector-provider '+(p.active?'selected':'pending')+'" data-provider-name="'+clean(p.name.toLowerCase())+'">'+providerLogo(p.logo)+'<span><b>'+clean(p.name)+'</b><small>'+clean(p.sub)+'</small></span>'+(p.active?'<span class="connector-selected-mark" aria-hidden="true">✓</span>':'')+'</div>').join('')+
      '<div class="connector-provider-group">ANALÍTICA</div>'+
      providerItems.slice(4).map(p=>'<div class="connector-provider pending" data-provider-name="'+clean(p.name.toLowerCase())+'">'+providerLogo(p.logo)+'<span><b>'+clean(p.name)+'</b><small>'+clean(p.sub)+'</small></span></div>').join('')+
      '<p class="connector-sidebar-foot">Las demás plataformas se conectarán cuando estén disponibles sus APIs oficiales.</p></aside>';
    const progress='<div class="connector-progress">'+
      [['1','Autorizar Facebook',connected],['2','Elegir cuentas',stage==='confirm'||saved.length>0],['3','Confirmar conexión',stage==='confirm'||saved.length>0]].map(([n,t,done],i)=>
       '<span class="connector-progress-step '+(done?'done':((stage==='authorize'&&i===0)||(stage==='accounts'&&i===1)||(stage==='confirm'&&i===2)?'current':''))+'"><i>'+n+'</i>'+t+'</span>').join('')+
      '</div>';
    let content='';
    if(state.metaLoading){
      content='<div class="connector-loader" role="status"><span class="spinner"></span><strong>Consultando tu conexión con Meta…</strong><p>Solo cargaremos las cuentas que Facebook haya autorizado.</p></div>';
    }else if(!ready){
      content='<div class="connector-message-panel"><div class="connector-meta-symbol">'+providerLogo('Meta Ads')+'</div><h3>Conectar tu cuenta de Facebook</h3>'+
        '<p>La aplicación de Meta todavía no está habilitada. Cuando termine su activación, podrás autorizar tu Facebook directamente desde esta ventana.</p><button class="button button-primary" type="button" disabled>Conectar Facebook · próximamente</button></div>';
    }else if(!connected){
      content='<div class="connector-message-panel"><div class="connector-meta-symbol">'+providerLogo('Meta Ads')+'</div>'+
        '<h3>Conectar tu cuenta de Facebook</h3><p>Conecta tu cuenta para ver las campañas y los anuncios de Facebook e Instagram en Edwin CRM.</p>'+
        '<button class="button button-primary connector-primary" type="button" data-act="meta-connect" data-return="campaigns">'+icon('link',17)+' Autorizar con Facebook</button>'+
        '<p class="connector-small-note">Se abrirá una ventana oficial de Meta para iniciar sesión y autorizar el acceso. Este panel permanecerá abierto.</p></div>';
    }else if(stage==='confirm'){
      const chosenAccounts=accounts.filter(a=>chosen.includes(a.id));
      content='<div class="connector-form-heading"><div><h3>Confirmar cuentas seleccionadas</h3><p>Comprueba las cuentas antes de cargar sus campañas.</p></div><span class="connector-account-total">'+chosen.length+' de 5 cuentas</span></div>'+
        '<div class="connector-confirm-accounts">'+chosenAccounts.map(a=>'<div class="connector-confirm-account">'+providerLogo('Meta Ads')+'<span><b>'+clean(a.name)+'</b><small>'+clean(a.id)+' · '+clean(a.currency||'')+'</small></span><span class="connector-ok">✓</span></div>').join('')+'</div>'+
        '<div class="connector-privacy"><b>Solo lectura</b><p>Edwin CRM consultará los resultados de las cuentas seleccionadas. No publicará anuncios ni cambiará sus presupuestos.</p></div>'+
        '<div class="connector-form-actions"><button class="button button-outline" type="button" data-act="campaign-meta-back">Atrás</button><button class="button button-primary" type="button" data-act="campaign-meta-save" '+(state.campaignAccountSaving?'disabled':'')+'>'+(state.campaignAccountSaving?'Guardando…':'Guardar conexión y ver campañas')+' '+icon('chevron',16)+'</button></div>';
    }else{
      const selectedIds=state.campaignWizardSelectedIds||saved;
      const tableRows=accounts.map(a=>'<label class="connector-account-row" data-account-search="'+clean((a.name+' '+a.id).toLowerCase())+'">'+
        '<span class="connector-account-check"><input type="checkbox" class="campaign-meta-account-check" value="'+clean(a.id)+'" '+(selectedIds.includes(a.id)?'checked':'')+' aria-label="Seleccionar '+clean(a.name)+'"/></span>'+
        '<span class="connector-account-name">'+clean(a.name||'Cuenta sin nombre')+'</span><span class="connector-account-id">'+clean(a.id)+'</span>'+
        '<span class="connector-account-currency">'+clean(a.currency||'—')+'</span></label>').join('');
      content='<div class="connector-form-heading"><div><h3>Seleccionar cuentas publicitarias</h3><p>Selecciona hasta cinco cuentas de Facebook. Puedes buscar por nombre o identificador.</p></div>'+
        '<span class="connector-account-total" id="connector-account-total">'+selectedIds.length+' seleccionada(s)</span></div>'+
        '<div class="connector-account-toolbar"><button class="connector-reconnect" type="button" data-act="meta-connect" data-return="campaigns">'+icon('refresh',14)+' Volver a autorizar Facebook</button><button class="connector-reconnect connector-disconnect" type="button" data-act="meta-disconnect">'+icon('logout',14)+' Desconectar Meta Ads</button></div>'+
        '<label class="connector-search"><span>'+icon('search',17)+'</span><input id="campaign-meta-search" type="search" placeholder="Buscar cuentas" autocomplete="off" aria-label="Buscar cuentas publicitarias"/></label>'+
        '<div class="connector-account-table"><div class="connector-account-head"><label class="connector-account-check"><input type="checkbox" id="campaign-meta-select-all" aria-label="Seleccionar hasta cinco cuentas visibles"/></label>'+
          '<span>Nombre de la cuenta</span><span>ID de cuenta</span><span>Moneda</span></div>'+
        '<div class="connector-account-results">'+(tableRows||'<p class="connector-no-accounts">Facebook no devolvió cuentas disponibles. Comprueba que tu usuario tenga permisos sobre alguna cuenta publicitaria.</p>')+'</div></div>'+
        '<div class="connector-privacy"><b>Tu privacidad está protegida</b><p>Las cuentas pertenecen a la empresa seleccionada. Solo se consultarán los datos que Meta autorice.</p></div>'+
        '<div class="connector-form-actions"><span class="connector-limit">Máximo cinco cuentas</span><button class="button button-primary" type="button" data-act="campaign-meta-next">Siguiente '+icon('chevron',16)+'</button></div>';
    }
    const body='<div class="connector-content"><div class="connector-context"><span>INTEGRACIONES / PUBLICIDAD</span>'+
       '<button type="button" class="connector-close" data-act="campaign-connect-toggle" aria-label="Cerrar conexión">'+icon('close',20)+'</button></div>'+
       '<div class="connector-topline">'+providerLogo('Meta Ads')+'<span><b>Meta Ads</b><small>'+clean(displayBusiness())+'</small></span></div>'+
       progress+
       (state.metaError?alertBlock(state.metaError):'')+
       (state.campaignAccountNotice?'<div class="company-message" role="status">'+clean(state.campaignAccountNotice)+'</div>':'')+
       '<div class="connector-main">'+content+'</div></div>';
    return '<div class="ads-modal-backdrop" data-act="campaign-connect-toggle" aria-hidden="true"></div>'+
     '<div class="ads-modal-shell connector-windsor" role="dialog" aria-modal="true" aria-label="Conectar Meta Ads">'+
     '<div class="connector-layout">'+catalogue+body+'</div></div>';
  }


  const adsPeriodLabel = () => state.adsPeriod==='custom'
    ? (state.adsCustomStart&&state.adsCustomEnd?state.adsCustomStart+' al '+state.adsCustomEnd:'Fechas personalizadas')
    : ({today:'Hoy',yesterday:'Ayer','7':'Últimos 7 días','30':'Últimos 30 días','90':'Últimos 90 días','365':'Últimos 12 meses'})[state.adsPeriod]||'Últimos 30 días';
  const adsDateQuery = () => {
    const custom=state.adsPeriod==='custom'&&state.adsCustomStart&&state.adsCustomEnd;
    return '&period='+encodeURIComponent(custom?'custom':state.adsPeriod==='custom'?'30':state.adsPeriod)+
      (custom?'&start_date='+encodeURIComponent(state.adsCustomStart)+'&end_date='+encodeURIComponent(state.adsCustomEnd):'');
  };
  const metaStatusLabel = value => ({ACTIVE:'Activa',PAUSED:'Pausada',ARCHIVED:'Archivada',
    DELETED:'Eliminada',IN_PROCESS:'En revisión',WITH_ISSUES:'Con problemas',
    CAMPAIGN_PAUSED:'Campaña pausada',ADSET_PAUSED:'Conjunto pausado',
    PENDING_REVIEW:'Pendiente de revisión',DISAPPROVED:'Rechazado'})[value]||'Sin informar';
  const metaObjectiveLabel = value => ({
    OUTCOME_TRAFFIC:'Tráfico',OUTCOME_AWARENESS:'Reconocimiento',
    OUTCOME_ENGAGEMENT:'Interacción',OUTCOME_LEADS:'Clientes potenciales',
    OUTCOME_SALES:'Ventas',OUTCOME_APP_PROMOTION:'Promoción de aplicación',
    LINK_CLICKS:'Clics en enlaces',CONVERSIONS:'Conversiones',
    LEAD_GENERATION:'Generación de contactos',REACH:'Alcance',
    BRAND_AWARENESS:'Reconocimiento de marca',POST_ENGAGEMENT:'Interacción'
  })[value]||value||'Sin informar';
  function adsFilteredRows(){
    const list=state.metaCampaigns?.rows||[],q=state.adsSearch.trim().toLocaleLowerCase('es');
    return list.filter(x=>(!state.adsAccount||x.account_id===state.adsAccount)&&
      (!state.adsStatus||x.effective_status===state.adsStatus)&&
      (!state.adsObjective||x.objective===state.adsObjective)&&
      (!q||[x.account_name,x.name,x.campaign_name,x.adset_name,x.id].some(v=>String(v||'').toLocaleLowerCase('es').includes(q))));
  }
  function metaAccountSummary(){
    // Read only the campaign-report rows returned for the current Ads date/level.
    // The general Meta summary can use a different period and must not be labeled as this report.
    const report=state.metaCampaigns;
    if(!report||report.partial||!Array.isArray(report.rows)||!report.rows.length)return null;
    const selected=report.rows.filter(x=>!state.adsAccount||x.account_id===state.adsAccount);
    if(!selected.length)return null;
    const currencies=new Set(selected.map(x=>String(x.currency||'')).filter(Boolean));
    const sum=field=>selected.every(x=>x[field]!==null&&x[field]!==undefined&&Number.isFinite(Number(x[field])))
      ?selected.reduce((t,x)=>t+Number(x[field]),0):null;
    const spend=currencies.size===1?sum('spend'):null,
      clicks=sum('clicks'),impressions=sum('impressions');
    return {
      currency:currencies.size===1?[...currencies][0]:'',
      spend,clicks,impressions,
      ctr:clicks!==null&&impressions>0?100*clicks/impressions:null,
      cpc:spend!==null&&clicks>0?spend/clicks:null,
      currencyMixed:currencies.size>1,
      accounts:new Set(selected.map(x=>x.account_id).filter(Boolean)).size,
      recordCount:selected.length
    };
  }
  function adsMetricsStrip(){
    const values=metaAccountSummary();if(!values)return '';
    const metrics=[
      ['Inversión'+(values.currency?' ('+values.currency+')':''),values.spend===null?'—':metaMetric(values.spend,2)],
      ['Clics',metaMetric(values.clicks)],['Impresiones',metaMetric(values.impressions)],
      ['CTR',values.ctr===null?'—':metaMetric(values.ctr,2)+'%'],
      ['CPC'+(values.currency?' ('+values.currency+')':''),values.cpc===null?'—':metaMetric(values.cpc,2)]
    ];
    return '<section class="ads-kpi-section" aria-label="Resumen de Meta Ads"><div class="ads-kpi-context"><b>Rendimiento publicitario</b><span>'+clean(adsPeriodLabel())+' · '+values.accounts+' cuenta(s) · '+values.recordCount+' registros'+(state.adsAccount?' · Cuenta filtrada':'')+(values.currencyMixed?' · Monedas distintas: inversión y CPC sin sumar':'')+'</span></div><div class="small-kpis ads-five-kpis">'+metrics.map(([label,val])=>
      '<div class="small-kpi"><span>'+clean(label)+'</span><strong>'+clean(val)+'</strong></div>').join('')+'</div></section>';
  }


function adsConnectionStatus(value){
 if(value!=='meta')return {label:'Próximamente',kind:'soon'};
 if(!featureEnabled('meta_ads'))return {label:'No incluido',kind:'restricted'};
 if(state.metaLoading)return {label:'Verificando',kind:'waiting'};
 if(state.meta?.connected){
  const count=(state.meta.selected_accounts||[state.meta.selected_account].filter(Boolean)).length;
  return count?{label:'Conectado',kind:'connected'}:{label:'Elegir cuentas',kind:'waiting'};
 }
 return state.meta?.configured?{label:'Por conectar',kind:'waiting'}:{label:'En preparación',kind:'soon'};
}
function adsOverviewHero(platform){
 const labels={meta:'Meta Ads',google:'Google Ads',tiktok:'TikTok Ads',linkedin:'LinkedIn Ads'};
 const provider=labels[platform]||'Meta Ads',m=state.meta||{},status=adsConnectionStatus(platform);
 const selected=platform==='meta'?(m.selected_accounts||[m.selected_account].filter(Boolean)).length:0;
 const open=platform==='meta'&&featureEnabled('meta_ads');
 const sub=platform!=='meta'?'La integración oficial de esta plataforma aún está en desarrollo.':
  !featureEnabled('meta_ads')?'Esta empresa no tiene permiso para utilizar Meta Ads.':
  status.kind==='connected'?selected+' cuenta(s) publicitarias seleccionadas · Estadísticas reales de Meta.':
  status.label==='Elegir cuentas'?'Facebook autorizado. Selecciona las cuentas que deseas analizar.':
  m.configured?'Conecta tu propia cuenta de Facebook y elige los anuncios que quieres analizar.':
  'La integración todavía requiere completar su habilitación para los clientes.';
 return '<section class="ads-overview-hero" aria-label="Estado de la plataforma">'+
  '<div class="ads-overview-main">'+providerLogo(provider)+'<div><span class="ads-eyebrow">PLATAFORMA PUBLICITARIA</span><h2>'+clean(provider)+'</h2><p>'+clean(sub)+'</p></div></div>'+
  '<div class="ads-overview-actions"><span class="ads-status-pill ads-status-'+status.kind+'"><span class="ads-pill-indicator"></span>'+clean(status.label)+'</span>'+
  (open?'<button class="ads-hero-button" type="button" data-act="campaign-connect-toggle">'+(m.connected?'Administrar conexión':'Conectar mi cuenta')+icon('chevron',15)+'</button>':'')+
  '</div></section>';
}
function adsGuidance(platform,connected){
 const suggestions=[];
 if(platform!=='meta')suggestions.push(['Antes de empezar','Cuando la integración esté disponible, podrás autorizar tu cuenta desde eDigital. No se muestran campañas de prueba.']);
 else if(!featureEnabled('meta_ads'))suggestions.push(['Tu plan actual','Meta Ads no está habilitado para esta empresa. Revisa las integraciones disponibles de tu plan.']);
 else if(!connected){
  suggestions.push(['1. Conecta Facebook','Utiliza «Conectar mi cuenta» y concede únicamente los permisos que solicita Meta.']);
  suggestions.push(['2. Elige tus cuentas','Selecciona las cuentas publicitarias de tu negocio dentro de eDigital.']);
  suggestions.push(['3. Consulta las campañas','Elige un período y actualiza para ver inversión, clics e impresiones reales.']);
 }else{
  const report=state.metaCampaigns||{},summ=metaAccountSummary(),rows=report.rows||[];
  if(state.adsLoading){
   suggestions.push(['Consultando datos','Las cifras se mostrarán cuando Meta termine de responder. No se presentan valores estimados.']);
  }else if(!rows.length){
   suggestions.push(['Comprueba el período','Prueba 7 o 30 días y revisa que hayas seleccionado una cuenta publicitaria con actividad.']);
   suggestions.push(['Revisa tu autorización','Si no aparecen campañas, comprueba en el gestor de Meta que tienes permiso para consultar la cuenta.']);
  }else{
   suggestions.push(['Interpreta el CTR',summ?.ctr!=null?
     'El CTR observado es '+metaMetric(summ.ctr,2)+'%. Compara campañas con el mismo objetivo y fechas; un CTR aislado no confirma ventas.':
     'Compara el CTR entre campañas del mismo objetivo para saber qué anuncios generan más clics.']);
   suggestions.push(['Revisa costos',summ?.currencyMixed?
     'Tus cuentas usan monedas distintas. Revisa la inversión y el CPC por cuenta sin sumar montos incompatibles.':
     'Compara inversión y CPC entre campañas similares. Un costo menor no garantiza mejores clientes.']);
   suggestions.push(['Evalúa resultados, no solo clics','Un CTR alto no garantiza conversiones. Si tu integración entrega resultados y costo por resultado, prioriza esas métricas; compara campañas del mismo objetivo y período.']);
   if(report.partial)suggestions.push(['Informe parcial','Meta devolvió resultados parciales. Por esa razón, el resumen agregado no se muestra como si fuera un total completo.']);
  }
 }
 return '<section class="ads-guidance" aria-labelledby="ads-guidance-title"><div class="ads-guidance-heading"><span class="ads-guidance-icon">'+icon('lightbulb',21)+'</span><div><h3 id="ads-guidance-title">Consejos para analizar tus campañas</h3><p>Guía práctica basada en el estado de tus conexiones, sin resultados inventados.</p></div></div>'+
  '<div class="ads-guidance-grid">'+suggestions.map(([title,body],idx)=>'<article class="ads-guidance-item"><span class="ads-guidance-num">'+String(idx+1).padStart(2,'0')+'</span><strong>'+clean(title)+'</strong><p>'+clean(body)+'</p></article>').join('')+'</div></section>';
}

function campaigns(){
 const connected=!!(state.meta?.connected&&(state.meta?.selected_accounts?.length||state.meta?.selected_account));
 const platform=state.adsPlatform,level=state.adsLevel,report=state.metaCampaigns;
 const choices=[['meta','Meta Ads'],['google','Google Ads'],['tiktok','TikTok Ads'],['linkedin','LinkedIn Ads']];
 const tabs='<div class="ads-platform-tabs" role="group" aria-label="Plataforma publicitaria">'+choices.map(([value,label])=>
   '<button type="button" class="ads-platform-tab '+(platform===value?'active':'')+'" data-act="ads-platform" data-platform="'+value+'" aria-pressed="'+(platform===value?'true':'false')+'">'+providerLogo(label)+'<span class="ads-tab-label">'+label+'</span><small class="ads-tab-status '+adsConnectionStatus(value).kind+'">'+clean(adsConnectionStatus(value).label)+'</small></button>').join('')+'</div>';
 const periods=[['today','Hoy'],['yesterday','Ayer'],['7','7 días'],['30','30 días'],['90','90 días'],['365','12 meses'],['custom','Personalizado']];
 const periodOptions=periods.map(([value,label])=>'<option value="'+value+'" '+(state.adsPeriod===value?'selected':'')+'>'+label+'</option>').join('');
 const levelOptions=[['campaign','Campañas'],['adset','Conjuntos de anuncios'],['ad','Anuncios']].map(([value,label])=>'<option value="'+value+'" '+(level===value?'selected':'')+'>'+label+'</option>').join('');
 const toolbar='<div class="ads-toolbar ads-detail-toolbar">'+
   '<label class="form-label">Vista de resultados<select id="ads-level" class="meta-select">'+levelOptions+'</select></label>'+
   '<label class="form-label">Fechas del informe<select id="ads-period" class="meta-select">'+periodOptions+'</select></label>'+
   '<button class="button button-outline ads-best-button '+(state.adsBestOnly?'active':'')+'" data-act="ads-best" aria-pressed="'+state.adsBestOnly+'" '+(platform!=='meta'?'disabled':'')+'>Mejores campañas</button>'+
   '<button class="button button-outline" data-act="ads-refresh" '+(state.adsLoading||(state.adsPeriod==='custom'&&(!state.adsCustomStart||!state.adsCustomEnd))?'disabled':'')+'>'+icon('refresh',16)+' Actualizar datos</button>'+
   '</div>'+
   (state.adsPeriod==='custom'?'<div class="ads-custom-dates">'+
    '<label>Desde<input type="date" id="ads-start-date" value="'+clean(state.adsCustomStart)+'" required/></label>'+
    '<label>Hasta<input type="date" id="ads-end-date" value="'+clean(state.adsCustomEnd)+'" required/></label>'+
    '<button class="button button-primary" data-act="ads-apply-dates">Aplicar fechas</button></div>':'')+
   (state.adsFilterError?alertBlock(state.adsFilterError,'info'):'');
 let result='';
 if(platform!=='meta')result=empty('Esta plataforma todavía requiere la autorización de su API oficial.','Integración próximamente');
 else if(!connected)result=campaignMetaSetup();
 else if(state.adsLoading)result='<div class="ads-loading-detail" role="status"><div class="ga-loading-bars"><i></i><i></i><i></i></div><p>Consultando cuentas, fechas y campañas de Meta…</p></div>';
 else if(state.adsError)result=alertBlock(state.adsError);
 else if(!report)result=empty('Selecciona un período y pulsa «Actualizar datos».','Esperando estadísticas');
 else{
   const accounts=(state.meta?.accounts||[]).filter(x=>(state.meta?.selected_accounts||[state.meta?.selected_account]).includes(x.id));
   const accountOptions='<option value="">Todas las cuentas</option>'+accounts.map(x=>
     '<option value="'+clean(x.id)+'" '+(state.adsAccount===x.id?'selected':'')+'>'+clean(x.name)+' ('+clean(x.currency)+')</option>').join('');
   const statusValues=[...new Set((report.rows||[]).map(x=>x.effective_status).filter(Boolean))].sort();
   const objectiveValues=[...new Set((report.rows||[]).map(x=>x.objective).filter(Boolean))].sort();
   const opts=(values,selected,label,formatter)=>'<option value="">'+label+'</option>'+values.map(value=>
     '<option value="'+clean(value)+'" '+(selected===value?'selected':'')+'>'+clean(formatter(value))+'</option>').join('');
   const filters='<div class="ads-results-filters">'+
     '<label>Buscar campaña o anuncio<input id="ads-search" type="search" class="simple-input" placeholder="Nombre o identificador…" value="'+clean(state.adsSearch)+'" autocomplete="off"/></label>'+
     '<label>Cuenta publicitaria<select id="ads-account" class="simple-input">'+accountOptions+'</select></label>'+
     '<label>Estado de campaña<select id="ads-status" class="simple-input">'+opts(statusValues,state.adsStatus,'Todos los estados',metaStatusLabel)+'</select></label>'+
     '<label>Objetivo<select id="ads-objective" class="simple-input">'+opts(objectiveValues,state.adsObjective,'Todos los objetivos',metaObjectiveLabel)+'</select></label></div>';
   const all=report.rows||[],filtered=adsFilteredRows(),ranked=state.adsBestOnly&&level==='campaign'?[...filtered].filter(r=>r.ctr!=null&&Number.isFinite(Number(r.ctr))).sort((a,b)=>Number(b.ctr)-Number(a.ctr)).slice(0,10):filtered,fmtCost=(n,row)=>n==null?'—':money(n,row?.currency||report.currency||'');
   const numberOrDash=value=>value==null?'—':fmt(value);
   const decimalOrDash=value=>value==null?'—':fmt1(value);
   const cols=[
      {key:'account_name',label:'Cuenta'},{key:'name',label:level==='campaign'?'Campaña':level==='adset'?'Conjunto':'Anuncio'},
      ...(level!=='campaign'?[{key:'campaign_name',label:'Campaña principal'}]:[]),
      {key:'effective_status',label:'Estado campaña',display:metaStatusLabel},
      {key:'objective',label:'Objetivo',display:metaObjectiveLabel},
      {key:'date_start',label:'Desde',display:v=>v||'—'},
      {key:'date_stop',label:'Hasta',display:v=>v||'—'},
      {key:'spend',label:'Inversión',display:fmtCost},
      {key:'reach',label:'Alcance',display:numberOrDash},
      {key:'impressions',label:'Impresiones',display:numberOrDash},
      {key:'frequency',label:'Frecuencia',display:decimalOrDash},
      {key:'clicks',label:'Clics',display:numberOrDash},
      {key:'ctr',label:'CTR',display:v=>v==null?'—':fmt1(v)+'%'},
      {key:'cpc',label:'CPC',display:fmtCost},
      {key:'cpm',label:'CPM',display:fmtCost}
   ];
   result=filters+
     '<div class="ads-detail-summary"><div><strong>'+fmt(ranked.length)+' de '+fmt(all.length)+' registros</strong><span>Fechas: '+clean(adsPeriodLabel())+' · '+(level==='campaign'?'Campañas':level==='adset'?'Conjuntos':'Anuncios')+'</span></div>'+
     '<button type="button" class="button button-outline" data-act="download" data-report="ads" '+(!ranked.length?'disabled':'')+'>'+icon('download',16)+' Exportar CSV</button></div>'+
     (report.partial?alertBlock('Meta devolvió un informe parcial: podría haber más registros fuera del límite de consulta.','info'):'')+
     (report.metadataPartial?'<p class="fine-print">Algunos estados u objetivos no se pudieron verificar con Meta y se muestran como «Sin informar».</p>':'')+
     (ranked.length?dataTable(ranked,cols,200):empty('Prueba quitar filtros o cambiar el período.','No hay campañas coincidentes'))+
     '<p class="ads-metrics-note">Alcance: personas únicas. Frecuencia: impresiones promedio por persona. CPM: costo por mil impresiones. Estado y objetivo corresponden a la campaña principal, no al anuncio individual. Sin resultados inventados.</p>';
 }
 const summary=platform==='meta'&&connected?adsMetricsStrip():'';
 const settings=platform==='meta'&&connected?campaignMetaSetup():'';
 return heading('Publicidad','Campañas Ads','Revisa el estado de tus cuentas y analiza datos publicitarios reales desde un solo lugar.')+
   tabs+adsOverviewHero(platform)+toolbar+settings+summary+
   card(platform==='meta'?'Resultados y campañas de Meta Ads':'Rendimiento publicitario',platform==='meta'?adsPeriodLabel():'Conexión oficial pendiente',result)+
   adsGuidance(platform,connected)+
   '<div class="spacer-sm"></div>'+card('Tráfico UTM en Google Analytics','Las visitas medidas por GA4 son diferentes del gasto de Meta Ads.',
   '<p class="fine-print">Para evaluar contactos o ventas, compara los eventos configurados en GA4 con los resultados de tus campañas.</p>'+
   '<button class="button button-outline" data-act="nav" data-page="utm">Consultar fuentes UTM</button>');
}
    function utm(){return `${heading('Fuentes UTM · GA4','Campañas que llevan tráfico','Resultados de las campañas identificadas mediante etiquetado en Google Analytics 4.')}${statusStrip()}${alertBlock('Estas métricas corresponden al tráfico medido por GA4. No incluyen gasto publicitario, CPC, ROAS ni conversiones reportadas directamente por Meta Ads o Google Ads.', 'info')}<div class="content-grid"><div class="col-12">${card('Rendimiento por campaña','Sesiones y eventos clave atribuidos',gaReady()?dataTable(rows('campaigns'),[{key:'sessionCampaignName',label:'Campaña'},{key:'sessions',label:'Sesiones',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div><div class="col-6">${card('Campañas con más sesiones','Ranking de campañas etiquetadas',gaReady()?barList(rows('campaigns'),'sessionCampaignName','sessions',9):dataPlaceholder())}</div><div class="col-6">${card('Eventos clave por campaña','No equivale necesariamente a ventas confirmadas',gaReady()?barList([...rows('campaigns')].sort((a,b)=>number(b.keyEvents)-number(a.keyEvents)),'sessionCampaignName','keyEvents',9):dataPlaceholder())}</div></div>${flags()}`;}
  function audience(){return `${heading('Audiencia','Conoce a tus visitantes','Ubicación, dispositivos y procedencia de los usuarios.')}${statusStrip()}<div class="content-grid"><div class="col-6">${card('Países principales','Usuarios por país',gaReady()?barList(rows('countries'),'country','totalUsers',11):dataPlaceholder())}</div><div class="col-6">${card('Ciudades principales','Usuarios por ciudad',gaReady()?barList(rows('cities'),'city','totalUsers',11):dataPlaceholder())}</div><div class="col-5">${card('Dispositivos','Sesiones registradas por tipo',gaReady()?donut(rows('devices'),'deviceCategory','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Detalle geográfico','Usuarios y sesiones por país',gaReady()?dataTable(rows('countries'),[{key:'country',label:'País'},{key:'totalUsers',label:'Usuarios',display:fmt},{key:'sessions',label:'Sesiones',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function content(){return `${heading('Contenido web','Tu contenido, con resultados','Identifica páginas populares y las que están atrayendo sesiones.')}${statusStrip()}<div class="content-grid"><div class="col-7">${card('Páginas más vistas','Visualizaciones por ruta de URL',gaReady()?barList(rows('pages'),'pagePath','screenPageViews',12):dataPlaceholder())}</div><div class="col-5">${card('Páginas de entrada','Sesiones iniciadas en cada página',gaReady()?barList(rows('landing'),'landingPage','sessions',10):dataPlaceholder())}</div><div class="col-12">${card('Rendimiento de páginas','Detalle que podrás exportar a CSV',gaReady()?dataTable(rows('pages'),[{key:'pagePath',label:'Ruta de página'},{key:'screenPageViews',label:'Visualizaciones',display:fmt},{key:'totalUsers',label:'Usuarios',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  const friendlyEventNames={
    page_view:'Página vista',session_start:'Inicio de visita',first_visit:'Primera visita',
    user_engagement:'Interacción del visitante',scroll:'Desplazamiento de página',
    click:'Clic',form_start:'Inicio de formulario',form_submit:'Formulario enviado',
    generate_lead:'Contacto generado',purchase:'Compra realizada',add_to_cart:'Añadido al carrito',
    begin_checkout:'Inicio de compra',view_item:'Producto visto',file_download:'Archivo descargado',
    sign_up:'Registro realizado',video_start:'Reproducción de video',video_complete:'Video completado'
  };
  const friendlyEventName=value=>{
    const raw=String(value||'');
    return friendlyEventNames[raw]||raw.replace(/_/g,' ').replace(/^./,ch=>ch.toUpperCase());
  };
  function events(){return `${heading('Eventos y metas','Acciones importantes de tus visitas','Explora eventos registrados en GA4 y detecta cuáles se marcaron como clave.')}${statusStrip()}<div class="content-grid"><div class="col-8">${card('Evolución de eventos clave','Acciones importantes registradas por día',gaReady()?chart(rows('trend'),'keyEvents','Eventos clave', '', '',280):dataPlaceholder())}</div><div class="col-4">${card('Tipos de eventos','Cantidad de eventos registrados',gaReady()?barList(rows('events').map(r=>({...r,eventNameLabel:friendlyEventName(r.eventName)})),'eventNameLabel','eventCount',10):dataPlaceholder())}</div><div class="col-12">${card('Detalle de eventos','Los eventos clave son los señalados en la propiedad GA4',gaReady()?dataTable(rows('events'),[{key:'eventName',label:'Nombre del evento',display:friendlyEventName},{key:'eventCount',label:'Cantidad',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function hotmartRibbon() {
    if (!state.hm && !state.hmLoading && !state.hmError) return '';
    const h=state.hm;
    return `<div class="commerce-ribbon"><div class="commerce-icon">${icon('shopping-bag',23)}</div><div class="commerce-desc"><b>Hotmart · cuenta de Edwin Digital</b><span>${state.hmLoading?'Consultando ventas…':state.hmError?'No se pudo obtener el reporte de Hotmart':h?.incomplete?'Consulta parcial de movimientos':'Ventas aprobadas en el período'}</span></div><div class="commerce-count">${h?fmt(h.approved):'—'} <span>ventas</span></div><button class="button button-outline" data-act="nav" data-page="hotmart">Ver ventas ${icon('chevron',16)}</button></div>`;
  }
  function hotmart(){
    const allowed=selectedBusinessIsHotmart(),h=state.hm, ok=allowed&&!!h;
    const placeholder=state.hmLoading?`<div class="loading-state"><span class="spinner"></span>Consultando Hotmart…</div>`:empty(allowed?(state.hmError||'Verifica las variables privadas HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET y HOTMART_BASIC en Cloudflare.'):'Este negocio no tiene su propia conexión autorizada a Hotmart. Las credenciales del administrador no se comparten.','Integración no disponible');
    const stats=[['Ventas aprobadas',ok?fmt(h.approved):'—'],['Reembolsos / contracargos',ok&&h.refunded!==null?fmt(h.refunded):'—'],['Movimientos revisados',ok?fmt(h.transactions_examined):'—'],['Productos vendidos',ok?fmt(h.products?.length):'—']];
    return `${heading('Comercio digital','Ventas de Hotmart','Movimientos reales de la cuenta piloto autorizada. No se procesan cobros desde este panel.')}${allowed?tag('Cuenta Edwin Digital · lectura', 'success'):alertBlock('Hotmart todavía necesita una autorización independiente desde la cuenta de tu empresa.')}<div class="small-kpis hotmart-stats">${stats.map(x=>`<div class="small-kpi"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div><div class="content-grid"><div class="col-8">${card('Ventas aprobadas por día','Transacciones encontradas en la API de Hotmart',ok?chart(h.trend,'count','Ventas'):placeholder)}</div><div class="col-4">${card('Ingresos brutos por moneda','No se combinan BRL, PEN y USD',ok?Object.keys(h.gross_by_currency||{}).length?`<div class="currency-list">${Object.entries(h.gross_by_currency).map(([cur,amount])=>`<div><span>${clean(cur)}</span><strong>${clean(money(amount,cur))}</strong></div>`).join('')}</div>`:empty('No hay importes reportados.'):placeholder)}</div><div class="col-6">${card('Productos más vendidos','Unidades aprobadas por producto',ok?barList((h.products||[]).map(p=>({name:p.name,count:p.count})),'name','count',12):placeholder)}</div><div class="col-6">${card('Métodos de pago','Operaciones por método',ok?barList(h.methods,'name','value',12):placeholder)}</div></div>${ok?alertBlock(`${h.note||'Cifras de consulta, no utilidad neta.'}${h.incomplete?' La paginación o ciertos estados pueden estar incompletos.':''}`,'info'):''}`;
  }
  function reports(){
    const kinds=[['Resumen del sitio','overview','trend'],['Adquisición','acquisition','sources'],['Campañas UTM','campaigns','campaigns'],['Audiencia','audience','countries'],['Contenido','content','pages'],['Eventos y conversiones','events','events']];
    return `${heading('Centro de reportes','Tus informes, listos para analizar','Descarga archivos CSV con las métricas que realmente devuelve tu propiedad.')}${statusStrip()}<div class="report-grid">${kinds.map(([name,page,key])=>`<div class="report-item"><div class="report-icon">${icon('file-bar-chart',22)}</div><div><h3>${name}</h3><p>${gaReady()?`${fmt(rows(key).length)} registros · ${periodLabel()}`:'Esperando conexión GA4'}</p></div><button class="button button-soft" data-act="download" data-report="${key}" ${!gaReady()||!rows(key).length?'disabled':''}>${icon('download',17)} CSV</button></div>`).join('')}${selectedBusinessIsHotmart()?`<div class="report-item"><div class="report-icon rose">${icon('shopping-bag',22)}</div><div><h3>Productos vendidos · Hotmart</h3><p>${state.hm?`${fmt(state.hm.products?.length)} productos`:state.hmLoading?'Consultando…':'Sin conexión'}</p></div><button class="button button-soft" data-act="download" data-report="hotmart-products" ${!state.hm?'disabled':''}>${icon('download',17)} CSV</button></div>`:''}</div>${alertBlock('Los CSV contienen las filas que entrega la API en el período seleccionado. El panel no genera cifras sintéticas, ni incluye el costo de las campañas publicitarias.','info')}`;
  }
  function company(){
 const b=business(),prefs=companyPrefs();
 const sites=state.sites.map(x=>`<div class="client-site-row">
   <div class="client-avatar compact">${icon('globe',19)}</div>
   <div><strong>${clean(x.name)}</strong><small>${clean(x.url||'Dirección sin asignar')}</small><small>${x.ga4_property_id?'Propiedad GA4 asignada':'Sin propiedad GA4 asignada'}</small></div>
   <button class="button button-outline" data-act="edit-site" data-id="${clean(x.id)}">${icon('settings',15)} Editar sitio</button>
 </div>${state.editSiteId===x.id?`<form id="site-edit-form" class="company-edit-panel">
    <input type="hidden" name="siteId" value="${clean(x.id)}">
    <label class="form-label">Nombre del sitio<input class="simple-input" name="siteName" maxlength="100" required value="${clean(x.name)}"></label>
    <label class="form-label">Dirección web<input class="simple-input" type="url" name="siteUrl" maxlength="300" required value="${clean(x.url)}"></label>
    ${state.siteError?alertBlock(state.siteError):''}
    <div class="company-form-actions"><button class="button button-primary" type="submit" ${state.siteBusy?'disabled':''}>${state.siteBusy?'Guardando…':'Guardar sitio'}</button><button class="button button-outline" type="button" data-act="edit-site-cancel">Cancelar</button></div>
    <p class="fine-print">El cambio solo se aplica cuando Supabase confirma permisos de edición para este sitio.</p>
    </form>`:''}`).join('');
 return `${heading('Perfil del negocio','Mi empresa','Personaliza la información que ves al entrar y administra tus sitios autorizados.')}
 ${state.companyNotice?`<div class="company-message">${icon('check',17)} ${clean(state.companyNotice)}</div>`:''}
 <div class="company-header-panel">
  <label for="company-logo-file" class="company-logo-preview" title="Haz clic para cambiar el logotipo"><span class="company-photo-core">${companyImage(72)}</span><span class="company-photo-camera" aria-hidden="true">${icon('camera',17)}</span><span class="sr-only">Cambiar logotipo de mi empresa</span></label>
  <div><h2>${clean(displayBusiness())}</h2><p>${clean(prefs.category||'Selecciona un sector')} · ${clean(prefs.country||'Indica tu país')}</p><span class="company-subline">Nombre registrado: ${clean(b?.name||'Sin registrar')}</span></div>
 </div>
 <div class="content-grid">
 <div class="col-7">${card('Identidad de tu empresa','Nombre, sector, país y logotipo',`
 <form id="company-profile-form" class="company-profile-form">
 <label class="form-label">Nombre comercial
  <input class="simple-input" name="displayName" type="text" maxlength="80" required minlength="2" value="${clean(prefs.display_name||b?.name||'')}" placeholder="Ej. Mi Agencia Creativa" />
 </label>
 <div class="company-form-grid">
  <label class="form-label">Sector o categoría
   <input class="simple-input" name="category" list="business-categories" maxlength="80" value="${clean(prefs.category||'')}" placeholder="Selecciona o escribe tu sector"/>
  </label>
  <label class="form-label">País
   ${countrySelect(prefs.country)}
  </label>
 </div>
 <datalist id="business-categories"><option value="Marketing y publicidad"><option value="Comercio electrónico"><option value="Finanzas"><option value="Educación"><option value="Tecnología"><option value="Retail"><option value="Servicios profesionales"><option value="Restaurantes y gastronomía"><option value="Otros"></datalist>
 <div class="company-logo-instruction">${icon('camera',16)}<span><b>Logotipo de mi empresa</b><small>Haz clic en la foto circular de arriba para elegir o cambiar tu imagen (PNG, JPG o WebP).</small></span></div>
 <input id="company-logo-file" class="company-file-input accessible-file" type="file" name="logo" accept="image/png,image/jpeg,image/webp" aria-label="Seleccionar logotipo de empresa" />
 ${getCompanyLogo()?`<button class="button button-outline" type="button" data-act="company-logo-clear">${icon('close',14)} Quitar mi logotipo</button>`:''}
 ${state.companyLogoClear?'<p class="fine-print">El logotipo se quitará al guardar.</p>':''}
 <label class="company-checkbox"><input type="checkbox" name="sharedName" checked/> Intentar actualizar también el nombre oficial de la empresa para todos (según permisos)</label>
 ${state.companyError?alertBlock(state.companyError):''}
 <button type="submit" class="button button-primary" ${state.companyBusy?'disabled':''}>${icon('check',17)} ${state.companyBusy?'Guardando…':'Guardar cambios'}</button>
 <p class="fine-print">Sector, país y nombre visual se guardan en tu usuario de acceso; el logotipo se guarda solo en este navegador. Un logotipo compartido con el equipo necesita almacenamiento privado por empresa. El nombre oficial requiere permisos de edición.</p>
 </form>`)}</div>
 <div class="col-5">${card('Conexiones de mi empresa','Al conectar una fuente, aparecerá en sus reportes',connectionOverview())}</div>
 <div class="col-12">${card('Mis sitios web',`${fmt(state.sites.length)} sitios visibles para tu usuario`,`${state.siteNotice?`<div class="company-message">${icon('check',15)} ${clean(state.siteNotice)}</div>`:''}${sites||empty('No hay sitios web registrados para este negocio.')}<p class="fine-print">Aquí puedes modificar el nombre y la URL de un sitio autorizado. La creación de nuevos sitios requiere permisos y configuración de propiedad GA4.</p>`)}</div>
 </div>`;
}
  function adminStatusFor(b){
 const x=state.adminSiteStats[b.id];
 return x?.error?'Sin acceso':x?x.count+' sitios visibles':state.adminStatsLoading?'Consultando…':'No comprobado';
}
  function adminOperations(){
 const records=state.businesses.map(b=>{const x=state.adminSiteStats[b.id];return {
  name:b.name,sites:x?.error?'Sin acceso':x?x.count:'—',
  ga4:x?.error?'Sin acceso':x?x.ga4:'—',
  status:x?.error?'Revisar permisos':x?'Consultado':'Pendiente'};
 });
 const columns=[{key:'name',label:'Empresa'},{key:'sites',label:'Sitios visibles'},{key:'ga4',label:'Propiedades GA4'},{key:'status',label:'Estado'}];
 return `${heading('Administración','Supervisión de clientes','Consulta los sitios visibles por empresa sin usar las contraseñas ni las sesiones de tus clientes.')}
 <div class="admin-toolbar"><span>${fmt(records.length)} empresas autorizadas</span>
 <button class="button button-outline" data-act="admin-check" ${state.adminStatsLoading?'disabled':''}>${icon('refresh',16)} Actualizar inventario</button></div>
 ${state.adminStatsError?alertBlock(state.adminStatsError):''}
 ${card('Inventario de empresas','Cero sitios visibles no significa que la empresa no tenga sitios registrados.',records.length?dataTable(records,columns,100):empty('No hay empresas asignadas.'))}
 <div class="spacer-lg"></div>
 ${card('Control de la plataforma','Funciones actualmente disponibles y pendientes',`<div class="admin-status-grid"><div><b>Clientes y propiedades</b><p>Consulta autorizada de empresas y sitios.</p></div><div><b>Conexiones</b><p>Separadas por empresa; no se comparten claves.</p></div><div><b>Usuarios, planes y cobros</b><p>Necesitan un módulo de administración seguro antes de habilitarse.</p></div></div>`)}`;
}
  async function loadAdminStats(){
 if(!isAdmin())return;
 const stats={},items=[...state.businesses];state.adminStatsLoading=true;state.adminStatsError='';render();
 for(let i=0;i<items.length;i+=4){
  const batch=await Promise.all(items.slice(i,i+4).map(async b=>{
   try{const r=await api('/api/sites?business_id='+encodeURIComponent(b.id));
     const sites=Array.isArray(r.sites)?r.sites:[];
     return [b.id,{count:sites.length,ga4:sites.filter(x=>!!x.ga4_property_id).length}];
   }catch(e){return [b.id,{error:String(e.message).slice(0,120)}];}
  }));
  for(const [id,value] of batch)stats[id]=value;
 }
 if(isAdmin()){
  state.adminSiteStats=stats;state.adminStatsLoading=false;
  const failures=Object.values(stats).filter(x=>x.error).length;
  if(failures)state.adminStatsError=`No se pudieron consultar ${failures} empresa(s) debido a los permisos actuales.`;
  render();
 }
}
    function adminHome(){
 const items=state.businesses||[];
 const rows=items.map(b=>`<div class="client-site-row"><div class="client-avatar compact">${icon('building',19)}</div><div><strong>${clean(b.name)}</strong><small>${clean(b.slug)} · ${clean(state.adminPlans[b.id]||'Plan sin asignar')} · ${clean(adminStatusFor(b))}</small></div><button class="button button-soft" data-act="client-detail" data-id="${clean(b.id)}">Ver ficha</button></div>`).join('');
 return `${heading('Superadministrador','Centro de administración','Gestiona las empresas autorizadas y revisa las conexiones de la plataforma sin acceder a las credenciales de los clientes.')}
 <div class="small-kpis admin-overview-kpis">
 <div class="small-kpi"><span>Empresas visibles</span><strong>${fmt(items.length)}</strong><small>Según permisos de Supabase</small></div>
 <div class="small-kpi"><span>Sitios visibles</span><strong>${Object.values(state.adminSiteStats).length?fmt(Object.values(state.adminSiteStats).reduce((t,x)=>t+(x.count||0),0)):'—'}</strong><small>Según tus permisos</small></div>
 <div class="small-kpi"><span>Propiedades GA4 visibles</span><strong>${Object.values(state.adminSiteStats).length?fmt(Object.values(state.adminSiteStats).reduce((t,x)=>t+(x.ga4||0),0)):'—'}</strong><small>Con propiedad asignada</small></div>
 <div class="small-kpi"><span>Planes asignados</span><strong>${state.adminPlansLoaded?fmt(Object.values(state.adminPlans).filter(x=>x==='premium'||x==='free').length):'—'}</strong><small>${state.adminPlansLoaded?'Premium: '+fmt(Object.values(state.adminPlans).filter(x=>x==='premium').length)+' · Free: '+fmt(Object.values(state.adminPlans).filter(x=>x==='free').length):'Según permisos de Supabase'}</small></div><div class="small-kpi"><span>Verificación</span><strong>${fmt(Object.values(state.adminSiteStats).filter(x=>!x.error).length)} / ${fmt(items.length)}</strong><small>Empresas revisadas</small></div></div>
 <div class="content-grid">
 <div class="col-8">${card('Cartera de empresas','Abre una ficha para consultar sus propiedades autorizadas',rows||empty('No hay empresas visibles para esta cuenta.'))}</div>
 <div class="col-4">${card('Gestión rápida','Acciones disponibles para tu rol',`<div class="admin-quick-actions">
 <button class="button button-primary" data-act="nav" data-page="clients">${icon('building',16)} Gestionar empresas</button>
 <button class="button button-outline" data-act="nav" data-page="accounts">${icon('users',16)} Accesos y correos de clientes</button>
 <button class="button button-outline" data-act="nav" data-page="adminOperations">${icon('activity',16)} Supervisión de clientes</button>
 <button class="button button-outline" data-act="nav" data-page="adminIntegrations">${icon('plug',16)} Catálogo de integraciones</button>
 <button class="button button-outline" data-act="admin-check" ${state.adminStatsLoading?'disabled':''}>${icon('refresh',16)} Comprobar sitios</button>
 <button class="button button-outline" data-act="nav" data-page="settings">${icon('settings',16)} Mi cuenta y seguridad</button></div>`)}</div>
 <div class="col-12">${card('Control de la plataforma','Acceso y estado de las funcionalidades',`<div class="admin-status-grid">
 <div><b>Accesos independientes</b><p>Las fichas se consultan con los permisos de tu cuenta; no se usan las sesiones de tus clientes.</p></div>
 <div><b>Fuentes autorizadas</b><p>GA4 y Meta muestran datos únicamente cuando existe una conexión válida. Los demás proveedores indican que están pendientes.</p></div>
 <div><b>Planes y acceso por empresa</b><p>Asigna Premium con todos los permisos o Free con integraciones ON/OFF. Requiere habilitar el almacenamiento en Supabase. Los cobros automáticos aún no están disponibles.</p></div>
 </div>`)}</div></div>`;
}


const businessFeatureLabels=[
 ['ga4','Google Analytics 4'],['search_console','Google Search Console'],
 ['social_organic','Facebook / Instagram orgánico'],['hotmart','Hotmart'],['shopify','Shopify'],
 ['meta_ads','Meta Ads'],['google_ads','Google Ads'],['tiktok_ads','TikTok Ads'],['linkedin_ads','LinkedIn Ads']
];
const businessFeatureKey=name=>({
 'Google Analytics 4':'ga4','Google Search Console':'search_console',
 'Facebook / Instagram orgánico':'social_organic','Hotmart':'hotmart','Shopify':'shopify',
 'Meta Ads':'meta_ads','Google Ads':'google_ads','TikTok Ads':'tiktok_ads','LinkedIn Ads':'linkedin_ads'
})[name]||'';
const featureEnabled=key=>!state.clientEntitlements||state.clientEntitlements.features?.[key]!==false;

async function saveAdminFeature(feature,enabled,plan){
 if(!isAdmin()||state.adminFeatureBusy||!state.adminFeatureBusiness||state.adminEntitlements?.configured!==true)return;
 const id=state.adminFeatureBusiness;
 state.adminFeatureBusy=true;state.adminFeatureError='';state.adminFeatureNotice='';render();
 try{
  const data=await api('/api/admin/business-features',{method:'POST',body:JSON.stringify({
    business_id:id,...(plan?{plan}:{feature,enabled})
  })});
  if(state.adminFeatureBusiness===id){
    state.adminEntitlements=data;
    if(data.plan)state.adminPlans[id]=data.plan;
    state.adminFeatureNotice=plan?('Plan '+(plan==='premium'?'Premium':'Free')+' asignado. '+(plan==='premium'?'Todos los permisos están habilitados para la empresa.':'Personaliza sus integraciones con ON/OFF.')):'Permiso de integración guardado para esta empresa.';
  }
 }catch(e){if(state.adminFeatureBusiness===id)state.adminFeatureError=e.message;}
 finally{state.adminFeatureBusy=false;render();}
}

async function loadClientEntitlements(id){
 try{
  const data=await api('/api/client/features?business_id='+encodeURIComponent(id));
  if(state.businessId===id){state.clientEntitlements=data;render();}
 }catch{if(state.businessId===id){state.clientEntitlements=null;render();}}
}
async function loadAdminPlans(){
 if(!isAdmin())return;
 try{
  const data=await api('/api/admin/business-features?list=1');
  if(!isAdmin())return;
  state.adminPlans={};
  for(const x of data.plans||[]){if(state.businesses.some(b=>b.id===x.business_id))state.adminPlans[x.business_id]=x.plan;}
  state.adminPlansLoaded=!!data.configured;
 }catch{state.adminPlans={};state.adminPlansLoaded=false;}
 render();
}

async function loadAdminEntitlements(id){
 if(!isAdmin()||!state.businesses.some(b=>b.id===id))return;
 state.adminFeatureBusiness=id;state.adminEntitlements=null;state.adminFeatureLoading=true;state.adminFeatureError='';state.adminFeatureNotice='';render();
 try{
  const data=await api('/api/admin/business-features?business_id='+encodeURIComponent(id));
  if(state.adminFeatureBusiness===id){state.adminEntitlements=data;if(!data.configured)state.adminFeatureError='Para activar controles reales necesitas SUPABASE_SERVICE_ROLE_KEY y ejecutar la migración ed_business_features.sql en Supabase.';}
 }catch(err){if(state.adminFeatureBusiness===id)state.adminFeatureError=err.message;}
 finally{if(state.adminFeatureBusiness===id){state.adminFeatureLoading=false;render();}}
}
function adminPermissionsPanel(){
 const businesses=state.businesses||[],id=state.adminFeatureBusiness||businesses[0]?.id||'';
 const data=state.adminEntitlements,ready=data?.configured===true,flags=data?.features||{};
 const plan=data?.plan||null,premium=plan==='premium',free=plan==='free';
 const options=businesses.map(b=>'<option value="'+clean(b.id)+'" '+(id===b.id?' selected':'')+'>'+clean(b.name)+'</option>').join('');
 const controls=businessFeatureLabels.map(([key,name])=>{
   const on=premium?true:!!flags[key];
   const unavailable=['search_console','social_organic','hotmart','shopify','google_ads','tiktok_ads','linkedin_ads'].includes(key);
   const editable=ready&&free&&!state.adminFeatureBusy;
   return '<div class="admin-feature-row">'+providerLogo(name)+
    '<div class="admin-feature-name"><strong>'+clean(name)+'</strong><small>'+
    (unavailable?'En desarrollo · permiso para cuando se habilite la conexión.':
     premium?'Incluido en Premium · '+(key==='ga4'?'requiere propiedad GA4 autorizada.':'requiere una cuenta Meta autorizada.'):
     'Disponible según permisos y conexión de la empresa.')+'</small></div>'+
    '<label class="admin-feature-switch" title="'+(editable?'Cambiar permiso: ':'Permiso: ')+clean(name)+'"><input type="checkbox" class="admin-feature-toggle" data-feature="'+key+'" '+(on?'checked':'')+' '+(!editable?'disabled':'')+' aria-label="'+clean(name)+' '+(on?'activado':'desactivado')+'"/><span></span></label>'+
    '<small class="admin-feature-state">'+(on?'ON':'OFF')+'</small></div>';
 }).join('');
 const canAssign=ready&&!state.adminFeatureBusy&&!state.adminFeatureLoading;
 const top='<div class="admin-feature-header"><label class="form-label">Selecciona un cliente / empresa<select id="admin-feature-business" class="simple-input" '+(!businesses.length?'disabled':'')+'>'+options+'</select></label>'+
 '<div class="admin-feature-plan-summary"><span class="admin-plan-label">Plan del cliente</span><div class="admin-plan-value">'+(premium?'Premium':free?'Free':'Sin asignar')+'</div>'+
 '<p class="fine-print">Cada empresa tiene su propio plan. No se cobra nada desde esta pantalla.</p></div></div>';
 const planCards='<div class="admin-plan-options" role="group" aria-label="Asignar plan a la empresa">'+
 '<div class="admin-plan-option '+(free?'selected':'')+'"><div><b>Plan Free</b><p>Permisos personalizados. Tú decides qué integraciones se activan.</p></div><button type="button" class="button '+(free?'button-soft':'button-outline')+'" data-act="admin-set-free" '+(!canAssign||free?'disabled':'')+'>'+(free?'Free asignado':'Asignar Free')+'</button></div>'+
 '<div class="admin-plan-option '+(premium?'selected':'')+'"><div><b>Plan Premium</b><p>Incluye todos los permisos de integración. Ideal para clientes con página web.</p></div><button type="button" class="button '+(premium?'button-soft':'button-primary')+'" data-act="admin-set-premium" '+(!canAssign||premium?'disabled':'')+'>'+(premium?'Premium asignado':'Asignar Premium')+'</button></div></div>';
 return card('Planes y permisos por empresa','Selecciona un cliente, asigna su plan y controla sus integraciones. Los cambios se aplican únicamente a esa empresa.',
   top+planCards+
   '<div class="admin-feature-shortcuts"><button type="button" class="button button-outline" data-act="nav" data-page="accounts">'+icon('users',16)+' Ver correos y accesos de clientes</button><button type="button" class="button button-outline" data-act="nav" data-page="clients">'+icon('building',16)+' Ver empresas</button></div>'+
   (state.adminFeatureLoading?'<div class="ga-wizard-pulse" role="status">Consultando el plan y los permisos de la empresa…</div>':'')+
   (state.adminFeatureError?alertBlock(state.adminFeatureError,'info'):'')+
   (state.adminFeatureNotice?'<p class="company-message" role="status">'+clean(state.adminFeatureNotice)+'</p>':'')+
   '<div class="admin-permissions-heading"><div><h3>Acceso a las integraciones</h3><p>'+(premium?'Premium: todos los permisos están incluidos y los interruptores permanecen ON. Cambia a Free para personalizarlos.':free?'Free: activa o desactiva cada integración con ON/OFF.':'Asigna un plan para habilitar los interruptores.')+'</p></div><span class="admin-feature-pill">'+(premium?'Todos ON':free?'Personalizable':'Sin asignar')+'</span></div>'+
   '<div class="admin-feature-grid">'+controls+'</div>'+
   (!ready?'<div class="admin-setup-guide"><strong>Falta activar el almacenamiento de permisos</strong><p>Para asignar planes y usar ON/OFF primero ejecuta la migración <code>migrations/20261013_ed_business_features.sql</code> en Supabase y guarda <code>SUPABASE_SERVICE_ROLE_KEY</code> como secreto en Cloudflare. Hasta entonces los interruptores son una vista previa y no se pueden guardar.</p></div>':'')+
   '<p class="fine-print">Desactivar GA4 o Meta impide su consulta por API. Activar un proveedor que aún diga «Próximamente» no conecta automáticamente esa plataforma.</p>'
 );
}

    function adminIntegrations(){
 const health=state.adminHealth||{},m=health.meta||{},checks=m.checks||{};
 const failed=[['app_id','META_APP_ID'],['app_secret','META_APP_SECRET'],['redirect','META_REDIRECT_URI'],['session_key','META_SESSION_KEY']].filter(([key])=>!checks[key]).map(([,name])=>name);
 const metaLabel=!state.adminHealth?'Sin verificar':m.configured?'Configuración detectada':'Configuración incompleta';
 const services=[['Analítica y contenidos',[
  ['Google Analytics 4','Consultas disponibles si existe propiedad y cuenta de servicio autorizada.'],
  ['Google Search Console','Autorización oficial pendiente.'],['Facebook / Instagram orgánico','Autorización de páginas y perfiles pendiente.']]],
  ['Ventas y e-commerce', [['Hotmart','Autorización individual pendiente.'],['Shopify','Conexión de tienda pendiente.']]],
  ['Publicidad', [['Meta Ads','Conexión piloto directa con Meta for Developers; los clientes requieren acceso autorizado en la app.'],
  ['Google Ads','OAuth y permisos oficiales pendientes.'],['TikTok Ads','API pendiente.'],['LinkedIn Ads','Permisos oficiales pendientes.']]]];
 return `${heading('Administración','Integraciones','Controla las conexiones por empresa y verifica el estado técnico de cada plataforma.')}
 ${adminPermissionsPanel()}
 ${card('Diagnóstico de Meta Ads','Comprobación del Worker activo: nunca se muestran los valores de secretos',`
 <div class="integration-compact-footer">${tag(metaLabel,m.configured?'success':'neutral')}
 <button type="button" class="button button-outline" data-act="admin-health-refresh">${icon('refresh',16)} Comprobar conexión</button></div>
 ${state.adminHealthError?alertBlock(state.adminHealthError):''}
 ${state.adminHealth&&!m.configured?`<p class="fine-print">Configuración pendiente o no válida: ${clean(failed.join(', '))}. Comprueba estas variables en Cloudflare → Worker → Production → Variables and Secrets. No compartas sus valores.</p>`:''}
 ${state.adminHealth&&!checks.redirect?`<div class="admin-setup-guide"><strong>URL de retorno para Meta Ads</strong><p>En Cloudflare, agrega o corrige la variable <code>META_REDIRECT_URI</code> con esta URL exacta del Worker activo:</p><div class="admin-callback-row"><code>${clean(location.origin+'/api/meta/callback')}</code><button class="button button-outline" type="button" data-act="copy-meta-redirect">Copiar URL</button></div><p>Registra también la misma URL en Meta for Developers → Facebook Login → URI de redireccionamiento OAuth válidos. Luego pulsa «Comprobar conexión».</p></div>`:''}
 ${state.adminSetupNotice?`<p class="fine-print" role="status">${clean(state.adminSetupNotice)}</p>`:''}
 ${m.automatic_redirect?'<p class="fine-print">La URL de retorno del Worker se detecta automáticamente. Para permitir conexiones de clientes, debe figurar en Meta for Developers → Facebook Login → URI de redireccionamiento OAuth válidos. No es necesario configurar esa URL por cada cliente.</p>':''}
 ${m.configured?'<p class="fine-print">Las credenciales de plataforma están disponibles. Para que cualquier cliente externo conecte su propia cuenta, la aplicación de Meta también debe tener los permisos aprobados y estar en el modo apropiado; cada cliente autoriza mediante Facebook Login.</p>':''}
 `)}
 ${services.map(([title,providers])=>`<section class="integration-section"><div class="section-caption"><h2>${clean(title)}</h2><span>${providers.length} plataformas</span></div>
 <div class="integration-grid">${providers.map(([name,description])=>`<article class="integration-card provider-card"><div class="integration-head">${providerLogo(name)}${tag(name==='Meta Ads'?metaLabel:name==='Google Analytics 4'?'Disponible por propiedad':'Próximamente',name==='Meta Ads'&&m.configured?'success':'neutral')}</div><h3>${clean(name)}</h3><p>${clean(description)}</p></article>`).join('')}</div></section>`).join('')}`;
}
  async function loadAdminHealth(){
 if(!isAdmin())return;
 try{state.adminHealth=await api('/api/admin/integrations/health');state.adminHealthError='';}
 catch(e){state.adminHealthError=e.message;state.adminHealth=null;}
 if(isAdmin())render();
}
async function loadAccounts(){
  if(!isAdmin())return;
  state.accountsLoading=true;state.accountsError='';render();
  try{
    const data=await api('/api/admin/accounts');
    state.accountsLoaded=true;state.accountsConfigured=data.configured!==false;
    state.adminAccounts=Array.isArray(data.accounts)?data.accounts:[];
    state.accountsError=data.configured===false?(data.reason||'Configuración administrativa pendiente.'):'';
    if(data.truncated)state.accountsError='El directorio muestra como máximo 200 usuarios en esta fase de prueba.';
  }catch(e){state.accountsLoaded=true;state.accountsConfigured=null;state.adminAccounts=[];state.accountsError=e.message;}
  finally{state.accountsLoading=false;render();}
}
  function accounts(){
  if(!isAdmin())return overview();
  const list=state.adminAccounts||[];
  const date=v=>{if(!v)return 'Sin registro';const d=new Date(v);return Number.isNaN(d.valueOf())?'Sin registro':d.toLocaleDateString('es-PE',{year:'numeric',month:'short',day:'numeric'});};
  const results=list.map(u=>`<div class="client-site-row account-access-row">
    <div class="client-avatar compact">${icon('users',19)}</div>
    <div class="account-access-info"><strong>${clean(u.email)}</strong><small>Rol: ${clean(u.role||'Cliente')} · Último acceso: ${clean(date(u.last_sign_in_at))}</small></div>
    <div class="account-access-actions"><button class="button button-outline" data-act="account-email-history" data-id="${clean(u.id)}">Historial de correo</button><button class="button button-outline" data-act="account-temp" data-id="${clean(u.id)}" data-email="${clean(u.email)}">Restablecer clave</button></div>
  </div>`).join('');
  return `${heading('Superadministrador','Accesos de clientes','Directorio de correos de acceso y recuperación segura de contraseñas, sin mostrar credenciales privadas.')}
    <div class="account-access-toolbar"><button class="button button-outline" data-act="accounts-refresh" ${state.accountsLoading?'disabled':''}>${icon('refresh',16)} ${state.accountsLoading?'Consultando…':'Actualizar usuarios'}</button><span>${fmt(list.length)} cuentas visibles</span></div>
    ${state.accountsError?alertBlock(state.accountsError,'info'):''}
    ${state.accountsConfigured===false?`<div class="admin-setup-guide"><strong>Activa la gestión de accesos</strong><p>En Supabase abre la configuración del proyecto → API Keys y obtén la clave de servidor <code>service_role</code>. Agrégala en Cloudflare → Worker → Variables and Secrets como secreto cifrado con el nombre <code>SUPABASE_SERVICE_ROLE_KEY</code>.</p><p>No publiques ni pegues esa clave en el chat, en GitHub ni en código del navegador. Después pulsa «Actualizar usuarios».</p></div>`:''}
    ${state.accountNotice?`<p class="company-message">${clean(state.accountNotice)}</p>`:''}
    ${state.temporaryAccess?`<div class="temporary-credential" role="status"><strong>Clave temporal de ${clean(state.temporaryAccess.email)}</strong><div class="temporary-credential-content"><code>${clean(state.temporaryAccess.password)}</code><button type="button" class="button button-primary" data-act="account-copy-temp">Copiar</button></div><p>Se muestra solo ahora. Envíala de forma privada y pide al cliente que la cambie en Mi cuenta.</p></div>`:''}
    ${card('Usuarios de clientes','Correos registrados en Supabase Auth',results||(state.accountsError?empty('No se pudo cargar el directorio. Revisa el aviso y vuelve a intentarlo.'):empty(state.accountsLoading?'Consultando cuentas…':state.accountsLoaded?'No hay cuentas de clientes disponibles.':'Pulsa Actualizar usuarios para consultar las cuentas.')))}
    ${state.emailHistoryUserId?card('Historial de cambios de correo','Solo registra cambios realizados después de activar la auditoría de Supabase',
      (state.emailHistoryLoading?'<p>Cargando historial…</p>':'')+
      (state.emailHistoryError?alertBlock(state.emailHistoryError,'info'):'')+
      (!state.emailHistoryLoading&&!state.emailHistoryError?(state.emailHistoryData.length?
        state.emailHistoryData.map(x=>'<div class="client-site-row"><div><strong>'+clean(x.previous_email||'Sin correo anterior')+' → '+clean(x.new_email||'Sin correo nuevo')+'</strong><small>'+clean(x.changed_at?new Date(x.changed_at).toLocaleString('es-PE'):'Sin fecha')+'</small></div></div>').join(''):'<p class="fine-print">No se han registrado cambios de correo desde la activación del historial.</p>'):'')+
      '<button type="button" class="button button-outline" data-act="account-email-hide">Cerrar historial</button>'
    ):''}
    <p class="fine-print">Las contraseñas no se almacenan ni pueden consultarse aquí. El administrador puede generar una clave temporal y entregarla al cliente de forma privada. Los accesos a empresas siguen sujetos a permisos.</p>`;
}
  function clients(){
 if(!isAdmin())return overview();
 const query=state.adminQuery.trim().toLowerCase(), filtered=state.businesses.filter(b=>(b.name+' '+(b.slug||'')).toLowerCase().includes(query));
 return `${heading('Administración','Mis clientes','Empresas a las que tienes acceso por Supabase. Las cuentas publicitarias y ventas siguen siendo privadas de cada negocio.')}
 <div class="admin-toolbar"><label class="admin-search">${icon('search',18)}<input id="admin-client-search" type="search" value="${clean(state.adminQuery)}" placeholder="Buscar empresa o identificador" aria-label="Buscar clientes"/></label><span>${fmt(filtered.length)} de ${fmt(state.businesses.length)} empresas</span></div>
 <div class="client-grid">${filtered.map(b=>`<article class="client-card client-card-clickable" data-act="client-detail" data-id="${clean(b.id)}" role="button" tabindex="0"><div class="client-avatar">${icon('building',27)}</div><h3>${clean(b.name)}</h3><p>${clean(b.slug)}</p><div class="client-plan-tag">${clean(state.adminPlans[b.id]||'Plan sin asignar')}</div><div class="client-line">${icon('lock',14)} ${clean(adminStatusFor(b))} · Aislamiento por empresa</div><span class="button button-outline">Ver ficha ${icon('chevron',15)}</span></article>`).join('')||empty(query?'No hay clientes que coincidan con la búsqueda.':'No hay negocios autorizados.')}</div>`;
}

  function clientDetail(){
 if(!isAdmin())return overview();
 const b=business();if(!b)return clients();
 const sites=state.sites.map(s=>`<div class="client-site-row"><div class="client-avatar compact">${icon('globe',19)}</div><div><strong>${clean(s.name)}</strong><small>${clean(s.url||'URL no registrada')}</small></div><span class="client-site-badge">${s.ga4_property_id?'GA4 asignado':'GA4 pendiente'}</span></div>`).join('');
 return `${heading('Cliente',b.name,'Consulta administrativa: sin usar sus tokens ni mezclar sus datos con otras empresas.')}
 <div class="client-detail-actions"><button class="button button-primary" data-act="admin-manage-features" data-id="${clean(b.id)}">Configurar permisos y plan</button><button class="button button-outline" data-act="nav" data-page="clients">${icon('chevron',16)} Volver</button></div>
 <div class="content-grid"><div class="col-7">${card('Sitios visibles',fmt(state.sites.length)+' registros accesibles',sites||empty('No hay sitios visibles con tu rol actual; esto no confirma que el cliente no tenga sitios.'))}</div>
 <div class="col-5">${card('Privacidad','Gestión de la plataforma',`<p>Las campañas y conexiones se consultan desde la sesión del cliente. No se muestran contraseñas ni secretos.</p><p class="fine-print">Invitaciones, planes y facturación requieren flujos administrativos propios antes de habilitar acciones de escritura.</p>`)}</div></div>`;
}
    function metaPilotEligible() { return !isAdmin() && !!business()?.id && featureEnabled('meta_ads'); }
  function metaMetric(value, digits=0) {
    const n=Number(value);
    return value===null || value===undefined || !Number.isFinite(n) ? '—' :
      new Intl.NumberFormat('es-PE',{maximumFractionDigits:digits}).format(n);
  }
  function providerLogo(name){
 const dict={
 'Meta Ads':['meta','0866FF'],'Google Ads':['googleads','4285F4'],'TikTok Ads':['tiktok','111111'],'LinkedIn Ads':['linkedin','0A66C2'],
 'Google Analytics 4':['googleanalytics','E37400'],'Google Search Console':['googlesearchconsole','4285F4'],
 'Facebook / Instagram orgánico':['instagram','E4405F'],'Hotmart':['hotmart','FF7A31'],'Shopify':['shopify','7AB55C']
 };
 if(name==='Facebook / Instagram orgánico')
   return '<div class="provider-logo provider-logo-duo" aria-hidden="true"><img src="/logos/facebook.svg" width="26" height="26" alt=""/><img src="/logos/instagram.svg" width="26" height="26" alt=""/></div>';
 const [slug]=dict[name]||['googleanalytics'];
 const local='/logos/'+(name==='Hotmart'?'hotmart':name==='LinkedIn Ads'?'linkedin':slug)+'.svg';
 return `<div class="provider-logo" aria-hidden="true"><img src="${local}" alt="" loading="lazy" width="32" height="32" onerror="this.onerror=null;this.src='/logos/platform.svg'"/></div>`;
}
    function metaCard(){
 if(!featureEnabled('meta_ads'))return `<article class="integration-card provider-card" data-connected="false"><div class="integration-head">${providerLogo('Meta Ads')}${tag('No incluida','neutral')}</div><h3>Meta Ads</h3><p>Publicidad de Facebook e Instagram.</p><div class="integration-status"><span>Esta empresa no tiene habilitada esta conexión. Consulta las opciones de tu plan.</span></div></article>`;
 if(!metaPilotEligible())return '';
 const m=state.meta||{},list=m.accounts||[],selected=m.selected_accounts||[m.selected_account].filter(Boolean);
 const accounts=list.map(x=>`<label class="meta-account-row"><input class="meta-account-check" type="checkbox" value="${clean(x.id)}" ${selected.includes(x.id)?'checked':''}/><span><strong>${clean(x.name)}</strong><small>${clean(x.id)} · ${clean(x.currency)}</small></span></label>`).join('');
 const reports=state.metaReport?.account_reports||[];
 const results=reports.map(x=>{
  const v=x.metrics;
  return `<div class="meta-account-result"><strong>${clean(x.name)} · ${clean(x.currency)}</strong>${v?`<div class="meta-kpi-grid"><div><small>Inversión</small><strong>${metaMetric(v.spend,2)}</strong></div><div><small>Clics</small><strong>${metaMetric(v.clicks)}</strong></div><div><small>Impresiones</small><strong>${metaMetric(v.impressions)}</strong></div><div><small>CTR</small><strong>${metaMetric(v.ctr,2)}%</strong></div><div><small>CPC</small><strong>${metaMetric(v.cpc,2)}</strong></div></div>`:'<p class="fine-print">Sin datos en el período.</p>'}</div>`;
 }).join('');
 const body=!m.configured?`<p>La conexión de Meta Ads aún no está habilitada en esta plataforma. Cuando termine la activación general, podrás conectar tu propia cuenta de Facebook sin asistencia.</p><button class="button button-outline" type="button" disabled title="La conexión estará disponible cuando finalice la activación de Meta en eDigital">Conexión en preparación</button><p class="fine-print">Cuando la conexión esté disponible, iniciarás sesión con Facebook, elegirás tus cuentas publicitarias y los informes aparecerán en este panel.</p>`:
 !m.connected?`<button class="button button-primary" data-act="campaign-connect-toggle">${icon('link',16)} Conectar con Facebook</button>`:
 `<label class="form-label">Elige hasta cinco cuentas publicitarias</label>
 <input class="meta-search" id="meta-account-search" placeholder="Buscar cuenta publicitaria…" autocomplete="off"/>
 <div class="meta-account-list">${accounts||'<p>No se encontraron cuentas autorizadas.</p>'}</div>
 <div class="meta-actions"><button class="button button-outline" data-act="meta-refresh">${icon('refresh',16)} Actualizar datos</button><button class="button button-soft" data-act="meta-disconnect">Desconectar</button><button class="button button-outline" data-act="nav" data-page="campaigns">Ver campañas ${icon('chevron',15)}</button></div>
 <p class="fine-print">Consulta las estadísticas desde Resumen y Campañas Ads. Esta conexión piloto está vinculada al navegador actual y no es permanente entre dispositivos.</p>`;
 return `<article class="integration-card provider-card" data-connected="${m.connected?'true':'false'}"><div class="integration-head">${providerLogo('Meta Ads')}${tag(m.connected?'Conectado':m.configured?'Disponible':'Pendiente',m.connected?'success':'neutral')}</div><h3>Meta Ads</h3><p>Publicidad de Facebook e Instagram.</p>${state.metaError?alertBlock(state.metaError):''}<div class="integration-status">${m.connected&&!state.metaPanelOpen?`<div class="integration-compact-footer"><span>${selected.length} cuenta(s) seleccionadas</span><button class="button button-outline" data-act="campaign-connect-toggle">Administrar cuentas</button></div>`:body}${m.connected&&state.metaPanelOpen?`<button class="button button-soft" data-act="meta-panel-toggle">Cerrar detalles</button>`:''}</div>${state.metaLoading?'<span class="fine-print">Consultando conexión…</span>':''}</article>`;
}
    async function loadMeta() {
    if(!metaPilotEligible()) {state.meta=null;state.metaReport=null;state.metaError='';render();return;}
    const current=state.businessId;
    state.metaLoading=true;state.metaError='';state.metaReport=null;render();
    try {
      const info=await api('/api/meta/status?business_id='+encodeURIComponent(current));
      if(state.businessId!==current)return;
      state.meta=info;
      if(info.error)state.metaError=info.error;
      if(info.connected && (info.selected_accounts?.length||info.selected_account)) {
        try {
          state.metaReport=await api('/api/meta/report?business_id='+encodeURIComponent(current)+
            (state.page==='campaigns'?adsDateQuery():'&period='+encodeURIComponent(state.period)));
        } catch(e) {state.metaError=e.message;}
      }
    }catch(e) {if(state.businessId===current)state.metaError=e.message;}
    finally {if(state.businessId===current){state.metaLoading=false;render();}}
  }
    function integrations(){
 const ga=gaReady(),lookup=[
  ['Analítica y contenidos',[
   {name:'Google Analytics 4',info:'Usuarios, sesiones y conversiones del sitio.',status:ga?'Conectado':'No conectado',connected:ga,details:ga?'Propiedad de Analytics con lectura autorizada.':'Este sitio aún no tiene estadísticas disponibles de Analytics.'},
   {name:'Google Search Console',info:'Consultas y posicionamiento SEO.',status:'Próximamente',details:'Necesita autorización de Google.'},
   {name:'Facebook / Instagram orgánico',info:'Alcance y estadísticas de perfiles sociales.',status:'Próximamente',details:'Pendiente de permisos de páginas y perfiles.'}] ],
  ['Publicidad',[
   {name:'Meta Ads',info:'Facebook e Instagram Ads.'},
   {name:'Google Ads',info:'Campañas de búsqueda, display y video.',status:'Próximamente',details:'API oficial y OAuth pendientes.'},
   {name:'TikTok Ads',info:'Anuncios y campañas en TikTok.',status:'Próximamente',details:'Permisos de TikTok Ads pendientes.'}] ],
  ['Ventas y e-commerce',[
   {name:'Hotmart',info:'Ventas, productos, ingresos y reembolsos.',status:'Próximamente',details:'Cada negocio necesitará sus propias credenciales.'},
   {name:'Shopify',info:'Pedidos, catálogo y ventas de tienda.',status:'Próximamente',details:'Pendiente de conexión individual por tienda.'},
   {name:'WooCommerce',info:'Pedidos y ventas de tu tienda WordPress.',status:'Próximamente',details:'Requiere conexión independiente a la API de WooCommerce.'}] ]
 ];
 const cardFor=(p)=>{
  const feature=businessFeatureKey(p.name);
  if(feature&&!featureEnabled(feature))return `<article class="integration-card provider-card" data-connected="false"><div class="integration-head">${providerLogo(p.name)}${tag('No incluida','neutral')}</div><h3>${clean(p.name)}</h3><p>${clean(p.info)}</p><div class="integration-status"><span>Esta integración está desactivada para tu empresa.</span></div></article>`;
  if(p.name==='Meta Ads')return metaCard();
  return `<article class="integration-card provider-card" data-connected="${p.connected?'true':'false'}">
   <div class="integration-head">${providerLogo(p.name)}${tag(p.status,p.connected?'success':'neutral')}</div>
   <h3>${clean(p.name)}</h3><p>${clean(p.info)}</p>
   <div class="integration-status"><span>${clean(p.details||'')}</span>${p.connected?`<button class="button button-outline" data-act="nav" data-page="analytics">Ver datos</button>`:''}</div>
  </article>`;
 };
 return `${state.campaignConnectionOpen?campaignMetaSetup():''}${heading('Mis conexiones','Integraciones de mi empresa','Conecta tus plataformas una vez y consulta los datos autorizados en sus paneles.')}
 <div class="integration-filter-bar"><label class="admin-search">${icon('search',18)}<input type="search" id="integration-search" placeholder="Buscar plataforma…" aria-label="Buscar integración"/></label>
 <label class="company-checkbox"><input id="integration-only-connected" type="checkbox"/> Solo conectadas</label></div>
 ${lookup.map(([group,providers])=>`<section class="integration-section"><div class="section-caption"><h2>${clean(group)}</h2><span>${providers.length} plataformas</span></div>
 <div class="integration-grid">${providers.map(cardFor).join('')}</div></section>`).join('')}
 <p class="fine-print">Las conexiones marcadas «Próximamente» todavía no tienen acceso a su API y no mostrarán datos ficticios. Meta Ads requiere que la plataforma esté autorizada en Cloudflare y Meta for Developers.</p>`;
}

  function settings(){
 const theme=[['light','Claro'],['dark','Oscuro'],['black','Negro']];
 const palettes=[['purple','Violeta'],['blue','Azul'],['teal','Turquesa'],['coral','Coral'],['amber','Ámbar'],['rose','Rosa'],['graphite','Grafito']];
 const sidebar=[['auto','Según tema'],['white','Blanco'],['blue','Azul oscuro'],['navy','Azul marino'],['graphite','Grafito oscuro'],['black','Negro']];
 const picker=(key,choices,selected)=>`<div class="preference-choice" role="group">${choices.map(([v,t])=>`<button class="pref-option ${selected===v?'selected':''}" type="button" data-act="set-pref" data-key="${key}" data-value="${v}" aria-pressed="${selected===v}">${key==='accent'?`<i class="accent-swatch swatch-${v}" aria-hidden="true"></i>`:''}${t}</button>`).join('')}</div>`;
 return `${heading('Preferencias','Mi cuenta y seguridad','Acceso, contraseña y colores del panel en un mismo lugar.')}
 <div class="content-grid account-grid">
 <div class="col-7">${card('Cambiar mi contraseña','Tu seguridad, siempre a la vista',`<form id="change-password-form" class="security-form" autocomplete="off">
  <label class="form-label" for="current-pass">Contraseña actual</label><div class="form-input">${icon('lock',17)}<input id="current-pass" type="password" name="currentPassword" autocomplete="current-password" required maxlength="512"/></div>
  <label class="form-label" for="next-pass">Nueva contraseña</label><div class="form-input">${icon('lock',17)}<input id="next-pass" type="password" name="newPassword" autocomplete="new-password" minlength="10" maxlength="128" required/></div>
  <label class="form-label" for="confirm-pass">Confirmar nueva contraseña</label><div class="form-input">${icon('check',17)}<input id="confirm-pass" type="password" name="confirmPassword" autocomplete="new-password" minlength="10" maxlength="128" required/></div>
  ${state.passwordError?alertBlock(state.passwordError):''}
  <button class="button button-primary security-submit" type="submit" ${state.passwordBusy?'disabled':''}>${state.passwordBusy?'Actualizando…':`${icon('lock',16)} Actualizar contraseña`}</button>
  <p class="fine-print">Usa al menos 10 caracteres. Tendrás que iniciar sesión de nuevo cuando se guarde.</p>
 </form>`)}</div>
 <div class="col-5">${card('Información de mi cuenta','Identidad de acceso',`<div class="settings-line"><span>Correo</span><b>${clean(state.user.email)}</b></div>
 <div class="settings-line"><span>Acceso</span><b>${isAdmin()?'Superadministrador':'Cliente'}</b></div>
 <div class="settings-line"><span>Mi empresa</span><b>${isAdmin()?'Plataforma':clean(displayBusiness())}</b></div>
 ${!isAdmin()?`<button class="button button-outline" data-act="nav" data-page="company">${icon('building',15)} Editar mi empresa</button>`:''}

 <p class="fine-print">El correo de acceso es fijo y no se puede modificar desde esta cuenta.</p>`)}</div>
 <div class="col-12">${card('Personalización de colores','Elige colores y estilo del menú según tu marca',`
 <div class="appearance-grid"><div><h4>Apariencia general</h4>${picker('theme',theme,state.theme)}</div>
 <div><h4>Color de acento</h4>${picker('accent',palettes,state.accent)}</div>
 <div><h4>Menú lateral</h4>${picker('sidebar',sidebar,state.sidebarTone)}</div></div>
 <p class="fine-print">Estas preferencias se guardan en este navegador.</p>`)}</div></div>`;
}

    const groupTitle=(title)=>`<div class="nav-group-title">${clean(title)}</div>`;
  const adsNavigation=()=>`<div class="crm-ads-nav"><button class="nav-link ${state.page==='campaigns'?'active':''}" data-act="campaign-menu" aria-expanded="${state.campaignsMenuOpen}" title="Campañas Ads">${icon('megaphone',19)}<span>Campañas Ads</span>${icon(state.campaignsMenuOpen?'chevronDown':'chevron',15)}</button>${state.campaignsMenuOpen?'<div class="crm-ads-subnav">'+[['meta','Meta Ads'],['google','Google Ads'],['tiktok','TikTok Ads'],['linkedin','LinkedIn Ads']].map(([key,label])=>'<button class="crm-ads-subitem '+(state.page==='campaigns'&&state.adsPlatform===key?'active':'')+'" data-act="campaign-select" data-platform="'+key+'"><span>'+label+'</span></button>').join('')+'</div>':''}</div>`;
  const navLink = id => `<button class="nav-link ${state.page===id?'active':''}" data-act="nav" data-page="${id}" title="${clean(pages[id][0])}" aria-label="${clean(pages[id][0])}" ${state.page===id?'aria-current="page"':''}>${icon(pages[id][1],19)}<span>${pages[id][0]}</span>${state.page===id?`<span class="active-indicator"></span>`:''}</button>`;
function sidebar(){
 const menu=isAdmin()?`${groupTitle('PLATAFORMA')}${['adminHome','clients','accounts','adminOperations','adminIntegrations','settings'].map(navLink).join('')}`:
 `${groupTitle('PANEL DE MI EMPRESA')}${['overview','analytics','acquisition'].map(navLink).join('')+adsNavigation()+['audience','content','events'].map(navLink).join('')}${groupTitle('VENTAS Y REPORTES')}${['reports'].map(navLink).join('')}${groupTitle('CONEXIONES Y CUENTA')}${['integrations','company','settings'].map(navLink).join('')}`;
 return `<aside class="sidebar ${state.mobileOpen?'opened':''}"><div class="sidebar-head">${brand(false)}<button class="sidebar-collapse-btn icon-button" data-act="collapse-sidebar" title="${state.sidebarCollapsed?'Expandir menú':'Contraer menú'}" aria-label="${state.sidebarCollapsed?'Expandir menú':'Contraer menú'}" aria-expanded="${!state.sidebarCollapsed}">${icon('panel-left-close',18)}</button><button class="mobile-close icon-button" data-act="menu">${icon('close')}</button></div><div class="nav-wrapper"><button type="button" class="sidebar-workspace" data-act="nav" data-page="${isAdmin()?'adminHome':'company'}" title="${isAdmin()?'Ir al panel de administración':'Abrir perfil de mi empresa'}" aria-label="${isAdmin()?'Ir al panel de administración':'Abrir perfil de mi empresa'}"><span class="workspace-symbol">${isAdmin()?icon('building',20):companyImage(30)}</span><span><b>${isAdmin()?'Administración de plataforma':clean(displayBusiness())}</b><small>${isAdmin()?'Panel administrador':'Editar datos de mi empresa'}</small></span>${icon('chevron',16)}</button>${menu}</div><div class="sidebar-bottom"><div class="avatar" title="${clean(state.user?.email||'Cuenta')}">${icon('user',20)}</div><div class="account"><b>${isAdmin()?'Superadministrador':clean(displayBusiness())}</b><span>${isAdmin()?'Cuenta de administración':'Cuenta de empresa'}</span></div><button class="icon-button logout" data-act="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('power',19)}</button></div></aside>`;
}
    function topbar(){
 const places=!isAdmin()&&state.businesses.length>1?`<label class="select-wrap company-select">${icon('building',16)}<select id="business-selector">${state.businesses.map(x=>`<option value="${clean(x.id)}" ${state.businessId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const sites=!isAdmin()&&state.sites.length?`<label class="select-wrap site-select">${icon('globe',16)}<select id="site-selector">${state.sites.map(x=>`<option value="${clean(x.id)}" ${state.siteId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const period=isAdmin()||state.page==='campaigns'?'':`<label class="select-wrap period-select">${icon('calendar',16)}<select id="date-period">${[['today','Hoy'],['yesterday','Ayer'],['7','7 días'],['30','30 días'],['90','90 días'],['365','12 meses']].map(([v,n])=>`<option value="${v}" ${state.period===v?'selected':''}>${n}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`;
 return `<header class="topbar"><div class="top-left"><button class="icon-button mobile-menu" data-act="menu">${icon('menu')}</button><div class="breadcrumbs">${isAdmin()?'Plataforma':'Mi empresa'} <span>/</span><strong>${clean(pages[state.page]?.[0]||'Resumen')}</strong></div></div><div class="top-right">${places}${sites}${isAdmin()?'':`<label class="search-wrap">${icon('search',18)}<input id="global-search" value="${clean(state.search)}" placeholder="Buscar en datos…"/></label>`}${period}${isAdmin()?'':`<button class="icon-button refresh-button" data-act="refresh" title="Actualizar">${icon('refresh',18)}</button>`}<button class="icon-button" data-act="theme" title="Tema">${icon(state.theme==='dark'?'sun':'moon',18)}</button><button class="top-avatar account-link" data-act="nav" data-page="settings" title="Mi cuenta">${icon('user',19)}</button></div></header>`;
}
    function login(){root.innerHTML=`<div class="login-page"><div class="login-side"><div class="login-brand">${brand(true)}</div><div class="login-center"><div class="login-pill">${icon('spark',16)} Intelligence for better decisions</div><h1>Todos tus datos.<br><em>Una mejor perspectiva.</em></h1><p>Transforma información en decisiones. Un solo espacio para comprender tu sitio, tus usuarios y las ventas conectadas.</p><div class="login-feature-row"><span>${icon('check',15)} Datos reales</span><span>${icon('check',15)} Multiempresa</span><span>${icon('check',15)} Acceso seguro</span></div><div class="login-abstract" aria-hidden="true"><div class="abstract-blob"></div><div class="abstract-card a"><div class="abstract-dots"><i></i><i></i><i></i></div><span>Overview analytics</span><div class="abstract-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="abstract-card b"><div class="abstract-circle"></div><div class="abstract-lines"><i></i><i></i><i></i></div></div></div></div><div class="login-copyright">© eDigital · Analytics Platform</div></div><main class="login-form-side"><div class="login-theme"><button class="icon-button" data-act="theme" title="Cambiar tema">${icon(state.theme==='dark'?'sun':'moon')}</button></div><div class="login-panel"><div class="login-badge">ACCESO A TU DASHBOARD</div><h2>Bienvenido de nuevo <span>👋</span></h2><p class="login-sub">Ingresa con tu cuenta para ver todos tus reportes en un mismo lugar.</p>${state.startupError?alertBlock(state.startupError):''}${state.loginNotice?alertBlock(state.loginNotice,'info'):''}<form id="login-form"><label class="form-label" for="email">Correo electrónico</label><div class="form-input">${icon('users',17)}<input id="email" name="email" type="email" placeholder="tucorreo@empresa.com" autocomplete="username" required/></div><label class="form-label" for="password">Contraseña</label><div class="form-input">${icon('lock',17)}<input id="password" name="password" type="password" placeholder="Tu contraseña de acceso" autocomplete="current-password" required/><button type="button" class="password-toggle" data-act="show-password" title="Mostrar u ocultar contraseña">${icon('eye',18)}</button></div>${state.loginError?alertBlock(state.loginError):''}<button class="button button-primary sign-in" type="submit" ${state.loginBusy||state.startupError?'disabled':''}>${state.loginBusy?'<span class="spinner"></span> Validando cuenta…':'Ingresar a mi dashboard'} ${!state.loginBusy?icon('arrowUp',18):''}</button></form><div class="login-help">${icon('lock',14)} Acceso protegido por Supabase Auth. Nunca introduzcas claves de API aquí.</div></div><div class="login-contact">¿Necesitas acceso? Solicítalo al administrador de la plataforma.</div></main></div>`;}
  function render() {
    setTheme();
    // Refresh floating helper after every screen transition, including sign-in/out.
    queueMicrotask(() => window.dispatchEvent(new Event('edigital:render')));
    if(state.loading){root.innerHTML=`<div class="initial-load"><span class="spinner"></span><strong>Preparando Edwin CRM…</strong></div>`;return;}
    if(!state.user){login();return;}
    if(isAdmin()&&!['adminHome','clients','accounts','clientDetail','adminOperations','adminIntegrations','settings'].includes(state.page))state.page='adminHome';
    if(!isAdmin()&&['adminHome','clients','accounts','clientDetail','adminOperations','adminIntegrations'].includes(state.page))state.page='overview';
    const contents={overview,analytics,acquisition,campaigns,utm,audience,content,events,hotmart,reports,clients,accounts,clientDetail,adminHome,adminOperations,adminIntegrations,integrations,company,settings};
    let pageMarkup;
    try {pageMarkup=(contents[state.page]||overview)();}
    catch(error){
      console.error('Unable to render eDigital view:',error);
      pageMarkup=`<section class="card page-render-error"><h2>No pudimos cargar esta sección</h2><p>La información de tu cuenta sigue protegida. Intenta actualizar el panel; si continúa ocurriendo, avisa al administrador.</p><button type="button" class="button button-primary" data-act="refresh">Reintentar</button></section>`;
    }
    root.innerHTML=`<div class="layout ${state.sidebarCollapsed?'sidebar-collapsed':''}">${state.mobileOpen?'<div class="mobile-shade" data-act="menu"></div>':''}${sidebar()}<div class="main-column">${topbar()}<main class="main-content">${pageMarkup}</main><footer class="footer"><span>© ${new Date().getFullYear()} Edwin CRM · Plataforma de análisis</span><span>${icon('lock',13)} Datos autorizados · No se presentan métricas inventadas</span></footer></div></div>`;
  }
  async function loadAds(){
 if(isAdmin()||!state.businessId||state.adsPlatform!=='meta'){state.metaCampaigns=null;state.adsLoading=false;render();return;}
 const businessId=state.businessId,period=state.adsPeriod,dates=adsDateQuery(),level=state.adsLevel;
 if(!state.meta?.connected||!(state.meta?.selected_accounts?.length||state.meta?.selected_account)){state.metaCampaigns=null;state.adsLoading=false;render();return;}
 state.adsLoading=true;state.adsError='';state.metaCampaigns=null;render();
 try{
  const rows=await api('/api/meta/campaigns?business_id='+encodeURIComponent(businessId)+dates+'&level='+encodeURIComponent(level));
  if(state.businessId===businessId&&state.adsPeriod===period&&adsDateQuery()===dates&&state.adsLevel===level)state.metaCampaigns=rows;
 }catch(e){if(state.businessId===businessId)state.adsError=e.message;}
 finally{if(state.businessId===businessId){state.adsLoading=false;render();}}
}
  async function refresh() {
    const generation=++state.requestId, b=state.businessId, s=state.siteId, p=state.period;
    state.ga=null;state.hm=null;state.gaError='';state.hmError='';
    state.gaLoading=!!s&&featureEnabled('ga4');state.hmLoading=selectedBusinessIsHotmart();render();
    const jobs=[];
    if(s&&featureEnabled('ga4'))jobs.push(api(`/api/ga4/report?business_id=${encodeURIComponent(b)}&site_id=${encodeURIComponent(s)}&period=${encodeURIComponent(p)}`).then(x=>({type:'ga',value:x})).catch(e=>({type:'ga',error:e.message})));
    if(selectedBusinessIsHotmart())jobs.push(api(`/api/hotmart/summary?business_id=${encodeURIComponent(b)}&period=${encodeURIComponent(p)}`).then(x=>({type:'hm',value:x})).catch(e=>({type:'hm',error:e.message})));
    const results=await Promise.all(jobs);if(state.requestId!==generation)return;
    for(const result of results){ if(result.type==='ga'){state.ga=result.value||null;state.gaError=result.error||'';}else{state.hm=result.value||null;state.hmError=result.error||'';} }
    state.gaLoading=false;state.hmLoading=false;render();
  }
  async function chooseBusiness(id){
    if(!state.businesses.some(b=>b.id===id))return;
    ++state.requestId; state.businessId=id;state.adsPeriod=state.period;state.adsCustomStart='';state.adsCustomEnd='';state.adsFilterError='';state.campaignConnectionOpen=false;state.campaignWizardSelectedIds=null;state.campaignWizardStage='accounts';state.campaignAccountNotice='';state.companyLogoDraft=null;state.companyLogoClear=false;state.sites=[];state.siteId='';state.ga=null;state.hm=null;state.clientEntitlements=null;state.meta=null;state.metaReport=null;state.metaCampaigns=null;state.adsAccount='';state.adsSearch='';state.adsStatus='';state.adsObjective='';state.metaError='';state.search='';state.gaError='';state.hmError='';render();
    try{const result=await api(`/api/sites?business_id=${encodeURIComponent(id)}`);if(state.businessId!==id)return;state.sites=result.sites||[];state.siteId=state.sites.find(s=>!!s.ga4_property_id)?.id||state.sites[0]?.id||'';}
    catch(e){state.gaError=e.message;}
    if(!isAdmin()){await loadClientEntitlements(id);await refresh();if(metaPilotEligible()&&featureEnabled('meta_ads'))await loadMeta();}
  }
  async function init(){
    state.loading=true;render();
    try{
      const status=await api('/api/status');if(!status.configured)throw new Error(`Configuración pendiente: ${(status.missing||[]).join(', ')}`);
      const user=await api('/api/me');const companies=await api('/api/businesses');
      const returnBusiness=new URLSearchParams(location.search).get('business_id');
      state.user=user.user;state.businesses=companies.businesses||[];state.page=isAdmin()?'adminHome':'overview';if(!isAdmin()&&new URLSearchParams(location.search).has('meta')){
        const parameters=new URLSearchParams(location.search),campaignReturn=parameters.get('return_to')==='campaigns';
        state.page=campaignReturn?'campaigns':'integrations';
        if(campaignReturn)state.campaignConnectionOpen=true;
        if(parameters.get('meta')==='cancelled')state.metaError='Se canceló la autorización con Facebook.';
        history.replaceState({},'',location.pathname+location.hash);
      }state.startupError='';state.loginError='';state.loginNotice='';state.loginBusy=false;state.loading=false;render();
      if(isAdmin()){await loadAdminStats();await loadAdminPlans();}
      else if(state.businesses.length){
        const targetBusiness=state.businesses.find(x=>x.id===returnBusiness)?.id||state.businesses[0].id;
        await chooseBusiness(targetBusiness);if(state.page==='campaigns')await loadAds();
      }
    }catch(e){state.loading=false;state.user=null;state.loginBusy=false;if(e.status!==401)state.startupError=e.message;render();}
  }
  function doCsv(dataset=''){
    let list=[];
    if(dataset==='ads'){
      list=adsFilteredRows().map(x=>({
        Cuenta:x.account_name,Campaña:x.campaign_name||x.name,
        Detalle:x.name,Estado:metaStatusLabel(x.effective_status),Objetivo:metaObjectiveLabel(x.objective),
        Inicio:x.date_start||'',Fin:x.date_stop||'',Moneda:x.currency||'',
        Inversión:x.spend,Alcance:x.reach,Impresiones:x.impressions,Frecuencia:x.frequency,
        Clics:x.clicks,CTR:x.ctr,CPC:x.cpc,CPM:x.cpm
      }));
    }
    else if(dataset==='hotmart-products')list=state.hm?.products?.map(p=>({Producto:p.name,Ventas:p.count}))||[];
    else if(dataset)list=rows(dataset);
    else if(state.page==='hotmart')list=state.hm?.products?.map(p=>({Producto:p.name,Ventas:p.count}))||[];
    else{const selection={overview:'trend',analytics:'trend',acquisition:'sources',campaigns:'campaigns',audience:'countries',content:'pages',events:'events',reports:'trend'};list=rows(selection[state.page]||'trend');}
    if(!list.length){alert('No hay datos reales disponibles para descargar.');return;}
    const cols=Object.keys(list[0]);const quote=v=>{const t=String(v??'');return '"'+(/^[\s]*[=+\-@]/.test(t)?"'"+t:t).replace(/"/g,'""')+'"';};
    const content=[cols.map(quote).join(','),...list.map(item=>cols.map(k=>quote(item[k])).join(','))].join('\r\n');
    const file=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});const uri=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=uri;a.download=`e-digital-${dataset||state.page}-${dataset==='ads'?state.adsPeriod:state.period}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(uri),800);
  }
  async function readCompanyLogo(file){
 if(!file||!file.size)return null;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3000000)
   throw Error('Selecciona una imagen PNG, JPG o WebP de hasta 3 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const width=bitmap.width,height=bitmap.height;
  if(!width||!height||width>10000||height>10000)throw Error('Imagen no válida.');
  const canvas=document.createElement('canvas'),scale=Math.min(240/width,240/height,1);
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  let result=canvas.toDataURL('image/webp',.77);
  if(!result.startsWith('data:image/webp;'))result=canvas.toDataURL('image/jpeg',.7);
  if(result.length>90000)throw Error('El logotipo es demasiado grande incluso después de optimizarlo.');
  return result;
 }finally{bitmap.close?.();}
}
  async function saveCompany(form){
 if(!state.businessId||state.companyBusy)return;
 const input=new FormData(form),id=state.businessId;
 const display_name=String(input.get('displayName')||'').trim(),
 category=String(input.get('category')||'').trim(),country=String(input.get('country')||'').trim();
 if(display_name.length<2||display_name.length>80){state.companyError='Ingresa un nombre comercial de 2 a 80 caracteres.';render();return;}
 const selected=input.get('logo');
 state.companyBusy=true;state.companyError='';state.companyNotice='';
 try{
  let logo_data=state.companyLogoClear?'':getCompanyLogo();
  if(state.companyLogoDraft)logo_data=state.companyLogoDraft;
  else if(selected&&selected.size)logo_data=await readCompanyLogo(selected);
  const result=await api('/api/company/preferences',{method:'POST',
    body:JSON.stringify({business_id:id,display_name,category,country})});
  if(state.businessId!==id)return;
  state.user.business_preferences={...(state.user.business_preferences||{}),[id]:result.profile};
  try{if(logo_data)localStorage.setItem(logoStoreKey(),logo_data);else localStorage.removeItem(logoStoreKey());}
  catch{throw Error('El perfil se guardó, pero el navegador no pudo conservar el logotipo.');}
  let shared=false,message='';
  if(input.get('sharedName')){
   try{
    const changed=await api('/api/company/name',{method:'PATCH',body:JSON.stringify({business_id:id,name:display_name})});
    const target=state.businesses.find(b=>b.id===id);if(target)target.name=changed.name;
    shared=true;
   }catch(e){message=' El nombre oficial no se pudo modificar para todo el equipo porque faltan permisos de edición.';}
  }
  state.companyLogoClear=false;state.companyLogoDraft=null;
  state.companyNotice=(shared?'Nombre oficial actualizado.':'Nombre visual, sector y país guardados en tu cuenta.')+(logo_data?' El logotipo se guardó solo en este navegador.':'')+message;
 }catch(e){state.companyError=e.message||'No se pudieron guardar los cambios.';}
 finally{state.companyBusy=false;render();}
}
  async function saveSite(form){
 if(!state.businessId||state.siteBusy)return;
 const data=new FormData(form),businessId=state.businessId,siteId=String(data.get('siteId')||'');
 state.siteBusy=true;state.siteError='';state.siteNotice='';
 try{
  const changed=await api('/api/sites/edit',{method:'PATCH',
    body:JSON.stringify({business_id:businessId,site_id:siteId,
      name:String(data.get('siteName')||'').trim(),url:String(data.get('siteUrl')||'').trim()})});
  if(state.businessId!==businessId)return;
  const item=state.sites.find(x=>x.id===siteId);
  if(item)Object.assign(item,changed.site);
  state.editSiteId='';state.siteNotice='Sitio actualizado en tu empresa.';
 }catch(e){state.siteError=e.message||'No se pudo guardar el sitio.';}
 finally{state.siteBusy=false;render();}
}
  document.addEventListener('click', async e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    const action=b.dataset.act;
    if(action==='theme'){state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('ed-theme-v3',state.theme);render();}
    else if(action==='set-pref'){
      const key=b.dataset.key,value=b.dataset.value;
      if(key==='theme'&&['light','dark','black'].includes(value)){state.theme=value;localStorage.setItem('ed-theme-v3',value);}
      else if(key==='accent'&&['purple','blue','teal','coral','amber','rose','graphite'].includes(value)){state.accent=value;localStorage.setItem('ed-accent-v7',value);}
      else if(key==='sidebar'&&['auto','white','blue','navy','graphite','black'].includes(value)){state.sidebarTone=value;localStorage.setItem('ed-sidebar-v7',value);}
      render();
    }
    else if(action==='collapse-sidebar'){state.sidebarCollapsed=!state.sidebarCollapsed;localStorage.setItem('ed-sidebar-collapsed',state.sidebarCollapsed?'1':'0');render();}
    else if(action==='menu'){state.mobileOpen=!state.mobileOpen;render();}
    else if(action==='campaign-menu'){state.campaignsMenuOpen=!state.campaignsMenuOpen;render();}
    else if(action==='campaign-select'){const platform=b.dataset.platform;if(!['meta','google','tiktok','linkedin'].includes(platform))return;state.adsPlatform=platform;state.page='campaigns';state.mobileOpen=false;state.campaignConnectionOpen=false;render();window.scrollTo(0,0);await loadMeta();if(platform==='meta')await loadAds();}
    else if(action==='analytic-select'&&!isAdmin()){const allowed=['totalUsers','sessions','screenPageViews','keyEvents','activeUsers','newUsers','engagedSessions','engagementRate','bounceRate','eventCount','averageSessionDuration','sessionKeyEventRate'];if(allowed.includes(b.dataset.metric)){if(state.page==='overview')state.overviewMetric=b.dataset.metric;else state.analyticMetric=b.dataset.metric;render();}}
    else if(action==='page-detail'){state.page='content';state.search=b.dataset.path||'';state.tableSort='';state.mobileOpen=false;render();window.scrollTo(0,0);}
    else if(action==='nav'){state.page=b.dataset.page;state.campaignConnectionOpen=false;state.temporaryAccess=null;state.mobileOpen=false;state.search='';state.tableSort='';render();window.scrollTo(0,0);if(state.page==='integrations'&&!isAdmin())await loadMeta();if(state.page==='adminIntegrations'&&isAdmin()){await loadAdminHealth();await loadAdminEntitlements(state.adminFeatureBusiness||state.businesses[0]?.id||'');}if(state.page==='accounts'&&isAdmin())await loadAccounts();if(state.page==='campaigns'&&!isAdmin()){await loadMeta();await loadAds();}}
    else if(action==='refresh')await (isAdmin()?loadAdminStats():refresh());
    else if(action==='admin-check'&&isAdmin())await loadAdminStats();
    else if(action==='admin-health-refresh'&&isAdmin())await loadAdminHealth();
    else if(action==='copy-meta-redirect'&&isAdmin()){
      const callback=location.origin+'/api/meta/callback';
      try{await navigator.clipboard.writeText(callback);state.adminSetupNotice='URL copiada. Agrégala en Cloudflare y en Meta for Developers.';}
      catch{state.adminSetupNotice='Copia manualmente la URL que aparece arriba.';}
      render();
    }
    else if(action==='admin-manage-features'&&isAdmin()){
      state.page='adminIntegrations';render();await loadAdminHealth();await loadAdminEntitlements(b.dataset.id);
    }
    else if(action==='admin-set-premium'&&isAdmin()){
      await saveAdminFeature('',null,'premium');
    }
    else if(action==='admin-set-free'&&isAdmin()){
      await saveAdminFeature('',null,'free');
    }
    else if(action==='account-email-history'&&isAdmin()){
      const userId=b.dataset.id||'';
      state.emailHistoryUserId=userId;state.emailHistoryData=[];state.emailHistoryError='';state.emailHistoryLoading=true;render();
      try{const result=await api('/api/admin/accounts/email-history?user_id='+encodeURIComponent(userId));if(state.emailHistoryUserId===userId){state.emailHistoryData=result.changes||[];if(!result.configured)state.emailHistoryError=result.reason||'Auditoría no configurada.';}}
      catch(e){if(state.emailHistoryUserId===userId)state.emailHistoryError=e.message;}
      finally{if(state.emailHistoryUserId===userId){state.emailHistoryLoading=false;render();}}
    }
    else if(action==='account-email-hide'){state.emailHistoryUserId='';state.emailHistoryData=[];render();}
    else if(action==='accounts-refresh'&&isAdmin()){state.temporaryAccess=null;await loadAccounts();}
    else if(action==='account-copy-temp'&&isAdmin()&&state.temporaryAccess){
      try{await navigator.clipboard.writeText(state.temporaryAccess.password);state.accountNotice='Clave copiada al portapapeles. Compártela por un canal privado.';}
      catch{state.accountNotice='Selecciona y copia la clave de forma manual.';}render();
    }
    else if(action==='account-temp'&&isAdmin()){
      const email=b.dataset.email||'',id=b.dataset.id||'';
      if(!confirm('¿Generar una contraseña temporal nueva para '+email+'? La contraseña anterior dejará de funcionar.'))return;
      state.temporaryAccess=null;state.accountNotice='';state.accountsError='';
      try{const out=await api('/api/admin/accounts/temporary-password',{method:'POST',body:JSON.stringify({user_id:id})});state.temporaryAccess={email:out.email,password:out.temporary_password};state.accountNotice=out.message||'Clave temporal creada.';}
      catch(e){state.accountsError=e.message;}render();
    }
    else if(action==='meta-connect'){
      if(state.meta?.configured && metaPilotEligible()){
        const fromCampaigns=b.dataset.return==='campaigns'||state.page==='campaigns';
        const base='/api/meta/connect?business_id='+encodeURIComponent(state.businessId)+(fromCampaigns?'&return_to=campaigns':'');
        const popup=window.open(base+'&popup=1','edigital_meta_oauth','popup=yes,width=580,height=720,resizable=yes,scrollbars=yes');
        if(popup){state.metaPopup=popup;state.campaignConnectionOpen=fromCampaigns||state.campaignConnectionOpen;state.metaError='';render();popup.focus();}
        else window.location.assign(base);
      }else{
        state.metaError='Esta integración aún no está habilitada para la empresa.';
        render();
      }
    }
    else if(action==='edit-site'){state.editSiteId=b.dataset.id;state.siteError='';state.siteNotice='';render();}
    else if(action==='edit-site-cancel'){state.editSiteId='';state.siteError='';render();}
    else if(action==='company-logo-clear'){state.companyLogoClear=true;state.companyLogoDraft=null;state.companyNotice='';render();}
    else if(action==='meta-panel-toggle'){state.metaPanelOpen=!state.metaPanelOpen;render();}
    else if(action==='campaign-connect-toggle'){
      state.campaignConnectionOpen=!state.campaignConnectionOpen;
      state.campaignAccountNotice='';state.metaError='';
      state.campaignWizardStage='accounts';state.campaignWizardSelectedIds=null;
      render();
    }
    else if(action==='campaign-meta-back'){
      state.campaignWizardStage='accounts';state.metaError='';render();
    }
    else if(action==='campaign-meta-next'){
      const ids=[...document.querySelectorAll('.campaign-meta-account-check:checked')].map(x=>x.value);
      if(!ids.length||ids.length>5){state.metaError='Selecciona entre una y cinco cuentas publicitarias.';render();return;}
      state.campaignWizardSelectedIds=ids;state.campaignWizardStage='confirm';state.metaError='';render();
    }
    else if(action==='campaign-meta-save'){
      if(state.campaignAccountSaving||!state.meta?.connected)return;
      const ids=Array.isArray(state.campaignWizardSelectedIds)?state.campaignWizardSelectedIds:[];
      const authorized=(state.meta?.accounts||[]).map(a=>a.id);
      if(!ids.length||ids.length>5||ids.some(id=>!authorized.includes(id))){state.metaError='Selecciona entre una y cinco cuentas autorizadas.';state.campaignWizardStage='accounts';render();return;}
      const current=state.businessId;
      state.campaignAccountSaving=true;state.metaError='';state.campaignAccountNotice='';render();
      try{
        await api('/api/meta/select',{method:'POST',body:JSON.stringify({business_id:current,account_ids:ids})});
        if(state.businessId!==current)return;
        state.metaCampaigns=null;
        state.campaignAccountNotice='Cuentas guardadas. Estamos consultando tus campañas.';
        await loadMeta();await loadAds();
        state.campaignConnectionOpen=false;state.campaignWizardSelectedIds=null;state.campaignWizardStage='accounts';render();
      }catch(error){if(state.businessId===current){state.metaError=error.message;state.campaignConnectionOpen=true;state.campaignWizardStage='confirm';render();}}
      finally{state.campaignAccountSaving=false;if(state.businessId===current)render();}
    }
    else if(action==='meta-refresh')await loadMeta();
    else if(action==='ads-best'){state.adsBestOnly=!state.adsBestOnly;state.adsLevel='campaign';if(!state.metaCampaigns||state.metaCampaigns.level!=='campaign'){state.metaCampaigns=null;render();await loadAds();}else render();}
    else if(action==='ads-refresh'){await loadMeta();await loadAds();}
    else if(action==='ads-apply-dates'){
      const start=document.getElementById('ads-start-date')?.value||'';
      const end=document.getElementById('ads-end-date')?.value||'';
      const from=Date.parse(start+'T00:00:00Z'),until=Date.parse(end+'T00:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||
         !Number.isFinite(from)||!Number.isFinite(until)||from>until||until>Date.now()+86400000||
         until-from>365*86400000){
        state.adsFilterError='Selecciona fechas válidas: desde la primera hasta la última, con máximo de un año.';
        render();return;
      }
      state.adsFilterError='';state.adsCustomStart=start;state.adsCustomEnd=end;state.metaCampaigns=null;
      await loadMeta();await loadAds();
    }
    else if(action==='ads-platform'){state.adsPlatform=b.dataset.platform;state.metaCampaigns=null;state.adsError='';render();if(state.page==='campaigns')await loadAds();}
    else if(action==='meta-disconnect'){
      if(!confirm('¿Desconectar Meta Ads de este navegador? Se dejarán de mostrar sus anuncios y métricas en eDigital. Tus campañas en Meta no se borrarán.'))return;
      const current=state.businessId;
      try{
        await api('/api/meta/disconnect',{method:'POST',body:'{}'});
        if(state.businessId!==current)return;
        state.metaPanelOpen=false;
        state.campaignConnectionOpen=false;
        state.campaignWizardSelectedIds=[];
        state.metaCampaigns=null;
        state.adsError='';
        state.campaignAccountNotice='';
        await loadMeta();
      }catch(e){if(state.businessId===current){state.metaError=e.message;render();}}
    }
    else if(action==='choose'){state.page='overview';await chooseBusiness(b.dataset.id);}
    else if(action==='client-detail'){if(isAdmin()){state.page='clientDetail';await chooseBusiness(b.dataset.id);window.scrollTo(0,0);}}
    else if(action==='client-site'){if(isAdmin()&&state.sites.some(s=>s.id===b.dataset.id)){state.siteId=b.dataset.id;state.page='analytics';await refresh();window.scrollTo(0,0);}}
    else if(action==='csv')doCsv();
    else if(action==='download')doCsv(b.dataset.report);
    else if(action==='sort'){state.tableDesc=state.tableSort===b.dataset.key?!state.tableDesc:true;state.tableSort=b.dataset.key;render();}
    else if(action==='show-password'){const input=document.getElementById('password');if(input)input.type=input.type==='password'?'text':'password';}
    else if(action==='logout'){
      ++state.requestId;await api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});
      Object.assign(state,{user:null,temporaryAccess:null,businesses:[],sites:[],businessId:'',siteId:'',ga:null,hm:null,gaError:'',hmError:'',meta:null,metaReport:null,metaError:'',page:'overview',mobileOpen:false,search:''});render();
    }
  });
  window.addEventListener('message',async event=>{
    const data=event.data;
    if(event.origin!==location.origin||!state.metaPopup||event.source!==state.metaPopup||
      data?.type!=='edigital:meta-oauth'||data.business_id!==state.businessId)return;
    state.metaPopup=null;
    state.campaignConnectionOpen=true;
    if(data.status==='cancelled'){state.metaError='Se canceló el acceso a Facebook.';render();return;}
    await loadMeta();
    if(state.page==='campaigns')await loadAds();
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'&&state.campaignConnectionOpen){state.campaignConnectionOpen=false;render();return;}
    if((e.key==='Enter'||e.key===' ') && e.target.matches?.('.client-card-clickable')){
      e.preventDefault(); e.target.click();
    }
  });
  document.addEventListener('change', async e=>{
    if(e.target.id==='company-logo-file'){
      const file=e.target.files?.[0];if(!file)return;
      try{
        state.companyLogoDraft=await readCompanyLogo(file);
        state.companyLogoClear=false;
        const node=document.querySelector('.company-photo-core');
        if(node&&state.companyLogoDraft)node.innerHTML='<img class="company-logo-image" alt="Vista previa del logotipo" src="'+clean(state.companyLogoDraft)+'"/>';
        const note=document.querySelector('.company-logo-instruction small');
        if(note)note.textContent='Vista previa lista. Pulsa Guardar cambios para conservarla en este navegador.';
      }catch(error){state.companyLogoDraft=null;state.companyError=error.message;render();}
      return;
    }
    if(e.target.id==='admin-feature-business'&&isAdmin()){await loadAdminEntitlements(e.target.value);return;}
    if(e.target.classList?.contains('admin-feature-toggle')&&isAdmin()){
      const requested=e.target.checked;
      await saveAdminFeature(e.target.dataset.feature,requested,null);
      return;
    }
    if(e.target.id==='campaign-meta-select-all'){
      const visible=[...document.querySelectorAll('.connector-account-row')].filter(row=>row.style.display!=='none');
      const target=e.target.checked;
      const checked=[...document.querySelectorAll('.campaign-meta-account-check:checked')].map(x=>x.value);
      if(target){let remaining=5-checked.length;for(const row of visible){const input=row.querySelector('.campaign-meta-account-check');if(input&&!input.checked&&remaining>0){input.checked=true;remaining--;}}}
      else for(const row of visible){const input=row.querySelector('.campaign-meta-account-check');if(input)input.checked=false;}
      state.campaignWizardSelectedIds=[...document.querySelectorAll('.campaign-meta-account-check:checked')].map(x=>x.value);
      const label=document.getElementById('connector-account-total');if(label)label.textContent=state.campaignWizardSelectedIds.length+' seleccionada(s)';
      return;
    }
    if(e.target.classList?.contains('campaign-meta-account-check')){
      const checked=[...document.querySelectorAll('.campaign-meta-account-check:checked')];
      if(checked.length>5){e.target.checked=false;state.metaError='Puedes seleccionar un máximo de cinco cuentas.';const msg=document.querySelector('.connector-content .alert-block');if(msg)msg.textContent=state.metaError;}
      state.campaignWizardSelectedIds=[...document.querySelectorAll('.campaign-meta-account-check:checked')].map(x=>x.value);
      const count=document.getElementById('connector-account-total');if(count)count.textContent=state.campaignWizardSelectedIds.length+' seleccionada(s)';
      return;
    }
    if(e.target.id==='integration-only-connected'){filterIntegrations();return;}
    if(e.target.id==='business-selector')await chooseBusiness(e.target.value);
    else if(e.target.id==='site-selector'){state.siteId=e.target.value;await refresh();}
    else if(e.target.classList?.contains('meta-account-check')){
      const ids=[...document.querySelectorAll('.meta-account-check:checked')].map(n=>n.value);
      if(ids.length>5){e.target.checked=false;state.metaError='Selecciona un máximo de cinco cuentas.';return;}
      try{await api('/api/meta/select',{method:'POST',body:JSON.stringify({business_id:state.businessId,account_ids:ids})});state.metaCampaigns=null;await loadMeta();}
      catch(error){state.metaError=error.message;render();}
    }
    else if(e.target.id==='ads-platform'){state.adsPlatform=e.target.value;state.metaCampaigns=null;state.adsError='';render();if(state.page==='campaigns')await loadAds();}
    else if(e.target.id==='ads-level'){state.adsLevel=e.target.value;state.metaCampaigns=null;state.adsError='';render();if(state.page==='campaigns')await loadAds();}
    else if(e.target.id==='ads-period'){
      state.adsPeriod=e.target.value;state.adsFilterError='';state.metaCampaigns=null;
      render();
      if(state.page==='campaigns'&&state.adsPeriod!=='custom'){await loadMeta();await loadAds();}
    }
    else if(e.target.id==='ads-account'){state.adsAccount=e.target.value;render();}
    else if(e.target.id==='ads-status'){state.adsStatus=e.target.value;render();}
    else if(e.target.id==='ads-objective'){state.adsObjective=e.target.value;render();}
    else if(e.target.id==='date-period'){state.period=e.target.value;if(state.page==='campaigns'){state.adsPeriod=e.target.value;state.adsFilterError='';}await refresh();if(state.page==='integrations'||state.page==='campaigns')await loadMeta();if(state.page==='campaigns')await loadAds();}
  });

  function filterIntegrations(){
    const text=(document.getElementById('integration-search')?.value||'').trim().toLowerCase();
    const only=!!document.getElementById('integration-only-connected')?.checked;
    document.querySelectorAll('.provider-card').forEach(card=>{
      card.hidden=!!(text&&!card.textContent.toLowerCase().includes(text)) || (only&&card.dataset.connected!=='true');
    });
  }

  document.addEventListener('input',e=>{
    if(e.target.id==='admin-client-search'){
      const q=e.target.value, start=e.target.selectionStart, end=e.target.selectionEnd;
      state.adminQuery=q;render();const input=document.getElementById('admin-client-search');if(input){input.focus();if(start!==null&&end!==null)input.setSelectionRange(start,end);}return;
    }
    if(e.target.id==='integration-search'){filterIntegrations();return;}
    if(e.target.id==='ads-search'){
      state.adsSearch=e.target.value;
      const start=e.target.selectionStart,end=e.target.selectionEnd;
      render();const input=document.getElementById('ads-search');
      if(input){input.focus();try{input.setSelectionRange(start,end)}catch{}}
      return;
    }
    if(e.target.id==='campaign-provider-search'){
      const q=e.target.value.trim().toLocaleLowerCase('es');
      document.querySelectorAll('.connector-provider[data-provider-name]').forEach(item=>{item.style.display=item.dataset.providerName.includes(q)?'':'none';});
      return;
    }
    if(e.target.id==='campaign-meta-search'){
      const q=e.target.value.trim().toLocaleLowerCase('es');
      document.querySelectorAll('.connector-account-row').forEach(row=>{row.style.display=(row.dataset.accountSearch||'').includes(q)?'':'none';});
      const selectAll=document.getElementById('campaign-meta-select-all');if(selectAll)selectAll.checked=false;
      return;
    }
    if(e.target.id==='meta-account-search'){
      const q=e.target.value.trim().toLowerCase();
      document.querySelectorAll('.meta-account-row').forEach(row=>{row.style.display=row.textContent.toLowerCase().includes(q)?'':'none';});
      return;
    }
    if(e.target.id!=='global-search')return;
    const q=e.target.value,selStart=e.target.selectionStart,selEnd=e.target.selectionEnd;
    state.search=q;render();const input=document.getElementById('global-search');if(input){input.focus();input.setSelectionRange(selStart,selEnd);}
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id==='company-profile-form'){e.preventDefault();await saveCompany(e.target);return;}
    if(e.target.id==='site-edit-form'){e.preventDefault();await saveSite(e.target);return;}
    if(e.target.id==='change-password-form'){
      e.preventDefault(); if(!state.user || state.passwordBusy)return;
      const form=new FormData(e.target),currentPassword=String(form.get('currentPassword')||''),newPassword=String(form.get('newPassword')||''),confirmPassword=String(form.get('confirmPassword')||'');
      if(newPassword!==confirmPassword){state.passwordError='La confirmación no coincide con la contraseña nueva.';render();return;}
      if(newPassword.length<10||newPassword.length>128){state.passwordError='La contraseña nueva debe tener entre 10 y 128 caracteres.';render();return;}
      if(currentPassword===newPassword){state.passwordError='Elige una contraseña diferente de la actual.';render();return;}
      state.passwordBusy=true;state.passwordError='';
      const submit=e.target.querySelector('[type="submit"]');if(submit)submit.disabled=true;
      try{
        await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});
        ++state.requestId;Object.assign(state,{user:null,businesses:[],sites:[],businessId:'',siteId:'',ga:null,hm:null,gaError:'',hmError:'',page:'overview',mobileOpen:false,search:'',passwordBusy:false,passwordError:'',loginNotice:'Contraseña actualizada. Ingresa nuevamente con tu contraseña nueva.'});render();
      }catch(err){state.passwordBusy=false;state.passwordError=err.message;render();}
      return;
    }
    if(e.target.id!=='login-form')return;e.preventDefault();
    const form=new FormData(e.target);const email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
    state.loginBusy=true;state.loginError='';render();
    try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});await init();}
    catch(err){state.loginBusy=false;state.loginError=err.message;render();}
  });
  init();
})();
