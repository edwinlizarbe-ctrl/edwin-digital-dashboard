import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');

test('commercial skip link targets a keyboard-focusable main landmark', () => {
  assert.match(html, /<a class="skip" href="#contenido">Saltar al contenido<\/a>/);
  assert.match(html, /<main id="contenido" tabindex="-1">/);
  assert.match(html, /\.skip:focus\{top:12px\}/);
});

test('skip target is not inserted into normal tab order or disabled', () => {
  assert.doesNotMatch(html, /<main[^>]*tabindex="(?:0|[1-9][0-9]*)"/);
  assert.doesNotMatch(html, /<main[^>]*(?:inert|aria-hidden="true")/);
  assert.match(html, /a:focus-visible\{outline:3px solid/);
});

test('commercial accessibility change keeps pilot private and without checkout or tracking', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /Aún no disponible para contratar aquí/);
  assert.doesNotMatch(html, /<form\b|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/i);
});
