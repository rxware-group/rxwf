# RX-Workflow v1.0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步执行。步骤使用 `- [ ]` 勾选跟踪。

**Goal:** 从零实现 v1.0-core（GA）→ v1.0-plus → Standard 压测门禁，交付 AI-Native 工作流平台（Lite 单容器、8787 端口、MCP Server、P0 DAG、Node Runner Embedded）。

**Architecture:** pnpm + Turborepo 模块化单体；`TriggerIngress` 统一入队；`execution` 调度 DAG；`node-runner` 唯一节点执行入口；Provider 契约切换 Lite SQLite / Standard PG+Redis；`RXWF_FEATURE_PLUS` 控制 plus 能力。

**Tech Stack:** Node.js ≥20、TypeScript、Fastify 5、Drizzle、Vitest、React 19、Vite、@xyflow/react、@n8n/tournament（表达式）、Zod。

**设计依据:** [2026-05-20-v1-implementation-design.md](../specs/2026-05-20-v1-implementation-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

## 实施进度总览（截至 2026-05-20）

| Phase | 状态 | 说明 |
|-------|------|------|
| **M0** 脚手架 | ✅ 已完成 | Monorepo、Lite Provider、API 8787、identity 认证（~~席位~~ 已移除） |
| **M1** 执行引擎 | ✅ 已完成 | E2006、子工作流入队、node_runs、凭证、集成测 |
| **M2** Web 控制台 | ✅ 已完成 | Vite/React、编辑器、Runner、执行监控、i18n/theme |
| **M3** MCP + core GA | ✅ 已完成 | 8 Tools、CI、Docker 编排、depcruise/ajv |
| **M4** v1.0-plus | ✅ 已完成 | ai-runtime、Chat SSE、MCP Client 池、插件、Admin、P1 executors |
| **M5** Standard + GA | ✅ 已完成（健康检查/向导/压测脚本） | Standard `/ready`、setup checklist、load-test 脚本 |

**验证：** `pnpm test` → **42/42** tasks PASS；`pnpm lint:deps` PASS；`ajv validate` PASS

**近期提交（节选）：** `docs(plan): sync M0/M1 implementation progress through webhook pipeline`（`4f89359`）；方案 B 代码待提交

### M1 已完成清单

- `packages/expression` — `$json` 求值、E1002
- `packages/node-runner` — Facade / Registry / Dispatcher / Embedded；P0 executors（http、if、switch、merge、set、json、wait、code、subworkflow、errorTrigger、manualTrigger、webhookTrigger、**scheduleTrigger**）
- `packages/sandbox` — Code Worker 沙箱
- `packages/execution` — ErrorWorkflow、Partial Pin、ExecutionEngine DAG、SchedulerService、`isCronDue` / `listDueSchedules`、ExecutionEnqueue（AC-42）、JobProcessor、ExecutionRunner、TriggerIngress（HMAC + 幂等）
- `packages/workflow` — validate（E1003/E1004/E1005）、workflow-service（AC-2 版本递增）
- `packages/providers/lite` — Runner / Workflow / Execution / **NodeRun** / **Credential** / JobQueue / Idempotency / SchedulerLease
- `packages/credential` — AES-256-GCM 加解密、`createCredentialService`（create/list/resolve/test）
- `apps/api` — `/api/workflows` CRUD+validate、`POST .../executions`、**`GET .../executions`**、**`GET /api/executions/:id`**（含 nodeRuns 时间线）、**`/api/credentials`**、**`POST /webhook/...`**、Scheduler / JobProcessor

### M1 待办（core GA 前建议补齐）

| 项 | 任务映射 | 优先级 | 状态 |
|----|----------|--------|------|
| `scheduleTrigger` executor + Cron 与引擎联调 | Task 7 / 8 | P1 | ✅ |
| `node_runs` 持久化 + 执行历史 API | Task 8 / 12 | P1 | ✅ |
| `packages/credential` | Task 9 | P1 | ✅ |
| Webhook `X-AWF-Timestamp` / E2006 | Task 8 §3.1 | P2 | ✅ |
| 子工作流经 TriggerIngress 接线（非仅 executor 单测） | Task 7e / 8 | P2 | ✅ |
| `packages/mcp-server` 8 Tools | Task 14 | core GA | ✅ |
| `.dependency-cruiser` + Docker Lite + CI | Task 15 | core GA | ✅（Docker 需本机守护进程） |

### 方案 B 分步记录（2026-05-20）

| 步骤 | 内容 | 验证 |
|------|------|------|
| **B1** | `scheduleTrigger` executor + 管线集成测（schedule→set DAG） | `schedule.test.ts`、`execution-pipeline.integration.test.ts` |
| **B2** | `createLiteNodeRunRepository` + `createPersistingNodeRunExecutor` 接线 | `node-run-repository.test.ts`、管线断言 2 条 node_runs |
| **B3** | `GET /api/workflows/:id/executions`、`GET /api/executions/:id` | `executions.test.ts` |
| **B4** | `packages/credential` + `/api/credentials` CRUD/test | `credential-service.test.ts`、`credentials.test.ts` |

### 集成测试用例（自动化）

| 套件 | 路径 | 覆盖 |
|------|------|------|
| M1 核心 | `apps/api/src/integration/m1-core.integration.test.ts` | 手动执行、Webhook、凭证 |
| 管线 | `execution-pipeline.integration.test.ts` | scheduleTrigger 入队执行 |
| 子工作流 | `subworkflow-pipeline.integration.test.ts` | executeWorkflow 端到端 |
| MCP | `apps/api/src/routes/mcp.test.ts` | AC-13 create+execute |
| M4 plus | `apps/api/src/integration/m4-plus.integration.test.ts` | AC-18 Chat SSE、AC-26/27 插件、AC-40 Admin |
| M5 setup | `apps/api/src/integration/m5-setup.integration.test.ts` | AC-35 安装向导 |
| Web | `apps/web/src/features/editor/validate-connections.test.ts` | AC-1 环路 |
| i18n/theme | `apps/api/src/routes/i18n-theme.test.ts` | AC-31–34 |
| ai-runtime | `packages/ai-runtime/src/runtime.test.ts` | AC-5 Ollama |
| mcp-pool | `packages/mcp-client-pool/src/pool.test.ts` | AC-24 |
| standard health | `packages/providers/standard/src/health.test.ts` | AC-36 |

说明见 `tests/integration/README.md`。

### M4 已完成清单

- `packages/ai-runtime` + `ai-runtime/stub`（E3001 / Ollama AC-5）
- `packages/chat` + Lite `chat_sessions` / `chat_messages` + SSE `POST /api/chat/sessions/:id/stream`
- `packages/mcp-client-pool`（max 3，AC-24）
- `packages/plugin-host`（签名校验 AC-26/27）
- `registerPlusExecutors`：splitInBatches、readWriteFile、postgres、ollama、llmStream、mcpClient
- Admin：`PUT /api/admin/i18n/:locale`、`PUT /api/admin/themes/:theme`（AC-40）
- Web：`ChatPage`、`SetupPage`（plus 门控 Chat 导航）

### M5 已完成清单

- `packages/providers/standard` — PG+Redis 健康检查（AC-36）
- `deploy/compose.standard.yaml`
- `GET /api/setup/checklist`（AC-35）+ Web Setup 页
- `scripts/load-test-standard.mjs`（100 并发 health 压测，结果 JSON 输出）

### 建议下一步

1. **Docker smoke** — 本机启动 Docker Desktop 后跑 `compose.lite.yaml` / `compose.standard.yaml`
2. **打 tag** — `v1.0.0-core` / `v1.0.0`（按需）
3. **Standard 完整 PG+BullMQ Provider** — 当前 standard 包为健康检查占位，队列/存储实现可后续迭代

## TDD 强制流程（M1 起）

自 Task 5 起 **严格** 遵循 superpowers:test-driven-development：

1. **RED**：仅提交测试 + 包配置；运行 `pnpm --filter <pkg> test`，必须看到**预期失败**（非 typo）
2. **GREEN**：最小实现使当前测试通过
3. **REFACTOR**：测试全绿后再整理结构
4. **禁止**：先写实现再补测试；禁止跳过「观看失败」步骤

每个 Task 的 commit 消息注明 TDD 周期，例如：`test(expression): red — $json template` → `feat(expression): green — evaluate $json path`

---

## 文件结构总览（将创建）

| 路径 | 职责 |
|------|------|
| `pnpm-workspace.yaml` / `turbo.json` | Monorepo 根 |
| `packages/shared` | `Item`、`AwfError`、`E2xxx` 常量 |
| `packages/providers/contracts` | Storage/Queue/Cache/Blob/RunnerRepositoryPort |
| `packages/providers/lite` | SQLite Drizzle 实现 |
| `packages/identity` | 用户、会话、API Key、RBAC |
| `packages/workflow` | CRUD、validate、版本 |
| `packages/expression` | `{{ }}` 求值 |
| `packages/credential` | 凭证加解密 |
| `packages/sandbox` | Code 子进程池 |
| `packages/node-runner` | Facade、Registry、Dispatcher、P0 executors |
| `packages/execution` | Engine、Scheduler、ErrorWorkflow、Partial |
| `packages/mcp-server` | 8 MCP Tools |
| `packages/i18n-catalog` / `theme-catalog` | FR-20 core |
| `packages/runner-agent` | v1.0 占位 README |
| `packages/ai-runtime/stub` | core 空实现 |
| `apps/api` | Fastify 装配、8787、迁移 |
| `apps/web` | React 编辑器 |
| `deploy/docker` + `compose.lite.yaml` | 单容器 8787 |

---

## Phase M0：脚手架与基础设施（W1–2）

### Task 1: Monorepo 根配置 ✅

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/shared/package.json`, `packages/shared/src/index.ts`

- [x] **Step 1: 初始化 workspace**

```json
// pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/providers/*"
  - "packages/ai-runtime/*"
```

```json
// package.json（根）
{
  "name": "rx-workflow",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "dev": "turbo run dev --parallel",
    "lint:deps": "depcruise packages apps --config .dependency-cruiser.cjs"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20" }
}
```

- [x] **Step 2: 创建 shared 类型**

```typescript
// packages/shared/src/item.ts
export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: Record<string, { data: string; mimeType: string }>;
}

// packages/shared/src/errors.ts
export class AwfError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
```

- [x] **Step 3: 运行 `pnpm install`**

Run: `pnpm install`  
Expected: lockfile 生成，无错误

- [x] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: monorepo scaffold with shared package"
```

---

### Task 2: Provider 契约与 Lite SQLite ✅

**Files:**
- Create: `packages/providers/contracts/src/*.ts`
- Create: `packages/providers/lite/src/drizzle/schema.ts`
- Create: `packages/providers/lite/src/storage-provider.ts`
- Create: `packages/providers/lite/src/runner-repository.ts`
- Test: `packages/providers/lite/src/runner-repository.test.ts`

- [x] **Step 1: 定义 RunnerRepositoryPort**

```typescript
// packages/providers/contracts/src/runner-repository.ts
export type RunnerOs = 'windows' | 'linux' | 'macos';
export type RunnerArch = 'x64' | 'arm64' | 'arm';

export interface RunnerPlatform {
  os: RunnerOs;
  arch: RunnerArch;
  osVersion?: string;
}

export interface RunnerRecord {
  id: string;
  name: string;
  kind: 'embedded' | 'agent';
  platform: RunnerPlatform;
  status: 'online' | 'offline' | 'draining';
  capabilities: string[];
  maxConcurrent: number;
  runningJobs: number;
}

export interface RunnerRepositoryPort {
  ensureEmbedded(platform: RunnerPlatform, capabilities: string[]): Promise<RunnerRecord>;
  listOnline(filter?: { kind?: string }): Promise<RunnerRecord[]>;
  findById(id: string): Promise<RunnerRecord | null>;
  incrementRunningJobs(id: string, delta: number): Promise<void>;
}
```

- [x] **Step 2: Drizzle schema（核心表）**

表须包含（见 adr-execution-data）：`users`, `workflows`, `workflow_versions`, `executions`, `node_runs`, `execution_blobs`, `runners`, `idempotency_keys`, `scheduler_leases`, `jobs`, `credentials`, `sessions`, `api_keys`

- [x] **Step 3: 写失败测试 ensureEmbedded**

```typescript
// packages/providers/lite/src/runner-repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createLiteRunnerRepository } from './runner-repository';
import { createTestDb } from './test-db';

describe('LiteRunnerRepository', () => {
  it('ensureEmbedded creates single embedded runner', async () => {
    const db = await createTestDb();
    const repo = createLiteRunnerRepository(db);
    const r1 = await repo.ensureEmbedded({ os: 'linux', arch: 'x64' }, ['code']);
    const r2 = await repo.ensureEmbedded({ os: 'linux', arch: 'x64' }, ['code']);
    expect(r1.id).toBe(r2.id);
    expect(r1.kind).toBe('embedded');
    expect(r1.capabilities).toContain('code');
  });
});
```

- [x] **Step 4: 实现 `createLiteRunnerRepository` 使测试通过**

- [x] **Step 5: Run test**

Run: `pnpm --filter @rxwf/providers-lite test`  
Expected: PASS

- [x] **Step 6: Commit**

```bash
git commit -m "feat(providers): contracts and lite runner repository"
```

---

### Task 3: apps/api 最小启动（8787） ✅

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/config.ts`
- Create: `apps/api/src/bootstrap.ts`

- [x] **Step 1: Fastify 监听 8787**

```typescript
// apps/api/src/config.ts
export const config = {
  httpPort: Number(process.env.RXWF_HTTP_PORT ?? 8787),
  publicUrl: process.env.RXWF_PUBLIC_URL ?? 'http://localhost:8787',
  deployProfile: process.env.RXWF_DEPLOY_PROFILE ?? 'lite',
  featurePlus: process.env.RXWF_FEATURE_PLUS === 'true',
  dataDir: process.env.RXWF_DATA_DIR ?? './data',
};
```

```typescript
// apps/api/src/main.ts
import Fastify from 'fastify';
import { config } from './config.js';
import { bootstrap } from './bootstrap.js';

const app = Fastify({ logger: true });
await bootstrap(app);

await app.listen({ port: config.httpPort, host: '0.0.0.0' });
console.log(`rx-workflow listening on ${config.httpPort}`);
```

- [x] **Step 2: bootstrap 注册 /health /ready**

```typescript
// apps/api/src/bootstrap.ts（节选）
app.get('/api/health', async () => ({ ok: true }));
app.get('/api/ready', async () => {
  // 后续注入 DB ping
  return { ready: true };
});
```

- [x] **Step 3: 启动验证**

Run: `pnpm --filter @rxwf/api dev`  
Run: `curl -s http://localhost:8787/api/health`  
Expected: `{"ok":true}`

- [x] **Step 4: Commit**

```bash
git commit -m "feat(api): fastify bootstrap on port 8787"
```

---

### Task 4: identity 最小认证 ✅

**Files:**
- Create: `packages/identity/src/auth-service.ts`
- Create: `apps/api/src/middleware/auth.ts`
- Test: `packages/identity/src/auth-service.test.ts`

- [x] **Step 1: API Key 校验测试**

```typescript
it('rejects missing api key on protected route', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/workflows' });
  expect(res.statusCode).toBe(401);
});
```

- [x] **Step 2: 实现 session cookie + apiKey 双模式**

- [x] **Step 3: ~~Lite 席位：第 21 用户返回 E5001~~**（**已废弃**，2026-05-23 移除席位上限）

- [x] **Step 4: Commit**

```bash
git commit -m "feat(identity): api key and lite seat limit"
```

---

## Phase M1：执行引擎与 node-runner（W3–5）

### Task 5: expression 包（ADR-004） ✅

**Files:**
- Create: `packages/expression/src/evaluate.ts`
- Test: `packages/expression/src/evaluate.test.ts`

- [x] **Step 1: 失败测试 `{{ $json.count }}`**

```typescript
import { evaluateExpression } from './evaluate';
import { describe, it, expect } from 'vitest';

describe('evaluateExpression', () => {
  it('reads $json field', () => {
    const ctx = { json: { count: 2 } };
    expect(evaluateExpression('{{ $json.count }}', ctx)).toBe(2);
  });

  it('rejects assignment', () => {
    expect(() => evaluateExpression('{{ x = 1 }}', {})).toThrow(/E1002/);
  });
});
```

- [x] **Step 2: 集成 `@n8n/tournament` 或最小 AST 解释器**（当前为最小路径求值实现）

- [x] **Step 3: Run test → PASS → Commit**

---

### Task 6: node-runner 骨架（Facade + embedded Dispatcher） ✅

**Files:**
- Create: `packages/node-runner/src/facade/node-runner-facade.ts`
- Create: `packages/node-runner/src/dispatch/runner-dispatcher.ts`
- Create: `packages/node-runner/src/registry/executor-registry.ts`
- Test: `packages/node-runner/src/dispatch/runner-dispatcher.test.ts`

- [x] **Step 1: Dispatcher 仅返回 embedded**

```typescript
// runner-dispatcher.test.ts
it('resolve always picks embedded in v1.0', async () => {
  const dispatcher = createRunnerDispatcher({ runnerRegistry, mode: 'core' });
  const resolved = await dispatcher.resolve({ workflowPolicy: { mode: 'auto' } });
  expect(resolved.kind).toBe('embedded');
});
```

- [x] **Step 2: 实现 Facade 注入 RunnerRepositoryPort（构造注入，禁止 import lite）**

- [x] **Step 3: apps/api bootstrap 调用 ensureEmbedded**

- [x] **Step 4: Commit**

---

### Task 7: P0 Executors（分批，每批一 commit） ✅（含 subworkflow 注册）

**顺序建议：**

| 批次 | executor | 测试要点 |
|------|----------|----------|
| 7a | `http.ts` | mock fetch，表达式 URL |
| 7b | `if.ts`, `switch.ts`, `merge.ts` | 多输出分支 |
| 7c | `set.ts`, `json.ts`, `wait.ts` | Items 变换 |
| 7d | `code.ts` → sandbox | 子进程 mock |
| 7e | `subworkflow.ts` | 嵌套深度 ≤5 |
| 7f | `triggers/error.ts` | Error 载荷 → Items |
| — | `triggers/manual.ts`, `triggers/webhook.ts` | 手动/Webhook 触发（补充） |
| ✅ | `triggers/schedule.ts` | 与 Scheduler 联动（B1 完成） |

- [x] **每批：写测试 → 实现 → `pnpm --filter @rxwf/node-runner test` → commit**（7a–7f + manual/webhook/schedule 已完成）

示例 HTTP 测试：

```typescript
it('httpRequest executor calls fetch with resolved url', async () => {
  const result = await registry.execute('httpRequest', {
    config: { url: 'https://example.com', method: 'GET' },
    inputItems: [{ json: {} }],
  });
  expect(result.status).toBe('success');
});
```

---

### Task 8: execution 引擎 ✅

**Files:**
- Create: `packages/execution/src/engine/execution-engine.ts` ✅
- Create: `packages/execution/src/snapshot/create-execution-snapshot.ts` ✅
- Create: `packages/execution/src/enqueue/execution-enqueue-service.ts` ✅
- Create: `packages/execution/src/jobs/job-processor.ts` ✅
- Create: `packages/execution/src/runner/execution-runner.ts` ✅
- Create: `packages/execution/src/trigger/trigger-ingress.ts` ✅
- Create: `packages/execution/src/error-workflow/error-workflow-service.ts` ✅
- Create: `packages/execution/src/scheduler/scheduler-service.ts` ✅
- Create: `packages/execution/src/partial/partial-planner.ts` ✅
- Wire: `apps/api` Scheduler tick、`JobProcessor` loop、`POST /webhook/...` ✅
- Test: 见各包 `*.test.ts` + `execution-pipeline.integration.test.ts`、`webhook.test.ts` ✅

- [x] **Step 1: 快照测试 AC-42**（`execution-enqueue-service.test.ts`；DB 级 v3/v4 场景可再补集成测）

```typescript
it('persists definition_snapshot at enqueue time', async () => {
  await workflow.save(workflowId, v4Definition);
  const running = await startExecution(workflowId); // 使用 v3 快照的已存在实例
  const snap = await executionRepo.getSnapshot(running.id);
  expect(snap.version).toBe(3);
});
```

- [x] **Step 2: DAG 遍历调用 NodeRunnerFacade（非直接 sandbox）**

- [x] **Step 3: ErrorWorkflow maxErrorDepth=2 测试 AC-4**

- [x] **Step 4: Partial 闭包 + Pin 跳过测试 AC-10**

- [x] **Step 5: Scheduler tick 入队集成测试**

- [x] **Step 6: TriggerIngress 幂等 + HMAC + Timestamp E2006**

- [x] **Step 7: `node_runs` 持久化**（`createLiteNodeRunRepository` + `createPersistingNodeRunExecutor`）

- [x] **Step 8: 执行查询 API**（`GET /api/workflows/:workflowId/executions`、`GET /api/executions/:executionId`）

- [x] **Step 9: Commit（可分多个 commit）**

---

### Task 9: workflow + credential 包 ✅

**Files:**
- Create: `packages/workflow/src/workflow-service.ts`
- Create: `packages/workflow/src/validate.ts`
- Create: `packages/credential/src/credential-service.ts`
- Test: `packages/workflow/src/validate.test.ts`

- [x] **Step 1: validate 测试 E1003/E1004/E1005**

- [x] **Step 2: CRUD + 版本递增 AC-2**

- [x] **Step 3: 对接 OpenAPI 路由（`apps/api/src/routes/workflows.ts` + `POST .../executions`）**

- [x] **Step 4: `packages/credential` + `/api/credentials` 路由**（AES-256-GCM、`RXWF_CREDENTIAL_KEY`）

---

## Phase M2：Web 控制台（W6–7）

### Task 10: apps/web 脚手架

**Files:**
- Create: `apps/web/vite.config.ts`（proxy `8787`）
- Create: `apps/web/src/App.tsx`, `routes.tsx`

- [x] **Step 1: Vite + React + proxy `/api` → 8787**

- [x] **Step 2: `GET /api/system/features` 驱动 plus 路由隐藏**

- [x] **Step 3: Commit**

---

### Task 11: 工作流编辑器（@xyflow/react）

**Files:**
- Create: `apps/web/src/features/editor/WorkflowCanvas.tsx`
- Create: `apps/web/src/features/editor/NodePalette.tsx`（仅 P0 节点）

- [x] **Step 1: 三栏布局 ux §3.1**

- [x] **Step 2: 连线校验 + 非法连接提示 AC-1**

- [x] **Step 3: Active 开关、未保存提示 E1001**

- [x] **Step 4: 调试工具栏 Pin/Partial/Test 模式 AC-10**

- [x] **Step 5: Commit**

---

### Task 12: Runner UI + 执行监控

**Files:**
- Create: `apps/web/src/features/runners/RunnerListPage.tsx`
- Create: `apps/web/src/features/executions/ExecutionTimeline.tsx`

- [x] **Step 1: Runner 只读列表 AC-43（platform/status）**

- [x] **Step 2: runnerPolicy 编辑器 ux §3.23**（UI 占位）

- [x] **Step 3: 执行历史分页 50 条 AC-12 + node_run runner_platform**

- [x] **Step 4: Commit**

---

### Task 13: i18n / theme（FR-20 core）

**Files:**
- Create: `packages/i18n-catalog`, `packages/theme-catalog`
- Wire: `apps/api/src/routes/i18n.ts`, `themes.ts`

- [x] **Step 1: 内置 zh-CN/en + dark/light tokens**

- [x] **Step 2: AC-31–34 程序化测试**

- [x] **Step 3: Commit**

---

## Phase M3：MCP + core GA（W8）

### Task 14: mcp-server 8 Tools

**Files:**
- Create: `packages/mcp-server/src/tools/*.ts`
- Create: `packages/mcp-server/src/server.ts`
- Wire: `apps/api` stdio 入口 + `/mcp` HTTP

| Tool | 实现文件 |
|------|----------|
| workflow_list | `tools/workflow-list.ts` |
| workflow_get | `tools/workflow-get.ts` |
| workflow_create | `tools/workflow-create.ts` |
| workflow_update | `tools/workflow-update.ts` |
| workflow_execute | `tools/workflow-execute.ts` |
| execution_get | `tools/execution-get.ts` |
| execution_list | `tools/execution-list.ts` |
| workflow_validate | `tools/workflow-validate.ts` |

- [x] **Step 1: 集成测试 AC-13（create + execute）**

- [x] **Step 2: AC-14 validate 拒绝环路**

- [x] **Step 3: MCP HTTP 路由 + API Key 鉴权**（scope 细粒度 v1.1）

- [x] **Step 4: Commit**

---

### Task 15: CI 门禁与 Docker Lite

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `deploy/docker/Dockerfile`
- Create: `deploy/compose.lite.yaml`（`8787:8787`）
- Create: `.dependency-cruiser.cjs`

- [x] **Step 1: CI — test + openapi validate + schema validate + depcruise**

```bash
pnpm test
pnpm exec redocly lint docs/openapi.yaml
pnpm exec ajv validate -s docs/schemas/workflow-definition.v1.schema.json -d fixtures/valid-workflow.json
pnpm lint:deps
```

- [ ] **Step 2: Docker build & smoke**（编排已就绪；本环境 Docker 未运行，需手动）

```bash
docker compose -f deploy/compose.lite.yaml up -d
curl -sf http://localhost:8787/api/ready
```

- [ ] **Step 3: 打 tag `v1.0.0-core` 文档**

- [ ] **Step 4: Commit**

---

## Phase M4：v1.0-plus（W9–11）

### Task 16: ai-runtime stub → 真实实现切换 ✅

**Files:**
- Create: `packages/ai-runtime/stub/index.ts`（`E3001 FEATURE_DISABLED`）
- Create: `packages/ai-runtime/src/runtime.ts`（Ollama，无 LangChain 硬依赖）
- Modify: `apps/api/src/bootstrap.ts`（按 `RXWF_FEATURE_PLUS` 装配）

- [x] **Step 1: core 构建不依赖 langchain**

- [x] **Step 2: plus 启用后 Ollama executor AC-5**

- [ ] **Step 3: Commit**

---

### Task 17: chat 包（FR-17） ✅

**Files:**
- Create: `packages/chat/src/chat-service.ts`
- Create: `apps/api/src/routes/chat.ts`（SSE）

- [x] **Step 1: 会话 CRUD + 流式 AC-18**

- [x] **Step 2: web Chat 页（plus 路由）**

- [ ] **Step 3: Commit**

---

### Task 18: mcp-client-pool + MCP Client 节点 ✅

- [x] **Step 1: 子进程池 max 3**

- [x] **Step 2: AC-24 npx + Tool 选择**

- [ ] **Step 3: Commit**

---

### Task 19: plugin-host（FR-18） ✅

- [x] **Step 1: 上传、签名校验、register(registry)**

- [x] **Step 2: AC-26/27**

- [ ] **Step 3: Commit**

---

### Task 20: FR-20 Admin + P1 executors ✅

- [x] **Step 1: Admin i18n/theme API AC-40**

- [x] **Step 2: P1 节点 executor 注册（file, db, splitInBatches, llm-stream）**

- [x] **Step 3: `RXWF_FEATURE_PLUS=true` E2E**（`m4-plus.integration.test.ts`）

- [ ] **Step 4: Commit**

---

## Phase M5：Standard + v1.0 GA（W12–14）

### Task 21: providers/standard ✅（健康检查 + 编排；完整 PG/BullMQ 实现待迭代）

**Files:**
- Create: `packages/providers/standard/*`
- Create: `deploy/compose.standard.yaml`

- [ ] **Step 1: PG + BullMQ + Redis 完整 Storage/Queue 实现**（v1 占位：仅 health）

- [x] **Step 2: AC-36 `/ready` 检查 PG+Redis**

- [x] **Step 3: 100 并发压测脚本（`scripts/load-test-standard.mjs`）**

- [ ] **Step 4: Commit**

---

### Task 22: FR-22 安装向导（AC-35，可 P1） ✅

- [x] **Step 1: 首启 checklist API + Web §3.18**

- [ ] **Step 2: Commit**

---

### Task 23: v1.0.0 GA ✅（文档）

- [x] **Step 1: 全量 AC 回归清单（§设计 spec 6.1 + 6.2）** — 见 `docs/RELEASE-v1.0.md`

- [x] **Step 2: 更新 `docs/README.md` 运行说明（8787、`docker run`）**

- [x] **Step 3: Release notes** — `docs/RELEASE-v1.0.md`

---

## 规格覆盖自检

| 设计章节 | 任务 |
|----------|------|
| §0.2 8787 | Task 3, 15 |
| §2.3 identity/RBAC | Task 4, 9 |
| §3.1 幂等/HMAC | Task 8 |
| §3.4 Partial/Pin | Task 8, 11 |
| §3.5 node-runner | Task 6, 7 |
| §3.6 Error Workflow | Task 7f, 8 |
| §3.7 Scheduler | Task 8 |
| §4.2 MCP 8 Tools | Task 14 |
| §0.3 UI plus 隐藏 | Task 10 |
| plus 包 | Task 16–20 |
| Standard | Task 21 |

## 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.4 | 2026-05-20 | M4–M5 完成：plus Chat/MCP/插件/Admin、Standard health、setup、压测脚本；`pnpm test` 42/42 |
| v1.3 | 2026-05-20 | M1–M3 完成：E2006、子工作流、Web 控制台、MCP 8 Tools、CI/depcruise/ajv；`pnpm test` 30/30 |
| v1.2 | 2026-05-20 | 方案 B 完成：scheduleTrigger、node_runs 持久化、执行查询 API、credential 包；`pnpm test` 22/22 |
| v1.1 | 2026-05-20 | 同步 M0 完成、M1 ~85%（含 Webhook→TriggerIngress→execution.enqueue 端到端） |
| v1.0 | 2026-05-20 | 初稿：M0–M5 分 phase，23 tasks |
