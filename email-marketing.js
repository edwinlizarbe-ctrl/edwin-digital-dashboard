import {broadcastAction} from './email-delivery.js';
/**
 * Brásper Email Marketing MVP.
 * Tenant-locked, consent-only contact import, structured newsletter drafts,
 * media library and allowlisted SINGLE-recipient test mail via Resend.
 * No production/bulk send endpoint exists.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reply=(data,status=200,cookies=[])=>{
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 cookies.forEach(c=>h.append('Set-Cookie',c));return new Response(JSON.stringify(data),{status,headers:h});
};
const base=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'');
function safe(x,n=200){return String(x??'').trim().slice(0,n)}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function https(x){try{const u=new URL(String(x));return u.protocol==='https:'&&!!u.hostname?u.toString():'';}catch{return '';}}
function escapeAttr(x){return esc(x);}
async function allowed(env,s,id){
 if(!UUID.test(id)||s.user?.role==='admin'||(env.BRASPER_BUSINESS_ID&&id!==env.BRASPER_BUSINESS_ID))return false;
 const r=await fetch(base(env)+'/rest/v1/businesses?select=id,slug&id=eq.'+encodeURIComponent(id)+'&limit=1',{
  headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access,Accept:'application/json'}
 });
 if(!r.ok)return false;
 const rows=await r.json().catch(()=>[]);
 return Array.isArray(rows)&&rows.some(x=>x.id===id&&x.slug==='brasper');
}
async function db(env,table,query='',method='GET',body,prefer='return=representation'){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Falta conexión segura de Supabase.');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(base(env)+'/rest/v1/'+table+(query?'?'+query:''),{
  method,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json',
   'Content-Type':'application/json',Prefer:prefer},...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 if(!r.ok)throw Error('No fue posible consultar Email Marketing (HTTP '+r.status+').');
 return r.json();
}
function validBlocks(blocks){
 if(!Array.isArray(blocks)||!blocks.length||blocks.length>18)return false;
 return blocks.every(b=>b&&typeof b==='object'&&!Array.isArray(b)&&
  (b.type==='heading'&&typeof b.text==='string'&&b.text.length<=140
  ||b.type==='text'&&typeof b.text==='string'&&b.text.length<=2000
  ||b.type==='image'&&typeof b.url==='string'&&!!https(b.url)&&typeof (b.alt||'')==='string'&&(b.alt||'').length<=140
  ||b.type==='button'&&typeof b.text==='string'&&b.text.length<=100&&typeof b.url==='string'&&!!https(b.url)));
}
function personalized(s,person){return String(s).replace(/\{\{\s*(nombre|empresa)\s*\}\}/gi,(_,k)=>k.toLowerCase()==='nombre'?person.name:person.company);}
export function renderNewsletter(campaign,person={name:'Amiga/o',company:'Brásper'}){
 const subject=safe(campaign.subject,150),blocks=campaign.blocks||[];
 if(!validBlocks(blocks))throw Error('El newsletter tiene bloques inválidos.');
 const brand='#1366F8';
 const inner=blocks.map(b=>{
  if(b.type==='heading')return '<h2 style="font-size:25px;line-height:1.25;color:#142b49;margin:26px 0 14px">'+esc(personalized(b.text,person))+'</h2>';
  if(b.type==='text')return '<p style="color:#32465c;font-size:16px;line-height:1.75;white-space:pre-line;margin:12px 0">'+esc(personalized(b.text,person)).replace(/\n/g,'<br>')+'</p>';
  if(b.type==='image')return '<img src="'+escapeAttr(https(b.url))+'" alt="'+escapeAttr(b.alt||'Imagen de Brásper')+'" style="display:block;width:100%;max-width:600px;height:auto;border-radius:15px;margin:18px auto">';
  if(b.type==='button')return '<p style="text-align:center;margin:26px 0"><a href="'+escapeAttr(https(b.url))+'" style="display:inline-block;background:'+brand+';color:#ffffff;padding:15px 25px;border-radius:11px;text-decoration:none;font-weight:700">'+esc(personalized(b.text,person))+'</a></p>';
  return '';
 }).join('');
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body style="margin:0;background:#f2f6fc;font-family:Arial,Helvetica,sans-serif;color:#142b49"><div style="display:none;max-height:0;overflow:hidden;opacity:0">'+esc(personalized(campaign.preheader||'',person))+'</div>'+
 '<main style="max-width:600px;margin:30px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #dce7f8"><div style="background:'+brand+';color:#fff;padding:27px 32px;font-size:25px;font-weight:800">brasper<span style="font-size:12px;font-weight:400;float:right">Perú ↔ Brasil</span></div>'+
 '<div style="padding:22px 32px">'+inner+'</div><footer style="background:#f8fbff;border-top:1px solid #e4edfa;color:#6b7e91;font-size:12px;line-height:1.6;padding:20px 32px">'+
 'Brásper · Recibes este mensaje porque te suscribiste a nuestras comunicaciones. Puedes darte de baja desde el enlace incluido en el correo.</footer></main></body></html>';
}
const TEMPLATE=[
 {type:'heading',text:'Olá, {{nombre}}! 🇧🇷🇵🇪'},
 {type:'text',text:'Seguimos conectando Perú y Brasil. Conoce las novedades de Brásper y disfruta de una atención humana y segura.'},
 {type:'button',text:'Conoce Brásper',url:'https://brasper.com'}
];
function campaignValues(data,id){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Datos de campaña inválidos.');
 const title=safe(data.title,120),subject=safe(data.subject,150);
 if(title.length<3||subject.length<3)throw Error('Escribe el título y el asunto del newsletter.');
 if(typeof data.title!=='string'||data.title.length>120||typeof data.subject!=='string'||data.subject.length>150)throw Error('Título o asunto demasiado largo.');
 if(typeof (data.preheader||'')!=='string'||(data.preheader||'').length>180)throw Error('Preencabezado demasiado largo.');
 if(!['es','pt'].includes(data.language))throw Error('Selecciona idioma español o portugués.');
 if(!validBlocks(data.blocks))throw Error('Revisa textos, imágenes y botones del newsletter.');
 return {business_id:id,title,subject,preheader:safe(data.preheader,180),language:data.language,
  blocks:data.blocks,status:'draft',updated_at:new Date().toISOString()};
}
async function uploadImage(env,id,data){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Supabase no está configurado.');
 const mime=data?.mime;
 if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('Solo JPG, PNG o WebP.');
 const encoded=String(data?.base64||'');
 if(encoded.length>3_000_000||!encoded||!/^[a-zA-Z0-9+/]+=*$/.test(encoded))throw Error('Imagen inválida o demasiado grande (máximo 2 MB).');
 const bytes=Uint8Array.from(atob(encoded),x=>x.charCodeAt(0));
 if(bytes.length>2_000_000)throw Error('Imagen demasiado grande.');
 const signatures={'image/jpeg':bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'image/png':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,'image/webp':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'};
 if(!signatures[mime])throw Error('El archivo no coincide con su formato.');
 const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
 const key=id+'/'+crypto.randomUUID()+'.'+extension;
 const api=base(env)+'/storage/v1/object/brasper-newsletter-assets/'+key;
 const r=await fetch(api,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
  'Content-Type':mime,'x-upsert':'false'},body:bytes});
 if(!r.ok)throw Error('No se pudo subir la imagen. Verifica el bucket público Brásper.');
 const url=base(env)+'/storage/v1/object/public/brasper-newsletter-assets/'+key;
 await db(env,'ed_email_assets','','POST',{business_id:id,path:key,url,mime});
 return {url};
}
export async function handleEmailMarketingApi(req,env,s){
 const url=new URL(req.url),id=url.searchParams.get('business_id')||'',method=req.method.toUpperCase();
 const send=(x,status=200)=>reply(x,status,s.cookies||[]);
 if(!await allowed(env,s,id))return send({error:'Email Marketing está restringido a Brásper. Primero vincula BRASPER_BUSINESS_ID y autoriza a su usuario.'},403);
 if(method==='GET'){
  const view=url.searchParams.get('view')||'overview',filter='business_id=eq.'+encodeURIComponent(id);
  try{
   if(view==='overview'){
    const [campaigns,contacts,assets,deliveries]=await Promise.all([
     db(env,'ed_email_campaigns','select=id,title,subject,preheader,language,blocks,status,created_at,updated_at&'+filter+'&order=updated_at.desc&limit=40'),
     db(env,'ed_email_contacts','select=id,name,email,language,company,consented_at,unsubscribed_at,created_at&'+filter+'&order=created_at.desc&limit=300'),
     db(env,'ed_email_assets','select=id,url,mime,created_at&'+filter+'&order=created_at.desc&limit=50'),
     db(env,'ed_email_deliveries','select=campaign_id,status&'+filter+'&order=created_at.desc&limit=2000')
    ]);
    const stats={};for(const d of deliveries){const x=stats[d.campaign_id]||(stats[d.campaign_id]={total:0,sent:0,delivered:0,opened:0,clicked:0,bounced:0,failed:0,suppressed:0,pending:0});x.total++;if(x[d.status]!==undefined)x[d.status]++;}return send({campaigns,contacts,assets,stats,configured:!!env.RESEND_API_KEY,template:TEMPLATE,mass_sending_enabled:env.EMAIL_SENDING_ENABLED==='true',sending_ready:env.EMAIL_SENDING_ENABLED==='true'&&!!env.RESEND_API_KEY&&!!env.EMAIL_FROM&&!!env.EMAIL_UNSUBSCRIBE_KEY&&!!env.RESEND_WEBHOOK_SECRET,stats_partial:deliveries.length===2000});
   }
   return send({error:'Vista inexistente.'},404);
  }catch(e){return send({error:e.message},503);}
 }
 if(method!=='POST')return send({error:'Método no permitido.'},405);
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin)return send({error:'Origen no autorizado.'},403);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return send({error:'Envía JSON.'},415);
 const raw=await req.text();if(raw.length>3_200_000)return send({error:'Solicitud demasiado grande.'},413);
 let body;try{body=JSON.parse(raw)}catch{return send({error:'JSON inválido.'},400);}
 const action=body?.action;
 try{
  if(['schedule_campaign','stop_campaign','resume_campaign'].includes(action))return broadcastAction(req,env,s,id,action,body);
  if(action==='save_campaign'){
   const values=campaignValues(body.campaign,id);
   const cid=body.campaign?.id;
   if(cid){
    if(!UUID.test(cid))return send({error:'ID inválido.'},400);
    const rows=await db(env,'ed_email_campaigns','business_id=eq.'+id+'&id=eq.'+cid+'&status=eq.draft','PATCH',values);
    return rows.length?send({campaign:rows[0]}):send({error:'Campaña inexistente.'},404);
   }
   const rows=await db(env,'ed_email_campaigns','','POST',values);return send({campaign:rows[0]},201);
  }
  if(action==='duplicate_campaign'){
   const cid=body?.campaign_id;if(!UUID.test(cid))return send({error:'ID inválido.'},400);
   const items=await db(env,'ed_email_campaigns','select=title,subject,preheader,language,blocks&business_id=eq.'+id+'&id=eq.'+cid+'&limit=1');
   if(!items.length)return send({error:'Campaña no encontrada.'},404);
   const v=campaignValues({...items[0],title:'Copia · '+items[0].title},id);
   const rows=await db(env,'ed_email_campaigns','','POST',v);return send({campaign:rows[0]},201);
  }
  if(action==='import_contacts'){
   const list=body.contacts;
   if(!Array.isArray(list)||!list.length||list.length>300)return send({error:'Importa entre 1 y 300 contactos por lote.'},400);
   const unique=new Map();
   for(const c of list){
    if(!c||typeof c!=='object'||c.consent!==true)continue;
    const email=safe(c.email,200).toLowerCase(),name=safe(c.name,100),company=safe(c.company||'',100),language=c.language==='pt'?'pt':'es';
    if(EMAIL.test(email)&&email.length<=200&&name.length>=2)unique.set(email,{business_id:id,email,name,company,language,consented_at:new Date().toISOString(),consent_source:'importación CSV con declaración expresa'});
   }
   if(!unique.size)return send({error:'Ningún contacto válido con consentimiento explícito.'},400);
   const rows=await db(env,'ed_email_contacts','on_conflict=business_id,email','POST',[...unique.values()],
    'resolution=ignore-duplicates,return=representation');
   return send({added:rows.length,skipped:list.length-rows.length});
  }
  if(action==='unsubscribe_contact'){
   const cid=body.contact_id;if(!UUID.test(cid))return send({error:'ID inválido.'},400);
   const rows=await db(env,'ed_email_contacts','business_id=eq.'+id+'&id=eq.'+cid,'PATCH',{unsubscribed_at:new Date().toISOString()});
   return rows.length?send({ok:true}):send({error:'Contacto no encontrado.'},404);
  }
  if(action==='upload_image')return send(await uploadImage(env,id,body));
  if(action==='test_email'){
   const destination=safe(body.to,200).toLowerCase();
   if(!EMAIL.test(destination))return send({error:'Introduce un correo válido.'},400);
   const allow=(env.EMAIL_TEST_RECIPIENTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(!allow.includes(destination))return send({error:'Destinatario de prueba no permitido. Agrégalo a EMAIL_TEST_RECIPIENTS.'},403);
   if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return send({error:'Falta configurar RESEND_API_KEY o EMAIL_FROM en Cloudflare.'},503);
   const campaign=campaignValues(body.campaign,id),html=renderNewsletter(campaign,{name:'Prueba',company:'Brásper'});
   const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:env.EMAIL_FROM,to:[destination],subject:'[PRUEBA] '+campaign.subject,html})});
   if(!r.ok)return send({error:'El proveedor no aceptó la prueba (HTTP '+r.status+').'},502);
   return send({ok:true,message:'Se solicitó un único correo de prueba al proveedor. Revisa su entrega.'});
  }
  return send({error:'Acción no disponible; no existe un endpoint para envíos masivos.'},404);
 }catch(e){return send({error:e.message},400);}
}
