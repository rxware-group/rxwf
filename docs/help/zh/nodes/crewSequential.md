# Crew (顺序) 节点

## 用途

**Crew Sequential** 按画布上工人 Agent 的 **空间顺序**（X/Y）依次执行：上一工人的 `answer` 作为下一工人的上下文，全部完成后汇总 **最终答案** 与 `crewSteps`。适合「研究员 → 撰稿人 → 审校」等固定流水线。

与 **Crew (层级)** / **Crew (Supervisor)** 的区别：顺序节点无经理委派，工人顺序由接线与画布位置决定，至少需 **2** 名工人。

## 端口与连接

### 主数据流

```
manualTrigger ──main──→ crewSequential ──main──→ 下游
```

### 资源连接

```
aiAgent ──crew_member──→ crewSequential（Crew 成员口，≥2 名）
```

| 入口 | 端口 ID | 说明 |
|------|---------|------|
| **Crew 成员** | `crew_member` | 每名工人为独立 `aiAgent`，须自备 **Chat Model** |
| **输入 / 输出** | `main` | 上游 JSON 作为 Crew **原始任务** |

接线方向：**从 AI Agent 底部 Crew 工人出口** 连到 **本节点顶部 Crew 成员入口**。

## 参数

| 参数 | 说明 |
|------|------|
| **执行后端**（`executionBackend`） | `native`（内置顺序 handoff）或 `crewai`（CrewAI Sidecar） |
| **CrewAI 编排模式** | 仅 `crewai` + sequential 时可见（`crew` / `flow`） |
| **Knowledge 注入模式**（`crewaiKnowledgeMode`） | 工人 [Knowledge](/help/nodes/aiKnowledge) 预检索：`inject` / `native` |
| **启用 CrewAI 评测** / **CrewAI 内置 Tool** | 仅 `crewai` 后端 |

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1030** | 已连接工人 **少于 2** 名 |
| **E1012** | 工人 Agent 未连接 Chat Model |
| **E1040** | `crewai` 后端但 CrewAI Runner 未配置 |
| **E2003** | 执行器未注册或缺工作流上下文 |
| **W1012** | 工人未填写 **角色**（role） |

## 示例

### 示例 A

1. 添加两名 `aiAgent`（**角色** 如「研究员」「撰稿人」），各接 `aiChatModel`
2. 两者 **Crew 工人** 口连到 `crewSequential`
3. `manualTrigger` → `crewSequential`，输入 `{ "topic": "季度报告" }`
4. 输出 `answer` 与按顺序排列的 `crewSteps`

### 示例 B

1. 在「研究员」上接 `toolRead` / `toolWebSearch` 等 **ai_tool** 卫星
2. 顺序执行时各工人仍使用自己的 Tool 与 System 提示
3. 详见 [AI Agent 节点](/help/nodes/aiAgent)

### 示例 C

仓库模板：`fixtures/templates/agent-crew-sequential.json`（native）、`agent-crew-sequential-crewai.json`（Sidecar）。导入后替换 Chat Model 与 Ollama 模型名即可调试。

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — 工人 Agent 与 **Crew 工人** 出口
- [Chat Model 节点](/help/nodes/aiChatModel) — 每名工人必填
- [Crew (层级) 节点](/help/nodes/crewHierarchical) — 经理委派模式
