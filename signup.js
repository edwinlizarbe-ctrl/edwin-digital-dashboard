/**
 * Registro autoservicio (correo + contraseña) y creación de la primera empresa.
 * - Signup usa solo la anon key de Supabase Auth; no emite cookies ni acepta rol.
 * - Onboarding toma el usuario EXCLUSIVAMENTE de la sesión validada y llama al RPC
 *   transaccional public.ed_onboard_business (ver migrations/20261018_self_service_onboarding.sql).
 */
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const reply = (data, status = 200, cookies = []) => {
  const headers = new Headers(RESPONSE_HEADERS);
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(data), { status, headers });
};
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const RESERVED = new Set(['edwindigital', 'edwin', 'edigital', 'edwincrm', 'brasper', 'admin', 'administrador', 'crm']);

export function normalizeBusinessName(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}
export function isReservedBusinessName(name) {
  const key = normalizeBusinessName(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return RESERVED.has(key);
}
export function validateSignupInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Solicitud no válida.' };
  const { email, password, confirm } = input;
  if (typeof email !== 'string' || typeof password !== 'string' || typeof confirm !== 'string') return { error: 'Completa correo, contraseña y confirmación.' };
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length < 6 || cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) return { error: 'Escribe un correo electrónico válido.' };
  if (password.length < 10) return { error: 'La contraseña debe tener al menos 10 caracteres.' };
  if (password.length > 128) return { error: 'La contraseña no puede superar 128 caracteres.' };
  if (password !== confirm) return { error: 'Las contraseñas no coinciden.' };
  return { email: cleanEmail, password };
}
export function validateBusinessName(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.name !== 'string') return { error: 'Escribe el nombre de tu empresa.' };
  const name = normalizeBusinessName(input.name);
  if (name.length < 2 || name.length > 80) return { error: 'El nombre debe tener entre 2 y 80 caracteres.' };
  if (/[<>\u0000-\u001f\u007f]/.test(name)) return { error: 'El nombre contiene caracteres no permitidos.' };
  if (isReservedBusinessName(name)) return { error: 'Ese nombre está reservado. Elige otro nombre para tu empresa.' };
  return { name };
}
async function readJson(req, limit) {
  if (!(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return { status: 415, error: 'Se requiere JSON.' };
  const declared = req.headers.get('Content-Length');
  if (declared && Number(declared) > limit) return { status: 413, error: 'Solicitud demasiado grande.' };
  const text = await req.text();
  if (text.length > limit) return { status: 413, error: 'Solicitud demasiado grande.' };
  try { return { body: JSON.parse(text) }; } catch { return { status: 400, error: 'Solicitud no válida.' }; }
}
const foreignOrigin = (req) => { const o = req.headers.get('Origin'); return !!o && o !== new URL(req.url).origin; };

const SIGNUP_OK = 'Si el correo puede registrarse, te enviamos un mensaje para confirmar tu cuenta. Revisa tu bandeja y spam; después podrás ingresar.';

export async function handleSignup(req, env) {
  if (req.method.toUpperCase() !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
  if (foreignOrigin(req)) return reply({ error: 'Origen no autorizado.' }, 403);
  const parsed = await readJson(req, 4096);
  if (parsed.error) return reply({ error: parsed.error }, parsed.status);
  const v = validateSignupInput(parsed.body);
  if (v.error) return reply({ error: v.error }, 400);
  // Solo email/password y redirect same-origin: nunca se reenvían role, data ni otros campos del cliente.
  const origin = new URL(req.url).origin;
  let res;
  try {
    res = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/auth/v1/signup?redirect_to=${encodeURIComponent(origin + '/')}`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: v.email, password: v.password }),
    });
  } catch { return reply({ error: 'No se pudo contactar el servicio de registro. Inténtalo más tarde.' }, 502); }
  if (res.status === 429) return reply({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
  if (res.status >= 500) return reply({ error: 'El servicio de registro no está disponible. Inténtalo más tarde.' }, 502);
  if (res.status === 400 || res.status === 422) {
    const detail = await res.json().catch(() => ({}));
    const code = String(detail.error_code || detail.code || '').toLowerCase();
    if (/email_exists|user_already_exists|user_already_registered/.test(code)) return reply({ ok: true, message: SIGNUP_OK }, 200);
    if (/weak_password/.test(code)) return reply({ error: 'La contraseña es demasiado débil. Usa una más larga y menos común.' }, 400);
    if (/validation|email_address_invalid/.test(code)) return reply({ error: 'Escribe un correo electrónico válido.' }, 400);
    return reply({ error: 'No se pudo completar el registro. Revisa los datos e inténtalo de nuevo.' }, 400);
  }
  if (res.status >= 400) return reply({ error: 'No se pudo completar el registro. Inténtalo de nuevo.' }, 400);
  // Respuesta idéntica exista o no el correo (anti-enumeración). Nunca se emiten cookies.
  const data = res.ok ? await res.json().catch(() => ({})) : {};
  if (data && data.access_token) {
    console.error('SUPABASE AUTH: Confirm email no está activo; no habilitar onboarding hasta activarlo.');
    return reply({ error: 'La confirmación de correo aún no está configurada. Contacta al administrador antes de continuar.' }, 503);
  }
  return reply({ ok: true, message: SIGNUP_OK }, 200);
}

export async function handleOnboardingBusiness(req, env, s) {
  if (req.method.toUpperCase() !== 'POST') return reply({ error: 'Método no permitido.' }, 405, s.cookies);
  if (foreignOrigin(req)) return reply({ error: 'Origen no autorizado.' }, 403, s.cookies);
  if (!s?.user?.id || s.user.role !== 'client') return reply({ error: 'Solo las cuentas de cliente pueden crear una empresa.' }, 403, s.cookies);
  const parsed = await readJson(req, 1024);
  if (parsed.error) return reply({ error: parsed.error }, parsed.status, s.cookies);
  const v = validateBusinessName(parsed.body);
  if (v.error) return reply({ error: v.error }, 400, s.cookies);
  // Único dato del cliente: el nombre. El usuario sale de auth.uid() dentro del RPC (JWT de la sesión).
  let res;
  try {
    res = await fetch(`${String(env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/rpc/ed_onboard_business`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${s.access}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_name: v.name }),
    });
  } catch { return reply({ error: 'No se pudo crear la empresa. Inténtalo de nuevo.' }, 502, s.cookies); }
  if (res.status === 404) return reply({ error: 'El registro de empresas aún no está activado (falta aplicar la migración en Supabase).' }, 503, s.cookies);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const msg = String(detail.message || '');
    if (/reserved_name/.test(msg)) return reply({ error: 'Ese nombre está reservado. Elige otro nombre para tu empresa.' }, 400, s.cookies);
    if (/invalid_name/.test(msg)) return reply({ error: 'El nombre debe tener entre 2 y 80 caracteres.' }, 400, s.cookies);
    if (/not_allowed/.test(msg)) return reply({ error: 'Tu cuenta no puede crear empresas.' }, 403, s.cookies);
    return reply({ error: 'No se pudo crear la empresa. Inténtalo de nuevo.' }, 502, s.cookies);
  }
  const row = await res.json().catch(() => null);
  const out = Array.isArray(row) ? row[0] : row;
  if (!out || typeof out !== 'object' || !out.id) return reply({ error: 'No se pudo confirmar la empresa creada.' }, 502, s.cookies);
  return reply({ ok: true, business: { id: out.id, name: out.name, slug: out.slug }, created: !!out.created }, 200, s.cookies);
}
