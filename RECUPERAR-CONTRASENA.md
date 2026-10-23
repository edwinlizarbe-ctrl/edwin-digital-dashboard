# Recuperar contraseña — Edwin CRM (Sprint Auth-04)

## Flujo
1. Login → «¿Olvidaste tu contraseña?» → `POST /api/auth/request-reset` (`{email}`) → Supabase `POST /auth/v1/recover` con la anon key y `redirect_to=<origen>/?reset=1`. Respuesta genérica, exista o no el correo.
2. El correo de Supabase lleva a `<origen>/?reset=1#access_token=…&type=recovery`. El frontend retira el fragmento con `history.replaceState` de inmediato y guarda el token solo en memoria.
3. `POST /api/auth/reset-password` (`{access_token,password,confirm}`) → `PUT /auth/v1/user` con la anon key y Bearer de recuperación → cierre global de sesiones (best effort). No emite cookies ni inicia sesión; vuelve al login.

`/api/auth/change-password`, login, signup e invitaciones no se modificaron.

## Límites y seguridad
- Supabase no marca el JWT de recuperación con un claim firmado exclusivo. El Worker rechaza tokens cuyo `amr` más reciente no sea `otp`/`recovery` o ya expiraron (decodificación sin verificar firma, solo prefiltro; la firma la valida Supabase en el PUT). No es una garantía criptográfica de «tipo recovery».
- El endpoint nunca lee las cookies HttpOnly de sesión: una sesión normal no puede usarlo sin el bearer, que JS no puede leer. Un access_token obtenido por otra vía (p. ej. XSS previo) con `amr` otp podría cambiar la clave; se mitiga con TTL corto de Supabase y no persistiendo el token.
- Falta limitación de tasa propia en el Worker; se depende de los límites de Supabase (429 se propaga).

## Configuración externa NO verificada (requiere prueba end-to-end)
- Supabase → Authentication → URL Configuration: autorizar `<origen>/?reset=1` (o `<origen>/**`).
- SMTP/plantilla «Reset Password» y envío real de correos.
- Confirm email activo.
