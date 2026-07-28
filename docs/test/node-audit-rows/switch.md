# switch — AUDIT-N-switch

> M-3 节点审查单行记录（logic / lite）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `SwitchBranchesPanel`：动态 `branches[]`、条件 `{{ }}` 模板字段、添加/删除分支；`SwitchBranchesPanel.test.tsx` |
| validation | ok | `validateSwitchNodes`：至少 1 分支、条件非空且须为 `{{ }}` 表达式、出边 `fromOutput` 须匹配分支 `id`；`validate-switch.test.ts` |
| executor | ok | `switchExecutor` 经 `registerBuiltinExecutors` 注册；首匹配路由、无匹配丢弃 item、`branches` 为空返回 `failed` |
| error_codes | E2003 | 空 `branches`、无效出边端口、表达式求值失败（与 IF 一致，经执行层 `E2003`/`E1002` 可诊断） |
| e2e | ok | `apps/web/e2e/nodes/switch.spec.ts`（lite）；面板 + debug-node 多分支路由 + 空分支失败 |
| status | ok | M-2 动态分支模型已落地；本审查无代码缺陷需修复 |

## 参数模型（M-2 后）

- `parameters.branches[]`：`{ id, label, condition }`，`id` 为稳定 UUID（连线 `sourceHandle`）。
- 废弃：`outputCount`、`fallbackOutput`、`rules` 旧字段相等模式。

## 执行语义

- 按 `branches` 顺序首匹配；多分支同时为 true 时仅第一条接收 item。
- 无一匹配：item 丢弃，节点仍 `success`（无 fallback 出口）。

## 关联文档

- 帮助：`docs/help/zh/nodes/switch.md`
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-switch
