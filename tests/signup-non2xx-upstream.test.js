import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSignup } from '../signup.js';

const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-test' };
const origin = 'https://crm.example.workers.dev';
const payload = { email: 'test@example.com', password: 'strong-password-123', confirm: 'strong-password-123' };
const request = (source = origin) => new Request(origin + '/api/auth/signup', {
  method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
async function mockFetch(upstream, run) {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return upstream; };
  try { await run(() => calls); } finally { globalThis.fetch = previous; }
}

test('positive: a valid 201 provider response can confirm signup without setting cookies', async () => {
  await mockFetch(new Response(JSON.stringify({ id: 'test-user' }), { status: 201 }), async (calls) => {
    const response = await handleSignup(request(), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(calls(), 1);
  });
});

test('negative: redirects with plausible user JSON never report successful registration', async () => {
  for (const status of [301, 302, 307, 308]) {
    await mockFetch(new Response(JSON.stringify({ id: 'forged-user' }), { status }), async () => {
      const response = await handleSignup(request(), env);
      assert.equal(response.status, 502);
      assert.equal((await response.json()).ok, undefined);
      assert.equal(response.headers.get('set-cookie'), null);
    });
  }
});

test('isolation: cross-origin signup is rejected before contacting provider', async () => {
  await mockFetch(new Response(JSON.stringify({ id: 'test-user' }), { status: 201 }), async (calls) => {
    const response = await handleSignup(request('https://foreign.example'), env);
    assert.equal(response.status, 403);
    assert.equal(calls(), 0);
  });
});
