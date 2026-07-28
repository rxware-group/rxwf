# 应用内帮助中心（`/help`）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 内交付 `/help` 帮助站，将节点弹窗内嵌帮助迁出至 Markdown，并在弹窗标题栏提供上下文帮助按钮。

**Architecture:** `docs/help/zh/*.md` 经 Vite `import.meta.glob` 构建时打包；`HelpLayout` 提供侧栏 + Markdown 正文；`help-registry` 映射节点类型到 URL；`NodeEditorModal` 用 `window.open` 打开上下文页。

**Tech Stack:** React Router 7、react-markdown、remark-gfm、现有 `--rxwf-*` 主题

**Spec:** [2026-06-05-help-center-design.md](../specs/2026-06-05-help-center-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/help/zh/**/*.md` | 用户帮助正文 |
| `apps/web/src/features/help/help-registry.ts` | URL 构建与节点映射 |
| `apps/web/src/features/help/help-nav.ts` | 侧栏结构 |
| `apps/web/src/features/help/load-help-doc.ts` | slug → MD 源码 |
| `apps/web/src/features/help/HelpMarkdown.tsx` | Markdown 渲染 |
| `apps/web/src/features/help/HelpLayout.tsx` | 壳布局 |
| `apps/web/src/features/help/HelpDocPage.tsx` | 文档页 / 404 |
| `apps/web/src/App.tsx` | `/help` 路由 |
| `apps/web/src/features/editor/NodeEditorModal.tsx` | 帮助按钮 |
| `apps/web/src/features/editor/NodeEditorParamsPane.tsx` | 移除 footer 大块 |

---

### Task 1: Registry + loader + tests

- [x] Create `help-registry.ts`, `load-help-doc.ts`, `help-registry.test.ts`
- [x] Run `pnpm --filter @rxwf/web test`

### Task 2: Markdown content

- [x] Create `docs/help/zh/index.md`, `nodes/code.md`, `nodes/if.md`, `expressions.md`
- [x] P1: `nodes/switch.md`, `editor/input-panel.md`

### Task 3: Help UI shell

- [x] Create `HelpMarkdown.tsx`, `HelpLayout.tsx`, `HelpDocPage.tsx`, styles
- [x] Register route in `App.tsx`; `vite.config.ts` `fs.allow`

### Task 4: Editor integration

- [x] Help button in `NodeEditorModal`
- [x] Remove `CodeNodeDescription` / `IfNodeDescription` from params footer
- [x] i18n keys in `catalog-ui-ext.ts`

### Task 5: Docs + verify

- [x] Update `docs/README.md`, spec status → Implemented
- [x] `pnpm --filter @rxwf/web typecheck && test && build`

### Task 6: P1 extras

- [x] AppShell sidebar help button (`SidebarUserFooter`)
- [x] Login redirect preserve `/help` path (`RedirectToLogin`, `safeRedirectPath`)
- [x] HelpMarkdown internal `/help` links via React Router `Link`
