# 登录页改版与邮件找回密码 — 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | **Implemented** — 实施计划 [2026-05-23-login-password-reset.md](../plans/2026-05-23-login-password-reset.md) |
| **日期** | 2026-05-23 |
| **策略** | **方案 A：`system_settings` 表 + 统一配置服务** |
| **关联** | `apps/web/src/features/auth/LoginPage.tsx`、`apps/api/src/config.ts` |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| 登录页 | 标题左对齐；有提示语「使用管理员或成员账户登录。」；登录按钮 `width: 100%` |
| 认证 API | 仅有 `/api/auth/login`、`setup`、`logout`、`status` |
| 邮件 | 无 SMTP 配置、无邮件发送依赖 |
| 系统配置 | 全部在 `apps/api/src/config.ts` 环境变量；Ollama 地址存于浏览器 `localStorage` |
| 设置页 | 无 SMTP / 站点 URL / Webhook 密钥等系统级配置入口 |

### 1.2 目标

1. **登录页 UI**：品牌区（Logo + 名称，先占位）→ 居中标题「登录」→ 表单 → 自适应宽度居中登录按钮 → 居中「忘记密码？」链接。
2. **忘记密码**：标准多页流程（登录 → 找回 → 邮件链接 → 重置），基于 SMTP 发送重置邮件。
3. **系统设置**：SMTP、站点 URL、Ollama、Webhook 密钥、品牌信息迁移至管理员设置页；`config.ts` 仅保留启动/基础设施项。

### 1.3 非目标（v1）

- 真实 Logo 资产上传（仅预留字段与占位 UI）
- 第三方邮件 API（Resend / SendGrid）
- 多因素认证
- 成员自助修改邮箱
- Plus / Standard 部署档位的差异化 SMTP 实现（Lite 先行）

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 邮件配置方式 | **设置页 SMTP 配置**（管理员 UI，非纯环境变量） |
| 配置存储 | **方案 A：`system_settings` 表 + `SystemSettingsService`** |
| 找回密码流程 | **标准多页**（`/forgot-password` → 邮件 → `/reset-password?token=`） |
| 登录页品牌 | 标题上方 **Logo + 名称占位**，后续可配置 |
| 「忘记密码？」位置 | **登录按钮下方，居中对齐** |
| SMTP 未配置 | 隐藏链接；`/api/auth/password-reset-status` 返回 `enabled: false` |

---

## 3. 登录页 UI

### 3.1 布局

```
┌─────────────────────────┐
│      [Logo 占位]         │
│   RX-Workflow 占位      │
│                         │
│          登录            │  ← text-align: center
│                         │
│  邮箱                    │
│  [________________]     │
│  密码                    │
│  [________________]     │
│                         │
│       [  登录  ]        │  ← width: auto，水平居中
│       忘记密码？         │  ← 按钮下方，text-align: center
└─────────────────────────┘
```

### 3.2 变更清单

| 项目 | 改前 | 改后 |
|------|------|------|
| 品牌区 | 无 | `.auth-brand`：Logo 占位块 + 产品名占位 |
| 标题 | 左对齐 | 居中 |
| 提示语 | 「使用管理员或成员账户登录。」 | **删除** |
| 登录按钮 | `width: 100%` | `width: auto` + 居中 |
| 忘记密码 | 无 | 按钮下方居中链接（条件显示） |

### 3.3 样式（`apps/web/src/styles.css`）

- 新增 `.auth-brand`、`.auth-brand-logo`（占位）、`.auth-brand-name`
- `.auth-card h1` 增加 `text-align: center`
- `.auth-card button[type='submit']` 去掉 `width: 100%`，父级或按钮容器 flex 居中
- 新增 `.auth-forgot-link`：`display: block; text-align: center; margin-top: 0.75rem`

### 3.4 「忘记密码？」显示逻辑

- 挂载时请求 `GET /api/auth/password-reset-status`
- `enabled === true` 时渲染链接，跳转 `/forgot-password`
- 否则不渲染

---

## 4. config 重构与系统设置

### 4.1 `config.ts` 分层

**保留环境变量（启动 / 基础设施，不可通过 UI 修改）：**

| 键 | 说明 |
|----|------|
| `httpPort` | HTTP 监听端口 |
| `dataDir` | 数据目录 |
| `deployProfile` | 部署档位 `lite` / `standard` |
| `featurePlus` | Plus 能力开关 |
| `schedulerTickMs` / `schedulerDisabled` | 调度器 |
| `jobProcessorTickMs` / `jobProcessorDisabled` | 任务处理器 |
| `credentialKey` | AES 加密主密钥（32 字节 hex） |
| `databaseUrl` / `redisUrl` | Plus 基础设施 |

**迁移至 `system_settings`（管理员设置页，DB 覆盖 env 默认值）：**

| 键 | 说明 | 敏感 |
|----|------|------|
| `publicUrl` | 站点对外 URL（重置链接、Webhook、MCP） | 否 |
| `smtp.host` | SMTP 主机 | 否 |
| `smtp.port` | SMTP 端口 | 否 |
| `smtp.secure` | TLS | 否 |
| `smtp.user` | 用户名 | 否 |
| `smtp.password` | 密码 | **是** |
| `smtp.from` | 发件人地址 | 否 |
| `ollamaUrl` | Ollama 服务地址 | 否 |
| `ollamaModel` | 默认模型 | 否 |
| `webhookSecret` | Webhook 签名密钥 | **是** |
| `brand.logoUrl` | Logo URL（预留） | 否 |
| `brand.productName` | 产品名称（预留） | 否 |

### 4.2 数据库：`system_settings`

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,        -- 明文或 AES 加密 blob（敏感项）
  sensitive INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

- Lite / Standard schema 同步新增
- 敏感字段使用现有 `credentialKey` + `@rxwf/credential` 加密工具

### 4.3 `SystemSettingsService`

位置建议：`packages/system-settings`（或 `packages/identity` 子模块，优先独立 package 以保持边界清晰）。

```typescript
interface SystemSettingsService {
  get(key: string): Promise<string | undefined>;
  getMany(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string, sensitive?: boolean): Promise<void>;
  setMany(entries: Array<{ key: string; value: string; sensitive?: boolean }>): Promise<void>;
  getPublicSnapshot(): Promise<SystemSettingsPublic>;  // 敏感值脱敏为 ***
}
```

**运行时合并：**

```typescript
getRuntimeConfig(db): RuntimeConfig
// env 默认值 → DB 覆盖；供 auth、webhook、mcp、ollama 等读取
```

- 首次启动 DB 无记录：使用 env 默认值（与当前行为一致）
- 设置页保存后：DB 值优先
- `config.ts` 导出 `bootstrapConfig`（仅基础设施）；业务代码改读 `getRuntimeConfig()`

### 4.4 设置页 UI

- 路由：`/settings/system`（**仅 admin**）
- `SettingsLayout` 导航增加「系统配置」
- 分组表单：
  1. **站点** — `publicUrl`、`brand.productName`、`brand.logoUrl`（预留）
  2. **邮件** — SMTP 字段 +「发送测试邮件」按钮（向当前 admin 邮箱发送）
  3. **集成** — `ollamaUrl`、`ollamaModel`、`webhookSecret`
- API：
  - `GET /api/settings/system` — 脱敏快照
  - `PUT /api/settings/system` — 部分更新（未提交的敏感字段保持原值）
  - `POST /api/settings/system/test-email` — 测试 SMTP

### 4.5 `ModelSettingsPage` 迁移

- 移除 `localStorage` 读写
- 改为调用 `/api/settings/system` 读写 `ollamaUrl` / `ollamaModel`
- 连接检测逻辑保留，地址来源改为服务端

### 4.6 消费方改造

| 消费方 | 改前 | 改后 |
|--------|------|------|
| `registerSystemRoutes` | `config.publicUrl` | `runtimeConfig.publicUrl` |
| Webhook 路由 | `config.webhookSecret` | `runtimeConfig.webhookSecret` |
| MCP tokens | `config.publicUrl` | `runtimeConfig.publicUrl` |
| Ollama 节点 / AI | `config.ollamaUrl` | `runtimeConfig.ollamaUrl` |
| 登录页品牌 | 硬编码占位 | 可读 `GET /api/auth/branding`（公开，无敏感信息） |

---

## 5. 找回密码

### 5.1 页面路由（无需登录）

| 路由 | 组件 | 说明 |
|------|------|------|
| `/login` | `LoginPage` | 现有，UI 改版 + 忘记密码链接 |
| `/forgot-password` | `ForgotPasswordPage` | 输入邮箱提交 |
| `/reset-password` | `ResetPasswordPage` | 读 `?token=`，输入新密码 + 确认 |

`App.tsx` 在 `phase === 'login'` 时根据 path 渲染对应页面（或引入轻量 `react-router` 公开路由）。

### 5.2 API

| 端点 | 方法 | 请求 | 响应 |
|------|------|------|------|
| `/api/auth/password-reset-status` | GET | — | `{ enabled: boolean }` |
| `/api/auth/branding` | GET | — | `{ productName?, logoUrl? }` |
| `/api/auth/forgot-password` | POST | `{ email }` | `{ message }` 始终 200 |
| `/api/auth/reset-password` | POST | `{ token, password }` | 200 或 400 |

**`forgot-password` 行为：**

1. 校验 SMTP + `publicUrl` 已配置；未配置返回 503 + 明确错误（仅 API 层；前端已隐藏链接）
2. 规范化 email（trim + lowercase）
3. 若用户存在：生成 token、存哈希、发邮件
4. 若不存在：无操作
5. 响应统一：`{ message: "如果该邮箱已注册，您将收到重置邮件。" }`
6. 同一邮箱 60 秒内限 1 次（内存 rate limit 或 DB 记录）

**`reset-password` 行为：**

1. 校验 token 哈希存在、未过期、未使用
2. 密码 ≥ 8 位
3. 更新 `users.passwordHash`
4. 标记 token `usedAt`
5. 删除该用户所有 `sessions`
6. 返回成功，前端跳转登录

### 5.3 数据库：`password_reset_tokens`

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id ON password_reset_tokens(user_id);
```

- Token：32 字节随机 → URL-safe base64，仅明文出现在邮件 URL
- 存库：`hashSecret(token)`（与 session 一致）
- 有效期：**1 小时**
- 新发 token 时：将该用户未使用的旧 token 标记作废或删除

### 5.4 邮件

依赖：**nodemailer**（新增至 `apps/api` 或 `packages/system-settings`）。

```
主题：重置您的 {productName} 密码
正文：
  您好，
  请点击以下链接重置密码（1 小时内有效）：
  {publicUrl}/reset-password?token={token}
  如非本人操作，请忽略此邮件。
```

### 5.5 安全

| 项 | 策略 |
|----|------|
| 邮箱枚举 | forgot 始终相同成功文案 |
| 速率限制 | 同邮箱 60s / 次 |
| Token | 单次使用 + 过期 |
| 会话 | 重置后清除全部 session |
| SMTP 密码 | 加密存储，API 脱敏 |

---

## 6. 错误处理

| 场景 | 处理 |
|------|------|
| SMTP 未配置 | 登录页隐藏「忘记密码？」；设置页邮件分组顶部提示 |
| Token 无效/过期 | 重置页错误 + 「返回登录」「重新申请」链接 |
| 邮件发送失败 | 服务端 error 日志；用户仍见统一成功文案 |
| 测试邮件失败 | 设置页 toast 展示 SMTP 错误详情 |
| 非 admin 访问系统设置 | 403 |

---

## 7. 测试

| 范围 | 用例 |
|------|------|
| `SystemSettingsService` | 读写、敏感加密、env 默认值回退 |
| `auth` routes | forgot 防枚举、rate limit、reset 成功/过期/token 复用 |
| reset 后 | session 失效，旧密码无法登录 |
| 集成 | 配置 SMTP（可用 ethereal/email mock）→ forgot → reset → login |
| Web | LoginPage 链接条件渲染；Forgot/Reset 表单校验 |

---

## 8. 实施顺序建议

1. `system_settings` schema + `SystemSettingsService` + runtime config 合并
2. `/api/settings/system` + 设置页 UI
3. 消费方从 `config` 迁移到 `getRuntimeConfig`
4. `password_reset_tokens` + mailer + auth API
5. 登录 / 找回 / 重置页面 + 路由
6. 登录页 UI 改版（品牌占位、按钮、链接）
7. `ModelSettingsPage` 去 localStorage

---

## 9. 方案对比记录

| 方案 | 结论 |
|------|------|
| A — `system_settings` 表 + 服务 | **采用** |
| B — 复用 `env_vars` | 否决：语义混淆、加密弱 |
| C — JSON 文件 | 否决：与 DB 模式不一致 |
