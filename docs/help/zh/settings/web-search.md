# Web Search

在 **设置 → Web Search**（`/settings/web-search`）中配置全局 **网页搜索** Provider，供 [Tool (Web Search) 节点](/help/nodes/toolWebSearch) 与 Agent 使用。**仅 Admin** 可访问。

## Provider

| Provider | 说明 |
|----------|------|
| **Tavily** | 常用 AI 搜索 API |
| **Brave** | Brave Search API |
| **Bing** | Bing Web Search API |
| **Custom** | 自定义 HTTP 搜索端点 |

选择 Provider 后填写对应参数（如 API Key 或关联 [凭证](/help/settings/credentials) 中的 `apiKey` 类型）。

## 测试

保存前或保存后可点击 **测试搜索**，用示例查询验证连通性与返回格式。

## 在工作流中使用

- 添加 **Tool (Web Search)** 卫星到 AI Agent。
- Agent 在 ReAct 循环中自动发起搜索并引用结果。

未配置或凭证无效时，节点执行将报错。

## 相关帮助

- [Tool (Web Search) 节点](/help/nodes/toolWebSearch)
- [凭证](/help/settings/credentials)
