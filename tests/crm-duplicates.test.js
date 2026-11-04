import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../public/crm-duplicates.js';

const {analyze,render}=globalThis.edwinCrmDuplicates;
const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const lead=(id,business_id,overrides={})=>({id,business_id,email:'',phone:'',name:'Nombre',...overrides});

test('G09 detects case-insensitive email matches within the same tenant',()=>{
 const leads=[
  lead(ids[0],a,{email:' CLIENTE@empresa.pe  '}),
  lead(ids[1],a,{email:'cliente@empresa.pe'}),
  lead(ids[2],b,{email:'CLIENTE@empresa.pe',name:'SECRET CROSS-TENANT'})
 ];
 const original=JSON.stringify(leads);
 const result=analyze(leads,a);
 assert.equal(result.flaggedCount,2);
 assert.equal(result.groupCount,1);
 assert.deepEqual(result.flags[ids[0]],['Correo']);
 assert.deepEqual(result.flags[ids[1]],['Correo']);
 assert.equal(result.flags[ids[2]],undefined);
 assert.doesNotMatch(JSON.stringify(result),/CLIENTE|SECRET|empresa.pe/);
 assert.equal(JSON.stringify(leads),original,'analysis must not change existing leads');
});

test('G09 normalizes phone formatting but rejects short/invalid identifiers',()=>{
 const result=analyze([
  lead(ids[0],a,{phone:'999 888 777'}),
  lead(ids[1],a,{phone:'999-888-777'}),
  lead(ids[2],a,{phone:'888'}),
  lead('invalid-id',a,{phone:'999888777'}),
  lead(ids[2],b,{phone:'999888777'})
 ],a);
 assert.equal(result.flaggedCount,2);
 assert.equal(result.groupCount,1);
 assert.deepEqual(result.flags[ids[1]],['Teléfono']);
 assert.equal(result.flags[ids[2]],undefined);
 assert.equal(analyze([],a).flaggedCount,0);
 assert.equal(analyze(null,a).flaggedCount,0);
 assert.equal(analyze([lead(ids[0],a,{phone:'999888777'})],b).flaggedCount,0);
});

test('G09 identifies overlap by both email and phone without double-counting leads',()=>{
 const result=analyze([
  lead(ids[0],a,{email:'hola@empresa.pe',phone:'999999999'}),
  lead(ids[1],a,{email:'hola@empresa.pe',phone:'999999999'})
 ],a);
 assert.equal(result.flaggedCount,2);
 assert.equal(result.groupCount,2);
 assert.deepEqual(result.flags[ids[0]],['Correo','Teléfono']);
});

test('G09 warns without merging, deleting or disclosing raw contact details',()=>{
 const data=analyze([lead(ids[0],a,{email:'x@empresa.pe'}),lead(ids[1],a,{email:'x@empresa.pe'})],a);
 const markup=render(data,{partial:true});
 assert.match(markup,/Posibles duplicados por revisar/);
 assert.match(markup,/muestra disponible/);
 assert.match(markup,/no se fusiona ni elimina/);
 assert.doesNotMatch(markup,/x@empresa.pe|11111111/);
 assert.equal(render(null,{loading:true}),'');
 assert.match(render(analyze([],a)),/No se detectaron coincidencias/);
});

test('G09 is wired into authorized CRM leads only and has no writes or network traffic',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const code=readFileSync(new URL('../public/crm-duplicates.js',import.meta.url),'utf8');
 assert.match(index,/crm-duplicates\.js\?v=growth-g09-20261104/);
 assert.match(index,/crm-duplicates\.css\?v=growth-g09-20261104/);
 assert.ok(index.indexOf('crm-duplicates.js')<index.indexOf('/app.js'));
 assert.match(app,/edwinCrmDuplicates\?\.analyze\(data,state\.businessId\)/);
 assert.match(app,/ed-dupe-flag/);
 assert.match(app,/duplicatePanel\+/);
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|localStorage|sendBeacon/);
});
