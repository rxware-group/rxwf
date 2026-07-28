# Crew (层级) 节点

## 用途

**Crew Hierarchical** 由 **经理 Agent** 多轮 **委派** 任务给工人：经理每轮输出 JSON 决策（`delegate` / `delegate_parallel` / `finish`），工人执行后结果回传经理，直至 `finish` 或达到 **最大委派轮次**。适合需要动态拆分子任务的多角色协作。

与 **Crew (顺序)** 的区别：本节点 **必须** 连接经理；工人数量 ≥1（不必固定顺序）。与 **Crew (Supervisor)** 的区别：层级模式由经理 JSON 委派，Supervisor 由监督模型逐步选人。

## 端口与连接

### 主数据流

```
manualTrigger ──main──→ crewHierarchical ──main──→ 下游
```

### 资源连接

```
aiAgent（经理）──crew_manager──→ crewHierarchical（经理口，必填）
aiAgent（工人）──crew_member──→ crewHierarchical（工人口，≥1 名）
```

| 入口 | 端口 ID | 说明 |
|------|---------|------|
| **经理** | `crew_manager` | 一名 `aiAgent`；其 **Chat Model** 可作为经理 LLM |
| **工人** | `crew_member` | 一名或多名工人 Agent |
| **main** | 主流程入/出 | 上游 JSON 为 Crew 原始任务 |

## 参数

| 参数 | 说明 |
|------|------|
| **执行后端**（`executionBackend`） | `native` 或 `crewai` |
| **最大委派轮次**（`maxDelegations`） | 1–20，默认 10 |
| **允许并行委派**（`allowParallelDelegation`） | 为 `true` 时经理可输出 `delegate_parallel` 一次派多名工人 |
| **Knowledge 注入模式** | 工人 Knowledge 卫星的 Crew 级注入策略 |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1031** | 未连接 **经理** Agent（`crew_manager`） |
| **E1032** | 未连接至少 **1** 名工人 |
| **E1033** | 经理返回无效 JSON 或无有效委派 |
| **E1012** | 经理或工人缺 Chat Model |
| **E2003** | 缺工作流定义上下文 |

## 示例

### 示例 A

1. 添加经理 `aiAgent`（填写 **角色**「项目经理」）并接 `aiChatModel`
2. 添加工人 `aiAgent`「执行者」，接 Chat Model
3. 经理 **Crew 经理** 口、工人 **Crew 工人** 口分别连到 `crewHierarchical`
4. 上游传入 `{ "goal": "整理本周会议纪要" }`

### 示例 B

1. **允许并行委派** 设为 `true`
2. 连接 2+ 工人（如「检索」「分析」）
3. 经理可在单轮 `delegate_parallel` 中同时派给多名工人

### 示例 C

- **方式 1**：节点内不填 Supervisor 字段，完全使用经理 Agent 的 Chat Model
- **方式 2**：经理 Agent 仅提供 persona，节点参数指定 Ollama / OpenAI 兼容监督模型（与 [Crew (Supervisor)](/help/nodes/crewSupervisor) 类似）

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — **Crew 经理** / **Crew 工人** 资源出口
- [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) — 逐步监督选人
- [Memory 节点](/help/nodes/aiMemory) — 可接在工人 Agent 上保留会话
