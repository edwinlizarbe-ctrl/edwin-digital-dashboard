# Edwin CRM · Arquitectura y operación

Auditoría basada en el código del repositorio (rama `main` al 2026-10-23). Cada afirmación lleva una etiqueta:

- **[Comprobado]** verificado leyendo código o ejecutando pruebas locales.
- **[Revisar en producción]** depende de Cloudflare, Supabase o servicios externos a los que esta auditoría no tiene acceso.

No se desplegó nada, no se tocaron tablas, políticas RLS, secretos ni usuarios.

## 1. Componentes

| Capa | Archivos | Notas |
|---|---|---|
| Worker (entrada única) | `worker.js` | Enruta `/api/*`; el resto va a `env.ASSETS`. `run_worker_first` solo para `/api/*` (`wrangler.jsonc`). [Comprobado] |
| Módulos API | `leads.js`, `meta.js`, `google-ads.js`, `ga4-oauth.js`, `search-console.js`, `email-marketing.js`, `email-delivery.js`, `assistant-api.js`, `zernio.js`, `feature-access.js`, `signup.js`, `site-registration.js`, `password-reset.js`, `admin-*.js`, `brasper-blog-generator.js` | Cada uno recibe `(req, env, session)`. [Comprobado] |
| Frontend | `public/app.js`, `public/index.html`, `public/brasper/`, `public/brasper-blog.js`, módulos de email, WhatsApp y asistente | JS estático sin build. [Comprobado] |
| Datos | Supabase Auth + Postgres + RLS; `migrations/*.sql` | Las migraciones se aplican a mano; no hay herramienta de migraciones. [Comprobado] |
| Tareas programadas | Cron `*/5 * * * *` → `processEmailQueue` | Cola de envíos de email. [Comprobado] |
| CI | `.github/workflows/crm-ci.yml` | `node --check` + `node --test tests/*.test.js`. [Comprobado] |

### Flujo de una petición autenticada
1. Cookies `ed_access` / `ed_refresh` (HttpOnly, Secure, SameSite=Lax). [Comprobado, `worker.js:36`]
2. `session()` valida el JWT llamando a `GET /auth/v1/user` (no verifica la firma localmente), renueva con el refresh token y lee `profiles.role` con el JWT del usuario. [Comprobado]
3. Para roles distintos de `admin` se consulta suspensión (`banned_until`) con service_role. [Comprobado]
4. El rol `blog_editor` queda confinado, antes de cualquier otra ruta, a `/api/me` y al Blog, y solo para un correo fijo. [Comprobado, `worker.js:175`]
5. Los módulos consultan Postgres con el JWT del usuario (RLS decide) o, en rutas de admin/jobs, con `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Aislamiento multicliente (`business_id`)

**Modelo [Comprobado]:** la pertenencia está en `business_members(business_id, user_id)`. Las rutas de cliente consultan con el JWT del usuario, de modo que RLS es la barrera principal. Varias rutas añaden además una comprobación explícita previa (`sites/edit`, `ga4/report`, `company/preferences`), y `ensureBusinessFeature` controla qué módulos tiene cada empresa.

**Buenas prácticas ya presentes:** validación UUID de `business_id`, rechazo de `Origin` ajeno en POST, límites de tamaño de cuerpo, errores genéricos hacia el cliente, rollback acotado a lo creado en la misma petición (`create-client`), empresas internas protegidas (`edwin-digital`, `brasper`), claves OAuth cifradas por entorno.

### Hallazgos

| ID | Severidad | Hallazgo | Estado |
|---|---|---|---|
| H1 | Media (funcional) | `POST /api/company/preferences` pedía `select=id` y luego leía `businesses[0].name`; `display_name.length` lanzaba `TypeError` y la ruta devolvía siempre 502. | **Corregido en este PR** (`select=id,name`) con prueba. |
| H2 | Alta (depende de RLS) | Muchas rutas dependen solo de RLS para el aislamiento (`/api/businesses`, `/api/sites`, leads, integraciones). El repositorio contiene migraciones, pero **no hay forma de comprobar desde el código que las políticas aplicadas en producción coinciden**. | [Revisar en producción]: listar `pg_policies` y probar con dos usuarios de empresas distintas. Ver §6 backlog P0. |
| H3 | Media | Las migraciones `20261023_brasper_blog_editor_role.sql` no contienen sentencias RLS; el rol `blog_editor` se protege en el Worker (lista cerrada de rutas), no en la base. Un JWT `blog_editor` usado directamente contra PostgREST depende de que RLS no le dé acceso a datos de otras empresas. | [Revisar en producción]. |
| H4 | Media | Rutas con `SERVICE_ROLE_KEY` (12 archivos) saltan RLS. Cada una debe filtrar por `business_id` del usuario en código. Los puntos revisados en `worker.js` (`admin/*`) verifican `role==='admin'` primero. Los módulos `leads.js`, `email-*.js`, `feature-access.js` y conectores **no se auditaron línea a línea**. | Pendiente: auditoría dirigida, ver backlog P0. |
| H5 | Baja | `session()` valida el JWT con una llamada a Supabase por petición (latencia y dependencia), y la ruta `/api/auth/login` no tiene limitación de intentos propia (depende de Supabase). | [Revisar en producción] límites de Auth. |
| H6 | Baja | `blog_editor` autorizado por correo fijo en el código (`marketing.brasper@gmail.com`). Es restrictivo (falla cerrado), pero cambiar la persona exige un despliegue. | Aceptado; documentar. |
| H7 | Baja | `crm_leads`/otras tablas: migraciones nuevas sin `FORCE ROW LEVEL SECURITY`; irrelevante si solo el Worker con service_role las usa, relevante si la clave anon llega al navegador. | [Revisar en producción]. |
| H8 | Info | URL `https://edwin-digital-dashboard.edwinlizarbe.workers.dev` fija en `worker.js:484,746`, `meta.js:17`, `email-delivery.js:147`. Un entorno staging con otro dominio recibiría enlaces y redirecciones de producción. | Ver §4. |
| H9 | Info | `/api/admin/directory` y `/api/admin/accounts` truncan en 200 usuarios (`per_page=200&page=1`) sin paginar. | Backlog P2. |

## 3. Pruebas

- Tras fusionar el PR #71 el 2026-10-23, las **122 pruebas existentes pasan en CI**. Ese PR actualizó las aserciones del Blog para el título `<h1>`, los enlaces internos de PIX y el CTA localizado. [Comprobado mediante GitHub Actions]
- Este PR añade 3 pruebas simuladas para `company/preferences`; deben ejecutarse en CI antes de fusionarlo.
- Nuevo: `tests/company-preferences.test.js` (3 pruebas con Supabase simulado; sin red ni credenciales).

## 4. Entornos, secretos, despliegue y rollback

**Estado actual [Comprobado]:** `wrangler.jsonc` define un único Worker (`edwin-digital-dashboard`) sin bloque `env`, sin `observability`, con `previews: {}`. `package.json` solo tiene `deploy` y `dev`. No existe workflow de despliegue en el repositorio: la publicación es manual o por la integración Git de Cloudflare [Revisar en producción qué usa].

**Secretos que el código lee** (solo nombres; configurar en Cloudflare → Variables and Secrets o `wrangler secret put`, nunca en el repo):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_SESSION_KEY`, `META_REDIRECT_URI`, `META_GRAPH_VERSION`, `GOOGLE_ANALYTICS_CLIENT_ID/SECRET/ENCRYPTION_KEY`, `GOOGLE_ADS_CLIENT_ID/SECRET/ENCRYPTION_KEY`, `GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET/ENCRYPTION_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_SENDING_ENABLED`, `EMAIL_TEST_RECIPIENTS`, `EMAIL_UNSUBSCRIBE_KEY`, `OPENAI_API_KEY`, `EDIGITAL_AI_MODEL`, `ZERNIO_API_KEY`, `BRASPER_BUSINESS_ID`, `HOTMART_*` (ruta deshabilitada).

### Propuesta de entornos (no aplicada)
1. **Staging:** segundo Worker (`edwin-digital-dashboard-staging`, vía `env.staging` en `wrangler.jsonc`) apuntando a un **proyecto Supabase distinto** con datos sintéticos, con su propio juego de secretos y `EMAIL_SENDING_ENABLED=false`. Desactivar el cron en staging.
2. **Claves de cifrado y OAuth distintas por entorno**; nunca reutilizar `*_ENCRYPTION_KEY` de producción.
3. Sustituir la URL fija de workers.dev (H8) por `new URL(request.url).origin` o una variable `PUBLIC_ORIGIN`.
4. Activar `"observability": {"enabled": true}` para Workers Logs. El código ya usa `console.error` con mensajes sin datos personales; mantener esa convención.

### Publicación controlada
1. PR → CI verde (`crm-ci.yml`).
2. Probar en staging: login, cambio de empresa, Blog (copiar HTML), un cliente distinto de Brasper.
3. `wrangler versions upload` y despliegue gradual (`wrangler versions deploy`, por ejemplo 10 % → 100 %). [Revisar en producción] que la cuenta lo permita.
4. Vigilar logs (`wrangler tail`) y tasa de 5xx unos minutos.

### Rollback
- Inmediato: `wrangler rollback` o, en el panel, Deployments → versión anterior → Rollback. No requiere revertir Git.
- Después: `git revert` del commit y nuevo PR.
- Las migraciones SQL **no tienen rollback automático**; cada migración nueva debe incluir su script inverso y ser aditiva (columnas/tablas nuevas, nunca borrados en la misma versión).

## 5. Brasper Blog (preservación)

No se tocó `brasper-blog-generator.js`, `public/brasper-blog.*` ni `public/brasper/`. Requisitos a conservar y su respaldo en pruebas [Comprobado]: título (`<h1>`), HTML copiable, subtítulos sin barra lateral (`border-left:none`), enlaces sin subrayado (`text-decoration:none!important`) y solo a Brasper, PIX sin enlaces bancarios, ES/PT, CTA `/es` o `/br`. Las aserciones previamente desactualizadas se conciliaron en el PR #71; mantener pruebas de regresión para el HTML copiado, diseño y enlaces permitidos.

## 6. Backlog priorizado

| P | Tarea | Criterio de aceptación | Dependencias |
|---|---|---|---|
| P0 | Comprobar HTML de Blog frente al diseño de referencia y botón de copiar | Vista previa y HTML copiado idénticos; enlaces y H1 correctos en ES/PT | Prueba con navegador autenticado |
| P0 | Verificar RLS en producción con dos usuarios de empresas distintas | Usuario A obtiene 0 filas de empresa B en `businesses`, `sites`, `crm_leads`, conexiones, email; `blog_editor` obtiene 0 filas de datos de clientes | Acceso de lectura a Supabase de producción |
| P0 | Auditoría línea a línea de módulos con service_role (H4) | Cada consulta service_role filtra por `business_id` validado contra `business_members` | Ninguna |
| P1 | Mantener CI ampliado del PR #71 y vigilar regresiones | CI se dispara al cambiar cualquier módulo JavaScript o asset público | PR #71 fusionado |
| P1 | Staging con Supabase separado | Login y Blog funcionando en staging sin tocar datos de producción | Nuevo proyecto Supabase y Worker |
| P1 | `observability` y `PUBLIC_ORIGIN` (H8) | Logs visibles; ningún enlace de staging apunta a producción | Staging |
| P2 | Paginar directorio/cuentas admin (H9) | Más de 200 usuarios listados completos | Ninguna |
| P2 | Pruebas de aislamiento por módulo con Supabase simulado (patrón de `company-preferences.test.js`) | Cada ruta de cliente probada: UUID inválido, empresa ajena, sin sesión | Ninguna |
| P2 | Herramienta de migraciones versionadas (Supabase CLI) con scripts inversos | `supabase db diff` limpio entre repo y producción | Acceso a Supabase |

## 7. Limitaciones de esta auditoría

- No se leyó el estado real de Cloudflare ni Supabase (políticas, secretos, versiones, logs).
- Este documento se actualizó tras fusionar el PR #71. No se modificó `crm-ci.yml` en esta rama para evitar conflictos.
- Los módulos de conectores y email se revisaron por patrones (uso de claves, variables), no línea a línea.
