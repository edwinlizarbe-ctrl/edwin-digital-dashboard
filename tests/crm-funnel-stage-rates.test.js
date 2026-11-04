import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/crm-funnel.js';

const render = globalThis.edwinCrmFunnel.render;
test('G02 reports stage distribution per channel using each channel as denominator', () => {
 const html = render({total:4,by_stage:{new:2,won:2},won_share_percent:50,partial:false,
  by_source:{organic:{total:3,by_stage:{new:2,won:1},won_share_percent:33.3},
             whatsapp:{total:1,by_stage:{won:1},won_share_percent:100}}});
 assert.match(html, /Nuevo \(% del canal\)/);
 assert.match(html, /66,7 %/);
 assert.match(html, /33,3 %/);
 assert.match(html, /50 % del total/);
 assert.match(html, /no sobre transiciones históricas/);
});
test('G02 zero channel counts and untrusted labels never produce NaN or PII', () => {
 const html=render({total:1,by_stage:{new:1},by_source:{
  organic:{total:0,by_stage:{won:1}},
  google_ads:{total:1,by_stage:{new:1},won_share_percent:0},
  'private@example.com':{total:1,by_stage:{won:1}}},partial:false});
 assert.doesNotMatch(html,/NaN|Infinity|private@example.com/);
 assert.match(html,/100 %/);
});
test('G02 partial sample stays disclosed alongside stage rates',()=>{
 const html=render({total:1000,by_stage:{new:1000},by_source:{organic:{total:1000,by_stage:{new:1000}}},partial:true});
 assert.match(html,/Vista parcial/);
 assert.match(html,/100 % del total/);
});
