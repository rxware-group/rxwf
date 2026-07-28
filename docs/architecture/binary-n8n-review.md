---
status: approved
b2N8nReviewGate: cleared
b6ImplementationGate: cleared
reviewDate: 2026-06-21
trace: AC-045
task: T-100
milestone: M-5
specRefs:
  - docs/spec.md FR-9 Items / FR-11 Binary
  - docs/architecture/architecture.md §9 Binary
  - docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md
  - docs/binary-type-support-analysis.md
  - docs/requirements/PRD.md AC-045 / OQ-005
---

# n8n Binary 对标审查（B-2）

> **任务**：T-100 · **验收**：AC-045 · **门禁**：`b2N8nReviewGate: cleared`；**实现** `b6ImplementationGate: cleared`（B-6 已于 T-103 用户确认 OPT-01）。

## 1. 目的与范围

在 M-5 Binary Milestone 方案选项（B-5）与人工确认（B-6）之前，对照 **n8n** 的 Item 级 binary 数据模型与全链路行为，记录 rx-workflow 现状差距，为 B-4 风险清单与 B-5 方案选项提供事实基线。

**评估范围**（architecture.md §9.2 **B-2** 五项）：

| 在范围 | 不在范围 |
|--------|----------|
| Item `binary` 命名键与 `IBinaryData` 字段 | B-5 最终方案决选（T-101） |
| HTTP 响应 download → binary | B-6 人工确认记录（T-103） |
| HTTP 请求 upload（multipart / raw binary body） | 具体实现代码（T-104+） |
| Webhook multipart 接收 → binary | Node-RED / Temporal 详细采样（T-101 B-3） |
| 表达式 `$binary` / Code `getBinaryDataBuffer` | AI Vision 多模态（spec v2.0 P2） |
| 大文件存储 / blob 外置模式 | |

**现状快照来源**：`docs/binary-type-support-analysis.md`（2026-06-03 复核）、`packages/shared/src/item.ts`、`packages/shared/src/binary/`、`packages/providers/lite/src/binary-blob-service.ts`；T-099 `binary-current-state.md` 合入后须交叉核对矩阵。

## 2. n8n 参考来源

| 来源 | URL / 路径 | 用途 |
|------|------------|------|
| n8n Binary data 概览 | [docs.n8n.io/data/binary-data](https://docs.n8n.io/data/binary-data/) | 节点族、Code 访问、自托管配置 |
| `IBinaryData` 接口 | [n8n-io/n8n `packages/workflow/src/interfaces.ts`](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts) | 权威字段：`data`、`mimeType`、`fileName`、`fileType`、`fileSize`、`bytes`、`id` |
| BinaryFile 表达式 | [docs.n8n.io BinaryFile](https://docs.n8n.io/data/expression-reference/binaryfile/) | `fileName`、`mimeType`、`fileSize`、`id` 等表达式属性 |
| Code `getBinaryDataBuffer` | [docs.n8n.io cookbook](https://docs.n8n.io/code/cookbook/code-node/get-binary-data-buffer/) | 运行期读 buffer；禁止直接访问 `items[0].binary.data.data` |
| `BinaryDataService` | [n8n `binary-data.service.ts`](https://github.com/n8n-io/n8n/blob/master/packages/core/src/binary-data/binary-data.service.ts) | filesystem / S3 外置；`data` 字段存 mode 标记 |
| HTTP Request 节点 | [docs.n8n.io HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) | Response Format `File`；Body `n8n Binary File` / multipart |
| Webhook multipart | [n8n Community #15945](https://community.n8n.io/t/webhook-accepting-multipart-data-from-form-loses-name-of-binary-data-input-files/15945) | 多文件 `prefix0`、`prefix1`；Binary Property 覆盖字段名 |
| 环境变量 | `N8N_BINARY_DATA_MODE`（default / filesystem / s3） | Cloud 默认 filesystem；self-hosted 建议对齐 |

### 2.1 n8n Item binary 模型摘要

```typescript
// n8n INodeExecutionData
interface INodeExecutionData {
  json: IDataObject;
  binary?: IBinaryData; // Record<propertyName, IBinaryData>
}

interface IBinaryData {
  data: string;           // base64 或 mode 标记（如 "filesystem-v2"）
  mimeType: string;
  fileName?: string;
  fileType?: BinaryFileType;
  fileExtension?: string;
  fileSize?: string;      // 人类可读字符串，如 "163 kB"
  bytes?: number;
  id?: string;            // 外置 blob ID
  directory?: string;
}
```

**关键语义**：

- **命名键**：每个附件占 `binary` 对象的一个属性名（默认 `data`；Webhook 多文件时为 `data0`、`data1` 或自定义 prefix + 序号）。
- **生产者**：Read/Write Files、Convert to File、Extract From File、HTTP Request（Response File）、Webhook（multipart）、Code（`prepareBinaryData`）等。
- **消费者**：HTTP Request（multipart / binary body）、Email 附件、Write File、Code（`getBinaryDataBuffer`）。
- **透传**：Set 节点须显式「Include Binary Data」；否则下游丢失（社区常见问题）。

## 3. n8n 对标对照表

| ID | 对标维度 | n8n 行为 | rxwf 现状 | 差距/结论 |
|----|----------|----------|-----------|-----------|
| N8N-01 | Item binary 键模型 | `item.binary[propertyName]` → `IBinaryData`；含 `data`/`mimeType`/`fileName`/`fileSize`/`id` 等 | `WorkflowItem.binary?: Record<string, BinaryAttachment>`；`data`/`mimeType`/`fileName?`/`fileSize?`/`ref?`（`packages/shared/src/item.ts`） | 部分对齐 |
| N8N-02 | HTTP 响应 → binary | Response Format = `File` 或 `Binary`；响应体写入命名 binary 键（默认 `data`） | HTTP 节点仅 `json.body` 文本解析；**无**响应→binary 路径（`binary-type-support-analysis.md` §3.2） | rxwf 缺失 |
| N8N-03 | HTTP 请求 upload | Body：`n8n Binary File`（引用 `$binary` 键）或 multipart/form-data + Binary File 参数；raw binary body | `bodyContentType: 'binary'` 发送 Base64 解码字节；**不读** input `WorkflowItem.binary`；输出丢弃 input binary | 部分对齐 |
| N8N-04 | Webhook multipart | Webhook 开启 Binary Data；multipart 文件 → `binary` 键（单文件 `data`，多文件 `prefix0`…）；json 保留非文件字段 | Webhook 输出 `{ json: body }`；**无** multipart→binary；无 indexed 键策略 | rxwf 缺失 |
| N8N-05 | 表达式 / Code | 表达式 `$('Node').item.binary.data`；Code `await helpers.getBinaryDataBuffer(itemIndex, propertyName)` | 表达式 `$binary` / `$input.item.binary` 已落地（`packages/expression`）；Code Worker `$input` 类型**无** binary，返回值仅提取 `json` | 部分对齐 |
| N8N-06 | 存储 / blob 外置 | `N8N_BINARY_DATA_MODE` filesystem 或 s3；超限后 `data`=mode 标记 + `id`；`getBinaryDataBuffer` hydrate | ADR-005 `execution_blobs` + Lite `binary-blob-service.ts` 已存在；draft spec 256KiB inline / 32MiB 上限；执行路径 hydrate 未接线 | 待 B-6 确认 |

## 4. 差距摘要（供 B-4 / B-5）

### 4.1 已对齐或部分对齐

| 项 | 说明 |
|----|------|
| 命名键模型 | rxwf `BinaryMap` 与 n8n `Record<name, IBinaryData>` 同构；缺 `fileType`/`fileExtension`/`directory`（非 P1 阻塞） |
| 表达式读取 | `$binary` 全局与 `[binary:key]` 占位已实现；n8n 的 `$('NodeName')` 对应 `$nodes["节点名"]` |
| 出站 HTTP raw body | rxwf `bodyContentType: 'binary'` 等价 n8n raw binary send，但数据源为参数 Base64 而非 item binary |
| 节点透传（部分） | Set / IF / Wait / Merge append 透传；Merge combine、HTTP、JSON、Code **丢弃** binary |
| Blob 基础设施 | Lite blob store/load + shared utils；与 n8n filesystem mode **概念对齐**，接线待 B-6 后实施 |

### 4.2 关键缺失（须 B-5 方案覆盖）

| 优先级 | 缺失能力 | n8n 参考 | draft spec Phase |
|--------|----------|----------|------------------|
| P1 | HTTP 响应 → binary | HTTP Request Response File | P1 `responseBinaryMode` |
| P1 | 执行链 blob 外置 + hydrate | `BinaryDataService.store` / `getBinaryDataBuffer` | P1 `BinaryBlobService.hydrateItem` |
| P2 | HTTP body 引用 `$binary` | multipart Binary File + Input Data Field Name | P2 |
| P2 | Webhook multipart → binary | Webhook Binary Data + indexed keys | P2 |
| P3 | Set / Code 产出 binary | Set Include Binary；Code return binary | P3 |
| P4 | Merge combine binary 策略 | n8n 各 Merge 模式行为不一 | P4 保留首个非空 |

### 4.3 须 B-6 人工确认项（不在本文决选）

以下与 architecture.md §9.3 示例一致，**仅列出**，最终值由 T-103 记录：

1. inline 阈值是否采用 draft spec **256 KiB**
2. 单 Item binary 总上限 **32 MiB** 是否可 env 覆盖
3. Webhook 多文件键名：`data` / `data0` 还是保留 form field 名
4. Merge `combineByKey` 保留**第一个**非空 binary 是否可接受
5. Code 节点是否 P1 仅透传、P3 才允许输出 binary（与 n8n `getBinaryDataBuffer` 对齐节奏）

### 4.4 n8n 行为差异（非缺陷，方案时注明）

| 差异 | n8n | rxwf 倾向（draft spec） |
|------|-----|-------------------------|
| 外置后 `data` 字段 | 存 mode 字符串（如 `filesystem-v2`） | 存空字符串 + `ref.blobId` |
| `fileSize` 类型 | 人类可读字符串 | 数字字节数 |
| 专用 Move Binary Data 节点 | 有 | 非目标；Set/HTTP 覆盖 |
| Webhook 字段名 | Binary Property 开启时丢失 form 字段名 | 待 B-6 决定是否保留 field 名映射 |

## 5. B-2 审查门禁结论

| 检查项 | 结果 |
|--------|------|
| n8n Item binary 键模型已文档化 | **是**（§2.1、N8N-01） |
| HTTP download/upload 对标完成 | **是**（N8N-02、N8N-03） |
| Webhook multipart 对标完成 | **是**（N8N-04） |
| 表达式 / Code 访问对标完成 | **是**（N8N-05） |
| 存储 / blob 外置对标完成 | **是**（N8N-06） |
| 含 ≥1 项「rxwf 缺失」且未决选方案 | **是**（§4.2；符合 B-2「只审查不决选」） |
| **b2N8nReviewGate** | **cleared** |
| **b6ImplementationGate** | **cleared**（T-103 / OPT-01 / 2026-06-21） |

**结论（AC-045 / B-2）**：n8n Binary 五维对标审查已完成。B-6 用户已确认 **OPT-01** 全量 P1～P4；T-104+ 按确认方案实施，对照 B-1 矩阵补 gap。

### 5.1 后续任务依赖

| 任务 | 依赖本文件 |
|------|------------|
| T-101 业界采样与方案选项 | `binary-n8n-review.md` §4 差距摘要 |
| T-102 差距/风险与 ADR 影响 | §4.3 须人工确认项 |
| T-103 B-6 人工方案确认 | §4.3 + `binary-options.md` |
| T-104+ Binary 实现 | **须** `b6ImplementationGate: cleared` |

---

**维护**：n8n 大版本变更 Item binary 语义或 `N8N_BINARY_DATA_MODE` 行为时，须重跑 `node docs/architecture/binary-n8n-review.test.mjs` 并更新 §3 对照表。
