/* E Digital — nombre provisional del CRM | los datos mostrados proceden de APIs autorizadas. */
(() => {
  'use strict';
  const root = document.getElementById('app');
  const state = {
    user: null, businesses: [], sites: [], businessId: '', siteId: '',
    page: 'overview', period: '30', theme: localStorage.getItem('ed-theme-v3') || 'light',
    loading: true, gaLoading: false, hmLoading: false, ga: null, hm: null,
    gaError: '', hmError: '', startupError: '', loginError: '', loginBusy: false,
    mobileOpen: false, sidebarCollapsed: localStorage.getItem('ed-sidebar-collapsed') === '1', adminQuery: '', search: '', requestId: 0, tableSort: '', tableDesc: true,
    passwordBusy: false, passwordError: '', loginNotice: '',
    meta: null, metaReport: null, metaLoading: false, metaError: '',
    metaCampaigns: null, adsLoading: false, adsError: '', adsPlatform: 'meta', adsLevel: 'campaign',
    companyBusy: false, companyError: '', companyNotice: '', siteBusy: false, siteError: '', siteNotice: '', editSiteId: '',
    emailBusy: false, emailError: '', emailNotice: '',
    accent: localStorage.getItem('ed-accent-v7')||'purple', sidebarTone: localStorage.getItem('ed-sidebar-v7')||'auto',
    adminHealth: null, adminHealthError: '',
    adminAccounts: [], accountsLoaded: false, accountsLoading: false, accountsError: '', accountNotice: '', temporaryAccess: null,
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
      metaConnected:!!state.meta?.connected, meta
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
    adminIntegrations: ['Integraciones SaaS', 'plug'],
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
    megaphone:'<path d="M3 11v3a2 2 0 0 0 2 2h3l3 4h3l-3-5 9-5V5l-9 5H5a2 2 0 0 0-2 1z"/><path d="M20 9a3 3 0 0 1 0 6"/>',
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
  const brand = large => `<div class="brand ${large ? 'brand-large' : ''}" aria-label="eDigital"><div class="brand-word">eDigital</div></div>`;

  async function api(path, options={}) {
    const res = await fetch(path, { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, ...options });
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
    if (state.gaLoading) return `<div class="loading-state"><span class="spinner"></span>Consultando la propiedad de Google Analytics 4…</div>`;
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
    return `<article class="kpi"><div class="kpi-header"><div class="kpi-icon ${color}">${icon(iconName,20)}</div><span class="kpi-dots">···</span></div><div class="kpi-name">${clean(label)}${note?tip(note):''}</div><div class="kpi-value">${value}</div><div class="kpi-bottom"><div class="kpi-change">${trendFor(trendKey)}</div>${miniSpark(sparkKey,color==='purple'?'#8453f5':color==='cyan'?'#00b8e6':color==='coral'?'#f56b7f':'#40bb9d')}</div></article>`;
  }
  function mainKpis() {
    const ok=gaReady(), v=m();
    return `<div class="kpi-grid">${kpi('Usuarios totales',ok?fmt(v.totalUsers):'—','users','purple','totalUsers','totalUsers')}${kpi('Sesiones',ok?fmt(v.sessions):'—','activity','cyan','sessions','sessions')}${kpi('Vistas de páginas',ok?fmt(v.screenPageViews):'—','eye','coral','screenPageViews','screenPageViews')}${kpi('Eventos clave',ok?fmt(v.keyEvents):'—','target','mint','keyEvents','keyEvents','Eventos que tu propiedad GA4 haya marcado como clave.')}</div>`;
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
    const spots=list.length<=50 ? list.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r[k1])}" r="5" class="chart-spot"><title>${clean(dateLabel(r.date))} · ${clean(label1)}: ${fmt(r[k1])}</title></circle>${k2?`<circle cx="${x(i)}" cy="${y(r[k2])}" r="5" class="chart-spot"><title>${clean(dateLabel(r.date))} · ${clean(label2)}: ${fmt(r[k2])}</title></circle>`:''}`).join(''):'';
    const gradId=`grad-${clean(k1)}-${height}`;
    return `<div class="chart-legend"><span><i class="legend-chip purple"></i>${clean(label1)}</span>${k2?`<span><i class="legend-chip cyan"></i>${clean(label2)}</span>`:''}</div><div class="chart-holder"><svg viewBox="0 0 ${W} ${H}" class="plot" role="img" aria-label="Evolución real de ${clean(label1)}"><defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8354f4" stop-opacity=".23"/><stop offset="1" stop-color="#8354f4" stop-opacity="0"/></linearGradient></defs>${stripes}<polygon points="${area}" fill="url(#${gradId})"/>${list.length>1?`<polyline points="${coords(k1)}" class="plot-line-a"/>`:''}${k2&&list.length>1?`<polyline points="${coords(k2)}" class="plot-line-b"/>`: ''}${spots}${xticks}</svg></div>`;
  }
  function filterList(data) { const q=state.search.trim().toLowerCase(); return q?data.filter(x=>Object.values(x).some(v=>String(v).toLowerCase().includes(q))):data; }
  function barList(data,labelKey,valueKey,maxRows=7,formatter=fmt) {
    const list=filterList(data||[]).slice(0,maxRows);
    if (!list.length) return empty(state.search?'No hay resultados para tu búsqueda.':'Sin información para este período.');
    const top=Math.max(1,...list.map(r=>number(r[valueKey])));
    return `<div class="bar-list">${list.map((r,i)=>`<div class="bar-item"><div class="bar-row"><span title="${clean(r[labelKey])}"><b class="bar-index">${String(i+1).padStart(2,'0')}</b>${clean(r[labelKey]||'(sin identificar)')}</span><strong>${clean(formatter(r[valueKey]))}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,number(r[valueKey])/top*100)).toFixed(2)}%"></div></div></div>`).join('')}</div>`;
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
    const total=list.reduce((a,r)=>a+number(r[valueKey]),0),palette=['#8051f7','#00c8e9','#fd708a','#3bc5a9','#f6bd66'];
    let soFar=0;
    const parts=list.map((r,i)=>{const percent=number(r[valueKey])/total*100,start=soFar;soFar+=percent;return `${palette[i]} ${start.toFixed(3)}% ${soFar.toFixed(3)}%`;});
    return `<div class="donut-layout"><div class="donut-chart" style="background:conic-gradient(${parts.join(',')})"><div class="donut-center"><span>Sesiones</span><strong>${fmt(total)}</strong><small>Top 5 canales</small></div></div><div class="donut-legend">${list.map((r,i)=>`<div><span class="donut-name"><i style="background:${palette[i]}"></i>${clean(r[labelKey]||'(sin canal)')}</span><b>${fmt1(number(r[valueKey])/total*100)}%</b></div>`).join('')}</div></div>`;
  }
  function flags() {
    const warnings=state.ga?.warnings||[];
    const items=[];
    if(!gaReady())items.push(state.gaError || 'Los datos GA4 no están disponibles para este sitio.');
    if(warnings.length)items.push(`${warnings.length} secciones de GA4 no devolvieron información. Revisa los permisos y las métricas de la propiedad.`);
    return items.map(x=>alertBlock(x)).join('');
  }
  function readableTime() { return state.ga?.updated_at?new Date(state.ga.updated_at).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'Pendiente de conexión'; }
  function statusStrip() {return `<div class="status-strip"><div class="status-left">${tag(gaReady()?'Google Analytics conectado':state.gaLoading?'Consultando GA4':'GA4 pendiente',gaReady()?'success':'neutral')}<span class="strip-divider"></span><span>${icon('clock',15)} Última consulta: ${clean(readableTime())}</span></div><span class="strip-right">${clean(site()?.name||business()?.name||'Elige un negocio')}</span></div>${state.period==='today'?`<div class="period-disclaimer">${icon('info',15)} Estás viendo el día de hoy (según la zona horaria de GA4). Estas cifras pueden estar incompletas porque Analytics no es un informe en tiempo real.</div>`:''}`;}
  function insights() {
    if(!gaReady())return dataPlaceholder();
    const user=m(), ch=rows('channels'), pagesArr=rows('pages'), top=ch[0], page=pagesArr[0];
    const lines=[];
    if(top)lines.push({symbol:'mouse-pointer',title:'Canal principal',desc:`${top.sessionDefaultChannelGroup||'Sin identificar'} genera ${fmt(top.sessions)} sesiones en el período.`});
    if(page)lines.push({symbol:'file-text',title:'Página más vista',desc:`${page.pagePath||'/'} acumuló ${fmt(page.screenPageViews)} visualizaciones.`});
    lines.push({symbol:'target',title:'Eventos clave',desc:`Se registraron ${fmt(user.keyEvents)} eventos clave. Verifica que las acciones de negocio estén marcadas correctamente en GA4.`});
    return `<div class="insight-list">${lines.map(x=>`<div class="insight-item"><div class="insight-icon">${icon(x.symbol,18)}</div><div><strong>${clean(x.title)}</strong><p>${clean(x.desc)}</p></div></div>`).join('')}</div><p class="fine-print">Observaciones descriptivas, no recomendaciones ni ventas atribuidas automáticamente.</p>`;
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
    function overview() {
    const ok=gaReady();
    return `${heading('Vista general','Todo tu negocio, en una sola vista','Visualiza el rendimiento del sitio y las conversiones registradas, con datos reales.')}${statusStrip()}${mainKpis()}<div class="content-grid"><div class="col-8">${card('Rendimiento del sitio',`Usuarios y sesiones · ${periodLabel()}`,ok?chart(rows('trend'),'sessions','Sesiones','totalUsers','Usuarios'):dataPlaceholder())}</div><div class="col-4">${card('¿De dónde viene tu tráfico?','Distribución por canal de adquisición',ok?donut(rows('channels'),'sessionDefaultChannelGroup','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Páginas más visitadas','Contenido que concentra la atención',ok?barList(rows('pages'),'pagePath','screenPageViews',6):dataPlaceholder(),`<button class="text-action" data-act="nav" data-page="content">Ver contenido ${icon('chevron',14)}</button>`)}</div><div class="col-5">${card('Lectura rápida de tus datos','Hallazgos generados con la información disponible',insights())}</div></div>${selectedBusinessIsHotmart()?hotmartRibbon():''}<div class="spacer-lg"></div>${card('Mis integraciones','Las fuentes conectadas alimentan sus reportes en tu empresa',connectionOverview())}${connectedAdsOverview()}${flags()}`;
  }
  function heading(kicker,title,subtitle){const downloadable=['overview','analytics','acquisition','utm','audience','content','events','reports'].includes(state.page);return `<div class="page-title"><div><div class="eyebrow">${clean(kicker)}</div><h1>${clean(title)}</h1><p>${clean(subtitle)}</p></div>${downloadable?`<button class="button button-outline title-export" data-act="csv">${icon('download',17)} Exportar CSV</button>`:''}</div>`;}
  function detailKpis() {
    const v=m(), ok=gaReady();
    return `<div class="small-kpis">${[['Usuarios activos','activeUsers',fmt],['Usuarios nuevos','newUsers',fmt],['Sesiones con interacción','engagedSessions',fmt],['Tasa de interacción','engagementRate',pc],['Rebote','bounceRate',pc],['Eventos totales','eventCount',fmt],['Tiempo medio de sesión','averageSessionDuration',duration],['Tasa de sesión con evento clave','sessionKeyEventRate',pc]].map(x=>`<div class="small-kpi"><span>${x[0]}</span><strong>${ok?x[2](v[x[1]]):'—'}</strong>${trendFor(x[1],x[2]===pc)}</div>`).join('')}</div>`;
  }
  function analytics(){return `${heading('Analítica web','Así está rindiendo tu web','Visitas, interacción, permanencia y evolución histórica de GA4.')}${statusStrip()}${mainKpis()}${detailKpis()}<div class="content-grid"><div class="col-12">${card('Tráfico y visualizaciones','Compara el comportamiento del sitio a lo largo del período',gaReady()?chart(rows('trend'),'screenPageViews','Vistas de página','sessions','Sesiones',310):dataPlaceholder())}</div><div class="col-6">${card('Sesiones por dispositivo','Tráfico desde computadora, celular y tablet',gaReady()?donut(rows('devices'),'deviceCategory','sessions'):dataPlaceholder())}</div><div class="col-6">${card('Navegadores de tus usuarios','Distribución por tecnología',gaReady()?barList(rows('browsers'),'browser','totalUsers'):dataPlaceholder())}</div></div>${flags()}`;}
  function acquisition(){return `${heading('Adquisición','Descubre cómo te encuentran','Analiza canales, fuentes y medios de tráfico, sin confundir visitas con conversiones de anuncios.')}${statusStrip()}<div class="content-grid"><div class="col-5">${card('Mezcla de canales','Sesiones por categoría de adquisición',gaReady()?donut(rows('channels'),'sessionDefaultChannelGroup','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Principales fuentes y medios','Sesiones atribuidas en GA4',gaReady()?barList(rows('sources'),'sessionSourceMedium','sessions',10):dataPlaceholder())}</div><div class="col-12">${card('Detalle de canales','Usuarios, sesiones y eventos clave por canal',gaReady()?dataTable(rows('channels'),[{key:'sessionDefaultChannelGroup',label:'Canal'},{key:'sessions',label:'Sesiones',display:fmt},{key:'totalUsers',label:'Usuarios',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function campaigns(){
 const connected=state.meta?.connected&&(state.meta?.selected_accounts?.length||state.meta?.selected_account);
 const platform=state.adsPlatform,level=state.adsLevel,report=state.metaCampaigns;
 const choices=[['meta','Meta Ads'],['google','Google Ads'],['tiktok','TikTok Ads'],['linkedin','LinkedIn Ads']];
 const controls=`<div class="ads-platform-tabs" role="group" aria-label="Plataforma publicitaria">${choices.map(([value,label])=>`<button type="button" class="ads-platform-tab ${platform===value?'active':''}" data-act="ads-platform" data-platform="${value}" aria-pressed="${platform===value}" >${label}</button>`).join('')}</div><div class="ads-toolbar"><label class="form-label">Detalle<select id="ads-level" class="meta-select">${[['campaign','Campañas'],['adset','Conjuntos'],['ad','Anuncios']].map(([value,label])=>`<option value="${value}" ${level===value?'selected':''}>${label}</option>`).join('')}</select></label><button class="button button-outline" data-act="ads-refresh">${icon('refresh',16)} Actualizar</button></div>`;
 let result='';
 if(platform!=='meta')result=empty('Esta plataforma aún necesita autorización de la API oficial.','Integración pendiente');
 else if(!connected)result=`<div class="empty-compact">${empty('Conecta tu cuenta de Facebook desde Integraciones y selecciona una cuenta publicitaria.','Cuenta pendiente')}<button class="button button-primary" data-act="nav" data-page="integrations">Gestionar integración de Meta Ads</button></div>`;
 else if(state.adsLoading)result='<div class="loading-state"><span class="spinner"></span>Consultando campañas…</div>';
 else if(state.adsError)result=alertBlock(state.adsError);
 else if(!report)result=empty('Pulsa Actualizar para cargar las campañas autorizadas.','Sin datos');
 else{
  const c=report.currency||'',fmtCost=(n,row)=>n==null?'—':money(n,row?.currency||c);
  const columns=[{key:'account_name',label:'Cuenta'},{key:'name',label:'Nombre'},{key:'spend',label:'Inversión',display:fmtCost},{key:'impressions',label:'Impresiones',display:v=>v==null?'—':fmt(v)},{key:'clicks',label:'Clics',display:v=>v==null?'—':fmt(v)},{key:'ctr',label:'CTR',display:v=>v==null?'—':fmt1(v)+'%'},{key:'cpc',label:'CPC',display:fmtCost}];
  result=`${report.partial?alertBlock('La consulta contiene resultados parciales; hay más filas por recuperar.','info'):''}${report.rows?.length?dataTable(report.rows,columns,100):empty('No hay resultados registrados para este período.','Sin resultados')}`;
 }
 const m=state.metaReport?.metrics,curr=state.metaReport?.currency||'';
 const kpis=platform==='meta'&&connected&&m?`<div class="small-kpis"><div class="small-kpi"><span>Inversión ${clean(curr)}</span><strong>${metaMetric(m.spend,2)}</strong></div><div class="small-kpi"><span>Clics</span><strong>${metaMetric(m.clicks)}</strong></div><div class="small-kpi"><span>Impresiones</span><strong>${metaMetric(m.impressions)}</strong></div><div class="small-kpi"><span>CTR</span><strong>${metaMetric(m.ctr,2)}%</strong></div><div class="small-kpi"><span>CPC</span><strong>${metaMetric(m.cpc,2)}</strong></div></div>`:'';
 return `${heading('Publicidad','Campañas Ads','Campañas, conjuntos y anuncios de tus plataformas autorizadas; sin mezclar las cifras de GA4.')}${controls}${kpis}${card('Rendimiento de la cuenta',periodLabel(),result)}
 <div class="spacer-sm"></div>${card('Atribución UTM de Analytics','Es información diferente del costo publicitario',`<p class="fine-print">Los clics, sesiones y eventos de GA4 no equivalen necesariamente a ventas pagadas.</p><button class="button button-outline" data-act="nav" data-page="utm">Ver tráfico UTM</button>`)}`;
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
  function events(){return `${heading('Eventos y objetivos','¿Qué acciones realizan?','Actividad, eventos clave y tasas de conversión registradas en Analytics.')}${statusStrip()}${detailKpis()}<div class="content-grid"><div class="col-8">${card('Evolución de eventos clave','Tendencia temporal de los eventos marcados como clave',gaReady()?chart(rows('trend'),'keyEvents','Eventos clave', '', '',280):dataPlaceholder())}</div><div class="col-4">${card('Tipos de eventos','Cantidad de eventos registrados',gaReady()?barList(rows('events').map(r=>({...r,eventNameLabel:friendlyEventName(r.eventName)})),'eventNameLabel','eventCount',10):dataPlaceholder())}</div><div class="col-12">${card('Detalle de eventos','Los eventos clave son los señalados en la propiedad GA4',gaReady()?dataTable(rows('events'),[{key:'eventName',label:'Nombre del evento',display:friendlyEventName},{key:'eventCount',label:'Cantidad',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
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
   <input class="simple-input" name="country" maxlength="80" value="${clean(prefs.country||'Perú')}" placeholder="Perú"/>
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
 const rows=items.map(b=>`<div class="client-site-row"><div class="client-avatar compact">${icon('building',19)}</div><div><strong>${clean(b.name)}</strong><small>${clean(b.slug)} · ${clean(adminStatusFor(b))}</small></div><button class="button button-soft" data-act="client-detail" data-id="${clean(b.id)}">Ver ficha</button></div>`).join('');
 return `${heading('Superadministrador','Centro de administración','Gestiona las empresas autorizadas y revisa las conexiones de la plataforma sin acceder a las credenciales de los clientes.')}
 <div class="small-kpis admin-overview-kpis">
 <div class="small-kpi"><span>Empresas visibles</span><strong>${fmt(items.length)}</strong><small>Según permisos de Supabase</small></div>
 <div class="small-kpi"><span>Sitios visibles</span><strong>${Object.values(state.adminSiteStats).length?fmt(Object.values(state.adminSiteStats).reduce((t,x)=>t+(x.count||0),0)):'—'}</strong><small>Según tus permisos</small></div>
 <div class="small-kpi"><span>Propiedades GA4 visibles</span><strong>${Object.values(state.adminSiteStats).length?fmt(Object.values(state.adminSiteStats).reduce((t,x)=>t+(x.ga4||0),0)):'—'}</strong><small>Con propiedad asignada</small></div>
 <div class="small-kpi"><span>Verificación</span><strong>${fmt(Object.values(state.adminSiteStats).filter(x=>!x.error).length)} / ${fmt(items.length)}</strong><small>Empresas revisadas</small></div></div>
 <div class="content-grid">
 <div class="col-8">${card('Cartera de empresas','Abre una ficha para consultar sus propiedades autorizadas',rows||empty('No hay empresas visibles para esta cuenta.'))}</div>
 <div class="col-4">${card('Gestión rápida','Acciones disponibles para tu rol',`<div class="admin-quick-actions">
 <button class="button button-primary" data-act="nav" data-page="clients">${icon('building',16)} Gestionar empresas</button>
 <button class="button button-outline" data-act="nav" data-page="adminOperations">${icon('activity',16)} Supervisión de clientes</button>
 <button class="button button-outline" data-act="nav" data-page="adminIntegrations">${icon('plug',16)} Catálogo de integraciones</button>
 <button class="button button-outline" data-act="admin-check" ${state.adminStatsLoading?'disabled':''}>${icon('refresh',16)} Comprobar sitios</button>
 <button class="button button-outline" data-act="nav" data-page="settings">${icon('settings',16)} Mi cuenta y seguridad</button></div>`)}</div>
 <div class="col-12">${card('Control de la plataforma','Acceso y estado de las funcionalidades',`<div class="admin-status-grid">
 <div><b>Accesos independientes</b><p>Las fichas se consultan con los permisos de tu cuenta; no se usan las sesiones de tus clientes.</p></div>
 <div><b>Fuentes autorizadas</b><p>GA4 y Meta muestran datos únicamente cuando existe una conexión válida. Los demás proveedores indican que están pendientes.</p></div>
 <div><b>Altas, invitaciones y planes</b><p>La gestión de usuarios, suscripciones y facturación aún requiere procesos administrativos seguros en el servidor.</p></div>
 </div>`)}</div></div>`;
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
 return `${heading('Plataforma','Integraciones SaaS','Revisa el estado técnico sin exponer credenciales ni consultar datos privados de clientes.')}
 ${card('Diagnóstico de Meta Ads','Comprobación del Worker activo: nunca se muestran los valores de secretos',`
 <div class="integration-compact-footer">${tag(metaLabel,m.configured?'success':'neutral')}
 <button type="button" class="button button-outline" data-act="admin-health-refresh">${icon('refresh',16)} Comprobar conexión</button></div>
 ${state.adminHealthError?alertBlock(state.adminHealthError):''}
 ${state.adminHealth&&!m.configured?`<p class="fine-print">Configuración pendiente o no válida: ${clean(failed.join(', '))}. Comprueba estas variables en Cloudflare → Worker → Production → Variables and Secrets. No compartas sus valores.</p>`:''}
 ${m.configured?'<p class="fine-print">La configuración local está completa. Eso no confirma que la app de Meta tenga permisos para todos los clientes externos.</p>':''}
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
    state.accountsLoaded=true;
    state.adminAccounts=Array.isArray(data.accounts)?data.accounts:[];
    state.accountsError=data.configured===false?(data.reason||'Configuración administrativa pendiente.'):'';
    if(data.truncated)state.accountsError='El directorio muestra como máximo 200 usuarios en esta fase de prueba.';
  }catch(e){state.accountsLoaded=true;state.adminAccounts=[];state.accountsError=e.message;}
  finally{state.accountsLoading=false;render();}
}
  function accounts(){
  if(!isAdmin())return overview();
  const list=state.adminAccounts||[];
  const date=v=>{if(!v)return 'Sin registro';const d=new Date(v);return Number.isNaN(d.valueOf())?'Sin registro':d.toLocaleDateString('es-PE',{year:'numeric',month:'short',day:'numeric'});};
  const results=list.map(u=>`<div class="client-site-row account-access-row">
    <div class="client-avatar compact">${icon('users',19)}</div>
    <div class="account-access-info"><strong>${clean(u.email)}</strong><small>Rol: ${clean(u.role||'Cliente')} · Último acceso: ${clean(date(u.last_sign_in_at))}</small></div>
    <div class="account-access-actions"><button class="button button-outline" data-act="account-temp" data-id="${clean(u.id)}" data-email="${clean(u.email)}">Restablecer clave</button></div>
  </div>`).join('');
  return `${heading('Superadministrador','Accesos de clientes','Directorio de correos de acceso y recuperación segura de contraseñas, sin mostrar credenciales privadas.')}
    <div class="account-access-toolbar"><button class="button button-outline" data-act="accounts-refresh" ${state.accountsLoading?'disabled':''}>${icon('refresh',16)} ${state.accountsLoading?'Consultando…':'Actualizar usuarios'}</button><span>${fmt(list.length)} cuentas visibles</span></div>
    ${state.accountsError?alertBlock(state.accountsError,'info'):''}
    ${state.accountNotice?`<p class="company-message">${clean(state.accountNotice)}</p>`:''}
    ${state.temporaryAccess?`<div class="temporary-credential" role="status"><strong>Clave temporal de ${clean(state.temporaryAccess.email)}</strong><div class="temporary-credential-content"><code>${clean(state.temporaryAccess.password)}</code><button type="button" class="button button-primary" data-act="account-copy-temp">Copiar</button></div><p>Se muestra solo ahora. Envíala de forma privada y pide al cliente que la cambie en Mi cuenta.</p></div>`:''}
    ${card('Usuarios de clientes','Correos registrados en Supabase Auth',results||empty(state.accountsLoading?'Consultando cuentas…':state.accountsLoaded?'No hay cuentas de clientes disponibles.':'Pulsa Actualizar usuarios para consultar las cuentas.'))}
    <p class="fine-print">Las contraseñas no se almacenan ni pueden consultarse aquí. El administrador puede generar una clave temporal y entregarla al cliente de forma privada. Los accesos a empresas siguen sujetos a permisos.</p>`;
}
  function clients(){
 if(!isAdmin())return overview();
 const query=state.adminQuery.trim().toLowerCase(), filtered=state.businesses.filter(b=>(b.name+' '+(b.slug||'')).toLowerCase().includes(query));
 return `${heading('Administración','Mis clientes','Empresas a las que tienes acceso por Supabase. Las cuentas publicitarias y ventas siguen siendo privadas de cada negocio.')}
 <div class="admin-toolbar"><label class="admin-search">${icon('search',18)}<input id="admin-client-search" type="search" value="${clean(state.adminQuery)}" placeholder="Buscar empresa o identificador" aria-label="Buscar clientes"/></label><span>${fmt(filtered.length)} de ${fmt(state.businesses.length)} empresas</span></div>
 <div class="client-grid">${filtered.map(b=>`<article class="client-card client-card-clickable" data-act="client-detail" data-id="${clean(b.id)}" role="button" tabindex="0"><div class="client-avatar">${icon('building',27)}</div><h3>${clean(b.name)}</h3><p>${clean(b.slug)}</p><div class="client-line">${icon('lock',14)} ${clean(adminStatusFor(b))} · Aislamiento por empresa</div><span class="button button-outline">Ver ficha ${icon('chevron',15)}</span></article>`).join('')||empty(query?'No hay clientes que coincidan con la búsqueda.':'No hay negocios autorizados.')}</div>`;
}

  function clientDetail(){
 if(!isAdmin())return overview();
 const b=business();if(!b)return clients();
 const sites=state.sites.map(s=>`<div class="client-site-row"><div class="client-avatar compact">${icon('globe',19)}</div><div><strong>${clean(s.name)}</strong><small>${clean(s.url||'URL no registrada')}</small></div><span class="client-site-badge">${s.ga4_property_id?'GA4 asignado':'GA4 pendiente'}</span></div>`).join('');
 return `${heading('Cliente',b.name,'Consulta administrativa: sin usar sus tokens ni mezclar sus datos con otras empresas.')}
 <div class="client-detail-actions"><button class="button button-outline" data-act="nav" data-page="clients">${icon('chevron',16)} Volver</button></div>
 <div class="content-grid"><div class="col-7">${card('Sitios visibles',fmt(state.sites.length)+' registros accesibles',sites||empty('No hay sitios visibles con tu rol actual; esto no confirma que el cliente no tenga sitios.'))}</div>
 <div class="col-5">${card('Privacidad','Gestión de la plataforma',`<p>Las campañas y conexiones se consultan desde la sesión del cliente. No se muestran contraseñas ni secretos.</p><p class="fine-print">Invitaciones, planes y facturación requieren flujos administrativos propios antes de habilitar acciones de escritura.</p>`)}</div></div>`;
}
    function metaPilotEligible() { return !isAdmin() && !!business()?.id; }
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
 const [slug,color]=dict[name]||['google','4285F4'];
 const local=name==='Hotmart'?'/logos/hotmart.svg':name==='LinkedIn Ads'?'/logos/linkedin.svg':'';
 const src=local||`https://cdn.simpleicons.org/${slug}/${color}`;
 const fallback=local||'/logos/platform.svg';
 return `<div class="provider-logo" aria-hidden="true"><img src="${src}" alt="" loading="lazy" width="32" height="32" onerror="this.onerror=null;this.src='${fallback}'"/></div>`;
}
    function metaCard(){
 if(!metaPilotEligible())return '';
 const m=state.meta||{},list=m.accounts||[],selected=m.selected_accounts||[m.selected_account].filter(Boolean);
 const accounts=list.map(x=>`<label class="meta-account-row"><input class="meta-account-check" type="checkbox" value="${clean(x.id)}" ${selected.includes(x.id)?'checked':''}/><span><strong>${clean(x.name)}</strong><small>${clean(x.id)} · ${clean(x.currency)}</small></span></label>`).join('');
 const reports=state.metaReport?.account_reports||[];
 const results=reports.map(x=>{
  const v=x.metrics;
  return `<div class="meta-account-result"><strong>${clean(x.name)} · ${clean(x.currency)}</strong>${v?`<div class="meta-kpi-grid"><div><small>Inversión</small><strong>${metaMetric(v.spend,2)}</strong></div><div><small>Clics</small><strong>${metaMetric(v.clicks)}</strong></div><div><small>Impresiones</small><strong>${metaMetric(v.impressions)}</strong></div><div><small>CTR</small><strong>${metaMetric(v.ctr,2)}%</strong></div><div><small>CPC</small><strong>${metaMetric(v.cpc,2)}</strong></div></div>`:'<p class="fine-print">Sin datos en el período.</p>'}</div>`;
 }).join('');
 const body=!m.configured?`<p>La conexión de Meta Ads aún no está habilitada en esta plataforma. El administrador debe completar la autorización antes de que puedas conectar tu cuenta.</p><p class="fine-print">Tu cuenta y tus campañas no se verán afectadas mientras se completa esta configuración.</p>`:
 !m.connected?`<button class="button button-primary" data-act="meta-connect">${icon('link',16)} Conectar con Facebook</button>`:
 `<label class="form-label">Elige hasta cinco cuentas publicitarias</label>
 <input class="meta-search" id="meta-account-search" placeholder="Buscar cuenta publicitaria…" autocomplete="off"/>
 <div class="meta-account-list">${accounts||'<p>No se encontraron cuentas autorizadas.</p>'}</div>
 <div class="meta-actions"><button class="button button-outline" data-act="meta-refresh">${icon('refresh',16)} Actualizar datos</button><button class="button button-soft" data-act="meta-disconnect">Desconectar</button><button class="button button-outline" data-act="nav" data-page="campaigns">Ver campañas ${icon('chevron',15)}</button></div>
 <p class="fine-print">Consulta las estadísticas desde Resumen y Campañas Ads. Esta conexión piloto está vinculada al navegador actual y no es permanente entre dispositivos.</p>`;
 return `<article class="integration-card provider-card" data-connected="${m.connected?'true':'false'}"><div class="integration-head">${providerLogo('Meta Ads')}${tag(m.connected?'Conectado':m.configured?'Disponible':'Pendiente',m.connected?'success':'neutral')}</div><h3>Meta Ads</h3><p>Publicidad de Facebook e Instagram.</p>${state.metaError?alertBlock(state.metaError):''}<div class="integration-status">${m.connected&&!state.metaPanelOpen?`<div class="integration-compact-footer"><span>${selected.length} cuenta(s) seleccionadas</span><button class="button button-outline" data-act="meta-panel-toggle">Administrar cuentas</button></div>`:body}${m.connected&&state.metaPanelOpen?`<button class="button button-soft" data-act="meta-panel-toggle">Cerrar detalles</button>`:''}</div>${state.metaLoading?'<span class="fine-print">Consultando conexión…</span>':''}</article>`;
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
          state.metaReport=await api('/api/meta/report?business_id='+encodeURIComponent(current)+'&period='+encodeURIComponent(state.period));
        } catch(e) {state.metaError=e.message;}
      }
    }catch(e) {if(state.businessId===current)state.metaError=e.message;}
    finally {if(state.businessId===current){state.metaLoading=false;render();}}
  }
    function integrations(){
 const ga=gaReady(),lookup=[
  ['Analítica y contenidos',[
   {name:'Google Analytics 4',info:'Usuarios, sesiones y conversiones del sitio.',status:ga?'Conectado':'No conectado',connected:ga,details:ga?'Propiedad de Analytics con lectura autorizada.':'Consulta al administrador del sitio para habilitar la propiedad GA4.'},
   {name:'Google Search Console',info:'Consultas y posicionamiento SEO.',status:'Próximamente',details:'Necesita autorización de Google.'},
   {name:'Facebook / Instagram orgánico',info:'Alcance y estadísticas de perfiles sociales.',status:'Próximamente',details:'Pendiente de permisos de páginas y perfiles.'}] ],
  ['Ventas y e-commerce',[
   {name:'Hotmart',info:'Ventas, productos, ingresos y reembolsos.',status:'Próximamente',details:'Cada negocio necesitará sus propias credenciales.'},
   {name:'Shopify',info:'Pedidos, catálogo y ventas de tienda.',status:'Próximamente',details:'Pendiente de conexión individual por tienda.'}] ],
  ['Publicidad',[
   {name:'Meta Ads',info:'Facebook e Instagram Ads.'},
   {name:'Google Ads',info:'Campañas de búsqueda, display y video.',status:'Próximamente',details:'API oficial y OAuth pendientes.'},
   {name:'TikTok Ads',info:'Anuncios y campañas en TikTok.',status:'Próximamente',details:'Permisos de TikTok Ads pendientes.'},
   {name:'LinkedIn Ads',info:'Publicidad profesional en LinkedIn.',status:'Próximamente',details:'Autorización de LinkedIn pendiente.'}] ]
 ];
 const cardFor=(p)=>{
  if(p.name==='Meta Ads')return metaCard();
  return `<article class="integration-card provider-card" data-connected="${p.connected?'true':'false'}">
   <div class="integration-head">${providerLogo(p.name)}${tag(p.status,p.connected?'success':'neutral')}</div>
   <h3>${clean(p.name)}</h3><p>${clean(p.info)}</p>
   <div class="integration-status"><span>${clean(p.details||'')}</span>${p.connected?`<button class="button button-outline" data-act="nav" data-page="analytics">Ver datos</button>`:''}</div>
  </article>`;
 };
 return `${heading('Mis conexiones','Integraciones de mi empresa','Conecta tus plataformas una vez y consulta los datos autorizados en sus paneles.')}
 <div class="integration-filter-bar"><label class="admin-search">${icon('search',18)}<input type="search" id="integration-search" placeholder="Buscar plataforma…" aria-label="Buscar integración"/></label>
 <label class="company-checkbox"><input id="integration-only-connected" type="checkbox"/> Solo conectadas</label></div>
 ${lookup.map(([group,providers])=>`<section class="integration-section"><div class="section-caption"><h2>${clean(group)}</h2><span>${providers.length} plataformas</span></div>
 <div class="integration-grid">${providers.map(cardFor).join('')}</div></section>`).join('')}
 <p class="fine-print">Las conexiones marcadas «Próximamente» todavía no tienen acceso a su API y no mostrarán datos ficticios. Meta Ads requiere que la plataforma esté autorizada en Cloudflare y Meta for Developers.</p>`;
}

  function settings(){
 const theme=[['light','Claro'],['dark','Oscuro']];
 const palettes=[['purple','Violeta'],['blue','Azul'],['teal','Turquesa']];
 const sidebar=[['auto','Según tema'],['white','Blanco'],['blue','Azul oscuro']];
 const picker=(key,choices,selected)=>`<div class="preference-choice" role="group">${choices.map(([v,t])=>`<button class="pref-option ${selected===v?'selected':''}" type="button" data-act="set-pref" data-key="${key}" data-value="${v}" aria-pressed="${selected===v}">${t}</button>`).join('')}</div>`;
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
 <details class="account-email-change"><summary>Cambiar correo electrónico</summary>
 <form id="change-email-form" autocomplete="off">
 <label class="form-label" for="account-next-email">Nuevo correo</label><input class="simple-input" id="account-next-email" type="email" name="email" maxlength="254" required/>
 <label class="form-label" for="account-email-pass">Contraseña actual</label><div class="form-input">${icon('lock',16)}<input id="account-email-pass" type="password" name="currentPassword" autocomplete="current-password" required/></div>
 ${state.emailError?alertBlock(state.emailError):''}
 ${state.emailNotice?`<p class="company-message">${clean(state.emailNotice)}</p>`:''}
 <button type="submit" class="button button-outline" ${state.emailBusy?'disabled':''}>${state.emailBusy?'Solicitando…':'Solicitar cambio de correo'}</button>
 </form></details>
 <p class="fine-print">Cambiar el correo requiere confirmar tu identidad y puede necesitar una confirmación enviada por Supabase.</p>`)}</div>
 <div class="col-12">${card('Personalización de colores','Una apariencia discreta para tu panel',`
 <div class="appearance-grid"><div><h4>Apariencia general</h4>${picker('theme',theme,state.theme)}</div>
 <div><h4>Color de acento</h4>${picker('accent',palettes,state.accent)}</div>
 <div><h4>Menú lateral</h4>${picker('sidebar',sidebar,state.sidebarTone)}</div></div>
 <p class="fine-print">Estas preferencias se guardan en este navegador.</p>`)}</div></div>`;
}

    const groupTitle=(title)=>`<div class="nav-group-title">${clean(title)}</div>`;
  const navLink = id => `<button class="nav-link ${state.page===id?'active':''}" data-act="nav" data-page="${id}" title="${clean(pages[id][0])}" aria-label="${clean(pages[id][0])}" ${state.page===id?'aria-current="page"':''}>${icon(pages[id][1],19)}<span>${pages[id][0]}</span>${state.page===id?`<span class="active-indicator"></span>`:''}</button>`;
function sidebar(){
 const menu=isAdmin()?`${groupTitle('PLATAFORMA')}${['adminHome','clients','accounts','adminOperations','adminIntegrations','settings'].map(navLink).join('')}`:
 `${groupTitle('PANEL DE MI EMPRESA')}${['overview','analytics','acquisition','campaigns','audience','content','events'].map(navLink).join('')}${groupTitle('VENTAS Y REPORTES')}${['reports'].map(navLink).join('')}${groupTitle('CONEXIONES Y CUENTA')}${['integrations','company','settings'].map(navLink).join('')}`;
 return `<aside class="sidebar ${state.mobileOpen?'opened':''}"><div class="sidebar-head">${brand(false)}<button class="sidebar-collapse-btn icon-button" data-act="collapse-sidebar" title="${state.sidebarCollapsed?'Expandir menú':'Contraer menú'}" aria-label="${state.sidebarCollapsed?'Expandir menú':'Contraer menú'}" aria-expanded="${!state.sidebarCollapsed}">${icon('menu',18)}</button><button class="mobile-close icon-button" data-act="menu">${icon('close')}</button></div><div class="nav-wrapper"><button type="button" class="sidebar-workspace" data-act="nav" data-page="${isAdmin()?'adminHome':'company'}" title="${isAdmin()?'Ir al panel de administración':'Abrir perfil de mi empresa'}" aria-label="${isAdmin()?'Ir al panel de administración':'Abrir perfil de mi empresa'}"><span class="workspace-symbol">${isAdmin()?icon('building',20):companyImage(30)}</span><span><b>${isAdmin()?'Administración de plataforma':clean(displayBusiness())}</b><small>${isAdmin()?'Panel administrador':'Editar datos de mi empresa'}</small></span>${icon('chevron',16)}</button>${menu}</div><div class="sidebar-bottom"><div class="avatar">${clean((state.user?.email||'E')[0].toUpperCase())}</div><div class="account"><b>${clean((state.user?.email||'').split('@')[0])}</b><span>${isAdmin()?'Superadministrador':'Usuario de empresa'}</span></div><button class="icon-button logout" data-act="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout',19)}</button></div></aside>`;
}
    function topbar(){
 const places=!isAdmin()&&state.businesses.length>1?`<label class="select-wrap company-select">${icon('building',16)}<select id="business-selector">${state.businesses.map(x=>`<option value="${clean(x.id)}" ${state.businessId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const sites=!isAdmin()&&state.sites.length?`<label class="select-wrap site-select">${icon('globe',16)}<select id="site-selector">${state.sites.map(x=>`<option value="${clean(x.id)}" ${state.siteId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const period=isAdmin()?'':`<label class="select-wrap period-select">${icon('calendar',16)}<select id="date-period">${[['today','Hoy'],['yesterday','Ayer'],['7','7 días'],['30','30 días'],['90','90 días'],['365','12 meses']].map(([v,n])=>`<option value="${v}" ${state.period===v?'selected':''}>${n}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`;
 return `<header class="topbar"><div class="top-left"><button class="icon-button mobile-menu" data-act="menu">${icon('menu')}</button><div class="breadcrumbs">${isAdmin()?'Plataforma':'Mi empresa'} <span>/</span><strong>${clean(pages[state.page]?.[0]||'Resumen')}</strong></div></div><div class="top-right">${places}${sites}${isAdmin()?'':`<label class="search-wrap">${icon('search',18)}<input id="global-search" value="${clean(state.search)}" placeholder="Buscar en datos…"/></label>`}${period}${isAdmin()?'':`<button class="icon-button refresh-button" data-act="refresh" title="Actualizar">${icon('refresh',18)}</button>`}<button class="icon-button" data-act="theme" title="Tema">${icon(state.theme==='dark'?'sun':'moon',18)}</button><button class="top-avatar account-link" data-act="nav" data-page="settings" title="Mi cuenta">${clean(state.user.email[0].toUpperCase())}</button></div></header>`;
}
    function login(){root.innerHTML=`<div class="login-page"><div class="login-side"><div class="login-brand">${brand(true)}</div><div class="login-center"><div class="login-pill">${icon('spark',16)} Intelligence for better decisions</div><h1>Todos tus datos.<br><em>Una mejor perspectiva.</em></h1><p>Transforma información en decisiones. Un solo espacio para comprender tu sitio, tus usuarios y las ventas conectadas.</p><div class="login-feature-row"><span>${icon('check',15)} Datos reales</span><span>${icon('check',15)} Multiempresa</span><span>${icon('check',15)} Acceso seguro</span></div><div class="login-abstract" aria-hidden="true"><div class="abstract-blob"></div><div class="abstract-card a"><div class="abstract-dots"><i></i><i></i><i></i></div><span>Overview analytics</span><div class="abstract-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="abstract-card b"><div class="abstract-circle"></div><div class="abstract-lines"><i></i><i></i><i></i></div></div></div></div><div class="login-copyright">© eDigital · Analytics Platform</div></div><main class="login-form-side"><div class="login-theme"><button class="icon-button" data-act="theme" title="Cambiar tema">${icon(state.theme==='dark'?'sun':'moon')}</button></div><div class="login-panel"><div class="login-badge">ACCESO A TU DASHBOARD</div><h2>Bienvenido de nuevo <span>👋</span></h2><p class="login-sub">Ingresa con tu cuenta para ver todos tus reportes en un mismo lugar.</p>${state.startupError?alertBlock(state.startupError):''}${state.loginNotice?alertBlock(state.loginNotice,'info'):''}<form id="login-form"><label class="form-label" for="email">Correo electrónico</label><div class="form-input">${icon('users',17)}<input id="email" name="email" type="email" placeholder="tucorreo@empresa.com" autocomplete="username" required/></div><label class="form-label" for="password">Contraseña</label><div class="form-input">${icon('lock',17)}<input id="password" name="password" type="password" placeholder="Tu contraseña de acceso" autocomplete="current-password" required/><button type="button" class="password-toggle" data-act="show-password" title="Mostrar u ocultar contraseña">${icon('eye',18)}</button></div>${state.loginError?alertBlock(state.loginError):''}<button class="button button-primary sign-in" type="submit" ${state.loginBusy||state.startupError?'disabled':''}>${state.loginBusy?'<span class="spinner"></span> Validando cuenta…':'Ingresar a mi dashboard'} ${!state.loginBusy?icon('arrowUp',18):''}</button></form><div class="login-help">${icon('lock',14)} Acceso protegido por Supabase Auth. Nunca introduzcas claves de API aquí.</div></div><div class="login-contact">¿Necesitas acceso? Solicítalo al administrador de la plataforma.</div></main></div>`;}
  function render() {
    setTheme();
    // Refresh floating helper after every screen transition, including sign-in/out.
    queueMicrotask(() => window.dispatchEvent(new Event('edigital:render')));
    if(state.loading){root.innerHTML=`<div class="initial-load"><span class="spinner"></span><strong>Preparando eDigital…</strong></div>`;return;}
    if(!state.user){login();return;}
    if(isAdmin()&&!['adminHome','clients','accounts','clientDetail','adminOperations','adminIntegrations','settings'].includes(state.page))state.page='adminHome';
    if(!isAdmin()&&['adminHome','clients','accounts','clientDetail','adminOperations','adminIntegrations'].includes(state.page))state.page='overview';
    const contents={overview,analytics,acquisition,campaigns,utm,audience,content,events,hotmart,reports,clients,accounts,clientDetail,adminHome,adminOperations,adminIntegrations,integrations,company,settings};
    root.innerHTML=`<div class="layout ${state.sidebarCollapsed?'sidebar-collapsed':''}">${state.mobileOpen?'<div class="mobile-shade" data-act="menu"></div>':''}${sidebar()}<div class="main-column">${topbar()}<main class="main-content">${(contents[state.page]||overview)()}</main><footer class="footer"><span>© ${new Date().getFullYear()} eDigital · Analytics Platform</span><span>${icon('lock',13)} Datos autorizados · No se presentan métricas inventadas</span></footer></div></div>`;
  }
  async function loadAds(){
 if(isAdmin()||!state.businessId||state.adsPlatform!=='meta'){state.metaCampaigns=null;state.adsLoading=false;render();return;}
 const businessId=state.businessId,period=state.period,level=state.adsLevel;
 if(!state.meta?.connected||!(state.meta?.selected_accounts?.length||state.meta?.selected_account)){state.metaCampaigns=null;state.adsLoading=false;render();return;}
 state.adsLoading=true;state.adsError='';state.metaCampaigns=null;render();
 try{
  const rows=await api('/api/meta/campaigns?business_id='+encodeURIComponent(businessId)+'&period='+encodeURIComponent(period)+'&level='+encodeURIComponent(level));
  if(state.businessId===businessId&&state.period===period&&state.adsLevel===level)state.metaCampaigns=rows;
 }catch(e){if(state.businessId===businessId)state.adsError=e.message;}
 finally{if(state.businessId===businessId){state.adsLoading=false;render();}}
}
  async function refresh() {
    const generation=++state.requestId, b=state.businessId, s=state.siteId, p=state.period;
    state.ga=null;state.hm=null;state.gaError='';state.hmError='';
    state.gaLoading=!!s;state.hmLoading=selectedBusinessIsHotmart();render();
    const jobs=[];
    if(s)jobs.push(api(`/api/ga4/report?business_id=${encodeURIComponent(b)}&site_id=${encodeURIComponent(s)}&period=${encodeURIComponent(p)}`).then(x=>({type:'ga',value:x})).catch(e=>({type:'ga',error:e.message})));
    if(selectedBusinessIsHotmart())jobs.push(api(`/api/hotmart/summary?business_id=${encodeURIComponent(b)}&period=${encodeURIComponent(p)}`).then(x=>({type:'hm',value:x})).catch(e=>({type:'hm',error:e.message})));
    const results=await Promise.all(jobs);if(state.requestId!==generation)return;
    for(const result of results){ if(result.type==='ga'){state.ga=result.value||null;state.gaError=result.error||'';}else{state.hm=result.value||null;state.hmError=result.error||'';} }
    state.gaLoading=false;state.hmLoading=false;render();
  }
  async function chooseBusiness(id){
    if(!state.businesses.some(b=>b.id===id))return;
    ++state.requestId; state.businessId=id;state.sites=[];state.siteId='';state.ga=null;state.hm=null;state.meta=null;state.metaReport=null;state.metaCampaigns=null;state.metaError='';state.search='';state.gaError='';state.hmError='';render();
    try{const result=await api(`/api/sites?business_id=${encodeURIComponent(id)}`);if(state.businessId!==id)return;state.sites=result.sites||[];state.siteId=state.sites.find(s=>!!s.ga4_property_id)?.id||state.sites[0]?.id||'';}
    catch(e){state.gaError=e.message;}
    if(!isAdmin()){await refresh();if(metaPilotEligible())await loadMeta();}
  }
  async function init(){
    state.loading=true;render();
    try{
      const status=await api('/api/status');if(!status.configured)throw new Error(`Configuración pendiente: ${(status.missing||[]).join(', ')}`);
      const user=await api('/api/me');const companies=await api('/api/businesses');
      state.user=user.user;state.businesses=companies.businesses||[];state.page=isAdmin()?'adminHome':'overview';if(!isAdmin()&&new URLSearchParams(location.search).has('meta')){state.page='integrations';const result=new URLSearchParams(location.search).get('meta');if(result==='cancelled')state.metaError='Se canceló la autorización con Facebook.';history.replaceState({},'',location.pathname+location.hash);}state.startupError='';state.loginError='';state.loginNotice='';state.loginBusy=false;state.loading=false;render();
      if(isAdmin())await loadAdminStats();
      else if(state.businesses.length)await chooseBusiness(state.businesses[0].id);
    }catch(e){state.loading=false;state.user=null;state.loginBusy=false;if(e.status!==401)state.startupError=e.message;render();}
  }
  function doCsv(dataset=''){
    let list=[];
    if(dataset==='hotmart-products')list=state.hm?.products?.map(p=>({Producto:p.name,Ventas:p.count}))||[];
    else if(dataset)list=rows(dataset);
    else if(state.page==='hotmart')list=state.hm?.products?.map(p=>({Producto:p.name,Ventas:p.count}))||[];
    else{const selection={overview:'trend',analytics:'trend',acquisition:'sources',campaigns:'campaigns',audience:'countries',content:'pages',events:'events',reports:'trend'};list=rows(selection[state.page]||'trend');}
    if(!list.length){alert('No hay datos reales disponibles para descargar.');return;}
    const cols=Object.keys(list[0]);const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const content=[cols.map(quote).join(','),...list.map(item=>cols.map(k=>quote(item[k])).join(','))].join('\r\n');
    const file=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});const uri=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=uri;a.download=`e-digital-${dataset||state.page}-${state.period}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(uri),800);
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
      if(key==='theme'&&['light','dark'].includes(value)){state.theme=value;localStorage.setItem('ed-theme-v3',value);}
      else if(key==='accent'&&['purple','blue','teal'].includes(value)){state.accent=value;localStorage.setItem('ed-accent-v7',value);}
      else if(key==='sidebar'&&['auto','white','blue'].includes(value)){state.sidebarTone=value;localStorage.setItem('ed-sidebar-v7',value);}
      render();
    }
    else if(action==='collapse-sidebar'){state.sidebarCollapsed=!state.sidebarCollapsed;localStorage.setItem('ed-sidebar-collapsed',state.sidebarCollapsed?'1':'0');render();}
    else if(action==='menu'){state.mobileOpen=!state.mobileOpen;render();}
    else if(action==='nav'){state.page=b.dataset.page;state.temporaryAccess=null;state.mobileOpen=false;state.search='';state.tableSort='';render();window.scrollTo(0,0);if(state.page==='integrations'&&!isAdmin())await loadMeta();if(state.page==='adminIntegrations'&&isAdmin())await loadAdminHealth();if(state.page==='accounts'&&isAdmin())await loadAccounts();if(state.page==='campaigns'&&!isAdmin()){await loadMeta();await loadAds();}}
    else if(action==='refresh')await (isAdmin()?loadAdminStats():refresh());
    else if(action==='admin-check'&&isAdmin())await loadAdminStats();
    else if(action==='admin-health-refresh'&&isAdmin())await loadAdminHealth();
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
    else if(action==='meta-connect'){if(state.meta?.configured && metaPilotEligible())window.location.assign('/api/meta/connect?business_id='+encodeURIComponent(state.businessId));}
    else if(action==='edit-site'){state.editSiteId=b.dataset.id;state.siteError='';state.siteNotice='';render();}
    else if(action==='edit-site-cancel'){state.editSiteId='';state.siteError='';render();}
    else if(action==='company-logo-clear'){state.companyLogoClear=true;state.companyLogoDraft=null;state.companyNotice='';render();}
    else if(action==='meta-panel-toggle'){state.metaPanelOpen=!state.metaPanelOpen;render();}
    else if(action==='meta-refresh')await loadMeta();
    else if(action==='ads-refresh'){await loadMeta();await loadAds();}
    else if(action==='ads-platform'){state.adsPlatform=b.dataset.platform;state.metaCampaigns=null;state.adsError='';render();if(state.page==='campaigns')await loadAds();}
    else if(action==='meta-disconnect'){state.metaPanelOpen=false;
      if(confirm('¿Desconectar Meta Ads de este navegador? Puedes volver a autorizarla.')){
        try{await api('/api/meta/disconnect',{method:'POST',body:'{}'});await loadMeta();}
        catch(e){state.metaError=e.message;render();}
      }
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
  document.addEventListener('keydown', e=>{
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
    else if(e.target.id==='date-period'){state.period=e.target.value;await refresh();if(state.page==='integrations'||state.page==='campaigns')await loadMeta();if(state.page==='campaigns')await loadAds();}
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
    if(e.target.id==='change-email-form'){
      e.preventDefault();if(state.emailBusy)return;
      const data=new FormData(e.target);state.emailBusy=true;state.emailError='';state.emailNotice='';
      try{const response=await api('/api/auth/change-email',{method:'POST',body:JSON.stringify({
        email:String(data.get('email')||'').trim(),currentPassword:String(data.get('currentPassword')||'')})});
        state.emailNotice=response.message||'Solicitud enviada. Revisa el correo para confirmar.';
      }catch(err){state.emailError=err.message;}
      finally{state.emailBusy=false;render();}
      return;
    }
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
