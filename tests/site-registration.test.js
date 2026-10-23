import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleSiteCreate,validateWebsite } from '../site-registration.js';
const base='https://crm.example.workers.dev';
const business='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const user='11111111-1111-4111-8111-111111111111',siteId='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
const session={user:{id:user,role:'client'},access:'valid-user-jwt',cookies:[]};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const input={business_id:business,name:'Tienda de Ana',url:'https://tienda-ana.example'};
const req=(body=input,{origin=base,type='application/json',method='POST',raw}={})=>new Request(base+'/api/sites/create',{method,headers:{Origin:origin,'Content-Type':type},...(method==='GET'?{}:{body:raw??JSON.stringify(body)})});
async function mock(fn,{access=true,existing=[],persist=true}={}){
 const previous=globalThis.fetch,requests=[];
 globalThis.fetch=async(url,init={})=>{
  const u=String(url),method=init.method||'GET';requests.push({url:u,method,headers:init.headers,body:init.body});
  if(u.includes('/rest/v1/businesses?'))return json(access?[{id:business}]:[]);
  if(u.includes('/rest/v1/sites?'))return json(existing);
  if(u.endsWith('/rest/v1/sites')&&method==='POST')return json(persist?[{id:siteId,...JSON.parse(init.body)}]:[],persist?201:409);
  throw Error('Unexpected request '+u);
 };
 try{await fn(requests);}finally{globalThis.fetch=previous;}
}
test('URL pública normalizada, sin userinfo, fragmentos, protocolos peligrosos ni claves',()=>{
 assert.equal(validateWebsite('https://miempresa.com'),'https://miempresa.com/');
 assert.equal(validateWebsite('ftp://miempresa.com'),null);
 assert.equal(validateWebsite('https://u:p@miempresa.com'),null);
 assert.equal(validateWebsite('https://miempresa.com/#token'),null);
 assert.equal(validateWebsite('http://localhost'),null);
 assert.equal(validateWebsite('https://miempresa.com:1234'),null);
});
test('POST de cliente autorizado crea sitio pero jamás asigna propiedad GA4 recibida del navegador',async()=>{
 await mock(async requests=>{
  const response=await handleSiteCreate(req({...input,ga4_property_id:'123456',id:other}),env,session);
  assert.equal(response.status,201);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  const d=await response.json();
  assert.equal(d.site.business_id,business);
  assert.equal(d.site.ga4_property_id,null);
  const stored=requests.find(x=>x.url.endsWith('/rest/v1/sites')&&x.method==='POST');
  assert.ok(stored);
  assert.equal(JSON.parse(stored.body).ga4_property_id,null);
  assert.equal(JSON.parse(stored.body).business_id,business);
  assert.equal(stored.headers.apikey,'service-test');
  assert.equal(requests[0].headers.Authorization,'Bearer valid-user-jwt');
 });
});
test('no permite crear en otra empresa o con cuenta admin',async()=>{
 await mock(async requests=>{
  assert.equal((await handleSiteCreate(req({...input,business_id:other}),env,session)).status,403);
  assert.equal((await handleSiteCreate(req(input),env,{...session,user:{...session.user,role:'admin'}})).status,403);
  assert.equal(requests.filter(x=>x.url.endsWith('/rest/v1/sites')&&x.method==='POST').length,0);
 });
});
test('deniega cuenta sin pertenencia y no toca almacenamiento privado',async()=>{
 await mock(async requests=>{
  assert.equal((await handleSiteCreate(req(),env,session)).status,403);
  assert.equal(requests.some(x=>x.method==='POST'&&x.url.includes('/sites')),false);
 },{access:false});
});
test('no permite crear duplicados ni registrar más de 10 sitios',async()=>{
 await mock(async()=>{assert.equal((await handleSiteCreate(req(),env,session)).status,409);},
 {existing:[{url:'https://tienda-ana.example/'}]});
 await mock(async()=>{assert.equal((await handleSiteCreate(req(),env,session)).status,409);},
 {existing:Array.from({length:10},(_,i)=>({id:String(i),url:'https://site'+i+'.example/'}))});
});
test('valida método, CSRF, JSON, nombre y URL antes de consultas',async()=>{
 await mock(async requests=>{
  assert.equal((await handleSiteCreate(req(null,{method:'GET'}),env,session)).status,405);
  assert.equal((await handleSiteCreate(req(input,{origin:'https://atacante.com'}),env,session)).status,403);
  assert.equal((await handleSiteCreate(req(input,{type:'text/plain'}),env,session)).status,415);
  assert.equal((await handleSiteCreate(req(null,{raw:'{broken'}),env,session)).status,400);
  assert.equal((await handleSiteCreate(req({...input,url:'javascript:alert(1)'}),env,session)).status,400);
  assert.equal((await handleSiteCreate(req({...input,name:'X'}),env,session)).status,400);
  assert.equal(requests.length,0);
 });
});
test('UI de Mi empresa conserva edición e incorpora alta sin afirmar verificación del dominio',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(worker,/path==='\/api\/sites\/create'\) return handleSiteCreate/);
 assert.match(app,/id="site-create-form"/);
 assert.match(app,/if\(e.target.id==='site-create-form'\)/);
 assert.match(app,/await api\('\/api\/sites\/create'/);
 assert.match(app,/id="site-edit-form"/);
 assert.match(app,/no verificado/i);
});
