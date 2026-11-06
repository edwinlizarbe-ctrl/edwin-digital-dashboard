import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../public/edwin-crm.html', import.meta.url), 'utf8');
const launchGate = readFileSync(new URL('../docs/PRELANZAMIENTO-PILOTO-CRM.md', import.meta.url), 'utf8');

test('la presentación comercial no se indexa antes de aprobar el piloto', () => {
  assert.match(launchGate, /mantener el piloto privado sin acceso público/i);
  assert.match(page, /<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow["']\s*\/?\s*>/i);
});

test('la demo se identifica como ficticia y no requiere conectar un negocio', () => {
  assert.match(page, /href=["']\/crm-demo\.html["']/);
  assert.match(page, /demostración utiliza datos ficticios y no requiere conectar tu negocio/i);
});
