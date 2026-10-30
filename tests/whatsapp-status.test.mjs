import test from 'node:test';
import assert from 'node:assert/strict';
import { handleZernioApi } from '../zernio.js';

const businessId='11111111-1111-4111-8111-111111111111';
const secondId='22222222-2222-4222-8222-222222222222';
const profileId='66a1f0c2a4b9d3e8f1a2b3c4';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-key',ZERNIO_API_KEY:'server-only-secret'};
const session={access:'signed-user-token',cookies:[]};
const req=()=>new Request('https://edwin.example/api/zernio/status?business_id='+businessId);
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
function mockApi(t,handler){
  const old=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    const path=String(url);
    if(path.includes('/rest/v1/businesses?'))return handler('business',path,options);
    if(path.includes('zernio.com/api/v1/'))return handler('zernio',path,options);
    throw new Error('Unexpected request '+path);
  };
  t.after(()=>{globalThis.fetch=old;});
}
test('status refuses foreign or inaccessible business before calling provider',async t=>{
  mockApi(t,(kind)=>{assert.equal(kind,'business');return reply([]);});
  const result=await handleZernioApi(req(),env,session);
  assert.equal(result.status,403);
});
test('status reports setup pending without creating a provider profile',async t=>{
  mockApi(t,(kind)=>{assert.equal(kind,'business');return reply([{id:businessId,name:'Test'}]);});
  const result=await handleZernioApi(req(),{...env,ZERNIO_API_KEY:''},session);
  assert.deepEqual(await result.json(),{configured:false,connected:false});
});
test('status does not provision a profile when none exists',async t=>{
  let calls=[];
  mockApi(t,(kind,path)=>{calls.push(path);return kind==='business'?reply([{id:businessId,name:'Test'}]):reply({profiles:[]});});
  const result=await handleZernioApi(req(),env,session);
  assert.deepEqual(await result.json(),{configured:true,connected:false});
  assert.equal(calls.filter(x=>x.includes('zernio.com')).length,1);
  assert.ok(calls[1].includes('/profiles?'));
});
test('status connects only an active WhatsApp account in the authorised profile',async t=>{
  mockApi(t,(kind,path)=>{
    if(kind==='business')return reply([{id:businessId,name:'Test'}]);
    if(path.includes('/profiles?'))return reply({profiles:[{_id:profileId,name:'EdwinCRM-'+businessId}]});
    return reply({accounts:[
      {platform:'whatsapp',isActive:true,profileId:{_id:secondId},displayName:'Otro cliente'},
      {platform:'whatsapp',isActive:true,profileId:{_id:profileId},displayName:'Empresa de prueba'},
      {platform:'facebook',isActive:true,profileId:{_id:profileId},displayName:'Facebook'}
    ]});
  });
  const result=await handleZernioApi(req(),env,session);
  assert.deepEqual(await result.json(),{configured:true,connected:true,accountName:'Empresa de prueba'});
});
test('inactive accounts never appear connected',async t=>{
  mockApi(t,(kind,path)=>{
    if(kind==='business')return reply([{id:businessId,name:'Test'}]);
    if(path.includes('/profiles?'))return reply({profiles:[{_id:profileId,name:'EdwinCRM-'+businessId}]});
    return reply({accounts:[{platform:'whatsapp',isActive:false,profileId:{_id:profileId}}]});
  });
  const result=await handleZernioApi(req(),env,session);
  assert.deepEqual(await result.json(),{configured:true,connected:false,accountName:null});
});
