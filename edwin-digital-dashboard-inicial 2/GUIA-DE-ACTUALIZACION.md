# Edwin Digital Dashboard V2 — guía de actualización

Esta versión sustituye la interfaz inicial. **No sustituye** el proyecto de Supabase ni los secretos de Cloudflare. Mantiene los accesos existentes y utiliza los mismos nombres de tablas `profiles`, `businesses`, `business_members` y `sites`.

## Funcionalidad incluida en los archivos

- Apariencia nueva: modo claro/oscuro, adaptada a móvil y escritorio.
- Inicio de sesión de Supabase (sesiones HttpOnly, servidor Worker).
- Administración multiempresa. Cada cliente accede solo a sus negocios, sitios y métricas gracias al JWT y las políticas RLS de Supabase.
- Paneles: Resumen, Analítica web, Adquisición, Audiencia, Contenido, Eventos, Hotmart, Clientes (solo propietario), Integraciones y Configuración.
- Filtro por 7, 30 y 90 días; selector de sitio; actualización manual; CSV de los registros de la sección.
- Google Analytics 4 Data API: se han programado consultas REALES a los indicadores principales (usuarios, sesiones, vistas, eventos clave, interacción, rebote, etc.) y los desgloses por fecha, canal, fuente, campaña, página, evento, país, ciudad y dispositivo.
- Hotmart: consulta de los movimientos de la **cuenta piloto de Edwin Digital**, visible solo para usuarios con acceso al negocio `edwin-digital` mediante RLS. Agrupa ventas, importes brutos separados por moneda, productos, métodos de pago y fechas, y consulta estados de reembolso cuando la API los permite. No hace ningún movimiento de dinero.
- En ausencia de autorización/datos, el dashboard explica el motivo. **No contiene números de ventas o visitas inventados.**

## Cómo reemplazar los archivos existentes en GitHub

El repositorio actual es `edwinlizarbe-ctrl/edwin-digital-dashboard` y **Cloudflare tiene Root directory = `/edwin-digital-dashboard-inicial`**.

La nueva versión contiene exactamente la carpeta `edwin-digital-dashboard-inicial`, para mantener esa configuración.

1. Descomprime el ZIP en tu Mac.
2. Abre en GitHub la carpeta existente `edwin-digital-dashboard-inicial`.
3. Selecciona **Add file → Upload files**.
4. Abre en Finder la carpeta descomprimida `edwin-digital-dashboard-inicial` y sube el contenido (no el ZIP), conservando `public/`.
5. Antes de confirmar verifica que las rutas de destino sean `edwin-digital-dashboard-inicial/worker.js`, `edwin-digital-dashboard-inicial/wrangler.jsonc`, `edwin-digital-dashboard-inicial/public/index.html`, `edwin-digital-dashboard-inicial/public/style.css` y `edwin-digital-dashboard-inicial/public/app.js`.
6. Si GitHub agrega otra carpeta por encima, corrígelo antes de hacer commit; no debe existir una carpeta `edwin-digital-dashboard-inicial/edwin-digital-dashboard-inicial/`.
7. Haz **Commit changes** en `main`. Cloudflare iniciará otro despliegue automático. No cambies los secretos ni la carpeta de origen.

> Si al subir archivos GitHub obliga a otra estructura, detente y consulta antes de confirmar, para no interrumpir la página publicada.

## Configuración real de Google Analytics 4 que FALTA

La aplicación **ya contiene el código que consulta GA4**, pero **no podrá mostrar cifras reales** hasta que configuremos la credencial del servidor:

- Cuenta de servicio ya registrada en GA4 como Lector: `edwin-digital-analytics@edwin-digital-dashboard-2026.iam.gserviceaccount.com`.
- Propiedad GA4 registrada para Edwin Digital: `558050129`.
- En Cloudflare → Worker `edwin-digital-dashboard` → Settings → **Runtime variables and secrets** (Production), agregar el secreto `GOOGLE_SERVICE_ACCOUNT_JSON` como tipo **Secret**, con el contenido completo de un archivo de clave JSON de esa misma cuenta de servicio, generado en Google Cloud. **No subir el JSON a GitHub ni enviarlo por chat.**
- La cuenta de servicio debe conservar únicamente el mínimo permiso necesario de Lector en las propiedades de Analytics que deban mostrarse. Para futuros clientes, cada cliente autoriza su propia propiedad GA4 y se guarda su Property ID en su propio sitio en la tabla `sites`.
- Si la organización no permite generar claves, no fuerces una excepción; antes se deberá implementar una autenticación de servidor sin claves de larga duración (federación apropiada).

**ACTUALIZACIÓN:** La captura SQL del 12 de octubre muestra que `relogioso993@gmail.com` ya está vinculado al negocio Edwin Digital y puede consultar el sitio `https://edwindigital.store` y la propiedad GA4 `558050129`. Con el código de esta versión y la credencial GA4 configurada, se podrán consultar métricas reales. No da acceso a negocios ajenos.

## Hotmart

Las variables piloto existentes en Cloudflare deberían ser `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET` y `HOTMART_BASIC` (tipo Secret). Si no figuran en **Runtime variables and secrets → Production**, será necesario recrearlas allí de forma segura; no enviarlas a nadie.

En este código, Hotmart piloto solo responde a un **usuario con permiso de RLS para el negocio `edwin-digital`**, incluido el cliente de prueba expresamente vinculado a ese negocio. Los futuros clientes necesitan **conexiones de sus propias cuentas**, autorizadas y guardadas por negocio, no reutilizarán las credenciales de Edwin Digital. Conector OAuth y almacén cifrado multicliente son una fase posterior y no están implementados en esta versión.

## Limitaciones reales

- No se ha probado ningún acceso con tus claves reales ni se han consultado tus propiedades; únicamente pruebas locales con respuestas simuladas para verificar la INTERFAZ y pruebas simuladas de autorización de API.
- Los reportes de GA4 dependen de métricas disponibles y permisos de la propiedad; algunos pueden quedar vacíos si no existen eventos/campañas.
- La API de Hotmart puede limitar el resultado o paginarlo; en tal caso se señala que es parcial.
- Shopify y otras pasarelas aparecen como futuras conexiones, no funcionales.
- No hay sistema de altas automáticas de nuevos clientes ni edición de sitios desde el navegador; las membresías y propiedades se configuran por ahora en Supabase.
- Los ingresos de Hotmart no se suman entre monedas distintas, y no se confunden con ingresos GA4.

## Prueba de seguridad recomendada antes de ofrecerlo a clientes

1. Como administrador, verificar que aparecen ambos negocios y sus respectivos sitios.
2. Como el usuario de prueba, verificar que **no** pueda listar las propiedades de otro negocio; tampoco consultar la URL `/api/ga4/report` de otro sitio aunque conozca sus IDs.
3. Confirmar que secretos (`HOTMART_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`) nunca aparecen en el código de GitHub ni en respuestas de navegador.
4. Revisar que GA4 y Hotmart tengan permisos mínimos y que las API reales respondan correctamente.

## Referencias oficiales

- Google Analytics Data API (dimensiones, métricas): https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- GA4 API y autenticación: https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart
- Hotmart Developers: https://developers.hotmart.com/docs/es/
- Cloudflare Workers Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
