# RX-Workflow 全量重命名 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将代码库、文档、部署配置从 any-workflow/AWF/awf 硬切换为 RX-Workflow/RXWF/rxwf，合并到本地 `master`，并通过 lint 门禁防止旧名回归。

**Architecture:** 方案三 — 编写有序 Codemod 脚本 `scripts/rename-to-rxwf.mjs` 批量替换文本并重命名关键文件；`scripts/lint-no-legacy-names.mjs` 作为 CI/本地验收门禁；替换后 `pnpm install` 刷新 lockfile，再跑 build/test 修复残留。

**Tech Stack:** Node 20+, pnpm 9, turbo, TypeScript monorepo, vitest, Docker Compose, Python crewai-runner（字符串级更新）。

**Spec:** [2026-05-30-rx-workflow-rename-design.md](../specs/2026-05-30-rx-workflow-rename-design.md)

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `scripts/rename-to-rxwf.mjs` | 有序文本替换 + 可选 dry-run |
| Create | `scripts/lint-no-legacy-names.mjs` | 旧名残留扫描（CI 门禁） |
| Create | `docs/UPGRADE-rx-workflow.md` | Breaking changes 升级说明 |
| Rename | `scripts/awf-migrate.mjs` → `scripts/rxwf-migrate.mjs` | Lite→PG 迁移脚本 |
| Rename | `packages/runner-agent/awf-runner.json.example` → `rxwf-runner.json.example` | Runner 配置样例 |
| Modify | 根 `package.json` | name、scripts、filter、lint:legacy-names |
| Modify | 32× `packages/**/package.json`、`apps/**/package.json` | scope `@rxwf/*` |
| Modify | `pnpm-lock.yaml` | `pnpm install` 自动刷新 |
| Modify | `apps/api/src/config.ts` | 全部 `RXWF_*` env |
| Modify | `apps/web/src/styles.css`、`scrollbars.css` | CSS token/class |
| Modify | `packages/theme-catalog/src/catalog.ts` | 主题 token |
| Modify | `deploy/*`、`/.github/workflows/*` | compose + CI env |
| Modify | `docs/**`（80+ 文件） | 文档全量更新 |
| Modify | `.gitignore` | `.awf/` → `.rxwf/` |
| Modify | `packages/i18n-catalog/src/*` | 用户可见 AWF 文案 |

**扫描目录（脚本与 lint 共用）：** `packages/`、`apps/`、`deploy/`、`docs/`、`.github/`、`scripts/`、根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`.gitignore`

**排除目录：** `node_modules/`、`dist/`、`.git/`、`data/`、`coverage/`

---

### Task 1: 创建 feature 分支

**Files:** （无文件变更）

- [ ] **Step 1: 确认在 master 且工作区干净**

Run:
```bash
git checkout master
git status
```
Expected: `On branch master`，无未提交的业务代码变更（设计 spec 已提交即可）

- [ ] **Step 2: 创建分支**

Run:
```bash
git checkout -b rename/rx-workflow
```
Expected: `Switched to a new branch 'rename/rx-workflow'`

---

### Task 2: 编写 rename Codemod 脚本

**Files:**
- Create: `scripts/rename-to-rxwf.mjs`

- [ ] **Step 1: 创建脚本**

```javascript
#!/usr/bin/env node
/**
 * Ordered rebrand: any-workflow/AWF/awf → rx-workflow/RXWF/rxwf
 * Usage:
 *   node scripts/rename-to-rxwf.mjs --dry-run
 *   node scripts/rename-to-rxwf.mjs
 */
import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const dryRun = process.argv.includes('--dry-run');

const SCAN_ROOTS = [
  'packages',
  'apps',
  'deploy',
  'docs',
  '.github',
  'scripts',
];
const ROOT_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.gitignore',
];

const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  'data',
  'coverage',
]);

/** Order matters — longest / most specific first */
const REPLACEMENTS = [
  ['@any-workflow/', '@rxwf/'],
  ['ghcr.io/any-workflow/', 'ghcr.io/rxwf/'],
  ['awf-runner.json', 'rxwf-runner.json'],
  ['awf-runner', 'rxwf-runner'],
  ['AWF_EXPR_DRAG_MIME', 'RXWF_EXPR_DRAG_MIME'],
  ['AWF_JSON', 'RXWF_JSON'],
  ['AWF_', 'RXWF_'],
  ['--awf-', '--rxwf-'],
  ['x-awf-', 'x-rxwf-'],
  ['.awf/', '.rxwf/'],
  ['".awf"', '".rxwf"'],
  ["'.awf'", "'.rxwf'"],
  ['join(repoRoot, ".awf")', 'join(repoRoot, ".rxwf")'],
  ['awf.db', 'rxwf.db'],
  ['awf-knowledge-jobs', 'rxwf-knowledge-jobs'],
  ['awf-pg-data', 'rxwf-pg-data'],
  ['awf-e2e', 'rxwf-e2e'],
  ['awf-form-field', 'rxwf-form-field'],
  ['awf-modal', 'rxwf-modal'],
  ['awf-tooltip', 'rxwf-tooltip'],
  ['awf-loading', 'rxwf-loading'],
  ['awf-scroll', 'rxwf-scroll'],
  ['awf-embed:', 'rxwf-embed:'],
  ["'awf.", "'rxwf."],
  ['"awf.', '"rxwf.'],
  ['postgres://awf:awf@localhost:5432/awf', 'postgres://rxwf:rxwf@localhost:5432/rxwf'],
  ['postgres://awf:awf@', 'postgres://rxwf:rxwf@'],
  ['POSTGRES_USER: awf', 'POSTGRES_USER: rxwf'],
  ['POSTGRES_PASSWORD: awf', 'POSTGRES_PASSWORD: rxwf'],
  ['POSTGRES_DB: awf', 'POSTGRES_DB: rxwf'],
  ['pg_isready -U awf', 'pg_isready -U rxwf'],
  [':-awf}', ':-rxwf}'],
  ['any-workflow', 'rx-workflow'],
  ['"awf": "./dist/index.js"', '"rxwf": "./dist/index.js"'],
  ['"awf": "awf"', '"rxwf": "rxwf"'],
  ['program.name("awf")', 'program.name("rxwf")'],
  ['any-workflow CLI', 'RX-Workflow CLI'],
  ['自动化工作流系统', 'RX-Workflow'],
];

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml',
  '.md', '.css', '.html', '.py', '.txt', '.example', '.schema.json',
]);

async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

function shouldProcessFile(filePath) {
  if (filePath.endsWith('rename-to-rxwf.mjs')) return false;
  if (filePath.endsWith('lint-no-legacy-names.mjs')) return false;
  if (filePath.endsWith('2026-05-30-rx-workflow-rename-design.md')) return false;
  if (filePath.endsWith('2026-05-30-rx-workflow-rename.md')) return false;
  const dot = filePath.lastIndexOf('.');
  const ext = dot >= 0 ? filePath.slice(dot) : '';
  return TEXT_EXT.has(ext) || filePath.endsWith('Dockerfile') || !ext;
}

async function processFile(absPath) {
  if (!shouldProcessFile(absPath)) return 0;
  const before = await readFile(absPath, 'utf8');
  const after = applyReplacements(before);
  if (after === before) return 0;
  if (!dryRun) await writeFile(absPath, after, 'utf8');
  console.log(`${dryRun ? '[dry-run] ' : ''}updated ${relative(repoRoot, absPath)}`);
  return 1;
}

const FILE_RENAMES = [
  ['scripts/awf-migrate.mjs', 'scripts/rxwf-migrate.mjs'],
  [
    'packages/runner-agent/awf-runner.json.example',
    'packages/runner-agent/rxwf-runner.json.example',
  ],
];

async function main() {
  let changed = 0;
  for (const root of SCAN_ROOTS) {
    const abs = join(repoRoot, root);
    try {
      await stat(abs);
    } catch {
      continue;
    }
    for await (const file of walkFiles(abs)) {
      changed += await processFile(file);
    }
  }
  for (const rel of ROOT_FILES) {
    const abs = join(repoRoot, rel);
    try {
      await stat(abs);
      changed += await processFile(abs);
    } catch {
      /* skip missing */
    }
  }
  for (const [from, to] of FILE_RENAMES) {
    const fromAbs = join(repoRoot, from);
    const toAbs = join(repoRoot, to);
    try {
      await stat(fromAbs);
    } catch {
      console.warn(`skip rename (missing): ${from}`);
      continue;
    }
    console.log(`${dryRun ? '[dry-run] ' : ''}rename ${from} → ${to}`);
    if (!dryRun) await rename(fromAbs, toAbs);
    changed += 1;
  }
  console.log(`\nDone. ${changed} file(s) touched.${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run 预览**

Run:
```bash
node scripts/rename-to-rxwf.mjs --dry-run
```
Expected: 输出大量 `updated ...` 与 2 条 `rename ...`，无报错

- [ ] **Step 3: Commit**

```bash
git add scripts/rename-to-rxwf.mjs
git commit -m "chore(scripts): add rename-to-rxwf codemod"
```

---

### Task 3: 编写 lint 残留门禁

**Files:**
- Create: `scripts/lint-no-legacy-names.mjs`

- [ ] **Step 1: 创建 lint 脚本**

```javascript
#!/usr/bin/env node
/**
 * Fail if legacy any-workflow / AWF / awf names remain in scanned paths.
 * Usage: node scripts/lint-no-legacy-names.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');

const SCAN_ROOTS = [
  'packages',
  'apps',
  'deploy',
  'docs',
  '.github',
  'scripts',
];
const ROOT_FILES = ['package.json', 'pnpm-workspace.yaml', 'turbo.json', '.gitignore'];

const SKIP_DIR = new Set(['node_modules', 'dist', '.git', 'data', 'coverage']);

const FORBIDDEN = [
  /@any-workflow\//,
  /\bany-workflow\b/,
  /ghcr\.io\/any-workflow\//,
  /AWF_/,
  /AWF_JSON/,
  /\bawf-runner\b/,
  /\bawf\.db\b/,
  /--awf-/,
  /x-awf-/,
  /\.awf[/'"\\]/,
  /\bawf-knowledge-jobs\b/,
];

const ALLOWLIST = [
  /lint-no-legacy-names\.mjs$/,
  /rename-to-rxwf\.mjs$/,
  /2026-05-30-rx-workflow-rename-design\.md$/,
  /2026-05-30-rx-workflow-rename\.md$/,
  /UPGRADE-rx-workflow\.md$/,
];

async function* walkFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

function isAllowed(relPath) {
  return ALLOWLIST.some((re) => re.test(relPath));
}

async function scanFile(absPath) {
  const rel = relative(repoRoot, absPath).replace(/\\/g, '/');
  if (isAllowed(rel)) return [];
  let content;
  try {
    content = await readFile(absPath, 'utf8');
  } catch {
    return [];
  }
  if (content.includes('\0')) return [];
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of FORBIDDEN) {
      if (re.test(lines[i])) {
        hits.push({ file: rel, line: i + 1, text: lines[i].trim(), rule: re.source });
        break;
      }
    }
  }
  return hits;
}

async function main() {
  const allHits = [];
  for (const root of SCAN_ROOTS) {
    const abs = join(repoRoot, root);
    try {
      await stat(abs);
    } catch {
      continue;
    }
    for await (const file of walkFiles(abs)) {
      allHits.push(...(await scanFile(file)));
    }
  }
  for (const rel of ROOT_FILES) {
    const abs = join(repoRoot, rel);
    try {
      await stat(abs);
      allHits.push(...(await scanFile(abs)));
    } catch {
      /* skip */
    }
  }
  if (allHits.length === 0) {
    console.log('lint-no-legacy-names: OK (no forbidden patterns)');
    return;
  }
  console.error(`lint-no-legacy-names: ${allHits.length} violation(s):\n`);
  for (const h of allHits.slice(0, 50)) {
    console.error(`  ${h.file}:${h.line}  [${h.rule}]`);
    console.error(`    ${h.text}\n`);
  }
  if (allHits.length > 50) {
    console.error(`  ... and ${allHits.length - 50} more`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 验证当前应失败**

Run:
```bash
node scripts/lint-no-legacy-names.mjs
```
Expected: exit code 1，列出 AWF/any-workflow 残留

- [ ] **Step 3: Commit**

```bash
git add scripts/lint-no-legacy-names.mjs
git commit -m "chore(scripts): add lint-no-legacy-names gate"
```

---

### Task 4: 编写 UPGRADE 文档

**Files:**
- Create: `docs/UPGRADE-rx-workflow.md`

- [ ] **Step 1: 创建升级说明**

```markdown
# 升级到 RX-Workflow（自 any-workflow 重命名）

## Breaking changes

| 旧 | 新 |
|----|-----|
| 环境变量 `AWF_*` | `RXWF_*` |
| CLI `awf` / `awf-runner` | `rxwf` / `rxwf-runner` |
| npm scope `@any-workflow/*` | `@rxwf/*` |
| Lite SQLite `data/awf.db` | `data/rxwf.db` |
| CLI 状态目录 `.awf/` | `.rxwf/` |
| Webhook headers `x-awf-*` | `x-rxwf-*` |
| Shell 节点 env `AWF_JSON` | `RXWF_JSON` |
| Docker 镜像 `ghcr.io/any-workflow/*` | `ghcr.io/rxwf/*` |
| Postgres 默认 `awf/awf/awf` | `rxwf/rxwf/rxwf` |

## Lite 本地数据迁移

```bash
# 停止 API 后
mv data/awf.db data/rxwf.db
# 若有 CLI secrets
mv .awf .rxwf
```

## 环境变量迁移示例

```bash
# 旧
export AWF_HTTP_PORT=8787
export AWF_DATA_DIR=./data

# 新
export RXWF_HTTP_PORT=8787
export RXWF_DATA_DIR=./data
```

## Webhook 集成

更新发送方 HTTP headers：

- `x-awf-signature` → `x-rxwf-signature`
- `x-awf-timestamp` → `x-rxwf-timestamp`

## Runner

- 配置文件：`awf-runner.json` → `rxwf-runner.json`
- 命令：`rxwf-runner register` / `rxwf-runner start`

## 前端

localStorage key 前缀由 `awf.*` 改为 `rxwf.*`；用户语言/布局偏好可能需重新设置。

## 无兼容层

本次为硬切换，系统**不会**读取旧环境变量或旧 CLI 名称。
```

- [ ] **Step 2: Commit**

```bash
git add docs/UPGRADE-rx-workflow.md
git commit -m "docs: add UPGRADE-rx-workflow breaking changes guide"
```

---

### Task 5: 执行 Codemod（正式替换）

**Files:** 300+ 文件（脚本自动处理）

- [ ] **Step 1: 执行替换**

Run:
```bash
node scripts/rename-to-rxwf.mjs
```
Expected: 完成且无异常；`scripts/awf-migrate.mjs` 已变为 `scripts/rxwf-migrate.mjs`

- [ ] **Step 2: 刷新 lockfile**

Run:
```bash
pnpm install
```
Expected: `pnpm-lock.yaml` 中 package 名均为 `@rxwf/*`

- [ ] **Step 3: Commit**

```bash
git add -A
git reset HEAD "New Text Document.txt" "New Text Document (2).txt" 2>/dev/null || true
git commit -m "refactor: rebrand any-workflow to RX-Workflow (RXWF)"
```

---

### Task 6: 根 package.json 与 CI 门禁接线

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 确认根 package.json scripts**

替换后应包含（若脚本遗漏则手动补全）：

```json
{
  "name": "rx-workflow",
  "scripts": {
    "lint:legacy-names": "node scripts/lint-no-legacy-names.mjs",
    "rxwf:migrate": "pnpm --filter @rxwf/providers-standard build && node scripts/rxwf-migrate.mjs",
    "rxwf": "rxwf",
    "predev": "node scripts/kill-dev-ports.mjs && pnpm --filter @rxwf/env build && ..."
  }
}
```

确认 `predev`、`dev`、`dev:wait` 中所有 `--filter @rxwf/` 正确。

- [ ] **Step 2: CI 增加 lint step**

在 `.github/workflows/ci.yml` 的 `test` job 中，`pnpm lint:ac-mapping` **之后**增加：

```yaml
      - run: pnpm lint:legacy-names
```

`standard-integration` job 内所有 env 与 filter 应已被 codemod 改为 `RXWF_*` / `@rxwf/`；确认：

```yaml
        env:
          POSTGRES_USER: rxwf
          POSTGRES_PASSWORD: rxwf
          POSTGRES_DB: rxwf
        options: >-
          --health-cmd "pg_isready -U rxwf"
```

- [ ] **Step 3: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "chore: wire lint:legacy-names into CI and root scripts"
```

---

### Task 7: 人工 grep 复核与补丁

**Files:** 视 grep 结果而定（常见遗漏点见下）

- [ ] **Step 1: 运行 lint 门禁**

Run:
```bash
pnpm lint:legacy-names
```
Expected: `OK (no forbidden patterns)`；若失败，按输出逐文件修复

- [ ] **Step 2: 额外 grep 捕获孤立 awf**

Run:
```bash
rg -n "\bawf\b" packages apps deploy docs .github scripts --glob "!**/node_modules/**" --glob "!**/dist/**"
```
Expected: 无匹配，或仅剩误报（若有，手动改为 `rxwf`）

- [ ] **Step 3: 常见遗漏手动检查**

| 文件 | 检查项 |
|------|--------|
| `packages/cli/src/index.ts` | `program.name("rxwf")`、`RX-Workflow CLI` |
| `apps/api/src/app-context.ts` | `join(config.dataDir, 'rxwf.db')` |
| `apps/api/src/routes/webhook.ts` | `x-rxwf-signature` |
| `packages/runner-agent/src/cli/main.ts` | 帮助文本、`rxwf-runner.json` 路径 |
| `scripts/rxwf-migrate.mjs` | 注释与 `@rxwf/providers-standard` import |
| `.gitignore` | `.rxwf/` |
| `docs/spec.md` 标题 | 含 **RX-Workflow** |

- [ ] **Step 4: Commit 补丁（若有）**

```bash
git add -A
git commit -m "fix: address rename grep residuals"
```

---

### Task 8: 构建验证

**Files:** （无新文件）

- [ ] **Step 1: 全量 build**

Run:
```bash
pnpm build
```
Expected: 所有 package 编译成功，无 `@any-workflow` 模块找不到错误

- [ ] **Step 2: 修复 build 错误（若有）**

典型问题：某文件 import 路径未替换、bin 名引用旧 CLI。修复后重复 Step 1。

- [ ] **Step 3: Commit（若有修复）**

```bash
git add -A
git commit -m "fix: resolve build errors after RXWF rename"
```

---

### Task 9: 测试验证

**Files:** （无新文件）

- [ ] **Step 1: 全量 test**

Run:
```bash
pnpm test
```
Expected: 全绿（Standard 集成测试在无 PG/Redis 本地可能 skip — 与改前行为一致）

- [ ] **Step 2: 针对性跑 webhook / runner 测试**

Run:
```bash
pnpm --filter @rxwf/api test -- src/routes/webhook.test.ts
pnpm --filter @rxwf/runner-agent test
pnpm --filter @rxwf/cli test
```
Expected: PASS

- [ ] **Step 3: lint 辅助**

Run:
```bash
pnpm lint:deps
pnpm lint:ac-mapping
pnpm lint:legacy-names
```
Expected: 全部通过

- [ ] **Step 4: Commit（若有修复）**

```bash
git add -A
git commit -m "fix: resolve test failures after RXWF rename"
```

---

### Task 10: 产品文档标题更新

**Files:**
- Modify: `docs/spec.md`（§1 标题与定位）
- Modify: `docs/README.md`（索引描述）

- [ ] **Step 1: 更新 spec.md 开头**

将 `# 自动化工作流系统 - 产品需求文档` 改为：

```markdown
# RX-Workflow — 产品需求文档
```

在 §1.1 一句话定位前增加：

```markdown
**产品名称**：RX-Workflow（缩写 RXWF）
```

- [ ] **Step 2: 更新 docs/README.md 首行**

```markdown
# RX-Workflow — 文档索引
```

- [ ] **Step 3: Commit**

```bash
git add docs/spec.md docs/README.md
git commit -m "docs: set RX-Workflow as product name in spec index"
```

---

### Task 11: CLI 冒烟

**Files:** （无新文件）

- [ ] **Step 1: 构建 CLI**

Run:
```bash
pnpm --filter @rxwf/cli build
pnpm --filter @rxwf/runner-agent build
```

- [ ] **Step 2: 验证 CLI 帮助**

Run:
```bash
pnpm exec rxwf --help
pnpm exec rxwf-runner --help
```
Expected: 显示 `rxwf` / `rxwf-runner` 帮助，无 `awf` 字样

- [ ] **Step 3: 验证 migrate 脚本引用**

Run:
```bash
node scripts/rxwf-migrate.mjs --dry-run
```
Expected: 报错「请先构建 standard 包」或 dry-run 正常 — 但**不应**引用 `awf-migrate` 或 `@any-workflow`

---

### Task 12: 合并到 master

**Files:** （无新文件）

- [ ] **Step 1: 最终 lint**

Run:
```bash
pnpm lint:legacy-names && pnpm build && pnpm test
```
Expected: 全部通过

- [ ] **Step 2: 合并**

Run:
```bash
git checkout master
git merge rename/rx-workflow --no-ff -m "Merge branch 'rename/rx-workflow'"
```
Expected: `master` 包含全部 rename 提交

- [ ] **Step 3: 验证 master**

Run:
```bash
git branch --show-current
pnpm lint:legacy-names
```
Expected: `master`，lint OK

---

## Spec coverage checklist

| Spec § | Task |
|--------|------|
| §3 Naming Matrix | Task 5 (codemod) + Task 7 (grep) |
| §4 替换顺序 | Task 2 (REPLACEMENTS 数组顺序) |
| §5.1 Monorepo 包 | Task 5 + Task 6 |
| §5.2 环境变量 | Task 5 (config.ts 等) |
| §5.3 API 契约 | Task 5 + Task 9 webhook tests |
| §5.4 前端 UI | Task 5 (CSS/theme) |
| §5.5 数据层 | Task 5 + UPGRADE doc |
| §5.6 部署/CI | Task 5 + Task 6 |
| §5.7 文档 | Task 5 + Task 10 |
| §5.8 Python | Task 5 (crewai-runner) |
| §5.9 i18n | Task 5 + Task 7 |
| §6 方案三交付物 | Task 2–4 |
| §7 CI 门禁 | Task 3 + Task 6 |
| §9 验收标准 | Task 8–11 |
| §6.2 Phase 3 master 合并 | Task 12 |
| §6.2 Phase 4 远程（延后） | 不在本 plan 范围 |

---

## 延后项（远程就绪后单独执行）

1. 创建 GitHub 仓库 `rx-workflow`，`git remote add origin … && git push -u origin master`
2. 构建并 push `ghcr.io/rxwf/api`、`ghcr.io/rxwf/web`、`ghcr.io/rxwf/crewai-runner` 等镜像
3. 可选：本地文件夹 `any-workflow` → `rx-workflow`（不影响 Git）
