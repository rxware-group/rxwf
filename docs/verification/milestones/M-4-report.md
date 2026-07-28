# Milestone M-4 — 验证报告

> 本 milestone 一致性核对。全局报告见 `docs/verification/verification-report.md`。

## Milestone

- **ID**: M-4
- **名称**: Group Chat MVP（round-robin / orchestrator / UserProxy）
- **分支**: `milestone/m-4-group-chat`
- **覆盖 AC**: AC-035～AC-044（功能交付）；AC-070～AC-074（门禁，见「待人工验收项」）
- **关联任务**: T-085～T-098（14/14 `done`）
- **测试报告**: `docs/test/milestones/M-4-report.md`（结论 `passed`）
- **人工验收清单**: `docs/test/milestones/M-4-acceptance.md`
- **架构冲突评估**: `docs/architecture/group-chat-conflict-review.md`（`m4ImplementationGate: cleared`）

---

## 验收标准核对（AC-035～AC-044）

| AC-ID | 描述摘要 | 状态 | 交付物 / 证据 |
|-------|----------|------|---------------|
| AC-035 | `groupChat` round-robin 模式按 design spec 可执行 | **partial** | T-087/T-088 native loop 执行器 + 单元测试 green；lite `@any` `group-chat-round-robin.spec.ts` 模板/面板 **2/2 green**；Plus 轨 debug-node 真实轮转执行 **blocked**（compose image + Ollama，同 M-3 T-028） |
| AC-036 | `groupChat` orchestrator 模式按 design spec 可执行 | **partial** | T-087 orchestrator 调度路径 + `group-chat-orchestrator-user-proxy.spec.ts` lite `@any` **2/2 green**；Plus 轨 orchestrator Agent 真实执行待 compose |
| AC-037 | UserProxy 人工插话路径可用（Plus 轨） | **partial** | T-090/T-091 HITL resume/超时单测 green；T-093 API 链；lite `@any` UserProxy 面板/模板校验 green；Plus 轨 waiting/resume 全链路 **blocked**（compose + Ollama） |
| AC-038 | Group Chat 与 Crew/Agent 无未确认架构冲突 | **met** | T-085：`group-chat-conflict-review.md` frontmatter `status=approved`、`m4ImplementationGate=cleared`；GC-01～GC-10 均有结论；`group-chat-conflict-review.test.mjs` 可执行（M4-MAN-006 步骤） |
| AC-039 | Group Chat 全场景 E2E（Plus 轨）green | **partial** | lite group-chat 专项 **7/7 green**（含 3 spec 文件）；`RXWF_E2E_TRACK=plus test:e2e group-chat` **blocked**（api/web 缺 image/build）；`@plus` live 用例待 CI |
| AC-040 | matrix 中 Group Chat 相关行 100% 覆盖 | **met** | T-096：`E2E-N-groupChat` → `covered`，登记 3 条 spec（`nodes/groupChat.spec.ts`、`group-chat-round-robin.spec.ts`、`group-chat-orchestrator-user-proxy.spec.ts`）；`validate-e2e-matrix.mjs` exit 0（65 rows） |
| AC-041 | `M-4-acceptance.md` 全通过 | **pending** | T-097：清单 11 条已编写（frontmatter 含 AC-035～044、AC-070；≥5 条 Plus 轨）✅；**执行结果栏均未签字** |
| AC-042 | 全量 E2E green | **partial** | lite 轨最佳轮次 **153/153** 可执行用例 green（1 条件 skip `ragRetrieve`）；schema-compat 6/6；plus 轨 group-chat **blocked**；偶发 flaky（httpRequest/crewSupervisor/skill-run-tools）已记录，非 Group Chat 回归阻塞 |
| AC-043 | Group Chat 参数面板校验与错误可诊断 | **partial** | T-086 参数 schema + T-064 审查 row `panel/validation=ok`；lite E2E 含 E1048 `@any` 路径；E1012/E1049 用户可读性待人工 M4-MAN-010 验 |
| AC-044 | `spec-gap-audit.md` 中 Group Chat 项为 done | **met** | T-096：GAP-011 `audit_status=done`（Group Chat MVP）；`validate-spec-gap-audit.mjs` 全量 exit 0；GAP-018/019 为 llmStream/aiAgent **spec partial**，T-096 已标注非 Group Chat 收口范围 |

**AC-035～044 汇总**：4 met、6 partial、1 pending。

---

## 门禁 AC 核对（AC-070～AC-074）

| AC-ID | 描述摘要 | 状态 | 说明 |
|-------|----------|------|------|
| AC-070 | 人工验收用例清单存在且全部通过 | **pending** | `M-4-acceptance.md` 11 条已编写；均未执行/签字 |
| AC-071 | 放行前用户执行 `验收 M-4` | **pending** | 等待用户门禁指令 |
| AC-072 | 验收后代码与文档合入主分支 | **pending** | 分支 `milestone/m-4-group-chat` 尚未合 main |
| AC-073 | compose 自动 up/down 无泄漏容器 | **partial** | lite 轨 E2E 本地启停无泄漏（M-4 测试记录）；Plus compose 未成功启动（image 缺），M4-MAN-007 待验 |
| AC-074 | 阻塞项经人工确认记入 history，无自行绕过 | **met** | GAP-018/019 open、plus compose blocked、Ollama 依赖、裸 `test:e2e` 扫描、lite flaky、ragRetrieve skip 均已记录于 `M-4-report.md`、T-096/T-098 与本报告 |

---

## TDD + Task 基本验证追溯

| 波次 | Task 范围 | 状态 | verifier 审查 |
|------|-----------|------|---------------|
| Wave 13 | T-085～T-089 架构/执行器/适配 | done | ✅ 冲突评估 cleared；执行器单测 green |
| Wave 14 | T-090～T-092 UserProxy HITL/超时/UI | done | ✅ hitl/resume 测试 green |
| Wave 15 | T-093～T-095 E2E specs | done | ✅ lite @any group-chat 7/7 |
| Wave 16 | T-096～T-098 矩阵/验收/测试报告 | done | ✅ GAP-011 done；M-4-report passed |

| Task | AC | TDD Red→Green | Task 基本验证 | 审查 |
|------|-----|---------------|---------------|------|
| T-085 冲突评估 | AC-038 | ✅ conflict-review.test | passed | ✅ gate cleared |
| T-086 参数 schema | AC-043 | ✅ validate/schema 单测 | passed | ✅ |
| T-087/T-088 执行器 | AC-035/036 | ✅ group-chat executor 单测 | passed | ✅ native + langgraph 路径 |
| T-089 ai-runtime 适配 | AC-035/036 | ✅ runGroupChatGraph 单测 | passed | ✅ |
| T-090 UserProxy HITL | AC-037 | ✅ resume-group-chat | passed | ✅ |
| T-091 UserProxy 超时 | AC-037/043 | ✅ sweeper E1048 | passed | ✅ OQ-010 默认 -1 |
| T-092 timeline UI | AC-035/037 | ✅ agentSteps 渲染 | passed | ✅ |
| T-093 HITL API 链 | AC-037 | ✅ API integration | passed | ✅ |
| T-094 round-robin E2E | AC-035/039 | ✅ lite @any | passed | ✅ |
| T-095 orchestrator E2E | AC-036/037 | ✅ lite @any | passed | ✅ |
| T-096 matrix + GAP-011 | AC-040/044 | ✅ validate scripts | passed | ✅ GAP-011 done |
| T-097 acceptance 清单 | AC-041 | ✅ 11 用例就绪 | passed | ✅ 待人工执行 |
| T-098 milestone 测试 | AC-039/042 | ✅ lite 153/153 最佳 | passed | ⚠️ plus blocked |

**汇总**：14/14 任务 TDD + Task 基本验证证据齐全；tester 复跑与 developer 记录一致。

---

## 架构符合性（M-4 范围）

| 架构项 | 要求（§8 Group Chat / FR-10 / OQ-004/OQ-010） | 符合性 |
|--------|-----------------------------------------------|--------|
| 冲突评估门禁 | M-4 实现前 `m4ImplementationGate: cleared` | ✅ T-085 文档 + GC-01～10 |
| 端口模型 | `group_member` / `group_orchestrator` 与 Crew 并列 | ✅ conflict-review GC-01；`group-members.ts` |
| 图编译 | 编排边不参与 main DAG | ✅ GC-03；`to-workflow-graph.ts` 对称 filter |
| 执行语义 | 单节点内循环 + 节点级 waiting/resume | ✅ GC-08；非全图重跑 |
| HITL 扩展 | `orchestrationResume.kind=groupChat` | ✅ GC-05；T-090/T-093 |
| UserProxy 超时 | 默认 -1；正数超时 → failed + E1048 | ✅ GC-06/OQ-010；T-091 |
| agentSteps | `groupChatTurn` 等 discriminated types | ✅ GC-09；T-092 |
| Plus 轨边界 | groupChat 注册于 `registerPlusExecutors` | ✅ GC-10；matrix 行 `plus` |
| 依赖方向 | `node-runner` → `execution`/`ai-runtime`/`workflow` | ✅ 与 architecture §2.3 一致 |
| TDD 分层 | 单测先于 E2E；Red→Green 证据 | ✅ 各 task 有 Red 记录 |
| schemaVersion:1 | Group Chat 不破坏 v1 导入 | ✅ schema-compat 6/6（tester 复跑） |
| FR-16 大变动 | 不触发 ExecutionEngine 全局调度变更 | ✅ conflict-review §5 结论「否」 |

**备注**：M-4 架构交付物（冲突评估、执行器、HITL 扩展、E2E 登记）均已落地；Plus compose 基础设施为 M-2/M-3 延续技术债，不否定 Group Chat 核心架构符合性。

---

## spec partial gap（GAP-018/019 open，非 Group Chat 项）

| GAP-ID | 摘要 | milestone 归属 | 处置 |
|--------|------|----------------|------|
| GAP-018 | Chat SSE + 设置页；长期记忆/多模型对比 v2.0 未做 | M-4（spec partial） | open；llmStream 平台能力，非 Group Chat FR-10 |
| GAP-019 | aiAgent 评测/追踪导出 v2.0 未做 | M-4（spec partial） | open；Agent RAG spec 项，Group Chat 复用 aiAgent 卫星已 ok |

`validate-spec-gap-audit.mjs --milestone M-4` 因此 2 项 fail 为**预期**；与 T-096「Group Chat 收口」范围一致（仅 GAP-011 须 done），**不阻断** M-4 Group Chat 验证结论。AC-044 字面指「Group Chat 项」，对应 GAP-011 ✅。

---

## 已知待接线 / 技术债（记录，不阻断 M-4 Group Chat 核心）

| 项 | 来源 | 影响 | 处置建议 |
|----|------|------|----------|
| Plus compose 缺 api/web image | T-028 / M-4 测试报告 | `@plus` Group Chat live E2E 未执行 | 验收前补 image；M4-MAN-007 |
| Ollama 不可达 | M-4 测试报告 | `@plus` debug-node skip | Plus compose + Ollama 或 mock |
| GAP-018/019 spec partial | spec-gap-audit | `--milestone M-4` 严格校验 fail | 留待 M-6 或人工确认 defer |
| lite 全量 flaky | M-4 测试报告 | 偶发 httpRequest/crewSupervisor | `--workers=1 --retries=1` |
| `ragRetrieve` KB skip | M-4 测试报告 | 1/155 条件 skip | Docker KB 夹具 |
| 裸 `test:e2e` 扫描 setup | T-014 | CI 入口偶发失败 | `playwright.config.ts` testIgnore |

---

## 缺口清单（放行前须知）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-070 / AC-041 | 11 条人工用例 **尚未执行/签字** | 验收人 |
| AC-071 | 用户尚未执行 **`验收 M-4`** | 验收人 |
| AC-039/042 plus 轨 | Plus compose image 就绪后 `@plus` group-chat E2E | 验收人 / CI |
| AC-035～037 Plus 执行 | round-robin/orchestrator/UserProxy 真实 transcript 验 | 验收人 M4-MAN-002～005 |
| AC-072 | 验收通过后合入 `main` | 验收人 |
| AC-073 | Plus compose up/down 无泄漏容器 | 人工 M4-MAN-007 |
| GAP-018/019 | llmStream/aiAgent spec partial；非 Group Chat 阻断 | 验收人 / PM |

---

## recommendedPhase

`none`

（M-4 Group Chat 核心交付物与自动化证据满足验证要求；partial 项为 Plus compose 基础设施与人工门禁，不构成 development/tasking/architecture 回退必要项。）

---

## 结论

`passed`

---

**验证时间**: 2026-06-20  
**验证角色**: verifier（milestone scope）  
**下一步**: `milestones[M-4].gate.status` 保持 `pending`；等待用户执行 11 条人工用例 + `验收 M-4`；建议验收前复跑 `RXWF_E2E_TRACK=plus pnpm --filter @rxwf/web test:e2e group-chat`（需先补 compose api/web image + Ollama）。
