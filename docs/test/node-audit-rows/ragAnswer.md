# ragAnswer — AUDIT-N-ragAnswer



> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。



| 维度 | 结论 | 证据 |

| --- | --- | --- |

| panel | ok | `node-param-schemas.ts` 提供 Model/问题/模板/无命中回退；`KnowledgeBaseIdsField` + `OllamaModelParamField`（`resolveOllamaModelField`）；`NodeEditorParamsPane` 集成 |

| validation | ok | 无独立保存期 type 级错误码；`knowledgeBaseIds`/`query` 可留空（运行时 E1004） |

| executor | ok | `createRagExecutors`（`executors/rag.ts`）经 `registerPlusExecutors` 注册 `type: ragAnswer`；`rag.test.ts` 覆盖检索+生成、E1004/E3001/E3003 与 fallback |

| error_codes | E1004,E3001,E3003 | `E1004`：缺少 `knowledgeBaseIds` 或 `query`；`E3001`：Knowledge 或 AI runtime 未配置；`E3003`：检索无命中（`fallbackToChat` 时可回退纯对话） |

| e2e_spec | nodes/ragAnswer.spec.ts | `@any` 面板；`@plus` debug-node E1004/E3003 fallback/带引用 live 冒烟 |

| status | ok | 审查通过；修复 `fallbackToChat` 条件运算符优先级 |



## 参数模型



- `knowledgeBaseIds`：知识库 ID 列表（面板 `KnowledgeBaseIdsField`）；运行时必填。

- `model`：可选 Ollama 模型；留空则 `resolveOllamaModelRef` 使用系统默认。

- `query`：用户问题；可留空并从上游 item 的 `query`/`question`/`content`/`text` 解析。

- `ragTemplate`：`support`（默认）或 `code`，影响 RAG system prompt 模板。

- `fallbackToChat`：`true`/`false`；检索 E3003 时是否回退为无引用纯对话（输出 `ragMiss: true`）。



## 执行语义



- Plus 执行器：`registerPlusExecutors` → `createRagExecutors` 中 `type: ragAnswer`。

- 成功输出：`{ answer: string, citations: Citation[], ragMiss: boolean }` 单 item。

- 检索命中：`ragMiss: false`，`citations` 来自 `chunksToCitations`。

- 无命中且 `fallbackToChat`：直接 `ai.chat` 单轮 user 消息，`citations: []`，`ragMiss: true`。



## 错误码



| 代码 | 场景 |

| --- | --- |

| E1004 | `knowledgeBaseIds` 为空或 `query`/输入 item 均无有效问题文本 |

| E3001 | `deps.knowledge` 或 `deps.ai` 未注入 |

| E3003 | `queryMany` 无相关内容；未启用 fallback 时抛出 |

| E2003 | registry 未注册 `ragAnswer`（Plus 轨外或 lite 环境） |



## E2E



- Spec：`apps/web/e2e/nodes/ragAnswer.spec.ts`（E2E-N-ragAnswer）

- 轨：plus（matrix）；lite `@any` 面板验收；plus `@plus` debug-node

- 覆盖：知识库选择 + Model/问题/模板/回退字段可见；空白 `knowledgeBaseIds` → E1004；Ollama+KB 可达时可选 live 冒烟



## 备注



- 依赖 Plus 轨 Knowledge 服务与 AI runtime（通常 Ollama）；compose 默认不含向量库/Ollama，live 路径条件 skip。

- 帮助文档 `docs/help/zh/nodes/ragAnswer.md` 由 M-6 T-138 负责。

