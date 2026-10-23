/**
 * Brásper HTML formatter, no LLM or third party access. Never publishes content.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=v=>String(v??'').replace(/\r\n?/g,'\n');
const validUrl=raw=>{try{const u=new URL(String(raw||'').trim());return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
const CSS='<style>.bp-blog{font:400 16px/1.75 Arial,Helvetica,sans-serif;color:#263653;max-width:100%;overflow-wrap:anywhere}.bp-blog h1{font-weight:800;font-size:clamp(25px,3vw,34px);line-height:1.24;color:#203c85;margin:0 0 14px}.bp-blog .bp-meta{font-size:13px;color:#667993;margin:0 0 24px}.bp-blog h2{font-weight:800;font-size:21px;line-height:1.35;color:#203c85;border-left:4px solid #5140ad;padding-left:14px;margin:31px 0 15px}.bp-blog p{margin:12px 0}.bp-blog ul{padding-left:23px;margin:14px 0}.bp-blog li{padding:4px 0}.bp-blog li::marker{color:#5140ad}.bp-blog .bp-related{margin:36px 0 0;border-top:1px solid #e1e4ed;padding-top:22px}.bp-blog .bp-related h3{font-size:19px;margin:0 0 12px;color:#203c85}.bp-blog .bp-related li{font-size:15px;line-height:1.48;padding:7px 0}.bp-blog a{color:#203c85;text-decoration:underline;text-underline-offset:3px}.bp-blog .bp-action{text-align:center;margin:35px 0 14px}.bp-blog .bp-cta{display:inline-block;background:#203c85;color:#fff;text-decoration:none;padding:15px 24px;border-radius:26px;font-weight:800;transition:transform .2s,background .2s,box-shadow .2s}.bp-blog .bp-cta:hover,.bp-blog .bp-cta:focus-visible{background:#5140ad;transform:translateY(-3px);box-shadow:0 9px 23px #203c8540}.bp-blog .bp-note{text-align:center;font-style:italic;color:#66718a;font-size:12px;line-height:1.6;margin:12px auto 0}@media(max-width:600px){.bp-blog h2{font-size:19px}.bp-blog .bp-related li{font-size:15px}}@media(prefers-reduced-motion:reduce){.bp-blog .bp-cta{transition:none}.bp-blog .bp-cta:hover{transform:none}}</style>';
export function articleToHtml(article){
 let html=[],list=[];
 const flush=()=>{if(list.length){html.push('<ul>'+list.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>');list=[]}};
 for(const line of normal(article).split('\n')){
  const value=line.trim();if(!value){flush();continue}
  if(value.startsWith('## ')){flush();html.push('<h2>'+esc(value.slice(3))+'</h2>')}
  else if(/^[-•] /.test(value)){list.push(value.slice(2))}
  else{flush();html.push('<p>'+esc(value)+'</p>')}
 }
 flush();return html.join('\n');
}
export function generateBlogHtml(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Completa el artículo.');
 const lang=input.language==='pt'?'pt':input.language==='es'?'es':null;
 if(!lang)throw Error('Selecciona español o portugués.');
 const title=normal(input.title).trim(),article=normal(input.article);
 if(title.length<2||title.length>200)throw Error('El título debe tener entre 2 y 200 caracteres.');
 if(!article.trim()||article.length>60000)throw Error('El artículo debe tener texto y como máximo 60 000 caracteres.');
 const date=String(input.date||'').trim();
 if(date&&!/^\d{4}-\d{2}$/.test(date))throw Error('La fecha no tiene un formato válido.');
 const related=Array.isArray(input.related)?input.related:[];
 if(related.length>7)throw Error('Se permiten máximo siete artículos relacionados.');
 const links=[];
 for(const row of related){
  if(!row||typeof row!=='object')throw Error('Enlace relacionado inválido.');
  const name=String(row.title||'').trim(),link=validUrl(row.url);
  if(name.length<2||name.length>220||!link)throw Error('Revisa el título y la URL de los artículos relacionados.');
  links.push('<li><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+'</a></li>');
 }
 const pt=lang==='pt';
 const rel=links.length?'<section class="bp-related"><h3>'+(pt?'Artigos relacionados':'Artículos relacionados')+'</h3><ul>'+links.join('')+'</ul></section>':'';
 const headline=input.include_title===true?'<h1>'+esc(title)+'</h1>':'';
 const dateHtml=input.include_date===true&&date?'<p class="bp-meta">Brásper · '+esc(date)+'</p>':'';
 const callToAction=pt?'Faça seu envio agora →':'Haz tu envío ahora →';
 const note=pt?'Este conteúdo é informativo. Tarifas, câmbio e prazos podem variar. Confira as condições vigentes antes de enviar.':'Este contenido es informativo. Las tarifas, el tipo de cambio y los plazos pueden variar. Revisa las condiciones vigentes antes de enviar.';
 return CSS+'\n<article class="bp-blog" lang="'+lang+'">'+headline+dateHtml+articleToHtml(article)+rel+'<div class="bp-action"><a class="bp-cta" href="https://brasper.com/" target="_blank" rel="noopener noreferrer">'+callToAction+'</a></div><p class="bp-note">'+note+'</p></article>';
}

/** Resolve access with the caller JWT + RLS, never with an admin token. */
async function blogEditorBusinessId(env,s){
 if(s.user.role!=='blog_editor'||String(s.user.email||'').toLowerCase()!=='marketing.brasper@gmail.com')return null;
 const root=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const headers={apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access,Accept:'application/json'};
 const members=await fetch(root+'/rest/v1/business_members?select=business_id&user_id=eq.'+encodeURIComponent(s.user.id)+'&limit=2',{headers});
 if(!members.ok)throw Error('No se pudo validar la membresía editorial.');
 const list=await members.json();
 if(!Array.isArray(list)||list.length!==1||!UUID.test(String(list[0]?.business_id||'')))return null;
 const businesses=await fetch(root+'/rest/v1/businesses?select=id,slug&id=eq.'+encodeURIComponent(list[0].business_id)+'&limit=1',{headers});
 if(!businesses.ok)throw Error('No se pudo validar Brásper.');
 const rows=await businesses.json();
 if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==list[0].business_id||rows[0].slug!=='brasper')return null;
 return rows[0].id;
}
export async function handleBlogAccess(req,env,s){
 const output=(data,status)=>reply(data,status,s.cookies||[]);
 if(req.method!=='GET')return output({error:'Método no permitido.'},405);
 try{
  const id=await blogEditorBusinessId(env,s);
  return id?output({ok:true,business_id:id},200):output({error:'Sin acceso editorial a Brásper.'},403);
 }catch{return output({error:'No se pudo verificar el acceso editorial.'},502)}
}

function reply(body,status=200,cookies=[]){
 const h=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 cookies.forEach(x=>h.append('Set-Cookie',x));
 return new Response(JSON.stringify(body),{status,headers:h});
}
export async function handleBlogGenerator(req,env,s){
 const output=(data,status)=>reply(data,status,s.cookies||[]);
 if(req.method!=='POST')return output({error:'Método no permitido.'},405);
 if(req.headers.get('Origin')!==new URL(req.url).origin)return output({error:'Origen no autorizado.'},403);
 if(!(req.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))return output({error:'Se requiere JSON.'},415);
 if(Number(req.headers.get('Content-Length')||0)>110000)return output({error:'Solicitud demasiado grande.'},413);
 const raw=await req.text();
 if(raw.length>110000)return output({error:'Solicitud demasiado grande.'},413);
 let data;try{data=JSON.parse(raw)}catch{return output({error:'JSON inválido.'},400)}
 const businessId=String(data?.business_id||'');
 if(!UUID.test(businessId))return output({error:'Empresa inválida.'},403);
 let businesses;
 try{
  const root=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  const r=await fetch(root+'/rest/v1/businesses?select=id,slug&id=eq.'+encodeURIComponent(businessId)+'&limit=1',{
    headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:'Bearer '+s.access,Accept:'application/json'}
  });
  if(!r.ok)return output({error:'No se pudo verificar la empresa.'},502);
  businesses=await r.json();
 }catch{return output({error:'No se pudo verificar la empresa.'},502)}
 if(!Array.isArray(businesses)||businesses.length!==1||businesses[0].id!==businessId||businesses[0].slug!=='brasper')
  return output({error:'El generador Blog es exclusivo de Brásper.'},403);
 if(!['admin','client','blog_editor'].includes(s.user.role))return output({error:'Acceso no autorizado.'},403);
 if(s.user.role==='blog_editor'){
  let allowed;try{allowed=await blogEditorBusinessId(env,s)}
  catch{return output({error:'No se pudo comprobar la membresía editorial.'},502)}
  if(allowed!==businessId)return output({error:'Acceso editorial denegado.'},403);
 }
 try{return output({ok:true,html:generateBlogHtml(data)},200)}
 catch(e){return output({error:e.message||'No se pudo generar el HTML.'},400)}
}
