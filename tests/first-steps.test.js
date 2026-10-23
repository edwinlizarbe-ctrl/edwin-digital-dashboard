import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = app.indexOf('  function firstRunPanel(){');
const end = app.indexOf('  function salesOverview(', start);
assert.ok(start >= 0 && end > start, 'El módulo de inicio guiado debe existir');
const isolated = app.slice(start, end);

function guide({
  ready = false,
  loading = false,
  businessReady = true,
  leadLoading = false,
  leadError = '',
  leads = [],
  gaIncluded = true,
} = {}) {
  return runInNewContext(isolated + '\nfirstRunPanel();', {
    gaReady: () => ready,
    state: { gaLoading: loading, leadsLoading: leadLoading, leadsError: leadError, leads },
    featureEnabled: key => key === 'ga4' && gaIncluded,
    business: () => businessReady ? { id:'tenant-a', name:'Tienda Uno' } : null,
    clean: v => String(v ?? '').replace(/[&<>"']/g, ''),
    icon: () => '<svg aria-hidden="true"></svg>',
  });
}

test('inicio guiado: 3 pasos reales, sin métricas inventadas ni requisitos de cobro', () => {
  const html = guide();
  assert.match(html, /Tu empresa está lista/);
  assert.match(html, /Revisa los datos de tu empresa/);
  assert.match(html, /Registra tu primera oportunidad/);
  assert.match(html, /Explora las integraciones/);
  assert.match(html, /No mostramos datos de prueba/);
  for(const page of ['company','leads','integrations']) {
    assert.match(html, new RegExp('data-act="nav" data-page="' + page + '"'));
  }
  assert.equal((html.match(/class="start-step"/g) || []).length, 3);
  assert.equal((html.match(/is-done/g) || []).length, 1, 'Solo la empresa creada está completada');
});

test('inicio guiado: las oportunidades completadas vienen solo de datos reales del negocio', () => {
  const complete = guide({ leads:[{id:'lead-real-1'}] });
  assert.equal((complete.match(/is-done/g) || []).length, 2);
  assert.match(complete,/Ya tienes al menos una oportunidad registrada/);
  const unknown = guide({ leadLoading:true, leads: [{id:'1'}] });
  assert.equal((unknown.match(/is-done/g) || []).length, 1);
  assert.match(unknown,/Comprobando/);
  const error = guide({ leadError:'Permiso insuficiente', leads: [] });
  assert.match(error,/No pudimos comprobar las oportunidades/);
  assert.doesNotMatch(error,/0 oportunidades/);
});

test('inicio guiado no fuerza acceso a GA4 si el plan no incluye integración', () => {
  const html=guide({ gaIncluded:false });
  assert.match(html,/Google Analytics no está habilitado para esta empresa/);
  assert.match(html,/No incluida/);
  assert.match(html,/data-page="integrations"/);
  assert.doesNotMatch(html,/Conectado/);
});

test('inicio guiado se oculta cuando ya hay informes reales o GA4 sigue cargando', () => {
  assert.equal(guide({ ready:true }), '');
  assert.equal(guide({ loading:true }), '');
});
