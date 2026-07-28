# toolWorkflow — AUDIT-N-toolWorkflow

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `ToolWorkflowSelect` + `SubworkflowInputMappingFields`；`node-params/toolWorkflow.tsx` 提供完整面板（含 Tool 描述）；编辑器仍用内联分支 |
| validation | ok | `validateToolWorkflowNodes`（E1001/E1022–E1024/E1055）；`validateToolWorkflowTarget`；W1016/W1017 映射警告 |
| executor | satellite | 无独立 registry 条目；经 `runAiAgentNode` → `runToolWorkflow`（`run-subagent-tool.ts`）调用 `runSubworkflow` |
| error_codes | E1001,E1022,E1023,E1024,E1054,E1055,E3012 | 保存期目标校验 + 运行时 payload/子流执行 |
| e2e_spec | nodes/toolWorkflow.spec.ts | `@any` 面板；`@plus` validate 缺 workflowId / 已发布 exposeAsTool 子流 |
| status | ok | 审查通过；卫星执行路径单测 + E2E 证据 |

## 参数模型

- `workflowId`：已发布且 `exposeAsTool` 的子工作流 ID（面板下拉，排除当前工作流）。
- `toolDescription`：Agent 可见的工具描述（必填，否则 `buildAgentToolDefinitions` 抛 E2003）。
- `inputMapping`：可选 JSON 映射；留空时沿用子流 `subworkflowTrigger` schema 字段名。

## 执行语义

- 卫星节点：连到 `aiAgent` 的 `ai_tool` 口；由 Agent 运行时通过 `source.type === 'workflow'` 调用。
- `runToolWorkflow` 构建 payload → `runSubworkflow({ requireExposeAsTool: true })` → 返回子流 `outputItems`。
- 嵌套深度：`subworkflowDepth + 1`；只读 `toolSubagent` 禁止挂载 `toolWorkflow`（E1050）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1001 | 保存期缺少 `workflowId` |
| E1022 | 目标工作流不存在 |
| E1023 | 目标未发布 |
| E1024 | 目标未开启 exposeAsTool |
| E1054 | 运行时必填子流入参缺失 |
| E1055 | 目标缺少 subworkflowTrigger |
| E3012 | `runSubworkflow` / 父 executionId 未配置 |
| E2003 | 误将 toolWorkflow 当作独立 executor 调用 |

## E2E

- Spec：`apps/web/e2e/nodes/toolWorkflow.spec.ts`（E2E-N-toolWorkflow）
- 轨：plus（`@plus|@any`）
- 覆盖：面板子工作流选择与 Tool 描述；validate 缺 workflowId；已发布 exposeAsTool 子流校验通过

## 备注

- 与 `executeWorkflow` 共用 `buildSubworkflowPayload` / 子流 schema 解析；区别为 Agent Tool 路径强制 `requireExposeAsTool`。
- 帮助文档 `docs/help/zh/nodes/toolWorkflow.md` 由 T-152 负责。
