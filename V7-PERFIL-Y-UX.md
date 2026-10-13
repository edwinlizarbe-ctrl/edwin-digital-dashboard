# Edwin Digital · Actualización V7 (13/10/2026)

## Experiencia de cliente
- Nombre, sector/categoría y país editables desde «Mi empresa»; se guardan en `user_metadata.ed_business_preferences_v1` de **la cuenta autenticada**, nunca en el token de otra empresa.
- El cliente ve su nombre comercial personalizado en el menú, aunque el registro original `businesses.name` todavía se llame Edwin Digital.
- El nombre oficial de `businesses` puede cambiarse con un `PATCH` **solo cuando el RLS existente permite actualizar la fila**. De lo contrario queda únicamente la personalización del usuario y se muestra un aviso.
- Subida de logotipo PNG/JPEG/WebP, validación y reducción a 240 px. **Se almacena en localStorage solo en este navegador y por usuario/empresa. No es un logo compartido ni se sincroniza entre dispositivos**. Jamás guardar imágenes base64 en Supabase Auth metadata: aumentarían demasiado el JWT y romperían las cookies.
- Edición del nombre y URL de sitios mediante RLS existente. **Solo funciona si el usuario tiene permisos UPDATE en Supabase**. No se modifica propiedad GA4.
- «Mi cuenta»: contraseña al principio, cambio de correo con verificación de la contraseña actual (la confirmación depende de Supabase Auth), y color de acento y menú locales al navegador.
- Catálogo de integraciones en tres columnas (escritorio), búsqueda y opción de mostrar conectadas, en orden Analítica → Ventas → Publicidad, con iconos reales de los proveedores, obtenidos de Simple Icons o de sus sitios oficiales.
- El menú del cliente separa la identidad del negocio de su correo. No se debe atribuir el nombre comercial a partir del correo.

## Administrador
- Se mantiene el panel separado para el superadministrador.
- «Integraciones SaaS» incorpora diagnóstico de configuración de Meta **sin mostrar ningún valor de secretos**: señala únicamente presencia/formato de META_APP_ID, META_APP_SECRET, META_REDIRECT_URI y META_SESSION_KEY.
- Una configuración local correcta no sustituye las aprobaciones necesarias de Meta for Developers ni garantiza acceso de cualquier cliente.

## Conexiones y límites
- Meta Ads: el OAuth de cliente existente se conserva. Si el Worker responde configured:false, no se finge conexión; primero resolver secretos/deploy en Cloudflare. App Meta en desarrollo puede exigir roles de prueba o revisión de ads_read.
- Google Analytics 4: consulta existente por propiedad autorizada; **no** hay aún OAuth individual de autoservicio GA4.
- Google Ads, TikTok Ads, LinkedIn Ads, Hotmart, Shopify, etc.: sólo catálogo hasta configurar APIs individuales. No hay métricas inventadas.
- Al no existir todavía tabla RLS de perfil compartido ni bucket de Supabase Storage privado por empresa, el logo es local y la categoría es por cuenta. Para producción SaaS multiusuario hay que crear la estructura de empresa compartida y controles de edición/invitación.
- Las rutas nuevas requieren Supabase Auth HttpOnly y aplican las políticas RLS existentes. No se agrega Service Role Key, ni se exponen tokens en front-end.

## Comprobaciones
1. Cliente: entrar a «Mi cuenta», cambiar apariencia; contraseña arriba; probar solicitud de cambio de correo y su confirmación.
2. Cliente: abrir «Mi empresa», cambiar alias/categoría, seleccionar PNG/JPG/WebP, Guardar y recargar. Comprobar en ese navegador; no prometer sincronización de logo.
3. Cliente: intentar guardar sitio. Si Supabase responde falta de permisos, revisar la política RLS UPDATE y membresías, **no quitar RLS**.
4. Integraciones: comprobar logos, filtro, tres columnas escritorio / una móvil, orden de categorías; no mostrar proveedor desconectado como conectado.
5. Administrador: abrir Integraciones SaaS y pulsar «Comprobar conexión»; nunca revelar secretos; validar correctamente Meta en Cloudflare si fuera necesario.
6. Verificar Cloudflare Deployments luego del merge: GitHub no confirma que el Worker de producción ya haya sido desplegado.
