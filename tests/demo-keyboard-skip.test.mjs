import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/crm-demo.html',import.meta.url),'utf8');

test('keyboard navigation offers a visible skip link to an existing focusable main',()=>{
  assert.match(html,/<a class="skip-link" href="#demo-content">Saltar al contenido de la demostración<\/a>/);
  assert.match(html,/<main id="demo-content" tabindex="-1">/);
  assert.match(html,/\.skip-link:focus\{top:12px\}/);
});
test('skip link is hidden offscreen until focused without hiding focus outline',()=>{
  assert.match(html,/\.skip-link\{position:absolute;left:12px;top:-100px/);
  assert.match(html,/a:focus-visible[^\{]*\{outline:3px solid/);
  assert.doesNotMatch(html,/\.skip-link:focus\{[^}]*display:none/);
});
test('demo remains fictitious, private, and isolated from tenant data and external requests',()=>{
  assert.match(html,/content="noindex, nofollow"/);
  assert.match(html,/DATOS 100% FICTICIOS/);
  assert.match(html,/demoInsights\(DEMO_BUSINESS_ID,select.value\)/);
  assert.doesNotMatch(html,/<form\b|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|https?:\/\//i);
});
