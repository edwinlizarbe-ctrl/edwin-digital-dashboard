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
  const status=url.pathname==='/api/zernio/status'&&request.method==='GET';
  const connect=url.pathname==='/api/zernio/connect'&&request.method==='POST';
  const inbox=url.pathname==='/api/zernio/inbox'&&request.method==='GET';
  const messages=url.pathname==='/api/zernio/messages'&&request.method==='GET';
  const send=url.pathname==='/api/zernio/messages'&&request.method==='POST';
  if(!status&&!connect&&!inbox&&!messages&&!send)return json({error:'Ruta no disponible.'},404,cookies);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==url.origin)return json({error:'Origen no autorizado.'},403,cookies);
  if((connect||send)&&!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
    return json({error:'Se requiere JSON.'},415,cookies);
  if(Number(request.headers.get('Content-Length')||0)>8192)return json({error:'Solicitud demasiado grande.'},413,cookies);
  let body={};
  if(connect||send){try {body=await request.json();} catch {return json({error:'Datos no válidos.'},400,cookies);}}
  const businessId=connect||send?body?.business_id:url.searchParams.get('business_id');
  if(!UUID.test(String(businessId||'')))return json({error:'Selecciona una empresa válida.'},400,cookies);
  const business=await authorisedBusiness(env,session,businessId);
  if(!business)return json({error:'No tienes acceso a esta empresa.'},403,cookies);
  // The readiness check never provisions profiles or reveals API credentials.
  if(!env.ZERNIO_API_KEY)return status?json({configured:false,connected:false},200,cookies):json({error:'WhatsApp todavía no está habilitado para tu empresa.'},503,cookies);
  try {
    const id=business.id;
    if(status){
      const profileName='EdwinCRM-'+id;
      const {response:pr,data:pd}=await zernioRequest(env,'/profiles?'+new URLSearchParams({name:profileName,limit:'20'}));
      if(!pr.ok)return json({error:'No pudimos comprobar el estado de WhatsApp.'},502,cookies);
      const profiles=Array.isArray(pd.profiles)?pd.profiles:Array.isArray(pd.data)?pd.data:null;
      if(!profiles)return json({error:'El proveedor devolvió un estado no reconocido.'},502,cookies);
      const profile=profiles.find(p=>p.name===profileName);
      if(!profile)return json({configured:true,connected:false},200,cookies);
      const profileId=String(profile._id||profile.id||'');
      if(!profileId)return json({error:'No se pudo identificar la conexión.'},502,cookies);
      const {response:ar,data:ad}=await zernioRequest(env,'/accounts?'+new URLSearchParams({profileId}));
      if(!ar.ok||!Array.isArray(ad.accounts))return json({error:'No pudimos comprobar la cuenta conectada.'},502,cookies);
      const linked=ad.accounts.find(a=>{
        const owningProfile=String(a.profileId?._id||a.profileId?.id||a.profileId||'');
        return a.platform==='whatsapp'&&a.isActive===true&&owningProfile===profileId;
      });
      return json({configured:true,connected:!!linked,accountName:linked?String(linked.displayName||linked.username||'WhatsApp Business').slice(0,100):null},200,cookies);
    }
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

    if(inbox||messages||send){
      const query=new URLSearchParams({profileId,platform:'whatsapp',limit:'100'});
      const {response:listResponse,data:listData}=await zernioRequest(env,'/inbox/conversations?'+query.toString());
      if(!listResponse.ok)return json({error:'No se pudieron consultar las conversaciones. Comprueba la conexión de WhatsApp.'},502,cookies);
      const conversations=Array.isArray(listData.data)?listData.data.filter(c=>c.platform==='whatsapp'&&c.accountId):[];
      if(inbox)return json({conversations,hasMore:!!listData.pagination?.hasMore},200,cookies);
      const conversationId=String(send?body.conversation_id:url.searchParams.get('conversation_id')||'');
      const selected=conversations.find(c=>c.id===conversationId);
      if(!selected)return json({error:'Conversación no disponible para esta empresa.'},404,cookies);
      if(messages){
        const q=new URLSearchParams({accountId:selected.accountId,sortOrder:'desc',limit:'70'});
        const {response:mr,data:md}=await zernioRequest(env,'/inbox/conversations/'+encodeURIComponent(selected.id)+'/messages?'+q);
        if(!mr.ok)return json({error:'No se pudieron consultar los mensajes.'},502,cookies);
        return json({messages:Array.isArray(md.messages)?md.messages:[],pagination:md.pagination||null},200,cookies);
      }
      const message=String(body.message||'').trim();
      if(!message||message.length>4096)return json({error:'El mensaje debe tener entre 1 y 4096 caracteres.'},400,cookies);
      const idempotencyKey=String(body.idempotency_key||'');
      if(!UUID.test(idempotencyKey))return json({error:'Identificador de envío inválido.'},400,cookies);
      const {response:sr,data:sd}=await zernioRequest(env,'/inbox/conversations/'+encodeURIComponent(selected.id)+'/messages',{
        method:'POST',headers:{'Idempotency-Key':idempotencyKey},
        body:JSON.stringify({accountId:selected.accountId,message})
      });
      if(!sr.ok)return json({error:sr.status===400?'WhatsApp no admitió el mensaje. Fuera de las 24 horas necesitas una plantilla aprobada.':sr.status===429?'Límite de envíos alcanzado. Espera antes de intentar de nuevo.':'Zernio no pudo entregar el mensaje (HTTP '+sr.status+').'},sr.status===429?429:502,cookies);
      return json({success:true,reference:sd.data?.messageId||null},200,cookies);
    }
    const callback=new URL('/',url.origin);
    callback.searchParams.set('zernio','return');
    callback.searchParams.set('business_id',id);
    const params=new URLSearchParams({
      profileId, redirect_url:callback.toString(),
      onboarding:'api'
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
