import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeadsApi} from '../leads.js';

const business='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'private'};
const session={user:{id:'user-test',role:'client'},access:'jwt-test',cookies:[]};
const url=id=>'https://crm.example/api/crm/leads/funnel?business_id='+id;
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
async function mockFetch(rows,fn){
 const original=globalThis.fetch, calls=[];
 globalThis.fetch=async(input,options={})=>{
  const address=String(input);calls.push({address,options});
  if(address.includes('/businesses?'))return response(address.includes('id=eq.'+business)?[{id:business}]:[]);
  if(address.includes('/ed_crm_leads?'))return response(rows);
  throw Error('Unexpected fetch');
 };
 try{await fn(calls);}finally{globalThis.fetch=original;}
}
test('G01: aggregate by source and stage, without contact PII',async()=>{
 await mockFetch([
  {source:'organic',stage:'won',name:'Secret',email:'private@example.com'},
  {source:'organic',stage:'new',phone:'123456'},
  {source:'referral',stage:'won'}
 ],async calls=>{
  const res=await handleLeadsApi(new Request(url(business)),env,session);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.total,3);
  assert.equal(data.by_stage.won,2);
  assert.equal(data.by_source.organic.total,2);
  assert.equal(data.by_source.organic.won_share_percent,50);
  assert.equal(data.partial,false);
  assert.equal(data.sample_limit,1000);
  assert.doesNotMatch(JSON.stringify(data),/Secret|private@example.com|123456/);
  const read=calls.find(c=>c.address.includes('/ed_crm_leads?'));
  assert.match(read.address,/select=source,stage/);
  assert.match(read.address,/business_id=eq\.00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(read.address,/name|email|phone/);
 });
});
test('G01: denies another company before any private lead query',async()=>{
 await mockFetch([],async calls=>{
  const res=await handleLeadsApi(new Request(url(other)),env,session);
  assert.equal(res.status,403);
  assert.equal(calls.some(c=>c.address.includes('/ed_crm_leads')),false);
 });
});
test('G01: labels truncated sample and never counts the 1001st row',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({source:'organic',stage:i===1000?'won':'new'}));
 await mockFetch(rows,async()=>{
  const res=await handleLeadsApi(new Request(url(business)),env,session);
  const data=await res.json();
  assert.equal(data.total,1000);
  assert.equal(data.by_stage.won,0);
  assert.equal(data.partial,true);
  assert.equal(data.won_share_percent,0);
 });
});
test('G01: rejects mutations and fails closed on invalid storage response',async()=>{
 await mockFetch(null,async calls=>{
  const denied=await handleLeadsApi(new Request(url(business),{method:'POST'}),env,session);
  assert.equal(denied.status,405);
  const invalid=await handleLeadsApi(new Request(url(business)),env,session);
  assert.equal(invalid.status,503);
  assert.equal(calls.some(c=>c.options.method==='POST'),false);
 });
});
