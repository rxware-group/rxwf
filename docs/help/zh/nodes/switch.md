# Switch 节点

## 用途

按 **动态分支** 将每条 input Item 路由到**首条匹配**的分支出口。与 IF 的二分不同，Switch 支持任意多条互斥或有序条件，适合按状态码、地区、订单类型等多路分发。每条分支条件写法与 [IF 节点](/help/nodes/if) 相同，须为 `{{ }}` 布尔表达式。

## 端口与连接

| 方向 | ID | 说明 |
|------|-----|------|
| 输入 | main | 上游 Items |
| 输出 | 各分支 `id` | 编辑器中为 UUID；Handle 与连线的 `sourceHandle` 一致 |

分支 **label** 可编辑（默认「端口1」「端口2」…）。节点高度随分支数自适应；在 **SwitchBranchesPanel** 中可添加、删除、排序分支。

```
set → switch ──paid──→ set
           ├──pending──→ wait
           └──cancelled──→ code
```

## 参数

| 参数 | 说明 |
|------|------|
| **branches** | 数组，至少 1 条；每项含 `id`、`label`、`condition` |

| 字段 | 说明 |
|------|------|
| **id** | 稳定 UUID，作为 React Flow Handle id |
| **label** | 端口显示名 |
| **condition** | 布尔表达式，如 `{{ $json.status === "paid" }}` |

新建节点默认含一条 `{{ true }}` 分支便于单出口调试。保存时仅保留 `branches[]` 新模型；删除分支会同步清理以该 `id` 为 `sourceHandle` 的出边。

## 常见错误

| 错误码 / 现象 | 说明 |
|---------------|------|
| **E2003** | `branches` 为空或未配置任何分支 |
| 节点 **failed** | 某条 `condition` 求值异常（与 IF 一致，不静默当作 false） |
| Item 被丢弃 | 所有分支均为 false；**无兜底出口**，节点仍 success |
| 重复命中 | 自上而下首条 true 接收 Item；互斥条件应有序排列 |

## 示例

### 示例 A

订单状态三分：`{{ $json.status === "paid" }}` / `pending` / `cancelled` 三条分支，分别接发货、轮询与退款流程。

### 示例 B

地区与金额：`{{ $json.region === "cn" && $json.amount > 100 }}` 作为首条，次条 `{{ $json.region === "cn" }}`，其余走默认 `{{ true }}` 兜底（调试时）。

### 示例 C

引用环境：`{{ $env.TENANT === "A" && $json.type === "vip" }}`，多租户工作流按租户与会员等级路由到不同子流程。
