FROM node:22-slim AS app-builder

WORKDIR /ui

RUN corepack enable

COPY app/pnpm-lock.yaml app/package.json ./

RUN pnpm install --frozen-lockfile

COPY app/ ./

RUN pnpm build

FROM python:3.13-slim

WORKDIR /srv

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY api /srv/api

WORKDIR /srv/api

RUN mkdir -p /srv/static

RUN uv sync --frozen --no-cache

COPY --from=app-builder /ui/dist /srv/api/static

COPY scripts/docker-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
