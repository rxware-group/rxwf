# AI Agent 节点

## 用途

基于 **Tools Agent**（ReAct）的通用 Agent 节点：连接 **Chat Model** 后，可按需挂载 Memory、Knowledge、Output Parser 与多种 **Tool 卫星**，由模型在迭代循环中调用工具并生成回答。

与 **Skill Run** 的区别：不加载 `SKILL.md`，系统提示与工具能力完全由本节点参数与卫星接线决定。

## 端口与连接

主数据流：**main** 入/出。卫星与资源口见下文「卫星连接」与「资源出口」。

## 参数

| 参数 | 说明 |
|------|------|
| **Prompt 类型** | `auto`：将上游输入 JSON 序列化为用户消息；`define`：使用下方 **User 模板** |
| **User 模板** | `define` 模式下的用户消息；支持 `{{ }}` 表达式 |
| **System** | 追加的系统提示，与 Knowledge / Output Parser 注入内容合并 |
| **最大迭代** | ReAct 循环上限，默认 10 |
| **Session ID** | 可选；与 Memory 卫星配合，支持 `{{ $json.sessionId }}` 等表达式 |
| **角色 / 目标 / 背景** | 供 **Crew** 编排读取的 Agent 元数据 |
| **Task 描述 / 期望输出** | 供 **CrewAI** 侧映射任务说明（覆盖默认 Crew 任务文案） |

工作流 **设置** 中还可配置超时等高级项（与节点级 `timeoutMs` 等字段联动）。

## 卫星连接

```
manualTrigger → aiAgent
aiChatModel ──ai_languageModel──→ aiAgent   （必填，且仅一个）
aiMemory ──ai_memory──→ aiAgent             （可选，至多一个）
aiKnowledge ──ai_knowledge──→ aiAgent        （可选）
aiOutputParser ──ai_outputParser──→ aiAgent （可选）
tool* ──ai_tool──→ aiAgent                    （可选，可多个）
```

### Chat Model（必填）

提供 LLM（Ollama / OpenAI 兼容）。未连接时校验报错 **E1012**，运行时报 **E3010**。详见 [Chat Model 节点](/help/nodes/aiChatModel)。

### Tool 卫星（可选）

可连接 0~n 个工具，无 Tool 时以纯对话模式运行。支持的卫星类型包括：

| 类型 | 说明 |
|------|------|
| `toolRead` / `toolWrite` / `toolGrep` / `toolShell` | 工作区文件与 Shell（见各 Tool 帮助） |
| `toolWebSearch` | 联网搜索 |
| `toolMcp` / `toolHttp` | MCP 与 HTTP 自定义工具 |
| `toolWorkflow` | 将已发布子工作流暴露为 Tool |
| `toolSkill` / `toolSubagent` | 调用 Skill 包或嵌套子 Agent |

工具在 LLM 侧的名称取卫星节点的 **节点名称**；内置固定能力 Tool 的描述按界面语言自动生成。

### Memory（可选）

`aiMemory` 提供跨轮次会话记忆（按 Session ID 读写 `agent_session_messages`）。Session ID 优先取 Memory 节点参数，其次 Agent 节点 `sessionId`，再次执行级 `sessionId`。详见 [Memory 节点](/help/nodes/aiMemory)。

### Knowledge（可选）

`aiKnowledge` 以当前 **User 消息** 检索侧栏知识库，将命中片段格式化为「参考资料」并追加到系统提示（RAG）。须在卫星节点填写知识库 ID；无命中时可能报错 **E3003**。详见 [Knowledge (RAG) 节点](/help/nodes/aiKnowledge)。

### Output Parser（可选）

`aiOutputParser` 提供 JSON Schema，约束 Agent 最终输出为结构化 JSON。

## 出口

### 主出口 `main`

独立运行时，上游经 **main** 进入 Agent，输出通常包含 `answer` 及可选的 `agentSteps`（中间 Tool 步骤）。

### 资源出口（画布底部）

> 若在工作流 **设置 → Runner** 中关闭 **Crew / 群聊编排**，画布上这四个底部资源口及相关参数、编排节点类型会隐藏；已有连线仍保留在 JSON 中，执行时按图运行。

节点底部有四个 **资源出口**，用于把本 Agent 注册为 Crew / 群聊编排中的成员，**不参与主数据流**（与 `main` 输入/输出无关）：

| 画布标签 | 端口 ID | 用途 |
|----------|---------|------|
| **Crew 工人** | `crew_member` | 作为工人接入 Crew 编排 |
| **Crew 经理** | `crew_manager` | 作为经理接入层级 / 监督类 Crew |
| **群聊成员** | `group_member` | 作为发言者接入 Group Chat |
| **群聊 Orchestrator** | `group_orchestrator` | 作为群聊主持人（orchestrator 模式） |

接线方向：**从 AI Agent 的资源出口** 连到 **编排节点的同名资源入口**（箭头由 Agent 指向 Crew / Group Chat 节点）。

```
aiAgent ──crew_member──→ crewSequential / crewHierarchical / crewSupervisor
aiAgent ──crew_manager──→ crewHierarchical / crewSupervisor（经理口）
aiAgent ──group_member──→ groupChat
aiAgent ──group_orchestrator──→ groupChat（orchestrator 模式，可选）
```

#### Crew 工人（`crew_member`）

- 接入 **Crew Sequential**、**Crew Hierarchical**、**Crew Supervisor** 的工人/成员口
- 同一 Agent 可同时配置自己的 Chat Model 与 Tool 卫星
- **角色 / 目标 / 背景** 参数会写入 Crew 成员描述，供经理分配任务时识别
- Sequential 至少需 **2** 名工人（**E1030**）；Hierarchical / Supervisor 至少 **1** 名工人（**E1032**）

#### Crew 经理（`crew_manager`）

- 接入 **Crew Hierarchical** 的经理口（必填，**E1031**）或 **Crew Supervisor** 的经理口（可选，可改用节点内监督模型）
- 经理 Agent 须已连接 Chat Model；负责拆解任务并委派给工人

#### 群聊成员（`group_member`）

- 接入 **Group Chat** 的成员口
- 每名成员须已连接 Chat Model；Round-robin 模式下轮流发言
- 至少需 **2** 名成员（**E1048**）

#### 群聊 Orchestrator（`group_orchestrator`）

- 接入 **Group Chat** 的 Orchestrator 口（**可选**）
- 在 orchestrator 发言模式下，由该 Agent 的 Chat Model 决定下一发言者；未接线时可在 Group Chat 节点填写 `orchestratorModel`（**E1049**）

> **注意**：经资源出口编入 Crew / 群聊时，任务文本通常由编排节点或经理分配，Agent 上的 **Prompt 类型 / User 模板** 在工人执行阶段可能被 Crew 任务描述覆盖；**角色 / 目标 / 背景** 对 Crew 场景尤为重要。

## 示例

### 示例 A

1. 添加 `manualTrigger` → `aiAgent`
2. 连接 `aiChatModel`（如 Ollama `llama3`）
3. 添加 `toolRead`，命名为 `read_file`，`ai_tool` 连到 Agent
4. **Prompt 类型** 选 `auto`，上游传入 `{ "question": "总结 README" }`
5. 在 **System** 中写明角色与回答格式

### 示例 B

1. 添加两名 `aiAgent`（**角色**「研究员」「撰稿人」），各接 `aiChatModel`
2. **Crew 工人** 口连到 `crewSequential`
3. `manualTrigger` → `crewSequential` → 下游

### 示例 C

```
aiChatModel ──→ aiAgent
aiMemory ──→ aiAgent
aiKnowledge ──→ aiAgent
aiOutputParser ──→ aiAgent
toolWebSearch ──ai_tool──→ aiAgent
```

Session ID 用 `{{ $json.sessionId }}`；Knowledge 填侧栏知识库 ID；Parser schema 约束 JSON 输出。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1012** | 未连接 Chat Model |
| **E1014** | 多个 Model 或 Memory 等无效卫星接线 |
| **E1030** | Crew Sequential 工人不足 2 名 |
| **E1031** | Crew Hierarchical 未接经理 Agent |
| **E1032** | Crew 工人不足 1 名 |
| **E1048** | Group Chat 成员不足 2 名 |
| **E1049** | Group Chat orchestrator 模式缺少模型或 Orchestrator Agent |
| **E3001** | AI 运行时未配置 |
| **E3010** | 运行时缺少 Chat Model |
| **E3012** | Tool 调用失败（HTTP、子工作流、文件系统等） |

更多 Agent 类错误见 [error-codes.md](../../../error-codes.md)。

## 参见

- [Skill Run 节点](/help/nodes/skillRun) — 基于 SKILL.md 的 Agent
- [Chat Model 节点](/help/nodes/aiChatModel) — 语言模型卫星配置
- [Memory 节点](/help/nodes/aiMemory) — 会话记忆卫星
- [Knowledge (RAG) 节点](/help/nodes/aiKnowledge) — 知识库检索卫星
- [Tool (Read) 节点](/help/nodes/toolRead) — 文件读取 Tool 卫星
