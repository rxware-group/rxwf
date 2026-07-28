# rx-workflow 启动模式（Lite / Standard）实施方案

> **正式设计规格**：[docs/superpowers/specs/2026-05-28-standard-lite-deployment-design.md](./superpowers/specs/2026-05-28-standard-lite-deployment-design.md)  
> **实现计划**：[docs/superpowers/plans/2026-05-28-standard-lite-deployment.md](./superpowers/plans/2026-05-28-standard-lite-deployment.md)  
> **CLI 速查**：[deployment-cli-cheatsheet.md](./deployment-cli-cheatsheet.md)

## 1. 目标与范围

### 1.1 背景

当前系统默认以本地依赖运行，用户在不同环境中启动成本不一致：

- 新用户希望“零依赖快速启动”（本地 SQLite 即可）。
- 进阶用户希望“一键获得标准依赖栈”（PostgreSQL + Redis）。
- 生产/团队环境通常已经有现成 Redis、PostgreSQL，希望直接复用。

为此，设计统一启动模式：

- `--lite`（默认）：使用 SQLite。
- `--standard`：使用 PostgreSQL + Redis，可自动通过 Docker 部署，或复用外部已部署服务。

### 1.2 实施目标

1. 在 `rx-workflow` 启动命令中引入模式化参数控制。
2. 支持 `--standard` 下的 Docker 自动部署与健康检查。
3. 支持 `--standard` 下用户显式指定外部服务连接，跳过 Docker。
4. 在无 Docker、端口冲突、依赖未就绪等场景提供可操作错误提示。
5. 保持向后兼容：默认行为尽可能等价于当前“轻量可启动”路径。

### 1.3 非目标（本阶段不做）

- 不覆盖 Kubernetes、Helm、云托管 DB 的自动创建。
- 不实现跨主机多节点编排。
- 不自动迁移历史 SQLite 数据到 PostgreSQL（仅预留入口）。

---

## 2. 用户体验与命令行规范

## 2.1 启动命令

建议统一入口（示例，可映射到现有 `pnpm dev`/`pnpm start`）：

```bash
rx-workflow start [--lite|--standard] [options]
```

### 2.2 参数定义（建议）

- `--lite`
  - 含义：轻量模式，使用 SQLite。
  - 默认值：当未指定模式时默认启用。

- `--standard`
  - 含义：标准模式，要求 Redis + PostgreSQL。
  - 行为：优先外部配置，缺失时尝试 Docker 自动拉起。

- `--redis-url <url>`
  - 含义：显式指定 Redis 连接（如 `redis://127.0.0.1:6379/0`）。
  - 作用：在 `--standard` 下若提供则跳过 Redis Docker 部署。

- `--postgres-url <url>`
  - 含义：显式指定 PostgreSQL 连接（如 `postgres://user:pass@127.0.0.1:5432/awf`）。
  - 作用：在 `--standard` 下若提供则跳过 PostgreSQL Docker 部署。

- `--no-docker-auto`（可选但推荐）
  - 含义：即使在 `--standard` 且未提供外部连接，也不自动启动 Docker。
  - 适用：CI、受控环境、防止误起容器。

- `--docker-compose-file <path>`（可选）
  - 含义：指定 compose 文件路径，默认使用内置 `deploy/docker-compose.standard.yml`。

- `--startup-timeout <seconds>`（可选）
  - 含义：标准模式依赖服务就绪超时时间，默认 `60` 秒。

### 2.3 配置优先级（必须固定）

建议优先级：`CLI 参数 > 环境变量 > 模式默认值`

具体：

1. 若 CLI 提供 `--redis-url/--postgres-url`，以 CLI 为准。
2. 否则读取 `REDIS_URL` / `DATABASE_URL`（或 `POSTGRES_URL`，统一后保留别名兼容）。
3. 若仍缺失：
   - `--lite`：落到 SQLite 默认文件。
   - `--standard`：触发 Docker 自动部署（除非 `--no-docker-auto`）。

---

## 3. 启动决策流程

### 3.1 Lite 模式流程

1. 解析模式为 `lite`（显式或默认）。
2. 生成 SQLite 连接（默认 `data/rxwf.db`，可由现有配置覆盖）。
3. 初始化应用（迁移、服务启动）。

### 3.2 Standard 模式流程

1. 解析模式为 `standard`。
2. 解析最终连接配置（按优先级）。
3. 分别判定 Redis / PostgreSQL 是否已具备外部连接：
   - 两者都具备：直接启动应用。
   - 任一缺失：进入“自动部署判定”。
4. 自动部署判定：
   - 若 `--no-docker-auto`：直接报错并给出解决建议。
   - 否则检测 Docker（`docker version`）与 Compose（`docker compose version`）。
5. Docker 可用时：
   - 使用 compose 拉起缺失服务（仅缺啥起啥）。
   - 进行健康检查（TCP + 应用级探针）。
   - 就绪后注入连接配置并启动应用。
6. Docker 不可用时：
   - 报错并提示三种路径：安装 Docker / 切换 `--lite` / 显式提供外部连接。

### 3.3 推荐伪代码

```ts
const mode = args.mode ?? "lite";
const cfg = resolveConfig(args, env); // 按 CLI > ENV > default

if (mode === "lite") {
  cfg.db = cfg.sqlitePath ?? "data/rxwf.db";
  cfg.cache = "in-memory-or-disabled";
  return bootApp(cfg);
}

// mode === "standard"
const needRedis = !cfg.redisUrl;
const needPg = !cfg.postgresUrl;

if (!needRedis && !needPg) {
  return bootApp(cfg);
}

if (args.noDockerAuto) {
  throw startupError(
    "STANDARD_DEP_MISSING",
    "标准模式缺少依赖连接。请提供 --redis-url/--postgres-url，或移除 --no-docker-auto 允许自动部署，或改用 --lite。"
  );
}

assertDockerAvailable(); // docker + docker compose
dockerEnsureServices({ redis: needRedis, postgres: needPg });
await waitForHealth({ redis: needRedis, postgres: needPg }, args.startupTimeout ?? 60);

cfg.redisUrl ??= defaultRedisUrlFromCompose();
cfg.postgresUrl ??= defaultPostgresUrlFromCompose();

return bootApp(cfg);
```

---

## 4. Docker 编排设计

### 4.1 文件位置

建议新增：

- `deploy/docker-compose.standard.yml`

### 4.2 服务建议

- `redis`
  - 镜像：`redis:7-alpine`
  - 端口：`6379`（可通过环境变量映射）
  - 健康检查：`redis-cli ping`
  - 卷：可选（若仅缓存可不持久化）

- `postgres`
  - 镜像：`postgres:16-alpine`
  - 端口：`5432`
  - 环境：`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`
  - 健康检查：`pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`
  - 卷：必须（持久化数据）

### 4.3 项目名与命名空间

为避免冲突，建议统一 compose project 名称：

- 默认：`rxwf-standard`
- 可通过 `RXWF_COMPOSE_PROJECT` 覆盖（高级用户）

### 4.4 启停策略

- 启动命令：`docker compose -f deploy/docker-compose.standard.yml up -d [services...]`
- 停止命令（可另设脚本）：`docker compose ... down`
- 数据清理（谨慎）：`docker compose ... down -v`（仅显式执行）

---

## 5. 配置模型与模块改造

### 5.1 新增配置结构（示例）

```ts
type RuntimeMode = "lite" | "standard";

interface StartupOptions {
  mode: RuntimeMode;
  redisUrl?: string;
  postgresUrl?: string;
  sqlitePath?: string;
  noDockerAuto?: boolean;
  dockerComposeFile?: string;
  startupTimeoutSec: number;
}
```

### 5.2 建议模块拆分

- `packages/.../config/cli-options.ts`
  - 参数解析与默认值
- `packages/.../config/resolve-runtime-config.ts`
  - CLI + ENV 融合与优先级处理
- `packages/.../infra/docker-manager.ts`
  - Docker 可用性检测、compose 启动
- `packages/.../infra/dependency-health.ts`
  - Redis/PostgreSQL 健康检查与重试
- `packages/.../startup/bootstrap.ts`
  - 按模式执行最终启动编排

### 5.3 与现有存储层适配

- Lite：
  - 数据库驱动指向 SQLite。
  - 缓存策略可为内存或禁用 Redis 相关逻辑。

- Standard：
  - 数据库驱动指向 PostgreSQL。
  - 缓存与队列等功能切换为 Redis。

注意：存储层入口应由“运行时配置”驱动，避免业务代码内散落模式判断。

---

## 6. 错误处理与用户提示文案

### 6.1 错误码建议

- `AWF-START-001`：标准模式缺少依赖配置且禁止自动 Docker
- `AWF-START-002`：未检测到 Docker
- `AWF-START-003`：Docker Compose 不可用
- `AWF-START-004`：PostgreSQL 健康检查超时
- `AWF-START-005`：Redis 健康检查超时
- `AWF-START-006`：端口冲突或容器启动失败

### 6.2 关键提示文案（示例）

- 无 Docker：
  - “检测到 `--standard`，但当前环境未安装 Docker。请安装 Docker 后重试，或改用 `--lite`，或通过 `--redis-url` 与 `--postgres-url` 指定外部服务。”

- 禁止自动部署但连接缺失：
  - “`--standard --no-docker-auto` 下必须提供 `--redis-url` 和 `--postgres-url`（或对应环境变量）。当前缺失：{...}。”

- 启动成功摘要：
  - “启动模式：standard；Redis 来源：docker/external；PostgreSQL 来源：docker/external；健康检查：通过。”

---

## 7. 安全与运维考虑

- 不在日志中明文打印完整连接串密码（输出脱敏版本）。
- `POSTGRES_PASSWORD` 支持从环境变量注入，避免硬编码到 compose 文件。
- 标准模式初期可限制只绑定 `127.0.0.1` 端口，降低暴露风险。
- 保留 `docker pull` 失败、镜像仓库不可达时的离线提示。

---

## 8. 测试方案

### 8.1 单元测试

1. 参数解析：
   - `--lite` / `--standard` 互斥与默认行为。
2. 配置优先级：
   - CLI 覆盖 ENV，ENV 覆盖默认值。
3. 决策分支：
   - Standard + 外部连接全量 -> 不触发 Docker。
   - Standard + 部分连接缺失 -> 仅拉起缺失服务。
   - Standard + 无 Docker -> 输出预期错误码。

### 8.2 集成测试

1. `--lite` 冷启动可成功读写 SQLite。
2. `--standard` 自动拉起容器后可连接并运行迁移。
3. `--standard` + 外部 Redis/Postgres（mock 或测试实例）可跳过 Docker。
4. 服务健康检查超时时，应用应中止并给出可操作提示。

### 8.3 E2E/回归测试

- 对核心工作流执行一次 Lite 与 Standard 双模式回归，确保业务一致性。

---

## 9. 分阶段实施计划

### 阶段 A：参数与配置（1~2 天）

- 引入模式参数与配置优先级解析。
- 保持旧启动方式兼容，默认落入 Lite。

### 阶段 B：Docker 管理器与健康检查（1~2 天）

- 实现 Docker 检测、compose 拉起、依赖探针、超时控制。

### 阶段 C：存储层接线与日志改造（1~2 天）

- 接入 PostgreSQL/Redis 与 SQLite 分流。
- 增加启动摘要与错误码。

### 阶段 D：测试与文档（1~2 天）

- 完成单元/集成测试与用户文档（README + FAQ）。

---

## 10. 验收标准（Definition of Done）

1. 未传参数启动时默认 Lite 成功。
2. `--standard` 在 Docker 可用场景下可自动拉起 Redis/PostgreSQL 并成功启动应用。
3. `--standard --redis-url --postgres-url` 可复用外部服务且不触发 Docker。
4. 无 Docker 场景提示明确，能指导用户完成下一步。
5. 启动日志可清晰展示模式与依赖来源，不泄露敏感信息。
6. 相关测试通过，文档更新完成。

---

## 11. 推荐后续增强（可选）

- 增加 `awf doctor` 命令，预检 Docker、端口、依赖连接。
- 增加 `rxwf deps up/down/status` 子命令管理本地依赖容器。
- 增加 SQLite -> PostgreSQL 数据迁移工具（一次性迁移向导）。
- 在 CI 引入 Lite/Standard 双矩阵，防止模式回归。

---

## 12. 命令与参数参考（部署手册）

本节用于部署时快速查阅，包含命令、参数说明、默认值与示例。

> **运维速查版**（表格 + 可复制示例）：[deployment-cli-cheatsheet.md](./deployment-cli-cheatsheet.md)

### 12.1 命令总览

- `rx-workflow start [--lite|--standard] [options]`
  - 启动应用主进程。
- `rx-workflow deps up [options]`
  - 启动本地依赖（Redis/PostgreSQL）。
- `rx-workflow deps down [options]`
  - 停止并移除依赖容器。
- `rx-workflow deps status`
  - 查看依赖容器状态与连接信息（脱敏）。
- `rx-workflow deps logs [--service redis|postgres]`
  - 查看依赖日志。

### 12.2 `start` 参数说明

- `--lite`
  - 轻量模式（默认），使用 SQLite。
  - 默认数据库文件：`data/rxwf.db`。

- `--standard`
  - 标准模式，要求 Redis + PostgreSQL。
  - 支持“混合补齐”：缺哪个依赖就自动补哪个（Docker）。

- `--redis-url <url>`
  - 指定外部 Redis 连接。
  - 若提供则不自动部署 Redis。
  - 建议必须带认证信息（密码或 ACL 用户+密码）。
  - 示例：`redis://:strong-pass@127.0.0.1:6379/0`

- `--postgres-url <url>`
  - 指定外部 PostgreSQL 连接。
  - 若提供则不自动部署 PostgreSQL。
  - 建议必须带用户名与密码。
  - 示例：`postgres://awf_user:strong-pass@127.0.0.1:5432/awf`

- `--no-docker-auto`
  - 禁止自动 Docker 补齐依赖。
  - 若标准模式且连接缺失，将直接报错退出。

- `--auto-port`
  - 自动部署依赖时启用端口避让。
  - 默认关闭（固定端口）：Redis=6379，PostgreSQL=5432。
  - 开启后若冲突将自动选择可用端口并在启动日志输出。

- `--deps-lifecycle <keep|down>`
  - 控制应用退出后自动部署依赖的生命周期。
  - 默认：`keep`。
  - `keep`：保留容器运行。
  - `down`：应用退出时自动执行 down。

- `--startup-timeout <seconds>`
  - 依赖健康检查超时，默认 `60` 秒。

- `--docker-compose-file <path>`
  - 覆盖默认 compose 文件路径（默认 `deploy/docker-compose.standard.yml`）。

- `--with-web`
  - 启动前先执行与 `pnpm dev` 相同的 `predev`（编译 workspace 依赖包）。
  - 同时启动 API（8787）与 Web（5173，`dev:wait` 等待 `/api/health` 后启动 Vite）。
  - 默认关闭；不加此参数时 `rxwf start` 仅启动 API。
  - 与 `pnpm dev` 的区别：`--with-web` 可走 `--lite`/`--standard` 及 Docker 依赖编排。

### 12.3 `deps` 参数说明

- `deps up`
  - 启动依赖容器。
  - 可选：`--services redis,postgres`（按需启动子集）。
  - 可选：`--auto-port`（冲突自动避让）。

- `deps down`
  - 停止并移除依赖容器。
  - 可选：`--volumes`（同时删除数据卷，慎用）。

- `deps status`
  - 输出容器状态、端口映射、健康状态、建议连接串（脱敏）。

- `deps logs`
  - 查看日志。
  - 可选：`--service redis|postgres` 指定服务。

### 12.4 认证与安全约束（强制建议）

- PostgreSQL 必须开启认证（用户名+密码）。
- Redis 建议启用密码；生产环境建议 ACL 用户+密码。
- 自动 Docker 补齐时：
  - 优先读取环境变量中的凭据；
  - 若缺失可生成强随机密码并仅在本地安全存储；
  - 启动日志禁止打印明文密码（仅输出脱敏信息）。

### 12.5 环境变量参考（建议）

- `DATABASE_URL`
  - PostgreSQL 连接串（与 `--postgres-url` 同义，CLI 优先）。
- `REDIS_URL`
  - Redis 连接串（与 `--redis-url` 同义，CLI 优先）。
- `RXWF_COMPOSE_PROJECT`
  - Compose project 名称，默认 `rxwf-standard`。
- `RXWF_POSTGRES_PASSWORD`
  - 自动部署 PostgreSQL 时的密码来源（推荐设置）。
- `RXWF_REDIS_PASSWORD`
  - 自动部署 Redis 时的密码来源（推荐设置）。

### 12.6 常用命令示例

#### 1) 默认启动（Lite）

```bash
rx-workflow start
```

#### 2) 显式 Lite

```bash
rx-workflow start --lite
```

#### 2b) Lite + Web（predev + API + Vite）

```bash
pnpm rxwf start --with-web
```

#### 3) Standard + 自动补齐（Docker）

```bash
rx-workflow start --standard
```

#### 4) Standard + 混合补齐（外部 PostgreSQL + Docker Redis）

```bash
rx-workflow start --standard \
  --postgres-url "postgres://awf_user:strong-pass@127.0.0.1:5432/awf"
```

#### 5) Standard + 全外部依赖（不使用 Docker）

```bash
rx-workflow start --standard \
  --postgres-url "postgres://awf_user:strong-pass@10.0.0.10:5432/awf" \
  --redis-url "redis://:strong-pass@10.0.0.11:6379/0"
```

#### 6) Standard + 禁止自动 Docker（依赖必须全外部）

```bash
rx-workflow start --standard --no-docker-auto \
  --postgres-url "postgres://awf_user:strong-pass@10.0.0.10:5432/awf" \
  --redis-url "redis://:strong-pass@10.0.0.11:6379/0"
```

#### 7) Standard + 端口自动避让 + 退出自动清理依赖

```bash
rx-workflow start --standard --auto-port --deps-lifecycle down
```

#### 7b) Standard + Web

```bash
pnpm rxwf start --standard --with-web
```

#### 8) 单独管理依赖容器

```bash
rx-workflow deps up
rx-workflow deps status
rx-workflow deps logs --service postgres
rx-workflow deps down
```

### 12.7 故障排查速查

- Docker 不可用：安装/启动 Docker Desktop 后重试，或改用 `--lite`。
- 端口冲突：使用 `--auto-port`，或手动释放 5432/6379。
- 认证失败：检查 URL 中用户密码、数据库名、ACL 配置。
- 健康检查超时：用 `deps logs` 查看容器启动日志并延长 `--startup-timeout`。

