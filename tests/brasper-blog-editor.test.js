import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleBlogAccess,handleBlogGenerator} from '../brasper-blog-generator.js';
const origin='https://crm.example.workers.dev', business='f2063748-9dff-4250-b4d7-f2aa01108506';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public'};
const editor={user:{id:'11111111-1111-4111-8111-111111111111',role:'blog_editor',email:'marketing.brasper@gmail.com'},access:'editor-jwt',cookies:[]};
const response=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
function mock(overrides={}){
 const calls=[],old=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),auth:options?.headers?.Authorization});
  if(String(url).includes('business_members?'))return response(overrides.members??[{business_id:business}]);
  if(String(url).includes('businesses?'))return response(overrides.businesses??[{id:business,slug:'brasper'}]);
  throw Error('Unexpected network call');
 };
 return {calls,restore:()=>globalThis.fetch=old};
}
test('limited Blog access requires unique Brásper membership, verified with own JWT',async()=>{
 const m=mock();
 try{
  const r=await handleBlogAccess(new Request(origin+'/api/brasper/blog/access'),env,editor);
  assert.equal(r.status,200);assert.equal((await r.json()).business_id,business);
  assert.equal(m.calls.length,2);
  assert(m.calls.every(x=>x.auth==='Bearer editor-jwt'));
 }finally{m.restore()}
});
test('limited Blog rejects missing, multiple or wrong-company memberships',async()=>{
 for(const option of [{members:[]},{members:[{business_id:business},{business_id:business}]},{businesses:[{id:business,slug:'other'}]}]){
  const m=mock(option);
  try{assert.equal((await handleBlogAccess(new Request(origin+'/api/brasper/blog/access'),env,editor)).status,403)}
  finally{m.restore()}
 }
});
test('editor HTML generation cannot switch businesses',async()=>{
 const m=mock();
 const request=businessId=>new Request(origin+'/api/brasper/blog/generate',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({business_id:businessId,title:'Título real',article:'## Subtítulo\n\nTexto original',language:'es'})
 });
 try{
  assert.equal((await handleBlogGenerator(request(business),env,editor)).status,200);
  assert.equal((await handleBlogGenerator(request('00000000-0000-4000-8000-000000000002'),env,editor)).status,403);
 }finally{m.restore()}
});
test('source gate denies ALL non-Blog APIs for restricted users before other handlers',()=>{
 const w=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const a=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const invite=readFileSync(new URL('../admin-invites.js',import.meta.url),'utf8');
 assert.match(w,/if\(s\.user\.role==='blog_editor'\)/);
 assert(w.indexOf("if(s.user.role==='blog_editor')")<w.indexOf("if(path==='/api/admin/accounts/suspension')"));
 assert.match(w,/Este perfil solo puede utilizar Blog de Brásper/);
 assert.match(a,/Do not fetch businesses, analytics, leads, sites or integrations/);
 assert.match(a,/bp-editor-layout/);
 assert.match(invite,/adminInviteBlogEditor/);
 assert.match(invite,/role:'blog_editor'/);
});
