import { isIP } from 'node:net';

function isNonPublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return true;
  // IP literals are disallowed, including IPv6 and encoded IPv4 variants normalized by URL.
  // This probe is intended for named public HTTPS sites, not arbitrary network hosts.
  return isIP(host.replace(/^\[|\]$/g, '')) !== 0;
}
const ROUTES = Object.freeze(['/', '/edwin-crm.html', '/crm-demo.html']);
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
  for (const route of ROUTES) {
    try {
      const response = await fetcher(origin + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
      const type = response.headers.get('content-type') || '';
      const ok = response.status === 200 && /^text\/html(?:\s*;|$)/i.test(type);
      results.push({ route, ok, status: response.status, contentType: type.split(';')[0] });
    } catch (error) {
      results.push({ route, ok: false, status: null, error: error?.name === 'TimeoutError' ? 'timeout' : 'network_error' });
    }
  }
  return { origin, passed: results.every((r) => r.ok), results, limitation: 'Solo verifica respuestas HTTP públicas; no confirma commit desplegado, login, Auth, RLS ni pagos.' };
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) { console.error('Uso: node scripts/probe-public-routes.mjs https://dominio-autorizado.example'); process.exitCode = 2; }
  else {
    try { const report = await probePublicRoutes(base); console.log(JSON.stringify(report, null, 2)); if (!report.passed) process.exitCode = 1; }
    catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
