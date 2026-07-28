# 表达式静态校验升级 Implementation Plan

**Goal:** 用 acorn AST 替换 `validate-expression-source.ts` 中的正则禁止列表。

**Spec:** [2026-06-03-expression-static-validation-design.md](../specs/2026-06-03-expression-static-validation-design.md)

---

## Task 1: 依赖与 AST 校验器

**Files:**
- Modify: `packages/expression/package.json`
- Modify: `packages/expression/src/validate-expression-source.ts`
- Modify: `packages/expression/src/validate-expression-source.test.ts`

- [x] 添加 `acorn`、`acorn-walk`
- [x] 实现 parse + ancestor walk（共用 `wrapExpressionSource`）
- [x] 扩展测试矩阵（误报修复 + 语法错误）
- [x] `npm test` in `packages/expression`

---

## Task 2: 文档

**Files:**
- Modify: `docs/superpowers/specs/2026-06-03-js-expression-globals-design.md` §10

- [x] 更新 as-built：静态校验 → acorn

---

## Verification

```bash
cd packages/expression && npm test
cd packages/workflow && npm test -- validate-expression
```
