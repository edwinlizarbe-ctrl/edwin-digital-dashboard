# Edwin Digital Analytics — Dashboard V3

Panel privado de analítica con diseño renovado (claro / oscuro), accesible en escritorio y celular.

**Base técnica:** Cloudflare Workers + assets estáticos + Supabase Auth / RLS + Google Analytics 4 Data API + piloto de Hotmart de Edwin Digital. Continúa funcionando con las tablas y rutas del proyecto anterior.

## Qué incluye

- Inicio de sesión con correo y contraseña de Supabase. **No se ponen claves de API en el navegador.**
- Datos reales de GA4 para los sitios a los que el usuario tiene acceso: usuarios, sesiones, vistas, interacción, duración, eventos, campañas UTM, fuentes, dispositivos, ubicaciones, contenido y páginas de entrada.
- Comparación con período anterior en los indicadores para los que GA4 devuelva ambas cifras.
- Períodos de 7, 30, 90 y 365 días. Selector de sitio y negocio, búsqueda, ordenar tablas, recargar y descargar CSV.
- Hotmart piloto **solo para el administrador del negocio Edwin Digital**: ventas aprobadas, métodos, productos, reembolsos cuando disponibles e importes brutos por moneda.
- Vista de integraciones que diferencia conexiones activas de las pendientes (Google Ads, Meta Ads).
- Estados explícitos de permisos, faltas de configuración y datos no disponibles. En producción **no se generan números de muestra**.

## Cómo usarlo

1. Sigue `GUIA-DE-ACTUALIZACION.md` para actualizar GitHub y Cloudflare.
2. Revisa las variables privadas necesarias en Cloudflare y los permisos de las propiedades GA4.
3. Accede a la URL de tu Worker e inicia sesión con las mismas credenciales Supabase del dashboard anterior.
4. Elige tu sitio; los reportes se cargan automáticamente.

Las conexiones **no están verificadas en cuentas reales** desde este entorno. Las capturas previas fueron pruebas locales con datos simulados, solo para validar la presentación y navegación.

No incluyas claves de servicio JSON, tokens, correos con contraseñas ni secretos en GitHub ni en mensajes de chat.
