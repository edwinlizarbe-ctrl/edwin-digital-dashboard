import test from 'node:test';
import assert from 'node:assert/strict';
import {ED_FEATURES,ensureBusinessFeature,readBusinessEntitlements,handleFeaturesApi} from '../feature-access.js';

const origin='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const client={user:{role:'client',id:'11111111-1111-4111-8111-111111111111'},access:'client-jwt',cookies:[]};
const admin={...client,user:{...client.user,role:'admin'}};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
async function withMock(fn,{featureResponse=json([]),throws=false}={}){
 const prior=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);calls.push({url:u,options});
  if(u.includes('/rest/v1/businesses?'))return json(u.includes(business)?[{id:business}]:[]);
  if(u.includes('/rest/v1/ed_business_features?')){
   if(throws)throw new TypeError('Network is unavailable');
   return featureResponse.clone();
  }
  throw Error('Unexpected request '+u);
 };
 try{await fn(calls);}finally{globalThis.fetch=prior;}
}

test('entitlements fail closed when Supabase returns HTTP 503',async()=>{
 await withMock(async calls=>{
  const result=await readBusinessEntitlements(env,client,business);
  assert.equal(result.unavailable,true);
  assert.equal(result.configured,false);
  assert.ok(ED_FEATURES.every(k=>result.features[k]===false));
  assert.equal(await ensureBusinessFeature(env,client,business,'ga4'),false);
  assert.equal(await ensureBusinessFeature(env,client,business,'meta_ads'),false);
  assert.equal(calls.filter(c=>c.url.includes('ed_business_features')).length,3);
 },{featureResponse:json({message:'db error'},503)});
});

test('entitlements fail closed when service key is missing or network fails',async()=>{
 await withMock(async calls=>{
  const result=await readBusinessEntitlements({...env,SUPABASE_SERVICE_ROLE_KEY:''},client,business);
  assert.equal(result.unavailable,true);
  assert.ok(Object.values(result.features).every(value=>value===false));
  assert.equal(calls.some(c=>c.url.includes('ed_business_features')),false);
 });
 await withMock(async()=>{
  assert.equal(await ensureBusinessFeature(env,client,business,'ga4'),false);
 },{throws:true});
});

test('malformed table responses do not silently activate integrations',async()=>{
 await withMock(async()=>{
  const result=await readBusinessEntitlements(env,client,business);
  assert.equal(result.unavailable,true);
  assert.equal(result.features.ga4,false);
 },{featureResponse:json({unexpected:'payload'})});
});

test('known boolean switches are preserved and non-boolean switches ignored',async()=>{
 const row={business_id:business,plan:'free',features:{ga4:false,google_ads:'true',meta_ads:'false',nonexistent:true}};
 await withMock(async()=>{
  const result=await readBusinessEntitlements(env,client,business);
  assert.equal(result.unavailable,undefined);
  assert.equal(result.provisioned,true);
  assert.equal(result.features.ga4,false);
  assert.equal(result.features.meta_ads,true);
  assert.equal(result.features.google_ads,false);
  assert.equal(result.features.nonexistent,undefined);
 },{featureResponse:json([row])});
});

test('valid premium plan retains explicitly provisioned entitlements',async()=>{
 await withMock(async()=>{
  const result=await readBusinessEntitlements(env,client,business);
  assert.equal(result.features.ga4,true);
  assert.ok(ED_FEATURES.every(k=>result.features[k]===true));
 },{featureResponse:json([{business_id:business,plan:'premium',features:{ga4:false}}])});
});

test('admin feature configuration rejects JSON null and arrays with 400',async()=>{
 for(const data of ['null','[]']){
  const req=new Request(origin+'/api/admin/business-features',{
   method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:data
  });
  const res=await handleFeaturesApi(req,env,admin);
  assert.equal(res.status,400);
 }
});

test('admin feature configuration cancels excessive streaming bodies',async()=>{
 let chunks=0,cancelled=false;
 const stream=new ReadableStream({
  pull(controller){
   chunks++;
   controller.enqueue(new Uint8Array(1024));
   if(chunks>=20)controller.close();
  },
  cancel(){cancelled=true;}
 });
 const req=new Request(origin+'/api/admin/business-features',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:stream,duplex:'half'
 });
 const res=await handleFeaturesApi(req,env,admin);
 assert.equal(res.status,400);
 assert.equal(cancelled,true);
 assert.ok(chunks<20);
});
