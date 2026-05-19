#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] waiting for Postgres to accept connections..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until pg_isready -h db -p 5432 -U roger >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "[entrypoint] Postgres did not become ready in time, exiting" >&2
    exit 1
  fi
  sleep 1
done
echo "[entrypoint] Postgres is ready."

echo "[entrypoint] running seed (idempotent)..."
python seed.py || {
  echo "[entrypoint] seed failed (non-fatal during dev), continuing..." >&2
}

echo "[entrypoint] starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
