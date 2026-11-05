import test from 'node:test';
import assert from 'node:assert/strict';
import {manageSuspension} from '../admin-suspension.js';
import {handleAdminLifecycle} from '../admin-lifecycle.js';

const root='https://crm.test';
const user={user:{id:'11111111-1111-4111-8111-111111111111',role:'admin'},cookies:[]};
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-test-secret'};
const data=string=>new TextEncoder().encode(string);
function stream(bytes,chunk=41){
 return new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=chunk)c.enqueue(bytes.subarray(i,i+chunk));c.close();}});
}
function req(path,body,headers={}){
 return new Request(root+path,{method:'POST',headers:{Origin:root,'Content-Type':'application/json',...headers},
  body,...(body instanceof ReadableStream?{duplex:'half'}:{})});
}
async function noNetwork(fn){
 const old=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('No network should occur');};
 try{await fn();}finally{globalThis.fetch=old;}
}
test('suspensión rechaza JSON grande por streaming antes de consultar Supabase',async()=>{
 const bytes=data(JSON.stringify({user_id:'11111111-1111-4111-8111-111111111111',action:'suspend',pad:'A'.repeat(6000)}));
 await noNetwork(async()=>{
  const result=await manageSuspension(req('/api/admin/accounts/suspension',stream(bytes)),env,user);
  assert.equal(result.status,413);
 });
});
test('lifecycle rechaza JSON fragmentado mayor a 2500 bytes',async()=>{
 const bytes=data(JSON.stringify({entity:'business',id:'11111111-1111-4111-8111-111111111111',action:'suspend',pad:'é'.repeat(2000)}));
 await noNetwork(async()=>{
  const result=await handleAdminLifecycle(req('/api/admin/lifecycle',stream(bytes,1)),env,user);
  assert.equal(result.status,413);
 });
});
test('suspensión rechaza Content-Length falso y MIME incorrecto',async()=>{
 await noNetwork(async()=>{
  const payload=JSON.stringify({user_id:'11111111-1111-4111-8111-111111111111',action:'suspend'});
  assert.equal((await manageSuspension(req('/api/admin/accounts/suspension',payload,{'Content-Length':'garbage'}),env,user)).status,413);
  assert.equal((await manageSuspension(req('/api/admin/accounts/suspension',payload,{'Content-Type':'application/jsonp'}),env,user)).status,415);
 });
});
test('lifecycle rechaza Content-Length falsificado y JSON malformado',async()=>{
 await noNetwork(async()=>{
  const p='/api/admin/lifecycle';
  assert.equal((await handleAdminLifecycle(req(p,'{"id":"x"}',{'Content-Length':'999999'}),env,user)).status,413);
  assert.equal((await handleAdminLifecycle(req(p,'{'),env,user)).status,400);
 });
});
test('acciones administrativas niegan accesos a roles de cliente sin contacto externo',async()=>{
 const client={...user,user:{...user.user,role:'client'}};
 await noNetwork(async()=>{
  assert.equal((await manageSuspension(req('/api/admin/accounts/suspension','{}'),env,client)).status,403);
  assert.equal((await handleAdminLifecycle(req('/api/admin/lifecycle','{}'),env,client)).status,403);
 });
});
test('suspensión admite JSON con charset y falla cerrado en acción inválida',async()=>{
 await noNetwork(async()=>{
  const result=await manageSuspension(req('/api/admin/accounts/suspension',
   JSON.stringify({user_id:'11111111-1111-4111-8111-111111111111',action:'imposible'}),
   {'Content-Type':'application/json; charset=utf-8'}),env,user);
  assert.equal(result.status,400);
 });
});
