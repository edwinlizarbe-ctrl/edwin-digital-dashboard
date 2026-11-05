import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLaunch} from '../scripts/launch-audit.mjs';
const controls=auditLaunch();
test('el auditor declara exactamente A21-A30 sin duplicados',()=>{
  assert.deepEqual(controls.map(x=>x.id),Array.from({length:10},(_,i)=>'A'+(i+21)));
});
for (const control of controls) {
  test(control.id+': '+control.label,()=>{
    assert.equal(control.passed,true,control.label);
  });
}
