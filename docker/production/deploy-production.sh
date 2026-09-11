#!/usr/bin/env bash
# btbz-SharpTalk — production deploy. Amoeba Structure v2 §5.1 (deploy scripts mandatory).
set -euo pipefail

# Resolve repo root from this script's location (docker/production/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker/production/docker-compose.production.yml"
ENV_FILE="docker/production/.env.production"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy docker/production/.env.production.example and fill it in." >&2
  exit 1
fi

# Optional: pull latest source before deploying.
# git pull --ff-only

echo "==> Building and starting production stack..."
# UPLOAD_DIR must match the uploads volume mount (FIX-260911) — otherwise files
# land in container storage and vanish at the next deploy, without any error.
upload_dir="$(grep -E '^UPLOAD_DIR=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
if [[ "$upload_dir" != "/data/uploads" ]]; then
  echo "ERROR: UPLOAD_DIR is '${upload_dir:-unset}', but the compose file mounts the" >&2
  echo "       uploads volume at /data/uploads. Set UPLOAD_DIR=/data/uploads in $ENV_FILE." >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> Status:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
