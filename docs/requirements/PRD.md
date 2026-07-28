# RX-Workflow v2.0 补齐与质量门禁 — 产品需求文档（PRD）

> **版本**：1.0  
> **日期**：2026-06-18  
> **状态**：待批准（含 PRD 层待确认项）  
> **权威规格**：`docs/spec.md` v2.0 全量功能  
> **关联**：`docs/workflow/plan.md`、`docs/requirements/intake.md`、`docs/workflow/state.json`

---

## 理解摘要

本轮面向研发/运维团队，在 **不引入无 spec 依据的新大功能** 前提下，以 `docs/spec.md` **v2.0 全量** 为边界：通过差距审计与半实现项补齐消除 spec 与实现落差；对 **45 个可执行节点类型**（`node-type-meta.ts` 46 类减 `stickyNote`）在 **Docker 真实依赖** 下完成健康审查与修复；将帮助文档从当前约 14 篇扩展至 **每 nodeType 独立 Markdown + registry 一一映射**；建立 **e2e-coverage-matrix** 并逐 Milestone 补全直至 **100% 覆盖 v2.0 全功能**；独立交付 Group Chat MVP 与 Binary 全链路。交付按 **6 个 Milestone（M-1～M-6）** 推进，每阶段须 **全量 E2E 全绿 + 人工验收用例全通过 + 用户 `验收 M-x`** 后合入主分支。方法论 TDD；Standard + Plus 双轨 compose 自动启停；遇阻塞须人工确认，不得自行降级或登记排除。

---

## 与 plan 一致性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| In/Out Scope | ok | PRD 范围与 plan In Scope（差距审计、全节点、帮助、E2E、Group Chat、Binary）一致；Out Scope（无 spec 新功能、独立帮助站、英文全文、HA/SSO、登记排除）一致 |
| Milestone 划分 | ok | M-1 文档索引与差距审计 → M-2 半实现补齐 → M-3 全节点 → M-4 Group Chat → M-5 Binary → M-6 帮助与最终回归；与 plan 表一致 |
| plan 已决选 OQ | ok | OQ-001～008 全部 resolved，结论已纳入「已确认假设」与正文 FR/NFR/AC；PRD 层 OQ 不重复 plan 议题 |

---

## 待确认项

### OQ-009：人工验收用例最低覆盖规则

**背景**：plan 要求每 Milestone 生成人工验收用例且全部通过，但未量化「最低条数」与「与 AC/E2E 的映射关系」。

**核心议题**：人工验收用例须覆盖到何种粒度方可放行？

**Agent 初步理解**：倾向 **(1) 本 Milestone 新增/变更的 AC 每条至少 1 条人工用例**；(2) M-3 起 **每个可执行 nodeType 至少 1 条人工用例**（可与 E2E 步骤复用但须独立编号）；(3) M-6 须覆盖 **e2e-coverage-matrix 中全部功能行** 各至少 1 条人工用例。M-1/M-2 可按交付物（索引、差距项）映射，不要求全节点。

**引导方向**：先问「人工验收与 E2E 重复度」——是否接受人工用例主要验证 UX/文档/环境，E2E 验证自动化路径。

- **影响**：AC-070～AC-072、各 Milestone 验收清单模板
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **人工验收与 E2E 分离**：E2E 负责可自动化路径；人工验收侧重 **E2E 无法覆盖** 的场景：**UX**、**文档**、**环境**、**边界场景**。
  - **映射关系**：人工用例与 E2E **不需要一一对应**，但须 **覆盖全**（本 Milestone 交付范围 + M-6 时 v2.0 全功能无遗漏）。
  - **覆盖规则**：每 Milestone 人工用例须覆盖该阶段 **全部 AC 所涉功能面**；M-3 起每个可执行 nodeType 至少 1 条人工用例（侧重 UX/边界，非重复 E2E）；M-6 须覆盖 `e2e-coverage-matrix` 全部功能行的 **人工补充验证**（与 E2E 互补、合计覆盖 100%）。

### OQ-010：Group Chat UserProxy 无响应行为

**背景**：plan OQ-004 决选纳入 Group Chat MVP（round-robin / orchestrator + UserProxy），`2026-05-30-group-chat-design.md` 对人工插话超时与默认动作有设计空间。

**核心议题**：UserProxy 等待人工输入时，超时、跳过、默认通过、终止会话的默认产品行为是什么？

**Agent 初步理解**：倾向 **可配置超时（默认如 24h）**；超时后 **记录审计事件并终止该轮 Group Chat 执行（失败态）**，不静默跳过；用户可在节点参数选择「超时自动继续（使用空回复/默认回复）」作为显式选项。具体默认值与错误码须在 M-4 前与用户确认。

**引导方向**：区分「调试场景可无限等待」与「生产场景须超时」是否同一套默认。

- **影响**：FR-04、AC-051～AC-054、M-4 验收用例
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **超时可配置**，默认值 **`-1`（不超时）**。
  - **超时后**：**失败终止**——记录审计事件 + 终止该轮 Group Chat 执行（失败态）；不静默跳过、不自动空回复继续。
  - 若需「超时自动继续」等变体，须作为**显式可选参数**另行配置（非默认）；默认行为仍为 `-1` 不超时，一旦配置为正数超时且触发则失败终止。

### OQ-011：帮助文档「示例」可执行性要求

**背景**：plan OQ-007 要求每篇帮助 ≥300 字且含示例，但未规定示例是否须为可导入工作流 JSON、伪代码或纯文字步骤。

**核心议题**：「示例」最低交付标准是什么？

**Agent 初步理解**：倾向 **至少 1 段可复制的配置说明**（参数键值或表达式片段）；对 **可执行节点**（非纯卫星配置页）另须 **最小可运行工作流 JSON 片段或仓库内 fixture 路径引用**（≤5 节点），使读者可导入或对照 E2E fixture。纯卫星节点（如 `aiChatModel`）可用「连接示意图 + 参数表」代替完整工作流。

**引导方向**：先问验收时是否由脚本校验 JSON 片段可解析，还是人工抽检。

- **影响**：FR-06、AC-061～AC-065、M-6 帮助验收
- **blocking**：否
- **状态**：resolved
- **决选结论**：
  - **A**：每篇帮助至少 1 段**可复制配置**（参数键值或表达式片段）。
  - **B**：**可执行节点**（非纯卫星）另须 **最小可运行工作流 JSON 片段**（≤5 节点）或仓库内 **fixture 路径引用**。
  - **C**：**纯卫星节点**（如 `aiChatModel`）可用「连接示意 + 参数表」，不要求完整工作流 JSON。
  - M-6 人工验收须抽检示例可复制性与 JSON/fixture 有效性（不强制 CI 脚本校验，除非后续 tasking 阶段另行纳入）。

---

## 1. 背景与目标

### 1.1 背景

RX-Workflow 已具备 DAG 编辑器、执行引擎与部分 Plus/Agent 能力，但 `docs/spec.md` v2.0 与代码库、帮助文档、E2E 覆盖之间存在显著差距：半实现子能力（skillRun 工具、工作流 ACL、credential-types、switch 动态分支等）、Group Chat 占位、Binary 无全链路、帮助仅覆盖约 1/3 节点类型、E2E 仅编辑器冒烟。发布前须消除「静默破损」与文档漂移风险。

### 1.2 本轮目标

| 目标 ID | 描述 | 度量 |
|---------|------|------|
| G-1 | v2.0 差距可追踪且半实现项补齐 | `spec-gap-audit.md` 无 open 半实现项；OQ-006：不允许登记排除 |
| G-2 | 全可执行节点可配置、可执行、错误可诊断 | 45 nodeType Docker 验收矩阵全通过 |
| G-3 | 帮助全覆盖且可从编辑器跳转 | 45 独立 Markdown + registry 映射；E2E 帮助跳转全通过 |
| G-4 | E2E 覆盖 v2.0 全功能 | `e2e-coverage-matrix.md` 100%；CI 全绿 |
| G-5 | Group Chat MVP 可用 | Plus 轨 E2E + 人工验收通过 |
| G-6 | Binary 全链路可用 | n8n/业界对标方案经人工确认后验收通过 |
| G-7 | 文档索引与代码一致 | `INDEX.md` + CI 校验 green |

### 1.3 成功标准（与 intake 对齐）

1. spec 对照后 v2.0 范围内未实现/半实现功能已补齐（非登记排除）
2. 各工作流节点可配置、可执行、错误可诊断
3. `docs/help/zh/nodes/` 覆盖全部可执行节点；`help-registry.ts` 完整；节点弹窗「帮助」新 Tab 打开正确文档
4. Playwright E2E 覆盖 v2.0 全部功能；每 Milestone 全量 E2E green；CI 可跑通

---

## 2. 用户故事（Given / When / Then）

### US-PRD-01 差距审计与索引（M-1）

**Given** 维护者需要查阅规格与实现差距  
**When** 打开 `docs/INDEX.md` 与 `spec-gap-audit.md`  
**Then** 可找到 v2.0 FR/节点与实现状态、Milestone 归属及 `e2e-coverage-matrix` 入口；新增文档未登记时 CI 失败

### US-PRD-02 半实现项补齐（M-2）

**Given** `spec-gap-audit.md` 列出 skillRun 子工具、工作流 ACL、credential-types、switch 动态分支等待补齐项  
**When** 研发按 spec AC 完成 TDD 补齐并合并  
**Then** 对应功能在 Standard/Plus 环境下行为符合 `docs/spec.md`；差距表状态为 done；相关 E2E 已入库

### US-PRD-03 节点健康审查（M-3）

**Given** 运维编排包含 Postgres、Ollama、MCP、Crew 等外部依赖节点  
**When** 在 Docker compose 真实依赖下执行节点矩阵验收  
**Then** 每 nodeType 参数面板可渲染、校验生效、执行器注册、失败返回可诊断错误码；每 type 至少 1 条 E2E 通过

### US-PRD-04 Group Chat（M-4）

**Given** AI 工程师配置多 Agent 群聊工作流  
**When** 选择 round-robin 或 orchestrator 模式并启用 UserProxy  
**Then** Agent 按 spec 轮流/编排发言；人工可通过 UserProxy 插话；Plus compose 下 E2E 全场景通过

### US-PRD-05 Binary 全链路（M-5）

**Given** 工作流需处理文件上传/下载与 `$binary` 表达式  
**When** 经 n8n/业界对标方案人工确认后实施 Binary Milestone  
**Then** HTTP/Webhook/节点间可传递 binary；上传下载与表达式读写符合验收场景；无方案确认前不启动实现

### US-PRD-06 帮助与最终回归（M-6）

**Given** 新成员在编辑器中打开任意可执行节点配置  
**When** 点击「帮助」按钮  
**Then** 新 Tab 打开对应 `docs/help/zh/nodes/<nodeType>.md` 渲染页；文档 ≥300 字且含用途/端口/参数/错误/示例；全量 E2E 与人工验收通过

### US-PRD-07 E2E 与双轨验收（全阶段）

**Given** CI 或本地执行 Playwright 全量套件  
**When** `global-setup` 自动 `docker compose up`（Standard 或 Plus 轨）  
**Then** 用例针对真实 api+web 栈；外部服务不 mock；失败时阻塞并须人工确认；teardown 正常 down

### US-PRD-08 阶段门禁（全阶段）

**Given** 某 Milestone 开发完成  
**When** 提交 `验收 M-x` 前  
**Then** 该阶段及此前全部 E2E green、`M-x-acceptance.md` 人工用例全通过、代码与文档已提交独立分支并准备合入主分支

---

## 3. 功能需求（FR）

> 本轮 FR 编号为 **交付 PRD 专用**，追溯至 `docs/spec.md` 对应章节。

| ID | 需求 | spec 追溯 | 主要 Milestone |
|----|------|-----------|----------------|
| FR-01 | 建立 `docs/INDEX.md`（YAML frontmatter + 人类目录）、增强 `docs/README.md` 分类与维护规则；子目录 README 链回主索引 | OQ-008 | M-1 |
| FR-02 | 产出 `docs/workflow/spec-gap-audit.md`：v2.0 能力 × 实现状态 × Milestone × E2E 行号 | OQ-001、OQ-006 | M-1 |
| FR-03 | 建立 `docs/test/e2e-coverage-matrix.md`：v2.0 功能/FR/节点 ↔ E2E spec 文件；逐 Milestone 更新直至 100% | plan E2E 策略 | M-1～M-6 |
| FR-04 | CI/脚本校验：新增/移动 `docs/**/*.md` 须在 INDEX 登记；失败阻塞合并 | OQ-008 | M-1 |
| FR-05 | 半实现项一律补齐至 spec AC：skillRun（write/grep/web_search 等）、工作流 ACL、credential-types、switch 动态分支等 | OQ-006、spec FR-2/FR-6/FR-10 | M-2 |
| FR-06 | 每可执行 nodeType 独立 `docs/help/zh/nodes/<type>.md`；`NODE_HELP_PATH`/`HELP_NAV` 一一映射 | OQ-007 | M-6 |
| FR-07 | 帮助质量：≥300 字；含用途、端口/连接、参数、常见错误、示例 | OQ-007、OQ-011 | M-6 |
| FR-08 | 节点配置弹窗「帮助」按钮：新 Tab 打开正确帮助路由 | FR-1、帮助中心 spec | M-6 |
| FR-09 | 全节点审查矩阵：面板渲染、保存校验、执行器注册、错误码；外部依赖节点 Docker 真实验收 | OQ-002 | M-3 |
| FR-10 | Group Chat MVP：round-robin、orchestrator、UserProxy；按 `2026-05-30-group-chat-design.md` | OQ-004、FR-15.4 | M-4 |
| FR-11 | Binary 全链路：实施前 n8n/业界对标审查；人工方案确认；blob/传递/表达式/Webhook multipart 等 | OQ-005、binary design spec | M-5 |
| FR-12 | 每 Milestone 产出 `docs/test/milestones/M-x-acceptance.md` 人工验收用例 | OQ-001 | M-1～M-6 |
| FR-13 | 每 Milestone 全量 Playwright E2E 套件全绿；用例只增不减 | plan E2E 策略 | M-1～M-6 |
| FR-14 | Standard 轨（`deploy/docker-compose.standard.yml`）与 Plus 轨（`deploy/docker-compose.plus.yml`）compose 自动启停 | OQ-003 | M-1～M-6 |
| FR-15 | 功能变更同 PR/同阶段同步更新 spec 相关文档、帮助、INDEX | OQ-001 | 全阶段 |
| FR-16 | 框架/流程/UX/UI、Binary ADR/存储等大变动须人工确认后实施 | OQ-001、OQ-005 | 全阶段 |
| FR-17 | 不破坏已有工作流 JSON 兼容性（`schemaVersion: 1`） | intake 约束 | 全阶段 |
| FR-18 | M-3 每个可执行 nodeType 至少 1 条 E2E | plan M-3 | M-3 |
| FR-19 | M-6 `e2e-coverage-matrix` 100% 覆盖 v2.0 全功能，无 skip/待补测 | plan M-6 | M-6 |
| FR-20 | 独立 Git 分支开发；阶段验收后合入主分支 | OQ-001 | 全阶段 |

### 3.1 可执行节点类型清单（45）

来源：`apps/web/src/features/editor/node-type-meta.ts`（排除 `stickyNote`）

| 类别 | nodeType |
|------|----------|
| trigger | `manualTrigger`, `webhookTrigger`, `scheduleTrigger`, `errorTrigger`, `subworkflowTrigger` |
| logic | `if`, `switch`, `merge`, `loop`, `humanApproval`, `splitInBatches` |
| data | `set`, `json` |
| action | `httpRequest`, `wait`, `code`, `executeCommand`, `executeWorkflow`, `readWriteFile`, `postgres`, `ollama`, `llmStream`, `ragRetrieve`, `ragAnswer`, `mcpClient`, `workflow_run` |
| agent | `crewSequential`, `crewHierarchical`, `crewSupervisor`, `groupChat`, `aiAgent`, `aiChatModel`, `aiMemory`, `aiKnowledge`, `aiOutputParser`, `toolMcp`, `toolHttp`, `toolWorkflow`, `toolSkill`, `toolSubagent`, `toolRead`, `toolWrite`, `toolGrep`, `toolShell`, `toolWebSearch`, `skillRun` |

Plus 轨节点见 `PLUS_NODE_TYPES` 常量（与上表 agent/action 中 Plus 项一致）。

---

## 4. 非功能需求（NFR）

| ID | 需求 | 验收要点 | Milestone |
|----|------|----------|-----------|
| NFR-01 | TDD：P0 补齐与节点修复须先失败测试再实现 | 测试报告含 Red→Green 记录 | 全阶段 |
| NFR-02 | E2E 外部依赖不 mock（Postgres/Redis/Ollama/CrewAI 等） | compose healthcheck 通过后跑测 | 全阶段 |
| NFR-03 | E2E 环境启停自动化；启动失败阻塞并人工确认 | global-setup / CI job 日志 | M-1 起 |
| NFR-04 | 双轨验收：用例标明 Standard/Plus；两轨均须通过 | acceptance 与 matrix 标注轨 | M-3 起 |
| NFR-05 | 索引 CI 校验 P95 增量 < 30s（本地脚本可重复） | CI job 时长 | M-1 |
| NFR-06 | 帮助 registry 完整性自动化测试（meta ↔ registry ↔ 文件存在） | 单元测试 green | M-6 |
| NFR-07 | 遇阻塞/歧义暂停，不得自行忽略、降级、mock 替代或登记排除 | history 与 gate 记录 | 全阶段 |
| NFR-08 | 文档与代码同一阶段合并，避免漂移 | PR 检查项 | 全阶段 |
| NFR-09 | Group Chat / Binary 架构冲突时暂停人工确认 | M-4/M-5 gate | M-4、M-5 |
| NFR-10 | 人工验收用例与 E2E 套件在 Milestone 放行前 100% 通过 | M-x 报告 | 全阶段 |

---

## 5. 验收标准（AC）

> **Milestone 列**：标明该 AC 须在该阶段 **验收通过**（实现可始于更早阶段，但不得晚于所列 Milestone）。

### 5.1 M-1：文档索引与 v2.0 差距审计

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-001 | `docs/INDEX.md` 存在且含 YAML frontmatter 与人类可读总目录 | M-1 |
| AC-002 | `docs/README.md` 含分类目录、每文件一行摘要、维护规则 | M-1 |
| AC-003 | 各主要 `docs/` 子目录 README 链回 `INDEX.md` | M-1 |
| AC-004 | CI/脚本：未登记 INDEX 的新增/移动 `.md` 导致校验失败 | M-1 |
| AC-005 | `docs/workflow/spec-gap-audit.md` 覆盖 v2.0 全量能力行（FR/节点/模块） | M-1 |
| AC-006 | 差距表每行含：spec 引用、现状、目标 Milestone、E2E matrix 行 ID | M-1 |
| AC-007 | `docs/test/e2e-coverage-matrix.md` 建立且列出 v2.0 全功能行（初始可为未覆盖） | M-1 |
| AC-008 | matrix 列含：功能描述、spec/FR、nodeType（如适用）、E2E spec 路径、覆盖状态 | M-1 |
| AC-009 | 运行 spec-reviewer 流程产出纳入差距审计或引用 | M-1 |
| AC-010 | `docs/test/milestones/M-1-acceptance.md` 人工验收用例已编写 | M-1 |
| AC-011 | M-1 相关 E2E（索引/帮助路由基线等）已入库且全量套件 green | M-1 |
| AC-012 | INDEX 中含 FR 编号与 nodeType 交叉引用入口 | M-1 |

### 5.2 M-2：v2.0 半实现项补齐

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-013 | skillRun 子能力（write/grep/web_search 等）达 spec AC | M-2 |
| AC-014 | 工作流级 ACL（Owner/Editor/Viewer）达 spec FR-6 | M-2 |
| AC-015 | credential-types spec 落地项达 spec AC | M-2 |
| AC-016 | switch 动态分支达 spec AC（非 Draft 占位） | M-2 |
| AC-017 | `spec-gap-audit.md` 中 M-2 归属项状态均为 done | M-2 |
| AC-018 | M-2 交付功能在 matrix 中 **100% 有对应 E2E 行且已覆盖** | M-2 |
| AC-019 | `docs/test/milestones/M-2-acceptance.md` 已编写且全通过 | M-2 |
| AC-020 | 全量 E2E 套件 green（含 M-1 用例） | M-2 |
| AC-021 | 半实现项修复不破坏 `schemaVersion: 1` 工作流导入 | M-2 |
| AC-022 | 相关帮助/INDEX 已同步（若有参数或行为变更） | M-2 |

### 5.3 M-3：全节点审查与修复

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-023 | 节点审查矩阵（45 type × 面板/校验/执行器/错误码）100% 有结论 | M-3 |
| AC-024 | 无外部依赖节点：冒烟通过（面板、保存、执行器注册） | M-3 |
| AC-025 | Postgres/Redis 依赖节点：Standard compose 真实验收通过 | M-3 |
| AC-026 | Ollama/LLM 类节点：真实 Ollama（或 compose 扩展）验收通过 | M-3 |
| AC-027 | Crew/Agent/MCP 类节点：Plus compose 真实验收通过 | M-3 |
| AC-028 | 每个可执行 nodeType 至少 1 条 E2E 用例且 green | M-3 |
| AC-029 | matrix 中所有 nodeType 行已关联 E2E spec | M-3 |
| AC-030 | 节点失败返回可映射 `docs/error-codes.md` 或节点文档 | M-3 |
| AC-031 | `docs/test/milestones/M-3-acceptance.md` 全通过 | M-3 |
| AC-032 | 全量 E2E green；Standard 与 Plus 轨用例均通过 | M-3 |
| AC-033 | 审查发现的缺陷已修复或经人工确认处置（不得静默 defer） | M-3 |
| AC-034 | 节点矩阵与 `NODE_TYPE_META`、执行器 registry 双源一致 | M-3 |

### 5.4 M-4：Group Chat MVP

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-035 | `groupChat` 节点 round-robin 模式按 design spec 可执行 | M-4 |
| AC-036 | `groupChat` orchestrator 模式按 design spec 可执行 | M-4 |
| AC-037 | UserProxy 人工插话路径可用（Plus 轨） | M-4 |
| AC-038 | Group Chat 与现有 Crew/Agent 无未确认架构冲突；若有则已人工确认 | M-4 |
| AC-039 | Group Chat 全场景 E2E（Plus 轨）green | M-4 |
| AC-040 | matrix 中 Group Chat 相关行 100% 覆盖 | M-4 |
| AC-041 | `docs/test/milestones/M-4-acceptance.md` 全通过 | M-4 |
| AC-042 | 全量 E2E green | M-4 |
| AC-043 | Group Chat 参数面板校验与错误可诊断 | M-4 |
| AC-044 | `spec-gap-audit.md` 中 Group Chat 项为 done | M-4 |

### 5.5 M-5：Binary 全链路

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-045 | Binary 实施前完成 n8n/业界对标审查文档 | M-5 |
| AC-046 | Binary 技术方案经用户 **人工方案确认** 后才开始实现 | M-5 |
| AC-047 | WorkflowItem.binary 可在节点间传递（非丢弃） | M-5 |
| AC-048 | HTTP 响应 → binary 生产者路径可用 | M-5 |
| AC-049 | Webhook multipart 上传 → binary 可用 | M-5 |
| AC-050 | 表达式 `$binary` 读写符合验收场景 | M-5 |
| AC-051 | Binary blob 存储/检索符合确认方案 | M-5 |
| AC-052 | Binary 全场景 E2E green | M-5 |
| AC-053 | matrix 中 Binary 相关行 100% 覆盖 | M-5 |
| AC-054 | `docs/test/milestones/M-5-acceptance.md` 全通过 | M-5 |
| AC-055 | ADR/执行数据模型大变动已人工确认 | M-5 |
| AC-056 | 全量 E2E green | M-5 |

### 5.6 M-6：帮助全覆盖与最终回归

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-057 | 45 个可执行 nodeType 均有 `docs/help/zh/nodes/<type>.md` | M-6 |
| AC-058 | `help-registry.ts` 与文件 **一一映射**，无孤儿/缺失 | M-6 |
| AC-059 | 每篇帮助 ≥300 字且含用途、端口、参数、常见错误、示例 | M-6 |
| AC-060 | 节点弹窗「帮助」新 Tab 打开正确页面（E2E 全覆盖 45 type） | M-6 |
| AC-061 | `HELP_NAV` 与 `node-type-meta` 对齐 | M-6 |
| AC-062 | help registry 完整性单元测试 green | M-6 |
| AC-063 | `e2e-coverage-matrix.md` **100%** 覆盖 v2.0 全功能，无 skip/待补测 | M-6 |
| AC-064 | CI 可跑通全量 E2E（Standard + Plus 轨） | M-6 |
| AC-065 | `docs/test/milestones/M-6-acceptance.md` 全通过 | M-6 |
| AC-066 | 全量 E2E green | M-6 |
| AC-067 | 全部 `docs/` 变更有 INDEX 登记；校验 green | M-6 |
| AC-068 | `spec-gap-audit.md` 无 open 项 | M-6 |
| AC-069 | 最终测试报告与验证报告已写入约定路径 | M-6 |

### 5.7 跨 Milestone 门禁 AC

| AC ID | 验收标准 | Milestone |
|-------|----------|-----------|
| AC-070 | 每 Milestone 人工验收用例清单存在且 **全部通过** | M-1～M-6 |
| AC-071 | 每 Milestone 放行前用户执行 `验收 M-x` | M-1～M-6 |
| AC-072 | 每 Milestone 验收后代码与文档合入主分支 | M-1～M-6 |
| AC-073 | compose 自动 up/down 无泄漏容器（验收后检查） | M-1～M-6 |
| AC-074 | 阻塞项均经人工确认并记入 history，无自行绕过 | 全阶段 |

---

## 6. 范围外说明

与 plan / intake 一致，本轮 **不包含**：

- 无 `docs/spec.md` v2.0 依据的全新大功能
- 独立 VitePress/Docusaurus 帮助站
- 英文帮助全文（可预留 `en/` 结构与路由）
- 多区域 HA、企业 SSO（v2 远期）
- **登记排除 / defer 未实现项**（OQ-006：一律补齐）
- 以 mock 替代 Docker 真实依赖的节点验收（OQ-002）
- 以抽样 E2E 代替 v2.0 全功能覆盖

---

## 7. 已确认假设（plan OQ 决选摘要）

| OQ | 决选摘要 |
|----|----------|
| OQ-001 | P0 边界 = `docs/spec.md` v2.0 全量；多 Milestone 人工验收；独立分支→合主分支；文档同步；文档索引；框架/流程/UX/UI 大变动须确认；遇问题不得自行处理 |
| OQ-002 | 外部依赖节点一律 Docker 真实验收；CI+人工 compose 自动启停；阻塞须人工确认 |
| OQ-003 | E2E 真实 Docker 依赖；Standard(A)+Plus(B) 双轨 compose 自动启停 |
| OQ-004 | Group Chat 按 spec 实现 MVP；架构冲突暂停人工确认；Plus 轨验收 |
| OQ-005 | Binary 全链路纳入；n8n/业界审查+人工方案确认；独立 Milestone |
| OQ-006 | 半实现项一律补齐至 spec AC；不允许登记排除 |
| OQ-007 | 每 nodeType 独立 Markdown + registry 一一映射；≥300 字含用途/端口/参数/错误/示例 |
| OQ-008 | `docs/README.md` + `docs/INDEX.md` + CI 索引校验；FR/nodeType 交叉引用 |

---

## 8. E2E 覆盖要求（v2.0 全功能）

| 原则 | 要求 |
|------|------|
| 覆盖范围 | `docs/spec.md` v2.0 **全部功能**：45 可执行节点、编辑器主链路、执行、帮助、认证/设置、Agent/Crew/Group Chat、Binary、子工作流等 |
| 覆盖矩阵 | `docs/test/e2e-coverage-matrix.md`；M-1 建立全量行；M-6 达 **100%** |
| 禁止抽样放行 | 未写 E2E 的功能视为未完成 |
| 累积回归 | E2E 只增不减；每 Milestone 跑 **当前全量套件** 并全绿 |
| 分阶段交付 | 本 Milestone 交付的功能合入前须有对应 E2E |
| 环境 | Standard + Plus 双轨；`deploy/docker-compose.standard.yml`、`deploy/docker-compose.plus.yml`；global-setup 自动启停 |
| 真实性 | 不 mock Postgres/Redis/Ollama/CrewAI 等；针对真实 api+web |
| 节点下限 | M-3 起每个可执行 nodeType ≥1 E2E；M-6 matrix 100% |
| 阻塞 | 覆盖缺口、E2E 失败、环境不可用 → 暂停并请人工确认 |

### 8.1 矩阵维护规则

1. M-1 初始化时从 spec v2.0 + 45 nodeType + 编辑器/执行/帮助/认证等模块生成 **全量行**。
2. 每 Milestone 合并前更新覆盖状态（covered / spec 路径 / 轨 Standard/Plus）。
3. M-6 禁止存在 `skip`、`待补测`、`N/A（本轮不做）`。
4. matrix 与 `spec-gap-audit.md`、PRD AC 可追溯。

---

## 9. 每 Milestone 人工验收用例要求

| Milestone | 验收物路径 | 最低要求 | E2E 门禁 | 人工门禁 | 合入主分支前 |
|-----------|------------|----------|----------|----------|--------------|
| M-1 | `docs/test/milestones/M-1-acceptance.md` | 索引可导航；gap 审计完整；matrix 已建立；索引 CI 失败演示 | 全量 E2E green | 用例全通过 + `验收 M-1` | 是 |
| M-2 | `docs/test/milestones/M-2-acceptance.md` | 每条 M-2 差距项至少 1 条人工用例；Standard/Plus 标明 | 全量 E2E green | 用例全通过 + `验收 M-2` | 是 |
| M-3 | `docs/test/milestones/M-3-acceptance.md` | 45 nodeType 各 ≥1 条（可与 E2E 步骤对齐）；Docker 真实依赖 | 全量 E2E green | 用例全通过 + `验收 M-3` | 是 |
| M-4 | `docs/test/milestones/M-4-acceptance.md` | Group Chat 全模式 + UserProxy；Plus 轨 | 全量 E2E green | 用例全通过 + `验收 M-4` | 是 |
| M-5 | `docs/test/milestones/M-5-acceptance.md` | Binary 方案确认记录；上传/下载/表达式/传递场景 | 全量 E2E green | 用例全通过 + `验收 M-5` | 是 |
| M-6 | `docs/test/milestones/M-6-acceptance.md` | 45 帮助跳转；matrix 100% 行各 ≥1 人工用例；最终回归 | 全量 E2E green | 用例全通过 + `验收 M-6` + 最终验收 | 是 |

### 9.1 人工验收用例模板（每条须含）

- 用例 ID、标题、前置条件、步骤、预期结果
- 所属轨（Standard / Plus / Lite-only）
- 追溯：AC ID、matrix 行 ID、nodeType（如适用）
- 执行结果栏（通过/失败/阻塞 + 备注）

### 9.2 测试与验证报告

每 Milestone 须同步：

- `docs/test/milestones/M-x-report.md`
- `docs/verification/milestones/M-x-report.md`

---

## 10. 追溯矩阵（摘要）

| Milestone | 核心 FR | 核心 AC 范围 | E2E 目标 |
|-----------|---------|--------------|----------|
| M-1 | FR-01～04, FR-12～14 | AC-001～012 | 基线 + matrix 建立 |
| M-2 | FR-05, FR-15 | AC-013～022 | M-2 功能 100% 有 E2E |
| M-3 | FR-09, FR-18 | AC-023～034 | 每 nodeType ≥1 E2E |
| M-4 | FR-10 | AC-035～044 | Group Chat 全场景 |
| M-5 | FR-11 | AC-045～056 | Binary 全场景 |
| M-6 | FR-06～08, FR-19 | AC-057～069 | matrix 100% |

---

**下一步**：编排器就 PRD 层 **OQ-009～OQ-011** 苏格拉底逐题澄清；全部 resolved 后用户 `批准 PRD`，进入架构阶段。
