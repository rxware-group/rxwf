# groupChat — AUDIT-N-groupChat

> M-3 节点审查单行记录（agent / plus track）。M-4 前 stub 审查：执行器与校验已就绪；UserProxy resume / orchestrator 深化由 M-4 T-086–T-093 验收。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 maxRounds、speakerSelection、terminationKeywords、UserProxy、orchestrator 等字段；`NodeEditorParamsPane` 通用渲染 |
| validation | ok | `validateWorkflowDefinition`：`E1048`（<2 名 group_member）、`E1012`（成员缺 Chat Model）；运行时 `runGroupChatNative` 亦返回 `E1048` |
| executor | ok | `createGroupChatExecutor`（`group-chat.ts`）经 `registerPlusExecutors` 注册；`group-chat.test.ts` 覆盖 round-robin、langgraph 委托、E1048 |
| error_codes | E1048,E1049,E2003,E3001 | 成员不足 `E1048`；orchestrator 配置缺失 `E1049`；无 definition 上下文 `E2003`；AI runtime 未配置 `E3001` |
| e2e_spec | nodes/groupChat.spec.ts | `@any` 面板；`@plus` debug-node `E1048`；Ollama 可达时 round-robin 冒烟 |
| status | ok | M-3 stub 审查通过；M-4 全量 UserProxy/orchestrator API 集成待 T-093 |

## 参数模型

- `maxRounds`：发言轮次上限（默认 8，1–50）。
- `speakerSelection`：`roundRobin` | `orchestrator`。
- `terminationKeywords`：逗号分隔终止词（默认 TERMINATE,FINISH,完成）。
- `returnTranscript` / `returnTranscriptMarkdown`：是否输出 transcript。
- `userProxyEnabled` / `userProxyEveryNRounds` / `userProxyPrompt`：UserProxy HITL（M-4 T-086 默认 -1 深化）。
- `orchestratorProvider` / `orchestratorModel` 等：orchestrator 模式调度模型。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: groupChat`。
- `executionBackend`：`native`（默认）或 `langgraph`（`ai.runGroupChat` 委托）。
- 成功输出：`answer`、`transcript`、`groupChatSteps`；`metadata.agentSteps` 含 `groupChatTurn`。
- UserProxy：`status: waiting` + `metadata.groupChat.checkpoint`（resume 见 M-4 T-093）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1048 | 保存期或运行时：<2 个 `group_member` 连接的 aiAgent |
| E1012 | 保存期：成员未连接 Chat Model |
| E1049 | orchestrator 模式缺少 orchestrator Agent 或模型配置 |
| E2003 | 执行上下文无 workflow definition |
| E3001 | AI runtime 未配置 |

## E2E

- Spec：`apps/web/e2e/nodes/groupChat.spec.ts`（E2E-N-groupChat）
- 轨：plus（compose plus profile）；lite 仅 `@any` 面板
- 覆盖：面板关键字段；无成员 debug-node → `E1048`；Ollama 可达时 round-robin 成功

## 备注

- 帮助文档 `docs/help/zh/nodes/groupChat.md` 由 M-6 T-144 负责。
- 集成参考：`apps/api/src/integration/p4e-group-chat.integration.test.ts`（mock AI 全链路）。
