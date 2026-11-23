# Edwin CRM | Claude Code Router (desarrollo local)

> Preparacion opcional de las herramientas de programacion; no es una funcion visible dentro del CRM.

## Objetivo y alcance

Permitir que Claude Code, ejecutado **localmente** por el desarrollador, use un gateway llamado Claude Code Router (CCR) que distribuye solicitudes entre proveedores/modelos configurados. CCR permite rutas condicionales y fallbacks, pero no garantiza que siempre escoja el mejor modelo, que todas las solicitudes sean gratuitas ni que las cuotas se compartan entre proveedores.

**No cambia** el codigo ejecutado por Cloudflare Workers, las tablas/politicas de Supabase, los secretos, las integraciones de Brasper ni la autenticacion de los clientes. Tampoco configura por si mismo el workflow remoto de GitHub Actions `.github/workflows/claude-handoff.yml`, que sigue usando `anthropics/claude-code-action@v1` y su propio mecanismo de autenticacion.

Arquitectura: `Claude Code local -> CCR (127.0.0.1:3456) -> proveedor/modelo autorizado`. El repositorio del CRM permanece separado del router.

## Requisitos y compatibilidad

- Mac con Node.js **22 o superior** y npm, segun los requisitos oficiales del CCR CLI; Claude Code u otro agente compatible instalado y autorizado.
- Si se usa el iMac Intel con macOS Big Sur 11.x, verificar primero que la version actual de Node 22 y sus dependencias funcionen en ese equipo. La compatibilidad de la app grafica moderna **no esta verificada** en Big Sur. Ante fallos, usar un entorno de desarrollo compatible; no instalar componentes a la fuerza.
- Cuenta y credenciales propias de cada proveedor que se vaya a utilizar. Las APIs de Gemini, DeepSeek y Mistral tienen condiciones, cuotas y posibles costos distintos de sus aplicaciones web. No asumir que un plan gratuito de chat cubre acceso por API.
- El codigo y los fragmentos enviados a modelos externos pueden salir del equipo. No enviar secretos, datos personales de clientes, llaves de Supabase, tokens OAuth, informacion comercial confidencial ni exportaciones de Brasper.

## Inicio rapido (solo en tu Mac)

1. Abrir Terminal dentro de una copia local del repositorio.
2. Comprobar `node -v` y `npm -v`. El primer comando debe mostrar v22 o superior.
3. Ejecutar `bash devtools/setup-claude-router-mac.sh`. El script valida Node e instala desde el paquete npm oficial `@musistudio/claude-code-router`, sin usar sudo.
4. Cuando se abra el panel local (normalmente `http://127.0.0.1:3458`), ir a **Providers** y registrar un proveedor que tengas autorizado. Guardar sus llaves solo en el gestor local de CCR, nunca en GitHub.
5. En **API Keys**, crear una clave de cliente CCR. En **Server**, iniciar el gateway local. El endpoint habitual es `http://127.0.0.1:3456`.
6. En **Agent Config**, elegir **Claude Code**, seleccionar el proveedor/modelo probado y aplicar el perfil para **uso local**. Hacer una consulta sencilla.
7. En **Routing**, definir rutas para tareas livianas y un respaldo ordenado. Probarlas y revisar **Logs** para confirmar proveedor real, errores, latencia, tokens y costo estimado.

## Politica de enrutamiento recomendada para Edwin CRM

| Tipo de tarea | Ruta sugerida | Precaucion |
| --- | --- | --- |
| Documentacion, textos, CSS, refactorizacion pequena | Un modelo economico/autorizado que pase pruebas | Revisar el diff |
| Errores de compilacion, pruebas y mejoras funcionales | Modelo fiable con uso de herramientas verificado | Ejecutar pruebas de Node/Playwright |
| Auth, RLS, aislamiento multicliente, pagos, cifrado y secretos | Modelo de razonamiento confiable y revision humana | No delegar escrituras/deploys automaticos |
| Limites, errores 429 o indisponibilidad | `Fallback targets` hacia otro modelo configurado | Fallback no crea creditos ni evita un proveedor sin acceso |

La configuracion real de Routing se realiza desde la interfaz de CCR, pues el formato interno del archivo de configuracion puede variar con las versiones. Consultar la documentacion oficial de fallback antes de activar reglas.

## Validacion minima

1. Una consulta de prueba desde Claude Code local debe verse en los Logs de CCR con `resolved provider/model` correcto.
2. Simular indisponibilidad o usar un proveedor de prueba limitado para comprobar fallback sin enviar contenido confidencial.
3. Comprobar `git status` para confirmar que la herramienta no escribio configuracion/secretos en el repositorio.
4. Si Claude Code edita el CRM, realizar una rama de trabajo, revisar el diff y ejecutar `node --test tests/*.test.js` (y las pruebas adicionales pertinentes) antes de abrir un PR.
5. Ningun cambio debe fusionarse a `main` ni publicarse en Cloudflare Production sin revision explicita.

## Desactivar / revertir

- Detener el servicio CCR en **Server** y restaurar el perfil de conexion previo en **Agent Config**; no basta con cerrar la ventana si Claude Code sigue apuntando al gateway.
- El paquete CLI se puede desinstalar con `npm uninstall -g @musistudio/claude-code-router` si ya no se necesita. La desinstalacion puede conservar archivos de configuracion locales.
- Esta implementacion no modifica `wrangler.jsonc`, el Worker, Supabase ni los secretos de GitHub Actions.

## Referencias oficiales

- Proyecto: https://github.com/musistudio/claude-code-router
- Guia de instalacion: https://github.com/musistudio/claude-code-router/blob/main/docs/src/content/docs/en/guides/install.md
- Guia de routing/fallback: https://github.com/musistudio/claude-code-router/blob/main/docs/src/content/docs/en/configuration/routing.md
