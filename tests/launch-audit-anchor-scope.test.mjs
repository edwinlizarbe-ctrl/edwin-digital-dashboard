import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/launch-audit.mjs', import.meta.url), 'utf8');
const definition = source.match(/^const anchorsExist=html=>\{[\s\S]*?^\};/m);
assert.ok(definition, 'launch audit must declare anchorsExist');
const anchorsExist = new Function('anchors', definition[0] + '\nreturn anchorsExist;')(
  html => [...html.matchAll(/href="#([^\"]+)"/g)].map(match => match[1])
);

test('accepts matching real id attribute', () => {
  assert.equal(anchorsExist('<a href="#about">About</a><section id="about"></section>'), true);
});
test('rejects id text embedded inside data-id', () => {
  assert.equal(anchorsExist('<a href="#about">About</a><section data-id="about"></section>'), false);
});
