import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');

test('positivo: navegación lleva al alcance disponible y pendiente', () => {
  assert.match(html, /<nav class="top-nav" aria-label="Navegación comercial">[\s\S]*?<a href="#alcance">Disponibilidad<\/a>/);
  assert.match(html, /<section class="content expectations" id="alcance">/);
  assert.match(html, /Aún no disponible para contratar aquí/);
});
test('negativo: no afirma pagos o alta pública habilitados', () => {
  assert.doesNotMatch(html, />Contratar ahora<|>Pagar ahora<|>Registro abierto</i);
  assert.match(html, /Pago recurrente y activación automática/);
});
test('aislamiento: navegación interna no solicita datos ni introduce red', () => {
  assert.doesNotMatch(html, /<form\b|<input\b|<script\b|fetch\s*\(|XMLHttpRequest/i);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
