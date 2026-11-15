import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorsExist} from '../scripts/launch-audit.mjs';

test('accepts matching real id attribute', () => {
  assert.equal(anchorsExist('<a href="#about">About</a><section id="about"></section>'), true);
});
test('rejects id text embedded inside data-id', () => {
  assert.equal(anchorsExist('<a href="#about">About</a><section data-id="about"></section>'), false);
});
