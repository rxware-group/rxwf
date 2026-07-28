# AUDIT-N-set — Set 节点审查

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-set |
| node_type | set |
| category | data |
| track | lite |
| panel | ok |
| validation | ok |
| executor | ok |
| error_codes | E1002, E2003 |
| status | ok |
| e2e_spec | apps/web/e2e/nodes/set.spec.ts |

## 面板（panel）

- **结论**：`ok`
- **依据**：`node-param-schemas.ts` 为 `set` 声明 `mode`（select：manual/expression）与 `fields`（json）；`NodeEditorParamsPane` 通过通用 `Select` + `JsonParamEditor` 渲染，非空可编辑参数。
- **专用组件**：`apps/web/src/features/editor/node-params/set.tsx`（`SetParamsPanel`）供单测与审查快照；生产路径与 schema 一致。
- **单测**：`apps/web/src/features/editor/node-params/set.test.tsx` — schema 字段、面板渲染、fields JSON 校验。

## 校验（validation）

- **结论**：`ok`
- **保存时**：`fields` 经 `applyJsonDraftsToDefinition` 解析；非法 JSON 返回 `editor.jsonInvalid`（对应 **E1002**），不污染已存 parameters。
- **工作流级**：无 set 专用图结构校验；依赖通用节点名/连线校验。

## 执行器（executor）

- **结论**：`ok`
- **注册**：`register-builtin.ts` → `setExecutor`（`packages/node-runner/src/executors/transform/set.ts`）。
- **行为**：`manual` 模式合并静态 `fields`/`values[]`；`expression` 模式解析 `{{ }}` 与 `={{ }}` 模板；支持 binary 字段合并（`set-binary.ts`）。
- **单测**：`packages/node-runner/src/executors/transform/set.test.ts` — 含 E2003 未注册与 registry 冒烟。

## 错误码（error_codes）

| 码 | 场景 |
| --- | --- |
| E2003 | 执行时 nodeType 未注册 |
| E1002 | 编辑器保存时 `fields` JSON 语法无效 |

set 执行期无专用业务错误码；表达式求值失败走引擎通用错误路径。

## E2E（lite）

- **spec**：`apps/web/e2e/nodes/set.spec.ts`（`E2E-N-set`）
- **覆盖**：面板模式/字段编辑器可见；`debug-node` manual 合并字段；expression 模式模板解析。

## 备注

- 默认参数：`defaultNodeParameters('set')` → `{ mode: 'manual', fields: {} }`。
- 兼容 n8n `values[]` 行格式（executor `resolveSetFields`）。
