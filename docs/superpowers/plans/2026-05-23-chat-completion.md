# Chat 完整产品补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Chat 从 MVP 补齐为 UX §3.6 完整产品：模型目录、真流式对话 UI、RAG 交互、Bot 多平台发布、编辑器侧栏、Standard 仓储。

**Architecture:** 纵向切片 M1→M4；新增 `@rxwf/model-catalog` 与 `@rxwf/chat-bots`；扩展 `@rxwf/chat` + Lite/Standard providers；前端共享 `features/chat/components`；SSE 协议向后兼容并新增 `aborted`。

**Tech Stack:** TypeScript、Fastify 5、Drizzle、Vitest、React 19、Vite、LangChain `@langchain/ollama` / `@langchain/openai`。

**设计依据:** [2026-05-23-chat-completion-design.md](../specs/2026-05-23-chat-completion-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/model-catalog/` | 模型 provider/model CRUD、Ollama sync、resolve ModelRef |
| `packages/chat-bots/` | Bot 实体、publish 快照、渠道、API Key |
| `packages/chat/src/*` | 扩展 deleteSession、modelId、regenerate、abort signal |
| `packages/ai-runtime/src/langchain-runtime.ts` | `model.stream()` 真 token |
| `packages/providers/lite/src/drizzle/schema.ts` | 新表 + chat 列扩展 |
| `packages/providers/lite/src/model-catalog-repository.ts` | Lite 模型目录 |
| `packages/providers/lite/src/chat-bots-repository.ts` | Lite Bot 仓储 |
| `packages/providers/standard/src/repositories/*` | M4 PG 实现 |
| `apps/api/src/routes/models.ts` | 模型目录 API |
| `apps/api/src/routes/chat-bots.ts` | Bot CRUD/发布 |
| `apps/api/src/routes/public-chat.ts` | Embed + 公开 API |
| `apps/api/src/bootstrap-plus.ts` | 装配 catalog + bots |
| `apps/web/src/features/chat/` | ChatPage 重写 + Bot 页 + Embed |
| `apps/web/src/features/chat/components/` | 共享消息/侧栏/Composer |
| `apps/web/src/features/chat/hooks/useChatStream.ts` | SSE + Abort |
| `apps/web/src/features/settings/ModelCatalogPage.tsx` | 模型管理 |
| `apps/web/src/features/editor/EditorChatSidebar.tsx` | M4 编辑器侧栏 |
| `apps/api/src/integration/chat-m1.integration.test.ts` | M1 集成 |
| `apps/api/src/integration/chat-rag.integration.test.ts` | M2 AC-19 |
| `apps/api/src/integration/chat-bots.integration.test.ts` | M3 三渠道 |

---

## TDD 强制流程

1. **RED** — 仅提交测试；`pnpm --filter <pkg> test` 必须失败且原因符合预期
2. **GREEN** — 最小实现
3. **REFACTOR** — 全绿后整理
4. 每 Task 独立 commit

---

# 里程碑 M1 — 对话核心

## Task 1: `@rxwf/model-catalog` 脚手架

**Files:**
- Create: `packages/model-catalog/package.json`
- Create: `packages/model-catalog/tsconfig.json`
- Create: `packages/model-catalog/vitest.config.ts`
- Create: `packages/model-catalog/src/index.ts`
- Create: `packages/model-catalog/src/types.ts`
- Create: `packages/model-catalog/src/model-catalog-repository.ts`

- [ ] **Step 1:** 创建 `package.json`（参照 `packages/knowledge/package.json`，name `@rxwf/model-catalog`）

- [ ] **Step 2:** 在 `types.ts` 定义：

```typescript
export type ModelProviderKind = 'ollama' | 'openai-compatible';
export type ModelHealthStatus = 'ok' | 'error' | 'unknown';

export interface ModelProviderRecord {
  id: string;
  name: string;
  kind: ModelProviderKind;
  baseUrl: string;
  credentialId: string | null;
  enabled: boolean;
  healthStatus: ModelHealthStatus;
  lastHealthAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  modelName: string;
  capabilities: string[];
  isDefaultChat: boolean;
  enabled: boolean;
  source: 'manual' | 'discovered';
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelCatalogRepository {
  listProviders(): Promise<ModelProviderRecord[]>;
  createProvider(input: Omit<ModelProviderRecord, 'createdAt' | 'updatedAt' | 'healthStatus' | 'lastHealthAt'>): Promise<ModelProviderRecord>;
  listModels(filter?: { capability?: string }): Promise<ModelRecord[]>;
  findModelById(id: string): Promise<ModelRecord | null>;
  findProviderById(id: string): Promise<ModelProviderRecord | null>;
  upsertDiscoveredModels(providerId: string, models: Array<{ modelName: string; capabilities: string[] }>): Promise<void>;
  setDefaultChatModel(modelId: string): Promise<void>;
}
```

- [ ] **Step 3:** 根目录 `pnpm install`

- [ ] **Step 4:** Commit — `feat(model-catalog): scaffold package and repository interface`

---

## Task 2: Lite schema — model_providers / models

**Files:**
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Create: `packages/providers/lite/src/model-catalog-repository.ts`
- Create: `packages/providers/lite/src/model-catalog-repository.test.ts`
- Modify: `packages/providers/lite/src/index.ts`

- [ ] **Step 1: 写失败测试** `model-catalog-repository.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-db.js'; // 沿用 lite 现有 test db helper
import { createLiteModelCatalogRepository } from './model-catalog-repository.js';

describe('createLiteModelCatalogRepository', () => {
  it('creates provider and model, lists by capability chat', async () => {
    const db = await createTestDb();
    const repo = createLiteModelCatalogRepository(db);
    const p = await repo.createProvider({
      id: 'p1', name: 'Ollama', kind: 'ollama', baseUrl: 'http://127.0.0.1:11434',
      credentialId: null, enabled: true,
    });
    // insert model via repo method addModel (implement in repository)
    const models = await repo.listModels({ capability: 'chat' });
    expect(models.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2:** 运行 `pnpm --filter @rxwf/providers-lite test -- src/model-catalog-repository.test.ts` — 预期 FAIL

- [ ] **Step 3:** 在 `schema.ts` 添加 `modelProviders`、`models` 表（字段见 design §2.3）

- [ ] **Step 4:** `apply-schema.ts` 增量 ALTER + 种子：从 env 默认 ollama URL 插入 provider + default model

- [ ] **Step 5:** 实现 `createLiteModelCatalogRepository`

- [ ] **Step 6:** 测试 PASS

- [ ] **Step 7:** Commit — `feat(providers-lite): model catalog schema and repository`

---

## Task 3: model-catalog 服务 — resolve ModelRef + Ollama sync

**Files:**
- Create: `packages/model-catalog/src/model-catalog-service.ts`
- Create: `packages/model-catalog/src/model-catalog-service.test.ts`
- Create: `packages/model-catalog/src/ollama-sync.ts`
- Modify: `packages/model-catalog/src/index.ts`

- [ ] **Step 1: 写失败测试** — `resolveModelRef(modelId)` 返回 `{ provider, model, baseUrl, credentialId }`；disabled model 抛 `E3001`

- [ ] **Step 2:** 实现 `createModelCatalogService({ repo, fetchFn? })` 含 `syncOllama(providerId)`

- [ ] **Step 3:** `ollama-sync.ts` — GET `{baseUrl}/api/tags` 解析 models

- [ ] **Step 4:** `pnpm --filter @rxwf/model-catalog test` PASS

- [ ] **Step 5:** Commit — `feat(model-catalog): service with ModelRef resolution and Ollama sync`

---

## Task 4: API routes/models.ts

**Files:**
- Create: `apps/api/src/routes/models.ts`
- Create: `apps/api/src/routes/models.test.ts`
- Modify: `apps/api/src/bootstrap-plus.ts`
- Modify: `apps/api/package.json`（依赖 model-catalog）

- [ ] **Step 1: 写失败测试** — admin 创建 provider；登录用户 `GET /api/models?capability=chat`

- [ ] **Step 2:** 实现 `registerModelRoutes(app, authPreHandler, catalogService, { requireAdmin })`

- [ ] **Step 3:** `bootstrap-plus.ts` 装配 + 启动时 seed default provider（若空）

- [ ] **Step 4:** `pnpm --filter api exec vitest run src/routes/models.test.ts` PASS

- [ ] **Step 5:** Commit — `feat(api): model catalog REST routes`

---

## Task 5: AiRuntime 真 token stream

**Files:**
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`
- Modify: `packages/ai-runtime/src/langchain-runtime.test.ts`

- [ ] **Step 1: 写失败测试** — mock `BaseChatModel.stream` 返回 2 chunks；generator yield 2 tokens

```typescript
it('chat yields multiple tokens from model.stream', async () => {
  const runtime = createLangChainAiRuntime({
    createChatModel: () => ({
      stream: async function* () {
        yield { content: 'Hello' };
        yield { content: ' world' };
      },
    }) as unknown as BaseChatModel,
  });
  const tokens: string[] = [];
  for await (const t of runtime.chat([{ role: 'user', content: 'hi' }])) tokens.push(t);
  expect(tokens).toEqual(['Hello', ' world']);
});
```

- [ ] **Step 2:** 将 `invoke` 改为 `for await (const chunk of model.stream(lcMessages))` 并 map content

- [ ] **Step 3:** 支持 `opts.signal`（AbortSignal）传入 stream 选项（LangChain 支持则传，否则 loop 内检查 `signal.aborted`）

- [ ] **Step 4:** `pnpm --filter @rxwf/ai-runtime test` PASS

- [ ] **Step 5:** Commit — `feat(ai-runtime): true token streaming in chat()`

---

## Task 6: 扩展 chat_sessions + deleteSession

**Files:**
- Modify: `packages/chat/src/chat-repository.ts`
- Modify: `packages/chat/src/chat-service.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Modify: `packages/providers/lite/src/chat-repository.ts`
- Modify: `packages/chat/src/chat-service.test.ts`

- [ ] **Step 1: 写失败测试** — `deleteSession` 软删除；`updateSession` 支持 `modelId`；`streamReply` 使用 catalog 解析 model

- [ ] **Step 2:** schema 添加 `model_id`, `deleted_at`（M1 暂不添加 bot/kind 列，留 M3 migration）

- [ ] **Step 3:** `chat-service.streamPlain/streamRag` 注入 `modelCatalog.resolveModelRef(session.modelId ?? defaultId)`

- [ ] **Step 4:** `listSessions` 过滤 `deleted_at IS NULL`

- [ ] **Step 5:** 测试 PASS + Commit — `feat(chat): session modelId and soft delete`

---

## Task 7: SSE abort 支持

**Files:**
- Modify: `packages/chat/src/chat-service.ts`
- Modify: `apps/api/src/routes/chat.ts`
- Create: `packages/chat/src/chat-abort.test.ts`

- [ ] **Step 1: 写失败测试** — 传入 `AbortSignal` 中途 abort；generator 结束且不调用 `appendMessage` assistant

- [ ] **Step 2:** `streamReply(..., { signal?: AbortSignal })` 传给 `ai.chat`

- [ ] **Step 3:** `routes/chat.ts` — `request.raw.on('close')` 创建 AbortController；abort 时写 `{ type: 'aborted' }`

- [ ] **Step 4:** 测试 PASS + Commit — `feat(chat): stream abort without partial assistant persist`

---

## Task 8: Chat API 扩展 DELETE + modelId

**Files:**
- Modify: `apps/api/src/routes/chat.ts`
- Create: `apps/api/src/routes/chat.test.ts`

- [ ] **Step 1: 写失败测试** — DELETE session 204；PATCH modelId

- [ ] **Step 2:** 实现路由

- [ ] **Step 3:** PASS + Commit — `feat(api): chat session delete and modelId patch`

---

## Task 9: 前端 useChatStream + api client

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/features/chat/hooks/useChatStream.ts`
- Create: `apps/web/src/features/chat/hooks/useChatMessages.ts`
- Create: `apps/web/src/features/chat/chat-types.ts`

- [ ] **Step 1:** 重写 `streamChat` 使用 `fetch` + `response.body.getReader()` 逐行解析 `data: ` SSE

```typescript
export async function streamChat(
  sessionId: string,
  content: string,
  opts?: { mode?: 'chat' | 'rag'; modelId?: string; signal?: AbortSignal },
  onEvent?: (ev: ChatStreamEvent) => void,
): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${sessionId}/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, ...opts }),
    credentials: 'include',
    signal: opts?.signal,
  });
  // read loop: parse SSE, call onEvent for each token
}
```

- [ ] **Step 2:** 添加 `chatMessages(sessionId)`, `deleteChatSession`, `models.list()`

- [ ] **Step 3:** `useChatStream` — state: `streamingText`, `isStreaming`, `abort()`

- [ ] **Step 4:** `useChatMessages` — load on sessionId change

- [ ] **Step 5:** Commit — `feat(web): chat streaming hooks and API client`

---

## Task 10: Chat UI 组件

**Files:**
- Create: `apps/web/src/features/chat/components/ChatSessionSidebar.tsx`
- Create: `apps/web/src/features/chat/components/ChatMessageBubble.tsx`
- Create: `apps/web/src/features/chat/components/ChatMessageList.tsx`
- Create: `apps/web/src/features/chat/components/ChatComposer.tsx`
- Create: `apps/web/src/features/chat/components/ModelSelector.tsx`
- Modify: `apps/web/src/styles.css`
- Rewrite: `apps/web/src/features/chat/ChatPage.tsx`

- [ ] **Step 1:** 添加 `.chat-layout`, `.chat-sidebar`, `.chat-bubble--user`, `.chat-bubble--assistant` 样式

- [ ] **Step 2:** `ChatSessionSidebar` — 时间分组（今天/昨天/更早）；rename inline；delete confirm

- [ ] **Step 3:** `ChatMessageList` — map messages + streaming placeholder + 光标 `|`

- [ ] **Step 4:** `ChatComposer` — 发送/停止切换

- [ ] **Step 5:** `ModelSelector` — `GET /api/models?capability=chat` + PATCH session

- [ ] **Step 6:** `ChatPage` 双栏布局组装

- [ ] **Step 7:** Commit — `feat(web): full ChatPage layout with streaming UI`

---

## Task 11: ModelCatalogPage

**Files:**
- Create: `apps/web/src/features/settings/ModelCatalogPage.tsx`
- Modify: `apps/web/src/features/settings/settings-nav-config.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1:** 路由 `/settings/models` — provider 列表、sync 按钮、设默认 model

- [ ] **Step 2:** 设置导航添加入口；保留旧 ModelSettingsPage 重定向或合并

- [ ] **Step 3:** Commit — `feat(web): model catalog settings page`

---

## Task 12: M1 集成测试 AC-18+

**Files:**
- Create: `apps/api/src/integration/chat-m1.integration.test.ts`

- [ ] **Step 1: 写测试** — 多 token stream；GET messages 含 user+assistant；abort 后 messages 无 assistant

```typescript
it('streams multiple tokens and persists history (AC-18+)', async () => {
  // mock aiRuntime yields 'tok1','tok2'
  // POST stream, assert body contains both
  // GET messages length >= 2
});

it('abort does not persist assistant message', async () => {
  // inject slow stream; abort mid-way; GET messages — last role user only
});
```

- [ ] **Step 2:** `pnpm --filter api exec vitest run src/integration/chat-m1.integration.test.ts` PASS

- [ ] **Step 3:** Commit — `test(api): chat M1 integration AC-18+`

**M1 完成门禁:** `pnpm --filter @rxwf/chat test` + `pnpm --filter api exec vitest run src/integration/chat-m1.integration.test.ts` 全绿；手动验证 Chat 页双栏 + 流式 + 停止。

---

# 里程碑 M2 — RAG + 交互

## Task 13: regenerate API + chat_messages 扩展

**Files:**
- Modify: `packages/chat/src/chat-repository.ts`
- Modify: `packages/chat/src/chat-service.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `apps/api/src/routes/chat.ts`
- Create: `packages/chat/src/chat-regenerate.test.ts`

- [ ] **Step 1:** schema 添加 `model_id`, `parent_message_id`, `status` 到 chat_messages

- [ ] **Step 2: 写失败测试** — regenerate 删除 assistant 及之后消息，重跑 stream

- [ ] **Step 3:** `POST .../messages/:messageId/regenerate` 路由

- [ ] **Step 4:** PASS + Commit — `feat(chat): message regenerate`

---

## Task 14: 反馈 UI + CitationCard

**Files:**
- Create: `apps/web/src/features/chat/components/CitationCard.tsx`
- Create: `apps/web/src/features/chat/components/RagSettingsPanel.tsx`
- Modify: `apps/web/src/features/chat/components/ChatMessageBubble.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1:** `CitationCard` — 折叠/展开 excerpt + score 条

- [ ] **Step 2:** assistant bubble 底部 👍/👎 → `POST feedback`；hover 显示「重新生成」

- [ ] **Step 3:** `RagSettingsPanel` 从 ChatPage 抽离（KB 多选、模板、fallback）

- [ ] **Step 4:** Commit — `feat(web): RAG citations feedback and regenerate UI`

---

## Task 15: 知识库 UX + documentCount

**Files:**
- Modify: `packages/knowledge/src/knowledge-service.ts`
- Modify: `apps/api/src/routes/knowledge-bases.ts`
- Modify: `apps/web/src/features/knowledge/KnowledgeListPage.tsx`
- Modify: `apps/web/src/features/knowledge/KnowledgeDetailPage.tsx`

- [ ] **Step 1:** `GET /api/knowledge-bases` 返回 `documentCount`, `chunkCount`

- [ ] **Step 2:** 列表页卡片网格 + 统计；详情页拖拽上传区 + 状态 badge + 重试按钮

- [ ] **Step 3:** 命中测试 Tab 加 score 进度条

- [ ] **Step 4:** Commit — `feat(knowledge): UX polish and document counts`

---

## Task 16: AC-19 集成测试

**Files:**
- Create: `apps/api/src/integration/chat-rag.integration.test.ts`

- [ ] **Step 1:** mock knowledge 返回 chunks → stream done 含 citations

- [ ] **Step 2:** mock E3003 + fallbackToChat → 仍 200 且无 citations

- [ ] **Step 3:** PASS + Commit — `test(api): chat RAG AC-19 integration`

---

# 里程碑 M3 — Bot + 多平台发布

## Task 17: `@rxwf/chat-bots` 包 + schema

**Files:**
- Create: `packages/chat-bots/`（package.json, tsconfig, vitest）
- Create: `packages/chat-bots/src/types.ts`
- Create: `packages/chat-bots/src/chat-bot-service.ts`
- Create: `packages/chat-bots/src/chat-bot-service.test.ts`
- Modify: `packages/providers/lite/src/drizzle/schema.ts` — chat_bots, chat_bot_versions, chat_bot_channels, chat_bot_api_keys, chat_bot_publish_log
- Modify: `packages/providers/lite/src/drizzle/schema.ts` — chat_sessions 扩展 bot_id, kind, public_client_token, bot_version_id
- Create: `packages/providers/lite/src/chat-bots-repository.ts`

- [ ] **Step 1:** 定义 `ChatBotConfig` JSON 类型（design §2.4）

- [ ] **Step 2: 写失败测试** — create bot → publish → published_version_id 不可变

- [ ] **Step 3:** 实现 `createChatBotService({ repo, chatService, catalog })`

- [ ] **Step 4:** Lite repository + migration

- [ ] **Step 5:** PASS + Commit — `feat(chat-bots): package schema and publish service`

---

## Task 18: chat-bots API

**Files:**
- Create: `apps/api/src/routes/chat-bots.ts`
- Create: `apps/api/src/routes/chat-bots.test.ts`
- Modify: `apps/api/src/bootstrap-plus.ts`

- [ ] **Step 1:** 实现 design §3.3 全部路由

- [ ] **Step 2:** `generate-config` — LLM JSON 输出 + Zod 校验 + `E3010`

- [ ] **Step 3:** 测试 CRUD + publish + channel enable

- [ ] **Step 4:** Commit — `feat(api): chat bots REST API`

---

## Task 19: 公开 Embed + API 渠道

**Files:**
- Create: `apps/api/src/routes/public-chat.ts`
- Create: `apps/api/src/middleware/public-chat-auth.ts`
- Create: `apps/api/src/rate-limit/bot-rate-limit.ts`
- Create: `apps/api/src/routes/public-chat.test.ts`

- [ ] **Step 1:** `createPublicChatPreHandler` — API Key hash 校验 / client token 校验

- [ ] **Step 2:** 内存 rate limit 60/min/IP/botId

- [ ] **Step 3:** `POST /api/public/chat/:slug/session` 创建 kind=public 会话 + clientToken

- [ ] **Step 4:** stream 强制读 `bot_version_id` 快照 config

- [ ] **Step 5:** `GET /embed/:slug` 返回 HTML shell（或 SPA 静态路由由 web 承担 — 选 **web EmbedChatPage** + API bootstrap JSON）

- [ ] **Step 6:** PASS + Commit — `feat(api): public chat embed and API channel`

---

## Task 20: MCP chat_bot_run Tool

**Files:**
- Modify: `packages/mcp-server/src/server.ts`
- Modify: `packages/mcp-server/src/types.ts`
- Modify: `apps/api/src/routes/mcp.ts`
- Create: `packages/mcp-server/src/chat-bot-tool.test.ts`

- [ ] **Step 1:** 扩展 `McpDeps` 注入 `runChatBot({ slug, message, sessionId? })`

- [ ] **Step 2:** 注册 `chat_bot_run` + 动态 per-bot toolName（启动时 load enabled mcp channels）

- [ ] **Step 3:** 测试 tool 调用返回聚合文本

- [ ] **Step 4:** Commit — `feat(mcp): chat_bot_run tool for published bots`

---

## Task 21: Bot 前端 — Editor + Publish + Embed

**Files:**
- Create: `apps/web/src/features/chat/ChatBotListPage.tsx`
- Create: `apps/web/src/features/chat/ChatBotEditorPage.tsx`
- Create: `apps/web/src/features/chat/ChatBotPublishPage.tsx`
- Create: `apps/web/src/features/chat/EmbedChatPage.tsx`
- Create: `apps/web/src/features/chat/components/BotConfigForm.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1:** Bot 列表 + 创建

- [ ] **Step 2:** Editor — BotConfigForm + NL 生成 modal + draft 预览

- [ ] **Step 3:** Publish 页 — 渠道表格、Key CRUD、Embed script 复制、iframe 预览、发布历史

- [ ] **Step 4:** EmbedChatPage — 无 AppShell；localStorage clientToken；themeColor CSS var

- [ ] **Step 5:** Commit — `feat(web): chat bot editor publish and embed pages`

---

## Task 22: M3 集成测试 AC-41

**Files:**
- Create: `apps/api/src/integration/chat-bots.integration.test.ts`

- [ ] **Step 1:** publish bot → API Key 对话 200

- [ ] **Step 2:** public session + stream 200（无 auth）

- [ ] **Step 3:** MCP `chat_bot_run` 返回内容

- [ ] **Step 4:** PASS + Commit — `test(api): chat bots three-channel AC-41`

---

# 里程碑 M4 — 编辑器 + Standard + 文档

## Task 23: Standard repositories

**Files:**
- Create: `packages/providers/standard/src/repositories/model-catalog-repository.ts`
- Create: `packages/providers/standard/src/repositories/chat-bots-repository.ts`
- Create: `packages/providers/standard/src/repositories/chat-repository.ts`
- Modify: `packages/providers/standard/src/drizzle/schema.ts`
- Modify: `packages/providers/standard/src/index.ts`
- Create: `packages/providers/standard/src/repositories/chat-repositories.test.ts`

- [ ] **Step 1:** PG schema 镜像 Lite 表

- [ ] **Step 2:** 三个 repository 实现

- [ ] **Step 3:** 冒烟测试（testcontainers 或 skip if no DATABASE_URL — 与现有 standard 测试风格一致）

- [ ] **Step 4:** Commit — `feat(providers-standard): chat model and bot repositories`

---

## Task 24: EditorChatSidebar

**Files:**
- Create: `apps/web/src/features/editor/EditorChatSidebar.tsx`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`

- [ ] **Step 1:** 工具栏按钮 toggle 360px 侧栏

- [ ] **Step 2:** 复用 ChatMessageList + ChatComposer；会话 title = workflow name

- [ ] **Step 3:** Commit — `feat(web): workflow editor chat sidebar`

---

## Task 25: OpenAPI + ac-api-mapping + i18n

**Files:**
- Modify: `docs/openapi.yaml`
- Modify: `docs/ac-api-mapping.md`
- Modify: `fixtures/ac-api-mapping.json`（若存在）
- Modify: `packages/i18n-catalog/` — 添加 `chat.*` keys
- Modify: `apps/web/src/features/chat/*` — 替换硬编码串

- [ ] **Step 1:** OpenAPI 补全 Chat/Models/ChatBots/PublicChat paths + SSE aborted schema

- [ ] **Step 2:** ac-api-mapping 添加 AC-19、AC-41

- [ ] **Step 3:** `pnpm lint:ac-mapping` PASS

- [ ] **Step 4:** i18n 关键串外置

- [ ] **Step 5:** Commit — `docs: openapi and ac mapping for chat completion`

---

## Task 26: 全量验证

- [ ] **Step 1:** `pnpm test` 全 monorepo

- [ ] **Step 2:** 手动冒烟清单：
  - Chat 双栏流式停止
  - RAG 引用 + 反馈
  - Bot 发布三渠道
  - Embed iframe
  - 编辑器侧栏
  - Standard profile smoke（若环境可用）

- [ ] **Step 3:** Commit — `chore: chat completion milestone verification`

---

## Spec 覆盖自检

| Spec 要求 | Task |
|-----------|------|
| 模型目录 B | 1–4, 11, 23 |
| 真流式 + abort | 5, 7, 9 |
| 会话 delete/rename | 6, 8, 10 |
| 双栏 Chat UI | 10 |
| RAG 引用/反馈/regenerate | 13–16 |
| 知识库 UX | 15 |
| chat_bots + publish | 17–18, 21 |
| API/Embed/MCP 渠道 | 19–20, 22 |
| NL generate config | 18 |
| EditorChatSidebar | 24 |
| Standard PG | 23 |
| OpenAPI/ac-mapping | 25 |

无 TBD 占位；非目标（IM、附件、chat-worker）未纳入 Task。

---

## 执行方式

Plan 已保存。两种执行选项：

1. **Subagent-Driven（推荐）** — 每个 Task 派发独立 subagent，Task 间人工 review，迭代快
2. **Inline Execution** — 本会话按 Task 顺序执行，每里程碑 checkpoint Review

请选择执行方式，或指定从 **Task 1（M1）** 开始。
