---
milestone: M-1
version: 1
updated: 2026-06-18
ac_coverage:
  - AC-001
  - AC-002
  - AC-003
  - AC-004
  - AC-005
  - AC-006
  - AC-007
  - AC-008
  - AC-009
  - AC-010
  - AC-011
  - AC-012
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
---

# M-1 人工验收用例

> **Milestone**：M-1 — 文档索引与 v2.0 差距审计基线  
> **追溯**：FR-12 / AC-001～012 / PRD §5.1、§9  
> **E2E 互补**（OQ-009）：本清单侧重 E2E **无法覆盖** 的 **UX**、**文档可读性**、**本地环境验证** 与 **边界场景**；与 `apps/web/e2e/docs-index-smoke.spec.ts`、`help-route-baseline.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-1`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix 行 | E2E 互补说明 |
|----|--------|----------|-----------|--------------|
| AC-001 | INDEX 存在且含 frontmatter + 人类目录 | M1-MAN-001 | E2E-P-017 | E2E 验路径；人工验 **阅读体验与章节导航** |
| AC-002 | README 分类、摘要、维护规则 | M1-MAN-002 | E2E-P-017 | 人工 **抽检摘要准确性** 与维护规则可读性 |
| AC-003 | 子目录 README 链回 INDEX | M1-MAN-003 | E2E-P-017 | 人工 **点击链回 UX**（预览/浏览器） |
| AC-004 | 未登记 `.md` 导致 CI 失败 | M1-MAN-004 | E2E-P-017 | 人工 **演示失败信息可读性**（边界） |
| AC-005 | gap 审计覆盖 v2.0 全量能力 | M1-MAN-005 | — | 人工 **审计表完整性** 与分类覆盖 |
| AC-006 | 差距表每行含 spec/现状/M/E2E | M1-MAN-006 | — | 人工 **列完整性抽检** |
| AC-007 | e2e-coverage-matrix 建立 | M1-MAN-007 | E2E-P-001～019 | 人工 **矩阵行数与 v2.0 范围** 对照 |
| AC-008 | matrix 列定义齐全 | M1-MAN-008 | — | 人工 **列定义 ↔ 表头** 一致性 |
| AC-009 | spec-reviewer 产出纳入审计 | M1-MAN-009 | — | 人工 **引用链可追溯** |
| AC-010 | 本验收清单已编写 | M1-MAN-010 | E2E-P-017 | 人工 **清单结构自检**（meta） |
| AC-011 | M-1 E2E 入库且全量 green | M1-MAN-011 | E2E-P-017, E2E-P-007 | E2E 验 green；人工验 **帮助页渲染 UX** |
| AC-012 | INDEX FR/nodeType 交叉引用 | M1-MAN-012 | E2E-P-017 | E2E 验路由；人工验 **交叉引用表点击导航** |

---

## 用例清单

### M1-MAN-001：INDEX 人类可读总目录与 frontmatter 可解析

**追溯 AC**: AC-001

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-001 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 仓库已 checkout 至 `milestone/m-1-docs-index` 分支
- 本地可打开 Markdown 预览（IDE 或浏览器）

**步骤**

1. 打开 `docs/INDEX.md`。
2. 确认文件顶部存在 YAML frontmatter（`---` 包裹），含 `version`、`categories`、`entries`。
3. 滚动阅读「产品规格」「需求与计划」「架构」等 **人类可读章节**。
4. 从人类目录点击至少 3 个不同分类下的链接（如 `spec.md`、`requirements/PRD.md`、`test/e2e-coverage-matrix.md`）。

**预期结果**

- frontmatter 可被工具/预览正常解析，无语法错误。
- 人类可读章节层次清晰，链接均可达对应文档。
- 页眉说明 machine-readable 与 human-readable 双索引关系。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-002：README 分类目录、文件摘要与维护规则

**追溯 AC**: AC-002

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-002 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/README.md` 已存在（T-002）

**步骤**

1. 打开 `docs/README.md`，定位「维护规则」章节。
2. 确认含 **INDEX 登记、CI 门禁、同 PR 同步、子目录 README、本页维护、权威边界** 等规则条目。
3. 在「测试与验收」或相邻分类表中任选 **3 行** 文件摘要。
4. 打开对应 `.md` 文件，核对标题/用途与 README 一行摘要一致。

**预期结果**

- 维护规则 ≥5 条且表述可执行（含 `pnpm lint:docs-index` 引用）。
- 抽检摘要与目标文档实际内容一致，无明显漂移。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-003：主要子目录 README 链回 INDEX（UX）

**追溯 AC**: AC-003

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-003 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 五个子目录 README 已创建（T-007）：`architecture/`、`requirements/`、`test/`、`help/`、`workflow/`

**步骤**

1. 依次打开上述 5 个子目录的 `README.md`。
2. 在 Markdown 预览或浏览器中 **点击** `[INDEX.md]` 链回链接。
3. 确认跳转目标为 `docs/INDEX.md` 且页面可正常渲染。

**预期结果**

- 5/5 子目录 README 均含指向 `../INDEX.md` 或等效相对路径的链回。
- 点击链回无 404、无错误相对路径。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-004：未登记文档触发 lint 失败（环境/边界）

**追溯 AC**: AC-004

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-004 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 已 `pnpm install`；`scripts/lint-docs-index.mjs` 可用（T-005/T-006）

**步骤**

1. 在 `docs/test/` 下 **临时** 创建 `__acceptance-probe__.md`（勿登记 INDEX）。
2. 运行 `pnpm lint:docs-index`。
3. 阅读终端输出，确认报错 **点名未登记文件路径**。
4. 删除临时文件，再次运行 `pnpm lint:docs-index`（预期仍可能因其他未登记项失败——本步仅确认 probe 文件被检出）。

**预期结果**

- 步骤 2 exit code ≠ 0。
- 错误信息包含 `__acceptance-probe__.md` 或等效「未登记」提示，运维/开发者可据此修复。
- 步骤 4 删除 probe 后，报错列表中不再出现该文件名。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-005：spec-gap-audit 覆盖 v2.0 全量能力行

**追溯 AC**: AC-005

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-005 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/workflow/spec-gap-audit.md` 完整表已编写（T-008）

**步骤**

1. 打开 `docs/workflow/spec-gap-audit.md` 主差距表。
2. 确认 gap_id 从 **GAP-001 连续至 GAP-040**（共 40 行）。
3. 目视检查 `category` 列覆盖 **platform / node / help**（或等效分类）及 v2.0 关键模块（文档索引、E2E、帮助、Group Chat、Binary 等关键词至少各出现一次）。

**预期结果**

- 40 行差距项齐全，无重复 gap_id、无跳号。
- 能力面覆盖 v2.0 文档/E2E/节点/帮助等 FR 范围，与 PRD §5.1 描述一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-006：差距表每行 spec/现状/目标 M/E2E 列抽检

**追溯 AC**: AC-006

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-006 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- T-008 校验脚本可用：`node scripts/validate-spec-gap-audit.mjs`

**步骤**

1. 运行 `node scripts/validate-spec-gap-audit.mjs`，确认输出 `OK: 40 gap rows`。
2. 人工抽检 **GAP-001、GAP-010、GAP-020、GAP-030、GAP-040** 五行。
3. 每行确认含：**spec 引用**（spec_fr）、**现状**（code_status/gap）、**目标 Milestone**（target_m）、**E2E matrix 行 ID**（e2e_row_id）。

**预期结果**

- 脚本校验通过。
- 抽检 5 行均四列信息完整、E2E 行 ID 格式为 `E2E-P-nnn` 或 `E2E-N-*`。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-007：e2e-coverage-matrix 建立 v2.0 全功能行

**追溯 AC**: AC-007

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-007 |
| **matrix 行** | E2E-P-001～E2E-P-019 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/test/e2e-coverage-matrix.md` 已建立（T-004）
- 可选：`node scripts/validate-e2e-matrix.mjs`

**步骤**

1. 打开 matrix 主表，统计 **E2E-N-*** 节点行与 **E2E-P-*** 平台行。
2. 确认 M-1 阶段 `status` 列允许为 `uncovered`（初始基线）。
3. 运行 `node scripts/validate-e2e-matrix.mjs`（若可用），与人工计数交叉核对。

**预期结果**

- 节点行覆盖全部 nodeType 登记（`validate-e2e-matrix.mjs` 报告 **46 nodeType + 19 platform = 65 行**；可执行节点 45 类，`stickyNote` 除外见 PRD）。
- 平台能力行含 E2E-P-017（文档 INDEX/CI）等 PRD §5.1 所述基线项。
- 全功能行已列出，M-6 前允许未覆盖状态。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-008：matrix 列定义与表头一致

**追溯 AC**: AC-008

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-008 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/test/e2e-coverage-matrix.md` 含「列定义」节

**步骤**

1. 阅读 matrix「列定义」表中 7 列说明：`row_id`、`description`、`spec_fr`、`node_type`、`e2e_spec`、`status`、`track`。
2. 对照主矩阵表头，确认列名与顺序一致。
3. 抽检 3 行数据，确认 `description` 为人类可读功能描述，`track` 取值为 lite/standard/plus/any 之一。

**预期结果**

- 列定义与表头 **一一对应**，无缺失列。
- 数据行符合 NFR-04 轨标注约定。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-009：spec-reviewer 产出纳入差距审计引用

**追溯 AC**: AC-009

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-009 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/workflow/spec-gap-reviewer-output.md` 存在（T-003）

**步骤**

1. 打开 `docs/workflow/spec-gap-audit.md` 顶部「Spec-Reviewer 产出引用（AC-009）」节。
2. 点击链接打开 `spec-gap-reviewer-output.md`。
3. 核对审阅日期、范围（spec/PRD/superpowers specs）、40 行矩阵结论与 audit 表 GAP-001～040 一致。

**预期结果**

- AC-009 专节存在且链接有效。
- reviewer 产出与 audit 表行数、任务 ID（T-003）可追溯。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-010：本验收清单结构与 AC 映射自检

**追溯 AC**: AC-010

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-010 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 本文档路径为 `docs/test/milestones/M-1-acceptance.md`

**步骤**

1. 确认 frontmatter `ac_coverage` 含 **AC-001～AC-012** 共 12 项。
2. 确认「AC 映射摘要」表与 12 条用例 **追溯 AC** 字段一致。
3. 确认每条用例含 PRD §9.1 要求字段：ID、标题、前置、步骤、预期、所属轨、追溯、执行结果栏。

**预期结果**

- 清单满足 FR-12 / AC-010；后续 Milestone 可复用本模板结构。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-011：M-1 E2E 本地全绿与帮助页 UX 抽检

**追溯 AC**: AC-011

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-011 |
| **matrix 行** | E2E-P-017, E2E-P-007 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- M-1 E2E spec 已入库（T-014）：`docs-index-smoke.spec.ts`、`help-route-baseline.spec.ts`
- 本地 API + Web 可启动，或 CI 环境可跑 Playwright

**步骤**

1. 运行 `pnpm --filter @rxwf/web test:e2e`（或项目等效命令），确认 **全量套件 green**。
2. 手动打开 Web 帮助路由（如 `/help/zh/nodes/manualTrigger` 或基线 spec 覆盖路径）。
3. **UX 抽检**：Markdown 渲染可读（标题层级、代码块、链接）；非仅断言 HTTP 200。

**预期结果**

- E2E 命令 exit 0。
- 帮助页在浏览器中布局正常、中文内容可读；与 E2E 自动化断言形成互补。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M1-MAN-012：INDEX FR 与 nodeType 交叉引用导航 UX

**追溯 AC**: AC-012

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-012 |
| **matrix 行** | E2E-P-017 |
| **nodeType** | code, loop（抽检） |
| **所属轨** | Lite-only |

**前置条件**

- `docs/INDEX.md` 含「FR 与 nodeType 入口」节（T-010）

**步骤**

1. 打开 `docs/INDEX.md`，定位 **§ FR 与 nodeType 入口**。
2. 在「按 FR 编号」表点击 **FR-01**、**FR-06** 对应文档链接各 1 个。
3. 在「按 nodeType」表点击 **`code`**、**`loop`** 帮助文档链接。
4. 确认 YAML `entries` 中对应 `fr` / `nodeType` 字段与表格一致（抽检 2 条）。

**预期结果**

- 4 个链接均可达且内容为预期文档（非 404、非占位 `_待建_`）。
- 表格与 frontmatter entries 双向一致，满足 AC-012 可导航要求。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## 验收签字

| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 验收人 | | | ☐ 通过 M-1 ☐ 退回 |
| 开发确认 | | | 12/12 用例已执行 |
