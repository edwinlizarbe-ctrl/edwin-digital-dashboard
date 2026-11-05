import test from 'node:test';
import assert from 'node:assert/strict';
import {handleZernioApi} from '../zernio.js';
const root='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const session={user:{id:'example',role:'client'},access:'fake-jwt',cookies:[]};
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'anon-test',ZERNIO_API_KEY:'fake-key'};
const encode=x=>new TextEncoder().encode(x);
function stream(data,n=70){
 const bytes=encode(data);
 return new ReadableStream({start(controller){
  for(let i=0;i<bytes.length;i+=n)controller.enqueue(bytes.subarray(i,i+n));
  controller.close();
 }});
}
function req(path,data,{type='application/json',length}={}){
 return new Request(root+path,{
  method:'POST',headers:{Origin:root,'Content-Type':type,...(length===undefined?{}:{'Content-Length':length})},
  body:data,...(data instanceof ReadableStream?{duplex:'half'}:{})
 });
}
async function offline(fn){
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('No external calls expected');};
 try{await fn();}finally{globalThis.fetch=old;}
}
test('WhatsApp connect rechaza más de 8192 bytes sin consultar Supabase ni Zernio',async()=>{
 await offline(async()=>{
  const r=await handleZernioApi(req('/api/zernio/connect',stream(JSON.stringify({business_id:business,padding:'x'.repeat(12000)}))),env,session);
  assert.equal(r.status,413);assert.equal(r.headers.get('cache-control'),'no-store');
 });
});
test('WhatsApp send rechaza exceso aun con Content-Length falsificado',async()=>{
 await offline(async()=>{
  const text=JSON.stringify({business_id:business,conversation_id:'test',message:'ñ'.repeat(6000)});
  const r=await handleZernioApi(req('/api/zernio/messages',stream(text,1),{length:'1'}),env,session);
  assert.equal(r.status,413);
 });
});
test('WhatsApp rechaza Content-Length malformado',async()=>{
 await offline(async()=>{
  const r=await handleZernioApi(req('/api/zernio/connect',JSON.stringify({business_id:business}),{length:'bad'}),env,session);
  assert.equal(r.status,413);
 });
});
test('WhatsApp rechaza application/jsonp antes de autenticar negocio',async()=>{
 await offline(async()=>{
  const r=await handleZernioApi(req('/api/zernio/messages',JSON.stringify({business_id:business}),{type:'application/jsonp'}),env,session);
  assert.equal(r.status,415);
 });
});
test('WhatsApp conserva error 400 para JSON inválido y cuerpo interrumpido',async()=>{
 await offline(async()=>{
  assert.equal((await handleZernioApi(req('/api/zernio/connect','{invalid'),env,session)).status,400);
  const broken=new ReadableStream({start(c){c.error(new Error('detalle secreto'));}});
  const r=await handleZernioApi(req('/api/zernio/messages',broken),env,session);
  assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/detalle secreto/);
 });
});
test('GET WhatsApp no requiere Content-Length y preserva validación de empresa',async()=>{
 await offline(async()=>{
  const get=new Request(root+'/api/zernio/status?business_id=invalid',{
   method:'GET',headers:{'Content-Length':'999999'}
  });
  assert.equal((await handleZernioApi(get,env,session)).status,400);
 });
});
test('JSON de conexión pequeño conserva validación de UUID, sin contactar proveedor',async()=>{
 await offline(async()=>{
  const r=await handleZernioApi(req('/api/zernio/connect',stream(JSON.stringify({business_id:'invalid'}),1)),env,session);
  assert.equal(r.status,400);
 });
});
