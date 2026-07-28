# httpRequest 节点审查

> Task T-048 · row_id AUDIT-N-httpRequest · track lite

## 结论摘要

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 Method/URL/响应 Binary 等字段；`NodeEditorParamsPane` 渲染 `CredentialSelect` + `HttpRequestAdvancedFields`（Headers/Query/Body 开关与 KV/Body 编辑器） |
| validation | ok | 保存校验：`preferRemote` 与 embedded fallback 冲突时 `E1005`；无独立空 URL 保存错误码（运行时 best-effort 在 `json.error` 暴露 fetch 失败） |
| executor | ok | `register-builtin.ts` 注册 `createHttpRequestExecutor`（`executors/http.ts`）；并发、凭证注入、多 body 类型、响应 binary 均已单测覆盖 |
| error_codes | E1005,E1010,E1011,E2003 | 保存/Runner：`E1005`（preferRemote）；`E1010`/`E1011`（Runner 策略警告）。执行：节点级 `E2003`（registry 缺失）；HTTP 非 2xx 与网络错误写入 output `json.error`（非 AwfError） |
| status | ok | 面板、校验、执行器、错误码审查通过；E2E spec 覆盖面板与 debug-node 执行 |

## 执行器

- 路径：`packages/node-runner/src/executors/http.ts` → `http-request.ts`
- 行为：对每条 input item 并发发起 HTTP 请求；非 2xx 与 fetch 异常以 per-item `json.error` 记录，节点整体仍 `success`（best-effort）
- 能力：`http`（`node-runner-requirements.ts`）；支持凭证 `applyAuth`、表达式 URL/headers/query/body、form-data/urlencoded/raw/binary/graphql/binaryFromItem、响应 binary auto/always

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1005 | 节点 `preferRemote: true` 且工作流 Runner 策略为 embedded / fallback embedded |
| E1010 | 工作流 pinned runnerId 不存在（警告） |
| E1011 | 节点需要特定平台 Runner 但无可用（警告） |
| E2003 | executor registry 未注册 `httpRequest` 时 `Unknown node type` |
| — | HTTP 4xx/5xx：`json.error` 含 `HTTP {status}`；网络/解析失败：`json.error` 为异常消息 |

## E2E

- Spec：`apps/web/e2e/nodes/httpRequest.spec.ts`（E2E-N-httpRequest）
- 覆盖：面板 Method/URL/高级字段可见；`debug-node` 对 `https://httpbin.org/get` 返回 `statusCode: 200`
- 关联：`credential-types.spec.ts`（E2E-P-011）额外覆盖凭证注入 HTTP 节点

## 备注

- 默认 URL `https://httpbin.org/get`（`node-port-defs.ts`）
- 帮助文档 `docs/help/zh/nodes/httpRequest.md` 由 M-6 帮助任务负责（registry 已映射，md 待补）
- Binary 响应/上传见 `http-response.ts`；全链路 binary 能力边界见 M-5
