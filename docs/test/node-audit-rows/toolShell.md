# toolShell — AUDIT-N-toolShell

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `cwd`；`BuiltinSatelliteToolDescription` 展示内置 Tool 描述；`NodeEditorParamsPane` 集成 |
| validation | ok | 固定能力卫星：`toolDescription` 可选（内置 i18n 描述）；`cwd` 可选，默认相对 `scanRoots[0]` |
| executor | satellite | `buildAgentToolDefinitions` / `invokeAgentTool`（`agent-satellite-tools.ts`）；Embedded 返回 `E1057`；Agent Runner 经 `runnerGateway.invokeTool` 执行 shell |
| error_codes | E1057,E2002,E3012 | `E1057`：Embedded v1 未启用 shell；`E2002`：未知 capability/method；`E3012`：不支持的 source 类型 |
| e2e_spec | nodes/toolShell.spec.ts | `@any` 面板 Tool 描述 + cwd；`@plus` aiAgent 接线 + Chat Model 缺失 `E3010` |
| status | ok | 审查通过；卫星工具注册/调用路径已就绪，单测与 E2E 覆盖 |

## 参数模型

- `toolDescription`：可选；留空时使用内置 Agent 描述（`fixed-capability-tool-descriptions.ts`）。
- `cwd`：可选工作目录，相对 `scanRoots[0]`；支持表达式。

## 执行语义

- 卫星节点：无独立 executor registry 项；经 `aiAgent` / `skillRun` 的 `buildAgentToolDefinitions` 注册为 `source.type: shell`。
- Tool 参数 schema：`command`（必填）、`cwd`、`timeoutMs`。
- Embedded Runner：`invokeEmbeddedRunnerTool` 对 `shell/exec` 返回 `E1057`（v1 设计限制）。
- Agent Runner：`runnerGateway.invokeTool` 传递 `capability: shell`、`method: exec` 与 command/cwd/timeoutMs args。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1057 | Embedded tool invoke v1 未启用 shell |
| E2002 | 未知 capability 或 method |
| E3012 | `invokeAgentTool` 遇到不支持的 source 类型 |

## E2E

- Spec：`apps/web/e2e/nodes/toolShell.spec.ts`（E2E-N-toolShell）
- 轨：plus（`RXWF_E2E_TRACK=plus`）；`@any` 面板用例在 lite/standard/plus 轨运行
- 覆盖：面板 Tool 描述 + 工作目录；aiAgent + toolShell 卫星接线；缺 Chat Model 时 `E3010`

## 备注

- Runner 需求：`getNodeRunnerRequirements('toolShell')` → `capabilities: ['shell']`，平台 linux/windows/macos。
- 帮助文档 `docs/help/zh/nodes/toolShell.md` 由 M-6 T-158 负责。
