# Skill Run 节点

按 **SKILL.md** 驱动 ReAct 循环：加载 Skill 正文、拼接规则与 System Prompt，连接 **Chat Model** 卫星后执行。

## 参数

| 参数 | 说明 |
|------|------|
| **skillSource（来源）** | `path`：从工作区 `.rxwf/skills/` 按名称加载；`registry`：从平台注册中心按 ID 加载 |
| **workspaceRoot（工作区）** | `path` 时可编辑并写入节点 JSON；`registry` 时 UI 只读，读取 **设置 → RxWF** 中保存的工作区 |
| **skillPath / skillId** | `path` 模式下 skill 名称（如 `sample-skill`）；`registry` 模式下注册中心选择器 |
| **prompt** | 用户消息；**留空**则透传上游输入 JSON |
| **systemPrompt** | 追加在 skill 正文、工具意图与规则**之后** |
| **maxIterations**（设置） | 默认 20；Agent 可提前结束 |
| **timeoutMs**（设置） | 默认 **`-1`（无限制/无超时）**；正数表示毫秒超时 |

> **M-2 变更**：已移除 `skillInline`、`promptType`、`toolIntentMode`、`preferRemote`、`builtinToolsMode` 等旧字段；**不再隐式注入 Builtin 工具**，须在画布上 **显式连接** Tool 卫星。

## 卫星连接

```
manualTrigger → skillRun
aiChatModel ──ai_languageModel──→ skillRun
toolRead / toolWrite / toolGrep / toolShell / toolWebSearch ──ai_tool──→ skillRun
toolMcp / toolHttp / toolWorkflow / toolSkill / toolSubagent ──ai_tool──→ skillRun（按需）
rule / instruction ──ai_instruction──→ skillRun（可选）
```

- **Chat Model**（必填）：提供 LLM，参见 [Chat Model 节点](/help/nodes/aiChatModel)
- **Memory**（可选）：画布可接；当前 Skill Run 执行路径尚未注入记忆历史，参见 [Memory 节点](/help/nodes/aiMemory)
- **Knowledge**：无 `ai_knowledge` 资源口；需 RAG 时请用主数据流 `ragRetrieve` / `ragAnswer`，或改用 [AI Agent](/help/nodes/aiAgent) + [Knowledge (RAG)](/help/nodes/aiKnowledge)
- **Tool 卫星**（可选，M-2 须显式接线）：
  - `toolRead` — 读文件
  - **`toolWrite`** — 写文件（M-2 新增卫星）
  - **`toolGrep`** — 搜索文件内容（M-2 新增卫星）
  - `toolShell` — 执行命令
  - **`toolWebSearch`** — 网页搜索（M-2 新增卫星；须配置 Provider）
- **Instruction**（可选）：合并额外规则文本

## 示例

1. 在 **设置 → RxWF** 保存工作区并扫描 skills
2. 添加 `skillRun`（**skillSource** = `path`，Skill 选 `hello`）
3. 连接 `aiChatModel`、`toolRead`、**`toolWrite`**、**`toolGrep`**、**`toolWebSearch`**（按需）
4. Prompt 留空，上游 JSON 作为用户输入

## 相关错误码

见 [error-codes.md](../../../error-codes.md) 中 E1040、E1043、E1066 等。

## 参见

- [Chat Model 节点](/help/nodes/aiChatModel) — 模型 Provider 与连接方式
- [Memory 节点](/help/nodes/aiMemory) — 会话记忆（AI Agent 已支持；Skill Run 预留）
- [Knowledge (RAG) 节点](/help/nodes/aiKnowledge) — Agent 知识库卫星（Skill Run 请用 `ragRetrieve` / `ragAnswer`）
- [Tool (Read) 节点](/help/nodes/toolRead) — 常用 Tool 卫星
- [Tool (Write)](/help/nodes/toolWrite)、[Tool (Grep)](/help/nodes/toolGrep)、[Tool (Web Search)](/help/nodes/toolWebSearch) — M-2 子能力卫星
