import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/crm-import.js', import.meta.url), 'utf8');
function parse(csv) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  runInNewContext(source, sandbox);
  return sandbox.edwinCsvImport.parseLeadsCsv(csv);
}

test('rejects duplicate identical mapped email columns rather than dropping one', () => {
  assert.throws(() => parse('Nombre,Email,Email\nAna Pérez,ana@example.com,otro@example.com'), /columnas duplicadas/);
});
test('rejects different aliases that map to the same field', () => {
  assert.throws(() => parse('Nombre,Correo,Email\nAna Pérez,ana@example.com,otro@example.com'), /columnas duplicadas/);
});
test('keeps distinct mapped columns importable', () => {
  const result = parse('Nombre,Email,Teléfono\nAna Pérez,ana@example.com,999999999');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].email, 'ana@example.com');
});
test('ignores duplicate unmapped metadata columns', () => {
  const result = parse('Nombre,Email,Extra,Extra\nAna Pérez,ana@example.com,uno,dos');
  assert.equal(result.rows.length, 1);
});
