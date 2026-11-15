import test from 'node:test';
import assert from 'node:assert/strict';
import { fileLinksExist } from '../scripts/launch-audit.mjs';

test('A26 rejects missing local file linked with single quotes', () => {
  assert.equal(fileLinksExist("<a href='/missing-a26-regression.html'>broken</a>"), false);
});

test('A26 accepts an existing local file linked with single quotes', () => {
  assert.equal(fileLinksExist("<a href='/edwin-crm.html'>landing</a>"), true);
});

test('A26 rejects missing local file linked with double quotes', () => {
  assert.equal(fileLinksExist('<a href="/missing-a26-regression.html">broken</a>'), false);
});
