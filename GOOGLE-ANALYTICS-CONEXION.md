# Google Analytics 4 — conexión OAuth por cliente

## Qué está incorporado

- En **Integraciones de mi empresa** aparece **Conectar Google Analytics**.
- El cliente se autentica con su propia cuenta de Google; el CRM solicita solo `analytics.readonly`.
- Las credenciales de acceso se cifran con AES-GCM en el servidor y se almacenan por `business_id`, nunca en el navegador.
- El permiso es exclusivo de la empresa asignada en Supabase RLS.
- El usuario selecciona la propiedad GA4 permitida por Google. Si su cuenta solo tiene una, el CRM la selecciona automáticamente.
- Las pantallas de Analítica web reutilizan los informes GA4 existentes.
- Permite cambiar propiedad o desconectar sin borrar datos de Analytics.

## Activación necesaria en Google Cloud

1. En **APIs y servicios**, habilitar **Google Analytics Data API** y **Google Analytics Admin API** en el proyecto Google Cloud de la aplicación.
2. Configurar pantalla de consentimiento OAuth con los usuarios/dominios adecuados. Para clientes externos fuera del modo prueba, completar la publicación/verificación exigida por Google.
3. Crear credencial **ID de cliente OAuth 2.0**, tipo **Aplicación web**.
4. Registrar **URI de redirección autorizado** (exactamente, sin slash final):
   `https://edwin-digital-dashboard.edwinlizarbe.workers.dev/api/ga4/callback`
   Si se usa dominio propio, registrar también `https://TU-DOMINIO/api/ga4/callback`.

## Configuración privada en Cloudflare Workers

En Variables and Secrets del Worker, guardar estas tres variables como **secrets**, nunca en GitHub ni en archivos públicos:

- `GOOGLE_ANALYTICS_CLIENT_ID`: ID de cliente OAuth creado en Google Cloud.
- `GOOGLE_ANALYTICS_CLIENT_SECRET`: secreto OAuth del cliente Google.
- `GOOGLE_ANALYTICS_ENCRYPTION_KEY`: cadena aleatoria hexadecimal de 64 caracteres (32 bytes). Generar localmente con `openssl rand -hex 32` y conservarla; cambiarla sin migrar tokens invalidará conexiones previas.

El Worker también requiere las variables Supabase ya existentes: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. No se necesitan claves de Google Analytics en el navegador.

La migración `migrations/20261017_ga4_oauth_connections.sql` ya se aplicó al proyecto Supabase del CRM. Está protegida con RLS y sin permisos de lectura públicos.

## Publicación y pruebas

Publicar el commit del Worker en Cloudflare (por el flujo de CI existente o `npm run deploy` si se implementa manualmente). Cambiar secretos exige volver a desplegar según configuración del Worker.

1. Entrar al CRM con una cuenta **cliente** cuya empresa tiene habilitada la integración `ga4`.
2. Abrir Integraciones → Google Analytics 4 → Conectar Google Analytics.
3. Google pide permiso de solo lectura; al regresar debe indicar cuenta autorizada.
4. Con una propiedad disponible se selecciona automáticamente; con varias, elegir la correcta en el selector y Guardar propiedad.
5. Ir a Analítica web; verificar sesiones, usuarios y métricas reales.
6. Comprobar que otro cliente **no** puede consultar esa propiedad ni las credenciales mediante otro business_id.
7. Probar desconectar y volver a conectar.

Si la web todavía no tiene medición, Edwin Digital debe configurar la etiqueta Google Analytics 4 (Google tag / GTM) al crearla. **Conectar la cuenta no instala automáticamente la etiqueta en la web**.

## Endpoints privados

- `GET /api/ga4/status?business_id=<uuid>`: disponibilidad y propiedad vinculada.
- `GET /api/ga4/connect?business_id=<uuid>`: iniciar consentimiento OAuth Google.
- `GET /api/ga4/callback`: callback validado por cookie, state y nonce de uso único.
- `GET /api/ga4/properties?business_id=<uuid>`: propiedades permitidas por Google.
- `POST /api/ga4/select?business_id=<uuid>` con `{"property_id":"123456"}`.
- `POST /api/ga4/disconnect?business_id=<uuid>` con JSON `{}`.
- `GET /api/ga4/report?business_id=<uuid>&site_id=<uuid>&period=7`: informe de lectura real.

No afirmar que el botón es operativo hasta completar Google Cloud, secretos y prueba del flujo real.
