# Standard / Lite 启动与依赖编排 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | 草案（待评审） |
| **日期** | 2026-05-28 |
| **关联 ADR** | [adr-deployment.md](../../adr-deployment.md) |
| **部署手册** | [standard-lite-deployment-implementation-plan.md](../../standard-lite-deployment-implementation-plan.md) |
| **CLI 速查** | [deployment-cli-cheatsheet.md](../../deployment-cli-cheatsheet.md) |

---

## 1. 问题与目标

### 1.1 问题

- 当前通过 `RXWF_DEPLOY_PROFILE` + 环境变量切换 Lite/Standard，但 **无统一 CLI** 管理模式与依赖生命周期。
- `deploy/compose.standard.yaml` 存在，但 **应用启动不会自动** 拉起缺失的 Redis/PostgreSQL。
- Standard 下 Redis 当前 compose **无密码**；与「开发阶段也要按生产习惯」不一致。

### 1.2 目标

1. 提供 `awf`（或等价）CLI：`start`、`deps` 子命令。
2. **Lite（默认）**：SQLite，零 Docker 依赖。
3. **Standard**：Redis + PostgreSQL；支持 **混合补齐**（缺哪个 Docker 补哪个）、**外部 URL 复用**。
4. **认证必填**：自动部署与外部连接均要求带凭据的 URL（或 ENV）。
5. 端口与生命周期 **可配置**（开发阶段选最优架构，允许较大改动）。

### 1.3 非目标

- K8s/Helm 自动创建、SQLite→PG 数据迁移 CLI（仅预留）。
- 修改业务节点执行器内的存储实现（仍走现有 Provider 边界）。

---

## 2. 已确认产品决策

| 决策项 | 选择 |
|--------|------|
| Standard 依赖补齐 | **混合补齐**：仅缺 Redis 或 PG 时只 Docker 起缺失项 |
| 端口策略 | **可配置**：默认固定 `5432/6379`；`--auto-port` 冲突避让 |
| 应用退出后依赖 | **可配置**：`--deps-lifecycle=keep\|down`，默认 **`keep`** |
| 架构形态 | **状态机编排 + `deps` 子命令**（非单体启动器内聚） |
| Redis / PG 认证 | **必须**（URL 或 ENV 含凭据；Docker 部署启用密码） |

---

## 3. CLI 与配置契约

### 3.1 命令

```
rxwf start [--lite | --standard] [options]
rxwf deps up|down|status|logs [options]
```

根仓库可通过 `pnpm rxwf` 代理到 `packages/cli`（或 `scripts/awf.mjs`）。

### 3.2 `start` 参数

见 [deployment-cli-cheatsheet.md](../../deployment-cli-cheatsheet.md)。核心：

- `--lite` / `--standard` 互斥；未指定 → `lite`。
- `--redis-url`、`--postgres-url`：外部连接；提供则跳过对应 Docker 服务。
- `--no-docker-auto`：禁止 Docker 补齐。
- `--auto-port`：Docker 部署时端口避让。
- `--deps-lifecycle keep|down`：默认 `keep`。
- `--startup-timeout`：默认 `60`。
- `--with-web`：先执行 `pnpm run predev`，再同时启动 API（8787）与 Web（5173）；可与 `--lite`/`--standard` 组合。

### 3.3 配置优先级

```
CLI 参数 > 环境变量 > Profile 默认 > 硬编码默认
```

映射到进程环境（启动 API 前注入）：

| CLI | 环境变量 |
|-----|----------|
| `--lite` | `RXWF_DEPLOY_PROFILE=lite` |
| `--standard` | `RXWF_DEPLOY_PROFILE=standard` |
| `--postgres-url` | `RXWF_DATABASE_URL`（保留 `RXWF_POSTGRES_URL` 别名读取） |
| `--redis-url` | `RXWF_REDIS_URL` |

现有 `apps/api/src/config.ts` 的 `deployProfile`、`databaseUrl`、`redisUrl` **继续作为运行时单一来源**（由 CLI 预置 ENV）。

### 3.4 认证校验（`ValidateCredentials`）

**Standard 模式启动前**：

- `postgres` URL 必须解析出 `username` + `password`（非空）。
- `redis` URL 必须含密码（`redis://:pass@host` 或 ACL `redis://user:pass@host`）。
- 若校验失败：退出码非 0，错误码 `AWF-START-007`，不启动 API。

**Lite 模式**：跳过 Redis/PG 校验。

**Docker 自动部署**：

- 从 `RXWF_POSTGRES_PASSWORD` / `RXWF_REDIS_PASSWORD` 读取；缺失则生成随机密码写入 **仅本地** `.rxwf/secrets.local.json`（gitignore），并注入 compose。
- 日志与 `deps status` **脱敏**（`postgres://awf:***@127.0.0.1:5432/awf`）。

---

## 4. 启动状态机

### 4.1 状态

| 状态 | 职责 |
|------|------|
| `ParseArgs` | 解析 CLI，校验互斥 |
| `ResolveConfig` | CLI + ENV 合并为 `RuntimeBootstrapConfig` |
| `ValidateCredentials` | Standard 下校验 URL 凭据 |
| `PlanDeps` | 计算 `needRedis` / `needPostgres` |
| `EnsureDeps` | 调用 `deps up` 逻辑（或 no-op） |
| `HealthCheck` | TCP + `pg_isready` / `redis-cli -a ... ping` |
| `BootApp` | `bootDevStack`：可选 `predev`（`--with-web`）+ API；`--with-web` 时另起 Web `dev:wait` |
| `Teardown` | 按 `deps-lifecycle` 决定是否 `deps down` |

### 4.2 转移（Standard）

```mermaid
stateDiagram-v2
  [*] --> ParseArgs
  ParseArgs --> ResolveConfig
  ResolveConfig --> ValidateCredentials
  ValidateCredentials --> PlanDeps: standard
  ValidateCredentials --> BootApp: lite
  PlanDeps --> EnsureDeps: missing deps and docker allowed
  PlanDeps --> HealthCheck: all urls present
  PlanDeps --> Fail: missing and no-docker-auto
  EnsureDeps --> HealthCheck: success
  EnsureDeps --> Fail: docker unavailable
  HealthCheck --> BootApp: ok
  HealthCheck --> Fail: timeout
  BootApp --> Teardown: app exit
  Teardown --> [*]
```

### 4.3 错误码

| 代码 | 场景 |
|------|------|
| `AWF-START-001` | `--no-docker-auto` 且缺连接 |
| `AWF-START-002` | 无 Docker |
| `AWF-START-003` | Compose 不可用 |
| `AWF-START-004` | PostgreSQL 健康检查超时 |
| `AWF-START-005` | Redis 健康检查超时 |
| `AWF-START-006` | 端口/容器启动失败 |
| `AWF-START-007` | 凭据校验失败 |
| `AWF-START-008` | `--with-web` 时 predev 失败 |

---

## 5. 模块边界与文件布局

### 5.1 新包 `packages/cli`（推荐）

```
packages/cli/
  package.json          # bin: awf
  src/
    index.ts            # 入口：commander 路由
    commands/
      start.ts
      deps.ts
    bootstrap/
      state-machine.ts
      states/*.ts
    config/
      parse-args.ts
      resolve-config.ts
      validate-credentials.ts
    infra/
      docker-manager.ts
      dependency-health.ts
      port-resolver.ts
      secrets-store.ts
    types.ts
  test/
    *.test.ts
```

### 5.2 部署资产

| 文件 | 说明 |
|------|------|
| `deploy/docker-compose.standard.yml` | **CLI 专用** deps-only（redis + postgres + 认证） |
| `deploy/compose.standard.yaml` | **保留** 全栈 compose（api+deps），文档注明与 `rxwf deps` 分工 |

`docker-compose.standard.yml` 要求：

- PostgreSQL：`POSTGRES_USER/PASSWORD/DB` + `pg_isready` healthcheck。
- Redis：`command: redis-server --requirepass ${RXWF_REDIS_PASSWORD}` + healthcheck 带 `-a`。
- 端口：默认 `127.0.0.1:5432:5432`（仅本机）；`--auto-port` 时由 CLI 生成 override 文件到 `.rxwf/compose.override.yml`。

### 5.3 与现有 API 集成

- **不**在 Fastify 内嵌 Docker 逻辑。
- `rxwf start` 通过 [`boot-dev-stack.ts`](../../packages/cli/src/bootstrap/boot-dev-stack.ts) 编排进程：
  - 始终启动 API（`pnpm exec tsx apps/api/src/main.ts`）。
  - `--with-web` 时先 `pnpm run predev`，再 `pnpm --filter @rxwf/web run dev:wait`。
  - 生产仍用 `node apps/api/dist/main.js`（Docker 镜像），不经 `rxwf start`。
- CLI 收到 SIGINT/SIGTERM 或子进程退出后执行 `Teardown`（含可选 `deps down`）。

### 5.4 `deps` 与 `start` 共享

- `deps up/down/status/logs` 实现于 `docker-manager.ts`。
- `start` 的 `EnsureDeps` 调用同一 `ensureServices(plan)`，避免重复。

---

## 6. 数据流

1. 用户：`rxwf start --standard --postgres-url 'postgres://...'`
2. `ResolveConfig`：`needPostgres=false`, `needRedis=true`（若未给 redis url）
3. `EnsureDeps`：`docker compose up -d redis`（project `rxwf-standard`）
4. `HealthCheck`：轮询至 Redis 可 AUTH ping
5. `BootApp`：设置 `RXWF_DEPLOY_PROFILE=standard`, `RXWF_REDIS_URL=redis://:xxx@127.0.0.1:6379/0`
6. `createAppContext`（现有）：`deployProfile === 'standard'` → PG pool + BullMQ

---

## 7. 安全

- `.rxwf/` 目录加入根 `.gitignore`（secrets、override compose、端口映射缓存）。
- 禁止在 stdout 打印完整 URL 密码。
- Docker Redis 禁止无密码启动（开发 compose 同步修改 `deploy/compose.standard.yaml` 的 redis 服务，与 CLI compose 对齐——**breaking change for dev**，在 CHANGELOG 说明）。

---

## 8. 测试策略

| 层级 | 内容 |
|------|------|
| 单元 | `parse-args`、`resolve-config`、`validate-credentials`、`plan-deps`、状态转移表 |
| 集成 | mock `docker`/`compose` 可执行文件；验证命令行生成 |
| 可选 E2E | `TESTCONTAINERS` 或 CI service container；标记 `@docker` 跳过默认 `pnpm test` |

现有 `apps/api/src/integration/standard-profile.integration.test.ts` 保持；新增 CLI 包内 vitest。

---

## 9. 验收标准

1. `rxwf start` 默认 Lite，API 正常。
2. `rxwf start --standard`（有 Docker）自动起缺失服务且 **带密码**。
3. `rxwf start --standard --postgres-url ... --redis-url ...` 不调用 Docker。
4. 仅提供 `--postgres-url` 时只起 Redis 容器（混合补齐）。
5. `--no-docker-auto` 缺依赖时报 `AWF-START-001`。
6. `deps status` 输出脱敏连接信息。
7. 文档：implementation-plan + cheatsheet 与 spec 一致。

---

## 10. 迁移与兼容

| 现状 | 迁移 |
|------|------|
| `pnpm dev` / `pnpm start` | 保持；日常开发默认。等价全栈：`pnpm rxwf start --with-web` |
| `pnpm rxwf start --lite` | 仅 API；加 `--with-web` 起 Web |
| `RXWF_DEPLOY_PROFILE=standard` + 手动 compose | 仍支持；`rxwf start --standard` 为推荐路径 |
| 无密码 `redis://localhost:6379` | Standard 校验失败；文档提供 `RXWF_REDIS_PASSWORD` 或 URL 带密 |
| 生产 Docker 部署 | 仍用 `deploy/compose.*.yaml` + 镜像 `CMD node dist/main.js`，不用 `rxwf start` |

---

## 11. 开放问题（实现前可关闭）

1. **CLI 包名**：`@rxwf/cli` vs 根脚本 `scripts/awf.mjs` —— 计划采用 **`packages/cli`** 便于测试与发布。
2. **Windows**：`docker compose` 路径与信号处理 —— `Teardown` 使用 `docker compose down` 而非 POSIX-only 脚本。
