# toolMcp — AUDIT-N-toolMcp

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `McpClientFields.tsx` 渲染 MCP Server 下拉与 Tool 多选；`NodeEditorParamsPane` 对 `mcpClient`/`toolMcp` 集成；`toolDescription`（Tool 描述）经 schema 渲染；E2E `@any` 覆盖 |
| validation | ok | 无独立保存期 type 级错误码；`toolDescription` 运行时由 `buildAgentToolDefinitions` 校验（缺则 E2003）；`serverId`/`tools` 可留空（运行时 MCP 校验） |
| executor | satellite | `buildAgentToolDefinitions` 注册 `source.type: mcp`；`run-ai-agent-node.ts` 经 `callMcpTool` 执行；无独立 registry 条目 |
| error_codes | E2003,E3012,E1001,E1004 | 缺 `toolDescription` 或 debug-node 直接 targeting 卫星 → E2003；Plus 未注入 `callMcpTool` → E3012；缺 server/tool → E1004；MCP Server 不存在 → E1001 |
| e2e_spec | nodes/toolMcp.spec.ts | `@any` 面板 MCP Server/Tool/Tool 描述；`@plus` debug-node 卫星 E2003 + aiAgent+toolMcp validate 通过 |
| status | ok | 审查通过；卫星 MCP 工具经 aiAgent 运行时 `callMcpTool` 执行 |

## 参数模型

- `serverId`：已注册 MCP Server 的 ID（面板 Server 下拉，与 `mcpClient` 共用 `McpClientFields`）。
- `tools`：字符串数组，要暴露给 Agent 的 MCP tool 名称（面板 Tool 多选）；留空时运行时默认 `list_directory`。
- `toolDescription`：必填 LLM 工具描述（非 fixed-capability 卫星）。

## 执行语义

- 卫星节点：无独立 executor；经 `aiAgent` / `skillRun` / Crew 的 `invokeTool` 回调执行。
- `buildAgentToolDefinitions`：每个选中 tool 产出一个 `ToolDefinition`；多 tool 时名称前缀为 `{nodeName}_{toolName}`。
- `run-ai-agent-node.ts`：`def.source.type === 'mcp'` 时调用 `deps.callMcpTool({ serverId, toolName, args })`。
- 与 `mcpClient` 节点共用 MCP 基础设施（`createCallMcpTool` / MCP Server 注册表）。

## 端口

- 输出：`ai_tool`（resource）→ 连接 `aiAgent` / `toolSubagent` / `skillRun` 的 `ai_tool` 输入。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | `toolDescription` 缺失；或 debug-node 直接 targeting 卫星节点（无 registry） |
| E3012 | Plus 运行时未注入 `callMcpTool`；或 `invokeAgentTool` 误路由 mcp source |
| E1004 | 缺少 `serverId` 或未选择有效 tool（`callMcpTool` 路径） |
| E1001 | `callMcpTool` 找不到 MCP Server |
| — | MCP 连接/tool 调用失败：`failed` + 异常消息 |

## E2E

- Spec：`apps/web/e2e/nodes/toolMcp.spec.ts`（E2E-N-toolMcp）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板用例
- 覆盖：面板 MCP Server / Tool / Tool 描述；debug-node 直接 targeting toolMcp → E2003；aiAgent+toolMcp workflow validate 通过

## 关联文档

- 面板与执行路径与 `mcpClient` 对齐：见 `docs/test/node-audit-rows/mcpClient.md`
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-toolMcp（plus）
- 帮助：`docs/help/zh/nodes/toolMcp.md`（M-6 T-150）

## 备注

- 未新增独立 `toolMcp.tsx`（`McpClientFields` + schema `toolDescription` 已覆盖）。
- 完整 Agent 调用 MCP 冒烟依赖 LLM 选取 tool；可选 `RXWF_E2E_MCP_LIVE=1` live MCP（与 mcpClient 相同基础设施）。
