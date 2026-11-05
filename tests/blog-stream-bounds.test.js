import test from 'node:test';
import assert from 'node:assert/strict';
import {handleBlogGenerator} from '../brasper-blog-generator.js';
const base='https://crm.example.workers.dev';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test'};
const session={user:{role:'client'},access:'fake-jwt',cookies:[]};
const bytes=text=>new TextEncoder().encode(text);
function stream(text,size=1500){
 const data=bytes(text);return new ReadableStream({start(c){
  for(let i=0;i<data.length;i+=size)c.enqueue(data.subarray(i,i+size));
  c.close();
 }});
}
function req(body,headers={}){
 return new Request(base+'/api/brasper/blog/generate',{
  method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},
  body,...(body instanceof ReadableStream?{duplex:'half'}:{})
 });
}
async function noNetwork(fn){
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('No external call expected');};
 try{await fn();}finally{globalThis.fetch=previous;}
}
test('blog rechaza stream de más de 110000 bytes sin contactar Supabase',async()=>{
 await noNetwork(async()=>{
  const r=await handleBlogGenerator(req(stream(JSON.stringify({business_id:'not-valid',text:'x'.repeat(130000)}))),env,session);
  assert.equal(r.status,413);assert.equal(r.headers.get('cache-control'),'no-store');
 });
});
test('blog aplica máximo en bytes UTF-8, no caracteres Unicode',async()=>{
 await noNetwork(async()=>{
  const input=JSON.stringify({business_id:'not-valid',text:'ñ'.repeat(59000)});
  assert.ok(input.length<110000);
  const r=await handleBlogGenerator(req(stream(input,17)),env,session);
  assert.equal(r.status,413);
 });
});
test('blog rechaza Content-Length falso aunque solicite JSON válido',async()=>{
 await noNetwork(async()=>{
  const r=await handleBlogGenerator(req(stream('{"text":"x"}'),{'Content-Length':'broken'}),env,session);
  assert.equal(r.status,413);
 });
});
test('blog rechaza Content-Type application/jsonp',async()=>{
 await noNetwork(async()=>{
  const r=await handleBlogGenerator(req(JSON.stringify({}),{'Content-Type':'application/jsonp'}),env,session);
  assert.equal(r.status,415);
 });
});
test('blog rechaza JSON corrupto y errores de lectura sin filtrar detalles',async()=>{
 await noNetwork(async()=>{
  assert.equal((await handleBlogGenerator(req(stream('{')),env,session)).status,400);
  const broken=new ReadableStream({start(c){c.error(new Error('error privado'));}});
  const r=await handleBlogGenerator(req(broken),env,session);
  assert.equal(r.status,400);assert.doesNotMatch(await r.text(),/error privado/);
 });
});
test('blog conserva validación de empresa antes de enviar datos al proveedor',async()=>{
 await noNetwork(async()=>{
  const r=await handleBlogGenerator(req(stream(JSON.stringify({business_id:'not-valid'}),1)),env,session);
  assert.equal(r.status,403);
 });
});
