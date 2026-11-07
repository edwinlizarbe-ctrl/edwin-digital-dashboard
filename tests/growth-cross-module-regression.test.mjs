import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function load(file,exportName){
  const source=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
  const context={URL};
  context.globalThis=context;
  runInNewContext(source,context,{filename:file,timeout:1000});
  assert.ok(context[exportName],file+' must export '+exportName);
  return context[exportName];
}
const health=load('crm-integration-health.js','edwinIntegrationHealth');
const report=load('crm-commercial-report.js','edwinCommercialReport');
const quality=load('crm-quality.js','edwinCrmQuality');
const utm=load('utm-builder.js','edwinUtmBuilder');

test('C50: company switching cannot count another company’s sites or leads',()=>{
  const ctx={
    businessId:A,siteId:'site-b',
    sites:[{id:'site-b',business_id:B}],
    leads:[{id:'private',business_id:B,stage:'won'}],
    businessExists:true,funnelData:null
  };
  assert.equal(health.assess(ctx).siteReady,false);
  assert.equal(health.demo(ctx).ready,false);
  assert.equal(health.demo(ctx).steps[1].status,'Pendiente');
  assert.equal(quality.analyze(ctx.leads,A).total,0);
});
test('C50: authorized connection must not claim real-time data',()=>{
  const result=health.assess({
    businessId:A,sites:[],gaEnabled:true,
    ga4Connection:{connected:true,selected_property_id:'123'},
    gaReportAvailable:true
  });
  assert.equal(result.valid,true);
  assert.ok(result.warnings.some(w=>/no confirma datos en tiempo real/i.test(w)));
});
test('C50: commercial reports filter tenants and disclose partial coverage',()=>{
  const now=new Date('2026-11-04T12:00:00Z');
  const result=report.summarize([
    {business_id:A,stage:'new',source:'organic',created_at:'2026-11-02T00:00:00Z'},
    {business_id:B,stage:'won',source:'meta_ads',created_at:'2026-11-02T00:00:00Z'}
  ],A,{days:7,now,partial:true});
  assert.equal(result.current.total,1);
  assert.equal(result.current.stages.won,0);
  assert.equal(result.partial,true);
  assert.equal(result.comparable,false);
  assert.ok(!report.csv(result).includes('bbbbbbbb'));
});
test('C50: campaign CSV contains no original URL, and neutralizes spreadsheet formulas',()=>{
  const csv=utm.csvTags({
    url:'https://example.com/private-path?token=do-not-export',
    source:'=SUM(1,1)',medium:'cpc',campaign:'testing'
  });
  assert.ok(csv.includes("'=SUM(1,1)"));
  assert.ok(!csv.includes('do-not-export'));
  assert.ok(!csv.includes('private-path'));
  assert.ok(csv.includes('utm_source'));
});
test('C50: accessible navigation stays wired to the content landmark',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/<a class="crm-skip-link" href="#app">Saltar al contenido principal<\/a>/);
  assert.match(html,/<main id="app" tabindex="-1">/);
  assert.doesNotMatch(html,/<main id="app"[^>]*aria-live=/);
  assert.match(html,/<div class="initial-load" role="status">Cargando Edwin CRM…<\/div>/);
});
