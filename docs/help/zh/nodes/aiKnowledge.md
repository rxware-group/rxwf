# Knowledge (RAG) 节点

## 用途

**知识库检索卫星**：在 Agent 执行前，用当前用户问题对指定知识库做向量（及可选关键词）检索，将命中的文档片段格式化为 **参考资料** 块，追加到父节点的 **系统提示**（RAG）。本节点**不参与主数据流**（无 `main` 输入/输出），须通过资源端口 **Knowledge**（`ai_knowledge`）接到父节点的 **Knowledge** 入口。

检索与索引由 API 进程的 **Knowledge 服务**提供（向量库 + 可选混合检索）；Lite / Standard 部署均支持侧栏 **知识库** 管理界面。

## 适用父节点

| 父节点 | 是否可选 | 说明 |
|--------|----------|------|
| **AI Agent** | 可选（至多 1 个） | 用解析后的 **User 消息** 检索，命中后注入 Agent `systemMessage` |
| **Crew 工人 / 经理** | 可选 | 工人 `aiAgent` 接 Knowledge 后编译进 Crew IR；由 `crew-knowledge-bridge` 在编排前预检索 |
| **Skill Run** | 不支持 | 画布无 `ai_knowledge` 资源口；请用主数据流上的 `ragRetrieve` / `ragAnswer` 节点 |

> 每个父 Agent **至多连接一个** Knowledge 卫星；重复接线校验报错 **E1014**。

## 参数

| 参数 | 说明 |
|------|------|
| **知识库 ID（逗号分隔）** | 一个或多个知识库 UUID，如 `a1b2c3d4-..., e5f6g7h8-...`；也兼容 JSON 数组或旧字段 `knowledgeBaseId`（单库） |

### 默认值

新建节点默认 `knowledgeBaseIds` 为空数组。已接线但未填 ID 时：**不发起检索**，行为与未挂 Knowledge 相同。

### 获取知识库 ID

1. 打开侧栏 **知识库** 列表（`/knowledge`）
2. 点击进入某知识库详情页，浏览器地址栏路径为 `/knowledge/<知识库ID>`
3. 将 ID 填入本节点参数；多库检索时以英文逗号分隔

列表卡片上也会显示该库的 **Embedding 模型**、**Top-K** 与 **相似度阈值**，这些设置作用于检索，不在本卫星节点上单独配置。

## 知识库准备（侧栏）

在接线前，建议完成以下准备：

| 步骤 | 说明 |
|------|------|
| **创建知识库** | 侧栏新建知识库，选择 Embedding 模型（默认经 Ollama 等嵌入服务） |
| **上传文档** | 支持 Markdown、纯文本、HTML、PDF 等；上传后异步 **索引**（分块 + 向量化） |
| **等待 indexed** | 文档状态为 `indexed` 后方可被检索；`failed` 需查看错误并重传 |
| **混合检索**（可选） | 知识库详情页可开启 **混合检索**：向量 + 关键词，经 RRF 融合后取 Top-K |
| **本地目录同步**（可选） | 可配置 `local_dir` 同步源，定期将目录内文件纳入知识库 |

检索时以**第一个**知识库 ID 对应的库记录为基准，读取其 `topK`、`similarityThreshold`、`embeddingModel` 与 `hybridSearchEnabled`，并在**所有**已填 ID 的库范围内搜索。

## 端口与连接

```
aiKnowledge ──ai_knowledge──→ aiAgent
```

接线方向：**从 Knowledge 节点的 Knowledge 出口** 连到 **父 AI Agent 的 Knowledge 入口**（箭头由卫星指向父节点）。

```
manualTrigger → aiAgent
aiChatModel ──ai_languageModel──→ aiAgent
aiKnowledge ──ai_knowledge──→ aiAgent
```

Crew 场景：Knowledge 接在**工人（或经理）** `aiAgent` 上，再将该 Agent 的 **Crew 工人 / 经理** 口接到 Crew 编排节点：

```
aiKnowledge ──ai_knowledge──→ aiAgent（Researcher）
aiAgent（Researcher）──crew_member──→ crewSupervisor
```

## 运行时行为

### AI Agent

1. 须已连接 Knowledge 卫星，且运行时 `deps.knowledge` 可用
2. 解析出非空的 **知识库 ID 列表** 与非空的 **User 消息**（来自 Agent 的 User 模板 / 上游 JSON）
3. 调用 `queryMany(kbIds, userMessage)` 做检索
4. 有命中时，用内置 **support** 模板（`buildRagSystemPrompt`）生成参考资料块，与 Agent 原有 **System** 提示、Output Parser 注入等**按顺序拼接**为最终 `systemMessage`
5. 参考资料块格式示例：每条片段含文档名、块序号、相似度分数与正文

**未命中时**：`queryMany` 抛出 **E3003**，本次 Agent 执行失败（与独立 `ragRetrieve` 节点一致）。若希望无资料时仍继续对话，请勿接线 Knowledge，或改用 `ragAnswer` 并配置 `fallbackToChat`。

**跳过检索**（不报错）：未填知识库 ID，或 User 消息为空，或 Knowledge 服务未配置。

### Crew 编排

- 工人 `aiAgent` 上的 Knowledge 编译为 `member.knowledge.knowledgeBaseIds`
- 编排开始前 `enrichCrewIrWithKnowledge` 以 Crew **原始任务**（`inputTask`）为查询文本预检索
- **Knowledge 注入模式**（Crew 节点参数 `crewaiKnowledgeMode`，适用于顺序 / 层级 / Supervisor Crew）：

| 模式 | 行为 |
|------|------|
| **inject**（默认） | 将 RAG 参考资料块追加到该成员 **backstory**（前缀 `Knowledge context:`） |
| **native** | 将检索块写入 `member.knowledge.chunks`，供 **CrewAI Sidecar** 原生 Knowledge 源使用 |

任务文本为空时跳过 Crew 级预检索。成员已配置知识库但检索无命中时同样可能触发 **E3003**。

### 与 Chat Model / Memory 的关系

- Knowledge **不替代** Chat Model；父 Agent 仍须连接 **Chat Model**
- Memory 与 Knowledge **可同时**挂在同一 Agent：先按 Session 加载历史，再在本轮 User 消息上检索并注入系统提示

## 与主数据流 RAG 节点的区别

| 方式 | 节点 | 数据流 | 典型用途 |
|------|------|--------|----------|
| **卫星 RAG** | `aiKnowledge` → `aiAgent` | 无 main；注入系统提示 | Agent / Crew 内隐式检索 |
| **检索节点** | `ragRetrieve` | 有 main 入/出；输出 chunk 列表 | 工作流中显式拿片段、再接 Code / LLM |
| **问答节点** | `ragAnswer` | 有 main；检索 + 调模型生成答案 | 独立问答链，支持无命中回退聊天 |

Skill Run 等无 `ai_knowledge` 口的节点，请使用 `ragRetrieve` / `ragAnswer`。

## 示例

### 示例 A

1. 侧栏创建知识库「产品手册」，上传 FAQ，等待 **indexed**
2. 复制 ID 到 `aiKnowledge` **知识库 ID**
3. `aiKnowledge` → `aiAgent`，`aiChatModel` → Agent
4. Trigger 输入 `{ "question": "如何重置密码？" }`

### 示例 B

**知识库 ID**：`kb-faq-uuid, kb-release-notes-uuid`（英文逗号分隔）

### 示例 C

工人 `aiAgent`「Researcher」接 Knowledge + Chat Model，**Crew 工人** → `crewSupervisor`；Supervisor **Knowledge 注入模式** 选 `inject` 或 Sidecar 场景 `native`。

## 常见错误

| 错误码 | 说明 |
|--------|------|
| **E1014** | 同一父 Agent 连接了多个 Knowledge（或其他重复卫星） |
| **W1010** | Knowledge 未接到 AI Agent（孤立卫星警告） |
| **E3003** | RAG 未找到相关内容（已配置库 ID 且发起检索但无命中） |
| **E3001** | Knowledge / AI 运行时未配置 |
| **E1001** | 知识库或文档不存在 |

更多 AI / RAG 类错误见 [error-codes.md](../../../error-codes.md)。

## 调试与 INPUT 面板

- Knowledge 卫星**无独立执行按钮**；随父 Agent 或 Crew 调试运行
- 父 Agent 日志中可查看合并后的系统提示是否含 `## 参考资料` 段
- 检索失败（E3003）时检查：文档是否已 `indexed`、问题是否与库内用语相关、是否需降低知识库 **相似度阈值**

## 参见

- [AI Agent 节点](/help/nodes/aiAgent) — Knowledge 入口与 System / User 提示
- [Chat Model 节点](/help/nodes/aiChatModel) — 必填语言模型卫星
- [Memory 节点](/help/nodes/aiMemory) — 会话记忆（可与 Knowledge 并用）
- [Crew (Supervisor) 节点](/help/nodes/crewSupervisor) — 工人 Knowledge 与注入模式
- [表达式与 `{{ }}` 模板](/help/expressions) — 动态知识库 ID
