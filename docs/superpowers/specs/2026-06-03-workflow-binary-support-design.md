# 工作流 Item Binary 全链路支持设计

| 字段 | 内容 |
|------|------|
| **状态** | Accepted — 待 implementation plan 执行 |
| **日期** | 2026-06-03 |
| **前置** | [JS 表达式 globals](./2026-06-03-js-expression-globals-design.md) **Implemented**；[现状分析](../../binary-type-support-analysis.md) |
| **关联** | FR-9 Items、FR-8 执行日志、[ADR-005](../../adr-execution-data.md)、HTTP/Webhook/Code/Set 节点 |

---

## 1. 背景

### 1.1 两种「binary」语义

| 语义 | 说明 | 现状 |
|------|------|------|
| **HTTP body `binary`** | 请求体 Base64 解码发送 | ✅ 已实现 |
| **`WorkflowItem.binary`** | Item 命名附件 `{ key: { data, mimeType, … } }` | ⚠️ 类型 + 表达式可读；**无生产者、无 blob、多数节点丢弃** |

### 1.2 已确认决策（brainstorm）

| 项 | 决策 |
|----|------|
| 目标场景 | **全部**：HTTP 下载/上传、Webhook 接收、Set/Code 产出、透传 + 调试 UI |
| 表达式路线 | **B** — 与 JS globals 一并交付（**已完成**） |
| 大文件持久化 | **A** — v1 必须：`execution_blobs` + UI 元数据摘要（不灌 base64 全文） |
| 架构路线 | **平台内核优先** + **HTTP 下载** 作 v1 验收切片 |

---

## 2. 目标与非目标

### 2.1 目标（分 Phase）

| Phase | 交付 | 场景 |
|-------|------|------|
| **P1** | 共享类型、blob 服务、透传 helper、HTTP 响应→binary、调试 UI 摘要 | A + E |
| **P2** | HTTP body 引用 `$binary`；Webhook multipart/raw→binary | B + C |
| **P3** | Set 产出 binary；Code return `[{ json, binary }]` | D |
| **P4** | Merge combine 策略、ReadWriteFile 读 binary | 边角 |

### 2.2 非目标

- AI Vision 多模态（spec v2.0 P2）
- `$vars` 存 binary
- Standard 版 S3 blob（Lite 先本地文件；接口预留）
- 新增 n8n 式「Move Binary Data」专用节点（用 Set/HTTP 覆盖）

---

## 3. 数据模型

### 3.1 共享类型（扩展 `packages/shared/src/item.ts`）

```ts
export type BinaryBlobRef = {
  blobId: string;
};

export type BinaryAttachment = {
  /** base64 明文；外置后可为空字符串 */
  data: string;
  mimeType: string;
  fileName?: string;
  /** 解码后字节数 */
  fileSize?: number;
  /** 大附件外置引用 */
  ref?: BinaryBlobRef;
};

export type BinaryMap = Record<string, BinaryAttachment>;

export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: BinaryMap;
}
```

与 [globals spec §4.5](./2026-06-03-js-expression-globals-design.md) 对齐；`fileName` 正式纳入共享类型。

### 3.2 Blob 阈值与策略

| 项 | 值 |
|----|-----|
| 单附件 inline 上限 | **256 KiB**（解码后字节） |
| 超限 | 写入 `execution_blobs` + item 内 `ref.blobId`；`data: ''` |
| 单 Item 总 binary 上限 | **32 MiB**（可 env 配置）；超限 → 节点 `E2002` |
| 执行加载 | 下游节点执行前 **hydrate**：`ref` → 读 blob → 填充 `data`（或流式，P1 用 base64 hydrate） |
| 调试/Pin | 列表仅 `{ key, mimeType, fileSize, ref? }`；详情按需拉 blob |

表结构沿用 [ADR-005 §2.5](../../adr-execution-data.md) `execution_blobs`（Lite SQLite 已存在 schema）。

---

## 4. 平台内核

### 4.1 新包/模块建议

`packages/shared/src/binary/`（或 `packages/execution/src/binary/`）：

| 导出 | 职责 |
|------|------|
| `isBinaryMap(v)` | 形状校验（复用 expression `to-display-string` 逻辑，避免重复） |
| `decodeBinaryData(att)` | base64 → Buffer |
| `encodeBinaryBuffer(buf, mimeType, opts?)` | → `BinaryAttachment` |
| `preserveBinary(input, patch)` | 合并 json 时默认保留 `input.binary` |
| `BinaryBlobService` | `store(executionId, nodeRunId, buffer, kind)` / `load(blobId)` / `hydrateItem(item)` |

### 4.2 透传契约

**默认规则：** 变换 `json` 的节点 **必须** 显式保留 binary，除非文档声明「仅输出 json」。

| 节点 | P1 行为 |
|------|---------|
| Set | ✅ 已有 spread；P3 支持写入新 key |
| IF / Wait / Switch | ✅ 透传 item |
| Merge append | ✅ flat 保留 |
| Merge combineByKey | 合并 json；**保留第一个非空 binary**（P4 文档化） |
| HTTP | P1：**透传 input binary** + 可选 **响应 binary** |
| JSON / Code | P1：透传 input；P3 Code 可输出 binary |
| 其他 transform | 使用 `preserveBinary` helper |

### 4.3 持久化钩子

在 **node_run 写入前**（`node-run-repository` / execution runner）：

1. 遍历 `outputItems` 中每个 `binary` 附件
2. 超阈值 → `BinaryBlobService.store` → 替换为 `ref`
3. `node_runs.outputData` 存 **脱敏后** JSON（含 ref，不含大 base64）
4. 索引：`execution_blobs` 行关联 `execution_id`、`node_run_id`、`kind=output`

读取执行详情 / 下游 hydrate：在 **facade 交给 node-runner 之前** 对 `inputItems` 调用 `hydrateItem`。

---

## 5. 场景设计

### 5.1 HTTP 响应 → binary（P1，场景 A）

**节点参数新增：**

```ts
responseBinaryMode?: 'off' | 'auto' | 'always';
responseBinaryPropertyName?: string; // 默认 'data'
```

| 模式 | 行为 |
|------|------|
| `off` | 现状：body 进 `json.body` 文本 |
| `auto` | `Content-Type` 非 text/json/xml 或 body 非 UTF-8 → 写入 `binary[propertyName]` |
| `always` | 响应体一律 binary；`json` 仅 metadata（statusCode、headers） |

实现：`parseHttpResponseBody` 增加 `arrayBuffer()` 路径；`mimeType` 取自响应头；`fileName` 可选从 `Content-Disposition`。

### 5.2 HTTP 请求引用 binary（P2，场景 B）

`bodyContentType` 新增选项或字段模式：

- `={{ $binary.data.data }}`（整段 expression）或
- `binaryProperty: 'data'` + 自动取当前 item `$binary.data`

发送时：`Buffer.from attachment.data`（hydrate 后）。

### 5.3 Webhook 接收（P2，场景 C）

Webhook 触发 API 层：

| Content-Type | 行为 |
|--------------|------|
| `application/json` | 现状 `json` body |
| `multipart/form-data` | 文件字段 → `binary[fieldName]`；文本字段 → `json` |
| `application/octet-stream` / 未知 | 单附件 `binary.data` |

### 5.4 Set / Code 产出（P3，场景 D）

**Set：** `parameters.binaryFields` 或 expression 模式整对象返回 `BinaryMap` 时 merge 进 item.binary（与 globals §5.5 对齐）。

**Code：** `sandbox-worker` 解析 `return [{ json, binary }]`；类型扩展含 binary；仍禁止用户直接操作 Buffer API，可用 base64 字符串构造。

### 5.5 调试 UI（P1，场景 E）

- `editor-debug-types.ts`：`WorkflowItem` 含 `binary?`
- `itemsForDebugDisplay`：binary 显示为 `{ key: { mimeType, fileSize, fileName?, ref? } }`
- 执行详情 API：大 binary 不 inline；提供 `GET .../blobs/:id`（可选 P1.1）

---

## 6. 与表达式引擎的衔接（已就绪）

| 能力 | 状态 |
|------|------|
| `$binary` / `$nodes["X"].binary` | ✅ Implemented |
| 嵌入 `[binary:key]` | ✅ `toDisplayString` |
| `itemExpressionContext.binary` | ✅ |
| 表达式 **返回** BinaryMap → Set 写入 | ❌ P3 |

---

## 7. 测试

| 层级 | 内容 |
|------|------|
| 单元 | `BinaryBlobService` 阈值、hydrate、preserveBinary |
| node-runner | HTTP auto binary、透传、Webhook multipart |
| 集成 | GET 文件 → IF 条件 `$binary.data.mimeType` → Set 透传 → 执行日志无大 base64 |
| 回归 | 现有 HTTP json 响应不受影响（`responseBinaryMode: off` 默认） |

---

## 8. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-06-03 | 初稿；前置 globals Implemented；brainstorm 决策纳入 |
