# 表达式隐式 return Implementation Plan

> **Status:** ✅ Completed (2026-06-03)  
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 单行 `ExpressionStatement` 自动 `return`；多语句块原样放入 async IIFE 且保存时要求含 `return`；文档与示例去掉单行冗余 `return`。

**Architecture:** 新增 `classify-expression-source.ts`（acorn 分类 + 切片表达式源码）；`wrapExpressionSource` 与 `validateExpressionSource` 共用；`expression-guide.md` 批量更新示例。

**Tech Stack:** `@rxwf/expression`、`acorn`、`isolated-vm`、Vitest。

**Spec:** [2026-06-03-expression-implicit-return-design.md](../specs/2026-06-03-expression-implicit-return-design.md)

---

## File map

| 文件 | 职责 |
|------|------|
| `packages/expression/src/js-sandbox/classify-expression-source.ts` | **新建** — AST 分类、表达式源码切片 |
| `packages/expression/src/js-sandbox/classify-expression-source.test.ts` | **新建** — 分类单元测试 |
| `packages/expression/src/js-sandbox/evaluate-js.ts` | 修改 `wrapExpressionSource` |
| `packages/expression/src/js-sandbox/evaluate-js.test.ts` | 更新包装/求值期望 |
| `packages/expression/src/validate-expression-source.ts` | 多语句无 `return` 校验 |
| `packages/expression/src/validate-expression-source.test.ts` | 接受 `$json.x`、拒绝 `const a=1` |
| `packages/expression/src/index.ts` | 可选 export `classifyExpressionSource` |
| `docs/expression-guide.md` | 示例与 §2 写法说明 |
| `apps/web/src/features/editor/node-param-schemas.ts` | placeholder 去掉单行 `return`（若存在） |

---

### Task 1: 表达式分类模块

**Files:**
- Create: `packages/expression/src/js-sandbox/classify-expression-source.ts`
- Create: `packages/expression/src/js-sandbox/classify-expression-source.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// classify-expression-source.test.ts
import { describe, it, expect } from 'vitest';
import {
  classifyExpressionSource,
  expressionSourceFromProgram,
} from './classify-expression-source.js';

describe('classifyExpressionSource', () => {
  it('classifies single expression', () => {
    expect(classifyExpressionSource('$json.count')).toBe('expression');
    expect(classifyExpressionSource('$json.count;')).toBe('expression');
  });

  it('classifies return-prefixed as statement-block', () => {
    expect(classifyExpressionSource('return $json.count')).toBe('statement-block');
  });

  it('classifies semicolon-separated statements as statement-block', () => {
    expect(classifyExpressionSource('const a = 1; return a')).toBe('statement-block');
  });

  it('classifies declaration-only as statement-block', () => {
    expect(classifyExpressionSource('const a = 1')).toBe('statement-block');
  });
});

describe('expressionSourceFromProgram', () => {
  it('slices expression text from trimmed source', () => {
    const src = '  $json.a + 1  ';
    const trimmed = src.trim();
    const program = /* parse trimmed */;
    expect(expressionSourceFromProgram(trimmed, program)).toBe('$json.a + 1');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd packages/expression && npx vitest run src/js-sandbox/classify-expression-source.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```typescript
// classify-expression-source.ts
import * as acorn from 'acorn';

export type ExpressionSourceKind = 'expression' | 'statement-block';

export function classifyExpressionSource(source: string): ExpressionSourceKind {
  const trimmed = source.trim();
  if (!trimmed) {
    return 'statement-block';
  }
  if (/^\s*return\b/.test(trimmed)) {
    return 'statement-block';
  }
  let program: acorn.Program;
  try {
    program = acorn.parse(trimmed, { ecmaVersion: 2022, sourceType: 'script' });
  } catch {
    return 'statement-block';
  }
  if (
    program.body.length === 1 &&
    program.body[0]!.type === 'ExpressionStatement'
  ) {
    return 'expression';
  }
  return 'statement-block';
}

export function expressionSourceFromProgram(
  trimmed: string,
  program: acorn.Program,
): string {
  const stmt = program.body[0];
  if (stmt?.type !== 'ExpressionStatement') {
    throw new Error('Program is not a single ExpressionStatement');
  }
  const { start, end } = stmt.expression;
  if (start == null || end == null) {
    throw new Error('Expression node missing position');
  }
  return trimmed.slice(start, end);
}

export function parseExpressionProgram(source: string): acorn.Program {
  const trimmed = source.trim();
  return acorn.parse(trimmed, { ecmaVersion: 2022, sourceType: 'script' });
}

export function hasReturnStatement(program: acorn.Program): boolean {
  let found = false;
  const walk = (node: acorn.Node): void => {
    if (found) return;
    if (node.type === 'ReturnStatement') {
      found = true;
      return;
    }
    for (const key of Object.keys(node) as (keyof acorn.Node)[]) {
      const child = node[key];
      if (!child) continue;
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && 'type' in item) {
            walk(item as acorn.Node);
          }
        }
      } else if (typeof child === 'object' && child !== null && 'type' in child) {
        walk(child as acorn.Node);
      }
    }
  };
  for (const stmt of program.body) {
    walk(stmt);
  }
  return found;
}
```

（`hasReturnStatement` 也可用 `acorn-walk` `ancestor` 简化，与 `validate-expression-source.ts` 风格一致。）

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd packages/expression && npx vitest run src/js-sandbox/classify-expression-source.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/expression/src/js-sandbox/classify-expression-source.ts \
  packages/expression/src/js-sandbox/classify-expression-source.test.ts
git commit -m "feat(expression): classify single expression vs statement block"
```

---

### Task 2: `wrapExpressionSource` 重写

**Files:**
- Modify: `packages/expression/src/js-sandbox/evaluate-js.ts`
- Modify: `packages/expression/src/js-sandbox/evaluate-js.test.ts`

- [ ] **Step 1: Update tests first**

```typescript
// evaluate-js.test.ts — wrapExpressionSource
it('wraps bare expression with implicit return', () => {
  expect(wrapExpressionSource('$json.count')).toBe(
    "(async () => { 'use strict'; return $json.count; })()",
  );
});

it('wraps statement block without outer return parens', () => {
  expect(wrapExpressionSource('const a = 1; return a')).toBe(
    "(async () => { 'use strict'; const a = 1; return a })()",
  );
});

// evaluateJsExpression — add equivalence
it('implicit return equals explicit return', async () => {
  const ctx = { json: { count: 3 } };
  const a = await evaluateJsExpression('$json.count', ctx);
  const b = await evaluateJsExpression('return $json.count', ctx);
  expect(a).toBe(3);
  expect(b).toBe(3);
});

it('evaluates multi-line block without leading return', async () => {
  const v = await evaluateJsExpression(
    'const n = $json.count;\nreturn n * 2',
    { json: { count: 5 } },
  );
  expect(v).toBe(10);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/expression && npx vitest run src/js-sandbox/evaluate-js.test.ts
```

- [ ] **Step 3: Implement `wrapExpressionSource`**

```typescript
import {
  classifyExpressionSource,
  expressionSourceFromProgram,
  parseExpressionProgram,
} from './classify-expression-source.js';

export function wrapExpressionSource(source: string): string {
  const trimmed = source.trim();
  const kind = classifyExpressionSource(trimmed);
  if (kind === 'expression') {
    const program = parseExpressionProgram(trimmed);
    const expr = expressionSourceFromProgram(trimmed, program);
    return `(async () => { 'use strict'; return ${expr}; })()`;
  }
  return `(async () => { 'use strict'; ${trimmed} })()`;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd packages/expression && npx vitest run src/js-sandbox/evaluate-js.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/expression/src/js-sandbox/evaluate-js.ts \
  packages/expression/src/js-sandbox/evaluate-js.test.ts
git commit -m "feat(expression): implicit return for single ExpressionStatement"
```

---

### Task 3: 静态校验 — 多语句须 `return`

**Files:**
- Modify: `packages/expression/src/validate-expression-source.ts`
- Modify: `packages/expression/src/validate-expression-source.test.ts`

- [ ] **Step 1: Add failing tests**

```typescript
it('accepts bare single expression without return keyword', () => {
  expect(validateExpressionSource('$json.x').ok).toBe(true);
});

it('rejects multi-statement without return', () => {
  const result = validateExpressionSource('const a = 1');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.message).toMatch(/must include return/i);
  }
});

it('accepts multi-statement with return', () => {
  expect(validateExpressionSource('const a = 1; return a').ok).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd packages/expression && npx vitest run src/validate-expression-source.test.ts
```

- [ ] **Step 3: Implement**

在 `validateExpressionSource` 中，`trimmed` 非空后：

```typescript
import {
  classifyExpressionSource,
  hasReturnStatement,
  parseExpressionProgram,
} from './js-sandbox/classify-expression-source.js';

// after empty check:
const kind = classifyExpressionSource(trimmed);
if (kind === 'statement-block' && !/^\s*return\b/.test(trimmed)) {
  try {
    const program = parseExpressionProgram(trimmed);
    if (!hasReturnStatement(program)) {
      return {
        ok: false,
        message:
          'Multi-statement expressions must include return',
      };
    }
  } catch {
    // fall through to wrap parse below
  }
}
```

保留现有 `acorn.parse(wrapExpressionSource(trimmed), …)` 禁止项扫描。

- [ ] **Step 4: Run full package tests**

```bash
cd packages/expression && npm test
```

Expected: all tests PASS（含 `evaluate.test.ts`、`resolve-template.test.ts`；若有仍写 `return $json` 的用例可保留，不必改）。

- [ ] **Step 5: Commit**

```bash
git add packages/expression/src/validate-expression-source.ts \
  packages/expression/src/validate-expression-source.test.ts
git commit -m "feat(expression): validate return in multi-statement expressions"
```

---

### Task 4: 用户文档 `expression-guide.md`

**Files:**
- Modify: `docs/expression-guide.md`

- [ ] **Step 1: Add §2.0 或扩充 §2.1「隐式 return」**

说明：

- 单行表达式：`{{ $json.orderId }}`（推荐），等价于 `{{ return $json.orderId }}`
- 多行/多语句：必须 `return` 结尾
- 同行 `const x = 1; return x` 属于多语句

- [ ] **Step 2: 批量替换示例**

将文档中**单行**示例的 `{{ return ` → `{{ `、`={{ return ` → `={{ `（**不要**改 §2.5 多行块、§10 中含 `const`/`for` 的多语句示例内的 `return`）。

§8 n8n 对照行改为：

```markdown
| `={{ $json.x }}` | `{{ $json.x }}`（等价 `{{ return $json.x }}`） |
```

- [ ] **Step 3: 更新文首版本说明**

关联 [implicit-return design](../superpowers/specs/2026-06-03-expression-implicit-return-design.md)。

- [ ] **Step 4: Commit**

```bash
git add docs/expression-guide.md
git commit -m "docs(expression): guide implicit return for single-line expressions"
```

---

### Task 5: 编辑器 placeholder（可选但建议）

**Files:**
- Modify: `apps/web/src/features/editor/node-param-schemas.ts`

- [ ] **Step 1: 将 placeholder 中 `{{ return $json }}` 改为 `{{ $json }}`**

例如 HITL `summaryField`：`placeholder: '{{ $json }}'`。

- [ ] **Step 2: 搜索其它 `return $json` placeholder**

```bash
rg 'return \$json' apps/web/src --glob '*.{ts,tsx}'
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/node-param-schemas.ts
git commit -m "chore(editor): expression placeholders without redundant return"
```

---

### Task 6: 回归与计划状态

- [ ] **Step 1: 全量相关测试**

```bash
cd packages/expression && npm test
cd packages/workflow && npm test
```

（workflow validate 若依赖表达式扫描，应仍 PASS。）

- [ ] **Step 2: 将本 plan 顶部 Status 标为 Completed，勾选全部 checkbox**

- [ ] **Step 3: Commit plan（若 Step 2 有改动）**

```bash
git add docs/superpowers/plans/2026-06-03-expression-implicit-return.md
git commit -m "docs(plan): mark expression implicit-return plan complete"
```

---

## Spec coverage checklist

| Spec § | Task |
|--------|------|
| §3 分类规则 | Task 1 |
| §4 包装 | Task 2 |
| §5 校验 | Task 3 |
| §6 影响范围 evaluate/validate | Task 1–3 |
| §7 测试矩阵 | Task 1–3 tests |
| §8 文档 | Task 4 |
| 编辑器 placeholder | Task 5 |

---

## Verified (fill after implementation)

```text
cd packages/expression && npm test → 75 passed
```
