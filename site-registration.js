/**
 * Alta de sitios web declarados por empresas de Edwin CRM.
 * NO verifica propiedad de dominio ni conecta GA4/Search Console automáticamente.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond=(obj,status=200,cookies=[])=>{
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const cookie of cookies)headers.append('Set-Cookie',cookie);
 return new Response(JSON.stringify(obj),{status,headers});
};
export function validateWebsite(raw){
 if(typeof raw!=='string'||raw.length>300)return null;
 try {
  const u=new URL(raw.trim());
  if(!['https:','http:'].includes(u.protocol)||!u.hostname.includes('.')||u.username||u.password||u.hash||u.port&&u.port!=='443'&&u.port!=='80')return null;
  return u.toString();
 }catch{return null;}
}
export async function handleSiteCreate(req,env,s){
 const url=new URL(req.url),cookies=s.cookies||[],reply=(data,status)=>respond(data,status,cookies);
 if(req.method.toUpperCase()!=='POST')return reply({error:'Método no permitido.'},405);
 if(!s.user||s.user.role==='admin')return reply({error:'Acceso exclusivo de clientes.'},403);
 const origin=req.headers.get('Origin');
 if(origin&&origin!==url.origin)return reply({error:'Origen no autorizado.'},403);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return reply({error:'Se requiere JSON.'},415);
 if(Number(req.headers.get('Content-Length')||0)>3000)return reply({error:'Solicitud demasiado grande.'},413);
 const raw=await req.text();
 if(raw.length>3000)return reply({error:'Solicitud demasiado grande.'},413);
 let data;try{data=JSON.parse(raw);}catch{return reply({error:'JSON inválido.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return reply({error:'Datos inválidos.'},400);
 const businessId=data.business_id,siteName=typeof data.name==='string'?data.name.trim().replace(/\s+/g,' '):'',website=validateWebsite(data.url);
 if(!UUID.test(businessId||''))return reply({error:'Empresa no válida.'},400);
 if(siteName.length<2||siteName.length>100||!website)return reply({error:'Indica un nombre de 2 a 100 caracteres y una URL pública https:// válida.'},400);
 const urlBase=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 if(!urlBase||!env.SUPABASE_ANON_KEY)return reply({error:'Falta configuración de autenticación.'},503);
 const authHeader={apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access,Accept:'application/json'};
 let member;
 try{
  const res=await fetch(urlBase+'/rest/v1/businesses?select=id&id=eq.'+encodeURIComponent(businessId)+'&limit=1',{headers:authHeader});
  member=res.ok&&(await res.json()).some(x=>x.id===businessId);
 }catch{return reply({error:'No se pudo verificar la pertenencia a la empresa.'},502);}
 if(!member)return reply({error:'No tienes acceso a esta empresa.'},403);
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return reply({error:'Falta configurar el almacenamiento privado.'},503);
 let visible;
 try{
  const r=await fetch(urlBase+'/rest/v1/sites?select=id,url&business_id=eq.'+encodeURIComponent(businessId)+'&limit=11',{headers:authHeader});
  if(!r.ok)throw Error('read');
  visible=await r.json();
 }catch{return reply({error:'No se pudo verificar el listado de sitios.'},502);}
 if(visible.length>=10)return reply({error:'Puedes registrar hasta 10 sitios en este espacio.'},409);
 if(visible.some(x=>x.url===website))return reply({error:'Este sitio ya está registrado para tu empresa.'},409);
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 let saved;
 try{
  const r=await fetch(urlBase+'/rest/v1/sites',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json','Content-Type':'application/json',Prefer:'return=representation'},
   body:JSON.stringify({business_id:businessId,name:siteName,url:website,ga4_property_id:null})
  });
  if(r.status===409)return reply({error:'Este sitio ya está registrado para tu empresa.'},409);
  if(!r.ok)return reply({error:'No se pudo registrar el sitio.'},502);
  saved=await r.json();
 }catch{return reply({error:'No se pudo guardar el sitio. Inténtalo nuevamente.'},502);}
 if(!Array.isArray(saved)||saved.length!==1)return reply({error:'Supabase no confirmó el registro.'},502);
 return reply({ok:true,site:{id:saved[0].id,business_id:businessId,name:siteName,url:website,ga4_property_id:null}},201);
}
