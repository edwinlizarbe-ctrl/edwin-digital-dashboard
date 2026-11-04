/* Edwin CRM C11-C16 — saved filter controls built on the G06 tenant/user-scoped model.
 * Stored values are filter criteria only. Contact records never touch localStorage.
 */
import {pipelineViewStore,filterPipelineRows,normalizePipelineFilter} from './pipeline-views.js';
const globalRef=typeof window!=='undefined'?window:null;
const blank=()=>({stage:'',source:'',from:'',to:''});
const stageOptions=Object.freeze({new:'Nuevo',contacted:'Contactado',qualified:'Calificado',won:'Ganado',lost:'Perdido'});
const sourceOptions=Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',organic:'Orgánico',referral:'Referido',whatsapp:'WhatsApp',other:'Otro'});
let activeContext='',activeBusiness='',activeUser='',filters=blank(),selectedView='',notice='',sortOrder='original';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(businessId,userId){
 const id=String(userId||'')+'|'+String(businessId||'');
 if(activeContext!==id){activeContext=id;filters=blank();selectedView='';notice='';sortOrder='original';}
 activeBusiness=businessId;activeUser=userId;
 return {businessId,userId};
}
function store(ctx){
 try{return pipelineViewStore(globalRef?.localStorage,ctx.userId,ctx.businessId);}
 catch{return null;}
}
function setFilters(input,ctx){
 context(ctx.businessId,ctx.userId);
 filters=normalizePipelineFilter(input);
 return {...filters};
}
function setSort(value,ctx){
 context(ctx.businessId,ctx.userId);
 if(!['original','followup'].includes(value))throw new TypeError('Orden inválido');
 sortOrder=value;return sortOrder;
}
function filterRows(rows,ctx){
 context(ctx.businessId,ctx.userId);
 const own=Array.isArray(rows)?rows.filter(x=>x?.business_id===ctx.businessId):[];
 let found;
 try{found=filterPipelineRows(own,filters);}
 catch{found=own;}
 if(sortOrder!=='followup')return found;
 const current=Date.now();
 const rank=lead=>{
  if(['won','lost'].includes(lead.stage))return 2;
  const when=Date.parse(String(lead.updated_at||lead.created_at||''));
  if(Number.isFinite(when)&&when<=current-48*3600000)return 0;
  return 1;
 };
 const timestamp=lead=>{
  const d=Date.parse(String(lead.updated_at||lead.created_at||''));
  return Number.isFinite(d)?d:Number.MAX_SAFE_INTEGER;
 };
 return found.map((lead,i)=>({lead,i})).sort((a,b)=>rank(a.lead)-rank(b.lead)
  ||timestamp(a.lead)-timestamp(b.lead)||a.i-b.i).map(x=>x.lead);
}
function render(rows,ctx,{partial=false}={}){
 context(ctx.businessId,ctx.userId);
 const current=filterRows(rows,ctx);
 const views=store(ctx)?.list()||[];
 const option=(value,label,currentValue)=>'<option value="'+escape(value)+'" '+(value===currentValue?'selected':'')+'>'+escape(label)+'</option>';
 const selects=(name,all,options,value)=>'<label>'+all+'<select class="simple-input" name="'+name+'">'+option('', 'Todas',value)+Object.entries(options).map(([key,title])=>option(key,title,value)).join('')+'</select></label>';
 return '<section class="card ed-pipeline-view" aria-labelledby="ed-pipeline-view-title">'+
  '<div class="ed-pipeline-head"><div><h2 id="ed-pipeline-view-title">Filtrar y guardar vistas</h2>'+
  '<p>Consulta los contactos cargados sin modificar su estado.</p></div><strong>'+current.length+' de '+(Array.isArray(rows)?rows.length:0)+' visibles</strong></div>'+
  '<form id="ed-pipeline-filter-form" class="ed-pipeline-form">'+
  selects('stage','Etapa comercial',stageOptions,filters.stage)+
  selects('source','Origen declarado',sourceOptions,filters.source)+
  '<label>Desde<input class="simple-input" name="from" type="date" value="'+escape(filters.from)+'"></label>'+
  '<label>Hasta<input class="simple-input" name="to" type="date" value="'+escape(filters.to)+'"></label>'+
  '<div class="ed-pipeline-actions"><label>Orden<select class="simple-input" name="sort"><option value="original" '+(sortOrder==='original'?'selected':'')+'>Orden del registro</option><option value="followup" '+(sortOrder==='followup'?'selected':'')+'>Seguimiento pendiente primero</option></select></label><button class="button button-primary" type="submit">Aplicar filtros</button>'+
  '<button class="button button-outline" type="button" data-ed-pipeline="reset">Limpiar</button></div></form>'+
  '<div class="ed-pipeline-saved"><label>Nombre de la vista<input class="simple-input" id="ed-pipeline-name" maxlength="60" placeholder="Ej. Contactos por llamar"></label>'+
  '<button class="button button-outline" type="button" data-ed-pipeline="save">Guardar vista</button>'+
  '<label>Vistas guardadas<select class="simple-input" id="ed-pipeline-saved">'+option('','Selecciona una vista','')+
  views.map(v=>option(v.id,v.name,selectedView)).join('')+'</select></label>'+
  '<button class="button button-outline" type="button" data-ed-pipeline="load" '+(views.length?'':'disabled')+'>Abrir vista</button>'+
  '<button class="button button-outline" type="button" data-ed-pipeline="delete" '+(views.length?'':'disabled')+'>Eliminar vista</button></div>'+
  '<p id="ed-pipeline-status" role="status" aria-live="polite">'+escape(notice||'Puedes guardar hasta 20 vistas de filtros por usuario y empresa, en este navegador.')+'</p>'+
  (partial?'<p class="ed-pipeline-warning">Lista parcial: los filtros se aplican solo a los 100 contactos cargados.</p>':'')+
  '</section>';
}
function redraw(){globalRef?.dispatchEvent(new Event('edwin:pipeline-change'));}
function status(s){notice=s;const label=document.getElementById('ed-pipeline-status');if(label)label.textContent=s;}
if(typeof document!=='undefined'){
 document.addEventListener('submit',e=>{
  if(e.target?.id!=='ed-pipeline-filter-form')return;
  e.preventDefault();
  const form=e.target,fd=new FormData(form);
  try{
   setFilters(Object.fromEntries(['stage','source','from','to'].map(x=>[x,fd.get(x)||''])),{businessId:activeBusiness,userId:activeUser});
   setSort(fd.get('sort')||'original',{businessId:activeBusiness,userId:activeUser});
   selectedView='';notice='Filtros aplicados a los contactos cargados.';redraw();
  }catch(error){status(error.message||'Filtros inválidos.');}
 });
 document.addEventListener('click',e=>{
  const el=e.target.closest?.('[data-ed-pipeline]');if(!el)return;
  const action=el.dataset.edPipeline;
  if(!activeBusiness||!activeUser)return;
  const ctx={businessId:activeBusiness,userId:activeUser},saved=store(ctx);
  if(action==='reset'){filters=blank();sortOrder='original';selectedView='';notice='Filtros limpiados.';redraw();return;}
  if(!saved){status('El almacenamiento de vistas no está disponible en este navegador.');return;}
  try{
   if(action==='save'){
    const name=String(document.getElementById('ed-pipeline-name')?.value||'').trim();
    const fd=new FormData(document.getElementById('ed-pipeline-filter-form'));
    setFilters(Object.fromEntries(['stage','source','from','to'].map(x=>[x,fd.get(x)||''])),ctx);
    setSort(fd.get('sort')||'original',ctx);
    const id='vista-'+String(Date.now())+'-'+Math.floor(Math.random()*100000);
    const item=saved.save(id,name,filters);selectedView=item.id;notice='Vista guardada para esta empresa y usuario.';
   }else{
    const id=String(document.getElementById('ed-pipeline-saved')?.value||'');
    const selected=saved.list().find(v=>v.id===id);
    if(!selected){status('Selecciona una vista guardada.');return;}
    if(action==='load'){
     filters=selected.filter;selectedView=id;notice='Vista aplicada.';
    }else if(action==='delete'){
     saved.remove(id);selectedView='';notice='Vista eliminada. Los contactos no se han modificado.';
    }else return;
   }
   redraw();
  }catch(error){status(error.message||'No se pudo actualizar la vista.');}
 });
}
if(globalRef){
 globalRef.edwinPipelineUI=Object.freeze({filterRows,render,context,setFilters,setSort});
 globalRef.dispatchEvent(new Event('edwin:pipeline-ready'));
}
export {filterRows,render,context,setFilters,setSort};
