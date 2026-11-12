import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('../public/crm-followup-simulator.html', import.meta.url), 'utf8');

test('positive: editing either estimate input invalidates previous figures', () => {
  assert.match(page, /leads\.addEventListener\('input',invalidateEstimate\)/);
  assert.match(page, /percent\.addEventListener\('input',invalidateEstimate\)/);
  assert.match(page, /const invalidateEstimate=\(\)=>\{[\s\S]*?results\.replaceChildren\(\)/);
  assert.match(page, /Los valores cambiaron\. Pulsa «Calcular ejemplo»/);
});

test('negative: stale values are cleared without silently recalculating on each keystroke', () => {
  assert.doesNotMatch(page, /addEventListener\('input',calculate\)/);
  assert.match(page, /form\.addEventListener\('submit',event=>\{event\.preventDefault\(\);calculate\(\);\}\)/);
  assert.match(page, /form\.addEventListener\('reset',\(\)=>\{queueMicrotask\(calculate\);\}\)/);
});

test('isolation: local-only estimator does not transmit input or access tenant data', () => {
  assert.match(page, /import \{followupEstimate\} from '\.\/crm-followup-estimate\.js'/);
  assert.doesNotMatch(page, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage/);
  assert.doesNotMatch(page, /<script[^>]+src="https?:\/\//);
});
