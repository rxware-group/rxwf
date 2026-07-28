# RX-Workflow — 文档索引

> **人类可读分类目录**（本页）；**机器可读全量索引**见 [INDEX.md](./INDEX.md)（M-1 登记，CI `pnpm lint:docs-index` 校验）。  
> 产品权威规格：[spec.md](./spec.md) v2.0；本轮补齐 PRD：[requirements/PRD.md](./requirements/PRD.md)。

## 分类目录

### 需求与规格

| 文件 | 摘要 |
|------|------|
| [requirements/PRD.md](./requirements/PRD.md) | v2.0 补齐与质量门禁产品需求文档（FR/AC/Milestone） |
| [requirements/intake.md](./requirements/intake.md) | 需求 intake 与范围确认记录 |
| [spec.md](./spec.md) | 产品功能规格主文档（v2.0 全量边界） |
| [spec-review.md](./spec-review.md) | 产品规格评审记录 |

### 架构

| 文件 | 摘要 |
|------|------|
| [architecture/architecture.md](./architecture/architecture.md) | v2.0 补齐系统架构（模块、部署、文档索引机制） |

### 用户帮助（Web `/help`）

| 文件 | 摘要 |
|------|------|
| [help/zh/index.md](./help/zh/index.md) | 帮助中心首页（应用内 `/help` 渲染） |
| [help/zh/expressions.md](./help/zh/expressions.md) | 表达式与 `{{ }}` 模板语法 |
| [help/zh/editor/input-panel.md](./help/zh/editor/input-panel.md) | 编辑器 INPUT 面板用法 |
| [help/zh/nodes/aiAgent.md](./help/zh/nodes/aiAgent.md) | AI Agent 节点配置与端口 |
| [help/zh/nodes/aiChatModel.md](./help/zh/nodes/aiChatModel.md) | AI Chat Model 卫星节点 |
| [help/zh/nodes/aiKnowledge.md](./help/zh/nodes/aiKnowledge.md) | AI Knowledge 知识库卫星节点 |
| [help/zh/nodes/aiMemory.md](./help/zh/nodes/aiMemory.md) | AI Memory 记忆卫星节点 |
| [help/zh/nodes/code.md](./help/zh/nodes/code.md) | Code 节点（沙箱、Items 上下文） |
| [help/zh/nodes/crewSupervisor.md](./help/zh/nodes/crewSupervisor.md) | Crew Supervisor 编排节点 |
| [help/zh/nodes/if.md](./help/zh/nodes/if.md) | IF 条件分支节点 |
| [help/zh/nodes/loop.md](./help/zh/nodes/loop.md) | Loop 节点（批次迭代、done 汇总） |
| [help/zh/nodes/skillRun.md](./help/zh/nodes/skillRun.md) | Skill Run 技能执行节点 |
| [help/zh/nodes/switch.md](./help/zh/nodes/switch.md) | Switch 多路分支节点 |
| [help/zh/nodes/toolRead.md](./help/zh/nodes/toolRead.md) | Tool Read 工具读节点 |
| [help/zh/nodes/toolWebSearch.md](./help/zh/nodes/toolWebSearch.md) | Tool Web Search 网络搜索工具 |
| [help/zh/nodes/webhookTrigger.md](./help/zh/nodes/webhookTrigger.md) | Webhook 触发器节点 |

### ADR 架构决策

| 文件 | 摘要 |
|------|------|
| [adr-langchain.md](./adr-langchain.md) | ADR-001：LangChain / LangGraph AI 运行时 |
| [adr-deployment.md](./adr-deployment.md) | ADR-002：Lite / Standard / Plus 部署档位 |
| [adr-module-boundaries.md](./adr-module-boundaries.md) | ADR-003：模块与进程边界 |
| [adr-expression-sandbox.md](./adr-expression-sandbox.md) | ADR-004：表达式与 Code 沙箱 |
| [adr-execution-data.md](./adr-execution-data.md) | ADR-005：执行持久化与数据模型 |
| [adr-node-runner.md](./adr-node-runner.md) | ADR-006：Node Runner 跨平台执行 |

### 契约与规范

| 文件 | 摘要 |
|------|------|
| [ac-api-mapping.md](./ac-api-mapping.md) | 验收标准（AC）与 API 路径映射（`pnpm lint:ac-mapping`） |
| [node-plugin-spec.md](./node-plugin-spec.md) | 节点插件开发规范 |
| [openapi.yaml](./openapi.yaml) | REST API v1.0-core 契约草案（OpenAPI） |
| [schemas/workflow-definition.v1.schema.json](./schemas/workflow-definition.v1.schema.json) | 工作流定义 JSON Schema |

### 产品与 UX

| 文件 | 摘要 |
|------|------|
| [ux-ui-design.md](./ux-ui-design.md) | UX/UI 设计规范（表单、滚动条、布局） |
| [settings-page-layout.md](./settings-page-layout.md) | 设置页布局编码规范 |
| [loading-ui.md](./loading-ui.md) | Web 加载态（`LoadingHost`、空态防闪空） |
| [ux-v1.0-checklist.md](./ux-v1.0-checklist.md) | v1.0-core / plus UI 门禁勾选表 |
| [error-codes.md](./error-codes.md) | 用户可见错误码一览 |
| [code-node-guide.md](./code-node-guide.md) | Code 节点开发者指南 |
| [expression-guide.md](./expression-guide.md) | 表达式引擎使用指南 |
| [credentials-design.md](./credentials-design.md) | 凭证类型与存储设计 |
| [binary-type-support-analysis.md](./binary-type-support-analysis.md) | Binary 类型支持差距分析 |
| [chat-completion-smoke.md](./chat-completion-smoke.md) | Chat Completion 冒烟验证说明 |
| [deployment-cli-cheatsheet.md](./deployment-cli-cheatsheet.md) | 部署 CLI 速查表 |
| [standard-lite-deployment-implementation-plan.md](./standard-lite-deployment-implementation-plan.md) | Standard / Lite 部署实现计划 |
| [queue-concurrency-optimization-summary.md](./queue-concurrency-optimization-summary.md) | 队列并发优化总结 |

### Runner

| 文件 | 摘要 |
|------|------|
| [runner-agent-quickstart.md](./runner-agent-quickstart.md) | `rxwf-runner` 注册与启动快速入门 |
| [runner-extension-packaging-deployment.md](./runner-extension-packaging-deployment.md) | Runner 扩展、打包与部署完整流程 |
| [runner-sdk.md](./runner-sdk.md) | Runner 第三方扩展 SDK |
| [changelog/runner-v1.1.md](./changelog/runner-v1.1.md) | Runner v1.1 变更与部署注意事项 |

### 发布说明

| 文件 | 摘要 |
|------|------|
| [RELEASE-v1.0.md](./RELEASE-v1.0.md) | v1.0 正式发布说明 |
| [RELEASE-v1.1-agent.md](./RELEASE-v1.1-agent.md) | v1.1 Agent 能力发布说明 |
| [RELEASE-v1.2-p4c-agent.md](./RELEASE-v1.2-p4c-agent.md) | v1.2 P4-C Agent 里程碑发布 |
| [RELEASE-v1.3-crewai.md](./RELEASE-v1.3-crewai.md) | v1.3 CrewAI 集成发布 |
| [RELEASE-v1.3-group-chat.md](./RELEASE-v1.3-group-chat.md) | v1.3 Group Chat 发布 |
| [RELEASE-skill-p1.md](./RELEASE-skill-p1.md) | Skill 平台 P1 发布 |
| [RELEASE-skill-p3.md](./RELEASE-skill-p3.md) | Skill 平台 P3 发布 |
| [RELEASE-skill-p4.md](./RELEASE-skill-p4.md) | Skill 平台 P4 发布 |
| [UPGRADE-rx-workflow.md](./UPGRADE-rx-workflow.md) | 版本升级与迁移指南 |

### 工作流（dev-pipeline）

| 文件 | 摘要 |
|------|------|
| [workflow/plan.md](./workflow/plan.md) | v2.0 补齐实施计划与 Milestone 划分 |
| [workflow/tasks.md](./workflow/tasks.md) | 开发任务索引（T-xxx 链接至 tasks/） |

### Superpowers 设计规格

| 文件 | 摘要 |
|------|------|
| [superpowers/specs/2026-05-20-v1-implementation-design.md](./superpowers/specs/2026-05-20-v1-implementation-design.md) | v1.0 实现设计（Monorepo、8787 端口、Node Runner） |
| [superpowers/specs/2026-05-22-n8n-first-completion-design.md](./superpowers/specs/2026-05-22-n8n-first-completion-design.md) | n8n 体验优先补全设计（方案三） |
| [superpowers/specs/2026-05-23-agent-canvas-design.md](./superpowers/specs/2026-05-23-agent-canvas-design.md) | Agent 画布设计 |
| [superpowers/specs/2026-05-23-agent-rag-design.md](./superpowers/specs/2026-05-23-agent-rag-design.md) | Agent RAG 设计 |
| [superpowers/specs/2026-05-23-chat-completion-design.md](./superpowers/specs/2026-05-23-chat-completion-design.md) | Chat Completion 设计 |
| [superpowers/specs/2026-05-23-crew-hierarchical-design.md](./superpowers/specs/2026-05-23-crew-hierarchical-design.md) | Crew 层级编排设计 |
| [superpowers/specs/2026-05-23-crew-sequential-design.md](./superpowers/specs/2026-05-23-crew-sequential-design.md) | Crew 顺序编排设计 |
| [superpowers/specs/2026-05-23-crew-supervisor-design.md](./superpowers/specs/2026-05-23-crew-supervisor-design.md) | Crew Supervisor 设计 |
| [superpowers/specs/2026-05-23-edit-publish-mode-design.md](./superpowers/specs/2026-05-23-edit-publish-mode-design.md) | 编辑/发布模式设计 |
| [superpowers/specs/2026-05-23-knowledge-base-design.md](./superpowers/specs/2026-05-23-knowledge-base-design.md) | 知识库设计 |
| [superpowers/specs/2026-05-23-langsmith-tracing-design.md](./superpowers/specs/2026-05-23-langsmith-tracing-design.md) | LangSmith 追踪设计 |
| [superpowers/specs/2026-05-23-login-password-reset-design.md](./superpowers/specs/2026-05-23-login-password-reset-design.md) | 登录与密码重置设计 |
| [superpowers/specs/2026-05-23-node-editor-modal-design.md](./superpowers/specs/2026-05-23-node-editor-modal-design.md) | 节点编辑器弹窗设计 |
| [superpowers/specs/2026-05-23-p4-c-ai-milestone-roadmap.md](./superpowers/specs/2026-05-23-p4-c-ai-milestone-roadmap.md) | P4-C AI 里程碑路线图 |
| [superpowers/specs/2026-05-23-user-role-management-design.md](./superpowers/specs/2026-05-23-user-role-management-design.md) | 用户角色管理设计 |
| [superpowers/specs/2026-05-23-workflow-agent-node-design.md](./superpowers/specs/2026-05-23-workflow-agent-node-design.md) | Workflow Agent 节点设计 |
| [superpowers/specs/2026-05-24-credential-types-design.md](./superpowers/specs/2026-05-24-credential-types-design.md) | 凭证类型设计 |
| [superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md](./superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md) | 沙箱 Piscina 超时设计 |
| [superpowers/specs/2026-05-28-standard-lite-deployment-design.md](./superpowers/specs/2026-05-28-standard-lite-deployment-design.md) | Standard / Lite 部署设计 |
| [superpowers/specs/2026-05-29-crewai-integration-design.md](./superpowers/specs/2026-05-29-crewai-integration-design.md) | CrewAI 集成设计 |
| [superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md](./superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md) | Runner v1.1 WebSocket 设计 |
| [superpowers/specs/2026-05-30-group-chat-design.md](./superpowers/specs/2026-05-30-group-chat-design.md) | Group Chat 设计 |
| [superpowers/specs/2026-05-30-rx-workflow-rename-design.md](./superpowers/specs/2026-05-30-rx-workflow-rename-design.md) | 项目重命名设计 |
| [superpowers/specs/2026-05-31-skill-integration-design.md](./superpowers/specs/2026-05-31-skill-integration-design.md) | Skill 集成设计 |
| [superpowers/specs/2026-05-31-skill-platform-parity-matrix.md](./superpowers/specs/2026-05-31-skill-platform-parity-matrix.md) | Skill 平台 parity 矩阵 |
| [superpowers/specs/2026-06-03-expression-implicit-return-design.md](./superpowers/specs/2026-06-03-expression-implicit-return-design.md) | 表达式隐式 return 设计 |
| [superpowers/specs/2026-06-03-expression-static-validation-design.md](./superpowers/specs/2026-06-03-expression-static-validation-design.md) | 表达式静态校验设计 |
| [superpowers/specs/2026-06-03-js-expression-globals-design.md](./superpowers/specs/2026-06-03-js-expression-globals-design.md) | JS 表达式 globals 设计 |
| [superpowers/specs/2026-06-03-skill-run-simplify-design.md](./superpowers/specs/2026-06-03-skill-run-simplify-design.md) | Skill Run 简化设计 |
| [superpowers/specs/2026-06-03-switch-dynamic-branches-design.md](./superpowers/specs/2026-06-03-switch-dynamic-branches-design.md) | Switch 动态分支设计 |
| [superpowers/specs/2026-06-03-workflow-binary-support-design.md](./superpowers/specs/2026-06-03-workflow-binary-support-design.md) | 工作流 Binary 支持设计 |
| [superpowers/specs/2026-06-04-node-input-panel-n8n-design.md](./superpowers/specs/2026-06-04-node-input-panel-n8n-design.md) | 节点 INPUT 面板 n8n 对齐设计 |
| [superpowers/specs/2026-06-05-help-center-design.md](./superpowers/specs/2026-06-05-help-center-design.md) | 帮助中心设计 |
| [superpowers/specs/2026-06-06-subworkflow-trigger-design.md](./superpowers/specs/2026-06-06-subworkflow-trigger-design.md) | 子工作流触发器设计 |

### Superpowers 实施计划

| 文件 | 摘要 |
|------|------|
| [superpowers/plans/2026-05-20-v1-implementation.md](./superpowers/plans/2026-05-20-v1-implementation.md) | v1.0 实施计划（M0–M5，23 Tasks） |
| [superpowers/plans/2026-05-22-n8n-first-completion.md](./superpowers/plans/2026-05-22-n8n-first-completion.md) | n8n 体验优先补全计划（P1–P3） |
| [superpowers/plans/2026-05-23-chat-completion.md](./superpowers/plans/2026-05-23-chat-completion.md) | Chat Completion 实施计划 |
| [superpowers/plans/2026-05-23-login-password-reset.md](./superpowers/plans/2026-05-23-login-password-reset.md) | 登录密码重置实施计划 |
| [superpowers/plans/2026-05-23-node-editor-modal.md](./superpowers/plans/2026-05-23-node-editor-modal.md) | 节点编辑器弹窗实施计划 |
| [superpowers/plans/2026-05-23-user-role-management.md](./superpowers/plans/2026-05-23-user-role-management.md) | 用户角色管理实施计划 |
| [superpowers/plans/2026-05-23-workflow-agent-node-strict-closeout.md](./superpowers/plans/2026-05-23-workflow-agent-node-strict-closeout.md) | Workflow Agent 节点收尾计划 |
| [superpowers/plans/2026-05-23-workflow-agent-node.md](./superpowers/plans/2026-05-23-workflow-agent-node.md) | Workflow Agent 节点实施计划 |
| [superpowers/plans/2026-05-23-workflow-tool-expose-as-tool.md](./superpowers/plans/2026-05-23-workflow-tool-expose-as-tool.md) | 工作流暴露为工具实施计划 |
| [superpowers/plans/2026-05-24-credential-types.md](./superpowers/plans/2026-05-24-credential-types.md) | 凭证类型实施计划 |
| [superpowers/plans/2026-05-28-sandbox-piscina-timeout.md](./superpowers/plans/2026-05-28-sandbox-piscina-timeout.md) | 沙箱 Piscina 超时实施计划 |
| [superpowers/plans/2026-05-28-standard-lite-deployment.md](./superpowers/plans/2026-05-28-standard-lite-deployment.md) | Standard / Lite 部署实施计划 |
| [superpowers/plans/2026-05-29-crewai-integration.md](./superpowers/plans/2026-05-29-crewai-integration.md) | CrewAI 集成实施计划 |
| [superpowers/plans/2026-05-29-runner-v1.1-websocket.md](./superpowers/plans/2026-05-29-runner-v1.1-websocket.md) | Runner v1.1 WebSocket 实施计划 |
| [superpowers/plans/2026-05-30-group-chat.md](./superpowers/plans/2026-05-30-group-chat.md) | Group Chat 实施计划 |
| [superpowers/plans/2026-05-30-rx-workflow-rename.md](./superpowers/plans/2026-05-30-rx-workflow-rename.md) | 项目重命名实施计划 |
| [superpowers/plans/2026-05-31-skill-integration.md](./superpowers/plans/2026-05-31-skill-integration.md) | Skill 集成实施计划 |
| [superpowers/plans/2026-06-03-expression-implicit-return.md](./superpowers/plans/2026-06-03-expression-implicit-return.md) | 表达式隐式 return 实施计划 |
| [superpowers/plans/2026-06-03-expression-static-validation.md](./superpowers/plans/2026-06-03-expression-static-validation.md) | 表达式静态校验实施计划 |
| [superpowers/plans/2026-06-03-js-expression-engine.md](./superpowers/plans/2026-06-03-js-expression-engine.md) | JS 表达式引擎实施计划 |
| [superpowers/plans/2026-06-03-workflow-binary-support.md](./superpowers/plans/2026-06-03-workflow-binary-support.md) | 工作流 Binary 支持实施计划 |
| [superpowers/plans/2026-06-04-node-input-panel-n8n.md](./superpowers/plans/2026-06-04-node-input-panel-n8n.md) | 节点 INPUT 面板 n8n 对齐计划 |
| [superpowers/plans/2026-06-05-help-center.md](./superpowers/plans/2026-06-05-help-center.md) | 帮助中心实施计划 |
| [superpowers/plans/2026-06-06-skill-run-simplify.md](./superpowers/plans/2026-06-06-skill-run-simplify.md) | Skill Run 简化实施计划 |
| [superpowers/fixtures/workflows/antigravity-startcycle.source.md](./superpowers/fixtures/workflows/antigravity-startcycle.source.md) | Antigravity 工作流 fixture 源说明 |

### v1.0 发布分期（摘要）

| 分期 | 范围 |
|------|------|
| **v1.0-core** | Lite、P0 节点、执行快照、MCP Server 基础、内置 i18n/主题、Webhook 幂等、Runner Schema + Embedded |
| **v1.0-plus** | MCP Client、LLM/Chat、插件、Admin 扩展语言/主题 |
| **v1.1** | `rxwf-runner` 三平台 Agent、远程派发、Runner 注册/心跳（见 FR-23） |

详见 [spec.md](./spec.md) §5.1、§5.1.1。

## 维护规则

1. **INDEX 登记**：新增、移动或删除 `docs/**/*.md` 时，须在 [INDEX.md](./INDEX.md) 的 `entries` 中同步登记或移除；help 新增 nodeType 时须含 `nodeType` 字段（见 architecture §10.3）。
2. **CI 门禁**：PR 须通过 `pnpm lint:docs-index`；未登记文档变更将阻塞合并（FR-04 / AC-004）。
3. **同 PR 同步**：功能变更须同 PR 更新 INDEX、相关 help/spec 及本页分类目录一行摘要（FR-15）。
4. **子目录 README**：`docs/architecture/`、`docs/requirements/`、`docs/help/`、`docs/test/`、`docs/workflow/` 等子目录 README 须链回 [INDEX.md](./INDEX.md)（AC-003，T-007）。
5. **本页维护**：分类与摘要须与 INDEX 分类一致；M-6 最终扫描时 INDEX 条目数须与仓库 `.md` 文档集合一致（排除模板与自动生成产物）。
6. **权威边界**：产品行为以 [spec.md](./spec.md) v2.0 为准；本轮 Milestone 范围以 [requirements/PRD.md](./requirements/PRD.md) 为准。

## 本地运行（v1.0）

```bash
pnpm install
pnpm dev        # API (8787) + Web (5173) 并行启动；Vite 不阻塞等待 API

pnpm dev:wait   # Web 等 API `/api/health` 就绪后再启动 Vite

pnpm rxwf start --with-web   # 同上 predev + API + Web；可走 --lite / --standard 与 Docker 依赖编排

pnpm rxwf start              # 仅 API；Web 需另开终端或加 --with-web

若登录报 **`API not ready`** 或 **`Route POST:/api/auth/login not found`**，说明 8787 上 API 未就绪或仍是旧进程：先停掉所有 `node`/`tsx` 开发进程，再执行一次 `pnpm dev`。启动成功后终端应看到 `rx-workflow API http://localhost:8787` 与 `auth: POST /api/auth/setup | /api/auth/login`。
```

**生产部署**不使用 `rxwf start`，请用 [`deploy/compose.lite.yaml`](../deploy/compose.lite.yaml) 或 [`deploy/compose.standard.yaml`](../deploy/compose.standard.yaml)。部署细节与 **Runner v1.1 单实例约束**见 [`deploy/README.md`](../deploy/README.md)、[`changelog/runner-v1.1.md`](./changelog/runner-v1.1.md)。

也可分别启动：

```bash
pnpm --filter @rxwf/api dev
pnpm --filter @rxwf/web dev
```

浏览器打开 http://localhost:5173：**首次访问**在页面创建管理员（邮箱 + 密码，至少 8 位），之后用该账户登录；会话通过 Cookie 维持，无需填写 API Key。

**没有默认账号/密码。** 仅首次无用户时可创建管理员；密码由您自己设定（至少 8 位）。

本地库若被测试污染（例如只有 `admin@example.com` 而您用别的邮箱登录），可重置后重建：

```bash
pnpm reset:data
pnpm dev
```

再用您的邮箱在「创建管理员」页注册。若登录报 HTTP 500，请先 `pnpm dev` 并确认终端有 `auth: POST .../api/auth/login`；仍失败则执行 `pnpm --filter @rxwf/identity build` 后重启。

Docker Lite 单容器：

```bash
docker compose -f deploy/compose.lite.yaml up -d --build
curl -sf http://localhost:8787/api/ready
```

Standard 编排（Postgres + Redis + API）：

```bash
docker compose -f deploy/compose.standard.yaml up -d --build
curl -sf http://localhost:8787/api/ready   # 含 postgres / redis / queue 探针
```

环境变量（Standard）：

| 变量 | 说明 |
|------|------|
| `RXWF_DEPLOY_PROFILE=standard` | 启用 PG 工作流/执行/环境变量 + BullMQ 队列 |
| `RXWF_DATABASE_URL` | PostgreSQL 连接串（compose 已设） |
| `RXWF_REDIS_URL` | Redis 连接串（BullMQ） |
| `RXWF_BULLMQ_EXECUTION_CONCURRENCY` | Execution BullMQ worker 并发（默认 `4`） |
| `RXWF_BULLMQ_KNOWLEDGE_CONCURRENCY` | Knowledge BullMQ worker 并发（默认 `2`） |
| `RXWF_LITE_JOB_CONCURRENCY` | Lite 本地 job processor 并发（默认 `4`） |
| `RXWF_JOB_PROCESSOR_METRICS` | 设为 `true` 时输出 Lite job 批次指标与 loop 重入跳过日志 |
| `SANDBOX_CODE_TIMEOUT_MS` | Code 沙箱默认超时（毫秒）；在「设置 → 环境变量」配置，`-1` 表示不超时 |
| `RXWF_SANDBOX_POOL_MIN_THREADS` | Piscina 最小线程数（默认 `1`） |
| `RXWF_SANDBOX_POOL_MAX_THREADS` | Piscina 最大线程数（默认 `max(2, cpu-1)`） |
| `RXWF_SANDBOX_POOL_IDLE_TIMEOUT_MS` | Piscina 空闲线程回收（默认 `30000`） |
| `RXWF_SANDBOX_POOL_QUEUE_LIMIT` | Piscina 队列上限；`0` 表示不限制 |
| `RXWF_DATA_DIR` | Lite SQLite 仍用于认证、Runner、偏好等 |

并发开启后，任务完成先后不保证与入队顺序一致；如需降级，可将上述并发变量调低到 `1`。

从 Lite SQLite 迁移到 PostgreSQL：

```bash
# 先启动 Postgres，并设置 RXWF_DATABASE_URL
pnpm rxwf:migrate              # 迁移 users/workflows/versions/credentials/env_vars
pnpm rxwf:migrate --dry-run    # 仅统计，不写库
node scripts/rxwf-migrate.mjs --with-executions   # 可选：含历史执行记录
```

发布说明：[RELEASE-v1.0.md](./RELEASE-v1.0.md)  
集成测试：[../tests/integration/README.md](../tests/integration/README.md)
