import {isIP} from 'node:net';
// Read-only public-route smoke test. No credentials, cookies, POSTs or writes.
const REQUEST_TIMEOUT_MS = 8000;
const ROUTES = ['/', '/edwin-crm.html', '/crm-demo.html', '/crm-followup-simulator.html'];
export function validateOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !url.hostname || url.port) {
    throw new Error('Provide an HTTPS origin only, without credentials, path, port or query');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isIP(host) || host === 'localhost' || ['.localhost', '.local', '.internal'].some(suffix => host.endsWith(suffix))) {
    throw new Error('IP literals and local/internal hostnames are not permitted');
  }
  return url.origin;
}
export async function smokePublicRoutes(origin, fetcher = fetch) {
  const base = validateOrigin(origin);
  const results = [];
  for (const path of ROUTES) {
    try {
      const response = await fetcher(base + path, {method:'GET', redirect:'manual', credentials:'omit', cache:'no-store', headers:{Accept:'text/html'}, signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
      const type = response.headers.get('content-type') || '';
      const length = response.headers.get('content-length');
      // A declared empty document is not a usable landing page; absent length is normal for chunked responses.
      const nonempty = length === null || !/^\s*0\s*$/.test(length);
      const ok = response.status === 200 && /^text\/html(?:\s*;|\s*$)/i.test(type.trim()) && nonempty;
      results.push({path, status:response.status, ok});
    } catch {
      results.push({path, status:null, ok:false});
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const origin = process.argv[2];
  if (!origin) { console.error('Usage: node scripts/smoke-public-routes.mjs https://your-verified-domain'); process.exitCode=2; }
  else {
    try {
      const results = await smokePublicRoutes(origin);
      for (const r of results) console.log((r.ok?'OK':'FAIL') + ' ' + r.path + ' HTTP ' + (r.status ?? 'network-error'));
      console.log('Read-only HTTP check only. Does NOT verify deployment SHA, Supabase Auth, RLS or payment readiness.');
      if (results.some(r=>!r.ok)) process.exitCode=1;
    } catch(e) { console.error(e.message); process.exitCode=2; }
  }
}
