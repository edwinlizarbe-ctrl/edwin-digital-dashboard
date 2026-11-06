import test from 'node:test';
import assert from 'node:assert/strict';
import { probePublicRoutes, validateBaseUrl } from '../scripts/probe-public-routes.mjs';
const titles = ['Edwin CRM · Panel', 'Edwin CRM | Cada prospecto cuenta', 'Edwin CRM · Demostración de seguimiento comercial'];
const response = (status = 200, type = 'text/html; charset=utf-8', title = titles[0]) => ({ status, headers: new Headers({ 'content-type': type }), text: async () => '<!doctype html><title>' + title + '</title>' });
test('rutas públicas correctas: 3 respuestas HTML y sin datos empresariales', async () => {
  const urls = [];
  const result = await probePublicRoutes('https://crm.example', async (url, options) => { urls.push([url, options.method, options.redirect]); return response(200, 'text/html; charset=utf-8', titles[urls.length - 1]); });
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
  const result = await probePublicRoutes('https://crm.example', async () => { if (++count === 1) throw Error('offline'); return response(200, 'text/html; charset=utf-8', titles[count - 1]); });
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

test('rechaza fallback SPA que entrega la misma página HTTP 200 en rutas diferentes', async () => {
  const result = await probePublicRoutes('https://crm.example', async () => response());
  assert.equal(result.passed, false);
  assert.equal(result.results[0].ok, true);
  assert.deepEqual(result.results.slice(1).map((r) => r.error), ['unexpected_page', 'unexpected_page']);
});
test('rechaza HTML vacío y página de login genérica sin exponer datos de empresa', async () => {
  const result = await probePublicRoutes('https://crm.example', async () => response(200, 'text/html', 'Login'));
  assert.equal(result.passed, false);
  assert.ok(result.results.every((r) => r.error === 'unexpected_page'));
  assert.ok(!JSON.stringify(result).includes('business_id'));
});


test('rechaza HTML declarado demasiado grande sin leer el cuerpo', async () => {
  let reads = 0;
  const result = await probePublicRoutes('https://crm.example', async () => ({
    status: 200, headers: new Headers({'content-type':'text/html','content-length':'999999'}),
    text: async () => { reads++; return '<title>'+titles[0]+'</title>'; }
  }));
  assert.equal(result.passed, false);
  assert.equal(reads, 0);
  assert.ok(result.results.every(x => x.error === 'invalid_or_oversized_html'));
});
test('corta el stream al superar el límite aunque content-length sea falso', async () => {
  let cancels = 0;
  const result = await probePublicRoutes('https://crm.example', async () => ({
    status: 200, headers: new Headers({'content-type':'text/html','content-length':'10'}),
    body: {getReader: () => ({read: async () => ({done:false,value:new Uint8Array(262145)}),cancel:async()=>{cancels++;}})}
  }));
  assert.equal(result.passed, false);
  assert.equal(cancels, 3);
  assert.ok(result.results.every(x => !x.ok));
});


test('acepta títulos HTML equivalentes con espacios, atributos y mayúsculas', async () => {
  let index = 0;
  const result = await probePublicRoutes('https://crm.example', async () => ({
    status: 200, headers: new Headers({ 'content-type': 'text/html' }),
    text: async () => '<TITLE data-source="static">  ' + titles[index++] + '  </TITLE>'
  }));
  assert.equal(result.passed, true);
});
test('rechaza títulos duplicados o títulos parecidos para evitar falsos positivos', async () => {
  let index = 0;
  const result = await probePublicRoutes('https://crm.example', async () => ({
    status: 200, headers: new Headers({ 'content-type': 'text/html' }),
    text: async () => '<title>' + titles[index++] + '</title><title>Login</title>'
  }));
  assert.equal(result.passed, false);
  assert.ok(result.results.every((entry) => entry.error === 'unexpected_page'));
  assert.ok(!JSON.stringify(result).includes('business_id'));
});
