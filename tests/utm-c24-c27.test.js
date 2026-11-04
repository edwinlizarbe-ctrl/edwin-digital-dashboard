import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/utm-builder.js';

const lib=globalThis.edwinUtmBuilder;
const base={url:'https://empresa.pe/landing?ref=socio#contacto',source:'meta',medium:'paid_social',campaign:'cyber_wow'};

test('C24 provides bounded, safe medium presets without affecting existing URL parameters',()=>{
 const expected=['cpc','paid_social','email','organic_social','referral'];
 assert.deepEqual(Object.keys(lib.mediumPresets),expected);
 for(const name of expected){
  assert.equal(lib.presetMedium(name),name);
  const built=new URL(lib.build({...base,medium:lib.presetMedium(name)}));
  assert.equal(built.searchParams.get('utm_medium'),name);
  assert.equal(built.searchParams.get('ref'),'socio');
  assert.equal(built.hash,'#contacto');
  assert.match(lib.render(),new RegExp('data-ed-utm-medium="'+name+'"'));
 }
 for(const bad of [null,'','__proto__','<script>','constructor',{}])
  assert.throws(()=>lib.presetMedium(bad),/Medio predefinido no válido/);
 assert.equal(base.medium,'paid_social','preset building must not mutate caller data');
});

test('C25 identifies only missing required URL and campaign fields without copying user input',()=>{
 assert.deepEqual(lib.missingRequired({}),['URL HTTPS','origen','medio','campaña']);
 assert.deepEqual(lib.missingRequired({url:'  ',source:'meta',medium:'',campaign:'x'}),['URL HTTPS','medio']);
 assert.deepEqual(lib.missingRequired(base),[]);
 const html=lib.render();
 assert.match(html,/id="ed-utm-required"/);
 assert.match(html,/Por completar: URL HTTPS, origen, medio, campaña/);
 assert.match(html,/aria-live="polite"/);
 assert.doesNotMatch(html,/utm_source=<script>/);
 assert.throws(()=>lib.build({...base,source:''}),/Completa origen, medio y campaña/);
});

test('C26 normalizes human campaign names into predictable UTM labels',()=>{
 for(const [raw,expected] of [
  ['Cyber WOW Noviembre','cyber_wow_noviembre'],
  [' Día del Niño Brasil 2026! ','dia_del_nino_brasil_2026'],
  ['CAMPAÑA / TEST  A-B','campana_test_a_b'],
  ['Brand+Retargeting 05','brand_retargeting_05']
 ])assert.equal(lib.normalizeCampaignName(raw),expected);
 for(const bad of ['', '   ', '---', '🔥', 'x'.repeat(201), '	alert'])assert.throws(()=>lib.normalizeCampaignName(bad));
 assert.equal(lib.normalizeCampaignName('A'.repeat(140)).length,100);
 const link=new URL(lib.build({...base,campaign:lib.normalizeCampaignName('Cyber WOW Noviembre')}));
 assert.equal(link.searchParams.get('utm_campaign'),'cyber_wow_noviembre');
 const html=lib.render();
 assert.match(html,/data-ed-utm-normalize/);
 assert.match(html,/Normalizar nombre de campaña/);
});

test('C27 shows only a safe local HTTPS destination preview and valid UTM labels',()=>{
 const generated=lib.build({...base,term:'botas'});
 const p=lib.preview(generated);
 assert.deepEqual(p,{
  destination:'empresa.pe',route:'/landing',labels:['source','medium','campaign','term'],fragment:true
 });
 assert.equal(lib.preview(''),null);
 assert.throws(()=>lib.preview('http://example.com'));
 assert.throws(()=>lib.preview('https://username:password@example.com'));
 const html=lib.render();
 assert.match(html,/id="ed-utm-preview"/);
 assert.match(html,/La vista previa del destino y las etiquetas aparecerá/);
});

test('C24-C27 buttons are wired to the same local form without external requests',()=>{
 const script=readFileSync(new URL('../public/utm-builder.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(script,/medium\.value=presetMedium\(mediumButton\.dataset\.edUtmMedium\);update\(form\)/);
 assert.match(script,/campaign\.value=normalizeCampaignName\(campaign\.value\);update\(form\)/);
 assert.match(script,/previewLabel\.textContent='Destino:/);
 assert.match(index,/utm-builder\.js\?v=growth-c28-20261104/);
 assert.match(index,/utm-builder\.css\?v=growth-c28-20261104/);
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
});
