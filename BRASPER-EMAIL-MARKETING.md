# Brásper — Email Marketing (MVP seguro)

## Estado
Módulo desarrollado en la rama `feature/brasper-email-marketing`. **No publicado en producción**, no tiene una ruta de envío masivo y no envía correos reales sin habilitar explícitamente Resend y un destinatario de prueba en allowlist.

Incluye en el menú de Edwin CRM **Email Marketing**:
- Editor visual de bloques: títulos, párrafos, imágenes y botones HTTPS; mover con arrastrar/soltar o flechas.
- Plantillas ES y PT-BR, variables `{{nombre}}` y `{{empresa}}` en asunto/contenido; el preview muestra Camila como nombre de muestra.
- Vista previa adaptativa computadora/celular en iframe aislado.
- Guardar borradores en Supabase, editarlos y duplicarlos (sin publicación de campañas).
- Contactos autorizados con importación CSV (UTF-8 con encabezados `nombre,email,idioma,empresa,consentimiento`), máximo 300 por lote, desduplicación e idioma.
- Respetar bajas: no reactivar contactos mediante otra importación.
- Biblioteca de imágenes JPG/PNG/WebP hasta 2 MB en bucket público **solo para material creativo**, sin contacto/datos personales; copia URL a un bloque Imagen.
- Prueba opcional de correo **individual** vía Resend, restringida a un destinatario autorizado configurado previamente en Cloudflare.

### Restricciones críticas
- El backend **exige** `BRASPER_BUSINESS_ID` y compara UUID exacto, comprueba JWT del cliente y pertenencia al negocio mediante RLS. No permite usar la empresa de otra persona ni desde superadministración.
- En Supabase, al preparar este trabajo, solo existía un negocio llamado **Edwin Digital**; **Brásper no estaba creado**. Debe darse de alta y asignarse al usuario autorizado, sin reutilizar la empresa de Edwin Digital ni mezclar clientes.
- Cloudflare secrets/variables para probar: `BRASPER_BUSINESS_ID` (UUID de su negocio); `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` deben existir en el Worker. Opcionales para UNA prueba: `RESEND_API_KEY`, `EMAIL_FROM` con remitente verificado y `EMAIL_TEST_RECIPIENTS` con correos separados por coma.
- Solo después de desplegar en Preview y verificar estas variables usar las operaciones.
- Aplicar migración `migrations/20261015_brasper_email_marketing.sql` en Supabase. Crea tablas privadas `ed_email_campaigns`, `ed_email_contacts`, `ed_email_assets` y bucket público `brasper-newsletter-assets`. Usar bucket **solo para imágenes de newsletter**.
- **CSV**: Excel permite «Guardar como CSV UTF-8». Importación directa `.xlsx`, envíos masivos, programación y medición de aperturas/clics/rebotes aún **NO implementados**; requieren diseño y pruebas adicionales.
- El consentimiento importado es una declaración del operador. No se ha creado seguimiento de consentimiento externo ni enlace público de baja. Por eso **no puede** activar envíos a la lista de contactos sin una fase posterior.
- Antes de lanzar campañas se requieren: verificación del dominio remitente y permisos comerciales, proveedor transaccional/bulk, colas, cuotas, desuscripciones tokenizadas, manejo de rebotes/quejas, políticas de privacidad aplicables y pruebas reales.

## Flujo de uso
1. Entrar con usuario autorizado de Brásper en Edwin CRM.
2. Abrir **Email Marketing**, crear campaña, componer los bloques y usar vista previa.
3. Guardar y duplicar borradores.
4. Subir banners; copiar el enlace al bloque de Imagen.
5. Exportar un Excel como CSV UTF-8 e importar únicamente consentidos.
6. Opcionalmente configurar Resend y **solo un correo de prueba** previamente autorizado.

## Seguridad y validación
- Todas las escrituras son JSON con control de origen cuando el navegador lo proporciona, topes de tamaño y validación de campos. HTML renderizado siempre escapado; enlaces solo HTTPS. Supabase tables RLS activas, acceso directo anon/authenticated revocado; service_role solo en Worker.
- Exposición pública únicamente de imágenes de marketing; los contactos no son públicos.
- CI `.github/workflows/brasper-email-check.yml`: `node --check` y `node --test` sobre módulo más Google Ads y leads. **No** prueba correos reales ni una cuenta autenticada en la interfaz.
- La rama y el PR siguen separados de main hasta aprobación; **no** publicar el nuevo módulo ni enviar pruebas a destinatarios reales sin autorización.
