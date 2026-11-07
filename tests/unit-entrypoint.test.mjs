import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('package exposes a unified Node test entrypoint without deploying', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['test:unit'], 'node --test tests/*.test.js tests/*.test.mjs');
  assert.equal(pkg.scripts['test:whatsapp'], 'node --test tests/whatsapp-status.test.mjs');
  assert.equal(pkg.scripts.deploy, 'wrangler deploy');
});
