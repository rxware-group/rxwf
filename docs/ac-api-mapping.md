# 验收标准（AC）与 API 路径映射

> 机器可读源：`fixtures/ac-api-mapping.json`（由 `pnpm lint:ac-mapping` 校验）  
> OpenAPI 契约：`openapi.yaml`（含 `x-rxwf-ac-mapping` 摘要）  
> 产品 AC 全文：[`spec.md`](./spec.md) §16

## 如何查阅

| 方式 | 说明 |
|------|------|
| 本文档 | 按 AC/FR 编号列出路径、是否在 OpenAPI、实现备注 |
| `docs/openapi.yaml` | 已纳入契约的 REST 路径与 Schema |
| `fixtures/ac-api-mapping.json` | CI 校验用；`inOpenapi: true` 的路径必须在 OpenAPI 中存在 |
| 运行校验 | `pnpm lint:ac-mapping` |

## 映射表（v1.0 补全后）

| ID | 摘要 | API 路径 | OpenAPI |
|----|------|----------|---------|
| AC-1 | 工作流 CRUD / 校验 | `GET/POST /workflows`，`GET/PUT/DELETE /workflows/{workflowId}`，`POST …/validate` | ✅ |
| AC-2 | 版本与回滚 | `GET /workflows/{workflowId}/versions`，`POST …/versions/{versionId}/rollback` | ✅ |
| AC-3 | 执行触发与列表 | `POST /workflows/{workflowId}/executions`，`GET /executions` | ✅ |
| AC-6 | 环境变量 | `GET/PUT /env`，`DELETE /env/{id}` | ✅ |
| AC-7 | 导入导出 | `POST /workflows/import`，`GET /workflows/{workflowId}/export` | ✅ |
| AC-10 | 调试单节点 | `POST /workflows/debug-node` | ✅ |
| AC-13 | MCP Server tools | `GET /mcp/tools`，`POST /mcp/tools/call`（根路径 `/mcp`） | ✅ |
| AC-16 | 工作流 RAG | — | v1.1 未实现 |
| AC-18 | AI Chat | `GET/POST /chat/sessions`，`GET …/messages`，`POST …/stream` | ✅ |
| AC-19 | AI Chat RAG | `POST …/stream`（`mode: rag`），`/knowledge-bases` | ✅ |
| AC-41 | Chat Bot 三渠道 | `/chat-bots/*`，`/public/chat/*`，MCP `chat_bot_run` | ✅ |
| AC-24 | MCP Client 注册 | `/mcp-servers` CRUD + test/tools | ✅ |
| AC-26–27 | 插件 | `/plugins`，register/enable/disable | ✅ |
| AC-31 | i18n | `/i18n/*` | ✅ |
| AC-32–34 | 偏好与主题 | `/users/me/preferences`，`/themes/*` | ✅ |
| AC-35 | Lite 安装 | `/health`，`/ready`，`/setup/checklist`，`/auth/*`，`/system/features` | ✅ |
| AC-36 | Standard 就绪 | `GET /ready`（含 PG/Redis/BullMQ） | ✅ |
| AC-37–38 | Webhook | `POST /webhook/{workflowId}/{webhookPath}` | ✅ |
| AC-39 | 首启 checklist | `GET /setup/checklist` | ✅ |
| AC-40 | Admin i18n/theme | `/admin/i18n/{locale}`，`/admin/themes/{theme}` | ✅ |
| AC-42 | 执行快照 | `GET /executions/{executionId}` + node-runs/io | ✅ |
| AC-43 | Runner 列表 | `GET /runners` | ✅ |
| FR-7 | 模板 | `GET /templates`，`POST /templates/{templateId}/clone` | ✅ |
| FR-10 | 凭证 | `/credentials` CRUD + test | ✅ |
| FR-16 | MCP Token | `/mcp-tokens` CRUD | ✅ |

## OpenAPI 与实现差异（已知）

| 项 | 说明 |
|----|------|
| AC-2 回滚 | 实现为 `POST /workflows/{workflowId}/rollback` + body `{ version }`（已对齐 OpenAPI；旧草案 `…/versions/{versionId}/rollback` 已移除） |
| Admin 列表 | `GET/POST /admin/i18n/locales`、`POST /admin/themes` 标为 `x-rxwf-status: planned`；当前实现为 `PUT /admin/i18n/{locale}`、`PUT /admin/themes/{theme}` |
| Auth | 另含 `POST /auth/login`、`POST /auth/logout`（见 OpenAPI Auth 标签） |

## 与 `x-rxwf-ac-mapping` 的关系

`openapi.yaml` 末尾 `x-rxwf-ac-mapping` 为**快速索引**；完整表以本文档与 `fixtures/ac-api-mapping.json` 为准。修改映射时请同步三处。
