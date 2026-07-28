# Skill Tool 卫星

## 用途

**toolSkill** 将工作区 **Skill 包**（`.rxwf/skills/<name>/SKILL.md`）注册为 Agent 可调用的 Tool。LLM 传入 `task` / `prompt` 等参数后，运行时加载 Skill 并执行 `executeSkill`，返回文本答案。与 **Skill Run** 主节点共用 Skill 加载器，但由 **父 Agent 的 Tool 调用** 触发，而非主数据流单次执行。

## 端口与连接

```
toolSkill ──ai_tool──→ aiAgent 或 skillRun
aiChatModel ──ai_languageModel──→ 父 Agent
```

须在 **设置 → RxWF** 配置工作区并扫描 skills。

## 参数

| 参数 | 说明 |
|------|------|
| **Tool 描述**（`toolDescription`） | **必填** |
| **Skill 名称**（`skillPath`） | 相对 `.rxwf/skills` 的名称，如 `hello` |
| **模式**（`mode`） | `sub-agent`（多轮 ReAct，默认）或 `single-shot`（`maxIterations: 1`） |

`runSkillTool` 从父 Agent 解析的 **workspaceRoot** 加载 Skill 目录，调用与 [Skill Run](/help/nodes/skillRun) 相同的 `executeSkill` 路径。LLM 参数中的 `task` 或 `prompt` 作为 user 消息；若均未提供则 JSON 序列化全部 args。

未连接父 Agent 时保存可能出现 **W1010** 孤立卫星警告。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E2003** | 缺 Tool 描述；或对 toolSkill 直接 debug-node |
| **E1040** | 运行时 `skillPath` 为空 |
| **E3001** | AI 运行时未配置 |
| **E1066** | Skill 路径落在禁止前缀（如 `.cursor/skills`） |
| **W1010** | 未连接到 Agent / skillRun |

## 示例

### 示例 A

1. 工作区存在 `.rxwf/skills/hello/SKILL.md`
2. 添加 `toolSkill`：**Skill 名称** = `hello`，**模式** = `sub-agent`
3. Tool 描述：「调用 hello skill 完成问候类任务」
4. 连到 `aiAgent`；主 Prompt 让 Agent 在需要时调用该 Tool

### 示例 B

- **模式** 选 `single-shot`，适合一次性短任务、降低 token 消耗
- LLM 参数仍通过 `task` 字段传入

### 示例 C

```
manualTrigger → skillRun
aiChatModel ──→ skillRun
toolSkill（另一 Skill）──ai_tool──→ skillRun
```

主 Skill Run 执行主 SKILL.md，Tool 卫星可动态调用其他 Skill 包。

## 参见

- [Skill Run 节点](/help/nodes/skillRun) — 主流程 Skill 驱动 Agent
- [Subagent Tool 卫星](/help/nodes/toolSubagent) — 自定义子 Agent 而非 Skill 包
- [Read Tool 卫星](/help/nodes/toolRead) — 文件读取 Tool
