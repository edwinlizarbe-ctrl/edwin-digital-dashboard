# E Digital.IA — activar permisos y conexiones por empresa

Estado: archivos y lógica guardados en GitHub. La integración y los permisos **no estarán activos** en producción hasta completar los pasos externos.

## 1. Preparar Supabase

En el SQL Editor del proyecto correcto, ejecutar en este orden:

1. `migrations/20261013_ed_business_features.sql`
2. `migrations/20261013_ed_email_change_audit.sql`

El primer script crea los permisos ON/OFF por negocio y asignación **manual** Premium. El plan Free está reservado y no puede contratarse ni asignarse todavía. El segundo registra cambios de correos **solo posteriores a su instalación**. No contiene ni registra contraseñas.

## 2. Secreto del backend

En Cloudflare → Worker de la plataforma → Variables and Secrets agregar `SUPABASE_SERVICE_ROLE_KEY` como **secret cifrado**, nunca como variable pública. Obtenerla en Supabase → Project Settings → API Keys. Jamás enviarla al chat ni guardarla en GitHub.

El Worker verifica que la sesión sea administradora y que el negocio esté autorizado antes de leer o modificar permisos. Los clientes no pueden concederse acceso con los interruptores de la interfaz. Las operaciones de consulta de GA4 y Meta Ads se validan por servidor.

## 3. Conexión de Meta Ads

Configurar una única vez `META_APP_ID`, `META_APP_SECRET` y `META_SESSION_KEY` (64 caracteres hexadecimales aleatorios). La URL de retorno oficial, también autorizada en Meta for Developers, es:

`https://edwin-digital-dashboard.edwinlizarbe.workers.dev/api/meta/callback`

`META_REDIRECT_URI` se puede proporcionar explícitamente; si no está configurada, el Worker usa la URL fija de ese dominio de producción. Cambiar el dominio requiere revisar su URL de retorno.

Para que cualquier cliente conecte su propia cuenta, la aplicación de Meta debe tener los permisos y modo de acceso apropiados. El cliente autoriza dentro del popup oficial de Facebook; las cuentas se seleccionan en el modal del dashboard. Los navegadores que impiden popup automático pueden requerir continuar con autorización en la misma pestaña.

## 4. Prueba recomendada

1. Ingresar como superadministrador → Integraciones → seleccionar empresa → asignar Premium → encender/apagar GA4 o Meta Ads.
2. Ingresar con el usuario real de **esa empresa** y confirmar el estado en Integraciones y Campañas Ads.
3. Al apagar GA4 y Meta Ads, confirmar que sus endpoints protegidos responden sin datos y que el cliente ve la restricción. Volver a activar según corresponda.
4. Completar Facebook OAuth con un cliente autorizado y comprobar que la selección de cuentas se mantiene en la sesión.
5. En Accesos de clientes, comprobar correo y rol; abrir Historial de correo una vez ejecutada la migración.

## Advertencias

- ON/OFF concede o bloquea acceso **dentro de E Digital.IA**. No instala por sí solo OAuth o APIs de Google Ads, Hotmart, Shopify, TikTok Ads, LinkedIn Ads u otras plataformas pendientes.
- Los permisos no equivalen a suscripciones o cobros. El plan Premium es una etiqueta administrativa manual.
- Algunas sesiones de Meta siguen vinculadas al navegador y caducan; no son una integración permanente entre todos los dispositivos.
- Si las migraciones o secretos faltan, el panel mostrará que la configuración está pendiente y no debe anunciarse como activada.
- La publicación de GitHub y el despliegue Cloudflare deben comprobarse por separado.
