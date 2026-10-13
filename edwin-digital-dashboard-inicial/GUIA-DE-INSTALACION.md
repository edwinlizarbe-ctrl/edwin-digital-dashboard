# Edwin Digital Dashboard — primera versión funcional

Aplicación de inicio para el panel multicliente `clientes.edwindigital.store`.

## Qué incluye

- Aplicación con interfaz responsive, modo claro / oscuro.
- Inicio de sesión contra Supabase Auth, por correo y contraseña.
- Cookies de autenticación `HttpOnly; Secure; SameSite=Lax`; actualización de sesión cuando el token vence.
- Roles de superadministrador y cliente, perfiles y negocios obtenidos de las tablas `profiles`, `businesses`, `business_members` y `sites` ya creadas en Supabase.
- Consultas a Supabase bajo el JWT del usuario, sin clave de servicio y respetando las políticas RLS existentes.
- Un botón para consultar desde el servidor el historial de ventas de Hotmart de la cuenta piloto Edwin Digital: solo visible y ejecutable por rol `admin`. API de solo lectura; no envía pagos ni procesa pedidos ni utiliza n8n.
- Datos GA4 registrados en las tablas; las métricas en vivo de GA4 **todavía no están implementadas**.

## Qué NO incluye aún

- No hay integración real con GA4, Shopify o pasarelas de pago.
- No hay onboarding automático de nuevos clientes ni edición de clientes desde la interfaz.
- No conecta Hotmart de terceros: cada cliente requerirá su propia autorización OAuth y credenciales por cuenta, sin reutilizar las claves del piloto.
- No se han realizado consultas reales contra los servicios del usuario; las claves permanecen en su Cloudflare.
- La consulta piloto de Hotmart cubre hasta 500 transacciones del último mes por petición. Si hay más, muestra advertencia de datos parciales. Los ingresos son brutos y se separan por moneda.

## Cómo subir a GitHub

1. **Descomprime** el ZIP en tu computadora.
2. En GitHub entra en `edwinlizarbe-ctrl/edwin-digital-dashboard` → **Add file → Upload files**.
3. Sube `wrangler.jsonc`, `package.json`, `worker.js` y los tres archivos dentro de la carpeta **public**. Mantén intacta la carpeta `public` con sus archivos (estructura abajo). Si el navegador no permite subir carpeta, usa GitHub **Add file → Create new file** y crea las rutas `public/index.html`, `public/app.js` y `public/style.css` manualmente.
4. Pulsa **Commit changes**. Cloudflare, conectado a la rama `main`, intentará desplegar automáticamente.

Estructura esperada:

```text
edwin-digital-dashboard/
  README.md
  wrangler.jsonc
  package.json
  worker.js
  public/
    index.html
    app.js
    style.css
```

Cloudflare Build command: vacío; Deploy command: `npx wrangler deploy`.

## Configuración adicional obligatoria en Cloudflare

Ve al Worker **edwin-digital-dashboard** → Settings → Variables and Secrets (Production).

- `SUPABASE_URL`: URL de tu proyecto Supabase (`https://xxxxxxxx.supabase.co`). Es una variable pública de configuración, no una contraseña.
- `SUPABASE_ANON_KEY`: Publishable Key o clave `anon` de Supabase. Es una clave destinada a clientes, pero en esta arquitectura se usa desde el Worker. **Nunca configures `service_role` como esta clave**.
- `HOTMART_CLIENT_ID`: secreto existente de Hotmart (piloto Edwin Digital).
- `HOTMART_CLIENT_SECRET`: secreto existente de Hotmart (piloto Edwin Digital).
- `HOTMART_BASIC`: secreto existente (comienza por `Basic `).

**Importante:** los secretos de Hotmart que ya se guardaron en Cloudflare deben permanecer allí. NO ponerlos en el ZIP, en GitHub ni en capturas. El Worker usa los secrets existentes en tiempo de ejecución.

## Publicar dominio

El código puede compilar aunque el dominio todavía no esté habilitado. Luego será necesario activar la URL workers.dev temporalmente o configurar el dominio personalizado `clientes.edwindigital.store` en Cloudflare. Configurar el DNS y comprobar HTTPS antes de comunicar claves de acceso a clientes.

## Comprobar antes de entregar a clientes

1. Entrar con cuenta administrador: debe listar todos los negocios autorizados.
2. Entrar con la cuenta cliente: debe listar únicamente el negocio de ese cliente.
3. Intentar acceder como cliente a recursos de otro negocio: Supabase RLS debe bloquearlo; hacer pruebas automatizadas de seguridad antes de uso real.
4. Como admin, pulsar **Consultar Hotmart** y verificar respuesta real desde Hotmart. Si rechaza con HTTP 401/403, revisar permisos API sin modificar credenciales a ciegas.
5. No presentar GA4/Shopify como integraciones terminadas; aparecen pendientes de implementación.

## Recursos de referencia

- Cloudflare: https://developers.cloudflare.com/workers/static-assets/
- Supabase Auth: https://supabase.com/docs/guides/auth
- Hotmart OAuth: https://developers.hotmart.com/docs/en/start/app-auth
