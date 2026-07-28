# 设置页布局规范

> 编码规范文档。摘要同步于 [ux-ui-design.md](./ux-ui-design.md) §3.24、§4.7。  
> 实现：`apps/web/src/features/settings/`、`apps/web/src/styles.css`、`apps/web/src/scrollbars.css`

## 1. 范围

设置 Modal 右侧详情区（`.settings-content`）及遵循同一套滚动条规则的其它页级/嵌套滚动区。

| 维度 | 要求 |
|------|------|
| 页边距 | 内容左右留白对称 |
| 滚动条 | 滑块不贴容器右缘，居中于右侧 gutter 带内 |
| 无滚动条 | 右侧仍保留与左侧等宽的留白（`scrollbar-gutter: stable`） |
| 标题 | 左侧 Nav 名称为 h1；页内配置分块为 h2 |

---

## 2. 布局结构

```text
┌─ 设置 Modal ─────────────────────────────────────────────┐
│  设置                              [×]                    │
├─ Nav ─┬─ .settings-content（可滚动）─────────────────────┤
│ ● 我的 │  我的                              ← h1          │
│   用户 │  说明文字（可选 .settings-page-lead）           │
│   …    │  ┌─ 账户信息 ──────────────┐      ← h2         │
│        │  │  …                      │                    │
│        │  └─────────────────────────┘                    │
│        │                              [thumb] ← 居中 gutter│
└────────┴──────────────────────────────────────────────────┘
```

---

## 3. 滚动条与页内边距

### 3.1 CSS Token

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--rxwf-page-gutter` | `1.5rem` | 页级内容左/上/下留白；设置详情区左 gutter |
| `--rxwf-scrollbar-size` | `6px` | 滑块可见宽度（全局统一，见 `:root`） |
| `--rxwf-scroll-gutter` | `var(--rxwf-page-gutter)` | 滚动条轨道宽度（与左 gutter 一致） |
| `--rxwf-scrollbar-thumb` | 主题色 | 滑块颜色（`:root` / 主题块） |
| `--rxwf-scrollbar-thumb-hover` | 主题色 | 滑块 hover |

嵌套侧栏（如工作流 **节点列表** `.node-palette-scroll`）可覆盖轨道宽度（不覆盖滑块宽度）：

```css
--palette-inset: 1rem;
--rxwf-scroll-gutter: var(--palette-inset);
```

### 3.2 对称边距原理

```text
┌────────────────────────────────────────────────────┐
│ pad │        内容区        │  track (--rxwf-scroll-gutter) │
│1.5rem│                     │    [6px thumb 居中]          │
└────────────────────────────────────────────────────┘
  ↑ padding-inline-start          ↑ 无 padding-inline-end；
                                    由 stable gutter / 轨道承担
```

**错误做法**（会造成右宽左窄）：

```css
/* DON'T：四边同 padding + 全宽轨道 */
padding: var(--rxwf-page-gutter);
overflow: auto;
/* 右侧 ≈ padding-right + 轨道宽 */
```

**正确做法**（页级滚动容器 `.settings-content`、`.rxwf-scroll-region`）：

```css
padding-block: var(--rxwf-page-gutter);
padding-inline-start: var(--rxwf-page-gutter);
padding-inline-end: 0;
scrollbar-gutter: stable;
box-sizing: border-box;
overflow: auto;
```

`scrollbar-gutter: stable` 保证**无溢出、无滚动条**时，右侧仍预留与轨道同宽的 gutter。

不支持 `scrollbar-gutter: stable` 的浏览器回退：

```css
@supports not (scrollbar-gutter: stable) {
  .rxwf-scroll-region,
  .settings-content {
    padding-inline-end: var(--rxwf-page-gutter);
  }
}
```

### 3.3 全局滚动条样式

文件：[`apps/web/src/scrollbars.css`](../apps/web/src/scrollbars.css)

- WebKit：轨道宽 = `--rxwf-scroll-gutter`；滑块用透明 `border` + `background-clip: padding-box` 在轨道内居中。
- **禁止**在 Chrome 侧同时写 `scrollbar-width`（会启用系统滚动条，导致 `::-webkit-scrollbar` 失效）。
- Firefox：`scrollbar-width: thin` + 透明轨道；滑块无法像素级居中，可接受。

### 3.4 编码规范（滚动条）

**Do**

- 可滚动区域继承 `scrollbars.css`，不在组件内写 `::-webkit-scrollbar`。
- 页级容器：`padding-inline-end: 0` + `scrollbar-gutter: stable`。
- 嵌套面板仅覆盖 `--rxwf-scroll-gutter`（及对应的 `padding-inline-start`），不单独改 thumb 颜色。

**Don't**

- 禁止四边等值 `padding` 且轨道宽 = `--rxwf-scroll-gutter`。
- 禁止在 Chrome 侧添加 `scrollbar-width`。

---

## 4. 标题层级

### 4.1 规则

| 层级 | HTML | 文案来源 | 组件 |
|------|------|----------|------|
| 一级（页标题） | `<h1 class="settings-page-title">` | 与 [`settings-nav-config.tsx`](../apps/web/src/features/settings/settings-nav-config.tsx) 中 `labelKey` **同源** | `SettingsPageShell` |
| 二级（配置分块） | `<h2 class="settings-section-title">` | 各 panel 小节 i18n key | `SettingsSection` |

- 单块页面：仅 h1 + 内容；若 panel 有独立小节名则保留 h2。
- 子路由不在 Nav 中（如 `/settings/models/ollama`）：`SettingsPageShell` 使用 `titleKey` 或 `title` 覆盖。

### 4.2 组件用法

```tsx
import { SettingsPageShell, SettingsSection } from './SettingsPageShell.js';

export function ExampleSettingsPage() {
  return (
    <SettingsPageShell
      lead={<p className="hint settings-page-lead">页面说明…</p>}
    >
      <SettingsSection title={t(labels, 'settings.example.section')}>
        {/* 表单、表格等 */}
      </SettingsSection>
    </SettingsPageShell>
  );
}
```

子路由标题覆盖：

```tsx
<SettingsPageShell titleKey="settings.models.ollamaService">
```

Nav 标题解析：[`use-settings-nav-title.ts`](../apps/web/src/features/settings/use-settings-nav-title.ts)、[`findSettingsNavItem()`](../apps/web/src/features/settings/settings-nav-config.tsx)。

### 4.3 样式类

| 类名 | 用途 |
|------|------|
| `.settings-content` | Modal 右侧滚动容器 |
| `.settings-page` | 详情页根节点（`SettingsPageShell`） |
| `.settings-page-title` | h1，`1.25rem` / `600` |
| `.settings-section-title` | h2，`1rem` / `600` |
| `.settings-page-lead` | 页标题下说明，`margin-bottom: 1.25rem` |
| `.settings-panel` | 分块 panel 间距 |
| `.rxwf-scroll-region` | 通用页级滚动区（与 `.settings-content` 相同 padding / gutter 规则） |

### 4.4 编码规范（标题）

**Do**

- 新增 settings 子路由**必须**使用 `SettingsPageShell`。
- 多个配置分块**必须**使用 `SettingsSection`。
- h1 文案通过 Nav 配置或 `titleKey` 解析，禁止手写重复文案。

**Don't**

- 禁止用 `h3` / `h4` 作为页内分块标题。
- 禁止在 panel 内用 `h3` 充当页标题。

---

## 5. 嵌套滚动区示例（节点列表）

工作流编辑器节点面板 [`.node-palette-scroll`](../apps/web/src/styles.css) 遵循同一规则，侧栏使用 `--palette-inset: 1rem` 作为左右 gutter；滑块宽度继承全局 `--rxwf-scrollbar-size`（6px）：

```css
.node-palette-scroll {
  --rxwf-scroll-gutter: var(--palette-inset);
  padding-inline-start: var(--palette-inset);
  padding-inline-end: 0;
  padding-block-end: var(--palette-inset);
  scrollbar-gutter: stable;
}
```

搜索框 `.palette-search` 单独 `padding-inline: var(--palette-inset)`，与列表左对齐。

节点编辑器三列（输入 / 参数 / 输出）使用 `--node-editor-pane-inset: calc(0.75rem * 1.5)`：参数列滚动区为 [`.node-editor-params-tab-panel`](../apps/web/src/styles.css)，输入/输出列为 `.node-editor-input-pane .node-editor-pane-body` / `.node-editor-output-pane .node-editor-pane-body`，规则与 `.node-palette-scroll` 相同（`padding-inline-start` + `scrollbar-gutter: stable` + `--rxwf-scroll-gutter`）。

---

## 6. 相关文件

| 文件 | 说明 |
|------|------|
| [`apps/web/src/features/settings/SettingsPageShell.tsx`](../apps/web/src/features/settings/SettingsPageShell.tsx) | 页壳 / 分块组件 |
| [`apps/web/src/features/settings/use-settings-nav-title.ts`](../apps/web/src/features/settings/use-settings-nav-title.ts) | h1 标题 hook |
| [`apps/web/src/features/settings/settings-nav-config.tsx`](../apps/web/src/features/settings/settings-nav-config.tsx) | Nav 与 `findSettingsNavItem` |
| [`apps/web/src/features/settings/SettingsLayout.tsx`](../apps/web/src/features/settings/SettingsLayout.tsx) | `.settings-content` 容器 |
| [`apps/web/src/styles.css`](../apps/web/src/styles.css) | Token、`.settings-content`、标题样式 |
| [`apps/web/src/scrollbars.css`](../apps/web/src/scrollbars.css) | 全局滚动条 |

---

## 7. 验收清单

**边距 / 滚动条**

- [ ] 设置 Modal 长页（系统配置）：内容左缘与 panel 右缘到窗口边缘的空白宽度一致
- [ ] 有滚动条时，滑块位于右侧 gutter 中间，不贴 Modal 右缘
- [ ] 无滚动条短页：右侧留白与左侧一致（不因 `padding-inline-end: 0` 贴边）
- [ ] 节点列表有/无滚动条时边距对称（紧凑 gutter）

**标题**

- [ ] 逐 Tab 切换：h1 与左侧 Nav 高亮项文案一致
- [ ] 多 panel 页：每块有 h2，无 orphan h3 页标题
- [ ] `/settings/models/ollama`：h1 为 Ollama 相关覆盖标题
