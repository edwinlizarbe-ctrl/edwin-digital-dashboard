import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';

test('demo sin JavaScript oculta controles y secciones de resultados vacíos', () => {
  assert.match(fallback, /\.selector[^}]*display:none!important/);
  for (const id of ['metrics-title', 'stages-title', 'action-title']) {
    assert.ok(fallback.includes('section[aria-labelledby="' + id + '"]'));
  }
  assert.match(fallback, /necesita JavaScript/);
  assert.match(fallback, /role="alert"/);
});

test('la demo conserva navegación y renderizado cuando JavaScript está habilitado', () => {
  assert.match(html, /href="\/edwin-crm\.html"/);
  assert.match(html, /href="\/crm-followup-simulator\.html"/);
  assert.match(html, /function render\(\)/);
  assert.match(html, /select\.addEventListener\('change'/);
  assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/, '').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '', /\.selector[^}]*display:none!important/);
});

test('el fallback es local, sin captación ni acceso a empresas', () => {
  assert.doesNotMatch(fallback, /<script|<form|fetch\s*\(|localStorage|sessionStorage|supabase|checkout|business_id/i);
  assert.match(html, /DATOS 100% FICTICIOS/);
});
