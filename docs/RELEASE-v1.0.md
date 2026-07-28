# RX-Workflow v1.0.0 Release Notes

**Date:** 2026-05-22

## Highlights

- **v1.0-core (GA):** Lite SQLite single-container, port **8787**, P0 DAG executors, MCP Server (8 tools), Web console, CI + Docker Lite compose.
- **v1.0-plus:** Default in Docker Lite image (`RXWF_FEATURE_PLUS=true`) — AI Chat (SSE), MCP Client pool, plugin host, Admin i18n/theme overrides, P1 executors, MCP server registry UI.
- **Standard profile:** `RXWF_DEPLOY_PROFILE=standard` uses PostgreSQL for workflows/executions/env, BullMQ for job queue, and `/api/ready` checks Postgres + Redis + queue probe. Migrate Lite data with `pnpm rxwf:migrate`.

## Verification

```bash
pnpm install
pnpm test
pnpm lint:deps   # note: expression package may report pre-existing cycle
pnpm exec ajv validate -s docs/schemas/workflow-definition.v1.schema.json -d fixtures/valid-workflow.json
```

## Run locally

```bash
# API (8787) + Web (5173)
pnpm dev
```

Web 首次打开会引导创建管理员账户（邮箱+密码），之后通过登录使用；Session Cookie 自动维持会话。

Plus features (also default in Docker Lite):

```bash
pnpm dev
```

## Docker

```bash
docker compose -f deploy/compose.lite.yaml up -d --build
curl -sf http://localhost:8787/api/ready

# Standard (Postgres + Redis + API)
docker compose -f deploy/compose.standard.yaml up -d --build
curl -sf http://localhost:8787/api/ready   # includes postgres, redis, queue
```

## Lite → PostgreSQL migration

```bash
pnpm rxwf:migrate
pnpm rxwf:migrate --dry-run
```

## Load test (Standard health endpoint)

```bash
node scripts/load-test-standard.mjs --url http://localhost:8787 --concurrency 100
```

## Known limitations

- Ollama integration calls `/api/generate` directly (no LangChain bundle in core build).
- MCP HTTP transport for external MCP servers uses stub launcher in dev; stdio `npx` is fully supported.
- P4 (Chat RAG, Agent canvas, knowledge base) is out of scope for v1.0.
