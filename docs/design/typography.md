# Typography 开发标准

应用主界面正文基准为 **14px**（`--rxwf-text-md`）。`html` 保持浏览器默认 16px，仅用于 rem 计算。

所有字号必须来自 CSS 变量或语义 class，**禁止**在 TSX 中写 `fontSize` 字面量（代码块 `<pre>` 等特殊场景除外，须注释说明）。

## Design Tokens

定义于 [`apps/web/src/styles.css`](../../apps/web/src/styles.css) `:root`：

| Token | 值 | 像素 (16px root) | 用途 |
|-------|-----|------------------|------|
| `--rxwf-text-xs` | 0.75rem | 12px | 徽章、状态 tag、版本号 |
| `--rxwf-text-sm` | 0.8125rem | 13px | 页面描述、块说明、列表元数据 |
| `--rxwf-text-md` | 0.875rem | 14px | 正文、按钮、输入、列表标题、块标题、导航 |
| `--rxwf-text-lg` | 1.125rem | 18px | 页面标题、弹窗标题、空状态标题 |
| `--rxwf-text-xl` | 1.25rem | 20px | 品牌/特大标题（极少用） |

字重：`--rxwf-weight-regular` (400)、`--rxwf-weight-medium` (500)、`--rxwf-weight-semibold` (600)

行高：`--rxwf-leading-tight` (1.3)、`--rxwf-leading-normal` (1.45)、`--rxwf-leading-relaxed` (1.5)

## 语义 Class 映射

| 场景 | Class | Token | 字重 |
|------|-------|-------|------|
| 页面标题 | `.rxwf-type-page-title` | lg | 600 |
| 页面描述 | `.rxwf-type-page-lead` | sm | 400, muted |
| 分区标题（模板分类、Settings 区块） | `.rxwf-type-section-title` | md | 600 |
| 块标题 / FormField 标签 | `.rxwf-type-block-title` / `.rxwf-form-field-label` | md | 500 |
| 块说明 | `.rxwf-type-block-hint` | sm | 400, muted |
| 列表项标题 | `.rxwf-type-item-title` / `.workflow-list-item-title` | md | 500 |
| 列表元数据 | `.rxwf-type-meta` / `.hint` / `.meta` | sm | 400, muted |
| 状态徽章 | `.rxwf-type-badge` / `.status-pill` | xs | 500 |
| 代码片段 / pre | `.rxwf-type-code` | sm | 400 |
| 弹窗标题 | `.rxwf-modal-title` | lg | 600 |
| 表单控件 | `.rxwf-form-field-control` 内 input/textarea/select | md | 400 |
| 按钮 / 分段控件 | `button`, `.segmented`, `a.btn-*` | md | 400/500 |

带返回箭头的页面标题：`.page-title-with-back.rxwf-type-page-title`

## 页面壳模板

```tsx
<main className="main page">
  <header className="page-header">
    <h1 className="rxwf-type-page-title">工作流</h1>
    <p className="rxwf-type-page-lead">可选描述</p>
  </header>
  {/* 工具栏、列表、卡片… */}
</main>
```

带返回：

```tsx
<h1 className="page-title-with-back rxwf-type-page-title">
  <Link to="/back" className="page-back-link" aria-label="返回">…</Link>
  标题
</h1>
```

Settings 页使用 [`SettingsPageShell`](../../apps/web/src/features/settings/SettingsPageShell.tsx)：`settings-page-title rxwf-type-page-title`、`settings-section-title rxwf-type-section-title`。

卡片内表单小节优先用 `FormField`，说明文字用 `.rxwf-type-block-hint`。

## 已有 Legacy Class（仍可用）

以下 class 已映射到 token，可继续使用，新代码优先用语义 class：

- `.hint` → sm, muted（通用辅助文案）
- `.settings-page-lead` → 同 page-lead
- `.settings-nav-link` → md
- `.list-pagination` → md
- `.empty-state-title` / `.empty-state-desc` → lg / sm
- `.template-card-title` / `.template-card-desc` → md / sm

## Select 下拉

[`Select`](../../apps/web/src/components/Select.tsx) 面板通过 Portal 渲染，打开时从 trigger 复制 computed font，无需额外处理。

## PR 检查清单

- [ ] 页面主标题使用 `h1.rxwf-type-page-title`（或带返回的 `page-title-with-back`）
- [ ] 未新增 magic `font-size` / inline `fontSize`
- [ ] 列表项标题/元数据/tag 分别用 md / sm / xs 层级
- [ ] 卡片内标题通过 `FormField` 或 `.rxwf-type-block-title`
- [ ] 弹窗标题使用 `.rxwf-modal-title`（已内置 lg）

## 视觉回归检查（8 类场景）

1. 工作流列表 — 标题、分段按钮、列表项、tag、元数据
2. 模板库 — 页面标题、分类、卡片
3. 知识库列表 / 详情 — 标题、Tab 卡片、FormField
4. Bot 编辑器 — NL 区块、配置表单、下拉
5. 设置页 — 侧栏导航、页面标题、分区、表单
6. 设置 / 工作流弹窗 — modal 标题与表单
7. 节点编辑器 — 标题、pane 标题、参数表单
8. Chat — 会话标题、composer 输入

## 扩展 Token

若需新层级，先在 `:root` 增加变量并在本文档登记，再添加 `.rxwf-type-*` 语义 class；勿在组件内单独定义 rem 值。

## 相关

间距标准见 [Spacing](./spacing.md)（标签→控件、块间距、页边距等）。  
加载态 / 防闪空见 [Loading UI](../loading-ui.md)。
