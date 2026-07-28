# 主题管理（Admin）

在 **设置 → Theme (Admin)**（`/settings/admin/theme`）中为指定主题 **覆盖 CSS 设计令牌**。**仅 Admin** 可访问。

## 配置

| 字段 | 说明 |
|------|------|
| **Theme ID** | 主题标识，如 `dark`、`light` 或自定义 ID |
| **Tokens JSON** | CSS 变量名到值的映射 |

示例：

```json
{
  "--color-bg": "#0f172a",
  "--color-text": "#f8fafc"
}
```

保存后，选择该 Theme ID 的用户界面将应用自定义令牌。

## 与个人信息主题的关系

用户在 [个人资料](/help/settings/profile) 选择的深色/浅色主题对应默认 Theme ID；本页可微调或扩展令牌，实现品牌定制。

## 注意事项

- JSON 格式必须正确。
- 令牌名需与前端主题系统使用的 CSS 变量一致；错误令牌不会生效但不影响稳定性。
- 大幅修改建议在预发环境预览。

## 权限

仅 **Admin** 可访问本页。
