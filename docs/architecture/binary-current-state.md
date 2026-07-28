---
status: approved
b1SnapshotDate: 2026-06-21
trace: AC-045
milestone: M-5
m5BinaryPlanGate: cleared
specRefs:
  - docs/spec.md FR-9 / FR-8
  - docs/architecture/architecture.md §9 Binary
  - docs/binary-type-support-analysis.md
  - docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
---

# Binary 现状快照矩阵（B-1）

> **任务**：T-099 · **验收**：AC-045 · **门禁**：`m5BinaryPlanGate: cleared`（B-6 已于 T-103 用户确认 OPT-01；见 `M-5-binary-plan-confirmation.md`）。

## 1. 目的与范围

在 M-5 **B-6 人工方案确认**之前，记录代码库 **WorkflowItem.binary** 全链路现状（类型 / HTTP / 节点透传 / DB），作为 B-2 n8n 对标与 B-4 差距分析的输入。**本文件不写最终技术决选**。

**两种 binary 语义**（与 design spec §1.1 一致）：

| 语义 | 说明 |
|------|------|
| **A. `WorkflowItem.binary`** | Item 命名附件 `{ key: { data, mimeType, … } }` |
| **B. HTTP `bodyContentType: binary`** | 出站请求体 Base64 解码发送（可与 A 组合，如 `binaryFromItem`） |

**扫描范围**：`packages/shared`、`packages/node-runner`、`packages/sandbox`、`packages/providers/lite`、`packages/expression`、`apps/api`（execution runtime、webhook 解析）、`apps/web`（编辑器 HTTP/调试 UI）。**不在范围**：Standard/Plus blob 后端、E2E binary 场景（M-5 Wave 4+）。

**参考**：`docs/architecture/architecture.md` **§9 Binary** 审查流程；`docs/binary-type-support-analysis.md`（2026-06-03，部分条目已被后续 P1 补丁超越，以本矩阵为准）。

## 2. 扫描方法

1. **类型层**：阅读 `packages/shared/src/item.ts`、`binary/*.ts` 与导出索引。
2. **HTTP 层**：`http-body.ts`、`http-request.ts`、`http-response.ts`、`executors/http.ts` 及 `http.test.ts`。
3. **节点透传**：检索 `node-runner/src/executors/**` 中 `binary` 读写；Merge/Set/Code/ReadWriteFile/Webhook 单测。
4. **表达式**：`packages/expression` globals、`node-runner/expression/item-context.ts`。
5. **DB / 运行时**：`providers/lite` schema + `binary-blob-service`；`apps/api/.../create-execution-runtime.ts` 中 `externalizeOutputItems` / `hydrateWorkflowItems`。
6. **Webhook**：`apps/api/src/webhook/parse-webhook-body.ts` 及单测。
7. **前端**：`HttpBodyEditor.tsx`、`editor-debug-types.ts`（binary 摘要展示）。

## 3. 能力矩阵

| ID | 域 | 能力 | 现状 | 代码锚点 |
|----|-----|------|------|----------|
| BIN-01 | 类型 | `WorkflowItem.binary` / `BinaryAttachment` / `BinaryMap` / `BinaryBlobRef` | 已实现 | `packages/shared/src/item.ts` |
| BIN-02 | 类型 | 编解码、inline 256KiB / item 32MiB 常量、`withJsonPreservingBinary` | 已实现 | `packages/shared/src/binary/binary-utils.ts` |
| BIN-03 | 类型 | 大二进制外置 `externalize*` / `hydrate*`（`ref.blobId`） | 已实现 | `packages/shared/src/binary/binary-persistence.ts` |
| BIN-04 | 类型 | 调试 UI 元数据摘要（不含 base64 全文） | 已实现 | `packages/shared/src/binary/binary-display.ts`；`apps/web/.../editor-debug-types.ts` |
| BIN-05 | 表达式 | `$binary` / `$input.binary` / `$nodes[...].binary` 执行期注入 | 已实现 | `packages/expression`；`node-runner/expression/item-context.ts` |
| BIN-06 | HTTP | 请求体 `bodyContentType: binary`（Base64 → Buffer） | 已实现 | `node-runner/http-request.ts`；`executors/http.test.ts` |
| BIN-07 | HTTP | 请求体 `binaryFromItem`（引用 item.binary 字段） | 已实现 | `executors/http.ts`；`http-body.ts` |
| BIN-08 | HTTP | 响应体写入 `item.binary`（`responseBinaryMode: auto` 等） | 已实现 | `node-runner/http-response.ts`；`executors/http.test.ts` |
| BIN-09 | HTTP | Webhook `multipart/form-data` 文件 → `$binary` | 已实现 | `apps/api/src/webhook/parse-webhook-body.ts` |
| BIN-10 | 节点 | Set 表达式模式合并 binary 附件 | 已实现 | `executors/transform/set.ts`；`set-binary.ts` |
| BIN-11 | 节点 | Code 沙箱读/写 binary（return `[{ json, binary }]`） | 已实现 | `packages/sandbox/src/sandbox-item-utils.ts`；`run-in-sandbox.test.ts` |
| BIN-12 | 节点 | ReadWriteFile `readBinary` / `writeBinary` | 已实现 | `executors/read-write-file.*` |
| BIN-13 | 节点 | Merge `append` 保留各 branch item（含 binary） | 已实现 | `executors/control-flow/merge.ts` |
| BIN-14 | 节点 | Merge `combineByKey` 合并 json 并保留首个非空 binary | 部分实现 | `merge.ts` `mergeJsonItems` |
| BIN-15 | 节点 | Merge `combineAll` 仅包装 json 分支，**丢弃 binary** | 未实现 | `merge.ts` `combineAll` 分支 |
| BIN-16 | 节点 | IF / Wait / Webhook 触发器透传输入 item（含 binary） | 已实现 | 各 executor + `webhook.test.ts` |
| BIN-17 | 节点 | JSON 变换节点输出保留上游 binary | 已实现 | `executors/transform/json.test.ts` |
| BIN-18 | DB | Lite `execution_blobs` 表 + migration | 已实现 | `providers/lite/src/drizzle/schema.ts` |
| BIN-19 | DB | Lite `BinaryBlobService` store/load（本地 `blobs/<executionId>/`） | 已实现 | `providers/lite/src/binary-blob-service.ts` |
| BIN-20 | DB | 执行运行时：node_run 持久化前 externalize、执行前 hydrate | 部分实现 | `apps/api/.../create-execution-runtime.ts`（**Lite blobService 存在时**；Standard 无等价服务） |
| BIN-21 | DB | Standard（Postgres）blob 存储与检索 | 未实现 | `packages/providers/standard` 无 binary blob |

### 3.1 分层摘要

| 分层 | 结论 |
|------|------|
| **类型** | 共享模型与 helper 已齐；`BinaryBlobRef` 外置路径在 Lite 可跑通。 |
| **HTTP** | 出站 binary / binaryFromItem、入站响应→binary、Webhook multipart 均已落地。 |
| **节点透传** | 主路径（Set/Code/HTTP/ReadWriteFile/IF/Webhook/JSON）可用；Merge `combineAll` 仍为缺口。 |
| **DB** | Lite 端到端 wired；Standard 轨 blob 未实现；FR-8「全 profile 大二进制外置」**未完整**。 |

### 3.2 与 design spec Phase 对照（快照，非决选）

| Phase | design spec 意图 | 快照结论 |
|-------|------------------|----------|
| P1 | 类型、blob、透传 helper、HTTP 响应→binary、调试摘要 | **大部分已在 main 线**（早于 M-5 B-6） |
| P2 | HTTP 引用 `$binary`；Webhook multipart | **已实现**（Webhook multipart；HTTP binaryFromItem） |
| P3 | Set/Code 产出 binary | **已实现** |
| P4 | Merge combine 策略、ReadWriteFile | **ReadWriteFile 已实现**；Merge combineAll **未** |

> **风险**：代码已超前于 B-6 门禁所保护的「未确认方案」边界；M-5 后续任务须对照 B-4/B-5 人工确认项，避免与已落地行为冲突（见 §5）。

## 4. 已知缺口（供 B-4 引用）

1. Merge `combineAll` 不保留 binary（BIN-15）。
2. Standard profile 无 `BinaryBlobService`（BIN-21）；大 payload 外置仅 Lite。
3. `binary-type-support-analysis.md` §3.6「无 execution_blobs 读写」**已过时**——Lite + runtime 已接通（BIN-19/20）。
4. E2E binary 场景与 matrix 行尚未建立（T-111/T-112）。
5. Webhook raw body → binary、HTTP 全响应类型矩阵、32MiB 硬限制 enforcement 等待 B-6 范围确认。

## 5. M-5 门禁状态

| 门禁 | 状态 | 说明 |
|------|------|------|
| **B-1 现状快照**（本文件） | **完成** | T-099；矩阵 BIN-01～BIN-21 |
| **B-2 n8n 对标** | 待办 | T-100 → `binary-n8n-review.md` |
| **B-3 业界采样** | 待办 | T-101 |
| **B-4 差距/风险** | 待办 | T-102 |
| **B-5 方案选项** | 待办 | architect；≥2 选项、无决选 |
| **B-6 人工方案确认** | **cleared** | T-103；用户确认 **OPT-01** P1～P4（2026-06-21） |
| **B-7 实施** | **进行中** | B-6 cleared；T-104+ 可启动 |

**维护**：M-5 实现 PR 合入前须 `node docs/architecture/binary-current-state.test.mjs` green；B-6 确认后将 frontmatter `m5BinaryPlanGate` 改为 `cleared`（T-103 任务所有权）。

**实现测试门禁**：`assertM5BinaryImplementationAllowed()`（导出自 `binary-current-state.test.mjs`）在 `m5BinaryPlanGate !== cleared` 时 **必须 throw**——T-104+ 实现测试依赖此断言失败直至 B-6 通过。
