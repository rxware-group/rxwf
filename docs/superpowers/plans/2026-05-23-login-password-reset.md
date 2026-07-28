# 登录页改版与邮件找回密码 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改版登录页 UI（品牌占位、居中标题、自适应按钮、忘记密码链接），并将 SMTP/站点/集成配置迁移至管理员设置页；实现基于邮件的多页找回密码流程。

**Architecture:** 新建 `@rxwf/system-settings` 包，提供 `SystemSettingsService`（DB `system_settings` 表 + AES 敏感字段）与 `getRuntimeConfig()`（env 默认值"> DB 覆盖）；`@rxwf/identity` 扩展密码重置服务与 `password_reset_tokens` 表；API 层 nodemailer 发信；Web 层新增公开 auth 路由与 `/settings/system` 管理页。

**Tech Stack:** TypeScript、Fastify、Drizzle/SQLite、Vitest、React 19、react-router-dom、nodemailer。

**设计依据:** [2026-05-23-login-password-reset-design.md](../specs/2026-05-23-login-password-reset-design.md)

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/system-settings/package.json` | 新 workspace 包 |
| `packages/system-settings/src/keys.ts` | 设置键常量 |
| `packages/system-settings/src/system-settings-service.ts` | DB 读写 + 敏感加密 |
| `packages/system-settings/src/runtime-config.ts` | env 默认值 + DB 合并 |
| `packages/system-settings/src/mailer.ts` | nodemailer 封装 |
| `packages/system-settings/src/index.ts` | 导出 |
| `packages/providers/lite/src/drizzle/schema.ts` | 新增 `system_settings`、`password_reset_tokens` |
| `packages/providers/lite/src/drizzle/apply-schema.ts` | DDL 同步 |
| `packages/providers/standard/src/drizzle/schema.ts` | 同上（Postgres） |
| `packages/identity/src/password-reset-service.ts` | 找回/重置逻辑 |
| `packages/identity/src/user-service.ts` | 新增 `updatePassword` |
| `packages/identity/src/auth-service.ts` | 新增 `deleteUserSessions` |
| `apps/api/src/config.ts` | 仅保留 bootstrap 项 + `envDefaults` |
| `apps/api/src/routes/settings.ts` | `/api/settings/system` |
| `apps/api/src/routes/auth.ts` | branding / forgot / reset / status |
| `apps/api/src/app-context.ts` | 挂载 runtimeConfig + settingsService |
| `apps/web/src/features/auth/LoginPage.tsx` | UI 改版 |
| `apps/web/src/features/auth/ForgotPasswordPage.tsx` | 新建 |
| `apps/web/src/features/auth/ResetPasswordPage.tsx` | 新建 |
| `apps/web/src/features/auth/AuthBranding.tsx` | 品牌占位组件 |
| `apps/web/src/features/settings/SystemSettingsPage.tsx` | 系统配置页 |
| `apps/web/src/features/settings/ModelSettingsPage.tsx` | 改读服务端 |
| `apps/web/src/App.tsx` | 公开 auth 路由 |
| `apps/web/src/api/client.ts` | 新 API 方法 |
| `apps/web/src/styles.css` | auth 样式 |

---

## Phase 1：Schema 与 system-settings 包

### Task 1: 新增数据库表

**Files:**
- Modify: `packages/providers/lite/src/drizzle/schema.ts`
- Modify: `packages/providers/lite/src/drizzle/apply-schema.ts`
- Modify: `packages/providers/standard/src/drizzle/schema.ts`

- [ ] **Step 1: 在 lite schema 追加表定义**

```typescript
// packages/providers/lite/src/drizzle/schema.ts（追加）
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  sensitive: integer("sensitive", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

- [ ] **Step 2: 在 apply-schema.ts DDL 追加**

```sql
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id ON password_reset_tokens(user_id);
```

- [ ] **Step 3: standard schema 同步（pgTable 等价定义）**

- [ ] **Step 4: Commit**

```bash
git add packages/providers/lite/src/drizzle/schema.ts packages/providers/lite/src/drizzle/apply-schema.ts packages/providers/standard/src/drizzle/schema.ts
git commit -m "feat(schema): add system_settings and password_reset_tokens tables"
```

---

### Task 2: 创建 @rxwf/system-settings 包

**Files:**
- Create: `packages/system-settings/package.json`
- Create: `packages/system-settings/tsconfig.json`
- Create: `packages/system-settings/src/keys.ts`
- Create: `packages/system-settings/src/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@rxwf/system-settings",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@rxwf/credential": "workspace:*",
    "@rxwf/providers-lite": "workspace:*",
    "drizzle-orm": "^0.43.1",
    "nodemailer": "^7.0.3"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.17",
    "better-sqlite3": "^11.10.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: 创建 keys.ts**

```typescript
// packages/system-settings/src/keys.ts
export const SETTING_KEYS = {
  publicUrl: "publicUrl",
  smtpHost: "smtp.host",
  smtpPort: "smtp.port",
  smtpSecure: "smtp.secure",
  smtpUser: "smtp.user",
  smtpPassword: "smtp.password",
  smtpFrom: "smtp.from",
  ollamaUrl: "ollamaUrl",
  ollamaModel: "ollamaModel",
  webhookSecret: "webhookSecret",
  brandLogoUrl: "brand.logoUrl",
  brandProductName: "brand.productName",
} as const;

export const SENSITIVE_KEYS = new Set<string>([
  SETTING_KEYS.smtpPassword,
  SETTING_KEYS.webhookSecret,
]);

export const MASK = "***";
```

- [ ] **Step 3: 在 apps/api/package.json 添加依赖 `"@rxwf/system-settings": "workspace:*"`

- [ ] **Step 4: 运行 `pnpm install`**

Run: `pnpm install`
Expected: lockfile 更新，无错误

- [ ] **Step 5: Commit**

```bash
git add packages/system-settings package.json pnpm-lock.yaml apps/api/package.json
git commit -m "chore: scaffold @rxwf/system-settings package"
```

---

### Task 3: SystemSettingsService（TDD）

**Files:**
- Create: `packages/system-settings/src/system-settings-service.ts`
- Create: `packages/system-settings/src/system-settings-service.test.ts`
- Modify: `packages/system-settings/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/system-settings/src/system-settings-service.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { parseCredentialKey } from "@rxwf/credential";
import { createSystemSettingsService } from "./system-settings-service.js";
import { SETTING_KEYS, MASK } from "./keys.js";

const testKey = parseCredentialKey(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("SystemSettingsService", () => {
  it("stores plaintext and encrypts sensitive values", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    await svc.set(SETTING_KEYS.publicUrl, "http://localhost:8787");
    await svc.set(SETTING_KEYS.smtpPassword, "secret-pass", true);
    expect(await svc.get(SETTING_KEYS.publicUrl)).toBe("http://localhost:8787");
    expect(await svc.get(SETTING_KEYS.smtpPassword)).toBe("secret-pass");
    const snap = await svc.getPublicSnapshot();
    expect(snap[SETTING_KEYS.publicUrl]).toBe("http://localhost:8787");
    expect(snap[SETTING_KEYS.smtpPassword]).toBe(MASK);
  });

  it("setMany skips empty sensitive updates", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    await svc.set(SETTING_KEYS.webhookSecret, "abc", true);
    await svc.setMany([{ key: SETTING_KEYS.webhookSecret, value: "", sensitive: true }]);
    expect(await svc.get(SETTING_KEYS.webhookSecret)).toBe("abc");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @rxwf/system-settings test`
Expected: FAIL `createSystemSettingsService` not found

- [ ] **Step 3: 实现 service**

```typescript
// packages/system-settings/src/system-settings-service.ts
import { eq } from "drizzle-orm";
import type { LiteDatabase } from "@rxwf/providers-lite";
import { liteSchema } from "@rxwf/providers-lite";
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
} from "@rxwf/credential";
import { MASK, SENSITIVE_KEYS } from "./keys.js";

const table = liteSchema.systemSettings;

export function createSystemSettingsService(
  db: LiteDatabase,
  encryptionKey: Buffer,
) {
  const readValue = (row: { value: string; sensitive: boolean }) =>
    row.sensitive
      ? decryptCredentialPayload(row.value, encryptionKey)
      : row.value;

  return {
    async get(key: string): Promise<string | undefined> {
      const rows = await db
        .select()
        .from(table)
        .where(eq(table.key, key))
        .limit(1);
      const row = rows[0];
      return row ? readValue(row) : undefined;
    },

    async getMany(keys: string[]): Promise<Record<string, string>> {
      const out: Record<string, string> = {};
      for (const key of keys) {
        const v = await this.get(key);
        if (v !== undefined) out[key] = v;
      }
      return out;
    },

    async set(key: string, value: string, sensitive = SENSITIVE_KEYS.has(key)) {
      const stored = sensitive
        ? encryptCredentialPayload(value, encryptionKey)
        : value;
      const now = new Date();
      const rows = await db.select().from(table).where(eq(table.key, key)).limit(1);
      if (rows[0]) {
        await db
          .update(table)
          .set({ value: stored, sensitive, updatedAt: now })
          .where(eq(table.key, key));
      } else {
        await db.insert(table).values({ key, value: stored, sensitive, updatedAt: now });
      }
    },

    async setMany(
      entries: Array<{ key: string; value: string; sensitive?: boolean }>,
    ) {
      for (const e of entries) {
        if (SENSITIVE_KEYS.has(e.key) && e.value === "") continue;
        await this.set(e.key, e.value, e.sensitive ?? SENSITIVE_KEYS.has(e.key));
      }
    },

    async getPublicSnapshot(): Promise<Record<string, string>> {
      const rows = await db.select().from(table);
      const out: Record<string, string> = {};
      for (const row of rows) {
        out[row.key] = row.sensitive ? MASK : row.value;
      }
      return out;
    },
  };
}

export type SystemSettingsService = ReturnType<typeof createSystemSettingsService>;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @rxwf/system-settings test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/system-settings/src/system-settings-service.ts packages/system-settings/src/system-settings-service.test.ts packages/system-settings/src/index.ts
git commit -m "feat(system-settings): add SystemSettingsService with sensitive encryption"
```

---

### Task 4: RuntimeConfig 合并

**Files:**
- Create: `packages/system-settings/src/runtime-config.ts`
- Create: `packages/system-settings/src/runtime-config.test.ts`
- Modify: `packages/system-settings/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/system-settings/src/runtime-config.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { parseCredentialKey } from "@rxwf/credential";
import { createSystemSettingsService } from "./system-settings-service.js";
import { getRuntimeConfig } from "./runtime-config.js";
import { SETTING_KEYS } from "./keys.js";

const testKey = parseCredentialKey(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

describe("getRuntimeConfig", () => {
  it("uses env defaults when DB empty, DB overrides when set", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    const defaults = { publicUrl: "http://env:8787", ollamaUrl: "http://127.0.0.1:11434" };
    const a = await getRuntimeConfig(svc, defaults);
    expect(a.publicUrl).toBe("http://env:8787");
    await svc.set(SETTING_KEYS.publicUrl, "http://db:9000");
    const b = await getRuntimeConfig(svc, defaults);
    expect(b.publicUrl).toBe("http://db:9000");
  });

  it("isPasswordResetEnabled requires smtp host/port/from and publicUrl", async () => {
    const db = await createTestDb();
    const svc = createSystemSettingsService(db, testKey);
    const cfg = await getRuntimeConfig(svc, { publicUrl: "http://x" });
    expect(cfg.passwordResetEnabled).toBe(false);
    await svc.set(SETTING_KEYS.smtpHost, "smtp.test");
    await svc.set(SETTING_KEYS.smtpPort, "587");
    await svc.set(SETTING_KEYS.smtpFrom, "noreply@test.com");
    const cfg2 = await getRuntimeConfig(svc, { publicUrl: "http://x" });
    expect(cfg2.passwordResetEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @rxwf/system-settings test`
Expected: FAIL

- [ ] **Step 3: 实现 runtime-config.ts**

```typescript
// packages/system-settings/src/runtime-config.ts
import type { SystemSettingsService } from "./system-settings-service.js";
import { SETTING_KEYS } from "./keys.js";

export interface EnvDefaults {
  publicUrl: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  ollamaUrl: string;
  ollamaModel: string;
  webhookSecret: string;
  brandProductName?: string;
  brandLogoUrl?: string;
}

export interface RuntimeConfig {
  publicUrl: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  ollamaUrl: string;
  ollamaModel: string;
  webhookSecret: string;
  brand: { productName: string; logoUrl: string };
  passwordResetEnabled: boolean;
}

export async function getRuntimeConfig(
  settings: SystemSettingsService,
  env: EnvDefaults,
): Promise<RuntimeConfig> {
  const pick = async (key: string, fallback: string) =>
    (await settings.get(key)) ?? fallback;

  const publicUrl = await pick(SETTING_KEYS.publicUrl, env.publicUrl);
  const smtp = {
    host: await pick(SETTING_KEYS.smtpHost, env.smtpHost ?? ""),
    port: Number(await pick(SETTING_KEYS.smtpPort, env.smtpPort ?? "587")),
    secure: (await pick(SETTING_KEYS.smtpSecure, env.smtpSecure ?? "false")) === "true",
    user: await pick(SETTING_KEYS.smtpUser, env.smtpUser ?? ""),
    password: await pick(SETTING_KEYS.smtpPassword, env.smtpPassword ?? ""),
    from: await pick(SETTING_KEYS.smtpFrom, env.smtpFrom ?? ""),
  };
  const passwordResetEnabled =
    Boolean(publicUrl) &&
    Boolean(smtp.host) &&
    Boolean(smtp.port) &&
    Boolean(smtp.from);

  return {
    publicUrl,
    smtp,
    ollamaUrl: await pick(SETTING_KEYS.ollamaUrl, env.ollamaUrl),
    ollamaModel: await pick(SETTING_KEYS.ollamaModel, env.ollamaModel),
    webhookSecret: await pick(SETTING_KEYS.webhookSecret, env.webhookSecret),
    brand: {
      productName: await pick(SETTING_KEYS.brandProductName, env.brandProductName ?? "RX-Workflow"),
      logoUrl: await pick(SETTING_KEYS.brandLogoUrl, env.brandLogoUrl ?? ""),
    },
    passwordResetEnabled,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @rxwf/system-settings test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/system-settings/src/runtime-config.ts packages/system-settings/src/runtime-config.test.ts
git commit -m "feat(system-settings): add getRuntimeConfig with passwordResetEnabled"
```

---

### Task 5: Mailer

**Files:**
- Create: `packages/system-settings/src/mailer.ts`
- Create: `packages/system-settings/src/mailer.test.ts`

- [ ] **Step 1: 写失败测试（mock transport）**

```typescript
// packages/system-settings/src/mailer.test.ts
import { describe, it, expect } from "vitest";
import { createMailer } from "./mailer.js";

describe("createMailer", () => {
  it("sendMail invokes transport", async () => {
    const sent: unknown[] = [];
    const mailer = createMailer(
      {
        host: "smtp.test",
        port: 587,
        secure: false,
        user: "u",
        password: "p",
        from: "noreply@test.com",
      },
      {
        sendMail: async (opts) => {
          sent.push(opts);
          return { messageId: "1" };
        },
      },
    );
    await mailer.send({
      to: "a@test.com",
      subject: "Hi",
      text: "Body",
    });
    expect(sent).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 实现 mailer.ts**

```typescript
// packages/system-settings/src/mailer.ts
import nodemailer from "nodemailer";
import type { RuntimeConfig } from "./runtime-config.js";

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

export function createMailer(
  smtp: RuntimeConfig["smtp"],
  transport?: { sendMail: (opts: nodemailer.SendMailOptions) => Promise<unknown> },
) {
  const transporter =
    transport ??
    nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    });

  return {
    async send(payload: MailPayload) {
      await transporter.sendMail({
        from: smtp.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
    },
  };
}
```

- [ ] **Step 3: 运行测试、Commit**

Run: `pnpm --filter @rxwf/system-settings test`
Expected: PASS

```bash
git commit -m "feat(system-settings): add nodemailer wrapper with injectable transport"
```

---

## Phase 2：config 重构与 Settings API

### Task 6: 精简 config.ts

**Files:**
- Modify: `apps/api/src/config.ts`

- [ ] **Step 1: 重构 config.ts**

```typescript
// apps/api/src/config.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "data",
);

/** 启动/基础设施 — 不可经 UI 修改 */
export const config = {
  httpPort: Number(process.env.RXWF_HTTP_PORT ?? 8787),
  dataDir: process.env.RXWF_DATA_DIR ?? defaultDataDir,
  deployProfile: process.env.RXWF_DEPLOY_PROFILE ?? "lite",
  featurePlus: process.env.RXWF_FEATURE_PLUS !== "false",
  schedulerTickMs: Number(process.env.RXWF_SCHEDULER_TICK_MS ?? 60_000),
  schedulerDisabled: process.env.RXWF_SCHEDULER_DISABLED === "true",
  jobProcessorTickMs: Number(process.env.RXWF_JOB_TICK_MS ?? 5_000),
  jobProcessorDisabled: process.env.RXWF_JOB_PROCESSOR_DISABLED === "true",
  credentialKey:
    process.env.RXWF_CREDENTIAL_KEY ??
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  databaseUrl:
    process.env.RXWF_DATABASE_URL ??
    process.env.RXWF_POSTGRES_URL ??
    "postgres://rxwf:rxwf@localhost:5432/rxwf",
  redisUrl: process.env.RXWF_REDIS_URL ?? "redis://localhost:6379",
} as const;

/** 可迁移至 system_settings 的环境变量默认值 */
export const envDefaults = {
  publicUrl: process.env.RXWF_PUBLIC_URL ?? "http://localhost:8787",
  smtpHost: process.env.RXWF_SMTP_HOST,
  smtpPort: process.env.RXWF_SMTP_PORT,
  smtpSecure: process.env.RXWF_SMTP_SECURE,
  smtpUser: process.env.RXWF_SMTP_USER,
  smtpPassword: process.env.RXWF_SMTP_PASSWORD,
  smtpFrom: process.env.RXWF_SMTP_FROM,
  ollamaUrl: process.env.RXWF_OLLAMA_URL ?? "http://127.0.0.1:11434",
  ollamaModel: process.env.RXWF_OLLAMA_MODEL ?? "llama3",
  webhookSecret: process.env.RXWF_WEBHOOK_SECRET ?? "dev-webhook-secret",
  brandProductName: process.env.RXWF_BRAND_NAME,
  brandLogoUrl: process.env.RXWF_BRAND_LOGO_URL,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/config.ts
git commit -m "refactor(api): split bootstrap config from envDefaults for system settings"
```

---

### Task 7: AppContext 挂载 runtimeConfig

**Files:**
- Modify: `apps/api/src/app-context.ts`

- [ ] **Step 1: 扩展 AppContext**

```typescript
// app-context.ts 新增 import
import { parseCredentialKey } from "@rxwf/credential";
import {
  createSystemSettingsService,
  getRuntimeConfig,
  type RuntimeConfig,
  type SystemSettingsService,
} from "@rxwf/system-settings";
import { config, envDefaults } from "./config.js";

// AppContext 接口追加：
//   settingsService: SystemSettingsService;
//   getRuntimeConfig: () => Promise<RuntimeConfig>;

// createAppContext 内 liteDb 创建后：
const encryptionKey = parseCredentialKey(config.credentialKey);
const settingsService = createSystemSettingsService(liteDb, encryptionKey);
const loadRuntimeConfig = () => getRuntimeConfig(settingsService, envDefaults);

// 两处 return 对象均追加 settingsService, getRuntimeConfig: loadRuntimeConfig
// runtimeOpts 改为：
const runtime = await loadRuntimeConfig();
const runtimeOpts = {
  featurePlus,
  ollamaUrl: runtime.ollamaUrl,
  ollamaModel: runtime.ollamaModel,
};
```

- [ ] **Step 2: 运行 API 测试**

Run: `pnpm --filter @rxwf/api test`
Expected: PASS（现有测试仍通过）

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): wire SystemSettingsService and getRuntimeConfig into AppContext"
```

---

### Task 8: Settings API 路由

**Files:**
- Create: `apps/api/src/routes/settings.ts`
- Create: `apps/api/src/routes/settings.test.ts`
- Modify: `apps/api/src/bootstrap.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// apps/api/src/routes/settings.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SESSION_COOKIE_NAME } from "@rxwf/identity";
import { createTestDb } from "@rxwf/providers-lite";
import { buildApp } from "../app.js";

describe("settings routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>["app"];
  let adminCookie: string;

  beforeAll(async () => {
    const db = await createTestDb();
    const built = await buildApp({ db, disableScheduler: true, disableJobProcessor: true });
    app = built.app;
    await app.ready();
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { email: "admin@test.com", password: "secret123" },
    });
    const raw = setup.headers["set-cookie"];
    const line = Array.isArray(raw) ? raw[0] : raw;
    adminCookie = `${SESSION_COOKIE_NAME}=${line?.match(/awf_session=([^;]+)/)?.[1]}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/settings/system requires admin", async () => {
    const res = await app.inject({ method: "GET", url: "/api/settings/system" });
    expect(res.statusCode).toBe(401);
  });

  it("admin can read and update publicUrl", async () => {
    const get = await app.inject({
      method: "GET",
      url: "/api/settings/system",
      headers: { cookie: adminCookie },
    });
    expect(get.statusCode).toBe(200);
    const put = await app.inject({
      method: "PUT",
      url: "/api/settings/system",
      headers: { cookie: adminCookie },
      payload: { publicUrl: "http://localhost:9999" },
    });
    expect(put.statusCode).toBe(200);
    const get2 = await app.inject({
      method: "GET",
      url: "/api/settings/system",
      headers: { cookie: adminCookie },
    });
    expect(get2.json().publicUrl).toBe("http://localhost:9999");
  });
});
```

- [ ] **Step 2: 实现 settings.ts**

```typescript
// apps/api/src/routes/settings.ts
import { SETTING_KEYS, MASK } from "@rxwf/system-settings";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../app-context.js";

function adminOnly(preHandler: Parameters<FastifyInstance["get"]>[1]) {
  return preHandler;
}

export function registerSettingsRoutes(
  app: FastifyInstance,
  ctx: Pick<AppContext, "settingsService" | "getRuntimeConfig" | "authService">,
  authPreHandler: (req: unknown, reply: unknown) => Promise<void>,
) {
  const requireAdmin = async (request: { auth?: { role: string } }, reply: { status: (n: number) => { send: (b: unknown) => unknown } }) => {
    await authPreHandler(request, reply);
    if (request.auth?.role !== "admin") {
      return reply.status(403).send({ code: "E5002", message: "Admin required" });
    }
  };

  app.get("/api/settings/system", { preHandler: requireAdmin }, async () => {
    const snap = await ctx.settingsService.getPublicSnapshot();
    const runtime = await ctx.getRuntimeConfig();
    return {
      publicUrl: snap[SETTING_KEYS.publicUrl] ?? runtime.publicUrl,
      smtpHost: snap[SETTING_KEYS.smtpHost] ?? "",
      smtpPort: snap[SETTING_KEYS.smtpPort] ?? "587",
      smtpSecure: snap[SETTING_KEYS.smtpSecure] ?? "false",
      smtpUser: snap[SETTING_KEYS.smtpUser] ?? "",
      smtpPassword: snap[SETTING_KEYS.smtpPassword] ? MASK : "",
      smtpFrom: snap[SETTING_KEYS.smtpFrom] ?? "",
      ollamaUrl: snap[SETTING_KEYS.ollamaUrl] ?? runtime.ollamaUrl,
      ollamaModel: snap[SETTING_KEYS.ollamaModel] ?? runtime.ollamaModel,
      webhookSecret: snap[SETTING_KEYS.webhookSecret] ? MASK : "",
      brandProductName: snap[SETTING_KEYS.brandProductName] ?? runtime.brand.productName,
      brandLogoUrl: snap[SETTING_KEYS.brandLogoUrl] ?? "",
      passwordResetEnabled: runtime.passwordResetEnabled,
    };
  });

  app.put("/api/settings/system", { preHandler: requireAdmin }, async (request) => {
    const body = (request.body ?? {}) as Record<string, string | undefined>;
    const entries: Array<{ key: string; value: string }> = [];
    const map: Record<string, string> = {
      publicUrl: SETTING_KEYS.publicUrl,
      smtpHost: SETTING_KEYS.smtpHost,
      smtpPort: SETTING_KEYS.smtpPort,
      smtpSecure: SETTING_KEYS.smtpSecure,
      smtpUser: SETTING_KEYS.smtpUser,
      smtpPassword: SETTING_KEYS.smtpPassword,
      smtpFrom: SETTING_KEYS.smtpFrom,
      ollamaUrl: SETTING_KEYS.ollamaUrl,
      ollamaModel: SETTING_KEYS.ollamaModel,
      webhookSecret: SETTING_KEYS.webhookSecret,
      brandProductName: SETTING_KEYS.brandProductName,
      brandLogoUrl: SETTING_KEYS.brandLogoUrl,
    };
    for (const [field, key] of Object.entries(map)) {
      if (body[field] !== undefined) entries.push({ key, value: String(body[field]) });
    }
    await ctx.settingsService.setMany(entries);
    return { ok: true };
  });
}
```

- [ ] **Step 3: bootstrap.ts 注册**

```typescript
import { registerSettingsRoutes } from "./routes/settings.js";
// bootstrap 内 authPreHandler 创建后：
registerSettingsRoutes(app, ctx, authPreHandler);
```

- [ ] **Step 4: 运行测试、Commit**

Run: `pnpm --filter @rxwf/api test -- settings.test`
Expected: PASS

```bash
git commit -m "feat(api): add admin system settings routes"
```

---

## Phase 3：密码重置后端

### Task 9: identity 扩展

**Files:**
- Modify: `packages/identity/src/user-service.ts`
- Modify: `packages/identity/src/auth-service.ts`
- Create: `packages/identity/src/password-reset-service.ts`
- Create: `packages/identity/src/password-reset-service.test.ts`
- Modify: `packages/identity/src/index.ts`

- [ ] **Step 1: user-service 新增 updatePassword**

```typescript
async updatePassword(userId: string, password: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(usersTable.id, userId));
}
```

- [ ] **Step 2: auth-service 新增 deleteUserSessions**

```typescript
async deleteUserSessions(userId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}
```

- [ ] **Step 3: 写 password-reset 失败测试**

```typescript
// packages/identity/src/password-reset-service.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "@rxwf/providers-lite";
import { createUserService } from "./user-service.js";
import { createAuthService } from "./auth-service.js";
import { createPasswordResetService } from "./password-reset-service.js";

describe("PasswordResetService", () => {
  it("reset invalidates old password and sessions", async () => {
    const db = await createTestDb();
    const users = createUserService(db);
    const auth = createAuthService(db);
    const reset = createPasswordResetService(db);
    const user = await users.createUser({
      email: "u@test.com",
      password: "old-pass12",
      role: "member",
    });
    const { token } = await reset.createToken(user.id);
    await reset.consumeToken(token, "new-pass12");
    expect(await users.verifyPassword("u@test.com", "old-pass12")).toBeNull();
    expect(await users.verifyPassword("u@test.com", "new-pass12")).toBeTruthy();
  });
});
```

- [ ] **Step 4: 实现 password-reset-service.ts**

核心逻辑：
- `createToken(userId)` → `{ token, expiresAt }`，存 `hashSecret(token)`，TTL 1h，删除同用户未使用 token
- `consumeToken(token, password)` → 校验哈希/过期/usedAt，updatePassword，标记 usedAt，deleteUserSessions
- `findValidToken(token)` 内部方法

- [ ] **Step 5: 运行测试、Commit**

Run: `pnpm --filter @rxwf/identity test`
Expected: PASS

```bash
git commit -m "feat(identity): add password reset service and session cleanup"
```

---

### Task 10: Auth 路由扩展

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/routes/auth.test.ts`

- [ ] **Step 1: 扩展 auth.test.ts**

新增用例：
- `GET /api/auth/password-reset-status` 默认 `enabled: false`
- 配置 SMTP 后 `enabled: true`
- `POST /api/auth/forgot-password` 始终 200 统一文案
- `POST /api/auth/reset-password` 成功后可 login

- [ ] **Step 2: 扩展 registerAuthRoutes 签名**

```typescript
export function registerAuthRoutes(
  app: FastifyInstance,
  db: LiteDatabase,
  deps?: {
    getRuntimeConfig: () => Promise<RuntimeConfig>;
    sendResetEmail?: (opts: { to: string; resetUrl: string; productName: string }) => Promise<void>;
  },
): void
```

- [ ] **Step 3: 实现端点**

```typescript
app.get("/api/auth/password-reset-status", async (_req, reply) => {
  const runtime = await deps?.getRuntimeConfig();
  return { enabled: runtime?.passwordResetEnabled ?? false };
});

app.get("/api/auth/branding", async (_req, reply) => {
  const runtime = await deps?.getRuntimeConfig();
  return {
    productName: runtime?.brand.productName ?? "RX-Workflow",
    logoUrl: runtime?.brand.logoUrl ?? "",
  };
});

app.post("/api/auth/forgot-password", async (request, reply) => {
  const runtime = await deps?.getRuntimeConfig();
  if (!runtime?.passwordResetEnabled) {
    return reply.status(503).send({ code: "E5003", message: "Password reset not configured" });
  }
  const email = String((request.body as { email?: string })?.email ?? "").trim().toLowerCase();
  // rate limit 60s per email (module-level Map)
  const user = await userService.findByEmail(email);
  if (user) {
    const { token } = await passwordResetService.createToken(user.id);
    const url = `${runtime.publicUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
    await deps!.sendResetEmail!({ to: email, resetUrl: url, productName: runtime.brand.productName });
  }
  return {
    message: "如果该邮箱已注册，您将收到重置邮件。",
  };
});

app.post("/api/auth/reset-password", async (request, reply) => {
  const body = request.body as { token?: string; password?: string };
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return reply.status(400).send({ code: "E1004", message: "Password must be at least 8 characters" });
  }
  try {
    await passwordResetService.consumeToken(token, password);
    return { ok: true };
  } catch {
    return reply.status(400).send({ code: "E4002", message: "链接无效或已过期" });
  }
});
```

- [ ] **Step 4: bootstrap 传入 getRuntimeConfig + sendResetEmail（createMailer）**

- [ ] **Step 5: 运行 auth 测试、Commit**

Run: `pnpm --filter @rxwf/api test -- auth.test`
Expected: PASS

```bash
git commit -m "feat(api): add forgot/reset password and branding auth routes"
```

---

## Phase 4：消费方迁移

### Task 11: 替换 config 直接引用

**Files:**
- Modify: `apps/api/src/routes/system.ts`
- Modify: `apps/api/src/routes/mcp-tokens.ts`
- Modify: `apps/api/src/routes/setup.ts`
- Modify: `apps/api/src/bootstrap-plus.ts`

- [ ] **Step 1: system.ts 改用 async getRuntimeConfig**

```typescript
export function registerSystemRoutes(
  app: FastifyInstance,
  db?: LiteDatabase,
  getRuntimeConfig?: () => Promise<RuntimeConfig>,
) {
  app.get("/api/system/features", async () => {
    const runtime = getRuntimeConfig ? await getRuntimeConfig() : { publicUrl: envDefaults.publicUrl };
    // ...
    return { publicUrl: runtime.publicUrl, /* ... */ };
  });
}
```

- [ ] **Step 2: mcp-tokens / setup / bootstrap-plus 同样改法**

- [ ] **Step 3: 运行全量 API 测试**

Run: `pnpm --filter @rxwf/api test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(api): read publicUrl and ollama from runtime config"
```

---

## Phase 5：前端 Auth 页面

### Task 12: API client

**Files:**
- Modify: `apps/web/src/api/client.ts`

- [ ] **Step 1: 追加类型与方法**

```typescript
export interface AuthBranding {
  productName: string;
  logoUrl: string;
}

export interface SystemSettingsSnapshot {
  publicUrl: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  ollamaUrl: string;
  ollamaModel: string;
  webhookSecret: string;
  brandProductName: string;
  brandLogoUrl: string;
  passwordResetEnabled: boolean;
}

// api.auth 追加：
passwordResetStatus: () => apiFetch<{ enabled: boolean }>('/api/auth/password-reset-status'),
branding: () => apiFetch<AuthBranding>('/api/auth/branding'),
forgotPassword: (email: string) =>
  apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
resetPassword: (token: string, password: string) =>
  apiFetch<{ ok: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  }),

// api.settings 新增：
settings: {
  getSystem: () => apiFetch<SystemSettingsSnapshot>('/api/settings/system'),
  updateSystem: (body: Partial<SystemSettingsSnapshot>) =>
    apiFetch<{ ok: boolean }>('/api/settings/system', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  testEmail: () =>
    apiFetch<{ ok: boolean }>('/api/settings/system/test-email', { method: 'POST' }),
},
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(web): add auth and system settings API client methods"
```

---

### Task 13: AuthBranding + 公开路由

**Files:**
- Create: `apps/web/src/features/auth/AuthBranding.tsx`
- Create: `apps/web/src/features/auth/ForgotPasswordPage.tsx`
- Create: `apps/web/src/features/auth/ResetPasswordPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: AuthBranding 组件**

```tsx
// apps/web/src/features/auth/AuthBranding.tsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function AuthBranding() {
  const [brand, setBrand] = useState({ productName: 'RX-Workflow', logoUrl: '' });
  useEffect(() => {
    void api.auth.branding().then(setBrand).catch(() => undefined);
  }, []);
  return (
    <div className="auth-brand">
      <div className="auth-brand-logo" aria-hidden>
        {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : null}
      </div>
      <p className="auth-brand-name">{brand.productName}</p>
    </div>
  );
}
```


- [ ] **Step 2: ForgotPasswordPage / ResetPasswordPage**

ForgotPasswordPage：邮箱表单 → 提交 → 显示统一成功文案 + 返回登录链接  
ResetPasswordPage：读 `useSearchParams().get('token')`；密码 + 确认；≥8 位；成功后跳转 `/login`

- [ ] **Step 3: App.tsx 公开路由**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';

if (phase === 'login') {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={() => void refreshAuth()} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): add forgot/reset password pages and public auth routes"
```

---

### Task 14: LoginPage UI 改版

**Files:**
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: 更新 LoginPage.tsx**

```tsx
import { Link } from 'react-router-dom';
import { AuthBranding } from './AuthBranding.js';

// 删除 hint 段落
// 表单顶部加 <AuthBranding />
// h1 保留「登录」
// button 外包 <div className="auth-actions">
// button 后：
{resetEnabled && (
  <Link to="/forgot-password" className="auth-forgot-link">忘记密码？</Link>
)}
```

- [ ] **Step 2: 更新 styles.css**

```css
.auth-brand {
  text-align: center;
  margin-bottom: 1.25rem;
}
.auth-brand-logo {
  width: 48px;
  height: 48px;
  margin: 0 auto 0.5rem;
  border-radius: 10px;
  background: var(--rxwf-border);
}
.auth-brand-name {
  margin: 0;
  font-size: 1rem;
  color: var(--rxwf-muted, #8b949e);
}
.auth-card h1 {
  text-align: center;
}
.auth-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1.5rem;
}
.auth-card button[type='submit'] {
  width: auto;
  min-width: 6rem;
  padding: 0.65rem 1.5rem;
  margin-top: 0;
}
.auth-forgot-link {
  display: block;
  margin-top: 0.75rem;
  text-align: center;
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): refresh login page UI with branding and forgot password link"
```

---

## Phase 6：系统设置页

### Task 15: SystemSettingsPage

**Files:**
- Create: `apps/web/src/features/settings/SystemSettingsPage.tsx`
- Modify: `apps/web/src/features/settings/SettingsLayout.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 实现三分组表单（站点 / 邮件 / 集成）**

- 加载 `api.settings.getSystem()`
- 保存 `api.settings.updateSystem(form)` — 敏感字段空则不提交
- 「发送测试邮件」调用 `api.settings.testEmail()`
- SMTP 未配置时邮件分组顶部 hint

- [ ] **Step 2: SettingsLayout admin 导航增加「系统配置」→ `/settings/system`**

- [ ] **Step 3: App.tsx settings 路由追加**

```tsx
<Route path="system" element={<SystemSettingsPage />} />
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): add admin system settings page"
```

---

### Task 16: ModelSettingsPage 迁移 + test-email API

**Files:**
- Modify: `apps/web/src/features/settings/ModelSettingsPage.tsx`
- Modify: `apps/api/src/routes/settings.ts`

- [ ] **Step 1: settings.ts 追加 test-email**

```typescript
app.post("/api/settings/system/test-email", { preHandler: requireAdmin }, async (request, reply) => {
  const runtime = await ctx.getRuntimeConfig();
  if (!runtime.passwordResetEnabled && !runtime.smtp.host) {
    return reply.status(400).send({ code: "E1004", message: "SMTP not configured" });
  }
  const mailer = createMailer(runtime.smtp);
  await mailer.send({
    to: request.auth!.email,
    subject: "RX-Workflow SMTP 测试",
    text: "这是一封测试邮件，说明 SMTP 配置正确。",
  });
  return { ok: true };
});
```

- [ ] **Step 2: ModelSettingsPage 移除 localStorage，改读 api.settings.getSystem / updateSystem 的 ollama 字段**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: migrate model settings to server and add SMTP test email"
```

---

## Phase 7：收尾

### Task 17: 根 package predev 与 spec 状态

**Files:**
- Modify: `package.json`（predev 增加 `@rxwf/system-settings build`）
- Modify: `docs/superpowers/specs/2026-05-23-login-password-reset-design.md`（状态 → Has plan）

- [ ] **Step 1: 更新 predev build 链**

- [ ] **Step 2: 全量测试**

Run: `pnpm --filter @rxwf/system-settings test && pnpm --filter @rxwf/identity test && pnpm --filter @rxwf/api test`
Expected: ALL PASS

- [ ] **Step 3: Commit plan + spec status**

```bash
git add docs/superpowers/plans/2026-05-23-login-password-reset.md docs/superpowers/specs/2026-05-23-login-password-reset-design.md package.json
git commit -m "docs(plan): login UI and password reset implementation plan"
```

---

## Spec 覆盖自检

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 登录页品牌占位 | Task 13–14 |
| 标题居中、去 hint、按钮自适应 | Task 14 |
| 忘记密码链接（按钮下居中、条件显示） | Task 10, 14 |
| system_settings + 加密 | Task 1, 3 |
| config 分层 | Task 6 |
| /settings/system admin 页 | Task 8, 15 |
| runtime config 消费方迁移 | Task 7, 11 |
| forgot/reset 多页流程 | Task 10, 13 |
| password_reset_tokens | Task 1, 9 |
| 安全（防枚举、rate limit、session 清除） | Task 9, 10 |
| ModelSettings 去 localStorage | Task 16 |
| nodemailer | Task 5, 10, 16 |
