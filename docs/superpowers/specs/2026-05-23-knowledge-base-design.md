# 知识库（RAG）设计

**日期:** 2026-05-23  
**范围:** FR-17.5 / FR-17.6 / FR-17.8 / FR-17.12（用户选择全量 C）

> **平台配置（Embedding / RAG 默认 / 设置页）** 见 [2026-06-22-knowledge-platform-config-design.md](./2026-06-22-knowledge-platform-config-design.md)。

## 目标

在 Lite（SQLite + 应用层余弦检索）与 Standard（PostgreSQL + pgvector）上交付知识库 CRUD、多格式文档入库、异步入库任务、命中测试、Chat RAG 问答（含引用与无命中 E3003）。

## 架构

- **`@rxwf/knowledge`**：分块、解析、Embedding（Ollama）、检索、入库流水线、`createKnowledgeService`
- **`KnowledgeRepository` + `VectorStorePort`**：contracts；Lite/Standard 各一套实现
- **任务 `knowledge.index`**：复用 `jobs` 表；`JobProcessor` 多 handler
- **文件存储**：`{RXWF_DATA_DIR}/knowledge/{kbId}/{docId}.{ext}`
- **Chat**：会话字段 `mode` / `knowledgeBaseIds`；流式 RAG 经 `streamRagReply`

## 数据模型

| 表 | 要点 |
|----|------|
| `knowledge_bases` | 名称、描述、embedding 模型、分块参数、topK、阈值 |
| `knowledge_documents` | 状态 pending/indexing/indexed/failed、文件路径、chunk_count |
| `knowledge_chunks` | text、embedding（Lite: JSON；Standard: vector(768)） |

## API（节选）

- `GET/POST /api/knowledge-bases`
- `GET/PATCH/DELETE /api/knowledge-bases/:id`
- `POST /api/knowledge-bases/:id/documents`（multipart 或 JSON base64）
- `GET /api/knowledge-bases/:id/documents`
- `DELETE /api/knowledge-bases/:id/documents/:docId`
- `POST /api/knowledge-bases/:id/documents/:docId/reindex`
- `GET /api/knowledge-bases/:id/chunks`（预览分块）
- `POST /api/knowledge-bases/:id/query`（命中测试）
- Chat：`PATCH /api/chat/sessions/:id`；`POST .../stream` 支持 `mode: rag`

## 已实现补充（2026-05-23 续）

- **Standard**：`createStandardKnowledgeRepository` + `createPgVectorStore`（pgvector 优先，失败回退 JSON 余弦）
- **Standard 档位**：知识库元数据与向量存 PostgreSQL；`knowledge.index` 任务仍入 Lite `jobs` 表，Standard 下同样启动 Lite job 循环
- **工作流节点**：`ragRetrieve`、`ragAnswer`（`node-runner` + 编辑器参数 schema）
- **上传**：`multipart/form-data` + 保留 JSON Base64

## 非目标（后续）

- Git/S3 同步源、混合 BM25、Bot 人设
