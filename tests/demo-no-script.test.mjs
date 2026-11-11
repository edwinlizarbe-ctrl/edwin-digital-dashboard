import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
test('sin JavaScript informa cómo continuar con la demo', () => {
  assert.match(html, /<noscript>(?:<style>[\s\S]*?<\/style>)?<p class="explanation" role="alert">[^<]*JavaScript[^<]*<\/p><\/noscript>/);
  assert.match(html, /Actívalo en tu navegador o vuelve a la presentación comercial/);
});
test('no se ofrecen resultados reales ni formularios sin JavaScript', () => {
  const notice = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1];
  assert.ok(notice);
  assert.doesNotMatch(notice, /<form|<input|<script|<iframe|https?:\/\//i);
  assert.match(html, /DATOS 100% FICTICIOS/);
});
test('el aviso no altera el selector ni la renderización de escenarios', () => {
  assert.match(html, /<select id="scenario" name="scenario">/);
  assert.match(html, /select\.addEventListener\('change'/);
  assert.match(html, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
});
