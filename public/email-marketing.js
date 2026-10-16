/* Brásper Email Marketing — bounded visual block editor, CSV opt-in, media and test-only sends.
   Bundled by Edwin CRM; no third-party JS, no bulk-send action. */
(()=>{
'use strict';
const htmlEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultBlocks=(lang='es')=>lang==='pt'?[
 {type:'heading',text:'Olá, {{nombre}}! 🇧🇷🇵🇪'},
 {type:'text',text:'Novidades da brasper: transferências entre o Brasil e o Peru com atendimento humano.'},
 {type:'button',text:'Conheça a brasper',url:'https://brasper.com'}
]:[
 {type:'heading',text:'¡Hola, {{nombre}}! 🇵🇪🇧🇷'},
 {type:'text',text:'Te compartimos las novedades de brasper, tu conexión entre Perú y Brasil.'},
 {type:'button',text:'Conoce brasper',url:'https://brasper.com'}
];
const fresh=()=>({title:'Newsletter brasper',subject:'Novedades de brasper para {{nombre}}',preheader:'Perú y Brasil más cerca',language:'es',blocks:defaultBlocks()});
const st={businessId:'',loaded:false,busy:false,error:'',notice:'',campaigns:[],contacts:[],assets:[],configured:false,screen:'list',draft:fresh(),mobile:false,importSummary:'',template:defaultBlocks()};
const base=()=>'/api/email-marketing?business_id='+encodeURIComponent(st.businessId);
async function api(method='GET',body){
 const r=await fetch(base(),{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},
 ...(body?{body:JSON.stringify(body)}:{})});
 const json=await r.json().catch(()=>({error:'Respuesta inesperada'}));
 if(!r.ok)throw Error(json.error||'No se pudo completar la acción.');
 return json;
}
function message(t,style='info'){return '<div class="em-notice em-'+style+'" role="status">'+htmlEscape(t)+'</div>';}
function opts(values,current){return values.map(([k,v])=>'<option value="'+k+'" '+(k===current?'selected':'')+'>'+htmlEscape(v)+'</option>').join('');}
function previewHtml(d){
 const replace=v=>String(v||'').replace(/\{\{\s*nombre\s*\}\}/gi,'Camila').replace(/\{\{\s*empresa\s*\}\}/gi,'Brásper');
 const secureUrl=v=>{try{let u=new URL(v);return u.protocol==='https:'?u.toString():''}catch{return ''}};
 const blocks=d.blocks.map(b=>{
  if(b.type==='heading')return '<h2 style="color:#172f50;font-size:25px;line-height:1.25">'+htmlEscape(replace(b.text))+'</h2>';
  if(b.type==='text')return '<p style="font-size:16px;line-height:1.7;white-space:pre-line;color:#364e69">'+htmlEscape(replace(b.text))+'</p>';
  if(b.type==='image')return '<img alt="'+htmlEscape(b.alt)+'" style="max-width:100%;width:100%;border-radius:12px" src="'+htmlEscape(secureUrl(b.url))+'">';
  if(b.type==='button')return '<p style="text-align:center"><a style="display:inline-block;padding:14px 22px;background:#1366F8;color:white;border-radius:10px;text-decoration:none" href="'+htmlEscape(secureUrl(b.url))+'">'+htmlEscape(replace(b.text))+'</a></p>';
  return '';
 }).join('');
 return '<!doctype html><html lang="es"><meta charset="utf-8"><body style="margin:0;padding:15px;background:#f3f7fd;font-family:Arial"><main style="max-width:600px;margin:auto;background:#fff;border:1px solid #dae5f3;border-radius:16px;overflow:hidden"><header style="padding:26px;background:#1366F8;color:white;font-size:28px;font-weight:bold">brasper</header><div style="padding:22px">'+blocks+'</div><footer style="padding:18px;background:#f7faff;color:#718096;font-size:12px">Vista de prueba · Sin envío masivo habilitado</footer></main></body></html>';
}
function blockRow(b,i){
 const textFields=b.type==='heading'||b.type==='text'?'<label>Texto<textarea class="simple-input em-block-text" data-index="'+i+'" data-field="text" maxlength="'+(b.type==='heading'?140:2000)+'" rows="'+(b.type==='text'?4:2)+'">'+htmlEscape(b.text||'')+'</textarea></label>':'';
 const mediaFields=b.type==='image'?'<label>URL HTTPS de imagen<input class="simple-input em-block-text" data-index="'+i+'" data-field="url" value="'+htmlEscape(b.url||'')+'" placeholder="https://..."></label><label>Texto alternativo<input class="simple-input em-block-text" data-index="'+i+'" data-field="alt" maxlength="140" value="'+htmlEscape(b.alt||'')+'"></label>':'';
 const btnFields=b.type==='button'?'<label>Texto del botón<input class="simple-input em-block-text" data-index="'+i+'" data-field="text" maxlength="100" value="'+htmlEscape(b.text||'')+'"></label><label>Enlace HTTPS<input class="simple-input em-block-text" data-index="'+i+'" data-field="url" value="'+htmlEscape(b.url||'')+'"></label>':'';
 return '<article class="em-block" draggable="true" data-block="'+i+'"><div class="em-block-heading"><span>⋮⋮ '+({heading:'Título',text:'Párrafo',image:'Imagen',button:'Botón'}[b.type])+'</span><div><button type="button" data-em="block-up" data-i="'+i+'" title="Mover arriba">↑</button><button type="button" data-em="block-down" data-i="'+i+'" title="Mover abajo">↓</button><button type="button" data-em="block-delete" data-i="'+i+'" title="Eliminar">×</button></div></div><div class="em-block-fields">'+textFields+mediaFields+btnFields+'</div></article>';
}
function editor(){
 const d=st.draft;
 return '<div class="em-editor-head"><button class="button button-outline" data-em="back">← Campañas</button><div><h2>Editor de newsletter</h2><p>Arrastra los bloques para reorganizar, o usa las flechas.</p></div></div>'+
 '<div class="em-editor-grid"><section class="em-compose"><div class="em-card"><div class="em-fields">'+
 '<label>Nombre de campaña<input class="simple-input" id="em-title" maxlength="120" value="'+htmlEscape(d.title)+'"></label>'+
 '<label>Asunto del correo<input class="simple-input" id="em-subject" maxlength="150" value="'+htmlEscape(d.subject)+'"></label>'+
 '<label>Texto de vista previa<input class="simple-input" id="em-preheader" maxlength="180" value="'+htmlEscape(d.preheader)+'"></label>'+
 '<label>Idioma<select id="em-language" class="simple-input">'+opts([['es','Español'],['pt','Português (Brasil)']],d.language)+'</select></label></div>'+
 '<div class="em-block-header"><h3>Contenido del mensaje</h3><span>Usa {{nombre}} para personalizar el saludo</span></div>'+
 '<div class="em-blocks">'+d.blocks.map(blockRow).join('')+'</div><div class="em-add-blocks">'+[['heading','Título'],['text','Texto'],['image','Imagen'],['button','Botón']].map(([k,v])=>'<button type="button" class="button button-outline" data-em="block-add" data-type="'+k+'">+ '+v+'</button>').join('')+'</div></div>'+
 '<div class="em-card"><h3>Envío seguro de prueba</h3><p>El sistema permite un único destinatario autorizado por prueba, no una campaña masiva.</p>'+
 '<label>Correo de prueba<input id="em-test-to" class="simple-input" type="email" placeholder="correo-autorizado@empresa.com"></label>'+
 '<div class="em-editor-actions"><button class="button button-primary" data-em="save" '+(st.busy?'disabled':'')+'>Guardar borrador</button><button class="button button-outline" data-em="test" '+(st.busy?'disabled':'')+'>Enviar prueba</button></div></div></section>'+
 '<section class="em-card em-preview"><div class="em-preview-top"><b>Vista previa</b><button class="button button-outline" data-em="viewport">'+(st.mobile?'Vista computadora':'Vista celular')+'</button></div><iframe title="Vista previa de newsletter" sandbox="" class="'+(st.mobile?'em-phone':'')+'" srcdoc="'+htmlEscape(previewHtml(d))+'"></iframe><p>Ejemplo de saludo: Camila. Los datos reales se sustituyen cuando se habiliten envíos autorizados.</p></section></div>';
}
function campaigns(){
 return '<div class="em-dashboard-grid"><section class="em-card"><h2>Campañas</h2><p>Crea newsletters en español y portugués. No se enviarán campañas reales.</p><button class="button button-primary" data-em="new">+ Crear newsletter</button>'+
 (st.campaigns.length?'<div class="em-campaign-list">'+st.campaigns.map(c=>'<div class="em-list-entry"><div><strong>'+htmlEscape(c.title)+'</strong><span>'+htmlEscape(c.subject)+' · '+(c.language==='pt'?'Português':'Español')+' · Borrador</span></div><div><button class="button button-outline" data-em="edit" data-id="'+c.id+'">Editar</button><button class="button button-outline" data-em="duplicate" data-id="'+c.id+'">Duplicar</button></div></div>').join('')+'</div>':'<p class="em-empty">Aún no tienes campañas. Crea tu primer newsletter de brasper.</p>')+'</section>'+
 '<section class="em-card"><h2>Contactos autorizados</h2><p>Importa CSV con columnas <code>nombre,email,idioma,empresa,consentimiento</code>. El consentimiento debe decir «sí», «true» o «1». Un contacto dado de baja no se reactiva al importar otra vez.</p><input id="em-csv" aria-label="Subir CSV" type="file" accept=".csv,text/csv"><p class="em-fine">Solo contactos con permiso explícito. No se enviarán correos automáticamente. Máximo 300 contactos por lote.</p>'+
 '<div class="em-contact-count"><b>'+st.contacts.filter(c=>!c.unsubscribed_at).length+'</b> contactos autorizados · <b>'+st.contacts.filter(c=>c.unsubscribed_at).length+'</b> bajas</div>'+
 (st.contacts.length?'<div class="em-contacts"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Estado</th></tr></thead><tbody>'+st.contacts.slice(0,60).map(c=>'<tr><td>'+htmlEscape(c.name)+'</td><td>'+htmlEscape(c.email)+'</td><td>'+(c.unsubscribed_at?'Baja':'Autorizado'+(c.language==='pt'?' · PT':''))+'</td></tr>').join('')+'</tbody></table></div>':'<p class="em-empty">Todavía no has importado contactos.</p>')+'</section></div>'+
 '<section class="em-card em-library"><div><h2>Biblioteca multimedia</h2><p>Guarda banners y fotografías para reutilizarlos en tus newsletters. Los recursos publicados serán accesibles públicamente por URL.</p></div><label class="button button-outline em-upload">+ Subir imagen<input id="em-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><div class="em-images">'+st.assets.map(x=>'<button type="button" data-em="copy-image" data-url="'+htmlEscape(x.url)+'" title="Copiar URL de imagen"><img src="'+htmlEscape(x.url)+'" alt="Recurso de brasper" loading="lazy"></button>').join('')+'</div></section>';
}
function markup(){
 return '<div id="em-root" class="em-screen"><div class="page-title"><div><div class="eyebrow">MARKETING Y COMUNICACIÓN</div><h1>Email Marketing · brasper</h1><p>Diseña newsletters personalizados y organiza contactos autorizados.</p></div></div>'+
 '<div class="em-status"><span>Primera versión · Solo brasper</span><span>No hay envíos masivos habilitados</span></div>'+
 (st.error?message(st.error,'error'):'')+(st.notice?message(st.notice):'')+
 (st.busy?'<p class="em-busy" role="status">Procesando…</p>':'')+
 (st.loaded?(st.screen==='editor'?editor():campaigns()):'<div class="em-card"><h2>Configuración inicial</h2><p>El módulo se ha preparado para brasper y solo se habilita cuando se vincula su empresa mediante <code>BRASPER_BUSINESS_ID</code> en Cloudflare. Las cuentas de otras empresas no pueden ver ni enviar su información.</p></div>')+'</div>';
}
function show(){const node=document.getElementById('em-root');if(node){const root=document.createElement('div');root.innerHTML=markup();node.replaceWith(root.firstElementChild);}}
function readForm(){
 if(st.screen!=='editor')return;
 for(const [id,key] of [['em-title','title'],['em-subject','subject'],['em-preheader','preheader'],['em-language','language']]){
  const v=document.getElementById(id);if(v)st.draft[key]=v.value;
 }
 document.querySelectorAll('.em-block-text').forEach(x=>{let b=st.draft.blocks[Number(x.dataset.index)];if(b)b[x.dataset.field]=x.value;});
}
function parseCsv(input){
 const rows=[];let cells=[],part='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(c==='"'){if(quoted&&input[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){cells.push(part);part='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;cells.push(part);part='';if(cells.some(x=>x.trim()))rows.push(cells);cells=[];}
  else part+=c;
 }
 if(quoted)throw Error('CSV con comillas incompletas.');
 cells.push(part);if(cells.some(x=>x.trim()))rows.push(cells);
 return rows;
}
async function run(action,button){
 if(!st.businessId)return;
 if(st.busy)return;
 try{
  if(['save','test','block-add','block-delete','block-up','block-down','viewport','back'].includes(action))readForm();
  if(action==='new'){st.screen='editor';st.draft=fresh();st.notice='';show();return;}
  if(action==='edit'){const c=st.campaigns.find(x=>x.id===button.dataset.id);if(c){st.draft=structuredClone(c);st.screen='editor';st.notice='';show();}return;}
  if(action==='back'){st.screen='list';st.notice='';show();return;}
  if(action==='block-add'){
   if(st.draft.blocks.length>=18)throw Error('Máximo 18 bloques por newsletter.');
   const type=button.dataset.type;
   st.draft.blocks.push(type==='heading'?{type,text:'Nuevo título'}:type==='text'?{type,text:'Escribe aquí el mensaje...'}:type==='image'?{type,url:'https://brasper.com',alt:'Banner de brasper'}:{type,text:'Enviar dinero',url:'https://brasper.com'});
   show();return;
  }
  if(action==='block-delete'||action==='block-up'||action==='block-down'){
   const n=Number(button.dataset.i),a=st.draft.blocks;
   if(action==='block-delete'&&a.length>1)a.splice(n,1);
   if(action==='block-up'&&n>0)[a[n-1],a[n]]=[a[n],a[n-1]];
   if(action==='block-down'&&n<a.length-1)[a[n],a[n+1]]=[a[n+1],a[n]];
   show();return;
  }
  if(action==='viewport'){st.mobile=!st.mobile;show();return;}
  if(action==='copy-image'){await navigator.clipboard.writeText(button.dataset.url);st.notice='Enlace de imagen copiado. Agrégalo al bloque Imagen.';show();return;}
  st.busy=true;st.error='';st.notice='';show();
  if(action==='save'){
   const result=await api('POST',{action:'save_campaign',campaign:st.draft});
   st.draft=structuredClone(result.campaign);st.notice='Newsletter guardado como borrador.';
   await load(st.businessId,false);
  }else if(action==='duplicate'){
   await api('POST',{action:'duplicate_campaign',campaign_id:button.dataset.id});
   st.notice='Newsletter duplicado.';await load(st.businessId,false);
  }else if(action==='test'){
   const to=document.getElementById('em-test-to')?.value||'';
   // Input is captured by delegated handler before screen is replaced.
   await api('POST',{action:'test_email',campaign:st.draft,to:to||st.testEmail||''});
   st.notice='Se solicitó un correo de prueba. Revisa tu bandeja.';
  }
 }catch(err){st.error=err.message||'Error al procesar la solicitud.';}finally{st.busy=false;show();}
}
async function load(businessId,clear=true){
 if(!businessId)return;
 if(st.businessId!==businessId){
  st.businessId=businessId;st.loaded=false;st.campaigns=[];st.contacts=[];st.assets=[];st.screen='list';st.draft=fresh();
 }
 try{
  const d=await api('GET');
  st.campaigns=d.campaigns||[];st.contacts=d.contacts||[];st.assets=d.assets||[];st.loaded=true;st.configured=d.configured;
  if(clear){st.error='';st.notice='';}
 }catch(e){st.loaded=false;st.error=e.message;}
 show();
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-em]');if(!b||!document.getElementById('em-root'))return;
 if(b.tagName==='BUTTON')ev.preventDefault();
 // Capture test address before run re-renders the form
 if(b.dataset.em==='test')st.testEmail=document.getElementById('em-test-to')?.value||'';
 await run(b.dataset.em,b);
});
document.addEventListener('input',ev=>{if(ev.target.closest('#em-root')&&st.screen==='editor'&&ev.target.matches('#em-title,#em-subject,#em-preheader,#em-language,.em-block-text'))readForm();});
document.addEventListener('change',async ev=>{
 if(!document.getElementById('em-root'))return;
 if(ev.target.id==='em-language'){readForm();return;}
 if(ev.target.id==='em-csv'){
  const file=ev.target.files?.[0];if(!file)return;
  try{
   if(file.size>1_000_000)throw Error('CSV demasiado grande (máximo 1 MB).');
   const csv=(await file.text()).replace(/^\uFEFF/,'');
   const rows=parseCsv(csv);if(rows.length<2)throw Error('El CSV está vacío.');
   const headers=rows.shift().map(x=>x.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
   const col=(names)=>names.map(x=>headers.indexOf(x)).find(x=>x>=0);
   const ci={name:col(['nombre','name','nome']),email:col(['email','correo','e-mail']),language:col(['idioma','language']),company:col(['empresa','company']),consent:col(['consentimiento','consent','consentimento'])};
   if(ci.name===undefined||ci.email===undefined||ci.consent===undefined)throw Error('Faltan columnas: nombre, email y consentimiento.');
   const contacts=rows.map(row=>({name:(row[ci.name]||'').trim(),email:(row[ci.email]||'').trim(),language:ci.language===undefined?'es':(row[ci.language]||'es').toLowerCase().startsWith('pt')?'pt':'es',company:ci.company===undefined?'':row[ci.company]||'',consent:/^(si|sí|true|1|yes|sim|acepto)$/i.test((row[ci.consent]||'').trim())})).filter(x=>x.name&&x.email);
   if(contacts.length>300)throw Error('Importa hasta 300 contactos por archivo en esta primera versión.');
   if(!contacts.length)throw Error('No hay contactos válidos.');
   if(!confirm('¿Confirmas que los contactos marcados sí otorgaron su consentimiento para recibir newsletters de brasper?'))return;
   st.busy=true;st.error='';show();
   const r=await api('POST',{action:'import_contacts',contacts});
   st.notice=r.added+' contactos importados. '+r.skipped+' omitidos o duplicados.';
   await load(st.businessId,false);
  }catch(e){st.error=e.message;}
  finally{st.busy=false;show();}
 }else if(ev.target.id==='em-upload'){
  const file=ev.target.files?.[0];if(!file)return;
  try{
   if(file.size>2_000_000)throw Error('Imagen demasiado grande (máximo 2 MB).');
   if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Solo JPG, PNG y WebP.');
   const url=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=()=>reject(Error('No se pudo leer la imagen.'));rd.readAsDataURL(file)});
   st.busy=true;st.error='';show();
   await api('POST',{action:'upload_image',mime:file.type,base64:url.split(',')[1]});
   st.notice='Imagen agregada a tu biblioteca.';await load(st.businessId,false);
  }catch(e){st.error=e.message;}
  finally{st.busy=false;show();}
 }
});
let dragFrom=null;
document.addEventListener('dragstart',ev=>{
 const block=ev.target.closest('#em-root .em-block');
 if(!block)return;readForm();dragFrom=Number(block.dataset.block);ev.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',ev=>{if(dragFrom!==null&&ev.target.closest('#em-root .em-block'))ev.preventDefault();});
document.addEventListener('drop',ev=>{
 const block=ev.target.closest('#em-root .em-block');if(!block||dragFrom===null)return;ev.preventDefault();
 const to=Number(block.dataset.block),[moved]=st.draft.blocks.splice(dragFrom,1);st.draft.blocks.splice(to,0,moved);dragFrom=null;show();
});
document.addEventListener('dragend',()=>{dragFrom=null;});
window.brasperEmailMarketing={reset(){Object.assign(st,{businessId:'',loaded:false,busy:false,error:'',notice:'',campaigns:[],contacts:[],assets:[],screen:'list',draft:fresh(),testEmail:''});},page(bid){if(st.businessId!==bid){st.businessId=bid;st.loaded=false;st.campaigns=[];st.contacts=[];st.assets=[];st.screen='list';st.draft=fresh();}return markup();},load};
})();
