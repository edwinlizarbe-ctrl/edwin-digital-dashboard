import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('positivo: regreso a la presentación tras explorar la demo', () => {
  assert.match(html, /<p class="demo-next"><a href="\/edwin-crm\.html">← Volver a la presentación de Edwin CRM<\/a><\/p>/);
  assert.ok(html.indexOf('class="demo-next"') > html.indexOf('<strong>Limitaciones:'));
});

test('negativo: no introduce alta pública, checkout ni CTA de pago', () => {
  const next = html.match(/<p class="demo-next">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(next);
  assert.doesNotMatch(next, /checkout|suscri|pagar|registr|https?:|target=/i);
});

test('aislamiento: mantiene datos ficticios y no añade formularios ni solicitudes', () => {
  assert.match(html, /DATOS 100% FICTICIOS/);
  assert.match(html, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
  assert.doesNotMatch(html, /<form\b|fetch\(|XMLHttpRequest|localStorage|sessionStorage/i);
});
