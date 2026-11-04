import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-quality.js';

const api=globalThis.edwinCrmQuality;
const business='00000000-0000-4000-8000-000000000001';
const foreign='00000000-0000-4000-8000-000000000002';
const now=Date.parse('2026-11-04T12:00:00Z');
const fresh='2026-11-04T11:00:00Z',stale='2026-10-01T11:00:00Z';
const base={business_id:business,stage:'new',source:'organic',campaign:'',created_at:fresh,updated_at:fresh,email:'valid@example.com',phone:'999888777',amount:100,notes:'Contexto'};
const lead=overrides=>({...base,...overrides});
const output=(leads)=>api.analyze(leads,business,{now,partial:false});
const count=(res,id)=>res.checks.find(c=>c.id===id)?.count;
const cases=[
 ['C01',{stage:'new',updated_at:stale}, {stage:'new',updated_at:fresh}],
 ['C02',{stage:'contacted',updated_at:stale},{stage:'contacted',updated_at:fresh}],
 ['C03',{stage:'qualified',updated_at:stale},{stage:'qualified',updated_at:fresh}],
 ['C04',{email:'',phone:''},{email:'valid@example.com',phone:'999888777'}],
 ['C05',{email:'invalid@@example'},{email:'valid@example.com'}],
 ['C06',{phone:'123'},{phone:'999888777'}],
 ['C07',{source:'meta_ads',campaign:''},{source:'organic',campaign:''}],
 ['C08',{source:'other'},{source:'organic'}],
 ['C09',{stage:'won',amount:null},{stage:'won',amount:0}],
 ['C10',{stage:'qualified',notes:''},{stage:'qualified',notes:'Necesita presupuesto'}]
];
test('C01-C10: each of ten commercial quality signals detects its own concrete condition',()=>{
 assert.deepEqual(api.ids,cases.map(item=>item[0]));
 for(const [id,on,off] of cases){
  assert.equal(count(output([lead(on)]),id),1,id+' should report a matching lead');
  assert.equal(count(output([lead(off)]),id),0,id+' should not report an unrelated lead');
 }
});
test('C01-C03: missing or future timestamps do not create invented overdue counts',()=>{
 for(const stage of ['new','contacted','qualified']){
  const report=output([lead({stage,updated_at:'not-a-date',created_at:'not-a-date'}),
                       lead({stage,updated_at:'2026-11-07T12:00:00Z'})]);
  assert.equal(count(report,'C01')+count(report,'C02')+count(report,'C03'),0);
 }
});
test('C04-C06: whitespace, phone formatting and absent values are handled safely',()=>{
 const r=output([lead({email:' ',phone:' '}),
                 lead({email:'A@empresa.pe',phone:'+51 (999) 888-777'}),
                 lead({email:'bad@',phone:'123'})]);
 assert.equal(count(r,'C04'),1);
 assert.equal(count(r,'C05'),1);
 assert.equal(count(r,'C06'),1);
});
test('C07-C10: paid campaign, source quality and closed-deal review are stage-aware',()=>{
 const r=output([
  lead({stage:'qualified',source:'google_ads',campaign:'',notes:''}),
  lead({stage:'won',amount:null,source:'other'}),
  lead({stage:'lost',amount:null,source:'organic'})
 ]);
 for(const [id,expected] of [['C07',1],['C08',1],['C09',1],['C10',1]])assert.equal(count(r,id),expected);
});
test('tenant isolation holds even with cross-business mixed input; no contact PII leaves summary',()=>{
 const own=lead({name:'OWN-SECRET',email:'private@example.com',phone:'999555333'});
 const other=lead({business_id:foreign,name:'FOREIGN-SECRET',email:'broken@@',phone:''});
 const r=api.analyze([own,other],business,{now,partial:true});
 assert.equal(r.total,1);
 assert.equal(r.partial,true);
 assert.equal(count(r,'C05'),0);
 assert.equal(JSON.stringify(r).includes('SECRET'),false);
 assert.equal(JSON.stringify(r).includes('private@example.com'),false);
 assert.equal(api.analyze([own],foreign,{now}).total,0);
 assert.equal(api.analyze([own],'invalid business',{now}).total,0);
});
test('quality panel is readable, responsive and honest about partial samples and absence of data',()=>{
 const page=api.render(api.analyze([lead({stage:'new',updated_at:stale})],business,{now,partial:true}));
 assert.match(page,/Diagnóstico comercial · 10 controles/);
 assert.match(page,/10 controles/);
 assert.match(page,/Muestra parcial/);
 assert.match(page,/Consultar los 10 controles/);
 assert.match(page,/no envían mensajes/);
 assert.doesNotMatch(page,/valid@example.com|999888777/);
 const empty=api.render(output([]));
 assert.match(empty,/Todavía no hay contactos/);
 assert.equal(api.render(null,{loading:true}),'');
});
test('ten-check audit is wired to real CRM opportunity screen and does not send or edit data',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../public/crm-quality.js',import.meta.url),'utf8');
 assert.match(index,/crm-quality\.js\?v=growth-c50-20261104/);
 assert.match(index,/crm-quality\.css\?v=growth-c50-20261104/);
 assert.ok(index.indexOf('crm-quality.js')<index.indexOf('/app.js'));
 assert.match(app,/edwinCrmQuality\?\.analyze\(data,state\.businessId/);
 assert.match(app,/qualityPanel\+/);
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage/);
});
