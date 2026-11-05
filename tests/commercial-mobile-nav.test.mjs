import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const nav = html.match(/<nav class="top-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
const mobile = html.match(/@media\(max-width:780px\)\{([^\n]+)\}/)?.[1];

test('móvil conserva visibles los accesos a producto, audiencia, FAQ y clientes', () => {
  assert.ok(nav);
  for (const href of ['#como-funciona', '#para-quien', '#preguntas', '/']) {
    assert.ok(nav.includes('href="' + href + '"'), 'falta ' + href);
  }
  assert.ok(mobile);
  assert.match(mobile, /display:inline-flex/);
  assert.doesNotMatch(mobile, /display:none/);
  assert.match(mobile, /min-height:44px/);
});

test('enlaces internos de navegación apuntan a secciones reales', () => {
  for (const [, target] of nav.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes('id="' + target + '"'), 'ancla inexistente ' + target);
  }
});

test('fallo controlado: detecta una sección inexistente', () => {
  const broken = nav.replace('href="#preguntas"', 'href="#inexistente"');
  assert.ok([...broken.matchAll(/href="#([^"]+)"/g)].some(([, target]) => !html.includes('id="' + target + '"')));
});

test('cambio de navegación no consulta empresas ni expone información de tenants', () => {
  assert.doesNotMatch(nav, /business_id|supabase|fetch\s*\(|localStorage|sessionStorage/i);
  assert.doesNotMatch(html, /<script\b/i);
});
