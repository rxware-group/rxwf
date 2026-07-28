# P4-C3c：Crew Supervisor（范式 F，待实施）

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (MVP) |
| **日期** | 2026-05-23 |
| **前置** | `crewHierarchical` + `delegate_parallel` |

## 目标

对标 FR-15.4 **范式 F**：监督者 LLM **每步动态选择** 下一执行的子 Agent（可重复调用同一工人、可跳过、可提前结束），而非仅由经理 JSON 一次性列出并行任务。

## 与 `crewHierarchical` 差异

| | crewHierarchical | crewSupervisor（计划） |
|--|------------------|------------------------|
| 调度主体 | 经理 `aiAgent` + JSON | 专用 `crewSupervisor` 节点内置监督循环 |
| 选人 | 经理显式 `member` | Supervisor 从 roster 中选 `nextWorker` |
| 并行 | `delegate_parallel` 一轮 | 可选 `parallel_batch` 或保持串行决策 |
| 工具 | 工人各自 Tool | 同左；Supervisor 通常无 Tool |

## 计划 JSON 协议（草案）

```json
{"action":"run","member":"Researcher","task":"..."}
{"action":"run_parallel","assignments":[...]}
{"action":"finish","answer":"..."}
```

## 节点设计（草案）

- 类型：`crewSupervisor`
- 端口：同 `crewHierarchical`（`crew_manager` 可选用于人工复核 Agent；`crew_member` 工人）
- 参数：`maxSteps`（默认 15）、`allowParallel`（默认 true）

## 实现路径

1. 抽取 `crew-helpers` / `crew-run-worker` 为共享模块（**已完成**）
2. 新建 `crew-supervisor.ts` 执行器（LangGraph 可选；MVP 用 chat 循环）
3. 编辑器节点 + 模板 + 集成测试
4. 与 `metadata.agentSteps` 时间线展示 `supervisorStep`

## 非目标

- Group Chat（范式 E）
- Consensual 投票
