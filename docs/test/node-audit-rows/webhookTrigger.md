# AUDIT-N-webhookTrigger

> nodeType: `webhookTrigger` | category: trigger | track: standard | task: T-036

## 审查结论

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| panel | ok | `WebhookTriggerPanel`：Path、认证方式（none / apiKey / apiKeyHmac）、API Key / HMAC Secret 轮换、测试/生产 URL 与 curl 示例；监听态 banner 与鉴权错误展示 |
| validation | ok | `node-param-schemas` 为空（专用面板驱动参数）；保存时无 path 唯一性强校验，运行时由 API `findWebhookNode` 按 path 匹配；默认参数见 `node-port-defs`（`authMode: none`） |
| executor | ok | `webhookTriggerExecutor` 已在 `register-builtin.ts` 注册；空 body / 无 inputItems 输出 `[{ json: {} }]`，有 inputItems 时透传（含 binary） |
| error_codes | E1001,E2001,E2005,E2006,E2014 | HTTP 层鉴权/路径错误；见 `docs/help/zh/nodes/webhookTrigger.md` 与 `docs/error-codes.md` |
| status | ok | 面板、执行器、E2E（`apps/web/e2e/nodes/webhookTrigger.spec.ts`）验收通过 |

## 证据

- 单元测试：`packages/node-runner/src/executors/triggers/webhook.test.ts`
- E2E：`apps/web/e2e/nodes/webhookTrigger.spec.ts`（E2E-N-webhookTrigger）
- API 集成：`apps/api/src/routes/webhook.test.ts`

## 备注

- 编辑器「▶ 执行」走 `runWebhookListenDebug` 临时监听（约 5 分钟）；生产 URL 需发布后持续可用。
- 未设置 `authMode` 但存在 `hmacSecret` 的旧工作流仍按 apiKeyHmac 兼容处理（面板 `resolveAuthMode`）。
