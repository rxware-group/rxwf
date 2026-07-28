# P4-E Group Chat 群聊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作流画布交付 **Group Chat 根节点 + group_member 参与者**，实现 round-robin / orchestrator 发言、UserProxy 人工插话（AC-21）、群聊 transcript 可观测。

**Architecture:** 沿用 Crew 模式——`groupChat` 为 main 流节点，多个 `aiAgent` 经 `group_member` 资源口挂载；执行在 `packages/node-runner` 原生循环中调用现有 `runAiAgentNode`；UserProxy 扩展 HITL resume 支持 orchestration checkpoint 原地续跑。MVP 不依赖 LangGraph 新图（P4-E.3 可选迁移 `AiRuntime.runGroupChat`）。

**Tech Stack:** Node.js ≥20、TypeScript、Vitest、现有 `@rxwf/ai-runtime-stub`、`runAiAgentNode`、Fastify HITL API、React 19 编辑器。

**设计依据:** [2026-05-30-group-chat-design.md](../specs/2026-05-30-group-chat-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/workflow/src/group-members.ts` | `collectGroupMembers`、`collectGroupOrchestrator`、`isGroupChatOrchestrationConnection` |
| `packages/workflow/src/group-members.test.ts` | 成员收集单元测试 |
| `packages/workflow/src/validate.ts` | E1041、E1045–E1047、W1012 |
| `packages/workflow/src/index.ts` | 导出 |
| `packages/execution/src/graph/to-workflow-graph.ts` | 排除 group 资源边 |
| `packages/execution/src/graph/to-workflow-graph.test.ts` | 回归 |
| `packages/execution/src/hitl/resume-group-chat.ts` | Group Chat 专用 resume（checkpoint 续跑） |
| `packages/execution/src/hitl/resume-hitl.ts` | 路由 groupChat waiting 节点 |
| `packages/node-runner/src/executors/group-chat.ts` | `groupChat` 执行器 |
| `packages/node-runner/src/executors/group-chat-helpers.ts` | 选发言者、终止条件、transcript |
| `packages/node-runner/src/executors/group-chat.test.ts` | 单元测试 |
| `packages/node-runner/src/executors/register-plus.ts` | 注册执行器 |
| `packages/node-runner/src/types/node-executor.ts` | `orchestrationResume?` 上下文 |
| `apps/api/src/integration/p4e-group-chat.integration.test.ts` | AC-21 门禁 |
| `apps/web/src/features/editor/node-port-defs.ts` | 端口 |
| `apps/web/src/features/editor/node-type-meta.ts` | 元数据 |
| `apps/web/src/features/editor/node-param-schemas.ts` | 参数表单 |
| `apps/web/src/features/editor/NodePalette.tsx` | 面板 |
| `apps/web/src/features/editor/editor-agent-stream-format.ts` | 流式步骤格式化 |
| `apps/web/src/features/editor/WorkflowNode.tsx` | `group_member` handle |
| `packages/i18n-catalog/src/catalog-ui-ext.ts` | 文案 |
| `fixtures/templates/agent-group-chat-round-robin.json` | 模板 |
| `fixtures/templates/agent-group-chat-orchestrator.json` | 模板 |
| `docs/error-codes.md` | E1041、E1045–E1047 |

---

## Phase P4-E.1：图模型 + round-robin 执行

### Task 1: group_member 收集与连接常量

**Files:**
- Create: `packages/workflow/src/group-members.ts`
- Create: `packages/workflow/src/group-members.test.ts`
- Modify: `packages/workflow/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/workflow/src/group-members.test.ts
import { describe, expect, it } from 'vitest';
import { collectGroupMembers } from './group-members.js';

const def = {
  schemaVersion: 1,
  name: 'gc',
  nodes: [
    { id: 'gc', type: 'groupChat', name: 'Chat', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'a1', type: 'aiAgent', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
    { id: 'a2', type: 'aiAgent', name: 'B', position: { x: 100, y: 0 }, parameters: {} },
  ],
  connections: [
    { from: 'a1', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
    { from: 'a2', to: 'gc', fromOutput: 'group_member', toInput: 'group_member' },
  ],
};

describe('collectGroupMembers', () => {
  it('returns aiAgent members sorted by x', () => {
    const m = collectGroupMembers(def, 'gc');
    expect(m.map((n) => n.id)).toEqual(['a1', 'a2']);
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/workflow test -- group-members`  
Expected: FAIL

- [ ] **Step 3: 实现 `group-members.ts`**

```typescript
export const GROUP_MEMBER_INPUT = 'group_member';
export const GROUP_MEMBER_OUTPUT = 'group_member';
export const GROUP_ORCHESTRATOR_INPUT = 'group_orchestrator';
export const GROUP_ORCHESTRATOR_OUTPUT = 'group_orchestrator';

export function isGroupChatOrchestrationConnection(c: WorkflowDefinition['connections'][number]): boolean {
  const toInput = c.toInput ?? 'main';
  const fromOutput = c.fromOutput ?? 'main';
  return (
    toInput === GROUP_MEMBER_INPUT ||
    fromOutput === GROUP_MEMBER_OUTPUT ||
    toInput === GROUP_ORCHESTRATOR_INPUT ||
    fromOutput === GROUP_ORCHESTRATOR_OUTPUT
  );
}

export function collectGroupMembers(definition: WorkflowDefinition, groupChatNodeId: string): WorkflowNode[] {
  // 同 collectCrewWorkers 模式：filter aiAgent, sort by position.x
}

export function collectGroupOrchestrator(definition: WorkflowDefinition, groupChatNodeId: string): WorkflowNode | null {
  // 可选 orchestrator aiAgent
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

- [ ] **Step 5: Commit**

```bash
git add packages/workflow/src/group-members.ts packages/workflow/src/group-members.test.ts packages/workflow/src/index.ts
git commit -m "feat(workflow): add group chat member collection helpers"
```

---

### Task 2: 校验 E1041 + 执行图排除

**Files:**
- Modify: `packages/workflow/src/validate.ts`
- Modify: `packages/execution/src/graph/to-workflow-graph.ts`
- Modify: `packages/execution/src/graph/to-workflow-graph.test.ts`

- [ ] **Step 1: validate 失败测试**

```typescript
it('E1041 when groupChat has fewer than 2 members', () => {
  const result = validateWorkflow(defWithOneMember);
  expect(result.errors.some((e) => e.code === 'E1041')).toBe(true);
});
```

- [ ] **Step 2: 实现 validate 分支**（`node.type === 'groupChat'`）
  - E1041：≥2 个 `group_member`
  - 对每个参与者校验 **Chat Model**（E1012）；Tool 可选 0~n（与 Crew / 独立 aiAgent 一致，已无 E1013）
  - 可选 W1012：参与者未配置 `role`

- [ ] **Step 3: to-workflow-graph 导入 `isGroupChatOrchestrationConnection`，与 Crew 并列 filter**

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @rxwf/workflow test && pnpm --filter @rxwf/execution test`

- [ ] **Step 5: Commit**

---

### Task 3: group-chat-helpers（选发言者 + 终止）

**Files:**
- Create: `packages/node-runner/src/executors/group-chat-helpers.ts`
- Create: `packages/node-runner/src/executors/group-chat.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
describe('selectRoundRobinSpeaker', () => {
  it('cycles members by round index', () => {
    expect(selectRoundRobinSpeaker(['A', 'B'], 1)).toBe('B');
    expect(selectRoundRobinSpeaker(['A', 'B'], 2)).toBe('A');
  });
});

describe('shouldTerminateByKeywords', () => {
  it('matches TERMINATE in content', () => {
    expect(shouldTerminateByKeywords('done TERMINATE', 'TERMINATE,FINISH')).toBe(true);
  });
});
```

- [ ] **Step 2: 实现 helpers**

含：`buildGroupChatTask`、`appendTranscript`、`buildGroupChatStepsMetadata`

- [ ] **Step 3: 运行测试 GREEN**

Run: `pnpm --filter @rxwf/node-runner test -- group-chat`

- [ ] **Step 4: Commit**

---

### Task 4: groupChat 执行器（round-robin MVP）

**Files:**
- Create: `packages/node-runner/src/executors/group-chat.ts`
- Modify: `packages/node-runner/src/executors/register-plus.ts`

- [ ] **Step 1: 写集成级单元测试（mock runAiAgentNode）**

```typescript
vi.mock('./run-ai-agent-node.js', () => ({
  runAiAgentNode: vi.fn(async (_ctx, _deps, opts) => ({
    status: 'success',
    outputItems: [[{ json: { answer: `reply-${opts.agentNodeId}` } }]],
  })),
}));
```

- [ ] **Step 2: 实现 `runGroupChatNative`**

核心循环参考 `crew-native.ts` 的 `runCrewSequentialNative`：

```typescript
export function createGroupChatExecutor(deps: PlusExecutorDeps): NodeExecutor {
  return {
    type: 'groupChat',
    async execute(ctx) {
      const members = collectGroupMembers(definition, ctx.nodeId);
      if (members.length < 2) return { status: 'failed', errorCode: 'E1041', ... };
      const maxRounds = Math.max(1, Math.min(50, Number(ctx.config.maxRounds ?? 8)));
      // loop + runAiAgentNode + transcript
      return {
        status: 'success',
        outputItems: [[{ json: { answer, transcript, groupChatSteps } }]],
        metadata: { agentSteps: groupChatSteps },
      };
    },
  };
}
```

- [ ] **Step 3: register-plus 注册**

- [ ] **Step 4: 运行 node-runner 测试**

- [ ] **Step 5: Commit**

---

### Task 5: API 集成测试（round-robin，无 UserProxy）

**Files:**
- Create: `apps/api/src/integration/p4e-group-chat.integration.test.ts`

- [ ] **Step 1: 写 AC-E2 测试**

```typescript
describe('P4-E Group Chat round-robin (lite)', () => {
  it('runs two agents for maxRounds and returns transcript', async () => {
    // mock ai runtime 或 stub chat 返回固定 answer
    // 断言 output.transcript.length >= 2
    // 断言 metadata.agentSteps 含 groupChatTurn
  });
});
```

- [ ] **Step 2: 运行测试 GREEN**

Run: `pnpm --filter @rxwf/api exec vitest run src/integration/p4e-group-chat.integration.test.ts`

- [ ] **Step 3: Commit**

---

## Phase P4-E.2：Orchestrator + UserProxy + 前端

### Task 6: Orchestrator 选发言者

**Files:**
- Modify: `packages/node-runner/src/executors/group-chat-helpers.ts`
- Modify: `packages/node-runner/src/executors/group-chat.ts`
- Modify: `packages/workflow/src/validate.ts`（E1045）

- [ ] **Step 1: 写 orchestrator JSON 解析测试**

```typescript
it('parses speak action', () => {
  const p = parseOrchestratorDecision('{"action":"speak","member":"A"}');
  expect(p.action).toBe('speak');
});
```

- [ ] **Step 2: 实现 `askGroupOrchestrator`**（复用 `crew-helpers.ts` 的 `askCrewSupervisor` 模式 + inline model）

- [ ] **Step 3: group-chat.ts 分支 `speakerSelection`**

- [ ] **Step 4: 集成测试 orchestrator 模式**

- [ ] **Step 5: Commit**

---

### Task 7: UserProxy + HITL checkpoint 续跑

**Files:**
- Modify: `packages/node-runner/src/types/node-executor.ts`
- Modify: `packages/node-runner/src/executors/group-chat.ts`
- Create: `packages/execution/src/hitl/resume-group-chat.ts`
- Modify: `packages/execution/src/hitl/resume-hitl.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `apps/api/src/integration/p4e-group-chat.integration.test.ts`

- [ ] **Step 1: 扩展 NodeExecutionContext**

```typescript
orchestrationResume?: {
  kind: 'groupChat';
  checkpoint: GroupChatCheckpoint;
  userMessage: string;
};
```

- [ ] **Step 2: group-chat 执行器 waiting 分支**

返回 `status: 'waiting'` + `metadata.groupChat.checkpoint`

- [ ] **Step 3: 实现 `resumeGroupChatExecution`**

- 查找 waiting `groupChat` nodeRun
- 注入 `orchestrationResume`
- **仅重跑 groupChat 节点**（非全图）；完成后 merge 到 execution

- [ ] **Step 4: resume-hitl 路由：`waitingNodeType === 'groupChat'` → resumeGroupChat**

- [ ] **Step 5: AC-21 集成测试**

```typescript
it('AC-21: user supplement resumes group chat and completes within maxRounds', async () => {
  // 1. 启动执行 → waiting
  // 2. resumeHitl({ supplement: '优先内网部署' })
  // 3. 断言 transcript 含 role=user
  // 4. 断言最终 success + answer
});
```

- [ ] **Step 6: Commit**

---

### Task 8: 前端节点与参数

**Files:**
- Modify: `apps/web/src/features/editor/node-port-defs.ts`
- Modify: `apps/web/src/features/editor/node-type-meta.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `apps/web/src/features/editor/NodePalette.tsx`
- Modify: `apps/web/src/features/editor/WorkflowNode.tsx`
- Modify: `apps/web/src/features/editor/editor-agent-stream-format.ts`
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`

- [ ] **Step 1: node-port-defs 添加 `groupChat` case**

```typescript
case 'groupChat':
  return {
    inputs: [{ id: 'main', label: '输入', kind: 'main' }],
    outputs: [{ id: 'main', label: '输出', kind: 'main' }],
    resourceInputs: [
      { id: 'group_member', label: '群聊成员', kind: 'resource' },
      { id: 'group_orchestrator', label: 'Orchestrator (可选)', kind: 'resource' },
    ],
  };
```

- [ ] **Step 2: aiAgent 增加 `group_member` resourceOutput**

- [ ] **Step 3: node-param-schemas、node-type-meta、NodePalette**

- [ ] **Step 4: editor-agent-stream-format 识别 `groupChatTurn`**

- [ ] **Step 5: i18n 文案**

- [ ] **Step 6: 运行 web 测试**

Run: `pnpm --filter @rxwf/web test && pnpm --filter @rxwf/web typecheck`

- [ ] **Step 7: Commit**

---

### Task 9: 模板 + 文档 + error-codes

**Files:**
- Create: `fixtures/templates/agent-group-chat-round-robin.json`
- Create: `fixtures/templates/agent-group-chat-orchestrator.json`
- Modify: `docs/error-codes.md`
- Create: `docs/RELEASE-v1.3-group-chat.md`（或并入下一 release 笔记）

- [ ] **Step 1: 模板 JSON**（参考 `agent-crew-supervisor.json` 结构）

- [ ] **Step 2: error-codes E1041、E1045–E1047、W1012**

- [ ] **Step 3: Release 笔记 + 验收命令**

```bash
pnpm test
pnpm --filter @rxwf/api exec vitest run src/integration/p4e-group-chat.integration.test.ts
pnpm --filter @rxwf/web typecheck
```

- [ ] **Step 4: 更新 [p4-c-ai-milestone-roadmap.md](../specs/2026-05-23-p4-c-ai-milestone-roadmap.md) 增加 P4-E 行**

- [ ] **Step 5: Commit**

---

## Phase P4-E.3（可选）：LangGraph runGroupChat

### Task 10: AiRuntime 扩展

**Files:**
- Modify: `packages/ai-runtime/stub/src/index.ts`
- Create: `packages/ai-runtime/src/agents/group-chat-agent.ts`
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`

- [ ] **Step 1: 定义 `GroupChatRunInput` / `GroupChatRunResult`**

- [ ] **Step 2: LangGraph StateGraph：orchestrator 节点 + participant 节点 + 条件边**

- [ ] **Step 3: group-chat.ts 增加 `executionBackend: 'langgraph'` 开关（默认 native）**

- [ ] **Step 4: 契约测试 + 回归**

- [ ] **Step 5: Commit**

---

## 验收清单

| ID | 命令 / 场景 | 期望 |
|----|-------------|------|
| AC-E1 | 保存仅 1 个 group_member | E1041 |
| AC-E2 | round-robin 集成测试 | transcript ≥ 2 条 agent 消息 |
| AC-21 | UserProxy supplement resume | transcript 含 user + 终止于 maxRounds 内 |
| AC-E3 | orchestrator 模式 | 日志含 selectionReason |
| AC-E4 | 执行详情 timeline | agentSteps 可展开 groupChatTurn |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| UserProxy 续跑需改 execution 引擎 | Task 7 限定仅重跑单节点；fallback：MVP 从 input Items 读 `userMessage` |
| 多 Agent 串行耗时长 | `maxRounds` 上限 50；timeout 继承各 aiAgent `timeoutMs` |
| transcript 过大 | 输出 Items 可配置 `returnTranscript=false`；仅保留 finalAnswer |
| 与 Crew 端口混淆 | 独立 `group_member` 端口名；文档明确范式差异 |
| 参与者无 Tool | `runAiAgentNode` / `runAgent` 在无 Tool 时走纯 chat；全平台已无 E1013/E3011 强制 |

---

## 参考实现

- 成员收集：`packages/workflow/src/crew-members.ts`
- 原生 Crew 循环：`packages/node-runner/src/executors/crew-native.ts`
- Supervisor LLM 协议：`packages/node-runner/src/executors/crew-helpers.ts`
- HITL：`packages/execution/src/hitl/resume-hitl.ts`、`human-approval.ts`
- 端口模式：`apps/web/src/features/editor/node-port-defs.ts` `crewSupervisor` case
