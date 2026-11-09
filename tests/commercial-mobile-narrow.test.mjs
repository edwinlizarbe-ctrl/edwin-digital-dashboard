import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const narrow = page.match(/@media\(max-width:390px\)\{[^\n]+/)?.[0] ?? '';

test('positivo: enlaces y CTA se ajustan en pantallas estrechas', () => {
  assert.match(narrow, /\.top-nav a\{overflow-wrap:anywhere\}/);
  assert.match(narrow, /\.header-link\{max-width:100%;text-align:center\}/);
  assert.match(narrow, /\.cta\{max-width:100%;overflow-wrap:anywhere;text-align:center\}/);
});

test('negativo: no se ocultan enlaces ni se impide el foco por teclado', () => {
  assert.doesNotMatch(narrow, /display:none|visibility:hidden|pointer-events:none|outline:none/);
  assert.match(page, /a:focus-visible\{outline:3px solid/);
  assert.match(page, /href="\/crm-demo\.html"/);
});

test('aislamiento: solo CSS móvil, sin captación ni cambios de autenticación', () => {
  assert.match(narrow, /^@media\(max-width:390px\)/);
  assert.doesNotMatch(page, /<form\b|\bfetch\s*\(|XMLHttpRequest|<script\b/);
  assert.match(page, /Aún no disponible para contratar aquí/);
});
