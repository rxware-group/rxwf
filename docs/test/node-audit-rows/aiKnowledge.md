# aiKnowledge — AUDIT-N-aiKnowledge

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 中 `aiKnowledge: []`（无 schema 字段）；`NodeEditorParamsPane` 与 `ragRetrieve` 共用 `KnowledgeBaseIdsField`；无独立 `aiKnowledge.tsx` |
| validation | ok | `validate.ts`：`E1014`（同一 Agent 连接多个 Knowledge）；孤立卫星 `W1010`；空 `knowledgeBaseIds` 允许（运行时跳过检索） |
| executor | satellite | 无独立 Plus 执行器；`SATELLITE_NODE_TYPES` 含 `aiKnowledge`；运行时经 `run-ai-agent-node`（Agent 父节点）与 `enrichCrewIrWithKnowledge`（Crew 工人/经理）消费 |
| error_codes | E1014,W1010,E3003,E3001 | `E1014`：重复 Knowledge 接线；`W1010`：Knowledge 未接 Agent；`E3003`：已配置库 ID 且发起检索但无命中；`E3001`：Knowledge / AI 运行时未配置 |
| e2e_spec | nodes/aiKnowledge.spec.ts | `@any` 面板知识库字段；`@plus` debug-node Agent+E3003 空库 / Ollama 可达时 indexed 冒烟 |
| status | ok | 审查通过；卫星 RAG 桥接与面板已就绪 |

## 参数模型

- `knowledgeBaseIds`：字符串数组；支持 `KnowledgeBaseIdsField` 多选；兼容 legacy `knowledgeBaseId` 单值。
- 无独立 query 参数：Agent 场景以 User 消息为检索 query；Crew 场景以 `inputTask` 为 query。

## 执行语义

- **卫星节点**：不参与主数据流；须通过 `ai_knowledge` 端口接到 `aiAgent`（或 Crew 工人 Agent）。
- **AI Agent 父节点**：`runAiAgentNode` 在 `deps.knowledge` 可用且 kbIds + userMessage 非空时调用 `queryMany`，将 `buildRagSystemPrompt` 块追加到 `systemPrompt`。
- **Crew 编排**：工人 Agent 上的 Knowledge 编译为 `member.knowledge.knowledgeBaseIds`；`enrichCrewIrWithKnowledge` 预检索并按 `crewaiKnowledgeMode`（`inject` / `native`）注入 backstory 或 chunks。
- **跳过检索**（不报错）：未填知识库 ID、User 消息 / inputTask 为空、或 `deps.knowledge` 未注入。

## 端口

- `ai_knowledge`：Knowledge 出口 → 父 Agent 的 Knowledge 入口（卫星 → 父节点）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1014 | 同一 AI Agent 连接了多个 Knowledge 卫星 |
| W1010 | Knowledge 卫星未接到 AI Agent |
| E3003 | 已配置库 ID 且发起检索但知识库无命中（`queryMany` 抛出） |
| E3001 | Knowledge 或 AI 运行时未配置 |
| E1001 | 知识库或文档不存在 |

## E2E

- Spec：`apps/web/e2e/nodes/aiKnowledge.spec.ts`（E2E-N-aiKnowledge）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板用例
- 覆盖：面板「知识库」字段；Agent + Knowledge 卫星 debug-node 空库 → E3003；Ollama 可达时上传文档并成功执行 Agent

## 备注

- 与 `ragRetrieve` / `ragAnswer` 区别：本节点为 Agent 卫星，隐式注入系统提示，无 main 入/出。
- 帮助文档 `docs/help/zh/nodes/aiKnowledge.md` 由 M-6 T-148 负责。
- 单测：`packages/node-runner/src/executors/crew-knowledge-bridge.test.ts` 覆盖卫星 registry 断言、inject/native 模式、E3003 传播与 manager  enrichment。
