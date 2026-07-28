# P4-B 工作流 AI Agent（n8n Tools Agent）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作流画布上交付 n8n 式 **AI Agent 根节点 + 卫星子节点**（Chat Model / Memory / Tool），后端经 `AiRuntime.runAgent`（LangGraph）执行，支持 MCP/HTTP/Workflow Tool、跨执行 Memory 与可观测步骤。

**Architecture:** 卫星节点仅通过 `ai_languageModel` / `ai_memory` / `ai_tool` 连到 `aiAgent`，不参与 main 拓扑；执行时 `collectSatellites` 组装 `AgentRunInput`，Tool 经 `ai-runtime/tools` 适配现有 MCP 池、HTTP executor、`runChild`。Memory 存 `agent_session_messages`（Lite SQLite / Standard PG）。前端扩展 `node-port-defs` 与 Tools 面板。

**Tech Stack:** Node.js ≥20、TypeScript、Vitest、`@langchain/core` + `@langchain/langgraph` + `@langchain/ollama` + `@langchain/openai`（仅 `packages/ai-runtime`）、Fastify、Drizzle、React 19、`@xyflow/react`、pnpm workspace。

**设计依据:** [2026-05-23-workflow-agent-node-design.md](../specs/2026-05-23-workflow-agent-node-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/workflow/src/agent-satellites.ts` | `collectSatellites`、`isSatelliteNodeType` |
| `packages/workflow/src/agent-satellites.test.ts` | 卫星收集单元测试 |
| `packages/workflow/src/validate.ts` | Agent 校验 E1012–E1014 |
| `packages/execution/src/graph/to-workflow-graph.ts` | main 拓扑排除纯卫星节点 |
| `packages/execution/src/graph/to-workflow-graph.test.ts` | 图构建回归 |
| `packages/ai-runtime-stub/src/index.ts` | 扩展 `AiRuntime` / `AgentRunInput` 类型 |
| `packages/ai-runtime/src/langchain-runtime.ts` | `createLangChainAiRuntime`、`runAgent` |
| `packages/ai-runtime/src/agents/react-agent.ts` | LangGraph ReAct 构图 |
| `packages/ai-runtime/src/tools/mcp-tool.ts` | MCP Tool 适配 |
| `packages/ai-runtime/src/tools/http-tool.ts` | HTTP Tool 适配（B.2） |
| `packages/ai-runtime/src/tools/workflow-tool.ts` | Workflow Tool 适配（B.2） |
| `packages/node-runner/src/executors/ai-agent.ts` | `aiAgent` 执行器 |
| `packages/node-runner/src/executors/register-plus.ts` | 注册 `aiAgent` |
| `packages/providers/contracts/src/agent-memory-repository.ts` | Memory 接口 |
| `packages/providers/lite/src/agent-memory-repository.ts` | SQLite 实现 |
| `packages/providers/lite/src/drizzle/schema.ts` | `agent_session_messages` 表 |
| `packages/providers/standard/src/...` | PG 同表（B.2） |
| `packages/node-runner/src/types/node-executor.ts` | `sessionId`、`onAgentStream` |
| `apps/api/src/execution/create-execution-runtime.ts` | 注入 AI + memory + mcp |
| `apps/api/src/bootstrap-plus.ts` | 切换 `createLangChainAiRuntime` |
| `apps/api/src/integration/p4b-agent.integration.test.ts` | AC-B2–B5 门禁 |
| `apps/web/src/features/editor/node-port-defs.ts` | 卫星端口定义 |
| `apps/web/src/features/editor/node-type-meta.ts` | Agent 簇元数据 |
| `apps/web/src/features/editor/AgentToolsPanel.tsx` | Tools 面板（B.2 UI 可增量） |
| `apps/web/src/features/editor/node-param-schemas.ts` | Agent 参数表单 |
| `apps/web/src/features/editor/WorkflowNode.tsx` | 卫星 Handle 渲染 |
| `apps/web/src/features/executions/ExecutionTimeline.tsx` | `agentSteps` 展示 |
| `docs/error-codes.md` | E1012–E1014、E3010–E3012 |

---

## Phase P4-B.1：图模型 + 执行骨架 + Ollama + toolMcp

### Task 1: 卫星收集与类型常量

**Files:**
- Create: `packages/workflow/src/agent-satellites.ts`
- Create: `packages/workflow/src/agent-satellites.test.ts`
- Modify: `packages/workflow/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/workflow/src/agent-satellites.test.ts
import { describe, expect, it } from 'vitest';
import { collectSatellites } from './agent-satellites.js';
import type { WorkflowDefinition } from './validate.js';

const def: WorkflowDefinition = {
  schemaVersion: 1,
  name: 'agent-test',
  nodes: [
    { id: 'agt', type: 'aiAgent', name: 'Agent', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'mdl', type: 'aiChatModel', name: 'Model', position: { x: 0, y: 0 }, parameters: { provider: 'ollama', model: 'llama3' } },
    { id: 't1', type: 'toolMcp', name: 'ListDir', position: { x: 0, y: 0 }, parameters: { serverId: 's1', tools: ['list_directory'], toolDescription: 'List files' } },
  ],
  connections: [
    { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    { from: 't1', to: 'agt', fromOutput: 'ai_tool', toInput: 'ai_tool' },
  ],
};

describe('collectSatellites', () => {
  it('returns model and tools for aiAgent', () => {
    const s = collectSatellites(def, 'agt');
    expect(s.model?.id).toBe('mdl');
    expect(s.tools).toHaveLength(1);
    expect(s.tools[0]?.type).toBe('toolMcp');
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/workflow test -- agent-satellites`  
Expected: FAIL — module not found

- [ ] **Step 3: 实现 collectSatellites**

```typescript
// packages/workflow/src/agent-satellites.ts
import type { WorkflowDefinition, WorkflowNode } from './validate.js';

export const SATELLITE_NODE_TYPES = new Set([
  'aiChatModel',
  'aiMemory',
  'toolMcp',
  'toolHttp',
  'toolWorkflow',
]);

export const AI_CONNECTION_INPUTS = new Set([
  'ai_languageModel',
  'ai_memory',
  'ai_tool',
]);

export function isSatelliteNodeType(type: string): boolean {
  return SATELLITE_NODE_TYPES.has(type);
}

export interface AgentSatellites {
  model: WorkflowNode | null;
  memory: WorkflowNode | null;
  tools: WorkflowNode[];
}

export function collectSatellites(
  definition: WorkflowDefinition,
  agentNodeId: string,
): AgentSatellites {
  const byId = new Map(definition.nodes.map((n) => [n.id, n]));
  let model: WorkflowNode | null = null;
  let memory: WorkflowNode | null = null;
  const tools: WorkflowNode[] = [];

  for (const c of definition.connections) {
    if (c.to !== agentNodeId) continue;
    const from = byId.get(c.from);
    if (!from) continue;
    const input = c.toInput ?? 'main';
    if (input === 'ai_languageModel') model = from;
    else if (input === 'ai_memory') memory = from;
    else if (input === 'ai_tool') tools.push(from);
  }

  return { model, memory, tools };
}
```

- [ ] **Step 4: 导出并确认 GREEN**

Run: `pnpm --filter @rxwf/workflow test -- agent-satellites`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/workflow/src/agent-satellites.ts packages/workflow/src/agent-satellites.test.ts packages/workflow/src/index.ts
git commit -m "feat(workflow): collect AI Agent satellite nodes from connections"
```

---

### Task 2: main 拓扑排除卫星节点

**Files:**
- Modify: `packages/execution/src/graph/to-workflow-graph.ts`
- Modify: `packages/execution/src/graph/to-workflow-graph.test.ts`

- [ ] **Step 1: 写失败测试 — 纯卫星节点不在 graph.nodes**

```typescript
// 追加到 to-workflow-graph.test.ts
import { isSatelliteNodeType } from '@rxwf/workflow';

it('excludes satellite-only nodes from executable graph', () => {
  const { graph } = toWorkflowGraph({
    schemaVersion: 1,
    name: 't',
    nodes: [
      { id: 'tr', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'agt', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'mdl', type: 'aiChatModel', name: 'M', position: { x: 0, y: 0 }, parameters: {} },
    ],
    connections: [
      { from: 'tr', to: 'agt' },
      { from: 'mdl', to: 'agt', fromOutput: 'ai_languageModel', toInput: 'ai_languageModel' },
    ],
  });
  expect(graph.nodes.some((n) => n.id === 'mdl')).toBe(false);
  expect(graph.nodes.some((n) => n.id === 'agt')).toBe(true);
});
```

- [ ] **Step 2: RED** — `pnpm --filter @rxwf/execution test -- to-workflow-graph`

- [ ] **Step 3: 在 toWorkflowGraph 过滤**

在 `executable` 过滤前增加：若节点 `isSatelliteNodeType(type)` 且 **没有**任何 `toInput===main` 的入边，则从 main 拓扑排除（`aiAgent` 保留）。

- [ ] **Step 4: GREEN + commit**

```bash
git commit -m "fix(execution): exclude AI satellite nodes from main workflow graph"
```

---

### Task 3: Agent 图校验 E1012–E1014

**Files:**
- Modify: `packages/workflow/src/validate.ts`
- Modify: `packages/workflow/src/validate.test.ts`
- Modify: `docs/error-codes.md`

- [ ] **Step 1: 写失败测试**

```typescript
it('E1012 when aiAgent has no aiChatModel', () => {
  const r = validateWorkflow({
    schemaVersion: 1,
    name: 'x',
    nodes: [{ id: 'a', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} }],
    connections: [],
  });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.code === 'E1012')).toBe(true);
});
```

- [ ] **Step 2: RED** — `pnpm --filter @rxwf/workflow test`

- [ ] **Step 3: 在 validateWorkflow 末尾对每个 aiAgent 调用 collectSatellites**

- 无 model → `E1012`（error，带 `nodeId`）
- tools.length === 0 → `E1013`
- 统计 `ai_languageModel` / `ai_memory` 入边 >1 → `E1014`
- 未连接的 tool 卫星 → warnings

- [ ] **Step 4: 更新 error-codes.md 表格 + GREEN + commit**

---

### Task 4: 扩展 AiRuntime 类型与 LangGraph runAgent（Ollama）

**Files:**
- Modify: `packages/ai-runtime/stub/src/index.ts`
- Create: `packages/ai-runtime/src/agents/react-agent.ts`
- Create: `packages/ai-runtime/src/langchain-runtime.ts`
- Create: `packages/ai-runtime/src/langchain-runtime.test.ts`
- Modify: `packages/ai-runtime/package.json`（添加 langchain 依赖）
- Modify: `packages/ai-runtime/src/index.ts`

- [ ] **Step 1: 在 stub 包扩展类型（保持 core 可编译）**

将 [adr-langchain.md](../../adr-langchain.md) §6.2 的 `AgentRunInput`、`AgentRunResult`、`AiStreamChunk`、`ToolDefinition` 写入 `packages/ai-runtime/stub/src/index.ts`，`AiRuntime` 增加 `runAgent`（stub 可 throw `E3001`）。

- [ ] **Step 2: 写 runAgent 单元测试（mock ChatModel）**

```typescript
// packages/ai-runtime/src/langchain-runtime.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createLangChainAiRuntime } from './langchain-runtime.js';

describe('createLangChainAiRuntime', () => {
  it('runAgent returns items with answer', async () => {
    const rt = createLangChainAiRuntime({
      ollama: { baseUrl: 'http://127.0.0.1:11434' },
      credentialResolver: async () => ({}),
    });
    const result = await rt.runAgent(
      {
        model: { provider: 'ollama', model: 'llama3' },
        userMessage: 'Say hi',
        tools: [],
        maxIterations: 1,
        timeoutMs: 30_000,
      },
      { executionId: 'e1', workflowId: 'w1', nodeId: 'n1', environment: 'dev' },
    );
    expect(result.items[0]?.json.answer).toBeDefined();
  });
});
```

首版测试可用 **注入 mock model** 的 factory 选项，避免 CI 依赖真实 Ollama。

- [ ] **Step 3: 实现 createLangChainAiRuntime + react-agent**

- `react-agent.ts`：`createReactAgent` + 绑定 tools 数组
- `langchain-runtime.ts`：`runAgent` 映射 `ModelRef` → `@langchain/ollama` ChatOllama
- 无 tools 时退化为单轮 chat（便于测试）

- [ ] **Step 4: GREEN** — `pnpm --filter @rxwf/ai-runtime test`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ai-runtime): LangGraph runAgent with Ollama model factory"
```

---

### Task 5: aiAgent 执行器 + toolMcp 适配

**Files:**
- Create: `packages/ai-runtime/src/tools/mcp-tool.ts`
- Create: `packages/node-runner/src/executors/ai-agent.ts`
- Create: `packages/node-runner/src/executors/ai-agent.test.ts`
- Modify: `packages/node-runner/src/executors/register-plus.ts`
- Modify: `packages/node-runner/src/types/node-executor.ts`

- [ ] **Step 1: 扩展 NodeExecutionContext**

```typescript
// node-executor.ts 追加
sessionId?: string;
onAgentStream?: (chunk: import('@rxwf/ai-runtime-stub').AiStreamChunk) => void;
aiRuntime?: import('@rxwf/ai-runtime-stub').AiRuntime;
mcpClient?: import('@rxwf/mcp-client-pool').McpClientHandle;
runSubworkflow?: import('./subworkflow.js').SubworkflowExecutorDeps['runChild'];
workflowDefinition?: import('@rxwf/workflow').WorkflowDefinition;
```

- [ ] **Step 2: 写 ai-agent 失败测试（mock aiRuntime.runAgent）**

- [ ] **Step 3: 实现 ai-agent.ts**

流程：从 `ctx.workflowDefinition` + `ctx.config`（含 nodeId）调用 `collectSatellites` → 构建 tools（仅 toolMcp）→ `runAgent` → 输出 `[{ json: { answer, agentSteps } }]`

- [ ] **Step 4: mcp-tool.ts** — `ToolDefinition.source.type==='mcp'` 时 `mcpClient.callTool`

- [ ] **Step 5: registerPlusExecutors 注册 type `aiAgent`**

- [ ] **Step 6: GREEN** — `pnpm --filter @rxwf/node-runner test`

- [ ] **Step 7: Commit**

---

### Task 6: 执行运行时注入 Agent 依赖

**Files:**
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `packages/node-runner/src/facade/node-runner-facade.ts`
- Modify: `packages/execution/src/engine/execution-engine.ts`

- [ ] **Step 1: execution-engine 将 full definition 传入 node runner（若尚未传递）**

- [ ] **Step 2: create-execution-runtime 在 featurePlus 时注入 `createLangChainAiRuntime`、mcpPool、runChild**

- [ ] **Step 3: nodeRun.metadata 写入 `agentSteps`（从 onAgentStream 累积）**

- [ ] **Step 4: 集成测试骨架**

Create: `apps/api/src/integration/p4b-agent.integration.test.ts`  
用 mock Ollama 或 skip 无 Ollama 环境：`describe.skipIf(!process.env.RXWF_TEST_OLLAMA)`

- [ ] **Step 5: Commit**

---

### Task 7: 前端端口与节点元数据（B.1 最小）

**Files:**
- Modify: `apps/web/src/features/editor/node-port-defs.ts`
- Modify: `apps/web/src/features/editor/node-type-meta.ts`
- Modify: `apps/web/src/features/editor/NodePalette.tsx`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `apps/web/src/features/editor/WorkflowNode.tsx`
- Modify: `apps/web/src/features/editor/defaultNodeParameters`（在 node-port-defs 内）

- [ ] **Step 1: node-port-defs 增加 aiAgent / 卫星类型**

```typescript
case 'aiAgent':
  return {
    inputs: [
      { id: 'main', label: '输入' },
      { id: 'ai_languageModel', label: 'Model' },
      { id: 'ai_memory', label: 'Memory' },
      { id: 'ai_tool', label: 'Tool' },
    ],
    outputs: [{ id: 'main', label: '输出' }],
  };
case 'aiChatModel':
  return { inputs: [], outputs: [{ id: 'ai_languageModel', label: 'Model' }] };
// toolMcp / aiMemory 同理
```

- [ ] **Step 2: WorkflowCanvas 连线校验** — 仅允许匹配的 fromOutput→toInput（可在 `WorkflowEditorPage` onConnect 中拒绝非法边）

- [ ] **Step 3: NodePalette Plus 分组增加 Agent 簇**

- [ ] **Step 4: node-param-schemas 增加 aiAgent / aiChatModel / toolMcp 字段**

- [ ] **Step 5: 手动冒烟** — 拖 Agent + Model + toolMcp，保存，validate 通过

- [ ] **Step 6: Commit**

---

### Task 8: 执行时间线 agentSteps（B.1 基础）

**Files:**
- Modify: `apps/web/src/features/executions/ExecutionTimeline.tsx`
- Modify: `apps/api` node-run 序列化（若 metadata 被 strip 则修复）

- [ ] **Step 1: 当 `nodeRun.metadata?.agentSteps` 存在时渲染折叠列表**

- [ ] **Step 2: Commit**

---

### P4-B.1 门禁

- [ ] **Run:** `pnpm test`（全仓）
- [ ] **Run:** `pnpm --filter @rxwf/api test -- p4b-agent`（有 Ollama 时）
- [ ] AC-B1、AC-B2（MCP）、AC-B4 基础满足

---

## Phase P4-B.2：HTTP/Workflow Tool + Memory + OpenAI + Tools 面板

### Task 9: agent_session_messages + AgentMemoryRepository

**Files:**
- Create: `packages/providers/contracts/src/agent-memory-repository.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Create: `packages/providers/lite/src/agent-memory-repository.ts`
- Create: `packages/providers/standard/src/repositories/agent-memory-repository.ts`（若 standard 已启用 PG）

- [ ] **Step 1: 接口 + Lite 实现测试**

```typescript
it('listRecent returns messages in order', async () => {
  await repo.append({ sessionId: 's1', role: 'user', content: 'hi', executionId: 'e1' });
  const rows = await repo.listRecent('s1', 10);
  expect(rows).toHaveLength(1);
});
```

- [ ] **Step 2: schema 迁移 + repository**

- [ ] **Step 3: Standard PG 镜像表**

- [ ] **Step 4: Commit**

---

### Task 10: execution.sessionId

**Files:**
- Modify: `packages/execution/src/enqueue/execution-enqueue-service.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts`（executions 表加 `session_id` 可空列）
- Modify: `apps/api/src/routes/workflows.ts`（POST executions body）
- Modify: `apps/api/src/routes/webhook.ts`（Header `X-AWF-Session-Id`）

- [ ] **Step 1: 写集成测试 — 两次 manual 执行同一 sessionId，第二次 Agent 能读到历史**

- [ ] **Step 2: 实现 enqueue 字段 + API 透传**

- [ ] **Step 3: ai-agent 中 sessionId 解析链（memory → agent → execution）**

- [ ] **Step 4: runAgent 前后 append/listRecent**

- [ ] **Step 5: Commit** — AC-B3

---

### Task 11: toolHttp + toolWorkflow 适配

**Files:**
- Create: `packages/ai-runtime/src/tools/http-tool.ts`
- Create: `packages/ai-runtime/src/tools/workflow-tool.ts`
- Modify: `packages/node-runner/src/executors/ai-agent.ts`

- [ ] **Step 1: http-tool 复用 `packages/node-runner/src/executors/http.ts` 的请求逻辑（提取 shared `executeHttpRequest` 若需）**

- [ ] **Step 2: workflow-tool 调用 `ctx.runSubworkflow`**

- [ ] **Step 3: 集成测试 — toolWorkflow 深度 + E2008 超限**

- [ ] **Step 4: validate 警告非 Active workflowId**

- [ ] **Step 5: Commit**

---

### Task 12: OpenAI 兼容模型 + 凭证

**Files:**
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`（credentialId 下拉）
- Reuse: `apps/web/src/features/settings/CredentialsPage.tsx`

- [ ] **Step 1: ModelRef provider `openai-compatible` → `ChatOpenAI` + credentialResolver**

- [ ] **Step 2: aiChatModel 表单：provider 切换显示 credentialId**

- [ ] **Step 3: 测试 mock fetch**

- [ ] **Step 4: Commit**

---

### Task 13: AgentToolsPanel + 卫星节点自动创建

**Files:**
- Create: `apps/web/src/features/editor/AgentToolsPanel.tsx`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`
- Modify: `apps/web/src/styles.css`（卫星口颜色）

- [ ] **Step 1: 点击 Agent 的 Tool handle 打开面板（MCP / HTTP / Workflow）**

- [ ] **Step 2: 选择后在 Agent 右侧偏移位置 `addNode` + `addConnection`（fromOutput `ai_tool`）**

- [ ] **Step 3: Agent NodeEditorModal 显示已连子节点列表（只读，点击 focus）**

- [ ] **Step 4: Commit**

---

### Task 14: EditorLogPanel 流式 agent 步骤

**Files:**
- Modify: `apps/web/src/features/editor/EditorLogPanel.tsx`
- Modify: `apps/web/src/features/editor/editor-debug-types.ts`
- Modify: `apps/api` debug 执行端点（若需 SSE chunk）

- [ ] **Step 1: debug-node / partial 执行将 `onAgentStream` 推到前端（轮询 nodeRun metadata 或 SSE）**

- [ ] **Step 2: Log 面板追加 tool_start/tool_end 行**

- [ ] **Step 3: Commit**

---

### P4-B.2 门禁

- [ ] **Run:** `pnpm test`
- [ ] AC-B3、AC-B5（Lite + Standard 各 1 条 agent memory 测试）
- [ ] 更新 `docs/RELEASE-v1.0.md` 或新建 `docs/RELEASE-v1.1-agent.md` 摘要

---

## Phase P4-B.3：增强（可独立 PR）

### Task 15: `$fromAI` Tool 参数（n8n 对标）

**Files:**
- Create: `packages/expression/src/from-ai.ts`
- Modify: `apps/web/src/features/editor/ParamFieldWithMode.tsx`
- Modify: tool 节点 param schemas

- [x] 参数模式 `fromAi` + 运行时由 LangChain tool call args 注入

### Task 16: `ai_outputParser` 卫星节点

**Files:**
- `node-port-defs`、validate、`collectSatellites` 扩展

- [x] `aiOutputParser` 卫星 + 运行时 JSON 解析（`parsed` 输出）

### Task 17: HITL（可选，低优先级）

参考 n8n Human review；本阶段可跳过。

- [x] HITL / `waiting` 节点状态（`humanApproval` + 续跑 API）

---

## Spec 覆盖自检

| Spec § | Task |
|--------|------|
| §4 图模型/连接 | Task 1–3, 7 |
| §5 节点参数 | Task 7, 12–13 |
| §6 Memory/sessionId | Task 9–10 |
| §7 执行流程 | Task 2, 5–6, 11 |
| §8 AiRuntime | Task 4, 11–12 |
| §9 前端 | Task 7, 13–14 |
| §10 API/错误码 | Task 3, 10 |
| §11 测试 | Task 6, 9–11, 门禁 |
| §12 分期 B.3 | Task 15–17 |
| AC-B1–B5 | B.1 门禁 + Task 10–11 |

---

## 进度总览（实施时更新）

| Phase | 内容 | 状态 |
|-------|------|------|
| P4-B.1 | 卫星图 + validate + runAgent + toolMcp + 端口 UI | ✅ |
| P4-B.2 | HTTP/Workflow + memory + OpenAI + Tools 面板 + 流式日志 | ✅ strict-closeout（metadata.agentSteps、API/UI 轮询、AC-B2–B5 门禁） |
| P4-B.3 | $fromAI、outputParser、HITL | ✅ |

---

## 执行说明

完成每个 Task 后勾选 checkbox；`pnpm test` 通过再进入下一 Task。Plus 功能测试保持 `RXWF_FEATURE_PLUS=true`（默认）。
