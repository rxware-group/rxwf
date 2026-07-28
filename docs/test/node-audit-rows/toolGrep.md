# toolGrep — AUDIT-N-toolGrep

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `maxResults`；`BuiltinSatelliteToolDescription` 展示内置 Tool 描述；`fixed-capability-tool-types` 提供 hint |
| validation | ok | 无独立保存期 type 级错误码；固定能力工具使用内置 `toolDescription`（可选手动覆盖） |
| executor | satellite | `agent-satellite-tools.ts` 经 `buildAgentToolDefinitions` 注册 `filesystem/grep`；`invokeAgentTool` embedded `skill:filesystem` / `grep`（M-2 skillRun 路径亦经 `invokeSkillRunFilesystem`）；无 standalone `registerPlusExecutors` 条目 |
| error_codes | E1056,E1041,E2002,E2003,E3012 | 路径越界 → `E1056`；空 pattern / 非法 regex → `E2002`；遍历/读失败 → `E1041`；registry 直执 → `E2003`；不支持 source → `E3012` |
| e2e_spec | nodes/toolGrep.spec.ts | `@any` 面板内置描述与 maxResults；`@plus` 直执 E2003；aiAgent 卫星接线无 E2003 |
| status | ok | 审查通过；embedded grep 已补齐至 `invokeEmbeddedRunnerTool`，单测与 E2E 覆盖 |

## 参数模型

- `maxResults`：最大匹配条数（默认 100，embedded 遍历上限 50）。
- 可选 `toolDescription` 覆盖传给 LLM 的说明。
- LLM 调用参数：`pattern`（必填）、`path`、`glob`。

## 执行语义

- 卫星节点：须以 **ai_tool** 连接 `aiAgent`、`skillRun` 或 `toolSubagent`。
- `buildAgentToolDefinitions` 输出 `source: { type: 'filesystem', operation: 'grep', toolNodeId }`。
- **Embedded（aiAgent）**：`invokeAgentTool` → `skill:filesystem` / `grep`，在 `scanRoots` 内递归搜索，返回 `{ matches, grepFallback: true }`。
- **skillRun**：经 `resolveRunnerForToolNode` 路由至 `invokeSkillRunFilesystem`（M-2 T-026/T-017 已验收）。
- **远程 Runner**：`runnerGateway.invokeTool`，节点需 `file` capability。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 对 `toolGrep` 直接 `registry.execute`（无独立执行器） |
| E2002 | `pattern` 为空；非法正则 |
| E1056 | `path` 不在 `scanRoots` 内 |
| E1041 | 目录遍历或 `readFile` 失败 |
| E3012 | `invokeAgentTool` 遇到不支持的 source 类型 |

## E2E

- Spec：`apps/web/e2e/nodes/toolGrep.spec.ts`（E2E-N-toolGrep）
- 轨：plus（矩阵 track）；`@any` 面板用例在 lite/standard/plus 运行
- 覆盖：内置 Tool 描述与 maxResults 字段；debug-node 直执 `toolGrep` → E2003；aiAgent 卫星接线无工具注册错误

## 备注

- M-2 `skill-run.test.ts` 已覆盖 skillRun + toolGrep 端到端；本任务补齐 aiAgent embedded grep 与 M-3 审查行。
- 帮助文档 `docs/help/zh/nodes/toolGrep.md` 由 M-6 T-157 负责。
