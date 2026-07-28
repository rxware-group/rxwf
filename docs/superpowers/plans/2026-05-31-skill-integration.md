# Skill 集成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在工作流中执行 `.rxwf/skills` 下的 Agent Skill（`skillRun`），经 Runner 沙箱提供 Read/Grep/Shell，经 API 提供 `web_search`；P2 起支持 Rules、多格式 import、`toolSubagent`、workflow 模板编译；P3 起 MCP 与 `workflow_run` 执行。

**Architecture:** 新增 `packages/skill-runtime`（Skill IR、Loader、Executor、Rules/Workflow 适配器）；`skillRun` 节点在 `packages/node-runner` 中调用 `createSkillRuntime()`，复用 `ai-runtime` ReAct + `collectSatellites`；builtin 与读盘经 **`runner.tool.invoke`** 下沉到已解析 Runner（§4.5）；Web Search **不**走 Runner。运行时**仅** `.rxwf/` / `~/.rxwf/`；第三方目录 **import only**。

**Tech Stack:** TypeScript、pnpm workspace、Vitest、Fastify、`@rxwf/workflow`、`@rxwf/node-runner`、`@rxwf/ai-runtime`、`@rxwf/runner-protocol`、Runner WebSocket Gateway、PostgreSQL（P2 注册中心）。

**设计依据:** [2026-05-31-skill-integration-design.md](../specs/2026-05-31-skill-integration-design.md)（含 §3.8.11–12、§5.6、§6.7.10.1、§7.3、§17）

**对标 / 验收:** [2026-05-31-skill-platform-parity-matrix.md](../specs/2026-05-31-skill-platform-parity-matrix.md) §8.2（AC-S1…S3）

**Fixtures（AC-S2c）:** `docs/superpowers/fixtures/workflows/`（`antigravity-startcycle.source.md`、`startcycle.workflow.yaml`、`startcycle.compiled.linear_skillRun.json`）

**建议:** 在独立 git worktree 中按 Phase 交付（见 superpowers:using-git-worktrees）；每 Task 单独 commit。

---

## 实施状态（`feat/skill-integration`，2026-05-31）

**结论：本计划 Phase 1–4 与文首 Task 1–22 / P4 表内项均已交付，无阻塞遗留。** 未纳入本计划的增强（真实 LLM 冒烟、独立 Skills CRUD 管理页等）见「已知遗留」。

**分支 / worktree:** `feat/skill-integration` @ `.worktrees/skill-integration`

**最新提交:** `eb7caa6`（`7e9ae36` RxWF 设置/registry；`eb7caa6` workflow_run E2E + 编辑器补全）

**冒烟文档:** `docs/RELEASE-skill-p1.md`、`docs/RELEASE-skill-p3.md`、`docs/RELEASE-skill-p4.md`

| Phase | 状态 | 代表 commit | 门禁 |
|-------|------|-------------|------|
| P1 MVP | ✅ 已交付 | `5e5dcc1`…`2228500` | AC-S1 / S1b / S1c / S1d |
| P2 注册中心 | ✅ 已交付 | `8ba9ec5` | AC-S2 / S2b / S2c |
| P3 MCP + workflow_run | ✅ 已交付 | `79361cb`…`eb7caa6` | AC-S3（子集见下表） |
| P4 扩展 | ✅ 已交付 | `f44328c` | 设计 §3.8 / hooks / HITL 子集 |

**Task 完成一览（以交付为准；下文逐步 checkbox 保留为实施 spec 参考）**

| Task | 摘要 | Commit / 备注 |
|------|------|----------------|
| 1–10 | `@rxwf/skill-runtime`、`skillRun`、Runner `tool.invoke`、P1 集成测 | `a615b63`…`2228500` |
| 11 | Skills 表 + `POST/GET /api/skills/*`、import | `8ba9ec5`、`7e9ae36`；设置页 **RxWF / Skills** 扫描/导入（非独立 CRUD 管理台） |
| 12 | `RuleResolver`（仅 `rxwf_rules`）、`POST /api/rules/import` | `8ba9ec5` |
| 13 | `instruction_contexts` + resolve/reindex API | `8ba9ec5` |
| 14 | Workflow import + `WorkflowCompiler` AC-S2c | `7e3f544`、`8ba9ec5` |
| 15 | `toolSubagent` / `toolSkill` | `8ba9ec5` |
| 16 | `workflow-catalog` 索引 | `8ba9ec5`；hooks/commands 索引在 **P4** |
| 17 | OpenCode import / denylist | `79361cb` |
| 18 | OpenClaw `metadata.openclaw` → E1054 | `79361cb`；**加载路径**在 `SkillLoader` 统一 `parseOpenClawSkillMd` |
| 19 | `SkillToolIntentParser`；`hint` / `off` / `auto` | `79361cb`、`eb7caa6`；`auto` 需 `settings.skillToolIntentAuto` + **E1077**；工作流设置 Tab（Editor+ `canEditSkillSettings`） |
| 20 | MCP `skill_*` / `rules_*` + 集成测 | `79361cb`、`skill-mcp-p3.integration.test.ts` |
| 21 | `cursor-export` + `examples/rxwf-skill-starter` | `79361cb` + 样板 `.rxwf/`（gitignore 例外） |
| 22 | `workflow_run`、E1075/E1076、startcycle 测试 | `79361cb`、`eb7caa6`；**enqueue E2E** `workflow-run-pipeline.integration.test.ts`（mock LLM，子图 `workspaceRoot` 断言） |
| P4 | Antigravity import、`contextPaths`、hooks、commands API、HITL reject 回环 | `f44328c` |

**已知遗留（计划外 / 非阻塞，可选 follow-up）**

| 项 | 说明 |
|----|------|
| 真实 LLM 冒烟 | 当前 AC-S3 / workflow_run E2E 使用 mock `AiRuntime`，未接 Ollama/生产模型端到端 |
| Skills 独立管理台 | 已有 `/settings/rxwf` 扫描与编辑器 registry 下拉；无设计稿级「列表 CRUD + 版本」专页 |
| `compile-by-path` 画布导入 | API 编译结果仍用占位符 `{{$workspaceRoot}}`（适合手填工作区）；**运行时** `workflow_run` 已传入真实 `workspaceRoot`（`eb7caa6`） |
| `grep` builtin | P1 占位返回空匹配（见 skill-executor 注释） |
| `subagent_satellite` 编译模式 | 编译器支持，产品 UI/验收用例覆盖少于 `linear_skillRun` |
| Viewer 只读 | `skillToolIntentAuto` 仅 Editor+ 可改；Viewer 可看工作流但未单独做 Skill 设置 UX 文案 |

**开发注意：** `@rxwf/node-runner` / `@rxwf/execution` 集成测默认读 **`dist/`**；改 executor 源码后执行 `pnpm --filter @rxwf/node-runner build`（及 execution），避免与运行时不一致。

**交付摘要（`7e9ae36` + `eb7caa6`）**

- 设置 → **RxWF / Skills**（`/settings/rxwf`）；`skillSource=registry` + `loadSkillFromRegistry`（lite DB）。
- 编辑器：**SkillRegistrySelect**、**WorkflowRunFields**（模板 + 编译导入画布）、**SkillWorkflowSettings**（`skillToolIntentAuto`）。
- API：`POST /api/rxwf-catalog/workflows/compile-by-path`；`docs/error-codes.md` E1040–E1077。
- 测试：`workflow-run-pipeline.integration.test.ts`；**execution-engine** 捕获 executor 抛错，避免误报 success / Vitest unhandled rejection。

---

## 文件结构总览（实际路径）

| 路径 | 职责 | 阶段 |
|------|------|------|
| `packages/skill-runtime/` | Skill IR、Loader、Executor、builtin、Rules/Workflow 适配器 | P1+ |
| `packages/skill-runtime/src/types/skill-ir.ts` | `SkillIR`、`SkillRunParameters` 映射类型 | P1 |
| `packages/skill-runtime/src/skills/adapters/cursor-skill-adapter.ts` | 解析 `SKILL.md` frontmatter | P1 |
| `packages/skill-runtime/src/skills/rxwf-path.ts` | `.rxwf/skills/**` 路径校验 E1066/E1067 | P1 |
| `packages/skill-runtime/src/loaders/skill-loader.ts` | path / inline；远程经 `toolInvoke` 读盘 | P1 |
| `packages/skill-runtime/src/executor/skill-executor.ts` | ReAct + builtin 派发 | P1 |
| `packages/skill-runtime/src/executor/builtin-tools.ts` | `mergeBuiltinTools`、`dispatchTool` | P1 |
| `packages/skill-runtime/src/executor/web-search.ts` | `web_search` → `WebSearchPort` | P1 |
| `packages/runner-protocol/src/tool-invoke.ts` | `RunnerToolInvokeRequest/Result` | P1 |
| `packages/providers/contracts/src/runner-gateway-port.ts` | `invokeTool()` 扩展 | P1 |
| `packages/runner-agent/`（或 sdk 扩展） | `skill-filesystem` + `shell.exec` handler | P1 |
| `packages/node-runner/src/executors/skill-run.ts` | `skillRun` 节点执行器 | P1 |
| `packages/node-runner/src/executors/register-skill.ts` | 注册 skill 执行器 | P1 |
| `packages/workflow/src/validate-skill.ts` | E1040–E1043、E1066 等校验 | P1 |
| `packages/workflow/src/agent-satellites.ts` | 扩展 `skillRun` 卫星收集 | P1 |
| `apps/web/src/features/editor/node-param-schemas.ts` | `skillRun` 参数面板 | P1 |
| `apps/web/src/features/editor/node-port-defs.ts` | `ai_instruction` 端口（P2 接线） | P2 |
| `apps/api/src/routes/skills.ts` | 注册中心 API | P2 |
| `apps/api/src/routes/workflows-catalog.ts` | `workflow_import`、`import-to-workflow` | P2 |
| `packages/skill-runtime/src/workflows/workflow-compiler.ts` | §3.8.12 编译器 | P2 |
| `packages/skill-runtime/src/workflows/adapters/antigravity-workflow-adapter.ts` | §3.8.11 解析 | P2 |
| `packages/node-runner/src/executors/tool-subagent.ts` | P2 `toolSubagent` | P2 |
| `packages/node-runner/src/executors/tool-skill.ts` | P2 `toolSkill` | P2 |
| `packages/node-runner/src/executors/workflow-run.ts` | P3 `workflow_run` | P3 |
| `docs/schemas/workflow-definition.v1.schema.json` | `settings.webSearch` 扩展 | P1 |
| `packages/i18n-catalog/src/catalog-ui-ext.ts` | E1040–E1076 文案 | P1+ |
| `docs/error-codes.md` | Skill 轨错误码章节 | P1 |

---

## Phase 1 — MVP（约 3 周，AC-S1 / S1b / S1c / S1d）✅ 已交付

> Commit 链：`a615b63` → `3144514` → `2228500`；集成测与 `docs/RELEASE-skill-p1.md` 见 Task 10。

### Task 1: 创建 `@rxwf/skill-runtime` 包与 Skill IR

**Files:**
- Create: `packages/skill-runtime/package.json`
- Create: `packages/skill-runtime/tsconfig.json`
- Create: `packages/skill-runtime/src/types/skill-ir.ts`
- Create: `packages/skill-runtime/src/index.ts`
- Modify: `pnpm-workspace.yaml`（若需显式列出则通常已含 `packages/*`）

- [ ] **Step 1: 添加 package.json**

```json
{
  "name": "@rxwf/skill-runtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@rxwf/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

- [ ] **Step 2: 定义 SkillIR（与 spec §3.2 对齐）**

```typescript
// packages/skill-runtime/src/types/skill-ir.ts
export type SkillPermission =
  | 'filesystem:read'
  | 'code:execute'
  | 'network'
  | 'network:write';

export type SkillProvenance =
  | 'rxwf'
  | 'cursor'
  | 'claude'
  | 'agents_md'
  | 'opencode'
  | 'openclaw'
  | 'antigravity';

export interface SkillIR {
  id: string;
  name: string;
  description: string;
  skillRelPath: string;
  packageDir: string;
  permissions: SkillPermission[];
  provenance?: SkillProvenance;
  disableModelInvocation?: boolean;
}
```

- [ ] **Step 3: 根依赖与构建**

Run: `pnpm install`  
Run: `pnpm --filter @rxwf/skill-runtime build`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/skill-runtime pnpm-lock.yaml
git commit -m "feat(skill-runtime): scaffold package and SkillIR types"
```

---

### Task 2: Cursor / Rxwf Skill 适配器 + 单元测试

**Files:**
- Create: `packages/skill-runtime/src/skills/adapters/cursor-skill-adapter.ts`
- Create: `packages/skill-runtime/src/skills/adapters/rxwf-skill-adapter.ts`
- Create: `packages/skill-runtime/src/skills/parse-skill-md.ts`
- Create: `packages/skill-runtime/src/skills/adapters/cursor-skill-adapter.test.ts`
- Create: `packages/skill-runtime/fixtures/skills/code-review/SKILL.md`（最小 frontmatter 样例）

- [ ] **Step 1: 写失败测试**

```typescript
// packages/skill-runtime/src/skills/adapters/cursor-skill-adapter.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSkillMd } from '../parse-skill-md.js';

describe('parseSkillMd', () => {
  it('parses name and permissions from frontmatter', () => {
    const raw = readFileSync(
      join(import.meta.dirname, '../../../fixtures/skills/code-review/SKILL.md'),
      'utf8',
    );
    const ir = parseSkillMd(raw, {
      skillRelPath: 'code-review',
      packageDir: '/repo/.rxwf/skills/code-review',
    });
    expect(ir.name).toBe('code-review');
    expect(ir.permissions).toContain('filesystem:read');
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm --filter @rxwf/skill-runtime test`  
Expected: FAIL（`parseSkillMd` 未定义）

- [ ] **Step 3: 实现 `parseSkillMd` + `assertRxwfSkillPath`（E1066/E1067）**

`assertRxwfSkillPath(skillPath)`：拒绝 `.cursor/skills`、`.claude/skills`；要求匹配 `^\.rxwf/skills/[^/]+` 或更深（非 `skills/SKILL.md` 直挂根）。

- [ ] **Step 4: 测试 PASS**

Run: `pnpm --filter @rxwf/skill-runtime test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/skill-runtime/src/skills packages/skill-runtime/fixtures
git commit -m "feat(skill-runtime): parse SKILL.md and validate rxwf paths"
```

---

### Task 3: SkillLoader（本地 path + inline）

**Files:**
- Create: `packages/skill-runtime/src/loaders/skill-loader.ts`
- Create: `packages/skill-runtime/src/loaders/skill-loader.test.ts`

- [ ] **Step 1: 失败测试 — 加载 `.rxwf/skills/code-review`**

```typescript
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SkillLoader } from './skill-loader.js';

describe('SkillLoader', () => {
  it('loads SKILL.md under .rxwf/skills/{pkg}', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rxwf-'));
    const pkg = join(root, '.rxwf', 'skills', 'code-review');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'SKILL.md'),
      '---\nname: code-review\npermissions:\n  - filesystem:read\n---\n\nReview code.\n',
    );
    const loader = new SkillLoader({ workspaceRoot: root });
    const ir = await loader.loadFromPath('.rxwf/skills/code-review');
    expect(ir.skillRelPath).toBe('code-review');
  });

  it('throws E1066 for .cursor/skills path', async () => {
    const loader = new SkillLoader({ workspaceRoot: '/tmp' });
    await expect(loader.loadFromPath('.cursor/skills/foo')).rejects.toMatchObject({
      code: 'E1066',
    });
  });
});
```

- [ ] **Step 2–4: 实现 `loadFromPath` / `loadInline`；跑通测试**

- [ ] **Step 5: Commit**

```bash
git add packages/skill-runtime/src/loaders
git commit -m "feat(skill-runtime): SkillLoader with E1066 path guard"
```

---

### Task 4: `runner.tool.invoke` 协议与 Gateway 端口

**Files:**
- Create: `packages/runner-protocol/src/tool-invoke.ts`
- Modify: `packages/runner-protocol/src/index.ts`（导出）
- Modify: `packages/providers/contracts/src/runner-gateway-port.ts`（`invokeTool`）
- Create: `packages/runner-protocol/src/tool-invoke.test.ts`（类型/序列化冒烟）

- [ ] **Step 1: 定义 `RunnerToolInvokeRequest/Result`（spec §4.5.7）**

- [ ] **Step 2: 在 `RunnerGatewayPort` 增加 `invokeTool(runnerId, request)`**

- [ ] **Step 3: `apps/api` Gateway 实现：WS 发 `tool.invoke`、等 `tool.result`（超时 → E1061）**

参考：`docs/superpowers/specs/2026-05-29-runner-v1.1-websocket-design.md`

- [ ] **Step 4: 单元测试 mock Gateway 往返**

- [ ] **Step 5: Commit**

```bash
git add packages/runner-protocol packages/providers/contracts apps/api
git commit -m "feat(runner): add runner.tool.invoke protocol and gateway invokeTool"
```

---

### Task 5: Runner Agent `skill-filesystem` 扩展

**Files:**
- Create: `packages/runner-agent/src/extensions/skill-filesystem.ts`（路径按仓库实际调整）
- Create: `packages/runner-agent/src/extensions/skill-filesystem.test.ts`

- [ ] **Step 1: 实现 `read` / `list` / `grep` / `resolvePath` / `resolveWorkspace`**

`resolveWorkspace`：自 `startDir` 向上查找含 `.rxwf/skills` 的目录；`resolvePath`：realpath + `scanRoots` 边界（越界 → 失败码映射 E1056）。

- [ ] **Step 2: 实现 `shell.exec`（`run_terminal_cmd` 子集，黑名单见 spec §6.7.5）**

- [ ] **Step 3: Agent WS handler 路由 `capability=skill:filesystem|shell`**

- [ ] **Step 4: Commit**

```bash
git add packages/runner-agent
git commit -m "feat(runner-agent): skill-filesystem and shell.exec for tool.invoke"
```

---

### Task 6: `mergeBuiltinTools` + `SkillExecutor`（嵌入式）

**Files:**
- Create: `packages/skill-runtime/src/executor/builtin-tools.ts`
- Create: `packages/skill-runtime/src/executor/tool-collector.ts`
- Create: `packages/skill-runtime/src/executor/skill-executor.ts`
- Create: `packages/skill-runtime/src/executor/builtin-tools.test.ts`
- Create: `packages/skill-runtime/src/create-skill-runtime.ts`

- [ ] **Step 1: 测试 — `network` permission 才注入 `web_search`**

```typescript
import { describe, expect, it } from 'vitest';
import { mergeBuiltinTools } from './builtin-tools.js';

describe('mergeBuiltinTools', () => {
  it('includes read and grep when filesystem:read', () => {
    const tools = mergeBuiltinTools({
      permissions: ['filesystem:read'],
      mode: 'from-skill-permissions',
    });
    expect(tools.map((t) => t.name)).toEqual(expect.arrayContaining(['read_file', 'grep']));
    expect(tools.map((t) => t.name)).not.toContain('run_terminal_cmd');
  });

  it('includes web_search only with network', () => {
    const withNet = mergeBuiltinTools({
      permissions: ['network'],
      mode: 'from-skill-permissions',
      webSearchEnabled: true,
    });
    expect(withNet.map((t) => t.name)).toContain('web_search');

    const without = mergeBuiltinTools({
      permissions: ['filesystem:read'],
      mode: 'from-skill-permissions',
      webSearchEnabled: true,
    });
    expect(without.map((t) => t.name)).not.toContain('web_search');
  });
});
```

- [ ] **Step 2–4: 实现 `SkillExecutor.execute`：加载 IR → 收集卫星 Tool → `runAgent`（注入 `@rxwf/ai-runtime` 适配接口）**

- [ ] **Step 5: Commit**

```bash
git add packages/skill-runtime/src/executor packages/skill-runtime/src/create-skill-runtime.ts
git commit -m "feat(skill-runtime): SkillExecutor and builtin tool merge"
```

---

### Task 7: `WebSearchPort` + `web_search` builtin（AC-S1d）

**Files:**
- Create: `packages/providers/contracts/src/web-search-port.ts`
- Create: `packages/skill-runtime/src/executor/web-search.ts`
- Modify: `docs/schemas/workflow-definition.v1.schema.json`（`settings.webSearch`，§6.7.10.1）
- Modify: `apps/api/src/bootstrap-plus.ts`（注入 stub 或 Brave 适配器）

- [ ] **Step 1: 定义 `WebSearchPort` 接口（spec §6.7.10）**

- [ ] **Step 2: 无 Provider 时 `dispatchTool` → AwfError E1071；无 `network` → E1072**

- [ ] **Step 3: 集成测试：mock `WebSearchPort.search` 返回摘要**

- [ ] **Step 4: Commit**

```bash
git add packages/providers/contracts packages/skill-runtime docs/schemas apps/api
git commit -m "feat(skill): web_search builtin on API with E1071/E1072"
```

---

### Task 8: `skillRun` 节点执行器 + 注册

**Files:**
- Create: `packages/node-runner/src/executors/skill-run.ts`
- Create: `packages/node-runner/src/executors/skill-run.test.ts`
- Create: `packages/node-runner/src/executors/register-skill.ts`
- Modify: `packages/node-runner/src/facade/node-runner-facade.ts`（`SkillExecutorDeps`）
- Modify: `packages/workflow/src/agent-satellites.ts`（识别 `skillRun` 节点 id）

- [ ] **Step 1: `createSkillRunExecutor(deps)` — 解析 `RunnerDispatcher`、`workspaceRoot`、`preferRemote`**

- [ ] **Step 2: 远程场景：`SkillLoader` 经 `deps.invokeTool` 读 SKILL.md（AC-S1b）**

- [ ] **Step 3: 注册到 `registerPlusExecutors` 或独立 `registerSkillExecutors`**

- [ ] **Step 4: 冒烟测试 — 使用 temp `.rxwf/skills` + mock `ai` 返回固定文本**

Run: `pnpm --filter @rxwf/node-runner test -- skill-run`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/node-runner packages/workflow
git commit -m "feat(node-runner): skillRun executor with runner dispatch"
```

---

### Task 9: 工作流校验 + 节点元数据（Web）

**Files:**
- Create: `packages/workflow/src/validate-skill.ts`
- Modify: `packages/workflow/src/validate.ts`（调用 skill 校验）
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`（`skillRun` 字段）
- Modify: `apps/web/src/features/editor/node-port-defs.ts`（端口定义，与 `aiAgent` 对齐）
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`（E1040、E1066 等）

- [ ] **Step 1: 保存工作流时校验 `skillSource`/`skillPath`/Model 卫星（E1040、E1043）**

- [ ] **Step 2: Web 节点面板：`skillPath`、`workspaceRoot`、`preferRemote`、`builtinToolsMode`**

- [ ] **Step 3: `pnpm --filter @rxwf/workflow test` + 前端 typecheck**

Run: `pnpm --filter @rxwf/web exec tsc --noEmit`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/workflow apps/web packages/i18n-catalog
git commit -m "feat(workflow,web): skillRun validation and editor schema"
```

---

### Task 10: P1 集成测试与文档（AC-S1 / S1c / S1b）

**Files:**
- Create: `apps/api/src/integration/skill-run-p1.integration.test.ts`
- Create: `docs/RELEASE-skill-p1.md`（冒烟步骤）
- Modify: `docs/error-codes.md`（E1040–E1072 子集）

- [ ] **Step 1: 集成测试 — 本地 Embedded `.rxwf/skills` 执行（AC-S1）**

- [ ] **Step 2: 嵌套路径 `team/ops/foo`（AC-S1c）**

- [ ] **Step 3: 可选：pinned Runner mock `invokeTool` 断言 `node_runs.runner_id`（AC-S1b）**

- [ ] **Step 4: 拒绝 `.cursor/skills` 路径 E1066**

Run: `pnpm --filter @rxwf/api test -- skill-run-p1`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/integration docs
git commit -m "test(api): skill P1 integration AC-S1/S1b/S1c"
```

**Phase 1 完成门禁：** AC-S1、AC-S1c、AC-S1d、AC-S1b（有 Runner 环境时）全部通过。

---

## Phase 2 — 注册中心、Rules、import、toolSubagent、workflows（约 4 周）✅ 已交付

> Commit：`8ba9ec5`（含 `7e3f544` WorkflowCompiler）。

### Task 11: skills 表 + Skill API + 管理 UI 骨架

**Files:**
- Create: `packages/db/migrations/00xx_skills.sql`（spec §7.1）
- Create: `apps/api/src/routes/skills.ts`
- Modify: `apps/web` Skill 管理页（列表/上传占位）

- [ ] **Step 1: 迁移 `skills` / `skill_files` / `skill_scan_roots`**

- [ ] **Step 2: `POST /api/skills/import`（`SkillImportRequest`，E1068 overwrite）**

- [ ] **Step 3: `GET /api/skills`、`POST /api/skills/scan`**

- [ ] **Step 4: Commit** — `feat(api): skill registry and import endpoint`

---

### Task 12: RuleResolver + `rxwf_rules` only（AC-S2）

**Files:**
- Create: `packages/skill-runtime/src/rules/rule-resolver.ts`
- Create: `packages/skill-runtime/src/rules/adapters/rxwf-rules-adapter.ts`
- Create: `packages/skill-runtime/src/rules/adapters/cursor-rules-adapter.ts`（**import** 用）
- Create: `packages/skill-runtime/src/rules/merge.ts`
- Create: `packages/node-runner/src/executors/rule-inject.ts`（P2）
- Modify: `packages/workflow/src/agent-satellites.ts`（`collectInstructionSources`）

- [ ] **Step 1: `ruleMode=off` 默认无注入；`inherit`/`explicit` + `rxwf_rules` 读 `.rxwf/rules`**

- [ ] **Step 2: 废弃 `ruleSources` 含 `cursor_rules` → E1069**

- [ ] **Step 3: `POST /api/rules/import` → `.rxwf/rules/imported/{format}/`**

- [ ] **Step 4: 测试 AC-S2 + AC-S2b（cursor import → skillRun）**

- [ ] **Step 5: Commit** — `feat(skill-runtime): RuleResolver and rules_import`

---

### Task 13: `instruction_contexts` 表 + resolve API（§7.3）

**Files:**
- Create: `packages/db/migrations/00xx_instruction_contexts.sql`
- Create: `apps/api/src/routes/instruction-contexts.ts`

- [ ] **Step 1: 按 spec §7.3 DDL + 索引创建表**

- [ ] **Step 2: `GET /api/instruction-contexts`、`POST .../resolve`、`POST .../reindex`**

- [ ] **Step 3: Commit** — `feat(api): instruction_contexts index and resolve`

---

### Task 14: Workflow import + WorkflowCompiler（AC-S2c）

**Files:**
- Create: `packages/skill-runtime/src/workflows/workflow-template-ir.ts`
- Create: `packages/skill-runtime/src/workflows/adapters/antigravity-workflow-adapter.ts`
- Create: `packages/skill-runtime/src/workflows/workflow-compiler.ts`
- Create: `packages/skill-runtime/src/workflows/workflow-compiler.test.ts`
- Create: `apps/api/src/routes/workflows-catalog.ts`

- [ ] **Step 1: 复制 fixtures 到 `packages/skill-runtime/src/workflows/__fixtures__/` 或 repo 级引用 `docs/superpowers/fixtures/workflows/`**

- [ ] **Step 2: 测试 `AntigravityWorkflowAdapter.parse` 对齐 §A.8 JSON**

- [ ] **Step 3: 测试 `WorkflowCompiler.compile({ compileMode: 'linear_skillRun' })` 深度等于 `startcycle.compiled.linear_skillRun.json`**

Run: `pnpm --filter @rxwf/skill-runtime test -- workflow-compiler`  
Expected: PASS

- [ ] **Step 4: `POST /api/workflows/import`、`POST /api/rxwf-catalog/workflows/import-to-workflow`**

- [ ] **Step 5: Commit** — `feat(skill-runtime): workflow import and compiler AC-S2c`

---

### Task 15: `toolSubagent` + `toolSkill` 节点（AC-S2 子能力）

**Files:**
- Create: `packages/node-runner/src/executors/tool-subagent.ts`
- Create: `packages/node-runner/src/executors/tool-skill.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `packages/workflow/src/validate.ts`（E1048、E1049、agentDepth）

- [ ] **Step 1: `toolSubagent` 卫星拓扑 + `SubagentExecutor`（`agentDepth` 默认 2）**

- [ ] **Step 2: `toolSkill` `mode: sub-agent | single-shot`**

- [ ] **Step 3: `readonly` 剔除写路径 Tool（E1050）**

- [ ] **Step 4: Commit** — `feat(node-runner): toolSubagent and toolSkill`

---

### Task 16: `.rxwf` 目录索引（agents / hooks / commands / workflows glob）✅ 部分

**Files:**
- `packages/skill-runtime/src/rxwf/workflow-catalog.ts` ✅（P2）
- `packages/skill-runtime/src/rxwf/hook-catalog.ts`、`command-catalog.ts` ✅（P4）
- `apps/web` — Rules 预览、workflow 模板列表 ❌ 遗留

- [x] **Step 1: glob `**/.rxwf/workflows/*.workflow.yaml` 索引** — `8ba9ec5`

- [x] **Step 2: Commit** — hooks/commands 见 P4 `f44328c`

---

**Phase 2 完成门禁：** AC-S2、AC-S2b、AC-S2c。

---

## Phase 3 — MCP、意图解析、workflow 执行、多平台 import（约 4 周）✅ 已交付

> Commit：`79361cb`；`docs/RELEASE-skill-p3.md`。

### Task 17: `OpenCodeSkillAdapter` + `OpenCodeRulesAdapter`（import only）

**Files:**
- Create: `packages/skill-runtime/src/skills/adapters/opencode-skill-adapter.ts`
- Create: `packages/skill-runtime/src/rules/adapters/opencode-rules-adapter.ts`

- [ ] **Step 1: 导入 `opencode.json` `permission.skill` → `skillDenylist`（§9.1.3）**

- [ ] **Step 2: Commit** — `feat(skill-runtime): OpenCode import adapters P3`

---

### Task 18: `OpenClawSkillAdapter` + metadata 过滤

**Files:**
- Create: `packages/skill-runtime/src/skills/adapters/openclaw-skill-adapter.ts`
- Create: `packages/skill-runtime/src/skills/openclaw-metadata.ts`

- [ ] **Step 1: `metadata.openclaw` 校验失败 → E1054**

- [ ] **Step 2: Commit**

---

### Task 19: `SkillToolIntentParser` + `toolIntentMode`（AC-S3 子项）

**Files:**
- Create: `packages/skill-runtime/src/intent/skill-tool-intent-parser.ts`
- Create: `packages/skill-runtime/src/intent/skill-tool-intent-parser.test.ts`

- [ ] **Step 1: 仅在已装配 Tool 集合内匹配（§6.5 别名表 §6.7.8）**

- [ ] **Step 2: `toolIntentMode: hint` 默认；`auto` 需 Editor+**

- [ ] **Step 3: Commit**

---

### Task 20: MCP `skill_list` / `skill_get` / `skill_run` / `rules_*`

**Files:**
- Modify: `apps/api/src/mcp/`（或现有 MCP server 注册处）
- Spec: §8.3 MCP Tools

- [ ] **Step 1: 注册 MCP tools，参数与 spec 一致**

- [ ] **Step 2: 集成测试调用 `skill_run` 同步执行**

- [ ] **Step 3: Commit**

---

### Task 21: 导出适配器 + 示例仓库

**Files:**
- Create: `packages/skill-runtime/src/export/cursor-export.ts`
- Create: `examples/rxwf-skill-starter/.rxwf/skills/...`（样板）

- [ ] **Step 1: 从 `.rxwf/skills` 导出 `.cursor/skills`（可选，不写回为默认）**

- [ ] **Step 2: Commit** — `docs(examples): multi-platform skill starter`

---

### Task 22: `workflow_run` 执行器（AC-S3）

**Files:**
- Create: `packages/node-runner/src/executors/workflow-run.ts`
- Modify: `packages/workflow/src/validate-skill.ts`（E1076）
- Modify: `packages/execution/src/hitl/`（P3 `enableHitlLoop` 扩展，§3.8.12 B.3）

- [ ] **Step 1: `WorkflowRunExecutor` 加载模板 → `WorkflowCompiler` → 子执行或内联图**

- [ ] **Step 2: `workflows.enabled: false` → E1075**

- [ ] **Step 3: 集成测试：编译后的 startcycle 子图可 enqueue（可 mock LLM）**

- [ ] **Step 4: Commit** — `feat(node-runner): workflow_run P3 executor`

**Phase 3 完成门禁：** AC-S3。

---

## Phase 4 — 扩展（已交付，`f44328c`）✅

> 详见 `docs/RELEASE-skill-p4.md`。

| 项 | 状态 | 实现要点 |
|----|------|----------|
| Antigravity `~/.gemini/antigravity/skills` import | ✅ | `importAntigravityGeminiSkill`；`POST /api/skills/import` + `sourceFormat: antigravity_gemini` |
| `workingFiles` → `contextPaths` | ✅ | `collectContextPaths` / `filterContextsByPaths`；接入 `skillRun` / `resolveRules` |
| `.rxwf/hooks` 执行 | ✅ | `hook-catalog`、`hook-runner`；`skillRun` 前后 `pre/post_skill_run`；`GET /api/rxwf-catalog/hooks` |
| `commands` | ⚠️ API only | `command-catalog` + `GET /api/rxwf-catalog/commands`；**无** Web 命令面板 |
| HITL reject 回环 | ✅ | `hitlLoopOnReject` 编译参数；`resume-hitl.ts` + `resume-hitl-loop.test.ts` |

---


## 验收标准映射

| AC | Phase | Task |
|----|-------|------|
| AC-S1 | P1 | Task 3、8、10 |
| AC-S1b | P1 | Task 4、5、8、10 |
| AC-S1c | P1 | Task 3、10 |
| AC-S1d | P1 | Task 7、10 |
| AC-S2 | P2 | Task 12 |
| AC-S2b | P2 | Task 11、12 |
| AC-S2c | P2 | Task 14 |
| AC-S3 | P3 | Task 19–22 |
| P4 扩展 | P4 | Antigravity import、hooks、HITL loop（见 Phase 4 表） |

---

## 测试与 CI 命令（汇总）

| 范围 | 命令 |
|------|------|
| skill-runtime 单元 | `pnpm --filter @rxwf/skill-runtime test` |
| node-runner | `pnpm --filter @rxwf/node-runner test` |
| workflow 校验 | `pnpm --filter @rxwf/workflow test` |
| API 集成 | `pnpm --filter @rxwf/api test -- skill` |
| MCP P3 集成 | `pnpm --filter @rxwf/skill-runtime build && pnpm --filter @rxwf/api test -- skill-mcp-p3` |
| execution HITL | `pnpm --filter @rxwf/execution test -- resume-hitl-loop` |
| 全量（提交前） | `pnpm build && pnpm test` |

---

## Spec 自检（plan author）

| Spec 章节 | 覆盖 Task |
|-----------|-----------|
| §3.3 仅 `.rxwf` | 2、3、8 |
| §4.5 远程 Runner | 4、5、8 |
| §6.7 builtin + web_search | 6、7 |
| §3.7–3.9 Rules | 12、13 |
| §3.8.10–12 workflows | 14、22 |
| §3.10 toolSubagent | 15 |
| §5.6 workflow_run | 22 |
| §7 注册中心 | 11、13 |
| §8 MCP | 20 |
| §9.1 权限分层 | 6、11、17 |
| §17 错误码 | 2、3、7、9、14、22 + i18n |

**占位扫描：** 无 TBD；P4 已展开并交付（Web 命令面板、registry 执行、全量 i18n 见「已知遗留」）。

---

## 执行方式（归档）

本计划在 `feat/skill-integration` 上 **Phase 1–4 与 Task 1–22 已全部落地**（最新 `eb7caa6`）。

**合并前建议：**

1. 将分支合并入 `master` 并开 PR（勿提交 `runner-config/credential.json` 等本地秘密）。
2. worktree 门禁：`pnpm --filter @rxwf/node-runner build`、`pnpm --filter @rxwf/skill-runtime test`、`pnpm --filter @rxwf/api test -- skill`、`pnpm --filter @rxwf/api test -- workflow-run-pipeline`。
3. 计划外增强按「已知遗留」表单独开 issue/PR，不阻塞本计划结项。
