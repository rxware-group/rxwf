# Milestone M-6 — 验证报告

> 本 milestone 一致性核对。全局报告见 `docs/verification/verification-report.md`。

## Milestone

- **ID**: M-6
- **名称**: 帮助全覆盖与最终回归
- **分支**: `milestone/m-6-help`
- **覆盖 AC**: AC-057～AC-069（功能交付）；AC-070（门禁，**met** @ 2026-06-18）
- **关联任务**: T-115～T-168（54/54 `done`）
- **测试报告**: `docs/test/milestones/M-6-report.md`（结论 `passed`）
- **人工验收清单**: `docs/test/milestones/M-6-acceptance.md`

---

## 帮助全覆盖范围核对

| 交付面 | 范围 | 状态 | 证据 |
|--------|------|------|------|
| **45 篇节点帮助** | `docs/help/zh/nodes/<type>.md` | **met** | T-115～T-159；批量 validate **45/45** |
| **help-registry** | 45 nodeType → 文件路径 | **met** | T-160 `NODE_HELP_PATH`；completeness.test 1/1 |
| **HELP_NAV** | 45 项 + meta 标签 | **met** | T-161 `buildNodeHelpNavItems()`；help-nav.test 4/4 |
| **编辑器帮助跳转** | E2E-P-008 | **met** | T-162 `build-help-url.ts`；platform-capabilities E2E |
| **帮助 E2E 路由** | 45 `/help/nodes/*` | **met** | T-163 `help-all-nodes.spec.ts` 46/46 |
| **matrix 100%** | 65 行 covered | **met** | T-165 `--require-full` OK |
| **INDEX 登记** | 全 docs | **met** | T-166 `lint:docs-index` 395 OK |
| **spec-gap closed** | 无 open | **met** | T-167 `--require-closed` OK |

**范围备注（partial，不阻断 M-6 核心）**：

- **`skillRun.md`**：M-2 遗留短文，未达 OQ-007 质量门槛；列入 `ALLOWED_EXTRA_NODE_HELP_DOCS`，不在 45 registry。
- **GAP-02 Standard blob**：仍为 planned（M-5 延续），与帮助 milestone 无关。

---

## 验收标准核对（AC-057～AC-069）

| AC-ID | 描述摘要 | 状态 | 交付物 / 证据 |
|-------|----------|------|---------------|
| AC-057 | 45 nodeType 独立 help 文 | **partial** | 45/45 文件 + E2E 路由 green；**正文 UX 可读性** 待 M6-MAN-001 人工 |
| AC-058 | help-registry 一一映射 | **met** | registry.test + completeness.test green |
| AC-059 | 帮助质量 ≥300 字 + 示例 | **met** | validate-help-doc 45/45 |
| AC-060 | 编辑器帮助按钮跳转 | **partial** | E2E-P-008 green；**新 Tab/nav UX** 待 M6-MAN-004 |
| AC-061 | HELP_NAV 与 meta 对齐 | **partial** | help-nav.test + nav 标签来自 meta；侧栏 45 项待 M6-MAN-005 |
| AC-062 | registry 完整性单测 | **met** | help-registry-completeness.test.ts 1/1 |
| AC-063 | matrix 100% 无 skip | **met** | `--require-full` 65 rows |
| AC-064 | Standard+Plus E2E CI | **partial** | 本机 standard compose **blocked**（Docker daemon）；lite 帮助路径 green |
| AC-065 | 本验收清单全通过 | **met** | 用户 `验收 M-6` @ 2026-06-18 |
| AC-066 | 全量 E2E green | **partial** | lite **247/248** 可执行 pass；1 postgres infra |
| AC-067 | INDEX 全 docs 登记 | **met** | lint:docs-index 395 OK |
| AC-068 | spec-gap 无 open | **met** | `--require-closed` OK |
| AC-069 | 测试/验证报告就绪 | **met** | 本报告 + M-6-report.md + 门禁 test.mjs |

**AC-057～069 汇总**：8 met、4 partial、0 pending。

---

## 门禁 AC 核对（AC-070）

| AC-ID | 描述摘要 | 状态 | 说明 |
|-------|----------|------|------|
| AC-070 | 人工验收用例清单存在且 **全部通过** | **met** | 用户 `验收 M-6` @ 2026-06-18 |

---

## TDD + Task 基本验证追溯

| 波次 | Task 范围 | 状态 | verifier 审查 |
|------|-----------|------|---------------|
| Wave 22 | T-115～T-159 帮助文档 | done | ✅ 45/45 validate |
| Wave 23 | T-160～T-162 registry/nav | done | ✅ 单元 green |
| Wave 24 | T-163～T-164 E2E/completeness | done | ✅ help-all-nodes 46/46 |
| Wave 25 | T-165～T-167 matrix/INDEX/gap | done | ✅ 三门禁 green |
| Wave 26 | T-168 报告/回归 | done | ✅ M-6-report + lite 247/248 |

---

## 缺口清单（放行前须知）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-065 / AC-070 | 12 条人工用例 | **accepted** @ 2026-06-18 | 验收人 |
| AC-064 standard/plus | Docker 就绪后复跑双轨 E2E | 验收人 / CI |
| AC-066 lite postgres | lite 轨 `@any` postgres 无 DB — infrastructure | 已知项 |
| AC-071 | 用户 **`验收 M-6`** | **done** | — |
| skillRun.md | M-2 遗留，非 45 registry | 后续 milestone / OQ-007 |

---

## recommendedPhase

`none`

（M-6 帮助核心交付与自动化证据满足验证要求；partial 项为 compose 基础设施、postgres lite infra 与人工门禁，不构成 development 回退必要项。）

---

## 结论

`passed`

---

**验证时间**: 2026-06-21  
**验证角色**: verifier（milestone scope）  
**verifier 独立复跑**: `M-6-acceptance.test.mjs` 2/2；`M-6-report.test.mjs` 2/2；`validate-e2e-matrix.mjs --require-full` OK；`validate-spec-gap-audit.mjs --require-closed` OK；`lint:docs-index` OK  
**下一步**: `milestones[M-6].gate.status` = **approved**；全部 milestone accepted；等待 `gates.finalAcceptance` 及 CI standard/plus compose 复跑。
