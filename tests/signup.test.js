import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleSignup, handleOnboardingBusiness, validateSignupInput, validateBusinessName, isReservedBusinessName } from '../signup.js';

const base = 'https://crm.example.workers.dev';
const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-test' };
const session = { user: { id: '11111111-1111-4111-8111-111111111111', role: 'client' }, access: 'jwt-user', cookies: [] };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
const req = (path, body, { origin = base, type = 'application/json', method = 'POST', raw } = {}) => new Request(base + path, {
  method, headers: { 'Content-Type': type, ...(origin ? { Origin: origin } : {}) }, ...(method === 'GET' ? {} : { body: raw ?? JSON.stringify(body) }),
});
async function withFetch(handler, fn) {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init); };
  try { await fn(calls); } finally { globalThis.fetch = original; }
}
const good = { email: 'Nuevo@Empresa.com', password: 'clave-segura-123', confirm: 'clave-segura-123' };

test('validates signup input', () => {
  assert.equal(validateSignupInput(good).email, 'nuevo@empresa.com');
  assert.ok(validateSignupInput({ ...good, password: 'corta', confirm: 'corta' }).error);
  assert.ok(validateSignupInput({ ...good, confirm: 'otra-distinta-1' }).error);
  assert.ok(validateSignupInput({ ...good, email: 'no-es-correo' }).error);
  assert.ok(validateSignupInput({ ...good, password: 'x'.repeat(129), confirm: 'x'.repeat(129) }).error);
  assert.ok(validateSignupInput(null).error);
  assert.ok(validateSignupInput({ email: 1, password: 2, confirm: 3 }).error);
});

test('signup rejects foreign origin, non-JSON, oversize and bad JSON without calling Supabase', async () => {
  await withFetch(() => { throw Error('no debe llamarse'); }, async (calls) => {
    assert.equal((await handleSignup(req('/api/auth/signup', good, { origin: 'https://evil.example' }), env)).status, 403);
    assert.equal((await handleSignup(req('/api/auth/signup', good, { type: 'text/plain' }), env)).status, 415);
    assert.equal((await handleSignup(req('/api/auth/signup', null, { raw: JSON.stringify({ ...good, x: 'a'.repeat(5000) }) }), env)).status, 413);
    assert.equal((await handleSignup(req('/api/auth/signup', null, { raw: '{no' }), env)).status, 400);
    assert.equal((await handleSignup(req('/api/auth/signup', good, { method: 'PUT' }), env)).status, 405);
    assert.equal(calls.length, 0);
  });
});

test('signup sends only email/password with anon key, same-origin redirect, never role, never cookies', async () => {
  await withFetch(() => json({ id: 'u1', email: 'nuevo@empresa.com' }), async (calls) => {
    const r = await handleSignup(req('/api/auth/signup', { ...good, role: 'admin', data: { role: 'admin' }, business_id: 'x' }), env);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Set-Cookie'), null);
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.ok(url.startsWith('https://project.supabase.co/auth/v1/signup?redirect_to='));
    assert.equal(new URL(url).searchParams.get('redirect_to'), base + '/');
    assert.equal(init.headers.apikey, 'anon-test');
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), ['email', 'password']);
  });
});

test('signup response is identical for new and existing emails (anti-enumeration) and issues no cookies', async () => {
  let existing;
  await withFetch(() => (existing ? json({ id: 'u1', identities: [] }) : json({ id: 'u2' })), async () => {
    existing = false; const a = await handleSignup(req('/api/auth/signup', good), env);
    existing = true; const b = await handleSignup(req('/api/auth/signup', good), env);
    assert.equal(a.status, b.status);
    assert.deepEqual(await a.json(), await b.json());
  });
  // Si Supabase devolviera sesión (confirmación desactivada), jamás se reenvían tokens ni cookies.
  await withFetch(() => json({ access_token: 'tok', refresh_token: 'r', user: {} }), async () => {
    const r = await handleSignup(req('/api/auth/signup', good), env);
    const text = JSON.stringify(await r.json());
    assert.equal(r.status, 503, 'Si confirm email está desactivado, el registro NO debe informar éxito');
    assert.equal(r.headers.get('Set-Cookie'), null);
    assert.equal(text.includes('tok'), false);
  });
});

test('signup maps rate limits and upstream failures', async () => {
  await withFetch(() => json({}, 429), async () => assert.equal((await handleSignup(req('/api/auth/signup', good), env)).status, 429));
  await withFetch(() => json({}, 500), async () => assert.equal((await handleSignup(req('/api/auth/signup', good), env)).status, 502));
  await withFetch(() => json({ error_code: 'weak_password' }, 422), async () => assert.equal((await handleSignup(req('/api/auth/signup', good), env)).status, 400));
  await withFetch(() => json({ error_code: 'email_exists' }, 422), async () => assert.equal((await handleSignup(req('/api/auth/signup', good), env)).status, 200));
  await withFetch(() => json({ error_code: 'user_already_exists' }, 400), async () => assert.equal((await handleSignup(req('/api/auth/signup', good), env)).status, 200));
});

test('business names: length, characters and reserved names', () => {
  assert.equal(validateBusinessName({ name: '  Mi   Tienda  ' }).name, 'Mi Tienda');
  assert.ok(validateBusinessName({ name: 'a' }).error);
  assert.ok(validateBusinessName({ name: 'a'.repeat(81) }).error);
  assert.ok(validateBusinessName({ name: '<script>' }).error);
  assert.ok(validateBusinessName({}).error);
  for (const n of ['Edwin Digital', 'EDWIN-digital', 'edwín  digital', 'BrasPer', 'Bras Per', 'Admin', 'CRM']) {
    assert.equal(isReservedBusinessName(n), true, n);
    assert.ok(validateBusinessName({ name: n }).error, n);
  }
  assert.equal(isReservedBusinessName('Panadería Edwin y Hijos'), false);
});

test('onboarding requires a client session and rejects foreign origin / client-supplied identity', async () => {
  await withFetch(() => json([]), async (calls) => {
    const admin = { ...session, user: { ...session.user, role: 'admin' } };
    assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, admin)).status, 403);
    assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }, { origin: 'https://evil.example' }), env, session)).status, 403);
    assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Edwin Digital' }), env, session)).status, 400);
    assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }, { method: 'GET', raw: undefined }), env, session)).status, 405);
    assert.equal(calls.length, 0);
  });
});

test('onboarding calls the RPC with user JWT, only the name, and ignores user_id/business_id/role from client', async () => {
  await withFetch(() => json([{ id: '22222222-2222-4222-8222-222222222222', name: 'Mi Tienda', slug: 'crm-abc', created: true }]), async (calls) => {
    const r = await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda', user_id: 'other', business_id: 'other', role: 'admin' }), env, session);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.business.name, 'Mi Tienda');
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, 'https://project.supabase.co/rest/v1/rpc/ed_onboard_business');
    assert.equal(init.headers.Authorization, 'Bearer jwt-user');
    assert.equal(init.headers.apikey, 'anon-test');
    assert.deepEqual(JSON.parse(init.body), { p_name: 'Mi Tienda' });
  });
});

test('onboarding is idempotent from the API point of view and maps RPC errors', async () => {
  const row = { id: '22222222-2222-4222-8222-222222222222', name: 'Mi Tienda', slug: 'crm-abc' };
  let n = 0;
  await withFetch(() => json([{ ...row, created: n++ === 0 }]), async () => {
    const a = await (await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).json();
    const b = await (await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).json();
    assert.equal(a.business.id, b.business.id);
    assert.equal(a.created, true);
    assert.equal(b.created, false);
  });
  await withFetch(() => json({ message: 'reserved_name' }, 400), async () => assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).status, 400));
  await withFetch(() => json({ message: 'not_allowed' }, 403), async () => assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).status, 403));
  await withFetch(() => json({ message: 'email_unverified' }, 403), async () => assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).status, 403));
  await withFetch(() => json({}, 404), async () => assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).status, 503));
  await withFetch(() => json({ message: 'boom' }, 500), async () => assert.equal((await handleOnboardingBusiness(req('/api/onboarding/business', { name: 'Mi Tienda' }), env, session)).status, 502));
});

test('migration keeps RLS on, restricts privileges and derives the user from auth.uid()', () => {
  const sql = readFileSync(new URL('../migrations/20261018_self_service_onboarding.sql', import.meta.url), 'utf8');
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = pg_catalog, public/i);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /auth\.users u where u\.id = v_uid and u\.email_confirmed_at is not null/i);
  assert.match(sql, /p\.role = 'client'/);
  assert.match(sql, /user_id uuid primary key/i);
  assert.match(sql, /revoke all on function public\.ed_onboard_business\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.ed_onboard_business\(text\) to authenticated/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /disable row level security/i);
  assert.doesNotMatch(sql, /grant[^;]*to (anon|public)/i);
  assert.doesNotMatch(sql, /(create|drop|alter)\s+(or replace\s+)?trigger/i);
  assert.doesNotMatch(sql, /role\s*=\s*'admin'\s*(where|,)/i);
});
