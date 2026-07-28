# toolWebSearch — AUDIT-N-toolWebSearch

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 inheritConfig/credentialMode/provider/credentialId；`BuiltinSatelliteToolDescription` 固定 Tool 描述；E2E `@any` 覆盖 |
| validation | ok | 无独立保存期 type 级错误码；fixed-capability 卫星内置 Tool 描述；Provider 与 query 在运行时校验 |
| executor | satellite | `buildAgentToolDefinitions` 注册 `source.type: web_search`；`invokeAgentTool` Embedded/Agent 双路径；`skill-run.test.ts` / `resolve-web-search-provider-config.test.ts` 覆盖 |
| error_codes | E1071,E1072,E1073,E1074 | 未配置 Provider / 空 query → `E1071`；Skill 无 network 权限 → `E1072`；超配额 → `E1073`；Provider 失败 → `E1074` |
| e2e_spec | nodes/toolWebSearch.spec.ts | `@any` 面板 inheritConfig/凭证/Provider + 内置描述；`@plus` 无独立 executor E2003 + aiAgent/skillRun 卫星接线 |
| status | ok | 审查通过；M-2 provider 已补齐，M-3 补充 audit 单测与 E2E |

## 参数模型

- `inheritConfig`：`true`/`false`，默认继承系统 Web Search 设置（§6.8）。
- `credentialMode`：`platform` \| `runner-local`；runner-local 时 `providerConfig` 不含 apiKey。
- `provider` / `credentialId`：`inheritConfig=false` 时节点级覆盖。
- Tool 描述：fixed-capability 卫星，面板只读内置 Agent 描述（i18n `toolWebSearchAgentDesc`）。

## 执行语义

- 卫星节点：须 **ai_tool** 连接至 `skillRun` 或 `aiAgent`；无独立 registry 执行器。
- `buildAgentToolDefinitions`：LLM 工具参数 `query`/`q`/`maxResults`；`source: { type: 'web_search', toolNodeId }`。
- Embedded：`ctx.webSearch.search`（API `@rxwf/web-search` / Settings Provider）。
- Agent Runner：`runnerGateway.invokeTool` capability `web_search` + `resolveWebSearchProviderConfig` relay。
- Skill Run：父 Skill 须 `network` 权限，否则 **E1072**（`skill-run.ts`）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 对 `toolWebSearch` 节点直接 debug-node（无 standalone executor） |
| E1071 | Web Search Provider 未启用/未配置；空 query |
| E1072 | Skill Run 场景 Skill 无 `network` 权限却调用 web_search |
| E1073 | 单次执行 Web Search 查询次数超限 |
| E1074 | Provider 请求失败、Runner invoke 失败或超时 |

## E2E

- Spec：`apps/web/e2e/nodes/toolWebSearch.spec.ts`（E2E-N-toolWebSearch）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板用例
- 覆盖：面板 inheritConfig/凭证模式/Provider 字段 + 内置 Tool 描述；直接 debug-node → E2003；aiAgent 接线不产生 E2003

## 备注

- Runner 要求 `web_search` capability（`node-runner-requirements.ts` / `runner-policy-types.ts`）。
- M-2 `T-018` 已实现 `invokeWebSearch` provider 与 `resolveWebSearchProviderConfig`。
- 帮助文档 `docs/help/zh/nodes/toolWebSearch.md` 已存在；M-6 T-159 负责字数/示例扩展。
