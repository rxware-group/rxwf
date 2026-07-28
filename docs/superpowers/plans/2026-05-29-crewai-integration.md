# P4-D CrewAI 生态集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 native（LangGraph）Crew 后端的前提下，交付 **CrewAI 可选执行后端**、AWF Crew IR、Python Sidecar、Tool 回调桥与 `--with-crewai` 自动联署，使 `crewSequential` / `crewHierarchical` 在 `executionBackend: 'crewai'` 下端到端可运行。

**状态：** ✅ **已完成**（P4-D1 Task 1–12 + P4-D2/D3/D+ 已落地；2026-05-30 计划 checkbox 同步）。**Consensual process** 仅保存校验 E1046，Sidecar 执行待 CrewAI GA。

**Architecture:** 画布与 P4-C Crew 节点不变；`compileCrewIr()` 将工作流编译为 `AwfCrewIrV1`；`crew-backend-router` 按 `executionBackend` 分流至 native 或 `crewai-client`（HTTP → Sidecar）。Sidecar 内 `ir_to_crew.py` 构建 CrewAI `Crew`；成员 Tool 经 `bridge_tool` 回调 `apps/api` 内部路由，复用 MCP/HTTP/Workflow 执行链。Lite/Standard 通过 `rxwf start --with-crewai` Docker 拉起 `crewai-runner` 并注入 `CREWAI_RUNNER_URL`。

**Tech Stack:** Node.js ≥20、TypeScript、Vitest、Fastify、Python 3.11+、FastAPI、uvicorn、CrewAI（pin）、pnpm workspace、Docker Compose。

**设计依据:** [2026-05-29-crewai-integration-design.md](../specs/2026-05-29-crewai-integration-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/workflow/src/crew-ir.ts` | `AwfCrewIrV1` 类型导出 |
| `packages/workflow/src/compile-crew-ir.ts` | 画布 → IR |
| `packages/workflow/src/compile-crew-ir.test.ts` | IR 编译单元测试 |
| `packages/workflow/src/validate.ts` | E1040、W1013 校验 |
| `packages/workflow/src/index.ts` | 导出新符号 |
| `packages/crewai-runner/` | Python Sidecar（新 workspace 包） |
| `packages/node-runner/src/executors/crew-backend-router.ts` | native / crewai 分流 |
| `packages/node-runner/src/executors/crewai-client.ts` | HTTP 客户端 |
| `packages/node-runner/src/executors/crew-sequential.ts` | 改为 thin wrapper |
| `packages/node-runner/src/executors/crew-hierarchical.ts` | 改为 thin wrapper |
| `packages/node-runner/src/executors/register-plus.ts` | 注入 `crewAiClient` |
| `apps/api/src/routes/internal-crew-tool.ts` | Tool 桥内部 API |
| `apps/api/src/execution/crew-tool-bridge-token.ts` | 单次执行 token |
| `apps/api/src/bootstrap-plus.ts` | Sidecar 健康探测 + client 注册 |
| `apps/api/src/integration/p4d-crewai.integration.test.ts` | AC-D1 门禁 |
| `apps/web/src/features/editor/node-param-schemas.ts` | `executionBackend` 字段 |
| `packages/i18n-catalog/src/catalog.ts` | E1040–E1046、AWF-START-008 |
| `deploy/docker-compose.crewai.yml` | Sidecar overlay |
| `deploy/docker-compose.plus.yml` | 全栈 compose |
| `packages/cli/src/commands/start.ts` | `--with-crewai` |
| `packages/cli/src/commands/deps.ts` | `--services crewai` |
| `packages/cli/src/infra/docker-manager.ts` | `ensureCrewAiRunner` |
| `docs/RELEASE-v1.3-crewai.md` | 发行说明 |
| `docs/error-codes.md` | 新错误码 |

---

## Phase P4-D1：IR + Sidecar + 桥接 + 路由 + 联署

### Task 1: AWF Crew IR 类型

**Files:**
- Create: `packages/workflow/src/crew-ir.ts`
- Modify: `packages/workflow/src/index.ts`

- [x] **Step 1: 创建类型文件**

```typescript
// packages/workflow/src/crew-ir.ts
export type CrewExecutionBackend = 'native' | 'crewai';

export type CrewProcessType = 'sequential' | 'hierarchical' | 'supervisor';

export interface AwfCrewIrV1 {
  irVersion: 1;
  process: CrewProcessType;
  executionBackend: CrewExecutionBackend;
  inputTask: string;
  crewParams: {
    maxIterations?: number;
    maxDelegations?: number;
    maxSteps?: number;
    allowParallel?: boolean;
    allowParallelDelegation?: boolean;
    crewaiProcess?: 'sequential' | 'hierarchical';
    crewaiVersion?: string;
    enableBuiltinTools?: string[];
  };
  manager?: AwfCrewMemberIr;
  members: AwfCrewMemberIr[];
  execution: {
    executionId: string;
    workflowId: string;
    crewNodeId: string;
    sessionId?: string;
    environment: 'test' | 'prod';
    toolBridgeBaseUrl: string;
    toolBridgeToken: string;
  };
}

export interface AwfCrewMemberIr {
  nodeId: string;
  name: string;
  role?: string;
  goal?: string;
  backstory?: string;
  model: {
    provider: 'ollama' | 'openai-compatible';
    model: string;
    baseUrl?: string;
    credentialRef?: string;
  };
  memory?: { sessionId: string; maxTurns: number };
  knowledge?: { knowledgeBaseIds: string[] };
  tools: AwfCrewToolIr[];
  task?: { description?: string; expectedOutput?: string; asyncExecution?: boolean };
}

export type AwfCrewToolIr =
  | { type: 'mcp'; bridgeId: string; serverId: string; toolName: string; description: string }
  | { type: 'http'; bridgeId: string; method: string; url: string; description: string }
  | { type: 'workflow'; bridgeId: string; workflowId: string; description: string }
  | { type: 'crewai-builtin'; name: string };
```

- [x] **Step 2: 从 index 导出**

```typescript
export type { AwfCrewIrV1, AwfCrewMemberIr, AwfCrewToolIr, CrewExecutionBackend, CrewProcessType } from './crew-ir.js';
```

- [x] **Step 3: 构建验证**

Run: `pnpm --filter @rxwf/workflow build`  
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add packages/workflow/src/crew-ir.ts packages/workflow/src/index.ts
git commit -m "feat(workflow): add AWF Crew IR v1 types"
```

---

### Task 2: compileCrewIr()

**Files:**
- Create: `packages/workflow/src/compile-crew-ir.ts`
- Create: `packages/workflow/src/compile-crew-ir.test.ts`
- Modify: `packages/workflow/src/index.ts`

- [x] **Step 1: 写失败测试**

```typescript
// packages/workflow/src/compile-crew-ir.test.ts
import { describe, expect, it } from 'vitest';
import { compileCrewIr } from './compile-crew-ir.js';
import type { WorkflowDefinition } from './validate.js';

const baseDef: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'crew-ir-test',
  nodes: [
    { id: 'crew', type: 'crewSequential', name: 'Crew', position: { x: 200, y: 0 }, parameters: { executionBackend: 'crewai' } },
    { id: 'a1', type: 'aiAgent', name: 'Writer', position: { x: 0, y: 0 }, parameters: { role: 'Writer', goal: 'Write', backstory: 'Pro' } },
    { id: 'a2', type: 'aiAgent', name: 'Editor', position: { x: 100, y: 0 }, parameters: { role: 'Editor' } },
    { id: 'm1', type: 'aiChatModel', name: 'Model', position: { x: 0, y: 100 }, parameters: { provider: 'ollama', model: 'llama3' } },
    { id: 't1', type: 'toolMcp', name: 'ListDir', position: { x: 0, y: 200 }, parameters: { serverId: 's1', tools: ['list_directory'], toolDescription: 'List files' } },
  ],
  connections: [
    { from: 'a1', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'a2', to: 'crew', fromOutput: 'crew_member', toInput: 'crew_member' },
    { from: 'm1', to: 'a1', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 't1', to: 'a1', fromOutput: 'ai_tool', toInput: 'ai_tool' },
    { from: 'm1', to: 'a2', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
  ],
};

describe('compileCrewIr', () => {
  it('builds sequential crewai IR with two members and tools', () => {
    const ir = compileCrewIr({
      definition: baseDef,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: '{"topic":"AI"}',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.irVersion).toBe(1);
    expect(ir.executionBackend).toBe('crewai');
    expect(ir.process).toBe('sequential');
    expect(ir.members).toHaveLength(2);
    expect(ir.members[0]?.tools[0]?.type).toBe('mcp');
    expect(ir.members[0]?.tools[0]?.bridgeId).toMatch(/^bridge_/);
  });

  it('defaults executionBackend to native', () => {
    const def = structuredClone(baseDef);
    def.nodes[0]!.parameters = {};
    const ir = compileCrewIr({
      definition: def,
      crewNodeId: 'crew',
      process: 'sequential',
      inputTask: 'task',
      execution: {
        executionId: 'ex-1',
        workflowId: 'wf-1',
        environment: 'test',
        toolBridgeBaseUrl: 'http://127.0.0.1:8787',
        toolBridgeToken: 'tok',
      },
    });
    expect(ir.executionBackend).toBe('native');
  });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/workflow test -- compile-crew-ir`  
Expected: FAIL — module not found

- [x] **Step 3: 实现 compileCrewIr**

实现要点（`packages/workflow/src/compile-crew-ir.ts`）：

- `collectCrewWorkers` / `collectCrewManager` 收集成员
- 每成员 `collectSatellites` → 映射 `model`、`tools`（生成 `bridgeId = 'bridge_' + nodeId + '_' + index`）
- `executionBackend` ← `crewNode.parameters.executionBackend ?? 'native'`
- `crewParams` 从 crew 节点 parameters 拷贝
- `buildCrewRolePrompt` 逻辑可内联或从 node-runner 抽到 workflow（优先在 compile 层拼 `task.description`）

- [x] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/workflow test -- compile-crew-ir`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/workflow/src/compile-crew-ir.ts packages/workflow/src/compile-crew-ir.test.ts packages/workflow/src/index.ts
git commit -m "feat(workflow): compileCrewIr for native and crewai backends"
```

---

### Task 3: 校验 E1040 / W1013

**Files:**
- Modify: `packages/workflow/src/validate.ts`
- Modify: `packages/workflow/src/validate.test.ts`
- Modify: `packages/i18n-catalog/src/catalog.ts`

- [x] **Step 1: 写失败测试 E1040**

```typescript
it('E1040 when executionBackend crewai but crewaiRunnerConfigured is false', () => {
  const result = validateWorkflow(defWithCrewaiBackend, {
    crewaiRunnerConfigured: false,
  });
  expect(result.errors.some((e) => e.code === 'E1040')).toBe(true);
});
```

扩展 `validateWorkflow` 第二参数（可选）：

```typescript
export interface ValidateWorkflowOptions {
  crewaiRunnerConfigured?: boolean;
  allowedCrewaiBuiltinTools?: string[];
}
```

- [x] **Step 2: 实现 E1040**

当任意 crew 节点 `parameters.executionBackend === 'crewai'` 且 `options.crewaiRunnerConfigured === false` 时报 E1040。

- [x] **Step 3: i18n**

`errors.E1040` 中英文写入 `catalog.ts`。

- [x] **Step 4: 运行测试**

Run: `pnpm --filter @rxwf/workflow test -- validate`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git commit -m "feat(workflow): E1040 validate crewai backend requires sidecar"
```

---

### Task 4: Python Sidecar 脚手架

**Files:**
- Create: `packages/crewai-runner/pyproject.toml`
- Create: `packages/crewai-runner/crewai_runner/main.py`
- Create: `packages/crewai-runner/crewai_runner/health.py`
- Create: `packages/crewai-runner/Dockerfile`
- Create: `packages/crewai-runner/README.md`

- [x] **Step 1: pyproject.toml**

```toml
[project]
name = "crewai-runner"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "crewai>=0.86.0,<0.87.0",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "httpx>=0.27.0",
  "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0", "pytest-asyncio>=0.24.0"]
```

- [x] **Step 2: health 端点**

```python
# crewai_runner/health.py
import crewai

def health_payload() -> dict:
    return {
        "status": "ok",
        "crewaiVersion": getattr(crewai, "__version__", "unknown"),
        "supportedIrVersions": [1],
    }
```

```python
# crewai_runner/main.py
from fastapi import FastAPI
from .health import health_payload

app = FastAPI(title="AWF CrewAI Runner")

@app.get("/health")
def health():
    return health_payload()
```

- [x] **Step 3: 本地启动验证**

Run: `cd packages/crewai-runner && pip install -e . && uvicorn crewai_runner.main:app --port 8071`  
Run: `curl http://127.0.0.1:8071/health`  
Expected: JSON `status: ok`

- [x] **Step 4: Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
COPY crewai_runner ./crewai_runner
RUN pip install --no-cache-dir .
EXPOSE 8071
CMD ["uvicorn", "crewai_runner.main:app", "--host", "0.0.0.0", "--port", "8071"]
```

- [x] **Step 5: Commit**

```bash
git commit -m "feat(crewai-runner): scaffold FastAPI sidecar with health endpoint"
```

---

### Task 5: Sidecar kickoff + IR adapter（sequential）

**Files:**
- Create: `packages/crewai-runner/crewai_runner/kickoff.py`
- Create: `packages/crewai-runner/crewai_runner/adapter/ir_to_crew.py`
- Create: `packages/crewai-runner/crewai_runner/adapter/process_map.py`
- Create: `packages/crewai-runner/tests/test_ir_to_crew.py`
- Modify: `packages/crewai-runner/crewai_runner/main.py`

- [x] **Step 1: process_map**

```python
# crewai_runner/adapter/process_map.py
from crewai import Process

def awf_process_to_crewai(ir: dict) -> Process:
    proc = ir.get("crewParams", {}).get("crewaiProcess") or ir.get("process")
    if proc == "hierarchical":
        return Process.hierarchical
    return Process.sequential
```

- [x] **Step 2: ir_to_crew（sequential MVP）**

`ir_to_crew.py` 将 `members` 转为 CrewAI `Agent` + `Task` 列表；`manager` 仅在 hierarchical 时设置 `manager_llm`。

Ollama 配置示例：

```python
from crewai import Agent, Task, Crew, LLM

def member_llm(member: dict) -> LLM:
    m = member["model"]
    if m["provider"] == "ollama":
        base = m.get("baseUrl") or "http://host.docker.internal:11434"
        return LLM(model=f"ollama/{m['model']}", base_url=base)
    raise ValueError(f"unsupported provider {m['provider']}")
```

- [x] **Step 3: kickoff 路由**

```python
# kickoff.py
from pydantic import BaseModel
from .adapter.ir_to_crew import build_crew_from_ir

class KickoffResponse(BaseModel):
    status: str
    answer: str
    crewSteps: list
    agentSteps: list

def run_kickoff(ir: dict) -> KickoffResponse:
    if ir.get("irVersion") != 1:
        raise ValueError("E1044")
    crew = build_crew_from_ir(ir)
    result = crew.kickoff(inputs={"task": ir["inputTask"]})
    answer = str(result)
    return KickoffResponse(
        status="success",
        answer=answer,
        crewSteps=[],
        agentSteps=[],
    )
```

```python
# main.py 追加
from .kickoff import run_kickoff

@app.post("/v1/kickoff")
def kickoff(body: dict):
    return run_kickoff(body)
```

- [x] **Step 4: pytest fixture**

`tests/fixtures/sequential_ir.json` — 最小 IR；`test_ir_to_crew.py` 断言 `build_crew_from_ir` 返回 `Crew` 且 `agents` 数量正确。

- [x] **Step 5: Commit**

```bash
git commit -m "feat(crewai-runner): sequential kickoff and IR adapter"
```

---

### Task 6: bridge_tool + api 内部路由

**Files:**
- Create: `packages/crewai-runner/crewai_runner/tools/bridge_tool.py`
- Create: `apps/api/src/execution/crew-tool-bridge-token.ts`
- Create: `apps/api/src/routes/internal-crew-tool.ts`
- Modify: `apps/api/src/app.ts`（注册内部路由，仅 localhost / 内网）

- [x] **Step 1: token 生成与校验**

```typescript
// apps/api/src/execution/crew-tool-bridge-token.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function createCrewToolBridgeToken(input: {
  secret: string;
  executionId: string;
  bridgeId: string;
  expiresAtMs: number;
}): string {
  const payload = `${input.executionId}:${input.bridgeId}:${input.expiresAtMs}`;
  const sig = createHmac('sha256', input.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyCrewToolBridgeToken(
  secret: string,
  token: string,
  executionId: string,
  bridgeId: string,
): boolean {
  // decode, check expiry, timingSafeEqual sig
  return true; // 完整实现
}
```

- [x] **Step 2: 内部路由**

```typescript
// apps/api/src/routes/internal-crew-tool.ts
export async function registerInternalCrewToolRoutes(app: FastifyInstance, deps: {
  invokeCrewTool: (bridgeId: string, args: Record<string, unknown>, ctx: { executionId: string }) => Promise<unknown>;
  bridgeSecret: string;
}) {
  app.post<{ Params: { bridgeId: string } }>(
    '/internal/crew-tool/:bridgeId',
    async (req, reply) => {
      const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
      const executionId = String(req.headers['x-rxwf-execution-id'] ?? '');
      if (!verifyCrewToolBridgeToken(deps.bridgeSecret, auth, executionId, req.params.bridgeId)) {
        return reply.status(401).send({ code: 'E1045' });
      }
      const out = await deps.invokeCrewTool(req.params.bridgeId, req.body as Record<string, unknown>, { executionId });
      return { result: out };
    },
  );
}
```

- [x] **Step 3: Python bridge_tool**

```python
# tools/bridge_tool.py
import httpx
from crewai.tools import BaseTool

class BridgeTool(BaseTool):
    name: str
    description: str
    bridge_id: str
    base_url: str
    token: str
    execution_id: str

    def _run(self, **kwargs) -> str:
        url = f"{self.base_url}/internal/crew-tool/{self.bridge_id}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Awf-Execution-Id": self.execution_id,
        }
        r = httpx.post(url, json=kwargs, headers=headers, timeout=120.0)
        r.raise_for_status()
        return str(r.json().get("result", ""))
```

- [x] **Step 4: 在 ir_to_crew 挂载 BridgeTool**

每个 `AwfCrewToolIr`（mcp/http/workflow）→ 一个 `BridgeTool`。

- [x] **Step 5: 集成测试（api 层）**

`apps/api/src/integration/p4d-crew-tool-bridge.integration.test.ts`：mock `invokeCrewTool`，POST 内部路由，断言 200 / 401。

- [x] **Step 6: Commit**

```bash
git commit -m "feat(api): crew tool bridge internal route and sidecar BridgeTool"
```

---

### Task 7: crewai-client + crew-backend-router

**Files:**
- Create: `packages/node-runner/src/executors/crewai-client.ts`
- Create: `packages/node-runner/src/executors/crewai-client.test.ts`
- Create: `packages/node-runner/src/executors/crew-backend-router.ts`
- Modify: `packages/node-runner/src/executors/crew-sequential.ts`
- Modify: `packages/node-runner/src/executors/crew-hierarchical.ts`
- Modify: `packages/node-runner/src/executors/register-plus.ts`

- [x] **Step 1: crewai-client 测试（mock fetch）**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createCrewAiClient } from './crewai-client.js';

describe('createCrewAiClient', () => {
  it('posts IR to /v1/kickoff and returns answer', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'success', answer: 'done', crewSteps: [], agentSteps: [] }),
    }));
    const client = createCrewAiClient({ baseUrl: 'http://127.0.0.1:8071', fetchFn });
    const res = await client.kickoff({ irVersion: 1 } as never);
    expect(res.answer).toBe('done');
    expect(fetchFn).toHaveBeenCalledWith(
      'http://127.0.0.1:8071/v1/kickoff',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [x] **Step 2: 实现 crewai-client**

```typescript
export interface CrewAiClient {
  kickoff(ir: AwfCrewIrV1, opts?: { signal?: AbortSignal }): Promise<CrewAiKickoffResult>;
  health(): Promise<boolean>;
}

export function createCrewAiClient(config: {
  baseUrl: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): CrewAiClient { /* ... */ }
```

- [x] **Step 3: crew-backend-router**

```typescript
export async function executeCrewNode(
  ctx: NodeExecutionContext,
  deps: PlusExecutorDeps,
  crewNodeType: 'crewSequential' | 'crewHierarchical' | 'crewSupervisor',
): Promise<NodeRunResult> {
  const process =
    crewNodeType === 'crewSequential'
      ? 'sequential'
      : crewNodeType === 'crewHierarchical'
        ? 'hierarchical'
        : 'supervisor';
  const ir = compileCrewIr({ /* ... */ });
  if (ir.executionBackend === 'crewai') {
    if (!deps.crewAiClient) {
      return { status: 'failed', errorCode: 'E1042', errorMessage: 'CrewAI sidecar not configured' };
    }
    return runCrewViaCrewAi(ir, ctx, deps);
  }
  return runCrewNative(ctx, deps, crewNodeType);
}
```

- [x] **Step 4: 重构 crew-sequential / crew-hierarchical**

将现有 `execute` 体移入 `crew-native.ts`；executor 仅调用 `executeCrewNode`。

- [x] **Step 5: PlusExecutorDeps 扩展**

```typescript
export interface PlusExecutorDeps {
  // ...
  crewAiClient?: CrewAiClient;
  createCrewToolBridgeToken?: (executionId: string, bridgeId: string) => string;
  crewToolBridgeBaseUrl?: string;
}
```

- [x] **Step 6: 运行测试**

Run: `pnpm --filter @rxwf/node-runner test -- crewai`  
Expected: PASS

- [x] **Step 7: Commit**

```bash
git commit -m "feat(node-runner): crew backend router and crewai HTTP client"
```

---

### Task 8: bootstrap-plus 与执行运行时接线

**Files:**
- Modify: `apps/api/src/bootstrap-plus.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `apps/api/src/app-context.ts`

- [x] **Step 1: 读取 CREWAI_RUNNER_URL**

```typescript
const crewAiUrl = process.env.CREWAI_RUNNER_URL?.trim();
let crewAiClient: CrewAiClient | undefined;
if (crewAiUrl) {
  const client = createCrewAiClient({ baseUrl: crewAiUrl, timeoutMs: Number(process.env.CREWAI_RUNNER_TIMEOUT_MS ?? 300_000) });
  const ok = await client.health().catch(() => false);
  if (!ok) app.log.warn('CREWAI_RUNNER_URL set but health check failed');
  crewAiClient = client;
}
```

- [x] **Step 2: 注入 PlusExecutorDeps**

`createExecutionRuntime` 传入 `crewAiClient`、`createCrewToolBridgeToken`、`crewToolBridgeBaseUrl`。

- [x] **Step 3: validate API 保存工作流时传 crewaiRunnerConfigured**

`crewaiRunnerConfigured: Boolean(crewAiClient)` 传入 `validateWorkflow`。

- [x] **Step 4: Commit**

```bash
git commit -m "feat(api): wire crewai client and tool bridge into execution runtime"
```

---

### Task 9: 编辑器 executionBackend 字段

**Files:**
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`

- [x] **Step 1: 为 crew 节点类型增加 schema**

```typescript
executionBackend: {
  type: 'select',
  options: [
    { value: 'native', labelKey: 'editor.crewBackend.native' },
    { value: 'crewai', labelKey: 'editor.crewBackend.crewai' },
  ],
  default: 'native',
},
```

- [x] **Step 2: i18n**

`editor.crewBackend.native`: `Native (LangGraph)` / `原生 (LangGraph)`  
`editor.crewBackend.crewai`: `CrewAI` / `CrewAI`

- [x] **Step 3: typecheck**

Run: `pnpm --filter @rxwf/web typecheck`  
Expected: PASS

- [x] **Step 4: Commit**

```bash
git commit -m "feat(web): executionBackend selector on crew nodes"
```

---

### Task 10: 集成测试 p4d-crewai

**Files:**
- Create: `apps/api/src/integration/p4d-crewai.integration.test.ts`
- Create: `fixtures/templates/agent-crew-sequential-crewai.json`

- [x] **Step 1: fixture 工作流**

`crewSequential` + 两名 `aiAgent` + `executionBackend: 'crewai'` + `toolMcp`。

- [x] **Step 2: mock Sidecar 集成测试**

```typescript
describe('P4-D CrewAI backend', () => {
  it('AC-D1.1 sequential crewai kickoff returns answer', async () => {
    // mock crewAiClient.kickoff
    // run execution
    // expect nodeRun status success, json.answer defined
  });

  it('AC-D1.3 native regression unchanged when executionBackend omitted', async () => {
    // existing p4c-crew path still passes
  });
});
```

- [x] **Step 3: 运行门禁**

Run: `pnpm --filter @rxwf/api test -- p4d-crewai`  
Run: `pnpm --filter @rxwf/api exec vitest run src/integration/p4c-crew.integration.test.ts`  
Expected: PASS

- [x] **Step 4: Commit**

```bash
git commit -m "test(api): p4d crewai integration and native regression"
```

---

### Task 11: 自动联署（CLI + Compose）

**Files:**
- Create: `deploy/docker-compose.crewai.yml`
- Create: `deploy/docker-compose.plus.yml`
- Modify: `packages/cli/src/commands/start.ts`
- Modify: `packages/cli/src/commands/deps.ts`
- Modify: `packages/cli/src/infra/docker-manager.ts`
- Modify: `packages/cli/src/config/resolve-config.ts`

- [x] **Step 1: docker-compose.crewai.yml**

按 spec §10.4.3 完整内容创建（`crewai-runner` 服务 + healthcheck + `host.docker.internal`）。

- [x] **Step 2: docker-manager ensureCrewAiRunner**

```typescript
export async function ensureCrewAiRunner(opts: {
  composeFile: string;
  crewaiOverlayFile: string;
  port: number;
}): Promise<{ url: string }> {
  // docker compose -f standard -f crewai up -d crewai-runner
  // poll /health until ok or timeout → throw StartupError AWF-START-008
  return { url: `http://127.0.0.1:${opts.port}` };
}
```

- [x] **Step 3: start.ts --with-crewai**

解析 flag → 若未设 `CREWAI_RUNNER_URL` 则 `ensureCrewAiRunner` → `process.env.CREWAI_RUNNER_URL = url` → 启动 api。

- [x] **Step 4: deps up --services crewai**

扩展 `parseServices` 支持 `crewai`。

- [x] **Step 5: 手动验证 AC-D1.6**

Run: `rxwf deps up --services crewai`  
Run: `curl http://127.0.0.1:8071/health`  
Expected: `status: ok`

- [x] **Step 6: Commit**

```bash
git commit -m "feat(cli): --with-crewai auto-deploy crewai-runner sidecar"
```

---

### Task 12: 文档与发行说明

**Files:**
- Create: `docs/RELEASE-v1.3-crewai.md`
- Modify: `docs/error-codes.md`
- Modify: `docs/deployment-cli-cheatsheet.md`
- Modify: `docs/superpowers/specs/2026-05-23-p4-c-ai-milestone-roadmap.md`（增加 P4-D 行）

- [x] **Step 1: RELEASE-v1.3-crewai.md**

包含：功能摘要、验收命令、`--with-crewai` 用法、环境变量表、已知限制（P4-D2 能力）。

- [x] **Step 2: error-codes.md 增补 E1040–E1046、AWF-START-008**

- [x] **Step 3: cheatsheet 增补**

```
rxwf start --lite --with-crewai
rxwf deps up --services crewai
```

- [x] **Step 4: Commit**

```bash
git commit -m "docs: P4-D CrewAI integration release notes and error codes"
```

---

## Phase P4-D2（概要任务，独立 PR）

| Task | 内容 | 状态 |
|------|------|------|
| D2-1 | Memory 桥接 `agent_session_messages` | ✅ |
| D2-2 | Knowledge 预检索 + `expectedOutput` 编辑器字段 | ✅ |
| D2-3 | `crewSupervisor` + crewai hierarchical 映射 | ✅ |
| D2-4 | `/v1/kickoff/stream` SSE + 执行中 agentSteps | ✅ |
| D2-5 | `enableBuiltinTools` 白名单 + E1041 | ✅ |

---

## 验收检查清单（P4-D1 + 回归）

- [x] `compileCrewIr` + E1040/W1013 校验 — `@rxwf/workflow` test
- [x] `crewai-client` + backend router — `@rxwf/node-runner` test
- [x] Tool 桥 + credential 桥 + mock kickoff — `p4d-*.integration.test.ts`
- [x] native Crew 回归 — `p4c-crew.integration.test.ts`
- [x] 远程 Sidecar 解析 — `p4d-remote-sidecar.integration.test.ts`
- [x] 编辑器 `executionBackend` — `@rxwf/web` typecheck
- [x] E1040–E1046 / AWF-START-008 i18n — `@rxwf/i18n-catalog` test
- [ ] 真实 Sidecar E2E（可选，`RXWF_TEST_CREWAI=1` + Docker/Ollama）— `p4d-crewai-e2e.integration.test.ts`

```bash
pnpm --filter @rxwf/workflow test
pnpm --filter @rxwf/node-runner test
pnpm --filter @rxwf/api test -- p4d
pnpm --filter @rxwf/api exec vitest run src/integration/p4c-crew.integration.test.ts
pnpm --filter @rxwf/web typecheck
pnpm --filter @rxwf/i18n-catalog test
# 可选
RXWF_TEST_CREWAI=1 pnpm --filter @rxwf/api test -- p4d-crewai-e2e
```

---

## Spec 覆盖自检

| Spec 章节 | 计划 Task |
|-----------|-----------|
| §4 AWF Crew IR | Task 1–2 |
| §5 Sidecar API | Task 4–5 |
| §6 Tool 桥 | Task 6 |
| §7 节点参数 | Task 9 |
| §8 node-runner 路由 | Task 7–8 |
| §10.4 自动联署 | Task 11 |
| §11 错误码 | Task 3, 12 |
| AC-D1.1–D1.6 | Task 5, 6, 7, 10, 11 |

P4-D2/D3 在 Phase 概要中列出，不在本计划细化为逐步任务。

---

## 实施状态（2026-05-30）

| 阶段 | 状态 |
|------|------|
| P4-D1 MVP | ✅ 已合并 `master` |
| P4-D2 能力对齐 | ✅ Memory / SSE / Supervisor / Knowledge / enableBuiltinTools |
| P4-D3 Flows 与进阶 | ✅ flowGraph / E1046 / crewEval |
| 可选 E2E | ✅ `p4d-crewai-e2e.integration.test.ts`（`RXWF_TEST_CREWAI=1`） |
| 模板 | ✅ `agent-crew-sequential-crewai.json`、`agent-crew-sequential-crewai-flow.json` |
| P4-D+ 增强 | ✅ Flow router / Knowledge native / openai-compatible / 远程 Sidecar |
| 远程 Sidecar 集成测 | ✅ `p4d-remote-sidecar.integration.test.ts` |

---

## 执行方式

计划已全部落地（P4-D1 Task 1–12 + P4-D2/D3/D+）。验收命令与 `--with-crewai` 用法见 [RELEASE-v1.3-crewai.md](../../RELEASE-v1.3-crewai.md)；可选真实 Sidecar 冒烟见 `RXWF_TEST_CREWAI=1` + `p4d-crewai-e2e.integration.test.ts`。
