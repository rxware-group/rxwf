# 凭据类型注册表与通用凭据能力（Phase B）

| 字段 | 内容 |
|------|------|
| **状态** | Approved — 待实施 |
| **日期** | 2026-05-24 |
| **路线** | Phase B：通用凭据 + 注册表架构；Phase C：逐步增加服务专属类型 |

## 背景

n8n 的「Add new credential」列表按 **集成/服务 + 认证方式** 分类（400+ 项），每项是独立的 Credential Type，包含专属字段、OAuth 流程、注入规则与连接测试。

本系统当前仅支持 2 种硬编码类型（`httpHeaderAuth`、`apiKey`），凭据主要用于 AI 节点的 `openai-compatible` provider；HTTP 节点不支持凭据自动注入。设计文档 `docs/credentials-design.md` 规划了更完整能力，但尚未落地。

**决策**：采用方案 1（凭据类型注册表），先补齐通用凭据能力（Phase B），再逐步注册服务专属类型（Phase C）。

## 目标

1. 建立可扩展的 **Credential Type Registry**，为 Phase C 服务专属类型预留扩展点。
2. Phase B 注册 4 种通用凭据类型，覆盖常见 HTTP 认证场景。
3. HTTP Request 节点支持 `credentialId`，执行时自动注入认证头。
4. 凭据管理 UI 由 registry schema 驱动动态表单。
5. OAuth2 第一版采用 **手动粘贴 Token**（无回调、无自动 refresh）。

## 非目标（Phase B）

- OAuth 完整授权码流程与 token 自动刷新
- 凭据共享、权限控制、审计日志、过期提醒（见 `docs/credentials-design.md`，单独迭代）
- 400+ 服务专属凭据类型（Phase C）
- 凭据编辑（secret 不回显；B 阶段仅支持删除后重建）

---

## 架构

### 包结构

```
packages/credential/
  src/
    types/
      registry.ts              # 类型注册表 + 查询 API
      field-schema.ts          # 字段 schema 类型定义
      generic/
        api-key.ts
        http-header-auth.ts
        basic-auth.ts
        oauth2-manual.ts
    apply-auth.ts              # applyAuth(type, data) → Record<string, string> headers
    credential-service.ts      # 现有，增加 schema 校验
    index.ts                   # 导出 registry + applyAuth
```

### 核心接口

```typescript
/** 字段 schema（供 UI 渲染） */
interface CredentialFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];          // type === 'select'
  defaultValue?: string;
}

/** 凭据类型定义 */
interface CredentialTypeDefinition {
  id: string;                  // 如 'apiKey', 'anthropicApi'（Phase C）
  displayName: string;         // 如 'API Key', 'Anthropic API'
  description?: string;
  fields: CredentialFieldSchema[];
  /** 将解密后的 data 转为 HTTP headers */
  applyAuth: (data: Record<string, unknown>) => Record<string, string>;
  /** 可选：连接测试（Phase B 仅 apiKey/oauth2Manual 做字段校验 + 可选 HEAD） */
  testConnection?: (data: Record<string, unknown>) => Promise<{ ok: boolean; message?: string }>;
}

/** 注册表 */
function registerCredentialType(def: CredentialTypeDefinition): void;
function getCredentialType(id: string): CredentialTypeDefinition | undefined;
function listCredentialTypes(): CredentialTypeDefinition[];
function validateCredentialData(typeId: string, data: Record<string, unknown>): void;
```

### 数据流

```
CredentialsPage
  → POST /api/credentials { name, type, data }
  → validateCredentialData(type, data)
  → encrypt & store

HTTP / AI 节点（credentialId）
  → resolveSecret(id) → { type, data }
  → applyAuth(type, data) → headers
  → merge 到 fetch / ChatOpenAI
```

Phase C 扩展：调用 `registerCredentialType({ id: 'anthropicApi', ... })`，节点声明 `acceptedCredentialTypes`，无需改核心逻辑。

---

## Phase B 通用凭据类型

| 类型 ID | 显示名 | 字段 | 注入规则 |
|---------|--------|------|----------|
| `apiKey` | API Key | `apiKey`（secret, 必填）; `headerName`（text, 默认 `Authorization`）; `prefix`（text, 默认 `Bearer`） | `{headerName}: {prefix} {apiKey}`（prefix 为空则只输出 key） |
| `httpHeaderAuth` | 自定义 Header | `name`（text, 必填）; `value`（secret, 必填） | `{name}: {value}` |
| `basicAuth` | 用户名/密码 | `username`（text, 必填）; `password`（secret, 必填） | `Authorization: Basic base64(username:password)` |
| `oauth2Manual` | OAuth2（手动 Token） | `accessToken`（secret, 必填）; `refreshToken`（secret, 可选）; `tokenType`（text, 默认 `Bearer`） | `Authorization: {tokenType} {accessToken}` |

### oauth2Manual 明确边界

- **做**：存储 accessToken / refreshToken / tokenType，按 Bearer 格式注入 Header。
- **不做**：OAuth 回调 URL、浏览器授权跳转、refresh token 自动续期（留 Phase C）。

### 与现有类型的兼容

- 现有 `httpHeaderAuth` 存储 `{ header: "Bearer xxx" }` 需迁移或兼容读取。
- 新 schema 使用 `{ name, value }`；兼容层：`applyAuth` 若检测到旧字段 `header`，按单 Header 注入。

---

## 节点集成

### HTTP Request 节点

**参数新增**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `credentialId` | string（可选） | 关联凭据 ID |

**执行逻辑**（`packages/node-runner/src/executors/http.ts`）：

1. 若 `credentialId` 存在，通过 `credentialResolver` 解析 secret。
2. 根据凭据 `type` 调用 `applyAuth` 得到 auth headers。
3. merge 到节点配置的 headers（**节点手动 headers 优先级更高**，可覆盖凭据默认值）。
4. `credentialResolver` 需从 execution runtime 传入 HTTP executor（当前仅 AI runtime 有）。

**节点 editor**：`httpRequest` schema 增加 `credentialId`；`NodeEditorParamsPane` 对 `credentialId` 渲染 `CredentialSelect`，`acceptedTypes={['apiKey','httpHeaderAuth','basicAuth','oauth2Manual']}`。

### AI Chat Model 节点

- 保持现有逻辑：从 resolved secret 读取 `apiKey` / `token` / `accessToken`。
- `CredentialSelect` 限制为 `['apiKey', 'oauth2Manual']`。

### CredentialSelect 组件

新增 prop：

```typescript
acceptedTypes?: string[];  // 为空则显示全部
```

---

## API 变更

| 端点 | 方法 | 变更 |
|------|------|------|
| `/api/credentials/types` | GET | **新增**：返回 `{ types: [{ id, displayName, description, fields }] }`（不含 applyAuth 函数） |
| `/api/credentials` | GET | 不变 |
| `/api/credentials` | POST | 增加 `validateCredentialData` 校验；未知 type 返回 400 |
| `/api/credentials/:id` | DELETE | 不变 |
| `/api/credentials/:id/test` | POST | 增强：字段完整性校验；若 type 有 `testConnection` 则调用 |

---

## UI 改造

### CredentialsPage

1. 页面加载时 `GET /api/credentials/types` 填充类型下拉。
2. 选中类型后按 `fields` schema 动态渲染表单（secret 字段用 password input）。
3. 列表「类型」列显示 `displayName` 而非 raw id。
4. 不提供编辑入口；删除需 confirm（已有）。

### 表单字段渲染规则

| field.type | 渲染 |
|------------|------|
| `text` | `<input type="text">` |
| `secret` | `<input type="password">` |
| `select` | `<select>` with options |

必填字段在提交前客户端校验；服务端 `validateCredentialData` 二次校验。

---

## 连接测试（Phase B）

| 类型 | 测试行为 |
|------|----------|
| 全部 | 校验必填字段非空 |
| `apiKey` / `oauth2Manual` | 字段校验通过即 `{ ok: true }`（不发外部请求） |
| Phase C 服务类型 | 可实现 `testConnection` 调用真实 API |

`credential-service.test()` 改为：resolve secret → validate → 可选调用 type 的 `testConnection`。

---

## Phase C 扩展路径（预览）

```typescript
registerCredentialType({
  id: 'anthropicApi',
  displayName: 'Anthropic API',
  fields: [{ key: 'apiKey', label: 'API Key', type: 'secret', required: true }],
  applyAuth: (data) => ({ 'x-api-key': String(data.apiKey) }),
  testConnection: async (data) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': String(data.apiKey), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [] }),
    });
    return { ok: res.status !== 401, message: res.status === 401 ? 'Invalid API key' : undefined };
  },
});
```

节点 param schema 可增加 `acceptedCredentialTypes` 元数据，供 editor 过滤 CredentialSelect。

---

## 测试计划

### 单元测试

- `applyAuth` 各类型：header 格式正确性
- `validateCredentialData`：必填缺失、未知 type
- registry：`register` / `list` / `get`
- 旧 `httpHeaderAuth` 数据兼容

### 集成测试

- `POST /api/credentials` 各类型创建 + 校验失败 400
- `GET /api/credentials/types` 返回 4 种类型
- HTTP 节点执行：带 `credentialId` 时请求携带正确 Authorization header

### 手动验证

- CredentialsPage 动态表单切换类型
- HTTP 节点选凭据后对需认证 API 请求成功

---

## 实施顺序建议

1. `packages/credential` — registry + 4 种 generic types + applyAuth + validate
2. API — `/types` 端点 + create 校验 + test 增强
3. node-runner — HTTP executor credentialResolver 注入
4. execution runtime — 传递 credentialResolver 到 HTTP executor
5. web — CredentialsPage 动态表单 + CredentialSelect 过滤 + HTTP 节点 credentialId

---

## 参考

- 现有设计：`docs/credentials-design.md`
- 现有实现：`apps/web/src/features/settings/CredentialsPage.tsx`
- n8n 对比：服务专属 schema + 节点绑定 vs 本系统通用注册表 + 渐进扩展
