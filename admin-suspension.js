// Administrator-controlled, reversible account suspension.
// This module never deletes Supabase identities or touches external messaging integrations.
const reply=(data,status=200,cookies=[])=>{const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});for(const c of cookies)h.append('Set-Cookie',c);return new Response(JSON.stringify(data),{status,headers:h});};
const uuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function isSuspendedUser(env,userId){
  if(!env.SUPABASE_SERVICE_ROLE_KEY)return false;
  const root=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(root+'/auth/v1/admin/users/'+encodeURIComponent(userId),{headers:{apikey:key,Authorization:'Bearer '+key}});
  if(!r.ok)throw new Error('No fue posible verificar el estado de suspensión.');
  const payload=await r.json(),u=payload.user||payload;
  return !!(u.banned_until&&Date.parse(u.banned_until)>Date.now());
}
export async function manageSuspension(req,env,s){
  if(s.user.role!=='admin')return reply({error:'Acceso exclusivo del administrador.'},403,s.cookies);
  if(req.method!=='POST'||req.headers.get('Origin')&&req.headers.get('Origin')!==new URL(req.url).origin)return reply({error:'Solicitud no autorizada.'},403,s.cookies);
  if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return reply({error:'Se requiere JSON.'},415,s.cookies);
  let data;try{data=await req.json();}catch{return reply({error:'Datos no válidos.'},400,s.cookies);}
  const id=String(data?.user_id||''),action=String(data?.action||'');
  if(!uuid(id)||!['suspend','reactivate'].includes(action))return reply({error:'Solicitud inválida.'},400,s.cookies);
  if(id===s.user.id)return reply({error:'No puedes suspender tu propia cuenta administradora.'},403,s.cookies);
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return reply({error:'Falta la conexión administrativa de Supabase.'},503,s.cookies);
  const root=String(env.SUPABASE_URL).replace(/\/$/,'');
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const p=await fetch(root+'/rest/v1/profiles?select=id,role&id=eq.'+id+'&limit=1',{headers});
  if(!p.ok)return reply({error:'No fue posible verificar los permisos.'},502,s.cookies);
  const list=await p.json();
  if(list.length!==1||list[0].role==='admin')return reply({error:'No se permite cambiar el estado de administradores.'},403,s.cookies);
  const update=await fetch(root+'/auth/v1/admin/users/'+id,{method:'PUT',headers,body:JSON.stringify({ban_duration:action==='suspend'?'876000h':'none'})});
  if(!update.ok)return reply({error:'Supabase no confirmó el cambio de estado.'},502,s.cookies);
  return reply({ok:true,user_id:id,status:action==='suspend'?'suspended':'active'},200,s.cookies);
}
