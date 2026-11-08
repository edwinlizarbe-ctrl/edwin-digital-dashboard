import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
const nav = landing.match(/<nav class="top-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';

test('commercial navigation offers a direct link to the synthetic demo', () => {
  assert.match(nav, /<a href="\/crm-demo\.html">Ver demo<\/a>/);
  assert.match(landing, /<main\s+id="contenido"\s+tabindex="-1">/);
  assert.match(landing, /href="#contenido"/);
});

test('demo navigation never points to a payment or signup flow', () => {
  assert.doesNotMatch(nav, /href="[^"]*(?:checkout|subscribe|billing|signup|pago)/i);
  assert.match(landing, /La demostración utiliza datos ficticios/);
});

test('public commercial landing stays isolated from PII capture and trackers', () => {
  assert.doesNotMatch(landing, /<form\b|<input\b|<script\b|<iframe\b/i);
  assert.doesNotMatch(landing, /stripe\.com|paypal\.com|googletagmanager\.com|facebook\.net/i);
  assert.match(landing, /<meta name="robots" content="noindex, nofollow">/);
  assert.ok(demo.includes('html'), 'demo route source exists');
});
