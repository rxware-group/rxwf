# Spec-Reviewer v2.0 差距矩阵

**流程**：`.cursor/agents/spec-reviewer.md`  
**审阅日期**：2026-06-18  
**范围**：`docs/spec.md` v1.11.0、`docs/requirements/PRD.md`、`docs/superpowers/specs/*.md`（34 份）× 代码库 spot-check  
**结论**：⚠️ v2.0 交付范围内存在大量 **partial / missing** 项；半实现与文档/E2E 漂移为 P0 风险

---

## 摘要

对照 PRD 与 superpowers 设计 spec，当前代码库已具备 DAG 编辑器、执行引擎、Plus 轨 Agent/Skill 骨架及多项节点执行器，但 **v2.0 差距审计基础设施尚未建立**（INDEX、lint、matrix、完整 audit 表待 M-1 后续任务）。半实现项集中在 **skillRun 子工具、credential-types UI/HTTP 注入、switch 动态分支端到端、工作流 ACL UI 门禁、Binary P2–P4、Group Chat MVP 验收、帮助 13/45、E2E 2 spec**。本矩阵为 T-008 完整 `spec-gap-audit.md` 的 spec-reviewer 输入真相源。

---

## v2.0 差距矩阵

| GAP-ID | 类别 | Spec/FR 引用 | Spec 状态 | 代码现状 | 差距 | 目标 M | matrix 行 ID |
|--------|------|--------------|-----------|----------|------|--------|--------------|
| GAP-001 | platform | FR-01 / AC-001 `docs/INDEX.md` | PRD 要求 | 文件不存在 | missing | M-1 | DOC-INDEX |
| GAP-002 | platform | FR-01 / AC-002 `docs/README.md` 分类与维护规则 | PRD 要求 | 有 README 但缺分类/维护节 | partial | M-1 | DOC-README |
| GAP-003 | platform | FR-04 / AC-004 `lint-docs-index` CI | 架构 §10.3 | 脚本不存在 | missing | M-1 | DOC-LINT |
| GAP-004 | platform | FR-03 / AC-007 `e2e-coverage-matrix.md` | PRD 要求 | 文件不存在 | missing | M-1 | E2E-MATRIX |
| GAP-005 | platform | FR-14 / AC-073 E2E compose 生命周期 | 架构 §6.3 | `global-setup.ts` 仅 auth 清理 | partial | M-1 | E2E-COMPOSE |
| GAP-006 | platform | FR-13 / AC-011 Playwright 全量 E2E | plan E2E 策略 | 仅 `workflow-manual-node.spec.ts` 等 2 条 | partial | M-1→M-6 | E2E-SUITE |
| GAP-007 | semi-impl | FR-05 / AC-013 skillRun write/grep/web_search | `2026-05-31-skill-integration-design.md` Approved | `skill-runtime` builtin-tools + `agent-satellite-tools` 有骨架；卫星 toolWrite/toolGrep/toolWebSearch 集成/E2E 未闭环 | partial | M-2 | CAP-SKILLRUN |
| GAP-008 | semi-impl | FR-05 / AC-014 工作流 ACL Owner/Editor/Viewer | `2026-05-23-user-role-management-design.md` | `identity/workflow-access-service` + API `/collaborators` 存在；UI `WorkflowCollaboratorsPanel` 待 E2E 门禁 | partial | M-2 | CAP-WF-ACL |
| GAP-009 | semi-impl | FR-05 / AC-015 credential-types 注册表 | `2026-05-24-credential-types-design.md` Approved | `packages/credential` 4 通用类型 + registry；HTTP 节点 credentialId 注入、Settings 动态表单未验收 | partial | M-2 | CAP-CRED |
| GAP-010 | semi-impl | FR-05 / AC-016 switch 动态分支 | `2026-06-03-switch-dynamic-branches-design.md` Draft | `parseSwitchBranches` + 执行器 + `SwitchBranchesPanel` 已有；spec Draft、保存校验/E2E 未 green | partial | M-2 | CAP-SWITCH |
| GAP-011 | feature | FR-10 / AC-044 Group Chat MVP | `2026-05-30-group-chat-design.md` | `group-chat.ts` native + langgraph 路径；UserProxy/HITL、Plus E2E 场景待验收 | partial | M-4 | CAP-GROUPCHAT |
| GAP-012 | feature | FR-11 / AC-045 Binary 全链路 | `2026-06-03-workflow-binary-support-design.md` Accepted | 表达式 `$binary` + Lite blob 单测；HTTP/Webhook/Set/Code 生产者 P2–P4 未交付 | partial | M-5 | CAP-BINARY |
| GAP-013 | feature | FR-06～08 / AC-046～048 帮助全覆盖 | `2026-06-05-help-center-design.md` | `docs/help/zh/nodes/` 13 篇；`NODE_HELP_PATH` 14/45 映射 | partial | M-6 | HELP-ALL |
| GAP-014 | feature | FR-09 / AC-049 全节点审查矩阵 | PRD §3.1 45 nodeType | 执行器 registry 大体齐全；Docker 矩阵/E2E 每 type ≥1 未建立 | partial | M-3 | NODE-MATRIX |
| GAP-015 | spec | `2026-05-22-n8n-first-completion-design.md` P1 UX | Approved | `ux-v1.0-checklist.md` P0 多项未勾选 | partial | M-3 | UX-P0 |
| GAP-016 | spec | `2026-05-23-edit-publish-mode-design.md` | Approved | 编辑/发布模式 API 与 UI 部分存在；完整 AC 待核对 | partial | M-3 | CAP-PUBLISH |
| GAP-017 | spec | `2026-05-23-knowledge-base-design.md` RAG 流水线 | Approved | KB API + `ragRetrieve`/`ragAnswer` 节点；文档解析/同步源 v2.0 项缺失 | partial | M-3 | CAP-KB |
| GAP-018 | spec | `2026-05-23-chat-completion-design.md` AI Chat | Approved | Chat SSE + 设置页；长期记忆/多模型对比 v2.0 未做 | partial | M-4 | CAP-CHAT |
| GAP-019 | spec | `2026-05-23-agent-rag-design.md` Agent RAG | Approved | `aiAgent` + 卫星连线；评测/追踪导出 v2.0 未做 | partial | M-4 | CAP-AGENT |
| GAP-020 | spec | `2026-05-29-crewai-integration-design.md` Crew 三模式 | Approved | `crewSequential/Hierarchical/Supervisor` 执行器 + Sidecar 集成测；Plus E2E 矩阵待补 | partial | M-3 | CAP-CREW |
| GAP-021 | spec | `2026-05-29-runner-v1.1-websocket-design.md` 远程 Runner WS | Approved v1.1 | Embedded Runner 为主；WebSocket 远程协议未交付 | missing | M-6+ | CAP-RUNNER-WS |
| GAP-022 | spec | `2026-06-03-expression-static-validation-design.md` | Approved | 部分表达式校验；编辑器静态 lint 未全覆盖 | partial | M-3 | CAP-EXPR-VAL |
| GAP-023 | spec | `2026-06-03-expression-implicit-return-design.md` | Approved | Code 节点 sandbox 部分支持；implicit return UX 待 E2E | partial | M-3 | CAP-CODE |
| GAP-024 | spec | `2026-06-03-js-expression-globals-design.md` | **Implemented** | `$json`/`$binary`/`$nodes` globals 已落地 | done | — | CAP-EXPR-GLOBAL |
| GAP-025 | spec | `2026-06-03-skill-run-simplify-design.md` | Approved | `skillRun` 执行器 + registry 路径；Tool 卫星简化 AC 待 M-2 验收 | partial | M-2 | CAP-SKILLRUN |
| GAP-026 | spec | `2026-06-04-node-input-panel-n8n-design.md` | Approved | `NodeEditorParamsPane` 存在；n8n 式输入面板 parity 未全量 | partial | M-3 | UX-INPUT |
| GAP-027 | spec | `2026-06-06-subworkflow-trigger-design.md` | **Implemented** | `subworkflowTrigger` 节点 + executor 已注册 | done | — | NODE-subworkflowTrigger |
| GAP-028 | node-help | FR-06 `manualTrigger` 帮助 | PRD | 无 help 文件/registry | missing | M-6 | HELP-manualTrigger |
| GAP-029 | node-help | FR-06 `scheduleTrigger` 帮助 | PRD | 无 help 文件/registry | missing | M-6 | HELP-scheduleTrigger |
| GAP-030 | node-help | FR-06 `errorTrigger` 帮助 | PRD | 无 help 文件/registry | missing | M-6 | HELP-errorTrigger |
| GAP-031 | node-help | FR-06 `httpRequest` 帮助 | PRD | registry 有路径但 md 缺失 | partial | M-6 | HELP-httpRequest |
| GAP-032 | node-help | FR-06 `merge`/`splitInBatches`/`humanApproval` 等 logic 节点 | PRD | 均无独立 help | missing | M-6 | HELP-LOGIC |
| GAP-033 | node-help | FR-06 Agent 卫星 toolWrite/toolGrep/toolShell 等 | PRD | 无 help；仅 toolRead/toolWebSearch 部分有 | missing | M-6 | HELP-AGENT-TOOLS |
| GAP-034 | node-e2e | FR-18 每 nodeType ≥1 E2E | PRD M-3 | 仅 manual 节点 smoke | missing | M-3 | E2E-NODES |
| GAP-035 | node-e2e | FR-08 帮助按钮新 Tab 跳转 E2E | help-center spec | 无 help-route E2E spec | missing | M-1 | E2E-HELP-ROUTE |
| GAP-036 | platform | FR-12 / AC-010 M-1 acceptance | PRD | `M-1-acceptance.md` 不存在 | missing | M-1 | DOC-M1-ACC |
| GAP-037 | spec | `2026-05-28-standard-lite-deployment-design.md` Standard 真切换 | Approved | `providers/standard` 健康检查为主；PG/BullMQ 业务切换 partial | partial | M-3 | CAP-STD |
| GAP-038 | spec | `2026-05-23-langsmith-tracing-design.md` | Approved | 追踪 hooks 部分；LangSmith/OTel 导出 v2.0 未做 | partial | M-6 | CAP-TRACE |
| GAP-039 | spec | `2026-05-31-skill-platform-parity-matrix.md` P2 Rules/Subagent | Draft | P1 skillRun 为主；RuleResolver/Subagent P2 项 open | partial | M-6 | CAP-SKILL-P2 |
| GAP-040 | spec | spec.md v2.0 SSO/SAML/插件市场 | v2.0 远期 | 未实现（符合刻意不做边界） | deferred | v2.0+ | CAP-ENT |

---

## 与代码库核对（spot-check 摘要）

| Spec 声称 | 代码事实 | 判定 |
|-----------|----------|------|
| skillRun 需 aiChatModel 卫星 | `packages/node-runner/src/executors/skill-run.ts` 抛 E1043 | ✅ 一致 |
| switch 动态 `branches[]` | `packages/workflow/src/switch-branches.ts` + `SwitchBranchesPanel.tsx` | ⚠️ 前后端有实现，spec 仍 Draft |
| 工作流 ACL API | `apps/api/src/routes/workflows.ts` collaborators 路由 + `workflows-acl.test.ts` | ⚠️ API 有，E2E/UI 门禁待 M-2 |
| credential 4 通用类型 | `packages/credential/src/types/register-generic-types.ts` | ⚠️ Phase B 部分落地 |
| Binary blob 持久化 P1 | `packages/providers/lite/src/binary-blob-service.ts` 单测 green | ⚠️ P1 局部；节点透传 P2+ 缺失 |
| Group Chat round-robin/orchestrator | `packages/node-runner/src/executors/group-chat.ts` + helpers | ⚠️ 运行时存在，MVP E2E 待 M-4 |
| 45 nodeType 帮助一一映射 | `help-registry.ts` 14 项；help md 13 篇 | ❌ 缺口 31+ |
| subworkflowTrigger Implemented | executor 注册 + spec 标记 Implemented | ✅ 一致 |

---

## 建议实现顺序（供 T-008 / Milestone 编排）

1. **M-1**：INDEX、README、lint、matrix、audit 引用闭环（本任务 GAP-001～006、035、036）
2. **M-2**：半实现四项 skillRun/ACL/credential/switch（GAP-007～010、025）
3. **M-3**：全节点审查 + n8n UX P0（GAP-014～017、022～023、026、034、037）
4. **M-4**：Group Chat MVP E2E（GAP-011、018～019）
5. **M-5**：Binary 方案确认后 P2–P4（GAP-012）
6. **M-6**：帮助 45/45 + matrix 100%（GAP-013、028～033、038～039）

---

## 开放问题（需产品/作者确认）

- OQ-005：Binary P2–P4 与 n8n 对标方案人工确认前不得启动 M-5 实现（GAP-012）
- `2026-06-03-switch-dynamic-branches-design.md` 仍为 Draft — 是否升格 Approved 以匹配现有代码（GAP-010）
- GAP-040 企业级 v2.0 远期项：本轮 PRD OQ-006 禁止 exclude，但 spec.md 刻意不做项是否写入 audit 为 `deferred` 由 T-008 决选

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-18 | 1.0 | T-003 spec-reviewer 初版差距矩阵（40 行） |
