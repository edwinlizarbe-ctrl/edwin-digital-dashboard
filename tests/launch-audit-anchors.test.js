import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorsExist} from '../scripts/launch-audit.mjs';

test('accepts fragment destinations with single or double quotes', () => {
  assert.equal(anchorsExist(`<a href='#overview'>Overview</a><section id='overview'></section>`), true);
  assert.equal(anchorsExist(`<a href="#overview">Overview</a><section id='overview'></section>`), true);
  assert.equal(anchorsExist(`<a href='#overview'>Overview</a><section id="overview"></section>`), true);
});

test('rejects missing destinations and unrelated data-id attributes', () => {
  assert.equal(anchorsExist(`<a href='#overview'>Overview</a><section data-id='overview'></section>`), false);
  assert.equal(anchorsExist(`<a href="#overview">Overview</a><section id='other'></section>`), false);
});

test('does not accept mismatched attribute quote delimiters', () => {
  assert.equal(anchorsExist(`<a href='#overview">Overview</a><section id='overview'></section>`), true);
  assert.equal(anchorsExist(`<a href='#overview'>Overview</a><section id='overview"></section>`), false);
});
