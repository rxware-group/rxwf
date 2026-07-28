# toolSubagent — AUDIT-N-toolSubagent

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 toolDescription、systemPrompt、taskPromptTemplate、readonly 等；`NodeEditorParamsPane` 通用渲染 |
| validation | ok | `validateToolSubagentNodes`（`validate-skill.ts`）保存期 `E1049`：缺 `toolDescription` 或 `systemPrompt` |
| executor | satellite | `runSubagentTool`（`run-subagent-tool.ts`）经父 `aiAgent` ReAct 调用；`run-subagent-tool.test.ts` 覆盖 E2003/E1048/E1050/E3001 与嵌套 ReAct |
| error_codes | E1049,E1048,E1050,E2003,E3001 | `E1049` 保存期必填；`E1048` maxAgentDepth；`E1050` readonly + toolWorkflow；`E2003` hub 缺失或无独立 executor；`E3001` AI 未配置 |
| e2e_spec | nodes/toolSubagent.spec.ts | `@any` 面板 + validate E1049；`@plus` debug-node 父 aiAgent 接线 toolSubagent（Ollama 可达时冒烟） |
| status | ok | 审查通过；卫星执行路径与校验已单测/E2E 覆盖 |

## 参数模型

- `toolDescription`：父 Agent 可见的 Tool 描述（必填，保存期 E1049）。
- `systemPrompt`：子 Agent 系统提示（必填，保存期 E1049）。
- `taskPromptTemplate`：任务模板，支持 `{{ $fromAI.key }}` 占位。
- `readonly`：`true` 时禁止子 Tool 含 `toolWorkflow`（运行时 E1050）。
- `maxIterations` / `timeoutMs` / `provider` / `model`：子 ReAct 循环配置。
- `maxSubagentResultTokens`：子 Agent 回答截断上限（默认 4000 token 量级）。

## 执行语义

- 卫星节点：无独立 `registerPlusExecutors` 条目；父 `aiAgent` 经 `buildAgentToolDefinitions` 收集 `toolSubagent`，调用时 `runSubagentTool` 合成临时 `aiAgent` 并 `runAiAgentNode`。
- 子 Tool：经 `collectSubagentSatellites` 收集 `ai_tool → toolSubagent` 连线。
- 深度：`settings.maxAgentDepth`（默认 2）超限 → `E1048`。
- 成功：Tool 返回字符串 answer（可截断）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1049 | 保存期：缺 `toolDescription` 或 `systemPrompt` |
| E1048 | 运行时：`maxAgentDepth` 超限 |
| E1050 | 运行时：`readonly: true` 且子 Tool 含 `toolWorkflow` |
| E2003 | 运行时：hub 节点不存在；或 registry 直接 execute `toolSubagent` |
| E3001 | AI runtime 未配置或子 ReAct 失败 |

## E2E

- Spec：`apps/web/e2e/nodes/toolSubagent.spec.ts`（E2E-N-toolSubagent）
- 轨：plus（`@plus|@any`）
- 覆盖：面板字段；validate E1049；Ollama 可达时父 Agent + toolSubagent 接线 debug-node 冒烟

## 备注

- 与 `toolSkill` 同为 Agent Tool 卫星；`toolSubagent` 可再接子 Tool 卫星（二级 Tool 枢纽）。
- 帮助文档 `docs/help/zh/nodes/toolSubagent.md` 由 M-6 T-154 负责。
