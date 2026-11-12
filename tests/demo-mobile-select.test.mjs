import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');
const selectorRule = html.match(/select\{[^}]+\}/)?.[0] ?? '';

test('positive: scenario selector stays within available width', () => {
  assert.match(selectorRule, /max-width:\s*100%/);
  assert.match(selectorRule, /min-width:\s*0/);
});
test('negative: fixed minimum width cannot force horizontal overflow', () => {
  assert.doesNotMatch(selectorRule, /min-width:\s*170px/);
});
test('isolation: demo remains synthetic without private CRM calls', () => {
  assert.match(html, /DEMO_BUSINESS_ID/);
  assert.match(html, /DATOS 100% FICTICIOS/);
  assert.doesNotMatch(html, /fetch\s*\(/);
});
