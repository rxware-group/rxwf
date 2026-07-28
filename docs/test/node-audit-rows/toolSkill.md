# toolSkill — AUDIT-N-toolSkill

> M-3 节点审查单行记录（agent / plus track）。矩阵合并见 T-080。

| 维度 | 结论 | 证据 |
| --- | --- | --- |
| panel | ok | `node-param-schemas.ts` 提供 `toolDescription` / `skillPath` / `mode`；`NodeEditorParamsPane` 通用表单渲染；无独立 `toolSkill.tsx` |
| validation | ok | 无独立保存期 type 级错误码；未连接 Agent/skillRun 时 `W1010` 警告；`skillPath` 运行时 `E1040`；`toolDescription` 必填（`buildAgentToolDefinitions` E2003） |
| executor | satellite | 无独立 registry 条目；经 `runAiAgentNode` → `runSkillTool`（`run-skill-tool.ts`）调用 `executeSkill` |
| error_codes | E1040,E3001,E2003 | `E1040`：缺 `skillPath`；`E3001`：AI 未配置；`E2003`：误作独立 executor 或缺 `toolDescription` |
| e2e_spec | nodes/toolSkill.spec.ts | `@any` 面板 + W1010/validate；`@plus` Agent 挂载校验 |
| status | ok | 审查通过；卫星执行路径单测 + E2E 证据 |

## 参数模型

- `toolDescription`：Agent 可见的工具描述（必填）。
- `skillPath`：`.rxwf/skills` 下 Skill 包名称（相对路径，如 `hello`）。
- `mode`：`sub-agent`（多轮，默认）或 `single-shot`（`maxIterations: 1`）。

## 执行语义

- 卫星节点：连到 `aiAgent` / `skillRun` 的 `ai_tool` 口；由 Agent 运行时通过 `source.type === 'skill'` 调用。
- `runSkillTool` 从 `workspaceRoot` 加载 Skill → `executeSkill` → 返回文本答案。
- LLM 参数：`task` 或 `prompt` 字段作为 user prompt；否则 JSON 序列化全部 args。

## 错误码

| 代码 | 场景 |
| --- | --- |
| E1040 | 运行时 `skillPath` 为空 |
| E3001 | `deps.ai` 未注入 |
| E2003 | 误将 toolSkill 当作独立 executor 调用；或缺 `toolDescription` |
| E1066 | Skill 路径落在禁止前缀（如 `.cursor/skills`）— 由 SkillLoader 抛出 |

## E2E

- Spec：`apps/web/e2e/nodes/toolSkill.spec.ts`（E2E-N-toolSkill）
- 轨：plus（`@plus|@any`）
- 覆盖：面板 Tool 描述 / Skill 名称 / 模式；独立 debug-node E2003；Agent 工作流可保存并含 toolSkill 卫星

## 备注

- 与 `skillRun` 共用 `executeSkill` / `SkillLoader`；区别为 Agent Tool 路径由 LLM 传参触发。
- 帮助文档 `docs/help/zh/nodes/toolSkill.md` 由 M-6 负责。
