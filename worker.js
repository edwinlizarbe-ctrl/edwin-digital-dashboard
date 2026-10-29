import { manageSuspension, isSuspendedUser } from './admin-suspension.js';
import { handleAdminLifecycle } from './admin-lifecycle.js';
import { adminInvite, adminInviteBlogEditor, adminBlogEditorStatus, acceptInvite } from './admin-invites.js';
import { handleMetaApi } from './meta.js';
import { handleGoogleAdsApi } from './google-ads.js';
import { handleSearchConsoleApi } from './search-console.js';
import { handleGa4OAuthApi, ga4ConnectionForBusiness, ga4OauthToken } from './ga4-oauth.js';
import { handleLeadsApi } from './leads.js';
import { handleBlogGenerator, handleBlogAccess } from './brasper-blog-generator.js';
import { handleEmailMarketingApi } from './email-marketing.js';
import { publicMailRoute,processEmailQueue } from './email-delivery.js';
import { handleAssistantApi } from './assistant-api.js';
import { handleFeaturesApi, ensureBusinessFeature } from './feature-access.js';
import { handleZernioApi } from './zernio.js';
import { handleSignup, handleOnboardingBusiness } from './signup.js';
import { handleRequestReset, handleResetPassword } from './password-reset.js';
import { handleSiteCreate } from './site-registration.js';
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
  return [cookie('ed_access', '', 0), cookie('ed_refresh', '', 0), cookie('ed_meta_pilot', '', 0), cookie('ed_meta_pending', '', 0)];
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
  if(profile[0].role!=='admin' && await isSuspendedUser(env,user.id))return {invalid:true,cookies:clearCookies()};
  return { user: { id: user.id, email: user.email, role: profile[0].role, business_preferences: user.user_metadata?.ed_business_preferences_v1||{} }, metadata: user.user_metadata||{}, access, cookies };
}

function companyJsonRequest(req,limit=120000){
  return !corsPostDenied(req) && (req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json') &&
    (!req.headers.get('Content-Length')||Number(req.headers.get('Content-Length'))<=limit);
}
async function companyParse(req,limit=120000){
  const body=await req.text();if(body.length>limit)throw Error('Archivo demasiado grande.');
  return JSON.parse(body);
}
async function companyPatch(env,session,table,filter,changes){
  const endpoint=String(env.SUPABASE_URL).replace(/\/$/,'')+'/rest/v1/'+table+'?'+filter;
  const res=await fetch(endpoint,{method:'PATCH',headers:{...supaHeaders(env,session.access),
    'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(changes)});
  if(!res.ok)throw Error('Supabase no permite editar este registro (HTTP '+res.status+').');
  const rows=await res.json().catch(()=>[]);
  if(!rows.length)throw Error('No se encontró un registro editable; revisa los permisos de tu empresa.');
  return rows[0];
}

function requestedPeriod(url) {
  const p = url.searchParams.get('period');
  if (['today','yesterday','3','7','30','90','365'].includes(p)) return p;
  const days = url.searchParams.get('days'); // Backwards-compatible with V3.1 links.
  if (['7','30','90','365'].includes(days)) return days;
  return '30';
}
function periodRangeForHotmart(period) {
  const now=Date.now();
  // Edwin Digital operates in Peru (UTC-05, no DST). Calendar filters use local days.
  const localOffset=5*60*60*1000;
  const todayStart=Math.floor((now-localOffset)/86400000)*86400000+localOffset;
  if(period==='today')return {start:todayStart,end:now};
  if(period==='yesterday')return {start:todayStart-86400000,end:todayStart-1};
  return {start:now-Number(period)*86400000,end:now};
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
  if (path === '/api/auth/accept-invite') return acceptInvite(req,env);
  if (path === '/api/auth/signup') return handleSignup(req, env);
  if (path === '/api/auth/request-reset') return handleRequestReset(req, env);
  if (path === '/api/auth/reset-password') return handleResetPassword(req, env);
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
  // Dedicated least-privilege account: fail closed on every other authenticated API.
  // This runs BEFORE all business, sales, analytics, contacts and integration routes.
  if(s.user.role==='blog_editor'){
    if(String(s.user.email||'').toLowerCase()!=='marketing.brasper@gmail.com')
      return json({error:'Perfil editorial no autorizado.'},403,s.cookies);
    if(path==='/api/me' && method==='GET')return json({user:s.user},200,s.cookies);
    if(path==='/api/brasper/blog/access')return handleBlogAccess(req,env,s);
    if(path==='/api/brasper/blog/generate')return handleBlogGenerator(req,env,s);
    return json({error:'Este perfil solo puede utilizar Blog de Brásper.'},403,s.cookies);
  }
  if(path==='/api/admin/blog-editor/status')return adminBlogEditorStatus(req,env,s);
  if(path==='/api/admin/invite-blog-editor')return adminInviteBlogEditor(req,env,s);
  if(path==='/api/admin/accounts/suspension')return manageSuspension(req,env,s);
  if(path==='/api/admin/lifecycle')return handleAdminLifecycle(req,env,s);
  if(path==='/api/admin/invite')return adminInvite(req,env,s);
  if(path==='/api/client/features'||path.startsWith('/api/admin/business-features'))return handleFeaturesApi(req,env,s);
  if (path.startsWith('/api/zernio/')) return handleZernioApi(req, env, s);
  if (path.startsWith('/api/meta/')) return handleMetaApi(req, env, s);
  if (path.startsWith('/api/google-ads/')) return handleGoogleAdsApi(req, env, s);
  if (path.startsWith('/api/search-console/')) return handleSearchConsoleApi(req, env, s);
  if (path.startsWith('/api/ga4/') && path !== '/api/ga4/report') return handleGa4OAuthApi(req, env, s);
  if (path === '/api/crm/leads' || path === '/api/crm/leads/import') return handleLeadsApi(req, env, s);
  if (path === '/api/brasper/blog/generate') return handleBlogGenerator(req, env, s);
  if (path === '/api/email-marketing') return handleEmailMarketingApi(req, env, s);
  if (path.startsWith('/api/assistant/')) return handleAssistantApi(req, env, s);
  if (path === '/api/onboarding/business') return handleOnboardingBusiness(req, env, s);
  if (path === '/api/me' && method === 'GET') return json({ user: s.user }, 200, s.cookies);
  if (path === '/api/auth/change-password' && method === 'POST') {
    if (corsPostDenied(req)) return json({ error: 'Origen no autorizado.' }, 403, s.cookies);
    if (!(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Se requiere JSON.' }, 415, s.cookies);
    const text=await req.text();
    if (text.length > 2048) return json({ error: 'Solicitud demasiado grande.' }, 413, s.cookies);
    let input;
    try { input = JSON.parse(text); } catch { return json({ error: 'Solicitud no válida.' }, 400, s.cookies); }
    const currentPassword=input?.currentPassword, newPassword=input?.newPassword;
    if (typeof currentPassword!=='string' || currentPassword.length<1 || currentPassword.length>512 || typeof newPassword!=='string' || newPassword.length<10 || newPassword.length>128) {
      return json({ error: 'Completa tu contraseña actual y una nueva de 10 a 128 caracteres.' }, 400, s.cookies);
    }
    if (newPassword === currentPassword) return json({ error: 'La contraseña nueva debe ser diferente de la anterior.' }, 400, s.cookies);
    // Recheck the old password. No privileged Supabase key or admin operation is used.
    const verify=await supaAuth(env, 'token?grant_type=password', {
      method:'POST',body:JSON.stringify({email:s.user.email,password:currentPassword}),
    });
    if (!verify.ok) return json({ error: 'La contraseña actual es incorrecta.' }, 403, s.cookies);
    const verified=await verify.json();
    if (verified.user?.id !== s.user.id) return json({ error: 'No se pudo verificar la identidad.' }, 403, s.cookies);
    const updated=await supaAuth(env, 'user', {
      method:'PUT', headers:{Authorization:`Bearer ${s.access}`}, body:JSON.stringify({password:newPassword}),
    });
    if (!updated.ok) {
      const message=await updated.json().catch(()=>({}));
      return json({error:updated.status===429?'Demasiados intentos. Vuelve a intentarlo más tarde.':
        `Supabase no aceptó el cambio: ${String(message.msg || message.error_description || message.message || 'comprueba la política de contraseñas.').slice(0,130)}`},updated.status>=500?502:400,s.cookies);
    }
    // Force a new login with the newly chosen password; cookies remain HttpOnly.
    return json({ok:true,login_required:true},200,clearCookies());
  }


  if(path==='/api/auth/change-email')return json({error:'El correo electrónico de acceso no se puede modificar desde Edwin CRM.'},403,s.cookies);

  if(path==='/api/company/preferences' && method==='POST') {
    if(!companyJsonRequest(req))return json({error:'Solicitud no autorizada o demasiado grande.'},403,s.cookies);
    let input;try{input=await companyParse(req);}catch{return json({error:'Perfil inválido.'},400,s.cookies);}
    const id=input?.business_id;
    if(s.user.role==='admin'||!isUuid(id))return json({error:'Empresa no autorizada.'},403,s.cookies);
    const businesses=await supaRest(env,'businesses?select=id,name&id=eq.'+id+'&limit=1',s.access);
    if(!businesses.length)return json({error:'No tienes acceso a esta empresa.'},403,s.cookies);
    const display_name=businesses[0].name,
      category=String(input.category||'').trim(),country=String(input.country||'').trim();
    if(display_name.length<2||display_name.length>80||category.length>80||country.length>80)
      return json({error:'El nombre, sector o país tienen un formato incorrecto.'},400,s.cookies);
    const old=s.user.business_preferences && typeof s.user.business_preferences==='object'?
      s.user.business_preferences:{};
    // Logo bytes must never enter Supabase Auth metadata: the resulting JWT must fit browser cookies.
    const preferences={...old,[id]:{display_name,category,country}};
    if(Object.keys(preferences).length>30)return json({error:'Se alcanzó el límite de perfiles personalizados.'},400,s.cookies);
    const changed=await supaAuth(env,'user',{method:'PUT',headers:{Authorization:'Bearer '+s.access},
      body:JSON.stringify({data:{...s.metadata,ed_business_preferences_v1:preferences}})});
    if(!changed.ok)return json({error:'No se pudo guardar el perfil de esta cuenta.'},502,s.cookies);
    return json({ok:true,profile:preferences[id],scope:'user'},200,s.cookies);
  }
  // Customer-facing names are fixed; only the superadmin can authorize a correction.
  if(path==='/api/company/name' && method==='PATCH')
    return json({error:'El nombre de la empresa solo lo modifica el administrador.'},403,s.cookies);

  if(path==='/api/admin/business-name' && method==='PATCH') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del administrador.'},403,s.cookies);
    if(!companyJsonRequest(req,1200))return json({error:'Solicitud no permitida.'},403,s.cookies);
    let input;try{input=await companyParse(req,1200);}catch{return json({error:'Datos inválidos.'},400,s.cookies);}
    const id=String(input?.business_id||''),name=String(input?.name||'').trim().replace(/\s+/g,' ');
    if(!isUuid(id)||name.length<2||name.length>80||/[<>\x00-\x1f]/.test(name))
      return json({error:'Nombre de empresa inválido.'},400,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({error:'Falta conexión administrativa.'},503,s.cookies);
    const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
    const checked=await fetch(base+'/rest/v1/businesses?select=id,slug&id=eq.'+id+'&limit=1',{headers});
    if(!checked.ok)return json({error:'No se pudo verificar la empresa.'},502,s.cookies);
    const current=(await checked.json())[0];
    if(!current)return json({error:'Empresa inexistente.'},404,s.cookies);
    if(['edwin-digital','brasper'].includes(current.slug))return json({error:'Las empresas internas están protegidas.'},403,s.cookies);
    const updated=await fetch(base+'/rest/v1/businesses?id=eq.'+id,{
      method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({name})
    });
    if(!updated.ok)return json({error:'No se pudo cambiar el nombre.'},502,s.cookies);
    const rows=await updated.json();
    if(rows.length!==1)return json({error:'Supabase no confirmó el cambio.'},502,s.cookies);
    return json({ok:true,name:rows[0].name},200,s.cookies);
  }
  if(path==='/api/sites/create') return handleSiteCreate(req,env,s);
  if(path==='/api/sites/edit' && method==='PATCH') {
    if(!companyJsonRequest(req,3000))return json({error:'Solicitud no permitida.'},403,s.cookies);
    let x;try{x=await companyParse(req,3000);}catch{return json({error:'Datos inválidos.'},400,s.cookies);}
    const id=x.business_id,sid=x.site_id,name=String(x.name||'').trim(),website=String(x.url||'').trim();
    let validURL=false;try{const u=new URL(website);validURL=['http:','https:'].includes(u.protocol)&&
      !!u.hostname.includes('.')&&!u.username&&!u.password&&website.length<=300;}catch{}
    if(s.user.role==='admin'||!isUuid(id)||!isUuid(sid)||name.length<2||name.length>100||!validURL)
      return json({error:'Comprueba el nombre y la dirección URL del sitio.'},400,s.cookies);
    const allowed=await supaRest(env,'sites?select=id&business_id=eq.'+id+'&id=eq.'+sid+'&limit=1',s.access);
    if(!allowed.length)return json({error:'No tienes acceso a este sitio.'},403,s.cookies);
    try{const row=await companyPatch(env,s,'sites','id=eq.'+sid+'&business_id=eq.'+id,{name,url:website});
      return json({ok:true,site:{id:row.id,name:row.name,url:row.url}},200,s.cookies);
    }catch(e){return json({error:e.message},403,s.cookies);}
  }

  // Solo la cuenta administradora puede ver correos o iniciar recuperaciones.
  // No existe un endpoint para consultar contraseñas en texto plano.
  if(path==='/api/admin/accounts/email-history' && method==='GET') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del superadministrador.'},403,s.cookies);
    const id=url.searchParams.get('user_id')||'';
    if(!isUuid(id))return json({error:'Usuario no válido.'},400,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({configured:false,changes:[],reason:'Configura la clave administrativa en Cloudflare.'},200,s.cookies);
    const base=String(env.SUPABASE_URL).replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
    const account=await fetch(base+'/rest/v1/profiles?select=id,role&id=eq.'+id+'&limit=1',{headers});
    if(!account.ok)return json({error:'No se pudo confirmar el usuario.'},502,s.cookies);
    const verified=await account.json();
    if(!verified.length||verified[0].role==='admin')return json({error:'Usuario no autorizado para esta consulta.'},403,s.cookies);
    const result=await fetch(base+'/rest/v1/ed_email_change_audit?select=previous_email,new_email,changed_at&user_id=eq.'+id+'&order=changed_at.desc&limit=50',{headers});
    if(!result.ok)return json({configured:false,changes:[],reason:'La auditoría todavía no está activada en Supabase.'},200,s.cookies);
    return json({configured:true,changes:await result.json()},200,s.cookies);
  }

  // Read-only administrator directory. Company email is a linked user's email, not an invented corporate email.
  if(path==='/api/admin/directory' && method==='GET') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del superadministrador.'},403,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({error:'No está configurada la conexión administrativa.'},503,s.cookies);
    const base=String(env.SUPABASE_URL).replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
    const endpoints=[
      '/rest/v1/businesses?select=id,name,slug,created_at&order=name.asc&limit=500',
      '/rest/v1/business_members?select=*&limit=2000',
      '/rest/v1/profiles?select=id,role,email&limit=2000',
      '/auth/v1/admin/users?per_page=200&page=1'
    ];
    const responses=await Promise.all(endpoints.map(p=>fetch(base+p,{headers})));
    const failed=responses.findIndex(r=>!r.ok);
    if(failed>=0){console.error('Directory upstream error',failed,responses[failed].status);return json({error:'No se pudo consultar el directorio administrativo.',source:['businesses','business_members','profiles','auth'][failed]},502,s.cookies);}
    const [businesses,members,profiles,auth]=await Promise.all(responses.map(r=>r.json()));
    const profileMap=new Map((Array.isArray(profiles)?profiles:[]).map(p=>[p.id,p]));
    const users=(Array.isArray(auth.users)?auth.users:[]).map(u=>({
      id:u.id,email:u.email||profileMap.get(u.id)?.email||'',
      role:profileMap.get(u.id)?.role||'Sin asignar',
      created_at:u.created_at||null,last_sign_in_at:u.last_sign_in_at||null,
      confirmed_at:u.email_confirmed_at||null
    }));
    const allowed=new Set((Array.isArray(businesses)?businesses:[]).map(b=>b.id));
    const memberships=(Array.isArray(members)?members:[])
      .filter(m=>allowed.has(m.business_id)&&!!m.user_id)
      .map(m=>({business_id:m.business_id,user_id:m.user_id}));
    return json({businesses:Array.isArray(businesses)?businesses:[],
      users,memberships,truncated:auth.users?.length>=200},200,s.cookies);
  }

  if(path==='/api/admin/accounts' && method==='GET') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del superadministrador.'},403,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({configured:false,accounts:[],reason:'Falta SUPABASE_SERVICE_ROLE_KEY en Cloudflare para listar las cuentas.'},200,s.cookies);
    const base=String(env.SUPABASE_URL).replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
    const [pResponse,uResponse,mResponse,bResponse]=await Promise.all([
      fetch(base+'/rest/v1/profiles?select=id,role,email&limit=1000',{headers}),
      fetch(base+'/auth/v1/admin/users?per_page=200&page=1',{headers}),
      fetch(base+'/rest/v1/business_members?select=user_id,business_id&limit=2000',{headers}),
      fetch(base+'/rest/v1/businesses?select=id,name&limit=1000',{headers})
    ]);
    if(!pResponse.ok||!uResponse.ok||!mResponse.ok||!bResponse.ok){
      const failed=!pResponse.ok?'perfiles':!uResponse.ok?'Supabase Auth':!mResponse.ok?'vínculos de empresas':'nombres de empresas';
      const status=!pResponse.ok?pResponse.status:!uResponse.ok?uResponse.status:!mResponse.ok?mResponse.status:bResponse.status;
      console.error('Admin accounts upstream failed:',failed,status);
      return json({error:'No se pudo consultar '+failed+' (HTTP '+status+'). Verifica la clave administrativa y los permisos de Supabase.',source:failed},502,s.cookies);
    }
    const [profiles,auth,members,businesses]=await Promise.all([pResponse.json(),uResponse.json(),mResponse.json(),bResponse.json()]);
    const businessNames=new Map((Array.isArray(businesses)?businesses:[]).map(b=>[b.id,b.name]));
    const memberships=new Map();
    for(const m of Array.isArray(members)?members:[]){
      if(!memberships.has(m.user_id))memberships.set(m.user_id,[]);
      const name=businessNames.get(m.business_id);
      if(name)memberships.get(m.user_id).push(name);
    }
    const known=new Map((Array.isArray(profiles)?profiles:[]).map(p=>[p.id,p]));
    const users=Array.isArray(auth.users)?auth.users:[];
    const accounts=users.filter(u=>known.has(u.id)&&known.get(u.id).role!=='admin').map(u=>({
      id:u.id,email:u.email||known.get(u.id).email||'',role:known.get(u.id).role,
      business_names:memberships.get(u.id)||[],
      created_at:u.created_at||null,last_sign_in_at:u.last_sign_in_at||null,banned_until:u.banned_until||null
    }));
    return json({configured:true,accounts,truncated:users.length>=200},200,s.cookies);
  }

  if(path==='/api/admin/accounts/create-client' && method==='POST') {
    if(s.user.role!=='admin')return json({error:'Solo el administrador puede crear clientes.'},403,s.cookies);
    if(!companyJsonRequest(req,1500))return json({error:'Solicitud no autorizada.'},403,s.cookies);
    let input;try{input=await companyParse(req,1500);}catch{return json({error:'Solicitud inválida.'},400,s.cookies);}
    const email=String(input?.email||'').trim().toLowerCase();
    const companyName=String(input?.company_name||'').trim().replace(/\s+/g,' ');
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({error:'Escribe un correo válido.'},400,s.cookies);
    if(companyName.length<2||companyName.length>80||/[<>\x00-\x1f]/.test(companyName))
      return json({error:'Ingresa un nombre de empresa de 2 a 80 caracteres.'},400,s.cookies);
    if(['edwin digital','brasper','brásper'].includes(companyName.toLocaleLowerCase('es-PE')))
      return json({error:'Ese nombre está reservado para una empresa interna.'},409,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({error:'No está configurada la conexión administrativa.'},503,s.cookies);
    const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
    // Each new client receives a NEW business. Existing Edwin Digital/Brásper records are untouched.
    const slugBase=companyName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,52)||'cliente';
    const slug=slugBase+'-'+crypto.randomUUID().split('-')[0];
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const temporaryPassword=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
    let newUser='',newBusiness='';
    try{
      const prior=await fetch(base+'/rest/v1/profiles?select=id&email=eq.'+encodeURIComponent(email)+'&limit=1',{headers});
      if(!prior.ok)throw new Error('profiles query failed');
      if((await prior.json()).length)return json({error:'Este correo ya tiene una cuenta. No se modificó su empresa.'},409,s.cookies);
      const made=await fetch(base+'/auth/v1/admin/users',{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({email,password:temporaryPassword,email_confirm:true})
      });
      const user=await made.json().catch(()=>({}));
      if(!made.ok)return json({error:made.status===409||made.status===422?'Este correo ya está registrado.':'No se pudo crear el usuario.'},made.status===409||made.status===422?409:502,s.cookies);
      newUser=user.id||user.user?.id||'';
      if(!isUuid(newUser))throw new Error('Auth created user without verifiable ID');
      const madeBusiness=await fetch(base+'/rest/v1/businesses',{
        method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({name:companyName,slug})
      });
      if(!madeBusiness.ok)throw new Error('Business creation rejected');
      const inserted=await madeBusiness.json().catch(()=>[]);
      newBusiness=inserted[0]?.id||'';
      if(!isUuid(newBusiness))throw new Error('Business created without verifiable ID');
      const attached=await fetch(base+'/rest/v1/business_members',{
        method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({business_id:newBusiness,user_id:newUser})
      });
      if(!attached.ok)throw new Error('Business membership rejected');
      const verify=await fetch(base+'/rest/v1/business_members?select=business_id&business_id=eq.'+newBusiness+'&user_id=eq.'+newUser+'&limit=1',{headers});
      if(!verify.ok||(await verify.json()).length!==1)throw new Error('Business membership was not confirmed');
      return json({ok:true,email,temporary_password:temporaryPassword,business_name:companyName},200,s.cookies);
    }catch(error){
      console.error('Client provisioning failed:',String(error?.message||error));
      // Roll back only records generated by this request. Never delete preexisting companies or users.
      if(newUser){
        const removed=await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(newUser),{method:'DELETE',headers}).catch(()=>null);
        if(!removed?.ok)console.error('New client auth rollback unsuccessful');
      }
      if(newBusiness){
        const removed=await fetch(base+'/rest/v1/businesses?id=eq.'+encodeURIComponent(newBusiness),{method:'DELETE',headers}).catch(()=>null);
        if(!removed?.ok)console.error('New client business rollback unsuccessful');
      }
      return json({error:'No se completó la creación. No entregues credenciales; comprueba el directorio antes de reintentar.'},502,s.cookies);
    }
  }
  if(path==='/api/admin/accounts/temporary-password' && method==='POST') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del superadministrador.'},403,s.cookies);
    if(!companyJsonRequest(req,1500))return json({error:'Solicitud no autorizada.'},403,s.cookies);
    let input;try{input=await companyParse(req,1500);}catch{return json({error:'Solicitud inválida.'},400,s.cookies);}
    const id=String(input?.user_id||'');
    if(!isUuid(id))return json({error:'Usuario inválido.'},400,s.cookies);
    const key=env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key)return json({error:'Configura SUPABASE_SERVICE_ROLE_KEY en Cloudflare para restablecer credenciales.'},503,s.cookies);
    const base=String(env.SUPABASE_URL).replace(/\/$/,'');
    const headers={apikey:key,Authorization:'Bearer '+key,Accept:'application/json'};
    const [pr,ur]=await Promise.all([
      fetch(base+'/rest/v1/profiles?select=id,role&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers}),
      fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(id),{headers})
    ]);
    if(!pr.ok||!ur.ok)return json({error:'No fue posible comprobar la cuenta.'},502,s.cookies);
    const profiles=await pr.json(),user=await ur.json();
    if(!Array.isArray(profiles)||profiles.length!==1||profiles[0].role==='admin'||user.id!==id||!user.email)
      return json({error:'No puedes cambiar las credenciales de esta cuenta.'},403,s.cookies);
    // Contraseña aleatoria, generada en el servidor y mostrada solo en esta respuesta.
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const temporaryPassword=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
    const changed=await fetch(base+'/auth/v1/admin/users/'+encodeURIComponent(id),{
      method:'PUT',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({password:temporaryPassword})
    });
    if(!changed.ok)return json({error:'Supabase no pudo restablecer la contraseña del cliente.'},502,s.cookies);
    return json({ok:true,email:user.email,temporary_password:temporaryPassword,
      message:'Contraseña temporal generada. Entrégala al cliente por un canal seguro y pídele cambiarla al ingresar.'},200,s.cookies);
  }
  if(path==='/api/admin/integrations/health' && method==='GET') {
    if(s.user.role!=='admin')return json({error:'Acceso exclusivo del administrador.'},403,s.cookies);
    const currentOrigin=new URL(req.url).origin;
    const automatic=!env.META_REDIRECT_URI && currentOrigin==='https://edwin-digital-dashboard.edwinlizarbe.workers.dev';
    const redirect=env.META_REDIRECT_URI||(automatic?currentOrigin+'/api/meta/callback':'');
    let callback=false;
    try{const u=new URL(redirect);callback=u.protocol==='https:'&&u.origin===currentOrigin&&u.pathname==='/api/meta/callback'&&!u.search&&!u.hash;}catch{}
    const checks={app_id:!!env.META_APP_ID,app_secret:!!env.META_APP_SECRET,
      session_key:/^[0-9a-fA-F]{64}$/.test(env.META_SESSION_KEY||''),redirect:callback};
    // Only expose booleans and callback URLs. Never return credentials or tokens.
    const ga4Checks={
      client_id:!!env.GOOGLE_ANALYTICS_CLIENT_ID,
      client_secret:!!env.GOOGLE_ANALYTICS_CLIENT_SECRET,
      encryption_key:/^[a-f0-9]{64}$/i.test(env.GOOGLE_ANALYTICS_ENCRYPTION_KEY||'')
    };
    const adsChecks={
      client_id:!!env.GOOGLE_ADS_CLIENT_ID,
      client_secret:!!env.GOOGLE_ADS_CLIENT_SECRET,
      encryption_key:/^[a-f0-9]{64}$/i.test(env.GOOGLE_ADS_ENCRYPTION_KEY||'')
    };
    return json({
      meta:{configured:Object.values(checks).every(Boolean),checks,automatic_redirect:automatic,callback_url:callback?redirect:null},
      ga4:{service_account:!!env.GOOGLE_SERVICE_ACCOUNT_JSON,oauth_configured:Object.values(ga4Checks).every(Boolean),checks:ga4Checks,callback_url:currentOrigin+'/api/ga4/callback'},
      google_ads:{oauth_configured:Object.values(adsChecks).every(Boolean),checks:adsChecks,callback_url:currentOrigin+'/api/google-ads/callback'}
    },200,s.cookies);
  }

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
    const period = requestedPeriod(url);
    if (!isUuid(businessId) || (siteId && !isUuid(siteId))) return json({ error: 'Selecciona una empresa y un sitio válidos.' }, 400, s.cookies);
    if(!await ensureBusinessFeature(env,s,businessId,'ga4'))return json({error:'Google Analytics no está habilitado para esta empresa.'},403,s.cookies);
    // Resolve the OAuth connection only after verifying business membership through RLS.
    const connection=await ga4ConnectionForBusiness(env,s,businessId);
    let site=null;
    if(siteId){
      const allowed=await supaRest(env,'sites?select=id,name,ga4_property_id&business_id=eq.'+encodeURIComponent(businessId)+'&id=eq.'+encodeURIComponent(siteId)+'&limit=1',s.access);
      site=allowed[0]||null;
      if(!site)return json({error:'Este sitio no pertenece a tu cuenta.'},403,s.cookies);
    }
    // A selected GA4 property always belongs to the authenticated business connection.
    // Existing service-account reports remain available for previously configured sites.
    const selected=connection?.selected_property_id||null;
    const property=selected||(site?.ga4_property_id||'');
    if(!property||!/^[0-9]{1,30}$/.test(property))
      return json({configured:false,reason:connection?'Elige una propiedad de Google Analytics en Integraciones.':'Conecta Google Analytics desde Integraciones y selecciona tu propiedad.'},200,s.cookies);
    if(!selected&&!env.GOOGLE_SERVICE_ACCOUNT_JSON)
      return json({configured:false,reason:'Conecta tu cuenta desde Integraciones para autorizar el acceso a esta propiedad.'},200,s.cookies);
    const token=selected?await ga4OauthToken(env,connection):null;
    const report=await ga4FullReport(env,property,period,token);
    return json({...report,configured:true,site:{id:site?.id||'',name:site?.name||connection?.selected_property_name||'Google Analytics'},period},200,s.cookies);
  }
  if (path === '/api/hotmart/summary' && method === 'GET') {
    // The previous Hotmart pilot used global credentials and cannot be attributed to a customer.
    return json({ error: 'Hotmart requiere una conexión autorizada e independiente por empresa. El piloto anterior está deshabilitado.' }, 409, s.cookies);
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
async function ga4FullReport(env, property, periodKey, oauthToken = null) {
  const token = oauthToken || await googleAccessToken(env);
  const days=Number(periodKey)||30;
  const period = periodKey==='today'?[{startDate:'today',endDate:'today'}]:periodKey==='yesterday'?[{startDate:'yesterday',endDate:'yesterday'}]:[{startDate: `${days-1}daysAgo`, endDate:'today'}];
  const priorPeriod = periodKey==='today'?[{startDate:'yesterday',endDate:'yesterday'}]:periodKey==='yesterday'?[{startDate:'2daysAgo',endDate:'2daysAgo'}]:[{startDate: `${days*2-1}daysAgo`, endDate: `${days}daysAgo`}];
  // Google Analytics Data API accepts a maximum of 10 metrics per runReport.
  // Split the 13 summary metrics into two independent requests per period.
  // Without this, the summary request fails while the daily trend succeeds,
  // causing the client to mistakenly display zeros for users and sessions.
  const coreMetrics = ['totalUsers','activeUsers','newUsers','sessions','engagedSessions','engagementRate','screenPageViews','eventCount','keyEvents'];
  const extraMetrics = ['averageSessionDuration','bounceRate','sessionKeyEventRate','totalRevenue'];
  const definitions = {
    summary: {dims:[], metrics:coreMetrics, limit:1},
    summary_extra: {dims:[], metrics:extraMetrics, limit:1},
    previous: {dims:[], metrics:coreMetrics, limit:1, previous:true},
    previous_extra: {dims:[], metrics:extraMetrics, limit:1, previous:true},
    trend: {dims:['date'], metrics:['sessions','totalUsers','screenPageViews','keyEvents'], limit:370, sort:'date'},
    trend_detail: {dims:['date'], metrics:['activeUsers','newUsers','engagedSessions','engagementRate','bounceRate','eventCount','averageSessionDuration','sessionKeyEventRate'], limit:370, sort:'date'},
    channels: {dims:['sessionDefaultChannelGroup'],metrics:['sessions','totalUsers','keyEvents'],limit:12},
    sources: {dims:['sessionSourceMedium'],metrics:['sessions','totalUsers'],limit:12},
    pages: {dims:['pagePath'],metrics:['screenPageViews','totalUsers'],limit:12},
    devices: {dims:['deviceCategory'],metrics:['sessions','totalUsers'],limit:8},
    countries: {dims:['country'],metrics:['totalUsers','sessions'],limit:12},
    cities: {dims:['city'],metrics:['totalUsers'],limit:12},
    events: {dims:['eventName'],metrics:['eventCount','keyEvents'],limit:15},
    campaigns: {dims:['sessionCampaignName'],metrics:['sessions','keyEvents'],limit:20},
    landing: {dims:['landingPage'],metrics:['sessions','keyEvents'],limit:15},
    browsers: {dims:['browser'],metrics:['totalUsers'],limit:10},
  };
  const run = async ([kind, definition]) => {
    const {dims, metrics, limit, sort, previous} = definition;
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
      method:'POST',
      headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      body:JSON.stringify({dateRanges:previous ? priorPeriod : period,dimensions:dims.map(name=>({name})),metrics:metrics.map(name=>({name})),limit:String(limit),orderBys:[sort?{dimension:{dimensionName:sort}}:{metric:{metricName:metrics[0]},desc:true}]})
    });
    if (!r.ok) { const err=await r.json().catch(()=>({})); throw new Error(`GA4 ${kind}: ${String(err.error?.message || r.status).slice(0,180)}`); }
    return unpackGaRows(await r.json(), dims, metrics);
  };
  // GA4 limits concurrent API requests per property. Query in small batches to
  // avoid rate-limit failures while keeping individual sections independent.
  const reportJobs = Object.entries(definitions);
  const results = [];
  for (let i = 0; i < reportJobs.length; i += 4) {
    const batch = await Promise.allSettled(reportJobs.slice(i, i + 4).map(run));
    results.push(...batch);
  }
  const reports = {}; const warnings=[];
  Object.keys(definitions).forEach((key, idx) => {
    if (results[idx].status==='fulfilled') reports[key] = results[idx].value;
    else { reports[key]=[]; warnings.push(results[idx].reason.message); }
  });
  if (!results.some(r=>r.status==='fulfilled')) throw new Error('GA4 no devolvió informes. Comprueba permisos, API y propiedad.');
  const metrics = { ...(reports.summary[0] || {}), ...(reports.summary_extra[0] || {}) };
  const priorMetrics = { ...(reports.previous[0] || {}), ...(reports.previous_extra[0] || {}) };
  const previous_metrics = Object.keys(priorMetrics).length ? priorMetrics : null;
  delete reports.previous;
  delete reports.previous_extra;
  delete reports.summary_extra;
  return { property_id:property, metrics, previous_metrics, reports, warnings, updated_at:new Date().toISOString() };
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

async function hotmartRecentSales(token, period = '30') {
  // Only aggregate analytics. Never expose buyer names, emails or raw transactions.
  const {start,end:now} = periodRangeForHotmart(period);
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
    period, approved:approvedCount,
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
    if (url.pathname.startsWith('/api/email-marketing/unsubscribe') || url.pathname==='/api/email-marketing/webhook') {
      try { return await publicMailRoute(request,env); } catch(e) { console.error('Email public route failed',String(e?.message||e));return json({error:'No se pudo completar la solicitud.'},503); }
    }
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (err) {
        console.error('Edwin API:', String(err?.message || err));
        return json({ error: 'No se pudo completar la consulta. Revisa la configuración o vuelve a intentarlo.' }, 502);
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(processEmailQueue(env,'https://edwin-digital-dashboard.edwinlizarbe.workers.dev'));}
};
