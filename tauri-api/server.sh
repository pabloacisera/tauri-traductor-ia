#!/usr/bin/env bash
# server.sh — Script para levantar el backend de ContextIA
# Uso: ./server.sh [puerto]
set -e

PORT="${1:-8000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "🚀 Iniciando ContextIA backend en puerto $PORT..."
exec uvicorn main:app --host 0.0.0.0 --port "$PORT" --reload
