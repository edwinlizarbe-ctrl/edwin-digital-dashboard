import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const links = page.match(/<nav aria-label="Presentación y herramientas de demostración">([\s\S]*?)<\/nav>/)?.[1] ?? '';

test('positivo: los accesos rápidos ofrecen demo y simulador ficticio', () => {
  assert.match(links, /href="\/crm-demo\.html"/);
  assert.match(links, /href="\/crm-followup-simulator\.html"[^>]*>Simulador de seguimientos \(datos ficticios\)<\/a>/);
});

test('negativo: el enlace no abre alta pública ni cobros', () => {
  assert.doesNotMatch(links, /href="[^"]*(?:signup|checkout|payment|subscribe|billing)/i);
  assert.doesNotMatch(links, /<form\b|<button\b/i);
});

test('aislamiento: la navegación es estática y no introduce acceso empresarial', () => {
  assert.doesNotMatch(links, /<script\b|fetch\s*\(|localStorage|sessionStorage|supabase|business_id|company_id/i);
  assert.equal((links.match(/href="\/crm-followup-simulator\.html"/g) ?? []).length, 1);
});
