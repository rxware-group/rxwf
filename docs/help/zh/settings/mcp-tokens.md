# MCP Token

在 **设置 → MCP Token**（`/settings/mcp-tokens`）中创建与管理 **入站 MCP API 令牌**，供外部 MCP 客户端连接本平台。

## 端点地址

平台 MCP HTTP 端点为：

```
{Public URL}/mcp
```

Public URL 来自 [系统设置](/help/settings/system)。页面顶部会显示当前配置的完整 URL。

## 创建 Token

1. 输入 Token **名称**（便于识别，如 `cursor-local`）。
2. 点击创建；**明文 Token 仅显示一次**，请立即复制。
3. 同时生成 **MCP JSON** 配置片段，可一键复制到 Cursor / Claude Desktop 等客户端。

## 吊销

在列表中对不再使用的 Token 执行 **吊销**；吊销后立即失效，已配置的客户端需更新。

## 权限

通常为 **Owner** 及以上角色可创建 MCP Token（详见 [角色与权限](/help/settings/roles)）。

## 与 MCP 服务器设置的区别

| | MCP Token（本页） | MCP 服务器 |
|--|-------------------|------------|
| 方向 | 外部 → 本平台 | 本平台 → 外部 MCP |
| 用途 | 暴露工作流/工具给 AI 客户端 | 工作流节点调用第三方 MCP |

## 相关帮助

- [MCP Client 节点](/help/nodes/mcpClient)
