/**
 * Edwin CRM — tenant-scoped, manual lead and opportunity pipeline.
 * No automatic conversion attribution or WhatsApp interception is claimed.
 */
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||'');
const sources=new Set(['google_ads','meta_ads','organic','referral','whatsapp','other']);
const stages=new Set(['new','contacted','qualified','won','lost']);
function result(data,status=200,cookies=[]){
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(JSON.stringify(data),{status,headers:h});
}
const dbUrl=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'');
async function authorized(env,s,businessId){
 if(!uuid(businessId)||s.user.role==='admin')return false;
 const r=await fetch(dbUrl(env)+'/rest/v1/businesses?select=id&id=eq.'+businessId+'&limit=1',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});
 const rows=await r.json().catch(()=>[]);return r.ok&&Array.isArray(rows)&&rows.some(x=>x.id===businessId);
}
async function query(env,params,method='GET',value){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw Error('Falta la configuración de almacenamiento privado.');
 const r=await fetch(dbUrl(env)+'/rest/v1/ed_crm_leads'+params,{
  method,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'},
  ...(value?{body:JSON.stringify(value)}:{})
 });
 if(!r.ok){if(r.status===404||r.status===400)throw Error('El módulo de oportunidades todavía requiere su migración segura.');throw Error('No fue posible consultar las oportunidades ('+r.status+').');}
 return await r.json();
}
const checkText=(value,max)=>typeof value==='string'&&value.length<=max;
const trim=(s,max)=>String(s||'').trim().slice(0,max);
const money=v=>v===null||v===undefined||v===''?null:Number(v);
function validateCreate(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return 'Datos inválidos.';
 if(!checkText(data.name,120)||trim(data.name,120).length<2)return 'Escribe el nombre del contacto (2–120 caracteres).';
 if(!checkText(data.email||'',160)||!checkText(data.phone||'',35)||!checkText(data.campaign||'',150)||!checkText(data.notes||'',500))return 'Un campo supera el límite permitido.';
 if(data.email&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return 'El correo no tiene formato válido.';
 if(!sources.has(data.source))return 'Selecciona un origen válido.';
 if(!stages.has(data.stage||'new'))return 'Selecciona una etapa válida.';
 if(data.currency&&!/^[A-Z]{3}$/.test(data.currency))return 'Selecciona una moneda válida.';
 const m=money(data.amount);if(m!==null&&(!Number.isFinite(m)||m<0||m>10000000000))return 'El importe no es válido.';
 return null;
}
export async function handleLeadsApi(req,env,s){
 const url=new URL(req.url),method=req.method.toUpperCase(),businessId=url.searchParams.get('business_id')||'';
 const reply=(data,status)=>result(data,status,s.cookies||[]);
 if(!await authorized(env,s,businessId))return reply({error:'No tienes acceso a esta empresa.'},403);
 if(!['GET','POST','PATCH'].includes(method))return reply({error:'Método no permitido.'},405);
 if(method!=='GET'){
  const origin=req.headers.get('Origin');
  if(origin&&origin!==url.origin)return reply({error:'Origen no permitido.'},403);
  if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return reply({error:'Se requiere JSON.'},415);
  const raw=await req.text();
  if(raw.length>4096)return reply({error:'Solicitud demasiado extensa.'},413);
  let data;try{data=JSON.parse(raw)}catch{return reply({error:'Solicitud inválida.'},400);}
  if(method==='POST'){
   const error=validateCreate(data);if(error)return reply({error},400);
   const row={
    business_id:businessId,created_by:s.user.id,name:trim(data.name,120),
    email:trim(data.email,160)||null,phone:trim(data.phone,35)||null,
    source:data.source,stage:data.stage||'new',campaign:trim(data.campaign,150)||null,
    notes:trim(data.notes,500)||null,amount:money(data.amount),
    currency: data.currency||'PEN'
   };
   try{const rows=await query(env,'','POST',row);return reply({lead:rows[0]},201)}
   catch(e){return reply({error:e.message},503);}
  }
  const id=url.searchParams.get('lead_id')||'';
  if(!uuid(id))return reply({error:'ID de oportunidad inválido.'},400);
  if(!data||typeof data!=='object'||Array.isArray(data)||!stages.has(data.stage))return reply({error:'Etapa no válida.'},400);
  const updated={stage:data.stage,updated_at:new Date().toISOString()};
  if(Object.hasOwn(data,'amount')){
   const amount=money(data.amount);
   if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>10000000000))return reply({error:'Importe inválido.'},400);
   updated.amount=amount;
  }
  try{const rows=await query(env,'?business_id=eq.'+businessId+'&id=eq.'+id,'PATCH',updated);return rows.length?reply({lead:rows[0]}):reply({error:'Oportunidad no encontrada en esta empresa.'},404);}
  catch(e){return reply({error:e.message},503);}
 }
 try{
  const rows=await query(env,'?select=id,business_id,name,email,phone,source,stage,campaign,notes,amount,currency,created_at,updated_at&business_id=eq.'+businessId+'&order=created_at.desc&limit=101');
  return reply({leads:rows.slice(0,100),partial:rows.length>100});
 }catch(e){return reply({error:e.message},503);}
}
