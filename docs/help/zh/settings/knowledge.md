# 知识库平台配置

在 **设置 → 知识库**（`/settings/knowledge`）中配置全平台共用的 RAG 能力。点击设置窗口标题栏 **帮助** 按钮可打开本页说明。

所有知识库实例共享同一套 **Embedding 通道**；单个知识库仅可覆盖 **Embedding 模型名** 与检索参数（分块、Top K、阈值等）。

## 首次配置（管理员）

1. 打开 **设置 → 模型目录**，确保已注册至少一个可用的 **对话（chat）** 模型。详见 [模型目录](/help/settings/models)。
2. 打开 **设置 → 知识库**。
3. 配置 **向量化（Embedding）**：
   - **Ollama**：填写 Base URL（如 `http://127.0.0.1:11434`）与默认模型（如 `nomic-embed-text`）。
   - **OpenAI 兼容**：填写 Base URL、API 凭证与模型名。
   - 点击 **测试 Embedding** 确认连通。
4. 选择 **默认 RAG 模型**（来自模型目录）。
5. 按需调整 **新建知识库默认值**（分块大小、Top K 等）。
6. 保存。

未保存有效配置前，创建知识库、上传文档与检索将返回错误 **E1004**。

## 修改 Embedding 后

修改 Provider、Base URL、凭证或默认 Embedding 模型后，**必须对全部知识库文档重新索引（reindex）**。保存时系统会提示；建议选择「保存并全库 reindex」。

在单个知识库详情页修改 **Embedding 模型** 时，仅需对该库执行 reindex。

## 非管理员

普通用户可在 **设置 → 知识库** 查看当前平台配置（只读），无法修改。

## 与工作流的关系

- **ragAnswer** 节点默认使用平台 RAG 模型（`usePlatformRagModel=true`）；可在节点上指定 `model` 覆盖。详见 [RAG Answer 节点](/help/nodes/ragAnswer)。
- 工作流通用 LLM 仍通过 [模型目录](/help/settings/models) 与节点 `provider` 配置，与知识库 Embedding 设置相互独立。
- Agent 可通过 [Knowledge (RAG) 卫星](/help/nodes/aiKnowledge) 注入检索结果。
