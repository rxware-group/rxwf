# Node Audit: loop

| 字段 | 值 |
| --- | --- |
| row_id | AUDIT-N-loop |
| node_type | loop |
| category | logic |
| track | lite |
| panel | ok |
| validation | ok |
| executor | ok |
| error_codes | E2002, W1020 |
| status | ok |
| e2e | apps/web/e2e/nodes/loop.spec.ts |

## 审查结论

### 面板 (panel)

- `node-param-schemas.ts` 定义 `batchSize`（每批 Items 数，number，默认 1）
- `node-port-defs.ts` 双出口：`done`（`1`）在上、`loop`（`0`）在下
- E2E 验证节点编辑器展示 batchSize 字段

### 校验 (validation)

- `validateWorkflowDefinition`：未连接 loop 出口（`0`）→ **E2002**；未连接 done 出口（`1`）→ **W1020**
- `validate-connections` 允许循环体回连 Loop main 输入
- `graph-cycle` 豁免 Loop 合法回连边

### 执行器 (executor)

- `loopExecutor` 注册于 `register-builtin.ts`；迭代由 `execution-engine` + `loop-execution` 内联处理，registry stub 返回双空输出
- 单元测试：`packages/node-runner/src/executors/control-flow/loop.test.ts`

### 错误码 (error_codes)

| 码 | 场景 | 文档 |
| --- | --- | --- |
| E2002 | 保存时未连接 loop 出口 | `docs/error-codes.md`、`docs/help/zh/nodes/loop.md` |
| W1020 | 未连接 done 出口（警告） | 同上 |

执行域 E2002（排队/沙箱）与校验域 E2002 码相同、语义以节点上下文区分（见 error-codes 脚注）。

## 测试证据

- `packages/node-runner/src/executors/control-flow/loop.test.ts` — registry、stub、校验
- `apps/web/e2e/nodes/loop.spec.ts` — 面板 batchSize、批次迭代与 done 汇总

## 备注

- 无独立 `node-params/loop.tsx`；通用 schema 渲染即可
- 引擎层 loop 行为见 `packages/execution`（`loop-region.ts`、`loop-execution.ts`），不在本 task 所有权内
