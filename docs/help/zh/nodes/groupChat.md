# Group Chat 节点

## 用途

**Group Chat** 模拟多 Agent **群聊协商**：多名成员 Agent 按 **Round-robin** 或 **Orchestrator** 模式轮流/被选中发言，直到出现 **终止关键词** 或达到 **最大轮次**。输出最终 `answer`、可选 `transcript` 与 `groupChatSteps`。可选 **UserProxy** 在指定轮次暂停等待人工输入（HITL resume）。

基于 AutoGen 范式，与 Crew 系列的区别：无经理委派 JSON，强调多轮对话式协商。

## 端口与连接

### 主数据流

```
manualTrigger ──main──→ groupChat ──main──→ 下游
```

### 资源连接

```
aiAgent ──group_member──→ groupChat（群聊成员，≥2 名）
aiAgent ──group_orchestrator──→ groupChat（Orchestrator 口，可选）
```

| 入口 | 端口 ID | 说明 |
|------|---------|------|
| **群聊成员** | `group_member` | 每名成员须连接 **Chat Model** |
| **Orchestrator** | `group_orchestrator` | `speakerSelection=orchestrator` 时可选；否则用节点内 orchestrator 模型 |
| **main** | 主流程 | 上游 JSON 作为群聊初始任务/上下文 |

## 参数

| 参数 | 说明 |
|------|------|
| **最大轮次**（`maxRounds`） | 1–50，默认 8 |
| **发言选择**（`speakerSelection`） | `roundRobin` 或 `orchestrator` |
| **终止关键词**（`terminationKeywords`） | 逗号分隔，默认 `TERMINATE,FINISH,完成` |
| **返回 transcript** | `returnTranscript` / `returnTranscriptMarkdown` |
| **UserProxy** | `userProxyEnabled`、`userProxyEveryNRounds`、`userProxyPrompt` |
| **Orchestrator 模型** | Provider / Model / Credential（无 Orchestrator Agent 时使用） |
| **执行后端**（`executionBackend`） | `native` 或 `langgraph` |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1048** | 群聊成员 **少于 2** 名 |
| **E1012** | 成员未连接 Chat Model |
| **E1049** | orchestrator 模式缺少 Orchestrator Agent 或模型配置 |
| **E2003** | 缺工作流定义上下文 |
| **E3001** | AI 运行时未配置 |

UserProxy 暂停时执行状态为 `waiting`，须通过 API resume 继续（见集成测试 `p4e-group-chat.integration.test.ts`）。

## 示例

### 示例 A

1. 添加两名 `aiAgent`（如「乐观派」「谨慎派」），各接 `aiChatModel`
2. **群聊成员** 口连到 `groupChat`；**发言选择** = `roundRobin`
3. `manualTrigger` → `groupChat`，输入 `{ "question": "是否上线新功能？" }`
4. 成员轮流发言直至终止词或 `maxRounds`

### 示例 B

1. **发言选择** 选 `orchestrator`
2. 方式 A：接一名 **群聊 Orchestrator** Agent（带 Chat Model）
3. 方式 B：在节点填 **Orchestrator Model**（如 Ollama `llama3`）
4. 每轮由 orchestrator 决定下一发言者

### 示例 C

1. **UserProxy** 启用，`userProxyEveryNRounds` 设为 `3`
2. 每 3 轮暂停，提示用户输入纠偏或补充（`userProxyPrompt`）
3. Resume 后继续群聊直至终止

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — **群聊成员** / **群聊 Orchestrator** 出口
- [Chat Model 节点](/help/nodes/aiChatModel) — 每名成员必填
- [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) — 另一种多 Agent 编排
