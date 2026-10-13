/**
 * Meta Ads pilot — per-tenant, per-user session, read-only.
 * OAuth handled entirely on Cloudflare Worker. No third-party intermediary.
 * Encrypted HttpOnly cookies avoid database/schema changes for the first test.
 * Pilot tradeoff: one encrypted browser connection per signed-in user and authorized business.
 * Development-mode Meta apps require explicitly permitted testers/admins.
 */
const META_COOKIE = 'ed_meta_pilot';
const META_PENDING = 'ed_meta_pending';
const META_PERIODS = new Set(['today', 'yesterday', '7', '30', '90', '365']);

function metaConfig(env, requestOrigin='') {
  const version = /^v\d+\.\d+$/.test(env.META_GRAPH_VERSION || '') ? env.META_GRAPH_VERSION : 'v24.0';
  // The deployed worker may safely derive its own callback address. This is not
  // an OAuth credential and doesn't bypass the Facebook Login allowlist.
  const canonicalOrigin='https://edwin-digital-dashboard.edwinlizarbe.workers.dev';
  const automatic = !env.META_REDIRECT_URI && requestOrigin===canonicalOrigin;
  const redirect = env.META_REDIRECT_URI || (automatic?canonicalOrigin+'/api/meta/callback':'');
  let validRedirect = false;
  try {
    const u = new URL(redirect);
    validRedirect = u.protocol === 'https:' && u.pathname === '/api/meta/callback' && !u.search && !u.hash &&
      (requestOrigin ? u.origin===requestOrigin : true);
  } catch { /* Explicit configuration may be needed for another domain. */ }
  return {
    version, redirect, automatic,
    ready: !!(env.META_APP_ID && env.META_APP_SECRET && /^[0-9a-fA-F]{64}$/.test(env.META_SESSION_KEY || '') && validRedirect),
  };
}
function metaCookie(name, value, age) {
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
}
function clearMetaCookies() {
  return [metaCookie(META_PENDING, '', 0), metaCookie(META_COOKIE, '', 0)];
}
function metaJar(req) {
  const found = {};
  for (const item of (req.headers.get('Cookie') || '').split(';')) {
    const p = item.indexOf('=');
    if (p > 0) {
      const k = item.slice(0,p).trim();
      try { found[k] = decodeURIComponent(item.slice(p + 1)); } catch { /* Ignore */ }
    }
  }
  return found;
}
function metaReply(data, status, inherited=[], cookies=[]) {
  const headers = new Headers({
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
  });
  [...inherited,...cookies].forEach(x => headers.append('Set-Cookie',x));
  return new Response(JSON.stringify(data), {status,headers});
}
function metaRedirect(location, inherited=[], cookies=[]) {
  const headers=new Headers({'Location':location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  [...inherited,...cookies].forEach(x=>headers.append('Set-Cookie',x));
  return new Response(null,{status:302,headers});
}
function metaBytesTo64(bytes) {
  let bin='';
  bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function meta64ToBytes(value) {
  const str=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function metaKey(env) {
  const bytes=new Uint8Array(env.META_SESSION_KEY.match(/.{2}/g).map(h=>parseInt(h,16)));
  return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
async function sealMeta(env, value) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new TextEncoder().encode(JSON.stringify(value));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await metaKey(env),data));
  return metaBytesTo64(iv)+'.'+metaBytesTo64(encrypted);
}
async function unsealMeta(env, value) {
  if (!value || value.length>3800 || !value.includes('.')) return null;
  try {
    const [a,b]=value.split('.');
    const iv=meta64ToBytes(a);
    if(iv.length!==12)return null;
    const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv},await metaKey(env),meta64ToBytes(b));
    return JSON.parse(new TextDecoder().decode(decoded));
  } catch { return null; }
}
function metaOriginDenied(req) {
  const origin=req.headers.get('Origin');
  return !!origin && origin!==new URL(req.url).origin;
}
function metaSameOriginJson(req) {
  return !metaOriginDenied(req) && (req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json');
}
function metaValidBusinessId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
async function metaPilotBusiness(env, session, businessId) {
  if (session.user.role==='admin' || !metaValidBusinessId(businessId)) return false;
  // Use the user's JWT; Supabase RLS must authorize the business.
  const endpoint = String(env.SUPABASE_URL).replace(/\/$/,'') +
    '/rest/v1/businesses?select=id,slug&id=eq.'+encodeURIComponent(businessId)+'&limit=1';
  const r=await fetch(endpoint,{headers:{
    apikey:env.SUPABASE_ANON_KEY, Authorization:'Bearer '+session.access, Accept:'application/json',
  }});
  if(!r.ok)return false;
  const rows=await r.json();
  return rows.length===1 && rows[0].id===businessId;
}
async function metaGraph(env, urlPath, token, fields) {
  const config=metaConfig(env);
  const url=new URL('https://graph.facebook.com/'+config.version+urlPath);
  if(fields)for(const [key,value] of Object.entries(fields))url.searchParams.set(key,String(value));
  const r=await fetch(url.toString(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!r.ok)throw new Error('Meta rechazó la consulta (HTTP '+r.status+'). Comprueba los permisos de la cuenta.');
  return r.json();
}
async function metaAccounts(env, token) {
  const data=await metaGraph(env,'/me/adaccounts',token,{fields:'id,account_id,name,currency',limit:100});
  return (data.data||[]).filter(a=>/^act_\d+$/.test(a.id||'')).map(a=>({
    id:a.id, name:a.name||a.id, currency:a.currency||'',
  }));
}
function validMetaSession(value,s,businessId) {
  return !!(value && value.user===s.user.id && value.business===businessId && value.token &&
    Number(value.expires)>Date.now());
}
function metaResultUrl(config, flag) {
  // Always redirect to the validated platform origin, never browser query data.
  const home=new URL('/',config.redirect);
  home.searchParams.set('meta',flag);
  return home.toString();
}
export async function handleMetaApi(req,env,s) {
  const url=new URL(req.url),path=url.pathname,method=req.method.toUpperCase();
  const config=metaConfig(env,url.origin),cookies=s.cookies||[],jar=metaJar(req);
  const reply=(data,status=200,extra=[])=>metaReply(data,status,cookies,extra);
  const error=(message,status=400)=>reply({error:message},status);
  if(path==='/api/meta/status' && method==='GET') {
    const businessId=url.searchParams.get('business_id')||'';
    if(!await metaPilotBusiness(env,s,businessId))return error('No tienes acceso a este negocio.',403);
    if(!config.ready)return reply({configured:false,connected:false,reason:'Meta Ads todavía no está configurado en los secretos de Cloudflare.'});
    const connection=await unsealMeta(env,jar[META_COOKIE]);
    if(!validMetaSession(connection,s,businessId))return reply({configured:true,connected:false});
    try {
      const accounts=await metaAccounts(env,connection.token);
      return reply({configured:true,connected:true,accounts,selected_account:accounts.some(x=>x.id===connection.account)?connection.account:null,selected_accounts:accounts.filter(x=>(connection.accounts||[connection.account]).includes(x.id)).map(x=>x.id),expires_at:new Date(connection.expires).toISOString()});
    }catch(e){return reply({configured:true,connected:false,error:String(e.message).slice(0,180)});}
  }
  if(path==='/api/meta/connect' && method==='GET') {
    if(!config.ready)return error('La integración Meta Ads aún necesita configuración del proveedor.',503);
    if(url.origin!==new URL(config.redirect).origin)return error('El dominio no coincide con el dominio configurado para Meta.',403);
    const businessId=url.searchParams.get('business_id')||'';
    if(!await metaPilotBusiness(env,s,businessId))return error('No tienes acceso a esta conexión piloto.',403);
    const state=metaBytesTo64(crypto.getRandomValues(new Uint8Array(24)));
    const pending=await sealMeta(env,{state,business:businessId,user:s.user.id,expires:Date.now()+10*60*1000});
    const authorize=new URL('https://www.facebook.com/'+config.version+'/dialog/oauth');
    authorize.searchParams.set('client_id',env.META_APP_ID);
    authorize.searchParams.set('redirect_uri',config.redirect);
    authorize.searchParams.set('state',state);
    authorize.searchParams.set('scope','ads_read');
    authorize.searchParams.set('response_type','code');
    return metaRedirect(authorize.toString(),cookies,[metaCookie(META_PENDING,pending,600)]);
  }
  if(path==='/api/meta/callback' && method==='GET') {
    if(!config.ready)return error('La conexión Meta no está configurada.',503);
    if(url.origin!==new URL(config.redirect).origin)return error('Dominio de retorno no autorizado.',403);
    const pending=await unsealMeta(env,jar[META_PENDING]);
    const expired=!pending || pending.expires<Date.now() || pending.user!==s.user.id ||
      pending.state!==url.searchParams.get('state');
    if(expired)return error('La autorización ha caducado o no coincide con esta sesión. Vuelve a conectar Meta.',403);
    if(!await metaPilotBusiness(env,s,pending.business))return error('Acceso a negocio no autorizado.',403);
    if(url.searchParams.has('error'))return metaRedirect(metaResultUrl(config,'cancelled'),cookies,[metaCookie(META_PENDING,'',0)]);
    const code=url.searchParams.get('code')||'';
    if(!code || code.length>2000)return error('Meta no devolvió un código de autorización válido.');
    const exchange=new URL('https://graph.facebook.com/'+config.version+'/oauth/access_token');
    for(const [key,value] of Object.entries({
      client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,
      redirect_uri:config.redirect,code,
    }))exchange.searchParams.set(key,value);
    const tokenResponse=await fetch(exchange.toString(),{headers:{Accept:'application/json'}});
    if(!tokenResponse.ok)return error('No se pudo validar la autorización con Meta (HTTP '+tokenResponse.status+').',502);
    let info=await tokenResponse.json();
    if(!info.access_token)return error('Meta no entregó un token de acceso.',502);
    // Attempt longer-lived Meta user token. Short-lived token remains a valid pilot fallback.
    try {
      const longUrl=new URL('https://graph.facebook.com/'+config.version+'/oauth/access_token');
      for(const [key,value] of Object.entries({grant_type:'fb_exchange_token',
        client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,fb_exchange_token:info.access_token
      }))longUrl.searchParams.set(key,value);
      const longResponse=await fetch(longUrl.toString(),{headers:{Accept:'application/json'}});
      if(longResponse.ok){const longInfo=await longResponse.json();if(longInfo.access_token)info=longInfo;}
    }catch{ /* Limited pilot remains usable with short-lived token. */ }
    const seconds=Math.max(300,Math.min(86400,Number(info.expires_in)||3600)-120);
    const connection=await sealMeta(env,{
      user:s.user.id,business:pending.business,token:info.access_token,
      account:null,accounts:[],expires:Date.now()+seconds*1000,
    });
    return metaRedirect(metaResultUrl(config,'connected'),cookies,[
      metaCookie(META_PENDING,'',0),metaCookie(META_COOKIE,connection,seconds)
    ]);
  }
  if(path==='/api/meta/select' && method==='POST') {
    if(!metaSameOriginJson(req))return error('Solicitud de origen o contenido no autorizado.',403);
    const raw=await req.text();
    if(raw.length>2048)return error('Solicitud demasiado grande.',413);
    let input;try{input=JSON.parse(raw);}catch{return error('Solicitud no válida.');}
    const businessId=input?.business_id||'';
    if(!await metaPilotBusiness(env,s,businessId))return error('Negocio no autorizado.',403);
    const accountIds=Array.isArray(input?.account_ids)?input.account_ids:
      (input?.account_id?[input.account_id]:[]);
    if(accountIds.length>5||new Set(accountIds).size!==accountIds.length||
      accountIds.some(id=>typeof id!=='string'||!/^act_\d+$/.test(id))) {
      return error('Puedes elegir hasta cinco cuentas publicitarias válidas sin repetir.');
    }
    const connection=await unsealMeta(env,jar[META_COOKIE]);
    if(!validMetaSession(connection,s,businessId))return error('Necesitas conectar Meta Ads nuevamente.',401);
    const accounts=await metaAccounts(env,connection.token);
    if(accountIds.some(id=>!accounts.some(x=>x.id===id)))return error('No tienes autorización para una de las cuentas seleccionadas.',403);
    connection.accounts=accountIds;
    connection.account=accountIds[0]||null;
    const updated=await sealMeta(env,connection);
    const seconds=Math.max(60,Math.floor((connection.expires-Date.now())/1000));
    return reply({ok:true,account_ids:accountIds},200,[metaCookie(META_COOKIE,updated,seconds)]);
  }
  if(path==='/api/meta/report' && method==='GET') {
    const businessId=url.searchParams.get('business_id')||'';
    if(!await metaPilotBusiness(env,s,businessId))return error('Negocio no autorizado.',403);
    const connection=await unsealMeta(env,jar[META_COOKIE]);
    if(!validMetaSession(connection,s,businessId))return error('Vuelve a conectar Meta Ads.',401);
    const ids=(connection.accounts||[connection.account]).filter(id=>/^act_\d+$/.test(id||'')).slice(0,5);
    if(!ids.length)return error('Selecciona al menos una cuenta publicitaria.',400);
    const period=url.searchParams.get('period')||'30';
    if(!META_PERIODS.has(period))return error('Período no válido.');
    const presets={today:'today',yesterday:'yesterday','7':'last_7d','30':'last_30d','90':'last_90d','365':'last_year'};
    const accounts=await metaAccounts(env,connection.token);
    const account_reports=await Promise.all(ids.map(async id=>{
      const report=await metaGraph(env,'/'+id+'/insights',connection.token,{
        fields:'spend,clicks,impressions,ctr,cpc',date_preset:presets[period],level:'account',limit:1
      });
      const x=(report.data||[])[0]||null;
      const acc=accounts.find(a=>a.id===id);
      return {account_id:id,name:acc?.name||id,currency:acc?.currency||'',
        metrics:x?{spend:x.spend??null,clicks:x.clicks??null,impressions:x.impressions??null,
          ctr:x.ctr??null,cpc:x.cpc??null}:null};
    }));
    const first=account_reports.length===1?account_reports[0]:null;
    return reply({configured:true,period,account_reports,account_id:first?.account_id||null,
      currency:first?.currency||'',metrics:first?.metrics||null,updated_at:new Date().toISOString()});
  }
  if(path==='/api/meta/campaigns' && method==='GET') {
    const businessId=url.searchParams.get('business_id')||'';
    if(!await metaPilotBusiness(env,s,businessId))return error('Negocio no autorizado.',403);
    const connection=await unsealMeta(env,jar[META_COOKIE]);
    if(!validMetaSession(connection,s,businessId))return error('Conecta Meta Ads nuevamente.',401);
    const ids=(connection.accounts||[connection.account]).filter(id=>/^act_\d+$/.test(id||'')).slice(0,5);
    if(!ids.length)return error('Selecciona una cuenta publicitaria.',400);
    const period=url.searchParams.get('period')||'30',level=url.searchParams.get('level')||'campaign';
    if(!META_PERIODS.has(period)||!['campaign','adset','ad'].includes(level))return error('Filtro de anuncios no válido.');
    const presets={today:'today',yesterday:'yesterday','7':'last_7d','30':'last_30d','90':'last_90d','365':'last_year'};
    const fields=level==='campaign'?'campaign_id,campaign_name,spend,clicks,impressions,ctr,cpc':
      level==='adset'?'campaign_name,adset_id,adset_name,spend,clicks,impressions,ctr,cpc':
      'campaign_name,adset_name,ad_id,ad_name,spend,clicks,impressions,ctr,cpc';
    const accounts=await metaAccounts(env,connection.token);
    if(ids.some(id=>!accounts.some(account=>account.id===id)))return error('Ya no tienes acceso a una cuenta seleccionada. Vuelve a autorizar Meta.',403);
    const rows=[];let partial=false;
    for(const id of ids){
      const account=accounts.find(a=>a.id===id);
      if(!account)continue;
      let after='';
      for(let page=0;page<2;page++){
        const params={fields,date_preset:presets[period],level,limit:100};
        if(after)params.after=after;
        const data=await metaGraph(env,'/'+id+'/insights',connection.token,params);
        for(const x of data.data||[])rows.push({
          id:String(x.ad_id||x.adset_id||x.campaign_id||''),
          name:String(x.ad_name||x.adset_name||x.campaign_name||'Sin nombre').slice(0,150),
          account_id:id,account_name:account.name,currency:account.currency,
          campaign_name:String(x.campaign_name||'').slice(0,150),
          spend:x.spend??null,clicks:x.clicks??null,impressions:x.impressions??null,
          ctr:x.ctr??null,cpc:x.cpc??null
        });
        const next=data.paging?.next,cursor=data.paging?.cursors?.after;
        if(!next||!cursor)break;
        if(page===1){partial=true;break;}
        if(cursor===after)break;
        after=cursor;
      }
    }
    const currencies=new Set(rows.map(x=>x.currency));
    return reply({configured:true,connected:true,period,level,rows,partial,
      currency:currencies.size===1?[...currencies][0]:'',account_ids:ids,
      updated_at:new Date().toISOString()});
  }
  if(path==='/api/meta/disconnect' && method==='POST') {
    if(!metaSameOriginJson(req))return error('Solicitud no autorizada.',403);
    return reply({ok:true},200,clearMetaCookies());
  }
  return error('Ruta de Meta Ads no encontrada.',404);
}
