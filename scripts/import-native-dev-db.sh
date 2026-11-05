#!/usr/bin/env bash
# Adopt this machine's original local UAT data into an empty Compose database.
# Both ends use PostgreSQL Unix sockets in fixed local containers, never URLs.
set -euo pipefail
if (($#)); then echo "Usage: scripts/import-native-dev-db.sh" >&2; exit 2; fi
PLG_IMPORT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PLG_IMPORT_ROOT"
PLG_IMPORT_COMPOSE=(docker compose -f compose.dev.yml)
if [[ "${PLG_DEV_NETWORK:-}" == host ]]; then
  PLG_IMPORT_COMPOSE+=(-f compose.dev.host.yml)
fi
PLG_IMPORT_PSQL=(psql --host=/var/run/postgresql --username=plg_dev --dbname=plg_dev -Atc)
PLG_IMPORT_COUNTS='SELECT (SELECT count(*) FROM families)::text || '\'', '\'' || (SELECT count(*) FROM passkeys)::text || '\'', '\'' || (SELECT count(*) FROM profiles)::text || '\'', '\'' || (SELECT count(*) FROM town_state)::text;'

if ! docker inspect --format '{{.State.Running}}' plg-dev-postgres >/dev/null 2>&1; then
  echo "No original local database to import."
  exit 0
fi
PLG_IMPORT_SCHEMA="$("${PLG_IMPORT_COMPOSE[@]}" exec -T postgres "${PLG_IMPORT_PSQL[@]}" "SELECT to_regclass('public.families');")"
if [[ -n "$PLG_IMPORT_SCHEMA" ]]; then
  PLG_IMPORT_TARGET_COUNTS="$("${PLG_IMPORT_COMPOSE[@]}" exec -T postgres "${PLG_IMPORT_PSQL[@]}" "$PLG_IMPORT_COUNTS")"
  if [[ "$PLG_IMPORT_TARGET_COUNTS" != '0, 0, 0, 0' ]]; then
    echo "Keeping the Compose database's existing accounts and progress; no import performed."
    exit 0
  fi
else
  PLG_IMPORT_TABLES="$("${PLG_IMPORT_COMPOSE[@]}" exec -T postgres "${PLG_IMPORT_PSQL[@]}" "SELECT count(*) FROM pg_tables WHERE schemaname='public';")"
  if [[ "$PLG_IMPORT_TABLES" != 0 ]]; then
    echo "Unrecognized local schema; refusing to replace the Compose database." >&2
    exit 1
  fi
fi

if [[ "$(docker inspect --format '{{.State.Running}}' plg-dev-postgres)" != true ]]; then
  echo "Original local database is stopped; start plg-dev-postgres before importing its accounts." >&2
  exit 1
fi

PLG_IMPORT_SOURCE_COUNTS="$(docker exec plg-dev-postgres "${PLG_IMPORT_PSQL[@]}" "$PLG_IMPORT_COUNTS")"
if [[ "$PLG_IMPORT_SOURCE_COUNTS" == '0, 0, 0, 0' ]]; then
  echo "The original local database has no accounts or progress to import."
  exit 0
fi

umask 077
PLG_IMPORT_TMP="$(mktemp -d /tmp/plg-local-db-import.XXXXXX)"
trap 'rm -rf -- "$PLG_IMPORT_TMP"' EXIT
# Take a consistent snapshot before stopping the API. Never print its contents.
docker exec plg-dev-postgres pg_dump --host=/var/run/postgresql --username=plg_dev --dbname=plg_dev --format=custom --no-owner --no-acl > "$PLG_IMPORT_TMP/native.dump"
"${PLG_IMPORT_COMPOSE[@]}" stop api
echo "Importing existing local accounts, passkeys, profiles and progress into the empty Compose database..."
# A failed restore rolls back all DDL/data; the original local database is untouched.
"${PLG_IMPORT_COMPOSE[@]}" exec -T postgres pg_restore --host=/var/run/postgresql --username=plg_dev --dbname=plg_dev --single-transaction --exit-on-error --clean --if-exists --no-owner --no-acl < "$PLG_IMPORT_TMP/native.dump"
PLG_IMPORT_RESTORED_COUNTS="$("${PLG_IMPORT_COMPOSE[@]}" exec -T postgres "${PLG_IMPORT_PSQL[@]}" "$PLG_IMPORT_COUNTS")"
if [[ "$PLG_IMPORT_RESTORED_COUNTS" != "$PLG_IMPORT_SOURCE_COUNTS" ]]; then
  echo "Local import verification failed; do not claim UAT is ready." >&2
  exit 1
fi
echo "Existing local accounts, passkeys and progress imported successfully."
echo "Run scripts/start-uat.sh to restart the API and frontend."
