# P4-C1：Agent 独立画布

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (MVP) |
| **日期** | 2026-05-23 |

## 目标

实现 FR-15.4 **范式 B**：`settings.workflowKind: 'agent'` 的工作流使用独立列表 `/agents` 与精简节点面板；执行引擎与 `automation` 相同。

## 设计要点

- **元数据**：`WorkflowDefinition.settings.workflowKind`，默认 `automation`。
- **API**：`GET /api/workflows?kind=agent|automation`。
- **UI**：侧栏「Agent」、`AgentListPage`、`/agents/:id` 复用 `WorkflowEditorPage`（`paletteMode=agent`）。
- **默认模板**：Manual + aiAgent + aiChatModel + aiMemory（用户仍需添加 ≥1 Tool 方可保存）。

## 非目标（本阶段）

- `Handoff` / HITL 节点
- Supervisor / 多 Agent 编排（见 P4-C3 Crew）
