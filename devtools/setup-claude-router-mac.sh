#!/usr/bin/env bash
# Configuracion LOCAL de Claude Code Router para Edwin CRM.
# No modifica Cloudflare, Supabase, GitHub Actions ni produccion.
set -euo pipefail

echo "== Edwin CRM | Claude Code Router (local) =="

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Este asistente esta preparado para macOS. Consulta la guia docs/CLAUDE-CODE-ROUTER.md para otros sistemas."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Faltan Node.js y/o npm. Instala una version de Node.js compatible antes de continuar."
  echo "Requisito del Router CLI: Node.js 22 o superior. https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 22 )); then
  echo "Node.js actual: $(node -v). Router CLI requiere Node.js >=22."
  echo "Actualiza Node.js y vuelve a ejecutar este script."
  exit 1
fi

echo "Node.js: $(node -v) | npm: $(npm -v)"
if ! command -v claude >/dev/null 2>&1; then
  echo "AVISO: Claude Code no aparece en PATH. El Router puede instalarse, pero necesitas un agente compatible."
fi

echo "Instalando Claude Code Router CLI desde el paquete oficial..."
npm install -g @musistudio/claude-code-router

echo
echo "Router instalado. Abriremos su interfaz local."
echo "1. En Providers, agrega tus proveedores y sus claves SOLO localmente."
echo "2. En API Keys, crea la clave de cliente local."
echo "3. En Server, inicia el gateway (por defecto 127.0.0.1:3456)."
echo "4. En Agent Config, configura Claude Code."
echo "5. En Routing, configura respaldo y limites; verifica Logs."
echo "No compartas claves en el repositorio ni uses modelos gratuitos sin comprobar sus cuotas y politica de datos."
echo
exec ccr ui
