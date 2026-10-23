import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('visible branding says Edwin CRM in login, signup and onboarding', () => {
  assert.ok(src.includes('<span class="crm-text-logo">Edwin CRM</span>'));
  assert.ok(src.includes('© Edwin CRM · Plataforma de negocios'));
  assert.ok(src.includes('Empieza con Edwin CRM'));
  assert.ok(src.includes('BIENVENIDO A EDWIN CRM'));
});

test('first-run panel uses real nav actions and is skipped with GA4 or loading', () => {
  const fn = src.slice(src.indexOf('function firstRunPanel'), src.indexOf('function salesOverview'));
  assert.match(fn, /if\(gaReady\(\)\|\|state\.gaLoading\)return ''/);
  // Los botones se renderizan desde la lista de pasos, no se codifican por separado.
  assert.match(fn, /data-act="nav" data-page="\\$\\{step\\.page\\}"/);
  assert.match(fn, /page:'integrations'/);
  assert.match(fn, /page:'leads'/);
  assert.match(fn, /No mostramos datos de prueba/);
  assert.match(fn, /featureEnabled\('ga4'\)/);
});

test('overview renders KPIs only when GA4 is ready or loading', () => {
  assert.ok(src.includes('${firstRunPanel()}${ok||state.gaLoading?'));
});
