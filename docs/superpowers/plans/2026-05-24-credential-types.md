# 凭据类型注册表（Phase B）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可扩展的 Credential Type Registry，注册 4 种通用凭据类型，HTTP 节点支持 `credentialId` 自动注入认证头，凭据管理 UI 由 schema 驱动。

**Architecture:** 在 `packages/credential` 中实现 registry + `applyAuth` + `validateCredentialData`；API 暴露 `/api/credentials/types`；HTTP executor 通过 `resolveCredentialForAuth` 解析 `{ type, data }` 后 merge headers；前端 CredentialsPage 动态表单，CredentialSelect 支持 `acceptedTypes` 过滤。

**Tech Stack:** TypeScript、Vitest、Fastify、`@rxwf/credential`、React 19、pnpm workspace。

**设计依据:** [2026-05-24-credential-types-design.md](../specs/2026-05-24-credential-types-design.md)

**建议:** 在独立 git worktree 中实施（见 superpowers:using-git-worktrees）。

---

## 文件结构总览

| 路径 | 职责 |
|------|------|
| `packages/credential/src/types/field-schema.ts` | `CredentialFieldSchema` 类型 |
| `packages/credential/src/types/registry.ts` | 注册表 CRUD + `validateCredentialData` |
| `packages/credential/src/types/generic/*.ts` | 4 种通用类型定义 |
| `packages/credential/src/types/register-generic-types.ts` | 启动时注册 generic types |
| `packages/credential/src/apply-auth.ts` | `applyAuth(typeId, data)` 统一入口 |
| `packages/credential/src/types/registry.test.ts` | registry 单元测试 |
| `packages/credential/src/apply-auth.test.ts` | applyAuth 单元测试 |
| `packages/credential/src/credential-service.ts` | 增加 validate + resolveForAuth + test 增强 |
| `packages/credential/src/credential-service.test.ts` | 更新/新增测试 |
| `packages/credential/src/index.ts` | 导出新 API |
| `apps/api/src/routes/credentials.ts` | 新增 GET `/types`，create 校验 |
| `apps/api/src/routes/credentials.test.ts` | 集成测试扩展 |
| `apps/api/src/credentials/create-credential-resolver.ts` | 可选：AI resolver 读 accessToken |
| `packages/node-runner/package.json` | 添加 `@rxwf/credential` 依赖 |
| `packages/node-runner/src/executors/http.ts` | 工厂化 + credential 注入 |
| `packages/node-runner/src/executors/http.test.ts` | credential 注入测试 |
| `packages/node-runner/src/executors/register-builtin.ts` | 传入 `resolveCredentialForAuth` |
| `packages/node-runner/src/types/node-executor.ts` | （无需改，凭据走 executor deps） |
| `apps/api/src/execution/create-execution-runtime.ts` | builtinDeps 注入 resolve |
| `apps/web/src/api/client.ts` | `credentials.listTypes()` |
| `apps/web/src/features/settings/CredentialsPage.tsx` | schema 驱动动态表单 |
| `apps/web/src/features/editor/CredentialSelect.tsx` | `acceptedTypes` 过滤 |
| `apps/web/src/features/editor/NodeEditorParamsPane.tsx` | HTTP 节点 CredentialSelect |
| `apps/web/src/features/editor/node-param-schemas.ts` | aiChatModel credentialId 标注（可选） |

---

## Task 1: 字段 Schema 与 Registry 核心

**Files:**
- Create: `packages/credential/src/types/field-schema.ts`
- Create: `packages/credential/src/types/registry.ts`
- Create: `packages/credential/src/types/registry.test.ts`
- Modify: `packages/credential/src/index.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/credential/src/types/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerCredentialType,
  getCredentialType,
  listCredentialTypes,
  validateCredentialData,
  clearCredentialTypesForTest,
} from './registry.js';

beforeEach(() => {
  clearCredentialTypesForTest();
});

describe('credential type registry', () => {
  it('registers and lists types', () => {
    registerCredentialType({
      id: 'testType',
      displayName: 'Test',
      fields: [{ key: 'token', label: 'Token', type: 'secret', required: true }],
      applyAuth: (data) => ({ Authorization: String(data.token) }),
    });
    expect(getCredentialType('testType')?.displayName).toBe('Test');
    expect(listCredentialTypes()).toHaveLength(1);
  });

  it('validateCredentialData rejects missing required field', () => {
    registerCredentialType({
      id: 'testType',
      displayName: 'Test',
      fields: [{ key: 'token', label: 'Token', type: 'secret', required: true }],
      applyAuth: () => ({}),
    });
    expect(() => validateCredentialData('testType', {})).toThrow(/token/);
  });

  it('validateCredentialData rejects unknown type', () => {
    expect(() => validateCredentialData('unknown', { x: 1 })).toThrow(/unknown/i);
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/credential test -- registry`  
Expected: FAIL — module `./registry.js` not found

- [ ] **Step 3: 实现 field-schema 与 registry**

```typescript
// packages/credential/src/types/field-schema.ts
export interface CredentialFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

export interface CredentialTypeDefinition {
  id: string;
  displayName: string;
  description?: string;
  fields: CredentialFieldSchema[];
  applyAuth: (data: Record<string, unknown>) => Record<string, string>;
  testConnection?: (
    data: Record<string, unknown>,
  ) => Promise<{ ok: boolean; message?: string }>;
}

/** UI/API 序列化用（不含函数） */
export interface CredentialTypeSummary {
  id: string;
  displayName: string;
  description?: string;
  fields: CredentialFieldSchema[];
}
```

```typescript
// packages/credential/src/types/registry.ts
import { AwfError } from '@rxwf/shared';
import type {
  CredentialTypeDefinition,
  CredentialTypeSummary,
} from './field-schema.js';

const types = new Map<string, CredentialTypeDefinition>();

export function registerCredentialType(def: CredentialTypeDefinition): void {
  types.set(def.id, def);
}

export function getCredentialType(id: string): CredentialTypeDefinition | undefined {
  return types.get(id);
}

export function listCredentialTypes(): CredentialTypeDefinition[] {
  return [...types.values()];
}

export function listCredentialTypeSummaries(): CredentialTypeSummary[] {
  return listCredentialTypes().map(({ id, displayName, description, fields }) => ({
    id,
    displayName,
    description,
    fields,
  }));
}

export function validateCredentialData(
  typeId: string,
  data: Record<string, unknown>,
): void {
  const def = types.get(typeId);
  if (!def) {
    throw new AwfError('E1001', `Unknown credential type: ${typeId}`);
  }
  for (const field of def.fields) {
    if (!field.required) continue;
    const value = data[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      throw new AwfError('E1001', `Missing required field: ${field.key}`);
    }
  }
}

/** 仅测试用 */
export function clearCredentialTypesForTest(): void {
  types.clear();
}
```

```typescript
// packages/credential/src/index.ts — 追加导出
export type {
  CredentialFieldSchema,
  CredentialTypeDefinition,
  CredentialTypeSummary,
} from './types/field-schema.js';
export {
  registerCredentialType,
  getCredentialType,
  listCredentialTypes,
  listCredentialTypeSummaries,
  validateCredentialData,
} from './types/registry.js';
```

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/credential test -- registry`  
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/credential/src/types/field-schema.ts packages/credential/src/types/registry.ts packages/credential/src/types/registry.test.ts packages/credential/src/index.ts
git commit -m "feat(credential): add credential type registry"
```

---

## Task 2: 四种 Generic 类型 + applyAuth

**Files:**
- Create: `packages/credential/src/types/generic/api-key.ts`
- Create: `packages/credential/src/types/generic/http-header-auth.ts`
- Create: `packages/credential/src/types/generic/basic-auth.ts`
- Create: `packages/credential/src/types/generic/oauth2-manual.ts`
- Create: `packages/credential/src/types/register-generic-types.ts`
- Create: `packages/credential/src/apply-auth.ts`
- Create: `packages/credential/src/apply-auth.test.ts`
- Modify: `packages/credential/src/index.ts`

- [ ] **Step 1: 写 applyAuth 失败测试**

```typescript
// packages/credential/src/apply-auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { applyAuth } from './apply-auth.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

beforeAll(() => {
  registerGenericCredentialTypes();
});

describe('applyAuth', () => {
  it('apiKey with Bearer prefix', () => {
    const headers = applyAuth('apiKey', {
      apiKey: 'sk-test',
      headerName: 'Authorization',
      prefix: 'Bearer',
    });
    expect(headers).toEqual({ Authorization: 'Bearer sk-test' });
  });

  it('basicAuth base64 encodes username:password', () => {
    const headers = applyAuth('basicAuth', { username: 'u', password: 'p' });
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    );
  });

  it('httpHeaderAuth legacy { header } compat', () => {
    const headers = applyAuth('httpHeaderAuth', { header: 'Bearer legacy' });
    expect(headers.Authorization).toBe('Bearer legacy');
  });

  it('oauth2Manual uses tokenType prefix', () => {
    const headers = applyAuth('oauth2Manual', {
      accessToken: 'tok',
      tokenType: 'Bearer',
    });
    expect(headers.Authorization).toBe('Bearer tok');
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/credential test -- apply-auth`  
Expected: FAIL

- [ ] **Step 3: 实现 generic types 与 applyAuth**

```typescript
// packages/credential/src/types/generic/api-key.ts
import type { CredentialTypeDefinition } from '../field-schema.js';

export const apiKeyCredentialType: CredentialTypeDefinition = {
  id: 'apiKey',
  displayName: 'API Key',
  description: 'API key in a configurable HTTP header',
  fields: [
    { key: 'apiKey', label: 'API Key', type: 'secret', required: true },
    {
      key: 'headerName',
      label: 'Header Name',
      type: 'text',
      defaultValue: 'Authorization',
    },
    { key: 'prefix', label: 'Prefix', type: 'text', defaultValue: 'Bearer' },
  ],
  applyAuth(data) {
    const headerName = String(data.headerName ?? 'Authorization');
    const prefix = String(data.prefix ?? 'Bearer').trim();
    const apiKey = String(data.apiKey ?? '');
    const value = prefix ? `${prefix} ${apiKey}` : apiKey;
    return { [headerName]: value };
  },
};
```

```typescript
// packages/credential/src/types/generic/http-header-auth.ts
import type { CredentialTypeDefinition } from '../field-schema.js';

export const httpHeaderAuthCredentialType: CredentialTypeDefinition = {
  id: 'httpHeaderAuth',
  displayName: 'Custom Header',
  fields: [
    { key: 'name', label: 'Header Name', type: 'text', required: true },
    { key: 'value', label: 'Header Value', type: 'secret', required: true },
  ],
  applyAuth(data) {
    // Legacy: { header: "Bearer xxx" } → Authorization
    if (data.header !== undefined && data.name === undefined) {
      return { Authorization: String(data.header) };
    }
    return { [String(data.name)]: String(data.value) };
  },
};
```

```typescript
// packages/credential/src/types/generic/basic-auth.ts
import type { CredentialTypeDefinition } from '../field-schema.js';

export const basicAuthCredentialType: CredentialTypeDefinition = {
  id: 'basicAuth',
  displayName: 'Username / Password',
  fields: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'secret', required: true },
  ],
  applyAuth(data) {
    const encoded = Buffer.from(
      `${String(data.username)}:${String(data.password)}`,
    ).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  },
};
```

```typescript
// packages/credential/src/types/generic/oauth2-manual.ts
import type { CredentialTypeDefinition } from '../field-schema.js';

export const oauth2ManualCredentialType: CredentialTypeDefinition = {
  id: 'oauth2Manual',
  displayName: 'OAuth2 (Manual Token)',
  description: 'Paste access token manually; no OAuth redirect flow',
  fields: [
    { key: 'accessToken', label: 'Access Token', type: 'secret', required: true },
    { key: 'refreshToken', label: 'Refresh Token', type: 'secret' },
    { key: 'tokenType', label: 'Token Type', type: 'text', defaultValue: 'Bearer' },
  ],
  applyAuth(data) {
    const tokenType = String(data.tokenType ?? 'Bearer').trim();
    const accessToken = String(data.accessToken ?? '');
    return { Authorization: `${tokenType} ${accessToken}`.trim() };
  },
};
```

```typescript
// packages/credential/src/types/register-generic-types.ts
import { registerCredentialType } from './registry.js';
import { apiKeyCredentialType } from './generic/api-key.js';
import { httpHeaderAuthCredentialType } from './generic/http-header-auth.js';
import { basicAuthCredentialType } from './generic/basic-auth.js';
import { oauth2ManualCredentialType } from './generic/oauth2-manual.js';

let registered = false;

export function registerGenericCredentialTypes(): void {
  if (registered) return;
  registerCredentialType(apiKeyCredentialType);
  registerCredentialType(httpHeaderAuthCredentialType);
  registerCredentialType(basicAuthCredentialType);
  registerCredentialType(oauth2ManualCredentialType);
  registered = true;
}
```

```typescript
// packages/credential/src/apply-auth.ts
import { AwfError } from '@rxwf/shared';
import { getCredentialType } from './types/registry.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

registerGenericCredentialTypes();

export function applyAuth(
  typeId: string,
  data: Record<string, unknown>,
): Record<string, string> {
  const def = getCredentialType(typeId);
  if (!def) {
    throw new AwfError('E1001', `Unknown credential type: ${typeId}`);
  }
  return def.applyAuth(data);
}
```

```typescript
// packages/credential/src/index.ts — 追加
export { applyAuth } from './apply-auth.js';
export { registerGenericCredentialTypes } from './types/register-generic-types.js';
```

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/credential test -- apply-auth`  
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/credential/src/types/generic packages/credential/src/types/register-generic-types.ts packages/credential/src/apply-auth.ts packages/credential/src/apply-auth.test.ts packages/credential/src/index.ts
git commit -m "feat(credential): register generic auth types and applyAuth"
```

---

## Task 3: CredentialService 校验与 resolveForAuth

**Files:**
- Modify: `packages/credential/src/credential-service.ts`
- Modify: `packages/credential/src/credential-service.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/credential/src/credential-service.test.ts — 追加 describe 块
import { validateCredentialData } from './types/registry.js';
import { registerGenericCredentialTypes } from './types/register-generic-types.js';

beforeAll(() => {
  registerGenericCredentialTypes();
});

describe('credential validation on create', () => {
  it('rejects apiKey without apiKey field', async () => {
  // ... 使用现有 in-memory store 模式创建 service
    await expect(
      service.create({ name: 'x', type: 'apiKey', data: {} }),
    ).rejects.toThrow(/apiKey/);
  });
});

describe('resolveForAuth', () => {
  it('returns type and decrypted data', async () => {
    const created = await service.create({
      name: 'k',
      type: 'apiKey',
      data: { apiKey: 'secret', headerName: 'Authorization', prefix: 'Bearer' },
    });
    const resolved = await service.resolveForAuth(created.id);
    expect(resolved.type).toBe('apiKey');
    expect(resolved.data.apiKey).toBe('secret');
  });
});

describe('test with validation', () => {
  it('returns ok false when required fields missing after decrypt', async () => {
    // store row with type apiKey but empty data — expect { ok: false }
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/credential test -- credential-service`  
Expected: FAIL — `resolveForAuth` not defined

- [ ] **Step 3: 实现 service 增强**

在 `create()` 开头调用 `validateCredentialData(input.type, input.data)`。

新增方法：

```typescript
async resolveForAuth(id: string): Promise<{ type: string; data: Record<string, unknown> }> {
  const row = await deps.findById(id);
  if (!row) throw new AwfError('E1001', `Credential not found: ${id}`);
  const plain = decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey);
  return { type: row.type, data: JSON.parse(plain) as Record<string, unknown> };
},

async test(id: string): Promise<{ ok: boolean; message?: string }> {
  const row = await deps.findById(id);
  if (!row) throw new AwfError('E1001', `Credential not found: ${id}`);
  try {
    validateCredentialData(row.type, JSON.parse(
      decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey),
    ) as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed';
    return { ok: false, message };
  }
  const def = getCredentialType(row.type);
  if (def?.testConnection) {
    const data = JSON.parse(
      decryptCredentialPayload(row.dataEncrypted, deps.encryptionKey),
    ) as Record<string, unknown>;
    return def.testConnection(data);
  }
  return { ok: true };
},
```

顶部 import：`validateCredentialData`, `getCredentialType` from registry；确保 `registerGenericCredentialTypes()` 在 service 模块加载时已执行（通过 import `./apply-auth.js` side effect 或显式 import register）。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/credential test`  
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/credential/src/credential-service.ts packages/credential/src/credential-service.test.ts
git commit -m "feat(credential): validate on create and resolveForAuth"
```

---

## Task 4: API 路由 — `/types` 与 create 校验

**Files:**
- Modify: `apps/api/src/routes/credentials.ts`
- Modify: `apps/api/src/routes/credentials.test.ts`

- [ ] **Step 1: 写失败集成测试**

```typescript
// apps/api/src/routes/credentials.test.ts — 追加
it('GET /api/credentials/types returns 4 generic types', async () => {
  // ... setup db + apiKey 同现有 beforeEach 模式
  const res = await app.inject({
    method: 'GET',
    url: '/api/credentials/types',
    headers: { 'x-api-key': key },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json() as { types: Array<{ id: string }> };
  expect(body.types.map((t) => t.id).sort()).toEqual(
    ['apiKey', 'basicAuth', 'httpHeaderAuth', 'oauth2Manual'].sort(),
  );
});

it('POST rejects unknown credential type', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/credentials',
    headers: { 'x-api-key': key },
    payload: { name: 'x', type: 'unknownType', data: { a: 1 } },
  });
  expect(res.statusCode).toBe(400);
});

it('POST rejects apiKey missing required field', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/credentials',
    headers: { 'x-api-key': key },
    payload: { name: 'x', type: 'apiKey', data: {} },
  });
  expect(res.statusCode).toBe(400);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/api test -- credentials.test`  
Expected: FAIL — 404 on `/types`

- [ ] **Step 3: 实现路由**

```typescript
// apps/api/src/routes/credentials.ts
import { listCredentialTypeSummaries } from '@rxwf/credential';

app.get(
  '/api/credentials/types',
  { preHandler: authPreHandler },
  async () => ({ types: listCredentialTypeSummaries() }),
);

// POST handler 内，在 service.create 前：
// AwfError from validate 会被 service.create 抛出 — 在 catch 中：
// if (err instanceof AwfError) return reply.status(400).send({ code: err.code, message: err.message });
```

确保 `apps/api/package.json` 已依赖 `@rxwf/credential`（已有）。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/api test -- credentials.test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/credentials.ts apps/api/src/routes/credentials.test.ts
git commit -m "feat(api): credential types endpoint and validation"
```

---

## Task 5: HTTP Executor 凭据注入

**Files:**
- Modify: `packages/node-runner/package.json`
- Modify: `packages/node-runner/src/executors/http.ts`
- Modify: `packages/node-runner/src/executors/http.test.ts`
- Modify: `packages/node-runner/src/executors/register-builtin.ts`
- Modify: `apps/api/src/execution/create-execution-runtime.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// packages/node-runner/src/executors/http.test.ts — 追加
import { createHttpRequestExecutor } from './http.js';

it('merges credential auth headers before manual headers override', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ headers: init?.headers }),
    })),
  );

  const executor = createHttpRequestExecutor({
    resolveCredentialForAuth: async () => ({
      type: 'apiKey',
      data: { apiKey: 'sk-test', prefix: 'Bearer' },
    }),
  });

  await executor.execute({
    config: {
      url: 'https://example.com',
      method: 'GET',
      credentialId: 'cred-1',
      headers: { Authorization: 'Bearer override' },
    },
    inputItems: [{ json: {} }],
  });

  expect(fetch).toHaveBeenCalledWith(
    'https://example.com',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer override' }),
    }),
  );
});

it('injects Authorization when no manual header override', async () => {
  // credential only → expect Authorization: Bearer sk-test
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @rxwf/node-runner test -- http.test`  
Expected: FAIL — `createHttpRequestExecutor` not exported

- [ ] **Step 3: 实现 HTTP executor 工厂**

```typescript
// packages/node-runner/package.json dependencies 追加:
// "@rxwf/credential": "workspace:*"

// packages/node-runner/src/executors/http.ts
import { applyAuth } from '@rxwf/credential';
import type { NodeExecutor } from '../types/node-executor.js';
import { executeHttpRequest } from '../http-request.js';

export interface HttpRequestExecutorDeps {
  resolveCredentialForAuth?: (
    credentialId: string,
  ) => Promise<{ type: string; data: Record<string, unknown> }>;
}

export function createHttpRequestExecutor(
  deps: HttpRequestExecutorDeps = {},
): NodeExecutor {
  return {
    type: 'httpRequest',
    async execute(ctx) {
      const output: { json: Record<string, unknown> }[] = [];
      let authHeaders: Record<string, string> = {};
      const credentialId = String(ctx.config.credentialId ?? '').trim();
      if (credentialId && deps.resolveCredentialForAuth) {
        const { type, data } = await deps.resolveCredentialForAuth(credentialId);
        authHeaders = applyAuth(type, data);
      }

      for (const item of ctx.inputItems) {
        const manualHeaders =
          ctx.config.headers && typeof ctx.config.headers === 'object'
            ? (ctx.config.headers as Record<string, unknown>)
            : undefined;
        const mergedHeaders = { ...authHeaders, ...manualHeaders };
        const { statusCode, body, requestUrl } = await executeHttpRequest(
          {
            method: String(ctx.config.method ?? 'GET'),
            url: String(ctx.config.url ?? ''),
            headers: mergedHeaders,
            body: ctx.config.body !== undefined ? String(ctx.config.body) : undefined,
          },
          item.json,
          ctx.env,
          ctx.namedNodes,
          ctx.vars,
        );
        // ... 现有 success/fail 逻辑不变
      }
    },
  };
}

/** 默认 executor（无凭据解析，保持测试兼容） */
export const httpRequestExecutor = createHttpRequestExecutor();
```

```typescript
// packages/node-runner/src/executors/register-builtin.ts
export interface BuiltinExecutorDeps {
  subworkflow?: SubworkflowExecutorDeps;
  resolveCredentialForAuth?: HttpRequestExecutorDeps['resolveCredentialForAuth'];
}

export function registerBuiltinExecutors(registry, deps = {}) {
  const executors: NodeExecutor[] = [
    createHttpRequestExecutor({
      resolveCredentialForAuth: deps.resolveCredentialForAuth,
    }),
    // ... 其余不变
  ];
}
```

```typescript
// apps/api/src/execution/create-execution-runtime.ts
const facade = createNodeRunnerFacade({
  runnerRepository,
  builtinDeps: {
    subworkflow: { runChild: runSubworkflowChild },
    resolveCredentialForAuth: input.runtimeOptions.credentialService
      ? (id) => input.runtimeOptions.credentialService!.resolveForAuth(id)
      : undefined,
  },
  plusDeps,
});
```

**注意：** 需在 `CreateExecutionRuntimeOptions` 增加 `credentialService?: ReturnType<typeof createCredentialService>`，在 `app-context.ts` / `bootstrap.ts` 传入已创建的 service 实例（与现有 `credentialResolver` 同源）。

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `pnpm --filter @rxwf/node-runner test -- http.test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/node-runner/package.json packages/node-runner/src/executors/http.ts packages/node-runner/src/executors/http.test.ts packages/node-runner/src/executors/register-builtin.ts apps/api/src/execution/create-execution-runtime.ts apps/api/src/app-context.ts apps/api/src/bootstrap.ts
git commit -m "feat(node-runner): inject credential auth headers in HTTP executor"
```

---

## Task 6: Web — API Client + CredentialsPage 动态表单

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/features/settings/CredentialsPage.tsx`

- [ ] **Step 1: 扩展 API client**

```typescript
// apps/web/src/api/client.ts — credentials 块
credentials: {
  listTypes: () =>
    apiFetch<{
      types: Array<{
        id: string;
        displayName: string;
        description?: string;
        fields: Array<{
          key: string;
          label: string;
          type: 'text' | 'secret' | 'select';
          required?: boolean;
          placeholder?: string;
          options?: string[];
          defaultValue?: string;
        }>;
      }>;
    }>('/api/credentials/types'),
  // list, create, test, remove 保持不变
},
```

- [ ] **Step 2: 重写 CredentialsPage 动态表单**

核心逻辑：

```typescript
const [types, setTypes] = useState<CredentialTypeSummary[]>([]);
const [type, setType] = useState('apiKey');
const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

useEffect(() => {
  void api.credentials.listTypes().then((r) => setTypes(r.types));
}, []);

useEffect(() => {
  const def = types.find((t) => t.id === type);
  const next: Record<string, string> = {};
  for (const f of def?.fields ?? []) {
    next[f.key] = fieldValues[f.key] ?? f.defaultValue ?? '';
  }
  setFieldValues(next);
}, [type, types]);

const create = async () => {
  const def = types.find((t) => t.id === type);
  for (const f of def?.fields ?? []) {
    if (f.required && !fieldValues[f.key]?.trim()) {
      setToast({ message: `${f.label} is required` });
      return;
    }
  }
  await api.credentials.create({ name, type, data: fieldValues });
};
```

列表类型列：`types.find(t => t.id === c.type)?.displayName ?? c.type`

- [ ] **Step 3: 本地 smoke 验证**

Run: `pnpm --filter @rxwf/web dev`（或已有 dev 进程）  
手动：设置 → 凭据 → 切换类型 → 创建 apiKey → 列表显示「API Key」

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/features/settings/CredentialsPage.tsx
git commit -m "feat(web): schema-driven credentials page"
```

---

## Task 7: CredentialSelect 过滤 + HTTP 节点编辑器

**Files:**
- Modify: `apps/web/src/features/editor/CredentialSelect.tsx`
- Modify: `apps/web/src/features/editor/NodeEditorParamsPane.tsx`
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`（httpRequest 无需 schema 字段，凭据走专用块）
- Modify: `packages/ai-runtime/src/langchain-runtime.ts`（oauth2Manual 读 accessToken）
- Modify: `apps/api/src/credentials/create-credential-resolver.ts`

- [ ] **Step 1: CredentialSelect 增加 acceptedTypes**

```typescript
export function CredentialSelect({
  value,
  onChange,
  acceptedTypes,
}: {
  value: string;
  onChange: (credentialId: string) => void;
  acceptedTypes?: string[];
}) {
  const filtered = acceptedTypes?.length
    ? options.filter((c) => acceptedTypes.includes(c.type))
    : options;
  // render filtered
}
```

- [ ] **Step 2: NodeEditorParamsPane 增加 HTTP 与 AI 过滤**

```typescript
{node.type === 'httpRequest' && (
  <CredentialSelect
    value={String(node.parameters.credentialId ?? '')}
    onChange={(credentialId) => updateParameters({ ...node.parameters, credentialId })}
    acceptedTypes={['apiKey', 'httpHeaderAuth', 'basicAuth', 'oauth2Manual']}
  />
)}

// aiChatModel 现有块追加:
acceptedTypes={['apiKey', 'oauth2Manual']}

// crewSupervisor 现有块追加:
acceptedTypes={['apiKey', 'oauth2Manual']}
```

- [ ] **Step 3: AI resolver 支持 oauth2Manual accessToken**

```typescript
// apps/api/src/credentials/create-credential-resolver.ts
const apiKey =
  (typeof data.apiKey === 'string' && data.apiKey) ||
  (typeof data.accessToken === 'string' && data.accessToken) ||
  (typeof data.token === 'string' && data.token) ||
  '';
if (apiKey) out.apiKey = apiKey;
```

- [ ] **Step 4: 运行相关测试**

Run: `pnpm --filter @rxwf/api test -- credentials.test`  
Run: `pnpm --filter @rxwf/credential test`  
Run: `pnpm --filter @rxwf/node-runner test -- http.test`  
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/CredentialSelect.tsx apps/web/src/features/editor/NodeEditorParamsPane.tsx apps/api/src/credentials/create-credential-resolver.ts packages/ai-runtime/src/langchain-runtime.ts
git commit -m "feat(web): credential select filtering and HTTP node binding"
```

---

## Spec 覆盖自检

| Spec 要求 | 对应 Task |
|-----------|-----------|
| Credential Type Registry | Task 1 |
| 4 种 generic types | Task 2 |
| applyAuth + legacy httpHeaderAuth | Task 2 |
| validateCredentialData on create | Task 3 |
| resolveForAuth | Task 3 |
| test 增强 | Task 3 |
| GET /api/credentials/types | Task 4 |
| POST 校验 400 | Task 4 |
| HTTP credentialId 注入 | Task 5 |
| 手动 headers 优先级更高 | Task 5 测试 |
| CredentialsPage 动态表单 | Task 6 |
| CredentialSelect acceptedTypes | Task 7 |
| AI oauth2Manual 支持 | Task 7 |
| oauth2Manual 无 OAuth 流程 | 不实现（符合非目标） |
| 凭据编辑 | 不实现（符合非目标） |

## 手动验证清单

- [ ] 设置 → 凭据：4 种类型均可创建
- [ ] 创建 apiKey 缺少 key 时前端/后端均拒绝
- [ ] HTTP 节点选凭据后，对需 Bearer 的 API 请求成功
- [ ] HTTP 节点手动 Authorization header 可覆盖凭据默认值
- [ ] AI Chat Model（openai-compatible）可选 apiKey / oauth2Manual 凭据
