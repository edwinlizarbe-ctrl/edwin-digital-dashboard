# Edwin Digital Dashboard

Dashboard multicliente en Cloudflare Workers + Supabase. JS ESM, sin build. Única dev-dep: `wrangler`.

## Mapa
- `worker.js`: router principal y cron (`*/5 * * * *`, ver `wrangler.jsonc`).
- Módulos por dominio en la raíz: `meta.js`, `google-ads.js`, `ga4-oauth.js`, `zernio.js`, `leads.js`, `email-delivery.js`, `email-marketing.js`, `admin-*.js`, `assistant-api.js`, `feature-access.js`.
- `public/`: frontend estático (`app.js` ~2400 líneas: usar Grep + offset, no leerlo entero).
- `migrations/`: SQL de Supabase. `tests/`: pruebas con `node --test`.
- `*.md` de la raíz: docs por integración; leer solo si la tarea trata de esa integración.

## Comandos
- `node --test` — pruebas.
- `npm run dev` — wrangler local (usa `.dev.vars`, ignorado por git).
- `npm run deploy` — SOLO con orden expresa del usuario.

## Variables y secretos (solo nombres)
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, META_APP_ID, META_APP_SECRET, META_SESSION_KEY, META_REDIRECT_URI, META_GRAPH_VERSION, GOOGLE_ANALYTICS_CLIENT_ID/_CLIENT_SECRET/_ENCRYPTION_KEY, GOOGLE_ADS_CLIENT_ID/_CLIENT_SECRET/_ENCRYPTION_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, HOTMART_CLIENT_ID/_CLIENT_SECRET/_BASIC, OPENAI_API_KEY, EDIGITAL_AI_MODEL, ZERNIO_API_KEY, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, EMAIL_FROM, EMAIL_SENDING_ENABLED, EMAIL_UNSUBSCRIBE_KEY, EMAIL_TEST_RECIPIENTS, BRASPER_BUSINESS_ID.

## Reglas
- Producción vive en Cloudflare: nunca pedir, leer, imprimir ni commitear valores de secretos.
- No tocar `main`, no desplegar, no cambiar configuración de producción sin confirmación.
- Trabajar solo en la rama de desarrollo asignada; sin PR salvo petición.
- Cloudflare MCP: solo lectura (`whoami`, `search`, `docs`); `execute` requiere confirmación.
- Leer solo el módulo afín a la tarea; evitar exploraciones repetidas del repo.
