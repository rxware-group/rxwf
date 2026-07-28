# crewSequential — AUDIT-N-crewSequential

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 executionBackend / crewaiKnowledgeMode 等；`NodeEditorParamsPane` 按 backend 条件隐藏 crewai 专属字段；无独立 `crewSequential.tsx` |
| validation | ok | `validate.ts`：`E1030`（<2 名 crew_member）；crewai 后端 `E1040`（Runner 未配置）、`W1012`/`W1013`/`W1014` 警告 |
| executor | ok | `createCrewSequentialExecutor`（`crew-sequential.ts`）经 `registerPlusExecutors` 注册；`crew-sequential.test.ts` 覆盖 registry/E1030/顺序 handoff |
| error_codes | E1030,E1040,E2003 | `E1030`：运行时成员不足；`E1040`：crewai 后端无 Runner；`E2003`：未注册或缺 workflow 上下文 |
| e2e_spec | nodes/crewSequential.spec.ts | `@any` 面板；`@plus` debug-node E1030 + Ollama 可达时 native 顺序执行 |
| status | ok | 审查通过；Plus 执行器与校验已就绪 |

## 参数模型

- `executionBackend`：`native`（LangGraph 顺序 handoff）或 `crewai`（Sidecar）。
- `crewaiFlowMode` / `flowRouter`：仅 `crewai` 后端且 sequential 时可见；Flow 模式 P4-D3 主要支持本节点。
- `crewaiKnowledgeMode`：Knowledge 注入模式（`inject` / `native`）。
- `enableEval` / `enableBuiltinTools`：CrewAI 后端专属。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: crewSequential`；thin wrapper 调用 `executeCrewNode(..., 'crewSequential')`。
- Native：按画布 X/Y 顺序依次 `runAiAgentNode`，上一成员 `answer` 作为下一成员上下文。
- 成功输出：`{ answer, crewSteps[] }` 单 item。
- 失败：`status: failed`，`errorCode` 为 `E1030` 等。

## 端口

- `main`：主流程入口/出口。
- `crew_member`：≥2 个 `aiAgent` 工人（各需 `ai_languageModel`；`ai_tool` 可选）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1030 | 已连接 crew_member 工人 < 2（保存校验 + 运行时） |
| E1040 | `executionBackend: crewai` 且 `CREWAI_RUNNER_URL` 未配置 |
| E2003 | 执行器未注册，或缺 `workflowDefinition` 上下文 |
| W1012 | 工人未配置 `role` |
| W1013 | crewai 后端且成员无 Tool 且无内置 Tool |
| W1014 | 非 sequential 节点使用 `crewaiFlowMode: flow` |

## E2E

- Spec：`apps/web/e2e/nodes/crewSequential.spec.ts`（E2E-N-crewSequential）
- 轨：plus（compose 含 CrewAI Runner URL；native 冒烟依赖可选本机 Ollama）
- 覆盖：面板「执行后端」/「Knowledge 注入模式」；单成员 `E1030`；双成员 native 顺序执行（Ollama 可达时）

## 备注

- 帮助文档 `docs/help/zh/nodes/crewSequential.md` 由 M-6 T-141 负责。
- 模板：`fixtures/templates/agent-crew-sequential.json`、`agent-crew-sequential-crewai.json`。
