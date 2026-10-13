# GUÍA DE INSTALACIÓN — EDWIN DIGITAL ANALYTICS V3

## 1. Lo que cambia

Esta es una **actualización del código** del panel anterior, no una cuenta nueva. Mantiene Cloudflare Workers, Supabase Auth, la autorización multiempresa y el mismo proyecto de datos. No requiere eliminar tablas ni crear un nuevo Supabase.

Pantallas: **Resumen, Analítica web, Adquisición, Campañas UTM, Audiencia, Contenido, Eventos y metas, Ventas Hotmart, Reportes, Mis clientes (admin), Integraciones y Configuración.**

La nueva UI ofrece temas claro/oscuro, diseño responsive, filtros 7/30/90/365 días, comparación auténtica con el período anterior, gráficos, rankings, tablas ordenables y CSV. Después de iniciar sesión, la web solicita los reportes automáticamente.

## 2. Actualiza el repositorio que ya existe

Repositorio indicado en la versión anterior: `edwinlizarbe-ctrl/edwin-digital-dashboard`.

La carpeta interior del ZIP se llama exactamente **`edwin-digital-dashboard-inicial`** para conservar la configuración de **Root directory = `/edwin-digital-dashboard-inicial`** de Cloudflare.

1. Descomprime `edwin-digital-dashboard-v3.zip` en tu Mac.
2. Abre el repositorio anterior en GitHub. Ingresa a la carpeta `edwin-digital-dashboard-inicial`.
3. Sube y **reemplaza** los siguientes archivos conservando la estructura exacta:
   - `worker.js`
   - `wrangler.jsonc`
   - `package.json`
   - `public/index.html`
   - `public/style.css`
   - `public/app.js`
   - `README.md`
   - `GUIA-DE-ACTUALIZACION.md`
4. Confirma que no se ha creado una carpeta doble `edwin-digital-dashboard-inicial/edwin-digital-dashboard-inicial/`.
5. Haz commit a la rama conectada con Cloudflare. Espera el nuevo deploy y abre tu URL habitual.

**No borres tus variables ni los secrets de Cloudflare** al actualizar archivos. Conserva la URL actual.

## 3. Inicio de sesión: ¿qué clave se ingresa?

En la web solo introduces **correo y contraseña del usuario de Supabase**; es el mismo acceso anterior. La sesión se gestiona en el servidor con cookies HttpOnly. La contraseña no se guarda en el código del dashboard.

Debes configurar una única vez en Cloudflare las credenciales internas necesarias. **Nunca pegues claves JSON de Google, tokens Hotmart o contraseñas en la pantalla de login.**

### Variables del Worker obligatorias

En Cloudflare → Workers & Pages → `edwin-digital-dashboard` → **Settings → Variables and Secrets (Production)**:

| Variable | Uso | Situación |
|---|---|---|
| `SUPABASE_URL` | Endpoint del proyecto Supabase | Necesaria para login |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase usada por el Worker | Necesaria para login y RLS |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo de la cuenta de servicio de Analytics | **Secret** privado requerido para cifras reales GA4 |
| `HOTMART_CLIENT_ID` | OAuth del piloto | **Secret** privado si quieres Hotmart |
| `HOTMART_CLIENT_SECRET` | OAuth del piloto | **Secret** privado si quieres Hotmart |
| `HOTMART_BASIC` | Credencial Basic OAuth del piloto | **Secret** privado si quieres Hotmart |

El ZIP **no incluye secretos** y no modifica los existentes. Las credenciales de Hotmart corresponden exclusivamente a la cuenta piloto administrada por Edwin Digital.

## 4. Conectar los datos reales de GA4

La versión anterior ya indicaba:

- Propiedad Google Analytics 4 de Edwin Digital: `558050129`.
- Cuenta de servicio registrada con permiso Lector: `edwin-digital-analytics@edwin-digital-dashboard-2026.iam.gserviceaccount.com`.

Verifica que esa propiedad siga siendo la correcta y que la cuenta de servicio **tenga permiso Lector** dentro de Google Analytics. En Supabase, la fila de `sites` del negocio `edwin-digital` debe tener `ga4_property_id` con la ID correspondiente.

El backend firma el JWT y consulta la **GA4 Data API**. El JSON de la cuenta de servicio se configura **solo en Secret de Cloudflare**. Si el proyecto restringe claves de larga duración, no intentes eludir la restricción: hay que implementar credenciales federadas.

Para agregar más clientes hay que asignar sus `businesses`, `sites` y `business_members` correctamente, y conceder acceso de lector a la propiedad específica. **Supabase RLS debe permanecer activo**, y el backend consulta el ID de propiedad almacenado en el sitio autorizado, sin aceptar IDs arbitrarios desde el navegador.

### Si no salen visitas

1. Comprueba que iniciase sesión y tienes el negocio/sitio adecuado.
2. Revisa el ID GA4 de ese sitio en `sites`.
3. Verifica el secret `GOOGLE_SERVICE_ACCOUNT_JSON` en el entorno **Production** de Cloudflare.
4. Comprueba el permiso de la cuenta de servicio en GA4.
5. Verifica que esté habilitada la Google Analytics Data API en el proyecto de Google Cloud.
6. Prueba con 30 días. Algunas propiedades pueden no tener eventos clave, campañas UTM o determinadas dimensiones y esas secciones aparecerán vacías, sin números inventados.

## 5. Datos disponibles y alcance real

| Fuente | Funciona con los secretos/permisos correspondientes | Información |
|---|---|---|
| Google Analytics 4 | Sí, código de consulta incluido | Web, fuentes, campañas **UTM**, páginas, ubicaciones, eventos clave y comparaciones |
| Hotmart | Sí, piloto restringido al administrador de `edwin-digital` | Aprobadas, métodos, productos, ingreso **bruto por moneda**, reembolsos según disponibilidad API |
| Google Ads API | **Aún no conectada** | No se presenta gasto, CPC, CTR de anuncios ni ROAS de Google Ads |
| Meta Marketing API | **Aún no conectada** | No se presenta gasto, costo por lead ni ventas atribuidas por Meta Ads |

**Importante:** una campaña de GA4 puede reflejar sesiones y eventos, pero **no** representa por sí sola el resultado financiero real de campañas de Google Ads o Meta Ads. Los ingresos Hotmart nunca se suman entre monedas diferentes; el dashboard no inventa ingresos, conversiones ni rentabilidad.

## 6. Qué se comprobó y qué falta comprobar

- Sintaxis de `worker.js` y `public/app.js` revisada con Node.
- Navegación, diseño de escritorio, tema oscuro y diseño móvil probados en un navegador con **respuestas de prueba**.
- Inicio de sesión, error de contraseña y carga posterior probados mediante respuestas simuladas.
- **No se han usado tus credenciales privadas ni conectado a tus cuentas reales.** Debe verificarse el deploy real, las políticas RLS, acceso de clientes e integraciones tras publicar.

## 7. Seguridad antes de dar acceso a clientes

- Prueba con una cuenta cliente real que no pueda consultar otros negocios ni sus métricas.
- Confirma que las tablas `businesses` y `sites` tienen políticas RLS correctamente definidas.
- No facilites `GOOGLE_SERVICE_ACCOUNT_JSON` ni las claves `HOTMART_*` a clientes ni a JavaScript del navegador.
- No coloques secretos en repositorios Git o capturas.
- Las APIs se consultan desde Cloudflare Worker; cada solicitud de GA4 valida que el sitio pertenece al negocio visible mediante Supabase con JWT del usuario.

## Referencias

- GA4 Data API: https://developers.google.com/analytics/devguides/reporting/data/v1
- Supabase Auth: https://supabase.com/docs/guides/auth
- Cloudflare Workers Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Hotmart Developers: https://developers.hotmart.com/docs/es/
