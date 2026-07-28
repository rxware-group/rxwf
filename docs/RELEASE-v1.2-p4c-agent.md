# Release v1.2 — P4-C Agent 画布 / RAG / Crew

Plus 部署下 **Agent 独立画布**、**RAG 知识库卫星**、**Crew 编排（顺序 / 层级 / Supervisor）** 与可观测性增强。

## 功能摘要

| 阶段 | 能力 |
|------|------|
| **P4-C1** | `workflowKind=agent`；侧栏「模板」页提供 Agent 模板；编辑器按 `workflowKind` 启用 `paletteMode=agent` |
| **P4-C2** | `aiKnowledge` 卫星 → `aiAgent`，检索注入系统提示 |
| **P4-C3** | `crewSequential` / `crewHierarchical`（含 `delegate_parallel`）/ `crewSupervisor` |
| **P4-C4** | LangSmith：环境变量或 **设置 → LangSmith**（Admin + Plus）写入进程 `LANGCHAIN_*` |
| **可观测** | `metadata.agentSteps`（含 Crew 运行中增量刷新）、执行时间线、编辑器 Crew 流格式化 |

## 模板入口（Agent）

侧栏 **模板** → Agent 分组：

- 单 Agent：`agent-single`
- Crew 顺序：`agent-crew-sequential`
- Crew 层级：`agent-crew-hierarchical`
- Supervisor：`agent-crew-supervisor`

旧 `/agents/*` 路由重定向至 `/templates` 或 `/workflows/:id`。

## 验收命令

```bash
pnpm --filter @rxwf/workflow build
pnpm test
pnpm --filter @rxwf/api test -- p4b
pnpm --filter @rxwf/api exec vitest run src/integration/p4c-crew.integration.test.ts
pnpm --filter @rxwf/web test
```

## 错误码（Crew）

| 代码 | 说明 |
|------|------|
| E1030–E1035 | Crew 校验与运行；见 [error-codes.md](./error-codes.md) |
| W1012 | Crew 成员未配置 `role`（警告） |

## 相关文档

- 路线图：[2026-05-23-p4-c-ai-milestone-roadmap.md](./superpowers/specs/2026-05-23-p4-c-ai-milestone-roadmap.md)
- P4-B Agent：[RELEASE-v1.1-agent.md](./RELEASE-v1.1-agent.md)
- LangSmith：[2026-05-23-langsmith-tracing-design.md](./superpowers/specs/2026-05-23-langsmith-tracing-design.md)

## 已知限制

- LangSmith 不替代本系统执行时间线；`metadata.agentSteps` 仍为首选
- Crew 工人 `aiAgent` 需各自 Chat Model；Tool 可选 0~n（有 Tool 走 ReAct，无 Tool 纯对话）
- **HITL 超时自动策略**：`humanApproval.timeoutMs` + `timeoutAction`（reject/approve）；API 后台 sweeper 到期自动续跑
