import test from 'node:test';
import assert from 'node:assert/strict';
import { probePublicRoutes, validateBaseUrl } from '../scripts/probe-public-routes.mjs';
const response = (status = 200, type = 'text/html; charset=utf-8') => ({ status, headers: new Headers({ 'content-type': type }) });
test('rutas públicas correctas: 3 respuestas HTML y sin datos empresariales', async () => {
  const urls = [];
  const result = await probePublicRoutes('https://crm.example', async (url, options) => { urls.push([url, options.method, options.redirect]); return response(); });
  assert.equal(result.passed, true);
  assert.deepEqual(urls.map((x) => x[0]), ['https://crm.example/', 'https://crm.example/edwin-crm.html', 'https://crm.example/crm-demo.html']);
  assert.ok(urls.every((x) => x[1] === 'GET' && x[2] === 'manual'));
  assert.ok(!JSON.stringify(result).includes('business_id'));
});
test('rechaza redirects, fallos HTML y respuestas no HTML', async () => {
  const statuses = [response(302), response(404), response(200, 'application/json')];
  const result = await probePublicRoutes('https://crm.example', async () => statuses.shift());
  assert.equal(result.passed, false);
  assert.deepEqual(result.results.map((r) => r.ok), [false, false, false]);
});
test('rechaza URL con credenciales, HTTP, parámetros o rutas', () => {
  for (const url of ['http://crm.example', 'https://a:b@crm.example', 'https://crm.example/login', 'https://crm.example/?token=x', 'not-a-url']) assert.throws(() => validateBaseUrl(url));
});
test('fallo de red no detiene comprobaciones posteriores', async () => {
  let count = 0;
  const result = await probePublicRoutes('https://crm.example', async () => { if (++count === 1) throw Error('offline'); return response(); });
  assert.equal(result.passed, false);
  assert.equal(result.results.length, 3);
  assert.equal(result.results[0].error, 'network_error');
});

test('impide inspeccionar hosts locales, IP y servicios internos', () => {
  for (const url of [
    'https://localhost', 'https://app.localhost', 'https://service.internal',
    'https://printer.local', 'https://intranet',
    'https://127.0.0.1', 'https://10.0.0.2', 'https://192.168.1.2',
    'https://[::1]', 'https://crm.example:8443'
  ]) assert.throws(() => validateBaseUrl(url), url);
  assert.equal(validateBaseUrl('https://crm.example/'), 'https://crm.example');
});
test('un host no permitido nunca ejecuta solicitudes ni accede a empresas', async () => {
  let requests = 0;
  await assert.rejects(probePublicRoutes('https://localhost', async () => { requests++; return response(); }));
  assert.equal(requests, 0);
});
