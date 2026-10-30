import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGa4OAuthApi } from '../ga4-oauth.js';

const origin = 'https://crm-test.workers.dev';
const own = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const property = '558050129';
const session = { user: { id: '11111111-1111-4111-8111-111111111111', role: 'client' }, access: 'user-jwt', cookies: [] };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const enc = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function cipher(data, hex) {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), n => parseInt(n, 16)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  return enc(iv) + '.' + enc(new Uint8Array(encrypted));
}

async function withServer(options, action) {
  const previous = globalThis.fetch;
  const key = 'ab'.repeat(32);
  const env = {
    SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon-fake',
    SUPABASE_SERVICE_ROLE_KEY: 'service-fake',
    GOOGLE_ANALYTICS_CLIENT_ID: 'client-fake', GOOGLE_ANALYTICS_CLIENT_SECRET: 'secret-fake',
    GOOGLE_ANALYTICS_ENCRYPTION_KEY: key
  };
  const calls = [];
  const connection = { business_id: own, refresh_token_cipher: await cipher({ refresh_token: 'refresh-fake' }, key), selected_property_id: null, selected_property_name: null };
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url)), method = init.method || 'GET';
    calls.push({ url: u, method, headers: init.headers, body: init.body });
    if (u.pathname === '/rest/v1/businesses') return json(u.searchParams.get('id') === 'eq.' + own ? [{ id: own }] : []);
    if (u.pathname === '/rest/v1/ed_business_features') return json([{ business_id: own, plan: 'free', features: { ga4: true } }]);
    if (u.pathname === '/rest/v1/ed_ga4_connections') {
      if (method === 'PATCH') {
        Object.assign(connection, JSON.parse(init.body)); return json([connection]);
      }
      if (u.searchParams.has('selected_property_id')) return json(options.foreignConnection ? [{ business_id: foreign }] : []);
      return json([connection]);
    }
    if (u.pathname === '/rest/v1/sites') {
      if (options.siteFailure) return json({ error: 'unavailable' }, 503);
      return json(options.foreignSite ? [{ business_id: foreign }] : []);
    }
    if (u.origin === 'https://oauth2.googleapis.com') return json({ access_token: 'access-fake' });
    if (u.origin === 'https://analyticsadmin.googleapis.com') return json({
      accountSummaries: [{ displayName: 'Cuenta de prueba', propertySummaries: [{ property: 'properties/' + property, displayName: 'Propiedad de prueba' }] }]
    });
    throw Error('Unexpected mocked request: ' + u.href);
  };
  try { await action({ env, calls, connection }); } finally { globalThis.fetch = previous; }
}
function request({ business = own, propertyId = property, originHeader = origin } = {}) {
  return new Request(origin + '/api/ga4/select?business_id=' + business, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: originHeader },
    body: JSON.stringify({ property_id: propertyId })
  });
}
const isWrite = call => call.url.pathname === '/rest/v1/ed_ga4_connections' && call.method === 'PATCH';

test('own or unassigned GA4 property can be selected, with JWT membership first', async () => {
  await withServer({}, async ({ env, calls, connection }) => {
    const response = await handleGa4OAuthApi(request(), env, session);
    assert.equal(response.status, 200);
    assert.equal(connection.selected_property_id, property);
    assert.equal(calls.filter(isWrite).length, 1);
    const membership = calls.find(x => x.url.pathname === '/rest/v1/businesses');
    assert.equal(membership.headers.Authorization, 'Bearer user-jwt');
    const checks = calls.filter(x => x.url.pathname === '/rest/v1/sites' || x.url.searchParams.has('selected_property_id'));
    assert.equal(checks.length, 2);
    assert.ok(checks.every(x => x.headers.Authorization === 'Bearer service-fake'));
  });
});

test('property in another business site is blocked with 409 and no writes', async () => {
  await withServer({ foreignSite: true }, async ({ env, calls, connection }) => {
    const response = await handleGa4OAuthApi(request(), env, session);
    assert.equal(response.status, 409);
    assert.equal(connection.selected_property_id, null);
    assert.equal(calls.some(isWrite), false);
    assert.equal(JSON.stringify(await response.json()).includes(foreign), false);
  });
});

test('property already selected in another business OAuth is blocked with 409', async () => {
  await withServer({ foreignConnection: true }, async ({ env, calls }) => {
    const response = await handleGa4OAuthApi(request(), env, session);
    assert.equal(response.status, 409);
    assert.equal(calls.some(isWrite), false);
  });
});

test('the current business cannot select for a different business or invalid ID', async () => {
  await withServer({}, async ({ env, calls }) => {
    for (const business of [foreign, 'not-an-uuid']) {
      const response = await handleGa4OAuthApi(request({ business }), env, session);
      assert.equal(response.status, 403);
    }
    assert.equal(calls.some(x => x.url.pathname === '/rest/v1/ed_ga4_connections'), false);
  });
});

test('cross-origin requests cannot update GA4 even when property is available', async () => {
  await withServer({}, async ({ env, calls }) => {
    const response = await handleGa4OAuthApi(request({ originHeader: 'https://attacker.example' }), env, session);
    assert.equal(response.status, 403);
    assert.equal(calls.some(isWrite), false);
  });
});

test('storage lookup failure fails closed instead of assigning the property', async () => {
  await withServer({ siteFailure: true }, async ({ env, calls }) => {
    await assert.rejects(handleGa4OAuthApi(request(), env, session), /almacenamiento seguro/);
    assert.equal(calls.some(isWrite), false);
  });
});
