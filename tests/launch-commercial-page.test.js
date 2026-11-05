import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../public/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

test('la presentación comercial existe y abre la demo real con datos ficticios', () => {
  const html = read('edwin-crm.html');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /href="\/crm-demo\.html"/);
  assert.match(html, /href="\/#?"/);
  assert.match(html, /datos ficticios/i);
  assert.match(html, /suscripciones aún están en preparación/i);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /100% (?:garantizado|seguro)|ventas garantizadas(?:\s*<\/[^>]+>)*\s*\./i);
});

test('ninguna llamada a la acción local apunta a una página inexistente', () => {
  for (const file of ['edwin-crm.html','index.html']) {
    const html = read(file);
    for (const match of html.matchAll(/href="(\/[^"#?]*)(?:#[^"]*)?"/g)) {
      const href = match[1];
      if (href === '/') continue;
      const target = decodeURIComponent(href).replace(/^\//, '');
      assert.ok(!target.includes('..'), 'Ruta insegura: ' + href);
      assert.ok(existsSync(join(new URL('.', root).pathname, target)), file + ': falta ' + href);
    }
  }
});

test('los accesos auxiliares son un menú y no cinco botones flotantes', () => {
  const html = read('index.html');
  const css = read('crm-quicklinks.css');
  assert.match(html, /<details class="crm-quicklinks">/);
  assert.match(html, /<summary>Conocer Edwin CRM<\/summary>/);
  assert.match(html, /<nav aria-label=/);
  assert.match(html, /href="\/edwin-crm\.html"/);
  for (const route of ['crm-demo.html','crm-cohort-guard.html','crm-subscription-status.html','crm-activation-milestones.html','crm-plan-preview.html']) {
    assert.equal((html.match(new RegExp('href="/' + route.replaceAll('.', '\\.') + '"', 'g')) || []).length, 1, route);
  }
  assert.doesNotMatch(html, /style="position:fixed/);
  assert.match(css, /focus-visible/);
});
