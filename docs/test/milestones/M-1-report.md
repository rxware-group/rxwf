# Milestone M-1 — 测试报告

> 本 milestone 集成/E2E/回归测试报告。全局报告见 `docs/test/test-report.md`。

## Milestone

- **ID**: M-1
- **名称**: 文档索引与 v2.0 差距审计
- **覆盖 AC**: AC-001～AC-012、AC-070～AC-074（自动化可验证子集；AC-070/071 人工验收见阻塞项）
- **关联任务**: T-001～T-015（15/15 `done`）

## 测试范围

| 类别 | 范围 | 命令 |
|------|------|------|
| Scripts 单元/校验 | lint-docs-index、validate-e2e-matrix、validate-spec-gap-audit、e2e-compose、ci-docs-index | 见「执行结果」 |
| E2E（lite 轨） | `help-route-baseline`、`docs-index-smoke`、`workflow-manual-node` | `RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web exec playwright test e2e/help-route-baseline.spec.ts e2e/docs-index-smoke.spec.ts e2e/workflow-manual-node.spec.ts` |
| 矩阵对照 | E2E-P-007、E2E-P-017、E2E-P-001（manual 节点） | `docs/test/e2e-coverage-matrix.md` |

## 执行结果

### Scripts（16 pass / 0 fail）

| 命令 | 结果 |
|------|------|
| `node --test scripts/lint-docs-index.test.mjs` | 2 passed, 0 failed |
| `node scripts/validate-e2e-matrix.mjs --test` | 2 passed, 0 failed |
| `node scripts/validate-e2e-matrix.mjs` | `OK: 65 rows (46 nodeType + 19 platform capabilities)` |
| `node scripts/validate-spec-gap-audit.mjs --test` | 2 passed, 0 failed |
| `node scripts/validate-spec-gap-audit.mjs` | `OK: 40 gap rows (GAP-001～GAP-040)` |
| `node --test scripts/e2e-compose.test.mjs` | 8 passed, 0 failed |
| `node scripts/ci-docs-index.test.mjs` | 2 passed, 0 failed |

**说明**：`pnpm lint:docs-index` 在真实仓库仍 exit 1（271 篇未登记 md），属 T-166 全量登记前预期行为；AC-004 阻塞语义由单元测试与 CI 门禁测试覆盖，不视为本 milestone 自动化失败。

### E2E lite 轨（20 pass / 0 fail，21.7s）

```
Running 20 tests using 3 workers
  ok  1 [lite-setup] auth.setup.ts › authenticate (2.1s)
  ok  2～20 [lite-chromium] help-route-baseline / docs-index-smoke / workflow-manual-node
  20 passed (21.7s)
```

| Spec | 用例数 | matrix 行 |
|------|--------|-----------|
| `help-route-baseline.spec.ts` | 6 | E2E-P-007 |
| `docs-index-smoke.spec.ts` | 13 | E2E-P-017 |
| `workflow-manual-node.spec.ts` | 1 | E2E-P-001（编辑器基线） |

## TDD 证据审查（T-001～T-015）

| Task | TDD Red/Green | Task 基本验证 | 审查 |
|------|---------------|---------------|------|
| T-001 | README.test.mjs Red→Green | 5/5 pass | ✅ |
| T-002 | 内联 INDEX 校验 Red→Green | parseIndex entries=24 | ✅ |
| T-003 | 内联 GAP 校验 | reviewer 产出 40 行 | ✅ |
| T-004 | validate-e2e-matrix `--test` Red→Green | OK: 65 rows | ✅（ tester 复跑一致） |
| T-005 | lint-docs-index.test.mjs | 2 passed | ✅（ tester 复跑一致） |
| T-006 | e2e-compose.test.mjs | 8 passed | ✅（ tester 复跑一致） |
| T-007 | 内联 AC-003 脚本 | 5/5 README 链回 | ✅ |
| T-008 | validate-spec-gap-audit `--test` | OK: 40 gap rows | ✅（ tester 复跑一致） |
| T-009 | ci-docs-index.test.mjs | 2 passed + CI 接线 | ✅（ tester 复跑一致） |
| T-010 | cross-ref 校验 + lint 单测 | FR/nodeType 节 | ✅ |
| T-011 | global-setup.test.ts | 7 passed | ✅ |
| T-012 | global-teardown.test.ts | 3 passed | ✅ |
| T-013 | playwright.config.test.ts | 6 passed | ✅ |
| T-014 | help/docs-index spec Red→Green | 20 passed（developer） | ✅（ tester 复跑 20 passed） |
| T-015 | M-1-acceptance 清单校验 | 12 AC 映射 | ✅ |

**结论**：15/15 任务 TDD 与 Task 基本验证证据齐全；无缺失 Red/Green 或未填 Verify 表。

## 用例列表

| ID | 类型 | 关联 AC | 结果 | 备注 |
|----|------|---------|------|------|
| SCR-001 | scripts | AC-004 | pass | lint-docs-index.test.mjs |
| SCR-002 | scripts | AC-007, AC-008 | pass | validate-e2e-matrix |
| SCR-003 | scripts | AC-005, AC-006 | pass | validate-spec-gap-audit |
| SCR-004 | scripts | AC-073 | pass | e2e-compose.test.mjs |
| SCR-005 | scripts | AC-004 | pass | ci-docs-index.test.mjs |
| E2E-001 | E2E lite | AC-011 | pass | help-route-baseline（6） |
| E2E-002 | E2E lite | AC-011, AC-012 | pass | docs-index-smoke（13） |
| E2E-003 | E2E lite | AC-011 | pass | workflow-manual-node（1） |

## 失败项

无（本 scope 自动化测试全部通过）。

## 阻塞项（非自动化失败，放行前须处理）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-070 | `M-1-acceptance.md` 12 条人工用例尚未执行/签字 | 验收人 |
| AC-071 | 用户尚未执行 `验收 M-1` | 验收人 |
| lint:docs-index 全绿 | 271 篇 md 未登记 INDEX（计划 T-166）；CI 合并仍将红直至全量登记 | M-6 / T-166 |
| 裸 `pnpm test:e2e` | T-014 已知：`global-setup.test.ts` 被 Playwright 扫描导致 setup 偶发失败；建议 `testIgnore: ['**/*.test.ts']` | 后续 task |

## 结论

`passed`

---

**测试执行时间**: 2026-06-18  
**测试角色**: tester（milestone scope）  
**下一步**: milestone `status` → `verifying`，交 verifier；人工验收清单 + `验收 M-1` 待用户完成。
