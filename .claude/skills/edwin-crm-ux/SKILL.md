---
name: edwin-crm-ux
description: Diseño y verificación de Edwin CRM para agencias y pymes latinoamericanas. Usar cuando se modifican vistas, navegación, formularios o tarjetas.
---
# Skill · Edwin CRM UX

## Meta
Diseñar un centro de operaciones de marketing y ventas para agencias de 3 a 20 clientes. Evitar el aspecto de plantilla genérica y la complejidad innecesaria.

## Antes de diseñar
1. Leer la sección de `public/app.js`, `public/style.css` y `public/index.html` que se modifica.
2. Identificar quién usa la pantalla: superadministrador, agencia o cliente final. Comprobar empresa activa y roles.
3. Definir una acción principal por bloque y estado de carga, error, sin datos y conectado.
4. No inventar métricas, ventas, logotipos, conexiones, funciones ni testimonios. Nunca mezclar datos de empresas distintas.

## Dirección visual
- Producto empresarial moderno, sobrio y accesible; conservar tokens y estilos claro/oscuro.
- Utilizar `--accent`, `--surface`, `--text`, `--muted2`, `--border`, no sustituirlos por colores incompatibles.
- Jerarquía visual: título > explicación breve > KPI/acción > detalle. Reducir ruido.
- Proporcionar espacios legibles y feedback claro para interacciones.
- Transiciones breves, útiles y desactivables mediante `prefers-reduced-motion`.
- No copiar pantallas de HubSpot, GoHighLevel o AgencyAnalytics. Priorizar facilidad de uso en español.

## Pruebas y entrega
- Verificar login y panel en 1440x900 y 390x844, sin desplazamiento horizontal.
- Comprobar teclado, indicadores de foco, contraste, botones inactivos.
- Ejecutar `npm run test:ui` y los tests funcionales pertinentes.
- Revisar capturas de Playwright, sin exponer datos reales.
- Comparar y publicar en PR. No anunciar despliegue Cloudflare sin comprobarlo.

## Figma
- La conexión a Figma requiere autorización del usuario y un archivo fuente accesible.
- Leer componentes, variantes, variables y pantallas del archivo. Registrar equivalencias con CSS existente antes de cambiar interfaz.
- No prometer sincronización Figma/Código sin una conexión probada.
- Nunca guardar tokens o secretos en GitHub.
