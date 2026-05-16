#!/bin/sh
set -e

uv run alembic upgrade head
exec /srv/api/.venv/bin/fastapi run --port "${API_PORT:-8000}" --host "${API_HOST:-0.0.0.0}"
