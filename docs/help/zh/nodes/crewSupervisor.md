# Crew (Supervisor) 节点

## 用途

**监督者动态编排**：监督模型在每一步决定「派哪位工人执行什么任务」，可多次调用同一工人，也可在一轮内 **并行** 派发多名工人，直至输出最终答案。

与 **Crew (顺序)** / **Crew (层级)** 的区别：

| 节点 | 编排方式 |
|------|----------|
| Crew (顺序) | 工人按画布顺序固定执行一遍 |
| Crew (层级) | 经理多轮委派，有最大委派轮次上限 |
| **Crew (Supervisor)** | 监督者每步自由选择工人（可重复），步数由 **最大监督步数** 限制 |

## 端口与连接

### 主数据流

```
manualTrigger ──main──→ crewSupervisor ──main──→ 下游节点
```

上游 **main** 输入的 JSON 会作为 Crew 的 **原始任务**（`Original task`）交给监督者。

### 资源连接

```
aiAgent ──crew_member──→ crewSupervisor   （工人，至少 1 名）
aiAgent ──crew_manager──→ crewSupervisor  （可选，用作监督模型来源）
```

| 入口标签 | 端口 ID | 说明 |
|----------|---------|------|
| **工人** | `crew_member` | 可接多名 `aiAgent`；每名工人须自备 **Chat Model**（及可选 Tool 卫星） |
| **经理 (可选)** | `crew_manager` | 接入一名 `aiAgent` 时，优先用其 **Chat Model** 作为监督模型，可不再填写节点内 Supervisor Model |

接线方向：**从 AI Agent 底部资源出口** 连到 **本节点顶部同名资源入口**。

## 参数

| 参数 | 说明 |
|------|------|
| **最大监督步数** | 监督循环上限，默认 15（运行时限制 1–30） |
| **允许并行批次** | 为 `true` 时监督者可一次 `run_parallel` 派发多名工人 |
| **Supervisor 模型** | 监督用 LLM 的 Provider（Ollama / OpenAI 兼容） |
| **Supervisor Model** | 模型名；也可改由 **Crew 经理** Agent 的 Chat Model 提供 |
| **Supervisor Base URL** | OpenAI 兼容端点（可选） |
| **Supervisor Credential** | OpenAI 兼容时的凭证（属性面板在 Provider 为 openai-compatible 时显示） |
| **执行后端** | `native`（内置循环）或 `crewai`（CrewAI Sidecar） |
| **CrewAI 编排模式** | `crew` / `flow`（仅 `crewai` 后端） |
| **Knowledge 注入模式** | 工人 [Knowledge (RAG)](/help/nodes/aiKnowledge) 卫星的预检索注入策略（`inject` / `native`） |
| **启用 CrewAI 评测** | 是否向 Sidecar 开启评测钩子 |
| **CrewAI 内置 Tool** | `crewai` 后端时的内置工具白名单 JSON |

## 执行流程（native）

1. 监督模型根据工人名册与已完成步骤，输出 **JSON** 决策之一：
   - `{"action":"run","member":"…","task":"…"}` — 派一名工人
   - `{"action":"run_parallel","assignments":[…]}` — 并行派多名（需开启 **允许并行批次**）
   - `{"action":"finish","answer":"…"}` — 结束并返回最终答案
2. 被选工人以 ReAct Agent 执行分配任务，结果记入 `crewSteps`
3. 重复直至 `finish` 或达到 **最大监督步数**

输出 `main` 通常包含 `answer`、`crewSteps`、`supervisorSteps` 等字段；执行时间线可查看监督决策与工人步骤。

## 示例

### 示例 A

1. `crewSupervisor`，**Supervisor Model** = `llama3`
2. 工人 `aiAgent`「Researcher」（**角色** `Researcher`）+ `aiChatModel`
3. Researcher **Crew 工人** → Supervisor **工人** 口
4. `manualTrigger` → Supervisor，输入 `{ "task": "调研并总结某主题" }`

### 示例 B

1. 另建经理 `aiAgent` + Chat Model
2. 经理 **Crew 经理** → Supervisor **经理 (可选)** 口
3. 可留空节点内 Supervisor Model，由经理 Chat Model 驱动

### 示例 C

1. **允许并行批次** = `true`；连接 Researcher、Writer 两名工人
2. Researcher 接 `aiKnowledge`（内部 wiki 库 ID）
3. Supervisor **Knowledge 注入模式** = `inject`；监督者并行派发检索与撰写子任务

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1032** | 未连接至少一名工人 Agent |
| **E1035** | 未配置监督模型（无 `supervisorModel` 且无带 Chat Model 的经理 Agent） |
| **E1033** | 监督模型返回无效 JSON 或无法解析决策 |
| **E1012** | 工人 Agent 未连接 Chat Model |
| **E3001** | AI 运行时未配置 |
| **E1041** | CrewAI 内置 Tool 不在允许列表（`crewai` 后端） |

更多 Crew 类错误见 [error-codes.md](../../../error-codes.md)。

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — 工人 / 经理 Agent 与资源出口说明
- [Memory 节点](/help/nodes/aiMemory) — 工人跨轮会话记忆（接在工人 Agent 上）
- [Knowledge (RAG) 节点](/help/nodes/aiKnowledge) — 工人知识库检索与 Crew 注入模式
- [Crew (顺序) 节点](/help/nodes/crewSequential)
- [Crew (层级) 节点](/help/nodes/crewHierarchical)
