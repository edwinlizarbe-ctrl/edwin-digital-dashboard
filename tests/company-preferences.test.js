import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const BIZ = '11111111-2222-3333-4444-555555555555';
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-test' };

// Supabase simulado: ninguna llamada sale a la red ni usa credenciales reales.
function mockSupabase({ businessRows }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: init.method || 'GET' });
    const ok = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('/auth/v1/user') && (init.method || 'GET') === 'GET') return ok({ id: 'u1', email: 'cliente@example.com', user_metadata: {} });
    if (u.includes('/auth/v1/user') && init.method === 'PUT') return ok({});
    if (u.includes('/rest/v1/profiles')) return ok([{ id: 'u1', email: 'cliente@example.com', role: 'client' }]);
    if (u.includes('/rest/v1/businesses')) return ok(businessRows);
    throw new Error('Llamada inesperada: ' + u);
  };
  return calls;
}

function post(body) {
  return new Request('https://crm.test/api/company/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'ed_access=tok' },
    body: JSON.stringify(body),
  });
}

test('company/preferences consulta el nombre de la empresa y guarda el perfil', async () => {
  const original = globalThis.fetch;
  try {
    const calls = mockSupabase({ businessRows: [{ id: BIZ, name: 'Empresa Demo' }] });
    const res = await worker.fetch(post({ business_id: BIZ, category: 'Retail', country: 'Perú' }), env);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.profile.display_name, 'Empresa Demo');
    const query = calls.find(c => c.url.includes('/rest/v1/businesses')).url;
    assert.match(query, /select=id,name/);
  } finally { globalThis.fetch = original; }
});

test('company/preferences rechaza empresas a las que RLS no da acceso', async () => {
  const original = globalThis.fetch;
  try {
    mockSupabase({ businessRows: [] });
    const res = await worker.fetch(post({ business_id: BIZ, category: 'x', country: 'y' }), env);
    assert.equal(res.status, 403);
  } finally { globalThis.fetch = original; }
});

test('company/preferences rechaza business_id que no es UUID sin consultar datos', async () => {
  const original = globalThis.fetch;
  try {
    const calls = mockSupabase({ businessRows: [] });
    const res = await worker.fetch(post({ business_id: "x' or '1'='1" }), env);
    assert.equal(res.status, 403);
    assert.equal(calls.some(c => c.url.includes('/rest/v1/businesses')), false);
  } finally { globalThis.fetch = original; }
});
