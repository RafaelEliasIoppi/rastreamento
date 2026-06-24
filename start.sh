#!/usr/bin/env bash
#
# start.sh — sobe o Rastreamento de Veículos de Emergência localmente.
# Uso:  ./start.sh
#
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"

echo "========================================"
echo "  RASTREAMENTO DE EMERGENCIA"
echo "========================================"

# Instala dependências só se ainda não houver node_modules
if [ ! -d node_modules ]; then
  echo "==> Instalando dependencias (primeira vez)..."
  npm install
fi

# Avisa se o banco Neon não estiver configurado (app roda mesmo assim)
if [ ! -f .env ]; then
  echo "==> Aviso: .env nao encontrado. Veiculos funcionam (simulacao),"
  echo "    mas emergencias precisam de DATABASE_URL (veja .env.example)."
fi

echo "==> Subindo servidor em http://localhost:${PORT}"
echo "    (Ctrl+C para parar)"
echo "========================================"

PORT="$PORT" exec node local-server.js
