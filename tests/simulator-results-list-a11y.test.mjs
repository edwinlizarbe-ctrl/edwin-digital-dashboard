import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/crm-followup-simulator.html',import.meta.url),'utf8');

test('positivo: las tres cifras se anuncian como elementos de una lista identificada',()=>{
  assert.match(html,/<div class="cards" id="results" role="list" aria-label="Tres cifras estimadas" aria-live="polite"><\/div>/);
  assert.match(html,/article\.setAttribute\('role','listitem'\)/);
  assert.equal((html.match(/show\('(Prospectos del ejemplo|Con primer contacto estimado|Sin contactar estimados)'/g)||[]).length,3);
});

test('negativo: la región conserva el aviso de recálculo y no usa alertas intrusivas para resultados',()=>{
  assert.match(html,/id="explanation"[^>]*role="status" aria-live="polite"/);
  assert.match(html,/results\.replaceChildren\(\);/);
  assert.doesNotMatch(html,/id="results"[^>]*role="alert"/);
});

test('aislamiento: la página no agrega captación, persistencia ni envíos de red',()=>{
  assert.doesNotMatch(html,/(?:fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|<form[^>]*action=)/i);
  assert.match(html,/import \{followupEstimate\} from '\.\/crm-followup-estimate\.js'/);
});
