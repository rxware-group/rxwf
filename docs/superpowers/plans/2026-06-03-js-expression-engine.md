# JS 表达式引擎（`{{ }}`）Implementation Plan

> **Status:** ✅ Completed (2026-06-03)  
> **Spec:** [2026-06-03-js-expression-globals-design.md](../specs/2026-06-03-js-expression-globals-design.md) (Implemented)

**Goal:** 用 `isolated-vm` 替换 `@rxwf/expression` 自研 AST，在专用沙箱中执行 JS（A2：`async/await`、无网络、无超时），注入 §4 全局变量，并按 §5 统一返回值语义。

**Architecture (as-built):** `packages/expression/src/js-sandbox/`（`build-globals.ts` + `evaluate-js.ts`）；`evaluate.ts` / `resolve-template.ts` 调用沙箱；`node-runner/expression/item-context.ts` 注入 `binary`/`itemIndex`/`execution`/`workflow`；`workflow/validate.ts` 保存时扫描表达式。

**Tech Stack:** Node.js、`isolated-vm@^5.0.1`、`acorn`/`acorn-walk` 静态校验、Vitest。

---

## Implementation notes (deviations from original plan)

| Plan 原意 | 实际实现 |
|-----------|----------|
| esbuild/acorn 静态校验 | 初版正则 → **已升级 acorn**（2026-06-03-expression-static-validation） |
| `ensure-expression-template.ts` 独立模块 | 保留 `if-condition.ts`；扫描在 `scan-expression-sources.ts` |
| isolate 池 | 每次求值新建 isolate 并 `dispose` |
| `execution-engine.ts` 直接填 context | `item-context.ts` + `expressionMetaFromNodeContext` 在 node-runner |
| Task 10 独立集成测试包 | 覆盖于 `evaluate.test.ts`、`resolve-template.test.ts`、`validate-expression.test.ts`（55 tests PASS） |
| `$binary` 专项测试 | globals 已注入；**建议补** `evaluate-js.test.ts` case（非阻塞） |

**Verified:** `cd packages/expression && npm test` → 55 passed.

---

## Task checklist

### Task 1: `isolated-vm` 依赖与沙箱骨架 — ✅

- [x] `isolated-vm` in `packages/expression/package.json`
- [x] `js-sandbox/evaluate-js.ts` + tests
- [x] `evaluateJsExpression`：32MB memory limit，无 timeout，`AwfError E1002`

### Task 2: `toDisplayString` 与 binary 占位 — ✅

- [x] `to-display-string.ts` + tests（`[binary:key]`）

### Task 3: `buildSandboxGlobals`（§4 全局） — ✅

- [x] `ExpressionContext` 扩展（`binary`, `itemIndex`, `execution`, `workflow`）
- [x] `build-globals.ts`：`BOOTSTRAP_SCRIPT` + `$input`/`$nodes` proxies
- [x] `$binary`、`$nodes[].binary` 注入

### Task 4: 替换 `evaluateExpression` / 删除 AST — ✅

- [x] `evaluate.ts` → async + `evaluateJsExpression`
- [x] `parse-eval.ts` **已删除**
- [x] `evaluate.test.ts` 更新（16 tests）

### Task 5: `resolve-template` 接入 JS 与 async — ✅

- [x] `resolveTemplateString` / `resolveTemplateValue` / `resolveTemplateJson` async
- [x] node-runner 调用方 `await`（set, json, http-request, if, switch, …）

### Task 6: 静态校验 — ✅

- [x] `validate-expression-source.ts`
- [x] `scan-expression-sources.ts` + `validateWorkflowExpressionSources`

### Task 7: 工作流保存校验 + 执行上下文 — ✅

- [x] `packages/workflow/src/validate.ts` 调用表达式扫描
- [x] `item-context.ts`：`binary`, `itemIndex`, `expressionMetaFromNodeContext`
- [x] if / switch / set / json 传入 meta + itemIndex

### Task 8: 文档与 ADR — ✅

- [x] `docs/adr-expression-sandbox.md` §2–3 更新
- [x] `docs/spec.md` FR-9 表达式小节

### Task 9: 编辑器/i18n — ✅

- [x] `catalog-ui-ext.ts`：`$binary`、`$itemIndex`、`$execution`、`$workflow`

### Task 10: 端到端回归 — ✅

- [x] `@rxwf/expression` 55 tests PASS
- [ ] 可选：`evaluate-js` 增加 `$binary.data` 读测（follow-up）

---

## Next: Workflow Item binary

表达式层 **可读** `$binary`，但节点层尚无 binary **生产者**与 **blob 持久化**。后续工作：

- **Design:** [2026-06-03-workflow-binary-support-design.md](../specs/2026-06-03-workflow-binary-support-design.md)
- **Plan:** [2026-06-03-workflow-binary-support.md](./2026-06-03-workflow-binary-support.md)
