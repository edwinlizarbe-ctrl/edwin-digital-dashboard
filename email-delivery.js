/**
 * Production-safe optional campaign delivery for Brásper.
 * Every sending route defaults CLOSED until EMAIL_SENDING_ENABLED=true plus verified provider configuration.
 * No customer mail is sent by deploying this module.
 */
import {renderNewsletter} from './email-marketing.js';
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s||'');
const base=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'');
const resp=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function db(env,table,query='',method='GET',data){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Supabase service unavailable');
 const r=await fetch(base(env)+'/rest/v1/'+table+(query?'?'+query:''),{
  method,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'},
  ...(data===undefined?{}:{body:JSON.stringify(data)})
 });
 if(!r.ok)throw Error('Database error ('+r.status+')');
 return r.json();
}
async function rpc(env,name,data){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Supabase service unavailable');
 const r=await fetch(base(env)+'/rest/v1/rpc/'+name,{method:'POST',
  headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(data)});
 if(!r.ok){const info=await r.json().catch(()=>({}));throw Error(info.message||'No se pudo preparar la campaña.');}
 return r.json();
}
const operational=env=>env.EMAIL_SENDING_ENABLED==='true'&&uuid(env.BRASPER_BUSINESS_ID)&&!!env.RESEND_API_KEY&&!!env.EMAIL_FROM&&/^[a-f0-9]{64}$/i.test(env.EMAIL_UNSUBSCRIBE_KEY||'')&&String(env.RESEND_WEBHOOK_SECRET||'').startsWith('whsec_');
const now=()=>new Date().toISOString();
function hmacKey(env){const s=String(env.EMAIL_UNSUBSCRIBE_KEY||'');if(!/^[a-f0-9]{64}$/i.test(s))throw Error('Clave de bajas no configurada');return Uint8Array.from(s.match(/../g).map(x=>parseInt(x,16)));}
async function sign(secret,payload){
 const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
 return [...new Uint8Array(signature)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function unsubscribeLink(req,env,businessId,contactId){
 if(!uuid(businessId)||!uuid(contactId))throw Error('Invalid unsubscribe identifiers');
 const payload=businessId+'.'+contactId+'.'+Math.floor(Date.now()/1000+366*86400);
 const signature=await sign(hmacKey(env),payload);
 const u=new URL('/api/email-marketing/unsubscribe',new URL(req.url).origin);
 u.searchParams.set('token',payload+'.'+signature);return u.toString();
}
function unsubPage(valid,token=''){
 const safeToken=escape(token);
 const heading=valid?'Cancelar mi suscripción':'Enlace no válido';
 const body=valid?'<p>Si no deseas recibir noticias de Brásper, confirma la baja.</p><form method="POST"><input type="hidden" name="token" value="'+safeToken+'"><button type="submit">Confirmar baja</button></form>':'<p>Este enlace no es válido o ha caducado.</p>';
 return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brásper · Preferencias</title><body style="font-family:Arial,sans-serif;max-width:540px;padding:40px 18px;margin:auto;color:#183c65"><h1>'+heading+'</h1>'+body+'</body></html>';
}
async function decodeToken(env,token){
 const items=String(token||'').split('.');if(items.length!==4)return null;
 const [b,c,expiry,sig]=items;
 if(!uuid(b)||!uuid(c)||!(/^\d{10}$/.test(expiry))||Number(expiry)<Date.now()/1000||!(/^[a-f0-9]{64}$/i.test(sig)))return null;
 if(b!==env.BRASPER_BUSINESS_ID)return null;
 const expected=await sign(hmacKey(env),b+'.'+c+'.'+expiry);
 return equal(sig.toLowerCase(),expected)?{businessId:b,contactId:c}:null;
}
export async function publicMailRoute(req,env){
 const url=new URL(req.url);
 if(url.pathname==='/api/email-marketing/unsubscribe'){
  const isPost=req.method==='POST';
  let token=url.searchParams.get('token')||'';
  if(isPost){
   const type=req.headers.get('Content-Type')||'';
   if(type.includes('application/x-www-form-urlencoded'))token=String((await req.formData()).get('token')||token);
  }
  let parsed=null;
  try{parsed=await decodeToken(env,token);}catch{}
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow',
   'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
  if(!parsed)return new Response(unsubPage(false),{status:400,headers});
  if(!isPost)return new Response(unsubPage(true,token),{headers});
  // The token is the proof of control of the unsubscribe link. No login required.
  await db(env,'ed_email_contacts','id=eq.'+parsed.contactId+'&business_id=eq.'+parsed.businessId,'PATCH',{unsubscribed_at:now()});
  await db(env,'ed_email_deliveries','business_id=eq.'+parsed.businessId+'&contact_id=eq.'+parsed.contactId+'&status=eq.pending','PATCH',{status:'suppressed'});
  return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><h1>Tu baja se registró correctamente</h1><p>No recibirás más newsletters de Brásper.</p></html>',{headers});
 }
 if(url.pathname==='/api/email-marketing/webhook')return handleWebhook(req,env);
 return resp({error:'Not found'},404);
}
async function verifySvix(req,raw,env){
 const secret=String(env.RESEND_WEBHOOK_SECRET||''),id=req.headers.get('svix-id')||'',timestamp=req.headers.get('svix-timestamp')||'',sig=req.headers.get('svix-signature')||'';
 if(!secret.startsWith('whsec_')||!id||!timestamp||!sig||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const rawKey=Uint8Array.from(atob(secret.slice(6)),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('raw',rawKey,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(id+'.'+timestamp+'.'+raw));
 const signature=btoa(String.fromCharCode(...new Uint8Array(digest)));
 return sig.split(' ').some(x=>x.startsWith('v1,')&&equal(x.slice(3),signature));
}
async function handleWebhook(req,env){
 if(req.method!=='POST')return resp({error:'Method not allowed'},405);
 const raw=await req.text();if(raw.length>120000)return resp({error:'Payload too large'},413);
 if(!await verifySvix(req,raw,env).catch(()=>false))return resp({error:'Invalid signature'},401);
 const ev=JSON.parse(raw),eventId=req.headers.get('svix-id'),providerId=ev.data?.email_id;
 const kinds={'email.delivered':'delivered','email.opened':'opened','email.clicked':'clicked','email.bounced':'bounced','email.complained':'complained','email.failed':'failed','email.suppressed':'suppressed'};
 if(!kinds[ev.type]||!providerId)return resp({ok:true});
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const inserted=await fetch(base(env)+'/rest/v1/ed_email_webhook_events?on_conflict=event_id',{method:'POST',
  headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},
  body:JSON.stringify({event_id:eventId,event_type:ev.type})});
 if(!inserted.ok)return resp({error:'Event storage failed'},503);
 if(!(await inserted.json()).length)return resp({ok:true,duplicate:true});
 const match=await db(env,'ed_email_deliveries','select=id,business_id,contact_id,status&provider_message_id=eq.'+encodeURIComponent(providerId)+'&limit=1');
 if(!match.length)return resp({ok:true});
 const delivery=match[0];
 const ranks={pending:0,claimed:1,sent:2,delivered:3,opened:4,clicked:5,bounced:10,complained:11,failed:8,suppressed:12};
 const stage=kinds[ev.type];
 if((ranks[stage]||0)>=(ranks[delivery.status]||0)){
  await db(env,'ed_email_deliveries','id=eq.'+delivery.id+'&business_id=eq.'+delivery.business_id,'PATCH',
   {status:stage,last_event_at:now()});
 }
 if(['bounced','complained','suppressed'].includes(stage)){
  await db(env,'ed_email_contacts','id=eq.'+delivery.contact_id+'&business_id=eq.'+delivery.business_id,'PATCH',{unsubscribed_at:now()});
 }
 return resp({ok:true});
}
export async function broadcastAction(req,env,s,id,action,data){
 if(!operational(env))return resp({error:'Envíos deshabilitados. Verifica dominio, proveedor y secretos en Cloudflare.'},503);
 const cid=String(data.campaign_id||'');
 if(!uuid(cid))return resp({error:'Campaña inválida'},400);
 if(action==='schedule_campaign'){
  if(data.confirmation!=='CONFIRMO ENVÍO A CONTACTOS AUTORIZADOS')return resp({error:'Confirma expresamente que la lista tiene consentimiento.'},400);
  const scheduledAt=data.scheduled_at?new Date(data.scheduled_at):new Date(Date.now()+60000);
  if(!Number.isFinite(scheduledAt.getTime())||scheduledAt.getTime()<Date.now()-30000||scheduledAt.getTime()>Date.now()+90*86400000)return resp({error:'Fecha fuera de rango'},400);
  try{
   const queued=await rpc(env,'ed_email_schedule',{p_business:id,p_campaign:cid,p_actor:s.user.id,p_send_at:scheduledAt.toISOString()});
   return resp({queued,scheduled_at:scheduledAt.toISOString(),message:'Campaña aprobada y programada. No es un envío inmediato.'});
  }catch(e){return resp({error:e.message},400);}
 }
 if(action==='stop_campaign'){
  const current=await db(env,'ed_email_campaigns','select=id,status&business_id=eq.'+id+'&id=eq.'+cid+'&limit=1');
  if(!current.length||!['scheduled','sending','paused'].includes(current[0].status))return resp({error:'La campaña no está activa.'},400);
  const next=data.cancel===true?'cancelled':'paused';
  await db(env,'ed_email_campaigns','business_id=eq.'+id+'&id=eq.'+cid,'PATCH',{status:next,updated_at:now()});
  return resp({status:next});
 }
 if(action==='resume_campaign'){
  const rows=await db(env,'ed_email_campaigns','business_id=eq.'+id+'&id=eq.'+cid+'&status=eq.paused','PATCH',{status:'sending',updated_at:now()});
  return rows.length?resp({status:'sending'}):resp({error:'La campaña no estaba pausada.'},400);
 }
 return resp({error:'Unsupported action'},404);
}
async function completeCampaign(env,id,cid){
 const q='select=id,status&business_id=eq.'+id+'&campaign_id=eq.'+cid+'&status=in.(pending,claimed)&limit=1';
 const rows=await db(env,'ed_email_deliveries',q);
 if(rows.length===0)await db(env,'ed_email_campaigns','id=eq.'+cid+'&business_id=eq.'+id+'&status=eq.sending','PATCH',{status:'completed',updated_at:now()});
}
export async function processEmailQueue(env,reqBase='https://edwin-digital-dashboard.edwinlizarbe.workers.dev'){
 if(!operational(env))return {processed:0,disabled:true};
 const id=env.BRASPER_BUSINESS_ID;if(!uuid(id))return {processed:0,disabled:true};
 const claimed=await rpc(env,'ed_email_claim_batch',{p_business:id,p_limit:10});
 const completed=new Set();let sent=0,failed=0;
 for(const item of claimed){
  completed.add(item.campaign_id);
  try{
   const [campaign]=await db(env,'ed_email_campaigns','select=id,subject,preheader,blocks,language,status&business_id=eq.'+id+'&id=eq.'+item.campaign_id+'&limit=1');
   const [contact]=await db(env,'ed_email_contacts','select=id,name,email,company,language,consented_at,unsubscribed_at&business_id=eq.'+id+'&id=eq.'+item.contact_id+'&limit=1');
   if(!campaign||!['scheduled','sending'].includes(campaign.status)||!contact||contact.unsubscribed_at||!contact.consented_at||contact.language!==campaign.language){
    await db(env,'ed_email_deliveries','id=eq.'+item.id+'&business_id=eq.'+id,'PATCH',{status:'suppressed'});continue;
   }
   const url=await unsubscribeLink(new Request(reqBase),env,id,contact.id);
   const html=renderNewsletter(campaign,{name:contact.name,company:contact.company||'Brásper'}).replace('</footer>',
    '<p><a style="color:#176ad5" href="'+escape(url)+'">Cancelar suscripción</a></p></footer>');
   const subject=String(campaign.subject||'').replace(/\{\{\s*nombre\s*\}\}/gi,contact.name).replace(/\{\{\s*empresa\s*\}\}/gi,contact.company||'Brásper');
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
    Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'brasper/'+item.id
   },body:JSON.stringify({from:env.EMAIL_FROM,to:[contact.email],subject,html,
    headers:{'List-Unsubscribe':'<'+url+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},
    tags:[{name:'crm_campaign',value:item.campaign_id}]})});
   if(!response.ok){
    const retry=response.status===429||response.status>=500;
    await db(env,'ed_email_deliveries','id=eq.'+item.id+'&business_id=eq.'+id,'PATCH',{
     status:retry?'claimed':'failed',error_message:'Proveedor HTTP '+response.status
    });
    failed++;continue;
   }
   const result=await response.json();
   await db(env,'ed_email_deliveries','id=eq.'+item.id+'&business_id=eq.'+id,'PATCH',{status:'sent',sent_at:now(),provider_message_id:result.id});
   sent++;
  }catch(e){
   // Failed/disrupted API calls are held as claimed, never blindly repeated (duplicate protection).
   await db(env,'ed_email_deliveries','id=eq.'+item.id+'&business_id=eq.'+id,'PATCH',
    {status:'claimed',error_message:'Revisión de envío requerida'}).catch(()=>{});
   failed++;
  }
 }
 for(const cid of completed)await completeCampaign(env,id,cid);
 return {processed:claimed.length,sent,failed};
}
