# MCP Client 节点

## 用途

调用已在 **设置 → MCP Servers** 注册的 **MCP Server** 上的工具（Tool），将工具返回结果写入 `$json.result`（单工具）或 `$json.tools`（多工具列表）。适合在工作流中直接使用 filesystem、数据库、搜索等 MCP 能力，无需经过 AI Agent ReAct 循环。

与 **Tool MCP 卫星**不同：本节点是主数据流 **动作** 节点，由工作流编排显式指定 server、工具名与参数，不依赖 LLM 选择工具。

## 端口与连接

MCP Client 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger → set → mcpClient → code …
webhookTrigger → mcpClient → httpRequest …
```

使用前须在设置页添加 MCP Server 并确认 **Tool** 列表可加载。

## 参数

| 参数 | 说明 |
|------|------|
| **MCP Server**（`serverId`） | 下拉选择已注册 Server 的 UUID |
| **Tool**（`tools`） | 可多选；至少选一个工具名 |
| **args**（高级 / JSON） | 传给 MCP 工具的参数对象，如 `{ "path": "/tmp" }` |

### 输出

单工具时：

```json
{
  "tool": "read_file",
  "result": { … },
  "tools": [{ "tool": "read_file", "result": { … } }]
}
```

多工具按 `tools` 数组顺序依次调用，同一 `args` 传入每次调用。

### 与 toolMcp 卫星的区别

| | mcpClient | toolMcp（卫星） |
|---|-----------|-----------------|
| 数据流 | main 入/出 | ai_tool → Agent |
| 调用方 | 工作流固定配置 | LLM 动态选择 |
| 参数 | `serverId` + `tools` + `args` | 节点名 + LLM 生成 args |

## 常见错误

| 错误码 / 消息 | 说明 |
|---------------|------|
| **E1004** | `serverId` 为空；或未选择任何 Tool |
| **E3012** | MCP 运行时未配置；工具调用失败（Server 离线、参数无效等） |
| 工具列表为空 | Server 未启动或 MCP 握手失败 |

## 示例

### 示例 A

复制参数（读文件工具）：

| 键 | 值 |
|----|-----|
| `serverId` | `<mcp-server-uuid>` |
| `tools` | `["read_file"]` |
| `args` | `{ "path": "D:/app/README.md" }` |

### 示例 B

最小工作流 JSON：

```json
{
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Trigger",
      "position": { "x": 0, "y": 0 },
      "parameters": {}
    },
    {
      "id": "mcp1",
      "type": "mcpClient",
      "name": "MCP Client",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "serverId": "<server-uuid>",
        "tools": ["list_directory"],
        "args": { "path": "." }
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "MCP Client", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

多工具顺序调用 + 动态 args：

| 键 | 值 |
|----|-----|
| `serverId` | `<server-uuid>` |
| `tools` | `["search", "fetch"]` |
| `args` | `{ "query": "{{ $json.q }}" }` |

上游 Item 提供 `q` 字段；两次工具调用共用同一 args 对象。
