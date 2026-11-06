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
function hasExpectedTitle(html, expected) {
  // Allow harmless HTML formatting while requiring exactly one matching page title.
  const titles = [...html.matchAll(/<title(?:\s[^>]*)?>([^<]*)<\/title\s*>/gi)];
  return titles.length === 1 && titles[0][1].trim() === expected;
}
export async function probePublicRoutes(base, fetcher = fetch) {
  const origin = validateBaseUrl(base);
  const results = [];
  for (const [index, route] of ROUTES.entries()) {
    try {
      const response = await fetcher(origin + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
      const type = response.headers.get('content-type') || '';
      const htmlOk = response.status === 200 && /^text\/html(?:\s*;|$)/i.test(type);
      // Avoid loading an arbitrarily large HTML response into memory during diagnostics.
      const declaredBytes = Number(response.headers.get('content-length'));
      const oversized = htmlOk && Number.isFinite(declaredBytes) && declaredBytes > 0 && declaredBytes > 262144;
      let body = '';
      if (htmlOk && !oversized) {
        if (response.body?.getReader) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let bytes = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += value.byteLength;
              if (bytes > 262144) { body = ''; break; }
              body += decoder.decode(value, { stream: true });
            }
            if (bytes <= 262144) body += decoder.decode();
          } finally { await reader.cancel().catch(() => {}); }
        } else {
          // Supports minimal test fetchers without a ReadableStream.
          body = await response.text();
          if (new TextEncoder().encode(body).byteLength > 262144) body = '';
        }
      }
      const pageOk = htmlOk && !oversized && hasExpectedTitle(body, PAGE_TITLES[index]);
      results.push({ route, ok: pageOk, status: response.status, contentType: type.split(';')[0], ...(htmlOk && !pageOk ? { error: oversized || !body ? 'invalid_or_oversized_html' : 'unexpected_page' } : {}) });
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
