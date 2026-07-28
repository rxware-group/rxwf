# Execute Workflow 节点

## 用途

**同步调用**另一个已发布工作流（子工作流），等待其执行完成后，将子工作流的 **输出 Items** 作为本节点输出传递给下游。用于模块化复用、封装通用子流程、在主流程中编排多段独立工作流。

子工作流在独立执行上下文中运行，嵌套深度上限 **5** 层（超出报 **E2008**）。父执行 ID 会传递给子执行，便于审计与追踪。

## 端口与连接

Execute Workflow 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → executeWorkflow → merge / code …
```

子工作流侧须包含 **Subworkflow Trigger**（`subworkflowTrigger`）作为入口，接收父流程传入的 Items。

## 参数

| 参数 | 说明 |
|------|------|
| **子工作流 ID**（`workflowId`） | 目标工作流的 UUID；须 **已发布** |
| **输入映射**（`inputMapping`） | 可选；将父 item 字段映射为子工作流入参 JSON |

### 输入映射行为

- 未配置映射且子入口 schema 为 **acceptAll**：原样传递上游 Items
- 配置了 `inputMapping` 或子入口有字段 schema：按映射构建单条 `{ json: payload }` 传入子工作流
- 映射值支持 `{{ }}` 表达式，可引用 `$json`、`$env`、`$vars`、`$nodes`

### 与 Workflow Run 的区别

| | executeWorkflow | workflow_run |
|---|-----------------|--------------|
| 目标 | 已发布工作流 ID | 模板路径或已发布 ID |
| 典型场景 | 生产编排、Tool 调用 | 本地模板 / RxWF 工作区 |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | `workflowId` 为空；子工作流不存在或未发布；缺少 `parentExecutionId` |
| **E2008** | 子工作流嵌套深度超过 5 |
| 子工作流失败 | 子执行 error 会冒泡为本节点 **failed** |

## 示例

### 示例 A

复制参数：

| 键 | 值 |
|----|-----|
| `workflowId` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `inputMapping` | `{ "orderId": "{{ $json.id }}", "region": "{{ $vars.REGION }}" }` |

### 示例 B

最小工作流 JSON（主流程调用子流程）：

```json
{
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Trigger",
      "position": { "x": 0, "y": 0 },
      "parameters": { "json": { "id": "1001" } }
    },
    {
      "id": "ew1",
      "type": "executeWorkflow",
      "name": "Call Child",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "workflowId": "<child-workflow-uuid>",
        "inputMapping": { "orderId": "{{ $json.id }}" }
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "Call Child", "type": "main", "index": 0 }]]
    }
  }
}
```

子工作流内：`subworkflowTrigger` → 处理节点 → 出口。

### 示例 C

透传上游 Items（无映射）：

| 键 | 值 |
|----|-----|
| `workflowId` | `<child-uuid>` |
| `inputMapping` | `{}` |

当子 `subworkflowTrigger` 为 **acceptAll** 模式时，父流程多条 Items 会按子流程入口规则接收。
