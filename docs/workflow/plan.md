# 项目计划

> 由项目经理维护。编排器启动后，project-manager Subagent 覆盖本文件。  
> **状态**：待批准（含待确认项逐题澄清）

---

## 理解摘要

面向研发/运维团队的 RX-Workflow，本轮目标是在 **不引入无 spec 依据的新大功能** 前提下，通过 spec 差距审计补齐 P0 未实现/半实现项，对 **约 45 个可执行节点类型**（`node-type-meta.ts` 共 46 类，排除 `stickyNote`）做健康审查与修复，将帮助文档从当前 **~14 篇 / 15 条 registry 映射** 扩展至全覆盖，并扩展 Playwright E2E 覆盖编辑器、执行、帮助跳转等主链路。成功标准：P0 差距有结论（实现或书面排除）、节点可配置可执行且错误可诊断、帮助可从节点弹窗新 Tab 打开正确文档、CI E2E 可跑通。方法论 TDD；帮助源 `docs/help/zh/**`；不破坏工作流 JSON 兼容性。

---

## 待确认项

> 格式见 `.cursor/skills/dev-pipeline/templates/clarifications.md`。澄清由编排器苏格拉底逐题完成。

### OQ-001：未实现功能的版本边界（v1.0 MVP vs v1.1 spec）

**背景**：intake 与 `docs/spec.md` 将 Agent/RAG/Runner 等标为 v1.1，但代码库已部分实现（Crew、aiAgent、skillRun 等）；同时存在多份 **Approved 但未落地** 的 spec（如 Group Chat、binary 全链路、credential-types、user-role-management）。

**核心议题**：M-1「P0 补齐」应以哪份清单为权威边界？

**Agent 初步理解**：倾向以 **spec-reviewer 差距审计 + `ux-v1.0-checklist` P0 + 已 Approved 且与本轮 intake 直接相关的 spec** 交集为 P0；纯 v1.1 远期项（Runner WebSocket、CrewAI Sidecar、SSO）默认 **记录排除** 除非用户升格。依据：`2026-05-22-n8n-first-completion-design.md` 明确 P4 AI 轨后置，但部分 P4 能力已在画布出现。

**引导方向**：先问「发布前必须可用的能力清单」——是「能跑通核心 DAG + 已有 Plus 节点」还是「spec v1.1 全量」。

- **影响**：scope / M-1 任务量 / 成功标准 AC-1 / 全流水线交付约束
- **blocking**：是
- **状态**：resolved
- **决选结论**：
  - **P0 边界**：以 `docs/spec.md` **v2.0 全量功能** 为权威范围；M-1 差距审计与后续补齐均对照 v2.0 能力清单执行。
  - **交付节奏**：拆分为**多个大阶段（Milestone）**推进；**每个大阶段结束须经用户人工验收**后方可进入下一阶段。
  - **问题处理**：遇阻塞、范围歧义、实现取舍或 spec 冲突时**必须暂停并请用户确认**；编排器与各 Subagent **不得自行忽略、降级或绕过**。
  - **大变动门禁**：涉及**框架、流程、UX/UI** 等重大变更时，**必须人工确认**后方可实施。
  - **阶段验收用例**：每个阶段须生成**人工验收用例**清单；**全部用例通过**方视为该阶段完成。
  - **每 Milestone 双门禁**：**每个 Milestone 结束**须 **(1) 全量 Playwright E2E 套件全绿** + **(2) 人工验收用例全通过** + **(3) 用户 `验收 M-x` 放行**；E2E 最终须 **100% 覆盖 v2.0 全功能**。
  - **Milestone 内无需人工确认**：同一 Milestone 内 Wave 之间、任务之间由编排器**自动推进**，**不**中途暂停请用户确认；仅 **Milestone 全部任务 + E2E + 人工验收用例完成后** 才等待 `验收 M-x`。
  - **例外（仍须暂停）**：框架/流程/UX/UI **大变动**、阻塞/歧义、spec 冲突等仍须人工确认（与 OQ-001 一致），但**不属于** Milestone 内常规进度确认。
  - **分支与合并**：代码修改须在**独立分支**进行；阶段人工验收通过后，该阶段**全部代码与文档须提交仓库并合入主分支**。
  - **文档一致性**：功能修改与完善须**同步更新相关文档**，保证文档与代码一致。
  - **文档索引**：对项目文档进行**归类并建立索引机制**，提升 AI 与人工查阅效率（纳入交付范围，具体形态见 OQ-008 扩展）。

---

### OQ-002：节点审查深度与外部依赖

**背景**：intake 列出约 45 个可执行节点，含 Ollama、Postgres、MCP、Crew、Agent 等强外部依赖类型；当前测试以单元/部分集成为主。

**核心议题**：「保证节点正常工作」需要验证到哪一层？

**Agent 初步理解**：建议 **分层**——所有节点至少 **冒烟**（参数面板渲染、保存校验、执行器注册、错误码可诊断）；P0 核心节点（触发、HTTP、IF/Switch、Code、Set、Merge、Loop）加 **集成测试（mock 外部）**；依赖真实 LLM/DB 的节点（Ollama、Postgres、RAG）在审查阶段 **不强制真实调用**，以 mock/fixture + 可选本地手工验收清单代替。依据：工期与 CI 稳定性。

**引导方向**：区分「发布阻断」与「文档标注需本地环境」的节点集合。

- **影响**：scope / M-2 工时 / 测试策略 / CI 与 Docker 编排
- **blocking**：是
- **状态**：resolved
- **决选结论**：
  - **验收深度**：凡 spec 标明需外部依赖的节点（Postgres、Redis、Ollama、CrewAI、MCP 等），**一律在 Docker 真实依赖下验收**，不使用 mock 替代真实服务（无外部依赖节点仍走单元/集成冒烟）。
  - **Docker 编排**：CI 与本地人工验收**均采用** `docker compose up -d` + healthcheck **自动启停**（选项 C）；验收用例与测试脚本须内置 compose 生命周期，失败则阻塞。
  - **阻塞处理**：Docker 启动失败、依赖不可用、节点行为与 spec 冲突等**须暂停并请用户确认**，不得自行降级为 mock 或跳过。

---

### OQ-003：E2E 外部依赖策略（Playwright / CI）

**背景**：现有 E2E 仅 `workflow-manual-node.spec.ts`（编辑器加节点）；intake 要求覆盖执行、帮助跳转等；仓库含 Ollama/Postgres 等节点。

**核心议题**：CI 中 E2E 是否启动真实 Ollama、Postgres，还是全部 mock/stub？

**Agent 初步理解**：倾向 **CI 零外部依赖**——API/执行层用 test double 或 Lite SQLite 内置栈；编辑器与 `/help` 路由用真实 UI；执行类用 **预置 fixture 工作流 + stub 响应**；真实 Ollama/Postgres 仅 **可选 nightly 或本地 manual**。依据：现有 `global-setup.ts`/`auth.setup.ts` 模式与 CI 可重复性。

**引导方向**：先确认 CI 目标环境（仅 Lite 单进程 vs Standard 多服务）。

- **影响**：scope / M-4 / NFR / CI 配置 / Docker compose 栈选型
- **blocking**：是
- **状态**：resolved
- **决选结论**：
  - **CI E2E 不采用 mock** 替代 Postgres / Redis / Ollama / CrewAI 等真实服务（与 OQ-002 一致）。
  - **环境启停**：Playwright `global-setup` 或 CI job 内自动 `docker compose up -d` + healthcheck，teardown 时 down；失败则阻塞并**须人工确认**。
  - **Compose 栈（双轨）**：
    - **Standard 轨（A）**：`deploy/docker-compose.standard.yml`（Postgres + Redis）作为核心 DAG / 数据节点 E2E 基线；按需**扩展** Ollama 等 LLM 服务（compose override 或 test 扩展文件）。
    - **Plus 轨（B）**：`deploy/docker-compose.plus.yml`（含 crewai-runner 等）用于 Agent / Crew / Plus 节点 E2E 与阶段验收。
  - E2E 针对已启动的 **api + web** 真实栈，非纯前端 mock。
  - 各阶段验收用例须标明所属 compose 轨（Standard / Plus）；两轨用例均须通过。

---

### OQ-004：Group Chat 是否纳入本轮实现

**背景**：`groupChat` 已在 `node-type-meta.ts` 与画布注册，但 `2026-05-30-group-chat-design.md` 标明 **尚未实现**（Approved，P4-E / v1.3+）；与 Crew 系列并列。

**核心议题**：本轮是 **实现 Group Chat MVP**、**仅审查占位/隐藏**、还是 **文档标注未就绪并排除**？

**Agent 初步理解**：若 OQ-001 边界为 v1.0+n8n 体验优先，Group Chat 属 **v1.1+ 差异化**，倾向 **不实现**，仅确保画布不误导（灰显/校验/帮助说明「未就绪」）；若用户要求 Agent 能力闭环则升格为 M-1 大项。依据：spec FR-15.4-E 与实施计划尚未执行。

**引导方向**：问 Group Chat 是否为发布阻断，还是「可见但不可用」可接受。

- **影响**：scope / M-1 / M-2 工作量 / Plus 轨验收
- **blocking**：是
- **状态**：resolved
- **决选结论**：
  - **纳入 v2.0 本轮实现**：按 `2026-05-30-group-chat-design.md` 实现 Group Chat MVP（round-robin / orchestrator + UserProxy）。
  - **架构冲突**：若与现有 Crew / Agent 架构或执行流程冲突，**暂停并请人工确认**后再改框架/流程（遵循 OQ-001 大变动门禁）。
  - 验收归属 **Plus 轨**（`docker-compose.plus.yml`）阶段用例与 E2E。

---

### OQ-005：WorkflowItem.binary 全链路是否纳入本轮

**背景**：`2026-06-03-workflow-binary-support-design.md` 状态 **Accepted — 待 implementation plan**；`binary-type-support-analysis.md` 结论为类型与表达式可读，**无生产者、无 blob、多数节点丢弃**；HTTP body binary 已实现。

**核心议题**：M-1 是否包含 binary P1～P4 全链路，还是仅文档化现状 + 排除？

**Agent 初步理解**：全链路（blob 服务、HTTP 响应→binary、Webhook multipart 等）为 **独立大里程碑**（估 2+ 周），与本轮「节点审查+帮助+E2E」并行风险高；倾向 **本轮不实现**，在差距审计中 **书面排除并保留 spec**，帮助文档中说明 `$binary` 当前能力边界。除非用户将 binary 标为发布阻断。

**引导方向**：区分「HTTP 上传下载场景是否必须」与「表达式可读即可」。

- **影响**：scope / M-1 / 架构波及 / Milestone 划分
- **blocking**：是
- **状态**：resolved
- **决选结论**：
  - **纳入 v2.0**：WorkflowItem.binary **全链路**纳入范围，但**不直接照搬**现有 draft spec。
  - **方案审查**：实施前须**参照 n8n 及业界做法**审查当前 `2026-06-03-workflow-binary-support-design.md` 合理性，提出改善方案；**必要时暂停并请人工方案确认**后再开发。
  - **独立 Milestone**：binary 设为**独立 Milestone 阶段**，单独生成验收用例、独立分支、阶段结束人工验收并合入主分支。
  - **大变动门禁**：涉及 ADR、执行数据模型、存储架构等变更时**暂停并请人工确认**（与 OQ-001 一致）。

---

### OQ-006：半实现项的处理策略（补齐 vs 排除记录）

**背景**：抽样发现多处半实现：`skill-run` 中 `write`/`grep`/`web_search` provider 未完整、`user-role-management` 工作流 ACL 未实现、`credential-types` Approved 待实施、`switch` 动态分支为 Draft 等。

**核心议题**：对「有 spec 但未完成」项，默认动作是 **补齐到 spec AC** 还是 **登记差距 + 降级 UX**？

**Agent 初步理解**：与 OQ-001 联动——在 P0 清单内的 **补齐**；清单外的 **生成 `docs/spec-gap-register.md`（或 PRD 附录）记录排除理由与目标版本**，并在帮助/面板给出「未实现」提示。避免 silently broken。

**引导方向**：是否接受「功能存在但子能力缺失」的发布态。

- **影响**：M-1 交付物形态 / 成功标准 AC-1 / v2.0 差距审计处置
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **一律补齐**：凡 v2.0 范围内的半实现项（如 skillRun 子能力、工作流 ACL、credential-types、switch 动态分支等），**必须补齐至 spec AC**，**不允许**以「登记排除 / defer / 未就绪占位」代替交付。
  - 若补齐过程中发现 spec 不可行、依赖缺失或工期/架构风险 → **暂停并请人工确认**处置方案（仍不得自行登记排除或静默降级）。

---

### OQ-007：帮助文档粒度（卫星节点 vs 合并篇章）

**背景**：约 45 个可执行类型中，Agent 卫星（`aiChatModel`、`toolRead`～`toolShell` 等 10+）是否各需独立 `docs/help/zh/nodes/*.md`，还是合并为「Agent 卫星总览 + 子节」？

**核心议题**：「全覆盖」指 **每个 nodeType 一条 registry 映射 + 可打开页面**，还是 **每个类型一篇独立 Markdown**？

**Agent 初步理解**：成功标准要求「每个节点均可从编辑器打开对应帮助」——至少需 **registry 全覆盖**；内容可 **分层**：复杂节点独立文（Code、Loop、aiAgent），简单卫星可 **短页或锚点章节**（≥300 字：用途、端口、参数、常见错误）。当前仅 15/46 有映射，缺口 ~31。

**引导方向**：优先保证 registry + 最小可用正文，还是追求 n8n 级详细度。

- **影响**：M-3 工时 / 帮助质量标准
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **每 nodeType 独立 Markdown**：`docs/help/zh/nodes/<nodeType>.md` 与 `NODE_HELP_PATH` **一一映射**（含全部 Agent 卫星节点）。
  - **质量门槛**：每篇须 ≥300 字，且包含：**用途**、**端口/连接**、**参数说明**、**常见错误**、**示例**（与节点实现同步维护）。
  - 节点行为或参数变更时，**同 PR / 同阶段**更新对应帮助文档。

---

### OQ-008：P0 差距审计产出物形态

**背景**：M-1 需产出可追踪的 P0 清单，供 PRD/架构引用。

**核心议题**：审计结果是 **独立 `spec-gap-audit.md`**、写入 **PRD 附录**，还是 **GitHub Issues 列表**？

**Agent 初步理解**：倾向仓库内 **`docs/workflow/spec-gap-audit.md`**（表格：spec/FR、现状、决策 implement/defer/exclude、负责人 milestone），与 spec-reviewer 流程对齐，便于 gates 追溯。

**引导方向**：团队是否已有 issue 跟踪习惯。

- **影响**：M-1 交付物 / 全项目文档治理 / AI 查阅效率
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **A + B + 校验（方案 C）**：
    - 增强 `docs/README.md`：分类目录（规格 / ADR / 帮助 / 工作流 / API / 测试报告等）+ 每文件一行摘要 + 维护规则。
    - 新增 `docs/INDEX.md`：YAML frontmatter（机器可读）+ 人类可读总目录；各子目录 `README.md` 链回主索引。
    - **校验**：CI 或脚本检查「新增/移动 `.md` 须登记索引」，防文档漂移；各阶段验收时同步更新索引。
  - 帮助文档按 **nodeType**、规格按 **FR/spec 编号** 建立交叉引用（在 INDEX 中体现）。

---

## 范围

### In Scope

- 基于 `docs/superpowers/specs/*.md`、`docs/spec.md`、`docs/spec-review.md` 与代码库的 **差距审计**，按 OQ-001 边界处理 P0 未实现/半实现项
- **全可执行节点类型**健康审查（`node-type-meta.ts` 除 `stickyNote`）：参数面板、保存校验、执行器注册、错误处理与可诊断性（深度见 OQ-002）
- 帮助中心补全：`docs/help/zh/nodes/**`、`NODE_HELP_PATH`、`HELP_NAV` 与 `node-type-meta` 对齐；节点弹窗「帮助」按钮新 Tab 打开正确文档（粒度见 OQ-007）
- Playwright E2E：**覆盖 v2.0 全部功能**（见下方「E2E 覆盖策略」）；非抽样、非仅 smoke；Docker 双轨（OQ-003）
- TDD：Red → Green → Refactor → Verify
- 差距/排除项书面记录（形态见 OQ-008）

### Out of Scope

- 无 spec / v2.0 依据的全新大功能（须先经人工确认纳入）
- 独立 VitePress/Docusaurus 帮助站
- 英文帮助全文（可预留 `en/` 结构与路由）
- **登记排除 / defer 未实现项**（OQ-006：一律补齐）

---

## 交付模式

**标准模式（standard）**：按 **6 个交付 Milestone** 顺序推进；**每个 Milestone** 均须：**E2E 全绿** + **人工验收用例全通过** + **人工验收放行**，方可进入下一阶段。

## E2E 覆盖策略（v2.0 全功能）

| 原则 | 说明 |
|------|------|
| **覆盖范围** | E2E 须覆盖 `docs/spec.md` **v2.0 全部功能**：所有可执行节点类型、编辑器主链路、工作流执行、帮助跳转、认证/设置、Agent/Crew/Group Chat、Binary、子工作流等 |
| **禁止抽样放行** | 不得用「核心路径抽样通过」代替全功能覆盖；未写 E2E 的功能视为**未完成** |
| **覆盖矩阵** | M-1 建立 `docs/test/e2e-coverage-matrix.md`（功能/FR/节点 type ↔ E2E spec 文件），逐 Milestone 补全直至 **100%** |
| **累积回归** | E2E 用例逐 Milestone **只增不减**；每阶段须跑**当前已编写的全量 E2E 套件**并全绿 |
| **分阶段交付** | 某 Milestone 交付的功能，须在合入前**已有对应 E2E**；M-6 结束时矩阵须 **100% 覆盖 v2.0 全功能** |
| **环境** | Standard + Plus 双轨 Docker compose 自动启停（OQ-003）；真实依赖，不 mock 外部服务 |
| **阻塞** | 覆盖缺口、E2E 失败、环境不可用 → **暂停并请人工确认** |

---

## Milestone 划分说明

- **提议数量**：6 个（M-1～M-6），对应 v2.0 全量 + 独立 binary 阶段 + 文档索引 + E2E 双轨
- **划分理由**：
  1. **M-1** 文档索引 + v2.0 差距审计（为后续开发提供单一真相源）
  2. **M-2** P0/v2.0 半实现项一律补齐（含 credential-types、ACL、skillRun 子能力等）
  3. **M-3** 全节点审查与修复（Docker 真实依赖，Standard+Plus 双轨验收用例）
  4. **M-4** Group Chat MVP（Plus 轨；架构冲突须人工确认）
  5. **M-5** Binary 全链路（独立阶段；n8n/业界对标 + 人工方案确认）
  6. **M-6** 帮助文档全覆盖 + E2E 扩展 + 整体验证
- **每阶段约束（统一）**：
  1. 独立 Git 分支开发
  2. 生成该 Milestone **人工验收用例** + **E2E 用例**（`docs/test/milestones/M-x-acceptance.md`、`apps/web/e2e/`；更新 `e2e-coverage-matrix.md`）
  3. **Playwright 全量 E2E 套件全绿**（含本阶段及此前所有用例；Docker compose 自动启停）
  4. **人工验收用例全通过**
  5. 用户 **`验收 M-x`** 放行
  6. 该阶段代码 + 文档合入主分支

---

## 交付 Milestone

| ID | 名称 | 交付目标 | E2E（本阶段） | 人工验收 | 合入主分支前 |
|----|------|----------|---------------|----------|--------------|
| M-1 | 文档索引与 v2.0 差距审计 | `INDEX.md`、`README.md`、索引校验、`spec-gap-audit.md`、**`e2e-coverage-matrix.md`（全功能清单）** | 已实现功能的 E2E 基线 + 帮助/索引相关 E2E；矩阵建立 | **`验收 M-1`** | 全量 E2E green |
| M-2 | v2.0 半实现项补齐 | 差距清单全部达 spec AC | 矩阵补全：本阶段交付功能 **100% 有 E2E** | **`验收 M-2`** | 全量 E2E green |
| M-3 | 全节点审查与修复 | ~45 节点 Docker 真实依赖验收 | 矩阵补全：**每个可执行 nodeType 至少 1 条 E2E** | **`验收 M-3`** | 全量 E2E green |
| M-4 | Group Chat MVP | group-chat spec 落地 | 矩阵补全：Group Chat 全场景 E2E（Plus 轨） | **`验收 M-4`** | 全量 E2E green |
| M-5 | Binary 全链路 | binary 方案落地 | 矩阵补全：Binary 全场景 E2E | **`验收 M-5`** | 全量 E2E green |
| M-6 | 帮助全覆盖与最终回归 | 每 nodeType 独立帮助 | 矩阵 **100%**；**v2.0 全功能 E2E** CI 可跑通 | **`验收 M-6`** + 最终验收 | 全量 E2E green |

> **说明**：每个 Milestone 放行时，**已编写 E2E 须全部 green**；M-6 结束时 **`e2e-coverage-matrix.md` 须 100% 覆盖 v2.0 全功能**，无 skip、无「待补测」项。

---

## 任务分解（概要）

| ID | 描述 | Milestone | 依赖 | 负责角色 | 状态 |
|----|------|-----------|------|----------|------|
| T-001 | 运行 spec-reviewer 流程，生成差距矩阵（spec × 实现状态） | M-1 | OQ-001 决选 | spec-reviewer / architect | pending |
| T-002 | 冻结 P0 清单与排除项，写入 `spec-gap-audit.md` | M-1 | T-001, OQ-006, OQ-008 | project-manager / requirements-analyst | pending |
| T-003 | 按 P0 清单 TDD 补齐实现（含 Group Chat / binary 若 OQ 升格） | M-1 | T-002, OQ-004, OQ-005 | developer | pending |
| T-004 | 建立节点审查矩阵（类型 × 面板/校验/执行器/错误码） | M-2 | T-002, OQ-002 | tester / developer | pending |
| T-005 | P0 节点集成测试与缺陷修复 | M-2 | T-004 | developer | pending |
| T-006 | 非 P0 节点冒烟与降级 UX（未实现提示） | M-2 | T-004 | developer | pending |
| T-007 | 盘点 `node-type-meta` 与 help 缺口，定义文档模板 | M-3 | T-005, OQ-007 | requirements-analyst | pending |
| T-008 | 编写/迁移节点 Markdown，更新 `NODE_HELP_PATH` 与 `HELP_NAV` | M-3 | T-007 | developer | pending |
| T-009 | 帮助 registry 完整性单元测试 + 抽样 E2E 帮助跳转 | M-3 | T-008 | tester | pending |
| T-010 | 扩展 E2E：编辑器、保存、手动执行、帮助按钮 | M-4 | T-008, OQ-003 | tester | pending |
| T-011 | CI 集成 E2E 与测试/验证报告 | M-4 | T-010 | verifier | pending |
| T-012 | 里程碑验收与差距登记收尾 | M-4 | T-011 | project-manager | pending |

---

## 开发方法

**TDD**：Red → Green → Refactor → Verify。每个 P0 补齐项与节点修复须先失败测试，再实现，最后全量验证。

---

## 风险与假设

| 风险 | 影响 | 缓解 |
|------|------|------|
| OQ-001 边界过宽（含 v1.1 全量） | M-1/M-2 工期失控 | blocking OQ 批准前不启动开发；M-1 先出审计再排期 |
| 节点外部依赖在 CI 不可用 | M-2/M-4 假失败 | OQ-002/003 明确 mock 策略；文档标注本地依赖 |
| 帮助与实现不同步 | M-3 返工 | 节点行为变更与帮助同 PR；registry 自动化测试 |
| Group Chat / binary 升格 | 挤占 M-3/M-4 | OQ-004/005 显式决选；升格则调整 milestone 或延期 |
| `node-type-meta` 与执行器注册不一致 | 审查漏项 | 矩阵从 `NODE_TYPE_META` + executor registry 双源生成 |
| 半实现 silently broken | 用户信任损失 | OQ-006 强制登记 + 面板/帮助「未就绪」提示 |

**假设**：

- 现有 monorepo 与 Lite 部署可支撑开发与 CI
- spec-reviewer 子流程可用且产出可纳入 `spec-gap-audit.md`
- 用户将在计划门禁前完成 blocking OQ 澄清
- 英文帮助、独立帮助站本轮不做

---

## 人工门禁

| 门禁 | 说明 |
|------|------|
| **计划批准** | 编排器逐题澄清 **OQ-001～OQ-008**（blocking 须 resolved），用户确认后 `批准计划` |
| PRD 批准 | requirements-analyst 产出 PRD 后，澄清 PRD 层 OQ，再 `批准 PRD` |
| 架构批准 | 架构师产出 `architecture.md` 后批准 |
| 任务清单批准 | dev-leader 拆分 tasks 后批准 |
| Milestone 验收 | 各 M-1～M-6：**E2E 全绿** + 人工验收用例全通过 + 用户 `验收 M-x` |
| 最终验收 | 全 milestone accepted + 全量 E2E CI green + `验收通过` |

---

**下一步**：编排器就 **OQ-001** 发起苏格拉底澄清，收敛后依次 OQ-002…；全部 blocking OQ resolved 后等待用户 `批准计划`。
