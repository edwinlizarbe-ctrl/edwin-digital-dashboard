import test from 'node:test';
import assert from 'node:assert/strict';
import {prioritizeFollowups} from '../followup-priority.js';
const now=Date.parse('2026-11-04T12:00:00Z');
test('G04 sorts overdue qualified leads first',()=>{
 const r=prioritizeFollowups([{id:'new',business_id:'a',stage:'new',updated_at:'2026-11-04T11:00:00Z'},{id:'old',business_id:'a',stage:'qualified',updated_at:'2026-11-01T10:00:00Z'}],'a',now);
 assert.deepEqual(r.items.map(x=>x.id),['old','new']);assert.equal(r.summary.pending,1);
});
test('G04 isolates business aggregates and records',()=>{
 const r=prioritizeFollowups([{id:'secret',name:'PRIVATE',business_id:'b',stage:'qualified',updated_at:'2026-01-01'},{id:'own',business_id:'a',stage:'new',updated_at:'2026-11-01'}],'a',now);
 assert.equal(r.summary.total,1);assert.equal(r.items[0].id,'own');assert.doesNotMatch(JSON.stringify(r),/PRIVATE|secret/);
});
test('G04 does not flag closed or undated records',()=>{
 const r=prioritizeFollowups([{business_id:'a',stage:'won',updated_at:'2026-01-01'},{business_id:'a',stage:'new',updated_at:'bad'}],'a',now);
 assert.equal(r.summary.pending,0);assert.equal(prioritizeFollowups(null,'a').summary.total,0);
});
