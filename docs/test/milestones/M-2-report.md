# Milestone M-2 — 测试报告

> 本 milestone 集成/E2E/回归测试报告。全局报告见 `docs/test/test-report.md`。

## Milestone

- **ID**: M-2
- **名称**: v2.0 半实现项补齐
- **分支**: `milestone/m-2-semi-impl`
- **覆盖 AC**: AC-013～AC-022、AC-070～AC-074（自动化可验证子集；AC-019/070/071 人工验收见阻塞项）
- **关联任务**: T-016～T-033（18/18 `done`）

## 测试范围

| 类别 | 范围 | 命令 |
|------|------|------|
| skillRun 子工具 provider | write / grep / web_search | `pnpm --filter @rxwf/skill-runtime test` |
| credential-types 注册表 | registry / apply-auth | `pnpm --filter @rxwf/credential test` |
| switch 校验 + schema 兼容 | validate-switch / schema-compat | `pnpm --filter @rxwf/workflow test` |
| switch 执行 + skillRun 集成 | switch / skill-run executors | `pnpm --filter @rxwf/node-runner test` |
| ACL + credentials API | workflow-collaborators / credentials / workflows-acl | `pnpm --filter @rxwf/api test` |
| 差距审计 + matrix | M-2 gap 项 + E2E 矩阵 | `node scripts/validate-spec-gap-audit.mjs --milestone M-2`、`node scripts/validate-e2e-matrix.mjs` |
| schemaVersion:1 导入回归 | M-2 fixture | `pnpm --filter @rxwf/workflow test schema-compat` |
| E2E（lite 轨） | skill-run-tools / switch-dynamic / credential-types | `RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e …` |
| E2E（standard 轨） | workflow-acl | `RXWF_E2E_TRACK=standard pnpm --filter @rxwf/web test:e2e workflow-acl` |
| M-1 基线回归（lite） | help-route-baseline / docs-index-smoke | `RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e help-route-baseline docs-index-smoke` |

## 执行结果

### 单元 / 集成（530 pass / 0 fail / 7 skip）

| 包 | 结果 |
|----|------|
| `@rxwf/skill-runtime` | 42 passed（17 files）— write 5、grep 4、web-search 6 |
| `@rxwf/credential` | 17 passed（3 files）— registry 8、apply-auth 4、credential-service 5 |
| `@rxwf/workflow` | 94 passed（18 files）— validate-switch 3、schema-compat 6 |
| `@rxwf/node-runner` | 201 passed（48 files）— switch 4、skill-run 9 |
| `@rxwf/api` | 176 passed / 7 skipped（68 files）— workflow-collaborators 4、credentials 8、workflows-acl 2 |

### 校验脚本（2 pass / 0 fail）

| 命令 | 结果 |
|------|------|
| `node scripts/validate-spec-gap-audit.mjs --milestone M-2` | `OK: 40 gap rows` — GAP-007/008/009/010/025 M-2 项均为 done |
| `node scripts/validate-e2e-matrix.mjs` | `OK: 65 rows (46 nodeType + 19 platform capabilities)` |

### schema-compat（6 pass / 0 fail）

```
pnpm --filter @rxwf/workflow test schema-compat
  6 passed — 4× M-2 v1 fixture 回归 + 2 负向导入
```

### E2E lite 轨 — M-2 新增（10 pass / 0 fail，40.0s）

```
RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web exec playwright test \
  e2e/skill-run-tools.spec.ts e2e/switch-dynamic.spec.ts e2e/credential-types.spec.ts \
  --project lite-chromium
  10 passed (40.0s)
```

| Spec | 用例数 | matrix 行 |
|------|--------|-----------|
| `skill-run-tools.spec.ts` | 5 | E2E-N-skillRun |
| `switch-dynamic.spec.ts` | 3 | E2E-N-switch |
| `credential-types.spec.ts` | 1 | E2E-P-011 |

### E2E lite 轨 — M-1 基线回归（19 pass / 0 fail，20.2s）

```
RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e help-route-baseline docs-index-smoke
  19 passed (20.2s)
```

| Spec | 用例数 | matrix 行 |
|------|--------|-----------|
| `help-route-baseline.spec.ts` | 6 | E2E-P-007 |
| `docs-index-smoke.spec.ts` | 13 | E2E-P-017 |

### E2E standard 轨 — workflow-acl（未执行，环境阻塞）

```
RXWF_E2E_TRACK=standard pnpm --filter @rxwf/web exec playwright test e2e/workflow-acl.spec.ts --project standard-chromium
→ Error: docker compose … unable to connect to Docker API (Docker Desktop 未运行)
```

**说明**：`workflow-acl.spec.ts` 标记 `@standard @any`，lite 轨 grepInvert 排除；需 standard compose（Postgres）启动。**API 层 ACL 已由 `@rxwf/api` 集成测试覆盖**（workflow-collaborators 4 + workflows-acl 2 = 6 passed）。Developer Task 验证记录 8 passed（standard + plus 双 project）。

### 已知非阻断项（用户确认）

| 项 | 状态 |
|----|------|
| plus 轨 compose 缺 api/web image（T-028） | 未在本轮执行；lite `@any` 场景已 green |
| `pnpm lint:docs-index` 全 repo exit 1 | M-6 范围；M-2 变更文件已登记（T-033） |
| AC-070/071 人工验收 M-2 | 待用户执行 `验收 M-2`（`M-2-acceptance.md` 10 条用例） |

## TDD 证据审查（T-016～T-033）

| Task | TDD Red/Green | Task 基本验证 | 审查 |
|------|---------------|---------------|------|
| T-016 write provider | Red（模块缺失）→ Green 5/5 | passed | ✅ tester 复跑 skill-runtime 42/42 |
| T-017 grep provider | Red→Green 4/4 | passed | ✅ |
| T-018 web-search provider | Red→Green 6/6 | passed | ✅ |
| T-019 credential registry | Red→Green registry 8 | passed | ✅ tester 复跑 credential 17/17 |
| T-020 credentials API | Red→Green 8/8 | passed | ✅ tester 复跑 credentials 8/8 |
| T-021 validate-switch | Red→Green 3/3 | passed | ✅ tester 复跑 validate-switch 3/3 |
| T-022 switch executor | Red→Green 4/4 | passed | ✅ tester 复跑 switch 4/4 |
| T-023 SwitchBranchesPanel | 测试补全（实现已存在）2/2 | passed | ✅ |
| T-024 collaborators API | Red→Green 4/4 | passed | ✅ tester 复跑 4/4 |
| T-025 CollaboratorsPanel UI | 测试 2/2（实现已存在） | passed | ✅ |
| T-026 skill-run 集成 | Red→Green 15/15 | passed | ✅ tester 复跑 skill-run 9/9 |
| T-027 CredentialsPanel UI | Red→Green 2/2 | passed | ✅ |
| T-028 skill-run-tools E2E | Red→Green lite 6/6 | passed | ✅ tester 复跑 lite 5 用例 green |
| T-029 workflow-acl E2E | Red→Green 8/8（developer） | passed | ⚠️ tester 未复跑（Docker 阻塞 standard 轨） |
| T-030 credential-types + switch-dynamic E2E | Red→Green lite 6/6 | passed | ✅ tester 复跑 4 用例 green |
| T-031 schema-compat | Red→Green 6/6 | passed | ✅ tester 复跑 6/6 |
| T-032 gap audit + matrix | Red→Green validate OK | passed | ✅ tester 复跑一致 |
| T-033 help/INDEX + acceptance | 内联 AC-022 Red→Green | passed | ✅ INDEX 冒烟 E2E green |

**结论**：18/18 任务 TDD 与 Task 基本验证证据齐全；T-023/T-025 为既有实现补测（Green 即 Red 阶段），可接受。T-029 E2E 仅 developer 环境证据，tester 因 Docker 未启动未能复跑 standard 轨。

## 用例列表

| ID | 类型 | 关联 AC | 结果 | 备注 |
|----|------|---------|------|------|
| UT-SR-001 | unit | AC-013 | pass | skill-runtime 42/42 |
| UT-CR-001 | unit | AC-015 | pass | credential 17/17 |
| UT-WF-001 | unit | AC-016, AC-021 | pass | workflow 94/94（含 schema-compat 6） |
| UT-NR-001 | unit | AC-013, AC-016 | pass | node-runner 201/201 |
| IT-API-001 | integration | AC-014, AC-015 | pass | api ACL + credentials 176 passed |
| SCR-001 | scripts | AC-017 | pass | validate-spec-gap-audit M-2 |
| SCR-002 | scripts | AC-018 | pass | validate-e2e-matrix 65 rows |
| E2E-M2-001 | e2e lite | AC-013 | pass | skill-run-tools 5 |
| E2E-M2-002 | e2e lite | AC-016 | pass | switch-dynamic 3 |
| E2E-M2-003 | e2e lite | AC-015 | pass | credential-types 1 |
| E2E-M2-004 | e2e standard | AC-014 | **blocked** | workflow-acl — Docker 未运行 |
| E2E-REG-001 | e2e lite | AC-020 | pass | M-1 基线 19/19 |
| MAN-001 | manual | AC-019, AC-070 | pending | M-2-acceptance.md 待人工签字 |

## 失败项

- **E2E-M2-004**（`workflow-acl.spec.ts` @standard）：Docker Desktop 未运行，standard compose 无法 up；非代码失败，环境阻塞。

## 阻塞项（交 verifier / 人工）

1. **workflow-acl E2E standard 轨**：需启动 Docker Desktop 后复跑 `RXWF_E2E_TRACK=standard pnpm --filter @rxwf/web test:e2e workflow-acl`。
2. **plus 轨 E2E**（skill-run-tools @plus）：compose 缺 api/web image（T-028 已记录，用户标为非阻断）。
3. **AC-070/071**：人工验收清单 `docs/test/milestones/M-2-acceptance.md` 10 条待用户执行并通过 `验收 M-2`。
4. **lint:docs-index 全 repo**：exit 1 属 M-6，非 M-2 自动化失败。

## 结论

`passed`

**理由**：M-2 核心交付（skillRun 子工具、credential-types、switch 动态分支、ACL API/UI 单测）单元与集成测试 **530/530 可执行用例全绿**；差距审计与 matrix 校验通过；lite 轨 M-2 E2E **10/10** + M-1 基线 **19/19** 全绿。workflow-acl E2E 因 Docker 环境未复跑，但 API 集成测试已覆盖 ACL 行为；plus 轨与全 repo lint 为用户确认非阻断项。建议 verifier 关注 workflow-acl standard E2E 复跑与人工验收门禁。
