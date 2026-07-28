# 工作流 Item Binary 支持 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans.  
> **Status:** **Completed**（P1–P4，2026-06-03）

**Goal:** 实现 `WorkflowItem.binary` 全链路：产生（HTTP/Webhook/Set/Code）→ 透传 → blob 外置 → 表达式消费（已就绪）→ 调试 UI 元数据。

**Spec:** [2026-06-03-workflow-binary-support-design.md](../specs/2026-06-03-workflow-binary-support-design.md)

**Architecture:** `packages/shared` 类型扩展 → `packages/providers/lite` `BinaryBlobService` → node-runner HTTP/Webhook/Set/Code → apps/web 调试类型。

---

## Phase map

| Phase | 范围 | 验收 | 状态 |
|-------|------|------|------|
| **P1** | Task 1–6 | HTTP GET 二进制 → `item.binary` → IF `$binary` → blob + UI 摘要 | ✅ |
| **P2** | Task 7–8 | HTTP 上传 `$binary`；Webhook multipart | ✅ |
| **P3** | Task 9–10 | Set/Code 产出 binary | ✅ |
| **P4** | Task 11 | Merge combine、ReadWriteFile | ✅ |

---

## Task 1: 共享类型与 binary 工具

**Files:**
- Modify: `packages/shared/src/item.ts`
- Create: `packages/shared/src/binary/binary-utils.ts`
- Create: `packages/shared/src/binary/binary-utils.test.ts`

- [x] **Step 1:** 扩展 `BinaryAttachment`（`fileName?`, `fileSize?`, `ref?`）
- [x] **Step 2:** `encodeBinaryBuffer` / `decodeBinaryData` / `isBinaryMap`
- [x] **Step 3:** `withJsonPreservingBinary` helper
- [x] **Step 4:** 测试 + `pnpm --filter @rxwf/shared test`

---

## Task 2: BinaryBlobService（Lite）

**Files:**
- Create: `packages/providers/lite/src/binary-blob-service.ts`
- Create: `packages/providers/lite/src/binary-blob-service.test.ts`

- [x] **Step 1:** 本地目录 `data/blobs/{executionId}/` 存储
- [x] **Step 2:** `store()` → `execution_blobs` 行 + 返回 `blobId`
- [x] **Step 3:** `load(blobId)` / `hydrateWorkflowItem(item)`
- [x] **Step 4:** 阈值 **256 KiB** inline vs ref
- [x] **Step 5:** 测试 round-trip

---

## Task 3: 执行持久化集成

**Files:**
- Modify: `apps/api/src/execution/create-execution-runtime.ts`

- [x] **Step 1:** 写入 node_run 前 `externalizeOutputItems`
- [x] **Step 2:** 执行下一节点前 `hydrateWorkflowItems(inputItems)`
- [ ] **Step 3:** 集成测试：大附件 outputData JSON 不含长 base64 串（待补 E2E）

---

## Task 4: HTTP 响应 binary（P1 核心）

**Files:**
- Modify: `packages/node-runner/src/http-response.ts`
- Modify: `packages/node-runner/src/http-request.ts`
- Modify: `packages/node-runner/src/executors/http.ts`
- Modify: `apps/web` param schema / `HttpOutputPreview`
- Modify: `packages/node-runner/src/executors/http.test.ts`

- [x] **Step 1:** `parseHttpResponseBody` 支持 `arrayBuffer` + content-type 判断
- [x] **Step 2:** `responseBinaryMode: auto|always|off`（默认 `off`）
- [x] **Step 3:** executor 输出 `{ json, binary? }` + **透传 input binary**
- [x] **Step 4:** 测试：mock PNG 响应 → `binary.data.mimeType === 'image/png'`

---

## Task 5: 默认透传清扫

**Files:**
- Modify: `packages/node-runner/src/executors/transform/json.ts`
- Modify: `packages/node-runner/src/executors/http.ts`

- [x] **Step 1:** JSON executor 使用 `withJsonPreservingBinary`
- [x] **Step 2:** Merge combineByKey → P4；其余 IF/Switch/Wait 已透传

---

## Task 6: 前端调试类型与展示（P1）

**Files:**
- Modify: `apps/web/src/features/editor/editor-debug-types.ts`
- Modify: `apps/web/src/features/editor/HttpOutputPreview.tsx`
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`

- [x] **Step 1:** `WorkflowItem` 含 `binary?`
- [x] **Step 2:** `itemsForDebugDisplay` → binary 元数据摘要
- [ ] **Step 3:** 手动冒烟：调试运行含 binary 的 HTTP 节点（待人工）

---

## Task 7: HTTP body 从 `$binary` 发送（P2）

**Files:**
- Modify: `packages/node-runner/src/http-request.ts`
- Modify: `HttpBodyEditor.tsx` / param schema

- [x] **Step 1:** `bodyContentType: 'binaryFromItem'`
- [x] **Step 2:** hydrate 后 `decodeBinaryData` 发送
- [x] **Step 3:** 测试上传 round-trip

---

## Task 8: Webhook multipart（P2）

**Files:**
- Modify: `apps/api/src/routes/webhook.ts`
- Create: `apps/api/src/webhook/parse-webhook-body.ts`
- Modify: `packages/node-runner/src/executors/triggers/webhook.ts`

- [x] **Step 1:** API 解析 multipart → `WorkflowItem`
- [x] **Step 2:** octet-stream / 未知 → `binary.data`
- [x] **Step 3:** 测试（parse + route + executor）

---

## Task 9: Set 写入 binary（P3）

**Files:**
- Modify: `packages/node-runner/src/executors/transform/set.ts`
- Create: `packages/node-runner/src/executors/transform/set-binary.ts`

- [x] **Step 1:** expression `={{ $binary.* }}` → merge 到 `item.binary`
- [ ] **Step 2:** 可选 `binaryFields` manual 配置（未做，非阻塞）
- [x] **Step 3:** 测试

---

## Task 10: Code 节点 return binary（P3）

**Files:**
- Modify: `packages/sandbox/src/sandbox-worker.ts`
- Modify: `packages/sandbox/src/run-in-sandbox.ts`
- Modify: `packages/node-runner/src/executors/code.ts`
- Modify: `docs/code-node-guide.md`

- [x] **Step 1:** worker 传递/接收 full `WorkflowItem`（含 `$input[].binary`）
- [x] **Step 2:** `return [{ json, binary }]` 解析；支持多 item 数组
- [x] **Step 3:** 测试

---

## Task 11: Merge / ReadWriteFile（P4）

**Files:**
- Modify: `packages/node-runner/src/executors/control-flow/merge.ts`
- Modify: `packages/node-runner/src/executors/read-write-file.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`

- [x] Merge `combineByKey`：**保留组内第一个非空 binary**
- [x] ReadWriteFile **`readBinary`** operation → `item.binary[propertyName]`

---

## Verification

```bash
pnpm --filter @rxwf/shared test          # 4 passed
pnpm --filter @rxwf/providers-lite test  # incl. binary-blob-service
pnpm --filter @rxwf/node-runner test     # 148 passed
pnpm --filter @rxwf/expression test      # 76 passed
pnpm --filter @rxwf/sandbox test         # 12 passed
pnpm --filter @rxwf/api test -- src/webhook src/routes/webhook.test.ts
```

**E2E 场景：** HTTP(GET 二进制, auto) → IF `{{ $binary.data.fileSize > 0 }}` → Set 透传 → ReadWriteFile(readBinary) → 执行历史 UI 见 mimeType/size、DB 无 256KB+ base64 inline。

---

## Plan self-review

| Spec § | Task | 状态 |
|--------|------|------|
| §3 数据模型 | 1 | ✅ |
| §4.3 blob | 2, 3 | ✅（E2E 集成测试待补） |
| §4.2 透传 | 4, 5, 11 | ✅ |
| §5.1 HTTP 响应 | 4 | ✅ |
| §5.2 HTTP 上传 | 7 | ✅ |
| §5.3 Webhook | 8 | ✅ |
| §5.4 Set/Code | 9, 10 | ✅ |
| §5.5 UI | 6 | ✅（手动冒烟待补） |
| §6 表达式 | globals plan | ✅（先前完成） |

---

## 遗留（非阻塞）

- Task 3 Step 3：大 blob 持久化 E2E 集成测试
- Task 6 Step 3：编辑器手动冒烟
- Task 9 Step 2：`binaryFields` manual 配置
- `GET .../blobs/:id` 下载 API（设计 P1.1 可选）

---

## 执行记录

- **P1–P3：** 2026-06-03 本会话实施
- **P4 Task 11：** Merge combineByKey binary + ReadWriteFile readBinary 完成
