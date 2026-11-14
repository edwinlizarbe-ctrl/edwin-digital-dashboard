import test from 'node:test';
import assert from 'node:assert/strict';
import { probePublicRoutes } from '../scripts/probe-public-routes.mjs';

const expected = ['Edwin CRM · Panel', 'Edwin CRM | Cada prospecto cuenta', 'Edwin CRM · Demostración de seguimiento comercial'];
function fakeFetch(htmls) {
  let index = 0;
  return async () => new Response(htmls[index++], { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
test('rejects a matching title that only appears in the body', async () => {
  const pages = expected.map((title) => '<html><head><title>Other</title></head><body><title>' + title + '</title></body></html>');
  const report = await probePublicRoutes('https://example.com', fakeFetch(pages));
  assert.equal(report.passed, false);
  assert.deepEqual(report.results.map((r) => r.ok), [false, false, false]);
});
test('ignores body title markup when the head has the expected title', async () => {
  const pages = expected.map((title) => '<html><head><title>' + title + '</title></head><body><title>Fake</title></body></html>');
  const report = await probePublicRoutes('https://example.com', fakeFetch(pages));
  assert.equal(report.passed, true);
});
test('rejects a missing head even when a matching title is in body', async () => {
  const pages = expected.map((title) => '<html><body><title>' + title + '</title></body></html>');
  const report = await probePublicRoutes('https://example.com', fakeFetch(pages));
  assert.equal(report.passed, false);
});
