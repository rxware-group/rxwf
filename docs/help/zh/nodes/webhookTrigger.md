# Webhook Trigger 节点

## 用途

**Webhook Trigger** 通过 **HTTP POST** 接收外部系统回调，将请求体解析为工作流首批 **Items**（`$json` / `$binary`），驱动下游自动化。适合订单通知、GitHub/GitLab 钩子、IoT 上报与第三方 SaaS 集成。

每个 Webhook 节点在工作流内通过 **Path** 区分 URL 路径；同一工作流可放置多个 Webhook 节点（path 须唯一）。支持 **测试 URL**（草稿调试、临时监听）与 **生产 URL**（发布后持续可用）两种模式，并可选 **None / API Key / API Key + HMAC Secret** 认证。

## 端口与连接

Webhook Trigger 为 **触发器**：**无上游输入**，仅 **main** 出口（ID `0`）。

```
webhookTrigger ──main(0)──→ set / code / httpRequest / aiAgent …
```

典型拓扑：Webhook 接收 JSON → Set 规范化字段 → IF 分流 → 业务节点。多 Path 时外部系统分别 POST 到不同 URL 片段。

## 参数

| 参数 | 说明 |
|------|------|
| **Path** | URL 路径片段，与工作流 ID 组合成完整地址；同一工作流内须唯一。默认 `hook`。 |
| **认证方式**（`authMode`） | `none` / `apiKey` / `apiKeyHmac`；默认 `none`（面板可生成密钥） |
| **API Key** | `apiKey` 或 `apiKeyHmac` 模式下必填；请求头 `X-RXWF-Api-Key` |
| **HMAC Secret** | `apiKeyHmac` 模式下必填；配合 `X-RXWF-Signature` + `X-RXWF-Timestamp` |

### 认证方式

| 模式 | 说明 |
|------|------|
| **None** | 不校验身份，知道 URL 即可调用。**仅建议本地调试**。 |
| **API Key** | 请求头须携带 `X-RXWF-Api-Key`，与节点配置一致。 |
| **API Key + HMAC Secret** | 同时要求 API Key 与 HMAC 签名。 |

> 系统设置中的「Webhook Secret」用于 Crew 工具桥等**内部** HMAC，与触发节点参数**无关**。

> **兼容旧工作流**：未设置 `authMode` 但已配置 `hmacSecret` 的节点，仍按「API Key + HMAC Secret」处理，且仅需 HMAC（不要求 API Key）。

## URL 与测试 / 生产

| 模式 | URL 模式 | 说明 |
|------|----------|------|
| **测试** | `{base}/webhook-test/{workflowId}/{path}` | 编辑已保存的**草稿**；编辑器 **▶ 执行** 进入**临时监听**（约 5 分钟）。 |
| **生产** | `{base}/webhook/{workflowId}/{path}` | 工作流 **已发布** 后持续可用；执行**已发布版本**定义。 |

## 请求要求

- **方法**：`POST`
- **API Key 模式**：头 `X-RXWF-Api-Key`
- **HMAC 模式**：
  - `X-RXWF-Signature`：请求体原始字节的 **HMAC-SHA256** 十六进制
  - `X-RXWF-Timestamp`：Unix **秒**级时间戳，偏差 ≤ **5 分钟**
- **可选 Header**：
  - `Idempotency-Key`：幂等键；重复请求返回同一 `executionId`（HTTP 200）。测试与生产 URL **独立**幂等域。
  - `X-RXWF-Session-Id`：写入执行 `sessionId`，供 Agent / Memory 使用

### 签名算法（HMAC）

```text
signature = HMAC_SHA256(hmacSecret, rawBody).hex()
```

## 请求体与下游数据

| Content-Type | 行为 |
|--------------|------|
| `application/json` | 解析为 `$json` |
| `multipart/form-data` | 文本字段进 `$json`，文件进 `$binary` |
| `application/octet-stream` 等 | 整段 body 作为 `$binary.data` |
| 空 body | 输出 `[{ json: {} }]` |

执行器：有 **inputItems**（HTTP 层注入）时透传；否则用配置 `body` 或空对象。

## 常见错误

| HTTP | 代码 | 含义与处理 |
|------|------|------------|
| 401 | **E2005** | HMAC 无效或未配置；检查 Secret 与 rawBody 签名 |
| 401 | **E2006** | 时间戳无效或过期；同步客户端时钟，重发请求 |
| 401 | **E2014** | API Key 缺失或不匹配 |
| 403 | **E2001** | 生产 URL 访问**未发布**工作流；先发布 |
| 404 | **E1001** | 工作流或 Path 不存在；核对 workflowId 与 path |
| 202 | — | 已入队执行（正常） |
| 200 | — | 幂等命中，返回已有 execution |

## 示例

### 示例 A

可复制参数（生产推荐 API Key + HMAC）：

```json
{
  "path": "orders",
  "authMode": "apiKeyHmac",
  "apiKey": "<generated-api-key>",
  "hmacSecret": "<generated-secret>"
}
```

curl（API Key + HMAC）：

```bash
curl -X POST 'https://example.com/webhook-test/{workflowId}/orders' \
  -H 'Content-Type: application/json' \
  -H 'X-RXWF-Api-Key: <api-key>' \
  -H 'X-RXWF-Signature: <hmac-sha256-hex>' \
  -H 'X-RXWF-Timestamp: <unix-seconds>' \
  -d '{"orderId":"1001"}'
```

### 示例 B

最小工作流 JSON（Webhook → Set）：

```json
{
  "schemaVersion": 1,
  "name": "Webhook order",
  "nodes": [
    {
      "id": "w1",
      "type": "webhookTrigger",
      "name": "Webhook",
      "position": { "x": 0, "y": 0 },
      "parameters": { "path": "hook", "authMode": "none", "apiKey": "", "hmacSecret": "" }
    },
    {
      "id": "s1",
      "type": "set",
      "name": "Set",
      "position": { "x": 240, "y": 0 },
      "parameters": { "mode": "manual", "fields": { "id": "{{ $json.orderId }}" } }
    }
  ],
  "connections": [{ "from": "w1", "to": "s1" }]
}
```

E2E：`apps/web/e2e/nodes/webhookTrigger.spec.ts`；API：`apps/api/src/routes/webhook.test.ts`。

### 示例 C

仅 **API Key** 模式联调（无 HMAC）：

```bash
curl -X POST 'https://example.com/webhook/{workflowId}/hook' \
  -H 'Content-Type: application/json' \
  -H 'X-RXWF-Api-Key: <api-key>' \
  -d '{"orderId":"1001"}'
```

确认 OUTPUT 后 **发布** 工作流，将 URL 前缀换为 `/webhook/` 并启用 **apiKeyHmac** 用于生产。
