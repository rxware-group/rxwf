# Milestone M-5 — 验证报告

> 本 milestone 一致性核对。全局报告见 `docs/verification/verification-report.md`。

## Milestone

- **ID**: M-5
- **名称**: Binary 全链路（OPT-01 P1～P4）
- **分支**: `milestone/m-5-binary`
- **覆盖 AC**: AC-045～AC-056（功能交付）；AC-070（门禁，见「待人工验收项」）
- **关联任务**: T-099～T-114（16/16 `done`）
- **测试报告**: `docs/test/milestones/M-5-report.md`（结论 `passed`）
- **方案确认**: `docs/test/milestones/M-5-binary-plan-confirmation.md`（`humanGate: approved`、`selectedOption: OPT-01`、`b6ImplementationGate: cleared`）
- **人工验收清单**: `docs/test/milestones/M-5-acceptance.md`

---

## OPT-01 P1～P4 范围核对

| Phase | 范围（B-6 / binary-options §3.1） | 状态 | 证据 |
|-------|-----------------------------------|------|------|
| **P1** | 类型 + blob + HTTP 响应→binary + 透传 + 调试 UI | **met** | T-104 `WorkflowItem.binary`；T-105 Lite `BinaryBlobService` + `execution_blobs`；T-106 `binary-pass-through`；T-107 `responseBinaryMode`；BIN-01～04/18～19 |
| **P2** | HTTP `$binary` 上传；Webhook multipart | **met** | T-107/T-108 `http-binary` / `webhook-binary`；E2E AC-048/049（T-111 13/13 首次 green） |
| **P3** | Set/Code 产出 binary | **met** | T-109 `$binary` 表达式；T-110 Set merge；BIN-10/11（`sandbox-item-utils`、`code.test.ts`） |
| **P4** | Merge combine 策略；ReadWriteFile readBinary | **met** | T-110 `merge-binary.ts` 修复 GAP-01 combineAll；BIN-12 `read-write-file` readBinary/writeBinary 单测 |
| **CONF** | 256 KiB inline / 32 MiB 上限 / Merge CONF-04 / Webhook CONF-05 / `responseBinaryMode` 默认 `off` | **met** | B-6 决选表；`binary-blob-service.test.ts` E2002；`M-5-binary-plan-confirmation.test.mjs` 6/6 |

**范围备注（partial，不阻断 OPT-01 核心）**：

- **GAP-02 / BIN-21**：Standard profile `BinaryBlobService` 仍为 `STANDARD_BINARY_BLOB_PLAN.status=planned`（Lite SQLite blob 已落地）；与 binary-risks §3 GAP-02 记录一致。
- **binary-current-state.md §3.2**：BIN-15「combineAll 丢弃 binary」矩阵行未同步 T-110 修复（文档滞后）；实现以 `merge-binary.test.ts` 20/20 为准。

---

## 验收标准核对（AC-045～AC-056）

| AC-ID | 描述摘要 | 状态 | 交付物 / 证据 |
|-------|----------|------|---------------|
| AC-045 | Binary 实施前 n8n/业界对标审查文档 | **met** | T-099/T-100：`binary-current-state.md`、`binary-n8n-review.md`；`binary-n8n-review.test.mjs` 3/3；B-2 `b2N8nReviewGate: cleared` |
| AC-046 | Binary 技术方案经用户 **人工方案确认** 后才开始实现 | **met** | T-103：`M-5-binary-plan-confirmation.md` frontmatter `humanGate: approved`、`selectedOption: OPT-01`；`M-5-binary-plan-confirmation.test.mjs` 6/6；`assertM5BinaryImplementationAllowed()` 不再 throw |
| AC-047 | WorkflowItem.binary 可在节点间传递（非丢弃） | **partial** | T-106 execution `binary-pass-through` 12/12；T-110 Merge combineAll/combineByKey 20/20；lite `@any` E2E-P-014 2/2；**调试面板 binary 摘要 UX** 待 M5-MAN-003/009 人工验 |
| AC-048 | HTTP 响应 → binary 生产者路径可用 | **partial** | T-107 `http-binary` 单测 green；T-111 standard AC-048 首次 pass；重跑 httpbin.org **503 external flake**；verifier 本机 standard 轨 **blocked**（Docker Desktop 未运行） |
| AC-049 | Webhook multipart 上传 → binary 可用 | **partial** | T-108 `webhook-binary` 8/8；T-111 AC-049 live multipart stable pass；**form field 帮助 UX** 待 M5-MAN-005 |
| AC-050 | 表达式 `$binary` 读写符合验收场景 | **partial** | T-109 `binary-globals` 单测；T-111 AC-050 IF/Set stubbed pinData stable pass；AC-050-HTTP upload 依赖 httpbin（503 flake）；表达式编辑器 UX 待 M5-MAN-006 |
| AC-051 | Binary blob 存储/检索符合确认方案 | **partial** | T-105 Lite `BinaryBlobService` 7/7 + lite blob-repository 3/3；CONF-02/03 256 KiB/32 MiB；**Standard profile blob 仍为 planned**（GAP-02）；256 KiB/32 MiB 边界待 M5-MAN-007 |
| AC-052 | Binary 全场景 E2E green | **partial** | `BINARY_FULL_CHAIN_E2E_GREEN=true`；`binary-full-chain.spec.test.ts` 5/5；T-111 首次 **13/13 @standard pass**；verifier 本机 standard compose **blocked**；httpbin 503 时 11/13（external flake） |
| AC-053 | matrix 中 Binary 相关行 100% 覆盖 | **met** | T-112：`E2E-P-014` → `covered`，spec `binary-full-chain.spec.ts`；`e2e-coverage-matrix.test.mjs` 6/6；`validate-e2e-matrix.mjs` 65 rows OK |
| AC-054 | `M-5-acceptance.md` 全通过 | **pending** | T-113：清单 11 条已编写（frontmatter AC-045～056、AC-070）✅；`M-5-acceptance.test.mjs` 3/3 ✅；**执行结果栏均未签字** |
| AC-055 | ADR/执行数据模型大变动已人工确认 | **met** | B-6 §2「ADR/FR-16 无需修订」；T-102 `binary-risks.md` ADR 影响清单；`binary-risks.test.mjs` B-6 cleared |
| AC-056 | 全量 E2E green | **partial** | lite 轨累积 **152/155** 可执行 pass（1 skip `ragRetrieve`）；3 fail 分类为 httpbin 503 / crewSupervisor flaky / postgres lite infra；schema-compat 6/6；standard binary **blocked** 本机 Docker |

**AC-045～056 汇总**：5 met、6 partial、1 pending。

---

## 门禁 AC 核对（AC-070）

| AC-ID | 描述摘要 | 状态 | 说明 |
|-------|----------|------|------|
| AC-070 | 人工验收用例清单存在且 **全部通过** | **pending** | `M-5-acceptance.md` 11 条已编写；均未执行/签字；等待用户 `验收 M-5` |

（AC-071～074 为跨 milestone 放行门禁，本报告不重复 M-4 全局核对；M-5 测试报告已记录 compose/Docker/httpbin 阻塞项，符合 AC-074 记录要求。）

---

## TDD + Task 基本验证追溯

| 波次 | Task 范围 | 状态 | verifier 审查 |
|------|-----------|------|---------------|
| Wave 1 | T-099～T-101 现状/对标/方案选项 | done | ✅ B-1/B-2/B-5 文档门禁 green |
| Wave 2 | T-102～T-103 风险/B-6 门禁 | done | ✅ B-4 cleared；OPT-01 B-6 approved |
| Wave 3 | T-104～T-108 类型/blob/HTTP/Webhook | done | ✅ shared/node-runner 单测 green |
| Wave 4 | T-109～T-111 表达式/Merge/E2E | done | ✅ T-111 GREEN 翻转；standard 13/13 首次证据 |
| Wave 5 | T-112～T-114 矩阵/验收/全量回归 | done | ✅ GAP-012 done；M-5-report 7/7 |

| Task | AC | TDD Red→Green | Task 基本验证 | 审查 |
|------|-----|---------------|---------------|------|
| T-099 现状快照 | AC-045 | ✅ binary-current-state.test | passed | ✅ B-1 矩阵 |
| T-100 n8n 对标 | AC-045 | ✅ binary-n8n-review.test | passed | ✅ B-2 cleared |
| T-101 方案选项 | AC-045 | ✅ binary-options.test | passed | ✅ OPT-01 selected |
| T-102 差距/风险 | AC-055 | ✅ binary-risks.test | passed | ✅ B-4 + ADR 清单 |
| T-103 B-6 确认 | AC-046 | ✅ plan-confirmation.test | passed | ✅ gate cleared |
| T-104 WorkflowItem.binary | AC-047 | ✅ workflow-item.test | passed | ✅ |
| T-105 BinaryBlobService | AC-051 | ✅ binary-blob-service.test | passed | ⚠️ Standard planned |
| T-106 透传 engine | AC-047 | ✅ binary-pass-through.test | passed | ✅ |
| T-107 HTTP→binary | AC-048 | ✅ http-binary.test | passed | ✅ |
| T-108 Webhook multipart | AC-049 | ✅ webhook-binary.test | passed | ✅ |
| T-109 `$binary` 表达式 | AC-050 | ✅ binary-globals.test | passed | ✅ |
| T-110 Set/Merge binary | AC-047 | ✅ merge-binary/set-binary | passed | ✅ GAP-01 关闭 |
| T-111 binary-full-chain E2E | AC-052 | ✅ spec.test + E2E | passed | ⚠️ httpbin/Docker 本机阻塞 |
| T-112 matrix E2E-P-014 | AC-053 | ✅ e2e-coverage-matrix.test | passed | ✅ |
| T-113 acceptance 清单 | AC-054 | ✅ M-5-acceptance.test | passed | ✅ 待人工执行 |
| T-114 milestone 测试报告 | AC-056 | ✅ M-5-report.test | passed | ⚠️ lite 152/155 |

**汇总**：16/16 任务 TDD + Task 基本验证证据齐全；verifier 独立复跑 B-6/acceptance/matrix/GAP-012/M-5-report 门禁脚本 **全 pass**。

---

## 架构符合性（M-5 范围）

| 架构项 | 要求（§9 Binary / FR-11 / ADR-005 / B-6 CONF） | 符合性 |
|--------|-----------------------------------------------|--------|
| B-1～B-6 审查流程 | 实施前完成 B-1～B-5；B-6 用户确认 OPT-01 | ✅ T-099～T-103 文档链完整 |
| B-6 实现门禁 | B-6 前禁止改持久化/HTTP 默认 | ✅ `assertM5BinaryImplementationAllowed` |
| inline 256 KiB / 32 MiB | CONF-02/03 与 draft spec 一致 | ✅ `binary-blob-service` + E2002 |
| Merge CONF-04 | combineByKey 首个非空；combineAll 保留 upstream | ✅ T-110 `merge-binary.ts` |
| Webhook CONF-05 | form field 名→binary key | ✅ T-108 |
| HTTP CONF-06 | `responseBinaryMode` 默认 `off` | ✅ T-107 + help 文档 |
| blob 安全 | 访问绑 executionId；Lite `blobs/<executionId>/` | ✅ architecture §9；T-105 lite repo |
| 依赖方向 | shared → execution/node-runner；Lite blob provider | ✅ 与 §2.3 一致 |
| TDD 分层 | 单测先于 E2E；Red→Green 各 task 有记录 | ✅ T-099～T-114 |
| schemaVersion:1 | Binary 不破坏 v1 导入 | ✅ schema-compat 6/6（tester 记录） |
| GAP-012 收口 | Binary FR-11 差距关闭 | ✅ `audit_status=done`；`--milestone M-5` OK |
| Standard blob | architecture §9 Standard 轨 SQLite blob | ⚠️ **planned**（GAP-02）；Lite 已落地 |

**备注**：M-5 Binary 核心架构交付（类型、blob 内核、HTTP/Webhook 生产者、透传、表达式、Merge、E2E 登记）与 OPT-01 P1～P4 及 B-6 决选一致；Standard profile blob 为已记录技术债，不否定 Lite/Standard compose 下 Binary 功能路径的架构符合性。

---

## 已知待接线 / 技术债（记录，不阻断 M-5 Binary 核心）

| 项 | 来源 | 影响 | 处置建议 |
|----|------|------|----------|
| Docker Desktop 未运行 | M-5 测试报告 / verifier 本机 | standard `@standard` binary-full-chain 无法复跑 | M5-MAN-008；CI standard compose |
| httpbin.org 503 | T-111/T-112 | AC-048/050-HTTP、lite httpRequest GET 间歇 fail | external flake 策略；mock 或重试 |
| lite 全量 152/155 | T-114 | crewSupervisor flaky、postgres lite 无依赖 | `--workers=1 --retries=1`（M-4 延续） |
| `ragRetrieve` KB skip | M-5 测试报告 | 1/155 条件 skip | Docker KB 夹具 |
| GAP-02 Standard blob | binary-risks | Standard 大 payload 外置未实现 | `STANDARD_BINARY_BLOB_PLAN`；post-M-5 或 M-6 |
| binary-current-state BIN-15 | T-099 快照 | 矩阵与 T-110 实现不同步 | 文档维护 task（非功能回归） |

---

## 缺口清单（放行前须知）

| 项 | 说明 | 责任 |
|----|------|------|
| AC-054 / AC-070 | 11 条人工用例 **尚未执行/签字** | 验收人 |
| AC-052 standard 轨 | Docker 就绪后复跑 `binary-full-chain --project=standard-chromium` | 验收人 / CI |
| AC-048/050 httpbin | 外部服务 503 时记录非代码回归 | 验收人 M5-MAN-004/008 |
| AC-051 Standard blob | GAP-02 planned；Lite blob 已验 | PM / 后续 milestone |
| AC-056 lite 全量 | 最佳 153/153（T-098）；本轮 152/155 external/infra | 验收人 |
| AC-071 | 用户尚未执行 **`验收 M-5`** | 验收人 |

---

## recommendedPhase

`none`

（M-5 Binary 核心交付物与自动化证据满足验证要求；partial 项为 Standard blob 规划、compose 基础设施、httpbin 外部依赖与人工门禁，不构成 development/tasking/architecture 回退必要项。）

---

## 结论

`passed`

---

**验证时间**: 2026-06-21  
**验证角色**: verifier（milestone scope）  
**verifier 独立复跑**: `M-5-binary-plan-confirmation.test.mjs` 6/6；`M-5-acceptance.test.mjs` 3/3；`e2e-coverage-matrix.test.mjs` 6/6；`validate-spec-gap-audit.mjs --milestone M-5` OK；`M-5-report.test.mjs` 7/7  
**下一步**: `milestones[M-5].gate.status` 应保持 `pending`（本 verifier 运行 **未修改** `state.json`）；等待用户执行 11 条人工用例 + `验收 M-5`；建议验收前在 standard compose 复跑 `binary-full-chain`（需 Docker Desktop / CI）。
