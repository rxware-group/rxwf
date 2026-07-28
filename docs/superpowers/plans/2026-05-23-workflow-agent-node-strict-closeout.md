# P4-B AI Agent 严格收尾（Strict Closeout）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 **不扩大 P4-B.3 范围** 的前提下，使 P4-B MVP 满足 [spec](../specs/2026-05-23-workflow-agent-node-design.md) **严格验收（标准 B）**：`nodeRun.metadata.agentSteps`、全量执行可观测、AC-B1～B5 自动化证据、i18n/RELEASE 对齐。

**Architecture:** 执行期用 `onAgentStream` 将 `AiStreamChunk` 归并为 `AgentStepRecord[]`（含 `durationMs`/`status`），经 `NodeRunResult.metadata` 写入 Lite `node_runs.metadata`；API 与前端读 metadata 优先、output JSON 回退。全量执行无 SSE 时，编辑器/执行详情页对 **running** 的 execution 轮询 `GET /api/executions/:id`（2s 间隔，执行结束停止）。集成测分层：默认 mock AI 必绿；`RXWF_TEST_OLLAMA=1` 时跑真实 Ollama 冒烟。

**Tech Stack:** TypeScript、Vitest、Drizzle/SQLite、Fastify、React 19、pnpm workspace。设计依据：[2026-05-23-workflow-agent-node-design.md](../specs/2026-05-23-workflow-agent-node-design.md)。前置实现见：[2026-05-23-workflow-agent-node.md](./2026-05-23-workflow-agent-node.md)。

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

**不在本计划范围（P4-B.3）：** `$fromAI`、`ai_outputParser`、HITL、`workflow.type=agent` 画布。

---

## 严格验收签字表（完成定义）

| ID | 条件 |
|----|------|
| SC-1 | `node_runs.metadata` 持久化 `agentSteps`，API `GET /executions/:id` 返回 |
| SC-2 | `AgentStepRecord` 含 `tool`、`status`、`durationMs`（及 `type`/`input`/`output` 摘要） |
| SC-3 | 全量 Manual 执行后，执行时间线展示 metadata 步骤（含耗时） |
| SC-4 | 编辑器对 **进行中** 的全量执行可轮询看到 Agent 步骤（或文档化仅执行详情页，二选一须在 Task 12 定稿） |
| SC-5 | AC-B2：集成测断言 metadata + mock MCP 被调用 |
| SC-6 | AC-B3：两轮同 `sessionId`，第二次 `runAgent` 收到非空 `history` |
| SC-7 | AC-B5：Lite + Standard 各至少 1 条自动化测试（Standard 无 PG 时 `skip`，CI 文档写明） |
| SC-8 | toolWorkflow 深度 + E2008 集成测 |
| SC-9 | i18n `errors.E1012`～`E3012`、`W1011`；`docs/error-codes.md` 一致 |
| SC-10 | Spec 修订：`$fromAI` 统一为 P4-B.3；metadata 字段写清 |
| SC-11 | `pnpm test` 全仓通过；`pnpm --filter @rxwf/api test -- p4b` 通过 |

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `docs/superpowers/specs/2026-05-23-workflow-agent-node-design.md` | 修订分期与 metadata 约定 |
| `packages/ai-runtime-stub/src/agent-steps.ts` | `AgentStepRecord`、`chunksToAgentSteps` |
| `packages/ai-runtime-stub/src/index.ts` | 导出类型 |
| `packages/node-runner/src/agent-steps-accumulator.ts` | 流式 chunk → 累积步骤 |
| `packages/node-runner/src/types/node-executor.ts` | `NodeRunResult.metadata` |
| `packages/providers/lite/src/drizzle/schema.ts` | `node_runs.metadata` 列 |
| `packages/providers/lite/src/drizzle/apply-schema.ts` | 迁移 DDL |
| `packages/providers/lite/src/node-run-repository.ts` | finish 读写 metadata |
| `apps/api/src/execution/create-execution-runtime.ts` | 持久化 metadata + 全量 onAgentStream |
| `packages/execution/src/runner/execution-runner.ts` | 传入 `onAgentStream` |
| `packages/execution/src/engine/execution-engine.ts` | 已有 hook，确认贯通 |
| `packages/ai-runtime/src/langchain-runtime.ts` | tool 事件带时间戳 |
| `apps/api/src/routes/executions.ts` | 响应含 `metadata` |
| `apps/web/src/api/client.ts` | 类型含 `metadata` |
| `apps/web/src/features/executions/ExecutionTimeline.tsx` | 读 metadata，展示耗时/状态 |
| `apps/web/src/features/executions/use-execution-poll.ts` | 轮询 hook（新建） |
| `packages/i18n-catalog/src/catalog.ts` | Agent 错误码文案 |
| `apps/api/src/integration/p4b-agent.integration.test.ts` | 扩展 AC-B2/B3/B5/metadata |
| `apps/api/src/integration/p4b-agent-workflow-tool.integration.test.ts` | toolWorkflow 深度 |
| `apps/api/src/integration/p4b-agent-ollama.integration.test.ts` | `skipIf` 真实 Ollama |
| `docs/RELEASE-v1.1-agent.md` | 发布说明 |

---

## Phase 0：Spec 修订（先于代码）

### Task 0: 修订 design spec 严格验收约定

**Files:**
- Modify: `docs/superpowers/specs/2026-05-23-workflow-agent-node-design.md`

- [ ] **Step 1: 统一 `$fromAI` 分期**

在 §1.4 与 §12 将 `$fromAI` 改为 **P4-B.3**（与 `ai_outputParser`、HITL 同节）。

- [ ] **Step 2: 明确 metadata 为验收字段**

在 §8.2 增加：

```markdown
持久化字段：`node_runs.metadata` JSON，键 `agentSteps: AgentStepRecord[]`。
`outputData.json.agentSteps` 仅作调试回退，API 与 UI **优先** 读 metadata。
```

在 §9.5 增加：全量执行可通过轮询 `GET /api/executions/:id` 刷新步骤（无需 SSE）。

- [ ] **Step 3: 增加 §15 严格收尾记录**

| 日期 | 说明 |
|------|------|
| 2026-05-23 | strict-closeout 计划批准，标准 B 验收 |

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-23-workflow-agent-node-design.md
git commit -m "docs(spec): clarify agentSteps metadata and P4-B.3 scope for fromAI"
```

---

## Phase 1：AgentStepRecord 类型与归并

### Task 1: 定义 AgentStepRecord 与 chunk 归并

**Files:**
- Create: `packages/ai-runtime-stub/src/agent-steps.ts`
- Modify: `packages/ai-runtime-stub/src/index.ts`
- Create: `packages/ai-runtime-stub/src/agent-steps.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/ai-runtime-stub/src/agent-steps.test.ts
import { describe, expect, it } from 'vitest';
import { chunksToAgentSteps } from './agent-steps.js';

describe('chunksToAgentSteps', () => {
  it('merges tool_start and tool_end into one record with durationMs', () => {
    const t0 = 1000;
    const t1 = 1500;
    const steps = chunksToAgentSteps([
      { type: 'tool_start', tool: 'ListDir', input: { path: '/' }, at: t0 },
      { type: 'tool_end', tool: 'ListDir', output: { ok: true }, at: t1 },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      tool: 'ListDir',
      status: 'success',
      durationMs: 500,
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/ai-runtime-stub test -- agent-steps`  
Expected: FAIL — `chunksToAgentSteps` not found

- [ ] **Step 3: 实现 agent-steps.ts**

```typescript
// packages/ai-runtime-stub/src/agent-steps.ts
import type { AiStreamChunk } from './index.js';

export type AgentStepStatus = 'running' | 'success' | 'failed';

export interface AgentStepRecord {
  type: 'tool' | 'token' | 'agent_step';
  tool?: string;
  status: AgentStepStatus;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  content?: string;
}

export type TimestampedChunk = AiStreamChunk & { at?: number };

export function chunksToAgentSteps(chunks: TimestampedChunk[]): AgentStepRecord[] {
  const steps: AgentStepRecord[] = [];
  const open = new Map<string, { start: number; input: unknown }>();

  for (const chunk of chunks) {
    const at = chunk.at ?? Date.now();
    if (chunk.type === 'tool_start') {
      open.set(chunk.tool, { start: at, input: chunk.input });
      steps.push({
        type: 'tool',
        tool: chunk.tool,
        status: 'running',
        input: chunk.input,
      });
    } else if (chunk.type === 'tool_end') {
      const started = open.get(chunk.tool);
      const durationMs = started ? at - started.start : undefined;
      const idx = steps.findIndex(
        (s) => s.tool === chunk.tool && s.status === 'running',
      );
      if (idx >= 0) {
        steps[idx] = {
          type: 'tool',
          tool: chunk.tool,
          status: 'success',
          durationMs,
          input: started?.input,
          output: chunk.output,
        };
      } else {
        steps.push({
          type: 'tool',
          tool: chunk.tool,
          status: 'success',
          durationMs,
          output: chunk.output,
        });
      }
      open.delete(chunk.tool);
    } else if (chunk.type === 'token') {
      steps.push({ type: 'token', status: 'success', content: chunk.content });
    } else if (chunk.type === 'agent_step') {
      steps.push({ type: 'agent_step', status: 'success', output: chunk.step });
    }
  }
  for (const s of steps) {
    if (s.status === 'running') s.status = 'failed';
  }
  return steps;
}
```

- [ ] **Step 4: 在 index.ts 导出**

- [ ] **Step 5: GREEN**

Run: `pnpm --filter @rxwf/ai-runtime-stub test -- agent-steps`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ai-runtime-stub/src/agent-steps.ts packages/ai-runtime-stub/src/agent-steps.test.ts packages/ai-runtime-stub/src/index.ts
git commit -m "feat(ai-runtime-stub): AgentStepRecord and stream chunk merger"
```

---

### Task 2: NodeRunResult.metadata + 累积器

**Files:**
- Create: `packages/node-runner/src/agent-steps-accumulator.ts`
- Create: `packages/node-runner/src/agent-steps-accumulator.test.ts`
- Modify: `packages/node-runner/src/types/node-executor.ts`

- [ ] **Step 1: 扩展 NodeRunResult**

```typescript
// packages/node-runner/src/types/node-executor.ts — 在 NodeRunResult 增加
import type { AgentStepRecord } from '@rxwf/ai-runtime-stub';

export interface NodeRunResult {
  // ...existing fields
  metadata?: {
    agentSteps?: AgentStepRecord[];
  };
}
```

- [ ] **Step 2: 写累积器测试**

```typescript
import { describe, expect, it } from 'vitest';
import { createAgentStepsAccumulator } from './agent-steps-accumulator.js';

describe('createAgentStepsAccumulator', () => {
  it('collects chunks and exposes final agentSteps', () => {
    const acc = createAgentStepsAccumulator();
    acc.push({ type: 'tool_start', tool: 'T', input: {} });
    acc.push({ type: 'tool_end', tool: 'T', output: 1 });
    expect(acc.getSteps().length).toBe(1);
    expect(acc.getSteps()[0]?.status).toBe('success');
  });
});
```

- [ ] **Step 3: 实现累积器**

```typescript
import type { AiStreamChunk } from '@rxwf/ai-runtime-stub';
import { chunksToAgentSteps, type AgentStepRecord, type TimestampedChunk } from '@rxwf/ai-runtime-stub';

export function createAgentStepsAccumulator() {
  const chunks: TimestampedChunk[] = [];
  return {
    push(chunk: AiStreamChunk) {
      chunks.push({ ...chunk, at: Date.now() });
    },
    getSteps(): AgentStepRecord[] {
      return chunksToAgentSteps(chunks);
    },
    getChunks(): TimestampedChunk[] {
      return chunks;
    },
  };
}
```

- [ ] **Step 4: GREEN + Commit**

```bash
git commit -m "feat(node-runner): agent steps accumulator and NodeRunResult.metadata"
```

---

## Phase 2：DB 与持久化

### Task 3: node_runs.metadata 列（Lite）

**Files:**
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Modify: `packages/providers/lite/src/node-run-repository.ts`
- Modify: `packages/providers/lite/src/node-run-repository.test.ts`

- [ ] **Step 1: schema 增加列**

```typescript
// nodeRuns 表增加
metadata: text("metadata"),
```

- [ ] **Step 2: apply-schema 迁移**

在 `apply-schema.ts` 增加幂等：

```sql
ALTER TABLE node_runs ADD COLUMN metadata TEXT;
```

（若列已存在则忽略错误，与现有 `session_id` 迁移模式一致。）

- [ ] **Step 3: NodeRunFinishRecord 与 finish**

```typescript
metadata?: Record<string, unknown> | null;
// finish set: metadata: record.metadata ? JSON.stringify(record.metadata) : null
// list parse metadata JSON
```

- [ ] **Step 4: 写 repository 测试**

插入 pending → finish 带 `{ agentSteps: [{ type: 'tool', tool: 'X', status: 'success', durationMs: 1 }] }` → list 断言。

- [ ] **Step 5: GREEN**

Run: `pnpm --filter @rxwf/providers-lite test -- node-run-repository`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(providers-lite): persist node run metadata for agent steps"
```

---

### Task 4: 全量执行写入 metadata

**Files:**
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `packages/node-runner/src/executors/ai-agent.ts`
- Modify: `packages/execution/src/runner/execution-runner.ts`

- [ ] **Step 1: 写失败测试（api 层单测或扩展 p4b）**

在 `p4b-agent.integration.test.ts` 增加：

```typescript
it('persists agentSteps on node run metadata', async () => {
  // ...enqueue agent workflow...
  const runs = await db.select().from(nodeRunsTable).where(eq(nodeRunsTable.nodeId, 'agt'));
  const meta = runs.at(-1)?.metadata ? JSON.parse(runs.at(-1)!.metadata!) : null;
  expect(meta?.agentSteps?.length).toBeGreaterThan(0);
});
```

先 **RED**（无 metadata 列或字段）。

- [ ] **Step 2: createPersistingNodeRunExecutor 包装 onAgentStream**

```typescript
// create-execution-runtime.ts — 在 execute(job) 内
const acc =
  job.nodeType === 'aiAgent' ? createAgentStepsAccumulator() : null;
const result = await execute({
  ...job,
  onAgentStream: (chunk) => {
    acc?.push(chunk);
    job.onAgentStream?.(chunk);
  },
});
if (acc && result.status === 'success') {
  result.metadata = {
    ...result.metadata,
    agentSteps: acc.getSteps(),
  };
}
await nodeRunRepo.finish({
  // ...
  metadata: result.metadata ?? null,
});
```

- [ ] **Step 3: execution-runner 传入 engine.onAgentStream**

若 `runStoredExecution` 无 hook，在 `RunStoredExecutionInput` 增加可选 `onAgentStream`，`engine.run` 传入。

- [ ] **Step 4: ai-agent 返回 metadata 副本**

```typescript
return {
  status: 'success',
  outputItems: [...],
  metadata: {
    agentSteps: result.intermediateSteps
      ? chunksToAgentSteps(/* 若 executor 内已有 acc 可省略 */)
      : undefined,
  },
};
```

优先以 **persist 层 acc** 为准，executor 仅保证 `onStream` 被调用。

- [ ] **Step 5: GREEN p4b metadata 测试**

Run: `pnpm --filter @rxwf/api test -- p4b-agent`

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): persist agentSteps to node run metadata on full execution"
```

---

### Task 5: langchain-runtime 时间戳与失败步骤

**Files:**
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`
- Modify: `packages/ai-runtime/src/langchain-runtime.test.ts`

- [ ] **Step 1: invokeTool 失败时 onStream tool_end 或 agent_step 带 failed**

在 `catch` 中 `ctx.onStream?.({ type: 'agent_step', step: { tool: def.name, status: 'failed', message } })` 或仍抛 E3012 但 acc 已记录。

- [ ] **Step 2: 测试 mock invokeTool 失败时 steps 含 failed**

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(ai-runtime): emit failed agent steps on tool errors"
```

---

## Phase 3：API 与前端

### Task 6: executions API 返回 metadata

**Files:**
- Modify: `apps/api/src/routes/executions.ts`
- Modify: `packages/providers/lite/src/node-run-repository.ts`（`NodeRunRow` 类型）

- [ ] **Step 1: 扩展响应**

```typescript
nodeRuns: nodeRuns.map((nr) => ({
  // ...existing
  metadata: nr.metadata ?? undefined,
})),
```

- [ ] **Step 2: 手动 inject 验证**

Run: 现有 p4b 集成测断言 API 若走 inject 可补一条；或 Task 4 已从 DB 断言。

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): expose nodeRun metadata in execution detail"
```

---

### Task 7: ExecutionTimeline 读 metadata

**Files:**
- Modify: `apps/web/src/features/executions/ExecutionTimeline.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: client 类型**

```typescript
nodeRuns: Array<{
  nodeId: string;
  status: string;
  durationMs?: number;
  outputData?: unknown[][] | null;
  metadata?: { agentSteps?: AgentStepRecord[] };
}>;
```

- [ ] **Step 2: 时间线优先 metadata**

```typescript
const agentSteps =
  (nr as { metadata?: { agentSteps?: unknown[] } }).metadata?.agentSteps ??
  firstJson?.json?.agentSteps;
```

展示：`{tool} — {status} ({durationMs}ms)`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): execution timeline reads agentSteps from nodeRun metadata"
```

---

### Task 8: 全量执行轮询（SC-4）

**Files:**
- Create: `apps/web/src/features/executions/use-execution-poll.ts`
- Modify: `apps/web/src/features/executions/ExecutionTimeline.tsx`

- [ ] **Step 1: hook**

```typescript
export function useExecutionPoll(
  executionId: string | undefined,
  enabled: boolean,
  intervalMs = 2000,
) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  useEffect(() => {
    if (!executionId || !enabled) return;
    let cancelled = false;
    const tick = async () => {
      const d = await api.executions.get(executionId);
      if (!cancelled) setDetail(d);
      if (d.status === 'success' || d.status === 'failed') return;
      timer = window.setTimeout(tick, intervalMs);
    };
    let timer = window.setTimeout(tick, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [executionId, enabled, intervalMs]);
  return detail;
}
```

- [ ] **Step 2: Timeline 在 status=running 时启用 poll**

- [ ] **Step 3: 可选** — 工作流编辑器「运行工作流」后跳转 execution 页带 `?poll=1`（若已有跳转则只接 query）。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): poll execution detail for live agent steps"
```

---

### Task 9: 卫星端口颜色（§9.2 可选严格项）

**Files:**
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: CSS 变量**

```css
.workflow-handle-resource-in[data-handleid='ai_languageModel'] { border-color: #a855f7; }
.workflow-handle-resource-in[data-handleid='ai_memory'] { border-color: #3b82f6; }
.workflow-handle-resource-in[data-handleid='ai_tool'] { border-color: #22c55e; }
```

（若 React Flow 不传 data-handleid，改在 `WorkflowNode` 的 Handle 上加 `className` 后缀。）

- [ ] **Step 2: Commit**

```bash
git commit -m "style(web): color-code AI Agent satellite handles"
```

---

## Phase 4：测试与 i18n、文档

### Task 10: toolWorkflow 集成测（SC-8）

**Files:**
- Create: `apps/api/src/integration/p4b-agent-workflow-tool.integration.test.ts`

- [ ] **Step 1: 子工作流定义**

- 父：manual → aiAgent + model + toolWorkflow（指向子 flow）
- 子：manual → set（输出 `{ ok: true }`）

- [ ] **Step 2: mock runAgent + runSubworkflow**

断言 `runSubworkflow` 被调用；metadata 或 output 含子流结果。

- [ ] **Step 3: 深度 6 超限**

嵌套 6 层 toolWorkflow，断言失败码 **E2008**。

- [ ] **Step 4: Run**

`pnpm --filter @rxwf/api test -- p4b-agent-workflow`

- [ ] **Step 5: Commit**

```bash
git commit -m "test(api): agent toolWorkflow integration and depth limit"
```

---

### Task 11: Standard AC-B5（SC-7）

**Files:**
- Modify: `packages/providers/standard/src/agent-memory-repository.test.ts`
- Create: `apps/api/src/integration/p4b-agent-standard.integration.test.ts`

- [ ] **Step 1: standard memory 测试** — 已有则加强断言。

- [ ] **Step 2: 新文件** — 复制 `p4b-agent.integration.test.ts` 骨架，`beforeAll` 用 `createStandardHealthChecker` + `RXWF_DEPLOY_PROFILE=standard` + PG，无 PG 则 `skip`。

- [ ] **Step 3: README 或 docs/testing.md 一句**

「本地 Strict B：需 `RXWF_DATABASE_URL` + Postgres 跑 standard p4b。」

- [ ] **Step 4: Commit**

```bash
git commit -m "test(api): standard profile agent smoke behind postgres gate"
```

---

### Task 12: Ollama 可选门禁

**Files:**
- Create: `apps/api/src/integration/p4b-agent-ollama.integration.test.ts`

- [ ] **Step 1:**

```typescript
const runOllama = process.env.RXWF_TEST_OLLAMA === '1';
describe.skipIf(!runOllama)('P4-B agent ollama e2e', () => {
  // createExecutionRuntime WITHOUT mock ai
  // minimal agent + toolMcp or zero tools single turn
  // timeout 60s
});
```

- [ ] **Step 2: 文档** — `docs/error-codes.md` 或 plan 脚注 CI 变量。

- [ ] **Step 3: Commit**

```bash
git commit -m "test(api): optional ollama e2e for agent node"
```

---

### Task 13: i18n（SC-9）

**Files:**
- Modify: `packages/i18n-catalog/src/catalog.ts`
- Modify: `packages/i18n-catalog/src/catalog.test.ts`

- [ ] **Step 1: 增加键（zh-CN / en-US）**

| 键 | zh-CN 示例 |
|----|------------|
| `errors.E1012` | AI Agent 未连接 Chat Model |
| `errors.E1013` | AI Agent 未连接 Tool |
| `errors.E1014` | AI Agent 卫星连接无效 |
| `errors.E3010` | Agent 运行时缺少 Chat Model |
| `errors.E3011` | Agent 运行时缺少 Tool |
| `errors.E3012` | Agent Tool 执行失败 |
| `errors.E3004` | Agent 达到最大迭代次数 |
| `errors.W1011` | Workflow Tool 目标工作流未发布 |

- [ ] **Step 2: catalog.test 断言键存在**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(i18n): agent error codes E1012-E3012 and W1011"
```

---

### Task 14: RELEASE 与计划状态

**Files:**
- Create: `docs/RELEASE-v1.1-agent.md`
- Modify: `docs/superpowers/plans/2026-05-23-workflow-agent-node.md`

- [ ] **Step 1: RELEASE** — Plus Agent 子图、sessionId、三 Tool、验收命令。

- [ ] **Step 2: 原 plan 进度表** — P4-B.2 标为 strict-closeout 完成后 ✅。

- [ ] **Step 3: Commit**

```bash
git add docs/RELEASE-v1.1-agent.md docs/superpowers/plans/
git commit -m "docs: P4-B agent release notes and plan status"
```

---

## Phase 5：可选重构（不阻塞 SC-1～11）

### Task 15: 拆分 ai-runtime tools（spec §3.1 对齐）

**Files:**
- Create: `packages/ai-runtime/src/tools/mcp-tool-adapter.ts`（仅类型/文档，逻辑仍由 node-runner invoke）
- 或保持 node-runner 为唯一 invoke 点，在 spec 加注释「Tool 适配在 node-runner，ai-runtime 仅 LangGraph」。

**建议：** 本任务 **可跳过**；在 Task 0 spec 中注明实际边界，避免无效搬文件。

---

## 门禁命令

```bash
pnpm test
pnpm --filter @rxwf/api test -- p4b-agent
pnpm --filter @rxwf/web typecheck
# 本地 Strict B 附加：
RXWF_TEST_OLLAMA=1 pnpm --filter @rxwf/api test -- p4b-agent-ollama
# 有 Postgres：
RXWF_DEPLOY_PROFILE=standard RXWF_DATABASE_URL=... pnpm --filter @rxwf/api test -- p4b-agent-standard
```

---

## Spec 自检（计划 vs spec）

| Spec 章节 | 覆盖 Task |
|-----------|-----------|
| §8.2 metadata.agentSteps | 1–4, 6–7 |
| §9.5 全量可观测 | 4, 8 |
| §10 API sessionId | 已有；本计划不重复 |
| §11 集成测 | 4, 10–12 |
| §12 P4-B.3 | **排除** |
| AC-B1 | 已有 |
| AC-B2–B5 | 4, 10–12 |
| §3.1 tools 目录 | Task 15 可选 |

**Placeholder 扫描：** 无 TBD；SC-4 在 Task 8 要求实现轮询。

---

## 执行说明

完成每个 Task 后勾选 checkbox；**Task 0 → 1 → 3 → 4** 为关键路径。全部 Task 14 完成后跑门禁，对照 **严格验收签字表 SC-1～SC-11** 逐项勾选。
