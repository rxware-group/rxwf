# HTTP Request 节点

## 用途

对每条输入 Item **并发发起 HTTP 请求**，将响应状态、头、体写入输出 JSON（可选 binary）。HTTP Request 为 **动作** 节点，支持 GET/POST/PUT/PATCH/DELETE、Query/Header/Body 多种组合、凭证注入与表达式 URL。非 2xx 与网络错误以 per-item `json.error` 记录，节点整体仍 **success**（best-effort）。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 每条 Item 独立发请求 |
| 输出 | main | 含 `statusCode`、`body`、`headers` 等字段的 Items |

```
manualTrigger / set → httpRequest → if / set / json …
```

默认 URL 为 `https://httpbin.org/get`，便于调试。

## 参数

| 参数 | 说明 |
|------|------|
| **Method** | GET / POST / PUT / PATCH / DELETE |
| **URL** | 支持 `{{ $env.API_URL }}/path` 等模板 |
| **Send Headers / Query / Body** | 开关启用 KV 行或 Body 编辑器 |
| **Body Content Type** | none / form-data / x-www-form-urlencoded / raw / binary / binaryFromItem / graphql |
| **Credential** | 可选凭证 ID，经 `applyAuth` 注入认证头 |
| **Response Binary** | off / auto / always；属性名默认 `data` |

并发度由环境变量 `RXWF_HTTP_NODE_CONCURRENCY` 控制（默认 10）。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E1005** | `preferRemote=true` 与工作流 Runner 策略冲突（保存期） |
| **E2003** | executor 未注册 |
| `json.error` | HTTP 4xx/5xx 或 fetch 失败；查看 `statusCode` 与 `error` 字段 |
| 空 URL | 运行时请求失败，错误写入 output 而非 AwfError |

输出 JSON 含 `ok`、`statusCode`、`requestUrl`、`body` 等；详见 node-runner `http-response` 模块。

## 示例

### 示例 A

GET 调试：Method **GET**，URL `https://httpbin.org/get`，Send Query 添加 `orderId={{ $json.id }}`。

### 示例 B

POST JSON：Send Body **raw** + `application/json`，body 为 `{ "name": "{{ $json.name }}" }`，下游 IF 判断 `statusCode === 200`。

### 示例 C

下载文件：Response Binary **auto**，响应 `Content-Type` 非文本时写入 `$binary.data`，供 readWriteFile 节点保存。
