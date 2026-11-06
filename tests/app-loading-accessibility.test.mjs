import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('CRM application root is not a live region', () => {
  const root = html.match(/<div\\s+id="app"\\b[^>]*>/);
  assert.ok(root);
  assert.doesNotMatch(root[0], /\\baria-live\\s*=/i);
  assert.doesNotMatch(root[0], /\\brole\\s*=\\s*["'](?:status|alert)["']/i);
});

test('initial loading feedback remains accessible without leaking business data', () => {
  assert.match(html, /<div\\s+class="initial-load"\\s+role="status">Cargando Edwin CRM…<\\/div>/);
  assert.doesNotMatch(html, /business_id|tenant_id|customer_email/i);
});
