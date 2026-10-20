import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminGa4 } from '../admin-ga4.js';

const origin='https://edwin.example';
const tenant='00000000-0000-4000-8000-000000000001';
const foreignTenant='00000000-0000-4000-8000-000000000002';
const siteId='00000000-0000-4000-8000-000000000003';
const foreignSiteId='00000000-0000-4000-8000-000000000004';
const admin={user:{id:'00000000-0000-4000-8000-000000000009',role:'admin'},cookies:[]};
const client={user:{id:'00000000-0000-4000-8000-000000000010',role:'client'},cookies:[]};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const serviceAccount=JSON.stringify({type:'service_account',client_email:'ga4-reader@unit-test.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----fake-----END PRIVATE KEY-----'});
function harness(){
 const calls=[],data={
  sites:[{id:siteId,business_id:tenant,name:'Principal',url:'https://principal.example',ga4_property_id:null},
   {id:foreignSiteId,business_id:foreignTenant,name:'Otro',url:'https://otro.example',ga4_property_id:null}],
  oauth:null,googleStatus:200
 };
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-role',GOOGLE_SERVICE_ACCOUNT_JSON:serviceAccount};
 const fetchMock=async (url,opt={})=>{
  const u=new URL(String(url)),method=opt.method||'GET';
  calls.push({url:u.toString(),method,body:opt.body,headers:opt.headers});
  if(u.hostname==='analyticsdata.googleapis.com')return json(data.googleStatus===200?{rows:[]}: {error:{message:'No access'}},data.googleStatus);
  if(u.pathname==='/rest/v1/businesses')return json(u.searchParams.get('id')==='eq.'+tenant?[{id:tenant,name:'Cliente Alfa'}]:[]);
  if(u.pathname==='/rest/v1/ed_ga4_connections')return json(data.oauth?[{selected_property_id:data.oauth}]:[]);
  if(u.pathname==='/rest/v1/sites'){
   const businessFilter=u.searchParams.get('business_id')||'';
   const biz=businessFilter.startsWith('eq.')?businessFilter.slice(3):null;
   const notBiz=businessFilter.startsWith('neq.')?businessFilter.slice(4):null;
   const site=u.searchParams.get('id')?.slice(3);
   const property=u.searchParams.get('ga4_property_id')?.slice(3);
   if(method==='GET')return json(data.sites.filter(x=>(!biz||x.business_id===biz)&&(!notBiz||x.business_id!==notBiz)&&(!site||x.id===site)&&(!property||x.ga4_property_id===property)));
   if(method==='PATCH'){
    const rows=data.sites.filter(x=>x.id===site&&x.business_id===biz);
    rows.forEach(x=>Object.assign(x,JSON.parse(opt.body)));
    return json(rows);
   }
   if(method==='POST'){
    const row={id:'00000000-0000-4000-8000-000000000005',...JSON.parse(opt.body)};
    data.sites.push(row);return json([row]);
   }
  }
  throw Error('Unexpected mock call: '+u);
 };
 const getServiceToken=async()=>{calls.push({url:'service-token',method:'TOKEN'});return 'fake-access-token';};
 return {calls,data,env,fetchMock,getServiceToken};
}
async function run(h,fn){
 const original=globalThis.fetch;
 try{globalThis.fetch=h.fetchMock;return await fn();}finally{globalThis.fetch=original;}
}
const GET=(id=tenant)=>new Request(origin+'/api/admin/ga4/manual?business_id='+encodeURIComponent(id));
const POST=(body,options={})=>new Request(origin+'/api/admin/ga4/manual',{method:'POST',headers:{Origin:options.origin||origin,'Content-Type':options.type||'application/json'},body:JSON.stringify(body)});
const payload=(extra={})=>({business_id:tenant,site_id:siteId,property_id:'123456789',...extra});
const call=(h,request,who=admin)=>handleAdminGa4(request,h.env,who,h.getServiceToken);
const writes=h=>h.calls.filter(x=>x.method==='PATCH'||x.method==='POST'&&x.url.includes('/rest/v1/sites'));

test('regular clients cannot view or provision other clients GA4 properties',async()=>{
 const h=harness();await run(h,async()=>{
  assert.equal((await call(h,GET(),client)).status,403);
  assert.equal((await call(h,POST(payload()),client)).status,403);
  assert.equal(h.calls.length,0);
 });
});
test('rejects bad business IDs, cross-origin requests, unsupported content type and oversized forms',async()=>{
 const h=harness();await run(h,async()=>{
  assert.equal((await call(h,GET('bad'))).status,400);
  assert.equal((await call(h,POST(payload(),{origin:'https://attacker.invalid'}))).status,403);
  assert.equal((await call(h,POST(payload(),{type:'text/plain'}))).status,415);
  const big=payload({site_name:'x'.repeat(1800)});
  assert.equal((await call(h,POST(big))).status,413);
  assert.equal(h.calls.length,0);
 });
});
test('admin gets only selected tenant sites and public service account email, not a secret',async()=>{
 const h=harness();await run(h,async()=>{
  const response=await call(h,GET());assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.business_name,'Cliente Alfa');
  assert.equal(body.service_account_configured,true);
  assert.equal(body.service_account_email,'ga4-reader@unit-test.iam.gserviceaccount.com');
  assert.equal(body.sites.length,1);
  assert.equal(body.sites[0].id,siteId);
  assert.equal(body.oauth_property_id,null);
  assert(!JSON.stringify(body).includes('private_key'));
  assert(!JSON.stringify(body).includes('fake-service-role'));
 });
});
test('missing private credentials block writes without touching sites',async()=>{
 const h=harness();delete h.env.GOOGLE_SERVICE_ACCOUNT_JSON;
 await run(h,async()=>{
  const get=await (await call(h,GET())).json();
  assert.equal(get.service_account_configured,false);
  const save=await call(h,POST(payload()));
  assert.equal(save.status,503);assert.equal(writes(h).length,0);
 });
});
test('rejects invalid or foreign site/property IDs before reaching Google',async()=>{
 const h=harness();await run(h,async()=>{
  const cases=[payload({property_id:'G-ABC'}),payload({site_id:'broken'}),payload({site_id:foreignSiteId})];
  const expected=[400,400,404];
  for(let i=0;i<cases.length;i++)assert.equal((await call(h,POST(cases[i]))).status,expected[i]);
  assert.equal(h.calls.some(x=>x.url.includes('analyticsdata.googleapis.com')),false);
  assert.equal(writes(h).length,0);
 });
});
test('an active OAuth-selected GA4 property blocks misleading manual assignments',async()=>{
 const h=harness();h.data.oauth='987654321';
 await run(h,async()=>{
  const get=await (await call(h,GET())).json();
  assert.equal(get.oauth_property_id,'987654321');
  const result=await call(h,POST(payload()));
  assert.equal(result.status,409);
  assert.equal(writes(h).length,0);
 });
});
test('cannot assign a GA4 property already linked to a different business',async()=>{
 const h=harness();h.data.sites[1].ga4_property_id='123456789';
 await run(h,async()=>{
  const result=await call(h,POST(payload()));
  assert.equal(result.status,409);
  assert.equal(writes(h).length,0);
  assert.equal(h.calls.some(x=>x.url.includes('analyticsdata.googleapis.com')),false);
 });
});
test('a failed Google permission verification leaves the existing site untouched',async()=>{
 const h=harness();h.data.googleStatus=403;
 await run(h,async()=>{
  const result=await call(h,POST(payload()));
  assert.equal(result.status,403);
  assert.equal(h.data.sites[0].ga4_property_id,null);
  assert.equal(writes(h).length,0);
  assert.equal(h.calls.some(x=>x.url.includes(':runReport')),true);
 });
});
test('success writes only GA4 property for the target site and reuses service-account verification',async()=>{
 const h=harness();await run(h,async()=>{
  const result=await call(h,POST(payload()));assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.verified,true);
  assert.equal(body.site.id,siteId);
  assert.equal(h.data.sites[0].ga4_property_id,'123456789');
  assert.equal(h.data.sites[1].ga4_property_id,null);
  const patch=writes(h);
  assert.equal(patch.length,1);
  assert.equal(patch[0].method,'PATCH');
  assert.equal(JSON.stringify(JSON.parse(patch[0].body)),JSON.stringify({ga4_property_id:'123456789'}));
  assert.equal(h.calls.filter(x=>x.url==='service-token').length,1);
  assert.equal(h.calls.filter(x=>x.url.includes('analyticsdata.googleapis.com')).length,1);
  assert.equal(h.calls.find(x=>x.url.includes('analyticsdata.googleapis.com')).headers.Authorization,'Bearer fake-access-token');
 });
});
test('admin can create a new site only after successful GA4 verification',async()=>{
 const h=harness();await run(h,async()=>{
  const invalid=await call(h,POST(payload({site_id:'',site_name:'New',site_url:'http://localhost'})));
  assert.equal(invalid.status,400);
  assert.equal(writes(h).length,0);
  const ok=await call(h,POST(payload({site_id:'',site_name:'Sitio nuevo',site_url:'https://cliente.example'})));
  assert.equal(ok.status,200);
  const row=h.data.sites.find(x=>x.id==='00000000-0000-4000-8000-000000000005');
  assert.equal(row.business_id,tenant);
  assert.equal(row.ga4_property_id,'123456789');
  assert.equal(row.url,'https://cliente.example');
  assert.equal(writes(h).length,1);
 });
});
