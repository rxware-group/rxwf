# Release — P4-E Group Chat 群聊

Plus 部署下 **Group Chat 根节点**、**round-robin / orchestrator 发言**、**UserProxy HITL 续跑** 与 transcript 可观测性。

## 功能摘要

| 能力 | 说明 |
|------|------|
| **groupChat 节点** | main 流根节点；≥2 个 `aiAgent` 经 `group_member` 挂载 |
| **round-robin** | 按画布顺序轮流发言，共享 transcript |
| **orchestrator** | inline 模型或 `group_orchestrator` Agent 动态选发言者 |
| **UserProxy (AC-21)** | `userProxyEnabled` + 每 N 轮暂停；HITL `waiting` + checkpoint 原地续跑 |
| **Tool 可选** | Crew 工人、Group Chat 成员、独立 `aiAgent` 均可 0~n Tool |
| **可观测** | `metadata.agentSteps`（`groupChatTurn`）、输出 `transcript` |

## 模板入口（Agent）

侧栏 **模板** → Agent 分组：

- Round Robin：`agent-group-chat-round-robin`
- Orchestrator：`agent-group-chat-orchestrator`

## 验收命令

```bash
pnpm --filter @rxwf/workflow test
pnpm --filter @rxwf/node-runner test -- group-chat
pnpm --filter @rxwf/execution test -- to-workflow-graph
pnpm --filter @rxwf/api exec vitest run src/integration/p4e-group-chat.integration.test.ts
pnpm --filter @rxwf/web typecheck
```

## 错误码

| 代码 | 说明 |
|------|------|
| E1048 | Group Chat 成员不足 |
| E1049 | orchestrator 模式缺模型/Agent |
| E1050 | 超 maxRounds 无 finalAnswer |
| E1051 | UserProxy resume checkpoint 损坏 |
| W1012 | 成员未配置 `role`（警告） |

详见 [error-codes.md](./error-codes.md)。

## 相关文档

- 设计：[2026-05-30-group-chat-design.md](./superpowers/specs/2026-05-30-group-chat-design.md)
- 计划：[2026-05-30-group-chat.md](./superpowers/plans/2026-05-30-group-chat.md)
- P4-C Agent：[RELEASE-v1.2-p4c-agent.md](./RELEASE-v1.2-p4c-agent.md)

## 已知限制

- 默认 **native 循环**；`executionBackend: langgraph` 使用 LangGraph StateGraph（`AiRuntime.runGroupChat`）
- **UserProxy / HITL 续跑** 在 `langgraph` 后端下自动回退 **native**（checkpoint 由 native 循环管理）
- 不做 CrewAI Sidecar Group Chat 后端
- LangSmith 不替代本系统 `metadata.agentSteps` 时间线
