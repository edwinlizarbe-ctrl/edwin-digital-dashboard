/**
 * Invite a new client to Edwin CRM. Passwords are NEVER emailed.
 * Auth sends an invitation link and the client chooses their own password.
 * Routes are admin-only; service role never reaches the browser.
 */
const respond=(body,status=200,cookies=[])=>{
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(JSON.stringify(body),{status,headers:h});
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function adminInvite(req,env,session){
 if(session.user.role!=='admin')return respond({error:'Solo el superadministrador puede invitar usuarios.'},403,session.cookies);
 if(req.method!=='POST')return respond({error:'Método no permitido.'},405,session.cookies);
 const origin=req.headers.get('Origin');
 if(origin&&origin!==new URL(req.url).origin)return respond({error:'Origen no autorizado.'},403,session.cookies);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return respond({error:'Se requiere JSON.'},415,session.cookies);
 let input;try{const raw=await req.text();if(raw.length>1600)throw Error('size');input=JSON.parse(raw)}catch{return respond({error:'Datos incorrectos.'},400,session.cookies)}
 const email=String(input?.email||'').trim().toLowerCase();
 const businessId=String(input?.business_id||'');
 if(!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/u.test(email)||email.length>254||!UUID.test(businessId))
  return respond({error:'Indica un correo válido y selecciona una empresa.'},400,session.cookies);
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)return respond({error:'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'},503,session.cookies);
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'};
 const read=async route=>{const r=await fetch(base+'/rest/v1/'+route,{headers});if(!r.ok)throw Error('No se pudo verificar la empresa o el correo.');return r.json()};
 try{
  const [businesses,blocked,existing]=await Promise.all([
   read('businesses?select=id,name&id=eq.'+businessId+'&limit=1'),
   read('ed_business_lifecycle?select=suspended_at&business_id=eq.'+businessId+'&limit=1'),
   read('profiles?select=id,role&email=eq.'+encodeURIComponent(email)+'&limit=1')
  ]);
  if(businesses.length!==1)return respond({error:'La empresa seleccionada no existe.'},404,session.cookies);
  if(blocked[0]?.suspended_at)return respond({error:'Reactiva la empresa antes de invitar nuevos clientes.'},409,session.cookies);
  if(existing.length)return respond({error:'Ese correo ya tiene una cuenta en Edwin CRM. No se envió otra invitación.'},409,session.cookies);
  const url=new URL(req.url),redirect=url.origin+'/?invite=1';
  const sent=await fetch(base+'/auth/v1/invite?redirect_to='+encodeURIComponent(redirect),{
   method:'POST',headers,body:JSON.stringify({email})
  });
  const data=await sent.json().catch(()=>({}));
  if(!sent.ok){
   console.error('Auth invitation rejected',sent.status);
   return respond({error:sent.status===429?'Límite temporal de invitaciones. Inténtalo más tarde.':'No se pudo enviar la invitación. Comprueba la configuración de correo de Supabase.'},sent.status===429?429:502,session.cookies);
  }
  const user=data.user||data;
  if(!UUID.test(String(user?.id||'')))return respond({error:'La invitación se procesó, pero no se pudo verificar la cuenta creada. Revisa Supabase.'},502,session.cookies);
  const membership=await fetch(base+'/rest/v1/business_members?on_conflict=business_id,user_id',{
   method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},
   body:JSON.stringify({business_id:businessId,user_id:user.id})
  });
  if(!membership.ok){
   console.error('Membership after invitation failed',membership.status);
   return respond({error:'La invitación fue creada, pero la asignación a la empresa no se confirmó. Revisa el usuario antes de reenviar.'},502,session.cookies);
  }
  // Verify membership by reading it back, without exposing private data.
  const linked=await read('business_members?select=business_id&business_id=eq.'+businessId+'&user_id=eq.'+user.id+'&limit=1');
  if(!linked.length)return respond({error:'La invitación fue creada, pero falta confirmar su vinculación con la empresa.'},502,session.cookies);
  return respond({ok:true,email,business_name:businesses[0].name,message:'Invitación solicitada a Supabase y acceso asignado. La entrega del correo depende del servicio de email.'},200,session.cookies);
 }catch(error){
  console.error('Admin invitation workflow failed',String(error?.message||error));
  return respond({error:'No se pudo completar la invitación. Revisa Supabase antes de reintentar.'},502,session.cookies);
 }
}
/** Finish an Auth invite with the invitee's own password and issue normal CRM cookies. */
export async function acceptInvite(req,env){
 if(req.method!=='POST')return respond({error:'Método no permitido.'},405);
 const origin=req.headers.get('Origin');
 if(origin&&origin!==new URL(req.url).origin)return respond({error:'Origen no autorizado.'},403);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return respond({error:'Se requiere JSON.'},415);
 let input;try{const raw=await req.text();if(raw.length>5000)throw Error();input=JSON.parse(raw)}catch{return respond({error:'Solicitud inválida.'},400)}
 const access=String(input?.access_token||''),refresh=String(input?.refresh_token||''),password=input?.password;
 if(access.length<30||access.length>3200||refresh.length<20||refresh.length>2000||typeof password!=='string'||password.length<10||password.length>128)
  return respond({error:'Invitación inválida o contraseña fuera de rango (10 a 128 caracteres).'},400);
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const headers={apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+access,'Content-Type':'application/json'};
 const check=await fetch(base+'/auth/v1/user',{headers});
 if(!check.ok)return respond({error:'El enlace ha caducado o ya no es válido. Solicita otra invitación.'},401);
 const user=await check.json();
 const profile=await fetch(base+'/rest/v1/profiles?select=id,role&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers});
 if(!profile.ok)return respond({error:'No se pudo verificar el perfil.'},502);
 const rows=await profile.json();
 if(rows.length!==1||rows[0].role!=='client')return respond({error:'La invitación no corresponde a una cuenta de cliente.'},403);
 const changed=await fetch(base+'/auth/v1/user',{method:'PUT',headers,body:JSON.stringify({password})});
 if(!changed.ok)return respond({error:'No se pudo configurar la contraseña. Prueba otra contraseña segura.'},400);
 const secureCookie=(name,value,age)=>name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
 return respond({ok:true},200,[
  secureCookie('ed_access',access,3600),
  secureCookie('ed_refresh',refresh,60*60*24*14)
 ]);
}
