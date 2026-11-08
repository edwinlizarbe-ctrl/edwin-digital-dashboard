import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-followup-simulator.html', import.meta.url), 'utf8');

test('positivo: error se asocia al campo inválido junto a su ayuda', () => {
  assert.match(html, /<p class="error" id="error" role="alert"><\/p>/);
  assert.match(html, /invalid\.setAttribute\('aria-invalid','true'\)/);
  assert.match(html, /invalid\.setAttribute\('aria-describedby',invalid\.id\+'-help error'\)/);
  assert.match(html, /invalid\.focus\(\)/);
});

test('negativo: después de corregir, no queda un error asociado', () => {
  assert.match(html, /leads\.setAttribute\('aria-describedby','leads-help'\);percent\.setAttribute\('aria-describedby','percent-help'\)/);
  assert.match(html, /error\.textContent=''/);
  assert.match(html, /leads\.removeAttribute\('aria-invalid'\);percent\.removeAttribute\('aria-invalid'\)/);
});

test('aislamiento: error no introduce almacenamiento ni peticiones', () => {
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
