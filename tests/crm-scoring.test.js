import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-scoring.js';

const {score,priority,render}=globalThis.edwinCrmScoring;
const now=Date.parse('2026-11-04T12:00:00Z');
const lead=(overrides={})=>({id:'one',name:'Contacto prueba',stage:'new',created_at:'2026-11-02T12:00:00Z',
 email:'',phone:'',notes:'',source:'organic',...overrides});

test('G03 prioritizes open opportunities using explicit reproducible rules',()=>{
 const qualified=score(lead({stage:'qualified',created_at:'2026-10-01T12:00:00Z',
  phone:'999999999',notes:'Toma de decisión'}),now);
 assert.equal(qualified.score,95);
 assert.equal(qualified.active,true);
 assert.match(qualified.reasons.join(' '),/Etapa calificada/);
 assert.match(qualified.reasons.join(' '),/14 días/);
 assert.match(qualified.reasons.join(' '),/medio de contacto/);
 const fresh=score(lead(),now);
 assert.equal(fresh.score,55);
 assert.equal(fresh.reasons.length,1);
 const follow=score(lead({stage:'contacted',created_at:'2026-10-25T12:00:00Z'}),now);
 assert.equal(follow.score,48);
});

test('G03 excludes closed or unrecognized stages and does not claim probability of winning',()=>{
 for(const stage of ['won','lost','unknown']){
  const result=score(lead({stage}),now);
  assert.equal(result.active,false);
  assert.equal(result.score,0);
 }
 const html=render([lead({name:'Ana',stage:'qualified'})]);
 assert.match(html,/Reglas internas, no inteligencia artificial ni probabilidad de venta/);
});

test('G03 ranking is stable and ignores monetary value or marketing source',()=>{
 const first=lead({id:'1',stage:'new',source:'google_ads',amount:1000000,currency:'USD'});
 const second=lead({id:'2',stage:'new',source:'organic',amount:0,currency:'PEN'});
 const third=lead({id:'3',stage:'qualified'});
 assert.deepEqual(priority([first,second,third],now).map(x=>x.lead.id),['3','1','2']);
 assert.equal(score(first,now).score,score(second,now).score);
});

test('G03 hides raw notes, email and phone, and HTML-escapes user-entered names',()=>{
 const unsafe=lead({name:'<img src=x onerror=alert(1)>',stage:'qualified',
  email:'PRIVATE@example.com',phone:'999999999',notes:'SECRET-NOTE'});
 const html=render([unsafe]);
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<img/);
 assert.doesNotMatch(html,/PRIVATE@example.com/);
 assert.doesNotMatch(html,/999999999/);
 assert.doesNotMatch(html,/SECRET-NOTE/);
});

test('G03 displays the queue only when it has actionable leads and labels partial sample',()=>{
 assert.equal(render([]),'');
 assert.equal(render([lead({stage:'won'})]),'');
 assert.equal(render([lead()],{loading:true}),'');
 const html=render([lead()],{partial:true});
 assert.match(html,/Prioridad de seguimiento/);
 assert.match(html,/lista parcial/);
 assert.match(html,/No se envían mensajes automáticamente/);
});

test('G03 integration uses the registered lead list without sending outbound messages',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(index,/crm-scoring\.js\?v=growth-g03-20261104/);
 assert.match(index,/crm-scoring\.css\?v=growth-g03-20261104/);
 assert.ok(index.indexOf('crm-scoring.js')<index.indexOf('/app.js'));
 assert.match(app,/edwinCrmScoring\?\.render\(data,/);
 assert.match(app,/funnelPanel\+priorityPanel\+/);
 assert.match(app,/crmImportPanel\(\)/);
});
