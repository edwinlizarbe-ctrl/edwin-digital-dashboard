# Brasper en Edwin CRM: acceso comercial e integraciones

## Diagnóstico verificado (05/11/2026, consulta SQL solo lectura)

- La empresa **Brasper** ya existe, con `slug=brasper`.
- En `business_members` existe **una sola membresía**, asociada a un usuario cuyo `profiles.role` es `blog_editor`. No había ninguna membresía con rol `client` ni `admin` en la empresa al comprobarla.
- La fila `ed_business_features` indica **plan Premium** y opciones `meta_ads`, `google_ads` y `ga4` habilitadas. **Habilitado no significa cuenta autorizada o sincronizando datos**.
- En `worker.js` el rol `blog_editor` solo puede utilizar la lectura de sesión y las rutas de Blog. `public/app.js` muestra deliberadamente una navegación editorial exclusiva.
- **No cambiar el rol de la cuenta editorial** sin una revisión de acceso individual: se diseñó para la persona encargada de blogs y tiene acceso limitado por seguridad.

## Solución integrada sin duplicar empresas

El superadministrador utiliza **Accesos de clientes → Invitar a una empresa existente**. Debe elegir **Brasper**, introducir **un correo de una persona autorizada para administrar marketing y ventas**, distinto del correo editorial, y enviar la invitación.

La interfaz utiliza el endpoint preexistente `POST /api/admin/invite` que comprueba:
1. Sesión con rol `admin` y solicitud del mismo origen.
2. Que la empresa ya exista y no esté suspendida.
3. Que el correo no pertenezca ya a otra cuenta de Edwin CRM.
4. Invitación de Supabase Auth, creación de membresía en esa misma empresa y lectura posterior para verificar la vinculación.

**Límite operativo:** el alta requiere que la persona destinataria acepte la invitación por correo; la entrega depende de Supabase Auth/SMTP. No se envió ninguna invitación, no se creó ninguna cuenta ni se modificaron permisos durante esta implementación. El panel comercial no se habilita mágicamente en la sesión editorial vigente.

Tras acceder con una cuenta `client` autorizada a BrasPer, la navegación normal del CRM ya incluye **Resumen, Analítica, Adquisición, Campañas Ads (Meta / Google), Audiencia, Contenido, Embudo comercial, Oportunidades, WhatsApp, Reportes, Blog, Email Marketing, Integraciones y Mi empresa**. Los permisos por empresa se siguen verificando en el servidor.

## Arquitectura de integraciones: Edwin CRM como centro

**Meta Ads → Edwin CRM:** autorización oficial desde la sección Integraciones del cliente Brasper, selección de cuentas publicitarias accesibles, consultas read-only a campañas y métricas. No migrar campañas ni compartir credenciales manualmente. Verificar tokens, scopes, permisos de la cuenta, sincronización real y políticas de Meta.

**Google Ads → Edwin CRM:** autorización OAuth de la cuenta Google con acceso al Customer ID correcto, selección autorizada y reportes. Comprobar configuración de OAuth, developer token, permisos, estado de la conexión y que no se mezclen datos entre negocios.

**GA4 → Edwin CRM:** conectar por OAuth una propiedad perteneciente a Brasper; no reutilizar propiedades ni tokens de otras empresas. La vinculación de un sitio web no significa que Analytics ya esté conectado.

**WhatsApp / asesoras → Edwin CRM:** las oportunidades y estados comerciales deben pertenecer al contexto de Brasper; integrar conversaciones mediante APIs y permisos autorizados. Si las asesoras hoy operan en Umbler Talk, se puede evaluar una conexión de datos como **fuente**, no convertir Umbler en la plataforma principal ni duplicar registros. `n8n` puede orquestar webhooks o transformaciones cuando haga falta; no debe ser la fuente definitiva de datos.

**Objetivo de medición:** campaña → origen/UTM → conversación → oportunidad → seguimiento → transferencia/venta confirmada. Necesita IDs consistentes, deduplicación, control de consentimiento y evidencia de conversiones reales; clics o conversaciones no se cuentan automáticamente como operaciones.

## Verificaciones pendientes

- Aceptación efectiva de la nueva invitación, login con rol `client` y comprobación de módulos de Brasper en URL de producción.
- Separación entre la cuenta comercial y la editorial, y entre Brasper y otras empresas.
- Conexiones reales de Meta Ads, Google Ads, GA4 y WhatsApp: OAuth, permisos, errores y lectura de datos, **sin inventar conexión activa**.
- Despliegue de Cloudflare verificado: fusionar en GitHub no prueba que el dominio público ya tenga el cambio.

No crear nuevas empresas Brasper ni alterar sus planes, datos, contraseñas, envíos o campañas para resolver un problema de navegación por roles.
