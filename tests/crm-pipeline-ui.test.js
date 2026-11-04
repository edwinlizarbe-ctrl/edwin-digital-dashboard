import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterRows,render,context,setFilters,setSort} from '../public/crm-pipeline-ui.js';
import {pipelineViewStore,filterPipelineRows} from '../public/pipeline-views.js';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const u='33333333-3333-4333-8333-333333333333';
const ctx={businessId:a,userId:u};
const rows=[
 {business_id:a,id:'one',stage:'new',source:'organic',created_at:'2026-11-01',name:'Contact A'},
 {business_id:a,id:'two',stage:'won',source:'meta_ads',created_at:'2026-11-02',name:'Contact B'},
 {business_id:a,id:'three',stage:'new',source:'meta_ads',created_at:'2026-10-01',name:'Contact C'},
 {business_id:b,id:'secret',stage:'new',source:'organic',created_at:'2026-11-01',name:'FOREIGN-SECRET'}
];
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),all:()=>[...values.values()]};};
test('C11: stage filter shows only the selected company and stage',()=>{
 setFilters({stage:'new'},ctx);
 assert.deepEqual(filterRows(rows,ctx).map(r=>r.id),['one','three']);
 assert.doesNotMatch(JSON.stringify(filterRows(rows,ctx)),/FOREIGN-SECRET/);
});
test('C12: source filter composes with stage and excludes other businesses',()=>{
 setFilters({source:'meta_ads',stage:'new'},ctx);
 assert.deepEqual(filterRows(rows,ctx).map(r=>r.id),['three']);
});
test('C13: date range can be combined with source and stage',()=>{
 setFilters({source:'meta_ads',from:'2026-11-01',to:'2026-11-30'},ctx);
 assert.deepEqual(filterRows(rows,ctx).map(r=>r.id),['two']);
 assert.throws(()=>setFilters({from:'2026-12-01',to:'2026-11-01'},ctx));
});
test('C14: saving a view writes only filters within user/business storage context',()=>{
 const s=storage();
 const filter=setFilters({stage:'qualified',source:'organic'},ctx);
 const scoped=pipelineViewStore(s,u,a);
 scoped.save('qualified','Calificados',filter);
 assert.equal(scoped.list().length,1);
 assert.deepEqual(scoped.list()[0].filter,filter);
 assert.equal(pipelineViewStore(s,u,b).list().length,0);
 assert.doesNotMatch(JSON.stringify(s.all()),/Contact A|FOREIGN-SECRET/);
});
test('C15: saved view can be restored and applied to current authorized rows',()=>{
 const s=storage(),scoped=pipelineViewStore(s,u,a);
 scoped.save('recent','Recientes',{from:'2026-11-01',source:'organic'});
 const saved=scoped.list().find(x=>x.id==='recent');
 assert.equal(saved.name,'Recientes');
 setFilters(saved.filter,ctx);
 assert.deepEqual(filterRows(rows,ctx).map(x=>x.id),['one']);
});
test('C16: deleting saved filters does not remove any contact records',()=>{
 const s=storage(), scoped=pipelineViewStore(s,u,a), snapshot=JSON.stringify(rows);
 scoped.save('keep','Una vista',{stage:'new'});
 scoped.remove('keep');
 assert.deepEqual(scoped.list(),[]);
 assert.equal(JSON.stringify(rows),snapshot);
});
test('filters are reset on company switch; invalid values never trigger upstream reads',()=>{
 setFilters({stage:'won'},ctx);
 assert.equal(filterRows(rows,{businessId:b,userId:u}).length,1);
 assert.equal(filterRows(rows,ctx).length,3,'switch back resets previous private filter context');
 assert.throws(()=>setFilters({stage:'<script>'},ctx));
 const s=readFileSync(new URL('../public/crm-pipeline-ui.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
});
test('filter toolbar exposes six controls, sample coverage and safe empty results',()=>{
 context(a,u);setFilters({stage:'won'},ctx);
 const html=render(rows,ctx,{partial:true});
 assert.match(html,/Filtrar y guardar vistas/);
 assert.match(html,/name="stage"/);
 assert.match(html,/name="source"/);
 assert.match(html,/name="from"/);
 assert.match(html,/name="to"/);
 assert.match(html,/data-ed-pipeline="save"/);
 assert.match(html,/data-ed-pipeline="load"/);
 assert.match(html,/data-ed-pipeline="delete"/);
 assert.match(html,/Lista parcial/);
 assert.match(html,/1 de 4 visibles/);
 assert.doesNotMatch(html,/FOREIGN-SECRET|Contact A/);
});
test('pipeline UI module is loaded and linked with actual opportunity list',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(index,/type="module" src="\/crm-pipeline-ui\.js\?v=growth-c50-followup-20261104"/);
 assert.match(index,/crm-pipeline-ui\.css\?v=growth-c50-filters-20261104/);
 assert.match(app,/edwinPipelineUI\?\.filterRows\(data,pipelineCtx\)/);
 assert.match(app,/edwinPipelineUI\?\.render\(data,pipelineCtx/);
 assert.match(app,/edwin:pipeline-change/);
 assert.match(app,/displayed\.map\(l=>/);
});

test('C17 prioritizes old open opportunities while leaving closed records last',()=>{
 const ctx={businessId:a,userId:u};
 const sample=[
  {business_id:a,id:'newer',stage:'new',source:'organic',created_at:'2026-11-04',updated_at:new Date().toISOString()},
  {business_id:a,id:'old',stage:'qualified',source:'organic',created_at:'2025-10-01',updated_at:'2025-10-02'},
  {business_id:a,id:'closed',stage:'won',source:'organic',created_at:'2025-01-01',updated_at:'2025-01-02'},
  {business_id:b,id:'foreign',stage:'qualified',source:'organic',created_at:'2020-01-01',updated_at:'2020-01-02'}
 ];
 setFilters({},ctx);setSort('followup',ctx);
 assert.deepEqual(filterRows(sample,ctx).map(x=>x.id),['old','newer','closed']);
 assert.match(render(sample,ctx),/Seguimiento pendiente primero/);
 assert.throws(()=>setSort('unsafe',ctx),/Orden inválido/);
 setSort('original',ctx);
 assert.deepEqual(filterRows(sample,ctx).map(x=>x.id),['newer','old','closed']);
});
