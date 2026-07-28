# P4-C2：Agent + RAG（aiKnowledge 卫星）

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (MVP) |
| **日期** | 2026-05-23 |

## 目标

在工作流 Agent 子图中增加 **Knowledge (RAG)** 卫星节点 `aiKnowledge`，经 `ai_knowledge` 连到 `aiAgent`；执行前按用户消息检索知识库并注入系统提示（复用 `@rxwf/knowledge`）。

## 参数

- `knowledgeBaseIds: string[]`（或逗号分隔字符串）

## 非目标

- 流式引用卡片（Chat 已有）
- 多模板选择 UI（固定 `support` 模板）
