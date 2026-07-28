---
humanGate: approved
selectedOption: OPT-01
trace: AC-045
task: T-101
milestone: M-5
reviewDate: 2026-06-21
specRefs:
  - docs/architecture/architecture.md §9 Binary
  - docs/requirements/PRD.md OQ-005 / FR-11 / AC-045
  - docs/architecture/binary-n8n-review.md
  - docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
  - docs/binary-type-support-analysis.md
---

# Binary 业界采样与方案选项（B-3 / B-5）

> **任务**：T-101 · **验收**：AC-045 · **门禁**：`humanGate: approved` · `selectedOption: OPT-01` — B-6 已于 T-103 用户确认（2026-06-21）。

## 1. 目的与范围

在 M-5 Binary 全链路实施前，完成 `docs/architecture/architecture.md` **§9 Binary 独立 Milestone** 审查流程中的：

| 步骤 | 本文件章节 | 说明 |
|------|------------|------|
| **B-3 业界采样** | §2 | 除 n8n（见 `binary-n8n-review.md`）外，另选 1～2 家记录 binary/大 payload 取舍 |
| **B-5 方案选项** | §3 | 列出 **≥2** 可实施路径，**不含方案定稿** |

**PRD OQ-005 约束摘要**：

- WorkflowItem.binary **全链路**纳入 v2.0，但**不直接照搬**现有 draft spec。
- 实施前须参照 n8n 及业界做法审查；**必要时暂停并请人工方案确认**后再开发（B-6）。
- Binary 为**独立 Milestone**（M-5）；涉及 ADR、执行数据模型、存储架构变更时须 FR-16 人工确认。

**输入依赖**：

| 文档 | 步骤 | 状态 |
|------|------|------|
| `binary-type-support-analysis.md` | B-1 现状快照 | 基线 |
| `binary-n8n-review.md` | B-2 n8n 对标 | T-100 产出 |
| `2026-06-03-workflow-binary-support-design.md` | 草案参考 | Accepted — 待 B-6 确认范围 |

**不在本文件范围**：B-4 差距/风险清单（T-102 `binary-risks.md`）、B-6 书面确认记录（T-103）、P1～P4 代码实现（T-104+）。

## 2. 业界采样（B-3）

除 n8n Item binary 行为（B-2）外，下列系统代表不同的大二进制/附件传递范式，供方案权衡参考。

| ID | 系统 | 二进制模型 | 存储/传递 | 对本产品的启示 | 取舍 |
|----|------|------------|-----------|----------------|------|
| IND-01 | **Node-RED** | `msg.payload` 可为 `Buffer`；部分节点用 `msg.payload` + `msg.filename` | 内存 Buffer 为主；File 节点读写磁盘；无统一 execution blob 层 | 轻量：单进程内 Buffer 传递简单；**缺**跨 run 审计与 Pin 大文件外置 | 借鉴「节点输出 Buffer」语义；**不**照搬无持久化模型 |
| IND-02 | **Temporal** | Workflow/Activity payload 有 **2MB gRPC 硬限**；更大用 **Payload Codec + 外部 blob store**（S3 等） | 框架层透明外置；history 仅存引用 | 与 ADR-005 `execution_blobs` + `ref` 思路一致；Lite 可先 SQLite/本地文件 | 借鉴阈值外置 + hydrate；Standard 轨可预留 S3 codec |
| IND-03 | **Make (Integromat)** | 文件模块独立；场景间通过 **临时文件 URL / 映射** 传递，非 Item 内嵌 base64 | 平台托管临时存储；模块边界清晰 | 产品已有 HTTP body binary；Item 级 binary 需与「模块 IO」对齐 | 参考「生产者节点明确产出文件」UX；非 Move Binary Data 专用节点 |

### 2.1 IND-01 Node-RED — Buffer 即 payload

Node-RED 将二进制视为 `msg.payload` 的 Buffer 形态，File In 节点读入后下游 HTTP Request 可直接发送。优点：心智模型简单、零配置。缺点：

- 无 execution 级 blob 索引；调试/重跑难以复现大文件。
- Merge/Join 对 Buffer 与 JSON 混排无统一 Item 契约。

**对本仓库**：`WorkflowItem.binary` 已是**命名附件 map**（对齐 n8n），优于单一 Buffer payload；但可学习「HTTP/File 节点默认产出 Buffer 并包装为 attachment」的开发者体验。

### 2.2 IND-02 Temporal — 阈值外置 + Payload Codec

Temporal 默认 payload ≤ 2MB；超限通过 Custom Payload Codec 写入 blob store，workflow history 只保留引用。与 `2026-06-03-workflow-binary-support-design.md` 中 **256 KiB inline / 超限 `execution_blobs`** 高度同构。

**对本仓库**：Lite 轨 `BinaryBlobService` + SQLite `execution_blobs`（ADR-005 §2.5 已存在 schema）为 v1 合理默认；**不在 M-5 引入 S3**，仅接口预留。

### 2.3 IND-03 Make — 模块级文件 IO

Make 将「获取文件 / 上传文件」作为独立模块，场景变量传递文件句柄或 URL，而非在每条 bundle 内嵌 base64。

**对本仓库**：HTTP 响应→binary、Webhook multipart→binary 可视为「生产者模块」；Set/Code 产出为 P3 增强。是否 v1 全量纳入见 §3 方案差异。

### 2.4 业界采样小结

| 维度 | n8n（B-2） | Node-RED | Temporal | Make |
|------|------------|----------|----------|------|
| Item 结构 | 命名 binary map | Buffer payload | 外置 blob 引用 | 模块/URL |
| 大文件 | 文件系统 + 内存 | 内存/磁盘 | 外置 store | 平台临时存储 |
| 表达式 | `$binary` | 不适用 | 不适用 | 映射字段 |
| 与本 draft 对齐度 | **高** | 中 | **高（blob）** | 中（UX） |

## 3. 方案选项对照（B-5）

下列 **≥2** 方案均为可行路径，**尚未决选**。B-6 须用户书面确认选项 ID + P1～P4 范围后，方可更新 `humanGate` 并启动 T-104+ 实现。

| ID | 方案名称 | 范围摘要 | P1 | P2 | P3 | P4 | 估工时 | 主要风险 |
|----|----------|----------|----|----|----|----|--------|----------|
| OPT-01 | **按 draft spec 全量 P1～P4** | 完全对齐 `2026-06-03-workflow-binary-support-design.md` Phase 表 | 类型+blob+HTTP 响应→binary+透传+调试 UI | HTTP `$binary` 上传；Webhook multipart/raw | Set/Code 产出 binary | Merge combine 策略；ReadWriteFile readBinary | 大（2+ 周） | 范围大；与 M-5 其他 Wave 并行压力 |
| OPT-02 | **缩小 v1 切片（M-5 最小可验收）** | 平台内核 + **HTTP 下载→binary→IF `$binary`→透传** 为验收主轴；其余 Phase 标 P1.1/post-M-5 | 同 OPT-01 P1 核心 | **仅** HTTP `binaryFromItem`；Webhook multipart **defer** | Set/Code **defer** | Merge/ReadWriteFile **defer** | 中（~1 周） | AC-049/050 部分场景延至 follow-up；matrix 须标注 defer 行 |
| OPT-03 | **n8n 行为优先 + 渐进 blob** | 节点行为逐项对齐 n8n（B-2 表）；blob 外置阈值可配置，默认 **512 KiB** 或 **始终 inline 至 32MiB** | HTTP auto binary + 全节点透传契约 | Webhook multipart 对齐 n8n 字段名 | Set expression binary；Code return binary | 与 n8n Move Binary Data **仍不**新增专用节点 | 中～大 | 偏离 draft 256KiB 默认值 → 须 ADR 修订 + FR-16 |

### 3.1 OPT-01 — 按 draft spec 全量 P1～P4

**描述**：以 Accepted draft spec 为唯一实施蓝本，按 P1→P4 顺序 TDD 交付；与 `2026-06-03-workflow-binary-support.md` 实施计划任务 1～11 对齐。

**包含**：

- `BinaryAttachment` / `BinaryBlobService` / `preserveBinary` 内核
- HTTP `responseBinaryMode: auto|always|off`（默认 off）
- Webhook multipart + octet-stream → `item.binary`
- Set expression merge；Code `return [{ json, binary }]`
- Merge combineByKey 保留首 binary；ReadWriteFile `readBinary`

**优点**：一次满足 AC-047～051 全场景；与现有 draft 文档、表达式 globals 一致。

**缺点**：M-5 Wave 2+ 任务量大；Lite blob 路径与 Webhook 边界用例多，测试维护成本高。

### 3.2 OPT-02 — 缩小 v1 切片（M-5 最小可验收）

**描述**：OQ-005 要求全链路纳入 v2.0，但 **M-5 里程碑内** 仅交付「可演示端到端 binary 传递」的最小切片；defer 项写入 `spec-gap-audit` 与 matrix `defer-M5` 标记，**不** silent exclude。

**M-5 必交付（v1 切片）**：

| 能力 | 说明 |
|------|------|
| 内核 | 类型扩展 + `BinaryBlobService` + 256KiB 阈值 + hydrate |
| 生产者 | HTTP GET 二进制 → `item.binary.data` |
| 消费者 | IF 条件 `$binary.data.fileSize`；HTTP POST `binaryFromItem` |
| 透传 | Set/IF/Wait/Switch/Merge append 保留 binary |
| UI | 调试面板 binary 元数据摘要 |
| E2E | HTTP→IF→Set→执行历史见 mimeType/size |

**Defer 至 M-5.1 或 M-6 前（须 B-6 书面同意 defer 清单）**：

- Webhook multipart（AC-049）
- Set/Code 产出（AC-050 部分）
- Merge combineByKey / ReadWriteFile readBinary

**优点**：更快达到可验收 E2E；降低与 Group Chat 并行改 execution 的冲突面。

**缺点**：matrix Binary 行暂不能 100%；须额外 milestone 或 wave 补齐 defer 项。

### 3.3 OPT-03 — n8n 行为优先 + 渐进 blob

**描述**：以 `binary-n8n-review.md` 对照表为**行为真源**；draft spec 中阈值/默认值若与 n8n 不一致，优先 n8n，并通过 ADR 修订记录差异。

**与 OPT-01 差异**：

| 项 | draft spec | OPT-03 |
|----|------------|--------|
| inline 阈值 | 256 KiB | 可配置；默认 512 KiB 或 v1 全 inline |
| HTTP 默认 | `responseBinaryMode: off` | `auto`（更接近 n8n 下载文件场景） |
| Webhook | multipart 字段→binary key | 严格对齐 n8n 键名与 `content-type` 分支 |
| 专用节点 | 无 Move Binary Data | 仍无；用 Set 覆盖 |

**优点**：用户从 n8n 迁移时行为可预期；审查文档（B-2）直接映射到实现。

**缺点**：可能触发 ADR-005 / FR-16 修订；默认 `auto` 改变现有 HTTP 节点语义（回归风险）。

### 3.4 方案对比矩阵

| 评估维度 | OPT-01 全量 | OPT-02 切片 | OPT-03 n8n 优先 |
|----------|-------------|-------------|-----------------|
| AC-047～051 一次满足 | 高 | 中（部分 defer） | 高 |
| 实现工期 | 长 | 短 | 中～长 |
| 与 draft spec 一致 | 最高 | 中（范围缩小） | 中（阈值/默认可能偏离） |
| n8n 迁移友好 | 高 | 中 | 最高 |
| ADR/FR-16 波及 | 低（已对齐 ADR-005） | 低 | 中～高 |
| E2E matrix 100% | 是 | 否（需 defer 标注） | 是 |
| Lite blob 复杂度 | 全场景 | 较低 | 取决于阈值策略 |

## 4. 人工确认门禁（B-6 已确认）

| 检查项 | 当前状态 |
|--------|----------|
| B-3 业界采样 | ✅ 本文 §2 |
| B-5 ≥2 方案选项 | ✅ OPT-01 / OPT-02 / OPT-03 |
| **最终方案定稿** | ✅ **OPT-01**（T-103 / 2026-06-21） |
| **`humanGate`** | **`approved`** |
| **`selectedOption`** | **`OPT-01`** |
| M-5 实现（T-104+） | **解锁** |

### 4.1 B-6 须用户确认的内容（示例）

1. **选定方案 ID**：OPT-01 | OPT-02 | OPT-03（或组合，如 OPT-02 内核 + OPT-03 HTTP 默认）
2. **Phase 范围**：P1～P4 哪些纳入 M-5，哪些 defer
3. **必须确认项**（architecture.md §9.3）：
   - inline 阈值：256 KiB / 512 KiB / 其他
   - 单 Item 32 MiB 上限是否保留
   - Merge combine binary 策略
   - Webhook multipart 边界与键名
4. **大变动**：若决选偏离 ADR-005 → 先修订 ADR + FR-16 批准

### 4.2 后续任务依赖

```
T-101（本文）→ T-102 差距/风险 → T-103 B-6 确认记录 → T-104+ 实现
```

**确认后动作**（由 T-103 执行，非本文）：

- 更新 `humanGate: approved` 与 `selectedOption: OPT-xx`
- 写入 `docs/test/milestones/M-5-binary-plan-confirmation.md`
- 解锁 `gates.m5-binary-plan`

### 4.3 禁止事项（B-6 前）

- 修改 `WorkflowItem` 持久化格式或新增 blob 表字段
- 变更 HTTP 节点默认 `responseBinaryMode`
- 在本文或 frontmatter 写入 `selectedOption` 或等效决选字段

---

**维护**：B-6 确认后由 T-103 更新 frontmatter；若 n8n 对标或 ADR 变更，须重跑 `node docs/architecture/binary-options.test.mjs` 并修订 §3 选项表。
