import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('npm test delegates to the existing unit suite', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.test, 'npm run test:unit');
  assert.match(pkg.scripts['test:unit'], /node --test/);
});
