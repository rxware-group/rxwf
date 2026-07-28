# Node Audit: code

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-code |
| node_type | code |
| category | action |
| track | lite |
| panel | ok |
| validation | ok |
| executor | ok |
| error_codes | E2002, E2003 |
| status | ok |
| task | T-050 |

## Panel（ok）

- 参数 schema：`node-param-schemas.ts` 中 `jsCode`（`javascript` / CodeMirror）与 `timeoutMs`（设置页，默认 `-1` 不超时）。
- 渲染：`NodeEditorParamsPane` 对 `code` 节点使用 `CodeJsEditor`，容器类名 `code-js-form-field`；沙箱变量补全（`$input`、`$log` 等）已配置。
- 遗留兼容：`timeoutMs === 60000` 在面板显示为 `-1`（与 executeCommand 一致）。

## Validation（ok）

- 无 Code 节点专属保存校验规则；空 `jsCode` 允许保存（运行期由沙箱报错）。
- 通用工作流图校验（环、连接、触发器等）适用。

## Executor（ok）

- 注册：`register-builtin.ts` → `createCodeExecutor({ runInSandbox })`；Runner Agent `register-core.ts` 同步注册。
- 实现：`code.ts` 读取 `jsCode`（兼容 `code` 字段）、`resolveCodeSandboxTimeoutMs`、向沙箱传递 `inputItems` / `env` / `vars` / `nodes` / `execution` / `workflow`。
- 单测：`code.test.ts` 覆盖注册、遗留字段、超时、元数据传递、沙箱 `E2002` 传播。

## Error codes

| 码 | 场景 |
| --- | --- |
| E2002 | 沙箱执行失败或超时（`@rxwf/sandbox` `runInSandbox`） |
| E2003 | 执行器未注册 / Unknown node type（`ExecutorRegistry`） |

## E2E（lite）

- `apps/web/e2e/nodes/code.spec.ts`：面板 CodeMirror 渲染；`debug-node` 算术执行；`$log` 收集。

## 结论

`code` 节点面板、校验、执行器注册与失败错误码均已对齐矩阵要求；lite 轨 E2E 通过。
