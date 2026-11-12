import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('positive: metrics container and generated cards have list semantics', () => {
  assert.match(page, /<div class="cards" id="cards" role="list" aria-label="Métricas simuladas"><\/div>/);
  assert.match(page, /article\.setAttribute\('role','listitem'\);article\.append\(heading,strong\)/);
});

test('negative: list items are not decorative or hidden from assistive technology', () => {
  assert.doesNotMatch(page, /id="cards"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(page, /article\.setAttribute\('aria-hidden','true'\)/);
});

test('isolation: synthetic demo still uses local fixture without CRM API or external scripts', () => {
  assert.match(page, /import \{demoInsights, DEMO_BUSINESS_ID\} from '\.\/crm-demo-data\.js'/);
  assert.doesNotMatch(page, /<script[^>]+src="https?:\/\//);
  assert.doesNotMatch(page, /fetch\s*\(\s*['"`]\/api\/crm/);
});
