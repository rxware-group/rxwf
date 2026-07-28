# toolRead — AUDIT-N-toolRead

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 空 schema；`BuiltinSatelliteToolDescription` 展示内置 Tool 描述；`fixed-capability-tool-types` 提供 hint |
| validation | ok | 无独立保存期 type 级错误码；固定能力工具使用内置 `toolDescription`（可选手动覆盖） |
| executor | satellite | `agent-satellite-tools.ts` 经 `buildAgentToolDefinitions` 注册 `filesystem/read`；`invokeAgentTool` 调用 embedded/agent `skill:filesystem`；无 standalone `registerPlusExecutors` 条目 |
| error_codes | E1056,E1041,E2003,E3012 | 路径越界 → `E1056`；读失败（目录/IO）→ `E1041`；registry 直执 `toolRead` → `E2003`；不支持 source → `E3012` |
| e2e_spec | nodes/toolRead.spec.ts | `@any` 面板内置描述；`@plus` 直执 E2003；aiAgent 卫星接线无 E2003 |
| status | ok | 审查通过；卫星执行路径与面板已就绪，补充单测与 E2E |

## 参数模型

- 无额外可编辑参数（固定能力卫星）；可选 `toolDescription` 覆盖传给 LLM 的说明。
- LLM 调用参数：`path` 或 `target_file`（别名）。

## 执行语义

- 卫星节点：须以 **ai_tool** 连接 `aiAgent`、`skillRun` 或 `toolSubagent`。
- `buildAgentToolDefinitions` 输出 `source: { type: 'filesystem', operation: 'read', toolNodeId }`。
- **Embedded**：`invokeAgentTool` → `skill:filesystem` / `read`，受 `scanRoots` 约束。
- **远程 Runner**：`runnerGateway.invokeTool`，节点需 `file` capability（`node-runner-requirements.ts`）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 对 `toolRead` 直接 `registry.execute`（无独立执行器） |
| E1056 | 路径不在 `scanRoots` 内；不存在文件经 `realpath` 解析失败亦可能映射为此码 |
| E1041 | 路径在根内但 `readFile` 失败（如读取目录） |
| E3012 | `invokeAgentTool` 遇到不支持的 source 类型 |

## E2E

- Spec：`apps/web/e2e/nodes/toolRead.spec.ts`（E2E-N-toolRead）
- 轨：plus（矩阵 track）；`@any` 面板用例在 lite/standard/plus 运行
- 覆盖：内置 Tool 描述面板；debug-node 直执 `toolRead` → E2003；aiAgent 卫星接线无工具注册错误

## 备注

- 与 `readWriteFile` 不同：`toolRead` 为 Agent 卫星，非主流程独立节点执行器。
- 帮助文档 `docs/help/zh/nodes/toolRead.md` 由 M-6 T-155 负责。
