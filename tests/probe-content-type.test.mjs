import test from 'node:test';
import assert from 'node:assert/strict';
import { probePublicRoutes } from '../scripts/probe-public-routes.mjs';

const titles = ['Edwin CRM · Panel', 'Edwin CRM | Cada prospecto cuenta', 'Edwin CRM · Demostración de seguimiento comercial'];
function fetcher(contentType) {
  let index = 0;
  return async () => new Response('<html><head><title>' + titles[index++] + '</title></head><body></body></html>', { status: 200, headers: { 'content-type': contentType } });
}
test('probe accepts optional whitespace before HTML content-type parameters', async () => {
  const report = await probePublicRoutes('https://example.com', fetcher('text/html ; charset=utf-8'));
  assert.equal(report.passed, true);
  assert.equal(report.results.length, 3);
});
test('probe rejects a different MIME type even with parameters', async () => {
  const report = await probePublicRoutes('https://example.com', fetcher('text/plain; charset=utf-8'));
  assert.equal(report.passed, false);
  assert.ok(report.results.every(result => !result.ok));
});
