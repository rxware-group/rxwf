# n8n 体验优先补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 v1.0-core/plus 后端基础上，按 [设计规格](../specs/2026-05-22-n8n-first-completion-design.md) 交付 **P1～P3**（对标 n8n 的 Web 编排/运维/部署 + Standard 真切换 + Plus 工作流集成）；**P4 AI/Agent 不在本计划内**。

**Architecture:** P1 以「薄 API + React 壳层」补齐缺口（`packages/env`、全局执行列表、版本/模板 API、AppShell）；运行期 `$env` 由 execution 组装注入 expression/node-runner。P2 实现 `providers/standard` 的 Drizzle PG + BullMQ，经 `RXWF_DEPLOY_PROFILE` 在 bootstrap 切换。P3 在 `featurePlus` 下暴露 MCP/插件 Admin UI 与 P1 节点面板。

**Tech Stack:** Node.js ≥20、TypeScript、Fastify 5、Drizzle、Vitest、React 19、Vite、react-router-dom v7、`@xyflow/react`、pnpm workspace。

**设计依据:** [2026-05-22-n8n-first-completion-design.md](../specs/2026-05-22-n8n-first-completion-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览（将创建/修改）

| 路径 | 职责 |
|------|------|
| `packages/env/` | 环境变量 CRUD + `resolveEnv(scope, environment)` |
| `packages/providers/lite/src/env-repository.ts` | SQLite `env_vars` |
| `packages/providers/lite/src/drizzle/schema.ts` | 新增 `env_vars` 表 |
| `packages/providers/lite/src/execution-repository.ts` | `listAll` 分页 |
| `packages/workflow/src/workflow-service.ts` | `listVersions` / `rollback` |
| `packages/providers/lite/src/workflow-repository.ts` | 版本列表查询 |
| `apps/api/src/routes/env.ts` | `/api/env` |
| `apps/api/src/routes/executions.ts` | `GET /api/executions` |
| `apps/api/src/routes/workflows.ts` | versions / rollback / templates |
| `apps/api/src/routes/webhook.ts` | `X-AWF-Test` 分支 |
| `apps/api/src/execution/create-execution-runtime.ts` | 注入 resolved env |
| `apps/web/src/layout/AppShell.tsx` | 侧栏 + 顶栏 i18n/theme（~~席位~~ 已移除） |
| `apps/web/src/features/env/EnvPage.tsx` | 环境变量管理 |
| `apps/web/src/features/executions/ExecutionListPage.tsx` | 全局执行列表 |
| `apps/web/src/features/credentials/CredentialsPage.tsx` | 凭证 CRUD |
| `apps/web/src/features/settings/SettingsLayout.tsx` | 设置子路由 |
| `apps/web/src/features/templates/TemplateGalleryPage.tsx` | 内置模板 |
| `apps/web/src/components/ConfirmDialog.tsx` | 危险操作 |
| `apps/web/src/components/Toast.tsx` | API 错误展示 |
| `fixtures/templates/*.json` | ≥3 内置模板 |
| `packages/providers/standard/src/storage/` | PG Drizzle repos（P2） |
| `packages/providers/standard/src/queue/bullmq-provider.ts` | BullMQ（P2） |
| `scripts/rxwf-migrate.mjs` | Lite→PG 迁移（P2） |
| `apps/web/src/features/mcp/McpServersPage.tsx` | MCP 注册（P3） |
| `apps/web/src/features/plugins/PluginsPage.tsx` | 插件管理（P3） |

---

## Phase P1：编排与运维体验（对标 n8n）

### Task 1: `packages/env` 与 SQLite 表 ✅

**Files:**
- Create: `packages/env/package.json`, `packages/env/tsconfig.json`, `packages/env/vitest.config.ts`
- Create: `packages/env/src/types.ts`, `packages/env/src/resolve.ts`, `packages/env/src/index.ts`
- Create: `packages/env/src/resolve.test.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Create: `packages/providers/lite/src/env-repository.ts`
- Modify: `packages/providers/lite/src/index.ts`
- Modify: `pnpm-workspace.yaml`（若需显式列出）

- [x] **Step 1: 写失败测试 — 解析优先级**

```typescript
// packages/env/src/resolve.test.ts
import { describe, expect, it } from 'vitest';
import { resolveEnvLayers } from './resolve.js';

describe('resolveEnvLayers', () => {
  it('workflow overrides user and global (AC-6)', () => {
    const map = resolveEnvLayers({
      global: { FOO: 'g' },
      user: { FOO: 'u' },
      workflow: { FOO: 'w' },
    });
    expect(map.FOO).toBe('w');
  });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/env test`  
Expected: FAIL — `resolveEnvLayers` not found

- [x] **Step 3: 实现 resolve + 类型**

```typescript
// packages/env/src/resolve.ts
export type EnvScope = 'global' | 'user' | 'workflow';
export type EnvEnvironment = 'dev' | 'staging' | 'prod';

export function resolveEnvLayers(layers: {
  global: Record<string, string>;
  user: Record<string, string>;
  workflow: Record<string, string>;
}): Record<string, string> {
  return { ...layers.global, ...layers.user, ...layers.workflow };
}
```

- [x] **Step 4: schema 增加 env_vars**

```typescript
// packages/providers/lite/src/drizzle/schema.ts（追加）
export const envVars = sqliteTable('env_vars', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull(),
  scopeId: text('scope_id'),
  environment: text('environment').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  sensitive: integer('sensitive', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

在 `apply-schema.ts` 的 SQL 中追加 `CREATE TABLE IF NOT EXISTS env_vars (...)`。

- [x] **Step 5: env-repository + 测试 GREEN**

Run: `pnpm --filter @rxwf/env test && pnpm --filter @rxwf/providers-lite test`  
Expected: PASS

- [x] **Step 6: Commit**（待用户要求时统一提交）

---

### Task 2: `/api/env` 路由 ✅

**Files:**
- Create: `apps/api/src/routes/env.ts`
- Create: `apps/api/src/routes/env.test.ts`
- Modify: `apps/api/src/bootstrap.ts`

- [x] **Step 1: 集成测试 RED — GET 空列表**

```typescript
// apps/api/src/routes/env.test.ts（节选）
it('GET /api/env returns items for global dev', async () => {
  const { app } = await buildTestApp();
  const token = await loginAsAdmin(app);
  const res = await app.inject({
    method: 'GET',
    url: '/api/env?scope=global&environment=dev',
    headers: { cookie: token },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({ items: [] });
});
```

- [x] **Step 2: 实现 GET / PUT / DELETE**

`PUT /api/env` body: `{ items: [{ scope, scopeId?, environment, key, value, sensitive? }] }` — upsert by `(scope, scopeId, environment, key)`.

- [x] **Step 3: registerEnvRoutes in bootstrap**

- [x] **Step 4: GREEN + commit**

```bash
git commit -m "feat(api): add /api/env CRUD routes"
```

---

### Task 3: 运行期注入 `$env` ✅

**Files:**
- Modify: `packages/execution/src/enqueue/execution-enqueue-service.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `packages/node-runner/src/types/node-executor.ts`（若需 `env` 字段）
- Create: `packages/execution/src/env/load-execution-env.test.ts`
- Modify: `packages/expression/src/evaluate.test.ts`

- [x] **Step 1: 测试 — manual 执行带 environment=dev 时表达式可读 $env**

- [x] **Step 2: 实现 `loadExecutionEnv(db, { workflowId, userId, environment })` 在 create-execution-runtime 传入 node-runner context**

- [x] **Step 3: `POST .../executions` body 增加 `environment?: 'dev'|'staging'|'prod'`（默认 dev for manual）**

- [ ] **Step 4: commit**

```bash
git commit -m "feat(execution): inject resolved env into node-runner and expressions"
```

---

### Task 4: 全局执行列表 API ✅

**Files:**
- Modify: `packages/providers/lite/src/execution-repository.ts`
- Modify: `apps/api/src/routes/executions.ts`
- Create: `apps/api/src/routes/executions-list.test.ts`

- [x] **Step 1: `listAll({ limit, offset, status?, workflowId? })` 返回 items + total，join workflow name（二次查询即可）**

- [x] **Step 2: `GET /api/executions` 注册；limit 默认 50，max 200**

- [ ] **Step 3: 集成测试 + commit**

```bash
git commit -m "feat(api): add GET /api/executions global list"
```

---

### Task 5: 工作流版本列表与回滚 ✅

**Files:**
- Modify: `packages/workflow/src/workflow-service.ts`
- Modify: `packages/providers/lite/src/workflow-repository.ts`（或 lite workflow repo 文件）
- Modify: `apps/api/src/routes/workflows.ts`
- Modify: `packages/workflow/src/workflow-service.test.ts`

- [x] **Step 1: 测试 RED — listVersions 返回降序版本号**

- [x] **Step 2: `listVersions(workflowId)` + `rollback(workflowId, targetVersion)`（rollback = 读取旧 definition 再 `update` 产生新版本，AC-42）**

- [x] **Step 3: 路由**

```
GET  /api/workflows/:id/versions
POST /api/workflows/:id/rollback  { "version": 2 }
```

- [ ] **Step 4: GREEN + commit**

---

### Task 6: 内置模板 API ✅

**Files:**
- Create: `fixtures/templates/webhook-http-json.json`
- Create: `fixtures/templates/schedule-health.json`
- Create: `fixtures/templates/manual-set-if.json`
- Create: `apps/api/src/templates/catalog.ts`
- Modify: `apps/api/src/routes/workflows.ts`

- [x] **Step 1: `GET /api/templates` 返回 `[{ id, name, description }]`**

- [x] **Step 2: `POST /api/templates/:id/clone` 创建新工作流草稿并返回 `{ id }`**

- [ ] **Step 3: 集成测 + commit**

---

### Task 7: Webhook `X-AWF-Test` 与 Secret 存定义 ✅

**Files:**
- Modify: `apps/api/src/routes/webhook.ts`
- Modify: `packages/execution/src/trigger/trigger-ingress.ts`（或 webhook route 层）
- Modify: `apps/api/src/routes/webhook.test.ts`

- [x] **Step 1: 当 Header `X-AWF-Test: true` 时：允许 Inactive 工作流响应；仍校验 HMAC（若已配置 secret）**

- [x] **Step 2: 从 workflow definition 的 `webhookTrigger` 节点读取 `parameters.path` 与 `parameters.hmacSecret`（无则 401 E2005）**

- [ ] **Step 3: 测试 + commit**

```bash
git commit -m "feat(webhook): X-AWF-Test mode and definition-bound hmac secret"
```

---

### Task 8: AppShell 与路由 ✅

**Files:**
- Create: `apps/web/src/layout/AppShell.tsx`
- Create: `apps/web/src/layout/TopBar.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/features/executions/ExecutionListPage.tsx`
- Create: `apps/web/src/features/env/EnvPage.tsx`
- Create: `apps/web/src/features/users/UsersPage.tsx`
- Create: `apps/web/src/features/settings/SettingsLayout.tsx`
- Create: `apps/web/src/features/settings/SettingsIndexPage.tsx`
- Modify: `apps/web/src/api/client.ts`

- [x] **Step 1: AppShell 侧栏链接：工作流、环境变量、执行、用户、系统设置**

- [x] **Step 2: P4 灰显项：Chat、知识库（`disabled` + title「即将推出」）**

- [x] **Step 3: Routes 挂到 AppShell children**

- [x] **Step 4: `api.executions.list()` / `api.env.*` client 方法**

- [ ] **Step 5: 手动冒烟 `pnpm dev` 导航可点 + commit**

---

### Task 9: 顶栏 i18n / 主题 / 执行环境 ✅

**Files:**
- Modify: `apps/web/src/layout/TopBar.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/api/src/routes/auth.ts` 或新建 `routes/preferences.ts`（若尚无 `PATCH /api/users/me/preferences`）

- [x] **Step 1: 拉取 `GET /api/i18n/locales` + `GET /api/themes`，下拉切换**

- [x] **Step 2: 切换 locale 时 `api.i18n(code)` 刷新 labels；`localStorage.awf.locale`**

- [x] **Step 3: `themePreference` + `themeId` 应用 `data-theme-id`（见 ux-ui-design §4.5）**

- [x] **Step 4: 执行环境下拉 `dev|staging|prod` 写 localStorage + PATCH preferences `executionEnvironment`**

- [ ] **Step 5: Vitest 或手动 AC-31/32/33/34 + commit**

---

### Task 10: ConfirmDialog 与 API 错误 Toast ✅

**Files:**
- Create: `apps/web/src/components/ConfirmDialog.tsx`
- Create: `apps/web/src/components/Toast.tsx`
- Create: `apps/web/src/hooks/useConfirm.tsx`
- Modify: `apps/web/src/api/client.ts` — 解析 `{ code, traceId, message }`

- [x] **Step 1: ConfirmDialog 支持 `requireTextMatch`（删除工作流时输入名称）**

- [x] **Step 2: `apiFetch` 失败时 throw `AwfClientError` 含 code/traceId**

- [ ] **Step 3: 测试 ConfirmDialog 渲染 + commit**

---

### Task 11: 凭证管理页 ✅

**Files:**
- Create: `apps/web/src/features/credentials/CredentialsPage.tsx`
- Modify: `apps/web/src/features/settings/SettingsLayout.tsx`
- Modify: `apps/web/src/api/client.ts`

- [x] **Step 1: 列表 `GET /api/credentials`**

- [x] **Step 2: 创建/编辑表单 + `POST .../test`**

- [x] **Step 3: 删除走 ConfirmDialog（输入凭证名）**

- [x] **Step 4: NodePropertiesPanel 中 HTTP 节点增加 credential 下拉（按类型过滤）**

- [ ] **Step 5: commit**

---

### Task 12: 执行列表页与错误面板 ✅

**Files:**
- Modify: `apps/web/src/features/executions/ExecutionListPage.tsx`
- Modify: `apps/web/src/features/executions/ExecutionTimeline.tsx`

- [x] **Step 1: 表格列：workflowName、status、startedAt、duration；筛选 status/workflowId；分页 offset**

- [x] **Step 2: 失败行点击进入时间线；顶部展示 code + traceId + i18n 文案（errors namespace）**

- [x] **Step 3: nodeRuns 失败节点展开 errorCode**

- [ ] **Step 4: commit**

---

### Task 13: 编辑器 — 未保存、危险操作、Active 确认 ✅

**Files:**
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`
- Modify: `apps/web/src/features/workflows/WorkflowListPage.tsx`

- [x] **Step 1: `useBlocker` + `beforeunload` when `dirty`**

- [x] **Step 2: 切换 Active 前 ConfirmDialog 说明生产后果**

- [x] **Step 3: 删除工作流（列表页）ConfirmDialog + 名称匹配**

- [ ] **Step 4: commit**

---

### Task 14: 编辑器 — Webhook 面板与调试工具栏 ✅

**Files:**
- Modify: `apps/web/src/features/editor/NodePropertiesPanel.tsx`
- Create: `apps/web/src/features/editor/WebhookTriggerPanel.tsx`
- Create: `apps/web/src/features/editor/EditorToolbar.tsx`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`
- Modify: `apps/web/src/api/client.ts` — 暴露 `publicUrl` from features or config endpoint

- [x] **Step 1: webhookTrigger 选中时显示 WebhookTriggerPanel：path、生成 secret、Test/Prod URL、curl 示例**

- [x] **Step 2: EditorToolbar：`executionMode: test|production`；Pin 清除；Dirty 角标（nodeDebug 已有则接线）**

- [x] **Step 3: Secret 轮换 ConfirmDialog**

- [ ] **Step 4: commit**

---

### Task 15: 编辑器 — 版本历史与 Sticky Notes ✅

**Files:**
- Create: `apps/web/src/features/editor/VersionHistoryPanel.tsx`
- Modify: `apps/web/src/features/editor/WorkflowCanvas.tsx`
- Modify: `apps/web/src/features/editor/node-type-meta.ts`（可选 `stickyNote`）
- Modify: `packages/workflow/src/validate.ts` — stickyNote 不参与执行图校验

- [x] **Step 1: VersionHistoryPanel 调 `GET versions`；选中 diff（`diff` 库或简单 JSON.stringify 对比）**

- [x] **Step 2: 回滚 ConfirmDialog → `POST rollback`**

- [x] **Step 3: stickyNote 节点：无执行端口；画布渲染 Markdown 预览**

- [ ] **Step 4: commit**

---

### Task 16: 模板画廊与首启 checklist ✅

**Files:**
- Create: `apps/web/src/features/templates/TemplateGalleryPage.tsx`
- Modify: `apps/web/src/features/setup/SetupPage.tsx`
- Modify: `apps/web/src/features/workflows/WorkflowListPage.tsx` — 空状态链到模板

- [x] **Step 1: TemplateGalleryPage 克隆并 navigate 到编辑器**

- [x] **Step 2: Setup checklist 三步与 API `GET /api/setup/checklist` 对齐**

- [x] **Step 3: 首次 success 执行 Toast（编辑器或时间线触发）**

- [ ] **Step 4: commit**

---

> **注（2026-05-23）**：Lite 席位功能（20 人上限、顶栏用量条、E5001）已移除；下文 Task 17 等条目仅作历史记录。

### Task 17: Lite 席位条 ~~✅~~ **已废弃**

**Files:**
- Modify: `apps/web/src/layout/TopBar.tsx`
- Modify: `apps/api/src/routes/system.ts` 或 `auth.ts` — 返回 `{ seatLimit, seatUsed }`
- Modify: `packages/identity/src/user-service.ts`（若计数逻辑在此）

- [x] **Step 1: API `GET /api/system/features` 增加 `seats: { used, limit }`（lite limit=20）**

- [x] **Step 2: TopBar 显示 `18/20`；满员时链接文档/设置说明升级 Standard**

- [ ] **Step 3: commit**

---

### Task 18: P1 集成测试与 UX 清单 ✅

**Files:**
- Create: `apps/api/src/integration/p1-n8n-ui.integration.test.ts`
- Modify: `docs/ux-v1.0-checklist.md` — 勾选 P0 已完成项

- [x] **Step 1: 集成测：env CRUD + global executions + rollback 不改动 running snapshot**

- [x] **Step 2: `pnpm test` 全绿 + `pnpm lint:deps`**

- [x] **Step 3: 更新 checklist + commit**

```bash
git commit -m "test(integration): P1 n8n-first API gates and update ux checklist"
```

**P1 门禁:** ux-v1.0-checklist P0 勾满；AC-1～12、31～34、37～38、42、43(core)。

---

## Phase P2：Standard 部署与数据层

### Task 19: PostgreSQL StorageProvider（workflows/executions/users/credentials/env） ✅

**Files:**
- Create: `packages/providers/standard/src/drizzle/schema.ts`
- Create: `packages/providers/standard/src/drizzle/client.ts`
- Create: `packages/providers/standard/src/repositories/workflow-repository.ts`
- Create: `packages/providers/standard/src/repositories/execution-repository.ts`
- Create: `packages/providers/standard/src/repositories/env-repository.ts`
- Create: `packages/providers/standard/src/storage/create-storage-provider.ts`
- Modify: `packages/providers/standard/src/index.ts`
- Modify: `packages/providers/standard/package.json` — deps: `drizzle-orm`, `pg`

- [x] **Step 1: PG schema 镜像 lite 表（含 env_vars、node_runs）**

- [x] **Step 2: 实现与 lite 同签名的 repository 方法**

- [x] **Step 3: 单元测试（testcontainers 或 mock pg）— listAll executions**

- [ ] **Step 4: commit**

---

### Task 20: BullMQ QueueProvider ✅

**Files:**
- Create: `packages/providers/standard/src/queue/bullmq-queue-provider.ts`
- Create: `packages/providers/contracts/src/queue.ts`（若缺失则定义 `QueueProvider`）
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`

- [x] **Step 1: `enqueue(job)` / `process(handler)` 接口**

- [x] **Step 2: standard profile 下 JobProcessor 从 BullMQ 消费；lite 保持现状**

- [x] **Step 3: `/api/ready` 入队探针 job 并等待完成（AC-36 扩展）**

- [ ] **Step 4: commit**

---

### Task 21: bootstrap Profile 切换 ✅

**Files:**
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/build-options.ts`

- [x] **Step 1: `RXWF_DEPLOY_PROFILE=standard` 时注入 PG repos + BullMQ；lite 不变**

- [x] **Step 2: 集成测 `packages/providers/standard` + compose 冒烟脚本**

- [x] **Step 3: 更新 `docs/README.md` Standard 小节 + commit**

---

### Task 22: `awf migrate` CLI ✅

**Files:**
- Create: `scripts/rxwf-migrate.mjs`
- Modify: `package.json` — `"awf:migrate": "node scripts/rxwf-migrate.mjs"`

- [x] **Step 1: 从 SQLite `RXWF_DATA_DIR/rxwf.db` 读 workflows、workflow_versions、users、credentials、env_vars、executions（可选）写入 PG**

- [x] **Step 2: 文档 README 一段 + 干跑测试**

- [ ] **Step 3: commit**

---

### Task 23: CI — Standard services job ✅

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: job `standard-integration`：services postgres:16 + redis:7；`RXWF_DEPLOY_PROFILE=standard` 跑 health + 一条 execution 入队测试**

- [ ] **Step 2: commit**

**P2 门禁:** AC-35/36；`docker compose -f deploy/compose.standard.yaml up` 冒烟。

---

## Phase P3：Plus 工作流集成

### Task 24: MCP Server 注册 UI ✅

**Files:**
- Create: `apps/api/src/routes/mcp-servers.ts`（若配置仅存内存/DB 需落库 — 复用 lite 表或 json 文件）
- Create: `apps/web/src/features/mcp/McpServersPage.tsx`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts` — mcpClient 节点
- Modify: `apps/web/src/features/editor/NodePalette.tsx` — P1 分组（featurePlus）

- [x] **Step 1: CRUD MCP server 配置（transport npx/http）+ 测试连接**

- [x] **Step 2: mcpClient 节点：Server 下拉、Tool 下拉（来自缓存 tools list）**

- [x] **Step 3: AC-24 集成测复跑 + commit**

---

### Task 25: 插件管理页 ✅

**Files:**
- Create: `apps/web/src/features/plugins/PluginsPage.tsx`
- Modify: `apps/web/src/App.tsx` — `/plugins` 在 featurePlus 时启用

- [x] **Step 1: 上传 `.tgz` → `POST /api/plugins`；列表启用/禁用**

- [x] **Step 2: 禁用后 validate 提示未知节点 — 已有 AC-27 测保障**

- [ ] **Step 3: commit**

---

### Task 26: Admin i18n / theme 设置页 ✅

**Files:**
- Create: `apps/web/src/features/settings/AdminI18nPage.tsx`
- Create: `apps/web/src/features/settings/AdminThemePage.tsx`
- Modify: `apps/web/src/features/settings/SettingsLayout.tsx`

- [x] **Step 1: Admin 角色可见；`PUT /api/admin/i18n/:locale` 表单上传 common.json 片段**

- [x] **Step 2: `PUT /api/admin/themes/:theme` tokens**

- [x] **Step 3: AC-40 集成测 + commit**

---

### Task 27: 生产默认开启 Plus + P3 收尾 ✅

**Files:**
- Modify: `deploy/docker/Dockerfile` 或 `compose.lite.yaml` — `ENV RXWF_FEATURE_PLUS=true`
- Modify: `docs/README.md`
- Modify: `docs/ux-v1.0-checklist.md` — plus 行勾选

- [x] **Step 1: 镜像/env 默认 plus；CI 保留 `RXWF_FEATURE_PLUS=false` job 测 core**

- [x] **Step 2: 全量 `pnpm test` + 更新 RELEASE 说明**

- [ ] **Step 3: commit**

**P3 门禁:** AC-24～27、40；`featurePlus=true` 下插件/MCP/P1 节点可见。

---

## P4（本计划不实施）

Chat RAG、Agent 画布、LangGraph、`rxwf-runner` 远程派发、插件热加载 — 另立 `docs/superpowers/specs/2026-05-xx-ai-agent-milestone-design.md`。

---

## 计划自检（spec 覆盖）

| Spec § | 任务 |
|--------|------|
| §3.1 导航/路由 | Task 8, 9 |
| §3.2 编辑器 | Task 13–15 |
| §3.3 薄 API | Task 2–7 |
| §4.1 env | Task 1–3 |
| §4.2 执行 | Task 4, 12 |
| §4.3 Webhook | Task 7, 14 |
| §4.4 版本/Pin | Task 5, 15 |
| §4.5 凭证 | Task 11 |
| §3.4 Standard | Task 19–23 |
| §3.5 Plus | Task 24–27 |
| §5 测试 | Task 18, 23, 27 |

无 TBD；P4 已显式排除。

---

## 进度总览（实施时更新）

| Phase | 任务 | 状态 |
|-------|------|------|
| P1 | Task 1 `packages/env` + SQLite `env_vars` | ✅ 2026-05-22 |
| P1 | Task 2 `/api/env` CRUD | ✅ 2026-05-22 |
| P1 | Task 3 运行期 `$env` 注入 | ✅ 2026-05-22 |
| P1 | Task 4 `GET /api/executions` 全局列表 | ✅ 2026-05-22 |
| P1 | Task 5 版本 list/rollback API | ✅ 2026-05-22 |
| P1 | Task 8 AppShell + 核心页面 | ✅ 2026-05-22 |
| P1 | Task 6 内置模板 API | ✅ 2026-05-22 |
| P1 | Task 7 Webhook X-AWF-Test + 定义内 HMAC | ✅ 2026-05-22 |
| P1 | Task 9 顶栏 i18n/主题/执行环境 | ✅ 2026-05-22 |
| P1 | Task 10 ConfirmDialog + AwfClientError | ✅ 2026-05-22 |
| P1 | Task 11 凭证管理页 | ✅ 2026-05-22 |
| P1 | Task 12 执行列表与错误面板 | ✅ 2026-05-22 |
| P1 | Task 13 编辑器未保存/危险操作 | ✅ 2026-05-22 |
| P1 | Task 14 Webhook 面板 + 调试工具栏 | ✅ 2026-05-22 |
| P1 | Task 15 版本历史 + Sticky Notes | ✅ 2026-05-22 |
| P1 | Task 16 模板画廊 + Setup | ✅ 2026-05-22 |
| P1 | Task 17 Lite 席位条 | **已废弃**（2026-05-23 移除） |
| P1 | Task 18 P1 集成测 + UX 清单 | ✅ 2026-05-22 |
| P2 | Task 19–23 | ✅ 2026-05-22 |
| P3 | Task 24–27 | ✅ 2026-05-22 |

**最近验证：** `pnpm test` 全绿；`pnpm lint:deps` 无循环依赖；`api` 45 tests、`providers-standard` 5 tests（PG/Redis 可用时）、`web` build 通过。
