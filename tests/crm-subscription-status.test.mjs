import test from 'node:test';
import assert from 'node:assert/strict';
import {explainSubscriptionState,SUBSCRIPTION_STATES} from '../public/crm-subscription-status.js';
test('C46 estados positivos, solo lectura y no sincronizados',()=>{
 for(const state of Object.keys(SUBSCRIPTION_STATES)){
  const x=explainSubscriptionState({businessId:'a',selectedBusinessId:'a',state});
  assert.equal(x.state,state);assert.equal(x.illustrative,true);assert.equal(x.verified,false);
  assert.equal(x.synchronized,false);assert.equal(x.billing,false);assert.equal(x.enforcement,false);
  assert.ok(x.description.length>10);assert.ok(Object.isFrozen(x));
 }
});
test('C46 rechaza estados desconocidos y entradas peligrosas',()=>{
 for(const state of ['',null,'__proto__','paid','active<script>']){
  assert.throws(()=>explainSubscriptionState({businessId:'a',selectedBusinessId:'a',state}));
 }
});
test('C46 aisla business_id incluso si el estado es valido',()=>{
 for(const businessId of ['',null,'b']){
  assert.throws(()=>explainSubscriptionState({businessId,selectedBusinessId:'a',state:'active'}));
 }
 assert.equal(explainSubscriptionState({businessId:'a',selectedBusinessId:'a',state:'active'}).business_id,'a');
});
test('C46 catálogo inmutable y sin efectos sobre inputs',()=>{
 assert.ok(Object.isFrozen(SUBSCRIPTION_STATES));
 const input={businessId:'a',selectedBusinessId:'a',state:'trial'};
 const before=structuredClone(input);explainSubscriptionState(input);assert.deepEqual(input,before);
 assert.ok(Object.values(SUBSCRIPTION_STATES).every(Object.isFrozen));
});
