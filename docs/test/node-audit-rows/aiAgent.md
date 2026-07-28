# aiAgent — AUDIT-N-aiAgent

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 Prompt/System/Crew 字段；`NodeEditorParamsPane` 在 agent 工作流下分 params/crew/settings 标签渲染 |
| validation | ok | `validateWorkflowDefinition`：`E1012`（缺 Chat Model）、`E1014`（多 Chat Model / Memory / Knowledge）；Tool 0~n 可选 |
| executor | ok | `createAiAgentExecutor`（`ai-agent.ts` → `runAiAgentNode`）经 `registerPlusExecutors` 注册；`run-ai-agent-node.test.ts` + `ai-agent.test.ts` 覆盖 |
| error_codes | E1012,E1014,E2003,E3001,E3010,E3012,E3013 | 保存期 `E1012`/`E1014`；无 definition `E2003`；AI runtime 未配置 `E3001`；运行时无 Chat Model `E3010`；工具/MCP 失败 `E3012`；空 prompt / 结构化输出失败 `E3013` |
| e2e_spec | nodes/aiAgent.spec.ts | `@any` 面板（Prompt + Crew 标签）；`@plus` debug-node `E3010`；Ollama 可达时 agent 冒烟 |
| status | ok | M-3 审查通过；ReAct agent + 卫星工具链路由 `runAiAgentNode` |

## 参数模型

- `prompt` / `systemPrompt`：用户消息与系统提示；支持 `{{ }}` 表达式。
- `maxIterations` / `timeoutMs` / `sessionId`：ReAct 循环、超时与 Memory 会话（settings 标签）。
- `role` / `goal` / `backstory` / `taskDescription` / `expectedOutput`：Crew 编排元数据（agent 工作流 + Crew 标签）。

## 卫星连接

- `ai_languageModel`（必填，且仅一个）：Chat Model。
- `ai_memory` / `ai_knowledge` / `ai_outputParser` / `ai_tool`（可选）：Memory、Knowledge、Output Parser、Tool 卫星。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: aiAgent`。
- 核心逻辑：`runAiAgentNode` 收集卫星 → `deps.ai.runAgent` ReAct 循环 → 可选 Memory 持久化 / RAG 注入 / 结构化输出解析。
- 成功输出：`{ answer, parsed?, agentSteps }` 单分支多 item（按输入 item 数）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1012 | 保存期：未连接 Chat Model |
| E1014 | 保存期：多个 Chat Model / Memory / Knowledge |
| E2003 | 执行上下文无 workflow definition 或 registry 未注册 |
| E3001 | AI runtime 未配置 |
| E3010 | 运行时无连接的 Chat Model |
| E3012 | MCP/HTTP/子工作流等工具运行时未配置或调用失败 |
| E3013 | Prompt 解析为空或结构化输出解析失败 |

## E2E

- Spec：`apps/web/e2e/nodes/aiAgent.spec.ts`（E2E-N-aiAgent）
- 轨：plus（compose plus profile）；lite 仅 `@any` 面板
- 覆盖：面板 Prompt/Crew 字段；无 Chat Model debug-node → `E3010`；Ollama 可达时 agent 成功

## 备注

- 帮助文档 `docs/help/zh/nodes/aiAgent.md` 由 M-6 T-136 负责。
- 集成参考：`apps/api/src/integration/p4b-agent.integration.test.ts`（mock AI 全链路）。
