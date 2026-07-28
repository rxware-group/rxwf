# ADR-005：执行持久化与数据模型


| 字段         | 内容                                        |
| ---------- | ----------------------------------------- |
| **状态**     | 已采纳（Accepted）                             |
| **日期**     | 2026-05-20                                |
| **关联 PRD** | [spec.md](./spec.md) FR-3、FR-8、§11.6、FR-5 |
| **决策者**    | 架构                                        |


---

## 1. 执行定义快照（强制）

创建 `executions` 记录时**必须**固化：


| 字段                    | 说明                                                                |
| --------------------- | ----------------------------------------------------------------- |
| `workflow_id`         | 逻辑工作流 ID                                                          |
| `workflow_version_id` | 保存版本主键（递增版本号对应行）                                                  |
| `definition_snapshot` | 完整 JSON 定义（节点+连线+设置），**不可变**                                      |
| `trigger_type`        | `manual` | `webhook` | `schedule` | `api` | `mcp` | `subworkflow` |


**规则**：

- 运行中实例、历史审计、重跑、Webhook 幂等返回均基于**快照**，不读取工作流当前草稿。
- 用户保存新版本仅影响**新** execution（与 §5.5 一致）。

---

## 2. 核心表（逻辑模型）

### 2.1 `executions`


| 列                            | 类型        | 说明                                      |
| ---------------------------- | --------- | --------------------------------------- |
| `id`                         | UUID      | executionId                             |
| `trace_id`                   | string    | 分布式追踪                                   |
| `workflow_id`                | FK        |                                         |
| `workflow_version_id`        | FK        |                                         |
| `definition_snapshot`        | JSON/TEXT | 冗余存储，便于查询                               |
| `status`                     | enum      | queued/running/success/failed/cancelled |
| `mode`                       | enum      | production/manual/partial               |
| `environment`                | enum      | dev/staging/prod                        |
| `idempotency_key`            | string?   | 可空                                      |
| `started_at` / `finished_at` | datetime  |                                         |


### 2.2 `node_runs`


| 列                          | 类型      | 说明                                               |
| -------------------------- | ------- | ------------------------------------------------ |
| `id`                       | UUID    |                                                  |
| `execution_id`             | FK      |                                                  |
| `node_id`                  | string  | 快照内节点 ID                                         |
| `node_type`                | string  |                                                  |
| `status`                   | enum    | pending/running/success/failed/skipped/cancelled |
| `attempt`                  | int     | 重试次数                                             |
| `input_ref` / `output_ref` | string? | 大 payload 外置引用                                   |
| `error_code`               | string? | E2xxx                                            |
| `duration_ms`              | int     |                                                  |
| `runner_id`                | UUID?   | 实际执行该节点 run 的 Runner（快照时固化）                      |
| `runner_platform`          | JSON?   | `{ os, arch }` 冗余，便于审计与 UI 展示                    |


### 2.3 `runners`


| 列                   | 类型        | 说明                                |
| ------------------- | --------- | --------------------------------- |
| `id`                | UUID      | runnerId                          |
| `name`              | string    | 展示名                               |
| `kind`              | enum      | `embedded` | `agent`              |
| `platform_os`       | enum      | `windows` | `linux` | `macos`     |
| `platform_arch`     | enum      | `x64` | `arm64` | `arm`           |
| `platform_version`  | string?   | OS 版本描述                           |
| `labels`            | JSON      | string[]                          |
| `capabilities`      | JSON      | string[]                          |
| `status`            | enum      | `online` | `offline` | `draining` |
| `max_concurrent`    | int       |                                   |
| `running_jobs`      | int       |                                   |
| `agent_version`     | string?   |                                   |
| `last_heartbeat_at` | datetime? |                                   |
| `credential_hash`   | string    | Runner Secret 哈希                  |
| `registered_at`     | datetime  |                                   |


**Embedded Runner**：Lite/Standard 启动时由 `apps/api` 调用 `**RunnerRepositoryPort.ensureEmbedded()`**（见 [adr-node-runner.md](./adr-node-runner.md)、[adr-module-boundaries.md](./adr-module-boundaries.md)）；若不存在则插入一条 `kind=embedded`，`platform_*` 由 `process.platform` 探测，`capabilities` 至少含 `code`。

### 2.4 `runner_registration_tokens`


| 列            | 类型        | 说明          |
| ------------ | --------- | ----------- |
| `token_hash` | string    | 一次性注册 Token |
| `expires_at` | datetime  | 默认 24h      |
| `created_by` | userId    |             |
| `used_at`    | datetime? | 使用后作废       |


### 2.5 `execution_blobs`（大 Items）


| 列              | 类型     | 说明           |
| -------------- | ------ | ------------ |
| `id`           | UUID   |              |
| `execution_id` | FK     |              |
| `node_run_id`  | FK?    |              |
| `kind`         | enum   | input/output |
| `storage_path` | string | 文件或对象存储 key  |
| `size_bytes`   | int    |              |
| `sha256`       | string |              |


**策略**（FR-8）：

- 单 Item `json` 建议 < 1MB；超过写入 blob。
- 生产默认：失败全量保留；成功按工作流设置采样或仅 metadata。

### 2.6 `idempotency_keys`


| 列              | 类型          | 说明                                     |
| -------------- | ----------- | -------------------------------------- |
| `key`          | string(128) | 调用方 Idempotency-Key                    |
| `scope`        | string      | `webhook:production` / `webhook:manual`（测试 URL）/ `api` / `mcp` |
| `execution_id` | UUID        | 首次创建的实例                                |
| `expires_at`   | datetime    | 默认 24h                                 |


**唯一索引**：`(key, scope)`。

### 2.7 `jobs`（Lite 队列）


| 列             | 类型        | 说明                              |
| ------------- | --------- | ------------------------------- |
| `id`          | UUID      |                                 |
| `kind`        | enum      | execution                       |
| `payload`     | JSON      | execution_id 等                  |
| `status`      | enum      | pending/leased/completed/failed |
| `lease_owner` | string?   | 单实例 worker id                   |
| `lease_until` | datetime? |                                 |
| `created_at`  | datetime  |                                 |


**恢复**：进程启动时将超时 `leased` 回滚为 `pending`；**at-least-once**，依赖幂等表防副作用重复。

---

## 3. 子工作流

- 父 `node_run` 记录 `child_execution_id`。
- 子执行独立 `executions` 行，携带父 `trace_id` 扩展。
- 默认**同步等待**子执行完成（超时继承父工作流剩余时间）。

---

## 4. Standard 差异

- `jobs` 由 BullMQ 承担；`idempotency_keys` 与 `executions` 仍在 PG。
- 执行日志按月分区（v1.1）。

---

## 5. 变更记录


| 版本   | 日期         | 说明                                                        |
| ---- | ---------- | --------------------------------------------------------- |
| v1.0 | 2026-05-20 | 初稿                                                        |
| v1.1 | 2026-05-20 | Embedded Runner 经 RunnerRepositoryPort 启动；capabilities 说明 |


---

## 6. M-5 Binary 待决修订提案（B-6 前，非 Accepted）

> **来源**：T-102 `binary-risks.md` §5 · **状态**：待 B-6 人工确认（AC-055 / FR-16）。**B-6 未通过前不得按下列提案修改已采纳 ADR 正文或实施代码。**

### 提案 A — WorkflowItem.binary inline 阈值与上限（OPT-03 或偏离 draft spec 时）

| 项 | 当前 ADR | 提案（条件触发） |
|----|----------|------------------|
| inline 阈值 | §2.5 未规定 binary 字段级阈值 | 文档化 env `RXWF_BINARY_INLINE_MAX_BYTES`；默认 256 KiB；OPT-03 可选 512 KiB |
| 单 Item 上限 | 未规定 | 文档化 32 MiB 硬上限或 env 覆盖策略 |
| `BinaryAttachment.ref` | 未在 ADR 展开 | 明确 `ref.blobId` → `execution_blobs.id` 外置契约 |

**触发条件**：B-6 选定 OPT-03，或 CONF-02/CONF-03 偏离 draft spec 默认值。

### 提案 B — Standard 轨 blob 存储（GAP-02）

| 项 | 当前 ADR | 提案（条件触发） |
|----|----------|------------------|
| Standard blob | §4 仅提 PG 分区，无 binary blob | 复用 `execution_blobs` + 对象存储 path；或 M-5 书面限定「binary 外置仅 Lite」 |
| `execution_blobs` 扩展列 | 现有 7 列 | 可选新增 `mime_type`、`node_id`（若 B-6 确认调试/审计需求） |

**触发条件**：B-6 要求 FR-8 全 profile 大二进制外置，或 AC-055 验收含 Standard 轨。

### 提案 C — HTTP 默认行为（CONF-06）

不在 ADR-005 正文变更；若 `responseBinaryMode` 默认改为 `auto`，须在 **节点 schema 变更记录** 与 FR-16 中记录破坏性默认变更，避免 ADR 表结构变动。

**维护**：B-6 确认后由 T-103 将采纳的提案合并进 §2.5 / §4 并递增 ADR 版本号；未采纳提案自本 §6 删除或标 `withdrawn`。


