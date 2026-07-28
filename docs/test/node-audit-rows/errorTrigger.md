# errorTrigger 节点审查

> Task T-038 · row_id AUDIT-N-errorTrigger · track standard

## 结论摘要

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `_debugSamplePayload` JSON 字段（标签「调试样例载荷 (JSON)」）；`node-port-defs.ts` 含默认样例载荷 |
| validation | ok | 保存前 JSON 字段由 `editor-json-params.ts` 校验语法；无额外 type 级保存错误码 |
| executor | ok | `register-builtin.ts` 注册 `errorTriggerExecutor`（`triggers/error.ts`） |
| error_codes | E2002 | 执行上下文缺少 `errorPayload` 时抛出 `E2002` |
| status | ok | 面板、校验、执行器、错误码审查通过；E2E spec 覆盖执行与面板 |

## 执行器

- 路径：`packages/node-runner/src/executors/triggers/error.ts`
- 行为：将 `errorPayload`（Error Workflow 标准载荷）映射为初始 output items
- 调试：`run-debug-execution` / `execution-engine` 经 `resolveErrorPayloadFromNodeConfig` 从 `_debugSamplePayload` 或默认样例注入

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2002 | 直接调用 executor 且未提供 `errorPayload` |

## E2E

- Spec：`apps/web/e2e/nodes/errorTrigger.spec.ts`
- 覆盖：面板字段可见；`debug-node` 执行输出含样例载荷字段

## 备注

- Error Workflow 生产触发链见 E2E-P-005（M-3 平台能力，非本 task 范围）
- 帮助文档 `docs/help/zh/nodes/errorTrigger.md` 由 T-118 负责
