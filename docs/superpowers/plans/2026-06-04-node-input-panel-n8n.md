# 节点 INPUT 面板（n8n 对齐）与统一表达式输入 Implementation Plan

> **Status:** ✅ Implemented (2026-06-04)；**2026-06-05 修订**：`$parameter` 不实现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对齐 n8n 节点编辑器的 INPUT/OUTPUT 数据检视（Schema/Table/JSON）、统一参数栏为 `{{ }}` 模板输入、实现 `$now`/`$today` 与表达式池化性能优化（L1–L4）。

**Architecture:** 后端先在 `@rxwf/expression` 落地 `ExpressionEvaluator` + Piscina worker 池（L3/L4）与模板规则统一；`@rxwf/workflow` 做 `_fieldModes` 迁移；`apps/web` 新增共享 `DataInspector`，INPUT 含 context 树可拖拽，OUTPUT 仅 JSON 数据检视；参数栏 `ParamTemplateField` 全字段拖放。

**Tech Stack:** React 19、`@uiw/react-codemirror`、`isolated-vm`、`piscina`、Vitest、`@rxwf/expression`、`@rxwf/node-runner`。

**Spec:** [2026-06-04-node-input-panel-n8n-design.md](../specs/2026-06-04-node-input-panel-n8n-design.md)

---

## File map

| Path | Responsibility |
|------|----------------|
| `packages/expression/src/js-sandbox/build-globals.ts` | L4 bootstrap、`$now`/`$today` |
| `packages/expression/src/js-sandbox/expression-worker.ts` | Worker 内持久 isolate + batch eval |
| `packages/expression/src/js-sandbox/expression-pool.ts` | Piscina 池、主线程 API |
| `packages/expression/src/js-sandbox/expression-evaluator.ts` | L1/L2 会话：`open`/`evaluate`/`close` |
| `packages/expression/src/js-sandbox/evaluate-js.ts` | 委派 pool；`RXWF_EXPR_POOL_DISABLED` 回退 |
| `packages/expression/src/resolve-template.ts` | L1 单字符串单会话；JSON 全文替换 |
| `packages/workflow/src/normalize-node-parameters.ts` | `_fieldModes` 迁移（新建） |
| `packages/node-runner/src/expression/resolve-config-string-field.ts` | 去掉 mode 分支 |
| `packages/node-runner/src/expression/item-context.ts` | 传入 `parameter` |
| `packages/node-runner/src/expression/expression-session.ts` | L2 per-item 会话 helper（新建） |
| `apps/web/src/features/editor/data-inspector/*` | 共享检视组件 |
| `apps/web/src/features/editor/InputDataPanel.tsx` | 替换 `NodeEditorInputPane` |
| `apps/web/src/features/editor/ParamTemplateField.tsx` | 替换 `ParamFieldWithMode` |
| `apps/web/src/features/editor/use-expression-drop-target.ts` | CodeMirror/textarea 拖放 |
| `apps/web/src/features/editor/build-editor-context-globals.ts` | INPUT context 预览 |

---

## Task 1: 扩展 `ExpressionContext` 与 bootstrap 全局（`$now` / `$today`）

> **修订（2026-06-05）**：`$parameter` 已从产品与文档中移除；下文历史步骤中的 `parameter` 相关描述不再适用。

**Files:**
- Modify: `packages/expression/src/types.ts`
- Modify: `packages/expression/src/js-sandbox/build-globals.ts`
- Modify: `packages/expression/src/js-sandbox/expression-globals-runtime.ts`
- Test: `packages/expression/src/js-sandbox/expression-globals-runtime.test.ts`

- [ ] **Step 1: Write failing tests for new globals**

在 `expression-globals-runtime.test.ts` 追加：

```ts
it('exposes $now, $today, $parameter on globals', () => {
  const fixed = new Date('2026-06-04T15:30:00.000Z');
  const globals = createExpressionGlobals(
    buildBootstrapData({
      json: {},
      nowIso: fixed.toISOString(),
      todayIso: '2026-06-04T00:00:00.000Z',
      parameter: { url: 'https://x', nested: { a: 1 } },
    }),
  );
  expect(globals.$now).toBe(fixed.toISOString());
  expect(globals.$today).toBe('2026-06-04T00:00:00.000Z');
  expect(globals.$parameter).toEqual({ url: 'https://x', nested: { a: 1 } });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/expression && pnpm test -- src/js-sandbox/expression-globals-runtime.test.ts
```

Expected: FAIL — `$now` / `parameter` 未定义

- [ ] **Step 3: Implement types and bootstrap**

`types.ts` — `ExpressionContext` 增加：

```ts
parameter?: Readonly<Record<string, unknown>>;
/** 会话级；省略则由 buildBootstrapData 在 reset 时计算 */
nowIso?: string;
todayIso?: string;
```

`build-globals.ts` — `SandboxBootstrapData` 增加 `nowIso`, `todayIso`, `parameter`；`BOOTSTRAP_SCRIPT` 增加：

```js
const $now = $__data.nowIso;
const $today = $__data.todayIso;
const $parameter = $__data.parameter ?? {};
```

`buildBootstrapData` 默认：

```ts
const now = context.nowIso ?? new Date().toISOString();
const today = context.todayIso ?? startOfLocalDayIso();
```

新增 `startOfLocalDayIso()` 于同文件（本地时区 00:00 → ISO）。

- [ ] **Step 4: Run tests**

```bash
cd packages/expression && pnpm test -- src/js-sandbox/expression-globals-runtime.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/expression/src/types.ts packages/expression/src/js-sandbox/build-globals.ts packages/expression/src/js-sandbox/expression-globals-runtime.ts packages/expression/src/js-sandbox/expression-globals-runtime.test.ts
git commit -m "feat(expression): add \$now, \$today, and \$parameter globals"
```

---

## Task 2: L4 bootstrap 预编译 + L3 Piscina worker 池

**Files:**
- Create: `packages/expression/src/js-sandbox/expression-worker.ts`
- Create: `packages/expression/src/js-sandbox/expression-pool.ts`
- Create: `packages/expression/src/js-sandbox/expression-pool.test.ts`
- Modify: `packages/expression/src/js-sandbox/build-globals.ts`（`BOOTSTRAP_SCRIPT` 读 `globalThis.__bootstrapData`）
- Modify: `packages/expression/src/js-sandbox/evaluate-js.ts`
- Modify: `packages/expression/package.json`（添加 `piscina` 依赖）

- [ ] **Step 1: Refactor BOOTSTRAP_SCRIPT for L4**

将 `__BOOTSTRAP_JSON__` 替换为运行时注入：

```js
const $__data = globalThis.__bootstrapData;
if (!$__data) throw new Error('bootstrap data missing');
// ... 其余不变
```

- [ ] **Step 2: Write failing pool integration test**

`expression-pool.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { evaluateViaPool } from './expression-pool.js';

describe('expression-pool', () => {
  it('evaluates $json field in worker isolate', async () => {
    const v = await evaluateViaPool('$json.id', {
      json: { id: 'abc' },
    });
    expect(v).toBe('abc');
  });

  it('batch evaluates multiple sources in one reset', async () => {
    const [a, b] = await evaluateViaPoolBatch(['$json.a', '$json.b'], {
      json: { a: 1, b: 2 },
    });
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/expression && pnpm test -- src/js-sandbox/expression-pool.test.ts
```

- [ ] **Step 4: Implement worker + pool**

`expression-worker.ts`（每线程单例 slot）：

```ts
interface WorkerSlot {
  isolate: ivm.Isolate;
  context: ivm.Context;
  bootstrapScript: ivm.Script;
}

let slot: WorkerSlot | null = null;

function getSlot(): WorkerSlot {
  if (!slot) {
    const isolate = new ivm.Isolate({ memoryLimit: 32 });
    const context = isolate.createContextSync();
    const bootstrapScript = isolate.compileScriptSync(BOOTSTRAP_SCRIPT);
    slot = { isolate, context, bootstrapScript };
  }
  return slot;
}

async function resetContext(data: SandboxBootstrapData) {
  const { context, bootstrapScript } = getSlot();
  const jail = context.global;
  await jail.set('__bootstrapData', new ivm.ExternalCopy(data).copyInto());
  await bootstrapScript.run(context);
}

export default async function expressionWorker(
  payload: { op: 'eval'; source: string; data: SandboxBootstrapData }
    | { op: 'batch'; sources: string[]; data: SandboxBootstrapData },
) {
  // resetContext → compileScript(wrapExpressionSource) → run
}
```

`expression-pool.ts`：参考 `packages/sandbox/src/run-in-sandbox.ts` 创建 Piscina；导出 `evaluateViaPool`、`evaluateViaPoolBatch`；`RXWF_EXPR_POOL_DISABLED=1` 时主线程直调 fallback。

`evaluate-js.ts` 改为调用 pool（默认路径）。

- [ ] **Step 5: Build and test**

```bash
cd packages/expression && pnpm run build && pnpm test
```

Expected: 全部 PASS（含既有 `evaluate-js.test.ts`）

- [ ] **Step 6: Commit**

```bash
git add packages/expression/package.json packages/expression/src/js-sandbox/
git commit -m "perf(expression): add Piscina worker pool with cached bootstrap"
```

---

## Task 3: `ExpressionEvaluator` 会话（L1 + L2）

**Files:**
- Create: `packages/expression/src/js-sandbox/expression-evaluator.ts`
- Create: `packages/expression/src/js-sandbox/expression-evaluator.test.ts`
- Modify: `packages/expression/src/resolve-template.ts`
- Modify: `packages/expression/src/index.ts`
- Create: `packages/node-runner/src/expression/expression-session.ts`

- [ ] **Step 1: Write failing tests**

`expression-evaluator.test.ts`：

```ts
it('reuses session for multiple template segments', async () => {
  const session = await ExpressionEvaluator.open({ json: { a: 1, b: 2 } });
  try {
    const out = await session.resolveTemplateString('{{ $json.a }}-{{ $json.b }}');
    expect(out).toBe('1-2');
  } finally {
    await session.close();
  }
});

it('$now is stable within session', async () => {
  const session = await ExpressionEvaluator.open({ json: {} });
  const a = await session.evaluate('$now');
  const b = await session.evaluate('$now');
  expect(a).toBe(b);
  await session.close();
});
```

`resolve-template.test.ts` 追加：3 段 `{{ }}` 字符串一次 resolve。

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement `ExpressionEvaluator`**

```ts
export class ExpressionEvaluator {
  private constructor(private readonly data: SandboxBootstrapData, private readonly poolHandle: unknown) {}
  static async open(ctx: ExpressionContext): Promise<ExpressionEvaluator>;
  async evaluate(source: string): Promise<unknown>;
  async resolveTemplateString(value: string): Promise<string>;
  async resolveTemplateJson(raw: string): Promise<Record<string, unknown>>;
  async close(): Promise<void>;
}
```

`resolve-template.ts` — 新增可选参数 `session?: ExpressionEvaluator`；内部对 `EMBEDDED_TEMPLATE_RE` 循环使用同一会话。

`expression-session.ts`（node-runner）：

```ts
export async function withItemExpressionSession<T>(
  ctx: NodeExecutionContext,
  item: WorkflowItem,
  itemIndex: number,
  fn: (session: ExpressionEvaluator) => Promise<T>,
): Promise<T>;
```

构建 `itemCtx` 时注入 `parameter: stripFieldModes(ctx.config)`。

- [ ] **Step 4: Run full expression + node-runner tests**

```bash
cd packages/expression && pnpm test
cd packages/node-runner && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(expression): add ExpressionEvaluator session for L1/L2 batching"
```

---

## Task 4: 统一模板求值规则与 JSON 全文替换

**Files:**
- Modify: `packages/expression/src/resolve-template.ts`
- Modify: `packages/expression/src/resolve-template.test.ts`
- Modify: `packages/node-runner/src/expression/resolve-config-string-field.ts`
- Modify: `packages/node-runner/src/executors/control-flow/if-condition.ts`
- Modify: `packages/node-runner/src/executors/transform/json.ts`
- Modify: `packages/expression/src/scan-expression-sources.ts`

- [ ] **Step 1: Write failing JSON full-text template tests**

```ts
it('resolves non-string JSON template positions', async () => {
  const raw = '{ "count": {{ $json.count }}, "name": "x-{{ $itemIndex }}" }';
  const out = await resolveTemplateJson(raw, { json: { count: 3 }, itemIndex: 1 });
  expect(out).toEqual({ count: 3, name: 'x-1' });
});

it('throws E1002 when resolved JSON is invalid', async () => {
  await expect(
    resolveTemplateJson('{ "x": {{ undefinedVar }} }', { json: {} }),
  ).rejects.toMatchObject({ code: 'E1002' });
});
```

- [ ] **Step 2: Implement `resolveTemplateJson` per spec §4.1**

有 `hasTemplateSyntax` → `resolveTemplateString` → `JSON.parse`；无模板 → 直接 parse。

- [ ] **Step 3: Remove `_fieldModes` from resolution paths**

`resolve-config-string-field.ts` — 删除 `isFieldExpressionMode`；统一 `hasTemplateSyntax` 分支。

`if-condition.ts` — 删除 `isConditionExpressionMode` / `ensureIfConditionTemplate` 自动包裹；`resolveIfConditionTemplate` 仅 `normalizeExpressionTemplate`，无 `{{ }}` 的条件在 execute 时报错。

`scan-expression-sources.ts` — `walkValue` 不再读 `fieldMode`；凡字符串含 `{{` 或 `$fromAI` 即收集。

- [ ] **Step 4: Run tests**

```bash
cd packages/expression && pnpm test
cd packages/node-runner && pnpm test -- src/executors/control-flow/if.test.ts src/executors/transform/json.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(expression): unify template-only resolution and JSON full-text templates"
```

---

## Task 5: Workflow 参数迁移（`_fieldModes` 移除）

**Files:**
- Create: `packages/workflow/src/normalize-node-parameters.ts`
- Create: `packages/workflow/src/normalize-node-parameters.test.ts`
- Modify: `packages/workflow/src/index.ts`（export）
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`（load 时调用）

- [ ] **Step 1: Write failing migration tests**

```ts
it('wraps bare expression mode value in {{ }}', () => {
  const node = {
    id: '1', name: 'N', type: 'httpRequest',
    parameters: {
      url: '$json.id',
      _fieldModes: { url: 'expression' },
    },
  };
  const out = normalizeNodeParameters(node);
  expect(out.parameters.url).toBe('{{ $json.id }}');
  expect(out.parameters._fieldModes).toBeUndefined();
});

it('is idempotent for already-wrapped templates', () => {
  const node = { parameters: { url: '{{ $json.id }}' } };
  expect(normalizeNodeParameters(node).parameters.url).toBe('{{ $json.id }}');
});
```

- [ ] **Step 2: Implement `normalizeNodeParameters` / `normalizeWorkflowDefinition`**

规则见 spec §5；`fromAi` 字段若无法还原 `$fromAI` 调用则保留原文字并 `console.warn`（测试覆盖）。

- [ ] **Step 3: Wire editor load**

`WorkflowEditorPage` 在 `setDefinition` 前 `normalizeWorkflowDefinition(def)`。

- [ ] **Step 4: Run tests**

```bash
cd packages/workflow && pnpm test -- src/normalize-node-parameters.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(workflow): migrate _fieldModes to unified {{ }} templates"
```

---

## Task 6: `buildSchemaTree` 与 `DataInspector` 共享组件

**Files:**
- Create: `apps/web/src/features/editor/data-inspector/build-schema-tree.ts`
- Create: `apps/web/src/features/editor/data-inspector/build-schema-tree.test.ts`
- Create: `apps/web/src/features/editor/data-inspector/SchemaTreeView.tsx`
- Create: `apps/web/src/features/editor/data-inspector/TableView.tsx`
- Create: `apps/web/src/features/editor/data-inspector/JsonView.tsx`
- Create: `apps/web/src/features/editor/data-inspector/DataInspectorToolbar.tsx`
- Create: `apps/web/src/features/editor/data-inspector/DataInspectorSourceBar.tsx`
- Create: `apps/web/src/features/editor/data-inspector/DataInspector.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write failing schema tree tests**

```ts
it('builds nested object and array nodes from first item', () => {
  const tree = buildSchemaTree([{ json: { a: 1, items: [{ b: 2 }] } }]);
  expect(tree).toMatchObject([
    { key: 'a', type: 'number', path: ['a'] },
    { key: 'items', type: 'array', path: ['items'], children: expect.any(Array) },
  ]);
});
```

- [ ] **Step 2: Implement `buildSchemaTree` + views**

`SchemaTreeNode` 类型：`key`, `type`, `path`, `preview`, `children?`。

`SchemaTreeView`：类型图标（T/#/{}/[]）、折叠、`draggable` 时 `onDragStart` 设置 `RXWF_EXPR_DRAG_MIME`。

`TableView`：第一行表头为 keys；数组列展开子行（参考 n8n 截图）。

- [ ] **Step 3: Compose `DataInspector`**

受控 `view` + `searchQuery`；`activeSourceId` 切换 Table/JSON 数据源。

- [ ] **Step 4: Run tests + lint**

```bash
cd apps/web && pnpm test -- src/features/editor/data-inspector/build-schema-tree.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add shared DataInspector with schema/table/json views"
```

---

## Task 7: `InputDataPanel` + context 树 + 拖拽

**Files:**
- Create: `apps/web/src/features/editor/build-editor-context-globals.ts`
- Create: `apps/web/src/features/editor/InputDataPanel.tsx`
- Modify: `apps/web/src/features/editor/drag-expression.ts`
- Modify: `apps/web/src/features/editor/NodeEditorModal.tsx`
- Delete: `apps/web/src/features/editor/NodeEditorInputPane.tsx`（由新文件替代）
- Delete: `apps/web/src/features/editor/InputDataTree.tsx`（逻辑并入 data-inspector）

- [ ] **Step 1: Extend drag payload**

`drag-expression.ts`：

```ts
export type ExprDragKind = 'nodes' | 'json' | 'context';

export interface AwfExprDragPayload {
  kind: ExprDragKind;
  nodeName?: string;
  path: string[];
  expression: string; // 完整可插入文本，如 {{ $now }}
}

export function buildContextDragExpression(path: string[]): string {
  return `{{ ${path.join('.')} }}`;
}
```

- [ ] **Step 2: Implement `buildEditorContextGlobals`**

返回 `DataInspectorSource` 的 context 段：`$now`、`$today`、`$execution`、`$workflow`、`$env`、`$vars`（从 settings API 或已有 editor 状态读取 test 环境值；**不含** `$parameter`）。

- [ ] **Step 3: Implement `InputDataPanel`**

组合 predecessors → sources + context source；`draggable={true}`；`buildDragExpression` 按 kind 生成表达式。

- [ ] **Step 4: Wire `NodeEditorModal`**

替换 `NodeEditorInputPane` import。

- [ ] **Step 5: Manual smoke**

启动 `pnpm dev`，打开非触发器节点弹窗，确认三视图、context 树、拖拽 MIME 写入剪贴板/拖放目标。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): n8n-style InputDataPanel with context tree and drag"
```

---

## Task 8: `OutputDataPanel` 集成 `DataInspector`

**Files:**
- Modify: `apps/web/src/features/editor/NodeEditorOutputPane.tsx`
- Modify: `apps/web/src/features/editor/DebugOutputPreview.tsx`

- [ ] **Step 1: Replace JSON-only preview with DataInspector**

单输出：`DataInspector` `draggable={false}`，`sources=[{ id: 'output', label: 'Output', items }]`。

多分支：每个 branch 一个 source；`SourceBar` 切换。

- [ ] **Step 2: Verify no context section**

断言 `sources` 不含 `icon: 'context'`。

- [ ] **Step 3: Keep `HttpOutputPreview` branch**

`httpRequest` 成功时仍走 HTTP 专用 UI。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): Output pane uses DataInspector without context vars"
```

---

## Task 9: `ParamTemplateField` + 全字段拖放

**Files:**
- Create: `apps/web/src/features/editor/ParamTemplateField.tsx`
- Create: `apps/web/src/features/editor/use-expression-drop-target.ts`
- Modify: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`
- Modify: `apps/web/src/features/editor/CodeJsEditor.tsx`
- Modify: `apps/web/src/features/editor/JsonParamEditor.tsx`
- Delete: `apps/web/src/features/editor/ParamFieldWithMode.tsx`
- Delete: `apps/web/src/features/editor/field-modes.ts`（若仅编辑器使用；runner 侧已移除）
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`

- [ ] **Step 1: Implement `useExpressionDropTarget`**

```ts
export function useExpressionDropTarget(
  onInsert: (text: string, at: number) => void,
  getSelection: () => number,
): { onDragOver: ...; onDrop: ... };
```

CodeMirror：通过 `EditorView` ref `dispatch` `insert` at `state.selection.main.head`。

- [ ] **Step 2: Implement `ParamTemplateField`**

无 mode toggle；textarea + drop；placeholder 含 `{{ $json.id }}` 示例。

- [ ] **Step 3: Wire `NodeEditorParamsPane`**

所有 `isStringFieldType` 字段改用 `ParamTemplateField`；移除 `getFieldMode` / `setFieldMode` 调用。

`CodeJsEditor` / `JsonParamEditor` 接入同一 drop hook。

- [ ] **Step 4: Update i18n**

移除 `editor.mode.fixed` / `expression` / `fromAi` 若不再使用；更新 `editor.inputPaneHint`。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): unified ParamTemplateField with drag-drop on all text editors"
```

---

## Task 10: 文档、spec 交叉引用与全量回归

**Files:**
- Modify: `docs/expression-guide.md`
- Modify: `docs/code-node-guide.md`
- Modify: `docs/superpowers/specs/2026-06-03-js-expression-globals-design.md`（`$now`/`$today` 状态；`$parameter` 不实现）
- Modify: `packages/sandbox/src/sandbox-globals.ts`（Code 节点同步 `$now`/`$today`）

- [ ] **Step 1: Update expression-guide**

- 仅 `{{ }}` 动态语法；移除裸表达式模式说明
- 文档化 `$now`、`$today`；明确 **不提供** `$parameter`
- JSON 字段全文模板规则

- [ ] **Step 2: Run monorepo tests**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: update expression guide for unified templates and new globals"
```

---

## Spec coverage self-review

| Spec § | Task |
|--------|------|
| §3.1 DataInspector | Task 6 |
| §3.2 InputDataPanel | Task 7 |
| §3.3 OutputDataPanel | Task 8 |
| §3.4 ParamTemplateField | Task 9 |
| §4.1 模板规则 | Task 4 |
| §4.2 新全局 | Task 1 |
| §4.3 废弃 `_fieldModes` | Task 4, 5 |
| §5 迁移 | Task 5 |
| §6 L1–L4 | Task 2, 3 |
| §6.8 回退/基准 | Task 2 (`RXWF_EXPR_POOL_DISABLED`) |
| 拖放仅 INPUT | Task 7, 9 |
| OUTPUT 无 context | Task 8 |
| fromAi → `$fromAI` | Task 4, 5, 9 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-node-input-panel-n8n.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派发独立 subagent，任务间人工/主 agent 复核  
2. **Inline Execution** — 本会话按 Task 顺序直接实现，checkpoint 复核

**Which approach?**
