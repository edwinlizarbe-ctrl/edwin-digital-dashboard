import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSignup } from '../signup.js';

const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-test' };
const request = () => new Request('https://crm.example.test/api/auth/signup', {
  method: 'POST',
  headers: { Origin: 'https://crm.example.test', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'synthetic@example.test', password: 'safe-password-123', confirm: 'safe-password-123' }),
});

async function stubProvider(response, fn) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response(); };
  try { await fn(() => calls); } finally { globalThis.fetch = original; }
}

test('valid signup confirmation response remains accepted without leaking tokens', async () => {
  await stubProvider(() => new Response(JSON.stringify({ id: 'synthetic-user' }), { status: 200 }), async (calls) => {
    const r = await handleSignup(request(), env);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ok, true);
    assert.equal(r.headers.get('Set-Cookie'), null);
    assert.equal(calls(), 1);
  });
});

test('malformed and missing provider payloads fail closed without reporting success', async () => {
  for (const payload of ['not-json', '', '{}', '[]', '{"id":null}', '{"id":"  "}', '{"id":42}']) {
    await stubProvider(() => new Response(payload, { status: 200 }), async (calls) => {
      const r = await handleSignup(request(), env);
      const data = await r.json();
      assert.equal(r.status, 502, payload);
      assert.equal(data.ok, undefined, payload);
      assert.equal(r.headers.get('Set-Cookie'), null);
      assert.equal(calls(), 1);
    });
  }
});

test('provider tokens remain blocked even when provider returns a user id', async () => {
  await stubProvider(() => new Response(JSON.stringify({ id: 'synthetic-user', access_token: 'secret-test-token' }), { status: 200 }), async () => {
    const r = await handleSignup(request(), env);
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(await r.json()).includes('secret-test-token'), false);
    assert.equal(r.headers.get('Set-Cookie'), null);
  });
});

test('foreign-origin request cannot reach the provider', async () => {
  await stubProvider(() => { throw new Error('provider must not be called'); }, async (calls) => {
    const r = await handleSignup(new Request('https://crm.example.test/api/auth/signup', {
      method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'synthetic@example.test', password: 'safe-password-123', confirm: 'safe-password-123' }),
    }), env);
    assert.equal(r.status, 403);
    assert.equal(calls(), 0);
  });
});
