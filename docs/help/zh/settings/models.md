# 模型目录

在 **设置 → 模型**（`/settings/models`）中注册 **LLM Provider** 与 **模型**，供 Chat Model、LLM、RAG 等节点选用。

## Provider

| 类型 | 说明 |
|------|------|
| **Ollama** | 本地 Ollama，填写 Base URL（默认 `http://127.0.0.1:11434`） |
| **OpenAI 兼容** | 任意 OpenAI API 兼容端点（OpenAI、Azure、本地 vLLM 等） |

Admin 可 **添加 Provider**、编辑 Base URL、关联 API Key [凭证](/help/settings/credentials)，并 **删除** 未使用的 Provider。

## 注册模型

在 Provider 下添加模型条目：

- **模型 ID**（如 `llama3`、`gpt-4o`）
- **用途**：chat / embedding 等（依 UI 选项）
- **健康检查**：可触发检测，状态显示 ok / error / unknown

## 在工作流中使用

- [Chat Model 节点](/help/nodes/aiChatModel) 通过 `provider` + `model` 选择目录中的模型。
- [LLM 节点](/help/nodes/llm) 等同理。
- [知识库设置](/help/settings/knowledge) 的 **默认 RAG 模型** 也来自本目录。

## 权限

- **Admin**：完整 CRUD。
- **普通用户**：通常只读查看可用模型列表。

## 首次部署建议

1. 添加 Ollama 或 OpenAI 兼容 Provider。
2. 注册至少一个 **chat** 模型并确认健康检查通过。
3. 若使用 RAG，再配置 [知识库](/help/settings/knowledge) 的 Embedding 与 RAG 模型。

## 相关页面

- [知识库平台配置](/help/settings/knowledge)
- [LangSmith](/help/settings/langsmith) — 可选追踪
