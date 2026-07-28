# RX-Workflow 全量重命名 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | 已评审（待实现） |
| **日期** | 2026-05-30 |
| **实施方案** | 方案三：Codemod + 验证门禁 + 本地 master 原子合并 |
| **关联升级说明** | `docs/UPGRADE-rx-workflow.md`（实现阶段创建） |

---

## 1. 问题与目标

### 1.1 问题

当前代码库、文档、部署配置统一使用 **any-workflow / AWF / awf** 命名体系。产品需 rebranding 为 **RX-Workflow**，并要求环境变量、CLI、npm scope、容器镜像等全栈命名一致。

### 1.2 目标

1. 将产品名改为 **RX-Workflow**，缩写 **RXWF**，命令前缀 **rxwf_**，环境变量前缀 **RXWF_**。
2. npm workspace scope 改为 **`@rxwf/*`**；Git 仓库本地名 **`rx-workflow`**（远程尚未创建）。
3. **硬切换**：不保留 `AWF_*`、`awf`、`@any-workflow/*` 等旧别名。
4. **全部文档**更新（含 `docs/superpowers/` 历史 spec/plan）。
5. 通过自动化脚本 + CI 门禁完成替换，在本地 **`master`** 分支一次性合并。

### 1.3 非目标

- 本次不创建 GitHub 远程仓库、不改 remote URL、不 push 镜像（预留 `ghcr.io/rxwf/*` 命名，待远程就绪后执行）。
- 不为旧名称提供运行时兼容层（无 dual-read env、无 `awf` CLI 软链接）。
- 不修改业务逻辑与功能行为（纯 rename）。
- 不迁移已有生产数据库（仅文档说明 breaking change）。

---

## 2. 已确认产品决策

| 决策项 | 选择 |
|--------|------|
| 兼容策略 | **硬切换**，无 deprecated alias |
| Git 仓库名（本地） | **`rx-workflow`**（根 `package.json` name 同步） |
| GitHub 远程 | **尚未创建**；本次仅合并本地 `master` |
| npm scope | **`@rxwf/*`** |
| 文档范围 | **全部更新**（含历史 superpowers 文档） |
| 容器镜像 registry | **`ghcr.io/rxwf/*`**（compose/文档先改命名，push 延后） |
| 实施路径 | **方案三**：Codemod 脚本 + lint 门禁 + 原子合并 |

---

## 3. 命名映射表（Naming Matrix）

全项目唯一真相表；所有替换必须按此执行，且遵循 §4 顺序规则。

| 类别 | 旧 | 新 |
|------|----|----|
| 产品名 | any-workflow / 自动化工作流系统 | **RX-Workflow** |
| 缩写 | AWF / awf | **RXWF / rxwf** |
| Git 仓库 / 根 package name | `any-workflow` | **`rx-workflow`** |
| npm scope | `@any-workflow/*` | **`@rxwf/*`** |
| CLI 主命令 | `awf` | **`rxwf`** |
| CLI Runner | `awf-runner` | **`rxwf-runner`** |
| Runner 配置文件 | `awf-runner.json` | **`rxwf-runner.json`** |
| 环境变量前缀 | `AWF_*` | **`RXWF_*`** |
| Shell 节点注入 env | `AWF_JSON` | **`RXWF_JSON`** |
| CLI 本地状态目录 | `.awf/` | **`.rxwf/`** |
| Lite SQLite 文件名 | `awf.db` | **`rxwf.db`** |
| CSS 设计 token | `--awf-*` | **`--rxwf-*`** |
| CSS class 前缀 | `awf-*` | **`rxwf-*`** |
| HTTP Header 前缀 | `x-awf-*` | **`x-rxwf-*`** |
| localStorage key 前缀 | `awf.*` | **`rxwf.*`** |
| BullMQ 队列名 | `awf-knowledge-jobs` 等 | **`rxwf-knowledge-jobs`** |
| Docker 镜像 | `ghcr.io/any-workflow/*` | **`ghcr.io/rxwf/*`** |
| Postgres 默认连接 | `awf:awf@.../awf` | **`rxwf:rxwf@.../rxwf`** |
| 迁移脚本 | `scripts/awf-migrate.mjs` | **`scripts/rxwf-migrate.mjs`** |
| pnpm script | `awf:migrate` | **`rxwf:migrate`** |
| 拖拽 MIME 常量 | `AWF_EXPR_DRAG_MIME` | **`RXWF_EXPR_DRAG_MIME`** |
| E2E 临时目录 | `awf-e2e` | **`rxwf-e2e`** |

---

## 4. 替换顺序规则

防止链式误替换；脚本必须按序执行：

```
1.  @any-workflow/           → @rxwf/
2.  ghcr.io/any-workflow/    → ghcr.io/rxwf/
3.  awf-runner.json          → rxwf-runner.json
4.  awf-runner               → rxwf-runner
5.  AWF_JSON                 → RXWF_JSON
6.  AWF_                      → RXWF_
7.  --awf-                    → --rxwf-
8.  x-awf-                    → x-rxwf-
9.  .awf/ / join(..., ".awf") → .rxwf/
10. awf.db                    → rxwf.db
11. awf-knowledge-jobs        → rxwf-knowledge-jobs
12. awf-form-field 等已知 class → rxwf-form-field（或通过 awf- → rxwf- 规则）
13. 'awf. / "awf.             → 'rxwf. / "rxwf.
14. any-workflow              → rx-workflow
15. bin 字段 "awf"            → "rxwf"
16. 剩余受控 \bawf\b          → rxwf（人工 grep 复核）
```

**禁止**对 `packages/`、`apps/` 外未列路径做全局 `\bawf\b` 盲替。

---

## 5. 影响范围

### 5.1 Monorepo 包（32 个 `package.json`）

- 每个 `name`、`dependencies`、`devDependencies`、根脚本 `--filter` 引用改为 `@rxwf/*`。
- 关键 bin：
  - `packages/cli/package.json` → `"rxwf": "./dist/index.js"`
  - `packages/runner-agent/package.json` → `"rxwf-runner": "./dist/cli/main.js"`
- 替换后执行 `pnpm install` 刷新 `pnpm-lock.yaml`。

### 5.2 环境变量（35+，主入口 `apps/api/src/config.ts`）

全部 `process.env.AWF_*` → `process.env.RXWF_*`。同步文件：

- `packages/cli/src/config/resolve-config.ts`、`apply-runtime-env.ts`
- `packages/cli/src/infra/*.ts`
- `packages/node-runner/src/http-request.ts`
- `packages/sandbox/src/run-in-sandbox.ts`
- `deploy/docker-compose.*.yml`、`deploy/compose.*.yaml`
- `.github/workflows/ci.yml`、`nightly-runner-agent.yml`
- 全部集成测试中的 `process.env.AWF_*` 赋值

默认品牌名：`RXWF_BRAND_NAME` 未设时 UI 显示 **RX-Workflow**。

### 5.3 API / 协议契约

| 位置 | 变更 |
|------|------|
| `apps/api/src/routes/webhook.ts` | `x-rxwf-signature`、`x-rxwf-timestamp` |
| `apps/api/src/routes/internal-crew-credential.ts` | `x-rxwf-execution-id` |
| `apps/api/src/routes/internal-crew-tool.ts` | 同上 |
| `docs/openapi.yaml` | header 名 + 描述 |

### 5.4 前端 UI

| 位置 | 规模 |
|------|------|
| `packages/theme-catalog/src/catalog.ts` | 12 个 CSS token |
| `apps/web/src/styles.css` | ~105 处 |
| `apps/web/src/scrollbars.css` | 12 处 |
| 组件 class（Modal、FormField 等） | ~30 处 |
| localStorage（locale、settings、embed） | ~10 处 |

### 5.5 数据层

| 项 | 代码位置 | Breaking 说明 |
|----|----------|---------------|
| SQLite | `apps/api/src/app-context.ts` | 已有 `data/awf.db` 需手动 `mv` → `rxwf.db` |
| CLI secrets | `packages/cli/src/infra/secrets-store.ts` | `.awf/` → `.rxwf/` |
| Postgres 默认 | `config.ts`、compose | 新部署默认 `rxwf` 用户/库 |

### 5.6 部署 / CI

- `deploy/` 全部 compose 与 README
- `.github/workflows/` CI 环境变量
- `packages/runner-agent/Dockerfile`、`deploy/docker/Dockerfile`

### 5.7 文档（全量，80+ 文件）

- `docs/spec.md`、`docs/README.md`、全部 ADR、RELEASE、runner 文档
- `docs/superpowers/specs/**`、`docs/superpowers/plans/**`
- `docs/openapi.yaml`、`docs/deployment-cli-cheatsheet.md`

产品定位段落（`spec.md` §1）补充正式产品名 **RX-Workflow**。

### 5.8 Python（crewai-runner）

- `packages/crewai-runner/` 注释、测试、adapter 中 `AWF_*` / `awf` 字符串
- sidecar 环境变量 `AWF_TOOL_BRIDGE_HOST` → `RXWF_TOOL_BRIDGE_HOST`

### 5.9 i18n

- `packages/i18n-catalog/src/app-strings.ts`：用户可见文案中的 `AWF_*` → `RXWF_*`
- `catalog-ui-ext.ts`、`string-key-map.ts/json`：同步更新
- auto key 名含 `AWF` 的条目改为 `RXWF`（硬切换一致）
- 若 DB 存在用户 i18n override，升级文档注明可能需重新配置

---

## 6. 实施方案（方案三）

### 6.1 交付物

| 文件 | 用途 |
|------|------|
| `scripts/rename-to-rxwf.mjs` | 有序批量替换 + 文件重命名 |
| `scripts/lint-no-legacy-names.mjs` | 残留旧名检测（CI 门禁） |
| `docs/UPGRADE-rx-workflow.md` | Breaking changes 与迁移步骤 |

### 6.2 执行阶段

```
Phase 0 — 准备（本地 master 上 feature 分支）
├── git checkout -b rename/rx-workflow
├── 编写 rename-to-rxwf.mjs
├── 编写 lint-no-legacy-names.mjs
└── 编写 UPGRADE-rx-workflow.md

Phase 1 — 代码替换
├── 运行 rename 脚本（干跑 diff 复核）
├── 重命名物理文件：
│     scripts/awf-migrate.mjs → rxwf-migrate.mjs
│     packages/runner-agent/awf-runner.json.example → rxwf-runner.json.example
├── pnpm install
└── 人工 grep 复核误匹配

Phase 2 — 验证
├── pnpm build
├── pnpm test
├── pnpm lint:deps && pnpm lint:ac-mapping
└── pnpm lint:legacy-names（零残留）

Phase 3 — 合并
├── git checkout master
├── git merge rename/rx-workflow（或 squash merge）
└── 本地 master 即为最终态（无 remote push）

Phase 4 — 延后（远程就绪后）
├── 创建 GitHub 仓库 rx-workflow
├── git remote add origin …
├── push master
└── 构建并 push ghcr.io/rxwf/* 镜像
```

### 6.3 根 package.json 变更摘要

```json
{
  "name": "rx-workflow",
  "scripts": {
    "predev": "... --filter @rxwf/env build ...",
    "dev": "pnpm --parallel --filter @rxwf/api --filter @rxwf/web run dev",
    "rxwf:migrate": "pnpm --filter @rxwf/providers-standard build && node scripts/rxwf-migrate.mjs",
    "rxwf": "rxwf",
    "lint:legacy-names": "node scripts/lint-no-legacy-names.mjs"
  }
}
```

---

## 7. CI 残留门禁

`lint-no-legacy-names.mjs` 扫描 `packages/`、`apps/`、`deploy/`、`docs/`、`.github/`、`scripts/`，禁止：

```
@any-workflow/
\bany-workflow\b
ghcr.io/any-workflow/
AWF_
AWF_JSON
\bawf-runner\b
\bawf\.db\b
--awf-
x-awf-
["']\.awf["'/]
\bawf-knowledge-jobs\b
```

例外白名单（如有测试专门断言「旧名不存在」）需在脚本内显式排除。

`.github/workflows/ci.yml` 增加 step：`pnpm lint:legacy-names`。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `\bawf\b` 误匹配 | 有序长串优先 + 路径白名单 + 人工 grep |
| lockfile 不一致 | 替换后立即 `pnpm install` |
| Lite 用户 `awf.db` | UPGRADE 文档说明重命名 |
| Webhook 外部集成 | UPGRADE 列出 header 变更 |
| localStorage 语言/主题重置 | UPGRADE 说明；硬切换可接受 |
| 工作区目录仍为 `any-workflow` | 可选本地文件夹重命名，不影响 Git |

---

## 9. 验收标准

1. `pnpm lint:legacy-names` 零匹配。
2. `pnpm build` 全绿。
3. `pnpm test` 全绿（含 integration，Standard 需 PG/Redis 的测试按现有 CI 条件）。
4. CLI：`pnpm rxwf --help`、`rxwf-runner --help` 可用。
5. Lite 本地启动后 SQLite 路径为 `data/rxwf.db`。
6. `docs/spec.md` 与 `docs/README.md` 产品名均为 RX-Workflow。
7. 全部变更已合并本地 **`master`** 分支。

---

## 10. 预估工作量

| 阶段 | 工时 |
|------|------|
| 脚本 + 门禁 + UPGRADE | 0.5–1 天 |
| 运行替换 + 人工复核 | 0.5 天 |
| build/test 修复 | 0.5–1 天 |
| 文档抽查 | 0.5 天 |
| **合计** | **2–3 天** |

---

## 11. 后续

实现阶段 invoke **writing-plans** 技能，产出 `docs/superpowers/plans/2026-05-30-rx-workflow-rename.md` 任务分解。
