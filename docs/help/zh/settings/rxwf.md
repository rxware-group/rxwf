# RxWF / Skills

在 **设置 → RxWF / Skills**（`/settings/rxwf`）中配置工作区根目录，并管理 Skills、Rules、Workflows、Hooks、Commands 目录资源。

## 工作区根目录

填写 **Workspace Root** 绝对路径并保存。平台从此目录扫描：

- `.cursor/skills`、`.trae/skills` 等 Skills 定义
- Rules、工作流模板、Hooks、Commands 清单

留空时使用服务端默认工作区。

## Skills 标签页

| 操作 | 说明 |
|------|------|
| **扫描** | 按当前工作区重新发现 Skills |
| **导入** | 从 Cursor / Antigravity 等格式导入指定路径的 Skill |
| 列表 | 显示已注册 Skill 名称与路径 |

Skills 可被 [Tool (Skill) 节点](/help/nodes/toolSkill) 与 Agent 调用。

## Rules 标签页

预览合并后的 Rules 内容与 Token 估算，便于控制 Agent 上下文长度。

## Workflows / Hooks / Commands

只读目录清单，展示工作区中可用的工作流片段、Hook 与 Command 定义路径，供编辑与运维对照。

## 典型流程

1. 设置工作区根目录 → 保存。
2. 点击 **扫描 Skills**。
3. 在工作流中使用 Tool (Skill) 或相关节点引用 Skill 名称。

## 相关帮助

- [Tool (Skill) 节点](/help/nodes/toolSkill)
- [Tool (Subagent) 节点](/help/nodes/toolSubagent)
