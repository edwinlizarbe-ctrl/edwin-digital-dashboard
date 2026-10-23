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
// ED_FEATURES_STRICT=1|true: never fall back to the legacy GA4/Meta defaults when
// the service key or migration is missing; deny everything instead. Off by default.
export const strictMode=env=>['1','true'].includes(String(env?.ED_FEATURES_STRICT||'').trim().toLowerCase());
const warned=new Set();
export const resetFeatureWarnings=()=>warned.clear();
// One log line per reason and isolate; never includes ids, tokens or URLs.
function warnOnce(reason,strict){
 const key=reason+(strict?':strict':':legacy');
 if(warned.has(key))return;warned.add(key);
 console.warn(strict
  ?'[feature-access] SECURITY: entitlements unavailable ('+reason+'); ED_FEATURES_STRICT is on, all features are denied.'
  :'[feature-access] SECURITY: entitlements unavailable ('+reason+'); legacy defaults grant GA4 and Meta Ads to every business. Provision the migration and set ED_FEATURES_STRICT=1.');
}
const ALL_DENIED=Object.freeze(Object.fromEntries(ED_FEATURES.map(feature=>[feature,false])));
const isPlainObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
// Keep only known switches with boolean values so malformed stored data can neither
// grant unknown entitlements nor leak non-boolean truthy values.
const knownFlags=raw=>isPlainObject(raw)?Object.fromEntries(ED_FEATURES.filter(k=>typeof raw[k]==='boolean').map(k=>[k,raw[k]])):{};
// States: {configured:false,available:true}  -> service key or migration missing (legacy defaults apply)
//         {configured:true,available:true}   -> table readable
//         {configured:true,available:false}  -> table exists but could not be read: fail closed
async function featureRow(env,id){
 const strict=strictMode(env);
 // Legacy fallback: allowed only outside strict mode; strict denies and reports it.
 const legacy=reason=>{warnOnce(reason,strict);return {configured:false,available:!strict,strictBlocked:strict,row:null};};
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return legacy('service key missing');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 let r;
 try{
  r=await fetch(supaBase(env)+'/rest/v1/ed_business_features?select=business_id,plan,features,updated_at&business_id=eq.'+encodeURIComponent(id)+'&limit=1',{
   headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}
  });
 }catch{return {configured:true,available:false,row:null};}
 if(!r.ok){
  // Only a missing table (migration not applied) keeps the legacy behavior.
  const err=r.status===404?await r.json().catch(()=>null):null;
  if(err&&(err.code==='PGRST205'||err.code==='42P01'))return legacy('migration not applied');
  return {configured:true,available:false,row:null};
 }
 const rows=await r.json().catch(()=>null);
 if(!Array.isArray(rows))return {configured:true,available:false,row:null};
 return {configured:true,available:true,row:rows[0]||null};
}
export async function readBusinessEntitlements(env,s,id){
 if(!validId(id)||!await ownsBusiness(env,s,id))return null;
 const data=await featureRow(env,id);
 if(!data.available)return {configured:!data.strictBlocked,unavailable:true,strict_blocked:!!data.strictBlocked,business_id:id,plan:null,features:{...ALL_DENIED},updated_at:null,provisioned:false};
 const plan=data.row?.plan||null;
 const features=plan==='premium'
  ?Object.fromEntries(ED_FEATURES.map(feature=>[feature,true]))
  :{...DEFAULT_FEATURES,...knownFlags(data.row?.features)};
 return {configured:data.configured,
  business_id:id,plan,features,
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
 if(path==='/api/admin/business-features/health'&&method==='GET'){
  const strict=strictMode(env);
  const legacyWarning='Modo heredado activo: GA4 y Meta Ads quedan habilitados para todas las empresas. Aplica la migración y configura ED_FEATURES_STRICT=1.';
  const strictWarning='Modo estricto activo: los permisos no están disponibles y se deniegan todas las integraciones.';
  const report=(base,legacyActive)=>response({...base,strict_mode:strict,legacy_fallback_active:legacyActive&&!strict,
   ...(legacyActive?{security_warning:strict?strictWarning:legacyWarning}:{})},200,s.cookies);
  const serviceRoleConfigured=!!env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceRoleConfigured){warnOnce('service key missing',strict);return report({configured:false,service_role_configured:false,migration_applied:null,reason:'Falta SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'},true);}
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  try{
   const check=await fetch(supaBase(env)+'/rest/v1/ed_business_features?select=business_id&limit=0',{
    headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}
   });
   if(check.ok)return report({configured:true,service_role_configured:true,migration_applied:true},false);
   const err=check.status===404?await check.json().catch(()=>null):null;
   const missing=!!err&&(err.code==='PGRST205'||err.code==='42P01');
   if(missing)warnOnce('migration not applied',strict);
   return report({configured:false,service_role_configured:true,migration_applied:false,reason:'No se puede consultar la tabla de permisos. Verifica la migración y la credencial del servidor.'},missing);
  }catch{
   return report({configured:false,service_role_configured:true,migration_applied:null,reason:'No se pudo comprobar la conexión con Supabase.'},false);
  }
 }
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
 if(!isPlainObject(input))return response({error:'La solicitud contiene datos inválidos.'},400,s.cookies);
 const id=String(input.business_id||''),feature=String(input.feature||'');
 if(!validId(id)||!await ownsBusiness(env,s,id))return response({error:'La empresa no está autorizada.'},403,s.cookies);
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return response({error:'Configura SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'},503,s.cookies);
 if(feature&&!ED_FEATURES.includes(feature))return response({error:'Integración desconocida.'},400,s.cookies);
 if(feature&&typeof input.enabled!=='boolean')return response({error:'Selecciona Activado o Desactivado.'},400,s.cookies);
 if(!feature&&!['premium','free'].includes(input.plan))return response({error:'Plan no reconocido.'},400,s.cookies);
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const freeDefault={...DEFAULT_FEATURES,meta_ads:false};
 // Optimistic concurrency: the write only succeeds if the row still has the
 // updated_at we read, so concurrent edits are retried instead of overwritten.
 for(let attempt=0;attempt<3;attempt++){
  const current=await featureRow(env,id);
  if(!current.configured)return response({error:'Antes de guardar, aplica la migración de permisos en Supabase.'},503,s.cookies);
  if(!current.available)return response({error:'No fue posible leer los permisos actuales. Vuelve a intentarlo.'},502,s.cookies);
  const before=current.row;
  // Premium always includes every feature entitlement; this does NOT imply that
  // a provider API marked as coming soon is already operational.
  const plan=feature?(before?.plan||null):input.plan;
  if(feature&&plan!=='free')
   return response({error:'Premium incluye todos los accesos. Para personalizar interruptores asigna primero Free.'},409,s.cookies);
  let features;
  if(!feature){
   if(plan==='premium')features=Object.fromEntries(ED_FEATURES.map(k=>[k,true]));
   else features={...freeDefault};
  }else{
   features={...freeDefault,...knownFlags(before?.features)};
   features[feature]=input.enabled;
  }
  if(!['free','premium'].includes(plan))return response({error:'Selecciona un plan antes de modificar los permisos.'},409,s.cookies);
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'};
  const body=JSON.stringify({plan,features,updated_by:s.user.id});
  let r;
  try{
   if(before){
    if(!before.updated_at)return response({error:'No fue posible guardar la configuración. Vuelve a intentarlo.'},502,s.cookies);
    r=await fetch(supaBase(env)+'/rest/v1/ed_business_features?business_id=eq.'+encodeURIComponent(id)+'&updated_at=eq.'+encodeURIComponent(before.updated_at),{method:'PATCH',headers,body});
   }else{
    // Plain insert (no merge): a concurrent first insert fails with 409 and is retried.
    r=await fetch(supaBase(env)+'/rest/v1/ed_business_features',{method:'POST',headers,body:JSON.stringify({business_id:id,plan,features,updated_by:s.user.id})});
   }
  }catch{return response({error:'No fue posible guardar la configuración. Vuelve a intentarlo.'},502,s.cookies);}
  if(!r.ok&&!(!before&&r.status===409))return response({error:'No fue posible guardar la configuración. Vuelve a intentarlo.'},502,s.cookies);
  const rows=r.ok?await r.json().catch(()=>[]):[];
  if(Array.isArray(rows)&&rows.length)
   return response({ok:true,configured:true,business_id:id,plan,features,updated_at:rows[0]?.updated_at||null},200,s.cookies);
  // No row matched (or insert collided): another writer changed it first; re-read and retry.
 }
 return response({error:'Los permisos cambiaron mientras guardabas. Vuelve a intentarlo.'},409,s.cookies);
}
