// Google Search Console OAuth — independent from GA4; encrypted offline credentials per business; read-only scope.
import { ensureBusinessFeature } from './feature-access.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE=/^(sc-domain:[a-z0-9.-]{1,250}|https?:\/\/[^\s]{1,300})$/i;
const SCOPE='https://www.googleapis.com/auth/webmasters.readonly';
const PERIODS={'7d':7,'28d':28,'90d':90};
const endpoint=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/';
const missingConfig=env=>{
 const missing=[];
 if(!env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID)missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_ID');
 if(!env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET)missing.push('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET');
 if(!env.SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SERVICE_ROLE_KEY');
 if(!/^[0-9a-f]{64}$/i.test(env.GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY||''))missing.push('GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY');
 return missing;
};
const validConfig=env=>missingConfig(env).length===0;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const cookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
function jar(req){const out={};for(const part of (req.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0){try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1))}catch{}}}return out;}
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
async function key(env){if(!validConfig(env))throw Error('Search Console no está configurado.');return crypto.subtle.importKey('raw',Uint8Array.from(env.GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY.match(/../g),v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(ct));}
async function unseal(env,value){try{if(typeof value!=='string'||value.length>12000)return null;const [a,b]=value.split('.');if(!a||!b||decode(a).length!==12)return null;return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(a)},await key(env),decode(b))))}catch{return null}}
function response(body,status=200,cookies=[]){const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(JSON.stringify(body),{status,headers});}
// Membership is verified with the user's own JWT through RLS (never with service_role).
async function owner(env,s,id){if(!UUID.test(id)||s.user.role==='admin')return false;const r=await fetch(endpoint(env)+'businesses?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});return r.ok&&(await r.json()).some(x=>x.id===id);}
async function permitted(env,s,id){return await owner(env,s,id)&&await ensureBusinessFeature(env,s,id,'search_console');}
async function db(env,table,query='',method='GET',body){if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Falta configurar el almacenamiento seguro.');const k=env.SUPABASE_SERVICE_ROLE_KEY;const h={apikey:k,Authorization:'Bearer '+k,Accept:'application/json','Content-Type':'application/json',Prefer:method==='POST'&&table==='ed_search_console_connections'?'resolution=merge-duplicates,return=representation':'return=representation'};const r=await fetch(endpoint(env)+table+(query?'?'+query:''),{method,headers:h,...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('No se pudo consultar el almacenamiento seguro de Search Console (HTTP '+r.status+').');return r.json();}
async function tokenRequest(env,params){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,client_secret:env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,...params})});if(!r.ok)throw Error('Google no autorizó el acceso a Search Console (HTTP '+r.status+').');return r.json();}
async function accessToken(env,row){
 const saved=await unseal(env,row.refresh_token_cipher);
 if(!saved?.refresh_token)throw Error('La autorización de Search Console no es válida. Reconecta tu cuenta.');
 const r=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:saved.refresh_token});
 if(!r.access_token)throw Error('No se pudo renovar el acceso a Search Console. Reconecta tu cuenta.');
 return r.access_token;
}
async function listSites(token){
 const r=await fetch('https://www.googleapis.com/webmasters/v3/sites',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
 if(!r.ok)throw Error('Search Console no permitió listar sitios (HTTP '+r.status+'). Activa la API de Search Console y comprueba el acceso.');
 const payload=await r.json(),out=[];
 for(const x of payload.siteEntry||[]){
  const url=String(x.siteUrl||'');
  if(!SITE.test(url)||x.permissionLevel==='siteUnverifiedUser')continue;
  out.push({url,permission:String(x.permissionLevel||'').slice(0,40)});
 }
 return out.sort((a,b)=>a.url.localeCompare(b.url)).slice(0,200);
}
const day=d=>d.toISOString().slice(0,10);
async function query(token,site,body){
 const r=await fetch('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error('Search Console no devolvió el informe (HTTP '+r.status+').');
 return (await r.json()).rows||[];
}
const metrics=r=>({clicks:Number(r.clicks)||0,impressions:Number(r.impressions)||0,ctr:Number(r.ctr)||0,position:Number(r.position)||0});
export async function searchConsoleReport(env,row,periodKey){
 const days=PERIODS[periodKey]||28;
 // Search Console data lags ~2 days; end the window there for complete rows.
 const end=new Date(Date.now()-2*86400000),start=new Date(end.getTime()-(days-1)*86400000);
 const base={startDate:day(start),endDate:day(end),dataState:'final'};
 const token=await accessToken(env,row),site=row.selected_site_url;
 const [daily,queries,pages]=await Promise.all([
  query(token,site,{...base,dimensions:['date'],rowLimit:100}),
  query(token,site,{...base,dimensions:['query'],rowLimit:25}),
  query(token,site,{...base,dimensions:['page'],rowLimit:25})
 ]);
 const t=daily.reduce((a,r)=>({clicks:a.clicks+(+r.clicks||0),impressions:a.impressions+(+r.impressions||0),weighted:a.weighted+(+r.position||0)*(+r.impressions||0)}),{clicks:0,impressions:0,weighted:0});
 return {
  period:{key:PERIODS[periodKey]?periodKey:'28d',start:base.startDate,end:base.endDate},
  totals:{clicks:t.clicks,impressions:t.impressions,ctr:t.impressions?t.clicks/t.impressions:0,position:t.impressions?t.weighted/t.impressions:0},
  daily:daily.map(r=>({date:String(r.keys?.[0]||''),...metrics(r)})).sort((a,b)=>a.date.localeCompare(b.date)),
  queries:queries.map(r=>({query:String(r.keys?.[0]||'').slice(0,200),...metrics(r)})),
  pages:pages.map(r=>({page:String(r.keys?.[0]||'').slice(0,400),...metrics(r)}))
 };
}
function done(req,pending,status,cookies){
 const origin=new URL(req.url).origin;
 if(pending.popup){
  const message=JSON.stringify({type:'edwin-search-console-oauth',result:status,business_id:pending.business});
  const nonce=b64(crypto.getRandomValues(new Uint8Array(16)));
  const name=status==='connected'?'Search Console autorizado':status==='cancelled'?'Autorización cancelada':'No se pudo conectar Search Console';
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edwin CRM · Search Console</title><style>body{background:#f5f7fc;color:#122b4b;font:16px system-ui;min-height:95vh;display:grid;place-items:center}.box{background:white;border-radius:18px;padding:35px;max-width:400px;text-align:center;box-shadow:0 12px 35px #1232}a{color:#176ce1}</style></head><body><main class="box"><h2>'+name+'</h2><p>Puedes volver al panel de Edwin CRM.</p><a href="/?search_console='+encodeURIComponent(status)+'&business_id='+encodeURIComponent(pending.business)+'">Volver al CRM</a></main><script nonce="'+nonce+'">try{if(window.opener){window.opener.postMessage('+message+','+JSON.stringify(origin)+');window.close();}}catch(e){}</script></body></html>';
  const h=new Headers({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'"});
  for(const c of cookies)h.append('Set-Cookie',c);return new Response(html,{status:200,headers:h});
 }
 const url=new URL('/',origin);url.searchParams.set('search_console',status);url.searchParams.set('business_id',pending.business);
 const h=new Headers({Location:url.toString(),'Cache-Control':'no-store'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(null,{status:302,headers:h});
}
function sameOrigin(req){const origin=req.headers.get('Origin');return !origin||origin===new URL(req.url).origin;}
const jsonPost=req=>sameOrigin(req)&&(req.headers.get('Content-Type')||'').split(';')[0]==='application/json';
export async function handleSearchConsoleApi(req,env,s){
 const url=new URL(req.url),path=url.pathname,method=req.method.toUpperCase(),c=s.cookies||[],reply=(obj,status=200,extra=[])=>response(obj,status,[...c,...extra]);
 const bad=(message,status=400)=>reply({error:message},status);
 if(path==='/api/search-console/callback'&&method==='GET'){
  if(!validConfig(env))return bad('Search Console no está configurado.',503);
  const pending=await unseal(env,jar(req).ed_sc_pending),clear=cookie('ed_sc_pending','',0);
  if(!pending||pending.until<Date.now()||pending.user!==s.user.id||pending.state!==url.searchParams.get('state')||!UUID.test(pending.business))return bad('Autorización de Search Console vencida o inválida.',403);
  if(!await permitted(env,s,pending.business))return bad('No tienes permiso para autorizar esta empresa.',403);
  // Atomic single-use state consumption prevents OAuth response replay.
  const consumed=await db(env,'ed_search_console_oauth_nonces','nonce_hash=eq.'+await sha(pending.state)+'&business_id=eq.'+encodeURIComponent(pending.business)+'&user_id=eq.'+encodeURIComponent(s.user.id)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
  if(consumed.length!==1)return bad('Esta autorización ya se utilizó o expiró.',403);
  if(url.searchParams.has('error'))return done(req,pending,'cancelled',[...c,clear]);
  const code=url.searchParams.get('code')||'';if(!code||code.length>4096)return done(req,pending,'failed',[...c,clear]);
  try{
   const auth=await tokenRequest(env,{grant_type:'authorization_code',code,redirect_uri:url.origin+'/api/search-console/callback'});
   if(!auth.refresh_token||!auth.access_token)return done(req,pending,'no_refresh_token',[...c,clear]);
   // Only persist the connection once the Search Console API actually answers.
   await listSites(auth.access_token);
   await db(env,'ed_search_console_connections','on_conflict=business_id','POST',{business_id:pending.business,user_id:s.user.id,refresh_token_cipher:await seal(env,{refresh_token:auth.refresh_token}),selected_site_url:null,updated_at:new Date().toISOString()});
   return done(req,pending,'connected',[...c,clear]);
  }catch(e){console.error('Search Console callback:',String(e.message).slice(0,180));return done(req,pending,'failed',[...c,clear]);}
 }
 const businessId=url.searchParams.get('business_id')||'';
 if(!await permitted(env,s,businessId))return bad('No tienes permiso para consultar Search Console de esta empresa.',403);
 if(path==='/api/search-console/status'&&method==='GET'){
  if(!validConfig(env))return reply({configured:false,connected:false,missing_config:missingConfig(env),reason:'Falta configurar las credenciales OAuth de Search Console en Cloudflare.'});
  const row=(await db(env,'ed_search_console_connections','select=business_id,refresh_token_cipher,selected_site_url,updated_at&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1'))[0];
  const readable=!!row&&!!(await unseal(env,row.refresh_token_cipher))?.refresh_token;
  return reply({configured:true,connected:readable,authorization_saved:!!row,needs_reauthorization:!!row&&!readable,selected_site_url:readable?row.selected_site_url||null:null,updated_at:row?.updated_at||null});
 }
 if(!validConfig(env))return bad('Search Console requiere configurar GOOGLE_SEARCH_CONSOLE_CLIENT_ID, GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET y GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY en Cloudflare.',503);
 if(path==='/api/search-console/connect'&&method==='GET'){
  const state=b64(crypto.getRandomValues(new Uint8Array(32))),until=Date.now()+600000;
  await db(env,'ed_search_console_oauth_nonces','','POST',{nonce_hash:await sha(state),user_id:s.user.id,business_id:businessId,expires_at:new Date(until).toISOString()});
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,redirect_uri:url.origin+'/api/search-console/callback',response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state}))auth.searchParams.set(k,v);
  const h=new Headers({Location:auth.toString(),'Cache-Control':'no-store'});for(const x of [...c,cookie('ed_sc_pending',await seal(env,{state,user:s.user.id,business:businessId,until,popup:url.searchParams.get('popup')==='1'}),600)])h.append('Set-Cookie',x);
  return new Response(null,{status:302,headers:h});
 }
 const row=(await db(env,'ed_search_console_connections','select=business_id,refresh_token_cipher,selected_site_url&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1'))[0];
 if(!row)return bad('Conecta Search Console antes de continuar.',409);
 try{
  if(path==='/api/search-console/sites'&&method==='GET')return reply({sites:await listSites(await accessToken(env,row)),selected_site_url:row.selected_site_url||null});
  if(path==='/api/search-console/select-site'&&method==='POST'){
   if(!jsonPost(req))return bad('Origen o contenido no autorizado.',403);
   const raw=await req.text();if(raw.length>600)return bad('Solicitud demasiado grande.',413);
   let body;try{body=JSON.parse(raw)}catch{return bad('Solicitud inválida.');}
   const siteUrl=String(body?.site_url||'');
   if(!SITE.test(siteUrl))return bad('Selecciona un sitio válido.');
   const selected=(await listSites(await accessToken(env,row))).find(x=>x.url===siteUrl);
   if(!selected)return bad('Este sitio no está autorizado en tu cuenta de Google.',403);
   await db(env,'ed_search_console_connections','business_id=eq.'+encodeURIComponent(businessId),'PATCH',{selected_site_url:selected.url,updated_at:new Date().toISOString()});
   return reply({ok:true,site:selected});
  }
  if(path==='/api/search-console/report'&&method==='GET'){
   if(!row.selected_site_url)return bad('Selecciona un sitio de Search Console primero.',409);
   const period=url.searchParams.get('period')||'28d';
   if(!PERIODS[period])return bad('Periodo no válido. Usa 7d, 28d o 90d.');
   return reply({configured:true,site_url:row.selected_site_url,...await searchConsoleReport(env,row,period)});
  }
  if(path==='/api/search-console/disconnect'&&method==='POST'){
   if(!jsonPost(req))return bad('Origen o contenido no autorizado.',403);
   await db(env,'ed_search_console_connections','business_id=eq.'+encodeURIComponent(businessId),'DELETE');return reply({ok:true});
  }
 }catch(e){console.error('Search Console:',String(e.message).slice(0,180));return bad(String(e.message).slice(0,200),502);}
 return bad('Ruta de Search Console no encontrada.',404);
}
