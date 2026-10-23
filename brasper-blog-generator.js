/**
 * Brásper HTML formatter, no LLM or third party access. Never publishes content.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=v=>String(v??'').replace(/\r\n?/g,'\n');
const validUrl=raw=>{try{const u=new URL(String(raw||'').trim());const h=u.hostname.toLowerCase();const allowed=h==='brasper.com'||h.endsWith('.brasper.com')||h==='wa.me'||h==='api.whatsapp.com';return u.protocol==='https:'&&!u.username&&!u.password&&allowed?u.href:null}catch{return null}};
const CSS='<style>.bp-blog{font:400 16px/1.75 Arial,Helvetica,sans-serif;color:#263653;max-width:100%;overflow-wrap:anywhere}.bp-blog h1{font-weight:800;font-size:clamp(25px,3vw,34px);line-height:1.24;color:#203c85;margin:0 0 14px}.bp-blog .bp-meta{font-size:13px;color:#667993;margin:0 0 24px}.bp-blog h2{font-weight:800;font-size:21px;line-height:1.35;color:#203c85;border-left:none;padding-left:0;margin:31px 0 15px}.bp-blog h3{color:#314780;font-size:18px;line-height:1.4;margin:23px 0 11px}.bp-blog strong{font-weight:800}.bp-blog p{margin:12px 0}.bp-blog ul{padding-left:23px;margin:14px 0}.bp-blog li{padding:4px 0}.bp-blog li::marker{color:#5140ad}.bp-blog .bp-related{margin:36px 0 0;border-top:1px solid #e1e4ed;padding-top:22px}.bp-blog .bp-related h3{font-size:19px;margin:0 0 12px;color:#203c85}.bp-blog .bp-related li{font-size:16px;line-height:1.52;padding:7px 0}.bp-blog a{color:#203c85;text-decoration:none!important;border-bottom:0!important;transition:color .2s}.bp-blog a:hover,.bp-blog a:focus-visible{color:#5140ad;text-decoration:none!important}.bp-blog .bp-action{text-align:center;margin:35px 0 14px}.bp-blog .bp-cta{display:inline-block;background:#203c85;color:#fff;text-decoration:none;padding:15px 24px;border-radius:26px;font-weight:800;transition:transform .2s,background .2s,box-shadow .2s}.bp-blog .bp-cta:hover,.bp-blog .bp-cta:focus-visible{background:#5140ad;transform:translateY(-3px);box-shadow:0 9px 23px #203c8540}.bp-blog .bp-note{text-align:center;font-style:italic;color:#66718a;font-size:12px;line-height:1.6;margin:12px auto 0}@media(max-width:600px){.bp-blog h2{font-size:19px}.bp-blog .bp-related li{font-size:16px}}@media(prefers-reduced-motion:reduce){.bp-blog .bp-cta{transition:none}.bp-blog .bp-cta:hover{transform:none}}</style>';
// Conservative Markdown subset. User words are never sent to an LLM or executed.
// Only link to Brasper's own relevant pages; external brand and bank names stay plain text.
function autoLinks(text,lang='es'){
 const base='https://brasper.com/'+(lang==='pt'?'br':'es');
 const pix=lang==='pt'
  ?'https://brasper.com/blog/guia-de-remessas-para-o-peru-pague-com-pix-na-plataforma'
  :'https://brasper.com/blog/como-usar-el-sistema-pix-para-enviar-dinero-rapido-a-brasil';
 return esc(text).replace(/\b(?:Brasper|Brásper|PIX)\b/gi,word=>{
  const href=word.toLowerCase()==='pix'?pix:base;
  return '<a href="'+href+'" target="_blank" rel="noopener noreferrer">'+word+'</a>';
 });
}
function inlineHtml(text,lang='es'){
 const s=String(text??'');
 const token=/\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+)\*/g;
 let out='',from=0,m;
 while((m=token.exec(s))){
  out+=autoLinks(s.slice(from,m.index),lang);
  if(m[1]!==undefined){
   const link=validUrl(m[2]);
   out+=link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+esc(m[1])+'</a>':esc(m[1]);
  }else if(m[3]!==undefined||m[4]!==undefined){
   out+='<strong>'+inlineHtml(m[3]??m[4],lang)+'</strong>';
  }else if(m[5]!==undefined){
   out+='<em>'+inlineHtml(m[5],lang)+'</em>';
  }
  from=token.lastIndex;
 }
 return out+autoLinks(s.slice(from),lang);
}

export function articleToHtml(article,options={}){
 const html=[],paragraph=[],list=[];const lang=options.language==='pt'?'pt':'es';
 let listType='',start=1,skippedTitle=false;
 const flushParagraph=()=>{if(paragraph.length){html.push('<p>'+inlineHtml(paragraph.join(' '),lang)+'</p>');paragraph.length=0}};
 const flushList=()=>{if(list.length){
  const tag=listType==='ol'?'ol':'ul';
  const attr=tag==='ol'&&start!==1?' start="'+start+'"':'';
  html.push('<'+tag+attr+'>'+list.map(item=>'<li>'+inlineHtml(item,lang)+'</li>').join('')+'</'+tag+'>');
  list.length=0;listType='';start=1;
 }};
 for(const raw of normal(article).split('\n')){
  const line=raw.trim();
  if(!line){flushParagraph();flushList();continue}
  const heading=/^(#{1,3})\s+(.+)$/.exec(line);
  if(heading){
   flushParagraph();flushList();
   if(heading[1]==='#'){
    const value=heading[2].replace(/^\*\*(.*?)\*\*$/,'$1').trim();
    // If pasted article includes the same H1 as the title input, the site's
    // own title (or optional H1) already renders it. Avoid duplicating it.
    if(!skippedTitle && value.toLocaleLowerCase()===String(options.title||'').trim().toLocaleLowerCase()){
     skippedTitle=true;continue;
    }
   }
   const level=heading[1].length===3?3:2;
   html.push('<h'+level+'>'+inlineHtml(heading[2],lang)+'</h'+level+'>');continue;
  }
  const bullet=/^[-*•]\s+(.+)$/.exec(line),numbered=/^(\d{1,3})\.\s+(.+)$/.exec(line);
  if(bullet||numbered){
   flushParagraph();
   const type=numbered?'ol':'ul';
   if(listType && type!==listType)flushList();
   if(!list.length){listType=type;start=numbered?Number(numbered[1]):1;}
   list.push(bullet?bullet[1]:numbered[2]);continue;
  }
  flushList();paragraph.push(line);
 }
 flushParagraph();flushList();
 return html.join('\n');
}
// Curated live Brasper articles; editors may override with their own seven real links.
const RELATED_CATALOG={
 es:[
  {title:'Cómo usar el sistema PIX para enviar dinero rápido a Brasil',url:'https://brasper.com/blog/como-usar-el-sistema-pix-para-enviar-dinero-rapido-a-brasil'},
  {title:'Tipo de cambio sol a real: envío de remesas',url:'https://brasper.com/es/blog/tipo-de-cambio-sol-a-real-envio-de-remesas-en-abril'},
  {title:'Cómo recargar una cuenta de Mercado Pago Brasil desde Perú',url:'https://brasper.com/es/blog/como-recargar-una-cuenta-de-mercado-pago-brasil-desde-peru'},
 ],
 pt:[
  {title:'Guia de remessas para o Peru: pague com Pix na plataforma',url:'https://brasper.com/blog/guia-de-remessas-para-o-peru-pague-com-pix-na-plataforma'},
  {title:'Cotação de reais para soles: veja o valor para envio',url:'https://brasper.com/blog/cotacao-de-reais-para-soles-veja-o-valor-para-envio'},
  {title:'Diferença entre transferência bancária e plataforma de remessas',url:'https://brasper.com/blog/diferenca-entre-transferencia-bancaria-e-plataforma-de-remessas-qual-escolher'},
  {title:'Melhor cotação de real para sol peruano',url:'https://brasper.com/es/blog/melhor-cotacao-de-real-para-sol-peruano-em-tempo-real'}
 ]
};
const canonicalTitle=v=>String(v||'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const stopWords=new Set('como para desde sobre entre cuando porque guia guia de del los las una unos unas que con por entre este esta estos estas el la lo un o e y a en ao aos as os um uma uma pelo pelos pela pelas do da dos das na no nas nos seu sua seus suas'.split(' '));
function relevance(title,candidate){
 const words=x=>new Set(canonicalTitle(x).split(' ').filter(w=>w.length>2&&!stopWords.has(w)));
 const source=words(title),related=words(candidate);
 let common=0;for(const w of related)if(source.has(w))common++;
 return common;
}
function languageMatches(lang,row){
 const link=String(row.url||'').toLowerCase();
 if(lang==='es'&&link.includes('/br/'))return false;
 if(lang==='pt'&&link.includes('/es/'))return false;
 const t=canonicalTitle(row.title);
 return lang==='es'
  ?!/\b(cotacao|remessas|dinheiro|envio|transferencia bancaria|soles para|voce)\b/.test(t)
  :!/\b(cambio|envios|dinero|peruanos|transferencias internacionales)\b/.test(t);
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
 const customRelated=Array.isArray(input.related)&&input.related.length>0;
 const related=customRelated?input.related:RELATED_CATALOG[lang].filter(row=>languageMatches(lang,row)).sort((a,b)=>relevance(title,b.title)-relevance(title,a.title));
 if(related.length>7)throw Error('Se permiten máximo siete artículos relacionados.');
 const links=[];
 for(const row of related){
  if(!row||typeof row!=='object')throw Error('Enlace relacionado inválido.');
  const name=String(row.title||'').trim(),link=validUrl(row.url);
  if(name.length<2||name.length>220||!link)throw Error('Revisa el título y la URL de los artículos relacionados.');
  if(canonicalTitle(name)===canonicalTitle(title))continue;
  if(!languageMatches(lang,row))continue;
  if(links.some(item=>item.includes('href="'+esc(link)+'"')))continue;
  links.push('<li><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+'</a></li>');
 }
 const pt=lang==='pt';
 const rel=links.length?'<section class="bp-related"><h3>'+(pt?'Artigos relacionados':'Artículos relacionados')+'</h3><ul>'+links.join('')+'</ul></section>':'';
 const headline='<h1>'+esc(title)+'</h1>';
 const dateHtml=input.include_date===true&&date?'<p class="bp-meta">Brasper · '+esc(date)+'</p>':'';
 const callToAction=pt?'Faça sua cotação agora →':'Haz tu envío ahora →';
 const note=pt?'Este conteúdo é informativo. Tarifas, câmbio e prazos podem variar. Confira as condições vigentes antes de enviar.':'Este contenido es informativo. Las tarifas, el tipo de cambio y los plazos pueden variar. Revisa las condiciones vigentes antes de enviar.';
 const body=article.replace(/^\s*([^\n]+)\n?/, (match,line)=>line.replace(/^#{1,3}\s*/,'').replace(/^\*\*(.*?)\*\*$/,'$1').trim().toLocaleLowerCase()===title.toLocaleLowerCase()?'':match);
 // The pasted author/month line is metadata, not part of the introductory paragraph.
 // Normalize Markdown link/emphasis around Brasper and preserve the original month/year.
 const bodyLines=body.split('\n');
 const metaIndex=bodyLines.findIndex((line,i)=>i<4&&/(?:Brasper|Brásper)/i.test(line)&&/(?:\b20\d{2}\b)/.test(line)&&line.length<250);
 let pastedMeta='';
 if(metaIndex!==-1){
  const raw=bodyLines[metaIndex];
  const plain=raw.replace(/&#x20;|&nbsp;/gi,' ').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/[\u002a_#]/g,'').replace(/\s+/g,' ').trim();
  if(/^(?:Brasper|Brásper)\b/i.test(plain)){
   pastedMeta=plain.replace(/^Brásper\b/i,'Brasper').replace(/^Brasper\s*/i,'Brasper · ');
   bodyLines.splice(metaIndex,1);
  }
 }
 const cleanBody=bodyLines.join('\n');
 const metadata=pastedMeta?'<p class="bp-meta">'+esc(pastedMeta)+'</p>':dateHtml;
 return CSS+'\n<article class="bp-blog" lang="'+lang+'">'+headline+metadata+articleToHtml(cleanBody,{title,language:lang})+rel+'<div class="bp-action"><a class="bp-cta" href="https://brasper.com/'+(pt?'br':'es')+'" target="_blank" rel="noopener noreferrer">'+callToAction+'</a></div><p class="bp-note">'+note+'</p></article>';
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
