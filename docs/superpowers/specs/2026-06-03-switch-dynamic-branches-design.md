# Switch 节点动态分支设计

| 字段 | 内容 |
|------|------|
| **状态** | Draft — 待用户审阅后进入 implementation plan |
| **日期** | 2026-06-03 |
| **方案** | 方案 1：Switch 专用分支编辑器 + `branches[]` 参数模型 |
| **关联** | `packages/node-runner/src/executors/control-flow/switch.ts`、`if.ts`；`apps/web` 编辑器端口与参数面板 |

---

## 1. 背景与问题

Switch 是多出口逻辑节点。当前实现存在前后端割裂：

| 层 | 现状 | 问题 |
|----|------|------|
| 执行器 | `rules: { field, value, output }` 字段相等匹配；依赖 `outputCount` | 与 IF 的 `{{ }}` 表达式能力不一致 |
| 编辑器 | 仅 `outputCount`、`fallbackOutput` | `rules` 无法配置，用户无法定义分支条件 |
| 画布 | 出口数由 `outputCount` 推导，标签固定「出口 n」 | 与规则条数/语义脱节 |

目标：支持**动态添加**多条分支；每条为布尔表达式，**为 true 时**将 item 路由到对应出口；端口**显示名可编辑**，**稳定 id** 用于连线。

---

## 2. 已确认需求（决策记录）

| 项 | 决策 |
|----|------|
| 条件语法 | 与 IF 相同：`{{ }}` 布尔表达式，对每条 input item 逐条求值 |
| 多条件同时为 true | **按 `branches` 数组顺序，第一条匹配生效**（后续不再判断） |
| 全部 false | **丢弃 item**，节点 `status: 'success'`，**无兜底出口** |
| 端口命名 | **`label` 仅显示**；**`id` 稳定**（UUID），连线锚点不随改名变化 |
| 分支数量 | **至少 1 条**，**不设上限** |
| 节点外观 | **高度随分支数自适应**（Handle 垂直分布） |

---

## 3. 参数数据模型

### 3.1 新结构

```ts
type SwitchBranch = {
  id: string;       // UUID，React Flow Handle id、connections.sourceHandle
  label: string;    // 画布显示，默认「端口1」「端口2」…
  condition: string; // 与 IF 相同，如 '{{ $json.status === "paid" }}'
};

// node.parameters
{
  branches: SwitchBranch[];
}
```

Switch 条件**固定为表达式模式**，不引入 IF 的 `_fieldModes` / 字段相等旧模式。

### 3.2 废弃字段

不再读写（迁移后保存时删除）：

- `outputCount`
- `fallbackOutput`
- `rules`（`field` / `value` / `output`）

### 3.3 默认值（新建节点）

```json
{
  "branches": [
    {
      "id": "<uuid>",
      "label": "端口1",
      "condition": "{{ true }}"
    }
  ]
}
```

`{{ true }}` 使单分支节点在调试时行为可预测；多分支时用户应编写互斥或有序条件。

### 3.4 分支操作（编辑器）

| 操作 | 行为 |
|------|------|
| 添加 | 追加 `{ id: newUuid(), label: '端口{n}', condition: '{{ false }}' }` |
| 删除 | 从 `branches` 移除；**删除所有 `sourceHandle === id` 的出边** |
| 排序 | 仅改变匹配优先级；**不改变 `id`** |
| 重命名 label | 只更新显示与 `getNodePorts` 的 `label` |

---

## 4. 执行语义（`switchExecutor`）

对每个 `ctx.inputItems` 中的 item：

1. 初始化 `outputItems: WorkflowItem[][]`，长度 = `branches.length`，每项为 `[]`。
2. 若 `branches.length === 0`：返回 `failed`，`errorCode: E2003`，`errorMessage: 'switch requires at least one branch'`。
3. 对 item 从 `branches[0]` 到 `branches[n-1]`：
   - 使用与 `ifExecutor` 相同的表达式求值路径（`evaluateCondition` + `ExpressionContext`：`json`, `input`, `env`, `nodes`, `vars`）。
   - 第一条 `condition` 为 true 的分支 index 接收该 item，`break`。
4. 若无一为 true：**不 push 到任何分支**（丢弃）。
5. 返回 `{ status: 'success', outputItems }`。

表达式求值失败：与 IF 一致，节点 `failed`，附带可解析错误信息（不静默当作 false）。

### 4.1 与 IF 的代码复用

抽取或复用 `if.ts` 中的 `matchesItem` / `ensureIfConditionTemplate` / `ifConditionIsExpression`，避免 Switch 维护第二套条件解析逻辑。

---

## 5. 画布与端口

### 5.1 `getNodePorts('switch', parameters)`

```ts
outputs = branches.map((b, i) => ({
  id: b.id,
  label: b.label?.trim() || `端口${i + 1}`,
}));
inputs = [{ id: 'main', label: '输入' }];
```

移除对 `outputCount` 的读取及 2–8 条硬上限。

### 5.2 节点高度

- 为 `switch`（及必要时 `if` 双出口保持现状）增加 body 变体 class，例如 `workflow-node-body--multi-out`。
- 高度公式（实现时可调常量）：

  `height = max(var(--wf-node-size), var(--wf-node-min-multi-out) + (branchCount - 1) * var(--wf-node-out-slot-gap))`

- `WorkflowNode` 在 `ports.outputs.length > 1` 或 `nodeType === 'switch'` 时应用该 class。
- Handle 位置继续使用 `handleVerticalSlot(index, total)`。

### 5.3 连接与执行引擎

- `connections` 中 `sourceHandle` 必须为 `branch.id`（非 `"0"`/`"1"` 索引字符串）。
- 编译/执行层按 handle id 映射到 `outputItems` 下标：查找 `branches.findIndex(b => b.id === handle)`。

---

## 6. 编辑器 UI（方案 1）

### 6.1 专用面板 `SwitchBranchesPanel`

挂载于节点参数区（`NodeEditorParamsPane` 对 `type === 'switch'` 分支渲染），替代 `node-param-schemas` 中的 `outputCount` / `fallbackOutput` 字段。

每行 UI：

- 端口名（text）
- 条件（`expression` 控件，与 IF 相同）
- 删除按钮

底部：**添加分支**；可选：拖拽排序（`@dnd-kit` 或现有列表排序模式）。

### 6.2 说明文案

新增 `SwitchNodeDescription`（或复用 IF 变量表），说明 `$json` / `$env` 等与「自上而下第一条匹配」语义。

### 6.3 i18n

在 `packages/i18n-catalog` 增加键，例如：

- `editor.switch.addBranch`
- `editor.switch.portLabel`
- `editor.switch.condition`
- `editor.switch.matchOrderHint`

---

## 7. 旧格式

产品仍在开发阶段：**不实现** `outputCount` / `rules` / `fallbackOutput` 迁移；直接采用 `branches[]` 新模型。

---

## 8. 测试计划

| 范围 | 用例 |
|------|------|
| `switchExecutor` | 顺序匹配；全 false 丢弃；单分支；多分支；表达式错误失败 |
| `getNodePorts` | branches 增减后 outputs 数量与 id |
| 编辑器 | 删分支清边；排序不改变 id |
| Pin / 部分运行 | 扩展 `apply-pin-from-results` switch 用例，按 branch 数对齐 `pinBranchData` |

---

## 9. 非目标（YAGNI）

- 不实现「无匹配兜底出口」（用户已选丢弃）。
- 不实现「item 复制到多个分支」。
- 首期不实现通用 `repeater` 参数类型（方案 2 延后）。
- 不限制最大分支数（仅 UI 滚动与性能常识约束）。

---

## 10. 实施顺序建议

1. `SwitchBranch` 类型 + 默认参数（`packages/workflow`）
2. `switchExecutor` 重写 + 测试
3. `getNodePorts` / `switchBranchIndex` / 执行图边 `outputIndex`
4. `SwitchBranchesPanel` + 移除旧 schema 字段
5. 节点高度 CSS + i18n

---

## 11. 批准

用户于 2026-06-03 确认采用**方案 1**及第二节需求表。审阅本 spec 无异议后，使用 **writing-plans** 技能生成 `docs/superpowers/plans/2026-06-03-switch-dynamic-branches.md`。
