# 工作流节点弹窗编辑器与底部日志 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | **Implemented** — 实施计划 [2026-05-23-node-editor-modal.md](../plans/2026-05-23-node-editor-modal.md) |
| **日期** | 2026-05-23 |
| **策略** | **方案 A：组件化重构**（`apps/web` 新增弹窗/日志组件，移除主界面右侧属性栏） |
| **关联 PRD** | [spec.md](../../spec.md) FR-1 编辑器、FR-11 调试 |
| **关联 UX** | [ux-ui-design.md](../../ux-ui-design.md)、[ux-v1.0-checklist.md](../../ux-v1.0-checklist.md) |
| **依赖能力** | 节点名唯一、`$node["名称"].json` 前序引用（已实现，见 validate + expression + execution） |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| 布局 | `WorkflowEditorPage` 三栏：`NodePalette` \| `WorkflowCanvas` \| `NodePropertiesPanel`（`grid: 200px 1fr 280px`） |
| 节点编辑 | 单击选中后在右侧 Tab（参数 / 输入 / 输出）编辑 |
| 调试数据 | `nodeDebug`、`pinData`；`executeNode` 局部调试 |
| Code 节点 | `@rxwf/sandbox` 执行，**无**用户可见运行日志 |
| 表达式 | 支持 `$json`、`$env`、`$node["节点名"].json.*` |

### 1.2 目标

1. **主界面**：去掉右侧属性面板；画布区扩大；**底部可折叠日志条**展示选中节点的输入/输出（只读）。
2. **节点编辑**：**双击**节点打开居中大弹窗（约 90% 视口），布局对标 n8n：标题可改节点名，左输入 / 中参数 / 右输出，**三栏可拖拽调整宽度**。
3. **输入树**：两级——前序节点名称 → 该节点 JSON；支持拖到字符串参数生成表达式。
4. **参数模式**：所有 **字符串类** 参数支持 **固定值 / 表达式** 切换（v1 不覆盖 number、select、json 的拖拽）。
5. **Code 日志**：沙箱注入 **`$log.info|warn|error`**，调试执行结果回传并在底部「运行日志」展示（v1 不拦截 `console.log`）。

### 1.3 非目标（v1）

- 全字段 schema 级表达式声明（延后，当前按「所有 string 参数」规则）
- `$node["X"].all()`、item 下标配对
- 生产执行持久化 Code 日志（仅调试路径）
- 独立路由页编辑节点（方案 B，已否决）
- 嵌入 n8n UI（方案 C，已否决）

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 主界面布局 | 两栏（节点面板 + 画布）+ **底部日志** |
| 属性容器 | **居中大弹窗**，ESC 关闭 |
| Code 日志 | **`$log` 统一 API** |
| 拖拽范围 | **所有字符串类** 参数字段 |
| 实现策略 | **方案 A：组件化重构** |

---

## 3. 架构与组件

### 3.1 主界面结构

```
WorkflowEditorPage
├── EditorToolbar
├── editor-main (flex column, flex 1)
│   ├── editor-grid (200px | 1fr)     ← 去掉 properties-panel
│   │   ├── NodePalette
│   │   └── WorkflowCanvas
│   └── EditorLogPanel                ← 新增
│       ├── header（点击展开/收拢）
│       └── body（可垂直 resize）
│           ├── Tab/区：输入（只读 JSON）
│           ├── Tab/区：输出（只读 JSON）
│           └── Tab/区：运行日志（Code 且有 logs 时）
└── NodeEditorModal（portal，双击打开）
```

### 3.2 新增/重构组件

| 组件 | 职责 |
|------|------|
| `NodeEditorModal` | 弹窗壳层：标题、执行/删除/关闭、三栏 splitter 容器 |
| `NodeEditorInputPane` | 前序节点两级树；拖拽源 |
| `NodeEditorParamsPane` | 参数表单；从 `NodePropertiesPanel` 抽离 |
| `NodeEditorOutputPane` | 只读输出 JSON 树 |
| `EditorLogPanel` | 底部日志；绑定 `selectedNodeId` + `nodeDebug` |
| `ParamFieldWithMode` | 字符串字段：固定值 ↔ 表达式 + drop target |
| `InputDataTree` | 树 UI + `buildDragExpression(nodeName, path)` |
| `useEditorLayoutPrefs` | localStorage：日志高度、收拢状态、弹窗 splitter 比例 |

### 3.3 交互规则

| 操作 | 行为 |
|------|------|
| 单击节点 | `setSelectedNodeId`；更新底部日志输入/输出；**不**打开弹窗 |
| 双击节点 | 打开 `NodeEditorModal`，焦点在弹窗内 |
| ESC | 关闭弹窗（有 JSON 校验错误时阻止并提示） |
| 拖拽 JSON 叶子到字符串字段 | 目标切为表达式模式，填入 `{{ $node["名称"].json.a.b }}` |
| 执行（弹窗内或节点 ▶） | 复用现有 `executeNode`；刷新 `nodeDebug`、右侧输出、底部日志 |

---

## 4. 输入树数据模型

### 4.1 前序节点列表

与执行引擎一致：当前节点在 DAG 拓扑序上的 **全部祖先**（非仅直接父节点）。

- 名称列表：`definition.nodes` 中可执行节点，按 `planPartialExecution` / 与 `buildNamedNodeContext` 相同规则过滤出前序集合（前端可实现 `listPredecessorNodes(definition, nodeId)`）。
- 名称唯一：保存时已有 `E1006`；弹窗标题编辑复用 `findDuplicateNodeName`。

### 4.2 每节点 JSON 来源（优先级）

1. `pinData[nodeId]`（用户 Pin 或执行后自动 Pin）
2. `nodeDebug[nodeId].outputItems` 第一条 main item 的 `json`
3. 无数据：树节点显示「未执行」占位，不可拖拽

### 4.3 拖拽表达式生成

```ts
// 示例：节点名 "HTTP Request"，路径 body.user.id
`{{ $node["HTTP Request"].json.body.user.id }}`
// 名称含特殊字符一律用 bracket；纯标识符可用 $node.HTTP.json.id（生成器统一 bracket 更安全）
```

---

## 5. 参数字段：固定值 / 表达式

### 5.1 适用范围

| `ParamField.type` | v1 行为 |
|-------------------|---------|
| `text`、`textarea`、`expression` | 支持固定值/表达式切换 + 拖拽 |
| `number`、`select` | 保持现有控件，无拖拽 |
| `json` | 保持 JSON 编辑器；不强制表达式切换（Set 的 `mode: expression` 仍通过 parameters 控制） |

### 5.2 存储约定

字符串字段在表达式模式下，值仍为 **字符串**（含 `{{ }}` 模板），与现有 `resolveTemplateString` 一致。

- 固定值：原样存储，不做模板解析。
- 表达式：存储模板字符串；执行期由 node-runner 解析。

可选：在 `parameters` 上增加 `_exprKeys: string[]` 记录哪些 key 为表达式模式；或按值是否 `hasTemplateSyntax` 推断（推荐显式 `_fieldModes` 避免误判）。

```json
{
  "parameters": {
    "url": "{{ $node[\"A\"].json.id }}",
    "_fieldModes": { "url": "expression" }
  }
}
```

（实施计划可二选一，须在 plan 中定稿。）

---

## 6. 底部日志面板

### 6.1 布局

- 默认高度 180px；header 点击切换 `collapsed`；拖拽上边缘调整高度。
- `collapsed` 时仅显示标题行（如「日志」+ 选中节点名）。

### 6.2 内容

| 区块 | 数据源 |
|------|--------|
| 输入 | `nodeDebug[id].inputPreview` 或合并 `pinData` 前驱（与现 `NodePropertiesPanel` input Tab 一致） |
| 输出 | `itemsForDebugDisplay(flattenOutputBranches(debug.outputItems))` |
| 运行日志 | `nodeDebug[id].logs[]`（Code 节点，见 §7） |

无选中节点：显示引导文案（「选择节点查看输入/输出」）。

---

## 7. Code 节点 `$log`（后端）

### 7.1 API

沙箱注入：

```js
$log.info("message")
$log.warn("message")
$log.error("message")
```

### 7.2 返回结构

扩展调试执行结果（及 `NodeDebugState`）：

```ts
interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string; // ISO
}
```

- `packages/sandbox`：收集日志，随 `{ json }` 一并返回。
- `run-debug-execution` / API debug 响应：透传 `logs`。
- `apps/web`：`nodeDebug[nodeId].logs = result.logs`。

### 7.3 安全

- 禁止 `console` 透传为主进程（避免逃逸与噪音）。
- `$log` 消息长度上限（如 4KB/条，最多 100 条/次执行）。

---

## 8. 样式与依赖

### 8.1 CSS

- 调整 `.editor-grid` 为两列；`.workflow-editor` 使用 `flex` 列布局容纳日志。
- 弹窗：`.node-editor-modal`、`.node-editor-splitter`（分隔条 hover 态）。

### 8.2 依赖（建议）

- **横向 splitter**：`react-resizable-panels`（或项目内 50 行内自研，plan 阶段选定）。
- **JSON 树展示**：复用现有只读 `<pre>` / 轻量树组件；无则 v1 用可折叠 JSON 文本。

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| 节点名重复 | 弹窗标题保存时提示；与 `validateWorkflowDefinition` 一致 |
| JSON 参数语法错误 | 关闭弹窗前 `jsonParamError` 阻止 |
| 拖拽到非字符串字段 | 忽略或 toast 提示 |
| 引用未知 `$node` 名称 | 运行期 `E1002`（已有）；编辑器可选 v1.1 静态提示 |
| 弹窗打开时删除节点 | 关闭弹窗并清空选中 |

---

## 10. 测试计划

| 层级 | 内容 |
|------|------|
| 单元 | `listPredecessorNodes`、`buildDragExpression`、`ensureFieldMode` |
| 组件 | `EditorLogPanel` 收拢/展开；`ParamFieldWithMode` 切换 |
| 集成 | `set.test` 已有 $node；补充 web vitest 拖拽路径生成 |
| 手工 | Manual→Set(A)→Set(B)；双击 B；拖 A 的字段到 B；执行；底部与右侧输出一致；Code `$log` 出现在运行日志 |

---

## 11. 实施顺序建议（供 writing-plans 使用）

1. 布局：去掉右侧栏 + `EditorLogPanel` 骨架（只读 IO）
2. `NodeEditorModal` 三栏 + 迁移 `NodePropertiesPanel` 逻辑
3. `InputDataTree` + 拖拽表达式 + `_fieldModes`
4. Sandbox `$log` + debug 链路 + 日志 Tab
5. 样式打磨、localStorage 偏好、文档与 checklist 勾选

---

## 12. 与现有文档关系

- 表达式语义： [adr-expression-sandbox.md](../../adr-expression-sandbox.md)
- 节点名与 `$node`：已实现，本设计 **依赖** 该能力
- n8n 对标：补全 [2026-05-22-n8n-first-completion-design.md](./2026-05-22-n8n-first-completion-design.md) 编辑器差距项
