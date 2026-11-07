import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const faqRule = page.match(/\.faq summary\{([^}]*)\}/)?.[1] ?? '';

test('FAQ disclosure has a 44px minimum touch target', () => {
  assert.match(faqRule, /min-height:\s*44px/);
  assert.match(faqRule, /display:\s*flex/);
  assert.match(faqRule, /align-items:\s*center/);
});
test('FAQ remains keyboard operable with visible focus', () => {
  assert.match(page, /\.faq summary:focus-visible\{[^}]*outline:/);
  assert.match(page, /<details[\s>]/);
  assert.match(page, /<summary[\s>]/);
});
test('commercial landing stays isolated from capture, payments and tracking', () => {
  assert.doesNotMatch(page, /<form\b|<input\b|<script\b|<iframe\b/i);
  assert.doesNotMatch(page, /stripe\.com|paypal\.com|googletagmanager\.com|facebook\.net/i);
  assert.match(page, /<meta name="robots" content="noindex, nofollow">/);
});
