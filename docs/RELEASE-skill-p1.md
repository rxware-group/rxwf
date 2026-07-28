# Skill 集成 P1 冒烟

## 前置

- 仓库含 `.rxwf/skills/{package}/SKILL.md`
- API 已配置 AI runtime（Ollama 等）
- 远程读盘：Runner Agent 在线且 `runnerPolicy` 为 `pinned`

## 步骤

1. 在工作流画布添加 `skillRun` 节点，`skillPath` = Skill 名称（如 `hello`；也兼容 `.rxwf/skills/hello`）。
2. 连接 `aiChatModel` 卫星（必填；节点内不再配置 Provider / Model）。
3. 保存工作流，确认无 E1040 / E1043 / E1066 校验错误。
4. 手动执行节点，输出 `json.answer` 非空。
5. （可选）`preferRemote` + pinned Runner：确认 `runner.tool.invoke` 可读取远程 `SKILL.md`。

## 自动化

```bash
pnpm --filter @rxwf/skill-runtime test
pnpm --filter @rxwf/node-runner test -- skill-run
pnpm --filter @rxwf/workflow test -- validate-skill
pnpm --filter @rxwf/api test -- skill-run-p1
```
