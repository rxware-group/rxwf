# 沙箱 Piscina 直切与 Code 超时配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Code 沙箱从自研 WorkerPool 直切为 Piscina，并通过全局环境变量 `SANDBOX_CODE_TIMEOUT_MS` 与 Code 节点 `timeoutMs` 实现可配置超时（默认 `-1` 不超时）。

**Architecture:** `resolveCodeSandboxTimeoutMs` 在 node-runner 层解析「节点 > env > -1」；`runInSandbox` 保持对外契约，底层改为单例 Piscina + 默认导出的 `sandbox-worker`；API bootstrap 幂等写入全局 env 默认值；Web 为 Code 节点增加 `timeoutMs` 参数字段。

**Tech Stack:** TypeScript、Piscina、Vitest、Fastify、Drizzle/SQLite env_vars、React 编辑器参数 schema。

**设计依据:** [2026-05-28-sandbox-piscina-timeout-design.md](../specs/2026-05-28-sandbox-piscina-timeout-design.md)

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/node-runner/src/executors/resolve-code-sandbox-timeout.ts` | 超时解析（节点 > env > -1） |
| `packages/node-runner/src/executors/resolve-code-sandbox-timeout.test.ts` | 解析单元测试 |
| `packages/node-runner/src/executors/code.ts` | 传入 `timeoutMs` |
| `packages/sandbox/package.json` | 增加 `piscina` 依赖 |
| `packages/sandbox/src/sandbox-worker.ts` | Piscina 默认导出 handler |
| `packages/sandbox/src/run-in-sandbox.ts` | Piscina 池 + `runInSandbox` |
| `packages/sandbox/src/run-in-sandbox.test.ts` | 沙箱行为测试（含超时） |
| `apps/api/src/env/ensure-default-global-env.ts` | 幂等创建默认全局 env |
| `apps/api/src/bootstrap.ts` | 启动时调用 ensure |
| `apps/api/src/env/ensure-default-global-env.test.ts` | 种子逻辑测试 |
| `apps/web/src/features/editor/node-param-schemas.ts` | Code 节点 `timeoutMs` UI |
| `docs/README.md` | 环境变量说明 |

---

## Phase 1：超时解析（node-runner）

### Task 1: `resolveCodeSandboxTimeoutMs`

**Files:**
- Create: `packages/node-runner/src/executors/resolve-code-sandbox-timeout.ts`
- Create: `packages/node-runner/src/executors/resolve-code-sandbox-timeout.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `resolve-code-sandbox-timeout.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { resolveCodeSandboxTimeoutMs } from './resolve-code-sandbox-timeout.js';

describe('resolveCodeSandboxTimeoutMs', () => {
  it('prefers node config over env', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: 5000 }, { SANDBOX_CODE_TIMEOUT_MS: '2000' }),
    ).toBe(5000);
  });

  it('uses env when node unset', () => {
    expect(resolveCodeSandboxTimeoutMs({}, { SANDBOX_CODE_TIMEOUT_MS: '2000' })).toBe(2000);
  });

  it('node -1 disables timeout even if env is positive', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: -1 }, { SANDBOX_CODE_TIMEOUT_MS: '2000' }),
    ).toBe(-1);
  });

  it('falls back to -1 when both invalid', () => {
    expect(
      resolveCodeSandboxTimeoutMs({ timeoutMs: 'abc' }, { SANDBOX_CODE_TIMEOUT_MS: 'nope' }),
    ).toBe(-1);
  });

  it('normalizes zero and negative to -1', () => {
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: 0 }, {})).toBe(-1);
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: -5 }, {})).toBe(-1);
  });

  it('floors positive decimals', () => {
    expect(resolveCodeSandboxTimeoutMs({ timeoutMs: 1500.9 }, {})).toBe(1500);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @rxwf/node-runner test -- src/executors/resolve-code-sandbox-timeout.test.ts
```

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现解析函数**

创建 `resolve-code-sandbox-timeout.ts`：

```typescript
function parseFiniteMs(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function resolveCodeSandboxTimeoutMs(
  nodeConfig: Record<string, unknown>,
  env: Record<string, string> | undefined,
): number {
  const fromNode = parseFiniteMs(nodeConfig.timeoutMs);
  const fromEnv = parseFiniteMs(env?.SANDBOX_CODE_TIMEOUT_MS);
  const raw = fromNode ?? fromEnv ?? -1;
  if (raw <= 0) return -1;
  return Math.floor(raw);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @rxwf/node-runner test -- src/executors/resolve-code-sandbox-timeout.test.ts
```

Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add packages/node-runner/src/executors/resolve-code-sandbox-timeout.ts packages/node-runner/src/executors/resolve-code-sandbox-timeout.test.ts
git commit -m "feat(node-runner): add Code sandbox timeout resolver"
```

---

### Task 2: Code 执行器接入超时

**Files:**
- Modify: `packages/node-runner/src/executors/code.ts`

- [ ] **Step 1: 修改 `code.ts`**

```typescript
import { resolveCodeSandboxTimeoutMs } from './resolve-code-sandbox-timeout.js';

// 在 execute 内：
const timeoutMs = resolveCodeSandboxTimeoutMs(ctx.config, ctx.env);
const { json, logs } = await deps.runInSandbox({
  code,
  inputItems: ctx.inputItems,
  env: ctx.env,
  vars: ctx.vars,
  nodes: ctx.nodes,
  timeoutMs,
});
```

- [ ] **Step 2: 构建 node-runner**

```bash
pnpm --filter @rxwf/node-runner build
```

Expected: 无 TypeScript 错误

- [ ] **Step 3: Commit**

```bash
git add packages/node-runner/src/executors/code.ts
git commit -m "feat(node-runner): pass resolved timeout to Code sandbox runs"
```

---

## Phase 2：默认全局环境变量种子

### Task 3: `ensureDefaultGlobalEnv`

**Files:**
- Create: `apps/api/src/env/ensure-default-global-env.ts`
- Create: `apps/api/src/env/ensure-default-global-env.test.ts`
- Modify: `apps/api/src/bootstrap.ts`

- [ ] **Step 1: 写失败测试**

`ensure-default-global-env.test.ts`（使用内存或测试 DB；若项目有 env route 测试模式，复用 `createTestApp` 模式）：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureDefaultGlobalEnv } from './ensure-default-global-env.js';
import { createLiteEnvRepository } from '@rxwf/providers-lite';
// 使用项目现有 openLiteDb / test helper；若无则 in-memory sqlite

describe('ensureDefaultGlobalEnv', () => {
  it('creates SANDBOX_CODE_TIMEOUT_MS when missing', async () => {
    const repo = /* test env repo */;
    await ensureDefaultGlobalEnv(repo);
    const rows = await repo.listGlobalForKey('SANDBOX_CODE_TIMEOUT_MS');
    expect(rows.length).toBeGreaterThan(0);
    const testRow = rows.find((r) => r.environment === 'test');
    expect(testRow?.value).toBe('-1');
  });

  it('does not overwrite existing value', async () => {
    const repo = /* test env repo */;
    await repo.syncGlobalItem({
      key: 'SANDBOX_CODE_TIMEOUT_MS',
      value: '30000',
      sensitive: false,
      testEnabled: true,
      prodEnabled: true,
    });
    await ensureDefaultGlobalEnv(repo);
    const rows = await repo.listGlobalForKey('SANDBOX_CODE_TIMEOUT_MS');
    const testRow = rows.find((r) => r.environment === 'test');
    expect(testRow?.value).toBe('30000');
  });
});
```

> 实施时对照 `apps/api/src/routes/env.test.ts` 的 DB 初始化方式接线。

- [ ] **Step 2: 实现 ensure**

```typescript
import type { EnvRepositoryPort } from '@rxwf/env';

const SANDBOX_CODE_TIMEOUT_KEY = 'SANDBOX_CODE_TIMEOUT_MS';

export async function ensureDefaultGlobalEnv(repo: EnvRepositoryPort): Promise<void> {
  const existing = await repo.listGlobalForKey(SANDBOX_CODE_TIMEOUT_KEY);
  if (existing.length > 0) return;
  await repo.syncGlobalItem({
    key: SANDBOX_CODE_TIMEOUT_KEY,
    value: '-1',
    sensitive: false,
    testEnabled: true,
    prodEnabled: true,
  });
}
```

- [ ] **Step 3: 在 bootstrap 调用**

在 `bootstrap()` 内 `createAppContext` 成功后、返回前：

```typescript
import { ensureDefaultGlobalEnv } from './env/ensure-default-global-env.js';

// ...
await ensureDefaultGlobalEnv(ctx.envRepo);
```

- [ ] **Step 4: 运行测试**

```bash
pnpm --filter @rxwf/api test -- src/env/ensure-default-global-env.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/env/ensure-default-global-env.ts apps/api/src/env/ensure-default-global-env.test.ts apps/api/src/bootstrap.ts
git commit -m "feat(api): seed default SANDBOX_CODE_TIMEOUT_MS global env on bootstrap"
```

---

## Phase 3：Piscina 直切（sandbox）

### Task 4: 依赖与 worker 改造

**Files:**
- Modify: `packages/sandbox/package.json`
- Modify: `packages/sandbox/src/sandbox-worker.ts`

- [ ] **Step 1: 添加 piscina 依赖**

在 `packages/sandbox/package.json` 的 `dependencies` 增加：

```json
"piscina": "^5.1.3"
```

```bash
pnpm install
```

- [ ] **Step 2: 重写 sandbox-worker 为默认导出**

`packages/sandbox/src/sandbox-worker.ts` 完整替换为池模式（删除 `workerData` one-off 分支）：

```typescript
import { createLogCollector } from './log-collector.js';

interface NodeOutputEntry {
  name: string;
  json: Record<string, unknown>;
  items: { json: Record<string, unknown> }[];
}

export interface SandboxWorkerPayload {
  code: string;
  inputItems: { json: Record<string, unknown> }[];
  env: Record<string, string>;
  vars: Record<string, string>;
  nodes: NodeOutputEntry[];
}

function runCode(data: SandboxWorkerPayload) {
  const log = createLogCollector({ maxEntries: 100, maxMessageLen: 4096 });
  const $log = {
    debug: (m: unknown) => log.debug(m),
    info: (m: unknown) => log.info(m),
    warn: (m: unknown) => log.warn(m),
    error: (m: unknown) => log.error(m),
  };
  const $input = data.inputItems;
  const $env = data.env;
  const $vars = data.vars;
  const $nodes = data.nodes;
  const fn = new Function('$input', '$log', '$env', '$vars', '$nodes', data.code);
  const raw = fn($input, $log, $env, $vars, $nodes);
  const first = Array.isArray(raw) ? raw[0] : raw;
  const json =
    first && typeof first === 'object' && 'json' in first
      ? (first as { json: Record<string, unknown> }).json
      : (first as Record<string, unknown>) ?? {};
  return { ok: true as const, json, logs: log.entries() };
}

export default function sandboxWorker(payload: SandboxWorkerPayload) {
  try {
    return runCode(payload);
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
```

- [ ] **Step 3: 构建 sandbox**

```bash
pnpm --filter @rxwf/sandbox build
```

确认 `dist/sandbox-worker.js` 含 default export。

- [ ] **Step 4: Commit**

```bash
git add packages/sandbox/package.json packages/sandbox/src/sandbox-worker.ts pnpm-lock.yaml
git commit -m "refactor(sandbox): prepare worker for Piscina default export"
```

---

### Task 5: `runInSandbox` 改用 Piscina

**Files:**
- Modify: `packages/sandbox/src/run-in-sandbox.ts`

- [ ] **Step 1: 替换 run-in-sandbox.ts**

删除整个 `WorkerPool` 类，改为：

```typescript
import Piscina from 'piscina';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { AwfError } from '@rxwf/shared';
import type { NodeOutputEntry } from '@rxwf/expression';
import type { WorkflowItem } from '@rxwf/shared';
import type { SandboxLogEntry } from './log-collector.js';
import type { SandboxWorkerPayload } from './sandbox-worker.js';

export interface SandboxRunInput {
  code: string;
  inputItems: WorkflowItem[];
  timeoutMs?: number;
  env?: Record<string, string>;
  vars?: Record<string, string>;
  nodes?: NodeOutputEntry[];
}

export interface SandboxRunResult {
  json: Record<string, unknown>;
  logs: SandboxLogEntry[];
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

const workerFile = fileURLToPath(new URL('../dist/sandbox-worker.js', import.meta.url));

const pool = new Piscina({
  filename: workerFile,
  minThreads: readPositiveInt('RXWF_SANDBOX_POOL_MIN_THREADS', 1),
  maxThreads: readPositiveInt('RXWF_SANDBOX_POOL_MAX_THREADS', Math.max(2, cpus().length - 1)),
  idleTimeout: readPositiveInt('RXWF_SANDBOX_POOL_IDLE_TIMEOUT_MS', 30_000),
  maxQueue: readPositiveInt('RXWF_SANDBOX_POOL_QUEUE_LIMIT', 0) || undefined,
});

type WorkerResult =
  | { ok: true; json: Record<string, unknown>; logs: SandboxLogEntry[] }
  | { ok: false; message: string };

function toPayload(input: SandboxRunInput): SandboxWorkerPayload {
  return {
    code: input.code,
    inputItems: input.inputItems,
    env: input.env ?? {},
    vars: input.vars ?? {},
    nodes: input.nodes ?? [],
  };
}

export async function runInSandbox(input: SandboxRunInput): Promise<SandboxRunResult> {
  const timeoutMs = input.timeoutMs;
  const runOptions =
    timeoutMs != null && timeoutMs > 0 ? { timeout: timeoutMs } : {};

  try {
    const msg = (await pool.run(toPayload(input), runOptions)) as WorkerResult;
    if (msg.ok && msg.json) {
      return { json: msg.json, logs: msg.logs ?? [] };
    }
    throw new AwfError('E2002', msg.message ?? 'Sandbox failed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('Timeout') ||
      message.includes('timed out') ||
      message.includes('Task timed out')
    ) {
      throw new AwfError('E2002', 'Sandbox execution timed out');
    }
    if (err instanceof AwfError) throw err;
    throw new AwfError('E2002', message);
  }
}

export async function shutdownSandboxPool(): Promise<void> {
  await pool.destroy();
}
```

> 若 `maxQueue: 0` 在 Piscina 中表示无限制，用 `|| undefined` 省略该字段；以 Piscina 文档为准微调。

- [ ] **Step 2: 运行现有 sandbox 测试**

```bash
pnpm --filter @rxwf/sandbox test
```

Expected: 现有用例全部 PASS

- [ ] **Step 3: 新增超时测试**

在 `run-in-sandbox.test.ts` 追加：

```typescript
  it('times out with E2002 when timeoutMs is positive and code loops', async () => {
    await expect(
      runInSandbox({
        code: 'while (true) {} return [{ json: {} }];',
        inputItems: [{ json: {} }],
        timeoutMs: 200,
      }),
    ).rejects.toMatchObject({
      code: 'E2002',
      message: 'Sandbox execution timed out',
    });
  });

  it('does not time out when timeoutMs is -1', async () => {
    const result = await runInSandbox({
      code: 'return [{ json: { ok: true } }];',
      inputItems: [{ json: {} }],
      timeoutMs: -1,
    });
    expect(result.json).toEqual({ ok: true });
  });
```

- [ ] **Step 4: 再次运行 sandbox 测试**

```bash
pnpm --filter @rxwf/sandbox test
```

- [ ] **Step 5: Commit**

```bash
git add packages/sandbox/src/run-in-sandbox.ts packages/sandbox/src/run-in-sandbox.test.ts
git commit -m "refactor(sandbox): replace WorkerPool with Piscina"
```

---

## Phase 4：前端与文档

### Task 6: Code 节点 `timeoutMs` 参数

**Files:**
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`

- [ ] **Step 1: 在 `code` schema 增加字段**

在 `jsCode` 字段后追加：

```typescript
    {
      key: 'timeoutMs',
      label: '超时 (ms)',
      type: 'number',
      placeholder: '-1 表示不超时',
    },
```

- [ ] **Step 2: 手动验证**

启动 `pnpm dev`，打开 Code 节点参数面板，确认出现「超时 (ms)」输入框；新建节点保存后 `parameters.timeoutMs` 可为空或 `-1`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/node-param-schemas.ts
git commit -m "feat(web): add timeoutMs field to Code node parameters"
```

---

### Task 7: 文档更新

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/queue-concurrency-optimization-summary.md`（沙箱节改为已实现）

- [ ] **Step 1: README 环境变量表追加**

| `SANDBOX_CODE_TIMEOUT_MS` | Code 沙箱默认超时（毫秒）；`-1` 不超时；可在设置→环境变量修改 |
| `RXWF_SANDBOX_POOL_MIN_THREADS` | Piscina 最小线程（默认 `1`） |
| `RXWF_SANDBOX_POOL_MAX_THREADS` | Piscina 最大线程（默认 `max(2, cpu-1)`） |
| `RXWF_SANDBOX_POOL_IDLE_TIMEOUT_MS` | 空闲线程回收（默认 `30000`） |
| `RXWF_SANDBOX_POOL_QUEUE_LIMIT` | 池队列上限；`0` 不限制 |

- [ ] **Step 2: 更新优化总结文档沙箱状态**

- [ ] **Step 3: Commit**

```bash
git add docs/README.md docs/queue-concurrency-optimization-summary.md
git commit -m "docs: document sandbox timeout and Piscina pool env vars"
```

---

## Phase 5：集成验证

### Task 8: 全量回归

- [ ] **Step 1: 包级测试**

```bash
pnpm --filter @rxwf/sandbox test
pnpm --filter @rxwf/node-runner test
pnpm --filter @rxwf/api test -- src/env/ensure-default-global-env.test.ts
```

- [ ] **Step 2: 构建关键包**

```bash
pnpm --filter @rxwf/sandbox build
pnpm --filter @rxwf/node-runner build
```

- [ ] **Step 3: 手动冒烟**

1. `pnpm dev`，设置→环境变量确认存在 `SANDBOX_CODE_TIMEOUT_MS=-1`
2. Code 节点设 `timeoutMs=2000`，脚本 `while(true){}` → 执行应失败 `E2002` 超时
3. Code 节点 `timeoutMs=-1`，简单 `return [{json:{ok:true}}]` → 成功

- [ ] **Step 4: 更新 spec 状态为 Implemented（可选）**

`docs/superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md` 表头状态改为 Implemented。

- [ ] **Step 5: Commit（若有文档状态变更）**

```bash
git add docs/superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md
git commit -m "docs: mark sandbox Piscina timeout spec as implemented"
```

---

## Spec 覆盖自检

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 无 legacy 直切 Piscina | Task 4–5 |
| `SANDBOX_CODE_TIMEOUT_MS` 默认种子 | Task 3 |
| Code 节点 `timeoutMs` | Task 6 |
| 优先级 节点 > env > -1 | Task 1–2 |
| `E2002` 超时语义 | Task 5 测试 |
| 非法配置回退 | Task 1 测试 |
| 文档 | Task 7 |
| Piscina 池 env 参数 | Task 5 + Task 7 |

---

## 执行方式选择

计划已保存至 `docs/superpowers/plans/2026-05-28-sandbox-piscina-timeout.md`。

**1. Subagent-Driven（推荐）** — 每个 Task 派生子 agent，任务间做审查，迭代快。

**2. Inline Execution** — 在本会话按 Task 顺序直接实现，阶段性 checkpoint 给你确认。

你想用哪种方式开始实施？

