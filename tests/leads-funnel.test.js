import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeadsApi} from '../leads.js';

const origin='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const foreign='00000000-0000-4000-8000-000000000002';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'jwt-client',cookies:[]};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const request=(businessId=business,method='GET')=>new Request(origin+'/api/crm/leads/funnel?business_id='+businessId,{method});

async function withDb(rows,run,options={}){
 const saved=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url));
  calls.push({u,init});
  if(u.pathname==='/rest/v1/businesses'){
   return json(u.searchParams.get('id')==='eq.'+business?[{id:business}]:[]);
  }
  if(u.pathname==='/rest/v1/ed_crm_leads'){
   if(options.failure)return json({error:'backend failed'},503);
   return json(rows);
  }
  throw Error('Unexpected URL '+u);
 };
 try{await run(calls);}finally{globalThis.fetch=saved;}
}

test('G01 summarizes stages by source without returning personal contact information',async()=>{
 const rows=[
  {source:'google_ads',stage:'new',name:'PRIVATE',email:'private@example.com'},
  {source:'google_ads',stage:'won',name:'PRIVATE',email:'private@example.com'},
  {source:'organic',stage:'won'},
  {source:'whatsapp',stage:'lost'}
 ];
 await withDb(rows,async calls=>{
  const response=await handleLeadsApi(request(),env,session);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.total,4);
  assert.equal(data.by_stage.new,1);
  assert.equal(data.by_stage.won,2);
  assert.equal(data.by_stage.lost,1);
  assert.equal(data.by_source.google_ads.total,2);
  assert.equal(data.by_source.google_ads.by_stage.won,1);
  assert.equal(data.by_source.google_ads.won_share_percent,50);
  assert.equal(data.by_source.organic.won_share_percent,100);
  assert.equal(data.won_share_percent,50);
  assert.equal(data.partial,false);
  assert.equal(data.sample_limit,1000);
  assert.match(data.metric_note,/no es una conversión atribuida/);
  assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(data).includes('private@example.com'),false);
  const businessCheck=calls.find(c=>c.u.pathname==='/rest/v1/businesses');
  assert.equal(businessCheck.init.headers.Authorization,'Bearer jwt-client');
  const privateQuery=calls.find(c=>c.u.pathname==='/rest/v1/ed_crm_leads');
  assert.equal(privateQuery.init.headers.Authorization,'Bearer service-test');
  assert.equal(privateQuery.u.searchParams.get('select'),'source,stage');
  assert.equal(privateQuery.u.searchParams.get('business_id'),'eq.'+business);
  assert.equal(privateQuery.u.searchParams.get('limit'),'1001');
  assert.equal(privateQuery.u.searchParams.has('name'),false);
 });
});

test('G01 refuses unauthorized tenant before querying the private leads table',async()=>{
 await withDb([{source:'organic',stage:'won'}],async calls=>{
  const response=await handleLeadsApi(request(foreign),env,session);
  assert.equal(response.status,403);
  assert.equal(calls.some(c=>c.u.pathname==='/rest/v1/ed_crm_leads'),false);
 });
});

test('G01 refuses administrator sessions on client report endpoints',async()=>{
 await withDb([],async calls=>{
  const response=await handleLeadsApi(request(),env,{...session,user:{...session.user,role:'admin'}});
  assert.equal(response.status,403);
  assert.equal(calls.length,0);
 });
});

test('G01 reports partial samples and never counts records beyond 1000',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({source:'meta_ads',stage:i%2?'won':'new'}));
 await withDb(rows,async()=>{
  const response=await handleLeadsApi(request(),env,session);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.total,1000);
  assert.equal(data.by_source.meta_ads.total,1000);
  assert.equal(data.partial,true);
  assert.equal(data.won_share_percent,50);
 });
});

test('G01 handles an empty business funnel without dividing by zero',async()=>{
 await withDb([],async()=>{
  const response=await handleLeadsApi(request(),env,session);
  const data=await response.json();
  assert.equal(data.total,0);
  assert.equal(data.won_share_percent,0);
  assert.equal(data.by_source.google_ads.won_share_percent,0);
  assert.equal(data.partial,false);
 });
});

test('G01 never writes records and rejects non-GET methods',async()=>{
 await withDb([],async calls=>{
  const response=await handleLeadsApi(request(business,'POST'),env,session);
  assert.equal(response.status,405);
  assert.equal(calls.some(c=>c.u.pathname==='/rest/v1/ed_crm_leads'),false);
 });
});

test('G01 fails closed when the reporting database is unavailable',async()=>{
 await withDb([],async()=>{
  const response=await handleLeadsApi(request(),env,session);
  assert.equal(response.status,503);
  assert.ok((await response.json()).error);
 },{failure:true});
});
