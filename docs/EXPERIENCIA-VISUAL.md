# Flujo profesional de diseño — Edwin CRM

Esta fase incorpora prácticas del video: una skill reutilizable compatible con Claude, refinamientos visuales no destructivos y pruebas automatizadas con Playwright.

## Incluido
- `.claude/skills/edwin-crm-ux/SKILL.md`: criterios visuales, funcionales, multiempresa y de accesibilidad.
- `public/ui-experience.css`: pulido visual aislado, estados interactivos, foco y movimiento reducido.
- `tests/ui/experience.spec.mjs`: pruebas de login escritorio/móvil e integraciones, con datos de prueba **solo interceptados por Playwright**.
- `.github/workflows/ui-experience.yml`: CI con pruebas y capturas disponibles como artefactos.

## Revisión local
```sh
npm install
npx playwright install chromium
npm run test:ui
```
Playwright inicia Cloudflare Wrangler en localhost:8787. No necesita secretos ni usuarios de producción, porque intercepta las API para comprobar el layout.

## Figma
El complemento Figma se debe conectar desde ChatGPT. Para implementar diseños hace falta un documento o pantalla concreta de Figma autorizada por el usuario. La skill por sí sola **no instala un servidor Figma MCP**, ni crea una sincronización permanente entre Figma y la web. Cuando haya diseño de referencia, cotejar tokens, espaciado, tipografía, responsive y estados con las clases existentes.

## Restricciones de publicación
No presentar los datos ficticios del test como información real. Conservar aislamiento y autenticación Supabase. Las conexiones de Google, Meta y Zernio se activan de forma independiente. Verificar el deploy real en Cloudflare, además de la aprobación de CI.
