#!/usr/bin/env bash
#
# start.sh — sobe o rastreamento da Brigada Militar (PM/RS) localmente.
# Uso:  ./start.sh
#
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-3000}"

echo "========================================"
echo "  RASTREAMENTO PM — BRIGADA MILITAR/RS"
echo "  Porto Alegre"
echo "========================================"

# Encerra qualquer servidor antigo (evita servir codigo em cache / porta presa)
if pgrep -f "node local-server.js" >/dev/null 2>&1; then
  echo "==> Encerrando servidor anterior..."
  pkill -9 -f "node local-server.js" || true
  sleep 1
fi

# Instala dependencias so se ainda nao houver node_modules
if [ ! -d node_modules ]; then
  echo "==> Instalando dependencias (primeira vez)..."
  npm install
fi

# Avisa se o banco Neon nao estiver configurado (app roda em modo simulacao)
if [ ! -f .env ]; then
  echo "==> Aviso: .env nao encontrado. Rodando em MODO SIMULACAO."
  echo "    Viaturas e botao de emergencia funcionam; historico nao persiste."
  echo "    Para persistir, configure DATABASE_URL e TOMTOM_KEY (veja .env.example)."
fi

echo "==> Subindo servidor em http://localhost:${PORT}"
echo "    (Ctrl+C para parar)"
echo "========================================"

PORT="$PORT" exec node local-server.js
