# 帮助中心

欢迎使用 RX-Workflow 帮助文档。此处说明编辑器中的表达式、节点参数与常用操作。

## 快速链接

| 主题 | 说明 |
|------|------|
| [表达式与 `{{ }}` 模板](/help/expressions) | 参数字段中的动态求值规则 |
| [Webhook 节点](/help/nodes/webhookTrigger) | HTTP 触发、HMAC 签名、测试/生产 URL |
| [Code 节点](/help/nodes/code) | Worker 沙箱脚本、`$input` / `$log`、返回值 |
| [IF 节点](/help/nodes/if) | 条件表达式与 true/false 出口 |
| [Switch 节点](/help/nodes/switch) | 多分支条件路由 |
| [Loop 节点](/help/nodes/loop) | 按 Items 迭代循环体、done 汇总 |
| [Chat Model 节点](/help/nodes/aiChatModel) | Agent 语言模型卫星（Ollama / OpenAI 兼容） |
| [Memory 节点](/help/nodes/aiMemory) | Agent 会话记忆卫星（Session ID / 跨轮历史） |
| [Knowledge (RAG) 节点](/help/nodes/aiKnowledge) | Agent 知识库检索卫星（参考资料注入系统提示） |
| [AI Agent 节点](/help/nodes/aiAgent) | Tools Agent（ReAct）与 Tool 卫星 |
| [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) | 监督者动态选人编排多 Agent |
| [Tool (Read) 节点](/help/nodes/toolRead) | Agent 读取工作区文件 |
| [INPUT 面板](/help/editor/input-panel) | 上游数据 JSON 预览、搜索与环境上下文 |

## 设置

打开 **设置** 窗口（侧栏用户菜单 → 设置），在标题栏点击 **帮助** 按钮（? 图标），将在新标签页打开与当前设置页面对应的说明。

| 主题 | 说明 |
|------|------|
| [个人资料](/help/settings/profile) | 昵称、头像、语言、主题 |
| [变量](/help/settings/variables) | 全局 `$vars` 工作流变量 |
| [环境变量](/help/settings/env) | `RXWF_*` 白名单与 `$env` 运行时参数 |
| [模型目录](/help/settings/models) | LLM Provider 与模型注册 |
| [知识库](/help/settings/knowledge) | RAG Embedding 与默认检索参数 |
| [Runners](/help/settings/runners) | 内嵌与 Agent Runner |
| [MCP 服务器](/help/settings/mcp) | 出站 MCP 连接 |
| [MCP Token](/help/settings/mcp-tokens) | 入站 MCP API 令牌 |
| [Setup](/help/settings/setup) | 初始化检查清单 |

更多设置页说明见帮助中心左侧 **设置** 分组。

## 在编辑器中获取帮助

打开任意节点的属性弹窗，点击标题栏 **帮助** 按钮（最大化左侧），将在新标签页打开与当前节点类型对应的说明。

## 与开发者文档的区别

- **本帮助站**：面向工作流编辑与运行的操作说明。
- **仓库 `docs/`**：面向开发与部署的规格、ADR、API 契约。
