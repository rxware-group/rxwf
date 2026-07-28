---
milestone: M-6
version: 1
updated: 2026-06-21
ac_coverage:
  - AC-057
  - AC-058
  - AC-059
  - AC-060
  - AC-061
  - AC-062
  - AC-063
  - AC-064
  - AC-065
  - AC-066
  - AC-067
  - AC-068
  - AC-069
  - AC-070
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
---

# M-6 人工验收用例

> **Milestone**：M-6 — 帮助全覆盖与最终回归  
> **追溯**：FR-06～08, FR-19 / AC-057～069, AC-070 / PRD §5.6、§9  
> **E2E 互补**（OQ-009）：本清单侧重 **帮助可读性**、**INDEX/registry 一致性**、**matrix 100% 对照** 与 **编辑器帮助跳转 UX**；与 `help-all-nodes.spec.ts`、`platform-capabilities.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-6`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix / 脚本 | E2E 互补说明 |
|----|--------|----------|---------------|--------------|
| AC-057 | 45 nodeType 独立 help 文 | M6-MAN-001 | — | E2E 验路由；人工验 **正文可读性/示例可复制** |
| AC-058 | help-registry 一一映射 | M6-MAN-002 | — | 单元测 green；人工 **随机 5 type 对照 registry** |
| AC-059 | 帮助质量门槛 ≥300 字 | M6-MAN-003 | validate-help-doc.mjs | 脚本验结构；人工 **抽 3 篇 UX 阅读** |
| AC-060 | 编辑器帮助按钮跳转 | M6-MAN-004 | E2E-P-008 | E2E 验 URL；人工验 **新 Tab 与 nav 高亮** |
| AC-061 | HELP_NAV 与 meta 对齐 | M6-MAN-005 | — | 人工 **侧栏 45 项标签与 palette 一致** |
| AC-062 | registry 完整性单测 | M6-MAN-006 | completeness.test.ts | 脚本 green；人工 **抽检 meta↔文件** |
| AC-063 | matrix 100% 无 skip | M6-MAN-007 | `--require-full` | 人工 **matrix status/spec 列对照** |
| AC-064 | Standard+Plus E2E CI | M6-MAN-008 | — | 人工 **本地 standard 轨抽样 green** |
| AC-065 | 本验收清单全通过 | M6-MAN-009 | — | meta 自检 |
| AC-066 | 全量 E2E green | M6-MAN-008 | — | lite 全绿；人工 **无 help 回归** |
| AC-067 | INDEX 全 docs 登记 | M6-MAN-010 | lint:docs-index | CI 脚本 green |
| AC-068 | spec-gap 无 open | M6-MAN-011 | `--require-closed` | 人工 **GAP 表 deferred 边界可读** |
| AC-069 | 测试/验证报告就绪 | M6-MAN-012 | M-6-report.md | 人工 **报告路径与结论** |
| AC-070 | Milestone 人工用例全通过 | M6-MAN-009 | — | 放行门禁 |

---

## 用例清单

### M6-MAN-001：45 篇节点帮助可读性抽检

**追溯 AC**: AC-057, AC-059

| 字段 | 值 |
|------|-----|
| **nodeType 抽检** | `manualTrigger`, `httpRequest`, `aiAgent`, `toolGrep`, `groupChat` |
| **所属轨** | Lite |

**步骤**

1. 应用内打开 `/help/nodes/manualTrigger` … `groupChat` 共 5 篇。
2. 确认每篇含 **用途、端口、参数、常见错误、示例 A/B/C**。
3. 对照画布添加同名节点，确认术语与面板字段一致。

**期望**：5 篇均可读、无占位短文；示例 JSON/步骤可跟做。

---

### M6-MAN-002：help-registry 与文件路径对照

**追溯 AC**: AC-058

**步骤**

1. 打开 `apps/web/src/features/help/help-doc-node-types.ts`，确认 45 项。
2. 随机抽 5 个 type，确认 `docs/help/zh/nodes/<type>.md` 存在且 `/help/nodes/<type>` 可打开。

**期望**：无孤儿 registry 项、无 404 help 路由。

---

### M6-MAN-003：validate-help-doc 全量 green

**追溯 AC**: AC-059

**步骤**

1. 运行 `node scripts/validate-help-doc.test.mjs`（exit 0）。
2. 对 T-115～159 对应 45 文件批量 validate（Wave 22 已绿）。

**期望**：45/45 pass；`skillRun.md` 若未扩写则不在 45 registry 范围内。

---

### M6-MAN-004：节点编辑器帮助按钮 UX

**追溯 AC**: AC-060

**步骤**

1. 编辑器打开任意工作流，双击 `IF` 节点。
2. 点击模态框 **?** 帮助按钮。
3. 确认新 Tab 打开 `/help/nodes/if`，且帮助侧栏 IF 项高亮。

**期望**：跳转正确、无 `/help` 首页 fallback。

---

### M6-MAN-005：HELP_NAV 与 palette 标签一致

**追溯 AC**: AC-061

**步骤**

1. 打开 `/help/nodes/code`，展开侧栏 **节点** 分组。
2. 对照编辑器节点 palette 中 `Code`、`HTTP Request`、`Tool (Read)` 等 **label**。

**期望**：侧栏 45 项 label 与 `node-type-meta` 一致（非 i18n 硬编码旧 key）。

---

### M6-MAN-006：registry completeness 单元测试

**追溯 AC**: AC-062

**步骤**

1. 运行 `pnpm --filter @rxwf/web test completeness`（exit 0）。

**期望**：meta ↔ registry ↔ disk ↔ bundle 无 mismatch。

---

### M6-MAN-007：e2e-coverage-matrix 100%

**追溯 AC**: AC-063

**步骤**

1. 运行 `node scripts/validate-e2e-matrix.mjs --require-full`（exit 0）。
2. 打开 `docs/test/e2e-coverage-matrix.md`，确认无 `uncovered` / `skip`。

**期望**：64 行（45 node + 19 platform）均为 `covered`。

---

### M6-MAN-008：lite 全量 E2E 回归

**追溯 AC**: AC-064, AC-066

**步骤**

1. 运行 `pnpm --filter @rxwf/web test:e2e`（lite 轨，exit 0）。
2. （可选）Docker 可用时跑 standard 轨 help/platform 子集。

**期望**：help-all-nodes、platform-capabilities、help-route-baseline green。

---

### M6-MAN-009：本清单 meta 自检

**追溯 AC**: AC-065, AC-070

**步骤**

1. 确认上文 12 条用例均已执行并记录通过。
2. 用户在 chat 发送 `验收 M-6`。

**期望**：全部勾选后可放行 M-6 gate。

---

### M6-MAN-010：INDEX lint green

**追溯 AC**: AC-067

**步骤**

1. 运行 `pnpm lint:docs-index`（exit 0）。

**期望**：0 unregistered、0 orphan entries。

---

### M6-MAN-011：spec-gap-audit 无 open

**追溯 AC**: AC-068

**步骤**

1. 运行 `node scripts/validate-spec-gap-audit.mjs --require-closed`（exit 0）。
2. 阅读 deferred 项（GAP-015～021 等），确认均为 **v2.0+ 边界** 且 notes 可读。

**期望**：无 `audit_status=open`；M-6 交付项均为 `done`。

---

### M6-MAN-012：M-6 测试/验证报告路径

**追溯 AC**: AC-069

**步骤**

1. 确认 Wave 26（T-168）将写入 `docs/test/milestones/M-6-report.md` 与 `docs/verification/milestones/M-6-report.md`。
2. 本验收执行前可先以 lite E2E + 本清单作为 interim 证据。

**期望**：报告路径与 plan 一致，结论 pending 直至 tester/verifier 完成。

---

## 验收签字

| 角色 | 日期 | 结论 |
|------|------|------|
| 验收人 | 2026-06-18 | ☑ 通过 M-6 |
| 开发确认 | 2026-06-18 | 12/12 用例已执行（用户 `验收 M-6`） |

---

*清单版本 1 · M-6 Wave 25（T-167）· 与 E2E/matrix/gap 脚本互链*
