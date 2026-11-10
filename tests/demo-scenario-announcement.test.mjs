import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('positive: scenario changes and reset announce updated fictional data', () => {
  assert.match(html, /id="scenario-announcement"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /select\.addEventListener\('change',\(\)=>\{if\(render\(\)\) announceScenario\(\);\}\)/);
  assert.match(html, /reset\.addEventListener\('click',\(\)=>\{select\.value='inicio';if\(render\(\)\) announceScenario\(\);select\.focus\(\);\}\)/);
});
test('negative: no invented real performance or auto-selected scenario announcement', () => {
  assert.match(html, /Datos ficticios actualizados/);
  assert.doesNotMatch(html, /ventas garantizadas|conversiones reales|clientes reales confirmados/i);
  assert.match(html, /    render\(\);\n  <\/script>/);
});
test('isolation: demo keeps privacy controls and does not introduce remote writes', () => {
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /DEMO_BUSINESS_ID/);
  assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|<form\b/i);
});
