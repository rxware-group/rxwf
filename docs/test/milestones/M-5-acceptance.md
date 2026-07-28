---
milestone: M-5
version: 1
updated: 2026-06-21
ac_coverage:
  - AC-045
  - AC-046
  - AC-047
  - AC-048
  - AC-049
  - AC-050
  - AC-051
  - AC-052
  - AC-053
  - AC-054
  - AC-055
  - AC-056
  - AC-070
focus:
  - UX
  - 文档
  - 环境
  - 边界场景
e2e_complement: true
standard_track_required: true
---

# M-5 人工验收用例

> **Milestone**：M-5 — Binary 全链路（OPT-01 P1～P4）  
> **追溯**：FR-11 / AC-045～056, AC-070 / PRD §5.5、§9  
> **E2E 互补**（OQ-009）：本清单侧重 E2E **无法覆盖** 的 **UX**、**文档可读性**、**本地环境验证** 与 **边界场景**；与 `apps/web/e2e/binary-full-chain.spec.ts` 等自动化路径 **互补、非一一对应**。  
> **放行条件**：下列用例 **全部通过** + 全量 E2E green + 用户 `验收 M-5`。

---

## AC 映射摘要

| AC | 功能面 | 人工用例 | matrix 行 | E2E 互补说明 |
|----|--------|----------|-----------|--------------|
| AC-045 | Binary 实施前 n8n/业界对标审查 | M5-MAN-001 | — | 人工 **审查文档可读性与 gate 状态** |
| AC-046 | Binary 技术方案人工确认（B-6） | M5-MAN-002 | — | 人工 **方案确认记录与 CONF 决选对照** |
| AC-047 | WorkflowItem.binary 节点间传递 | M5-MAN-003, M5-MAN-009 | E2E-P-014 | E2E 验透传；人工验 **调试面板 binary 摘要 UX** |
| AC-048 | HTTP 响应 → binary 生产者 | M5-MAN-004 | E2E-P-014 | E2E 验 httpbin；人工验 **responseBinaryMode 面板说明** |
| AC-049 | Webhook multipart 上传 → binary | M5-MAN-005 | E2E-P-014 | E2E 验 multipart；人工验 **form field 键名与帮助** |
| AC-050 | 表达式 `$binary` 读写 | M5-MAN-006 | E2E-P-014 | E2E 验 IF/Set；人工验 **表达式编辑器提示与错误可读性** |
| AC-051 | Binary blob 存储/检索符合方案 | M5-MAN-007 | E2E-P-014 | 人工 **256 KiB / 32 MiB 边界与 Lite blob 路径** |
| AC-052 | Binary 全场景 E2E green | M5-MAN-008 | E2E-P-014 | E2E 验 green；人工验 **本地 standard 轨可复现** |
| AC-053 | matrix Binary 行 100% 覆盖 | M5-MAN-010 | E2E-P-014 | 人工 **matrix status/spec 列对照** |
| AC-054 | 本验收清单全通过 | M5-MAN-011 | — | meta 自检 |
| AC-055 | ADR/执行数据模型大变动已确认 | M5-MAN-002 | — | B-6 记录含 ADR 无需修订结论 |
| AC-056 | 全量 E2E green | M5-MAN-008 | — | E2E 验 green；人工验 **无 Binary 回归** |
| AC-070 | Milestone 人工用例全通过 | M5-MAN-011 | — | 放行门禁 |

---

## 用例清单

### M5-MAN-001：Binary n8n 对标审查文档可读性（B-2）

**追溯 AC**: AC-045

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-045 |
| **matrix 行** | — |
| **nodeType** | httpRequest, webhookTrigger |
| **所属轨** | Lite-only |

**前置条件**

- 仓库 checkout 至 `milestone/m-5-binary` 分支
- `docs/architecture/binary-n8n-review.md` 已入库（T-100）

**步骤**

1. 打开 `docs/architecture/binary-n8n-review.md`，确认含 n8n Items/binary 对照表。
2. 阅读 HTTP download/upload、Webhook multipart、表达式 `$binary`、存储策略各节，确认有 **rx-workflow 现状** 列。
3. 运行 `node docs/architecture/binary-n8n-review.test.mjs`，确认 exit 0。
4. 对照 `docs/architecture/architecture.md` §9.2，确认 B-2 门禁文档引用链完整。

**预期结果**

- 对标文档结构完整，可读，无 open 未决阻塞项。
- 自动化校验脚本 green。
- 与 B-1 现状快照（`binary-current-state.md`）无矛盾。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-002：B-6 人工方案确认记录与 OPT-01 决选

**追溯 AC**: AC-046, AC-055

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-046, AC-055 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/test/milestones/M-5-binary-plan-confirmation.md` 已入库（T-103）
- 用户已书面确认 **OPT-01**（P1～P4 全量）

**步骤**

1. 打开方案确认记录，确认 frontmatter `humanGate: approved`、`b6ImplementationGate: cleared`、`selectedOption: OPT-01`。
2. 阅读 §3 确认项决选表，核对 CONF-01～06（256 KiB、32 MiB、Merge 策略、Webhook 键名、`responseBinaryMode` 默认 `off`）。
3. 运行 `node docs/test/milestones/M-5-binary-plan-confirmation.test.mjs`，确认 3/3 pass。
4. 确认 §2 写明 **ADR/FR-16 无需修订**（AC-055）。

**预期结果**

- B-6 书面记录完整，gate 已 cleared。
- CONF 决选与 `binary-options.md`、`binary-risks.md` §6 一致。
- 实现门禁测试 green，解锁 T-104+。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-003：调试面板 binary 摘要与节点间透传 UX

**追溯 AC**: AC-047

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-047 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | httpRequest, if |
| **所属轨** | Standard |

**前置条件**

- Web 编辑器可访问；Lite/Standard compose 已启动
- 工作流含 HTTP（`responseBinaryMode: auto`）→ IF 节点，或等价 stubbed pinData 路径

**步骤**

1. 对 HTTP 节点执行 debug-node，下载小 PNG 至 `item.binary.data`。
2. 在运行详情/输出面板展开 **binary** 区，确认显示 **mimeType、fileName、fileSize** 摘要，**不含** base64 全文刷屏。
3. 继续 debug IF 节点（上游 HTTP 输出为输入），确认 **binary 仍存在于输出 item**（非丢弃）。
4. 对照 `docs/superpowers/specs/2026-06-03-workflow-binary-support-design.md` §调试 UI，确认摘要字段齐全。

**预期结果**

- 调试 UI binary 摘要可读、无泄露大二进制全文。
- IF 等控制流节点透传上游 binary，与 AC-047 一致。
- 面板字段命名与 design spec 一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-004：HTTP 响应 → binary 与 responseBinaryMode 面板 UX

**追溯 AC**: AC-048

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-048 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | httpRequest |
| **所属轨** | Standard |

**前置条件**

- `docs/help/zh/nodes/httpRequest.md`（或参数 schema）含 `responseBinaryMode` 说明
- 外网 httpbin.org 可达（或本地 mock）

**步骤**

1. 编辑器添加 HTTP Request 节点，设置 URL 为 httpbin PNG/image 端点。
2. 打开参数面板，确认 **responseBinaryMode** 默认值为 **off**（CONF-06），可选 **auto**。
3. 设为 `auto` 后 debug-node，确认输出 `binary.data` 含有效 base64，`mimeType` 为 `image/png`。
4. 设为 `off` 时对二进制响应 debug，确认 **json.body** 为主路径、不自动写入 binary（边界对照）。

**预期结果**

- 默认 `off` 符合 B-6 决选；`auto` 路径产出 binary 附件。
- 面板字段标签/help 可读，用户可理解何时启用 auto。
- 与 E2E AC-048 场景一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-005：Webhook multipart 上传 → binary 键名 UX

**追溯 AC**: AC-049

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-049 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | webhookTrigger |
| **所属轨** | Standard |

**前置条件**

- 工作流含 webhookTrigger（或 Webhook 触发器）且已发布/可触发
- `docs/help/zh/nodes/webhookTrigger.md` 含 multipart 说明（T-108 同步）

**步骤**

1. 打开 webhookTrigger 帮助/参数说明，确认 multipart 文件字段 **form field 名 → binary key** 映射规则可读（CONF-05）。
2. 使用 curl/Postman 向 webhook URL 发送 `multipart/form-data`，字段名 `upload` 附带小 PNG 文件。
3. 查看触发后 webhook 节点输出，确认 `binary.upload`（或 field 名对应 key）含 mimeType、fileName。
4. 对照 E2E AC-049 场景，确认 live webhook 与 stubbed pinData 行为一致。

**预期结果**

- multipart 键名按 draft spec：form field 名即 binary key。
- 触发器输出含完整 binary 元数据，非仅 json 引用。
- 帮助文档与实现一致，用户可自助构造 multipart 请求。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-006：表达式 `$binary` 读写与 IF/Set 边界 UX

**追溯 AC**: AC-050

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-050 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | if, set |
| **所属轨** | Standard |

**前置条件**

- 上游 item 含 stubbed 或 live `binary.data`（PNG base64）
- 表达式编辑器可输入 `$binary.data.mimeType` 等路径

**步骤**

1. IF 节点条件设为 `$binary.data.mimeType === 'image/png'`，debug 确认 **true 分支**路由正确。
2. Set 节点（表达式模式）设置字段引用 `$binary.data.fileName`，debug 确认 json 输出含文件名且 **binary 未丢失**。
3. 故意输入无效表达式 `$binary.missingKey.foo`，确认错误消息可读（非裸 stack）。
4. 对照 `docs/help/zh/nodes/loop.md` 等含 `$binary` 示例的文档，确认与编辑器行为一致。

**预期结果**

- `$binary` 读路径在 IF/Set 可用；写/合并后 binary 保留。
- 表达式错误可诊断。
- 与 E2E AC-050 stubbed pinData 场景一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-007：Binary blob 存储边界（256 KiB / 32 MiB）

**追溯 AC**: AC-051

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-051 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | httpRequest |
| **所属轨** | Standard |

**前置条件**

- Lite `BinaryBlobService` + `execution_blobs` 已 wired（T-105）
- 了解 CONF-02 inline **256 KiB**、CONF-03 单 Item **32 MiB** 硬上限

**步骤**

1. 阅读 `packages/shared/src/binary/binary-utils.ts` 或 ADR-005 §2.5，确认 inline 阈值常量与文档一致。
2. 执行含 **小于 256 KiB** binary 的工作流，检查 DB/node_run：data 可 inline 或 ref，调试摘要正常。
3. （边界）尝试接近或超过 32 MiB 单附件（单测或文档记录），确认有 **明确拒绝/错误**，非静默截断。
4. 检查 Lite `blobs/<executionId>/` 目录（若外置），确认 blob 文件与 executionId 绑定，无路径遍历风险描述于 architecture §9。

**预期结果**

- 256 KiB / 32 MiB 边界与 B-6 决选一致。
- 大二进制外置路径在 Lite 可观测；超限有可读错误。
- blob 访问绑 executionId，符合安全约束。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-008：Standard 轨 Binary E2E 本地复现

**追溯 AC**: AC-052, AC-056

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-052, AC-056 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | httpRequest, webhookTrigger, if, set |
| **所属轨** | Standard |

**前置条件**

- Docker compose Standard profile 可启动
- `BINARY_FULL_CHAIN_E2E_GREEN === true`（T-111 Green）

**步骤**

1. 启动 Standard compose，确认 API/Web 可达。
2. 运行 `pnpm --filter @rxwf/web exec playwright test binary-full-chain --project=standard-chromium --retries=0 --workers=1`。
3. 确认 AC-048～AC-052 全 `@standard` 场景 pass（httpbin 503 时记录外部依赖，非代码回归）。
4. 运行 `node --experimental-strip-types apps/web/e2e/binary-full-chain.spec.test.ts`，确认结构/gate 测试 pass。
5. 验收后 compose down，确认无泄漏容器（AC-073 抽检）。

**预期结果**

- Binary 全场景 E2E 在 Standard 轨 green（或外部 httpbin 失败有明确记录）。
- gate 常量已翻转 true，与 T-111 交付一致。
- 环境可本地复现，非 CI-only 假绿。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-009：Merge combineAll binary 透传边界（P4 / CONF-04）

**追溯 AC**: AC-047

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-047 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | merge |
| **所属轨** | Standard |

**前置条件**

- Merge 节点 `mode: combineAll` 已实现 binary 保留（T-110 / GAP-01）
- 两路输入各含不同 binary key

**步骤**

1. 构造工作流：两分支 Set 各产出带 binary 的 item，汇入 Merge（combineAll）。
2. debug Merge 节点，确认输出 item **保留 upstream binary**（CONF-04 combineAll 须保留）。
3. 切换 Merge 为 `combineByKey`，确认 **保留首个非空 binary** 策略与帮助/risks 文档一致。
4. 对照 `merge-binary.test.ts` 单测结论，确认与 UI 行为无漂移。

**预期结果**

- combineAll 不再丢弃 binary（P4 gap 已关闭）。
- combineByKey 保留首个非空 binary，符合 B-6 决选。
- 边界行为有单测覆盖，人工可复现。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-010：e2e-coverage-matrix Binary 行覆盖对照

**追溯 AC**: AC-053

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-053 |
| **matrix 行** | E2E-P-014 |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- `docs/test/e2e-coverage-matrix.md` 含 E2E-P-014 行
- T-112 matrix Binary 行已更新（若并行未完成，本项可阻塞至 T-112 done）

**步骤**

1. 打开 matrix，定位 **E2E-P-014**（Binary 全链路）行。
2. 确认 status 为 **covered**，spec 列指向 `apps/web/e2e/binary-full-chain.spec.ts`。
3. 确认 scenario 列含 AC-048/049/050/052 标签。
4. 运行 `node scripts/validate-e2e-matrix.mjs`（若可用），确认 matrix 校验 green。

**预期结果**

- matrix Binary 相关行 100% covered，无「待补测」。
- spec 路径与仓库文件一致。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

### M5-MAN-011：M-5 验收清单 meta 自检与 GAP-012 状态

**追溯 AC**: AC-054, AC-070

| 字段 | 值 |
|------|-----|
| **追溯 AC** | AC-054, AC-070 |
| **matrix 行** | — |
| **nodeType** | — |
| **所属轨** | Lite-only |

**前置条件**

- 本文件 `M-5-acceptance.md` 已编写（T-113）
- M-5 实现与 E2E 验收完成后验收本项

**步骤**

1. 确认 frontmatter 含 `ac_coverage: AC-045～056, AC-070`。
2. 确认「AC 映射摘要」表覆盖 AC-045～056 每条至少 1 个人工用例。
3. 确认含 **方案确认、上传、下载、表达式、透传** 五类主题用例（PRD §9 M-5 最低要求）。
4. 逐条用例检查 PRD §9.1 字段：ID、前置条件、步骤、预期结果、所属轨、追溯 AC、执行结果栏。
5. 打开 `docs/workflow/spec-gap-audit.md`，确认 **GAP-012** 为 `gap=done`、`audit_status=done`。
6. 运行 `node docs/test/milestones/M-5-acceptance.test.mjs`，确认 3/3 pass。

**预期结果**

- 清单结构符合 PRD §9.1 与 OQ-009。
- AC-054（清单就绪）与 AC-070（人工门禁）可满足。
- GAP-012 Binary 差距已关闭。

**执行结果**：☐ 通过 ☐ 失败 ☐ 阻塞 | 备注：

---

## 验收签字

| 角色 | 姓名 | 日期 | 结论 |
|------|------|------|------|
| 验收人 | | | ☐ 通过 M-5 ☐ 退回 |
| 开发确认 | | | 11/11 用例已执行 |
