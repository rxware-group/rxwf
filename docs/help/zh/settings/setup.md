# Setup 初始化

在 **设置 → Setup**（`/settings/setup`）查看平台 **初始化检查清单**，确认核心依赖已就绪。

## 检查项

典型清单包括（以实际部署为准）：

| 项 | 说明 |
|----|------|
| **database** | 数据库连接与迁移 |
| **admin** | 至少一名管理员账号 |
| **embedded_runner** | 内嵌 Runner 可用 |
| **public_url** | 已配置有效的 Public URL |

每项显示 ✓（完成）或 ○（待办）。

## Public URL 提示

若 **public_url** 未完成，页面会提示在 [系统设置](/help/settings/system) 填写 **Public URL**，否则 Webhook、MCP、Runner 等功能可能异常。

## 下一步

清单完成后可：

- 浏览 [模板库](/templates) 快速创建工作流
- 返回 [工作流列表](/) 开始编辑
- 继续配置 [模型目录](/help/settings/models)、[知识库](/help/settings/knowledge) 等

## 权限

所有登录用户均可查看 Setup 状态；部分修复项（如 Public URL）需 Admin 在系统设置中完成。
