import { isIP } from 'node:net';

function isNonPublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return true;
  // IP literals are disallowed, including IPv6 and encoded IPv4 variants normalized by URL.
  // This probe is intended for named public HTTPS sites, not arbitrary network hosts.
  return isIP(host.replace(/^\[|\]$/g, '')) !== 0;
}
const ROUTES = Object.freeze(['/', '/edwin-crm.html', '/crm-demo.html']);
const PAGE_TITLES = Object.freeze(['Edwin CRM · Panel', 'Edwin CRM | Cada prospecto cuenta', 'Edwin CRM · Demostración de seguimiento comercial']);
export function validateBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Se requiere una URL HTTPS válida.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || url.port || isNonPublicHost(url.hostname) || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Usa un dominio público HTTPS, sin IP, puertos, credenciales, rutas ni parámetros.');
  }
  return url.origin;
}
export async function probePublicRoutes(base, fetcher = fetch) {
  const origin = validateBaseUrl(base);
  const results = [];
  for (const [index, route] of ROUTES.entries()) {
    try {
      const response = await fetcher(origin + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
      const type = response.headers.get('content-type') || '';
      const htmlOk = response.status === 200 && /^text\/html(?:\s*;|$)/i.test(type);
      const body = htmlOk ? await response.text() : '';
      const pageOk = htmlOk && body.includes('<title>' + PAGE_TITLES[index] + '</title>');
      results.push({ route, ok: pageOk, status: response.status, contentType: type.split(';')[0], ...(htmlOk && !pageOk ? { error: 'unexpected_page' } : {}) });
    } catch (error) {
      results.push({ route, ok: false, status: null, error: error?.name === 'TimeoutError' ? 'timeout' : 'network_error' });
    }
  }
  return { origin, passed: results.every((r) => r.ok), results, limitation: 'Verifica títulos de las tres páginas públicas y respuestas HTTP; no confirma commit desplegado, login, Auth, RLS ni pagos.' };
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) { console.error('Uso: node scripts/probe-public-routes.mjs https://dominio-autorizado.example'); process.exitCode = 2; }
  else {
    try { const report = await probePublicRoutes(base); console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1; }
    catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
