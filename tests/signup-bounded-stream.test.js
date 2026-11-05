import test from 'node:test';
import assert from 'node:assert/strict';
import {handleSignup, handleOnboardingBusiness} from '../signup.js';

const origin='https://crm.example.workers.dev';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test'};
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'jwt-user',cookies:[]};
const good={email:'persona@example.com',password:'secreto-suficiente-123',confirm:'secreto-suficiente-123'};
function req(path,body,extras={}){
 return new Request(origin+path,{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extras},body,
  ...(body instanceof ReadableStream?{duplex:'half'}:{})
 });
}
function chunks(bytes,size=128){
 return new ReadableStream({start(c){
  for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.subarray(i,i+size));
  c.close();
 }});
}
async function offline(fn){
 const old=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No external fetch expected');};
 try{return await fn();}finally{globalThis.fetch=old;}
}
test('signup limita bytes de JSON fragmentado sin Content-Length',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({...good,padding:'x'.repeat(6000)}));
 await offline(async()=>{
  const res=await handleSignup(req('/api/auth/signup',chunks(bytes)),env);
  assert.equal(res.status,413);assert.equal(res.headers.get('cache-control'),'no-store');
 });
});
test('onboarding limita JSON fragmentado a 1024 bytes',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({name:'Empresa',padding:'a'.repeat(1800)}));
 await offline(async()=>{
  assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business',chunks(bytes,17)),env,session)).status,413);
 });
});
test('Content-Length falsamente reducido no evita limite real',async()=>{
 await offline(async()=>{
  const body=JSON.stringify({...good,padding:'x'.repeat(5500)});
  assert.equal((await handleSignup(req('/api/auth/signup',body,{'Content-Length':'1'}),env)).status,413);
 });
});
test('Content-Length no numerico falla cerrado',async()=>{
 await offline(async()=>{
  assert.equal((await handleSignup(req('/api/auth/signup',JSON.stringify(good),{'Content-Length':'abc'}),env)).status,413);
 });
});
test('UTF-8 en fragmentos de un byte mantiene caracteres correctos',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({...good,padding:'ñ'}));
 const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{"id":"nuevo"}',{status:200,headers:{'Content-Type':'application/json'}});};
 try{
  assert.equal((await handleSignup(req('/api/auth/signup',chunks(bytes,1)),env)).status,200);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old;}
});
test('fallo de lectura se traduce en 400 sin exponer cookies',async()=>{
 const broken=new ReadableStream({start(c){c.error(new Error('broken stream'));}});
 await offline(async()=>{
  const res=await handleSignup(req('/api/auth/signup',broken),env);
  assert.equal(res.status,400);assert.equal(res.headers.get('set-cookie'),null);
 });
});
