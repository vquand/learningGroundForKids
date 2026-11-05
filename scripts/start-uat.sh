#!/usr/bin/env bash
# One local-only entry point for starting and checking the UAT stack.
set -euo pipefail

if (($#)); then
  echo "Usage: scripts/start-uat.sh (frontend 5173, API 10000)" >&2
  exit 2
fi

PLG_UAT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PLG_UAT_ROOT"
# UAT always uses the documented ports, regardless of previous demo settings.
export PLG_DEV_FRONTEND_PORT=5173 PLG_DEV_API_PORT=10000
PLG_UAT_URL=http://localhost:5173
PLG_UAT_COMPOSE=(docker compose -f compose.dev.yml)
enable_host_network() {
  export PLG_DEV_NETWORK=host
  PLG_UAT_COMPOSE=(docker compose -f compose.dev.yml -f compose.dev.host.yml)
}
# Reuse the same mode on subsequent launches; never move or replace pgdata.
if command -v docker >/dev/null && [[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' plg-dev-postgres-1 2>/dev/null)" == host ]]; then
  enable_host_network
fi
PLG_UAT_CURL=(--noproxy '*' --connect-timeout 2 --max-time 5)

command -v curl >/dev/null || { echo "curl is required for readiness checks." >&2; exit 1; }

garden_api_ready() {
  local ready
  ready="$(curl "${PLG_UAT_CURL[@]}" -fsS -D - "$1/api/v1/health/ready" 2>/dev/null)" || return 1
  [[ "${ready##*$'\n'}" == '{"status":"ready"}' && "$ready" == *'x-plg-dev-gardening: ready'* ]]
}

stack_ready() {
  local page ready module
  page="$(curl "${PLG_UAT_CURL[@]}" -fsS "$PLG_UAT_URL/" 2>/dev/null)" || return 1
  [[ "$page" == *'id="root"'* && "$page" == *'/src/main.tsx'* ]] || return 1
  garden_api_ready "$PLG_UAT_URL" || return 1
  garden_api_ready http://localhost:10000 || return 1
  # Serving index.html alone does not prove Vite can load lazy routes or their
  # shared server-side source imports, especially inside the frontend image.
  for module in \
    /src/main.tsx /src/App.tsx /src/pages/ActivityHubPage.tsx \
    /src/features/town-building/TownScene.tsx \
    /src/features/infinidrill/game.ts /src/features/infinidrill/questions.ts \
    /src/features/infinidrill/upgrades.ts /src/features/infinidrill/world.ts \
    /src/features/food-and-drink/foodAndDrinkConfig.ts \
    /src/features/food-and-drink/foodAndDrinkGame.ts \
    /src/features/animal-racing/RacingPage.tsx \
    /src/features/animal-racing/RacingScene.tsx; do
    curl "${PLG_UAT_CURL[@]}" -fsS "$PLG_UAT_URL$module" >/dev/null 2>&1 || return 1
  done
}

compose_config_changed() {
  local service="$1" expected actual
  expected="$("${PLG_UAT_COMPOSE[@]}" config --hash "$service" 2>/dev/null)" || return 1
  expected="${expected#"$service "}"
  actual="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.config-hash"}}' "plg-dev-$service-1" 2>/dev/null)" || return 1
  [[ -n "$expected" && -n "$actual" && "$expected" != "$actual" ]]
}

stop_checkout_listener() {
  local port="$1" pid cwd command_line parent parent_command
  local -a pids=()
  if command -v lsof >/dev/null; then
    mapfile -t pids < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null; then
    read -r -a pids <<< "$(fuser -n tcp "$port" 2>/dev/null || true)" || true
  else
    return 0 # Compose will report any port conflict without terminating it.
  fi
  for pid in "${pids[@]}"; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)" || continue
    command_line="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)" || continue
    if [[ "$port" == 10000 && "$cwd" == "$PLG_UAT_ROOT/server" && "$command_line" == *node* && "$command_line" == *src/index.ts* ]]; then
      # Stop the watch supervisor as well so a later source edit cannot reclaim
      # the Docker API port. Validate its cwd and command before signalling it.
      parent="$(awk '/^PPid:/ {print $2}' "/proc/$pid/status")"
      parent_command="$(tr '\0' ' ' < "/proc/$parent/cmdline" 2>/dev/null)" || parent_command=""
      if [[ "$(readlink "/proc/$parent/cwd" 2>/dev/null)" == "$PLG_UAT_ROOT/server" && "$parent_command" == *node* && "$parent_command" == *--watch* && "$parent_command" == *src/index.ts* ]]; then
        kill -TERM "$parent" 2>/dev/null || true
      fi
    elif [[ "$port" == 5173 && "$cwd" == "$PLG_UAT_ROOT/frontend" && "$command_line" == *node* && "$command_line" == *node_modules/*vite* ]]; then
      :
    else
      continue
    fi
    echo "Stopping this checkout's native development listener on port $port (PID $pid)."
    kill -TERM "$pid" 2>/dev/null || true
  done
}

# A healthy API with an empty account database is not continuity for existing
# UAT users. Adopt native records first if this Compose database is running.
if command -v docker >/dev/null && [[ "$("${PLG_UAT_COMPOSE[@]}" ps --status running --services 2>/dev/null)" == *postgres* ]]; then
  scripts/import-native-dev-db.sh
fi
# Branch changes can leave a running API serving an older route table even
# while its health check and the bind-mounted frontend are healthy. Refresh
# only that service, preserving the database and the running frontend.
if command -v docker >/dev/null && [[ "$("${PLG_UAT_COMPOSE[@]}" ps --status running --services 2>/dev/null)" == *api* ]] && { ! garden_api_ready http://localhost:10000 || compose_config_changed api; }; then
  echo "Refreshing the local API to load current routes and runtime configuration..."
  "${PLG_UAT_COMPOSE[@]}" up --build --no-deps -d --wait --wait-timeout 120 api
fi
# A worktree changes bind-mount paths even when the existing page is healthy.
# Refresh that frontend too, so UAT cannot silently show the previous checkout.
if command -v docker >/dev/null && [[ "$("${PLG_UAT_COMPOSE[@]}" ps --status running --services 2>/dev/null)" == *frontend* ]] && compose_config_changed frontend; then
  echo "Refreshing the local frontend to serve this checkout..."
  "${PLG_UAT_COMPOSE[@]}" up --build --no-deps -d --wait --wait-timeout 120 frontend
fi
# Bind-mounted routes update while the one-shot init container stays completed.
# Apply pending schema changes on warm launches too, before reusing health checks.
# This is the same local-only guard/migrator as cold startup; never seed/reset here.
if command -v docker >/dev/null && [[ "$("${PLG_UAT_COMPOSE[@]}" ps --status running --services 2>/dev/null)" == *api* ]]; then
  echo "Applying pending local database migrations..."
  "${PLG_UAT_COMPOSE[@]}" exec -T api node --import /app/docker/dev/local-db-guard.mjs ./node_modules/drizzle-kit/bin.cjs migrate --config drizzle.config.ts
fi
if stack_ready; then
  echo "Reusing the healthy local stack on ports 5173 and 10000."
else
  command -v docker >/dev/null || { echo "Docker is required to start the local stack." >&2; exit 1; }
  docker compose version >/dev/null
  stop_checkout_listener 5173
  stop_checkout_listener 10000
  PLG_UAT_START_LOG="$(mktemp /tmp/plg-uat-start.XXXXXX)"
  trap 'rm -f -- "$PLG_UAT_START_LOG"' EXIT
  if ! "${PLG_UAT_COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres >"$PLG_UAT_START_LOG" 2>&1; then
    cat "$PLG_UAT_START_LOG" >&2
    if [[ "${PLG_DEV_NETWORK:-}" != host ]] && grep -Eq 'failed to (add.*veth|create.*endpoint).*operation not (supported|permitted)' "$PLG_UAT_START_LOG"; then
      echo "Docker bridge interfaces are unavailable; using loopback-only host networking."
      enable_host_network
      "${PLG_UAT_COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres || { echo "Local PostgreSQL failed to start." >&2; exit 1; }
    else
      echo "Local PostgreSQL failed to start." >&2
      exit 1
    fi
  else
    cat "$PLG_UAT_START_LOG"
  fi
  scripts/import-native-dev-db.sh
  echo "Starting local PostgreSQL, migrations, catalog, API, and frontend..."
  # Recreate containers on a cold start to recover failed Docker networking and
  # stale runtime configuration. Named database volumes are retained.
  if ! "${PLG_UAT_COMPOSE[@]}" up --build --force-recreate -d --wait --wait-timeout 120; then
    "${PLG_UAT_COMPOSE[@]}" logs --tail=30 init api frontend >&2 || true
    echo "Startup failed. Check Docker and port conflicts on 5173/10000; unrelated listeners were not terminated." >&2
    exit 1
  fi
  if ! stack_ready; then
    "${PLG_UAT_COMPOSE[@]}" logs --tail=30 api frontend >&2 || true
    echo "The frontend, proxy, or database readiness check failed." >&2
    exit 1
  fi
fi

# A malformed POST verifies origin/host acceptance without signing in or
# changing an account. The API must reach input validation, not reject origin.
PLG_UAT_PROBE="$(curl "${PLG_UAT_CURL[@]}" -sS -w $'\n%{http_code}' \
  -H "Origin: $PLG_UAT_URL" -H 'Content-Type: application/json' \
  --data '{}' "$PLG_UAT_URL/api/v1/auth/login")"
if [[ "${PLG_UAT_PROBE##*$'\n'}" != 422 || "$PLG_UAT_PROBE" != *'VALIDATION_ERROR'* ]]; then
  echo "Login route check failed (HTTP ${PLG_UAT_PROBE##*$'\n'}); inspect local API logs." >&2
  exit 1
fi

echo "UAT ready: $PLG_UAT_URL"
echo "No-login map review: $PLG_UAT_URL/uat/map"
