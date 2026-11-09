import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const demo=readFileSync(new URL('../public/crm-demo.html',import.meta.url),'utf8');
const commercial=readFileSync(new URL('../public/edwin-crm.html',import.meta.url),'utf8');

test('demo identifies private access for enabled accounts',()=>{
  assert.match(demo,/<a href="\/" aria-label="Acceso privado al CRM para cuentas habilitadas">Acceso privado<\/a>/);
});
test('demo never promises public login or registration',()=>{
  assert.doesNotMatch(demo,/>Ingresar al CRM<\/a>|>Registro público<\/a>|>Crear cuenta gratis<\/a>/i);
});
test('private access clarification does not change demo isolation',()=>{
  assert.match(demo,/DATOS 100% FICTICIOS/);
  assert.match(demo,/import \{demoInsights, DEMO_BUSINESS_ID\} from '\.\/crm-demo-data\.js'/);
  assert.doesNotMatch(demo,/fetch\(|supabase\.auth|checkout|paymentIntent/i);
  assert.match(commercial,/Acceso privado al CRM para cuentas habilitadas/);
});
