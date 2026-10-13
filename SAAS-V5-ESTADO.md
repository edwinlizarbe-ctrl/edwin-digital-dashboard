# Edwin Digital Analytics · SaaS V5 — alcance real y pendientes

## Incluido en esta actualización
- Separación de navegación y pantallas: superadministrador de plataforma y portal de empresa cliente (Supabase Auth + RLS).
- El administrador de la plataforma accede a su panel, negocios visibles, fichas y centro de integraciones, **sin conectar sus cuentas publicitarias a nombre de clientes**.
- Los clientes ven su espacio, sus sitios, «Mi empresa», integraciones y «Campañas Ads». No ven las advertencias técnicas de secretos de Cloudflare.
- Meta Ads: autorización propia mediante OAuth de Facebook, permisos `ads_read`, token cifrado en cookie segura ligada a usuario y negocio autorizado, selector de hasta cinco cuentas con búsqueda; reportes separados por cuenta y moneda.
- «Campañas Ads»: selector de plataforma y consulta real de campañas, conjuntos y anuncios de Meta. El tráfico UTM de GA4 continúa en un reporte separado.
- Los conectores restantes informan claramente que están pendientes; **nunca generan cifras simuladas**.
- Se deshabilita la ruta Hotmart heredada que usaba credenciales globales para evitar atribuir ventas de terceros a un negocio.

## Restricciones de este piloto
- El acceso a Meta es de solo lectura, se mantiene por navegador y caduca. No es persistencia multi-dispositivo ni una implementación multiempresa comercial completa.
- La app Meta está en modo desarrollo: el proveedor solo permite cuentas/personas con acceso de prueba o rol autorizado. Para clientes externos, completar revisión de permisos/aprobaciones aplicables.
- Las sesiones de cliente deben tener acceso RLS al negocio en las tablas `businesses` y `sites`.
- El usuario con rol `admin` es superadministrador y **no** puede usar el token piloto Meta de una empresa. Las empresas cliente deben iniciar su propia autorización en su sesión.
- El superadministrador **no puede ver las contraseñas** de otros usuarios; el restablecimiento futuro se implementará con Supabase Auth.
- La sección «Mi empresa» es informativa; aún no habilita modificación persistente de logo o perfil. No se deben simular operaciones de guardado.

## Pendiente de implementación y validación
1. **Autorización durable por empresa:** almacenamiento cifrado server-side, revocación real, reconexión, rotación de tokens, auditoría y roles de administrador dentro de cada empresa.
2. **Otros proveedores:** Google Ads, Hotmart individual, Shopify, TikTok Ads, Search Console, Facebook/Instagram orgánico, LinkedIn Ads, WooCommerce. Cada API exige registro de app, scopes y permisos propios. Mostrar «Próximamente» hasta tener autorización real.
3. **Panel de superadministración completo:** altas e invitaciones, roles, planes, suscripciones, cobros, auditorías, métricas del servicio y soporte. Requiere autorización administrativa en backend, no solo botones.
4. **Personalización cliente:** logo y nombre comercial mediante Supabase Storage y políticas por empresa; sector, país, moneda y zona horaria.
5. **Comparaciones, alertas, reportes programados y funciones editoriales tipo Metricool:** incorporar únicamente cuando haya fuente autorizada y métricas verificables.
6. **Validación real:** probar con el usuario cliente de prueba y confirmar que no puede acceder al negocio de otra empresa, revisar despliegue de Cloudflare y OAuth Meta.

## Comprobación manual
- Superadministrador: iniciar sesión y comprobar que abre «Panel administrador» y ve sus clientes; no debe aparecer conexión Meta dentro de su propio panel.
- Cliente: iniciar sesión con una cuenta asociada por RLS a su empresa; abrir Integraciones, conectar Facebook, seleccionar una o varias cuentas (máximo cinco).
- Cliente: ir a Campañas Ads, filtrar Meta, campañas / conjuntos / anuncios y período; comprobar valores frente a Meta Ads Manager.
- Cambiar entre negocios autorizados y comprobar que no se mezclan cookies, métricas ni monedas.
- Comprobar que Hotmart responde indisponible y que las otras integraciones figuran como pendientes.

**Importante:** cambiar código en GitHub no equivale a verificar un deploy o un OAuth real. No publicar accesos para terceros sin prueba de aislamiento y aprobaciones de proveedores.
