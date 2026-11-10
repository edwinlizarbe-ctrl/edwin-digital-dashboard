import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
const render = html.slice(html.indexOf('    function render(){'), html.indexOf("    select.addEventListener('change'"));
const success = render.slice(render.indexOf('      try{'), render.indexOf('      }catch{'));
const failure = render.slice(render.indexOf('      }catch{'));

test('positivo: el contexto imprimible solo se actualiza al generar correctamente el escenario', () => {
  assert.match(success, /rates\.textContent=[^;]+;\s*updatePrintContext\(\);\s*return true;/);
  assert.match(html, /class="print-context"/);
});
test('negativo: un error de cálculo no conserva un escenario aparentemente válido para impresión', () => {
  assert.doesNotMatch(render.slice(0, render.indexOf('      try{')), /updatePrintContext\(\)/);
  assert.match(failure, /printScenario\.textContent='Escenario no disponible para imprimir\.[^']+';/);
  assert.match(failure, /return false;/);
});
test('aislamiento: la demo continúa siendo ficticia y sin red, formularios ni cobros', () => {
  assert.match(html, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
  assert.match(html, /DATOS 100% FICTICIOS/);
  assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|<form\b|localStorage|checkout|stripe\.com/i);
});
