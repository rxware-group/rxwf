# toolWrite — AUDIT-N-toolWrite

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `defaultEncoding`（utf8）；`BuiltinSatelliteToolDescription` 展示内置 Tool 描述；`fixed-capability-tool-types` 提供 hint |
| validation | ok | 无独立保存期 type 级错误码；固定能力工具使用内置 `toolDescription`（可选手动覆盖） |
| executor | satellite | `agent-satellite-tools.ts` 经 `buildAgentToolDefinitions` 注册 `filesystem/write`；`invokeAgentTool` → embedded/agent `skill:filesystem` write；M-2 `skill-run` embedded gateway 亦支持 write；无 standalone `registerPlusExecutors` 条目 |
| error_codes | E1056,E1041,E2002,E2003,E3012 | 空 path → `E2002`；路径越界 → `E1056`；写失败（IO）→ `E1041`；registry 直执 `toolWrite` → `E2003`；不支持 source → `E3012` |
| e2e_spec | nodes/toolWrite.spec.ts | `@any` 面板内置描述与 defaultEncoding；`@plus` 直执 E2003；aiAgent 卫星接线无 E2003 |
| status | ok | 审查通过；embedded write 已补齐，卫星执行路径与面板已就绪 |

## 参数模型

- `defaultEncoding`：默认 `utf8`（面板 select，当前仅 utf8）。
- 可选 `toolDescription` 覆盖传给 LLM 的说明。
- LLM 调用参数：`path`（必填）、`content`（必填）、`append`（可选 boolean）。

## 执行语义

- 卫星节点：须以 **ai_tool** 连接 `aiAgent`、`skillRun` 或 `toolSubagent`。
- `buildAgentToolDefinitions` 输出 `source: { type: 'filesystem', operation: 'write', toolNodeId }`。
- **Embedded（aiAgent）**：`invokeEmbeddedRunnerTool` → `skill:filesystem` / `write`，`resolveWritePath` + `mkdir` + `writeFile`/`appendFile`。
- **skillRun embedded**：`invokeSkillRunFilesystem` write（M-2 已补）；`dispatchWrite` provider 在未接线时抛 `E1041`。
- **远程 Runner**：`runnerGateway.invokeTool`，节点需 `file` capability（`node-runner-requirements.ts`）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 对 `toolWrite` 直接 `registry.execute`（无独立执行器） |
| E2002 | `path` 仅空白 |
| E1056 | 路径不在 `scanRoots` 内 |
| E1041 | 路径在根内但写入失败；skillRun 未接线 write 卫星 |
| E3012 | `invokeAgentTool` 遇到不支持的 source 类型 |

## E2E

- Spec：`apps/web/e2e/nodes/toolWrite.spec.ts`（E2E-N-toolWrite）
- 轨：plus（矩阵 track）；`@any` 面板用例在 lite/standard/plus 运行
- 覆盖：内置 Tool 描述与 defaultEncoding 面板；debug-node 直执 `toolWrite` → E2003；aiAgent 卫星接线无工具注册错误

## 备注

- 与 `readWriteFile` 不同：`toolWrite` 为 Agent 卫星，非主流程独立节点执行器。
- 帮助文档 `docs/help/zh/nodes/toolWrite.md` 由 M-6 T-156 负责。
