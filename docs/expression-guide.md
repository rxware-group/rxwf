# `{{ }}` 表达式使用指南

> **版本**：隐式 return（单行表达式可省略 `return`）  
> **关联**：[设计 spec](./superpowers/specs/2026-06-03-js-expression-globals-design.md)、[隐式 return](./superpowers/specs/2026-06-03-expression-implicit-return-design.md)、[ADR-004](./adr-expression-sandbox.md)、FR-9 [spec.md](./spec.md)

---

## 1. 概述

工作流节点参数中的 `{{ }}` 表示 **JavaScript 表达式**，在独立沙箱（`isolated-vm`）中执行，用于动态计算 URL、条件、JSON 字段等。

| 特性 | 说明 |
|------|------|
| 语言 | **JavaScript**（ES2022 子集，严格模式） |
| 返回值 | 任意 JSON 可序列化类型；条件节点再转为 `boolean` |
| 超时 | **不设**表达式运行超时 |
| 兼容 | **不兼容**旧版自研 AST 表达式语法 |

与 **Code 节点** 区别：Code 在 Worker 线程跑完整脚本；`{{ }}` 为轻量内联表达式（`isolated-vm`）。两者注入**相同 API** 的 `$` 全局变量（Code 另加 `$log`、不写 `{{ }}`），详见 [§3.10](#310-code-节点中的-变量对照)。

---

## 2. 写法形式

### 2.1 标准模板 `{{ ... }}`

字段值为**整段**模板时，花括号内为 JS 源码。**单行表达式**可省略 `return`（与写上 `return` 等价）：

```javascript
{{ $json.orderId }}
```

```javascript
{{ $env.API_URL + '/orders/' + $json.id }}
```

### 2.2 n8n 兼容前缀 `={{ ... }}`

与 `{{ ... }}` 等价，保存与求值前会规范为 AWF 形式：

```javascript
={{ $json }}
```

### 2.3 嵌入模板（fixed 模式字符串）

在普通文本中插入多段表达式，结果为**字符串**（每段按规则转成文本）：

```text
https://{{ $env.API_URL }}/users/{{ $json.id }}
```

### 2.4 统一模板规则（2026-06）

- 所有动态值**必须**写在 `{{ }}` 内；无 `{{ }}` 的字段按**字面量**处理（不进沙箱）。
- 支持混排：`D:/data/prefix-{{ $itemIndex }}.html`
- JSON 参数字段可在全文任意位置写 `{{ }}`，替换后再 `JSON.parse`；非法 JSON 报错。
- 已废弃 `_fieldModes`（fixed/expression/fromAi 切换）；`$fromAI(...)` 请写在 `{{ }}` 内。

### 2.5 多行与语句

支持语句块、`if`、`for`、`while` 等，最终以 `return` 给出结果：

```javascript
{{
  const ids = $input.all().map(i => i.json.id);
  return ids.join(',');
}}
```

---

## 3. 运行时全局变量

以下变量在每条 **input item** 求值时注入（IF/Switch 等对每个 item 各算一次）。

### 3.1 `$json` — 当前条目 JSON

```javascript
{{ $json.orderId }}
```

```javascript
{{ $json["user-id"] }}
```

```javascript
{{ $json.items?.[0]?.name }}
```

---

### 3.2 `$binary` — 当前条目二进制附件

结构：`Record<附件名, { data: base64字符串, mimeType, fileName? }>`。

```javascript
{{ $binary?.avatar?.mimeType === 'image/png' }}
```

```javascript
{{ Object.keys($binary ?? {}) }}
```

嵌入 URL/文本时，binary 会显示为占位符 `[binary:附件名]`，不会输出整段 base64。

---

### 3.3 `$input` — 当前节点输入

包装对象（非裸数组），常用 API：

| 成员 | 说明 |
|------|------|
| `$input.all()` | 全部输入 items 的副本 |
| `$input.first()` | 第一项 |
| `$input.last()` | 最后一项 |
| `$input.item` | 当前 item（与 `$json` 一致） |
| `$input.itemIndex` | 当前下标 |
| `$input.length` | 数量 |
| `$input[0]` | 按下标访问（兼容） |

```javascript
{{ $input.all().length }}
```

```javascript
{{ $input.first()?.json.batchId }}
```

```javascript
{{ $input[0].json.id === $json.id }}
```

```javascript
{{
  const rows = $input.all();
  return rows.every(i => i.json.ok === true);
}}
```

---

### 3.4 `$itemIndex` — 当前 item 下标

等价于 `$input.itemIndex`。

```javascript
{{ $itemIndex === 0 }}
```

```javascript
{{ $itemIndex % 2 === 0 ? 'even' : 'odd' }}
```

---

### 3.5 `$env` — 平台环境变量（按类型注入）

仅包含预定义的 `RXWF_*` 白名单（保存在平台数据库中）。用户自定义键请使用 `$vars`。

DB / API 仍存 **字符串**；进入表达式 / Code 沙箱前按 catalog `valueType` 解析：

| valueType | `$env` 运行时类型 |
|-----------|-------------------|
| `bool` | `boolean` |
| `int` / `port` / `double` | `number` |
| `string` / `password` / `url` / `path` | `string` |

**破坏性说明**：勿再写 `$env.RXWF_SMTP_SECURE === 'true'`，应使用 `$env.RXWF_SMTP_SECURE === true`。

`path` 键另有 `pathHost`（`controlPlane` | `runner`）：UI「…」浏览只列对应机器上的路径（Runner 路径须先选 Runner，不会静默逛控制面盘）。

```javascript
{{ $env.RXWF_PUBLIC_URL }}
```

```javascript
{{ $env["RXWF_SMTP_HOST"] }}
```

```javascript
{{ $env.RXWF_LANGCHAIN_TRACING_V2 === true }}
```

```javascript
{{ $env.RXWF_SANDBOX_CODE_TIMEOUT_MS }}
```

---

### 3.6 `$vars` — 工作流变量（仅字符串）

与 `$env` 不同，`$vars` **始终为字符串**，不支持 `$vars.A.B` 嵌套。

```javascript
{{ $vars.REGION }}
```

```javascript
{{ $vars.FEATURE_FLAG === '1' }}
```

```javascript
{{ $env.BASE_URL + $vars.API_PREFIX }}
```

---

### 3.7 `$nodes` — 已执行前序节点输出

按节点**显示名**（画布上的 name）索引；仅包含拓扑序上**已执行**的节点；v1 仅主输出分支。

| 成员 | 说明 |
|------|------|
| `$nodes["名称"].json` | 该节点主分支第一项的 json |
| `$nodes["名称"].binary` | 第一项的 binary |
| `$nodes["名称"].items` | 主分支全部 items |
| `$nodes["名称"].first()` | 第一项 item |
| `$nodes["名称"].all()` | items 副本 |
| `$nodes["名称"].last()` | 最后一项 |

节点不存在时 `$nodes["X"]` 为 `undefined`，请使用可选链：

```javascript
{{ $nodes["HTTP Request"]?.json?.status === 200 }}
```

```javascript
{{ $nodes["Set"].items[1].json.id }}
```

```javascript
{{
  const prev = $nodes["Transform"]?.all() ?? [];
  return prev.map(i => i.json.code).filter(Boolean);
}}
```

```javascript
{{ $nodes["Webhook"]?.binary?.file?.mimeType }}
```

**不支持** n8n 风格 `$("节点名")`，请统一写 `$nodes["节点名"]`。

---

### 3.8 `$execution` — 当前执行元数据

| 字段 | 说明 |
|------|------|
| `id` | 执行实例 ID |
| `mode` | `manual` / `production` / `partial` 等 |
| `environment` | `test` 或 `prod` |
| `startedAt` | ISO 时间字符串（可选） |

```javascript
{{ $execution.id }}
```

```javascript
{{ $execution.environment === 'prod' }}
```

```javascript
{{ $execution.mode === 'manual' }}
```

---

### 3.9 `$workflow` — 当前工作流元数据

| 字段 | 说明 |
|------|------|
| `id` | 工作流 ID |
| `name` | 工作流名称 |
| `versionId` | 版本 ID（可选） |

```javascript
{{ $workflow.name }}
```

```javascript
{{ $workflow.id + ':' + $execution.id }}
```

---

### 3.10 `$now` / `$today`

| 全局 | 类型 | 说明 |
|------|------|------|
| `$now` | ISO 字符串 | 求值时刻；同一会话内固定 |
| `$today` | ISO 字符串 | 本地时区当日 00:00 |

```javascript
{{ $now }}
```

```javascript
{{ $today }}
```

> **说明**：不提供 `$parameter`。当前节点的其他参数字段不能通过表达式全局互相引用；请使用 `$json`、`$nodes` 或 `$vars` / `$env`。

---

### 3.11 Code 节点中的 `$` 变量对照

[Code 节点](./code-node-guide.md) 的 `jsCode` **不使用** `{{ }}` 包装，直接写 JavaScript；注入的 `$` 全局变量与表达式 **API 一致**（另加 Code 专用 `$log`）。

| 变量 | 表达式 `{{ }}` | Code 节点 | 说明 |
|------|:--------------:|:---------:|------|
| `$json` | ✓ | ✓ | 表达式为**当前 item**；Code 默认 `$itemIndex === 0`（第一条 input） |
| `$binary` | ✓ | ✓ | 同上 |
| `$itemIndex` | ✓ | ✓ | 表达式随 item 变化；Code 默认 `0` |
| `$env` / `$vars` | ✓ | ✓ | 相同 |
| `$input` | ✓ | ✓ | 相同包装对象（`.all()` / `.first()` / `[n]` 等，见 §3.3） |
| `$nodes` | ✓ | ✓ | 相同：`$nodes["节点名"]`（见 §3.7） |
| `$execution` / `$workflow` | ✓ | ✓ | 相同（§3.8、§3.9） |
| `$now` / `$today` | ✓ | ✓ | 相同（§3.10） |
| `$log` | — | ✓ | 仅 Code 节点 |
| `{{ ... }}` 模板 | ✓ | ✗ | Code 中直接写 JS，勿写花括号模板 |

**写法对照**（去掉 `{{ }}` 即为 Code 节点代码）：

```javascript
// 表达式                         // Code（同一套 API）
{{ $input.all().length }}         $input.all().length
{{ $nodes["HTTP"]?.json?.status }} $nodes["HTTP"]?.json?.status
{{ $execution.environment }}      $execution.environment
```

多条 input 时，Code 一次执行整段脚本；遍历请用 `$input.all().map(...)`：

```javascript
return $input.all().map((item, index) => ({
  json: { index, mime: item.binary?.data?.mimeType },
}));
```

更多 Code 节点示例见 [code-node-guide.md](./code-node-guide.md)。

---

## 4. 按场景的返回值

| 使用场景 | 表达式写法 | 实际结果类型 |
|----------|------------|--------------|
| HTTP URL / Header（fixed + 嵌入） | `https://{{ $json.id }}` | **string** |
| 整段 `{{ ... }}` 的 expression 字段 | `{{ { a: 1 } }}` | **object** |
| IF / Switch 条件 | `{{ $json.ok }}` | **boolean**（`Boolean(结果)`） |
| JSON 节点（expression 模式） | `={{ $json }}` 或 JSON 内嵌模板 | **object** |
| Set 节点（expression 模式） | 字段模板 | 合并进 item.json |

### 4.1 嵌入模板的字符串化规则

| 求值结果 | 嵌入后的文本 |
|----------|--------------|
| `null` / `undefined` | 空字符串 |
| `string` / `number` / `boolean` | 直接转字符串 |
| `object` / `array` | `JSON.stringify` |
| binary 对象 | `[binary:键名]`（多个键用逗号连接） |

示例：

```text
user={{ $json.name }}&raw={{ { x: 1 } }}
```

→ `user=Alice&raw={"x":1}`

---

## 5. 节点示例速查

### 5.1 IF 条件

```javascript
{{ $json.active === true }}
```

```javascript
{{ $json.count > 1 && $json.count < 100 }}
```

```javascript
{{ ($env.STAGE === 'prod' || $vars.force === '1') && $json.enabled }}
```

```javascript
{{ !$json.disabled }}
```

表达式模式裸写：

```javascript
$nodes["HTTP"]?.json?.status >= 200 && $nodes["HTTP"]?.json?.status < 300
```

### 5.2 Switch 分支条件

每条分支 `condition` 均为 expression 模式，语法同 IF：

```javascript
{{ $json.kind === 'a' }}
```

```javascript
{{ $json.priority === 'high' && $execution.environment === 'prod' }}
```

```javascript
{{ true }}
```

### 5.3 HTTP 请求 URL

```text
{{ $env.API_URL }}/api/v1/users/{{ $json.userId }}
```

### 5.4 HTTP Header / Query

```javascript
{{ $env.API_TOKEN }}
```

```javascript
{{ 'Bearer ' + $vars.SERVICE_TOKEN }}
```

### 5.5 Set 节点（expression 模式字段）

```javascript
{{ { ...$json, processed: true, at: new Date().toISOString() } }}
```

```javascript
{{ { orderId: $json.id, source: $nodes["Webhook"]?.json?.source } }}
```

### 5.6 JSON 节点

整段对象：

```javascript
={{ $json }}
```

JSON 字符串内嵌模板：

```json
{
  "url": "{{ $env.API_URL }}",
  "user": "{{ $json.name }}",
  "meta": {{ JSON.stringify($json.meta) }}
}
```

### 5.7 人工审批提示

```text
请确认是否继续部署版本 {{ $json.version }}（环境：{{ $execution.environment }}）
```

---

## 6. JavaScript 能力边界

### 6.1 允许

- 运算符、`if/else`、`for`/`while`、`switch`
- 箭头函数、`.map()` / `.filter()` / `.reduce()` 等数组方法
- 可选链 `?.`、空值合并 `??`
- 模板字符串 `` `hello ${$json.name}` ``
- `async/await`（仅用户自定义 Promise，沙箱不提供 IO）
- 标准内置：`Math`、`JSON`、`Date`、`Array`、`Map`、`Set`、`RegExp` 等

```javascript
{{
  const total = $input.all().reduce((s, i) => s + (Number(i.json.qty) || 0), 0);
  return total > 100;
}}
```

```javascript
{{
  return await Promise.resolve($json.delayMs ?? 0);
}}
```

```javascript
{{
  const m = $json.email?.match(/@(.+)$/);
  return m ? m[1] : null;
}}
```

### 6.2 禁止（保存校验 + 运行期）

| 类别 | 示例（不可用） |
|------|----------------|
| 进程 / 全局 | `process`、`globalThis` |
| 模块 | `require`、`import`、`import()` |
| 网络 | `fetch`、`XMLHttpRequest`、`WebSocket` |
| 定时器 | `setTimeout`、`setInterval`、`queueMicrotask` |
| 动态代码 | `eval`、`new Function` |

保存工作流时会对所有表达式字段做 **acorn 静态扫描**，违规报 `E1002`。

---

## 7. 与 `$fromAI` 的配合

工具节点参数中的 `$fromAI("key", ...)` 在 **JS 求值之前** 由平台替换为 LLM 工具参数值，不是运行时全局变量。

```text
{"query": "{{ $fromAI(\"query\", \"Search terms\", \"string\") }}"}
```

替换完成后再按普通 `{{ }}` 表达式求值。

---

## 8. 与 n8n 的对照

| n8n | AWF |
|-----|-----|
| `={{ $json.x }}` | `{{ $json.x }}`（等价 `{{ return $json.x }}`） |
| `$('HTTP').json` | `$nodes["HTTP"]?.json` |
| `$input.all()` | `$input.all()`（相同） |
| `$vars.x` | `$vars.x`（均为字符串） |
| `$execution` / `$workflow` | 已支持，字段见 §3.8、§3.9 |
| `$now` / Luxon 扩展 | **v1.1 规划**，可用 `new Date()` |

---

## 9. 错误与调试

| 代码 | 常见原因 |
|------|----------|
| **E1002** | 语法错误、禁止标识符、未定义节点名访问 `.json`、表达式结果类型不符合字段要求 |
| 保存校验失败 | 表达式含 `process`/`fetch`/`import` 等 |

调试建议：

1. 在 IF 节点先用简单条件验证 `$json` 是否有值。
2. 访问 `$nodes["某节点"]` 时始终加 `?.`。
3. `$env` 按类型注入（bool→boolean，数值→number）；`$vars` 为字符串。数值比较对 `$vars` 仍可用 `Number()` 或 `===` 字符串。
4. 复杂逻辑可拆成 Code 节点写字段，再在 IF 中判断该字段。

---

## 10. 完整示例索引（复制即用）

### 10.1 标量返回

```javascript
{{ $json.id }}
{{ $json.price * 1.1 }}
{{ String($json.code).toUpperCase() }}
{{ $json.enabled ? 'yes' : 'no' }}
```

### 10.2 布尔条件

```javascript
{{ $json.status === 'active' }}
{{ $json.score >= 60 && $json.score <= 100 }}
{{ $vars.MAINTENANCE !== '1' }}
{{ $nodes["Filter"]?.json?.passed === true }}
```

### 10.3 字符串拼接

```javascript
{{ $env.API_URL + '/v2/' + $json.resource }}
{{ `${$vars.PREFIX}-${$json.id}` }}
{{ [$env.HOST, $json.path].filter(Boolean).join('/') }}
```

### 10.4 数组 / 对象

```javascript
{{ $json.tags ?? [] }}
{{ { id: $json.id, env: $execution.environment } }}
{{ $input.all().map(i => i.json.email) }}
{{ Object.fromEntries($input.all().map((i, n) => ['item' + n, i.json])) }}
```

### 10.5 聚合与循环

```javascript
{{
  let sum = 0;
  for (const item of $input.all()) {
    sum += Number(item.json.amount) || 0;
  }
  return sum;
}}
```

```javascript
{{
  const byType = {};
  for (const item of $input.all()) {
    const t = String(item.json.type ?? 'unknown');
    byType[t] = (byType[t] ?? 0) + 1;
  }
  return byType;
}}
```

### 10.6 前序节点组合

```javascript
{{ $nodes["HTTP"]?.json?.body?.token }}
{{ ($nodes["A"]?.json?.x ?? 0) + ($nodes["B"]?.json?.y ?? 0) }}
{{
  const http = $nodes["HTTP Request"]?.all() ?? [];
  return http.length > 0 ? http[http.length - 1].json.etag : null;
}}
```

### 10.7 执行 / 工作流上下文

```javascript
{{ $execution.environment === 'prod' && $workflow.name.includes('Prod') }}
{{ $execution.mode !== 'manual' }}
{{ $itemIndex === $input.length - 1 }}
```

### 10.8 async（无 IO）

```javascript
{{
  async function delayMs(ms) {
    return ms;
  }
  return await delayMs(Number($json.wait) || 0);
}}
```

```javascript
{{
  return await Promise.all(
    $input.all().map(i => Promise.resolve(i.json.id))
  );
}}
```

### 10.9 嵌入 URL / 文本

```text
{{ $env.API_URL }}/orders/{{ $json.orderId }}?debug={{ $execution.mode }}
```

```text
Hello {{ $json.name }}, total={{ $json.total }}
```

### 10.10 JSON 模板字段

```json
{
  "executionId": "{{ $execution.id }}",
  "payload": {{ JSON.stringify($json) }}
}
```

---

## 11. 相关文档

- [设计 spec（全局变量与沙箱）](./superpowers/specs/2026-06-03-js-expression-globals-design.md)
- [实施计划](./superpowers/plans/2026-06-03-js-expression-engine.md)
- [ADR-004 表达式与 Code 沙箱](./adr-expression-sandbox.md)
- [Code 节点指南](./code-node-guide.md)（完整脚本；`$` 变量对照见本文 [§3.10](#310-code-节点中的-变量对照)）

---

## 12. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-04 | §3.10 更新：Code 节点已与表达式对齐全部 `$` 全局变量 API |
| 2026-06-04 | 新增 §3.10：表达式 `$` 变量在 Code 节点中的可用性与 API 差异对照 |
| 2026-06-04 | 初版用户指南，覆盖 isolated-vm JS 表达式与全部全局变量示例 |
