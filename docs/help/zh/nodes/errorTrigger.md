# Error Trigger 节点

## 用途

**Error Trigger（错误触发器）** 作为 **Error Workflow（错误工作流）** 的入口：当主工作流某节点失败且配置了 `settings.errorWorkflowId` 时，引擎将标准错误载荷投递到该错误流，由本节点接收并转为下游 Items。

载荷字段包括 `executionId`、`workflowId`、`failedNode`、`errorMessage`、`stack`、`timestamp` 等，便于告警、工单、补偿与审计。编辑器调试时可通过 **调试样例载荷 (JSON)**（`_debugSamplePayload`）模拟生产形态，无需先制造真实失败。

Error Workflow 递归深度全局上限为 **2**（主流程 → 一级错误流 → 可选二级），超出记审计并终止，防止无限循环。

## 端口与连接

Error Trigger 为 **触发器**：**无上游输入**，仅 **main** 出口（ID `0`）。

```
errorTrigger ──main(0)──→ set / httpRequest / humanApproval / executeWorkflow …
```

错误流工作流 **必须** 以 `errorTrigger` 为唯一主触发器；不可与 manual / webhook / schedule 混用。

## 参数

| 参数 | 说明 |
|------|------|
| **_debugSamplePayload** | **调试样例载荷 (JSON)**。编辑器 **debug-node** / 测试执行时，若上下文无真实 `errorPayload`，引擎从此字段或内置默认样例注入，便于本地验证下游逻辑。生产调度 **不** 读取此字段。 |

### 执行器行为

- 存在 `ctx.errorPayload`：输出 `[{ json: { …errorPayload } }]`
- 缺少 `errorPayload`（直接调用 executor 且无调试注入）：抛出 **E2002**

主工作流在 **设置 → Error Workflow** 中绑定错误流 ID；失败节点重试耗尽或不可重试时触发。

## 常见错误

| 场景 | 错误码 | 说明与处理 |
|------|--------|------------|
| 执行上下文无 errorPayload | **E2002** | 仅 debug 场景：检查 `_debugSamplePayload` 是否为合法 JSON 对象 |
| `_debugSamplePayload` JSON 无效 | **E1002** | 保存前修正面板 JSON |
| 与 manual / webhook 共存 | **E1051** | 错误流工作流只保留 errorTrigger |
| Error Workflow 递归过深 | **E1004** | 检查错误流是否再次触发自身；遵守 maxErrorDepth=2 |

## 示例

### 示例 A

可复制调试样例：

```json
{
  "_debugSamplePayload": {
    "executionId": "ex-sample",
    "workflowId": "wf-main",
    "failedNode": "HTTP Request",
    "errorMessage": "connect ECONNREFUSED",
    "stack": "Error: connect ECONNREFUSED\n    at …",
    "timestamp": "2026-06-21T08:00:00.000Z"
  }
}
```

### 示例 B

最小错误流工作流（Error Trigger → Set 提取消息）：

```json
{
  "schemaVersion": 1,
  "name": "Error handler",
  "nodes": [
    {
      "id": "et1",
      "type": "errorTrigger",
      "name": "On Error",
      "position": { "x": 0, "y": 0 },
      "parameters": {
        "_debugSamplePayload": {
          "executionId": "ex-sample",
          "workflowId": "wf-sample",
          "failedNode": "HTTP Request",
          "errorMessage": "Sample error",
          "stack": "Error: Sample error",
          "timestamp": "2026-06-21T08:00:00.000Z"
        }
      }
    },
    {
      "id": "s1",
      "type": "set",
      "name": "Set",
      "position": { "x": 240, "y": 0 },
      "parameters": {
        "mode": "manual",
        "fields": { "alert": "{{ $json.errorMessage }}", "node": "{{ $json.failedNode }}" }
      }
    }
  ],
  "connections": [{ "from": "et1", "to": "s1" }]
}
```

E2E：`apps/web/e2e/nodes/errorTrigger.spec.ts`；平台 Error Workflow 链：`E2E-P-005`。

### 示例 C

主工作流绑定：在主流程 **设置** 中填写 `errorWorkflowId` 为上述错误流 ID；主流程 HTTP 节点失败时，错误流自动收到真实载荷，Set 节点可将 `{{ $json.failedNode }}` 写入 Slack / 邮件 HTTP 节点 body。
