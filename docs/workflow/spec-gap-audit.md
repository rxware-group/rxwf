# v2.0 差距审计（spec-gap-audit）

> **状态**：M-6 — 帮助全覆盖与 matrix 100%；`audit_status` 无 open（T-167）。

---

## Spec-Reviewer 产出引用（AC-009）

| 字段 | 值 |
|------|-----|
| **产出物** | [`spec-gap-reviewer-output.md`](./spec-gap-reviewer-output.md) |
| **流程** | [`.cursor/agents/spec-reviewer.md`](../../.cursor/agents/spec-reviewer.md) |
| **任务** | T-003（M-1 Wave 1） |
| **审阅日期** | 2026-06-18 |
| **范围** | `docs/spec.md` v1.11.0、`docs/requirements/PRD.md`、`docs/superpowers/specs/*.md`（34 份）× 代码库 spot-check |
| **矩阵行数** | 40（GAP-001～GAP-040） |
| **结论摘要** | v2.0 交付范围内以 **partial** 为主；M-1 文档/E2E 基础设施、M-2 半实现四项、M-6 帮助覆盖为 P0 缺口 |

### 追溯

- **FR-02**：v2.0 能力 × 实现状态 × Milestone × E2E 行号 — 见下表
- **AC-005**：全量 40 行差距项 ✅
- **AC-006**：每行含 spec 引用、现状、目标 M、E2E matrix 行 ID ✅
- **AC-009**：spec-reviewer 流程产出已纳入本审计引用 ✅

---

## 列定义

| 列 | 说明 |
| --- | --- |
| gap_id | 唯一差距 ID（GAP-001～GAP-040） |
| category | platform / semi-impl / feature / spec / node-help / node-e2e |
| spec_fr | Spec / FR / AC 引用 |
| code_status | 代码库现状（spot-check 摘要） |
| gap | missing / partial / done / deferred |
| target_m | 目标 Milestone（`M-N`、`M-N→M-M`、`—`、`v2.0+`） |
| e2e_row_id | [`e2e-coverage-matrix.md`](../test/e2e-coverage-matrix.md) 行 ID |
| audit_status | open / done / deferred（M-6 要求无 open） |

---

## 完整差距表

| gap_id | category | spec_fr | code_status | gap | target_m | e2e_row_id | audit_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-001 | platform | FR-01 / AC-001 `docs/INDEX.md` | INDEX.md + sync-docs-index 全量登记（T-166） | done | M-1→M-6 | E2E-P-017 | done |
| GAP-002 | platform | FR-01 / AC-002 `docs/README.md` 分类与维护规则 | README 分类目录 + 维护规则节 | done | M-1 | E2E-P-017 | done |
| GAP-003 | platform | FR-04 / AC-004 `lint-docs-index` CI | `scripts/lint-docs-index.mjs` green（T-166） | done | M-1→M-6 | E2E-P-017 | done |
| GAP-004 | platform | FR-03 / AC-007 `e2e-coverage-matrix.md` | matrix 64 行 100% covered（T-165 `--require-full`） | done | M-1→M-6 | E2E-P-017 | done |
| GAP-005 | platform | FR-14 / AC-073 E2E compose 生命周期 | `global-setup.ts` standard/plus 轨 `cmdUp` | done | M-1 | E2E-P-003 | done |
| GAP-006 | platform | FR-13 / AC-011 Playwright 全量 E2E | 57+ spec；lite platform + 45 help + 46 nodeType | done | M-1→M-6 | E2E-P-003 | done |
| GAP-007 | semi-impl | FR-05 / AC-013 skillRun write/grep/web_search | `skillRun` 执行器 + 卫星 toolWrite/toolGrep/toolWebSearch E2E 闭环（T-028 `skill-run-tools.spec.ts`） | done | M-2 | E2E-N-skillRun | done |
| GAP-008 | semi-impl | FR-05 / AC-014 工作流 ACL Owner/Editor/Viewer | ACL API + `WorkflowCollaboratorsPanel` + E2E 门禁（T-029 `workflow-acl.spec.ts`） | done | M-2 | E2E-P-018 | done |
| GAP-009 | semi-impl | FR-05 / AC-015 credential-types 注册表 | credential registry + Settings 动态表单 + HTTP credentialId 注入 E2E（T-030 `credential-types.spec.ts`） | done | M-2 | E2E-P-011 | done |
| GAP-010 | semi-impl | FR-05 / AC-016 switch 动态分支 | Switch 动态分支 UI + 多分支路由 E2E green（T-030 `switch-dynamic.spec.ts`） | done | M-2 | E2E-N-switch | done |
| GAP-011 | feature | FR-10 / AC-044 Group Chat MVP | round-robin/orchestrator 执行器 + UserProxy HITL resume（T-087～T-093）；Plus E2E round-robin + orchestrator/UserProxy（T-094/T-095）；matrix E2E-N-groupChat covered | done | M-4 | E2E-N-groupChat | done |
| GAP-012 | feature | FR-11 / AC-045 Binary 全链路 | OPT-01 P1～P4：WorkflowItem.binary 透传、Lite blob、HTTP 响应→binary、Webhook multipart、Set/IF `$binary`、Merge combineAll；`binary-full-chain.spec.ts` E2E green（T-104～T-111） | done | M-5 | E2E-P-014 | done |
| GAP-013 | feature | FR-06～08 / AC-046～048 帮助全覆盖 | 45 nodeType help + registry + HELP_NAV + help-all-nodes E2E（T-115～164） | done | M-6 | E2E-P-007 | done |
| GAP-014 | feature | FR-09 / AC-049 全节点审查矩阵 | node-audit-matrix 46/46 status=ok + 46 nodeType E2E specs（T-080/T-081） | done | M-3 | E2E-N-manualTrigger | done |
| GAP-015 | spec | `2026-05-22-n8n-first-completion-design.md` P1 UX | `ux-v1.0-checklist.md` P0 多项未勾选 | partial | v2.0+ | E2E-P-001 | deferred |
| GAP-016 | spec | `2026-05-23-edit-publish-mode-design.md` | 编辑/发布模式 API 与 UI 部分存在；完整 AC 待核对 | partial | v2.0+ | E2E-P-001 | deferred |
| GAP-017 | spec | `2026-05-23-knowledge-base-design.md` RAG 流水线 | KB API + `ragRetrieve`/`ragAnswer` E2E；文档解析/同步源 v2.0+ | partial | v2.0+ | E2E-N-ragRetrieve | deferred |
| GAP-018 | spec | `2026-05-23-chat-completion-design.md` AI Chat | Chat SSE + 设置页；长期记忆/多模型对比 v2.0+ | partial | v2.0+ | E2E-N-llmStream | deferred |
| GAP-019 | spec | `2026-05-23-agent-rag-design.md` Agent RAG | `aiAgent` + 卫星 E2E；评测/追踪导出 v2.0+ | partial | v2.0+ | E2E-N-aiAgent | deferred |
| GAP-020 | spec | `2026-05-29-crewai-integration-design.md` Crew 三模式 | crew 三模式执行器 + E2E specs covered | done | M-3 | E2E-N-crewSequential | done |
| GAP-021 | spec | `2026-05-29-runner-v1.1-websocket-design.md` 远程 Runner WS | Embedded Runner 为主；WebSocket 远程协议未交付 | missing | v2.0+ | E2E-P-016 | deferred |
| GAP-022 | spec | `2026-06-03-expression-static-validation-design.md` | 表达式校验 + Code E2E green | done | M-3 | E2E-N-code | done |
| GAP-023 | spec | `2026-06-03-expression-implicit-return-design.md` | Code sandbox + E2E green | done | M-3 | E2E-N-code | done |
| GAP-024 | spec | `2026-06-03-js-expression-globals-design.md` | `$json`/`$binary`/`$nodes` globals 已落地 | done | — | E2E-N-code | done |
| GAP-025 | spec | `2026-06-03-skill-run-simplify-design.md` | skillRun Tool 卫星简化 AC 已 M-2 E2E 验收（同 GAP-007 / T-028） | done | M-2 | E2E-N-skillRun | done |
| GAP-026 | spec | `2026-06-04-node-input-panel-n8n-design.md` | `NodeEditorParamsPane` 存在；n8n 式输入面板 parity 未全量 | partial | v2.0+ | E2E-P-001 | deferred |
| GAP-027 | spec | `2026-06-06-subworkflow-trigger-design.md` | `subworkflowTrigger` 节点 + executor 已注册 | done | — | E2E-N-subworkflowTrigger | done |
| GAP-028 | node-help | FR-06 `manualTrigger` 帮助 | `docs/help/zh/nodes/manualTrigger.md` + registry | done | M-6 | E2E-P-008 | done |
| GAP-029 | node-help | FR-06 `scheduleTrigger` 帮助 | `docs/help/zh/nodes/scheduleTrigger.md` + registry | done | M-6 | E2E-P-008 | done |
| GAP-030 | node-help | FR-06 `errorTrigger` 帮助 | `docs/help/zh/nodes/errorTrigger.md` + registry | done | M-6 | E2E-P-008 | done |
| GAP-031 | node-help | FR-06 `httpRequest` 帮助 | `docs/help/zh/nodes/httpRequest.md` + registry | done | M-6 | E2E-P-008 | done |
| GAP-032 | node-help | FR-06 logic 节点 help | merge/splitInBatches/humanApproval 等 45 篇齐全 | done | M-6 | E2E-P-007 | done |
| GAP-033 | node-help | FR-06 Agent 卫星 tool* help | toolWrite/Grep/Shell 等 help + registry | done | M-6 | E2E-P-007 | done |
| GAP-034 | node-e2e | FR-18 每 nodeType ≥1 E2E | 46 nodeType E2E specs covered（`apps/web/e2e/nodes/` + `skill-run-tools.spec.ts`） | done | M-3 | E2E-N-manualTrigger | done |
| GAP-035 | node-e2e | FR-08 帮助按钮新 Tab 跳转 E2E | `platform-capabilities.spec.ts` + help-all-nodes | done | M-6 | E2E-P-008 | done |
| GAP-036 | platform | FR-12 / AC-010 M-1 acceptance | `M-1-acceptance.md` 已入库 | done | M-1 | E2E-P-017 | done |
| GAP-037 | spec | `2026-05-28-standard-lite-deployment-design.md` Standard 真切换 | Lite 轨 E2E 为主；PG/BullMQ 业务切换 partial | partial | v2.0+ | E2E-P-005 | deferred |
| GAP-038 | spec | `2026-05-23-langsmith-tracing-design.md` | 追踪 hooks 部分；LangSmith/OTel 导出 v2.0+ | partial | v2.0+ | E2E-N-aiAgent | deferred |
| GAP-039 | spec | `2026-05-31-skill-platform-parity-matrix.md` P2 Rules/Subagent | P1 skillRun 为主；RuleResolver/Subagent P2 项 | partial | v2.0+ | E2E-N-skillRun | deferred |
| GAP-040 | spec | spec.md v2.0 SSO/SAML/插件市场 | 未实现（符合刻意不做边界） | deferred | v2.0+ | E2E-P-009 | deferred |

---

## 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-18 | 1.0 | T-003 spec-reviewer 引用节 |
| 2026-06-18 | 2.0 | T-008 完整差距表 40 行（AC-005/006） |
| 2026-06-20 | 2.1 | T-032 M-2 半实现项 GAP-007/008/009/010/025 → audit_status done（AC-017） |
| 2026-06-20 | 2.2 | T-084 M-3 节点项 GAP-014/034 → audit_status done（AC-049/FR-18）；lite 轨全量 E2E 150/151 green |
| 2026-06-21 | 2.5 | T-167 M-6 帮助/matrix/INDEX 收口：GAP-001～006/013/028～036/035 → done；v2.0+ 边界项 → deferred |
