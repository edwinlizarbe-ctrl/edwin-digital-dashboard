import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/ui-experience.css', import.meta.url), 'utf8');

test('keyboard focus is visible with forced system colors', () => {
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
  assert.ok(forced.startsWith('@media (forced-colors: active)'));
  assert.match(forced, /:focus-visible/);
  assert.match(forced, /outline:\s*2px solid Highlight\s*;/);
  assert.match(forced, /outline-offset:\s*3px\s*;/);
  assert.match(forced, /box-shadow:\s*none\s*;/);
});

test('reduced-motion and default keyboard focus remain intact', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /outline:\s*2px solid var\(--accent\)/);
});
