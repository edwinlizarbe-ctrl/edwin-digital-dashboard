import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/edwin-crm.html',import.meta.url),'utf8');
const hero=html.match(/<div class="hero-card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<section/)?.[1] ?? html;
test('positivo: tres pasos expuestos como lista accesible',()=>{
  assert.match(hero,/<div class="metrics" role="list" aria-label="Tres pasos para organizar el seguimiento comercial">/);
  assert.equal((hero.match(/class="metric" role="listitem"/g)||[]).length,3);
  for(const label of ['Identifica oportunidades sin avances','Prioriza el próximo seguimiento','Revisa resultados por etapa y canal']) assert.ok(hero.includes(label));
});
test('negativo: numeración decorativa no se anuncia dos veces',()=>{
  assert.equal((hero.match(/<strong aria-hidden="true">0[123]<\/strong>/g)||[]).length,3);
  assert.doesNotMatch(hero,/<strong>0[123]<\/strong>/);
});
test('aislamiento: landing sigue sin scripts, formularios, pagos o consultas de clientes',()=>{
  assert.doesNotMatch(html,/<script|<form|<iframe|fetch\(|localStorage|sessionStorage|checkout|stripe\.com/i);
  assert.match(html,/content="noindex, nofollow"/);
});
