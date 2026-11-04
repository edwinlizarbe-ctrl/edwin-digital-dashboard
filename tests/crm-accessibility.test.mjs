import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html', import.meta.url),'utf8');
const css=readFileSync(new URL('../public/crm-accessibility.css', import.meta.url),'utf8');
test('C49: keyboard skip link targets the focusable main application region',()=>{
  assert.match(html,/<a class="crm-skip-link" href="#app">Saltar al contenido principal<\/a>/);
  assert.match(html,/<div id="app" tabindex="-1" aria-live="polite">/);
  assert.match(html,/<link rel="stylesheet" href="\/crm-accessibility\.css\?v=growth-c49-20261104"/);
});
test('C49: skip link appears on keyboard focus and remains visible in forced colors',()=>{
  assert.match(css,/\.crm-skip-link:focus-visible/);
  assert.match(css,/transform:none/);
  assert.match(css,/@media \(forced-colors:active\)/);
});
