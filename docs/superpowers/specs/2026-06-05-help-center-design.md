# 应用内帮助中心（`/help`）— 设计规格

| 字段 | 内容 |
|------|------|
| **状态** | Implemented — 2026-06-05 |
| **日期** | 2026-06-05 |
| **策略** | **方案 1**：在 `apps/web` 内增加 `/help/*` 路由，Markdown 渲染 + 统一壳；节点弹窗标题栏增加帮助按钮，新 Tab 打开上下文文档 |
| **关联** | [node-editor-modal](./2026-05-23-node-editor-modal-design.md)、[code-node-guide](../../code-node-guide.md)、[expression-guide](../../expression-guide.md)、[ux-ui-design](../../ux-ui-design.md) |
| **依赖** | `apps/web`（`react-markdown`、`remark-gfm` 已存在）、`docs/help/` 用户文档源 |

---

## 1. 背景与目标

### 1.1 现状

| 项 | 现状 |
|----|------|
| 节点弹窗参数区 footer | `CodeNodeDescription`、`IfNodeDescription` 等大块内嵌帮助（表格 + 多段说明），占用约 300px+ 高度 |
| 开发者文档 | `docs/code-node-guide.md`、`docs/expression-guide.md` 等内容完整，但**未接入 Web UI** |
| 帮助入口 | 无全局入口；无上下文跳转 |
| 视觉 | 内嵌帮助样式与正文混排，无统一帮助站 |

### 1.2 目标

1. **迁出内嵌帮助**：节点参数面板 footer 不再展示大段说明（Code / IF / Switch 等）。
2. **应用内帮助站**：`/help` 为统一入口，侧边导航 + Markdown 正文，视觉与产品主题一致。
3. **上下文帮助**：节点弹窗标题栏「帮助」按钮（最大化左侧），`window.open` 新 Tab 打开对应当前节点类型的文档。
4. **内容单一来源**：用户向帮助 Markdown 为权威来源；从现有内嵌组件与 `docs/*.md` 精简迁移。

### 1.3 非目标（本期）

- 独立 VitePress / Docusaurus 子应用。
- 外链 GitHub Pages 作为主帮助站。
- 帮助站内全文搜索（第二期）。
- 英文帮助全文（第二期；路由与壳预留 `locale`）。
- 帮助文档在线编辑（仍走 Git + 发布流程）。

---

## 2. 已确认产品决策

| 决策点 | 选择 |
|--------|------|
| 托管方式 | **应用内 `/help` 路由**（与用户选择一致） |
| 打开方式 | **新浏览器 Tab**（`window.open(url, '_blank', 'noopener,noreferrer')`） |
| 帮助按钮位置 | 节点弹窗标题栏，**最大化按钮左侧** |
| 参数区 footer | 移除 `CodeNodeDescription` / `IfNodeDescription` 大块；通用节点可保留一行 `meta.description` 或同样外链（见 §5.3） |
| 内容语言 | **P0 中文**；目录结构预留 `zh` / `en` |
| 与 `docs/` 关系 | `docs/help/` = 用户帮助；`docs/` 其余 = 开发者/规格，互不替代 |

---

## 3. 信息架构与 URL

### 3.1 路由

| 路径 | 说明 |
|------|------|
| `/help` | 帮助首页：分类卡片 + 常用链接 |
| `/help/nodes/code` | Code 节点：沙箱、变量表、`$log`、return 约定 |
| `/help/nodes/if` | IF 节点：条件表达式、`{{ }}` 要求 |
| `/help/nodes/switch` | Switch 节点（可与 IF 共用基础章节 + 分支说明） |
| `/help/expressions` | 表达式与 `{{ }}` 模板（精简自 expression-guide） |
| `/help/editor/input-panel` | INPUT 面板：Schema/Table/JSON、拖拽、context 变量 |
| `/help/nodes/:slug` | 通用节点说明（P1：由 `node-type-meta` 生成 fallback 页或 404→首页） |

**语言前缀（P1 预留，P0 可不启用）：**

- `/help/zh/nodes/code` — 显式中文
- `/help/en/nodes/code` — 英文（内容未就绪时回退中文并提示）

P0 实现：`/help/*` 默认读 `docs/help/zh/**`，无 locale 前缀。

### 3.2 节点类型 → 帮助路径映射

```ts
// apps/web/src/features/help/help-registry.ts
export const NODE_HELP_PATH: Record<string, string> = {
  code: '/help/nodes/code',
  if: '/help/nodes/if',
  switch: '/help/nodes/switch',
  httpRequest: '/help/nodes/http-request',
  json: '/help/nodes/json',
  set: '/help/nodes/set',
  // P1：按 node-type-meta 逐步补齐
};

export function buildHelpUrl(options: {
  nodeType?: string;
  path?: string;       // 显式路径，优先于 nodeType
  hash?: string;       // 锚点，如 #variables
  locale?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let path = options.path ?? '/help';
  if (options.nodeType && NODE_HELP_PATH[options.nodeType]) {
    path = NODE_HELP_PATH[options.nodeType];
  }
  const hash = options.hash ? `#${options.hash}` : '';
  return `${origin}${path}${hash}`;
}
```

未映射的 `nodeType`：打开 `/help`，可选 query `?from=nodeType` 便于统计（P1）。

---

## 4. UI 设计

### 4.1 帮助站壳（`HelpLayout`）

```
┌──────────────────────────────────────────────────────────┐
│  RX-Workflow   帮助中心                    [返回编辑器]   │  ← 顶栏：logo 链首页、标题、返回（history.back 或 /）
├─────────────┬────────────────────────────────────────────┤
│ 侧边导航     │  正文区（Markdown）                          │
│ · 快速开始   │  h1 / h2 / 表格 / 代码块                     │
│ · 表达式     │  可选：右侧 TOC（h2/h3 锚点，P1）            │
│ · 编辑器     │                                            │
│   · INPUT   │                                            │
│ · 节点       │                                            │
│   · Code    │                                            │
│   · IF      │                                            │
└─────────────┴────────────────────────────────────────────┘
```

- **样式**：复用 `--rxwf-*` 变量；正文 `max-width: 48rem`；代码块与编辑器 monospace 一致。
- **Markdown 渲染**：`react-markdown` + `remark-gfm`（与 Chat 相同栈）；`rehype-sanitize` 防 XSS。
- **路由**：`/help/*` **不包裹** `AppShell`（无左侧工作流导航），避免与编辑器布局混淆；顶栏提供「返回」。
- **认证**：已登录用户可访问；未登录重定向 `/login?redirect=/help/...`（与现有路由守卫一致）。

### 4.2 节点弹窗帮助按钮

位置：`NodeEditorModal` → `rxwf-modal-header-actions`，在 `ModalMaximizeButton` **左侧**。

```tsx
<Tooltip label={t(labels, 'help.openContext')}>
  <button
    type="button"
    className="rxwf-modal-help-btn"
    aria-label={t(labels, 'help.openContext')}
    onClick={() => {
      const url = buildHelpUrl({ nodeType: node.type });
      window.open(url, '_blank', 'noopener,noreferrer');
    }}
  >
    {/* 问号或 book 图标 SVG */}
  </button>
</Tooltip>
```

图标：与 `ModalMaximizeButton` / 关闭按钮同尺寸（24×24 触控区），`rxwf-modal-header-actions` 内间距一致。

### 4.3 参数面板 footer 改造

| 节点类型 | P0 行为 |
|----------|---------|
| `code` | 移除 `CodeNodeDescription`；footer 空或仅一行：「详细说明见帮助文档」+ 链接（可选） |
| `if` / `switch` | 移除 `IfNodeDescription` |
| 其他 | 移除长 `meta.description` 段落；保留 **单行** hint（≤80 字）或移除 footer |

**原则**：footer 不再出现多段文字 + 表格；释放空间给 CodeMirror / 参数表单。

INPUT / OUTPUT 面板底部一行 hint（`inputPaneHint` / `outputPaneHint`）**保留**——属于操作提示，非文档。

---

## 5. 内容组织

### 5.1 目录结构

```
docs/help/
  zh/
    index.md                 # 帮助首页正文
    getting-started.md       # P1
    expressions.md
    editor/
      input-panel.md
    nodes/
      code.md                # 迁移 CodeNodeDescription + 精简 code-node-guide
      if.md
      switch.md
      http-request.md        # P1
      ...
  en/                        # P1：结构与 zh 平行
    index.md
    ...
```

### 5.2 内容迁移对照

| 现 UI / 文档 | 目标帮助页 |
|--------------|------------|
| `CodeNodeDescription` + i18n `editor.code.*` | `docs/help/zh/nodes/code.md` |
| `IfNodeDescription` + `editor.if.*` | `docs/help/zh/nodes/if.md` |
| `docs/code-node-guide.md` | 精简合并进 `nodes/code.md`（用户向，去掉实现路径引用） |
| `docs/expression-guide.md` | 精简合并进 `expressions.md` |
| INPUT 面板 spec | `editor/input-panel.md` |

**单一来源原则**：帮助正文以 Markdown 为准；删除 `CodeNodeDescription.tsx` / `IfNodeDescription.tsx` 后，对应 i18n 键标记废弃或仅保留按钮文案。

### 5.3 首页与导航配置

```ts
// apps/web/src/features/help/help-nav.ts
export interface HelpNavItem {
  slug: string;           // URL 段，如 nodes/code
  titleKey: string;       // i18n
  children?: HelpNavItem[];
}

export const HELP_NAV_ZH: HelpNavItem[] = [
  { slug: '', titleKey: 'help.nav.home' },
  { slug: 'expressions', titleKey: 'help.nav.expressions' },
  {
    slug: 'editor/input-panel',
    titleKey: 'help.nav.inputPanel',
  },
  {
    slug: 'nodes',
    titleKey: 'help.nav.nodes',
    children: [
      { slug: 'nodes/code', titleKey: 'help.nav.nodeCode' },
      { slug: 'nodes/if', titleKey: 'help.nav.nodeIf' },
      { slug: 'nodes/switch', titleKey: 'help.nav.nodeSwitch' },
    ],
  },
];
```

侧边栏由 `HELP_NAV_*` 驱动，与 Markdown 文件路径一致。

---

## 6. 技术实现

### 6.1 模块划分

```
apps/web/src/features/help/
  HelpLayout.tsx           # 壳：顶栏 + 侧栏 + Outlet
  HelpHomePage.tsx         # /help
  HelpDocPage.tsx          # /help/* 动态加载 MD
  help-registry.ts         # NODE_HELP_PATH, buildHelpUrl
  help-nav.ts              # 侧栏结构
  load-help-doc.ts         # 按 slug 解析 MD 源码
  help-markdown.css        # 正文排版（或并入 styles.css）
```

### 6.2 Markdown 加载方式（P0）

**推荐：构建时静态导入（Vite `import.meta.glob`）**

```ts
const docs = import.meta.glob('../../../../docs/help/zh/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
```

- 优点：无运行时 API、可离线、与部署版本一致。
- 路径映射：`/help/nodes/code` → `docs/help/zh/nodes/code.md`。
- 缺失文件：`HelpDocPage` 显示 404 友好页 + 链回首页。

**备选（不采用 P0）**：API `GET /api/help/:slug` 读盘——增加后端与权限面，延后。

### 6.3 路由注册（`App.tsx`）

```tsx
<Route path="/help/*" element={<HelpLayout />}>
  <Route index element={<HelpHomePage />} />
  <Route path="*" element={<HelpDocPage />} />
</Route>
```

放在认证壳外或内：

- **建议**：与 `/embed` 类似，独立顶层 Route，内部自行检查 `phase === 'app'`；未登录带 `redirect` 回登录。

### 6.4 全局帮助入口（P1）

| 位置 | 行为 |
|------|------|
| `AppShell` 用户菜单 / 底栏 | 「帮助中心」→ `window.open('/help')` 或 SPA 导航 |
| 设置页底部 | 「文档」链接 |

P0 仅节点弹窗按钮 + 直接访问 URL。

### 6.5 i18n 新增键（示例）

| Key | 中文 |
|-----|------|
| `help.title` | 帮助中心 |
| `help.openContext` | 打开此节点的帮助文档 |
| `help.back` | 返回 |
| `help.notFound` | 未找到该帮助页面 |
| `help.nav.*` | 侧栏各章节标题 |

Markdown 正文 P0 为中文写死；壳与导航走 i18n。

---

## 7. 实施分期

### P0（本期）

1. `docs/help/zh/` 初版：`index.md`、`nodes/code.md`、`nodes/if.md`、`expressions.md`
2. `features/help/*` + `/help` 路由 + Markdown 渲染
3. `NodeEditorModal` 帮助按钮 + `buildHelpUrl`
4. 移除 `CodeNodeDescription` / `IfNodeDescription` 及参数 footer 大块
5. `docs/README.md` 增加用户帮助索引链接
6. 测试：`help-registry` 单元测试；可选 Playwright 快照 `/help/nodes/code`

### P1

- `editor/input-panel.md`、`nodes/switch.md`、更多节点页
- `AppShell` 全局帮助入口
- `en/` 英文内容 + locale 前缀路由
- 正文右侧 TOC、锚点高亮

### P2

- 帮助站内搜索（客户端索引 `import.meta.glob` 标题）
- `?from=nodeType` 分析、帮助页「在编辑器中打开示例工作流」

---

## 8. 验收标准

| # | 标准 |
|---|------|
| AC-1 | 访问 `/help` 显示帮助首页，侧栏可导航至各章节 |
| AC-2 | `/help/nodes/code` 渲染完整 Code 节点说明（含变量表、return 约定） |
| AC-3 | Code 节点弹窗点击帮助按钮，新 Tab 打开 `/help/nodes/code` |
| AC-4 | IF 节点打开 `/help/nodes/if` |
| AC-5 | 参数面板 footer 无大段表格帮助，CodeMirror 可视区域增大 |
| AC-6 | 帮助页样式与暗色主题一致，无 AppShell 工作流侧栏 |
| AC-7 | 未登录访问 `/help` 重定向登录并可回跳 |

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| MD 与产品行为不同步 | 帮助页注明版本；变更节点行为时同 PR 更新 `docs/help` |
| `import.meta.glob` 路径跨 package | 固定相对 `apps/web` 指向 `docs/help` |
| 新 Tab 被弹窗拦截 | 使用直接 `click` 同步 `window.open`（用户手势内） |
| 删除内嵌帮助后新用户迷失 | P0 保留一行 footer 链接；P1 全局入口 |

---

## 10. 自审清单

- [x] 范围与非目标明确
- [x] URL、映射、打开方式无歧义
- [x] P0 可交付最小集（Code + IF + 壳 + 按钮）
- [x] 与现有 `docs/` 分工清晰
- [x] 无实现细节绑定不可替换方案（MD 加载可换 API，接口保持稳定）
- [x] 用户评审通过

---

**请评审本规格。确认后进入实施计划（`docs/superpowers/plans/2026-06-05-help-center.md`）。**
