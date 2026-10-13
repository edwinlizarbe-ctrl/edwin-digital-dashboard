# eDigital — pruebas de acceso de clientes e integraciones (13 de octubre de 2026)

## Implementado en el código

- **eDigital** se presenta como nombre provisional de la plataforma; **Edwin Digital** sigue siendo una empresa de prueba diferente.
- **Acceso cliente:** se conserva el inicio de sesión de Supabase Auth con correo y contraseña entregados previamente. No se ha habilitado el registro público.
- **Mi cuenta y seguridad:** el usuario puede cambiar su propia contraseña verificando la contraseña actual. Tras cambiarla, debe iniciar sesión nuevamente.
- **Superadministrador → Accesos de clientes:** directorio de correos, rol y última fecha de inicio de sesión, hasta 200 usuarios. No aparecen contraseñas ni credenciales de otros proveedores.
- **Recuperación de acceso:** el administrador puede **generar una contraseña temporal**. La clave se muestra una única vez y no queda almacenada en texto claro dentro de la aplicación. Los enlaces por correo se dejan pendientes hasta completar la pantalla de recuperación.
- **Integraciones:** Meta Ads tiene un flujo piloto OAuth **para usuarios de empresa**. La pantalla muestra el motivo si no hay configuración de Meta. Por ahora la conexión depende del navegador que la autorizó y todavía no es una integración empresarial persistente entre dispositivos.
- **Presentación:** el menú de clientes no ofrece Ventas Hotmart cuando no hay conexión propia. Los nombres comunes de eventos de GA4 se muestran en español; la API y los CSV conservan sus nombres originales.

## Configuración necesaria antes de probar con clientes

1. Agrega en **Cloudflare Workers → Settings → Variables and Secrets**, como secreto de servidor, `SUPABASE_SERVICE_ROLE_KEY` del proyecto Supabase correcto. **Nunca** copies esta clave en el navegador, código GitHub o respuestas de chat. Sin ella, el directorio y la generación de claves temporales informarán que falta configuración.
2. Verifica que tu perfil de administrador tenga el rol `admin` en la tabla `profiles`.
3. Para cada cliente, crea su usuario en Supabase Auth, registra el perfil y asígnale acceso únicamente a su empresa con las políticas RLS existentes. **El alta y la asignación de clientes desde eDigital todavía no están implementadas.**
4. Para Meta Ads, configura los secretos `META_APP_ID`, `META_APP_SECRET`, `META_SESSION_KEY` (64 caracteres hexadecimales) y `META_REDIRECT_URI` (URL HTTPS pública que termina en `/api/meta/callback`). Comprueba los roles/permisos de la app Meta y acceso `ads_read` para el usuario de prueba.
5. Usa por ahora **Restablecer clave** en el panel de superadministrador. El envío de enlaces por correo estará disponible después de implementar y probar el formulario de recuperación.

## Prueba funcional recomendada

- Entra como superadministrador y abre **Accesos de clientes**. Consulta un correo de prueba. Genera una clave temporal y cópiala de manera privada.
- En una ventana privada, entra con ese correo y la clave temporal. Ve a **Mi cuenta y seguridad** y cámbiala. Confirma que la clave anterior ya no funciona.
- Como cliente, abre **Integraciones → Meta Ads → Conectar con Facebook**, autoriza tu cuenta, selecciona una cuenta publicitaria y comprueba métricas reales. Cambia de empresa/usuario y verifica que no aparecen cuentas ajenas.
- **No marcar como validado** hasta completar el flujo OAuth con una cuenta real y revisar resultados en producción.

## Pendiente para la siguiente fase

- Guardar autorizaciones Meta Ads cifradas en almacenamiento persistente del servidor para utilizarlas desde distintos navegadores y en reportes programados; hoy es una conexión piloto por cookie.
- Configurar el remitente de prueba, automatizar correos semanales y verificar la entrega de reportes a clientes (sin números inventados).
- Incorporar desde el propio panel el alta completa de empresas, usuarios y permisos.
- Verificar despliegue de Cloudflare, iconos oficiales que aún fallen y pruebas E2E de varios clientes.

> Código actualizado en GitHub. Los cambios en código no garantizan que el Worker se haya desplegado ni que los servicios externos estén configurados.
