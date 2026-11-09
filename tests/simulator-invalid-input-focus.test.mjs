import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../public/crm-followup-simulator.html',import.meta.url),'utf8');

test('positivo: errores enfocan el campo inválido y lo anuncian',()=>{
  assert.match(page,/role="alert"/);
  assert.match(page,/invalid\.setAttribute\('aria-invalid','true'\)/);
  assert.match(page,/invalid\.focus\(\)/);
  assert.match(page,/invalid\.setAttribute\('aria-describedby',invalid\.id\+'-help error'\)/);
});
test('negativo: distingue prospectos inválidos de porcentajes inválidos',()=>{
  assert.match(page,/!Number\.isSafeInteger\(leads\.valueAsNumber\)\|\|leads\.valueAsNumber<0\|\|leads\.valueAsNumber>100000\?leads:percent/);
  assert.match(page,/leads\.removeAttribute\('aria-invalid'\);percent\.removeAttribute\('aria-invalid'\)/);
});
test('aislamiento: simulador no envía datos ni almacena cifras',()=>{
  assert.doesNotMatch(page,/(?:fetch\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.sendBeacon)/);
  assert.match(page,/content="noindex, nofollow"/);
});
