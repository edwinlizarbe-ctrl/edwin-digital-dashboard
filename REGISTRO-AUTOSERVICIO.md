# Registro autoservicio y primera empresa (CRM) · Issue #49

Flujo: **Crear cuenta → correo de confirmación → Login → Crear tu empresa → Dashboard sin datos**.
Identidad provisional: texto «CRM». Sin Google Login, suscripciones ni trial.

## Piezas
| Archivo | Qué hace |
|---|---|
| `signup.js` | `POST /api/auth/signup` (público) y `POST /api/onboarding/business` (autenticado). |
| `migrations/20261018_self_service_onboarding.sql` | Tabla `ed_business_owners` (`user_id` PK/UNIQUE) y RPC `ed_onboard_business(p_name)`. **No aplicada**: revisar y ejecutar manualmente. |
| `public/app.js` | Enlace «Crear cuenta», formulario (email, contraseña ≥10, confirmación), pantalla «Crea tu empresa». |
| `tests/signup.test.js` | Validaciones, Origin/JSON/tamaño, anti-enumeración, sin cookies, sin rol del cliente, idempotencia, revisión estática de la migración. |

## Seguridad
- Signup: valida Origin, `Content-Type: application/json`, tamaño ≤4 KB, email y contraseña (10–128). Solo reenvía `email` y `password` a Supabase `/auth/v1/signup` con la **anon key**; nunca `role`/`data`. `redirect_to` = origen del Worker. Respuesta idéntica exista o no el correo. **No emite cookies**; si Supabase devolviera sesión (confirmación desactivada) se descarta y se registra un aviso en logs.
- El rol lo fija el trigger existente `edwin_auth_user_created` (`client`); no se modificó.
- Onboarding: usuario solo de la sesión validada (cookie → `/auth/v1/user` → `profiles`). Se envía únicamente `p_name`; el RPC usa `auth.uid()` con el JWT del usuario. Se ignora cualquier `user_id`/`business_id`/`role` del cliente.
- RPC `SECURITY DEFINER`, `search_path = pg_catalog, public`, `REVOKE` a `PUBLIC`/`anon`, `GRANT` solo a `authenticated`. Exige `profiles.role='client'`, nombre 2–80 sin `<>`/control, bloquea nombres reservados (Edwin Digital, BrasPer, admin, CRM…, sin tildes/espacios/guiones). Lock advisory por usuario + `user_id` UNIQUE → doble clic o reintento devuelve la misma empresa. Si ya hay membresía (invitado/cliente existente) la devuelve sin crear nada. Slug `crm-<uuid>`.
- RLS no se desactiva y no se abre INSERT en `businesses`/`business_members`. No se reutiliza `/api/admin/accounts/create-client`.
- Usuarios existentes: con membresía no ven el onboarding. Un cliente sin empresa verá «Crea tu empresa» (antes veía un aviso vacío); admins no se ven afectados.

## Requisitos externos ANTES de publicar (no validados en producción)
1. Aplicar la migración en Supabase (SQL Editor) tras revisarla.
2. Authentication → Providers → Email: **Confirm email = ON** (el Worker no puede verificarlo; solo registra un aviso si detecta sesión en el signup).
3. Authentication → URL Configuration: añadir `https://<dominio-del-worker>/` a *Redirect URLs* y fijar *Site URL*.
4. SMTP propio (el SMTP por defecto de Supabase tiene límite bajo y solo envía a miembros del equipo); plantilla de confirmación en español.
5. Abuso: configurar en Supabase Auth → Rate Limits (sign-ups/emails por hora) y CAPTCHA (Turnstile) si hay abuso; añadir regla de Rate Limiting de Cloudflare para `POST /api/auth/signup`. El Worker no implementa rate limit propio.

## Checklist E2E (pendiente, manual)
- [ ] Registro con correo nuevo → llega correo → enlace vuelve al sitio.
- [ ] Login antes de confirmar falla con mensaje genérico.
- [ ] Registro con correo ya existente muestra el mismo mensaje.
- [ ] Login confirmado → «Crea tu empresa» → dashboard con estados vacíos.
- [ ] Doble clic / recargar durante la creación → una sola empresa.
- [ ] Nombre «Edwin Digital» / «BrasPer» rechazado.
- [ ] Cliente e invitado existentes entran directo al dashboard.
- [ ] Un usuario no ve empresas de otro (RLS).
- [ ] Móvil y teclado/lector de pantalla en ambos formularios.

## Antes / después
- Antes: solo login; sin signup; usuario sin empresa veía aviso «el administrador debe asignarte uno».
- Después: signup público seguro, confirmación por correo, onboarding atómico e idempotente.
