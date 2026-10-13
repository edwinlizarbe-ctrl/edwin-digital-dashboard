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
  if (path === '/api/hotmart/summary' && method === 'GET') {
    // Pilot credentials belong ONLY to Edwin Digital. No customer may query them.
    if (s.user.role !== 'admin') return json({ error: 'Acceso restringido al administrador.' }, 403, s.cookies);
    if (!env.HOTMART_CLIENT_ID || !env.HOTMART_CLIENT_SECRET || !env.HOTMART_BASIC) {
      return json({ error: 'Faltan las credenciales privadas de Hotmart en Cloudflare.' }, 503, s.cookies);
    }
    const credentials = await hotmartAccessToken(env);
    if (!credentials.ok) return json({ error: `Hotmart no autorizó las credenciales (HTTP ${credentials.status}). Revisa las variables en Cloudflare.` }, 502, s.cookies);
    const data = await hotmartRecentSales(credentials.access_token);
    if (!data.ok) return json({ error: `Hotmart rechazó la consulta de ventas (HTTP ${data.status}). Verifica el acceso a la API de Ventas.` }, 502, s.cookies);
    return json(data.summary, 200, s.cookies);
  }
  return json({ error: 'Ruta no encontrada.' }, 404, s.cookies);
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

async function hotmartRecentSales(token) {
  // Read only; max 500 recent records. Never return buyer PII or raw Hotmart JSON.
  const end = Date.now();
  const start = end - 30 * 86400 * 1000;
  const url = new URL('https://developers.hotmart.com/payments/api/v1/sales/history');
  url.searchParams.set('start_date', String(start));
  url.searchParams.set('end_date', String(end));
  url.searchParams.set('max_results', '500');
  const response = await fetch(url.toString(), { headers: {
    'Authorization': `Bearer ${token}`, 'Accept': 'application/json',
  } });
  if (!response.ok) return { ok: false, status: response.status };
  const payload = await response.json();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const byCurrency = {};
  const byProduct = {};
  let approved = 0; let refunded = 0;
  for (const item of items) {
    const purchase = item.purchase || {};
    const status = purchase.status;
    if (status === 'APPROVED' || status === 'COMPLETE') {
      approved++;
      const currency = purchase.price?.currency_code || 'SIN_MONEDA';
      const price = Number(purchase.price?.value) || 0;
      byCurrency[currency] = (byCurrency[currency] || 0) + price;
      const productName = String(item.product?.name || 'Producto sin nombre');
      byProduct[productName] = (byProduct[productName] || 0) + 1;
    }
    if (['REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK'].includes(status)) refunded++;
  }
  return { ok: true, summary: {
    period_days: 30,
    transactions_examined: items.length,
    incomplete: Boolean(payload.page_info?.next_page_token),
    approved, refunded,
    gross_by_currency: byCurrency,
    products: Object.entries(byProduct).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count })),
    note: 'Importes brutos de transacciones aprobadas, no ganancias netas ni comisiones. Solo los primeros 500 registros del período si hubiera más.',
  } };
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
