# if — AUDIT-N-if

> M-3 节点审查单行记录（logic / lite）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 定义 `condition`（expression）；`NodeEditorParamsPane` 渲染 `.if-condition-form-field`；`IfConditionPanel` + `if.test.tsx` |
| validation | ok | `validateIfParameters`（`node-params/if.tsx`）：非 legacy 时条件非空且须为 `{{ }}` 表达式；`normalizeNodeParameters` 自动包裹裸表达式 |
| executor | ok | `ifExecutor` 经 `registerBuiltinExecutors` 注册；逐 item 求值分流 true/false 双出口；空 `condition` 返回 `failed` + `E2003` |
| error_codes | E2003 | 空条件表达式、无效 `{{ }}` 模板（校验/执行一致） |
| e2e | ok | `apps/web/e2e/nodes/if.spec.ts`（lite）；面板条件字段 + debug-node true/false 路由 + 空条件失败 |
| status | ok | 审查通过；legacy `field`/`expected` 模式保留兼容 |

## 参数模型

- 主路径：`parameters.condition` — `{{ }}` JavaScript 布尔表达式。
- Legacy：`field` + `expected` 相等比较（无 `condition` 键时）。
- n8n 导入：`conditions[]` 首条 `left` 作为表达式来源（经 `if-condition.ts` 解析）。

## 执行语义

- 对每个 input item 独立求值；true → 出口 `0`，false → 出口 `1`。
- 双出口标签：`true` / `false`（`node-port-defs.ts`）。

## 关联文档

- 帮助：`docs/help/zh/nodes/if.md`
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-if
