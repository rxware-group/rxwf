# Merge 节点

## 用途

将 **多路上游** Items 合并为单路输出，用于并行分支汇总、按键关联或整批打包。Merge 为 **逻辑** 节点：2～8 个输入端口（由 `inputCount` 决定）、一个 **main** 输出。执行引擎通过 `inputBranches` 等待各输入分支就绪后再合并。

## 端口与连接

| 方向 | ID | 标签 | 说明 |
|------|-----|------|------|
| 输入 | 0 … n-1 | 输入 1 … n | `inputCount` 决定数量（2～8） |
| 输出 | main | 输出 | 合并后的 Items |

```
分支 A ──输入1──┐
分支 B ──输入2──┼→ merge → set / httpRequest …
分支 C ──输入3──┘
```

与 Loop **done** 出口配合时，可将各轮循环体结果经多路输入汇总。

## 参数

| 参数 | 说明 |
|------|------|
| **输入数量**（`inputCount`） | 2～8，默认 2 |
| **合并模式**（`mode`） | `append` / `combineByKey` / `combineAll` |
| **匹配字段**（`matchField`） | `combineByKey` 时必填，如 `id` |

| 模式 | 行为 |
|------|------|
| **append** | 按输入顺序拼接所有 Items |
| **combineByKey** | 按 `matchField` 分组，同键 Items 的 JSON 浅合并，binary 取组内首个非空 |
| **combineAll** | 输出单条 Item，JSON 为各输入 Items 数组，binary 合并 |

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2002** | `combineByKey` 缺少或空 `matchField`（运行时抛 `AwfError`） |
| **E2002** | 不支持的 `mode` 值，节点 `failed` |
| 输出条数不符预期 | append 为简单拼接；combineByKey 按键分组后条数等于不同键数量 |

## 示例

### 示例 A

**append**：HTTP 与 Set 两路结果 `输入1`、`输入2` 接入，下游一次性处理全部 Items。

### 示例 B

**combineByKey**：两路均含 `id` 字段，`matchField` 设为 `id`，同 id 的字段合并为一条 enriched Item。

### 示例 C

**combineAll**：三路审计日志输入合并为 `{ items: [...] }` 单条，便于写入对象存储或发送批量 API。
