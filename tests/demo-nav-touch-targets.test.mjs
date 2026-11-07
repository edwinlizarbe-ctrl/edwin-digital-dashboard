import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('demo: navigation links have 44px minimum touch targets', () => {
  assert.match(html, /\.nav a\{[^}]*min-height:44px;[^}]*\}/);
  assert.match(html, /<nav class="nav" aria-label="Navegación de la demostración">/);
  assert.match(html, /href="\/edwin-crm\.html"/);
});

test('demo: keyboard focus remains visible and skip link targets main', () => {
  assert.match(html, /a:focus-visible[^\{]*\{outline:3px solid/);
  assert.match(html, /href="#demo-content"/);
  assert.match(html, /<main id="demo-content" tabindex="-1">/);
});

test('demo: navigation enhancement does not expose checkout or external trackers', () => {
  assert.match(html, /content="noindex, nofollow"/);
  assert.doesNotMatch(html, /<form\b|<iframe\b|checkout|stripe\.com|google-analytics\.com|facebook\.com\/tr\?/i);
  assert.match(html, /DATOS 100% FICTICIOS/);
});
