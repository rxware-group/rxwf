# P4-C3b：Crew 层级编排（hierarchical）

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (MVP) |
| **日期** | 2026-05-23 |

## 目标

经理 `aiAgent` 通过 `crew_manager` 连接 `crewHierarchical`，每轮输出 JSON 决定 **委派** 或 **结束**；工人经 `crew_member` 连接，由 `runAiAgentNode` 执行具体任务。

## 连线

| 端口 | 方向 | 说明 |
|------|------|------|
| `crew_manager` | 经理 `aiAgent` → `crewHierarchical` | 必选 |
| `crew_member` | 工人 `aiAgent` → `crewHierarchical` | ≥1 |

## 经理 JSON 协议

单人委派：

```json
{"action":"delegate","member":"<id|name|role>","task":"<instruction>"}
```

**并行委派**（同一轮 `Promise.all`）：

```json
{
  "action": "delegate_parallel",
  "assignments": [
    { "member": "Researcher", "task": "..." },
    { "member": "Writer", "task": "..." }
  ]
}
```

完成：

```json
{"action":"finish","answer":"<final answer>"}
```

## 参数

- `maxDelegations`（默认 10，上限 20）：经理决策轮次上限
- `allowParallelDelegation`（默认 true）：经理是否可使用 `delegate_parallel`

## 错误码

| 代码 | 含义 |
|------|------|
| E1031 | 未连接经理 |
| E1032 | 无工人 |
| E1033 | 经理 JSON 无效 / 无步骤 |
| E1034 | 委派了未知成员 |

## 非目标

- Supervisor 多路径并行（范式 F）
- Consensual 投票（P2）
