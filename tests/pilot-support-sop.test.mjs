import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sop=readFileSync(new URL('../docs/SOPORTE-INCIDENTES-PILOTO-CRM.md',import.meta.url),'utf8');

test('positive: support incident protocol documents reproducible recovery and SHA evidence',()=>{
  for(const term of ['fecha/hora','responsable','código HTTP','checks del SHA','verificado en producción','cuentas sintéticas autorizadas']){
    assert.ok(sop.includes(term),term);
  }
});

test('negative: no payment enablement or unsafe credential collection',()=>{
  for(const term of ['No solicitar contraseñas','tokens','no habilita','no deben dar acceso','mantener bloqueo']){
    assert.ok(sop.includes(term),term);
  }
  assert.doesNotMatch(sop,/ejecutar\s+(?:ALTER TABLE|DROP TABLE|UPDATE auth\.)/i);
});

test('isolation: cross-tenant access is a P0 and requires A/B evidence before closure',()=>{
  assert.match(sop,/P0: privacidad \/ aislamiento/);
  assert.match(sop,/Empresa B no lee, edita ni exporta registros de A/);
  assert.match(sop,/La sesión de A no habilita recursos de B/);
  assert.match(sop,/no hubo contaminación cruzada/);
});
