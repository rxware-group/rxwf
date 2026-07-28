# crewHierarchical — AUDIT-N-crewHierarchical

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供执行后端、最大委派轮次、允许并行委派；`NodeEditorParamsPane` 通用渲染（native 后端隐藏 crewai 专属字段） |
| validation | ok | `validate.ts`：`crew_manager` 缺失 → `E1031`；无工人 → `E1032`；工人缺 role → `W1012` 警告 |
| executor | ok | `createCrewHierarchicalExecutor`（`executors/crew-hierarchical.ts`）经 `registerPlusExecutors` 注册；`crew-hierarchical.test.ts` 覆盖委派/并行/E1031/E1032 |
| error_codes | E1031,E1032,E1033,E2003 | 无经理 → `E1031`；无工人 → `E1032`；经理 JSON 无效或无委派 → `E1033`；缺 workflow 上下文 → `E2003` |
| e2e_spec | nodes/crewHierarchical.spec.ts | `@any` 面板；`@plus @any` validate E1031/E1032 + 可选 Ollama debug-node |
| status | ok | 审查通过；native 层级委派与 delegate_parallel 单测覆盖 |

## 参数模型

- `executionBackend`：`native`（默认 LangGraph 委派循环）或 `crewai`（Sidecar 后端）。
- `maxDelegations`：经理委派轮次上限（1–20，默认 10）。
- `allowParallelDelegation`：是否允许经理输出 `delegate_parallel` JSON（默认 true）。
- crewai 专属字段（`crewaiFlowMode`、`enableEval` 等）仅在 `executionBackend=crewai` 时显示。

## 端口

- `crew_manager`（必选）：经理 `aiAgent` 资源输入。
- `crew_member`（≥1）：工人 `aiAgent` 资源输入。
- `main`：主数据输入/输出。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: crewHierarchical`。
- native 路径：经理每轮输出 JSON（`delegate` / `delegate_parallel` / `finish`），工人经 `runAiAgentNode` 执行。
- 成功输出：`{ answer, crewSteps, process: 'hierarchical' }`。
- 失败：`status: failed`，`errorCode` 为上表 E 码。

## E2E

- Spec：`apps/web/e2e/nodes/crewHierarchical.spec.ts`（E2E-N-crewHierarchical）
- 轨：plus
- 覆盖：agent 工作流面板字段（执行后端/最大委派轮次/Knowledge）；`/validate` E1031/E1032；Ollama 可达时 debug-node 冒烟（skipped 当不可达）

## 备注

- 帮助文档 `docs/help/zh/nodes/crewHierarchical.md` 由 M-6 T-142 负责。
- 端到端 live 经理委派依赖 Ollama/AI runtime，由单元测试 mock；E2E 仅验结构错误路径。
