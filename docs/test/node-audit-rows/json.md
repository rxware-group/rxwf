# Node Audit: json

> T-047 审查结论。合并至 `node-audit-matrix.md` 由 T-080 收口。

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-json |
| node_type | json |
| category | data |
| track | lite |
| panel | ok |
| validation | ok |
| executor | ok |
| error_codes | E1002 |
| status | ok |
| e2e_spec | apps/web/e2e/nodes/json.spec.ts |

## 面板（panel）

- **结论**：ok
- **依据**：`node-param-schemas.ts` 为 `json` 提供 `expression`（textarea）字段；`NodeEditorParamsPane` 经 `ParamTemplateField` 渲染，占位符与标签与 meta 一致。
- **E2E**：`json.spec.ts` 双击节点打开模态框，可见「JSON 表达式」且 textarea 回显参数。

## 保存校验（validation）

- **结论**：ok
- **依据**：`expression` 为自由文本（含 `={{ }}` 全表达式）；无额外 schema 字段。固定 JSON 语法错误在**执行期**由执行器抛出 E1002，符合 data 节点「表达式优先」设计。
- **备注**：legacy `config.data` 仍支持（单元测试覆盖），面板仅暴露 `expression`。

## 执行器（executor）

- **结论**：ok
- **依据**：`packages/node-runner/src/executors/transform/json.ts` 实现 `jsonExecutor`；`register-builtin.ts` 注册；支持固定 JSON、`{{ }}` 模板、`={{ $json }}` 全表达式及 binary 保留。

## 错误码（error_codes）

| 码 | 场景 | 文档 |
| --- | --- | --- |
| E1002 | 无模板语法的 `expression` 无法 `JSON.parse` | `docs/error-codes.md` |
| E2003 | 未注册 nodeType（registry 层，非本节点专属） | `docs/error-codes.md` |

## 测试证据

- 单元：`packages/node-runner/src/executors/transform/json.test.ts`（registry、解析、模板、E1002、binary）
- E2E：`apps/web/e2e/nodes/json.spec.ts`（lite 轨，面板 + debug-node 执行）

## 未解决问题

- 无
