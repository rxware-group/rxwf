# 节点弹窗编辑器与底部日志 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工作流节点属性从主界面右侧移至双击打开的 n8n 式三栏弹窗，并在编辑器底部增加可折叠日志区；支持输入树拖拽生成 `$node` 表达式、字符串参数固定值/表达式切换、Code 节点 `$log` 调试输出。

**Architecture:** 方案 A 组件化重构——`WorkflowEditorPage` 改为两栏 + `EditorLogPanel`；新增 `NodeEditorModal` 三栏（自研横向 splitter，不新增 npm 依赖）；编辑器工具函数 `predecessor-nodes` / `drag-expression` / `field-modes`；后端扩展 sandbox → code executor → `DebugNodeResult.logs` → API → `nodeDebug`。

**Tech Stack:** React 19、Vite、`@xyflow/react`、TypeScript、Vitest、Fastify API、`@rxwf/sandbox` worker_threads、`packages/execution` debug 路径。

**设计依据:** [2026-05-23-node-editor-modal-design.md](../specs/2026-05-23-node-editor-modal-design.md)

**存储定稿:** 字符串字段表达式模式使用 `parameters._fieldModes: Record<string, 'fixed' | 'expression'>`；保存工作流前在 `buildDefinitionForRun` 中 **不** 剥离（node-runner 忽略未知 key）；若某 executor 遍历 `parameters` 全量键，需在计划中注明跳过 `_` 前缀键。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `apps/web/src/features/editor/WorkflowEditorPage.tsx` | 去掉右侧栏；挂载 Log + Modal 状态 |
| `apps/web/src/features/editor/WorkflowCanvas.tsx` | `onNodeDoubleClick` |
| `apps/web/src/features/editor/EditorLogPanel.tsx` | 底部日志（新建） |
| `apps/web/src/features/editor/NodeEditorModal.tsx` | 弹窗壳 + ESC（新建） |
| `apps/web/src/features/editor/NodeEditorInputPane.tsx` | 输入树（新建） |
| `apps/web/src/features/editor/NodeEditorParamsPane.tsx` | 参数表单（新建，自 NodePropertiesPanel 迁移） |
| `apps/web/src/features/editor/NodeEditorOutputPane.tsx` | 只读输出（新建） |
| `apps/web/src/features/editor/InputDataTree.tsx` | 两级树 + drag（新建） |
| `apps/web/src/features/editor/ParamFieldWithMode.tsx` | 固定/表达式 + drop（新建） |
| `apps/web/src/features/editor/predecessor-nodes.ts` | 前序节点拓扑列表（新建） |
| `apps/web/src/features/editor/drag-expression.ts` | `buildDragExpression`（新建） |
| `apps/web/src/features/editor/field-modes.ts` | `_fieldModes` 读写（新建） |
| `apps/web/src/features/editor/use-editor-layout-prefs.ts` | localStorage 布局（新建） |
| `apps/web/src/features/editor/use-horizontal-splitter.tsx` | 三栏宽度拖拽（新建） |
| `apps/web/src/features/editor/editor-debug-types.ts` | 增加 `logs`、`inputPreview` |
| `apps/web/src/features/editor/NodePropertiesPanel.tsx` | 删除或改为 re-export 薄包装（迁移后删除） |
| `apps/web/src/styles.css` | `.editor-main`、`.editor-log-panel`、`.node-editor-modal` |
| `packages/sandbox/src/sandbox-worker.ts` | 注入 `$log`、`items` |
| `packages/sandbox/src/run-in-sandbox.ts` | 返回 `{ json, logs }` |
| `packages/node-runner/src/executors/code.ts` | 透传 `logs` |
| `packages/node-runner/src/types/node-executor.ts` | `NodeRunResult.logs?` |
| `packages/execution/src/debug/run-debug-execution.ts` | `DebugNodeResult.logs?` |
| `apps/web/src/api/client.ts` | debug 响应类型增加 `logs` |

---

## Phase 1：后端 `$log` 与调试链路

### Task 1: Sandbox `$log` 收集

**Files:**
- Modify: `packages/sandbox/src/run-in-sandbox.ts`
- Modify: `packages/sandbox/src/sandbox-worker.ts`
- Create: `packages/sandbox/src/log-collector.ts`
- Test: `packages/sandbox/src/log-collector.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/sandbox/src/log-collector.test.ts
import { describe, it, expect } from 'vitest';
import { createLogCollector } from './log-collector.js';

describe('createLogCollector', () => {
  it('caps message length and entry count', () => {
    const log = createLogCollector({ maxEntries: 2, maxMessageLen: 4 });
    log.info('hello');
    log.info('world');
    log.info('drop');
    expect(log.entries()).toHaveLength(2);
    expect(log.entries()[0]!.message).toBe('hell');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @rxwf/sandbox test`
Expected: FAIL `createLogCollector` not found

- [ ] **Step 3: 实现 log-collector**

```typescript
// packages/sandbox/src/log-collector.ts
export type SandboxLogLevel = 'info' | 'warn' | 'error';

export interface SandboxLogEntry {
  level: SandboxLogLevel;
  message: string;
  timestamp: string;
}

export function createLogCollector(opts: {
  maxEntries: number;
  maxMessageLen: number;
}) {
  const entries: SandboxLogEntry[] = [];
  const push = (level: SandboxLogLevel, raw: string) => {
    if (entries.length >= opts.maxEntries) return;
    const message = String(raw).slice(0, opts.maxMessageLen);
    entries.push({ level, message, timestamp: new Date().toISOString() });
  };
  return {
    info: (m: string) => push('info', m),
    warn: (m: string) => push('warn', m),
    error: (m: string) => push('error', m),
    entries: () => entries,
  };
}
```

- [ ] **Step 4: 修改 sandbox-worker 注入 `$log` 与 `items`**

```typescript
// packages/sandbox/src/sandbox-worker.ts（核心片段）
import { createLogCollector } from './log-collector.js';

const log = createLogCollector({ maxEntries: 100, maxMessageLen: 4096 });
const $log = {
  info: (m: unknown) => log.info(String(m)),
  warn: (m: unknown) => log.warn(String(m)),
  error: (m: unknown) => log.error(String(m)),
};
const items = data.inputItems;
const fn = new Function('items', '$log', data.code);
const raw = fn(items, $log);
// ... existing json extraction ...
parentPort?.postMessage({ ok: true, json, logs: log.entries() });
```

- [ ] **Step 5: 更新 run-in-sandbox 返回类型**

```typescript
export async function runInSandbox(
  input: SandboxRunInput,
): Promise<{ json: Record<string, unknown>; logs: SandboxLogEntry[] }> {
  // worker message handler: resolve { json, logs: msg.logs ?? [] }
}
```

- [ ] **Step 6: 运行测试**

Run: `pnpm --filter @rxwf/sandbox build && pnpm --filter @rxwf/sandbox test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/sandbox/src/log-collector.ts packages/sandbox/src/log-collector.test.ts packages/sandbox/src/sandbox-worker.ts packages/sandbox/src/run-in-sandbox.ts
git commit -m "feat(sandbox): add $log collector for code node debugging"
```

---

### Task 2: Code executor 与 DebugNodeResult 透传 logs

**Files:**
- Modify: `packages/node-runner/src/types/node-executor.ts`
- Modify: `packages/node-runner/src/executors/code.ts`
- Modify: `packages/execution/src/debug/run-debug-execution.ts`
- Modify: `packages/node-runner/src/executors/code.test.ts`

- [ ] **Step 1: 扩展 `NodeRunResult`**

```typescript
import type { SandboxLogEntry } from '@rxwf/sandbox';

export interface NodeRunResult {
  // ...existing
  logs?: SandboxLogEntry[];
}
```

（在 `packages/sandbox/src/index.ts` export `SandboxLogEntry`）

- [ ] **Step 2: code executor 返回 logs**

```typescript
const { json, logs } = await deps.runInSandbox({ ... });
return { status: 'success', outputItems: [[{ json }]], logs };
```

- [ ] **Step 3: DebugNodeResult 增加 logs**

```typescript
export interface DebugNodeResult {
  // ...
  logs?: SandboxLogEntry[];
}

function toResult(r: FacadeNodeRunResult): DebugNodeResult {
  return { ...existing, logs: r.logs };
}
```

确保 `FacadeNodeRunResult` 扩展 `logs?`（`node-runner-facade.ts` spread `...result` 已包含）。

- [ ] **Step 4: 更新 code.test.ts mock**

```typescript
runInSandbox: async () => ({
  json: { ok: true },
  logs: [{ level: 'info', message: 'hi', timestamp: '2026-01-01T00:00:00.000Z' }],
}),
// expect result.logs length 1
```

- [ ] **Step 5: 运行测试**

Run: `pnpm --filter @rxwf/node-runner test && pnpm --filter @rxwf/execution test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(node-runner): surface sandbox logs on code node debug results"
```

---

### Task 3: API 与 Web 类型

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/editor/editor-debug-types.ts`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`（`setNodeDebug` 映射 `logs`）

- [ ] **Step 1: client debug 响应类型**

```typescript
logs?: Array<{ level: 'info' | 'warn' | 'error'; message: string; timestamp: string }>;
```

- [ ] **Step 2: NodeDebugState**

```typescript
export interface NodeDebugState {
  // ...
  logs?: Array<{ level: 'info' | 'warn' | 'error'; message: string; timestamp: string }>;
  inputPreview?: WorkflowItem[];
}
```

- [ ] **Step 3: executeNode 映射**

```typescript
next[id] = {
  status: ...,
  itemCount: r.itemCount,
  errorMessage: r.errorMessage,
  outputItems: r.outputItems,
  logs: r.logs,
};
```

（若 debug 响应尚无 `inputPreview`，本任务仅从 pin/边计算，见 Task 6）

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): type debug node logs from API"
```

---

## Phase 2：编辑器工具函数

### Task 4: `predecessor-nodes` 与 `drag-expression`

**Files:**
- Create: `apps/web/src/features/editor/predecessor-nodes.ts`
- Create: `apps/web/src/features/editor/predecessor-nodes.test.ts`
- Create: `apps/web/src/features/editor/drag-expression.ts`
- Create: `apps/web/src/features/editor/drag-expression.test.ts`

- [ ] **Step 1: predecessor 失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { listPredecessorNodes } from './predecessor-nodes.js';

describe('listPredecessorNodes', () => {
  it('returns ancestors in topological order excluding target', () => {
    const def = {
      schemaVersion: 1 as const,
      name: 'w',
      nodes: [
        { id: 't', type: 'manualTrigger', name: 'T', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'a', type: 'set', name: 'A', position: { x: 0, y: 0 }, parameters: {} },
        { id: 'b', type: 'set', name: 'B', position: { x: 0, y: 0 }, parameters: {} },
      ],
      connections: [
        { from: 't', to: 'a' },
        { from: 'a', to: 'b' },
      ],
    };
    expect(listPredecessorNodes(def, 'b').map((n) => n.name)).toEqual(['T', 'A']);
  });
});
```

- [ ] **Step 2: 实现 `listPredecessorNodes`**

逻辑：过滤 `stickyNote` 边；从 `targetNodeId` 反向 DFS 收集祖先 id；从 trigger（`manualTrigger` 等）正向拓扑排序（复制 `execution-engine.ts` 中 `topologicalOrder` 的 visit 顺序）；返回顺序中落在祖先集内、且 id ≠ target 的 `{ id, name }`。

- [ ] **Step 3: drag-expression 测试与实现**

```typescript
export function buildDragExpression(nodeName: string, path: string[]): string {
  const escaped = nodeName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const suffix = path.length ? `.${path.join('.')}` : '';
  return `{{ $node["${escaped}"].json${suffix} }}`;
}
```

测试：`buildDragExpression('HTTP', ['body', 'id'])` → `{{ $node["HTTP"].json.body.id }}`

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @rxwf/web test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): predecessor list and drag expression helpers"
```

---

### Task 5: `field-modes` 工具

**Files:**
- Create: `apps/web/src/features/editor/field-modes.ts`
- Create: `apps/web/src/features/editor/field-modes.test.ts`

- [ ] **Step 1: 测试**

```typescript
import { getFieldMode, setFieldMode, isStringFieldType } from './field-modes.js';

it('defaults to fixed', () => {
  expect(getFieldMode({}, 'url')).toBe('fixed');
});
it('persists expression mode', () => {
  const p = setFieldMode({}, 'url', 'expression');
  expect(getFieldMode(p, 'url')).toBe('expression');
});
```

- [ ] **Step 2: 实现**

```typescript
const MODES_KEY = '_fieldModes';

export function isStringFieldType(type: ParamFieldType): boolean {
  return type === 'text' || type === 'textarea' || type === 'expression';
}

export function getFieldMode(
  parameters: Record<string, unknown>,
  key: string,
): 'fixed' | 'expression' {
  const modes = parameters[MODES_KEY] as Record<string, string> | undefined;
  return modes?.[key] === 'expression' ? 'expression' : 'fixed';
}

export function setFieldMode(
  parameters: Record<string, unknown>,
  key: string,
  mode: 'fixed' | 'expression',
): Record<string, unknown> {
  const modes = { ...((parameters[MODES_KEY] as Record<string, string>) ?? {}) };
  modes[key] = mode;
  return { ...parameters, [MODES_KEY]: modes };
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): field fixed/expression mode helpers"
```

---

## Phase 3：底部日志面板

### Task 6: `EditorLogPanel`

**Files:**
- Create: `apps/web/src/features/editor/EditorLogPanel.tsx`
- Create: `apps/web/src/features/editor/editor-log-utils.ts`（复用 input 计算，从 NodePropertiesPanel 抽出）
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: `editor-log-utils.ts`**

```typescript
export function resolveNodeInputPreview(
  definition: WorkflowDefinition,
  nodeId: string,
  pinData: PinDataMap,
  nodeDebug: Record<string, NodeDebugState>,
): unknown {
  const incoming = definition.connections.filter((c) => c.to === nodeId);
  const fromPins = incoming.flatMap((c) => pinData[c.from] ?? []);
  if (fromPins.length) return itemsForDebugDisplay(fromPins);
  const preview = nodeDebug[nodeId]?.inputPreview;
  if (preview?.length) return itemsForDebugDisplay(preview);
  return null;
}
```

- [ ] **Step 2: EditorLogPanel 组件**

Props: `selectedNodeId`, `definition`, `nodeDebug`, `pinData`, `collapsed`, `heightPx`, `onToggleCollapsed`, `onResizeHeight`.

UI：header（「日志」+ 节点名 + chevron）；body 三 Tab：输入 / 输出 / 运行日志；`<pre>{JSON.stringify(data, null, 2)}</pre>`；运行日志仅 `node.type === 'code'` 且 `debug.logs?.length` 时显示列表。

- [ ] **Step 3: WorkflowEditorPage 布局**

```tsx
<div className="editor-main">
  <div className="editor-grid">...</div>
  <EditorLogPanel ... />
</div>
```

删除 `properties-panel` 整块。`editor-grid` CSS 改为 `grid-template-columns: 200px 1fr`。

- [ ] **Step 4: CSS**

```css
.workflow-editor { display: flex; flex-direction: column; min-height: 100vh; }
.editor-main { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.editor-grid { flex: 1; min-height: 320px; }
.editor-log-panel { border-top: 1px solid var(--rxwf-border); }
.editor-log-panel.collapsed .editor-log-panel-body { display: none; }
```

- [ ] **Step 5: 手工验证**

`pnpm dev` → 单击节点 → 底部显示输入/输出 JSON。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): bottom editor log panel, remove right properties column"
```

---

## Phase 4：节点弹窗与双击

### Task 7: `use-horizontal-splitter` 与 `NodeEditorModal` 骨架

**Files:**
- Create: `apps/web/src/features/editor/use-horizontal-splitter.tsx`
- Create: `apps/web/src/features/editor/NodeEditorModal.tsx`
- Create: `apps/web/src/features/editor/use-editor-layout-prefs.ts`
- Modify: `apps/web/src/features/editor/WorkflowCanvas.tsx`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`

- [ ] **Step 1: use-editor-layout-prefs**

```typescript
const KEY = 'rxwf.editor.layout';
export function useEditorLayoutPrefs() {
  // logCollapsed, logHeightPx, modalSplit: [28, 44, 28] percentages
}
```

- [ ] **Step 2: use-horizontal-splitter**

返回 `[leftPct, middlePct, rightPct]` + `onDragDivider(index, clientX)`；mousedown 在分隔条上，document mousemove/mouseup。

- [ ] **Step 3: NodeEditorModal**

- `createPortal` 到 `document.body`
- 遮罩 `.node-editor-modal-backdrop`；内容宽 90vw、高 85vh
- 标题区：`<input value={node.name} onChange=...>`、`findDuplicateNodeName` 错误、执行/删除/关闭按钮
- 三栏容器绑定 splitter
- `useEffect` 监听 `keydown` ESC → `onClose()`；`jsonParamError` 时 `onClose` 被父组件阻止

- [ ] **Step 4: WorkflowCanvas 双击**

```typescript
onNodeDoubleClick?: (nodeId: string) => void;
// ReactFlow: onNodeDoubleClick={(_e, node) => onNodeDoubleClick?.(node.id)}
```

单击仍 `onNodeSelect`；双击 `setEditorNodeId(node.id)` 打开弹窗。

- [ ] **Step 5: WorkflowEditorPage 状态**

```typescript
const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
{editorNodeId && (
  <NodeEditorModal
    nodeId={editorNodeId}
    onClose={() => { if (jsonParamError) return; setEditorNodeId(null); }}
    ...
  />
)}
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): node editor modal shell with splitter and double-click open"
```

---

### Task 8: 迁移参数/输出 Pane

**Files:**
- Create: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`
- Create: `apps/web/src/features/editor/NodeEditorOutputPane.tsx`
- Modify: `apps/web/src/features/editor/NodeEditorModal.tsx`
- Delete or deprecate: `apps/web/src/features/editor/NodePropertiesPanel.tsx`

- [ ] **Step 1: NodeEditorOutputPane**

只读 JSON：`itemsForDebugDisplay(flattenOutputBranches(nodeDebug[nodeId]?.outputItems))`；空态「执行节点以查看输出」；顶部可放「执行」按钮调用 `onExecuteNode`。

- [ ] **Step 2: NodeEditorParamsPane**

从 `NodePropertiesPanel.tsx` 复制 params 相关 JSX（`getParamSchema`、`McpClientFields`、`WebhookTriggerPanel`、json drafts），去掉 Tab 与 input/output 区。

- [ ] **Step 3: 接入 Modal 三栏**

左：占位 `NodeEditorInputPane`（Task 9）；中：`NodeEditorParamsPane`；右：`NodeEditorOutputPane`。

- [ ] **Step 4: 删除 NodePropertiesPanel 引用**

确认无其他 import；删除文件或保留空 re-export 一轮后删。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): move node params and output into editor modal panes"
```

---

### Task 9: `InputDataTree` 与 `ParamFieldWithMode`

**Files:**
- Create: `apps/web/src/features/editor/InputDataTree.tsx`
- Create: `apps/web/src/features/editor/NodeEditorInputPane.tsx`
- Create: `apps/web/src/features/editor/ParamFieldWithMode.tsx`
- Modify: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`

- [ ] **Step 1: InputDataTree**

对每个前序节点：
- 一级：可展开行显示 `name`（无数据标注灰色）
- 二级：递归渲染 `json` 对象键（叶子 `draggable`，`dataTransfer.setData('application/x-rxwf-expr', JSON.stringify({ nodeName, path }))`）

JSON 来源：`pinData[id]?.[0]?.json ?? nodeDebug[id]?.outputItems?.[0]?.[0]?.json`

- [ ] **Step 2: ParamFieldWithMode**

Props: `fieldKey`, `label`, `value`, `mode`, `onModeChange`, `onValueChange`, `multiline?`

UI：标签行右侧 toggle「固定 | 表达式」；expression 用 `textarea`；`onDrop` 读取 drag payload → `setFieldMode(..., 'expression')` + `onValueChange(buildDragExpression(...))`

- [ ] **Step 3: NodeEditorParamsPane 替换 string 字段**

对 `isStringFieldType(f.type)` 使用 `ParamFieldWithMode`；number/select/json 保持原控件。

- [ ] **Step 4: 测试 drag-expression 集成（可选组件测试）**

```typescript
// ParamFieldWithMode.test.tsx — fire drop event with dataTransfer mock
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): input data tree drag-to-expression and field mode toggle"
```

---

## Phase 5：收尾与文档

### Task 10: 样式、无障碍与 spec 状态

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `docs/superpowers/specs/2026-05-23-node-editor-modal-design.md`（状态 → Implemented，链到本 plan）
- Modify: `docs/ux-v1.0-checklist.md`（勾选相关 P0 项，若存在「节点详情」「调试日志」）

- [ ] **Step 1: 弹窗与树样式**

分隔条 4px、`cursor: col-resize`；树叶子 `cursor: grab`；modal `z-index: 1000`。

- [ ] **Step 2: 焦点陷阱（轻量）**

弹窗打开时 `modalRef.current?.focus()`；Tab 留在 modal 内（可选 `aria-modal="true"`）。

- [ ] **Step 3: 全量测试**

```bash
pnpm --filter @rxwf/sandbox test
pnpm --filter @rxwf/node-runner test
pnpm --filter @rxwf/web test
pnpm --filter @rxwf/web typecheck
```

- [ ] **Step 4: 手工验收清单**

1. 双击 Set 节点 → 三栏弹窗；拖 A 的 JSON 字段到 URL → 生成 `{{ $node["A"].json...] }}`
2. 执行后右侧与底部输出一致
3. Code 节点脚本：`$log.info('x')` → 底部「运行日志」Tab 可见
4. 重名节点名 → 标题下错误提示；保存被 validate 拒绝

- [ ] **Step 5: Commit**

```bash
git commit -m "docs: mark node editor modal spec implemented and polish editor styles"
```

---

## Spec 覆盖自检

| Spec § | Task |
|--------|------|
| 主界面两栏 + 底部日志 | Task 6 |
| 双击大弹窗三栏 splitter | Task 7–8 |
| 输入两级树 + 拖拽 | Task 4, 9 |
| 字符串固定/表达式 `_fieldModes` | Task 5, 9 |
| Code `$log` | Task 1–3 |
| ESC / JSON 错误阻止关闭 | Task 7–8 |
| localStorage 布局 | Task 7 |
| 单击选中更新日志 | Task 6–7 |

无 TBD 占位；`_fieldModes` 已在计划定稿。

---

## 执行方式

Plan 已保存至 `docs/superpowers/plans/2026-05-23-node-editor-modal.md`。

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每 Task 派发独立子代理，任务间你做验收  
2. **Inline Execution** — 本会话用 executing-plans 按 Task 批量实现并设检查点  

你更倾向哪一种？
