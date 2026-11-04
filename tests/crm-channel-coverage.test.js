import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-funnel.js';

const {coverage,renderCoverage,render}=globalThis.edwinCrmFunnel;
const data={
 total:50,partial:false,
 by_source:{
  organic:{total:25,by_stage:{won:5},won_share_percent:20},
  meta_ads:{total:15,by_stage:{won:3},won_share_percent:20},
  google_ads:{total:7,by_stage:{won:2},won_share_percent:28.6},
  referral:{total:3,by_stage:{won:0},won_share_percent:0}
 },
 by_stage:{new:40,won:10},won_share_percent:20
};

test('C29 ranks channel coverage by registered opportunity share, not advertising conversions',()=>{
 const result=coverage(data);
 assert.equal(result.total,50);
 assert.deepEqual(result.channels.map(x=>x.source),['organic','meta_ads','google_ads','referral']);
 assert.deepEqual(result.channels.map(x=>x.percentOfSample),[50,30,14,6]);
 assert.equal(result.channels.reduce((s,c)=>s+c.percentOfSample,0),100);
 assert.ok(result.warnings.some(w=>w.includes('Sin filtro de período')));
 const html=renderCoverage(data);
 assert.match(html,/Participación de oportunidades por canal/);
 assert.match(html,/25 oportunidades/);
 assert.match(html,/50 % de la muestra/);
 assert.match(html,/sin atribuir conversiones ni ingresos/);
 assert.match(render(data),/ed-coverage-title/);
});

test('C29 caps anomalous source counts to valid sample sizes and ignores unknown sources',()=>{
 const result=coverage({total:4,by_source:{
  organic:{total:999999,by_stage:{won:0}},
  '<script>alert(1)</script>':{total:1},
  meta_ads:{total:'99'}
 }});
 assert.equal(result.channels.find(c=>c.source==='organic').percentOfSample,100);
 assert.equal(result.channels.some(c=>c.source.includes('script')),false);
 assert.doesNotMatch(JSON.stringify(result),/script|999999|\bNaN\b|Infinity/);
 assert.doesNotMatch(renderCoverage({total:0,by_source:{}}),/ed-coverage-title/);
});

test('C30 always explains partial samples and noncomparable time windows',()=>{
 const result=coverage({...data,total:1000,partial:true});
 assert.equal(result.partial,true);
 assert.ok(result.warnings.some(w=>w.includes('Cobertura parcial')));
 assert.ok(result.warnings.some(w=>w.includes('Sin filtro de período')));
 const html=renderCoverage({...data,total:1000,partial:true});
 assert.match(html,/Cobertura parcial/);
 assert.match(html,/No representa el historial completo/);
 assert.match(html,/fechas diferentes/);
});

test('C30 shows sample size and unknown-source uncertainty without inventing attribution',()=>{
 const result=coverage({total:12,partial:false,by_source:{
  organic:{total:8},other:{total:4}
 }});
 assert.ok(result.warnings.some(w=>w.includes('Muestra pequeña')));
 assert.ok(result.warnings.some(w=>w.includes('4 oportunidades están en la categoría Otro')));
 assert.match(renderCoverage({total:12,by_source:{other:{total:4}}}),/revisar su origen declarado/);
 assert.doesNotMatch(renderCoverage({total:12,by_source:{other:{total:4}}}),/conversión confirmada|ventas atribuibles/);
});

test('C29-C30 render only aggregated source labels and have no contact data or network writes',()=>{
 const src=readFileSync(new URL('../public/crm-funnel.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(index,/crm-funnel\.js\?v=growth-c29-c30-20261104/);
 assert.match(index,/crm-funnel\.css\?v=growth-c29-c30-20261104/);
 assert.match(src,/Object\.entries\(sourceLabels\)/);
 assert.doesNotMatch(src,/\bfetch\s*\(|\bemail\s*:/);
 const html=renderCoverage({...data,by_source:{...data.by_source,
  evil:{total:30,name:'PRIVATE',email:'private@example.com'}}});
 assert.doesNotMatch(html,/PRIVATE|private@example.com|evil/);
});
