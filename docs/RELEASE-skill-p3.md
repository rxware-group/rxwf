# Skill 集成 P3 冒烟（AC-S3）

## 能力摘要

- **MCP**：`skill_list` / `skill_get` / `skill_run` / `skill_import` / `rules_resolve` / `rules_list`（`POST /mcp/tools/call`）
- **workflow_run**：`.rxwf/workflows/*.workflow.yaml` → `WorkflowCompiler` → 子执行（`runCompiledWorkflow`）
- **toolIntentMode**：`skillRun` 默认 `hint`，在 system prompt 追加 Tool 意图提示
- **OpenCode**：`permission.skill.deny` → 执行前 E1063
- **导出**：`exportSkillToCursor`（可选同步至 `.cursor/skills`）

## 前置

- `RXWF_FEATURE_PLUS` 未关闭（默认开启）
- AI runtime 已配置（Ollama 等）；MCP `skill_run` 使用与 Chat 相同的 runtime
- 工作区含 `.rxwf/skills/`、`.rxwf/workflows/`（模板执行需 `rxwf.project.json` 中 `workflows.enabled !== false`）

## MCP 步骤

1. 创建 API Key（Admin/Member）。
2. `GET /mcp/tools` — 确认含 `skill_run`。
3. `POST /api/skills/scan` — `workspaceRoot` 指向项目根。
4. `POST /mcp/tools/call`：

```json
{
  "name": "skill_run",
  "arguments": {
    "skillId": "<registry-id 或 slug>",
    "prompt": "Run smoke test",
    "workspaceRoot": "/path/to/project"
  }
}
```

5. 响应 `content[0].text` 为 JSON，`answer` 非空。

## workflow_run 步骤

1. 画布添加 `workflow_run`，`workflowSource=template`，`workflowRelPath=startcycle`。
2. `workspaceRoot` 指向含 `.rxwf/workflows/startcycle.workflow.yaml` 的目录。
3. 在父执行上下文中运行；需 `featurePlus` 与 `runCompiledWorkflow` 已接线。

## 自动化

```bash
pnpm --filter @rxwf/skill-runtime build
pnpm --filter @rxwf/skill-runtime test
pnpm --filter @rxwf/node-runner test -- workflow-run
pnpm --filter @rxwf/workflow test -- validate-skill
pnpm --filter @rxwf/api exec vitest run src/integration/skill-mcp-p3.integration.test.ts
```
