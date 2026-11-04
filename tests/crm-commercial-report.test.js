import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-commercial-report.js';

const {summarize,csv,csvCell,render}=globalThis.edwinCommercialReport;
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
const now='2026-11-04T12:00:00Z';
const row=(created_at,stage='new',source='organic',business_id=a)=>({
 business_id,created_at,stage,source,name:'PRIVATE CUSTOMER',email:'secret@example.com',phone:'999888777'
});
const leads=[
 row('2026-11-04T08:00:00Z','new','organic'),
 row('2026-11-02T08:00:00Z','won','meta_ads'),
 row('2026-10-26T08:00:00Z','contacted','organic'),
 row('2026-10-23T08:00:00Z','lost','referral'),
 row('2026-09-01T08:00:00Z','qualified','google_ads'),
 row('2026-11-01T08:00:00Z','won','google_ads',b)
];
const opts={days:7,now,partial:false};

test('C41 exports only whitelisted aggregate labels, numbers and dates from the authorized business',()=>{
 const report=summarize(leads,a,opts);
 const body=csv(report);
 assert.match(body,/^\uFEFF"Tipo";"Origen";"Etapa";"Oportunidades";"Inicio UTC";"Fin UTC";"Muestra parcial"/);
 assert.match(body,/"Total";"Todos";"Todos";"2";"2026-10-29";"2026-11-04";"No"/);
 assert.match(body,/"Canal";"Orgánico";"Todas";"1"/);
 assert.match(body,/"Canal";"Meta Ads";"Todas";"1"/);
 assert.doesNotMatch(body,/PRIVATE CUSTOMER|secret@example.com|999888777|11111111-1111|22222222-2222/);
 assert.equal(body.includes('https://'),false);
});

test('C42 breaks down exact current-stage counts by declared source and stage',()=>{
 const report=summarize(leads,a,opts);
 assert.equal(report.current.total,2);
 assert.equal(report.previous.total,2);
 assert.equal(report.current.sources.organic,1);
 assert.equal(report.current.sources.meta_ads,1);
 assert.equal(report.current.grid.meta_ads.won,1);
 assert.equal(report.current.grid.organic.new,1);
 assert.equal(report.current.stages.won,1);
 assert.equal(report.current.stages.new,1);
 assert.equal(report.current.stages.qualified,0);
 assert.equal(report.loaded,5);
 assert.equal(report.outside,1);
});

test('C43 CSV neutralizes formula-prefix inputs and doubles quotes in every cell',()=>{
 for(const formula of ['=HYPERLINK("https://evil","click")','+SUM(1,2)','-2+3','@cmd',' =test']){
  const escaped=csvCell(formula);
  assert.ok(escaped.startsWith('"\''),formula);
  assert.ok(escaped.endsWith('"'));
 }
 assert.equal(csvCell('hola "mundo"'),'"hola ""mundo"""');
 const report=summarize([row('2026-11-02T09:00:00Z','<img>','=BAD')],a,opts);
 const body=csv(report);
 assert.doesNotMatch(body,/<img>|=BAD|PRIVATE|secret@example.com/);
 assert.equal(report.unrecognizedStage,1);
});

test('C44 compares only equal-length UTC periods with verified denominator and full coverage',()=>{
 const report=summarize(leads,a,opts);
 assert.equal(report.from,'2026-10-29');
 assert.equal(report.to,'2026-11-04');
 assert.equal(report.previousFrom,'2026-10-22');
 assert.equal(report.previousTo,'2026-10-28');
 assert.equal(report.comparable,true);
 assert.equal(report.change,0);
 const higher=summarize([...leads,row('2026-11-03T08:00:00Z','new','whatsapp')],a,opts);
 assert.equal(higher.change,50);
 const withoutBaseline=summarize([row('2026-11-01T08:00:00Z')],a,opts);
 assert.equal(withoutBaseline.comparable,false);
 assert.equal(withoutBaseline.change,null);
});

test('C44 disables unreliable comparisons when the list is partial or any record lacks a valid date',()=>{
 const partial=summarize(leads,a,{...opts,partial:true});
 assert.equal(partial.comparable,false);
 assert.equal(partial.change,null);
 const untrusted=summarize([...leads,row('unparseable','new')],a,opts);
 assert.equal(untrusted.undated,1);
 assert.equal(untrusted.comparable,false);
 assert.equal(untrusted.change,null);
 const badStage=summarize([...leads,row('2026-11-01T08:00:00Z','proposal')],a,opts);
 assert.equal(badStage.unrecognizedStage,1);
 assert.equal(badStage.comparable,false);
});

test('C45 states data source, UTC date range, universe and limits in the visible commercial report',()=>{
 const html=render({leads,businessId:a,userId:user,partial:false});
 assert.match(html,/Informe comercial por origen y etapa/);
 assert.match(html,/Fuente: oportunidades registradas en Edwin CRM/);
 assert.match(html,/Fechas de creación en UTC/);
 assert.match(html,/registros cargados/);
 assert.match(html,/Orígenes declarados manualmente/);
 assert.match(html,/etapas reflejan el estado actual/);
 assert.match(html,/Período anterior:/);
 assert.match(html,/data-ed-sales-report-export/);
 assert.doesNotMatch(html,/PRIVATE CUSTOMER|secret@example.com|999888777/);
 const partial=render({leads,businessId:a,userId:user,partial:true});
 assert.match(partial,/Datos parciales/);
 assert.match(partial,/Comparación porcentual no disponible/);
 assert.doesNotMatch(partial,/Variación del volumen registrado/);
});

test('report fails closed when input is invalid and refuses to show a stale user/business report',()=>{
 assert.throws(()=>summarize(leads,'bad',opts));
 assert.throws(()=>summarize(leads,a,{...opts,days:999}));
 assert.throws(()=>summarize(leads,a,{...opts,now:'not-a-date'}));
 assert.equal(render({leads,businessId:'bad',userId:user}),'');
 const error=render({leads,businessId:b,userId:user,error:'PRIVATE INTERNAL QUERY'});
 assert.match(error,/No se pudieron comprobar las oportunidades/);
 assert.doesNotMatch(error,/PRIVATE INTERNAL QUERY|Orgánico/);
 const noData=render({leads:[],businessId:a,userId:user});
 assert.match(noData,/No hay oportunidades creadas en este período/);
 assert.match(noData,/data-ed-sales-report-export disabled/);
});

test('commercial report is mounted on Reports and adds no third-party traffic or writes',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const module=readFileSync(new URL('../public/crm-commercial-report.js',import.meta.url),'utf8');
 assert.match(index,/crm-commercial-report\.js\?v=growth-c41-c45-20261104/);
 assert.match(index,/crm-commercial-report\.css\?v=growth-c41-c45-20261104/);
 assert.ok(index.indexOf('crm-commercial-report.js')<index.indexOf('/app.js'));
 assert.match(app,/edwinCommercialReport\?\.render\(\{leads:state\.leads/);
 assert.match(app,/edwin:report-period/);
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage/);
});
