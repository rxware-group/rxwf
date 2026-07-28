# ragRetrieve — AUDIT-N-ragRetrieve

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `query`（textarea）；`NodeEditorParamsPane` 渲染 `KnowledgeBaseIdsField`；E2E `@any` 覆盖查询与知识库字段 |
| validation | ok | 无独立保存期 type 级错误码；`knowledgeBaseIds` / `query` 可留空（运行时 E1004；query 可取自上游 input item） |
| executor | ok | `createRagExecutors`（`packages/node-runner/src/executors/rag.ts`）经 `registerPlusExecutors` 注册 `type: ragRetrieve`；`rag.test.ts` 覆盖 chunk 输出与 E1004/E3001/E3003 |
| error_codes | E1004,E3001,E3003 | 缺 `knowledgeBaseIds` 或 query → `E1004`；Knowledge 未配置 → `E3001`；检索无命中 → `E3003`（由 `knowledge.queryMany` 抛出） |
| e2e_spec | nodes/ragRetrieve.spec.ts | `@any` 面板 + debug-node E1004/E3003；Ollama 可达时成功检索 |
| status | ok | 审查通过；执行器与面板已就绪，补充单测与 E2E |

## 参数模型

- `knowledgeBaseIds`：字符串数组；支持 `KnowledgeBaseIdsField` 多选；兼容 legacy `knowledgeBaseId` 单值。
- `query`：检索文本；留空则从首条 input item 的 `query` / `question` / `content` / `text` 字段解析。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: ragRetrieve`。
- 成功输出：单分支 item 列表，每项 `{ id, text, score, documentId, documentName, chunkIndex, knowledgeBaseId }`。
- 不调用 LLM；仅向量/关键词检索。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1004 | `knowledgeBaseIds` 为空或未配置 |
| E1004 | `query` / prompt 缺失且 input item 无可用字段 |
| E3001 | `deps.knowledge` 未注入（Knowledge RAG 未配置） |
| E3003 | 知识库检索无命中（`queryMany` 抛出） |

## E2E

- Spec：`apps/web/e2e/nodes/ragRetrieve.spec.ts`（E2E-N-ragRetrieve）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板用例
- 覆盖：面板查询/知识库字段；debug-node 缺 kbIds/query → E1004；空库检索 → E3003；Ollama 可达时上传文档并成功检索

## 备注

- 依赖 Plus profile 与 Knowledge 服务（Lite/Standard 均创建 `knowledge` runtime）。
- 帮助文档 `docs/help/zh/nodes/ragRetrieve.md` 由 M-6 T-137 负责。
