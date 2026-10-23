/**
 * Recuperación de contraseña por correo (Supabase Auth, solo anon key; nunca service_role).
 * - request-reset: POST /auth/v1/recover con redirect_to same-origin allowlisted. Respuesta idéntica exista o no el correo.
 * - reset-password: el cliente entrega el access_token de recuperación (fragmento #type=recovery, solo en memoria) y la
 *   contraseña nueva; se actualiza con PUT /auth/v1/user usando ese Bearer. Nunca emite cookies ni inicia sesión.
 * Límite documentado: Supabase no expone un claim "recovery" firmado; solo se puede inspeccionar `amr` del JWT
 * (sin verificar firma; la firma la verifica Supabase en el PUT). Un token de sesión normal (amr password/oauth…)
 * se rechaza. Las cookies HttpOnly de sesión nunca se usan aquí. /api/auth/change-password no se modifica.
 */
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: new Headers(HEADERS) });
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const RESET_REDIRECT_PATH = '/?reset=1';
export const RESET_LIMIT = 2048;
export const RESET_OK = 'Si el correo está registrado, te enviamos instrucciones para restablecer tu contraseña. Revisa tu bandeja y la carpeta de spam.';

const foreignOrigin = (req) => { const o = req.headers.get('Origin'); return !!o && o !== new URL(req.url).origin; };
async function readJson(req) {
  if (!(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return { status: 415, error: 'Se requiere JSON.' };
  const declared = req.headers.get('Content-Length');
  if (declared && Number(declared) > RESET_LIMIT) return { status: 413, error: 'Solicitud demasiado grande.' };
  const text = await req.text();
  if (text.length > RESET_LIMIT) return { status: 413, error: 'Solicitud demasiado grande.' };
  try { return { body: JSON.parse(text) }; } catch { return { status: 400, error: 'Solicitud no válida.' }; }
}
const base = (env) => String(env.SUPABASE_URL).replace(/\/$/, '');

export function validateResetEmail(email) {
  if (typeof email !== 'string') return null;
  const e = email.trim().toLowerCase();
  return e.length >= 6 && e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export async function handleRequestReset(req, env) {
  if (req.method.toUpperCase() !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
  if (foreignOrigin(req)) return reply({ error: 'Origen no autorizado.' }, 403);
  const parsed = await readJson(req);
  if (parsed.error) return reply({ error: parsed.error }, parsed.status);
  if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) return reply({ error: 'Solicitud no válida.' }, 400);
  const email = validateResetEmail(parsed.body.email);
  if (!email) return reply({ error: 'Escribe un correo electrónico válido.' }, 400);
  const redirect = new URL(req.url).origin + RESET_REDIRECT_PATH;
  let res;
  try {
    res = await fetch(`${base(env)}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch { return reply({ error: 'No se pudo contactar el servicio de correo. Inténtalo más tarde.' }, 502); }
  if (res.status === 429) return reply({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
  if (res.status >= 500) return reply({ error: 'El servicio de correo no está disponible. Inténtalo más tarde.' }, 502);
  // Usuario inexistente o sin confirmar: misma respuesta que el éxito (anti-enumeración).
  if (res.status === 400 || res.status === 422) {
    const d = await res.json().catch(() => ({}));
    const code = String(d.error_code || d.code || '').toLowerCase();
    if (/validation|email_address_invalid/.test(code)) return reply({ error: 'Escribe un correo electrónico válido.' }, 400);
    if (/over_email_send_rate_limit|over_request_rate_limit/.test(code)) return reply({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
    if (/smtp|email_provider|unexpected_failure/.test(code)) return reply({ error: 'El servicio de correo no está disponible. Inténtalo más tarde.' }, 502);
    return reply({ ok: true, message: RESET_OK });
  }
  if (res.status >= 400) return reply({ error: 'No se pudo procesar la solicitud. Inténtalo de nuevo.' }, 502);
  return reply({ ok: true, message: RESET_OK });
}

/** Decodifica el payload del JWT SIN verificar firma; solo prefiltro. Supabase valida en el PUT. */
export function recoveryClaims(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    const amr = Array.isArray(payload.amr) ? payload.amr : [];
    const latest = String(amr[0]?.method || '').toLowerCase();
    // El enlace de recuperación genera amr[0] = otp/recovery. Un login con contraseña u OAuth no es válido aquí.
    if (!['otp', 'recovery'].includes(latest)) return null;
    return payload;
  } catch { return null; }
}

export async function handleResetPassword(req, env) {
  if (req.method.toUpperCase() !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
  if (foreignOrigin(req)) return reply({ error: 'Origen no autorizado.' }, 403);
  const parsed = await readJson(req);
  if (parsed.error) return reply({ error: parsed.error }, parsed.status);
  const b = parsed.body;
  if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.password !== 'string' || typeof b.confirm !== 'string') return reply({ error: 'Solicitud no válida.' }, 400);
  if (b.password.length < 10 || b.password.length > 128) return reply({ error: 'La contraseña debe tener entre 10 y 128 caracteres.' }, 400);
  if (b.password !== b.confirm) return reply({ error: 'Las contraseñas no coinciden.' }, 400);
  const LINK_ERR = 'El enlace de recuperación no es válido o expiró. Solicita uno nuevo.';
  if (!recoveryClaims(b.access_token)) return reply({ error: LINK_ERR }, 401);
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${b.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  let res;
  try { res = await fetch(`${base(env)}/auth/v1/user`, { method: 'PUT', headers, body: JSON.stringify({ password: b.password }) }); }
  catch { return reply({ error: 'No se pudo contactar el servicio de autenticación. Inténtalo más tarde.' }, 502); }
  if (res.status === 429) return reply({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
  if (res.status === 401 || res.status === 403) return reply({ error: LINK_ERR }, 401);
  if (res.status >= 500) return reply({ error: 'El servicio de autenticación no está disponible. Inténtalo más tarde.' }, 502);
  if (res.status === 422 || res.status === 400) {
    const d = await res.json().catch(() => ({}));
    const code = String(d.error_code || d.code || '').toLowerCase();
    if (/weak_password/.test(code)) return reply({ error: 'La contraseña es demasiado débil. Usa una más larga y menos común.' }, 400);
    if (/same_password/.test(code)) return reply({ error: 'Elige una contraseña diferente de la anterior.' }, 400);
    if (/session_not_found|bad_jwt|no_authorization/.test(code)) return reply({ error: LINK_ERR }, 401);
    return reply({ error: 'No se pudo actualizar la contraseña. Inténtalo de nuevo.' }, 400);
  }
  if (!res.ok) return reply({ error: 'No se pudo actualizar la contraseña. Inténtalo de nuevo.' }, 502);
  // Cierra todas las sesiones (best effort); no se emiten cookies ni se inicia sesión.
  try { await fetch(`${base(env)}/auth/v1/logout?scope=global`, { method: 'POST', headers }); } catch { /* best effort */ }
  return reply({ ok: true, message: 'Contraseña actualizada. Ingresa con tu contraseña nueva.' });
}
