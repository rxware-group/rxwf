# aiOutputParser — AUDIT-N-aiOutputParser

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `jsonSchema`（Output JSON Schema，json 编辑器）；`NodeEditorParamsPane` 通用渲染；`node-port-defs.ts` 资源口 `ai_outputParser`；E2E `@any` 覆盖 schema 字段 |
| validation | ok | `validate.ts`：同一 aiAgent 至多一个 Output Parser（**E1014**）；孤立卫星警告 **W1010**；`jsonSchema` 可留空（运行时无 schema 则不解析 `parsed`） |
| executor | satellite | 无独立 executor；`SATELLITE_NODE_TYPES` 含 `aiOutputParser`；`outputSchemaFromParserNode` / `parseOutputParserAnswer`（`agent-satellite-tools.ts`）；父节点 `run-ai-agent-node.ts` 注入 `outputSchema` 并产出 `parsed` |
| error_codes | E2003,E1014,E3013,W1010 | registry 直接执行 → **E2003**；多 Parser 连线 → **E1014**；JSON 解析/ schema 不匹配 → **E3013**；孤立卫星 → **W1010** |
| e2e_spec | nodes/aiOutputParser.spec.ts | `@any` 面板 + validate W1010；`@plus` debug-node aiAgent+Parser（Ollama 可达时结构化输出） |
| status | ok | 审查通过；卫星 schema 解析与 Agent `parsed` 输出路径已单测与 E2E 覆盖 |

## 参数模型

- `jsonSchema`：JSON Schema 对象或 JSON 字符串；约束 Agent 最终回答为结构化 JSON；留空则不启用结构化解析。

## 执行语义

- **无独立 debug-node 执行**：registry 无 `aiOutputParser` type，直接执行抛 **E2003**。
- **AI Agent**：`collectSatellites` 收集 `ai_outputParser` 连线；`outputSchemaFromParserNode` 解析 schema；`runAgent` 接收 `outputSchema`；成功后 `parseAgentStructuredOutput` 写入输出 item 的 `parsed` 字段。
- **调试 UI**：`satellite_schema_read` 流事件；`bootstrapOutputParserDebug` 在父 Agent 成功后展示 schema。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 尝试经 registry 直接执行 `aiOutputParser` |
| E1014 | 同一 aiAgent 连接超过一个 Output Parser |
| E3013 | Agent 回答非 JSON、schema 缺必填字段或类型不匹配 |
| W1010 | Output Parser 未连接到 AI Agent 或 skillRun |

## E2E

- Spec：`apps/web/e2e/nodes/aiOutputParser.spec.ts`（E2E-N-aiOutputParser）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板与 validate 用例
- 覆盖：面板 Output JSON Schema；孤立 Parser → W1010；Ollama 可达时 aiAgent+Parser debug-node 成功并含 `parsed`

## 备注

- `NodeEditorOutputPane` 对 Parser 卫星展示 schema 与解析结果（调试父 Agent 后）。
- 帮助文档 `docs/help/zh/nodes/aiOutputParser.md` 由 M-6 T-149 负责。
