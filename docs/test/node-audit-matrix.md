# Node Audit Matrix (M-3)

> 节点审查矩阵：45 可执行 nodeType × 面板 / 校验 / 执行器 / 错误码。  
> 双源：`NODE_TYPE_META`（apps/web/src/features/editor/node-type-meta.ts）+ executor registry（packages/node-runner/src/executors）。  
> 卫星节点（`SATELLITE_NODE_TYPES`）无独立 executor，`executor` 列标 `satellite`。  
> 逐 type 审查结论写入 `docs/test/node-audit-rows/<type>.md`，M-3 收口合并至本表（T-080）。

## 列定义

| 列 | 说明 |
| --- | --- |
| row_id | 唯一行 ID（AUDIT-N-{nodeType}） |
| node_type | 可执行节点 type（不含 stickyNote） |
| category | NODE_TYPE_META.category |
| track | E2E 轨：lite / standard / plus |
| panel | 属性面板审查：pending / ok / fail |
| validation | 保存校验审查：pending / ok / fail |
| executor | 执行器注册：pending / ok / fail / satellite / missing |
| error_codes | 失败错误码文档化：pending / 逗号分隔 E 码 |
| audit_row | 单行审查记录路径 |
| status | 汇总：pending / ok / fail / skip |
| notes | 自由备注 |

## 矩阵

| row_id | node_type | category | track | panel | validation | executor | error_codes | audit_row | status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUDIT-N-aiAgent | aiAgent | agent | plus | ok | ok | ok | E1012,E1014,E2003,E3001,E3010,E3012,E3013 | docs/test/node-audit-rows/aiAgent.md | ok |  |
| AUDIT-N-aiChatModel | aiChatModel | agent | plus | ok | ok | satellite | E1012,E1014,E1043,E2003,E3001,E3010,W1010 | docs/test/node-audit-rows/aiChatModel.md | ok |  |
| AUDIT-N-aiKnowledge | aiKnowledge | agent | plus | ok | ok | satellite | E1014,W1010,E3003,E3001 | docs/test/node-audit-rows/aiKnowledge.md | ok |  |
| AUDIT-N-aiMemory | aiMemory | agent | plus | ok | ok | satellite | E1014,W1010 | docs/test/node-audit-rows/aiMemory.md | ok |  |
| AUDIT-N-aiOutputParser | aiOutputParser | agent | plus | ok | ok | satellite | E2003,E1014,E3013,W1010 | docs/test/node-audit-rows/aiOutputParser.md | ok |  |
| AUDIT-N-code | code | action | lite | ok | ok | ok | E2002, E2003 | docs/test/node-audit-rows/code.md | ok |  |
| AUDIT-N-crewHierarchical | crewHierarchical | agent | plus | ok | ok | ok | E1031,E1032,E1033,E2003 | docs/test/node-audit-rows/crewHierarchical.md | ok |  |
| AUDIT-N-crewSequential | crewSequential | agent | plus | ok | ok | ok | E1030,E1040,E2003 | docs/test/node-audit-rows/crewSequential.md | ok |  |
| AUDIT-N-crewSupervisor | crewSupervisor | agent | plus | ok | ok | ok | E1032,E1033,E1035,E2003 | docs/test/node-audit-rows/crewSupervisor.md | ok |  |
| AUDIT-N-errorTrigger | errorTrigger | trigger | standard | ok | ok | ok | E2002 | docs/test/node-audit-rows/errorTrigger.md | ok |  |
| AUDIT-N-executeCommand | executeCommand | action | standard | ok | ok | ok | E2002 | docs/test/node-audit-rows/executeCommand.md | ok |  |
| AUDIT-N-executeWorkflow | executeWorkflow | action | standard | ok | ok | ok | E2003, E2008, E1003, E1053, E1054, W1015 | docs/test/node-audit-rows/executeWorkflow.md | ok |  |
| AUDIT-N-groupChat | groupChat | agent | plus | ok | ok | ok | E1048,E1049,E2003,E3001 | docs/test/node-audit-rows/groupChat.md | ok |  |
| AUDIT-N-httpRequest | httpRequest | action | lite | ok | ok | ok | E1005,E1010,E1011,E2003 | docs/test/node-audit-rows/httpRequest.md | ok |  |
| AUDIT-N-humanApproval | humanApproval | logic | lite | ok | ok | ok | — | docs/test/node-audit-rows/humanApproval.md | ok |  |
| AUDIT-N-if | if | logic | lite | ok | ok | ok | E2003 | docs/test/node-audit-rows/if.md | ok |  |
| AUDIT-N-json | json | data | lite | ok | ok | ok | E1002 | docs/test/node-audit-rows/json.md | ok |  |
| AUDIT-N-llmStream | llmStream | action | plus | ok | ok | ok | E2003,E3001 | docs/test/node-audit-rows/llmStream.md | ok |  |
| AUDIT-N-loop | loop | logic | lite | ok | ok | ok | E2002, W1020 | docs/test/node-audit-rows/loop.md | ok |  |
| AUDIT-N-manualTrigger | manualTrigger | trigger | lite | ok | ok | ok | E1002 | docs/test/node-audit-rows/manualTrigger.md | ok |  |
| AUDIT-N-mcpClient | mcpClient | action | plus | ok | ok | ok | E1001,E1004,E2003,E3012 | docs/test/node-audit-rows/mcpClient.md | ok |  |
| AUDIT-N-merge | merge | logic | lite | ok | ok | ok | E2002 | docs/test/node-audit-rows/merge.md | ok |  |
| AUDIT-N-llm | llm | action | plus | ok | ok | ok | E2003,E3001 | docs/test/node-audit-rows/llm.md | ok |  |
| AUDIT-N-postgres | postgres | action | standard | ok | ok | ok | E2002,E2003 | docs/test/node-audit-rows/postgres.md | ok |  |
| AUDIT-N-ragAnswer | ragAnswer | action | plus | ok | ok | ok | E1004,E3001,E3003 | docs/test/node-audit-rows/ragAnswer.md | ok |  |
| AUDIT-N-ragRetrieve | ragRetrieve | action | plus | ok | ok | ok | E1004,E3001,E3003 | docs/test/node-audit-rows/ragRetrieve.md | ok |  |
| AUDIT-N-readWriteFile | readWriteFile | action | plus | ok | ok | ok | E2002,E2003 | docs/test/node-audit-rows/readWriteFile.md | ok |  |
| AUDIT-N-scheduleTrigger | scheduleTrigger | trigger | standard | ok | ok | ok | — | docs/test/node-audit-rows/scheduleTrigger.md | ok |  |
| AUDIT-N-set | set | data | lite | ok | ok | ok | E1002, E2003 | docs/test/node-audit-rows/set.md | ok |  |
| AUDIT-N-skillRun | skillRun | agent | plus | ok | ok | ok | E1040,E1041,E1043,E1046,E1056,E1063,E1066,E1069,E1071,E1076,E2002,E2003,E3001 | docs/test/node-audit-rows/skillRun.md | ok | M-2 skill-run E2E covered; synthesized T-080 pending dedicated audit row file |
| AUDIT-N-splitInBatches | splitInBatches | logic | plus | ok | ok | ok | E2003 | docs/test/node-audit-rows/splitInBatches.md | ok |  |
| AUDIT-N-subworkflowTrigger | subworkflowTrigger | trigger | plus | ok | ok | ok | E1051,E1052,E1056,E1057,E1058 | docs/test/node-audit-rows/subworkflowTrigger.md | ok |  |
| AUDIT-N-switch | switch | logic | lite | ok | ok | ok | E2003 | docs/test/node-audit-rows/switch.md | ok |  |
| AUDIT-N-toolGrep | toolGrep | agent | plus | ok | ok | satellite | E1056,E1041,E2002,E2003,E3012 | docs/test/node-audit-rows/toolGrep.md | ok |  |
| AUDIT-N-toolHttp | toolHttp | agent | plus | ok | ok | satellite | E2003,E3012 | docs/test/node-audit-rows/toolHttp.md | ok |  |
| AUDIT-N-toolMcp | toolMcp | agent | plus | ok | ok | satellite | E2003,E3012,E1001,E1004 | docs/test/node-audit-rows/toolMcp.md | ok |  |
| AUDIT-N-toolRead | toolRead | agent | plus | ok | ok | satellite | E1056,E1041,E2003,E3012 | docs/test/node-audit-rows/toolRead.md | ok |  |
| AUDIT-N-toolShell | toolShell | agent | plus | ok | ok | satellite | E1057,E2002,E3012 | docs/test/node-audit-rows/toolShell.md | ok |  |
| AUDIT-N-toolSkill | toolSkill | agent | plus | ok | ok | satellite | E1040,E3001,E2003 | docs/test/node-audit-rows/toolSkill.md | ok |  |
| AUDIT-N-toolSubagent | toolSubagent | agent | plus | ok | ok | satellite | E1049,E1048,E1050,E2003,E3001 | docs/test/node-audit-rows/toolSubagent.md | ok |  |
| AUDIT-N-toolWebSearch | toolWebSearch | agent | plus | ok | ok | satellite | E1071,E1072,E1073,E1074 | docs/test/node-audit-rows/toolWebSearch.md | ok |  |
| AUDIT-N-toolWorkflow | toolWorkflow | agent | plus | ok | ok | satellite | E1001,E1022,E1023,E1024,E1054,E1055,E3012 | docs/test/node-audit-rows/toolWorkflow.md | ok |  |
| AUDIT-N-toolWrite | toolWrite | agent | plus | ok | ok | satellite | E1056,E1041,E2002,E2003,E3012 | docs/test/node-audit-rows/toolWrite.md | ok |  |
| AUDIT-N-wait | wait | action | lite | ok | ok | ok | E2003 | docs/test/node-audit-rows/wait.md | ok |  |
| AUDIT-N-webhookTrigger | webhookTrigger | trigger | standard | ok | ok | ok | E1001,E2001,E2005,E2006,E2014 | docs/test/node-audit-rows/webhookTrigger.md | ok |  |
| AUDIT-N-workflow_run | workflow_run | action | plus | ok | ok | ok | E1075,E1076,E2003 | docs/test/node-audit-rows/workflow_run.md | ok |  |
