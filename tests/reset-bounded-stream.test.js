import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequestReset, handleResetPassword} from '../password-reset.js';

const origin='https://crm.example.workers.dev';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'test-anon'};
const bytes=text=>new TextEncoder().encode(text);
function chunks(input,size=73){
 return new ReadableStream({start(c){
  for(let i=0;i<input.length;i+=size)c.enqueue(input.subarray(i,i+size));
  c.close();
 }});
}
function req(path,body,headers={}){
 return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},
   body, ...(body instanceof ReadableStream?{duplex:'half'}:{})});
}
async function offline(fn){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(...args)=>{calls.push(args);throw new Error('No external requests expected');};
 try{await fn(calls);}finally{globalThis.fetch=original;}
}
test('request-reset rejects streamed body over 2048 bytes before Supabase',async()=>{
 await offline(async calls=>{
  const large=bytes(JSON.stringify({email:'a@example.com',padding:'x'.repeat(6000)}));
  const res=await handleRequestReset(req('/api/auth/request-reset',chunks(large)),env);
  assert.equal(res.status,413);assert.equal(calls.length,0);
 });
});
test('reset-password rejects streamed body over 8192 bytes',async()=>{
 await offline(async calls=>{
  const large=bytes(JSON.stringify({access_token:'x'.repeat(12000),password:'password-1234',confirm:'password-1234'}));
  const res=await handleResetPassword(req('/api/auth/reset-password',chunks(large,1)),env);
  assert.equal(res.status,413);assert.equal(calls.length,0);
 });
});
test('reset request rejects false tiny Content-Length',async()=>{
 await offline(async calls=>{
  const large=bytes(JSON.stringify({email:'a@example.com',padding:'é'.repeat(2000)}));
  const res=await handleRequestReset(req('/api/auth/request-reset',chunks(large),{'Content-Length':'1'}),env);
  assert.equal(res.status,413);assert.equal(calls.length,0);
 });
});
test('reset rejects invalid Content-Length and MIME',async()=>{
 await offline(async calls=>{
  const p='/api/auth/request-reset',body=JSON.stringify({email:'a@example.com'});
  assert.equal((await handleRequestReset(req(p,body,{'Content-Length':'unknown'}),env)).status,413);
  assert.equal((await handleRequestReset(req(p,body,{'Content-Type':'application/jsonp'}),env)).status,415);
  assert.equal(calls.length,0);
 });
});
test('reset stream failures are sanitized',async()=>{
 await offline(async calls=>{
  const broken=new ReadableStream({start(c){c.error(new Error('Do not disclose private error'));}});
  const res=await handleRequestReset(req('/api/auth/request-reset',broken),env);
  assert.equal(res.status,400);
  assert.doesNotMatch(await res.text(),/private error/);
  assert.equal(calls.length,0);
 });
});
test('valid split multibyte JSON is accepted and uses only email',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(u,init)=>{calls.push({u,init});return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});};
 try{
  const data=bytes(JSON.stringify({email:'ÁLVARO@empresa.com'}));
  const res=await handleRequestReset(req('/api/auth/request-reset',chunks(data,1)),env);
  assert.equal(res.status,200);
  assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(calls[0].init.body),{email:'álvaro@empresa.com'});
 }finally{globalThis.fetch=original;}
});
