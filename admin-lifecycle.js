/* Edwin CRM: reversible administrator lifecycle controls.
   No hard-deletes. Secret service credentials never reach the browser. */
const headersFor=(key)=>({apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'});
const response=(body,status=200,cookies=[])=>{const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(JSON.stringify(body),{status,headers:h});};
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'');
async function getRows(base,headers,route) {
 const r=await fetch(base+'/rest/v1/'+route,{headers});
 if(!r.ok)throw new Error('No se pudo consultar el estado administrativo.');
 const data=await r.json();return Array.isArray(data)?data:[];
}
async function saveRow(base,headers,table,values){
 const r=await fetch(base+'/rest/v1/'+table+'?on_conflict='+encodeURIComponent(table==='ed_business_lifecycle'?'business_id':'user_id'),{
  method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(values)
 });
 if(!r.ok)throw new Error('No fue posible guardar el estado en Supabase.');
 const rows=await r.json();if(!rows.length)throw new Error('Supabase no confirmó el cambio.');
 return rows[0];
}
export async function handleAdminLifecycle(req,env,s){
 if(s.user.role!=='admin')return response({error:'Acceso exclusivo del superadministrador.'},403,s.cookies);
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)return response({error:'Falta conexión administrativa de Supabase.'},503,s.cookies);
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const headers=headersFor(key);
 const url=new URL(req.url);
 try{
  if(req.method==='GET'){
   const [businesses,accounts]=await Promise.all([
    getRows(base,headers,'ed_business_lifecycle?select=business_id,suspended_at&limit=1000'),
    getRows(base,headers,'ed_account_lifecycle?select=user_id,archived_at,was_banned_before&limit=1000')
   ]);
   return response({businesses,accounts},200,s.cookies);
  }
  if(req.method!=='POST')return response({error:'Método no autorizado.'},405,s.cookies);
  const origin=req.headers.get('Origin');
  if(origin&&origin!==url.origin)return response({error:'Origen no autorizado.'},403,s.cookies);
  if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))
   return response({error:'Se requiere JSON.'},415,s.cookies);
  const raw=await req.text();
  if(raw.length>2500)return response({error:'Solicitud demasiado grande.'},413,s.cookies);
  let input;try{input=JSON.parse(raw)}catch{return response({error:'Solicitud inválida.'},400,s.cookies);}
  const id=String(input?.id||''),entity=String(input?.entity||''),action=String(input?.action||'');
  if(!validId(id))return response({error:'Identificador inválido.'},400,s.cookies);
  if(entity==='business'&&['suspend','reactivate'].includes(action)){
   const exists=await getRows(base,headers,'businesses?select=id,name&id=eq.'+id+'&limit=1');
   if(exists.length!==1)return response({error:'Empresa inexistente.'},404,s.cookies);
   const suspended_at=action==='suspend'?new Date().toISOString():null;
   const row=await saveRow(base,headers,'ed_business_lifecycle',{business_id:id,suspended_at,updated_at:new Date().toISOString(),updated_by:s.user.id});
   return response({ok:true,entity,id,status:row.suspended_at?'suspended':'active'},200,s.cookies);
  }
  if(entity==='account'&&['archive','restore'].includes(action)){
   if(id===s.user.id)return response({error:'No puedes eliminar tu propia cuenta administradora.'},403,s.cookies);
   const profiles=await getRows(base,headers,'profiles?select=id,role&id=eq.'+id+'&limit=1');
   if(profiles.length!==1||profiles[0].role==='admin')return response({error:'Las cuentas administradoras están protegidas.'},403,s.cookies);
   const authResult=await fetch(base+'/auth/v1/admin/users/'+id,{headers});
   if(!authResult.ok)return response({error:'No se pudo verificar el usuario.'},502,s.cookies);
   const userInfo=await authResult.json(),user=userInfo.user||userInfo;
   const current=await getRows(base,headers,'ed_account_lifecycle?select=user_id,archived_at,was_banned_before&user_id=eq.'+id+'&limit=1');
   const alreadyArchived=!!current[0]?.archived_at;
   const alreadyBanned=!!(user.banned_until&&Date.parse(user.banned_until)>Date.now());
   if(action==='archive'){
    if(alreadyArchived)return response({error:'La cuenta ya está eliminada lógicamente.'},409,s.cookies);
    const email=String(user.email||'');
    if(!email||String(input.confirm_email||'').trim().toLowerCase()!==email.toLowerCase())
     return response({error:'La confirmación debe coincidir con el correo de la cuenta.'},400,s.cookies);
    const banned=await fetch(base+'/auth/v1/admin/users/'+id,{method:'PUT',headers,body:JSON.stringify({ban_duration:'876000h'})});
    if(!banned.ok)throw new Error('No se pudo bloquear la cuenta.');
    await saveRow(base,headers,'ed_account_lifecycle',{
     user_id:id,archived_at:new Date().toISOString(),was_banned_before:alreadyBanned,
     updated_at:new Date().toISOString(),updated_by:s.user.id
    });
    return response({ok:true,entity,id,status:'archived',message:'Acceso retirado. Datos conservados para recuperación.'},200,s.cookies);
   }
   if(!alreadyArchived)return response({error:'La cuenta no está eliminada.'},409,s.cookies);
   if(!current[0].was_banned_before){
    const unbanned=await fetch(base+'/auth/v1/admin/users/'+id,{method:'PUT',headers,body:JSON.stringify({ban_duration:'none'})});
    if(!unbanned.ok)throw new Error('No se pudo reactivar el acceso de la cuenta.');
   }
   await saveRow(base,headers,'ed_account_lifecycle',{
    user_id:id,archived_at:null,was_banned_before:false,updated_at:new Date().toISOString(),updated_by:s.user.id
   });
   return response({ok:true,entity,id,status:current[0].was_banned_before?'suspended':'active'},200,s.cookies);
  }
  return response({error:'Acción no admitida.'},400,s.cookies);
 }catch(error){
  console.error('Lifecycle administration failed:',error?.message);
  return response({error:'No se completó la operación. Verifica el estado antes de reintentar.'},502,s.cookies);
 }
}
