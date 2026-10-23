import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateBlogHtml,handleBlogGenerator} from '../brasper-blog-generator.js';
const base='https://crm.example.workers.dev',business='f2063748-9dff-4250-b4d7-f2aa01108506',other='00000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon-test'};
const session={user:{role:'client',id:'11111111-1111-4111-8111-111111111111'},access:'user-jwt',cookies:[]};
const valid={business_id:business,language:'es',title:'Cómo enviar dinero',article:'## Recomendaciones\n\nAhorra <tiempo> y revisa condiciones.\n\n- Primer paso\n- Segundo paso',related:[{title:'Envíos Perú Brasil',url:'https://brasper.com/blog/peru-brasil'}],include_title:false,include_date:false};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
const req=(body=valid,extra={})=>new Request(base+'/api/brasper/blog/generate',{method:extra.method||'POST',headers:{'Content-Type':extra.type||'application/json',Origin:extra.origin||base},body:extra.raw??JSON.stringify(body)});
async function simulated(fn,visible=true){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options={})=>{
  calls.push({url:String(url),headers:options.headers});
  if(String(url).includes('businesses?'))return json(visible?[{id:business,slug:'brasper'}]:[]);
  throw Error('unexpected request');
 };
 try{await fn(calls)}finally{globalThis.fetch=original;}
}
test('genera cuerpo ES con formato corporativo sin duplicar H1 ni fecha',()=>{
 const html=generateBlogHtml(valid);
 assert.match(html,/class="bp-blog" lang="es"/);
 assert.match(html,/<h2>Recomendaciones<\/h2>/);
 assert.match(html,/Ahorra &lt;tiempo&gt; y revisa condiciones\./);
 assert.match(html,/<li>Primer paso<\/li>/);
 assert.doesNotMatch(html,/<h1>/);
 assert.doesNotMatch(html,/bp-meta/);
 assert.match(html,/Haz tu envío ahora/);
 assert.match(html,/https:\/\/brasper\.com/);
});
test('genera portugués y opt-in para título/fecha, con hasta siete relacionados',()=>{
 const html=generateBlogHtml({...valid,language:'pt',date:'2026-10',include_title:true,include_date:true,related:Array.from({length:7},(_,i)=>({title:'Artigo '+i,url:'https://brasper.com/a-'+i}))});
 assert.match(html,/lang="pt"/);assert.match(html,/<h1>Cómo enviar dinero<\/h1>/);
 assert.match(html,/2026-10/);assert.match(html,/Artigos relacionados/);
 assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,8);
 assert.match(html,/Faça seu envio agora/);
});
test('rechaza javascript URL, atributos HTML y más de siete relacionados',()=>{
 assert.throws(()=>generateBlogHtml({...valid,related:[{title:'Peligro',url:'javascript:alert(1)'}]}),/URL/);
 assert.throws(()=>generateBlogHtml({...valid,related:Array.from({length:8},()=>valid.related[0])}),/siete/i);
 const html=generateBlogHtml({...valid,title:'"><script>alert(1)</script>',article:'## <img src=x onerror=alert(1)>\n\n<script>danger</script>',include_title:true,related:[{title:'<svg onload=alert(1)>',url:'https://example.com/?a=1&b=2'}]});
 assert.doesNotMatch(html,/<script>danger<\/script>/);
 assert.match(html,/&lt;script&gt;danger&lt;\/script&gt;/);
 assert.match(html,/&lt;svg onload/);
 assert.match(html,/a=1&amp;b=2/);
});
test('acceso de cliente Brásper validado por RLS antes de generar',async()=>{
 await simulated(async calls=>{
  const r=await handleBlogGenerator(req(),env,session);
  assert.equal(r.status,200);
  const answer=await r.json();assert.equal(answer.ok,true);
  assert.match(answer.html,/Recomendaciones/);
  assert.equal(calls[0].headers.Authorization,'Bearer user-jwt');
 });
});
test('clientes de otros negocios, incluso con UUID de Brásper, reciben 403',async()=>{
 await simulated(async()=>{
  const r=await handleBlogGenerator(req(),env,session);assert.equal(r.status,403);
 },false);
 await simulated(async()=>{
  const r=await handleBlogGenerator(req({...valid,business_id:other}),env,session);assert.equal(r.status,403);
 },false);
});
test('métodos, origen y contenido inválido rechazados',async()=>{
 await simulated(async calls=>{
  assert.equal((await handleBlogGenerator(new Request(base+'/api/brasper/blog/generate',{method:'GET'}),env,session)).status,405);
  assert.equal((await handleBlogGenerator(req(valid,{origin:'https://evil.example'}),env,session)).status,403);
  assert.equal((await handleBlogGenerator(req(valid,{type:'text/plain'}),env,session)).status,415);
  assert.equal((await handleBlogGenerator(req(valid,{raw:'{bad'}),env,session)).status,400);
  assert.equal(calls.length,0);
 });
});
test('módulo Blog está presente en sidebar Brásper, separado de otras empresas',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const view=readFileSync(new URL('../public/brasper-blog.js',import.meta.url),'utf8');
 assert.match(app,/blog: \['Blog'/);
 assert.match(app,/navLink\('blog'\)\+navLink\('mailing'\)/);
 assert.match(app,/state\.page==='blog'&&!isAdmin/);
 assert.match(app,/edwinBrasperBlog\?\.page/);
 assert.match(worker,/path === '\/api\/brasper\/blog\/generate'/);
 assert.match(index,/brasper-blog\.js/);assert.match(index,/brasper-blog\.css/);
 assert.match(view,/iframe id="bp-blog-preview"/);
 assert.match(view,/sandbox=""/);
 assert.match(view,/data-bp-action="copy"/);
 assert.match(view,/data-bp-action="download"/);
 assert.doesNotMatch(view,/openai\.com|anthropic\.com|api\.openai/);
});
