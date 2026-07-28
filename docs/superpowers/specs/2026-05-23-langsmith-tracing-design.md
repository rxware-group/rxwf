# P4-C4：LangSmith 追踪（待实施）

| 字段 | 内容 |
|------|------|
| **状态** | Implemented (env-based MVP) |
| **日期** | 2026-05-23 |

## 目标

当环境变量 `LANGCHAIN_TRACING_V2=true` 且配置 `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` 时，LangChain Agent 调用自动上报 LangSmith；与现有 `AiStreamChunk` / `metadata.agentSteps` 并存。

## 实施要点（MVP）

在 API/Runner 进程环境中设置（LangChain JS 自动拾取）：

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_pt_...
LANGCHAIN_PROJECT=rx-workflow
```

无需改代码即可在 LangSmith 控制台查看 `runAgent` 链路；本地 `metadata.agentSteps` 仍为首选执行时间线数据源。

## 设置页（P3）

管理员在 **设置 → LangSmith**（Plus）可配置：

- 启用 `LANGCHAIN_TRACING_V2`
- `LANGCHAIN_API_KEY`（加密存储，界面掩码）
- `LANGCHAIN_PROJECT`

保存后立即调用 `applyLangChainTracingEnv` 作用于当前 API 进程。

## 后续

- `langchain-runtime` 显式 `callbacks` 注入（自定义 project 名）

## 非目标

- 替代 `node_runs.metadata.agentSteps`
