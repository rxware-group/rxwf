# 表达式与 `{{ }}` 模板

工作流节点参数中的 `{{ }}` 表示 **JavaScript 表达式**，在独立沙箱中执行，用于动态计算 URL、条件、JSON 字段等。

## 基本规则

| 规则 | 说明 |
|------|------|
| 必须 `{{ }}` | 动态值须写在花括号内；无 `{{ }}` 的字段按**字面量**处理（不进沙箱） |
| 语言 | JavaScript（ES2022 子集，严格模式） |
| n8n 兼容 | `={{ expr }}` 会自动规范为 `{{ expr }}` |
| 混排 | 支持 `https://{{ $env.API_URL }}/users/{{ $json.id }}` |
| JSON 字段 | 全文可出现 `{{ }}`，替换后再 `JSON.parse`；失败报错 |

## 整段模板

字段值为整段模板时，花括号内为 JS 源码。单行表达式可省略 `return`：

```javascript
{{ $json.orderId }}
```

```javascript
{{ $env.API_URL + '/orders/' + $json.id }}
```

## 常用全局变量

| 变量 | 说明 |
|------|------|
| `$json` / `$binary` / `$itemIndex` | 当前 input item |
| `$input` | `all()` / `first()` / `last()` / `item` / `[n]` |
| `$env` / `$vars` | 环境变量与工作流变量（字符串） |
| `$nodes` | 前序节点输出，`$nodes["节点名"].json` |
| `$now` / `$today` | 当前时间 ISO 字符串 / 本地日零点 ISO |
| `$execution` / `$workflow` | 执行与工作流元数据 |
| `$fromAI(...)` | AI 填参占位，写在 `{{ }}` 内 |

## INPUT 面板

在节点弹窗左侧 **输入** 面板可查看上游数据与 **Variables and context** 的 JSON 预览，便于编写 `{{ }}` 表达式路径。详见 [INPUT 面板](/help/editor/input-panel)。

## 与 Code 节点的区别

- **表达式**：轻量内联，必须 `{{ }}`，用于参数字段。
- **Code 节点**：完整脚本，见 [Code 节点说明](/help/nodes/code)。
