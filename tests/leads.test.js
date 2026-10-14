import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeadsApi} from '../leads.js';
const base='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const another='00000000-0000-4000-8000-000000000002';
const leadId='44444444-4444-4444-8444-444444444444';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'jwt-test',cookies:[]};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
async function inServer(fn){
 const original=globalThis.fetch,calls=[];let leads=[];
 globalThis.fetch=async(url,options={})=>{
  const u=String(url),method=options.method||'GET';calls.push({url:u,method,body:options.body,headers:options.headers});
  if(u.includes('/rest/v1/businesses?'))return json(u.includes(business)?[{id:business}]:[]);
  if(u.includes('/rest/v1/ed_crm_leads')){
   if(method==='POST'){const body=JSON.parse(options.body);const lead={...body,id:leadId,created_at:'2026-10-14T01:00:00Z'};leads.push(lead);return json([lead],201);}
   if(method==='PATCH'){const data=JSON.parse(options.body);const idx=leads.findIndex(x=>x.id===leadId&&u.includes(business));if(idx===-1)return json([]);leads[idx]={...leads[idx],...data};return json([leads[idx]]);}
   return json(u.includes(business)?leads:[]);
  }
  throw Error('Unexpected request: '+u);
 };
 try{await fn({calls,leads:()=>leads});}finally{globalThis.fetch=original;}
}
const req=(method,path,body)=>new Request(base+path,{
 method,headers:{...(method!=='GET'?{'Content-Type':'application/json','Origin':base}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
const payload={name:'Prospecto de prueba',email:'test@example.com',phone:'999999999',source:'google_ads',stage:'new',campaign:'búsqueda_perú',amount:0,currency:'PEN'};
test('denies another tenant before private table read',async()=>{
 await inServer(async({calls})=>{
  const r=await handleLeadsApi(req('GET','/api/crm/leads?business_id='+another),env,session);
  assert.equal(r.status,403);
  assert.equal(calls.some(x=>x.url.includes('ed_crm_leads')),false);
 });
});
test('admin cannot access client opportunities through this endpoint',async()=>{
 await inServer(async({calls})=>{
  const r=await handleLeadsApi(req('GET','/api/crm/leads?business_id='+business),env,{...session,user:{...session.user,role:'admin'}});
  assert.equal(r.status,403);
  assert.equal(calls.some(x=>x.url.includes('ed_crm_leads')),false);
 });
});
test('server binds created lead to authenticated business and user',async()=>{
 await inServer(async({calls})=>{
  const r=await handleLeadsApi(req('POST','/api/crm/leads?business_id='+business,{...payload,business_id:another,created_by:another}),env,session);
  assert.equal(r.status,201);
  const row=(await r.json()).lead;
  assert.equal(row.business_id,business);
  assert.equal(row.created_by,session.user.id);
  assert.equal(calls.filter(x=>x.url.includes('/ed_crm_leads')).length,1);
 });
});
test('rejects invalid stage and unauthorised cross-origin changes',async()=>{
 await inServer(async({calls})=>{
  const bad=await handleLeadsApi(req('POST','/api/crm/leads?business_id='+business,{...payload,stage:'invalid'}),env,session);
  assert.equal(bad.status,400);
  const cross=new Request(base+'/api/crm/leads?business_id='+business,{method:'POST',headers:{'Origin':'https://bad.example','Content-Type':'application/json'},body:JSON.stringify(payload)});
  const rejected=await handleLeadsApi(cross,env,session);
  assert.equal(rejected.status,403);
  assert.equal(calls.some(x=>x.url.includes('ed_crm_leads')),false);
 });
});
test('get, update stage and preserve real recorded data',async()=>{
 await inServer(async()=>{
  await handleLeadsApi(req('POST','/api/crm/leads?business_id='+business,payload),env,session);
  const updated=await handleLeadsApi(req('PATCH','/api/crm/leads?business_id='+business+'&lead_id='+leadId,{stage:'won',amount:250,currency:'USD'}),env,session);
  assert.equal(updated.status,200);
  assert.equal((await updated.json()).lead.stage,'won');
  const list=await handleLeadsApi(req('GET','/api/crm/leads?business_id='+business),env,session);
  assert.equal(list.status,200);
  const rows=(await list.json()).leads;
  assert.equal(rows.length,1);
  assert.equal(rows[0].amount,250);
  assert.equal(rows[0].currency,'PEN'); // stage PATCH does not silently rewrite currency
 });
});
