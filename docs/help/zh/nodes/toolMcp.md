# MCP Tool 卫星

## 用途

**toolMcp** 将已注册的 **MCP Server** 上的工具暴露为 Agent 可调用的 Tool。父 Agent 在 ReAct 循环中按需调用，运行时经 `callMcpTool` 转发到对应 Server。与主数据流 **mcpClient** 节点共用 MCP 基础设施，但 **toolMcp** 仅作为 **ai_tool 卫星** 挂载在 Agent / Skill Run / 子 Agent 上。

## 端口与连接

```
toolMcp ──ai_tool──→ aiAgent 或 skillRun 或 toolSubagent
aiChatModel ──ai_languageModel──→ 父 Agent（必填）
```

| 端口 | 说明 |
|------|------|
| **Tool** 出口 | `ai_tool` → 父节点 **Tool** 入口 |
| 多 Tool | 同一父 Agent 可接多个 toolMcp / toolHttp 等卫星 |

须在 **设置 → MCP** 或 MCP 管理界面预先注册 Server（npx / docker / http / stdio）。

## 参数

| 参数 | 说明 |
|------|------|
| **MCP Server**（`serverId`） | 已注册 Server ID（面板下拉，与 [MCP Client](/help/nodes/mcpClient) 共用 UI） |
| **Tools**（`tools`） | 要暴露的工具名数组（面板多选）；留空时运行时可能默认 `list_directory` |
| **Tool 描述**（`toolDescription`） | **必填**；告诉 LLM 何时调用此 MCP 工具组 |

多 tool 时 LLM 侧名称格式：`{节点名}_{toolName}`。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 缺 **Tool 描述**；或对 toolMcp 直接 debug-node |
| **E1001** | MCP Server 不存在 |
| **E1004** | 缺 `serverId` 或未选有效 tool |
| **E3012** | 运行时未注入 `callMcpTool` 或调用失败 |

## 示例

### 示例 A

1. 注册 MCP Server（如 filesystem 或自定义 npx 包）
2. 添加 `toolMcp`，选 Server，勾选 `read_file`，填写 **Tool 描述**：「读取工作区文件路径」
3. **ai_tool** 连到 `aiAgent`，Agent 接 `aiChatModel`
4. Prompt 让 Agent 读取指定路径

### 示例 B

- **Tools** 多选 `list_directory` 与 `read_file`
- 节点命名为 `fs_tools` 时 LLM 可见 `fs_tools_list_directory` 等

### 示例 C

```
aiChatModel ──→ skillRun
toolMcp ──ai_tool──→ skillRun
```

Skill 正文可引用 MCP 能力；完整 live 冒烟可设 `RXWF_E2E_MCP_LIVE=1`（与 mcpClient E2E 相同基础设施）。

## 参见

- [MCP Client 节点](/help/nodes/mcpClient) — 主数据流调用 MCP
- [AI Agent 节点](/help/nodes/aiAgent) — Tool 卫星汇总
- [HTTP Tool 卫星](/help/nodes/toolHttp) — 自定义 REST Tool
