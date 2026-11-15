import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLaunch, anchorsExist, fileLinksExist} from '../scripts/launch-audit.mjs';
const controls=auditLaunch();
test('el auditor declara exactamente A21-A30 sin duplicados',()=>{
  assert.deepEqual(controls.map(x=>x.id),Array.from({length:10},(_,i)=>'A'+(i+21)));
});
for (const control of controls) {
  test(control.id+': '+control.label,()=>{
    assert.equal(control.passed,true,control.label);
  });
}

// Regresiones sintéticas sin red, cuentas, datos personales ni escrituras.
test('A27 acepta anclas válidas con comillas simples y dobles',()=>{
  assert.equal(anchorsExist('<a href="#inicio">Ir</a><main id="inicio"></main>'),true);
  assert.equal(anchorsExist("<a href='#inicio'>Ir</a><main id='inicio'></main>"),true);
});
test('A27 rechaza destino ausente y no confunde data-id con id',()=>{
  assert.equal(anchorsExist('<a href="#ausente">Ir</a>'),false);
  assert.equal(anchorsExist('<a href="#inicio">Ir</a><main data-id="inicio"></main>'),false);
});
test('A26 acepta ruta pública conocida y rechaza ruta inexistente',()=>{
  assert.equal(fileLinksExist("<a href='/edwin-crm.html'>CRM</a>"),true);
  assert.equal(fileLinksExist("<a href='/archivo-inexistente-auditoria-20261115.html'>Falla</a>"),false);
});
