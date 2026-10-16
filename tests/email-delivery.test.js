import test from 'node:test';
import assert from 'node:assert/strict';
import {unsubscribeLink,publicMailRoute,broadcastAction,processEmailQueue} from '../email-delivery.js';
const origin='https://edwin-digital-dashboard.edwinlizarbe.workers.dev';
const id='f2063748-9dff-4250-b4d7-f2aa01108506';
const contact='55d98223-72ad-4ff3-8826-7b81c6312000';
const secret='ab'.repeat(32);
const env={BRASPER_BUSINESS_ID:id,EMAIL_UNSUBSCRIBE_KEY:secret,SUPABASE_URL:'https://fake.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon'};
const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
async function mocked(fn){
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),method:options.method||'GET',body:options.body});
  if(String(url).includes('ed_email_contacts'))return json([{id:contact}]);
  if(String(url).includes('ed_email_deliveries'))return json([]);
  throw Error('Unexpected URL: '+url);
 };
 try{await fn(calls)}finally{globalThis.fetch=old;}
}
test('signed unsubscribe requires confirmation; then updates only its matching contact',async()=>{
 await mocked(async calls=>{
  const url=await unsubscribeLink(new Request(origin),env,id,contact);
  const get=await publicMailRoute(new Request(url),env);
  assert.equal(get.status,200);
  assert.match(await get.text(),/Confirmar baja/);
  assert.equal(calls.length,0);
  const post=await publicMailRoute(new Request(url,{method:'POST'}),env);
  assert.equal(post.status,200);
  assert.equal(calls.filter(x=>x.method==='PATCH').length,2);
  assert(calls[0].url.includes('business_id=eq.'+id));
  const other=new URL(url);other.searchParams.set('token',other.searchParams.get('token').replace(contact,'44444444-4444-4444-8444-444444444444'));
  const tampered=await publicMailRoute(new Request(other),env);
  assert.equal(tampered.status,400);
 });
});
test('batch sending is completely disabled until explicit runtime opt-in',async()=>{
 await mocked(async calls=>{
  const result=await processEmailQueue(env,origin);
  assert.equal(result.disabled,true);
  assert.equal(calls.length,0);
 });
});
test('schedule API cannot queue any real send without opt-in',async()=>{
 const result=await broadcastAction(new Request(origin),env,{user:{id:contact}},id,'schedule_campaign',{campaign_id:contact,confirmation:'CONFIRMO ENVÍO A CONTACTOS AUTORIZADOS'});
 assert.equal(result.status,503);
});
test('webhooks reject unsigned requests and never change recipient data',async()=>{
 await mocked(async calls=>{
  const res=await publicMailRoute(new Request(origin+'/api/email-marketing/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"type":"email.bounced"}'}),env);
  assert.equal(res.status,401);
  assert.equal(calls.length,0);
 });
});
