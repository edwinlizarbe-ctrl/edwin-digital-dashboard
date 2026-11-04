/* Edwin CRM C18–C20: private, local-only follow-up tasks.
 * Stores action codes, lead UUIDs and dates, never contact names or messages.
 * No server sync, no notifications and no changes to customer data.
 */
const root=typeof window!=='undefined'?window:null;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const taskId=/^[a-z0-9-]{1,80}$/i;
const actions=Object.freeze({
 call:'Llamar al contacto',
 email:'Preparar respuesta por correo',
 offer:'Preparar propuesta',
 review:'Revisar el cierre',
 info:'Reunir información'
});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validDay(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function validTask(t){
 return t&&taskId.test(t.id)&&uuid.test(t.lead_id)&&Object.hasOwn(actions,t.action)&&validDay(t.due_date)
   &&(t.completed_at===null||typeof t.completed_at==='string'&&!Number.isNaN(Date.parse(t.completed_at)));
}
function agendaStore(storage,userId,businessId){
 if(!uuid.test(String(userId||''))||!uuid.test(String(businessId||'')))throw new TypeError('Empresa o usuario no válido.');
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new TypeError('Almacenamiento local no disponible.');
 const key='edwin-crm-local-agenda-v1:'+userId+':'+businessId;
 function list(){
  try{
   const raw=JSON.parse(storage.getItem(key)||'[]');
   return Array.isArray(raw)?raw.filter(validTask).slice(0,100).map(t=>({
    id:t.id,lead_id:t.lead_id,action:t.action,due_date:t.due_date,completed_at:t.completed_at
   })):[];
  }catch{return [];}
 }
 function save(items){storage.setItem(key,JSON.stringify(items));}
 function create({leadId,action,dueDate,id}){
  if(!uuid.test(String(leadId||''))||!Object.hasOwn(actions,action)||!validDay(dueDate)||!taskId.test(String(id||'')))
   throw new TypeError('Revisa contacto, acción y fecha.');
  const current=list();
  if(current.length>=100)throw new RangeError('Máximo de 100 tareas locales.');
  if(current.some(t=>t.id===id))throw new TypeError('La tarea ya existe.');
  const task={id,lead_id:leadId,action,due_date:dueDate,completed_at:null};
  save([...current,task]);return task;
 }
 function complete(id,now=new Date().toISOString()){
  if(!taskId.test(String(id||''))||!Number.isFinite(Date.parse(now)))throw new TypeError('Tarea inválida.');
  let found=false;
  const updated=list().map(t=>{
   if(t.id!==id)return t;
   found=true;return t.completed_at?t:{...t,completed_at:now};
  });
  if(!found)throw new TypeError('La tarea ya no existe.');
  save(updated);return updated.find(t=>t.id===id);
 }
 function summary(today=new Date().toISOString().slice(0,10)){
  if(!validDay(today))throw new TypeError('Fecha inválida.');
  const entries=list(),open=entries.filter(t=>!t.completed_at);
  return {total:entries.length,open:open.length,overdue:open.filter(t=>t.due_date<today).length,
   completed:entries.length-open.length};
 }
 return Object.freeze({list,create,complete,summary});
}
let currentContext='',currentBusiness='',currentUser='',currentLeads=[];
function session(leads,{businessId,userId}){
 const id=String(userId||'')+'|'+String(businessId||'');
 if(currentContext!==id){currentContext=id;currentLeads=[];}
 currentBusiness=businessId;currentUser=userId;
 currentLeads=Array.isArray(leads)?leads.filter(l=>l&&l.business_id===businessId&&uuid.test(String(l.id||''))):[];
}
function store(){
 try{return agendaStore(root?.localStorage,currentUser,currentBusiness);}
 catch{return null;}
}
function render(leads,ctx){
 session(leads,ctx);
 if(!currentBusiness||!currentUser)return '';
 const db=store(),entries=db?.list()||[],today=new Date().toISOString().slice(0,10);
 const counts=db?.summary(today)||{total:0,open:0,overdue:0,completed:0};
 const names=new Map(currentLeads.map(l=>[l.id,String(l.name||'Contacto')]));
 const choices=currentLeads.filter(l=>!['won','lost'].includes(l.stage)).slice(0,100);
 const opt=(value,label)=>'<option value="'+esc(value)+'">'+esc(label)+'</option>';
 const options=choices.map(l=>opt(l.id,String(l.name||'Contacto').slice(0,80))).join('');
 const ordered=[...entries].sort((a,b)=>Number(a.completed_at!==null)-Number(b.completed_at!==null)
   ||Number(a.due_date>=today)-Number(b.due_date>=today)||a.due_date.localeCompare(b.due_date));
 const lines=ordered.slice(0,8).map(t=>{
  const label=names.get(t.lead_id)||'Contacto no disponible en la muestra';
  return '<li class="ed-agenda-row"><div><strong>'+esc(actions[t.action])+'</strong>'+
   '<small>'+esc(label)+' · '+t.due_date+(t.completed_at?' · Completada':t.due_date<today?' · Vencida':'')+'</small></div>'+
   (t.completed_at?'<span class="ed-agenda-done">Hecha</span>':
    '<button class="button button-outline" type="button" data-ed-agenda-complete="'+esc(t.id)+'">Marcar hecha</button>')+'</li>';
 }).join('');
 return '<section class="card ed-agenda" aria-labelledby="ed-agenda-title">'+
  '<div class="ed-agenda-head"><div><h2 id="ed-agenda-title">Agenda de seguimiento</h2>'+
  '<p>Recordatorios privados guardados solo en este navegador. No se sincronizan con otros dispositivos ni envían mensajes.</p></div>'+
  '<strong>'+counts.open+' pendientes · '+counts.overdue+' vencidas</strong></div>'+
  '<form id="ed-agenda-form" class="ed-agenda-form">'+
  '<label>Oportunidad<select class="simple-input" name="leadId" required>'+opt('','Selecciona contacto')+options+'</select></label>'+
  '<label>Acción<select class="simple-input" name="action" required>'+Object.entries(actions).map(([k,v])=>opt(k,v)).join('')+'</select></label>'+
  '<label>Fecha límite<input class="simple-input" name="dueDate" type="date" value="'+today+'" required></label>'+
  '<button type="submit" class="button button-primary" '+(!db||!choices.length?'disabled':'')+'>Crear recordatorio</button></form>'+
  '<p id="ed-agenda-status" aria-live="polite" role="status">'+(!db?'Almacenamiento local no disponible. Puedes seguir usando el CRM.':'No se guardan nombres, correos ni teléfonos en estas tareas.')+'</p>'+
  (entries.length?'<ol class="ed-agenda-list">'+lines+'</ol>':'<p class="ed-agenda-empty">Todavía no hay recordatorios en este navegador.</p>')+
  '<p class="ed-agenda-note">Solo se muestran las primeras 8 tareas. El máximo es 100 por usuario y empresa.</p></section>';
}
function notice(t){const label=document.getElementById('ed-agenda-status');if(label)label.textContent=t;}
if(typeof document!=='undefined'){
 document.addEventListener('submit',event=>{
  if(event.target?.id!=='ed-agenda-form')return;
  event.preventDefault();const db=store();
  if(!db){notice('No se puede guardar en este navegador.');return;}
  const data=new FormData(event.target),leadId=String(data.get('leadId')||'');
  if(!currentLeads.some(l=>l.id===leadId&&!['won','lost'].includes(l.stage))){
   notice('El contacto seleccionado no pertenece a las oportunidades abiertas de esta empresa.');return;
  }
  try{
   const id='task-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*100000000).toString(36);
   db.create({id,leadId,action:String(data.get('action')||''),dueDate:String(data.get('dueDate')||'')});
   root.dispatchEvent(new Event('edwin:agenda-change'));
  }catch(e){notice(e.message||'No se pudo guardar la tarea.');}
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-ed-agenda-complete]');
  if(!button)return;
  const db=store();if(!db){notice('Almacenamiento no disponible.');return;}
  try{
   db.complete(button.dataset.edAgendaComplete);
   root.dispatchEvent(new Event('edwin:agenda-change'));
  }catch(e){notice(e.message||'No se pudo completar la tarea.');}
 });
}
if(root){root.edwinCrmAgenda=Object.freeze({render});root.dispatchEvent(new Event('edwin:agenda-ready'));}
export {agendaStore,render,actions};
