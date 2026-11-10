import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');

test('positivo: el acceso se presenta como privado y es accesible', () => {
  assert.match(html, /<a class="header-link" href="\/" aria-label="Acceso privado al CRM para cuentas habilitadas">Entrar \(cuentas habilitadas\)<\/a>/);
  assert.match(html, /<nav class="top-nav" aria-label="Navegación comercial">/);
});
test('negativo: no invita al registro abierto ni anuncia acceso inmediato', () => {
  assert.doesNotMatch(html, />Acceso a clientes<\/a>|>Registrarse gratis<\/a>|>Comenzar prueba gratis<\/a>/i);
  assert.match(html, /Prueba pública de autoservicio sin validación de producción/);
});
test('aislamiento: la presentación no recoge datos ni ofrece pagos', () => {
  assert.doesNotMatch(html, /<form\b|<input\b|fetch\s*\(|XMLHttpRequest|checkout|<script\b/i);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
