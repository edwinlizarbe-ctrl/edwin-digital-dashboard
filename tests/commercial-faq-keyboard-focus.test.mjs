import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');

test('commercial FAQ provides a visible keyboard-only focus indicator', () => {
  assert.match(html, /\.faq\s+summary:focus-visible\s*\{[^}]*outline\s*:\s*3px\s+solid\s+#[0-9a-f]{6}/i);
  assert.match(html, /<summary\b[^>]*>/i);
});

test('FAQ focus indicator does not rely on hover or remove outlines', () => {
  assert.doesNotMatch(html, /\.faq\s+summary:focus-visible\s*\{[^}]*outline\s*:\s*(?:none|0)(?:\s*[;}])/i);
  assert.doesNotMatch(html, /\.faq\s+summary:hover\s*\{[^}]*outline/i);
});

test('commercial landing remains private and does not include tenant identifiers', () => {
  assert.match(html, /<meta\s+name="robots"\s+content="noindex, nofollow"/i);
  assert.doesNotMatch(html, /\b(?:business_id|tenant_id|company_id)\b/i);
});
