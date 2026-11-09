import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
const printCss = page.match(/@media print\{([^}]|\}[^@])*\}/)?.[0] ?? '';

test('positivo: la impresión conserva contexto y oculta controles no operativos', () => {
  assert.match(printCss, /\.selector,\.nav,\.skip-link\{display:none!important\}/);
  assert.match(printCss, /\.print-context\{display:block!important\}/);
  assert.match(page, /id="print-scenario" class="print-context"/);
});

test('negativo: los controles siguen disponibles fuera de la impresión', () => {
  assert.match(page, /<label for="scenario">/);
  assert.match(page, /<select id="scenario" name="scenario">/);
  assert.match(page, /<button id="reset" type="button">/);
  assert.doesNotMatch(page.slice(0, page.indexOf('@media print')), /\.selector\{display:none!important\}/);
});

test('aislamiento: no altera escenarios ni introduce conexiones a datos reales', () => {
  assert.match(page, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
  assert.match(page, /DATOS 100% FICTICIOS/);
  assert.doesNotMatch(page, /\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});
