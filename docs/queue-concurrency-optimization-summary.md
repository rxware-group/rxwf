# 执行链路与队列并发优化总结

## 1. 优化目标

- 提升执行链路整体吞吐（引擎调度、HTTP 节点、队列层）。
- 提升 Execution / Knowledge 队列吞吐。
- 在默认开启并发的前提下，保持可配置、可快速降级。
- 避免 Lite 本地 `job-loop` 重入导致并发失控。
- 增强可观测性，便于评估并发收益与稳定性。

---

## 2. 做了什么优化

### 2.1 BullMQ Worker 并发参数化（Standard）

- Execution 队列：`createBullMQQueueProvider` 支持 `concurrency`。
- Knowledge 队列：`createBullMQKnowledgeQueue` 支持 `concurrency`。
- `Worker` 启动时传入并发参数，默认建议：
  - execution: `4`
  - knowledge: `2`

额外增强（防御性）：

- provider 层对并发参数做归一化，避免外部传入非法值：
  - 非数字/非有限值 -> 回退默认值
  - 小于 `1` -> 归一为 `1`
  - 小数 -> 向下取整

---

### 2.2 执行引擎改为 DAG 并发调度

- 执行引擎由串行拓扑遍历改为 DAG 事件驱动并发调度。
- 使用 in-degree 追踪可运行节点，独立分支可并发执行，汇合节点在依赖满足后再运行。
- 保持失败语义：失败可快速终止，不等待无关后续链路。

---

### 2.3 HTTP 节点并发 + Keep-Alive

- HTTP 节点支持批量输入并发处理（受并发上限控制），同时保持输出顺序稳定。
- 支持 best-effort：单条请求失败写入对应 item 错误，不阻断同批其他请求。
- 引入连接复用（Keep-Alive），减少重复建连开销、提升高频请求效率。

---

### 2.4 API 配置透传并发参数

- 在 API 配置中统一接入并发环境变量：
  - `RXWF_BULLMQ_EXECUTION_CONCURRENCY`（默认 `4`）
  - `RXWF_BULLMQ_KNOWLEDGE_CONCURRENCY`（默认 `2`）
  - `RXWF_LITE_JOB_CONCURRENCY`（默认 `4`）
- 统一使用正整数读取逻辑，防止 NaN/负数/小数直接透传。
- 在 app context/runtime 创建阶段透传到 execution/knowledge 队列实现。

---

### 2.5 Lite Job Processor 受控并发

- `createJobProcessor` 新增 `concurrency` 参数。
- `processOnce` 从串行改为“受控并发 worker 池”模型。
- 保持失败语义不变：
  - 每个 job 独立 `markCompleted` / `markFailed`
  - 单 job 失败不阻断同批次其他 job

---

### 2.6 job-loop 单飞防重入

- `startJobLoop` 增加 `running` guard。
- 当上一轮未结束时，本轮 tick 直接跳过，避免 `setInterval` 重叠执行导致并发失控。

---

### 2.7 可观测性增强

- Lite job processor 增加批次回调 `onProcessed`，输出以下指标：
  - `claimed`（拉取任务数）
  - `completed`（成功数）
  - `failed`（失败数）
  - `elapsedMs`（批次耗时）
  - `concurrency`（并发配置）
- API 侧新增开关：
  - `RXWF_JOB_PROCESSOR_METRICS=true` 时输出批次指标日志
  - 同时输出 `job-loop` 重入跳过计数日志（overlap skipped）

---

## 3. 优化过程（实施顺序）

1. 执行引擎改造为 DAG 并发调度。
2. HTTP 节点并发 + Keep-Alive 改造。
3. BullMQ Execution/Knowledge worker 并发参数化。
4. API 配置接入并发环境变量并透传到 runtime。
5. Lite `job-processor` 改造为受控并发执行。
6. `job-loop` 增加单飞防重入。
7. 补齐回归测试（并发上限、失败语义、重入跳过、参数兜底）。
8. 增强可观测性（批次指标 + overlap skip 指标）。

---

## 4. 收益与行为变化

###+ 性能与吞吐收益

- Standard：BullMQ worker 可并发消费，Execution/Knowledge 吞吐提升明显。
- Lite：本地 job processor 从串行变并发，同批任务处理时延下降。
- 引擎：独立 DAG 分支可并行推进，端到端执行时长下降。
- HTTP：批量请求由串行改并发，并通过 Keep-Alive 降低连接开销。

### 稳定性收益

- `job-loop` 单飞防止重入堆叠，降低并发失控风险。
- provider 层并发参数兜底，避免错误配置直接影响 worker 行为。

### 行为变化（需认知）

- 开启并发后，**完成顺序不保证与入队顺序一致**（预期变化）。
- 失败语义保持兼容：单 job 失败仍是单点失败，不影响同批其他任务继续处理。

---

## 5. 环境变量配置清单

| 变量名 | 默认值 | 作用 |
|---|---:|---|
| `RXWF_BULLMQ_EXECUTION_CONCURRENCY` | `4` | Standard 下 Execution BullMQ worker 并发 |
| `RXWF_BULLMQ_KNOWLEDGE_CONCURRENCY` | `2` | Standard 下 Knowledge BullMQ worker 并发 |
| `RXWF_LITE_JOB_CONCURRENCY` | `4` | Lite 本地 job processor 并发 |
| `RXWF_HTTP_NODE_CONCURRENCY` | `10` | HTTP 节点批处理并发上限 |
| `HTTP_AGENT_CONNECTIONS` | 实现默认值 | HTTP Keep-Alive 连接池连接数 |
| `HTTP_AGENT_KEEPALIVE_TIMEOUT` | 实现默认值 | Keep-Alive 空闲超时 |
| `HTTP_AGENT_KEEPALIVE_MAX_TIMEOUT` | 实现默认值 | Keep-Alive 最大超时 |
| `RXWF_JOB_PROCESSOR_METRICS` | `false` | 设为 `true` 输出批次指标和 overlap skip 日志 |

建议：

- 首次上线建议从默认值开始，观察 24h 指标后再逐步升高并发。
- 若出现 DB/Redis 压力上升，可快速降级到 `1`（串行语义）。

---

## 6. 验证与回归覆盖

已覆盖的关键验证点：

- BullMQ worker 使用指定 `concurrency`。
- 非法并发参数（如 `0`、`NaN`）可安全归一/回退。
- 执行引擎可并发执行独立分支，并在汇合点正确收敛。
- HTTP 节点并发执行时保持输出顺序，并支持 per-item 错误语义。
- HTTP 节点请求使用 Keep-Alive dispatcher。
- Lite 批次最大并发不超过配置上限。
- `job-loop` 在慢任务场景不重入，并可报告 overlap skip。
- 批次指标汇总（claimed/completed/failed/elapsed/concurrency）正确输出。

---

## 7. 运维排障建议

- 观察日志：
  - `[jobs] lite batch ...`（批次处理质量）
  - `[jobs] lite loop overlap skipped=...`（轮询拥挤程度）
- 当 overlap skip 持续快速增长时，说明处理耗时高于 tick 间隔，建议：
  1. 提高 `RXWF_JOB_TICK_MS` 或降低并发
  2. 排查慢任务类型（网络/数据库/外部依赖）
  3. 结合 DB/Redis 监控判断是否资源瓶颈

---

## 8. 沙箱层（Piscina + Code 超时）

- 沙箱执行已切换为 **Piscina** 线程池（`packages/sandbox/src/run-in-sandbox.ts`）。
- Code 超时：全局环境变量 `SANDBOX_CODE_TIMEOUT_MS`（默认 `-1`）+ 节点参数 `timeoutMs`；优先级为 **节点 > 环境变量 > -1**。
- 规格与实施计划：[sandbox-piscina-timeout-design.md](./superpowers/specs/2026-05-28-sandbox-piscina-timeout-design.md)、[sandbox-piscina-timeout.md](./superpowers/plans/2026-05-28-sandbox-piscina-timeout.md)。

---

## 9. 相关代码区域（便于继续迭代）

- `apps/api/src/config.ts`
- `apps/api/src/app-context.ts`
- `apps/api/src/execution/create-execution-runtime.ts`
- `apps/api/src/execution/job-loop.ts`
- `apps/api/src/bootstrap.ts`
- `apps/api/src/knowledge/create-knowledge-runtime.ts`
- `packages/execution/src/engine/execution-engine.ts`
- `packages/execution/src/jobs/job-processor.ts`
- `packages/node-runner/src/executors/http.ts`
- `packages/node-runner/src/http-request.ts`
- `packages/providers/standard/src/queue/bullmq-queue-provider.ts`
- `packages/providers/standard/src/queue/bullmq-knowledge-queue.ts`
- `packages/sandbox/src/run-in-sandbox.ts`
- `packages/node-runner/src/executors/code.ts`
- `packages/node-runner/src/executors/resolve-code-sandbox-timeout.ts`

