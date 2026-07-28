# Web 加载态：转圈 + 遮罩

> 实现提交：`dee091e`（合并 `cursor/88a36958`）  
> 代码位置：`apps/web/src/components/Loading*.tsx`、`apps/web/src/styles.css`

## 背景与目标

此前加载态主要通过以下方式表达，容易造成 **布局抖动（CLS）**：

- 插入/移除 `<p className="hint">加载中…</p>` 等文字行
- 按钮在 loading 时切换文案（如「登录」→「登录中…」），导致按钮宽度变化
- 工作流编辑器用 `visibility: hidden` 隐藏主区域 + 顶部 hint，出现大块空白

改造后统一为 **半透明遮罩 + 居中转圈**，容器尺寸保持稳定；原 i18n 文案 key **保留**，仅用于 `aria-label` / `title`，不再作为可见 UI 文字。

## 组件结构

```
LoadingHost（相对定位容器，loading 时叠层）
  ├── children（页面/表单/表格等内容，结构始终保留）
  └── LoadingOverlay（绝对定位遮罩，可选 fullScreen）
        └── LoadingSpinner（CSS 动画圆环）
```

| 组件 | 文件 | 职责 |
|------|------|------|
| `LoadingSpinner` | `apps/web/src/components/LoadingSpinner.tsx` | 纯 CSS 转圈；`size`: `sm` \| `md`；`label` 作无障碍名称 |
| `LoadingOverlay` | `apps/web/src/components/LoadingOverlay.tsx` | `rgba(0,0,0,0.55)` 遮罩 + 居中 spinner；`fullScreen` 时用 `position: fixed` |
| `LoadingHost` | `apps/web/src/components/LoadingHost.tsx` | 包裹内容区，`loading={true}` 时渲染 overlay |

### LoadingSpinner

```tsx
<LoadingSpinner size="sm" label={t(labels, 'common.refreshing')} />
```

- `role="status"`、`aria-live="polite"`
- `label` 不显示在界面上，仅供读屏

### LoadingOverlay

```tsx
<LoadingOverlay fullScreen label={t(labels, 'common.loading')} />
```

- 容器设 `aria-busy="true"`

### LoadingHost

```tsx
<LoadingHost
  loading={isLoading}
  label={t(labels, 'common.loading')}
  minHeight="12rem"
  className="settings-panel"
>
  {/* 子内容始终渲染 */}
</LoadingHost>
```

| 属性 | 说明 |
|------|------|
| `loading` | 为 `true` 时显示遮罩 |
| `fullScreen` | 全屏固定遮罩（如 App 启动、`auth-screen`） |
| `minHeight` | 保证空内容时仍有占位高度，避免高度塌陷 |
| `label` | 传给 spinner 的 `aria-label` |
| `className` / `style` | 与布局类名组合（如 `chat-message-list`、`editor-main-loading-host`） |

## CSS 类名

定义于 `apps/web/src/styles.css`：

| 类名 | 说明 |
|------|------|
| `.loading-host` | `position: relative` |
| `.loading-host--fullscreen` | `min-height: 100vh` |
| `.loading-overlay` | `position: absolute; inset: 0; z-index: 50` |
| `.loading-overlay--fullscreen` | `position: fixed; z-index: 1000` |
| `.loading-spinner` / `.loading-spinner--sm` | 2rem / 1rem 圆环，`--rxwf-accent` 高亮边 |
| `.dirty-badge--spinner` | 工具栏自动保存徽标内 spinner 固定占位 |
| `.editor-main-loading-host` | 编辑器主区域 flex 填满 |
| `.chat-message-list.loading-host` | `min-height: 8rem` |
| `.mcp-tool-picker-panel .loading-host` | `min-height: 4rem` |

遮罩透明度与 `.rxwf-modal-backdrop` 一致（`rgba(0, 0, 0, 0.55)`）。

## 使用约定

### 1. 页面 / 区块加载

- **不要**再写 `{loading && <p>加载中…</p>}`
- 用 `LoadingHost` 包裹整块内容（表格、表单、侧栏列表等）
- 首屏仅 loading 时可用空 `children` + `minHeight`，或 `fullScreen`

示例：设置页 early return 改为 Shell + overlay：

```tsx
if (loading) {
  return (
    <SettingsPageShell>
      <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
    </SettingsPageShell>
  );
}
```

### 2. 表单 / 按钮提交

- 按钮 **保持常态文案**（「登录」「保存」「创建」）
- `disabled={loading}` + 外层 `LoadingHost loading={loading}` 盖住表单/卡片
- 不在按钮内切换「登录中…」「保存中…」

### 3. 行内状态（非阻塞）

- 工具栏自动保存、节点/日志「执行中」：用 `LoadingSpinner size="sm"` 替代文字
- `autoSaved` / `autoSaveFailed` 等结果态仍可用文字

### 4. 下拉 / 弹出层

- `<select>` 的 `<option>` 不再写「加载中…」，保持默认占位项
- 在 `FormField` 或 picker panel 外包 `LoadingHost`

### 5. 空态 vs 加载态（防闪空）

异步列表 / 详情页常见错误：`items` 初始为 `[]`，在请求返回前就渲染 `EmptyState`（如「暂无知识库」），切换路由时会闪一下空列表。

硬性约定：

1. 凡异步拉取列表或详情：`loading`（或等价「尚未完成首次加载」标志）**初始必须为 `true`**
2. **`loading === true` 时禁止渲染 `EmptyState`**，以及任何「暂无数据」类文案
3. 首屏用 `LoadingHost loading minHeight="12rem"`（或包裹内容区）显示转圈；`label={t(labels, 'common.loading')}`
4. 仅当 `!loading && !error && items.length === 0` 才渲染 `EmptyState`
5. 刷新 / 切换 scope：可保持上一份数据 + overlay，或清空并进入 loading；**不得**在仍加载时展示空态

标准渲染分支：

```tsx
const [loading, setLoading] = useState(true);

// load: setLoading(true) → await → finally setLoading(false)

{loading ? (
  <LoadingHost loading minHeight="12rem" label={t(labels, 'common.loading')} />
) : items.length === 0 && !error ? (
  <EmptyState ... />
) : (
  <列表 />
)}
```

正确参考：`RunnerListPage`（`!loading && runners.length === 0` 才空态）。

## 已改造页面（摘要）

| 场景 | 代表文件 |
|------|----------|
| App 启动 | `App.tsx` |
| 认证表单 | `LoginPage`、`ResetPasswordPage`、`InitialSetupPage` 等 |
| 设置页 | `SystemSettingsPage`、`LangSmithSettingsPage`、`ModelCatalogPage`、`UsersAdminPage`、`AgentMemoryListPage` |
| 编辑器 | `WorkflowEditorPage`、`WorkflowExecutionsSidebar`、`WorkflowCollaboratorsPanel` |
| 聊天 | `ChatMessageList`、`ChatPage`、`ChatBotListPage`、`ChatBotEditorPage` |
| 列表防闪空 | `KnowledgeListPage`、`WorkflowListPage`、`ChatBotListPage`、`TemplateGalleryPage`、`RunnerListPage` |
| 模板 | `TemplateGalleryPage` |
| MCP | `McpClientFields`、`ToolWorkflowSelect` |
| 状态徽标 | `EditorToolbar`、`WorkflowNode`、`EditorLogPanel` |

## 无障碍

- `LoadingHost`：`aria-busy={loading}`
- `LoadingSpinner`：`aria-label={label}`（来自 i18n，如 `common.loading`）
- 读屏可感知加载，视觉用户仅见转圈

## 测试

- 单元测试：`apps/web/src/components/LoadingHost.test.tsx`
  - loading 时存在 overlay、`aria-busy`，且不渲染可见 loading 文案
- 手动验证见下表

| 检查项 | 预期 |
|--------|------|
| App 启动 / 登录 | 全屏或卡片遮罩，无文字行插入 |
| 设置页刷新数据 | 表格区域 overlay，表头不消失 |
| 工作流编辑器打开 | 无 `visibility:hidden` 大块空白 |
| 聊天空会话加载 | 消息区高度稳定（约 8rem） |
| 按钮提交 | 按钮宽度不变，表单有遮罩 |
| 切到知识库 / 工作流 / Bot / 模板 / 对话 | 先转圈，不闪「暂无…」/「开始新对话」EmptyState |

本地运行：

```bash
pnpm dev
cd apps/web && pnpm test -- LoadingHost
```

## i18n 说明

`packages/i18n-catalog` 中诸如 `common.loading`、`auth.loggingIn`、`editor.loadingWorkflow` 等 key **未删除**，继续作为 `LoadingHost` / `LoadingSpinner` 的 `label` 入参。新增加载态时请传 `label={t(labels, '…')}`，勿再把 loading 文案写进 JSX 可见节点。

## 扩展新页面 checklist

1. 是否存在 `{loading && <p>…</p>}` 或按钮 loading 文案切换？→ 改为 `LoadingHost` + 静态按钮文案
2. 容器是否需要 `minHeight` 避免空态高度为 0？
3. 全屏场景是否用 `fullScreen`？
4. 是否为读屏传入对应 i18n `label`？
5. 切换路由时是否会在数据返回前闪 `EmptyState`？→ `loading` 初始 `true`，空态仅 `!loading && length === 0`
6. 必要时补充/更新 `LoadingHost.test.tsx` 或页面级测试

## 相关

- [Typography](./design/typography.md)
- [Spacing](./design/spacing.md)
