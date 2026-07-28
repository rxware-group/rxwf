# 角色与权限

在 **设置 → 角色**（`/settings/roles`）查看平台 RBAC（基于角色的访问控制）说明与权限矩阵。

## 平台角色

| 角色 | 说明 |
|------|------|
| **Admin** | 系统管理员：用户管理、系统设置、Agent Memory、LangSmith、Web Search 等全局配置 |
| **Owner** | 工作流所有者：可创建/删除工作流、管理 MCP Token、执行与发布 |
| **Editor** | 编辑者：可编辑与执行工作流，不可删除他人工作流或管理 MCP Token |
| **Viewer** | 只读：可查看工作流与执行记录，不可编辑 |

**Admin** 角色在 **用户管理** 中分配；工作流级 Owner / Editor / Viewer 在工作流成员设置中分配。

## 权限矩阵

页面表格列出各操作（系统设置、用户管理、工作流 CRUD、执行、MCP Token、AI Chat 等）在不同角色下是否允许（✓ / —）。

## 典型场景

- 给团队成员 **Editor**：可共同编辑工作流，但不能删除或改成员。
- 给运维 **Admin**：管理平台用户、Runner、模型与集成。
- 给业务方 **Viewer**：仅查看运行结果与日志。

## 相关页面

- [用户管理](/help/settings/users) — 分配 Admin 角色
- [MCP Token](/help/settings/mcp-tokens) — Owner 及以上可创建
