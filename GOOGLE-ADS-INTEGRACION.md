# Edwin CRM — Google Ads OAuth (rama de desarrollo)

**Rama:** `feature/google-ads-oauth`. **Estado:** backend e interfaz implementados para pruebas; **sin desplegar en Cloudflare ni fusionar con main**.

Edwin CRM es el SaaS multicliente. Edwin Digital es una de las empresas cliente. Ningún secreto de cliente OAuth ni token Google Ads debe aparecer en este repositorio o en el navegador.

## Implementación verificada

- Backend `google-ads.js`: iniciar OAuth, callback protegido por cookie cifrada, estado aleatorio de un solo uso y vencimiento, autorización mediante sesión Supabase, separación por `business_id`, cifrado AES-GCM de los refresh tokens, renovación y desconexión.
- Google Ads API v25: listar cuentas accesibles y cuentas cliente asociadas a MCC mediante `customer_client`; almacenar `selected_customer_id` y `selected_login_customer_id` por empresa. Consulta de solo lectura con `login-customer-id` cuando corresponde.
- Reportes por campañas de 7, 30 y 90 días: inversión en moneda de la cuenta, impresiones, clics, CTR, CPC, conversiones, valor de conversiones y ROAS, con paginación y aviso de informe parcial. Los 90 días utilizan fechas explícitas calculadas para la zona horaria de la cuenta.
- `public/app.js`: tarjeta funcional en **Integraciones** y panel **Campañas Ads**, botones Conectar, seleccionar cuenta, actualizar y desconectar; filtrado por empresa, estados de carga y error, respuesta de regreso de OAuth. No presenta cifras ficticias.
- La integración únicamente consulta Google Ads; no modifica campañas, presupuestos, anuncios ni grupos de anuncios.
- Tests `tests/google-ads.test.js`: ID inválido, sesión admin, aislamiento entre empresas, listado MCC, selección autorizada, métricas paginadas y moneda, comprobación de origen, estado OAuth alterado y callback reutilizado. **Las pruebas usan respuestas simuladas**, no cuentas de Google reales.
- GitHub Actions `.github/workflows/google-ads-check.yml`: comprueba sintaxis de Worker, cliente y tests.

## Supabase — migración ejecutada y comprobada

La migración `migrations/20261014_google_ads_connections.sql` se aplicó al proyecto `nextpfovlaclnnhlvfhg` durante el trabajo de esta sesión como `google_ads_connections` y se verificó mediante SQL:

- `public.ed_google_ads_connections`, asociada a una empresa; credenciales cifradas e ID de cuenta publicitaria seleccionada.
- `public.ed_google_oauth_nonces`, para prevenir reutilización del estado OAuth.
- RLS habilitado en ambas tablas.
- Sin privilegios directos de lectura para `anon` ni `authenticated`.
- Con acceso para `service_role` únicamente desde el Worker tras validar pertenencia y permiso de la empresa.
- No se modificaron las tablas existentes ni se desplegó código de producción.

La alerta informativa **RLS enabled no policy** para estas tablas es intencional: no deben ser legibles por clientes Supabase directamente. El asesor de seguridad de Supabase también informó observaciones **preexistentes** sobre algunas funciones y protección de contraseñas, que requieren una revisión separada antes del lanzamiento general.

## Bloqueos para lanzamiento real

1. Agregar **`GOOGLE_ADS_ENCRYPTION_KEY`** como secreto del Worker, generado de forma segura (32 bytes aleatorios, 64 caracteres hexadecimales). No compartirlo por chat ni guardarlo en GitHub.
2. Confirmar rotación del **`GOOGLE_ADS_CLIENT_SECRET`** expuesto previamente en una captura y que Cloudflare esté usando el secreto nuevo.
3. Confirmar la aprobación del nivel **Explorador** o permisos vigentes de la Google Ads API para cuentas reales. La aplicación OAuth sigue en **Testing** y limitada a los usuarios de prueba, mientras se prepara cualquier publicación/verificación que sea obligatoria.
4. Ejecutar pruebas de OAuth y de campañas **reales** con una empresa de prueba desde un entorno aislado/preview; validar jerarquías MCC, múltiples monedas, revocación y errores de autorización. El CI solo cubre pruebas simuladas.
5. Revisar las alertas de seguridad del proyecto Supabase existente y crear una tarea de limpieza periódica de OAuth nonces caducados antes de escala.
6. Revisar Pull Request, pedir autorización expresa y solo después fusionar a `main` y desplegar a Cloudflare.

**Developer token:** a partir del cambio de acceso de Google Ads API de septiembre de 2026, se gestiona por proyecto Google Cloud; no solicitar credenciales adicionales innecesarias ni reconfigurar el cliente OAuth ya creado.

**Limitación actual:** la integración **no está operativa en producción** hasta completar los puntos anteriores.

## Prueba aislada con Cloudflare Preview (sin producción)

La rama contiene `"previews": {}` en `wrangler.jsonc` (Wrangler fijado a 4.149.0, compatible con Previews). **Esto prepara el entorno: NO lo crea, no despliega ni copia los secretos de producción.** Cloudflare Preview es público por defecto: protegerlo con Cloudflare Access y limitar los usuarios OAuth de prueba.

1. Con acceso propio a Cloudflare, abrir una copia local de `feature/google-ads-oauth` y ejecutar `npm install`. Confirmar el proyecto/Worker correcto antes de cualquier operación.
2. Configurar **secretos independientes del entorno Preview** mediante `npx wrangler preview secret put SECRET_NAME --name google-ads-pilot` para cada nombre requerido: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_ENCRYPTION_KEY`. Preparar las credenciales privadas solo en Cloudflare; no guardarlas en GitHub, capturas ni conversaciones. La clave AES-GCM debe ser de 64 caracteres hexadecimales aleatorios (`openssl rand -hex 32`).
3. Crear el entorno exclusivamente de la rama con `npx wrangler preview --name google-ads-pilot`. **Nunca usar `wrangler deploy` para el piloto.** Verificar que la URL real devuelta esté protegida. Si la CLI indica que faltan variables o bindings, configurarlos únicamente para Preview.
4. Agregar en Google Cloud → APIs y servicios → Credenciales → cliente OAuth existente la URL EXACTA: `https://<URL_REAL_DE_LA_PREVIEW>/api/google-ads/callback` (sin duplicar `https://` ni escribir `<>` literales). No borrar el callback productivo existente.
5. Verificar Google Ads API en nivel **Explorador** (o superior) antes de consultas a una cuenta real; en nivel **Prueba** solo se permiten cuentas de Google Ads de prueba. Mantener la app OAuth en Testing solo con usuarios de prueba autorizados.
6. Usar una **empresa dedicada al piloto** y un usuario de pruebas autorizado; si se utiliza Supabase principal, el Preview y producción **comparten la misma base física** y deben aislarse estrictamente por empresa, no asumir una base de pruebas separada. Nunca registrar campañas falsas en la cuenta publicitaria.
7. En la Preview probar: conexión OAuth, callback, cuentas directas y MCC, selección de cliente, campaña con datos reales, 7/30/90 días, moneda, zona horaria, conversiones, gasto, CTR, CPC y ROAS comparados con Google Ads; comprobar empresas ajenas, revocación, desconexión y reconexión. Una ausencia de datos no confirma integración funcional.
8. Observar logs sanitizados, sin incluir access/refresh tokens ni secretos. Deshabilitar o eliminar la Preview al acabar (`npx wrangler preview delete --name google-ads-pilot`).
9. Solo con evidencias de la prueba satisfactoria solicitar revisión y autorización explícita para publicar en `main`. No fusionar ni desplegar producción automáticamente.

**Pendiente externo:** no hay conexión operativa real registrada en Supabase. El despliegue de Preview, gestión de secretos y autorización Google requieren acceso a las cuentas Cloudflare/Google y consentimiento OAuth del usuario, que los tests de GitHub no sustituyen.
