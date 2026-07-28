# rxwf-skill-starter

最小 Skill 工作区样板，用于本地或 CI 冒烟。

## 结构

```
.rxwf/
  rxwf.project.json    # workflows.enabled 等
  skills/hello/SKILL.md
```

## 使用

1. 复制本目录为项目根，或将其中的 `.rxwf/` 合并到你的仓库。
2. 在 rx-workflow 中 `skillRun.skillPath` = `hello`（仅 Skill 名称；运行时解析为 `.rxwf/skills/hello`）。
3. 或通过 API：`POST /api/skills/scan`，`workspaceRoot` 指向本目录。

可选：将 Skill 同步到 Cursor IDE：

```ts
import { exportSkillToCursor } from '@rxwf/skill-runtime';
await exportSkillToCursor({
  workspaceRoot: process.cwd(),
  skillRelPath: 'hello',
  overwrite: true,
});
```
