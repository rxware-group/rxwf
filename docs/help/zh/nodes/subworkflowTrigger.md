# Subworkflow Trigger 节点

## 用途

**Subworkflow Trigger（子工作流触发器）** 标记可被 **父工作流** 或 **Agent 工具** 调用的子流程入口。父流通过 **Execute Workflow**（`executeWorkflow`）或 **Tool Workflow**（`toolWorkflow`）传入 Items，引擎在本节点处注入为 `$json` / `$input`，再执行子流剩余节点。

用于复用通用能力（鉴权、清洗、通知模板）、封装 Agent 工具链，以及 `exposeAsTool` 工作流对外暴露 MCP/工具接口。子流 **必须** 包含且通常 **仅包含一个** subworkflowTrigger（与 exposeAsTool 规则配合校验）。

## 端口与连接

Subworkflow Trigger 为 **触发器**：**无画布上游连线**（由父流/API 注入 inputItems），仅 **main** 出口（ID `0`）。

```
subworkflowTrigger ──main(0)──→ set / code / aiAgent …
```

父工作流侧：

```
executeWorkflow / toolWorkflow ──(子流调用)──→ subworkflowTrigger → …
```

不得与 manual / webhook / schedule 等 **主触发器** 同处一个工作流（**E1051**）。

## 参数

| 参数 | 说明 |
|------|------|
| **inputMode** | 入参模式：`fields`（字段列表）、`jsonExample`（JSON 示例推断 schema）、`acceptAll`（接受全部，调用方 payload 原样作为 `$json`） |
| **inputs** | `fields` 模式下声明的字段数组：name、type（string/number/boolean/json）、description、required、default |
| **jsonExample** | `jsonExample` 模式下的 JSON 对象示例，用于推断输入 schema 与 Agent 工具参数 |
| **exposeAsTool** | （工作流级）暴露为工具时的名称与描述，与 trigger 布局一并校验 |

父流 **Execute Workflow** 可配置 **inputMapping**，将父节点 `$json` 映射到子流声明字段；Agent **toolWorkflow** 按子流 schema 生成 LLM 工具参数。

### 执行器行为

- 有 **inputItems**（正常子流调用 / debug-node）：**透传**
- 无 inputItems：输出 `[{ json: {} }]`

## 常见错误

| 场景 | 错误码 | 说明与处理 |
|------|--------|------------|
| 与 manual/webhook/schedule 共存 | **E1051** | 子流只保留 subworkflowTrigger |
| exposeAsTool 工作流缺少/多余 trigger | **E1052** | 按工具暴露规范调整节点布局 |
| fields 模式未声明字段 | **E1056** | 至少添加一个 input 字段或改用 acceptAll |
| 输入字段名重复 | **E1057** | 字段 name 须唯一 |
| jsonExample 非 JSON 对象或字段名非法 | **E1058** | 使用 `{ "key": value }` 且 name 匹配 `[A-Za-z0-9_-]{1,64}` |
| 子流未发布 / 无 schema | — | 父流 inputMapping 面板提示「子工作流未发布或缺少 subworkflowTrigger」 |

## 示例

### 示例 A

可复制配置（fields 模式，接收订单 ID）：

```json
{
  "inputMode": "fields",
  "inputs": [
    { "name": "orderId", "type": "string", "description": "订单号", "required": true },
    { "name": "priority", "type": "number", "required": false, "default": 1 }
  ]
}
```

### 示例 B

最小子工作流 JSON：

```json
{
  "schemaVersion": 1,
  "name": "Child enrich",
  "nodes": [
    {
      "id": "sw1",
      "type": "subworkflowTrigger",
      "name": "Start",
      "position": { "x": 0, "y": 0 },
      "parameters": {
        "inputMode": "jsonExample",
        "jsonExample": { "orderId": "1001" }
      }
    },
    {
      "id": "s1",
      "type": "set",
      "name": "Set",
      "position": { "x": 240, "y": 0 },
      "parameters": {
        "mode": "manual",
        "fields": { "label": "order-{{ $json.orderId }}" }
      }
    }
  ],
  "connections": [{ "from": "sw1", "to": "s1" }]
}
```

E2E：`apps/web/e2e/nodes/subworkflowTrigger.spec.ts`；父流调用见 `executeWorkflow.spec.ts`。

### 示例 C

**acceptAll** 模式：参数设为 `{ "inputMode": "acceptAll" }` 时，父 Agent 或 Execute Workflow 传入的任意 JSON 原样成为 `$json`，适合快速原型；生产建议使用 **fields** 或 **jsonExample** 约束入参并启用 inputMapping 校验。
