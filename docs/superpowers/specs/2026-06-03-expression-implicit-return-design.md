# 表达式隐式 return（单行）设计

| 字段 | 内容 |
|------|------|
| **状态** | Approved |
| **日期** | 2026-06-03 |
| **关联** | [JS 表达式引擎与全局变量](./2026-06-03-js-expression-globals-design.md)、[expression-guide.md](../../expression-guide.md)、`packages/expression/src/js-sandbox/evaluate-js.ts` |
| **批准** | 2026-06-03（边界：分号多语句按语句块，选项 A） |

---

## 1. 目标

- **单行表达式**在 `{{ }}` 内**不必**写 `return`；宿主自动 `return <expr>`。
- `{{ $json.orderId }}` 与 `{{ return $json.orderId }}` **语义等价**（显式 `return` 仍合法）。
- **多语句**（含同一行用 `;` 分隔的多条语句）须由用户手写 `return` 给出结果。
- 运行时包装与保存期静态校验**共用同一套** AST 分类逻辑。

## 2. 非目标

- 不改变 `$` 全局、沙箱禁止列表、超时策略。
- 不兼容旧 AST 语法（已废弃）。
- 不为「多语句无 return」自动推断返回值（仅校验报错，运行期可能为 `undefined`）。

---

## 3. 分类规则

对用户源码 `trimmed` 使用 **acorn** 解析为 `Program`（`ecmaVersion: 2022`, `sourceType: 'script'`）：

| 条件 | 分类 | 说明 |
|------|------|------|
| `body.length === 1` 且 `body[0].type === 'ExpressionStatement'` | **expression** | 含可选尾部分号，如 `$json.id;` |
| `/^\s*return\b/.test(trimmed)` | **statement-block** | 整块以 `return` 开头（含 `return await …`） |
| 其它 | **statement-block** | `const`/`let`/`if`/`for`、或多条 `;` 分隔语句等 |

**明确排除**「无换行即单行」启发式。例如 `const x = $json.id; return x` 在同一行仍为 **statement-block**（`body.length > 1` 或非 ExpressionStatement）。

解析失败：与现网一致，校验返回 `Invalid expression syntax`；运行期 `E1002`。

---

## 4. 宿主包装（`wrapExpressionSource`）

```text
expression:
  (async () => { 'use strict'; return <ExpressionStatement.expression>; })()

statement-block:
  (async () => { 'use strict'; <trimmed> })()
```

- **expression**：从 AST 取出 `expression` 节点源码（通过 `source` + 节点 `start`/`end` 切片，或 `acorn` 生成），避免 `return (${trimmed})` 把语句包进括号导致语法错误。
- **statement-block**：不再外包 `return (...)`。

顶层 `Promise` 仍由 `isolated-vm` `run(..., { promise: true })` await。

---

## 5. 静态校验（`validateExpressionSource`）

在现有禁止标识符 / `import` 检查之前：

1. 对 `trimmed` 调用与运行时相同的 **分类**（可先 `wrapExpressionSource` 再 parse 做禁止项扫描，或先 parse `trimmed` 再 wrap 做语法检查——实现须保证与运行期分类一致）。
2. 若分类为 **statement-block** 且**不以** `return` 开头：AST walk 查找 `ReturnStatement`；若无 →  
   `{ ok: false, message: 'Multi-statement expressions must include return' }`  
   （实现可微调英文文案，保存 API 原样返回）。

**expression** 类不要求出现 `return` 关键字。

---

## 6. 影响范围

| 组件 | 变更 |
|------|------|
| `evaluate-js.ts` | `classifyExpressionSource`、`wrapExpressionSource` |
| `validate-expression-source.ts` | 共用分类 + return 检查 |
| `evaluate-js.test.ts`、`validate-expression-source.test.ts` | 见 §7 |
| `docs/expression-guide.md` | 示例默认单行无 `return`；§2.5 多行保留 `return` |
| `2026-06-03-js-expression-globals-design.md` | §5 增补隐式 return 引用 |
| `docs/spec.md` FR-9、`docs/adr-expression-sandbox.md` | 一句说明 |
| 编辑器/i18n（若有） | 「多语句须 return」 |

**表达式模式裸 JS**（IF 等）：经 `ensureIfConditionTemplate` 包为 `{{ ... }}` 后走同一 `wrapExpressionSource`。

---

## 7. 测试矩阵

| 用例 | 期望 |
|------|------|
| `$json.count` | 求值 = 字段值 |
| `return $json.count` | 同上 |
| `await Promise.resolve($json.count)`（单 ExpressionStatement） | 正确 await |
| 多行 `const a = 1;\nreturn a` | 正确 |
| `const a = 1; return a`（同行） | 正确 |
| `const a = 1`（无 return） | 校验失败 |
| `return (async () => …)()` 类复杂块 | 以 return 开头，statement-block |
| `process.version` | 仍禁止 |

---

## 8. 文档约定

- 用户指南 §2.1：主推 `{{ $json.x }}`，注明与 `return` 等价。
- §2.5 / §10 多行示例：保留显式 `return`。
- n8n 对照：`={{ $json.x }}` ↔ AWF `{{ $json.x }}`（无需 `return`）。

---

## 9. 与主 spec 关系

本设计为 [2026-06-03-js-expression-globals-design.md](./2026-06-03-js-expression-globals-design.md) 的增量修订；全局变量与沙箱策略不变，仅修订 §5 求值包装语义。
