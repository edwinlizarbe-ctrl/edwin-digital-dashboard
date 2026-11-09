import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('impresión identifica el escenario ficticio seleccionado', () => {
  assert.match(page, /id="print-scenario" class="print-context"/);
  assert.match(page, /Escenario impreso: Negocio que comienza\. Datos ficticios/);
  assert.match(page, /const updatePrintContext=\(\)=>\{printScenario\.textContent='Escenario impreso: '\+select\.options\[select\.selectedIndex\]\.textContent/);
  assert.match(page, /function render\(\)\{\s*updatePrintContext\(\);/);
  assert.match(page, /@media print\{[^}]*\.print-context\{display:block!important\}/);
});

test('no muestra el contexto de impresión durante navegación normal', () => {
  assert.match(page, /\.print-context\{display:none\}/);
  assert.doesNotMatch(page, /\.print-context\{display:block\}(?!important)/);
});

test('aislamiento: conserva datos ficticios y no añade llamadas de red', () => {
  assert.match(page, /DATOS 100% FICTICIOS/);
  assert.match(page, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
  assert.doesNotMatch(page, /\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});
