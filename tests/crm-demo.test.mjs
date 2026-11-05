import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot, DEMO_BUSINESS_ID} from '../public/crm-demo-data.js';
test('C35: escenario ficticio con cálculos coherentes',()=>{
 const x=demoSnapshot(DEMO_BUSINESS_ID,'inicio');
 assert.equal(x.fictional,true);assert.equal(x.business_id,DEMO_BUSINESS_ID);
 assert.equal(x.contactRate,67);assert.equal(x.winRate,8);
 assert.ok(x.won<=x.qualified && x.qualified<=x.contacted && x.contacted<=x.leads);
 assert.match(x.attribution,/simulados/);
});
test('C35: rechaza otro business_id sin exponer datos',()=>{
 assert.throws(()=>demoSnapshot('empresa-real','inicio'),/no autorizada/);
 assert.throws(()=>demoSnapshot(undefined,'inicio'),/no autorizada/);
});
test('C35: falla cerrado ante escenario desconocido',()=>{
 assert.throws(()=>demoSnapshot(DEMO_BUSINESS_ID,'__proto__'),/desconocido/);
 assert.throws(()=>demoSnapshot(DEMO_BUSINESS_ID,'otro'),/desconocido/);
});
test('C35: snapshots inmutables y separados',()=>{
 const a=demoSnapshot(DEMO_BUSINESS_ID,'inicio'),b=demoSnapshot(DEMO_BUSINESS_ID,'crecimiento');
 assert.notEqual(a.leads,b.leads);assert.equal(Object.isFrozen(a),true);
});
