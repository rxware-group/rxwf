# P4-C：AI 里程碑路线图（Agent 画布 → RAG → Crew → LangSmith）

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-23 |
| **状态** | Approved（按序实施） |
| **前置** | P4-B / P4-B′ 已完成 |

## 顺序与依赖

| 阶段 | 代号 | 目标 | 依赖 |
|------|------|------|------|
| 1 | **P4-C1** | Agent 独立画布（`workflowKind=agent`） | P4-B 卫星子图 — **MVP 已落地** |
| 2 | **P4-C2** | Agent + RAG（`aiKnowledge` 卫星） | C1、知识库包 — **MVP 已落地** |
| 3 | **P4-C3** | Crew 编排（sequential / hierarchical / **parallel**） | C1 — **parallel 已落地** |
| 3b | **P4-C3c** | Crew Supervisor（范式 F） | C3 — **MVP 已落地** |
| 4 | **P4-C4** | LangSmith / 外部追踪 | C1 — **通过环境变量启用**（见 LangSmith spec） |
| 5 | **P4-D** | CrewAI 可选后端 + 自动联署 | C3 — **D1–D3 + post-D3 增强已落地**（见 [RELEASE-v1.3-crewai.md](../../RELEASE-v1.3-crewai.md)） |
| 6 | **P4-E** | Group Chat 群聊（round-robin / orchestrator / UserProxy） | C1 — **MVP 已落地**（见 [RELEASE-v1.3-group-chat.md](../../RELEASE-v1.3-group-chat.md)） |

## 与 P4-B 关系

- P4-B 采用 **范式 A**（DAG 内 `aiAgent` + 卫星节点）。
- P4-C1 增加 **范式 B**（`settings.workflowKind: 'agent'`），专用列表与编辑器模式；**执行引擎不变**。
- P4-B′ `exposeAsTool` 继续仅作用于 `automation` 工作流。

## 文档索引

| 阶段 | Spec | Plan |
|------|------|------|
| C1 | [2026-05-23-agent-canvas-design.md](./2026-05-23-agent-canvas-design.md) | [plans/2026-05-23-agent-canvas.md](../plans/2026-05-23-agent-canvas.md) |
| C2 | [2026-05-23-agent-rag-design.md](./2026-05-23-agent-rag-design.md) | [plans/2026-05-23-agent-rag.md](../plans/2026-05-23-agent-rag.md) |
| C3 | [2026-05-23-crew-sequential-design.md](./2026-05-23-crew-sequential-design.md) | [plans/2026-05-23-crew-sequential.md](../plans/2026-05-23-crew-sequential.md) |
| C4 | [2026-05-23-langsmith-tracing-design.md](./2026-05-23-langsmith-tracing-design.md) | [plans/2026-05-23-langsmith-tracing.md](../plans/2026-05-23-langsmith-tracing.md) |
| D | [2026-05-29-crewai-integration-design.md](./2026-05-29-crewai-integration-design.md) | [plans/2026-05-29-crewai-integration.md](../plans/2026-05-29-crewai-integration.md) |
| E | [2026-05-30-group-chat-design.md](./2026-05-30-group-chat-design.md) | [plans/2026-05-30-group-chat.md](../plans/2026-05-30-group-chat.md) |
