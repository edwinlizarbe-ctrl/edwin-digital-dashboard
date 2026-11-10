import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const demo = readFileSync(new URL('../public/crm-demo.html', import.meta.url), 'utf8');

test('positive: stage rows wrap instead of clipping on narrow screens', () => {
  assert.match(demo, /\.stage-top\{[^}]*display:flex;[^}]*flex-wrap:wrap;[^}]*overflow-wrap:anywhere/);
  assert.match(demo, /\.stage-top>\*\{min-width:0\}/);
  assert.match(demo, /@media\(max-width:390px\)/);
});

test('negative: no fixed stage width or horizontal overflow is introduced', () => {
  assert.doesNotMatch(demo, /\.stage-top\{[^}]*white-space:nowrap/);
  assert.doesNotMatch(demo, /\.stage-top\{[^}]*min-width:\s*\d+px/);
  assert.doesNotMatch(demo, /overflow-x:\s*(?:scroll|auto)/);
});

test('isolation: demo remains synthetic and has no commercial payment or external calls', () => {
  assert.match(demo, /DATOS 100% FICTICIOS/);
  assert.match(demo, /DEMO_BUSINESS_ID/);
  assert.doesNotMatch(demo, /\bfetch\s*\(|XMLHttpRequest|<form\b|checkout|stripe\.com/i);
});
