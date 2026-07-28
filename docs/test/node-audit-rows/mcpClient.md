# mcpClient — AUDIT-N-mcpClient

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `McpClientFields.tsx` 渲染 MCP Server 下拉与 Tool 多选；`NodeEditorParamsPane` 对 `mcpClient`/`toolMcp` 集成；schema 空数组（专用面板） |
| validation | ok | 无独立保存期 type 级错误码；`serverId`/`tools` 可留空（运行时校验） |
| executor | ok | `createMcpClientExecutor`（`executors/mcp-client.ts`）经 `callMcpTool` 调用已注册 MCP Server；`mcp-client.test.ts` 覆盖 E2003/E3012/E1004 |
| error_codes | E1001,E1004,E2003,E3012 | `E2003`：registry 未注册；`E3012`：`callMcpTool` 未注入；`E1004`：缺 `serverId` 或未选 tool；`E1001`：MCP Server 不存在（`callMcpTool`） |
| e2e_spec | nodes/mcpClient.spec.ts | `@any` 面板 MCP Server/Tool；`@plus` debug-node 缺 server 失败路径；`RXWF_E2E_MCP_LIVE=1` 可选 live MCP 冒烟 |
| status | ok | 审查通过；执行器已提取至 `mcp-client.ts` 并单测覆盖 |

## 参数模型

- `serverId`：已注册 MCP Server 的 ID（面板 Server 下拉）。
- `tools`：字符串数组，要调用的 MCP tool 名称（面板 Tool 多选）；兼容旧字段 `tool`（单字符串）。
- `args`：可选，传给每个 tool 的参数对象（JSON）。

## 执行语义

- Plus 执行器：`createMcpClientExecutor` 对每个选中 tool 调用 `callMcpTool({ serverId, toolName, args })`。
- 成功输出单 item：`{ tools: [{ tool, result }, ...], tool, result }`（`tool`/`result` 为首个 tool 的快捷字段）。
- 失败：`status: failed`，`errorMessage` 含 E 码或底层异常消息。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 执行器未注册 |
| E3012 | Plus 运行时未注入 `callMcpTool` |
| E1004 | 缺少 `serverId` 或未选择任何 tool |
| E1001 | `callMcpTool` 找不到 MCP Server |
| — | MCP 连接/tool 调用失败：`failed` + 异常消息 |

## E2E

- Spec：`apps/web/e2e/nodes/mcpClient.spec.ts`（E2E-N-mcpClient）
- 轨：plus（`@plus|@any`）
- 覆盖：面板字段可见；缺 `serverId` 时 debug-node 失败；`RXWF_E2E_MCP_LIVE=1` 时对 npx filesystem MCP 做 live 调用

## 备注

- 面板与 `toolMcp` 卫星节点共用 `McpClientFields`；执行路径与 Agent 内 MCP tool 相同（`callMcpTool`）。
- `register-plus.ts` 仍内联旧版 `deps.mcpClient` 逻辑（所有权外）；运行时应改为 `createMcpClientExecutor(deps)` 与单测模块对齐。
- 帮助文档 `docs/help/zh/nodes/mcpClient.md` 由 M-6 T-139 负责。
