# Edwin CRM · 50 entregas verificables de crecimiento

**Objetivo:** capacidades útiles que eleven captación, conversión, seguimiento, activación, calidad comercial y preparación SaaS. Estas son **entregas pendientes o desarrolladas**, no 50 cambios publicados por el mero hecho de escribir el plan.

**Avance comprobado al 2026-11-05:** 46/50 entregas integradas en main (sin confirmación de despliegue Cloudflare); C21, C22, C37 y C50 pendientes. Se han publicado C01–C10 (#115), C11–C16 (#116) y C17–C20 (#118). Cada bloque tiene sus propias pruebas. No se ha verificado aquí un despliegue de Cloudflare.

**Reglas operativas:** trabajar por bloques pequeños, revisar PR abierto para evitar duplicar otras automatizaciones, pruebas CI verdes antes del merge, aislamiento business_id/JWT, no compartir PII entre empresas, no enviar emails/WhatsApp ni gastar en anuncios ni cobrar sin acción autorizada; no tocar secretos, RLS ni datos existentes. Fusionar GitHub no prueba despliegue Cloudflare. Cada PR publicado debe figurar en el historial con su número y estado real.

**Publicado y verificado:** C01–C10 integradas en main mediante PR #115 (6 checks verdes). **Publicado y verificado:** C11–C16 integradas en main mediante PR #116 (6 checks verdes), reutilizando el núcleo G06 de PR #113. **Publicado y verificado:** C17–C20 integradas en main mediante PR #118 (6 verificaciones verdes): seguimiento basado en antigüedad y agenda local por usuario y empresa. La agenda no se sincroniza entre dispositivos ni envía notificaciones. Los antiguos PR #110 y #112 contienen prototipos de lógica similares; revisar antes de retomarlos para evitar duplicar la interfaz publicada.

| ID | Área | Entrega comprobable | Estado |
|---|---|---|---|
| C01 | Auditoría de calidad comercial | Alertar oportunidades nuevas sin cambios durante 3 días | Publicada · PR #115 · CI verde |
| C02 | Auditoría de calidad comercial | Detectar contactos sin avances tras 7 días | Publicada · PR #115 · CI verde |
| C03 | Auditoría de calidad comercial | Señalar oportunidades calificadas detenidas más de 7 días | Publicada · PR #115 · CI verde |
| C04 | Auditoría de calidad comercial | Detectar leads sin correo ni teléfono | Publicada · PR #115 · CI verde |
| C05 | Auditoría de calidad comercial | Identificar direcciones de email que requieren revisión | Publicada · PR #115 · CI verde |
| C06 | Auditoría de calidad comercial | Detectar teléfonos con formato posiblemente incompleto | Publicada · PR #115 · CI verde |
| C07 | Auditoría de calidad comercial | Señalar origen de pauta sin campaña declarada | Publicada · PR #115 · CI verde |
| C08 | Auditoría de calidad comercial | Identificar oportunidades con fuente «Otro» por precisar | Publicada · PR #115 · CI verde |
| C09 | Auditoría de calidad comercial | Advertir cierres ganados sin importe registrado | Publicada · PR #115 · CI verde |
| C10 | Auditoría de calidad comercial | Encontrar oportunidades calificadas sin notas de contexto | Publicada · PR #115 · CI verde |
| C11 | Gestión avanzada de oportunidades | Filtrar oportunidades por etapa | Publicada · PR #116 · CI verde |
| C12 | Gestión avanzada de oportunidades | Filtrar oportunidades por canal declarado | Publicada · PR #116 · CI verde |
| C13 | Gestión avanzada de oportunidades | Filtrar oportunidades por intervalo de fechas | Publicada · PR #116 · CI verde |
| C14 | Gestión avanzada de oportunidades | Guardar filtros por usuario y empresa | Publicada · PR #116 · CI verde |
| C15 | Gestión avanzada de oportunidades | Recuperar una vista comercial guardada | Publicada · PR #116 · CI verde |
| C16 | Gestión avanzada de oportunidades | Eliminar vistas sin modificar contactos | Publicada · PR #116 · CI verde |
| C17 | Gestión avanzada de oportunidades | Ordenar seguimiento usando última actividad registrada | Publicada · PR #118 · CI verde |
| C18 | Gestión avanzada de oportunidades | Crear tareas comerciales internas sin notificar externamente | Publicada · PR #118 · CI verde |
| C19 | Gestión avanzada de oportunidades | Marcar tareas internas como concluidas con verificación de usuario | Publicada · PR #118 · CI verde |
| C20 | Gestión avanzada de oportunidades | Mostrar resumen de tareas vencidas por negocio | Publicada · PR #118 · CI verde |
| C21 | Captación y trazabilidad | Asociar UTMs declaradas a registros nuevos con validación | Pendiente |
| C22 | Captación y trazabilidad | Conservar la URL de campaña en contexto de la oportunidad sin guardar tokens | Pendiente |
| C23 | Captación y trazabilidad | Crear presets de utm_source para canales | Publicada · PR #120 · CI verde |
| C24 | Captación y trazabilidad | Crear presets de utm_medium sin alterar enlaces originales | Publicada · PR #121 · CI verde |
| C25 | Captación y trazabilidad | Alertar cuando los parámetros UTM obligatorios estén vacíos | Publicada · PR #121 · CI verde |
| C26 | Captación y trazabilidad | Generar nombre de campaña normalizado y legible | Publicada · PR #121 · CI verde |
| C27 | Captación y trazabilidad | Proveer vista previa de enlaces HTTPS etiquetados | Publicada · PR #121 · CI verde |
| C28 | Captación y trazabilidad | Exportar exclusivamente etiquetas de campaña sin datos de contactos | Publicada · PR #123 · CI verde |
| C29 | Captación y trazabilidad | Comparar cobertura de oportunidades por origen declarado | Publicada · PR #122 · CI verde |
| C30 | Captación y trazabilidad | Explicar cobertura parcial y límites de atribución de cada comparación | Publicada · PR #122 · CI verde |
| C31 | Activación y retención | Mostrar progreso real del onboarding de empresa | Publicada · PR #125 · CI verde |
| C32 | Activación y retención | Detectar si aún no hay primera oportunidad registrada | Publicada · PR #125 · CI verde |
| C33 | Activación y retención | Explicar cómo conectar una fuente de analítica autorizada | Publicada · PR #125 · CI verde |
| C34 | Activación y retención | Guiar desde una pantalla vacía hacia la primera acción | Publicada · PR #125 · CI verde |
| C35 | Activación y retención | Ofrecer demo aislada con métricas claramente ficticias | Integrada · PR #131 · 5 checks verdes |
| C36 | Activación y retención | Registrar hitos de activación sin información personal | Integrada · PR #134 · CI verde |
| C37 | Activación y retención | Mostrar seguimiento de actividad comercial por períodos comparables | Pendiente |
| C38 | Activación y retención | Separar datos actuales de cohortes con muestras insuficientes | Integrada · PR #136 · CI verde |
| C39 | Activación y retención | Generar checklist de calidad de integración por negocio | Integrada · PR #127 · 6 checks verdes |
| C40 | Activación y retención | Advertir cuando una integración no puede confirmar datos recientes | Integrada · PR #127 · 6 checks verdes |
| C41 | Reportes y preparación SaaS | Exportar reporte resumido de seguimiento sin PII | Publicada · PR #126 · CI verde |
| C42 | Reportes y preparación SaaS | Añadir totales desglosados por etapa y canal al reporte | Publicada · PR #126 · CI verde |
| C43 | Reportes y preparación SaaS | Proteger CSV contra fórmulas maliciosas | Publicada · PR #126 · CI verde |
| C44 | Reportes y preparación SaaS | Permitir períodos comparables en reportes agregados | Publicada · PR #126 · CI verde |
| C45 | Reportes y preparación SaaS | Documentar fuentes, fechas y universo de cada KPI | Publicada · PR #126 · CI verde |
| C46 | Reportes y preparación SaaS | Mostrar estados de suscripción sin ejecutar cobros | Integrada · PR #135 · CI verde |
| C47 | Reportes y preparación SaaS | Previsualizar límites de planes sin aplicarlos a clientes | Integrada · PR #133 · CI verde |
| C48 | Reportes y preparación SaaS | Mostrar una lista de preparación comercial para una demo | Integrada · PR #127 · 6 checks verdes |
| C49 | Reportes y preparación SaaS | Reforzar navegación accesible del centro de crecimiento | Integrada · PR #128 · 3 checks verdes |
| C50 | Reportes y preparación SaaS | Agregar pruebas de regresión para todas las nuevas capacidades | Pendiente |

**C23 publicada:** PR #120 fusionado con 3 verificaciones verdes. **C24–C27 publicadas:** PR #121 fusionado con 3 verificaciones verdes. **C29–C30 publicadas:** PR #122 fusionado con 3 verificaciones verdes. **C28 publicada:** PR #123 fusionado con 3 verificaciones verdes; la exportación CSV no incluye la URL ni PII y neutraliza fórmulas.

**C31–C34 publicadas:** PR #125 fusionado en main con seis verificaciones verdes; mejora guía de activación con progreso verificable, primera oportunidad, GA4 y próxima acción. **C41–C45 publicadas:** PR #126 fusionado tras seis verificaciones verdes (reporte comercial agregado exportable y períodos comparables). **C39, C40 y C48 integradas:** PR #127 fusionado tras seis checks verdes. **C49 integrada:** PR #128 fusionado tras tres checks verdes; añade un enlace de salto al contenido con foco visible y pruebas de teclado. La implementación de C49 cubre la navegación global al contenido, no una auditoría completa de accesibilidad.

**C35 integrada:** PR #131 fusionado en main con 5 checks exitosos para el SHA `ef6262af699e84cfca70ed9f5aac7dde398c74ae` (tests, syntax, regressions, playwright y Workers Builds). Demo exclusivamente sintética, sin sincronización de datos ni despliegue Cloudflare confirmado.

**C47 integrada:** PR #133 (5 checks verdes), simulador local de límites, sin cobros. **C36 integrada:** PR #134 (5 checks verdes), hitos locales por empresa y usuario, no sincronizados. **C46 integrada:** PR #135 (5 checks verdes), estados de suscripción ilustrativos sin facturación. **C38 integrada:** PR #136 (checks de tests, syntax, regressions y playwright verdes), comparador manual con umbral de muestra, no sincronizado. Todas integradas en main; no se ha verificado despliegue Cloudflare.

**Control documental automático:** los cambios de este plan deben pasar `validate-growth-plan` (50 identificadores únicos, PR por entrega integrada y contador consistente); un PR documental sin ese check no se fusiona. Esta verificación no sustituye las pruebas funcionales ni acredita despliegue.

## Protocolo repetible
1. Leer este archivo en main y comprobar commits y PR actuales antes de empezar.
2. Seleccionar una entrega pendiente sin desarrollo en otra rama. Si hay un PR en borrador, inspeccionarlo y corregirlo en lugar de duplicarlo.
3. Entregar implementación de usuario o lógica consumida realmente por el sistema, con pruebas positivas, negativas y de aislamiento.
4. Validar todos los checks aplicables y merge a main, sin forzar protecciones. Actualizar el estado de la entrega y registrar enlace del PR fusionado.
5. Si falla CI, corregir y repetir. Si bloquea la seguridad o faltan herramientas, registrar bloqueo y continuar con otra entrega independiente.

## Historial

| Fecha | Entregas | PR fusionado | CI |
|---|---|---|---|
| 2026-11-04 | C01–C10 | PR #115 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C11–C16 | PR #116 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C17–C20 | PR #118 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C23 | PR #120 fusionado en main | 3 verificaciones verdes |
| 2026-11-04 | C24–C27 | PR #121 fusionado en main | 3 verificaciones verdes |
| 2026-11-04 | C29–C30 | PR #122 fusionado en main | 3 verificaciones verdes |
| 2026-11-04 | C28 | PR #123 fusionado en main | 3 verificaciones verdes |
| 2026-11-04 | C31–C34 | PR #125 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C41–C45 | PR #126 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C39–C40, C48 | PR #127 fusionado en main | 6 verificaciones verdes |
| 2026-11-04 | C49 (salto accesible) | PR #128 fusionado en main | 3 verificaciones verdes |
| 2026-11-05 | C35 | PR #131 fusionado en main | 5 verificaciones verdes |
| 2026-11-05 | C47 | PR #133 fusionado en main | 5 verificaciones verdes |
| 2026-11-05 | C36 | PR #134 fusionado en main | 5 verificaciones verdes |
| 2026-11-05 | C46 | PR #135 fusionado en main | 5 verificaciones verdes |
| 2026-11-05 | C38 | PR #136 fusionado en main | 4 workflows verdes |
