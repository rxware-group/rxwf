# 系统设置

在 **设置 → 系统**（`/settings/system`）中配置站点级参数。**仅 Admin** 可访问。

## 站点

| 字段 | 说明 |
|------|------|
| **Public URL** | 平台对外访问地址，用于 Webhook、MCP、Runner 注册、邮件链接等 |
| **产品名称** | 浏览器标题与品牌展示 |
| **Logo URL** | 可选，站点 Logo 图片地址 |

Public URL 错误会导致 Webhook 测试 URL、MCP Token 端点、Setup 检查项失败。

## 邮件 (SMTP)

配置发信服务器后可用于用户邀请、密码重置等：

- Host、Port、TLS
- 用户名、密码（密码留空或 `***` 表示不修改已有值）
- From 地址

点击 **发送测试邮件** 验证配置。若未启用密码重置功能，页面会提示 SMTP 用途。

## 集成

| 字段 | 说明 |
|------|------|
| **Webhook Secret** | 全局 Webhook HMAC 签名密钥；留空不修改已有值 |

用于 [Webhook 节点](/help/nodes/webhookTrigger) 生产 URL 的签名校验。

## 保存

修改后点击 **保存**；密钥类字段仅在输入新值时更新。

## 相关页面

- [Setup](/help/settings/setup) — 初始化检查清单
- [Runners](/help/settings/runners) — 依赖 Public URL
- [MCP Token](/help/settings/mcp-tokens) — MCP 端点 URL
