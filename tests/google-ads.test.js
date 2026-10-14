import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGoogleAdsApi } from '../google-ads.js';

const origin='https://example.workers.dev';
const company='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'test-session',cookies:[]};
const envBase={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fake-anon-key'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const enc=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function encrypted(value,hex){
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),n=>parseInt(n,16)),'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value)));
 return enc(iv)+'.'+enc(new Uint8Array(data));
}
function mockServer(allow=company){
 const calls=[],key='ab'.repeat(32),env={...envBase,GOOGLE_ADS_CLIENT_ID:'test-id',GOOGLE_ADS_CLIENT_SECRET:'fake-test-secret',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key',GOOGLE_ADS_ENCRYPTION_KEY:key};
 let connection={business_id:company,refresh_token_cipher:'',selected_customer_id:null,selected_login_customer_id:null};
 let nonces=[];
 const fetchMock=async (url,opt={})=>{
  const u=String(url),method=opt.method||'GET';
  calls.push({url:u,method,headers:opt.headers,body:opt.body});
  if(u.includes('/rest/v1/businesses?'))return json(u.includes(allow)?[{id:allow}]:[]);
  if(u.includes('/rest/v1/ed_business_features?'))return json([{business_id:company,plan:'free',features:{google_ads:true}}]);
  if(u.includes('/rest/v1/ed_google_ads_connections?')){
   if(method==='PATCH'){Object.assign(connection,JSON.parse(opt.body));return json([connection]);}
   if(method==='DELETE'){connection=null;return json([{business_id:company}]);}
   return json(connection?[connection]:[]);
  }
  if(u.includes('/rest/v1/ed_google_oauth_nonces')){
   if(method==='DELETE'){const old=nonces;nonces=[];return json(old);}
   if(method==='POST'){nonces.push(JSON.parse(opt.body));return json(nonces);}
   return json(nonces);
  }
  if(u==='https://oauth2.googleapis.com/token')return json({access_token:'fake-access-token',expires_in:3600,refresh_token:'fake-refresh-token'});
  if(u.includes('/customers:listAccessibleCustomers'))return json({resourceNames:['customers/1111111111']});
  if(u.includes('googleads.googleapis.com')){
   const payload=opt.body?JSON.parse(opt.body):{};
   if(payload.query?.includes('FROM customer_client'))return json({results:[
    {customerClient:{id:'1111111111',descriptiveName:'MCC',manager:true,status:'ENABLED'}},
    {customerClient:{id:'2222222222',descriptiveName:'Cliente de prueba',currencyCode:'PEN',manager:false,status:'ENABLED'}}
   ]});
   if(payload.query?.includes('FROM customer LIMIT 1'))return json({results:[{customer:{currencyCode:'PEN',timeZone:'America/Lima'}}]});
   if(payload.query?.includes('FROM campaign')){
    if(payload.pageToken==='page2')return json({results:[{campaign:{id:'2',name:'Campaña B',status:'PAUSED'},metrics:{impressions:'0',clicks:'0',costMicros:'0',conversions:0,conversionsValue:0}}]});
    return json({results:[{campaign:{id:'1',name:'Campaña A',status:'ENABLED'},metrics:{impressions:'1000',clicks:'100',costMicros:'25000000',conversions:3,conversionsValue:125}}],nextPageToken:'page2'});
   }
  }
  throw Error('Unexpected mock URL: '+u);
 };
 return {env,calls,fetchMock,connection:()=>connection,setConnection:x=>{connection=x},nonces:()=>nonces};
}
async function scopedTest(action){
 const backup=globalThis.fetch,server=mockServer();
 try{
  globalThis.fetch=server.fetchMock;
  server.setConnection({...server.connection(),refresh_token_cipher:await encrypted({refresh_token:'fake-refresh-token'},server.env.GOOGLE_ADS_ENCRYPTION_KEY)});
  await action(server);
 }finally{globalThis.fetch=backup;}
}
test('malformed business IDs rejected before upstream calls',async()=>{
 const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/status?business_id=bad'),envBase,session);
 assert.equal(r.status,403);
});
test('administrator cannot use customer OAuth integration',async()=>{
 const admin={...session,user:{...session.user,role:'admin'}};
 const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/status?business_id='+company),envBase,admin);
 assert.equal(r.status,403);
});
test('another business cannot access connection data',async()=>{
 await scopedTest(async server=>{
  const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/status?business_id='+other),server.env,session);
  assert.equal(r.status,403);
  assert.equal(server.calls.some(x=>x.url.includes('ed_google_ads_connections')),false);
 });
});
test('MCC child accounts are returned and manager is tagged',async()=>{
 await scopedTest(async server=>{
  const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/accounts?business_id='+company),server.env,session);
  assert.equal(r.status,200);
  const a=(await r.json()).accounts;
  assert.equal(a.find(x=>x.id==='1111111111').manager,true);
  assert.equal(a.find(x=>x.id==='2222222222').login_customer_id,'1111111111');
 });
});
test('account selection rejects managers and foreign accounts',async()=>{
 await scopedTest(async server=>{
  for(const customer_id of ['1111111111','3333333333']){
   const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/select?business_id='+company,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify({customer_id})}),server.env,session);
   assert.equal(r.status,403);
  }
  const ok=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/select?business_id='+company,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify({customer_id:'2222222222'})}),server.env,session);
  assert.equal(ok.status,200);
  assert.equal(server.connection().selected_login_customer_id,'1111111111');
 });
});
test('campaign metrics, pagination, currency and manager header are consistent',async()=>{
 await scopedTest(async server=>{
  server.connection().selected_customer_id='2222222222';
  server.connection().selected_login_customer_id='1111111111';
  const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/campaigns?business_id='+company+'&days=90'),server.env,session);
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.currency,'PEN');
  assert.equal(body.rows.length,2);
  assert.equal(body.partial,false);
  assert.equal(body.rows[0].spend,25);
  assert.equal(body.rows[0].ctr,10);
  assert.equal(body.rows[0].cpc,0.25);
  assert.equal(body.rows[0].roas,5);
  assert.equal(body.rows[1].roas,null);
  assert(server.calls.some(x=>x.url.includes('googleAds:search')&&x.headers?.['login-customer-id']==='1111111111'));
  assert(server.calls.some(x=>String(x.body||'').includes('segments.date BETWEEN')));
  assert(server.calls.some(x=>String(x.body||'').includes('pageToken')));
 });
});
test('cross-origin POST account selection rejected',async()=>{
 await scopedTest(async server=>{
  const r=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/select?business_id='+company,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://attacker.example'},body:'{"customer_id":"2222222222"}'}),server.env,session);
  assert.equal(r.status,403);
 });
});

test('OAuth callback is single use and a replay cannot exchange a second code',async()=>{
 await scopedTest(async server=>{
  const state='valid-one-time-state';
  server.nonces().push({nonce_hash:'test-nonce',user_id:session.user.id,business_id:company,expires_at:new Date(Date.now()+60000).toISOString()});
  const pending=await encrypted({state,user:session.user.id,business:company,until:Date.now()+60000},server.env.GOOGLE_ADS_ENCRYPTION_KEY);
  const request=()=>new Request(origin+'/api/google-ads/callback?state='+state+'&code=mock-code',{headers:{Cookie:'ed_google_pending='+encodeURIComponent(pending)}});
  const first=await handleGoogleAdsApi(request(),server.env,session);
  assert.equal(first.status,302);
  const replay=await handleGoogleAdsApi(request(),server.env,session);
  assert.equal(replay.status,403);
  assert.equal(server.calls.filter(x=>x.url==='https://oauth2.googleapis.com/token'&&String(x.body).includes('authorization_code')).length,1);
 });
});
test('OAuth callback rejects mismatched user and state before querying the connection',async()=>{
 await scopedTest(async server=>{
  const pending=await encrypted({state:'expected',user:session.user.id,business:company,until:Date.now()+60000},server.env.GOOGLE_ADS_ENCRYPTION_KEY);
  const res=await handleGoogleAdsApi(new Request(origin+'/api/google-ads/callback?state=forged&code=fake',{headers:{Cookie:'ed_google_pending='+encodeURIComponent(pending)}}),server.env,session);
  assert.equal(res.status,403);
  assert.equal(server.calls.some(x=>x.url.includes('ed_google_oauth_nonces')),false);
 });
});
