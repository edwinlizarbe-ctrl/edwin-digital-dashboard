import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSearchConsoleApi } from '../search-console.js';

const origin='https://example.workers.dev';
const company='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const session={user:{id:'11111111-1111-4111-8111-111111111111',role:'client'},access:'test-session',cookies:[]};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const enc=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function encrypted(value,hex){
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),n=>parseInt(n,16)),'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value)));
 return enc(iv)+'.'+enc(new Uint8Array(data));
}
function mockServer({sitesStatus=200,feature=true}={}){
 const calls=[],env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'fake-anon-key',SUPABASE_SERVICE_ROLE_KEY:'fake-service-key',GOOGLE_SEARCH_CONSOLE_CLIENT_ID:'test-id',GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET:'fake-test-secret',GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY:'ab'.repeat(32)};
 let connection=null,nonces=[];
 const fetchMock=async(url,opt={})=>{
  const u=String(url),method=opt.method||'GET';
  calls.push({url:u,method,headers:opt.headers,body:opt.body});
  if(u.includes('/rest/v1/businesses?'))return json(u.includes(company)?[{id:company}]:[]);
  if(u.includes('/rest/v1/ed_business_features?'))return json([{business_id:company,plan:'free',features:{search_console:feature}}]);
  if(u.includes('/rest/v1/ed_search_console_oauth_nonces')){
   if(method==='POST'){nonces.push(JSON.parse(opt.body));return json([{}]);}
   if(method==='DELETE'){const n=nonces;nonces=[];return json(n);}
  }
  if(u.includes('/rest/v1/ed_search_console_connections')){
   if(method==='POST'){connection={...(connection||{}),...JSON.parse(opt.body)};return json([connection]);}
   if(method==='PATCH'){Object.assign(connection,JSON.parse(opt.body));return json([connection]);}
   if(method==='DELETE'){connection=null;return json([{business_id:company}]);}
   return json(connection?[connection]:[]);
  }
  if(u==='https://oauth2.googleapis.com/token'){
   const p=new URLSearchParams(opt.body);
   if(p.get('grant_type')==='authorization_code')return json({access_token:'access-1',refresh_token:'refresh-secret-1'});
   return json({access_token:'access-2'});
  }
  if(u==='https://www.googleapis.com/webmasters/v3/sites')return sitesStatus===200?json({siteEntry:[{siteUrl:'sc-domain:example.com',permissionLevel:'siteOwner'},{siteUrl:'https://other.com/',permissionLevel:'siteUnverifiedUser'},{siteUrl:'javascript:alert(1)',permissionLevel:'siteOwner'}]}):json({},sitesStatus);
  if(u.includes('/searchAnalytics/query')){
   const b=JSON.parse(opt.body);
   if(b.dimensions[0]==='date')return json({rows:[{keys:['2026-10-01'],clicks:10,impressions:100,ctr:.1,position:4},{keys:['2026-10-02'],clicks:20,impressions:300,ctr:.0667,position:8}]});
   return json({rows:[{keys:['edwin crm'],clicks:5,impressions:50,ctr:.1,position:3}]});
  }
  throw Error('Unexpected mock URL: '+u);
 };
 return {env,calls,fetchMock,connection:()=>connection,setConnection:x=>{connection=x}};
}
async function scoped(action,opts){
 const backup=globalThis.fetch,server=mockServer(opts);
 try{globalThis.fetch=server.fetchMock;await action(server);}finally{globalThis.fetch=backup;}
}
const req=(path,init)=>new Request(origin+path,init);
const connectAndCallback=async(server,{code='mock-code'}={})=>{
 const begin=await handleSearchConsoleApi(req('/api/search-console/connect?business_id='+company),server.env,session);
 const login=new URL(begin.headers.get('Location'));
 const cookie=begin.headers.get('Set-Cookie').split(';')[0];
 const cb=await handleSearchConsoleApi(req('/api/search-console/callback?state='+encodeURIComponent(login.searchParams.get('state'))+'&code='+code,{headers:{Cookie:cookie}}),server.env,session);
 return {begin,login,cookie,cb};
};
const withToken=async server=>server.setConnection({business_id:company,refresh_token_cipher:await encrypted({refresh_token:'r'},server.env.GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY),selected_site_url:'sc-domain:example.com'});

test('malformed business id is rejected with 403 before storage access',async()=>{
 await scoped(async s=>{
  const r=await handleSearchConsoleApi(req('/api/search-console/status?business_id=bad'),s.env,session);
  assert.equal(r.status,403);
  assert.equal(s.calls.some(x=>x.url.includes('ed_search_console')),false);
 });
});
test('administrator and other businesses are forbidden',async()=>{
 await scoped(async s=>{
  const admin=await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,{...session,user:{...session.user,role:'admin'}});
  assert.equal(admin.status,403);
  const foreign=await handleSearchConsoleApi(req('/api/search-console/report?business_id='+other),s.env,session);
  assert.equal(foreign.status,403);
  assert.equal(s.calls.some(x=>x.url.includes('ed_search_console')),false);
 });
});
test('ownership is checked with the user JWT, never service_role',async()=>{
 await scoped(async s=>{
  await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,session);
  const own=s.calls.find(x=>x.url.includes('/rest/v1/businesses?'));
  assert.equal(own.headers.Authorization,'Bearer test-session');
 });
});
test('feature flag search_console off returns 403',async()=>{
 await scoped(async s=>{
  const r=await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,session);
  assert.equal(r.status,403);
 },{feature:false});
});
test('status reports configured:false with missing variable names only',async()=>{
 await scoped(async s=>{
  delete s.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
  const body=await (await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,session)).json();
  assert.equal(body.configured,false);assert.equal(body.connected,false);
  assert.deepEqual(body.missing_config,['GOOGLE_SEARCH_CONSOLE_CLIENT_ID']);
  const c=await handleSearchConsoleApi(req('/api/search-console/connect?business_id='+company),s.env,session);
  assert.equal(c.status,503);
 });
});
test('connect redirects with read-only scope, state and secure cookie',async()=>{
 await scoped(async s=>{
  const r=await handleSearchConsoleApi(req('/api/search-console/connect?business_id='+company),s.env,session);
  assert.equal(r.status,302);
  const u=new URL(r.headers.get('Location'));
  assert.equal(u.searchParams.get('scope'),'https://www.googleapis.com/auth/webmasters.readonly');
  assert.equal(u.searchParams.get('redirect_uri'),origin+'/api/search-console/callback');
  assert.ok(u.searchParams.get('state').length>=32);
  const sc=r.headers.get('Set-Cookie');
  assert.match(sc,/HttpOnly/);assert.match(sc,/Secure/);assert.match(sc,/SameSite=Lax/);assert.match(sc,/Max-Age=600/);
  assert.equal(s.calls.some(x=>x.url.includes('ed_ga4')),false);
 });
});
test('callback stores an encrypted token only, redirects without token and consumes nonce once',async()=>{
 await scoped(async s=>{
  const {cb,cookie,login}=await connectAndCallback(s);
  assert.equal(cb.status,302);
  assert.match(cb.headers.get('Location'),/search_console=connected/);
  assert.equal(s.connection().refresh_token_cipher.includes('refresh-secret-1'),false);
  assert.ok(s.connection().refresh_token_cipher.includes('.'));
  assert.equal(JSON.stringify([...cb.headers]).includes('refresh-secret-1'),false);
  // replay is rejected
  const replay=await handleSearchConsoleApi(req('/api/search-console/callback?state='+encodeURIComponent(login.searchParams.get('state'))+'&code=x',{headers:{Cookie:cookie}}),s.env,session);
  assert.equal(replay.status,403);
 });
});
test('callback rejects forged state and missing cookie',async()=>{
 await scoped(async s=>{
  const begin=await handleSearchConsoleApi(req('/api/search-console/connect?business_id='+company),s.env,session);
  const cookie=begin.headers.get('Set-Cookie').split(';')[0];
  const forged=await handleSearchConsoleApi(req('/api/search-console/callback?state=forged&code=x',{headers:{Cookie:cookie}}),s.env,session);
  assert.equal(forged.status,403);
  const none=await handleSearchConsoleApi(req('/api/search-console/callback?state=x&code=x'),s.env,session);
  assert.equal(none.status,403);
  assert.equal(s.connection(),null);
 });
});
test('callback does not save a connection when the Search Console API does not answer',async()=>{
 await scoped(async s=>{
  const {cb}=await connectAndCallback(s);
  assert.match(cb.headers.get('Location'),/search_console=failed/);
  assert.equal(s.connection(),null);
 },{sitesStatus:403});
});
test('status connected only for a readable token; stale key asks to reauthorize',async()=>{
 await scoped(async s=>{
  await withToken(s);
  const ok=await (await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,session)).json();
  assert.equal(ok.connected,true);assert.equal(ok.selected_site_url,'sc-domain:example.com');
  assert.equal(JSON.stringify(ok).includes('cipher'),false);
  s.env.GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY='cd'.repeat(32);
  const stale=await (await handleSearchConsoleApi(req('/api/search-console/status?business_id='+company),s.env,session)).json();
  assert.equal(stale.connected,false);assert.equal(stale.needs_reauthorization,true);
 });
});
test('sites lists only verified, well-formed sites',async()=>{
 await scoped(async s=>{
  await withToken(s);
  const body=await (await handleSearchConsoleApi(req('/api/search-console/sites?business_id='+company),s.env,session)).json();
  assert.deepEqual(body.sites.map(x=>x.url),['sc-domain:example.com']);
 });
});
test('select-site validates origin, content type, and membership in the Google list',async()=>{
 await scoped(async s=>{
  await withToken(s);
  const post=(body,headers={'Content-Type':'application/json'})=>handleSearchConsoleApi(req('/api/search-console/select-site?business_id='+company,{method:'POST',headers,body:JSON.stringify(body)}),s.env,session);
  assert.equal((await post({site_url:'sc-domain:example.com'},{'Content-Type':'text/plain'})).status,403);
  assert.equal((await post({site_url:'sc-domain:example.com'},{'Content-Type':'application/json',Origin:'https://evil.test'})).status,403);
  assert.equal((await post({site_url:'not a site'})).status,400);
  assert.equal((await post({site_url:'sc-domain:notmine.com'})).status,403);
  assert.equal((await post({site_url:'sc-domain:example.com'})).status,200);
 });
});
test('report validates period and returns aggregated real-API data',async()=>{
 await scoped(async s=>{
  await withToken(s);
  const bad=await handleSearchConsoleApi(req('/api/search-console/report?business_id='+company+'&period=9999d'),s.env,session);
  assert.equal(bad.status,400);
  const r=await handleSearchConsoleApi(req('/api/search-console/report?business_id='+company+'&period=7d'),s.env,session);
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.totals.clicks,30);assert.equal(body.totals.impressions,400);
  assert.equal(body.totals.ctr,30/400);
  assert.equal(body.totals.position,(4*100+8*300)/400);
  assert.equal(body.queries[0].query,'edwin crm');
  assert.equal(JSON.stringify(body).includes('access-2'),false);
 });
});
test('report without selected site returns 409; upstream failure returns 502 without Conectado data',async()=>{
 await scoped(async s=>{
  await withToken(s);s.connection().selected_site_url=null;
  assert.equal((await handleSearchConsoleApi(req('/api/search-console/report?business_id='+company),s.env,session)).status,409);
 });
 await scoped(async s=>{
  await withToken(s);
  const prev=globalThis.fetch;
  globalThis.fetch=async(u,o)=>String(u).includes('searchAnalytics')?json({},500):prev(u,o);
  const r=await handleSearchConsoleApi(req('/api/search-console/report?business_id='+company),s.env,session);
  assert.equal(r.status,502);
 });
});
test('disconnect deletes the connection (POST + JSON only)',async()=>{
 await scoped(async s=>{
  await withToken(s);
  const bad=await handleSearchConsoleApi(req('/api/search-console/disconnect?business_id='+company,{method:'POST'}),s.env,session);
  assert.equal(bad.status,403);
  const ok=await handleSearchConsoleApi(req('/api/search-console/disconnect?business_id='+company,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),s.env,session);
  assert.equal(ok.status,200);assert.equal(s.connection(),null);
 });
});
test('unknown route returns 404',async()=>{
 await scoped(async s=>{
  await withToken(s);
  assert.equal((await handleSearchConsoleApi(req('/api/search-console/nope?business_id='+company),s.env,session)).status,404);
 });
});
