# Code 节点

## 用途

在 **Worker 沙箱**（Piscina 线程池）中运行 JavaScript，对每条上游 **Item** 执行 `jsCode` 脚本并输出转换后的 Items。适合批量映射、聚合、过滤、联表前序节点输出等逻辑，比 IF/Switch 更灵活。

脚本内为普通 JS，**不会**解析 `{{ }}` 模板。不可用 `require` / `import` / `console.log`，也无法直接访问文件系统或网络；调试请使用 `$log`（debug / info / warn / error），在编辑器运行日志面板查看。

## 端口与连接

Code 为 **动作** 节点：一个 **main** 输入、一个 **main** 输出。

```
manualTrigger / webhookTrigger → set → code → httpRequest / merge …
```

可与 Loop 循环体配合：Loop **loop** 出口 → Code → 循环体下游。

## 参数

| 参数 | 说明 |
|------|------|
| **JavaScript**（`jsCode`） | 完整脚本；末尾须 `return` 标准 items 数组或单条 json 对象 |
| **超时 (ms)**（`timeoutMs`） | 默认 `-1` 不超时；正数为沙箱超时毫秒数（设置页可配置全局默认） |

### 脚本内变量

| 变量 | 说明 |
|------|------|
| `$input` | 当前节点完整输入 items 数组 |
| `$json` / `$binary` / `$itemIndex` | 第一条 input item 的快捷访问 |
| `$env` / `$vars` | 运行期环境变量与工作流变量（字符串） |
| `$nodes` | 已执行前序节点输出 `{ name, json, items }` |
| `$execution` / `$workflow` | 执行与工作流元数据 |
| `$log` | 调试日志 |

### 返回值

- 推荐：`return [{ json: { … } }];`
- 或：`return { ok: true }`（视为单条 json）

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| 沙箱超时 | `timeoutMs` 过小或脚本死循环 |
| `ReferenceError` | 使用了 `require` / `import` / `console.log` |
| 无输出 / 空数组 | 忘记 `return` 或返回格式不正确 |
| 与表达式混用 | 在 `jsCode` 内写 `{{ }}` 不会被求值，应直接用 `$json` 等变量 |

更多对照见 [表达式指南](/help/expressions) 的 Code 章节。

## 示例

### 示例 A

复制参数 **JavaScript**（`jsCode`）——批量加倍计数字段：

```javascript
return $input.map((item) => ({
  json: {
    ...item.json,
    doubled: Number(item.json.count ?? 0) * 2,
  },
}));
```

### 示例 B

最小可运行工作流 JSON（≤5 节点）：

```json
{
  "nodes": [
    {
      "id": "t1",
      "type": "manualTrigger",
      "name": "Trigger",
      "position": { "x": 0, "y": 0 },
      "parameters": { "json": { "count": 3 } }
    },
    {
      "id": "c1",
      "type": "code",
      "name": "Code",
      "position": { "x": 200, "y": 0 },
      "parameters": {
        "jsCode": "return [{ json: { ok: true, from: $json.count } }];",
        "timeoutMs": -1
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [[{ "node": "Code", "type": "main", "index": 0 }]]
    }
  }
}
```

### 示例 C

联表前序 HTTP 节点与环境变量：

```javascript
const base = $env.API_URL ?? '';
const prev = $nodes.find((n) => n.name === 'HTTP')?.json ?? {};
$log.info('build url', { base, path: prev.path });
return [{ json: { url: base + String(prev.path ?? '') } }];
```
