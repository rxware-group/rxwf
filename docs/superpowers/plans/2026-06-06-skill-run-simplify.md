# Skill Run 简化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 [2026-06-03-skill-run-simplify-design.md](../specs/2026-06-03-skill-run-simplify-design.md) 简化 `skillRun` 参数与执行路径；Builtin 改为 Tool 卫星；落地 Web Search（Embedded + 远程 Runner）；RxWF 工作区持久化；移除 Plus 门控；Runner 按 capabilities 调度。

**Architecture:** 新增 `packages/web-search` 与 `agent-satellite-tools` 共享模块；扩展 `runner-protocol` / `skill-tool-handler`；`skill-run.ts` 删除 `mergeBuiltinTools` 链并复用 `run-ai-agent-node` 的 Tool 注册/调用模式；API 注入 `plusDeps.webSearch` + `runnerGateway`；编辑器注册 `toolRead`/`toolWrite`/`toolGrep`/`toolShell`/`toolWebSearch` 五类卫星。

**Tech Stack:** TypeScript、pnpm workspace、Vitest、Fastify、`@rxwf/workflow`、`@rxwf/node-runner`、`@rxwf/skill-runtime`、`@rxwf/runner-protocol`、`@rxwf/runner-agent`、`@rxwf/ai-runtime`、`@rxwf/system-settings`。

**设计依据:** [2026-06-03-skill-run-simplify-design.md](../specs/2026-06-03-skill-run-simplify-design.md)

**建议:** 独立 git worktree（`feat/skill-run-simplify`）；**按 Phase 合并 PR**；改 `@rxwf/node-runner` 后执行 `pnpm --filter @rxwf/node-runner build` 再跑集成测。

---

## Phase 总览

| Phase | 交付物 | 可独立验收 |
|-------|--------|------------|
| **A** | RxWF 工作区 API + Skill Run 参数/UI/校验收敛 | ✅ 编辑器可配 path/registry；无 Builtin 变更 |
| **B** | Runner 协议：filesystem write/grep、shell exec、web_search capability | ✅ Agent handler 单测 |
| **C** | `packages/web-search` + Settings API/UI（Embedded） | ✅ 测试连接 API |
| **D** | 五类 Tool 卫星节点 + `agent-satellite-tools` + aiAgent 接入 | ✅ aiAgent + toolRead 单测 |
| **E** | skill-run 去 Builtin + 卫星 Tool + Prompt/systemPrompt/timeout | ✅ skill-run 集成测 |
| **F** | Web Search 远程 Runner（§6.15） | ✅ tool.invoke web_search E2E |
| **G** | 去 Plus + Runner capabilities 调度 | ✅ 节点面板全开、无 featurePlus |

---

## 文件结构总览

| 路径 | 职责 | Phase |
|------|------|-------|
| `packages/system-settings/src/keys.ts` | `rxwfWorkspaceRoot`、webSearch 设置键 | A, C |
| `apps/api/src/routes/rxwf-workspace.ts` | GET/PUT `/api/rxwf/workspace` | A |
| `apps/web/src/features/rxwf/RxwfSettingsPage.tsx` | 工作区 load/save | A |
| `apps/web/src/features/editor/node-param-schemas.ts` | skillRun / tool* schema | A, D |
| `apps/web/src/features/editor/NodeEditorParamsPane.tsx` | registry 工作区只读、skillId | A |
| `apps/web/src/features/editor/SkillPathParamField.tsx` | 工作区 scan 下拉 | A |
| `packages/workflow/src/validate-skill.ts` | 去掉 inline/toolIntent/promptType | A |
| `packages/runner-protocol/src/tool-invoke.ts` | +`web_search`、可选 scanRoots、`providerConfig` | B, F |
| `packages/runner-agent/src/skill-tool-handler.ts` | write/grep/shell | B |
| `packages/runner-agent/src/web-search-tool-handler.ts` | 远程 web_search | F |
| `packages/web-search/` | Provider 适配器 + 工厂 | C, F |
| `packages/node-runner/src/executors/agent-satellite-tools.ts` | 注册 + invokeAgentTool | D, E |
| `packages/node-runner/src/executors/skill-run.ts` | 去 Builtin、卫星、Prompt 等 | E |
| `packages/node-runner/src/node-runner-requirements.ts` | tool* capabilities | D |
| `packages/workflow/src/agent-satellites.ts` | 五类 tool 卫星 type | D |
| `apps/api/src/routes/web-search-settings.ts` | GET/PUT/test web-search | C |
| `apps/api/src/execution/create-execution-runtime.ts` | plusDeps 接线 | C, E, F |
| `packages/ai-runtime/src/langchain-runtime.ts` | timeoutMs 语义 | E |
| `apps/web/src/features/settings/WebSearchSettings.tsx` | Provider 配置 UI | C |

---

## Phase A — RxWF 工作区 + Skill Run 参数/UI

### Task A1: RxWF 工作区持久化 API

**Files:**
- Modify: `packages/system-settings/src/keys.ts`
- Create: `apps/api/src/routes/rxwf-workspace.ts`
- Modify: `apps/api/src/app.ts`（或路由注册入口）
- Create: `apps/api/src/routes/rxwf-workspace.test.ts`

- [ ] **Step 1: 增加设置键**

```typescript
// packages/system-settings/src/keys.ts
export const SETTING_KEYS = {
  // ...existing
  rxwfWorkspaceRoot: 'rxwf.workspaceRoot',
} as const;
```

- [ ] **Step 2: 实现 GET/PUT**

```typescript
// apps/api/src/routes/rxwf-workspace.ts
app.get('/api/rxwf/workspace', { preHandler: authPreHandler }, async () => {
  const root = await ctx.settingsService.get(SETTING_KEYS.rxwfWorkspaceRoot);
  return { workspaceRoot: root ?? '' };
});

app.put('/api/rxwf/workspace', { preHandler: authPreHandler }, async (request) => {
  const body = (request.body ?? {}) as { workspaceRoot?: string };
  const workspaceRoot = String(body.workspaceRoot ?? '').trim();
  await ctx.settingsService.set(SETTING_KEYS.rxwfWorkspaceRoot, workspaceRoot);
  return { ok: true, workspaceRoot };
});
```

- [ ] **Step 3: 写失败测试再实现**

```typescript
// rxwf-workspace.test.ts
it('GET returns empty when unset', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/rxwf/workspace', headers: auth });
  expect(res.json()).toEqual({ workspaceRoot: '' });
});
```

- [ ] **Step 4: 运行测试**

```bash
pnpm --filter @rxwf/api exec vitest run src/routes/rxwf-workspace.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/system-settings/src/keys.ts apps/api/src/routes/rxwf-workspace.ts apps/api/src/routes/rxwf-workspace.test.ts
git commit -m "feat(api): persist RxWF workspace root in system settings"
```

---

### Task A2: RxWF Settings 页面 load/save

**Files:**
- Modify: `apps/web/src/features/rxwf/RxwfSettingsPage.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `packages/i18n-catalog/src/catalog-ui.ts`（`rxwf.workspaceRoot` → 「工作区」）

- [ ] **Step 1: API client**

```typescript
// apps/web/src/api/client.ts
rxwfWorkspace: {
  get: () => apiFetch<{ workspaceRoot: string }>('/api/rxwf/workspace'),
  put: (workspaceRoot: string) =>
    apiFetch<{ ok: boolean }>('/api/rxwf/workspace', {
      method: 'PUT',
      body: JSON.stringify({ workspaceRoot }),
    }),
},
```

- [ ] **Step 2: mount 时 load + 保存按钮**

```typescript
useEffect(() => {
  api.rxwfWorkspace.get().then((r) => setWorkspaceRoot(r.workspaceRoot)).catch(/* */);
}, []);

const saveWorkspace = async () => {
  await api.rxwfWorkspace.put(workspaceRoot.trim());
};
```

- [ ] **Step 3: 手动验证** — 打开 `/settings/rxwf`，输入路径，保存，刷新后仍存在。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): load and save RxWF workspace in settings"
```

---

### Task A3: Skill Run 参数 schema 与面板

**Files:**
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`
- Create: `apps/web/src/features/editor/SkillPathParamField.tsx`
- Modify: `packages/i18n-catalog/src/catalog-ui.ts`

- [ ] **Step 1: 更新 `skillRun` schema 顺序与字段**

按 spec §3.1：

1. `skillSource` label「来源」— options `path` | `registry`（去掉 `inline`）
2. `workspaceRoot` label「工作区」
3. `skillPath` label「Skill」/ registry 用 `SkillRegistrySelect`
4. `prompt` label「Prompt」，placeholder「留空则默认透传上游输入 JSON」
5. `systemPrompt` label「System Prompt」
6. 设置 Tab：`maxIterations` default 20、`timeoutMs` default -1

删除：`skillInline`、`promptType`、`toolIntentMode`、`preferRemote`、`builtinToolsMode`

- [ ] **Step 2: NodeEditorParamsPane**

- `skillSource=path` 显示 `skillPath`；`registry` 显示 `SkillRegistrySelect`（删除 `skillId` 的 `return false`）
- `registry` 时 `workspaceRoot`：GET `/api/rxwf/workspace`，**readOnly**，不写入 `onUpdateNode`
- `path` 时 `workspaceRoot` 可编辑

- [ ] **Step 3: SkillPathParamField**

参考 `OllamaModelParamField.tsx`：`workspaceRoot` 变化 → `api.skills.scan` → `SuggestTextInput` 下拉。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(editor): simplify skillRun params per design spec"
```

---

### Task A4: validate-skill 收敛

**Files:**
- Modify: `packages/workflow/src/validate-skill.ts`
- Modify: `packages/workflow/src/validate-skill.test.ts`
- Modify: `docs/error-codes.md`（E1040 文案）

- [ ] **Step 1: 删除 inline / toolIntent / E1077 校验**

```typescript
// skillSourceConfigured: 仅 path | registry
if (source === 'registry') {
  return typeof parameters.skillId === 'string' && parameters.skillId.trim().length > 0;
}
// 删除 toolIntentMode === 'auto' 块
```

- [ ] **Step 2: 测试**

```bash
pnpm --filter @rxwf/workflow exec vitest run src/validate-skill.test.ts
```

- [ ] **Step 3: 删除 SkillWorkflowSettings / skillToolIntentAuto UI**

- `apps/web/src/features/editor/SkillWorkflowSettings.tsx`
- `WorkflowEditorPage.tsx`、`WorkflowSettingsModal.tsx` 相关 state

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(workflow): validate skillRun path/registry only, drop toolIntent"
```

---

## Phase B — Runner 协议与 Agent Handler

### Task B1: filesystem write + grep

**Files:**
- Modify: `packages/runner-agent/src/skill-tool-handler.ts`
- Create: `packages/runner-agent/src/skill-tool-handler.test.ts`

- [ ] **Step 1: write 测试**

```typescript
it('writes file within scanRoots', async () => {
  const tmp = await mkdtemp(/* */);
  const res = await handleSkillToolInvoke({
    capability: 'skill:filesystem',
    method: 'write',
    args: { path: join(tmp, 'a.txt'), content: 'hello' },
    scanRoots: [tmp],
    /* ... */
  });
  expect(res.status).toBe('success');
});
```

- [ ] **Step 2: 实现 write** — `writeFile`，路径 `resolveWithinRoots` 校验。

- [ ] **Step 3: grep** — P1 可用 `rg` spawn 或 Node 递归读文件简化实现；返回 `{ matches: [...] }`。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(runner-agent): filesystem write and grep in skill-tool-handler"
```

---

### Task B2: shell exec

**Files:**
- Modify: `packages/runner-agent/src/skill-tool-handler.ts`

- [ ] **Step 1: 实现 `shell` / `exec`**

使用 `child_process.exec`（或 `execFile`），`cwd` 限制在 scanRoots，`timeoutMs` 默认 60_000，黑名单子串检查（spec §6.7.5 表）。

- [ ] **Step 2: 替换 E1057 占位**

- [ ] **Step 3: 测试 + Commit**

```bash
git commit -m "feat(runner-agent): implement shell exec for tool.invoke"
```

---

### Task B3: runner-protocol 扩展 web_search（类型）

**Files:**
- Modify: `packages/runner-protocol/src/tool-invoke.ts`
- Modify: `packages/runner-protocol/src/tool-invoke.test.ts`（若无则创建）

- [ ] **Step 1: 扩展类型**

```typescript
export type RunnerToolCapability = 'skill:filesystem' | 'shell' | 'web_search';

export interface WebSearchProviderConfig {
  providerId: 'tavily' | 'brave' | 'bing' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxResults?: number;
  allowedDomains?: string[];
}

export interface RunnerToolInvokeRequest {
  // ...
  scanRoots?: string[];
  providerConfig?: WebSearchProviderConfig;
}
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(runner-protocol): add web_search tool.invoke capability types"
```

---

## Phase C — Web Search 包与 Embedded 路径

### Task C1: 创建 packages/web-search

**Files:**
- Create: `packages/web-search/package.json`
- Create: `packages/web-search/src/index.ts`
- Create: `packages/web-search/src/providers/tavily.ts`
- Create: `packages/web-search/src/providers/brave.ts`
- Create: `packages/web-search/src/providers/bing.ts`
- Create: `packages/web-search/src/providers/custom.ts`
- Create: `packages/web-search/src/create-web-search-port.ts`
- Create: `packages/web-search/src/create-web-search-port.test.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@rxwf/web-search",
  "type": "module",
  "dependencies": {
    "@rxwf/providers-contracts": "workspace:*"
  }
}
```

根 `pnpm-workspace.yaml` 已含 `packages/*`，无需改。

- [ ] **Step 2: Tavily 适配器测试（mock fetch）**

```typescript
it('returns summary from tavily response', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [{ title: 'T', url: 'u', content: 'snippet' }] }),
  });
  const port = createTavilyProvider({ apiKey: 'test' });
  const r = await port.search({ query: 'hello' });
  expect(r.summary).toContain('T');
});
```

- [ ] **Step 3: 实现 brave/bing/custom + 工厂 `createWebSearchPort(providerId, creds)`**

- [ ] **Step 4: 运行测试**

```bash
pnpm --filter @rxwf/web-search test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web-search): add tavily/brave/bing/custom providers"
```

---

### Task C2: 扩展 WebSearchPort 与 dispatchWebSearch

**Files:**
- Modify: `packages/providers/contracts/src/web-search-port.ts`
- Modify: `packages/skill-runtime/src/executor/web-search.ts`
- Modify: `packages/skill-runtime/src/executor/web-search.test.ts`

- [ ] **Step 1: 扩展接口（保留 query 重载或适配层）**

```typescript
export interface WebSearchSearchRequest {
  query: string;
  explanation?: string;
}
export interface WebSearchPort {
  search(request: WebSearchSearchRequest, options?: WebSearchSearchOptions): Promise<WebSearchResult>;
}
```

- [ ] **Step 2: dispatchWebSearch 接受 request 对象 + 配额钩子（可选后续）**

- [ ] **Step 3: vitest run web-search.test.ts**

- [ ] **Step 4: Commit**

---

### Task C3: Settings Web Search API + runtime 注入

**Files:**
- Create: `apps/api/src/routes/web-search-settings.ts`
- Modify: `packages/system-settings/src/keys.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`

- [ ] **Step 1: 设置键** — `webSearch.enabled`、`webSearch.defaultProvider`、`webSearch.defaultCredentialId` 等（JSON 或分列）

- [ ] **Step 2: GET/PUT `/api/settings/web-search`** + POST `/api/settings/web-search/test`

- [ ] **Step 3: create-execution-runtime**

```typescript
import { createWebSearchPort } from '@rxwf/web-search';
// plusDeps.webSearch = await createWebSearchService(ctx);
```

- [ ] **Step 4: 集成测 mock port**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): web search settings and plusDeps.webSearch injection"
```

---

### Task C4: Web Search Settings UI

**Files:**
- Create: `apps/web/src/features/settings/WebSearchSettings.tsx`
- Modify: `apps/web/src/features/settings/settings-nav-config.tsx`

- [ ] **Step 1: Provider 下拉、credential 选择、enabled、测试连接按钮**

- [ ] **Step 2: 手动验证 Settings 页**

- [ ] **Step 3: Commit**

---

## Phase D — Tool 卫星节点与 agent-satellite-tools

### Task D1: workflow 注册卫星类型

**Files:**
- Modify: `packages/workflow/src/agent-satellites.ts`
- Modify: `packages/node-runner/src/node-runner-requirements.ts`
- Modify: `apps/web/src/features/runners/runner-policy-types.ts`

- [ ] **Step 1: SATELLITE_NODE_TYPES 增加**

`toolRead`, `toolWrite`, `toolGrep`, `toolShell`, `toolWebSearch`

- [ ] **Step 2: NODE_RUNNER_REQUIREMENTS + hints**

```typescript
toolRead: { capabilities: ['file'] },
toolWrite: { capabilities: ['file'] },
toolGrep: { capabilities: ['file'] },
toolShell: { capabilities: ['shell'], platforms: ['linux', 'windows', 'macos'] },
toolWebSearch: { capabilities: ['web_search'] },
```

- [ ] **Step 3: 新 tool* 类型不要加入 `RUNNER_OVERRIDE_EXCLUDED_NODE_TYPES`**

- [ ] **Step 4: Commit**

---

### Task D2: 编辑器节点 meta / ports / palette

**Files:**
- Modify: `apps/web/src/features/editor/node-type-meta.ts`
- Modify: `apps/web/src/features/editor/node-port-defs.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `apps/web/src/features/editor/NodePalette.tsx`
- Modify: `packages/i18n-catalog/src/catalog-ui.ts`

- [ ] **Step 1: 五类节点 meta**（category: agent，图标/描述）

- [ ] **Step 2: ports** — 与 `toolMcp` 相同 `resourceOutputs: [{ id: 'ai_tool', ... }]`

- [ ] **Step 3: schema** — 共有 `toolDescription`；`toolWebSearch` 加 `inheritConfig`、`credentialMode`、`provider`、`credentialId`

- [ ] **Step 4: PLUS_NODE_TYPES 并入默认列表（Phase G 前可暂留 featurePlus 门控）**

- [ ] **Step 5: Commit**

---

### Task D3: agent-satellite-tools 模块

**Files:**
- Create: `packages/node-runner/src/executors/agent-satellite-tools.ts`
- Create: `packages/node-runner/src/executors/agent-satellite-tools.test.ts`
- Modify: `packages/ai-runtime/stub/src/index.ts`（ToolDefinition.source 扩展）

- [ ] **Step 1: buildAgentToolDefinitions**

```typescript
export function buildAgentToolDefinitions(toolNodes: WorkflowNode[]): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  for (const node of toolNodes) {
    const description = String(node.parameters.toolDescription ?? '').trim();
    if (!description) throw new AwfError('E2003', `Tool node ${node.name} requires toolDescription`);
    if (node.type === 'toolRead') {
      tools.push({
        name: node.name.trim(),
        description,
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        source: { type: 'filesystem', operation: 'read', toolNodeId: node.id },
      });
    }
    // toolWrite, toolGrep, toolShell, toolWebSearch, 以及委托现有 toolMcp/...
  }
  return tools;
}
```

- [ ] **Step 2: invokeAgentTool** — filesystem/shell 分支调用 `runnerGateway.invokeTool` 或 embedded handler；scanRoots 从 ctx 解析。

- [ ] **Step 3: 单测 mock runnerGateway**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(node-runner): agent-satellite-tools register and invoke"
```

---

### Task D4: run-ai-agent-node 接入

**Files:**
- Modify: `packages/node-runner/src/executors/run-ai-agent-node.ts`

- [ ] **Step 1: 用 `buildAgentToolDefinitions` + `invokeAgentTool` 替换内联 tool 循环（或合并五类新 type 进现有循环）**

- [ ] **Step 2: `ai-agent.test.ts` 增加 toolRead 用例**

- [ ] **Step 3: build + test**

```bash
pnpm --filter @rxwf/node-runner build
pnpm --filter @rxwf/node-runner test
```

- [ ] **Step 4: Commit**

---

## Phase E — skill-run 去 Builtin

### Task E1: skill-run 执行语义

**Files:**
- Modify: `packages/node-runner/src/executors/skill-run.ts`
- Modify: `packages/node-runner/src/executors/skill-run.test.ts`
- Modify: `packages/skill-runtime/src/executor/skill-executor.ts`

- [ ] **Step 1: buildUserMessage — 去掉 promptType**

```typescript
function buildUserMessage(prompt: string, inputItems: WorkflowItem[]): string {
  if (prompt.trim()) return prompt;
  if (inputItems.length === 0) return 'Execute the skill.';
  return JSON.stringify(inputItems.map((i) => i.json));
}
```

- [ ] **Step 2: systemPrompt 合并顺序**

```typescript
const parts = [
  getSkillBody(skill),
  intentAppendix, // 仅 satellites.tools.length > 0 时 matchToolIntents
  ruleAppendix,
  userSystemPrompt, // params.systemPrompt 解析后，trim 非空
].filter(Boolean);
const systemPromptOverride = parts.join('\n\n');
```

- [ ] **Step 3: registry workspace**

```typescript
if (skillSource === 'registry') {
  workspaceRoot = await deps.getRxwfWorkspaceRoot?.() ?? '';
  if (!workspaceRoot.trim()) throw new AwfError('E1040', 'RxWF workspace not configured');
}
```

- [ ] **Step 4: 删除 onBuiltinInvoke / mergeBuiltinTools / preferRemote / webSearchEnabled**

- [ ] **Step 5: 接入 buildAgentToolDefinitions + invokeAgentTool**

- [ ] **Step 6: maxIterations ?? 20；resolveSkillRunTimeoutMs → runAgent**

- [ ] **Step 7: skill-run.test.ts 更新**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(skill-run): remove builtin tools, wire satellite tools and new prompt model"
```

---

### Task E2: AiRuntime timeoutMs

**Files:**
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`
- Modify: `packages/node-runner/src/executors/resolve-skill-run-timeout.ts`（新建，仿 `resolve-code-sandbox-timeout.ts`）

- [ ] **Step 1: `<= 0` → 不设 AbortSignal / 无超时**

- [ ] **Step 2: langchain-runtime.test.ts 验证**

- [ ] **Step 3: Commit**

---

### Task E3: executeSkill 精简

**Files:**
- Modify: `packages/skill-runtime/src/executor/skill-executor.ts`
- Deprecate/remove: `builtin-tools.ts` 生产调用（测试可保留）

- [ ] **Step 1: tools 列表仅来自 `opts.satelliteTools`（由 node-runner 传入）**

- [ ] **Step 2: invokeTool 全部委托外部 `invokeAgentTool`**

- [ ] **Step 3: Commit**

---

## Phase F — Web Search 远程 Runner

### Task F1: handleWebSearchInvoke

**Files:**
- Create: `packages/runner-agent/src/web-search-tool-handler.ts`
- Modify: `packages/runner-agent/src/skill-tool-handler.ts`（或统一 dispatch）
- Modify: `packages/runner-agent/src/extension-host.ts`（capabilities + `web_search`）

- [ ] **Step 1: 从 `providerConfig` + runner-local credential 解析 apiKey**

- [ ] **Step 2: 调用 `@rxwf/web-search` createWebSearchPort**

- [ ] **Step 3: extension-host CORE_CAPABILITIES 增加 `web_search`**

- [ ] **Step 4: 单测**

- [ ] **Step 5: Commit**

---

### Task F2: agent-satellite-tools 远程 web_search 分支

**Files:**
- Modify: `packages/node-runner/src/executors/agent-satellite-tools.ts`

- [ ] **Step 1: resolveRunner(toolNode) → embedded 用 deps.webSearch；agent 用 invokeTool**

```typescript
const res = await runnerGateway.invokeTool(runnerId, {
  capability: 'web_search',
  method: 'search',
  args: { query },
  providerConfig: resolvedProviderConfig,
  timeoutMs,
});
return String(res.result?.summary ?? '');
```

- [ ] **Step 2: platform credential relay** — 控制面解密 credentialId 填入 `providerConfig.apiKey`

- [ ] **Step 3: 集成测** — mock gateway + Agent handler

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(skill-run): web_search via remote runner tool.invoke"
```

---

## Phase G — 去 Plus + Runner capabilities

### Task G1: 移除 featurePlus 门控

**Files:**
- Modify: `apps/api/src/app-context.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`
- Modify: `apps/web/src/features/editor/NodePalette.tsx`
- Modify: `packages/i18n-catalog`（去掉「Plus」文案）

- [ ] **Step 1: 始终 `registerPlusExecutors`**

- [ ] **Step 2: 删除 `featurePlus` prop 传递与 palette 隐藏逻辑**

- [ ] **Step 3: 集成测去掉 `featurePlus: true` 传参（改为默认）**

- [ ] **Step 4: Commit**

---

### Task G2: Runner 按 capabilities 调度

**Files:**
- Modify: `apps/web/src/features/runners/runner-policy-types.ts`（淡化 REMOTE_V11 提示）
- Modify: `packages/node-runner/src/facade/node-runner-facade.ts`（文档化 Tool invoke 不走静默回退）
- Modify: `docs/runner-extension-packaging-deployment.md`

- [ ] **Step 1: UI 用 `getNodeRunnerRequirementHints` 替代白名单文案**

- [ ] **Step 2: 插件 `registerNodeRunnerRequirements` 示例**

- [ ] **Step 3: Commit**

---

## 文档与收尾

### Task DOC1: error-codes + help

**Files:**
- Modify: `docs/error-codes.md`（E1073、E1074；更新 E1040）
- Create: `docs/help/zh/nodes/skillRun.md`（更新）
- Create: `docs/help/zh/nodes/toolWebSearch.md`

- [ ] **Step 1: 同步错误码表**

- [ ] **Step 2: Help 接线示例图（Skill + aiChatModel + toolRead + toolWebSearch）**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: skill run simplify help and error codes"
```

---

### Task DOC2: 全量验证

- [ ] **Step 1: 单元测试**

```bash
pnpm test
```

- [ ] **Step 2: 关键包 build**

```bash
pnpm --filter @rxwf/node-runner build
pnpm --filter @rxwf/web-search build
pnpm --filter @rxwf/api build
```

- [ ] **Step 3: 手动冒烟**

1. Settings → RxWF：保存工作区
2. Settings → Web Search：配置 Tavily + 测试连接
3. 编辑器：skillRun(path) + aiChatModel + toolRead + toolWebSearch
4. 执行工作流，观察 ReAct 调工具与提前结束（非固定 20 轮）

---

## Spec 覆盖自检

| Spec 章节 | Task |
|-----------|------|
| §3 参数面板 | A3 |
| §4 执行语义 | E1, E2 |
| §5 Tool 卫星 | B, D, E |
| §6 Web Search | C, F |
| §6.15 远程 Runner | B3, F |
| §7 RxWF 工作区 | A1, A2 |
| §8 去 Plus | G1 |
| §9 Runner capabilities | G2, D1 |
| §11 迁移 | A4（strip 旧字段可在编辑器保存时删除） |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-06 | 初稿：基于 2026-06-03-skill-run-simplify-design spec |
