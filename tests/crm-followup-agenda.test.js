import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {agendaStore,render,actions} from '../public/crm-followup-agenda.js';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const u='33333333-3333-4333-8333-333333333333';
const lead='44444444-4444-4444-8444-444444444444';
function storage(){const entries=new Map();return{
 getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value),
 dump:()=>[...entries.values()].join('')
}}
const args={id:'task-one',leadId:lead,action:'call',dueDate:'2026-11-03'};

test('C18 creates a local internal reminder using action code, lead id and due date',()=>{
 const s=storage(),db=agendaStore(s,u,a),task=db.create(args);
 assert.equal(task.action,'call');
 assert.equal(task.lead_id,lead);
 assert.equal(task.due_date,'2026-11-03');
 assert.equal(task.completed_at,null);
 assert.equal(db.list().length,1);
 assert.doesNotMatch(s.dump(),/name|email|phone|contact@example.com|Contacto privado/);
 assert.deepEqual(Object.keys(task),['id','lead_id','action','due_date','completed_at']);
});
test('C19 lets the owner complete a local task idempotently without changing lead records',()=>{
 const db=agendaStore(storage(),u,a);db.create(args);
 const once=db.complete('task-one','2026-11-04T12:00:00.000Z');
 assert.equal(once.completed_at,'2026-11-04T12:00:00.000Z');
 assert.deepEqual(db.complete('task-one','2026-11-05T12:00:00.000Z'),once);
 assert.throws(()=>db.complete('unknown','2026-11-04T12:00:00Z'),/ya no existe/);
});
test('C20 reports overdue, open and done tasks only in authorized local context',()=>{
 const s=storage(),own=agendaStore(s,u,a),other=agendaStore(s,u,b);
 own.create(args);
 own.create({...args,id:'task-two',dueDate:'2026-11-06'});
 own.create({...args,id:'task-three',dueDate:'2026-11-01'});
 own.complete('task-three','2026-11-02T12:00:00Z');
 other.create({...args,id:'other-task'});
 assert.deepEqual(own.summary('2026-11-04'),{total:3,open:2,overdue:1,completed:1});
 assert.deepEqual(other.summary('2026-11-04'),{total:1,open:1,overdue:1,completed:0});
});
test('local tasks reject invalid dates, unknown action, malformed IDs and excessive task counts',()=>{
 const db=agendaStore(storage(),u,a);
 assert.throws(()=>agendaStore(storage(),'invalid',a));
 assert.throws(()=>db.create({...args,dueDate:'2026-02-30'}));
 assert.throws(()=>db.create({...args,action:'send-whatsapp'}));
 assert.throws(()=>db.create({...args,leadId:'foreign'}));
 assert.throws(()=>db.create({...args,id:'<script>'}));
 assert.throws(()=>db.summary('bad date'));
 for(let i=0;i<100;i++)db.create({...args,id:'t-'+i});
 assert.throws(()=>db.create({...args,id:'overflow'}),/Máximo de 100/);
 assert.equal(db.list().length,100);
});
test('agenda UI labels local-only limits and does not expose contacts to local storage',()=>{
 const markup=render([
  {id:lead,business_id:a,name:'<b>Contacto</b>',stage:'new'},
  {id:b,business_id:b,name:'SECRET-FOREIGN',stage:'new'}
 ],{businessId:a,userId:u});
 assert.match(markup,/Agenda de seguimiento/);
 assert.match(markup,/No se sincronizan con otros dispositivos/);
 assert.match(markup,/name="dueDate"/);
 assert.match(markup,/name="leadId"/);
 assert.match(markup,/name="action"/);
 assert.match(markup,/ed-agenda-form/);
 assert.doesNotMatch(markup,/SECRET-FOREIGN/);
 assert.match(markup,/&lt;b&gt;Contacto&lt;\/b&gt;/);
 assert.equal(Object.keys(actions).length,5);
});
test('agenda and sorting assets are mounted in CRM and issue no external sends',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const module=readFileSync(new URL('../public/crm-followup-agenda.js',import.meta.url),'utf8');
 assert.match(index,/crm-followup-agenda\.js\?v=growth-c50-tasks-20261104/);
 assert.match(index,/crm-followup-agenda\.css\?v=growth-c50-tasks-20261104/);
 assert.match(app,/edwinCrmAgenda\?\.render\(data,pipelineCtx\)/);
 assert.match(app,/agendaPanel\+/);
 assert.match(app,/edwin:agenda-change/);
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|Notification\(/);
});
