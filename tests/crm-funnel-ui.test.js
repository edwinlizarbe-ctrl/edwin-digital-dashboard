import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-funnel.js';

const render=globalThis.edwinCrmFunnel.render;
const sourceSummary={total:3,won_share_percent:33.3,by_stage:{new:1,contacted:1,qualified:0,won:1,lost:0},
 by_source:{google_ads:{total:2,by_stage:{new:1,contacted:0,qualified:0,won:1,lost:0},won_share_percent:50},
 organic:{total:1,by_stage:{new:0,contacted:1,qualified:0,won:0,lost:0},won_share_percent:0}},partial:false,sample_limit:1000};

test('G02 renders a descriptive source funnel using only aggregate values',()=>{
 const html=render(sourceSummary);
 assert.match(html,/Embudo por canal/);
 assert.match(html,/Google Ads/);
 assert.match(html,/Orgánico/);
 assert.match(html,/<progress max="100" value="50"/);
 assert.match(html,/Oportunidades analizadas/);
 assert.match(html,/no mide conversiones atribuibles/);
 assert.doesNotMatch(html,/vista parcial/i);
 assert.doesNotMatch(html,/private@example.com/);
});

test('G02 discloses partial data and does not pretend a full company history',()=>{
 const html=render({...sourceSummary,partial:true,total:1000});
 assert.match(html,/Vista parcial/);
 assert.match(html,/1.000 oportunidades más recientes/);
 assert.match(html,/historial completo/);
});

test('G02 provides an honest empty state without inventing conversions',()=>{
 const html=render({total:0,won_share_percent:0,by_stage:{},by_source:{},partial:false});
 assert.match(html,/Todavía no hay oportunidades/);
 assert.doesNotMatch(html,/Google Ads<\/th>/);
 assert.match(html,/0 % general/);
});

test('G02 ignores untrusted source labels, weird numbers and injected content',()=>{
 const html=render({total:2,won_share_percent:Infinity,by_stage:{new:-2,won:'9000000'},
  by_source:{evil:{total:5,by_stage:{won:4},won_share_percent:80},
   meta_ads:{total:2,by_stage:{won:1},won_share_percent:150}},partial:false});
 assert.doesNotMatch(html,/evil/);
 assert.doesNotMatch(html,/9000000/);
 assert.doesNotMatch(html,/Infinity/);
 assert.match(html,/Meta Ads/);
 assert.match(html,/max="100" value="100"/);
});

test('G02 preserves CRM lead list when report fails',()=>{
 const failed=render(null,{error:'upstream error'});
 assert.match(failed,/registro de contactos sigue funcionando/);
 assert.doesNotMatch(failed,/upstream error/);
 const loading=render(null,{loading:true});
 assert.match(loading,/Calculando oportunidades/);
});

test('G02 is loaded from the dashboard and requested independently from contact listing',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(index,/crm-funnel\.js\?v=growth-g17-20261104/);
 assert.match(index,/crm-funnel\.css\?v=growth-g17-20261104/);
 assert.ok(index.indexOf('crm-funnel.js')<index.indexOf('/app.js'));
 assert.match(app,/Promise\.allSettled\(\[/);
 assert.match(app,/api\/crm\/leads\/funnel\?business_id=/);
 assert.match(app,/funnelPanel\+/);
 assert.match(app,/crmImportPanel\(\)/);
});
