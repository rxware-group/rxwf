# llm — AUDIT-N-llm

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 类型/服务地址/Model/Prompt；`resolveOllamaModelField` + `OllamaModelParamField` 按节点 baseUrl 拉取模型；`NodeEditorParamsPane` 集成 |
| validation | ok | 无独立保存期 type 级错误码；`model` 可留空（节点内默认 `llama3`） |
| executor | ok | `createLlmExecutor`（`executors/llm.ts`）经 `registerPlusExecutors` 注册；`llm.test.ts` 覆盖 E2003/E3001 与 chat 输出 |
| error_codes | E2003,E3001 | `E2003`：registry 未注册 `llm`；`E3001`：AI runtime 未配置或模型端点不可达（`errorMessage` 含话术） |
| e2e_spec | nodes/llm.spec.ts | `@any` 面板；`@standard` debug-node 可达时成功 / 不可达时 failed |
| status | ok | 审查通过；执行器模块已提取并单测覆盖 |

## 参数模型

- `provider`：`ollama` 或 `openai-compatible`。
- `baseUrl`：服务地址，Ollama 默认 `http://127.0.0.1:11434`。
- `model`：可选；留空则运行时使用 `llama3`（仍走节点 `baseUrl`）。
- `prompt`：用户消息文本，作为单轮 `user` chat 传入 AI runtime。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: llm`。
- 成功输出：`{ response: string }` 单 item。
- 失败：`status: failed`，`errorMessage` 含 `E3001` 或连接错误（无独立 `errorCode` 字段）。

## 关联文档

- 帮助：`docs/help/zh/nodes/llm.md`（T-135）
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-llm（plus track；standard 轨验收）

## 备注

- 依赖节点参数中的服务地址（Ollama 默认 `http://127.0.0.1:11434`）；plus E2E compose 不含 Ollama 容器。
- `llmStream` 节点复用相同 `runLlmChat` 模式（遗留节点，推荐使用 `llm`）。
