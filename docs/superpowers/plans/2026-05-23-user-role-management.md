# 用户管理与角色权限 Implementation Plan

> **Status: Implemented** (2026-05-24) — Tasks 1–15 complete; docs synced in Task 15.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 FR-6 完整 RBAC（Admin + 工作流级 Owner/Editor/Viewer）：Admin 用户管理（邀请/直接创建）、只读角色矩阵页、工作流协作分享、列表
流列表 ACL 过滤，Lite 与 Standard 行为一致且无席位概念。

**Architecture:** 扩展 `users` 表（status / joinMethod / mustChangePassword / lastLoginAt）；新增 `user_invite_tokens` 与 `workflow_collaborators`；`workflows.created_by_user_id` 标记创建者（隐式 Owner）；`@rxwf/identity` 增加 `UserAdminService`、`InviteService`、`WorkflowAccessService`；API 在 `routes/admin-users.ts` 与 `workflows.ts`  enforce ACL；Web 新增 settings 团队页、接受邀请页、编辑器协作 Tab。

**Tech Stack:** TypeScript、Fastify、Drizzle/SQLite + Postgres、Vitest、React 19、react-router-dom、nodemailer（复用 `@rxwf/system-settings` mailer）。

**设计依据:** [2026-05-23-user-role-management-design.md](../specs/2026-05-23-user-role-management-design.md)

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/providers/lite/src/drizzle/schema.ts` | 扩展 users/workflows；新增 invite + collaborators 表 |
| `packages/providers/lite/src/drizzle/apply-schema.ts` | DDL + 存量 workflow 回填 created_by |
| `packages/providers/standard/src/drizzle/schema.ts` | PG 等价定义 |
| `packages/providers/standard/src/drizzle/apply-schema.ts` | PG 迁移 |
| `packages/identity/src/rbac.ts` | 扩展 `WorkflowRole`、权限 helper |
| `packages/identity/src/user-service.ts` | list/update/disable/admin 等 |
| `packages/identity/src/invite-service.ts` | 邀请 token 创建/消费 |
| `packages/identity/src/workflow-access-service.ts` | 工作流 ACL 判定 |
| `packages/identity/src/user-admin-service.ts` | Admin 编排（最后 Admin 保护） |
| `packages/providers/lite/src/workflow-collaborator-repository.ts` | 协作者 CRUD + scope 列表 |
| `packages/providers/lite/src/workflow-repository.ts` | insert/list 带 createdBy + scope |
| `packages/providers/standard/src/repositories/workflow-collaborator-repository.ts` | Standard 镜像 |
| `packages/workflow/src/workflow-service.ts` | create 传入 createdByUserId |
| `apps/api/src/routes/admin-users.ts` | `/api/admin/users*` |
| `apps/api/src/routes/auth.ts` | accept-invite、login 更新 lastLogin、mustChangePassword gate |
| `apps/api/src/routes/workflows.ts` | scope 查询、ACL middleware、collaborators API |
| `apps/api/src/middleware/workflow-access.ts` | 加载工作流角色到 request |
| `apps/api/src/bootstrap.ts` / `bootstrap-plus.ts` | 注册新路由 |
| `apps/web/src/features/settings/UsersAdminPage.tsx` | 用户管理 |
| `apps/web/src/features/settings/RolesReferencePage.tsx` | 角色矩阵 |
| `apps/web/src/features/settings/SettingsProfilePage.tsx` | 我的账号修订 |
| `apps/web/src/features/settings/settings-nav-config.tsx` | 团队导航 |
| `apps/web/src/features/auth/AcceptInvitePage.tsx` | 接受邀请 |
| `apps/web/src/features/auth/ChangePasswordRequiredPage.tsx` | 强制改密 |
| `apps/web/src/features/editor/WorkflowCollaboratorsPanel.tsx` | 协作 Tab |
| `apps/web/src/features/workflows/WorkflowListPage.tsx` | scope Segmented |
| `apps/web/src/App.tsx` | 新路由 |
| `apps/web/src/api/client.ts` | admin.users / collaborators API |
| `docs/error-codes.md` | E4003 用户/协作扩展 |

---

## Phase 1：Schema 与 RBAC 基础

### Task 1: 数据库表与迁移

**Files:**
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Modify: `packages/providers/standard/src/drizzle/schema.ts`
- Modify: `packages/providers/standard/src/drizzle/apply-schema.ts`

- [ ] **Step 1: lite schema 扩展 users 并新增表**

```typescript
// packages/providers/lite/src/drizzle/schema.ts — 替换 users 表定义并追加：

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // admin | member（member=非 Admin，UI 不展示 Member）
  status: text("status").notNull().default("active"), // active | disabled | pending_invite
  joinMethod: text("join_method"), // invite | direct | null（setup 首用户）
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(false),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userInviteTokens = sqliteTable("user_invite_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  invitedByUserId: text("invited_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// workflows 表追加 createdByUserId:
// createdByUserId: text("created_by_user_id").references(() => users.id),

export const workflowCollaborators = sqliteTable(
  "workflow_collaborators",
  {
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(), // owner | editor | viewer
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workflowId, t.userId] })],
);
```

- [ ] **Step 2: apply-schema 追加迁移函数 `migrateUserRbacSchema`**

```typescript
function migrateUserRbacSchema(sqlite: Database.Database): void {
  const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const names = new Set(userCols.map((c) => c.name));
  if (!names.has("status")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
  if (!names.has("join_method")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN join_method TEXT");
  }
  if (!names.has("must_change_password")) {
    sqlite.exec(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!names.has("last_login_at")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN last_login_at INTEGER");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_invite_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      invited_by_user_id TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
  `);

  const wfCols = sqlite.prepare("PRAGMA table_info(workflows)").all() as Array<{ name: string }>;
  if (!wfCols.some((c) => c.name === "created_by_user_id")) {
    sqlite.exec("ALTER TABLE workflows ADD COLUMN created_by_user_id TEXT REFERENCES users(id)");
    const admin = sqlite
      .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined;
    if (admin) {
      sqlite
        .prepare("UPDATE workflows SET created_by_user_id = ? WHERE created_by_user_id IS NULL")
        .run(admin.id);
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_collaborators (
      workflow_id TEXT NOT NULL REFERENCES workflows(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workflow_id, user_id)
    );
  `);
}
```

在 `applyLiteSchema()` 末尾调用 `migrateUserRbacSchema(sqlite)`。

- [ ] **Step 3: standard schema / apply-schema 同步 PG 等价 DDL**

- [ ] **Step 4: Commit**

```bash
git add packages/providers/lite/src/drizzle/schema.ts packages/providers/lite/src/drizzle/apply-schema.ts packages/providers/standard/src/drizzle/schema.ts packages/providers/standard/src/drizzle/apply-schema.ts
git commit -m "feat(schema): user RBAC columns, invites, workflow collaborators"
```

---

### Task 2: RBAC 类型与权限 helper

**Files:**
- Modify: `packages/identity/src/rbac.ts`
- Create: `packages/identity/src/rbac.test.ts`
- Modify: `packages/identity/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/identity/src/rbac.test.ts
import { describe, it, expect } from "vitest";
import {
  type WorkflowRole,
  workflowRoleRank,
  canEditWorkflow,
  canShareWorkflow,
} from "./rbac.js";

describe("workflow RBAC", () => {
  it("owner can share, viewer cannot edit", () => {
    expect(canShareWorkflow("owner")).toBe(true);
    expect(canShareWorkflow("viewer")).toBe(false);
    expect(canEditWorkflow("editor")).toBe(true);
    expect(canEditWorkflow("viewer")).toBe(false);
  });

  it("ranks owner > editor > viewer", () => {
    expect(workflowRoleRank("owner")).toBeGreaterThan(workflowRoleRank("editor"));
    expect(workflowRoleRank("editor")).toBeGreaterThan(workflowRoleRank("viewer"));
  });
});
```

- [ ] **Step 2: 运行测试确认 FAIL**

Run: `pnpm --filter @rxwf/identity test -- rbac.test.ts`
Expected: FAIL — exports not found

- [ ] **Step 3: 实现 rbac 扩展**

```typescript
// packages/identity/src/rbac.ts 追加：
export type SystemRole = "admin" | "member";
export type WorkflowRole = "owner" | "editor" | "viewer";

export function isSystemAdmin(role: SystemRole): boolean {
  return role === "admin";
}

const WORKFLOW_RANK: Record<WorkflowRole, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};

export function workflowRoleRank(role: WorkflowRole): number {
  return WORKFLOW_RANK[role];
}

export function canViewWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role !== null;
}

export function canEditWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role === "owner" || role === "editor";
}

export function canShareWorkflow(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return isAdmin || role === "owner" || role === "editor";
}

export function canManageCollaborators(role: WorkflowRole | null, isAdmin: boolean): boolean {
  return canShareWorkflow(role, isAdmin);
}
```

保留现有 `LiteRole` / `canManageSystem` 导出以兼容存量代码。

- [ ] **Step 4: 运行测试 PASS**

Run: `pnpm --filter @rxwf/identity test -- rbac.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/identity/src/rbac.ts packages/identity/src/rbac.test.ts packages/identity/src/index.ts
git commit -m "feat(identity): workflow RBAC helpers"
```

---

## Phase 2：Identity 服务层

### Task 3: UserService 扩展

**Files:**
- Modify: `packages/identity/src/user-service.ts`
- Modify: `packages/identity/src/user-service.test.ts`

- [ ] **Step 1: 写失败测试 — listUsers 与 countAdmins**

```typescript
// packages/identity/src/user-service.test.ts 追加：
it("listUsers returns status and admin flag", async () => {
  const db = await createTestDb();
  const users = createUserService(db);
  await users.createUser({ email: "a@x.com", password: "secret1234", role: "admin" });
  await users.createDirectUser({
    email: "b@x.com",
    password: "secret1234",
    role: "member",
    mustChangePassword: true,
  });
  const rows = await users.listUsers();
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.email === "b@x.com")?.mustChangePassword).toBe(true);
});

it("countActiveAdmins protects last admin", async () => {
  const db = await createTestDb();
  const users = createUserService(db);
  await users.createUser({ email: "solo@x.com", password: "secret1234", role: "admin" });
  expect(await users.countActiveAdmins()).toBe(1);
});
```

- [ ] **Step 2: 运行 FAIL**

Run: `pnpm --filter @rxwf/identity test -- user-service.test.ts`

- [ ] **Step 3: 实现扩展方法**

在 `user-service.ts` 增加：

```typescript
export type UserStatus = "active" | "disabled" | "pending_invite";
export type JoinMethod = "invite" | "direct";

export interface AdminUserRow {
  id: string;
  email: string;
  role: LiteRole;
  status: UserStatus;
  joinMethod: JoinMethod | null;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// createDirectUser(input: { email, password, role, mustChangePassword })
// createPendingInviteUser(input: { email, role, invitedByUserId })
// listUsers(): Promise<AdminUserRow[]>
// findById(id): Promise<AdminUserRow | null>
// setStatus(id, status)
// setRole(id, role)
// setMustChangePassword(id, boolean)
// touchLastLogin(id)
// countActiveAdmins()
// deleteUser(id) — 仅 disabled
```

`createUser`（setup 用）设置 `joinMethod: null`, `status: active`。

- [ ] **Step 4: 测试 PASS + Commit**

```bash
git add packages/identity/src/user-service.ts packages/identity/src/user-service.test.ts
git commit -m "feat(identity): extend user service for admin operations"
```

---

### Task 4: InviteService

**Files:**
- Create: `packages/identity/src/invite-service.ts`
- Create: `packages/identity/src/invite-service.test.ts`
- Modify: `packages/identity/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";
import { createInviteService } from "./invite-service.js";

describe("InviteService", () => {
  it("creates token and accepts invite with password", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const admin = await users.createUser({
      email: "admin@x.com",
      password: "secret1234",
      role: "admin",
    });
    const pending = await users.createPendingInviteUser({
      email: "new@x.com",
      role: "member",
      invitedByUserId: admin.id,
    });
    const invites = createInviteService(db);
    const { token } = await invites.createToken(pending.id, admin.id);
    await invites.accept(token, "new-password-12");
    const row = await users.findByEmail("new@x.com");
    expect(row?.status).toBe("active");
    const ok = await users.verifyPassword("new@x.com", "new-password-12");
    expect(ok).not.toBeNull();
  });
});
```

- [ ] **Step 2: FAIL → 实现（TTL 7 天，复用 hashSecret 模式）**

```typescript
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createInviteService(db: LiteDatabase) {
  return {
    async createToken(userId: string, invitedByUserId: string) { /* ... */ },
    async accept(token: string, password: string) { /* sets active, clears mustChangePassword */ },
    async revokePending(userId: string) { /* delete tokens + user if pending */ },
    async resend(userId: string, invitedByUserId: string) { /* new token */ },
  };
}
```

- [ ] **Step 3: PASS + Commit**

```bash
git add packages/identity/src/invite-service.ts packages/identity/src/invite-service.test.ts packages/identity/src/index.ts
git commit -m "feat(identity): user invite token service"
```

---

### Task 5: WorkflowAccessService + Collaborator Repository

**Files:**
- Create: `packages/identity/src/workflow-access-service.ts`
- Create: `packages/identity/src/workflow-access-service.test.ts`
- Create: `packages/providers/lite/src/workflow-collaborator-repository.ts`
- Modify: `packages/providers/lite/src/workflow-repository.ts`
- Modify: `packages/workflow/src/workflow-service.ts`

- [ ] **Step 1: collaborator repository 测试**

```typescript
// packages/providers/lite/src/workflow-collaborator-repository.test.ts
it("lists collaborators and resolves effective role", async () => {
  const db = await createTestDb();
  const repo = createWorkflowCollaboratorRepository(db);
  // insert workflow + users, add editor collaborator
  const role = await repo.getEffectiveRole(workflowId, editorUserId, creatorUserId);
  expect(role).toBe("editor");
  const creatorRole = await repo.getEffectiveRole(workflowId, creatorUserId, creatorUserId);
  expect(creatorRole).toBe("owner");
});
```

- [ ] **Step 2: 实现 repository**

```typescript
export function createWorkflowCollaboratorRepository(db: LiteDatabase) {
  return {
    async list(workflowId: string): Promise<Array<{ userId: string; email: string; role: WorkflowRole; createdAt: Date }>>,
    async upsert(workflowId: string, userId: string, role: WorkflowRole): Promise<void>,
    async remove(workflowId: string, userId: string): Promise<void>,
    async getEffectiveRole(workflowId: string, userId: string, createdByUserId: string | null): Promise<WorkflowRole | null>,
    async listWorkflowIdsForUser(userId: string, scope: "mine" | "shared" | "all"): Promise<string[]>,
  };
}
```

`getEffectiveRole`：userId === createdByUserId → `owner`；否则查 collaborators；无记录 → `null`。

`listWorkflowIdsForUser`：
- `mine`：`created_by_user_id = userId`
- `shared`：collaborators 有记录且非 creator
- `all`：Admin 专用，全部 workflow id

- [ ] **Step 3: workflow-repository 扩展 insertWorkflow / listWorkflows**

`insertWorkflow` 接受 `createdByUserId?: string | null`。

`listWorkflows({ ids?: string[] })` 可选 id 过滤。

- [ ] **Step 4: workflow-service.create 接受 createdByUserId**

```typescript
async create(input: {
  name: string;
  definition: WorkflowDefinition;
  createdByUserId?: string | null;
})
```

- [ ] **Step 5: WorkflowAccessService 封装**

```typescript
export function createWorkflowAccessService(deps: {
  collaborators: WorkflowCollaboratorRepository;
  getWorkflowMeta: (id: string) => Promise<{ createdByUserId: string | null } | null>;
}) {
  return {
    async resolveAccess(workflowId: string, auth: AuthContext): Promise<WorkflowRole | "admin" | null>,
    async assertCanEdit(workflowId: string, auth: AuthContext): Promise<void>,
    async assertCanView(workflowId: string, auth: AuthContext): Promise<void>,
  };
}
```

Admin → 返回 `"admin"`；否则 `getEffectiveRole`。

- [ ] **Step 6: 测试 PASS + Commit**

```bash
git add packages/identity/src/workflow-access-service.ts packages/identity/src/workflow-access-service.test.ts packages/providers/lite/src/workflow-collaborator-repository.ts packages/providers/lite/src/workflow-repository.ts packages/workflow/src/workflow-service.ts
git commit -m "feat: workflow collaborator repository and access service"

---

### Task 6: UserAdminService（最后 Admin 保护）

**Files:**
- Create: `packages/identity/src/user-admin-service.ts`
- Create: `packages/identity/src/user-admin-service.test.ts`

- [ ] **Step 1: 测试 — 不可撤销最后 Admin**

```typescript
it("rejects demoting the last active admin", async () => {
  const svc = createUserAdminService(db);
  const admin = await users.createUser({ email: "solo@x.com", password: "x", role: "admin" });
  await expect(svc.setAdmin(admin.id, false)).rejects.toMatchObject({ code: "E4003" });
});
```

- [ ] **Step 2: 实现 orchestration**

封装：invite、directCreate、patchUser、deleteDisabled、resetPassword（生成随机串）、revokeInvite。

所有 mutating 操作检查 `countActiveAdmins()`。

- [ ] **Step 3: PASS + Commit**

---

## Phase 3：API 层

### Task 7: Admin Users 路由

**Files:**
- Create: `apps/api/src/routes/admin-users.ts`
- Create: `apps/api/src/routes/admin-users.test.ts`
- Modify: `apps/api/src/bootstrap-plus.ts`

- [ ] **Step 1: 集成测试（inject）**

```typescript
describe("admin users API", () => {
  it("GET /api/admin/users requires admin", async () => {
    const memberRes = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: memberSessionCookie,
    });
    expect(memberRes.statusCode).toBe(403);
  });

  it("POST /api/admin/users creates direct user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: adminCookie,
      payload: { email: "u@x.com", password: "secret1234", mustChangePassword: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().temporaryPassword).toBeDefined();
  });
});
```

- [ ] **Step 2: 实现路由**

```typescript
export function registerAdminUserRoutes(app, deps: {
  userAdmin: UserAdminService;
  getRuntimeConfig: () => Promise<RuntimeConfig>;
  sendInviteEmail: (opts: { to: string; inviteUrl: string }) => Promise<void>;
}) {
  const adminOnly = /* same pattern as admin.ts */;

  app.get("/api/admin/users", { preHandler: adminOnly }, async () => {
    return { users: await deps.userAdmin.list() };
  });

  app.post("/api/admin/users/invite", { preHandler: adminOnly }, async (request, reply) => {
    const runtime = await deps.getRuntimeConfig();
    if (!runtime.passwordResetEnabled) {
      return reply.status(503).send({ code: "E5003", message: "SMTP not configured" });
    }
  /* email, isAdmin */ });

  app.post("/api/admin/users", { preHandler: adminOnly }, /* direct create */);
  app.patch("/api/admin/users/:id", { preHandler: adminOnly }, /* status, isAdmin, resetPassword */);
  app.delete("/api/admin/users/:id", { preHandler: adminOnly }, /* disabled only */);
  app.post("/api/admin/users/:id/resend-invite", { preHandler: adminOnly }, /* ... */);
}
```

邀请邮件 URL：`${publicUrl}/accept-invite?token=...`

- [ ] **Step 3: bootstrap-plus 注册 + 测试 PASS + Commit**

---

### Task 8: Auth — accept-invite 与 login 扩展

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/auth-invite.test.ts`

- [ ] **Step 1: 测试 accept-invite**

```typescript
it("POST /api/auth/accept-invite activates pending user", async () => {
  // setup pending user + token via services
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/accept-invite",
    payload: { token, password: "newpass1234" },
  });
  expect(res.statusCode).toBe(200);
});
```

- [ ] **Step 2: 实现 endpoint**

- [ ] **Step 3: login 成功时 `touchLastLogin`；`/api/auth/status` 返回 `mustChangePassword`**

```typescript
return {
  needsSetup,
  authenticated: Boolean(ctx),
  user: ctx ? { email: ctx.email, role: ctx.role, mustChangePassword: ctx.mustChangePassword } : null,
};
```

需在 `AuthContext` / session 查询中加载 `mustChangePassword`；pending/disabled 用户拒绝登录。

- [ ] **Step 4: PASS + Commit**

---

### Task 9: Workflows ACL 与 Collaborators API

**Files:**
- Modify: `apps/api/src/routes/workflows.ts`
- Create: `apps/api/src/middleware/workflow-access.ts`
- Create: `apps/api/src/routes/workflows-acl.test.ts`

- [ ] **Step 1: 测试 list scope**

```typescript
it("GET /api/workflows?scope=shared returns only shared workflows for member", async () => {
  // admin creates W, shares viewer to member
  const res = await app.inject({
    method: "GET",
    url: "/api/workflows?scope=shared",
    headers: memberCookie,
  });
  const ids = res.json().workflows.map((w: { id: string }) => w.id);
  expect(ids).toEqual([workflowId]);
});
```

- [ ] **Step 2: GET /api/workflows 解析 query `scope`**

| scope | 谁可用 | 行为 |
|-------|--------|------|
| 默认 | 非 Admin | mine ∪ shared |
| `mine` | 非 Admin | created_by = me |
| `shared` | 非 Admin | collaborator 非 creator |
| `all` | Admin | 全部 |

- [ ] **Step 3: 所有 mutating workflow routes 加 access check**

`GET/PUT/DELETE /api/workflows/:id` — `assertCanView` / `assertCanEdit`。

`POST /api/workflows` — 传入 `request.auth.userId` 为 `createdByUserId`。

- [ ] **Step 4: Collaborators endpoints**

```typescript
app.get("/api/workflows/:workflowId/collaborators", { preHandler: [auth, loadWorkflowAccess] }, ...);
app.put("/api/workflows/:workflowId/collaborators", { preHandler: [auth, loadWorkflowAccess] }, ...);
// body: { collaborators: [{ userId, role }] } — 不可移除 creator；至少一名 owner
```

- [ ] **Step 5: PASS + Commit**

---

## Phase 4：Web 前端

### Task 10: API Client 与设置导航

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/settings/settings-nav-config.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: client 类型与方法**

```typescript
export interface AdminUserSummary {
  id: string;
  email: string;
  isAdmin: boolean;
  status: 'active' | 'disabled' | 'pending_invite';
  joinMethod: 'invite' | 'direct' | null;
  lastLoginAt: string | null;
}

export const api = {
  adminUsers: {
    list: () => fetchJson<{ users: AdminUserSummary[] }>('/api/admin/users'),
    invite: (body: { email: string; isAdmin?: boolean }) => ...,
    create: (body: { email: string; password: string; isAdmin?: boolean; mustChangePassword?: boolean }) => ...,
    patch: (id: string, body: Partial<{ status: string; isAdmin: boolean; resetPassword: boolean }>) => ...,
    remove: (id: string) => ...,
    resendInvite: (id: string) => ...,
  },
  workflows: {
    list: (scope?: 'mine' | 'shared' | 'all') => ...,
    listCollaborators: (workflowId: string) => ...,
    updateCollaborators: (workflowId: string, collaborators: Array<{ userId: string; role: string }>) => ...,
  },
};
```

- [ ] **Step 2: settings-nav 增加团队分组；profile 改名「我的账号」**

- [ ] **Step 3: App.tsx 注册路由**

```tsx
<Route path="users" element={<AdminGuard><UsersAdminPage /></AdminGuard>} />
<Route path="roles" element={<RolesReferencePage />} />
```

公开路由（未登录可访问）：

```tsx
<Route path="/accept-invite" element={<AcceptInvitePage />} />
```

- [ ] **Step 4: Commit**

---

### Task 11: UsersAdminPage

**Files:**
- Create: `apps/web/src/features/settings/UsersAdminPage.tsx`
- Create: `apps/web/src/features/settings/AdminGuard.tsx`

- [ ] **Step 1: 页面骨架 — 表格 + 工具栏**

参考 `RunnerListPage` + `McpTokensPage` token-reveal 模式。

- [ ] **Step 2: InviteModal / CreateUserModal / UserRowMenu**

- 邀请按钮：`api.auth.passwordResetStatus()` → disabled + title
- 创建成功 `temporaryPassword` → `token-reveal` panel

- [ ] **Step 3: AdminGuard — 非 Admin 403 空态**

- [ ] **Step 4: 手动验证 AC-U1、AC-U2、AC-U5 + Commit**

---

### Task 12: RolesReferencePage + SettingsProfilePage

**Files:**
- Create: `apps/web/src/features/settings/RolesReferencePage.tsx`
- Modify: `apps/web/src/features/settings/SettingsProfilePage.tsx`

- [ ] **Step 1: RolesReferencePage — 静态矩阵 + 四角色说明**

数据可内联常量 `RBAC_MATRIX`（与 spec 表一致），无 API。

- [ ] **Step 2: Profile — 移除占位；Admin 标签；链到 /settings/roles**

- [ ] **Step 3: 验证 AC-U4 + Commit**

---

### Task 13: AcceptInvite + 强制改密

**Files:**
- Create: `apps/web/src/features/auth/AcceptInvitePage.tsx`
- Create: `apps/web/src/features/auth/ChangePasswordRequiredPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: AcceptInvitePage — 读 query token，表单设密**

- [ ] **Step 2: App 壳层：auth.status.mustChangePassword → 重定向 ChangePasswordRequiredPage**

```typescript
if (user?.mustChangePassword && !location.pathname.startsWith('/change-password')) {
  return <Navigate to="/change-password" replace />;
}
```

- [ ] **Step 3: ChangePasswordRequiredPage 调 PATCH/POST 改密后 refreshAuth**

- [ ] **Step 4: Commit**

---

### Task 14: WorkflowListPage scope + CollaboratorsPanel

**Files:**
- Modify: `apps/web/src/features/workflows/WorkflowListPage.tsx`
- Create: `apps/web/src/features/editor/WorkflowCollaboratorsPanel.tsx`
- Modify: `apps/web/src/features/editor/WorkflowEditorPage.tsx`

- [ ] **Step 1: WorkflowListPage Segmented + scope query**

Admin 见「我的工作流 | 全部」；非 Admin 见「全部 | 我创建的 | 与我共享的」。

Viewer 行：Link 文案「查看」；隐藏删除。

- [ ] **Step 2: WorkflowEditorPage showSettings 面板改为 Tabs：Runner | 协作**

```tsx
{showSettings && (
  <motion.div className="panel">
    <div className="segmented">
      <button type="button" className={tab === 'runner' ? 'active' : ''} onClick={() => setTab('runner')}>Runner</button>
      <button type="button" className={tab === 'collab' ? 'active' : ''} onClick={() => setTab('collab')}>协作</button>
    </motion.div>
    {tab === 'runner' && <RunnerPolicyEditor ... />}
    {tab === 'collab' && workflowId && workflowId !== 'new' && (
      <WorkflowCollaboratorsPanel workflowId={workflowId} readOnly={!canShare} />
    )}
  </motion.div>
)}
```

`canShare` 来自 workflow detail 新增字段 `accessRole`（API 返回）。

- [ ] **Step 3: WorkflowCollaboratorsPanel — 列表 + 添加 Modal（用户下拉来自 admin list 子集 active users，Member 侧仅协作面板内 search endpoint）**

非 Admin 不能 list all users → 新增 `GET /api/workflows/:id/collaborators/candidates` 返回活跃用户邮箱（需 share 权限）。

- [ ] **Step 4: 验证 AC-U3 + Commit**

---

## Phase 5：文档与收尾

### Task 15: error-codes 与 spec 同步

**Files:**
- Modify: `docs/error-codes.md`
- Modify: `docs/ux-ui-design.md` §3.20
- Modify: `docs/spec.md` FR-6 Lite 表
- Modify: `docs/superpowers/specs/2026-05-23-user-role-management-design.md`（状态 → Approved）

- [x] **Step 1: error-codes 追加**

| E4003 | 无权访问用户管理 / 工作流 |
| E4003 | 至少保留一名管理员 |
| E1004 | 该用户尚未加入团队 |
| E4002 | 邀请链接无效或已过期 |

- [x] **Step 2: ux-ui-design §3.20 改为「用户与权限」，删除席位 wireframe**

- [x] **Step 3: spec.md — Lite RBAC 改为与 Standard 相同四角色描述；FR-21 移除 20 席位硬上限表述（或标注 deprecated）**

- [x] **Step 4: Commit**（文档已更新；未 git commit，按任务要求）

```bash
git add docs/
git commit -m "docs: user RBAC UX spec and error codes"
```

---

## Spec 覆盖自检

| Spec 章节 | Task |
|-----------|------|
| §4 信息架构 | Task 10 |
| §5 用户管理 | Task 7, 11 |
| §6 角色矩阵 | Task 12 |
| §7 工作流协作 | Task 9, 14 |
| §8 我的账号 | Task 12 |
| §9 邀请/改密 | Task 8, 13 |
| §10 API | Task 7–9 |
| §11 错误码 | Task 15 |
| §12 AC-U1–U5 | Task 11, 12, 13, 14 |
| Lite=Standard RBAC | Task 1–9 |
| 无席位 | Task 11（无席位 UI）；Task 15（文档） |

---

## 执行顺序依赖

```
Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11–14（11/12 可与 13 并行）→ 15
```

**Standard profile：** Task 1 Step 3 与 Task 5 需在 standard repositories 镜像实现后再跑 Standard 集成测试；可复用 `standard-profile.integration.test.ts` 模式。
