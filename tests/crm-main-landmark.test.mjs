import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('CRM has one semantic main landmark matching keyboard skip link', () => {
  assert.match(html, /<a\b[^>]*class="crm-skip-link"[^>]*href="#app"/);
  assert.match(html, /<main\b[^>]*id="app"[^>]*tabindex="-1"/);
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.equal((html.match(/<\/main>/g) || []).length, 1);
});

test('initial loading status stays inside the main landmark', () => {
  assert.match(html, /<main\b[^>]*id="app"[^>]*>\s*<div class="initial-load" role="status">[\s\S]*?<\/div>\s*<\/main>/);
});
