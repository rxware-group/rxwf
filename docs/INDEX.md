---
version: 2
updated: 2026-06-21
categories:
  - id: spec
    label: 产品规格
  - id: requirements
    label: 需求与计划
  - id: architecture
    label: 架构
  - id: workflow
    label: 项目工作流
  - id: help-guide
    label: 帮助指南
  - id: help-node
    label: 节点帮助
  - id: adr
    label: 架构决策（ADR）
  - id: contract
    label: 契约与规范
  - id: test
    label: 测试与验收
entries:
  - path: docs/INDEX.md
    title: 文档总索引（机器可读 + 人类目录）
    category: spec
    fr: [FR-01]
    milestone: [M-1]
  - path: docs/README.md
    title: 文档分类目录与维护规则
    category: spec
    fr: [FR-01]
    milestone: [M-1]
  - path: docs/spec.md
    title: 产品需求规格 v2.0
    category: spec
    fr: [FR-01, FR-12]
    milestone: [M-1]
  - path: docs/requirements/PRD.md
    title: PRD v2.0 补齐与质量门禁
    category: requirements
    fr: [FR-01, FR-12, FR-13]
    milestone: [M-1]
  - path: docs/requirements/intake.md
    title: 项目 intake 摘要
    category: requirements
    milestone: [M-1]
  - path: docs/architecture/architecture.md
    title: 系统架构（v2.0 补齐）
    category: architecture
    fr: [FR-01]
    milestone: [M-1]
  - path: docs/workflow/plan.md
    title: 项目计划与 Milestone 划分
    category: workflow
    fr: [FR-12, FR-13]
    milestone: [M-1]
  - path: docs/error-codes.md
    title: 用户可见错误码
    category: contract
    milestone: [M-1]
  - path: docs/adr-langchain.md
    title: ADR-001 LangChain / LangGraph AI 运行时
    category: adr
    milestone: [M-1]
  - path: docs/adr-deployment.md
    title: ADR-002 Lite / Standard 部署档位
    category: adr
    milestone: [M-1]
  - path: docs/adr-module-boundaries.md
    title: ADR-003 模块与进程边界
    category: adr
    milestone: [M-1]
  - path: docs/adr-expression-sandbox.md
    title: ADR-004 表达式与 Code 沙箱
    category: adr
    milestone: [M-1]
  - path: docs/adr-execution-data.md
    title: ADR-005 执行持久化与数据模型
    category: adr
    milestone: [M-1]
  - path: docs/adr-node-runner.md
    title: ADR-006 Node Runner 跨平台执行
    category: adr
    milestone: [M-1]
  - path: docs/help/zh/index.md
    title: 帮助中心首页
    category: help-guide
    fr: [FR-06]
    milestone: [M-6]
  - path: docs/help/zh/expressions.md
    title: 表达式与模板语法
    category: help-guide
    fr: [FR-06]
    milestone: [M-6]
  - path: docs/help/zh/editor/input-panel.md
    title: INPUT 面板
    category: help-guide
    fr: [FR-06]
    milestone: [M-6]
  - path: docs/help/zh/settings/knowledge.md
    title: 知识库平台配置
    category: help-guide
    fr: [FR-06]
    milestone: [M-6]
  - path: docs/help/zh/nodes/code.md
    title: Code 节点
    category: help-node
    nodeType: code
    fr: [FR-06, FR-09]
    milestone: [M-3, M-6]
  - path: docs/help/zh/nodes/if.md
    title: IF 节点
    category: help-node
    nodeType: if
    fr: [FR-06, FR-09]
    milestone: [M-3, M-6]
  - path: docs/help/zh/nodes/switch.md
    title: Switch 节点
    category: help-node
    nodeType: switch
    fr: [FR-05, FR-06, FR-09, FR-15]
    milestone: [M-2, M-3, M-6]
  - path: docs/help/zh/nodes/loop.md
    title: Loop 节点
    category: help-node
    nodeType: loop
    fr: [FR-06, FR-09]
    milestone: [M-3, M-6]
  - path: docs/help/zh/nodes/webhookTrigger.md
    title: Webhook 触发器
    category: help-node
    nodeType: webhookTrigger
    fr: [FR-06, FR-09]
    milestone: [M-3, M-6]
  - path: docs/help/zh/nodes/aiAgent.md
    title: AI Agent 节点
    category: help-node
    nodeType: aiAgent
    fr: [FR-06, FR-09, FR-10]
    milestone: [M-3, M-4, M-6]
  - path: docs/help/zh/nodes/skillRun.md
    title: Skill Run 节点
    category: help-node
    nodeType: skillRun
    fr: [FR-05, FR-06, FR-09, FR-15]
    milestone: [M-2, M-3, M-6]
  - path: docs/test/e2e-coverage-matrix.md
    title: v2.0 全功能 E2E 覆盖矩阵
    category: test
    fr: [FR-01, FR-13]
    milestone: [M-1, M-2, M-6]
  - path: docs/workflow/spec-gap-audit.md
    title: spec 与实现差距审计
    category: workflow
    fr: [FR-01, FR-12]
    milestone: [M-1, M-2, M-6]
  - path: docs/test/milestones/M-1-acceptance.md
    title: M-1 人工验收用例
    category: test
    fr: [FR-12]
    milestone: [M-1]
  - path: docs/test/milestones/M-2-acceptance.md
    title: M-2 人工验收用例
    category: test
    fr: [FR-05, FR-12, FR-15]
    milestone: [M-2]
  - path: docs/README.test.md
    title: README.test
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-skill-p1.md
    title: RELEASE skill p1
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-skill-p3.md
    title: RELEASE skill p3
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-skill-p4.md
    title: RELEASE skill p4
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-v1.0.md
    title: RELEASE v1.0
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-v1.1-agent.md
    title: RELEASE v1.1 agent
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-v1.2-p4c-agent.md
    title: RELEASE v1.2 p4c agent
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-v1.3-crewai.md
    title: RELEASE v1.3 crewai
    category: spec
    milestone: [M-6]
  - path: docs/RELEASE-v1.3-group-chat.md
    title: RELEASE v1.3 group chat
    category: spec
    milestone: [M-6]
  - path: docs/UPGRADE-rx-workflow.md
    title: UPGRADE rx workflow
    category: spec
    milestone: [M-6]
  - path: docs/ac-api-mapping.md
    title: ac api mapping
    category: spec
    milestone: [M-6]
  - path: docs/architecture/README.md
    title: 目录说明
    category: architecture
    milestone: [M-6]
  - path: docs/architecture/binary-current-state.md
    title: binary current state
    category: architecture
    milestone: [M-6]
  - path: docs/architecture/binary-n8n-review.md
    title: binary n8n review
    category: architecture
    milestone: [M-6]
  - path: docs/architecture/binary-options.md
    title: binary options
    category: architecture
    milestone: [M-6]
  - path: docs/architecture/binary-risks.md
    title: binary risks
    category: architecture
    milestone: [M-6]
  - path: docs/architecture/group-chat-conflict-review.md
    title: group chat conflict review
    category: architecture
    milestone: [M-6]
  - path: docs/binary-type-support-analysis.md
    title: binary type support analysis
    category: spec
    milestone: [M-6]
  - path: docs/changelog/runner-v1.1.md
    title: runner v1.1
    category: spec
    milestone: [M-6]
  - path: docs/chat-completion-smoke.md
    title: chat completion smoke
    category: spec
    milestone: [M-6]
  - path: docs/code-node-guide.md
    title: code node guide
    category: spec
    milestone: [M-6]
  - path: docs/credentials-design.md
    title: credentials design
    category: spec
    milestone: [M-6]
  - path: docs/deployment-cli-cheatsheet.md
    title: deployment cli cheatsheet
    category: spec
    milestone: [M-6]
  - path: docs/expression-guide.md
    title: expression guide
    category: spec
    milestone: [M-6]
  - path: docs/help/README.md
    title: 目录说明
    category: help-guide
    milestone: [M-6]
  - path: docs/help/zh/nodes/aiChatModel.md
    title: aiChatModel
    category: help-node
    nodeType: aiChatModel
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/aiKnowledge.md
    title: aiKnowledge
    category: help-node
    nodeType: aiKnowledge
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/aiMemory.md
    title: aiMemory
    category: help-node
    nodeType: aiMemory
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/aiOutputParser.md
    title: aiOutputParser
    category: help-node
    nodeType: aiOutputParser
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/crewHierarchical.md
    title: crewHierarchical
    category: help-node
    nodeType: crewHierarchical
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/crewSequential.md
    title: crewSequential
    category: help-node
    nodeType: crewSequential
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/crewSupervisor.md
    title: crewSupervisor
    category: help-node
    nodeType: crewSupervisor
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/errorTrigger.md
    title: errorTrigger
    category: help-node
    nodeType: errorTrigger
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/executeCommand.md
    title: executeCommand
    category: help-node
    nodeType: executeCommand
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/executeWorkflow.md
    title: executeWorkflow
    category: help-node
    nodeType: executeWorkflow
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/groupChat.md
    title: groupChat
    category: help-node
    nodeType: groupChat
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/httpRequest.md
    title: httpRequest
    category: help-node
    nodeType: httpRequest
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/humanApproval.md
    title: humanApproval
    category: help-node
    nodeType: humanApproval
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/json.md
    title: json
    category: help-node
    nodeType: json
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/llmStream.md
    title: llmStream
    category: help-node
    nodeType: llmStream
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/manualTrigger.md
    title: manualTrigger
    category: help-node
    nodeType: manualTrigger
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/mcpClient.md
    title: mcpClient
    category: help-node
    nodeType: mcpClient
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/merge.md
    title: merge
    category: help-node
    nodeType: merge
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/llm.md
    title: llm
    category: help-node
    nodeType: llm
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/postgres.md
    title: postgres
    category: help-node
    nodeType: postgres
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/ragAnswer.md
    title: ragAnswer
    category: help-node
    nodeType: ragAnswer
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/ragRetrieve.md
    title: ragRetrieve
    category: help-node
    nodeType: ragRetrieve
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/readWriteFile.md
    title: readWriteFile
    category: help-node
    nodeType: readWriteFile
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/scheduleTrigger.md
    title: scheduleTrigger
    category: help-node
    nodeType: scheduleTrigger
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/set.md
    title: set
    category: help-node
    nodeType: set
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/splitInBatches.md
    title: splitInBatches
    category: help-node
    nodeType: splitInBatches
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/subworkflowTrigger.md
    title: subworkflowTrigger
    category: help-node
    nodeType: subworkflowTrigger
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolGrep.md
    title: toolGrep
    category: help-node
    nodeType: toolGrep
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolHttp.md
    title: toolHttp
    category: help-node
    nodeType: toolHttp
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolMcp.md
    title: toolMcp
    category: help-node
    nodeType: toolMcp
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolRead.md
    title: toolRead
    category: help-node
    nodeType: toolRead
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolShell.md
    title: toolShell
    category: help-node
    nodeType: toolShell
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolSkill.md
    title: toolSkill
    category: help-node
    nodeType: toolSkill
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolSubagent.md
    title: toolSubagent
    category: help-node
    nodeType: toolSubagent
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolWebSearch.md
    title: toolWebSearch
    category: help-node
    nodeType: toolWebSearch
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolWorkflow.md
    title: toolWorkflow
    category: help-node
    nodeType: toolWorkflow
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/toolWrite.md
    title: toolWrite
    category: help-node
    nodeType: toolWrite
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/wait.md
    title: wait
    category: help-node
    nodeType: wait
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/help/zh/nodes/workflow_run.md
    title: workflow run
    category: help-node
    nodeType: workflow_run
    fr: [FR-06, FR-09]
    milestone: [M-6]
  - path: docs/loading-ui.md
    title: loading ui
    category: spec
    milestone: [M-6]
  - path: docs/node-plugin-spec.md
    title: node plugin spec
    category: spec
    milestone: [M-6]
  - path: docs/queue-concurrency-optimization-summary.md
    title: queue concurrency optimization summary
    category: spec
    milestone: [M-6]
  - path: docs/requirements/README.md
    title: 目录说明
    category: requirements
    milestone: [M-6]
  - path: docs/runner-agent-quickstart.md
    title: runner agent quickstart
    category: spec
    milestone: [M-6]
  - path: docs/runner-extension-packaging-deployment.md
    title: runner extension packaging deployment
    category: spec
    milestone: [M-6]
  - path: docs/runner-sdk.md
    title: runner sdk
    category: spec
    milestone: [M-6]
  - path: docs/settings-page-layout.md
    title: settings page layout
    category: spec
    milestone: [M-6]
  - path: docs/spec-review.md
    title: spec review
    category: spec
    milestone: [M-6]
  - path: docs/standard-lite-deployment-implementation-plan.md
    title: standard lite deployment implementation plan
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/fixtures/workflows/antigravity-startcycle.source.md
    title: antigravity startcycle.source
    category: test
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-20-v1-implementation.md
    title: 2026 05 20 v1 implementation
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-22-n8n-first-completion.md
    title: 2026 05 22 n8n first completion
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-chat-completion.md
    title: 2026 05 23 chat completion
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-login-password-reset.md
    title: 2026 05 23 login password reset
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-node-editor-modal.md
    title: 2026 05 23 node editor modal
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-user-role-management.md
    title: 2026 05 23 user role management
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-workflow-agent-node-strict-closeout.md
    title: 2026 05 23 workflow agent node strict closeout
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-workflow-agent-node.md
    title: 2026 05 23 workflow agent node
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-23-workflow-tool-expose-as-tool.md
    title: 2026 05 23 workflow tool expose as tool
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-24-credential-types.md
    title: 2026 05 24 credential types
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-28-sandbox-piscina-timeout.md
    title: 2026 05 28 sandbox piscina timeout
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-28-standard-lite-deployment.md
    title: 2026 05 28 standard lite deployment
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-29-crewai-integration.md
    title: 2026 05 29 crewai integration
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-29-runner-v1.1-websocket.md
    title: 2026 05 29 runner v1.1 websocket
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-30-group-chat.md
    title: 2026 05 30 group chat
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-30-rx-workflow-rename.md
    title: 2026 05 30 rx workflow rename
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-05-31-skill-integration.md
    title: 2026 05 31 skill integration
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-03-expression-implicit-return.md
    title: 2026 06 03 expression implicit return
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-03-expression-static-validation.md
    title: 2026 06 03 expression static validation
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-03-js-expression-engine.md
    title: 2026 06 03 js expression engine
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-03-workflow-binary-support.md
    title: 2026 06 03 workflow binary support
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-04-node-input-panel-n8n.md
    title: 2026 06 04 node input panel n8n
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-05-help-center.md
    title: 2026 06 05 help center
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-06-skill-run-simplify.md
    title: 2026 06 06 skill run simplify
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-22-knowledge-platform-config.md
    title: 知识库平台集中配置
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/plans/2026-06-23-platform-rxwf-env.md
    title: 平台 RXWF 环境变量重构
    category: requirements
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-20-v1-implementation-design.md
    title: 2026 05 20 v1 implementation design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-22-n8n-first-completion-design.md
    title: 2026 05 22 n8n first completion design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-agent-canvas-design.md
    title: 2026 05 23 agent canvas design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-agent-rag-design.md
    title: 2026 05 23 agent rag design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-chat-completion-design.md
    title: 2026 05 23 chat completion design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-crew-hierarchical-design.md
    title: 2026 05 23 crew hierarchical design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-crew-sequential-design.md
    title: 2026 05 23 crew sequential design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-crew-supervisor-design.md
    title: 2026 05 23 crew supervisor design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-edit-publish-mode-design.md
    title: 2026 05 23 edit publish mode design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-knowledge-base-design.md
    title: 2026 05 23 knowledge base design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-22-knowledge-platform-config-design.md
    title: 知识库平台集中配置（Embedding + RAG 默认）
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-langsmith-tracing-design.md
    title: 2026 05 23 langsmith tracing design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-login-password-reset-design.md
    title: 2026 05 23 login password reset design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-node-editor-modal-design.md
    title: 2026 05 23 node editor modal design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-p4-c-ai-milestone-roadmap.md
    title: 2026 05 23 p4 c ai milestone roadmap
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-user-role-management-design.md
    title: 2026 05 23 user role management design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-23-workflow-agent-node-design.md
    title: 2026 05 23 workflow agent node design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-24-credential-types-design.md
    title: 2026 05 24 credential types design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md
    title: 2026 05 28 sandbox piscina timeout design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-28-standard-lite-deployment-design.md
    title: 2026 05 28 standard lite deployment design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-29-crewai-integration-design.md
    title: 2026 05 29 crewai integration design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md
    title: 2026 05 29 runner v1.1 websocket design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-30-group-chat-design.md
    title: 2026 05 30 group chat design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-30-rx-workflow-rename-design.md
    title: 2026 05 30 rx workflow rename design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-31-skill-integration-design.md
    title: 2026 05 31 skill integration design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-05-31-skill-platform-parity-matrix.md
    title: 2026 05 31 skill platform parity matrix
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-expression-implicit-return-design.md
    title: 2026 06 03 expression implicit return design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-expression-static-validation-design.md
    title: 2026 06 03 expression static validation design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-js-expression-globals-design.md
    title: 2026 06 03 js expression globals design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-skill-run-simplify-design.md
    title: 2026 06 03 skill run simplify design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-switch-dynamic-branches-design.md
    title: 2026 06 03 switch dynamic branches design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
    title: 2026 06 03 workflow binary support design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-04-node-input-panel-n8n-design.md
    title: 2026 06 04 node input panel n8n design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-05-help-center-design.md
    title: 2026 06 05 help center design
    category: spec
    milestone: [M-6]
  - path: docs/superpowers/specs/2026-06-06-subworkflow-trigger-design.md
    title: 2026 06 06 subworkflow trigger design
    category: spec
    milestone: [M-6]
  - path: docs/test/README.md
    title: 目录说明
    category: test
    milestone: [M-6]
  - path: docs/test/milestones/M-1-report.md
    title: M 1 report
    category: test
    milestone: [M-6]
  - path: docs/test/milestones/M-2-report.md
    title: M 2 report
    category: test
    milestone: [M-2]
  - path: docs/test/milestones/M-3-acceptance.md
    title: M 3 acceptance
    category: test
    milestone: [M-3]
  - path: docs/test/milestones/M-3-report.md
    title: M 3 report
    category: test
    milestone: [M-3]
  - path: docs/test/milestones/M-4-acceptance.md
    title: M 4 acceptance
    category: test
    milestone: [M-4]
  - path: docs/test/milestones/M-4-report.md
    title: M 4 report
    category: test
    milestone: [M-4]
  - path: docs/test/milestones/M-5-acceptance.md
    title: M 5 acceptance
    category: test
    milestone: [M-5]
  - path: docs/test/milestones/M-5-binary-plan-confirmation.md
    title: M 5 binary plan confirmation
    category: test
    milestone: [M-5]
  - path: docs/test/milestones/M-5-report.md
    title: M 5 report
    category: test
    milestone: [M-5]
  - path: docs/test/milestones/M-6-acceptance.md
    title: M 6 acceptance
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-matrix.md
    title: node audit matrix
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/aiAgent.md
    title: aiAgent
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/aiChatModel.md
    title: aiChatModel
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/aiKnowledge.md
    title: aiKnowledge
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/aiMemory.md
    title: aiMemory
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/aiOutputParser.md
    title: aiOutputParser
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/code.md
    title: code
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/crewHierarchical.md
    title: crewHierarchical
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/crewSequential.md
    title: crewSequential
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/crewSupervisor.md
    title: crewSupervisor
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/errorTrigger.md
    title: errorTrigger
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/executeCommand.md
    title: executeCommand
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/executeWorkflow.md
    title: executeWorkflow
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/groupChat.md
    title: groupChat
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/httpRequest.md
    title: httpRequest
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/humanApproval.md
    title: humanApproval
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/if.md
    title: if
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/json.md
    title: json
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/llmStream.md
    title: llmStream
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/loop.md
    title: loop
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/manualTrigger.md
    title: manualTrigger
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/mcpClient.md
    title: mcpClient
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/merge.md
    title: merge
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/llm.md
    title: llm
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/postgres.md
    title: postgres
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/ragAnswer.md
    title: ragAnswer
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/ragRetrieve.md
    title: ragRetrieve
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/readWriteFile.md
    title: readWriteFile
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/scheduleTrigger.md
    title: scheduleTrigger
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/set.md
    title: set
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/splitInBatches.md
    title: splitInBatches
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/subworkflowTrigger.md
    title: subworkflowTrigger
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/switch.md
    title: switch
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolGrep.md
    title: toolGrep
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolHttp.md
    title: toolHttp
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolMcp.md
    title: toolMcp
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolRead.md
    title: toolRead
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolShell.md
    title: toolShell
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolSkill.md
    title: toolSkill
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolSubagent.md
    title: toolSubagent
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolWebSearch.md
    title: toolWebSearch
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolWorkflow.md
    title: toolWorkflow
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/toolWrite.md
    title: toolWrite
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/wait.md
    title: wait
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/webhookTrigger.md
    title: webhookTrigger
    category: test
    milestone: [M-6]
  - path: docs/test/node-audit-rows/workflow_run.md
    title: workflow run
    category: test
    milestone: [M-6]
  - path: docs/ux-ui-design.md
    title: ux ui design
    category: spec
    milestone: [M-6]
  - path: docs/ux-v1.0-checklist.md
    title: ux v1.0 checklist
    category: spec
    milestone: [M-6]
  - path: docs/verification/milestones/M-1-report.md
    title: M 1 report
    category: test
    milestone: [M-6]
  - path: docs/verification/milestones/M-2-report.md
    title: M 2 report
    category: test
    milestone: [M-6]
  - path: docs/verification/milestones/M-3-report.md
    title: M 3 report
    category: test
    milestone: [M-6]
  - path: docs/verification/milestones/M-4-report.md
    title: M 4 report
    category: test
    milestone: [M-6]
  - path: docs/verification/milestones/M-5-report.md
    title: M 5 report
    category: test
    milestone: [M-6]
  - path: docs/workflow/README.md
    title: 目录说明
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/spec-gap-reviewer-output.md
    title: spec gap reviewer output
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks.md
    title: tasks
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-001.md
    title: T-001
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-002.md
    title: T-002
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-003.md
    title: T-003
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-004.md
    title: T-004
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-005.md
    title: T-005
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-006.md
    title: T-006
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-007.md
    title: T-007
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-008.md
    title: T-008
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-009.md
    title: T-009
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-010.md
    title: T-010
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-011.md
    title: T-011
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-012.md
    title: T-012
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-013.md
    title: T-013
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-014.md
    title: T-014
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-015.md
    title: T-015
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-016.md
    title: T-016
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-017.md
    title: T-017
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-018.md
    title: T-018
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-019.md
    title: T-019
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-020.md
    title: T-020
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-021.md
    title: T-021
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-022.md
    title: T-022
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-023.md
    title: T-023
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-024.md
    title: T-024
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-025.md
    title: T-025
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-026.md
    title: T-026
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-027.md
    title: T-027
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-028.md
    title: T-028
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-029.md
    title: T-029
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-030.md
    title: T-030
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-031.md
    title: T-031
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-032.md
    title: T-032
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-033.md
    title: T-033
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-034.md
    title: T-034
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-035.md
    title: T-035
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-036.md
    title: T-036
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-037.md
    title: T-037
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-038.md
    title: T-038
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-039.md
    title: T-039
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-040.md
    title: T-040
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-041.md
    title: T-041
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-042.md
    title: T-042
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-043.md
    title: T-043
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-044.md
    title: T-044
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-045.md
    title: T-045
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-046.md
    title: T-046
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-047.md
    title: T-047
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-048.md
    title: T-048
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-049.md
    title: T-049
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-050.md
    title: T-050
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-051.md
    title: T-051
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-052.md
    title: T-052
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-053.md
    title: T-053
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-054.md
    title: T-054
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-055.md
    title: T-055
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-056.md
    title: T-056
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-057.md
    title: T-057
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-058.md
    title: T-058
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-059.md
    title: T-059
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-060.md
    title: T-060
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-061.md
    title: T-061
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-062.md
    title: T-062
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-063.md
    title: T-063
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-064.md
    title: T-064
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-065.md
    title: T-065
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-066.md
    title: T-066
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-067.md
    title: T-067
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-068.md
    title: T-068
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-069.md
    title: T-069
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-070.md
    title: T-070
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-071.md
    title: T-071
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-072.md
    title: T-072
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-073.md
    title: T-073
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-074.md
    title: T-074
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-075.md
    title: T-075
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-076.md
    title: T-076
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-077.md
    title: T-077
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-078.md
    title: T-078
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-079.md
    title: T-079
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-080.md
    title: T-080
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-081.md
    title: T-081
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-082.md
    title: T-082
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-083.md
    title: T-083
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-084.md
    title: T-084
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-085.md
    title: T-085
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-086.md
    title: T-086
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-087.md
    title: T-087
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-088.md
    title: T-088
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-089.md
    title: T-089
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-090.md
    title: T-090
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-091.md
    title: T-091
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-092.md
    title: T-092
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-093.md
    title: T-093
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-094.md
    title: T-094
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-095.md
    title: T-095
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-096.md
    title: T-096
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-097.md
    title: T-097
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-098.md
    title: T-098
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-099.md
    title: T-099
    category: workflow
    milestone: [M-6]
  - path: docs/workflow/tasks/T-100.md
    title: T-100
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-101.md
    title: T-101
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-102.md
    title: T-102
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-103.md
    title: T-103
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-104.md
    title: T-104
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-105.md
    title: T-105
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-106.md
    title: T-106
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-107.md
    title: T-107
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-108.md
    title: T-108
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-109.md
    title: T-109
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-110.md
    title: T-110
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-111.md
    title: T-111
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-112.md
    title: T-112
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-113.md
    title: T-113
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-114.md
    title: T-114
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-115.md
    title: T-115
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-116.md
    title: T-116
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-117.md
    title: T-117
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-118.md
    title: T-118
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-119.md
    title: T-119
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-120.md
    title: T-120
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-121.md
    title: T-121
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-122.md
    title: T-122
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-123.md
    title: T-123
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-124.md
    title: T-124
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-125.md
    title: T-125
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-126.md
    title: T-126
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-127.md
    title: T-127
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-128.md
    title: T-128
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-129.md
    title: T-129
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-130.md
    title: T-130
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-131.md
    title: T-131
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-132.md
    title: T-132
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-133.md
    title: T-133
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-134.md
    title: T-134
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-135.md
    title: T-135
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-136.md
    title: T-136
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-137.md
    title: T-137
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-138.md
    title: T-138
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-139.md
    title: T-139
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-140.md
    title: T-140
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-141.md
    title: T-141
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-142.md
    title: T-142
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-143.md
    title: T-143
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-144.md
    title: T-144
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-145.md
    title: T-145
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-146.md
    title: T-146
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-147.md
    title: T-147
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-148.md
    title: T-148
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-149.md
    title: T-149
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-150.md
    title: T-150
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-151.md
    title: T-151
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-152.md
    title: T-152
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-153.md
    title: T-153
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-154.md
    title: T-154
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-155.md
    title: T-155
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-156.md
    title: T-156
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-157.md
    title: T-157
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-158.md
    title: T-158
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-159.md
    title: T-159
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-160.md
    title: T-160
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-161.md
    title: T-161
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-162.md
    title: T-162
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-163.md
    title: T-163
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-164.md
    title: T-164
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-165.md
    title: T-165
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-166.md
    title: T-166
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-167.md
    title: T-167
    category: workflow
    milestone: [M-1]
  - path: docs/workflow/tasks/T-168.md
    title: T-168
    category: workflow
    milestone: [M-1]
  - path: docs/test/manual-verification-M1-M6.md
    title: manual verification M1 M6
    category: test
    milestone: [M-6]
  - path: docs/test/milestones/M-6-report.md
    title: M 6 report
    category: test
    milestone: [M-6]
  - path: docs/test/test-report.md
    title: test report
    category: test
    milestone: [M-6]
  - path: docs/verification/milestones/M-6-report.md
    title: M 6 report
    category: test
    milestone: [M-6]
  - path: docs/verification/verification-report.md
    title: verification report
    category: test
    milestone: [M-6]

---

# RX-Workflow 文档总索引

> **机器可读索引**：见上方 YAML frontmatter（`version`、`categories`、`entries`）。  
> **维护规则**：新增或移动 `docs/**/*.md` 须在 `entries` 登记；详见 [README.md](./README.md)。  
> **交叉引用**：FR 编号与 nodeType 导航见 [§ FR 与 nodeType 入口](#fr-与-nodetype-入口)。

---

## 产品规格

| 文档 | 说明 |
|------|------|
| [INDEX.md](./INDEX.md) | 本文档 — YAML frontmatter + 人类可读总目录 |
| [README.md](./README.md) | 分类目录、每文件摘要、维护规则 |
| [spec.md](./spec.md) | 产品需求规格 v2.0（权威功能边界） |

## 需求与计划

| 文档 | 说明 |
|------|------|
| [requirements/PRD.md](./requirements/PRD.md) | PRD v2.0 补齐与质量门禁 |
| [requirements/intake.md](./requirements/intake.md) | 项目 intake 摘要 |

## 架构

| 文档 | 说明 |
|------|------|
| [architecture/architecture.md](./architecture/architecture.md) | 系统架构（C4、模块、数据流、INDEX 规范 §10） |

## 项目工作流

| 文档 | 说明 |
|------|------|
| [workflow/plan.md](./workflow/plan.md) | Milestone 划分、In/Out Scope、验收门禁 |

## 契约与规范

| 文档 | 说明 |
|------|------|
| [error-codes.md](./error-codes.md) | 用户可见错误码 |

## 架构决策（ADR）

| ADR | 文档 |
|-----|------|
| ADR-001 | [adr-langchain.md](./adr-langchain.md) — LangChain / LangGraph AI 运行时 |
| ADR-002 | [adr-deployment.md](./adr-deployment.md) — Lite / Standard 部署档位 |
| ADR-003 | [adr-module-boundaries.md](./adr-module-boundaries.md) — 模块与进程边界 |
| ADR-004 | [adr-expression-sandbox.md](./adr-expression-sandbox.md) — 表达式与 Code 沙箱 |
| ADR-005 | [adr-execution-data.md](./adr-execution-data.md) — 执行持久化与数据模型 |
| ADR-006 | [adr-node-runner.md](./adr-node-runner.md) — Node Runner 跨平台执行 |

## 帮助指南

| 文档 | 说明 |
|------|------|
| [help/zh/index.md](./help/zh/index.md) | 帮助中心首页（应用内 `/help`） |
| [help/zh/expressions.md](./help/zh/expressions.md) | 表达式与 `{{ }}` 模板 |
| [help/zh/editor/input-panel.md](./help/zh/editor/input-panel.md) | INPUT 面板 |

## 节点帮助（骨架）

> 完整 45 nodeType 覆盖见 M-6；以下为当前已登记条目。

| nodeType | 文档 |
|----------|------|
| `code` | [help/zh/nodes/code.md](./help/zh/nodes/code.md) |
| `if` | [help/zh/nodes/if.md](./help/zh/nodes/if.md) |
| `switch` | [help/zh/nodes/switch.md](./help/zh/nodes/switch.md) |
| `loop` | [help/zh/nodes/loop.md](./help/zh/nodes/loop.md) |
| `webhookTrigger` | [help/zh/nodes/webhookTrigger.md](./help/zh/nodes/webhookTrigger.md) |
| `aiAgent` | [help/zh/nodes/aiAgent.md](./help/zh/nodes/aiAgent.md) |
| `skillRun` | [help/zh/nodes/skillRun.md](./help/zh/nodes/skillRun.md) |

## 测试与验收

| 文档 | 说明 | Milestone |
|------|------|-----------|
| [test/e2e-coverage-matrix.md](./test/e2e-coverage-matrix.md) | v2.0 全功能 E2E 覆盖矩阵 | M-1～M-6 |
| [workflow/spec-gap-audit.md](./workflow/spec-gap-audit.md) | spec 与实现差距审计 | M-1～M-6 |
| [test/milestones/M-1-acceptance.md](./test/milestones/M-1-acceptance.md) | M-1 人工验收用例 | M-1 |
| [test/milestones/M-2-acceptance.md](./test/milestones/M-2-acceptance.md) | M-2 人工验收用例 | M-2 |

---

## FR 与 nodeType 入口

> **AC-012**：从 FR 编号或 nodeType 快速定位相关文档。下表与上方 YAML `entries` 中 `fr` / `nodeType` 字段一致；新增登记时须同步更新本节。

### 按 FR 编号

| FR | 说明 | 相关文档入口 |
|----|------|-------------|
| FR-01 | 文档索引与规格治理 | 本文档、[README.md](./README.md)、[spec.md](./spec.md)、[requirements/PRD.md](./requirements/PRD.md)、[architecture/architecture.md](./architecture/architecture.md) §10 |
| FR-06 | 帮助中心与节点文档 | [help/zh/index.md](./help/zh/index.md)、[help/zh/expressions.md](./help/zh/expressions.md)、[help/zh/editor/input-panel.md](./help/zh/editor/input-panel.md)、[help/zh/nodes/](./help/zh/nodes/)（见下表 **按 nodeType**） |
| FR-09 | 节点帮助与参数说明 | [help/zh/nodes/](./help/zh/nodes/)（见下表 **按 nodeType**） |
| FR-10 | AI Agent / Group Chat | [help/zh/nodes/aiAgent.md](./help/zh/nodes/aiAgent.md) |
| FR-12 | PRD 与 Milestone 计划 | [spec.md](./spec.md)、[requirements/PRD.md](./requirements/PRD.md)、[workflow/plan.md](./workflow/plan.md) |
| FR-05 | 半实现项补齐（skillRun/ACL/credential/switch） | [workflow/spec-gap-audit.md](./workflow/spec-gap-audit.md)、[test/milestones/M-2-acceptance.md](./test/milestones/M-2-acceptance.md) |
| FR-13 | 质量门禁与验收标准 | [requirements/PRD.md](./requirements/PRD.md) §5、[workflow/plan.md](./workflow/plan.md) |
| FR-15 | 功能变更同步文档/INDEX/help | 本文档、[help/zh/nodes/switch.md](./help/zh/nodes/switch.md)、[help/zh/nodes/skillRun.md](./help/zh/nodes/skillRun.md) |

### 按 nodeType

| nodeType | 帮助文档 | FR |
|----------|----------|-----|
| `code` | [help/zh/nodes/code.md](./help/zh/nodes/code.md) | FR-06, FR-09 |
| `if` | [help/zh/nodes/if.md](./help/zh/nodes/if.md) | FR-06, FR-09 |
| `switch` | [help/zh/nodes/switch.md](./help/zh/nodes/switch.md) | FR-06, FR-09 |
| `loop` | [help/zh/nodes/loop.md](./help/zh/nodes/loop.md) | FR-06, FR-09 |
| `webhookTrigger` | [help/zh/nodes/webhookTrigger.md](./help/zh/nodes/webhookTrigger.md) | FR-06, FR-09 |
| `aiAgent` | [help/zh/nodes/aiAgent.md](./help/zh/nodes/aiAgent.md) | FR-06, FR-09, FR-10 |
| `skillRun` | [help/zh/nodes/skillRun.md](./help/zh/nodes/skillRun.md) | FR-06, FR-09 |

---

*索引版本 `2` · 更新于 2026-06-20 · CI 校验：`pnpm lint:docs-index`（M-1 T-005/T-006；M-2 T-033 help/INDEX 同步）*
