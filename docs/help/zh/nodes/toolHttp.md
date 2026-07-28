# HTTP Tool 卫星

## 用途

**toolHttp** 将 **HTTP 请求** 注册为 Agent 可调用的 Tool。LLM 在工具调用时传入 URL 参数（及可选 body/headers），运行时经 `executeHttpRequest` 发起请求并返回 `{ statusCode, body }`。适合对接 REST API、Webhook 或内部 HTTP 服务，无需编写独立 Code 节点。

## 端口与连接

```
toolHttp ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
aiChatModel ──ai_languageModel──→ 父 Agent
```

接线：**从 toolHttp 的 Tool 出口** 连到 **父 Agent 的 Tool 入口**。

## 参数

| 参数 | 说明 |
|------|------|
| **Method**（`method`） | GET / POST / PUT / DELETE，默认 GET |
| **URL**（`url`） | 请求地址；支持 `{{ }}` 与 `$fromAI` 占位 |
| **Headers**（`headers`） | JSON 对象，可选 |
| **Body**（`body`） | 请求体字符串，可选 |
| **Tool 描述**（`toolDescription`） | **必填**；说明何时调用、参数含义 |

LLM 调用时可覆盖 URL/body 等（取决于 schema 与 `$fromAI` 配置）。非 2xx 响应整次 Tool 调用失败，错误写入 Agent 的 `agentSteps`。

**Embedded** 路径在 API 进程内发起 HTTP；远程 Runner 场景下请求仍由控制面 relay 或按 Runner 策略路由（与 [HTTP Request](/help/nodes/httpRequest) 节点不同，Tool 路径无独立 main 出口）。

保存期无独立 type 级校验；`url` 留空时 LLM 仍可能在调用时传入动态 URL，但建议在节点填默认模板便于调试。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 缺 **Tool 描述**；或对 toolHttp 直接 debug-node |
| **E3012** | HTTP 响应 **非 2xx**；或 invoke 路由错误 |

## 示例

### 示例 A

| 参数 | 值 |
|------|-----|
| Method | GET |
| URL | `https://httpbin.org/get` |
| Tool 描述 | 调用外部 GET API 获取 JSON 响应 |

连到 `aiAgent`，Prompt：「用 HTTP 工具查询 httpbin」。

### 示例 B

- Method：**POST**
- URL：`https://api.example.com/v1/items`
- Headers：`{"Authorization": "Bearer {{ $vars.API_TOKEN }}", "Content-Type": "application/json"}`
- Body：`{"name": "{{ $fromAI(\"itemName\", \"Item name\") }}"}`

### 示例 C

1. `aiAgent` + `toolHttp` + `aiOutputParser`（schema 含 `status` 与 `data`）
2. Agent 先调 HTTP Tool，再按 schema 汇总为 JSON 输出

## 参见

- [HTTP Request 节点](/help/nodes/httpRequest) — 主数据流 HTTP（非 Agent Tool）
- [AI Agent 节点](/help/nodes/aiAgent)
- [Workflow Tool 卫星](/help/nodes/toolWorkflow) — 调用子工作流
