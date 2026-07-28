# Spacing 开发标准

与 [Typography](./typography.md) 配套。应用采用 **4px 步进紧凑间距**，与 14px 正文字号对齐。

所有 `margin` / `padding` / `gap` 应来自 `--rxwf-space-*` 或语义别名，**禁止**在 TSX 中写间距字面量（如 `marginTop: '1rem'`），特殊布局除外须注释说明。

## Design Tokens

定义于 [`apps/web/src/styles.css`](../../apps/web/src/styles.css) `:root`：

| Token | 值 | 像素 | 用途 |
|-------|-----|------|------|
| `--rxwf-space-0` | 0 | 0 | 重置 |
| `--rxwf-space-1` | 0.25rem | 4px | 图标与文字、极紧凑 |
| `--rxwf-space-2` | 0.375rem | 6px | 标签 → 控件 |
| `--rxwf-space-3` | 0.5rem | 8px | 行内控件、标题 → lead |
| `--rxwf-space-4` | 0.75rem | 12px | 描述 → 控件、列表块内 |
| `--rxwf-space-5` | 1rem | 16px | 字段栈、卡片内纵距、块与块 |
| `--rxwf-space-6` | 1.25rem | 20px | 卡片内边距 |
| `--rxwf-space-7` | 1.5rem | 24px | 页边距、大分区 |
| `--rxwf-space-8` | 2rem | 32px | 模板分区、空状态大留白 |

## 语义别名（优先使用）

| 别名 | 指向 | 场景 |
|------|------|------|
| `--rxwf-space-label-control` | space-2 | FormField 标签 → 输入 |
| `--rxwf-space-hint-control` | space-3 | 描述 / hint → 输入 |
| `--rxwf-space-inline` | space-3 | 同行按钮、chip、工具栏控件 |
| `--rxwf-space-stack` | space-5 | 字段与字段、卡片内元素纵距 |
| `--rxwf-space-block` | space-5 | 卡片与卡片、标题区 → 内容 |
| `--rxwf-space-block-pad` | space-6 | 卡片内边距 |
| `--rxwf-space-section` | space-7 | Settings 分区标题下边距等 |
| `--rxwf-space-page` | space-7 | `.main` / settings 页边距 |

### Legacy 兼容

以下变量已改为语义别名，旧代码可继续使用：

- `--rxwf-field-gap` → `--rxwf-space-label-control`
- `--rxwf-field-stack-gap` → `--rxwf-space-stack`
- `--rxwf-region-gap` → `--rxwf-space-4`
- `--rxwf-page-gutter` → `--rxwf-space-page`

## 场景映射

| 场景 | Token |
|------|-------|
| 标签 → 输入 | `--rxwf-space-label-control`（`.rxwf-form-field` gap） |
| 块描述 → 控件 | `--rxwf-space-hint-control` |
| 字段与字段 | `--rxwf-space-stack` |
| 卡片内元素 | `--rxwf-space-stack` |
| 卡片内边距 | `--rxwf-space-block-pad` |
| 卡片与卡片 | `--rxwf-space-block` |
| 页面标题区 → 内容 | `--rxwf-space-block`（`.page-header`） |
| 标题 → 页面描述 | `--rxwf-space-3` |
| 工具栏 | `--rxwf-space-inline` / `--rxwf-space-block` |
| 列表项标题行 | `--rxwf-space-inline` |
| 列表项上下 | `--rxwf-space-4` |
| 页边距 | `--rxwf-space-page` |
| 模板大分区 | `--rxwf-space-8` |

## 页面 / 表单示例

```css
.page-header {
  margin-bottom: var(--rxwf-space-block);
}

.main.page > section.card {
  padding: var(--rxwf-space-block-pad);
  gap: var(--rxwf-space-stack);
}

.rxwf-form-field {
  gap: var(--rxwf-field-gap); /* = label-control */
  margin-bottom: var(--rxwf-field-stack-gap); /* = stack */
}
```

表单一律使用 `FormField`，自动获得标签→控件与字段栈间距。

## 工具 class

| Class | 作用 |
|-------|------|
| `.rxwf-inline-group` | 横排 flex + `space-inline` gap |
| `.rxwf-actions-row` | 底部操作行（inline gap + block 上边距） |
| `.rxwf-stack` | 纵向 flex + `space-stack` gap |
| `.rxwf-mt-1` / `-inline` / `-4` / `-block` | 上边距阶梯 |
| `.rxwf-mb-inline` / `-4` / `-block` | 下边距阶梯 |
| `.rxwf-ml-inline` / `.rxwf-mr-inline` | 左/右边距 inline |
| `.rxwf-list-row` / `-lg` | 列表项下边距 |
| `.rxwf-field-hint-tight` | FormField 下紧贴说明 |

## PR 检查项

- [ ] 新间距使用 `--rxwf-space-*` 或语义别名
- [ ] 未新增 magic `0.5rem` / `1rem` 等字面量到 margin/gap/padding
- [ ] TSX 无 `style={{ marginTop: '…' }}` 一类间距字面量（特殊场景须注释）
- [ ] 卡片使用 `.main.page > section.card` 或显式 token
- [ ] 表单使用 `FormField`

## 视觉回归检查

1. 工作流 / 知识库 / Bot 列表 — 工具栏与列表项间距
2. Bot 编辑器 — 卡片内 FormField 与块间距
3. 模板库 — 分区与卡片
4. Settings — 标题、分区、表单
5. Modal — body padding 与字段栈

## 相关

- [Typography](./typography.md)
- [Loading UI](../loading-ui.md)（加载转圈、空态防闪空）
