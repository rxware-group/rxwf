# rx-workflow 部署 CLI 速查

> 完整设计与实现说明见：[standard-lite-deployment-implementation-plan.md](./standard-lite-deployment-implementation-plan.md)

---

> **实现状态**：`packages/cli` 提供 `rxwf start` / `rxwf deps`；根目录 `pnpm rxwf` 调用该 CLI。

## 模式一览

| 模式 | 命令 | 数据库 | 缓存/队列 | 依赖 |
|------|------|--------|-----------|------|
| Lite（默认） | `start` / `start --lite` | SQLite (`data/rxwf.db`) | 内存/禁用 Redis | 无 |
| Standard | `start --standard` | PostgreSQL | Redis | 外部 URL 或 Docker 自动补齐 |

**配置优先级**：`CLI 参数` > `环境变量` > `模式默认值`

---

## 命令速查

| 命令 | 作用 |
|------|------|
| `rx-workflow start [--lite\|--standard] [opts]` | 启动应用 |
| `rx-workflow deps up [opts]` | 仅启动 Redis/PostgreSQL 容器 |
| `rx-workflow deps down [--volumes]` | 停止并移除依赖容器 |
| `rx-workflow deps status` | 容器状态与脱敏连接信息 |
| `rx-workflow deps logs [--service redis\|postgres]` | 查看依赖日志 |

---

## `start` 参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `--lite` | ✓（未指定模式时） | SQLite，零外部依赖 |
| `--standard` | — | 需要 Redis + PostgreSQL |
| `--redis-url <url>` | — | 外部 Redis；提供则跳过 Docker Redis |
| `--postgres-url <url>` | — | 外部 PG；提供则跳过 Docker PG |
| `--no-docker-auto` | false | 禁止 Docker 补齐；缺连接则报错 |
| `--auto-port` | false | Docker 部署时端口冲突自动避让 |
| `--deps-lifecycle keep\|down` | `keep` | 应用退出后是否 `deps down` |
| `--startup-timeout <sec>` | `60` | 依赖健康检查超时 |
| `--docker-compose-file <path>` | `deploy/docker-compose.standard.yml` | 覆盖 compose 文件 |
| `--with-web` | false | 执行 `predev` 并同时启动 Web（Vite :5173） |
| `--with-crewai` | false | 确保 `crewai-runner` healthy 并注入 `CREWAI_RUNNER_URL` |
| `--crewai-url <url>` | — | 外部 Sidecar URL；提供则跳过 Docker 自动拉起 |

**规则摘要**

- `--lite` 与 `--standard` 互斥。
- Standard **混合补齐**：只缺 Redis 或只缺 PG 时，仅 Docker 拉起缺失项。
- 连接 URL **应带认证**（见下方 URL 格式）。
- **`pnpm dev` vs `pnpm rxwf start --with-web`**：`pnpm dev` 为日常默认；`--with-web` 同样 predev + API + Web，但可配合 `--lite`/`--standard` 与 Docker 依赖编排。无 `--with-web` 时仅启动 API。
- **`--with-crewai`**：与 Redis/PG 补齐并列；需 Docker（或 `--crewai-url` / `CREWAI_RUNNER_URL`）。失败退出码 **AWF-START-008**。
- **生产部署**仍用 Docker Compose（见 [`deploy/compose.lite.yaml`](../deploy/compose.lite.yaml)），不用 `rxwf start`。

---

## `deps` 参数

| 子命令 / 参数 | 说明 |
|---------------|------|
| `deps up` | 启动 redis + postgres |
| `deps up --services redis,postgres` | 按需启动子集 |
| `deps up --services crewai` | 仅启动 crewai-runner（merge crewai overlay） |
| `deps up --auto-port` | 端口冲突时自动避让 |
| `deps down` | 停止容器 |
| `deps down --volumes` | 停止并删数据卷（慎用） |
| `deps status` | 状态 + 脱敏连接串 |
| `deps logs --service redis\|postgres` | 单服务日志 |
| `deps logs --service crewai-runner --with-crewai` | CrewAI Sidecar 日志 |
| `deps status --with-crewai` | 状态含 crewai-runner |
| `deps down --with-crewai` | 停止时一并移除 Sidecar |

---

## 环境变量

| 变量 | 对应 CLI | 用途 |
|------|----------|------|
| `DATABASE_URL` | `--postgres-url` | PostgreSQL 连接（CLI 优先） |
| `REDIS_URL` | `--redis-url` | Redis 连接（CLI 优先） |
| `RXWF_COMPOSE_PROJECT` | — | Compose 项目名，默认 `rxwf-standard` |
| `RXWF_POSTGRES_PASSWORD` | — | Docker 部署 PG 密码（推荐显式设置） |
| `RXWF_REDIS_PASSWORD` | — | Docker 部署 Redis 密码（推荐显式设置） |
| `CREWAI_RUNNER_URL` | `--crewai-url` | CrewAI Sidecar 基址（CLI 注入优先） |
| `RXWF_CREWAI_PORT` | — | Sidecar Docker 绑定，默认 `127.0.0.1:8071:8071` |
| `RXWF_CREWAI_IMAGE` | — | 覆盖 Sidecar 镜像 tag |

---

## URL 格式（含认证）

```text
# PostgreSQL（必须含用户与密码）
postgres://<user>:<password>@<host>:<port>/<database>

# Redis（建议含密码；无用户名时密码前留空）
redis://:<password>@<host>:<port>/<db>
```

示例：

```bash
export DATABASE_URL="postgres://rxwf_user:YOUR_PG_PASS@127.0.0.1:5432/rxwf"
export REDIS_URL="redis://:YOUR_REDIS_PASS@127.0.0.1:6379/0"
```

---

## 常用示例（复制即用）

### Lite

```bash
rx-workflow start
rx-workflow start --lite
```

### Lite/Standard + Web（等价于 predev + API + Web）

```bash
pnpm rxwf start --with-web
pnpm rxwf start --standard --with-web
```

### Standard — Docker 全自动

```bash
rx-workflow start --standard
```

### Standard — 混合补齐（仅外部 PG）

```bash
rx-workflow start --standard \
  --postgres-url "postgres://rxwf_user:YOUR_PG_PASS@127.0.0.1:5432/awf"
```

### Standard — 全外部（不用 Docker）

```bash
rx-workflow start --standard \
  --postgres-url "postgres://rxwf_user:YOUR_PG_PASS@10.0.0.10:5432/awf" \
  --redis-url "redis://:YOUR_REDIS_PASS@10.0.0.11:6379/0"
```

### Standard — 禁止 Docker + 必须全外部

```bash
rx-workflow start --standard --no-docker-auto \
  --postgres-url "postgres://rxwf_user:YOUR_PG_PASS@10.0.0.10:5432/awf" \
  --redis-url "redis://:YOUR_REDIS_PASS@10.0.0.11:6379/0"
```

### Standard — 自动端口 + 退出时清理依赖

```bash
rx-workflow start --standard --auto-port --deps-lifecycle down
```

### 仅用环境变量启动 Standard

```bash
export DATABASE_URL="postgres://rxwf_user:YOUR_PG_PASS@127.0.0.1:5432/rxwf"
export REDIS_URL="redis://:YOUR_REDIS_PASS@127.0.0.1:6379/0"
rx-workflow start --standard
```

### Lite + CrewAI Sidecar

```bash
pnpm rxwf start --lite --with-crewai
pnpm rxwf start --lite --with-crewai --with-web
pnpm rxwf start --lite --crewai-url http://127.0.0.1:8071
```

### 单独管理 CrewAI Sidecar

```bash
pnpm rxwf deps up --services crewai
pnpm rxwf deps status --with-crewai
pnpm rxwf deps logs --service crewai-runner --with-crewai
pnpm rxwf deps down --with-crewai
```

### 单独管理依赖

```bash
rx-workflow deps up
rx-workflow deps status
rx-workflow deps logs --service postgres
rx-workflow deps down
```

---

## 故障排查

| 现象 | 处理 |
|------|------|
| 未检测到 Docker | 安装/启动 Docker；或 `start --lite`；或提供 `--redis-url` / `--postgres-url` |
| 端口 5432/6379 占用 | `start --standard --auto-port` 或释放端口 |
| 认证失败 | 核对 URL 用户/密码、库名、Redis ACL |
| 健康检查超时 | `deps logs` 查日志；加大 `--startup-timeout` |
| `AWF-START-001` | `--no-docker-auto` 下需同时提供 Redis 与 PG 连接 |
| `AWF-START-008` | `--with-crewai` 时 Sidecar 启动或 `/health` 失败；查 Docker、端口 8071、镜像 |

---

## 默认端口（Docker 固定模式）

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| crewai-runner | 8071（默认绑定 `127.0.0.1`） |

开启 `--auto-port` 后，实际端口以启动日志 / `deps status` 为准。
