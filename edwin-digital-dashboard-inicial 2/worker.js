/**
 * Edwin Digital Dashboard · Cloudflare Workers
 * Credentials stay in Cloudflare runtime secrets; browser never gets these values.
 * All PostgreSQL requests use the signed-in user's JWT with Supabase RLS.
 */
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(data, status = 200, cookies = []) {
  const headers = new Headers(JSON_HEADERS);
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearCookies() {
  return [cookie('ed_access', '', 0), cookie('ed_refresh', '', 0)];
}
function cookieJar(req) {
  const jar = Object.create(null);
  for (const part of (req.headers.get('Cookie') || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) {
      const key = part.slice(0, eq).trim();
      try { jar[key] = decodeURIComponent(part.slice(eq + 1).trim()); }
      catch { /* Ignore malformed cookie. */ }
    }
  }
  return jar;
}
function conf(env) {
  return (env.SUPABASE_URL || '').replace(/\/$/, '') && env.SUPABASE_ANON_KEY;
}
function supaHeaders(env, token = null) {
  return { 'apikey': env.SUPABASE_ANON_KEY, ...(token ? { 'Authorization': `Bearer ${token}` } : {}), 'Accept': 'application/json' };
}
async function supaAuth(env, endpoint, init) {
  return fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/${endpoint}`, {
    ...init, headers: { ...supaHeaders(env), 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}
async function supaRest(env, route, token) {
  const res = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/${route}`, {
    headers: supaHeaders(env, token),
  });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status} al consultar datos`);
  return res.json();
}
async function session(req, env) {
  const jar = cookieJar(req);
  if (!jar.ed_access && !jar.ed_refresh) return null;
  let access = jar.ed_access;
  let cookies = [];
  async function userFor(token) {
    if (!token) return null;
    const r = await supaAuth(env, 'user', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? await r.json() : null;
  }
  let user = await userFor(access);
  if (!user && jar.ed_refresh) {
    const r = await supaAuth(env, 'token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: jar.ed_refresh }),
    });
    if (r.ok) {
      const next = await r.json();
      access = next.access_token;
      cookies = [cookie('ed_access', access, Math.max(60, Number(next.expires_in) || 3600)), cookie('ed_refresh', next.refresh_token, 60 * 60 * 24 * 14)];
      user = await userFor(access);
    }
  }
  if (!user) return { invalid: true, cookies: clearCookies() };
  const profile = await supaRest(env, `profiles?select=id,email,role&id=eq.${encodeURIComponent(user.id)}&limit=1`, access);
  if (!profile.length) return { invalid: true, cookies: clearCookies() };
  return { user: { id: user.id, email: user.email, role: profile[0].role }, access, cookies };
}
function corsPostDenied(req) {
  const origin = req.headers.get('Origin');
  return !!origin && origin !== new URL(req.url).origin;
}
async function handleApi(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  if (!conf(env)) {
    if (path === '/api/status') return json({ configured: false, missing: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'].filter(k => !env[k]) });
    return json({ error: 'Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY en Cloudflare → Variables and Secrets.' }, 503);
  }
  if (path === '/api/status' && method === 'GET') return json({ configured: true });
  if (path === '/api/auth/login' && method === 'POST') {
    if (corsPostDenied(req)) return json({ error: 'Origen no autorizado' }, 403);
    if (Number(req.headers.get('Content-Length')) > 8192) return json({ error: 'Solicitud demasiado grande' }, 413);
    if (!(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Se requiere JSON' }, 415);
    let payload;
    try { payload = await req.json(); } catch { return json({ error: 'Solicitud no válida' }, 400); }
    if (typeof payload.email !== 'string' || typeof payload.password !== 'string' || payload.password.length > 512) return json({ error: 'Correo o contraseña no válidos' }, 400);
    const r = await supaAuth(env, 'token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email: payload.email.trim(), password: payload.password }),
    });
    if (!r.ok) return json({ error: 'Correo o contraseña incorrectos, o cuenta sin confirmar.' }, 401);
    const data = await r.json();
    const cookies = [cookie('ed_access', data.access_token, Math.max(60, Number(data.expires_in) || 3600)), cookie('ed_refresh', data.refresh_token, 60 * 60 * 24 * 14)];
    return json({ ok: true }, 200, cookies);
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    if (corsPostDenied(req)) return json({ error: 'Origen no autorizado' }, 403);
    return json({ ok: true }, 200, clearCookies());
  }
  const s = await session(req, env);
  if (!s || s.invalid) return json({ error: 'Necesitas iniciar sesión.' }, 401, s?.cookies || []);
  if (path === '/api/me' && method === 'GET') return json({ user: s.user }, 200, s.cookies);
  if (path === '/api/businesses' && method === 'GET') {
    const businesses = await supaRest(env, 'businesses?select=id,name,slug,created_at&order=name.asc', s.access);
    return json({ businesses }, 200, s.cookies);
  }
  if (path === '/api/sites' && method === 'GET') {
    const id = url.searchParams.get('business_id') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) return json({ error: 'Identificador de negocio no válido' }, 400, s.cookies);
    const sites = await supaRest(env, `sites?select=id,business_id,name,url,ga4_property_id&business_id=eq.${encodeURIComponent(id)}&order=name.asc`, s.access);
    return json({ sites }, 200, s.cookies);
  }
  if (path === '/api/ga4/report' && method === 'GET') {
    const businessId = url.searchParams.get('business_id') || '';
    const siteId = url.searchParams.get('site_id') || '';
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    if (!isUuid(businessId) || !isUuid(siteId)) return json({ error: 'Selecciona un negocio y un sitio válidos.' }, 400, s.cookies);
    // This REST request is authenticated as the user. Supabase RLS determines
    // which business/site this user can read; NEVER trust a property ID from the browser.
    const allowed = await supaRest(env, `sites?select=id,name,ga4_property_id&business_id=eq.${businessId}&id=eq.${siteId}&limit=1`, s.access);
    const site = allowed[0];
    if (!site) return json({ error: 'Este sitio no pertenece a tu cuenta.' }, 403, s.cookies);
    if (!site.ga4_property_id || !/^\d+$/.test(site.ga4_property_id)) return json({ configured: false, reason: 'Este sitio no tiene una propiedad GA4 válida registrada.' }, 200, s.cookies);
    if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return json({ configured: false, reason: 'Falta configurar GOOGLE_SERVICE_ACCOUNT_JSON en los secretos de Cloudflare.' }, 200, s.cookies);
    const report = await ga4FullReport(env, site.ga4_property_id, days);
    return json({ ...report, configured: true, site: { id: site.id, name: site.name }, days }, 200, s.cookies);
  }
  if (path === '/api/hotmart/summary' && method === 'GET') {
    // Only users authorized by Supabase RLS for the Edwin Digital business can access its pilot credentials.
    if (!env.HOTMART_CLIENT_ID || !env.HOTMART_CLIENT_SECRET || !env.HOTMART_BASIC) {
      return json({ error: 'Faltan las credenciales privadas de Hotmart en Cloudflare.' }, 503, s.cookies);
    }
    const businessId = url.searchParams.get('business_id') || '';
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    if (!isUuid(businessId)) return json({ error: 'Selecciona un negocio válido.' }, 400, s.cookies);
    const allowed = await supaRest(env, `businesses?select=id,slug&id=eq.${businessId}&limit=1`, s.access);
    // Pilot credentials are strictly linked to the Edwin Digital business.
    if (!allowed.length || allowed[0].slug !== 'edwin-digital') return json({ error: 'Hotmart aún no está conectado a este negocio.' }, 403, s.cookies);
    const credentials = await hotmartAccessToken(env);
    if (!credentials.ok) return json({ error: `Hotmart no autorizó las credenciales (HTTP ${credentials.status}). Revisa las variables en Cloudflare.` }, 502, s.cookies);
    const data = await hotmartRecentSales(credentials.access_token, days);
    if (!data.ok) return json({ error: `Hotmart rechazó la consulta de ventas (HTTP ${data.status}). Verifica el acceso a la API de Ventas.` }, 502, s.cookies);
    return json(data.summary, 200, s.cookies);
  }
  return json({ error: 'Ruta no encontrada.' }, 404, s.cookies);
}


function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function enc64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlText(obj) { return enc64url(new TextEncoder().encode(JSON.stringify(obj))); }
async function googleAccessToken(env) {
  let account;
  try { account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON válido'); }
  if (!account.client_email || !account.private_key || account.type !== 'service_account') throw new Error('Credenciales Google de cuenta de servicio incompletas');
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlText({ alg: 'RS256', typ: 'JWT' });
  const payload = base64urlText({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 });
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const raw = atob(pem);
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(raw, c => c.charCodeAt(0)), {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']);
  const value = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(value));
  const assertion = `${value}.${enc64url(new Uint8Array(signature))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion})});
  if (!r.ok) throw new Error(`Google OAuth: no se pudo autorizar la cuenta de servicio (HTTP ${r.status})`);
  const token = await r.json();
  if (!token.access_token) throw new Error('Google OAuth no devolvió token de acceso');
  return token.access_token;
}
function unpackGaRows(report, dimensions, metrics) {
  return (report.rows || []).map(r => {
    const row = {};
    dimensions.forEach((k, i) => row[k] = String(r.dimensionValues?.[i]?.value || ''));
    metrics.forEach((k, i) => row[k] = Number(r.metricValues?.[i]?.value || 0));
    return row;
  });
}
async function ga4FullReport(env, property, days) {
  const token = await googleAccessToken(env);
  const period = [{startDate: `${days}daysAgo`, endDate:'today'}];
  const definitions = {
    summary: {dims:[], metrics:['totalUsers','activeUsers','newUsers','sessions','engagedSessions','engagementRate','screenPageViews','eventCount','keyEvents','averageSessionDuration','bounceRate','sessionKeyEventRate','totalRevenue'], limit:1},
    trend: {dims:['date'], metrics:['sessions','totalUsers','screenPageViews','keyEvents'], limit:100, sort:'date'},
    channels: {dims:['sessionDefaultChannelGroup'],metrics:['sessions','totalUsers','keyEvents'],limit:12},
    sources: {dims:['sessionSourceMedium'],metrics:['sessions','totalUsers'],limit:12},
    pages: {dims:['pagePath'],metrics:['screenPageViews','totalUsers'],limit:12},
    devices: {dims:['deviceCategory'],metrics:['sessions','totalUsers'],limit:8},
    countries: {dims:['country'],metrics:['totalUsers','sessions'],limit:12},
    cities: {dims:['city'],metrics:['totalUsers'],limit:12},
    events: {dims:['eventName'],metrics:['eventCount','keyEvents'],limit:15},
    campaigns: {dims:['sessionCampaignName'],metrics:['sessions','keyEvents'],limit:12},
  };
  const run = async ([kind, definition]) => {
    const {dims, metrics, limit, sort} = definition;
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
      method:'POST',
      headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      body:JSON.stringify({dateRanges:period,dimensions:dims.map(name=>({name})),metrics:metrics.map(name=>({name})),limit:String(limit),orderBys:[sort?{dimension:{dimensionName:sort}}:{metric:{metricName:metrics[0]},desc:true}]})
    });
    if (!r.ok) { const err=await r.json().catch(()=>({})); throw new Error(`GA4 ${kind}: ${String(err.error?.message || r.status).slice(0,180)}`); }
    return unpackGaRows(await r.json(), dims, metrics);
  };
  const results = await Promise.allSettled(Object.entries(definitions).map(run));
  const reports = {}; const warnings=[];
  Object.keys(definitions).forEach((key, idx) => {
    if (results[idx].status==='fulfilled') reports[key] = results[idx].value;
    else { reports[key]=[]; warnings.push(results[idx].reason.message); }
  });
  if (!results.some(r=>r.status==='fulfilled')) throw new Error('GA4 no devolvió informes. Comprueba permisos, API y propiedad.');
  return { property_id:property, metrics:reports.summary[0] || {}, reports, warnings, updated_at:new Date().toISOString() };
}

async function hotmartAccessToken(env) {
  const u = new URL('https://api-sec-vlc.hotmart.com/security/oauth/token');
  u.searchParams.set('grant_type', 'client_credentials');
  u.searchParams.set('client_id', env.HOTMART_CLIENT_ID);
  u.searchParams.set('client_secret', env.HOTMART_CLIENT_SECRET);
  const basic = env.HOTMART_BASIC.trim();
  const r = await fetch(u.toString(), { method: 'POST', headers: {
    'Authorization': /^Basic\s/i.test(basic) ? basic : `Basic ${basic}`,
    'Content-Type': 'application/json', 'Accept': 'application/json',
  } });
  if (!r.ok) return { ok: false, status: r.status };
  const result = await r.json();
  if (!result.access_token) return { ok: false, status: 502 };
  return { ok: true, access_token: result.access_token };
}

async function hotmartRecentSales(token, days = 30) {
  // Only aggregate analytics. Never expose buyer names, emails or raw transactions.
  const now = Date.now();
  const start = now - days * 86400 * 1000;
  async function fetchStatus(status, maxPages) {
    const items=[]; let next=''; let incomplete=false;
    for (let page=0;page<maxPages;page++) {
      const url = new URL('https://developers.hotmart.com/payments/api/v1/sales/history');
      url.searchParams.set('start_date', String(start));
      url.searchParams.set('end_date', String(now));
      url.searchParams.set('max_results','500');
      if(status)url.searchParams.set('transaction_status',status);
      if(next)url.searchParams.set('page_token', next);
      const res=await fetch(url.toString(),{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
      if(!res.ok)return {ok:false,status:res.status,items:[],incomplete:true};
      const data=await res.json();
      items.push(...(Array.isArray(data.items)?data.items:[]));
      next=data.page_info?.next_page_token || '';
      if (!next) break;
      if (page===maxPages-1) incomplete=true;
    }
    return {ok:true,items,incomplete};
  }
  const approved=await fetchStatus('',4);
  if(!approved.ok)return {ok:false,status:approved.status};
  // Hotmart defaults to APPROVED/COMPLETE; refunds must be queried separately.
  const refundStatuses=['REFUNDED','PARTIALLY_REFUNDED','CHARGEBACK'];
  const refundResults=await Promise.all(refundStatuses.map(status=>fetchStatus(status,2)));
  const refundComplete=refundResults.every(r=>r.ok&&!r.incomplete);
  const refundedIds=new Set();
  for(const r of refundResults)for(const item of r.items)refundedIds.add(item.purchase?.transaction || `${item.product?.id}:${item.purchase?.order_date}`);
  const byCurrency={}; const byProduct={}; const byPayment={}; const byDate={};
  let approvedCount=0;
  const seen=new Set();
  for(const item of approved.items){
    const p=item.purchase || {}; const id=p.transaction || `${item.product?.id}:${p.order_date}`;
    if(seen.has(id))continue; seen.add(id);
    if(!['APPROVED','COMPLETE'].includes(p.status))continue;
    approvedCount++;
    const currency=p.price?.currency_code || 'DESCONOCIDA';
    const price=Number(p.price?.value)||0;
    byCurrency[currency]=(byCurrency[currency]||0)+price;
    const product=String(item.product?.name||'Producto sin nombre').slice(0,100);
    byProduct[product]=(byProduct[product]||0)+1;
    const method=String(p.payment?.type || p.payment?.method || 'No informado').slice(0,50);
    byPayment[method]=(byPayment[method]||0)+1;
    const when=p.approved_date || p.order_date;
    if(when){const d=new Date(Number(when));if(!Number.isNaN(d.getTime())){const key=d.toISOString().slice(0,10);byDate[key]=(byDate[key]||0)+1;}}
  }
  const sorted=entries=>Object.entries(entries).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  return {ok:true,summary:{
    period_days:days, approved:approvedCount,
    refunded:refundComplete?refundedIds.size:null,
    transactions_examined:seen.size,
    incomplete:approved.incomplete || !refundComplete,
    refunds_available:refundComplete,
    gross_by_currency:byCurrency,
    products:sorted(byProduct).slice(0,20).map(x=>({name:x.name,count:x.value})),
    methods:sorted(byPayment),
    trend:Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,count])=>({date,count})),
    note:'Ingresos brutos por moneda. No representan utilidad ni comisión neta. Si la consulta está incompleta, las cifras son parciales.',
    updated_at:new Date().toISOString()
  }};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (err) {
        console.error('Edwin API:', String(err?.message || err));
        return json({ error: 'No se pudo completar la consulta. Revisa la configuración o vuelve a intentarlo.' }, 502);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
