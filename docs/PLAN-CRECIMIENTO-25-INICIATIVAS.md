# Edwin CRM — 25 iniciativas automatizadas de crecimiento

## Propósito
Construir capacidades **nuevas** de captación, conversión, activación, retención, medición y monetización, no solo corregir errores. Fuente de verdad para la automatización «Motor de crecimiento CRM» y sus tareas de especialidad. Desarrollo secuencial y verificable: **analizar → implementar → probar → PR → CI verde → fusionar a main → marcar [x] aquí**.

## Control de seguridad y entregas
- Repositorio: `edwinlizarbe-ctrl/edwin-digital-dashboard`; usa rama específica y PR con pruebas. Antes de iniciar revisa si ya existe un PR o una implementación equivalente; si existe, no la dupliques.
- Un cambio por PR siempre que sea práctico. Nunca marques como completado algo sin pruebas y commit fusionado. Comprueba el resultado real de la herramienta y enlaza PR/CI en el registro de avance.
- No usar datos de clientes de prueba, ni compartir secretos o PII entre tenants. No modificar permisos RLS, datos históricos, API keys, campañas publicitarias, gasto, mensajes, emails masivos o pagos reales sin garantías suficientes. Respeta consentimiento y preferencias de exclusión.
- Las funcionalidades de contacto externo, OAuth, cobros, captación pública y permisos avanzados se preparan bajo bandera inactiva y pruebas; **no activarlas** automáticamente si no hay verificación de seguridad ni infraestructura.
- El código fusionado en GitHub **no equivale** a despliegue confirmado de Cloudflare. No afirmar producción sin comprobación. Si no hay forma segura de implementar una iniciativa, registra `bloqueada` con causa técnica y pasa a la siguiente implementable.
- Al actualizar este archivo en un PR, cambia solo el marcador de la iniciativa que ese mismo PR implementó; preserva cambios ajenos y no sobrescribas actualizaciones simultáneas. Medición honesta: el software puede mejorar el embudo, pero no garantiza ingresos.

## Backlog priorizado

| ID | Iniciativa | Objetivo | Estado |
|---|---|---|---|
| G01 | Embudo por origen | Captación: API agregada por etapa/origen para una empresa autorizada, sin devolver PII; límite y parcialidad explícitos. | [ ] Pendiente |
| G02 | Panel de conversión | Conversión: Vista interactiva con volumen y tasa de avance por etapa y canal, siempre identificando universo y período. | [ ] Pendiente |
| G03 | Scoring comercial transparente | Conversión: Prioridad de oportunidades basada solo en factores declarados y reglas configurables; explicar el motivo, nunca inferir atributos sensibles. | [ ] Pendiente |
| G04 | Lista de seguimiento prioritario | Retención: Ordenar leads por etapa, fecha y actividad, marcando pendientes sin contactar a nadie automáticamente. | [ ] Pendiente |
| G05 | Tareas comerciales | Conversión: Crear y cerrar recordatorios internos por empresa y usuario; permisos aislados y sin notificaciones externas. | [ ] Pendiente |
| G06 | Filtros guardados de pipeline | Conversión: Filtros por origen, etapa y fecha con vistas guardadas por usuario sin compartir datos entre negocios. | [ ] Pendiente |
| G07 | Etiquetas de oportunidades | Conversión: Clasificación de leads con etiquetas comerciales validadas, multiempresa y con persistencia segura. | [ ] Pendiente |
| G08 | Historial comercial | Retención: Registro auditable de cambios de etapa y notas comerciales, con actor/fecha y permisos por empresa. | [ ] Pendiente |
| G09 | Detección de duplicados | Conversión: Advertir coincidencias de email/teléfono dentro de la misma empresa; sin unir ni borrar contactos automáticamente. | [ ] Pendiente |
| G10 | Biblioteca de respuestas | Conversión: Plantillas de seguimiento ES/PT copiables y editables; jamás enviar correos o WhatsApp sin acción humana. | [ ] Pendiente |
| G11 | Constructor de enlaces UTM | Captación: Generador de URLs de campaña con codificación correcta, validación y copia; sin conectar cuentas externas. | [ ] Pendiente |
| G12 | UTM asociado a oportunidad | Medición: Captura opcional y documentada de UTMs al crear oportunidades; no atribuir ventas sin evidencia. | [ ] Pendiente |
| G13 | Formulario de captación seguro | Captación: Diseñar endpoint de formularios por tenant con token, protección antiabuso, opt-in y pruebas; desactivado hasta configuración segura. | [ ] Pendiente |
| G14 | Widget web de oportunidades | Captación: Código embebible para formularios consentidos y mapeados a empresa; publicación pública solo tras revisión de seguridad. | [ ] Pendiente |
| G15 | Asistente de primera activación | Activación: Wizard para configurar empresa, sitio y fuente de datos con pasos verificables y progreso real. | [ ] Pendiente |
| G16 | Entorno demo aislado | Activación: Recorrido de producto con datos inventados, aislados y rotulados; ningún falso KPI en cuentas reales. | [ ] Pendiente |
| G17 | Exportador de embudos | Medición: Descarga CSV del embudo con filtros/fechas, agregados y aviso de muestras parciales. | [ ] Pendiente |
| G18 | Comparador de canales | Medición: Análisis por fuente sin sumar distintas monedas ni mezclar períodos; resultados con fuente y cobertura. | [ ] Pendiente |
| G19 | Telemetría de activación | Activación: Contar eventos de producto opt-in sin registrar PII ni secretos; dashboard agregado para administradores. | [ ] Pendiente |
| G20 | Análisis de cohortes | Retención: Cohortes de activación por período y empresa sin exponer usuarios; datos insuficientes señalados. | [ ] Pendiente |
| G21 | Automatización interna de tareas | Retención: Reglas configurables que creen tareas dentro del CRM, con idempotencia, límites y opción de desactivar; cero mensajes externos. | [ ] Pendiente |
| G22 | Biblioteca de landings | Captación: Componentes y propuestas de páginas de captación con preview local, sin desplegar sitios externos automáticamente. | [ ] Pendiente |
| G23 | Auditor de conversión web | Conversión: Checklist de velocidad, confianza y formularios basado en datos verificados; sin inventar resultados de análisis. | [ ] Pendiente |
| G24 | Programa de referidos interno | Expansión: Registro consentido de referido/origen y métricas del pipeline; sin pagos o premios automáticos. | [ ] Pendiente |
| G25 | Preparación comercial SaaS | Monetización: Vista de planes, límites y onboarding comercial; sin cobros ni cambios de suscripción reales sin autorización. | [ ] Pendiente |

## Criterio de aceptación por iniciativa
1. Función identificable en API o interfaz, útil con permisos y datos válidos. Una mera nota de estrategia no basta.
2. Prueba nueva que cubra ruta positiva y denegación/errores apropiados, además de CI global en verde.
3. Aislamiento multicliente con `business_id` derivado de sesión y revisado mediante RLS/JWT antes de usar service_role.
4. Respuestas claras sobre datos incompletos; no mezclar diferentes monedas/períodos en KPIs.
5. PR fusionado en `main`; desplegado en Cloudflare solo si existe proceso autorizado, verificable y con control de reversión.

## Registro de entregas

| Fecha | Iniciativa | PR / CI | Validación |
|---|---|---|---|
| — | — | — | Aún sin iniciativas completadas de este plan |
