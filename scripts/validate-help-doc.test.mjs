#!/usr/bin/env node
/**
 * TDD tests for scripts/validate-help-doc.mjs (M-6 help docs).
 * Run: node scripts/validate-help-doc.test.mjs
 */
import assert from 'node:assert/strict';
import {
  MIN_CHAR_COUNT,
  countContentChars,
  validateHelpDoc,
} from './validate-help-doc.mjs';

let passed = 0;
let failed = 0;

/**
 * @param {string} name
 * @param {() => void} fn
 */
function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`not ok - ${name}`);
    console.error(err);
    failed += 1;
  }
}

const VALID_DOC = `# IF 节点

## 用途

按 \`{{ }}\` 条件表达式将每条输入 Item 分流到 **true** 或 **false** 出口，用于订单状态过滤、环境开关、灰度路由与多路编排。表达式在 isolated-vm 沙箱中求值，支持 \`async/await\` 与可选链，禁止 \`fetch\` / \`require\` / \`process\`。

## 端口

| 方向 | ID | 标签 | 说明 |
|------|-----|------|------|
| 输入 | main | 输入 | 上游 Items |
| 输出 | 0 | true | 条件为真时输出 |
| 输出 | 1 | false | 条件为假时输出 |

## 参数

| 参数 | 说明 |
|------|------|
| **condition** | 布尔表达式，**必须**写在 \`{{ }}\` 模板内；无模板包裹的纯文本不会进沙箱求值。 |

可用变量包括 \`$json\`、\`$env\`、\`$vars\`、\`$input\`、\`$nodes\`、\`$binary\`、\`$execution\`、\`$workflow\`、\`$itemIndex\`。

## 常见错误

| 场景 | 错误码 | 说明 |
|------|--------|------|
| 条件为空 | E2003 | 须配置非空 \`{{ }}\` 表达式 |
| 表达式语法错误 | failed | 求值失败，节点标记 failed |
| 缺少 \`{{ }}\` | — | 条件按纯文本处理，不会按预期分流 |

## 示例

### 示例 A

按 \`active\` 字段过滤：\`{{ $json.active === true }}\`，true 出口接后续处理，false 接告警或丢弃分支。

### 示例 B

结合环境变量：\`{{ $env.STAGE === "prod" && $json.amount > 100 }}\`，仅生产环境大额订单走审批链，测试环境走简化路径。

### 示例 C

引用前序节点：\`{{ $nodes["HTTP"]?.json?.statusCode === 200 }}\`，仅当上一步 HTTP 成功时才继续写库或通知下游。
`;

test('valid help doc passes validation', () => {
  const result = validateHelpDoc(VALID_DOC);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.charCount >= MIN_CHAR_COUNT);
});

test('help doc with chars < 300 fails', () => {
  const short = `# X

## 用途
短。

## 端口
无。

## 参数
无。

## 常见错误
无。

## 示例

### 示例 A
a

### 示例 B
b

### 示例 C
c
`;
  const result = validateHelpDoc(short);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes(String(MIN_CHAR_COUNT))));
});

test('missing required section fails', () => {
  const missing = VALID_DOC.replace('## 常见错误\n\n| 场景', '## 错误\n\n| 场景');
  const result = validateHelpDoc(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('常见错误')));
});

test('missing example A/B/C fails', () => {
  const noExamples = VALID_DOC.replace(/### 示例 [ABC][\s\S]*?(?=###|$)/g, '');
  const result = validateHelpDoc(noExamples);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('示例 A/B/C')));
});

test('countContentChars excludes fenced code blocks', () => {
  const withCode = `用途说明${'中'.repeat(50)}\n\`\`\`js\n${'x'.repeat(200)}\n\`\`\``;
  assert.ok(countContentChars(withCode) < 200);
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(0);
