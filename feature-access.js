/**
 * E Digital.IA · business integration entitlements (manual administrative provisioning).
 * Never trust client-provided switches. Changes require a verified admin session.
 * Read paths verify tenant membership through its RLS-protected businesses table.
 * Before the migration is applied, existing GA4/Meta behavior is preserved.
 */
export const ED_FEATURES=Object.freeze(['ga4','search_console','social_organic','hotmart','shopify','meta_ads','google_ads','tiktok_ads','linkedin_ads']);
export const DEFAULT_FEATURES=Object.freeze({
 ga4:true,search_console:false,social_organic:false,hotmart:false,shopify:false,
 meta_ads:true,google_ads:false,tiktok_ads:false,linkedin_ads:false
});
const validId=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x||'');
const response=(data,status=200,cookies=[])=>{
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 cookies.forEach(x=>headers.append('Set-Cookie',x));
 return new Response(JSON.stringify(data),{status,headers});
};
const supaBase=env=>String(env.SUPABASE_URL||'').replace(/\/$/,'');
async function ownsBusiness(env,s,id){
 const r=await fetch(supaBase(env)+'/rest/v1/businesses?select=id&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});
 if(!r.ok)return false;
 const list=await r.json().catch(()=>[]);
 return Array.isArray(list)&&list.some(x=>x.id===id);
}
async function featureRow(env,id){
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return {configured:false,row:null};
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(supaBase(env)+'/rest/v1/ed_business_features?select=business_id,plan,features,updated_at&business_id=eq.'+encodeURIComponent(id)+'&limit=1',{
  headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}
 });
 if(!r.ok)return {configured:false,row:null};
 const rows=await r.json().catch(()=>[]);
 return {configured:true,row:rows[0]||null};
}
export async function readBusinessEntitlements(env,s,id){
 if(!validId(id)||!await ownsBusiness(env,s,id))return null;
 const data=await featureRow(env,id);
 return {configured:data.configured,
  business_id:id,plan:data.row?.plan||null,
  features:{...DEFAULT_FEATURES,...(data.row?.features||{})},
  updated_at:data.row?.updated_at||null,
  provisioned:!!data.row};
}
export async function ensureBusinessFeature(env,s,id,feature){
 if(!ED_FEATURES.includes(feature))return false;
 const data=await readBusinessEntitlements(env,s,id);
 // Preserve the existing app's behavior until the SQL migration is applied.
 return !!data?.features?.[feature];
}
export async function handleFeaturesApi(req,env,s){
 const url=new URL(req.url),path=url.pathname,method=req.method.toUpperCase();
 if(path==='/api/client/features'&&method==='GET'){
  const id=url.searchParams.get('business_id')||'';
  const data=await readBusinessEntitlements(env,s,id);
  if(!data)return response({error:'No tienes acceso a esta empresa.'},403,s.cookies);
  return response(data,200,s.cookies);
 }
 if(!path.startsWith('/api/admin/business-features'))return response({error:'Ruta inexistente.'},404,s.cookies);
 if(s.user.role!=='admin')return response({error:'Acceso exclusivo del administrador.'},403,s.cookies);
 if(method==='GET'&&url.searchParams.get('list')==='1'){
  if(!env.SUPABASE_SERVICE_ROLE_KEY)return response({configured:false,plans:[],reason:'Falta SUPABASE_SERVICE_ROLE_KEY.'},200,s.cookies);
  const permitted=await fetch(supaBase(env)+'/rest/v1/businesses?select=id&limit=500',{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access}});
  if(!permitted.ok)return response({error:'No fue posible consultar las empresas autorizadas.'},403,s.cookies);
  const allowed=(await permitted.json()).map(x=>x.id).filter(validId);
  if(!allowed.length)return response({configured:true,plans:[]},200,s.cookies);
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(supaBase(env)+'/rest/v1/ed_business_features?select=business_id,plan,updated_at&business_id=in.('+allowed.join(',')+')&limit=500',{
   headers:{apikey:key,Authorization:'Bearer '+key}
  });
  if(!r.ok)return response({configured:false,plans:[],reason:'La tabla de permisos todavía necesita la migración.'},200,s.cookies);
  return response({configured:true,plans:await r.json()},200,s.cookies);
 }
 if(method==='GET'){
  const id=url.searchParams.get('business_id')||'';
  const data=await readBusinessEntitlements(env,s,id);
  if(!data)return response({error:'La empresa no está autorizada.'},403,s.cookies);
  return response(data,200,s.cookies);
 }
 if(method!=='POST')return response({error:'Método no admitido.'},405,s.cookies);
 const origin=req.headers.get('Origin');
 if(origin&&origin!==url.origin)return response({error:'Origen no autorizado.'},403,s.cookies);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
  return response({error:'Se requiere JSON.'},415,s.cookies);
 let input={};
 try{const raw=await req.text();if(raw.length>2200)throw new Error();input=JSON.parse(raw)}
 catch{return response({error:'La solicitud contiene datos inválidos.'},400,s.cookies);}
 const id=String(input.business_id||''),feature=String(input.feature||'');
 if(!validId(id)||!await ownsBusiness(env,s,id))return response({error:'La empresa no está autorizada.'},403,s.cookies);
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Configura SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'},503,s.cookies);
 const current=await featureRow(env,id);
 if(!current.configured)return response({error:'Antes de guardar, aplica la migración de permisos en Supabase.'},503,s.cookies);
 if(feature&&!ED_FEATURES.includes(feature))return response({error:'Integración desconocida.'},400,s.cookies);
 if(feature&&typeof input.enabled!=='boolean')return response({error:'Selecciona Activado o Desactivado.'},400,s.cookies);
 if(!feature&&!['premium','free'].includes(input.plan))return response({error:'Plan no reconocido.'},400,s.cookies);
 const before=current.row;
 // Premium always includes every feature entitlement; this does NOT imply that
 // a provider API marked as coming soon is already operational.
 const plan=feature?(before?.plan||null):input.plan;
 if(feature&&plan!=='free')
  return response({error:'Premium incluye todos los accesos. Para personalizar interruptores asigna primero Free.'},409,s.cookies);
 const freeDefault={...DEFAULT_FEATURES,meta_ads:false};
 let features;
 if(!feature){
   if(plan==='premium')features=Object.fromEntries(ED_FEATURES.map(key=>[key,true]));
   else features={...freeDefault};
 }else{
   features={...freeDefault,...(before?.features||{})};
   features[feature]=input.enabled;
 }
 if(!['free','premium'].includes(plan))return response({error:'Selecciona un plan antes de modificar los permisos.'},409,s.cookies);
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const r=await fetch(supaBase(env)+'/rest/v1/ed_business_features?on_conflict=business_id',{
  method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},
  body:JSON.stringify({business_id:id,plan,features,updated_by:s.user.id})
 });
 if(!r.ok)return response({error:'No fue posible guardar la configuración. Vuelve a intentarlo.'},502,s.cookies);
 const rows=await r.json().catch(()=>[]);
 return response({ok:true,configured:true,business_id:id,plan,features,updated_at:rows[0]?.updated_at||null},200,s.cookies);
}
