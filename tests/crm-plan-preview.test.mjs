import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPlanLimits, PLAN_LIMITS} from '../public/crm-plan-preview.js';
const base={businessId:'empresa-A',selectedBusinessId:'empresa-A',plan:'inicial',usage:{contacts:100,users:1,opportunities:51}};
test('C47 muestra límites sin aplicarlos ni cobrar',()=>{const x=previewPlanLimits(base);assert.equal(x.metrics.contacts.remaining,0);assert.equal(x.metrics.opportunities.exceeds,true);assert.equal(x.enforcement,false);assert.equal(x.billing,false);assert.equal(x.synchronized,false);assert.equal(x.illustrative,true);});
test('C47 aísla business_id y no devuelve información de otra empresa',()=>{assert.throws(()=>previewPlanLimits({...base,selectedBusinessId:'empresa-B'}),/Empresa no autorizada/);assert.throws(()=>previewPlanLimits({...base,businessId:''}),/Empresa no autorizada/);});
test('C47 rechaza planes, usos inválidos y números manipulados',()=>{assert.throws(()=>previewPlanLimits({...base,plan:'admin'}),/Plan desconocido/);for(const invalid of [-1,1.5,Infinity,NaN,'100'])assert.throws(()=>previewPlanLimits({...base,usage:{...base.usage,contacts:invalid}}),/Uso inválido/);});
test('C47 no modifica los valores de entrada y expone planes ilustrativos inmutables',()=>{const before=structuredClone(base.usage);previewPlanLimits(base);assert.deepEqual(base.usage,before);assert.equal(Object.isFrozen(PLAN_LIMITS.inicial),true);});
