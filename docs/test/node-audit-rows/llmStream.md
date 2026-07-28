# llmStream — AUDIT-N-llmStream

> M-3 节点审查单行记录（action / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 Model/Prompt；`resolveOllamaModelField` + `OllamaModelParamField` 渲染模型下拉；`NodeEditorParamsPane` 集成 |
| validation | ok | 无独立保存期 type 级错误码；`model` 可留空（运行时走系统默认 Ollama 模型） |
| executor | ok | `createLlmStreamExecutor`（`executors/llm-stream.ts`）经 `registerPlusExecutors` 注册；`llm-stream.test.ts` 覆盖 E2003/E3001 与 stream 输出 |
| error_codes | E2003,E3001 | `E2003`：registry 未注册 `llmStream`；`E3001`：AI runtime 未配置或 Ollama 端点不可达（`errorMessage` 含话术） |
| e2e_spec | nodes/llmStream.spec.ts | `@any` 面板；`@plus` debug-node 可达时成功 / 不可达时 failed |
| status | ok | 审查通过；执行器模块已提取并单测覆盖 |

## 参数模型

- `model`：可选；留空则 `resolveOllamaModelRef` 使用系统设置中的默认 Ollama 模型。
- `prompt`：用户消息文本，作为单轮 `user` chat 传入 AI runtime。

## 执行语义

- Plus 执行器：`registerPlusExecutors` 注册 `type: llmStream`。
- 成功输出：`{ stream: string }` 单 item（聚合 chat 流式 chunk 为完整文本）。
- 失败：`status: failed`，`errorMessage` 含 `E3001` 或连接错误（无独立 `errorCode` 字段）。

## 关联文档

- 帮助：`docs/help/zh/nodes/llmStream.md`（T-136）
- E2E 矩阵：`docs/test/e2e-coverage-matrix.md` — E2E-N-llmStream（plus track）

## 备注

- 与 `ollama` 共用 `runOllamaChat`；差异为输出字段 `stream` 而非 `response`。
- 依赖本机或设置中配置的 Ollama 服务（默认 `http://127.0.0.1:11434`）；plus E2E compose 不含 Ollama 容器。
