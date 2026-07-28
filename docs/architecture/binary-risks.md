---
status: approved
b4RisksGate: cleared
b6ImplementationGate: cleared
reviewDate: 2026-06-21
trace: AC-045
task: T-102
milestone: M-5
specRefs:
  - docs/spec.md FR-11 / FR-8
  - docs/requirements/PRD.md AC-045 / AC-055 / OQ-005 / FR-16
  - docs/architecture/architecture.md §9 Binary
  - docs/architecture/binary-current-state.md
  - docs/architecture/binary-n8n-review.md
  - docs/architecture/binary-options.md
  - docs/adr-execution-data.md ADR-005
  - docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
---

# Binary 差距/风险与 ADR 影响清单（B-4）

> **任务**：T-102 · **验收**：AC-055 · **门禁**：`b4RisksGate: cleared`；**实现** `b6ImplementationGate: cleared`（B-6 已于 T-103 用户确认 OPT-01）。

## 1. 目的与范围

在 M-5 Binary **B-6 人工方案确认**之前，综合 B-1 现状快照、B-2 n8n 对标、B-3/B-5 方案选项，产出：

| 产出 | 说明 |
|------|------|
| **差距清单** | 代码库 / 产品目标与 draft spec、AC-047～051 之间的可验证缺口 |
| **风险清单** | 实施前须知晓的冲突、文档滞后、范围蔓延风险 |
| **ADR-005 影响** | 各方案对执行持久化与 blob 模型的波及；偏离时须 FR-16 人工批准 |
| **须人工确认项** | 移交 T-103 B-6；**本文不做方案决选** |

**不在本文件范围**：B-5 方案选项正文（见 `binary-options.md`）、B-6 书面确认记录（T-103）、P1～P4 代码实现（T-104+）。

## 2. 输入依赖

| 文档 | 步骤 | 状态 | 本文件引用 |
|------|------|------|------------|
| `binary-current-state.md` | B-1 现状快照 | T-099 approved | §3 差距、§4 风险 RISK-01 |
| `binary-n8n-review.md` | B-2 n8n 对标 | T-100 approved | §3 差距、§4 风险 RISK-02 |
| `binary-options.md` | B-3 / B-5 | T-101 approved | §5 ADR 影响、§6 确认项 |
| `adr-execution-data.md` | ADR-005 | Accepted | §5 |
| `architecture.md` | §9 Binary | — | §6 确认项模板 |

## 3. 差距清单

> 以 **B-1 能力矩阵**（2026-06-21 代码扫描）为事实基线；B-2 对照表中与 B-1 冲突的条目见 §4 RISK-02。

| ID | 域 | 差距描述 | 现状锚点 | 关联 AC / Phase | 方案选项影响 |
|----|-----|----------|----------|-----------------|--------------|
| GAP-01 | 节点 | Merge `combineAll` **丢弃** upstream binary | BIN-15 未实现；`merge.ts` `combineAll` | AC-047；P4 | OPT-01/03 须修复；OPT-02 可 defer |
| GAP-02 | DB | **Standard** profile 无 `BinaryBlobService` / blob 读写 | BIN-21 未实现 | AC-055；FR-8 全 profile | 三方案均须规划；OPT-02 可 M-5 仅 Lite |
| GAP-03 | 节点 | Merge `combineByKey` 仅保留**首个**非空 binary，非全量合并 | BIN-14 部分实现 | AC-047；P4 | 须 CONF-04 确认策略是否可接受 |
| GAP-04 | 测试 | E2E binary 场景与 `e2e-coverage-matrix` 行未建立 | binary-current-state §4 第 4 项 | AC-052～056 | T-111/T-112；OPT-02 matrix 非 100% |
| GAP-05 | 边界 | 32 MiB Item 硬限制 **enforcement**、Webhook raw body→binary、HTTP 全 Content-Type 响应矩阵 | binary-current-state §4 第 5 项 | AC-048～049 | 范围待 B-6；OPT-02 可 defer Webhook |

### 3.1 B-1 已闭合、B-2 仍标「缺失」的项（待文档同步，非新代码 gap）

| B-2 ID | B-2 结论 | B-1 现状 | 处理 |
|--------|----------|----------|------|
| N8N-02 | rxwf 缺失 | BIN-08 已实现 HTTP 响应→binary | T-100 后续修订 §3 或标注「B-1 优先」 |
| N8N-04 | rxwf 缺失 | BIN-09 已实现 Webhook multipart | 同上 |
| N8N-03 | 部分对齐 | BIN-07 `binaryFromItem` 已实现 | 更新 B-2 为部分对齐 |
| N8N-05 | 部分对齐 | BIN-11 Code 读写 binary 已实现 | 更新 B-2 为部分对齐 |

## 4. 风险清单

| ID | 风险 | 严重度 | 说明 | 缓解 |
|----|------|--------|------|------|
| RISK-01 | **代码超前于 B-6 门禁** | 高 | P1～P3 多项能力已在 main 线落地（binary-current-state §3.2、§5）；后续 T-104+ 若「重复实现」或与未确认默认行为冲突，将浪费工时并引入回归 | B-6 确认 OPT + Phase 范围；对已落地项标 `done-in-main`，仅补 gap |
| RISK-02 | **B-2 与 B-1 事实不一致** | 中 | n8n 对标仍标 HTTP 响应/Webhook 缺失，与 BIN-08/09 矛盾；误导方案评估与测试范围 | Wave 2 后同步修订 `binary-n8n-review.md` §3（非 T-102 所有权） |
| RISK-03 | **OPT-03 触发 ADR / FR-16** | 高 | n8n 优先方案可能改 inline 阈值（512 KiB）、HTTP `responseBinaryMode` 默认 `auto`，偏离 ADR-005 与 draft spec | B-6 若选 OPT-03 → 先走 §5 ADR 修订提案 + FR-16 |
| RISK-04 | **Lite-only blob 外置** | 中 | BIN-20 部分实现且依赖 Lite `binary-blob-service`；Standard 无 hydrate → 大 binary 在 Standard 轨行为未定义 | CONF-02/03 + GAP-02；M-5 验收轨以 Lite 为主（architecture §9.3） |

## 5. ADR-005 影响分析

**基线**（`adr-execution-data.md` §2.5）：`execution_blobs` 表（id、execution_id、node_run_id、kind、storage_path、size_bytes、sha256）；FR-8 大 Item 外置策略；**未**规定 WorkflowItem.binary 字段级 inline 阈值。

| 决选方向 | ADR-005 影响 | 是否须 FR-16 | 修订提案位置 |
|----------|--------------|--------------|--------------|
| **OPT-01** draft spec P1～P4 | 低：与 Accepted design spec 一致；blob 表结构已存在 | 否（若阈值 256 KiB / 32 MiB 与 spec 一致） | — |
| **OPT-02** v1 切片 + defer | 低：defer 项不改变 ADR 表结构 | 否 | — |
| **OPT-03** n8n 优先 | 中～高：阈值可配置、HTTP 默认语义变更 | **是**（偏离 §2.5 隐含 inline 策略或新增 env） | `adr-execution-data.md` §6 待决提案 |
| **Standard blob**（任意 OPT） | 中：须在 Standard 轨实现 blob store 或明确「M-5 仅 Lite」 | 视范围：全 profile → **是** | ADR §6 提案 B |
| **WorkflowItem.binary `ref` 持久化格式** | 高：变更 JSON 序列化或 blob 表字段 | **是** | ADR §6 提案 A（B-6 前禁止实施） |

### 5.1 与 AC-055 的对应

AC-055 要求「ADR/执行数据模型大变动已人工确认」。下列变动 **必须在 B-6/T-103 中显式确认** 后方可进入 T-104+：

1. 修改 `WorkflowItem.binary` / `BinaryAttachment` 持久化 JSON 形状
2. 新增或变更 `execution_blobs` 列（如 `mime_type`、`content_encoding`）
3. 变更 HTTP 节点默认 `responseBinaryMode`（影响既有工作流 replay 语义）
4. Standard 轨引入 blob 后端（新表或复用 PG bytea / 对象存储）

详细条件化修订提案见 `adr-execution-data.md` **§6 M-5 Binary 待决修订提案**。

## 6. 须人工确认项

> B-6 已于 **2026-06-21** 由用户书面确认；决选记录见 `docs/test/milestones/M-5-binary-plan-confirmation.md`。

| ID | 确认项 | 决选值 | 关联 |
|----|--------|--------|------|
| CONF-01 | **选定方案 ID** | **OPT-01**（按 draft spec 全量 P1～P4） | binary-options §3 |
| CONF-02 | **inline 阈值** | **256 KiB**（draft spec 默认） | ADR-005 §6 提案 A |
| CONF-03 | **单 Item 32 MiB 上限** | **保留硬上限** | GAP-05；FR-8 |
| CONF-04 | **Merge combine binary 策略** | **combineByKey 保留首个非空**；**combineAll 须保留 upstream binary**（P4） | GAP-01、GAP-03 |
| CONF-05 | **Webhook multipart 键名** | **按 draft spec**（form field 名→binary key；multipart 见 spec） | GAP-05；N8N-04 |
| CONF-06 | **HTTP `responseBinaryMode` 默认** | **`off`**（draft spec 默认） | RISK-03；BIN-08 |

### 6.1 OPT-02 defer 清单（若选 OPT-02 须一并书面确认）

- Webhook multipart（AC-049）
- Set/Code **新增** binary 产出（若 main 已部分实现则标为 verify-only）
- Merge combineByKey / ReadWriteFile readBinary defer 范围

## 7. B-4 门禁结论

| 检查项 | 结果 |
|--------|------|
| B-1/B-2/B-3 输入已引用 | **是**（§2） |
| 差距清单 ≥5 项可验证 gap | **是**（GAP-01～05） |
| 风险清单含代码超前与 ADR 波及 | **是**（RISK-01～04） |
| ADR-005 影响与 AC-055 / FR-16 路径已文档化 | **是**（§5） |
| 须人工确认项 ≥6 项、决选已记录 | **是**（CONF-01～06；T-103） |
| **b4RisksGate** | **cleared** |
| **b6ImplementationGate** | **cleared**（T-103 / OPT-01 / 2026-06-21） |

**结论（AC-055 / B-4）**：差距/风险与 ADR 影响清单已完成；B-6 用户已确认 **OPT-01** 全量 P1～P4 及 CONF-01～06 默认值。剩余可验证 gap 集中在 Merge combineAll、Standard blob、E2E 与边界 enforcement——由 T-104+ 按确认方案实施。

### 7.1 后续任务依赖

| 任务 | 依赖本文件 |
|------|------------|
| T-103 B-6 人工方案确认 | §6 CONF-01～06 + `binary-options.md` |
| T-104+ Binary 实现 | **须** `b6ImplementationGate: cleared` |
| T-100 文档维护（可选） | §3.1 B-2 同步 |

---

**维护**：B-6 确认后由 T-103 更新各 frontmatter 门禁；代码或 ADR 变更后须重跑 `node docs/architecture/binary-risks.test.mjs` 并修订 §3～§6。
