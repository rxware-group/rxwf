# Chat 完整产品补齐设计

**日期:** 2026-05-23  
**范围:** FR-17 / UX §3.6 完整 Chat 产品；AC-18 增强；AC-19；Bot 多平台发布（FR-15.10 / FR-19.5）；模型目录（FR-19.2）  
**策略:** 方案 2 — 按用户旅程纵向切片（M1→M4）

## 决策摘要

| 决策项 | 选择 |
|--------|------|
| 产品目标 | 对齐 `ux-ui-design.md` §3.6 完整 Chat（含 RAG、反馈、会话管理、知识库 UX、编辑器侧栏） |
| 交付策略 | 纵向切片 M1–M4，每阶段可演示、可合并 |
| Bot / 发布 | 完整多平台：`chat_bots` + draft/published + API / Embed / MCP 三渠道 + NL 生成配置 |
| 模型层 | 完整模型目录：`model_providers` + `models`，Chat / Agent / 设置页共用 |
| 访问控制 | 分渠道默认：API 需 Key；Embed 公开只读；MCP 沿用 Token scope |
| 停止生成 | 客户端 Abort → 服务端取消 generator；不落库 partial assistant |

## 1. 架构与模块边界

### 1.1 模块图

```
apps/web/features/chat/          — 对话页、Bot 管理、Embed、共享组件
apps/web/features/editor/        — EditorChatSidebar (M4)
apps/api/routes/                 — chat.ts, models.ts, chat-bots.ts, public-chat.ts

@rxwf/chat               — 会话/消息/流式（扩展）
@rxwf/model-catalog      — 模型目录（新）
@rxwf/chat-bots          — Bot 实体与发布（新）
@rxwf/ai-runtime         — 真 token stream
@rxwf/knowledge          — RAG 检索（已有）

providers/lite + standard        — 各 Repository 实现
```

**依赖规则（ADR-003）：**

- `chat-bots` → `chat` + `model-catalog`；不直接 import LangChain
- `model-catalog` → `credential`；不依赖 `execution`
- MCP 发布：`@rxwf/mcp-server` 注册 `chat_bot_run`（及 per-bot 自定义 toolName）

### 1.2 里程碑

| 阶段 | 目标 | 验收 |
|------|------|------|
| **M1** | 对话核心 | 双栏 UI、历史、真流式、停止、模型目录、会话删除/重命名 |
| **M2** | RAG + 交互 | 引用卡片、反馈、重新生成、知识库 UX |
| **M3** | Bot + 发布 | draft/published、发布中心三渠道、NL 配置、Embed |
| **M4** | 编辑器 + 平台 | EditorChatSidebar、Standard Repository、OpenAPI |

### 1.3 共享前端组件（M1 建立）

| 组件 | 职责 |
|------|------|
| `ChatSessionSidebar` | 会话列表、时间分组、新建/删除/重命名 |
| `ChatMessageList` / `ChatMessageBubble` | 气泡、流式光标、反馈、重新生成 |
| `ChatComposer` | 输入、发送、停止 |
| `ModelSelector` | 模型目录下拉 |
| `CitationCard` | RAG 引用（M2） |
| `useChatStream` | SSE + AbortController |

路径：`apps/web/src/features/chat/components/`

### 1.4 流式与停止

- `AiRuntime.chat()` 使用 LangChain `model.stream()` 逐 chunk yield
- SSE 协议保留 `{ type: 'token' }`，新增 `{ type: 'aborted' }`
- 客户端断开 → 取消 generator；**不**持久化 partial assistant

### 1.5 发布渠道访问（分渠道默认）

| 渠道 | 默认 | 鉴权 |
|------|------|------|
| REST API | 需 Key | `chat_bot_api_keys`，scope `chat:bot:{botId}` |
| Embed | 公开只读 | 无 Cookie；IP rate limit |
| MCP | Token | 现有 `mcp-tokens`，scope 扩展 `chat_bot:*` |

Bot 级 `accessPolicy` 可覆盖 Embed 默认（`public` / `authenticated` / `role`）。

---

## 2. 数据模型

### 2.1 `chat_sessions` 扩展

| 列 | 说明 |
|----|------|
| `model_id` | FK → `models.id` |
| `bot_id` | FK → `chat_bots.id`，可选 |
| `kind` | `user`（默认）\| `public`（Embed 访客） |
| `public_client_token` | Embed localStorage token |
| `bot_version_id` | public 会话绑定的 published 快照 |
| `deleted_at` | 软删除 |

保留：`mode`, `knowledge_base_ids`, `rag_template`。

`user_id` 对 `kind=public` 为 **nullable**；应用层校验：`kind=user` 时必须有 userId。

### 2.2 `chat_messages` 扩展

| 列 | 说明 |
|----|------|
| `model_id` | 生成该 assistant 消息的模型 |
| `parent_message_id` | 重新生成链路 |
| `status` | `complete` \| `aborted` |

### 2.3 模型目录

**`model_providers`:** id, name, kind (`ollama` \| `openai-compatible`), base_url, credential_id, enabled, health_status, last_health_at, timestamps

**`models`:** id, provider_id, model_name, capabilities (JSON), is_default_chat, enabled, source (`manual` \| `discovered`), timestamps

- Ollama 同步：`POST /api/models/sync` 写 `source=discovered`
- 迁移：从 `RuntimeConfig.ollamaModel` 种子默认 provider/model；旧设置字段 deprecated 一版

### 2.4 Chat Bot

**`chat_bots`:** id, owner_user_id, name, slug (unique), status (`draft` \| `published`), published_version_id, timestamps

**`chat_bot_versions`:** id, bot_id, version, config_json, published_at, created_by, created_at

```typescript
interface ChatBotConfig {
  systemPrompt: string;
  openingMessage: string;
  avatarUrl?: string;
  themeColor: string;       // default #cc5de8
  modelId: string;
  mode: 'chat' | 'rag';
  knowledgeBaseIds: string[];
  ragTemplate: 'support' | 'code';
  fallbackToChat: boolean;
  accessPolicy: 'public' | 'authenticated' | 'role';
  allowedRoles?: string[];
}
```

Publish：复制 config → 新 version（`published_at=now`）→ 更新 `chat_bots.published_version_id`。

### 2.5 发布渠道

**`chat_bot_channels`:** bot_id, channel (`api` \| `embed` \| `mcp`), enabled, config_json

| channel | config_json |
|---------|-------------|
| api | `{ rateLimitPerMin: number }` |
| embed | `{ allowedOrigins: string[], widgetTitle: string }` |
| mcp | `{ toolName: string, description: string }` |

**`chat_bot_api_keys`:** bot_id, key_hash, name, scope, expires_at, last_used_at

**`chat_bot_publish_log`:** bot_id, version_id, action, detail_json, user_id, created_at

### 2.6 Standard（PostgreSQL）

与 Lite 同构；`config_json` 用 jsonb；索引：`chat_bots(slug)` UNIQUE，`chat_sessions(user_id, updated_at)`，`chat_messages(session_id, created_at)`。

### 2.7 Repository 接口

| 包 | 接口 |
|----|------|
| `@rxwf/chat` | 扩展 deleteSession、modelId patch |
| `@rxwf/model-catalog` | `ModelCatalogRepository` |
| `@rxwf/chat-bots` | `ChatBotRepository`, `ChatBotPublishRepository` |

Standard 实现于 M4。

---

## 3. API 设计

### 3.1 Chat（登录用户）

| 方法 | 路径 | 阶段 |
|------|------|------|
| DELETE | `/api/chat/sessions/:id` | M1 |
| PATCH | `/api/chat/sessions/:id` | M1 扩展 modelId |
| GET | `/api/chat/sessions/:id/messages` | 已有，扩展字段 |
| POST | `/api/chat/sessions/:id/stream` | M1 扩展 modelId |
| POST | `.../messages/:messageId/feedback` | 已有 |
| POST | `.../messages/:messageId/regenerate` | M2 |

**Stream body:** `{ content, mode?, modelId?, fallbackToChat? }`

**SSE events:** `token` | `done` | `aborted` | `error` → 结尾 `[DONE]`

### 3.2 模型目录

| 方法 | 路径 | 权限 |
|------|------|------|
| GET/POST/PATCH/DELETE | `/api/models/providers` | 读:登录 / 写:admin |
| GET/POST/PATCH | `/api/models` | 同上 |
| POST | `/api/models/sync` | admin |
| POST | `/api/models/providers/:id/health-check` | admin |

### 3.3 Chat Bots

| 方法 | 路径 |
|------|------|
| GET/POST | `/api/chat-bots` |
| GET/PATCH/DELETE | `/api/chat-bots/:id` |
| POST | `/api/chat-bots/:id/publish` |
| POST | `/api/chat-bots/:id/unpublish` |
| GET/PATCH | `/api/chat-bots/:id/channels/:channel` |
| GET/POST/DELETE | `/api/chat-bots/:id/api-keys` |
| GET | `/api/chat-bots/:id/publish-log` |
| POST | `/api/chat-bots/:id/generate-config` |
| POST | `/api/chat-bots/:id/sessions` |

### 3.4 公开渠道

| 方法 | 路径 | 鉴权 |
|------|------|------|
| GET | `/embed/:slug` | 无 — Widget HTML |
| POST | `/api/public/chat/:slug/session` | 无 — 创建/恢复 public 会话 |
| GET | `/api/public/chat/sessions/:id/messages` | `x-chat-client-token` |
| POST | `/api/public/chat/sessions/:id/stream` | client token；**强制 published snapshot** |
| POST | `/api/public/chat/bots/:slug/chat` | Bot API Key |

Embed rate limit：60 req/min/IP/botId（内存令牌桶）。

### 3.5 MCP

Tool `chat_bot_run`（或 per-bot `toolName`）：`{ botSlug, message, sessionId? }` → 聚合非流式回复。

### 3.6 NL 生成 Bot 配置

`POST /api/chat-bots/:id/generate-config` — body `{ prompt }` → `{ config, explanation }`；仅写 draft；失败 `E3010`。

### 3.7 错误码

| 码 | 场景 |
|----|------|
| E1001 | 会话/Bot 不存在 |
| E1004 | 参数无效 |
| E1005 | Bot 未发布 / 渠道未启用 |
| E1006 | Embed/API 鉴权失败 |
| E1007 | Rate limit |
| E3001 | 模型不可用 |
| E3003 | RAG 无命中 |
| E3010 | NL 配置生成失败 |

---

## 4. 前端设计

### 4.1 路由

| 路由 | 组件 | 阶段 |
|------|------|------|
| `/chat` | `ChatPage` | M1 |
| `/chat/bots` | `ChatBotListPage` | M3 |
| `/chat/bots/:botId` | `ChatBotEditorPage` | M3 |
| `/chat/bots/:botId/publish` | `ChatBotPublishPage` | M3 |
| `/embed/:slug` | `EmbedChatPage`（无 AppShell） | M3 |
| `/settings/models` | `ModelCatalogPage` | M1 |
| `/knowledge/*` | UX 升级 | M2 |
| 编辑器 | `EditorChatSidebar` | M4 |

### 4.2 Chat 主界面

- 左栏 260px：`ChatSessionSidebar`
- 右栏：Segmented 模式切换、RagSettingsPanel（M2）、MessageList、Composer
- 顶栏：`ModelSelector`、链接知识库/Bot 管理
- 样式：`.chat-bubble--user` / `--assistant`（左边框 `#cc5de8`）

### 4.3 状态流

- `useChatMessages`：初始 load + optimistic user append
- `useChatStream`：ReadableStream SSE、`AbortController`、逐 token 更新
- regenerate：API 截断 + 重跑 stream

### 4.4 Bot & 发布中心

- Editor：BotConfigForm + NL 生成 modal + draft 预览 iframe
- Publish：渠道表格、Key 管理、Embed script、MCP JSON、访问控制、发布历史

### 4.5 Embed

- `themeColor` CSS 变量、`openingMessage` 首条气泡
- `localStorage` clientToken

### 4.6 编辑器侧栏（M4）

360px 右侧滑出；复用 MessageList + Composer；会话 title = 工作流名；不绑定 Bot。

### 4.7 api/client 扩展

- M1：`chatMessages`, `deleteChatSession`, `models.*`, `streamChat` 改 ReadableStream
- M2：`regenerateChatMessage`, `messageFeedback`
- M3：`chatBots.*`, `publicChat.*`

---

## 5. 测试与非目标

### 5.1 测试

| ID | 用例 | 阶段 |
|----|------|------|
| AC-18+ | stream 多 token + 历史持久化 | M1 |
| — | abort 无 partial 落库 | M1 |
| — | modelId 切换 | M1 |
| AC-19 | RAG citations + E3003 fallback | M2 |
| — | feedback + regenerate | M2 |
| AC-41 | Bot 三渠道 | M3 |
| — | Standard Repository 冒烟 | M4 |

### 5.2 非目标

- IM 机器人、Webhook 回调渠道（UI 占位）
- 附件上传、Chat 长期记忆、BM25/Rerank
- 独立 chat-worker、Bot SDK
- 编辑器「插入建议到节点」

### 5.3 风险

| 风险 | 缓解 |
|------|------|
| Stream 背压 | generator finally + onClose |
| Embed 滥用 | rate limit |
| Published 漂移 | 强制 bot_version 快照 |
| ollamaModel 双写 | 迁移 + deprecated |

### 5.4 文档

M4 更新 `docs/ac-api-mapping.md`（AC-19、Bot 发布）、`docs/openapi.yaml`。

---

## 6. 里程碑 Checklist

### M1（5–7 天）

- [ ] model_providers / models + API + ModelCatalogPage
- [ ] AiRuntime 真 stream
- [ ] ChatPage 双栏 + 历史 + useChatStream + 停止
- [ ] 会话 delete/rename + chat_sessions 扩展
- [ ] AC-18 增强测试

### M2（3–4 天）

- [ ] CitationCard + 反馈 + regenerate
- [ ] 知识库 UX + documentCount
- [ ] AC-19 集成测试

### M3（6–8 天）

- [ ] chat-bots 包 + 表 + API
- [ ] Bot 编辑器 + 发布中心 + NL generate
- [ ] Embed + public API + MCP tool
- [ ] 三渠道集成测试

### M4（3–4 天）

- [ ] EditorChatSidebar
- [ ] Standard repositories
- [ ] OpenAPI + ac-api-mapping + i18n chat.*
