# Skill 集成 P4 冒烟

## 能力摘要

| 能力 | 说明 |
|------|------|
| Antigravity Gemini 导入 | `POST /api/skills/import` + `sourceFormat: antigravity_gemini`，默认源 `~/.gemini/antigravity/skills` |
| path-scoped Rules | Items `json.workingFiles` 与节点 `contextPaths` 传入 `resolveRules` |
| Hooks | 索引 `GET /api/rxwf-catalog/hooks`；`skillRun` 执行前后跑 `pre_skill_run` / `post_skill_run` |
| Commands | 索引 `GET /api/rxwf-catalog/commands`（Web 命令面板待接） |
| HITL reject 回环 | `humanApproval.hitlLoopOnReject`（编译自 `gate.onReject: loop`）；reject 时重跑上游 `skillRun` |

## Antigravity 技能导入

```http
POST /api/skills/import
{
  "sourceFormat": "antigravity_gemini",
  "skillName": "my-skill",
  "workspaceRoot": "/path/to/repo",
  "overwrite": true
}
```

或指定 `sourcePath` 为自定义 Gemini skills 根目录。

## workingFiles → Rules

上游 Item：

```json
{ "workingFiles": ["src/api/foo.ts", "packages/core/bar.ts"] }
```

`skillRun` / `resolveRules` 会合并节点 `contextPaths` 与 `workingFiles` 做 path 过滤。

## Hooks 示例

`.rxwf/hooks/lint-before-skill.hook.yaml`：

```yaml
id: lint-before-skill
event: pre_skill_run
command: echo ok
timeoutMs: 5000
```

## HITL 回环

`startcycle` 模板中 `gate.onReject: loop` 编译为 `hitlLoopOnReject: true`。审批 **reject** 且带 `supplement` 时，平台重跑上游 `skillRun` 并再次进入 `humanApproval` waiting（不再直接 `failed`）。

## 自动化

```bash
pnpm --filter @rxwf/skill-runtime test
pnpm --filter @rxwf/workflow test -- workflow-compiler
pnpm --filter @rxwf/execution test -- resume-hitl-loop
```
