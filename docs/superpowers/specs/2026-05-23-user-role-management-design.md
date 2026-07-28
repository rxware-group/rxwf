# 用户管理与角色权限 — UX 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | **Approved** — 实施计划 [2026-05-23-user-role-management.md](../plans/2026-05-23-user-role-management.md) |
| **日期** | 2026-05-23 |
| **策略** | **方案 A：设置内多页并列** |
| **关联** | `docs/spec.md` FR-6、`docs/ux-ui-design.md` §3.20、`apps/web/src/features/settings/` |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| 身份模型 | 代码中 `LiteRole = "admin" \| "member"`；`rbac.ts` 仅区分 `canManageSystem` |
| 用户 API | 创建（setup）、登录、改密；**无**列表、邀请、停用、改角色 |
| 设置 UI | `/settings/profile` 仅展示当前账号；占位文案「用户列表与邀请功能计划在后续迭代提供」 |
| 工作流 ACL | **未实现**；所有登录用户可见全部工作流 |
| 规格文档 | FR-6 定义四角色 + 工作流分享；Lite 档位原规格为 Admin/Member 简化 + 20 席位上限 |

### 1.2 目标

1. **用户管理（Admin）**：列表、邮件邀请、直接创建、停用/启用、设/撤 Admin。
2. **角色与权限（只读）**：展示 FR-6 固定四角色权限矩阵；实际分配在用户管理与工作流协作中完成。
3. **工作流级分享**：Owner / Editor / Viewer 按工作流分配；非 Admin 仅见「我创建的 + 被分享的」工作流。
4. **Lite 与 Standard 一致**：两档位采用相同 RBAC 与 UX，**不区分 Member**。

### 1.3 非目标（本迭代）

- 自定义角色或权限勾选器（超出 FR-6）
- 席位 / 许可证 / `n/20` 进度条 / 因人数触发的 Standard 升级引导
- SSO / OIDC / SAML（v2）
- 组织 / 多租户 / 跨工作空间隔离
- 用户自助修改邮箱
- 审计日志 UI（P1，另 spec）
- 知识库 / Chat 等资源级 ACL（沿用工作空间 + Owner 原则，详细规则另 spec）

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 部署档位 RBAC | **Lite 与 Standard 统一完整 FR-6**（替代原 Lite Admin/Member 简化） |
| 席位 | **去掉席位概念**（UI 与文案均不出现；不实施 FR-21 第 21 用户阻断） |
| 信息架构 | **方案 A**：设置侧栏多页 — 用户管理、角色与权限、我的账号 |
| 用户加入 | **邀请为主 + 直接创建备用**；SMTP 未配置时邀请不可用，Tooltip 引导直接创建或配置 SMTP |
| 角色管理页 | **只读权限矩阵**（A）；Owner/Editor/Viewer 不在系统级批量分配 |
| 工作流列表（非 Admin） | **仅可见被分享的**（A）：我创建的 + 被授予 O/E/V 的 |
| 系统级角色 | 仅 **Admin** 与 **非 Admin**；非 Admin 在 UI 不显示「Member」标签 |

---

## 3. 相对原规格的变更

| 原规格 | 本设计 |
|--------|--------|
| Lite RBAC：Admin / Member（`spec.md` FR-6 Lite 表） | 统一 Admin + 工作流级 O/E/V |
| `ux-ui-design.md` §3.20 席位 `18/20`、第 21 用户升级 Modal | **移除** |
| `ux-ui-design.md` 导航「用户与席位」 | 改为 **团队** 分组：用户管理 + 角色与权限 |
| 代码 `LiteRole = admin \| member` | 实施时需扩展为系统 Admin 标记 + 工作流 ACL 表（实现 spec 另述） |

---

## 4. 信息架构与导航

### 4.1 路由

| 路由 | 页面名 | 可见性 | 职责 |
|------|--------|--------|------|
| `/settings/profile` | **我的账号** | 全员 | 邮箱、改密、退出；链到角色说明 |
| `/settings/users` | **用户管理** | Admin | 用户 CRUD、邀请、Admin 授予 |
| `/settings/roles` | **角色与权限** | 全员（只读） | FR-6 权限矩阵 |
| 编辑器 → 工作流设置 → **协作** | **工作流分享** | 该工作流 Owner/Editor/Admin | 分配 O/E/V |

### 4.2 设置侧栏（`settings-nav-config`）

**个人**

- 概览、外观、**我的账号**（原「用户」改名）

**团队（`adminOnly: true`）**

- 用户管理 → `/settings/users`
- 角色与权限 → `/settings/roles`

Member 不可见「团队」分组；在「我的账号」底部提供「了解角色权限 → `/settings/roles`」。

### 4.3 工作流列表可见性

| 用户 | 默认可见范围 | 额外能力 |
|------|--------------|----------|
| Admin | 全部工作流 | 列表 Segmented：**我的工作流** / **全部工作流** |
| 非 Admin | 我创建的 + 被分享的 | Segmented：**全部** / **我创建的** / **与我共享的** |

无 ACL 的工作流对非 Admin **不可见**（不出现在列表、直链打开返回 403 空态）。

---

## 5. 用户管理页（`/settings/users`）

### 5.1 页头

```
用户管理                          [+ 邀请用户]  [+ 直接创建]
```

| 按钮 | 行为 |
|------|------|
| **邀请用户** | Primary；`passwordResetEnabled`/SMTP 已配置时可用 |
| **直接创建** | Secondary；始终可用 |

SMTP 未配置时：「邀请用户」disabled；Tooltip：「未配置 SMTP，请使用直接创建，或在系统配置中设置 SMTP。」

### 5.2 用户列表

表格样式与 `RunnerListPage` 的 `data-table` 一致。

| 列 | 说明 |
|----|------|
| 邮箱 | 主标识 |
| 系统角色 | `Admin` 标签，或 `—` |
| 状态 | `活跃` / `已停用` / `待接受邀请` |
| 加入方式 | `邀请` / `直接创建` |
| 最后登录 | 相对时间；从未登录 `—` |
| 操作 | 行内 `⋯` 菜单 |

当前用户行：标注「当前用户」；隐藏「停用」「删除自己」「撤销自己的 Admin」。

### 5.3 邀请用户 Modal

| 字段 | 说明 |
|------|------|
| 邮箱 * | 合法邮箱；已存在活跃用户则 inline 错误 |
| 设为 Admin | Checkbox，默认 off |

提交 → 发送邮件（含接受链接）→ 行状态 `待接受邀请`。

邀请链接：单次或限期（建议 **7 天**）；过期可「重新发送」。

### 5.4 直接创建 Modal

| 字段 | 说明 |
|------|------|
| 邮箱 * | |
| 初始密码 * | 可「生成随机密码」 |
| 设为 Admin | Checkbox |
| 要求首次登录后修改密码 | Checkbox，默认 on |

创建成功 → **一次性** Modal 展示账号信息与密码 + `[复制]`（同 MCP Token 创建模式）。

### 5.5 行操作

| 操作 | 条件 | 确认 |
|------|------|------|
| 设为 Admin / 撤销 Admin | 非当前用户 | Modal；**至少保留 1 名 Admin** |
| 重置密码 | 直接创建、活跃用户 | 生成临时密码，一次性展示 |
| 重新发送邀请 | 待接受 | — |
| 撤销邀请 | 待接受 | — |
| 停用 | 活跃、非自己 | Modal；立即吊销 Session |
| 启用 | 已停用 | — |
| 删除 | 已停用 | 危险 Modal；不可删最后 Admin |

**停用** 优先于删除，保留审计追溯。

### 5.6 空态与错误

| 场景 | UI |
|------|-----|
| 仅首启 Admin | 正常列表 + hint：「可通过邀请或直接创建添加团队成员」 |
| 邀请发送失败 | Toast + 链到系统配置 SMTP |
| 撤销最后 Admin | `E4003` 类 inline / Toast |
| Member 访问 `/settings/users` | 403 空态 + 返回我的账号 |

---

## 6. 角色与权限页（`/settings/roles`）

只读；Admin 与 Member 均可访问。

### 6.1 说明文案

> 以下为平台固定角色。**Admin** 在「用户管理」中分配；**Owner / Editor / Viewer** 在「工作流 → 协作」中按工作流分配。

### 6.2 权限矩阵

与 `spec.md` FR-6 RBAC 矩阵对齐：

| 权限 | Admin | Owner | Editor | Viewer |
|------|:-----:|:-----:|:------:|:------:|
| 系统设置 | ✓ | — | — | — |
| 用户管理 | ✓ | — | — | — |
| 工作流 CRUD | ✓ | ✓ | ✓ | — |
| 执行工作流 | ✓ | ✓ | ✓ | — |
| 查看执行日志 | ✓ | ✓ | ✓ | ✓ |
| 管理凭证 | ✓ | ✓ | — | — |
| 管理 MCP Token | ✓ | ✓ | — | — |
| 使用 AI Chat | ✓ | ✓ | ✓ | ✓ |
| 管理知识库 | ✓ | ✓ | ✓ | — |
| 分享工作流 | ✓ | ✓ | ✓ | — |

矩阵下方四行一句话说明（Admin / Owner / Editor / Viewer）。

**禁止**：编辑矩阵、新建角色、导入导出权限。

---

## 7. 工作流协作（分享）

### 7.1 入口

1. **主入口**：编辑器顶栏 → **工作流设置** → Tab **协作**
2. **快捷入口**（可选 P1）：顶栏 `[分享]` 打开同一 Drawer

### 7.2 权限 gate

| 当前用户对该工作流 | 协作面板 |
|--------------------|----------|
| Admin（平台） | 可编辑 |
| Owner | 可编辑 |
| Editor | 可编辑协作者（不可转让 Owner，不可移除创建者） |
| Viewer | 只读列表 |
| 无 ACL | 不可见该工作流 |

### 7.3 协作面板

```
协作 — 「{工作流名称}」
─────────────────────────────────────
拥有者    {creatorEmail} （创建者）

协作者                              [+ 添加]
┌────────────────────────────────────────────┐
│ 用户           │ 角色 ▼   │ 添加时间 │ 操作  │
│ li@…          │ Editor   │ 2天前   │ 移除  │
└────────────────────────────────────────────┘

角色说明 → /settings/roles
```

- **创建者**默认为 Owner，不可移除；至少保留一名 Owner。
- **添加协作者**：搜索**已注册且活跃**用户；角色单选 Owner / Editor / Viewer（默认 Editor）。
- 未注册用户：inline 提示「请先在用户管理中邀请该用户」。

### 7.4 工作流卡片操作（按角色）

| 角色 | 列表卡片 |
|------|----------|
| Owner / Editor | 编辑、执行、设置、分享 |
| Viewer | 查看、执行日志（只读） |
| Admin | 同 Owner + 可见全部列表 |

---

## 8. 我的账号（`/settings/profile` 修订）

| 区块 | 内容 |
|------|------|
| 当前账号 | 邮箱；若 Admin 显示 `Admin` 标签 |
| 安全 | 修改密码（复用现有能力或链到 forgot flow） |
| 链接 | 「了解角色权限 → `/settings/roles`」 |
| 操作 | 退出登录 |

**删除**原占位：「完整用户列表与邀请功能计划在后续迭代提供」。

---

## 9. 邀请接受与首次登录

### 9.1 邀请接受页（`/accept-invite?token=`）

- 未登录：展示「接受邀请」表单 — 设置密码 + 确认密码
- 已登录且邮箱匹配：确认加入
- 邮箱不匹配：错误 + 退出后重试
- Token 无效/过期：错误 + 「联系管理员重新发送邀请」

### 9.2 直接创建 + 强制改密

首次登录若 `mustChangePassword` → 拦截至改密页，完成后进入主页。

---

## 10. API 与数据（UX 依赖，实现另 plan）

以下 endpoint 为前端 UX 所需；命名与实现细节在 implementation plan 中锁定。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 列表（Admin） |
| POST | `/api/admin/users/invite` | 发送邀请 |
| POST | `/api/admin/users` | 直接创建 |
| PATCH | `/api/admin/users/:id` | 停用/启用/Admin/重置状态 |
| DELETE | `/api/admin/users/:id` | 删除已停用用户 |
| POST | `/api/admin/users/:id/resend-invite` | 重发邀请 |
| GET | `/api/workflows/:id/collaborators` | 协作者列表 |
| PUT | `/api/workflows/:id/collaborators` | 批量更新协作者 |
| POST | `/api/auth/accept-invite` | 接受邀请 |

工作流列表 API 须支持 `scope=mine|shared|all`（`all` 仅 Admin）。

---

## 11. 错误处理

| 场景 | 错误码建议 | 用户话术 |
|------|------------|----------|
| 非 Admin 访问用户管理 | E4003 | 无权访问用户管理 |
| 移除最后 Admin | E4003 | 至少保留一名管理员 |
| 添加未注册用户为协作者 | E1004 | 该用户尚未加入团队 |
| 无 ACL 打开工作流 | E4003 | 无权访问此工作流 |
| 邀请 token 无效 | E4002 | 邀请链接无效或已过期 |

话术走 i18n；详见 `docs/error-codes.md` 扩展。

---

## 12. 验收标准（UX）

### AC-U1 用户邀请

- **Given** Admin、SMTP 已配置
- **When** 邀请 `new@example.com` 并发送
- **Then** 列表出现「待接受邀请」；邮件含接受链接；接受后状态「活跃」

### AC-U2 SMTP 降级

- **Given** SMTP 未配置
- **When** 打开用户管理
- **Then** 「邀请用户」disabled；「直接创建」可用；Tooltip 说明原因

### AC-U3 工作流 ACL

- **Given** Viewer 用户仅被分享工作流 W
- **When** 打开工作流列表
- **Then** 仅见 W；编辑入口不可用；直链其他工作流 403

### AC-U4 角色矩阵只读

- **Given** 任意登录用户打开 `/settings/roles`
- **Then** 可见 FR-6 矩阵；无编辑控件

### AC-U5 最后 Admin 保护

- **Given** 系统仅一名 Admin
- **When** 试图撤销其 Admin 或删除
- **Then** 操作被拒绝并提示

---

## 13. 后续文档同步

实施完成后需更新：

- `docs/spec.md` — Lite RBAC 表、FR-21 席位表述
- `docs/ux-ui-design.md` — §3.20 改为「用户与权限」、移除席位 wireframe
- `docs/error-codes.md` — 新增用户/协作相关码

---

## 14. 实施顺序建议（供 plan 参考）

1. 数据模型：工作流 ACL、邀请 token、用户 status / mustChangePassword
2. Admin 用户 API + 邀请/接受流程
3. `/settings/users`、`/settings/roles`、profile 修订、settings 导航
4. 工作流列表 scope 过滤 + 协作 Drawer
5. 集成测试 + 更新 error-codes / spec 交叉引用
