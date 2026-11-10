import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('positivo: al fallar el escenario se anuncia el error accesiblemente', () => {
  assert.match(html, /id="scenario-announcement"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /announcement\.textContent='No se pudo actualizar el ejemplo ficticio\. Intenta restablecerlo\.'/);
  assert.match(html, /rates\.textContent='';\s*printScenario\.textContent='Escenario no disponible para imprimir\.[^']+';\s*announcement\.textContent=[^;]+;\s*return false;/);
});

test('negativo: no se anuncia actualización exitosa tras fallo', () => {
  assert.match(html, /if\(render\(\)\) announceScenario\(\)/);
  assert.doesNotMatch(html, /render\(\);announceScenario\(\)/);
});

test('aislamiento: sin conexiones, datos reales, formularios ni cobros', () => {
  assert.match(html, /demoInsights\(DEMO_BUSINESS_ID,select\.value\)/);
  assert.match(html, /DATOS 100% FICTICIOS/);
  assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|<form\b|localStorage|checkout|stripe\.com/i);
});
