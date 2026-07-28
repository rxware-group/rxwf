# Standard / Lite 启动与依赖编排 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供 `rxwf start` / `rxwf deps` CLI，在 Standard 模式下混合补齐 Redis/PostgreSQL（Docker + 认证），Lite 默认 SQLite，并在启动前校验凭据。

**Architecture:** 新建 `packages/cli`，状态机驱动 `ParseArgs → ResolveConfig → ValidateCredentials → PlanDeps → EnsureDeps → HealthCheck → BootApp → Teardown`；`deps` 与 `EnsureDeps` 共用 `docker-manager`；API 仍通过 `RXWF_DEPLOY_PROFILE` 等 ENV 由 `apps/api/src/config.ts` 读取。

**Tech Stack:** Node 20+, TypeScript, `commander`, `vitest`, Docker Compose v2, 现有 Fastify API (`apps/api`).

**Spec:** [2026-05-28-standard-lite-deployment-design.md](../specs/2026-05-28-standard-lite-deployment-design.md)

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/cli/package.json` | CLI 包与 `awf` bin |
| Create | `packages/cli/tsconfig.json` | TS 编译 |
| Create | `packages/cli/src/index.ts` | Commander 入口 |
| Create | `packages/cli/src/types.ts` | `RuntimeBootstrapConfig`, `DepPlan` |
| Create | `packages/cli/src/config/parse-args.ts` | 解析 start/deps 参数 |
| Create | `packages/cli/src/config/resolve-config.ts` | CLI + ENV 合并 |
| Create | `packages/cli/src/config/validate-credentials.ts` | URL 凭据校验 |
| Create | `packages/cli/src/infra/docker-manager.ts` | compose up/down/status |
| Create | `packages/cli/src/infra/dependency-health.ts` | PG/Redis 探针 |
| Create | `packages/cli/src/infra/port-resolver.ts` | `--auto-port` |
| Create | `packages/cli/src/infra/secrets-store.ts` | `.rxwf/secrets.local.json` |
| Create | `packages/cli/src/bootstrap/state-machine.ts` | 状态编排 |
| Create | `packages/cli/src/commands/start.ts` | `rxwf start` |
| Create | `packages/cli/src/commands/deps.ts` | `rxwf deps` |
| Create | `deploy/docker-compose.standard.yml` | deps-only + 认证 |
| Modify | `.gitignore` | 忽略 `.rxwf/` |
| Modify | `package.json` (root) | `"awf": "pnpm --filter @rxwf/cli exec awf"` |
| Modify | `pnpm-workspace.yaml` | 确保 `packages/cli` 在 workspace |
| Modify | `deploy/compose.standard.yaml` | Redis requirepass（与 spec 对齐） |
| Modify | `docs/deployment-cli-cheatsheet.md` | 实现后校对命令是否一致 |

---

### Task 1: Scaffold `packages/cli`

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/vitest.config.ts`
- Modify: `pnpm-workspace.yaml`（若未包含 `packages/*` 则跳过）

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rxwf/cli",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": { "rxwf": "./dist/index.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "commander": "^13.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Wire root script**

在根 `package.json` 的 `scripts` 增加：

```json
"awf": "pnpm --filter @rxwf/cli exec awf"
```

- [ ] **Step 4: Install**

Run: `pnpm install`  
Expected: lockfile 更新，无 peer 错误

- [ ] **Step 5: Commit**

```bash
git add packages/cli package.json pnpm-lock.yaml
git commit -m "chore(cli): scaffold @rxwf/cli package"
```

---

### Task 2: Types and config resolution

**Files:**
- Create: `packages/cli/src/types.ts`
- Create: `packages/cli/src/config/resolve-config.ts`
- Create: `packages/cli/src/config/resolve-config.test.ts`

- [ ] **Step 1: Write failing test for resolve-config**

`packages/cli/src/config/resolve-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config.js';

describe('resolveConfig', () => {
  it('defaults to lite when mode omitted', () => {
    const cfg = resolveConfig({}, {});
    expect(cfg.mode).toBe('lite');
    expect(cfg.deployProfile).toBe('lite');
  });

  it('CLI postgres-url overrides env', () => {
    const cfg = resolveConfig(
      { mode: 'standard', postgresUrl: 'postgres://u:p@h:5432/db' },
      { RXWF_DATABASE_URL: 'postgres://other:x@h:5432/db' },
    );
    expect(cfg.postgresUrl).toBe('postgres://u:p@h:5432/db');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @rxwf/cli test`  
Expected: FAIL module not found

- [ ] **Step 3: Implement types + resolve-config**

`packages/cli/src/types.ts`:

```ts
export type RuntimeMode = 'lite' | 'standard';

export interface StartArgs {
  mode?: RuntimeMode;
  postgresUrl?: string;
  redisUrl?: string;
  noDockerAuto?: boolean;
  autoPort?: boolean;
  depsLifecycle?: 'keep' | 'down';
  startupTimeoutSec?: number;
  dockerComposeFile?: string;
}

export interface RuntimeBootstrapConfig {
  mode: RuntimeMode;
  deployProfile: RuntimeMode;
  postgresUrl?: string;
  redisUrl?: string;
  sqlitePath?: string;
  noDockerAuto: boolean;
  autoPort: boolean;
  depsLifecycle: 'keep' | 'down';
  startupTimeoutSec: number;
  dockerComposeFile: string;
}
```

`resolve-config.ts` 实现：mode 默认 lite；`postgresUrl` ← args ?? `RXWF_DATABASE_URL` ?? `RXWF_POSTGRES_URL`；`redisUrl` ← args ?? `RXWF_REDIS_URL`；`dockerComposeFile` 默认 `deploy/docker-compose.standard.yml`（相对 monorepo root，用 `findRepoRoot()` 自 `import.meta.url` 向上查找含 `pnpm-workspace.yaml` 的目录）。

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/types.ts packages/cli/src/config/
git commit -m "feat(cli): add runtime config resolution with CLI/env priority"
```

---

### Task 3: Credential validation

**Files:**
- Create: `packages/cli/src/config/validate-credentials.ts`
- Create: `packages/cli/src/config/validate-credentials.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateStandardCredentials } from './validate-credentials.js';

describe('validateStandardCredentials', () => {
  it('rejects postgres url without password', () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: 'postgres://user@localhost:5432/awf',
        redisUrl: 'redis://:secret@localhost:6379/0',
      }),
    ).toThrow(/AWF-START-007/);
  });

  it('rejects redis url without password', () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: 'postgres://u:p@localhost:5432/awf',
        redisUrl: 'redis://localhost:6379/0',
      }),
    ).toThrow(/AWF-START-007/);
  });

  it('passes when both have credentials', () => {
    expect(() =>
      validateStandardCredentials({
        postgresUrl: 'postgres://u:p@localhost:5432/awf',
        redisUrl: 'redis://:secret@localhost:6379/0',
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement** using `new URL()` parse; postgres: `username` + `password` non-empty; redis: password from URL password segment or userinfo.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

---

### Task 4: Dep planning (mixed补齐)

**Files:**
- Create: `packages/cli/src/bootstrap/plan-deps.ts`
- Create: `packages/cli/src/bootstrap/plan-deps.test.ts`

- [ ] **Step 1: Test plan-deps**

```ts
import { planDeps } from './plan-deps.js';

// standard + only postgres url => needRedis true, needPostgres false
// standard + both urls => needRedis false, needPostgres false
// lite => needRedis false, needPostgres false
```

- [ ] **Step 2–4: Implement, run, pass**

- [ ] **Step 5: Commit**

---

### Task 5: Docker compose file (authenticated deps)

**Files:**
- Create: `deploy/docker-compose.standard.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.rxwf/` to root `.gitignore`**

```
.rxwf/
```

- [ ] **Step 2: Create compose file**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${RXWF_POSTGRES_USER:-rxwf}
      POSTGRES_PASSWORD: ${RXWF_POSTGRES_PASSWORD:?RXWF_POSTGRES_PASSWORD required}
      POSTGRES_DB: ${RXWF_POSTGRES_DB:-rxwf}
    ports:
      - "${RXWF_POSTGRES_PORT:-127.0.0.1:5432:5432}"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${RXWF_POSTGRES_USER:-rxwf} -d ${RXWF_POSTGRES_DB:-rxwf}"]
      interval: 5s
      timeout: 3s
      retries: 10
    volumes:
      - rxwf-pg-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: >
      redis-server --requirepass ${RXWF_REDIS_PASSWORD:?RXWF_REDIS_PASSWORD required}
    ports:
      - "${RXWF_REDIS_PORT:-127.0.0.1:6379:6379}"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${RXWF_REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  rxwf-pg-data:
```

- [ ] **Step 3: Manual smoke**

Run（先 export 密码）:

```bash
export RXWF_POSTGRES_PASSWORD=dev-pg-pass RXWF_REDIS_PASSWORD=dev-redis-pass
docker compose -f deploy/docker-compose.standard.yml -p rxwf-standard up -d
docker compose -f deploy/docker-compose.standard.yml -p rxwf-standard ps
```

Expected: both healthy

- [ ] **Step 4: Commit**

---

### Task 6: secrets-store + docker-manager

**Files:**
- Create: `packages/cli/src/infra/secrets-store.ts`
- Create: `packages/cli/src/infra/docker-manager.ts`
- Create: `packages/cli/src/infra/docker-manager.test.ts`（mock `child_process.execFile`）

- [ ] **Step 1: secrets-store** — read/write `.rxwf/secrets.local.json` `{ postgresPassword, redisPassword }`；缺失时 `crypto.randomBytes(16).toString('hex')` 生成。

- [ ] **Step 2: docker-manager.ensureServices**

- 输入：`{ needRedis, needPostgres }`, `composeFile`, `projectName: 'rxwf-standard'`, env with passwords
- 执行：`docker compose -f <file> -p rxwf-standard up -d [redis|postgres]`
- 若 `autoPort`：生成 `.rxwf/compose.override.yml` 映射动态端口（`port-resolver.ts` 用 `net.createServer(0)` 探测空闲端口）

- [ ] **Step 3: docker-manager.status / down / logs** — 薄封装 compose 子命令

- [ ] **Step 4: Unit tests with mocked exec**

- [ ] **Step 5: Commit**

---

### Task 7: dependency-health

**Files:**
- Create: `packages/cli/src/infra/dependency-health.ts`
- Create: `packages/cli/src/infra/dependency-health.test.ts`

- [ ] **Step 1: Implement waitForHealthy**

- Postgres: 使用 `pg` 轻量连接或 `execFile('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', ...])` 轮询至 `startupTimeoutSec`
- Redis: `redis-cli -u <url> ping` 或 Node `ioredis` ping（若加依赖需记录在 package.json）

推荐 **不加 ioredis**：通过 `docker compose exec redis redis-cli -a ... ping` 减少依赖。

- [ ] **Step 2: Tests** — mock timer + mock exec 成功路径

- [ ] **Step 3: Commit**

---

### Task 8: State machine + start command

**Files:**
- Create: `packages/cli/src/bootstrap/state-machine.ts`
- Create: `packages/cli/src/commands/start.ts`
- Create: `packages/cli/src/config/parse-args.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: parse-args** — commander `start` 选项映射到 `StartArgs`

- [ ] **Step 2: state-machine.runStart**

流程按 spec §4；失败 `process.exit(1)` 并打印错误码。

- [ ] **Step 3: BootApp** — `spawn('node', ['--import', 'tsx/esm', 'apps/api/src/main.ts'], { cwd: repoRoot, env: { ...process.env, RXWF_DEPLOY_PROFILE, RXWF_DATABASE_URL, RXWF_REDIS_URL }, stdio: 'inherit' })`

- [ ] **Step 4: Teardown** — 子进程 exit 后若 `depsLifecycle==='down'` 且本次曾 `EnsureDeps`，调用 `dockerManager.down()`

- [ ] **Step 5: Manual test**

```bash
pnpm rxwf start --lite
pnpm rxwf start --standard   # 需 Docker
```

- [ ] **Step 6: Commit**

---

### Task 9: deps command

**Files:**
- Create: `packages/cli/src/commands/deps.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Subcommands** `up`, `down`, `status`, `logs`

- [ ] **Step 2: `deps up`** — 加载 secrets，调用 `ensureServices`；`--services redis,postgres` 过滤

- [ ] **Step 3: `deps status`** — 打印容器状态 + **脱敏** URL（`maskUrl()` 替换 password 为 `***`）

- [ ] **Step 4: Commit**

---

### Task 10: Align existing compose + docs

**Files:**
- Modify: `deploy/compose.standard.yaml`
- Modify: `docs/deployment-cli-cheatsheet.md`（若命令有变）

- [ ] **Step 1: Update redis in compose.standard.yaml**

```yaml
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${RXWF_REDIS_PASSWORD:-rxwf}
    environment:
      RXWF_REDIS_PASSWORD: ${RXWF_REDIS_PASSWORD:-rxwf}
```

并更新 `RXWF_REDIS_URL` 为 `redis://:awf@redis:6379/0`（compose 网络内）。

- [ ] **Step 2: Note in cheatsheet** — 全栈 compose 与 `rxwf deps` compose 文件区别

- [ ] **Step 3: Commit**

---

### Task 11: Integration smoke script (optional CI gate)

**Files:**
- Create: `scripts/smoke-awf-start.mjs`

- [ ] **Step 1: Script** — 仅当 `RUN_RXWF_DOCKER_SMOKE=1` 时执行 `rxwf start --standard` 健康检查 `curl /api/health`

- [ ] **Step 2: Document in spec/plan** — 默认 CI 不跑

- [ ] **Step 3: Commit**

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Lite default | Task 2, 8 |
| Standard mixed补齐 | Task 4, 6, 8 |
| `--auto-port` | Task 6 |
| `--deps-lifecycle` default keep | Task 2, 8 |
| Credential validation | Task 3, 8 |
| deps subcommands | Task 9 |
| Error codes 001–007 | Task 3, 8 (throw with codes) |
| `.awf` gitignore | Task 5 |
| No password in logs | Task 9 maskUrl |
| API unchanged boundary | Task 8 ENV injection only |

**Placeholder scan:** None.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-28-standard-lite-deployment.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — 每个 Task 派发子代理，任务间评审  
2. **Inline Execution** — 本会话按 Task 顺序直接实现，检查点复盘  

你更倾向哪种？若直接开始，从 **Task 1** 执行即可。
