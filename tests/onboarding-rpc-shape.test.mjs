import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOnboardingBusiness } from '../signup.js';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'synthetic-anon' };
const session = { user: { id: 'synthetic-user', role: 'client' }, access: 'synthetic-jwt', cookies: [] };
const request = () => new Request('https://crm.example.workers.dev/api/onboarding/business', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://crm.example.workers.dev' },
  body: JSON.stringify({ name: 'Mi Empresa' }),
});

async function withRpc(payload, callback) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try { await callback(() => calls); } finally { globalThis.fetch = original; }
}

test('onboarding accepts a complete synthetic RPC business', async () => {
  await withRpc({ id: 'business-a', name: 'Mi Empresa', slug: 'mi-empresa', created: true }, async calls => {
    const response = await handleOnboardingBusiness(request(), env, session);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).business, { id: 'business-a', name: 'Mi Empresa', slug: 'mi-empresa' });
    assert.equal(calls(), 1);
  });
});

test('onboarding rejects incomplete or malformed upstream success payloads', async () => {
  for (const payload of [null, [], {}, { id: 'business-a' }, { id: 'business-a', name: 'Mi Empresa' },
    { id: 'business-a', name: 'Mi Empresa', slug: '' },
    { id: 'business-a', name: 12, slug: 'mi-empresa' },
    { id: ' ', name: 'Mi Empresa', slug: 'mi-empresa' }]) {
    await withRpc(payload, async calls => {
      const response = await handleOnboardingBusiness(request(), env, session);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).ok, undefined);
      assert.equal(calls(), 1);
    });
  }
});

test('onboarding denies unauthenticated requests without calling upstream', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw Error('Upstream must not be called'); };
  try {
    const response = await handleOnboardingBusiness(request(), env, null);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null);
  } finally { globalThis.fetch = original; }
});
