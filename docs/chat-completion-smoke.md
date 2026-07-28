# Chat 功能冒烟清单

在 `featurePlus` 开启且（RAG 场景）Ollama/嵌入可用时，按下列步骤验证 Chat、Bot 与 RAG。

## 前置

- [ ] API 与 Web 已启动（`pnpm dev` 或等价命令）
- [ ] 已登录管理员，至少配置一个 **chat** 用途模型
- [ ] Plus 功能已启用（`RXWF_FEATURE_PLUS=1` 或配置等价项）

## 1. 站内对话（`/chat`）

- [ ] 打开 **对话**，侧栏可 **新对话**、重命名、删除
- [ ] 发送消息后流式显示助手回复，光标闪烁正常
- [ ] 切换 **模型** 下拉，会话 `modelId` 持久化
- [ ] **普通对话** / **知识库问答** 模式可切换
- [ ] RAG：选择知识库、模板、回退选项后提问，有命中时助手消息下方显示 **参考资料** 卡片
- [ ] 助手消息 **有帮助 / 无帮助** 反馈可点击，刷新后状态保留
- [ ] 助手消息 **重新生成** 会截断该条及之后消息并流式输出新回复

## 2. 工作流编辑器助手

- [ ] 打开工作流编辑页，工具栏 **助手** 展开 360px 侧栏
- [ ] 发送消息、流式回复；关闭后再次打开仍关联同一会话（localStorage）

## 3. Chat Bots（`/chat/bots`）

- [ ] 创建 Bot，编辑草稿（系统提示、开场白、主题、模式、RAG 模板）
- [ ] **自然语言生成配置** 可更新草稿（不自动发布）
- [ ] **发布** 页：发布/取消发布、启用 embed/api/mcp 渠道
- [ ] 发布历史有记录；可生成 API Key（仅显示一次）
- [ ] Embed：`/embed/:slug` 可对话；iframe 片段可复制
- [ ] Embed 支持 `?lang=en` 或 `awf.locale` 切换界面文案（发送/停止/占位符等）

## 4. 对外 API / MCP

- [ ] `POST /api/public/chat/bots/:slug/chat`，Header `Authorization: Bearer <key>`
- [ ] MCP 工具 `chat_bot_run`，参数 `{ botSlug, message }` 返回回复

## 5. Standard（PostgreSQL）可选

- [ ] `RXWF_STORAGE_PROFILE=standard` 且 PG 已迁移 chat 表
- [ ] 创建会话、消息、Bot 草稿/发布在 PG 中可查
- [ ] `pnpm --filter @rxwf/providers-standard test` 中 chat 仓储测试通过

## 6. 自动化（CI 本地）

```bash
pnpm --filter @rxwf/api test -- src/integration/chat-bots.integration.test.ts
pnpm --filter @rxwf/api test -- src/integration/chat-rag.integration.test.ts
pnpm --filter @rxwf/api test -- src/integration/chat-rag-citations.integration.test.ts
pnpm --filter @rxwf/api test -- src/integration/chat-regenerate.integration.test.ts
pnpm lint:ac-mapping
```

- [ ] AC-41（Bot 三渠道）集成测试通过
- [ ] RAG fallback 与 citations（AC-19）集成测试通过

## 7. i18n

- [ ] 设置语言为 `en` 时，Chat / Bot / 侧栏文案为英文（`packages/i18n-catalog` + 页面 fallback）
