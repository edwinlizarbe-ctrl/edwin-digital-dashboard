import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const base='https://crm.test';
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'test-public'};
const encode=s=>new TextEncoder().encode(s);
function stream(bytes,size=97){
 return new ReadableStream({start(controller){
  for(let i=0;i<bytes.length;i+=size)controller.enqueue(bytes.subarray(i,i+size));
  controller.close();
 }});
}
function request(path, body, {cookie='',contentType='application/json',otherHeaders={}}={}){
 return new Request(base+path,{
  method:'POST',
  headers:{Origin:base,'Content-Type':contentType,...(cookie?{Cookie:cookie}:{}),...otherHeaders},
  body,
  ...(body instanceof ReadableStream?{duplex:'half'}:{})
 });
}
async function mockFetch(callback,fn){
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async(u,init={})=>{calls.push(String(u));return callback(String(u),init);};
 try{await fn(calls);}finally{globalThis.fetch=old;}
}
const ok=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
const huge=encode(JSON.stringify({email:'person@example.com',password:'x'.repeat(10000)}));
test('login rechaza stream mayor de 8192 bytes aunque falte Content-Length',async()=>{
 await mockFetch(()=>{throw Error('No Supabase calls expected');},async calls=>{
  const res=await worker.fetch(request('/api/auth/login',stream(huge)),env);
  assert.equal(res.status,413);assert.equal(calls.length,0);
 });
});
test('login rechaza Content-Length falsificado, aunque indique 1 byte',async()=>{
 await mockFetch(()=>{throw Error('No Supabase calls expected');},async calls=>{
  const res=await worker.fetch(request('/api/auth/login',stream(huge,9),{otherHeaders:{'Content-Length':'1'}}),env);
  assert.equal(res.status,413);assert.equal(calls.length,0);
 });
});
test('login rechaza MIME parecido a JSON sin llegar a autenticar',async()=>{
 await mockFetch(()=>{throw Error('No Supabase calls expected');},async calls=>{
  const res=await worker.fetch(request('/api/auth/login','{}',{contentType:'application/jsonp'}),env);
  assert.equal(res.status,415);assert.equal(calls.length,0);
 });
});
test('login conserva la respuesta 400 cuando el JSON está mal formado',async()=>{
 await mockFetch(()=>{throw Error('No Supabase calls expected');},async calls=>{
  const res=await worker.fetch(request('/api/auth/login','{'),env);
  assert.equal(res.status,400);assert.equal(calls.length,0);
 });
});
function mockSession(u){
 if(u.includes('/auth/v1/user'))return ok({id:'u1',email:'cliente@example.com',user_metadata:{}});
 if(u.includes('/rest/v1/profiles'))return ok([{id:'u1',email:'cliente@example.com',role:'client'}]);
 throw Error('Unexpected Supabase call: '+u);
}
test('cambio de contraseña rechaza stream mayor de 2048 bytes antes de consultar credenciales',async()=>{
 await mockFetch((u)=>mockSession(u),async calls=>{
  const bytes=encode(JSON.stringify({currentPassword:'old',newPassword:'x'.repeat(3300)}));
  const res=await worker.fetch(request('/api/auth/change-password',stream(bytes,13),{cookie:'ed_access=test'}),env);
  assert.equal(res.status,413);
  assert.equal(calls.some(u=>u.includes('grant_type=password')),false);
 });
});
test('preferencias empresariales rechaza stream enorme sin leerlo íntegro',async()=>{
 await mockFetch((u)=>mockSession(u),async calls=>{
  const bytes=encode(JSON.stringify({business_id:'11111111-2222-3333-4444-555555555555',country:'x'.repeat(150000)}));
  const res=await worker.fetch(request('/api/company/preferences',stream(bytes,1050),{cookie:'ed_access=test'}),env);
  assert.equal(res.status,400);
  assert.equal(calls.some(u=>u.includes('/rest/v1/businesses')),false);
 });
});
test('un JSON de login pequeño conserva la autenticación existente',async()=>{
 await mockFetch(u=>{
  if(u.includes('/auth/v1/token?grant_type=password'))return ok({access_token:'sample-access',refresh_token:'sample-refresh',expires_in:3600});
  throw Error('Unexpected call: '+u);
 },async calls=>{
  const res=await worker.fetch(request('/api/auth/login',JSON.stringify({email:'person@example.com',password:'x'.repeat(12)})),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).ok,true);
  assert.equal(calls.length,1);
  assert.match(res.headers.get('set-cookie')||'',/ed_access=/);
 });
});
