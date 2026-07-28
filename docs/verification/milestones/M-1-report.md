# Milestone M-1 — 验证报告

> 本 milestone 一致性核对（轻量 scope）。全局报告见 `docs/verification/verification-report.md`。

## Milestone

- **ID**: M-1
- **名称**: 文档索引与 v2.0 差距审计
- **覆盖 AC**: AC-001～AC-012（本报告）；AC-070～AC-074 见「待人工验收项」
- **关联任务**: T-001～T-015（15/15 `done`）
- **测试报告**: `docs/test/milestones/M-1-report.md`（结论 `passed`）
- **人工验收清单**: `docs/test/milestones/M-1-acceptance.md`

---

## 验收标准核对（AC-001～AC-012）

| AC-ID | 描述摘要 | 状态 | 交付物 / 证据 |
|-------|----------|------|---------------|
| AC-001 | `docs/INDEX.md` 含 YAML frontmatter + 人类可读总目录 | **met** | `docs/INDEX.md` 存在；frontmatter 含 `version`/`categories`/`entries`；人类章节可导航 |
| AC-002 | `docs/README.md` 分类、摘要、维护规则 | **met** | `docs/README.md` 含「分类目录」「维护规则」≥5 条（含 `pnpm lint:docs-index`） |
| AC-003 | 主要子目录 README 链回 INDEX | **met** | `architecture/`、`requirements/`、`test/`、`help/`、`workflow/` 五份 README 均链回 `../INDEX.md` |
| AC-004 | 未登记 `.md` 导致 CI/脚本校验失败 | **met** | `scripts/lint-docs-index.mjs` + `.github/workflows/ci.yml` 接线；`lint-docs-index.test.mjs` 2/2 pass；全仓 271 篇未登记属 T-166 预期，不否定脚本能力 |
| AC-005 | `spec-gap-audit.md` 覆盖 v2.0 全量能力行 | **met** | `docs/workflow/spec-gap-audit.md`；`validate-spec-gap-audit.mjs` → `OK: 40 gap rows (GAP-001～GAP-040)` |
| AC-006 | 差距表每行含 spec/现状/目标 M/E2E 行 ID | **met** | 列定义齐全；脚本校验 40 行；抽检 GAP-001/010/020/030/040 四列完整 |
| AC-007 | `e2e-coverage-matrix.md` 建立 v2.0 全功能行 | **met** | `docs/test/e2e-coverage-matrix.md`；`validate-e2e-matrix.mjs` → `OK: 65 rows (46 nodeType + 19 platform)` |
| AC-008 | matrix 列定义齐全 | **met** | 7 列：row_id、description、spec_fr、node_type、e2e_spec、status、track；与表头一致 |
| AC-009 | spec-reviewer 产出纳入审计引用 | **met** | audit 顶部「Spec-Reviewer 产出引用（AC-009）」节；链至 `spec-gap-reviewer-output.md`（T-003） |
| AC-010 | `M-1-acceptance.md` 人工验收用例已编写 | **met** | `docs/test/milestones/M-1-acceptance.md`；frontmatter 含 AC-001～012；12 条用例 M1-MAN-001～012 |
| AC-011 | M-1 E2E 入库且套件 green | **partial** | 三份 spec 已入库（`docs-index-smoke`、`help-route-baseline`、`workflow-manual-node`）；**lite 轨 20/20 pass**（tester 复跑）；全量 `pnpm test:e2e` 未在本轮 verifier 复跑，M1-MAN-011 待人工 |
| AC-012 | INDEX 含 FR 与 nodeType 交叉引用 | **met** | `docs/INDEX.md` §「FR 与 nodeType 入口」；YAML entries 含 `fr`/`nodeType` 字段 |

**AC-001～012 汇总**：11 met、1 partial（AC-011 自动化子集已绿，全量套件 + UX 人工待验）。

---

## TDD + Task 基本验证追溯

| 范围 | 证据 | 审查 |
|------|------|------|
| T-001～T-015 | `docs/test/milestones/M-1-report.md` §「TDD 证据审查」 | ✅ 15/15 任务 Red/Green + Task Verify 齐全 |
| Scripts | 16 pass / 0 fail（lint-docs-index、validate-e2e-matrix、validate-spec-gap-audit、e2e-compose、ci-docs-index） | ✅ verifier 复跑 matrix/gap 校验 OK |
| E2E lite | 20 pass / 0 fail（help-route-baseline 6 + docs-index-smoke 13 + workflow-manual-node 1） | ✅ 与 tester 报告一致 |
| T-015 清单 | M-1-acceptance 12 AC 映射 | ✅ 结构、字段、签字栏就绪 |

---

## 架构符合性（M-1 范围）

| 架构项 | 要求 | 符合性 |
|--------|------|--------|
| FR-01 文档索引 | INDEX + README + 子目录链回 + lint 脚本 | ✅ |
| FR-02 差距审计 | `spec-gap-audit.md` 为单一真相源，40 行，与 matrix 互链 | ✅ |
| FR-03 覆盖矩阵 | 65 行基线，status 允许 uncovered | ✅ |
| FR-04 CI 索引门禁 | `pnpm lint:docs-index` in CI | ✅（全量登记 deferred T-166） |
| FR-12 人工验收清单 | M-1-acceptance.md | ✅ |
| FR-13 E2E 只增不减 | M-1 新增 3 spec + global-setup/teardown 扩展 | ✅ |
| FR-14 compose 生命周期 | `scripts/e2e-compose.mjs` + global-setup/teardown 测试 | ✅（e2e-compose.test.mjs 8/8） |
| §10 INDEX 规范 | frontmatter + FR/nodeType 交叉引用 | ✅ |

**备注**：差距表部分 `code_status` 仍为审计时点快照（如 GAP-001「文件不存在」），`audit_status=open` 表示跨 Milestone 跟踪，不否定 M-1 交付物已落地。

---

## 缺口清单（非阻断，放行前须知）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-070 | 12 条人工用例 **尚未执行/签字** | 验收人 |
| AC-071 | 用户尚未执行 **`验收 M-1`** | 验收人 |
| AC-011 全量 E2E | lite 轨已绿；裸 `pnpm test:e2e` 存在 `*.test.ts` 被 Playwright 扫描风险（tester 已知项） | 人工 M1-MAN-011 |
| lint:docs-index 全绿 | 271 篇 md 未登记 INDEX；CI 合并仍将红直至 T-166 | M-6 |
| AC-072/073/074 | 合入主分支、compose 无泄漏、双轨验收 | 人工验收 M-1 阶段 |

---

## recommendedPhase

`none`

（交付物与自动化证据满足 M-1 轻量验证；无架构/任务/开发回退必要项。）

---

## 结论

`passed`

---

**验证时间**: 2026-06-18  
**验证角色**: verifier（milestone scope，轻量）  
**下一步**: `milestones[M-1].status` → `gate_pending`；`gate.status` 保持 `pending`；等待用户执行 12 条人工用例 + `验收 M-1`。
