# Google Business Profile — integración pendiente de habilitación externa

Este conector conecta cada empresa de Edwin CRM con una ficha de Google Business Profile.
No está habilitado automáticamente por tener GA4, Search Console ni un plan Premium.

## Alcance del primer corte

- Inicio de sesión oficial de Google con consentimiento por empresa.
- Listado de cuentas, ubicaciones autorizadas y selección de ubicación.
- Consulta de métricas diarias del Performance API (Google Search y Maps, clics a web, clics para llamar e indicaciones).
- Actualización, estado y desconexión por empresa. Sin llamadas PATCH/POST/DELETE a las APIs de negocio de Google.
- Google requiere el scope https://www.googleapis.com/auth/business.manage (permiso amplio, aunque la aplicación use solo lectura). Mostrarlo claramente al usuario.
- No estimar cifras faltantes ni tratar métricas ausentes como cero; algunas métricas solo existen para ciertos tipos de ficha.

## Dependencias obligatorias de Google

1. Una cuenta de Google y un proyecto Google Cloud aprobado para GBP APIs. Solicitar el acceso oficial: https://developers.google.com/my-business/content/prereqs
2. Habilitar My Business Account Management API, My Business Business Information API y Business Profile Performance API en el proyecto aprobado. Cuota cero / HTTP 403 requieren intervención de Google.
3. Configurar pantalla de consentimiento OAuth, dominio y políticas requeridas; solicitar verificación OAuth si aplica.
4. Crear cliente OAuth tipo aplicación web. Añadir URI exacta en el mismo dominio del Worker:
   https://edwin-digital-dashboard.edwinlizarbe.workers.dev/api/business-profile/callback
   Para dominio propio, reemplazar por el dominio real. La URL debe coincidir con el host que inicia el flujo.
5. Configurar en Cloudflare Workers → Variables and Secrets (nunca en archivos públicos ni en el chat):
   - GOOGLE_BUSINESS_PROFILE_CLIENT_ID
   - GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET
   - GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY (32 bytes aleatorios, 64 caracteres hex)
   - GOOGLE_BUSINESS_PROFILE_API_APPROVED = true (solo una vez aprobada realmente la API)
   - SUPABASE_SERVICE_ROLE_KEY (la existente)
6. Ejecutar manualmente, luego de revisión, migrations/20261030_google_business_profile.sql en Supabase.
7. Para cuentas Free, habilitar explícitamente la función business_profile mediante los permisos de la empresa. Plan Premium habilita el permiso funcional, pero no sustituye OAuth ni aprobación de Google.
8. Entrar como cliente, elegir Integraciones → Google Business Profile → Conectar con Google, autorizar, seleccionar ficha y verificar un informe de 28 días.

## Seguridad y límites

- Las credenciales de refresh se cifran AES-GCM por empresa en Supabase; solo el backend puede leerlas.
- Acceso de empresa comprobado mediante JWT del usuario y RLS ANTES de usar la clave privilegiada.
- OAuth usa state único y un nonce consumido de forma atómica; cookie Secure HttpOnly SameSite, vencimiento 10 minutos.
- La conexión no se muestra como operativa hasta recibir y validar datos de la API.
- No publicar este PR hasta revisar controles, verificar el acceso de Google y correr pruebas E2E reales.
- Las pruebas unitarias simulan Google y Supabase; no prueban aprobación Google ni acceso en producción.
- La información se consulta bajo las condiciones y cuotas vigentes de Google.

Fuentes:
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations/list
- https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
