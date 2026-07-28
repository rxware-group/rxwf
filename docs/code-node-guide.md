# Code 节点：变量与日志

> 本文说明工作流 **Code** 节点如何在沙箱中读取上游数据、返回结果，以及如何使用 `$log` 打印调试日志。  
> 相关实现：`packages/sandbox`、`packages/node-runner/src/executors/code.ts`。

---

## 1. 概述

Code 节点在独立 **Worker 线程沙箱** 中执行你编写的 JavaScript（参数 `jsCode`）。沙箱内**不能**使用 `require`、`import`、`console.log`，也不能访问文件系统或网络。

沙箱向脚本注入与 [表达式指南](./expression-guide.md) **相同 API** 的 `$` 全局变量（另加 `$log`）。Code 节点**不使用** `{{ }}` 包装，直接写 JavaScript。

| 标识符 | 说明 |
|--------|------|
| `$json` / `$binary` / `$itemIndex` | 第一条 input item（`$itemIndex` 默认 `0`） |
| `$input` | 包装对象：`all()` / `first()` / `last()` / `item` / `[n]`（与表达式相同） |
| `$env` / `$vars` | 已解析的环境变量与工作流变量（字符串） |
| `$nodes` | `$nodes["节点名"].json` / `.binary` / `.all()` 等（与表达式相同） |
| `$execution` / `$workflow` | 当前执行与工作流元数据（与表达式 §3.8、§3.9 相同） |
| `$log` | 调试日志（`debug` / `info` / `warn` / `error`）；仅 Code 节点 |

详见 [expression-guide §3.10](./expression-guide.md#310-code-节点中的-变量对照)。

---

## 2. 变量：`$input` 与上游数据

### 2.1 数据结构

`$input` 为包装对象（非裸数组），每个 item 元素形如：

```javascript
{
  json: { /* 任意 JSON 对象 */ },
  binary: { /* 可选：键 → { data, mimeType, fileName?, fileSize? } */ },
}
```

上游 HTTP / Webhook / ReadWriteFile(readBinary) 等节点可在 item 上附带 `binary`。读取方式：

- 单条输入：`$binary?.data` 或 `$input.first()?.binary?.data`
- 多条输入：`$input.all().map((item) => …)` 或 `$input[n]`

```javascript
// 与表达式 {{ $binary.data.mimeType }} 等价
const mime = $binary?.data?.mimeType;

return [{ json: { mime, name: $json.fileName } }];
```

### 2.2 读取单条 / 多条输入

```javascript
// 第一条输入
const first = $input.first()?.json ?? {};

// 遍历全部输入
for (const item of $input.all()) {
  const id = item.json.id;
  // ...
}

// 映射转换（常见写法）
return $input.all().map((item) => ({
  json: {
    ...item.json,
    processed: true,
  },
}));
```

### 2.3 访问环境变量与前序节点

Code 节点的 `jsCode` 是普通 JavaScript，**不会**自动解析 `{{ }}` 模板。请直接使用注入对象：

```javascript
const apiUrl = $env.API_URL;
const httpBody = $nodes['HTTP Request']?.json?.body;

return $input.all().map((item) => ({
  json: {
    ...item.json,
    apiUrl,
    userId: httpBody?.user?.id,
    runId: $execution.id,
    flow: $workflow.name,
  },
}));
```

| 对象 | 说明 |
|------|------|
| `$env.VAR_NAME` 或 `$env['VAR_NAME']` | 与表达式 `{{ $env.VAR_NAME }}` 相同 |
| `$nodes["节点名"].json` | 与表达式相同；该节点主出口第一条 item 的 `json` |
| `$nodes["节点名"].binary` | 与表达式相同；第一条 item 的 `binary` |
| `$nodes["节点名"].all()` | 该节点主出口全部 items |
| `$execution` / `$workflow` | 与表达式 §3.8、§3.9 相同 |

`$input` 表示**当前节点**收到的完整输入；`$nodes` 覆盖工作流中所有已执行的前序节点（按拓扑顺序），不限于直连上游。

其他节点（HTTP、Set、If 等）的字符串参数仍使用 `{{ $json }}`、`{{ $input[0].json.* }}`、`{{ $nodes["名称"].json.* }}`、`{{ $env.* }}` 表达式语法。

---

## 3. 返回结果

脚本末尾需要 **`return`** 一个值，平台会将其作为本节点输出传给下游。

### 3.1 推荐：返回 item 数组

```javascript
return [
  { json: { sum: $input[0].json.a + $input[0].json.b } },
];
```

多条输出示例：

```javascript
return $input.all().map((item) => ({
  json: { id: item.json.id, doubled: Number(item.json.id) * 2 },
}));
```

### 3.2 返回纯对象

也可以直接返回普通对象，平台会将其当作 `json` 字段：

```javascript
return { ok: true, count: $input.length };
```

等价于 `{ json: { ok: true, count: $input.length } }`。

### 3.3 返回多条 items 与 binary

Code 节点可返回 **WorkflowItem 数组**；每条可含 `json` 与可选 `binary`：

```javascript
return [{
  json: { ok: true, path: '/tmp/file.bin' },
  binary: {
    data: {
      data: Buffer.from('hello').toString('base64'),
      mimeType: 'text/plain',
      fileSize: 5,
    },
  },
}];
```

沙箱会校验 `binary` 中每个附件必须含 `data`（base64）与 `mimeType`。下游 HTTP（binaryFromItem）、IF（`$binary`）等节点可继续消费。

若返回单元素数组，等价于一条主输出 item：

```javascript
const total = $input.all().reduce((s, it) => s + (Number(it.json.qty) || 0), 0);
return [{ json: { total } }];
```

---

## 4. 打印日志：`$log`

沙箱内**没有** `console.log`。请使用注入的 **`$log`** 对象：

```javascript
$log.debug('变量快照: ' + JSON.stringify($input.first()?.json));
$log.info('开始处理');
$log.warn('缺少字段，使用默认值');
$log.error('无法解析 id');

return [{ json: { done: true } }];
```

### 4.1 API

| 方法 | 级别 | 说明 |
|------|------|------|
| `$log.debug(message)` | `debug` | 详细调试信息（编辑器中紫色显示） |
| `$log.info(message)` | `info` | 一般信息（蓝色级别标签） |
| `$log.warn(message)` | `warn` | 警告（黄色） |
| `$log.error(message)` | `error` | 错误（红色） |

`message` 可为任意类型，会经 `String()` 转为字符串。

### 4.2 限制

| 项 | 值 |
|----|-----|
| 最多条数 | 100 条（超出后静默丢弃） |
| 单条最大长度 | 4096 字符（超出截断） |
| 时间戳 | ISO 8601，由平台自动附加 |

---

## 5. 在编辑器中查看日志

1. 打开工作流编辑器，配置 Code 节点的 `jsCode`。
2. 使用 **调试 / 单步运行** 执行到该节点（或运行包含该节点的部分流程）。
3. 打开底部 **日志面板**（Editor Log Panel）。
4. 选中对应 Code 节点，切换到 **「运行日志」** 区域。

每条日志显示：`timestamp`、`[level]`、`message`。不同级别在编辑器中以不同颜色区分：

| 级别 | 颜色 |
|------|------|
| `debug` | 紫色级别标签 |
| `info` | 蓝色级别标签 |
| `warn` | 黄色 |
| `error` | 红色 |

若无日志，面板会提示「无运行日志。」

日志仅在调试运行结果（`nodeDebug.logs`）中展示，便于排查脚本逻辑，不替代正式执行的审计日志。

---

## 6. 完整示例

### 6.1 汇总并打日志

```javascript
$log.info(`收到 ${$input.length} 条输入`);

const rows = $input.all().map((item) => item.json);
const names = rows.map((r) => r.name).filter(Boolean);

$log.info('names: ' + names.join(', '));

return [
  {
    json: {
      count: rows.length,
      names,
    },
  },
];
```

### 6.2 条件分支与警告

```javascript
const first = $input.first()?.json;
if (!first) {
  $log.warn('无输入数据');
  return [{ json: { skipped: true } }];
}

if (first.status !== 'active') {
  $log.error(`无效状态: ${first.status}`);
  return [{ json: { valid: false, reason: 'bad status' } }];
}

return [{ json: { valid: true, userId: first.userId } }];
```

### 6.3 新建节点默认模板

编辑器新建 Code 节点时默认代码：

```javascript
return $input.all().map((item) => ({
  json: item.json,
}));
```

即原样透传上游 JSON，可作为起点再修改。

---

## 7. 超时与错误

未配置超时时脚本可一直运行直至完成。若运行环境设置了 `timeoutMs`，超时后 Worker 被终止，报错 `E2002`。

脚本抛出未捕获异常时，执行失败，错误信息为异常 `message`。

---

## 8. 安全限制（摘要）

详见 [adr-expression-sandbox.md](./adr-expression-sandbox.md)。

- 隔离：Worker 线程 + `new Function`（注入表达式同源 `$` 全局变量及 `$log`）
- 禁止：`require` / `import`、文件系统、网络（v1.0 默认）
- 无全局 `console`、`process`、`fetch` 等

---

## 9. 相关文档

| 文档 | 内容 |
|------|------|
| [expression-guide.md](./expression-guide.md) | `{{ }}` 表达式与 `$` 全局变量（Code 节点 API 对齐见 §3.10） |
| [adr-expression-sandbox.md](./adr-expression-sandbox.md) | 表达式与 Code 沙箱 ADR |
| [error-codes.md](./error-codes.md) | `E2002` 等运行错误码 |
| [node-plugin-spec.md](./node-plugin-spec.md) | 节点插件与 Items 模型 |
