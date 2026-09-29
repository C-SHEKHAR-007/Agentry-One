#!/usr/bin/env bash
# Build and (re)start Agentry against the Postgres/Redis already running on
# this machine -- see docker-compose.local.yml. Extra arguments are passed to
# `docker compose` instead (e.g. `scripts/local-up.sh logs -f api`).
set -euo pipefail
cd "$(dirname "$0")/.."

# The bundled postgres/redis services aren't used here, but the base file
# requires their passwords; satisfy it without touching .env.
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-unused-external-db}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-unused-external-redis}"

compose=(docker compose -f docker-compose.yml -f docker-compose.local.yml)
if [ "$#" -gt 0 ]; then
  exec "${compose[@]}" "$@"
fi
"${compose[@]}" up -d --build --wait --remove-orphans
echo
echo "Agentry is up:  web http://localhost:5173   api http://localhost:4000/health"
