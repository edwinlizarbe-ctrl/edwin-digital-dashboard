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
