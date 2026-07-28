# ADR-001：采用 LangChain.js / LangGraph.js 作为 AI 运行时

| 字段 | 内容 |
|------|------|
| **状态** | 已接受（Accepted） |
| **日期** | 2026-05-19 |
| **决策者** | 架构 / 产品 |
| **关联 PRD** | [spec.md](../.trae/specs/workflow-system/spec.md) FR-15.0、FR-15、FR-16 |
| **替代方案** | 见 §8 |

---

## 1. 背景与问题

rx-workflow 需在 Node.js 后端交付 **Agent 编排、RAG、LLM/Embedding、Tool Calling**（FR-15），并与自研 **DAG 工作流引擎、Items 模型、MCP Server**（FR-13/16）共存。

需明确：

1. LangChain 是否可免费用于私有化商业产品？
2. 依赖如何选型与锁定，避免版本漂移？
3. 如何通过 **`AiRuntime` 抽象** 隔离框架，防止 API 泄漏？

---

## 2. 决策摘要

**采用 LangChain.js + LangGraph.js（MIT）作为 AI 专用运行时；工作流编排、MCP Server、队列与权限仍由自研引擎负责。**

- **LangChain.js**：RAG 链、Document Loader、Text Splitter、VectorStore、ChatModel/Embeddings 抽象。
- **LangGraph.js**：Agent 循环（Tool Calling）、状态图、多 Agent Handoff、流式中间步骤。
- **LangSmith / LangGraph Platform**：**不纳入 v1.x 关键路径**；可后续作为可选观测插件。

---

## 3. 许可与费用

| 包 / 服务 | 许可 | 商用 | 备注 |
|-----------|------|------|------|
| `@langchain/core` | MIT | ✓ | 基础类型与 Runnable |
| `langchain` | MIT | ✓ | 高层链与工具；按需引入 |
| `@langchain/langgraph` | MIT | ✓ | Agent 图运行时 |
| `@langchain/community` | MIT | ✓ | Ollama、PGVector 等 |
| `@langchain/ollama` | MIT | ✓ | 推荐本地模型 |
| `@langchain/openai` | MIT | ✓ | OpenAI 及兼容网关 |
| **LangSmith** | SaaS | 可选 | 免费档约 5k traces/月；**默认用自建日志 + OTel** |
| **LangGraph Platform** | SaaS | 不采用 | 与自研执行引擎重复 |

**不产生框架授权费用**；费用来自模型 API、服务器与（若启用）LangSmith 超额。

---

## 4. 依赖清单与版本锁定

### 4.1 锁定策略（2026-05-19 调研）

- 主版本锁定 **1.x**；小版本、补丁版本允许在 CI 通过后升级。
- 使用 **caret（`^`）** 接收同主版本内修复；每月检查一次 `@langchain/*` 安全公告。
- **禁止** 业务代码直接 `import` 超过 `packages/ai-runtime` 边界（见 §6）。

### 4.2 推荐依赖（后端 `package.json`）

以下为 **2026-05-19** 自 npm registry 查询的 latest，写入 ADR 时作基准；实施时以 `npm view <pkg> version` 再确认一次。

```json
{
  "dependencies": {
    "@langchain/core": "^1.1.47",
    "@langchain/langgraph": "^1.3.2",
    "langchain": "^1.4.1",
    "@langchain/community": "^1.1.28",
    "@langchain/ollama": "^1.2.7",
    "@langchain/openai": "^1.4.6",
    "zod": "^3.24.0"
  },
  "optionalDependencies": {
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "@langchain/langgraph-cli": "^0.0.40"
  }
}
```

| 包 | 基准版本 | 用途 | 是否 v1.0 必需 |
|----|----------|------|----------------|
| `@langchain/core` | 1.1.47 | 消息、Runnable、Tool 类型 | ✓ |
| `@langchain/langgraph` | 1.3.2 | Agent 图、预构建 ReAct Agent | v1.1 |
| `langchain` | 1.4.1 | LCEL、`createRetrievalChain` 等 | v1.1（RAG） |
| `@langchain/community` | 1.1.28 | PGVector、部分 Loader | v1.1 |
| `@langchain/ollama` | 1.2.7 | 本地 Ollama Chat/Embeddings | ✓ P1 |
| `@langchain/openai` | 1.4.6 | OpenAI 及兼容 baseURL | ✓ P1 |
| `zod` | 3.x | Tool schema、Structured Output | ✓ |

**不建议 v1.0 全量引入 `langchain` 主包**，若仅需 Chat + Ollama，可只装 `@langchain/core` + `@langchain/ollama` + `@langchain/openai`，RAG 阶段再增加 `langchain` 与 `@langchain/community`。

### 4.3  peer / Node 要求

- **Node.js** `>= 20`（与 LangGraph.js 及项目统一）
- **PostgreSQL** + `pgvector`（**Standard** 档位 RAG 默认）；**Lite** 档位见 [adr-deployment.md](./adr-deployment.md)（v1.1 sqlite-vec 或关闭 RAG）

### 4.4 可选依赖（插件化）

| 包 | 场景 |
|----|------|
| `langsmith` | 客户明确要求对接 LangSmith 时启用 |
| `@langchain/mistralai` 等 | 按模型目录扩展 |
| `bullmq` | 已有；用于 AI 任务队列，与 LangChain 无关 |

---

## 5. 架构与模块边界

```
┌─────────────────────────────────────────────────────────────────┐
│ apps/api / workflow-engine                                       │
│  ├─ nodes/*          ← 工作流节点执行器（只依赖 AiRuntime）       │
│  ├─ mcp-server/*    ← IDE MCP（自研，禁止依赖 LangChain）        │
│  └─ execution/*     ← DAG、Items、BullMQ（自研）                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ 仅通过接口
┌────────────────────────────▼────────────────────────────────────┐
│ packages/ai-runtime          ← 唯一允许 import @langchain/* 的包   │
│  ├─ AiRuntime.ts             接口定义                             │
│  ├─ LangChainRuntime.ts      实现                                 │
│  ├─ models/                  ChatModel / Embeddings 工厂          │
│  ├─ agents/                  LangGraph Agent 构建与执行           │
│  ├─ rag/                     检索链封装                           │
│  └─ tools/                   MCP / Workflow / HTTP Tool 适配      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ @langchain/core | @langchain/langgraph | @langchain/ollama | …   │
└─────────────────────────────────────────────────────────────────┘
```

**规则**

1. `apps/*` 禁止 `from '@langchain/...'`。
2. LangChain 异常在 `LangChainRuntime` 内映射为 `AiRuntimeError`（含 `code`、`retryable`）。
3. Agent 的 `maxIterations`、超时、Tool 白名单由 **调用方（节点执行器）** 传入，不由框架默认值单独决定。

---

## 6. `AiRuntime` 接口草案

> 路径建议：`packages/ai-runtime/src/AiRuntime.ts`  
> 以下为 **v1 接口草案**，实施时可拆为多个文件，但对外导出面保持稳定。

### 6.1 通用类型

```typescript
/** 与工作流 Items 对齐的简化结构 */
export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: Record<string, { data: Buffer | string; mimeType?: string }>;
}

export interface AiExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: string;
  environment: 'dev' | 'staging' | 'prod';
  /** 用于 Memory 跨 Run（Chat 触发器） */
  sessionId?: string;
  signal?: AbortSignal;
  onStream?: (chunk: AiStreamChunk) => void;
}

export type AiStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; tool: string; input: unknown }
  | { type: 'tool_end'; tool: string; output: unknown }
  | { type: 'agent_step'; step: unknown };

export interface ModelRef {
  provider: 'ollama' | 'openai-compatible' | string;
  model: string;
  baseUrl?: string;
  credentialId?: string;
}

export interface AiRuntimeError extends Error {
  code:
    | 'MODEL_UNAVAILABLE'
    | 'TIMEOUT'
    | 'TOOL_FAILED'
    | 'ITERATION_LIMIT'
    | 'OUTPUT_PARSE_FAILED'
    | 'RATE_LIMIT'
    | 'UNKNOWN';
  retryable: boolean;
  cause?: unknown;
}
```

### 6.2 主接口

```typescript
export interface AiRuntime {
  // ─── LLM ─────────────────────────────────────────────
  chat(
    input: ChatInput,
    ctx: AiExecutionContext,
  ): Promise<WorkflowItem[]>;

  // ─── Embedding ───────────────────────────────────────
  embed(
    input: EmbedInput,
    ctx: AiExecutionContext,
  ): Promise<number[][]>;

  // ─── RAG ─────────────────────────────────────────────
  ingest(input: RagIngestInput, ctx: AiExecutionContext): Promise<RagIngestResult>;

  retrieve(input: RagRetrieveInput, ctx: AiExecutionContext): Promise<RagRetrieveResult>;

  /** 检索 + 生成，返回带 citations 元数据的 Items */
  ragAnswer(input: RagAnswerInput, ctx: AiExecutionContext): Promise<WorkflowItem[]>;

  // ─── Agent ───────────────────────────────────────────
  runAgent(input: AgentRunInput, ctx: AiExecutionContext): Promise<AgentRunResult>;

  // ─── 工具注册（运行时组装）────────────────────────────
  createToolRegistry(defs: ToolDefinition[]): ToolRegistry;
}

export interface ChatInput {
  model: ModelRef;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Structured Output */
  outputSchema?: z.ZodTypeAny; // 实际代码中 import zod
}

export interface EmbedInput {
  model: ModelRef;
  texts: string[];
}

export interface RagIngestInput {
  collectionId: string;
  documents: Array<{ source: string; content: string; metadata?: Record<string, unknown> }>;
  embeddingModel: ModelRef;
  split?: { strategy: 'fixed'; chunkSize: number; overlap: number };
}

export interface RagRetrieveInput {
  collectionId: string;
  query: string;
  embeddingModel: ModelRef;
  topK?: number;
  scoreThreshold?: number;
}

export interface RagAnswerInput {
  collectionId: string;
  query: string;
  chatModel: ModelRef;
  embeddingModel: ModelRef;
  systemPrompt?: string;
}

export interface AgentRunInput {
  model: ModelRef;
  systemPrompt?: string;
  userMessage: string;
  tools: ToolDefinition[];
  memory?: { type: 'buffer'; maxTurns: number } | { type: 'session'; sessionId: string };
  maxIterations: number; // 硬上限由执行器传入，默认 10
  timeoutMs: number;
  returnIntermediateSteps?: boolean;
  outputSchema?: z.ZodTypeAny;
}

export interface AgentRunResult {
  items: WorkflowItem[];
  intermediateSteps?: unknown[];
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  /** 由 ai-runtime 根据 type 分发到 MCP / 工作流 / HTTP 等适配器 */
  source:
    | { type: 'mcp'; serverId: string; toolName: string }
    | { type: 'workflow'; workflowId: string }
    | { type: 'http'; /* ... */ }
    | { type: 'builtin'; name: 'calculator' | string };
}

export interface ToolRegistry {
  invoke(name: string, args: Record<string, unknown>, ctx: AiExecutionContext): Promise<unknown>;
}
```

### 6.3 工厂与实现类

```typescript
export interface AiRuntimeFactory {
  create(config: AiRuntimeConfig): AiRuntime;
}

export interface AiRuntimeConfig {
  /** 解析 credentialId → API Key / OAuth（自研凭证服务） */
  credentialResolver: (credentialId: string) => Promise<Record<string, string>>;
  /** pgvector 等 */
  vectorStore: VectorStoreConfig;
  ollama?: { baseUrl: string };
  defaults?: { timeoutMs: number; maxAgentIterations: number };
}

/** 唯一 LangChain 实现；apps 仅依赖 AiRuntime 接口 */
export class LangChainRuntime implements AiRuntime {
  constructor(private readonly config: AiRuntimeConfig) {}
  // chat / embed / rag* / runAgent → 内部调用 @langchain/*
}
```

### 6.4 节点执行器调用示例

```typescript
// apps/api/src/nodes/LlmChatNodeExecutor.ts
export async function executeLlmChatNode(
  node: LlmChatNodeConfig,
  items: WorkflowItem[],
  ctx: NodeExecutionContext,
  ai: AiRuntime,
): Promise<WorkflowItem[]> {
  const prompt = resolveExpressions(node.promptTemplate, items, ctx);
  return ai.chat(
    {
      model: node.model,
      messages: [
        ...(node.systemPrompt ? [{ role: 'system' as const, content: node.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      stream: node.stream,
    },
    toAiContext(ctx),
  );
}
```

---

## 7. LangGraph / LangChain 映射表

| PRD 能力 | LangChain / LangGraph 组件 | 封装方法 |
|----------|---------------------------|----------|
| LLM Chat | `ChatOllama` / `ChatOpenAI` | `AiRuntime.chat` |
| 流式输出 | `.stream()` / `streamEvents` | `ctx.onStream` |
| Embedding | `OllamaEmbeddings` 等 | `AiRuntime.embed` |
| RAG 入库 | `RecursiveCharacterTextSplitter` + `PGVectorStore.addDocuments` | `AiRuntime.ingest` |
| RAG 检索 | `vectorStore.similaritySearch` | `AiRuntime.retrieve` |
| RAG 回答 | LCEL retrieval chain | `AiRuntime.ragAnswer` |
| Tools Agent | `createReactAgent` 或自建 `StateGraph` | `AiRuntime.runAgent` |
| MCP Tool | `DynamicStructuredTool` + MCP 客户端 | `ToolDefinition.source.type === 'mcp'` |
| 工作流 Tool | 自定义 Tool → 调执行引擎 API | `source.type === 'workflow'` |
| Memory | `BufferWindowMemory` / 自研 session store | `AgentRunInput.memory` |
| Structured Output | `withStructuredOutput` / Zod | `outputSchema` |
| Crew 顺序流 | 多 Agent + LangGraph 顺序边 | `AiRuntime.runCrew`（v1.1，见 spec FR-15.4-D） |
| Group Chat | LangGraph 多 Agent 消息图 | `AiRuntime.runGroupChat`（v1.1，见 spec FR-15.4-E） |

---

## 8. 曾考虑的替代方案

| 方案 | 优点 | 未采纳原因 |
|------|------|------------|
| **自研 Agent 循环** | 零依赖、完全可控 | RAG/Tool/多模型适配工期长 |
| **Python LangChain 微服务** | 生态最大 | 双语言运维、Items 序列化开销 |
| **Vercel AI SDK only** | 轻量 | Agent 图、RAG、VectorStore 需大量自研 |
| **直接调用 OpenAI API** | 最简单 | 无法统一 Ollama/RAG/Tool 抽象 |
| **LangGraph Platform 托管** | 省运维 | 与自研 DAG/MCP/多环境冲突 |

---

## 9. 分阶段落地

| 阶段 | 交付 | 依赖包 |
|------|------|--------|
| **Phase 0** | `packages/ai-runtime` 脚手架 + `LangChainRuntime.chat`（Ollama/OpenAI） | core, ollama, openai |
| **Phase 1（v1.0 P1）** | 流式 Chat、节点执行器对接 | 同上 |
| **Phase 1b（v1.0 P1）** | **FR-17 AI Chat** 纯模型对话 UI + `AiRuntime.chat` | 同上 |
| **Phase 2（v1.1）** | `runAgent`、MCP/Workflow Tool；**FR-17 RAG** `ingest/retrieve/ragAnswer` | + langgraph, langchain, community |
| **Phase 3（v1.1）** | Agent 工作流；**Crew**（顺序 process）；**Group Chat**（LangGraph 多节点） | langgraph |
| **Phase 4（v2.0）** | Supervisor；Agent 评测集 | langgraph-supervisor（可选） |
| **Phase 5（可选）** | LangSmith 导出 adapter | langsmith |

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| LangChain 小版本 API 变动 | 隔离在 `ai-runtime`；契约测试 + 锁定 ^1.x |
| 依赖体积大 | 按需 import；`knip` / bundle 分析 CI |
| Agent 无限循环 | `maxIterations` + `timeoutMs` 双限；执行器强制 |
| 密钥进入 LangSmith | 默认关闭；仅传 traceId，不传 key |
| Ollama 并发打满 GPU | 产品层队列 + `AiRuntimeConfig` 并发配置 |
| 供应商锁定 | `AiRuntime` 接口 + 映射层，保留替换空间 |

---

## 11. 测试策略

| 层级 | 内容 |
|------|------|
| **单元** | `LangChainRuntime` 使用 mock ChatModel / mock VectorStore |
| **集成** | Testcontainers PostgreSQL+pgvector；可选 Testcontainers Ollama |
| **契约** | `AiRuntime` 接口快照测试；节点执行器只测 mock `AiRuntime` |
| **回归** | 固定 Prompt 的 Agent golden test（迭代次数、Tool 调用序列） |

---

## 12. 开放项（待下一条 ADR 或实施时关闭）

- [ ] `packages/ai-runtime` 是否拆为独立 npm workspace 包名 `@rxwf/ai-runtime`
- [ ] PGVector 表结构与工作流租户隔离方案
- [ ] LangSmith 可选模块的环境变量命名（`LANGSMITH_API_KEY` vs 禁用默认）
- [ ] Supervisor 多 Agent 用 `langgraph-supervisor` 还是自建 StateGraph

---

## 13. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-05-19 | 初稿：许可、依赖锁定、AiRuntime 草案、架构边界 |
| 2026-05-19 | 补充 Lite/Standard 下 pgvector 与 SQLite 向量策略，关联 ADR-002 |
