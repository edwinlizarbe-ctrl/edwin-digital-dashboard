// Edwin CRM - Google Business Profile, server-side OAuth and read-only API usage.
// Google grants the broad business.manage scope; this module implements GET-only provider calls.
// Enabling this integration requires explicit Google GBP API approval and user consent.
import {ensureBusinessFeature} from './feature-access.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION=/^locations\/[0-9]{1,30}$/;
const SCOPE='https://www.googleapis.com/auth/business.manage';
const METRICS=['BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS','BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH','WEBSITE_CLICKS','CALL_CLICKS','BUSINESS_DIRECTION_REQUESTS'];
const PERIODS={'7d':7,'28d':28,'90d':90};
const base=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/';
const missing=env=>{
 const out=[];
 if(env.GOOGLE_BUSINESS_PROFILE_API_APPROVED!=='true')out.push('Aprobación de acceso a Google Business Profile API');
 if(!env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID)out.push('GOOGLE_BUSINESS_PROFILE_CLIENT_ID');
 if(!env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET)out.push('GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET');
 if(!/^[a-f0-9]{64}$/i.test(env.GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY||''))out.push('GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY');
 if(!env.SUPABASE_SERVICE_ROLE_KEY)out.push('SUPABASE_SERVICE_ROLE_KEY');
 return out;
};
const ready=env=>missing(env).length===0;
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
const cookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
function jar(req){const o={};for(const pair of (req.headers.get('Cookie')||'').split(';')){const n=pair.indexOf('=');if(n>0){try{o[pair.slice(0,n).trim()]=decodeURIComponent(pair.slice(n+1))}catch{}}}return o;}
async function aesKey(env){
 const bytes=(env.GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY||'').match(/../g)||[];
 if(bytes.length!==32)throw Error('Configuración de cifrado GBP incompleta.');
 return crypto.subtle.importKey('raw',Uint8Array.from(bytes,v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function seal(env,value){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(env),new TextEncoder().encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(cipher));}
async function openSeal(env,value){try{
 if(typeof value!=='string'||value.length>16000)return null;
 const [a,b]=value.split('.');if(!a||!b||un64(a).length!==12)return null;
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(a)},await aesKey(env),un64(b))));
}catch{return null;}}
function json(body,status=200,cookies=[]){
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(JSON.stringify(body),{status,headers:h});
}
async function allowed(env,s,id){
 if(!UUID.test(id)||!s?.access||s.user?.role==='admin')return false;
 // User JWT + Supabase RLS, not the privileged service role.
 const r=await fetch(base(env)+'businesses?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{
  headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});
 if(!r.ok)return false;
 const list=await r.json().catch(()=>[]);
 return Array.isArray(list)&&list.some(x=>x.id===id)&&await ensureBusinessFeature(env,s,id,'business_profile');
}
async function db(env,table,query='',method='GET',value){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw Error('Configuración privada de Supabase pendiente.');
 const h={apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json',Prefer:(method==='POST'&&table==='ed_gbp_connections'?'resolution=merge-duplicates,':'')+'return=representation'};
 const r=await fetch(base(env)+table+(query?'?'+query:''),{method,headers:h,...(value?{body:JSON.stringify(value)}:{})});
 if(!r.ok)throw Error('Almacenamiento de Google Business Profile no disponible (HTTP '+r.status+'). Comprueba la migración.');
 return r.json();
}
async function tokens(env,params){
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID,client_secret:env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET,...params})});
 if(!r.ok)throw Error('Google no autorizó el acceso (HTTP '+r.status+').');
 return r.json();
}
async function access(env,row){
 const secret=await openSeal(env,row.refresh_token_cipher);
 if(!secret?.refresh_token)throw Error('Autorización anterior inválida. Vuelve a conectar Google.');
 const result=await tokens(env,{grant_type:'refresh_token',refresh_token:secret.refresh_token});
 if(!result.access_token)throw Error('Google no pudo renovar la autorización. Reconecta tu perfil.');
 return result.access_token;
}
async function googleGet(token,url){
 const r=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
 if(!r.ok){
  const suffix=r.status===403?'Comprueba aprobación, cuotas y permisos sobre esta ficha.':r.status===429?'Límite de consultas de Google alcanzado.':'Comprueba la cuenta autorizada.';
  throw Error('La API de Google Business Profile devolvió HTTP '+r.status+'. '+suffix);
 }
 return r.json();
}
async function accounts(token){
 let out=[],page='';
 for(let i=0;i<5;i++){
  const u=new URL('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
  u.searchParams.set('pageSize','20');if(page)u.searchParams.set('pageToken',page);
  const x=await googleGet(token,u);
  out.push(...(x.accounts||[]).filter(a=>/^accounts\/[0-9]+$/.test(a.name||'')).map(a=>({name:a.name,title:String(a.accountName||a.name).slice(0,150)})));
  page=x.nextPageToken||'';if(!page)break;
 }
 return out.slice(0,100);
}
async function locations(token){
 const out=[],seen=new Set();let page='';
 for(let i=0;i<5;i++){
  const u=new URL('https://mybusinessbusinessinformation.googleapis.com/v1/accounts/-/locations');
  u.searchParams.set('pageSize','100');u.searchParams.set('readMask','name,title,storefrontAddress');if(page)u.searchParams.set('pageToken',page);
  const x=await googleGet(token,u);
  for(const loc of x.locations||[]){
   if(!LOCATION.test(loc.name||'')||seen.has(loc.name))continue;
   seen.add(loc.name);
   const addr=Array.isArray(loc.storefrontAddress?.addressLines)?loc.storefrontAddress.addressLines.join(', '):'';
   out.push({name:loc.name,title:String(loc.title||loc.name).slice(0,160),address:addr.slice(0,220)});
  }
  page=x.nextPageToken||'';if(!page)break;
 }
 return out;
}
const dateParts=d=>({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()});
async function report(token,location,period){
 const days=PERIODS[period]||28;
 // Use complete days in UTC, with a two-day availability buffer.
 const end=new Date(Date.now()-2*86400000),start=new Date(end.getTime()-(days-1)*86400000);
 const from=dateParts(start),to=dateParts(end);
 const u=new URL('https://businessprofileperformance.googleapis.com/v1/'+location+':fetchMultiDailyMetricsTimeSeries');
 for(const metric of METRICS)u.searchParams.append('dailyMetrics',metric);
 for(const [prefix,d] of [['start_date',from],['end_date',to]])for(const [k,v] of Object.entries(d))u.searchParams.set('dailyRange.'+prefix+'.'+k,String(v));
 const raw=await googleGet(token,u);
 const daily={};const byMetric={};
 for(const group of raw.multiDailyMetricTimeSeries||[])for(const part of group.dailyMetricTimeSeries||[]){
  const metric=part.dailyMetric;if(!METRICS.includes(metric))continue;
  let total=0,valid=0;
  for(const item of part.timeSeries?.datedValues||[]){
   const d=item.date||{},dt=[d.year,String(d.month).padStart(2,'0'),String(d.day).padStart(2,'0')].join('-');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dt))continue;
   // Do not fabricate missing measurements or treat an absent value as confirmed zero.
   if(item.value==null||!Number.isFinite(Number(item.value)))continue;
   const value=Number(item.value);if(value<0)continue;
   if(!daily[dt])daily[dt]={date:dt};
   daily[dt][metric]=(daily[dt][metric]||0)+value;total+=value;valid++;
  }
  if(valid)byMetric[metric]=(byMetric[metric]||0)+total;
 }
 return {location,period:{key:period,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)},
  totals:byMetric,daily:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)),partial:Object.keys(byMetric).length<METRICS.length,
  note:'Las métricas faltantes no se cuentan como cero. Impresiones por dispositivo y superficie no equivalen a personas únicas totales.'};
}
function sameOrigin(req){const o=req.headers.get('Origin');return !o||o===new URL(req.url).origin;}
function validPost(req){return sameOrigin(req)&&(req.headers.get('Content-Type')||'').split(';')[0].toLowerCase()==='application/json';}
function finish(req,pending,status,cookies){
 const origin=new URL(req.url).origin;
 if(pending.popup){
  const h=new Headers({'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-GBP_FINISH_NONCE'; frame-ancestors 'none'"});
  const nonce=b64(crypto.getRandomValues(new Uint8Array(16)));
  h.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; frame-ancestors 'none'");
  for(const c of cookies)h.append('Set-Cookie',c);
  const msg=JSON.stringify({type:'edwin-gbp-oauth',business_id:pending.business,result:status});
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Google Business Profile</title><style>body{font:16px system-ui;background:#f5f7ff;color:#173252;padding:45px;text-align:center}main{background:white;margin:auto;padding:30px;max-width:440px;border-radius:18px}</style></head><body><main><h2>Google Business Profile</h2><p>Resultado: '+(status==='connected'?'Autorización recibida':status==='cancelled'?'Autorización cancelada':'No se pudo conectar')+'</p><p>Vuelve al CRM.</p></main><script nonce="'+nonce+'">try{if(window.opener){window.opener.postMessage('+msg+','+JSON.stringify(origin)+');window.close()}}catch(e){}</script></body></html>';
  return new Response(html,{headers:h});
 }
 const url=new URL('/',origin);url.searchParams.set('gbp',status);url.searchParams.set('business_id',pending.business);
 const h=new Headers({Location:url.toString(),'Cache-Control':'no-store'});for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(null,{status:302,headers:h});
}
export async function handleBusinessProfileApi(req,env,s){
 const u=new URL(req.url),path=u.pathname,method=req.method.toUpperCase(),cookies=s.cookies||[];
 const reply=(value,code=200,extra=[])=>json(value,code,[...cookies,...extra]);
 const fail=(error,code=400)=>reply({error},code);
 const pending=path==='/api/business-profile/callback'?await openSeal(env,jar(req).ed_gbp_pending):null;
 const businessId=path==='/api/business-profile/callback'?pending?.business:u.searchParams.get('business_id')||'';
 if(!await allowed(env,s,businessId))return fail('No tienes acceso a Google Business Profile para esta empresa.',403);
 if(path==='/api/business-profile/status'&&method==='GET'){
  if(!ready(env))return reply({configured:false,connected:false,missing_config:missing(env)});
  const row=(await db(env,'ed_gbp_connections','select=business_id,refresh_token_cipher,selected_location,selected_title,updated_at&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1'))[0];
  const good=!!(await openSeal(env,row?.refresh_token_cipher))?.refresh_token;
  return reply({configured:true,connected:good,needs_reauthorization:!!row&&!good,selected_location:good?row.selected_location:null,selected_title:good?row.selected_title:null,updated_at:row?.updated_at||null});
 }
 if(!ready(env))return fail('La API de Google Business Profile requiere aprobación y configuración privada antes de habilitarse.',503);
 if(path==='/api/business-profile/connect'&&method==='GET'){
  const state=b64(crypto.getRandomValues(new Uint8Array(32))),until=Date.now()+600000;
  await db(env,'ed_gbp_oauth_nonces','','POST',{nonce_hash:await sha(state),user_id:s.user.id,business_id:businessId,expires_at:new Date(until).toISOString()});
  const auth=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID,redirect_uri:u.origin+'/api/business-profile/callback',response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state}))auth.searchParams.set(k,v);
  const h=new Headers({Location:auth.toString(),'Cache-Control':'no-store'});
  for(const c of [...cookies,cookie('ed_gbp_pending',await seal(env,{business:businessId,user:s.user.id,state,until,popup:u.searchParams.get('popup')==='1'}),600)])h.append('Set-Cookie',c);
  return new Response(null,{status:302,headers:h});
 }
 if(path==='/api/business-profile/callback'&&method==='GET'){
  const clear=cookie('ed_gbp_pending','',0);
  if(!pending||pending.user!==s.user.id||pending.until<Date.now()||pending.state!==u.searchParams.get('state'))return fail('Autorización de Google vencida o inválida.',403);
  const removed=await db(env,'ed_gbp_oauth_nonces','nonce_hash=eq.'+await sha(pending.state)+'&business_id=eq.'+encodeURIComponent(businessId)+'&user_id=eq.'+encodeURIComponent(s.user.id)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString()),'DELETE');
  if(removed.length!==1)return fail('Esta autorización ya se utilizó.',403);
  if(u.searchParams.has('error'))return finish(req,pending,'cancelled',[...cookies,clear]);
  const code=u.searchParams.get('code')||'';
  if(!code||code.length>4096)return finish(req,pending,'failed',[...cookies,clear]);
  try{
   const auth=await tokens(env,{grant_type:'authorization_code',code,redirect_uri:u.origin+'/api/business-profile/callback'});
   if(!auth.refresh_token||!auth.access_token)return finish(req,pending,'failed',[...cookies,clear]);
   // Check the real Google API before persisting credentials.
   await accounts(auth.access_token);
   await db(env,'ed_gbp_connections','on_conflict=business_id','POST',{business_id:businessId,user_id:s.user.id,refresh_token_cipher:await seal(env,{refresh_token:auth.refresh_token}),selected_location:null,selected_title:null,updated_at:new Date().toISOString()});
   return finish(req,pending,'connected',[...cookies,clear]);
  }catch{return finish(req,pending,'failed',[...cookies,clear]);}
 }
 const row=(await db(env,'ed_gbp_connections','select=business_id,refresh_token_cipher,selected_location,selected_title&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1'))[0];
 if(!row)return fail('Autoriza tu cuenta Google antes de continuar.',409);
 try{
  if(path==='/api/business-profile/accounts'&&method==='GET')return reply({accounts:await accounts(await access(env,row))});
  if(path==='/api/business-profile/locations'&&method==='GET')return reply({locations:await locations(await access(env,row)),selected_location:row.selected_location||null});
  if(path==='/api/business-profile/select-location'&&method==='POST'){
   if(!validPost(req))return fail('Origen o contenido no permitido.',403);
   const raw=await req.text();if(raw.length>600)return fail('Solicitud demasiado grande.',413);
   let x;try{x=JSON.parse(raw)}catch{return fail('Solicitud inválida.');}
   const name=String(x?.location||'');if(!LOCATION.test(name))return fail('Ubicación inválida.');
   const list=await locations(await access(env,row)),selected=list.find(x=>x.name===name);
   if(!selected)return fail('La ficha seleccionada no está autorizada por Google.',403);
   await db(env,'ed_gbp_connections','business_id=eq.'+encodeURIComponent(businessId),'PATCH',{selected_location:name,selected_title:selected.title,updated_at:new Date().toISOString()});
   return reply({ok:true,location:selected});
  }
  if(path==='/api/business-profile/report'&&method==='GET'){
   if(!row.selected_location||!LOCATION.test(row.selected_location))return fail('Selecciona una ficha de empresa primero.',409);
   const period=u.searchParams.get('period')||'28d';if(!PERIODS[period])return fail('Período inválido.');
   const data=await report(await access(env,row),row.selected_location,period);
   return reply({configured:true,location_title:row.selected_title,...data});
  }
  if(path==='/api/business-profile/disconnect'&&method==='POST'){
   if(!validPost(req))return fail('Origen o contenido no permitido.',403);
   await db(env,'ed_gbp_connections','business_id=eq.'+encodeURIComponent(businessId),'DELETE');
   return reply({ok:true});
  }
 }catch(e){return fail(String(e.message||'No se pudieron obtener datos de Google.').slice(0,220),502);}
 return fail('Ruta no encontrada.',404);
}