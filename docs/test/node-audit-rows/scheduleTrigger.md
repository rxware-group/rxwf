# scheduleTrigger 节点审查

> Task T-037 · row_id AUDIT-N-scheduleTrigger · track standard

## 结论摘要

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `cron` 文本字段（标签「Cron」）；`node-port-defs.ts` 默认 `0 * * * *` |
| validation | ok | 保存无 type 级硬错误码；空/无效 cron 由调度器 `list-due-schedules` 静默跳过（`isCronDue` 返回 false） |
| executor | ok | `register-builtin.ts` 注册 `scheduleTriggerExecutor`（`triggers/schedule.ts`） |
| error_codes | — | 成功路径无专用 E 码；未注册 type 走通用 `E2003` |
| status | ok | 面板、校验、执行器审查通过；E2E spec 覆盖面板与 debug-node 执行 |

## 执行器

- 路径：`packages/node-runner/src/executors/triggers/schedule.ts`
- 行为：无上游 input 时输出 `{ cron }`（便于下游/调试可见）；有 input 时透传
- 调度：`packages/execution/src/scheduler/list-due-schedules.ts` 扫描 `scheduleTrigger.parameters.cron`，配合工作流 `settings.timezone`

## 错误码

| 代码 | 场景 |
| --- | --- |
| — | 触发器执行成功不抛错 |
| E2003 | executor registry 未注册 `scheduleTrigger`（通用） |

## E2E

- Spec：`apps/web/e2e/nodes/scheduleTrigger.spec.ts`
- 覆盖：面板 Cron 字段可见且默认值正确；`debug-node` 执行输出含 `cron`

## 备注

- 定时生产触发链（scheduler tick → job enqueue）见 `apps/api` 集成测试，非本 task E2E 范围
- 帮助文档 `docs/help/zh/nodes/scheduleTrigger.md` 由后续文档 task 负责
