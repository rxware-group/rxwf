# wait — Node Audit (T-049)

| 字段 | 值 |
|------|-----|
| row_id | AUDIT-N-wait |
| node_type | wait |
| category | action |
| track | lite |
| task | T-049 |

## 审查结论

| 维度 | 状态 | 说明 |
|------|------|------|
| panel | ok | `node-param-schemas` 提供 `ms`（等待毫秒）字段；`node-port-defs` 默认 `ms: 1000` |
| validation | ok | 无节点专属保存校验；运行时拒绝非有限或负值 `ms` |
| executor | ok | `register-builtin` 注册 `waitExecutor`；读取 `config.ms` 与面板一致 |
| error_codes | E2003 | 非法 `ms`（非有限数或 &lt; 0）抛出 `E2003` |

## E2E

| 项 | 值 |
|----|-----|
| row_id | E2E-N-wait |
| spec | apps/web/e2e/nodes/wait.spec.ts |
| track | lite |

## 修复摘要

- **问题**：执行器原使用 `amount`/`unit`，与面板参数 `ms` 不一致，导致默认等待 1s 且用户配置无效。
- **修复**：执行器改为读取 `config.ms`（默认 1000），负值失败 `E2003`；补充 lite 轨 E2E（面板 + debug-node 执行）。

## 汇总

| status | notes |
|--------|-------|
| ok | 面板/执行器参数已对齐；lite E2E 覆盖执行与属性面板 |
