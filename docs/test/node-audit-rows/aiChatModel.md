# aiChatModel — AUDIT-N-aiChatModel

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 Provider/Model/Base URL/Credential ID；`NodeEditorParamsPane` 在 `openai-compatible` 时渲染 `CredentialSelect`；`node-port-defs.ts` 默认 `provider: ollama`, `model: llama3`；E2E `@any` 覆盖面板字段 |
| validation | ok | `validate.ts`：aiAgent 缺 Chat Model → **E1012**；多 Model → **E1014**；`validate-skill.ts`：skillRun 缺卫星 → **E1043**；孤立卫星 → **W1010** |
| executor | satellite | 无独立 executor；`SATELLITE_NODE_TYPES` 含 `aiChatModel`；`modelFromChatModelNode`（`agent-satellite-tools.ts`）供父执行器解析 ModelRef；消费方：`run-ai-agent-node.ts`、`crew-helpers.ts`、`skill-run.ts` |
| error_codes | E1012,E1014,E1043,E2003,E3001,E3010,W1010 | 保存/校验与运行时错误码见下表 |
| e2e_spec | nodes/aiChatModel.spec.ts | `@any` 面板 + W1010/E1043/E1012 validate；`@plus` aiAgent+Model debug-node（Ollama 可达时） |
| status | ok | 审查通过；卫星模型配置与面板已就绪，补充单测与 E2E |

## 参数模型

- `provider`：`ollama`（默认）或 `openai-compatible`。
- `model`：模型名称，默认 `llama3`。
- `baseUrl`：可选；覆盖 Ollama / OpenAI 兼容端点。
- `credentialId`：仅 `openai-compatible` 时在面板显示；选择 API Key / OAuth 凭证。

## 执行语义

- **无独立 debug-node 执行**：registry 无 `aiChatModel` type，直接执行抛 **E2003**。
- **AI Agent / Skill Run / Crew / Group Chat**：经 `ai_languageModel` 连线收集卫星；`modelFromChatModelNode` 转为 `ModelRef` 传入 AI runtime。
- 调试时间线记录 **satellite_invoke_*** 事件，标注 Chat Model 节点名称。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 尝试经 registry 直接执行 `aiChatModel`（卫星无独立 executor） |
| E1012 | 父 **AI Agent** 未连接 Chat Model |
| E1014 | 同一父节点连接了多个 Chat Model（或其他卫星重复） |
| E1043 | **Skill Run** 缺少 Chat Model 卫星 |
| E3010 | 运行时父 Agent 缺少已连接的 Chat Model |
| E3001 | 无法连接模型端点或不支持的 Provider |
| W1010 | Chat Model 未连接到 AI Agent 或 skillRun（孤立卫星警告） |

## E2E

- Spec：`apps/web/e2e/nodes/aiChatModel.spec.ts`（E2E-N-aiChatModel）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板与 validate 用例
- 覆盖：面板 Provider/Model/Base URL；孤立 Model → W1010；skillRun 无 Model → E1043；aiAgent 无 Model → E1012；Ollama 可达时 aiAgent+Model debug-node 成功

## 备注

- 与 `llmStream` / `ollama` 不同：本节点为 Agent 卫星，非主流程独立 LLM 执行器。
- 帮助文档 `docs/help/zh/nodes/aiChatModel.md` 由 M-6 T-146 负责。
