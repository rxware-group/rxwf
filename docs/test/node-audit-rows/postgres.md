# postgres — AUDIT-N-postgres

> M-3 节点审查单行记录（action / standard）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `query`（SQL textarea）；`NodeEditorParamsPane` 通用渲染；`node-params/postgres.test.tsx` 覆盖 schema |
| validation | ok | `validatePostgresParameters`：显式空白 `query` 返回 `E2002`；省略 `query` 允许保存（运行时默认 `SELECT 1`） |
| executor | ok | `createPostgresExecutor`（`packages/node-runner/src/executors/postgres.ts`）经 `registerPlusExecutors` 注册；`postgres.test.ts` 覆盖连接/SQL/错误 |
| error_codes | E2002,E2003 | 空白 query → `E2002`；无连接 URL → `E2003`；SQL 异常 → `failed` + 数据库错误消息 |
| e2e_spec | nodes/postgres.spec.ts | `@any` 面板 + debug-node `SELECT 1`（Standard compose Postgres） |
| status | ok | 审查通过；stub 执行器已替换为真实 pg 查询 |

## 参数模型

- `query`：SQL 文本；省略或空键时运行时默认 `SELECT 1`；支持 `{{ }}` 表达式 per input item。
- 连接：`config.connectionString` → `PlusExecutorDeps.databaseUrl` → `RXWF_DATABASE_URL` 环境变量。

## 执行语义

- 每条 input item 执行一次 query（表达式可 per-item 不同）。
- 输出 item：`{ query, rows, rowCount }`；保留上游 binary。
- 使用 `pg.Pool` 单次连接池，执行完毕后 `pool.end()`。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2002 | `query` 仅空白字符 |
| E2003 | 无 PostgreSQL 连接 URL |
| — | SQL 语法/权限/连接失败：`status: failed`，`errorMessage` 为 pg 异常消息 |

## E2E

- Spec：`apps/web/e2e/nodes/postgres.spec.ts`（E2E-N-postgres）
- 轨：standard（Docker Postgres + Redis）
- 覆盖：面板 SQL 字段可见；`debug-node` 对 `SELECT 1 AS ok` 返回 `rows[0].ok === 1`；空白 query 返回 `E2002`
- debug-node 用例经 `connectionString` 连接 compose Postgres（Playwright webServer 未自动加载 `.e2e-env` 至 API 进程）

## 备注

- Standard 部署 profile 下 API 注入 `RXWF_DATABASE_URL`；Lite 无 postgres 节点运行时依赖。
- 帮助文档 `docs/help/zh/nodes/postgres.md` 由 M-6 T-134 负责。
