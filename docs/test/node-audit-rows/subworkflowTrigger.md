# subworkflowTrigger 节点审查

> Task T-039 · row_id AUDIT-N-subworkflowTrigger · track plus

## 结论摘要

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| panel | ok | `SubworkflowTriggerFields.tsx`：入参模式（fields / jsonExample / acceptAll）、字段列表、JSON 示例 |
| validation | ok | `validateSubworkflowTriggerNode` / `validateSubworkflowTriggerLayout`（`subworkflow-trigger-schema.ts`） |
| executor | ok | `register-builtin.ts` 注册 `subworkflowTriggerExecutor`（`triggers/subworkflow.ts`） |
| error_codes | E1051,E1052,E1056,E1057,E1058 | 布局互斥 / exposeAsTool / 字段模式 / 重复名 / JSON 示例无效 |
| status | ok | 面板、校验、执行器、错误码审查通过；E2E spec 覆盖面板与 debug-node 透传 |
| e2e_spec | nodes/subworkflowTrigger.spec.ts | E2E-N-subworkflowTrigger |

## 执行器

- 路径：`packages/node-runner/src/executors/triggers/subworkflow.ts`
- 行为：透传父工作流 / debug-node 注入的 `inputItems`；无 input 时输出 `[{ json: {} }]`

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1051 | 与 manual / webhook / schedule 主触发器共存 |
| E1052 | `exposeAsTool` 工作流缺少或多余 subworkflowTrigger |
| E1056 | fields 模式未声明任何输入字段 |
| E1057 | 输入字段名重复 |
| E1058 | jsonExample 非 JSON 对象或字段名非法 |
| E2003 | executor registry 未注册（通用） |

## E2E

- Spec：`apps/web/e2e/nodes/subworkflowTrigger.spec.ts`
- 覆盖：面板「入参模式」可见；`debug-node` 透传 caller payload

## 备注

- 父流 `executeWorkflow` / `toolWorkflow` 调用链见 `executeWorkflow.spec.ts`
- 帮助文档 `docs/help/zh/nodes/subworkflowTrigger.md` 由 T-119 负责
