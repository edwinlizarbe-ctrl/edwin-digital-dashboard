/* Edwin Digital Analytics — v3.0 | all displayed numbers come from authorized APIs. */
(() => {
  'use strict';
  const root = document.getElementById('app');
  const state = {
    user: null, businesses: [], sites: [], businessId: '', siteId: '',
    page: 'overview', period: '30', theme: localStorage.getItem('ed-theme-v3') || 'light',
    loading: true, gaLoading: false, hmLoading: false, ga: null, hm: null,
    gaError: '', hmError: '', startupError: '', loginError: '', loginBusy: false,
    mobileOpen: false, search: '', requestId: 0, tableSort: '', tableDesc: true,
    passwordBusy: false, passwordError: '', loginNotice: '',
    meta: null, metaReport: null, metaLoading: false, metaError: '',
    metaCampaigns: null, adsLoading: false, adsError: '', adsPlatform: 'meta', adsLevel: 'campaign',
  };
  const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = v => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(number(v));
  const fmt1 = v => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(number(v));
  const pc = v => `${fmt1(number(v) * 100)}%`;
  const money = (v, code) => { try { return new Intl.NumberFormat('es-PE', { style:'currency', currency:code, maximumFractionDigits:2 }).format(number(v)); } catch { return `${fmt1(v)} ${clean(code)}`; } };
  const duration = s => `${Math.floor(number(s) / 60)}m ${Math.round(number(s) % 60)}s`;
  const business = () => state.businesses.find(b => b.id === state.businessId);
  const periodLabel = () => ({ today:'Hoy', yesterday:'Ayer', '7':'Últimos 7 días', '30':'Últimos 30 días', '90':'Últimos 90 días', '365':'Últimos 12 meses' })[state.period] || 'Últimos 30 días';
  const site = () => state.sites.find(s => s.id === state.siteId);
  const isAdmin = () => state.user?.role === 'admin';
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
    audience: ['Audiencia', 'users'],
    content: ['Contenido web', 'file-text'],
    events: ['Eventos y metas', 'target'],
    hotmart: ['Ventas Hotmart', 'shopping-bag'],
    reports: ['Reportes', 'file-bar-chart'],
    clients: ['Mis clientes', 'building'],
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
  const brand = large => `<div class="brand ${large ? 'brand-large' : ''}"><div class="brand-symbol"><span></span><span></span><span></span><span></span></div><div class="brand-word">edwin<span>digital</span><small>ANALYTICS PLATFORM</small></div></div>`;

  async function api(path, options={}) {
    const res = await fetch(path, { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const error = new Error(data.error || `Error de servidor: ${res.status}`); error.status = res.status; throw error; }
    return data;
  }
  function setTheme() { document.documentElement.dataset.theme = state.theme; }
  const tag = (label, type='neutral') => `<span class="tag tag-${type}"><span class="tag-dot"></span>${clean(label)}</span>`;
  const alertBlock = (text, type='warning') => `<div class="alert-block ${type}">${icon(type==='warning'?'alert':'info',18)}<div>${clean(text)}</div></div>`;
  const empty = (text, title='Aún no hay datos') => `<div class="empty-data"><span class="empty-icon">${icon('activity',25)}</span><strong>${clean(title)}</strong><span>${clean(text)}</span></div>`;
  function dataPlaceholder() {
    if (state.gaLoading) return `<div class="loading-state"><span class="spinner"></span>Consultando la propiedad de Google Analytics 4…</div>`;
    if (!state.businesses.length) return empty('Tu cuenta no tiene negocios autorizados. El administrador debe asignarte uno.', 'Falta vincular un negocio');
    if (!state.sites.length) return empty('No hay sitios asignados al negocio seleccionado.', 'Falta registrar el sitio');
    if (!state.siteId) return empty('Selecciona un sitio que tenga un ID de propiedad GA4.', 'Falta vincular Analytics');
    return empty(state.gaError || state.ga?.reason || 'Configura GOOGLE_SERVICE_ACCOUNT_JSON en Cloudflare y permite a la cuenta de servicio leer la propiedad GA4.', 'Conexión pendiente');
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
    if(!gaReady())items.push(state.gaError || state.ga?.reason || 'Para mostrar cifras reales, configura la conexión GA4 del sitio seleccionado.');
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

  function overview() {
    const ok=gaReady();
    return `${heading('Vista general','Todo tu negocio, en una sola vista','Visualiza el rendimiento del sitio y las conversiones registradas, con datos reales.')}${statusStrip()}${mainKpis()}<div class="content-grid"><div class="col-8">${card('Rendimiento del sitio',`Usuarios y sesiones · ${periodLabel()}`,ok?chart(rows('trend'),'sessions','Sesiones','totalUsers','Usuarios'):dataPlaceholder())}</div><div class="col-4">${card('¿De dónde viene tu tráfico?','Distribución por canal de adquisición',ok?donut(rows('channels'),'sessionDefaultChannelGroup','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Páginas más visitadas','Contenido que concentra la atención',ok?barList(rows('pages'),'pagePath','screenPageViews',6):dataPlaceholder(),`<button class="text-action" data-act="nav" data-page="content">Ver contenido ${icon('chevron',14)}</button>`)}</div><div class="col-5">${card('Lectura rápida de tus datos','Hallazgos generados con la información disponible',insights())}</div></div>${selectedBusinessIsHotmart()?hotmartRibbon():''}${flags()}`;
  }
  function heading(kicker,title,subtitle){return `<div class="page-title"><div><div class="eyebrow">${clean(kicker)}</div><h1>${clean(title)}</h1><p>${clean(subtitle)}</p></div><button class="button button-outline title-export" data-act="csv">${icon('download',17)} Exportar CSV</button></div>`;}
  function detailKpis() {
    const v=m(), ok=gaReady();
    return `<div class="small-kpis">${[['Usuarios activos','activeUsers',fmt],['Usuarios nuevos','newUsers',fmt],['Sesiones con interacción','engagedSessions',fmt],['Tasa de interacción','engagementRate',pc],['Rebote','bounceRate',pc],['Eventos totales','eventCount',fmt],['Tiempo medio de sesión','averageSessionDuration',duration],['Tasa de sesión con evento clave','sessionKeyEventRate',pc]].map(x=>`<div class="small-kpi"><span>${x[0]}</span><strong>${ok?x[2](v[x[1]]):'—'}</strong>${trendFor(x[1],x[2]===pc)}</div>`).join('')}</div>`;
  }
  function analytics(){return `${heading('Analítica web','Así está rindiendo tu web','Visitas, interacción, permanencia y evolución histórica de GA4.')}${statusStrip()}${mainKpis()}${detailKpis()}<div class="content-grid"><div class="col-12">${card('Tráfico y visualizaciones','Compara el comportamiento del sitio a lo largo del período',gaReady()?chart(rows('trend'),'screenPageViews','Vistas de página','sessions','Sesiones',310):dataPlaceholder())}</div><div class="col-6">${card('Sesiones por dispositivo','Tráfico desde computadora, celular y tablet',gaReady()?donut(rows('devices'),'deviceCategory','sessions'):dataPlaceholder())}</div><div class="col-6">${card('Navegadores de tus usuarios','Distribución por tecnología',gaReady()?barList(rows('browsers'),'browser','totalUsers'):dataPlaceholder())}</div></div>${flags()}`;}
  function acquisition(){return `${heading('Adquisición','Descubre cómo te encuentran','Analiza canales, fuentes y medios de tráfico, sin confundir visitas con conversiones de anuncios.')}${statusStrip()}<div class="content-grid"><div class="col-5">${card('Mezcla de canales','Sesiones por categoría de adquisición',gaReady()?donut(rows('channels'),'sessionDefaultChannelGroup','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Principales fuentes y medios','Sesiones atribuidas en GA4',gaReady()?barList(rows('sources'),'sessionSourceMedium','sessions',10):dataPlaceholder())}</div><div class="col-12">${card('Detalle de canales','Usuarios, sesiones y eventos clave por canal',gaReady()?dataTable(rows('channels'),[{key:'sessionDefaultChannelGroup',label:'Canal'},{key:'sessions',label:'Sesiones',display:fmt},{key:'totalUsers',label:'Usuarios',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function campaigns(){
 const connected=state.meta?.connected&&(state.meta?.selected_accounts?.length||state.meta?.selected_account);
 const platform=state.adsPlatform,level=state.adsLevel,report=state.metaCampaigns;
 const choices=[['meta','Meta Ads'],['google','Google Ads'],['tiktok','TikTok Ads'],['linkedin','LinkedIn Ads'],['microsoft','Microsoft Ads'],['pinterest','Pinterest Ads']];
 const controls=`<div class="ads-toolbar"><label class="form-label">Plataforma<select id="ads-platform" class="meta-select">${choices.map(([value,label])=>`<option value="${value}" ${platform===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="form-label">Detalle<select id="ads-level" class="meta-select">${[['campaign','Campañas'],['adset','Conjuntos'],['ad','Anuncios']].map(([value,label])=>`<option value="${value}" ${level===value?'selected':''}>${label}</option>`).join('')}</select></label><button class="button button-outline" data-act="ads-refresh">${icon('refresh',16)} Actualizar</button></div>`;
 let result='';
 if(platform!=='meta')result=empty('Esta plataforma aún necesita autorización de la API oficial.','Integración pendiente');
 else if(!connected)result=empty('Conecta tu cuenta de Facebook desde Integraciones y selecciona una cuenta publicitaria.','Cuenta pendiente');
 else if(state.adsLoading)result='<div class="loading-state"><span class="spinner"></span>Consultando campañas…</div>';
 else if(state.adsError)result=alertBlock(state.adsError);
 else if(!report)result=empty('Pulsa Actualizar para cargar las campañas autorizadas.','Sin datos');
 else{
  const c=report.currency||'',fmtCost=(n,row)=>n==null?'—':money(n,row?.currency||c);
  const columns=[{key:'name',label:'Nombre'},{key:'spend',label:'Inversión',display:fmtCost},{key:'impressions',label:'Impresiones',display:v=>v==null?'—':fmt(v)},{key:'clicks',label:'Clics',display:v=>v==null?'—':fmt(v)},{key:'ctr',label:'CTR',display:v=>v==null?'—':fmt1(v)+'%'},{key:'cpc',label:'CPC',display:fmtCost}];
  result=`${report.partial?alertBlock('La consulta contiene resultados parciales; hay más filas por recuperar.','info'):''}${report.rows?.length?dataTable(report.rows,columns,100):empty('No hay resultados registrados para este período.','Sin resultados')}`;
 }
 const m=state.metaReport?.metrics,curr=state.metaReport?.currency||'';
 const kpis=platform==='meta'&&connected&&m?`<div class="small-kpis"><div class="small-kpi"><span>Inversión ${clean(curr)}</span><strong>${metaMetric(m.spend,2)}</strong></div><div class="small-kpi"><span>Clics</span><strong>${metaMetric(m.clicks)}</strong></div><div class="small-kpi"><span>Impresiones</span><strong>${metaMetric(m.impressions)}</strong></div><div class="small-kpi"><span>CTR</span><strong>${metaMetric(m.ctr,2)}%</strong></div><div class="small-kpi"><span>CPC</span><strong>${metaMetric(m.cpc,2)}</strong></div></div>`:'';
 return `${heading('Publicidad','Campañas Ads','Campañas, conjuntos y anuncios de tus plataformas autorizadas; sin mezclar las cifras de GA4.')}${controls}${kpis}${card('Rendimiento de la cuenta',periodLabel(),result)}
 <div class="spacer-lg"></div>${card('Atribución UTM de Analytics','Es información diferente del costo publicitario',`<p class="fine-print">Los clics, sesiones y eventos de GA4 no equivalen necesariamente a ventas pagadas.</p><button class="button button-outline" data-act="nav" data-page="utm">Ver tráfico UTM</button>`)}`;
}
    function utm(){return `${heading('Fuentes UTM · GA4','Campañas que llevan tráfico','Resultados de las campañas identificadas mediante etiquetado en Google Analytics 4.')}${statusStrip()}${alertBlock('Estas métricas corresponden al tráfico medido por GA4. No incluyen gasto publicitario, CPC, ROAS ni conversiones reportadas directamente por Meta Ads o Google Ads.', 'info')}<div class="content-grid"><div class="col-12">${card('Rendimiento por campaña','Sesiones y eventos clave atribuidos',gaReady()?dataTable(rows('campaigns'),[{key:'sessionCampaignName',label:'Campaña'},{key:'sessions',label:'Sesiones',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div><div class="col-6">${card('Campañas con más sesiones','Ranking de campañas etiquetadas',gaReady()?barList(rows('campaigns'),'sessionCampaignName','sessions',9):dataPlaceholder())}</div><div class="col-6">${card('Eventos clave por campaña','No equivale necesariamente a ventas confirmadas',gaReady()?barList([...rows('campaigns')].sort((a,b)=>number(b.keyEvents)-number(a.keyEvents)),'sessionCampaignName','keyEvents',9):dataPlaceholder())}</div></div>${flags()}`;}
  function audience(){return `${heading('Audiencia','Conoce a tus visitantes','Ubicación, dispositivos y procedencia de los usuarios.')}${statusStrip()}<div class="content-grid"><div class="col-6">${card('Países principales','Usuarios por país',gaReady()?barList(rows('countries'),'country','totalUsers',11):dataPlaceholder())}</div><div class="col-6">${card('Ciudades principales','Usuarios por ciudad',gaReady()?barList(rows('cities'),'city','totalUsers',11):dataPlaceholder())}</div><div class="col-5">${card('Dispositivos','Sesiones registradas por tipo',gaReady()?donut(rows('devices'),'deviceCategory','sessions'):dataPlaceholder())}</div><div class="col-7">${card('Detalle geográfico','Usuarios y sesiones por país',gaReady()?dataTable(rows('countries'),[{key:'country',label:'País'},{key:'totalUsers',label:'Usuarios',display:fmt},{key:'sessions',label:'Sesiones',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function content(){return `${heading('Contenido web','Tu contenido, con resultados','Identifica páginas populares y las que están atrayendo sesiones.')}${statusStrip()}<div class="content-grid"><div class="col-7">${card('Páginas más vistas','Visualizaciones por ruta de URL',gaReady()?barList(rows('pages'),'pagePath','screenPageViews',12):dataPlaceholder())}</div><div class="col-5">${card('Páginas de entrada','Sesiones iniciadas en cada página',gaReady()?barList(rows('landing'),'landingPage','sessions',10):dataPlaceholder())}</div><div class="col-12">${card('Rendimiento de páginas','Detalle que podrás exportar a CSV',gaReady()?dataTable(rows('pages'),[{key:'pagePath',label:'Ruta de página'},{key:'screenPageViews',label:'Visualizaciones',display:fmt},{key:'totalUsers',label:'Usuarios',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
  function events(){return `${heading('Eventos y objetivos','¿Qué acciones realizan?','Actividad, eventos clave y tasas de conversión registradas en Analytics.')}${statusStrip()}${detailKpis()}<div class="content-grid"><div class="col-8">${card('Evolución de eventos clave','Tendencia temporal de los eventos marcados como clave',gaReady()?chart(rows('trend'),'keyEvents','Eventos clave', '', '',280):dataPlaceholder())}</div><div class="col-4">${card('Tipos de eventos','Cantidad de eventos registrados',gaReady()?barList(rows('events'),'eventName','eventCount',10):dataPlaceholder())}</div><div class="col-12">${card('Detalle de eventos','Los eventos clave son los señalados en la propiedad GA4',gaReady()?dataTable(rows('events'),[{key:'eventName',label:'Nombre del evento'},{key:'eventCount',label:'Cantidad',display:fmt},{key:'keyEvents',label:'Eventos clave',display:fmt}]):dataPlaceholder())}</div></div>${flags()}`;}
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
 const b=business(),items=state.sites.map(x=>`<div class="client-site-row"><div class="client-avatar compact">${icon('globe',19)}</div><div><strong>${clean(x.name)}</strong><small>${clean(x.url||'Sin URL')}</small></div><span class="client-site-badge">${x.ga4_property_id?'GA4 asignado':'GA4 pendiente'}</span></div>`).join('');
 return `${heading('Mi negocio','Mi empresa','Consulta tus datos de empresa y administra tus fuentes autorizadas.')}
 <div class="content-grid"><div class="col-7">${card('Datos de mi empresa','Información actualmente registrada',`<div class="settings-line"><span>Empresa</span><b>${clean(b?.name||'Pendiente')}</b></div><div class="settings-line"><span>Identificador</span><b>${clean(b?.slug||'—')}</b></div><div class="settings-line"><span>Usuario</span><b>${clean(state.user?.email||'')}</b></div><p class="fine-print">La edición del logotipo, nombre comercial y datos de la empresa necesita almacenamiento y permisos de actualización separados por cliente.</p>`)}</div><div class="col-5">${card('Conecta tus cuentas','Tus accesos no se comparten con otras empresas',`<p>Desde Integraciones puedes autorizar Meta Ads y consultar las fuentes que realmente están conectadas.</p><button class="button button-primary" data-act="nav" data-page="integrations">${icon('plug',17)} Mis integraciones</button>`)}</div><div class="col-12">${card('Mis sitios',fmt(state.sites.length)+' registrados',items||empty('No hay sitios asignados.'))}</div></div>`;
}
  function adminHome(){
 const items=state.businesses||[];
 return `${heading('Superadministrador','Administración de Edwin Digital Analytics','Este panel controla la plataforma; las cuentas publicitarias y ventas pertenecen a cada cliente.')}
 <div class="small-kpis"><div class="small-kpi"><span>Negocios visibles</span><strong>${fmt(items.length)}</strong></div><div class="small-kpi"><span>Separación</span><strong>Por empresa</strong></div><div class="small-kpi"><span>Meta Ads</span><strong>OAuth por cliente</strong></div></div>
 <div class="content-grid"><div class="col-8">${card('Mis clientes','Empresas autorizadas por Supabase',items.map(b=>`<div class="client-site-row"><div class="client-avatar compact">${icon('building',19)}</div><div><strong>${clean(b.name)}</strong><small>${clean(b.slug)}</small></div><button class="button button-soft" data-act="client-detail" data-id="${clean(b.id)}">Ver ficha</button></div>`).join('')||empty('Sin clientes visibles.'))}</div><div class="col-4">${card('Panel de plataforma','Separado del negocio de cada cliente',`<p>Las integraciones de los clientes no pertenecen al superadministrador. Cada usuario se autentica y concede acceso a sus propias cuentas.</p><button class="button button-outline" data-act="nav" data-page="adminIntegrations">${icon('plug',16)} Centro de integraciones</button>`)}</div></div>`;
}

  function adminIntegrations(){
 const rows=[['Meta Ads','Piloto: conexión directa de solo lectura por empresa. App Meta en desarrollo: únicamente usuarios autorizados.'],['Google Analytics 4','Consultas GA4 existentes. OAuth de autoservicio aún pendiente.'],['Google Ads','Pendiente de permisos y conexión OAuth por empresa.'],['Hotmart','Pendiente de acceso individual; las claves de una cuenta no se reutilizan para otra.'],['Shopify','Pendiente de acceso de tienda y API.'],['TikTok Ads','Pendiente de permisos oficiales.'],['Instagram / Facebook orgánico','Pendiente de permisos de páginas y perfiles.'],['Google Search Console / LinkedIn Ads','Pendientes de conectores autorizados.']];
 return `${heading('Plataforma','Integraciones disponibles y pendientes','Estados reales de conectores sin atribuir cuentas de clientes al administrador.')}
 <div class="integration-grid">${rows.map((r,i)=>`<article class="integration-card"><div class="integration-head"><div class="integration-logo meta">${clean(r[0][0])}</div>${tag(i===0?'Piloto':i===1?'Consulta existente':'Pendiente',i<2?'success':'neutral')}</div><h3>${clean(r[0])}</h3><p>${clean(r[1])}</p></article>`).join('')}</div>`;
}

  function clients(){
 if(!isAdmin())return overview();
 return `${heading('Administración','Mis clientes','Abre fichas y propiedades autorizadas. No conecta cuentas publicitarias en nombre del cliente.')}
 <div class="client-grid">${state.businesses.map(b=>`<article class="client-card client-card-clickable" data-act="client-detail" data-id="${clean(b.id)}" role="button" tabindex="0"><div class="client-avatar">${icon('building',27)}</div><h3>${clean(b.name)}</h3><p>${clean(b.slug)}</p><div class="client-line">${icon('lock',14)} Acceso mediante permisos RLS</div><span class="button button-outline">Ver ficha ${icon('chevron',15)}</span></article>`).join('')||empty('Sin negocios autorizados.')}</div>`;
}

  function clientDetail(){
 if(!isAdmin())return overview();
 const b=business();if(!b)return clients();
 const sites=state.sites.map(s=>`<div class="client-site-row"><div class="client-avatar compact">${icon('globe',19)}</div><div><strong>${clean(s.name)}</strong><small>${clean(s.url||'URL no registrada')}</small></div><span class="client-site-badge">${s.ga4_property_id?'GA4 asignado':'GA4 pendiente'}</span></div>`).join('');
 return `${heading('Cliente',b.name,'Consulta administrativa: sin usar sus tokens ni mezclar sus datos con otras empresas.')}
 <div class="client-detail-actions"><button class="button button-outline" data-act="nav" data-page="clients">${icon('chevron',16)} Volver</button></div>
 <div class="content-grid"><div class="col-7">${card('Sitios registrados',fmt(state.sites.length)+' sitios autorizados',sites||empty('Esta empresa no tiene sitios registrados.'))}</div>
 <div class="col-5">${card('Privacidad','Gestión de la plataforma',`<p>Las campañas y conexiones se consultan desde la sesión del cliente. No se muestran contraseñas ni secretos.</p><p class="fine-print">Invitaciones, planes y facturación requieren flujos administrativos propios antes de habilitar acciones de escritura.</p>`)}</div></div>`;
}
    function metaPilotEligible() { return !isAdmin() && !!business()?.id; }
  function metaMetric(value, digits=0) {
    const n=Number(value);
    return value===null || value===undefined || !Number.isFinite(n) ? '—' :
      new Intl.NumberFormat('es-PE',{maximumFractionDigits:digits}).format(n);
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
 const body=!m.configured?'<p>Meta Ads aún requiere habilitación del proveedor por el administrador de la plataforma.</p>':
 !m.connected?`<button class="button button-primary" data-act="meta-connect">${icon('link',16)} Conectar con Facebook</button>`:
 `<label class="form-label">Elige hasta cinco cuentas publicitarias</label>
 <input class="meta-search" id="meta-account-search" placeholder="Buscar cuenta publicitaria…" autocomplete="off"/>
 <div class="meta-account-list">${accounts||'<p>No se encontraron cuentas autorizadas.</p>'}</div>
 <div class="meta-actions"><button class="button button-outline" data-act="meta-refresh">${icon('refresh',16)} Actualizar datos</button><button class="button button-soft" data-act="meta-disconnect">Desconectar</button><button class="button button-outline" data-act="nav" data-page="campaigns">Ver campañas ${icon('chevron',15)}</button></div>
 ${results}
 <p class="fine-print">Lectura autorizada por Meta, con resultados separados por cuenta y moneda. El token de esta prueba está cifrado y asociado a esta sesión; puede caducar.</p>`;
 return `<article class="integration-card meta-full"><div class="integration-head"><div class="integration-logo meta">M</div>${tag(m.connected?'Conectado':m.configured?'Listo para conectar':'Pendiente',m.connected?'success':'neutral')}</div><h3>Meta Ads</h3><p>Autoriza Facebook y selecciona tus propias cuentas, sin intermediarios.</p>${state.metaError?alertBlock(state.metaError):''}<div class="integration-status">${body}</div>${state.metaLoading?'<span class="fine-print">Consultando Meta Ads…</span>':''}</article>`;
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
 const connected=gaReady(),other=[
  ['Google Analytics 4','G','Sesiones, usuarios, eventos y adquisición web.',connected?'Conectado':'Pendiente',connected?'Propiedad GA4 autorizada.':'Requiere acceso a tu propiedad de Analytics.'],
  ['Google Ads','A','Campañas, clics, CTR, CPC y conversiones.','Próximamente','OAuth y API por empresa aún pendientes.'],
  ['Hotmart','H','Ventas, ingresos, productos y reembolsos.','Próximamente','La conexión debe usar la propia cuenta de Hotmart de tu empresa.'],
  ['Shopify','S','Pedidos, ventas, catálogo y devoluciones.','Próximamente','Instalación y permiso por cada tienda.'],
  ['TikTok Ads','T','Campañas y métricas oficiales de TikTok.','Próximamente','Acceso a TikTok Business API pendiente.'],
  ['Facebook / Instagram orgánico','F','Publicaciones y resultados no pagados.','Próximamente','Pendientes permisos de páginas y perfiles.'],
  ['Google Search Console','G','Consultas, posiciones, clics e impresiones.','Próximamente','Autorización Google pendiente.'],
  ['LinkedIn Ads','L','Campañas de publicidad profesional.','Próximamente','Autorización de anuncios pendiente.']
 ];
 return `${heading('Conexiones','Vincula las cuentas de tu empresa','Autoriza cada plataforma desde tu negocio, como en Windsor.ai. No compartimos tokens entre clientes.')}
 <div class="integration-grid">${metaCard()}${other.map(a=>`<article class="integration-card"><div class="integration-head"><div class="integration-logo google">${clean(a[1])}</div>${tag(a[3],a[3]==='Conectado'?'success':'neutral')}</div><h3>${clean(a[0])}</h3><p>${clean(a[2])}</p><div class="integration-status"><strong>${clean(a[4])}</strong></div></article>`).join('')}</div>
 <p class="fine-print">Las plataformas marcadas Próximamente no envían datos reales todavía. Meta Ads funciona en modo piloto de lectura; en Meta Developers, el acceso externo puede requerir revisión y autorización del proveedor.</p>`;
}
    function settings(){
    return `${heading('Preferencias','Mi cuenta y seguridad','Gestiona tu acceso y personaliza tu espacio de trabajo.')}
      ${card('Información de sesión','Cuenta autenticada con Supabase',`<div class="settings-line"><span>Correo electrónico</span><b>${clean(state.user.email)}</b></div><div class="settings-line"><span>Tipo de acceso</span><b>${isAdmin()?'Administrador':'Cliente'}</b></div><div class="settings-line"><span>Negocio activo</span><b>${clean(business()?.name||'Sin seleccionar')}</b></div><div class="settings-line"><span>Sitio activo</span><b>${clean(site()?.name||'Sin seleccionar')}</b></div>`)}
      <div class="spacer-lg"></div>
      ${card('Cambiar contraseña','Disponible tanto para administradores como para clientes',`<form id="change-password-form" class="security-form" autocomplete="off">
        <p class="fine-print">Por seguridad, escribe tu contraseña actual y elige una nueva de al menos 10 caracteres. Después del cambio tendrás que volver a iniciar sesión.</p>
        <label class="form-label" for="current-pass">Contraseña actual</label><div class="form-input">${icon('lock',17)}<input id="current-pass" type="password" name="currentPassword" autocomplete="current-password" required maxlength="512"/></div>
        <label class="form-label" for="next-pass">Nueva contraseña</label><div class="form-input">${icon('lock',17)}<input id="next-pass" type="password" name="newPassword" autocomplete="new-password" minlength="10" maxlength="128" required/></div>
        <label class="form-label" for="confirm-pass">Confirmar contraseña nueva</label><div class="form-input">${icon('check',17)}<input id="confirm-pass" type="password" name="confirmPassword" autocomplete="new-password" minlength="10" maxlength="128" required/></div>
        ${state.passwordError?alertBlock(state.passwordError):''}
        <button class="button button-primary security-submit" type="submit" ${state.passwordBusy?'disabled':''}>${state.passwordBusy?'<span class="spinner"></span> Actualizando…':`${icon('lock',17)} Guardar contraseña nueva`}</button>
      </form>`)}
      <div class="spacer-lg"></div>
      ${card('Apariencia','Cambiar entre interfaz clara y oscura',`<div class="settings-line"><span>Tema</span><button class="button button-outline" data-act="theme">${icon(state.theme==='dark'?'sun':'moon',17)} ${state.theme==='dark'?'Usar modo claro':'Usar modo oscuro'}</button></div>`)}`;
  }


  const groupTitle=(title)=>`<div class="nav-group-title">${clean(title)}</div>`;
  const navLink = id => `<button class="nav-link ${state.page===id?'active':''}" data-act="nav" data-page="${id}">${icon(pages[id][1],19)}<span>${pages[id][0]}</span>${state.page===id?`<span class="active-indicator"></span>`:''}</button>`;
function sidebar(){
 const menu=isAdmin()?`${groupTitle('PLATAFORMA')}${['adminHome','clients','adminIntegrations','settings'].map(navLink).join('')}`:
 `${groupTitle('PANEL DE MI EMPRESA')}${['overview','analytics','acquisition','campaigns','audience','content','events'].map(navLink).join('')}${groupTitle('VENTAS Y REPORTES')}${['hotmart','reports'].map(navLink).join('')}${groupTitle('CONEXIONES Y CUENTA')}${['integrations','company','settings'].map(navLink).join('')}`;
 return `<aside class="sidebar ${state.mobileOpen?'opened':''}"><div class="sidebar-head">${brand(false)}<button class="mobile-close icon-button" data-act="menu">${icon('close')}</button></div><div class="nav-wrapper"><div class="sidebar-workspace"><span class="workspace-symbol">${icon('building',20)}</span><span><b>${isAdmin()?'Administración de plataforma':clean(business()?.name||'Mi empresa')}</b><small>${isAdmin()?'Superadministrador':'Espacio de análisis'}</small></span>${icon('chevronDown',16)}</div>${menu}</div><div class="sidebar-bottom"><div class="avatar">${clean((state.user?.email||'E')[0].toUpperCase())}</div><div class="account"><b>${clean((state.user?.email||'').split('@')[0])}</b><span>${isAdmin()?'Superadministrador':'Usuario de empresa'}</span></div><button class="icon-button logout" data-act="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout',19)}</button></div></aside>`;
}
    function topbar(){
 const places=!isAdmin()&&state.businesses.length>1?`<label class="select-wrap company-select">${icon('building',16)}<select id="business-selector">${state.businesses.map(x=>`<option value="${clean(x.id)}" ${state.businessId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const sites=!isAdmin()&&state.sites.length?`<label class="select-wrap site-select">${icon('globe',16)}<select id="site-selector">${state.sites.map(x=>`<option value="${clean(x.id)}" ${state.siteId===x.id?'selected':''}>${clean(x.name)}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`:'';
 const period=isAdmin()?'':`<label class="select-wrap period-select">${icon('calendar',16)}<select id="date-period">${[['today','Hoy'],['yesterday','Ayer'],['7','7 días'],['30','30 días'],['90','90 días'],['365','12 meses']].map(([v,n])=>`<option value="${v}" ${state.period===v?'selected':''}>${n}</option>`).join('')}</select>${icon('chevronDown',14)}</label>`;
 return `<header class="topbar"><div class="top-left"><button class="icon-button mobile-menu" data-act="menu">${icon('menu')}</button><div class="breadcrumbs">${isAdmin()?'Plataforma':'Mi empresa'} <span>/</span><strong>${clean(pages[state.page]?.[0]||'Resumen')}</strong></div></div><div class="top-right">${places}${sites}${isAdmin()?'':`<label class="search-wrap">${icon('search',18)}<input id="global-search" value="${clean(state.search)}" placeholder="Buscar en datos…"/></label>`}${period}${isAdmin()?'':`<button class="icon-button refresh-button" data-act="refresh" title="Actualizar">${icon('refresh',18)}</button>`}<button class="icon-button" data-act="theme" title="Tema">${icon(state.theme==='dark'?'sun':'moon',18)}</button><button class="top-avatar account-link" data-act="nav" data-page="settings" title="Mi cuenta">${clean(state.user.email[0].toUpperCase())}</button></div></header>`;
}
    function login(){root.innerHTML=`<div class="login-page"><div class="login-side"><div class="login-brand">${brand(true)}</div><div class="login-center"><div class="login-pill">${icon('spark',16)} Intelligence for better decisions</div><h1>Todos tus datos.<br><em>Una mejor perspectiva.</em></h1><p>Transforma información en decisiones. Un solo espacio para comprender tu sitio, tus usuarios y las ventas conectadas.</p><div class="login-feature-row"><span>${icon('check',15)} Datos reales</span><span>${icon('check',15)} Multiempresa</span><span>${icon('check',15)} Acceso seguro</span></div><div class="login-abstract" aria-hidden="true"><div class="abstract-blob"></div><div class="abstract-card a"><div class="abstract-dots"><i></i><i></i><i></i></div><span>Overview analytics</span><div class="abstract-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="abstract-card b"><div class="abstract-circle"></div><div class="abstract-lines"><i></i><i></i><i></i></div></div></div></div><div class="login-copyright">© Edwin Digital · Analytics Platform</div></div><main class="login-form-side"><div class="login-theme"><button class="icon-button" data-act="theme" title="Cambiar tema">${icon(state.theme==='dark'?'sun':'moon')}</button></div><div class="login-panel"><div class="login-badge">ACCESO A TU DASHBOARD</div><h2>Bienvenido de nuevo <span>👋</span></h2><p class="login-sub">Ingresa con tu cuenta para ver todos tus reportes en un mismo lugar.</p>${state.startupError?alertBlock(state.startupError):''}${state.loginNotice?alertBlock(state.loginNotice,'info'):''}<form id="login-form"><label class="form-label" for="email">Correo electrónico</label><div class="form-input">${icon('users',17)}<input id="email" name="email" type="email" placeholder="tucorreo@empresa.com" autocomplete="username" required/></div><label class="form-label" for="password">Contraseña</label><div class="form-input">${icon('lock',17)}<input id="password" name="password" type="password" placeholder="Tu contraseña de acceso" autocomplete="current-password" required/><button type="button" class="password-toggle" data-act="show-password" title="Mostrar u ocultar contraseña">${icon('eye',18)}</button></div>${state.loginError?alertBlock(state.loginError):''}<button class="button button-primary sign-in" type="submit" ${state.loginBusy||state.startupError?'disabled':''}>${state.loginBusy?'<span class="spinner"></span> Validando cuenta…':'Ingresar a mi dashboard'} ${!state.loginBusy?icon('arrowUp',18):''}</button></form><div class="login-help">${icon('lock',14)} Acceso protegido por Supabase Auth. Nunca introduzcas claves de API aquí.</div></div><div class="login-contact">¿Necesitas acceso? Solicítalo al administrador de Edwin Digital.</div></main></div>`;}
  function render() {
    setTheme();
    if(state.loading){root.innerHTML=`<div class="initial-load"><span class="spinner"></span><strong>Preparando Edwin Digital Analytics…</strong></div>`;return;}
    if(!state.user){login();return;}
    if(isAdmin()&&!['adminHome','clients','clientDetail','adminIntegrations','settings'].includes(state.page))state.page='adminHome';
    if(!isAdmin()&&['adminHome','clients','clientDetail','adminIntegrations'].includes(state.page))state.page='overview';
    const contents={overview,analytics,acquisition,campaigns,utm,audience,content,events,hotmart,reports,clients,clientDetail,adminHome,adminIntegrations,integrations,company,settings};
    root.innerHTML=`<div class="layout">${state.mobileOpen?'<div class="mobile-shade" data-act="menu"></div>':''}${sidebar()}<div class="main-column">${topbar()}<main class="main-content">${(contents[state.page]||overview)()}</main><footer class="footer"><span>© ${new Date().getFullYear()} Edwin Digital · Analytics Platform</span><span>${icon('lock',13)} Datos autorizados · No se presentan métricas inventadas</span></footer></div></div>`;
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
      if(state.businesses.length&&!isAdmin()) await chooseBusiness(state.businesses[0].id);
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
    const a=document.createElement('a');a.href=uri;a.download=`edwin-digital-${dataset||state.page}-${state.period}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(uri),800);
  }
  document.addEventListener('click', async e=>{
    const b=e.target.closest('[data-act]');if(!b)return;
    const action=b.dataset.act;
    if(action==='theme'){state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('ed-theme-v3',state.theme);render();}
    else if(action==='menu'){state.mobileOpen=!state.mobileOpen;render();}
    else if(action==='nav'){state.page=b.dataset.page;state.mobileOpen=false;state.search='';state.tableSort='';render();window.scrollTo(0,0);if(state.page==='integrations'&&!isAdmin())await loadMeta();if(state.page==='campaigns'&&!isAdmin()){await loadMeta();await loadAds();}}
    else if(action==='refresh')await refresh();
    else if(action==='meta-connect'){if(state.meta?.configured && metaPilotEligible())window.location.assign('/api/meta/connect?business_id='+encodeURIComponent(state.businessId));}
    else if(action==='meta-refresh')await loadMeta();
    else if(action==='ads-refresh'){await loadMeta();await loadAds();}
    else if(action==='meta-disconnect'){
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
      Object.assign(state,{user:null,businesses:[],sites:[],businessId:'',siteId:'',ga:null,hm:null,gaError:'',hmError:'',meta:null,metaReport:null,metaError:'',page:'overview',mobileOpen:false,search:''});render();
    }
  });
  document.addEventListener('keydown', e=>{
    if((e.key==='Enter'||e.key===' ') && e.target.matches?.('.client-card-clickable')){
      e.preventDefault(); e.target.click();
    }
  });
  document.addEventListener('change', async e=>{
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
  document.addEventListener('input',e=>{
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
