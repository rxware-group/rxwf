# E2E Coverage Matrix (v2.0)

> v2.0 全功能 ↔ Playwright E2E spec 覆盖矩阵。M-1 建立全量行；逐 Milestone 更新 status / e2e_spec 直至 M-6 100% 覆盖。

## 列定义

| 列 | 说明 |
| --- | --- |
| row_id | 唯一行 ID（E2E-N-{nodeType} 或 E2E-P-{nnn}），与 spec-gap-audit 互链 |
| description | 功能描述（AC-008） |
| spec_fr | spec / FR 引用（AC-008） |
| node_type | 可执行节点 type；平台能力行留空或 — |
| e2e_spec | Playwright spec 相对路径（apps/web/e2e/...） |
| status | uncovered / covered / skip（M-6 禁止 skip/待补测） |
| track | E2E 轨：lite / standard / plus / any（NFR-04） |

## 矩阵

| row_id | description | spec_fr | node_type | e2e_spec | status | track |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-N-aiAgent | 节点：aiAgent 执行与面板 | FR-2/节点 | aiAgent | nodes/aiAgent.spec.ts | covered | plus |
| E2E-N-aiChatModel | 节点：aiChatModel 执行与面板 | FR-2/节点 | aiChatModel | nodes/aiChatModel.spec.ts | covered | plus |
| E2E-N-aiKnowledge | 节点：aiKnowledge 执行与面板 | FR-2/节点 | aiKnowledge | nodes/aiKnowledge.spec.ts | covered | plus |
| E2E-N-aiMemory | 节点：aiMemory 执行与面板 | FR-2/节点 | aiMemory | nodes/aiMemory.spec.ts | covered | plus |
| E2E-N-aiOutputParser | 节点：aiOutputParser 执行与面板 | FR-2/节点 | aiOutputParser | nodes/aiOutputParser.spec.ts | covered | plus |
| E2E-N-code | 节点：code 执行与面板 | FR-2/节点 | code | nodes/code.spec.ts | covered | lite |
| E2E-N-crewHierarchical | 节点：crewHierarchical 执行与面板 | FR-2/节点 | crewHierarchical | nodes/crewHierarchical.spec.ts | covered | plus |
| E2E-N-crewSequential | 节点：crewSequential 执行与面板 | FR-2/节点 | crewSequential | nodes/crewSequential.spec.ts | covered | plus |
| E2E-N-crewSupervisor | 节点：crewSupervisor 执行与面板 | FR-2/节点 | crewSupervisor | nodes/crewSupervisor.spec.ts | covered | plus |
| E2E-N-errorTrigger | 节点：errorTrigger 执行与面板 | FR-2/节点 | errorTrigger | nodes/errorTrigger.spec.ts | covered | standard |
| E2E-N-executeCommand | 节点：executeCommand 执行与面板 | FR-2/节点 | executeCommand | nodes/executeCommand.spec.ts | covered | standard |
| E2E-N-executeWorkflow | 节点：executeWorkflow 执行与面板 | FR-2/节点 | executeWorkflow | nodes/executeWorkflow.spec.ts | covered | standard |
| E2E-N-groupChat | 节点：groupChat MVP（面板/round-robin/orchestrator/UserProxy） | FR-10/§8 | groupChat | nodes/groupChat.spec.ts; group-chat-round-robin.spec.ts; group-chat-orchestrator-user-proxy.spec.ts | covered | plus |
| E2E-N-httpRequest | 节点：httpRequest 执行与面板 | FR-2/节点 | httpRequest | nodes/httpRequest.spec.ts | covered | lite |
| E2E-N-humanApproval | 节点：humanApproval 执行与面板 | FR-2/节点 | humanApproval | nodes/humanApproval.spec.ts | covered | lite |
| E2E-N-if | 节点：if 执行与面板 | FR-2/节点 | if | nodes/if.spec.ts | covered | lite |
| E2E-N-json | 节点：json 执行与面板 | FR-2/节点 | json | nodes/json.spec.ts | covered | lite |
| E2E-N-llmStream | 节点：llmStream 执行与面板 | FR-2/节点 | llmStream | nodes/llmStream.spec.ts | covered | plus |
| E2E-N-loop | 节点：loop 执行与面板 | FR-2/节点 | loop | nodes/loop.spec.ts | covered | lite |
| E2E-N-manualTrigger | 节点：manualTrigger 执行与面板 | FR-2/节点 | manualTrigger | nodes/manualTrigger.spec.ts | covered | lite |
| E2E-N-mcpClient | 节点：mcpClient 执行与面板 | FR-2/节点 | mcpClient | nodes/mcpClient.spec.ts | covered | plus |
| E2E-N-merge | 节点：merge 执行与面板 | FR-2/节点 | merge | nodes/merge.spec.ts | covered | lite |
| E2E-N-llm | 节点：llm 执行与面板 | FR-2/节点 | llm | nodes/llm.spec.ts | covered | plus |
| E2E-N-postgres | 节点：postgres 执行与面板 | FR-2/节点 | postgres | nodes/postgres.spec.ts | covered | plus |
| E2E-N-ragAnswer | 节点：ragAnswer 执行与面板 | FR-2/节点 | ragAnswer | nodes/ragAnswer.spec.ts | covered | plus |
| E2E-N-ragRetrieve | 节点：ragRetrieve 执行与面板 | FR-2/节点 | ragRetrieve | nodes/ragRetrieve.spec.ts | covered | plus |
| E2E-N-readWriteFile | 节点：readWriteFile 执行与面板 | FR-2/节点 | readWriteFile | nodes/readWriteFile.spec.ts | covered | plus |
| E2E-N-scheduleTrigger | 节点：scheduleTrigger 执行与面板 | FR-2/节点 | scheduleTrigger | nodes/scheduleTrigger.spec.ts | covered | standard |
| E2E-N-set | 节点：set 执行与面板 | FR-2/节点 | set | nodes/set.spec.ts | covered | lite |
| E2E-N-skillRun | 节点：skillRun 执行与面板 | FR-2/节点 | skillRun | skill-run-tools.spec.ts | covered | plus |
| E2E-N-splitInBatches | 节点：splitInBatches 执行与面板 | FR-2/节点 | splitInBatches | nodes/splitInBatches.spec.ts | covered | plus |
| E2E-N-subworkflowTrigger | 节点：subworkflowTrigger 执行与面板 | FR-2/节点 | subworkflowTrigger | nodes/subworkflowTrigger.spec.ts | covered | plus |
| E2E-N-switch | 节点：switch 执行与面板 | FR-2/节点 | switch | nodes/switch.spec.ts | covered | lite |
| E2E-N-toolGrep | 节点：toolGrep 执行与面板 | FR-2/节点 | toolGrep | nodes/toolGrep.spec.ts | covered | plus |
| E2E-N-toolHttp | 节点：toolHttp 执行与面板 | FR-2/节点 | toolHttp | nodes/toolHttp.spec.ts | covered | plus |
| E2E-N-toolMcp | 节点：toolMcp 执行与面板 | FR-2/节点 | toolMcp | nodes/toolMcp.spec.ts | covered | plus |
| E2E-N-toolRead | 节点：toolRead 执行与面板 | FR-2/节点 | toolRead | nodes/toolRead.spec.ts | covered | plus |
| E2E-N-toolShell | 节点：toolShell 执行与面板 | FR-2/节点 | toolShell | nodes/toolShell.spec.ts | covered | plus |
| E2E-N-toolSkill | 节点：toolSkill 执行与面板 | FR-2/节点 | toolSkill | nodes/toolSkill.spec.ts | covered | plus |
| E2E-N-toolSubagent | 节点：toolSubagent 执行与面板 | FR-2/节点 | toolSubagent | nodes/toolSubagent.spec.ts | covered | plus |
| E2E-N-toolWebSearch | 节点：toolWebSearch 执行与面板 | FR-2/节点 | toolWebSearch | nodes/toolWebSearch.spec.ts | covered | plus |
| E2E-N-toolWorkflow | 节点：toolWorkflow 执行与面板 | FR-2/节点 | toolWorkflow | nodes/toolWorkflow.spec.ts | covered | plus |
| E2E-N-toolWrite | 节点：toolWrite 执行与面板 | FR-2/节点 | toolWrite | nodes/toolWrite.spec.ts | covered | plus |
| E2E-N-wait | 节点：wait 执行与面板 | FR-2/节点 | wait | nodes/wait.spec.ts | covered | lite |
| E2E-N-webhookTrigger | 节点：webhookTrigger 执行与面板 | FR-2/节点 | webhookTrigger | nodes/webhookTrigger.spec.ts | covered | standard |
| E2E-N-workflow_run | 节点：workflow_run 执行与面板 | FR-2/节点 | workflow_run | nodes/workflow_run.spec.ts | covered | plus |
| E2E-P-001 | 编辑器：创建工作流、拖拽节点、保存 | FR-1 | — | workflow-manual-node.spec.ts, platform-capabilities.spec.ts | covered | lite |
| E2E-P-002 | 编辑器：连线校验与环路检测 | FR-1 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-003 | 执行：手动触发与状态轮询 | FR-3 | — | nodes/manualTrigger.spec.ts | covered | lite |
| E2E-P-004 | 执行：历史列表与节点详情 | FR-3 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-005 | 执行：Error Workflow 触发链 | FR-3 | — | nodes/errorTrigger.spec.ts | covered | standard |
| E2E-P-006 | 调试：Partial/Pin/Dirty 执行 | FR-11 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-007 | 帮助：路由与 Markdown 渲染 | FR-6 | — | help-route-baseline.spec.ts, help-all-nodes.spec.ts | covered | lite |
| E2E-P-008 | 帮助：编辑器节点帮助按钮跳转 | FR-8 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-009 | 认证：登录与会话 | FR-6 | — | auth.setup.ts, platform-capabilities.spec.ts | covered | lite |
| E2E-P-010 | 设置：全局/工作流环境变量 | FR-4 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-011 | 凭证：创建与引用 | FR-10 | — | credential-types.spec.ts | covered | standard |
| E2E-P-012 | 工作流：JSON 导入导出 | FR-7 | — | platform-capabilities.spec.ts | covered | lite |
| E2E-P-013 | 子工作流：嵌套调用与深度限制 | FR-5 | — | nodes/executeWorkflow.spec.ts | covered | standard |
| E2E-P-014 | Binary：上传/下载/表达式全链路 | M-5 Binary | — | binary-full-chain.spec.ts | covered | standard |
| E2E-P-015 | MCP Server：AI IDE 反控工作流 | FR-IDE | — | nodes/mcpClient.spec.ts | covered | standard |
| E2E-P-016 | Runner：注册、心跳与调度 | FR-23 | — | platform-capabilities.spec.ts | covered | standard |
| E2E-P-017 | 文档：INDEX 导航与索引 CI | FR-01 | — | docs-index-smoke.spec.ts | covered | lite |
| E2E-P-018 | 工作流 ACL：协作者权限 | FR-6 | — | workflow-acl.spec.ts | covered | standard |
| E2E-P-019 | Webhook：HTTP 触发 API | FR-2 | — | nodes/webhookTrigger.spec.ts | covered | standard |
