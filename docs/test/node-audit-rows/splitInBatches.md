# splitInBatches — AUDIT-N-splitInBatches

> M-3 节点审查单行记录（logic / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `batchSize`（批次大小，number）；`NODE_TYPE_META` 标签 Split In Batches；单 main 出口（默认 port defs） |
| validation | ok | 无独立保存期 type 级错误码；`batchSize` 可留空（运行时默认 1）；非法/≤0 值在 executor 钳制为 1 |
| executor | ok | `splitInBatchesExecutor`（`control-flow/split-in-batches.ts`）经 `registerPlusExecutors` 注册；`split-in-batches.test.ts` 覆盖 E2003 与分批语义 |
| error_codes | E2003 | `E2003`：registry 未注册 `splitInBatches`（Plus 轨未启用 plusDeps 时） |
| e2e_spec | nodes/splitInBatches.spec.ts | `@any` 面板 + debug-node 分批执行 |
| status | ok | 审查通过；执行器模块已提取并单测覆盖 |

## 参数模型

- `batchSize`：每批 Items 数，默认 1；≤0 或非有限数钳制为 1。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: splitInBatches`。
- 将上游 `inputItems` 按 `batchSize` 切分为多路 `outputItems` 分支（每分支为一批 Items）。
- 空输入：返回单路空分支 `[[]]`。
- 与 **Loop** 区别：无 loop/done 双出口、无引擎内联迭代；legacy 分批流式（见 `docs/help/zh/nodes/loop.md`）。

## 测试证据

- `packages/node-runner/src/executors/control-flow/split-in-batches.test.ts` — registry、分批、默认值、空输入、batchSize 钳制
- Spec：`apps/web/e2e/nodes/splitInBatches.spec.ts`（E2E-N-splitInBatches）

## 备注

- 无独立 `node-params/splitInBatches.tsx`；通用 schema 渲染即可。
- 帮助文档 `docs/help/zh/nodes/splitInBatches.md` 由 T-125 负责（M-6）。
