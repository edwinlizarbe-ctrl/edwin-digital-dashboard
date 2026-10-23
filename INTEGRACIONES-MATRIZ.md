# Integraciones de Edwin CRM — matriz de estado real

Nivel: **real** = código y API operativos cuando hay credenciales · **piloto** = limitado · **pendiente** = solo catálogo UI, sin API.
"Estado por empresa" siempre lo confirma el servidor (`/api/<proveedor>/status`); nunca se asume una conexión.

| Proveedor | Nivel en código | OAuth / claves necesarias | Dependencias | Aceptación por empresa |
|---|---|---|---|---|
| Google Analytics 4 | real | `GOOGLE_ANALYTICS_CLIENT_ID/SECRET/ENCRYPTION_KEY` o service account | APIs Data y Admin de GA | por empresa, vía status |
| Google Search Console | **real (este PR), pendiente de credenciales y migración** | `GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET/ENCRYPTION_KEY` | API Search Console, migración `20261023`, flag `search_console` | por empresa, vía `/api/search-console/status` |
| Google Ads | real, requiere configuración | OAuth + Developer Token | aprobación Google Ads | por empresa |
| Meta Ads | real, requiere app Meta | app Meta | permisos Meta | por empresa |
| WhatsApp (Zernio) | real, depende de Zernio | cuenta Zernio, webhooks | autorización de la empresa y coste | por empresa |
| Hotmart | piloto (solo admin Edwin Digital) | credenciales Hotmart | — | no multicliente |
| Business Profile, TikTok Ads, LinkedIn Ads, Shopify, WooCommerce, Facebook/Instagram orgánico, TikTok orgánico, YouTube | pendiente | por definir | un PR por conector | ninguna |

## Google Search Console — puesta en marcha

1. Google Cloud: habilitar **Google Search Console API**. Crear un cliente OAuth *Web* **propio** (no reutilizar el de GA4).
2. Añadir manualmente la URI de redirección: `https://<dominio-del-worker>/api/search-console/callback`.
3. Pantalla de consentimiento: scope únicamente `https://www.googleapis.com/auth/webmasters.readonly`.
4. Cloudflare (secretos): `GOOGLE_SEARCH_CONSOLE_CLIENT_ID`, `GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_ENCRYPTION_KEY` (64 hex, p. ej. `openssl rand -hex 32`). `SUPABASE_SERVICE_ROLE_KEY` ya existe.
5. Aplicar `migrations/20261023_search_console_connections.sql` (tablas con RLS, solo `service_role`).
6. Activar el permiso `search_console` de cada empresa (plan Premium o interruptor Free).

Rutas (todas exigen sesión, propietario validado con el JWT del usuario y flag `search_console`):
`GET /api/search-console/connect`, `/callback`, `/status`, `/sites`, `/report?period=7d|28d|90d`, `POST /select-site`, `/disconnect`.

Garantías: el token de refresco se guarda cifrado (AES-GCM) y nunca llega al navegador ni a logs; el `state` OAuth es de un solo uso (tabla de nonces + cookie HttpOnly/Secure/SameSite, TTL 10 min); la conexión solo se guarda si la API de Search Console responde en el callback; la UI muestra «Conectado» solo tras listar sitios y obtener un informe real.

Fuera de este primer corte: CSV, gráficos, URL Inspection API.
