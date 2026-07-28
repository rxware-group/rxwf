# executeCommand — AUDIT-N-executeCommand

> M-3 节点审查单行记录（action / standard）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `ExecuteCommandFields`（command/args/cwd、`+ 添加参数`）；`NodeEditorParamsPane` 集成；`node-port-defs.ts` 默认 `{ command: 'echo', args: ['rxwf'] }` |
| validation | ok | 运行时校验：空 `command`、argv 模式无有效 args、非零 exitCode 返回 `failed`；无额外保存期 type 级错误码 |
| executor | ok | `executeCommandExecutor` 经 `registerBuiltinExecutors` 注册；`execute-command.test.ts` 覆盖 argv/legacy/RXWF_JSON |
| error_codes | E2002 | 空 command、argv 无有效参数、命令非零 exitCode（`部分命令执行失败`） |
| e2e_spec | nodes/executeCommand.spec.ts | `@any` 面板 + debug-node 成功/空 command 失败 |
| status | ok | 审查通过；无实现缺陷需修复 |

## 参数模型

- `command`：可执行文件或命令名（argv 模式）或整段 shell 行（legacy，无 `args` 键时）。
- `args`：字符串数组，spawn 不经 shell 转义；至少一个非空项（legacy 除外）。
- `cwd`：可选工作目录。
- `timeoutMs`：设置页；`0` 不超时，默认 120s。

## 执行语义

- 每条 input item 执行一次；`RXWF_JSON` 环境变量注入当前 item JSON。
- 输出 item：`{ stdout, stderr, exitCode, error?, legacyShellLine? }`。
- 任一 item 非零 exitCode → 节点 `failed` + `E2002`。

## 关联文档

- 帮助：`docs/help/zh/nodes/executeCommand.md`（T-131）
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-executeCommand
