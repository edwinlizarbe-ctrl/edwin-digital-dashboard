# Meta Ads — piloto OAuth propio (rama de prueba)

Esta versión añade una integración directa **de solo lectura** con la API oficial de Meta, sin Windsor.ai ni Nango. No requiere nuevas tablas de Supabase. **El piloto se limita al administrador que tenga acceso mediante RLS al negocio con slug `edwin-digital`**.

## 1. Configuración inicial en Meta

1. Crea una aplicación en https://developers.facebook.com/apps/ y habilita el producto de inicio de sesión compatible con Facebook Login.
2. Activa el flujo OAuth para web y registra exactamente `https://TU-DOMINIO/api/meta/callback` como URI de redirección válida.
3. Habilita `ads_read`. Para pruebas en desarrollo, usa una cuenta autorizada y un usuario con un rol permitido en la aplicación.
4. Para dar acceso a clientes externos hará falta pasar por la revisión de permisos de Meta y completar los requisitos aplicables a la aplicación. **No consideres este piloto una integración multiempresa lista para comercializar.**

## 2. Configuración privada en Cloudflare Worker

En Settings → Variables and Secrets añade:

| Nombre | Uso |
|---|---|
| `META_APP_ID` | Identificador de tu app de Meta (configurado en el servidor). |
| `META_APP_SECRET` | Secret privado de la app; **no subir a GitHub**. |
| `META_REDIRECT_URI` | URL HTTPS completa y exacta: `https://TU-DOMINIO/api/meta/callback`. Debe coincidir con Meta. |
| `META_SESSION_KEY` | Cadena de **64 caracteres hexadecimales aleatorios** (32 bytes), secreto exclusivo para cifrar cookies con AES-256-GCM. |
| `META_GRAPH_VERSION` | Opcional. Versión de Graph API como `v24.0`; actualiza según versiones admitidas por Meta. |

Genera la clave aleatoria con un gestor de secretos o `openssl rand -hex 32` en tu equipo y guárdala únicamente como secreto en Cloudflare. No compartas aquí ni en GitHub claves, tokens ni contraseñas.

## 3. Probar desde el dashboard

1. Despliega esta rama **en un entorno de prueba**, no sobre `main`, y configura el URI de retorno de ese dominio de prueba.
2. Inicia sesión en Edwin Digital Analytics como administrador del negocio `edwin-digital`.
3. Abre **Integraciones → Meta Ads → Conectar con Facebook**.
4. En la pantalla oficial de Meta, autoriza la cuenta que tenga acceso a tu cuenta publicitaria.
5. Vuelve al dashboard; selecciona una cuenta publicitaria. Verás inversión, clics, impresiones, CTR y CPC. El período se toma del selector del dashboard.
6. Usa «Actualizar datos» o «Desconectar» según corresponda.

Si el botón no aparece, comprueba que las cuatro variables obligatorias estén configuradas, que estás en el negocio correcto y que el dominio coincide exactamente con `META_REDIRECT_URI`.

## Límites deliberados del piloto

- Conexión individual vinculada al **navegador y a la sesión autenticada**; no se comparte entre dispositivos o usuarios. El token se guarda cifrado en cookie segura, HttpOnly y SameSite=Lax; puede caducar y requerir volver a conectar.
- La selección de cuenta publicitaria se verifica en la API de Meta. El negocio se valida con el JWT de Supabase y sus políticas RLS.
- No hay sincronización en segundo plano, no hay escritura sobre campañas y no hay almacenamiento de tokens de clientes en la base de datos.
- No modifica Hotmart, GA4 ni las tablas existentes.
- «Desconectar» borra el token local de esta sesión. Si quieres revocar el acceso otorgado a la aplicación, debes hacerlo también desde la configuración de aplicaciones de Meta.
- Si Meta cambia sus versiones o requisitos, habrá que ajustar la integración.
- Aún falta **validar la autorización OAuth y la lectura de métricas con una cuenta real**. No hay garantía de funcionamiento en producción hasta completar esa prueba.

## Rutas nuevas

- `GET /api/meta/status?business_id=<uuid>`
- `GET /api/meta/connect?business_id=<uuid>`
- `GET /api/meta/callback` (retorno oficial OAuth)
- `POST /api/meta/select` (`business_id`, `account_id`)
- `GET /api/meta/report?business_id=<uuid>&period=30`
- `POST /api/meta/disconnect`

**No desplegar en la rama principal sin revisión y prueba de seguridad.**
