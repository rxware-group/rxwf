# crewSupervisor — AUDIT-N-crewSupervisor

> M-3 节点审查单行记录（agent / plus）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供执行后端、maxSteps、allowParallel、supervisorProvider/Model 等；`NodeEditorParamsPane` 条件渲染 `CredentialSelect`（openai-compatible）；通用 schema 渲染 |
| validation | ok | `validate.ts`：无工人 → `E1032`；无 `supervisorModel` 且无 `crew_manager` Chat Model → `E1035`；`validate.test.ts` 覆盖 |
| executor | ok | `createCrewSupervisorExecutor`（`crew-supervisor.ts`）经 `registerPlusExecutors` 注册；`crew-supervisor.test.ts` 覆盖 registry、监督循环、E1032/E1035 |
| error_codes | E1032,E1033,E1035,E2003 | 无工人 `E1032`；监督 JSON 无效/无步骤 `E1033`；缺监督模型 `E1035`；registry/上下文缺失 `E2003` |
| e2e_spec | nodes/crewSupervisor.spec.ts | `@any` 面板；`@plus` validate E1032/E1035 + Ollama 可达时 debug-node 冒烟 |
| status | ok | 审查通过；native 监督循环与 crewai 后端路由已就绪 |

## 参数模型

- `executionBackend`：`native`（内置监督循环）或 `crewai`（映射 hierarchical process）。
- `maxSteps`：监督循环上限（1–30，默认 15）。
- `allowParallel`：是否接受 `run_parallel` 决策。
- `supervisorProvider` / `supervisorModel` / `supervisorBaseUrl` / `supervisorCredentialId`：监督 LLM；也可通过 `crew_manager` 口连接带 Chat Model 的 `aiAgent`。
- 共用 Crew 参数：`crewaiFlowMode`、`knowledgeMode`、`enableEval`、`enableBuiltinTools`（crewai 后端时可见）。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: crewSupervisor` → `executeCrewNode` → `runCrewSupervisorNative`。
- 监督者每步调用 LLM 产出 JSON 决策（`run` / `run_parallel` / `finish`），委派 `crew_member` 工人执行。
- 成功输出：`{ answer, crewSteps, supervisorSteps, process: 'supervisor' }`。
- 失败：`status: failed` + `errorCode`（E1032/E1033/E1035 等）。

## 端口

- 输入：`main`、`crew_member`（工人）、`crew_manager`（可选监督模型来源）。
- 输出：`main`。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1032 | 无 `crew_member` 工人 |
| E1033 | 监督返回无效 JSON 或循环结束无工人步骤 |
| E1035 | 缺 `supervisorModel` 且无 `crew_manager` Chat Model |
| E2003 | 执行器未注册或缺少 workflow definition 上下文 |

## E2E

- Spec：`apps/web/e2e/nodes/crewSupervisor.spec.ts`（E2E-N-crewSupervisor）
- 轨：plus（`@plus` debug-node）；面板 `@any` 可在 lite 轨验收
- 覆盖：面板监督参数字段；validate 无工人 → E1032；缺监督模型 → E1035；Ollama 可达时 debug-node 成功

## 关联文档

- 帮助：`docs/help/zh/nodes/crewSupervisor.md`（T-143）
- 模板：`fixtures/templates/agent-crew-supervisor.json`
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-crewSupervisor（plus）

## 备注

- 未新增独立 `crewSupervisor.tsx`（通用 `NodeEditorParamsPane` + schema 已覆盖）。
- 完整监督委派冒烟依赖 Ollama/AI runtime；E2E 以确定性失败路径为主，集成测试见 `p4c-crew.integration.test.ts`。
