# Manual Trigger 节点

## 用途

**Manual Trigger（手动触发器）** 是工作流最常用的启动方式：在编辑器点击 **▶ 执行**、**执行前序** 或 **从该节点执行** 时，由引擎调度下游节点。适合本地联调、一次性批处理、演示与无外部依赖的入口。

可在节点参数 **json** 中预设首批输出 Items，下游通过 `$json` / `$input` 读取，无需 Webhook 或 Cron。与 **Schedule / Webhook / Error / Subworkflow** 触发器互斥——每个工作流主流程只能有一个主触发器（子工作流入口除外）。

## 端口与连接

Manual Trigger 为 **触发器**：**无上游输入**，仅有一个 **main** 出口（ID `0`）。

```
manualTrigger ──main(0)──→ set / code / httpRequest / if / loop …
```

典型连接：`manualTrigger → set` 整理字段；`manualTrigger → loop` 对多条预设 Item 迭代；调试时可在触发器后直接接目标节点做 Partial 执行。

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| **json** | object / array / string | 触发时输出的初始数据。可为单个 JSON 对象、对象数组，或标准 items 形态 `[{ "json": { … } }]`；面板为 JSON 编辑器，**保存时**校验语法。 |

### 输出规则（执行器）

- **对象**：包装为 `[{ json: object }]`
- **数组**：每项若为 `{ json: … }` 则原样保留，否则视为 `{ json: entry }`
- **空字符串**：输出 `[{ json: {} }]`
- **非法 JSON 字符串**：运行时抛出 **E1002**

## 常见错误

| 场景 | 错误码 | 说明与处理 |
|------|--------|------------|
| `json` 非合法 JSON | **E1002** | 保存或执行前修正面板 JSON 语法 |
| 与 webhook / schedule 等主触发器共存 | **E1051** | 同一工作流仅保留一个主触发器；子工作流用 **subworkflowTrigger** |
| 未注册执行器（异常环境） | **E2003** | 检查 `manualTriggerExecutor` 是否已注册 |

## 示例

### 示例 A

可复制参数（单条业务载荷）：

```json
{
  "json": {
    "orderId": "1001",
    "region": "cn",
    "amount": 99.5
  }
}
```

### 示例 B

最小可运行工作流（Manual → Set，≤5 节点）：

```json
{
  "schemaVersion": 1,
  "name": "Manual demo",
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Manual",
      "position": { "x": 0, "y": 0 },
      "parameters": { "json": { "msg": "hello" } }
    },
    {
      "id": "s1",
      "type": "set",
      "name": "Set",
      "position": { "x": 240, "y": 0 },
      "parameters": { "mode": "manual", "fields": { "echo": "{{ $json.msg }}" } }
    }
  ],
  "connections": [{ "from": "t1", "to": "s1" }]
}
```

仓库 E2E 参考：`apps/web/e2e/nodes/manualTrigger.spec.ts`。

### 示例 C

多条 Items（配合 Loop / 批处理）：

```json
{
  "json": [
    { "id": 1, "sku": "A" },
    { "id": 2, "sku": "B" }
  ]
}
```

下游 `$input.length === 2`；Loop 节点按 `batchSize` 切批迭代。
