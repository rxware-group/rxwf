# Subagent Tool 卫星

## 用途

**toolSubagent** 将 **嵌套 ReAct 子 Agent** 注册为父 Agent 的 Tool。调用时运行时合成临时 `aiAgent` 配置（独立 system/task prompt、迭代上限），并可挂载 **子 Tool 卫星**（read/write/grep 等）。适合「主 Agent 委派专长子任务」而不暴露全部工具给主循环。

与 **toolSkill** 的区别：子 Agent 由节点参数定义 prompt，不加载 SKILL.md；可再接 **ai_tool → toolSubagent** 形成二级 Tool 枢纽。

## 端口与连接

```
toolSubagent ──ai_tool──→ aiAgent（父）
toolRead / toolGrep / … ──ai_tool──→ toolSubagent（子 Tool，可选）
aiChatModel ──ai_languageModel──→ 父 aiAgent
```

| 端口 | 说明 |
|------|------|
| **Subagent** 出口 | 连父 Agent **Tool** 口 |
| **子 Tool** 入口 | 接收子级 tool 卫星 |

## 参数

| 参数 | 说明 |
|------|------|
| **Tool 描述**（`toolDescription`） | **必填**（保存期 **E1049** 若缺） |
| **System**（`systemPrompt`） | 子 Agent 系统提示，**必填** |
| **Task 模板**（`taskPromptTemplate`） | 支持 `{{ $fromAI("task", "…") }}` |
| **只读**（`readonly`） | `true` 时子 Tool 不可含 toolWorkflow（**E1050**） |
| **最大迭代**（`maxIterations`） | 子 ReAct 上限，默认 10 |
| **Provider / Model** | 可选；覆盖子 Agent 默认模型 |

调用时 `runSubagentTool` 合成临时 Agent 并 `runAiAgentNode`；子 Tool 经 **toolSubagent** 顶部 **子 Tool** 口收集。工作流 **设置 → maxAgentDepth**（默认 2）限制嵌套层数。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1049** | 保存期缺 Tool 描述或 System |
| **E1048** | 超过 `maxAgentDepth` 嵌套深度 |
| **E1050** | `readonly: true` 且子 Tool 含 toolWorkflow |
| **E2003** | 对 toolSubagent 直接 debug-node |
| **E3001** | AI 运行时未配置 |

## 示例

### 示例 A

| 参数 | 值 |
|------|-----|
| Tool 描述 | 委派代码审查子任务 |
| System | 你是严格代码审查员，只输出 findings 列表 |
| Task 模板 | `{{ $fromAI("task", "Code or file to review") }}` |

父 `aiAgent` 接 Chat Model + 本子 Agent；可选 `toolRead` 连到 **toolSubagent** 子 Tool 口。

### 示例 B

- **readonly** = `true`
- 子 Tool 仅 `toolRead` + `toolGrep`，禁止 `toolWorkflow` / `toolWrite`

### 示例 C

- 工作流 **设置** 中 `maxAgentDepth` 默认 2
- 主 Agent → toolSubagent → 子 Agent 再调 Tool 计一层；超限 **E1048**

## 参见

- [AI Agent 节点](/help/nodes/aiAgent)
- [Skill Tool 卫星](/help/nodes/toolSkill)
- [Workflow Tool 卫星](/help/nodes/toolWorkflow)
