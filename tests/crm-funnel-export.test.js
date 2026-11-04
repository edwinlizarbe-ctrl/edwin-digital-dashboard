import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-funnel.js';

const {csv,render}=globalThis.edwinCrmFunnel;
const data={total:3,partial:false,by_stage:{new:1,won:1,contacted:1},
 by_source:{meta_ads:{total:2,by_stage:{new:1,won:1,contacted:0},won_share_percent:50},
 organic:{total:1,by_stage:{contacted:1,won:0},won_share_percent:0}}};

test('G17 exports channel and stage totals in a spreadsheet-readable UTF-8 CSV',()=>{
 const result=csv(data);
 assert.ok(result.startsWith('\uFEFFOrigen;Total;Nuevo;Contactado;Calificado;Ganado;Perdido;Porcentaje ganado;Muestra parcial'));
 assert.match(result,/Meta Ads;2;1;0;0;1;0;50;No/);
 assert.match(result,/Orgánico;1;0;1;0;0;0;0;No/);
 assert.match(result,/\r\n/);
 assert.doesNotMatch(result,/name|email|phone|notes/i);
});

test('G17 flags incomplete samples rather than presenting full population',()=>{
 const result=csv({...data,total:1000,partial:true});
 assert.match(result,/Meta Ads;2;1;0;0;1;0;50;Sí/);
 assert.match(render({...data,partial:true}),/Vista parcial/);
});

test('G17 does not export personal or attacker-provided CSV formulas',()=>{
 const result=csv({...data,personal:'PRIVATE@example.com',
 by_source:{...data.by_source,'=HYPERLINK("evil")':{total:1,by_stage:{won:1}},
 meta_ads:{...data.by_source.meta_ads,name:'Private',email:'private@example.com',notes:'SECRET'}}});
 assert.doesNotMatch(result,/PRIVATE|private@example.com|SECRET|HYPERLINK/);
 assert.match(result,/Meta Ads;/);
});

test('G17 avoids exports without valid aggregate data',()=>{
 assert.equal(csv(null),'');
 assert.equal(csv({total:0,by_source:{}}),'');
 assert.equal(csv({total:'bad',by_source:{}}),'');
 assert.doesNotMatch(render({total:0,by_source:{},by_stage:{}}),/data-ed-funnel-export/);
});

test('G17 provides a visible export action only for nonempty reports and no outbound requests',()=>{
 assert.match(render(data),/data-ed-funnel-export/);
 const src=readFileSync(new URL('../public/crm-funnel.js',import.meta.url),'utf8');
 assert.match(src,/URL\.createObjectURL/);
 assert.match(src,/URL\.revokeObjectURL/);
 assert.doesNotMatch(src,/\bfetch\s*\(/);
});
