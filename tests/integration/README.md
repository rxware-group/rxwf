# 集成测试说明

## 自动化（CI / 本地）

```bash
pnpm install
pnpm test
pnpm exec ajv validate -s docs/schemas/workflow-definition.v1.schema.json -d fixtures/valid-workflow.json
pnpm lint:deps
```

API 包内集成测（Vitest）：

- `apps/api/src/integration/m1-core.integration.test.ts` — M1 手动执行、Webhook、凭证
- `apps/api/src/execution/*-pipeline.integration.test.ts` — 调度/子工作流管线
- `apps/api/src/routes/mcp.test.ts` — MCP AC-13
- `apps/api/src/integration/m4-plus.integration.test.ts` — Chat SSE、插件、Admin（需 `featurePlus: true`）
- `apps/api/src/integration/m5-setup.integration.test.ts` — 安装向导 AC-35
- `apps/api/src/integration/runner-v1.1-acceptance.integration.test.ts` — Runner v1.1 验收（三层策略、drain/rotate WS）
- `apps/api/src/execution/runner-agent-e2e.integration.test.ts` — 可选 spawn `rxwf-runner`（`AWF_TEST_RUNNER_AGENT=1` 或 nightly CI）

Web 包：

- `apps/web/src/features/editor/validate-connections.test.ts` — 编辑器环路校验 AC-1

## 手动（需本地启动 API）

1. 一键启动：`pnpm dev`（会先释放 8787/5173 端口并构建 identity，再启动 API + Web）
2. 浏览器打开 http://localhost:5173 ，首次访问创建管理员（邮箱+密码），之后用该账户登录
3. 重置数据：`pnpm reset:data`（需先停止 `pnpm dev`，否则会因数据库文件占用而失败）；数据文件位于仓库根目录 `data/rxwf.db`
4. Docker smoke（需 Docker Desktop）：

```bash
docker compose -f deploy/compose.lite.yaml up -d --build
curl -sf http://localhost:8787/api/ready
docker compose -f deploy/compose.lite.yaml down
```

记录结果：ready 应返回 `{"ready":true}`。

认证：Web 使用 **Session Cookie**（`credentials: 'include'`）。集成测试仍可用 `x-api-key`。

Plus 手动：

1. `pnpm --filter @rxwf/api dev`
2. Web 侧栏应出现 **Chat**；`POST /api/chat/sessions` + stream 可对话（需 Ollama 或测试注入）

Standard 压测（API 已启动）：

```bash
node scripts/load-test-standard.mjs --url http://localhost:8787 --concurrency 100
```
