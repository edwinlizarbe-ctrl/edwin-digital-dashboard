import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-integration-health.js';

const {assess,render,demo,renderDemo}=globalThis.edwinIntegrationHealth;
const own='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
const site='44444444-4444-4444-8444-444444444444';
const base={businessId:own,userId:user,sites:[{id:site,business_id:own}],
 siteId:site,gaEnabled:true,metaEnabled:true,waEnabled:true,
 ga4Connection:{configured:true,connected:true,selected_property_id:'properties/123'},
 gaReportAvailable:true,gaLoading:false,gaError:'',ga4Error:'',
 meta:{configured:true,connected:true},metaLoading:false,metaError:'',metaReportAvailable:true,
 wa:{configured:true,connected:true},
 businessExists:true,leadsLoading:false,leadsError:'',leadsPartial:false,
 leads:[{id:'lead-1',business_id:own,name:'PRIVATE CUSTOMER',email:'PRIVATE@company.test'}],
 funnelData:{total:1,by_stage:{new:1}}
};

test('C39 summarizes only verified tenant-owned sites and authorized source states',()=>{
 const result=assess(base);
 assert.equal(result.valid,true);
 assert.equal(result.siteReady,true);
 assert.equal(result.gaReady,true);
 assert.equal(result.enabled,4);
 assert.equal(result.verified,4);
 assert.deepEqual(result.checks.map(c=>c.status),['Verificado','Conectada','Conectada','Conectada']);
 const mix=assess({...base,sites:[{id:site,business_id:foreign}],siteId:site});
 assert.equal(mix.siteReady,false);
 assert.equal(mix.verified,3);
 assert.equal(assess({...base,businessId:'invalid'}).valid,false);
});

test('C39 rejects unverified GA4 connection or missing property, and marks excluded features',()=>{
 const pending=assess({...base,ga4Connection:{configured:true,connected:true,selected_property_id:''}});
 assert.equal(pending.gaReady,false);
 assert.equal(pending.checks[1].status,'Sin propiedad seleccionada');
 assert.equal(pending.verified,3);
 const disabled=assess({...base,gaEnabled:false,metaEnabled:false,waEnabled:false});
 assert.equal(disabled.enabled,1);
 assert.equal(disabled.verified,1);
 assert.equal(disabled.checks[1].status,'No incluida');
 assert.equal(disabled.checks[2].status,'No incluida');
 const html=render(disabled.valid?{...base,gaEnabled:false,metaEnabled:false,waEnabled:false}:base);
 assert.match(html,/Diagnóstico de integraciones/);
 assert.match(html,/No incluida/);
});

test('C40 warns when source data freshness is unknown and never labels reporting as live',()=>{
 const linkedNoReport=assess({...base,gaReportAvailable:false,metaReportAvailable:false});
 assert.ok(linkedNoReport.warnings.some(w=>w.includes('no se pudo confirmar información disponible')));
 assert.ok(linkedNoReport.warnings.some(w=>w.includes('no se pudo confirmar un informe reciente')));
 const failed=assess({...base,gaError:'PRIVATE INTERNAL FAILURE',metaError:'TOKEN-SECRET'});
 assert.ok(failed.warnings.some(w=>w.includes('No se puede confirmar la actualidad')));
 assert.ok(failed.warnings.some(w=>w.includes('error de consulta')));
 assert.doesNotMatch(JSON.stringify(failed),/PRIVATE INTERNAL FAILURE|TOKEN-SECRET/);
 const waiting=assess({...base,gaLoading:true,metaLoading:true});
 assert.ok(waiting.warnings.some(w=>w.includes('consulta en curso')));
 const available=assess(base);
 assert.ok(available.warnings.some(w=>w.includes('no confirma datos en tiempo real')));
 assert.ok(available.warnings.some(w=>w.includes('fecha de actualización no está verificada')));
 const page=render(base);
 assert.match(page,/Disponibilidad y actualización de datos/);
 assert.match(page,/no garantiza métricas actuales/);
 assert.doesNotMatch(page,/PRIVATE CUSTOMER|PRIVATE@company.test/);
});

test('C48 commercial demo readiness needs verified opportunities and aggregate report from one business',()=>{
 const ready=demo(base);
 assert.equal(ready.ready,true);
 assert.deepEqual(ready.steps.map(x=>x.status),['Listo','Listo','Listo']);
 const noLeads=demo({...base,leads:[{business_id:foreign,name:'PRIVATE CROSS TENANT'}]});
 assert.equal(noLeads.ready,false);
 assert.equal(noLeads.steps[1].status,'Pendiente');
 assert.equal(noLeads.steps[2].status,'Pendiente');
 const errored=demo({...base,leadsError:'INTERNAL PRIVATE',leads:[]});
 assert.equal(errored.ready,false);
 assert.equal(errored.steps[1].status,'No disponible');
 assert.doesNotMatch(JSON.stringify(errored),/INTERNAL PRIVATE/);
 const loading=demo({...base,leadsLoading:true});
 assert.equal(loading.ready,false);
 assert.equal(loading.steps[1].status,'Comprobando');
 const partial=demo({...base,leadsPartial:true});
 assert.equal(partial.ready,false);
 assert.match(renderDemo({...base,leadsPartial:true}),/muestra de oportunidades es parcial/);
});

test('C48 provides manual navigation and warns before showing real customers',()=>{
 const page=renderDemo(base);
 assert.match(page,/Preparar una demostración comercial/);
 assert.match(page,/data-act="nav" data-page="leads"/);
 assert.match(page,/data-act="nav" data-page="reports"/);
 assert.match(page,/Solicita autorización antes de mostrar contactos reales a terceros/);
 assert.doesNotMatch(page,/PRIVATE CUSTOMER|PRIVATE@company.test/);
});

test('integration-health controls are mounted in authorized app and never contact third parties',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const module=readFileSync(new URL('../public/crm-integration-health.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/crm-integration-health.css',import.meta.url),'utf8');
 assert.match(html,/crm-integration-health\.js\?v=growth-c39-c40-c48-20261104/);
 assert.match(html,/crm-integration-health\.css\?v=growth-c39-c40-c48-20261104/);
 assert.ok(html.indexOf('crm-integration-health.js')<html.indexOf('/app.js'));
 assert.match(app,/edwinIntegrationHealth\?\.render\(integrationHealthContext\(\)\)/);
 assert.match(app,/edwinIntegrationHealth\?\.renderDemo\(integrationHealthContext\(\)\)/);
 assert.match(app,/state\.funnelData=null;state\.funnelError='';state\.funnelLoading=false/);
 assert.match(css,/forced-colors:active/);
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage/);
});
