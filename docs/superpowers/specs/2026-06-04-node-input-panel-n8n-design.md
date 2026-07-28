# 节点 INPUT 面板（n8n 对齐）与统一表达式输入 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | Implemented — 2026-06-04；**2026-06-05 修订**：不实现 `$parameter` |
| **日期** | 2026-06-04 |
| **策略** | **方案 1 + 方案 3**：INPUT/OUTPUT 共享 `DataInspector`；参数与运行时统一 `{{ }}` 模板规则 |
| **关联** | [node-editor-modal](./2026-05-23-node-editor-modal-design.md)、[js-expression-globals](./2026-06-03-js-expression-globals-design.md)、[expression-guide](../../expression-guide.md) |
| **依赖** | `@rxwf/expression`、`@rxwf/sandbox`（Piscina 模式参考）、`apps/web` 节点弹窗 |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| INPUT 栏 | 前序节点列表 + 折叠 JSON 预览（`NodeEditorInputPane` / `InputDataTree`） |
| 视图 | 无 Schema / Table / JSON 切换、无搜索、无 item 计数、无上下文变量树 |
| 拖拽 | i18n 承诺「拖拽字段到参数」，但 INPUT 树**无** `onDragStart`；仅 `ParamFieldWithMode` 可接收拖放 |
| 参数模式 | `fixed` / `expression` / `fromAi` 三模式；IF 等支持裸表达式自动包 `{{ }}` |
| 表达式运行时 | 每个 `{{ }}` 段调用 `evaluateJsExpression` → **新建并销毁** isolated-vm isolate |
| `$parameter` | **不实现**（已明确移出产品范围） |
| `$now` / `$today` | 设计为 v1.1，未实现 |

### 1.2 目标（单期交付）

1. **INPUT 面板**对齐 n8n：Schema / Table / JSON、搜索、上游数据源选择、item 计数、**Variables and context**（`$now` / `$today` / `$execution` / `$workflow` / `$env` / `$vars`）、可拖拽字段路径。
2. **OUTPUT 面板**复用 `DataInspector` 的 Schema / Table / JSON，**仅展示输出 JSON**；不含 Variables and context；不可拖拽。
3. **参数栏**去掉 `fixed` / `expression` / `fromAi` 切换；统一为文本 + `{{ }}` 模板输入；**所有可编辑文本**（含 Code / JSON 的 CodeMirror）支持拖入表达式片段。
4. **运行时**：仅 `{{ }}` 进沙箱；无 `{{ }}` 为字面量快速路径；JSON 字段支持全文 `{{ }}` 替换后 `JSON.parse`，失败报错；`fromAi` 统一为 `{{ $fromAI(...) }}`。
5. **新增全局**：`$now`、`$today`（ISO 字符串）。
6. **表达式性能**：L1–L4 全部纳入本期（见 §6）。

### 1.3 非目标

- OUTPUT 面板拖拽表达式、OUTPUT 中展示 context 变量。
- n8n `$('Name')` 语法糖。
- Schema 输入时实时求值预览（边打边算）。
- Luxon 对象形态的 `$now` / `$today`（本期用 ISO 字符串）。
- 生产环境表达式调试 UI。

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 范围 | INPUT + 参数 + 运行时，**单期** |
| 架构 | 方案 1（全栈改造）+ 方案 3（`DataInspector` 共享组件） |
| 表达式语法 | **必须**写在 `{{ }}` 内；禁止裸 JS 整段进沙箱 |
| 无 `{{ }}` | 字面量，**零沙箱** |
| 混排示例 | `D:/xxx/prefix-{{ $itemIndex }}.html` |
| JSON 字段 | 全文可出现 `{{ }}`；替换后 `JSON.parse`；非法 JSON → `E1002` |
| Code 脚本 (`javascript`) | 仍为完整 JS，不走模板；但支持拖入 `{{ }}` 片段 |
| fromAi | 并入 `{{ $fromAI("key", "desc", "string") }}`，无独立模式 |
| 插入方式 | **仅拖拽**（点击只展开树） |
| 拖放目标 | 所有可编辑文本字段（含 CodeMirror） |
| `$now` / `$today` | 运行时实现 + INPUT 树实时预览 |
| `$parameter` | **不实现** |
| 性能优化 | **L1 + L2 + L3 + L4** 本期一起做 |
| 废弃 | `_fieldModes`（迁移后删除） |

---

## 3. UI 设计

### 3.1 共享组件 `DataInspector`

路径：`apps/web/src/features/editor/data-inspector/`

```ts
type DataInspectorView = 'schema' | 'table' | 'json';

interface DataInspectorSource {
  id: string;
  label: string;
  items: WorkflowItem[];
  icon?: 'node' | 'branch' | 'context';
}

interface DataInspectorProps {
  items: WorkflowItem[];           // 当前 active source 的 items
  sources: DataInspectorSource[];  // Schema 多根；Table/JSON 用 active
  activeSourceId?: string;
  onActiveSourceChange?: (id: string) => void;
  draggable?: boolean;
  buildDragExpression?: (path: string[], source: DataInspectorSource) => string;
  view?: DataInspectorView;
  onViewChange?: (v: DataInspectorView) => void;
  searchQuery?: string;
  showToolbar?: boolean;
}
```

| 子组件 | 职责 |
|--------|------|
| `DataInspectorToolbar` | 搜索 + Schema / Table / JSON |
| `DataInspectorSourceBar` | 上游下拉 + `N items` |
| `SchemaTreeView` | 类型图标、折叠、搜索过滤、拖拽 |
| `TableView` | 扁平行列；嵌套数组按 n8n 缩进 |
| `JsonView` | 只读 `JsonDataViewer` |
| `buildSchemaTree(items)` | 从 items 推断 schema |

**Schema 多 item 规则**：结构以 `items[0].json` 推断；标注 `(N items)`；值列显示首 item 预览。

### 3.2 INPUT：`InputDataPanel`

替换 `NodeEditorInputPane`。

```
┌─ INPUT ──────────────── [🔍] [Schema|Table|JSON] ─┐
│ [▼ Code in JavaScript    ]          4 items      │
├──────────────────────────────────────────────────┤
│ ▾ Code in JavaScript (4 items)                   │
│ ▾ Edit Fields (1 item)                           │
│ ▾ Variables and context                          │
│     T  $now    2026-06-04T...                     │
│     T  $today  2026-06-04T00:00:00...             │
│     {} $execution / $workflow / $env / $vars     │
└──────────────────────────────────────────────────┘
```

- **Schema**：所有前序节点 + Variables and context。
- **Table / JSON**：下拉选择**单个**上游数据源。
- **搜索**：过滤 Schema 路径名。
- **draggable=true**；MIME `application/x-rxwf-expr`（扩展 payload `kind`）。

**拖拽路径约定**

| 来源 | 插入示例 |
|------|----------|
| 前序节点字段 | `{{ $nodes["HTTP"].json.status }}` |
| 当前 item | `{{ $json.field }}` |
| 上下文 | `{{ $now }}`、`{{ $execution.id }}`、`{{ $vars.API_BASE }}` |

编辑器预览：`buildEditorContextGlobals(definition, nodeId, env, vars)` 填充 context 段。

### 3.3 OUTPUT：`OutputDataPanel`

改造 `NodeEditorOutputPane`：

- `httpRequest` 仍用 `HttpOutputPreview`。
- 多分支：SourceBar 选分支 → `DataInspector`。
- 单输出：直接 `DataInspector`。
- **draggable=false**；**无** Variables and context。
- 失败 / 未执行 / 空：保留现有 hint，不渲染 `DataInspector`。

### 3.4 参数栏：`ParamTemplateField`

替换 `ParamFieldWithMode`（`text` / `textarea` / `expression` 类型）。

| 变更 | 说明 |
|------|------|
| 移除 | fixed / expression / fromAi 按钮 |
| 保留 | 单行/多行 textarea；`JsonParamEditor`；`CodeJsEditor` |
| 拖放 | `useExpressionDropTarget`：CodeMirror 光标 / textarea `selectionStart` 插入 |
| 占位符 | `{{ $json.id }}`、`prefix-{{ $itemIndex }}.html`、`{{ $fromAI("query", "...", "string") }}` |

| `ParamField.type` | 编辑器 | 求值 |
|-------------------|--------|------|
| text / textarea / expression | `ParamTemplateField` | `resolveTemplateString` |
| json | `JsonParamEditor` + drop | `resolveTemplateJson` |
| javascript | `CodeJsEditor` + drop | Code 沙箱（非模板） |
| number / select / credential | 不变 | 不走模板 |

---

## 4. 运行时与全局变量

### 4.1 模板求值规则

```ts
// 字符串字段
async function resolveFieldString(raw: string, ctx: ExpressionContext): Promise<string> {
  if (!hasTemplateSyntax(raw)) return raw;           // L0 快速路径
  return resolveTemplateString(raw, ctx);            // 仅 {{ }} 段进沙箱
}

// JSON 字段
async function resolveFieldJson(raw: string, ctx: ExpressionContext): Promise<Record<string, unknown>> {
  if (!hasTemplateSyntax(raw)) {
    return JSON.parse(raw || '{}');
  }
  const resolved = await resolveTemplateString(raw, ctx);
  try {
    return JSON.parse(resolved);
  } catch {
    throw new AwfError('E1002', 'Expression did not resolve to valid JSON');
  }
}
```

- 删除 `isFieldExpressionMode`、`ensureIfConditionTemplate` 自动包裹裸表达式。
- IF `condition` 必须由用户书写 `{{ ... }}`；迁移见 §5。

### 4.2 新增全局

| 全局 | 类型 | 说明 |
|------|------|------|
| `$now` | `string` | 求值时刻 `new Date().toISOString()`；同一会话内固定 |
| `$today` | `string` | 本地时区当日 00:00 的 ISO 字符串 |

**不实现 `$parameter`**：当前节点其他参数字段不作为表达式全局暴露，避免循环依赖与 UI 复杂度。

### 4.3 废弃 `_fieldModes`

- 保存 workflow 时 strip `_fieldModes`。
- `scanExpressionSources` 不再读 mode；扫描所有含 `{{ }}` / `$fromAI` 的字符串。

---

## 5. 数据迁移

在 `normalizeWorkflowDefinition`（或 editor load）幂等执行：

| 旧形态 | 迁移 |
|--------|------|
| `_fieldModes.x = 'expression'`，值无 `{{ }}` | 包为 `{{ ... }}`（若已是合法整段模板则不动） |
| `_fieldModes.x = 'fromAi'` | 转为 `{{ $fromAI(...) }}` |
| `_fieldModes.x = 'fixed'` | 删 mode，值不动 |
| IF `condition` 裸表达式 | 包为 `{{ ... }}` |
| 任意 | 删除 `_fieldModes` |

---

## 6. 表达式性能优化（L1–L4，本期）

### 6.1 问题

每次 `evaluateJsExpression` 当前流程：`new Isolate` → `createContext` → 编译 bootstrap → 编译用户脚本 → `dispose`。

一段含 3 个 `{{ }}` 的字符串 ≈ 3 次 isolate；同 item 上 5 个字段 ≈ 5 次 isolate。

### 6.2 L1 — 单字符串多段合并

`resolveTemplateString` 对同一字符串内所有 `{{ }}` 使用**一个**求值会话，循环 `evaluate`，而非每段新建 isolate。

### 6.3 L2 — 单 item 多字段会话

node-runner 在 per-item 循环内：

```ts
const session = await ExpressionEvaluator.open(itemCtx);
try {
  url = await session.resolveString(config.url);
  body = await session.resolveString(config.body);
  headers = await session.resolveJson(config.headers);
} finally {
  await session.close();
}
```

### 6.4 L3 — Worker 线程 isolate 池

参考 `@rxwf/sandbox` 的 Piscina 模式，新增表达式专用 worker 池：

| 项 | 说明 |
|----|------|
| 包路径 | `packages/expression/src/js-sandbox/expression-pool.ts`、`expression-worker.ts` |
| 池配置 | `RXWF_EXPR_POOL_MIN_THREADS`、`RXWF_EXPR_POOL_MAX_THREADS`、`RXWF_EXPR_POOL_IDLE_TIMEOUT_MS`（默认对齐 sandbox） |
| Worker 内 | 每线程持有 **1 个持久 `ivm.Isolate`**（可配置每线程 1 slot） |
| 主线程 API | `evaluateJsExpression` / `ExpressionEvaluator` 通过 Piscina 派发 |
| 隔离 | 用户代码不跨任务残留；每任务 `resetContext` + 新编译用户脚本 |

### 6.5 L4 — Bootstrap 预编译 + 数据注入

将 `BOOTSTRAP_SCRIPT` 改为两阶段：

1. **Worker 启动时**（每 isolate 一次）：编译静态 bootstrap，从 global `__bootstrapData` 读取数据并定义 `$json`、`$input`、`$nodes` 等。
2. **每次 resetContext**：`jail.set('__bootstrapData', new ivm.ExternalCopy(data).copyInto())` → `await cachedBootstrap.run(context)`。

用户表达式脚本仍**每次编译**（内容不固定）；省略的是 isolate 创建与 bootstrap **字符串替换再编译**。

### 6.6 合并架构

```
主线程                          Piscina Worker 线程
────────                        ────────────────────
ExpressionEvaluator.open(ctx)
  └─ pool.run({ op: 'open', data })  →  acquire slot.isolate
                                       cachedBootstrap.run(data)
ExpressionEvaluator.eval(src)
  └─ pool.run({ op: 'eval', src })   →  compileScript(user) + run
ExpressionEvaluator.close()
  └─ pool.run({ op: 'close' })       →  release slot（isolate 保留）

批量：pool.run({ op: 'batch', data, sources[] })  →  一次 reset + N eval
```

**`$now` 会话语义**：在 `open` / `batch` 的 `resetContext` 时计算一次，同会话内一致。

### 6.7 预期收益

| 场景 | 优化前 | L1–L4 后 |
|------|--------|----------|
| 纯字面量字段 | 0 isolate | 0 |
| 1 字段 3 个 `{{ }}` | 3 isolate | 1 worker 调用，1 reset |
| 5 字段各 1 个 `{{ }}`，同 item | 5 isolate | 1 session，1 reset |
| 1000 items × 5 字段 | ~5000 isolate 创建 | ~1000 reset（池化复用 isolate） |

### 6.8 回退与测试

- 环境变量 `RXWF_EXPR_POOL_DISABLED=1`：回退主线程单 isolate 逻辑（仅用于调试）。
- 基准测试：`expression-pool.bench.ts` 对比优化前后 1000 次 `$json.id` 求值。
- 正确性：现有 `evaluate-js.test.ts`、`resolve-template.test.ts` 全通过；新增 pool 集成测试。

---

## 7. 文件变更清单（概要）

| 区域 | 文件 |
|------|------|
| UI 共享 | `data-inspector/*`、`build-schema-tree.ts`、`build-editor-context-globals.ts` |
| INPUT | `InputDataPanel.tsx`（替换 `NodeEditorInputPane.tsx`） |
| OUTPUT | `NodeEditorOutputPane.tsx`、`DebugOutputPreview.tsx` 精简 |
| 参数 | `ParamTemplateField.tsx`、`use-expression-drop-target.ts`；删除/废弃 `ParamFieldWithMode.tsx` |
| 拖放 | `drag-expression.ts` 扩展 payload |
| 表达式 | `expression-pool.ts`、`expression-worker.ts`、`expression-evaluator.ts`；改 `evaluate-js.ts`、`build-globals.ts` |
| 类型 | `expression/src/types.ts`（`parameter`） |
| 运行时 | `resolve-config-string-field.ts`、`if-condition.ts`、`json.ts` executor |
| 迁移 | `normalize-workflow-definition.ts` 或 editor load hook |
| 文档 | `expression-guide.md`、`code-node-guide.md` |
| i18n | `catalog-ui-ext.ts` |

---

## 8. 测试计划

| 层 | 用例 |
|----|------|
| `buildSchemaTree` | 嵌套 object/array、多 item、空对象 |
| `resolveTemplateJson` | 全文 `{{ }}`、混排、非法 JSON 报错 |
| `$now` / `$today` | 沙箱可访问、会话一致性 |
| `ExpressionEvaluator` + pool | batch eval、并发、disabled 回退 |
| 迁移 | 含 `_fieldModes` 的历史 workflow 快照 |
| UI | 三视图切换、拖拽插入、OUTPUT 无 context |

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Piscina + ivm 在 worker 内内存占用 | 限制 maxThreads；isolate memoryLimit 32MB；idle 回收 |
| 参数互相引用需求 | 使用 `$json` / `$nodes` / `$vars`，不提供 `$parameter` |
| 旧 workflow 裸表达式 | 迁移 + 静态扫描告警 |
| JSON 全文模板难编辑 | JSON 编辑器保留语法高亮；错误信息指向 parse 失败位置（后续可增强） |

---

## 10. 实施顺序建议

1. 表达式运行时：L1–L4 + `$now`/`$today` + 模板规则统一  
2. workflow 迁移与 `_fieldModes` 移除  
3. `DataInspector` 组件  
4. `InputDataPanel` + 拖拽  
5. `OutputDataPanel`  
6. `ParamTemplateField` + CodeMirror drop  
7. 文档与 i18n  

---

*评审通过后，使用 `writing-plans` skill 生成实施计划。*
