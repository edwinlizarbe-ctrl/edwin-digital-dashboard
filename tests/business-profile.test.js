import test from 'node:test';
import assert from 'node:assert/strict';
import {handleBusinessProfileApi} from '../business-profile.js';

const origin='https://example.workers.dev';
const company='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'test-jwt',cookies:[]};
const req=(path,init)=>new Request(origin+path,init);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function mock({approved=true,enabled=true,providerStatus=200}={}){
 const calls=[];
 const env={
  SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',
  GOOGLE_BUSINESS_PROFILE_CLIENT_ID:'client-id',GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET:'client-secret',
  GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY:'ac'.repeat(32),
  GOOGLE_BUSINESS_PROFILE_API_APPROVED:approved?'true':'false'
 };
 let conn=null,nonces=[];
 async function fetchMock(url,opt={}){
  const link=String(url),method=opt.method||'GET';calls.push({link,method,body:opt.body,headers:opt.headers});
  if(link.includes('/rest/v1/businesses?'))return json(link.includes(company)?[{id:company}]:[]);
  if(link.includes('/rest/v1/ed_business_features?'))return json([{plan:'free',features:{business_profile:enabled}}]);
  if(link.includes('/rest/v1/ed_gbp_oauth_nonces')){
   if(method==='POST'){nonces.push(JSON.parse(opt.body));return json([{}]);}
   if(method==='DELETE'){const saved=nonces;nonces=[];return json(saved);}
  }
  if(link.includes('/rest/v1/ed_gbp_connections')){
   if(method==='POST'){conn=JSON.parse(opt.body);return json([conn]);}
   if(method==='PATCH'){conn={...conn,...JSON.parse(opt.body)};return json([conn]);}
   if(method==='DELETE'){conn=null;return json([{business_id:company}]);}
   return json(conn?[conn]:[]);
  }
  if(link==='https://oauth2.googleapis.com/token'){
   const p=new URLSearchParams(opt.body);
   if(p.get('grant_type')==='authorization_code')return json({access_token:'oauth-token',refresh_token:'private-refresh'});
   if(p.get('grant_type')==='refresh_token')return json({access_token:'api-token'});
  }
  if(link.startsWith('https://mybusinessaccountmanagement.googleapis.com/')){
   return providerStatus!==200?json({},providerStatus):json({accounts:[{name:'accounts/1234',accountName:'Mi empresa'}]});
  }
  if(link.startsWith('https://mybusinessbusinessinformation.googleapis.com/')){
   return json({locations:[{name:'locations/98765',title:'Primera tienda',storefrontAddress:{addressLines:['Lima']}},{name:'locations/65432',title:'Sucursal segunda'}]});
  }
  if(link.startsWith('https://businessprofileperformance.googleapis.com/')){
   return json({multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[
    {dailyMetric:'WEBSITE_CLICKS',timeSeries:{datedValues:[{date:{year:2026,month:10,day:20},value:'13'},{date:{year:2026,month:10,day:21},value:'7'}]}},
    {dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{date:{year:2026,month:10,day:20},value:'3'}]}}
   ]}]});
  }
  throw Error('Unexpected URL: '+link);
 }
 return {env,calls,fetchMock,connection:()=>conn,nonces:()=>nonces};
}
async function scoped(fn,options){
 const old=globalThis.fetch,server=mock(options);
 globalThis.fetch=server.fetchMock;
 try{return await fn(server);}finally{globalThis.fetch=old;}
}
async function authorize(server){
 const begin=await handleBusinessProfileApi(req('/api/business-profile/connect?business_id='+company),server.env,session);
 assert.equal(begin.status,302);
 const url=new URL(begin.headers.get('Location'));
 const cookie=begin.headers.get('Set-Cookie').split(';')[0];
 const callback=await handleBusinessProfileApi(req('/api/business-profile/callback?state='+encodeURIComponent(url.searchParams.get('state'))+'&code=google-code',{headers:{Cookie:cookie}}),server.env,session);
 return {begin,url,cookie,callback};
}
test('GBP denies cross-tenant requests before touching provider or credential storage',async()=>{
 await scoped(async s=>{
  const r=await handleBusinessProfileApi(req('/api/business-profile/status?business_id='+other),s.env,session);
  assert.equal(r.status,403);
  assert.equal(s.calls.some(x=>x.link.includes('ed_gbp_')),false);
 });
});
test('GBP remains explicitly unconfigured until Google grants API approval',async()=>{
 await scoped(async s=>{
  const r=await handleBusinessProfileApi(req('/api/business-profile/status?business_id='+company),s.env,session);
  const x=await r.json();
  assert.equal(r.status,200);assert.equal(x.configured,false);assert.equal(x.connected,false);
  assert.equal(x.missing_config.some(v=>v.includes('Aprobación')),true);
 },{approved:false});
});
test('feature flag blocks GBP even when Google project credentials exist',async()=>{
 await scoped(async s=>{
  const r=await handleBusinessProfileApi(req('/api/business-profile/status?business_id='+company),s.env,session);
  assert.equal(r.status,403);
 },{enabled:false});
});
test('OAuth challenge is one-time, callback encrypts refresh token, and response never leaks it',async()=>{
 await scoped(async s=>{
  const {url,cookie,callback}=await authorize(s);
  assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/business.manage');
  assert.equal(callback.status,302);assert.equal(s.connection().refresh_token_cipher.includes('private-refresh'),false);
  assert.equal(s.connection().selected_location,null);
  const reused=await handleBusinessProfileApi(req('/api/business-profile/callback?state='+encodeURIComponent(url.searchParams.get('state'))+'&code=google-code',{headers:{Cookie:cookie}}),s.env,session);
  assert.equal(reused.status,403);
  const st=await handleBusinessProfileApi(req('/api/business-profile/status?business_id='+company),s.env,session);
  assert.equal((await st.json()).connected,true);
 });
});
test('GBP verifies user-owned location before saving and reports only returned metrics',async()=>{
 await scoped(async s=>{
  await authorize(s);
  const rejected=await handleBusinessProfileApi(req('/api/business-profile/select-location?business_id='+company,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'locations/11111'})}),s.env,session);
  assert.equal(rejected.status,403);
  const selected=await handleBusinessProfileApi(req('/api/business-profile/select-location?business_id='+company,{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'locations/98765'})}),s.env,session);
  assert.equal(selected.status,200);
  const response=await handleBusinessProfileApi(req('/api/business-profile/report?business_id='+company+'&period=28d'),s.env,session);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.totals.WEBSITE_CLICKS,20);assert.equal(body.totals.CALL_CLICKS,3);
  assert.equal(body.totals.BUSINESS_DIRECTION_REQUESTS,undefined);
  assert.equal(body.partial,true);
  assert.equal(body.daily.length,2);
  assert.equal(JSON.stringify(body).includes('private-refresh'),false);
  assert.equal(s.calls.filter(x=>x.link.includes('businessprofileperformance')).every(x=>x.method==='GET'),true);
 });
});
test('provider authorization failure does not save any new refresh token',async()=>{
 await scoped(async s=>{
  const a=await authorize(s);
  assert.equal(new URL(a.callback.headers.get('Location')).searchParams.get('gbp'),'failed');
  assert.equal(s.connection(),null);
 },{providerStatus:403});
});
