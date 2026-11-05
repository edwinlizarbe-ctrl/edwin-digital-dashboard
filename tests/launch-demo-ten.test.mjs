import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoInsights, DEMO_BUSINESS_ID} from '../public/crm-demo-data.js';
const html = readFileSync(new URL('../public/crm-demo.html',import.meta.url),'utf8');
const sample = scenario => demoInsights(DEMO_BUSINESS_ID,scenario);
test('A01: demo incluye selector de escenarios con etiqueta',()=>{
 assert.match(html,/<label for="scenario">/);assert.match(html,/<select id="scenario"/);
});
test('A02: permite restablecer escenario de forma accesible',()=>{
 assert.match(html,/<button id="reset" type="button">/);assert.match(html,/select\.focus\(\)/);
});
test('A03: navegación de regreso tanto al sitio comercial como al CRM',()=>{
 assert.match(html,/href="\/edwin-crm\.html"/);assert.match(html,/href="\/"/);
});
test('A04: noindex evita indexar demo sintética',()=>{
 assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
});
test('A05: cálculos correctos de prospectos sin contactar',()=>{
 for(const s of ['inicio','crecimiento','seguimiento']){const x=sample(s);assert.equal(x.notContacted,x.leads-x.contacted);assert.ok(x.notContacted>=0);}
});
test('A06: calcula la cartera calificada sin cierre',()=>{
 for(const s of ['inicio','crecimiento','seguimiento']){const x=sample(s);assert.equal(x.qualifiedNotWon,x.qualified-x.won);}
});
test('A07: tasas derivadas de conteos sintéticos',()=>{
 const x=sample('inicio');assert.equal(x.qualificationRate,50);assert.equal(x.closeRate,25);
});
test('A08: barras con límites y métricas coherentes',()=>{
 for(const s of ['inicio','crecimiento','seguimiento']){const x=sample(s);assert.equal(x.stages.length,4);assert.equal(x.stages[0].percent,100);assert.ok(x.stages.every(z=>z.percent>=0&&z.percent<=100));}
 assert.match(html,/<progress/);
});
test('A09: demo siempre bloquea empresa no sintética y escenarios desconocidos',()=>{
 assert.throws(()=>demoInsights('empresa-real','inicio'),/no autorizada/);
 assert.throws(()=>demoInsights(DEMO_BUSINESS_ID,'otro'),/desconocido/);
});
test('A10: aísla el resultado y advierte que las cifras son ficticias',()=>{
 const x=sample('inicio');assert.ok(Object.isFrozen(x));assert.ok(Object.isFrozen(x.stages));
 assert.match(x.disclaimer,/ficticios/i);assert.match(html,/Ningún dato aquí demuestra ventas recuperadas/i);
 assert.doesNotMatch(html,/(?:localStorage|sessionStorage|fetch\(|XMLHttpRequest)/);
});
