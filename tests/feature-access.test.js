import test from 'node:test';
import assert from 'node:assert/strict';
import {handleFeaturesApi,ensureBusinessFeature,readBusinessEntitlements,resetFeatureWarnings,strictMode,ED_FEATURES} from '../feature-access.js';
const base='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const admin={user:{id:'11111111-1111-4111-8111-111111111111',role:'admin'},access:'jwt-test',cookies:[]};
const client={user:{id:'22222222-2222-4222-8222-222222222222',role:'client'},access:'jwt-test',cookies:[]};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const freeRow=(over={})=>({business_id:business,plan:'free',features:{ga4:true,meta_ads:false,google_ads:true},updated_at:'2026-10-14T01:00:00.000001+00:00',...over});

// Stateful fake of the two Supabase tables the module touches.
async function inServer(fn,{row=freeRow(),featureStatus=null,featureThrows=false,beforePatch=null}={}){
 const original=globalThis.fetch,calls=[];let stored=row;
 globalThis.fetch=async(url,options={})=>{
  const u=String(url),method=options.method||'GET';calls.push({url:u,method,body:options.body});
  if(u.includes('/rest/v1/businesses?'))return json(u.includes(business)?[{id:business}]:[]);
  if(u.includes('/rest/v1/ed_business_features')){
   if(featureThrows)throw new TypeError('network down');
   if(method==='GET'){
    if(featureStatus)return featureStatus instanceof Response?featureStatus.clone():json({},featureStatus);
    return json(stored&&u.includes('business_id=eq.'+business)?[stored]:[]);
   }
   if(method==='PATCH'){
    if(beforePatch){beforePatch(v=>{stored=v;});}
    const guard=decodeURIComponent((u.match(/updated_at=eq\.([^&]+)/)||[])[1]||'');
    if(!stored||!u.includes('business_id=eq.'+business)||stored.updated_at!==guard)return json([]);
    stored={...stored,...JSON.parse(options.body),updated_at:'2026-10-14T02:00:00.000001+00:00'};
    return json([stored]);
   }
   if(method==='POST'){
    if(stored)return json({code:'23505'},409);
    stored={business_id:business,...JSON.parse(options.body),updated_at:'2026-10-14T02:00:00.000001+00:00'};
    return json([stored],201);
   }
  }
  throw Error('Unexpected request: '+u);
 };
 try{await fn({calls,row:()=>stored});}finally{globalThis.fetch=original;}
}
const post=body=>new Request(base+'/api/admin/business-features',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body});
const get=(path,)=>new Request(base+path);

// 1. A Supabase failure must never re-enable revoked permissions.
test('fails closed when the features table cannot be read',async()=>{
 for(const outage of [{featureStatus:500},{featureStatus:401},{featureStatus:json({code:'XX'},404)},{featureThrows:true},{featureStatus:json({oops:true})}]){
  await inServer(async()=>{
   const data=await readBusinessEntitlements(env,client,business);
   assert.equal(data.unavailable,true);
   assert.ok(ED_FEATURES.every(k=>data.features[k]===false));
   for(const feature of ['ga4','meta_ads','google_ads'])assert.equal(await ensureBusinessFeature(env,client,business,feature),false);
   const res=await handleFeaturesApi(get('/api/client/features?business_id='+business),env,client);
   assert.equal(res.status,200);
   const body=await res.json();
   assert.ok(ED_FEATURES.every(k=>body.features[k]===false));
  },outage);
 }
});
test('keeps legacy defaults only when the service key or migration is absent',async()=>{
 await inServer(async()=>{
  const data=await readBusinessEntitlements({...env,SUPABASE_SERVICE_ROLE_KEY:''},client,business);
  assert.equal(data.configured,false);
  assert.equal(data.features.ga4,true);assert.equal(data.features.meta_ads,true);assert.equal(data.features.google_ads,false);
 });
 await inServer(async()=>{
  const data=await readBusinessEntitlements(env,client,business);
  assert.equal(data.configured,false);assert.equal(data.features.ga4,true);
 },{featureStatus:json({code:'PGRST205'},404)});
});
test('stored revocations survive and unknown or non-boolean flags are ignored',async()=>{
 await inServer(async()=>{
  const data=await readBusinessEntitlements(env,client,business);
  assert.equal(data.features.ga4,false);
  assert.equal(data.features.google_ads,false);
  assert.equal(data.features.admin,undefined);
 },{row:freeRow({features:{ga4:false,google_ads:'yes',admin:true}})});
});
test('writes refuse to proceed when current permissions are unreadable',async()=>{
 await inServer(async({calls})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,feature:'ga4',enabled:true})),env,admin);
  assert.equal(res.status,502);
  assert.ok(!calls.some(c=>c.method!=='GET'&&c.url.includes('ed_business_features')));
 },{featureStatus:500});
});

// 2. Concurrent edits must not overwrite each other.
test('toggle is a guarded PATCH on the row version that was read',async()=>{
 await inServer(async({calls,row})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,feature:'ga4',enabled:false})),env,admin);
  assert.equal(res.status,200);
  const patch=calls.find(c=>c.method==='PATCH');
  assert.match(patch.url,/business_id=eq\.0000/);
  assert.ok(patch.url.includes('updated_at=eq.'+encodeURIComponent('2026-10-14T01:00:00.000001+00:00')));
  assert.equal(row().features.ga4,false);
  assert.equal(row().features.google_ads,true);
 });
});
test('a concurrent change is retried on fresh data instead of being overwritten',async()=>{
 let raced=false;
 await inServer(async({row})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,feature:'ga4',enabled:false})),env,admin);
  assert.equal(res.status,200);
  // Both the racing writer's change (shopify) and ours (ga4) are kept.
  assert.equal(row().features.shopify,true);
  assert.equal(row().features.ga4,false);
 },{beforePatch:set=>{
  if(raced)return;raced=true;
  set(freeRow({features:{ga4:true,meta_ads:false,google_ads:true,shopify:true},updated_at:'2026-10-14T01:30:00.000001+00:00'}));
 }});
});
test('persistent conflicts return 409 and never force a write',async()=>{
 let version=0;
 await inServer(async({calls})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,feature:'ga4',enabled:false})),env,admin);
  assert.equal(res.status,409);
  assert.equal(calls.filter(c=>c.method==='PATCH').length,3);
 },{beforePatch:set=>set(freeRow({updated_at:'2026-10-14T01:30:00.00000'+(++version)+'+00:00'}))});
});
test('first plan assignment uses a plain insert and never merges',async()=>{
 await inServer(async({calls,row})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,plan:'premium'})),env,admin);
  assert.equal(res.status,200);
  const insert=calls.find(c=>c.method==='POST');
  assert.ok(!insert.url.includes('on_conflict'));
  assert.equal(row().plan,'premium');
 },{row:null});
});

// 3. JSON null (and other non-objects) is a client error.
test('non-object JSON bodies return 400 instead of throwing',async()=>{
 for(const raw of ['null','[]','"text"','42','true']){
  await inServer(async({calls})=>{
   const res=await handleFeaturesApi(post(raw),env,admin);
   assert.equal(res.status,400,raw);
   assert.ok(!calls.some(c=>c.url.includes('ed_business_features')));
  });
 }
});

// Tenant isolation and access control are preserved.
test('writes to a business the admin cannot access are denied before any permission write',async()=>{
 await inServer(async({calls})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:other,feature:'ga4',enabled:true})),env,admin);
  assert.equal(res.status,403);
  assert.ok(!calls.some(c=>c.url.includes('ed_business_features')));
 });
});
test('only admins can write and the other tenant row is untouched',async()=>{
 await inServer(async({calls})=>{
  const res=await handleFeaturesApi(post(JSON.stringify({business_id:business,feature:'ga4',enabled:true})),env,client);
  assert.equal(res.status,403);
  assert.ok(!calls.some(c=>c.method!=='GET'));
 });
});

// ED_FEATURES_STRICT: legacy fallback vs fail-closed, warnings and health reporting.
const strictEnv={...env,ED_FEATURES_STRICT:'1'};
const noKey={...env,SUPABASE_SERVICE_ROLE_KEY:''};
const noMigration={featureStatus:json({code:'PGRST205'},404)};
async function captureWarnings(fn){
 const original=console.warn,logs=[];resetFeatureWarnings();
 console.warn=(...a)=>logs.push(a.join(' '));
 try{await fn(logs);}finally{console.warn=original;resetFeatureWarnings();}
}
test('strict flag only accepts 1 or true and is off by default',()=>{
 assert.equal(strictMode({}),false);
 assert.equal(strictMode({ED_FEATURES_STRICT:'0'}),false);
 assert.equal(strictMode({ED_FEATURES_STRICT:'yes'}),false);
 assert.equal(strictMode({ED_FEATURES_STRICT:'1'}),true);
 assert.equal(strictMode({ED_FEATURES_STRICT:' TRUE '}),true);
});
test('legacy mode (default) keeps GA4 and Meta for existing clients and warns once',async()=>{
 await captureWarnings(async logs=>{
  await inServer(async()=>{
   for(const e of [noKey,env])for(let i=0;i<2;i++){
    const data=await readBusinessEntitlements(e,client,business);
    assert.equal(data.features.ga4,true);assert.equal(data.features.meta_ads,true);assert.equal(data.features.google_ads,false);
    assert.equal(data.unavailable,undefined);
   }
   assert.equal(await ensureBusinessFeature(noKey,client,business,'ga4'),true);
  },noMigration);
  assert.equal(logs.length,2,'one warning per reason, not per request');
  assert.ok(logs.every(l=>l.includes('SECURITY')&&l.includes('legacy')&&!l.includes(business)&&!l.includes('service-test')));
 });
});
test('strict mode denies everything when the key or migration is missing',async()=>{
 await captureWarnings(async logs=>{
  for(const [e,opts] of [[{...strictEnv,SUPABASE_SERVICE_ROLE_KEY:''},{}],[strictEnv,noMigration]]){
   await inServer(async()=>{
    const data=await readBusinessEntitlements(e,client,business);
    assert.equal(data.unavailable,true);assert.equal(data.strict_blocked,true);
    assert.ok(ED_FEATURES.every(k=>data.features[k]===false));
    for(const f of ['ga4','meta_ads'])assert.equal(await ensureBusinessFeature(e,client,business,f),false);
   },opts);
  }
  assert.ok(logs.length>=2&&logs.every(l=>l.includes('ED_FEATURES_STRICT is on')));
 });
});
test('strict mode does not change a provisioned business',async()=>{
 await inServer(async()=>{
  const data=await readBusinessEntitlements(strictEnv,client,business);
  assert.equal(data.features.ga4,true);assert.equal(data.features.google_ads,true);assert.equal(data.provisioned,true);
  assert.equal(await ensureBusinessFeature(strictEnv,client,business,'meta_ads'),false);
 });
});
test('strict mode still isolates tenants',async()=>{
 await inServer(async()=>{
  assert.equal(await readBusinessEntitlements(strictEnv,client,other),null);
  assert.equal(await ensureBusinessFeature(strictEnv,client,other,'ga4'),false);
 });
});
test('health reports legacy fallback with a security warning (admin only)',async()=>{
 await captureWarnings(async()=>{
  const health=(e,s=admin)=>handleFeaturesApi(get('/api/admin/business-features/health'),e,s);
  await inServer(async()=>{
   let body=await(await health(noKey)).json();
   assert.equal(body.legacy_fallback_active,true);assert.equal(body.strict_mode,false);
   assert.match(body.security_warning,/ED_FEATURES_STRICT=1/);
   body=await(await health(env)).json();
   assert.equal(body.migration_applied,false);assert.equal(body.legacy_fallback_active,true);
   body=await(await health({...noKey,ED_FEATURES_STRICT:'1'})).json();
   assert.equal(body.strict_mode,true);assert.equal(body.legacy_fallback_active,false);
   assert.match(body.security_warning,/estricto/);
   assert.equal((await health(env,client)).status,403);
  },noMigration);
  await inServer(async()=>{
   const body=await(await health(env)).json();
   assert.equal(body.configured,true);assert.equal(body.migration_applied,true);
   assert.equal(body.legacy_fallback_active,false);assert.equal(body.security_warning,undefined);
  });
  await inServer(async()=>{
   const body=await(await health(env)).json();
   assert.equal(body.migration_applied,false);
   assert.equal(body.legacy_fallback_active,false,'a transient outage is not the legacy fallback');
  },{featureStatus:500});
 });
});
