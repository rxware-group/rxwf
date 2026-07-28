# Release v1.1 — Workflow AI Agent (P4-B)

Plus 部署下工作流画布 **AI Agent** 子图（Chat Model / Memory / Tool 卫星节点）、会话 Memory、MCP/HTTP/Workflow Tool 与执行可观测性。

## 功能摘要

- **AI Agent 根节点** + 卫星：`aiChatModel`、`aiMemory`（可选）、`aiKnowledge`（可选）、`aiOutputParser`（可选）、`toolMcp` / `toolHttp` / `toolWorkflow`
- **$fromAI Tool 参数**：Tool 字段 `fromAi` 模式 / `{{ $fromAI("key", ...) }}` → LangChain tool schema + 运行时注入
- **Output Parser 卫星**：`aiOutputParser` → 约束 Agent 最终 JSON 输出（`parsed` 字段）
- **HITL 人工审批**：`humanApproval` 节点 → 执行/节点 `waiting` → `POST /api/executions/:id/hitl/resume`；可选 `timeoutMs` + `timeoutAction` 到期自动续跑
- **LangGraph ReAct** 经 `@rxwf/ai-runtime`（Ollama / OpenAI-compatible）
- **跨执行 Memory**：`agent_session_messages`（Lite SQLite / Standard Postgres）
- **Agent 步骤可观测**：`node_runs.metadata.agentSteps`（含 `tool`、`status`、`durationMs`）；执行详情页优先读 metadata
- **全量执行轮询**：执行中每 2s 刷新 `GET /api/executions/:id`；编辑器「执行记录」页实时展示 Agent 步骤；单节点调试经 SSE 增量推送 `agentStream`
- **Workflow Tool**：同步 `runChild` 子工作流（目标须 **published**；`exposeAsTool` 见 P4-B′ 计划）

## 验收命令

```bash
pnpm test
pnpm --filter @rxwf/api test -- p4b
pnpm --filter @rxwf/web typecheck
pnpm --filter @rxwf/i18n-catalog test
```

### 可选本地附加

```bash
# 真实 Ollama 冒烟（需本地 Ollama + 模型）
RXWF_TEST_OLLAMA=1 pnpm --filter @rxwf/api test -- p4b-agent-ollama

# Standard 档 Agent Memory（需 Postgres）
RXWF_DATABASE_URL=postgres://... pnpm --filter @rxwf/api test -- p4b-agent-standard
```

## 错误码（i18n）

| 代码 | 说明 |
|------|------|
| E1012–E1014 | Agent 卫星连接校验 |
| E1022–E1024 | Workflow Tool 目标（E1024 = exposeAsTool，P4-B′） |
| E3004 | Agent 最大迭代 |
| E3010–E3012 | Agent 运行时 / Tool 失败 |
| E3013 | Output Parser 结构化输出解析失败 |
| E3014 | HITL 审批拒绝或无效续跑 |
| W1011 | Workflow Tool 目标未发布（校验警告） |

详见 [error-codes.md](./error-codes.md)。

## 相关文档

- 设计：[2026-05-23-workflow-agent-node-design.md](./superpowers/specs/2026-05-23-workflow-agent-node-design.md)
- 严格收尾：[2026-05-23-workflow-agent-node-strict-closeout.md](./superpowers/plans/2026-05-23-workflow-agent-node-strict-closeout.md)
- Workflow Tool exposeAsTool：[2026-05-23-workflow-tool-expose-as-tool.md](./superpowers/plans/2026-05-23-workflow-tool-expose-as-tool.md)

## 已知限制 / 后续

- `settings.exposeAsTool` 文档与计划 checkbox 见 **P4-B′**（功能已实现）
