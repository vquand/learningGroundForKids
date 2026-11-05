#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
PORT="${PORT:-3001}"
HOST="${HOST:-0.0.0.0}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to start the frontend." >&2
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "Error: PORT must be a TCP port between 1 and 65535." >&2
  exit 1
fi

list_listeners() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
    return
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$PORT" 2>/dev/null | awk '{ for (i = 1; i <= NF; i++) if ($i ~ /^[0-9]+$/) print $i }' || true
    return
  fi

  echo "Error: install lsof or fuser to safely restart port $PORT." >&2
  exit 1
}

mapfile -t listener_pids < <(list_listeners | sort -u)

if ((${#listener_pids[@]} > 0)); then
  echo "Stopping existing listener(s) on port $PORT: ${listener_pids[*]}"
  for pid in "${listener_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  for _ in {1..20}; do
    remaining=()
    mapfile -t remaining < <(list_listeners | sort -u)
    ((${#remaining[@]} == 0)) && break
    sleep 0.1
  done

  mapfile -t remaining < <(list_listeners | sort -u)
  if ((${#remaining[@]} > 0)); then
    echo "Listeners did not stop cleanly; terminating: ${remaining[*]}"
    for pid in "${remaining[@]}"; do
      kill -KILL "$pid" 2>/dev/null || true
    done
  fi
fi

if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
  echo "Error: frontend package.json not found at $FRONTEND_DIR." >&2
  exit 1
fi

cd "$FRONTEND_DIR"
echo "Starting Vite on http://localhost:$PORT"
exec npm run dev -- --host "$HOST" --port "$PORT"
