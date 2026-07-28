# 知识库平台集中配置（Knowledge Platform Config）

| 字段 | 内容 |
|------|------|
| **状态** | **Implemented** — 见 [2026-06-22-knowledge-platform-config.md](../plans/2026-06-22-knowledge-platform-config.md) |
| **日期** | 2026-06-22 |
| **范围** | 知识库 / RAG 的 **Embedding** 与 **RAG 对话默认**、设置页、运行时接线；**不含**工作流通用 LLM 默认（仍走模型目录） |
| **策略** | **方案 A**：Embedding Provider / Base URL / 凭证 **平台统一**；单库仅可覆盖 **embedding 模型名** 与检索参数 |
| **关联** | [2026-05-23-knowledge-base-design.md](./2026-05-23-knowledge-base-design.md)、[2026-05-23-chat-completion-design.md](./2026-05-23-chat-completion-design.md)、[2026-05-23-agent-rag-design.md](./2026-05-23-agent-rag-design.md)、Web 搜索设置（`knowledge.config` 模式对齐 `webSearch.config`） |

---

## 1. 背景与问题

### 1.1 现状

知识库相关能力已落地（`@rxwf/knowledge`、入库任务、检索、Chat RAG、工作流 `ragRetrieve` / `ragAnswer`），但配置分散：

| 配置项 | 当前位置 | 问题 |
|--------|----------|------|
| Embedding 服务地址 | `RXWF_OLLAMA_URL`、`system_settings.ollamaUrl`（无 UI） | 与「模型目录」割裂，用户不知改何处 |
| Embedding 模型 | `knowledge_bases.embedding_model`（API 有，UI 几乎未暴露） | 新建库只能用硬编码默认 |
| RAG 默认 LLM | 模型目录默认对话模型、Chat Bot `modelId`、节点级 `provider` | 与知识库心智不一致 |
| 分块 / topK / 阈值 | `knowledge_bases` 字段 | 详情页仅暴露「混合检索」开关 |
| Embedding 实现 | 仅 `createOllamaEmbeddings` | 无法通过产品配置切换 OpenAI 兼容 Embedding |

### 1.2 目标

1. **单一配置源**：知识库 / RAG 链路 **仅** 读取 `system_settings` 中的 `knowledge.config`（JSON）。
2. **设置页集中管理**：新增 **设置 → 知识库**（`/settings/knowledge`），Admin 可编辑；非 Admin **只读**查看状态。
3. **方案 A**：平台级 Embedding 通道；单库只可覆盖 **模型名** 与检索参数，**不可** per-KB Provider / URL / 凭证。
4. **变更可感知**：修改会影响向量的配置时 **强制提醒 reindex**（可保存，但必须确认并引导 reindex）。
5. **不做向前兼容**：移除知识库对 `ollamaUrl`、`RXWF_OLLAMA_*` 的 fallback；未配置 `knowledge.config` 时知识库写操作返回明确错误。

### 1.3 成功标准（验收）

| # | 标准 |
|---|------|
| AC-K1 | Admin 在 `/settings/knowledge` 完成 Embedding + RAG 默认配置并保存；非 Admin 同页只读可见 |
| AC-K2 | 未配置 `knowledge.config` 时，上传文档 / query / index 返回 `E1004`（或等价）及可读文案 |
| AC-K3 | 新建知识库继承平台 `defaults` + `embedding.defaultModel`；详情页可覆盖 per-KB 参数与 `embeddingModel` |
| AC-K4 | 修改平台 embedding 相关字段保存时弹出 reindex 提醒；提供「保存并全库 reindex」 |
| AC-K5 | 修改单库 `embeddingModel` 保存时提醒该库 reindex |
| AC-K6 | `openai-compatible` embedding：配置凭证 + Base URL 后「测试连接」返回维度与延迟 |
| AC-K7 | Chat / Bot RAG 未指定 `modelId` 时使用 `rag.defaultModelId` |
| AC-K8 | 知识库运行时 **不再** 读取 `getOllamaDefaults().ollamaUrl` 或 `RXWF_OLLAMA_URL` |

### 1.4 明确不做（本 spec 范围外）

| 能力 | 说明 |
|------|------|
| per-KB Embedding Provider / URL / 凭证 | 方案 A 已否决 |
| 向前兼容 `ollamaUrl` / env fallback | 本 spec 明确移除 |
| 模型目录管理 Embedding 模型注册 | 二期可选；一期 embedding 仅在知识库设置配置 |
| 自动检测向量维度并迁移 pgvector 列 | 一期固定文档化维度要求；换模型须 reindex |
| 非 Admin 编辑平台配置 | 仅只读 |
| Git / S3 同步源扩展 | 仍属原知识库 spec 后续项 |

---

## 2. 已确认设计决策

| 议题 | 决定 |
|------|------|
| Embedding 拓扑 | **方案 A**：Provider / Base URL / 凭证平台统一；单库仅覆盖 `embeddingModel` |
| 配置存储 | **仅** `knowledge.config`；知识库链路不读 `system_settings.ollamaUrl`、`RXWF_OLLAMA_*` |
| embedding 变更 | **必须提醒 reindex**；平台级变更影响全库；库级变更影响该库 |
| 非 Admin | **只读**查看平台知识库配置与就绪状态 |
| 向前兼容 | **不做**；无配置即未就绪 |
| RAG LLM 来源 | **引用模型目录** `modelId`；不在 `knowledge.config` 重复 Provider 列表 |
| 参考实现 | 对齐 `webSearch.config`（`packages/web-search/src/settings.ts` + `apps/api/src/routes/web-search-settings.ts` + `WebSearchSettings.tsx`） |

---

## 3. 配置模型

### 3.1 存储

- **Key**：`system_settings.knowledge.config`（常量 `SETTING_KEYS.knowledgeConfig`）
- **格式**：JSON 字符串，由 `@rxwf/knowledge-settings`（新包）或 `@rxwf/knowledge` 子模块提供 `parse` / `serialize` / 默认值
- **敏感字段**：`embedding.credentialId` 仅存 ID；响应中不回传密钥明文

### 3.2 类型定义

```typescript
/** 平台级知识库 / RAG 配置（唯一真相源） */
export interface KnowledgePlatformConfig {
  /** 是否已完成最低配置（可由服务端根据必填项推导，也可持久化） */
  configured: boolean;

  embedding: {
    provider: 'ollama' | 'openai-compatible';
    baseUrl: string;
    defaultModel: string;
    credentialId?: string;
    /** 只读展示 / 测试连接后写入；用于 reindex 与维度校验提示 */
    dimensions?: number;
  };

  rag: {
    /** 模型目录 models.id；须为 enabled 且 provider 可用的 chat 模型 */
    defaultModelId: string;
    defaultTemplate: 'support' | 'code';
    fallbackToChat: boolean;
  };

  defaults: {
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    /** API 与 UI 使用 0~1；入库仍可按现有 repository 乘 100 存整数 */
    similarityThreshold: number;
    hybridSearchEnabled: boolean;
  };
}
```

### 3.3 默认值（`DEFAULT_KNOWLEDGE_PLATFORM_CONFIG`）

| 字段 | 默认 |
|------|------|
| `configured` | `false` |
| `embedding.provider` | `ollama` |
| `embedding.baseUrl` | `http://127.0.0.1:11434` |
| `embedding.defaultModel` | `nomic-embed-text` |
| `rag.defaultTemplate` | `support` |
| `rag.fallbackToChat` | `true` |
| `rag.defaultModelId` | `''`（空表示未配置 RAG LLM） |
| `defaults.chunkSize` | `1000` |
| `defaults.chunkOverlap` | `200` |
| `defaults.topK` | `5` |
| `defaults.similarityThreshold` | `0.5` |
| `defaults.hybridSearchEnabled` | `false` |

`configured === true` 的最低条件（服务端校验）：

- `embedding.baseUrl` 非空
- `embedding.defaultModel` 非空
- `embedding.provider === 'openai-compatible'` 时 `credentialId` 非空
- `rag.defaultModelId` 非空且能 `resolveModelRef`

### 3.4 知识库实例（`knowledge_bases`）

保留现有列，语义收窄：

| 字段 | 来源 | 可 per-KB 覆盖 |
|------|------|----------------|
| `embedding_model` | 空或等于平台 `defaultModel` 表示继承；否则为覆盖模型名 | ✅ 仅模型名 |
| `chunk_size` / `chunk_overlap` / `top_k` / `similarity_threshold` / `hybrid_search` | 创建时复制 `defaults`；可 PATCH | ✅ |
| Provider / Base URL / 凭证 | **仅** `knowledge.config.embedding` | ❌ |

解析规则：

```text
effectiveEmbeddingModel(kb) =
  kb.embedding_model?.trim() || platform.embedding.defaultModel
```

---

## 4. Embedding 实现

### 4.1 Provider 工厂

新增 `createEmbeddingProvider(config, model, deps)`：

| provider | 实现 | HTTP |
|----------|------|------|
| `ollama` | `createOllamaEmbeddings` | `POST {baseUrl}/api/embeddings` |
| `openai-compatible` | `createOpenAiCompatibleEmbeddings`（新） | `POST {baseUrl}/embeddings`（OpenAI 风格） |

- `createKnowledgeRuntime` **不再** 接收 `ollamaBaseUrl`；改为 `loadKnowledgePlatformConfig(settingsService)` + `credentialResolver`
- `KnowledgeServiceDeps.createEmbeddings` 保留为测试注入点；生产由平台配置驱动

### 4.2 向量维度

- Standard 档 `knowledge_chunks.embedding` 列为 `vector(768)`（现有 schema）
- 平台配置 `embedding.dimensions` 在 **测试连接** 时写入，用于 UI 提示
- 若测试得到维度 ≠ 768，保存时 **警告**（不阻断一期）；检索/入库行为以实际列维度为准
- 文档与设置页说明：换 embedding 模型后 **必须 reindex**

---

## 5. 设置页 UI

### 5.1 路由与导航

- 路径：`/settings/knowledge`
- 导航：`settings-nav-config.tsx` 集成分组内，紧挨「模型目录」「Web 搜索」
- i18n：`settings.nav.knowledge`、`settings.knowledge.*`

### 5.2 Admin 视图（可编辑）

使用 `SettingsPageShell`，参考 `WebSearchSettings.tsx`。

**区块 A — 向量化（Embedding）**

| 控件 | 说明 |
|------|------|
| Provider | `ollama` / `openai-compatible` |
| Base URL | 必填 |
| Credential | `openai-compatible` 时 `CredentialSelect`（apiKey） |
| 默认 Embedding 模型 | 文本或下拉（Ollama 可拉 `/api/tags` 过滤 embedding 能力，一期可文本） |
| 测试连接 | 调用 `POST /api/settings/knowledge/test-embedding`；展示维度、延迟、样例 |

**区块 B — RAG 对话（LLM）**

| 控件 | 说明 |
|------|------|
| 默认 RAG 模型 | 模型目录 `modelId` 下拉（仅 `capabilities` 含 `chat` 且 enabled） |
| 默认模板 | `support` / `code` |
| 无命中回退普通对话 | `fallbackToChat` checkbox |

**区块 C — 新建知识库默认值**

| 控件 | 说明 |
|------|------|
| chunkSize / chunkOverlap / topK / similarityThreshold / hybridSearchEnabled | 数字与开关 |

**区块 D — 状态（只读）**

| 项 | 说明 |
|----|------|
| 配置就绪 | `configured` |
| 部署档位 | lite / standard |
| 任务队列 | lite jobs / bullmq |
| 向量维度 | `embedding.dimensions` |

**保存与 reindex 提醒（平台 embedding 变更）**

当以下任一字段相对上次保存发生变化：

- `embedding.provider`
- `embedding.baseUrl`
- `embedding.credentialId`
- `embedding.defaultModel`

则 Modal：

> 修改向量化配置会使**所有知识库**中的现有向量与检索不一致。保存后请对全部文档重新索引（reindex）。  
> [仅保存] [保存并排队全库 reindex]

「保存并全库 reindex」：保存配置后调用 `POST /api/knowledge-bases/reindex-all`（admin）。

### 5.3 非 Admin 视图（只读）

- 同页展示区块 A/B/C/D 当前值（Base URL 可完整展示；**不**展示凭证内容）
- 无保存、无测试写操作（测试 embedding 仅 admin，避免旁路探测凭证）
- 顶部 hint：「联系管理员修改知识库平台配置」

### 5.4 知识库详情页增强（`/knowledge/:id`）

在现有详情页补充（有编辑权限用户）：

| 字段 | UX |
|------|-----|
| `embeddingModel` | 占位符「继承平台默认：{defaultModel}」；留空=继承 |
| `chunkSize` / `chunkOverlap` / `topK` / `similarityThreshold` | 表单编辑 |
| `hybridSearchEnabled` | 已有 checkbox，保留 |

保存时若 `embeddingModel` 变更 → Modal 提醒 **该库** reindex，提供「保存并 reindex 本库全部文档」。

创建知识库对话框 **不** 要求填 embedding；列表页创建仍只需名称/描述。

---

## 6. API

### 6.1 平台配置

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/settings/knowledge` | 已登录 | Admin：完整配置；非 Admin：只读快照（无 credential 明文） |
| PUT | `/api/settings/knowledge` | Admin | 校验 + 持久化；返回是否 `embeddingChanged` |
| POST | `/api/settings/knowledge/test-embedding` | Admin | Body 可为草稿配置；返回 `{ dimensions, latencyMs, ok }` |

**GET 非 Admin 响应示例字段**：`configured`、`embedding.provider`、`embedding.baseUrl`、`embedding.defaultModel`、`embedding.dimensions`、`rag.*`、`defaults.*`、`status: { profile, jobQueue }`

### 6.2 Reindex

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/knowledge-bases/reindex-all` | Admin | 对所有 `indexed` / `failed` 文档 enqueue `knowledge.index` |
| POST | `/api/knowledge-bases/:id/reindex-all` | 库编辑权限 | 单库全量 reindex |

现有 `POST .../documents/:docId/reindex` 保留。

### 6.3 知识库 CRUD 调整

- `POST /api/knowledge-bases`：服务端用 `knowledge.config.defaults` + `embedding.defaultModel` 填充缺失字段；若 `!configured` → `400 E1004`
- `PATCH /api/knowledge-bases/:id`：允许更新 per-KB 字段；**拒绝** body 中出现 `embeddingProvider` / `embeddingBaseUrl` 等（若曾规划）
- `POST .../documents`、`POST .../query`、`knowledge.index` handler：执行前检查 `configured`；否则 `E1004`

### 6.4 错误码

| 码 | 场景 |
|----|------|
| `E1004` | 平台知识库未配置或配置无效 |
| `E3002` | Embedding / 测试连接失败 |
| `E3003` | RAG 检索无命中（不变） |

---

## 7. 运行时接线

### 7.1 启动（`createAppContext` / `createKnowledgeRuntime`）

```text
loadKnowledgePlatformConfig(settingsService)
  → createKnowledgeRuntime({ platformConfig, credentialResolver, ... })
  → createKnowledgeService({ createEmbeddings: (model) => factory(platform, model) })
```

**删除**：

- `createKnowledgeRuntime({ ollamaBaseUrl: initialOllama.ollamaUrl })`
- 知识库路径上对 `getOllamaDefaults()` / `RXWF_OLLAMA_URL` 的依赖

**保留**（非本 spec 范围，但并存）：

- 工作流 / Agent 节点仍通过 **模型目录** + 节点 `provider` 解析 LLM
- `resolveWorkflowOllamaDefaults` 与工作流默认 Ollama 可继续使用至另 spec 统一；**不得**再作为知识库 embedding 回退

### 7.2 消费方

| 消费方 | 行为 |
|--------|------|
| `KnowledgeService.createBase` | `defaults` + `embedding.defaultModel` |
| `KnowledgeService.indexDocument` / `query` | `effectiveEmbeddingModel(kb)` + 平台 embedding 通道 |
| `ChatService.streamRag` | `modelId` 空 → `rag.defaultModelId` → `catalog.resolveModelRef` |
| `ChatBot` 默认配置 | 发布/草稿未指定 `modelId` 时用 `rag.defaultModelId` |
| `ragAnswer` 节点 | 新增参数 `usePlatformRagModel: boolean`（默认 `true`）；为 true 且节点未指定 model 时用 `rag.defaultModelId` |
| `ragRetrieve` | 仅检索，不依赖 RAG LLM 配置 |

### 7.3 配置热更新

- **一期**：保存 `knowledge.config` 后 **下次请求** 读取新配置（`settingsService` 每次 load）；已入队任务使用入队时快照或当前配置——**实现时统一为「执行 index 时读最新 config」**
- 修改 embedding 后 **必须** reindex；不依赖热更新向量

---

## 8. Reindex 策略（问题 2 细化）

| 触发 | 影响范围 | UX | 后端 |
|------|----------|-----|------|
| 平台 embedding 四元组变更 | 全部知识库 | 保存前 Modal；推荐「保存并全库 reindex」 | `reindex-all` |
| 单库 `embeddingModel` 变更 | 该库 | 详情页 Modal；「保存并 reindex 本库」 | `/:id/reindex-all` |
| 仅 `defaults.chunk*` / topK / threshold 变更 | 已有 chunk 不重算 | 提示：仅影响**新入库**文档；已有文档需手动 reindex | 无自动任务 |
| `hybridSearchEnabled` 变更 | 检索逻辑 only | 无需 reindex | 无 |

**不阻断保存**：用户可「仅保存」，但 UI 须显示 persistent warning（如顶部 banner）直至 reindex 完成或配置恢复。

---

## 9. 权限

| 角色 | `/settings/knowledge` | `PUT` / `test-embedding` | `reindex-all` |
|------|----------------------|----------------------------|---------------|
| `admin` | 读写 | ✅ | ✅ |
| `member` / `viewer` | 只读 | ❌ | ❌ |
| 知识库 `owner` / `editor` | — | — | 单库 `reindex-all` ✅ |

---

## 10. 包与文件布局（建议）

| 路径 | 职责 |
|------|------|
| `packages/knowledge/src/platform-config.ts` | 类型、parse、serialize、defaults、`isConfigured()` |
| `packages/knowledge/src/openai-embeddings.ts` | OpenAI 兼容 embedding |
| `packages/knowledge/src/create-embedding-provider.ts` | 工厂 |
| `apps/api/src/routes/knowledge-settings.ts` | GET/PUT/test API |
| `apps/api/src/knowledge/load-platform-config.ts` | 从 settings 加载 |
| `apps/web/src/features/settings/KnowledgeSettingsPage.tsx` | 设置 UI |
| `packages/system-settings/src/keys.ts` | 新增 `knowledgeConfig` |

---

## 11. 测试

| 层级 | 用例 |
|------|------|
| 单元 | `parseKnowledgePlatformConfig` 缺省/非法 JSON/边界值 |
| 单元 | `createEmbeddingProvider` ollama + openai-compatible mock fetch |
| API | 非 admin GET 只读；admin PUT；未配置时 upload 400 |
| API | `test-embedding` 成功/失败 |
| API | `reindex-all` 入队 job 数量 |
| 集成 | 配置 ollama embedding → 上传 → query 命中 |
| E2E | Admin 设置页保存；非 admin 只读；embedding 变更 Modal |

---

## 12. 实施分期

| 阶段 | 交付物 |
|------|--------|
| **M1** | `knowledge.config` 存储与 API；`KnowledgeSettingsPage`（admin 编辑 / 非 admin 只读）；运行时仅读 platform config；移除知识库对 ollamaUrl/env 依赖；创建库/详情 per-KB 字段 UI；未配置错误 |
| **M2** | `openai-compatible` embedding + test；平台/单库 reindex 提醒与 `reindex-all` API |
| **M3** | Chat/Bot/`ragAnswer` 默认 `modelId`；`usePlatformRagModel` 节点参数 |

---

## 13. 迁移说明

**无数据迁移、无向前兼容。**

部署本 spec 后：

1. Admin 必须访问 `/settings/knowledge` 完成首次配置。
2. 可移除文档中对「知识库使用 `RXWF_OLLAMA_URL`」的说明。
3. `SETTING_KEYS.ollamaUrl` / `ollamaModel` 可保留给 **工作流默认 Ollama**（若仍使用），但 **知识库代码路径不得引用**。

---

## 14. 与模型目录的关系

```text
/settings/models     → 注册 LLM Provider 与 chat 模型（通用）
/settings/knowledge  → Embedding 通道 + RAG 默认 modelId + 新建库默认
                       RAG LLM 下拉 = 模型目录子集（chat + enabled）
```

一期 **不在** 模型目录增加 `embedding` capability；避免双入口。二期可评估将 `embedding.defaultModel` 改为模型目录引用。

---

## 15. 开放项（实现前可闭合）

| # | 问题 | 建议默认 |
|---|------|----------|
| O1 | Ollama embedding 模型下拉是否拉 live `/api/tags` | M1 文本输入；M1.1 可选 live |
| O2 | `ragAnswer` `usePlatformRagModel` 默认值 | `true` |
| O3 | 全库 reindex 并发与节流 | 复用现有 `knowledge.index` 队列，不新增 kind |

---

## 16. 文档更新清单（实现后）

- [ ] `docs/help/zh/` 增加「知识库平台配置」帮助页
- [ ] `docs/INDEX.md` 登记本 spec
- [ ] 更新 [2026-05-23-knowledge-base-design.md](./2026-05-23-knowledge-base-design.md) 顶部「配置」指向本 spec
- [ ] 部署文档：删除知识库对 `RXWF_OLLAMA_URL` 的依赖说明
