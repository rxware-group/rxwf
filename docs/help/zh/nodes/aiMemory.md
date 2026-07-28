# Memory 节点

## 用途

**会话记忆卫星**：为 Agent 类父节点提供跨多次执行的对话历史（按 **Session ID** 分区存储）。本节点**不参与主数据流**（无 `main` 输入/输出），须通过资源端口 **Memory**（`ai_memory`）接到父节点的 **Memory** 入口。

记忆数据写入平台数据库表 `agent_session_messages`（Lite / Standard 部署均支持），由 API 进程注入 `AgentMemoryRepository`。

## 适用父节点

| 父节点 | 是否可选 | 说明 |
|--------|----------|------|
| **AI Agent** | 可选（至多 1 个） | 执行前加载历史消息注入 LLM，执行后追加本轮 user / assistant |
| **Skill Run** | 可选（画布可接） | 资源口已开放；**当前 Skill Run 执行器尚未注入 Memory 历史**，仅作接线预留 |
| **Crew 工人 / 经理** | 可选 | 工人 `aiAgent` 上接 Memory 后，Crew 编排会编译进 IR，由 `crew-memory-bridge` 加载与回写 |

> 每个父节点**至多连接一个** Memory；重复接线校验报错 **E1014**。

## 参数

| 参数 | 说明 |
|------|------|
| **Session ID** | 会话键，同一 ID 的多轮对话共享记忆；支持 `{{ }}` 表达式（如 `{{ $json.sessionId }}`、`{{ $json.userId }}`） |
| **Max turns** | 参与上下文的最大**对话轮数**（默认 **20**）；运行时会换算为最多 `max(2, min(100, maxTurns × 2))` 条消息记录 |

### 默认值

新建节点默认：`sessionId` 为空，`maxTurns: 20`。Session ID 为空时，会尝试使用父 Agent 参数或执行上下文中的会话 ID（见下文优先级）。

### Session ID 解析优先级

对每条输入 item，运行时按以下顺序取**第一个非空**（并做模板解析）的值作为会话键：

1. **Memory 节点** `sessionId`
2. **父 AI Agent** 参数 `sessionId`
3. **本次执行** 的 `sessionId`（API / 调试执行传入）

未解析出任何 Session ID 时：**不加载历史、不写入新记录**（当次仍为无状态对话）。

### Max turns 与上下文长度

- 仅当父节点**已连接 Memory 卫星**时，才读取本节点的 `maxTurns`
- 未接 Memory 但存在 Session ID 时，加载上限仍按默认 **20 轮** 换算（与接了 Memory 且 `maxTurns=20` 相同）
- 单条历史消息对应一次 `user` 或 `assistant` 记录；一轮完整问答通常产生 2 条记录

## 端口与连接

```
aiMemory ──ai_memory──→ aiAgent
aiMemory ──ai_memory──→ skillRun   （接线合法；Skill Run 记忆注入见上表说明）
```

接线方向：**从 Memory 节点的 Memory 出口** 连到 **父 Agent 节点的 Memory 入口**（箭头由卫星指向父节点）。

```
manualTrigger → set（写入 sessionId）→ aiAgent
aiChatModel ──ai_languageModel──→ aiAgent
aiMemory ──ai_memory──→ aiAgent
```

## 运行时行为

### AI Agent

1. 按 Session ID 从 `agent_session_messages` **读取**最近消息，映射为 `user` / `assistant` / `system` 角色，作为 LangChain **history** 传入模型
2. 本轮 **user 消息**（解析后的 Prompt）与模型 **answer** 在成功后 **append** 到同一会话
3. 多 item 批量执行时，每条 item 可因 `{{ $json... }}` 得到不同 Session ID，彼此隔离

### Crew 编排

- 工人（或经理）`aiAgent` 若连接 Memory，编译进 Crew IR 的 `member.memory`
- 编排开始前 `enrichCrewIrWithMemory` 注入 `history`
- 编排结束后 `persistCrewMemory` 将 Crew 任务输入与最终答案写入各成员会话

### 与 Chat Model / Tool 的关系

- Memory **不替代** Chat Model；须同时连接 **Chat Model** 才能调用 LLM
- Tool 调用步骤**不会**单独写入 Memory；仅保存最终 user 消息与 assistant 答案文本

## 存储与部署

| 项 | 说明 |
|----|------|
| 表 | `agent_session_messages`（`session_id`、`role`、`content`、`execution_id`、`created_at`） |
| Lite | 本地 SQLite，随 `data/rxwf.db` 持久化 |
| Standard | 标准部署同样通过 `AgentMemoryRepository` 访问 |
| 清理 | 无自动过期；**admin** 可在 **设置 → Agent Memory** 按 Session 查看/删除消息或整会话；从画布删除 Memory 节点**不会**删除库中记录 |

## 示例

### 示例 A

1. `aiMemory`，**Session ID** = `support-bot-demo`
2. `aiAgent` + Chat Model + Memory
3. 多次调试：后续运行可引用此前问答

### 示例 B

- 上游输出 `{ "sessionId": "user-42", "prompt": "..." }`
- Memory **Session ID** = `{{ $json.sessionId }}`
- Agent **User 模板** = `{{ $json.prompt }}`

### 示例 C

每名工人 `aiAgent` 各接 `aiMemory`（Session 可用 `{{ $json.workerSession }}`），**Crew 工人** → `crewSequential`；**Max turns** 设为 `5` 限制上下文长度。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1014** | 同一父节点连接了多个 Memory（或其他重复卫星） |
| **W1010** | Memory 未接到 AI Agent / Skill Run（孤立卫星警告） |

更多 AI 类错误见 [error-codes.md](../../../error-codes.md)。

## 调试与 INPUT 面板

- Memory 卫星**无独立执行按钮**；随父 Agent 调试运行
- 父 Agent 执行成功后，可在 Agent 日志流中看到带历史的多轮对话效果（模型输入含以往 user/assistant）
- 未配置 Session ID 时，行为与未挂 Memory 的单轮 Agent 相同

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — Memory 入口与 Session ID 参数
- [Chat Model 节点](/help/nodes/aiChatModel) — 必填语言模型卫星
- [Knowledge (RAG) 节点](/help/nodes/aiKnowledge) — 知识库检索（可与 Memory 并用）
- [Skill Run 节点](/help/nodes/skillRun) — Skill 驱动 Agent（Memory 口预留）
- [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) — 多工人与经理记忆
- [表达式与 `{{ }}` 模板](/help/expressions) — Session ID 动态求值
