import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const slice = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));

test('overview composes the executive home and keeps GA4 states', () => {
  const fn = slice('  function overview()', 'function leadSummaryOverview');
  assert.ok(fn.includes('executiveHero()'));
  assert.ok(fn.includes('commercialCenter()'));
  assert.ok(fn.includes('${firstRunPanel()}${ok||state.gaLoading?'));
  assert.ok(fn.includes('mainKpis(true)'));
  assert.ok(fn.includes('salesOverview(true)'));
});

test('hero relies on real GA4 state, never flags', () => {
  const fn = slice('  function executiveHero', '  function commercialCenter');
  assert.match(fn, /gaReady\(\)\?'Google Analytics conectado':state\.gaLoading\?'Cargando Analytics…':'GA4 pendiente'/);
  assert.match(fn, /state\.gaLoading\?'<div class="ed-hero-mini"/);
});

test('opportunities come from state.leads, grouped by currency', () => {
  const fn = slice('  function edLeadStats', '  function executiveHero');
  assert.match(fn, /state\.leads/);
  assert.match(fn, /l\.stage==='new'/);
  assert.match(fn, /'contacted'/);
  assert.match(fn, /totals\[cur\]/);
  assert.match(fn, /state\.leadsLoading/);
  assert.match(fn, /state\.leadsError/);
});

test('quick actions navigate to leads, integrations, reports and sites', () => {
  const fn = slice('  function commercialCenter', '  function overview()');
  for (const page of ['leads', 'integrations', 'reports', 'company']) assert.ok(fn.includes(`['${page}'`), page);
  assert.ok(fn.includes('data-act="nav" data-page="${page}"'));
});

test('dynamic values are sanitized with clean(), money() and fmt()', () => {
  const fn = slice('  function edLeadStats', '  function overview()');
  assert.match(fn, /clean\(money\(t,c\)\)/);
  assert.match(fn, /clean\(pr\.title\)/);
  assert.match(fn, /clean\(displayBusiness\(\)\)/);
  assert.match(fn, /fmt\(/);
  assert.doesNotMatch(fn, /\$\{pr\.title\}|\$\{name\}/);
});

test('sales stay honest: compact note, no empty KPI cells on home', () => {
  const fn = slice('  function salesOverview', '  function sales()');
  assert.match(fn, /compact/);
  assert.match(fn, /no se cuentan como ventas confirmadas/);
  assert.ok(src.includes("salesOverview()}<div class=\"content-grid\"><div class=\"col-12\">${card('Estado de las fuentes de ventas'"));
});

test('styles are isolated, responsive, dark and motion-safe; login untouched', () => {
  const block = css.slice(css.indexOf('Home ejecutivo'));
  assert.ok(block.includes('[data-theme=dark] .ed-hero'));
  assert.ok(block.includes('max-width:480px'));
  assert.ok(block.includes('max-width:768px'));
  assert.ok(block.includes('prefers-reduced-motion'));
  assert.ok(block.includes(':focus-visible'));
  const selectors = block.match(/^[^@{}\n][^{]*(?=\{)/gm).join(',');
  assert.doesNotMatch(selectors, /login|auth-/);
});

test('cache-bust updated in index.html', () => {
  assert.ok(html.includes('style.css?v=edwin-crm-executive-home-20261023'));
  assert.match(html, /app\\.js\\?v=[a-z0-9-]{8,}/);\n  assert.ok(html.includes('ui-experience.css?v=ui-workflow-20261030'));
});
