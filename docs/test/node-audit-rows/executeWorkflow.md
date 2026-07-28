# Node Audit: executeWorkflow

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-executeWorkflow |
| node_type | executeWorkflow |
| category | action |
| track | standard |
| panel | ok |
| validation | ok |
| executor | ok |
| error_codes | E2003, E2008, E1003, E1053, E1054, W1015 |
| status | ok |
| e2e_spec | nodes/executeWorkflow.spec.ts |

## 审查结论

### 面板 (panel)

- `node-param-schemas.ts` 定义 `workflowId`（子工作流 ID，text）
- `NodeEditorParamsPane` 渲染 `workflowId` 字段；填写后展示 `SubworkflowInputMappingFields`（`inputMapping` 表达式映射）
- `node-port-defs.ts` 默认 `{ workflowId: '', inputMapping: {} }`
- E2E 验证节点编辑器展示「子工作流 ID」字段

### 校验 (validation)

- 保存/发布：`validateWorkflowDefinition` 在 `subworkflowDepth >= 5` 且含 `executeWorkflow` 节点时 → **E1003**
- 发布校验：`workflowService.validateToolWorkflowNodes` 对 `executeWorkflow` 检查目标已发布 → **E1053**；目标无 `subworkflowTrigger` → **W1015**（警告）
- 执行前：`createSubworkflowExecutor` 缺 `workflowId` / `parentExecutionId` → **E2003**

### 执行器 (executor)

- `createSubworkflowExecutor`（`subworkflow.ts`）经 `registerBuiltinExecutors` 在提供 `subworkflow` 依赖时注册（`runChild` + `loadPublishedWorkflowDefinition`）
- 运行时由 `create-execution-runtime.ts` 注入子工作流 enqueue/run 管道
- 单元测试：`packages/node-runner/src/executors/subworkflow.test.ts`（registry、深度、必填输入、子流输出）

### 错误码 (error_codes)

| 码 | 场景 | 文档 |
| --- | --- | --- |
| E2003 | 缺 `workflowId`/`parentExecutionId` 或子流执行失败 | `docs/error-codes.md` |
| E2008 | 子工作流嵌套超过 5 层 | `docs/error-codes.md` |
| E1003 | 保存时嵌套深度已达上限 | `docs/error-codes.md` |
| E1053 | 目标子工作流未发布 | `workflow-service.ts` |
| E1054 | 子流必填输入字段缺失 | `build-subworkflow-payload.ts` |
| W1015 | 目标无 `subworkflowTrigger`（警告） | `workflow-service.ts` |

## 测试证据

- `packages/node-runner/src/executors/subworkflow.test.ts` — registry、执行、校验
- `apps/web/e2e/nodes/executeWorkflow.spec.ts` — 面板 workflowId、debug-node 子流调用

## 备注

- 无独立 `node-params/executeWorkflow.tsx`；`SubworkflowInputMappingFields` 已覆盖映射 UI
- 子工作流平台链路见 `apps/api/src/execution/subworkflow-pipeline.integration.test.ts`（非本 task 所有权）
