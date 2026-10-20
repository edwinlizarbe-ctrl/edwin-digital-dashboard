// Manual GA4 property provisioning by the Edwin CRM superadministrator.
// A property is saved only after a live read-only access check with the private service account.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROPERTY=/^[0-9]{1,30}$/;
const reply=(body,status=200,cookies=[])=>{
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const cookie of cookies)headers.append('Set-Cookie',cookie);
 return new Response(JSON.stringify(body),{status,headers});
};
function accountInfo(env){
 try{
  const account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'');
  if(account?.type==='service_account'&&typeof account.client_email==='string'&&account.client_email.includes('@')&&typeof account.private_key==='string'&&account.private_key.includes('PRIVATE KEY')){
   return {configured:true,email:account.client_email};
  }
 }catch{}
 return {configured:false,email:null};
}
async function query(env,resource,options={}){
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const response=await fetch(base+'/rest/v1/'+resource,{
  method:options.method||'GET',
  headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json',
   ...(options.body?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},
  ...(options.body?{body:JSON.stringify(options.body)}:{})
 });
 if(!response.ok)throw Error('No se pudo completar la operación segura en Supabase (HTTP '+response.status+').');
 return response.json();
}
const validWebUrl=value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:' && !!u.hostname.includes('.') && !u.username && !u.password && !u.hash && value.length<=300 && !/[\u0000-\u001f]/.test(value);
 }catch{return false;}
};
export async function handleAdminGa4(req,env,s,getServiceToken){
 const url=new URL(req.url),method=req.method.toUpperCase(),cookies=s.cookies||[],respond=(data,status=200)=>reply(data,status,cookies);
 if(s.user?.role!=='admin')return respond({error:'Acceso exclusivo del superadministrador.'},403);
 if(!['GET','POST'].includes(method))return respond({error:'Método no permitido.'},405);
 if(!env.SUPABASE_SERVICE_ROLE_KEY||!env.SUPABASE_URL)return respond({error:'Configuración privada de Supabase incompleta.'},503);
 let input={};
 if(method==='POST'){
  if(req.headers.get('Origin')!==url.origin)return respond({error:'Origen de la solicitud no autorizado.'},403);
  if((req.headers.get('Content-Type')||'').split(';')[0]!=='application/json')return respond({error:'Se requiere JSON.'},415);
  const raw=await req.text();
  if(raw.length>1600)return respond({error:'Solicitud demasiado grande.'},413);
  try{input=JSON.parse(raw);}catch{return respond({error:'Datos inválidos.'},400);}
 }
 const businessId=method==='GET'?url.searchParams.get('business_id')||'':String(input?.business_id||'');
 if(!UUID.test(businessId))return respond({error:'Empresa inválida.'},400);
 try{
  const businesses=await query(env,'businesses?select=id,name&id=eq.'+encodeURIComponent(businessId)+'&limit=1');
  if(businesses.length!==1)return respond({error:'Empresa no encontrada.'},404);
  const service=accountInfo(env);
  if(method==='GET'){
   const [sites,oauth]=await Promise.all([
    query(env,'sites?select=id,name,url,ga4_property_id&business_id=eq.'+encodeURIComponent(businessId)+'&order=name.asc&limit=100'),
    query(env,'ed_ga4_connections?select=selected_property_id&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1')
   ]);
   return respond({business_id:businessId,business_name:businesses[0].name,service_account_configured:service.configured,
    service_account_email:service.email,sites,oauth_property_id:oauth[0]?.selected_property_id||null});
  }
  if(!service.configured)return respond({error:'Configura GOOGLE_SERVICE_ACCOUNT_JSON en Production antes de vincular GA4 manualmente.'},503);
  if(typeof getServiceToken!=='function')return respond({error:'Verificación de Analytics no disponible.'},503);
  const propertyId=String(input.property_id||'').trim(),siteId=String(input.site_id||'').trim();
  if(!PROPERTY.test(propertyId))return respond({error:'El ID de propiedad GA4 debe contener solo números.'},400);
  if(siteId&&!UUID.test(siteId))return respond({error:'Sitio inválido.'},400);
  const siteName=String(input.site_name||'').trim(),siteUrl=String(input.site_url||'').trim();
  if(!siteId&&(siteName.length<2||siteName.length>100||!validWebUrl(siteUrl)))return respond({error:'Para registrar un sitio nuevo, escribe un nombre y una URL HTTPS válidos.'},400);
  const oauth=await query(env,'ed_ga4_connections?select=selected_property_id&business_id=eq.'+encodeURIComponent(businessId)+'&limit=1');
  if(oauth[0]?.selected_property_id)return respond({error:'Esta empresa ya utiliza una propiedad GA4 por OAuth. Debes resolver esa conexión antes de asignar una propiedad manualmente.'},409);
  if(siteId){
   const existing=await query(env,'sites?select=id,name,url,ga4_property_id&business_id=eq.'+encodeURIComponent(businessId)+'&id=eq.'+encodeURIComponent(siteId)+'&limit=1');
   if(existing.length!==1)return respond({error:'El sitio no pertenece a la empresa seleccionada.'},404);
  }
  // Avoid assigning one client's property to a different tenant.
  const assigned=await query(env,'sites?select=id,business_id&ga4_property_id=eq.'+encodeURIComponent(propertyId)+'&limit=100');
  if(assigned.some(row=>row.business_id!==businessId))return respond({error:'Esta propiedad GA4 ya está asignada a otra empresa de Edwin CRM.'},409);
  // The credential remains on the Worker; never return access tokens or private keys.
  const accessToken=await getServiceToken(env);
  const check=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+propertyId+':runReport',{
   method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
   body:JSON.stringify({dateRanges:[{startDate:'7daysAgo',endDate:'yesterday'}],metrics:[{name:'activeUsers'}],limit:'1'})
  });
  if(!check.ok){
   return respond({error:check.status===403||check.status===404
    ?'La cuenta de servicio no tiene acceso a esa propiedad GA4 o el ID no existe. Comparte la propiedad con el correo indicado y vuelve a intentar.'
    :'Google Analytics no confirmó el acceso de lectura (HTTP '+check.status+'). No se guardó ningún cambio.'},check.status===403||check.status===404?403:502);
  }
  let record;
  if(siteId){
   const rows=await query(env,'sites?id=eq.'+encodeURIComponent(siteId)+'&business_id=eq.'+encodeURIComponent(businessId),{method:'PATCH',body:{ga4_property_id:propertyId}});
   if(rows.length!==1)throw Error('La asignación no fue confirmada por Supabase.');
   record=rows[0];
  }else{
   const rows=await query(env,'sites',{method:'POST',body:{business_id:businessId,name:siteName,url:siteUrl,ga4_property_id:propertyId}});
   if(rows.length!==1)throw Error('Supabase no confirmó el nuevo sitio.');
   record=rows[0];
  }
  return respond({ok:true,business_id:businessId,site:{id:record.id,name:record.name,url:record.url,ga4_property_id:record.ga4_property_id},verified:true});
 }catch(error){
  console.error('Admin GA4 manual:',String(error?.message||error).slice(0,140));
  return respond({error:'No se pudo verificar o guardar la propiedad GA4. No repitas la operación sin revisar el estado.'},502);
 }
}
