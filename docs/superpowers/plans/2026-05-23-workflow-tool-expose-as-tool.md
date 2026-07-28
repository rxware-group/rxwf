# P4-B′ Workflow Tool（方案 C：published + exposeAsTool）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `toolWorkflow` 收紧为 n8n 式 **方案 C**：仅允许引用 **已发布** 且在工作流设置中 **`exposeAsTool: true`** 的目标流；运行时只执行 **published** 定义；编辑器与 Agent Tools 面板只展示合格工作流。

**状态：** ✅ 已于 master 实现（2026-05-29 文档同步）

**Architecture:** 在 `WorkflowDefinition.settings` 增加 `exposeAsTool` / `exposeAsToolDescription`（随 publish 进入快照）。校验层（`validate` + `POST /validate`）对 `toolWorkflow.workflowId` 查目标 workflow 的 `status` 与 **published 版本** settings。`runChild` / enqueue 强制 `definitionSource: 'published'`。列表 API 过滤供 UI 下拉。移除或降级原 W1011 warn-only 行为。

**Tech Stack:** TypeScript、Vitest、Drizzle、Fastify、React 19、pnpm workspace。

**设计依据:** [2026-05-23-workflow-agent-node-design.md](../specs/2026-05-23-workflow-agent-node-design.md) §5.4–5.5、§4.3、§7.3、§9.3

**前置建议:** 在 [strict-closeout](./2026-05-23-workflow-agent-node-strict-closeout.md) 之后实施，或独立 PR。

---

## 验收标准

| ID | 条件 |
|----|------|
| WT-1 | 未 published 的 `workflowId` → 保存 validate **E1023** |
| WT-2 | 已 published 但 `exposeAsTool !== true` → **E1024** |
| WT-3 | 不存在的工作流 ID → **E1022** |
| WT-4 | 运行时 `runChild` 仅加载 published；未达标 → **E3012**（或 E3025） |
| WT-5 | `GET /api/workflows?exposeAsTool=true` 仅返回 published + expose 的工作流 |
| WT-6 | Agent Tools 面板 Workflow 项仅用该 API |
| WT-7 | 工作流设置 UI 可开关 `exposeAsTool`（保存进 definition） |

---

## Phase 1：类型与错误码

### Task 1: settings 类型与错误码文档

**Files:**
- Modify: `packages/workflow/src/validate.ts`（`WorkflowDefinition.settings`）
- Modify: `docs/error-codes.md`
- Modify: `packages/workflow/src/validate.test.ts`

- [x] **Step 1: 扩展 settings 类型**

```typescript
settings?: {
  timezone?: string;
  runnerPolicy?: { /* ... */ };
  errorWorkflowId?: string;
  exposeAsTool?: boolean;
  exposeAsToolDescription?: string;
};
```

- [x] **Step 2: 在 error-codes.md 增加**

| 代码 | zh-CN |
|------|-------|
| E1022 | Workflow Tool 目标工作流不存在 |
| E1023 | Workflow Tool 目标工作流未发布 |
| E1024 | Workflow Tool 目标工作流未开启「作为 Agent Tool 暴露」 |

- [x] **Step 3: Commit**

```bash
git commit -m "docs(workflow): exposeAsTool settings and E1022-E1024 error codes"
```

---

### Task 2: 服务端校验 helper

**Files:**
- Create: `packages/workflow/src/tool-workflow-target.ts`
- Create: `packages/workflow/src/tool-workflow-target.test.ts`
- Modify: `packages/workflow/src/index.ts`

- [x] **Step 1: 写失败测试（纯函数，注入 lookup）**

```typescript
import { describe, expect, it } from 'vitest';
import { validateToolWorkflowTarget } from './tool-workflow-target.js';

describe('validateToolWorkflowTarget', () => {
  it('E1024 when published but exposeAsTool false', () => {
    const err = validateToolWorkflowTarget({
      exists: true,
      published: true,
      exposeAsTool: false,
    });
    expect(err?.code).toBe('E1024');
  });
});
```

- [x] **Step 2: 实现**

```typescript
export interface ToolWorkflowTargetInfo {
  exists: boolean;
  published: boolean;
  exposeAsTool: boolean;
}

export function validateToolWorkflowTarget(
  info: ToolWorkflowTargetInfo,
  nodeId?: string,
): { code: string; message: string; nodeId?: string } | null {
  if (!info.exists) {
    return { code: 'E1022', message: 'Workflow Tool target workflow not found', nodeId };
  }
  if (!info.published) {
    return { code: 'E1023', message: 'Workflow Tool target must be published', nodeId };
  }
  if (!info.exposeAsTool) {
    return { code: 'E1024', message: 'Workflow Tool target must have exposeAsTool enabled', nodeId };
  }
  return null;
}
```

- [x] **Step 3: GREEN + Commit**

---

### Task 3: validateWorkflowDefinition 同步校验（可选 workflowId 存在时 skip）

**Files:**
- Modify: `packages/workflow/src/validate.ts`

- [x] **Step 1:** `validate` **不**做跨库 lookup（保持纯函数）；仅校验 `workflowId` 非空。跨库校验留在 API `POST /validate` 与 `workflowService.validateWithContext`（新建）。

- [x] **Step 2: 新建 `validateWorkflowWithTargets`**

在 `workflow-service.ts` 或 `apps/api` 路由中：

```typescript
async function resolveToolWorkflowTarget(workflowId: string): Promise<ToolWorkflowTargetInfo> {
  const row = await repo.get(workflowId);
  if (!row) return { exists: false, published: false, exposeAsTool: false };
  const published = row.status === 'published';
  let exposeAsTool = false;
  if (published && row.publishedVersionId) {
    const ver = await repo.getVersion(workflowId, /* published version */);
    exposeAsTool = Boolean(ver?.definition?.settings?.exposeAsTool);
  }
  return { exists: true, published, exposeAsTool };
}
```

对每个 `toolWorkflow` 节点调用 `validateToolWorkflowTarget`，errors 并入 validate 结果。

- [x] **Step 3: 替换 workflows.ts 中 W1011 warn 循环** — 改为上述 helper，**error** 级别。

- [x] **Step 4: 集成测试** — validate API 返回 E1023/E1024。

- [x] **Step 5: Commit**

```bash
git commit -m "feat(workflow): enforce published+exposeAsTool for toolWorkflow validate"
```

---

## Phase 2：运行时

### Task 4: runChild 仅 published + expose 检查

**Files:**
- Modify: `apps/api/src/execution/create-execution-runtime.ts`（`runSubworkflowChild`）
- Modify: `packages/node-runner/src/executors/ai-agent.ts`（toolWorkflow 分支）

- [x] **Step 1: enqueue 使用 published**

```typescript
const enqueued = await enqueueService.enqueue({
  workflowId: input.workflowId,
  triggerType: 'subworkflow',
  mode: 'production',
  definitionSource: 'published',
});
```

- [x] **Step 2: 执行前校验**

在 `runSubworkflowChild` 开头 `resolveToolWorkflowTarget`；失败抛 `AwfError('E3012', ...)` 或新码 `E3025`。

- [x] **Step 3: 扩展 p4b-agent-workflow-tool 集成测** — 子流须 `publish` 且 `exposeAsTool: true` 才成功。

- [x] **Step 4: Commit**

```bash
git commit -m "fix(execution): toolWorkflow runs published definition only with exposeAsTool"
```

---

## Phase 3：API 列表与前端

### Task 5: GET /api/workflows 过滤

**Files:**
- Modify: `apps/api/src/routes/workflows.ts`
- Modify: `packages/workflow` repository / service list 方法

- [x] **Step 1: query `exposeAsTool=true`**

仅 `status=published` 且 published 版本 `settings.exposeAsTool === true`。

- [x] **Step 2: api client + 测试 inject**

- [x] **Step 3: Commit**

---

### Task 6: 工作流设置 UI

**Files:**
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx` 或 `RunnerPolicyEditor` 旁新面板
- Modify: `apps/web/src/api/client.ts`

- [x] **Step 1:** 开关「作为 Agent Tool 暴露」→ `definition.settings.exposeAsTool`
- [x] **Step 2:** 可选描述 textarea → `exposeAsToolDescription`
- [x] **Step 3:** 提示：需 **发布** 后他流才能引用

- [x] **Step 4: Commit**

---

### Task 7: toolWorkflow 参数与 Agent Tools 面板

**Files:**
- Modify: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`（toolWorkflow workflowId）
- Modify: `apps/web/src/features/editor/AgentToolsPanel.tsx`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`

- [x] **Step 1:** `workflowId` 由文本框改为 **下拉**（调用列表 API）
- [x] **Step 2:** AgentToolsPanel 选 Workflow 时只拉合格列表；创建 `toolWorkflow` 节点并写入 `workflowId`
- [x] **Step 3:** Commit

```bash
git commit -m "feat(web): exposeAsTool workflow picker for toolWorkflow and agent tools"
```

---

## Phase 4：i18n 与迁移说明

### Task 8: i18n + 迁移提示

**Files:**
- Modify: `packages/i18n-catalog/src/catalog.ts`

- [x] **Step 1:** 增加 `errors.E1022`–`E1024`
- [x] **Step 2:** `docs/RELEASE-v1.1-agent.md` 增加 **Breaking**：旧 toolWorkflow 指向未发布/未 expose 的流需重新配置

- [x] **Step 3: Commit**

---

## 门禁

```bash
pnpm --filter @rxwf/workflow test
pnpm --filter @rxwf/api test -- p4b-agent
pnpm --filter @rxwf/web test
pnpm test
```

---

## Spec 自检

| Spec § | Task |
|--------|------|
| §5.5 settings | 1, 6 |
| §4.3 validate | 2, 3 |
| §7.3 runtime | 4 |
| §9.3 Tools 面板 | 7 |
| §13 开放项 方案 C | 全部 |
