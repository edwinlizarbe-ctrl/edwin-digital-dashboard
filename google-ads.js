import { ensureBusinessFeature } from './feature-access.js';
// Google Ads OAuth integration. Server-only secrets, encrypted refresh tokens, tenant isolation.
const base = env => String(env.SUPABASE_URL||'').replace(/\/$/,'');
const validId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
const json = (body,status=200,cookies=[]) => {const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(JSON.stringify(body),{status,headers:h});};
const ck=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const jar=req=>Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(x=>{const i=x.indexOf('=');if(i<1)return ['', ''];try{return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}catch{return ['', '']}}).filter(x=>x[0]));
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function cipher(env){if(!/^[a-f0-9]{64}$/i.test(env.GOOGLE_ADS_ENCRYPTION_KEY||''))throw Error('Falta GOOGLE_ADS_ENCRYPTION_KEY (64 caracteres hexadecimales).');return crypto.subtle.importKey('raw',Uint8Array.from(env.GOOGLE_ADS_ENCRYPTION_KEY.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(env,data){const iv=crypto.getRandomValues(new Uint8Array(12));const e=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipher(env),new TextEncoder().encode(JSON.stringify(data)));return b64(iv)+'.'+b64(new Uint8Array(e));}
async function unseal(env,data){try{if(!data||data.length>10000)return null;const [a,b]=data.split('.');const iv=from64(a);if(iv.length!==12)return null;return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},await cipher(env),from64(b))))}catch{return null}}
async function sha(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');}
async function owns(env,s,id){if(!validId(id)||s.user.role==='admin')return false;const r=await fetch(base(env)+'/rest/v1/businesses?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});return r.ok&&(await r.json()).some(x=>x.id===id);}
async function permitted(env,s,id){return await owns(env,s,id)&&await ensureBusinessFeature(env,s,id,'google_ads');}
async function db(env,table,query='',method='GET',body){const k=env.SUPABASE_SERVICE_ROLE_KEY;if(!k)throw Error('Falta configuración segura de Supabase.');const r=await fetch(base(env)+'/rest/v1/'+table+(query?'?'+query:''),{method,headers:{apikey:k,Authorization:'Bearer '+k,Accept:'application/json','Content-Type':'application/json',Prefer:method==='POST'&&table==='ed_google_ads_connections'?'resolution=merge-duplicates,return=representation':'return=representation'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('No se pudo consultar el almacenamiento de Google Ads (HTTP '+r.status+').');return await r.json();}
const redirect=req=>new URL(req.url).origin+'/api/google-ads/callback';
// Result screen for the OAuth popup. Only our own origin receives the completion message.
function popupCompleted(req,result,businessId,cookies=[]){
 const origin=new URL(req.url).origin,nonce=b64(crypto.getRandomValues(new Uint8Array(16)));
 const title=result==='connected'?'Google Ads conectado':result==='cancelled'?'Autorización cancelada':'No se pudo completar la conexión';
 const description=result==='connected'?'Tu cuenta se autorizó correctamente. Puedes volver a Edwin CRM.':result==='cancelled'?'No se realizaron cambios. Puedes intentarlo otra vez.':'Google no entregó el acceso necesario. Vuelve a intentarlo desde Edwin CRM.';
 const payload=JSON.stringify({type:'edwin-google-ads-oauth',result,business_id:businessId});
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edwin CRM · Google Ads</title><style>body{min-height:100vh;margin:0;display:grid;place-items:center;background:#f5f7fc;color:#122b4b;font:15px/1.6 system-ui,-apple-system,sans-serif}.panel{max-width:390px;background:#fff;border:1px solid #dce6f5;box-shadow:0 16px 48px #102d5515;padding:34px 30px;text-align:center;border-radius:22px;margin:18px}.mark{margin:auto auto 17px;width:54px;height:54px;border-radius:16px;background:#e8f4ff;display:grid;place-items:center;font-size:29px;color:#1868da}h1{font-size:21px;line-height:1.3;margin:0 0 10px}p{font-size:14px;color:#64748b;margin:0 0 23px}a{display:inline-block;background:#156cdb;color:white;padding:10px 19px;border-radius:11px;font-weight:700;text-decoration:none}</style></head><body><main class="panel"><div class="mark">✓</div><h1>'+title+'</h1><p>'+description+'</p><a href="/">Volver a Edwin CRM</a></main><script nonce="'+nonce+'">try{if(window.opener&&window.opener!==window){window.opener.postMessage('+payload+','+JSON.stringify(origin)+');window.close();}}catch(e){}</script></body></html>';
 const h=new Headers({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'"});
 for(const cookie of cookies)h.append('Set-Cookie',cookie);
 return new Response(html,{status:200,headers:h});
}
function missingConfig(env){
 const missing=[];
 if(!env.GOOGLE_ADS_CLIENT_ID)missing.push('GOOGLE_ADS_CLIENT_ID');
 if(!env.GOOGLE_ADS_CLIENT_SECRET)missing.push('GOOGLE_ADS_CLIENT_SECRET');
 if(!env.SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SERVICE_ROLE_KEY');
 if(!/^[a-f0-9]{64}$/i.test(env.GOOGLE_ADS_ENCRYPTION_KEY||''))missing.push('GOOGLE_ADS_ENCRYPTION_KEY');
 return missing;
}
function ready(env){return missingConfig(env).length===0;}
async function oauthToken(env,values){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_ADS_CLIENT_ID,client_secret:env.GOOGLE_ADS_CLIENT_SECRET,...values})});if(!r.ok)throw Error('Google rechazó la autorización (HTTP '+r.status+').');return r.json();}
async function access(env,row){const t=await oauthToken(env,{grant_type:'refresh_token',refresh_token:(await unseal(env,row.refresh_token_cipher))?.refresh_token||''});if(!t.access_token)throw Error('No se pudo renovar el acceso. Vuelve a conectar Google Ads.');return t.access_token;}
async function ads(env,path,token,post,loginCustomerId){const h={Authorization:'Bearer '+token,Accept:'application/json'};if(loginCustomerId)h['login-customer-id']=loginCustomerId;/* Google Cloud project OAuth access: developer-token deprecated Sep 2026. */if(post)h['Content-Type']='application/json';const r=await fetch('https://googleads.googleapis.com/v25/'+path,{method:post?'POST':'GET',headers:h,...(post?{body:JSON.stringify(post)}:{})});if(!r.ok)throw Error('Google Ads API rechazó la consulta (HTTP '+r.status+'). Revisa el nivel de acceso y permisos.');return r.json();}
const cfg=(req,env)=>({callback:redirect(req),configured:ready(env)});
function sameOrigin(req){const o=req.headers.get('Origin');return !o||o===new URL(req.url).origin;}
const asRows=(x)=>Array.isArray(x)?x:[];
const validCustomerId=id=>/^[0-9]{10}$/.test(String(id||''));
async function availableAccounts(env,token){
 const response=await ads(env,'customers:listAccessibleCustomers',token);
 const roots=[...new Set(asRows(response.resourceNames).map(v=>String(v).split('/')[1]).filter(validCustomerId))];
 if(roots.length>30)throw Error('Demasiadas cuentas publicitarias directas.');
 const all=new Map(roots.map(id=>[id,{id,name:id,currency:null,manager:false,login_customer_id:null}]));
 let partial=false;
 for(const root of roots){
  try{
   const query="SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status = 'ENABLED'";
   let pageToken=null;
   for(let page=0;page<5;page++){
    const response=await ads(env,'customers/'+root+'/googleAds:search',token,{query,...(pageToken?{pageToken}:{})},root);
    for(const item of asRows(response.results)){
     const row=item.customerClient||{},id=String(row.id||'');
     if(!validCustomerId(id))continue;
     const current=all.get(id),candidate={id,name:row.descriptiveName||id,currency:row.currencyCode||null,manager:!!row.manager,login_customer_id:id===root?null:root};
     if(!current||id===root||(!current.login_customer_id&&current.name===current.id))all.set(id,candidate);
    }
    pageToken=response.nextPageToken||null;
    if(!pageToken)break;
    if(page===4)partial=true;
   }
  }catch{partial=true;}
 }
 return {accounts:[...all.values()].sort((a,b)=>a.name.localeCompare(b.name)),partial};
}
export async function handleGoogleAdsApi(req,env,s){
 const url=new URL(req.url),p=url.pathname,m=req.method.toUpperCase(),c=s.cookies||[], reply=(v,status=200,more=[])=>json(v,status,[...c,...more]);
 const error=(message,status=400)=>reply({error:message},status);
 const businessId=url.searchParams.get('business_id')||'';
 if(p==='/api/google-ads/callback'&&m==='GET'){
  const pending=await unseal(env,jar(req).ed_google_pending),clear=ck('ed_google_pending','',0);
  if(!pending||pending.until<Date.now()||pending.user!==s.user.id||pending.state!==url.searchParams.get('state'))return error('Autorización vencida o inválida.',403);
  if(!await permitted(env,s,pending.business))return error('Acceso a empresa no autorizado.',403);
  // Consume the nonce atomically before code exchange; only the first callback can succeed.
  const consumed=await db(env,'ed_google_oauth_nonces','nonce_hash=eq.'+encodeURIComponent(await sha(pending.state))+'&user_id=eq.'+encodeURIComponent(s.user.id)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
  if(!consumed.length)return error('Autorización ya utilizada o vencida.',403);
  const finish=result=>{
   if(pending.popup===true)return popupCompleted(req,result,pending.business,[...c,clear]);
   const home=new URL('/',url.origin);home.searchParams.set('google_ads',result);home.searchParams.set('business_id',pending.business);
   const headers=new Headers({Location:home.toString(),'Cache-Control':'no-store'});for(const cookie of [...c,clear])headers.append('Set-Cookie',cookie);
   return new Response(null,{status:302,headers});
  };
  if(url.searchParams.has('error'))return finish('cancelled');
  const code=url.searchParams.get('code')||'';if(!code||code.length>4096)return error('Google no devolvió un código válido.');
  const t=await oauthToken(env,{grant_type:'authorization_code',code,redirect_uri:redirect(req)});
  if(!t.refresh_token)return finish('no_refresh_token');
  await db(env,'ed_google_ads_connections','on_conflict=business_id','POST',{business_id:pending.business,user_id:s.user.id,refresh_token_cipher:await seal(env,{refresh_token:t.refresh_token}),selected_customer_id:null,selected_login_customer_id:null,updated_at:new Date().toISOString()});
  return finish('connected');
 }
 if(!await owns(env,s,businessId))return error('No tienes acceso a esta empresa.',403);
 if(!await ensureBusinessFeature(env,s,businessId,'google_ads'))return error('Google Ads no está habilitado para esta empresa.',403);
 if(p==='/api/google-ads/status'&&m==='GET'){
  const missing=missingConfig(env);
  if(missing.length){
   // The account may have an existing authorization even when Worker secrets
   // are missing. Do not treat a saved row as an active connection.
   let authorization_saved=null,selected_customer_id=null;
   if(env.SUPABASE_SERVICE_ROLE_KEY){
    try{
     const rows=await db(env,'ed_google_ads_connections','select=business_id,selected_customer_id&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
     authorization_saved=rows.length>0;
     selected_customer_id=rows[0]?.selected_customer_id||null;
    }catch{ /* Configuration status remains accessible if the database cannot be reached. */ }
   }
   return reply({configured:false,connected:false,authorization_saved,selected_customer_id,missing_config:missing,reason:'La configuración privada de Google Ads en Cloudflare está incompleta.'});
  }
  const rows=await db(env,'ed_google_ads_connections','select=business_id,refresh_token_cipher,selected_customer_id,updated_at&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
  // A saved row is not necessarily usable after a Worker encryption-key rotation.
  // Check decryptability locally; do not call Google or expose the token in status.
  const saved=rows[0]||null;
  const token=saved?await unseal(env,saved.refresh_token_cipher):null;
  const connected=typeof token?.refresh_token==='string'&&token.refresh_token.length>0;
  return reply({configured:true,connected,authorization_saved:!!saved,needs_reauthorization:!!saved&&!connected,selected_customer_id:connected?saved.selected_customer_id||null:null,updated_at:saved?.updated_at||null});
 }
 if(!ready(env))return error('Falta configurar GOOGLE_ADS_ENCRYPTION_KEY y las credenciales OAuth.',503);
 if(p==='/api/google-ads/connect'&&m==='GET'){
  const state=b64(crypto.getRandomValues(new Uint8Array(32))),until=Date.now()+600000;
  await db(env,'ed_google_oauth_nonces','','POST',{nonce_hash:await sha(state),user_id:s.user.id,business_id:businessId,expires_at:new Date(until).toISOString()});
  const pending=await seal(env,{state,user:s.user.id,business:businessId,until,popup:url.searchParams.get('popup')==='1'});
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:env.GOOGLE_ADS_CLIENT_ID,redirect_uri:redirect(req),response_type:'code',scope:'https://www.googleapis.com/auth/adwords',access_type:'offline',prompt:'consent',state}))auth.searchParams.set(k,v);
  const h=new Headers({Location:auth.toString(),'Cache-Control':'no-store'});for(const v of [...c,ck('ed_google_pending',pending,600)])h.append('Set-Cookie',v);return new Response(null,{status:302,headers:h});
 }
 const rows=await db(env,'ed_google_ads_connections','select=business_id,refresh_token_cipher,selected_customer_id,selected_login_customer_id&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
 if(!rows.length)return error('Primero conecta Google Ads.',401);
 const row=rows[0];
 if(p==='/api/google-ads/disconnect'&&m==='POST'){
  if(!sameOrigin(req)||(req.headers.get('Content-Type')||'').split(';')[0]!=='application/json')return error('Origen no autorizado.',403);
  await db(env,'ed_google_ads_connections','business_id=eq.'+encodeURIComponent(businessId),'DELETE');return reply({ok:true});
 }
 if(p==='/api/google-ads/accounts'&&m==='GET'){
  const found=await availableAccounts(env,await access(env,row));
  return reply({...found,selected_customer_id:row.selected_customer_id});
 }
 if(p==='/api/google-ads/select'&&m==='POST'){
  if(!sameOrigin(req)||(req.headers.get('Content-Type')||'').split(';')[0]!=='application/json')return error('Origen no autorizado.',403);
  const raw=await req.text();if(raw.length>500)return error('Solicitud demasiado grande.',413);
  let body;try{body=JSON.parse(raw)}catch{return error('Selección inválida.');}
  const id=String(body?.customer_id||'');
  if(!validCustomerId(id))return error('ID de cuenta inválido.');
  const available=await availableAccounts(env,await access(env,row));
  const chosen=available.accounts.find(v=>v.id===id);
  if(!chosen||chosen.manager)return error('Cuenta no autorizada o es administradora.',403);
  await db(env,'ed_google_ads_connections','business_id=eq.'+encodeURIComponent(businessId),'PATCH',{selected_customer_id:id,selected_login_customer_id:chosen.login_customer_id,updated_at:new Date().toISOString()});
  return reply({ok:true,selected_customer_id:id});
 }
 if(p==='/api/google-ads/campaigns'&&m==='GET'){
  if(!row.selected_customer_id)return error('Primero selecciona una cuenta publicitaria.');
  const days=Number(url.searchParams.get('days')||30);if(![7,30,90].includes(days))return error('Período inválido.');
  const token=await access(env,row),login=row.selected_login_customer_id||null;
  const profile=await ads(env,'customers/'+row.selected_customer_id+'/googleAds:search',token,{query:'SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1'},login);
  const details=asRows(profile.results)[0]?.customer;
  if(!details?.currencyCode||!details?.timeZone)return error('No se pudo obtener moneda o zona horaria de Google Ads.',502);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:details.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const digit=name=>Number(parts.find(x=>x.type===name)?.value);
  const today=Date.UTC(digit('year'),digit('month')-1,digit('day')),fmt=ms=>new Date(ms).toISOString().slice(0,10);
  const range=days===90?"segments.date BETWEEN '"+fmt(today-90*86400000)+"' AND '"+fmt(today-86400000)+"'":'segments.date DURING LAST_'+days+'_DAYS';
  const query='SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE '+range+' ORDER BY campaign.id';
  const pages=[];let pageToken=null,partial=false;
  for(let page=0;page<5;page++){
   const result=await ads(env,'customers/'+row.selected_customer_id+'/googleAds:search',token,{query,...(pageToken?{pageToken}:{})},login);
   pages.push(...asRows(result.results));pageToken=result.nextPageToken||null;
   if(!pageToken)break;
   if(page===4)partial=true;
  }
  const data=pages.map(r=>{
   const impressions=Number(r.metrics?.impressions||0),clicks=Number(r.metrics?.clicks||0),spend=Number(r.metrics?.costMicros||0)/1000000,conversions=Number(r.metrics?.conversions||0),value=Number(r.metrics?.conversionsValue||0);
   return {id:String(r.campaign?.id||''),name:r.campaign?.name||'',status:r.campaign?.status||'',impressions,clicks,spend,conversions,conversions_value:value,ctr:impressions?100*clicks/impressions:null,cpc:clicks?spend/clicks:null,roas:spend?value/spend:null,currency:details.currencyCode};
  });
  return reply({connected:true,customer_id:row.selected_customer_id,days,currency:details.currencyCode,rows:data,updated_at:new Date().toISOString(),partial});
 }
 return error('Ruta de Google Ads no encontrada.',404);
}
