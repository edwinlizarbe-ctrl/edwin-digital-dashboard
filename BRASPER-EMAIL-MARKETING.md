# Email Marketing Brásper — guía de activación y operación

## Implementación lista para activarse

Integrado con Edwin CRM en \`feature/brasper-email-marketing\`. La empresa Brásper fue creada en Supabase con slug \`brasper\` y enlazada al usuario cliente de Edwin CRM; sus contactos, borradores, archivos y entregas se almacenan aparte de Edwin Digital.

### Funciones de usuario
- Crear, guardar y duplicar newsletters. Bloques arrastrables o reordenables con flechas, texto, botones e imágenes.
- Plantillas Español / Portugués de Brasil. Variables \`{{nombre}}\` y \`{{empresa}}\`. Preview móvil/escritorio.
- Imágenes JPG/PNG/WebP en Supabase Storage (bucket público solo de imágenes de newsletter).
- Importación CSV y XLSX desde el navegador, hasta 3000 filas por archivo, en lotes de hasta 300; solo registros con consentimiento afirmativo. Importaciones repetidas no rehabilitan bajas.
- Ver contactos recientes y marcar manualmente una baja.
- Envío de prueba individual a una dirección en lista permitida (requiere Resend).
- Programar campañas a contactos consentidos del idioma elegido, máximo 2000 por campaña; confirmación expresa en UI; cola atómica en Supabase y ejecución Cron cada 5 minutos (máximo 10 envíos por ciclo), idempotencia por destinatario.
- Pausar y reanudar; consultar resultados enviados, entregados, abiertos, clics, rebotes y fallos cuando la API/webhook devuelva esos eventos.
- Bajas por enlace autenticado criptográficamente, con botón de confirmación; cabeceras List-Unsubscribe de un clic.
- Webhook firmado de Resend con supresión automática por rebote/queja.

### Activación externa — requisitos obligatorios, aún NO configurados
En Cloudflare Worker **Production** definir:
1. \`BRASPER_BUSINESS_ID\`: el UUID de Brásper guardado en Supabase, visible en la tabla businesses.
2. \`RESEND_API_KEY\`: API key privada de la cuenta Resend.
3. \`EMAIL_FROM\`: remitente **verificado** del dominio de Brásper (p. ej. \`Brásper <newsletter@brasper.com>\` **solo si ya existe y está verificado**).
4. \`RESEND_WEBHOOK_SECRET\`: clave privada del webhook en Resend que recibe eventos \`/api/email-marketing/webhook\`.
5. \`EMAIL_UNSUBSCRIBE_KEY\`: secreto de 64 dígitos hex (AES-quality random) generado con \`openssl rand -hex 32\`, almacenado solo como Secret. No compartir.
6. \`EMAIL_TEST_RECIPIENTS\`: una o varias direcciones de prueba separadas por coma.
7. \`EMAIL_SENDING_ENABLED\`: **no crear o mantener \`false\`** hasta que el dominio, la bandeja, las bajas, los webhooks y el consentimiento estén comprobados. Configurar \`true\` únicamente tras la autorización expresa para campañas reales.

Cloudflare precisa disponer además de \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\` y \`SUPABASE_SERVICE_ROLE_KEY\`. No copiar ningún secreto en GitHub ni en capturas.

### Orden de pruebas antes de enviar
1. Confirmar publicación del PR y recargar Edwin CRM. Seleccionar empresa Brásper en la esquina superior.
2. Abrir Email Marketing, guardar newsletter en español y portugués, subir banners y comprobar vista móvil.
3. Importar primero 2–5 contactos voluntarios de test, nunca bases compradas/scrapeadas. Comprobar que los nombres e idiomas correspondan.
4. Crear y verificar el dominio en Resend (registros DKIM/SPF/DMARC según instrucciones actuales del proveedor), configurar \`RESEND_API_KEY\`, \`EMAIL_FROM\` y \`EMAIL_TEST_RECIPIENTS\`.
5. Realizar 1 envío de prueba a una cuenta permitida; comprobar recibido, imagen y personalización.
6. Configurar webhook firmado; hacer una prueba real de baja, comprobar que la persona dejó de recibir.
7. Confirmar límites y reputación de envíos, datos del remitente, información legal corporativa y permisos según normativa aplicable.
8. Solo después de aprobar expresamente los destinatarios/segmentos y el proveedor, establecer \`EMAIL_SENDING_ENABLED=true\`; activar programaciones desde el CRM.

### Limitaciones conocidas
- No se ha validado una campaña masiva real, porque faltan autorizaciones/credenciales de Resend.
- La importación \`.xlsx\` utiliza DecompressionStream en el navegador; si el navegador no admite el formato, exportar CSV UTF-8.
- La cola envía aproximadamente 10 correos cada 5 minutos; no está optimizada para millones de contactos.
- Las aperturas no son una prueba exacta de lectura (protecciones de privacidad y clientes bloquean píxeles).
- Los eventos quedan registrados solo si Resend está configurado con webhooks y seguimiento habilitado.
- Los envíos inciertos permanecen en estado \`claimed\` para revisión manual, evitando reenvíos duplicados.
- La lista muestra contactos recientes; la vista de estadísticas puede ser parcial para listas de más de 2000 envíos.
- No mezclar contactos de la empresa Edwin Digital con Brásper.

## Calidad y seguridad
- Backend sin secretos en cliente, revisión de permisos de pertenencia RLS de Brásper.
- Tablas privadas RLS: \`ed_email_campaigns\`, \`ed_email_contacts\`, \`ed_email_assets\`, \`ed_email_deliveries\`, \`ed_email_webhook_events\`.
- Importación con consentimiento, supresión de bajas, autorización explícita para programar, verificación de firma del webhook, límites por lote, HTML escapado.
- Pruebas automáticas con Node y compilación Cloudflare Preview. Las pruebas no sustituyen un smoke test de usuario final.
