import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const faq = html.match(/<details><summary>¿Cuál es el primer paso para conocerlo\?<\/summary><p>(.*?)<\/p><\/details>/)?.[1];

test('positivo: FAQ dirige a demo ficticia existente', () => {
  assert.ok(faq);
  assert.match(faq, /<a href="\/crm-demo\.html">[^<]+<\/a>/);
  assert.match(faq, /<a href="\/crm-followup-simulator\.html">[^<]+<\/a>/);
});
test('negativo: FAQ no dirige a registro o checkout', () => {
  assert.doesNotMatch(faq, /signup|checkout|suscrib|pagar|href="\/"/i);
});
test('aislamiento: enlace no captura datos ni activa servicios', () => {
  assert.doesNotMatch(html, /<form\b|<input\b|fetch\s*\(|XMLHttpRequest|<script\b/i);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
