# 插件

在 **设置 → 插件**（`/settings/plugins`）中注册与管理扩展插件，扩展平台节点或运行时能力。

## 已安装插件

列表显示插件 ID、版本、状态（启用/禁用）。可对单个插件 **启用** 或 **禁用**。

## 注册新插件

1. 准备 **Manifest JSON**（描述 `type`、`version`、`handler` 等）。
2. 若平台要求签名，填写 **Signature** 字段。
3. 点击注册；成功后出现在列表。

示例 Manifest 结构：

```json
{
  "type": "demoPlugin",
  "version": 1,
  "handler": "echo"
}
```

具体字段以服务端插件规范为准。

## 注意事项

- 仅注册受信任来源的插件。
- 禁用插件不会卸载，但相关能力不可用。
- 插件错误可能导致工作流执行异常，请在测试环境验证。

## 相关页面

- [MCP 服务器](/help/settings/mcp) — 另一种扩展集成方式
- [RxWF / Skills](/help/settings/rxwf) — Skills 与工作区扩展
