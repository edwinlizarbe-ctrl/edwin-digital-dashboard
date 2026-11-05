import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAssistantApi} from '../assistant-api.js';

const base='https://crm.example.workers.dev';
const env={OPENAI_API_KEY:'',SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'test'};
const session={user:{id:'user-1',role:'client'},access:'test-jwt',cookies:[]};
const valid={question:'¿Cómo priorizar mis leads?',business_id:'00000000-0000-4000-8000-000000000001'};
function bodyStream(content,size=31) {
 const bytes=new TextEncoder().encode(content);
 return new ReadableStream({start(ctrl){for(let i=0;i<bytes.length;i+=size)ctrl.enqueue(bytes.subarray(i,i+size));ctrl.close();}});
}
function request(body,{type='application/json',sizeHeader}={}) {
 return new Request(base+'/api/assistant/chat',{
  method:'POST',headers:{Origin:base,'Content-Type':type,...(sizeHeader===undefined?{}:{'Content-Length':sizeHeader})},
  body,...(body instanceof ReadableStream?{duplex:'half'}:{})
 });
}
async function withoutNetwork(fn) {
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected external service call');};
 try {await fn();} finally {globalThis.fetch=old;}
}
test('AI chat rejects oversize streamed JSON with 413 before networking',async()=>{
 const large=JSON.stringify({...valid,padding:'x'.repeat(12000)});
 await withoutNetwork(async()=>{
  const r=await handleAssistantApi(request(bodyStream(large,57)),env,session);
  assert.equal(r.status,413);
  assert.equal(r.headers.get('cache-control'),'no-store');
 });
});
test('AI chat rejects oversize JSON even with misleading Content-Length',async()=>{
 const large=JSON.stringify({...valid,padding:'é'.repeat(4500)});
 await withoutNetwork(async()=>{
  assert.equal((await handleAssistantApi(request(bodyStream(large,1),{sizeHeader:'1'}),env,session)).status,413);
 });
});
test('AI chat rejects malformed Content-Length and misleading MIME type',async()=>{
 await withoutNetwork(async()=>{
  assert.equal((await handleAssistantApi(request(JSON.stringify(valid),{sizeHeader:'not-number'}),env,session)).status,413);
  assert.equal((await handleAssistantApi(request(JSON.stringify(valid),{type:'application/jsonp'}),env,session)).status,415);
 });
});
test('AI chat accepts normal multi-byte streamed JSON and preserves disabled AI response',async()=>{
 await withoutNetwork(async()=>{
  const r=await handleAssistantApi(request(bodyStream(JSON.stringify(valid),1),{type:'application/json; charset=utf-8'}),env,session);
  assert.equal(r.status,503);
  assert.equal((await r.json()).configured,false);
 });
});
test('AI chat rejects malformed JSON and stream failures with a sanitized 400',async()=>{
 await withoutNetwork(async()=>{
  assert.equal((await handleAssistantApi(request(bodyStream('{')),env,session)).status,400);
  const bad=new ReadableStream({start(ctrl){ctrl.error(new Error('Private detail'));}});
  const r=await handleAssistantApi(request(bad),env,session);
  assert.equal(r.status,400);
  assert.doesNotMatch(await r.text(),/Private detail/);
 });
});
test('AI chat rejects foreign origins before reading or networking',async()=>{
 const r=new Request(base+'/api/assistant/chat',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify(valid)});
 await withoutNetwork(async()=>assert.equal((await handleAssistantApi(r,env,session)).status,403));
});
