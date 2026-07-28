# IF 节点

## 用途

按 **条件表达式** 将每条输入 Item 分流：**满足条件** 走 **true** 出口，其余走 **false** 出口。适合订单状态过滤、环境开关、与前序节点结果联判等场景。表达式为 JavaScript 子集，支持 `async/await`、可选链与数组方法；禁止 `fetch` / `require` / `process`。

## 端口与连接

| 方向 | ID | 标签 | 说明 |
|------|-----|------|------|
| 输入 | main | 输入 | 上游 Items |
| 输出 | 0 | true | 条件求值为 true 的 Items |
| 输出 | 1 | false | 条件为 false 的 Items |

```
manualTrigger → set → if ──true──→ httpRequest …
                      └──false──→ set / code …
```

## 参数

| 参数 | 说明 |
|------|------|
| **条件**（`condition`） | 布尔表达式，**必须**写在 `{{ }}` 内，如 `{{ $json.active === true }}` |

无 `{{ }}` 的纯文本不会进入沙箱求值。可用变量：`$json`、`$env`、`$vars`、`$input`、`$nodes`、`$binary`、`$execution`、`$workflow`、`$itemIndex`。详见 [表达式指南](/help/expressions)。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2003** | 配置了 `condition` 但表达式为空或非 `{{ }}` 模板 |
| 节点 **failed** | 表达式语法错误或运行时异常（不会静默当作 false） |
| true/false 皆空 | 条件对所有 Item 同真或同假；检查 `$json` 字段与类型 |

## 示例

### 示例 A

按布尔字段过滤：`{{ $json.active === true }}`。true 出口接业务处理，false 接告警或归档。

### 示例 B

组合环境与变量：`{{ $env.STAGE === "prod" && $vars.force === "1" && $json.amount > 100 }}`，仅生产环境大额订单进入审批链。

### 示例 C

引用前序 HTTP 节点：`{{ $nodes["HTTP Request"]?.json?.statusCode === 200 }}`，请求成功才继续写库；失败 Item 走 false 分支重试逻辑。
