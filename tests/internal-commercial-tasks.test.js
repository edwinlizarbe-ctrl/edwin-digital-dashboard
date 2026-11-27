import test from 'node:test';
import assert from 'node:assert/strict';
import { createInternalTask, completeInternalTask, summarizeInternalTasks } from '../internal-commercial-tasks.js';
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const args={ businessId:a,actorBusinessId:a,userId:a,leadId:a,id:a,title:'  Llamar mañana  ',dueAt:'2026-11-05T10:00:00Z' };
test('creates internal reminder and completes idempotently for assigned user',()=>{
 const task=createInternalTask(args);
 assert.equal(task.title,'Llamar mañana');
 const done=completeInternalTask(task,{actorBusinessId:a,actorUserId:a,now:'2026-11-06T10:00:00Z'});
 assert.equal(completeInternalTask(done,{actorBusinessId:a,actorUserId:a,now:'2026-11-07T10:00:00Z'}),done);
});
test('rejects cross-tenant creation and completion',()=>{
 assert.throws(()=>createInternalTask({...args,actorBusinessId:b}),/FORBIDDEN/);
 assert.throws(()=>completeInternalTask(createInternalTask(args),{actorBusinessId:b,actorUserId:a,now:'2026-11-06T10:00:00Z'}),/FORBIDDEN/);
});
test('aggregates only tenant counts without PII',()=>{
 const task=createInternalTask(args), other={...task,businessId:b};
 assert.deepEqual(summarizeInternalTasks([task,other],a,'2026-11-06T10:00:00Z'),{total:1,open:1,overdue:1});
});
test('rejects malformed title and due date',()=>{
 assert.throws(()=>createInternalTask({...args,title:' '}),/INVALID_TITLE/);
 assert.throws(()=>createInternalTask({...args,dueAt:'not-a-date'}),/INVALID_DATE/);
});
