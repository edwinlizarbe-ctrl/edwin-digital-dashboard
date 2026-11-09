# Diagnóstico de compilación Cloudflare — 9 noviembre 2026

## Evidencia y alcance
El bot de Cloudflare informó **Build: Failed** para el SHA `cb6590785a74907bb82806bafbee1c09373b3485` en el PR #198, con registro UTC 2026-11-09 15:53:20. El PR se fusionó en GitHub, pero **la fusión y los checks de GitHub Actions no acreditan despliegue en Cloudflare Production**. El comentario no incluye un log de error legible ni una URL de preview exitosa. No asumir que el fallo afecta al último SHA de `main` sin consultar el build correspondiente.

Evidencia: https://github.com/edwinlizarbe-ctrl/edwin-digital-dashboard/pull/198#issuecomment-6744702888

## Procedimiento de diagnóstico (solo lectura)
1. En Cloudflare, abrir el historial de builds del servicio `edwin-digital-dashboard` y localizar el build asociado al SHA exacto. Registrar fecha, entorno, estado, etapa que falló y el mensaje de error **sin copiar variables de entorno ni tokens**.
2. Comparar el SHA desplegado en **Production** con el SHA vigente de `main`. No equiparar una compilación de preview fallida con una caída de producción ni dar por desplegado un commit solo por su merge.
3. Revisar por separado dependencias, comando de build, versión de Node, rutas de salida y permisos de integración GitHub–Cloudflare. No modificar configuración ni credenciales sin autorización.
4. Ejecutar comprobaciones locales/CI de solo lectura con el mismo SHA cuando sea posible. Distinguir un error reproducible en el repositorio de uno exclusivo de la plataforma.
5. Si se obtiene autorización para reparar configuración, hacerlo en PR y validar checks del SHA exacto antes de fusionar. No desplegar manualmente ni alterar secretos por esta guía.

## Pruebas de aceptación antes de declarar Production operativa
- **Positiva:** build de Production exitoso para el SHA objetivo y respuestas HTTP correctas de `/`, `/edwin-crm.html`, `/crm-demo.html` y login en el dominio real.
- **Negativa:** rutas inexistentes, errores de autenticación y solicitudes inválidas no revelan datos sensibles ni aparentan éxito.
- **Aislamiento:** confirmar con dos empresas y usuarios de prueba autorizados que no se pueden leer ni modificar datos cruzados, incluidos informes y APIs. La compilación por sí sola no prueba RLS.
- **Registro:** guardar fecha, SHA, entorno, resultado y evidencia verificable. Si falta cualquiera de estas pruebas, mantener estado «no verificado» y piloto privado.

## Límites
No habilitar pagos, suscripciones, datos reales, campañas ni cambios de privilegios basándose en esta guía. No se inspeccionaron logs privados de Cloudflare ni se verificó Production al redactarla.
