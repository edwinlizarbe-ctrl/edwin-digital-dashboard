# Edwin CRM · Puerta de lanzamiento comercial (5 de noviembre de 2026)

Este documento diferencia **código fusionado**, **esquema conectado**, **pruebas pendientes** y **acceso de clientes**. No es autorización para cobrar ni para aceptar datos de terceros sin completar las comprobaciones.

## Avances constatados

| Área | Evidencia consultada | Estado |
|---|---|---|
| Producto CRM | `main`: embudo, seguimiento, auditoría, reportes y demo | Integrado en GitHub, no equivale a producción |
| Presentación comercial | `public/edwin-crm.html` y menú accesible en `public/index.html` | Fusionado vía PR #138 |
| Registro | `signup.js` y pruebas existentes | Código incluido; flujo real no probado |
| Primera empresa | `ed_business_owners` y `ed_onboard_business(p_name text)` en Supabase conectado | Existentes según consulta SQL de solo lectura |
| Permisos de onboarding | `anon` EXECUTE = no; `authenticated` EXECUTE = sí; RLS activo en tabla de propiedad | Comprobado en el esquema conectado |
| Cobro recurrente | No existe pasarela/activación automática validada | Pendiente |
| Despliegue real | GitHub Actions no equivale a respuesta de la URL pública | Pendiente de verificación end-to-end |

## Bloqueadores reales antes de recibir un cliente de pago

1. Confirmar que **Cloudflare Production** usa el repositorio y commit correctos y las credenciales del mismo proyecto Supabase auditado. Probar `/`, `/edwin-crm.html`, `/crm-demo.html` y el login en URL real.
2. Comprobar configuración de Supabase Auth: confirmación email activada, redirección válida, SMTP funcional, limitación de abuso y envío correcto de la confirmación. No consultar ni divulgar claves.
3. Hacer un flujo de registro completo con una cuenta de prueba autorizada: signup → email → login → empresa → oportunidad → seguimiento → reporte. Verificar reintentos y error sin filtración.
4. Probar el aislamiento entre **dos empresas distintas** con usuarios de prueba: lectura, escritura, cambios de URL/API, informes y permisos. Una batería de tests automatizados no sustituye esta revisión de producción.
5. Definir cobro externo autorizado y **verificación manual antes de activar** el servicio piloto. No ofrecer renovación automática mientras no exista un sistema de cobro y cancelación completo.
6. Publicar términos, información de privacidad y proceso de soporte/cancelación antes de aceptar suscripciones públicas. Revisar obligaciones aplicables al mercado de lanzamiento.

## Alcance mínimo vendible (piloto asistido)

- Una empresa con usuario autorizado y pipeline funcional.
- Alta y seguimiento de prospectos, filtros, alertas por antigüedad, priorización explicable y reportes agregados.
- Demo de datos ficticios separada de los datos reales.
- Cobro y activación asistidos después de verificar la identidad comercial y pago; nunca activar accesos por clic en un botón de prueba.
- Sin promesa de IA conversacional, mensajes WhatsApp automáticos, conversiones garantizadas ni integraciones sin autorización.

## Control de publicación y métricas

- Verificar siempre PR fusionado, commit exacto y checks aplicables; después comprobar despliegue externo de ese mismo commit.
- Primera cohorte: número de visitantes únicos de la presentación, clics a demo, registros confirmados, empresas activadas, primeros seguimientos y pagos confirmados. Registrar cada tasa con su denominador, período y fuente; no inventar conversiones.
- Revisión a los 7 días: empresas que crearon al menos una oportunidad y completaron seguimiento; revisión a 30 días: renovaciones y cancelaciones. Distinguir visitas, registros, pruebas y clientes de pago.
- Si falta algún paso de seguridad, mantener el piloto privado sin acceso público a cuentas empresariales.

**Nota de verificación:** la inspección de Supabase fue de solo lectura. No se creó ningún usuario, se activó ningún plan, se tocaron permisos ni se hizo ningún cobro.
