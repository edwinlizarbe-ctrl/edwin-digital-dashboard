import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {adminBlogEditorStatus} from '../admin-invites.js';
const origin='https://crm.example.workers.dev',business='f2063748-9dff-4250-b4d7-f2aa01108506',user='11111111-1111-4111-8111-111111111111';
const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-test-key'};
const admin={user:{role:'admin'},cookies:[]};
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const get=()=>new Request(origin+'/api/admin/blog-editor/status');
function mock({profiles=[{id:user,role:'blog_editor'}],members=[{business_id:business}],fail=false}={}){
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init={})=>{
  url=String(url);calls.push({url,method:init.method||'GET'});
  if(fail)return response({error:'down'},500);
  if(url.includes('businesses?'))return response([{id:business,slug:'brasper'}]);
  if(url.includes('profiles?'))return response(profiles);
  if(url.includes('business_members?'))return response(members);
  throw Error('Unexpected endpoint '+url);
 };
 return {calls,restore:()=>{globalThis.fetch=old}};
}
async function status(options,session=admin,request=get()){
 const m=mock(options);
 try{const r=await adminBlogEditorStatus(request,env,session);return {r,calls:m.calls,body:await r.json()}}
 finally{m.restore()}
}
test('status: blog_editor + one Brásper membership is active',async()=>{
 const {r,body,calls}=await status();
 assert.equal(r.status,200);assert.deepEqual(body,{ok:true,state:'active'});
 assert(calls.every(c=>c.method==='GET'),'read-only');
});
test('status: no profile offers the invitation',async()=>{
 const {body,calls}=await status({profiles:[]});
 assert.equal(body.state,'invite');assert(!calls.some(c=>c.url.includes('business_members')));
});
test('status: wrong role or suspicious memberships require review',async()=>{
 assert.equal((await status({profiles:[{id:user,role:'client'}]})).body.state,'review');
 assert.equal((await status({members:[]})).body.state,'review');
 assert.equal((await status({members:[{business_id:business},{business_id:'x'}]})).body.state,'review');
 assert.equal((await status({members:[{business_id:'22222222-2222-4222-8222-222222222222'}]})).body.state,'review');
 assert.equal((await status({profiles:[{id:user,role:'blog_editor'},{id:user,role:'blog_editor'}]})).body.state,'review');
});
test('status: backend failure fails closed with no state and no leaked data',async()=>{
 const {r,body}=await status({fail:true});
 assert.equal(r.status,502);assert.equal(body.state,undefined);
 const text=JSON.stringify(body);
 assert(!text.includes(user)&&!text.includes('private-test-key')&&!text.includes('marketing.brasper'));
});
test('status: success body never exposes ids, email or keys',async()=>{
 const {body}=await status();
 const text=JSON.stringify(body);
 assert(!text.includes(user)&&!text.includes(business)&&!text.includes('@')&&!text.includes('private-test-key'));
});
test('status: non-admin gets 403 without touching the backend; wrong method 405; missing key 503',async()=>{
 for(const role of ['client','blog_editor']){
  const {r,calls}=await status({},{user:{role},cookies:[]});
  assert.equal(r.status,403);assert.equal(calls.length,0);
 }
 assert.equal((await status({},admin,new Request(origin+'/api/admin/blog-editor/status',{method:'POST'}))).r.status,405);
 const r=await adminBlogEditorStatus(get(),{SUPABASE_URL:env.SUPABASE_URL},admin);assert.equal(r.status,503);
});
test('worker routes status to admin handler and blocks blog_editor from it',()=>{
 const w=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const editorBlock=w.indexOf("s.user.role==='blog_editor'"),route=w.indexOf("'/api/admin/blog-editor/status'");
 assert(route>editorBlock,'status route is after the blog_editor fail-closed block');
 assert(!w.slice(editorBlock,route).includes('blog-editor/status'));
});
// ---- front-end (no DOM: tiny stub, evaluated in a vm) ----
function load(){
 const nodes={};
 const sandbox={window:{},document:{addEventListener(){},getElementById:id=>nodes[id]||null,querySelectorAll:()=>[]},setTimeout:()=>0,fetch:async()=>{throw Error('offline')},FormData};
 sandbox.globalThis=sandbox;
 vm.runInNewContext(readFileSync(new URL('../public/brasper-blog.js',import.meta.url),'utf8'),sandbox);
 return {blog:sandbox.window.edwinBrasperBlog,nodes,sandbox};
}
test('editorial stats are computed from the pasted article only',()=>{
 const {blog}=load();
 const article='# Título del blog\n\nPrimer párrafo con [enlace](https://brasper.com/es) y **texto**.\n\n## Uno\n\nMás texto aquí.\n\n### Dos\n\n- punto';
 const s=blog.stats(article,'auto','Artículo | https://brasper.com/es/blog/a\nmal formado');
 assert.equal(s.subtitles,2);assert.equal(s.related,1);assert.equal(s.inlineLinks,1);
 assert.equal(s.hasTitle,true);assert.equal(s.language,'es');assert.equal(s.languageSource,'detected');
 assert.equal(s.words,15);
 assert.equal(blog.stats('# T\n\nVocê pode enviar dinheiro para o Brasil.','auto','').language,'pt');
 assert.equal(blog.stats('Hola mundo','pt','').languageSource,'selected');
 assert.equal(blog.stats('Hola mundo','pt','').language,'pt');
 assert.equal(blog.stats('','auto','').words,0);
});
test('page renders desktop/mobile controls, sandboxed preview and keeps statuses honest',()=>{
 const {blog}=load();
 const html=blog.page(business,true);
 assert(html.includes('Estudio editorial Brásper'));
 assert(html.includes('data-bp-device="desktop" aria-pressed="true"')&&html.includes('data-bp-device="mobile" aria-pressed="false"'));
 assert(html.includes('sandbox=""'));
 assert(!html.includes('id="bp-invite-ana"'),'no invite button before the server confirms there is no profile');
 assert(!/OpenAI|Anthropic|api\.openai/i.test(readFileSync(new URL('../public/brasper-blog.js',import.meta.url),'utf8')));
 assert(!blog.page(business,false).includes('bp-editor-access'));
});
test('access markup: three genuine states, invite only when no profile, fail closed otherwise',()=>{
 const {blog}=load();
 assert(blog.accessMarkup('active').includes('Acceso editorial activo')&&!blog.accessMarkup('active').includes('Invitar a Ana'));
 assert(blog.accessMarkup('invite').includes('id="bp-invite-ana"'));
 assert(blog.accessMarkup('review').includes('Revisar permisos')&&!blog.accessMarkup('review').includes('bp-invite-ana'));
 assert(!blog.accessMarkup('error').includes('bp-invite-ana'));
 assert(!blog.accessMarkup('anything-else').includes('bp-invite-ana'));
});
test('loadAccess renders server state and fails closed on errors',async()=>{
 for(const [reply,expected] of [[{ok:true,state:'active'},'Acceso editorial activo'],[{ok:true,state:'invite'},'Invitar a Ana'],[{ok:true,state:'review'},'Revisar permisos'],[null,'Sin verificar']]){
  const {blog,nodes,sandbox}=load();
  nodes['bp-editor-access']={innerHTML:''};
  sandbox.fetch=async()=>{if(!reply)throw Error('x');return {ok:true,json:async()=>reply}};
  blog.page(business,true);
  await blog.loadAccess();
  assert(nodes['bp-editor-access'].innerHTML.includes(expected),expected);
 }
 const {blog,nodes,sandbox}=load();nodes['bp-editor-access']={innerHTML:''};
 sandbox.fetch=async()=>({ok:false,json:async()=>({error:'x'})});blog.page(business,true);await blog.loadAccess();
 assert(!nodes['bp-editor-access'].innerHTML.includes('bp-invite-ana'));
});
test('asset query strings were bumped for Blog CSS and JS',()=>{
 const h=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert(h.includes('brasper-blog.css?v=20261029-studio')&&h.includes('brasper-blog.js?v=20261029-studio'));
});
