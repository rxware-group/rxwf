---
milestone: M-2
version: 1
updated: 2026-06-20
ac_coverage:
  - AC-013
  - AC-014
  - AC-015
  - AC-016
  - AC-017
  - AC-018
  - AC-019
  - AC-020
  - AC-021
  - AC-022
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
---

# M-2 人工验收用例

> **Milestone**：M-2 — v2.0 半实现项补齐（skillRun 子能力、ACL、credential-types、switch 动态分支）  
> **追溯**：FR-05, FR-15 / AC-013～022 / PRD §5.2、§9  
> **E2E 互补**（OQ-009）：本清单侧重 E2E **无法覆盖** 的 **UX**、**文档可读性**、**本地环境验证** 与 **边界场景**；与 `skill-run-tools.spec.ts`、`workflow-acl.spec.ts`、`credential-types.spec.ts`、`switch-dynamic.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-2`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix 行 | E2E 互补说明 |
|----|--------|----------|-----------|--------------|
| AC-013 | skillRun write/grep/web_search 子能力 | M2-MAN-001 | E2E-N-skillRun | E2E 验执行；人工验 **帮助文档与 Tool 卫星接线 UX** |
| AC-014 | 工作流 ACL Owner/Editor/Viewer | M2-MAN-002 | E2E-P-018 | E2E 验 API；人工验 **协作者面板 UX 与权限文案** |
| AC-015 | credential-types 注册表落地 | M2-MAN-003 | E2E-P-011 | E2E 验 CRUD；人工验 **设置页表单可读性与字段说明** |
| AC-016 | switch 动态分支 | M2-MAN-004 | E2E-N-switch | E2E 验路由；人工验 **SwitchBranchesPanel 与帮助文档** |
| AC-017 | spec-gap-audit M-2 项 done | M2-MAN-005 | — | 人工 **GAP-007～010、025 状态抽检** |
| AC-018 | matrix M-2 交付 100% E2E 覆盖 | M2-MAN-006 | E2E-N-skillRun, E2E-N-switch, E2E-P-011, E2E-P-018 | 人工 **矩阵 status 列与 spec 行对照** |
| AC-019 | 本验收清单已编写 | M2-MAN-007 | — | 人工 **清单结构自检**（meta） |
| AC-020 | 全量 E2E green | M2-MAN-008 | E2E-P-017 等 | E2E 验 green；人工验 **本地环境可复现** |
| AC-021 | schemaVersion:1 导入回归 | M2-MAN-009 | — | 人工 **导入 UX 与兼容性边界** |
| AC-022 | 帮助/INDEX 已同步 | M2-MAN-010 | E2E-P-007, E2E-P-017 | E2E 验路由；人工验 **参数变更项文档可读性** |

---

## 用例清单

### M2-MAN-001：skillRun Tool 卫星帮助文档与接线 UX

**追溯 AC**: AC-013

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-013 |
| **matrix 行** | E2E-N-skillRun |
| **nodeType** | skillRun, toolWrite, toolGrep, toolWebSearch |
| **所属轨** | Plus |

**前置条件**

- 仓库 checkout 至 `milestone/m-2-semi-impl` 分支
- Web 可启动；工作区已配置 `.rxwf/skills/`

**步骤**

1. 打开 `docs/help/zh/nodes/skillRun.md`，确认含 **toolWrite / toolGrep / toolWebSearch** 显式卫星说明及 **无 Builtin 隐式工具** 提示。
2. 在浏览器打开 `/help/zh/nodes/skillRun`，确认 Markdown 渲染可读（表格、代码块、链接）。
3. 编辑器新建工作流：添加 `skillRun` + `aiChatModel`，再添加 `toolWrite`、`toolGrep`、`toolWebSearch` 并 **ai_tool** 连至 skillRun。
4. 打开 skillRun 参数面板，确认 **skillSource**、**timeoutMs 默认 -1** 等字段与帮助一致。

**预期结果**

- 帮助文档 ≥300 字，含 M-2 参数变更说明。
- 画布可显式接线三类 Tool 卫星，无「自动启用 Builtin」开关。
- 帮助页与编辑器参数命名一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-002：工作流协作者面板 ACL UX

**追溯 AC**: AC-014

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-014 |
| **matrix 行** | E2E-P-018 |
| **nodeType** | — |
| **所属轨** | Standard |

**前置条件**

- 至少两个用户账号（Owner + 受邀用户）
- `WorkflowCollaboratorsPanel` 已集成（T-025）

**步骤**

1. 以 Owner 打开工作流编辑器，展开 **协作者** 面板。
2. 添加 Editor 与 Viewer 各一名，确认角色下拉含 **Owner / Editor / Viewer** 且文案可读。
3. 以 Editor 登录，确认可编辑但不可管理协作者；以 Viewer 登录，确认只读。
4. 阅读帮助或面板内提示，确认权限差异有说明。

**预期结果**

- 三种角色 UX 区分清晰，无静默越权。
- 面板加载/错误状态有用户可读反馈（非仅 console）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-003：credential-types 设置页文档与表单 UX

**追溯 AC**: AC-015

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-015 |
| **matrix 行** | E2E-P-011 |
| **nodeType** | — |
| **所属轨** | Standard |

**前置条件**

- API + Web 可启动；credential-types 注册表已加载（T-019/T-027）

**步骤**

1. 打开 **设置 → 凭证类型**（或等效入口）。
2. 浏览至少 2 种凭证类型的字段 schema（标签、必填、类型）。
3. 创建一条测试凭证，确认动态表单与 schema 一致。
4. 在 HTTP 节点参数中引用该凭证，确认下拉/选择 UX 可读。

**预期结果**

- 字段标签与帮助/placeholder 可理解，无裸 JSON key 暴露给用户。
- 创建失败时错误信息可读（含字段级提示为佳）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-004：switch 动态分支面板与帮助文档

**追溯 AC**: AC-016

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-016 |
| **matrix 行** | E2E-N-switch |
| **nodeType** | switch |
| **所属轨** | Lite-only |

**前置条件**

- 编辑器可打开 switch 节点（T-023 SwitchBranchesPanel）

**步骤**

1. 打开 `docs/help/zh/nodes/switch.md`，确认 **`branches[]`** 模型、**首条匹配**、**无匹配丢弃**（无 fallback）说明。
2. 浏览器打开 `/help/zh/nodes/switch`，确认渲染正常。
3. 编辑器添加 switch 节点，打开 **SwitchBranchesPanel**：添加 3 条分支，编辑 **label** 与 **condition**。
4. 删除中间分支，确认对应出边被清理（或提示）。
5. 保存后重新打开，确认 branches 持久化。

**预期结果**

- 帮助与 UI 均反映 M-2 动态分支模型（非 outputCount/fallbackOutput 旧参数）。
- 面板支持增删改排序，端口 label 可编辑且 id 稳定。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-005：spec-gap-audit M-2 差距项状态

**追溯 AC**: AC-017

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-017 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/workflow/spec-gap-audit.md` 已更新（T-032）

**步骤**

1. 运行 `node scripts/validate-spec-gap-audit.mjs --milestone M-2`。
2. 人工打开 audit 表，定位 **GAP-007、GAP-008、GAP-009、GAP-010、GAP-025**。
3. 确认上述行 `target_m` 含 M-2 且 `code_status` / 状态列为 **done** 或等效已关闭。

**预期结果**

- 校验脚本 exit 0。
- M-2 归属五项差距均已标记完成，与 PRD §5.2 一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-006：e2e-coverage-matrix M-2 行覆盖状态

**追溯 AC**: AC-018

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-018 |
| **matrix 行** | E2E-N-skillRun, E2E-N-switch, E2E-P-011, E2E-P-018 |
| **nodeType** | skillRun, switch |
| **所属轨** | Lite-only / Standard / Plus |

**前置条件**

- `docs/test/e2e-coverage-matrix.md` 已更新（T-032）

**步骤**

1. 打开 matrix，定位 M-2 交付相关行：E2E-N-skillRun、E2E-N-switch、E2E-P-011、E2E-P-018。
2. 确认 `status` 列为 **covered**，`e2e_spec` 列非空且指向现有 spec 文件。
3. 运行 `node scripts/validate-e2e-matrix.mjs`（若可用）交叉核对。

**预期结果**

- M-2 交付功能在 matrix 中 **100% 有对应 E2E 行且已覆盖**。
- spec 路径与 `apps/web/e2e/` 实际文件一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-007：本验收清单结构与 AC 映射自检

**追溯 AC**: AC-019

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-019 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 本文档路径为 `docs/test/milestones/M-2-acceptance.md`

**步骤**

1. 确认 frontmatter `ac_coverage` 含 **AC-013～AC-022** 共 10 项。
2. 确认「AC 映射摘要」表与 10 条用例 **追溯 AC** 字段一致。
3. 确认每条用例含 PRD §9.1 要求字段：ID、标题、前置、步骤、预期、所属轨、追溯、执行结果栏。

**预期结果**

- 清单满足 FR-12 / AC-019；结构与 M-1 模板一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-008：M-2 本地全量 E2E green

**追溯 AC**: AC-020

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-020 |
| **matrix 行** | E2E-P-017, E2E-P-007 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- M-2 E2E spec 已入库：skill-run-tools、workflow-acl、credential-types、switch-dynamic（T-028～T-030）
- 本地 API + Web + 依赖可启动

**步骤**

1. 运行 `pnpm --filter @rxwf/web test:e2e`（或项目等效命令）。
2. 确认 exit code 0，含 M-1 基线用例仍 green。
3. 若失败，记录 spec 名称与环境差异（Docker/凭证/mock）。

**预期结果**

- 全量 E2E 套件 green，含 M-2 新增场景。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-009：schemaVersion:1 工作流导入回归（边界）

**追溯 AC**: AC-021

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-021 |
| **matrix 行** | — |
| **nodeType** | switch, skillRun |
| **所属轨** | Standard |

**前置条件**

- M-2 导入回归 fixture 可用（T-031）；含 switch branches 与 skillRun 卫星接线

**步骤**

1. 在编辑器 **导入** 含 M-2 变更节点的 `schemaVersion: 1` 工作流 JSON。
2. 确认无静默丢字段：switch 含 `branches[]`；skillRun 含 `skillSource` 等。
3. 打开各节点参数面板，确认 UI 可编辑且保存后再导出 JSON 结构一致。
4. 尝试导入含已废弃字段（如 switch `outputCount`）的旧 JSON，确认有明确错误或迁移提示。

**预期结果**

- 合法 v1 工作流导入 UX 顺畅，M-2 节点参数完整。
- 废弃字段不导致静默损坏（报错或忽略有说明）。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M2-MAN-010：M-2 帮助文档与 INDEX 同步可读性

**追溯 AC**: AC-022

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-022 |
| **matrix 行** | E2E-P-007, E2E-P-017 |
| **nodeType** | switch, skillRun |
| **所属轨** | Lite-only |

**前置条件**

- `docs/INDEX.md` 已登记 M-2 相关条目（T-033）
- `pnpm lint:docs-index` 对本 task 变更文件无 orphan 报错（全 repo 未登记项另计）

**步骤**

1. 打开 `docs/INDEX.md`，确认 YAML `entries` 含 `docs/test/milestones/M-2-acceptance.md` 及 switch/skillRun 帮助条目（milestone 含 M-2）。
2. 在 INDEX 人类可读「测试与验收」节点击 M-2 验收清单链接。
3. 从 INDEX「按 nodeType」表点击 `switch`、`skillRun` 帮助链接，对照参数变更段落（branches / toolWrite 等）。
4. 运行内联 AC-022 校验（见 T-033 Task 基本验证）确认 help 同步标记通过。

**预期结果**

- INDEX 与帮助文档双向一致，M-2 参数/行为变更已反映。
- 帮助页无过时 fallback/Builtin 描述。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## 验收签字

| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 验收人 | | | ☐ 通过 M-2 ☐ 退回 |
| 开发确认 | | | 10/10 用例已执行 |
