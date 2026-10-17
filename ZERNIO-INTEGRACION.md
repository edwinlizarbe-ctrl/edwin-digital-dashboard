# Integración Zernio / WhatsApp en Edwin CRM

La conexión se inicia desde **Integraciones → Mensajería → Conectar WhatsApp** de cada cliente, mediante el flujo hospedado de Meta Embedded Signup de Zernio.

## Configuración de Cloudflare

En el Worker **edwin-digital-dashboard**, crear un secreto (nunca variable pública):

```bash
npx wrangler secret put ZERNIO_API_KEY
```

Ingresar allí una clave API de Zernio. No incluirla en GitHub ni en el frontend.

## Arquitectura

- La sesión se valida mediante Supabase Auth y el JWT del usuario.
- Antes de llamar a Zernio, se comprueba por RLS que el usuario tiene acceso a `business_id`.
- El servidor crea un perfil de Zernio por empresa con un nombre estable y un encabezado de idempotencia; así los clics repetidos no multiplican perfiles.
- El servidor devuelve el enlace de Embedded Signup hospedado, configurado con `onboarding=api`, `signup=hosted`, idioma español y marca Edwin Digital.
- El navegador abre Meta y regresa a Edwin CRM al finalizar; no se registra como «conectado» hasta verificar la cuenta en Zernio.

**Limitación de esta primera etapa:** implementa la autorización y apertura del flujo de conexión; todavía no almacena el `accountId` validado ni implementa bandeja, webhooks o envío de mensajes. Esas funciones necesitan una segunda etapa de integración y pruebas reales con la cuenta de Zernio.

**Números existentes:** un número ya conectado a YCloud puede requerir el proceso de migración admitido por Meta y Zernio. Este cambio no elimina ni desconecta números de proveedores.

Referencia: https://docs.zernio.com/platforms/whatsapp/connection
