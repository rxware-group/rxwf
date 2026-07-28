# toolHttp — AUDIT-N-toolHttp

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 Method/URL/Headers (JSON)/Body/Tool 描述；`NodeEditorParamsPane` 通用 schema 渲染；E2E `@any` 覆盖 |
| validation | ok | 无独立保存期 type 级错误码；`toolDescription` 运行时由 `buildAgentToolDefinitions` 校验（缺则 E2003）；`url`/`method` 可留空（运行时 HTTP 失败 E3012） |
| executor | satellite | `buildAgentToolDefinitions` 注册 `source.type: http`；`run-ai-agent-node.ts` 经 `executeHttpRequest` 执行；无独立 registry 条目 |
| error_codes | E2003,E3012 | 缺 `toolDescription` → `E2003`；HTTP 非 2xx 或 invoke 路由错误 → `E3012` |
| e2e_spec | nodes/toolHttp.spec.ts | `@any` 面板；`@plus` debug-node 卫星 E2003 + aiAgent+toolHttp validate 通过 |
| status | ok | 审查通过；卫星 HTTP 工具经 aiAgent 运行时执行 |

## 参数模型

- `method`：HTTP 方法，默认 GET；选项 GET/POST/PUT/DELETE。
- `url`：请求 URL，支持 `$fromAI` 与表达式模板。
- `headers`：JSON 对象，可选；支持 `$fromAI`。
- `body`：请求体字符串，可选；支持 `$fromAI` 与表达式。
- `toolDescription`：必填 LLM 工具描述（非 fixed-capability 卫星）。

## 执行语义

- 卫星节点：无独立 executor；经 `aiAgent` / `skillRun` / Crew 的 `invokeTool` 回调执行。
- `buildAgentToolDefinitions` 产出 `ToolDefinition.source.type === 'http'`。
- `run-ai-agent-node.ts` 解析 url/headers/body（含 fromAI），调用 `executeHttpRequest`；成功返回 `{ statusCode, body }`。
- 非 2xx 响应抛 `E3012`。

## 端口

- 输出：`ai_tool`（resource）→ 连接 `aiAgent` / `toolSubagent` / `skillRun` 的 `ai_tool` 输入。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | `toolDescription` 缺失；或 debug-node 直接 targeting 卫星节点（无 registry） |
| E3012 | HTTP 响应非 2xx；或 `invokeAgentTool` 误路由 http source |

## E2E

- Spec：`apps/web/e2e/nodes/toolHttp.spec.ts`（E2E-N-toolHttp）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板用例
- 覆盖：面板 Method/URL/Headers/Body/Tool 描述；debug-node 直接 targeting toolHttp → E2003；aiAgent+toolHttp workflow validate 通过

## 关联文档

- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-toolHttp（plus）

## 备注

- 未新增独立 `toolHttp.tsx`（通用 `NodeEditorParamsPane` + schema 已覆盖）。
- 完整 Agent 调用 HTTP 冒烟依赖 LLM 与外部 URL；E2E 以面板与确定性 E2003 路径为主。
