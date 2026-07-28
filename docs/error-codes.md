# 错误码手册

> 对齐 PRD v1.11.0 [spec.md](./spec.md) NFR-5 / NFR-7；UI 展示规则见 [ux-ui-design.md](./ux-ui-design.md) §6.4。

## 编码规则

| 域 | 前缀 | 说明 |
|----|------|------|
| 编辑器 | `E1xxx` | 画布、保存、表达式校验 |
| 执行引擎 | `E2xxx` | 运行、节点、Webhook、队列 |
| AI / Chat | `E3xxx` | 模型、RAG、Agent |
| MCP / API | `E4xxx` | Token、权限、IDE 调用 |
| 系统 | `E5xxx` | 安装、插件 |

- 用户可见文案走 i18n；`{{nodeName}}` 等动态参数不翻译。
- API 响应体：`{ "code": "E2001", "message": "...", "traceId": "..." }`。

---

## E1xxx 编辑器

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E1001 | 有未保存的更改 | 保存后再离开，或放弃更改 |
| E1002 | 表达式语法无效 | 检查 `{{ }}` 与引用的字段名 |
| E1003 | 工作流存在无效连接 | 修复标红连线（缺触发器、环路等） |
| E1004 | 节点数接近上限（200） | 拆分工作流或使用子工作流 |
| E1004 | 该用户尚未加入团队 | 先在用户管理中邀请或直接创建该用户 |
| E1004 | 知识库平台未配置或配置无效 | 在 **设置 → 知识库** 配置 Embedding 与 RAG 默认模型后重试 |
| E1006 | 节点名称重复：{{name}} | 为每个节点设置不同的显示名称 |
| E1010 | 指定的 Runner 不存在或已吊销 | 在 Runner 管理页检查列表，或改为 `auto` 模式 |
| E1011 | 节点需要 {{platform}} 平台 Runner，当前无可用 | 注册对应 OS 的 Agent，或调整节点/工作流 Runner 策略 |
| E1012 | AI Agent 未连接 Chat Model | 将 **Chat Model** 节点连到 Agent 的 Model 口 |
| ~~E1013~~ | *(已移除)* AI Agent 未连接 Tool | Tool 可选 0~n；无 Tool 时以纯 LLM 对话运行 |
| E1014 | AI Agent 卫星连接无效（多个 Model/Memory） | 每个 Agent 仅允许一个 Model、至多一个 Memory |
| E1022 | Workflow Tool 目标工作流不存在 | 检查 workflowId 或从列表重新选择 |
| E1023 | Workflow Tool 目标工作流未发布 | 先发布目标工作流，或更换为已发布的工作流 |
| E1024 | Workflow Tool 目标未开启「作为 Agent Tool 暴露」 | 在目标工作流设置中开启并发布后重试 |
| E1051 | 子工作流触发器与其它主触发器互斥 | 仅保留一个 `subworkflowTrigger`，移除 Manual/Webhook/Schedule |
| E1052 | 已暴露为 Agent Tool 的工作流须使用子工作流触发器 | 将起点换为 **Sub-workflow Trigger** 并发布 |
| E1053 | 子工作流目标未发布 | 发布子工作流或更换为已发布的 workflowId |
| E1054 | 子工作流入参缺失 | 补齐必填字段或映射表达式 |
| E1055 | Workflow Tool 目标缺少子工作流触发器 | 在目标工作流添加 **Sub-workflow Trigger** 并发布 |
| E1056 | 子工作流触发器字段模式至少需要一个字段 | 添加输入字段或改为 Accept all |
| E1057 | 子工作流入参字段名重复 | 修改重复字段名 |
| E1058 | 子工作流触发器 JSON 示例无效 | 提供合法 JSON 对象作为示例 |
| E1030 | Crew 顺序编排至少需要两个已连接的 AI Agent 成员 | 用 `crew_member` 再连至少两名 `aiAgent`（各自需 Chat Model；Tool 可选） |
| E1031 | Crew 层级编排需要连接经理 Agent（crew_manager） | 将经理 `aiAgent` 的 **Crew 经理** 口连到 `crewHierarchical` |
| E1032 | Crew 至少需要一名工人 Agent（crew_member） | 将工人 `aiAgent` 的 **Crew 工人** 口连到 Crew / Supervisor 节点 |
| E1033 | Crew 经理/监督返回无效 JSON 或未完成委派 | 检查经理/监督模型输出是否为约定 JSON；查看执行时间线 |
| E1034 | Crew 经理委派了不存在的成员 | 使用工人节点的 id、名称或 `role` 作为 `member` 字段 |
| E1035 | Crew Supervisor 缺少监督模型 | 填写 `supervisorModel`，或通过 `crew_manager` 连接带 Chat Model 的经理 |
| E1040 | CrewAI 执行后端需要已配置的 CrewAI Runner（`CREWAI_RUNNER_URL`） | 运行 `rxwf start --with-crewai`、设置 `CREWAI_RUNNER_URL`，或改 `executionBackend: native` |
| E1040 | 工作流名称已存在 | 更换名称或编辑已有工作流（**与上一行同码**；API/列表创建重名时返回，非 CrewAI 校验） |
| E1041 | CrewAI 内置 Tool 不在允许列表中 | 检查 `enableBuiltinTools` 与白名单配置 |
| E1048 | Group Chat 至少需要两名 `group_member` 连接的 AI Agent | 用 **群聊成员** 口再连至少两名 `aiAgent`（各自需 Chat Model；Tool 可选） |
| E1049 | Group Chat orchestrator 模式缺少模型或 Orchestrator Agent | 填写 `orchestratorModel`，或通过 `group_orchestrator` 连接带 Chat Model 的 Agent |

### W10xx 校验警告（可保存，建议修复）

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| W1011 | Workflow Tool 目标工作流未发布 | 发布目标工作流后再作为 Tool 使用 |
| W1012 | Crew / Group Chat 成员未配置 role | 在对应 `aiAgent` 参数中填写 **Role** |
| W1013 | CrewAI 后端：Crew 成员未连接 Tool 且未启用内置 Tool | 为成员连接 MCP/HTTP/Workflow Tool，或启用允许的内置 Tool |
| W1014 | CrewAI Flow 模式在 P4-D3 中主要支持 crewSequential | 对 hierarchical/supervisor 使用 `crewaiFlowMode: crew`，或改用 sequential |
| W1015 | executeWorkflow 目标无 subworkflowTrigger | 建议在子工作流添加 **Sub-workflow Trigger** 以声明入参 |
| W1016 | Agent Tool 子流使用 Accept all | LLM 入参无 schema 约束，注意提示词与容错 |
| W1017 | toolWorkflow 映射含子流 schema 外的字段 | 删除多余映射键或更新子流触发器字段 |
| W1020 | Loop 节点未连接 done 出口 | 将下游连到 **done** 出口（`1`），否则迭代结果无法继续传递 |
| E2002† | Loop 节点未连接 loop 出口（保存校验） | 将循环体连到 **loop** 出口（`0`） |

> † 校验器对 Loop 拓扑使用 `E2002` 码；与下方执行域 `E2002`（排队/沙箱等）语义不同，以节点上下文为准。

## E2xxx 执行

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E2000 | 执行内部错误 | 查看 `traceId` 与执行时间线；联系管理员 |
| E2001 | 工作流未启用（Inactive） | 在编辑器打开 Active 开关 |
| E2002 | 节点参数或执行错误：{{nodeName}} | 检查节点参数与日志；**语义因节点而异**（见下方映射表与 `docs/test/node-audit-rows/`） |
| E2003 | 节点执行失败：{{nodeName}} | 查看节点日志；配置重试或 Error Workflow |
| E2004 | 工作流执行超时 | 增大工作流超时或优化慢节点 |
| E2005 | Webhook 签名无效 | 检查 HMAC Secret 与 `X-RXWF-Signature` 请求头 |
| E2006 | Webhook 请求已过期 | 同步服务器时间或增大时间戳宽限 |
| E2007 | 重复请求已忽略（幂等） | 使用返回的已有 executionId |
| E2008 | 子工作流嵌套过深 | 减少嵌套层数（最多 5 层） |
| E2010 | 无可用 Runner 执行此节点 | 检查 Runner 在线状态、平台与标签；见 [adr-node-runner.md](./adr-node-runner.md) |
| E2011 | Runner 排队超时 | 增加 Runner 数量或 `runnerQueueTimeoutMs`（Standard） |
| E2012 | 固定 Runner 已离线 | 恢复 Agent 或改用 `auto` / 其他 `runnerId` |
| E2013 | Runner 认证失败 | 在 Agent 侧重新注册或轮换凭证；检查 WS 认证超时 |
| E2014 | Webhook API Key 无效 | 检查节点 API Key 与 `X-RXWF-Api-Key` 请求头 |
| E2015 | Runner 远程 Job 载荷过大 | 减小 inputItems 体积或使用 blob 引用（Standard） |
| E2016 | Runner 不支持该节点类型 | 检查 Agent 扩展是否注册对应 `nodeType`；非白名单节点会回退 Embedded |

> **E2002 多义说明**：除上表通用话术外，校验器对 Loop 拓扑、排队/沙箱等场景复用 `E2002`；以节点上下文与 [节点失败码映射](#节点失败码映射) 为准。

## E3xxx AI

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E3001 | 无法连接模型端点 | 检查模型配置与网络；Ollama 是否运行 |
| E3002 | 模型凭证无效或过期 | 在凭证管理中更新并测试连接 |
| E3003 | RAG 未找到相关内容 | 调整知识库或降低相似度阈值 |
| E3004 | Agent 达到最大迭代次数 | 简化任务或提高 maxIterations |
| E3010 | AI Agent 运行时缺少 Chat Model | 检查 Model 节点是否已连接且未禁用 |
| ~~E3011~~ | *(已移除)* AI Agent 运行时缺少 Tool | Tool 可选；无 Tool 时 `runAgent` 走纯 chat 分支 |
| E3012 | Agent Tool 调用失败 | 查看执行时间线中的 Tool 步骤详情 |
| E1042 | CrewAI Sidecar 未配置或 kickoff / 健康检查失败 | 确认 `CREWAI_RUNNER_URL`、Sidecar 容器与 `/health`；见 [RELEASE-v1.3-crewai.md](./RELEASE-v1.3-crewai.md) |
| E1043 | CrewAI Sidecar kickoff 超时 | 增大 kickoff 超时或简化 Crew 任务 |
| E1044 | CrewAI Sidecar 不支持当前 IR 版本 | 升级 `crewai-runner` 镜像与 AWF 版本对齐 |
| E1045 | Crew Tool 桥 token 无效或未配置；Credential 桥解析失败；openai-compatible 缺少 API Key | 重试执行；Tool/Credential 桥接检查 API 与 token；配置 apiKey 凭据或 `OPENAI_API_KEY` |
| E1046 | crewai 后端不支持该 process / 节点组合（含 Consensual 占位） | 改用 `native` 后端或调整 `crewaiProcess` / `crewaiFlowMode` |
| E1050 | Group Chat 超过 maxRounds 仍未得到 finalAnswer | 增大 `maxRounds` 或调整终止关键词 / orchestrator 提示 |
| E1051 | Group Chat UserProxy resume 时 checkpoint 缺失或损坏 | 重新执行工作流；勿手动修改 waiting 节点 metadata |

## E4xxx MCP / API

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E4001 | MCP Token 无效或已吊销 | 重新创建 Token 并更新 IDE 配置 |
| E4002 | 无权执行此操作 | 检查 Token scope 或联系管理员 |
| E4002 | 邀请链接无效或已过期 | 联系 Admin 重新发送邀请 |
| E4003 | 无权修改此工作流 | 确认工作流 Owner 或更高角色 |
| E4003 | 无权访问此工作流 | 请创建者或 Admin 分享后再访问 |
| E4003 | 无权访问用户管理 | 联系 Admin 获取权限 |
| E4003 | 至少保留一名管理员 | 先指定其他用户为 Admin 再撤销 |
| E4004 | 请求过于频繁 | 稍后重试或联系管理员调整限流 |
| E4010 | Runner 注册 Token 无效或已过期 | 请 Admin 重新生成 Token |
| E4011 | Runner 凭证无效 | 在 Agent 侧重新注册或轮换凭证 |

## E5xxx 系统

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E5002 | 插件权限不足 | 查看插件 manifest 所需 permissions |
| E5003 | 插件启用失败，已回滚 | 查看审计日志；联系插件作者 |

---

## CLI 启动错误（`packages/cli`）

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| AWF-START-008 | 已指定 `--with-crewai` 但 CrewAI Sidecar 容器启动失败或健康检查超时 | 确认 Docker 可用、镜像可拉取、`RXWF_CREWAI_PORT` 未被占用；或改用 `--crewai-url` 指向外部 Sidecar |

---

## Skill 轨（`skillRun` / `workflow_run`，E1040–E1077）

| 代码 | 用户话术（zh-CN） | 建议操作 |
|------|-------------------|----------|
| E1040 | Skill 来源未配置（path/registry）或 registry 时 RxWF 工作区未设置 | path：填写 `skillPath`；registry：填写 `skillId` 并在 **设置 → RxWF** 保存工作区 |
| E1041 | Skill 包或注册记录不存在 | 检查路径、扫描注册中心，或重新导入 |
| E1043 | 缺少模型（卫星或内联 provider/model） | 连接 Chat Model 或填写 provider + model |
| E1046 | `ruleMode=explicit` 但未指定 ruleSources | 选择规则源或改为 inherit |
| E1054 | OpenClaw metadata 与当前 OS 不匹配 | 修改 SKILL.md 中 `metadata.openclaw.os` 或更换 Runner |
| E1055 | Runner 未提供 tool.invoke | 检查 Runner 能力或改用本地执行 |
| E1063 | OpenCode permission.skill 拒绝该路径 | 调整 opencode 配置或更换 skill 路径 |
| E1066 | Skill 路径必须在 `.rxwf/skills/` 下 | 勿使用 `.cursor/skills` 等运行时路径 |
| E1067 | SKILL.md 不能挂在 `skills/` 根目录 | 使用 `.rxwf/skills/{package}/SKILL.md` |
| E1069 | 已废弃的 rule 源（如 cursor_rules） | 改为 `rxwf_rules` 或 import 到 `.rxwf/rules` |
| E1071 | 未配置 Web Search Provider | 在 **设置 → Web Search** 配置 Provider 与凭证 |
| E1072 | Skill 无 network 权限却启用 web_search | 在 SKILL.md 增加 network 权限或关闭搜索 |
| E1073 | 单次执行 Web Search 查询次数超限 | 提高 `maxQueriesPerExecution` 或减少 toolWebSearch 调用 |
| E1074 | Web Search Provider 请求失败或超时 | 检查 API Key、网络与 Provider 状态；使用「测试连接」排查 |
| E1075 | 项目 manifest 禁用 workflows | 在 `rxwf.project.json` 启用 `workflows.enabled` |
| E1076 | workflow_run 缺少模板路径或工作流 ID | 填写 `workflowRelPath` 或 `workflowId` |

---

## 节点失败码映射

> AC-030：各 `nodeType` 运行时/保存期可能返回的 **E2xxx** 与审查证据。完整场景见 `docs/test/node-audit-rows/<nodeType>.md`；由 `node scripts/validate-error-codes.mjs` 校验与 audit row 一致。

| nodeType | E2xxx | 场景摘要 | 审查行 |
|----------|-------|----------|--------|
| `aiAgent` | E2003 | 无 workflow definition 上下文 | [aiAgent.md](test/node-audit-rows/aiAgent.md) |
| `aiChatModel` | E2003 | registry 直执（卫星无独立 executor） | [aiChatModel.md](test/node-audit-rows/aiChatModel.md) |
| `aiMemory` | E2003 | registry 直执（卫星无独立 executor） | [aiMemory.md](test/node-audit-rows/aiMemory.md) |
| `aiOutputParser` | E2003 | registry 直执（卫星无独立 executor） | [aiOutputParser.md](test/node-audit-rows/aiOutputParser.md) |
| `code` | E2002, E2003 | 沙箱超时/失败；registry 未注册 | [code.md](test/node-audit-rows/code.md) |
| `crewHierarchical` | E2003 | 缺 workflow 上下文 / registry 未注册 | [crewHierarchical.md](test/node-audit-rows/crewHierarchical.md) |
| `crewSequential` | E2003 | 缺 workflow 上下文 / registry 未注册 | [crewSequential.md](test/node-audit-rows/crewSequential.md) |
| `crewSupervisor` | E2003 | 缺 workflow 上下文 / registry 未注册 | [crewSupervisor.md](test/node-audit-rows/crewSupervisor.md) |
| `errorTrigger` | E2002 | 执行上下文缺少 `errorPayload` | [errorTrigger.md](test/node-audit-rows/errorTrigger.md) |
| `executeCommand` | E2002 | 空 command、非零 exitCode | [executeCommand.md](test/node-audit-rows/executeCommand.md) |
| `executeWorkflow` | E2003, E2008 | 缺 workflowId；嵌套超过 5 层 | [executeWorkflow.md](test/node-audit-rows/executeWorkflow.md) |
| `groupChat` | E2003 | 缺 workflow definition 上下文 | [groupChat.md](test/node-audit-rows/groupChat.md) |
| `httpRequest` | E2003 | registry 未注册（节点级通用） | [httpRequest.md](test/node-audit-rows/httpRequest.md) |
| `if` | E2003 | 空条件表达式 / 求值失败 | [if.md](test/node-audit-rows/if.md) |
| `json` | E2003 | registry 未注册（通用，非本节点专属） | [json.md](test/node-audit-rows/json.md) |
| `llmStream` | E2003 | registry 未注册 | [llmStream.md](test/node-audit-rows/llmStream.md) |
| `loop` | E2002 | 未连接 loop 出口（保存校验 †） | [loop.md](test/node-audit-rows/loop.md) |
| `mcpClient` | E2003 | registry 未注册 | [mcpClient.md](test/node-audit-rows/mcpClient.md) |
| `llm` | E2003 | registry 未注册 | [llm.md](test/node-audit-rows/llm.md) |
| `postgres` | E2002, E2003 | 空白 query；无连接 URL | [postgres.md](test/node-audit-rows/postgres.md) |
| `ragAnswer` | E2003 | registry 未注册 | [ragAnswer.md](test/node-audit-rows/ragAnswer.md) |
| `readWriteFile` | E2002, E2003 | 空 path / IO 失败；registry 未注册 | [readWriteFile.md](test/node-audit-rows/readWriteFile.md) |
| `scheduleTrigger` | E2003 | registry 未注册（通用） | [scheduleTrigger.md](test/node-audit-rows/scheduleTrigger.md) |
| `set` | E2003 | registry 未注册 | [set.md](test/node-audit-rows/set.md) |
| `splitInBatches` | E2003 | registry 未注册（Plus 轨） | [splitInBatches.md](test/node-audit-rows/splitInBatches.md) |
| `subworkflowTrigger` | E2003 | registry 未注册（通用） | [subworkflowTrigger.md](test/node-audit-rows/subworkflowTrigger.md) |
| `switch` | E2003 | 空 branches / 无效出边 / 求值失败 | [switch.md](test/node-audit-rows/switch.md) |
| `toolGrep` | E2002, E2003 | 空 pattern / 非法 regex；registry 直执 | [toolGrep.md](test/node-audit-rows/toolGrep.md) |
| `toolHttp` | E2003 | 缺 toolDescription；registry 直执 | [toolHttp.md](test/node-audit-rows/toolHttp.md) |
| `toolMcp` | E2003 | 缺 toolDescription；debug-node 直执 | [toolMcp.md](test/node-audit-rows/toolMcp.md) |
| `toolRead` | E2003 | registry 直执（卫星 Tool） | [toolRead.md](test/node-audit-rows/toolRead.md) |
| `toolShell` | E2002 | 未知 capability / method | [toolShell.md](test/node-audit-rows/toolShell.md) |
| `toolSkill` | E2003 | 误作独立 executor；缺 toolDescription | [toolSkill.md](test/node-audit-rows/toolSkill.md) |
| `toolSubagent` | E2003 | hub 缺失；registry 直执 | [toolSubagent.md](test/node-audit-rows/toolSubagent.md) |
| `toolWebSearch` | E2003 | 无独立 executor（卫星 Tool） | [toolWebSearch.md](test/node-audit-rows/toolWebSearch.md) |
| `toolWorkflow` | E2003 | 误作独立 executor 调用 | [toolWorkflow.md](test/node-audit-rows/toolWorkflow.md) |
| `toolWrite` | E2002, E2003 | 空 path；registry 直执 | [toolWrite.md](test/node-audit-rows/toolWrite.md) |
| `wait` | E2003 | 非法 `ms`（负数或非有限数） | [wait.md](test/node-audit-rows/wait.md) |
| `webhookTrigger` | E2001, E2005, E2006, E2014 | HTTP 鉴权、签名、过期、API Key | [webhookTrigger.md](test/node-audit-rows/webhookTrigger.md) |
| `workflow_run` | E2003 | registry 未注册；published 缺子流运行时 | [workflow_run.md](test/node-audit-rows/workflow_run.md) |

---

## 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-20 | 初版，覆盖 v1.0 主路径 |
| v1.1 | 2026-05-20 | 新增 FR-23 Runner 相关 E1010/E1011、E2010–E2012、E4010/E4011 |
| v1.2 | 2026-05-23 | 移除 E5001（Lite 席位上限已废弃） |
| v1.3 | 2026-05-24 | 新增用户/协作 E4003、E1004、E4002 话术（FR-6 RBAC） |
| v1.4 | 2026-05-24 | 新增 P4-C Crew E1030–E1035、W1012 |
| v1.5 | 2026-05-30 | 新增 P4-D CrewAI E1040–E1046、W1013–W1014、AWF-START-008；E1040 重名与 CrewAI 校验双义说明 |
| v1.6 | 2026-06-20 | M-3 T-082：补全 E2000/E2013/E2015/E2016；E2002 多义说明；节点失败码映射表（AC-030）；`validate-error-codes.mjs` 校验 |
