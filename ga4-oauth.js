// Google Analytics 4 OAuth — encrypted offline credentials per business; read-only scope.
import { ensureBusinessFeature } from './feature-access.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROPERTY=/^[0-9]{1,30}$/;
const endpoint=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/';
const missingConfig=env=>{
 const missing=[];
 if(!env.GOOGLE_ANALYTICS_CLIENT_ID)missing.push('GOOGLE_ANALYTICS_CLIENT_ID');
 if(!env.GOOGLE_ANALYTICS_CLIENT_SECRET)missing.push('GOOGLE_ANALYTICS_CLIENT_SECRET');
 if(!env.SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SERVICE_ROLE_KEY');
 if(!/^[0-9a-f]{64}$/i.test(env.GOOGLE_ANALYTICS_ENCRYPTION_KEY||''))missing.push('GOOGLE_ANALYTICS_ENCRYPTION_KEY');
 return missing;
};
const validConfig=env=>missingConfig(env).length===0;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const cookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
function jar(req){const out={};for(const part of (req.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0){try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1))}catch{}}}return out;}
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
async function key(env){if(!validConfig(env))throw Error('Google Analytics no está configurado.');return crypto.subtle.importKey('raw',Uint8Array.from(env.GOOGLE_ANALYTICS_ENCRYPTION_KEY.match(/../g),v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(ct));}
async function unseal(env,value){try{if(typeof value!=='string'||value.length>12000)return null;const [a,b]=value.split('.');if(!a||!b||decode(a).length!==12)return null;return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(a)},await key(env),decode(b))))}catch{return null}}
function response(body,status=200,cookies=[]){const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(JSON.stringify(body),{status,headers});}
async function owner(env,s,id){if(!UUID.test(id)||s.user.role==='admin')return false;const r=await fetch(endpoint(env)+'businesses?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});return r.ok&&(await r.json()).some(x=>x.id===id);}
async function permitted(env,s,id){return await owner(env,s,id)&&await ensureBusinessFeature(env,s,id,'ga4');}
async function db(env,table,query='',method='GET',body){if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Falta configurar el almacenamiento seguro.');const k=env.SUPABASE_SERVICE_ROLE_KEY;const h={apikey:k,Authorization:'Bearer '+k,Accept:'application/json','Content-Type':'application/json',Prefer:method==='POST'&&table==='ed_ga4_connections'?'resolution=merge-duplicates,return=representation':'return=representation'};const r=await fetch(endpoint(env)+table+(query?'?'+query:''),{method,headers:h,...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('No se pudo consultar el almacenamiento seguro de Analytics (HTTP '+r.status+').');return r.json();}
async function tokenRequest(env,params){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_ANALYTICS_CLIENT_ID,client_secret:env.GOOGLE_ANALYTICS_CLIENT_SECRET,...params})});if(!r.ok)throw Error('Google no autorizó el acceso a Analytics (HTTP '+r.status+').');return r.json();}
export async function ga4OauthToken(env,row){if(!validConfig(env))throw Error('La conexión de Google Analytics no está configurada.');const saved=await unseal(env,row.refresh_token_cipher);if(!saved?.refresh_token)throw Error('La autorización de Analytics no es válida. Reconecta tu cuenta.');const r=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:saved.refresh_token});if(!r.access_token)throw Error('No se pudo renovar el acceso a Analytics. Reconecta tu cuenta.');return r.access_token;}
export async function ga4ConnectionForBusiness(env,s,id){if(!validConfig(env)||!await permitted(env,s,id))return null;const rows=await db(env,'ed_ga4_connections','select=business_id,refresh_token_cipher,selected_property_id,selected_property_name&business_id=eq.'+encodeURIComponent(id)+'&limit=1');return rows[0]||null;}
// Do not allow a client to select a GA4 property already assigned to another CRM business.
async function propertyBelongsToAnotherBusiness(env,businessId,propertyId){
 const property=encodeURIComponent(propertyId),other='&business_id=neq.'+encodeURIComponent(businessId)+'&limit=1';
 const [sites,connections]=await Promise.all([
  db(env,'sites','select=business_id&ga4_property_id=eq.'+property+other),
  db(env,'ed_ga4_connections','select=business_id&selected_property_id=eq.'+property+other)
 ]);
 return sites.length>0||connections.length>0;
}
async function properties(env,row){
 const token=await ga4OauthToken(env,row),all=[],seen=new Set();let next='';
 for(let page=0;page<5;page++){
  const url=new URL('https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  url.searchParams.set('pageSize','200');if(next)url.searchParams.set('pageToken',next);
  const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(!r.ok)throw Error('Google Analytics no permitió listar propiedades (HTTP '+r.status+'). Activa la API Admin y comprueba el acceso.');
  const payload=await r.json();
  for(const a of payload.accountSummaries||[])for(const p of a.propertySummaries||[]){
   const id=String(p.property||'').split('/')[1];
   if(!PROPERTY.test(id)||seen.has(id))continue;
   seen.add(id);all.push({id,name:String(p.displayName||id).slice(0,180),account:String(a.displayName||'').slice(0,160)});
  }
  next=payload.nextPageToken||'';if(!next)break;
 }
 return all.sort((a,b)=>a.name.localeCompare(b.name));
}
function done(req,pending,status,cookies){
 const u=new URL(req.url),origin=u.origin;
 if(pending.popup){
  const message=JSON.stringify({type:'edwin-ga4-oauth',result:status,business_id:pending.business});
  const nonce=b64(crypto.getRandomValues(new Uint8Array(16)));
  const name=status==='connected'?'Google Analytics autorizado':status==='cancelled'?'Autorización cancelada':'No se pudo conectar Analytics';
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edwin CRM · Google Analytics</title><style>body{background:#f5f7fc;color:#122b4b;font:16px system-ui;min-height:95vh;display:grid;place-items:center}.box{background:white;border-radius:18px;padding:35px;max-width:400px;text-align:center;box-shadow:0 12px 35px #1232}a{color:#176ce1}</style></head><body><main class="box"><h2>'+name+'</h2><p>Puedes volver al panel de Edwin CRM.</p><a href="/?ga4='+encodeURIComponent(status)+'&business_id='+encodeURIComponent(pending.business)+'">Volver al CRM</a></main><script nonce="'+nonce+'">try{if(window.opener){window.opener.postMessage('+message+','+JSON.stringify(origin)+');window.close();}}catch(e){}</script></body></html>';
  const h=new Headers({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'"});
  for(const c of cookies)h.append('Set-Cookie',c);return new Response(html,{status:200,headers:h});
 }
 const url=new URL('/',origin);url.searchParams.set('ga4',status);url.searchParams.set('business_id',pending.business);
 const h=new Headers({Location:url.toString(),'Cache-Control':'no-store'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(null,{status:302,headers:h});
}
function sameOrigin(req){const origin=req.headers.get('Origin');return !origin||origin===new URL(req.url).origin;}
export async function handleGa4OAuthApi(req,env,s){
 const url=new URL(req.url),path=url.pathname,method=req.method.toUpperCase(),c=s.cookies||[],reply=(obj,status=200,extra=[])=>response(obj,status,[...c,...extra]);
 const bad=(message,status=400)=>reply({error:message},status);
 if(path==='/api/ga4/callback'&&method==='GET'){
  const pending=await unseal(env,jar(req).ed_ga4_pending),clear=cookie('ed_ga4_pending','',0);
  if(!pending||pending.until<Date.now()||pending.user!==s.user.id||pending.state!==url.searchParams.get('state')||!UUID.test(pending.business))return bad('Autorización de Analytics vencida o inválida.',403);
  if(!await permitted(env,s,pending.business))return bad('No tienes permiso para autorizar esta empresa.',403);
  // Atomic single-use state consumption prevents OAuth response replay.
  const consumed=await db(env,'ed_ga4_oauth_nonces','nonce_hash=eq.'+await sha(pending.state)+'&business_id=eq.'+encodeURIComponent(pending.business)+'&user_id=eq.'+encodeURIComponent(s.user.id)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
  if(consumed.length!==1)return bad('Esta autorización ya se utilizó o expiró.',403);
  if(url.searchParams.has('error'))return done(req,pending,'cancelled',[...c,clear]);
  const code=url.searchParams.get('code')||'';if(!code||code.length>4096)return done(req,pending,'failed',[...c,clear]);
  try{
   const auth=await tokenRequest(env,{grant_type:'authorization_code',code,redirect_uri:url.origin+'/api/ga4/callback'});
   if(!auth.refresh_token)return done(req,pending,'no_refresh_token',[...c,clear]);
   await db(env,'ed_ga4_connections','on_conflict=business_id','POST',{business_id:pending.business,user_id:s.user.id,refresh_token_cipher:await seal(env,{refresh_token:auth.refresh_token}),selected_property_id:null,selected_property_name:null,updated_at:new Date().toISOString()});
   return done(req,pending,'connected',[...c,clear]);
  }catch(e){console.error('GA4 callback:',String(e.message).slice(0,180));return done(req,pending,'failed',[...c,clear]);}
 }
 const businessId=url.searchParams.get('business_id')||'';
 if(!await permitted(env,s,businessId))return bad('No tienes permiso para consultar Analytics de esta empresa.',403);
 if(path==='/api/ga4/status'&&method==='GET'){
  if(!validConfig(env))return reply({configured:false,connected:false,missing_config:missingConfig(env),reason:'Falta configurar las credenciales OAuth de Google Analytics en Cloudflare.'});
  const rows=await db(env,'ed_ga4_connections','select=business_id,selected_property_id,selected_property_name,updated_at&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
  const row=rows[0];return reply({configured:true,connected:!!row,selected_property_id:row?.selected_property_id||null,selected_property_name:row?.selected_property_name||null,updated_at:row?.updated_at||null});
 }
 if(!validConfig(env))return bad('Analytics requiere configurar GOOGLE_ANALYTICS_CLIENT_ID, GOOGLE_ANALYTICS_CLIENT_SECRET y GOOGLE_ANALYTICS_ENCRYPTION_KEY en Cloudflare.',503);
 if(path==='/api/ga4/connect'&&method==='GET'){
  const state=b64(crypto.getRandomValues(new Uint8Array(32))),until=Date.now()+600000;
  await db(env,'ed_ga4_oauth_nonces','','POST',{nonce_hash:await sha(state),user_id:s.user.id,business_id:businessId,expires_at:new Date(until).toISOString()});
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:env.GOOGLE_ANALYTICS_CLIENT_ID,redirect_uri:url.origin+'/api/ga4/callback',response_type:'code',scope:'https://www.googleapis.com/auth/analytics.readonly',access_type:'offline',prompt:'consent',state}))auth.searchParams.set(k,v);
  const h=new Headers({Location:auth.toString(),'Cache-Control':'no-store'});for(const x of [...c,cookie('ed_ga4_pending',await seal(env,{state,user:s.user.id,business:businessId,until,popup:url.searchParams.get('popup')==='1'}),600)])h.append('Set-Cookie',x);
  return new Response(null,{status:302,headers:h});
 }
 const records=await db(env,'ed_ga4_connections','select=business_id,refresh_token_cipher,selected_property_id,selected_property_name&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
 const row=records[0];
 if(!row)return bad('Conecta Google Analytics antes de seleccionar una propiedad.',409);
 if(path==='/api/ga4/properties'&&method==='GET'){
  const list=await properties(env,row);return reply({properties:list,selected_property_id:row.selected_property_id||null});
 }
 if(path==='/api/ga4/select'&&method==='POST'){
  if(!sameOrigin(req)||(req.headers.get('Content-Type')||'').split(';')[0]!=='application/json')return bad('Origen o contenido no autorizado.',403);
  const raw=await req.text();if(raw.length>400)return bad('Solicitud demasiado grande.',413);
  let body;try{body=JSON.parse(raw)}catch{return bad('Solicitud inválida.');}
  const propertyId=String(body?.property_id||'');
  if(!PROPERTY.test(propertyId))return bad('Selecciona una propiedad válida.');
  const available=await properties(env,row),selected=available.find(x=>x.id===propertyId);
  if(!selected)return bad('Esta propiedad no está autorizada en tu cuenta de Google.',403);
  if(await propertyBelongsToAnotherBusiness(env,businessId,propertyId))return bad('Esta propiedad de Analytics ya pertenece a otra empresa de Edwin CRM. Selecciona una propiedad diferente para este negocio.',409);
  await db(env,'ed_ga4_connections','business_id=eq.'+encodeURIComponent(businessId),'PATCH',{selected_property_id:selected.id,selected_property_name:selected.name,updated_at:new Date().toISOString()});
  return reply({ok:true,property:selected});
 }
 if(path==='/api/ga4/disconnect'&&method==='POST'){
  if(!sameOrigin(req)||(req.headers.get('Content-Type')||'').split(';')[0]!=='application/json')return bad('Origen o contenido no autorizado.',403);
  await db(env,'ed_ga4_connections','business_id=eq.'+encodeURIComponent(businessId),'DELETE');return reply({ok:true});
 }
 return bad('Ruta GA4 no encontrada.',404);
}
