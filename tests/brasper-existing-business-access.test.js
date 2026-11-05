import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminInvite} from '../admin-invites.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const origin='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const user='11111111-1111-4111-8111-111111111111';
const admin={user:{id:'00000000-0000-4000-8000-000000000002',role:'admin'},cookies:[]};
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function req(email='gerencia@example.com'){
 return new Request(origin+'/api/admin/invite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,business_id:business})});
}
function mock(){
 const calls=[];let added=false;const old=globalThis.fetch;
 globalThis.fetch=async(url,init={})=>{
  const u=String(url);calls.push({url:u,method:init.method||'GET',body:init.body});
  if(u.includes('/rest/v1/businesses?select=id,name'))return json([{id:business,name:'Brasper'}]);
  if(u.includes('/rest/v1/ed_business_lifecycle?'))return json([]);
  if(u.includes('/rest/v1/profiles?select=id,role'))return json([]);
  if(u.includes('/auth/v1/invite?'))return json({user:{id:user,email:'gerencia@example.com'}});
  if(u.includes('/rest/v1/business_members?on_conflict=')){added=true;return json([{business_id:business,user_id:user}],201);}
  if(u.includes('/rest/v1/business_members?select=business_id'))return json(added?[{business_id:business}]:[]);
  throw Error('Llamada inesperada: '+u);
 };
 return {calls,restore:()=>{globalThis.fetch=old;}};
}

test('administración ofrece invitar a una empresa EXISTENTE y no crear otra BrasPer',()=>{
 assert.match(app,/id="admin-existing-company-invite-form"/);
 assert.match(app,/state\.businesses\.map\(b=>`<option value=/);
 assert.match(app,/Acceso comercial completo con los permisos de la empresa seleccionada/);
 assert.match(app,/Conserva la empresa y su plan/);
});
test('invitación de administrador usa API de empresa existente y no modifica perfil editorial',()=>{
 const start=app.indexOf("if(e.target.id==='admin-existing-company-invite-form')");
 const end=app.indexOf("if(e.target.id==='admin-invite-form')",start);
 assert.ok(start>0&&end>start);
 const handler=app.slice(start,end);
 assert.match(handler,/if\(!isAdmin\(\)\|\|state\.inviteBusy\)/);
 assert.match(handler,/state\.businesses\.some\(b=>b\.id===business_id\)/);
 assert.match(handler,/api\('\/api\/admin\/invite'/);
 assert.doesNotMatch(handler,/create-client|update-role|blog_editor['"]?\s*:/);
 assert.match(handler,/marketing\.brasper@gmail\.com/);
});
test('el cliente de Brasper conserva menú completo, campañas, conexión y blog',()=>{
 assert.match(app,/\['overview','analytics','acquisition'\]/);
 assert.match(app,/\['meta','Meta Ads'\],\['google','Google Ads'\]/);
 assert.match(app,/\['leads','whatsapp','reports'\]/);
 assert.match(app,/\['integrations','company','settings'\]/);
 assert.match(app,/navLink\('blog'\)\+navLink\('mailing'\)/);
});
test('el editor de blogs sigue aislado de APIs comerciales',()=>{
 assert.match(worker,/if\(s\.user\.role==='blog_editor'\)/);
 assert.match(worker,/Este perfil solo puede utilizar Blog de Brásper/);
 assert.match(worker,/if\(path==='\/api\/admin\/invite'\)return adminInvite/);
});
test('el endpoint administrativo impide invitar cuentas sin rol admin',async()=>{
 const m=mock();
 try{
  const response=await adminInvite(req(),env,{user:{role:'client'},cookies:[]});
  assert.equal(response.status,403);
  assert.equal(m.calls.length,0);
 }finally{m.restore();}
});
test('el admin puede invitar un cliente a Brasper existente con membresía validada',async()=>{
 const m=mock();
 try{
  const res=await adminInvite(req(),env,admin);
  assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.ok,true);
  assert.equal(result.business_name,'Brasper');
  assert.ok(m.calls.some(x=>x.url.includes('/auth/v1/invite?')));
  assert.ok(m.calls.some(x=>x.url.includes('/rest/v1/business_members?on_conflict=')));
  assert.equal(m.calls.some(x=>x.method==='POST'&&x.url.endsWith('/rest/v1/businesses')),false);
  assert.equal(m.calls.some(x=>x.method==='PATCH'&&x.url.includes('/profiles')),false);
 }finally{m.restore();}
});
