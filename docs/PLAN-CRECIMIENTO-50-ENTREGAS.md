# Edwin CRM · 50 entregas verificables de crecimiento

**Objetivo:** capacidades útiles que eleven captación, conversión, seguimiento, activación, calidad comercial y preparación SaaS. Estas son **entregas pendientes o desarrolladas**, no 50 cambios publicados por el mero hecho de escribir el plan.

**Reglas operativas:** trabajar por bloques pequeños, revisar PR abierto para evitar duplicar otras automatizaciones, pruebas CI verdes antes del merge, aislamiento business_id/JWT, no compartir PII entre empresas, no enviar emails/WhatsApp ni gastar en anuncios ni cobrar sin acción autorizada; no tocar secretos, RLS ni datos existentes. Fusionar GitHub no prueba despliegue Cloudflare. Cada PR publicado debe figurar en el historial con su número y estado real.

Los diez controles C01–C10 se implementan en el PR que añade este documento, con pruebas independientes; se considerarán publicados únicamente **después** de verificar merge a main y CI. G04, G05 y G06 tenían PR en borrador; antes de implementarlos hay que revisarlos para no duplicar trabajo.

| ID | Área | Entrega comprobable | Estado |
|---|---|---|---|
| C01 | Auditoría de calidad comercial | Alertar oportunidades nuevas sin cambios durante 3 días | Implementada en esta rama; pendiente CI y merge |
| C02 | Auditoría de calidad comercial | Detectar contactos sin avances tras 7 días | Implementada en esta rama; pendiente CI y merge |
| C03 | Auditoría de calidad comercial | Señalar oportunidades calificadas detenidas más de 7 días | Implementada en esta rama; pendiente CI y merge |
| C04 | Auditoría de calidad comercial | Detectar leads sin correo ni teléfono | Implementada en esta rama; pendiente CI y merge |
| C05 | Auditoría de calidad comercial | Identificar direcciones de email que requieren revisión | Implementada en esta rama; pendiente CI y merge |
| C06 | Auditoría de calidad comercial | Detectar teléfonos con formato posiblemente incompleto | Implementada en esta rama; pendiente CI y merge |
| C07 | Auditoría de calidad comercial | Señalar origen de pauta sin campaña declarada | Implementada en esta rama; pendiente CI y merge |
| C08 | Auditoría de calidad comercial | Identificar oportunidades con fuente «Otro» por precisar | Implementada en esta rama; pendiente CI y merge |
| C09 | Auditoría de calidad comercial | Advertir cierres ganados sin importe registrado | Implementada en esta rama; pendiente CI y merge |
| C10 | Auditoría de calidad comercial | Encontrar oportunidades calificadas sin notas de contexto | Implementada en esta rama; pendiente CI y merge |
| C11 | Gestión avanzada de oportunidades | Filtrar oportunidades por etapa | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C12 | Gestión avanzada de oportunidades | Filtrar oportunidades por canal declarado | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C13 | Gestión avanzada de oportunidades | Filtrar oportunidades por intervalo de fechas | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C14 | Gestión avanzada de oportunidades | Guardar filtros por usuario y empresa | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C15 | Gestión avanzada de oportunidades | Recuperar una vista comercial guardada | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C16 | Gestión avanzada de oportunidades | Eliminar vistas sin modificar contactos | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C17 | Gestión avanzada de oportunidades | Ordenar seguimiento usando última actividad registrada | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C18 | Gestión avanzada de oportunidades | Crear tareas comerciales internas sin notificar externamente | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C19 | Gestión avanzada de oportunidades | Marcar tareas internas como concluidas con verificación de usuario | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C20 | Gestión avanzada de oportunidades | Mostrar resumen de tareas vencidas por negocio | Pendiente; revisar PR #110, #112 o #113 según corresponda |
| C21 | Captación y trazabilidad | Asociar UTMs declaradas a registros nuevos con validación | Pendiente |
| C22 | Captación y trazabilidad | Conservar la URL de campaña en contexto de la oportunidad sin guardar tokens | Pendiente |
| C23 | Captación y trazabilidad | Crear presets de utm_source para canales | Pendiente |
| C24 | Captación y trazabilidad | Crear presets de utm_medium sin alterar enlaces originales | Pendiente |
| C25 | Captación y trazabilidad | Alertar cuando los parámetros UTM obligatorios estén vacíos | Pendiente |
| C26 | Captación y trazabilidad | Generar nombre de campaña normalizado y legible | Pendiente |
| C27 | Captación y trazabilidad | Proveer vista previa de enlaces HTTPS etiquetados | Pendiente |
| C28 | Captación y trazabilidad | Exportar exclusivamente etiquetas de campaña sin datos de contactos | Pendiente |
| C29 | Captación y trazabilidad | Comparar cobertura de oportunidades por origen declarado | Pendiente |
| C30 | Captación y trazabilidad | Explicar cobertura parcial y límites de atribución de cada comparación | Pendiente |
| C31 | Activación y retención | Mostrar progreso real del onboarding de empresa | Pendiente |
| C32 | Activación y retención | Detectar si aún no hay primera oportunidad registrada | Pendiente |
| C33 | Activación y retención | Explicar cómo conectar una fuente de analítica autorizada | Pendiente |
| C34 | Activación y retención | Guiar desde una pantalla vacía hacia la primera acción | Pendiente |
| C35 | Activación y retención | Ofrecer demo aislada con métricas claramente ficticias | Pendiente |
| C36 | Activación y retención | Registrar hitos de activación sin información personal | Pendiente |
| C37 | Activación y retención | Mostrar seguimiento de actividad comercial por períodos comparables | Pendiente |
| C38 | Activación y retención | Separar datos actuales de cohortes con muestras insuficientes | Pendiente |
| C39 | Activación y retención | Generar checklist de calidad de integración por negocio | Pendiente |
| C40 | Activación y retención | Advertir cuando una integración no puede confirmar datos recientes | Pendiente |
| C41 | Reportes y preparación SaaS | Exportar reporte resumido de seguimiento sin PII | Pendiente |
| C42 | Reportes y preparación SaaS | Añadir totales desglosados por etapa y canal al reporte | Pendiente |
| C43 | Reportes y preparación SaaS | Proteger CSV contra fórmulas maliciosas | Pendiente |
| C44 | Reportes y preparación SaaS | Permitir períodos comparables en reportes agregados | Pendiente |
| C45 | Reportes y preparación SaaS | Documentar fuentes, fechas y universo de cada KPI | Pendiente |
| C46 | Reportes y preparación SaaS | Mostrar estados de suscripción sin ejecutar cobros | Pendiente |
| C47 | Reportes y preparación SaaS | Previsualizar límites de planes sin aplicarlos a clientes | Pendiente |
| C48 | Reportes y preparación SaaS | Mostrar una lista de preparación comercial para una demo | Pendiente |
| C49 | Reportes y preparación SaaS | Reforzar navegación accesible del centro de crecimiento | Pendiente |
| C50 | Reportes y preparación SaaS | Agregar pruebas de regresión para todas las nuevas capacidades | Pendiente |

## Protocolo repetible
1. Leer este archivo en main y comprobar commits y PR actuales antes de empezar.
2. Seleccionar una entrega pendiente sin desarrollo en otra rama. Si hay un PR en borrador, inspeccionarlo y corregirlo en lugar de duplicarlo.
3. Entregar implementación de usuario o lógica consumida realmente por el sistema, con pruebas positivas, negativas y de aislamiento.
4. Validar todos los checks aplicables y merge a main, sin forzar protecciones. Actualizar el estado de la entrega y registrar enlace del PR fusionado.
5. Si falla CI, corregir y repetir. Si bloquea la seguridad o faltan herramientas, registrar bloqueo y continuar con otra entrega independiente.

## Historial

| Fecha | Entregas | PR fusionado | CI |
|---|---|---|---|
| — | C01–C50 | Se actualizará con entregas verificadas | No atribuir un merge antes de comprobarlo |
