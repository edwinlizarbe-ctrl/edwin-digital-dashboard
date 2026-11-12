import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../public/crm-followup-simulator.html',import.meta.url),'utf8');

test('positivo: aviso de estimación obsoleta se anuncia como estado accesible',()=>{
  assert.match(page,/<p id="explanation" class="privacy" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
  assert.match(page,/explanation\.textContent='Los valores cambiaron\. Pulsa «Calcular ejemplo» para actualizar la estimación\.'/);
});
test('negativo: aviso no interrumpe como alerta urgente ni anuncia caracteres aislados',()=>{
  const node=page.match(/<p id="explanation"[^>]*><\/p>/)?.[0];
  assert.ok(node);
  assert.doesNotMatch(node,/role="alert"|aria-live="assertive"/);
  assert.match(node,/aria-atomic="true"/);
});
test('aislamiento: aviso local no añade redes, persistencia ni acceso a empresas',()=>{
  assert.doesNotMatch(page,/(?:fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase|sendBeacon|<script src="https?:)/i);
  assert.match(page,/form\.addEventListener\('submit',event=>\{event\.preventDefault\(\);calculate\(\);\}\)/);
  assert.match(page,/form\.addEventListener\('reset',\(\)=>\{queueMicrotask\(calculate\);\}\)/);
});
