# P4-C3：Crew 编排

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (sequential MVP) |
| **日期** | 2026-05-23 |

## 目标

FR-15.4 范式 D 的 **v1 MVP**：`crewSequential` 根节点 + 多个 `aiAgent` 角色节点，按画布顺序依次执行，上一角色输出作为下一角色 `userMessage` 上下文。

## 依赖

- P4-C1 Agent 画布
- P4-B aiAgent 执行链

## 已实现

- 节点类型 `crewSequential`、校验 **E1030**、执行器 `crew-sequential.ts`
- Agent 画布模板：`/agents/new-crew`
- 相关编排见 [crew-hierarchical-design.md](./2026-05-23-crew-hierarchical-design.md)、[crew-supervisor-design.md](./2026-05-23-crew-supervisor-design.md)

## 连线

| 端口 | 方向 | 说明 |
|------|------|------|
| `main` | 触发器 → `crewSequential` | 执行入口 |
| `crew_member` | 工人 `aiAgent` → `crewSequential` | ≥2，按画布 X/Y 顺序执行 |

## 错误码

| 代码 | 含义 |
|------|------|
| E1030 | 少于两名 `crew_member` 工人 |
| W1012 | 工人未配置 `role`（警告） |
