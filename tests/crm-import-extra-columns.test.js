import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../public/crm-import.js', import.meta.url), 'utf8'), context);
const parse = context.edwinCsvImport.parseLeadsCsv;

test('skips malformed row with extra unquoted delimiter instead of shifting lead fields', () => {
  const parsed = parse('Nombre,Correo,Notas\nAna,ana@example.com,ok\nLuis,luis@example.com,nota,extra');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].name, 'Ana');
  assert.equal(parsed.skipped, 1);
  assert.match(parsed.warnings.join(' '), /más columnas/);
});

test('keeps quoted delimiters and short rows valid', () => {
  const parsed = parse('Nombre,Correo,Notas\nAna,ana@example.com,"hola, mundo"\nLuis,luis@example.com');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].notes, 'hola, mundo');
  assert.equal(parsed.rows[1].notes, '');
  assert.equal(parsed.skipped, 0);
});

test('rejects files where every data row has surplus fields', () => {
  assert.throws(() => parse('Nombre,Correo\nAna,ana@example.com,extra'), /No hay contactos válidos/);
});
