import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleRequestReset, handleResetPassword, recoveryClaims, validateResetEmail, RESET_OK } from '../password-reset.js';

const base = 'https://crm.example.workers.dev';
const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-test' };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
const req = (path, body, { origin = base, type = 'application/json', method = 'POST', raw } = {}) => new Request(base + path, {
  method, headers: { 'Content-Type': type, ...(origin ? { Origin: origin } : {}) }, ...(method === 'GET' ? {} : { body: raw ?? JSON.stringify(body) }),
});
async function withFetch(handler, fn) {
  const original = globalThis.fetch, calls = [], logs = [], origErr = console.error, origLog = console.log;
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init); };
  console.error = (...a) => logs.push(a.join(' ')); console.log = (...a) => logs.push(a.join(' '));
  try { await fn(calls, logs); } finally { globalThis.fetch = original; console.error = origErr; console.log = origLog; }
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (claims) => `${b64({ alg: 'HS256' })}.${b64(claims)}.sig_part_abcdefghij`;
const exp = () => Math.floor(Date.now() / 1000) + 600;
const recoveryToken = () => jwt({ exp: exp(), amr: [{ method: 'otp' }] });
const goodPw = { password: 'clave-nueva-123', confirm: 'clave-nueva-123' };

test('validateResetEmail normalizes and rejects', () => {
  assert.equal(validateResetEmail(' Ana@Empresa.COM '), 'ana@empresa.com');
  assert.equal(validateResetEmail('no-es-correo'), null);
  assert.equal(validateResetEmail(5), null);
  assert.equal(validateResetEmail('a@b.co' + 'x'.repeat(260)), null);
});

test('request-reset rejects method, origin, type, size, malformed body without calling Supabase', async () => {
  await withFetch(() => { throw Error('no debe llamarse'); }, async (calls) => {
    const p = '/api/auth/request-reset', ok = { email: 'a@empresa.com' };
    assert.equal((await handleRequestReset(req(p, ok, { method: 'GET' }), env)).status, 405);
    assert.equal((await handleRequestReset(req(p, ok, { origin: 'https://evil.example' }), env)).status, 403);
    assert.equal((await handleRequestReset(req(p, ok, { type: 'text/plain' }), env)).status, 415);
    assert.equal((await handleRequestReset(req(p, null, { raw: JSON.stringify({ email: 'a@b.co', x: 'a'.repeat(3000) }) }), env)).status, 413);
    assert.equal((await handleRequestReset(req(p, null, { raw: '{no' }), env)).status, 400);
    assert.equal((await handleRequestReset(req(p, [1]), env)).status, 400);
    assert.equal((await handleRequestReset(req(p, { email: 'malo' }), env)).status, 400);
    assert.equal(calls.length, 0);
  });
});

test('request-reset uses anon key, same-origin allowlisted redirect, only email, no cookies, no-store', async () => {
  await withFetch(() => json({}), async (calls) => {
    const r = await handleRequestReset(req('/api/auth/request-reset', { email: 'Ana@Empresa.com', role: 'admin', redirect_to: 'https://evil.example' }), env);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Set-Cookie'), null);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.ok(url.startsWith('https://project.supabase.co/auth/v1/recover?redirect_to='));
    assert.equal(new URL(url).searchParams.get('redirect_to'), base + '/?reset=1');
    assert.equal(init.headers.apikey, 'anon-test');
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), { email: 'ana@empresa.com' });
  });
});

test('request-reset is identical for existing and unknown emails (anti-enumeration)', async () => {
  let mode;
  await withFetch(() => (mode === 'unknown' ? json({ error_code: 'user_not_found', msg: 'x' }, 400) : mode === 'unconfirmed' ? json({ error_code: 'email_not_confirmed' }, 422) : json({})), async () => {
    const out = [];
    for (mode of ['exists', 'unknown', 'unconfirmed']) {
      const r = await handleRequestReset(req('/api/auth/request-reset', { email: 'ana@empresa.com' }), env);
      out.push([r.status, await r.text()]);
    }
    assert.equal(out[0][0], 200);
    assert.deepEqual(out[1], out[0]);
    assert.deepEqual(out[2], out[0]);
    assert.ok(out[0][1].includes(RESET_OK));
  });
});

test('request-reset handles 429, provider errors and network failure', async () => {
  let h;
  await withFetch(() => h(), async () => {
    h = () => json({}, 429);
    assert.equal((await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env)).status, 429);
    h = () => json({ error_code: 'over_email_send_rate_limit' }, 429);
    assert.equal((await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env)).status, 429);
    h = () => json({ error_code: 'over_email_send_rate_limit' }, 400);
    assert.equal((await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env)).status, 429);
    h = () => json({}, 500);
    assert.equal((await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env)).status, 502);
    h = () => json({ error_code: 'unexpected_failure', msg: 'smtp host' }, 500);
    const r = await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env);
    assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('smtp host'));
    h = () => { throw new Error('red'); };
    assert.equal((await handleRequestReset(req('/api/auth/request-reset', { email: 'a@empresa.com' }), env)).status, 502);
  });
});

test('recoveryClaims accepts only fresh otp/recovery tokens, rejects password/oauth/expired/malformed', () => {
  assert.ok(recoveryClaims(recoveryToken()));
  assert.ok(recoveryClaims(jwt({ exp: exp(), amr: [{ method: 'recovery' }] })));
  assert.equal(recoveryClaims(jwt({ exp: exp(), amr: [{ method: 'password' }] })), null);
  assert.equal(recoveryClaims(jwt({ exp: exp(), amr: [{ method: 'oauth' }, { method: 'otp' }] })), null);
  assert.equal(recoveryClaims(jwt({ exp: exp() }), null), null);
  assert.equal(recoveryClaims(jwt({ exp: 1, amr: [{ method: 'otp' }] })), null);
  assert.equal(recoveryClaims('no-es-jwt'), null);
  assert.equal(recoveryClaims('a.b.c'), null);
  assert.equal(recoveryClaims(undefined), null);
});

test('reset-password validates method, origin, body, passwords and token before calling Supabase', async () => {
  await withFetch(() => { throw Error('no debe llamarse'); }, async (calls) => {
    const p = '/api/auth/reset-password', t = recoveryToken();
    assert.equal((await handleResetPassword(req(p, {}, { method: 'GET' }), env)).status, 405);
    assert.equal((await handleResetPassword(req(p, { access_token: t, ...goodPw }, { origin: 'https://evil.example' }), env)).status, 403);
    assert.equal((await handleResetPassword(req(p, {}, { type: 'text/plain' }), env)).status, 415);
    assert.equal((await handleResetPassword(req(p, null, { raw: '{no' }), env)).status, 400);
    assert.equal((await handleResetPassword(req(p, null, { raw: JSON.stringify({ access_token: 'x'.repeat(3000) }) }), env)).status, 413);
    assert.equal((await handleResetPassword(req(p, { access_token: t, password: 'corta', confirm: 'corta' }), env)).status, 400);
    assert.equal((await handleResetPassword(req(p, { access_token: t, password: 'x'.repeat(129), confirm: 'x'.repeat(129) }), env)).status, 400);
    assert.equal((await handleResetPassword(req(p, { access_token: t, password: 'clave-nueva-123', confirm: 'otra-distinta-1' }), env)).status, 400);
    assert.equal((await handleResetPassword(req(p, { password: 1, confirm: 2, access_token: t }), env)).status, 400);
    assert.equal((await handleResetPassword(req(p, { ...goodPw }), env)).status, 401);
    assert.equal((await handleResetPassword(req(p, { access_token: jwt({ exp: exp(), amr: [{ method: 'password' }] }), ...goodPw }), env)).status, 401);
    assert.equal(calls.length, 0);
  });
});

test('reset-password ignores session cookies, updates with anon key + recovery bearer, no cookies, no secrets in logs', async () => {
  const t = recoveryToken();
  await withFetch((url) => (url.includes('/logout') ? new Response(null, { status: 204 }) : json({ id: 'u1' })), async (calls, logs) => {
    const r = new Request(base + '/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: 'ed_access=cookie-jwt; ed_refresh=cookie-refresh' },
      body: JSON.stringify({ access_token: t, ...goodPw }),
    });
    const res = await handleResetPassword(r, env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Set-Cookie'), null);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const text = await res.text();
    assert.ok(!text.includes(t) && !text.includes('clave-nueva-123'));
    const put = calls[0];
    assert.equal(put.url, 'https://project.supabase.co/auth/v1/user');
    assert.equal(put.init.method, 'PUT');
    assert.equal(put.init.headers.Authorization, `Bearer ${t}`);
    assert.equal(put.init.headers.apikey, 'anon-test');
    assert.equal(put.init.headers.Cookie, undefined);
    assert.deepEqual(JSON.parse(put.init.body), { password: 'clave-nueva-123' });
    assert.ok(calls[1].url.includes('/auth/v1/logout?scope=global'));
    assert.ok(calls.every(c => !JSON.stringify(c.init.headers).includes('cookie-jwt')));
    assert.deepEqual(logs, []);
  });
});

test('reset-password maps upstream failures without leaking token or password', async () => {
  const t = recoveryToken();
  let h;
  await withFetch(() => h(), async (calls, logs) => {
    const go = () => handleResetPassword(req('/api/auth/reset-password', { access_token: t, ...goodPw }), env);
    h = () => json({ msg: 'invalid JWT' }, 401); assert.equal((await go()).status, 401);
    h = () => json({ error_code: 'session_not_found' }, 403); assert.equal((await go()).status, 401);
    h = () => json({ error_code: 'weak_password' }, 422); assert.equal((await go()).status, 400);
    h = () => json({ error_code: 'same_password' }, 422); assert.equal((await go()).status, 400);
    h = () => json({}, 429); assert.equal((await go()).status, 429);
    h = () => json({ msg: t }, 500);
    const r = await go(); assert.equal(r.status, 502);
    const body = await r.text(); assert.ok(!body.includes(t) && !body.includes('clave-nueva-123'));
    h = () => { throw new Error('red ' + t); }; assert.equal((await go()).status, 502);
    assert.deepEqual(logs, []);
  });
});

test('worker routes new endpoints and leaves change-password and existing auth routes intact', () => {
  const w = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
  assert.match(w, /path === '\/api\/auth\/request-reset'\) return handleRequestReset/);
  assert.match(w, /path === '\/api\/auth\/reset-password'\) return handleResetPassword/);
  // Ambas rutas se resuelven antes de session(): no requieren ni usan cookies.
  assert.ok(w.indexOf('handleResetPassword(req, env)') < w.indexOf('const s = await session(req, env)'));
  assert.match(w, /path === '\/api\/auth\/change-password'/);
  assert.match(w, /La contraseña actual es incorrecta/);
  assert.match(w, /path === '\/api\/auth\/signup'\) return handleSignup/);
  assert.match(w, /path === '\/api\/auth\/login' && method === 'POST'/);
  const m = readFileSync(new URL('../password-reset.js', import.meta.url), 'utf8');
  assert.ok(!/service_role|SERVICE_ROLE|Set-Cookie|localStorage|console\./.test(m.replace(/^\/\*[\s\S]*?\*\//, '')));
});

test('frontend wires forgot-password link, strips recovery hash immediately, keeps token in memory only', () => {
  const a = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(a, /data-act="reset-open">¿Olvidaste tu contraseña\?/);
  assert.match(a, /\/api\/auth\/request-reset/);
  assert.match(a, /\/api\/auth\/reset-password/);
  const i = a.indexOf("inviteParams.get('type')==='recovery'");
  assert.ok(i > 0);
  const block = a.slice(i, i + 400);
  assert.ok(block.indexOf('history.replaceState') < block.indexOf('pendingRecovery=t'));
  assert.ok(!/localStorage\.setItem\([^)]*(recovery|access_token)/i.test(a));
  assert.ok(!/document\.cookie\s*=[^;]*(recovery|access_token)/i.test(a));
  assert.match(a, /No iniciaremos sesión automáticamente/);
});
