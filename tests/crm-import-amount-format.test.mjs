import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/crm-import.js', import.meta.url), 'utf8');
const context = {};
runInNewContext(source, context);
const parse = context.edwinCsvImport.parseLeadsCsv;

test('CSV rejects hexadecimal and exponential monetary values rather than silently converting them', () => {
  for (const amount of ['0x10', '1e3', '0b101', '12abc']) {
    assert.throws(() => parse('Nombre;Monto\nAna Perez;' + amount), /No hay contactos válidos/);
  }
});

test('CSV still accepts conventional decimal and thousands separators', () => {
  for (const [amount, expected] of [['1234.56', 1234.56], ['1.234,56', 1234.56], ['1,234.56', 1234.56]]) {
    const result = parse('Nombre;Monto\nAna Perez;' + amount);
    assert.equal(result.rows[0].amount, expected);
  }
});
