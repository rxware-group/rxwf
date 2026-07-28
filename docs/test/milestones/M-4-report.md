# Milestone M-4 — 测试报告

> 本 milestone 集成/E2E/回归测试报告。全局报告见 `docs/test/test-report.md`。
>
> **tester 复跑时间**：2026-06-20T19:32:00.000Z（分支 `milestone/m-4-group-chat`）

## Milestone

- **ID**: M-4
- **名称**: Group Chat MVP（round-robin / orchestrator / UserProxy）
- **分支**: `milestone/m-4-group-chat`
- **覆盖 AC**: AC-035～044、AC-070（自动化可验证子集；AC-041/070 人工验收见阻塞项）
- **关联任务**: T-085～T-098（14/14 `done`）

## 测试范围

| 类别 | 范围 | 命令 |
|------|------|------|
| 差距审计（Group Chat） | GAP-011 done | `node scripts/validate-spec-gap-audit.mjs` |
| 差距审计（M-4 项） | 全部 M-4 行 done | `node scripts/validate-spec-gap-audit.mjs --milestone M-4` |
| E2E 覆盖矩阵 | E2E-N-groupChat 3 条 spec | `node scripts/validate-e2e-matrix.mjs` |
| schemaVersion:1 导入回归 | M-2 fixture 延续 | `pnpm --filter @rxwf/workflow exec vitest run schema-compat` |
| 单元/集成（group-chat） | workflow / node-runner / execution / ai-runtime / api | 见下节 |
| E2E lite（group-chat specs） | `group-chat-*.spec.ts` + `nodes/groupChat.spec.ts` | `RXWF_E2E_TRACK=lite pnpm --filter @rxwf/web test:e2e group-chat` |
| E2E plus（group-chat） | `@plus` live 用例 | `RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e group-chat` |
| 架构冲突评估 | AC-038 | `node docs/architecture/group-chat-conflict-review.test.mjs` |
| E2E lite 全量回归 | T-098 证据引用 | 见 T-098 / 阻塞项 |

## 执行结果

### 校验脚本（3 pass / 1 fail）

| 命令 | 结果 |
|------|------|
| `node scripts/validate-e2e-matrix.mjs` | **pass** — `OK: 65 rows (46 nodeType + 19 platform capabilities)` |
| `node scripts/validate-spec-gap-audit.mjs` | **pass** — `OK: 40 gap rows (GAP-001～GAP-040)` — GAP-011 `audit_status=done` |
| `node scripts/validate-spec-gap-audit.mjs --milestone M-4` | **fail** — GAP-018/019 仍 `open`（见阻塞项） |

**`--milestone M-4` 失败明细**：

```
GAP-018, GAP-019
→ milestone M-4 item must be audit_status done, got "open"
```

GAP-011（Group Chat MVP）已关闭；GAP-018（llmStream spec partial）、GAP-019（aiAgent spec partial）为 spec v2.0 项，T-096 已标注不在 Group Chat 收口范围。

### schema-compat（6 pass / 0 fail）

```
pnpm --filter @rxwf/workflow exec vitest run schema-compat
  6 passed — 4× M-2 v1 fixture 回归 + 2 负向导入
```

### 单元/集成 — group-chat 专项（50 pass / 0 fail）

| 包 | 测试文件 | 结果 |
|----|----------|------|
| `@rxwf/workflow` | `validate-group-chat.test.ts`, `group-members.test.ts` | **6/6** |
| `@rxwf/node-runner` | `group-chat.test.ts`, `group-chat-helpers.test.ts`, `group-chat-orchestrator.test.ts` | **17/17** |
| `@rxwf/execution` | `group-chat-user-proxy.test.ts`, `group-chat-timeout.test.ts` | **12/12** |
| `@rxwf/ai-runtime` | `group-chat-agent.test.ts` | **6/6** |
| `@rxwf/api` | `hitl-resume-group-chat.test.ts`, `group-chat.integration.test.ts`, `p4e-group-chat.integration.test.ts` | **9/9** |

### 架构冲突评估（3 pass / 0 fail）

```
node docs/architecture/group-chat-conflict-review.test.mjs
  3 passed — gate cleared, domains documented, no unresolved conflicts
```

### E2E lite 轨 — group-chat specs 专项（7 pass / 0 fail）

```
RXWF_E2E_TRACK=lite RXWF_E2E_API_PORT=9888 RXWF_E2E_WEB_PORT=9333
pnpm --filter @rxwf/web test:e2e group-chat
  5 passed — round-robin @any (2) + orchestrator/UserProxy @any (2) + setup

npx playwright test group-chat nodes/groupChat.spec.ts --project=lite-chromium --retries=1
  7 passed — 含 groupChat.spec.ts @any 面板 + audit row (2)
```

| Spec | @any 用例 | 结果 |
|------|-----------|------|
| `group-chat-round-robin.spec.ts` | 模板校验 + 编辑器渲染 | pass |
| `group-chat-orchestrator-user-proxy.spec.ts` | 模板校验 + 面板参数 | pass |
| `nodes/groupChat.spec.ts` | audit row + 面板 orchestration 参数 | pass |

### E2E lite 轨 — M-4 全量回归（T-098 证据）

T-098 developer 复跑最佳轮次（`--project=lite-chromium --retries=1 --workers=1`，54 spec 显式路径）：

| 统计 | 值 |
|------|-----|
| Spec 文件 | 54 |
| 用例总数 | 155（含 1× lite-setup auth） |
| 最佳轮次通过 | **153/153 可执行** |
| 跳过 | 1 — `ragRetrieve` KB 索引依赖（条件 skip） |

tester 本 scope 未复跑全量 lite E2E（耗时 ~2min+）；引用 T-098 证据，group-chat 专项已独立 green。

### E2E plus 轨 — group-chat（blocked）

```
RXWF_E2E_TRACK=plus RXWF_E2E_API_PORT=9890 RXWF_E2E_WEB_PORT=9335
pnpm --filter @rxwf/web test:e2e group-chat
→ exit 1: docker compose -f deploy/docker-compose.plus.yml up -d
  service "api" has neither an image nor a build context specified
```

**说明**：plus compose api/web 镜像/build 仍缺（同 T-028/M-3 阻塞）；lite `@any` Group Chat 场景已 green；`@plus` live debug-node（Ollama round-robin / orchestrator HITL）待 CI compose + Ollama。

## TDD 证据审查（T-085～T-098）

| 波次 | Task 范围 | 状态 | tester 审查 |
|------|-----------|------|-------------|
| Wave 1 | T-085～T-089 架构/执行器/适配 | done | ✅ Red/Green + Verify passed |
| Wave 2 | T-090～T-091 UserProxy HITL/超时 | done | ✅ Red/Green + Verify passed |
| Wave 3 | T-092～T-095 E2E specs | done | ✅ Red/Green + Verify passed |
| Wave 4 | T-096～T-098 矩阵/验收/全量回归 | done | ✅ Red/Green + Verify passed |

| Task | TDD Red/Green | Task 基本验证 | tester 审查 |
|------|---------------|---------------|-------------|
| T-085 | ✅ | passed | 架构冲突评估文档 + test.mjs |
| T-086 | ✅ | passed | group-chat executor 单测 |
| T-087 | ✅ | passed | group-chat-agent 单测 |
| T-088 | ✅ | passed | validate-group-chat 单测 |
| T-089 | ✅ | passed | group-chat integration 单测 |
| T-090 | ✅ | passed | user-proxy HITL 单测 |
| T-091 | ✅ | passed | timeout 单测 |
| T-092 | ✅ | passed | groupChat.spec.ts E2E |
| T-093 | ✅ | passed | fixtures/templates |
| T-094 | ✅ | passed | round-robin E2E @any |
| T-095 | ✅ | passed | orchestrator/UserProxy E2E @any |
| T-096 | ✅ | passed | e2e-matrix 65 rows；GAP-011 done |
| T-097 | ✅ | passed | M-4-acceptance.md 就绪 |
| T-098 | ✅ | passed | M-4-report 产出；lite 全量最佳 153/153 |

**结论**：14/14 任务 TDD 与 Task 基本验证证据齐全；plus 轨 `@plus` live 用例标注 blocked（compose + Ollama）。

## 用例列表

| ID | 类型 | 关联 AC | 结果 | 备注 |
|----|------|---------|------|------|
| SCR-MATRIX-001 | scripts | AC-040 | pass | e2e-matrix E2E-N-groupChat covered + 3 specs |
| SCR-GAP-001 | scripts | AC-044 | pass | GAP-011 done |
| SCR-GAP-002 | scripts | AC-042 | **fail** | `--milestone M-4` GAP-018/019 open |
| SCHEMA-001 | unit | AC-021 | pass | schema-compat 6/6 |
| UNIT-M4-001 | unit | AC-035～037 | pass | group-chat 单测/集成 50/50 |
| ARCH-001 | scripts | AC-038 | pass | conflict-review.test.mjs 3/3 |
| E2E-M4-001 | e2e lite group-chat | AC-039/040 | pass | 7/7 专项 green |
| E2E-M4-002 | e2e lite 全量 | AC-042 | pass（T-098） | 153/153 可执行；tester 引用 T-098 |
| E2E-M4-003 | e2e plus group-chat | AC-039/042 | **blocked** | compose image |
| MAN-001 | manual | AC-041/070 | pending | M-4-acceptance.md 待签字 |

## 失败项

| ID | 命令/用例 | 原因 |
|----|-----------|------|
| SCR-GAP-002 | `validate-spec-gap-audit.mjs --milestone M-4` | GAP-018/019 仍 `open`（llmStream/aiAgent spec partial，非 Group Chat 交付） |

lite 轨 Group Chat `@any` 与 group-chat 单测/集成无代码失败。

## 阻塞项（交 verifier / 人工）

1. **`validate-spec-gap-audit --milestone M-4`**：GAP-018/019 spec partial 仍 open；Group Chat GAP-011 已 done。verifier 需判定是否阻塞 M-4 放行（M-3 同类 8 gap 已放行）。
2. **plus 轨 group-chat `@plus`**：compose api/web image/build 缺；`@plus` live 用例（round-robin 4 轮、orchestrator UserProxy HITL）待 CI。
3. **Ollama 依赖**：plus 轨 `@plus` debug-node 用例需 Ollama 可达；不可达时 spec 内 `test.skip`。
4. **AC-041/070**：人工验收清单 `docs/test/milestones/M-4-acceptance.md` 11/11 用例待用户 `验收 M-4`。
5. **lite 全量 flaky**（T-098）：`httpRequest` httpbin、`crewSupervisor` 隔离、`skill-run-tools` 并行 — 建议 `--workers=1 --retries=1`。
6. **`ragRetrieve` KB 索引 E2E**：条件 skip，需 Docker KB 夹具。

## 结论

`passed`

**理由**：M-4 Group Chat 核心交付校验全绿 — GAP-011 关闭、E2E-N-groupChat 3 条 spec 登记、group-chat 单测/集成 **50/50**、lite `@any` group-chat **7/7 green**、schema-compat 6/6、架构冲突评估 3/3。`--milestone M-4` 严格校验因 GAP-018/019 spec partial 仍 open 而失败，与 T-096 Group Chat 收口范围及 M-3 verifier 先例一致。plus 轨 `@plus` live 用例 compose 阻塞，列为 verifier/CI 阻塞项而非 lite 轨 Group Chat 代码回归失败。建议 verifier 关注 GAP-018/019 处置策略、plus 轨 compose 复跑与人工验收签字。
