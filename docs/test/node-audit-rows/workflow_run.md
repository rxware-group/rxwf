# workflow_run — AUDIT-N-workflow_run

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 定义 `workflowSource`/`workflowRelPath`/`workflowId`/`workspaceRoot`/`expandTemplate`；`NodeEditorParamsPane` 专用 `WorkflowRunFields`（模板下拉、编译导入、已发布 ID） |
| validation | ok | `validateWorkflowRunNodes`：template 缺 `workflowRelPath` 或 published 缺 `workflowId` → **E1076**；非法 `workflowSource` → **E1076** |
| executor | ok | `createWorkflowRunExecutor`（`workflow-run.ts`）经 `registerSkillExecutors` → `registerPlusExecutors` 注册；`workflow-run.test.ts` 覆盖 registry/E1075/E1076/编译子图 |
| error_codes | E1075,E1076,E2003 | **E1076** 参数不完整；**E1075** manifest 禁用 workflows；**E2003** registry 未注册或 published 缺子流运行时；模板文件缺失运行时抛 **E1073**（话术与 Web Search 码表冲突，见备注） |
| e2e_spec | nodes/workflow_run.spec.ts | `@any` 面板 + debug-node E1076 与模板执行（plus 矩阵轨；本地 lite dev 可验） |
| status | ok | 审查通过；执行器与校验已就绪，补充单测与 E2E |

## 参数模型

- `workflowSource`：`template`（默认）或 `published`。
- `workflowRelPath`：`.rxwf/workflows/` 下模板相对路径（可省略 `.workflow.yaml` 后缀）。
- `workflowId`：`published` 源时必填，经 `runSubworkflow` 执行已发布子流。
- `workspaceRoot`：RxWF 工作区根；留空则运行时 `process.cwd()`。
- `expandTemplate`：编辑器侧是否展开模板（`true`/`false`）。

## 执行语义

- **template**：读取 YAML → `WorkflowCompiler`（`linear_skillRun`）→ `runCompiledWorkflow` 子执行；无 `runCompiledWorkflow` 时仅物化 definition（`compiled: true`）。
- **published**：`deps.runSubworkflow` 调用已发布工作流，输出含 `childExecutionId`。
- 成功输出 item：`{ items, childExecutionId, templateId?, pendingHitlLoop? }` 或编译预览字段。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1076 | 缺 `workflowRelPath`（template）或 `workflowId`（published）；保存期 `validateWorkflowRunNodes` 同步校验 |
| E1075 | `rxwf.project.json` 中 `workflows.enabled` 为 false |
| E2003 | 执行器未注册；或 published 源缺 `runSubworkflow`/`parentExecutionId` |
| E1073 | 模板文件不存在（运行时 `workflow-run.ts`；`error-codes.md` 表内另赋 Web Search 语义，待 T-080 统一） |

## E2E

- Spec：`apps/web/e2e/nodes/workflow_run.spec.ts`（E2E-N-workflow_run）
- 轨：plus（矩阵）；`@any` 用例在 lite dev 服务器验证执行路径
- 覆盖：面板「工作流来源」等字段；`debug-node` 缺模板文件 → `E1073`；临时工作区 + `mini` 模板 → success（`templateId` 或 `childExecutionId`）；`E1076` 由单测与保存校验覆盖

## 备注

- 无独立 `node-params/workflow_run.tsx`；`WorkflowRunFields.tsx` 承担专用 UI（所有权外，本 task 仅审查）。
- 平台级 enqueue 链路见 `apps/api/src/integration/workflow-run-pipeline.integration.test.ts`（非本 task 所有权）。
- 帮助文档 `docs/help/zh/nodes/workflow_run.md` 由 M-6 T-140 负责。
