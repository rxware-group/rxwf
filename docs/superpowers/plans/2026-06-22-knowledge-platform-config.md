# 知识库平台集中配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将知识库 Embedding 与 RAG 默认配置收敛到 `system_settings.knowledge.config` 与 **设置 → 知识库** 页面；方案 A（平台统一 Embedding 通道）；移除知识库对 `ollamaUrl` / `RXWF_OLLAMA_*` 的依赖；embedding 变更强制 reindex 提醒。

**Architecture:** 在 `@rxwf/knowledge` 增加 `platform-config` + `createEmbeddingProvider`；`SETTING_KEYS.knowledgeConfig` 存 JSON（模式对齐 `webSearch.config`）；API `knowledge-settings.ts` + 扩展 `knowledge-bases.ts` reindex；`createKnowledgeRuntime` 读 platform config；Web `KnowledgeSettingsPage` + 知识库详情 per-KB 表单。

**Tech Stack:** TypeScript、Fastify 5、Vitest、React 19、Drizzle、`@rxwf/system-settings`、`@rxwf/knowledge`、`@rxwf/model-catalog`。

**设计依据:** [2026-06-22-knowledge-platform-config-design.md](../specs/2026-06-22-knowledge-platform-config-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

**不做向前兼容:** 部署后 Admin 须在 `/settings/knowledge` 完成首次配置；现有集成测试须改为注入 `createEmbeddings` 或 seed `knowledge.config`。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/knowledge/src/platform-config.ts` | 类型、parse、serialize、defaults、`isKnowledgePlatformConfigured()` |
| `packages/knowledge/src/platform-config.test.ts` | 配置解析单元测试 |
| `packages/knowledge/src/openai-embeddings.ts` | OpenAI 兼容 `/embeddings` |
| `packages/knowledge/src/openai-embeddings.test.ts` | mock fetch 测试 |
| `packages/knowledge/src/create-embedding-provider.ts` | 按 platform + model 工厂 |
| `packages/knowledge/src/knowledge-service.ts` | `createBase` 用 platform defaults；index/query 用 `effectiveEmbeddingModel` |
| `packages/system-settings/src/keys.ts` | `knowledgeConfig: 'knowledge.config'` |
| `apps/api/src/knowledge/load-platform-config.ts` | 从 settings 加载 + 缓存策略（每请求读） |
| `apps/api/src/knowledge/create-knowledge-runtime.ts` | 移除 `ollamaBaseUrl`；接 platform config |
| `apps/api/src/routes/knowledge-settings.ts` | GET/PUT/test-embedding |
| `apps/api/src/routes/knowledge-settings.test.ts` | API 测试 |
| `apps/api/src/routes/knowledge-bases.ts` | configured 门禁；`reindex-all` |
| `apps/api/src/app-context.ts` | 接线 loadPlatformConfig |
| `apps/web/src/features/settings/KnowledgeSettingsPage.tsx` | Admin 编辑 / 非 Admin 只读 |
| `apps/web/src/features/settings/settings-app-routes.tsx` | 路由 |
| `apps/web/src/features/settings/settings-nav-config.tsx` | 导航项 |
| `apps/web/src/features/knowledge/KnowledgeDetailPage.tsx` | per-KB 参数 + reindex Modal |
| `apps/web/src/api/client.ts` | `settings.getKnowledge` / `updateKnowledge` |
| `packages/i18n-catalog/src/catalog-ui-ext.ts` | `settings.nav.knowledge`、`settings.knowledge.*` |
| `packages/chat/src/chat-service.ts` | M3：`rag.defaultModelId` fallback |
| `packages/node-runner/src/executors/rag.ts` | M3：`usePlatformRagModel` |
| `docs/error-codes.md` | E1004 知识库未配置文案 |

---

## TDD 强制流程

1. **RED** — 仅提交测试；`pnpm --filter <pkg> test` 必须失败且原因符合预期
2. **GREEN** — 最小实现
3. **REFACTOR** — 全绿后整理
4. 每 Task 独立 commit（用户请求时再提交）

---

## 验收门禁（对应 spec AC-K*）

| AC | 验证命令 / 场景 |
|----|-----------------|
| AC-K1 | E2E 或手动：admin 保存 `/settings/knowledge`；member GET 只读 |
| AC-K2 | `knowledge-bases.test.ts`：无 config 时 POST documents → 400 E1004 |
| AC-K3 | 创建 KB 继承 defaults；详情 PATCH embeddingModel |
| AC-K4 | 设置页 embedding 变更 Modal + `POST reindex-all` |
| AC-K5 | 详情页 embeddingModel 变更 Modal + `POST :id/reindex-all` |
| AC-K6 | M2：`test-embedding` openai-compatible |
| AC-K7 | M3：`chat-rag.integration.test.ts` 无 session.modelId |
| AC-K8 | grep 知识库路径无 `ollamaBaseUrl` / `getOllamaDefaults` |

---

# 里程碑 M1 — 配置存储 + API + 运行时 + 设置页 + 详情页

## Task 1: `platform-config` 模块

**Files:**
- Create: `packages/knowledge/src/platform-config.ts`
- Create: `packages/knowledge/src/platform-config.test.ts`
- Modify: `packages/knowledge/src/index.ts`

- [x] **Step 1: 写失败测试** — parse 空/null → defaults 且 `configured: false`；合法 JSON → `isKnowledgePlatformConfigured()` true/false 边界

- [x] **Step 2:** 实现 `KnowledgePlatformConfig`、`DEFAULT_KNOWLEDGE_PLATFORM_CONFIG`、`parseKnowledgePlatformConfig`、`serializeKnowledgePlatformConfig`、`isKnowledgePlatformConfigured(config, opts?: { resolveModelRef? })`

- [x] **Step 3:** 实现 `effectiveEmbeddingModel(kb, platform)` helper

- [x] **Step 4:** `pnpm --filter @rxwf/knowledge test -- platform-config` PASS

- [x] **Step 5:** Commit — `feat(knowledge): platform config parse and validation`

---

## Task 2: `SETTING_KEYS.knowledgeConfig`

**Files:**
- Modify: `packages/system-settings/src/keys.ts`
- Modify: `packages/system-settings/src/index.ts`（若需导出）

- [x] **Step 1:** 添加 `knowledgeConfig: 'knowledge.config'`

- [x] **Step 2:** Commit — `feat(system-settings): knowledge.config key`

---

## Task 3: `load-platform-config` + runtime 去 ollamaUrl

**Files:**
- Create: `apps/api/src/knowledge/load-platform-config.ts`
- Modify: `apps/api/src/knowledge/create-knowledge-runtime.ts`
- Modify: `apps/api/src/app-context.ts`
- Modify: `apps/api/src/integration/chat-rag*.integration.test.ts`（seed config 或 mock）

- [x] **Step 1: 写失败测试** — `loadKnowledgePlatformConfig(settingsService)` 从 mock settings 返回 parsed config

- [x] **Step 2:** `createKnowledgeRuntime` 签名改为 `{ platformConfig, getPlatformConfig, credentialResolver?, createEmbeddings? }`；删除 `ollamaBaseUrl`

- [x] **Step 3:** `createKnowledgeService` 的 `createEmbeddings` 默认 `(model) => createEmbeddingProvider(getPlatformConfig(), model, { credentialResolver })`（Task 4 实现 factory 前先 stub）

- [x] **Step 4:** `app-context.ts` 传入 `loadKnowledgePlatformConfig(settingsService)`；**不再**传 `initialOllama.ollamaUrl` 给 knowledge

- [x] **Step 5:** 修复现有 knowledge 相关测试（注入 `createEmbeddings` 或在 beforeEach seed `knowledge.config` JSON）

- [x] **Step 6:** `pnpm --filter api exec vitest run src/integration/chat-rag` PASS

- [x] **Step 7:** Commit — `refactor(api): knowledge runtime reads platform config only`

---

## Task 4: `createEmbeddingProvider`（Ollama 路径）

**Files:**
- Create: `packages/knowledge/src/create-embedding-provider.ts`
- Create: `packages/knowledge/src/create-embedding-provider.test.ts`
- Modify: `packages/knowledge/src/knowledge-service.ts`

- [x] **Step 1: 写失败测试** — provider `ollama` 调用 `/api/embeddings`；`openai-compatible` 无 credential 抛错

- [x] **Step 2:** 实现 `createEmbeddingProvider(platform, model, deps)`，Ollama 分支复用 `createOllamaEmbeddings`

- [x] **Step 3:** `KnowledgeService.createBase` — 若传入 `platformDefaults`，用其填充 chunk/topK/threshold/hybrid/embeddingModel

- [x] **Step 4:** `indexDocument` / `runSearch` 使用 `effectiveEmbeddingModel(kb, platform)` 而非仅 `kb.embeddingModel`

- [x] **Step 5:** `pnpm --filter @rxwf/knowledge test` PASS

- [x] **Step 6:** Commit — `feat(knowledge): embedding provider factory and platform defaults in createBase`

---

## Task 5: API `knowledge-settings` routes

**Files:**
- Create: `apps/api/src/routes/knowledge-settings.ts`
- Create: `apps/api/src/routes/knowledge-settings.test.ts`
- Modify: `apps/api/src/bootstrap.ts` 或 `bootstrap-plus.ts` 注册路由

- [x] **Step 1: 写失败测试**
  - Admin `PUT /api/settings/knowledge` 保存合法 config → 200，`configured: true`
  - Member `GET` → 200 只读，无 credential 明文
  - Member `PUT` → 403
  - 无效 config（缺 `rag.defaultModelId`）→ 400

- [x] **Step 2:** 实现 `normalizeKnowledgePlatformConfig(body, catalogService)` 校验 `defaultModelId` 可 resolve

- [x] **Step 3:** `PUT` 返回 `{ ok, embeddingChanged: boolean }`（对比旧 config 四元组）

- [x] **Step 4:** `GET` 附带 `status: { profile, jobQueue: 'lite' | 'bullmq' }` 从 `AppContext`

- [x] **Step 5:** `pnpm --filter api exec vitest run src/routes/knowledge-settings.test.ts` PASS

- [x] **Step 6:** Commit — `feat(api): knowledge platform settings REST`

---

## Task 6: 知识库 configured 门禁 + createBase 默认值

**Files:**
- Modify: `apps/api/src/routes/knowledge-bases.ts`
- Modify: `apps/api/src/routes/knowledge-bases.test.ts`

- [x] **Step 1: 写失败测试** — 无 configured 时 `POST /knowledge-bases`、`POST .../documents`、`POST .../query` → 400 E1004

- [x] **Step 2:** 注入 `getPlatformConfig` 到 routes；`assertKnowledgeConfigured()` helper

- [x] **Step 3:** `POST /knowledge-bases` 从 platform `defaults` + `embedding.defaultModel` 填充 body 缺省项

- [x] **Step 4:** `PATCH` 允许 `embeddingModel`, `chunkSize`, `chunkOverlap`, `topK`, `similarityThreshold`, `hybridSearchEnabled`；忽略非法 embedding provider 字段

- [x] **Step 5:** 测试 PASS

- [x] **Step 6:** Commit — `feat(api): knowledge base routes require platform config`

---

## Task 7: Web API client + i18n

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `packages/i18n-catalog/src/catalog-ui-ext.ts`
- Modify: `packages/i18n-catalog/src/catalog.ts`（英文 fallback 若需要）

- [x] **Step 1:** 添加 `KnowledgePlatformConfigSnapshot` 类型与 `api.settings.getKnowledge()` / `updateKnowledge()` / `testKnowledgeEmbedding()`

- [x] **Step 2:** i18n keys：`settings.nav.knowledge`、`settings.knowledge.lead`、`settings.knowledge.embedding.*`、`settings.knowledge.rag.*`、`settings.knowledge.defaults.*`、`settings.knowledge.readOnlyHint`、`settings.knowledge.reindexWarning.*`

- [x] **Step 3:** Commit — `feat(web): knowledge settings API client and i18n`

---

## Task 8: `KnowledgeSettingsPage`

**Files:**
- Create: `apps/web/src/features/settings/KnowledgeSettingsPage.tsx`
- Modify: `apps/web/src/features/settings/settings-app-routes.tsx`
- Modify: `apps/web/src/features/settings/settings-nav-config.tsx`

- [x] **Step 1:** 路由 `/settings/knowledge`；导航项（models 与 web-search 之间）

- [x] **Step 2:** Admin：表单三块（Embedding / RAG / Defaults）+ 状态区；Save 按钮

- [x] **Step 3:** RAG 模型下拉：`api.models.list({ capability: 'chat' })` 过滤 enabled

- [x] **Step 4:** 非 Admin：`user.role !== 'admin'` 时禁用输入，显示 `readOnlyHint`

- [x] **Step 5:** embedding 四元组变更时 Save → Modal（仅保存 / 保存并 reindex — reindex 按钮 M2 接 API，M1 可先 disabled + TODO）

- [x] **Step 6:** 手动验证：admin 保存后创建知识库成功

- [x] **Step 7:** Commit — `feat(web): knowledge platform settings page`

---

## Task 9: 知识库详情页 per-KB 参数

**Files:**
- Modify: `apps/web/src/features/knowledge/KnowledgeDetailPage.tsx`
- Modify: `apps/web/src/api/client.ts` — `knowledgeBases.patch` 补全字段

- [x] **Step 1:** 加载 `api.settings.getKnowledge()` 显示继承默认 placeholder

- [x] **Step 2:** 可编辑区：embeddingModel（空=继承）、chunkSize、chunkOverlap、topK、similarityThreshold；hybrid 保留

- [x] **Step 3:** 「保存检索参数」按钮 → `PATCH /api/knowledge-bases/:id`

- [x] **Step 4:** embeddingModel 变更 Modal（M2 接 `reindex-all`；M1 文案 + 手动 reindex 引导）

- [x] **Step 5:** Commit — `feat(web): knowledge detail per-KB RAG parameters`

---

## Task 10: M1 集成测试与文档

**Files:**
- Create: `apps/api/src/integration/knowledge-platform-config.integration.test.ts`
- Modify: `docs/error-codes.md`
- Modify: `docs/superpowers/specs/2026-06-22-knowledge-platform-config-design.md` — 状态改为 **Planned**

- [x] **Step 1:** 集成测试：seed config → create KB → upload mock doc（mockEmbeddings）→ query

- [x] **Step 2:** E1004 文案写入 `error-codes.md`

- [x] **Step 3:** `pnpm --filter api test` 相关套件 PASS

- [x] **Step 4:** Commit — `test(api): knowledge platform config integration`

---

# 里程碑 M2 — OpenAI Embedding + Reindex API + Modal 闭环

## Task 11: `createOpenAiCompatibleEmbeddings`

**Files:**
- Create: `packages/knowledge/src/openai-embeddings.ts`
- Create: `packages/knowledge/src/openai-embeddings.test.ts`
- Modify: `packages/knowledge/src/create-embedding-provider.ts`

- [x] **Step 1: 写失败测试** — mock `POST {baseUrl}/embeddings` 返回 `{ data: [{ embedding: number[] }] }`

- [x] **Step 2:** 实现 Bearer apiKey from credentialResolver

- [x] **Step 3:** `create-embedding-provider` openai 分支接通

- [x] **Step 4:** Commit — `feat(knowledge): openai-compatible embeddings`

---

## Task 12: `POST /api/settings/knowledge/test-embedding`

**Files:**
- Modify: `apps/api/src/routes/knowledge-settings.ts`
- Modify: `apps/api/src/routes/knowledge-settings.test.ts`

- [x] **Step 1: 写失败测试** — admin POST 草稿 config → `{ ok: true, dimensions, latencyMs }`；失败 → E3002

- [x] **Step 2:** 成功后可选写回 `embedding.dimensions` 到 persisted config（query param `persistDimensions=true` 或 PUT 内嵌）

- [x] **Step 3:** 设置页「测试连接」按钮接通

- [x] **Step 4:** Commit — `feat(api): test knowledge embedding endpoint`

---

## Task 13: Reindex API

**Files:**
- Modify: `apps/api/src/routes/knowledge-bases.ts`
- Modify: `apps/api/src/routes/knowledge-bases.test.ts`

- [x] **Step 1: 写失败测试**
  - Admin `POST /api/knowledge-bases/reindex-all` → 对所有文档 enqueue
  - Editor `POST /api/knowledge-bases/:id/reindex-all` → 单库

- [x] **Step 2:** 实现：遍历 documents，`status in (indexed, failed)` → `enqueueIndexJob`

- [x] **Step 3:** 设置页 Modal「保存并全库 reindex」→ PUT 后 POST reindex-all

- [x] **Step 4:** 详情页 Modal「保存并 reindex 本库」→ PATCH 后 POST `:id/reindex-all`

- [x] **Step 5:** persistent banner：platform embeddingChanged 且存在 indexed 文档时显示警告（可选 localStorage flag）

- [x] **Step 6:** Commit — `feat(api): knowledge reindex-all endpoints`

---

# 里程碑 M3 — RAG 默认 modelId 消费

## Task 14: Chat / Bot 默认 `rag.defaultModelId`

**Files:**
- Modify: `packages/chat/src/chat-service.ts`
- Modify: `packages/chat-bots/src/chat-bot-service.ts`（或 resolve 路径）
- Modify: `apps/api/src/bootstrap-plus.ts` — 注入 `getKnowledgePlatformConfig`
- Modify: `apps/api/src/integration/chat-rag.integration.test.ts`

- [x] **Step 1: 写失败测试** — session 无 modelId、platform 有 defaultModelId → streamRag 使用 catalog resolve

- [x] **Step 2:** `resolveModel` 增加 fallback：`catalog.getDefaultChatModelId()` 之后尝试 `platform.rag.defaultModelId`

- [x] **Step 3:** Bot 创建/发布默认 `modelId` 空时用 platform

- [x] **Step 4:** Commit — `feat(chat): RAG default model from knowledge platform config`

---

## Task 15: `ragAnswer` 节点 `usePlatformRagModel`

**Files:**
- Modify: `packages/node-runner/src/executors/rag.ts`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`
- Modify: `packages/node-runner/src/executors/rag.test.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts` — 注入 platform config getter

- [x] **Step 1: 写失败测试** — `usePlatformRagModel: true` 且节点无 model → 使用 platform defaultModelId

- [x] **Step 2:** 参数 schema 默认 `usePlatformRagModel: true`

- [x] **Step 3:** Commit — `feat(node-runner): ragAnswer platform RAG model default`

---

## Task 16: E2E + 帮助文档

**Files:**
- Create: `apps/web/e2e/settings/knowledge-settings.spec.ts`（可选）
- Create: `docs/help/zh/settings/knowledge.md`
- Modify: `docs/INDEX.md`

- [x] **Step 1:** E2E：admin 配置 → 创建知识库 → 命中测试（mock 或 test env）

- [x] **Step 2:** 帮助页：首次配置步骤、reindex 说明、与模型目录关系

- [x] **Step 3:** spec §16 文档清单勾选

- [x] **Step 4:** Commit — `docs: knowledge platform config help`

---

## 依赖顺序

```text
M1: Task 1 → 2 → 4 → 3 → 5 → 6 → 7 → 8 → 9 → 10
M2: Task 11 → 12 → 13
M3: Task 14 → 15 → 16
```

Task 3 与 4 可并行开发（3 先 stub factory）；合并前须完成 Task 4。

---

## 风险与注意事项

| 风险 | 缓解 |
|------|------|
| 现有环境无 config 导致知识库不可用 | 部署说明 + 首次 admin 引导；集成测试 seed |
| pgvector 768 维与 embedding 模型不一致 | 测试连接写 dimensions；设置页警告 |
| 全库 reindex 负载 | 复用 `knowledge.index` 队列；UI 说明耗时 |
| 与 `RXWF_OLLAMA_URL` 文档冲突 | M1 Task 10 更新 error-codes 与 help |

---

## 开放项闭合（实现时采用 spec 默认）

- O1: M1 embedding 模型 **文本输入**
- O2: `usePlatformRagModel` 默认 **true**
- O3: reindex **不新增** job kind
