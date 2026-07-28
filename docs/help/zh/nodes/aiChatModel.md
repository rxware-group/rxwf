# Chat Model 节点

## 用途

**语言模型卫星**：为 Agent 类父节点提供 LLM 推理能力（Ollama 或 OpenAI 兼容 API）。本节点**不参与主数据流**（无 `main` 输入/输出），须通过资源端口 **Model**（`ai_languageModel`）接到父节点的 **Chat Model** 入口。

## 适用父节点

| 父节点 | 是否必填 | 说明 |
|--------|----------|------|
| **AI Agent** | 必填 | Tools Agent / ReAct 的主模型 |
| **Skill Run** | 必填 | 按 SKILL.md 驱动的 Agent 主模型 |
| **Crew 工人 Agent** | 必填 | 每名 `aiAgent` 工人须自备 Chat Model |
| **Crew 经理 Agent** | 可选 | 接入 Crew 经理口时，其 Chat Model 可替代 Crew 节点内监督模型 |
| **Group Chat 成员** | 必填 | 群聊中每名成员 Agent 须连接模型 |
| **Group Chat Orchestrator** | 可选 | orchestrator 模式下可由该 Agent 的模型决定下一发言者 |

> 每个父节点**至多连接一个** Chat Model；重复接线校验报错 **E1014**。

## 参数

| 参数 | 说明 |
|------|------|
| **Provider** | `ollama`（本地 Ollama）或 `openai-compatible`（OpenAI / Azure / 各类兼容网关） |
| **Model** | 模型名称，如 `llama3`、`qwen3:8b`、`gpt-4o-mini` |
| **Base URL** | 可选；覆盖默认端点（见下方 Provider 说明） |
| **Credential** | 仅 **openai-compatible** 时在属性面板显示；选择 API Key 或 OAuth 凭证 |

### 默认值

新建节点默认：`provider: ollama`，`model: llama3`。未填写 **Base URL** 时，Ollama 使用 `http://127.0.0.1:11434`（或 API 进程配置的 `ollama.baseUrl`）。

### Provider：Ollama

- 无需凭证；须确保 Ollama 服务已启动且已 `pull` 对应模型
- **Base URL** 留空时使用本机默认地址；远程 Ollama 填完整 URL（如 `http://192.168.1.10:11434`）

### Provider：OpenAI 兼容

- 须在 **Credential** 中选择含 `apiKey`（或 OAuth `accessToken`）的凭证，或依赖 API 进程环境变量 `OPENAI_API_KEY`
- **Base URL** 用于非官方 OpenAI 端点（如 Azure OpenAI、本地 vLLM、LiteLLM 代理）；留空则走 OpenAI 默认地址
- **Model** 填该端点支持的 deployment / model id

## 端口与连接

```
aiChatModel ──ai_languageModel──→ aiAgent
aiChatModel ──ai_languageModel──→ skillRun
```

接线方向：**从 Chat Model 节点的 Model 出口** 连到 **父 Agent 节点的 Chat Model 入口**（箭头由卫星指向父节点）。

同一 Chat Model 节点**不能**同时作为多个父节点的共享模型（每个父节点应使用独立卫星，或复制节点）。校验按「每个父节点恰好一条 `ai_languageModel` 连线」判断。

## 运行时行为

- 运行时通过 LangChain 创建 `ChatOllama` 或 `ChatOpenAI` 实例，参数来自本节点 `provider` / `model` / `baseUrl` / `credentialId`
- Agent 每次 LLM 往返会在调试时间线中记录 **satellite_invoke_*** 事件，并标注对应 Chat Model 节点名称
- 无 Tool 时父 Agent 走纯对话分支；有 Tool 时在同一模型上执行 ReAct 循环
- 不支持的 **Provider** 值会触发 **E3001**

## 示例

### 示例 A

1. `ollama pull llama3`
2. `aiChatModel`：**Provider** `ollama`，**Model** `llama3`
3. **Model** 口 → `aiAgent` **Chat Model** 口
4. `manualTrigger` → `aiAgent`

### 示例 B

| 参数 | 值 |
|------|-----|
| Provider | openai-compatible |
| Model | gpt-4o-mini |
| Credential | 选择 API Key 凭证 |
| Base URL | （可选）Azure / LiteLLM 网关 |

连到 `skillRun`；按需加 `toolRead` 卫星。

### 示例 C

为「研究员」「撰稿人」各建 `aiChatModel`（可不同 Provider），分别连对应 `aiAgent`，再 **Crew 工人** → `crewSequential`。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1012** | 父 **AI Agent** 未连接 Chat Model |
| **E1014** | 同一父节点连接了多个 Chat Model（或其他卫星重复） |
| **E1043** | **Skill Run** 缺少 Chat Model 卫星 |
| **E3001** | 无法连接模型端点或不支持的 Provider |
| **E3002** | OpenAI 兼容凭证无效或过期 |
| **E3010** | 运行时父 Agent 缺少已连接的 Chat Model |

更多 AI 类错误见 [error-codes.md](../../../error-codes.md)。

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — 连接 Chat Model 与 Tool 的通用 Agent
- [Memory 节点](/help/nodes/aiMemory) — 可选会话记忆卫星
- [Skill Run 节点](/help/nodes/skillRun) — 基于 SKILL.md 的 Agent
- [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) — 工人须自备 Chat Model
