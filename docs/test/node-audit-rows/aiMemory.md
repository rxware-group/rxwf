# aiMemory — AUDIT-N-aiMemory

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `sessionId`（Session ID）与 `maxTurns`（Max turns）；`NodeEditorParamsPane` 通用表单渲染；`node-port-defs.ts` 默认 `maxTurns: 20`；E2E `@any` 覆盖面板字段 |
| validation | ok | 无独立保存期 type 级错误码；`validate.ts` 对 aiAgent 至多一个 Memory（**E1014**）；孤立卫星警告 **W1010**；E2E validate 覆盖 W1010 |
| executor | satellite | 无独立 executor；`SATELLITE_NODE_TYPES` 含 `aiMemory`；记忆由父节点消费：`run-ai-agent-node.ts`（`agentMemory.listRecent` / `append` / `satellite_memory_snapshot`）与 `crew-memory-bridge.ts`（Crew IR `member.memory`） |
| error_codes | E1014,W1010 | `E1014`：同一 aiAgent 连接多个 Memory；`W1010`：Memory 未接到 AI Agent / skillRun（孤立卫星警告） |
| e2e_spec | nodes/aiMemory.spec.ts | `@any` 面板 Session ID/Max turns + validate W1010；`@plus` debug-node aiAgent+Memory（Ollama 可达时） |
| status | ok | 审查通过；卫星节点经 aiAgent/Crew 记忆桥接执行，补充单测与 E2E |

## 参数模型

- `sessionId`：会话键，支持 `{{ }}` 表达式；留空时回退到父 Agent `sessionId` 或执行上下文 `sessionId`。
- `maxTurns`：参与上下文的最大对话轮数（默认 **20**）；运行时换算为 `max(2, min(100, maxTurns × 2))` 条消息上限。

## 执行语义

- **无独立 debug-node 执行**：registry 无 `aiMemory` type，直接执行抛 **E2003**。
- **AI Agent**：`collectSatellites` 收集 `ai_memory` 连线；`resolveSessionId` 解析会话键；`deps.agentMemory` 加载 history 注入 `runAgent`，成功后 append user/assistant 并可选 `emitMemorySnapshot`。
- **Crew**：`crew-memory-bridge.ts` 在编排前 `enrichCrewIrWithMemory` 注入 history，结束后 `persistCrewMemory` 回写。
- **Skill Run**：Memory 口可接线；当前 Skill Run 执行器尚未注入 Memory 历史（接线预留）。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E2003 | 尝试经 registry 直接执行 `aiMemory`（卫星无独立 executor） |
| E1014 | 同一 aiAgent 连接超过一个 Memory 卫星 |
| W1010 | Memory 节点未连接到 AI Agent 或 skillRun |

## E2E

- Spec：`apps/web/e2e/nodes/aiMemory.spec.ts`（E2E-N-aiMemory）
- 轨：plus（矩阵 track）；lite 跑 `@any` 面板与 validate 用例
- 覆盖：面板 Session ID / Max turns；孤立 Memory → W1010；Ollama 可达时 aiAgent+Memory debug-node 成功

## 备注

- 存储表 `agent_session_messages`；管理端 **设置 → Agent Memory** 可查看/删除会话。
- `NodeEditorOutputPane` 对 Memory 卫星展示会话消息快照（调试父 Agent 后）。
- 帮助文档 `docs/help/zh/nodes/aiMemory.md` 由 M-6 T-147 负责。
