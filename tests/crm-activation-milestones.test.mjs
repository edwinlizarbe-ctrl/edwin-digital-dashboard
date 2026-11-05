import test from 'node:test';
import assert from 'node:assert/strict';
import {MILESTONES,storageKey,readMilestones,setMilestone,normalizeMilestones} from '../public/crm-activation-milestones.js';
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};}
test('C36 registra y desmarca hitos sin datos personales',()=>{
 const store=memory();assert.equal(setMilestone(store,'bizA','userA','perfil',true).completed,1);
 assert.deepEqual(readMilestones(store,'bizA','userA'),['perfil']);
 assert.equal(setMilestone(store,'bizA','userA','perfil',true).completed,1);
 assert.equal(setMilestone(store,'bizA','userA','perfil',false).completed,0);
});
test('C36 rechaza identificadores y hitos inválidos',()=>{
 const store=memory();assert.throws(()=>storageKey('../bad','user'));
 assert.throws(()=>setMilestone(store,'biz','user','correo',true));
 assert.throws(()=>setMilestone(store,'biz','user','perfil','yes'));
});
test('C36 aísla business_id y usuario',()=>{
 const store=memory();setMilestone(store,'bizA','userA','perfil',true);
 assert.deepEqual(readMilestones(store,'bizB','userA'),[]);
 assert.deepEqual(readMilestones(store,'bizA','userB'),[]);
 assert.notEqual(storageKey('ab','c'),storageKey('a','bc'));
});
test('C36 normaliza almacenamiento corrupto sin filtrar campos',()=>{
 const store=memory();store.setItem(storageKey('biz','user'),'{bad');
 assert.deepEqual(readMilestones(store,'biz','user'),[]);
 assert.deepEqual(normalizeMilestones(['perfil','perfil','PII',null]),['perfil']);
 assert.equal(Object.isFrozen(MILESTONES),true);
});
