import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ci=readFileSync(new URL('../.github/workflows/crm-ci.yml',import.meta.url),'utf8');

test('CI se ejecuta también cuando cambia un archivo .mjs aislado',()=>{
  assert.match(ci,/\s+- '\*\*\/\*\.js'/);
  assert.match(ci,/\s+- '\*\*\/\*\.mjs'/);
});
test('CI valida sintaxis de archivos JS y MJS sin recorrer dependencias',()=>{
  assert.match(ci,/-name '\*\.js'/);
  assert.match(ci,/-name '\*\.mjs'/);
  assert.match(ci,/node --check/);
  assert.match(ci,/-not -path '\.\/node_modules\/\*'/);
});
test('CI incluye pruebas .test.js y .test.mjs',()=>{
  assert.match(ci,/node --test tests\/\*\.test\.js tests\/\*\.test\.mjs/);
});
