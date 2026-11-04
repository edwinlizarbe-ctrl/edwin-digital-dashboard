import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineViewStore, filterPipelineRows, normalizePipelineFilter } from '../public/pipeline-views.js';
const storage = () => { const map = new Map(); return { getItem:k=>map.get(k)||null, setItem:(k,v)=>map.set(k,v) }; };
test('G06 persists filters without lead PII and isolates tenant and user', () => {
  const s=storage(), a=pipelineViewStore(s,'user1','business1'), b=pipelineViewStore(s,'user1','business2'), c=pipelineViewStore(s,'user2','business1');
  a.save('myview','Prospectos',{stage:'new',source:'meta',from:'2026-01-01'});
  assert.equal(a.list().length,1); assert.deepEqual(b.list(),[]); assert.deepEqual(c.list(),[]);
  assert.doesNotMatch(JSON.stringify(a.list()), /email|phone|contact/i);
  a.remove('myview'); assert.deepEqual(a.list(),[]);
});
test('G06 filters by stage, source and inclusive dates', () => {
  const rows=[{stage:'new',source:'meta',created_at:'2026-02-01T10:00:00Z'},{stage:'won',source:'meta',created_at:'2026-02-01'},{stage:'new',source:'google',created_at:'2026-02-01'}];
  assert.equal(filterPipelineRows(rows,{stage:'new',source:'meta',from:'2026-02-01',to:'2026-02-01'}).length,1);
});
test('G06 rejects invalid contexts, dates and malformed stored views', () => {
  assert.throws(()=>pipelineViewStore(storage(),'','business1'));
  assert.throws(()=>normalizePipelineFilter({from:'2026-03-02',to:'2026-02-01'}));
  assert.throws(()=>normalizePipelineFilter({stage:'<script>'}));
  const s=storage(), v=pipelineViewStore(s,'u','b');
  assert.throws(()=>v.save('id','<script>',{}));
  assert.deepEqual(v.list(),[]);
});
