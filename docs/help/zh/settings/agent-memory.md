# Agent Memory

在 **设置 → Agent Memory**（`/settings/agent-memory`）中查看与管理 AI Agent 会话记忆。**仅 Admin** 可访问。

## 会话列表

列表按 **Session ID** 聚合，显示消息条数、首条与末条消息时间。支持搜索 Session ID 与分页。

点击某行进入 **会话详情**（`/settings/agent-memory/:sessionId`），查看该会话下的完整消息历史。

## 删除记忆

- 在列表或详情页可 **删除单个会话** 的全部记忆。
- 删除后，依赖该 Session ID 的 [Memory 节点](/help/nodes/aiMemory) 将不再拥有历史上下文。

## 与工作流的关系

- Agent 节点通过 **Memory 卫星** 或 `sessionId` 参数绑定会话。
- Session ID 通常来自 Webhook 触发、Chat Bot 或表达式 `{{ $json.sessionId }}`。
- 本页为运维/调试用途，普通用户无需访问。

## 相关帮助

- [Memory 节点](/help/nodes/aiMemory) — 工作流中如何注入会话记忆
- [AI Agent 节点](/help/nodes/aiAgent) — Agent 编排与 Tools
