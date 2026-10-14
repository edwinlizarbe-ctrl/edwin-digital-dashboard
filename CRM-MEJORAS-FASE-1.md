# Edwin CRM — mejoras 2026 (implementación por fases)

## Fase 1 — Implementada en la rama de pruebas

1. **Campañas Ads / centro de rendimiento**: resumen simultáneo Meta Ads y Google Ads de informes ya cargados. No se suman distintas monedas ni períodos. Falta agregación comercial estandarizada tras validar cada API.
2. **CRM de contactos y oportunidades**: registro **manual** de contacto, origen declarado, campaña, notas, importe/moneda y etapa (Nuevo → Contactado → Calificado → Venta cerrada / Perdido). Edición de etapa y CSV. `/api/crm/leads` con revisión de negocio mediante JWT/RLS y persistencia en `ed_crm_leads` cifrada a nivel de almacenamiento Supabase. La creación **no implica** conversión atribuida ni captura automática desde WhatsApp.
3. **Integraciones**: Google Ads en ventana OAuth emergente y conexión por empresa (ya implementado en piloto). Meta y GA4 no se modifican.
4. **Asistente**: contexto acotado a métricas Google Ads consultadas y conteos del embudo. No se envían nombre, teléfono, correo ni notas de los contactos desde este contexto.
5. **Reportes**: exportación CSV bajo demanda de Google Ads y de oportunidades. Se mantienen los reportes GA4 existentes. Sin PDF ni programación automática todavía.
6. **Alertas**: señales en pantalla basadas en informes existentes, por ejemplo gasto en Google sin conversiones reportadas o informes parciales. No se envían notificaciones automáticas; la interpretación del tracking debe verificarse.
7. **Multicliente**: se reutiliza la base de autenticación y pertenencia por `business_id`. La tabla nueva habilita RLS y revoca acceso directo anon/authenticated. Planes y permisos de integraciones ya existentes se mantienen; cobros automáticos todavía pendientes.

### Validación

- CI de GitHub completó sintaxis y pruebas simuladas de Google Ads y aislamiento de oportunidades.
- Migración de leads `migrations/20261014_crm_leads.sql` aplicada en Supabase como `ed_crm_leads_secure`. Comprobado: RLS habilitado, sin SELECT directo para anon o authenticated, acceso backend service_role, inicialmente cero registros.
- La aplicación **no** ha sido desplegada a producción. PR general #22 sigue en borrador.
- Las pruebas en navegador con cliente autenticado, móvil y conexión real de Meta, GA4 y Google Ads necesitan validación antes del lanzamiento.

## Siguientes fases (NO IMPLEMENTADAS)

- **Trazabilidad automática web → WhatsApp → ventas**: alinear un identificador de sesión/lead entre calculadora, mensaje WhatsApp, CRM del vendedor y cierre; persistir gclid/fbclid/UTMs solo con fundamento y consentimiento apropiado, aplicar reglas de atribución.
- **Reportes PDF personalizados, Excel completo y envío programado**: plantillas, firma de marca, canal/destinatarios, consentimiento y horario.
- **Alertas automáticas por email/WhatsApp**: umbrales por empresa, protección contra ruido, desduplicación y monitorización fuera de horario.
- **Agente IA con análisis verificable**: referencias a fuente/cuenta/período y límites para evitar afirmaciones de atribución no respaldadas.
- **SaaS comercial**: precios, cobros, invitaciones, auditoría y logos almacenados en la nube por empresa.
- **Escalabilidad**: paginación y filtrado de oportunidades más allá de 100 registros, permisos de vendedores, auditoría de cambios de etapas, borrado y retención por empresa.

No copiar claves ni tokens en estos documentos. Mantener el CRM productivo en `main` sin cambios hasta que el operador verifique secretos privados de Google Ads y otorgue aprobación de publicación.
