/**
 * Zernio WhatsApp onboarding for Edwin CRM.
 * One stable Zernio profile per authorised Edwin CRM business.
 * The provider API key must only be set as a Cloudflare Worker secret.
 */
const BASE = 'https://zernio.com/api/v1';
const json = (data,status=200,cookies=[]) => {
  const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  for(const c of cookies) headers.append('Set-Cookie',c);
  return new Response(JSON.stringify(data),{status,headers});
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function zernioRequest(env,path,init={}) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),20000);
  try {
    const response = await fetch(BASE+path,{
      ...init, signal:controller.signal,
      headers:{Authorization:'Bearer '+env.ZERNIO_API_KEY,Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...(init.headers||{})}
    });
    const data = await response.json().catch(()=>({}));
    return {response,data};
  } finally { clearTimeout(timer); }
}
async function authorisedBusiness(env,session,businessId) {
  const url = String(env.SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/businesses?select=id,name&id=eq.'+encodeURIComponent(businessId)+'&limit=1';
  const res = await fetch(url,{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access,Accept:'application/json'}});
  if(!res.ok) return null;
  const businesses = await res.json();
  return businesses[0]||null;
}
export async function handleZernioApi(request,env,session) {
  const url=new URL(request.url);
  const cookies=session?.cookies||[];
  if(url.pathname!=='/api/zernio/connect'||request.method!=='POST')
    return json({error:'Ruta no disponible.'},404,cookies);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Origen no autorizado.'},403,cookies);
  if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
    return json({error:'Se requiere JSON.'},415,cookies);
  if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'Solicitud demasiado grande.'},413,cookies);
  let body;
  try {body=await request.json();} catch {return json({error:'Datos no válidos.'},400,cookies);}
  if(!UUID.test(String(body?.business_id||'')))return json({error:'Selecciona una empresa válida.'},400,cookies);
  if(!env.ZERNIO_API_KEY)return json({error:'Falta configurar ZERNIO_API_KEY como secreto en Cloudflare.'},503,cookies);
  const business=await authorisedBusiness(env,session,body.business_id);
  if(!business)return json({error:'No tienes acceso a esta empresa.'},403,cookies);
  try {
    const id=business.id;
    // Idempotent account provisioning: clicking twice cannot create two profiles.
    const {response:created,data:profileResponse}=await zernioRequest(env,'/profiles',{
      method:'POST',
      headers:{'Idempotency-Key':'edwin-crm-whatsapp-'+id},
      body:JSON.stringify({name:'EdwinCRM-'+id})
    });
    const profileId=profileResponse?.profile?._id ||
      (created.status===409?profileResponse?.details?.existingProfileId:null);
    if(!profileId||!(created.ok||created.status===409)){
      return json({error:created.status===402?'Zernio solicita activar la facturación antes de conectar WhatsApp.':'Zernio no permitió crear el perfil. Revisa la clave API, el plan y los permisos.'},502,cookies);
    }
    const callback=new URL('/',url.origin);
    callback.searchParams.set('zernio','return');
    callback.searchParams.set('business_id',id);
    const params=new URLSearchParams({
      profileId, redirect_url:callback.toString(),
      onboarding:'api',signup:'hosted',
      brandName:'Edwin Digital',primaryColor:'#2563EB',language:'es'
    });
    const {response:linked,data:linkResponse}=await zernioRequest(env,'/connect/whatsapp?'+params.toString());
    const authUrl=linkResponse?.authUrl;
    if(!linked.ok||typeof authUrl!=='string')
      return json({error:linked.status===402?'Zernio solicita activar la facturación.':'No se pudo iniciar la conexión con WhatsApp en Zernio.'},502,cookies);
    const target=new URL(authUrl);
    if(target.protocol!=='https:'||!['zernio.com','www.zernio.com','facebook.com','www.facebook.com'].includes(target.hostname))
      return json({error:'Zernio devolvió un destino de conexión no válido.'},502,cookies);
    return json({authUrl:target.toString()},200,cookies);
  } catch(e) {
    return json({error:e?.name==='AbortError'?'Zernio tardó demasiado en responder. Intenta nuevamente.':'No fue posible comunicarse con Zernio.'},502,cookies);
  }
}
