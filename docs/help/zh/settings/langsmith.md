# LangSmith

在 **设置 → LangSmith**（`/settings/langsmith`）中配置 **LangChain / LangSmith** 追踪，用于观测 LLM 与 Agent 调用链。**仅 Admin** 可访问。

## 配置项

| 字段 | 说明 |
|------|------|
| **启用** | 总开关；关闭时不发送追踪数据 |
| **Tracing V2** | 使用 LangSmith Tracing V2 协议 |
| **API Key** | LangSmith 项目 API 密钥；留空或 `***` 表示不修改已有值 |
| **Project** | LangSmith 项目名称，默认 `rx-workflow` |

保存后，符合条件的 LLM / Agent 执行会将 Span 上报至 LangSmith 控制台。

## 使用前提

1. 在 [LangSmith](https://smith.langchain.com/) 创建项目并获取 API Key。
2. 在本页启用并填写 Project 名称。
3. 执行含 LLM / Agent 的工作流，在 LangSmith UI 查看 Trace。

## 隐私与安全

- API Key 为敏感信息，仅 Admin 可修改。
- 追踪内容可能包含 Prompt 与模型输出，请遵守数据合规要求。

## 相关页面

- [模型目录](/help/settings/models) — 被追踪的模型来源
- [AI Agent 节点](/help/nodes/aiAgent)
