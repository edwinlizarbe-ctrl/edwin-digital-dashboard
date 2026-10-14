# Piloto Google Ads — Preview creada tras configurar los secretos

Este branch **solo prepara una Preview nueva**; no se fusiona a `main` ni despliega producción.

Motivo: la Preview antigua `feature-google-ads-oauth` se generó antes de configurar los seis secretos en Cloudflare Previews Base. La documentación de Cloudflare aclara que secretos añadidos a Base más tarde solo se copian a **Previews nuevas**, no a las ya existentes:
https://developers.cloudflare.com/workers/previews/configuration/

Este branch fue creado con el mismo código probado de `feature/google-ads-oauth`, después de configurar Previews Base, para activar un build automático aislado. No contiene secretos.

Pasos de validación:
- Confirmar el éxito del build/deploy de esta rama en Cloudflare Workers Builds.
- Comprobar protección Cloudflare Access: `Previews only`.
- Tomar la URL de Preview real del build (no inventarla ni usar una URL de producción).
- Registrar su callback completo `/api/google-ads/callback` como URI adicional en el cliente OAuth existente de Google Cloud.
- Iniciar sesión con un usuario autorizado de Edwin CRM, conectar Google Ads y revisar el endpoint status, cuentas, campañas y períodos 7/30/90.
- Revisar errores y evitar el merge/deploy productivo hasta terminar la prueba.
